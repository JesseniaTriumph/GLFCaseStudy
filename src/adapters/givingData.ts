/**
 * Real GivingData connector.
 *
 * GivingData's API surface is the single biggest open question in discovery (question G1:
 * does the Foundation's plan include API access, what auth, what endpoints, what rate
 * limits — and if not, what scheduled exports are possible). This adapter is built against
 * the *documented shape* of the API (bearer-auth REST, paged collections for grants /
 * organizations / requirements) and every field name it reads is overridable via env, so
 * when discovery answers G6–G13 the mapping is a config change, not a rewrite.
 *
 * If the answer to G1 is "no API, exports only", swap this for a CSV adapter over the
 * export files — same SourceDoc output, and the fact-sheet rendering below is reused.
 *
 * Env:
 *   GIVINGDATA_BASE_URL     e.g. https://api.givingdata.com/v1   (confirm in discovery)
 *   GIVINGDATA_API_KEY      bearer token
 *   GIVINGDATA_GRANTS_PATH        default "/grants"
 *   GIVINGDATA_ORGS_PATH          default "/organizations"
 *   GIVINGDATA_REQUIREMENTS_PATH  default "/requirements"
 *   GIVINGDATA_FIELD_MAP    optional JSON to remap field names (see FIELDS below)
 */
import type { SourceAdapter } from "./types.js";
import type { SourceDoc } from "../core/types.js";
import { detectLanguage } from "../util/text.js";
import { HttpClient } from "./http.js";

/** Default field names — override any of these with GIVINGDATA_FIELD_MAP once G6–G13 are answered. */
const FIELDS = {
  grantId: "grantId",
  orgId: "organizationId",
  orgName: "organizationName",
  title: "title",
  fund: "fund",
  programOfficer: "programOfficer",
  thesisArea: "thesisArea",
  geography: "geography",
  amount: "amount",
  currency: "currency",
  status: "status",
  startDate: "startDate",
  endDate: "endDate",
  // projected / reported impact — G7, G8
  projectedNorthStar: "projectedNorthStar",
  projectedEarningsDelta: "projectedEarningsDelta",
  projectedParticipants: "projectedParticipants",
  reviewNotes: "reviewNotes", // G10 — programs-only
};

type Row = Record<string, unknown>;
const g = (row: Row, key: string) => row[key];

function factSheet(row: Row, F: typeof FIELDS): string {
  const line = (label: string, v: unknown) => (v == null || v === "" ? null : `${label}: ${v}`);
  return [
    `# Grant fact sheet — ${g(row, F.orgName) ?? g(row, F.orgId)}`,
    line("Grant", g(row, F.grantId)),
    line("Fund", g(row, F.fund)),
    line("Program officer", g(row, F.programOfficer)),
    line("Title", g(row, F.title)),
    line("Thesis area", g(row, F.thesisArea)),
    line("Geography", g(row, F.geography)),
    line("Amount", g(row, F.amount) != null ? `${g(row, F.currency) ?? "USD"} ${g(row, F.amount)}` : null),
    line("Status", g(row, F.status)),
    line("Term", g(row, F.startDate) ? `${g(row, F.startDate)} to ${g(row, F.endDate) ?? "?"}` : null),
    ``,
    `## Projected impact`,
    line("North Star ratio", g(row, F.projectedNorthStar)),
    line("Projected earnings gain per participant", g(row, F.projectedEarningsDelta)),
    line("Projected participants reached", g(row, F.projectedParticipants)),
  ]
    .filter(Boolean)
    .join("\n");
}

