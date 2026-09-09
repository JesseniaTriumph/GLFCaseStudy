/**
 * The Compass HTTP server — plain Node `http`, no framework.
 *
 * Routes:
 *   GET  /health
 *   GET  /auth/login            → 302 to Google's authorize endpoint (PKCE)
 *   GET  /auth/callback         → verify ID token, resolve groups, set session cookie, 302 /
 *   GET  /auth/logout           → clear the session cookie
 *   GET  /api/me                → the session identity, or 401
 *   POST /api/ask               → { question, deepDive?, roleContext? } → an evidence brief; 401 without a session
 *
 * The session is an HMAC cookie (src/server/session.ts). Every /api/ask builds a Principal
 * from the session's groups and hands it to the same answerQuestion() the CLI uses — so
 * the permission filter is enforced on every request.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { appendFileSync } from "node:fs";
import type { CorpusIndex } from "../core/types.js";
import { principalFromGroups } from "../security/auth.js";
import { answerQuestion } from "../retrieval/answer.js";
import { mayRead } from "../retrieval/search.js";
import { renderSourcePreview } from "./source-preview.js";
import { functionsForGroups } from "../roles.js";
import { beginLogin, handleCallback, type OAuthConfig } from "./oauth.js";
import { issueSession, verifySession, cookieHeader, clearCookieHeader, readCookie, revokeUser, revokeAll } from "./session.js";
import { makeStaticHandler } from "./static.js";
import { DEMO_PERSONAS, demoPersona } from "./demo-personas.js";
import { RateLimiter } from "./limits.js";
import { Monitor, type Signal } from "../security/monitor.js";
import { AuditLog, type AuditEvent } from "../security/audit.js";

export interface ServerDeps {
  index: CorpusIndex;
  oauth: OAuthConfig;
  /** true in prod (adds `Secure` to cookies); false for http://localhost tests */
  secureCookies?: boolean;
  /** optional generative backend */
  llm?: Parameters<typeof answerQuestion>[3] extends { llm?: infer L } ? L : never;
  /** per-user rate + cost limiting; a default in-process limiter is used if omitted */
  limiter?: RateLimiter;
  /** anomaly detection over the audit stream; a default Monitor is used if omitted */
  monitor?: Monitor;
  /** tamper-evident audit log; if provided, every query + auth result is appended */
  audit?: AuditLog;
  /** called for every anomaly signal the monitor raises (on-call hook) */
  onSignal?: (s: Signal) => void;
  /** append target for /api/feedback (default: eval/feedback.jsonl) */
  feedbackLog?: string;
  /** absolute path to the built web app (web/dist). When set, the SPA is served same-origin. */
  webRoot?: string;
  /** mount `/auth/demo?persona=<key>` — issues a real session for a fictional user. Demo only. */
  demoLogin?: boolean;
  /** whether real Google OIDC is configured (drives what the web app's sign-in bar shows) */
  oauthConfigured?: boolean;
  /**
   * Mount `GET /s/<docId>` — renders a cited document (as indexed) styled like its source
   * system, with the passage highlighted, because the fictional `deepLink`s point nowhere.
   * Permission-checked against the caller's session. Demo only; defaults to `demoLogin`.
   */
  sourcePreview?: boolean;
}

/**
 * Kill switch (strategy doc §6.9, G_Security_Review RESPOND). When engaged, /api/ask
 * returns 503 and answers nothing until an admin turns it back on. The index is fully
 * derived, so this plus an index rebuild is the whole containment story.
 */
let killed = false;
export const killSwitch = {
  engage: () => {
    killed = true;
  },
  release: () => {
    killed = false;
  },
  get engaged() {
    return killed;
  },
};

/**
 * Usage / trust / cost snapshot from the audit log (roadmap 4.3). Cost is a rough
 * estimate: an extractive answer is ~free; a generative one is ~6k in + 0.5k out tokens
 * at Sonnet 5 rates ($2 / $10 per M) ≈ $0.017.
 */
