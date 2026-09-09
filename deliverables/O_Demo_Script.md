# Compass — demo script

**7 minutes. One browser tab. The point to land: Compass answers from what it found,
shows its work, admits its gaps, and the permission boundary is real — not a UI trick.**

Setup: open the live demo at **https://compass-demo-gwk4.onrender.com** (hit it ~2 minutes
early — the free tier sleeps after 15 min idle and takes ~30s to wake). Local fallback:
`npm run demo` → `http://localhost:8787`. It loads already signed in as a Program Officer
(a fictional demo user). Everything below runs on the synthetic 5-year corpus. If real
Google sign-in is configured (see `compass/docs/DEMO_HOSTING.md`), the persona switch is
replaced by a real "Sign in with Google" — the rest of the script is identical.

---

## 0 · Frame it (20 seconds)

> "Compass lets the Programs team ask five years of grant knowledge one question — across
> Google Drive, GivingData, and Airtable. It retrieves first, then answers **only** from
> what it found. Every claim links to its source. And it enforces who's allowed to see
> what — on the server, before it ranks anything. Let me show you."

---

## 1 · A real question (90 seconds)

Click the first example:

> **"How did Riverbend Care Collective perform against what they projected, and did the
> program officer flag anything?"**

Point at, in order:

1. **The brief** — 8 passages across 3 systems. Not a paragraph the model wrote from
   memory — the actual source text, each numbered.
2. **The coverage line** (under the answer): *"Searched: GivingData, Google Drive,
   Airtable … Not covered: grants before the corpus start, personal drives, Zoom Chat and
   email, board/HR/compensation/legal (Restricted — not indexed). 4 documents set aside as
   unreadable."* — "It tells you what it looked at **and** what it couldn't."
3. **Confidence** — *"high — strong evidence, 8 close matches across 3 systems, sources
   agree, most recent within ~2 years."* — "That's computed from the evidence: how much,
   how well it agrees, how fresh. It is never the model saying 'I'm confident.'"

---

## 2 · One citation (30 seconds)

In the **Sources & coverage** rail, click citation **[2] — PO check-in notes**.

> "It opens the source document with the exact passage highlighted — a program officer's
> Q2 note: placement pace behind plan, Medicaid reimbursement delays, wage outcomes ahead
> of plan, renewal warranted with a revised ramp. Compass didn't summarize that away —
> it pointed me at it."

