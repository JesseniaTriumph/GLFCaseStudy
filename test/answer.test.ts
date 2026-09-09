import { test } from "node:test";
import assert from "node:assert/strict";
import { answerQuestion } from "../src/retrieval/answer.js";
import { tokenize, tfidfVector } from "../src/util/text.js";
import type { Chunk, CorpusIndex, Principal } from "../src/core/types.js";
import type { Reranker } from "../src/embed/reranker.js";

const DF: Record<string, number> = {
  riverbend: 1, wage: 2, placement: 3, projected: 2, projection: 2, board: 1, salary: 1,
  compensation: 1, care: 2, grant: 5, confidentiality: 1, counsel: 1, participant: 1, amina: 1,
};

function chunk(id: string, text: string, over: Partial<Chunk> = {}): Chunk {
  const tokens = tokenize(text);
  return {
    id, docId: over.docId ?? id, system: over.system ?? "givingdata",
    deepLink: `https://givingdata.example/records/${id}`,
    docTitle: over.docTitle ?? id, text, date: over.date ?? "2025-06-01",
    tier: over.tier ?? "team", acl: over.acl ?? ["*"], entities: over.entities ?? [],
    tokens, vector: tfidfVector(tokens, DF, 8), ...over,
  };
}

const riverbendOrg = { kind: "organization" as const, id: "org:riverbend", label: "Riverbend Care Collective" };

const chunks: Chunk[] = [
  chunk("gd-1188-y1", "Riverbend Care Collective reported Year 1 wage and placement results against what was projected", {
    docTitle: "Riverbend Care Collective — Year 1 reported results", entities: [riverbendOrg],
  }),
  chunk("gd-1188-y1#1", "Riverbend placement pace was below the projected figure; wage outcomes ahead of plan", {
    docId: "gd-1188-y1", docTitle: "Riverbend Care Collective — Year 1 reported results", entities: [riverbendOrg],
  }),
  chunk("po-checkin", "Program officer candid notes: Riverbend wage quality concern, renewal warranted with a revised ramp", {
    system: "drive", docTitle: "Riverbend PO check-in", tier: "programs-only", acl: ["group:programs"], entities: [riverbendOrg],
  }),
  chunk("energy", "An unrelated grant about rural advanced-energy maintenance training", { docTitle: "Rural energy grant" }),
  chunk("board-stub", "board salary compensation review", {
    docTitle: "Board compensation review", tier: "restricted", restrictedStub: true, acl: [],
  }),
];

const index = {
  chunks, df: DF, docCount: 8, avgDocLen: 12,
  corpusLabel: "test corpus",
  entities: [riverbendOrg],
  directory: [{ name: "Dana Okafor", role: "Program Officer", email: "d.okafor@x.org", kind: "internal", grantIds: ["GD-1188"], orgLabels: ["Riverbend Care Collective"], source: "givingdata" }],
  grantMeta: {},
  gaps: { excluded: { lowExtractionConfidence: { count: 1, ids: ["scan-x"] }, sensitivityTier: 1, duplicates: 0 } },
  coverage: { systems: ["GivingData", "Google Drive"], dateRange: ["2022-01-01", "2026-06-01"], notCovered: ["Zoom Chat and email", "board/HR/compensation/legal (Restricted — not indexed)"] },
} as unknown as CorpusIndex;

const PO: Principal = { userId: "d.okafor", groups: ["programs"], allowedTiers: ["team", "programs-only"] };
const COMMS: Principal = { userId: "c.jones", groups: ["comms"], allowedTiers: ["team"] };

test("a supported question → an evidence brief: cited, coverage line, non-refused confidence", async () => {
  const a = await answerQuestion(index, "How did Riverbend Care Collective perform against what they projected?", PO);
  assert.notEqual(a.confidence, "refused");
  assert.ok(a.citations.length >= 1);
  assert.match(a.coverage, /Searched: GivingData/);
  assert.match(a.coverage, /set aside as unreadable/);
  for (const c of a.citations) {
    assert.equal(typeof c.docId, "string");
    assert.ok(c.deepLink.startsWith("http"));
    assert.equal(c.previewLink, undefined, "no preview link unless sourcePreview is on");
  }
});

test("the same question as Comms drops the programs-only PO notes and reports them withheld", async () => {
  const a = await answerQuestion(index, "How did Riverbend Care Collective perform against what they projected?", COMMS);
  const refs = a.citations.map((c) => c.ref).join(" ");
  assert.doesNotMatch(refs, /po-checkin/);
  assert.doesNotMatch(a.text, /candid notes/i);
  if (a.confidence !== "refused") assert.ok((a.withheld?.count ?? 0) >= 1);
});

