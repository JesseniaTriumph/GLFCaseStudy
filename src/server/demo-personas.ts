/**
 * Demo personas for the walk-through (roadmap 2.7, deliverables/O_Demo_Script.md).
 *
 * In production, identity comes from Google OIDC and permission groups from a synced
 * Google Groups lookup. For a demo on synthetic data — where there is nothing real to
 * protect — `/auth/demo?persona=<key>` issues a REAL Compass session for one of these
 * fictional users, so every answer still goes through the same server-side permission
 * filter, session, rate limit and audit that production uses. Nothing about the security
 * boundary is stubbed; only the identity provider is.
 *
 * This endpoint is mounted only when the server is started with `demoLogin: true`
 * (`scripts/serve.ts` enables it unless `COMPASS_NO_DEMO=1`). It is off in a real
 * deployment.
 *
 * Keep the `groups` here in sync with `web/src/principals.ts` — same fictional org.
 */
export interface DemoPersona {
  key: string;
  label: string;
  /** one-line description shown in the picker */
  note: string;
  sub: string;
  email: string;
  name: string;
  /** permission groups — drive the tier filter via principalFromGroups() */
  groups: string[];
}

export const DEMO_PERSONAS: DemoPersona[] = [
  { key: "programs", label: "Program Officer", note: "owns a grant portfolio — team + programs-only", sub: "demo-d-okafor", email: "d.okafor@gitlabfoundation.example", name: "Dana Okafor", groups: ["programs"] },
  { key: "program-ops", label: "Program Associate / Coordinator", note: "lifecycle admin, deadlines, grantee support — team + programs-only", sub: "demo-a-sindel", email: "a.sindel@gitlabfoundation.example", name: "Ana Sindel", groups: ["program-ops"] },
  { key: "grants-compliance", label: "Grants Manager (compliance)", note: "compliance, data integrity, expenditure responsibility — team + programs-only", sub: "demo-j-vangrouw", email: "j.vangrouw@gitlabfoundation.example", name: "Jo Van Grouw", groups: ["grants-ops", "grants-compliance"] },
  { key: "impact-measurement", label: "Impact Modeling & Measurement", note: "the North Star model + outcome data — team + programs-only", sub: "demo-g-malin", email: "g.malin@gitlabfoundation.example", name: "Geeta Malin", groups: ["impact-measurement", "impact"] },
  { key: "impact-director", label: "Director of Impact", note: "evidence strategy — team + programs-only", sub: "demo-t-chen", email: "t.chen@gitlabfoundation.example", name: "Tam Chen", groups: ["impact", "impact-director"] },
  { key: "impact-advisory", label: "Impact Advisory (external clients)", note: "benchmarks for peer foundations — team tier only, no confidential grantee detail", sub: "demo-p-dewar", email: "p.dewar@gitlabfoundation.example", name: "Priya Dewar", groups: ["impact-advisory"] },
  { key: "partnerships", label: "Partnerships / Donor Relations", note: "co-funders, donors — team + programs-only", sub: "demo-s-hart", email: "s.hart@gitlabfoundation.example", name: "Sam Hart", groups: ["partnerships", "donor-engagement"] },
  { key: "ceo", label: "President & CEO", note: "portfolio narrative, board — team + programs-only", sub: "demo-e-bright", email: "e.bright@gitlabfoundation.example", name: "El Bright", groups: ["ceo", "leadership"] },
  { key: "coo", label: "Chief Operating Officer", note: "operations, process, access owner — team + programs-only", sub: "demo-e-wilson", email: "e.wilson@gitlabfoundation.example", name: "Erin Wilson", groups: ["coo", "operations", "leadership"] },
  { key: "finance", label: "Finance (CFO / Controller)", note: "commitments vs. disbursements, payout — team + programs-only", sub: "demo-t-cude", email: "t.cude@gitlabfoundation.example", name: "Tracy Cude", groups: ["finance", "accounting"] },
  { key: "comms", label: "Communications & Marketing", note: "externally-cleared results only — team tier only", sub: "demo-c-jax", email: "c.jax@gitlabfoundation.example", name: "C.J. Jax", groups: ["comms"] },
  { key: "board", label: "Board member", note: "read-only, portfolio-level — team tier only", sub: "demo-c-whit", email: "c.whit@gitlabfoundation.example", name: "Casey Whit", groups: ["board"] },
];

export const demoPersona = (key: string): DemoPersona | undefined => DEMO_PERSONAS.find((p) => p.key === key);
