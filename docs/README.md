# Compass — documentation

Standard build docs for Compass. Read in this order.

| # | Doc | What it answers |
|---|---|---|
| 1 | [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | What Compass is, in one page |
| 2 | [PRD.md](PRD.md) | Product requirements — problem (5 Whys), personas, use cases, functional + non-functional requirements, success metrics |
| 3 | [ROLES_AND_USERS.md](ROLES_AND_USERS.md) | Every function in the real ~17-person org — responsibilities, the questions they bring to Compass, the seasonal + grant-lifecycle timing that drives them |
| 3b | [ROLE_AND_CYCLE_CONTEXT.md](ROLE_AND_CYCLE_CONTEXT.md) | The design rationale for the toggleable Role & cycle feature (not a permission gate) |
| 4 | [USER_FLOWS.md](USER_FLOWS.md) | Journey map + every flow (ask, dossier, ingestion, admin) as diagrams |
| 5 | [LOGIC_TREES.md](LOGIC_TREES.md) | The deterministic decision logic — answer/refusal, permission filter, dedupe, release gate |
| 6 | [WIREFRAMES.md](WIREFRAMES.md) | Every screen, every breakpoint; built vs. to-build |
| 7 | [TRD.md](TRD.md) | Technical requirements — architecture, components, retrieval, pipeline, interfaces |
| 8 | [DATA_MODEL.md](DATA_MODEL.md) | ERD, canonical entities, join keys, source-of-truth map, retention |
| 9 | [PRIOR_ART.md](PRIOR_ART.md) | Open-source components, MCP servers, models — build vs. buy, with the "what we own" list |
| 10 | [SYSTEM_TOOLS.md](SYSTEM_TOOLS.md) | Infrastructure, APIs, credentials, provisioning checklist |
| 11 | [CROSS_PLATFORM.md](CROSS_PLATFORM.md) | Web / PWA / iOS / Android strategy — shared core, thin shells |
| 12 | [ROADMAP.md](ROADMAP.md) | Sequential implementation plan + the build/ops agent orchestration (sequential DAG + two loops) |
| — | [CONNECTORS.md](CONNECTORS.md) | Going from mock data to live data — what each connector needs and who provides it |
| — | [BUILD_NOW_VS_HANDOFF.md](BUILD_NOW_VS_HANDOFF.md) | For every "blocker": what runs now with what we have, and the one-line change at handoff |
| — | [GRANT_METADATA.md](GRANT_METADATA.md) | How Compass assesses every grant fact — cadence, term, dates, renewal window — its source, and the fallback when it's missing |
| — | [TIER_POLICY.md](TIER_POLICY.md) | The four-tier sensitivity scheme + the `never-ingest` list (data owner signs off) |
| — | [SOURCE_OF_TRUTH_MATRIX.md](SOURCE_OF_TRUTH_MATRIX.md) | Which system wins per fact, and what happens when they disagree |
| — | [V1_CORPUS_AND_METRIC.md](V1_CORPUS_AND_METRIC.md) | The V1 scope and the 6-month success metric |
| — | [RUNBOOK.md](RUNBOOK.md) | Operator runbook — every command, daily/on-change/incident |
| — | [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) | Playbooks P1–P7, made operational |
| — | [CONTROLS_MATRIX.md](CONTROLS_MATRIX.md) | Controls mapped to NIST CSF / 800-53 / SOC 2 / AI RMF, with status |
| — | [TABLETOP_EXERCISE.md](TABLETOP_EXERCISE.md) | The incident tabletop scenario |
| — | [../ARCHITECTURE.md](../ARCHITECTURE.md) | The running code's architecture (as-built) |
| — | [../SECURITY.md](../SECURITY.md) | Security controls: built vs. still-needed |
| — | `deliverables/A_Strategy_Doc.md` §6 | The full security architecture (OAuth → integrity → hardening → IR) |
| — | `deliverables/G_Security_Review.md` | MAP / ATTACK / HARDEN / MONITOR / RESPOND, with a release decision |

## What runs today (`compass/`)

```bash
npm install
npm run ci             # the promotion gate: typecheck → build → eval → eval:pg → security → server:check → redteam
npm run build:index    # pipeline: clean → PII → injection filter → dedupe → resolve → graph join → gap report + raw store + manifest
npm run eval           # gold set: retrieval + refusal + permission-leak — 11/11, 0 leaks
npm run eval:pg        # the same gold set through the SQL permission filter — 11/11
npm run redteam        # adversarial suite: injection, jailbreak, exfiltration, PII — 16/16, 0 leaks
npm run security       # OIDC token verify + fail-closed auth + tamper-evident audit — 9/9
npm run server:check   # full OIDC login + demo sign-in + hardened headers + rate limit + kill switch — 16/16
npm run deps:audit     # OWASP A06 — fails on any high/critical advisory in shipping deps
npm run demo           # one URL: web app + API + sign-in, every answer through the real permission filter
npm run audit          # print + verify the hash-chained audit log
npm run stats          # usage / trust / cost snapshot from the audit log
npm run tune           # weekly: propose a retrieval change from feedback + eval deltas (never auto-applies)
npm run ask -- --as programs "how did Riverbend Care Collective perform against projection?"
```

The MVP is the web app. Two ways to run it:

- **`npm run demo`** — one server on `http://localhost:8787` serves the web app + the API +
  sign-in. Every answer goes through `POST /api/ask`: the **server-side** permission
  filter, the rate limiter, the audit log. A demo persona switch stands in for Google
  sign-in (or configure real OIDC — `docs/DEMO_HOSTING.md`). This is the one to demo.
- **`npm run web:dev`** — the SPA alone, retrieval in the browser, no server. Deploys to
  any static host (`cd web && npx vercel deploy`). Good for a shareable link; the
  permission filter runs client-side here, so it's the demo build, not the secure one.

Either way it runs the real retrieval, `Restricted` exclusion, conflict surfacing, the
Deep-dive panel with per-grant cycle, and the toggleable Role & cycle context — the same
modules as the CLI and the eval harness, on the synthetic 5-year corpus. The web app is
also an installable PWA (Add to Home Screen, iOS + Android).
