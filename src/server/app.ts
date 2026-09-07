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
import type { CorpusIndex } from "../core/types.js";
import { principalFromGroups } from "../security/auth.js";
import { answerQuestion } from "../retrieval/answer.js";
import { functionsForGroups } from "../roles.js";
import { beginLogin, handleCallback, type OAuthConfig } from "./oauth.js";
import { issueSession as _issue, verifySession, cookieHeader, clearCookieHeader, readCookie } from "./session.js";
void _issue;

export interface ServerDeps {
  index: CorpusIndex;
  oauth: OAuthConfig;
  /** true in prod (adds `Secure` to cookies); false for http://localhost tests */
  secureCookies?: boolean;
  /** optional generative backend */
  llm?: Parameters<typeof answerQuestion>[3] extends { llm?: infer L } ? L : never;
}

function json(res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...extraHeaders });
  res.end(JSON.stringify(body));
}
async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

export function createApp(deps: ServerDeps) {
  const secure = deps.secureCookies ?? process.env.NODE_ENV === "production";

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
        const r = await handleCallback(deps.oauth, code, state);
        res.writeHead(302, { location: "/", "set-cookie": cookieHeader(r.sessionToken, secure) });
        return res.end();
      }

      if (path === "/auth/logout") {
        res.writeHead(302, { location: "/", "set-cookie": clearCookieHeader(secure) });
        return res.end();
      }

      // ---- session-gated API ----
      const session = verifySession(readCookie(req));

      if (path === "/api/me") {
        if (!session) return json(res, 401, { error: "not signed in" });
        return json(res, 200, { email: session.email, name: session.name, groups: session.groups });
      }

      if (path === "/api/ask" && req.method === "POST") {
        if (!session) return json(res, 401, { error: "not signed in" });
        const body = (await readBody(req)) as { question?: string; deepDive?: boolean; roleContext?: boolean };
        const question = (body.question ?? "").trim();
        if (!question) return json(res, 400, { error: "question required" });

        const principal = principalFromGroups(session.email.split("@")[0] ?? session.sub, session.groups);
        const ans = await answerQuestion(deps.index, question, principal, {
          llm: deps.llm as never,
          followUps: body.deepDive ?? false,
          roleContext: body.roleContext ? { functions: functionsForGroups(session.groups) } : undefined,
        });
        return json(res, 200, ans);
      }

      return json(res, 404, { error: "not found" });
    } catch (e) {
      return json(res, 500, { error: (e as Error).message });
    }
  });
}
