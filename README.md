# Compass

**A permission-aware way to ask years of grant knowledge one question.**

Built for the GitLab Foundation Programs team's problem: five years of grant reports and
internal notes spread across Google Drive, GivingData, Airtable, and Zoom Chat, with no
single source of truth. Compass connects the sources, cleans and de-duplicates them,
resolves everything to the same grants and organizations, enforces who can see what, and
answers questions **with a citation on every claim** and an honest statement of what it
could not see.

> This repository is the working product skeleton that accompanies the strategy doc and
> discovery guide. It runs a real pipeline on a **synthetic corpus** — the source
> connectors are mocks behind the same interface the real ones would implement.

## What actually works here

```
adapters ──▶ clean ──▶ dedupe ──▶ resolve entities ──▶ chunk ──▶ index ──▶ retrieve ──▶ cite
 (mock)     OCR gate   exact +      grant + org +        ~140 tok  BM25 +     ACL filter   [n] +
            language   near +       fund + thesis                  tf-idf     + restricted  coverage
            strip      cross-system                                hybrid     refusal       line
```

- **Modular source adapters** (`src/adapters/`) — `SourceAdapter` is the one contract. The
  mock Drive / GivingData / Airtable adapters and the real ones are interchangeable.
- **Data-quality pipeline** (`src/pipeline/run.ts`) — extraction-confidence quarantine,
  boilerplate stripping, exact + near + cross-system de-duplication with authoritative-copy
  rules, entity resolution, and a **gap report** that reconciles against the grant spine.
- **Hybrid retrieval** (`src/retrieval/search.ts`) — BM25 for exact terms (grant IDs,
  dollar figures) + tf-idf cosine, then a **retrieval-time permission filter** that is the
  security boundary.
- **Grounded answers** (`src/retrieval/answer.ts`) — extractive by default (source text +
  citations + confidence + coverage), generative if `ANTHROPIC_API_KEY` is set. Refuses
  when support is thin or when the topic lives in the Restricted tier.
- **Restricted tier is never indexed** — a metadata-only stub lets Compass say "that's
  restricted" without the content being reachable.
- **Graph join** — a doc that carries only a grant ID gets the organization attached (and
  vice versa) so "how did X do vs projection" can join the projected field, the reported
  field, and the PO note even though they live in different systems.
- **"Ask better"** (`src/retrieval/followups.ts`) — a toggleable assistant surfaced beside
  the answer: what would sharpen it, **who to ask** (the people actually associated with
  the grants involved — PO, relationship owner, note authors, call attendees), suggested
  questions, and a **draft email** when there's a clear recipient.
- **Evaluation harness** (`scripts/eval.ts`) — a gold set with retrieval, refusal, and
  **leakage** checks. Exits non-zero on any leak; wire it into CI.

## Run it

```bash
npm install
npm run build:index          # runs the pipeline, prints the dedupe + gap report
npm run eval                  # runs the gold set (8/8 should pass, 0 leaks)

npm run ask -- "how did Carina perform against projection?"
npm run ask -- --as programs "did we decline an AI upskilling applicant and why?"
npm run ask -- --as other    "did we decline an AI upskilling applicant and why?"   # refused: permission
npm run ask -- --as programs "what did the board discuss about staff compensation?" # refused: restricted
```

Set `ANTHROPIC_API_KEY` to switch answers from extractive to generative (only the
retrieved passages + the question are sent — never the whole corpus).

## Going from mock to real

Each mock adapter's header comments describe the real implementation. To swap one in:
implement `SourceAdapter.pull()` against the real API (service account for Drive, API key
for GivingData, scoped token for Airtable), keep emitting the same `SourceDoc` envelope,
and register it in `src/config.ts`. Nothing downstream changes.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`SECURITY.md`](./SECURITY.md).

## Status

| Area | State |
|---|---|
| Pipeline: clean / dedupe / resolve / graph join / gap report | working on mock data |
| Hybrid retrieval + entity focus + permission filter + restricted refusal | working |
| Extractive answers + citations + coverage | working |
| "Ask better" — gaps / who to ask / suggested questions / draft email | working (toggleable) |
| Generative answers (Claude) | working when `ANTHROPIC_API_KEY` set |
| Eval harness + gold set | working (8 cases) |
| Web UI | next — React app over the built `corpus-index.json` |
| Real connectors | interface defined; implementations are stubs |
| Entity-resolution review queue | not built — low-confidence merges currently auto-apply (see limitations) |

### Known limitations (deliberate, for a v0)
- Entity resolution over-splits some orgs (e.g. "SOAR" vs "Shaping Our Appalachian
  Region") — in the real product these go to a human review queue; here they just don't
  merge, which is a useful illustration of why that queue exists.
- The "semantic" signal is tf-idf cosine, not learned embeddings — swap `tfidfVector` for
  a real embedder behind the same shape.
- Synthetic corpus is small (~6 grants); it exercises every pipeline stage but is not a
  scale test.
