# Compass — hardening checklist ("how close to 100")

The honest state of every security control, what closes each remaining gap, and who has to
do it. Legend: **✅ done & tested in CI** · **🟡 done in code, needs the Foundation's
environment** · **⬜ not built — needs an outside party or a decision**.

`npm run ci` is the gate that keeps the ✅ column honest: a permission leak or a red-team
regression is a hard stop, not a warning.

---

## 1 · Access control — the security boundary

| Control | State | What's left |
|---|---|---|
| Retrieval-time permission filter (tier + ACL), runs **before** ranking, in code | ✅ | — |
| Same rule as a SQL `WHERE` clause — a second enforcement point | ✅ | — |
| **Fails closed** — empty `allowedTiers`/`acl`, or a failed group lookup → retrieves nothing | ✅ | — |
| `Restricted` tier never enters the index (metadata stub only for policy-restricted docs) | ✅ | — |
| Refusals reveal no count and don't confirm a match exists | ✅ | — |
| Zero permission leaks across the gold set + full-corpus set | ✅ `eval` / `eval:full` / `eval:pg` | — |
| Google Groups → permission groups, synced and cached | 🟡 (**built** — `src/security/directory.ts`) | The Admin SDK Directory resolver + TTL cache + fail-closed are written and unit-tested. Needs the Workspace admin to issue a read-only service account with domain-wide delegation (`admin.directory.group.readonly`) and set `GOOGLE_DIRECTORY_SUBJECT`. Falls back to the demo map until then. |
| Account deactivation cuts Compass access immediately | 🟡 (`/admin/revoke` + optional active-check) | `COMPASS_DIRECTORY_ACTIVE_CHECK=1` makes every sign-in also verify the account isn't suspended/archived (rejects → fail closed). For instant cut-off on the *existing* session, still wire `/admin/revoke` to the deprovisioning trigger (discovery X10). |

## 2 · Identity & session

| Control | State | What's left |
|---|---|---|
| Google OIDC, Authorization-Code + PKCE + `state` | ✅ `server:check` | — |
| ID-token verification: signature (RS256), `iss`, `aud`, `exp`, `iat`, `hd`, `email_verified` | ✅ `security` | — |
| Optional email allowlist for a scoped pilot | ✅ | — |
| Session = HMAC-signed `HttpOnly; Secure; SameSite=Strict` cookie, 8h TTL | ✅ | — |
| Constant-time session verification | ✅ | — |
| Server-side revocation — per user and global (incident lever); logout revokes | ✅ | — |
| Revocation store survives a restart / scales past one process | 🟡 (in-process map) | Redis with a TTL of the session lifetime. |
| **2-step verification** | inherited from Google Workspace | Confirm Workspace *enforces* 2FA for all staff (discovery X8). If it does, Compass needs no separate authenticator. If it doesn't, fix it at the Workspace level. |
| Hardware keys / Advanced Protection for high-privilege accounts | decision | Recommend for the data owner + any admin-group members. |
| Mobile: biometric app-lock, re-auth on foreground | ⬜ (scaffold only) | ~1 day in the Expo app; a local convenience lock on top of the real session. |

## 3 · Transport & deployment

| Control | State | What's left |
|---|---|---|
| Security response headers — CSP, `X-Frame-Options: DENY`, nosniff, COOP/CORP, `Permissions-Policy` | ✅ `server:check` asserts them | — |
| HSTS in production | ✅ (on when `NODE_ENV=production`) | — |
| No CORS allowlist — API and web app are one origin by design | ✅ | — |
| Web app CSP: `self` + Google Fonts only, no third-party script/frame/xhr | ✅ | Self-host the two fonts to remove even that one third-party origin (~1 hour). |
| TLS 1.2+ only, HSTS preload, HTTPS enforced at the load balancer | ⬜ | Deployment config. |
| No public inbound except 443; API, Redis, audit sink, raw store on a private network | ⬜ | Deployment / network policy. |
| Egress allowlist (the server can only reach the connector APIs + the IdP) | 🟡 (**in-process guard built**) | `src/util/egress.ts` wraps `fetch`: allowlist derived from the enabled connectors, cloud-metadata + RFC-1918 blocked by default, report-only unless `COMPASS_EGRESS_ENFORCE=1`. The network-layer policy (firewall / NetworkPolicy) is still the primary control. The one code-path SSRF vector (connector pagination) was already fixed: `sameHost()` + page cap. |
| Container image scanning in the deploy pipeline | ⬜ | Trivy / Grype in CI. `npm run deps:audit` already covers the npm tree. |

## 4 · Prompt injection & LLM attack surface

