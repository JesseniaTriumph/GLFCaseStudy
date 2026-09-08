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
 *   2. test                   unit suite (node:test) — ~110 cases over the logic modules
 *   3. deps:audit             no high/critical advisory in shipping deps (OWASP A06)
 *   4. build:index            the pipeline runs clean
 *   5. eval / eval:pg / eval:full   gold sets — retrieval + refusal + zero permission leaks
 *   6. security               OIDC token verification + tamper-evident audit chain
 *   7. web:build              the web app compiles (also gives server:check something to serve)
 *   8. server:check           full OIDC login flow + demo sign-in + headers + rate limit + kill switch
 *   9. redteam                adversarial suite — injection, jailbreak, exfiltration, PII
 *
 * `npm run coverage` prints line/branch/function coverage for the unit suite.
 */
import { spawnSync } from "node:child_process";

const STEPS: Array<[string, string]> = [
  ["typecheck", "npm run -s typecheck"],
  ["test", "npm run -s test"],
  ["deps:audit", "npm run -s deps:audit"],
  ["build:index", "npm run -s build:index"],
  ["eval", "npm run -s eval"],
  ["eval:pg", "npm run -s eval:pg"],
  ["eval:full", "npm run -s eval:full"],
  ["security", "npm run -s security"],
  ["web:build", "npm run -s web:build"], // full-corpus index + vite build — leaves web/dist deploy-ready
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
