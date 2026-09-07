import type { Principal } from "@compass/core/types.js";

/**
 * Demo personas. In production these come from Google OIDC + a Google Groups sync
 * (see src/security/auth.ts and docs/TRD.md §4). Here a switcher stands in so you can
 * see the permission boundary behave from different vantage points.
 */
export const PERSONAS: Record<string, { label: string; note: string; principal: Principal }> = {
  programs: {
    label: "Program Officer",
    note: "Programs + Impact groups · sees team + programs-only",
    principal: { userId: "d.okafor", groups: ["programs", "impact"], allowedTiers: ["team", "programs-only"] },
  },
  impact: {
    label: "Impact Analyst",
    note: "Impact group · team tier only in this demo",
    principal: { userId: "l.fischer", groups: ["impact"], allowedTiers: ["team"] },
  },
  other: {
    label: "Comms (outside Programs/Impact)",
    note: "team tier, and only where the ACL matches",
    principal: { userId: "r.mensah", groups: ["comms"], allowedTiers: ["team"] },
  },
};
