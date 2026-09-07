/**
 * End-to-end test of the Compass HTTP server + the full OIDC login flow.
 *
 *   npm run server:check
 *
 * Stands up a mock Google IdP (auto-approves, signs real RS256 ID tokens), starts the
 * Compass server against it, and drives:
 *   1. POST /api/ask with no session          → 401
 *   2. GET  /auth/login                        → 302 to the IdP
 *   3. follow the IdP's redirect to /auth/callback → session cookie set
 *   4. GET  /api/me                            → the signed-in identity
 *   5. POST /api/ask (as a Program Officer)    → an evidence brief with citations
 *   6. POST /api/ask (restricted question)     → refused, nothing leaked
 *   7. GET  /auth/logout then POST /api/ask    → 401 again
 */
import { createServer } from "node:http";
import { generateKeyPairSync, createSign } from "node:crypto";
import { runPipeline } from "../src/pipeline/run.js";
import { ADAPTERS, CORPUS } from "../src/config.js";
import { createApp } from "../src/server/app.js";
import { RateLimiter } from "../src/server/limits.js";
import { Monitor } from "../src/security/monitor.js";
import type { Signal } from "../src/security/monitor.js";
import type { Jwk } from "../src/security/auth.js";

let pass = 0,
  fail = 0;
const ok = (n: string, c: boolean, extra = "") => {
  console.log(`${c ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"}  ${n}${extra ? " — " + extra : ""}`);
  c ? pass++ : fail++;
};
const b64u = (b: Buffer | string) =>
  (Buffer.isBuffer(b) ? b : Buffer.from(b)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// ---------- mock Google IdP ----------
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string };
const KID = "mock-kid-1";
const JWKS: Jwk[] = [{ kid: KID, kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", use: "sig" }];
const CLIENT_ID = "compass.apps.googleusercontent.com";
const HD = "gitlabfoundation.org";
const USER = { sub: "1088888", email: "d.okafor@gitlabfoundation.org", name: "Dana Okafor" };

let ISS = ""; // set once the IdP is listening
function idToken(aud: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: "RS256", kid: KID, typ: "JWT" }));
  const payload = b64u(
    JSON.stringify({ iss: ISS, aud, hd: HD, email_verified: true, iat: now - 5, exp: now + 3600, ...USER })
  );
  const sig = b64u(createSign("RSA-SHA256").update(`${header}.${payload}`).sign(privateKey));
  return `${header}.${payload}.${sig}`;
}

const idp = createServer((req, res) => {
  const u = new URL(req.url!, "http://127.0.0.1");
  if (u.pathname === "/authorize") {
    // auto-approve: redirect straight back with a code
    const redirect = new URL(u.searchParams.get("redirect_uri")!);
    redirect.searchParams.set("code", "mock-auth-code");
    redirect.searchParams.set("state", u.searchParams.get("state")!);
    res.writeHead(302, { location: redirect.toString() });
    return res.end();
  }
  if (u.pathname === "/token" && req.method === "POST") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ id_token: idToken(CLIENT_ID), token_type: "Bearer", expires_in: 3600 }));
  }
  res.writeHead(404).end();
});
await new Promise<void>((r) => idp.listen(0, "127.0.0.1", r));
const idpPort = (idp.address() as { port: number }).port;
const IDP = `http://127.0.0.1:${idpPort}`;
ISS = IDP;

// ---------- Compass server ----------
const index = await runPipeline(ADAPTERS, {
  corpusLabel: CORPUS.corpusLabel,
  excludeTiers: [...CORPUS.excludeTiers],
  notCovered: CORPUS.notCovered,
  log: () => {},
});

const oauth = {
  clientId: CLIENT_ID,
  clientSecret: "mock-secret",
  redirectUri: "", // set after the server is listening
  issuer: IDP,
  authorizationEndpoint: `${IDP}/authorize`,
  tokenEndpoint: `${IDP}/token`,
  jwks: JWKS,
  hostedDomain: HD,
  resolveGroups: () => ["programs", "leadership"], // Program Officer who is also on the leadership group (can hit admin routes)
};
// tight limiter so the test can exhaust it in a few calls; collect anomaly signals
const signals: Signal[] = [];
const limiter = new RateLimiter({
  rate: { capacity: 8, refillPerSec: 0.001 },
  cost: { capacity: 1000, refillPerSec: 1 },
});
const monitor = new Monitor({ windowMs: 60_000, restrictedRefusals: 3, authDenials: 5, sweepQueries: 15, costMultiple: 4 });
const app = createApp({
  index,
  secureCookies: false,
  oauth,
  limiter,
  monitor,
  onSignal: (s) => signals.push(s),
  feedbackLog: "/tmp/compass-server-check-feedback.jsonl",
});
await new Promise<void>((r) => app.listen(0, "127.0.0.1", r));
const port = (app.address() as { port: number }).port;
const BASE = `http://127.0.0.1:${port}`;
oauth.redirectUri = `${BASE}/auth/callback`;

