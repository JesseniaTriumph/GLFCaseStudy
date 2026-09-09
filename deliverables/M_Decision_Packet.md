# Compass — leadership decision packet

**For:** Elicia Wilson (COO), Ellie Bertani (CEO), Matt Zieger (Chief Programs & Partnerships), Tamsin Chen (Director of Impact)
**From:** Jessenia Cintron
**Purpose:** the three decisions leadership owns before Compass goes past a pilot (roadmap 4.7)

---

## Where things stand

A working prototype exists on synthetic data. It connects three systems (Google Drive,
GivingData, Airtable), enforces who can see what as a tested boundary, answers with
citations, and states what it could not see. The connectors, sign-in, and permission model
are built and waiting on credentials, not on more engineering. Full status:
`compass/README.md` and `deliverables/G_Security_Review.md`.

Running cost at the Foundation's size is ~$260/month; the one real spend is a third-party
penetration test, $8–25k, before it touches real grantee data (`deliverables/I_Cost_Model.md`).

---

## Decision 1 — Do we run the pilot, and on what corpus?

**Recommendation: yes, narrow.** V1 = GivingData (from the corpus start date) + 2–3 named
Shared Drives + the canonical Airtable base. Details and the 6-month success metric:
`compass/docs/V1_CORPUS_AND_METRIC.md`.

**What we need from you:** a named data owner in the COO's office who can approve the
corpus, the sensitivity tiers, and the `never-ingest` list; and sign-off to request the
credentials in `deliverables/H_Discovery_Request.md`.

**Continue / change / stop** is revisited at each phase gate. "Stop" costs the pilot, not
the Foundation — nothing is irreversible until a production index exists on real data.

---

## Decision 2 — Do we ever ingest Zoom, email, or the impact model?

| Source | Recommendation | Why |
|---|---|---|
| **Zoom Chat** | **No, unless three things are all true:** retention actually goes back multi-year, decisions genuinely live only in chat, and staff already treat it as archived. | The connector is built and gated. Default Zoom retention is 2 years, not 5; the useful decisions are almost always written up elsewhere; and ingesting candid chat people believed was ephemeral is a trust cost regardless of the legal position. |
| **Zoom recorded calls / transcripts** | **Only with a deliberate, consented policy.** | Default retention is 30 days — five years almost certainly doesn't exist. If the team wants this, it needs a consent-to-record norm and the transcripts saved into the grant folder. |
| **Email** | **Later, and hard.** Phase 3+ at the earliest, with its own governance review. | This is where reasoning often lives, but it's the highest-sensitivity, hardest-permission source. |
| **Notion (internal)** | **Likely an early add.** Connector is built. | Clean API; probably holds strategy and meeting-notes content Drive doesn't. Needs a governance review of scope. |
| **The impact model / Tableau** | **Yes, as a citation target.** Coordinate with the Impact team. | Compass must cite the authoritative impact numbers, not a stale copy in a memo. |

---

## Decision 3 — The release decision, and who owns it

**Recommendation:** the release gate is not a document — it is the Phase 3 exit criteria,
tested: a five-year corpus with a clean reconciliation report, all six security-review
items closed, the eval + red-team promotion gate automatic, the pen test remediated, and
the full team onboarded (`compass/docs/ROADMAP.md`).

**What we need from you:**

- A named **internal owner** (the DRI) who is trained to run a full sync + `npm run ci` +
  promote unaided (`compass/docs/RUNBOOK.md`).
- Whoever signs off on promoting a new index — one person or a small rotation.
- Legal to execute the zero-retention LLM agreement + DPA, and give a written position on
  sending grantee/co-funder data to an AI vendor and on Colombia/Kenya cross-border transfer.
- A decision on whether generative (written) answers are in v1 or the tool ships
  extractive-only first (recommended: extractive-only, add generation once there's a track record).

---

## The one-paragraph version

Run a narrow pilot on three systems. Keep Zoom out. Name a data owner and an internal
operator. Get the pen test and the LLM agreement moving now, because they're calendar-bound.
Ship extractive-first. The security exit criteria are never traded for speed — if the
pilot runs behind, we narrow the scope, not the safety.
