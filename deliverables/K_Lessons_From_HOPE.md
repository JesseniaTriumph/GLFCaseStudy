# What the HOPE grant dashboard taught me, applied to Compass

**Companion to the strategy doc · Jessenia Cintron**

Before this, I built a **grant performance dashboard for The HOPE Program** (a Brooklyn
workforce nonprofit) through the Pursuit builder program — a real product, on real grant
and participant data, integrated with their Salesforce org through a third-party dev shop
(Idlewild). It is the closest precedent I have to what Compass is: **multiple grants,
messy source data, a vendor-controlled system of record, funders who need the numbers to
be right, and a hard line about who can see what.**

Everything below is a specific thing that went wrong or surprised me on HOPE, what it means
for Compass, and whether Compass already handles it.

---

## 1. The first credential grant is always incomplete

**HOPE.** Idlewild provisioned read-only Salesforce access to *only the fields I'd named
in the original request*. Adding a field later meant a written justification and a wait.
Several fields I needed (`Type__c` for placement type, the 30/180/270-day retention dates,
the real SNAP-eligibility field) simply weren't in scope, so parts of the dashboard ran on
**proxy fields** — `WEP_Assignment_or_Back_to_Work_Program__c` standing in for SNAP status.

**For Compass.** The GivingData connection will land the same way — some custom fields
in, some not, and "which field holds the projected North Star ratio" unresolved until
someone confirms it.

**Status — applied.** The connectors read field names from configuration
(`GIVINGDATA_FIELD_MAP`), so a correction after discovery is a config change, not a
rebuild. When a live connector can't initialise, it logs why and falls back to that
system's mock rather than failing the whole build.

**Status — queued.** Carry an "unverified mapping" flag from discovery into the answer, so
a number built on a proxy field shows that, the way HOPE put a "⚠ SNAP data unverified"
badge on the affected grant card.

---

## 2. A vendor field rename breaks everything, silently

**HOPE.** Edge case I logged as critical: if Idlewild renamed a Salesforce field, the
query would return nulls, participant counts would drop to zero, and every affected grant
would flip red — with no error. The fix was to treat the field list as a **written
contract** with the vendor and require notice before any rename.

**For Compass.** Same risk with GivingData or Airtable schema changes.

**Status — designed.** The connectors validate the shape of what comes back and the gap
report surfaces a source that suddenly returns far less than last time. The "field list is
a contract" agreement goes in the discovery output (the field register).

---

## 3. Proposals are not grants

**HOPE.** The single biggest data-quality problem. The database didn't distinguish grant
*proposals* from *awarded grants* — so declined applications (EPA Community Change Grant,
Lowe's) showed as active, and targets came from proposals, not signed contracts
(JobsFirstNYC's "100 placements" was network-wide, not HOPE's share). Five grants needed
manual reclassification before the dashboard told the truth.

**For Compass.** A question like "what did we commit to Riverbend" must never answer from a
proposal projection as if it were a contracted number, and "did we fund X" must not count a
declined applicant.

**Status — applied.** Grant status is a first-class field on every record. Declined-applicant
material is `programs-only` and a wrong-persona query is proven not to leak it
(`eval` case `declined-applicant-wrong-persona`). The extractive brief always cites the
record it came from, so a projection is visibly a projection.

---

## 4. Read-only, always — corrections happen at the source

**HOPE.** The vendor didn't allow writes to Salesforce. That turned out to be *right*: the
dashboard's job is to reflect the system of record, not become a second one. Where the
dashboard spotted a data-quality problem, it showed an **"Open in Salesforce" link** so
staff could fix it at the source.

**For Compass.** Identical stance — Compass reads, never writes, and every citation is a
deep link back to the exact record.

**Status — applied.** Citations deep-link to the source; the design doc states Compass is
read-only against all four systems.

---

## 5. Excluded records are invisible unless you count them

**HOPE.** Salesforce had 7,511 contacts; the query filtered to those with an enrollment
date. Participants without one were simply absent from every number, and nobody would know.
The fix was to **show the count of what was excluded** as a data-quality alert.

**For Compass.** If the Drive connector skips 400 files it couldn't extract text from, or
GivingData has 30 untagged grants, the user needs to see that number.

**Status — applied and extend.** The gap report already lists missing reports and untagged
grants. Queued: also count documents dropped by an extraction/type filter and name that in
the coverage line.

---

## 6. Guard every derived number

**HOPE.** The pace engine had four separate divide-by-zero bugs — a deliverable with a
target of 0, a contract whose start and end were the same day, a contract 0% elapsed. Each
produced `Infinity`/`NaN` and a wrongly-red grant.

**For Compass.** Compass computes its own derived numbers — extraction confidence,
near-duplicate similarity, retrieval scores, the PII score.

**Status — applied, and it feeds the code review.** The retrieval math already guards its
denominators (`dl = c.tokens.length || 1`, `df[t] ?? 0.5`). The full code-weakness pass
that's next on the list checks every remaining division and ratio against the HOPE list.

---

## 7. A logged-out user isn't logged out for 8 hours

**HOPE.** Critical edge case: an admin deactivates someone at 9 AM, but their session
cookie stays valid until the JWT expires — up to 8 hours. Real fix options: a server-side
revocation list checked per request, a shorter TTL, or rotating the signing secret to log
everyone out.

**For Compass.** Compass has the same design — an 8-hour HMAC session cookie.

**Status — fixed this session.** `src/server/session.ts` now has a revocation check on
every request: `revokeUser(sub)` invalidates every session for that person issued at or
before the call, and `revokeAll()` is the incident lever. `/auth/logout` revokes
server-side (a copied cookie stops working too), and `POST /admin/revoke` lets an admin
deactivate someone immediately. `npm run server:check` proves a replayed pre-logout cookie
returns 401 (9/9). Production swaps the in-process map for Redis with a session-lifetime TTL.

---

## 8. An in-memory rate limiter resets on cold start

**HOPE.** I flagged this as critical: the in-process login rate limiter reset every time
the serverless function cold-started, so an attacker could get unlimited attempts by
spacing them out. HOPE's fix was Upstash Redis before go-live.

**For Compass.** Compass's new `RateLimiter` is in-process — exactly the same limitation.

**Status — applied honestly.** The code and the docs both say the production version swaps
the in-process store for Redis so it holds across replicas and restarts. HOPE's experience
confirms this is a go-live blocker, not a nice-to-have — it's on the blocked list in the
security review.

---

## 9. Auth must fail closed

**HOPE.** If the Supabase service key was a placeholder, the auth code's `catch` block
defaulted the user to a role that could read the dashboard. New Google users auto-got an
`executive` role. Both are silent over-grants.

**For Compass.** The equivalent risk is the Google Groups lookup failing and a user
getting a hollow session.

**Status — fixed this session.** Compass now carries a `groupsResolved` flag from the
OAuth callback. If the group lookup throws, the principal gets **no tiers at all** and
`/api/ask` returns *"your account isn't mapped to a Compass access group yet."* A
successful lookup that returns no groups still gets team tier — that's the intended
behavior; only a *failed* lookup fails closed. `npm run security` covers both cases (9/9).

---

## 10. Cache-first, with a visible staleness warning

**HOPE.** The dashboard synced Salesforce into a local Postgres cache every 15 minutes and,
when Salesforce was unreachable, served the cached data with a *"⚠ Using data from [last
sync]"* banner, plus a `data_stale` alert after 48 hours.

