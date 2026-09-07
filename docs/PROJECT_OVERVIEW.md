# Compass — Project Overview

## What it is

A permission-aware way for the GitLab Foundation Programs and Impact teams to ask five
years of grant knowledge one question and get a **cited answer** — grounded in the
Foundation's own records across Google Drive, GivingData, and Airtable, honest about what
it did and didn't search, and enforced so it can never surface content the asker isn't
entitled to see.

## The reframe

This is a **retrieval, permissioning, and citation** problem, not a chatbot problem. The
hard, valuable work is connecting four systems that hold different kinds of truth —
**connecting the records without flattening their meaning** — de-duplicating so nothing is
missed or double-counted, resolving everything to the same grants and organizations, and
enforcing who can see what. The language model is the last and least risky component — it
phrases; it does not decide.

Compass returns an **evidence brief**, not a chat reply: the claim, its citations, the
coverage it drew on, and a confidence read that describes *evidence quality — never the
model's certainty*. Evidence moves through six controlled stages:
**Connect → Preserve → Resolve → Retrieve → Answer → Improve** (`TRD.md`, `ARCHITECTURE.md`).
And the product is designed to **fail visibly** — a conflict, a coverage gap, or an
abstention — never a confident guess.

## Why it fits GitLab Foundation

- Their own Handbook names the anti-pattern — *"juicing our models … hiding negative
  outcomes."* Compass makes a favorable number **hard to cherry-pick** (mandatory
  citations, date + model-version stamps, refusal when unsupported) and a negative result
  **easy to see**.
- **"Rigorous but reasonable"**: rigor on citations, permissions, and evaluation;
  reasonableness on scope and on saying *"we don't have that."*
- CREDIT-shaped: a shared tool that fights knowledge-hoarding, built MVP-first, documented
  in the open — and a candidate for the "knowledge and intelligence products" the
  Foundation is building toward.

## Scope

**v1 does:** single-turn cited Q&A over a curated corpus (last ~3 years of GivingData + 2–3
Shared Drives + matching Airtable orgs), for 3–5 Programs/Impact design partners, with a
grantee dossier view and two toggleable features (Deep dive; Role & cycle context).

**v1 does not:** take actions or make grant decisions (read-only); rebuild their Tableau
dashboards; ingest Zoom Chat; carry conversational memory; serve the whole org on day one.

## State

| Layer | Status |
|---|---|
| Data-quality pipeline (clean, dedupe, entity graph + join, gap report, build manifest) | working on synthetic data |
| Hybrid retrieval + retrieval-time permission filter + `Restricted` exclusion + refusal | working |
| Cited answers with per-passage deep links; Deep dive | working |
| OIDC token verification; tamper-evident hash-chained audit log | working (`npm run security` 7/7) |
| Evaluation harness (retrieval + refusal + permission-leak) | working (`npm run eval` 8/8, 0 leaks) |
| Production (real connectors, OAuth callback, PII scanner, monitoring, pen test) | designed, not built — see `G_Security_Review.md`: prototype `CONDITIONAL`, production `BLOCKED` |

## Team & handoff

Built by the Applied AI Fellow; managed services over bespoke infra; this doc set + a
runbook from day one; a named internal owner identified before the fellowship midpoint.
