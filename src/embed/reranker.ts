/**
 * Pluggable cross-encoder reranker (roadmap 2.5).
 *
 * The hybrid first pass (BM25 + tf-idf / bge-small cosine, `retrieval/search.ts`) scores the
 * query and each chunk *separately*, so it only approximates relevance. A cross-encoder reads
 * the query and one passage *together* and emits a single relevance score — far more accurate,
 * far too slow to run corpus-wide. So it runs as a second pass over the ~30 candidates the
 * first pass already surfaced: retrieve-then-rerank.
 *
 * Off by default. Opt in with `COMPASS_RERANK=1` (uses `bge-reranker-base`, English) or
 * `COMPASS_RERANK=<model-id>`. The model is a local ONNX run via transformers.js — no API
 * key, weights cached after first use, fail-soft to no-rerank if it can't load.
 *
 * It runs strictly *after* the permission filter (`answerQuestion` calls it on the hits the
 * retriever already returned), so it can only reorder passages the caller may already read —
 * it has no security surface.
 *
 * Production upgrade: point `COMPASS_RERANK` at `bge-reranker-v2-m3` (multilingual, for the
 * Spanish corpus) served on a GPU endpoint. Same interface (`docs/TRD.md` §Embedder service).
 */

export interface Reranker {
  /** stable id, for logging */
  id: string;
  /** relevance score per passage for the query — higher = more relevant. Order matches `passages`. */
  score(query: string, passages: string[]): Promise<number[]>;
}

const REGISTRY = new Map<string, () => Promise<Reranker>>();

export function registerReranker(id: string, factory: () => Promise<Reranker>): void {
  REGISTRY.set(id, factory);
}

const cache = new Map<string, Promise<Reranker>>();

/** Resolve a reranker by id, or null if not registered / not loadable. */
export async function getReranker(id: string): Promise<Reranker | null> {
  if (!REGISTRY.has(id)) return null;
  if (!cache.has(id)) cache.set(id, REGISTRY.get(id)!());
  try {
    return await cache.get(id)!;
  } catch (e) {
    cache.delete(id);
    console.warn(`reranker "${id}" failed to load (${(e as Error).message}) — continuing without reranking`);
    return null;
  }
}

/**
 * The reranker id the environment asks for, or null when reranking is off.
 *   COMPASS_RERANK unset / "0" / "false"  → null
 *   COMPASS_RERANK = "1" / "true"         → the default English model
 *   COMPASS_RERANK = "<model-id>"         → that model
 */
export function configuredRerankerId(env: NodeJS.ProcessEnv = process.env): string | null {
  const v = (env.COMPASS_RERANK ?? "").trim();
  if (!v || v === "0" || v === "false" || v === "off") return null;
  if (v === "1" || v === "true" || v === "on") return "bge-reranker-base";
  return v;
}

/** Convenience: the configured reranker instance, or null. Cached. */
export async function getConfiguredReranker(env: NodeJS.ProcessEnv = process.env): Promise<Reranker | null> {
  const id = configuredRerankerId(env);
  return id ? getReranker(id) : null;
}

// --- register the transformers.js cross-encoders lazily (import only when used) ---
registerReranker("bge-reranker-base", async () => (await import("./transformers.js")).makeCrossEncoder("Xenova/bge-reranker-base"));
registerReranker("bge-reranker-v2-m3", async () => (await import("./transformers.js")).makeCrossEncoder("Xenova/bge-reranker-v2-m3"));
