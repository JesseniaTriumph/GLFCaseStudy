/**
 * Role & cycle context — see docs/ROLE_AND_CYCLE_CONTEXT.md.
 *
 * NOT a permission gate. This is relevance logic: which questions a function tends to
 * bring to grant knowledge, and how that shifts by season. Toggleable, off by default.
 * The permission filter (retrieval/search.ts) is upstream and never touches this.
 */

export type FunctionKey =
  | "executive"
  | "programs"
  | "donor-engagement"
  | "impact"
  | "impact-advisory"
  | "finance-ops"
  | "comms"
  | "innovation";

export interface FnDef {
  key: FunctionKey;
  label: string;
  /** Google-group ids that map to this function (a person can carry several) */
  groups: string[];
}

export const FUNCTIONS: FnDef[] = [
  { key: "executive", label: "Executive & governance", groups: ["executive", "leadership"] },
  { key: "programs", label: "Programs & Partnerships", groups: ["programs", "partnerships"] },
  { key: "donor-engagement", label: "Collaborative capital / donor engagement", groups: ["donor-engagement", "eir"] },
  { key: "impact", label: "Impact", groups: ["impact"] },
  { key: "impact-advisory", label: "Impact advisory", groups: ["impact-advisory", "advisory"] },
  { key: "finance-ops", label: "Finance & Grants Operations", groups: ["finance", "grants-ops", "ops"] },
  { key: "comms", label: "Communications", groups: ["comms"] },
  { key: "innovation", label: "Innovation (Applied AI / EIR)", groups: ["innovation", "product"] },
];

export function functionsForGroups(groups: string[]): FunctionKey[] {
  const g = new Set(groups.map((x) => x.toLowerCase()));
  const hits = FUNCTIONS.filter((f) => f.groups.some((x) => g.has(x))).map((f) => f.key);
  return hits.length ? hits : ["programs"];
}

// ---------------------------------------------------------------------------
// Calendar — GitLab-style fiscal year: Feb 1 – Jan 31.

export const CALENDAR = {
  fiscalYearStartMonth: 2, // February
  /** approximate windows, by fiscal quarter — a real config is admin-maintained */
  seasons: {
    "impact-report-season": [4], // Q4 (Nov–Jan) production; publishes ~May
    "board-prep": [1, 2, 3, 4], // roughly quarterly — refined by board_dates in prod
    "audit-season": [1], // Q1 (Feb–Apr) post-close
    "planning": [3, 4], // Q3–Q4 budget + 3-year plan
    "rfp-review": [2, 3], // typical open-RFP review windows
  } as Record<string, number[]>,
};

/** Fiscal quarter 1–4 for a date, given a Feb-start year. */
export function fiscalQuarter(d = new Date()): number {
  const m = d.getUTCMonth() + 1; // 1–12
  const offset = (m - CALENDAR.fiscalYearStartMonth + 12) % 12; // 0–11 from FY start
  return Math.floor(offset / 3) + 1;
}

/** Active seasons for a date. `renewal-window` is added by the caller when a grant is near term end. */
export function currentSeasons(d = new Date()): string[] {
  const q = fiscalQuarter(d);
  return Object.entries(CALENDAR.seasons)
    .filter(([, quarters]) => quarters.includes(q))
    .map(([s]) => s);
}

// ---------------------------------------------------------------------------
// The question library.

export interface LibEntry {
  id: string;
  fn: FunctionKey;
  /** seasons in which this question spikes; empty = always relevant */
  seasons: string[];
  /** the suggested-question text ({grantee} filled when there is a clear focus org) */
  suggest: string;
  /** regex that marks an ambiguous query this entry can sharpen */
  ambiguousTrigger?: RegExp;
  /** the reading Compass applies + what it says in the coverage line */
  interpretation?: string;
}

