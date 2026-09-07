# Compass — Wireframes

Low-fidelity structure for every screen. The **working prototype** (`deliverables/compass_mvp.html`,
published Artifact) is the high-fidelity reference for the Ask and Dossier screens on
desktop. These wireframes cover all screens and all breakpoints, and mark what is built
vs. to build.

Legend: `[built]` in the prototype · `[spec]` designed here, not yet built.

---

## 1. Ask — desktop (≥1024px) `[built]`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◆ Compass        Ask · years of grant knowledge, one question   [PROTOTYPE]   │
│ ─────────────────────────────────────────────────────────────────────────────│
│ CORPUS  ● GivingData 2022–26   ● Google Drive 3 drives   ● Airtable           │
│         ○ Zoom Chat — not connected (v1)                                      │
│                                                                              │
│  Ask | Grantee dossier                                                        │
│  ┌─────────────────────────────────────────┐   ┌───────────────────────────┐  │
│  │ [ type a question …                 ]   │   │ SOURCES & COVERAGE        │  │
│  │  ▸ How did Riverbend Care Collective perform vs projection? │   │ ┌───────────────────────┐ │  │
│  │  ▸ Barriers to credential completion?    │   │ │[givingdata]  GD-1188  │ │  │
│  │  ▸ Have we funded advanced-energy training…?   │   │ │[1] Grant fact sheet   │ │  │
│  │  ▸ Did we decline an AI applicant?       │   │ │ …snippet…             │ │  │
│  │  ▸ Board discussion on compensation?     │   │ │ ↳ opens in givingdata,│ │  │
│  │                                         │   │ │   passage highlighted │ │  │
│  │ ── QUESTION ────────────────────────────│   │ │ ● TEAM                │ │  │
│  │ How did Riverbend Care Collective perform against          │   │ └───────────────────────┘ │  │
│  │ projection…?                            │   │ ┌───────────────────────┐ │  │
│  │                                         │   │ │[drive] PO check-in     │ │  │
│  │ ── ANSWER ──────────────────────────────│   │ │[3] …behind on volume…  │ │  │
│  │ Riverbend Care Collective projected 107× / +$9,400 [1].    │   │ │ ● PROGRAMS-ONLY       │ │  │
│  │ Year 1: 2,610 placed — 67% of target[2].│   │ └───────────────────────┘ │  │
│  │ PO recommends a revised ramp [3].        │   │  … (4 sources)            │  │
│  │                                         │   │ ─────────────────────────│  │
│  │ Searched GivingData(2022–26)·3 Drives·  │   │ 2 sources withheld ·     │  │
│  │ Airtable. Not covered: pre-2022, Zoom,  │   │ Restricted (board/comp)  │  │
│  │ board/comp.                             │   └───────────────────────────┘  │
│  │ ● Well supported  ☐ mark for external   │                                  │
│  │ ── DEEP DIVE (toggle: show) ────────────│                                  │
│  │ What would sharpen this: no Year-2 rpt  │                                  │
│  │ Who to ask: the program officer <…> — PO GD-1188 │                                 │
│  │ Suggested Qs: revised target? delays?    │                                 │
│  │ Draft email → programs officer email              │                                 │
│  └─────────────────────────────────────────┘                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 2. Ask — phone (<640px) `[spec]`

```
┌───────────────────────────┐
│ ◆ Compass          ⋮      │
│ ● GD ● Drive ● AT ○ Zoom  │
│ ─────────────────────────│
│ QUESTION                  │
│ How did Riverbend Care Collective perform…?  │
│                           │
│ ANSWER                    │
│ Riverbend Care Collective projected 107× /   │
│ +$9,400 [1]. Year 1:      │
│ 2,610 placed — 67% [2].   │
│ PO: revised ramp [3].     │
│                           │
│ ● Well supported          │
│ [ Sources (4) ]  ← sheet  │
│ [ Deep dive ]    ← sheet  │
│ ☐ mark for external use   │
│ ─────────────────────────│
│ [ type a question …  ↑ ]  │  ← sticky
└───────────────────────────┘
   tap [1] → opens source app / in-app browser, passage highlighted
```

