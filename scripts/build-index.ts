/**
 * Build the corpus index from the configured adapters and write it to disk.
 * Output feeds both the eval harness and the web app (web/public/corpus-index.json).
 *
 *   npm run build:index
 */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { runPipeline } from "../src/pipeline/run.js";
import { ADAPTERS, CORPUS } from "../src/config.js";
import { AuditLog } from "../src/security/audit.js";

const OUT = fileURLToPath(new URL("../web/public/corpus-index.json", import.meta.url));
const OUT_LOCAL = fileURLToPath(new URL("../dist/corpus-index.json", import.meta.url));

let commit: string | null = null;
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: fileURLToPath(new URL("..", import.meta.url)) }).toString().trim();
} catch {
  /* not a git repo */
}

const index = await runPipeline(ADAPTERS, {
  corpusLabel: CORPUS.corpusLabel,
  excludeTiers: [...CORPUS.excludeTiers],
  notCovered: CORPUS.notCovered,
  commit,
  log: (m) => console.log(m),
});

// record the build in the tamper-evident audit log (§6.5)
try {
  await mkdir(fileURLToPath(new URL("../dist/", import.meta.url)), { recursive: true });
  new AuditLog(fileURLToPath(new URL("../dist/audit.jsonl", import.meta.url))).append({
    type: "ingest",
    sources: index.manifest.sourceCounts,
    chunks: index.chunks.length,
    commit: index.manifest.commit,
  });
} catch {
  /* best effort */
}

await mkdir(fileURLToPath(new URL("../web/public/", import.meta.url)), { recursive: true });
await mkdir(fileURLToPath(new URL("../dist/", import.meta.url)), { recursive: true });
const json = JSON.stringify(index);
await writeFile(OUT, json);
await writeFile(OUT_LOCAL, json);

console.log(`\nindex: ${index.chunks.length} chunks · ${index.entities.length} entities`);
console.log(`manifest: commit ${index.manifest.commit ?? "(none)"} · digest ${index.manifest.contentDigest.slice(0, 16)}… · built ${index.manifest.builtAt}`);
console.log(`dedupe: ${index.dedupe.exactDuplicates} exact, ${index.dedupe.nearDuplicates} near, ${index.dedupe.crossSystemLinks} cross-system`);
console.log(`gap report:`);
for (const [g, missing] of Object.entries(index.gaps.missingByGrant)) console.log(`  ${g}: ${missing.join("; ")}`);
if (index.gaps.untaggedGrants.length) console.log(`  untagged grants: ${index.gaps.untaggedGrants.join(", ")}`);
console.log(`written -> ${OUT}`);
