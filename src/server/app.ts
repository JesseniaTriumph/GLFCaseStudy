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
import { functionsForGroups } from "../roles.js";
import { beginLogin, handleCallback, type OAuthConfig } from "./oauth.js";
import { issueSession as _issue, verifySession, cookieHeader, clearCookieHeader, readCookie, revokeUser, revokeAll } from "./session.js";
import { RateLimiter } from "./limits.js";
import { Monitor, type Signal } from "../security/monitor.js";
import { AuditLog, type AuditEvent } from "../security/audit.js";
void _issue;

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
  const limiter = deps.limiter ?? new RateLimiter();
  const monitor = deps.monitor ?? new Monitor();

  const record = (ev: AuditEvent) => {
    deps.audit?.append(ev);
    for (const sig of monitor.observe(ev)) deps.onSignal?.(sig);
  };
  const clientKey = (req: IncomingMessage, sub?: string) =>
    sub ? `u:${sub}` : `ip:${(req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown"}`;

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname;
    // security headers on everything
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");

    try {
      if (path === "/health") return json(res, 200, { ok: true, chunks: deps.index.chunks.length });

      // ---- auth ----
      if (path === "/auth/login" && req.method === "GET") {
        const { url: authUrl } = beginLogin(deps.oauth);
        res.writeHead(302, { location: authUrl });
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

      return json(res, 404, { error: "not found" });
    } catch (e) {
      return json(res, 500, { error: (e as Error).message });
    }
  });
}