## 3. Grantee dossier — desktop `[built]` / phone `[spec]`

```
┌──────────────────────────────────────────────────────────────┐
│ Riverbend Care Collective                         United States · Care economy   │
│ Online platform matching home-care workers with families…     │
│ ┌────────┐┌────────┐┌────────┐┌────────┐                      │
│ │Awarded ││N.Star  ││Stage   ││Reached │   ← stat row         │
│ │$750K   ││107×    ││Active Y1││2,610   │                      │
│ └────────┘└────────┘└────────┘└────────┘                      │
│ DECISION & REPORTING TIMELINE                                 │
│  2024-11  Grant approved            GD-1188                    │
│  2025-07  Year-1 report submitted   GD-1188-R2                 │
│  2025-08  PO check-in: behind/ahead Drive · Care Economy/2025  │
│ ASSEMBLED FROM FOUR SYSTEMS                                    │
│  Primary contact   VP Partnerships          [airtable]        │
│  Co-funder         The Hartwell Fund            [givingdata]      │
│  Reported wage     $19.10/hr at placement   [givingdata]      │
│  ⚠ conflict: projected participants 3,900 (GD) vs 3,600 (memo) │
└──────────────────────────────────────────────────────────────┘
```
Phone: stats become a 2×2 grid; timeline and field list stack.

## 4. Sign-in `[spec]`

```
┌───────────────────────────┐
│        ◆ Compass          │
│                           │
│  Grant knowledge, asked    │
│  one question.            │
│                           │
│  [ Continue with Google ] │   → Google OIDC; only @gitlabfoundation.org
│                           │
│  Not a Foundation account?│
│  Access is granted per    │
│  person — ask the COO's   │
│  office.                  │
└───────────────────────────┘
```

## 5. Admin console `[spec]`

```
┌──────────────────────────────────────────────────────────────┐
│ Admin                              [ ⏻ KILL SWITCH ]          │
│ ── Corpus ───────────────────────────────────────────────────│
│  Sources: Drive (3 shared drives ✎) · GivingData 2022–26 ✎    │
│  Last build: 6a919ad · digest 1f56eb54… · 2026-09-07 05:47    │
│  [ Re-index now ]                                             │
│ ── Gap report (12) ─────────────────────────────────────────│
│  GD-1301  Baseline report — OVERDUE (due 2025-11-01)          │
│  GD-0904  Untagged (no thesis area)                           │
│ ── Sensitivity tiers ──────────────────────────────────────│
│  Board/Compensation/  → restricted    [ change… ] (2 approvers)│
│ ── Entity review queue (3) ────────────────────────────────│
│  "Highland Alliance" ?= "Highland Skills Alliance"  [merge] [keep]   │
│ ── Audit ───────────────────────────────────────────────────│
│  #1 05:48 query d.okafor "how did Riverbend Care Collective…" cited=[team] ✓chain │
│  [ export ]                                                   │
└──────────────────────────────────────────────────────────────┘
```

## 6. States (all screens)

Empty / first-run · loading (retrieving…) · refusal (no support) · refusal (restricted) ·
permission-blocked · LLM-down (extractive fallback badge) · stale-index banner ·
kill-switch active. Copy for each is in `USER_FLOWS.md` → *Error & edge states*.

## 7. Component inventory (for the design system)

Ask box · example-prompt chip · answer card · inline citation `[n]` · source card (system
badge, ref, snippet, "opens in …", tier dot) · coverage line · confidence chip · withheld
banner · verify-for-external toggle · Deep dive panel (gap list, who-to-ask row, draft
email) · dossier stat tile · timeline row · conflict flag · connection-status pill · admin
kill switch · gap-report row · review-queue row · audit row.
