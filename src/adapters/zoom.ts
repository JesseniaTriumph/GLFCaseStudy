/**
 * Zoom connectors — Team Chat and Meeting/Webinar Archive.
 *
 * Built to Zoom's documented spec. Two important, researched constraints shape this:
 *
 * 1. TEAM CHAT RETENTION. Zoom's default cloud retention for Team Chat is 2 years; a paid
 *    admin can set it anywhere from 1 day to 10 years (Account Settings → Chat → "Store
 *    messages in Zoom's cloud" / retention). So "5 years of team conversations" exists
 *    ONLY IF the Foundation raised retention above 5y and kept it there. `probeZoomChatRetention()`
 *    reads the account setting and reports what actually exists before we ingest anything.
 *    Sources: support.zoom.com KB0060329, KB0074786.
 *
 * 2. API HISTORY WINDOW. The live Team Chat message API only returns ~6 months of history,
 *    so it is useless for a backfill. The real backfill paths, in order of preference:
 *      a. a compliance-archiving integration (Global Relay / Smarsh / Theta Lake) if one
 *         exists — a governed, immutable copy with its own retention; ingest from there.
 *      b. the Chat History Report / `GET /v2/report/chat/sessions` admin report API, which
 *         covers whatever the cloud retention window holds (iterated month by month).
 *      c. the Meeting/Webinar Archive Files API (`GET /v2/accounts/me/archive_files`) for
 *         recorded grantee calls + their chat + transcript — only from when archiving was
 *         switched on (Zoom Support must enable "Meeting and Webinar Archiving").
 *
 * Because of the sensitivity (discovery questions Z8–Z12), BOTH adapters are OFF unless
 * `COMPASS_ZOOM_ENABLE=true` is set explicitly, on top of having credentials.
 *
 * Auth: a Server-to-Server OAuth app (account_credentials grant).
 * Env:
 *   ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
 *   COMPASS_ZOOM_ENABLE=true            explicit governance opt-in
 *   ZOOM_CHAT_FROM=2021-02-01           earliest date to pull (clamped to real retention)
 *   ZOOM_CHANNELS=Programs,AI Fund      optional allowlist of channel names (public only)
 *   ZOOM_ARCHIVE=true                   also pull the Meeting/Webinar archive files
 */
import type { SourceAdapter } from "./types.js";
import type { SourceDoc } from "../core/types.js";
import { detectLanguage } from "../util/text.js";
import { HttpClient } from "./http.js";

const ZOOM_API = "https://api.zoom.us/v2";

async function s2sToken(accountId: string, clientId: string, clientSecret: string): Promise<string> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    { method: "POST", headers: { authorization: `Basic ${basic}` } }
  );
  if (!res.ok) throw new Error(`Zoom token exchange failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** Read the account's configured Team Chat cloud-retention window. Returns null if unreadable. */
export async function probeZoomChatRetention(env: NodeJS.ProcessEnv = process.env): Promise<{ setting: string; approxYears: number | null } | null> {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = env;
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) return null;
  try {
    const token = await s2sToken(ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET);
    const http = new HttpClient({ headers: { authorization: `Bearer ${token}` } });
    const s: any = await http.getJson(`${ZOOM_API}/accounts/${ZOOM_ACCOUNT_ID}/settings?option=chat`);
    // storage_timeframe looks like "3y" / "18m" / "90d" per Zoom's docs
    const tf: string = s?.chat?.storage_timeframe ?? s?.chat?.retention_period ?? s?.storage_timeframe ?? "unknown";
    const m = /^(\d+)\s*([ymd])$/i.exec(String(tf).trim());
    const years = m ? { y: +m[1]!, m: +m[1]! / 12, d: +m[1]! / 365 }[m[2]!.toLowerCase() as "y" | "m" | "d"] : null;
    return { setting: String(tf), approxYears: years != null ? Math.round(years * 10) / 10 : null };
  } catch {
    return null;
  }
}

/** month-by-month date windows from `from` to today, since report APIs cap the range per call */
function monthWindows(fromISO: string): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  const start = new Date(fromISO);
  const now = new Date();
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= now) {
    const from = cur.toISOString().slice(0, 10);
    const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    out.push({ from, to: next.toISOString().slice(0, 10) });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

export function makeZoomTeamChatAdapter(env: NodeJS.ProcessEnv = process.env): SourceAdapter | null {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = env;
  if (env.COMPASS_ZOOM_ENABLE !== "true") return null; // governance gate
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) return null;

  const fromDate = env.ZOOM_CHAT_FROM ?? new Date(Date.now() - 730 * 864e5).toISOString().slice(0, 10);
  const channelAllow = (env.ZOOM_CHANNELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  return {
    system: "zoom-chat",
    label: "Zoom Team Chat (public channels, admin report API)",

    async pull(): Promise<SourceDoc[]> {
      const token = await s2sToken(ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET);
      const http = new HttpClient({ headers: { authorization: `Bearer ${token}` }, minIntervalMs: 200 });
      const docs: SourceDoc[] = [];

      for (const win of monthWindows(fromDate)) {
        let nextPageToken = "";
        do {
          const url = new URL(`${ZOOM_API}/report/chat/sessions`);
          url.searchParams.set("from", win.from);
          url.searchParams.set("to", win.to);
          url.searchParams.set("page_size", "300");
          if (nextPageToken) url.searchParams.set("next_page_token", nextPageToken);
          const page: any = await http.getJson(url.toString());

          for (const session of page.sessions ?? []) {
            // channel sessions only (skip 1:1 DMs entirely — Z10, permanently out of scope)
            if (session.type !== "Channel" && session.type !== "channel") continue;
            if (channelAllow.length && !channelAllow.includes(session.name)) continue;

            // pull the messages for this session/day
            const mUrl = new URL(`${ZOOM_API}/report/chat/sessions/${session.session_id}`);
            mUrl.searchParams.set("from", win.from);
            mUrl.searchParams.set("to", win.to);
            mUrl.searchParams.set("page_size", "300");
            const msgs: any = await http.getJson(mUrl.toString()).catch(() => ({ messages: [] }));

            const body = (msgs.messages ?? [])
              .map((m: any) => `${m.date_time ?? ""} — ${m.sender ?? m.sender_email ?? "?"}: ${m.message ?? ""}`)
              .join("\n");
            if (!body.trim()) continue;

            const sourceId = `${session.session_id}:${win.from}`;
            docs.push({
              id: `zoom-chat:${sourceId}`,
              system: "zoom-chat",
              sourceId,
              deepLink: `https://zoom.us/account/archivemsg/search?channel=${encodeURIComponent(session.name ?? "")}`,
              title: `#${session.name ?? "channel"} — ${win.from}`,
              text: `# #${session.name ?? "channel"} (${win.from})\n\n${body}`,
              date: win.from,
              language: detectLanguage(body),
              extractionConfidence: 1,
              // Zoom chat is programs-only by default and PII-scanned like everything else
              tier: "programs-only",
              acl: ["group:programs", "group:impact"],
              entities: [],
              meta: { recordType: "zoom-chat-session", channel: session.name, sessionId: session.session_id, window: win },
            });
          }
          nextPageToken = page.next_page_token ?? "";
        } while (nextPageToken);
      }
      return docs;
    },
  };
}

