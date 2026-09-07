/**
 * Translation at intake (roadmap 3.4 — "Colombia reports answerable with citations").
 *
 * A grantee in Colombia submits a report in Spanish. Someone in the US asks a question in
 * English. Two things have to work:
 *   1. retrieval must FIND the Spanish report from an English question, and
 *   2. the answer must be READABLE — an English-speaking program officer shouldn't have to
 *      puzzle through Spanish in the evidence brief.
 *
 * How Compass handles it, in order of fidelity:
 *   - `mt`        a local machine-translation model (transformers.js, opus-mt) — real
 *                 translation, no API key, ~300 MB download, opt-in with COMPASS_TRANSLATE=mt
 *   - `api`       a translation API (Google Cloud Translation / DeepL) via COMPASS_TRANSLATE_URL
 *   - `glossary`  a deterministic phrase glossary for grant/workforce terms — NOT real
 *                 translation, but it keeps the offline demo readable and shows the pipeline
 *   - (none)      fall back to the bilingual keyword bridge in util/text.ts: retrieval still
 *                 finds the doc, the brief shows the Spanish original
 *
 * In every mode the CITATION still deep-links to the Spanish original, and a translated
 * passage is marked "machine translation — verify against the source". Translation never
 * replaces the source of record; it makes it readable.
 */

export interface Translator {
  id: string;
  /** translate `text` to English; return it unchanged if already English or on failure */
  toEnglish(text: string, sourceLang: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// Glossary translator — deterministic, offline, phrase-level. Covers the Spanish that
// appears in grantee reports (headings, impact terms, the templated narrative). It is
// explicitly NOT a general translator; `mt` or `api` is the real one.

const ES_EN_PHRASES: Array<[RegExp, string]> = [
  [/# Informe/gi, "# Report"],
  [/Subvención/g, "Grant"],
  [/Reportado el/g, "Reported"],
  [/modelo/g, "model"],
  [/Participantes alcanzados/gi, "Participants reached"],
  [/Aumento de ingresos anuales por participante/gi, "Annual earnings gain per participant"],
  [/Salario promedio a la colocación/gi, "Median wage at placement"],
  [/línea de base regional/gi, "regional baseline"],
  [/\/hora/g, "/hr"],
  [/Este informe no incluye nombres ni identificadores de participantes\.?/gi, "This report contains no participant names or identifiers."],
  [/La finalización de la formación superó la meta/gi, "Training completion exceeded the target"],
  [/la colocación laboral avanza más lento/gi, "job placement is progressing more slowly"],
  [/participantes/gi, "participants"],
  [/finalización/gi, "completion"],
  [/formación|capacitación/gi, "training"],
  [/colocación/gi, "placement"],
  [/empleo|trabajo/gi, "employment"],
  [/ingresos/gi, "earnings"],
  [/salario/gi, "wage"],
  [/mujeres/gi, "women"],
  [/jóvenes/gi, "youth"],
  [/hogar/gi, "household"],
  [/aproximadamente/gi, "approximately"],
  [/Año (\d)/g, "Year $1"],
  [/superó la meta de (\d+)%/gi, "exceeded the $1% target"],
  // broader grantee-report vocabulary
  [/# Informe final/gi, "# Final report"],
  [/informe final/gi, "final report"],
  [/Durante el primer año del programa/gi, "During the first year of the program"],
  [/inscribió a/gi, "enrolled"],
  [/en su mayoría/gi, "mostly"],
  [/jefas de hogar/gi, "heads of household"],
  [/Retención a seis meses/gi, "Retention at six months"],
  [/seguían empleadas?/gi, "were still employed"],
  [/Barreras identificadas/gi, "Barriers identified"],
  [/La barrera principal fue la presión de ingresos durante la formación/gi, "The main barrier was income pressure during training"],
  [/varias participantes abandonaron para regresar a trabajo informal/gi, "several participants dropped out to return to informal work"],
  [/Donde se ofrecieron estipendios, la (finalización|completion) aumentó de forma notable/gi, "Where stipends were offered, completion rose notably"],
  [/Nota sobre datos personales/gi, "Note on personal data"],
  [/Este informe no incluye nombres ni identificadores de participantes individuales\.?/gi, "This report contains no individual participant names or identifiers."],
  [/Resumen de resultados/gi, "Results summary"],
  [/mensuales?/gi, "per month"],
  [/frente a una línea de base regional de/gi, "against a regional baseline of"],
  [/Bogotá y Medellín/g, "Bogotá and Medellín"],
  [/de la (formación|training):/gi, "of training:"],
  [/laboral/gi, ""],
  [/durante/gi, "during"],
  [/el primer año/gi, "the first year"],
  [/de capacidad financiera/gi, "in financial capability"],
];

export function makeGlossaryTranslator(): Translator {
  return {
    id: "glossary-es-en",
    async toEnglish(text, sourceLang) {
      if (sourceLang !== "es") return text;
      let out = text;
      for (const [re, en] of ES_EN_PHRASES) out = out.replace(re, en);
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// Real MT — transformers.js opus-mt. Lazy import; only when COMPASS_TRANSLATE=mt.

export async function makeMtTranslator(model = "Xenova/opus-mt-mul-en"): Promise<Translator> {
  const { pipeline } = await import("@huggingface/transformers");
  const t = await pipeline("translation", model);
  return {
    id: model.split("/").pop()!,
    async toEnglish(text, sourceLang) {
      if (sourceLang === "en" || !text.trim()) return text;
      // translate line by line so headings/bullets survive
      const lines = text.split("\n");
      const out: string[] = [];
      for (const ln of lines) {
        if (ln.trim().length < 3 || /^[#\-*|\d.]+$/.test(ln.trim())) {
          out.push(ln);
          continue;
        }
        const r = (await t(ln.replace(/^#+\s*/, ""))) as Array<{ translation_text: string }>;
        out.push((ln.match(/^#+\s*/)?.[0] ?? "") + (r[0]?.translation_text ?? ln));
      }
      return out.join("\n");
    },
  };
}

// ---------------------------------------------------------------------------
// API translator — POST {text, source, target:"en"} to COMPASS_TRANSLATE_URL.

export function makeApiTranslator(url: string, apiKey?: string): Translator {
  return {
    id: "translate-api",
    async toEnglish(text, sourceLang) {
      if (sourceLang === "en") return text;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
          body: JSON.stringify({ text, source: sourceLang, target: "en" }),
        });
        if (!r.ok) return text;
        return ((await r.json()) as { translation?: string }).translation ?? text;
      } catch {
        return text;
      }
    },
  };
}

/** Pick a translator from the environment. Returns null → the bilingual bridge fallback. */
export async function resolveTranslator(env: NodeJS.ProcessEnv = process.env): Promise<Translator | null> {
  const mode = env.COMPASS_TRANSLATE;
  if (mode === "mt") return makeMtTranslator(env.COMPASS_TRANSLATE_MODEL);
  if (mode === "api" && env.COMPASS_TRANSLATE_URL) return makeApiTranslator(env.COMPASS_TRANSLATE_URL, env.COMPASS_TRANSLATE_KEY);
  if (mode === "glossary" || (mode === undefined && env.COMPASS_CORPUS === "full")) return makeGlossaryTranslator();
  return null;
}
