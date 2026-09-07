# Compass — Role & Cycle Context

**The same question means different things depending on who is asking and when.**
"How are my grantees doing?" from a program officer in renewal season is a portfolio +
performance-vs-projection question scoped to *their* grants and *this* quarter's reports.
The same words from the Director of Impact in April is an outcome-completeness question
for the annual report. Compass treats **role** and **calendar position** as relevance
signals (never as permissions — permission is tiers + ACL).

---

## 1. The Foundation's cycles

| Cycle | Rhythm | Why it matters to a query |
|---|---|---|
| **Fiscal year** | ~Feb–Jan; FY impact report published in spring | "this FY" vs "last FY"; whether a figure is on the current North Star model version |
| **Quarterly OKRs** | Q1–Q4 | "what's due / at risk this quarter"; progress against goals |
| **Board meetings** | ~quarterly | "board prep" season — outcome figure sets, portfolio health narrative |
| **Grant reporting** | per grant: proposal → interim / annual progress → final | "reports due / overdue"; renewal windows |
| **Renewal & continuation** | rolling, per grant term | performance vs projection + prior flags, *before* the decision |
| **RFP windows** | a few topical open RFPs / year, per fund | intake → review → decide seasons; "have we seen this applicant before" |
| **Fund cohorts** (esp. AI for Economic Opportunity) | applications → selection → ~6-month program (OpenAI support) → learning/scaling | "cohort N status"; cross-cohort synthesis |
| **Annual impact report** | production ~Q4→spring | outcome-data completeness; model re-basing; shareable learnings |
| **Grantee measurement fund** ($50k) | application cycle | who applied, what capacity gaps |
| **Finance** | quarterly close; annual audit; budget season | committed vs disbursed; expenditure-responsibility docs |

Compass keeps a small **calendar config** (admin-maintained, or derived from GivingData
requirement due dates + a few fixed dates): current FY + quarter, board dates, per-fund
RFP windows, cohort definitions, impact-report deadline, audit window.

---

## 2. Roles → what they track → peak season

Role is derived from the Google directory (title) and group membership — a *signal*, not a
gate.

| Role (person) | Owns | Peak season | Questions Compass should interpret in their favor |
|---|---|---|---|
| **Program Officer** | a grant portfolio | renewal windows; pre-check-in; pre-board | "my grants with reports due/overdue this quarter"; "performance vs projection for [grantee] before this renewal"; "what did I flag last cycle"; "which renewals are in the next 60 days" |
| **Chief Programs & Partnerships Officer** | whole portfolio + partnerships | pre-board; annual strategy; co-funder syncs | "portfolio: how many grants above/below the 100× threshold this FY"; "co-funded cohort status for the co-funder sync"; "which thesis areas are under-evidenced" |
| **Director of Impact** | measurement, the North Star model | impact-report season (spring); pre-board; model updates | "every reported outcome for cohort X, with a source for each"; "grants still reporting on an older model version"; "outcome-data gaps before the report deadline" |
| **Impact Modeling / Measurement** | ROI models, grantee data | grantee reporting deadlines | "grantees who haven't submitted the data the model needs"; Colombia-specific — Spanish-language reports |
| **Impact Advisory Services** | helping other funders | client engagements | "learnings / case studies we can share externally" (shareable-tier only) |
| **Partnerships Manager** | co-funders, RFP partners | RFP launches; fund close | "co-funding committed vs mobilized this cycle"; "partner history with [org]" |
| **Program Coordinator** | grant ops, scheduling | RFP intake; report-chasing | "everything overdue and who owns chasing it"; "onboarding checklist for the new cohort" |
| **Grants Manager** | GivingData, compliance | payment cycles; audit; year-end | "expenditure-responsibility docs outstanding"; "payments scheduled vs paid this quarter" |
| **CFO / Controller** | budget, 990s, audit | audit; budget season; quarterly close | grant $ committed vs disbursed (financial tier) |
| **Leadership** | direction, ops | board; annual planning | "portfolio health at a glance"; "the story for the board"; "where are we against the North Star" |
| **New hire** | ramping | first 90 days | "our full history with [org]"; "why did we decide [X]"; "what's the current thesis on [area]" |

---

## 3. How Compass uses this

**This is a toggleable feature — "Role & cycle context" — off by default, per user, like
Deep dive.** With it off, Compass answers the literal question over the full corpus the
user may see. With it on, Compass resolves "my", "this quarter", "before the board", etc.
using the asker's role and the calendar, and always *states the scoping it applied* in the
coverage line so the user can see (and trust) what it did. Turning it off is one click and
the preference persists.

1. **Query scoping.** When a query contains a possessive or a relative time ("my
   grantees", "this quarter", "before the board meeting"), Compass resolves it using the
   asker's role + the calendar config: "my" → the grants where they're the program
   officer / relationship owner; "this quarter" → the current OKR quarter's date range;
   "before the board" → items due before the next board date. The resolution is **shown**
   in the coverage line ("Scoped to your 6 active grants; reports due this quarter (Q4)").
2. **Grant lifecycle stage.** Each grant carries a derived `lifecycle_stage`
   (pre-award / Y1 reporting / interim / **renewal window** / closing / closed) from its
   dates + requirement status. The dossier shows it; answers use it ("this grant enters
   its renewal window in March").
3. **Vintage + season on figures.** Already: "as reported on {date} using model {version}".
   Added: "this figure predates the current FY model — flagged for re-basing before the
   FY26 report" when the calendar says report season and the model version is stale.
4. **Deep dive routing respects role.** A measurement question routes "who to ask" to the
   Impact team; a relationship question to the relationship owner; an ops/overdue question
   to the coordinator or Grants Manager.
5. **Proactive brief (v2, opt-in).** A role- and season-aware "what you might want to look
   at this week", still pure retrieval:
   - Program Officer, renewal season → "3 renewals in the next 60 days; performance-vs-projection for each, cited."
   - Director of Impact, report season → "cohort 2: 4 of 16 grantees missing the outcome fields the model needs."
   - Coordinator, RFP window → "RFP closes Friday; 12 submissions in; 3 are repeat applicants — here's our prior history."

---

## 4. Data-model additions (see `DATA_MODEL.md`)

```
ROLE            derived  {program-officer | impact | modeling | partnerships |
                          coordinator | grants-manager | advisory | leadership | new-hire}
CALENDAR        config   { fiscal_year, quarter, board_dates[], rfp_windows[per fund],
                           cohort_defs[per fund], impact_report_deadline, audit_window }
GRANT.lifecycle_stage  derived from start/end dates + requirement statuses
GRANT.cohort           e.g. "AI4EO cohort 3"
REQUIREMENT.quarter    derived — which OKR quarter the due date falls in
```

Role and calendar are **not** in the permission filter. They change *what a question is
taken to mean* and *what's surfaced first* — never *what a person is allowed to see*.
