# Compass — a shared way to ask five years of grant knowledge one question

**GitLab Foundation · Applied AI Fellow case study**
**Jessenia Cintron · prepared for the final-round panel (Elicia Wilson, Ellie Bertani, Matt Zieger, Tamsin Chen)**

> *"Compass" is a working name. It is meant to complement the Foundation's North Star metric — the North Star tells the team where to go; Compass helps them navigate the five years of reports, notes, and decisions that show how far along the way you already are.*

**Companion materials**
- **Discovery & data-requirements guide** — the rounds of questions I would ask about each source, the fields I need and why (`E_Discovery_Questions.md`)
- **Discovery request to the Foundation** — the send-ready version: credentials to ask for + two working-session agendas (`H_Discovery_Request.md`)
- **Source data inventory** — every object and field, per system (`F_Source_Data_Inventory.md`)
- **Security lifecycle review** — MAP / ATTACK / HARDEN / MONITOR / RESPOND against Compass, with a release decision (`G_Security_Review.md`)
- **Cost model** — monthly run-rate and one-time launch cost, with assumptions and the no-external-AI fallback (`I_Cost_Model.md`)
- **Data preservation guide** — plain-language: the retention gaps, why they exist, and how to keep the record whole going forward (`J_Data_Preservation_Guide.md`)
- **Lessons from the HOPE grant dashboard** — what my prior real grant-data build taught me, applied line by line to Compass (`K_Lessons_From_HOPE.md`)
- **Scope & added features** — what directly answers the assignment vs. what I added, and why each addition helps the Programs team (`L_Scope_And_Added_Features.md`)
- **Leadership decision packet** — the three decisions the panel owns: run the pilot, keep Zoom out, name an owner (`M_Decision_Packet.md`)
- **Code-weakness review** — an internal pass over the security-critical paths: 7 fixes, verified-sound list, production items (`N_Code_Review.md`)
- **Compass deck** — the 7-minute presentation (`C_Compass_Deck.pptx`)
- **Foundation research** — how they operate and how to speak to each panelist (`research/GitLab_Foundation_Deep_Dive.md`)
- **The MVP** — `compass/web` (React + Vite): Ask, Grantee dossier, and "How it works", 12 personas, the Deep-dive panel (gaps · who-to-ask · draft email · per-grant cycle), conflict surfacing, the toggleable Role & cycle context — running the *same* retrieval and permission modules as the CLI and the eval harness, on a synthetic 5-year corpus. `npm run web:dev`.
- **Working codebase** — ingest → clean → PII/injection filter → dedupe → resolve → translate → index → retrieve → cite, with credential-activated real connectors (Drive / Airtable / GivingData / Zoom / Notion) behind the same interface as the mocks. One promotion gate: `npm run ci` (eval · eval:pg · eval:full · security · server:check · redteam). Per-grant cycle logic, cadence inference. (`compass/`)

---

## Executive summary

The Programs team wants to ask questions of five years of grant reports and internal notes that currently live in four disconnected systems — Google Drive, GivingData, Airtable, and Zoom Chat. There is no single source of truth today.

**The core reframe I would bring to this work:** this is a *retrieval, permissioning, and citation* problem, not a chatbot problem. The hard and valuable parts are connecting four messy sources, cleaning and de-duplicating them so nothing is missed or double-counted, resolving them to the same grants and organizations, enforcing who is allowed to see what, and making every answer traceable to a source document. The language model is the last and least risky component. For a Foundation whose entire external brand is measurement rigor — "$193 in lifetime earnings for every $1 invested," "40 grants reporting results, three quarters above their ROI threshold" — the product cannot ever fabricate an impact number or surface a candid internal assessment to the wrong person. So the design is built around **grounded answers with citations, retrieval-time permission enforcement, and honest disclosure of what the tool could not see.**

**Security and compliance are a first-class pillar, not a later phase.** The Foundation moves ~$20M a year and holds five years of records on private companies, nonprofits, co-funders, and named low-income participants across the US, Colombia, and Kenya. Compass concentrates all of that into one place — so it is designed to be at least as safe as the most sensitive source it draws from: SSO with MFA, retrieval-time access control as the security boundary, `Restricted` content never loaded into the index, an enterprise LLM agreement with zero retention, full query audit logging, and controls mapped from day one to NIST CSF 2.0 / SP 800-53, SOC 2, the NIST AI RMF, and the privacy regimes of all three grantee geographies. Full detail in §6.

**What I would deliberately *not* build first:** Zoom Chat ingestion, any write-back into source systems, a full five-year backfill, personal Drive content, fine-tuning, and org-wide self-serve access. v1 earns trust on a narrow, high-quality, clearly-scoped corpus — roughly the last three years of GivingData plus two or three curated Shared Drives — served to three to five design users on the Programs team, with citations on every answer.

**Phasing:** the plan is built as a sequence of steps with concrete exit criteria, not a calendar. Discovery and access sign-off → a permissioned vertical slice over ~30 grants → data-quality and sensitivity pipeline plus corpus expansion to five years → additional surfaces, cost controls, documentation, and handoff. Each phase is "done" when its steps pass, not when a date arrives; pace is tracked as ahead-of / behind-plan against the next exit criterion so the team always knows where things stand. The 6-month fellowship shape is deliberately reflected: managed services over bespoke infrastructure, modular connectors, and a written handoff from day one.

---

## 1. Context — what I most need to know before designing anything

I would spend the first two to three weeks on discovery before writing production code. Below is what I need to learn, grouped into the four things that actually change the design: **the users and their decisions, the content itself, the access constraints, and the definition of success.** Section 1.5 turns this into the concrete list of questions I would ask in week one.

### 1.1 The users and the decisions this serves

"The whole team can use it" is the stated goal, but v1 has to serve specific people making specific decisions. I need to know:

- **Who is actually in scope.** The Programs team asked for this, but the Foundation is ~21 people. Does "the team" mean the Programs and Partnerships group (Matt Zieger's org — program officers, coordinators, partnerships), the Impact team (Tamsin Chen's org — impact modeling and measurement, advisory services), or everyone including Finance, Comms, and the CEO? Each group asks different questions and has different access rights. My assumption for v1: **Programs + Impact, ~8–12 people, with 3–5 as design partners.**
- **The real decisions.** I would want to validate which of these the tool is meant to support, because they set the precision bar:
  - *Renewal / re-up:* "How did this grantee perform against what they projected last cycle, and what did our program officer flag as a concern?"
  - *Sourcing and diligence:* "Have we ever funded anything in rural nuclear-maintenance upskilling or eviction-prevention AI? What did we learn, and who did we talk to?"
  - *Thesis development:* "Across the portfolio, what have grantees told us are the biggest barriers to credential completion?" — synthesis across many reports, not a lookup.
  - *Board, donor, and co-funder prep:* "Pull every reported outcome for the AI for Economic Opportunity cohort, with the source for each number."
  - *Onboarding:* a new hire coming up to speed on five years of institutional memory in weeks instead of months.
  - *Avoiding rework and contradiction:* "Did we already decide not to fund this organization, and why?"
- **The cost of a wrong answer, per decision.** A hallucinated outcome figure that lands in a board deck or a co-funder report is a serious credibility hit for this Foundation specifically. A missed prior grant in an internal brainstorm is recoverable. This tells me where to require citations and human verification (anything leaving the building) and where a fast, mostly-right answer is fine (internal exploration).
- **How the team works today.** What is the current painful workaround — asking the person who has been there longest, searching Drive by filename, re-reading a folder of PDFs? This is the adoption baseline and tells me where the "this is obviously better" moment is.
- **Query shape and volume.** A handful of deep research questions per week, or dozens of quick lookups per day? This drives latency, cost, and model-tier choices, and whether the interface should be conversational or a fast search box.
- **Where they want to ask.** A standalone web app, or answers inside the tools they already live in (GivingData, Airtable, Slack/Zoom)? v1 is a web app; I need to know whether that is acceptable or a blocker.

