# Compass — Data Model (ERD)

Compass is a **derived** store. Every row traces to a source system that remains
authoritative and read-only. The index can be wiped and rebuilt from source at any time.

## Entity–relationship diagram

```mermaid
erDiagram
    ORGANIZATION ||--o{ GRANT : "receives"
    ORGANIZATION ||--o{ CONTACT : "employs"
    ORGANIZATION ||--o{ INTERACTION : "party to"
    FUND ||--o{ GRANT : "funds"
    GRANT ||--o{ REQUIREMENT : "has"
    GRANT ||--o{ REPORTED_OUTCOME : "produces"
    GRANT ||--o{ DECISION : "subject of"
    GRANT }o--o{ THESIS_AREA : "tagged"
    GRANT ||--o{ SOURCE_DOC : "documented by"
    ORGANIZATION ||--o{ SOURCE_DOC : "documented by"
    SOURCE_DOC ||--|{ CHUNK : "split into"
    SOURCE_DOC ||--o{ SOURCE_DOC : "duplicate-of"
    PERSON ||--o{ INTERACTION : "attends"
    PERSON ||--o{ SOURCE_DOC : "authored"
    GRANT ||--o{ PERSON : "program officer"
    PRINCIPAL ||--o{ AUDIT_RECORD : "generates"
    INDEX_BUILD ||--|{ CHUNK : "contains"
    INDEX_BUILD ||--o{ GAP : "reports"

    ORGANIZATION {
        uuid id PK
        string canonical_name
        string[] aka
        string ein
        string geography
        string givingdata_org_id
        string airtable_record_id
    }
    GRANT {
        string id PK "GivingData grant id — the spine"
        uuid organization_id FK
        uuid fund_id FK
        string program_officer
        int amount
        string currency
        string status
        date start_date
        date end_date
        string[] co_funders
        jsonb projected "north_star, annual_delta, lifetime_delta, participants, model_version"
        tier review_notes_tier
    }
    FUND {
        uuid id PK
        string name "AI4EO | Powering Economic Opportunity | Learning for Action"
    }
    REQUIREMENT {
        uuid id PK
        string grant_id FK
        string type "proposal | progress report | final report"
        date due_date
        string status "upcoming | received | overdue | waived"
        string submitted_doc_id
    }
    REPORTED_OUTCOME {
        uuid id PK
        string grant_id FK
        string period
        date as_of
        string model_version "vintage stamp"
        int participants
        int annual_earnings_delta
        text narrative
    }
    DECISION {
        uuid id PK
        string grant_id FK
        string kind "approve | decline | renew | hold"
        date decided_on
        text rationale
        jsonb rubric "5-dimension scores"
        tier tier "usually programs-only"
    }
    THESIS_AREA {
        uuid id PK
        string label
    }
    PERSON {
        uuid id PK
        string name
        string role
        string work_email
        string kind "internal | external"
        boolean pii_redacted
    }
    CONTACT {
        uuid id PK
        uuid organization_id FK
        string title
        string work_email
        tier personal_fields_tier "restricted — redacted by default"
    }
    INTERACTION {
        uuid id PK
        uuid organization_id FK
        string grant_id FK
        date occurred_on
        string type "call | email | site visit | meeting"
        text summary
        tier tier "programs-only"
    }
    SOURCE_DOC {
        string id PK "system:sourceId"
        string system "drive | givingdata | airtable | …"
        string source_id
        string deep_link
        string title
        text text
        date as_of_date
        string language "en | es | unknown"
        float extraction_confidence
        tier tier
        string[] acl
        string content_sha256
        string duplicate_of "authoritative doc id, if a copy"
        jsonb meta
    }
    CHUNK {
        string id PK "docId#n"
        string doc_id FK
        string index_build_id FK
        text text
        vector embedding "pgvector"
        tsvector tokens "BM25"
        tier tier
        string[] acl
        string[] entity_ids
        string deep_link
        string locator "§ heading / p. n / field"
        boolean restricted_stub
    }
    PRINCIPAL {
        string user_id PK "email localpart"
        string[] groups
        tier[] allowed_tiers "never includes restricted"
    }
    AUDIT_RECORD {
        int seq PK
        timestamptz ts
        string type "query | ingest | admin | auth"
        jsonb event "minimised — no secrets, no PII, no full prompts"
        string prev_hash
        string hash "sha256(seq|ts|event|prev_hash)"
    }
    INDEX_BUILD {
        string id PK
        timestamptz built_at
        string commit
        string content_digest
        jsonb source_counts
        string status "candidate | live | retired"
    }
    GAP {
        uuid id PK
        string index_build_id FK
        string grant_id
        string kind "missing report | no org record | untagged | overdue"
        string detail
    }
```

## Canonical entities & join keys

| Entity | Primary key | Resolved from |
|---|---|---|
| **Grant** | GivingData grant id | GivingData (native); Drive filenames/bodies; Airtable cross-ref field |
| **Organization** | uuid; keyed on normalized name + `givingdata_org_id` | all four systems (fuzzy match on name → review queue) |
| **Person** | uuid; name + email | GivingData contacts, Airtable contacts, Drive authors/comments, interaction attendees |
| **Fund / Thesis area** | uuid on label | GivingData (native), Drive folder path, Airtable tags — mapped to one controlled vocabulary |

## Sensitivity tiers (on every SOURCE_DOC and CHUNK)

`team` · `programs-only` · `restricted` (not indexed — stub only) · `never-ingest` (absent entirely).
`acl text[]` holds the principals (`group:programs`, `user:x`, `*`) allowed to read the source.

## Source-of-truth map (which system wins per fact)

| Fact | Authoritative | Fallback |
|---|---|---|
| Grant amount, dates, status | GivingData GRANT | executed agreement (DocuSign) |
| Projected impact | GivingData GRANT.projected | the impact model sheet |
| Reported / actual outcome | GivingData REPORTED_OUTCOME | the final report SOURCE_DOC in Drive |
| Decision rationale | Drive diligence memo | GivingData DECISION.rationale |
| Organization profile / relationship | Airtable | GivingData ORGANIZATION |

## Retention

Source data: never modified or deleted by Compass. CHUNK / INDEX_BUILD: rebuilt on each
promotion; old builds retired then purged. AUDIT_RECORD: retention-bounded per the
Foundation's schedule, reviewed with counsel; the hash chain and off-host copy are
permanent-until-policy.
