/**
 * The same gold set as `npm run eval`, but retrieval runs through Postgres (PGlite) —
 * the permission filter is a SQL WHERE clause, not a JS array filter.
 *
 *   npm run eval:pg
 *
 * Proves: (a) the SQL boundary produces the same answers and the same refusals,
 * (b) zero permission leaks, (c) a visibility check straight from SQL per persona.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runPipeline } from "../src/pipeline/run.js";
import { answerQuestion } from "../src/retrieval/answer.js";
import { ADAPTERS, CORPUS, PRINCIPALS } from "../src/config.js";
import { PgStore } from "../src/db/store.js";

const gold = JSON.parse(await readFile(fileURLToPath(new URL("../eval/gold.json", import.meta.url)), "utf8"));

const index = await runPipeline(ADAPTERS, {
  corpusLabel: CORPUS.corpusLabel,
  excludeTiers: [...CORPUS.excludeTiers],
  notCovered: CORPUS.notCovered,
  log: () => {},
});

const store = await PgStore.open();
await store.load(index);
console.log("loaded corpus into Postgres (PGlite)\n");

// --- SQL visibility check, per persona ---
console.log("\x1b[1mVisibility — straight from SQL\x1b[0m");
for (const [name, p] of Object.entries(PRINCIPALS)) {
  const v = await store.visibility(p);
  console.log(
    `  ${name.padEnd(10)} sees ${v.visible}/${v.total} chunks  · allowed tiers: ${p.allowedTiers.join(", ")}` +
      `  · by tier: ${Object.entries(v.byTier).map(([t, n]) => `${t}:${n}`).join(" ")}`
  );
}
console.log();

// --- the gold set, through the SQL retriever ---
let pass = 0;
let leaks = 0;
const retriever = (_i: unknown, q: string, pr: (typeof PRINCIPALS)[string], k: number) => store.retrieve(q, pr, k);

for (const c of gold.cases) {
  const principal = PRINCIPALS[c.persona as keyof typeof PRINCIPALS];
  if (!principal) throw new Error(`unknown persona ${c.persona}`);
  const ans = await answerQuestion(index, c.question, principal, { retriever: retriever as never });
  const citedIds = ans.citations.map((x) => x.ref);

  const refusedOk = (ans.confidence === "refused") === !!c.expectRefusal;
  const retrievalOk =
    c.expectRefusal ||
    (c.expectSources ?? []).every((s: string) => citedIds.some((id) => id === s || id.endsWith(s.split(":")[1] ?? s)));
  const leaked = (c.mustNotLeak ?? []).filter(
    (s: string) => citedIds.some((id) => id.includes(s.split(":")[1] ?? s)) || ans.text.includes(s.split(":")[1] ?? s)
  );
  if (leaked.length) leaks += leaked.length;
  const ok = refusedOk && retrievalOk && leaked.length === 0;
  if (ok) pass++;
  console.log(
    `${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"}  ${c.id.padEnd(34)} refusal:${refusedOk ? "ok " : "BAD"} retrieval:${retrievalOk ? "ok " : "BAD"} leak:${leaked.length ? "LEAK " + leaked.join(",") : "none"}`
  );
}

console.log(`\n${pass}/${gold.cases.length} cases pass · ${leaks} leakage findings · retrieval path: Postgres`);
process.exit(leaks > 0 || pass < gold.cases.length ? 1 : 0);
