# Compass — controls matrix

Security & privacy controls mapped to the frameworks named in the strategy doc (§6.12):
**NIST CSF 2.0**, **NIST SP 800-53** (moderate), **SOC 2** (Security, Confidentiality),
**NIST AI RMF**. Status is what is true in this repo today.

Legend: ✅ built & tested · 🟡 built, needs the Foundation's environment · 📝 designed / documented

| # | Control | Framework refs | How Compass implements it | Status |
|---|---|---|---|---|
| AC-1 | Identity: federated SSO, hosted-domain enforced | CSF PR.AA, 800-53 IA-2/IA-8, SOC 2 CC6.1 | Google OIDC Authorization-Code + PKCE; RS256 ID-token verification checks `iss/aud/exp/iat/hd/email_verified` (`src/security/auth.ts`) | ✅ |
| AC-2 | Authorization: least privilege, group-driven | CSF PR.AA-05, 800-53 AC-3/AC-6 | Tier + ACL per chunk; `principalFromGroups` maps Google Groups → allowed tiers; **fails closed** if the group lookup fails | ✅ |
| AC-3 | Retrieval-time access control as the security boundary | CSF PR.DS, AI RMF MEASURE 2.7 | The permission filter runs before ranking, in code — also as a SQL `WHERE` clause (`src/db/store.ts`); `npm run eval` / `eval:pg` prove zero leaks | ✅ |
| AC-4 | Session management | 800-53 SC-23, SC-10 | HMAC-signed `HttpOnly; Secure; SameSite=Strict` cookie, 8h TTL; per-user + global server-side revocation (`revokeUser` / `revokeAll`); logout revokes | ✅ |
| AC-5 | Rate / cost limiting | CSF PR.IR-04, 800-53 SC-5 | Per-user token buckets (request rate + LLM cost) → 429 + Retry-After (`src/server/limits.ts`); production = Redis | 🟡 |
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
| SC-1 | Connector credentials in a KMS | 800-53 SC-12, SC-28 | Designed; `secrets/` git-ignored; production = Cloud KMS / Secret Manager | 📝 |
| SC-2 | Egress allowlist | 800-53 SC-7 | Designed; production network policy | 📝 |

## Where the gaps are

Everything marked 📝 needs the Foundation's environment or an external party — the pen
test, the KMS, the egress policy, the cross-border legal determination, and exercising the
playbooks. Everything ✅ runs and is tested in this repo today. `npm run ci` is the gate
that keeps the ✅ column honest.
