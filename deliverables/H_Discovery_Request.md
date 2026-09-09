# Compass — discovery request for the GitLab Foundation team

**From:** Jessenia Cintron
**For:** Programs, Impact, and Operations (plus a Workspace admin for one section)
**Purpose:** everything I'd need to turn the working prototype into a build on your real data

---

## Short version (the email)

> I've built a working prototype of Compass — a permission-aware way to ask five years of
> grant knowledge one question and get back a cited answer, with an honest statement of
> what it did and didn't search. It runs today on a synthetic corpus; the machinery around
> the data (cleaning, de-duplication, entity resolution, the permission boundary,
> citations, the audit log) is real.
>
> To point it at your actual systems I need two things from you: **a handful of
> credentials**, and **about 90 minutes of your time** across two short sessions to walk
> through what's really in each system. Everything below is that list. None of it is
> urgent this week — I'd rather get it right than fast.
>
> The single most useful thing you could send ahead of time is a **folder-tree export of
> the candidate Google Shared Drives** (names, owners, item counts, last-modified) so we
> can choose the version-1 scope from evidence instead of a guess.

---

## Part 1 — Access & credentials (what unblocks the build)

Each connector is already written. It activates the moment its credentials arrive; until
then that source runs on mock data. Partial is fine — send what's easy first.

| System | What I need | Who usually provides it |
|---|---|---|
| **Google Drive** | A **service account** (Google Cloud robot account) with the Drive API enabled, added as **Viewer** to a named set of Shared Drives — and its key file. Plus the list of Shared Drive IDs. | Workspace / IT admin |
| **GivingData** | Whether your plan includes **API access** (endpoints + auth + rate limits). If not: the ability to run **scheduled CSV exports** of grants, organizations, requirements, payments, and a bulk document export from the grantee portal. | Grants Manager + GivingData support |
| **Airtable** | A **read-only personal access token** scoped to the relevant base(s), the base ID(s), and the list of tables that matter. | Whoever owns the base |
| **Sign-in** | One **Google OAuth client** registered in your Google Cloud console (Web application type), with the redirect URI pointed at wherever Compass will run — client ID + secret. | Workspace / IT admin |
| **Permissions** | Read-only **Google Groups** membership access (Admin SDK) so access can follow the groups people are already in, rather than a list I maintain by hand. | Workspace / IT admin |

**Not requested:** Zoom Chat. It almost certainly fails the basic test (does five years of it
even exist under your retention setting?), and the decisions in it are usually written up
elsewhere. I'd confirm that in the session rather than connect it.

---

## Part 2 — Two working sessions (~45 min each)

### Session A — "What's actually in each system"

Bring: the Grants Manager, one or two long-tenured program staff, and whoever keeps any
by-hand tracker.

**Google Drive**
- Is the grant-relevant content in **Shared Drives** or scattered across people's personal
  **My Drive**? Roughly what split?
- Is there a **naming or folder convention** for grants (by org? fund? year? grant ID)? How
  consistently is it followed?
- Are reports mostly **native Google Docs**, **uploaded PDFs**, or **scanned PDFs**? Does
  that change for older grants?
- Has the **proposal / report template** changed over five years? When, and how much?
- Which drives or folders are **explicitly off-limits** — board, HR, legal, compensation?

**GivingData**
- Walk me through one **grant record**: the standard fields plus every **custom field** —
  which are required, which are optional, which are effectively abandoned.
- How is **projected impact** captured — a North Star ratio field? projected earnings
  delta? Entered once at approval, or updated?
- How is **reported / actual impact** captured — structured fields, or only inside an
  uploaded report document?
- How do **Requirements** (reports, check-ins) work — is there a "received / reviewed /
  approved" state?
- Was there a **migration into GivingData** from a previous system? What came over clean
  and what didn't? Does "five years" start before it?
- Do all Programs staff see **all grant records**, or is visibility restricted by
  role / portfolio / fund?

**Airtable**
- Which **bases and tables** are the team-of-record vs. someone's personal experiment?
- Is there a field holding the **GivingData grant ID or org ID** — any reliable
  cross-reference between the two systems?
- How is the **interaction / touchpoint log** structured, and is it kept up reliably or
  sporadically?
- Are there **duplicate** org or contact records, and how does the team handle merging?

