/**
 * Web build: tf-idf only. The web app always loads the tf-idf corpus index (it runs
 * retrieval in the browser and can't host a transformer), so this is just the cosine
 * helper + a no-op resolver. The full embedder lives in ../../../src/embed for the CLI.
 */
export interface Embedder {
  id: string;
  dims: number;
  embed(texts: string[]): Promise<number[][]>;
}

export function cosineDense(a: number[], b: number[]): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) d += a[i]! * b[i]!;
  return d;
}

export async function getEmbedder(_id: string): Promise<Embedder | null> {
  return null; // web index is tf-idf; query embedding is never needed
}
