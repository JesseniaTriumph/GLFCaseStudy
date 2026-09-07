/**
 * Per-grant cycle logic — see docs/ROLES_AND_USERS.md § the grant lifecycle.
 *
 * Reporting does NOT come in at the same time for everyone. Each grant has its OWN cadence
 * (quarterly / semi-annual / annual / biennial / final-only), its own term length (1 to 5
 * years), its own end date, and therefore its own renewal window and re-application
 * deadline. One grant can end in November and need a renewal LOI in August; another can
 * end two years out and need one in February. This module reads a single grant's
 * requirement schedule + dates and says where that grant is in its cycle *today*.
 *
 * It feeds the Deep-dive panel and the role/cycle suggestions — never the permission
 * filter. Modelled on the DASH / HOPE grant-tracker: reporting_frequency +
 * report_period_basis + per-requirement due dates.
 */

export interface GrantRequirement {
  type: string;
  dueDate: string; // ISO
  status: string; // "Received" | "Overdue" | "Not yet due" | "Declined to renew" | "n/a" | ...
  submittedDocId?: string;
}

export interface GrantCycleInput {
  grantId: string;
  organization?: string;
  startDate?: string | null;
  endDate?: string | null;
  termYears?: number | null;
  reportingFrequency?: string | null;
  reportPeriodBasis?: string | null;
  status?: string | null;
  requirements?: GrantRequirement[];
}

export interface GrantCycle {
  grantId: string;
  organization?: string;
  reportingFrequency: string;
  /** "recorded" = read from a GivingData field; "inferred" = derived from the schedule spacing */
  reportingFrequencyBasis: "recorded" | "inferred";
  reportPeriodBasis: string;
  termYears: number | null;
  /** where the grant is now */
  stage: "pre-award" | "active" | "renewal-window" | "closing" | "closed";
  /** the soonest requirement not yet met */
  nextDeadline: { type: string; dueDate: string; inDays: number } | null;
  /** requirements past due and not received */
  overdue: Array<{ type: string; dueDate: string; overdueByDays: number }>;
  /** true when within `renewalLeadDays` of the end date */
  inRenewalWindow: boolean;
  /** the renewal / re-application deadline, if the schedule carries one */
  renewalDeadline: { dueDate: string; inDays: number; status: string } | null;
  /** a one-line human summary for the Deep-dive panel */
  summary: string;
}

const DAY = 86_400_000;
const days = (fromISO: string, to: Date) => Math.round((new Date(fromISO).getTime() - to.getTime()) / DAY);

/**
 * Infer the reporting cadence from the spacing of the progress-report requirements when
 * GivingData has no explicit `reporting_frequency` field. The median gap between
 * consecutive report due dates → quarterly / semi-annual / annual / biennial. This is how
 * Compass "assesses" cadence when it isn't recorded — and it says so ("inferred from N
 * requirements", never presented as authoritative).
 */
export function inferCadence(requirements: GrantRequirement[]): { frequency: string; basis: "recorded" | "inferred"; from: number } {
  const reports = requirements
    .filter((r) => /report|check-?in|update/i.test(r.type) && !/final|proposal|renewal/i.test(r.type))
    .map((r) => new Date(r.dueDate).getTime())
    .sort((a, b) => a - b);
  if (reports.length < 2) return { frequency: "final-only", basis: "inferred", from: reports.length };
  const gaps = reports.slice(1).map((t, i) => (t - reports[i]!) / DAY);
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)]!;
  const frequency =
    median <= 130 ? "quarterly" : median <= 240 ? "semi-annual" : median <= 460 ? "annual" : "biennial";
  return { frequency, basis: "inferred", from: reports.length };
}

