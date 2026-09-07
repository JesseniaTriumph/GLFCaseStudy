/**
 * Real Airtable connector.
 *
 * Reads the team's relationship CRM through the Airtable REST API and emits one SourceDoc
 * per record. It follows the same contract as the mock — nothing downstream changes.
 *
 * What it needs (env), all obtained from the Foundation in discovery (see the Airtable
 * section of the discovery request):
 *   AIRTABLE_TOKEN        a read-only personal access token scoped to the base(s)
 *   AIRTABLE_BASE_ID      the base id (appXXXXXXXXXXXXXX)
 *   AIRTABLE_TABLES       comma-separated table names to ingest, e.g. "Organizations,Contacts,Interactions"
 *   AIRTABLE_TIER_MAP     optional JSON: { "Interactions": "programs-only", "Donors": "restricted" }
 *
 * Discovery questions that pin down the mapping: A2 (token + rate limit), A5 (tables +
 * linked records), A6 (GivingData id cross-ref), A14 (which fields are contact PII),
 * A16 (view/field restrictions). Until A5/A6/A14 are answered the field selection below
 * is a sensible default, not the final mapping.
 */
import type { SourceAdapter } from "./types.js";
import type { SourceDoc, Tier } from "../core/types.js";
import { detectLanguage } from "../util/text.js";
import { HttpClient } from "./http.js";

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

const PII_FIELD = /\b(personal|home|mobile|cell)\b|personal ?email|home ?address|private note/i;

function renderRecord(table: string, rec: AirtableRecord): string {
  const lines = [`# ${table} record`, `Airtable id ${rec.id} · created ${rec.createdTime.slice(0, 10)}`, ``];
  for (const [k, v] of Object.entries(rec.fields)) {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    // linked records come back as arrays of record ids — keep them, they feed the entity graph
    const val = Array.isArray(v) ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : x)).join(", ") : String(v);
    lines.push(`**${k}:** ${val}`);
  }
  return lines.join("\n");
}

export function makeAirtableAdapter(env: NodeJS.ProcessEnv = process.env): SourceAdapter | null {
  const token = env.AIRTABLE_TOKEN;
  const baseId = env.AIRTABLE_BASE_ID;
  const tables = (env.AIRTABLE_TABLES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!token || !baseId || tables.length === 0) return null;

  const tierMap: Record<string, Tier> = env.AIRTABLE_TIER_MAP ? JSON.parse(env.AIRTABLE_TIER_MAP) : {};
  // Airtable's documented limit is 5 requests/second per base.
  const http = new HttpClient({ headers: { authorization: `Bearer ${token}` }, minIntervalMs: 220 });

  return {
    system: "airtable",
    label: `Airtable (${tables.join(", ")})`,

    async pull(): Promise<SourceDoc[]> {
      const docs: SourceDoc[] = [];
      for (const table of tables) {
        let offset: string | undefined;
        do {
          const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
          url.searchParams.set("pageSize", "100");
          if (offset) url.searchParams.set("offset", offset);
          const page = await http.getJson<{ records: AirtableRecord[]; offset?: string }>(url.toString());

          for (const rec of page.records) {
            const text = renderRecord(table, rec);
            // default tier: any field that looks like contact PII pushes the record to restricted
            const hasPii = Object.keys(rec.fields).some((k) => PII_FIELD.test(k));
            const tier: Tier = tierMap[table] ?? (hasPii ? "restricted" : "team");
            const name =
              (rec.fields["Name"] as string) ||
              (rec.fields["Organization"] as string) ||
              (rec.fields["Full Name"] as string) ||
              `${table} ${rec.id}`;

            docs.push({
              id: `airtable:${table}:${rec.id}`,
              system: "airtable",
              sourceId: `${table}:${rec.id}`,
              deepLink: `https://airtable.com/${baseId}/${encodeURIComponent(table)}/${rec.id}`,
              title: `${name} — ${table}`,
              text,
              date: (rec.fields["Last Modified"] as string) ?? rec.createdTime ?? null,
              language: detectLanguage(text),
              extractionConfidence: 1,
              tier,
              acl: tier === "team" ? ["*"] : ["group:programs", "group:impact"],
              entities: [],
              meta: {
                recordType: `airtable-${table.toLowerCase()}`,
                table,
                airtableId: rec.id,
                // a field named like a GivingData id is the cross-system join (discovery A6)
                grantId: (rec.fields["Grant ID"] as string) ?? (rec.fields["GivingData Grant"] as string) ?? null,
                linkedRecordFields: Object.entries(rec.fields)
                  .filter(([, v]) => Array.isArray(v) && v.every((x) => typeof x === "string" && /^rec[A-Za-z0-9]{14}$/.test(x)))
                  .map(([k]) => k),
              },
            });
          }
          offset = page.offset;
        } while (offset);
      }
      return docs;
    },
  };
}
