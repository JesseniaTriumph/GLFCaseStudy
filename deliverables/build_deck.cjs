/* Compass — case-study deck for the GitLab Foundation final round.
 * Brand: GitLab Foundation (orange-red #DF4329, warm near-black, Inter/Poppins -> Arial for QA safety). */
const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
p.author = "Jessenia Cintron";
p.title = "Compass — GitLab Foundation case study";

const C = {
  accent: "DF4329",
  accentDeep: "A83218",
  amber: "E8A33D",
  ink: "1E1712",
  body: "3D352F",
  muted: "7A716A",
  white: "FFFFFF",
  peach: "FBEEE9",
  peachLine: "F0D9CF",
  paper: "FCFAF8",
};
const F = "Arial";
const EW = 13.333, EH = 7.5, M = 0.9;

// ---- helpers ----
function leaf(slide, x, y, s, col) {
  // simple faceted maple mark: three triangles + stem
  const c = col || C.accent;
  slide.addShape("triangle", { x, y, w: s, h: s * 0.9, fill: { color: c }, line: { type: "none" } });
  slide.addShape("triangle", { x: x - s * 0.55, y: y + s * 0.28, w: s * 0.8, h: s * 0.72, fill: { color: c }, line: { type: "none" }, rotate: 300 });
  slide.addShape("triangle", { x: x + s * 0.75, y: y + s * 0.28, w: s * 0.8, h: s * 0.72, fill: { color: c }, line: { type: "none" }, rotate: 60 });
  slide.addShape("rect", { x: x + s * 0.42, y: y + s * 0.8, w: s * 0.16, h: s * 0.55, fill: { color: c }, line: { type: "none" } });
}
function kicker(slide, text, x, y, col) {
  slide.addText(text.toUpperCase(), {
    x, y, w: 6, h: 0.3, isTextBox: true, margin: 0,
    fontFace: F, fontSize: 11, bold: true, color: col || C.accent, charSpacing: 3,
  });
}
function pageNum(slide, n) {
  slide.addText(String(n), { x: EW - 0.7, y: EH - 0.55, w: 0.4, h: 0.3, isTextBox: true, margin: 0, fontFace: F, fontSize: 9, color: C.muted, align: "right" });
}
function badge(slide, x, y, n) {
  slide.addShape("ellipse", { x, y, w: 0.42, h: 0.42, fill: { color: C.accent }, line: { type: "none" } });
  slide.addText(String(n), { x, y: y - 0.01, w: 0.42, h: 0.44, isTextBox: true, margin: 0, align: "center", valign: "middle", fontFace: F, fontSize: 14, bold: true, color: C.white });
}

// ============================================================ 1 · TITLE
{
  const s = p.addSlide();
  s.background = { color: C.accentDeep };
  leaf(s, 1.0, 1.0, 0.62, C.white);
  s.addText("Compass", { x: M, y: 2.35, w: 9.5, h: 1.3, isTextBox: true, margin: 0, fontFace: F, fontSize: 66, bold: true, color: C.white });
  s.addText("A permission-aware way to ask years of grant knowledge one question.", {
    x: M, y: 3.7, w: 9.6, h: 0.9, isTextBox: true, margin: 0, fontFace: F, fontSize: 20, color: "F4D9CF",
  });
  s.addText([
    { text: "Applied AI Fellow · Skills demonstration", options: { color: "F0C7B8" } },
    { text: "\nJessenia Cintron", options: { color: C.white, bold: true } },
  ], { x: M, y: 5.55, w: 9, h: 1, isTextBox: true, margin: 0, fontFace: F, fontSize: 14, lineSpacingMultiple: 1.35 });
  s.addText("“The North Star tells the team where to go. Compass helps them navigate the five years of\nreports, notes and decisions that show how far along the way they already are.”", {
    x: M, y: EH - 1.15, w: 11.5, h: 0.8, isTextBox: true, margin: 0, fontFace: F, fontSize: 11, italic: true, color: "E7B6A6",
  });
  s.addNotes("Compass. A permission-aware way to ask years of grant knowledge one question. I'll give you the problem as I see it, what I'd need to learn before building, the system end to end, the risks, what I'd cut from v1, and how I'd run it. About seven minutes, then questions.");
}

