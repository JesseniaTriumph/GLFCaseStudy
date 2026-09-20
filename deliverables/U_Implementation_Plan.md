# Compass — how it gets built

**A plan for taking the prototype to something the Programs and Impact teams use every week.**
Jessenia Cintron · GitLab Foundation, Applied AI Fellow case study

---

## Where this starts

Compass today is a **working prototype, not a product.** It runs on a synthetic five-year
grant corpus — invented grantees, invented reports, no real Foundation data — and it exists
to prove the parts that are actually hard: retrieving across messy sources, enforcing who is
allowed to see what, and citing every claim back to its source. Those parts work, and the
permission tests pass. What it hasn't done is touch a real system, a real five years of
reporting, or a real decision. This plan is about doing that, in an order that keeps the
Foundation in control the whole way.

The team has already been experimenting with AI here — a proposal-reading helper, an
insights generator across grantees. That work is why this is possible: it shows the
appetite is real, and it surfaces what a shared, supported version needs. The plan below is
meant to bring those threads together *with* the people who started them.

---

## How the plan is ordered

Three rules decide what comes first:

1. **The things you can't easily undo happen first** — how systems are accessed, how
   sensitive material is classified, what legal agreements are in place. These are decided
   and signed off before anything is indexed.
2. **Trust is proven with a few people before anything scales.** A small group uses it for
   real work and tells us whether they still double-check the answers. Only when they stop
   does it widen.
3. **Every stage ends with a decision that is yours, not mine** — continue, change
   direction, or stop. The stages are a sequence of steps, not a countdown; any stage can
   end early, or not end at all.

---

## Stage 1 — Discover

*Purpose: lock the decisions that are expensive to change later. No building yet.*

1. Sit with 3–5 people who would use Compass. Confirm **two design partners** who will test
   it weekly, and name the **one person** who owns and signs off on the access model.
2. Inventory the four systems — Google Drive, GivingData, Airtable, Zoom Chat — for what's
   in them, how they're permissioned, how long things are kept, and how consistent the
   reporting has been over five years.
3. Get **read-only, least-privilege access** to Drive, GivingData, and Airtable. Confirm
   each one actually reads.
4. Put the **legal agreements** in place: a zero-retention, no-training agreement with the
   language-model provider, a data-processing agreement, and counsel's written read on
   co-funder terms and grant confidentiality.
5. Agree the **four sensitivity tiers** and the **"never bring in" list** — the drives,
   bases, and record types Compass must never touch. The data owner signs this before
   anything is indexed.
6. Build the **source-of-truth map** with the team: for each kind of fact — grant amount,
   projected impact, reported outcome, decision rationale — which system is authoritative.
7. Define the **first corpus** (which grants, which drives, which Airtable base) and the
   **six-month success measure**, agreed with the COO and the Programs lead.
8. Build the first **set of ~50 real questions** with verified answers — the yardstick
   every later change is measured against.
9. Write down **how long the target tasks take today** (a renewal prep, an outcomes pull),
   so the improvement is measurable.

**This stage is done when:** access is signed, the corpus and the success measure are
agreed, the tier scheme is approved by the data owner, and the question set exists.

**Then we decide:** do we have what we need to build responsibly? Continue, change, or stop.

---

## Stage 2 — Prove

*Purpose: put a small, real version in front of real people and see if they trust it.*

10. Connect the **real Google Drive and GivingData** feeds — read-only, syncing changes as
    they happen, never writing anything back.
11. Bring documents in with their **version, their access list, and a content fingerprint.**
    Anything that scanned badly or looks untrustworthy is held back, not indexed.
12. **Resolve about 30 grants** — connect every document to its grant, organization, fund,
    and people. Uncertain matches go to a person to confirm, not a guess.
13. Turn on **permissioned retrieval:** the search is filtered to what the person asking is
    allowed to see, enforced in the database itself, and the most sensitive tier is never
    in the index at all.
14. Wire the **cited answer:** a short brief, a link on every claim, a line stating what was
    searched and what couldn't be seen, and a plain refusal when the evidence is thin.
15. Ship the **web app with real Google sign-in** — ask a question, read the brief, open any
    source, see the grantee dossier.
16. Turn on the **safety controls:** a tamper-evident record of every query, an off switch,
    and limits on how much any one person can run.
17. Put **3–5 design partners** on it with their real questions and a weekly feedback
    conversation.
18. Run an **attack-test suite** on every change — including planted documents that try to
    trick the system — and block any change that regresses.

**This stage is done when:** partners are getting correct, well-cited answers to real
questions; the attack tests show **zero permission leaks**; the audit record and off switch
are verified.

**Then we decide:** do people trust it enough to widen it? Continue, change, or stop.

---

## Stage 3 — Harden

*Purpose: make it safe and complete enough for the whole Programs and Impact group.*

19. Add the **Airtable** connection.
20. Add a **personal-data check** that redacts named program participants and never indexes
    their identifiers.
21. Expand the **attack tests** with roughly fifteen planted manipulation documents; all
    must pass automatically.
22. **Backfill the corpus to the full five years,** handling older and conflicting versions
    — showing both when sources disagree, never quietly picking one.
23. Add **Spanish-language retrieval** and scan-quality checks for the Colombia reports.
24. Make the question set and the attack tests an **automatic release gate** — a regression
    stops the release on its own — and stream the audit record off the server.
25. Give the review queue an **admin screen**, and produce a clean reconciliation report
    showing nothing was lost or double-counted.
26. Commission an **independent security test** by an outside firm; fix what they find; pass
    a clean re-test.
27. **Onboard the full Programs and Impact group.**

**This stage is done when:** the five-year corpus reconciles clean, every security item is
closed, the outside test is remediated, and the team is using it.

**Then we decide:** is it ready to widen further? Continue, change, or stop.

---

## Stage 4 — Widen

*Purpose: extend reach and hand it off — only now that the core is trusted.*

28. Add **one place the team already works** — a view inside GivingData, or a question bot
    in Slack or Zoom.
29. Run a **weekly tuning loop:** feedback and test results become one reviewed improvement
    at a time.
30. Build **adoption, trust, and cost dashboards** for leadership.
31. Train a **named internal owner** to run a full refresh, the tests, and a release with no
    help.
32. Deliver a **decision packet** to leadership on the open questions — bringing in Zoom
    Chat, opening it Foundation-wide — as your decision to make, not an assumption.
33. Run a **tabletop exercise** once — walk through a security incident on paper and update
    the response steps.

**This stage is done when:** the system is documented, has a named owner, and the decision
packet is delivered.

---

## What you have at the end

A permission-aware assistant the Programs and Impact teams use for real decisions — renewal
prep, board prep, sourcing, onboarding — with five years of grant knowledge behind it, every
answer cited, an independent security sign-off on record, and a named person inside the
Foundation who owns it. And a written decision, made by leadership, about whether it goes
further.

---

## What stays true at every step

- **Read-only.** Compass never changes anything in Drive, GivingData, or Airtable.
- **Cited or silent.** Every claim links to its source; when the evidence is thin, it says so.
- **Fails closed.** If the system can't confirm what someone is allowed to see, it shows
  less, not more.
- **Built in the open.** Every stage is documented so anyone on the team can run it and
  extend it.
- **With the team, not instead of it.** The people already experimenting with AI here help
  shape it.

---

## What it needs from you

The one data owner. Two design partners who will test weekly. Read-only access to three
systems. The zero-retention agreement with the model provider. Everything else is on the
plan.
