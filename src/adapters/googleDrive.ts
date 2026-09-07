/**
 * Real Google Drive connector.
 *
 * Authenticates as a Google Workspace **service account** (a robot account the Workspace
 * admin creates and grants read-only access to a named set of Shared Drives). It lists
 * files in those drives, exports native Google Docs/Sheets/Slides to text, records each
 * file's real permissions, and emits SourceDocs on the same contract as the mock.
 *
 * What it needs (env), all obtained from the Workspace admin in discovery (Drive
 * questions D2, D3, D4, D5):
 *   GOOGLE_SA_KEY_JSON     the service-account key file contents (JSON), OR
 *   GOOGLE_SA_KEY_FILE     a path to that JSON file
 *   GOOGLE_DRIVE_IDS       comma-separated Shared Drive ids to ingest
 *   GOOGLE_SUBJECT         optional: a user to impersonate (domain-wide delegation) if the
 *                          SA itself can't be added to the drives
 *
 * Binary files (PDF, Word, scans) are listed and linked but not text-extracted here —
 * production adds a PDF parser + OCR with a confidence score (D9). Native Google formats
 * extract cleanly and are the bulk of "the reasoning lives here" content.
 */
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import type { SourceAdapter } from "./types.js";
import type { SourceDoc } from "../core/types.js";
import { detectLanguage } from "../util/text.js";
import { HttpClient } from "./http.js";

interface SaKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
  webViewLink?: string;
  driveId?: string;
  parents?: string[];
}
interface Permission {
  type: string;
  emailAddress?: string;
  domain?: string;
  role: string;
}

const b64u = (b: Buffer | string) =>
  (Buffer.isBuffer(b) ? b : Buffer.from(b)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** service-account JWT → OAuth2 access token (read-only Drive scope) */
async function getAccessToken(key: SaKey, subject?: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = key.token_uri ?? "https://oauth2.googleapis.com/token";
  const claim = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
    ...(subject ? { sub: subject } : {}),
  };
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(claim));
  const sig = b64u(createSign("RSA-SHA256").update(`${head}.${body}`).sign(key.private_key));
  const assertion = `${head}.${body}.${sig}`;

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

const EXPORT: Record<string, { mime: string }> = {
  "application/vnd.google-apps.document": { mime: "text/plain" },
  "application/vnd.google-apps.spreadsheet": { mime: "text/csv" },
  "application/vnd.google-apps.presentation": { mime: "text/plain" },
};

/** Map Google Drive permissions to Compass ACL principals. */
function aclFrom(perms: Permission[], domain: string): string[] {
  const acl = new Set<string>();
  for (const p of perms) {
    if (p.type === "anyone") acl.add("*");
    else if (p.type === "domain" && p.domain === domain) acl.add("*"); // whole-domain share == any signed-in staff
    else if (p.type === "user" && p.emailAddress) acl.add(`user:${p.emailAddress.split("@")[0]}`);
    else if (p.type === "group" && p.emailAddress) acl.add(`group:${p.emailAddress.split("@")[0]}`);
  }
  // a file shared only with specific people/groups is not team-wide
  return acl.size ? [...acl] : ["group:programs"];
}

export async function makeGoogleDriveAdapter(env: NodeJS.ProcessEnv = process.env): Promise<SourceAdapter | null> {
  const rawKey = env.GOOGLE_SA_KEY_JSON ?? (env.GOOGLE_SA_KEY_FILE ? readFileSync(env.GOOGLE_SA_KEY_FILE, "utf8") : "");
  const driveIds = (env.GOOGLE_DRIVE_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!rawKey || driveIds.length === 0) return null;

  const key = JSON.parse(rawKey) as SaKey;
  const domain = env.COMPASS_HD ?? env.GOOGLE_SUBJECT?.split("@")[1] ?? "gitlabfoundation.org";
  const token = await getAccessToken(key, env.GOOGLE_SUBJECT);
  const http = new HttpClient({ headers: { authorization: `Bearer ${token}` }, minIntervalMs: 120 });

  return {
    system: "drive",
    label: `Google Drive (${driveIds.length} shared drive${driveIds.length > 1 ? "s" : ""})`,

    async pull({ since }: { since?: string } = {}): Promise<SourceDoc[]> {
      const docs: SourceDoc[] = [];
      for (const driveId of driveIds) {
        let pageToken: string | undefined;
        do {
          const url = new URL("https://www.googleapis.com/drive/v3/files");
          url.searchParams.set("corpora", "drive");
          url.searchParams.set("driveId", driveId);
          url.searchParams.set("includeItemsFromAllDrives", "true");
          url.searchParams.set("supportsAllDrives", "true");
          url.searchParams.set("pageSize", "200");
          url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,webViewLink,driveId,parents)");
          url.searchParams.set("q", "trashed = false" + (since ? ` and modifiedTime > '${since}'` : ""));
          if (pageToken) url.searchParams.set("pageToken", pageToken);

          const page = await http.getJson<{ files: DriveFile[]; nextPageToken?: string }>(url.toString());
          for (const f of page.files) {
            if (f.mimeType === "application/vnd.google-apps.folder") continue;

            let text = "";
            let extractionConfidence = 1;
            const exp = EXPORT[f.mimeType];
            if (exp) {
              text = await http.getText(
                `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=${encodeURIComponent(exp.mime)}`
              );
            } else if (f.mimeType === "text/plain" || f.mimeType === "text/markdown" || f.mimeType === "text/csv") {
              text = (await http.getText(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).slice(0, 2_000_000);
            } else {
              // PDF / Word / scans — linked but not parsed here (production: parser + OCR, D9)
              text = `[${f.mimeType} file "${f.name}" — not text-extracted in this build. Open the source to read it.]`;
              extractionConfidence = 0;
            }

            const perms = await http
              .getJson<{ permissions: Permission[] }>(
                `https://www.googleapis.com/drive/v3/files/${f.id}/permissions?supportsAllDrives=true&fields=permissions(type,emailAddress,domain,role)`
              )
              .then((r) => r.permissions)
              .catch(() => [] as Permission[]);

            docs.push({
              id: `drive:${f.id}`,
              system: "drive",
              sourceId: f.id,
              deepLink: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
              title: f.name,
              text,
              date: f.modifiedTime ?? f.createdTime ?? null,
              language: detectLanguage(text),
              extractionConfidence,
              tier: "team", // refined by the PII pass + folder rules in the pipeline
              acl: aclFrom(perms, domain),
              entities: [],
              meta: {
                recordType: "drive-document",
                mimeType: f.mimeType,
                driveId: f.driveId ?? driveId,
                parents: f.parents ?? [],
              },
            });
          }
          pageToken = page.nextPageToken;
        } while (pageToken);
      }
      return docs;
    },
  };
}
