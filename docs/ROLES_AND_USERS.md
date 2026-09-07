# Roles, responsibilities & the questions they bring to Compass

Built from GitLab Foundation's public team page, job postings, and grantmaking pages
(2025): a ~17-person fully-remote org across three business lines — **high-impact
grantmaking**, **impact advisory services for peer foundations**, and **values-aligned
capital mobilization** — plus a board. Tools in use: Google Workspace, GivingData, Airtable,
Zoom, Notion, Slack.

This is the source for `src/roles.ts` (the toggleable *Role & cycle context* feature). It
is **not a permission model** — a Program Associate and the CEO see the same tiers. It
changes which questions Compass *suggests* and how it *reads an ambiguous one*.

---

## The grant lifecycle — where the deadlines come from

Every function below is watching some slice of this. The Foundation runs **two-stage
applications** (LOI → full proposal) on **annual fund rounds**; grants run **1 year, 2
years, or multi-year**; reporting is on a cadence; there's a **renewal window**; and
close-out carries **expenditure-responsibility** documentation (a private-foundation
requirement).

| Stage | Typical window | Who's watching it | What they ask Compass |
|---|---|---|---|
| Fund open call / LOI | annual, per fund | Programs, Program Ops | "What have we funded in this thesis, what did we learn — including declines?" |
| Stage 1 — LOI screen | weeks | Programs, Director of Impact | "Seen this org or approach before? Prior concerns on file?" |
| Stage 2 — due diligence | 4–8 weeks | Programs, Impact Measurement, Legal | "Is there an attribution problem? Confidentiality clauses to flag?" |
| Award & agreement | at close of review | Grants Manager, Finance, Legal | "What did we agree — reporting cadence, payment schedule, co-funder terms?" |
| Progress reporting | annual or interim (6-mo) | Programs, Program Ops, Impact Measurement | "Reported vs. projected — and is anything missing the model needs?" |
| Renewal window | ~90 days before term end | Programs, Director of Impact, Partnerships | "How did it perform, what did the PO flag, is there a re-application deadline?" |
| Close-out + ER | at term end + ~90 days | Grants Manager, Finance | "Final report in? ER documentation and last payment reconciled? File complete?" |
| Post-grant learning | ongoing | Director of Impact, Comms | "What did this teach the thesis? Any result cleared for external use?" |

**Reporting is per-grant, not uniform.** `src/grant-cycle.ts` reads a single grant's
requirement schedule + dates and returns where *that grant* is today: its cadence
(quarterly / semi-annual / annual / biennial / final-only), its term, what's overdue,
the next deadline (in N days), whether it's in the renewal window, and the re-application
deadline. One grant can end in November and need a renewal LOI in August while another
ends two years out and needs one in February — Compass shows each grant's own schedule in
the Deep-dive panel. `portfolioDeadlines()` rolls these up into "what's due in the next 30
days" and "what's overdue" across a set of grants.

---

## The Foundation calendar — fiscal year Feb 1 – Jan 31

| Season | Fiscal quarter | What's happening |
|---|---|---|
| **Audit season** | Q1 (Feb–Apr) | Post-close financial audit; Form 990-PF; expenditure-responsibility sign-off |
| **RFP open** | Q2–Q3 | Fund open calls (the AI for Economic Opportunity Fund runs annual rounds) |
| **RFP review** | Q3–Q4 | Two-stage review of the round's applications |
| **Impact report season** | Q3–Q4 | Outcome-data collection and drafting; the FY impact report publishes in spring |
| **Planning** | Q3–Q4 | Budget and multi-year strategy |
| **Payout check** | Q4 | Confirm the ~5% minimum distribution is met before year-end |
| **Board prep** | ~quarterly | Portfolio health, the board narrative, the three grantee stories |

---

## Roles — one per function

### President & CEO
**Nexus:** the story of the portfolio, the board narrative, where to place the next bet.
**Not the COO's questions** — the CEO asks *what does this mean*, the COO asks *is this running*.
**Asks Compass:** "One paragraph — state of the portfolio this quarter." · "Across five
years, which thesis has the strongest evidence for our next bet?" · "The three grantee
stories that best carry the board narrative."
**Spikes:** board prep, planning.
**Sees:** team + programs-only.

