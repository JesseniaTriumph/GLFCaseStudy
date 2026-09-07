import type { Answer, Citation, CorpusIndex, Principal } from "../core/types.js";
import { retrieve, type Scored, type RetrieveResult } from "./search.js";
import { suggestFollowups } from "./followups.js";
import { currentSeasons, interpretQuery, type FunctionKey } from "../roles.js";

export interface RoleContext {
  /** the asker's function(s) — a relevance signal, never a permission (see docs/ROLE_AND_CYCLE_CONTEXT.md) */
  functions: FunctionKey[];
  /** ISO date; defaults to now */
  today?: string;
}

export interface AnswerOptions {
  /** optional generative backend; if absent, Compass returns an extractive answer */
  llm?: (args: { question: string; passages: { n: number; text: string; source: string }[] }) => Promise<string>;
  k?: number;
  /** "deep dive" suggestions beside the answer — user-toggleable, default on */
  followUps?: boolean;
  /** "role & cycle context" — off unless provided; interprets ambiguous queries + tailors suggestions */
  roleContext?: RoleContext;
  /**
   * Pluggable retriever. Default: the in-memory hybrid search (`./search.ts`). Pass the
   * Postgres-backed one (`src/db/store.ts` → PgStore.retrieve) to run the permission
   * filter as a SQL WHERE clause. Both return the same shape.
   */
  retriever?: (
    index: CorpusIndex,
    question: string,
    principal: Principal,
    k: number,
    queryDense?: number[]
  ) => RetrieveResult | Promise<RetrieveResult>;
}

/**
 * Produce a cited answer. Default path is extractive — the top passages are assembled
 * with [n] citations and an honest confidence + coverage statement. If an `llm` backend
 * is provided (e.g. Claude under a zero-retention agreement), only the retrieved passages
 * plus the question are sent to it — never the whole corpus, never raw source files.
 */
export async function answerQuestion(
  index: CorpusIndex,
  question: string,
  principal: Principal,
  opts: AnswerOptions = {}
): Promise<Answer> {
  // embed the query the same way the index was built, if it uses a learned embedder
  let queryDense: number[] | undefined;
  if (index.embedder) {
    const { getEmbedder } = await import("../embed/embedder.js");
    const e = await getEmbedder(index.embedder.id);
    if (e) queryDense = (await e.embed([question]))[0];
  }

  const { hits, withheld } = await (opts.retriever ?? retrieve)(index, question, principal, opts.k ?? 8, queryDense);

  // Role & cycle context (off unless opts.roleContext is set): if the query is ambiguous,
  // note the reading Compass applied — always disclosed, never a silent scope change.
  const seasons = opts.roleContext ? currentSeasons(opts.roleContext.today ? new Date(opts.roleContext.today) : undefined) : [];
  const reading = opts.roleContext ? interpretQuery(question, opts.roleContext.functions, seasons) : null;

  const coverage = (reading ? `${reading} ` : "") + coverageStatement(index);

  // Refuse when nothing solidly matches — a weak lexical brush is not an answer.
  const topWeak = hits.length > 0 && hits[0]!.bm25 < 1.6 && hits[0]!.semantic < 0.08;
  // The question names a specific person/org, but nothing Compass can see mentions it.
  // Don't hand back a confident-looking brief about adjacent grantees — say so.
  const unknownSubject = unrecognizedNamedSubject(question, index, hits);
  const topBm25 = hits[0]?.bm25 ?? 0;
  // Restricted content dominates when its metadata match is as on-topic as our best real hit.
  const restrictedMatched = withheld.tiers.includes("restricted");
  const restrictedDominates = restrictedMatched && withheld.restrictedTopScore >= topBm25 * 0.7;
  const permissionBlocked = hits.length === 0 && withheld.count > 0;

  if (hits.length === 0 || topWeak || restrictedDominates || unknownSubject) {
    let text: string;
    let reason: string;
    if (restrictedDominates) {
      text =
        `This question would require material in the Restricted tier (board, compensation, legal, or named participant data). ` +
        `That content is not indexed and Compass will not answer from it. If you need it, request it through the COO's office.`;
      reason = "matching topic is Restricted-tier; not indexed";
    } else if (permissionBlocked) {
      text = `${withheld.count} passage(s) match this question but sit outside what you can retrieve in this workspace. I can't answer it here.`;
      reason = "required sources are outside the caller's permission scope";
    } else if (unknownSubject) {
      text =
        `Nothing Compass can see names the person or organization you asked about. ` +
        `If this is a program participant or client, that data is held out of the index by policy. ` +
        `Otherwise the source may not be connected yet. ${coverage}`;
      reason = `named subject not present in any retrievable source`;
    } else {
      text = `I don't have anything in what I can see that solidly answers this. ${coverage}`;
      reason = "no strong match in the corpus";
    }
    return {
      question,
      text,
      citations: [],
      confidence: "refused",
      confidenceReason: reason,
      coverage,
      withheld: withheld.count ? { count: withheld.count, reason: withheld.tiers.join(", ") } : null,
      mode: "extractive",
    };
  }

  const citations = buildCitations(hits);

  let text: string;
  let mode: Answer["mode"] = "extractive";
  if (opts.llm) {
    text = await opts.llm({
      question,
      passages: citations.map((c) => ({ n: c.n, text: hits[c.n - 1]!.chunk.text, source: `${c.system} · ${c.ref}` })),
    });
    mode = "generative";
  } else {
    text = extractiveAnswer(question, hits, citations);
  }

  const confidence = gradeConfidence(hits);
  const followUps =
    opts.followUps === false
      ? undefined
      : suggestFollowups(index, question, hits, withheld, opts.roleContext ? { functions: opts.roleContext.functions, seasons } : undefined);

  return {
    question,
    text,
    citations,
    confidence: confidence.level,
    confidenceReason: confidence.reason,
    coverage,
    withheld: withheld.count ? { count: withheld.count, reason: `${withheld.count} passage(s) withheld — ${withheld.tiers.join(", ")}` } : null,
    mode,
    followUps,
  };
}

