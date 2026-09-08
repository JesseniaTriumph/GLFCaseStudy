# Security model

Compass concentrates years of sensitive grant material into one queryable place. That
concentration is the central risk, and the design treats it that way.

- **Doing a penetration test?** Start at [`PENTEST.md`](PENTEST.md) (setup + test accounts)
  and [`deliverables/P_PenTest_Scope.md`](deliverables/P_PenTest_Scope.md) (scope + pass bar).
- **Full control-by-control state:** [`docs/HARDEN_CHECKLIST.md`](docs/HARDEN_CHECKLIST.md).
- **Framework mapping** (NIST CSF 2.0 / 800-53 / SOC 2 / AI RMF + **OWASP Top 10** + **OWASP
  LLM Top 10**): [`docs/CONTROLS_MATRIX.md`](docs/CONTROLS_MATRIX.md).
- **Lifecycle review** (MAP · ATTACK · HARDEN · MONITOR · RESPOND):
  [`deliverables/G_Security_Review.md`](deliverables/G_Security_Review.md).
- **Production deployment:** [`docs/DEPLOY_CHECKLIST.md`](docs/DEPLOY_CHECKLIST.md).

## The security boundary is retrieval-time access control

`src/retrieval/search.ts` (`mayRead`) filters every candidate chunk against the caller's
`Principal`, **before ranking**:

```
tier ∈ principal.allowedTiers          AND          chunk.acl ∩ principal.principals ≠ ∅
```

The same rule exists as a SQL `WHERE` clause (`src/db/store.ts`, `npm run eval:pg`). It
**fails closed**: an empty `allowedTiers` (a failed group lookup) retrieves nothing.

- `restricted` is **never** in `allowedTiers` for any principal.
- `restricted` docs are **not indexed** — a metadata-only stub for policy-restricted docs
  lets Compass say "that's restricted" without the content being reachable; PII-raised docs
  leave no stub at all.
- A refusal reveals no count and does not confirm a matching record exists.
- UI hiding is not a control. The filter is.

## Tiers

| Tier | Who | In the index? |
|---|---|---|
| `team` | any signed-in `@gitlabfoundation.org` staff | yes |
| `programs-only` | Programs, Impact, Executive, Donor Engagement, Finance/Grants-Ops | yes |
| `restricted` | nobody, via Compass | **no — metadata stub only** |
| `never-ingest` | — | no (a connector never pulls it) |

Full policy + the `never-ingest` list: `docs/TIER_POLICY.md`.

## Built and runnable in this repo

| Control | Where | Proof |
|---|---|---|
| **OIDC Authorization-Code + PKCE** login flow; RS256 ID-token verification (sig / iss / aud / exp / iat / `hd` / `email_verified`) | `src/server/oauth.ts`, `src/security/auth.ts` | `npm run security` (token forgery, `hd` bypass, expiry) · `npm run server:check` (full flow, replay, logout revoke) |
| **Retrieval-time tier + ACL filter** — in code and as a SQL `WHERE` clause; fails closed | `src/retrieval/search.ts`, `src/db/store.ts` | `npm run eval` / `eval:pg` / `eval:full` — 12/12 each, **0 permission leaks** |
| **`Restricted` excluded from the index** | `src/pipeline/run.ts` | eval `*-restricted` cases |
| **Session** — HMAC `HttpOnly; Secure; SameSite=Strict` cookie, 8h TTL, constant-time verify, per-user + global server-side revocation | `src/server/session.ts` | `npm run server:check`, unit tests |
| **Group resolution** — read-only Admin SDK Directory lookup, cached, fails closed, optional suspended-account check | `src/security/directory.ts` | unit tests |
| **Indirect prompt injection** — pattern-strip + score-quarantine at intake; 15 planted docs + behavioural cases | `src/pipeline/run.ts`, `src/adapters/mockInjection.ts` | `npm run redteam` — 16/16, 0 leaks |
| **PII** — deterministic scrub (email/phone/SSN/EIN/card+Luhn/bank/IP/DOB/passport) + participant-data heuristic → tier-raise + quarantine | `src/pipeline/pii.ts` | unit tests, red-team PII cases |
| **Tamper-evident audit log** — append-only, hash-chained; off-host stream hook | `src/security/audit.ts` | `npm run security` detects an edited entry; `npm run audit` |
| **Anomaly monitor** — restricted-probing / auth-brute / broad-sweep / withheld-surge / cost-spike → IR playbooks | `src/security/monitor.ts` | unit tests, `server:check` |
| **Rate + LLM-cost limiting** → 429 + Retry-After; 64 KB body cap; 2 000-char question cap | `src/server/limits.ts`, `src/server/app.ts` | `server:check` |
| **Kill switch** — `/admin/killswitch` → 503 until released | `src/server/app.ts` | `server:check` |
| **Response hardening** — CSP, `X-Frame-Options: DENY`, nosniff, COOP/CORP, `Permissions-Policy`, HSTS in prod; page-scoped CSP on the web app | `src/server/app.ts`, `src/server/static.ts` | `server:check` asserts them |
| **Egress allowlist** — `fetch` guard: connector/IdP hosts only, cloud-metadata + RFC-1918 blocked; report-only → enforce | `src/util/egress.ts` | unit tests; `COMPASS_EGRESS_ENFORCE=1` |
| **Dependency advisories** — high/critical in shipping deps fails the gate | `scripts/deps-audit.ts`, `.github/dependabot.yml` | `npm run deps:audit` |
| **Read-only sources** — no adapter has a write path | `src/adapters/*` | code review |
| **Content hashing + signed build manifest** (commit + content digest) | `src/pipeline/run.ts` | `npm run build:index` |
| **Promotion gate** — nothing reaches a live index without it green | `scripts/ci.ts`, `.github/workflows/ci.yml` | `npm run ci` — a leak or red-team regression is a hard stop |

## Still needs the Foundation's environment or an outside party

- **Third-party penetration test** — scope written (`deliverables/P_PenTest_Scope.md`).
- **KMS** for secrets, **Redis** for the rate-limiter/revocation store, **write-once
  off-host** audit storage, the **network-layer egress policy**, TLS 1.2+ / HSTS preload —
  `docs/DEPLOY_CHECKLIST.md`.
- **The service-account credential** for the live Directory lookup (the resolver is built).
- **Data-owner sign-off** on the tier policy + `never-ingest` list — `deliverables/Q_Data_Owner_Signoff.md`.
- **Zero-retention + no-training LLM agreement + DPA** — only to turn on written synthesis;
  extractive mode needs no external model.
- **Cross-border determination** for Colombia (Ley 1581) / Kenya (DPA 2019); default
  posture excludes participant PII.
- **Run the tabletop** (`docs/TABLETOP_EXERCISE.md`); name the DRI.

## Reporting

This is a case-study prototype. For the real system, security issues go to the designated
data owner (COO's office) per `docs/INCIDENT_RESPONSE.md`.
