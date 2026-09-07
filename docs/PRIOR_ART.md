# Prior art & open-source components — build vs. buy

We do **not** hand-build what a mature open-source project already does well. We **do**
own the two things that define Compass: the **permission boundary** and the **evaluation
gate**. Everything else is assembled from vetted components behind our own interfaces.

Rule: a component earns its place only if it is (a) permissively licensed, (b) actively
maintained, (c) self-hostable or under a data-processing agreement, and (d) replaceable
without touching our security code.

---

## Retrieval & ingestion

| Need | Use | Why | We still own |
|---|---|---|---|
| Ingestion + retrieval primitives (loaders, chunkers, indices, query engines) | **LlamaIndex** (MIT) | Most serious project for document-QA retrieval; large connector ecosystem; retrieval quality is its focus | The `SourceAdapter` contract, the chunking policy per source, and the retrieval **permission filter** — never delegated to a framework |
| Pipeline / agent orchestration | **LangGraph** (MIT) | Explicit graph with shared state, checkpointing, branches, loops, and human-in-the-loop pause — the pipeline has all of these (quarantine branch, review queue, eval-gated promotion loop); token cost is predictable per node | The graph definition and every node's logic |
| Reference architecture | LlamaIndex (retrieval) + LangGraph (orchestration) + RAGAS/promptfoo (eval) | This is the 2026 production pattern | — |

