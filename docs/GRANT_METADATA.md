# How Compass assesses every important grant fact

"Where does Compass get the cadence, the term, the end date, the renewal window?" — and
what it does when the data isn't there.

**The rule:** Compass reads a fact from a source of record, or derives it from data that is
recorded, or says it doesn't have it. It never invents a value and presents it as fact.

---

## Every fact, its source, and the fallback

| Fact | Primary source | How Compass gets it | If it's missing |
|---|---|---|---|
| **Amount, currency** | GivingData grant record | direct field | gap report: "grant amount not recorded" |
| **Start / end date, status** | GivingData grant record | direct field | can't compute the term or renewal window; says so |
| **Term (years)** | GivingData, or `end − start` | field if present, else computed from the dates | computed silently when both dates exist |
| **Reporting cadence** (quarterly / semi-annual / annual / biennial / final-only) | GivingData `reporting_frequency` field **if it exists** | `grantMeta.reportingFrequency` | **inferred** from the median spacing of the progress-report requirements (`inferCadence` in `src/grant-cycle.ts`) — labelled *"inferred from N requirements"*, never shown as authoritative |
| **Report period basis** (grant-year / calendar / fiscal) | GivingData field | direct | assumed *grant-year*, labelled *"assumed — not recorded"* |
| **The requirement schedule** (what's due, when) | GivingData Requirements | direct — this is the ground truth for "what's due" and "what's overdue" | Compass cannot answer "what's due for this grant"; the coverage line says the schedule isn't loaded |
| **What's overdue** | derived: a requirement past its due date whose status isn't received/waived/n-a | `grantCycle()` | — (always derivable from the schedule) |
| **Next deadline** | derived: soonest unmet requirement | `grantCycle()` | — |
| **Renewal window** | derived: `end date − renewalLeadDays` (default 120, configurable) | `grantCycle()` | — (derivable whenever the end date exists) |
| **Renewal / re-application deadline** | a GivingData requirement of type "Renewal LOI" / "Continuation" **if the Foundation tracks one** | direct | Compass says *"no re-application deadline on file — confirm with the fund"* rather than guessing |
| **Projected impact** (North Star, earnings delta, participants) | GivingData custom fields | `grantMeta.projected` | *"projection not recorded"* (common for pre-migration grants) |
| **Reported outcomes** | GivingData structured field, **or** the report document in Drive | both, with the source-of-truth rule (`docs/SOURCE_OF_TRUTH_MATRIX.md`); conflicts are **shown, not merged** | gap report: "no reported results for this grant" |
| **Thesis area / geography** | GivingData tags | direct | *"untagged"* flag; the grant is excluded from "everything we funded in X" and the gap report lists it |
| **Co-funders** | GivingData field | direct | assumed none |
| **Program officer / relationship owner** | GivingData / Airtable | direct | — |
| **Relationship history** | Airtable interaction log | direct, dated | *"interaction log is sparse for this grantee"* |

---

## Cadence inference — worked example

A grant's GivingData record has no `reporting_frequency` field, but its Requirements list:

```
Q1 Y1 progress report  due 2024-12-06
Q2 Y1 progress report  due 2025-03-06
Q3 Y1 progress report  due 2025-06-06
Q4 Y1 progress report  due 2025-09-06
```

`inferCadence()` takes the report requirements, computes the gap between consecutive due
dates (~90 days each), takes the median, and maps it: ≤130d → **quarterly**, ≤240d →
semi-annual, ≤460d → annual, else biennial. The Deep-dive shows:

> *"quarterly reporting (inferred from 4 requirements), 2-year term"*

The word **inferred** is always there. If the Foundation later adds an explicit field, it
takes over and the label changes to nothing (recorded).

---

## The validation layer

`npm run reconcile` checks the grant metadata makes sense before a production index is
promoted:

- report due dates fall **within the grant term**
- the cadence is **consistent** (no grant with three quarterly reports then a five-year gap)
- every grant has a **thesis tag** (or is on the untagged list)
- every grant links to an **organization** (or is on the review queue)
- the same figure isn't **stated differently** in two sources for the same grant

A "clean" reconciliation report is a Phase 3 exit criterion (`docs/ROADMAP.md`).

---

## What this means for discovery

The one field that most changes the quality of the cycle logic is **`reporting_frequency`
in GivingData** (question G9). If it exists and is filled in, Compass reads it. If it
doesn't, Compass infers it from the schedule and labels every inference — which is usable,
but the Foundation should know the difference. The discovery session confirms:

- Is there a `reporting_frequency` / `reporting_cadence` field, and how full is it?
- Is the reporting period the grant year, calendar year, or fiscal year — a field, or a convention?
- Do you track a re-application / renewal LOI deadline as a requirement, or is it informal?
- Is the renewal lead time uniform (Compass defaults to 120 days) or fund-specific?
