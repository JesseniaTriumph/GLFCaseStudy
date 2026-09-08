import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beginLogin, type OAuthConfig } from "../src/server/oauth.js";

const cfg: OAuthConfig = {
  clientId: "client-123",
  clientSecret: "secret",
  redirectUri: "https://compass.example/auth/callback",
  issuer: "https://accounts.google.com",
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  jwks: [],
  hostedDomain: "example.org",
  resolveGroups: () => ["programs"],
};

test("beginLogin: builds an authorize URL with PKCE S256, state, hd, and the right client/redirect", () => {
  const { url, state } = beginLogin(cfg);
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, cfg.authorizationEndpoint);
  assert.equal(u.searchParams.get("client_id"), "client-123");
  assert.equal(u.searchParams.get("redirect_uri"), cfg.redirectUri);
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("hd"), "example.org");
  assert.equal(u.searchParams.get("scope"), "openid email profile");
  assert.equal(u.searchParams.get("state"), state);
  assert.ok((u.searchParams.get("code_challenge") ?? "").length >= 43); // base64url sha256
});

test("beginLogin: each call gets a fresh state and challenge", () => {
  const a = beginLogin(cfg);
  const b = beginLogin(cfg);
  assert.notEqual(a.state, b.state);
  assert.notEqual(
    new URL(a.url).searchParams.get("code_challenge"),
    new URL(b.url).searchParams.get("code_challenge")
  );
});
