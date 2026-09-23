# Compass accelerated delivery control

## Operating rule

Compass uses two synchronized views of delivery:

1. **Dependency map:** the technically correct order in which capabilities become possible.
2. **Execution schedule:** target turnaround windows, owners, forecasts, and actuals used to press pace and expose opportunities to move work forward.

The dependency map protects correctness. The schedule creates urgency. Neither replaces the other.

## Definition of ahead

The team is ahead when a downstream work package has met its entry conditions earlier than forecast and can be pulled forward without bypassing a release gate. Producing untested code or documents early does not count as being ahead.

## Cross-reference spine

Every work package receives a stable ID and links through:

`Need → PRD → flow/logic → ERD → API/tool → architecture → task → test → evidence → gate`

Example:

`NEED-01 Renewal preparation → FR-ASK-02 permission-safe answer → FLOW-ASK-01 → POLICY-ACL-01 → ENT-EVIDENCE/POLICY_BINDING → API-ASK-01 → WP-RETRIEVE-03 → TEST-ACL-07 → EVID-... → GATE-VERTICAL-SLICE`

## Tracker fields

| Field | Purpose |
|---|---|
| Work-package ID | Stable reference across documents and code |
| Outcome | Observable capability produced |
| Requirement links | PRD requirements satisfied |
| Owner / reviewer | Accountability and approval |
| Prerequisites | Conditions that truly block starting |
| Parallel lanes | Work that can proceed concurrently |
| Target window | Aggressive but evidence-based turnaround target |
| Planned / forecast / actual | Separates baseline, current expectation, and fact |
| Status | Not ready, ready, active, review, verified, blocked |
| Acceptance evidence | Code, test, deployment, decision, or approved artifact |
| Critical path | Whether delay moves the end-to-end delivery date |
| Acceleration trigger | Evidence that allows early pull-forward |
| Fallback | Alternate route if an external dependency stalls |
| Scope flex | Safe narrowing that preserves the outcome |
| Risk / blocker | Current obstacle and owner |
| Next handoff | Exact recipient and entry condition |

## Parallel delivery lanes

### Product and experience

Discovery, PRD, user flows, Role & Cycle lens, responsive states, accessibility, and usability testing.

### Data and connectors

Source contracts, synthetic fixtures, Drive/GivingData/Airtable adapters, parsing, lineage, canonical entities, synchronization, deletion, and data-quality handling.

### Platform and application

Authentication, exact-user admission, sessions, API contracts, database, retrieval, answer contract, citations, admin operations, and deployment.

### Security and privacy

Threat map, authorization model, negative tests, prompt-injection defenses, secrets, audit, monitoring, kill switches, and incident/recovery mechanisms.

### Evaluation

Gold questions, expected evidence, retrieval/citation metrics, conflict and abstention tests, permission-leak tests, Role & Cycle relevance tests, and release evidence.

### Adoption and operations

Design-partner workflow, documentation, runbooks, office hours, support, ownership, feedback review, and change management.

These lanes run concurrently when their inputs exist. They converge at integration and release gates.

## Critical path to the first real end-to-end slice

1. Confirm one decision workflow and its acceptance test.
2. Define one approved corpus and its source contract.
3. Establish verified identity and exact-user admission.
4. Define canonical grant/organization/evidence and policy records.
5. Implement one read-only connector or controlled import with lineage and deletion behavior.
6. Parse and classify evidence into a candidate store.
7. Enforce authorized candidate retrieval before ranking or model context.
8. Return a typed evidence brief with material-claim citations, coverage, conflicts, and abstention.
9. Exercise the full flow through responsive UI.
10. Run functional, permission-leak, injection, failure, and recovery tests.
11. Link evidence and issue `READY`, `CONDITIONAL`, or `BLOCKED` for the slice.

## Acceleration rules

- Build synthetic fixtures and API contracts while credentials are pending.
- Build connector adapters against official schemas while access approval proceeds, then validate against a redacted sample.
- Build authorization tests before the production policy store exists; run them against the in-memory reference implementation first.
- Build the answer schema and citation validator while parsing is being benchmarked.
- Build responsive states and accessibility tests against synthetic API fixtures while the backend develops.
- Build the evaluation harness from agreed questions before the model path exists; an extractive baseline can be tested first.
- Draft runbooks alongside implementation, then replace assumptions with verified commands and evidence.
- Use feature flags to integrate completed lanes safely without exposing unfinished capabilities.

## Fallback rules

- GivingData API delayed → controlled, signed, reconciled export using the same `SourceAdapter` envelope.
- Drive-wide access delayed → one approved folder or synthetic corpus; never broaden credentials to save time.
- LLM agreement delayed → extractive evidence briefs; do not send real content to an unapproved model.
- Embedding choice unresolved → lexical/structured retrieval baseline behind the same retrieval interface.
- Parser benchmark fails → quarantine affected types and support verified native exports first.
- Role directory integration delayed → admin-approved assignments and explicit user-selected context; never infer authorization from title.
- Native/mobile decision delayed → responsive web; do not duplicate clients prematurely.

## Gates that schedule pressure cannot waive

- exact-user authentication and server-side authorization;
- zero known permission leaks in the approved adversarial suite;
- no restricted content or revealing metadata in unauthorized responses;
- verified citation linkage for material factual claims;
- visible synthetic/real-data state;
- deletion and permission-revocation propagation;
- bounded model/tool authority;
- functioning audit, kill switch, rollback, and recovery for production data;
- an accountable product/data owner.

## Pace review

At each review, answer:

1. What acceptance evidence closed since the last review?
2. What is now ready to pull forward?
3. Which critical-path item moved and why?
4. Which lane can help unblock it?
5. What forecast changed?
6. What safe scope flex protects the end-to-end outcome?
7. Which gate remains non-negotiable?
8. What is the exact next handoff?

This lets the team drive a short turnaround aggressively while preserving the truthfulness, security, and maintainability required for a real Compass MVP.
