/**
 * Google Workspace group resolution — the real version of the `resolveGroups` hook that
 * `handleCallback` calls after it verifies a user's ID token (roadmap "get to 100" item 3;
 * strategy doc §6.2, security review R6).
 *
 * The permission model is group-driven: a person's Compass tier comes from
 * `principalFromGroups(groups)`, and `groups` is their Google Groups membership. In the
 * demo that mapping is a static env map; in production it is a **read-only Admin SDK
 * Directory lookup**, cached, and it **fails closed** — if the lookup errors, the caller
 * gets `groupsResolved: false` and the principal can retrieve nothing (the HOPE lesson: a
 * broken integration key must never silently grant access).
 *
 * What the Workspace admin provisions (discovery X2, D3):
 *   GOOGLE_SA_KEY_JSON / GOOGLE_SA_KEY_FILE   the service-account key (same one the Drive
 *                                             connector uses, or a dedicated one)
 *   GOOGLE_DIRECTORY_SUBJECT                  an admin user to impersonate (domain-wide
 *                                             delegation) — the SA reads the directory *as*
 *                                             this admin
 *   COMPASS_HD                                the Workspace primary domain
 *
 * Scopes to grant the SA (read-only):
 *   https://www.googleapis.com/auth/admin.directory.group.readonly
 *   https://www.googleapis.com/auth/admin.directory.user.readonly   (for the active check)
 */
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

export type GroupResolver = (email: string, sub: string) => Promise<string[]>;

interface SaKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const b64u = (b: Buffer | string) =>
  (Buffer.isBuffer(b) ? b : Buffer.from(b)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const DIRECTORY_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.group.readonly",
  "https://www.googleapis.com/auth/admin.directory.user.readonly",
].join(" ");

function loadKey(env: NodeJS.ProcessEnv): SaKey {
  const raw = env.GOOGLE_SA_KEY_JSON ?? (env.GOOGLE_SA_KEY_FILE ? readFileSync(env.GOOGLE_SA_KEY_FILE, "utf8") : null);
  if (!raw) throw new Error("no service-account key (set GOOGLE_SA_KEY_JSON or GOOGLE_SA_KEY_FILE)");
  const k = JSON.parse(raw) as SaKey;
  if (!k.client_email || !k.private_key) throw new Error("service-account key missing client_email / private_key");
  return k;
}

/** service-account JWT → OAuth2 access token, impersonating `subject` (domain-wide delegation) */
async function accessToken(key: SaKey, subject: string, fetchImpl: typeof fetch): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = key.token_uri ?? "https://oauth2.googleapis.com/token";
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: key.client_email, scope: DIRECTORY_SCOPES, aud: tokenUri, iat: now, exp: now + 3600, sub: subject }));
  const assertion = `${head}.${body}.${b64u(createSign("RSA-SHA256").update(`${head}.${body}`).sign(key.private_key))}`;
  const res = await fetchImpl(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export interface DirectoryOptions {
  env?: NodeJS.ProcessEnv;
  /** injectable for tests */
  fetchImpl?: typeof fetch;
  /** if true, also reject a suspended / archived account (throws → fail closed) */
  requireActive?: boolean;
}

/**
 * A resolver backed by the Admin SDK Directory API. Returns the user's group *emails*
 * lower-cased with the domain stripped (`programs@ft.org` → `programs`) so they line up
 * with `principalFromGroups`. Throws on any failure — the caller must treat a throw as
 * "unresolved" and deny all tiers.
 */
export function googleDirectoryResolver(opts: DirectoryOptions = {}): GroupResolver {
  const env = opts.env ?? process.env;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const subject = env.GOOGLE_DIRECTORY_SUBJECT;
  if (!subject) throw new Error("GOOGLE_DIRECTORY_SUBJECT (an admin to impersonate) is required");
  const key = loadKey(env);

  return async (email: string) => {
    const token = await accessToken(key, subject, fetchImpl);
    const auth = { authorization: `Bearer ${token}` };

    if (opts.requireActive) {
      const u = await fetchImpl(
        `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}?fields=suspended,archived`,
        { headers: auth }
      );
      if (!u.ok) throw new Error(`directory user lookup failed: ${u.status}`);
      const user = (await u.json()) as { suspended?: boolean; archived?: boolean };
      if (user.suspended || user.archived) throw new Error(`account ${email} is not active`);
    }

    const groups: string[] = [];
    let pageToken: string | undefined;
    let pages = 0;
    do {
      const url = new URL("https://admin.googleapis.com/admin/directory/v1/groups");
      url.searchParams.set("userKey", email);
      url.searchParams.set("maxResults", "200");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const r = await fetchImpl(url.toString(), { headers: auth });
      if (!r.ok) throw new Error(`directory group lookup failed: ${r.status}`);
      const body = (await r.json()) as { groups?: Array<{ email?: string }>; nextPageToken?: string };
      for (const g of body.groups ?? []) {
        if (g.email) groups.push(g.email.toLowerCase().split("@")[0]!);
      }
      pageToken = body.nextPageToken;
    } while (pageToken && pages++ < 50);

    return [...new Set(groups)];
  };
}

/** The demo / test resolver: a static `{email: [groups]}` map from COMPASS_GROUP_MAP. */
export function envMapResolver(env: NodeJS.ProcessEnv = process.env, fallback: string[] = ["programs"]): GroupResolver {
  const map = JSON.parse(env.COMPASS_GROUP_MAP ?? "{}") as Record<string, string[]>;
  return async (email: string) => map[email] ?? map[email.toLowerCase()] ?? fallback;
}

/**
 * Wrap a resolver in a short in-memory TTL cache keyed by email. A directory lookup on
 * every sign-in is slow and rate-limited; membership changes rarely. `ttlSec` should be
 * short enough that a de-provisioning is picked up quickly (default 5 min). Errors are
 * NOT cached — a transient failure must not lock a user out for the whole TTL, and a
 * successful result must not paper over a later failure.
 */
export function cached(inner: GroupResolver, ttlSec = 300, now: () => number = Date.now): GroupResolver {
  const hits = new Map<string, { groups: string[]; at: number }>();
  return async (email, sub) => {
    const hit = hits.get(email);
    if (hit && now() - hit.at < ttlSec * 1000) return hit.groups;
    const groups = await inner(email, sub); // a throw propagates — not cached
    hits.set(email, { groups, at: now() });
    return groups;
  };
}

/** Pick a resolver from the environment. Production wants `cached(googleDirectoryResolver(...))`. */
export function resolveGroupResolver(env: NodeJS.ProcessEnv = process.env): { resolver: GroupResolver; mode: string } {
  if (env.GOOGLE_DIRECTORY_SUBJECT && (env.GOOGLE_SA_KEY_JSON || env.GOOGLE_SA_KEY_FILE)) {
    return {
      resolver: cached(googleDirectoryResolver({ env, requireActive: env.COMPASS_DIRECTORY_ACTIVE_CHECK === "1" }), Number(env.COMPASS_DIRECTORY_TTL_SEC ?? 300)),
      mode: `Google Directory (impersonating ${env.GOOGLE_DIRECTORY_SUBJECT}${env.COMPASS_DIRECTORY_ACTIVE_CHECK === "1" ? ", active-check on" : ""})`,
    };
  }
  return { resolver: envMapResolver(env), mode: "static COMPASS_GROUP_MAP (demo)" };
}
