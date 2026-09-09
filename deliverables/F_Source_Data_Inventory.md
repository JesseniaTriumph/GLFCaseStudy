# Source data inventory — every object and field we would pull from the four systems

**Compass · GitLab Foundation · companion to the strategy doc and discovery guide**
**Jessenia Cintron**

> The team has been clear: Compass must work from data in their four systems — Google
> Drive, GivingData, Airtable, and Zoom Chat. This document is the **complete extraction
> map** so nothing is missed: every object type, every field, how we get it, why we pull
> it, what it joins to, and its sensitivity tier.
>
> Legend for **Tier**: `T` = team · `P` = programs-only · `R` = restricted (not indexed) ·
> `!` = PII / redact-or-tier-up at intake. **Join** = its role in the entity graph.
> Fields marked *(confirm)* depend on how the Foundation has configured that system and
> are validated in discovery (see the discovery guide).

---

## 1. GivingData

GivingData is a configurable grants-management platform. The objects below are its
standard model; the Foundation will also have **custom fields** on most of them (thesis
area, North Star projection, cohort, etc.) that we enumerate one by one in discovery.

**Access:** REST API if the plan includes it *(confirm)* — otherwise scheduled CSV/report
exports + a grantee-portal document export. Incremental by `lastModified` where available.

### 1.1 Request / Grant (the core object)

| Field group | Fields | Why we pull it | Join | Tier |
|---|---|---|---|---|
| Identity | Grant ID / Request ID, legacy ID *(confirm — migration)*, record type (LOI / full request / grant / amendment) | **Primary join key.** Record type tells us draft vs. awarded. | **grant** | T |
| Org link | Organization ID, organization name, fiscal sponsor (if any) | Links grant ↔ org | grant→org | T |
| Money | Amount requested, amount awarded, currency, amount paid to date, amount remaining, matching / co-funding amount | Grant facts; "how much did we give"; co-funding context | — | T |
| Dates | Submitted, approved / board-decision, start, end, close, next-report-due | Timeline, recency, reconciliation of what reports should exist | — | T |
| Status / workflow | Pipeline stage, status (in review / approved / active / closed / declined), decline reason, workflow step, assigned reviewer | Filtering; "did we decline X and why"; who owned it | — | T / P (decline notes) |
| Program structure | Fund / portfolio, program area, **thesis area** *(custom)*, cohort / initiative, strategy tag | Primary query + filter axis | grant→fund, grant→thesis | T |
| People | Program officer / grant manager, secondary staff, board sponsor | "Who ran this grant" — feeds follow-up suggestions | grant→person | T |
| Purpose | Grant title, purpose statement, description, project vs. general-operating flag, geographic scope, population served | What the grant is; retrieval content | grant→geography | T |
| Impact — projected *(custom)* | North Star ratio (projected), projected annual earnings delta / participant, projected lifetime earnings delta, projected participants reached, model version, assumptions note | Half of every performance-vs-plan answer; **vintage-stamped** | — | T |
| Impact — reported *(custom, may live on Requirements)* | Actual participants, actual earnings delta, actual North Star, as-of date, model version, data-quality note | The other half | — | T |
| Diligence | Impact-scorecard rubric dimensions + scores, reviewer narrative, risk flags, reference-check summary | "Why did we fund / decline"; diligence rationale | — | P |
| Financial detail | Payment schedule link, budget link, GL / account code, expenditure-responsibility flag, 990-PF classification | Financial context (scope set with CFO); compliance flags | — | P |
| Compliance | Confidentiality clause flag, data-use restriction flag, co-funder MOU reference, conflict-of-interest note | Drives what we may ingest and send to an LLM | — | P / R |
| System | Created / modified timestamps, created-by, record owner, tags, archived flag | Incremental sync, audit, provenance | — | T |

### 1.2 Organization

| Fields | Why | Join | Tier |
|---|---|---|---|
| Org ID, legal name, DBA / aka names, parent / affiliate org | Entity resolution anchor; catches "Org" vs "Org, Inc." | **organization** | T |
| EIN / tax ID, 501(c)(3) status, fiscal sponsor, country of registration | Compliance; dedupe key | organization | T / ! |
| Address, region, service geographies | Geographic queries | org→geography | T |
| Mission, focus areas, org type (direct service / intermediary / research / advocacy) | Retrieval content; portfolio analysis | org→thesis | T |
| Website, sector tags, lifecycle stage with the Foundation | Context | — | T |
| Total granted to date, active grant count, first / last grant date | "What's our history with them" | org→grant | T |
| Internal assessment / relationship notes | Candid context | — | P |
| Banking details, audited financials, board list | Confidential | — | R / ! |

### 1.3 Contact / Person

