# Compass — capability verification

**What this is:** a line-by-line check of what Compass was described as doing against what
the code actually does — data privacy, safety, cybersecurity, data cleanup — plus a code
review. Written so the claims and the build match exactly, with no gap a reviewer could
find on their own.

**Method:** read every relevant module; ran the full promotion gate (`npm run ci`), a
headless-browser walkthrough of every control (`npm run ui:audit`, 54/54), and a smoke test
of the offline retrieval path (`npm run ui:offline`, 10/10).

**Repo:** `github.com/JesseniaTriumph/GLFCaseStudy` · **Live:** `compass-demo-gwk4.onrender.com`

---

## 1 · Verified — the build does what was described

| Capability | Where it lives | Evidence |
|---|---|---|
| **Four sources behind a swappable connector layer** — Google Drive, GivingData, Airtable, Zoom Team Chat | `src/adapters/` — one `SourceAdapter` interface; real adapters + a mock per source; the pipeline downstream of `pull()` never knows the source | `npm run build:index` |
| **A new source is one file** | `src/adapters/types.ts` — `pull()` is the whole contract. Notion is already implemented (gated); Slack / email / a CRM would each be one adapter | code review |
| **Role-aware access control** | `src/security/auth.ts` `principalFromGroups()` — a user's permission *group* maps to a sensitivity tier; a per-document ACL is checked as well | `docs/TIER_POLICY.md` |
| **Conflict detection — disagreeing records flagged, not merged; who to ask surfaced** | `src/retrieval/answer.ts` `findLabeledConflicts()` (same figure, two values → both shown with citations); `src/retrieval/followups.ts` `whoToAsk` / `whyAsk` (from the entity graph — who actually worked the grant) | eval case `conflicting-figures-shown-not-merged` |
| **Automated follow-up email draft for verification** | `src/retrieval/followups.ts` `draftEmail` — addressed to the relevant internal person, lists the gaps and the specific questions | generated only when there is an internal recipient with an address |
| **Confidence scoring with plain-language labels** | `src/retrieval/answer.ts` `gradeConfidence()` — **high / medium / low / refused**, computed from *coverage · source agreement · freshness · citation completeness* — never the model's own certainty | shown on every answer |
| **Data cleanup — deduplicate first, then rank by source trust and recency** | `src/pipeline/run.ts` — clean → PII scrub → extraction-confidence quarantine → prompt-injection quarantine → dedupe (exact / near / cross-system) → authoritative-copy selection (structured GivingData record > Drive working figure; higher extraction confidence; newer) | `npm run reconcile` |
| **Zoom retention is 6 months to 2 years; longer history needs external archiving** | `src/adapters/zoom.ts` header + `probeZoomChatRetention()` reads the account's real setting; `ZOOM_ARCHIVE` support for the Meeting/Webinar archive-files API | `deliverables/M_Decision_Packet.md` — recommendation is to keep Zoom out of v1 |
| **Auto-translation for Spanish grantee reports** | `src/pipeline/translate.ts` — any language → English **at ingestion**; the citation still deep-links to the Spanish original; a translated passage is labelled "machine translation — verify against the source" | eval cases `multilingual-spanish-retrieval`, `full-fondo-adelante-spanish` |
| **Light / dark mode for accessibility** | `web/src/App.tsx` `useTheme()` — two-way toggle, honours `prefers-color-scheme` on first visit, persists the choice | every text/background pair audited ≥ WCAG 2.1 AA in both modes, all tabs |
| **A completed security lifecycle review** | `deliverables/G_Security_Review.md` (MAP · ATTACK · HARDEN · MONITOR · RESPOND) · `docs/CONTROLS_MATRIX.md` (NIST CSF 2.0 / SP 800-53 / SOC 2 / NIST AI RMF + OWASP Top 10 + OWASP LLM Top 10) · `docs/HARDEN_CHECKLIST.md` (39 controls, built + tested) | `npm run security` · `npm run redteam` |

---

## 2 · Three descriptions to tighten (the build is more precise than the shorthand)

### 2.1 Access control is by **function**, not **seniority**

The tier a person can retrieve is set by their permission *group* — Programs, Impact,
Finance/Grants-Ops, Executive, Partnerships see the internal `programs-only` tier;
Communications and the Board see `team` tier only. **A Program Associate and the CEO see
the same tiers** (`docs/ROLES_AND_USERS.md`). The Board is the most senior group and sees
the least.

