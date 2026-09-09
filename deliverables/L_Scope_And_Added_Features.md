# What the assignment asked for, and what I added

**Companion to the strategy doc · Jessenia Cintron**

The case study asked for a product solution to one problem: *the Programs team wants to ask
questions of five years of grant reports and internal notes spread across Google Drive,
GivingData, Airtable, and Zoom Chat.* Four things to cover — context, the system, risks,
tradeoffs — plus the presentation deck.

This document separates **what directly answers that** from **what I chose to add**, and
for every addition, why it earns its place. Nothing here is built to show off; each item
solves a problem the Programs team actually has.

---

## Part 1 — Building to scope

| The assignment asks for | How Compass answers it |
|---|---|
| **Context** — who uses it, what decisions it supports, what access constraints exist | Programs, Impact, Executive, Donor Engagement, Finance/Grants-Ops as distinct readers; renewal / diligence / board-prep / co-funder-reporting as the decisions; a four-tier sensitivity model (`team` / `programs-only` / `restricted` / `never-ingest`) as the access constraint. Detailed in strategy doc §1–2. |
| **The system** — end to end | Connect → clean → de-duplicate → resolve to the same grants/orgs → permission-filter → answer with citations → disclose what wasn't searched. Runs today on synthetic data; `npm run eval` proves it. |
| **Risks & edge cases** | Strategy doc §3 + the security lifecycle review (`G_`) + the HOPE lessons (`K_`). Wrong-persona leakage, restricted-tier probing, conflicting numbers across systems, unreadable scans, unknown subjects — each has a tested behavior. |
| **Tradeoffs** — what to leave out of v1 | Zoom Chat (fails the retention test), generative answers (extractive by default), email, participant-level data, pre-migration history. Strategy doc §4, and each is stated in the tool's own coverage line. |

**The core build is small on purpose:** connect four sources, enforce who sees what,
answer with citations, admit the gaps. Everything in Part 2 sits on top of that.

---

## Part 2 — What I added, and why it helps the team

### In v1 — on by default

| Addition | What it is, plainly | Why it helps the Programs team |
|---|---|---|
| **Clean + de-duplicate pipeline** | The same report often lives in two places (the grantee-portal PDF and a Drive copy) with slightly different numbers. The pipeline detects that and picks one authoritative version. | A program officer asking "how did Riverbend do against projection" gets **one answer**, not two near-copies they have to reconcile by hand. This is the "no single source of truth" problem, solved at ingest. |
| **Deep-link citations** | Every citation links to the **exact highlighted sentence** in the source document, not just "this 40-page report". | Trust. Someone can verify a number in two seconds instead of hunting for it — which is what makes people actually rely on the tool. |
| **PII detection at intake** | A scanner reads every document before indexing and holds out anything that names an individual program participant (the people served by grantees). | Protects the most vulnerable people in the Foundation's data — participants in Colombia and Kenya whose immigration or employment status could be in a report. A question about a named participant is refused. |
| **"I don't recognize that" guard** | If you ask about a person or organization Compass has nothing on, it says so — instead of answering confidently about an adjacent grantee. | Stops the most damaging failure mode: a plausible-sounding answer about the wrong grant. |
| **Excluded-count in the coverage line** | If the pipeline set aside documents it couldn't read (old scans), every answer says "N documents were set aside as unreadable." | The team knows there's a blind spot and can decide to OCR or re-request those reports — rather than assuming the answer saw everything. (Lesson from the HOPE dashboard.) |
| **Sign in with Google + group-based access** | No new password. Access follows the Google Groups people are already in. | Zero admin overhead — no separate user list to maintain, and someone's access is correct the day they join or change teams. |
| **Full audit log** | Every question and every sign-in is recorded in a tamper-evident log. | For a Foundation whose brand is measurement rigor, being able to show exactly what was asked and answered is not optional. |

### In v1 — toggleable, off or on per user

| Addition | What it is, plainly | Why it helps the Programs team |
|---|---|---|
| **Deep-dive panel** | When Compass can't fully answer, a side panel names **what's missing**, **who would know**, and **drafts an email** to that person. | Turns a dead end into a next step. Instead of "I don't have that," the officer gets "ask Dana, here's a draft." Off by default so it never clutters a clean answer. |
| **Role & cycle context** | Compass can factor in your function and the Foundation's calendar (fiscal year Feb–Jan). "How are we doing this quarter" means the fiscal quarter for Finance, the grant cycle for a program officer. | The same question gets the **right interpretation** for who's asking — and Compass always says which reading it used, so it's never a silent scope change. A relevance hint, never a permission gate. |

### Built, not in v1 — activates when the Foundation decides

| Addition | What it is | Why it's built now |
|---|---|---|
| **Real connectors** (Drive, Airtable, GivingData) | Live API connectors behind the same interface as the mocks. | The day the Foundation provides a credential, that source goes live — no rebuild, no waiting. |
| **Zoom connectors** | Team Chat + recorded-call archive, built to Zoom's real constraints, **off unless explicitly enabled**. | So the Zoom decision is a switch, not a project — and Compass reports how much history actually exists before anyone commits. |
| **Learned embeddings** | A smarter search option: matches meaning, so "certificate completion" finds "credential attainment". | The team shouldn't have to guess a document's exact wording. Opt-in; the default keyword search needs no setup. |
| **Postgres permission filter** | The access rule runs as a database `WHERE` clause, proven with the same zero-leak test. | Proof for anyone deciding whether to trust this with $20M of records that the boundary is real infrastructure, not a UI trick. |
| **Per-user rate + cost limits** | Each person gets a request and AI-spend budget; over it, they're slowed, not cut off. | One person — or a bug — can't run up the AI bill or hammer the source systems. |
| **Anomaly monitoring** | Watches the audit log for patterns: someone repeatedly probing restricted content, a cost spike, a broad scrape. Each alert names the response playbook. | On-call finds out about misuse in minutes, not in a quarterly review. |

### Supporting documents (for the Foundation, not the demo)

| Document | Who it's for |
|---|---|
| **Discovery request** (`H_`) | The team — the credentials to gather and two 45-minute session agendas |
| **Cost model** (`I_`) | Leadership — ~$260/month to run, ~$18k one-time, can launch at $0 AI cost |
| **Data preservation guide** (`J_`) | The whole team — the retention gaps and the five habits that keep the record whole |
| **Lessons from HOPE** (`K_`) | How a prior real grant-data build shaped every decision here |

---

## The one-line version

> "The core is deliberately small — connect four sources, enforce who sees what, answer
> with citations, admit the gaps. Everything I added on top solves a specific Programs-team
> problem: de-dupe so you get one answer not two, deep-links so you can verify in seconds,
> a PII wall so participant data never enters the index, and a deep-dive panel that tells
> you who to ask when the answer isn't there. The features that aren't in v1 are *built*
> and waiting on a decision, not on more engineering."