| Fields | Why | Join | Tier |
|---|---|---|---|
| Contact ID, name, title / role, organization link, primary-contact flag | "Who do we know there"; follow-up routing | **person**, person→org | T / ! |
| Work email, work phone | Follow-up email drafting | person | T |
| Personal email, personal phone, mailing address, assistant | Only if an answer needs it | person | R / ! |
| Relationship owner (our staff), last-contacted date, contact type (grantee / funder / expert / advisor) | Routing follow-ups to the right internal person | person→person | T |
| Notes, subjective impressions | Careful handling | — | P |
| Demographic fields (if collected) | Almost always exclude | — | R / ! |

### 1.4 Requirement / Report (grantee deliverables)

| Fields | Why | Join | Tier |
|---|---|---|---|
| Requirement ID, grant link, type (progress report / final report / financial report / check-in), title | Reconciliation: what should exist | requirement→grant | T |
| Due date, submitted date, status (upcoming / due / submitted / accepted / overdue / waived), reminder history | **Gap report** — "is Q3 here?" | — | T |
| Submitted documents (portal uploads), narrative fields, structured outcome fields, budget-vs-actual | The reported content + actuals | — | T |
| Internal review: reviewer, review notes, accepted / revision-requested, follow-up actions | "What did we think of their report" | — | P |

### 1.5 Payment / Transaction

| Fields | Why | Join | Tier |
|---|---|---|---|
| Payment ID, grant link, scheduled date, paid date, amount, currency, status (scheduled / approved / paid / held) | "Where are we in disbursement"; a held payment signals a problem | payment→grant | T / P |
| Payment conditions / contingencies, hold reason | Context for renewal decisions | — | P |
| Check / wire reference, GL posting | Finance reconciliation (scope with CFO) | — | P |

### 1.6 Budget

| Fields | Why | Join | Tier |
|---|---|---|---|
| Budget line items (category, requested, awarded, spent), narrative, period, modification history | Budget-vs-actual questions; capacity signals | budget→grant | P |

### 1.7 Communication / Note / Interaction (in-platform)

| Fields | Why | Join | Tier |
|---|---|---|---|
| Note ID, linked record (grant / org / contact), author, date, type (call / email log / meeting / internal note), body, attachments | Internal notes that live in GivingData rather than Drive | note→grant/org | P |

### 1.8 Document (files attached anywhere in GivingData)

| Fields | Why | Join | Tier |
|---|---|---|---|
| Document ID, file name, MIME type, size, linked record, uploaded-by, upload date, portal-visible flag, version | Retrieval content; **cross-system dedupe vs. Drive copies** | doc→grant | inherits |

### 1.9 Reference / configuration data

| Object | Why we pull it |
|---|---|
| Funds / portfolios / initiatives list | Resolve fund names to canonical entities; filter vocabulary |
| Custom-field definitions + picklist values | Map every custom field; build the controlled vocabulary |
| Users / staff list + roles | Map internal people; **mirror role-based visibility into the permission model** |
| Workflow / pipeline stage definitions | Interpret status history correctly across template changes |
| Tags / categories taxonomy | Normalize against Airtable's tags |

---

## 2. Google Drive

**Access:** Drive API v3 with a scoped service account (domain-wide delegation) restricted
to an allowlist of Shared Drives, or per-user OAuth *(confirm with Workspace admin)*.
Incremental via the `changes` feed. Also relevant: Google Docs API (structure, comments),
Sheets API (cell data), Drive Activity API, Drive Labels API, Admin SDK (for group→member
resolution).

### 2.1 File (every item)

| Field group | Fields (Drive API) | Why we pull it | Join | Tier |
|---|---|---|---|---|
| Identity | `id`, `name`, `mimeType`, `fileExtension`, `md5Checksum`, `size`, `headRevisionId` | Citation target; **exact-dedupe key (checksum)** | — | inherits |
| Location | `parents`, full folder path (resolved), `driveId` (Shared Drive), `spaces` | Often the only metadata a doc has — fund / year / org from the path | doc→grant/org/fund | inherits |
| Dates | `createdTime`, `modifiedTime`, `viewedByMeTime`, `modifiedByMe` | Recency ranking, "as of" dating, incremental sync | — | T |
| People | `owners`, `lastModifyingUser`, `sharingUser` | Provenance; "who wrote this" → follow-up routing | doc→person | T / ! |
| **Permissions** | `permissions[]` (type: user/group/domain/anyone; role: owner/writer/commenter/reader; `emailAddress`; inherited vs direct), `hasAugmentedPermissions` | **Feeds the permission map — the security boundary.** Folder + file level. | — | — |
| Classification | `labelInfo` (Drive Labels: e.g. Sensitivity = Confidential), `contentRestrictions` | Maps directly to our tier scheme | — | — |
| Content | Exported text (Docs → text/plain or DOCX; Sheets → CSV per tab; Slides → text); PDF / Office parsed; **OCR for image-only PDFs** | The retrievable content | — | inherits |
| Content meta | Detected language, page/word count, `exportLinks`, `thumbnailLink` | Multilingual routing; display | — | T |
| Extraction QA | OCR confidence score, parse-success flag, truncation flag | **Quarantine low-confidence rather than trust it** | — | — |
| Flags | `trashed`, `explicitlyTrashed`, `shortcutDetails`, `shared`, `starred` | Skip trashed; resolve shortcuts to targets | — | — |
| App properties | `appProperties`, `properties`, `folderColorRgb` | Occasionally hold team conventions | — | T |

