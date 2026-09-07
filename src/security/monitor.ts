/**
 * Monitoring hooks — anomaly signals over the audit stream (strategy doc §6.11;
 * security review MONITOR phase: "alerting / thresholds / baselines not implemented").
 *
 * This is the detection layer. It does not block anything (that is the rate limiter and the
 * permission filter); it watches the same `AuditEvent`s that are already being written and
 * raises a `Signal` when a pattern crosses a threshold. In production these signals go to
 * the on-call channel and the SIEM; here `observe()` returns them so a test can assert on
 * them and `serve.ts` can log them.
 *
 * Every signal maps to a specific incident-response playbook in G_Security_Review.md.
 */
import type { AuditEvent } from "./audit.js";

export type SignalKind =
  | "restricted-probing" // one user repeatedly hitting refusals on restricted material
  | "auth-brute" // repeated denied auth for the same user
  | "cost-spike" // query volume for one user well above their own baseline
  | "broad-sweep" // many distinct low-confidence queries in a short window (scraping)
  | "withheld-surge"; // sudden rise in withheld-passage counts (probing the ACL boundary)

export interface Signal {
  kind: SignalKind;
  user: string;
  detail: string;
  count: number;
  /** which IR playbook to run */
  playbook: string;
  severity: "low" | "medium" | "high";
}

export interface MonitorConfig {
  windowMs: number;
  restrictedRefusals: number; // refusals citing restricted, per window, per user
  authDenials: number;
  sweepQueries: number; // distinct low-confidence queries per window
  costMultiple: number; // × the user's rolling baseline
  now?: () => number;
}

export const DEFAULT_MONITOR: MonitorConfig = {
  windowMs: 5 * 60_000,
  restrictedRefusals: 3,
  authDenials: 5,
  sweepQueries: 15,
  costMultiple: 4,
};

interface Stamp {
  t: number;
  ev: AuditEvent;
}

export class Monitor {
  private events: Stamp[] = [];
  private baseline = new Map<string, number>(); // user → EWMA of queries/window
  private cfg: MonitorConfig;
  private now: () => number;

  constructor(cfg: MonitorConfig = DEFAULT_MONITOR) {
    this.cfg = cfg;
    this.now = cfg.now ?? Date.now;
  }

  /** Feed one audit event; get back any signals it triggers. */
  observe(ev: AuditEvent): Signal[] {
    const t = this.now();
    this.events.push({ t, ev });
    const cutoff = t - this.cfg.windowMs;
    this.events = this.events.filter((s) => s.t >= cutoff);

    const user = "user" in ev ? ev.user : null;
    if (!user) return [];
    const mine = this.events.filter((s) => "user" in s.ev && s.ev.user === user).map((s) => s.ev);
    const out: Signal[] = [];

    // restricted probing
    const restrictedRefusals = mine.filter(
      (e) => e.type === "query" && e.confidence === "refused" && e.withheldTiers.includes("restricted")
    ).length;
    if (restrictedRefusals >= this.cfg.restrictedRefusals) {
      out.push({
        kind: "restricted-probing",
        user,
        detail: `${restrictedRefusals} refusals on Restricted-tier material in ${this.cfg.windowMs / 60000} min`,
        count: restrictedRefusals,
        playbook: "P2 — cross-tier read attempt: review this user's session, confirm no leak, consider a hold",
        severity: "high",
      });
    }

    // auth brute force
    const denials = mine.filter((e) => e.type === "auth" && e.result === "denied").length;
    if (denials >= this.cfg.authDenials) {
      out.push({
        kind: "auth-brute",
        user,
        detail: `${denials} denied auth attempts in ${this.cfg.windowMs / 60000} min`,
        count: denials,
        playbook: "P1 — auth bypass attempt: lock the account, force re-auth, check the IdP logs",
        severity: "high",
      });
    }

    // broad low-confidence sweep (scraping the corpus)
    const lowConf = new Set(
      mine.filter((e) => e.type === "query" && (e.confidence === "low" || e.confidence === "refused")).map((e) => (e as { question: string }).question)
    ).size;
    if (lowConf >= this.cfg.sweepQueries) {
      out.push({
        kind: "broad-sweep",
        user,
        detail: `${lowConf} distinct weak/refused queries in ${this.cfg.windowMs / 60000} min — looks like enumeration`,
        count: lowConf,
        playbook: "P5 — data exfiltration pattern: rate-limit hard, snapshot the queries, notify the data owner",
        severity: "medium",
      });
    }

    // withheld surge — probing the ACL boundary from many angles
    const withheldTotal = mine.reduce((s, e) => s + (e.type === "query" ? e.withheld : 0), 0);
    if (withheldTotal >= this.cfg.sweepQueries * 2) {
      out.push({
        kind: "withheld-surge",
        user,
        detail: `${withheldTotal} passages withheld across this user's recent queries`,
        count: withheldTotal,
        playbook: "P2 — probing the permission boundary: verify the filter held on every request in the window",
        severity: "medium",
      });
    }

    // cost spike vs. the user's own rolling baseline
    const queries = mine.filter((e) => e.type === "query").length;
    const base = this.baseline.get(user) ?? queries;
    if (queries > Math.max(this.cfg.sweepQueries / 3, base * this.cfg.costMultiple)) {
      out.push({
        kind: "cost-spike",
        user,
        detail: `${queries} queries this window vs. baseline ~${base.toFixed(1)}`,
        count: queries,
        playbook: "P7-adjacent — cost anomaly: confirm it's a human, check the rate limiter is engaged, alert finance if sustained",
        severity: "low",
      });
    }
    this.baseline.set(user, base * 0.8 + queries * 0.2);

    return out;
  }
}
