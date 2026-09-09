# GitLab Foundation — deep dive: who they are and how they think

**Research compiled for the Applied AI Fellow case study. Sources at the end.**
**Purpose: design Compass the way the Foundation would design it, and speak to the panel in their own frame.**

---

## The one-paragraph version

The GitLab Foundation (launched 2022, seeded by GitLab Inc. equity) exists to **raise
lifetime earnings for low-income people**, and it runs itself like a rigorous, transparent,
fast-moving product org rather than a traditional grantmaker. Its "North Star" is
**$100+ of additional lifetime earnings for every $1 deployed** — and it publishes its
progress against that on live Tableau dashboards. It is deliberately **handbook-first and
radically transparent** (the whole operating model is a public Notion handbook), runs on
GitLab's **CREDIT values** (Collaboration, Results, Efficiency, Diversity & inclusion,
Iteration, Transparency), is **AI-forward but responsibility-minded**, and is evolving from
"a foundation that makes grants" into **"a platform for high-impact philanthropy"** —
grantmaking + collaborative capital vehicles + advisory services for other funders +
**knowledge and intelligence products**. Compass sits squarely in that last category.

---

## What they do

- **Mission:** improve lifetime earnings through access to opportunity. "Maximize lifetime
  earnings gains for every dollar deployed."
- **Where:** United States, **Colombia, and Kenya**.
- **Scale (FY26):** 80+ grants, **$20.4M committed**, **$18.2M co-funding mobilized**;
  ~$14M in grants in 2025 across ~62 awards. Estimated **$8B in projected lifetime
  earnings gains for 775,000+ people** to date; realized ratio ~**$193 per $1** — ahead
  of the 100x target.
- **FY26 results detail:** of 40 grants reporting results, **>75% exceeded their 100x ROI
  threshold**; on average those grants raised annual earnings **+$11,887/person** and
  lifetime earnings **+$125,582/person**. Grantee ROI examples: Carina ~107x, Recidiviz
  ~439x, AkiraChix codeHive (alumni earning up to 6x regional average).
- **Funds / vehicles:**
  - **AI for Economic Opportunity Fund** — with **OpenAI** (technical partner: engineer
    time + API credits), **Annie E. Casey Foundation** and **Ballmer Group** (co-funders).
    $250k grants to early-stage AI-for-mobility projects. 800+ applications for the latest
    cohort of 16. $10M+ across 50+ orgs since 2023. Grantees: Ask Aya (NDWA), PaidLeave.AI
    (Moms First), Community Economic Defense Project, and others.
  - **Powering Economic Opportunity Fund** — ~$4M to 10 projects (Chicago Scholars'
    "REACHing for Green," SOAR nuclear-maintenance upskilling in Appalachia, etc.).
  - **Learning for Action** and an **Impact Measurement & Client Feedback Fund** (up to
    **$50k to grantees** to strengthen their own measurement).
  - **Advisory / Impact Advisory Services** — they help other donors and foundations
    maximize impact.
- **How they grant:** thesis-driven, concentrated "areas of inquiry" to maximize learning
  cycles; **invite-only** plus a few **topical open RFPs** each year; every prospective
  grantee runs through an **impact-scorecard rubric**.

---

## How they think about impact measurement (this is the brand — and the risk surface for Compass)

- **A cost-benefit model since early 2023**, built to find solutions that
  *cost-effectively* raise lifetime earnings. Program officers + the impact team work with
  each prospective grantee to quantify the projected income effect *before* funding.
- **Five dimensions** (from the Impact Management Project framework): **what** outcome,
  **who** is affected, **how much** change, the Foundation's **contribution** to that
  change, and the **risk** the project misses. The North Star ratio addresses "how much"
  and "contribution"; it is *"a valuable tool in our due diligence process"* but works
  *"most effectively alongside"* the other dimensions — they explicitly resist reducing
  everything to one number.
