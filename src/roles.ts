/**
 * Role, cycle & grant-lifecycle context — see docs/ROLES_AND_USERS.md.
 *
 * NOT a permission gate. This is relevance logic: which questions a *function* tends to
 * bring to grant knowledge, how that shifts by *season* (the Foundation's Feb–Jan fiscal
 * year, board cadence, the impact-report cycle, open-RFP windows, the post-close audit),
 * and where the *grant lifecycle itself* creates deadlines that matter to that function
 * (application and re-application windows, LOI / two-stage review, 1-year vs multi-year
 * reporting, the renewal window, close-out and expenditure-responsibility documentation).
 *
 * Toggleable, off by default. The permission filter (retrieval/search.ts) is upstream and
 * never touches any of this — a program associate and the CEO see the same tiers; this
 * only changes which questions Compass *suggests* and how it *reads an ambiguous one*.
 */

// ---------------------------------------------------------------------------
// Functions — mapped from the real ~17-person org (grantmaking · impact advisory ·
// values-aligned capital), kept distinct where the work is distinct. One person may
// carry several; the CEO and COO overlap but ask different questions.

export type FunctionKey =
  | "ceo" // President & CEO — narrative, board, strategy, "state of the portfolio"
  | "coo" // COO — operations across the three business lines, process, governance, access owner
  | "programs" // Program Officer / Senior PO — owns a grant portfolio end to end
  | "program-ops" // Program Associate / Coordinator — lifecycle admin, deadlines, grantee support
  | "grants-compliance" // Grants Manager — compliance, data integrity, expenditure responsibility
  | "impact-measurement" // Impact Modeling & Measurement — the North Star model, outcome data
  | "impact-director" // Director of Impact — evidence strategy, what's strong vs. thin
  | "impact-advisory" // Impact Advisory Services — EXTERNAL peer-foundation clients (no confidential grantee detail leaves)
  | "partnerships" // Partnerships / Donor Relations — co-funders, institutional donors, HNW
  | "finance" // CFO / Controller — commitments vs. disbursements, payout compliance, co-funder terms
  | "legal" // Counsel (often external) — confidentiality clauses, the tier scheme owner
  | "people-hr" // People / HR — distinct from ops; rarely a Compass user, board-comp is restricted
  | "comms" // Communications & Marketing — externally-cleared results, grantee stories
  | "exec-assistant" // EA — pulls materials for a principal's meeting
  | "board"; // Board member — read-only, high level; governance/comp is restricted

export interface FnDef {
  key: FunctionKey;
  label: string;
  /** Google-group ids that map to this function (a person can carry several) */
  groups: string[];
  /** one line: what this function is actually trying to do */
  nexus: string;
}

