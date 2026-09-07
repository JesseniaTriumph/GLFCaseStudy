import type { SourceAdapter } from "./adapters/types.js";
import type { Principal } from "./core/types.js";
import { mockDrive } from "./adapters/mockDrive.js";
import { mockGivingData } from "./adapters/mockGivingData.js";
import { mockAirtable } from "./adapters/mockAirtable.js";
import { mockZoom } from "./adapters/mockZoom.js";
import { makeAirtableAdapter } from "./adapters/airtable.js";
import { makeGivingDataAdapter } from "./adapters/givingData.js";
import { makeGoogleDriveAdapter } from "./adapters/googleDrive.js";
import { makeZoomTeamChatAdapter, makeZoomArchiveAdapter, probeZoomChatRetention } from "./adapters/zoom.js";
import { makeNotionAdapter } from "./adapters/notion.js";

/**
 * Default adapter set = the synthetic mock corpus. The eval harness, the security checks,
 * and `npm run ask` all run against this so results are reproducible.
 */
export const ADAPTERS: SourceAdapter[] =
  process.env.COMPASS_CORPUS === "full"
    ? [mockGivingData, mockDrive, mockAirtable, mockZoom]
    : [mockGivingData, mockDrive, mockAirtable];

/**
 * The real ingest path. `build:index` and `serve` call this: for each system, if the
 * connector's credentials are present in the environment it uses the live connector,
 * otherwise it falls back to that system's mock. So the moment the Foundation provides a
 * credential, that source goes live — nothing else changes.
 *
 * Credentials per connector are documented in `docs/CONNECTORS.md` and `.env.example`.
 */
export async function resolveAdapters(env: NodeJS.ProcessEnv = process.env): Promise<{ adapters: SourceAdapter[]; report: string[] }> {
  const report: string[] = [];
  const pick = async (name: string, real: SourceAdapter | null | Promise<SourceAdapter | null>, mock: SourceAdapter) => {
    let r: SourceAdapter | null = null;
    try {
      r = await real;
    } catch (e) {
      report.push(`${name}: real connector configured but failed to initialise — ${(e as Error).message}. Using mock.`);
    }
    report.push(`${name}: ${r ? "LIVE (" + r.label + ")" : "mock (no credentials in env)"}`);
    return r ?? mock;
  };

  const adapters: SourceAdapter[] = [
    await pick("GivingData", makeGivingDataAdapter(env), mockGivingData),
    await pick("Google Drive", makeGoogleDriveAdapter(env), mockDrive),
    await pick("Airtable", makeAirtableAdapter(env), mockAirtable),
  ];

  // Notion — a Phase 3 candidate add, off unless COMPASS_NOTION_ENABLE=true. No mock.
  const notion = makeNotionAdapter(env);
  if (notion) {
    report.push(`Notion: LIVE (${notion.label})`);
    adapters.push(notion);
  }

  // Zoom — off unless COMPASS_ZOOM_ENABLE=true (governance gate). No mock: v1 scope
  // deliberately excludes it. When enabled, report what retention actually allows.
  if (env.COMPASS_ZOOM_ENABLE === "true") {
    const retention = await probeZoomChatRetention(env);
    report.push(
      retention
        ? `Zoom: chat cloud retention = "${retention.setting}"` +
          (retention.approxYears != null
            ? ` (~${retention.approxYears}y available — ${retention.approxYears >= 5 ? "5y backfill possible" : "less than 5y exists; coverage statement will say so"})`
            : "")
        : `Zoom: enabled, retention setting unreadable — confirm with the Workspace admin (discovery Z1)`
    );
    const zc = makeZoomTeamChatAdapter(env);
    const za = makeZoomArchiveAdapter(env);
    if (zc) {
      report.push(`Zoom Team Chat: LIVE (${zc.label})`);
      adapters.push(zc);
    }
    if (za) {
      report.push(`Zoom Archive: LIVE (${za.label})`);
      adapters.push(za);
    }
  }

  return { adapters, report };
}

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
 *
 * `groups` drive BOTH the permission filter (which tiers/records they may retrieve) and —
 * separately, and only when role-context is toggled on — the relevance logic in
 * src/roles.ts. Permission is strict; role-context is a signal, never a gate.
 */
export const PRINCIPALS: Record<string, Principal> = {
  // Programs — sees team + programs-only, never restricted
  programs: { userId: "d.okafor", groups: ["programs"], allowedTiers: ["team", "programs-only"] },
  // Impact analyst — team-tier only in this demo (no programs-only diligence notes)
  impact: { userId: "l.fischer", groups: ["impact"], allowedTiers: ["team"] },
  // Executive — team + programs-only
  executive: { userId: "e.wilson", groups: ["executive", "leadership"], allowedTiers: ["team", "programs-only"] },
  // Donor engagement / EIR — team + programs-only
  donor: { userId: "d.petty", groups: ["donor-engagement", "partnerships"], allowedTiers: ["team", "programs-only"] },
  // Finance / Grants Operations — team + programs-only
  finance: { userId: "j.vangrouw", groups: ["finance", "grants-ops"], allowedTiers: ["team", "programs-only"] },
  // someone outside Programs/Impact — team-tier, and only if the ACL matches
  other: { userId: "r.mensah", groups: ["comms"], allowedTiers: ["team"] },
};
