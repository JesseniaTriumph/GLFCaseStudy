import { test } from "node:test";
import assert from "node:assert/strict";
import { retrieve } from "../src/retrieval/search.js";
import { tokenize, tfidfVector } from "../src/util/text.js";
import type { Chunk, CorpusIndex, Principal } from "../src/core/types.js";

const DF: Record<string, number> = { riverbend: 1, wage: 2, placement: 2, board: 1, salary: 1, compensation: 1, care: 2, grant: 4 };

function chunk(id: string, text: string, over: Partial<Chunk> = {}): Chunk {
  const tokens = tokenize(text);
  return {
    id,
    docId: over.docId ?? id,
    system: "givingdata",
    deepLink: `https://example/${id}`,
    docTitle: over.docTitle ?? id,
    text,
    date: "2025-06-01",
    tier: over.tier ?? "team",
    acl: over.acl ?? ["*"],
    entities: over.entities ?? [],
    tokens,
    vector: tfidfVector(tokens, DF, 5),
    ...over,
  };
}

const chunks: Chunk[] = [
  chunk("c-river-1", "Riverbend Care Collective wage and placement outcomes for the grant", {
    entities: [{ kind: "organization", id: "org:riverbend", label: "Riverbend Care Collective" }],
  }),
  chunk("c-river-2", "Riverbend Care Collective second passage about placement pace", {
    docId: "c-river-1",
    entities: [{ kind: "organization", id: "org:riverbend", label: "Riverbend Care Collective" }],
  }),
  chunk("c-other", "An unrelated grant about rural energy training", {}),
  chunk("c-po", "Program officer candid notes on Riverbend wage quality", { tier: "programs-only", acl: ["group:programs"] }),
  chunk("c-stub", "board salary compensation review", { tier: "restricted", restrictedStub: true, acl: [] }),
];

const index = {
  chunks,
  df: DF,
  docCount: 5,
  avgDocLen: 8,
  entities: [{ kind: "organization", id: "org:riverbend", label: "Riverbend Care Collective" }],
} as unknown as CorpusIndex;

const PO: Principal = { userId: "dana", groups: ["programs"], allowedTiers: ["team", "programs-only"] };
const COMMS: Principal = { userId: "cj", groups: ["comms"], allowedTiers: ["team"] };

test("retrieve: ranks the on-topic org chunks first for a Program Officer", () => {
  const r = retrieve(index, "How did Riverbend Care Collective do on wage and placement?", PO, 5);
  assert.ok(r.hits.length >= 2);
  assert.match(r.hits[0]!.chunk.text, /Riverbend/);
});

test("retrieve: per-doc cap keeps one doc from flooding the results", () => {
  const r = retrieve(index, "Riverbend placement", PO, 5);
  const fromDoc = r.hits.filter((h) => h.chunk.docId === "c-river-1").length;
  assert.ok(fromDoc <= 2);
});

test("retrieve: Comms never receives the programs-only chunk, and it is counted as withheld", () => {
  const r = retrieve(index, "Riverbend wage quality program officer notes", COMMS);
  assert.ok(!r.hits.some((h) => h.chunk.id === "c-po"));
  assert.ok(r.withheld.count >= 1);
  assert.ok(r.withheld.tiers.includes("programs-only"));
});

test("retrieve: a restricted stub that matches the query raises the withheld/restricted signal but never returns content", () => {
  const r = retrieve(index, "board salary compensation review", PO, 5);
  assert.ok(!r.hits.some((h) => h.chunk.restrictedStub));
  assert.ok(r.withheld.tiers.includes("restricted"));
  assert.ok(r.withheld.restrictedTopScore > 0);
});

test("retrieve: an unrelated query still returns something or nothing, never throws", () => {
  const r = retrieve(index, "xylophone quantum toaster", PO, 5);
  assert.ok(Array.isArray(r.hits));
});
