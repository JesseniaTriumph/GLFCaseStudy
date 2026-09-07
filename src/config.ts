import type { SourceAdapter } from "./adapters/types.js";
import type { Principal } from "./core/types.js";
import { mockDrive } from "./adapters/mockDrive.js";
import { mockGivingData } from "./adapters/mockGivingData.js";
import { mockAirtable } from "./adapters/mockAirtable.js";

/**
 * v1 corpus definition. Swap the mock adapters for real ones here — nothing downstream changes.
 * Real adapters to add later: driveRealAdapter, givingDataApiAdapter, airtableApiAdapter,
 * and (only after governance review) notionAdapter. Zoom Chat is deliberately absent.
 */
export const ADAPTERS: SourceAdapter[] = [mockGivingData, mockDrive, mockAirtable];

export const CORPUS = {
  corpusLabel: "v1 mock corpus — GivingData + 3 Shared Drives + Airtable Relationships",
  excludeTiers: ["restricted", "never-ingest"] as const,
  notCovered: [
    "grants awarded before the corpus start date",
    "personal / My Drive content",
    "Zoom Chat and email",
    "board, HR, compensation, and legal material (Restricted tier — not indexed)",
  ],
};

/**
 * Demo principals for local runs (fictional users). In production these come from
 * Google OIDC + a synced Google Groups membership — see src/security/auth.ts.
 */
export const PRINCIPALS: Record<string, Principal> = {
  // a Programs team member — sees team + programs-only, never restricted
  programs: { userId: "d.okafor", groups: ["programs", "impact"], allowedTiers: ["team", "programs-only"] },
  // an Impact analyst — team-tier only in this demo (no programs-only diligence notes)
  impact: { userId: "l.fischer", groups: ["impact"], allowedTiers: ["team"] },
  // someone outside Programs/Impact — team-tier, and only if the ACL matches
  other: { userId: "r.mensah", groups: ["comms"], allowedTiers: ["team"] },
};
