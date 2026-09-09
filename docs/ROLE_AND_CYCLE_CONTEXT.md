# Compass — Role & Cycle Context

**Not a permission gate.** Nonprofit staff wear many hats — a coordinator drafts a board
memo, a program officer chases a payment, the COO asks a portfolio question, the
Entrepreneur-in-Residence needs a grantee's SROI story for a donor call. Permission is
handled separately and strictly (sensitivity tiers + source ACLs — `docs/LOGIC_TREES.md` §2).

This is **relevance logic**: which questions a given *function* tends to bring to grant
knowledge, and how those questions shift across the Foundation's *calendar*. Compass uses
it to (a) suggest questions, (b) interpret ambiguous ones, (c) order what surfaces first,
and (d) route "who to ask" in Deep dive. It is a **toggleable feature** — off by default,
per user — and any scoping it applies is always stated in the coverage line. With it off,
Compass answers the literal question over everything the user may see.

**Anyone can ask anything.** Function only changes the defaults and the suggestions.

---

## 1. The Foundation runs three business lines now — not one

Public hiring over 2022–2026 shows the org evolving from a grantmaker into a *platform for
high-impact philanthropy*. Compass has to serve all of it:

| Line | What it does | Roles (public team + recent postings) |
|---|---|---|
| **Grantmaking** | Deploys the Foundation's own capital | Chief Programs & Partnerships Officer; Senior Program Officer; Program Officer *(hiring)*; Program Coordinator |
| **Collaborative capital / donor engagement** | Mobilizes *other people's* capital into high-SROI projects (co-funding, donor advising) | Entrepreneur-in-Residence — "leads a new donor engagement initiative"; Director, Donor Experience & Stewardship *(hiring, reports to the EIR)*; Partnerships Manager |
| **Impact advisory** | A *consulting practice* selling impact modeling & measurement to other philanthropic and investor clients | Director / Manager of Impact Advisory Services; Impact Modeling team |
| **Knowledge & intelligence products** *(emerging)* | Tools and reusable capability for the Foundation and the wider sector | **Applied AI Fellow** *(this role)*; Impact Modeling Analyst *(hiring)*; the EIR |

Supporting every line:

| Function | Roles | Owns |
|---|---|---|
| **Executive & governance** | President & CEO; COO; EA to the CEO; the Board (Exec Chair, Board Chair, + a co-funder finance lead) | Direction, sequencing, org health, board reporting, the approvals matrix |
| **Impact** | Director of Impact; Senior Manager + Manager of Impact Modeling & Measurement (one likely covering LatAm / Spanish-language grantees); Senior Analyst | The North Star model, ROI models (230+ since 2023), monitoring & evaluation, learnings tracking |
| **Finance & Grants Operations** | CFO; Controller; Grants Manager; Operations Coordinator | GivingData as system of record, payments, budgets, 990s, audit, expenditure responsibility |
| **Communications** | Director of Communications and Marketing | External narrative, the FY impact report, grantee announcements, the public handbook |

Compass derives a person's **function** from their Google directory title + group
membership. It is a signal, never a lock — and a person can carry more than one.

---

## 2. The Foundation's calendar

Modeled on GitLab Inc.: **fiscal year runs Feb 1 – Jan 31.** FY2026 = Feb 2025 – Jan 2026.

