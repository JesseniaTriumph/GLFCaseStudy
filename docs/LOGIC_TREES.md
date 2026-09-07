# Compass — Conditional Logic Trees

The deterministic decision logic that sits **outside the model**. These are enforced in
code (`src/retrieval/*`, `src/pipeline/*`), tested by `npm run eval` / `npm run security`,
and must never be delegated to a prompt.

---

## 1. Answer decision tree (the query path)

```mermaid
flowchart TD
    Q[Question + verified Principal] --> R[Hybrid retrieve, ACL-filtered in SQL]
    R --> W{Any passages withheld?}
    W -- yes --> WT[record withheld count + tiers]
    W -- no --> C0
    WT --> C0{hits.length == 0?}
    C0 -- yes --> P0{withheld includes a non-team tier?}
    P0 -- yes --> RF1[REFUSE — permission: N passages outside your scope]
    P0 -- no --> RF2[REFUSE — nothing in what I can see answers this]
    C0 -- no --> C1{restricted stub matched AND
    its score ≥ 0.7 × best real hit?}
    C1 -- yes --> RF3[REFUSE — topic is Restricted, not indexed,
    request via COO office]
    C1 -- no --> C2{top hit weak?
    bm25 < 1.6 AND semantic < 0.08}
    C2 -- yes --> RF2
    C2 -- no --> GEN{LLM configured?}
    GEN -- no --> EXT[EXTRACTIVE answer — passages + [n] citations,
    labelled 'no generative model']
    GEN -- yes --> LLM[send passages + question ONLY → model]
    EXT --> GRADE
    LLM --> GRADE[grade confidence]
    GRADE --> G1{top bm25 > 3 AND ≥ 2 strong matches?}
    G1 -- yes --> HI[confidence = HIGH]
    G1 -- no --> G2{≥ 1 strong match?}
    G2 -- yes --> MED[confidence = MEDIUM — 'verify against sources']
    G2 -- no --> LO[confidence = LOW — 'a lead, not an answer']
    HI --> OUT
    MED --> OUT
    LO --> OUT
    OUT[attach coverage line + withheld + citations] --> AUD[append to audit log]
```

**Rules encoded here:** refusal beats a weak answer; a Restricted match beats a mediocre
real answer; the model is only ever handed the retrieved passages; confidence is graded
from retrieval strength, not from the model's self-report.

---

## 2. Permission filter (the security boundary)

```mermaid
flowchart TD
    CH[Candidate chunk] --> S{chunk.restricted_stub?}
    S -- yes --> SC{lexical score > 0.4?}
    SC -- yes --> WH[count as WITHHELD:restricted · never return]
    SC -- no --> DROP[ignore]
    S -- no --> T{chunk.tier ∈ Principal.allowedTiers?}
    T -- no --> WH2[count as WITHHELD · drop]
    T -- yes --> A{chunk.acl ∩ Principal.principals ≠ ∅?}
    A -- no --> WH2
    A -- yes --> KEEP[eligible for ranking]
```

`Principal.principals = {user:<id>} ∪ {group:<g> for g in groups} ∪ {*}`.
`restricted` is never in `allowedTiers` for any principal in v1.

---

## 3. Ingestion tier & quality gate (per document)

```mermaid
flowchart TD
    D[Pulled document] --> X{extraction_confidence ≥ 0.6?}
    X -- no --> QUAR[QUARANTINE — surfaced on the ops dashboard, not indexed]
    X -- yes --> L[detect language en/es]
    L --> PII{contains participant identifiers /
    personal contact / financial account #?}
    PII -- yes --> RED[redact OR raise tier; participant IDs never indexed]
    PII -- no --> TIER
    RED --> TIER{resolved tier}
    TIER -- never-ingest --> DROP2[absent from the system entirely]
    TIER -- restricted --> STUB[store title + entities only · drop content]
    TIER -- team / programs-only --> DEDUP[continue to dedupe]
```

---

## 4. De-duplication & authoritative-copy selection

```mermaid
flowchart TD
    P[Pair of live docs] --> H{identical content hash?}
    H -- yes --> M1[EXACT dup — fold, keep one]
    H -- no --> X{shared 'duplicate_of' pointer
    OR same grant_id + same-ish title cross-system?}
    X -- yes --> AUTH
    X -- no --> J{token Jaccard ≥ 0.82?}
    J -- yes --> AUTH
    J -- no --> KEEP[distinct — keep both]
    AUTH[pick authoritative] --> RANK[rank = system priority ×100
    + extraction_confidence ×10
    + recency; GivingData > Drive > Airtable;
    native > OCR; newer > older]
    RANK --> FOLD[fold the loser → alternate; log the merge; reversible]
```

---

## 5. "Deep dive" trigger logic (toggleable; off the answer)

```mermaid
flowchart TD
    ANS[Answer produced, not refused] --> ON{Deep dive enabled?}
    ON -- no --> STOP
    ON -- yes --> E[collect grant_ids + org_labels from top-5 hits]
    E --> G1{gap report has missing/overdue items for these grants?}
    G1 -- yes --> ADD1[gap: 'GD-xxxx: overdue baseline report']
    E --> G2{fact sheet present but no reported-results doc?}
    G2 -- yes --> ADD2[gap: 'plan only, no outcomes yet']
    E --> G3{answer drew on one system only?}
    G3 -- yes --> ADD3[gap: 'X only — Y and Z may add context']
    E --> G4{restricted content was withheld?}
    G4 -- yes --> ADD4[gap: 'some relevant material is Restricted']
    E --> WHO[directory ∩ these grants/orgs →
    rank: program officer > relationship owner >
    note author > call attendee > external contact]
    WHO --> EM{is there one clear INTERNAL recipient with an email?}
    EM -- yes --> DRAFT[compose draft email: question + top gaps + top suggested Qs]
    EM -- no --> NODRAFT[no draft — list who to ask only]
```

---

## 6. Release gate (per index build / per deploy)

```mermaid
flowchart TD
    B[Candidate index build] --> E1[run gold-set harness]
    E1 --> E1R{citation accuracy ≥ bar
    AND refusal calibration ok?}
    E1R -- no --> BLOCK
    E1R -- yes --> E2[run promptfoo red-team:
    permission leak / injection / PII extraction]
    E2 --> E2R{zero leakage findings?}
    E2R -- no --> BLOCK[BLOCKED — do not promote · alert · open ticket]
    E2R -- yes --> E3{cost per query within budget?}
    E3 -- no --> COND[CONDITIONAL — promote to staging only]
    E3 -- yes --> READY[promote candidate → live · write manifest · audit]
```

**Allowed outcomes:** `READY` · `CONDITIONAL` · `BLOCKED`. A leakage finding is always
`BLOCKED`, no exceptions.
