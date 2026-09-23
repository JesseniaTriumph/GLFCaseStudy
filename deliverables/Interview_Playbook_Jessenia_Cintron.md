# Compass interview playbook

GitLab Foundation — Fellow, Applied AI  
Jessenia Cintron — September 8, 2026

## The position to hold

You are not pitching a chatbot. You are demonstrating how you would become the Foundation's first product-minded AI builder: discover the decision, respect the existing systems, ship a narrow working slice, prove safety and value, teach the team, and leave reusable capability behind.

The one-line idea:

> Compass turns a staff question into a short evidence brief whose claims link back to records that person already has permission to open.

The governing rule:

> If a program officer cannot open the evidence behind a sentence, Compass should not say it.

## Seven-minute script

### Slide 1 — Opening (0:00–0:30)

“I designed Compass around one rule: if a program officer cannot open the evidence behind a sentence, Compass should not say it. The goal is not a smarter search box. It is a faster path from a consequential question to evidence the team can trace and a decision it can defend.”

### Slide 2 — The problem is not four databases (0:30–1:10)

“These systems do not contain four copies of the same truth. GivingData owns the grant lifecycle. Drive carries narrative evidence. Airtable holds flexible relationship and project context. Zoom captures decisions in motion. A useful product has to preserve those roles before it synthesizes across them. Otherwise, it can produce a fluent answer that is operationally wrong.”

### Slide 3 — Discovery before architecture (1:10–1:55)

“I would start with decisions, not models. Who asks the question? What action follows? Which source wins when fields conflict? What does ‘actual impact’ mean here? What is explicitly out of scope? Those answers determine the data contract, access model, evaluation set, and interface. Model selection comes later.”

### Slide 4 — The product experience (1:55–2:55)

“Here is the experience I would test. Compass gives a direct answer, claim-level citations, visible source coverage, and an evidence gap. That final box matters: the product should reveal what the Foundation does not yet know, not hide it behind confident prose. The records in this prototype are synthetic; the interaction and controls are the design proposal.”

If the room is moving quickly, open the live prototype and click the AI-enabled career-navigation question, then one citation. If time is tight or screen sharing is unstable, stay on the slide.

### Slide 5 — How it works (2:55–4:05)

“The pipeline is deliberately inspectable. First, define a contract for every approved source. Second, preserve raw records and normalize only the shared entities we need. Third, parse documents while keeping context, lineage, and metric definitions. Fourth, filter by the user’s permissions before retrieval. Fifth, generate from that evidence under a strict answer contract. Sixth, evaluate with real staff questions and reviewer-approved answers.”

“Exact counts and amounts come from structured fields. The model explains them; it does not silently do arithmetic over prose.”

### Slide 6 — Access is part of correctness (4:05–4:55)

“Permission filtering happens before any source text enters the model, and access is checked again before a citation is returned. The system also distinguishes projected from observed impact, shows conflicts instead of choosing silently, and abstains when evidence is insufficient. Zero permission leaks is a release gate, not an aspiration.”

### Slide 7 — Failure-aware design (4:55–5:35)

“I treated failure modes as product requirements. A wrong entity merge can combine two grantees. A stale index can expose deleted content. A casual chat note can be mistaken for policy. A retrieved document can even contain hostile instructions. Each has a control and a visible product behavior. Trust comes from how the system fails, not only from how it answers.”

### Slide 8 — A narrow first version (5:35–6:15)

“I would rather prove ten consequential questions with excellent citations and zero permission leaks than index five years of content and create false confidence. V1 is read-only, starts with GivingData and one approved Drive folder, and covers roughly 25 to 40 grants. Broad Zoom ingestion, direct messages, write-back, automated scoring, and autonomous recommendations wait.”

### Slide 9 — Close (6:15–7:00)

“The roadmap moves from discovery to a vertical slice, then hardening, then carefully governed expansion. The pilot should leave more than a useful interface. It should create data contracts, an evaluation set, a permission model, and an operating practice that the Foundation’s future product and engineering function can reuse.”

“That is how I see the fellowship: build something useful now, make its evidence and limits transparent, teach the team to own it, and leave the organization more capable than I found it.”

Stop. Let the panel pull the conversation into the area each person cares about.

## Follow-up answers

### Why retrieval instead of fine-tuning?

“This problem changes when a report is updated or a permission is revoked. Retrieval keeps the answer tied to current, inspectable records. Fine-tuning may help a stable language or classification task later, but it is not the first tool for changing institutional facts.”

### Why not create one source of truth?

“Because the systems have different jobs. I would create a shared evidence layer and a system-of-record matrix, not pretend every conflict can be flattened into one database. Compass can show both values, their dates, and the owner who can resolve them.”

### How would you protect confidential data?

“Approve the corpus explicitly, exclude sensitive categories by default, inherit source permissions, filter before retrieval, recheck before citation, keep raw passages out of routine logs, mirror deletions, and test cross-role queries as a release gate. Zoom direct messages are out unless governance explicitly brings them in.”

### What would you build in the first three weeks?

“I would shadow real decision workflows; inventory fields, IDs, permissions, retention, and agreements; choose five to ten gold questions; define which system owns each field; baseline the current time and quality; and produce a tested connector contract plus a clickable workflow. I would earn the architecture from those facts.”

### How would you evaluate quality?

“Use staff questions with reviewer-approved answers. Score whether the right evidence was retrieved, whether every material claim is supported, whether the citation opens the correct source, whether conflicts and gaps are surfaced, and whether the system abstains appropriately. Then measure time saved and repeat use. A good demo is not the outcome; a changed workflow is.”

