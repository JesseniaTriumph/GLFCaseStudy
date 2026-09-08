import { test } from "node:test";
import assert from "node:assert/strict";
import { makeGlossaryTranslator, makeApiTranslator, resolveTranslator } from "../src/pipeline/translate.js";

test("glossary translator: only touches Spanish, maps known phrases", async () => {
  const t = makeGlossaryTranslator();
  const es = "Participantes alcanzados: 40. La finalización de la formación superó la meta.";
  const out = await t.toEnglish(es, "es");
  assert.match(out, /Participants reached/);
  assert.match(out, /completion/i);
  assert.match(out, /training/i);
  // English passes through untouched
  assert.equal(await t.toEnglish("plain english", "en"), "plain english");
});

test("api translator: posts to the URL and returns the translation; falls back on error", async () => {
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push(String(url));
    const body = JSON.parse(String(init.body));
    assert.equal(body.target, "en");
    return { ok: true, json: async () => ({ translation: "TRANSLATED" }) } as Response;
  }) as typeof fetch;
  try {
    const t = makeApiTranslator("https://mt.example/translate", "key");
    assert.equal(await t.toEnglish("hola", "es"), "TRANSLATED");
    assert.equal(calls.length, 1);

    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    assert.equal(await t.toEnglish("hola", "es"), "hola"); // graceful fallback
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("resolveTranslator: env matrix", async () => {
  assert.equal(await resolveTranslator({}), null);
  assert.equal((await resolveTranslator({ COMPASS_TRANSLATE: "glossary" }))?.id, "glossary-es-en");
  // default-on when running the full corpus
  assert.equal((await resolveTranslator({ COMPASS_CORPUS: "full" }))?.id, "glossary-es-en");
  // api mode needs a URL
  assert.equal(await resolveTranslator({ COMPASS_TRANSLATE: "api" }), null);
  assert.equal(
    (await resolveTranslator({ COMPASS_TRANSLATE: "api", COMPASS_TRANSLATE_URL: "https://x" }))?.id,
    "translate-api"
  );
});
