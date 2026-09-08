import { test } from "node:test";
import assert from "node:assert/strict";
import { inferCadence, grantCycle, portfolioDeadlines } from "../src/grant-cycle.js";
import type { GrantRequirement } from "../src/grant-cycle.js";

const iso = (d: string) => d;
const req = (type: string, dueDate: string, status = "Not yet due"): GrantRequirement => ({ type, dueDate, status });

test("inferCadence: <2 reports → final-only", () => {
  assert.equal(inferCadence([req("Final report", "2025-01-01")]).frequency, "final-only");
});

test("inferCadence: ~quarterly spacing", () => {
  const r = inferCadence([
    req("Q1 report", "2025-01-01"),
    req("Q2 report", "2025-04-01"),
    req("Q3 report", "2025-07-01"),
    req("Q4 report", "2025-10-01"),
  ]);
  assert.equal(r.frequency, "quarterly");
  assert.equal(r.basis, "inferred");
  assert.equal(r.from, 4);
});

test("inferCadence: ~annual spacing", () => {
  const r = inferCadence([
    req("Year 1 report", "2023-06-01"),
    req("Year 2 report", "2024-06-01"),
    req("Year 3 report", "2025-06-01"),
  ]);
  assert.equal(r.frequency, "annual");
});

test("inferCadence: ignores proposal/final/renewal rows", () => {
  const r = inferCadence([
    req("Proposal", "2022-11-01"),
    req("Year 1 report", "2023-06-01"),
    req("Year 2 report", "2024-06-01"),
    req("Renewal LOI", "2025-02-01"),
  ]);
  assert.equal(r.from, 2);
});

test("grantCycle: pre-award when start is in the future", () => {
  const c = grantCycle({ grantId: "G1", startDate: "2999-01-01", endDate: "3001-01-01" }, new Date("2026-01-01"));
  assert.equal(c.stage, "pre-award");
});

test("grantCycle: closed when >60 days past end", () => {
  const c = grantCycle({ grantId: "G1", startDate: "2020-01-01", endDate: "2022-01-01" }, new Date("2026-01-01"));
  assert.equal(c.stage, "closed");
});

test("grantCycle: closing within 60 days of end", () => {
  const c = grantCycle({ grantId: "G1", startDate: "2024-01-01", endDate: "2026-02-01" }, new Date("2026-01-15"));
  assert.equal(c.stage, "closing");
});

test("grantCycle: renewal-window inside the lead time", () => {
  const c = grantCycle({ grantId: "G1", startDate: "2024-01-01", endDate: "2026-05-01" }, new Date("2026-01-20"), 120);
  assert.equal(c.stage, "renewal-window");
  assert.equal(c.inRenewalWindow, true);
});

test("grantCycle: overdue requirements are surfaced with day counts", () => {
  const c = grantCycle(
    {
      grantId: "G1",
      startDate: "2024-01-01",
      endDate: "2027-01-01",
      requirements: [req("Year 1 report", "2025-06-01", "Overdue")],
    },
    new Date("2025-09-08")
  );
  assert.equal(c.overdue.length, 1);
  assert.ok(c.overdue[0]!.overdueByDays > 90);
  assert.match(c.summary, /overdue/);
});

test("grantCycle: a met requirement is not overdue", () => {
  const c = grantCycle(
    { grantId: "G1", endDate: "2027-01-01", requirements: [req("Year 1 report", "2025-06-01", "Received")] },
    new Date("2025-09-08")
  );
  assert.equal(c.overdue.length, 0);
});

test("grantCycle: recorded reportingFrequency wins over inference", () => {
  const c = grantCycle({ grantId: "G1", endDate: "2027-01-01", reportingFrequency: "biennial" }, new Date("2026-01-01"));
  assert.equal(c.reportingFrequency, "biennial");
  assert.equal(c.reportingFrequencyBasis, "recorded");
});

test("grantCycle: nextDeadline is the soonest unmet future requirement", () => {
  const c = grantCycle(
    {
      grantId: "G1",
      endDate: "2030-01-01",
      requirements: [req("Y2 report", "2027-06-01"), req("Y1 report", "2026-06-01")],
    },
    new Date("2026-01-01")
  );
  assert.equal(c.nextDeadline?.type, "Y1 report");
});

test("portfolioDeadlines: closed grants excluded from overdue; renewals within window listed", () => {
  const today = new Date("2026-01-01");
  const active = grantCycle(
    { grantId: "A", endDate: "2028-01-01", requirements: [req("Y1 report", "2025-06-01", "Overdue")] },
    today
  );
  const closed = grantCycle(
    { grantId: "B", endDate: "2022-01-01", requirements: [req("Final report", "2021-06-01", "Overdue")] },
    today
  );
  const renewing = grantCycle(
    { grantId: "C", endDate: "2026-03-01", requirements: [req("Renewal LOI", "2026-02-01")] },
    today
  );
  const p = portfolioDeadlines([active, closed, renewing]);
  assert.ok(p.overdue.some((o) => o.grant === "A"));
  assert.ok(!p.overdue.some((o) => o.grant === "B"));
  assert.ok(p.renewals.some((r) => r.grant === "C"));
});
