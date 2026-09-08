# Compass — controls matrix

Security & privacy controls mapped to the frameworks named in the strategy doc (§6.12):
**NIST CSF 2.0**, **NIST SP 800-53** (moderate), **SOC 2** (Security, Confidentiality),
**NIST AI RMF**, and the **OWASP Top 10 (2021)** + **OWASP Top 10 for LLM Applications
(2025)**. Status is what is true in this repo today.

Legend: ✅ built & tested · 🟡 built, needs the Foundation's environment · 📝 designed / documented

The OWASP rows are broken out in their own tables after the main matrix — one for the
web-app Top 10, one for the LLM Top 10 — because a security reviewer reads those as a
checklist. `npm run deps:audit` (OWASP A06) and the response-header set (A05) are wired
into `npm run ci`, so a regression on either blocks promotion.

| # | Control | Framework refs | How Compass implements it | Status |
|---|---|---|---|---|
| AC-1 | Identity: federated SSO, hosted-domain enforced | CSF PR.AA, 800-53 IA-2/IA-8, SOC 2 CC6.1 | Google OIDC Authorization-Code + PKCE; RS256 ID-token verification checks `iss/aud/exp/iat/hd/email_verified` (`src/security/auth.ts`) | ✅ |
| AC-2 | Authorization: least privilege, group-driven | CSF PR.AA-05, 800-53 AC-3/AC-6 | Tier + ACL per chunk; `principalFromGroups` maps Google Groups → allowed tiers; **fails closed** if the group lookup fails | ✅ |
| AC-3 | Retrieval-time access control as the security boundary | CSF PR.DS, AI RMF MEASURE 2.7 | The permission filter runs before ranking, in code — also as a SQL `WHERE` clause (`src/db/store.ts`); `npm run eval` / `eval:pg` prove zero leaks | ✅ |
| AC-4 | Session management | 800-53 SC-23, SC-10 | HMAC-signed `HttpOnly; Secure; SameSite=Strict` cookie, 8h TTL; per-user + global server-side revocation (`revokeUser` / `revokeAll`); logout revokes | ✅ |
| AC-5 | Rate / cost limiting | CSF PR.IR-04, 800-53 SC-5, OWASP A04 / LLM10 | Per-user token buckets (request rate + LLM cost) → 429 + Retry-After (`src/server/limits.ts`); production = Redis | 🟡 |
| AC-6 | HTTP response hardening | 800-53 SC-18, OWASP A05 | JSON API: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Frame-Options: DENY`, nosniff, COOP/CORP `same-origin`, `Permissions-Policy`, HSTS in prod. Web app (`src/server/static.ts`): a page CSP allowing only `self` + Google Fonts — no third-party script, frame, or XHR. `npm run server:check` asserts both. No CORS allowlist by design — API + web app are one origin | ✅ |
| AC-7 | Request-body limits | 800-53 SC-5, OWASP A04 / LLM10 | 64 KB body cap (`req.destroy()` past it), question truncated to 2 000 chars, all `/api/feedback` fields type-guarded and length-capped (`src/server/app.ts`) | ✅ |
| DP-1 | Sensitivity classification (four tiers + never-ingest) | CSF ID.AM-05, SOC 2 C1.1 | `Tier` model; `docs/TIER_POLICY.md`; data owner signs off | 🟡 |
| DP-2 | Restricted content never indexed | CSF PR.DS-01, 800-53 SC-28 | Tier exclusion at ingest; metadata-only stub for policy-restricted docs; PII-raised docs leave no stub | ✅ |
| DP-3 | PII detection & redaction at intake | CSF PR.DS, AI RMF MAP 5.1, Ley 1581 / Kenya DPA | Deterministic identifier scrub + Luhn + participant-data heuristic → tier-raise → quarantine (`src/pipeline/pii.ts`); optional NER name pass (`src/pipeline/ner.ts`) | ✅ / 🟡 (NER) |
| DP-4 | Cross-border transfer determination (CO / KE) | Ley 1581, Kenya DPA 2019 | Documented as a Phase 1 legal step; default posture = exclude participant PII | 📝 |
| IN-1 | Immutable raw store; index fully derived | CSF PR.DS-01, 800-53 CP-2 | Content-addressed raw store + manifest (`src/pipeline/rawstore.ts`); production = write-once object store | 🟡 |
| IN-2 | Content integrity: hashing + signed build manifest | CSF PR.DS-06, 800-53 SI-7 | SHA-256 per chunk; manifest = git commit + content digest | ✅ |
| IN-3 | Tamper-evident audit log | CSF DE.AE, PR.PS-04, SOC 2 CC7.2 | Hash-chained JSONL; `verify()` reports the first broken link; `npm run audit` | ✅ |
| IN-4 | Off-host audit streaming | 800-53 AU-9(2) | `AuditSink` / `webhookSink` — each record shipped to an external endpoint (`COMPASS_AUDIT_WEBHOOK`) | 🟡 |
| AI-1 | Grounded answers only; model phrases, never decides | AI RMF GOVERN 1.1, MEASURE 2.9 | Extractive by default; a generative backend gets only retrieved passages + the question, never the corpus | ✅ |
| AI-2 | Confidence = evidence quality, operationally defined | AI RMF MEASURE 2.8 | `gradeConfidence`: coverage, source agreement, freshness, citation completeness — never a model self-report | ✅ |
| AI-3 | Fail visibly: abstention, coverage disclosure, conflict surfacing | AI RMF MEASURE 2.6 | Refuses on thin/blocked/unknown-subject/enumeration; every answer states what was and wasn't searched; conflicting figures are shown, not merged | ✅ |
| AI-4 | Indirect-prompt-injection defense | AI RMF MEASURE 2.7, MANAGE 2.2 | Injection-pattern stripping + injection-score quarantine at intake; 15 planted docs + behavioural cases in `npm run redteam` | ✅ |
| AI-5 | Adversarial evaluation as a release gate | AI RMF MEASURE 2.7, MANAGE 4.1 | `npm run redteam` + `npm run eval` inside `npm run ci`; a leak is a hard stop | ✅ |
| MO-1 | Anomaly detection over the audit stream | CSF DE.AE, DE.CM | `src/security/monitor.ts` — restricted-probing, auth-brute, broad-sweep, withheld-surge, cost-spike; each maps to a playbook | ✅ |
| MO-2 | Usage / trust / cost visibility | CSF GV.OC, SOC 2 CC4.1 | `GET /admin/stats` + `npm run stats` | ✅ |
| RS-1 | Kill switch + index rebuild | CSF RS.MI, 800-53 IR-4 | `POST /admin/killswitch`; index derived from the raw store | ✅ |
| RS-2 | Incident playbooks | CSF RS.MI, 800-53 IR-8 | `docs/INCIDENT_RESPONSE.md` (P1–P7); tabletop = `docs/TABLETOP_EXERCISE.md` | 📝 (playbooks written; not yet exercised) |
| RS-3 | Third-party penetration test | SOC 2 CC4.1, 800-53 CA-8 | Scoped; external vendor; a Phase 3 exit criterion | 📝 |
| SC-1 | Connector credentials in a KMS | 800-53 SC-12, SC-28, OWASP A02 | Designed; `secrets/` git-ignored; production = Cloud KMS / Secret Manager | 📝 |
| SC-2 | Egress allowlist | 800-53 SC-7, OWASP A10 | Designed; production network policy. Known SSRF vector (connector pagination) already fixed in code: `sameHost()` check + page cap (`src/adapters/givingData.ts`) | 🟡 |
| SC-3 | Dependency vulnerability gate | 800-53 RA-5, SI-2, OWASP A06 | `npm run deps:audit` fails the CI gate on any high/critical advisory in shipping deps (root runtime + web runtime). The transformers.js backends are `optionalDependencies` (their libvips/onnxruntime advisories are informational — reachable only with `COMPASS_TRANSLATE=mt`, `COMPASS_PII_NER=true`, or an `--embed` build) | ✅ |
| SC-4 | Parameterized queries | 800-53 SI-10, OWASP A03 | The SQL permission filter uses bound parameters only (`WHERE tier = ANY($1) AND acl && $2`); no string-built SQL. Answer text is rendered as escaped markdown, never raw HTML | ✅ |

## OWASP Top 10 (2021) — web application

| ID | Category | Compass control | Status |
|---|---|---|---|
| A01 | Broken access control | Fail-closed ACL + tier filter runs **before** ranking, in code *and* as a SQL `WHERE` clause; `npm run eval` / `eval:pg` prove zero leaks; empty `allowedTiers`/`acl` → retrieve nothing (AC-2, AC-3) | ✅ |
| A02 | Cryptographic failures | RS256 ID-token verification; HMAC-signed `HttpOnly; Secure; SameSite=Strict` session cookie; SHA-256 hash chain on the audit log; TLS + HSTS in prod (AC-1, AC-4, IN-2, IN-3) | ✅ / 🟡 (KMS) |
| A03 | Injection | Parameterized SQL only; React auto-escapes rendered answers; no `dangerouslySetInnerHTML`; prompt injection handled separately under LLM01 (SC-4) | ✅ |
| A04 | Insecure design | Threat model + tier policy; immutable raw store, index fully derived; adversarial eval (`npm run redteam`) is a release gate; body / question / cost caps (SC-4, IN-1, AI-5, AC-7) | ✅ |
| A05 | Security misconfiguration | Hardened response headers on the API *and* a page-scoped CSP on the web app, both asserted by `npm run server:check`; no CORS allowlist by design; `/health` leaks only a chunk count; `/api/config` exposes sign-in options but no identity (AC-6). Remaining items (TLS config, private network, egress allowlist) are deployment-environment — tracked in `docs/HARDEN_CHECKLIST.md` §3 | ✅ (code) / 🟡 (deploy) |
| A06 | Vulnerable & outdated components | `npm run deps:audit` in CI fails on high/critical in shipping deps; transformers.js moved to `optionalDependencies` so its unfixable native-dep advisories don't reach the default path (SC-3) | ✅ |
| A07 | Identification & auth failures | Google OIDC Authorization-Code + PKCE + `state`; `iss/aud/exp/iat/hd/email_verified` all checked; constant-time session verify; 8 h TTL; per-user + global server-side revocation; logout revokes (AC-1, AC-4) | ✅ |
| A08 | Software & data integrity failures | Hash-chained tamper-evident audit log; build manifest = git commit + content digest; content-addressed raw store; CI promotion gate (IN-2, IN-3, AI-5) | ✅ |
| A09 | Logging & monitoring failures | Tamper-evident JSONL audit; `src/security/monitor.ts` raises restricted-probing / auth-brute / broad-sweep / withheld-surge / cost-spike signals; off-host streaming hook; `GET /admin/stats` (IN-3, IN-4, MO-1, MO-2) | ✅ / 🟡 (off-host sink) |
| A10 | Server-side request forgery (SSRF) | Connector-pagination SSRF fixed: `sameHost()` check + 10 000-page cap (`src/adapters/givingData.ts`); egress allowlist designed for the production network (SC-2) | 🟡 |

## OWASP Top 10 for LLM Applications (2025)

| ID | Category | Compass control | Status |
|---|---|---|---|
| LLM01 | Prompt injection | `INJECTION_PATTERNS` stripping + `injectionScore()` quarantine at intake; query-side jailbreak refusal; 15 planted docs + behavioural cases in `npm run redteam` (CI gate) (AI-4) | ✅ |
| LLM02 | Sensitive information disclosure | `Restricted` tier never indexed (metadata stub only for policy-restricted; none for PII-raised); deterministic PII scrubber + participant-data heuristic; refusals reveal no count and don't confirm a match exists (DP-2, DP-3, AI-3) | ✅ |
| LLM03 | Supply chain | Models pinned by exact id (`Xenova/bge-small-en-v1.5`, opus-mt, NER); transformers.js is optional; zero-retention LLM agreement is a Phase-1 legal step (SC-3, AI-1) | 🟡 |
| LLM04 | Data & model poisoning | Sources are read-only; immutable content-addressed raw store; injection quarantine at intake; per-chunk hashing detects post-hoc tampering (IN-1, IN-2, AI-4) | ✅ |
| LLM05 | Improper output handling | Extractive by default; the generative backend receives only retrieved passages + the question, never the corpus or tool access; output escaped on render (AI-1, SC-4) | ✅ |
| LLM06 | Excessive agency | Compass is **read-only**, has no tools and never writes back to any source system; the model phrases, it never decides what to retrieve or whether to release it (AI-1) | ✅ |
| LLM07 | System-prompt leakage | Enumeration / "reveal your system prompt" / meta-dump requests are refused (`isEnumerationRequest()`, `metaDumpRequest`); redteam case covers it (AI-3) | ✅ |
| LLM08 | Vector & embedding weaknesses | The permission filter runs before ranking, so no similarity search can reach content the principal can't see; `Restricted` content is never embedded at all (AC-3, DP-2) | ✅ |
| LLM09 | Misinformation | Operational confidence = coverage + source agreement + freshness + citation completeness (never a model self-report); conflicting figures shown side-by-side, not merged; abstains on thin evidence; every claim carries a citation (AI-2, AI-3) | ✅ |
| LLM10 | Unbounded consumption | Per-user token buckets (request rate + LLM cost) → 429 + Retry-After; 64 KB body cap; 2 000-char question cap (AC-5, AC-7) | ✅ / 🟡 (Redis in prod) |

## Where the gaps are

Everything marked 📝 needs the Foundation's environment or an external party — the pen
test, the KMS, the egress policy, the cross-border legal determination, and exercising the
playbooks. Everything ✅ runs and is tested in this repo today. `npm run ci` is the gate
that keeps the ✅ column honest.

On the OWASP tables specifically, the two items that aren't fully ✅:

- **A10 / SC-2 (SSRF)** — the one known code-path vector (connector pagination) is fixed
  and tested; a network-level egress allowlist still belongs in the production deployment.
- **LLM03 (supply chain)** — models are pinned and the risky package is optional, but the
  zero-retention agreement with the LLM vendor is a legal step only the Foundation can take.
  Until then Compass runs extractive-only, which needs no external model at all.

The transformers.js advisories (`onnxruntime-node`, `adm-zip`, `sharp` → libvips CVEs)
have no upstream fix. They are quarantined in `optionalDependencies`: the default demo and
the whole CI path load none of them. `npm run deps:audit` prints them as an informational
line so the risk is visible if the Foundation later enables the `mt` translator, NER, or a
dense-embedding build.

**The full control-by-control state — what's done, what's left, and who has to do it — is
in `docs/HARDEN_CHECKLIST.md`.** The short version of "what gets us to 100": a third-party
penetration test, the production deployment (Redis / KMS / private network / egress
allowlist), the Google Groups integration, a data-owner sign-off on the tiers, and — only
for written synthesis — a zero-retention LLM agreement.