export const FUNCTIONS: FnDef[] = [
  { key: "ceo", label: "President & CEO", groups: ["ceo", "executive", "leadership"], nexus: "the story of the portfolio, the board narrative, where to place the next bet" },
  { key: "coo", label: "Chief Operating Officer", groups: ["coo", "operations", "executive", "leadership"], nexus: "the three business lines running smoothly; process bottlenecks; who can see what" },
  { key: "programs", label: "Program Officer", groups: ["programs", "program-officer"], nexus: "each grant in my portfolio doing what it said it would; the renewal call; prior art before a new grant" },
  { key: "program-ops", label: "Program Associate / Coordinator", groups: ["program-ops", "program-associate", "program-coordinator"], nexus: "nothing slips — deadlines, applications processing, grantee questions answered, the handbook current" },
  { key: "grants-compliance", label: "Grants Manager (compliance)", groups: ["grants-ops", "grants-compliance", "grants-management"], nexus: "the file is complete and the compliance box is checked — expenditure responsibility, data integrity, terms met" },
  { key: "impact-measurement", label: "Impact Modeling & Measurement", groups: ["impact-measurement", "impact-modeling"], nexus: "the outcome numbers the North Star model needs — complete, current, on the right model version" },
  { key: "impact-director", label: "Director of Impact", groups: ["impact", "impact-director"], nexus: "where our evidence is strong and where it's thin; which theses to keep, deepen, or drop" },
  { key: "impact-advisory", label: "Impact Advisory Services", groups: ["impact-advisory", "advisory"], nexus: "benchmarks and case patterns for an external peer-foundation client — never a confidential grantee detail" },
  { key: "partnerships", label: "Partnerships / Donor Relations", groups: ["partnerships", "donor-engagement", "development"], nexus: "who co-funds what; the strongest evidenced pipeline a donor could join; relationship state" },
  { key: "finance", label: "Finance (CFO / Controller)", groups: ["finance", "accounting"], nexus: "commitments vs. disbursements by fund; the 5% payout; co-funder terms that change our reporting" },
  { key: "legal", label: "Legal / Counsel", groups: ["legal", "counsel"], nexus: "which grants carry confidentiality or data-use clauses; what may be reused; the sensitivity scheme" },
  { key: "people-hr", label: "People / HR", groups: ["people", "hr"], nexus: "rarely a grant-knowledge user; compensation and personnel are Restricted and out of scope" },
  { key: "comms", label: "Communications & Marketing", groups: ["comms", "communications", "marketing"], nexus: "results that are strong, cited, and cleared for external use; a grantee story for the impact report" },
  { key: "exec-assistant", label: "Executive Assistant", groups: ["exec-assistant", "ea"], nexus: "the right materials in front of a principal before a meeting with a grantee, co-funder, or the board" },
  { key: "board", label: "Board member", groups: ["board", "trustee"], nexus: "portfolio-level health and the big bets; governance and compensation are handled outside Compass" },
];

export function functionsForGroups(groups: string[]): FunctionKey[] {
  const g = new Set(groups.map((x) => x.toLowerCase()));
  const hits = FUNCTIONS.filter((f) => f.groups.some((x) => g.has(x))).map((f) => f.key);
  return hits.length ? hits : ["programs"];
}

// ---------------------------------------------------------------------------
// The Foundation calendar — Feb 1 – Jan 31 fiscal year.

export const CALENDAR = {
  fiscalYearStartMonth: 2, // February
  /** approximate windows by fiscal quarter; a real deployment reads exact dates from a config */
  seasons: {
    "impact-report-season": [3, 4], // Q3–Q4 data collection + drafting; the FY impact report publishes in spring
    "board-prep": [1, 2, 3, 4], // roughly quarterly board meetings — refined by real board_dates
    "audit-season": [1], // Q1 (Feb–Apr) — post-close financial audit + 990-PF
    "planning": [3, 4], // Q3–Q4 — budget and multi-year strategy
    "rfp-open": [2, 3], // fund open calls (e.g. the AI for Economic Opportunity Fund runs annual rounds)
    "rfp-review": [3, 4], // two-stage review of the round's applications
    "payout-check": [4], // Q4 — confirm the ~5% minimum distribution is met before year-end
    "renewal-window": [], // added dynamically when a grant is within ~90 days of term end
  } as Record<string, number[]>,
};

export function fiscalQuarter(d = new Date()): number {
  const m = d.getUTCMonth() + 1;
  const offset = (m - CALENDAR.fiscalYearStartMonth + 12) % 12;
  return Math.floor(offset / 3) + 1;
}
export function fiscalYearLabel(d = new Date()): string {
  const y = d.getUTCFullYear();
  const started = d.getUTCMonth() + 1 >= CALENDAR.fiscalYearStartMonth;
  return `FY${String((started ? y + 1 : y) % 100)}`;
}
export function currentSeasons(d = new Date()): string[] {
  const q = fiscalQuarter(d);
  return Object.entries(CALENDAR.seasons)
    .filter(([, quarters]) => quarters.includes(q))
    .map(([s]) => s);
}

// ---------------------------------------------------------------------------
// The grant lifecycle — the windows that create deadlines someone at the Foundation
// is tracking. Two-stage application; 1-year, 2-year, or multi-year terms; reporting on
// a cadence; a renewal window; close-out with expenditure-responsibility documentation.

export interface LifecycleStage {
  key: string;
  label: string;
  /** who is watching this window most closely */
  owners: FunctionKey[];
  /** what someone asks Compass around this window */
  ask: string;
}

