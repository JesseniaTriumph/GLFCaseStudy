# Compass — cost model for launch

**GitLab Foundation · companion to the strategy doc · Jessenia Cintron**

All figures September 2026. Sources at the end. This is a planning estimate with every
assumption stated — not a quote.

---

## The headline

At GitLab Foundation's size, **Compass is cheap to run and the cost is almost entirely
fixed, not per-use.** The AI itself is the smallest line. What costs real money is
one-time: the security pen test and the build.

| | Low | Expected | High |
|---|---:|---:|---:|
| **Monthly run-rate** (infra + APIs, all in) | **$95** | **$260** | **$550** |
| **One-time to launch** (pen test + setup, excl. build labor) | **$9k** | **$18k** | **$32k** |

If the Foundation's legal position rules out any third-party AI, see
[the in-VPC option](#if-no-external-ai-is-allowed) — run-rate goes up, the architecture
doesn't change.

---

## Assumptions

| Assumption | Value | Basis |
|---|---|---|
| Active users | 12–15 of 18 staff | Foundation headcount |
| Queries / month | ~2,500 (≈ 14 users × 8/workday × 21 days) | usage estimate — revisit after pilot |
| Corpus size | ~25,000 documents, ~50M tokens, ~250,000 chunks | 5 years, 3–4 systems — **confirm in discovery (D4, G4)** |
| Answer mode | generative (Claude) on ~60% of queries; extractive on the rest | extractive is the default; generation is a toggle |
| Tokens per generative query | ~6,000 in / ~500 out (8 retrieved passages + question + instructions) | measured against the prototype |
| Re-index cadence | nightly incremental; full re-embed rare | pipeline is incremental by design |

---

## Monthly run-rate

### 1. AI / API

| Item | Calculation | Monthly |
|---|---|---:|
| Claude Sonnet 5 — generation | 1,500 queries × (6,000 in × \$2/M + 500 out × \$10/M) = 1,500 × \$0.017 | **~\$26** |
| — with retries, deep-dive follow-ups, prompt-cache misses | ×2 buffer | **~\$50** |
| Embeddings — query side | 2,500 × ~20 tokens × \$0.02/M | **<\$1** |
| Embeddings — nightly incremental (new/changed docs) | ~1M tokens/mo × \$0.02/M | **<\$1** |
| **AI subtotal** | | **~\$50** |

Prompt caching (the retrieval instructions + system prompt are identical every call) cuts
the input cost materially once traffic is steady — the \$50 already assumes only partial
cache hits.

### 2. Infrastructure

| Item | Option | Monthly |
|---|---|---:|
| App + API host | Cloud Run (scales to ~zero when idle) — or Fly.io / a small VM | **\$15–40** |
| Database + vector index | Cloud SQL Postgres + pgvector: **pilot** db-f1-micro ≈ \$10; **production** 2 vCPU ≈ \$65 | **\$10–65** |
| — managed alternative | Supabase Pro (Postgres + pgvector + auth + backups) flat | **\$25** |
| Object storage (cached source files, thumbnails) | a few GB | **\$1–5** |
| Log / audit streaming (write-once bucket + a log sink) | low volume | **\$5–15** |
| Secrets manager (KMS for connector credentials) | per-key | **\$1–3** |
| Uptime / error monitoring | free tier → small paid | **\$0–25** |
| **Infra subtotal** | | **~\$45–170** |

### 3. Source-system APIs

| System | Cost |
|---|---|
| Google Drive / Workspace API | **\$0** — included in the Foundation's Workspace licenses |
| Airtable API | **\$0** — included in the existing plan |
| GivingData API | **\$0–?** — depends on whether API access is in their plan (**discovery G1**); may be an add-on |
| Zoom API (S2S OAuth) | **\$0** — included; the IM-storage / archiving *add-ons* are separate (below) |

### Run-rate total

**Low \$95 · Expected \$260 · High \$550 per month.** The spread is almost entirely
database sizing and how much monitoring you buy — not usage.

---

## One-time, to launch

| Item | Cost | Notes |
|---|---:|---|
| Third-party penetration test | **\$8,000–25,000** | External vendor, scoped to one web app + API + the permission boundary. Required before production per the security review. |
| Remediation of pen-test findings | included in build | budget 1–2 weeks of fixes |
| Google Cloud / OAuth / service-account setup | **~\$0** | admin time, not a purchase |
| Legal: zero-retention AI agreement + Colombia/Kenya transfer review | **internal counsel time** | or \$3–8k if outside counsel |
| Discovery (2 working sessions + field register + gold set) | **staff time** | ~90 min from the team, plus build time |
| **One-time subtotal (cash)** | **\$9k–32k** | dominated by the pen test |

**Not included:** the build itself. If costed as contract work it's a function of scope
and pace, not a line item here — the roadmap tracks it as phases with go/change/stop
gates, not a fixed number.

---

## Optional / conditional costs

| Trigger | Item | Cost |
|---|---|---:|
| They want 5 years of Zoom chat and retention is too short | Compliance-archiving integration (Global Relay / Smarsh / Theta Lake) | **enterprise-priced, ~\$10–25 / user / month** — likely not worth it for this use |
| Corpus turns out to be 100k+ docs | Larger DB instance + managed embedding endpoint | +\$50–150 / month |
| They want sub-second answers at higher volume | Read replica + a caching layer | +\$30–80 / month |
| Mobile apps (iOS/Android store presence) | Apple \$99/yr + Google \$25 one-time | trivial |

---

## If no external AI is allowed

If the Foundation's position (discovery X3) is "no grantee data to third parties," the
generation layer moves in-VPC. Compass's `Embedder` and `llm` interfaces already abstract
this — no rewrite.

| Item | Monthly |
|---|---:|
| Self-hosted embedding model (bge-small, CPU) | **\$0 extra** — runs on the app host |
| Self-hosted generation (an open model on a GPU instance, e.g. L4) | **\$300–1,200** depending on always-on vs. scheduled |
| **Or:** extractive-only mode (no generation at all) | **\$0** — this is Compass's default; you lose written synthesis, keep cited evidence |

The honest recommendation: **start in extractive-only mode** (\$0 AI, still fully useful —
it returns the exact cited passages), and add generation later under a zero-retention
agreement once there's a track record. That drops the expected run-rate to **~\$210/month**.

---

## What this means for the pitch

> "Running Compass costs the Foundation somewhere around **\$250 a month** — less than one
> software seat — because at 15 users the AI usage is tiny and the cost is mostly a small
> database and hosting. The real spend is a **one-time security pen test, \$8–25k**, which
> I'd treat as non-negotiable before it touches real grantee data. And we can launch the
> first version with **zero AI cost** by returning cited passages instead of written
> answers, then add the writing layer once legal signs off."

---

## Sources

- [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing) — Sonnet 5 at \$2/M input, \$10/M output
- [OpenAI embeddings pricing](https://openai.com/index/new-embedding-models-and-api-updates/) — text-embedding-3-small \$0.02/M (\$0.01/M batch)
- [Voyage AI pricing](https://docs.voyageai.com/docs/pricing) — voyage-4-lite \$0.02/M, alternative embedding provider
- [Google Cloud Run pricing](https://cloud.google.com/run/pricing) · [Cloud SQL pricing](https://cloud.google.com/sql/pricing)
- [Zoom chat message retention](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0060329) — 2-year default, 1d–10y configurable
- [Zoom third-party archiving](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0062360) — Global Relay / Smarsh / Theta Lake
