/**
 * Dependency vulnerability gate (OWASP A06 — Vulnerable & Outdated Components).
 *
 *   npm run deps:audit
 *
 * Runs `npm audit` against the parts of the tree that actually ship or run:
 *
 *   1. root runtime      — deps that run in the pipeline / server on every request.
 *                          `--omit=dev` (build-only tools) and `--omit=optional`
 *                          (the transformers.js backends — see note below).
 *                          A `high` or `critical` here FAILS the gate.
 *   2. web runtime       — what the browser bundle pulls in. `--omit=dev` drops
 *                          vite / esbuild (dev server only, never shipped).
 *                          A `high` or `critical` here FAILS the gate.
 *   3. optional backends — informational only. `@huggingface/transformers` (used
 *                          only when COMPASS_TRANSLATE=mt, COMPASS_PII_NER=true, or
 *                          an --embed build) drags in onnxruntime-node / adm-zip /
 *                          sharp, which carry advisories with no upstream fix. The
 *                          default demo path (glossary translate, deterministic PII,
 *                          tf-idf retrieval) loads none of them. If the Foundation
 *                          turns a backend on, this line is the risk to weigh.
 *
 * Wired into `npm run ci` so a new advisory in shipping code blocks promotion.
 */
import { spawnSync } from "node:child_process";

type Sev = "info" | "low" | "moderate" | "high" | "critical";
interface AuditResult {
  metadata?: { vulnerabilities?: Record<Sev, number> };
}

function audit(label: string, args: string[], cwd?: string): { counts: Record<Sev, number>; blocking: boolean } {
  const r = spawnSync("npm", ["audit", "--json", ...args], { cwd, encoding: "utf8" });
  let parsed: AuditResult = {};
  try {
    parsed = JSON.parse(r.stdout || "{}");
  } catch {
    console.log(`\x1b[31m✗ ${label}: could not parse npm audit output\x1b[0m`);
    return { counts: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, blocking: true };
  }
  const counts = parsed.metadata?.vulnerabilities ?? { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  const total = counts.low + counts.moderate + counts.high + counts.critical;
  const bad = counts.high + counts.critical;
  const mark = bad > 0 ? "\x1b[31m✗\x1b[0m" : total > 0 ? "\x1b[33m•\x1b[0m" : "\x1b[32m✓\x1b[0m";
  console.log(
    `${mark}  ${label}: ${total === 0 ? "no known advisories" : `${counts.critical} critical · ${counts.high} high · ${counts.moderate} moderate · ${counts.low} low`}`
  );
  return { counts, blocking: bad > 0 };
}

console.log("\x1b[1mDependency audit — OWASP A06\x1b[0m\n");

const root = audit("root runtime      ", ["--omit=dev", "--omit=optional"]);
const web = audit("web runtime       ", ["--omit=dev"], "web");
const optional = audit("optional backends ", ["--include=optional", "--omit=dev"]);

if (optional.counts.high + optional.counts.critical > 0) {
  console.log(
    "\n  note: the optional-backend advisories are inside @huggingface/transformers and its\n" +
      "  native deps (onnxruntime-node, adm-zip, sharp). They are only reachable with\n" +
      "  COMPASS_TRANSLATE=mt, COMPASS_PII_NER=true, or an --embed build. The default demo\n" +
      "  and CI path load none of them. Re-evaluate before enabling a backend in production."
  );
}

const blocked = root.blocking || web.blocking;
console.log(
  blocked
    ? "\n\x1b[31m✗ shipping dependencies have a high/critical advisory — fix or pin before promotion\x1b[0m"
    : "\n\x1b[32m✓ shipping dependencies clean at high/critical\x1b[0m"
);
process.exit(blocked ? 1 : 0);
