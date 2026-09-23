# Compass document-set review

**Reviewed:** `PROJECT_OVERVIEW.md`, `PRD.md`, `TRD.md`, `USER_FLOWS.md`, `LOGIC_TREES.md`, `WIREFRAMES.md`, `ROLE_AND_CYCLE_CONTEXT.md`, `SYSTEM_TOOLS.md`, `ROADMAP.md`, `PRIOR_ART.md`, `CROSS_PLATFORM.md`, and `DATA_MODEL.md` supplied from Downloads.

## Executive verdict

The set is useful as a **target-state specification draft**, but it is not yet a truthful or internally consistent product documentation suite. It contains strong product thinking, especially around evidence, permissions, failure states, role/cycle context, source reconciliation, and release gates. It also contains material problems:

1. It claims backend, identity, audit, retrieval, and evaluation capabilities are working even though the current Compass repository is a synthetic Vinext/React interface without those services or scripts.
2. It contains synthetic claims about real organizations and people.
3. Several denial states leak metadata about restricted material.
4. It commits to frameworks, models, cloud platforms, thresholds, cadences, and native apps before requirements or benchmarks justify them.
5. It sometimes treats role, title, system, or recency as authority when authority must be field- and decision-specific.
6. It confuses a permission-aware evidence product with a broadly agentic platform.

The right move is to preserve the documents but revise them under one source hierarchy and implementation-evidence ledger.

## Source hierarchy for the revised set

When documents disagree, use this order:

1. User-approved product decisions and the interview prompt.
2. Verified behavior in the current repository and deployed application.
3. GitLab Foundation's authoritative public materials and later, approved internal requirements.
4. Official source-system API and security documentation.
5. Tested architecture decisions and benchmarks from the Compass corpus.
6. Maintained third-party documentation and source code.
7. Inference, clearly labeled and never presented as Foundation fact.

Every requirement and architecture claim should carry one of: `VERIFIED FROM IMPLEMENTATION`, `VERIFIED FROM AUTHORITATIVE SOURCE`, `DOCUMENTED BUT NOT VERIFIED`, `INFERRED`, `UNKNOWN`, or `NOT IMPLEMENTED`.

## Document-by-document assessment

| Document | Value | Main correction | Revised role |
|---|---|---|---|
| Project Overview | High | The state table overclaims working backend/security/eval functionality and narrows/expands the corpus inconsistently | One-page truth: problem, product, current state, target state, release status |
| PRD | High | Several requirements leak restricted metadata, rely on unverified personas/cycles, and contain arbitrary targets | Authoritative product behavior, scope, acceptance criteria, evidence labels |
| TRD | High | Prematurely fixes Cloud Run, LangGraph, LlamaIndex, BGE-M3, chunk size, session duration, and ACL representation | Technology-neutral requirements first; decision records for selected implementations |
| User Flows | High | Permission filtering appears after retrieval; feedback contaminates the eval set; sensitive denial copy leaks facts | Role/task flows with safe negative states and verified authorization sequence |
| Logic Trees | High | Hardcoded scores and global source priority are not validated; restricted stubs leak existence | Deterministic policy trees with configurable thresholds and tests |
| Wireframes | Medium–High | Uses real people/grantees with fabricated records; labels unbuilt screens as built; unsafe external-use control | Synthetic role-based screens tied to acceptance criteria and responsive states |
| Role & Cycle Context | High | Hardcodes unverified fiscal/OKR/board cycles and maps named people to assumed needs | Admin-configured context taxonomy confirmed by users; never an access source |
| System Tools | Medium | Overbuilt infrastructure; domain-wide delegation and broad directory access are premature; platform is unresolved | Capability and credential inventory with least-privilege options and decision gates |
| Roadmap | High | Four phases stop too early, include arbitrary metrics/cadence, mandate native apps, and use unbounded agent loops | Full sequential plan with entry/exit criteria through production, adoption, and responsible scale |
| Prior Art | Medium | Some sources are archived/reference-only; superlative claims are unsourced; too many frameworks overlap | Short candidate register with license, maintenance, security, benchmark, and fallback evidence |
| Cross-Platform | Medium–High | Good server-side boundary, but assumes PWA/native demand and proposes caching sensitive answers on devices | Responsive-web requirement and decision gate for PWA/native capabilities |
| Data Model | High | Strong lineage concept, but source IDs, ACL arrays, metrics, people, decisions, and retention are too simplistic; major product entities are absent | Canonical, temporal, provenance-first evidence and policy model with stable internal IDs |