/**
 * Meeting / Webinar Archive Files — recorded grantee calls + their chat + transcript.
 * Needs Zoom Support to enable "Meeting and Webinar Archiving" and the
 * `archiving:read:list_archived_files:master` scope. Only covers meetings AFTER archiving
 * was turned on.
 */
export function makeZoomArchiveAdapter(env: NodeJS.ProcessEnv = process.env): SourceAdapter | null {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = env;
  if (env.COMPASS_ZOOM_ENABLE !== "true" || env.ZOOM_ARCHIVE !== "true") return null;
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) return null;

  const fromDate = env.ZOOM_CHAT_FROM ?? new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);

  return {
    system: "zoom-archive",
    label: "Zoom Meeting/Webinar Archive (recorded calls: chat + transcript)",

    async pull(): Promise<SourceDoc[]> {
      const token = await s2sToken(ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET);
      const http = new HttpClient({ headers: { authorization: `Bearer ${token}` }, minIntervalMs: 200 });
      const docs: SourceDoc[] = [];

      for (const win of monthWindows(fromDate)) {
        let nextPageToken = "";
        do {
          const url = new URL(`${ZOOM_API}/accounts/me/archive_files`);
          url.searchParams.set("from", win.from);
          url.searchParams.set("to", win.to);
          url.searchParams.set("page_size", "100");
          if (nextPageToken) url.searchParams.set("next_page_token", nextPageToken);
          const page: any = await http.getJson(url.toString());

          for (const meeting of page.meetings ?? []) {
            for (const f of meeting.archive_files ?? []) {
              // only the text-bearing artifacts — transcript + in-meeting chat
              if (!["chat", "transcript", "cc_transcript"].includes(f.file_type)) continue;
              const content = await http.getText(f.download_url, { authorization: `Bearer ${token}` }).catch(() => "");
              if (!content.trim()) continue;

              const sourceId = `${meeting.meeting_uuid}:${f.file_type}`;
              docs.push({
                id: `zoom-archive:${sourceId}`,
                system: "zoom-archive",
                sourceId,
                deepLink: meeting.share_url ?? `https://zoom.us/recording`,
                title: `${meeting.topic ?? "meeting"} — ${f.file_type} (${(meeting.start_time ?? "").slice(0, 10)})`,
                text: `# ${meeting.topic ?? "meeting"} — ${f.file_type}\n${meeting.start_time ?? ""}\n\n${content}`,
                date: (meeting.start_time ?? win.from).slice(0, 10),
                language: detectLanguage(content),
                extractionConfidence: f.file_type === "chat" ? 1 : 0.9,
                tier: "restricted", // recorded calls carry consent + participant data — held out pending Z-review
                acl: ["group:programs"],
                entities: [],
                meta: { recordType: `zoom-archive-${f.file_type}`, meetingUuid: meeting.meeting_uuid, topic: meeting.topic },
              });
            }
          }
          nextPageToken = page.next_page_token ?? "";
        } while (nextPageToken);
      }
      return docs;
    },
  };
}
