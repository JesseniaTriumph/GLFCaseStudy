# Compass — production deployment checklist

`npm run demo` gets you one clean URL for a demo. This is the gap between that and a
production instance holding real grantee data. Work top to bottom; the data owner signs
off at the end. Cross-references: `docs/HARDEN_CHECKLIST.md`, `deliverables/I_Cost_Model.md`,
`deliverables/G_Security_Review.md`.

Legend: **[code]** already built, just configure · **[infra]** stand up the resource ·
**[people]** a decision or sign-off.

---

## 1 · Identity & access

- [ ] **[infra]** Create a Google Cloud OAuth **Web** client. Redirect URI
  `https://<host>/auth/callback`. Consent screen = **Internal**.
- [ ] **[infra]** Create a **read-only service account** with domain-wide delegation for
  the Directory lookup. Scopes: `admin.directory.group.readonly` +
  `admin.directory.user.readonly`. Nominate an admin for `GOOGLE_DIRECTORY_SUBJECT`.
- [ ] **[people]** Define the Google Groups that map to each tier (see
  `docs/ROLES_AND_USERS.md`): which groups get `programs-only`, which get `team` only.
- [ ] **[code]** Set `GOOGLE_SA_KEY_JSON`/`GOOGLE_SA_KEY_FILE` + `GOOGLE_DIRECTORY_SUBJECT`
  → the server uses the real Directory resolver (startup log: `group source: Google Directory`).
- [ ] **[code]** Set `COMPASS_DIRECTORY_ACTIVE_CHECK=1` (reject suspended accounts at sign-in).
- [ ] **[people]** Wire `POST /admin/revoke` to the HR off-boarding trigger so an existing
  session is cut within minutes, not at the 8-hour TTL (discovery X10).
- [ ] **[code]** `COMPASS_NO_DEMO=1` — the demo persona switch must be **off**.
- [ ] **[people]** Confirm Google Workspace **enforces** 2-step verification for all staff
  (discovery X8). Hardware keys for the admin group and the data owner.

## 2 · Secrets

- [ ] **[infra]** A KMS / Secret Manager (Google Secret Manager, AWS Secrets Manager,
  Vault). Nothing sensitive in plain env files on disk.
- [ ] **[infra]** Store: `COMPASS_SESSION_SECRET` (`openssl rand -base64 32`), the OAuth
  client secret, the service-account key, every connector token.
- [ ] **[infra]** Rotation policy: session secret + connector tokens at least annually;
  document the rotation runbook.
- [ ] **[infra]** `secrets/` stays git-ignored; CI has no production secrets.

## 3 · Data stores

- [ ] **[infra]** **Redis** (managed, auth on, private network only) for the rate limiter
  + the session-revocation store — so both hold across replicas and restarts. Point the
  limiter and `session.ts` revocation map at it (the interfaces exist; swap the in-memory
  Map for Redis `INCR`/`EXPIRE` + a revocation key per subject).
- [ ] **[infra]** A **write-once object store** (S3 Object Lock / GCS retention) for the
  immutable raw store and the off-host audit stream.
- [ ] **[code]** `COMPASS_AUDIT_WEBHOOK=https://<sink>` → the hash-chained audit is also
  streamed off-host. Point it at the SIEM or the write-once store.
- [ ] **[infra]** Postgres (managed, private) if running the SQL permission-filter path
  (`eval:pg` proves it); `pgvector` if using dense embeddings.

## 4 · Network & transport

- [ ] **[infra]** HTTPS only, terminated at a load balancer. TLS 1.2+ only. Submit the
  domain to the HSTS preload list.
- [ ] **[code]** `NODE_ENV=production` — adds `Secure` to the cookie, sends HSTS.
- [ ] **[infra]** Only 443 is public. The API process, Redis, Postgres, the audit sink,
  the raw store are all on a private network with no public inbound.
- [ ] **[infra]** A **network egress policy** (firewall / NetworkPolicy): the server may
  only reach Google APIs + the connector API hosts + the LLM endpoint + the audit sink.
- [ ] **[code]** `COMPASS_EGRESS_ENFORCE=1` — the in-process egress guard as a backstop
  (startup log: `egress: ENFORCED`). Add any extra hosts via `COMPASS_EGRESS_ALLOW`.

## 5 · Connectors (least privilege)

- [ ] **[infra]** Drive: the service account added to a **named allowlist of Shared
  Drives** only, read-only (discovery D3, D5). Not domain-wide read.
- [ ] **[infra]** GivingData: a read/export API credential or a scheduled export
  (discovery G1, G2).
- [ ] **[infra]** Airtable: a read-only token scoped to the canonical base(s) (discovery A2).
- [ ] **[people]** The `never-ingest` list (board / HR / legal / compensation drives and
  bases) is configured **before** the first sync and signed off (discovery D5, `docs/TIER_POLICY.md`).

## 6 · The build & promotion gate

- [ ] **[code]** `npm run ci` is the promotion gate — nothing reaches a live index without
  it green (typecheck · unit tests · deps:audit · eval ×3 · security · server:check ·
  redteam). A permission leak or red-team regression is a hard stop.
- [ ] **[infra]** Turn on Dependabot / Renovate (continuous CVE alerts — `deps:audit` is
  the point-in-time gate).
- [ ] **[infra]** Container image scanning (Trivy / Grype) in the deploy pipeline.
- [ ] **[infra]** Generate an SBOM (`syft`) per release.

## 7 · Monitoring & response

- [ ] **[code]** Wire `onSignal` (the anomaly monitor: restricted-probing, auth-brute,
  broad-sweep, withheld-surge, cost-spike) to a real on-call channel / pager.
- [ ] **[infra]** `GET /admin/stats` behind the admin group — usage / trust / cost.
- [ ] **[people]** Name the **DRI** (the runbook, `docs/RUNBOOK.md`, is written for them).
  They run a full sync + eval + promote unaided before go-live.
- [ ] **[people]** Run the **tabletop** (`docs/TABLETOP_EXERCISE.md`) with the DRI, the
  COO's office, and counsel. Update the playbooks from what it surfaces.
- [ ] **[people]** The **third-party penetration test** (`deliverables/P_PenTest_Scope.md`)
  — clean retest on the permission-boundary and injection findings.

## 8 · Legal & data governance

- [ ] **[people]** Data-owner sign-off on: the four-tier policy, the source-of-truth
  matrix, the v1 corpus definition (`docs/TIER_POLICY.md`, `docs/SOURCE_OF_TRUTH_MATRIX.md`,
  `docs/V1_CORPUS_AND_METRIC.md`).
- [ ] **[people]** If a **generative backend** is turned on: an executed zero-retention +
  no-training agreement + DPA with the LLM vendor (or a self-hosted model). Until then,
  extractive mode — no external model, nothing to sign.
- [ ] **[people]** Counsel's written position on secondary use of grantee materials and
  the Colombia (Ley 1581) / Kenya (DPA 2019) cross-border determination. Default posture:
  exclude participant PII.
- [ ] **[people]** Update the grantee-facing privacy notice / portal terms if internal
  AI-assisted analysis isn't already covered.

## 9 · Go / no-go

The release decision goes **on record** (Phase 4 exit). Go requires: every box above
checked or explicitly accepted in writing by the data owner, `npm run ci` green on the
release commit, the pen-test retest clean, and the DRI trained.
