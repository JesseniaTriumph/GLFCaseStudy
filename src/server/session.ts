/**
 * Compass session tokens (strategy doc §6.2).
 *
 * After the OIDC callback verifies a Google ID token, Compass issues its OWN short-lived
 * session — an HMAC-signed token carried in an `HttpOnly; Secure; SameSite=Strict` cookie.
 * No Google token, and nothing the model could reach, is ever exposed to page JavaScript.
 */
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const SESSION_TTL_SEC = 8 * 3600;
const COOKIE = "compass_session";

export interface SessionClaims {
  sub: string;
  email: string;
  name?: string;
  /** function/permission groups resolved from Google Groups at login */
  groups: string[];
  /** false when the Groups lookup failed at login — principal is then denied all tiers */
  groupsResolved?: boolean;
  iat: number;
  exp: number;
}

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

let devSecret: Buffer | null = null;
function secret(): Buffer {
  const s = process.env.COMPASS_SESSION_SECRET;
  if (s) return Buffer.from(s);
  // dev fallback: a per-process random secret (sessions don't survive a restart)
  return (devSecret ??= randomBytes(32));
}

export function issueSession(claims: Omit<SessionClaims, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const full: SessionClaims = { ...claims, iat: now, exp: now + SESSION_TTL_SEC };
  const payload = b64u(Buffer.from(JSON.stringify(full)));
  const sig = b64u(createHmac("sha256", secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

/**
 * Revocation. HOPE lesson: an 8-hour session outlived an admin deactivating the account.
 * `revokeUser` invalidates every session for a subject issued at or before the call;
 * `revokeAll` (an incident lever) invalidates everything issued before now. In production
 * this map is Redis with a TTL of the session lifetime; here it's in-process.
 */
const revokedBefore = new Map<string, number>();
let globalRevokeBefore = 0;

export function revokeUser(sub: string): void {
  const now = Math.floor(Date.now() / 1000);
  revokedBefore.set(sub, now);
  // a revocation older than one session lifetime can no longer affect any live token — evict it
  for (const [k, t] of revokedBefore) if (now - t > SESSION_TTL_SEC) revokedBefore.delete(k);
}
export function revokeAll(): void {
  globalRevokeBefore = Math.floor(Date.now() / 1000);
}
/** test helper */
export function _clearRevocations(): void {
  revokedBefore.clear();
  globalRevokeBefore = 0;
}

export function verifySession(token: string | undefined): SessionClaims | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const got = fromB64u(sig);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  let claims: SessionClaims;
  try {
    claims = JSON.parse(fromB64u(payload).toString("utf8"));
  } catch {
    return null;
  }
  if (claims.exp < Math.floor(Date.now() / 1000)) return null;
  if (claims.iat <= globalRevokeBefore) return null;
  const userRevoke = revokedBefore.get(claims.sub);
  if (userRevoke != null && claims.iat <= userRevoke) return null;
  return claims;
}

export function cookieHeader(token: string, secure = true): string {
  const attrs = ["HttpOnly", "SameSite=Strict", "Path=/", `Max-Age=${SESSION_TTL_SEC}`];
  if (secure) attrs.push("Secure");
  return `${COOKIE}=${token}; ${attrs.join("; ")}`;
}

export function clearCookieHeader(secure = true): string {
  const attrs = ["HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=0"];
  if (secure) attrs.push("Secure");
  return `${COOKIE}=; ${attrs.join("; ")}`;
}

export function readCookie(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
  const raw = req.headers.cookie;
  const s = Array.isArray(raw) ? raw.join("; ") : raw;
  if (!s) return undefined;
  for (const part of s.split(/;\s*/)) {
    const [k, ...v] = part.split("=");
    if (k === COOKIE) return v.join("=");
  }
  return undefined;
}