export function makeGivingDataAdapter(env: NodeJS.ProcessEnv = process.env): SourceAdapter | null {
  const baseUrl: string | undefined = env.GIVINGDATA_BASE_URL;
  const apiKey = env.GIVINGDATA_API_KEY;
  if (!baseUrl || !apiKey) return null;
  const root = baseUrl.replace(/\/$/, "");

  const F = { ...FIELDS, ...(env.GIVINGDATA_FIELD_MAP ? JSON.parse(env.GIVINGDATA_FIELD_MAP) : {}) } as typeof FIELDS;
  const grantsPath = env.GIVINGDATA_GRANTS_PATH ?? "/grants";
  const reqPath = env.GIVINGDATA_REQUIREMENTS_PATH ?? "/requirements";
  const http = new HttpClient({ headers: { authorization: `Bearer ${apiKey}` }, minIntervalMs: 200 });

  /** page through a collection endpoint; tolerate the two common paging styles */
  async function* collection(path: string): AsyncGenerator<Row> {
    let url: string | null = `${root}${path}?pageSize=100`;
    while (url) {
      const page: any = await http.getJson(url);
      const rows: Row[] = Array.isArray(page) ? page : (page.data ?? page.items ?? page.results ?? []);
      for (const r of rows) yield r;
      url = page.next ?? page.nextPageUrl ?? (page.nextCursor ? `${root}${path}?cursor=${page.nextCursor}` : null);
    }
  }

  return {
    system: "givingdata",
    label: "GivingData (grants system of record)",

    async pull(): Promise<SourceDoc[]> {
      const docs: SourceDoc[] = [];

      // requirements indexed by grant id so the fact sheet can list the reporting schedule
      const reqByGrant = new Map<string, Row[]>();
      try {
        for await (const r of collection(reqPath)) {
          const gid = String(g(r, F.grantId) ?? "");
          if (!gid) continue;
          const list = reqByGrant.get(gid) ?? [];
          list.push(r);
          reqByGrant.set(gid, list);
        }
      } catch {
        /* requirements endpoint optional / may not exist — confirm in discovery G9 */
      }

      for await (const row of collection(grantsPath)) {
        const gid = String(g(row, F.grantId) ?? "");
        const reqs = reqByGrant.get(gid) ?? [];
        const sheet =
          factSheet(row, F) +
          (reqs.length
            ? `\n\n## Reporting schedule\n` +
              reqs.map((r) => `- ${g(r, "type") ?? "report"}: due ${g(r, "dueDate") ?? "?"} — ${g(r, "status") ?? "?"}`).join("\n")
            : "");

        docs.push(mk(`givingdata:${gid}`, `Grant fact sheet — ${g(row, F.orgName)} (${gid})`, sheet, g(row, F.startDate), "team", {
          recordType: "grant-fact-sheet",
          grantId: gid,
          organization: g(row, F.orgName),
          fund: g(row, F.fund),
          thesisArea: g(row, F.thesisArea),
          geography: g(row, F.geography),
          programOfficer: g(row, F.programOfficer),
          grantAmount: g(row, F.amount),
        }));

        // review / scorecard notes — programs-only (G10, G20)
        const notes = g(row, F.reviewNotes);
        if (notes) {
          docs.push(
            mk(`givingdata:${gid}-review`, `${g(row, F.orgName)} — review notes (${gid})`, `# Review notes — ${g(row, F.orgName)}\nGrant ${gid}.\n\n${notes}`, g(row, F.startDate), "programs-only", {
              recordType: "review-notes",
              grantId: gid,
              organization: g(row, F.orgName),
            })
          );
        }
      }
      return docs;
    },
  };
}

function mk(id: string, title: string, text: string, date: unknown, tier: "team" | "programs-only", meta: Record<string, unknown>): SourceDoc {
  const sourceId = id.split(":").slice(1).join(":");
  return {
    id,
    system: "givingdata",
    sourceId,
    deepLink: `${process.env.GIVINGDATA_RECORD_URL ?? "https://app.givingdata.com/records/"}${encodeURIComponent(sourceId)}`,
    title,
    text,
    date: typeof date === "string" ? date : null,
    language: detectLanguage(text),
    extractionConfidence: 1,
    tier,
    acl: tier === "team" ? ["*"] : ["group:programs", "group:impact"],
    entities: [],
    meta,
  };
}