**For Compass.** The index *is* the cache. When a nightly connector sync fails, Compass
should keep answering from the last good index and say so.

**Status — designed, queued.** The build manifest timestamps every index. Queued: a
per-source last-sync time and a "this source is N days stale" line in the coverage
statement.

---

## 11. Reporting basis: calendar vs. grant-year vs. fiscal-year

**HOPE.** Deliverables carried a `report_period_basis` — `calendar`, `grant_year`,
`fiscal_year`, or `custom` — because "this quarter's numbers" means different things to
different funders.

**For Compass.** This is exactly the role-and-cycle-context feature. "How are we doing
this season" depends on whether you mean the Foundation's fiscal year (Feb 1 – Jan 31), a
grant's own year, or a calendar quarter.

**Status — applied.** The calendar model in `src/roles.ts` uses the Feb–Jan fiscal year;
the role-context feature interprets an ambiguous "this quarter" and always discloses the
reading it applied.

---

## 12. Grant type changes which questions make sense

**HOPE.** The dashboard distinguished `government_performance` (billed on outcomes —
clawback risk), `government_cost_reimb`, `private_foundation`, and `corporate`, and *skipped*
red/yellow/green pace entirely for general-operating grants because they have no
participant deliverable targets.

**For Compass.** "How did they do against projection" is a meaningful question for a
milestone-based grant and a nonsense one for a general-operating grant. The role/cycle
logic should know the grant type before it suggests follow-up questions.

**Status — queued.** Add grant type to the GivingData field map and let the question
library key off it.

---

## The short version

> "This isn't my first grant system. I built one for a Brooklyn workforce nonprofit on
> their real Salesforce data, through a vendor who gave me exactly the fields I asked for
> and nothing else. The things that bit me there — proposals treated as awards, a proxy
> field quietly standing in for the real one, an auth path that failed *open*, a rate
> limiter that forgot everything on restart — are all things Compass either already handles
> or has on an explicit blocked list. The lesson I care about most: **the tool has to say
> what it can't see.** On HOPE, the version staff trusted was the one that showed its own
> gaps."

---

## Where the HOPE docs live

`~/Desktop/GitHub/Hope Program/hope-dashboard/docs/` — `EDGE_CASES.md`,
`KNOWN_ISSUES_AND_RESOLUTIONS.md`, `SALESFORCE_INTEGRATION_SPEC.md`,
`GRANT_SF_FIELD_MAPPING.md`, `GRANT_TRACKING_LOGIC.md`, `DATA_DICTIONARY.md`. The
portfolio-safe demo version is `~/Desktop/GitHub/dash/`.
