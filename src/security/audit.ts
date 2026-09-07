/**
 * Tamper-evident audit log (see strategy doc §6.5).
 *
 * Append-only, hash-chained: each entry stores the hash of the previous entry, so any
 * deletion or edit anywhere in the history breaks the chain and `verify()` reports where.
 * In production the records are also streamed to write-once storage off the app host, so
 * an attacker who owns the host still cannot rewrite history. Here they append to a
 * local JSONL file.
 */
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";

export type AuditEvent =
  | {
      type: "query";
      user: string;
      question: string;
      citedRefs: string[];
      citedTiers: string[];
      withheld: number;
      withheldTiers: string[];
      confidence: string;
      mode: string;
    }
  | { type: "ingest"; sources: Record<string, number>; chunks: number; commit: string | null }
  | { type: "admin"; user: string; action: string; detail?: string }
  | { type: "auth"; user: string; result: "ok" | "denied"; reason?: string };

export interface AuditRecord {
  seq: number;
  ts: string;
  event: AuditEvent;
  prevHash: string;
  hash: string;
}

const GENESIS = "0".repeat(64);

function canonical(obj: unknown): string {
  if (Array.isArray(obj)) return `[${obj.map(canonical).join(",")}]`;
  if (obj && typeof obj === "object") {
    return `{${Object.keys(obj as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((obj as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(obj);
}

function hashEntry(seq: number, ts: string, event: AuditEvent, prevHash: string): string {
  return createHash("sha256").update(`${seq}\n${ts}\n${canonical(event)}\n${prevHash}`).digest("hex");
}

/**
 * Off-host stream (roadmap 3.5): each new record is also handed to `sink`, which in
 * production ships it to write-once storage / a SIEM so an attacker who owns the app host
 * still cannot rewrite history. `webhookSink` posts each record to an HTTPS endpoint.
 */
export type AuditSink = (rec: AuditRecord) => void;

export function webhookSink(url: string): AuditSink {
  return (rec) => {
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rec),
    }).catch(() => {
      /* best effort — the local hash chain is still the source of truth */
    });
  };
}

export class AuditLog {
  private path: string;
  private records: AuditRecord[] = [];
  private sink?: AuditSink;

  constructor(path: string, sink?: AuditSink) {
    this.path = path;
    this.sink = sink;
    if (existsSync(path)) {
      this.records = readFileSync(path, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as AuditRecord);
    }
  }

  get head(): string {
    return this.records.length ? this.records[this.records.length - 1]!.hash : GENESIS;
  }
  get length(): number {
    return this.records.length;
  }
  all(): readonly AuditRecord[] {
    return this.records;
  }

  append(event: AuditEvent): AuditRecord {
    const seq = this.records.length;
    const ts = new Date().toISOString();
    const prevHash = this.head;
    const hash = hashEntry(seq, ts, event, prevHash);
    const rec: AuditRecord = { seq, ts, event, prevHash, hash };
    this.records.push(rec);
    appendFileSync(this.path, JSON.stringify(rec) + "\n");
    this.sink?.(rec);
    return rec;
  }

  /** Walk the chain; return ok=false and the seq of the first broken link if tampered. */
  verify(): { ok: true } | { ok: false; brokenAt: number; reason: string } {
    let prev = GENESIS;
    for (const r of this.records) {
      if (r.prevHash !== prev) return { ok: false, brokenAt: r.seq, reason: "prevHash does not match prior entry" };
      const expect = hashEntry(r.seq, r.ts, r.event, r.prevHash);
      if (expect !== r.hash) return { ok: false, brokenAt: r.seq, reason: "entry hash does not match its contents" };
      prev = r.hash;
    }
    return { ok: true };
  }
}