// ============================================================ 2 · THE PROBLEM
{
  const s = p.addSlide();
  s.background = { color: C.white };
  kicker(s, "The problem", M, 0.7);
  s.addText("Five years of grant knowledge. Four systems. No single source of truth.", {
    x: M, y: 1.05, w: 11.4, h: 1.5, isTextBox: true, margin: 0, fontFace: F, fontSize: 30, bold: true, color: C.ink, lineSpacingMultiple: 1.05,
  });
  const sys = [
    ["Google Drive", "Proposals, reports, diligence memos, board decks, impact models"],
    ["GivingData", "Grant records, projected vs. reported outcomes, requirements, review scores"],
    ["Airtable", "Organizations, contacts, pipeline, the interaction log"],
    ["Zoom Chat", "Decisions and context made in a channel and never written up"],
  ];
  const cw = (EW - 2 * M - 3 * 0.3) / 4;
  sys.forEach((row, i) => {
    const x = M + i * (cw + 0.3);
    s.addShape("roundRect", { x, y: 2.9, w: cw, h: 3.0, rectRadius: 0.08, fill: { color: C.peach }, line: { color: C.peachLine, width: 1 } });
    s.addText(row[0], { x: x + 0.22, y: 3.12, w: cw - 0.44, h: 0.4, isTextBox: true, margin: 0, fontFace: F, fontSize: 15, bold: true, color: C.accentDeep });
    s.addText(row[1], { x: x + 0.22, y: 3.6, w: cw - 0.44, h: 2.1, isTextBox: true, margin: 0, fontFace: F, fontSize: 11.5, color: C.body, lineSpacingMultiple: 1.25 });
  });
  s.addText("Today the answer lives in someone's memory, a folder of PDFs, or a year-old thread. A thesis-driven funder runs portfolio-wide questions constantly — and re-derives the answer each time.", {
    x: M, y: 6.15, w: 11.5, h: 0.9, isTextBox: true, margin: 0, fontFace: F, fontSize: 12.5, color: C.muted, lineSpacingMultiple: 1.3,
  });
  pageNum(s, 2);
  s.addNotes("Programs asked for one way to ask questions of five years of grant reports and internal notes. That material is spread across these four systems and there's no single source of truth. Today people ask the longest-tenured colleague or dig through Drive. For a thesis-driven funder that runs portfolio-wide questions all the time, that's a real tax.");
}

// ============================================================ 3 · THE REFRAME
{
  const s = p.addSlide();
  s.background = { color: C.ink };
  kicker(s, "The reframe", M, 0.8, C.amber);
  s.addText([
    { text: "This is a ", options: { color: "D9D0C8" } },
    { text: "retrieval, permissioning and citation", options: { color: C.white, bold: true } },
    { text: " problem —\nnot a chatbot problem.", options: { color: "D9D0C8" } },
  ], { x: M, y: 1.3, w: 11.5, h: 1.9, isTextBox: true, margin: 0, fontFace: F, fontSize: 30, bold: true, lineSpacingMultiple: 1.1 });
  const pts = [
    ["The hard parts", "Connecting four messy sources, cleaning and de-duplicating so nothing is missed or double-counted, resolving everything to the same grants and orgs, and enforcing who may see what."],
    ["The model is last", "Generation is the smallest, lowest-risk component. It sits on top of retrieval — it is not the product."],
    ["The bar is set by the brand", "Their Handbook names the anti-pattern: “juicing our models … hiding negative outcomes.” Compass must make cherry-picking a number hard and negative results easy to see — via citations, date/model stamps and refusal."],
  ];
  let y = 3.5;
  pts.forEach((row) => {
    s.addShape("rect", { x: M, y: y + 0.06, w: 0.14, h: 0.14, fill: { color: C.accent }, line: { type: "none" } });
    s.addText(row[0], { x: M + 0.35, y, w: 3.4, h: 0.9, isTextBox: true, margin: 0, fontFace: F, fontSize: 14, bold: true, color: C.amber });
    s.addText(row[1], { x: M + 3.9, y: y - 0.02, w: 7.6, h: 1.1, isTextBox: true, margin: 0, fontFace: F, fontSize: 12, color: "CFC6BD", lineSpacingMultiple: 1.28 });
    y += 1.25;
  });
  pageNum(s, 3);
  s.addNotes("The reframe I'd bring: this is a retrieval, permissioning and citation problem, not a chatbot problem. The value is in connecting and cleaning four sources, joining them to the same grants, and enforcing permissions. The language model is the last and least risky piece. And the bar is set by their brand — measurement rigor — so it can never invent a number or surface a candid note to the wrong person.");
}

