import type { Principal } from "./lib/core/types.js";
import { functionsForGroups } from "./lib/roles.js";

/**
 * Demo personas (fictional users) — one per function in the real ~17-person org (see
 * docs/ROLES_AND_USERS.md). In production these come from Google OIDC + a synced Google
 * Groups membership. `groups` drive the permission filter AND — separately, only when
 * Role & cycle context is on — the relevance logic in lib/roles.ts.
 *
 * Permission tiers: `team` = any signed-in staff; `programs-only` = Programs + Impact +
 * leadership + finance/grants-ops + partnerships. `restricted` is granted to no one.
 */
export const PERSONAS: Record<string, { label: string; note: string; principal: Principal }> = {
  programs: {
    label: "Program Officer",
    note: "owns a grant portfolio · team + programs-only",
    principal: { userId: "d.okafor", groups: ["programs"], allowedTiers: ["team", "programs-only"] },
  },
  "program-ops": {
    label: "Program Associate / Coordinator",
    note: "lifecycle admin, deadlines, grantee support · team + programs-only",
    principal: { userId: "a.sindel", groups: ["program-ops"], allowedTiers: ["team", "programs-only"] },
  },
  "grants-compliance": {
    label: "Grants Manager (compliance)",
    note: "compliance, data integrity, expenditure responsibility · team + programs-only",
    principal: { userId: "j.vangrouw", groups: ["grants-ops", "grants-compliance"], allowedTiers: ["team", "programs-only"] },
  },
  "impact-measurement": {
    label: "Impact Modeling & Measurement",
    note: "the North Star model + outcome data · team + programs-only",
    principal: { userId: "g.malin", groups: ["impact-measurement", "impact"], allowedTiers: ["team", "programs-only"] },
  },
  "impact-director": {
    label: "Director of Impact",
    note: "evidence strategy · team + programs-only",
    principal: { userId: "t.chen", groups: ["impact", "impact-director"], allowedTiers: ["team", "programs-only"] },
  },
  "impact-advisory": {
    label: "Impact Advisory (external clients)",
    note: "benchmarks for peer foundations · team tier only — no confidential grantee detail",
    principal: { userId: "p.dewar", groups: ["impact-advisory"], allowedTiers: ["team"] },
  },
  partnerships: {
    label: "Partnerships / Donor Relations",
    note: "co-funders, donors · team + programs-only",
    principal: { userId: "s.hart", groups: ["partnerships", "donor-engagement"], allowedTiers: ["team", "programs-only"] },
  },
  ceo: {
    label: "President & CEO",
    note: "portfolio narrative, board · team + programs-only",
    principal: { userId: "e.bright", groups: ["ceo", "leadership"], allowedTiers: ["team", "programs-only"] },
  },
  coo: {
    label: "Chief Operating Officer",
    note: "operations, process, access owner · team + programs-only",
    principal: { userId: "e.wilson", groups: ["coo", "operations", "leadership"], allowedTiers: ["team", "programs-only"] },
  },
  finance: {
    label: "Finance (CFO / Controller)",
    note: "commitments vs. disbursements, payout · team + programs-only",
    principal: { userId: "t.cude", groups: ["finance", "accounting"], allowedTiers: ["team", "programs-only"] },
  },
  comms: {
    label: "Communications & Marketing",
    note: "externally-cleared results · team tier only",
    principal: { userId: "c.jax", groups: ["comms"], allowedTiers: ["team"] },
  },
  board: {
    label: "Board member",
    note: "read-only, portfolio-level · team tier only",
    principal: { userId: "c.whit", groups: ["board"], allowedTiers: ["team"] },
  },
};

export const personaFunctions = (k: keyof typeof PERSONAS) => functionsForGroups(PERSONAS[k].principal.groups);
