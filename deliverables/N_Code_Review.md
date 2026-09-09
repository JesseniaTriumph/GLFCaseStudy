# Compass — code-weakness review

A pass over the security-critical and correctness-critical paths. This is the internal
review that precedes (does not replace) an independent penetration test.

**Method:** manual review of the permission boundary (in-memory + SQL), the auth/session
layer, the HTTP surface, the pipeline (PII / injection / tier exclusion), the retrieval and
answer logic, and the real connectors. `npm run ci` (eval + eval:pg + eval:full + redteam +
security + server) is green throughout.

---

## Fixed in this pass

| # | File | Weakness | Fix |
|---|---|---|---|
| 1 | `retrieval/answer.ts` | `maybeScheduleAnswer` mangled the docId→grantId extraction (`givingdata:GD-2054` → `GD-`), so the per-grant permission scoping on portfolio-schedule answers was ineffective. **Not a leak** (grant fact sheets are all `team`-tier), but wrong. | Clean prefix strip; scope to grants whose fact-sheet chunk `mayRead` passes. |
| 2 | `db/store.ts` | Restricted-stub relevance loop did `index.chunks.find()` per stub — O(stubs × chunks). | Build a `Map` of stub chunks once. |
| 3 | `server/session.ts` | `revokedBefore` map grew unbounded in a long-running process (memory leak). | Evict entries older than one session lifetime on each `revokeUser`. |
| 4 | `server/app.ts` | `readBody` buffered the whole request with no size limit — memory-exhaustion DoS. | Cap at 64 KB; `req.destroy()` past that. |
| 5 | `server/app.ts` | `/api/ask` question length unbounded (feeds tokenizer + regexes). | `.slice(0, 2000)`. |
| 6 | `server/app.ts` | `/api/feedback` did `b.question.slice()` — throws (→ 500) if the JSON field is a non-string. | Type-guarded string coercion on every field. |
| 7 | `adapters/givingData.ts` | Pagination followed `page.nextPageUrl` from the API response with no host check — an SSRF vector if the source is compromised or misconfigured. | `sameHost()` check against the configured base URL + a 10k-page cap. |

---

## Verified sound — the security-critical paths

- **The permission boundary.** `mayRead` = `allowedTiers.includes(tier) && acl.some(∈ principalIds)`; the SQL form = `WHERE restricted_stub = false AND tier = ANY($1) AND acl && $2`. Both **fail closed**: an empty `allowedTiers` matches no row, an empty `acl` matches no principal, and the two conditions are AND'd. The in-memory and SQL paths feed the *same* ranker and produce the *same* hits — proven by `eval` + `eval:pg` (0 leaks on 24 cases) and `visibility()` (per-persona counts straight from SQL). `eval:full` re-proves it against ~65 grants and ~110 declined-applicant records.
- **Session tokens.** HMAC-SHA256 over the payload; verify does a length check then `timingSafeEqual` (constant-time); `JSON.parse` runs only *after* the MAC passes, in a try/catch. Per-user and global server-side revocation; `/auth/logout` revokes (a replayed pre-logout cookie is rejected — tested).
- **OIDC.** `verifyIdToken` checks `alg` (RS256 only), `kid`, the RSA signature, `iss`, `aud`, `exp`, `iat`, `hd` (hosted domain), and `email_verified`. A failed Google Groups lookup → `groupsResolved = false` → the principal gets **no tiers** and `/api/ask` returns 403.
- **The pipeline.** `Restricted`-tier docs are never indexed (metadata stub only, and PII-raised docs leave no stub); injection payloads are pattern-stripped at intake and a document that still reads as an attack is quarantined; the PII scrub + participant-data heuristic run on *every* document.
- **The audit log.** Hash-chained; `verify()` walks the chain and reports the first broken link; an edited past entry is detected (tested). `webhookSink` streams each record off-host.
- **Adversarial coverage.** `npm run redteam` — 15 planted injection documents in the index + jailbreak, exfiltration, permission-probing, PII-extraction, and legal-privilege-probing cases → 17/17, 0 leaks. "Print your system prompt" is refused.

---

## Noted — production items (need the Foundation's environment or a scale test)

| Area | Note |
|---|---|
| `db/store.ts` `load()` | Per-row `INSERT` in a loop, no transaction. Fine for the demo's ~600 rows; production needs a batched load / `COPY` for a real corpus. |
| `db/store.ts` `retrieve()` | Pulls **all** permitted rows to Node before the JS rerank. At 100k+ permitted chunks this is heavy data movement. Production: an FTS prefilter with `LIMIT` (or pgvector `ORDER BY embedding <-> $q LIMIT n`) before the JS rerank. Today's design is a deliberate tradeoff — an FTS *hard filter* caused false refusals, so we pull-then-rank. |
| Rate limiter + revocation | In-process. Documented. Needs Redis to hold across replicas / restarts. |
| Regex complexity | The injection / PII / conflict regexes are O(n²) worst case on a pathological line. Inputs are bounded (2000-char question; bounded chunks), so acceptable — a hard per-document timeout in the pipeline is the belt-and-braces for production. |
| `secret()` dev fallback | A per-process random key when `COMPASS_SESSION_SECRET` is unset — sessions don't survive a restart. Documented; production sets the env var. |
| Connector credentials | `secrets/` is git-ignored; production is a KMS (`docs/CONTROLS_MATRIX.md`). |

---

## What this review is not

An independent penetration test. That is a Phase 3 exit criterion and needs an outside
firm (`deliverables/G_Security_Review.md` §Completion gate). This pass hardens the baseline
that test starts from.