- **Relative income change, not absolute.** They switched from absolute-dollar income
  gains to percentage-based, because absolute dollars created *"an unintentional bias
  against lower-income countries"* once they expanded to Kenya and Colombia.
- **They publicly admit the data is hard.** Nonprofits *"often struggle to understand
  their own impact"*; long-term follow-up on participant earnings is the weak point; hence
  the $50k grantee measurement fund.
- **"Data should do more than sit in a report"** — it must *"inform decision-making,
  foster partnerships and drive impact."* They frame data as *"a unifying tool for
  funders, grantees and the public."*
- Two public **Tableau** dashboards: an **Estimated Impact** dashboard and a **Results**
  dashboard.

**Implications for Compass:**
1. A fabricated or mis-vintaged impact number is the single worst failure — it attacks
   the Foundation's core credibility. Citations, "as reported on {date} / model {version}",
   and refusal-when-unsupported are non-negotiable.
2. Answers must handle **multi-country, multi-currency, relative-vs-absolute** framing and
   not flatten them.
3. The **five-dimensions** vocabulary and the **scorecard rubric** are how they reason —
   Compass should surface those fields, and the "grantee dossier" should be organized the
   way they actually assess grants.
4. Compass's **gap report and honesty about missing data** matches their own stance —
   they will trust a tool that admits holes more than one that papers over them.
5. Cross-portfolio **synthesis** ("what have grantees told us about X") is central to a
   thesis-driven funder — not a nice-to-have.

---

## Straight from the Handbook (their own words)

The public Notion Handbook — launched September 2022, modeled on GitLab Inc.'s, explicitly **"a single source of truth"** — is the clearest window into how they think.

**The CREDIT values, as the team themselves defined them in working sessions:**
- **"Rigorous but reasonable"** is their signature phrase — *"trusting grantees while verifying data, exploring nuance, and adapting our methods to fit real-world constraints."* It recurs everywhere.
- **Results** explicitly names the anti-pattern: ***"'Juicing' our models to justify favored work, hiding negative outcomes, or making excuses when we fall short."*** Also: *"Expecting grantees to have all the answers from the start"* and *"over-engineering measurement — requiring RCT-level evidence when it's not feasible"* are things Results does **not** mean.
- **Collaboration:** ***"we're not competing to save the world"*** — they deliberately **do not guard** their models, pipeline, or tools; *"developing public goods that benefit the broader ecosystem."* An explicit anti-behavior: ***"Hoarding knowledge — failing to share learnings, resources, or tools."***
- **Efficiency:** *"Embracing imperfect progress — prioritizing action over perfection, and being comfortable with **MVPs and iterative improvements**"* … *"automating where possible"* … *"using the Handbook as our single source of truth."* *"Don't let perfect be the enemy of the good"* appears more than once.
- Feedback norm: **"No ego, amigo"** / not having **"long toes."**
- Board chair **Sid Sijbrandij**: *"Success isn't measured in input such as hours … it's about output."*

**How the org is wired (from the Handbook TOC):**
- **DRI (Directly Responsible Individual)** model + **Approval Matrices** under Governance — decisions have one owner; that is who signs off on Compass's data-access model.
- Named internal systems and artifacts Compass should treat as sources or dependencies: **"Learnings and Insights Tracking,"** **"Our Published Grantee ROI Models,"** the **North Star Impact Modeling** workbook, **"Progress and Outcomes Reporting,"** **"Principles for Grant Renewal and Continuation,"** and **"Internal Grants Management Operations."**
- Tools named in the Handbook: **ClickUp** (project/task management — a real fifth system), **GivingData**, **DocuSign**, **Calendly**, shared Google calendars and docs. They *"record meetings when some cannot participate"* and *"document calls and meetings"* — so meeting recordings/notes are a culturally-mandated source.
- The Handbook itself **has a restricted tier**: *"Some content is restricted to GitLab Foundation team members"* — Talent, Compensation, Performance Management, Legal & Compliance, Governance are logged-in-only. This is the same tiering model Compass uses.
- Structure: 3-Year Strategic Plan, quarterly **OKRs**, thesis-driven portfolio approach, three geographies (🇺🇸 🇨🇴 🇰🇪), a **President & CEO Shadow Program** (the observer in the final interview).

