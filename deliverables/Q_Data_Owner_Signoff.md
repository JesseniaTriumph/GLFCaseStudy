# Compass — data-owner sign-off packet

**For:** the data owner in the COO's office (the single accountable approver, discovery X1).
**Purpose:** the decisions Compass needs approved **before the first production sync**.
Everything here is drafted; this page is where you confirm or amend and sign.

Nothing enters a production index until this is signed. If a section needs changes, mark
it up — the drafts in `compass/docs/` get updated to match, not the other way round.

---

## 1 · The four sensitivity tiers

Full policy: `compass/docs/TIER_POLICY.md`. The decision you're approving:

| Tier | Who can retrieve it through Compass | Examples |
|---|---|---|
| **team** | any signed-in `@gitlabfoundation.org` staff | grant fact sheets, thesis memos, published outcomes, org profiles, most progress reports |
| **programs-only** | Programs, Impact, Executive, Donor Engagement, Finance / Grants-Ops | diligence memos, review scorecards, PO notes, the interaction log, candid viability assessments |
| **restricted** | **no one, through Compass** | board materials, staff compensation, legal/contract negotiation, **declined-applicant diligence**, any document naming individual program participants |
| **never-ingest** | — (a connector never even pulls it) | HR/personnel, anonymity-requesting donor records, anything a co-funder MOU bars from secondary use, anything counsel names |

**Points that need an explicit yes:**
- [ ] Declined-applicant diligence is **restricted** (not just programs-only). *Rationale: the Foundation's transparency commitments don't extend to organizations it chose not to fund.*
- [ ] Any document naming an individual program participant is **restricted** and, if the PII scan flags it, **leaves no metadata stub** (Compass won't even acknowledge it exists).
- [ ] A refusal on a restricted topic reveals **no count** and does not confirm a matching record exists.

_Amendments:_ ________________________________________________

## 2 · The `never-ingest` list

The named Shared Drives, Airtable bases, and GivingData record types a connector must
**never** touch. This has to be complete before the first sync — adding to it later means
a resync and a trust cost.

Proposed (fill in the real names in discovery step D5):

- [ ] Shared Drives: `Board/`, `HR/`, `Legal/`, `Compensation/`, `Personnel/` — and: __________
- [ ] Airtable bases: any donor/prospect base with anonymity requests — and: __________
- [ ] GivingData: __________ (record types, if any)
- [ ] Co-funder shared spaces (Ballmer Group / Annie E. Casey drives or portals) — **out**, confirmed: [ ]

_Amendments:_ ________________________________________________

## 3 · Source of truth per fact

Full matrix: `compass/docs/SOURCE_OF_TRUTH_MATRIX.md`. When two systems disagree Compass
**shows both and flags it** — this matrix only decides which one leads. The proposed
defaults:

- Grant amount / dates / status / fund → **GivingData**
- Projected impact (North Star, earnings delta) → **GivingData** (vintage-stamped)
- Reported / actual impact → **GivingData structured field if it exists, else the final report in Drive**
- Decision rationale → **the Drive diligence memo**, then GivingData review notes
- Org profile / contacts / relationship history → **Airtable**
- Headline impact figures (the public-dashboard numbers) → **the impact model / Tableau extract, not a copy in a memo**

- [ ] These defaults are approved, or amended as noted.

_Amendments:_ ________________________________________________

## 4 · The V1 corpus

Full definition: `compass/docs/V1_CORPUS_AND_METRIC.md`.

- [ ] **GivingData:** all grants/requests from the corpus start date (the later of 2022-01-01 or the GivingData migration date: __________).
- [ ] **Google Drive:** these 2–3 named Shared Drives only: __________________________ . Personal `My Drive` excluded.
- [ ] **Airtable:** the one canonical "Relationships" base: __________ , grantee/co-funder/partner records only.
- [ ] **Not in V1** (Compass says so on every answer): pre-start-date grants, personal drives, Zoom Chat, email, board/HR/compensation/legal, participant data, un-tagged historical grants. **Zoom Chat stays deferred** pending the retention + privacy review.
- [ ] The **6-month success metric** is: ________________________________________ (agreed with the COO and Chief Programs & Partnerships Officer).

_Amendments:_ ________________________________________________

## 5 · Access model

- [ ] Compass signs users in with **Google (OIDC)** and reads permission groups from a
  **read-only Admin SDK Directory** lookup. The service account is scoped to
  `admin.directory.group.readonly` (+ `.user.readonly`) — no write, no broad read.
- [ ] The Google Groups that map to `programs-only`: ________________________________
  (everyone else gets `team` only).
- [ ] Deactivating a staff account **must** also fire `POST /admin/revoke` (or the nightly
  active-check catches it within a day). Owner of that wiring: __________
- [ ] Compass is **read-only** against every source system. Confirmed: [ ]

_Amendments:_ ________________________________________________

## 6 · Generative answers (optional, later)

- [ ] For now Compass runs **extractive** — cited source passages, **no external AI model**,
  nothing to sign. This is the default.
- [ ] Turning on written synthesis requires an executed **zero-retention + no-training
  agreement + DPA** with the LLM vendor (or a self-hosted model). Not needed for launch.

---

## Sign-off

By signing, I approve sections 1–5 as marked (with any amendments noted above) as the
basis for the first production sync of Compass. Section 6 is acknowledged, not required.

**Name:** ______________________  **Role:** ______________________

**Signature:** ______________________  **Date:** ____________

_Countersigned (project lead):_ ______________________  **Date:** ____________
