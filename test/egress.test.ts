import { test } from "node:test";
import assert from "node:assert/strict";
import { hostAllowed, defaultAllowlist, installEgressGuard, EgressError } from "../src/util/egress.js";

test("hostAllowed: exact host and leading-dot suffix", () => {
  const allow = ["api.airtable.com", ".googleapis.com"];
  assert.equal(hostAllowed("api.airtable.com", allow), true);
  assert.equal(hostAllowed("www.googleapis.com", allow), true);
  assert.equal(hostAllowed("admin.googleapis.com", allow), true);
  assert.equal(hostAllowed("googleapis.com", allow), true); // the bare apex the dot-rule also covers
  assert.equal(hostAllowed("evil.com", allow), false);
  assert.equal(hostAllowed("api.airtable.com.evil.com", allow), false);
});

test("hostAllowed: port is ignored on both sides", () => {
  assert.equal(hostAllowed("api.airtable.com:443", ["api.airtable.com"]), true);
  assert.equal(hostAllowed("localhost", ["localhost:8787"]), true);
});

test("hostAllowed: cloud metadata and private ranges are blocked unless listed verbatim", () => {
  assert.equal(hostAllowed("169.254.169.254", [".googleapis.com"]), false);
  assert.equal(hostAllowed("169.254.169.254", ["169.254.169.254"]), true); // explicit opt-in
  assert.equal(hostAllowed("10.0.0.5", ["api.airtable.com"]), false);
  assert.equal(hostAllowed("192.168.1.1", []), false);
  assert.equal(hostAllowed("127.0.0.1", []), false);
  assert.equal(hostAllowed("metadata.google.internal", [".google.internal"]), false);
});

test("defaultAllowlist: always has Google; adds connector hosts only when their env is set", () => {
  const base = defaultAllowlist({});
  assert.ok(base.includes("accounts.google.com"));
  assert.ok(base.includes(".googleapis.com"));
  assert.ok(!base.includes("api.airtable.com"));

  const full = defaultAllowlist({
    AIRTABLE_TOKEN: "x",
    COMPASS_NOTION_ENABLE: "1",
    ANTHROPIC_API_KEY: "k",
    GIVINGDATA_API_ROOT: "https://gitlabfoundation.givingdata.com/api",
    COMPASS_AUDIT_WEBHOOK: "https://siem.example.org/ingest",
    COMPASS_EGRESS_ALLOW: "extra.example.com",
  });
  assert.ok(full.includes("api.airtable.com"));
  assert.ok(full.includes("api.notion.com"));
  assert.ok(full.includes("api.anthropic.com"));
  assert.ok(full.includes("gitlabfoundation.givingdata.com"));
  assert.ok(full.includes("siem.example.org"));
  assert.ok(full.includes("extra.example.com"));
});

test("installEgressGuard: allowed hosts pass through, blocked hosts throw, disposer restores", async () => {
  const calls: string[] = [];
  const stub = (async (u: string) => (calls.push(String(u)), { ok: true } as Response)) as typeof fetch;
  globalThis.fetch = stub;
  const dispose = installEgressGuard(["api.airtable.com"]);
  try {
    await globalThis.fetch("https://api.airtable.com/v0/app/tbl");
    assert.equal(calls.length, 1);
    await assert.rejects(() => globalThis.fetch("https://evil.example.com/x"), EgressError);
    await assert.rejects(() => globalThis.fetch("https://169.254.169.254/latest/meta-data/"), EgressError);
    assert.equal(calls.length, 1); // the blocked ones never reached the base fetch
  } finally {
    dispose();
  }
  assert.equal(globalThis.fetch, stub);
});

test("installEgressGuard: report-only mode warns but lets the request through", async () => {
  const calls: string[] = [];
  const blocked: string[] = [];
  const stub = (async (u: string) => (calls.push(String(u)), { ok: true } as Response)) as typeof fetch;
  globalThis.fetch = stub;
  const dispose = installEgressGuard(["api.airtable.com"], { onBlock: (h) => blocked.push(h) });
  try {
    await globalThis.fetch("https://evil.example.com/x");
    assert.deepEqual(blocked, ["evil.example.com"]);
    assert.equal(calls.length, 1);
  } finally {
    dispose();
  }
});
