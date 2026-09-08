/**
 * The promotion gate (roadmap 3.5, LOGIC_TREES §6).
 *
 *   npm run ci
 *
 * Runs the full check set in order and fails on the first red. Nothing gets promoted to a
 * live index without this passing — a permission-leak finding or a red-team regression is
 * a hard stop, not a warning.
 *
 * Gate steps:
 *   1. typecheck              the code compiles
 *   2. deps:audit             no high/critical advisory in shipping deps (OWASP A06)
 *   3. build:index            the pipeline runs clean
 *   4. eval                   gold set — retrieval + refusal + zero permission leaks
 *   5. eval:pg                the same gold set through the SQL permission filter
 *   6. security               OIDC token verification + tamper-evident audit chain
 *   7. server:check           full OIDC login flow + rate limit + kill switch + revocation
 *   8. redteam                adversarial suite — injection, jailbreak, exfiltration, PII
 */
import { spawnSync } from "node:child_process";

const STEPS: Array<[string, string]> = [
  ["typecheck", "npm run -s typecheck"],
  ["deps:audit", "npm run -s deps:audit"],
  ["build:index", "npm run -s build:index"],
  ["eval", "npm run -s eval"],
  ["eval:pg", "npm run -s eval:pg"],
  ["eval:full", "npm run -s eval:full"],
  ["security", "npm run -s security"],
  ["server:check", "npm run -s server:check"],
  ["redteam", "npm run -s redteam"],
];

let failed = "";
for (const [name, cmd] of STEPS) {
  process.stdout.write(`\n\x1b[1m▶ ${name}\x1b[0m\n`);
  const r = spawnSync(cmd, { shell: true, stdio: "inherit" });
  if (r.status !== 0) {
    failed = name;
    break;
  }
}

if (failed) {
  console.log(`\n\x1b[31m✗ PROMOTION BLOCKED — "${failed}" failed. Nothing is promoted.\x1b[0m`);
  process.exit(1);
}
console.log(`\n\x1b[32m✓ All gates green — this build is promotable.\x1b[0m`);
