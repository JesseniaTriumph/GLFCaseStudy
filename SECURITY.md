# Security model

Compass concentrates years of sensitive grant material into one queryable place. That
concentration is the central risk, and the design treats it that way. Full treatment is in
the strategy doc §6; this file is the engineering checklist.

## The security boundary is retrieval-time access control

`src/retrieval/search.ts` filters every candidate chunk against the caller's `Principal`:

```
tier ∈ principal.allowedTiers          AND          chunk.acl ∩ principal.principals ≠ ∅
```

- `restricted` is **never** in `allowedTiers` for any v1 principal.
- `restricted` docs are **not indexed** — the pipeline keeps only a metadata-only stub so
  Compass can say "that's restricted" without the content being reachable.
- UI hiding is not a control. The filter is.

## Tiers

| Tier | Who | In the index? |
|---|---|---|
| `team` | Programs + Impact | yes |
| `programs-only` | Programs | yes |
| `restricted` | nobody, via Compass | **no — metadata stub only** |
| `never-ingest` | — | no |

## Built and runnable in this repo

| Control | Where | Proof |
|---|---|---|
| **OIDC ID-token verification** — real RS256; checks signature / iss / aud / exp / `hd` hosted-domain | `src/security/auth.ts` | `npm run security`: verifies a valid token; rejects a tampered token, a non-`gitlabfoundation.org` account, and an expired token |
| **Principal mapping** from verified claims + Google Groups; `restricted` never granted to anyone | `src/security/auth.ts` | same |
| **Tamper-evident audit log** — append-only, hash-chained | `src/security/audit.ts` | `npm run security` detects an edited past entry; `npm run audit` prints + verifies the chain |
| **Retrieval-time tier + ACL filter** (the security boundary) | `src/retrieval/search.ts` | `npm run eval`: 8/8, 0 permission leaks |
| **`Restricted` excluded from the index** (metadata stub + refusal) | `src/pipeline/run.ts` | eval case `board-compensation-restricted` |
| **Read-only sources** — no adapter has a write path | `src/adapters/*` | — |
| **Content hashing + build manifest** (commit + content digest per build) | `src/pipeline/run.ts`, `scripts/build-index.ts` | `npm run build:index` prints the manifest; ingest is logged to the audit chain |
| **Every query audit-logged** (user, question, tiers retrieved, withheld, confidence) | `scripts/ask.ts` | `npm run audit` |
| Retrieved content treated as untrusted data; only passages + question sent to the LLM | `src/retrieval/llm.ts` | — |
| Extraction-confidence quarantine; boilerplate / "confidential" stripping | `src/pipeline/run.ts` | — |
| Synthetic corpus only; PII pre-redacted | `data/mock/*` | — |

## Still needed before real data (design in strategy doc §6, not code here)

- The OAuth **redirect/callback handler + session cookie issuance** (`auth.ts` verifies the token; the HTTP flow around it is deployment code).
- Live JWKS fetch + cache; live Google Groups sync.
- Secrets in a managed store; least-privilege connector service accounts scoped to an allowlist.
- Encryption at rest (KMS) for index / object store / logs; TLS 1.3 in transit; allowlisted egress; no public inbound.
- Audit records streamed to write-once off-host storage.
- Enterprise LLM agreement (zero retention, no training, DPA, US region).
- Prompt-injection filtering; output PII/secret scanning.
- Pen test + scheduled permission red-team; SBOM + CVE alerts.
- Privacy-law review: US state law, Colombia Ley 1581, Kenya DPA 2019.
- Kill switch (disable retrieval/answers, sources untouched).
- PII detection pass at intake; participant identifiers never indexed.
- Enterprise LLM agreement: zero retention, no training, signed DPA, US residency.
- Prompt-injection filtering; output scanned for PII/secret patterns.
- Third-party penetration test + scheduled permission red-team.
- Controls mapped to NIST CSF 2.0 / SP 800-53; SOC 2 for the system and every vendor; NIST AI RMF.
- Privacy-law review for US state law, Colombia (Ley 1581), Kenya (DPA 2019) before those geographies enter the corpus.

## Reporting

This is a case-study prototype. For the real system, security issues would go to the
designated data owner (COO's office) per the incident-response runbook.