| Control | State | What's left |
|---|---|---|
| Instruction-like text in retrieved documents stripped at intake → "[removed: text targeting an AI assistant]" | ✅ | — |
| High-injection-score documents quarantined out of the index | ✅ | — |
| 15 planted injection docs + behavioural cases in the red-team suite (CI gate) | ✅ `redteam` | — |
| Query-side jailbreak ("admin override", roleplay, hypothetical) → refused | ✅ `redteam` | — |
| System-prompt-leak / "list everything" / enumeration requests → refused | ✅ `redteam` | — |
| Extractive by default — no model in the loop for the demo | ✅ | — |
| Generative backend, when enabled, receives **only** retrieved passages — never the corpus, never tools | ✅ (by construction) | — |
| Model has **no agency** — read-only, no write path to any source system | ✅ | — |
| Output scanned for PII / secret patterns before display | 🟡 (intake scrub is done) | Add an output-side pass as defense in depth (~half a day). |

## 5 · Data protection & PII

| Control | State | What's left |
|---|---|---|
| Deterministic PII scrubber (email, phone, SSN, EIN, card+Luhn, bank, IP, DOB, passport) at intake | ✅ | — |
| Participant-data heuristic → tier-raise to `restricted` + quarantine | ✅ | — |
| Optional NER name pass (multilingual) | 🟡 (opt-in; pulls in `@huggingface/transformers`) | Decide whether to run it; if yes, accept that dependency's advisories (see §8). |
| Four-tier sensitivity model + `never-ingest` list | 🟡 | Data owner signs off on the tier policy + the `never-ingest` list (discovery). |
| Cross-border transfer determination (Colombia / Kenya) | ⬜ | Counsel. Default posture — exclude participant PII — keeps it simple. |
| Spanish grant reports translated at intake, citation still points to the original | ✅ | — |

## 6 · Integrity & audit

| Control | State | What's left |
|---|---|---|
| Immutable content-addressed raw store; the index is fully derived | 🟡 | Production = a write-once object store. |
| SHA-256 per chunk; build manifest = git commit + content digest | ✅ | — |
| Tamper-evident hash-chained audit log; `verify()` finds the first broken link | ✅ `security` | — |
| Off-host audit streaming | 🟡 (`webhookSink` hook exists) | Point it at a write-once sink (S3 Object Lock, a SIEM). |
| Anomaly detection over the audit stream (restricted-probing, auth-brute, broad-sweep, withheld-surge, cost-spike) | ✅ | Wire the on-call hook to a real pager. |
| Usage / trust / cost dashboard | ✅ `/admin/stats` | — |

## 7 · Availability & response

| Control | State | What's left |
|---|---|---|
| Per-user rate + LLM-cost limiting → 429 + Retry-After | ✅ `server:check` | Redis-backed in production. |
| Request-body cap (64 KB), question cap (2 000 chars) | ✅ | — |
| Kill switch — `/admin/killswitch` → 503 until released; index rebuild is the containment story | ✅ | — |
| Incident playbooks (P1–P7) | 🟡 written | Run the tabletop (`docs/TABLETOP_EXERCISE.md`) with the DRI, COO's office, counsel. |
| Named, trained owner (DRI) | ⬜ | A person. The runbook is written for them. |

## 8 · Supply chain

| Control | State | What's left |
|---|---|---|
| `npm run deps:audit` in CI — fails on any high/critical in shipping deps (root + web runtime) | ✅ | — |
| Runtime dependency surface is minimal (`@electric-sql/pglite`; transformers.js is `optionalDependencies`) | ✅ | — |
| transformers.js advisories (`onnxruntime-node`, `adm-zip`, `sharp`→libvips) — no upstream fix | 🟡 quarantined | Reachable only with `COMPASS_TRANSLATE=mt`, `COMPASS_PII_NER=true`, or an `--embed` build. The default path loads none of them. Re-evaluate before enabling a backend. |
| Continuous CVE alerting (Dependabot / Renovate) | ⬜ | Turn it on in the repo. |
| SBOM generation | ⬜ | `syft` in CI. |
| Pin the dated model snapshot in the vendor call (not just "sonnet-5") | ⬜ | One line, when a generative backend is chosen. |
| Third-party penetration test | ⬜ | An independent firm, ~2 weeks + remediation. A Phase 3 exit criterion. This is the single biggest external item. |

---

## What "100" looks like — the short list

Everything above is either ✅ or has a named owner. The items that actually move the needle,
in order:

1. **Third-party penetration test** — the one thing a self-graded suite can't replace.
2. **Redis + KMS + private network + egress allowlist** — the production deployment, ~1 week.
3. **Google Groups integration** — *the resolver is built and tested* (`src/security/directory.ts`); it needs the Workspace admin to issue a read-only service account, then it's a config change. Still wire `/admin/revoke` to the deprovisioning trigger for instant session cut-off.
4. **Data-owner sign-off** on the tier policy and `never-ingest` list — a meeting, not code.
5. **Zero-retention LLM agreement** — only needed to turn on written synthesis; extractive needs nothing.
6. **Run the tabletop; name the DRI.**

None of these are blockers for a pilot on synthetic or low-sensitivity data. All of them
are required before five years of real grantee data goes in.
