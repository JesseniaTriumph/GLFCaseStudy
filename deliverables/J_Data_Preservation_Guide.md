# Making sure the knowledge is there in five years

**A plain-language guide for the GitLab Foundation team · companion to the Compass proposal · Jessenia Cintron**

---

## Why this document exists

Compass can only answer from what actually got saved. Some of what you'd want it to know
either **isn't being kept long enough**, or **lives somewhere it can't safely reach**.

None of these gaps are Compass's fault or yours — they're just how the tools are set up out
of the box. Every one of them can be closed, most of them for free, and most of them in an
afternoon. This document explains each gap in one paragraph, why it's there, and the one
thing that closes it.

The second half is a short list of habits that keep the gap from coming back — so that in
**2031, when someone asks "how did the cohort we're deciding on right now actually do?"**,
the answer is there.

---

## Part 1 — The gaps, and how to close each one

### 1. Zoom chat only goes back ~2 years

**The gap.** Zoom keeps team-chat messages for **2 years by default**, then deletes them.
So "five years of team conversations" mostly doesn't exist — the older half is already
gone. On top of that, Zoom's automatic feed for apps like Compass only reaches back about
**6 months**; anything older has to come from an admin export.

**Why.** It's a default setting nobody changed. Zoom picked 2 years; it was never a
decision the Foundation made.

**How to close it.**
- **Today (free, 2 minutes):** an admin raises the chat retention setting to its maximum,
  **10 years**. From that moment the clock starts and nothing new is lost. *(Account
  Settings → Chat → message retention.)*
- **For the history that still exists:** an admin runs a one-time Chat History export and
  hands it over; Compass ingests it.
- **What you can't get back:** chat from more than 2 years ago. That's gone regardless.
  Compass will simply say so — its answers always state the date range they cover, so no
  one is misled into thinking it saw everything.

**Effort:** 2 minutes now + one export. **Cost:** $0.

---

### 2. Recorded grantee calls disappear after 30 days

**The gap.** Cloud recordings and their transcripts are deleted after **30 days** by
default. If a program officer has a great diligence call and relies on "it's recorded,"
that recording — and everything said on it — is usually gone within the month.

**Why.** Same as above: a default retention setting, plus recordings use a lot of storage
so the default is short.

**How to close it.**
- **Today:** an admin turns **off auto-delete** for the users who record grantee and
  program calls, or sets it to several years.
- **Going forward:** decide as a team whether grantee calls *should* be recorded at all
  (there are consent questions — see the discovery request). If yes, the transcript is the
  valuable part; make sure it's kept and, ideally, saved into the grant's folder.

**Effort:** one admin setting + a team norm. **Cost:** a little more Zoom storage, or $0 if
transcripts are moved to Drive and the recording deleted.

---

### 3. Important documents live in people's personal Drive

**The gap.** A memo saved in someone's **"My Drive"** belongs to that person. When they
leave the Foundation, it can vanish or become unreachable — and Compass can't safely index
personal drives anyway. If the key diligence memos are in personal drives, the five-year
record has holes in it.

**Why.** It's easier to hit "new doc" than to navigate to the right shared folder. It adds
up over years.

**How to close it.**
- **One-time cleanup:** move grant-related documents from personal drives into the shared
  team drives. (Discovery includes pulling a list of what's where, so this is targeted, not
  a fishing expedition.)
- **Going forward:** the habit in Part 2 — grant documents are *created* in the shared
  drive, not moved there later.

**Effort:** a few hours of cleanup, once. **Cost:** $0.

---

### 4. Some grant history may be stuck in an old system

**The gap.** If the Foundation used a different grants system before GivingData, the
grants, reports, and attachments from that era might not have moved over cleanly — or at
all. "Five years" might really mean "three years in GivingData plus two years somewhere
else."

**Why.** System migrations almost always leave something behind — old attachments,
retired fields, closed grants.

**How to close it.**
- Confirm in discovery whether there was a prior system and whether its data is still
  reachable.
- If it is: one export of the old grants and documents, ingested alongside GivingData.
- If it isn't: Compass's coverage statement names the cutoff date so everyone knows where
  the record begins.

