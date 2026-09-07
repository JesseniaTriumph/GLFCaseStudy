# What we build now vs. what swaps in at handoff

The honest version of the "blockers." Almost nothing is actually blocked — it's *"do the
best version with what we have, and keep a precise list of what changes once the Foundation
provides X."* This is that list. The right column is a one-line config or connector change,
not a rebuild.

---

## Data

| Now | Swaps in when the Foundation provides… | Discovery question |
|---|---|---|
| A **5-year synthetic corpus** built from public research on the Foundation's shape (Form 990-PF: $14.2M / 61 grants, $50k–$2.9M, US 18 states + Colombia + Kenya, four funds, ~4% acceptance). `scripts/gen-corpus.ts` — ~70 grants, ~110 declined applicants, ~250 Drive docs, Zoom threads, with template drift, a migration boundary, duplicate orgs, conflicting figures, missing tags, Spanish reports, scans, planted PII. | The **real credentials** (`.env`). Each connector goes live the moment its key is present; the synthetic corpus is replaced by the real pull. | 1.3 — a Drive service account scoped to named Shared Drives; a GivingData read key or export; an Airtable read token |
| The **reconciliation report** (`npm run reconcile`) runs against the synthetic corpus and shows the shape of the dirt a real 5-year pull has. | The real backfill — same report, real numbers. | G14, D12 — was there a migration into GivingData / Drive, and what came over clean |
| **All entities fictional.** | Nothing changes — real data replaces fictional data behind the same pipeline. | — |

## The gold set

| Now | Swaps in | Discovery question |
|---|---|---|
| `eval/gold.json` (12) + `eval/gold-full.json` (10) — cases I wrote to exercise every behavior: retrieval, refusal, permission leak, conflict, PII, Spanish, Zoom, declined-applicant. The harness gates every change. | The **50–100 real questions** with verified answers, built *with* the Programs team in a working session. Same harness, real ground truth. | 1.7 — a 90-minute session to write the gold set; who verifies answers |

## The language model

| Now | Swaps in | Discovery question |
|---|---|---|
| **Extractive by default** — Compass returns the exact cited passages, no AI writing. $0 AI cost, no legal dependency. The `llm` interface is one function: *question + passages → written answer*. | A **generative backend** — set `ANTHROPIC_API_KEY` (or point the interface at OpenAI, or a model in the Foundation's own cloud). Under a zero-retention agreement the vendor keeps and trains on nothing; a self-hosted open model is zero-retention by construction. The architecture does not change. | X3 — the Foundation's written position on sending grantee/co-funder data to an AI vendor; is there an existing enterprise agreement, or does one need to be executed |

**Zero-retention detail:** it's normal procurement. Anthropic and OpenAI both offer it under
an enterprise agreement (the Foundation is paying for the model anyway); the standard
pay-as-you-go plan doesn't include it. If counsel wants no third parties at all, an open
model (Llama-class) runs in the Foundation's cloud — inherently zero-retention — at a
higher hosting cost (~$300–1,200/mo vs ~$50). Either way it's a setting.

## Cross-border data (Colombia, Kenya)

| Now | Swaps in | Discovery question |
|---|---|---|
| The PII pass **already strips and quarantines participant identifiers** at intake, so participant-level personal data from any geography never enters the index. Grantee reports are indexed with participant names held out. | Counsel's **written determination** that the residual (org-level, aggregate) content is acceptable to process, plus any per-geography handling rule (e.g. keep Colombia grantee content in a specific region). Compass supports geography-scoped exclusion via the tier/`never-ingest` list. | X5 — for Colombia/Kenya grantees, is there personal data in the reports, and has cross-border transfer been assessed; is a data-processing addendum needed |

**The point:** "depersonalize and role-gate" is exactly what the tier model + PII pass do.
It's not a wall — it's *this content, at this tier, for these groups*, the same pattern
used in the HOPE dashboard. The legal step is a sign-off on a design that already exists,
not a redesign.

## The sensitivity tiers, source-of-truth matrix, V1 corpus

| Now | Swaps in | Discovery question |
|---|---|---|
| All three **drafted** — `docs/TIER_POLICY.md`, `docs/SOURCE_OF_TRUTH_MATRIX.md`, `docs/V1_CORPUS_AND_METRIC.md`. | The **data owner's sign-off** (a name in the COO's office). A tier scheme I decided alone is a guess; their signature makes it a governance control. | 1.5, 1.6, X1 — who is the single data owner; confirm each tier and the `never-ingest` list |

## The penetration test

| Now | Swaps in | Discovery question |
|---|---|---|
| `npm run redteam` (16 adversarial cases — injection, jailbreak, exfiltration, PII) + the code-weakness review + `npm run ci` as a hard gate. | An **independent** firm's test and report. The value is that they're not me. You can line up the tester; it's a ~2-week engagement + remediation. | — (procurement, not discovery) |

## The infrastructure pieces

| Now | Swaps in | Discovery question |
|---|---|---|
| In-process rate limiter + session revocation; the `webhookSink` audit-stream hook; `secrets/` git-ignored. Compass runs, all tested. | **Redis** (rate limiter + revocation hold across replicas), a **KMS** (connector secrets), an **egress allowlist** (network policy), a **write-once bucket** (audit sink target). All are provisioned resources in the Foundation's cloud; the code already targets them behind an interface. | X2 — is Google Workspace the identity provider for everything; what's the cloud environment |

## The people-dependent steps

| Step | Now | At handoff |
|---|---|---|
| User interviews (1.1) | I researched documented program-officer pain points and mapped every function's questions (`docs/ROLES_AND_USERS.md`). | Confirm and correct with 3–5 real interviews. |
| Baseline timings (1.9) | `docs/templates/BASELINE_TIMING_SHEET.md` ready. | 2–3 partners time themselves on real tasks. |
| Design partners / onboarding / a named owner (2.10, 3.9, 4.6) | The runbook, incident playbooks, and training doc are written. | Assign the people. |
| The tabletop (4.8) | `docs/TABLETOP_EXERCISE.md` — full scenario written. | Run it once with the DRI, COO's office, and counsel. |

---

## The one thing that's a genuine calendar constraint

The **pen test** and the **legal agreement** take weeks regardless of build speed. Start
both the day the pilot is approved. Everything else is either done or a config change.
