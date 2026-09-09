# Asking five years of grant knowledge one question

**Jessenia Cintron — GitLab Foundation, Applied AI Fellow case study**

Slides: *[link]* · Working prototype: https://compass-demo-gwk4.onrender.com · Code: https://github.com/JesseniaTriumph/GLFCaseStudy

I built a working prototype (I call it **Compass**) to pressure-test the thinking below. It
runs on a synthetic five-year corpus — no real Foundation data — and it exists to prove the
hard parts are solvable, not to be a finished product.

---

## 1 · Context — what I'd need to know first

Before designing anything, I'd spend the first weeks on discovery, in four areas:

**The people and the decisions.** Who exactly is "the team," and which decisions is this
for — renewal, sourcing a new grant, shaping a fund, board prep, onboarding a new hire?
What does a wrong answer cost in each case? What's the workaround today, and how long does
it take? The single recurring task that should go from hours to minutes is the thing to
build around.

**The content.** Volume and formats per system. How much duplication and how many
versions of the same document. Where the sensitive material lives — named program
participants in grant reports, candid assessments of a grantee, board and compensation
material, declined-applicant diligence, anything a co-funder shared under terms. How
consistent the reporting has been over five years, and whether any Spanish-language
reports come from Colombia.

**Access and permissions, per system.** Google Drive: shared drives vs. personal drives,
and whether a scoped service account is possible. GivingData: API access or scheduled
export, and whether staff already see all grants or only their portfolio. Airtable: which
base is authoritative and what a read-only token covers. Zoom Chat: the actual retention
setting (if it's one year, "five years of conversations" doesn't exist), and what staff
were told about whether it's searchable. Plus: which grants carry confidentiality clauses,
and who is the one person who signs off on the access model.

**What "good" means.** The six-month success metric, agreed up front. And the failure that
would end adoption — one wrong answer in front of a grantee or the board.

**A note on the four systems:** in my experience they're the starting point, not the
boundary. I'd run a quick "follow the knowledge" exercise — take three real past decisions
and trace every place information about them was written down — because the answer is
often in a fifth place (a shared inbox, a Notion page, a program officer's tracking
spreadsheet) that nobody lists in the first meeting.

---

## 2 · The system — end to end

The reframe I'd bring: **this is a retrieval, permissioning and citation problem, not a
chatbot problem.** The language model is the smallest and lowest-risk part. The value is
in connecting and cleaning the sources, resolving everything to the same grants and
organizations, and enforcing who can see what.

Six stages:

1. **Connect.** One adapter interface per source, so everything downstream is
   source-agnostic. Each connector authenticates with a scoped, read-only credential,
   pages through the API, and syncs incrementally. Compass never writes back to any source.

2. **Clean and de-duplicate.** Extract text (with an OCR-confidence check that quarantines
   anything too low to trust), normalize fields, and remove exact, near, and cross-system
   duplicates — the same report often lives in Drive and in GivingData's portal. Reconcile
   against the grant list so gaps are visible, not silent.

3. **Resolve.** Join every document to a canonical grant, organization, fund, and person.
   Low-confidence matches go to a human review queue rather than being guessed.

4. **Retrieve — permissioned.** Hybrid keyword + semantic search, then filtered to what
   the person asking is allowed to see. This filter is the security boundary. It runs in
   code and as a database query, and it fails closed. The most sensitive tier is never put
   in the index at all — only a stub that lets Compass say "that's restricted" without the
   content being reachable.

5. **Answer with citations.** Every claim links to the exact record and passage. The
   answer states what was searched and what it couldn't see. When two sources give
   different numbers, it shows both and flags the disagreement rather than averaging them.
   When the evidence is thin, it says so instead of guessing. Confidence is computed from
   the evidence — coverage, agreement, freshness, citation completeness — never the model
   asserting it's confident.

6. **Improve.** A gold set of real questions with verified answers, plus an adversarial
   test suite, gate every change. Feedback from the team feeds the gold set. The system
   gets better at retrieving and citing — never at deciding.

The team has already been experimenting with AI here — a proposal-reading helper, an
insights generator across grantees. That tells me the appetite is real and surfaces what a
shared version needs. My aim would be to bring those threads into one supportable place,
with the people who started them.

---

## 3 · Risks and edge cases

| Risk | How I'd handle it |
|---|---|
| **A fabricated or stale impact number.** | Mandatory citations; every figure stamped with its source, date, and model version; refusal when unsupported; the gold set catches regressions before release. Compass never computes an impact number — it retrieves what was reported and links to it. |
| **Someone sees content above their access.** | The permission filter runs at retrieval, per passage, before ranking — in code and as a database query, both fail-closed. Restricted content isn't access-gated in the index; it isn't in the index at all. A test fails the build if a restricted document ever appears in an answer. |
| **A crafted document or question manipulates the model.** | Instruction-like text inside retrieved documents is stripped at ingestion; documents that still read as an attack are quarantined. The model has no tools and can take no action — it only ever sees retrieved passages plus the question. |
| **Named participant data ends up in an answer.** | Detected and redacted at intake; documents that look like participant-level data are raised to the restricted tier and quarantined; participant identifiers are never indexed. |
| **The wrong grantee gets another's outcomes** (two similar names, a stale grant ID). | Confidence thresholds on entity matches, a human review queue for the uncertain ones, and the join is shown in the answer so a person can catch it. |
| **One bad answer collapses trust.** | Ship to a few design partners first and measure whether they stop double-checking. Never let an unverified answer leave the building. The honest "I don't have that" is a feature — teams trusted tools like this *more* once they reliably admitted their gaps. |
| **Silent data loss or double-counting.** | Every item accounted for; reconcile against the grant list; reversible de-duplication with the merge recorded. |
| **Zoom Chat retention / privacy.** | Confirm the actual retention setting and what staff were told before touching it. Likely deferred (see §4). |

---

## 4 · Tradeoffs — deliberately out of the first version

Every deferral removes risk without removing the core value: ask five years of grant
knowledge one question, get a cited answer.

- **Zoom Chat ingestion.** Highest privacy sensitivity, messiest data, uncertain
  retention — and the real decisions are usually written up somewhere else. Defer until
  there's a specific, owner-approved case for it.
- **Any write-back to source systems.** Read-only question-answering has a fraction of the
  risk surface. Actions come only once the read path is trusted.
- **A full five-year backfill on day one.** Start with the most recent ~3 years plus
  active grants — higher quality, answers most decisions — then extend.
- **A generative "written synthesis" answer.** Start with the cited source passages
  directly. A model-written summary is a config change that can be turned on once there's
  a zero-retention agreement with the vendor; it isn't needed for launch.
- **Fine-tuning on Foundation data.** Retrieval-only is cheaper, safer, and keeps
  sensitive data out of model weights.
- **Org-wide self-serve access.** Start with a small group of design partners. The whole
  team is the goal for a later phase, not the first version.
- **Rebuilding the impact model or the dashboard.** Those exist and are owned by the
  Impact team. Compass would *cite* the impact model, not reimplement it.

---

## First 90 days

Diagnosis first: shadow each team, inventory how AI tools are used today, map the repeated
workflows. Then bring a short, prioritized list of the highest-leverage automations to
co-decide — starting with a thin, permissioned slice for one team, shipped early, then
widened. Documented in the open the whole way, so anyone on the team can run it and extend
it.