### Session B — "Sensitivity, permissions, and the gaps we'll accept"

Bring: the data owner (COO's office), someone from Impact, and counsel if available.

- Do grant reports contain **named information about program participants** — people served
  by grantees (names, stories, contact info, immigration or justice-system status)? How
  common is it? *(My default: detect and hold this out of the index entirely in v1.)*
- Are there documents with **candid internal assessments** of a grantee's leadership or
  viability that would damage the relationship if surfaced casually?
- Which grants carry **confidentiality or data-use clauses** (co-funder MOUs with Ballmer
  Group / Annie E. Casey, individual grant agreements)?
- For grantees in **Colombia and Kenya**, is there personal data in the reports, and has
  cross-border transfer ever been assessed?
- Where should Compass be **allowed to say "I don't have that"** — pre-migration grants,
  personal drives, untagged historical grants, Zoom? I want everyone to agree to that list
  up front, so the gaps are a known feature, not a surprise.

### Session B — the AI-vendor and cross-border questions (for counsel)

These decide the generative layer and the Colombia/Kenya handling. Compass works fully in
**extractive mode** (cited passages, no AI writing, no vendor) while these are resolved, so
none of this blocks a pilot — but the answers set the timeline for written answers.

- **AI vendor / retention.** What is the Foundation's written position on sending grantee
  and co-funder content to an AI provider? Options, in order of our preference:
  1. An **enterprise zero-retention agreement** with a commercial provider (Anthropic /
     OpenAI both offer this — prompts and outputs are not retained or trained on; it
     requires a signed agreement, not the pay-as-you-go plan). Is there an existing GitLab
     Inc. agreement Compass could sit under, or would the Foundation execute one?
  2. An **open model hosted in the Foundation's own cloud** — zero retention by
     construction, higher hosting cost.
  3. **Extractive-only** — no vendor at all, indefinitely.
  Which is acceptable, and who signs?
- **What data would actually reach the model?** Only the ~8 retrieved passages plus the
  question — never the whole corpus, never raw source files, never anything below the
  asker's tier. Does that change the answer to the question above?
- **Colombia / Kenya.** For grantees there: is there personal data in the reports beyond
  participant identifiers (which we already strip and quarantine at intake)? Is a
  data-processing addendum needed with the AI vendor? Is there a data-residency requirement
  (must Colombia grantee content stay in a specific region)?
- **Role-gating vs. redaction.** Our model is that sensitive material is *gated by
  role/seniority*, not always fully redacted — the same pattern as a prior grant-data
  build. Is that acceptable to counsel, or are there categories that must be redacted
  regardless of who is asking?
- **Confidentiality clauses.** Which grants carry clauses that limit secondary use of what
  the grantee submitted? We need the list before ingestion, not after.
- **Language of submitted reports.** Do grantees (or Foundation staff) in Colombia submit
  reports in Spanish? Consistently, or are they translated on submission? If translated,
  where does the translation live — alongside the original in Drive, or only in GivingData?
  This decides whether translation-at-intake is a core feature or an edge case. *(Compass
  already retrieves Spanish documents from an English question and can render them into
  English in the answer, with the citation still pointing to the Spanish original.)*
- **Reporting cadence.** Is reporting frequency uniform, or does it vary by grant / fund /
  grantee (quarterly, semi-annual, annual, biennial, final-only)? Is the reporting period
  based on the grant year, the calendar year, or the Foundation's fiscal year? Compass
  reads each grant's own schedule — we need to confirm the field that carries it in
  GivingData (question G9).

---

## Part 3 — One decision that needs an owner

Compass needs a single person (likely in the COO's office) who can give a yes/no on:
**the version-1 corpus** (which funds, which date range, which drives), **the sensitivity
tiers**, and the **"never include" list**. Every "can we ingest this?" question routes to
that person. Nothing goes into a production index before they sign off on those three
things.

---

## What I'll produce from this

1. A **field register** — every field we ingest, why, its role in linking systems together,
   and its sensitivity tier.
2. A **source-of-truth map** — for each kind of fact (grant amount, projected impact,
   reported outcome, decision rationale), which system wins and why.
3. A **version-1 scope** you've approved with the full picture in front of you.
4. A **gold question set** — 50–100 real questions with verified answers, built with your
   team, that every release is tested against.
