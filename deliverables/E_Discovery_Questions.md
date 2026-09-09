# Discovery & data-requirements guide — the four systems + the impact model

**Compass · GitLab Foundation · companion to the strategy doc**
**Jessenia Cintron**

> This is the document I would work through with the Programs, Impact, and Operations teams before writing production code — the same way I worked through data scope with the Hope Program and Idlewild before building for them. Each source gets **rounds of questions**, because the answers to Round 1 change which Round 2 questions matter. For every question I've noted **why I'm asking** — a question without a decision attached to it is just a survey.
>
> The goal is not to collect trivia. It is to know, before I build, exactly which fields carry meaning, which are abandoned, where the same fact lives in three places with three values, and what must never leave its tier. That is the difference between a tool the team trusts and a tool that quietly misleads them.

---

## How I run discovery

**Five rounds, per source, then a synthesis round across all four.**

| Round | Purpose | Who I need in the room |
|---|---|---|
| 1 — Orientation & access | Can we get in, at what scope, who owns it | System owner, IT/Workspace admin |
| 2 — Structure & fields | The real schema — every field, what it means, how full it is | Power user + admin |
| 3 — Quality, history & edge cases | Template drift, migrations, duplicates, gaps, language | Longest-tenured user |
| 4 — Sensitivity, permissions & compliance | Tiers, PII, restricted content, contractual limits | Data owner (COO office), counsel |
| 5 — Workflow & meaning | How the team actually uses it; what "authoritative" means here | 2–3 day-to-day users |
| Synthesis | Reconcile the four; decide the source of truth per fact | Programs + Impact leads + me |

**Two artifacts come out of it:** a **field register** (every field we ingest → why → its join role → its sensitivity tier) and a **source-of-truth map** (for each fact type — grant amount, projected earnings, reported outcome, decision rationale — which system wins and why).

---

## Round 0 — Map every place grant knowledge actually lives

The brief names four systems: Google Drive, GivingData, Airtable, Zoom Chat. **In a real engagement that is the starting point, not the boundary.** Every organization I've built for has had grant knowledge sitting in places nobody listed in the first meeting — because it felt too obvious to mention, or because one person keeps it and everyone else forgets it exists. If Compass indexes four systems and the team knows the answer is really in a fifth, they stop trusting it.

So before scoping anything, I run a **"follow the knowledge" exercise**: take three real past decisions and trace every place information about them was written down.

### The question
> "When you worked on the [X] grant — from first contact to the renewal call — every place a note, a number, a document, or a message about it was created or stored. Walk me through all of them."

### Sources a foundation this size almost always also has

| Likely source | What grant knowledge is in it | Why it matters for Compass |
|---|---|---|
| **Gmail / Google Groups** (shared inboxes: grants@, info@, program-specific) | Grantee correspondence, decisions made in email threads, attachments never saved to Drive, scheduling and context | Email is often where the *reasoning* and the *back-and-forth* live. Decisions get made in a reply and never written up anywhere else. High value, high sensitivity, hard permissions. |
| **Zoom Cloud Recordings + transcripts / AI Companion summaries** | Recorded grantee calls, board meetings, internal program discussions, auto-generated summaries and action items | This is *distinct from Zoom Chat* and often much richer. Same privacy and retention questions, plus consent-to-record issues. |
| **Meeting-notes / transcription tools** (Otter, Fireflies, Grain, Fathom) | Call notes and transcripts if the team uses one of these outside Zoom | Another transcript store with its own retention and sharing model. |
| **Notion** (internal workspace — their public Handbook is already Notion) | Strategy, thesis development, meeting notes, OKRs, process docs, project trackers | Very likely holds "how we think" content that Drive doesn't. Has a clean API. Should probably be an early add. |
| **Tableau + the impact model itself** | The public Impact Dashboard's underlying data model, extracts, and the cost-benefit / North Star spreadsheets behind it | The Foundation's headline numbers come from here. Compass needs to cite *this* for impact figures, not a stale copy in a memo. Coordinate with the Impact team. |
| **Portfolio / pipeline spreadsheets** (Google Sheets or Excel) used as informal databases | Cross-portfolio trackers, cohort rollups, "master lists" a program officer maintains by hand | These are shadow systems of record. Often more current than GivingData for in-flight work, and fragile. |
| **Application / survey intake** (Airtable forms, Google Forms, SurveyMonkey, Submittable) | Open-RFP submissions, grantee feedback surveys, LOI intake | The Foundation runs topical open RFPs — that intake has to land somewhere, and declined applications carry learning. |
| **DocuSign / Adobe Sign / PandaDoc** | Executed grant agreements and their terms | The authoritative copy of what was actually agreed, including confidentiality clauses. |
| **A prior grants system** (Fluxx, Foundant, Submittable) if they migrated to GivingData | Historical grants, older reports, data that didn't migrate cleanly | If "five years" predates the GivingData migration, part of the corpus is in the old system or in export files. |
| **Co-funder shared spaces** (Ballmer Group / Annie E. Casey shared drives or portals) | Shared-cohort data, joint diligence, co-funder reporting | Contractually governed. Usually *out* of scope, but the team needs to know Compass won't reach it. |
| **Individual staff notes** (Apple Notes, Google Docs in My Drive, physical notebooks) | Site-visit impressions, call notes, "things I know about this grantee" | Can't and shouldn't index these directly — but discovery should surface how much lives here so we can encourage moving it into a shared system. |
| **The public website / news posts** | Grantee announcements, cohort descriptions, published impact claims | Public and authoritative for "what have we said externally" — cheap to include, useful for consistency checks. |
| **Slack** (if used alongside Zoom Chat) | Same role as Zoom Chat | Confirm whether it exists — teams often run both during a transition. |

