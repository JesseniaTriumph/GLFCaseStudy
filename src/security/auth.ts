/**
 * The front door — OpenID Connect ID-token verification (see strategy doc §6.2).
 *
 * Compass never handles a password. A user authenticates with Google Workspace; Google
 * returns a signed ID token (JWT); Compass verifies it here before trusting anything.
 * This is a real RS256 verification using Node's crypto — no JWT library — so the checks
 * are visible: signature, issuer, audience, expiry, and the hosted-domain claim that
 * limits access to @gitlabfoundation.org accounts.
 */
import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import type { Principal, Tier } from "../core/types.js";

export interface Jwk {
  kid: string;
  kty: "RSA";
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

export interface OidcConfig {
  /** expected `iss` — Google's is https://accounts.google.com */
  issuer: string;
  /** Compass's OAuth client id — the token's `aud` must equal this */
  audience: string;
  /** Workspace primary domain — the token's `hd` must equal this */
  hostedDomain: string;
  /** allowed clock skew in seconds */
  clockToleranceSec?: number;
}

export interface IdTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  email_verified?: boolean;
  hd?: string;
  exp: number;
  iat: number;
  name?: string;
}

export class AuthError extends Error {}

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function b64urlToJson<T>(s: string): T {
  return JSON.parse(b64urlToBuf(s).toString("utf8")) as T;
}

/**
 * Verify a Google-issued ID token. Returns the claims on success, throws AuthError otherwise.
 * `jwks` is the set of Google signing keys (fetched from the JWKS endpoint in production,
 * cached; injected here so verification is testable offline).
 */
export function verifyIdToken(token: string, jwks: Jwk[], cfg: OidcConfig): IdTokenClaims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new AuthError("malformed token");
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  const header = b64urlToJson<{ alg: string; kid: string; typ?: string }>(headerB64);
  if (header.alg !== "RS256") throw new AuthError(`unsupported alg ${header.alg}`);

  const jwk = jwks.find((k) => k.kid === header.kid && k.kty === "RSA");
  if (!jwk) throw new AuthError("signing key not found for kid");

  // --- signature ---
  const pubKey = createPublicKey({ key: { kty: "RSA", n: jwk.n, e: jwk.e }, format: "jwk" });
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`);
  const ok = cryptoVerify("RSA-SHA256", signingInput, pubKey, b64urlToBuf(sigB64));
  if (!ok) throw new AuthError("bad signature");

  // --- claims ---
  const claims = b64urlToJson<IdTokenClaims>(payloadB64);
  const skew = cfg.clockToleranceSec ?? 60;
  const now = Math.floor(Date.now() / 1000);

  if (claims.iss !== cfg.issuer) throw new AuthError(`unexpected issuer ${claims.iss}`);
  if (claims.aud !== cfg.audience) throw new AuthError("audience mismatch");
  if (claims.exp + skew < now) throw new AuthError("token expired");
  if (claims.iat - skew > now) throw new AuthError("token issued in the future");
  if (claims.hd !== cfg.hostedDomain) throw new AuthError(`account is not in ${cfg.hostedDomain}`);
  if (claims.email_verified === false) throw new AuthError("email not verified");

  return claims;
}

/**
 * Build a Principal from a user id + their permission groups. The tier mapping lives here.
 *
 * `groupsResolved` fails the model CLOSED when the Google Groups lookup did not actually
 * succeed. Lesson from the HOPE dashboard: a misconfigured integration key silently
 * defaulted every sign-in to a read role. Here, if group resolution threw or returned
 * nothing usable, the caller passes `false` and the principal can retrieve *nothing* —
 * the UI then says "your account isn't mapped to a Compass access group yet" instead of
 * quietly serving content.
 */
export function principalFromGroups(userId: string, groups: string[], groupsResolved = true): Principal {
  const g = new Set(groups.map((x) => x.toLowerCase()));
  if (!groupsResolved) return { userId, groups: [], allowedTiers: [] };
  const allowedTiers: Tier[] = ["team"];
  // programs-only (diligence memos, review scorecards, the interaction log, Zoom threads):
  // Programs, Impact, leadership, Finance/Grants-Ops, Partnerships. NOT the external-facing
  // Impact Advisory function, NOT Comms, NOT the board — those see team tier only.
  const PROGRAMS_ONLY = new Set([
    "programs", "program-officer", "program-ops", "program-associate", "program-coordinator",
    "impact", "impact-measurement", "impact-modeling", "impact-director",
    "executive", "leadership", "ceo", "coo", "operations",
    "donor-engagement", "partnerships", "development",
    "finance", "accounting", "grants-ops", "grants-compliance", "grants-management",
    "legal", "counsel",
  ]);
  if ([...g].some((x) => PROGRAMS_ONLY.has(x))) allowedTiers.push("programs-only");
  // `restricted` is never granted to any principal — by design.
  return { userId, groups: [...g], allowedTiers };
}

/**
 * Map verified claims + the user's Google Groups (read-only Admin SDK lookup in production)
 * to a Compass Principal. This is what the retrieval-time filter (§6.3) enforces against.
 */
export function principalFromClaims(claims: IdTokenClaims, groups: string[], groupsResolved = true): Principal {
  return principalFromGroups(claims.email.split("@")[0] ?? claims.sub, groups, groupsResolved);
}