## Cross-document corrections that should happen first

### 1. Make implementation status truthful

The current repository verifies a high-fidelity synthetic interface and product narrative. It does **not** currently verify:

- Google OIDC or email-specific access;
- database persistence or row-level security;
- Drive, GivingData, Airtable, or Zoom connectors;
- document parsing, OCR, PII detection, or quarantine;
- hybrid retrieval, embeddings, reranking, or ACL-filtered SQL;
- hash-chained or immutable audit storage;
- `npm run security` or `npm run eval` scripts;
- a production monitoring or incident-response system.

Replace every unsupported `working`, `built`, test count, or production-quality claim with `PROTOTYPE DEMONSTRATED`, `SPECIFIED`, or `NOT IMPLEMENTED`. Create a requirements-traceability matrix that links each claim to code, test, screenshot, deployment, or source.

### 2. Remove synthetic data attached to real entities

Replace Carina, real panelists, plausible staff emails, staff-authored concerns, renewal recommendations, and invented grant results with unmistakably fictional entities and roles. Real public facts may appear only when directly sourced and clearly separated from synthetic workflow data.

### 3. Use non-disclosing authorization failures

Remove:

- counts of withheld passages or documents;
- the restricted tier or category that matched;
- titles, entities, topics, or authors of inaccessible records;
- statements confirming that compensation, board, personnel, declined-applicant, or legal content exists.

Safe behavior: `I can't answer this request from the evidence available to your account. If you believe you need access, use the approved access-request path.` The request path is configurable; do not assume it is the COO's office.

### 4. Correct the retrieval order

Authorization is part of candidate generation, not a filter applied after broad retrieval:

`verified identity → effective entitlements → authorized candidate query → hybrid scoring within allowed rows → rerank allowed rows → evidence threshold → generation → claim/citation validation → response authorization check → audit`

Unauthorized text, embeddings, titles, and metadata must not enter model context or user-visible diagnostics. Depending on threat model, embeddings for excluded material may belong in separate indexes or not exist at all.

### 5. Replace “confidence” with evidence quality

Do not show an unexplained High/Medium/Low model-confidence badge. Compute and disclose separate evidence signals:

- source coverage;
- citation support;
- evidence agreement/conflict;
- freshness;
- extraction quality;
- answer status: supported, partial, conflicting, or insufficient.

Thresholds must be calibrated on the gold set, not embedded as universal constants in diagrams.

### 6. Turn external use into a governed workflow

Replace `mark for external use` with `request external-use review`. The product may prepare a cited draft, but an authorized reviewer validates figures, confidentiality, wording, and source permissions. Copying or exporting should preserve citations, review status, evidence date, and an expiration/staleness marker.

### 7. Separate feedback from ground truth

Thumbs-up/down enters a **feedback inbox**, never the gold set directly. A qualified reviewer labels the issue, corrects the expected answer/sources where appropriate, and versions the evaluation dataset. Otherwise repeated user preference can poison the system's definition of correctness.

## Product-specific document improvements

### PROJECT_OVERVIEW.md

- Keep the reframe and CREDIT alignment.
- Change “can never surface” to a testable design objective: “is designed to prevent and release-gated against unauthorized disclosure.” Absolute security claims are not credible.
- Separate `Current verified state`, `Next build state`, and `Target state`.
- Describe four target sources while naming which connectors are actually implemented.
- Replace “language model is least risky” with “the language model is one risk-bearing component inside a larger data and authorization system.”

### PRD.md

- Add requirement IDs for Role & Cycle Context, responsive web, admin review, access request, source health, deletion/tombstones, and data-subject handling.
- Make exact-user admission explicit: stable Google `sub` is the account key; require `email_verified`; verify the Workspace `hd` claim; then match the account to an approved-user record. Domain membership alone does not authorize Compass.
- Model source-derived ACLs separately from product roles. Role context can improve relevance but never broaden retrieval.
- Remove declined-applicant history from the default onboarding examples. Foundation transparency guidance specifically requires care around organizations that were not funded.
- Replace “every claim” with “every material factual claim,” then define materiality and citation-validation behavior.
- Add query deletion/retention choices and clarify whether query text is logged.
- Replace arbitrary success claims with baselines and jointly agreed targets. Never optimize for users to stop verifying consequential external figures.
- Upgrade accessibility target to WCAG 2.2 AA.

### TRD.md

