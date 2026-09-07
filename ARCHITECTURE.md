# Compass — architecture

## Principle

The value is in **connect → clean → permission → cite**, not in the model. Compass is a
retrieval system with generation on top, designed so that:

1. every answer is grounded in retrieved source passages with deep-link citations;
2. permission is enforced at retrieval, never only in the UI;
3. the tool discloses what it searched and what it could not see;
4. it is read-only against every source;
5. retrieved content is treated as untrusted data.

## Data flow

```
┌─────────────┐   SourceAdapter.pull()      ┌──────────────────────────────────────────┐
│  Sources    │ ─────────────────────────▶  │  INTAKE                                   │
│  drive      │   incremental, per source   │  • text extraction + OCR confidence gate  │
│  givingdata │                             │  • language detection                     │
│  airtable   │                             │  • boilerplate / confidentiality strip    │
│  (notion…)  │                             └───────────────────┬──────────────────────┘
└─────────────┘                                                 │
                                              ┌────────────────▼───────────────────────┐
                                              │  TIER GATE                              │
                                              │  restricted / never-ingest excluded    │
                                              │  restricted → metadata-only stub        │
                                              └────────────────┬───────────────────────┘
                                              ┌────────────────▼───────────────────────┐
                                              │  DEDUPE                                 │
                                              │  exact (content hash)                   │
                                              │  near  (jaccard ≥ .82)                  │
                                              │  cross-system (shared portal id / grant)│
                                              │  authoritative copy kept, rest linked   │
                                              └────────────────┬───────────────────────┘
                                              ┌────────────────▼───────────────────────┐
                                              │  RESOLVE ENTITIES                       │
                                              │  grant · org · fund · thesis · geo      │
                                              │  low-confidence merges → review queue   │
                                              └────────────────┬───────────────────────┘
                                              ┌────────────────▼───────────────────────┐
                                              │  CHUNK + INDEX                          │
                                              │  ~140-token chunks on paragraph bounds  │
                                              │  df table · tf-idf vectors              │
                                              └────────────────┬───────────────────────┘
                                              ┌────────────────▼───────────────────────┐
                                              │  RECONCILE → GAP REPORT                 │
                                              │  every grant: proposal? reports due?    │
                                              │  org record? thesis tag?               │
                                              └────────────────┬───────────────────────┘
                                                               │  CorpusIndex (json)
                              ┌────────────────────────────────▼──────────────────────┐
   query + Principal ───────▶ │  RETRIEVE                                              │
                              │  BM25 (exact) + tf-idf cosine (semantic) hybrid        │
                              │  ── permission filter: tier ∈ allowedTiers AND         │
                              │     acl ∩ principal.principals  (THE security boundary)│
                              │  rerank · ≤2 chunks per doc · top-k                    │
                              └────────────────────────────────┬──────────────────────┘
                              ┌────────────────────────────────▼──────────────────────┐
                              │  ANSWER                                                │
                              │  refuse if: no strong hit / restricted dominates /     │
                              │             permission-blocked                         │
                              │  else: extractive (default) or generative (LLM)        │
                              │  + [n] citations + confidence + coverage line          │
                              └────────────────────────────────┬──────────────────────┘
                                                               ▼
                                              feedback + query log → eval set → CI gate
```

## Types (`src/core/types.ts`)

- **`SourceDoc`** — the canonical envelope every adapter emits. Carries `tier`, `acl`,
  `extractionConfidence`, `language`, `entities`, `deepLink`.
- **`Chunk`** — a retrievable unit with `tokens`, `vector`, and the inherited `tier`/`acl`.
  `restrictedStub: true` marks a metadata-only entry for an excluded doc.
- **`CorpusIndex`** — chunks + df + entities + `dedupe` report + `gaps` report + `coverage`.
- **`Principal`** — `{ userId, groups, allowedTiers }`. Retrieval filters the corpus to this.
- **`Answer`** — text + citations + `confidence` (`high|medium|low|refused`) + `coverage` + `withheld`.

## Modules

| Path | Responsibility |
|---|---|
| `src/adapters/types.ts` | `SourceAdapter` interface + `SyncStats` |
| `src/adapters/mock*.ts` | mock connectors; headers describe the real build |
| `src/pipeline/run.ts` | the whole source-agnostic pipeline |
| `src/util/text.ts` | tokenize, hash, language detect, frontmatter, tf-idf, cosine, jaccard |
| `src/retrieval/search.ts` | hybrid retrieval + permission filter |
| `src/retrieval/answer.ts` | refusal logic, extractive + generative answer assembly |
| `src/retrieval/llm.ts` | optional Claude backend (fetch only, no SDK) |
| `src/config.ts` | corpus definition, adapter list, demo principals |
| `scripts/build-index.ts` | run pipeline → `web/public/corpus-index.json` |
| `scripts/ask.ts` | CLI Q&A as a persona |
| `scripts/eval.ts` | gold-set harness with leakage check |

## Where the real work goes next

1. **Web app** — `web/` React app loads `corpus-index.json`, runs `retrieve()`/`answerQuestion()`
   in the browser (both are dependency-free), renders the answer + sources rail + dossier.
   `api/ask.ts` is an optional serverless route for generative answers.
2. **Real adapters** — Drive (service account, `changes` feed, OCR), GivingData (API or
   scheduled export), Airtable (scoped token). Same `SourceDoc` out.
3. **Entity-resolution review queue** — persist low-confidence merge candidates; a human
   confirms or splits.
4. **Real embeddings** — replace `tfidfVector` with a learned embedder (local model or an
   embeddings API) behind the same `Record<string, number>` shape.
5. **Audit log + kill switch + SSO** — see `SECURITY.md`.
