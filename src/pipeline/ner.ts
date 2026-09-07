/**
 * Optional NER-based name redaction (roadmap 3.2, security review A7 "production PII").
 *
 * The deterministic pass in `pii.ts` catches structured identifiers (email, phone, SSN,
 * card, …) but not free-text person names. When `COMPASS_PII_NER=true`, this runs a local
 * token-classification model (transformers.js, ONNX, no API key) over each document and
 * redacts spans tagged PER. It is opt-in because it adds a model download and CPU cost;
 * the offline-guaranteed default stays the deterministic pass + the participant-data
 * heuristic + tier-raise + quarantine.
 *
 * In a real deployment this is paired with a review queue: a redaction the model is
 * unsure about is surfaced for a human rather than applied silently.
 */
import type { PiiFinding } from "./pii.js";

export interface NerRedactor {
  id: string;
  redact(text: string): Promise<{ text: string; findings: PiiFinding[] }>;
}

/** Build a redactor from a HF token-classification model (default: a NER BERT). */
export async function makeNerRedactor(model = "Xenova/bert-base-multilingual-cased-ner-hrl"): Promise<NerRedactor> {
  const { pipeline } = await import("@huggingface/transformers");
  const tagger = await pipeline("token-classification", model);

  return {
    id: model.split("/").pop()!,
    async redact(text: string) {
      // model context is short — run it over ~400-char windows and stitch
      const WIN = 400;
      let out = "";
      const spans = new Set<string>();
      for (let i = 0; i < text.length; i += WIN) {
        const piece = text.slice(i, i + WIN);
        const ents = (await tagger(piece)) as Array<{ entity?: string; entity_group?: string; word: string; score: number }>;
        let masked = piece;
        for (const e of ents) {
          const kind = (e.entity_group ?? e.entity ?? "").toUpperCase();
          if (!kind.includes("PER") || e.score < 0.85) continue;
          const w = e.word.replace(/^##/, "");
          if (w.length < 2) continue;
          spans.add(w);
          masked = masked.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), "[name]");
        }
        out += masked;
      }
      const findings: PiiFinding[] = spans.size ? [{ kind: "name", sample: `${spans.size} name span(s)`, count: spans.size }] : [];
      return { text: out, findings };
    },
  };
}