- Start with logical components and trust boundaries; select Cloud Run, Vercel, Cloudflare, or another runtime only after deployment, data-residency, networking, and team-ownership decisions.
- Align with the current Vinext/React repository or explicitly record a migration decision. Do not describe the app as React/Vite while the actual project uses Vinext and Sites-oriented deployment.
- Do not assume `SameSite=Strict`; validate the OIDC flow. Use secure, HTTP-only cookies, CSRF protections, rotation, revocation, and risk-based session duration.
- Replace `acl text[] overlap` with a policy model capable of user, group, source, record, inheritance, expiry, deny, sensitivity, and purpose/context where needed. Test query plans and side channels.
- Use structure-aware chunking and corpus benchmarks. A fixed 140-token value is not a requirement.
- Exact amounts and counts come from typed structured fields/calculations. Generated fact sheets may aid retrieval but cannot become numerical authority.
- Change the LLM interface from free text to a typed answer contract containing claims, citation IDs, conflicts, gaps, coverage, and status.
- Add authorization to each REST resource to prevent IDOR/BOLA; `orgId` knowledge never implies dossier access.
- Make citation navigation source-capability-aware. Exact highlighting may not be available in every source.
- Use bounded jobs/state machines first; add LangGraph only if durable model-directed branching or human pause/resume is proven necessary.

### USER_FLOWS.md

- Replace real names, organizations, and invented statements.
- Add first-login/invitation, access-denied, account-disabled, consent/notice, source-permission-revoked, deletion, and incident-paused flows.
- Place authorization before candidate retrieval.
- Make Role & Cycle context visible, editable, and removable in every contextualized answer.
- Route feedback to review, not directly to evaluation truth.
- Add external-review request and approved-export flows.
- Add accessible mobile behavior: focus order, keyboard operation, screen-reader names, reduced motion, touch targets, and bottom-sheet alternatives.

### LOGIC_TREES.md

- Replace all hardcoded BM25/vector thresholds with named, versioned configuration calibrated on the corpus.
- Remove restricted metadata stubs from query matching unless a security review proves a non-disclosing implementation. A safer default is complete exclusion.
- Replace global `GivingData > Drive > Airtable` priority. Authority is field-specific: GivingData may own grant status or payments; a signed report may own a narrative outcome; an approved decision record may own rationale.
- Add trees for role/cycle resolution, conflict presentation, account admission, access revocation, connector failure, prompt-injection quarantine, external-use review, and incident kill-switch behavior.
- Every branch needs an owner, event, output state, test, and safe fallback.

### WIREFRAMES.md

- Replace every real entity and personal email with obviously synthetic data.
- Add a persistent `Synthetic demonstration data` indicator in prototype mode.
- Remove withheld counts/categories and the direct external-use checkbox.
- Add a visible Role & Cycle lens with editable chips and “rerun without lens.”
- Add access-request, partial coverage, conflicting evidence, stale source, parsing quarantine, account-disabled, and review-required states.
- Make admin kill-switch activation require step-up, reason, confirmation, scope, and audit. A single casual button is unsafe.
- Do not render raw private query text in general admin logs; show redacted metadata with tightly restricted drill-down.
- Label a surface `built` only when the corresponding behavior—not just the screen—works.

### ROLE_AND_CYCLE_CONTEXT.md

- Replace named employees with role archetypes in the permanent product spec.
- Mark fiscal year, OKRs, board rhythm, reporting season, and owners `UNKNOWN` until confirmed. Public report publication dates do not prove internal operating windows.
- Store cycles as configurable records with time zone, recurrence/range, applicability, source, owner, confidence/status, and version.
- Let users confirm or override inferred context. Show the applied scope in the answer.
- Use verified assignments rather than job title to resolve “my grants.” Title may guide display defaults but cannot establish ownership or access.
- Evaluate whether the lens improves relevance without suppressing material evidence or reinforcing role-specific blind spots.

### SYSTEM_TOOLS.md

- Replace provider recommendations with capability requirements and architecture decision records until hosting is selected.
- Do not make domain-wide delegation the default. Begin with per-user delegated access or a narrowly approved shared-drive identity; use domain-wide delegation only after Workspace-admin and security approval.
- Avoid broad Admin Directory scopes unless exact-user admission and source ACL resolution genuinely require them.
- Prefer official Drive, GivingData, Airtable, and Zoom APIs/exports. MCP wrappers are optional adapters, never trust or permission authorities.
- Separate application login credentials from source-connector credentials and token stores.
- Add key rotation, revocation, webhook validation, change-token recovery, tombstones, connector backoff, dead-letter/quarantine handling, and restore testing.
- Benchmark local embeddings against managed embeddings before provisioning GPUs. A dedicated GPU is likely premature for this corpus.
- Add browser/PWA compatibility and accessibility tooling before committing to Expo/native apps.