### Round 0 questions
| # | Question | Why I'm asking |
|---|---|---|
| M1 | Besides Drive, GivingData, Airtable, and Zoom Chat — where else does grant information get written down? Email? Notion? Recorded calls? A spreadsheet someone maintains? | Flushes out the shadow sources before they become a credibility gap. |
| M2 | Is there a **portfolio tracker or master spreadsheet** any of you keep by hand? What's in it that isn't in GivingData? | These are usually the most current view of in-flight work and the most fragile. |
| M3 | Do you **record grantee calls or internal meetings**? Where do the recordings, transcripts, and summaries go, and for how long? | Zoom Cloud Recordings / transcription tools are a distinct, rich, sensitive source the brief doesn't name. |
| M4 | Where does the **impact model** actually live, and who owns the numbers behind the public dashboard? | Compass must cite the authoritative impact source, and the Impact team has to be a partner, not just a stakeholder. |
| M5 | Did the Foundation use a **different grants system before GivingData**? Is that data still accessible? | Determines whether "five years" is fully in GivingData or split across a migration boundary. |
| M6 | Do you use **Notion internally** beyond the public Handbook? What's in it? | Likely holds strategy and meeting-notes content with a clean API — a strong early candidate to add. |
| M7 | Are there **email threads** you'd expect Compass to know about — grantee decisions that only happened over email? | Sets up the (hard) question of whether and how to bring email in later. |

### How Round 0 changes the plan
The output is a **complete source inventory** ranked by *value × feasibility × sensitivity*. The four named systems are still almost certainly the v1 scope — but now that's a **decision the team made with the full map in front of them**, not a default. Notion, the impact model, and a portfolio tracker are the most likely early additions; email and recordings are later, hard, and need their own governance review. Everything not in v1 goes on the coverage disclosure so the tool always tells users what it can't see.

---

## Cross-cutting questions (ask once, up front)

These shape all four connectors.