### 2.2 Google Docs — document structure & revisions

| Fields | Why | Tier |
|---|---|---|
| Heading hierarchy, named styles, tables, lists | Structured extraction — "Projected lifetime earnings" is always under a known heading | inherits |
| **Comments & replies** (author, date, quoted text, resolved status, `@`-mentions) | Where "we pushed back on their target" lives — decision context | P |
| Suggestions / tracked changes | Draft-vs-final signal | P |
| Revision history (who, when, size deltas) | Detect the "FINAL" that isn't; authorship | T |

### 2.3 Google Sheets — impact models & trackers

| Fields | Why | Tier |
|---|---|---|
| Per-tab cell values + formulas, named ranges, headers | The impact math; portfolio trackers used as databases | T / P |
| Cell notes / comments | Assumptions and caveats | P |
| Data-validation lists | Reveal the team's controlled vocabularies | T |

### 2.4 Folder / Shared Drive

| Fields | Why | Tier |
|---|---|---|
| Shared Drive: `name`, `id`, `restrictions`, `orgUnit`, capabilities | Scope allowlist; drive-level ACL | — |
| Folder tree: names, nesting, item counts, per-folder permission overrides | Path-derived metadata; restricted subfolders | — |

### 2.5 Drive Activity (optional, later)

| Fields | Why | Tier |
|---|---|---|
| Action type (create / edit / move / rename / permission-change / comment), actor, timestamp, target | "When did this get decided / shared" context; freshness | P |

### 2.6 Directory (Admin SDK) — for permission resolution

| Fields | Why | Tier |
|---|---|---|
| Groups + memberships, org units, user → group mapping, suspended-user flag | **Resolve group ACLs to people** so retrieval can filter correctly; offboarding | — / ! |

---

## 3. Airtable

**Access:** Airtable Web API with a read-only personal access token or OAuth, scoped to
named bases *(confirm which bases)*. Rate limit ~5 req/sec/base. Metadata API for schema.
**Attachment URLs expire** — download and cache on ingest, never store the URL.

### 3.1 Base & schema (Metadata API)

| Fields | Why | Tier |
|---|---|---|
| Base ID, name, permission level | Scope; is this team-of-record or a personal experiment | — |
| Tables: id, name, primary field | Map the model | — |
| Fields: id, name, **type**, options (picklist choices, linked-table id, formula/rollup definition, currency/date format) | Know which fields are entered fact vs. derived; build vocabulary | — |
| Views: name, type, **filters, sorts, hidden fields**, sharing | Views encode "who should see what" — mirror into tiers | — |
| Collaborators + permission level per base | Feeds the permission map | — / ! |

### 3.2 Records — by table (typical "Relationships" base)

| Table | Key fields | Why | Join | Tier |
|---|---|---|---|---|
| **Organizations** | Name, **GivingData ID / cross-ref** *(confirm exists)*, type, thesis tags, geography, stage, priority, source/referral, linked grants, linked contacts, relationship owner, last-touchpoint, status | Entity resolution to the spine; sourcing context | **organization** | T |
| **Contacts / People** | Name, title, org link, work email, work phone, role type, LinkedIn, our-relationship-owner, notes | "Who do we know"; follow-up routing | **person** | T / ! |
| Contacts — sensitive fields | Personal phone / email, personal notes, demographic fields | Redact unless needed | person | R / ! |
| **Pipeline / Opportunities** | Prospect name, stage, potential amount, thesis fit, next step, owner, probability, expected date | In-flight sourcing not yet in GivingData | pipeline→org | P |
| **Interactions / Touchpoints** | Date, type (call / email / meeting / site visit / event), summary, attendees (internal + external), linked org, linked grant, follow-up actions | **Dossier relationship timeline; follow-up "who to ask"** | interaction→org/person | P |
| **Funders / Co-funders** | Name, type, focus, our-contact, co-funded grants, confidential flag | Co-funder context | org | P / R |
| **Events / Convenings** | Name, date, attendees, notes, linked orgs | Context; who met whom | — | P |
| **Experts / Advisors** | Name, expertise, engagements, contact | Diligence routing | person | T / ! |

