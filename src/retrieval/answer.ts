import type { Answer, Citation, CorpusIndex, Principal } from "../core/types.js";
import { retrieve, type Scored } from "./search.js";
import { suggestFollowups } from "./followups.js";

export interface AnswerOptions {
  /** optional generative backend; if absent, Compass returns an extractive answer */
  llm?: (args: { question: string; passages: { n: number; text: string; source: string }[] }) => Promise<string>;
  k?: number;
  /** "ask better" suggestions beside the answer — user-toggleable, default on */
  followUps?: boolean;
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
  const { hits, withheld } = retrieve(index, question, principal, opts.k ?? 8);

  const coverage = coverageStatement(index);

  // Refuse when nothing solidly matches — a weak lexical brush is not an answer.
  const topWeak = hits.length > 0 && hits[0]!.bm25 < 1.6 && hits[0]!.semantic < 0.08;
  const topBm25 = hits[0]?.bm25 ?? 0;
  // Restricted content dominates when its metadata match is as on-topic as our best real hit.
  const restrictedMatched = withheld.tiers.includes("restricted");
  const restrictedDominates = restrictedMatched && withheld.restrictedTopScore >= topBm25 * 0.7;
  const permissionBlocked = hits.length === 0 && withheld.count > 0;

  if (hits.length === 0 || topWeak || restrictedDominates) {
    let text: string;
    let reason: string;
    if (restrictedDominates) {
      text =
        `This question would require material in the Restricted tier (board / compensation / legal). ` +
        `That content is not indexed and Compass will not answer from it. If you need it, request it through the COO's office.`;
      reason = "matching topic is Restricted-tier; not indexed";
    } else if (permissionBlocked) {
      text = `${withheld.count} passage(s) match this question but sit outside what you can retrieve in this workspace. I can't answer it here.`;
      reason = "required sources are outside the caller's permission scope";
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
  const followUps = opts.followUps === false ? undefined : suggestFollowups(index, question, hits, withheld);

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
  lines.push(
    `_Assembled from ${hits.length} retrieved passage(s). No generative model is configured, so this is the source text with citations, not a written synthesis._\n`
  );
  const byDoc = new Map<string, { title: string; system: string; n: number; texts: string[] }>();
  hits.forEach((h, i) => {
    const key = h.chunk.docId;
    const e = byDoc.get(key) ?? { title: h.chunk.docTitle, system: h.chunk.system, n: i + 1, texts: [] };
    e.texts.push(h.chunk.text.trim());
    byDoc.set(key, e);
  });
  for (const e of byDoc.values()) {
    lines.push(`**${e.title}** _(${e.system})_ [${e.n}]`);
    lines.push(e.texts.join("\n\n"));
    lines.push("");
  }
  return lines.join("\n").trim();
}

function gradeConfidence(hits: Scored[]): { level: Answer["confidence"]; reason: string } {
  const top = hits[0]!;
  const systems = new Set(hits.slice(0, 5).map((h) => h.chunk.system)).size;
  const strong = hits.filter((h) => h.bm25 > 2 || h.semantic > 0.12).length;
  if (top.bm25 > 3 && strong >= 2) return { level: "high", reason: `${strong} strong matches across ${systems} system(s)` };
  if (strong >= 1) return { level: "medium", reason: `partial support — ${strong} strong match(es), verify against sources` };
  return { level: "low", reason: "weak retrieval — treat as a lead, not an answer" };
}

function coverageStatement(index: CorpusIndex): string {
  const range = index.coverage.dateRange ? ` (${index.coverage.dateRange[0]} to ${index.coverage.dateRange[1]})` : "";
  const not = index.coverage.notCovered.length ? ` Not covered: ${index.coverage.notCovered.join("; ")}.` : "";
  return `Searched: ${index.coverage.systems.join(", ")}${range}.${not}`;
}
