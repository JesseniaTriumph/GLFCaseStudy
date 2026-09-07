/**
 * Print the usage / trust / cost snapshot from a local audit log (roadmap 4.3).
 *
 *   npm run stats [-- path/to/audit.log]
 */
import { AuditLog } from "../src/security/audit.js";
import { auditStats } from "../src/server/app.js";

const path = process.argv[2] ?? "dist/audit.log";
const log = new AuditLog(path);
const s = auditStats(log.all());

console.log(`Compass usage snapshot — ${path}\n`);
console.log(`  queries              ${s.queries}`);
console.log(`  unique users         ${s.uniqueUsers}`);
console.log(`  refusal rate         ${(s.refusalRate * 100).toFixed(1)}%`);
console.log(`  restricted probes    ${s.restrictedProbes}`);
console.log(`  auth denials         ${s.authDenials}`);
console.log(`  generative share     ${(s.generativeShare * 100).toFixed(1)}%`);
console.log(`  est. cost (this log) $${s.estMonthlyCostUsd}`);
console.log(`  audit chain length   ${s.auditChainLength}  ·  ${log.verify().ok ? "intact" : "BROKEN"}`);
if (s.topUsers.length) {
  console.log(`  top users:`);
  for (const [u, n] of s.topUsers) console.log(`    ${u}  ${n}`);
}