export function auditStats(records: readonly import("../security/audit.js").AuditRecord[]) {
  const q = records.filter((r) => r.event.type === "query").map((r) => r.event as Extract<AuditEvent, { type: "query" }>);
  const auth = records.filter((r) => r.event.type === "auth").map((r) => r.event as Extract<AuditEvent, { type: "auth" }>);
  const users = new Set(q.map((e) => e.user));
  const refused = q.filter((e) => e.confidence === "refused").length;
  const restrictedProbes = q.filter((e) => e.confidence === "refused" && e.withheldTiers.includes("restricted")).length;
  const generative = q.filter((e) => e.mode === "generative").length;
  const byUser: Record<string, number> = {};
  for (const e of q) byUser[e.user] = (byUser[e.user] ?? 0) + 1;
  return {
    queries: q.length,
    uniqueUsers: users.size,
    refusalRate: q.length ? +(refused / q.length).toFixed(3) : 0,
    restrictedProbes,
    authDenials: auth.filter((e) => e.result === "denied").length,
    generativeShare: q.length ? +(generative / q.length).toFixed(3) : 0,
    estMonthlyCostUsd: +(generative * 0.017 + (q.length - generative) * 0.001).toFixed(2),
    topUsers: Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 5),
    auditChainLength: records.length,
  };
}