### ROADMAP.md

- Expand beyond four phases: evidence foundation → data/access foundation → working vertical slice → security/reliability → source and role expansion → adoption/handoff → responsible scale.
- Keep timeboxes where they help the team drive a short turnaround, but label them as target planning windows with assumptions rather than promises.
- Pair every target window with an owner, dependencies, parallelizable work, acceptance evidence, forecast, actual finish, and variance.
- Use entry conditions, outputs, verification, exit criteria, and release decisions for each phase so a date never substitutes for readiness.
- Pull downstream work forward whenever its prerequisites pass; the plan is a launch rail, not a waiting schedule.
- Start the vertical slice with 5–10 gold questions; grow the set from reviewed real failures. Do not require 50–100 before learning starts.
- Replace “rerun until green” with capped attempts, budget, failure classification, owner, and escalation. Infinite loops can hide defects and create cost abuse.
- Do not mandate native apps or a chat bot in the final phase. Add a surface only when workflow evidence justifies it.
- Treat adoption as product work: design partners, training, office hours, documentation, support, source ownership, and change management.

### PRIOR_ART.md

Use a smaller shortlist:

1. Official source APIs and controlled exports.
2. PostgreSQL + pgvector as the initial relational/hybrid-search candidate.
3. Docling as the primary document-parser candidate; evaluate `pdf-inspector` as a fast routing/extraction candidate.
4. One evaluation/red-team tool plus the product's deterministic harness.
5. One model gateway/provider path under approved data terms.
6. A workflow framework only after a concrete orchestration requirement appears.

Remove or correct:

- The official MCP Google Drive example is archived, and the repository warns that reference servers are educational rather than production-ready.
- Do not describe LlamaIndex + LangGraph + RAGAS/promptfoo as “the 2026 production pattern.” It is one possible stack and may duplicate functionality.
- Do not call any project “the most serious” without decision-relevant evidence.
- Do not claim a vector-count comfort threshold without a corpus benchmark and query-plan evidence.
- Do not import community Airtable MCP code into a sensitive system without code review, scope review, dependency scanning, token-isolation tests, and a maintenance fallback.
- Verify model and code licenses at the exact pinned version; do not rely on a summary table.
- Hugging Face models are candidates, not free infrastructure. Account for serving, updates, privacy, latency, security, and operational ownership.

### CROSS_PLATFORM.md

- Keep the central rule that retrieval, permission, and answer logic remain server-side.
- Make responsive web the verified requirement. PWA installation and native clients are separate product decisions, not automatic phases.
- Remove the unsupported claim that a PWA covers 90% of mobile use cases; validate actual mobile tasks with users.
- Do not cache the last N answers on a device by default. Evidence briefs may contain confidential material. Set authenticated and evidence responses `Cache-Control: no-store`, prevent service-worker caching of API responses, and require an approved encrypted/offline policy before any local persistence.
- An offline shell may contain only nonsensitive static application assets and a clear disconnected state.
- Replace generic text-fragment citations with source-specific citation capabilities. Google Docs, Drive previews, PDFs, GivingData, and Airtable do not guarantee the same deep-link or highlighting behavior. Never place sensitive quoted text in a URL.
- Do not assume the source's native app will honor a web deep link. Provide `Open source` plus a human-readable page/section/record locator and copyable citation.
- For any later native client, use system browser-based OAuth/OIDC with PKCE and backend-issued sessions. Biometric unlock protects local access but does not replace server authorization, token expiry, or revocation.
- Upgrade the web accessibility requirement to WCAG 2.2 AA. Add zoom/reflow, screen-reader order, focus restoration for sheets/dialogs, reduced motion, target size, orientation, and accessible authentication/error behavior.
- Add responsive states for Role & Cycle chips, conflicting evidence, partial coverage, source freshness, and review-required exports.
- Verify design tokens against authoritative brand assets. Do not hardcode an inferred palette or font pairing as a product requirement.
- Test the smallest supported matrix based on actual Foundation devices and browsers; expand from evidence rather than listing every device size.
- A Slack/Zoom interface requires a separate privacy and authorization review because chat answers can be copied, retained, previewed, and exposed to channel membership changes.

### DATA_MODEL.md

The statement that Compass is a derived store and can rebuild its search layer is valuable. Preserve it, but revise the model substantially.