*(In the demo this opens a Compass-rendered view of the record, styled like its source
system — Drive, GivingData or Airtable — with the passage highlighted and the real record
URL shown on the page. Against the live systems the same link lands you in the record
itself; it's one config change, not a rebuild. Permission is re-checked on that view too —
open a source your persona can't see and it refuses exactly like a query would.)*

---

## 3 · The conflict it won't paper over (40 seconds)

Scroll the brief to citation **[8] — Care Economy Q3 board update (draft)**.

> "This draft board update says median wage at placement was **$18.40**. The final Year 1
> report — citation [3] — says **$19.10**. Same figure, two documents, two values.
> Compass shows you both and flags the disagreement rather than silently picking one.
> That's the difference between a tool that helps and a tool that quietly misleads."

---

## 4 · The gap, and what to do about it (40 seconds)

Point at **"6 withheld — restricted"** in the rail, then open **Deep dive**:

> "It's telling me there's relevant material in the Restricted tier it won't show me —
> and separately, in the deep dive, it says *who to ask*, drafts the email to the program
> officer, and tells me where this grant sits in its own cycle: annual reporting,
> one report overdue. The deep dive is kept **out** of the answer — it's what to check
> next, not part of the finding."

---

## 5 · The permission boundary — the moment (90 seconds)

> "Everything you've seen ran as a Program Officer. Watch what happens when someone else
> asks the *exact same question*."

Change **Signed in as** → **Communications & Marketing**. The answer re-runs.

Point at the difference, side by side:

| As Program Officer | As Communications & Marketing |
|---|---|
| 8 passages | **5 passages** |
| PO check-in notes, the renewal call, the impact review — all shown | **all gone** |
| "7 withheld — restricted" | **"~140 withheld — programs-only, restricted"** |

> "Same question. Same corpus. The only thing that changed is who's asking. The program
> officer's candid notes and the internal review are **programs-only** — Comms doesn't see
> them, so they never entered the answer. This isn't the page hiding rows. The filter runs
> on the server, in code, **before** anything is ranked — and there's a SQL version of the
> same rule as a second enforcement point. `npm run eval` proves it leaks nothing."

Then, still as Comms, click the board-compensation example:

> **"What did the board discuss about staff compensation?"**

> "Flat refusal. And notice what it *doesn't* say — it doesn't tell me how many restricted
> documents matched, or even confirm that any did. The count itself is sensitive. It just
> says the information is outside my access and points me to the data owner."

---

## 6 · Close (30 seconds)

> "What's real here: the permission boundary, the citations, the computed confidence, the
> conflict surfacing, the tamper-evident audit log behind every query. What's synthetic:
> the corpus — every grantee, figure, and quote is an illustrative composite built on
> public information, not a real record. Swapping in the real connectors doesn't change
> the architecture — they implement the same interface. The work left is discovery,
> credentials, and a data-owner sign-off on the tiers — not engineering."

---

## If asked — technical Q&A

| Question | Answer | Show it |
|---|---|---|
| "Is the permission filter really server-side?" | Yes. The web page calls `POST /api/ask`; the server builds the principal from the session and filters the corpus before ranking. There's also a SQL `WHERE tier = ANY($1) AND acl && $2` as a second point — and the source-viewer link re-checks it a third time. | `npm run server:check` (20/20) · `npm run eval:pg` (46/46) |
| "How do you know it doesn't leak?" | A 46-case gold set + a 25-case 5-year-corpus set + a 17-case adversarial red-team suite, all run in CI. A single leaked restricted string is a hard build failure. | `npm run redteam` (17/17) · `npm run ci` |
| "What about prompt injection?" | Instruction-like text in a retrieved document is stripped at intake ("[removed: text targeting an AI assistant]" — you can see one in the Riverbend answer, citation [7]) and high-score documents are quarantined. 15 planted injection docs are in the red-team corpus. | citation [7] · `docs/CONTROLS_MATRIX.md` (LLM01) |
| "What about legal / contract questions?" | Same treatment as board compensation and declined applicants — privileged legal material (counsel advice, confidentiality clauses, indemnification) is Restricted, never indexed, and refused on the topic alone. Ordinary agreement terms (reporting cadence, payment schedule) still answer — that's team-tier. | ask "what confidentiality clause did counsel advise on?" then "what reporting cadence did we agree?" |
| "How good is the retrieval?" | Hybrid BM25 + tf-idf by default; an optional local cross-encoder reranker (`COMPASS_RERANK=1`) re-scores the top ~30 hits — on the 5-year corpus it moves recall@1 from 0.10 to 0.70. Runs after the permission filter, so it only reorders what you're already allowed to see. | `npm run eval:metrics` · `docs/RETRIEVAL_QUALITY.md` |
| "Does it use an LLM?" | Not in this demo — the answer is extractive (source passages + citations). A generative backend is a config value and gets only the retrieved passages, never the corpus or any tools. It needs a zero-retention vendor agreement first. | `docs/CONTROLS_MATRIX.md` (AI-1, LLM03) |
| "Can I put it on my phone?" | It's an installable PWA — "Add to Home Screen" on iOS and Android, no app store. The phone is just another client of the same server API; it never downloads the corpus. | the install prompt |
| "What would this cost to run?" | ~$260/month run-rate, ~$18k one-time for a third-party penetration test. It can launch at $0 AI cost on the extractive path. | `deliverables/I_Cost_Model.md` |
| "How is a grant's reporting cadence known?" | From GivingData's `reporting_frequency` field if it's filled in, otherwise inferred from the spacing of the requirement due-dates — and the answer says which. | Deep dive → "where each grant is in its cycle" |
