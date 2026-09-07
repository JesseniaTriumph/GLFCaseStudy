/**
 * Reconciliation report (roadmap 3.6 exit criterion: "clean reconciliation report;
 * conflicts shown not merged").
 *
 *   npm run reconcile          # against the full 5-year synthetic corpus
 *
 * Uses the GivingData grant list as the spine and checks the rest of the corpus against
 * it: which grants are missing an expected report, which Drive docs point at a grant id
 * that doesn't exist, which organizations resolved to two records, which figures disagree
 * across sources, what the pipeline set aside. Nothing here is auto-fixed — it's the sheet
 * a human works down before a production index is promoted.
 */
import { runPipeline } from "../src/pipeline/run.js";
import { mockGivingData } from "../src/adapters/mockGivingData.js";
import { mockDrive } from "../src/adapters/mockDrive.js";
import { mockAirtable } from "../src/adapters/mockAirtable.js";
import { mockZoom } from "../src/adapters/mockZoom.js";
import { CORPUS } from "../src/config.js";

process.env.COMPASS_CORPUS = "full";

const gd = await mockGivingData.pull();
const drive = await mockDrive.pull();
const airtable = await mockAirtable.pull();
const zoom = await mockZoom.pull();

const grantIds = new Set(gd.filter((d) => d.meta.recordType === "grant-fact-sheet").map((d) => d.meta.grantId as string));
const factSheets = gd.filter((d) => d.meta.recordType === "grant-fact-sheet");

// 1. Drive docs pointing at a grant id that isn't in the spine
const orphanDriveDocs = drive.filter((d) => d.meta.grantId && !grantIds.has(d.meta.grantId as string));

// 2. grants with an expected report that never arrived (requirement Overdue / no submittedDocId)
const missingReports: string[] = [];
for (const fs of factSheets) {
  const reqs = (fs.meta.requirements as any[]) ?? [];
  for (const r of reqs) if (/report/i.test(r.type) && (r.status === "Overdue" || !r.submittedDocId)) missingReports.push(`${fs.meta.grantId}: ${r.type} (${r.status})`);
}

// 3. grants with no diligence memo in Drive
const memoGrantIds = new Set(drive.filter((d) => /diligence/i.test(d.title)).map((d) => d.meta.grantId));
const grantsNoMemo = [...grantIds].filter((g) => !memoGrantIds.has(g));

// 4. Airtable orgs not linked to a GivingData grant
const unlinkedOrgs = airtable.filter((d) => d.meta.recordType === "org-profile" && !d.meta.givingDataId).map((d) => d.meta.organization);

// 5. untagged grants
const untagged = factSheets.filter((d) => !d.meta.thesisArea).map((d) => d.meta.grantId);

// 6. migration-boundary grants with blank projection fields
const migrated = gd.filter((d) => d.meta.recordType === "grant-fact-sheet" && String(d.text).includes("(untagged)") ).length;

// run the pipeline to get the dedupe + review-queue + excluded reports
const index = await runPipeline([mockGivingData, mockDrive, mockAirtable, mockZoom], {
  corpusLabel: CORPUS.corpusLabel, excludeTiers: [...CORPUS.excludeTiers], notCovered: CORPUS.notCovered, log: () => {},
});

// reporting cadence distribution — reporting does NOT come in uniformly
const cadence: Record<string, number> = {};
for (const fs of factSheets) {
  const f = (fs.meta.reportingFrequency as string) ?? "unknown";
  cadence[f] = (cadence[f] ?? 0) + 1;
}

const line = (n: number, label: string) => `  ${String(n).padStart(4)}  ${label}`;
console.log(`\nCOMPASS — reconciliation report (full synthetic corpus)\n${"=".repeat(56)}`);
console.log(`Spine: ${grantIds.size} grants in GivingData`);
console.log(`Reporting cadence (per grant, not uniform): ${Object.entries(cadence).map(([k, v]) => `${k} ${v}`).join(" · ")}\n`);
console.log(`Corpus:`);
console.log(line(gd.length, "GivingData records (fact sheets, reports, review notes, declined)"));
console.log(line(drive.length, "Drive documents"));
console.log(line(airtable.length, "Airtable records"));
console.log(line(zoom.length, "Zoom threads"));
console.log(`\nNeeds a human:`);
console.log(line(orphanDriveDocs.length, "Drive docs referencing a grant id NOT in GivingData → " + orphanDriveDocs.slice(0, 5).map((d) => d.sourceId).join(", ")));
console.log(line(missingReports.length, "grant reports expected but not received"));
console.log(line(grantsNoMemo.length, "grants with no diligence memo in Drive"));
console.log(line(unlinkedOrgs.length, "Airtable org records not linked to a grant → " + unlinkedOrgs.slice(0, 5).join(", ")));
console.log(line(untagged.length, "grants with no thesis-area tag"));
console.log(line(index.dedupe.nearDuplicates, "near-duplicate documents collapsed to one authoritative copy"));
console.log(line(index.dedupe.crossSystemLinks, "cross-system links (same report in Drive + the grantee portal)"));
console.log(line(index.reviewQueue.length, "entity-resolution calls flagged for review"));
console.log(line(index.gaps.excluded.lowExtractionConfidence.count, "documents set aside as unreadable (scans)"));
console.log(line(index.gaps.excluded.sensitivityTier, "documents held out by sensitivity tier (declined applicants, board, PII)"));
console.log(`\nConflicts (shown, never merged): surfaced per-answer at query time — see the "⚠ the cited sources disagree" block.`);
console.log(`\nA "clean" report = the first six lines are zero or explained, and every review-queue item has a decision.`);