// --- run the flow with a manual cookie jar ---
let cookie = "";
const req = async (path: string, opts: RequestInit = {}) => {
  const r = await fetch(BASE + path, { ...opts, redirect: "manual", headers: { ...(opts.headers || {}), cookie } });
  const setC = r.headers.get("set-cookie");
  if (setC) cookie = setC.split(";")[0]!;
  return r;
};

// 1. no session
{
  const r = await fetch(BASE + "/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "hi" }) });
  ok("POST /api/ask with no session → 401", r.status === 401);
}

// 2. login → 302 to IdP
{
  const r = await req("/auth/login");
  ok("GET /auth/login → 302 to the IdP", r.status === 302 && (r.headers.get("location") || "").startsWith(`${IDP}/authorize`));
  // 3. follow the IdP (it redirects back to /auth/callback with a code)
  const idpRes = await fetch(r.headers.get("location")!, { redirect: "manual" });
  const cbUrl = new URL(idpRes.headers.get("location")!);
  const cb = await req(cbUrl.pathname + cbUrl.search);
  ok("callback sets a session cookie + redirects to /", cb.status === 302 && cookie.startsWith("compass_session="));
}

// 4. /api/me
{
  const r = await req("/api/me");
  const body = (await r.json()) as { email?: string; groups?: string[] };
  ok("GET /api/me → the signed-in identity", r.status === 200 && body.email === USER.email && body.groups?.includes("programs") === true);
}

// 5. ask a normal question
{
  const r = await req("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "how did Riverbend Care Collective perform against projection?" }) });
  const body = (await r.json()) as { citations?: unknown[]; confidence?: string };
  ok("POST /api/ask → an evidence brief with citations", r.status === 200 && (body.citations?.length ?? 0) >= 1 && body.confidence !== "refused");
}

// 6. restricted question → refused, no leak
{
  const r = await req("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "what did the board discuss about staff compensation?" }) });
  const body = (await r.json()) as { confidence?: string; text?: string };
  ok("restricted question → refused, nothing leaked", body.confidence === "refused" && !/salary band|committee deliberation/i.test(body.text ?? ""));
}

// 7. monitor: repeated restricted-tier refusals raise a restricted-probing signal
{
  for (let i = 0; i < 3; i++) {
    await req("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: `what did the board discuss about staff compensation (round ${i})?` }) });
  }
  const probing = signals.find((s) => s.kind === "restricted-probing");
  ok("repeated Restricted-tier refusals raise a restricted-probing signal", !!probing && probing.severity === "high");
}

// 8. rate limit: keep hammering /api/ask until the per-user bucket is empty → 429 + Retry-After
{
  let got429 = false;
  let retryAfter = "";
  for (let i = 0; i < 10; i++) {
    const r = await req("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "who is co-funding Riverbend?" }) });
    if (r.status === 429) {
      got429 = true;
      retryAfter = r.headers.get("retry-after") ?? "";
      break;
    }
  }
  ok("repeated /api/ask trips the per-user rate limit → 429 + Retry-After", got429 && retryAfter !== "");
}

// 9. kill switch: admin engages → /api/ask is 503 → release → 200 again
{
  const on = await req("/admin/killswitch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ on: true }) });
  const paused = await req("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "who co-funds Riverbend?" }) });
  await req("/admin/killswitch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ on: false }) });
  ok("admin kill switch → /api/ask returns 503 until released", on.status === 200 && paused.status === 503);
}

// 10. feedback endpoint accepts a verdict
{
  const r = await req("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "test q", verdict: "down", note: "missed a source" }) });
  ok("POST /api/feedback records a verdict", r.status === 200);
}

// 11. logout revokes server-side — a SAVED copy of the pre-logout cookie also stops working
{
  const savedCookie = cookie; // capture before logout clears it
  await req("/auth/logout");
  const cleared = await fetch(BASE + "/api/ask", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ question: "hi" }) });
  const replay = await fetch(BASE + "/api/ask", { method: "POST", headers: { "content-type": "application/json", cookie: savedCookie }, body: JSON.stringify({ question: "hi" }) });
  ok("after logout, cleared cookie AND a replayed pre-logout cookie both → 401", cleared.status === 401 && replay.status === 401);
}

idp.close();
app.close();
console.log(`\n${pass}/${pass + fail} server checks pass`);
process.exit(fail ? 1 : 0);
