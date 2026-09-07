import type { SourceDoc } from "../core/types.js";

/**
 * Every source connector implements this one interface — the mock adapters and the
 * real Google Drive / GivingData / Airtable / Notion / email adapters alike.
 *
 * This is the "swappable module" idea from DASH's mock-data pattern, made into a contract:
 * the pipeline downstream of `pull()` never knows or cares which adapter produced a doc.
 */
export interface SourceAdapter {
  system: string;
  /** Human label for logs and the coverage statement. */
  label: string;

  /**
   * Pull documents from the source.
   * Real adapters: authenticate (service account / OAuth), page through the API,
   * respect rate limits, use a change-feed for incremental sync, extract text + OCR.
   * `since` enables incremental sync; omit for a full backfill.
   */
  pull(opts?: { since?: string }): Promise<SourceDoc[]>;

  /**
   * Report sync health for the monitoring dashboard: how many items seen vs. added vs.
   * quarantined vs. failed. An alert fires when `seen` drops far below the previous run.
   */
  lastSyncStats?(): SyncStats | null;
}

export interface SyncStats {
  system: string;
  ranAt: string;
  seen: number;
  added: number;
  updated: number;
  quarantined: number;
  failed: number;
}