// ============================================================ 4 · CONTEXT
{
  const s = p.addSlide();
  s.background = { color: C.white };
  badge(s, M, 0.62, 1);
  s.addText("Context — what I need to know before designing anything", {
    x: M + 0.6, y: 0.6, w: 11, h: 0.55, isTextBox: true, margin: 0, fontFace: F, fontSize: 21, bold: true, color: C.ink,
  });
  const quad = [
    ["Users & decisions", "Who exactly is “the team”? Which decisions — renewal, sourcing, thesis, board prep, onboarding? Cost of a wrong answer per decision. What's the workaround today."],
    ["The content", "Volume and formats. Duplication and versioning. Sensitive material: participant PII, candid assessments, board and comp. Consistency over 5 years. Spanish-language reports."],
    ["Access & permissions", "Per system: Shared Drives vs. My Drive; GivingData API or export; Airtable scope; Zoom retention and privacy. SSO. Grant-agreement and co-funder data-use terms. Who signs off."],
    ["What “good” means", "The one recurring task that should go from hours to minutes. The 6-month success metric. And the failure that would end adoption — one bad answer in front of a grantee or the board."],
  ];
  const qw = (EW - 2 * M - 0.4) / 2, qh = 2.5;
  quad.forEach((row, i) => {
    const x = M + (i % 2) * (qw + 0.4);
    const y = 1.55 + Math.floor(i / 2) * (qh + 0.35);
    s.addShape("roundRect", { x, y, w: qw, h: qh, rectRadius: 0.06, fill: { color: C.paper }, line: { color: C.peachLine, width: 1 } });
    s.addText(row[0], { x: x + 0.28, y: y + 0.22, w: qw - 0.56, h: 0.4, isTextBox: true, margin: 0, fontFace: F, fontSize: 14, bold: true, color: C.accentDeep });
    s.addText(row[1], { x: x + 0.28, y: y + 0.68, w: qw - 0.56, h: qh - 0.9, isTextBox: true, margin: 0, fontFace: F, fontSize: 11, color: C.body, lineSpacingMultiple: 1.24 });
  });
  s.addText("Week-one output: a field-level inventory of the four systems, an agreed v1 corpus, a 50-question gold set, and a named owner who signs off on the access model.", {
    x: M, y: 6.75, w: 11.5, h: 0.5, isTextBox: true, margin: 0, fontFace: F, fontSize: 11, italic: true, color: C.muted,
  });
  pageNum(s, 4);
  s.addNotes("Before designing anything I'd spend the first weeks on discovery, in four areas: the users and the decisions this serves; the content itself, especially the sensitive material; the access and permission constraints per system; and — Round 0 — every place grant knowledge actually lives, because the four named systems are the starting point, not the boundary. I trace three real past decisions to every place they were recorded.");
}

// ============================================================ 5 · THE SYSTEM
{
  const s = p.addSlide();
  s.background = { color: C.white };
  badge(s, M, 0.62, 2);
  s.addText("The system — end to end", { x: M + 0.6, y: 0.6, w: 11, h: 0.55, isTextBox: true, margin: 0, fontFace: F, fontSize: 21, bold: true, color: C.ink });

  const steps = [
    ["Connect", "One adapter contract. Mock and real Drive / GivingData / Airtable connectors are interchangeable. Incremental sync."],
    ["Clean & de-dupe", "OCR-confidence quarantine, field normalization, exact + near + cross-system de-duplication, reconcile against the grant spine → visible gap report."],
    ["Resolve", "Everything joined to canonical Grant / Org / Fund / Person. Low-confidence merges to a review queue."],
    ["Retrieve — permissioned", "Hybrid keyword + semantic search, then filtered to what the asker may see. This filter is the security boundary — it runs in code and as a SQL WHERE clause. Restricted tier is never indexed."],
    ["Answer with citations", "Grounded in retrieved passages; every claim deep-links to the exact spot. States what it searched and what it could not. Conflicts shown, not merged. Refuses when unsupported."],
    ["Evaluate & improve", "A gold Q&A set + a 16-case adversarial suite + ~130 unit tests + a dependency-advisory check gate every release (npm run ci). Feedback feeds the gold set. Better at retrieving and citing — never at deciding."],
  ];
  let y = 1.6;
  steps.forEach((row, i) => {
    s.addShape("roundRect", { x: M, y, w: 0.34, h: 0.34, rectRadius: 0.05, fill: { color: i === 3 ? C.accent : C.amber }, line: { type: "none" } });
    s.addText(row[0], { x: M + 0.55, y: y - 0.04, w: 2.9, h: 0.5, isTextBox: true, margin: 0, fontFace: F, fontSize: 13.5, bold: true, color: C.ink });
    s.addText(row[1], { x: M + 3.5, y: y - 0.06, w: 8.0, h: 0.9, isTextBox: true, margin: 0, fontFace: F, fontSize: 10.5, color: C.body, lineSpacingMultiple: 1.18 });
    y += 0.9;
  });
  pageNum(s, 5);
  s.addNotes("End to end: connectors pull each source behind one interface. A data-quality layer cleans, de-duplicates across systems, and reconciles against the grant list so gaps are visible, not silent. Everything resolves to the same grants and orgs. Retrieval is hybrid and then filtered to the caller's permissions — that filter is the security boundary, and restricted content is never in the index at all. Answers are grounded, cited to the exact passage, and honest about coverage. A gold set gates every release, including permission-leak tests.");
}

