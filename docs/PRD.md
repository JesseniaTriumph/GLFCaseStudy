# Compass — Product Requirements Document

**Status:** MVP in build · **Owner:** Jessenia Cintron · **Last updated:** 2026-09-07

---

## 1. Problem (5 Whys)

**A GitLab Foundation Programs team member can't get a straight answer out of five years of grant history.**

1. *Why?* The knowledge is spread across Google Drive, GivingData, Airtable, and Zoom Chat with no single source of truth.
2. *Why does that block them?* Each system answers a different slice (Drive = narrative/why, GivingData = terms/outcomes, Airtable = relationships, Zoom = decisions) and nothing joins them to the same grant.
3. *Why not just search each one?* Search returns documents, not answers, and can't reason across systems or across a five-year reporting-template drift. It also can't tell you what it *didn't* find.
4. *Why does that matter here specifically?* The Foundation's entire brand is measurement rigor ("$193 in lifetime earnings per $1"). A wrong or made-up number in a board deck or co-funder report is a credibility hit; their own values name "juicing models / hiding negative outcomes" as the anti-pattern.
5. *Why is now the moment?* They're moving from grantmaking to a "platform for high-impact philanthropy" with knowledge products, and exploring a product/eng function. Institutional memory is the raw material.

**Root problem:** there is no trustworthy, permission-aware way to ask grant knowledge a question and get a cited answer.

---

## 2. Goal & non-goals

**Goal:** a Programs/Impact team member types a question and gets an answer grounded in the Foundation's own records, with a citation on every claim, an honest statement of what was and wasn't searched, and a refusal when support is thin — enforced so it can never surface content the asker isn't entitled to.

**Non-goals (v1):**
- Not an autonomous agent that takes actions or makes grant decisions. Read-only Q&A.
- Not a BI tool. The Foundation has Tableau for dashboards.
- Not a system of record. Compass references records; it never writes to a source.
- Not org-wide on day one. Programs + Impact, 3–5 design partners first.
- Not conversational memory in v1 — single-turn Q&A by design (simpler to evaluate for correctness and leaks; session context is v2).
- Not Zoom Chat in v1 (privacy, retention, low structured value — deferred).

---

## 3. Users & personas

