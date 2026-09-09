import { test } from "node:test";
import assert from "node:assert/strict";
import { rerankHits, RERANK_POOL } from "../src/retrieval/rerank.js";
import { configuredRerankerId, getReranker, getConfiguredReranker, registerReranker, type Reranker } from "../src/embed/reranker.js";
import type { Scored } from "../src/retrieval/search.js";

const scored = (id: string, text: string): Scored =>
  ({ chunk: { id, docId: id, text } as never, score: 0, bm25: 0, semantic: 0 });

const fakeReranker = (byText: Record<string, number>): Reranker => ({
  id: "fake",
  async score(_q, passages) {
    return passages.map((p) => byText[p] ?? 0);
  },
});

test("configuredRerankerId: off by default and on the off-ish values", () => {
  assert.equal(configuredRerankerId({}), null);
  assert.equal(configuredRerankerId({ COMPASS_RERANK: "" }), null);
  assert.equal(configuredRerankerId({ COMPASS_RERANK: "0" }), null);
  assert.equal(configuredRerankerId({ COMPASS_RERANK: "false" }), null);
  assert.equal(configuredRerankerId({ COMPASS_RERANK: "off" }), null);
});

test("configuredRerankerId: '1'/'true'/'on' → the default model; an id passes through", () => {
  assert.equal(configuredRerankerId({ COMPASS_RERANK: "1" }), "bge-reranker-base");
  assert.equal(configuredRerankerId({ COMPASS_RERANK: "true" }), "bge-reranker-base");
  assert.equal(configuredRerankerId({ COMPASS_RERANK: "on" }), "bge-reranker-base");
  assert.equal(configuredRerankerId({ COMPASS_RERANK: "bge-reranker-v2-m3" }), "bge-reranker-v2-m3");
  assert.equal(configuredRerankerId({ COMPASS_RERANK: "  1  " }), "bge-reranker-base");
});

test("getReranker: unknown id → null; a registered factory resolves and caches", async () => {
  assert.equal(await getReranker("nope-not-registered"), null);
  let calls = 0;
  registerReranker("test-rr", async () => {
    calls++;
    return fakeReranker({});
  });
  const a = await getReranker("test-rr");
  const b = await getReranker("test-rr");
  assert.ok(a && a === b);
  assert.equal(calls, 1, "factory memoised");
});

test("getReranker: a factory that throws → null, and the cache is cleared for a retry", async () => {
  let attempt = 0;
  registerReranker("flaky-rr", async () => {
    attempt++;
    if (attempt === 1) throw new Error("boom");
    return fakeReranker({});
  });
  assert.equal(await getReranker("flaky-rr"), null);
  assert.ok(await getReranker("flaky-rr"), "second attempt succeeds after cache clear");
});

test("getConfiguredReranker: null when the env says off, resolves when it names a registered id", async () => {
  assert.equal(await getConfiguredReranker({}), null);
  registerReranker("env-rr", async () => fakeReranker({}));
  assert.ok(await getConfiguredReranker({ COMPASS_RERANK: "env-rr" }));
});

test("rerankHits: no-op with no reranker, or fewer than two hits", async () => {
  const hits = [scored("a", "x"), scored("b", "y")];
  assert.equal(await rerankHits("q", hits, null), hits);
  const one = [scored("a", "x")];
  assert.equal(await rerankHits("q", one, fakeReranker({})), one);
});

test("rerankHits: reorders by cross-encoder score, descending", async () => {
  const hits = [scored("a", "low"), scored("b", "high"), scored("c", "mid")];
  const out = await rerankHits("q", hits, fakeReranker({ low: -5, mid: 1, high: 9 }));
  assert.deepEqual(out.map((h) => h.chunk.id), ["b", "c", "a"]);
  assert.equal(out.length, hits.length, "reordering never drops a hit");
});

test("rerankHits: a model error or a bad-length result falls back to the first-pass order", async () => {
  const hits = [scored("a", "x"), scored("b", "y")];
  const thrower: Reranker = { id: "t", async score() { throw new Error("down"); } };
  assert.equal(await rerankHits("q", hits, thrower), hits);
  const wrongLen: Reranker = { id: "w", async score() { return [1]; } };
  assert.equal(await rerankHits("q", hits, wrongLen), hits);
  const nan: Reranker = { id: "n", async score(_q, p) { return p.map(() => NaN); } };
  assert.equal(await rerankHits("q", hits, nan), hits);
});

test("RERANK_POOL is a sane candidate-pool size", () => {
  assert.ok(RERANK_POOL >= 10 && RERANK_POOL <= 100);
});
