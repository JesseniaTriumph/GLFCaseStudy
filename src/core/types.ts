/**
 * Compass core types.
 *
 * Everything ingested from any source — Drive, GivingData, Airtable, or a future
 * connector — is normalised into a `SourceDoc`. From there the pipeline is source-agnostic:
 * clean -> dedupe -> resolve entities -> chunk -> index -> retrieve -> cite.
 */

/** Sensitivity tiers. The whole permission model hangs off these. */
export type Tier = "team" | "programs-only" | "restricted" | "never-ingest";

/** Which system a document came from. Open-ended on purpose — real engagements find more than four. */
export type SourceSystem =
  | "drive"
  | "givingdata"
  | "airtable"
  | "zoom-chat"
  | "email"
  | "notion"
  | "impact-model"
  | string;

/** A canonical entity the graph resolves documents to. */
export interface EntityRef {
  kind: "grant" | "organization" | "person" | "fund" | "geography" | "thesis-area";
  id: string;
  label: string;
}

/**
 * The canonical envelope. Every adapter emits these and nothing else.
 * `acl` is the list of principals (user ids / group ids) allowed to read the SOURCE.
 * Retrieval filters on this — it is the security boundary, not the UI.
 */
export interface SourceDoc {
  /** Stable id: `${system}:${sourceId}` */
  id: string;
  system: SourceSystem;
  sourceId: string;
  /** Deep link back to the original record — this is what a citation points at. */
  deepLink: string;
  title: string;
  /** Extracted plain text. Structured records are rendered to a readable fact sheet. */
  text: string;
  /** ISO date the underlying content is "as of". */
  date: string | null;
  language: "en" | "es" | "unknown";
  /** 0..1 — how confident we are in the text extraction (OCR etc.). Low -> quarantine. */
  extractionConfidence: number;
  tier: Tier;
  acl: string[];
  /** Entities mentioned/owned by this doc, filled by the resolve step. */
  entities: EntityRef[];
  /** Free-form provenance for debugging and the audit trail. */
  meta: Record<string, unknown>;
}

/** A retrievable unit. Documents are split into these for the index. */
export interface Chunk {
  id: string;
  docId: string;
  system: SourceSystem;
  deepLink: string;
  docTitle: string;
  text: string;
  date: string | null;
  tier: Tier;
  acl: string[];
  entities: EntityRef[];
  /** token list, lowercased, for BM25 */
  tokens: string[];
  /** sparse tf-idf vector: term -> weight, for the semantic-ish signal (always present) */
  vector: Record<string, number>;
  /** dense learned embedding (unit-normalised) — present only on an `--embed` build */
  dense?: number[];
  /**
   * Metadata-only stub for an excluded (restricted) document: the index knows a doc on
   * this topic EXISTS but holds none of its content. Lets retrieval report an honest
   * "matching content is restricted" without the content ever being retrievable.
   */
  restrictedStub?: boolean;
  /** set when this chunk's text is a machine translation; `sourceLang` is the original */
  translated?: boolean;
  sourceLang?: string;
}

export interface DedupeReport {
  totalDocs: number;
  exactDuplicates: number;
  nearDuplicates: number;
  crossSystemLinks: number;
  /** docId -> the docId it was folded into */
  mergedInto: Record<string, string>;
}

export interface GapReport {
  /** grantId -> list of expected-but-missing artifacts */
  missingByGrant: Record<string, string[]>;
  grantsWithNoOrgRecord: string[];
  grantsWithNoProposal: string[];
  untaggedGrants: string[];
  /**
   * What the pipeline itself dropped, and why — separate from permissions (what a user
   * can't see) and from source access limits (what a system won't give us). Lesson from
   * the HOPE dashboard: records filtered out by our own processing were invisible until
   * we counted them. These counts surface in the coverage statement.
   */
  excluded: {
    /** documents whose text extraction (OCR / parse) was too low-confidence to trust */
    lowExtractionConfidence: { count: number; ids: string[] };
    /** documents held out because their sensitivity tier is excluded from the index */
    sensitivityTier: number;
    /** documents dropped as exact or near duplicates of another */
    duplicates: number;
  };
}

export interface GrantMeta {
  organization?: string;
  fund?: string;
  startDate?: string | null;
  endDate?: string | null;
  termYears?: number | null;
  reportingFrequency?: string | null;
  reportPeriodBasis?: string | null;
  grantStatus?: string | null;
  requirements?: { type: string; dueDate: string; status: string; submittedDocId?: string }[];
  projected?: { northStar?: number | null; annualEarningsDelta?: number | null; lifetimeEarningsDelta?: number | null; participants?: number | null; modelVersion?: string } | null;
}

