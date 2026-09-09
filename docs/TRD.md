# Compass — Technical Requirements Document

Companion to `PRD.md` (what) and `PRIOR_ART.md` (which components). This is *how*.

---

## 1. Architecture overview

```
                    ┌──────────────────────────── CLIENTS ────────────────────────────┐
                    │   Web (React/Vite)      PWA        iOS / Android (Expo, v2)      │
                    └───────────────────────────────┬────────────────────────────────┘
                                                    │  HTTPS, session cookie
                    ┌───────────────────────────────▼────────────────────────────────┐
                    │  EDGE / IdP                                                     │
                    │  Google OIDC in front · session issuance · rate limiting        │
                    └───────────────────────────────┬────────────────────────────────┘
                    ┌───────────────────────────────▼────────────────────────────────┐
                    │  QUERY SERVICE  (stateless, Cloud Run)                          │
                    │  auth → Principal → retrieve (ACL-filtered) → rerank →          │
                    │  answer (extractive | LLM passages-only) → coverage/refusal →   │
                    │  audit append                                                   │
                    └──────┬───────────────────────────────────┬─────────────────────┘
                           │ read                              │ append
        ┌──────────────────▼───────────────┐        ┌──────────▼───────────────┐
        │  POSTGRES + pgvector             │        │  AUDIT SINK              │
        │  chunks + embeddings             │        │  hash-chained, write-once│
        │  entity graph (grant/org/…)      │        └─────────────────────────┘
        │  permission map (tier + ACL)     │
        │  gap report · build manifest     │
        └──────────────────▲───────────────┘
                           │ write (offline)
        ┌──────────────────┴────────────────────────────────────────────────────────┐
        │  INGESTION PIPELINE  (LangGraph, scheduled)                                │
        │  connectors → parse/OCR (pdf-inspector+Docling) → PII scan → tier gate →   │
        │  dedupe → entity resolve → chunk → embed (BGE-M3) → upsert → reconcile     │
        │  → eval gate → promote                                                     │
        └──────────────────▲────────────────────────────────────────────────────────┘
                           │ read-only, scoped service accounts
        ┌──────────────────┴───────────────┐
        │  SOURCES  Drive · GivingData · Airtable  (Zoom/Notion/email later)         │
        └──────────────────────────────────────────────────────────────────────────┘
        LLM vendor: called only from the query service, passages + question only.
```

## 2. Components & responsibilities

| Component | Runtime | Responsibility | Key libs |
|---|---|---|---|
| **Web client** | Browser | Ask, answer + citations, sources rail, coverage line, Deep dive, dossier, admin | React, Vite, TS |
| **Query service** | Cloud Run (Node/TS) | The read path in §1; **stateless**; the only caller of the LLM | LlamaIndex query engine, our `search`/`answer` modules |
| **Ingestion pipeline** | Cloud Run Job / scheduler (Node/TS) | The write path; incremental sync; produces a candidate index | LangGraph, connector wrappers, pdf-inspector, Docling |
| **Embedder service** | GPU node or managed endpoint | text → vectors; reranking | BGE-M3, bge-reranker-v2-m3 |
| **Postgres** | Cloud SQL | vectors + graph + ACLs + metadata + manifest + gap report | pgvector, Postgres FTS / ParadeDB |
| **Audit sink** | Write-once bucket / BigQuery | tamper-evident log of queries, ingests, admin actions | our `audit` module + object retention lock |
| **Admin console** | part of web client | corpus config, tier changes (step-up), re-index, kill switch, gap report, review queue | — |

## 3. Data & retrieval

- **Chunking**: ~140 tokens on paragraph boundaries for prose; per-tab rows for Sheets; a generated plain-language "fact sheet" per structured GivingData grant so structured data is semantically retrievable.
- **Index**: each chunk row carries `embedding vector`, `tokens` (for BM25), `tier`, `acl text[]`, `entity_ids`, `source_system`, `deep_link`, `date`, `content_sha256`.
- **Hybrid retrieval**: dense (pgvector cosine) ∪ lexical (FTS/BM25) → RRF fusion → `bge-reranker` cross-encoder over the top ~30 → top-k. The rerank stage is implemented (`src/retrieval/rerank.ts`, `COMPASS_RERANK`-gated, `bge-reranker-base` local / `bge-reranker-v2-m3` on a served endpoint) and runs strictly **after** the permission `WHERE` — it only reorders rows the caller may already read.
- **Permission filter** (the boundary): applied as a **SQL `WHERE`** before ranking — `tier = ANY(:allowed_tiers) AND acl && :principal_ids` — so disallowed rows never enter scoring. Enforced again in the service layer as defence in depth.
- **`Restricted`**: never inserted as a retrievable row; a `restricted_stub` row holds title + entities + tier only.
- **Answer**: extractive by default (compose from top passages + citations); generative when an LLM is configured (passages + question only). Refusal when top score is weak or a restricted stub dominates.

