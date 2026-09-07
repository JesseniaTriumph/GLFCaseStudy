# Connectors — going from mock data to live data

Compass ships with a **synthetic mock corpus** so everything runs with zero setup. Each of
the three real connectors is built and wired in; it activates automatically the moment its
credentials are present in the environment (`.env`). Nothing downstream — retrieval,
permissions, citations, the eval harness — changes when a source goes live.

```
resolveAdapters()  →  for each system:  credentials in env?  →  LIVE connector
                                          otherwise           →  that system's mock
```

`npm run build:index` and `npm run serve` both print which mode each connector is in.

| System | Connector file | Status |
|---|---|---|
| GivingData | `src/adapters/givingData.ts` | Built against the documented REST shape; field names overridable. **Confirm the API surface in discovery (question G1).** |
| Google Drive | `src/adapters/googleDrive.ts` | Built. Service-account auth, native-format text export, real per-file permissions. Binary PDF/scan parsing is the one remaining piece (needs a parser + OCR — question D9). |
| Airtable | `src/adapters/airtable.ts` | Built. Read-only token, pagination, rate cap, linked-record capture, PII-field → tier default. |
| Zoom Team Chat | `src/adapters/zoom.ts` | Built, **off unless `COMPASS_ZOOM_ENABLE=true`**. Pulls public-channel history via the admin report API (`/report/chat/sessions`), month by month. DMs and private channels permanently excluded in code. |
| Zoom Archive | `src/adapters/zoom.ts` | Built, off by default. Recorded-call transcripts + in-meeting chat via the Archive Files API. Staged as `restricted` (held out of the index pending the Z8–Z12 review). |

### Zoom — what the research says about "5 years"

- **Team Chat cloud retention** defaults to **2 years**; a paid admin can set 1 day – 10 years (Account Settings → Chat). So five years of chat exists *only if* the Foundation raised retention above 5y and kept it there. `resolveAdapters()` calls `probeZoomChatRetention()` on start and prints what the account is actually set to.
- **The live chat message API only returns ~6 months** — not usable for a backfill. Backfill comes from (a) a compliance-archiving integration (Global Relay / Smarsh / Theta Lake) if one exists, else (b) the admin Chat History Report / report-sessions API for whatever the retention window holds.
- **Recorded meetings + transcripts** default to **30-day** retention and are usually auto-deleted. Five years of those almost certainly does not exist unless archiving was enabled.
- **Workaround when retention < 5y:** Compass's coverage line states the real window ("Zoom chat: Apr 2024 onward") so the gap is disclosed, never silent. Recommendation to the Foundation: raise retention now so the clock starts, or turn on archiving, or treat chat as a recent-only signal.

Scopes for the Server-to-Server OAuth app: `report_chat:read:admin`, `chat_channel:read:admin`, `account:read:admin`, and `archiving:read:list_archived_files:master` (Zoom Support must enable "Meeting and Webinar Archiving" for the last one).

---

## What each connector needs, and who provides it

### GivingData

| Value | What it is | Who gives it to you |
|---|---|---|
| `GIVINGDATA_BASE_URL` | The API root URL | GitLab Foundation's Grants Manager / GivingData support |
| `GIVINGDATA_API_KEY` | A read API key or OAuth token | same |
| `GIVINGDATA_FIELD_MAP` | *(optional)* JSON that maps Compass's expected field names to the Foundation's actual custom-field names | filled in after discovery questions G6–G13 |

If GivingData has **no API** on the Foundation's plan (a real possibility): they provide
scheduled CSV exports of grants / organizations / requirements plus a bulk document export,
and this connector is swapped for a CSV reader that produces the identical output.

### Google Drive

The Workspace admin creates a **service account** (a Google Cloud robot account), enables
the Drive API for it, and shares the specific Shared Drives with it as **Viewer**. They
then send you the service account's **key file** (a JSON download).

| Value | What it is |
|---|---|
| `GOOGLE_SA_KEY_FILE` or `GOOGLE_SA_KEY_JSON` | The key file — path, or the JSON contents |
| `GOOGLE_DRIVE_IDS` | The ids of the Shared Drives to ingest (from the drive URL, or the folder-tree export in discovery question D4) |
| `GOOGLE_SUBJECT` | *(only if)* the SA can't be added to the drives directly and domain-wide delegation is used instead |

Keep the key file out of git — put it in `secrets/` (git-ignored) or paste it into `.env`.

### Airtable

An Airtable admin creates a **personal access token** with `data.records:read` scope,
limited to the relevant base(s).

| Value | What it is |
|---|---|
| `AIRTABLE_TOKEN` | The `pat...` token |
| `AIRTABLE_BASE_ID` | The `app...` id from the base URL |
| `AIRTABLE_TABLES` | Comma-separated table names to ingest |
| `AIRTABLE_TIER_MAP` | *(optional)* JSON marking whole tables as `programs-only` or `restricted` |

---

## Sign-in (Google OAuth)

Separate from the connectors. Someone with access to the Foundation's **Google Cloud
console** creates one OAuth 2.0 Client ID (type: Web application), sets the redirect URI to
`https://<where-compass-runs>/auth/callback`, and sends you the **client ID** and **client
secret**. Put those plus `COMPASS_HD=gitlabfoundation.org` and a random
`COMPASS_SESSION_SECRET` in `.env`. Domain sign-in then works for every `@gitlabfoundation.org`
account. Group-based access needs a read-only Google Admin SDK lookup wired into
`resolveGroups` (in `scripts/serve.ts`) — until then, `COMPASS_GROUP_MAP` is a manual stand-in.

---

## Verifying a live connector

```bash
cp .env.example .env         # fill in one connector's values
npm run build:index          # prints "Airtable: LIVE (...)" and the pulled count
npm run ask -- --as programs "…a question you know the answer to…"
```

If a live connector is misconfigured it logs the error and falls back to that system's
mock rather than failing the whole build.