### 1.2 The content itself — I cannot design retrieval without inventorying it

- **Every place grant knowledge actually lives — not just the four named systems.** The brief names Google Drive, GivingData, Airtable, and Zoom Chat. A real engagement treats that as the starting point, not the boundary. A foundation this size almost always also has grant knowledge in: shared Gmail inboxes and email threads (decisions made in a reply, never written up), Zoom cloud recordings and transcripts (distinct from chat, often richer), an internal Notion workspace (their public Handbook is already Notion), the impact model and Tableau data behind the public dashboard, hand-maintained portfolio/pipeline spreadsheets, RFP and survey intake tools, executed agreements in DocuSign, and possibly a pre-GivingData grants system. Before scoping, I run a *"follow the knowledge"* exercise — trace three real past decisions to every place information about them was recorded — and produce a full source inventory ranked by value × feasibility × sensitivity. The four named systems are still the likely v1 scope, but that becomes a decision the team makes with the whole map in front of them. (Full question set in the discovery guide, Round 0.)
- **Volume and shape.** Roughly how many grants over five years (public reporting suggests ~60–80 awards per year recently, fewer early on — plausibly 250–400 total)? How many files in the relevant Drive folders — 5,000 or 500,000? Airtable row counts. Crucially, **how far back does Zoom Chat history actually go** — Zoom Chat retention is a setting, and there may not be five years of it.
- **Structured vs. unstructured.** GivingData and Airtable are structured and queryable by field. Drive is semi-structured (Docs, Sheets, Slides, PDFs, Word). Zoom Chat is unstructured conversation. Each needs a different ingestion and chunking strategy.
- **Duplication and versioning.** The same final grant report likely exists as a Google Doc, a PDF uploaded to the GivingData grantee portal, and an attachment in Airtable — sometimes with different numbers if one is a draft. This *is* the "no single source of truth" problem in the prompt. I need to know which system the team treats as authoritative for which fact (my working assumption: GivingData for grant terms, payments, and official reported outcomes; Drive for narrative and analysis; Airtable for relationships).
- **Sensitive content.** Grantee financials and audits, **names and stories of low-income program participants inside grant reports**, candid internal assessments of an organization or its leadership, board deliberations, staff compensation discussions in Zoom, legal and tax-status details. Some of this must never appear in a general team tool. I need the Foundation's existing data-classification scheme, or to build one with them.
- **Quality and consistency over time.** Has the grant report template changed across five years? Are older impact figures computed on an earlier version of the cost-benefit model (so a raw retrieved number could be misleading without its vintage)? How complete is the metadata in GivingData and Airtable — what fraction of records have empty key fields?
- **Language.** Colombia grantees produce Spanish-language reports; Kenya is mostly English. Retrieval and answer generation need to handle both.
- **Where "internal notes" actually live.** Diligence memos, site-visit notes, reference-call notes, program-officer observations — are these Drive docs, free-text fields in GivingData, notes fields in Airtable, Zoom threads, or all of the above? This determines how much of the value is even reachable in v1.

### 1.3 Access, permissions, and governance — per system

This is the part most likely to stall the project if not front-loaded.

| System | What I need to confirm |
|---|---|
| **Google Drive** | Is the relevant content in Shared Drives (permission by drive/folder, clean) or scattered across individuals' My Drive (permission chaos)? Which folders are explicitly restricted (board, HR, legal, compensation)? Will Workspace admin grant a scoped service account / domain-wide delegation, or do we use per-user OAuth? Is there an existing classification or labeling scheme? |
| **GivingData** | Does the plan tier include API access, and what are its limits — or are we relying on scheduled report/document exports? Do all Programs staff see all grants today, or are some records restricted by role? Are there confidentiality terms on grantee-portal uploads? Who owns the instance internally (Jessica Van Grouw, Grants Manager, is the likely owner)? |
| **Airtable** | Which bases, and who owns them? API access via OAuth or per-base keys is straightforward. Which fields carry PII (contact emails, phone, personal notes)? Any field- or view-level restrictions to mirror? |
| **Zoom Chat** | Does the Foundation have admin rights to create an OAuth app with chat scopes? What is the message-retention setting (does five years even exist)? Are we ever considering DMs and private channels, or public channels only? What have staff been told about their chat being searchable — this is a genuine employee-privacy and trust question, not just a technical one. |
| **Cross-cutting** | Is Google Workspace the identity provider / is there SSO to gate the app and map permissions? What is the Foundation's position on sending grantee and co-funder data to a third-party LLM API — do we need a zero-retention, no-training enterprise agreement and a signed DPA? Any data-residency requirement? Do grant agreements and the Foundation's privacy policy permit this secondary use of grantee data? Are there confidentiality obligations to co-funders (Ballmer Group, Annie E. Casey Foundation) about shared-cohort data? Who is the designated data owner who signs off on the access model — and is there internal IT/security or an outsourced MSP? What are the records-retention and legal-hold obligations, and does anyone treat query logs as discoverable records? |

### 1.4 What "success" looks like

- **The 6-month bar.** Concretely: what does Elicia or Matt want to be true in March that is not true today? A number for weekly active users on the Programs team? A specific recurring task that goes from hours to minutes? A decision that demonstrably went better because the history was at hand?
- **Trust, not just usage.** The metric I care about most is whether people *stop double-checking every answer* — that only happens if citations are consistently right and the tool reliably says "I don't have enough to answer that."
- **The failure that kills it.** For an org this size, one bad answer in front of a grantee, a board member, or a co-funder could end adoption. The design has to make that specific failure very hard.

### 1.5 The questions I would ask in week one

1. Who are the 3–5 people whose daily work this must improve, and can two of them be design partners who meet with me weekly?
2. Walk me through the last three times someone needed an answer from grant history — what was the question, where did they look, how long did it take, and what did they do with the answer?
3. Which system is the source of truth for grant terms? For reported outcomes? For "why we made this decision"?
4. Show me a restricted Drive folder and a restricted GivingData record. What is the rule for what belongs there?
5. Do grant reports contain named program-participant information, and what is our obligation for it?
6. What is our current agreement, if any, with an LLM provider, and who owns the decision to send grantee data to one?
7. How far back does Zoom Chat history go, and what have staff been told about it being searched?
8. Who signs off on the data-access model — and can we get that person in a room in week two?
9. What would make you turn this off?
10. Is a standalone web app acceptable for v1, or does it need to live inside GivingData / Slack to get used?

---

## 2. The System — end to end

### 2.1 Design principles

1. **Ground everything.** No answer without retrieved source passages behind it; every claim carries a citation with a deep link. If retrieval is weak, the tool says so instead of guessing.
2. **Enforce permission at retrieval, not in the UI.** A user can only ever be shown passages they are independently allowed to read in the source system.
3. **Disclose coverage.** Every answer states the date range and systems it searched and what it could not see (permission-filtered or not yet ingested). Existence questions ("have we funded X?") are never answered with a bare "no."
4. **Read-only in v1.** The tool never writes to Drive, GivingData, Airtable, or Zoom.
5. **Treat retrieved content as untrusted data.** Grant reports and chat messages can contain adversarial text; nothing retrieved is executed as an instruction.
6. **Build for handoff.** Managed services over self-hosted infrastructure; modular, documented connectors; a maintenance runbook from the first week. It is a six-month fellowship.

