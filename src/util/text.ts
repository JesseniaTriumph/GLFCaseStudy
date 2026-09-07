// Browser-safe: no node imports. Build-time-only helpers (sha1) live in ./hash.ts.

const STOP = new Set(
  ("a an the of to in on for and or but with without at by from as is are was were be been being " +
    "this that these those it its our your their we you they i he she them us not no do does did " +
    "have has had will would should could can may might must about into over under than then so " +
    "we're their there here what which who whom whose how when where why " +
    // Spanish stopwords — the Foundation funds in Colombia; reports arrive in Spanish
    "el la los las un una unos unas de del al y o pero con sin por para en su sus se es son " +
    "fue fueron ser este esta estos estas que como más muy ya no sí lo le les nos han ha había " +
    "sobre entre hasta desde cuando donde porque este esa eso").split(/\s+/)
);

/**
 * A small bilingual bridge for the keyword path: for a Spanish document, we append the
 * English equivalents of recurring workforce/impact terms so an English query
 * ("completion", "placement") still retrieves it. Real multilingual retrieval uses a
 * multilingual embedder (bge-m3) — this keeps the offline tf-idf path usable across ES/EN.
 */
const ES_EN: Record<string, string> = {
  finalización: "completion", finalizacion: "completion", culminación: "completion", culminacion: "completion",
  graduación: "graduation", graduacion: "graduation", capacitación: "training", capacitacion: "training",
  formación: "training", formacion: "training", empleo: "employment job", trabajo: "work job",
  colocación: "placement", colocacion: "placement", "inserción": "placement insertion", insercion: "placement",
  ingresos: "earnings income", salario: "wage salary", retención: "retention", retencion: "retention",
  participantes: "participants", beneficiarios: "participants beneficiaries", credencial: "credential",
  certificación: "certification credential", certificacion: "certification credential",
  impacto: "impact", proyección: "projection", proyeccion: "projection", meta: "target goal",
  barrera: "barrier", barreras: "barriers", mujeres: "women", jóvenes: "youth", rural: "rural",
  informe: "report", subvención: "grant", subvencion: "grant", donación: "grant donation",
};

export function bilingualBridge(text: string): string {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const [es, en] of Object.entries(ES_EN)) if (lower.includes(es)) found.add(en);
  return found.size ? `\n[en: ${[...found].join(" ")}]` : "";
}

/** Lowercase word tokens, stopwords removed, light stemming of trailing s/es/ing/ed. */
export function tokenize(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s$%.]/gu, " ") // hyphens included -> split compounds like "nuclear-maintenance"
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let t of raw) {
    if (t.length < 2) continue;
    if (STOP.has(t)) continue;
    // keep money / numbers intact; light stem otherwise
    if (!/[$%\d]/.test(t)) {
      t = t.replace(/(ies)$/, "y").replace(/(ing|edly|ed|es|s)$/, "");
      if (t.length < 2) continue;
    }
    out.push(t);
  }
  return out;
}

/** Cheap language guess sufficient for routing en vs es in this corpus. */
export function detectLanguage(text: string): "en" | "es" | "unknown" {
  const t = ` ${text.toLowerCase()} `;
  const es = [" el ", " la ", " los ", " las ", " de ", " que ", " para ", " con ", " una ", " del ", " finalización", " trabajo "];
  const en = [" the ", " and ", " of ", " to ", " for ", " with ", " that ", " report ", " grant "];
  const score = (arr: string[]) => arr.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
  const e = score(es);
  const n = score(en);
  if (e === 0 && n === 0) return "unknown";
  return e > n ? "es" : "en";
}

/** Parse simple `--- yaml-ish ---` frontmatter. Values are strings; `null` -> null. */
export function parseFrontmatter(src: string): { data: Record<string, string | null>; body: string } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data: Record<string, string | null> = {};
  for (const line of m[1]!.split("\n")) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1]!;
    let val: string | null = kv[2]!.trim().replace(/^["']|["']$/g, "");
    if (val === "null" || val === "") val = null;
    data[key] = val;
  }
  return { data, body: (m[2] ?? "").trim() };
}

/** Jaccard similarity of token sets — used for near-duplicate detection. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** tf-idf sparse vector from tokens + corpus df. L2-normalised. */
export function tfidfVector(tokens: string[], df: Record<string, number>, docCount: number): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
  const vec: Record<string, number> = {};
  let norm = 0;
  for (const [t, f] of Object.entries(tf)) {
    const idf = Math.log((docCount + 1) / ((df[t] ?? 0) + 1)) + 1;
    const w = (f / tokens.length) * idf;
    vec[t] = w;
    norm += w * w;
  }
  norm = Math.sqrt(norm) || 1;
  for (const t of Object.keys(vec)) vec[t]! /= norm;
  return vec;
}

export function cosine(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  const [small, big] = Object.keys(a).length < Object.keys(b).length ? [a, b] : [b, a];
  for (const [t, w] of Object.entries(small)) dot += w * (big[t] ?? 0);
  return dot;
}
