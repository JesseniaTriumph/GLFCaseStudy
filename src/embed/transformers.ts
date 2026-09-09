/**
 * transformers.js models run locally in Node (ONNX runtime) — no API key, weights
 * downloaded once and cached under node_modules/.cache. Imported only when an `--embed`
 * build or `COMPASS_RERANK` actually asks for one.
 */
import {
  pipeline,
  AutoTokenizer,
  AutoModelForSequenceClassification,
  type FeatureExtractionPipeline,
  type PreTrainedTokenizer,
  type PreTrainedModel,
} from "@huggingface/transformers";
import type { Embedder } from "./embedder.js";
import type { Reranker } from "./reranker.js";

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

/**
 * Cross-encoder reranker (e.g. BAAI/bge-reranker-*). These are sequence-classification
 * models with a single output — the relevance logit for a (query, passage) pair. We drive
 * the tokenizer + model directly rather than through a pipeline: transformers.js 4.x has no
 * `text-ranking` pipeline, and the tokenizer's `text_pair` batching is exactly what a
 * cross-encoder needs.
 */
export function makeCrossEncoder(model: string): Promise<Reranker> {
  // Quantized ONNX by default: ~280MB / a few seconds to load, vs ~1.1GB / minutes for fp32,
  // with no meaningful ranking-quality loss at rerank sizes (~30 passages). Override with
  // COMPASS_RERANK_DTYPE (fp32 | fp16 | q8 | int8 | …) if a deployment wants full precision.
  const dtype = (process.env.COMPASS_RERANK_DTYPE || "q8") as never;
  let loaded: Promise<{ tokenizer: PreTrainedTokenizer; model: PreTrainedModel }> | null = null;
  const load = () =>
    (loaded ??= Promise.all([
      AutoTokenizer.from_pretrained(model),
      AutoModelForSequenceClassification.from_pretrained(model, { dtype }),
    ]).then(([tokenizer, m]) => ({ tokenizer, model: m })));

  const reranker: Reranker = {
    id: model.split("/").pop()!,
    async score(query: string, passages: string[]): Promise<number[]> {
      if (passages.length === 0) return [];
      const { tokenizer, model: m } = await load();
      const inputs = tokenizer(new Array(passages.length).fill(query), {
        text_pair: passages,
        padding: true,
        truncation: true,
      });
      const { logits } = await m(inputs);
      // logits: [N, 1] (relevance) — some rerankers emit [N, 2]; take the last column either way.
      const data = Array.from(logits.data as Float32Array);
      const cols = logits.dims.at(-1) ?? 1;
      return passages.map((_, i) => data[i * cols + (cols - 1)]!);
    },
  };
  return Promise.resolve(reranker);
}