### Chief Operating Officer
**Nexus:** the three business lines running smoothly; process bottlenecks; who can see what
(the COO's office owns the sensitivity-tier sign-off).
**Asks Compass:** "Where in the lifecycle are things getting stuck — applications,
reporting, close-out?" · "What's overdue across the whole portfolio, and who owns
chasing it?" · "How much team time is going to advisory-client work vs. our own grantmaking?"
**Spikes:** always (operational), planning.
**Sees:** team + programs-only. **Owns** the tier policy and the access model.

### Program Officer / Senior Program Officer
**Nexus:** each grant in my portfolio doing what it said it would; the renewal call; prior
art before a new grant.
**Asks Compass:** "How did *{grantee}* perform against projection, and what did I flag?" ·
"Which of my grants have a renewal window or re-application deadline in the next 90 days?" ·
"Have we funded anything like this before — including applicants we declined?" · "For
*{grantee}*, is there an attribution risk — a concurrent program in the same region?"
**Spikes:** renewal window, reporting, RFP open, stage-2 diligence.
**Sees:** team + programs-only.

### Program Associate / Program Coordinator
**Nexus:** nothing slips — deadlines, applications processing, grantee questions answered,
the handbook current. (Job posting: "maintain and update the grants management system,
ensuring data integrity"; "manage administrative tasks throughout the grant lifecycle.")
**Asks Compass:** "What's due in the next 30 days — reports, payments, applications to
process?" · "What are *{grantee}*'s reporting requirements and exact due dates?" · "Which
grants are missing a document their requirement schedule says should exist?"
**Spikes:** reporting, RFP review, close-out.
**Sees:** team + programs-only.

### Grants Manager (compliance)
**Nexus:** the file is complete and the compliance box is checked — expenditure
responsibility, data integrity, terms met. (Team page: "ensuring compliance, operational
efficiency and effective grantee support.")
**Asks Compass:** "Which grants require ER documentation, and which is outstanding?" ·
"Where does the same grant fact live in two systems with different values?" · "Which active
grants have non-standard terms — a reporting condition, a milestone payment, a data-use
clause?"
**Spikes:** audit season, close-out, award.
**Sees:** team + programs-only.

### Impact Modeling & Measurement
**Nexus:** the outcome numbers the North Star model needs — complete, current, on the right
model version. (The North Star is a benefit:cost ratio, target >$100 in lifetime earnings
per $1.)
**Asks Compass:** "Which grantees are missing the outcome fields the model needs for the
FY report?" · "Which grants still report on an older North Star model version and need
re-basing?" · "Reconcile projected vs. reported participants and earnings across the
*{fund}* cohort." · "Where do a grantee's narrative and their structured numbers disagree?"
**Spikes:** impact report season, planning.
**Sees:** team + programs-only.

### Director of Impact
**Nexus:** where our evidence is strong and where it's thin; which theses to keep, deepen,
or drop.
**Asks Compass:** "Across five years, which thesis areas have the strongest evidence and
which are thin?" · "Which grantees' reported outcomes diverge most from projection, and
why?" · "What patterns show up in the reasons we've declined applicants in this thesis?"
**Spikes:** planning, board prep, RFP review.
**Sees:** team + programs-only.

### Impact Advisory Services — *external clients*
**Nexus:** benchmarks and case patterns for an external peer-foundation client — **never a
confidential grantee detail.** This function is the reason "externally-shareable" is a
real distinction in the product.
**Asks Compass:** "What benchmark ranges can we share with a client for a workforce
intervention — no confidential grantee detail?" · "What case patterns exist for
AI-for-benefits-access outcomes, at a level safe to share externally?"
**Spikes:** always (client-driven).
**Sees:** **team tier only.** Compass reads its questions as *aggregate, shareable patterns
only* and says so in the coverage line.

### Partnerships / Donor Relations
**Nexus:** who co-funds what; the strongest evidenced pipeline a donor could join;
relationship state. (Hiring a "Director of Partnerships and Donor Relations" —
"institutional donors, high net worth individuals and other philanthropies.")
**Asks Compass:** "The pipeline of high-SROI projects a donor could co-fund in *{thesis}*." ·
"Which co-funders are active in *{thesis}*, and what have we co-funded with them before?" ·
"Relationship state with *{grantee}* — last touchpoint, who owns it, open threads?"
**Spikes:** always (relationship-driven).
**Sees:** team + programs-only. Donor-facing outputs are shareable-tier only.

### Finance — CFO / Controller
**Nexus:** commitments vs. disbursements by fund; the ~5% payout; co-funder terms that
change our reporting. **Distinct from grants compliance** — Finance asks about *dollars and
the payout rule*, the Grants Manager asks about *the file and ER documentation*.
**Asks Compass:** "Commitments vs. disbursements by fund this FY — where are we against
plan?" · "Are we on track to meet the minimum distribution before year-end?" · "Which
grants have payments scheduled but not yet paid this quarter?" · "Which grants have
co-funder terms that affect how or when we disburse?"
**Spikes:** payout check (Q4), audit season, planning.
**Sees:** team + programs-only.

### Legal / Counsel — often external
**Nexus:** which grants carry confidentiality or data-use clauses; what may be reused; the
sensitivity scheme.
**Asks Compass:** "Which grants carry clauses that limit secondary use of what the grantee
submitted?" · "Which grantee reports from Colombia or Kenya contain personal data, and how
is it handled?"
**Spikes:** stage-2 diligence, award.
**Sees:** team + programs-only. **Advises on** the tier policy and cross-border handling.

### People / HR
**Nexus:** distinct from operations — People handles personnel, hiring, compensation. **This
function is rarely a Compass user for grant knowledge**, and compensation / personnel data
is `Restricted` and out of scope entirely. Listed here so it's explicit that HR ≠ ops ≠
finance ≠ legal, and that board/staff compensation questions are refused for everyone.
**Sees:** team tier only (for grant knowledge); no access to any compensation data through Compass.

### Communications & Marketing
**Nexus:** results that are strong, cited, and cleared for external use; a grantee story
for the impact report.
**Asks Compass:** "Which grantee results are strong, cited, and cleared for external use?" ·
"Does what we've said publicly about *{grantee}* still match their latest reported numbers?"
**Spikes:** impact report season.
**Sees:** **team tier only.** Outputs go through the external-use review chain.

### Executive Assistant
**Nexus:** the right materials in front of a principal before a meeting with a grantee,
co-funder, or the board.
**Asks Compass:** "Pull the materials the CEO needs for the meeting with *{grantee}* —
latest report, open items, relationship history."
**Sees:** team + programs-only (mirrors the principal they support; a real deployment scopes this).

### Board member
**Nexus:** portfolio-level health and the big bets. Governance and compensation are handled
outside Compass.
**Asks Compass:** "Portfolio health — how many grants above vs. below their ROI threshold
this FY, and which are off-track?" · "How is each thesis area performing against the North
Star target?"
**Spikes:** board prep.
**Sees:** **team tier only**, read-only.

---

## How Compass uses this

1. **Suggested questions** (`suggestedQuestions`): 2–3 in-season questions for the signed-in
   person's function(s). A Program Officer in the renewal window sees renewal questions; the
   same person in RFP-open season sees prior-art questions.
2. **Ambiguous-query reading** (`interpretQuery`): "how are we doing?" means portfolio
   narrative to the CEO, process health to the COO, outcome-data completeness to Impact
   Measurement, commitments-vs-disbursements to Finance. Compass states the reading it
   applied in the coverage line — always disclosed, never a silent scope change.
3. **Lifecycle windows** (`GRANT_LIFECYCLE`, `reportingCadence`): when a grant is within
   ~90 days of term end, the `renewal-window` season switches on for that grant's PO.

It never changes **what** a person can retrieve — only which questions surface and how one
is read.
