import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { googleDirectoryResolver, envMapResolver, cached, resolveGroupResolver } from "../src/security/directory.js";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SA = JSON.stringify({ client_email: "sa@project.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) });

function mockFetch(routes: Record<string, unknown>): typeof fetch {
  return (async (url: string) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) return { ok: true, json: async () => ({ access_token: "tok" }) } as Response;
    for (const [frag, body] of Object.entries(routes)) {
      if (u.includes(frag)) {
        if (body instanceof Error) return { ok: false, status: 500, text: async () => "err" } as Response;
        return { ok: true, json: async () => body } as Response;
      }
    }
    return { ok: false, status: 404, text: async () => "no route" } as Response;
  }) as typeof fetch;
}

const env = { GOOGLE_SA_KEY_JSON: SA, GOOGLE_DIRECTORY_SUBJECT: "admin@ft.org" };

test("googleDirectoryResolver: returns group local-parts, de-duped, paginated", async () => {
  let call = 0;
  const fetchImpl = (async (url: string) => {
    const u = String(url);
    if (u.includes("/token")) return { ok: true, json: async () => ({ access_token: "t" }) } as Response;
    call++;
    if (call === 1) return { ok: true, json: async () => ({ groups: [{ email: "Programs@ft.org" }, { email: "impact@ft.org" }], nextPageToken: "p2" }) } as Response;
    return { ok: true, json: async () => ({ groups: [{ email: "impact@ft.org" }, { email: "leadership@ft.org" }] }) } as Response;
  }) as typeof fetch;
  const r = googleDirectoryResolver({ env, fetchImpl });
  const groups = await r("dana@ft.org", "s1");
  assert.deepEqual(groups.sort(), ["impact", "leadership", "programs"]);
});

test("googleDirectoryResolver: a directory error throws (caller fails closed)", async () => {
  const r = googleDirectoryResolver({ env, fetchImpl: mockFetch({ "/groups": new Error("boom") }) });
  await assert.rejects(() => r("dana@ft.org", "s1"), /group lookup failed/);
});

test("googleDirectoryResolver: requireActive rejects a suspended account", async () => {
  const r = googleDirectoryResolver({
    env,
    requireActive: true,
    fetchImpl: mockFetch({ "/users/": { suspended: true }, "/groups": { groups: [] } }),
  });
  await assert.rejects(() => r("gone@ft.org", "s1"), /not active/);
});

test("googleDirectoryResolver: requireActive passes an active account through to groups", async () => {
  const r = googleDirectoryResolver({
    env,
    requireActive: true,
    fetchImpl: mockFetch({ "/users/": { suspended: false }, "/groups": { groups: [{ email: "programs@ft.org" }] } }),
  });
  assert.deepEqual(await r("dana@ft.org", "s1"), ["programs"]);
});

test("googleDirectoryResolver: missing subject / key is a config error", () => {
  assert.throws(() => googleDirectoryResolver({ env: {} }), /GOOGLE_DIRECTORY_SUBJECT/);
  assert.throws(() => googleDirectoryResolver({ env: { GOOGLE_DIRECTORY_SUBJECT: "a@b" } }), /service-account key/);
});

test("envMapResolver: maps known emails, falls back otherwise", async () => {
  const r = envMapResolver({ COMPASS_GROUP_MAP: JSON.stringify({ "a@ft.org": ["comms"] }) });
  assert.deepEqual(await r("a@ft.org", "s"), ["comms"]);
  assert.deepEqual(await r("unknown@ft.org", "s"), ["programs"]);
});

test("cached: serves from cache within the TTL, refetches after, never caches a throw", async () => {
  let calls = 0;
  let now = 0;
  const flaky = async () => {
    calls++;
    if (calls === 2) throw new Error("transient");
    return ["programs"];
  };
  const r = cached(flaky, 60, () => now);
  assert.deepEqual(await r("a@ft.org", "s"), ["programs"]); // call 1, cached
  assert.deepEqual(await r("a@ft.org", "s"), ["programs"]); // served from cache, no call
  assert.equal(calls, 1);
  now = 61_000; // TTL elapsed
  await assert.rejects(() => r("a@ft.org", "s")); // call 2 throws
  assert.deepEqual(await r("a@ft.org", "s"), ["programs"]); // call 3 succeeds — not locked out
  assert.equal(calls, 3);
});

test("resolveGroupResolver: picks Directory when a SA + subject are set, else the demo map", () => {
  assert.match(resolveGroupResolver({}).mode, /demo/);
  assert.match(resolveGroupResolver(env).mode, /Google Directory/);
});