#### Identity and source lineage

- Use internal UUIDs for canonical entities. Do not use a GivingData ID as the `GRANT` primary key.
- Add `SOURCE_SYSTEM`, `SOURCE_ACCOUNT`, `SOURCE_OBJECT`, and `SOURCE_IDENTITY/CROSSWALK` tables so every entity may map to multiple source records without adding one column per vendor.
- Separate immutable/raw source envelopes from parsed documents and derived chunks. Store content hash, source version/revision, retrieval timestamp, deletion/tombstone status, parser version, and lineage.
- Model connector cursors, sync runs, failures, retries, quarantines, and change-feed recovery.

#### People, roles, assignments, and cycles

- Use Google OIDC `{issuer, sub}` as the stable user identity. Email and title are mutable attributes, not keys. `email localpart` is unsafe and collision-prone.
- Unify or clearly distinguish `PERSON` and `CONTACT`; add temporal `AFFILIATION` and `ASSIGNMENT` records rather than embedding `program_officer` as a string on `GRANT`.
- Add the missing `ROLE`, `RESPONSIBILITY`, `USER_ROLE_ASSIGNMENT`, `PORTFOLIO_ASSIGNMENT`, `CYCLE`, `CYCLE_PHASE`, `MILESTONE`, `DECISION_TYPE`, and `SAVED_LENS` entities.
- Give cycles exact start/end timestamps, time zone, recurrence or source, applicability, owner, status, and version. Role/cycle context remains separate from authorization.

#### Authorization and sensitivity

- Replace `tier + acl text[]` as the whole authorization model with normalized `ACCESS_PRINCIPAL`, `GROUP_MEMBERSHIP`, `RESOURCE_POLICY`, `POLICY_BINDING`, `POLICY_VERSION`, and `ENTITLEMENT_SNAPSHOT` structures.
- Represent user/group, inherited/direct access, role, expiry, revocation, source, and decision timestamp. Add explicit deny or conflict resolution if the selected policy model requires it.
- Store the permission snapshot/version used for each indexed object and answer so authorization decisions are explainable and revocable.
- Remove `restricted_stub` from the retrievable model by default. Titles, entities, and matching counts can disclose sensitive information.
- Avoid normalizing declined decisions, personnel topics, or sensitive rationales unless the approved use case and access policy explicitly require them.

#### Evidence, answers, and evaluation

- Add `QUERY`, `ANSWER`, `CLAIM`, `EVIDENCE_PASSAGE`, `CITATION`, `COVERAGE_RECORD`, `CONFLICT`, and `ABSTENTION` entities.
- A claim-to-evidence relationship must support multiple citations, contradiction, derived calculation, and reviewer status.
- Add `FEEDBACK`, `FEEDBACK_REVIEW`, `GOLD_QUESTION`, `EXPECTED_EVIDENCE`, `EVAL_RUN`, `EVAL_RESULT`, `SECURITY_TEST`, and `RELEASE_DECISION`. Raw feedback never edits gold truth directly.
- Add versioned prompt, model, embedder, parser, chunking, retrieval, reranking, and policy configuration references to builds and answers.

#### Metrics and money

- Replace the embedded `projected` JSON and simplified `REPORTED_OUTCOME` integers with typed `METRIC_DEFINITION`, `METRIC_OBSERVATION`, `MODEL_VERSION`, and `CALCULATION` records.
- Each observation needs value, unit, currency if applicable, estimate/observed status, period start/end, as-of timestamp, population/cohort, geography, methodology, attribution status, source, reviewer status, and model version.
- Store money as fixed-precision decimal or integer minor units plus ISO currency, never an ambiguous integer.
- Exact calculations must be reproducible and linked to inputs; the LLM explains them but does not silently calculate them from prose.

#### Authority, deletion, and audit

- Replace the global “system wins” map with a configurable, versioned `FIELD_AUTHORITY_POLICY` keyed by fact type, lifecycle state, effective period, and owner. An executed agreement may outrank an incorrectly entered GivingData field; an approved impact record may outrank an unvalidated narrative report.
- Compass must mirror source deletion, retention, and permission revocation in derived stores. “Source data never deleted by Compass” must not mean deleted source material survives indefinitely in raw snapshots, chunks, embeddings, backups, or caches.
- Define retention separately for raw objects, parsed content, embeddings, query metadata, feedback, audit records, backups, and device/browser caches.
- A hash chain in the same mutable database is not automatically tamper-proof. Use append-only database controls plus an independently protected/WORM sink, signatures or checkpoints as appropriate, access separation, and verification tests.
- Make audit events typed and minimized; raw queries and evidence text should not be routine fields.
- `tsvector` provides PostgreSQL full-text search; do not label it BM25 unless a selected extension or implementation actually supplies BM25 scoring.

