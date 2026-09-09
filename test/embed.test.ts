import { test } from "node:test";
import assert from "node:assert/strict";
import { cosineDense, registerEmbedder, getEmbedder, type Embedder } from "../src/embed/embedder.js";

test("cosineDense: dot product of unit-normalised vectors, shortest length wins", () => {
  assert.equal(cosineDense([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(cosineDense([1, 0], [0, 1]), 0);
  assert.equal(Math.round(cosineDense([0.6, 0.8], [0.6, 0.8]) * 100) / 100, 1);
  // extra dims on one side are ignored
  assert.equal(cosineDense([1, 0, 0], [1, 0]), 1);
});

const fake = (dims = 3): Embedder => ({
  id: "fake",
  dims,
  async embed(texts) {
    return texts.map((_, i) => Array.from({ length: dims }, (_, d) => (d === i % dims ? 1 : 0)));
  },
});

test("getEmbedder: unknown id → null", async () => {
  assert.equal(await getEmbedder("no-such-embedder"), null);
});

test("getEmbedder: a registered factory resolves once and is cached", async () => {
  let calls = 0;
  registerEmbedder("test-embed", async () => {
    calls++;
    return fake();
  });
  const a = await getEmbedder("test-embed");
  const b = await getEmbedder("test-embed");
  assert.ok(a && a === b);
  assert.equal(calls, 1);
  assert.deepEqual((await a!.embed(["x"]))[0]!.length, 3);
});

test("getEmbedder: a throwing factory → null and the cache is cleared for a retry", async () => {
  let n = 0;
  registerEmbedder("flaky-embed", async () => {
    n++;
    if (n === 1) throw new Error("model download failed");
    return fake();
  });
  assert.equal(await getEmbedder("flaky-embed"), null);
  assert.ok(await getEmbedder("flaky-embed"));
});