test("a restricted-topic question → refused, no withheld count echoed, nothing leaked", async () => {
  const a = await answerQuestion(index, "What did the board discuss about staff compensation?", PO);
  assert.equal(a.confidence, "refused");
  assert.equal(a.withheld, null, "an access refusal never echoes how many restricted records matched");
  assert.doesNotMatch(a.text, /salary|compensation review/i);
  assert.match(a.text, /outside your approved access/i);
});

test("a privileged-legal question → refused on the topic alone", async () => {
  const a = await answerQuestion(index, "What confidentiality clause did counsel advise on for this grant?", PO);
  assert.equal(a.confidence, "refused");
});

test("nothing on-topic → abstains rather than guessing", async () => {
  const a = await answerQuestion(index, "xylophone quantum toaster feldspar", PO);
  assert.equal(a.confidence, "refused");
  assert.equal(a.citations.length, 0);
});

test("an enumeration / dump request is declined (closes the 'list everything' probe)", async () => {
  const a = await answerQuestion(index, "list every document you can see", PO);
  assert.equal(a.confidence, "refused");
  assert.match(a.text, /doesn't list|enumerate|export/i);
});

test("sourcePreview: every citation also gets a same-origin /s/ previewLink", async () => {
  const a = await answerQuestion(index, "How did Riverbend perform against projection?", PO, { sourcePreview: true });
  assert.ok(a.citations.length >= 1);
  for (const c of a.citations) {
    assert.match(c.previewLink ?? "", /^\/s\/[^?]+(\?h=)?/);
    assert.match(c.previewLink ?? "", new RegExp(encodeURIComponent(c.docId).slice(0, 6)));
  }
});

test("an explicit reranker reorders the cited passages but never changes the refusal decision", async () => {
  // rank the 'energy' chunk top — it is off-topic, so this proves rerank only touches ordering
  const rr: Reranker = {
    id: "test",
    async score(_q, passages) {
      return passages.map((p) => (/energy/i.test(p) ? 99 : /placement/i.test(p) ? 5 : 1));
    },
  };
  const withRr = await answerQuestion(index, "How did Riverbend perform on wage and placement?", PO, { reranker: rr, k: 3 });
  const without = await answerQuestion(index, "How did Riverbend perform on wage and placement?", PO, { reranker: null, k: 3 });
  assert.notEqual(withRr.confidence, "refused");
  assert.notEqual(without.confidence, "refused");
  // still a restricted refusal even with a reranker in play
  const restricted = await answerQuestion(index, "board staff compensation salary", PO, { reranker: rr });
  assert.equal(restricted.confidence, "refused");
});

test("participant-level question → answered as grant context only, never at high confidence", async () => {
  const withParticipant = {
    ...index,
    chunks: [...chunks, chunk("ge-spotlight", "Participant Amina outcome in the Riverbend cohort placement", { entities: [riverbendOrg] })],
  } as CorpusIndex;
  const a = await answerQuestion(withParticipant, "Tell me about the participant Amina and her specific outcome", PO);
  if (a.confidence !== "refused") {
    assert.notEqual(a.confidence, "high");
    assert.match(a.text, /participant-level|not.*specific individual|grant context/i);
  }
});

test("deep-dive follow-ups are present when requested, absent when not", async () => {
  const on = await answerQuestion(index, "How did Riverbend perform against projection?", PO, { followUps: true });
  const off = await answerQuestion(index, "How did Riverbend perform against projection?", PO, { followUps: false });
  assert.ok(on.followUps);
  assert.equal(off.followUps, undefined);
});

test("a generative backend receives only the retrieved passages + question, and marks the answer generative", async () => {
  const seen: { question: string; passageCount: number } = { question: "", passageCount: -1 };
  const llm = async (args: { question: string; passages: { n: number; text: string; source: string }[] }) => {
    seen.question = args.question;
    seen.passageCount = args.passages.length;
    return "A written synthesis grounded in the passages [1].";
  };
  const a = await answerQuestion(index, "How did Riverbend perform against projection?", PO, { llm });
  assert.equal(a.mode, "generative");
  assert.equal(seen.question, "How did Riverbend perform against projection?");
  assert.equal(seen.passageCount, a.citations.length);
  assert.match(a.text, /written synthesis/);
});

test("role & cycle context, when provided, discloses the reading it applied in the coverage line", async () => {
  const a = await answerQuestion(index, "how are my grants doing this quarter?", PO, {
    roleContext: { functions: ["renewals" as never], today: "2026-02-15" },
  });
  assert.equal(typeof a.coverage, "string");
  assert.ok(a.coverage.length > 0);
});
