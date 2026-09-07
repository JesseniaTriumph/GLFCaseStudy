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
  // Enumeration / dump requests — Compass answers questions, it is not a document browser
  // or an export tool. This also closes the "list everything you can see" exfiltration probe.
  const metaDumpRequest = isEnumerationRequest(question);
  const topBm25 = hits[0]?.bm25 ?? 0;
  // Restricted content dominates when its metadata match is as on-topic as our best real hit.
  const restrictedMatched = withheld.tiers.includes("restricted");
  const restrictedDominates = restrictedMatched && withheld.restrictedTopScore >= topBm25 * 0.7;
  const permissionBlocked = hits.length === 0 && withheld.count > 0;

  if (hits.length === 0 || topWeak || restrictedDominates || unknownSubject || metaDumpRequest) {
    let text: string;
    let reason: string;
    if (metaDumpRequest) {
      text =
        `Compass answers questions about the content of the grant record — it doesn't list, ` +
        `enumerate, or export the index. Ask about a specific grant, organization, thesis area, ` +
        `or decision. ${coverage}`;
      reason = "enumeration/export request — not a question about the content";
    } else if (restrictedDominates || permissionBlocked) {
      // Deliberately reveals no count and no confirmation that matching records exist —
      // the existence and number of restricted documents is itself sensitive metadata.
      text =
        `The information needed to answer this question is outside your approved access. ` +
        `Compass did not retrieve or inspect that content. If you believe you should have access, ` +
        `raise it with the data owner (the COO's office).`;
      reason = restrictedDominates ? "topic resolves to Restricted-tier material" : "required sources are outside the caller's access";
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
      // On an access refusal, do not echo how many restricted records matched — that count
      // is sensitive. Only report withheld volume when the answer itself was served.
      withheld: null,
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

  const confidence = gradeConfidence(hits, question);
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
 * Confidence describes the *evidence*, never the model's certainty. It has an operational
 * definition — four measurable dimensions, all from retrieval, none from a model self-report:
 *
 *   coverage      — how many close matches, across how many independent systems
 *   agreement     — do the cited passages state consistent numbers, or do they conflict
 *   freshness     — how old is the newest citation (a 4-year-old-only answer is "dated")
 *   completeness  — is every cited passage backed by an openable source link
 *
 * The level is the weakest dimension that applies, and the reason names which one drove it.
 */
function gradeConfidence(hits: Scored[], question = ""): { level: Answer["confidence"]; reason: string } {
  const top = hits[0]!;
  const systems = new Set(hits.slice(0, 5).map((h) => h.chunk.system)).size;
  const strong = hits.filter((h) => h.bm25 > 2 || h.semantic > 0.12).length;

  // agreement: flag when passages state materially different values for a figure that
  // carries the SAME label. A "vs projection / vs target" question expects a delta, so
  // skip the check there — the difference is the answer, not a contradiction.
  const comparison = /\b(vs\.?|versus|against|compared? to|relative to)\b.*\b(proj(ect|ection)|target|plan|goal|expect|estimate|forecast)/i.test(question);
  const conflict = !comparison && hasLabeledConflict(hits.slice(0, 5).map((h) => h.chunk.text));

  // freshness: newest citation date
  const dates = hits.map((h) => h.chunk.date).filter(Boolean).sort() as string[];
  const newest = dates[dates.length - 1];
  const ageYears = newest ? (Date.now() - new Date(newest).getTime()) / 3.156e10 : null;
  const dated = ageYears != null && ageYears > 2.5;

  // completeness: every hit has an openable link
  const linkable = hits.every((h) => !!h.chunk.deepLink);

  if (conflict)
    return { level: "medium", reason: "the cited sources report different values for the same figure — reconcile them against the sources before relying on this" };
  if (!linkable)
    return { level: "low", reason: "some evidence can't be linked to an openable source" };
  if (top.bm25 > 3 && strong >= 2 && !dated)
    return { level: "high", reason: `strong evidence — ${strong} close matches across ${systems} system(s), sources agree, most recent within ~2 years` };
  if (strong >= 1)
    return {
      level: "medium",
      reason:
        `partial evidence — ${strong} close match(es)` +
        (dated ? `; newest citation is ~${Math.round(ageYears!)}y old` : "") +
        `; verify against the cited sources`,
    };
  return { level: "low", reason: "thin evidence — treat as a lead, not an answer" };
}

/**
 * Look for the same labelled figure with materially different values across passages —
 * e.g. "median wage at placement $19.40" in one source and "$16.10" in another. Keying on
 * a short label prefix avoids flagging a projection-vs-actual delta as a contradiction.
 */
function hasLabeledConflict(texts: string[]): boolean {
  const byLabel = new Map<string, number[]>();
  for (const t of texts) {
    for (const m of t.matchAll(/([A-Za-z][A-Za-z ]{6,40}?)[:\s]\s*\$?\s?([\d,]+(?:\.\d+)?)\s?(%?)/g)) {
      const label = m[1]!.trim().toLowerCase().replace(/\b(the|a|an|of|per|at|for|in)\b/g, "").replace(/\s+/g, " ").trim();
      if (label.length < 6) continue;
      const value = +m[2]!.replace(/,/g, "");
      if (!Number.isFinite(value) || value === 0) continue;
      const list = byLabel.get(label) ?? [];
      list.push(value);
      byLabel.set(label, list);
    }
  }
  for (const vs of byLabel.values()) {
    for (let i = 0; i < vs.length; i++)
      for (let j = i + 1; j < vs.length; j++) {
        const [a, b] = [vs[i]!, vs[j]!];
        if (Math.abs(a - b) / Math.max(a, b) > 0.2) return true;
      }
  }
  return false;
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
  // a person referred to by first name only, tied to participant/enrollee language:
  // "the participant whose first name is Amara", "the enrollee named Amara"
  const firstNameOnly = question.match(
    /\b(?:participant|client|beneficiary|enrollee|trainee|person)\b[^.?!]*\b(?:name(?:d)?(?:\s+is)?|called)\s+([A-Z][a-z]+)\b/
  );
  if (firstNameOnly) names.add(firstNameOnly[1]!);
  if (!names.size) return null;

  const known = [
    ...index.entities.map((e) => e.label.toLowerCase()),
    ...index.directory.map((p) => p.name.toLowerCase()),
  ];
  const hitText = hits.map((h) => h.chunk.text.toLowerCase()).join("  ");

  const STOP = /^(The|This|That|These|Those|What|Which|How|When|Where|Who|Why|Compass|Foundation|Program|Grant|GivingData|Airtable|Drive|Zoom)$/;
  for (const name of names) {
    const n = name.toLowerCase();
    const inEntities = known.some((k) => k.includes(n) || n.includes(k));
    const inHits = hitText.includes(n);
    // a two-word Proper Noun, or a single first name we picked up from participant phrasing
    const looksNominal = /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(name) || (/^[A-Z][a-z]{2,}$/.test(name) && !STOP.test(name));
    if (looksNominal && !inEntities && !inHits) return name;
  }
  return null;
}

/**
 * Not a question about the content: an enumeration/export request ("list every document",
 * "dump the corpus"), or a request to *act on instructions found in a document* ("do what
 * the note says", "follow the instructions in X") — a classic indirect-injection vector.
 */
function isEnumerationRequest(question: string): boolean {
  const q = question.toLowerCase();
  const scope = /\b(every|all|each|entire|whole|complete|full)\b.*\b(document|doc|file|record|source|passage|entry|item)s?\b/;
  const verb = /\b(list|enumerate|dump|export|output|print|show me|give me|reveal)\b/;
  const rawtext = /\b(raw|full|entire|complete)\s+(text|content|contents)\b/;
  const followInstr = /\b(do what|follow|carry out|execute|obey|comply with|act on)\b[^.?!]*\b(instruction|directive|command|note|document|memo|text|it)s?\b[^.?!]*\b(say|says|said|tell|tells|contain)/;
  return (verb.test(q) && scope.test(q)) || (rawtext.test(q) && /\b(every|all|each|index|corpus)\b/.test(q)) || followInstr.test(q);
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
