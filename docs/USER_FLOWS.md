# Compass — User Flows & Journey Maps

Multimodal: the flows are the same on web, PWA, and native; layout adapts (see
`CROSS_PLATFORM.md`).

---

## Journey map — Program Officer, renewal prep (primary)

| Stage | Doing | Thinking | Feeling | Compass touchpoint | Opportunity |
|---|---|---|---|---|---|
| Trigger | Renewal review is on the calendar for a grantee | "How did they actually do vs. what they told us?" | Time-pressured | — | — |
| Old way | Open Drive, GivingData, Airtable in tabs; skim a folder of PDFs; ping a colleague on Zoom | "This will take the afternoon" | Resigned | — | Replace this entirely |
| Ask | Types the question into Compass | "Let's see if this is real" | Skeptical | Ask box + example prompts | Fast first result |
| Read | Reads a 4-line answer, checks two citations | "Okay, behind on volume, ahead on wage — and Matt flagged a revised ramp" | Warming up | Answer + sources rail + coverage line | Every claim one click from its source |
| Verify | Clicks `[3]` → lands on the exact sentence in the PO note, highlighted | "Good, it's not making this up" | Trust building | Deep-link citation | This is the trust moment |
| Extend | Opens Deep dive: no Year-2 report yet; ask Matt; draft email ready | "Right, I should confirm the revised target with Matt" | In control | Deep dive panel | Turns an answer into a next step |
| Act | Marks the answer "for external use" for the board memo; copies the draft email | "Ten minutes, not an afternoon" | Relieved | Verify banner + feedback | Measurable time saved |

---

## Core flow — Ask → cited answer

```mermaid
flowchart TD
    A[User opens Compass] --> B{Session valid?}
    B -- no --> C[Redirect to Google sign-in]
    C --> D[Verify ID token: sig / iss / aud / exp / hd]
    D -- fail --> C
    D -- ok --> E[Issue session · derive Principal from groups]
    B -- yes --> F[Ask box + example prompts + last query]
    E --> F
    F --> G[User submits question]
    G --> H[Hybrid retrieve: dense + BM25]
    H --> I[Permission filter in SQL: tier ∈ allowed AND acl overlaps principal]
    I --> J[Rerank top-30 → top-k]
    J --> K{Strong support?}
    K -- no, and a restricted stub matched --> L[Refuse: topic is Restricted · route to COO office]
    K -- no --> M[Refuse: not enough in what I can see · show coverage]
    K -- yes --> N{LLM configured?}
    N -- no --> O[Extractive answer: passages + inline citations]
    N -- yes --> P[Send passages + question only → LLM → cited answer]
    O --> Q[Attach coverage line · confidence · withheld count]
    P --> Q
    Q --> R[Render answer + sources rail + Deep dive if on]
    R --> S[Append query to tamper-evident audit log]
    S --> T[User: click citation / open Deep dive / mark external / feedback]
    T -- click citation --> U[Open source in system, passage highlighted]
    T -- feedback --> V[Write to evaluation set]
```

---

## Flow — Grantee dossier

```mermaid
flowchart LR
    A[User picks an organization] --> B[Load entity graph for that org]
    B --> C[Assemble: grants · projected vs reported · contacts · timeline · open questions]
    C --> D[Each line filtered by Principal's permissions]
    D --> E{Conflicting values across systems?}
    E -- yes --> F[Show both, flagged — do not merge]
    E -- no --> G[Show authoritative value + source link]
    F --> H[Render dossier · every line cited]
    G --> H
    H --> I[Append dossier view to audit log]
```

---

## Flow — Ingestion (LangGraph, scheduled — no user)

```mermaid
flowchart TD
    S1[Connector-Sync: pull each source since last run] --> S2{Volume sane vs last run?}
    S2 -- dropped sharply --> AL[Alert — possible source break] --> S1
    S2 -- ok --> P1[Parse + OCR · pdf-inspector routes per page]
    P1 --> P2{Extraction confidence ≥ threshold?}
    P2 -- no --> Q[Quarantine — not indexed] 
    P2 -- yes --> P3[PII scan → redact / tier-up]
    P3 --> P4{Tier}
    P4 -- restricted --> STUB[Metadata-only stub · content dropped]
    P4 -- team / programs-only --> D1[Dedupe: exact / near / cross-system]
    D1 --> D2{Merge confidence}
    D2 -- low --> RQ[Human review queue]
    D2 -- high --> R1[Entity resolve → grant / org / fund / person]
    R1 --> R2[Chunk → embed BGE-M3 → upsert to candidate index]
    R2 --> RC[Reconcile vs grant spine → gap report]
    RC --> EV{Eval gate: gold set + promptfoo red-team}
    EV -- regression / leak --> BLOCK[Do not promote · alert] 
    EV -- green --> PR[Atomic promote candidate → live · write manifest · audit]
```

---

## Flow — Admin: change a sensitivity tier

```mermaid
flowchart TD
    A[Admin requests a tier change] --> B[Step-up re-authentication]
    B --> C{Downgrade e.g. restricted→programs-only?}
    C -- yes --> D[Require a second approver]
    D --> E{Second approval given?}
    E -- no --> X[Rejected]
    E -- yes --> F[Apply · re-run affected ingestion · audit both approvers]
    C -- no, upgrade --> F
```

---

## Error & edge states (all surfaces)

| State | What the user sees |
|---|---|
| No matching content | "I don't have anything in what I can see that solidly answers this." + coverage line |
| Topic is Restricted | "This would require Restricted material (board / compensation / legal). Not indexed. Request via the COO's office." |
| Caller lacks permission | "N passages match but sit outside what you can retrieve here." |
| LLM unavailable | Falls back to an extractive answer, labelled as such |
| Stale index (sync failed) | Banner: "Last synced {time} — some recent changes may be missing" |
| Kill switch active | "Compass is paused. Sources are unaffected. Contact {owner}." |