| Cycle | When | What it drives |
|---|---|---|
| **Fiscal quarters** | Q1 Feb–Apr · Q2 May–Jul · Q3 Aug–Oct · Q4 Nov–Jan | Quarterly OKRs; "what's due / at risk this quarter" |
| **FY impact report** | Produced through Q4 → published ~May (the FY26 report landed May 2026) | Outcome-data completeness push; North Star model re-basing; shareable-learnings selection |
| **Board meetings** | ~quarterly | Board-prep windows — portfolio-health narrative, an outcome figure set with a source for every number |
| **Annual audit + 990** | Post-Q4 close, ~Feb–Apr | Expenditure-responsibility documentation; payments reconciliation; financial-tier questions |
| **Budget & 3-year plan** | Q3–Q4 | Next-FY portfolio shape; where to concentrate |
| **Open RFP windows** | A few topical RFPs per year, per fund | Intake → review → decision seasons; "have we seen this applicant / intervention before" |
| **Fund cohorts** (esp. AI for Economic Opportunity) | Applications → selection → ~6-month program → learning/scaling | "Cohort N status"; cross-cohort synthesis; alumni follow-up |
| **Grant lifecycle** (per grant) | Proposal → interim/annual reports → final report; renewal window near term end | "Reports due / overdue"; performance-vs-projection before a renewal |
| **Donor cultivation** | Rolling, quarter-driven | "Which grants have the strongest SROI story for a donor conversation right now" |
| **Grantee Measurement & Feedback Fund** ($50k top-ups) | Application cycle | Which grantees have measurement-capacity gaps |

Compass keeps a small **calendar config** (admin-maintained + dates derived from GivingData
requirement due-dates): current FY + quarter, board dates, RFP windows per fund, cohort
definitions, impact-report deadline, audit window.

---

## 3. What each function brings to grant knowledge

Stable "jobs to be done" against Compass, and the season each spikes.

### Executive & governance
- *Any time:* "Where are we against the North Star this FY?" · "One-paragraph story on [thesis area]."
- *Board-prep window:* "Portfolio health at a glance — how many grants above / below their ROI threshold, and which are off-track?" · "An outcome figure set for [fund], every number cited and dated."
- *Planning (Q3–Q4):* "Across five years, which thesis areas have the strongest evidence, and which are thin?" · "What have we learned about [intervention] that should shape next FY?"

### Programs & Partnerships
- *Before any grantee check-in:* "What did we last flag on [grantee]? What's changed since?"
- *Renewal window:* "How did [grantee] perform against what they projected — and what did the program officer note?" · "Which of my grants have renewals in the next 60 days?"
- *Quarterly:* "Which of my grants have reports due or overdue this quarter?"
- *Sourcing / RFP season:* "Have we ever funded anything in [space]? What did we learn, and who did we talk to?" · "Did we already decline [org], and why?"
- *Co-funder syncs:* "Cohort status for the [co-funder] collaboration." · "Our full history with [partner org]."

### Collaborative capital / donor engagement (EIR, Donor Experience)
- *Rolling:* "Which active grants have the cleanest, best-evidenced SROI story — cleared for external use?"
- "What's the pipeline of high-SROI projects a donor could co-fund in [thesis area]?"
- "For [donor]'s interests, which grantees match, and what's our track record with them?"
- *Pre-donor-meeting:* "Give me a one-pager on [grantee] I could share externally — outcomes, caveats on period and model, the human story."

### Impact
- *Impact-report season (Q4 → May):* "For [cohort], which grantees are missing the outcome fields the model needs?" · "Which grants still report on an older North Star model version and need re-basing?" · "Every reported outcome for [fund], with a source and a date."
- *Any time:* "Where do a grantee's narrative results and their structured GivingData numbers disagree?" · "Estimated vs. actual — which projected outcomes now have observed evidence?"
- *Advisory engagements:* "Which learnings, ROI models, and case studies are cleared to share with an advisory client?" (shareable-tier only)
- *LatAm coverage:* "What are the Colombia grantees reporting that isn't in the English synthesis?"

### Finance & Grants Operations
- *Payment cycles / quarterly close:* "Which grants have payments scheduled but not yet paid this quarter?" · "Any payments on hold, and why?"
- *Audit season:* "Which grants require expenditure-responsibility documentation, and which are outstanding?"
- *Grants Manager, ongoing:* "What's overdue across the whole portfolio, and who owns chasing it?" · "Which grant records are missing a thesis tag, a program officer, or an executed agreement?"
- *CFO / Controller:* grant $ committed vs. disbursed by fund and FY (financial tier).