// ============================================================ 6 · WHAT GOOD LOOKS LIKE
{
  const s = p.addSlide();
  s.background = { color: C.white };
  badge(s, M, 0.62, 2);
  s.addText("What a good answer looks like", { x: M + 0.6, y: 0.6, w: 11, h: 0.55, isTextBox: true, margin: 0, fontFace: F, fontSize: 21, bold: true, color: C.ink });

  // mock answer card — all entities fictional (synthetic demo corpus)
  s.addShape("roundRect", { x: M, y: 1.5, w: 7.1, h: 5.2, rectRadius: 0.06, fill: { color: C.paper }, line: { color: C.peachLine, width: 1 } });
  s.addText("How did Riverbend Care Collective perform against projection, and did the PO flag anything?", { x: M + 0.3, y: 1.75, w: 6.5, h: 0.6, isTextBox: true, margin: 0, fontFace: F, fontSize: 12.5, bold: true, color: C.ink });
  s.addText([
    { text: "Projected 107× / +$9,400 annual per worker ", options: {} },
    { text: "[1]", options: { color: C.accent, bold: true } },
    { text: ". Year 1: 2,610 placed — 67% of target ", options: {} },
    { text: "[2]", options: { color: C.accent, bold: true } },
    { text: ". Median wage at placement $19.10/hr vs a $16.80 baseline ", options: {} },
    { text: "[2]", options: { color: C.accent, bold: true } },
    { text: ". The PO's check-in flags a Q2 reimbursement delay ", options: {} },
    { text: "[3]", options: { color: C.accent, bold: true } },
    { text: ".", options: {} },
  ], { x: M + 0.3, y: 2.5, w: 6.5, h: 1.6, isTextBox: true, margin: 0, fontFace: F, fontSize: 11, color: C.body, lineSpacingMultiple: 1.3 });
  s.addText("⚠ Two sources give a different wage figure — shown, not reconciled: $19.10 [2] vs $18.40 [4].", { x: M + 0.3, y: 3.95, w: 6.5, h: 0.4, isTextBox: true, margin: 0, fontFace: F, fontSize: 8.5, color: C.amber, italic: true });
  s.addShape("line", { x: M + 0.3, y: 4.35, w: 6.5, h: 0, line: { color: C.peachLine, width: 1, dashType: "dash" } });
  s.addText("Searched GivingData (2022–26), 3 Shared Drives, Airtable, Zoom.  Not covered: pre-2022, board/comp/legal.  1 scanned doc set aside as unreadable.", { x: M + 0.3, y: 4.47, w: 6.5, h: 0.7, isTextBox: true, margin: 0, fontFace: F, fontSize: 8.5, color: C.muted, lineSpacingMultiple: 1.2 });
  s.addText("● medium — the cited sources disagree on a figure; reconcile against them        Request external-use review", { x: M + 0.3, y: 5.15, w: 6.5, h: 0.5, isTextBox: true, margin: 0, fontFace: F, fontSize: 8.5, color: "8A6D2E", lineSpacingMultiple: 1.15 });
  s.addText("Deep dive: Year-1 report is the plan, not the outcome · ask Dana Okafor, PO (wrote the check-in) · draft email ready · renewal window opens in 84 days", { x: M + 0.3, y: 5.7, w: 6.5, h: 0.85, isTextBox: true, margin: 0, fontFace: F, fontSize: 8.5, italic: true, color: C.accentDeep, lineSpacingMultiple: 1.2 });

  const props = [
    ["A citation on every claim", "deep-links to the exact sentence, highlighted"],
    ["A coverage line", "what it searched, what it could not see, what it set aside"],
    ["Confidence = evidence quality", "coverage · source agreement · freshness · citation completeness — not the model's certainty"],
    ["Conflicts shown, not merged", "two sources disagree → both, with citations"],
    ["Deep dive", "what's missing · who to ask · a draft email · where the grant is in its own cycle"],
  ];
  let y = 1.62;
  props.forEach((row) => {
    s.addShape("ellipse", { x: 8.6, y: y + 0.03, w: 0.15, h: 0.15, fill: { color: C.accent }, line: { type: "none" } });
    s.addText([
      { text: row[0] + "  ", options: { bold: true, color: C.ink } },
      { text: row[1], options: { color: C.muted } },
    ], { x: 8.95, y: y - 0.06, w: 3.75, h: 1.0, isTextBox: true, margin: 0, fontFace: F, fontSize: 9.5, lineSpacingMultiple: 1.14 });
    y += 0.96;
  });
  s.addText("All names, orgs and figures here are synthetic and fictional.", { x: 8.95, y: 6.55, w: 3.75, h: 0.35, isTextBox: true, margin: 0, fontFace: F, fontSize: 8, italic: true, color: C.muted });
  pageNum(s, 6);
  s.addNotes("This is the interaction. A short answer, every claim linked to the exact passage. A coverage line — what it searched, what it couldn't see, what it set aside. Confidence describes the evidence, not the model's certainty — here it's medium because two sources give a different wage figure, and Compass shows both rather than picking one. And a Deep dive panel: what's missing, who to ask based on who actually worked the grant, a draft email, and where this grant is in its own reporting cycle. Every name and number on this slide is synthetic.");
}

