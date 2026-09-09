/** Informational retrieval measurements. Deliberately never a release gate. */
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

interface GoldCase {
  id: string;
  question: string;
  persona: string;
  expectRefusal?: boolean;
  expectSources?: string[];
}

const cutoffs = [1, 3, 5, 10] as const;
const metricNames = [...cutoffs.map((k) => `recall@${k}`), "MRR", "nDCG@10", "No expected source retrieved", "Eligible cases"];
type Metrics = Record<string, number | null>;
type Measurement = { metrics: Metrics } | { error: string };
const worker = process.argv.includes("--metrics-worker");

async function measure(): Promise<Metrics> {
  // Imports happen only in the worker: each A/B arm gets its environment before
  // module initialization, including rerankers that read their flag at import time.
  const { runPipeline } = await import("../src/pipeline/run.js");
  const { answerQuestion } = await import("../src/retrieval/answer.js");
  const { ADAPTERS, CORPUS, PRINCIPALS } = await import("../src/config.js");
  const { resolveTranslator } = await import("../src/pipeline/translate.js");
  const full = process.env.COMPASS_CORPUS === "full";
  const goldPath = new URL(full ? "../eval/gold-full.json" : "../eval/gold.json", import.meta.url);
  const gold = JSON.parse(await readFile(goldPath, "utf8")) as { cases: GoldCase[] };
  const cases = gold.cases.filter((c) => !c.expectRefusal && c.expectSources?.length);
  const index = await runPipeline(ADAPTERS, {
    corpusLabel: CORPUS.corpusLabel,
    excludeTiers: [...CORPUS.excludeTiers],
    notCovered: CORPUS.notCovered,
    translator: await resolveTranslator(),
    log: () => {},
  });

  const totals: Metrics = Object.fromEntries(metricNames.map((name) => [name, 0]));
  for (const c of cases) {
    const principal = PRINCIPALS[c.persona];
    if (!principal) throw new Error(`gold case ${c.id}: unknown persona ${c.persona}`);
    const answer = await answerQuestion(index, c.question, principal, { k: 10, followUps: false });
    const refs = answer.citations.slice(0, 10).map((citation) => citation.ref);
    // Exact canonical source IDs, first occurrence only. Repeated passages occupy
    // citation ranks but never earn extra relevance credit for the same source.
    const expected = [...new Set(c.expectSources!)];
    const ranks = expected.map((id) => refs.indexOf(id) + 1);
    const found = ranks.filter((rank) => rank > 0);
    for (const k of cutoffs) {
      totals[`recall@${k}`]! += found.filter((rank) => rank <= k).length / expected.length;
    }
    totals.MRR! += found.length ? 1 / Math.min(...found) : 0;
    const dcg = found.reduce((sum, rank) => sum + 1 / Math.log2(rank + 1), 0);
    const ideal = expected.slice(0, 10).reduce((sum, _, i) => sum + 1 / Math.log2(i + 2), 0);
    totals["nDCG@10"]! += dcg / ideal;
    if (!found.length) totals["No expected source retrieved"]! += 1;
  }
  for (const name of metricNames.slice(0, 6)) {
    totals[name] = cases.length ? totals[name]! / cases.length : null;
  }
  totals["Eligible cases"] = cases.length;
  return totals;
}

function runArm(reranked: boolean): Measurement {
  const env = { ...process.env };
  delete env.COMPASS_RERANK;
  if (reranked) env.COMPASS_RERANK = "1";
  const result = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), "--metrics-worker"], {
    env,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) {
    return { error: result.error?.message ?? `worker exited with status ${result.status}, signal ${result.signal}` };
  }
  try {
    return JSON.parse(result.stdout) as Measurement;
  } catch {
    return { error: "worker did not return a valid measurement" };
  }
}

function printTable(baseline: Measurement, reranked: Measurement): void {
  console.log(`Corpus: ${process.env.COMPASS_CORPUS === "full" ? "full (eval/gold-full.json)" : "default (eval/gold.json)"}. Top 10 answer citations; informational only.\n`);
  console.log("| Metric | Baseline | Reranked | Delta |\n| --- | ---: | ---: | ---: |");
  for (const name of metricNames) {
    const a = "metrics" in baseline ? baseline.metrics[name] : null;
    const b = "metrics" in reranked ? reranked.metrics[name] : null;
    const count = name === "Eligible cases" || name === "No expected source retrieved";
    const format = (value: number | null | undefined) => value == null ? "N/A" : count ? String(value) : value.toFixed(4);
    const delta = a == null || b == null ? null : b - a;
    console.log(`| ${name} | ${format(a)} | ${format(b)} | ${delta != null && delta > 0 ? "+" : ""}${format(delta)} |`);
  }
  for (const [label, result] of [["Baseline", baseline], ["Reranked", reranked]] as const) {
    if ("error" in result) console.error(`${label} measurement unavailable: ${result.error}`);
  }
}

try {
  if (worker) console.log(JSON.stringify({ metrics: await measure() }));
  else printTable(runArm(false), runArm(true));
} catch (error) {
  const failure = { error: error instanceof Error ? error.message : String(error) };
  if (worker) console.log(JSON.stringify(failure));
  else printTable(failure, failure);
} finally {
  // Missing input, pipeline errors, and quality regressions are diagnostic only.
  process.exitCode = 0;
}
