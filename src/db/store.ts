/**
 * Postgres-backed store for the corpus index.
 *
 * Runs on PGlite (embedded Postgres — zero setup, so `npm run eval:pg` just works). The
 * schema and every query are standard Postgres; point `DATABASE_URL` at Cloud SQL and the
 * same code runs there. On Cloud SQL the tf-idf `jsonb` vector + JS cosine rerank become a
 * pgvector `embedding vector` column and an `ORDER BY embedding <=> $q` — the *query shape*,
 * and critically the permission filter, are identical.
 *
 * The point of this file: **the permission boundary is a SQL `WHERE` clause**, evaluated
 * by the database before any row is scored — not a filter applied in application code
 * over an in-memory array.
 */
import { PGlite } from "@electric-sql/pglite";
import type { Chunk, CorpusIndex, Principal } from "../core/types.js";
import { tokenize } from "../util/text.js";
import { rankPermitted, stubScore, type RetrieveResult } from "../retrieval/search.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS chunk (
  id            text PRIMARY KEY,
  doc_id        text NOT NULL,
  system        text NOT NULL,
  deep_link     text NOT NULL,
  doc_title     text NOT NULL,
  body          text NOT NULL,
  as_of         date,
  tier          text NOT NULL,
  acl           text[] NOT NULL,
  entity_ids    text[] NOT NULL,
  entity_labels text[] NOT NULL,
  locator       text,
  restricted_stub boolean NOT NULL DEFAULT false,
  fts           tsvector,
  vec           jsonb NOT NULL,             -- tf-idf sparse vector
  dense         jsonb                       -- learned embedding; a pgvector column on Cloud SQL
);
CREATE INDEX IF NOT EXISTS chunk_fts   ON chunk USING gin(fts);
CREATE INDEX IF NOT EXISTS chunk_acl   ON chunk USING gin(acl);
CREATE INDEX IF NOT EXISTS chunk_tier  ON chunk (tier);
`;

export class PgStore {
  private db: PGlite;
  private index!: CorpusIndex;

  private constructor(db: PGlite) {
    this.db = db;
  }

  static async open(): Promise<PgStore> {
    const db = await PGlite.create(); // in-memory; PGlite.create("./data.db") to persist
    await db.exec(SCHEMA);
    return new PgStore(db);
  }

  /** Load a built CorpusIndex. Idempotent-ish for the demo (truncates first). */
  async load(index: CorpusIndex): Promise<void> {
    this.index = index;
    await this.db.exec("TRUNCATE chunk;");
    for (const c of index.chunks) {
      await this.db.query(
        `INSERT INTO chunk
           (id, doc_id, system, deep_link, doc_title, body, as_of, tier, acl, entity_ids, entity_labels, locator, restricted_stub, fts, vec, dense)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, to_tsvector('english', $14), $15, $16)`,
        [
          c.id,
          c.docId,
          c.system,
          c.deepLink,
          c.docTitle,
          c.text,
          c.date,
          c.tier,
          c.acl,
          c.entities.map((e) => `${e.kind}:${e.id}`),
          c.entities.map((e) => e.label),
          (c as { locator?: string }).locator ?? null,
          !!c.restrictedStub,
          `${c.docTitle} ${c.text}`,
          JSON.stringify(c.vector),
          c.dense ? JSON.stringify(c.dense) : null,
        ]
      );
    }
  }

  /**
   * Retrieval with the permission boundary enforced IN SQL:
   *
   *   WHERE restricted_stub = false AND tier = ANY($allowedTiers) AND acl && $principalIds
   *
   * The database returns only rows the principal is independently entitled to read. Those
   * go straight into the SHARED ranker (retrieval/search.ts → rankPermitted), so the SQL
   * path and the in-memory path produce the same hits. Withheld rows (wrong tier, wrong
   * ACL, or a restricted stub) are counted separately in SQL for the honest disclosure.
   */
  async retrieve(query: string, principal: Principal, k = 8, queryDense?: number[]): Promise<RetrieveResult> {
    const principals = [`user:${principal.userId}`, ...principal.groups.map((g) => `group:${g}`), "*"];

    // --- permitted rows: THE permission filter, as a SQL WHERE clause ---
    const permittedRows = await this.db.query<{
      id: string; doc_id: string; system: string; deep_link: string; doc_title: string;
      body: string; as_of: string | null; tier: string; acl: string[];
      entity_ids: string[]; entity_labels: string[]; vec: unknown; dense: unknown;
    }>(
      `SELECT id, doc_id, system, deep_link, doc_title, body, as_of, tier, acl, entity_ids, entity_labels, vec, dense
         FROM chunk
        WHERE restricted_stub = false
          AND tier = ANY($1)
          AND acl && $2`,
      [principal.allowedTiers, principals]
    );

    // --- what was withheld (for the "N passages withheld" line) ---
    const withheldAgg = await this.db.query<{ tier: string; n: number }>(
      `SELECT tier, count(*)::int AS n
         FROM chunk
        WHERE restricted_stub = false
          AND NOT (tier = ANY($1) AND acl && $2)
        GROUP BY tier`,
      [principal.allowedTiers, principals]
    );
    const stubRows = await this.db.query<{ id: string }>(`SELECT id FROM chunk WHERE restricted_stub = true`);

    const permitted: Chunk[] = permittedRows.rows.map((r) => ({
      id: r.id,
      docId: r.doc_id,
      system: r.system,
      deepLink: r.deep_link,
      docTitle: r.doc_title,
      text: r.body,
      date: r.as_of,
      tier: r.tier as Chunk["tier"],
      acl: r.acl,
      entities: r.entity_ids.map((s, i) => {
        const [kind, ...rest] = s.split(":");
        return { kind: kind as never, id: rest.join(":"), label: r.entity_labels[i] ?? "" };
      }),
      tokens: tokenize(`${r.doc_title}\n${r.body}`),
      vector: (typeof r.vec === "string" ? JSON.parse(r.vec) : r.vec) as Record<string, number>,
      dense: r.dense ? ((typeof r.dense === "string" ? JSON.parse(r.dense) : r.dense) as number[]) : undefined,
    }));

    // --- shared ranker: identical to the in-memory path ---
    const hits = rankPermitted(permitted, query, this.index, k, queryDense);

    // --- restricted-stub relevance (do we have to refuse because the topic is restricted?) ---
    let restrictedTopScore = 0;
    const withheldTiers = new Set<string>();
    let withheldCount = 0;
    const stubById = new Map(this.index.chunks.filter((c) => c.restrictedStub).map((c) => [c.id, c]));
    for (const s of stubRows.rows) {
      const stub = stubById.get(s.id);
      if (!stub) continue;
      const sc = stubScore(stub, query, this.index);
      if (sc > 0.4) {
        withheldCount++;
        withheldTiers.add("restricted");
        restrictedTopScore = Math.max(restrictedTopScore, sc);
      }
    }
    for (const r of withheldAgg.rows) {
      withheldTiers.add(r.tier);
      withheldCount += Number(r.n);
    }

    return { hits, withheld: { count: withheldCount, tiers: [...withheldTiers], restrictedTopScore } };
  }

  /** Prove the boundary: what a principal can and cannot reach, straight from SQL. */
  async visibility(principal: Principal): Promise<{ visible: number; total: number; byTier: Record<string, number> }> {
    const principals = [`user:${principal.userId}`, ...principal.groups.map((g) => `group:${g}`), "*"];
    const total = await this.db.query<{ n: number }>(`SELECT count(*)::int n FROM chunk WHERE restricted_stub = false`);
    const vis = await this.db.query<{ n: number }>(
      `SELECT count(*)::int n FROM chunk WHERE restricted_stub = false AND tier = ANY($1) AND acl && $2`,
      [principal.allowedTiers, principals]
    );
    const byTier = await this.db.query<{ tier: string; n: number }>(
      `SELECT tier, count(*)::int n FROM chunk WHERE restricted_stub = false GROUP BY tier`
    );
    return {
      visible: Number(vis.rows[0]?.n ?? 0),
      total: Number(total.rows[0]?.n ?? 0),
      byTier: Object.fromEntries(byTier.rows.map((r) => [r.tier, Number(r.n)])),
    };
  }
}
