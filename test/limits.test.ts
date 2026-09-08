import { test } from "node:test";
import assert from "node:assert/strict";
import { RateLimiter } from "../src/server/limits.js";

const cfg = (now: () => number) => ({
  rate: { capacity: 3, refillPerSec: 1 },
  cost: { capacity: 2, refillPerSec: 0.5 },
  now,
});

test("allows up to capacity, then denies with limit=rate and a Retry-After", () => {
  let t = 0;
  const rl = new RateLimiter(cfg(() => t));
  assert.equal(rl.check("k", 0).ok, true);
  assert.equal(rl.check("k", 0).ok, true);
  assert.equal(rl.check("k", 0).ok, true);
  const d = rl.check("k", 0);
  assert.equal(d.ok, false);
  assert.equal(d.limit, "rate");
  assert.ok((d.retryAfter ?? 0) >= 1);
});

test("the rate bucket refills over time", () => {
  let t = 0;
  const rl = new RateLimiter(cfg(() => t));
  for (let i = 0; i < 3; i++) rl.check("k", 0);
  assert.equal(rl.check("k", 0).ok, false);
  t = 2000; // +2s → +2 tokens
  assert.equal(rl.check("k", 0).ok, true);
});

test("the cost bucket denies independently with limit=cost", () => {
  let t = 0;
  const rl = new RateLimiter(cfg(() => t));
  assert.equal(rl.check("k", 1).ok, true);
  assert.equal(rl.check("k", 1).ok, true);
  const d = rl.check("k", 1);
  assert.equal(d.ok, false);
  assert.equal(d.limit, "cost");
});

test("keys are independent", () => {
  let t = 0;
  const rl = new RateLimiter(cfg(() => t));
  for (let i = 0; i < 3; i++) rl.check("a", 0);
  assert.equal(rl.check("a", 0).ok, false);
  assert.equal(rl.check("b", 0).ok, true);
});

test("peek reports remaining tokens without consuming", () => {
  let t = 0;
  const rl = new RateLimiter(cfg(() => t));
  rl.check("k", 0);
  const p1 = rl.peek("k");
  const p2 = rl.peek("k");
  assert.equal(p1.rate, p2.rate);
  assert.ok(p1.rate < 3);
});
