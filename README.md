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

**What Compass is not:** a grants-management system. GivingData tracks the grant lifecycle,
payments, and requirement statuses and runs the workflow. Compass is **read-only** — it
*reads* that tracking data (and Drive, Airtable, Zoom) and *answers questions* about it,
including tracking questions ("which grants have reports overdue", "when is Riverbend's
renewal"). The per-grant cycle logic (`src/grant-cycle.ts`) *shows* where each grant is in
its own schedule; it does not *do* the tracking — no "mark received" button, no workflow.

---

## What actually runs (this is the skills demonstration)

```bash
npm install

npm run ci          # the PROMOTION GATE — runs everything below in order, stops on the first red:
                    #   typecheck → build:index → eval → eval:pg → security → server:check → redteam

npm run eval        # gold Q&A set: retrieval + refusal + PERMISSION-LEAK check
                    #   → 12/12 pass, 0 leakage findings   (in-memory retrieval)
npm run eval:pg     # the SAME gold set, retrieval through Postgres (PGlite, zero setup)
                    #   → 12/12, 0 leaks — the permission filter is a SQL WHERE clause
npm run redteam     # adversarial suite: 15 planted injection docs + jailbreak, exfiltration,
                    #   permission-probing, PII-extraction cases → 16/16, 0 leaks
npm run security    # RS256 OIDC verification + FAIL-CLOSED auth + tamper-evident audit
                    #   → 9/9: rejects tampered / wrong-domain / expired tokens; a failed
                    #     group lookup grants nothing; detects an edited past audit entry
npm run server:check # the HTTP server + the FULL OIDC login flow against a mock Google IdP
                    #   → 12/12: 401 without a session; login→callback verifies a real RS256
                    #     token; rate-limit trip; kill switch; server-side session revocation;
                    #     the restricted question refused with no metadata leak
npm run build:index # pipeline: clean → PII scrub → injection filter → dedupe → grant↔org
                    #   graph join → raw store → gap report + entity review queue + manifest
npm run audit       # print + verify the hash-chained audit log
npm run stats       # usage / trust / cost snapshot from the audit log
npm run ask -- --pg --as impact "how did Riverbend perform against projection?"  # SQL path

npm run ask -- --as programs "how did Riverbend Care Collective perform against projection?"
npm run ask -- --as other    "did we decline an AI upskilling applicant and why?"   # → refused
npm run ask -- --as programs "what did the board discuss about staff compensation?" # → refused, no metadata leak
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
| **Real — pipeline** | Clean · PII scrub + participant-data quarantine · indirect-prompt-injection pattern-strip + quarantine · dedupe (exact/near/cross-system) · entity resolution + grant↔org graph join · **entity review queue** · immutable content-addressed **raw store** · gap report (incl. what our own processing dropped) · signed build manifest. |
| **Real — retrieval & answer** | Hybrid BM25 + tf-idf. **The permission filter — per chunk, tested for zero leaks, runnable as a SQL `WHERE` clause on Postgres (`npm run eval:pg`).** `Restricted` never indexed. Evidence brief with inline deep-link citations, coverage disclosure, **operationally-defined confidence** (coverage / source-agreement / freshness / citation-completeness), abstention, **conflict surfacing** (disagreeing figures shown, not merged), multilingual (ES↔EN) keyword bridge. |
| **Real — security** | RS256 OIDC verification + **fail-closed** on a failed group lookup. HMAC session + **per-user & global server-side revocation**. Hash-chained tamper-evident audit log + **off-host stream hook**. Per-user rate + cost limits → `429`. Anomaly monitor (restricted-probing / auth-brute / broad-sweep / withheld-surge / cost-spike → IR playbooks). **Kill switch.** `/admin/review` · `/admin/stats` · `/api/feedback`. |
| **Real — server** | `src/server/` — the **full OIDC Authorization-Code + PKCE flow**: `/auth/login` → Google → `/auth/callback` verifies the RS256 ID token, sets an `HttpOnly; Secure; SameSite=Strict` cookie; `/api/ask` runs the same permission-filtered `answerQuestion`. `npm run server:check` → 12/12. `npm run serve` runs it against a real Google OAuth client. |
| **Real, opt-in** | Learned embeddings — `bge-small` locally via transformers.js (`npm run eval:embed`, 0 leaks); `bge-m3` registered as the multilingual option. Optional NER name redaction (`src/pipeline/ner.ts`, `COMPASS_PII_NER=true`). |
| **Real, credential-activated** | Google Drive / GivingData / Airtable connectors (`src/adapters/`) — same `SourceAdapter` interface as the mocks; live the moment a credential is in `.env`, mock otherwise. Zoom Team Chat + Archive and Notion connectors, built and gated (`COMPASS_ZOOM_ENABLE` / `COMPASS_NOTION_ENABLE`). |
| **Stubbed for the demo** | The connectors run on a synthetic fictional corpus. Deep-link targets are example URLs. Answers are extractive (a generative backend is `ANTHROPIC_API_KEY`). Google Groups sync is a `resolveGroups` stub (production = a read-only Admin SDK lookup). The web SPA runs retrieval in the browser with a persona switch instead of a login. The mobile app (`mobile/`) is an Expo scaffold. |
| **Needs the Foundation's environment** (see `deliverables/G_Security_Review.md`, `docs/CONTROLS_MATRIX.md`) | Real connector credentials in a KMS · an egress allowlist · the off-host audit sink pointed at real write-once storage · Redis behind the rate-limiter/revocation store · a third-party pen test · counsel's Colombia/Kenya cross-border determination · exercising the incident tabletop. **Prototype: `CONDITIONAL`. Production: `BLOCKED`** on those items. |

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
