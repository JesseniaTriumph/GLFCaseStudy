/**
 * Print the tamper-evident audit log and verify its hash chain.
 *
 *   npm run audit
 */
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { AuditLog } from "../src/security/audit.js";

const path = fileURLToPath(new URL("../dist/audit.jsonl", import.meta.url));
if (!existsSync(path)) {
  console.log("no audit log yet — run `npm run build:index` and `npm run ask` first");
  process.exit(0);
}

const log = new AuditLog(path);
for (const r of log.all()) {
  const e = r.event;
  let line = "";
  if (e.type === "query") line = `query  user=${e.user}  "${e.question.slice(0, 60)}"  cited=[${e.citedTiers.join(",")}]  withheld=${e.withheld}${e.withheldTiers.length ? "(" + e.withheldTiers.join(",") + ")" : ""}  ${e.confidence}`;
  else if (e.type === "ingest") line = `ingest ${Object.entries(e.sources).map(([k, v]) => `${k}:${v}`).join(" ")}  chunks=${e.chunks}  commit=${e.commit ?? "-"}`;
  else if (e.type === "auth") line = `auth   user=${e.user}  ${e.result}${e.reason ? " (" + e.reason + ")" : ""}`;
  else line = `admin  user=${e.user}  ${e.action}`;
  console.log(`#${String(r.seq).padStart(3)} ${r.ts}  ${line}`);
  console.log(`     hash ${r.hash.slice(0, 24)}…  prev ${r.prevHash.slice(0, 16)}…`);
}

const v = log.verify();
console.log(`\n${v.ok ? "\x1b[32mchain intact\x1b[0m" : `\x1b[31mCHAIN BROKEN at #${v.brokenAt}: ${v.reason}\x1b[0m`}  ·  ${log.length} entries  ·  head ${log.head.slice(0, 24)}…`);
process.exit(v.ok ? 0 : 1);
