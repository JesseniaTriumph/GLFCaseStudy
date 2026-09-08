/**
 * Run the Compass HTTP server.
 *
 *   npm run serve
 *
 * Reads OAuth config from the environment (a real Google Cloud OAuth client):
 *   COMPASS_OAUTH_CLIENT_ID, COMPASS_OAUTH_CLIENT_SECRET, COMPASS_OAUTH_REDIRECT_URI
 *   COMPASS_HD                (hosted domain, default gitlabfoundation.org)
 *   COMPASS_SESSION_SECRET    (HMAC key for session cookies)
 *   PORT                      (default 8787)
 *
 * Without a client id it starts in a clearly-labelled "no auth configured" mode — the
 * server runs and /health works, but /auth/login explains what to set. Use
 * `npm run server:check` for the full flow against a mock IdP.
 */
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { runPipeline } from "../src/pipeline/run.js";
import { resolveAdapters, CORPUS } from "../src/config.js";
import { createApp } from "../src/server/app.js";
import { claudeLLM } from "../src/retrieval/llm.js";
import { AuditLog, webhookSink } from "../src/security/audit.js";
import { resolveGroupResolver } from "../src/security/directory.js";

const { adapters, report } = await resolveAdapters();
report.forEach((l) => console.log(`connector · ${l}`));

const index = await runPipeline(adapters, {
  corpusLabel: CORPUS.corpusLabel,
  excludeTiers: [...CORPUS.excludeTiers],
  notCovered: CORPUS.notCovered,
  log: (m) => console.log(m),
});

const clientId = process.env.COMPASS_OAUTH_CLIENT_ID;
const port = Number(process.env.PORT ?? 8787);

// serve the built web app from the same origin (npm run demo builds it first)
const webRoot = fileURLToPath(new URL("../web/dist", import.meta.url));
const hasWeb = existsSync(webRoot);
// the demo persona switch is on unless explicitly disabled (a real deployment sets this)
const demoLogin = process.env.COMPASS_NO_DEMO !== "1";
const allowedEmails = (process.env.COMPASS_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// group → tier resolution: the real Google Directory lookup when a service account is
// configured, else the static demo map. Fails closed either way (a throw in the resolver
// → groupsResolved:false → the principal can retrieve nothing).
const { resolver: resolveGroups, mode: groupMode } = resolveGroupResolver();

const audit = new AuditLog(
  process.env.COMPASS_AUDIT_LOG ?? "dist/audit.log",
  process.env.COMPASS_AUDIT_WEBHOOK ? webhookSink(process.env.COMPASS_AUDIT_WEBHOOK) : undefined
);

const app = createApp({
  index,
  secureCookies: process.env.NODE_ENV === "production",
  llm: process.env.ANTHROPIC_API_KEY ? (claudeLLM as never) : undefined,
  webRoot: hasWeb ? webRoot : undefined,
  demoLogin,
  oauthConfigured: Boolean(clientId),
  audit,
  onSignal: (s) =>
    console.warn(`[MONITOR ${s.severity.toUpperCase()}] ${s.kind} — user=${s.user} — ${s.detail}\n           → ${s.playbook}`),
  oauth: {
    clientId: clientId ?? "NOT_CONFIGURED",
    clientSecret: process.env.COMPASS_OAUTH_CLIENT_SECRET ?? "",
    redirectUri: process.env.COMPASS_OAUTH_REDIRECT_URI ?? `http://localhost:${port}/auth/callback`,
    issuer: "https://accounts.google.com",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    jwks: "https://www.googleapis.com/oauth2/v3/certs",
    hostedDomain: process.env.COMPASS_HD ?? "gitlabfoundation.org",
    allowedEmails,
    resolveGroups,
  },
});

app.listen(port, () => {
  console.log(`\nCompass on http://localhost:${port}`);
  console.log(`  web app:   ${hasWeb ? "served at /" : "NOT built — run `npm run demo` (builds web first) or `npm --prefix web run build`"}`);
  console.log(`  Google sign-in: ${clientId ? "configured" : "not configured — set COMPASS_OAUTH_CLIENT_ID (see docs/DEMO_HOSTING.md)"}`);
  console.log(`  demo personas:  ${demoLogin ? "on — /auth/demo?persona=<key>" : "off (COMPASS_NO_DEMO=1)"}`);
  console.log(`  group source:   ${groupMode}`);
  if (allowedEmails.length) console.log(`  access list:    ${allowedEmails.length} email(s)`);
  console.log(`  index: ${index.chunks.length} chunks, embedder ${index.embedder?.id ?? "tf-idf"}`);
});