// ============================================================ 7 · THIS RUNS
{
  const s = p.addSlide();
  s.background = { color: C.ink };
  kicker(s, "The skills demonstration", M, 0.8, C.amber);
  s.addText("This isn't a mockup — it runs, and the checks are the proof", { x: M, y: 1.15, w: 11.5, h: 0.7, isTextBox: true, margin: 0, fontFace: F, fontSize: 24, bold: true, color: C.white });
  const checks = [
    ["npm run demo", "One URL: the web app, the API and the login on one origin. Every answer goes through the server-side permission filter — the demo persona switch is a real sign-in, not a UI toggle. Flip from Program Officer to Comms and watch the same question drop from 8 sources to 5."],
    ["npm run eval · eval:pg · eval:full", "12 gold Q&A cases run in memory and through a SQL WHERE clause; 12 more against a synthetic 5-year corpus (~65 grants, ~110 declined applicants, ~260 docs) with template drift, a migration boundary, conflicting figures, Spanish reports. 0 permission leaks."],
    ["npm run redteam", "15 planted prompt-injection documents in the index + jailbreak, exfiltration, permission-probing, PII-extraction. 16/16, 0 leaks. “Print your system prompt” is refused."],
    ["npm run test · security · server:check", "~130 unit tests (~97% line coverage on the logic modules); RS256 OIDC verification, fail-closed on a failed group lookup, a hash-chained audit log, the full Google login flow, rate limits, a kill switch, session revocation — 17/17."],
    ["npm run ci", "All of the above + a dependency-advisory check, in one 10-step promotion gate. A permission-leak finding or a red-team regression is a hard stop. GitHub Actions + Dependabot config included."],
  ];
  let y = 2.15;
  checks.forEach((row) => {
    s.addText(row[0], { x: M, y, w: 3.35, h: 0.9, isTextBox: true, margin: 0, fontFace: "Courier New", fontSize: 9, bold: true, color: C.amber, lineSpacingMultiple: 1.1 });
    s.addText(row[1], { x: M + 3.5, y: y - 0.02, w: 7.9, h: 0.95, isTextBox: true, margin: 0, fontFace: F, fontSize: 8.7, color: "CFC6BD", lineSpacingMultiple: 1.13 });
    y += 0.98;
  });
  pageNum(s, 7);
  s.addNotes("The reason to trust the design is that it's built and tested. It runs as one URL — the web app, the API and the login together — and every answer goes through the real server-side permission filter; the persona switch in the demo is a real sign-in. Twelve gold Q&A cases with a permission-leak test, run in memory and through a SQL WHERE clause, plus twelve more against a synthetic five-year corpus built from public research on the Foundation. A red-team suite with fifteen planted injection documents. Around a hundred and thirty unit tests. Real OIDC, a tamper-evident audit log, rate limits, a kill switch. All of it in a ten-step promotion gate where a leak is a hard stop.");
}

