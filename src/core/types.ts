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
  /** sparse tf-idf vector: term -> weight, for the semantic-ish signal */
  vector: Record<string, number>;
  /**
   * Metadata-only stub for an excluded (restricted) document: the index knows a doc on
   * this topic EXISTS but holds none of its content. Lets retrieval report an honest
   * "matching content is restricted" without the content ever being retrievable.
   */
  restrictedStub?: boolean;
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
}

export interface CorpusIndex {
  builtAt: string;
  corpusLabel: string;
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
 * "Ask better" output — surfaced beside the answer, not inside it. Toggleable.
 * Tells the user what would sharpen the answer, who to ask, what to ask, and drafts an email.
 */
export interface FollowUps {
  gaps: string[];
  whoToAsk: { person: IndexPerson; why: string }[];
  suggestedQuestions: string[];
  draftEmail: { to: string; toName: string; subject: string; body: string } | null;
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
  /** human-readable position within the source, e.g. "§ Wage outcomes", "p. 3", "field: Median wage" */
  locator: string | null;
  docTitle: string;
  ref: string;
  snippet: string;
  /** the exact text to highlight at the destination */
  highlight: string;
  tier: Tier;
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
  /** optional "ask better" suggestions — present when requested and the feature is on */
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