This is deliberately stronger than seniority-gating: it survives a promotion, it lets a
junior program officer see diligence a senior communications lead should not, and it maps
cleanly onto Google Groups the Foundation already maintains. Describe it as **role- and
group-based ACL + a four-tier sensitivity scheme**, with `restricted` excluded from the
index for everyone.

| Tier | Who can retrieve it | In the index? |
|---|---|---|
| `team` | any signed-in `@gitlabfoundation.org` staff | yes |
| `programs-only` | Programs, Impact, Executive, Donor Engagement, Finance/Grants-Ops, Legal | yes |
| `restricted` | **no one, through Compass** — board, compensation, legal negotiation, declined-applicant diligence, any doc naming an individual participant | **no — a metadata stub only** |
| `never-ingest` | — | never pulled by a connector |

### 2.2 Translation is one-directional (source → English), not a cross-language interface

A Spanish grantee report is rendered into English **at ingestion** so an English-speaking
program officer can read the evidence brief; the citation still opens the Spanish original.
There is currently **no** Spanish output, no per-user language preference, and no Spanish
UI — a Spanish-first staff member does not yet get answers in Spanish.

The `Translator` interface already exists; adding a `toSpanish` direction plus a per-user
language preference is a scoped addition, not a redesign. It is logged as discovery
question **D14a** (`deliverables/E_Discovery_Questions.md`) — build it only if an interview
confirms a staff-side language need.

### 2.3 The security *review* is complete; six items still need the Foundation or an outside party