### 2.2 Architecture — seven layers

```
SOURCES         Google Drive   GivingData   Airtable   Zoom Chat (deferred)
                     │              │           │            │
1. CONNECTORS   incremental sync per source (change feeds where available)
                     └──────────────┴───────────┴────────────┘
                                    │
2. INTAKE       text extraction + OCR · language detect · PII scan · sensitivity labeling
                                    │
3. DATA QUALITY  clean + standardize · de-duplicate (exact / near / cross-system) ·
                 reconcile against the grant spine (gap report) · resolve to canonical entities
                                    │
        ┌───────────────┬───────────────────┬────────────────────┐
4. STORE   object store   vector index (hybrid)   entity/metadata graph (Postgres)   permission map
        └───────────────┴───────────────────┴────────────────────┘
                                    │
5. QUERY        auth (SSO) → filter candidates by user's ACL → hybrid retrieve → rerank
                → generate answer with inline citations → confidence + coverage statement
                                    │
6. INTERFACE    web app: answer · sources panel · filters · grantee dossier · feedback
                                    │
7. EVAL/OBS     gold Q&A set · retrieval + citation metrics · hallucination + leakage tests · cost/latency
```

### 2.3 Ingestion — per source

**Google Drive.** Scoped service account (or per-user OAuth if admin will not delegate), restricted to an explicit allowlist of Shared Drives and folders. Incremental sync via the Drive `changes` feed. Native Docs/Sheets/Slides exported to text; PDFs and Word parsed; **OCR for scanned documents** (older grant reports are frequently scans). Each file carries its Drive ACL, owner, last-modified date, and folder path into the metadata layer.

**GivingData.** Preferred: API pull of grant records, organizations, requirement/report schedules, review and scorecard data, payment schedules, and grantee-portal document references. Fallback if the API is unavailable or too limited: scheduled CSV/report exports plus a document export job. Each grant's structured fields are also rendered into a plain-language **"grant fact sheet"** document so the same facts are retrievable by semantic search, not only by filter.

**Airtable.** API pull per base: organizations, contacts, pipeline/stage, interaction log, thesis-area tags. Becomes relationship metadata on entities plus retrievable entity records. Contact PII is tiered and, where not needed for answers, redacted at intake.

**Zoom Chat (deferred past v1 — see §4).** When added: an admin OAuth app, **public channels only**, DMs and private channels excluded entirely. Thread-aware chunking so a decision and its context stay together. Clear staff disclosure and an opt-out before any ingestion.

Every connector emits the same envelope for each unit of content: `{source_system, source_id, deep_link, title, text, entities[], date, language, sensitivity_tier, acl}`.

### 2.4 Data quality — cleaning, de-duplication, completeness, and the entity graph

This is the layer that makes or breaks the product. If it silently drops a report or answers from a stale duplicate, every answer downstream is suspect. It runs as an explicit, monitored pipeline — not a side effect of ingestion — with a person able to inspect and correct it.

**2.4.1 Cleaning and standardization (every item, on every sync)**
- **Text extraction QA.** Each document gets an extraction-confidence score. Native Docs are high-confidence; scanned PDFs run through OCR and anything below a threshold is quarantined for review rather than indexed as if it were clean text.
- **Field normalization.** Organization names ("Chicago Scholars" / "Chicago Scholars Foundation" / "CSF"), dates (multiple formats across five years of templates), currencies (USD / COP / KES → store native + USD-normalized with the rate date), and money written as prose ("$1.2M") are all normalized to canonical forms. GivingData and Airtable enum/status values are mapped to one controlled vocabulary.
- **Boilerplate and noise stripping.** Email signatures, portal headers/footers, and repeated legal footers are removed before chunking so they don't dilute retrieval.
- **Language tagging** per document and per chunk, so retrieval and generation know when they're working across English and Spanish.
- **Vintage stamping.** Every impact figure is tagged with the reporting date and, where detectable, the model version it was computed under — so a 2022 number is never silently treated as current.

