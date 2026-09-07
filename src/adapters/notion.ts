/**
 * Notion connector — a Phase 3 candidate add (roadmap 3.1). The Foundation's public
 * Handbook is Notion; an internal workspace very likely holds strategy, thesis
 * development, meeting notes, and OKRs that Drive doesn't. Clean API, so it's a strong
 * early addition once a governance review confirms scope.
 *
 * Credential-activated + an explicit enable (it isn't in the V1 corpus by default):
 *   COMPASS_NOTION_ENABLE=true
 *   NOTION_TOKEN                  an internal integration token (read-only)
 *   NOTION_DATABASE_IDS          comma-separated database ids to ingest (optional; if
 *                                omitted, uses search for pages the integration can see)
 *   NOTION_TIER                  default sensitivity tier for Notion content (default "programs-only")
 */
import type { SourceAdapter } from "./types.js";
import type { SourceDoc, Tier } from "../core/types.js";
import { detectLanguage } from "../util/text.js";
import { HttpClient } from "./http.js";

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";

type Block = { type: string; [k: string]: any };

function plainText(rich: any[] = []): string {
  return rich.map((r) => r.plain_text ?? "").join("");
}

function blockText(b: Block): string {
  const t = b.type;
  const node = b[t];
  if (!node) return "";
  if (Array.isArray(node.rich_text)) {
    const txt = plainText(node.rich_text);
    if (t === "heading_1") return `\n# ${txt}`;
    if (t === "heading_2") return `\n## ${txt}`;
    if (t === "heading_3") return `\n### ${txt}`;
    if (t === "bulleted_list_item" || t === "numbered_list_item") return `- ${txt}`;
    if (t === "to_do") return `- [${node.checked ? "x" : " "}] ${txt}`;
    if (t === "code") return "```\n" + txt + "\n```";
    if (t === "quote") return `> ${txt}`;
    return txt;
  }
  return "";
}

function titleOf(page: any): string {
  const props = page.properties ?? {};
  for (const v of Object.values<any>(props)) {
    if (v?.type === "title") return plainText(v.title) || "Untitled";
  }
  return page.child_page?.title ?? "Untitled";
}

export function makeNotionAdapter(env: NodeJS.ProcessEnv = process.env): SourceAdapter | null {
  if (env.COMPASS_NOTION_ENABLE !== "true") return null;
  const token = env.NOTION_TOKEN;
  if (!token) return null;
  const dbIds = (env.NOTION_DATABASE_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const tier = (env.NOTION_TIER as Tier) ?? "programs-only";
  const http = new HttpClient({
    headers: { authorization: `Bearer ${token}`, "notion-version": VERSION, "content-type": "application/json" },
    minIntervalMs: 350, // Notion's limit is ~3 req/s
  });

  async function pageIds(): Promise<string[]> {
    if (dbIds.length) {
      const ids: string[] = [];
      for (const db of dbIds) {
        let cursor: string | undefined;
        do {
          const body: any = { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) };
          const r: any = await fetch(`${API}/databases/${db}/query`, {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "notion-version": VERSION, "content-type": "application/json" },
            body: JSON.stringify(body),
          }).then((x) => x.json());
          for (const p of r.results ?? []) ids.push(p.id);
          cursor = r.has_more ? r.next_cursor : undefined;
        } while (cursor);
      }
      return ids;
    }
    // fall back to search
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const r: any = await fetch(`${API}/search`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "notion-version": VERSION, "content-type": "application/json" },
        body: JSON.stringify({ filter: { property: "object", value: "page" }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
      }).then((x) => x.json());
      for (const p of r.results ?? []) ids.push(p.id);
      cursor = r.has_more ? r.next_cursor : undefined;
    } while (cursor);
    return ids;
  }

  return {
    system: "notion",
    label: "Notion (internal workspace — strategy, notes, OKRs)",
    async pull(): Promise<SourceDoc[]> {
      const docs: SourceDoc[] = [];
      for (const id of await pageIds()) {
        const page: any = await http.getJson(`${API}/pages/${id}`);
        // gather block text (one level; nested toggles/columns are followed shallowly)
        const parts: string[] = [];
        let cursor: string | undefined;
        do {
          const b: any = await http.getJson(`${API}/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
          for (const blk of b.results ?? []) parts.push(blockText(blk));
          cursor = b.has_more ? b.next_cursor : undefined;
        } while (cursor);

        const text = `# ${titleOf(page)}\n\n${parts.filter(Boolean).join("\n")}`.trim();
        if (text.length < 20) continue;
        docs.push({
          id: `notion:${id}`,
          system: "notion",
          sourceId: id,
          deepLink: page.url ?? `https://notion.so/${id.replace(/-/g, "")}`,
          title: titleOf(page),
          text,
          date: page.last_edited_time ?? page.created_time ?? null,
          language: detectLanguage(text),
          extractionConfidence: 1,
          tier,
          acl: tier === "team" ? ["*"] : ["group:programs", "group:impact"],
          entities: [],
          meta: { recordType: "notion-page", lastEdited: page.last_edited_time },
        });
      }
      return docs;
    },
  };
}