**Effort:** one export, if needed. **Cost:** $0.

---

### 5. Decisions made in email or on a call, never written up

**The gap.** The *reasoning* behind a decision — why you renewed, why you passed, what
you're worried about — often happens in an email thread or a quick call and never lands in
GivingData or a memo. Compass can't retrieve a thought that was never written down.

**Why.** Writing it up is an extra step at a busy moment.

**How to close it.** This one is a habit, not a setting — see Part 2. The short version:
**every real decision gets one paragraph, written where the grant lives.**

**Effort:** ~5 minutes per decision. **Cost:** $0.

---

### 6. Grants that were never tagged

**The gap.** If a grant is missing its thesis-area, geography, or fund/cohort tag in
GivingData, it won't show up when someone asks "everything we've funded in credential
completion." The answer quietly under-counts.

**Why.** Tags are optional fields; under deadline pressure they get skipped.

**How to close it.**
- A one-time backfill pass: the Grants Manager (or Compass, flagging the blanks) fills in
  missing tags on historical grants.
- Going forward: tags are filled in at approval, every time.

**Effort:** a few hours, once. **Cost:** $0.

---

### 7. Old reports that are scanned images, not text

**The gap.** A report that was scanned and saved as an image PDF isn't searchable text.
Compass can read it with OCR (optical character recognition), but OCR makes mistakes, so
those documents are marked lower-confidence.

**Why.** Older grantees sometimes mailed or faxed paper reports; some got scanned.

**How to close it.** Nothing to fix for the past — Compass handles it and flags the
uncertainty. Going forward: ask grantees for documents (Word, Google Docs, digital PDFs),
not scans.

**Effort:** none. **Cost:** $0.

---

## Part 2 — Habits that keep the record whole

These are small. Done consistently, they mean that in five years the knowledge is simply
*there*.

### The one rule

> **Every decision that matters gets one paragraph, written where the grant lives.**

When you renew, decline, flag a concern, or change course: a few sentences in the
GivingData record (or a dated note in the grant's Drive folder) saying **what you decided
and why**. That paragraph is what a future colleague — or Compass — will need.

### The five habits

| Habit | Why it matters in five years |
|---|---|
| **Create grant documents in the shared team drive**, not your personal Drive | The document survives you leaving; Compass can index it |
| **Put the grant ID in the folder or file name** | It's often the only way to reliably link a document back to the right grant |
| **Fill in the thesis-area, geography, and fund tags at approval** | "Everything we funded in X" only works if X is tagged |
| **When a decision happens on a call or in email, write the one paragraph** (above) | The reasoning is the part that's almost never recoverable later |
| **Keep retention long on purpose** — Zoom chat at 10 years, no auto-delete on grantee-call recordings or grant folders | The default settings are quietly deleting your history right now |

### The one recurring check

Once a quarter (it fits in 15 minutes at a team meeting): **"Is there anything about an
active grant that only exists in someone's inbox, a personal doc, or someone's head?"** If
yes, someone writes it down in the grant's home. That's it.

---

## What "good" looks like

Picture it's early 2031. The team is deciding whether to renew a cohort of workforce
grants. Someone asks Compass:

> *"How did this cohort perform against what they projected, and what did we flag along the
> way?"*

Because the habits above were in place, Compass can answer:

- the **projections** — from the GivingData fields, filled in at approval
- the **actual results** — from the reports, saved in the shared drive with the grant ID
- the **concerns raised** — from the one-paragraph decision notes and the site-visit memos
- the **relationship history** — from Airtable, kept current
- and it names **what it couldn't see** — so the team knows where to ask a human

That's the whole goal: the season you're working through right now becomes an answerable
question later, without anyone having to have planned for that specific question today.

---

## The short list for leadership

If you do only the free, five-minute things:

1. **Raise Zoom chat retention to 10 years** (admin setting)
2. **Turn off auto-delete for grantee-call recordings** (admin setting)
3. **Tell the team: decisions get one written paragraph, in the grant's home**
4. **Tell the team: grant documents get created in the shared drive**
5. **Name one person** who owns the quarterly "anything only in someone's head?" check

Everything else in Part 1 is a one-time cleanup that discovery will scope precisely.
