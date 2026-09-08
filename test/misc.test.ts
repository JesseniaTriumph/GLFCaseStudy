import { test } from "node:test";
import assert from "node:assert/strict";
import { sha1 } from "../src/util/hash.js";
import { Monitor } from "../src/security/monitor.js";
import type { AuditEvent } from "../src/security/audit.js";

test("sha1: deterministic, hex, 40 chars", () => {
  assert.equal(sha1("abc"), sha1("abc"));
  assert.match(sha1("abc"), /^[0-9a-f]{40}$/);
  assert.notEqual(sha1("a"), sha1("b"));
});

const weakQuery = (user: string, q: string): AuditEvent => ({
  type: "query",
  user,
  question: q,
  citedRefs: [],
  citedTiers: [],
  withheld: 3,
  withheldTiers: ["programs-only"],
  confidence: "low",
  mode: "extractive",
});

test("monitor: a broad low-confidence sweep raises broad-sweep + withheld-surge", () => {
  const m = new Monitor({ windowMs: 60_000, restrictedRefusals: 99, authDenials: 99, sweepQueries: 5, costMultiple: 99 });
  let sigs: ReturnType<Monitor["observe"]> = [];
  for (let i = 0; i < 6; i++) sigs = m.observe(weakQuery("u", `distinct question ${i}`));
  assert.ok(sigs.some((s) => s.kind === "broad-sweep"));
  assert.ok(sigs.some((s) => s.kind === "withheld-surge"));
});