export interface EntityReviewItem {
  kind: "possible-duplicate-org" | "grant-without-org" | "org-without-grant";
  detail: string;
  candidates: string[];
  /** 0–1; lower = more urgent to review */
  confidence: number;
}

export interface BuildManifest {
  builtAt: string;
  /** git commit the pipeline was at, for reproducibility (§6.5) */
  commit: string | null;
  /** items pulled per source */
  sourceCounts: Record<string, number>;
  /** sha256 over all chunk hashes — the index fingerprint */
  contentDigest: string;
}

export interface CorpusIndex {
  builtAt: string;
  corpusLabel: string;
  manifest: BuildManifest;
  /** set when the index was built with learned embeddings — retrieval embeds the query the same way */
  embedder?: { id: string; dims: number };
  chunks: Chunk[];
  /** doc-frequency per term across the corpus, for BM25 + idf */
  df: Record<string, number>;
  docCount: number;
  avgDocLen: number;
  entities: EntityRef[];
  /** people assembled from grant / org / interaction records — powers "who to ask" */
  directory: IndexPerson[];
  dedupe: DedupeReport;
  gaps: GapReport;
  /** low-confidence entity-resolution calls a human should confirm (roadmap 2.3) */
  reviewQueue: EntityReviewItem[];
  /** per-grant schedule metadata (dates, term, reporting cadence, requirements) for cycle logic */
  grantMeta?: Record<string, GrantMeta>;
  /** coverage statement shown on every answer */
  coverage: {
    systems: string[];
    dateRange: [string, string] | null;
    notCovered: string[];
  };
}

/** A person Compass knows about, assembled from grant/org/interaction records. */
export interface IndexPerson {
  name: string;
  role: string;
  email: string | null;
  /** "internal" = Foundation staff, "external" = grantee/partner contact */
  kind: "internal" | "external";
  grantIds: string[];
  orgLabels: string[];
  source: SourceSystem;
}

/**
 * "Deep dive" output — surfaced beside the answer, not inside it. Toggleable.
 * Tells the user what would sharpen the answer, who to ask, what to ask, and drafts an email.
 */
export interface FollowUps {
  gaps: string[];
  whoToAsk: { person: IndexPerson; why: string }[];
  suggestedQuestions: string[];
  draftEmail: { to: string; toName: string; subject: string; body: string } | null;
  /** where each grant in the answer is in its own reporting/renewal cycle (per-grant, not portfolio-wide) */
  cycle?: { grantId: string; organization?: string; stage: string; summary: string }[];
}

export interface Citation {
  n: number;
  system: SourceSystem;
  /**
   * Link to the exact place the passage was found. Where the source is web-viewable and
   * supports it, this carries a highlight fragment (`#:~:text=…` for web docs, a heading /
   * bookmark anchor for Google Docs, a record+field target for Airtable/GivingData) so the
   * user lands on the passage with it highlighted — not just on the record.
   */
  deepLink: string;
  /**
   * Demo only: a same-origin URL that renders the cited document as Compass indexed it,
   * styled like its source system, with this passage highlighted — because the fictional
   * `deepLink` above points nowhere. Set by the server when source-preview is enabled
   * (`ServerDeps.sourcePreview`, default = demo mode). Absent in production, where
   * `deepLink` opens the real record. The UI uses `previewLink ?? deepLink`.
   */
  previewLink?: string;
  /** `${system}:${sourceId}` — the document this passage belongs to */
  docId: string;
  /** human-readable position within the source, e.g. "§ Wage outcomes", "p. 3", "field: Median wage" */
  locator: string | null;
  docTitle: string;
  ref: string;
  snippet: string;
  /** the exact text to highlight at the destination */
  highlight: string;
  tier: Tier;
  /** set when the cited passage was machine-translated from `sourceLang`; the deep-link still points to the original */
  translatedFrom?: string;
}

export interface Answer {
  question: string;
  /** markdown, with [n] markers matching `citations` */
  text: string;
  citations: Citation[];
  confidence: "high" | "medium" | "low" | "refused";
  confidenceReason: string;
  coverage: string;
  withheld: { count: number; reason: string } | null;
  /** which generation path produced this */
  mode: "extractive" | "generative";
  /** optional "deep dive" suggestions — present when requested and the feature is on */
  followUps?: FollowUps;
}

/** The identity making a request. Retrieval filters the corpus to what this principal can see. */
export interface Principal {
  userId: string;
  /** group ids the user belongs to (mirrors source-system groups) */
  groups: string[];
  /** which tiers this principal may retrieve. `restricted` is never in here in v1. */
  allowedTiers: Tier[];
}
