import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tokenize,
  bilingualBridge,
  detectLanguage,
  parseFrontmatter,
  jaccard,
  tfidfVector,
  cosine,
} from "../src/util/text.js";

test("tokenize: lowercases, drops stopwords, light-stems", () => {
  const t = tokenize("The grantees are REPORTING completions");
  assert.ok(!t.includes("the"));
  assert.ok(!t.includes("are"));
  assert.ok(t.includes("report")); // "reporting" -> stem
  assert.ok(t.includes("completion")); // "completions" -> stem
  // "grantees" gets a trailing "es" trimmed by the light stemmer
  assert.ok(t.some((x) => x.startsWith("grante")));
});

test("tokenize: folds accents so Spanish matches", () => {
  assert.deepEqual(tokenize("fundación atención"), tokenize("fundacion atencion"));
});

test("tokenize: keeps money and percentages intact", () => {
  const t = tokenize("wage rose to $19 which is 12% up");
  assert.ok(t.includes("$19"));
  assert.ok(t.includes("12%"));
});

test("tokenize: splits hyphenated compounds", () => {
  const t = tokenize("nuclear-maintenance training");
  assert.ok(t.includes("nuclear"));
  assert.ok(t.includes("maintenance"));
});

test("tokenize: drops one-character tokens", () => {
  assert.ok(!tokenize("a b cd").includes("b"));
});

test("bilingualBridge: appends English equivalents for Spanish terms", () => {
  const b = bilingualBridge("La finalización de la capacitación superó la meta");
  assert.match(b, /\[en: /);
  assert.match(b, /completion/);
  assert.match(b, /training/);
});

test("bilingualBridge: empty string when no Spanish terms", () => {
  assert.equal(bilingualBridge("a plain english sentence about grants"), "");
});

test("detectLanguage", () => {
  assert.equal(detectLanguage("the grant report of the foundation"), "en");
  assert.equal(detectLanguage("el informe de la subvención para la fundación"), "es");
  assert.equal(detectLanguage("xxxx yyyy zzzz"), "unknown");
});

test("parseFrontmatter: extracts key/values and body, null literal", () => {
  const { data, body } = parseFrontmatter('---\ntitle: Report\nowner: null\n---\nbody text here');
  assert.equal(data.title, "Report");
  assert.equal(data.owner, null);
  assert.equal(body, "body text here");
});

test("parseFrontmatter: no frontmatter → passthrough", () => {
  const { data, body } = parseFrontmatter("just a body");
  assert.deepEqual(data, {});
  assert.equal(body, "just a body");
});

test("jaccard: identical sets = 1, disjoint = 0, empty = 0", () => {
  assert.equal(jaccard(new Set(["a", "b"]), new Set(["a", "b"])), 1);
  assert.equal(jaccard(new Set(["a"]), new Set(["b"])), 0);
  assert.equal(jaccard(new Set(), new Set(["a"])), 0);
  assert.equal(jaccard(new Set(["a", "b", "c", "d"]), new Set(["a", "b"])), 0.5);
});

test("tfidfVector: L2-normalised, rarer terms weigh more", () => {
  const df = { common: 100, rare: 1 };
  const v = tfidfVector(["common", "rare"], df, 100);
  const norm = Math.sqrt(Object.values(v).reduce((s, w) => s + w * w, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9);
  assert.ok(v.rare! > v.common!);
});

test("cosine: orthogonal = 0, parallel unit vectors = 1", () => {
  assert.equal(cosine({ a: 1 }, { b: 1 }), 0);
  assert.ok(Math.abs(cosine({ a: 1 }, { a: 1 }) - 1) < 1e-9);
});
