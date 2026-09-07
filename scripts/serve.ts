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
import { runPipeline } from "../src/pipeline/run.js";
import { ADAPTERS, CORPUS } from "../src/config.js";
import { createApp } from "../src/server/app.js";
import { claudeLLM } from "../src/retrieval/llm.js";
import { AuditLog } from "../src/security/audit.js";

const index = await runPipeline(ADAPTERS, {
  corpusLabel: CORPUS.corpusLabel,
  excludeTiers: [...CORPUS.excludeTiers],
  notCovered: CORPUS.notCovered,
  log: (m) => console.log(m),
});

const clientId = process.env.COMPASS_OAUTH_CLIENT_ID;
const port = Number(process.env.PORT ?? 8787);

const audit = new AuditLog(process.env.COMPASS_AUDIT_LOG ?? "dist/audit.log");

const app = createApp({
  index,
  secureCookies: process.env.NODE_ENV === "production",
  llm: process.env.ANTHROPIC_API_KEY ? (claudeLLM as never) : undefined,
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
    // production: a read-only Google Admin SDK Directory lookup, cached. Here: a stub.
    resolveGroups: async (email) => {
      const map = JSON.parse(process.env.COMPASS_GROUP_MAP ?? "{}") as Record<string, string[]>;
      return map[email] ?? ["programs"];
    },
  },
});

app.listen(port, () => {
  console.log(`\nCompass server on http://localhost:${port}`);
  console.log(clientId ? "  OAuth: configured" : "  OAuth: NOT configured — set COMPASS_OAUTH_CLIENT_ID (see scripts/serve.ts). /health still works.");
  console.log(`  index: ${index.chunks.length} chunks, embedder ${index.embedder?.id ?? "tf-idf"}`);
});
