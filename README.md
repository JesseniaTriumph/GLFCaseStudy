# Compass

**A permission-aware way to ask years of grant knowledge one question — and a working
demonstration that the permission boundary is real, not a UI concept.**

Built for the GitLab Foundation case study. The problem: five years of grant reports and
internal notes spread across Google Drive, GivingData, Airtable, and Zoom Team Chat, with
no single source of truth. Compass connects the sources, cleans and de-duplicates them,
resolves everything to the same grants and organizations, enforces who can see what, and
returns an **evidence brief** — every claim linked to a record the asker can already open,
with an honest statement of what was and wasn't searched.

> **All data here is synthetic and fictional.** No real GitLab Foundation grantee, staff
> member, or record is represented. Organizations (Riverbend Care Collective, Ada Bridge
> Institute, …) and people (Dana Okafor, Marcus Bell, …) are invented for demonstration.

---

## The reframe

This is a **retrieval, permissioning, and citation** problem, not a chatbot problem. The
model phrases; it does not decide. Every security-critical decision is enforced in
deterministic code, outside the model.

Evidence moves through six controlled stages: **Connect → Preserve → Resolve → Retrieve →
Answer → Improve** (`docs/TRD.md`, `docs/ARCHITECTURE.md`).

---

## What actually runs (this is the skills demonstration)

```bash
npm install

npm run eval        # gold Q&A set: retrieval + refusal + PERMISSION-LEAK check
                    #   → 8/8 pass, 0 leakage findings
npm run security    # real RS256 OIDC token verification + tamper-evident audit log
                    #   → 7/7: rejects a tampered token, a wrong-domain account, an
                    #     expired token; detects an edited past audit entry
npm run build:index # the pipeline: clean → dedupe (exact/near/cross-system) → grant↔org
                    #   graph join → gap report + a signed build manifest
npm run audit       # print + verify the hash-chained audit log

npm run ask -- --as programs "how did Riverbend Care Collective perform against projection?"
npm run ask -- --as other    "did we decline an AI upskilling applicant and why?"   # → refused: permission
npm run ask -- --as programs "what did the board discuss about staff compensation?" # → refused: restricted tier not indexed
```

### The web app

```bash
npm run web:build && npm --prefix web run preview     # build the index + serve the app
# or for development:  npm run web:dev
```

Real in-browser hybrid retrieval over the built index, the retrieval-time permission
filter, `Restricted`-tier exclusion, cited evidence briefs, coverage disclosure, and the
toggleable Deep-dive panel — the **same modules** as the CLI and the eval harness. GitLab
Foundation brand, light + dark, WCAG 2.1 AA. Self-contained (`web/src/lib/` is a copy of
the shared retrieval/core modules) so it deploys anywhere:

```bash
cd web && npx vercel deploy        # or: netlify deploy --dir dist  /  any static host
```

---

## What's real vs. what's stubbed

| | |
|---|---|
| **Real** | The pipeline (clean, dedupe, entity resolution, gap report, manifest). Hybrid retrieval (BM25 + tf-idf vector). **The permission filter — enforced per chunk, tested for zero leaks.** `Restricted` excluded from the index (metadata stub + refusal). RS256 ID-token verification. Hash-chained tamper-evident audit log. Content hashing. The eval harness. |
| **Stubbed for the demo** | Google sign-in (a persona switch stands in — real verification is in `src/security/auth.ts`). Deep-link targets (example URLs). The connectors (mock adapters on synthetic fixtures — the real ones implement the same `SourceAdapter` interface). Generative answers (extractive by default; set `ANTHROPIC_API_KEY`). Embeddings (tf-idf stand-in behind the same interface — swap for BGE-M3). |
| **Designed, not built** (see `deliverables/G_Security_Review.md`) | The OAuth callback + session layer, real connector credentials, a production PII scanner, monitoring/alerting, per-user rate limits, a pen test. **Prototype: `CONDITIONAL`. Production: `BLOCKED`** on those six items. |

---

## Documentation

Full standard build-doc set in [`docs/`](docs/README.md): PRD, TRD, DATA_MODEL (ERD),
USER_FLOWS, LOGIC_TREES, WIREFRAMES, PRIOR_ART (build-vs-buy), SYSTEM_TOOLS, CROSS_PLATFORM,
ROADMAP (step tracker), ROLE_AND_CYCLE_CONTEXT.

Security: [`SECURITY.md`](SECURITY.md) · the full architecture is in the strategy doc §6 ·
the lifecycle review (MAP/ATTACK/HARDEN/MONITOR/RESPOND) is `deliverables/G_Security_Review.md`.

Two-minute demo script: [`DEMO.md`](DEMO.md).

---

## Layout

```
src/
  core/types.ts          the canonical envelope, entities, chunks, citations
  adapters/              SourceAdapter interface + mock Drive/GivingData/Airtable
  pipeline/run.ts        clean → dedupe → resolve → chunk → index → gap report
  retrieval/             search (hybrid + permission filter) · answer · followups · llm
  security/              auth (OIDC verify) · audit (hash chain)
scripts/                 build-index · eval · security-check · audit · ask
eval/gold.json           the gold Q&A set
web/                     React + Vite app (self-contained via web/src/lib/)
data/mock/               synthetic fictional corpus
docs/                    the build-doc set
```
