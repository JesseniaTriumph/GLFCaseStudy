# Compass — incident response playbooks

Operational version of the RESPOND section of `deliverables/G_Security_Review.md`. Each
playbook: **Detect → Contain → Eradicate → Recover → Learn**, with the exact command.
Every Critical/High incident ends with a new regression or adversarial test so the gold
suite grows with each incident.

Roles: **DRI** (the named Compass owner), **Incident Lead** (COO's office), **Counsel**.

---

## P1 — Cross-tier / permission data exposure

A user saw content their tier/ACL should have blocked.

- **Detect:** a `restricted-probing` monitor signal, `npm run eval` leak finding, or a user report.
- **Contain:** `POST /admin/killswitch {"on": true}`. Snapshot the audit log.
- **Eradicate:** find the ACL/tier bug (usually a mock-adapter ACL, a `mayRead` change, or a
  doc that should have been `restricted`). Fix it; add the doc to `never-ingest` if needed.
- **Recover:** `npm run build:index` → `npm run ci` → promote → release the kill switch.
- **Learn:** add the exact question + the document that leaked to `eval/redteam.json` with
  `mustNotLeak`. Confirm it fails on the old code and passes on the fix.
- **Communicate:** DRI + Incident Lead + Counsel. If grantee or co-funder data was exposed,
  Counsel advises on notification duties (US state law / Colombia Ley 1581 / Kenya DPA).

---

## P2 — Successful prompt injection

A planted instruction in a document changed Compass's behaviour or surfaced an attack payload.

- **Detect:** a reported bad answer, or an `injection-*` red-team regression.
- **Contain:** if generative answers are on, disable them (fall back to extractive). If
  severe, kill switch.
- **Eradicate:** add the phrasing to `INJECTION_PATTERNS` / `INJECTION_SIGNALS` in
  `src/pipeline/run.ts`. Quarantine the source document.
- **Recover:** rebuild → `npm run ci` (the redteam suite must pass) → promote.
- **Learn:** add the source document to `data/mock/injection/` and a case to `redteam.json`.

---

## P3 — A materially misleading answer reached a grantee or the board

- **Detect:** user report.
- **Contain:** retract in the channel it went out; issue a correction citing the correct source.
- **Eradicate:** find the cause — a stale figure not flagged as a conflict, a vintage error,
  a bad OCR extraction, a dedupe that dropped the authoritative copy.
- **Recover:** re-run other answers on that topic; check the entity review queue.
- **Learn:** add the question to `eval/gold.json` with the verified answer + expected sources.

---

## P4 — LLM vendor compromise / retention breach

- **Detect:** vendor disclosure.
- **Contain:** unset `ANTHROPIC_API_KEY` → extractive-only mode (Compass still fully works).
  Or switch to the in-VPC model per the cost model's fallback.
- **Eradicate:** rotate the API key.
- **Communicate:** co-funders per MOU; grantees per the privacy notice; Counsel on regulator duties.

---

## P5 — Secret / credential exposure

- **Detect:** secret-scanner alert or anomaly.
- **Contain:** rotate the exposed credential now. If it's `COMPASS_SESSION_SECRET`,
  `POST /admin/revoke {"all": true}` and rotate — everyone re-authenticates.
- **Eradicate:** purge from git history; find the leak path (a committed `.env`, a log, a screenshot).
- **Learn:** add the pattern to the CI secret scan.

---

## P6 — Audit chain broken

`npm run audit` reports a broken link, or `AuditLog.verify()` returns `ok: false`.

- Treat as **confirmed compromise** until proven otherwise.
- Preserve everything (the local JSONL + the off-host stream). Engage the Incident Lead.
- Assume the app host is owned: rebuild from a known-good image, force credential rotation
  and re-auth (`revokeAll` + rotate `COMPASS_SESSION_SECRET`).
- Reconcile the local chain against the off-host copy (`COMPASS_AUDIT_WEBHOOK` target) to
  establish what actually happened.

---

## P7 — Index poisoning / a wrong-tier document got indexed

- **Contain:** kill switch.
- **Identify:** the offending source in `dist/raw/_manifest.json` and the review queue.
- **Eradicate:** fix the tier or add to `never-ingest`; delete the raw record; rebuild.
- **Recover:** wipe and rebuild the index from the raw store with the content excluded;
  `npm run ci`; promote.
- **Learn:** add a poisoning-detection signal and the offending document as a negative case.

---

## Kill switch — what it does and doesn't do

`POST /admin/killswitch {"on": true}` makes `/api/ask` return 503 for everyone. It does
**not** wipe the index or revoke sessions — pair it with `revokeAll` and an index rebuild
for a full containment. The index is fully derived from `dist/raw/`, so "rebuild from
known-good" is always possible.
