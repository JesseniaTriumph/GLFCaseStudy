# Compass — sensitivity tier policy

The four-tier scheme the whole permission model hangs off (roadmap 1.5). **The data owner
in the COO's office approves this document and the `never-ingest` list before the first
production sync.** Nothing enters a production index until they do.

---

## The four tiers

| Tier | Who can retrieve it | What it holds | Enforcement |
|---|---|---|---|
| **team** | any signed-in `@gitlabfoundation.org` staff member | Grant fact sheets, thesis memos, published outcomes, org profiles, most progress reports | ACL `["*"]` + `allowedTiers` includes `team` (every principal) |
| **programs-only** | Programs, Impact, Executive, Donor Engagement, Finance/Grants-Ops groups | Internal diligence memos, review scorecards, program-officer notes, the interaction log, candid assessments of grantee viability | ACL `["group:programs","group:impact"]` + `allowedTiers` includes `programs-only` |
| **restricted** | **no one, through Compass** | Board materials, staff compensation, legal/contract negotiation, **declined-applicant diligence**, any document naming individual program participants | Never indexed. A metadata-only stub exists for policy-restricted docs so a matching question is refused *without confirming the record's contents or count*. PII-raised docs leave no stub at all. |
| **never-ingest** | — | HR/personnel files, donor records for anonymity-requesting funders, anything under a co-funder MOU that bars secondary use, anything counsel names | Never pulled by a connector. Named drives/folders/bases are on an explicit exclusion list in `src/config.ts`. |

---

## How a document gets its tier

1. **Source rule** — a connector assigns a starting tier from the folder / base / record
   type (e.g. anything in `Board/` → `restricted`; the Airtable interaction log →
   `programs-only`).
2. **Folder / label overrides** — Drive Labels or a named-folder rule can raise a tier.
3. **The PII pass** — a document that scores high on direct identifiers *or* reads as
   named-participant data is **automatically raised to `restricted`** and quarantined,
   regardless of where it lives (`src/pipeline/pii.ts`).
4. **The injection pass** — a document that reads as a prompt-injection attempt after
   cleaning is quarantined (not a tier, an exclusion).
5. **Review queue** — a low-confidence tier call is surfaced for a human (`/admin/review`),
   not applied silently.

The rule of thumb from prior engagements: **the sensitive content is never only where the
org first tells you it is.** That's why the PII pass runs on everything, not just the
flagged folders.

---

## The `never-ingest` list (to be finalized with the data owner)

Draft — each line needs a yes/no from the data owner and, where marked, counsel:

- All Google Shared Drives / folders named `Board`, `HR`, `People`, `Legal`, `Compensation`, `Personnel`
- The GivingData record types: reviewer identities on scorecards *(counsel)*
- Airtable bases/tables holding donor or anonymity-requesting-funder records
- Any grant flagged with a co-funder confidentiality clause *(counsel — needs the list)*
- Co-funder shared drives / portals (Ballmer Group, Annie E. Casey) — out of scope, and the
  team is told Compass cannot reach them
- Individual staff `My Drive` content and personal notes apps
- Zoom DMs and private channels — permanently, in code

---

## Changing a tier

A tier change is an `admin` audit event. It requires the data owner's sign-off, and the
next `npm run ci` must pass (a tier change that starts leaking is a hard stop). Never
change a tier straight in production without the gate.