## 4. Identity & authorization

- OIDC Authorization Code + PKCE against Google Workspace; verify ID token (RS256, `iss`/`aud`/`exp`/`hd`); issue an 8-hour `HttpOnly; Secure; SameSite=Strict` session cookie.
- Principal = `{ userId, groups[], allowedTiers[] }` derived from Google Groups (Admin SDK, read-only), cached, re-synced on login + nightly.
- `restricted` is never in any principal's `allowedTiers`.
- Admin actions: step-up re-auth; tier downgrade needs a second approver (recorded in the audit log).

## 5. Ingestion pipeline (LangGraph nodes)

`pull` → `parse` (pdf-inspector routes; Docling extracts; low OCR confidence → `quarantine`) → `pii_scan` (redact / tier-up) → `tier_gate` (restricted → stub) → `dedupe` (hash / near / cross-system; reversible merges) → `resolve` (entity graph; low-confidence → `review_queue`) → `chunk` → `embed` → `upsert` (to a candidate schema) → `reconcile` (gap report vs. GivingData spine) → `eval_gate` (run gold set + promptfoo; **fail → do not promote**) → `promote` (atomic swap candidate → live) → `audit(ingest)`.

- Incremental: Drive `changes` feed; GivingData `lastModified`; Airtable record timestamps.
- Idempotent + re-runnable; a fixed extractor replays over history without dupes.
- Each promotion writes a **build manifest** (commit, content digest, per-source counts).

## 6. "Agents that act" — scoped correctly

The acting agents are **build/ops agents**, orchestrated by LangGraph, not agents that touch grant decisions:

| Agent | Acts on | Loop? |
|---|---|---|
| Connector-Sync | Pulls each source, detects drift, opens an alert if volume drops sharply | scheduled |
| Extraction | Parses + OCRs + scores confidence | per item |
| Dedupe/Resolve | Merges, or routes low-confidence to the human review queue | per batch |
| Reconcile | Diffs the corpus against the grant spine → gap report | per build |
| Eval | Runs the gold set + red-team; **blocks promotion** on regression; proposes retrieval-config tweaks for human approval | **loop — re-runs until green or escalates** |
| Tuning ("self-improving") | Aggregates thumbs-down + eval deltas; proposes prompt / weight / chunking changes **as a PR for human review** — never auto-applied to production | weekly loop |

**Sequential vs. loop:** the pipeline is a **sequential DAG** with **two loops** — the eval gate (re-run until green) and the weekly tuning loop (propose → human-approve → measure). No agent has write access to a source system or the authority to promote an index build on its own.

## 7. Non-functional

| Requirement | Approach |
|---|---|
| Latency p90 lookup < 3s | pgvector HNSW index; reranker on top-30 only; cheap model for lookups |
| Cost caps | per-user token + query budgets at the gateway; retrieval caps; alerts |
| Availability | stateless query service (N replicas); degrade to extractive answers if the LLM is down; kill switch |
| Security | strategy doc §6 + `SECURITY.md` + `G_Security_Review.md`; production BLOCKED until the review's 6 items close |
| Observability | structured logs, traces per request, RAGAS scores per release, cost dashboards; audit separate from analytics |
| Data residency | US region; embeddings in-infra where possible; CO/KE transfer review before those geos |
| Backups | Postgres PITR; index rebuildable from source at any time |

## 8. Environments

`dev` (synthetic data only) → `staging` (synthetic + a redacted sample, real auth) → `prod` (real corpus). IaC (Terraform); no click-ops; secrets per-environment.

## 9. Interfaces (stable contracts)

- `SourceAdapter.pull({since?}) → SourceDoc[]` — the ingestion contract.
- `Embedder.embed(texts) → number[][]` — swap BGE-M3 / Qwen3 / managed.
- `LLM({question, passages}) → string` — swap Claude / OpenAI / in-VPC.
- `retrieve(index, query, principal, k) → {hits, withheld}` — the boundary; ours, never swapped for a framework default.
- REST: `POST /api/ask`, `GET /api/dossier/:orgId`, `GET /api/gaps`, `POST /api/admin/*` (step-up), `POST /api/feedback`.
