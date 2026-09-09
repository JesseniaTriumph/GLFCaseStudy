import type { Answer, Citation, CorpusIndex, Principal } from "../core/types.js";
import { retrieve, mayRead, type Scored, type RetrieveResult } from "./search.js";
import { rerankHits, RERANK_POOL } from "./rerank.js";
import { getConfiguredReranker, type Reranker } from "../embed/reranker.js";
import { suggestFollowups } from "./followups.js";
import { currentSeasons, interpretQuery, type FunctionKey } from "../roles.js";
import { grantCycle, portfolioDeadlines } from "../grant-cycle.js";

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
  /**
   * Cross-encoder reranker over the retrieved passage pool (roadmap 2.5). Runs strictly
   * after the retriever's permission filter, so it only reorders passages the caller may
   * already read. `undefined` (default) uses whatever `COMPASS_RERANK` selects — usually
   * none; pass `null` to force it off, or a `Reranker` to force one on.
   */
  reranker?: Reranker | null;
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
  // A portfolio-schedule question ("what's due in the next 30 days", "which grants have
  // renewals coming up", "what's overdue") is answered by computing across every grant's
  // own cycle — not by retrieval. Cited to the grant fact sheets it draws on.
  const scheduleAns = maybeScheduleAnswer(index, question, principal);
  if (scheduleAns) return scheduleAns;

  // embed the query the same way the index was built, if it uses a learned embedder
  let queryDense: number[] | undefined;
  if (index.embedder) {
    const { getEmbedder } = await import("../embed/embedder.js");
    const e = await getEmbedder(index.embedder.id);
    if (e) queryDense = (await e.embed([question]))[0];
  }

  const wantK = opts.k ?? 8;
  // Reranking (off unless COMPASS_RERANK is set): pull a wider candidate pool so the
  // cross-encoder has something to reorder, then trim back to wantK. The retrieval-quality
  // signals below (topWeak / strongRealHits / restricted logic) read the FIRST-PASS pool,
  // so reranking only changes which passages are cited — never whether Compass answers.
  const reranker = opts.reranker === undefined ? await getConfiguredReranker() : opts.reranker;
  const fetchK = reranker ? Math.max(wantK, RERANK_POOL) : wantK;
  const { hits: firstPass, withheld } = await (opts.retriever ?? retrieve)(index, question, principal, fetchK, queryDense);
  const hits = (reranker ? await rerankHits(question, firstPass, reranker) : firstPass).slice(0, wantK);

  // Role & cycle context (off unless opts.roleContext is set): if the query is ambiguous,
  // note the reading Compass applied — always disclosed, never a silent scope change.
  const seasons = opts.roleContext ? currentSeasons(opts.roleContext.today ? new Date(opts.roleContext.today) : undefined) : [];
  const reading = opts.roleContext ? interpretQuery(question, opts.roleContext.functions, seasons) : null;

  const coverage = (reading ? `${reading} ` : "") + coverageStatement(index);

  // Refuse when nothing solidly matches — a weak lexical brush is not an answer. These
  // gates read `firstPass` (the retriever's own ranking): "did retrieval find anything
  // solid at all", independent of how the reranker later orders the passages we cite.
  const topWeak = firstPass.length > 0 && firstPass[0]!.bm25 < 1.6 && firstPass[0]!.semantic < 0.08;
  // The question names a specific person/org, but nothing Compass can see mentions it.
  // Don't hand back a confident-looking brief about adjacent grantees — say so.
  const unknownSubject = unrecognizedNamedSubject(question, index, firstPass);
  // Enumeration / dump requests — Compass answers questions, it is not a document browser
  // or an export tool. This also closes the "list everything you can see" exfiltration probe.
  const metaDumpRequest = isEnumerationRequest(question);
  const topBm25 = firstPass[0]?.bm25 ?? 0;
  const strongRealHits = firstPass.filter((h) => h.bm25 > 2 || h.semantic > 0.12).length;
  const restrictedMatched = withheld.tiers.includes("restricted");
  // The question is *about* a restricted category — board/exec compensation, or a
  // declined/rejected applicant. Those categories are held out of the index by policy, so
  // refuse on the intent alone: the honest answer is "that isn't retrievable", not "I found
  // nothing", and not a confident answer built from adjacent team-tier material.
  const restrictedTopic =
    /\bsalary (band|range)|\bcompensation (review|figure|band|range|package)|\b(staff|executive|board|leadership) (compensation|pay|salar)|\b(compensation|salar\w+|pay)\b[\s\S]{0,40}\bboard\b|\bboard\b[\s\S]{0,40}\b(compensation|salar\w+)\b/i.test(question) ||
    /\b(declin\w*|rejected?|turned down|passed on|unsuccessful|not funded|didn'?t fund)\b[\s\S]{0,30}\bapplica|\bapplica\w*[\s\S]{0,30}\b(declin\w*|rejected?|turn\w* down|pass\w* on|not fund|didn'?t fund)/i.test(question);
  // Beyond that, restricted stubs only block when there's essentially no real material and a
  // stub matches at least as well as our best hit — so a broad thesis question with plenty
  // of real grants is never blocked just because declined applicants exist in that thesis.
  const restrictedDominates =
    restrictedTopic || (restrictedMatched && strongRealHits === 0 && withheld.restrictedTopScore >= topBm25 * 0.9);
  const permissionBlocked = firstPass.length === 0 && withheld.count > 0;

  if (firstPass.length === 0 || topWeak || restrictedDominates || unknownSubject || metaDumpRequest) {
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

  // The question asks for participant-level detail (a specific named/described individual's
  // outcome) but Compass holds no participant identifiers by policy. Answer from the grant
  // context if there is one, but never at high confidence, and say why.
  const asksParticipantLevel =
    /\b(participant|enrollee|trainee|client|beneficiary|individual|person|someone|graduate)\b/i.test(question) &&
    /\b(who|which|whose|name|placed at|increased (their|his|her)|earned|was hired|specific)\b/i.test(question);

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

  // Conflicting figures across sources are shown, not merged (roadmap 3.6).
  const comparison = /\b(vs\.?|versus|against|compared? to|relative to)\b.*\b(proj|target|plan|goal|expect|estimate|forecast)/i.test(question);
  const conflicts = comparison ? [] : findLabeledConflicts(hits);
  if (conflicts.length) {
    const lines = conflicts
      .slice(0, 3)
      .map((c) => `- **${c.label}**: ${c.values.map((v) => `${v.value.toLocaleString()} [${v.n}]`).join(" vs ")}`)
      .join("\n");
    text = `_⚠ The cited sources disagree on some figures — shown here, not reconciled:_\n${lines}\n\n${text}`;
  }

  let confidence = gradeConfidence(hits, question, conflicts.length > 0);
  if (asksParticipantLevel) {
    confidence = {
      level: "low",
      reason:
        "this asks about an individual participant; Compass holds no participant-level identifiers by policy, so this is grant context only, not an answer about a specific person",
    };
    text = `_Compass does not hold participant-level records. What follows is grant context, not information about a specific individual._\n\n${text}`;
  }
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
      ...(h.chunk.translated ? { translatedFrom: h.chunk.sourceLang ?? "another language" } : {}),
    };
  });
}