export const GRANT_LIFECYCLE: LifecycleStage[] = [
  { key: "rfp-open", label: "Fund open call / LOI window", owners: ["programs", "program-ops"], ask: "What have we funded before in this thesis, and what did we learn — so we can shape the round?" },
  { key: "stage-1", label: "Stage 1 review (LOI screen)", owners: ["programs", "impact-director"], ask: "Have we seen this approach or this org before? Any prior concerns on file?" },
  { key: "stage-2-diligence", label: "Stage 2 due diligence", owners: ["programs", "impact-measurement", "legal"], ask: "Does the projected earnings effect have an attribution problem? Any confidentiality clauses to flag?" },
  { key: "award", label: "Award & agreement", owners: ["grants-compliance", "finance", "legal"], ask: "What terms did we agree — reporting cadence, payment schedule, co-funder conditions?" },
  { key: "reporting", label: "Progress reporting (annual or interim)", owners: ["programs", "program-ops", "impact-measurement"], ask: "What did they report vs. what they projected, and is anything missing the model needs?" },
  { key: "renewal-window", label: "Renewal window (~90 days before term end)", owners: ["programs", "impact-director", "partnerships"], ask: "How did this grant perform against plan, what did the PO flag, and is there a re-application deadline?" },
  { key: "closeout", label: "Close-out & expenditure responsibility", owners: ["grants-compliance", "finance"], ask: "Is the final report in, are ER documentation and the last payment reconciled, is the file complete?" },
  { key: "post-grant", label: "Post-grant learning", owners: ["impact-director", "comms"], ask: "What did this grant teach the thesis, and is any result cleared for external use?" },
];

/** Given a term length, the reporting deadlines a 1-year vs multi-year grant carries. */
export function reportingCadence(termYears: number): string {
  if (termYears <= 1) return "one interim check-in (~6 months) + a final report at close";
  if (termYears === 2) return "an annual progress report each year + a final report at close";
  return `an annual progress report for each of ${termYears} years + a final report; mid-grant renewal conversations start ~90 days before year ${termYears} ends`;
}

// ---------------------------------------------------------------------------
// The question library — what each function asks, and when it spikes.

export interface LibEntry {
  id: string;
  fn: FunctionKey;
  /** seasons / lifecycle windows in which this spikes; empty = always relevant */
  seasons: string[];
  suggest: string;
  ambiguousTrigger?: RegExp;
  interpretation?: string;
}

