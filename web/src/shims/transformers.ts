/**
 * Browser stub for `@huggingface/transformers`.
 *
 * The web app runs retrieval in the browser against a tf-idf corpus index — it never loads
 * a local sentence-transformer or cross-encoder. The shared retrieval core (`../../../src`)
 * only reaches `@huggingface/transformers` through dynamic `import()`s that are guarded by
 * `index.embedder` / `COMPASS_RERANK`, neither of which is ever set in the browser. This
 * stub satisfies the bundler for those dead paths; calling into it is a programming error.
 */
const unavailable = () => {
  throw new Error("@huggingface/transformers is not available in the browser build");
};

export const pipeline = unavailable;
export const AutoTokenizer = { from_pretrained: unavailable };
export const AutoModelForSequenceClassification = { from_pretrained: unavailable };
export const env: Record<string, unknown> = {};
export type FeatureExtractionPipeline = never;
export type PreTrainedTokenizer = never;
export type PreTrainedModel = never;