**What this locks in for Compass:**
1. **"No juicing" is a design requirement, not just a nice-to-have.** The tool must make it *hard* to cherry-pick a favorable number and *easy* to see negative outcomes — citations, vintage-stamping, refusal, and surfacing conflicting values all serve this.
2. **Compass is a CREDIT artifact.** It is a shared tool / public-good-shaped knowledge product, it fights knowledge-hoarding, and it's an MVP-first build. Say this explicitly — it's them.
3. **Add ClickUp** to the source inventory (project tasks, owners, status) and treat the Handbook, the Learnings tracker, and the published ROI models as first-class content.
4. **The DRI / Approval Matrix is the "data owner"** the strategy doc keeps referring to — name it that way with them.
5. **"Rigorous but reasonable"** is the tone to strike in the interview: rigor on citations, permissions, and evals; reasonableness on scope, "we don't have that," and not over-engineering.

## How they operate (culture — read the JD through this)

- **Handbook-first, radically transparent.** The operating model, grantmaking strategy,
  and decision matrices are a public Notion handbook; they *"do not gatekeep
  organizational knowledge."* Transparency is the CREDIT value that most shapes external
  posture.
- **All-remote, fast, writing-first.** "High-performing... moves quickly, values
  curiosity, deeply results-oriented." "Strong bias for action." "We hold ourselves to
  high standards, operate with transparency and ownership, and **take initiative without
  waiting for perfect clarity**." "Priorities evolve, ambiguity is the norm, and we
  embrace it — **iterating and improving as we go**."
- **Small:** ~21 staff. No visible dedicated IT/engineering function — which is exactly why
  the JD talks about *"exploring the creation of a small, focused product and engineering
  function"* and a path to being a **founding member**.
- **Efficiency is a value and a mandate** — every dollar is measured against lifetime
  earnings. A tool that is expensive to run or hard to maintain is off-thesis.

**Implications for Compass:**
- The **step-based, ship-a-thin-slice-early** plan matches "bias for action" and
  "iteration." Don't present a 6-month waterfall.
- Build for **handoff from day one** (managed services, modular connectors, runbook) —
  it's a 6-month fellowship into a team with no engineers.
- Compass should be **documented in the handbook style** — transparent about how it works,
  its limits, its evals. That's culturally expected.
- Frame Compass's own **ROI** (time saved, decisions improved) — they will.

---

## Where they're heading (say this to show you see the bigger picture)

- Recognized by the **Chronicle of Philanthropy (2026)** as an example of a philanthropy
  integrating AI into its work — they call that *"a starting point."*
- Building toward a **product & engineering function** serving both the Foundation and
  *"the broader economic mobility and philanthropic sector."*
- The four pillars they name: **high-impact grantmaking · collaborative capital vehicles ·
  advisory services · knowledge and intelligence products.**

**Compass is a knowledge-and-intelligence product.** Built well and documented
transparently, its architecture (multi-source, permission-aware, cited retrieval over
philanthropic data) is exactly the kind of thing the advisory-services side could later
offer other funders. Worth naming in the interview as the "where this goes" answer.

---

## The panel — how each person will read the case study