| Persona | Who | Top job | Success looks like |
|---|---|---|---|
| **Program Officer** (primary — the program officer's org) | Owns a grant portfolio | "How did this grantee do vs. what they projected, and what did we flag?" before a renewal call | Answers a renewal question in minutes with sources, not an afternoon of digging |
| **Impact Analyst** (the Director of Impact's org) | Owns measurement | "Pull every reported outcome for the AI Fund cohort, with the source for each number" | Assembles a board/donor figure set she trusts without re-verifying each one |
| **New hire / coordinator** | Ramping | "What's our history with this org? Did we ever decline them?" | Comes up to speed on 5 years in weeks, not months |
| **Compass admin** (data owner / DRI) | COO's office | Configure the corpus, approve tier changes | Can see exactly what's indexed and who queried what |

---

## 4. Use cases that create urgency

1. **Renewal decision** — performance vs. projection + the program officer's concerns, in one place, cited.
2. **Board / co-funder prep** — a set of outcome figures with a source link for each, watermarked "verify before external use."
3. **Sourcing & diligence** — "have we funded anything in X? what did we learn, and who did we talk to?"
4. **Portfolio synthesis** — "what have grantees told us are the barriers to credential completion?" across many reports.
5. **Avoiding rework** — "did we already decide not to fund this org, and why?"

---

## 5. Functional requirements

### 5.1 Ask
- FR-1 A signed-in user submits a natural-language question.
- FR-2 The system retrieves only passages the user is entitled to read (tier + ACL), then answers **only** from what it retrieved.
- FR-3 Every claim in the answer carries a numbered citation that deep-links to the exact passage in the source system, with it highlighted, plus a human-readable locator ("§ Wage outcomes").
- FR-4 Every answer shows a **coverage line**: the systems and date range searched, and what was not searched.
- FR-5 The answer shows a **confidence** signal (high / medium / low / refused) with a one-line reason.
- FR-6 When retrieval support is weak, or the topic requires `Restricted` content, the system **refuses** and says why — it never guesses.
- FR-7 If matching content was withheld (permission or restricted tier), the answer says how many passages and which tier.
- FR-8 The user can mark an answer "for external use," which shows a "verify each figure against its source" banner and flags it in the log.
- FR-9 Feedback control on every answer (useful / wrong-because), feeding the evaluation set.

### 5.2 Toggleable features (off by default, per user, preference persists)

**Deep dive** — a panel *beside* the answer (never inside it):
- FR-10 Surfaces: what would sharpen the answer (missing report, no reported results yet, single-system answer, restricted withheld), who to ask (people associated with the grants involved — program officer, relationship owner, note author, call attendees), suggested questions, and a draft email when there's one clear recipient.
- FR-11 The user can turn Deep dive off; the preference persists.

**Role & cycle context** — see `ROLE_AND_CYCLE_CONTEXT.md`:
- FR-11a When on, Compass resolves relative references ("my grantees", "this quarter", "before the board") using the asker's role and a calendar config, and **states the scoping it applied** in the coverage line.
- FR-11b Role and calendar are relevance signals only — never part of the permission filter.
- FR-11c Off by default; one click to toggle; preference persists.

### 5.3 Grantee dossier
- FR-12 A structured view of one organization assembled from all connected systems: grants, projected vs. reported outcomes, key contacts, decision/reporting timeline, open questions — every line cited to its source.
- FR-13 Conflicting values across systems are flagged, not silently merged.

### 5.4 Ingestion & data quality
- FR-14 Each source is pulled by a connector implementing one interface; sync is incremental.
- FR-15 Text extraction produces a confidence score; low-confidence items are quarantined, not indexed as clean.
- FR-16 De-duplication across exact, near, and cross-system copies; the authoritative copy is kept, others linked; merges are logged and reversible.
- FR-17 Every grant is reconciled against the GivingData spine; expected-but-missing artifacts appear on a **gap report**.
- FR-18 Entity resolution joins documents to canonical Grant / Organization / Fund / Person; low-confidence merges go to a review queue.
- FR-19 A PII pass at intake redacts or tier-raises participant identifiers and personal contact data; participant identifiers are not indexed in v1.
- FR-20 `Restricted`-tier content is excluded from the index; a metadata-only stub records that a document on the topic exists.
- FR-21 Each build records a manifest (code commit + content digest + per-source counts).

### 5.5 Identity, permission, audit
- FR-22 Sign-in is OIDC via Google Workspace; no local passwords; MFA inherited.
- FR-23 A user's tier/record entitlements are derived from Google Groups, re-synced on login and nightly.
- FR-24 The permission check runs at retrieval time, per passage — not in the UI.
- FR-25 Every query, ingestion run, and admin action is written to an append-only, tamper-evident (hash-chained) audit log.
- FR-26 Admin actions require step-up re-auth; a tier downgrade requires two-person approval.
- FR-27 A kill switch disables retrieval and answers while leaving sources untouched.

### 5.6 Evaluation
- FR-28 A gold Q&A set (50–100 real questions, verified answers + expected sources) gates every release.
- FR-29 Tracked: retrieval hit-rate, citation correctness, refusal calibration, **permission-leak** (hard fail), latency, cost/query.
- FR-30 A scheduled permission red-team runs before every corpus or user-base expansion.

---

## 6. Non-functional requirements

| Area | Target (v1) |
|---|---|
| Latency | Lookup < 3 s; synthesis < 8 s (p90) |
| Cost | < $0.05 / lookup, < $0.20 / synthesis (retrieval-only fallback is free) |
| Availability | 99% business hours; a kill switch and graceful degradation to extractive answers |
| Security | See §6 of the strategy doc and `docs/../SECURITY.md`; production is BLOCKED until the security review's 6 items close |
| Accessibility | WCAG 2.1 AA on every surface |
| Privacy | No participant PII in the index or logs; US processing; CO/KE transfer review before those geographies |
| Portability | Web, iOS, Android — see `docs/CROSS_PLATFORM.md` |
| Handoff | Managed services over bespoke infra; runbook + this doc set; a named internal owner before the fellowship midpoint |

---

## 7. Success metrics

- **Adoption:** ≥ 60% of the Programs + Impact team querying weekly by end of the fellowship.
- **Trust:** design partners report they *stop re-verifying every answer* (survey + observed behavior).
- **Time:** the renewal-prep task drops from hours to minutes (before/after timing with 3 partners).
- **Zero** permission-leak findings in the standing red-team.
- **A decision that went better** because the history was at hand (qualitative, captured monthly).

## 8. Open questions (resolved in discovery — see `E_Discovery_Questions.md`)

Corpus scope; GivingData API availability; which Airtable bases; the sensitivity-tier scheme; the data owner; whether a web app is acceptable for v1 or it must live in GivingData/Slack.