export const QUESTION_LIBRARY: LibEntry[] = [
  // CEO — narrative and bets
  { id: "ceo.state", fn: "ceo", seasons: ["board-prep", "planning"], suggest: "One paragraph: the state of the portfolio this quarter — biggest wins, biggest risks.", ambiguousTrigger: /how are we doing|state of (the )?portfolio|where do we stand/i, interpretation: "Read as: a portfolio-level summary — wins, risks, and what changed since last quarter." },
  { id: "ceo.bet", fn: "ceo", seasons: ["planning", "rfp-open"], suggest: "Across five years, which thesis has the strongest evidence for our next big bet?" },
  { id: "ceo.board-narrative", fn: "ceo", seasons: ["board-prep"], suggest: "What are the three grantee stories that best carry the board narrative this cycle?" },
  // COO — operations and process
  { id: "coo.bottleneck", fn: "coo", seasons: [], suggest: "Where in the grant lifecycle are things getting stuck this quarter — applications, reporting, close-out?", ambiguousTrigger: /how are we doing|bottleneck|where are we stuck/i, interpretation: "Read as: process health across the lifecycle — where items are aging or overdue." },
  { id: "coo.overdue", fn: "coo", seasons: [], suggest: "What is overdue across the whole portfolio, and who owns chasing each item?" },
  { id: "coo.advisory-load", fn: "coo", seasons: [], suggest: "How much of the team's time is going to impact-advisory client work vs. our own grantmaking?" },
  // Program Officer
  { id: "po.perf", fn: "programs", seasons: ["renewal-window", "board-prep"], suggest: "How did {grantee} perform against what they projected, and what did the PO flag?", ambiguousTrigger: /how (are|is) (we|things|it|they) (doing|going)|where do we stand/i, interpretation: "Read as: performance vs. projection across your active grants, flagging reports due this quarter." },
  { id: "po.renewals", fn: "programs", seasons: ["renewal-window"], suggest: "Which of your grants have a renewal window or re-application deadline in the next 90 days?" },
  { id: "po.reports-due", fn: "programs", seasons: ["reporting"], suggest: "Which of your grants have a progress report due or overdue this quarter?" },
  { id: "po.priorart", fn: "programs", seasons: ["rfp-open", "stage-1"], suggest: "Have we funded anything like this before, and what did we learn — including from applicants we declined?" },
  { id: "po.attribution", fn: "programs", seasons: ["stage-2-diligence"], suggest: "For {grantee}, is there an attribution risk — a concurrent program in the same region?" },
  { id: "po.cofunder", fn: "programs", seasons: [], suggest: "Who is co-funding {grantee}, and what do the co-funder terms require of us?" },
  // Program Associate / Coordinator
  { id: "pa.deadlines", fn: "program-ops", seasons: ["reporting", "rfp-review"], suggest: "What's due in the next 30 days across the portfolio — reports, payments, applications to process?" },
  { id: "pa.grantee-q", fn: "program-ops", seasons: [], suggest: "What are {grantee}'s reporting requirements and the exact due dates?" },
  { id: "pa.incomplete", fn: "program-ops", seasons: ["closeout"], suggest: "Which grants are missing a document their requirement schedule says should exist?" },
  // Grants Manager — compliance
  { id: "gm.er", fn: "grants-compliance", seasons: ["audit-season", "closeout"], suggest: "Which grants require expenditure-responsibility documentation, and which is outstanding?" },
  { id: "gm.integrity", fn: "grants-compliance", seasons: [], suggest: "Where does the same grant fact live in two systems with different values?" },
  { id: "gm.terms", fn: "grants-compliance", seasons: ["award"], suggest: "Which active grants have non-standard terms — a reporting condition, a milestone payment, a data-use clause?" },
  // Impact Modeling & Measurement
  { id: "im.gaps", fn: "impact-measurement", seasons: ["impact-report-season"], suggest: "Which grantees are missing the outcome fields the North Star model needs for the FY report?", ambiguousTrigger: /outcome data|model inputs|how are we doing|where do we stand/i, interpretation: "Read as: outcome-data completeness for the current FY reporting cohort." },
  { id: "im.vintage", fn: "impact-measurement", seasons: ["impact-report-season", "planning"], suggest: "Which grants still report on an older North Star model version and need re-basing?" },
  { id: "im.conflict", fn: "impact-measurement", seasons: [], suggest: "Where do a grantee's narrative results and their structured GivingData numbers disagree?" },
  { id: "im.cohort", fn: "impact-measurement", seasons: ["impact-report-season"], suggest: "Reconcile projected vs. reported participants and earnings across the {fund} cohort." },
  // Director of Impact
  { id: "id.evidence", fn: "impact-director", seasons: ["planning"], suggest: "Across five years, which thesis areas have the strongest evidence and which are thin?" },
  { id: "id.divergence", fn: "impact-director", seasons: ["board-prep"], suggest: "Which grantees' reported outcomes diverge most from what they projected, and why?" },
  { id: "id.declines", fn: "impact-director", seasons: ["rfp-review"], suggest: "What patterns show up in the reasons we've declined applicants in this thesis?" },
  // Impact Advisory (external clients)
  { id: "ia.benchmark", fn: "impact-advisory", seasons: [], suggest: "What benchmark ranges can we share with a client for a workforce-training intervention — no confidential grantee detail?", ambiguousTrigger: /for a client|benchmark|comparable/i, interpretation: "Read as: aggregate, externally-shareable benchmark patterns only — individual grantee records are excluded from this view." },
  { id: "ia.casepattern", fn: "impact-advisory", seasons: [], suggest: "What case patterns exist for AI-for-benefits-access outcomes, stated at a level safe to share externally?" },
  // Partnerships / Donor Relations
  { id: "pt.pipeline", fn: "partnerships", seasons: [], suggest: "What's the pipeline of high-SROI projects a donor could co-fund in {thesis}?", ambiguousTrigger: /for a donor|to show a funder|co-fund/i, interpretation: "Read as: the strongest externally-shareable, co-fundable opportunities right now (shareable tier only)." },
  { id: "pt.cofunders", fn: "partnerships", seasons: [], suggest: "Which co-funders are active in {thesis}, and what have we co-funded with them before?" },
  { id: "pt.relationship", fn: "partnerships", seasons: [], suggest: "What's the relationship state with {grantee} — last touchpoint, who owns it, any open threads?" },
  // Finance
  { id: "fi.commitments", fn: "finance", seasons: ["planning", "audit-season"], suggest: "Commitments vs. disbursements by fund this fiscal year — where are we against plan?", ambiguousTrigger: /how are we doing|where do we stand|against plan/i, interpretation: "Read as: grant commitments booked vs. dollars actually disbursed, by fund, this FY." },
  { id: "fi.payout", fn: "finance", seasons: ["payout-check"], suggest: "Are we on track to meet the minimum distribution requirement before year-end?" },
  { id: "fi.schedule", fn: "finance", seasons: [], suggest: "Which grants have payments scheduled but not yet paid this quarter?" },
  { id: "fi.cofunder-terms", fn: "finance", seasons: ["audit-season"], suggest: "Which grants have co-funder terms that affect how or when we report or disburse?" },
  // Legal
  { id: "lg.clauses", fn: "legal", seasons: ["stage-2-diligence", "award"], suggest: "Which grants carry confidentiality or data-use clauses that limit secondary use of what the grantee submitted?" },
  { id: "lg.crossborder", fn: "legal", seasons: [], suggest: "Which grantee reports from Colombia or Kenya contain personal data, and how is it being handled?" },
  // Comms
  { id: "cm.cleared", fn: "comms", seasons: ["impact-report-season"], suggest: "Which grantee results are strong, cited, and cleared for external use?" },
  { id: "cm.consistency", fn: "comms", seasons: [], suggest: "Does what we've said publicly about {grantee} still match their latest reported numbers?" },
  // Executive Assistant
  { id: "ea.prep", fn: "exec-assistant", seasons: [], suggest: "Pull the materials the CEO needs for the meeting with {grantee} — latest report, open items, relationship history." },
  // Board
  { id: "bd.health", fn: "board", seasons: ["board-prep"], suggest: "Portfolio health: how many grants are above vs. below their ROI threshold this FY, and which are off-track?", ambiguousTrigger: /how are we doing|portfolio health|where do we stand/i, interpretation: "Read as: portfolio health — count above / below the ROI threshold, list off-track grants." },
  { id: "bd.thesis", fn: "board", seasons: ["planning"], suggest: "How is each thesis area performing against the North Star target?" },
];

// ---------------------------------------------------------------------------

/** 2–3 in-season suggestions for a set of functions. */
export function suggestedQuestions(fns: FunctionKey[], seasons: string[], grantee?: string): string[] {
  const inFn = QUESTION_LIBRARY.filter((e) => fns.includes(e.fn));
  const inSeason = inFn.filter((e) => e.seasons.length === 0 || e.seasons.some((s) => seasons.includes(s)));
  const pool = inSeason.length >= 2 ? inSeason : inFn;
  return pool.slice(0, 3).map((e) => e.suggest.replace("{grantee}", grantee ?? "this grantee").replace("{thesis}", "this thesis").replace("{fund}", "this fund"));
}

/** If the query is ambiguous, the reading Compass applies for this function/season. */
export function interpretQuery(query: string, fns: FunctionKey[], seasons: string[]): string | null {
  for (const e of QUESTION_LIBRARY) {
    if (!e.ambiguousTrigger || !e.interpretation) continue;
    if (!fns.includes(e.fn)) continue;
    if (e.seasons.length && !e.seasons.some((s) => seasons.includes(s))) continue;
    if (e.ambiguousTrigger.test(query)) return e.interpretation;
  }
  return null;
}
