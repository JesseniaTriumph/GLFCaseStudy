import { test } from "node:test";
import assert from "node:assert/strict";
import { Monitor } from "../src/security/monitor.js";
import type { AuditEvent } from "../src/security/audit.js";

const refusalRestricted = (user: string): AuditEvent => ({
  type: "query",
  user,
  question: `q-${Math.random()}`,
  citedRefs: [],
  citedTiers: [],
  withheld: 0,
  withheldTiers: ["restricted"],
  confidence: "refused",
  mode: "extractive",
});

test("restricted-probing fires at the threshold and is high severity", () => {
  const m = new Monitor({ windowMs: 60_000, restrictedRefusals: 3, authDenials: 5, sweepQueries: 15, costMultiple: 4 });
  m.observe(refusalRestricted("u"));
  m.observe(refusalRestricted("u"));
  const sigs = m.observe(refusalRestricted("u"));
  const s = sigs.find((x) => x.kind === "restricted-probing");
  assert.ok(s);
  assert.equal(s!.severity, "high");
});

test("auth-brute fires after repeated denials for one user", () => {
  const m = new Monitor({ windowMs: 60_000, restrictedRefusals: 3, authDenials: 3, sweepQueries: 15, costMultiple: 4 });
  m.observe({ type: "auth", user: "u", result: "denied" });
  m.observe({ type: "auth", user: "u", result: "denied" });
  const sigs = m.observe({ type: "auth", user: "u", result: "denied" });
  assert.ok(sigs.some((s) => s.kind === "auth-brute"));
});

test("events outside the window are dropped", () => {
  let now = 0;
  const m = new Monitor({ windowMs: 1000, restrictedRefusals: 3, authDenials: 5, sweepQueries: 15, costMultiple: 4, now: () => now });
  m.observe(refusalRestricted("u"));
  m.observe(refusalRestricted("u"));
  now = 5000; // far past the window
  const sigs = m.observe(refusalRestricted("u"));
  assert.ok(!sigs.some((s) => s.kind === "restricted-probing"));
});

test("no signal without a user field (ingest event)", () => {
  const m = new Monitor();
  assert.deepEqual(m.observe({ type: "ingest", sources: {}, chunks: 0, commit: null }), []);
});

test("a different user's activity does not trip another user's threshold", () => {
  const m = new Monitor({ windowMs: 60_000, restrictedRefusals: 3, authDenials: 5, sweepQueries: 15, costMultiple: 4 });
  m.observe(refusalRestricted("a"));
  m.observe(refusalRestricted("a"));
  const sigs = m.observe(refusalRestricted("b"));
  assert.ok(!sigs.some((s) => s.kind === "restricted-probing"));
});
