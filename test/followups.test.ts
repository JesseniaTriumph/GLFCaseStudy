import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestFollowups } from "../src/retrieval/followups.js";
import type { CorpusIndex } from "../src/core/types.js";
import type { Scored } from "../src/retrieval/search.js";

const org = { kind: "organization" as const, id: "org:riverbend", label: "Riverbend Care Collective" };
const grant = { kind: "grant" as const, id: "GD-1188", label: "GD-1188" };

const hit = (over: Record<string, unknown>): Scored =>
  ({
    chunk: {
      id: "c", docId: "c", system: "givingdata", docTitle: "doc", text: "text",
      entities: [org, grant], tier: "team", acl: ["*"], ...over,
    },
    score: 1, bm25: 3, semantic: 0.2,
  }) as never;

const baseIndex = {
  gaps: { missingByGrant: { "GD-1188": ["Year 1 progress report"] }, grantsWithNoOrgRecord: [], grantsWithNoProposal: [], untaggedGrants: [] },
  grantMeta: {
    "GD-1188": {
      organization: "Riverbend Care Collective", startDate: "2025-01-01", endDate: "2025-12-31",
      termYears: 1, reportingFrequency: "annual", grantStatus: "active",
      requirements: [{ type: "progress report", dueDate: "2025-07-01", status: "overdue" }],
    },
  },
  directory: [
    { name: "Dana Okafor", role: "Program Officer", email: "d.okafor@foundation.example", kind: "internal", grantIds: ["GD-1188"], orgLabels: ["Riverbend Care Collective"], source: "givingdata" },
    { name: "Ravi Grantee", role: "ED", email: null, kind: "external", grantIds: ["GD-1188"], orgLabels: ["Riverbend Care Collective"], source: "airtable" },
  ],
} as unknown as CorpusIndex;

test("gaps: a single-system, plan-only, restricted-withheld answer produces the expected flags", () => {
  const f = suggestFollowups(
    baseIndex,
    "how is Riverbend Care Collective doing across the portfolio?",
    [hit({ docTitle: "Grant fact sheet — Riverbend" })],
    { count: 3, tiers: ["restricted"] }
  );
  const joined = f.gaps.join(" | ");
  assert.match(joined, /GD-1188: Year 1 progress report/);
  assert.match(joined, /based on the plan, not outcomes/);
  assert.match(joined, /Restricted tier/);
  assert.match(joined, /givingdata only/);
  assert.match(joined, /partial answer|only a few sources/i);
});

test("who to ask: the internal program officer ranks first and gets a why", () => {
  const f = suggestFollowups(baseIndex, "Riverbend outcomes", [hit({})], { count: 0, tiers: [] });
  assert.ok(f.whoToAsk.length >= 1);
  assert.equal(f.whoToAsk[0]!.person.name, "Dana Okafor");
  assert.equal(typeof f.whoToAsk[0]!.why, "string");
});

test("draft email is generated only when there is an internal recipient with an address", () => {
  const withEmail = suggestFollowups(baseIndex, "Riverbend outcomes", [hit({})], { count: 0, tiers: [] });
  assert.ok(withEmail.draftEmail);
  assert.equal(withEmail.draftEmail!.to, "d.okafor@foundation.example");
  assert.match(withEmail.draftEmail!.body, /Riverbend/);

  const noInternal = { ...baseIndex, directory: [baseIndex.directory[1]!] } as CorpusIndex;
  const without = suggestFollowups(noInternal, "Riverbend outcomes", [hit({})], { count: 0, tiers: [] });
  assert.equal(without.draftEmail, null);
});

test("per-grant cycle is computed from the grant's own requirement schedule", () => {
  const f = suggestFollowups(baseIndex, "Riverbend outcomes", [hit({})], { count: 0, tiers: [] });
  assert.ok(f.cycle && f.cycle.length === 1);
  assert.equal(f.cycle![0]!.grantId, "GD-1188");
  assert.equal(typeof f.cycle![0]!.summary, "string");
});

test("suggested questions mention the grantee and the missing report", () => {
  const f = suggestFollowups(baseIndex, "Riverbend outcomes", [hit({ docTitle: "Grant fact sheet — Riverbend" })], { count: 0, tiers: [] });
  const s = f.suggestedQuestions.join(" | ");
  assert.match(s, /Riverbend Care Collective/);
  assert.match(s, /overdue|missing|haven't been filed/i);
});

test("no grants in the hits → empty who-to-ask, empty cycle, no draft email, still safe", () => {
  const f = suggestFollowups(
    { ...baseIndex, grantMeta: {} } as CorpusIndex,
    "a general question",
    [hit({ entities: [] })],
    { count: 0, tiers: [] }
  );
  assert.deepEqual(f.whoToAsk, []);
  assert.ok(!f.cycle || f.cycle.length === 0);
  assert.equal(f.draftEmail, null);
});