#### Recommended ERD domains

Organize the revised ERD into six readable diagrams rather than one oversized diagram:

1. Canonical grants and organizations.
2. Source lineage, ingestion, versions, and deletion.
3. Identity, groups, policies, and entitlement snapshots.
4. Roles, responsibilities, assignments, cycles, and lenses.
5. Metrics, models, calculations, and evidence.
6. Queries, answers, claims, citations, feedback, evaluation, releases, and audit.

## Recommended target document set

Keep the ten documents, but add the missing connective tissue:

1. `PROJECT_OVERVIEW.md` — current truth and target outcome.
2. `PRD.md` — product requirements and acceptance criteria.
3. `USER_FLOWS.md` — role/task and failure journeys.
4. `LOGIC_TREES.md` — deterministic decisions and policy.
5. `WIREFRAMES.md` — responsive, accessible states using fictional data.
6. `ROLE_AND_CYCLE_CONTEXT.md` — configurable contextual relevance.
7. `TRD.md` — logical architecture and selected decisions.
8. `DATA_MODEL.md` / ERD suite — canonical entities, normalized policies, provenance, cycles, claims, evaluations, and audit.
9. `SYSTEM_TOOLS.md` — capability/credential inventory and provisioning gates.
10. `ROADMAP.md` — sequential implementation through responsible scale.
11. `SECURITY_AND_THREAT_MODEL.md` — Map, Attack, Harden, Monitor, Respond.
12. `EVALUATION_PLAN.md` — gold set, retrieval/citation tests, security tests, role-context tests, and promotion gates.
13. `TRACEABILITY_MATRIX.md` — requirement → design → code → test → evidence → status.
14. Architecture Decision Records — one file per consequential choice.
15. Runbooks — connectors, reindexing, account revocation, incident containment, rollback, and recovery.

## Suggested implementation sequence for the documentation

1. Correct the overview and create the traceability/status ledger.
2. Reconcile the PRD with the user flows and safe denial behavior.
3. Create the canonical data model and permission model.
4. Rewrite the logic trees using configurable policies and test references.
5. Revise wireframes with fictional data and complete states.
6. Rewrite the TRD as logical architecture plus explicit decision records.
7. Reduce prior art and system tools to vetted candidates.
8. Rewrite the roadmap around verified dependencies and full lifecycle gates.
9. Add security, evaluation, and operational runbooks.
10. Only then implement backend slices and change statuses when tests produce evidence.

## Research basis

- GitLab Foundation public strategy, impact, handbook, and CREDIT materials already cited in the Compass strategy brief.
- Google OpenID Connect: use `sub` as stable identity; verify `email_verified`; verify `hd` for Workspace organization; domain alone is not application authorization. <https://developers.google.com/identity/openid-connect/reference>
- Google Drive ACLs and permission inheritance: <https://developers.google.com/workspace/drive/api/guides/manage-sharing>
- Google Drive incremental change feed: <https://developers.google.com/workspace/drive/api/guides/manage-changes>
- MCP authorization: OAuth-oriented resource authorization, token audience validation, PKCE, and no token passthrough. <https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization>
- MCP reference servers: examples are not production-ready; Google Drive is archived. <https://github.com/modelcontextprotocol/servers>
- OWASP prompt-injection guidance: retrieved documents and external content are attack surfaces; use separation, least privilege, output validation, monitoring, and human review. <https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html>
- NIST AI Risk Management Framework and Generative AI Profile: <https://www.nist.gov/itl/ai-risk-management-framework>
- WCAG 2.2 Recommendation: <https://www.w3.org/TR/WCAG22/>
- Docling: <https://github.com/docling-project/docling>
- pgvector: <https://github.com/pgvector/pgvector>
- LangGraph human-review and durable execution capabilities, if later justified: <https://github.com/langchain-ai/langgraph>
- `pdf-inspector`, evaluated as a candidate rather than assumed dependency: <https://github.com/firecrawl/pdf-inspector>

## Bottom line

These documents should become Compass's durable product memory. Their value will come from truthfulness and traceability, not volume. The revised set should make it impossible to confuse a polished prototype with an implemented security boundary, an inferred Foundation process with a verified one, or an attractive framework with a justified architectural decision.
