/**
 * Weekly tuning loop (roadmap 4.2). Reads the captured feedback and the current gold-set
 * results, and PROPOSES a change — it never applies one. The proposal is meant to become a
 * reviewed PR: a human reads the rationale, accepts or rejects, and the eval gate
 * (`npm run ci`) proves it didn't regress anything.
 *
 *   npm run tune
 *
 * "Self-improving" here means: retrieval config, chunking, and weights evolve from
 * evidence (feedback + eval deltas), always gated by the gold set, always via review.
 * Better at retrieving and citing — never at deciding.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runPipeline } from "../src/pipeline/run.js";
import { answerQuestion } from "../src/retrieval/answer.js";
import { ADAPTERS, CORPUS, PRINCIPALS } from "../src/config.js";

const FEEDBACK = fileURLToPath(new URL("../eval/feedback.jsonl", import.meta.url));
const GOLD = fileURLToPath(new URL("../eval/gold.json", import.meta.url));

const feedback: Array<{ verdict: string; question: string; note: string }> = existsSync(FEEDBACK)
  ? readFileSync(FEEDBACK, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];
const gold = JSON.parse(readFileSync(GOLD, "utf8"));

const index = await runPipeline(ADAPTERS, {
  corpusLabel: CORPUS.corpusLabel,
  excludeTiers: [...CORPUS.excludeTiers],
  notCovered: CORPUS.notCovered,
  log: () => {},
});

// --- signal 1: feedback ---
const down = feedback.filter((f) => f.verdict === "down");
const up = feedback.filter((f) => f.verdict === "up");
console.log(`feedback: ${up.length} up · ${down.length} down (${feedback.length} total)`);

// --- signal 2: gold-set health right now ---
let refusalsWhereAnswerExpected = 0;
let weakConfidenceOnStrongCase = 0;
const missSources: string[] = [];
for (const c of gold.cases) {
  const p = PRINCIPALS[c.persona as keyof typeof PRINCIPALS];
  if (!p) continue;
  const a = await answerQuestion(index, c.question, p, {});
  if (!c.expectRefusal && a.confidence === "refused") {
    refusalsWhereAnswerExpected++;
    for (const s of c.expectSources ?? []) missSources.push(s);
  }
  if (!c.expectRefusal && a.confidence === "low") weakConfidenceOnStrongCase++;
}

// --- proposal ---
console.log("\n--- proposal (review, do not auto-apply) ---");
const proposals: string[] = [];

if (down.length >= 3 && down.length > up.length) {
  const themes = down.flatMap((f) => (f.note || "").toLowerCase().match(/\b(missing|wrong|source|citation|stale|old|permission|slow)\w*/g) ?? []);
  const top = [...new Set(themes)].slice(0, 3).join(", ");
  proposals.push(`- Down-votes outnumber up-votes${top ? ` (themes: ${top})` : ""}. Pull 10 of these into eval/gold.json as new cases with verified answers, then tune against them.`);
}
if (refusalsWhereAnswerExpected > 0) {
  proposals.push(
    `- ${refusalsWhereAnswerExpected} gold case(s) now refuse where an answer is expected` +
      (missSources.length ? ` (expected sources: ${[...new Set(missSources)].join(", ")})` : "") +
      `. Likely a retrieval-threshold regression — try lowering the topWeak bm25 gate from 1.6 to 1.4 in src/retrieval/answer.ts and re-run \`npm run ci\`.`
  );
}
if (weakConfidenceOnStrongCase >= 2) {
  proposals.push(`- ${weakConfidenceOnStrongCase} strong cases grade "low" confidence — check the freshness threshold (2.5y) and the conflict detector's label matching.`);
}
if (feedback.length < 10) {
  proposals.push(`- Only ${feedback.length} feedback items so far — not enough signal to tune. Keep collecting; revisit at ~30.`);
}

console.log(proposals.length ? proposals.join("\n") : "- No change proposed. Gold set healthy, feedback insufficient or positive.");
console.log("\nNext: open a PR with the change above, let `npm run ci` prove no regression, merge on review.");
