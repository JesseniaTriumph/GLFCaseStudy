/**
 * Evaluation harness. Runs the gold set and scores:
 *   - retrieval:   did an expected source appear in the citations?
 *   - refusal:     did the tool refuse exactly when it should?
 *   - no leakage:  did any `mustNotLeak` document appear in the answer?
 *
 * In CI this gates deploys — a regression on any leakage case is a hard fail.
 *
 *   npm run eval
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runPipeline } from "../src/pipeline/run.js";
import { answerQuestion } from "../src/retrieval/answer.js";
import { ADAPTERS, CORPUS, PRINCIPALS } from "../src/config.js";

const GOLD = fileURLToPath(new URL("../eval/gold.json", import.meta.url));
const gold = JSON.parse(await readFile(GOLD, "utf8"));

const index = await runPipeline(ADAPTERS, {
  corpusLabel: CORPUS.corpusLabel,
  excludeTiers: [...CORPUS.excludeTiers],
  notCovered: CORPUS.notCovered,
  log: () => {},
});

let pass = 0;
let leaks = 0;
const rows: string[] = [];

for (const c of gold.cases) {
  const principal = PRINCIPALS[c.persona as keyof typeof PRINCIPALS];
  if (!principal) throw new Error(`gold case ${c.id}: unknown persona ${c.persona}`);
  const ans = await answerQuestion(index, c.question, principal, {});
  const citedIds = ans.citations.map((x) => x.ref);

  const refusedOk = (ans.confidence === "refused") === !!c.expectRefusal;
  const retrievalOk =
    c.expectRefusal || (c.expectSources ?? []).every((s: string) => citedIds.some((id) => id === s || s.endsWith(id) || id.endsWith(s.split(":")[1] ?? s)));
  const leaked = (c.mustNotLeak ?? []).filter((s: string) => citedIds.some((id) => id.includes(s.split(":")[1] ?? s)) || ans.text.includes(s.split(":")[1] ?? s));
  if (leaked.length) leaks += leaked.length;

  const ok = refusedOk && retrievalOk && leaked.length === 0;
  if (ok) pass++;

  rows.push(
    `${ok ? "✓" : "✗"}  ${c.id.padEnd(34)}  refusal:${refusedOk ? "ok " : "BAD"}  retrieval:${retrievalOk ? "ok " : "BAD"}  leak:${leaked.length === 0 ? "none" : "LEAK " + leaked.join(",")}`
  );
}

console.log(rows.join("\n"));
console.log(`\n${pass}/${gold.cases.length} cases pass · ${leaks} leakage findings`);
process.exit(leaks > 0 || pass < gold.cases.length ? 1 : 0);
