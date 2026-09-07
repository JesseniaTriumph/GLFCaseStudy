import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SourceAdapter } from "./types.js";
import type { SourceDoc, Tier } from "../core/types.js";
import { detectLanguage } from "../util/text.js";

const DATA = fileURLToPath(new URL("../../data/mock/givingdata.json", import.meta.url));
const GEN = fileURLToPath(new URL("../../data/generated/givingdata.json", import.meta.url));

async function loadDb() {
  const db = JSON.parse(await readFile(DATA, "utf8"));
  if (process.env.COMPASS_CORPUS === "full" && existsSync(GEN)) {
    const g = JSON.parse(await readFile(GEN, "utf8"));
    db.grants = [...db.grants, ...g.grants];
    db.organizations = [...db.organizations, ...g.organizations];
    db.declinedApplicants = [...(db.declinedApplicants ?? []), ...(g.declinedApplicants ?? [])];
    db.funds = [...db.funds, ...g.funds.filter((f: any) => !db.funds.some((x: any) => x.id === f.id))];
  }
  return db;
}

/**
 * Mock GivingData adapter.
 *
 * A real adapter would: authenticate with an API key / OAuth, page through the
 * /grants, /organizations, /requirements, /payments endpoints, respect rate limits,
 * use a change feed for incremental sync, and pull grantee-portal documents. Structured
 * records get rendered into a plain-language "fact sheet" so the same facts are
 * retrievable by semantic search, not only by filter — that's what this mock does.
 */
export const mockGivingData: SourceAdapter = {
  system: "givingdata",
  label: "GivingData (grants system of record)",

  async pull(): Promise<SourceDoc[]> {
    const db = await loadDb();
    const docs: SourceDoc[] = [];

    for (const g of db.grants) {
      // --- 1. the grant fact sheet (team tier) ---
      const factSheet = [
        `# Grant fact sheet — ${g.organizationName}`,
        `Grant ${g.id} · ${g.fund} · Program officer: ${g.programOfficer}`,
        `Title: ${g.title}`,
        `Thesis area: ${g.thesisArea ?? "(untagged)"} · Geography: ${g.geography}`,
        `Amount: ${g.currency} ${g.amount.toLocaleString()} · Status: ${g.status}`,
        `Term: ${g.startDate} to ${g.endDate}` + (g.coFunders?.length ? ` · Co-funders: ${g.coFunders.join(", ")}` : ""),
        ``,
        `## Projected impact (model ${g.projected.modelVersion})`,
        `North Star ratio: ${g.projected.northStar}x`,
        `Projected annual earnings gain per participant: $${g.projected.annualEarningsDelta?.toLocaleString()}`,
        `Projected lifetime earnings gain per participant: $${g.projected.lifetimeEarningsDelta?.toLocaleString()}`,
        `Projected participants reached: ${g.projected.participants?.toLocaleString()}`,
        ``,
        `## Reporting schedule`,
        ...g.requirements.map(
          (r: any) => `- ${r.type}: due ${r.dueDate} — status ${r.status}` + (r.submittedDocId ? ` (doc ${r.submittedDocId})` : "")
        ),
      ].join("\n");

      docs.push(mk(g.id, `Grant fact sheet — ${g.organizationName} (${g.id})`, factSheet, g.startDate, "team", g, {
        recordType: "grant-fact-sheet",
        grantId: g.id,
        organization: g.organizationName,
        fund: g.fund,
        thesisArea: g.thesisArea,
        geography: g.geography,
        programOfficer: g.programOfficer,
        projected: g.projected,
        requirements: g.requirements,
      }));

      // --- 2. one doc per reported period (team tier) ---
      for (const rep of g.reported) {
        const text = [
          `# ${g.organizationName} — ${rep.period} reported results`,
          `Grant ${g.id}. As reported on ${rep.asOf} using impact model ${rep.modelVersion}.`,
          rep.participants != null ? `Participants reached: ${rep.participants.toLocaleString()}` : "",
          rep.annualEarningsDelta != null ? `Reported annual earnings gain per participant: $${rep.annualEarningsDelta.toLocaleString()}` : "",
          rep.medianWageAtPlacement != null ? `Median wage at placement: $${rep.medianWageAtPlacement}/hr (regional baseline $${rep.regionalBaselineWage}/hr)` : "",
          ``,
          rep.narrative,
        ]
          .filter(Boolean)
          .join("\n");
        docs.push(
          mk(`${g.id}-${rep.period.replace(/\s+/g, "-")}`, `${g.organizationName} — ${rep.period} reported results`, text, rep.asOf, "team", g, {
            recordType: "reported-results",
            grantId: g.id,
            organization: g.organizationName,
            period: rep.period,
            modelVersion: rep.modelVersion,
            asOf: rep.asOf,
            duplicateOfPortal: g.requirements.find((r: any) => r.type.includes(rep.period.split(" ")[0]))?.submittedDocId ?? null,
          })
        );
      }

      // --- 3. review notes (PROGRAMS-ONLY tier) ---
      if (g.reviewNotes) {
        docs.push(
          mk(`${g.id}-review`, `${g.organizationName} — impact review notes (${g.id})`, `# Review notes — ${g.organizationName}\nGrant ${g.id}.\n\n${g.reviewNotes}`, g.startDate, "programs-only", g, {
            recordType: "review-notes",
            grantId: g.id,
            organization: g.organizationName,
          })
        );
      }
    }

    // --- 4. declined applicants (RESTRICTED — never indexed) ---
    // The Foundation's values are explicit that transparency does not extend to sharing
    // information about organizations that applied but were not funded. So declination
    // diligence is Restricted: Compass holds a metadata-only stub, never the content, and
    // any question that resolves to it is refused without confirming the record exists.
    // Surfacing a declination for a specific learning purpose is a logged, decision-owner-
    // approved carve-out, handled outside the retrieval path.
    for (const d of db.declinedApplicants ?? []) {
      const text = [
        `# Declined applicant — ${d.thesisArea} (${d.geography})`,
        `Decision: ${d.decision} on ${d.decidedOn}. Applicant identity withheld.`,
        `Reason (category): ${d.reason}`,
      ].join("\n");
      docs.push(
        mk(d.id, `Declined applicant — ${d.thesisArea} (${d.decidedOn})`, text, d.decidedOn, "restricted", null, {
          recordType: "declined-applicant",
          thesisArea: d.thesisArea,
          geography: d.geography,
        })
      );
    }

    return docs;
  },
};

function mk(sourceId: string, title: string, text: string, date: string | null, tier: Tier, grant: any, meta: Record<string, unknown>): SourceDoc {
  return {
    id: `givingdata:${sourceId}`,
    system: "givingdata",
    sourceId,
    deepLink: `https://givingdata.example/records/${encodeURIComponent(sourceId)}`,
    title,
    text,
    date,
    language: detectLanguage(text),
    extractionConfidence: 1, // structured source — no OCR risk
    tier,
    // ACL: team-tier grant data visible to all Programs + Impact; programs-only to Programs group.
    acl: tier === "programs-only" ? ["group:programs", "group:impact"] : ["*"], // team = any signed-in staff; programs-only = Programs + Impact
    entities: [],
    meta: { ...meta, grantAmount: grant?.amount, coFunders: grant?.coFunders ?? [] },
  };
}
