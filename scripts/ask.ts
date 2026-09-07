/**
 * Ask Compass a question from the command line, as a given persona.
 *
 *   npm run ask -- "how did Riverbend perform against projection?"
 *   npm run ask -- --as impact "did we decline an AI upskilling applicant?"
 *   npm run ask -- --as programs "what did the board discuss about compensation?"
 *
 * Personas: programs (default) | impact | other  — see src/config.ts
 * Set ANTHROPIC_API_KEY to switch from extractive to generative answers.
 */
import { fileURLToPath } from "node:url";
import { runPipeline } from "../src/pipeline/run.js";
import { answerQuestion, type AnswerOptions } from "../src/retrieval/answer.js";
import { functionsForGroups } from "../src/roles.js";
import { ADAPTERS, CORPUS, PRINCIPALS } from "../src/config.js";
import { claudeLLM } from "../src/retrieval/llm.js";
import { AuditLog } from "../src/security/audit.js";

const args = process.argv.slice(2);
let persona = "programs";
const ix = args.indexOf("--as");
if (ix !== -1) {
  persona = args[ix + 1] ?? "programs";
  args.splice(ix, 2);
}
// role & cycle context: off unless --role is passed
const roleOn = args.includes("--role");
if (roleOn) args.splice(args.indexOf("--role"), 1);
// retrieval path: --pg runs it through Postgres (the permission filter as a SQL WHERE clause)
const usePg = args.includes("--pg");
if (usePg) args.splice(args.indexOf("--pg"), 1);
let today: string | undefined;
const ti = args.indexOf("--today");
if (ti !== -1) {
  today = args[ti + 1];
  args.splice(ti, 2);
}
const question = args.join(" ").trim();
if (!question) {
  console.error('Usage: npm run ask -- [--as programs|impact|other] "your question"');
  process.exit(1);
}

const principal = PRINCIPALS[persona];
if (!principal) {
  console.error(`Unknown persona "${persona}". Use: ${Object.keys(PRINCIPALS).join(", ")}`);
  process.exit(1);
}

const index = await runPipeline(ADAPTERS, {
  corpusLabel: CORPUS.corpusLabel,
  excludeTiers: [...CORPUS.excludeTiers],
  notCovered: CORPUS.notCovered,
  log: () => {},
});

const llm = process.env.ANTHROPIC_API_KEY ? claudeLLM : undefined;
const roleContext = roleOn ? { functions: functionsForGroups(principal.groups), today } : undefined;

let retriever: AnswerOptions["retriever"];
if (usePg) {
  const { PgStore } = await import("../src/db/store.js");
  const store = await PgStore.open();
  await store.load(index);
  retriever = (_i, q, p, k) => store.retrieve(q, p, k);
}

const ans = await answerQuestion(index, question, principal, { llm, roleContext, retriever });

// every query is written to the tamper-evident audit log (§6.5)
const audit = new AuditLog(fileURLToPath(new URL("../dist/audit.jsonl", import.meta.url)));
audit.append({
  type: "query",
  user: principal.userId,
  question,
  citedRefs: ans.citations.map((c) => c.ref),
  citedTiers: [...new Set(ans.citations.map((c) => c.tier))],
  withheld: ans.withheld?.count ?? 0,
  withheldTiers: ans.withheld ? ans.withheld.reason.split("—").pop()!.trim().split(", ") : [],
  confidence: ans.confidence,
  mode: ans.mode,
});

console.log(`\n\x1b[1mQ (${persona}):\x1b[0m ${question}\n`);
console.log(ans.text);
console.log(`\n\x1b[2m— confidence: ${ans.confidence} (${ans.confidenceReason}) · mode: ${ans.mode}\x1b[0m`);
console.log(`\x1b[2m— ${ans.coverage}\x1b[0m`);
if (ans.withheld) console.log(`\x1b[33m— ${ans.withheld.reason}\x1b[0m`);
if (ans.citations.length) {
  console.log(`\n\x1b[1mSources\x1b[0m`);
  for (const c of ans.citations) {
    console.log(`  [${c.n}] ${c.system} · ${c.docTitle}${c.locator ? "  " + c.locator : ""}  (${c.tier})`);
    console.log(`      ${c.deepLink}`);
    console.log(`      \x1b[2m↳ lands on: "${c.highlight}"\x1b[0m`);
  }
}

if (ans.followUps) {
  const f = ans.followUps;
  console.log(`\n\x1b[1mDeep dive\x1b[0m \x1b[2m(toggleable)\x1b[0m`);
  if (f.cycle?.length) {
    console.log(`  \x1b[2mWhere each grant is in its own cycle:\x1b[0m`);
    for (const c of f.cycle) console.log(`   – ${c.organization ?? c.grantId} [${c.stage}] — ${c.summary}`);
  }
  if (f.gaps.length) {
    console.log(`  \x1b[2mWhat would sharpen this:\x1b[0m`);
    for (const g of f.gaps) console.log(`   – ${g}`);
  }
  if (f.whoToAsk.length) {
    console.log(`  \x1b[2mWho to ask:\x1b[0m`);
    for (const w of f.whoToAsk) console.log(`   – ${w.person.name}${w.person.email ? ` <${w.person.email}>` : ""} — ${w.why}`);
  }
  if (f.suggestedQuestions.length) {
    console.log(`  \x1b[2mSuggested questions:\x1b[0m`);
    for (const q of f.suggestedQuestions) console.log(`   – ${q}`);
  }
  if (f.draftEmail) {
    console.log(`  \x1b[2mDraft email → ${f.draftEmail.to}\x1b[0m`);
    console.log(`   Subject: ${f.draftEmail.subject}`);
    console.log(f.draftEmail.body.split("\n").map((l) => "   " + l).join("\n"));
  }
}

const chain = audit.verify();
console.log(
  `\n\x1b[2m— audit: entry #${audit.length - 1} logged · chain ${chain.ok ? "intact" : "BROKEN at " + (chain as any).brokenAt} · head ${audit.head.slice(0, 12)}…\x1b[0m`
);
