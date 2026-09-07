/**
 * Preserve stage (TRD "Connect → Preserve → …", roadmap 2.2).
 *
 * Before anything is cleaned or indexed, each source document is written to an immutable,
 * content-addressed raw store: the original text keyed by its SHA-256, plus a metadata
 * record carrying the version, ACL, tier, extraction confidence, and capture time. The
 * index is fully derived from this — so a poisoned or wrongly-tiered index can always be
 * rebuilt from the raw store with the offending item excluded, and nothing is silently
 * lost between a sync and an index build.
 *
 * Here it writes to the local filesystem. In production this is a write-once object store
 * (S3 Object Lock / GCS retention policy) so an attacker who owns the app host still cannot
 * rewrite history.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceDoc } from "../core/types.js";

export interface RawRecord {
  id: string;
  system: string;
  sourceId: string;
  title: string;
  deepLink: string;
  contentHash: string;
  bytes: number;
  tier: string;
  acl: string[];
  extractionConfidence: number;
  date: string | null;
  capturedAt: string;
  /** increments each time this id is captured with different content */
  version: number;
}

export interface RawManifest {
  builtAt: string;
  count: number;
  totalBytes: number;
  bySystem: Record<string, number>;
  records: RawRecord[];
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export class RawStore {
  private dir: string;
  private index: Map<string, RawRecord> = new Map();

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
    const mf = join(dir, "_manifest.json");
    if (existsSync(mf)) {
      try {
        for (const r of (JSON.parse(readFileSync(mf, "utf8")) as RawManifest).records) this.index.set(r.id, r);
      } catch {
        /* start fresh */
      }
    }
  }

  /** Store one document's original bytes. Idempotent on identical content; versions on change. */
  put(doc: SourceDoc): RawRecord {
    const contentHash = sha256(doc.text);
    const prev = this.index.get(doc.id);
    const version = !prev ? 1 : prev.contentHash === contentHash ? prev.version : prev.version + 1;

    if (!existsSync(join(this.dir, `${contentHash}.txt`))) {
      writeFileSync(join(this.dir, `${contentHash}.txt`), doc.text);
    }
    const rec: RawRecord = {
      id: doc.id,
      system: doc.system,
      sourceId: doc.sourceId,
      title: doc.title,
      deepLink: doc.deepLink,
      contentHash,
      bytes: Buffer.byteLength(doc.text),
      tier: doc.tier,
      acl: doc.acl,
      extractionConfidence: doc.extractionConfidence,
      date: doc.date,
      capturedAt: new Date().toISOString(),
      version,
    };
    writeFileSync(join(this.dir, `${doc.id.replace(/[^\w.-]/g, "_")}.meta.json`), JSON.stringify(rec, null, 2));
    this.index.set(doc.id, rec);
    return rec;
  }

  manifest(): RawManifest {
    const records = [...this.index.values()].sort((a, b) => a.id.localeCompare(b.id));
    const bySystem: Record<string, number> = {};
    let totalBytes = 0;
    for (const r of records) {
      bySystem[r.system] = (bySystem[r.system] ?? 0) + 1;
      totalBytes += r.bytes;
    }
    const mf: RawManifest = { builtAt: new Date().toISOString(), count: records.length, totalBytes, bySystem, records };
    writeFileSync(join(this.dir, "_manifest.json"), JSON.stringify(mf, null, 2));
    return mf;
  }
}
