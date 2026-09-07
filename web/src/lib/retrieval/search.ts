import type { Chunk, CorpusIndex, Principal } from "../core/types.js";
import { tokenize, tfidfVector, cosine } from "../util/text.js";
import { cosineDense } from "../embed/embedder.js";

const BM25_K1 = 1.4;
const BM25_B = 0.75;

export interface Scored {
  chunk: Chunk;
  score: number;
  bm25: number;
  semantic: number;
}

export interface RetrieveResult {
  hits: Scored[];
  /** chunks that matched but were filtered out by permission or restricted-exclusion */
  withheld: { count: number; tiers: string[]; restrictedTopScore: number };
}

/** The principal ids a chunk ACL is matched against. */
export function principalIds(principal: Principal): Set<string> {
  return new Set([`user:${principal.userId}`, ...principal.groups.map((g) => `group:${g}`), "*"]);
}

/** Can this principal read this chunk? tier AND acl — the security boundary. */
export function mayRead(chunk: Pick<Chunk, "tier" | "acl">, principal: Principal): boolean {
  const ids = principalIds(principal);
  return principal.allowedTiers.includes(chunk.tier) && chunk.acl.some((p) => ids.has(p));
}

/**
 * Rank a set of chunks the caller is ALREADY entitled to read. Hybrid BM25 + tf-idf
 * cosine + entity boost, entity focus, per-doc de-duplication. This is the ranking half —
 * identical whether the permitted set came from an in-memory filter or a SQL WHERE clause.
 */
export function rankPermitted(
  permitted: Chunk[],
  query: string,
  index: CorpusIndex,
  k: number,
  queryDense?: number[]
): Scored[] {
  const qTokens = tokenize(query);
  const qVec = tfidfVector(qTokens, index.df, index.docCount);
  const qSet = new Set(qTokens);

  const scored: Scored[] = [];
  for (const c of permitted) {
    const bm25 = bm25Score(c, qSet, index);
    // learned embedding when the index has one; tf-idf cosine otherwise. Sentence-transformer
    // cosines have a high baseline (~0.4 for unrelated English), so rescale into roughly the
    // same range the downstream thresholds expect from tf-idf.
    const semantic =
      queryDense && c.dense
        ? Math.max(0, (cosineDense(queryDense, c.dense) - 0.4) * 0.5)
        : cosine(qVec, c.vector);
    const eBoost = entityBoost(c, query);
    if (bm25 === 0 && semantic < 0.02 && eBoost === 0) continue;
    scored.push({ chunk: c, score: 0.6 * normalize(bm25, 8) + 0.4 * semantic + eBoost, bm25, semantic });
  }
  scored.sort((a, b) => b.score - a.score);

  // Entity focus: if the query names a known organization, prefer chunks about it.
  const qLower = query.toLowerCase();
  const focus = index.entities
    .filter((e) => e.kind === "organization" && e.label.length > 3 && qLower.includes(e.label.toLowerCase()))
    .map((e) => e.id);
  let pool = scored;
  if (focus.length) {
    const on = scored.filter((s) => s.chunk.entities.some((e) => e.kind === "organization" && focus.includes(e.id)));
    if (on.length >= 2) pool = on;
  }

  const perDoc: Record<string, number> = {};
  const hits: Scored[] = [];
  for (const s of pool) {
    const n = perDoc[s.chunk.docId] ?? 0;
    if (n >= 2) continue;
    perDoc[s.chunk.docId] = n + 1;
    hits.push(s);
    if (hits.length >= k) break;
  }
  return hits;
}

/** Score a restricted stub against the query — used to decide whether to refuse. */
export function stubScore(stub: Chunk, query: string, index: CorpusIndex): number {
  return bm25Score(stub, new Set(tokenize(query)), index);
}

/**
 * In-memory hybrid retrieval. Splits the corpus into permitted / withheld (the security
 * boundary), then ranks the permitted set. The SQL-backed path (src/db/store.ts) does the
 * same split as a WHERE clause and calls rankPermitted directly.
 */
export function retrieve(
  index: CorpusIndex,
  query: string,
  principal: Principal,
  k = 8,
  queryDense?: number[]
): RetrieveResult {
  const permitted: Chunk[] = [];
  let withheldCount = 0;
  let restrictedTopScore = 0;
  const withheldTiers = new Set<string>();

  for (const c of index.chunks) {
    if (c.restrictedStub) {
      const s = stubScore(c, query, index);
      if (s > 0.4) {
        withheldCount++;
        withheldTiers.add("restricted");
        restrictedTopScore = Math.max(restrictedTopScore, s);
      }
      continue;
    }
    if (mayRead(c, principal)) {
      permitted.push(c);
    } else {
      withheldCount++;
      withheldTiers.add(c.tier);
    }
  }

  const hits = rankPermitted(permitted, query, index, k, queryDense);
  return { hits, withheld: { count: withheldCount, tiers: [...withheldTiers], restrictedTopScore } };
}

function bm25Score(c: Chunk, qSet: Set<string>, index: CorpusIndex): number {
  const tf: Record<string, number> = {};
  for (const t of c.tokens) if (qSet.has(t)) tf[t] = (tf[t] ?? 0) + 1;
  let score = 0;
  const dl = c.tokens.length || 1;
  for (const [t, f] of Object.entries(tf)) {
    const n = index.df[t] ?? 0.5;
    const idf = Math.log(1 + (index.docCount - n + 0.5) / (n + 0.5));
    score += idf * ((f * (BM25_K1 + 1)) / (f + BM25_K1 * (1 - BM25_B + (BM25_B * dl) / index.avgDocLen)));
  }
  return score;
}

function entityBoost(c: Chunk, query: string): number {
  const q = query.toLowerCase();
  let b = 0;
  for (const e of c.entities) {
    if (e.label && q.includes(e.label.toLowerCase())) b += e.kind === "organization" ? 0.25 : 0.15;
  }
  return b;
}

function normalize(x: number, ceil: number): number {
  return Math.min(x, ceil) / ceil;
}
