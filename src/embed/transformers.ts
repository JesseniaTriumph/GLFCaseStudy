/**
 * transformers.js sentence-transformer embedder. Runs the model locally in Node (ONNX
 * runtime) — no API key, weights downloaded once and cached under node_modules/.cache.
 * Imported only when an `--embed` build actually asks for it.
 */
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import type { Embedder } from "./embedder.js";

export function makeSentenceTransformer(model: string, dims: number): Promise<Embedder> {
  let extractor: Promise<FeatureExtractionPipeline> | null = null;
  const load = () => (extractor ??= pipeline("feature-extraction", model));

  const embedder: Embedder = {
    id: model.split("/").pop()!.replace(/-en.*$/, "").replace(/^all-/, ""),
    dims,
    async embed(texts: string[]): Promise<number[][]> {
      const ex = await load();
      const out = await ex(texts, { pooling: "mean", normalize: true });
      const flat = Array.from(out.data as Float32Array);
      const rows: number[][] = [];
      for (let i = 0; i < texts.length; i++) rows.push(flat.slice(i * dims, (i + 1) * dims));
      return rows;
    },
  };
  return Promise.resolve(embedder);
}
