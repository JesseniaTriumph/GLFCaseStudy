# Field register — template

Fill one row per field Compass ingests, per system (roadmap 1.2). This is the artifact the
discovery sessions produce. Columns:

- **Field** — the source's API name (not the display label)
- **Means** — what it actually represents, in the team's words
- **Fill rate** — roughly what % of records have it (from a sample or an export)
- **Trust** — `authoritative` / `derived` / `proxy` / `abandoned` — a proxy or abandoned
  field is flagged in the answer, not treated as fact
- **Join role** — `primary key` / `foreign key` / `filter axis` / `content` / `—`
- **Tier** — `team` / `programs-only` / `restricted` / `inherits`
- **Notes** — vintage, template drift, migration gaps, anything that bites later

---

## GivingData

| Field | Means | Fill rate | Trust | Join role | Tier | Notes |
|---|---|---|---|---|---|---|
| `grantId` | | | authoritative | primary key | team | the join key across all systems |
| `organizationId` / `organizationName` | | | authoritative | foreign key | team | |
| `amount` / `currency` | | | authoritative | content | team | |
| `startDate` / `endDate` / `status` | | | authoritative | filter axis | team | confirm status enum incl. pending/declined |
| `fund` / `cohort` | | | | filter axis | team | primary query axis |
| `thesisArea` / `geography` | | | | filter axis | team | **check fill rate** — untagged = under-reporting |
| `programOfficer` | | | | filter axis | team | |
| projected North Star / earnings delta / participants | | | | content | team | entered at approval? updated? model version? |
| reported / actual outcomes | | | | content | team | structured field or only in a PDF? |
| requirement schedule + status + submittedDocId | | | | content | team | drives the completeness reconciliation |
| review / scorecard dimensions + reviewer notes | | | | content | programs-only | reviewer identity → restricted? |
| payment schedule / amounts | | | | content | programs-only | CFO sets the line for what Compass indexes |
| internal notes fields | | | | content | programs-only | |
| declined-applicant records + reasons | | | | content | **restricted** | never indexed (values doc) |

## Google Drive

| Field | Means | Fill rate | Trust | Join role | Tier | Notes |
|---|---|---|---|---|---|---|
| File ID / webViewLink / mimeType | | 100% | authoritative | content | — | citation target |
| Owner / Shared Drive / folder path | | | | filter axis | team | often the only source of fund/year/org |
| modifiedTime / createdTime | | 100% | authoritative | content | team | recency + "as of" dating |
| explicit ACL (drive + folder) | | | authoritative | — | — | feeds the permission map |
| extracted full text + section structure | | | derived | content | inherits | native Docs clean; scans need OCR + confidence |
| detected language | | | derived | — | team | ES/EN routing |
| extraction-confidence score | | | derived | — | — | < 0.6 → quarantine |
| organization / grant referenced | | | derived | foreign key | inherits | from entity resolution + folder path |

## Airtable

| Field | Means | Fill rate | Trust | Join role | Tier | Notes |
|---|---|---|---|---|---|---|
| org name + GivingData ID cross-ref | | | | foreign key | team | **the key question** — is there a reliable cross-ref? |
| org profile: type / thesis tags / geography / stage / source | | | | filter axis | team | |
| linked grant records | | | | foreign key | team | reuse Airtable's linked-record graph |
| contact: name / role / **work** email | | | | content | team | |
| contact: personal phone / email / address / private notes | | | | content | **restricted** | redacted by default |
| interaction log: date / type / summary / linked org | | | | content | programs-only | kept up reliably or sporadically? |
| formula / rollup / lookup fields | | | derived | — | inherits | recompute or mark derived — not independent evidence |
| donor / anonymous-funder records | | | | — | **restricted / never-ingest** | |
