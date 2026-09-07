import type { Chunk, CorpusIndex, Principal } from "../core/types.js";
import { tokenize, tfidfVector, cosine } from "../util/text.js";

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

/**
 * Hybrid retrieval: BM25 (exact terms — grant IDs, dollar figures, org names) +
 * tf-idf cosine (looser semantic match), then permission-filter to what the principal
 * may see. The permission filter is the security boundary and runs on every query.
 */
export function retrieve(index: CorpusIndex, query: string, principal: Principal, k = 8): RetrieveResult {
  const qTokens = tokenize(query);
  const qVec = tfidfVector(qTokens, index.df, index.docCount);
  const qSet = new Set(qTokens);

  const allowedTiers = new Set(principal.allowedTiers);
  const principalPrincipals = new Set([`user:${principal.userId}`, ...principal.groups.map((g) => `group:${g}`), "*"]);

  let withheldCount = 0;
  let restrictedTopScore = 0;
  const withheldTiers = new Set<string>();
  const scored: Scored[] = [];

  for (const c of index.chunks) {
    const bm25 = bm25Score(c, qSet, index);
    const semantic = cosine(qVec, c.vector);

    // restricted stub: the index knows a doc on this topic exists but holds no content.
    if (c.restrictedStub) {
      if (bm25 > 0.4) {
        withheldCount++;
        withheldTiers.add("restricted");
        restrictedTopScore = Math.max(restrictedTopScore, bm25);
      }
      continue;
    }

    const eBoost = entityBoost(c, query);
    if (bm25 === 0 && semantic < 0.02 && eBoost === 0) continue;

    // --- permission filter ---
    const tierOk = allowedTiers.has(c.tier);
    const aclOk = c.acl.some((p) => principalPrincipals.has(p));
    if (!tierOk || !aclOk) {
      withheldCount++;
      withheldTiers.add(c.tier);
      continue;
    }

    const score = 0.6 * normalize(bm25, 8) + 0.4 * semantic + eBoost;
    scored.push({ chunk: c, score, bm25, semantic });
  }

  scored.sort((a, b) => b.score - a.score);

  // Entity focus: if the query names a known organization, prefer chunks about that org.
  const qLower = query.toLowerCase();
  const focusOrgIds = index.entities
    .filter((e) => e.kind === "organization" && e.label.length > 3 && qLower.includes(e.label.toLowerCase()))
    .map((e) => e.id);
  let pool = scored;
  if (focusOrgIds.length) {
    const onFocus = scored.filter((s) => s.chunk.entities.some((e) => e.kind === "organization" && focusOrgIds.includes(e.id)));
    if (onFocus.length >= 2) pool = onFocus;
  }

  // de-duplicate by doc: keep the best chunk per doc, then allow a 2nd from the same doc lower down
  const perDoc: Record<string, number> = {};
  const hits: Scored[] = [];
  for (const s of pool) {
    const n = perDoc[s.chunk.docId] ?? 0;
    if (n >= 2) continue;
    perDoc[s.chunk.docId] = n + 1;
    hits.push(s);
    if (hits.length >= k) break;
  }

  return { hits, withheld: { count: withheldCount, tiers: [...withheldTiers], restrictedTopScore } };
}

function bm25Score(c: Chunk, qSet: Set<string>, index: CorpusIndex): number {
  const tf: Record<string, number> = {};
  for (const t of c.tokens) if (qSet.has(t)) tf[t] = (tf[t] ?? 0) + 1;
  let score = 0;
  const dl = c.tokens.length;
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