### 3.3 Per-record extras

| Fields | Why | Tier |
|---|---|---|
| Record ID, created time, last-modified time, created-by | Incremental sync; provenance | T |
| **Cell comments** (author, text, timestamp) | Discussion that never left Airtable | P |
| Record revision history *(Enterprise API)* | Change context | P |
| **Attachments** (filename, type, size — file downloaded & cached) | Retrieval content; dedupe vs. Drive / GivingData | inherits |
| Button / automation-result fields | Usually derived — mark as derived, don't treat as evidence | T |

---

## 4. Zoom Chat  — *deferred past v1; mapped so the decision is informed*

**Access:** Zoom Server-to-Server OAuth app with `chat_message:read:admin`,
`chat_channel:read:admin` *(requires account-owner approval)*. Subject to the account
**message-retention setting** — may be far less than five years. If a compliance-archiving
integration exists (Global Relay / Smarsh), ingest from that governed copy instead.

### 4.1 Channel

| Fields | Why | Tier |
|---|---|---|
| Channel ID, name, type (**public / private / 1:1 / group DM**), member count, created date, settings | Scope: **public channels only**; DMs and private permanently excluded | — |
| Members (user IDs) | Permission mapping; but also a privacy signal | R / ! |

### 4.2 Message

| Fields | Why | Tier |
|---|---|---|
| Message ID, channel ID, sender, timestamp, edited flag, **thread / reply-parent ID** | Thread-aware chunking so a decision keeps its context | message→(entity via text) | P |
| Message text, `@`-mentions, rich-text elements | The retrievable content (public channels only) | P |
| Reactions / emoji | Weak signal of agreement / decision | P |
| Files & shared links (name, type, url, downloaded) | Occasionally the only pointer to an artifact | inherits |
| Reply count, last-reply time | Thread reconstruction | P |

### 4.3 What we would NOT pull

DMs, private-channel content, presence, call/meeting records, message drafts, anything
where staff had a reasonable expectation of privacy. See discovery guide Round 3 for the
questions that decide whether even public channels come in.

---

## 5. Cross-system: the join keys and the source-of-truth map

### Join keys (how the four systems connect)

| Key | Present in | Reliability |
|---|---|---|
| **Grant ID** (GivingData) | GivingData (native); Drive (in filenames / doc bodies — *(confirm consistency)*); Airtable (cross-ref field — *(confirm exists)*); Zoom (never) | High where present |
| **Normalized organization name** | All four | Medium — needs fuzzy matching + review queue |
| **Person name + email** | GivingData contacts, Airtable contacts, Drive owners/commenters, Zoom senders | Medium |
| **Fund / cohort name** | GivingData (native), Drive (folder path), Airtable (tag) | Medium |
| **Document checksum** | Drive (`md5Checksum`), GivingData docs, Airtable attachments | High — exact-dedupe |
| **Explicit "duplicate of" pointer** | Set by the pipeline when a Drive doc names a portal upload | High |

### Source-of-truth map (which system wins per fact)

| Fact | Authoritative | Fallback | Reason |
|---|---|---|---|
| Grant amount, dates, status | GivingData grant record | executed agreement (DocuSign) | System of record |
| Projected impact | GivingData custom fields | the impact model sheet | Entered at approval |
| Reported / actual impact | GivingData requirement fields if structured | the final report in Drive | Reviewed number |
| Decision rationale | Drive diligence memo | GivingData review notes | Where reasoning is written |
| Organization profile | Airtable (if more current) | GivingData organization | CRM is maintained for this |
| Relationship / contact | Airtable | GivingData contacts | CRM is maintained for this |
| "Why we made this call" nuance | Drive memo → GivingData notes → (later) Zoom thread | — | Narrative lives in prose |

*Every row is confirmed with the team in the discovery synthesis session, not assumed.*

---

## 6. What we pull vs. what we index

Not everything pulled goes into the retrievable index:

- **Pulled and indexed:** narrative content, grant fact sheets, reports, notes (team / programs-only tiers).
- **Pulled, used as metadata, not indexed as content:** permissions, group memberships, checksums, custom-field definitions, workflow config, payment schedules (structured signals feed filters and the entity graph).
- **Pulled, then redacted or tier-raised:** participant PII, personal contact details, demographic fields.
- **Detected and excluded (metadata-only stub):** restricted-tier documents — the index knows the doc exists on a topic but holds none of its content.
- **Not pulled:** trashed files, DMs, private channels, personal My Drive, anything on the `Never-ingest` list.
