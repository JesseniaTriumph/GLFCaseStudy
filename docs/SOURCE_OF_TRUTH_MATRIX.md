# Compass — source-of-truth matrix

For every kind of fact, which system wins and why (roadmap 1.6). Built **with the Programs +
Impact leads** — the values below are the proposed defaults, to confirm in the synthesis
session. When two systems disagree, Compass **shows both** (see the conflict-surfacing
behaviour) rather than silently applying this matrix — the matrix decides which one leads.

| Fact | Authoritative source | Why | Fallback |
|---|---|---|---|
| Grant amount, currency, start/end dates, status | **GivingData** | The system of record; the grant agreement is executed against it | The signed agreement PDF in Drive |
| Fund / portfolio / cohort assignment | **GivingData** | Structured field; the primary query axis | Airtable tag, if GivingData is untagged (flag as a gap) |
| Grant type (milestone / general-operating / …) | **GivingData** | Determines which questions make sense | — |
| Program officer / grant owner | **GivingData** | Workflow ownership lives there | Airtable `relationshipOwner` |
| **Projected** impact (North Star ratio, earnings delta, participants) | **GivingData** | Entered at approval; vintage-stamped with the model version | The approval memo in Drive |
| **Reported / actual** impact | **GivingData structured field if it exists**, else the final report in Drive | Prefer structured; fall back to the narrative | The grantee-portal submission |
| Reporting schedule + "received / reviewed / approved" state | **GivingData** (Requirements) | Drives the completeness reconciliation | — |
| Decision rationale (why funded / renewed / declined) | **The Drive diligence memo**, then GivingData review notes | The reasoning lives in prose, not fields | An email thread (out of v1 scope) |
| Review / scorecard dimensions + scores | **GivingData** (or attached memo) | The Foundation's diligence rubric | — |
| Organization profile (mission, leadership, history) | **Airtable** | The CRM models relationships GivingData doesn't | GivingData org record |
| Contact: name, role, **work** email | **Airtable** | "Who do we know here" is CRM data | GivingData contact |
| Relationship history / last touchpoint | **Airtable** (interaction log) | Purpose-built for it | — |
| Relationship owner | **Airtable**, unless GivingData is more current | CRM field | GivingData |
| Cross-system identity (grant ↔ org) | **GivingData grant ID** + normalized org name | The grant ID is the only reliable join key | Fuzzy org-name match → the entity review queue |
| Headline impact figures (the public dashboard numbers) | **The impact model / Tableau extract** | The Foundation's published numbers come from there — cite *that*, not a copy in a memo | — |
| What we've said publicly about a grantee | **The public website / news posts** | Authoritative for external consistency checks | — |

## Vintage rule

Every impact figure carries the **date it was reported** and the **model version** used.
"How did they do vs. plan" compares the projection (its vintage) against the actual (its
vintage) — Compass states both dates so a stale comparison is visible.

## When the matrix and reality disagree

If GivingData says one thing and the Drive report says another for the same fact, Compass
surfaces the disagreement in the answer with both citations, grades confidence down to
medium, and the entity/gap report flags it for reconciliation. The matrix is not a licence
to hide a conflict.
