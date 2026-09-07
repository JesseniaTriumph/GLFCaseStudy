# Compass — operator runbook

For the named internal owner (roadmap 4.6). Everything here is a command that exists in
this repo. All checks must be green before anything reaches users.

---

## Daily / on a schedule

| Task | Command | Green =  |
|---|---|---|
| Rebuild the index from the connectors | `npm run build:index` | connector modes printed; gap report + review queue printed; manifest digest written |
| Promotion gate (run before making a new index live) | `npm run ci` | "All gates green — this build is promotable" |
| Check the audit log | `npm run audit` | "chain intact" |
| Usage / cost / trust snapshot | `npm run stats` | reasonable volume; refusal rate stable; no unexplained restricted-probe spike |

**Promote only a build that passed `npm run ci`.** The gate runs typecheck → build → eval
→ eval:pg → security → server:check → redteam and stops on the first failure. A
permission-leak finding or a red-team regression is a hard stop.

---

## When a connector is added or a credential changes

1. Put the credential in `.env` (see `docs/CONNECTORS.md` and `.env.example`).
2. `npm run build:index` — confirm the connector prints `LIVE (...)` and a sane pulled count.
3. `npm run ci` — the gold set and red-team must still pass on the new data. If the gold
   set was built on mock data, rebuild it with the Programs team first (roadmap 1.7).
4. Update the coverage statement (`src/config.ts` → `CORPUS.notCovered`) so the tool still
   tells users what it can't see.

---

## When someone leaves or an account must be cut off

- Immediate: `POST /admin/revoke {"sub": "<google-sub>"}` — every session for that user
  stops working within the request, not in 8 hours.
- Whole-incident: `POST /admin/revoke {"all": true}` — logs everyone out.
- The signing secret can also be rotated (`COMPASS_SESSION_SECRET`) as the blunt lever.

---

## When something is wrong with an answer

- A user down-votes via the app (`POST /api/feedback`). It lands in `eval/feedback.jsonl`.
- Weekly: `npm run tune` reads the feedback + the gold-set health and proposes a change.
- The proposal becomes a PR. `npm run ci` proves no regression. Merge on review.
- Never hand-tune retrieval weights straight to production — always through the gate.

---

## When the index looks poisoned or a wrong-tier document got in

1. **Contain:** `POST /admin/killswitch {"on": true}` — `/api/ask` returns 503 for everyone.
2. **Identify:** find the offending source in `dist/raw/_manifest.json` (the immutable raw
   store) and in the entity review queue / gap report.
3. **Eradicate:** fix the tier (or add the source to `never-ingest`), delete the raw
   record, `npm run build:index`.
4. **Recover:** `npm run ci`; if green, promote; `POST /admin/killswitch {"on": false}`.
5. **Learn:** add the offending document to `eval/redteam.json` as a negative case so a
   regression can't reintroduce it.

Full playbooks: `docs/INCIDENT_RESPONSE.md`.

---

## Monthly

- `npm run eval:embed` and `COMPASS_EMBED=bge-small npm run eval:pg` — confirm the learned
  embedding path still passes if you use it.
- Review `npm run stats` with leadership (roadmap 4.3).
- Re-run the red-team with any new adversarial phrasings users reported.
- Confirm the off-host audit stream (`COMPASS_AUDIT_WEBHOOK`) is receiving records.
