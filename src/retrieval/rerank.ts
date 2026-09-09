/**
 * Cross-encoder rerank stage (roadmap 2.5).
 *
 * Sits between retrieval and the answer: the retriever returns a wide candidate pool
 * (`RERANK_POOL`) already filtered to what the caller may read, and this reorders it by a
 * cross-encoder's query-passage relevance score before the answer layer trims to the top few.
 *
 * It is pure reordering — never adds, drops, edits, or re-permissions a hit — so it has no
 * bearing on the security boundary. Off unless `COMPASS_RERANK` is set (see
 * `../embed/reranker.ts`); fail-soft to the first-pass order on any model error.
 */
import type { Scored } from "./search.js";
import { getConfiguredReranker, type Reranker } from "../embed/reranker.js";

/** How many first-pass candidates the cross-encoder re-scores. */
export const RERANK_POOL = 30;

/**
 * Reorder `hits` by cross-encoder relevance, most-relevant first. Returns a new array.
 * Returns `hits` unchanged when reranking is off, there is nothing to reorder, or the model
 * fails to load / score.
 */
export async function rerankHits(query: string, hits: Scored[], reranker?: Reranker | null): Promise<Scored[]> {
  const rr = reranker === undefined ? await getConfiguredReranker() : reranker;
  if (!rr || hits.length < 2) return hits;
  try {
    const scores = await rr.score(query, hits.map((h) => h.chunk.text));
    if (scores.length !== hits.length || scores.some((s) => !Number.isFinite(s))) return hits;
    return hits
      .map((h, i) => ({ h, s: scores[i]! }))
      .sort((a, b) => b.s - a.s)
      .map(({ h }) => h);
  } catch (e) {
    console.warn(`rerank failed (${(e as Error).message}) — using first-pass order`);
    return hits;
  }
}
