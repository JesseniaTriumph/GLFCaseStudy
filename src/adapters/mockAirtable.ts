import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { SourceAdapter } from "./types.js";
import type { SourceDoc, Tier } from "../core/types.js";
import { detectLanguage } from "../util/text.js";

const DATA = fileURLToPath(new URL("../../data/mock/airtable.json", import.meta.url));
const GEN = fileURLToPath(new URL("../../data/generated/airtable.json", import.meta.url));

/**
 * Mock Airtable adapter.
 *
 * A real adapter would: use a read-only API token scoped to the "Relationships" base,
 * respect the ~5 req/s rate limit, resolve linked-record relationships, and download
 * attachments promptly (Airtable attachment URLs expire). Contact PII is redacted here
 * at intake — a general "who is our contact" answer returns a role and work email, never
 * a personal phone.
 */
export const mockAirtable: SourceAdapter = {
  system: "airtable",
  label: "Airtable (relationship CRM)",

  async pull(): Promise<SourceDoc[]> {
    const db = JSON.parse(await readFile(DATA, "utf8"));
    if (process.env.COMPASS_CORPUS === "full" && existsSync(GEN)) {
      const g = JSON.parse(await readFile(GEN, "utf8"));
      db.organizations = [...db.organizations, ...g.organizations];
      db.contacts = [...db.contacts, ...g.contacts];
      db.interactions = [...db.interactions, ...g.interactions];
    }
    const docs: SourceDoc[] = [];
    const contactsByOrg: Record<string, any[]> = {};
    for (const c of db.contacts) (contactsByOrg[c.orgId] ??= []).push(c);
    const interactionsByOrg: Record<string, any[]> = {};
    for (const i of db.interactions) (interactionsByOrg[i.orgId] ??= []).push(i);

    for (const org of db.organizations) {
      const contacts = contactsByOrg[org.id] ?? [];
      const text = [
        `# Relationship profile — ${org.name}`,
        `Type: ${org.type} · Stage: ${org.stage} · Geography: ${org.geography}`,
        org.givingDataId ? `Linked GivingData grant: ${org.givingDataId}` : `No linked GivingData record`,
        `Thesis tags: ${(org.thesisTags ?? []).join(", ") || "(none)"}`,
        `Relationship owner: ${org.relationshipOwner}`,
        `Source / how we met: ${org.source}`,
        `Last touchpoint: ${org.lastTouchpoint}`,
        ``,
        `## Contacts`,
        ...contacts.map((c) => `- ${c.title} — ${c.workEmail}` + (c.notes ? ` · note: ${c.notes}` : "")),
      ].join("\n");

      docs.push(
        mk(org.id, `Relationship profile — ${org.name}`, text, org.lastTouchpoint, "team", {
          recordType: "org-profile",
          organization: org.name,
          givingDataId: org.givingDataId,
          thesisTags: org.thesisTags,
          geography: org.geography,
          relationshipOwner: org.relationshipOwner,
          contacts: contacts.map((c) => ({ title: c.title, email: c.workEmail })),
        })
      );

      // interaction log — programs-only, one doc per interaction
      for (const it of interactionsByOrg[org.id] ?? []) {
        docs.push(
          mk(
            it.id,
            `${org.name} — ${it.type} (${it.date})`,
            `# ${it.type} with ${org.name} — ${it.date}\n${it.summary}\nAttendees: ${(it.attendees ?? []).join(", ")}`,
            it.date,
            (it.tier as Tier) ?? "programs-only",
            {
              recordType: "interaction",
              organization: org.name,
              givingDataId: org.givingDataId,
              interactionType: it.type,
              attendees: it.attendees ?? [],
            }
          )
        );
      }
    }
    return docs;
  },
};

function mk(sourceId: string, title: string, text: string, date: string | null, tier: Tier, meta: Record<string, unknown>): SourceDoc {
  return {
    id: `airtable:${sourceId}`,
    system: "airtable",
    sourceId,
    deepLink: `https://airtable.com/appEXAMPLE/tbl/${encodeURIComponent(sourceId)}`,
    title,
    text,
    date,
    language: detectLanguage(text),
    extractionConfidence: 1,
    tier,
    acl: tier === "programs-only" ? ["group:programs", "group:impact"] : ["*"], // team = any signed-in staff; programs-only = Programs + Impact
    entities: [],
    meta,
  };
}