**2.4.2 De-duplication — so nothing is double-counted**
- **Exact duplicates:** content hash catches the identical file living in Drive, the GivingData portal, and an Airtable attachment.
- **Near-duplicates:** similarity comparison catches "Report_v3_FINAL.docx" vs "Report_v3_FINAL_clean.pdf" and draft-vs-final pairs.
- **Cross-system same-fact:** the projected-earnings value in a GivingData field and the same value quoted in a Drive narrative are recognized as one fact with two witnesses, not two facts.
- **Resolution rule:** one copy is designated authoritative (final over draft; GivingData's recorded outcome over a Drive working figure; most recent over older; native over OCR), the others become linked alternates. Retrieval reads the authoritative copy; the answer can still show "also appears in 2 other places."
- **Dedupe decisions are logged and reversible** — a wrong merge can be split back apart.

**2.4.3 Completeness — so nothing is missed**
- **Reconciliation against a spine.** GivingData's grant list is the spine. For every grant, the pipeline checks: is there a proposal? the reports the requirement schedule says should exist? an Airtable org record? Anything expected-but-absent goes on a **gap report** the team can see, so "we don't have Q3 for this grantee" is visible rather than a silent hole.
- **Sync health.** Per-connector dashboards: items seen, added, updated, quarantined, failed. An alert fires when a sync returns far fewer items than last time (a sign the source changed or broke).
- **Metadata-coverage metrics.** What fraction of grants have a program officer, a thesis tag, a geography, an outcome field populated — tracked over time so data hygiene is a number, not a vibe.
- **Ingestion is idempotent and re-runnable.** A fixed extractor or a corrected mapping can be replayed over history without creating duplicates.

**2.4.4 The entity graph**
Everything is resolved to a small set of canonical entities: **Grant, Organization, Person, Program/Thesis area, Report, Decision, Fund/Cohort, Geography.**
- **Entity resolution.** The Drive report "REACHing for Green — Year 1", GivingData grant `#1247`, the Airtable org record "Chicago Scholars Foundation", and the Zoom thread where the renewal was discussed all link to one Grant and one Organization. Matching keys: grant ID, normalized organization name, people, dates. Low-confidence merges go to a **human review queue** rather than being applied silently.
- **Why this matters for answers.** "How did Chicago Scholars do against projection?" is only answerable because the graph joins the *projected* earnings field in GivingData to the *actual* figure in the Year-1 Drive report to the program officer's note in Airtable — and the answer shows that join so a person can sanity-check it.

### 2.5 Permission model

- **Retrieval-time enforcement.** At query time, candidate passages are filtered to those the requesting user can access, using a permission map synced from Drive ACLs, GivingData roles, Airtable, and (later) channel membership. UI hiding is not a security control; the filter is.
- **Sensitivity tiers:** `Team` (any authorized user) · `Programs-only` · `Restricted` (board, HR/comp, legal, named participant PII) · `Never-ingest`. Anything unlabeled coming from a known-sensitive folder defaults to `Restricted`.
- **PII pass at intake** flags participant names, contact details, and financial-account data → redacted or tier-raised before it ever reaches the index.
- **The index is a concentrated asset.** Five years of sensitive material in one vector store is a high-value target; it inherits the highest sensitivity it contains — encryption at rest and in transit, least-privilege access, full audit logging, SSO with MFA, and a third-party review before go-live.

### 2.6 Retrieval and generation

Query → **intent classification** (lookup vs. synthesis vs. cross-portfolio comparison) → **hybrid retrieval** (semantic embeddings + keyword/BM25 for exact strings like grant IDs and dollar figures) with metadata filters (year, fund, geography, status, owner) → **reranking** → **answer generation with inline citations** to source deep links → **confidence signal + coverage statement**.

- **Refusal is a feature.** When retrieved support is thin, the answer is "I don't have enough in what I can see to answer that," plus what *is* there and what to check.
- **Model choice.** An enterprise LLM under a zero-retention, no-training agreement. Cheaper model for lookups, stronger model for synthesis. **No fine-tuning on Foundation data in v1** — retrieval only, so nothing sensitive ends up in model weights.
- **Vintage awareness.** Retrieved impact figures are presented with their "as reported on {date}" context so a five-year-old number computed on an older model is not treated as current.

### 2.7 Interface

- **v1: a web app**, SSO via Google Workspace. A question box, the answer with numbered citations, and a **sources panel** showing each cited passage, its system, and a link to open the original.
- **Citations are deep links to the exact passage, not just the record.** Clicking `[2]` opens the source and lands the user on the specific sentence, with it highlighted: a scroll-to-text fragment for web-viewable docs, a Google Docs heading/bookmark anchor where one exists, a record-and-field target for GivingData and Airtable. The citation also shows a human-readable locator ("§ Wage outcomes", "field: Median wage"). The point is that verifying an answer takes one click, not a hunt.
- **Filters:** fund/cohort, year, geography, grantee, owner.
- **Grantee dossier view:** everything about one organization assembled from all connected systems — grants, reported outcomes, key contacts, decision history, open questions — every line cited. This is the feature most likely to produce the "oh, this is genuinely useful" reaction in a demo.
- **Coverage line** on every answer: "Searched GivingData (2022–2026) and 3 Shared Drives. Not searched: pre-2022 grants, personal drives, Zoom Chat."
- **Feedback on every answer:** thumbs plus "this is wrong because…", feeding directly into the evaluation set.
- **"Deep dive" — a toggleable side panel, kept separate from the answer.** When it is on, Compass also surfaces: (a) *what would sharpen this answer* — a missing report, no reported results yet, restricted material withheld, only one system represented; (b) *who to ask* — the people actually associated with the grants involved, pulled from the entity graph: the program officer, the relationship owner, whoever wrote the diligence memo, whoever attended the last call; (c) *suggested questions* to put to them; and (d) *a draft email* when there is one clear internal recipient with an address. It is explicitly separate from the answer so it never reads as fact, and any user can turn it off. This is the feature that turns Compass from "search" into "help me get to a good decision."

### 2.8 Evaluation and observability

- **Gold question set:** 50–100 real questions from the Programs team, each with a verified answer and the sources that should support it. Built in discovery, expanded from real usage and feedback.
- **Tracked continuously:** retrieval recall, citation correctness, hallucination rate, refusal calibration, answer latency, and cost per query. Releases are gated on the gold set — a regression blocks the deploy.
- **Permission red-team:** scripted attempts to pull `Restricted` content as an unauthorized user, including via prompt injection in retrieved text. Run before every expansion of the corpus or user base.
- **Query logging** (who asked what) is itself access-controlled and retention-bounded, and reviewed with counsel so the tool does not become an unmanaged shadow record system.
- **Verify-before-external-use flag:** answers a user marks as board-, donor-, or grantee-facing get a visible "verify each figure against the cited source" banner.

### 2.9 End-to-end, in one sentence

Four connectors sync incrementally into a data-quality layer that cleans and de-duplicates every item, reconciles it against the grant spine so gaps are visible, resolves it to the same grants and organizations, labels it for sensitivity, and indexes it four ways; a query service authenticates the user, filters to what they may see, retrieves and reranks, and returns a cited answer with an explicit statement of what it searched and what it could not — and every answer feeds an evaluation loop that gates the next release.

---

## 3. Risks and edge cases

Ordered roughly by how much they threaten the project. "L/I" = rough likelihood / impact.

| # | Risk | L/I | How I would handle it |
|---|---|---|---|
| 1 | **Fabricated or stale facts stated authoritatively** — especially impact numbers, especially ones computed on an old model version | Med / High | Mandatory citations; refuse when unsupported; show "as reported on {date}"; gold-set eval gates every release; verify-before-external-use flag on outward-facing answers |
| 2 | **Permission leakage** — restricted content (comp discussion, a candid assessment of a grantee's ED, participant PII) reaches someone who should not see it | Med / High | Retrieval-time ACL filtering; sensitivity tiers with default-deny; PII redaction at intake; permission red-team before each expansion; start from a curated corpus |
| 3 | **One bad answer collapses trust** in a 21-person org where word travels fast | Med / High | Ship to 3–5 design partners first; over-invest in citations and "I don't know"; measure trust (do people stop double-checking?), not just usage; never let an unverified answer leave the building |
| 4 | **Zoom Chat privacy blowback** — staff feel surveilled; a casual "this grantee is a mess" line resurfaces in a synthesis answer months later | Med / High | Defer Zoom entirely from v1; public channels only if ever added; exclude DMs/private permanently; explicit disclosure + opt-out; revisit only after trust is established |
| 5 | **Silent data loss or double-counting in the pipeline** — a report fails extraction and is dropped; a duplicate is indexed as a second fact and a synthesis answer counts it twice | Med / High | Every item accounted for (seen / added / quarantined / failed) with alerts on volume drops; reconciliation against the grant spine with a visible gap report; exact + near + cross-system dedupe with reversible, logged merges; idempotent re-runnable ingestion |
| 6 | **Entity-resolution errors** — two different orgs merged, or Grant A's outcomes attributed to Grantee B | Med / Med | Confidence thresholds with a human review queue; show the join behind every cross-system answer so a person can catch a bad merge |
| 7 | **"No single source of truth" ambiguity** — three versions of a report with different numbers | High / Med | Authoritative-copy rules; show version + date on every citation; when copies conflict, surface the conflict instead of silently picking one |
| 8 | **Coverage gap read as "doesn't exist"** — a grant predates the corpus or sits in an un-ingested folder | High / Med | Always print the coverage line; never answer an existence question with a bare "no"; make "expand what I can see" a one-click request |
| 9 | **Multilingual / OCR failure** — Spanish-language Colombia reports, scanned PDFs | Med / Med | Language detection + multilingual embeddings; OCR-confidence checks; flag low-confidence extractions rather than indexing them silently |
| 10 | **Cost / latency runaway** on large synthesis queries | Med / Med | Retrieval caps; caching; tiered models; per-query cost monitoring and per-user budgets; alert on anomalies |
| 11 | **Source API limits or breakage** — GivingData has no usable API; Drive change feed lags; Airtable schema drift | Med / Med | Graceful degradation to scheduled exports; sync-health monitoring and alerting; schema contracts with tests |
| 12 | **Vendor / secondary-use compliance** — sending grantee and co-funder data to an LLM API; obligations to Ballmer Group / Annie E. Casey about shared-cohort data; grant-agreement confidentiality | Med / High | Zero-retention, no-training enterprise agreement + signed DPA; legal review of secondary-use rights before ingestion; data-residency check; notify co-funders where required |
| 13 | **Prompt injection via ingested content** — a report or chat message containing "ignore previous instructions…" | Med / Med | Treat all retrieved text as untrusted data; injection filtering; no tool execution driven by retrieved content in v1 |
| 14 | **Records-retention / legal-hold conflict** — redaction or ingestion interacting with retention duties; query logs discoverable | Low / Med | Align design with counsel; bounded log retention; the tool references source records, it does not replace them |
| 15 | **Key-person dependency** — the fellow builds it and the fellowship ends in six months | High / Med | Managed services over bespoke; modular connectors; runbook and architecture doc from the start; a named internal owner identified before the midpoint |

---

## 4. Tradeoffs — what I would leave out of v1, and why

Every deferral below removes risk or scope without removing the core value: *ask five years of grant knowledge one question and get a cited answer.*

| Left out of v1 | Why |
|---|---|
| **Zoom Chat ingestion** | Highest privacy risk, messiest data, uncertain retention depth, lowest structured value. The team's most important decisions are also usually written up somewhere in Drive or GivingData. Revisit after trust is established. |
| **DMs and private channels** | Not a v1 deferral — a permanent exclusion. These are private communications. |
| **Any write-back** (drafting memos into Drive, updating GivingData) | Read-only Q&A has a fraction of the risk surface. Actions come only after the read path is trusted. |
| **Full five-year backfill** | Start with the last ~3 years plus all active grants. Recent data answers most decisions and is higher quality; extend to five years in Phase 3 once the pipeline is proven. |
| **Personal / My Drive content** | Permission chaos. Shared Drives and curated folders only. |
| **Fine-tuning or a custom model** | Retrieval-only is cheaper, safer, and keeps sensitive data out of model weights. |
| **Real-time sync** | Hourly or nightly incremental sync is enough. Sub-minute freshness is not worth the complexity. |
| **Slack/Zoom bot and GivingData embed** | v1 is one web app. Additional surfaces are Phase 4, once the core is trusted. |
| **Perfect entity resolution** | Ship with a review queue and visible joins. Do not block launch on 100% precision. |
| **Org-wide self-serve access** | "The whole team" is the Phase 3–4 goal. v1 is 3–5 Programs design users. |
| **Analytics dashboards / charts** | The Foundation already has a public Tableau impact dashboard. Compass answers questions in natural language; it does not rebuild BI. |
| **Polished multilingual answer generation** | Support Spanish retrieval in v1; high-quality Spanish *answers* are a fast-follow. |

---

## 5. Implementation plan — steps, not a calendar

**How this plan is run:** the work is a sequence of steps grouped into four phases, each with concrete **exit criteria**. A phase is done when its steps pass those criteria — not when a date arrives. Progress is reported as *ahead of / on / behind plan* against the next exit criterion, and the step list is re-ordered as discovery changes what we know. No step is time-locked. The Foundation has signalled it wants quick turnaround; the answer to that is a **thin vertical slice shipped early** (Phase 2) and then widened, not a big-bang build.

The phases are sequential in dependency, but hardening work (security controls, evaluation, data-quality monitoring) is threaded through every phase, not saved for the end.

### Phase 1 — Discovery, access, and compliance groundwork
- Stakeholder interviews (§1.5); confirm 3–5 design partners.
- Data inventory across all four systems: volume, formats, retention, metadata completeness, sensitivity.
- Access sign-off: least-privilege service account or OAuth for each source, scoped to an allowlist.
- Compliance groundwork: LLM enterprise agreement (zero retention) + DPA; secondary-use / grant-agreement review with counsel; Colombia and Kenya data-transfer determination; vendor SOC 2 reports collected; start the controls matrix (§6.12).
- Draft the four-tier sensitivity scheme with the team; agree what is `Never-ingest`.
- Build the first ~50-question gold set with verified answers and expected sources.
- Define the v1 corpus (proposal: GivingData 2022–2026 + 2–3 Shared Drives) and the 6-month success metric with Elicia / Matt.
- **Exit criteria:** signed, scoped access to at least Drive + GivingData; executed LLM data agreement; agreed v1 corpus; agreed success metric; sensitivity scheme approved by the data owner; gold set v1 exists.

### Phase 2 — Permissioned vertical slice (ship this early)
- Drive and GivingData connectors behind the shared adapter interface; incremental sync.
- Data-quality pipeline on ~30 grants: clean/standardize, exact + near + cross-system dedupe, reconcile against the grant spine, gap report.
- Entity graph for those 30 grants; authoritative-copy rules; low-confidence merges to a review queue.
- Hybrid retrieval (semantic + keyword) with **retrieval-time ACL filtering**; sensitivity tiers enforced; `Restricted` excluded from the index.
- Web app: Google SSO, answer + inline citations + sources panel + coverage line + feedback; the grantee-dossier view for the 30 grants.
- SSO + MFA, secrets in a managed store, audit logging of every query, kill switch — in place for this slice, not deferred.
- 3–5 design partners using it on real questions; structured feedback loop.
- **Exit criteria:** design partners answer real questions with correct citations; gold-set citation accuracy above the agreed bar; **zero permission-leak findings in a red-team pass**; audit log and kill switch verified.

### Phase 3 — Harden and expand the corpus
- Airtable connector.
- PII / sensitivity pipeline productionized; OCR and multilingual (Spanish) retrieval.
- Evaluation gates wired into the deploy pipeline; scheduled permission red-team; anomaly-detection alerts live.
- Backfill the corpus to five years; version- and conflict-handling for divergent report copies.
- Third-party penetration test; controls matrix brought to SOC 2 / NIST CSF coverage.
- Broaden access to the full Programs + Impact group.
- Cost and latency monitoring with per-user budgets.
- **Exit criteria:** five-year corpus indexed with a clean reconciliation report; full Programs + Impact team onboarded; eval + red-team gates running automatically; pen-test findings remediated; cost per query within budget.

### Phase 4 — Scale, embed, and hand off
- Additional surface: a Slack/Zoom answer bot or a GivingData embed, chosen by where the team actually works.
- Feedback-driven retrieval and prompt tuning.
- Usage, trust, and cost dashboards for leadership.
- Full documentation: architecture, runbook, connector guides, incident response, on-call basics, and the compliance controls matrix.
- Written recommendations: whether to ingest Zoom Chat, whether to go org-wide, and what a permanent product-and-engineering function would own.
- Named internal owner trained and running the system.
- **Exit criteria:** documented, handoff-ready system with a named internal owner operating it; leadership decision packet on Zoom Chat + org-wide rollout delivered; tabletop incident exercise completed.

---

## 6. Security, privacy, and governance

The Foundation commits on the order of $20M a year, and holds five years of records on private companies, nonprofits, co-funders (Ballmer Group, Annie E. Casey Foundation, and others), and named low-income program participants. **Compass concentrates all of that into one queryable place — and that concentration is the central risk.** The rule the design follows: *the tool must be at least as safe as the most sensitive source it draws from, and no staff member may see through Compass anything they could not see in the source system.*

The architecture is described in build order — the front door first (how a person proves who they are), then authorization (what they can retrieve), then how Compass itself reaches the source systems, then the controls that keep the data **safe, clean, unaltered, and un-hacked**. Every choice is stated with the alternative it beat.

### 6.1 Threat model — what we are defending against
| Threat | Where it bites | Primary control |
|---|---|---|
| External compromise of the index | One breach exposes five years of everything | §6.6 encryption + isolation, §6.2 no public surface, §6.8 detection |
| Over-broad internal access | A staffer retrieves comp, board, a candid grantee assessment, or participant PII | §6.3 retrieval-time ACL filter + `Restricted` never indexed |
| Credential compromise | A phished staff account inherits Compass access | §6.2 OIDC + Workspace-enforced MFA + short sessions + step-up |
| Data tampering / silent corruption | The index, a cached document, or the audit log is altered | §6.5 content hashing, read-only sources, hash-chained audit log |
| Third-party exposure | Grantee / co-funder data reaches an LLM vendor or a vendor is breached | §6.7 zero-retention contract, minimal payload, `Restricted` absent by construction |
| Prompt injection / exfiltration | Crafted text in a report or message manipulates the model | §6.7 retrieved content treated as data, hardened prompt, output scanning |
| Supply chain | A compromised dependency in the pipeline | §6.8 pinned deps, lockfile integrity, SBOM, clean-room CI |
| Insider misuse | Someone mines the tool or leaks synthesized findings | §6.5 full audit log, §6.8 anomaly alerts, §6.10 data-use policy |
| Accidental exposure | A misconfigured share, a public deploy, a secret in a log | §6.6 IaC + secret manager + log scrubbing, §6.3 default-deny |

### 6.2 The front door — authentication (OAuth 2.0 / OIDC via Google Workspace)

**Nobody sets a password with Compass.** Sign-in is delegated to the Foundation's Google Workspace using **OpenID Connect (the identity layer on OAuth 2.0), Authorization Code flow with PKCE**:

1. A user opens Compass → redirected to Google's authorization endpoint (`accounts.google.com`).
2. Google authenticates them **with the MFA that Workspace already enforces**, and returns an authorization code to Compass's registered redirect URI.
3. Compass exchanges the code (server-side, with its client secret + PKCE verifier) for an **ID token** — a JWT signed by Google.
4. Compass verifies the token before trusting it: signature against Google's published keys (JWKS), `iss` = `https://accounts.google.com`, `aud` = Compass's client ID, `exp` not passed, and **`hd` (hosted domain) = `gitlabfoundation.org`** — so only Foundation accounts get in, not any Google account.
5. Compass issues its own **short-lived session** (~8 hours) as an `HttpOnly; Secure; SameSite=Strict` cookie. No token or PII in the browser's reach of JavaScript. Re-auth is silent while the Workspace session is alive.
6. **Admin actions** (change a tier, reconfigure the corpus, trigger a re-index) require **step-up re-authentication** in the same request.

**Why Google Workspace / OIDC and not the alternatives:**
| Option | Verdict |
|---|---|
| **OIDC via Google Workspace** *(chosen)* | Every staffer already has a `@gitlabfoundation.org` account; Workspace is already the source of truth for *who works here* and already gates Drive. Compass inherits their MFA, their password policy, and — critically — **their offboarding**: revoke someone in Workspace and they lose Compass in the same minute. No new credential store to breach. |
| Local username / password | Rejected. A second credential database to secure, phish, and breach; no guaranteed MFA; no lifecycle sync — a departed employee could still log in. |
| A dedicated IdP (Okta / Auth0 / Entra) | Rejected for v1. Adds licence cost and a second directory to keep in sync for a 21-person org. Revisit only if the Foundation adopts one org-wide, at which point Compass points its OIDC config at that IdP instead — a one-file change. |
| Magic-link email | Rejected. Weaker than federated MFA; email inbox becomes the single factor. |

### 6.3 Authorization — what a signed-in user can retrieve

Authentication proves *who*; authorization decides *what they see*, and it is enforced **at retrieval, not in the UI**.

- On login, Compass reads the user's **Google Groups membership** (Admin SDK, read-only) and maps it to permission groups: `programs`, `impact`, and the tiers each may retrieve. Re-synced on every login and nightly, so a group change takes effect immediately.
- **The retrieval-time filter is the security boundary.** Every candidate passage must satisfy `tier ∈ user.allowedTiers` **and** `passage.acl ∩ user.principals ≠ ∅`. A query can only ever match content the user is independently entitled to read in the source system. The model never receives a passage the user cannot see, so it cannot leak one in its answer.
- **Four tiers** — `Team` / `Programs-only` / `Restricted` / `Never-ingest` — are the spine. **Default-deny:** anything unlabeled from a known-sensitive location is `Restricted` until reviewed.
- **`Restricted` is excluded from the index entirely** (a metadata-only stub lets Compass say "that's restricted" without holding the content). Chosen over "index it but access-gate it" because an excluded document cannot be reached by a retrieval bug, a permission-map error, or a clever prompt — there is nothing there to reach.
- **PII pass at intake:** participant names, contact details, and financial-account numbers are detected and redacted or tier-raised before indexing. Named participant identifiers are not indexed at all in v1.
- Access to Compass is **granted per person**, never default-on for the domain. Quarterly access review. Downgrading any tier needs **two-person approval**.

### 6.4 How Compass reaches the sources — least-privilege connector credentials

Connectors authenticate **as Compass, not as the user**, each with the narrowest possible scope, and **no connector ever holds write access**.

| Source | Credential | Scope |
|---|---|---|
| Google Drive | A dedicated Google Cloud **service account** with domain-wide delegation | `drive.readonly`, restricted by Workspace admin to an **allowlist of specific Shared Drive IDs** |
| GivingData | API key / OAuth client, in the secret manager, rotated quarterly | Read-only; or a scheduled signed export to a locked bucket if no API |
| Airtable | Read-only Personal Access Token / OAuth | The named bases only |
| Directory (for §6.3 group sync) | The same service account | `admin.directory.group.readonly` |

**Why a service account, not each user's own OAuth:** one credential, centrally controlled and revocable; it survives staff turnover; its permissions are auditable in one place; and the index does not inherit the permission chaos of 21 people's personal My Drives. Per-user OAuth was rejected because the index would break every time someone left and would silently expand every time someone was over-shared a folder.

### 6.5 Keeping the data clean and unaltered — integrity at every hop

- **Sources are never mutated.** Connectors hold read scopes only; there is no code path anywhere in Compass that writes to Drive, GivingData, or Airtable. This is enforced by the credential's scope, not by policy.
- **Content hashing.** Every ingested item gets a **SHA-256 content hash** at pull time; the hash travels with every chunk in the index. Re-syncs compare hashes to detect change; a periodic verification pass re-hashes stored content against the source and **flags any mismatch** as possible corruption or tampering, then re-pulls.
- **The index is a derived, disposable artifact.** The source systems remain authoritative. If the index is ever suspected compromised, it is wiped and **rebuilt from source** — nothing of value is lost. Every build records a **manifest**: the exact pipeline code commit, the config, and the source snapshot it was built from, so "what is in the index and how did it get there" always has an answer.
- **Tamper-evident audit log.** Every query, every ingestion run, every admin action is written to an **append-only, hash-chained log** — each entry carries the hash of the previous entry, so any deletion or edit breaks the chain and is detectable. Log records are **shipped off the application host in real time** to write-once storage, so an attacker who compromises the host cannot rewrite history.
- **No fine-tuning.** The model holds none of the Foundation's data in its weights, so there is nothing there to poison or exfiltrate. Retrieval-only was chosen over fine-tuning for exactly this, plus cost and freshness.

### 6.6 Keeping the data safe — confidentiality, encryption, isolation

- **Encryption:** TLS 1.3 in transit on every hop; **AES-256 at rest** for the index, the object store, backups, and logs, with keys in a managed **KMS** and envelope encryption; keys rotated on schedule.
- **Secrets:** in a managed secret manager (e.g. GCP Secret Manager), **never in the repo or a plain `.env`**; access to secrets is itself logged; rotation schedule per credential; CI scans every commit for leaked secrets.
- **Network:** one locked-down cloud project / VPC. The app has **no public inbound** except the single HTTPS endpoint, which sits behind the IdP. **Egress is allowlisted** to exactly the source APIs and the one LLM endpoint — nothing else leaves.
- **Separate identities for separate jobs:** the app's runtime identity can read the index and call the LLM and nothing else; the pipeline's identity can read sources and write the index and nothing else. A compromise of one does not grant the other.
- **Environments separated:** dev and staging hold only synthetic data; real content exists only in the production project. Infrastructure is code-defined and reviewed — no click-ops.

### 6.7 Keeping the LLM path safe

- **Contract:** enterprise agreement with **zero data retention, no training on inputs**, a signed DPA, sub-processor list reviewed, US processing region.
- **Minimal payload:** only the retrieved passages plus the question go to the model — never the whole corpus, never raw source files. `Restricted` content **cannot** be in the payload because it is not in the index.
- **Prompt-injection defense:** all retrieved text is treated as **untrusted data**; the system prompt is hardened and states so; the model has **no tools** it can invoke from retrieved content in v1.
- **Output scanning:** generated answers are checked for PII and secret patterns before they are shown.
- An **in-VPC / self-hosted model** is kept as a fallback if legal review ever requires that grantee data not leave Foundation-controlled infrastructure.

### 6.8 Keeping it un-hacked — hardening and detection

- **Application hardening:** OWASP baseline — CSP, HSTS, strict output encoding, server-side input validation, per-user rate limiting, no secrets in client code.
- **Supply chain:** pinned dependencies with lockfile integrity hashes, a minimal dependency set, no untrusted post-install scripts, builds in a clean CI environment, an **SBOM** and automated CVE alerts on the pipeline.
- **Detection:** alerts on query-volume spikes, **repeated probes at `Restricted` topics**, off-hours access, bulk-extraction patterns, and failed-auth spikes.
- **Assurance:** a scheduled **permission red-team** (scripted attempts to reach `Restricted` content as an unauthorized user, including via prompt injection) run before every corpus or user-base expansion; a **third-party penetration test** before go-live and after major changes.

### 6.9 Incident response and continuity

- **Kill switch:** one control disables retrieval and answers while leaving every source system untouched.
- **Runbook** with defined severity levels: revoke access, isolate the index, rotate credentials, preserve the (off-host) logs, notify.
- Breach-notification obligations (state law, grantee and co-funder contractual duties) mapped **before** launch, not during an incident; named incident lead; a tabletop exercise before go-live.
- **Continuity:** the index is rebuildable from source at any time; backups are encrypted, versioned, and restore-tested with separate credentials.

### 6.10 Governance — who decides what

- **Data owner / DRI:** one accountable person (the COO's office) signs off on the access model and any tier change.
- **Review group** (COO + Director of Impact + Grants Manager + counsel as needed) approves new sources, corpus expansion, new user groups, the Zoom Chat decision, and org-wide rollout.
- **Written data-use policy:** acceptable use, no external sharing of unverified answers, mandatory "verify before external use."
- **Grantee-facing transparency:** update the privacy notice / grant terms to disclose internal analytical use of submitted materials; notify co-funders where agreements require.
- **Records:** Compass *references* source records; it is not a system of record and never modifies or deletes source data. Aligned with the Foundation's retention schedule.

### 6.11 Why this is the right shape — decisions and the alternatives they beat

| Decision | Why it is best here | Rejected alternative |
|---|---|---|
| OIDC via Google Workspace for login | Inherits their directory, MFA, and offboarding; no new credential store | Local passwords; a separate IdP (cost + sync for 21 people) |
| Authorization-code + PKCE, server-side token exchange | Client secret never in the browser; code interception useless without the PKCE verifier | Implicit flow (deprecated; token exposed to the browser) |
| Short session cookie, `HttpOnly`/`Secure`/`SameSite=Strict` | Not reachable by page JavaScript; not sent cross-site | Long-lived JWT in `localStorage` (XSS-exfiltratable) |
| Retrieval-time ACL filter as the boundary | The model never sees content the user can't; nothing to leak in the answer | Filtering the answer after generation (leak risk in generated text) |
| `Restricted` excluded from the index | A bug or a crafted prompt can't reach what isn't there | Index it, gate access (one misconfiguration = exposure) |
| Service-account connectors, read-only | Central control, survives turnover, auditable, no My-Drive sprawl | Per-user OAuth (breaks on departure, inherits over-shares) |
| Content hashing + hash-chained, off-host audit log | Tampering with the index or the log is detectable | Trusting the store; logs only on the app host (an attacker rewrites them) |
| Index as a rebuildable derived artifact | Compromise → wipe and rebuild; sources stay authoritative | Treating the index as precious primary data |
| RAG, no fine-tuning | No Foundation data in model weights; cheap; current; auditable | Fine-tuning (data-in-weights, stale, costly, poisonable) |
| Managed KMS + secret manager | Fewer crypto primitives to get wrong; provider is SOC-2 audited | Roll-your-own key handling; secrets in env files |
| Allowlisted egress, no public inbound | Even a compromised app can't call out to an attacker or be reached directly | Open egress; a public endpoint in front of auth |

### 6.12 Compliance standards

Compass is an internal tool, but it touches money data, PII, and cross-border grantee records, so it is held to external standards from the start rather than retrofitted.

**Control framework.** Map all controls to **NIST Cybersecurity Framework 2.0** as the backbone, using **NIST SP 800-53 (moderate baseline)** as the control catalog. Target **SOC 2 Type II** criteria (security, confidentiality, availability) for the Compass system itself, and **require a current SOC 2 Type II report from every vendor** in the path — the LLM provider, the hosting platform, and the embedding/model services — reviewed annually alongside their sub-processor lists and DPAs.

**AI-specific governance.** Adopt the **NIST AI Risk Management Framework (AI RMF 1.0)**: a documented AI use policy, a system/model card for Compass (intended use, data, limits, evaluation results), a bias-and-impact review given that the mission population is low-income workers, and human-in-the-loop for any outward-facing use. The EU AI Act is not expected to apply (no EU deployment or users) — confirm and document that determination.

**Privacy law.** Because grantees operate in the United States, **Colombia, and Kenya**, the data-protection analysis is not US-only:
- **United States:** comply with applicable state privacy laws (California CPRA and the growing set of state statutes) for any participant personal data — data-subject rights, purpose limitation, minimization. The safest path, taken here, is to **not index participant PII at all in v1**.
- **Colombia:** Ley 1581 de 2012 (Habeas Data) and Superintendencia de Industria y Comercio guidance — lawful basis and cross-border transfer rules for any Colombian personal data in grantee reports.
- **Kenya:** the Data Protection Act, 2019 and the Office of the Data Protection Commissioner — registration and transfer conditions where Kenyan personal data is involved.
- Cross-border transfer mechanisms (or exclusion of that data) confirmed with counsel before those geographies enter the corpus.

**Sector and financial compliance.** Respect the Foundation's obligations as a US private foundation — recordkeeping, expenditure-responsibility documentation for grants that require it, and self-dealing rules — by treating Compass as a *reference layer over* the records, never a replacement. Grant-dollar data in scope is handled consistently with the Foundation's financial controls and annual external audit (CFO / Controller sign-off on what financial detail is indexed).

**Contractual compliance.** Honor confidentiality and data-use clauses in individual grant agreements and co-funder MOUs; where a clause restricts secondary use, that grantee's material is excluded until renegotiated or consented.

**Records and legal hold.** Align query-log and index retention with the Foundation's document-retention schedule and litigation-hold process, documented with counsel.

**Accessibility.** Build the interface to **WCAG 2.1 AA** — appropriate for any internal tool, and consistent with the Foundation's disability-inclusion work.

**Evidence.** Maintain a live controls matrix (control → framework reference → implementation → owner → last tested) so a compliance review, a co-funder's due-diligence request, or an auditor can be answered from a single document.

---

## Appendix A — Per-system data dictionary (the "ins and outs")

This is my *starting hypothesis* for what each system holds and how to work with it, to be corrected in Phase 1 discovery. It is the basis for the mock data in the interactive MVP.

### A.1 Google Drive — narrative and analysis
| Aspect | Detail |
|---|---|
| **Object types** | Grant proposals & LOIs; grantee progress and final reports; internal diligence memos; site-visit and reference-call notes; program strategy and thesis docs; board decks and memos; impact-model spreadsheets; budgets; meeting notes |
| **Formats** | Google Docs, Sheets, Slides (export as text/CSV); PDF and Word (parse; OCR if scanned) |
| **Access** | Drive API; scoped service account w/ domain-wide delegation *or* per-user OAuth; `changes` feed for incremental sync |
| **Key metadata** | Owner, Shared Drive + folder path, last-modified, explicit ACL, MIME type |
| **Join keys** | Organization name in title/body; grant ID if present; people named; fund/cohort in folder structure |
| **Sensitivity** | Mixed — from freely shareable to board/HR/legal restricted; named participant stories inside reports |
| **v1 scope** | 2–3 curated Shared Drives; no My Drive |

### A.2 GivingData — the system of record for grants
| Aspect | Detail |
|---|---|
| **Object types** | Grant records (amount, dates, status, type, thesis area); organizations/grantees; requirements & report schedules with due dates; grantee-portal submissions (proposals, progress reports, budgets, compliance docs); review / impact-scorecard data; payment schedules; internal notes fields |
| **Formats** | Structured fields via API or scheduled report export; attached documents via document export |
| **Access** | Confirm API availability + rate limits on the Foundation's plan; fallback = scheduled CSV + document export; role-based visibility to mirror |
| **Key metadata** | Grant ID (primary join key), org ID, fund/cohort, program officer, lifecycle stage, projected vs. reported outcome fields |
| **Join keys** | Grant ID and org ID — the backbone the other three systems attach to |
| **Sensitivity** | Grantee financials/audits; candid internal review notes; portal uploads possibly under confidentiality terms |
| **v1 scope** | 2022–2026 grants; structured fields + a generated plain-language fact sheet per grant |

### A.3 Airtable — the relationship CRM
| Aspect | Detail |
|---|---|
| **Object types** | Organization profiles; contacts (grantees, funders, co-funders, experts, advisors); pipeline/stage; interaction log; thesis-area and geography tags; source/referral |
| **Formats** | Structured records via API |
| **Access** | Airtable API (OAuth or per-base key); identify which bases and owners; mirror any view/field restrictions |
| **Key metadata** | Org name (fuzzy join key), linked grant IDs, relationship owner, last-contact date, tags |
| **Join keys** | Organization name → resolved to canonical Organization; linked record IDs where present |
| **Sensitivity** | Contact PII (email, phone, personal notes); subjective relationship notes |
| **v1 scope** | Org + contact + interaction data for the v1 grant set; PII redacted unless needed for an answer |

### A.4 Zoom Chat — team conversation and decisions (deferred past v1)
| Aspect | Detail |
|---|---|
| **Object types** | Public-channel messages and threads; shared links; ad hoc decisions and rationale |
| **Formats** | Messages via Zoom Chat API; thread-aware |
| **Access** | Admin OAuth app with chat scopes; **public channels only**; DMs/private excluded permanently; retention setting caps history depth |
| **Key metadata** | Channel, thread, author, timestamp, referenced entities |
| **Join keys** | Organization / grant names mentioned in text (low precision — needs the entity graph) |
| **Sensitivity** | High — candid opinions, personnel and comp talk, expectation-of-privacy concerns |
| **v1 scope** | None. Added only after explicit staff disclosure, opt-out, and a trust track record. |

### A.5 Canonical entities (the normalization target)
`Grant` · `Organization` · `Person` · `Program/Thesis area` · `Report` · `Decision` · `Fund/Cohort` · `Geography`
Primary joins: **Grant ID** (GivingData) and **normalized Organization name** (all four). Everything else hangs off those.

---

## Appendix B — Assumptions register

| # | Assumption | If wrong, impact |
|---|---|---|
| B1 | v1 users are Programs + Impact (~8–12 people), 3–5 as design partners | Broader scope changes the permission model and success metric |
| B2 | GivingData is the source of truth for grant terms and official outcomes; Drive for narrative | Authoritative-copy rules and the entity graph change |
| B3 | Relevant Drive content is in Shared Drives, not My Drive | Permission work becomes much larger; v1 corpus shrinks |
| B4 | GivingData has a usable API or an acceptable scheduled export | Ingestion effort and freshness change materially |
| B5 | The Foundation will sign a zero-retention, no-training LLM agreement | May need a self-hosted or in-VPC model; cost and timeline rise |
| B6 | Grant agreements / privacy policy permit this internal secondary use of grantee data | Legal review could narrow the corpus or delay Phase 2 |
| B7 | Google Workspace is the identity provider for SSO | Auth and permission-mapping approach changes |
| B8 | ~250–400 grants over 5 years; Drive folders in the low tens of thousands of files | Much larger volume changes infra and cost assumptions |
| B9 | Zoom Chat retention is well under 5 years and mostly low-value | If it is deep and rich, the deferral tradeoff is worth revisiting sooner |
| B10 | No dedicated internal IT/engineering; outsourced or minimal | Reinforces managed-services choice and the handoff risk (#14) |

---

## Appendix C — Sources

Public information used to ground assumptions about the Foundation's model, portfolio, team, and reporting:

- [GitLab Foundation — Powering Economic Opportunity](https://www.gitlabfoundation.org/powering-economic-opportunity)
- [GitLab Foundation — Measuring What Matters Pt. I: How We Evaluate Impact](https://www.gitlabfoundation.org/our-journey/measuring-what-matters-how-we-evaluate-impact)
- [GitLab Foundation — Grantmaking (public Handbook, Notion)](https://gitlabfoundation.notion.site/Grantmaking-12fba08bd3e0413b8a5dda79cdc31d48)
- [GitLab Foundation — Team](https://www.gitlabfoundation.org/team)
- [GitLab Foundation Reports $8 Billion in Lifetime Earnings Gains Across 775,000 People Worldwide (May 2026)](https://www.gitlabfoundation.org/our-journey/gitlab-foundation-reports-8-billion-in-lifetime-earnings-gains-across-775000-people-worldwide)
- [GitLab Foundation Announces Largest AI for Economic Opportunity Cohort Yet — 16 organizations (PR Newswire)](https://www.prnewswire.com/news-releases/gitlab-foundation-announces-largest-ai-for-economic-opportunity-cohort-yet-backing-16-organizations-using-ai-to-improve-support-systems-for-workers-302705426.html)
- [GitLab Foundation Announces Inaugural Ten Powering Economic Opportunity Fund Grantees](https://www.gitlabfoundation.org/our-journey/gitlab-foundation-announces-powering-economic-opportunity-fund-grantees)
- [GivingData — grant management platform (grantee portal, reporting, communication features)](https://www.givingdata.com/insights/a-grant-cycle-management-software-streamlining-the-grant-lifecycle)
- [GitLab Foundation 2025 Impact Report](https://www.gitlabfoundation.org/fy2025impactreport)

*Case study prompt: GitLab Foundation, Applied AI Fellow, final-round skills demonstration (2026).*