The review document is done and 39 controls are built and tested in the repo. The review
itself records what is **not** closed (`SECURITY.md` → "Still needs the Foundation's
environment or an outside party"):

1. **Third-party penetration test** — scope of work written (`deliverables/P_PenTest_Scope.md`), not yet run.
2. **Colombia / Kenya cross-border data-transfer determination** — outstanding; counsel's written position needed before real grantee data.
3. **KMS** for connector secrets, **Redis** for the rate-limiter / revocation store, **write-once off-host** audit storage, a **network-layer egress policy** — provisioned resources in the Foundation's cloud; the code already targets them behind interfaces.
4. **Data-owner sign-off** on the tier policy and the `never-ingest` list (`deliverables/Q_Data_Owner_Signoff.md`).
5. **Zero-retention + no-training LLM agreement + DPA** — only needed to turn on written synthesis; the default extractive mode uses no external model.
6. **Run the tabletop exercise** (`docs/TABLETOP_EXERCISE.md`); name the DRI.

**Review verdict:** *Prototype — CONDITIONAL (safe to run and demo on synthetic data).
Production — BLOCKED until 1–6 close.* None of the blockers are engineering.

---

## 3 · Where the security and privacy posture is solid

| Area | What is built and tested |
|---|---|
| **The permission boundary** | Enforced at retrieval, **before ranking**, in code (`mayRead`) *and* as a SQL `WHERE` clause (`src/db/store.ts`). Fails closed — an empty tier list or a failed group lookup retrieves nothing. `restricted` is never indexed. A refusal reveals no count and does not confirm a record exists. **46/46 gold + 25/25 five-year-corpus + 17/17 adversarial red-team, 0 permission leaks**, gated in CI. |
| **Authentication** | Real RS256 OpenID Connect verification — signature, `iss`, `aud`, `exp`, `iat`, hosted-domain, `email_verified` — with no JWT library, so the checks are visible. HMAC `HttpOnly; Secure; SameSite=Strict` session, 8 h TTL, constant-time verify, per-user and global server-side revocation. |
| **Group resolution** | Read-only Google Admin SDK Directory lookup, cached, fail-closed, optional suspended-account check. |
| **Indirect prompt injection** | Instruction-like text stripped at intake ("[removed: text targeting an AI assistant]"); high-score documents quarantined out of the index; 15 planted injection documents + behavioural cases in the red-team (CI gate). A retrieved document is treated as data, never as instructions. |
| **PII** | Deterministic scrubber — email, phone, SSN, EIN, card + Luhn check, bank account, IP, date of birth, passport — plus a participant-data heuristic that raises a document to `restricted` and quarantines it. Participant identifiers are never indexed. |
| **Audit** | Append-only, hash-chained, tamper-evident log; `verify()` finds the first broken link; an off-host stream hook (`webhookSink`). Every query is logged. |
| **Anomaly monitoring** | Restricted-probing, auth-brute, broad-sweep, withheld-surge, cost-spike — each mapped to an incident-response playbook (`docs/INCIDENT_RESPONSE.md`). |
| **Abuse limits** | Per-user request-rate and LLM-cost token buckets → `429` + `Retry-After`; 64 KB body cap; 2 000-character question cap. |
| **Containment** | Kill switch (`/admin/killswitch` → `503` until released). The index is fully derived, so kill + rebuild is the whole containment story. |
| **Network** | In-process egress allowlist — connector/IdP hosts only; cloud-metadata and RFC-1918 ranges blocked. Read-only connectors — no adapter has a write path to any source system. |
| **Response hardening** | CSP, `X-Frame-Options: DENY`, `nosniff`, COOP/CORP, `Permissions-Policy`, HSTS in production — on the API and the web app, asserted in CI. |
| **Supply chain** | High/critical dependency advisories fail the promotion gate; Dependabot configured. |
| **Regional privacy** | Kenya DPA 2019 and Colombia Ley 1581 named in the design; the default posture keeps participant-level personal data out of the index entirely; geography-scoped exclusion is supported through the tier / `never-ingest` list. |

---

## 4 · Code review

### 4.1 Fixed during this pass

| Finding | Resolution |
|---|---|
| **`web/src/lib/` was a hand-maintained copy of the retrieval core (~2,000 lines) and had drifted 88 lines** — the offline/static path was missing the privileged-legal refusal and the broadened portfolio-schedule detection | Deleted the copy. The web app now imports the modules straight from `src/` via a `@compass/*` alias — one source of truth. A new smoke test (`npm run ui:offline`, 10/10) covers that path so it can't silently diverge again. |
| Stale test counts (`12/12`, `16/16`) in `SECURITY.md`, `README.md`, `G_Security_Review.md`, the deck | Refreshed to current: eval 46/46, eval:pg 46/46, eval:full 25/25, redteam 17/17, server:check 20/20, 166 unit tests. |
| A `SourceAdapter` code comment listed an "email adapter" that doesn't exist | Corrected — a new source is one file implementing `pull()`. |
| The web React app had its own `tsconfig` excluded from CI; a `serverMode`-scope bug reached production once | `typecheck:web` is now step 2 of the promotion gate. |
| No lint gate | Added ESLint (`typescript-eslint` + `react-hooks`), wired as step 3 of `npm run ci` (errors gate; `any`-warnings don't). Fixed the 19 it flagged — unnecessary regex escapes, two stray zero-width characters in source, dead variables, ternary-as-statement. |

### 4.2 Clean

- `strict: true` TypeScript on both tsconfigs. No `@ts-ignore`. No `TODO` / `FIXME` / `HACK` in the code.
- 166 unit tests, ~96 % line coverage on the logic modules; `npm run coverage` reports it.
- `npm run ci` is an eleven-step promotion gate — typecheck (×2), lint, tests, dependency advisories, the pipeline, three eval sets, the security checks, the server checks, the red-team — and a permission-leak finding or a red-team regression is a hard stop.
- `npm run ui:audit` drives every tab, persona, example, toggle, citation, feedback control and dossier button in a headless browser and asserts nothing renders blank and no request errors — 54/54. `npm run ui:offline` does the same for the static path — 10/10.
- The web app has zero `any`.

### 4.3 Minor — worth doing, not blockers

| Item | Effort |
|---|---|
| ~22 `any` remaining in `src/` — all in adapters parsing untyped external API JSON (Notion / Zoom / Airtable) and the `meta` bag; ESLint flags each as a warning. Add response types. | ~2 hours |
| `web/src/App.tsx` is ~780 lines — split `Dossier` and `HowItWorks` into their own files. | ~1 hour |
| Two `react-hooks/exhaustive-deps` warnings in `App.tsx` — the effects are intended to run on a subset of deps; make that explicit or restructure. | ~20 minutes |

---

## 5 · Bottom line

Every capability described is in the code and tested, with three shorthand phrasings that
should be stated more precisely (access is by function not seniority; translation is
one-directional; the security *review* is complete but six non-engineering items remain).
The security and privacy design is thorough and enforced by tests in CI. The one real code
smell — a duplicated retrieval core that had drifted — is fixed.

*All data in the prototype is synthetic and fictional.*