| # | Question | Why I'm asking |
|---|---|---|
| X1 | Who is the single **data owner** who can approve the access model and any sensitivity-tier decision? | Every downstream "can we ingest this?" needs one accountable yes/no. Without it, discovery stalls. |
| X2 | Is **Google Workspace the identity provider** for everything, or do some systems have separate logins? | Determines whether one SSO gates Compass and whether I can map permissions from one directory. |
| X3 | What is the Foundation's written position on sending **grantee and co-funder data to an AI vendor**? Is there an existing agreement? | Gates the entire generation layer. If the answer is "no third parties," the model has to run in-VPC and the timeline and cost change. |
| X4 | Which grants carry **confidentiality or data-use clauses** (co-funder MOUs with Ballmer Group / Annie E. Casey, individual grant agreements)? | Some grantee material may be contractually barred from secondary use. I need the list before ingestion, not after. |
| X5 | For grantees in **Colombia and Kenya**, is there personal data in the reports, and has cross-border transfer ever been assessed? | Ley 1581 (Colombia) and the DPA 2019 (Kenya) have transfer conditions. Cheapest answer is usually "exclude participant PII," but I need to confirm what's in there. |
| X6 | What does the team do **today** when they need an answer from grant history — walk me through the last three real instances. | The current workaround is the adoption baseline and tells me where the "obviously better" moment is. |
| X7 | What decision, six months from now, do you want Compass to have made easier? | Anchors scope. If the answer is "renewal decisions," the corpus and the dossier view are built around that. |
| X8 | When staff sign in to Google, does the Foundation **require a second step** — a code from the phone, a tap on a prompt, a physical security key? Is it required for everyone, or optional? Does a Google session stay signed in for days, or expire? | Compass signs people in with their Google account, so it gets whatever second step Google already asks for. If everyone already does a second step at Google login, Compass does **not** need its own separate code or authenticator app — adding one would just be an extra annoyance for no real security gain. If the second step is *optional* today, that's worth turning on for everyone at the Google level (one setting) rather than building it into one app. This one answer decides whether we build a second login step into Compass at all. |
| X9 | Does the Foundation **manage staff laptops and phones centrally** — can IT require a screen lock, push settings, or wipe a lost device? | If yes, Compass can be set to only work on a managed device with a screen lock — a strong extra layer for a tool holding five years of sensitive grant knowledge, and it's an IT setting, not something we build. If there's no central device management, we lean on short sessions, a fingerprint/Face-ID lock on the app, and the ability to cut someone's access instantly from the server. |
| X10 | When someone leaves the Foundation, **who turns off their account, how quickly, and does that automatically cut off the connected tools too**? | Compass can cut a specific person's access instantly (an admin button, plus an automatic nightly check) — but it needs to fire off the same event that disables their Google account, or a departed employee could keep a working session for a few hours. This was a real gap on the HOPE dashboard. |
| X11 | Should Compass keep people **signed in for a long time**, or always sign them out after a set number of hours? Any objection to a **fingerprint / Face-ID lock** on the phone/installed version? | A convenience-vs-safety call for the data owner. Recommendation: sign out after ~8 hours, offer an optional fingerprint/Face-ID lock on the installed app (it's a local unlock, not a second login step), and no permanent "stay signed in". The fingerprint lock is opt-in so it doesn't get in the way of people who don't want it. |

---

## 1. Google Drive — narrative, analysis, and internal notes

**What we think is in here:** grant proposals and LOIs, grantee progress and final reports, internal diligence memos, site-visit and reference-call notes, program strategy and thesis documents, board decks, impact-model spreadsheets, budgets, and meeting notes. This is where the *reasoning* lives — GivingData tells you what was decided, Drive tells you why.

### Round 1 — Orientation & access
| # | Question | Why I'm asking |
|---|---|---|
| D1 | Is the grant-relevant content in **Shared Drives** or scattered across individuals' **My Drive**? Roughly what split? | Shared Drives have clean, inheritable permissions and survive staff departures. My Drive content is a permissions and continuity mess — if the important memos live there, the v1 corpus shrinks and I need a plan to migrate them. |
| D2 | Which **Workspace edition** (Business Standard / Plus / Enterprise)? Is **Google Vault** in use? Are **Drive Labels** or DLP rules configured? | Edition determines whether I can use Labels for classification and whether admin can scope a service account. Vault means there's already a retention/e-discovery posture to align with. |
| D3 | Will the Workspace admin provision a **service account with domain-wide delegation** scoped to specific Shared Drives, or do we use **per-user OAuth**? | Service account = clean, centrally controlled, survives staff changes. Per-user OAuth = the tool inherits each user's messy Drive and breaks when they leave. I strongly prefer the former, scoped narrowly. |
| D4 | Can I get a **folder-tree export** (names, owners, item counts, last-modified) for the candidate Shared Drives before we decide scope? | I want to pick the v1 corpus from evidence, not a guess. Item counts tell me if it's 5,000 files or 500,000. |
| D5 | Are there Shared Drives or folders that are **explicitly off-limits** — board, HR, legal, compensation, personnel? | These become `Never-ingest` or `Restricted`. I want them named and walled off before the first sync, not discovered later. |

### Round 2 — Structure & fields
| # | Question | Why I'm asking |
|---|---|---|
| D6 | Is there a **naming convention** or folder structure for grants (by org? by fund? by year? by grant ID)? How consistently is it followed? | The folder path is often the only metadata a Drive doc has. If "Care Economy/2025/Carina/…" is reliable, I get fund, year, and org for free. If it's chaos, I lean harder on entity resolution from content. |
| D7 | Do documents follow **templates** (a standard proposal template, a standard report template)? Where are the master templates? | Templates give me predictable structure to extract from — "Projected lifetime earnings" is always in section 3. Free-form docs need more work and are less reliable. |
| D8 | For Google **Sheets** used as impact models — is there a standard layout, and which cells hold the North Star ratio, projected earnings delta, and participant count? | Spreadsheets are the hardest to ingest well. I need to know if there's a consistent structure I can target or if every model is bespoke. |
| D9 | Are grant reports mostly **native Google Docs**, **uploaded PDFs/Word**, or **scanned PDFs**? Roughly what mix, and does it change for older grants? | Native Docs extract cleanly. Scanned PDFs need OCR and a confidence check. If five-year-old reports are all scans, backfill quality drops and I budget for it. |
| D10 | Do you rely on **Google Docs revision history / comments** as a record of decisions or feedback? | If yes, I may need to capture comment threads, not just final text — that's where "we pushed back on their target" often lives. |

### Round 3 — Quality, history & edge cases
| # | Question | Why I'm asking |
|---|---|---|
| D11 | Has the **proposal or report template changed** over the last five years? When, and how different is old vs. new? | A field that moved or got renamed breaks naive extraction. I need to map old→new so a 2021 report and a 2026 report answer the same question. |
| D12 | Was there ever a **migration** into Drive (from Box, Dropbox, a previous shared drive, a departed employee's account)? Any known gaps or duplication from it? | Migrations leave duplicates, broken links, and missing metadata. If one happened, I plan dedupe and reconciliation around it. |
| D13 | Is it common to have **multiple versions** of the same report in the same folder ("v2", "FINAL", "FINAL_clean")? Which one is real? | This is the "no single source of truth" problem in miniature. I need the team's rule for which copy counts so the dedupe layer picks the authoritative one. |
| D14 | Are there **grantee reports in Spanish** (Colombia) or other languages? Are they translated, and if so is the translation in the same folder? | Determines multilingual retrieval scope and whether I index the original, the translation, or both (linked). |
| D14a | Separate from the documents: does any **staff member work primarily in a non-English language** and expect to *ask questions and read answers* in that language (not just have non-English documents rendered into English for them)? | Decides whether Compass needs a per-user language preference and answer-in-the-reader's-language rendering. Today translation is one-directional (any language → English at intake). If no staff gap, the current design is correct; if yes, it's a scoped addition, not a redesign. |
| D15 | Roughly what fraction of grants have a **complete document set** in Drive (proposal + each required report)? Where are the known holes? | Sets expectations for the gap report and tells the team where Compass will honestly say "we don't have that." |

### Round 4 — Sensitivity, permissions & compliance
| # | Question | Why I'm asking |
|---|---|---|
| D16 | Do grant reports contain **named information about program participants** (people served by grantees — names, stories, contact info, immigration or justice-system status)? | This is the highest-sensitivity content in the whole system. Default plan: detect and redact at intake, never index participant identifiers in v1. I need to confirm how prevalent it is. |
| D17 | Are there documents with **candid internal assessments** of a grantee's leadership or viability that would damage the relationship if surfaced casually? | These are `Restricted` or `Programs-only`. A synthesis answer must never quote "the ED is difficult to work with" back to a wider audience. |
| D18 | Do any documents contain **grantee financials, audits, or bank details** provided in confidence? | `Restricted`. Financial-account data gets the same treatment as PII. |
| D19 | Within a Shared Drive, is permission uniform, or are there **restricted subfolders** with tighter sharing? | The connector must respect folder-level ACLs, not just drive-level. If the model is "drive = team, but /board is locked," the permission map has to capture that. |
| D20 | Does the Foundation have **retention rules** for grant documents (keep X years after close)? Any active **legal holds**? | Compass references records; it must not become a way to resurrect something that was properly deleted, or to circumvent a hold. |

### Fields I need from Drive
| Field | Where it comes from | Why / join role | Tier |
|---|---|---|---|
| File ID, deep link, MIME type | Drive API | Citation target — the "open source" link | — |
| Owner, Shared Drive, folder path | Drive API | Metadata + often the only source of fund/year/org | Team |
| Last-modified, created | Drive API | Recency ranking, "as of" dating | Team |
| Explicit ACL (drive + folder) | Drive API | Feeds the permission map — the security boundary | — |
| Extracted full text + section structure | Export / parse / OCR | The retrievable content | inherits |
| Detected language | Pipeline | Multilingual retrieval routing | Team |
| Extraction-confidence score | Pipeline | Quarantine low-confidence OCR instead of trusting it | — |
| Organization / grant referenced | Entity resolution | Links the doc to the Grant and Organization | inherits |
| Sensitivity tier | Labels + folder rules + PII scan | Controls who can retrieve it | — |

---

## 2. GivingData — the grants system of record

**What we think is in here:** the structured spine of the whole portfolio — grant records, organizations, contacts, payment schedules, requirement/report schedules, review and scorecard data, and grantee-portal submissions. **GivingData's grant list is the spine the other three systems reconcile against.**

### Round 1 — Orientation & access
| # | Question | Why I'm asking |
|---|---|---|
| G1 | Does the Foundation's GivingData plan include **API access**? What endpoints, what auth (API key / OAuth), what **rate limits**? | Determines whether I build a real incremental connector or fall back to scheduled report + document exports. Changes freshness and effort materially. |
| G2 | If no API: what **scheduled exports** are possible — full CSV of grants/orgs/payments/requirements, plus a **bulk document export** from the grantee portal? | The fallback has to be complete and re-runnable. A partial export creates silent gaps. |
| G3 | Who is the **internal owner** (likely the Grants Manager)? Who administers custom fields and workflow? | I need one person who knows why every custom field exists and which ones are abandoned. |
| G4 | How many **grants / requests** are in the system total, and from what date? Is pre-Foundation-era or pre-migration data in there? | Confirms corpus size and where "five years" actually starts. |
| G5 | Do all Programs staff currently see **all grant records**, or is visibility **restricted by role / portfolio / fund**? | Compass must mirror this. If a program officer can't see another portfolio's grants in GivingData, they can't see them through Compass either. |

### Round 2 — Structure & fields
| # | Question | Why I'm asking |
|---|---|---|
| G6 | Walk me through the **grant record**: standard fields (amount, dates, status, type) plus every **custom field**. Which are required, which are optional, which are effectively dead? | The custom fields are where the Foundation-specific meaning lives — thesis area, North Star projection, cohort. I need to know which are trustworthy and which are 40% filled. |
| G7 | How is **projected impact** captured — a North Star ratio field? projected annual/lifetime earnings delta? projected participants reached? Are these entered at approval and never revisited, or updated? | This is half of every "how did they do vs. plan" answer. I need to know it's a real field and understand its vintage. |
| G8 | How is **reported / actual impact** captured — structured fields on the requirement record, or only inside an uploaded report document? | If actuals are structured, cross-system answers are clean joins. If they're buried in PDFs, the pipeline has to extract them and the entity graph does more work. |
| G9 | How do **Requirements** (reports, check-ins) work — schedule, due dates, status, submitted documents, internal review notes? Is there a "report received / reviewed / approved" state? | Requirements drive the completeness reconciliation: "the schedule says a Q3 report was due; is it here?" |
| G10 | What's in the **review / scorecard** data — the impact-scorecard rubric dimensions, scores, reviewer notes? Is it in structured fields or attached memos? | The Foundation's diligence rationale. Valuable for "why did we fund / decline this" — but often sensitive (`Programs-only`). |
| G11 | **Organizations** and **Contacts**: what's the schema, and how does it overlap with what's in Airtable? Which system is authoritative for org profile and relationship data? | Directly informs the source-of-truth map. If both hold org data, I need the rule for which wins. |
| G12 | **Payments / financials**: payment schedule, amounts, dates, GL/budget codes, fund allocation. How much financial detail should Compass index vs. leave to Finance's systems? | Grant-dollar data is in scope, but I don't want Compass reproducing the general ledger. CFO/Controller should set the line. |
| G13 | How are **Funds / Portfolios / Cohorts** modeled (AI for Economic Opportunity, Powering Economic Opportunity, Learning for Action)? Can every grant be tied to one? | The cohort is a primary filter and a common query axis ("pull every outcome for the AI Fund cohort"). |

### Round 3 — Quality, history & edge cases
| # | Question | Why I'm asking |
|---|---|---|
| G14 | Was there a **migration into GivingData** (from Fluxx, Foundant, spreadsheets, a prior system)? What came over clean and what didn't? | Migrated grants often have blank custom fields, lost attachments, or mangled dates. The reconciliation layer needs to know. |
| G15 | Have **field definitions or the workflow changed** over five years — a renamed status, a retired custom field, a changed rubric? | Same issue as Drive template drift. A status that meant one thing in 2022 and another in 2026 corrupts filtering unless mapped. |
| G16 | Are there **duplicate organization records** (same grantee entered twice, or as "Org" and "Org, Inc.")? Duplicate grants? | Duplicates in the spine are the worst case — they double-count in portfolio answers. Dedupe rules start here. |
| G17 | How complete is **thesis-area / geography tagging** across the full grant history? | If 30% of grants are untagged, "what have we funded in credential completion" quietly under-reports. The gap report must surface this. |
| G18 | For grantee-portal uploads — do grantees sometimes upload the **wrong file, a draft, or a duplicate** of something also in Drive? | Cross-system dedupe: the portal PDF and the Drive Doc are often the same report. One is authoritative. |

### Round 4 — Sensitivity, permissions & compliance
| # | Question | Why I'm asking |
|---|---|---|
| G19 | Do grantee-portal submissions come with **confidentiality terms**? Is there language in the portal or grant agreement about how the Foundation uses submitted materials? | If the terms don't cover internal AI-assisted analysis, the privacy notice / agreement needs updating before ingestion (§6.8). |
| G20 | Which fields or record types are **sensitive** — reviewer scorecards, internal notes, declined-applicant records, anything about organizational instability? | Sets tiers. Declined-applicant diligence is usually `Programs-only` and the applicant name may need redaction in a general view. |
| G21 | Are there **co-funded grants** where another funder's data or terms are embedded in the record? | Ties to X4 — co-funder confidentiality. Flag these records. |
| G22 | Does GivingData hold **participant-level data** anywhere (some grantees report line-level outcomes)? | Same as D16 — highest sensitivity. Confirm and plan redaction. |

### Fields I need from GivingData
| Field | Why / join role | Tier |
|---|---|---|
| Grant ID | **Primary join key** across all four systems | Team |
| Organization ID + name | Join key; entity resolution anchor | Team |
| Amount, start/end dates, status, type | Core grant facts; filtering | Team |
| Fund / portfolio / cohort | Primary query + filter axis | Team |
| Program officer / owner | "Who ran this grant"; filtering | Team |
| Projected North Star ratio, projected earnings delta, projected participants | Half of every performance-vs-plan answer; vintage-stamped | Team |
| Reported / actual outcomes (structured) | The other half; vintage-stamped | Team |
| Requirement schedule + status + submitted docs | Completeness reconciliation | Team |
| Review / scorecard dimensions + reviewer notes | Decision rationale | Programs-only |
| Payment schedule / amounts | Financial context (scope TBD with CFO) | Programs-only |
| Internal notes fields | "Why" context | Programs-only |
| Declined-applicant records + reasons | "Did we pass on this, why" | Programs-only |

---

## 3. Airtable — the relationship CRM

**What we think is in here:** the team's relationship map — organization profiles, contacts across grantees / funders / co-funders / experts / advisors, pipeline and stage, an interaction log, and thesis/geography tags. Airtable is where relationships and sourcing context live that GivingData doesn't model well.

### Round 1 — Orientation & access
| # | Question | Why I'm asking |
|---|---|---|
| A1 | How many **bases** are relevant, and who owns each? Is there one "Relationships" base or several overlapping ones? | Airtable sprawl is common. I need the canonical base(s) and to know which are personal experiments vs. team-of-record. |
| A2 | Can I get a **read-only API token** (or OAuth) scoped to those bases? Note Airtable's **~5 requests/sec** limit and that attachment URLs **expire**. | Determines connector design — I have to pull attachments promptly and cache them, not store expiring links. |
| A3 | Who are the **collaborators** on each base, and at what permission level (owner / editor / commenter / read)? | Feeds the permission map. If a base is shared org-wide as read-only, its content is `Team`; if it's shared with three people, it's tighter. |
| A4 | Are there **automations, sync-ins, or integrations** on these bases (Airtable syncing from GivingData, forms feeding records, Zapier)? | Tells me if Airtable is a source or a mirror. A field synced from GivingData shouldn't be treated as independent data. |

### Round 2 — Structure & fields
| # | Question | Why I'm asking |
|---|---|---|
| A5 | Walk me through each **table**: Organizations, Contacts, Pipeline/Deals, Interactions, plus any others. What are the fields and the **linked-record relationships** between tables? | Linked records are how Airtable models the graph. I want to reuse that structure in entity resolution rather than rebuild it. |
| A6 | Is there a field that holds the **GivingData grant ID or org ID**? Any reliable cross-reference? | If yes, entity resolution between Airtable and the spine is trivial. If no, I'm fuzzy-matching on org name and it's error-prone. |
| A7 | How is the **interaction / touchpoint log** structured — date, type, attendees, notes, linked org? Is it kept up reliably or sporadically? | Interaction history powers the dossier's "last contact / relationship state." If it's sporadic, I present it as partial, not authoritative. |
| A8 | What **tags / single-selects / multi-selects** exist for thesis area, geography, stage, source, priority? Do they match GivingData's vocabulary? | Controlled-vocabulary mapping. If Airtable says "workforce" and GivingData says "Future of Work," the normalization layer reconciles them. |
| A9 | Which fields are **formulas, rollups, or lookups** (derived) vs. **directly entered**? | I ingest entered data as fact; derived fields I either recompute or mark as derived so they're not treated as independent evidence. |

### Round 3 — Quality, history & edge cases
| # | Question | Why I'm asking |
|---|---|---|
| A10 | Are there **duplicate org or contact records**? How does the team currently handle merging? | Airtable has no strong dedupe. Duplicates here create split relationship histories. |
| A11 | How **current** is the data — when was the pipeline / interaction log last meaningfully updated? Are there stale records for people who've left grantee orgs? | Stale CRM data surfaced confidently is worse than no data. The dossier should date every relationship fact. |
| A12 | Has the base **structure changed** — tables renamed, fields added/removed, a big restructure? Any prior base that was abandoned? | Abandoned bases sometimes hold history the current one lost. Worth checking before scoping. |
| A13 | Do people keep **private notes** in Airtable fields (personal impressions, "don't trust their numbers")? | Same as D17 — candid content that needs a tier and careful handling. |

### Round 4 — Sensitivity, permissions & compliance
| # | Question | Why I'm asking |
|---|---|---|
| A14 | Which fields hold **contact PII** — personal email, personal phone, home address, LinkedIn, personal notes? | Contact PII is redacted unless an answer genuinely needs it. A general "who's our contact at X" can return a role and work email, not a cell number. |
| A15 | Are there **funders / donors / prospects** in here whose information is confidential (a donor who wishes to stay anonymous)? | Donor confidentiality is serious for a foundation. Those records may be `Restricted` or `Never-ingest`. |
| A16 | Any **view-level or field-level restrictions** currently in place that express "only these people should see this"? | Mirror them. Airtable's own permission model is the team's stated intent. |

### Fields I need from Airtable
| Field | Why / join role | Tier |
|---|---|---|
| Org name + any GivingData ID cross-ref | Entity resolution to the spine | Team |
| Org profile: type, thesis tags, geography, stage, source/referral | Sourcing + portfolio context; query filters | Team |
| Linked grant records | Graph edges | Team |
| Contact: name, role/title, **work** email, org | "Who do we know here" | Team |
| Contact: personal phone / email / address / private notes | Only if an answer needs it | Restricted (redacted by default) |
| Interaction log: date, type, summary, linked org | Dossier relationship timeline (dated) | Programs-only |
| Relationship owner | "Who holds this relationship" | Team |
| Subjective/private assessment fields | Careful handling | Programs-only |
| Donor / anonymous-funder records | Likely excluded | Restricted / Never-ingest |

---

## 4. Zoom Chat — team conversation and decisions

**What we think is in here:** the informal layer — quick decisions made in a channel, the reasoning behind a call that never got written up, links shared, "did we ever hear back from X." **Also the messiest, most private, and most legally sensitive source — which is why the strategy doc defers it entirely past v1.** These questions are to decide *whether and how* it ever comes in.

### Round 1 — Orientation & access
| # | Question | Why I'm asking |
|---|---|---|
| Z1 | Is this **Zoom Team Chat** (persistent channels) or just in-meeting chat? What's the **message-retention setting** at the account level — 30 days, 1 year, indefinite? | This is the first gate. If retention is 1 year, "five years of team conversations" **does not exist** and the whole premise for this source is wrong. Likely outcome. |
| Z2 | Does the Foundation have **admin rights** to create a Zoom **Server-to-Server OAuth app** with `chat_message:read:admin` scope? Or is chat history only reachable per-user? | Admin scope is the only practical way to ingest at team scale. Without it, this source is effectively closed. |
| Z3 | Is there a **compliance/archiving integration** already (Global Relay, Smarsh, Zoom's own archiving)? | If archiving exists, there's already a governed copy of chat with a retention and e-discovery posture — ingest from *that*, not the live API, and inherit its governance. |
| Z4 | How many **channels**, and what's the split of **public vs. private vs. DMs**? Which channels are actually about grant decisions vs. social / logistics? | Scopes the useful surface. Probably a handful of program channels matter and everything else is noise or off-limits. |

### Round 2 — Structure & content
| # | Question | Why I'm asking |
|---|---|---|
| Z5 | In the grant-relevant **public channels**, how are decisions actually recorded — a clear "we've decided X" message, or a scattered thread you have to read in full? | Determines whether thread-level chunking can capture a decision with its context, or whether the signal is too diffuse to be useful. |
| Z6 | Do important decisions in chat **also get written up** somewhere in Drive or GivingData? | If yes (usually the answer), the marginal value of ingesting chat is low and the privacy cost isn't worth it — which supports the deferral. |
| Z7 | Are **files and links** shared in channels that aren't stored anywhere else? | Occasionally chat is the only home for a useful artifact. Worth knowing, but usually recoverable another way. |

### Round 3 — Sensitivity, privacy & compliance (the deciding round)
| # | Question | Why I'm asking |
|---|---|---|
| Z8 | What have staff been **told** about their Zoom Chat — is it understood to be searchable / archived, or do people treat it as ephemeral and private? | The single most important question. If people speak candidly believing it's ephemeral, ingesting it is a trust violation regardless of the legal position. |
| Z9 | Would ingesting **public-channel** history require notifying staff and offering an **opt-out**? Is there a works-council / employment-law consideration? | I would not ingest without explicit disclosure. This question sets the process. |
| Z10 | Are **DMs and private channels** ever on the table? | My answer is no — permanently. This question is to confirm leadership agrees and put it in writing. |
| Z11 | Does chat contain **personnel, compensation, or performance discussion**, or candid personal opinions about grantees and partners? | Almost certainly yes. This content is exactly what must never surface in a team synthesis tool. |
| Z12 | What are the **e-discovery / legal-hold** implications of creating a second indexed copy of chat? | A searchable index of chat is discoverable. Counsel has to weigh in before this source is touched. |

### Recommendation carried into the plan
Unless Z1 reveals multi-year retention **and** Z6 reveals decisions that genuinely live only in chat **and** Z8 reveals staff already treat it as archived — **Zoom Chat stays out**, not just of v1 but until a specific, owner-approved case is made. If it ever comes in: archiving-integration copy or public channels only, explicit staff disclosure and opt-out, DMs and private channels permanently excluded, thread-aware chunking, and its own sensitivity review.

### Fields I would need (only if it ever proceeds)
| Field | Why | Tier |
|---|---|---|
| Channel, thread ID, timestamp, author | Attribution + thread reconstruction | Programs-only |
| Message text (public channels only) | The retrievable content | Programs-only |
| Referenced org / grant | Entity resolution (low precision — needs the graph) | inherits |
| Shared file / link references | Occasionally the only pointer to an artifact | inherits |

---

## 5. The impact model — the Foundation's headline numbers

**Why this is its own section.** Every "how did they do vs. what we projected" answer, and
anything about the North Star (the benefit-to-cost ratio, projected lifetime earnings), traces
back to the Foundation's impact model. Today Compass reads the *outputs* of that model where
someone has written them into a grant record or a memo — which means it can cite a number
that's a stale copy. To cite the number from the system that actually computes it, four things
have to be known, and **each answer changes what gets built**. Coordinate with the Impact team —
they are a build partner here, not a stakeholder to inform.

| # | Question | Why I'm asking / what the build does differently |
|---|---|---|
| IM1 | **Where does the model physically live** — a Tableau data source? a set of Google Sheets? a dbt / Python pipeline into a warehouse (BigQuery)? a notebook with no saved output? | Decides whether there's anything to connect to. Sheets / BigQuery → a clean read connector. Tableau → connect to the *data source under* the dashboard, not Tableau's API (that's for rendering dashboards, not clean data). A notebook with no persisted output → Compass can only ever cite the memo, and we say so in the coverage line. |
| IM2 | **What's the grain** — one North Star number per grant? per cohort? does it change with each model version, and when is it re-run? | Compass has to cite the *right* number. If numbers are versioned, every impact citation must carry the model version + date, and "projected 94× under v3, restated to 96× under v4" becomes a **conflict-surfacing** case (shown, both values, not silently merged) rather than a contradiction the reader has to catch. |
| IM3 | **Projected vs. reported** — does the model hold both the projection *and* the actuals, or is "actual / reported" only ever inside a grantee's report? | The single most important distinction in the product. If actuals live only in Drive reports, Compass links the model's projection to the report's actuals itself and shows the delta (this is exactly what the Grantee dossier's "projected vs. reported" row does today). If the model holds both, Compass cites the model for both and the join is trivial. |
| IM4 | **Who owns the numbers**, and who resolves it when Compass's answer and someone's dashboard disagree? | Someone will ask "why did Compass say 94× when my dashboard says 96×." A named owner means model-vs-memo conflicts have a person who adjudicates. No owner means every impact answer is contested. |
| IM5 | Is the **model itself sensitive** — are the cost assumptions, discount rates, or unpublished inputs confidential? | Sets the tier. The model's *outputs* might be team-tier while an assumptions tab is `Restricted` → the connector ingests the outputs and stubs the assumptions. |
| IM6 | **Refresh cadence** — nightly extract, quarterly recompute, annual? | Freshness is one of the four inputs to Compass's confidence score. A quarterly model means a 4-month-old impact citation is *normal*, and the freshness scoring has to know the model's natural cadence — the same way per-grant reporting cadence is handled. |

### Fields I need from the impact model (once IM1 is answered)
| Field | Why / join role | Tier |
|---|---|---|
| Grant ID / cohort ID | Join to the spine | Team |
| North Star ratio (projected) + model version + as-of date | Half of every performance-vs-plan answer; vintage-stamped | Team |
| Projected annual / lifetime earnings delta, projected participants | Same | Team |
| Reported / actual outcomes (if the model holds them) | The other half | Team |
| Cost assumptions, discount rate, unpublished inputs | Only if an answer genuinely needs them | Restricted (stubbed) |
| Model version history / changelog | So restatements read as restatements, not contradictions | Team |

### Reporting cadence — why it's a discovery question, not an assumption
Reports don't arrive on one Foundation-wide calendar. Each grant has its own cadence
(quarterly / semi-annual / annual / biennial / final-only), its own term, its own end date,
its own renewal window — one grant can close in November and need a renewal LOI in August
while another runs two more years and renews in February. Compass reads the cadence from
GivingData's `reporting_frequency` field **if it's populated**, and otherwise infers it from
the spacing of the requirement due-dates (and labels the answer "inferred from N
requirements"). Discovery has to confirm: **is that field actually filled in, per grant?**
(question G9). If it isn't, the inference is what the whole portfolio-schedule view runs on,
and the team should know that.

---

## Synthesis round — reconciling the four

After the per-source rounds, one working session to lock these decisions:

| Decision | Question to resolve |
|---|---|
| **Source of truth per fact** | For grant amount, dates, status → GivingData. Projected impact → GivingData. Reported/actual impact → GivingData structured field if it exists, else the final report in Drive. Decision rationale → Drive memo, then GivingData review notes. Relationship / contact → Airtable, unless GivingData is more current. *Confirm each with the team.* |
| **Primary join keys** | Grant ID (GivingData) and normalized Organization name/ID. Which systems reliably carry the Grant ID? (Drive: rarely. Airtable: hopefully. Zoom: never.) |
| **The v1 corpus** | Which funds, which date range, which Shared Drives, how many grants. Proposal: GivingData 2022–2026 + 2–3 named Shared Drives + the matching Airtable orgs. |
| **`Never-ingest` list** | Named drives/folders/bases/record types that do not enter the index at all. |
| **The gap the team will accept** | Where will Compass honestly say "we don't have that"? Pre-2022 grants, personal drives, Zoom, un-tagged historical grants. Everyone agrees to this up front. |
| **Who signs off** | The data owner approves the corpus definition, the tier scheme, and the `Never-ingest` list before the first production sync. |

---

## What I learned doing this before (Hope Program, Idlewild)

- **The schema on paper is not the schema in use.** Half the "required" fields were optional in practice; two "critical" fields were abandoned years ago. You only learn this by asking the longest-tenured user, record by record.
- **The same number lives in three places with three values** — the projection in the model, the projection in the grant record, the projection quoted in the board memo. Pick the authoritative one deliberately or the tool will pick randomly.
- **The sensitive content is never where the org first tells you it is.** It's inside an ordinary-looking progress report, in a comment thread, in a CRM notes field — not just in the folder marked "Confidential." That's why PII detection runs on everything, not just the flagged material.
- **"We don't have that" is a feature.** The teams trusted the tool *more* once it reliably admitted its gaps. A confident wrong answer cost more trust than ten honest "I can't see that."
