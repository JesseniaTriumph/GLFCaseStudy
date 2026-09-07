/**
 * PII detection + redaction at intake (strategy doc §6.3, §6.12; security review A7).
 *
 * Runs on every document BEFORE it is chunked or indexed. Two jobs:
 *   1. redact obvious direct identifiers in place (emails, phones, SSN/EIN, bank/card, IPs)
 *   2. return findings so the pipeline can raise a document's sensitivity tier when a
 *      report clearly contains named participant data
 *
 * This is a deterministic first pass — pattern-based, no model, no false confidence. In
 * production it is paired with a trained NER model for names and a review queue; here it
 * is the honest baseline that keeps the demo corpus safe and shows the mechanism.
 */

export type PiiKind = "email" | "phone" | "ssn" | "ein" | "card" | "bank" | "ip" | "dob" | "passport";

export interface PiiFinding {
  kind: PiiKind;
  /** the matched text, already partially masked for the finding log */
  sample: string;
  count: number;
}

interface Rule {
  kind: PiiKind;
  re: RegExp;
  /** how to replace a match; keep enough to stay readable */
  redact: (m: string) => string;
  /** confidence this is real PII vs. a false positive (drives tier-raising) */
  weight: number;
}

const last4 = (s: string) => s.replace(/\D/g, "").slice(-4);

const RULES: Rule[] = [
  {
    kind: "email",
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    // keep role/shared addresses (legitimate contact info); redact personal-looking ones,
    // keeping the domain for context
    redact: (m) => {
      const local = m.split("@")[0]!.toLowerCase();
      const role =
        /^(info|hello|contact|team|grants?|partnerships?|hiring|press|media|support|admin|ed|office|inquiries|help|workforce|programs?|development|operations|finance|comms|communications|careers|jobs|apply|recruiting|hr|people|data|tech|it|impact|advisory)$/;
      return role.test(local) ? m : `[email@${m.split("@")[1]}]`;
    },
    weight: 0.3,
  },
  {
    kind: "phone",
    re: /(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g,
    redact: () => "[phone]",
    weight: 0.5,
  },
  {
    kind: "ssn",
    re: /\b\d{3}-\d{2}-\d{4}\b/g,
    redact: () => "[SSN]",
    weight: 1,
  },
  {
    kind: "ein",
    // EIN is XX-XXXXXXX; only flag when it looks like a real one (not the XX placeholders in mock data)
    re: /\b\d{2}-\d{7}\b/g,
    redact: (m) => `[EIN ..${last4(m)}]`,
    weight: 0.6,
  },
  {
    kind: "card",
    re: /\b(?:\d[ -]*?){13,19}\b/g,
    redact: (m) => (/(?:\d[ -]*?){13,19}/.test(m) && luhn(m) ? `[card ..${last4(m)}]` : m),
    weight: 1,
  },
  {
    kind: "bank",
    // keyword, then a token that must contain at least one digit (avoids matching plain words)
    re: /\b(?:account|acct|routing|aba|iban)\b\s*(?:#|no\.?|number)?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{6,20}\b/gi,
    redact: (m) => m.replace(/(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{6,20}\b/i, (n) => `..${n.replace(/\D/g, "").slice(-4)}`),
    weight: 0.9,
  },
  {
    kind: "ip",
    re: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g,
    redact: () => "[ip]",
    weight: 0.2,
  },
  {
    kind: "dob",
    re: /\b(?:DOB|date of birth|born)\s*[:\-]?\s*(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/gi,
    redact: (m) => m.replace(/\d.*/, "[date]"),
    weight: 0.8,
  },
  {
    kind: "passport",
    re: /\b(?:passport|immigration)\s*(?:#|no\.?|number)?\s*[:#]?\s*[A-Z0-9]{6,9}\b/gi,
    redact: (m) => m.replace(/[A-Z0-9]{6,9}\b/i, "[id]"),
    weight: 1,
  },
];

function luhn(s: string): boolean {
  const d = s.replace(/\D/g, "");
  if (d.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export interface PiiResult {
  text: string;
  findings: PiiFinding[];
  /** total weighted PII signal — the pipeline raises the tier above a threshold */
  score: number;
}

/** Redact direct identifiers in `text`; return the cleaned text + findings. */
export function scrubPii(text: string): PiiResult {
  const findings: PiiFinding[] = [];
  let out = text;
  for (const rule of RULES) {
    let count = 0;
    let sample = "";
    out = out.replace(rule.re, (m) => {
      const r = rule.redact(m);
      if (r === m) return m; // rule declined (e.g. failed Luhn) — not counted
      count++;
      if (!sample) sample = m.length > 6 ? m.slice(0, 3) + "…" + m.slice(-2) : "…";
      return r;
    });
    if (count) findings.push({ kind: rule.kind, sample, count });
  }
  const score = findings.reduce((s, f) => s + (RULES.find((r) => r.kind === f.kind)?.weight ?? 0) * Math.min(f.count, 5), 0);
  return { text: out, findings, score };
}

/** Named-participant heuristic: a document that pairs "participant/client/beneficiary" language with names. */
export function looksLikeParticipantData(text: string): boolean {
  const t = text.toLowerCase();
  const role = /(participant|client|beneficiary|enrollee|trainee|jobseeker|program member)s?\b/.test(t);
  const nameNear =
    /(participant|client|beneficiary|enrollee)s?[^.]{0,40}\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(text) ||
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b[^.]{0,20}(is enrolled|completed the program|was placed|reported earnings)/.test(text);
  return role && nameNear;
}