| Person | Role | What they're listening for | How to speak to them |
|---|---|---|---|
| **Elicia Wilson** | COO (hiring manager; role reports to her) | Feasibility, governance, cost, risk, adoption, handoff. Will this actually get built and used, and not create a liability? | Lead with the phased plan, the security/compliance pillar, the "3–5 design partners first," and the handoff design. Be concrete about what you'd do in week one. |
| **Ellie Bertani** | President & CEO; ex-Walmart / Wells Fargo workforce **product** leader; former frontline service worker | Product judgment, rigor, and whether this moves the mission for workers. Pattern-matches on real product thinking. | Show the reframe ("retrieval + permissioning + citation, not a chatbot"), the tradeoffs you deliberately cut, and how the tool changes a real decision (renewal, thesis). Tie it back to lifetime earnings. |
| **Matt Zieger** | Chief Programs & Partnerships Officer — **the primary end user**, named in the JD | Does this make my team's work faster and does it ever embarrass us in front of a grantee or co-funder? Is it trustworthy? | The grantee-dossier view, citations on every claim, "verify before external use," and "I don't know" as a feature. He is the design partner — say so. |
| **Tamsin Chen** | Director of Impact | Will it misreport an impact number? Does it respect model versions, the five dimensions, relative-income methodology? | Vintage-stamping, refusal-when-unsupported, the impact team as a partner (not a stakeholder), and Compass citing the authoritative impact source rather than a stale memo copy. |
| **CEO Shadow participant** | Observer | (passive — no questions expected) | — |

**Kamille Oliveira** ran screening (Operations Coordinator). Other names to know: Tracy
Cude (CFO) and Tom Clevenger (Controller) own the financial-data line; **Jessica Van
Grouw (Grants Manager)** almost certainly owns GivingData; Geetika Malhotra / Henner
Andrés Solarte / Noor Sethi / Pragya Dewan are the impact-modeling team; Henner likely
covers Colombia (Spanish-language reporting).

---

## Sources

- [GitLab Foundation — home](https://www.gitlabfoundation.org/) · [Team](https://www.gitlabfoundation.org/team) · [Powering Economic Opportunity](https://www.gitlabfoundation.org/powering-economic-opportunity) · [AI for Economic Opportunity](https://www.gitlabfoundation.org/futureofwork)
- [Measuring What Matters Pt. I — How We Evaluate Impact](https://www.gitlabfoundation.org/our-journey/measuring-what-matters-how-we-evaluate-impact)
- [Measuring What Matters Pt. II — Impact Insights](https://www.gitlabfoundation.org/our-journey/measuring-what-matters-impact-insights)
- [Measuring What Matters — Our Approach to Using Data](https://www.gitlabfoundation.org/our-journey/measuring-what-matters-our-approach-to-using-data)
- [Transparency in Action — Understanding GitLab Foundation's Handbook](https://www.gitlabfoundation.org/our-journey/transparency-in-action-understanding-gitlab-foundations-handbook)
- [GitLab Foundation Handbook (Notion)](https://gitlabfoundation.notion.site) · [Grantmaking section](https://gitlabfoundation.notion.site/Grantmaking-12fba08bd3e0413b8a5dda79cdc31d48)
- [$8 Billion in Lifetime Earnings Gains Across 775,000 People (May 2026)](https://www.gitlabfoundation.org/our-journey/gitlab-foundation-reports-8-billion-in-lifetime-earnings-gains-across-775000-people-worldwide)
- [Largest AI for Economic Opportunity Cohort Yet — 16 orgs (PR Newswire)](https://www.prnewswire.com/news-releases/gitlab-foundation-announces-largest-ai-for-economic-opportunity-cohort-yet-backing-16-organizations-using-ai-to-improve-support-systems-for-workers-302705426.html)
- [Inaugural Ten Powering Economic Opportunity Fund Grantees](https://www.gitlabfoundation.org/our-journey/gitlab-foundation-announces-powering-economic-opportunity-fund-grantees)
- [GitLab CREDIT values (GitLab Handbook)](https://handbook.gitlab.com/handbook/values/)
- [GivingData — grant lifecycle / grantee portal](https://www.givingdata.com/insights/a-grant-cycle-management-software-streamlining-the-grant-lifecycle)