export const QUESTION_LIBRARY: LibEntry[] = [
  {
    id: "po.renewal.performance",
    fn: "programs",
    seasons: ["renewal-window", "board-prep"],
    suggest: "How did {grantee} perform against what they projected, and what did we flag?",
    ambiguousTrigger: /how (are|is) (we|things|it) (doing|going)|where do we stand/i,
    interpretation: "Read as: performance vs. projection across your active grants, flagging reports due this quarter.",
  },
  { id: "po.renewals.due", fn: "programs", seasons: ["renewal-window"], suggest: "Which of your grants have renewals in the next 60 days?" },
  { id: "po.reports.due", fn: "programs", seasons: [], suggest: "Which of your grants have reports due or overdue this quarter?" },
  { id: "po.sourcing.priorart", fn: "programs", seasons: ["rfp-review"], suggest: "Have we ever funded anything in this space, and what did we learn?" },
  {
    id: "impact.report.gaps",
    fn: "impact",
    seasons: ["impact-report-season"],
    suggest: "Which grantees are missing the outcome fields the model needs for the FY report?",
    ambiguousTrigger: /how (are|is) (we|things|it) (doing|going)|outcome data|where do we stand/i,
    interpretation: "Read as: outcome-data completeness for the current FY reporting cohort.",
  },
  { id: "impact.model.vintage", fn: "impact", seasons: ["impact-report-season"], suggest: "Which grants still report on an older North Star model version and need re-basing?" },
  { id: "impact.conflict", fn: "impact", seasons: [], suggest: "Where do a grantee's narrative results and their GivingData numbers disagree?" },
  {
    id: "exec.portfolio.health",
    fn: "executive",
    seasons: ["board-prep", "planning"],
    suggest: "Portfolio health: how many grants are above vs. below their ROI threshold this FY, and which are off-track?",
    ambiguousTrigger: /how (are|is) (we|things|it) (doing|going)|portfolio health|where do we stand/i,
    interpretation: "Read as: portfolio health — count above / below the ROI threshold, list off-track grants.",
  },
  { id: "exec.thesis.evidence", fn: "executive", seasons: ["planning"], suggest: "Across five years, which thesis areas have the strongest evidence and which are thin?" },
  {
    id: "donor.sroi.story",
    fn: "donor-engagement",
    seasons: [],
    suggest: "Which active grants have the strongest, best-evidenced SROI story cleared for external use?",
    ambiguousTrigger: /how (are|is) (we|things|it) (doing|going)|for a donor|to show a funder/i,
    interpretation: "Read as: the strongest externally-shareable outcome stories right now (shareable tier only).",
  },
  { id: "donor.pipeline", fn: "donor-engagement", seasons: [], suggest: "What's the pipeline of high-SROI projects a donor could co-fund in this thesis area?" },
  {
    id: "finance.payments",
    fn: "finance-ops",
    seasons: [],
    suggest: "Which grants have payments scheduled but not yet paid this quarter?",
    ambiguousTrigger: /how (are|is) (we|things|it) (doing|going)|where do we stand/i,
    interpretation: "Read as: payments scheduled vs. paid this quarter.",
  },
  { id: "finance.expresp", fn: "finance-ops", seasons: ["audit-season"], suggest: "Which grants require expenditure-responsibility documentation, and which are outstanding?" },
  { id: "ops.overdue", fn: "finance-ops", seasons: [], suggest: "What's overdue across the whole portfolio, and who owns chasing it?" },
  { id: "comms.shareable", fn: "comms", seasons: ["impact-report-season"], suggest: "Which grantee results are strong, cited, and cleared for external use?" },
  { id: "innovation.friction", fn: "innovation", seasons: [], suggest: "Where does the same fact live in multiple systems with different values?" },
];

// ---------------------------------------------------------------------------

/** 2–3 in-season suggestions for a function. */
export function suggestedQuestions(fns: FunctionKey[], seasons: string[], grantee?: string): string[] {
  const inFn = QUESTION_LIBRARY.filter((e) => fns.includes(e.fn));
  const inSeason = inFn.filter((e) => e.seasons.length === 0 || e.seasons.some((s) => seasons.includes(s)));
  const pool = inSeason.length >= 2 ? inSeason : inFn;
  return pool.slice(0, 3).map((e) => e.suggest.replace("{grantee}", grantee ?? "this grantee"));
}

/** If the query is ambiguous, return the reading Compass applies for this function/season. */
export function interpretQuery(query: string, fns: FunctionKey[], seasons: string[]): string | null {
  for (const e of QUESTION_LIBRARY) {
    if (!e.ambiguousTrigger || !e.interpretation) continue;
    if (!fns.includes(e.fn)) continue;
    if (e.seasons.length && !e.seasons.some((s) => seasons.includes(s))) continue;
    if (e.ambiguousTrigger.test(query)) return e.interpretation;
  }
  return null;
}
