import { test } from "node:test";
import assert from "node:assert/strict";
import { principalIds, mayRead } from "../src/retrieval/search.js";
import type { Principal } from "../src/core/types.js";

const P = (over: Partial<Principal> = {}): Principal => ({
  userId: "dana",
  groups: ["programs"],
  allowedTiers: ["team", "programs-only"],
  ...over,
});

test("principalIds: user:, group:*, and the wildcard", () => {
  const ids = principalIds(P());
  assert.ok(ids.has("user:dana"));
  assert.ok(ids.has("group:programs"));
  assert.ok(ids.has("*"));
});

test("mayRead: tier AND acl must both pass", () => {
  const p = P();
  assert.equal(mayRead({ tier: "programs-only", acl: ["*"] }, p), true);
  assert.equal(mayRead({ tier: "programs-only", acl: ["group:programs"] }, p), true);
  // tier not allowed
  assert.equal(mayRead({ tier: "restricted", acl: ["*"] }, p), false);
  // acl does not include this principal
  assert.equal(mayRead({ tier: "team", acl: ["group:finance"] }, p), false);
});

test("mayRead: a team-only principal cannot read programs-only", () => {
  const comms = P({ groups: ["comms"], allowedTiers: ["team"] });
  assert.equal(mayRead({ tier: "programs-only", acl: ["*"] }, comms), false);
  assert.equal(mayRead({ tier: "team", acl: ["*"] }, comms), true);
});

test("mayRead: empty allowedTiers → reads nothing (fail closed)", () => {
  const denied = P({ allowedTiers: [], groups: [] });
  assert.equal(mayRead({ tier: "team", acl: ["*"] }, denied), false);
});

test("mayRead: empty acl → reads nothing", () => {
  assert.equal(mayRead({ tier: "team", acl: [] }, P()), false);
});
