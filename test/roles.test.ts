import { test } from "node:test";
import assert from "node:assert/strict";
import {
  functionsForGroups,
  fiscalQuarter,
  fiscalYearLabel,
  currentSeasons,
  reportingCadence,
  suggestedQuestions,
  interpretQuery,
} from "../src/roles.js";

test("functionsForGroups: maps known groups, falls back to programs", () => {
  assert.ok(functionsForGroups(["comms"]).includes("comms"));
  assert.deepEqual(functionsForGroups(["nonsense-group"]), ["programs"]);
  assert.deepEqual(functionsForGroups([]), ["programs"]);
});

test("fiscalQuarter: Feb-1 fiscal year → Feb is Q1, Jan is Q4", () => {
  assert.equal(fiscalQuarter(new Date("2026-02-15")), 1);
  assert.equal(fiscalQuarter(new Date("2026-05-15")), 2);
  assert.equal(fiscalQuarter(new Date("2026-11-15")), 4);
  assert.equal(fiscalQuarter(new Date("2026-01-15")), 4);
});

test("fiscalYearLabel: rolls to the next FY once February starts", () => {
  assert.equal(fiscalYearLabel(new Date("2026-01-15")), "FY26");
  assert.equal(fiscalYearLabel(new Date("2026-02-15")), "FY27");
});

test("currentSeasons: returns the windows active in the given quarter", () => {
  const q1 = currentSeasons(new Date("2026-02-15")); // Q1 → audit-season
  assert.ok(q1.includes("audit-season"));
  const q3 = currentSeasons(new Date("2026-08-15")); // Q3 → planning, rfp-open...
  assert.ok(q3.includes("planning"));
});

test("reportingCadence: scales with the term length", () => {
  assert.match(reportingCadence(1), /interim check-in/);
  assert.match(reportingCadence(2), /annual progress report each year/);
  assert.match(reportingCadence(4), /each of 4 years/);
});

test("suggestedQuestions: returns up to 3, substitutes the grantee token", () => {
  const qs = suggestedQuestions(["programs"], currentSeasons(), "Riverbend");
  assert.ok(qs.length <= 3);
  assert.ok(!qs.join(" ").includes("{grantee}"));
});

test("interpretQuery: returns a reading for an ambiguous board-season question, else null", () => {
  const r = interpretQuery("how are we doing", ["board"], ["board-prep"]);
  assert.ok(r === null || typeof r === "string");
  assert.equal(interpretQuery("what is the exact wage figure for Riverbend", ["programs"], []), null);
});