function json(res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...extraHeaders });
  res.end(JSON.stringify(body));
}
const MAX_BODY = 64 * 1024; // a question + a couple of flags is tiny; cap the rest
async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const c of req) {
    total += (c as Buffer).length;
    if (total > MAX_BODY) {
      req.destroy();
      return {};
    }
    chunks.push(c as Buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

export function createApp(deps: ServerDeps) {
  const secure = deps.secureCookies ?? process.env.NODE_ENV === "production";
  const sourcePreview = deps.sourcePreview ?? deps.demoLogin ?? false;
  const limiter = deps.limiter ?? new RateLimiter();
  const monitor = deps.monitor ?? new Monitor();
  const serveStatic = makeStaticHandler(deps.webRoot);

  const record = (ev: AuditEvent) => {
    deps.audit?.append(ev);
    for (const sig of monitor.observe(ev)) deps.onSignal?.(sig);
  };
  const clientKey = (req: IncomingMessage, sub?: string) =>
    sub ? `u:${sub}` : `ip:${(req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown"}`;

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname;
    // security headers on everything (OWASP A05 — security misconfiguration).
    // This process is a JSON API only: it renders no HTML and no cross-origin caller is
    // allowed (the web app and the embed widget are served same-origin, so there is no
    // CORS allowlist by design). The headers below make that posture explicit.
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), browsing-topics=()");
    if (secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

    try {
      if (path === "/health") return json(res, 200, { ok: true, chunks: deps.index.chunks.length });

      // What the web app needs to render its sign-in bar: is real Google sign-in wired,
      // and is the demo persona switch available. No identity, nothing sensitive.
      if (path === "/api/config") {
        return json(res, 200, {
          oauthConfigured: deps.oauthConfigured ?? false,
          demoLogin: deps.demoLogin ?? false,
          personas: deps.demoLogin
            ? DEMO_PERSONAS.filter((p) => p.groupsResolved !== false).map((p) => ({ key: p.key, label: p.label, note: p.note }))
            : [],
          corpusLabel: deps.index.corpusLabel,
        });
      }

      // ---- auth ----
      if (path === "/auth/login" && req.method === "GET") {
        const { url: authUrl } = beginLogin(deps.oauth);
        res.writeHead(302, { location: authUrl });
        return res.end();
      }

      // Demo sign-in: issue a REAL session for a fictional user. Every downstream check
      // (permission filter, rate limit, audit, revocation) runs exactly as in production —
      // only the identity provider is stubbed. Mounted only when `demoLogin` is on.
      if (path === "/auth/demo" && deps.demoLogin) {
        const persona = demoPersona(url.searchParams.get("persona") ?? "");
        if (!persona) return json(res, 400, { error: "unknown persona", personas: DEMO_PERSONAS.map((p) => p.key) });
        const token = issueSession({ sub: persona.sub, email: persona.email, name: persona.name, groups: persona.groups, groupsResolved: persona.groupsResolved ?? true });
        record({ type: "auth", user: persona.email, result: "ok", reason: "demo" });
        const wantsJson = (req.headers.accept ?? "").includes("application/json");
        if (wantsJson) return json(res, 200, { ok: true, email: persona.email, name: persona.name }, { "set-cookie": cookieHeader(token, secure) });
        res.writeHead(302, { location: "/", "set-cookie": cookieHeader(token, secure) });
        return res.end();
      }

      if (path === "/auth/callback" && req.method === "GET") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return json(res, 400, { error: "missing code/state" });
        try {
          const r = await handleCallback(deps.oauth, code, state);
          record({ type: "auth", user: r.email ?? "unknown", result: "ok" });
          res.writeHead(302, { location: "/", "set-cookie": cookieHeader(r.sessionToken, secure) });
          return res.end();
        } catch (e) {
          record({ type: "auth", user: "unknown", result: "denied", reason: (e as Error).message });
          return json(res, 401, { error: "sign-in failed" });
        }
      }

      if (path === "/auth/logout") {
        // revoke server-side, not just clear the cookie — a copied cookie stops working too
        const s = verifySession(readCookie(req));
        if (s) {
          revokeUser(s.sub);
          record({ type: "auth", user: s.email, result: "ok", reason: "logout" });
        }
        res.writeHead(302, { location: "/", "set-cookie": clearCookieHeader(secure) });
        return res.end();
      }

      // Admin: revoke a user's sessions now (account deactivation), or everyone (incident).
      // Gated on an admin group in the caller's session.
      const adminSession = () => {
        const s = verifySession(readCookie(req));
        return s && s.groups.some((g) => /admin|leadership|executive/i.test(g)) ? s : null;
      };
      if (path === "/admin/revoke" && req.method === "POST") {
        const s = adminSession();
        if (!s) return json(res, 403, { error: "admin only" });
        const body = (await readBody(req)) as { sub?: string; all?: boolean };
        if (body.all) revokeAll();
        else if (body.sub) revokeUser(body.sub);
        else return json(res, 400, { error: "sub or all required" });
        record({ type: "admin", user: s.email, action: "revoke", detail: body.all ? "all" : body.sub });
        return json(res, 200, { ok: true });
      }
      if (path === "/admin/review" && req.method === "GET") {
        const s = adminSession();
        if (!s) return json(res, 403, { error: "admin only" });
        return json(res, 200, {
          entityReviewQueue: deps.index.reviewQueue,
          excluded: deps.index.gaps.excluded,
          dedupe: deps.index.dedupe,
          killSwitch: killSwitch.engaged,
        });
      }
      if (path === "/admin/stats" && req.method === "GET") {
        const s = adminSession();
        if (!s) return json(res, 403, { error: "admin only" });
        return json(res, 200, auditStats(deps.audit?.all() ?? []));
      }
      if (path === "/admin/killswitch" && req.method === "POST") {
        const s = adminSession();
        if (!s) return json(res, 403, { error: "admin only" });
        const body = (await readBody(req)) as { on?: boolean };
        body.on ? killSwitch.engage() : killSwitch.release();
        record({ type: "admin", user: s.email, action: "killswitch", detail: body.on ? "engaged" : "released" });
        return json(res, 200, { engaged: killSwitch.engaged });
      }

      // ---- session-gated API ----
      const session = verifySession(readCookie(req));

      if (path === "/api/me") {
        if (!session) return json(res, 401, { error: "not signed in" });
        return json(res, 200, { email: session.email, name: session.name, groups: session.groups });
      }

      if (path === "/api/feedback" && req.method === "POST") {
        if (!session) return json(res, 401, { error: "not signed in" });
        const b = (await readBody(req)) as { question?: unknown; answerText?: unknown; verdict?: unknown; note?: unknown };
        const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
        const fq = str(b.question, 2000);
        if (!fq || !["up", "down"].includes(String(b.verdict))) return json(res, 400, { error: "question + verdict (up|down) required" });
        const entry = { ts: new Date().toISOString(), user: session.email, question: fq, verdict: b.verdict, note: str(b.note, 500), answerPreview: str(b.answerText, 400) };
        try {
          appendFileSync(deps.feedbackLog ?? "eval/feedback.jsonl", JSON.stringify(entry) + "\n");
        } catch {
          /* best effort */
        }
        record({ type: "admin", user: session.email, action: "feedback", detail: `${b.verdict}: ${fq.slice(0, 80)}` });
        return json(res, 200, { ok: true });
      }

      if (path === "/api/ask" && req.method === "POST") {
        if (!session) return json(res, 401, { error: "not signed in" });
        if (killSwitch.engaged) return json(res, 503, { error: "Compass is paused by an administrator." });
        const body = (await readBody(req)) as { question?: string; deepDive?: boolean; roleContext?: boolean };
        const question = (body.question ?? "").trim().slice(0, 2000);
        if (!question) return json(res, 400, { error: "question required" });

        // per-user rate + cost limit — generation costs more budget than an extractive brief
        const key = clientKey(req, session.sub);
        const decision = limiter.check(key, deps.llm ? 1 : 0.25);
        res.setHeader("X-RateLimit-Remaining", String(decision.remaining));
        if (!decision.ok) {
          res.setHeader("Retry-After", String(decision.retryAfter ?? 1));
          return json(res, 429, { error: `${decision.limit} limit exceeded`, retryAfter: decision.retryAfter });
        }

        const principal = principalFromGroups(
          session.email.split("@")[0] ?? session.sub,
          session.groups,
          session.groupsResolved !== false
        );
        if (principal.allowedTiers.length === 0) {
          return json(res, 403, {
            error: "Your account isn't mapped to a Compass access group yet. Contact the workspace admin.",
          });
        }
        const ans = await answerQuestion(deps.index, question, principal, {
          llm: deps.llm as never,
          followUps: body.deepDive ?? false,
          roleContext: body.roleContext ? { functions: functionsForGroups(session.groups) } : undefined,
          sourcePreview,
        });
        // The answer shown to the user reveals no restricted-record count (that metadata is
        // itself sensitive), but the internal audit log still needs to know a restricted
        // topic was probed — derive it from the refusal reason for the monitor.
        const reasonBlob = `${ans.confidenceReason ?? ""} ${ans.withheld?.reason ?? ""}`.toLowerCase();
        record({
          type: "query",
          user: session.email,
          question,
          citedRefs: ans.citations.map((c) => c.ref),
          citedTiers: [...new Set(ans.citations.map((c) => c.tier))],
          withheld: ans.withheld?.count ?? 0,
          withheldTiers: ["team", "programs-only", "restricted"].filter((t) => reasonBlob.includes(t.replace("-", " ")) || reasonBlob.includes(t)),
          confidence: ans.confidence,
          mode: ans.mode,
        });
        return json(res, 200, ans);
      }

      // Demo-only source viewer: render a cited document as Compass indexed it, styled like
      // its source system, passage highlighted — the fictional deepLinks point nowhere.
      // Permission-checked: you only see a source you were entitled to retrieve.
      if (sourcePreview && path.startsWith("/s/") && req.method === "GET") {
        if (!session) {
          res.writeHead(302, { location: "/" });
          return res.end();
        }
        const docId = decodeURIComponent(path.slice(3));
        const principal = principalFromGroups(
          session.email.split("@")[0] ?? session.sub,
          session.groups,
          session.groupsResolved !== false
        );
        const { status, html } = renderSourcePreview({
          index: deps.index,
          docId,
          highlight: url.searchParams.get("h") ?? "",
          canRead: (chunk) => mayRead(chunk, principal),
        });
        res.writeHead(status, {
          "content-type": "text/html; charset=utf-8",
          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:",
          "referrer-policy": "same-origin",
          "x-content-type-options": "nosniff",
        });
        return res.end(html);
      }

      // Anything else: the built web app (same origin). Unknown /api|/auth|/admin paths 404.
      if (!/^\/(api|auth|admin)\b/.test(path) && serveStatic(req, res, path)) return;

      return json(res, 404, { error: "not found" });
    } catch (e) {
      return json(res, 500, { error: (e as Error).message });
    }
  });
}
