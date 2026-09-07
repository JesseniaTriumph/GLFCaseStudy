/**
 * Pluggable embeddings.
 *
 * v1 default is a dependency-free tf-idf sparse vector (always available, offline). Opt in
 * to real learned embeddings with `--embed bge-small` on the build — a local
 * sentence-transformer via transformers.js, no API key, weights cached after first run.
 * In production this same interface fronts BGE-M3 on a self-hosted endpoint or a managed
 * embeddings API under a DPA (strategy doc §6.5) — the pipeline and retrieval don't change.
 */

export interface Embedder {
  /** stable id recorded in the index so retrieval knows how to embed the query */
  id: string;
  dims: number;
  /** batch embed; returns one unit-normalised vector per input */
  embed(texts: string[]): Promise<number[][]>;
}

/** cosine of two dense vectors (assumed unit-normalised, so this is a dot product). */
export function cosineDense(a: number[], b: number[]): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) d += a[i]! * b[i]!;
  return d;
}

const REGISTRY = new Map<string, () => Promise<Embedder>>();

export function registerEmbedder(id: string, factory: () => Promise<Embedder>): void {
  REGISTRY.set(id, factory);
}

const cache = new Map<string, Promise<Embedder>>();

/** Resolve an embedder by id, or null if not registered / not loadable. */
export async function getEmbedder(id: string): Promise<Embedder | null> {
  if (!REGISTRY.has(id)) return null;
  if (!cache.has(id)) cache.set(id, REGISTRY.get(id)!());
  try {
    return await cache.get(id)!;
  } catch (e) {
    cache.delete(id);
    console.warn(`embedder "${id}" failed to load (${(e as Error).message}) — falling back to tf-idf`);
    return null;
  }
}

// --- register the transformers.js embedders lazily (import only when used) ---
registerEmbedder("bge-small", async () => (await import("./transformers.js")).makeSentenceTransformer("Xenova/bge-small-en-v1.5", 384));
registerEmbedder("minilm", async () => (await import("./transformers.js")).makeSentenceTransformer("Xenova/all-MiniLM-L6-v2", 384));
