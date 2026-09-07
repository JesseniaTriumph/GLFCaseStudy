import type { Principal } from "./lib/core/types.js";
import { functionsForGroups } from "./lib/roles.js";

/**
 * Demo personas (fictional users). In production these come from Google OIDC + a synced
 * Google Groups membership. `groups` drive the permission filter AND — separately, only
 * when Role & cycle context is on — the relevance logic in lib/roles.ts.
 */
export const PERSONAS: Record<string, { label: string; note: string; principal: Principal }> = {
  programs: {
    label: "Program Officer",
    note: "Programs · team + programs-only",
    principal: { userId: "d.okafor", groups: ["programs"], allowedTiers: ["team", "programs-only"] },
  },
  impact: {
    label: "Impact Analyst",
    note: "Impact · team tier only in this demo",
    principal: { userId: "l.fischer", groups: ["impact"], allowedTiers: ["team"] },
  },
  executive: {
    label: "Executive (COO)",
    note: "Executive · team + programs-only",
    principal: { userId: "e.wilson", groups: ["executive", "leadership"], allowedTiers: ["team", "programs-only"] },
  },
  donor: {
    label: "Donor Engagement / EIR",
    note: "Collaborative capital · team + programs-only",
    principal: { userId: "d.petty", groups: ["donor-engagement", "partnerships"], allowedTiers: ["team", "programs-only"] },
  },
  finance: {
    label: "Grants Operations",
    note: "Finance & Grants Ops · team + programs-only",
    principal: { userId: "j.vangrouw", groups: ["finance", "grants-ops"], allowedTiers: ["team", "programs-only"] },
  },
  other: {
    label: "Comms (outside Programs/Impact)",
    note: "team tier, and only where the ACL matches",
    principal: { userId: "r.mensah", groups: ["comms"], allowedTiers: ["team"] },
  },
};

export const personaFunctions = (k: keyof typeof PERSONAS) => functionsForGroups(PERSONAS[k].principal.groups);