// ============================================================ 7 · RISKS
{
  const s = p.addSlide();
  s.background = { color: C.white };
  badge(s, M, 0.62, 3);
  s.addText("Risks — and how I'd handle each", { x: M + 0.6, y: 0.6, w: 11, h: 0.55, isTextBox: true, margin: 0, fontFace: F, fontSize: 21, bold: true, color: C.ink });
  const risks = [
    ["Fabricated or stale impact numbers", "Mandatory citations; “as reported on {date} / model {version}”; refuse when unsupported; gold-set gates every release."],
    ["Permission leakage", "Retrieval-time ACL filter; restricted tier never indexed; PII redaction at intake; scheduled red-team before every expansion."],
    ["One bad answer collapses trust", "Ship to 3–5 design partners first; measure whether people stop double-checking; never let an unverified answer leave the building."],
    ["Zoom Chat privacy blowback", "Deferred entirely from v1; public channels only if ever; DMs and private channels permanently excluded; staff disclosure first."],
    ["Silent data loss or double-counting", "Every item accounted for; reconcile against the grant spine; exact + near + cross-system de-dupe with reversible merges."],
  ];
  let y = 1.65;
  risks.forEach((row) => {
    s.addShape("roundRect", { x: M, y, w: 11.5, h: 0.98, rectRadius: 0.05, fill: { color: C.paper }, line: { color: C.peachLine, width: 1 } });
    s.addText(row[0], { x: M + 0.28, y: y + 0.13, w: 3.9, h: 0.75, isTextBox: true, margin: 0, fontFace: F, fontSize: 11.5, bold: true, color: C.accentDeep, valign: "middle" });
    s.addText(row[1], { x: M + 4.35, y: y + 0.09, w: 6.9, h: 0.82, isTextBox: true, margin: 0, fontFace: F, fontSize: 10, color: C.body, valign: "middle", lineSpacingMultiple: 1.16 });
    y += 1.12;
  });
  pageNum(s, 8);
  s.addNotes("The failures that matter most. A fabricated or stale impact number — handled with mandatory citations, date-and-model stamping, and refusal. Permission leakage — the retrieval-time filter, restricted content kept out of the index entirely, and a scheduled red-team. Trust collapse from one bad answer — ship narrow first and measure trust. Zoom privacy — deferred. And silent data loss or double-counting — full accounting, reconciliation against the grant list, and reversible de-dupe.");
}

// ============================================================ 8 · TRADEOFFS
{
  const s = p.addSlide();
  s.background = { color: C.white };
  badge(s, M, 0.62, 4);
  s.addText("Tradeoffs — deliberately out of v1", { x: M + 0.6, y: 0.6, w: 11, h: 0.55, isTextBox: true, margin: 0, fontFace: F, fontSize: 21, bold: true, color: C.ink });
  s.addText("Every deferral removes risk without removing the core value: ask five years of grant knowledge one question, get a cited answer.", {
    x: M, y: 1.2, w: 11.5, h: 0.5, isTextBox: true, margin: 0, fontFace: F, fontSize: 11.5, italic: true, color: C.muted,
  });
  const rows = [
    ["Zoom Chat ingestion", "Highest privacy risk, messiest data, uncertain retention; the real decisions are usually written up elsewhere."],
    ["Any write-back to source systems", "Read-only Q&A has a fraction of the risk surface. Actions come only once the read path is trusted."],
    ["Full five-year backfill on day one", "Start with ~3 years plus active grants — higher quality, answers most decisions — then extend."],
    ["Fine-tuning on Foundation data", "Retrieval-only is cheaper and safer, and keeps sensitive data out of model weights."],
    ["Org-wide self-serve access", "v1 is 3–5 Programs design partners. “The whole team” is the goal for a later phase, not the v1 scope."],
    ["Rebuilding their impact dashboard", "They already have Tableau for that. Compass answers questions; it is not BI."],
  ];
  let y = 1.95;
  rows.forEach((row) => {
    s.addText("✕", { x: M, y: y, w: 0.3, h: 0.4, isTextBox: true, margin: 0, fontFace: F, fontSize: 12, bold: true, color: C.accent });
    s.addText([
      { text: row[0] + "\n", options: { bold: true, color: C.ink } },
      { text: row[1], options: { color: C.body } },
    ], { x: M + 0.4, y: y - 0.05, w: 11.1, h: 0.85, isTextBox: true, margin: 0, fontFace: F, fontSize: 10.5, lineSpacingMultiple: 1.16 });
    y += 0.87;
  });
  pageNum(s, 9);
  s.addNotes("What I'd cut from v1, and why each is safe to cut. Zoom Chat — deferred entirely. Any write-back — read-only first. The full backfill — start with three years. Fine-tuning — retrieval only. Org-wide access — 3 to 5 design partners first. And I wouldn't rebuild their impact dashboard; that's what Tableau is for. Every one of these removes risk without touching the core value.");
}