function buildCitations(hits: Scored[]): Citation[] {
  return hits.map((h, i) => {
    // drop markdown heading lines before choosing what to land on
    const prose = h.chunk.text
      .split("\n")
      .filter((l) => !/^#+\s/.test(l.trim()))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const clean = h.chunk.text.replace(/\s+/g, " ").trim();
    const highlight = pickHighlight(prose || clean);
    return {
      n: i + 1,
      system: h.chunk.system,
      deepLink: withHighlight(h.chunk.system, h.chunk.deepLink, highlight),
      locator: locatorFor(h.chunk.text),
      docTitle: h.chunk.docTitle,
      ref: refFor(h),
      snippet: clean.slice(0, 220),
      highlight,
      tier: h.chunk.tier,
    };
  });
}

function pickHighlight(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
  if (!sentences.length) return text.slice(0, 140);
  // prefer a sentence with a number/$ in it — that's usually the citable fact
  const withNum = sentences.find((s) => /[$%]|\d/.test(s));
  return (withNum ?? sentences[0]!).slice(0, 180);
}

/** human-readable position: a markdown heading if the chunk starts under one. */
function locatorFor(text: string): string | null {
  const h = text.match(/^#+\s+(.+)$/m) || text.match(/\*\*([^*]{3,40})\*\*/);
  return h ? `§ ${h[1]!.replace(/[#*]/g, "").trim()}` : null;
}

/**
 * Append a highlight target the destination understands.
 * - web docs / Drive preview: `#:~:text=` scroll-to-text fragment (Chrome/Edge)
 * - Airtable / GivingData: the record link already targets the row; the app highlights it
 * Real adapters would emit Google Docs heading/bookmark anchors where available.
 */
function withHighlight(system: string, link: string, highlight: string): string {
  if (link.includes("#")) return link;
  const frag = encodeURIComponent(highlight.replace(/^\W+|\W+$/g, "").split(/\s+/).slice(0, 10).join(" "));
  if (system === "drive") return `${link}#:~:text=${frag}`;
  if (system === "givingdata" || system === "airtable") return `${link}?highlight=${frag}`;
  return link;
}

function refFor(h: Scored): string {
  const id = h.chunk.docId.split(":")[1] ?? h.chunk.docId;
  return `${h.chunk.system}:${id}`;
}

function extractiveAnswer(question: string, hits: Scored[], citations: Citation[]): string {
  const lines: string[] = [];
  const systems = new Set(hits.map((h) => h.chunk.system));
  lines.push(
    `_Evidence brief — ${hits.length} passage(s) across ${systems.size} system(s). No generative model is configured, so this is the source evidence with citations, not a written synthesis._\n`
  );
  const byDoc = new Map<string, { title: string; system: string; n: number; texts: string[] }>();
  hits.forEach((h, i) => {
    const key = h.chunk.docId;
    const e = byDoc.get(key) ?? { title: h.chunk.docTitle, system: h.chunk.system, n: i + 1, texts: [] };
    // drop markdown heading lines — the doc title already names the source
    e.texts.push(
      h.chunk.text
        .split("\n")
        .filter((l) => !/^#+\s/.test(l.trim()))
        .join("\n")
        .trim()
    );
    byDoc.set(key, e);
  });
  for (const e of byDoc.values()) {
    lines.push(`**${e.title}** _(${e.system})_ [${e.n}]`);
    lines.push(e.texts.join("\n\n"));
    lines.push("");
  }
  return lines.join("\n").trim();
}

/**
 * Confidence describes the strength of the *evidence retrieved* — not the model's certainty.
 * It is computed only from retrieval signals (match strength, spread across systems),
 * never from the model's self-report.
 */
function gradeConfidence(hits: Scored[]): { level: Answer["confidence"]; reason: string } {
  const top = hits[0]!;
  const systems = new Set(hits.slice(0, 5).map((h) => h.chunk.system)).size;
  const strong = hits.filter((h) => h.bm25 > 2 || h.semantic > 0.12).length;
  if (top.bm25 > 3 && strong >= 2)
    return { level: "high", reason: `strong evidence — ${strong} close matches across ${systems} system(s)` };
  if (strong >= 1)
    return { level: "medium", reason: `partial evidence — ${strong} close match(es); verify against the cited sources` };
  return { level: "low", reason: "thin evidence — treat as a lead, not an answer" };
}

/**
 * If the question names a specific person or multi-word proper entity, and neither the
 * resolved-entity directory nor any retrieved passage mentions it, Compass has nothing on
 * that subject — refuse plainly rather than answer from adjacent material. This is also
 * what makes a query about a quarantined named participant fail closed.
 */
function unrecognizedNamedSubject(question: string, index: CorpusIndex, hits: Scored[]): string | null {
  // capitalized 2+ word phrases, ignoring ones that start the sentence
  const names = new Set<string>();
  const re = /(?<=[a-z,;:]\s|["“'(]\s?)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g;
  for (const m of question.matchAll(re)) names.add(m[1]!);
  // also catch a leading "Tell me about X" / "participant X" where X follows a keyword
  const kw = question.match(/\b(?:participant|client|beneficiary|about|regarding|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/);
  if (kw) names.add(kw[1]!);
  if (!names.size) return null;

  const known = [
    ...index.entities.map((e) => e.label.toLowerCase()),
    ...index.directory.map((p) => p.name.toLowerCase()),
  ];
  const hitText = hits.map((h) => h.chunk.text.toLowerCase()).join("  ");

  for (const name of names) {
    const n = name.toLowerCase();
    const inEntities = known.some((k) => k.includes(n) || n.includes(k));
    const inHits = hitText.includes(n);
    // common English word-pairs slip through the regex; require it to look like a name
    const looksNominal = /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(name);
    if (looksNominal && !inEntities && !inHits) return name;
  }
  return null;
}

function coverageStatement(index: CorpusIndex): string {
  const range = index.coverage.dateRange ? ` (${index.coverage.dateRange[0]} to ${index.coverage.dateRange[1]})` : "";
  const not = index.coverage.notCovered.length ? ` Not covered: ${index.coverage.notCovered.join("; ")}.` : "";
  // Honesty about what the pipeline itself dropped (HOPE lesson): if documents were held
  // out because we couldn't read them, say so — they're a known blind spot, not absent.
  const ex = index.gaps.excluded;
  const unreadable =
    ex && ex.lowExtractionConfidence.count > 0
      ? ` ${ex.lowExtractionConfidence.count} document(s) were set aside as unreadable (scanned or corrupt) and are not in these results.`
      : "";
  return `Searched: ${index.coverage.systems.join(", ")}${range}.${not}${unreadable}`;
}
