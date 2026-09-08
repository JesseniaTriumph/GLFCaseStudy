import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_PERSONAS, demoPersona } from "../src/server/demo-personas.js";
import { principalFromGroups } from "../src/security/auth.js";

test("demoPersona looks a persona up by key, undefined for unknown", () => {
  assert.equal(demoPersona("comms")?.name, "C.J. Jax");
  assert.equal(demoPersona("not-a-persona"), undefined);
});

test("every persona has the fields a session needs, and a fictional email", () => {
  for (const p of DEMO_PERSONAS) {
    assert.ok(p.key && p.label && p.note && p.sub && p.name);
    assert.match(p.email, /@gitlabfoundation\.example$/); // never a real-looking address
    assert.ok(Array.isArray(p.groups));
    // every persona has groups except the deliberate fail-closed test account
    assert.ok(p.groups.length > 0 || p.groupsResolved === false, p.key);
  }
});

test("persona groups resolve to the tier the label promises", () => {
  const teamOnly = new Set(["impact-advisory", "comms", "board"]);
  for (const p of DEMO_PERSONAS) {
    if (p.groupsResolved === false) {
      // the fail-closed test persona: session issued, but denied every tier
      assert.deepEqual(principalFromGroups(p.sub, p.groups, false).allowedTiers, [], p.key);
      continue;
    }
    const tiers = principalFromGroups(p.sub, p.groups).allowedTiers;
    if (teamOnly.has(p.key)) assert.deepEqual(tiers, ["team"], p.key);
    else assert.deepEqual(tiers, ["team", "programs-only"], p.key);
  }
});

test("persona keys are unique", () => {
  const keys = DEMO_PERSONAS.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length);
});