// ============================================================ 9 · SECURITY & COMPLIANCE
{
  const s = p.addSlide();
  s.background = { color: C.ink };
  kicker(s, "The pillar, not a later phase", M, 0.8, C.amber);
  s.addText("Security, privacy and compliance", { x: M, y: 1.15, w: 11.5, h: 0.7, isTextBox: true, margin: 0, fontFace: F, fontSize: 26, bold: true, color: C.white });
  s.addText("~$20M/yr, five years of records on private companies, nonprofits, co-funders and named participants across the US, Colombia and Kenya — concentrated in one place. Compass is built to be at least as safe as its most sensitive source.", {
    x: M, y: 1.95, w: 11.5, h: 0.95, isTextBox: true, margin: 0, fontFace: F, fontSize: 11.5, color: "CFC6BD", lineSpacingMultiple: 1.3,
  });
  const cols = [
    ["Built & tested", ["OIDC verify + fail-closed on a failed group lookup", "The ACL filter — in code AND as SQL; 0 leaks", "Restricted tier never enters the index; PII quarantined at intake", "Hardened response headers (CSP / X-Frame-Options), asserted in CI", "Egress allowlist; hash-chained audit log; kill switch; rate limits"]],
    ["Built, opt-in / gated", ["Enterprise LLM path (zero-retention) — extractive by default", "Only retrieved passages sent — never the corpus", "Real Google Directory group lookup (cached, fail-closed)", "Local learned embeddings + NER; off-host audit streaming hook"]],
    ["Needs the environment", ["A third-party penetration test — scope of work written; repo is clone-and-run", "KMS for secrets; Redis; private network + egress policy — checklist written", "Counsel: LLM agreement + Colombia/Kenya determination", "Controls matrix: NIST CSF 2.0 / 800-53 / SOC 2 / AI RMF + OWASP Top 10 + LLM Top 10"]],
  ];
  const cw = (EW - 2 * M - 0.6) / 3;
  cols.forEach((c, i) => {
    const x = M + i * (cw + 0.3);
    s.addText(c[0], { x, y: 3.15, w: cw, h: 0.4, isTextBox: true, margin: 0, fontFace: F, fontSize: 13, bold: true, color: C.amber });
    s.addText(c[1].map((t, j) => ({ text: t, options: { bullet: { code: "2022" }, breakLine: j < c[1].length - 1, paraSpaceAfter: 6 } })), {
      x, y: 3.6, w: cw, h: 3.3, isTextBox: true, margin: 0, fontFace: F, fontSize: 10, color: "D9D0C8", lineSpacingMultiple: 1.15,
    });
  });
  pageNum(s, 10);
  s.addNotes("Security and compliance are a first-class pillar, not a later phase, because Compass concentrates everything sensitive into one place. Access is per-person with SSO and MFA, and the retrieval-time filter is the boundary — restricted content never even enters the index. The LLM runs under a zero-retention enterprise agreement and only ever sees the retrieved passages. Everything is audit-logged with a kill switch. Controls map from day one to NIST, SOC 2, the AI RMF, and the privacy regimes of all three grantee geographies.");
}

