# Compass — System Tools & Infrastructure Requirements

Everything that must be provisioned, connected, or contracted for Compass to run. Grouped
by "needed for the v1 slice" vs. "needed before production" vs. "later."

---

## 1. Identity & access (Foundation-provided)

| Item | Purpose | Owner | Phase |
|---|---|---|---|
| Google Workspace OIDC client (client id + secret, redirect URI) | Sign-in | Workspace admin | v1 |
| Google Admin SDK access (read-only: `admin.directory.group.readonly`) | Map users → permission groups | Workspace admin | v1 |
| Google Groups for `programs`, `impact` (or existing groups mapped) | Tier entitlements | DRI | v1 |
| MFA enforced at the Workspace level | Inherited by Compass | Workspace admin | v1 |

## 2. Source connectors (Foundation-provided credentials, least privilege)

| Source | Credential | Scope | Phase |
|---|---|---|---|
| Google Drive | GCP service account + domain-wide delegation | `drive.readonly`, restricted to an allowlist of Shared Drive IDs | v1 |
| GivingData | API key / OAuth client **or** scheduled signed export to a bucket | Read-only | v1 |
| Airtable | Personal Access Token / OAuth | Read-only, named bases | v1 (Phase 3 to index) |
| Notion (candidate) | Internal integration token | Read-only, shared pages | Phase 3, post-review |
| Gmail / Zoom / ClickUp | — | — | deferred / governance review |

## 3. Cloud infrastructure

| Component | Recommended | Alternative | Phase |
|---|---|---|---|
| Compute (query service, ingestion job) | GCP Cloud Run + Cloud Run Jobs | Vercel + a worker | v1 |
| Database | Cloud SQL for PostgreSQL 16 + `pgvector` + FTS (or ParadeDB for BM25) | Neon | v1 |
| Object store (raw source snapshots, backups) | GCS bucket, versioned | S3 | v1 |
| Secret manager | GCP Secret Manager | Doppler / Vault | v1 |
| Identity-Aware Proxy / edge auth | GCP IAP or the app's own OIDC middleware | Cloudflare Access | v1 |
| Audit sink (write-once) | GCS bucket with retention lock, or BigQuery | — | v1 |
| Embeddings serving | GPU node (Cloud Run GPU / GKE) running BGE-M3 + reranker, **or** a managed embeddings endpoint under a DPA | — | v1 |
| LLM | Enterprise Claude **or** OpenAI, zero-retention + DPA, US region | In-VPC open-weight model | v1 |
| CI/CD | GitHub Actions | GitLab CI | v1 |
| IaC | Terraform | Pulumi | v1 |
| Observability | Cloud Logging/Trace + a cost dashboard; RAGAS scores per release | Grafana/OTel | Phase 2–3 |
| Error tracking | Sentry | — | Phase 2 |

## 4. Open-source components (see `PRIOR_ART.md` for rationale)

| Layer | Component | License |
|---|---|---|
| Retrieval primitives | LlamaIndex | MIT |
| Orchestration | LangGraph | MIT |
| PDF routing | firecrawl/pdf-inspector | MIT |
| Doc → Markdown | Docling / AnyDoc / Marker-PDF | MIT / Apache-2.0 |
| Embeddings | BGE-M3 (→ Qwen3-Embedding) | MIT |
| Reranker | bge-reranker-v2-m3 | MIT |
| Vector + relational | PostgreSQL + pgvector | PostgreSQL License |
| Red-team / security eval | promptfoo | MIT |
| RAG quality metrics | RAGAS | Apache-2.0 |
| Connectors | modelcontextprotocol/servers (Drive), domdomegg/airtable-mcp-server | MIT |
| Web | React + Vite + TypeScript | MIT |
| Mobile (v2) | Expo / React Native | MIT |

## 5. APIs to connect (summary)

| API | Read/Write | Used by | Auth |
|---|---|---|---|
| Google OIDC (`accounts.google.com`) | — | query service | client id/secret + PKCE |
| Google JWKS (`www.googleapis.com/oauth2/v3/certs`) | read | token verify | none (public keys) |
| Google Drive API v3 + Docs/Sheets APIs | **read** | Drive connector | service account |
| Google Admin SDK Directory | **read** | group sync | service account |
| GivingData API (or export bucket) | **read** | GivingData connector | API key / signed URL |
| Airtable Web API + Metadata API | **read** | Airtable connector | PAT / OAuth |
| Embeddings endpoint | — | ingestion + query | API key / mTLS |
| LLM Messages API | — | query service only | API key, zero-retention |

**Never connected with write scope. Egress is allowlisted to exactly this list plus the
LLM endpoint.**

## 6. Environments

| Env | Data | Auth | Purpose |
|---|---|---|---|
| `dev` | synthetic only (`data/mock/`) | mock principals | local build + tests |
| `staging` | synthetic + a small redacted real sample | real Google OIDC | integration, demos |
| `prod` | the real corpus | real OIDC + groups | the Foundation's tool |

## 7. Provisioning checklist (Phase 1 → 2 handoff)

- [ ] OIDC client registered; redirect URI for staging + prod
- [ ] Service account created; Shared-Drive allowlist applied by Workspace admin
- [ ] GivingData read access confirmed (API or export cadence)
- [ ] Airtable PAT scoped to the named bases
- [ ] Postgres instance + pgvector extension
- [ ] Secret Manager entries for every credential; rotation policy set
- [ ] Audit bucket with retention lock
- [ ] Embeddings serving reachable from the ingestion job
- [ ] LLM enterprise agreement executed (zero retention, DPA, US region)
- [ ] Terraform state backend; CI secrets configured
- [ ] Kill-switch flag wired and tested