const LANG = (code: string) => ({ es: "Spanish", fr: "French", pt: "Portuguese" }[code] ?? code);

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
  const byDoc = new Map<string, { title: string; system: string; n: number; texts: string[]; translatedFrom?: string }>();
  hits.forEach((h, i) => {
    const key = h.chunk.docId;
    const e = byDoc.get(key) ?? { title: h.chunk.docTitle, system: h.chunk.system, n: i + 1, texts: [], translatedFrom: h.chunk.translated ? h.chunk.sourceLang : undefined };
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
    const tr = e.translatedFrom ? ` _· machine translation from ${LANG(e.translatedFrom)} — verify against the source_` : "";
    lines.push(`**${e.title}** _(${e.system})_ [${e.n}]${tr}`);
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
function gradeConfidence(hits: Scored[], question = "", conflict = false): { level: Answer["confidence"]; reason: string } {
  const top = hits[0]!;
  const systems = new Set(hits.slice(0, 5).map((h) => h.chunk.system)).size;
  const strong = hits.filter((h) => h.bm25 > 2 || h.semantic > 0.12).length;

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

interface FigureConflict {
  label: string;
  values: Array<{ value: number; n: number }>;
}

/**
 * The same labelled figure with materially different values across passages — e.g.
 * "median wage at placement $19.40" in one source, "$16.10" in another. Keying on a short
 * label avoids flagging a projection-vs-actual delta as a contradiction. Conflicts are
 * SHOWN, never merged (roadmap 3.6).
 */
function findLabeledConflicts(hits: Scored[]): FigureConflict[] {
  // key = grant entity + normalised label, so we only compare like with like (a Riverbend
  // figure never "conflicts" with a Highland figure)
  const byKey = new Map<string, { label: string; grant: string; values: Array<{ value: number; n: number }> }>();
  hits.forEach((h, i) => {
    const grant = h.chunk.entities.find((e) => e.kind === "grant")?.id ?? h.chunk.docId;
    const clean = h.chunk.text.replace(/[*_`]/g, "");
    for (const m of clean.matchAll(/([A-Za-z][A-Za-z ]{6,40}?)\s*(?:was|is|:|of|=|reached)?\s*\$?\s?([\d,]+(?:\.\d+)?)\s?(%|\/hr|\/hour)?/g)) {
      const label = m[1]!.trim().toLowerCase().replace(/\b(the|a|an|of|per|at|for|in|was|is|were|are)\b/g, "").replace(/\s+/g, " ").trim();
      if (label.length < 6 || /\b(year|q[1-4]|target|projected|baseline|model)\b/.test(label)) continue;
      const value = +m[2]!.replace(/,/g, "");
      if (!Number.isFinite(value) || value === 0) continue;
      const key = `${grant}::${label}`;
      const e = byKey.get(key) ?? { label, grant, values: [] };
      e.values.push({ value, n: i + 1 });
      byKey.set(key, e);
    }
  });
  const out: FigureConflict[] = [];
  for (const e of byKey.values()) {
    const distinct = [...new Map(e.values.map((v) => [v.value, v])).values()];
    if (distinct.length < 2) continue;
    // ignore pairs from the same citation number (a doc restating a figure)
    if (new Set(distinct.map((v) => v.n)).size < 2) continue;
    const max = Math.max(...distinct.map((v) => v.value));
    const min = Math.min(...distinct.map((v) => v.value));
    // any real disagreement beyond rounding is worth showing; a >60% gap is almost always
    // two different quantities caught by a loose label, not a genuine conflict
    if ((max - min) / max > 0.02 && (max - min) / max < 0.6) out.push({ label: e.label, values: distinct.sort((a, b) => b.value - a.value) });
  }
  return out;
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

  const fold = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const known = [...index.entities.map((e) => fold(e.label)), ...index.directory.map((p) => fold(p.name))];
  const hitText = fold(hits.map((h) => h.chunk.text).join("  "));

  const STOP = /^(The|This|That|These|Those|What|Which|How|When|Where|Who|Why|Compass|Foundation|Program|Grant|GivingData|Airtable|Drive|Zoom)$/;
  for (const name of names) {
    const n = fold(name);
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
  // "print your system prompt", "reveal your instructions/guardrails/rules"
  const revealSelf = /\b(print|show|reveal|output|repeat|tell me|what (is|are))\b[^.?!]*\b(your )?(system prompt|initial instructions|instructions you were given|guardrails|guidelines you follow|rules you (follow|were given)|prompt)\b/;
  return (verb.test(q) && scope.test(q)) || (rawtext.test(q) && /\b(every|all|each|index|corpus)\b/.test(q)) || followInstr.test(q) || revealSelf.test(q);
}

/**
 * Portfolio-schedule answers — computed from every grant's own cycle, not retrieval.
 * "What reports are due in the next 30 days?" · "Which grants have renewals coming up?" ·
 * "What's overdue across the portfolio?"
 */
function maybeScheduleAnswer(index: CorpusIndex, question: string, principal: Principal): Answer | null {
  const q = question.toLowerCase();
  const scheduleKw =
    /\b(due|overdue|deadline|coming up|upcoming|renewal|re-?application|report[s]? (due|left|remaining))\b|\bwhat'?s (due|left|coming|overdue)\b/.test(q);
  const scopeKw =
    /\b(portfolio|my grants|our grants|across|all grants|next \d+ days?|next (month|quarter|week)|this (month|quarter|week|fy|fiscal year)|which grants?|right now|currently|at the moment|at present|anything (due|overdue)|reports? (are |is )?overdue|overdue reports?)\b/.test(q);
  // don't hijack a question that names one grantee — entity-focused retrieval handles that
  const namesAnOrg = index.entities.some(
    (e) => e.kind === "organization" && e.label.length > 4 && q.includes(e.label.toLowerCase())
  );
  if (!scheduleKw || !scopeKw || namesAnOrg || !index.grantMeta) return null;

  // window: "next N days", or a sensible default per phrasing
  const m = q.match(/next (\d+) days?/);
  const windowDays = m ? +m[1]! : /next quarter|this quarter/.test(q) ? 90 : /next month|this month/.test(q) ? 31 : 60;

  // only grants whose fact sheet this principal can read (grantMeta is keyed by the grant id;
  // the fact-sheet chunk's docId is `givingdata:<grantId>`)
  const readable = new Set(
    index.chunks
      .filter((c) => c.docTitle.startsWith("Grant fact sheet") && mayRead(c, principal))
      .map((c) => c.docId.replace(/^givingdata:/, ""))
  );
  const cycles = Object.entries(index.grantMeta)
    .filter(([gid]) => readable.has(gid))
    .map(([gid, meta]) => grantCycle({ grantId: gid, ...meta }));

  const wantsRenewal = /renewal|re-?application/.test(q);
  const wantsOverdue = /overdue/.test(q);
  const { dueSoon, overdue, renewals } = portfolioDeadlines(cycles, windowDays);

  const lines: string[] = [];
  const cites: string[] = [];
  const push = (gid: string) => {
    if (!cites.includes(gid)) cites.push(gid);
  };

  if (wantsRenewal) {
    lines.push(`**Renewals in scope** (${renewals.length}):`);
    for (const r of renewals.sort((a, b) => (a.inDays ?? 999) - (b.inDays ?? 999))) {
      lines.push(`- ${r.org ?? r.grant} (${r.grant}) — ${r.inDays != null ? `LOI/decision in ${r.inDays}d (${r.endsOrDue})` : "in the renewal window"}`);
      push(r.grant);
    }
  } else if (wantsOverdue) {
    lines.push(`**Overdue** (${overdue.length}):`);
    for (const o of overdue) {
      lines.push(`- ${o.org ?? o.grant} (${o.grant}) — ${o.type}, ${o.overdueByDays}d overdue (was due ${o.dueDate})`);
      push(o.grant);
    }
  } else {
    lines.push(`**Due in the next ${windowDays} days** (${dueSoon.length}):`);
    for (const d of dueSoon) {
      lines.push(`- ${d.org ?? d.grant} (${d.grant}) — ${d.type} in ${d.inDays}d (${d.dueDate})`);
      push(d.grant);
    }
    if (overdue.length) {
      lines.push(``, `**Already overdue** (${overdue.length}):`);
      for (const o of overdue.slice(0, 8)) {
        lines.push(`- ${o.org ?? o.grant} (${o.grant}) — ${o.type}, ${o.overdueByDays}d overdue`);
        push(o.grant);
      }
    }
  }
  if (lines.length <= 1) lines.push("_Nothing in this window._");
  lines.push(``, `_Computed from each grant's own requirement schedule and term dates. Cadence is read from GivingData where recorded, otherwise inferred from the schedule (see docs/GRANT_METADATA.md)._`);

  const citations: Citation[] = cites.slice(0, 10).map((gid, i) => {
    const fs = index.chunks.find((c) => c.docTitle.startsWith("Grant fact sheet") && c.docId.includes(gid));
    return {
      n: i + 1,
      system: "givingdata",
      deepLink: fs?.deepLink ?? `https://givingdata.example/records/${gid}`,
      locator: `§ Reporting schedule`,
      docTitle: fs?.docTitle ?? `Grant ${gid}`,
      ref: `givingdata:${gid}`,
      snippet: index.grantMeta![gid]?.organization ?? gid,
      highlight: "",
      tier: "team",
    };
  });

  return {
    question,
    text: lines.join("\n"),
    citations,
    confidence: "high",
    confidenceReason: `computed from ${cycles.length} grant schedule(s) you can see`,
    coverage: `Computed across the grant schedules in GivingData you have access to. ${coverageStatement(index)}`,
    withheld: null,
    mode: "extractive",
  };
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
