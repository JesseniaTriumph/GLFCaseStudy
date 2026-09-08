import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createSign } from "node:crypto";
import { verifyIdToken, principalFromGroups, principalFromClaims, AuthError, type Jwk, type OidcConfig } from "../src/security/auth.js";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string };
const KID = "k1";
const JWKS: Jwk[] = [{ kid: KID, kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", use: "sig" }];
const CFG: OidcConfig = { issuer: "https://accounts.google.com", audience: "aud-123", hostedDomain: "example.org" };
const b64 = (b: Buffer | string) =>
  (Buffer.isBuffer(b) ? b : Buffer.from(b)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function token(over: Record<string, unknown> = {}, kid = KID): string {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: "RS256", kid, typ: "JWT" }));
  const p = b64(
    JSON.stringify({
      iss: CFG.issuer,
      aud: CFG.audience,
      sub: "u1",
      email: "a@example.org",
      email_verified: true,
      hd: "example.org",
      iat: now - 10,
      exp: now + 3600,
      ...over,
    })
  );
  const s = b64(createSign("RSA-SHA256").update(`${h}.${p}`).sign(privateKey));
  return `${h}.${p}.${s}`;
}

test("verifyIdToken: a valid token returns claims", () => {
  const c = verifyIdToken(token(), JWKS, CFG);
  assert.equal(c.email, "a@example.org");
});

test("verifyIdToken: tampered payload → bad signature", () => {
  const parts = token().split(".");
  const forged = JSON.parse(Buffer.from(parts[1]!, "base64").toString());
  forged.email = "attacker@example.org";
  parts[1] = b64(JSON.stringify(forged));
  assert.throws(() => verifyIdToken(parts.join("."), JWKS, CFG), (e) => e instanceof AuthError && /signature/.test((e as Error).message));
});

test("verifyIdToken: expired", () => {
  const now = Math.floor(Date.now() / 1000);
  assert.throws(() => verifyIdToken(token({ iat: now - 7200, exp: now - 3600 }), JWKS, CFG), /expired/);
});

test("verifyIdToken: wrong hosted domain", () => {
  assert.throws(() => verifyIdToken(token({ hd: "gmail.com", email: "x@gmail.com" }), JWKS, CFG), /not in example\.org/);
});

test("verifyIdToken: wrong audience", () => {
  assert.throws(() => verifyIdToken(token({ aud: "someone-else" }), JWKS, CFG), /audience/);
});

test("verifyIdToken: unknown kid", () => {
  assert.throws(() => verifyIdToken(token({}, "other-kid"), JWKS, CFG), /signing key not found/);
});

test("verifyIdToken: email_verified false", () => {
  assert.throws(() => verifyIdToken(token({ email_verified: false }), JWKS, CFG), /not verified/);
});

test("verifyIdToken: malformed", () => {
  assert.throws(() => verifyIdToken("not.a.jwt.at.all", JWKS, CFG), /malformed|unsupported/);
});

test("principalFromGroups: comms/board/impact-advisory → team only", () => {
  for (const g of ["comms", "board", "impact-advisory"]) {
    assert.deepEqual(principalFromGroups("u", [g]).allowedTiers, ["team"]);
  }
});

test("principalFromGroups: programs/impact/leadership/finance → team + programs-only", () => {
  for (const g of ["programs", "impact", "leadership", "finance", "partnerships", "grants-ops"]) {
    const t = principalFromGroups("u", [g]).allowedTiers;
    assert.deepEqual(t, ["team", "programs-only"], g);
  }
});

test("principalFromGroups: never grants restricted", () => {
  assert.ok(!principalFromGroups("u", ["ceo", "leadership", "programs"]).allowedTiers.includes("restricted" as never));
});

test("principalFromGroups: fail closed when groups unresolved", () => {
  const p = principalFromGroups("u", ["programs"], false);
  assert.deepEqual(p.allowedTiers, []);
  assert.deepEqual(p.groups, []);
});

test("principalFromGroups: resolved but empty → team tier only", () => {
  assert.deepEqual(principalFromGroups("u", [], true).allowedTiers, ["team"]);
});

test("principalFromClaims: derives userId from the email local-part", () => {
  const c = verifyIdToken(token({ email: "dana.okafor@example.org" }), JWKS, CFG);
  assert.equal(principalFromClaims(c, ["programs"]).userId, "dana.okafor");
});