### Communications
- *Impact-report + announcement season:* "Which grantee results are strong, cited, and cleared for external use?" · "What have we said publicly about [grantee / thesis area] before?"
- *Any time:* "The plain-language version of [outcome], with the caveat about period and model."

### Innovation (Applied AI Fellow, EIR)
- "Which questions does the team ask most, and which take longest to answer today?" — drives what to build next.
- "Where does the same fact live in three systems with three values?" — the reconciliation backlog.
- "Which manual workflows touch grant knowledge and could be automated?"

---

## 4. The question library (the actual logic)

Compass ships a **question library**: entries keyed by `function × season × intent`, each
with a template, the filters it implies, the scope, and "who to ask" routing. It powers:

1. **Suggested questions** — on an empty Ask screen and after each answer, Compass offers
   2–3 in-season questions for the user's function.
   *Program Officer in November →* "Which of your grants have renewals in the next 60 days?"
   *Impact analyst in April →* "Which grantees are missing outcome fields for the FY report?"
   *EIR any time →* "Which active grants have the strongest externally-shareable SROI story?"

2. **Ambiguous-query interpretation** — *"How are we doing?"* resolves to:
   | Function + season | Reading |
   |---|---|
   | Program Officer, renewal season | performance-vs-projection across *their* active grants, flagging reports due this quarter |
   | Impact, report season | outcome-data completeness for the current FY reporting cohort |
   | Executive, board-prep | portfolio health: count above / below ROI threshold, list off-track |
   | Donor engagement | the strongest externally-shareable outcome stories right now |
   | Finance, close | payments scheduled vs. paid this quarter |
   Compass **states the reading it applied** in the coverage line.

3. **Result ordering & Deep-dive routing** — a measurement question routes "who to ask" to
   Impact; a relationship question to the relationship owner; an overdue-report question to
   the Grants Manager or Program Coordinator; a donor-facing question flags "shareable-tier
   only — confirm with Comms before external use."

Example library entry:

```
id: po.renewal.performance
function: programs
season: [renewal-window, pre-board]
trigger: /how did .* (do|perform)|vs\.? projection|renewal/i
template: "How did {grantee} perform against projection, and what did we flag?"
filters: { grant.status: active, grant.lifecycle_stage: renewal-window }
scope:   "grants where the asker is program officer OR relationship owner (only if role-context is on)"
whoToAsk: [program-officer-on-grant, relationship-owner]
surfaces: [projected vs reported outcome, PO check-in notes, prior decision rationale, open requirements]
```

---

## 5. Data & config

```
FUNCTION        derived  { executive | programs | donor-engagement | impact |
                           impact-advisory | finance-ops | comms | innovation }
                         from directory title + group; a signal, not a gate; multi-valued
CALENDAR        config   { fiscal_year_start: "02-01", quarter, board_dates[],
                           rfp_windows[per fund], cohort_defs[per fund],
                           impact_report_deadline, audit_window, donor_cadence }
GRANT.lifecycle_stage    derived: pre-award | Y1 | interim | renewal-window | closing | closed
GRANT.cohort             e.g. "AI4EO cohort 3"
GRANT.sroi_story_grade   derived: strength × evidence × shareable-tier (for donor engagement)
REQUIREMENT.quarter      derived from due_date against fiscal_year_start
QUESTION_LIBRARY[]       { id, function, season[], trigger, template, filters, scope, whoToAsk, surfaces }
```

Implemented as `src/roles.ts` (function map + calendar + question library), consumed by
`src/retrieval/answer.ts` (query interpretation + coverage-line disclosure) and
`src/retrieval/followups.ts` (suggested questions + who-to-ask routing). It never touches
`src/retrieval/search.ts` — the permission filter is upstream and unaffected.

---

## 6. What this is not

- Not a permission boundary. A COO asking a program-officer question gets the answer.
- Not personalization anyone has to trust blindly. Every scoping decision shows in the
  coverage line and turns off in one click.
- Not identity inference. Function comes from an HR directory field, nothing else.
