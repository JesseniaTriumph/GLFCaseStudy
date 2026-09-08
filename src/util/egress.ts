/**
 * Egress allowlist (roadmap "get to 100" §3 / SC-2; OWASP A10 — SSRF).
 *
 * Compass makes outbound calls to a small, known set of hosts: Google (OIDC + Directory +
 * Drive), the connector APIs (GivingData / Airtable / Notion / Zoom), optionally a
 * translation endpoint, an LLM endpoint, and an audit webhook. Nothing else should ever
 * leave the process — a retrieved document or a poisoned config value must not be able to
 * make the server fetch an arbitrary URL.
 *
 * In production this is also enforced at the network layer (a NetworkPolicy / firewall).
 * `installEgressGuard()` is the in-process backstop: it wraps `globalThis.fetch` so every
 * request is checked against the allowlist first. It is OFF by default (so tests and the
 * demo are unaffected) and turned on in `serve.ts` when `COMPASS_EGRESS_ENFORCE=1`.
 *
 * Always blocked, even if a host resolves to them: cloud metadata (169.254.169.254),
 * loopback, and RFC-1918 / link-local ranges — unless the exact host is on the allowlist
 * (so `http://localhost:PORT` in a dev setup still works when you opt in).
 */

export class EgressError extends Error {
  constructor(host: string) {
    super(`egress blocked: ${host} is not on the allowlist`);
    this.name = "EgressError";
  }
}

const METADATA_IPS = new Set(["169.254.169.254", "metadata.google.internal", "100.100.100.200"]);

function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 127 || // loopback
    a === 10 || // 10/8
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12
    (a === 192 && b === 168) || // 192.168/16
    (a === 169 && b === 254) || // link-local
    a === 0
  );
}

/** exact host, or a leading-dot suffix ("​.googleapis.com" matches "www.googleapis.com") */
export function hostAllowed(host: string, allow: readonly string[]): boolean {
  const h = host.toLowerCase().replace(/:\d+$/, "");
  if (METADATA_IPS.has(h)) return allow.includes(h); // metadata only if listed verbatim
  for (const rule of allow) {
    const r = rule.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
    if (h === r) return true;
    if (r.startsWith(".") && (h === r.slice(1) || h.endsWith(r))) return true;
  }
  if (isPrivateHost(h)) return false;
  return false;
}

/** Build the default allowlist from the environment (the connectors that are actually on). */
export function defaultAllowlist(env: NodeJS.ProcessEnv = process.env): string[] {
  const allow = new Set<string>([
    "accounts.google.com",
    "oauth2.googleapis.com",
    ".googleapis.com", // www.googleapis.com, admin.googleapis.com, sheets/drive/...
    "openidconnect.googleapis.com",
  ]);
  const addHost = (u?: string) => {
    if (!u) return;
    try {
      allow.add(new URL(u.includes("://") ? u : `https://${u}`).host.replace(/:\d+$/, ""));
    } catch {
      /* ignore a malformed value */
    }
  };
  if (env.GIVINGDATA_API_ROOT) addHost(env.GIVINGDATA_API_ROOT);
  if (env.COMPASS_AIRTABLE_TOKEN || env.AIRTABLE_TOKEN) allow.add("api.airtable.com");
  if (env.COMPASS_NOTION_ENABLE) allow.add("api.notion.com");
  if (env.COMPASS_ZOOM_ENABLE) {
    allow.add("api.zoom.us");
    allow.add("zoom.us");
  }
  if (env.ANTHROPIC_API_KEY) allow.add("api.anthropic.com");
  addHost(env.COMPASS_TRANSLATE_URL);
  addHost(env.COMPASS_AUDIT_WEBHOOK);
  for (const extra of (env.COMPASS_EGRESS_ALLOW ?? "").split(",").map((s) => s.trim()).filter(Boolean)) allow.add(extra);
  return [...allow];
}

/**
 * Wrap the current `globalThis.fetch` with an allowlist check. Returns a disposer that
 * restores whatever `fetch` was in place when it was called. `onBlock` defaults to
 * throwing `EgressError`; pass a logger to run in report-only mode first. Call once, at
 * startup.
 */
export function installEgressGuard(
  allow: readonly string[],
  opts: { onBlock?: (host: string, url: string) => void } = {}
): () => void {
  const base = globalThis.fetch;
  const guard = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    let host = "";
    try {
      host = new URL(url).host;
    } catch {
      throw new EgressError(url);
    }
    if (!hostAllowed(host, allow)) {
      if (opts.onBlock) {
        opts.onBlock(host, url);
      } else {
        throw new EgressError(host);
      }
    }
    return base(input, init);
  }) as typeof fetch;
  globalThis.fetch = guard;
  return () => {
    globalThis.fetch = base;
  };
}