/** Read one grant's cycle relative to `today` (defaults to now). */
export function grantCycle(g: GrantCycleInput, today = new Date(), renewalLeadDays = 120): GrantCycle {
  const reqs = (g.requirements ?? []).slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const met = (s: string) => /received|n\/a|declined to renew|approved|waived/i.test(s);

  const overdue = reqs
    .filter((r) => !met(r.status) && new Date(r.dueDate) < today)
    .map((r) => ({ type: r.type, dueDate: r.dueDate, overdueByDays: -days(r.dueDate, today) }));

  const upcoming = reqs
    .filter((r) => !met(r.status) && new Date(r.dueDate) >= today)
    .map((r) => ({ type: r.type, dueDate: r.dueDate, inDays: days(r.dueDate, today) }))
    .sort((a, b) => a.inDays - b.inDays);
  const nextDeadline = upcoming[0] ?? null;

  const end = g.endDate ? new Date(g.endDate) : null;
  const start = g.startDate ? new Date(g.startDate) : null;
  const toEnd = end ? days(g.endDate!, today) : null;
  const inRenewalWindow = toEnd != null && toEnd <= renewalLeadDays && toEnd > -60;

  const renewalReq = reqs.find((r) => /renewal|re-?application|continuation/i.test(r.type));
  const renewalDeadline = renewalReq
    ? { dueDate: renewalReq.dueDate, inDays: days(renewalReq.dueDate, today), status: renewalReq.status }
    : null;

  let stage: GrantCycle["stage"] = "active";
  if (start && start > today) stage = "pre-award";
  else if (toEnd != null && toEnd < -60) stage = "closed";
  else if (toEnd != null && toEnd <= 60) stage = "closing"; // within 60 days either side of term end
  else if (inRenewalWindow) stage = "renewal-window";

  // cadence: use GivingData's recorded field if present, else infer it from the schedule
  const inferred = inferCadence(reqs);
  const freq = g.reportingFrequency ?? inferred.frequency;
  const freqBasis: "recorded" | "inferred" = g.reportingFrequency ? "recorded" : "inferred";
  const basis = g.reportPeriodBasis ?? "grant-year (assumed — not recorded)";

  const parts: string[] = [
    `${freq} reporting${freqBasis === "inferred" ? ` (inferred from ${inferred.from} requirement${inferred.from === 1 ? "" : "s"})` : ""}${g.termYears ? `, ${g.termYears}-year term` : ""}`,
  ];
  if (overdue.length) parts.push(`${overdue.length} report(s) overdue (oldest by ${overdue[0]!.overdueByDays}d)`);
  if (nextDeadline) parts.push(`next: ${nextDeadline.type} in ${nextDeadline.inDays}d (${nextDeadline.dueDate})`);
  if (renewalDeadline && renewalDeadline.inDays > -30)
    parts.push(
      renewalDeadline.inDays >= 0
        ? `renewal LOI due in ${renewalDeadline.inDays}d (${renewalDeadline.dueDate})`
        : `renewal LOI window passed — ${renewalDeadline.status}`
    );
  else if (inRenewalWindow && toEnd != null)
    parts.push(toEnd >= 0 ? `in the renewal window — term ends in ${toEnd}d` : `term just ended — renewal decision pending`);

  return {
    grantId: g.grantId,
    organization: g.organization,
    reportingFrequency: freq,
    reportingFrequencyBasis: freqBasis,
    reportPeriodBasis: basis,
    termYears: g.termYears ?? null,
    stage,
    nextDeadline,
    overdue,
    inRenewalWindow,
    renewalDeadline,
    summary: parts.join(" · "),
  };
}

/** Across a set of grant cycles: what's due in the next `windowDays` and what's overdue. */
export function portfolioDeadlines(cycles: GrantCycle[], windowDays = 30) {
  const dueSoon = cycles
    .filter((c) => c.nextDeadline && c.nextDeadline.inDays <= windowDays)
    .map((c) => ({ grant: c.grantId, org: c.organization, ...c.nextDeadline! }))
    .sort((a, b) => a.inDays - b.inDays);
  const overdue = cycles
    .flatMap((c) => c.overdue.map((o) => ({ grant: c.grantId, org: c.organization, ...o })))
    .sort((a, b) => b.overdueByDays - a.overdueByDays);
  const renewals = cycles
    .filter((c) => c.inRenewalWindow || (c.renewalDeadline && c.renewalDeadline.inDays >= 0 && c.renewalDeadline.inDays <= 120))
    .map((c) => ({ grant: c.grantId, org: c.organization, endsOrDue: c.renewalDeadline?.dueDate, inDays: c.renewalDeadline?.inDays }));
  return { dueSoon, overdue, renewals };
}
