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

## Built in this repo

- Retrieval-time tier + ACL filter (the boundary).
- Restricted-tier exclusion with metadata-only stub + refusal path.
- Extraction-confidence quarantine (low-confidence OCR is not indexed as if clean).
- Boilerplate / "confidential" line stripping.
- Retrieved content treated as data: the LLM system prompt says so; no tool execution from retrieved text.
- Only retrieved passages + the question go to the LLM — never the corpus, never raw files (`src/retrieval/llm.ts`).
- Synthetic corpus only; PII fields in mock data are pre-redacted (`personalPhone: "REDACTED"`).

## Required before any real data (not in this repo — see strategy doc §6)

- Google SSO + MFA; per-person access grants; group→member sync for the permission map.
- Secrets in a managed store; least-privilege service accounts per connector, scoped to an allowlist.
- Encryption at rest for index / object store / logs; TLS in transit.
- Full query audit log (who, when, question, docs retrieved, tiers, withheld) — access-controlled.
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
