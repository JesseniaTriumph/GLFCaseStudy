# Compass — documentation

Standard build docs for Compass. Read in this order.

| # | Doc | What it answers |
|---|---|---|
| 1 | [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | What Compass is, in one page |
| 2 | [PRD.md](PRD.md) | Product requirements — problem (5 Whys), personas, use cases, functional + non-functional requirements, success metrics |
| 3 | [ROLE_AND_CYCLE_CONTEXT.md](ROLE_AND_CYCLE_CONTEXT.md) | Role- and calendar-aware query scoping (toggleable feature) |
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
| — | [../ARCHITECTURE.md](../ARCHITECTURE.md) | The running code's architecture (as-built) |
| — | [../SECURITY.md](../SECURITY.md) | Security controls: built vs. still-needed |
| — | `deliverables/A_Strategy_Doc.md` §6 | The full security architecture (OAuth → integrity → hardening → IR) |
| — | `deliverables/G_Security_Review.md` | MAP / ATTACK / HARDEN / MONITOR / RESPOND, with a release decision |

## What runs today (`compass/`)

```bash
npm install
npm run build:index    # pipeline: clean → dedupe → resolve → graph join → gap report + manifest
npm run eval           # gold set: retrieval + refusal + permission-leak — 8/8, 0 leaks
npm run security       # OIDC token verify + tamper-evident audit log — 7/7
npm run audit          # print + verify the hash-chained audit log
npm run ask -- --as programs "how did Riverbend Care Collective perform against projection?"
```

Prototype UI: `deliverables/compass_mvp.html` (published Artifact).