### How would you handle estimated versus actual outcomes?

“As typed observations, not interchangeable numbers. Each metric carries status, unit, period, population, method, model version, source, and timestamp. Comparisons happen only when those fields are compatible, and the answer labels the difference plainly.”

### What if GivingData's API does not expose the required reports?

“The connector plan changes, not the product promise. Start with a controlled export and reconciliation process, preserve source IDs and update checkpoints, and validate API coverage against the tenant before investing in a custom connector.”

### Why delay Zoom Team Chat?

“It is the richest source for decisions and the riskiest for context, consent, retention, and authority. Zoom’s cloud history depends on admin configuration, so five-year coverage cannot be assumed. I would begin with named channels only after a retention and governance decision, and treat chat as conversational context rather than policy.”

### What does maintainability mean here?

“Small source adapters behind one data contract, stable internal IDs with source crosswalks, configuration outside code, repeatable ingestion, observable failures, versioned prompts and schemas, automated evaluations, and a runbook another teammate can operate. Every pilot decision should either be reusable or explicitly disposable.”

### How would you drive adoption?

“Build with three to five design users around a real recurring decision. Put Compass where preparation already happens, make corrections easy, publish what it can and cannot answer, hold office hours, and use unanswered questions and citation opens to decide what to improve next.”

### What would make you stop or narrow the pilot?

“Any permission leak, unresolvable data-use concern, inability to verify material claims, or absence of a real decision owner. I would also narrow if the chosen corpus cannot answer the gold questions; expanding more bad data would only hide that signal.”

### Is this an AI agent?

“The first version is a constrained evidence workflow. It may use agent-like steps for retrieval and tool use, but it does not act on grants or alter systems. I would add actions only after the read-only experience is reliable, auditable, and owned.”

### How does this build on the Foundation's current AI work?

“The Foundation has already shown it can use AI to compress a large review task while keeping final decisions with people. Compass extends that operating principle from application screening to institutional memory: AI prepares and connects evidence; staff retain judgment and responsibility.”

## Four questions worth asking the panel

Ask three or four, following the conversation rather than reading a list.

1. “Six months from now, what recurring decision or workflow would make you say this fellowship materially changed how the Foundation works?”
2. “Where is the friction sharpest today: finding evidence, reconciling definitions, carrying context across teams, or turning a learning into a decision?”
3. “What knowledge do you most worry the organization could lose as the team and portfolio grow?”
4. “As you explore a product and engineering function, which capabilities should remain Foundation-specific, and which might eventually become useful to the broader philanthropy sector?”

If a panelist invites a targeted question:

- Ellie: “Where do you see the highest-leverage boundary between AI-supported analysis and human accountability?”
- Elicia: “Who should own this capability after the fellowship, and what would make that handoff successful?”
- Matt: “Which preparation or portfolio-learning question is repeated often enough that you would volunteer it as the first gold question?”
- Tamsin: “Which impact definitions or model assumptions most need versioning before cross-grant comparison is safe?”

## Language that sounds precise without sounding robotic

Use:

- “evidence brief,” not “AI answer”
- “shared evidence layer,” not “single source of truth”
- “evidence coverage,” not an unexplained “confidence score”
- “projected and observed,” not a blended “impact number”
- “the system abstains,” not “the AI tries its best”
- “staff own the decision,” not “human in the loop” unless the panel uses that phrase first
- “prove a vertical slice,” not “boil the ocean”

Avoid claiming that the prototype is integrated, secure, production-ready, or based on private Foundation data. It is a research-backed interaction proposal using synthetic records.

## Demo discipline

- Use the published Compass site as the primary demo. It keeps organizations and evidence fictional while still demonstrating the product behavior.
- Do not present the Claude artifact unchanged. It attributes invented check-in notes and a renewal recommendation to a real panelist, includes a plausible staff email address, and combines fictional performance figures with real grantee names. A mock-data disclaimer may not neutralize that credibility risk.
- The best ideas to retain from the Claude artifact are the explicit permission-denial state, the “what would sharpen this answer” panel, and the clear separation between answer, next questions, and source evidence.
- Open the prototype before the interview and keep Slide 4 as the backup.
- Start from the suggested AI-enabled career-navigation question.
- Point to the direct answer, one citation, source coverage, and the evidence gap.
- Mention the synthetic-data disclosure once; do not apologize for it.
- Spend no more than 60 seconds in the live product during the prepared seven minutes.
- Keep the System and MVP views for follow-up questions.
- If the site fails: “The deck preserves the interaction. The important design decision is that provenance, coverage, and uncertainty are part of the answer.” Continue calmly.

## Final pre-interview checklist

- Rehearse to 6:30–6:45, leaving room for a breath and a transition.
- Confirm the private prototype opens in the browser/account used for the interview.
- Put the deck in presentation mode and silence notifications.
- Keep the strategy brief open for detailed follow-up, not as another presentation.
- Prepare the three requested references: name, role/relationship, email, phone, and a one-line reminder of what each person can credibly speak to.
- Bring one 30-second example from your own work for each of these: building, debugging, stakeholder discovery, teaching/adoption, and changing course after evidence.

## Final mindset

The differentiator is not pretending every unknown has been solved. It is showing that you know which unknowns are consequential, how to resolve them quickly, what to build first, how to test it, and how to explain the choice so the organization can own it.
