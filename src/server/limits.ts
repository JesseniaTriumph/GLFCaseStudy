/**
 * Per-user rate + cost limiting (strategy doc §6.10; security review R7).
 *
 * Two independent token buckets keyed by the caller's stable id (session subject, falling
 * back to client IP for unauthenticated routes):
 *   - `rate`  — requests per minute, smooths bursts
 *   - `cost`  — a rough LLM-spend budget per hour, so one person can't run the bill up
 *
 * In-process and deterministic — good enough for a single API node and for the demo. In
 * production this is the same interface backed by Redis (per-key INCR + EXPIRE) so it holds
 * across replicas, and the cost unit is wired to real token accounting from the LLM client.
 */

export interface BucketConfig {
  /** tokens the bucket holds when full */
  capacity: number;
  /** tokens added back per second */
  refillPerSec: number;
}

interface Bucket {
  tokens: number;
  last: number;
}

export interface LimitConfig {
  rate: BucketConfig;
  cost: BucketConfig;
  /** wall clock, injectable for tests */
  now?: () => number;
}

export const DEFAULT_LIMITS: LimitConfig = {
  // 30 requests/min, burst up to 10
  rate: { capacity: 10, refillPerSec: 0.5 },
  // ~60 "cost units"/hour, burst 20 — one /api/ask with generation ≈ 1 unit
  cost: { capacity: 20, refillPerSec: 60 / 3600 },
};

export interface LimitDecision {
  ok: boolean;
  /** which bucket denied it, when ok === false */
  limit?: "rate" | "cost";
  /** seconds until the caller could retry (ceil) */
  retryAfter?: number;
  /** remaining whole tokens in the rate bucket, for X-RateLimit-Remaining */
  remaining: number;
}

export class RateLimiter {
  private rate = new Map<string, Bucket>();
  private cost = new Map<string, Bucket>();
  private cfg: LimitConfig;
  private now: () => number;

  constructor(cfg: LimitConfig = DEFAULT_LIMITS) {
    this.cfg = cfg;
    this.now = cfg.now ?? Date.now;
  }

  private take(map: Map<string, Bucket>, key: string, bc: BucketConfig, amount: number): { ok: boolean; tokens: number } {
    const t = this.now() / 1000;
    let b = map.get(key);
    if (!b) {
      b = { tokens: bc.capacity, last: t };
      map.set(key, b);
    }
    b.tokens = Math.min(bc.capacity, b.tokens + (t - b.last) * bc.refillPerSec);
    b.last = t;
    if (b.tokens >= amount) {
      b.tokens -= amount;
      return { ok: true, tokens: b.tokens };
    }
    return { ok: false, tokens: b.tokens };
  }

  /**
   * Charge one request (and `costUnits` of budget) against `key`. Call before doing the
   * work; if it returns ok:false, send 429 with Retry-After and do nothing else.
   */
  check(key: string, costUnits = 1): LimitDecision {
    const r = this.take(this.rate, key, this.cfg.rate, 1);
    if (!r.ok) {
      const wait = Math.ceil((1 - r.tokens) / this.cfg.rate.refillPerSec);
      return { ok: false, limit: "rate", retryAfter: wait, remaining: Math.floor(r.tokens) };
    }
    const c = this.take(this.cost, key, this.cfg.cost, costUnits);
    if (!c.ok) {
      const wait = Math.ceil((costUnits - c.tokens) / this.cfg.cost.refillPerSec);
      return { ok: false, limit: "cost", retryAfter: wait, remaining: Math.floor(r.tokens) };
    }
    return { ok: true, remaining: Math.floor(r.tokens) };
  }

  /** test/introspection helper */
  peek(key: string): { rate: number; cost: number } {
    return { rate: this.rate.get(key)?.tokens ?? this.cfg.rate.capacity, cost: this.cost.get(key)?.tokens ?? this.cfg.cost.capacity };
  }
}
