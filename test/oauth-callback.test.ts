import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createSign } from "node:crypto";
import { beginLogin, handleCallback, type OAuthConfig } from "../src/server/oauth.js";
import { verifySession } from "../src/server/session.js";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string };
const KID = "cb-kid";
const b64 = (b: Buffer | string) =>
  (Buffer.isBuffer(b) ? b : Buffer.from(b)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function idToken(email: string, aud: string): string {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: "RS256", kid: KID, typ: "JWT" }));
  const p = b64(JSON.stringify({ iss: "https://accounts.google.com", aud, sub: "s1", email, email_verified: true, hd: "example.org", iat: now - 5, exp: now + 3600, name: "Test User" }));
  return `${h}.${p}.${b64(createSign("RSA-SHA256").update(`${h}.${p}`).sign(privateKey))}`;
}

function config(over: Partial<OAuthConfig> = {}): OAuthConfig {
  return {
    clientId: "aud-xyz",
    clientSecret: "secret",
    redirectUri: "https://compass.example/auth/callback",
    issuer: "https://accounts.google.com",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    jwks: [{ kid: KID, kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", use: "sig" }],
    hostedDomain: "example.org",
    resolveGroups: () => ["programs"],
    ...over,
  };
}

function withMockedToken(email: string, aud: string, fn: () => Promise<void>) {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ id_token: idToken(email, aud) }) })) as typeof fetch;
  return fn().finally(() => (globalThis.fetch = real));
}

test("handleCallback: exchanges the code, verifies the token, issues a working session", async () => {
  const cfg = config();
  const { state } = beginLogin(cfg);
  await withMockedToken("dana@example.org", cfg.clientId, async () => {
    const r = await handleCallback(cfg, "the-code", state);
    assert.equal(r.email, "dana@example.org");
    assert.deepEqual(r.groups, ["programs"]);
    const claims = verifySession(r.sessionToken);
    assert.equal(claims?.email, "dana@example.org");
  });
});

test("handleCallback: an unknown state is rejected (CSRF / replay guard)", async () => {
  await assert.rejects(() => handleCallback(config(), "code", "never-issued-state"), /unknown or expired state/);
});

test("handleCallback: the email allowlist rejects an off-list account after the token verifies", async () => {
  const cfg = config({ allowedEmails: ["allowed@example.org"] });
  const { state } = beginLogin(cfg);
  await withMockedToken("stranger@example.org", cfg.clientId, async () => {
    await assert.rejects(() => handleCallback(cfg, "code", state), /not on the Compass access list/);
  });
});

test("handleCallback: fails closed when the group lookup throws", async () => {
  const cfg = config({ resolveGroups: () => { throw new Error("directory down"); } });
  const { state } = beginLogin(cfg);
  await withMockedToken("dana@example.org", cfg.clientId, async () => {
    const r = await handleCallback(cfg, "code", state);
    assert.equal(r.groupsResolved, false);
  });
});
