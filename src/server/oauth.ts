/**
 * OpenID Connect Authorization-Code + PKCE flow against Google Workspace (strategy doc §6.2).
 *
 *   /auth/login    → build the authorize URL (PKCE challenge), stash verifier+state, redirect
 *   /auth/callback → check state, exchange code for tokens at the token endpoint,
 *                    verify the ID token (RS256, iss/aud/exp/hd), resolve groups,
 *                    issue a Compass session cookie
 *
 * Endpoints and the JWKS are discovered from Google's well-known config. For tests, an
 * IdP base URL + a static JWKS can be injected (see scripts/server-check.ts).
 */
import { createHash, randomBytes } from "node:crypto";
import { verifyIdToken, principalFromClaims, type Jwk, type OidcConfig } from "../security/auth.js";
import { issueSession } from "./session.js";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** OIDC issuer base, e.g. https://accounts.google.com */
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  /** JWKS: a URL to fetch, or a static key set (tests) */
  jwks: string | Jwk[];
  hostedDomain: string;
  /** how to resolve a user's permission groups from their verified identity */
  resolveGroups: (email: string, sub: string) => Promise<string[]> | string[];
}

const b64u = (b: Buffer) => b.toString("base64url");

/** ephemeral store for PKCE verifier + state, keyed by state. In prod: a short-TTL cache. */
const pending = new Map<string, { verifier: string; created: number }>();
function gc() {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [k, v] of pending) if (v.created < cutoff) pending.delete(k);
}

export function beginLogin(cfg: OAuthConfig): { url: string; state: string } {
  gc();
  const verifier = b64u(randomBytes(32));
  const challenge = b64u(createHash("sha256").update(verifier).digest());
  const state = b64u(randomBytes(16));
  pending.set(state, { verifier, created: Date.now() });
  const url = new URL(cfg.authorizationEndpoint);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("hd", cfg.hostedDomain);
  url.searchParams.set("prompt", "select_account");
  return { url: url.toString(), state };
}

async function getJwks(jwks: string | Jwk[]): Promise<Jwk[]> {
  if (Array.isArray(jwks)) return jwks;
  const res = await fetch(jwks);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  return ((await res.json()) as { keys: Jwk[] }).keys;
}

export interface CallbackResult {
  sessionToken: string;
  email: string;
  name?: string;
  groups: string[];
  /** false when the Groups lookup failed — the session grants no retrieval access */
  groupsResolved: boolean;
}

export async function handleCallback(cfg: OAuthConfig, code: string, state: string): Promise<CallbackResult> {
  const p = pending.get(state);
  if (!p) throw new Error("unknown or expired state");
  pending.delete(state);

  // --- exchange the code for tokens (server-side, with the client secret + PKCE verifier) ---
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code_verifier: p.verifier,
  });
  const tokenRes = await fetch(cfg.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) throw new Error(`token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("no id_token in token response");

  // --- verify the ID token (the real check, shared with src/security/auth.ts) ---
  const oidc: OidcConfig = {
    issuer: cfg.issuer,
    audience: cfg.clientId,
    hostedDomain: cfg.hostedDomain,
  };
  const claims = verifyIdToken(tokens.id_token, await getJwks(cfg.jwks), oidc);

  // --- resolve groups and issue the Compass session ---
  // Fail closed if the group lookup errors (HOPE lesson: a broken integration key must not
  // silently grant access). A successful lookup that returns [] is fine — that user gets
  // team tier only, which is the intended "any signed-in staff" behavior.
  let groups: string[] = [];
  let groupsResolved = true;
  try {
    groups = await cfg.resolveGroups(claims.email, claims.sub);
  } catch (e) {
    groupsResolved = false;
  }
  const principal = principalFromClaims(claims, groups, groupsResolved);
  const sessionToken = issueSession({
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    groups: principal.groups,
    groupsResolved,
  });
  return { sessionToken, email: claims.email, name: claims.name, groups: principal.groups, groupsResolved };
}
