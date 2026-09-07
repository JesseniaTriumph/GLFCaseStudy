# Compass — two-minute technical demo

For the follow-up questions / Q&A, when someone asks *"is the permission boundary real, or
is it a UI concept?"* This is the answer. All data is synthetic and fictional.

---

## Option A — the web app (screen-share)

`npm run web:dev`, then:

1. **Ask a normal question.** Click *"How did Riverbend Care Collective perform against
   what they projected…"*.
   → An **evidence brief**: the claim, `[1] [2] [3]` citations, a **coverage line**
   ("Searched GivingData 2022–26, 3 Shared Drives, Airtable. Not covered: …"), and a
   confidence read that describes *evidence strength, not the model's certainty*.
   → Click a citation `[n]` — it jumps to the exact passage in the right-hand rail, with
   the "opens in {system}, this passage highlighted" affordance.

2. **Turn on Deep dive** (toggle). Same answer now also shows: what would sharpen it (no
   Year-2 report yet), **who to ask** (the program officer on that grant, pulled from the
   entity graph), suggested questions, and a draft email — kept *separate* from the answer.

3. **Switch the persona** (top-right) from *Program Officer* to *Comms (outside
   Programs/Impact)* and re-ask *"Did we decline an AI-upskilling applicant?"*
   → **Refused.** "N passages match this question but sit outside what you can retrieve
   here." The Program Officer gets the answer; Comms does not. **Same query, different
   principal, enforced at retrieval.**

4. **Ask *"What did the board discuss about staff compensation?"*** as anyone.
   → **Refused.** "This would require Restricted material (board / compensation / legal).
   That content is not indexed." The board-comp document exists in the corpus — Compass
   keeps a metadata-only stub so it can *say* it's restricted, but the content is never
   loaded into the index. A retrieval bug or a crafted prompt cannot reach what isn't
   there.

---

## Option B — the terminal (strongest for a technical panel)

```bash
npm run eval
```
```
✓  riverbend-vs-projection             refusal:ok   retrieval:ok   leak:none
✓  credential-barriers-synthesis       refusal:ok   retrieval:ok   leak:none
✓  advanced-energy-existence           refusal:ok   retrieval:ok   leak:none
✓  declined-ai-upskilling              refusal:ok   retrieval:ok   leak:none
✓  board-compensation-restricted       refusal:ok   retrieval:ok   leak:none
✓  declined-applicant-wrong-persona    refusal:ok   retrieval:ok   leak:none
✓  adabridge-employment-gap            refusal:ok   retrieval:ok   leak:none
✓  riverbend-cofunder                  refusal:ok   retrieval:ok   leak:none

8/8 cases pass · 0 leakage findings
```
Two of those cases (`board-compensation-restricted`, `declined-applicant-wrong-persona`)
are **negative tests**: they assert that a named document *must not* appear in the answer.
A leak is a hard fail — the run exits non-zero and would block a deploy.

```bash
npm run security
```
```
✓  valid ID token verifies
✓  maps to the right Principal  — tiers: team, programs-only
✓  tampered token is rejected (bad signature)
✓  account outside gitlabfoundation.org is rejected (hd claim)
✓  expired token is rejected
✓  audit chain verifies when intact
✓  tampering with a past entry is detected  — broken at seq 1: entry hash does not match its contents

7/7 security checks pass
```
Real RS256 verification against a test keypair (`src/security/auth.ts`), and a hash-chained
audit log where editing any past entry breaks the chain (`src/security/audit.ts`).

```bash
npm run build:index
```
Shows the data-quality pipeline: a cross-system duplicate detected and folded to the
authoritative copy, the entity graph joining 11 documents across grant↔org, and the **gap
report** — "GD-1301: Baseline report — OVERDUE" — because reconciliation against the grant
spine makes missing data *visible* instead of silent.

---

## The three sentences to say

1. *"The value isn't the model — it's connecting four messy sources, resolving them to the
   same grants, and enforcing who can see what. The model phrases; it doesn't decide."*
2. *"The permission check runs at retrieval, per passage, before anything reaches the
   model — and there's a test that fails the build if a restricted document ever leaks."*
3. *"Restricted content isn't access-gated in the index — it's not in the index at all. A
   bug can't leak what isn't there."*