// ============================================================ 10 · THE PLAN
{
  const s = p.addSlide();
  s.background = { color: C.white };
  kicker(s, "How I'd run it", M, 0.7);
  s.addText("Steps, not a calendar", { x: M, y: 1.0, w: 11, h: 0.6, isTextBox: true, margin: 0, fontFace: F, fontSize: 24, bold: true, color: C.ink });
  s.addText("Four phases, each done when its exit criteria pass — not when a date arrives. Progress reported as ahead / on / behind plan. Quick turnaround is answered by shipping a thin vertical slice early, then widening.", {
    x: M, y: 1.65, w: 11.5, h: 0.9, isTextBox: true, margin: 0, fontFace: F, fontSize: 11.5, color: C.muted, lineSpacingMultiple: 1.3,
  });
  const phases = [
    ["1 · Discover — access, corpus, gold set", "Interviews, a field-level inventory, scoped credentials, the LLM agreement + legal review, the tier scheme signed off, the 50–100-question gold set, an agreed v1 corpus + 6-month metric."],
    ["2 · Prove — the permissioned vertical slice", "Drive + GivingData connectors, the data-quality pipeline on ~30 real grants, permissioned retrieval (0 leaks), one URL — web app + API + Google login, audit log + kill switch, 3–5 design partners querying weekly."],
    ["3 · Harden — expand the corpus, close the security items", "Airtable + Notion, the production PII pass, multilingual, the promotion gate on CI, the third-party pen test remediated (repo is clone-and-run; scope written), backfill to five years, full Programs + Impact team."],
    ["4 · Expand — surfaces, dashboards, handoff", "An embed or a Slack/Zoom surface, usage/cost dashboards, the full runbook + incident playbooks, a named trained owner, the leadership decision packet, the tabletop exercise."],
  ];
  let y = 2.75;
  phases.forEach((row) => {
    s.addShape("roundRect", { x: M, y, w: 11.5, h: 1.02, rectRadius: 0.05, fill: { color: C.paper }, line: { color: C.peachLine, width: 1 } });
    s.addText(row[0], { x: M + 0.28, y: y + 0.12, w: 11, h: 0.35, isTextBox: true, margin: 0, fontFace: F, fontSize: 12, bold: true, color: C.accentDeep });
    s.addText(row[1], { x: M + 0.28, y: y + 0.46, w: 11, h: 0.5, isTextBox: true, margin: 0, fontFace: F, fontSize: 9.5, color: C.body, lineSpacingMultiple: 1.14 });
    y += 1.15;
  });
  pageNum(s, 11);
  s.addNotes("I'd run this as steps, not a calendar. Four phases, each done when its exit criteria pass. Discovery and access first. Then a permissioned vertical slice on about thirty grants, shipped early to a few design partners with the security controls already in place. Then hardening and expanding to five years. Then additional surfaces, documentation, and handoff to a named internal owner — because it's a six-month fellowship into a team with no engineers.");
}

// ============================================================ 11 · WEEK ONE / WHERE IT GOES
{
  const s = p.addSlide();
  s.background = { color: C.accentDeep };
  leaf(s, 1.0, 0.95, 0.5, C.white);
  s.addText("Week one", { x: M, y: 1.9, w: 6, h: 0.6, isTextBox: true, margin: 0, fontFace: F, fontSize: 22, bold: true, color: C.white });
  s.addText([
    "Interview the 3–5 people whose work this must improve; secure 2 as weekly design partners",
    "Inventory the four systems — objects, fields, permissions, retention, data quality",
    "Get the data owner in a room; agree the v1 corpus and the sensitivity tiers",
    "Start the 50-question gold set and the LLM data-processing agreement",
  ].map((t, i, a) => ({ text: t, options: { bullet: { code: "2022" }, breakLine: i < a.length - 1, paraSpaceAfter: 7 } })), {
    x: M, y: 2.55, w: 6.4, h: 2.8, isTextBox: true, margin: 0, fontFace: F, fontSize: 11, color: "F4D9CF", lineSpacingMultiple: 1.2,
  });
  s.addShape("line", { x: 7.85, y: 2.0, w: 0, h: 3.5, line: { color: "C86B54", width: 1 } });
  s.addText("Why this fits", { x: 8.3, y: 1.9, w: 4.5, h: 0.6, isTextBox: true, margin: 0, fontFace: F, fontSize: 22, bold: true, color: C.white });
  s.addText("Rigorous but reasonable: rigor on citations, permissions and evals; reasonableness on scope and on saying “we don't have that.” An MVP-first build, documented in the open, for a team with no engineers and a six-month clock.", {
    x: 8.3, y: 2.55, w: 4.4, h: 3.0, isTextBox: true, margin: 0, fontFace: F, fontSize: 10.5, color: "F4D9CF", lineSpacingMultiple: 1.3,
  });
  s.addText("Jessenia Cintron  ·  Compass  ·  strategy doc · discovery guide · security review + OWASP controls matrix · cost model · pen-test scope · deploy checklist · data-owner sign-off · running codebase (npm run ci · npm run demo)", {
    x: M, y: EH - 0.95, w: 11.5, h: 0.55, isTextBox: true, margin: 0, fontFace: F, fontSize: 8.5, color: "E7B6A6", lineSpacingMultiple: 1.2,
  });
  s.addNotes("What I'd actually do in week one: interview the people whose work this improves, lock in design partners, inventory every source including the shadow ones, get the data owner to agree the corpus and the tiers, and start the gold set and the LLM agreement. And where it goes: the Foundation is building toward knowledge products for the sector — Compass is that shape, and could become something the advisory side offers other funders. Happy to take questions.");
}

p.writeFile({ fileName: require("path").join(__dirname, "C_Compass_Deck.pptx") }).then((f) => console.log("wrote", f));