*Alternatives considered:* LangChain (bigger, looser — we use only LangGraph from that family); RAGFlow / Dify (batteries-included with their own UI — too much to inherit and their permission model isn't ours); Haystack (clean pipelines, fine second choice).

## Connectors (source systems)

| Source | Use | Notes |
|---|---|---|
| Google Drive | **`modelcontextprotocol/servers` Google Drive MCP** (official, MIT) or LlamaIndex `GoogleDriveReader` | Read-only. We wrap it in `adapters/drive.ts` and add the Shared-Drive allowlist + ACL capture ourselves |
| Airtable | **`domdomegg/airtable-mcp-server`** (community, MIT — read+write; we use read scopes only) or the official Airtable MCP | Schema introspection + record read; attachment URLs cached immediately (they expire) |
| GivingData | **Custom connector** — no MCP exists | API if the plan allows, else scheduled signed export; same `SourceAdapter` envelope out |
| Slack / Zoom Chat | Official Slack MCP exists; **deferred** with Zoom per the strategy doc | — |
| Notion / email / ClickUp (later) | Notion has a clean API + community MCP; Gmail via Workspace API | Only after governance review |

Every connector implements our one interface. MCP is an implementation detail behind it —
if an MCP server is unmaintained or over-scoped, we drop to a direct API client without
changing anything downstream.

## Document parsing & OCR

| Need | Use | Why |
|---|---|---|
| Detect scanned vs. text PDF per page | **`firecrawl/pdf-inspector`** (MIT, Rust, ms/page, Python/Node bindings) | This *is* our extraction-confidence gate — routes each page to text-extract or OCR |
| Extract to Markdown (layout-aware: tables, headings, formulas) | **Docling** (IBM, MIT) or **`firecrawl/AnyDoc`** (MIT); **Marker-PDF** as fallback | High-quality Markdown chunks cleanly; keeps section structure for our locators |
| OCR for scanned pages | Whatever the above route to (Tesseract / a hosted OCR); low-confidence output is **quarantined**, not trusted | Per OCR-robustness research, bad OCR silently degrades retrieval |
| Google Docs / Sheets / Slides | Native export via the Drive/Docs/Sheets APIs | No OCR needed; highest-confidence source |

## Embeddings & reranking

| Need | Use | Why |
|---|---|---|
| Text embeddings | **BGE-M3** (BAAI, MIT) | One model does dense + sparse + multi-vector; 90+ languages (Spanish for Colombia, English for US/Kenya) at competitive quality; self-hostable |
| Alt / upgrade path | **Qwen3-Embedding** (top of MTEB v2, flexible output dims) | Swap behind the `Embedder` interface if quality demands it |
| Reranking | **`bge-reranker-v2-m3`** (BAAI, MIT) | Standard, efficient RAG reranker |
| Serving | A dedicated inference endpoint (self-hosted GPU or a managed embeddings API under a DPA) | Keep embeddings inside Foundation-controlled infra where possible |

The current prototype uses a dependency-free tf-idf vector as a stand-in behind the same
`Record<string, number>` shape — swapping in BGE-M3 is a one-module change.

## Vector store + entity graph + permission map

| Need | Use | Why |
|---|---|---|
| Vector index, metadata, entity graph, permission map — **one database** | **pgvector on Postgres** (PostgreSQL License) | ~5 years of one small foundation's grants is far inside pgvector's comfort zone (<50M vectors); no second system for the handoff team to run; the entity graph and ACLs are relational anyway |
| Lexical / BM25 half of hybrid retrieval | Postgres FTS, or **ParadeDB / `pg_search`** for true BM25 | Hybrid (vector + BM25 + metadata filter) is table stakes; keep it in one query where possible |
| Upgrade path | **Qdrant** (Apache-2.0, best free tier, native sparse + ColBERT) or **Weaviate** (native hybrid in one round-trip) | Only if pgvector latency climbs past ~250ms at scale |

## Evaluation & red-team

| Need | Use | Why |
|---|---|---|
| Permission-leak, prompt-injection, jailbreak, PII-extraction red-team | **promptfoo** (MIT) | The most comprehensive OSS attack suite (500+ vectors); built for RAG/agent security testing; runs in CI |
| Retrieval + generation quality metrics (faithfulness, context precision/recall, answer relevancy) | **RAGAS** (Apache-2.0) | Research-backed RAG metrics |
| Fast gold-set gate | **Our own harness** (`scripts/eval.ts`) | Already built; retrieval + refusal + hard-fail leakage check; runs in seconds |
| LLM-as-judge unit tests | **DeepEval** (Apache-2.0) | Pytest-style, optional |

## LLM

| Need | Use | Why |
|---|---|---|
| Answer generation | **Enterprise Claude** or **OpenAI** under a zero-retention / no-training agreement + DPA | Both are viable; OpenAI noted because the Foundation already partners with them on the AI Fund. Retrieval-only, **no fine-tuning** |
| In-VPC fallback | An open-weight model (e.g. a Llama / Qwen instruct model) served inside Foundation infra | Kept ready if legal review bars sending grantee data to any external API |

## App & cross-platform

| Need | Use | Why |
|---|---|---|
| Web app | **React + Vite + TypeScript** | Matches the DASH stack; the retrieval client is shared TS |
| Mobile (v2) | **Expo / React Native** | One codebase, shares the TS retrieval client and the design system with web |
| v1 mobile stopgap | **Responsive web + PWA** (installable, offline shell) | Ships now; see `CROSS_PLATFORM.md` |
| Design system | Tokens matching GitLab Foundation brand (orange-red `#DF4329`, Inter + Poppins), light + dark, WCAG 2.1 AA | Uniform with their site |

## Hosting / infra

| Need | Use |
|---|---|
| App | Cloud Run (or Vercel) behind the IdP — no public inbound |
| DB | Cloud SQL for Postgres + pgvector (or Neon) |
| Secrets | GCP Secret Manager (or equivalent) |
| Identity | Google Workspace as the OIDC provider (already theirs) |
| Audit sink | Write-once bucket / BigQuery with object retention lock |
| IaC | Terraform |

## What we deliberately build ourselves

1. **The `SourceAdapter` interface and the connector wrappers** — so no framework or MCP server owns our ingestion contract.
2. **The retrieval-time permission filter** — the security boundary is never delegated.
3. **`Restricted`-tier exclusion + metadata stub.**
4. **The entity-resolution rules + review queue** — domain-specific to grants.
5. **The gold-set eval harness + the coverage/refusal logic.**
6. **The tamper-evident audit log.**
7. **The "Deep dive" follow-up logic** — driven by our entity graph.

Sources: LlamaIndex / LangGraph / Haystack / RAGFlow / Dify (GitHub); [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers); [domdomegg/airtable-mcp-server](https://github.com/domdomegg/airtable-mcp-server); [Airtable MCP](https://support.airtable.com/docs/using-the-airtable-mcp-server); [firecrawl/pdf-inspector](https://github.com/firecrawl/pdf-inspector); Docling (IBM); BGE-M3 / bge-reranker-v2-m3 / Qwen3-Embedding (HuggingFace); [promptfoo](https://www.promptfoo.dev/) / RAGAS / DeepEval; pgvector / Qdrant / Weaviate.
