/**
 * Working proof of the security controls in strategy doc §6.
 *
 *   npm run security
 *
 * Checks, with real crypto:
 *   1. A valid Google-style ID token verifies and maps to the right Principal.
 *   2. A tampered token is rejected (bad signature).
 *   3. A token for a non-Foundation account is rejected (hd claim).
 *   4. An expired token is rejected.
 *   5. The audit log is append-only and hash-chained — tampering is detected.
 */
import { generateKeyPairSync, createSign } from "node:crypto";
import { writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { verifyIdToken, principalFromClaims, AuthError, type Jwk, type OidcConfig } from "../src/security/auth.js";
import { AuditLog } from "../src/security/audit.js";

let pass = 0,
  fail = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"}  ${name}${extra ? "  — " + extra : ""}`);
  if (cond) pass++;
  else fail++;
};

// ---------- set up a test signing key (stands in for Google's) ----------
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string };
const KID = "test-key-1";
const JWKS: Jwk[] = [{ kid: KID, kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", use: "sig" }];

const CFG: OidcConfig = {
  issuer: "https://accounts.google.com",
  audience: "compass.apps.googleusercontent.com",
  hostedDomain: "gitlabfoundation.org",
};

const b64url = (b: Buffer | string) =>
  (Buffer.isBuffer(b) ? b : Buffer.from(b)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function makeToken(claims: Record<string, unknown>, opts: { kid?: string } = {}): string {
  const header = b64url(JSON.stringify({ alg: "RS256", kid: opts.kid ?? KID, typ: "JWT" }));
  const payload = b64url(JSON.stringify(claims));
  const sig = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(privateKey);
  return `${header}.${payload}.${b64url(sig)}`;
}

const now = Math.floor(Date.now() / 1000);
const baseClaims = {
  iss: "https://accounts.google.com",
  aud: CFG.audience,
  sub: "10769150350006150715113082367",
  email: "d.okafor@gitlabfoundation.org",
  email_verified: true,
  hd: "gitlabfoundation.org",
  iat: now - 30,
  exp: now + 3600,
  name: "Dana Okafor",
};

// ---------- 1. valid token ----------
try {
  const claims = verifyIdToken(makeToken(baseClaims), JWKS, CFG);
  const principal = principalFromClaims(claims, ["programs", "impact"]);
  ok("valid ID token verifies", claims.email === "d.okafor@gitlabfoundation.org");
  ok(
    "maps to the right Principal",
    principal.userId === "d.okafor" && principal.allowedTiers.includes("programs-only") && !principal.allowedTiers.includes("restricted"),
    `tiers: ${principal.allowedTiers.join(", ")}`
  );
} catch (e) {
  ok("valid ID token verifies", false, String(e));
}

// ---------- 1b. fail closed when the group lookup didn't succeed (HOPE lesson) ----------
{
  const claims = verifyIdToken(makeToken(baseClaims), JWKS, CFG);
  const denied = principalFromClaims(claims, [], false); // groupsResolved = false
  ok(
    "group lookup failure → principal can retrieve nothing",
    denied.allowedTiers.length === 0,
    `tiers: [${denied.allowedTiers.join(", ")}]`
  );
  const resolvedEmpty = principalFromClaims(claims, [], true); // resolved, just no groups
  ok(
    "resolved-but-no-groups → team tier only (intended)",
    resolvedEmpty.allowedTiers.length === 1 && resolvedEmpty.allowedTiers[0] === "team"
  );
}

// ---------- 2. tampered payload ----------
{
  const t = makeToken(baseClaims).split(".");
  const forged = JSON.parse(Buffer.from(t[1]!, "base64").toString());
  forged.email = "attacker@gitlabfoundation.org";
  t[1] = b64url(JSON.stringify(forged)); // re-encode payload but keep the original signature
  let rejected = false;
  try {
    verifyIdToken(t.join("."), JWKS, CFG);
  } catch (e) {
    rejected = e instanceof AuthError && /signature/.test(e.message);
  }
  ok("tampered token is rejected (bad signature)", rejected);
}

// ---------- 3. non-Foundation account ----------
{
  let rejected = false;
  try {
    verifyIdToken(makeToken({ ...baseClaims, hd: "gmail.com", email: "someone@gmail.com" }), JWKS, CFG);
  } catch (e) {
    rejected = e instanceof AuthError && /gitlabfoundation\.org/.test(e.message);
  }
  ok("account outside gitlabfoundation.org is rejected (hd claim)", rejected);
}

// ---------- 4. expired token ----------
{
  let rejected = false;
  try {
    verifyIdToken(makeToken({ ...baseClaims, iat: now - 7200, exp: now - 3600 }), JWKS, CFG);
  } catch (e) {
    rejected = e instanceof AuthError && /expired/.test(e.message);
  }
  ok("expired token is rejected", rejected);
}

// ---------- 5. audit log: append-only + tamper-evident ----------
{
  const path = fileURLToPath(new URL("../dist/audit-test.jsonl", import.meta.url));
  if (existsSync(path)) rmSync(path);
  const log = new AuditLog(path);
  log.append({ type: "auth", user: "d.okafor", result: "ok" });
  log.append({ type: "query", user: "d.okafor", question: "how did Riverbend do?", citedRefs: ["givingdata:GD-1188"], citedTiers: ["team"], withheld: 0, withheldTiers: [], confidence: "high", mode: "extractive" });
  log.append({ type: "query", user: "d.okafor", question: "board comp?", citedRefs: [], citedTiers: [], withheld: 2, withheldTiers: ["restricted"], confidence: "refused", mode: "extractive" });
  ok("audit chain verifies when intact", log.verify().ok, `${log.length} entries, head ${log.head.slice(0, 12)}…`);

  // tamper: rewrite a middle record's contents on disk, reload, re-verify
  const rows = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const rec = JSON.parse(rows[1]!);
  rec.event.question = "(redacted by an attacker)";
  rows[1] = JSON.stringify(rec);
  writeFileSync(path, rows.join("\n") + "\n");
  const reloaded = new AuditLog(path);
  const v = reloaded.verify();
  ok("tampering with a past entry is detected", v.ok === false, v.ok ? "" : `broken at seq ${v.brokenAt}: ${v.reason}`);
  rmSync(path);
}

console.log(`\n${pass}/${pass + fail} security checks pass`);
process.exit(fail ? 1 : 0);
