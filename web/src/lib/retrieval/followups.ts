import type { CorpusIndex, FollowUps, IndexPerson } from "../core/types.js";
import type { Scored } from "./search.js";

/**
 * "Deep dive" — generated beside the answer, never inside it. A toggleable assistant that
 * flags what would sharpen the answer, who to ask (based on who was actually associated
 * with the grants involved), what to ask them, and a draft email when there's a clear
 * recipient. All of this is derived from the entity graph + directory the pipeline built.
 */
export function suggestFollowups(
  index: CorpusIndex,
  question: string,
  hits: Scored[],
  withheld: { count: number; tiers: string[] }
): FollowUps {
  // --- which grants / orgs is this answer about? (top hits only, to avoid noise) ---
  const core = hits.slice(0, 5);
  const grantIds = new Set<string>();
  const orgLabels = new Set<string>();
  for (const h of core) {
    for (const e of h.chunk.entities) {
      if (e.kind === "grant") grantIds.add(e.id);
      if (e.kind === "organization") orgLabels.add(e.label);
    }
  }
  const systems = new Set(hits.map((h) => h.chunk.system));

  // --- gaps ---
  const gaps: string[] = [];
  for (const g of grantIds) {
    for (const m of index.gaps.missingByGrant[g] ?? []) gaps.push(`${g}: ${m}`);
  }
  const hasFactSheet = hits.some((h) => h.chunk.docTitle.startsWith("Grant fact sheet"));
  const hasReported = hits.some((h) => /reported results|progress report|check-in/i.test(h.chunk.docTitle));
  if (hasFactSheet && !hasReported && grantIds.size) gaps.push("No reported results are in the retrieved set — the answer is based on the plan, not outcomes.");
  if (withheld.tiers.includes("restricted")) gaps.push("Some relevant material is in the Restricted tier and is not shown.");
  if (systems.size === 1) gaps.push(`Answer draws on ${[...systems][0]} only — ${["givingdata", "drive", "airtable"].filter((s) => !systems.has(s)).join(" and ")} may add context.`);
  if (hits.length <= 2) gaps.push("Few sources matched — treat this as a partial answer.");
  if (/across|all |every |portfolio|trend|compare/i.test(question) && hits.length < 5)
    gaps.push("This is a portfolio-wide question but only a few sources matched — it is probably not exhaustive.");

  // --- who to ask ---
  const relevant = index.directory
    .filter((p) => p.grantIds.some((g) => grantIds.has(g)) || p.orgLabels.some((o) => orgLabels.has(o)))
    .sort((a, b) => roleRank(b) - roleRank(a));
  const seen = new Set<string>();
  const whoToAsk = relevant
    .filter((p) => (seen.has(p.name) ? false : (seen.add(p.name), true)))
    .slice(0, 4)
    .map((p) => ({ person: p, why: whyAsk(p, grantIds, orgLabels) }));

  // --- suggested questions ---
  const orgName = [...orgLabels][0] ?? "this grantee";
  const suggestedQuestions: string[] = [];
  if (!hasReported && grantIds.size) suggestedQuestions.push(`Are there Year-1 or interim results for ${orgName} that haven't been filed in GivingData yet?`);
  if (index.gaps.missingByGrant && Object.keys(index.gaps.missingByGrant).some((g) => grantIds.has(g)))
    suggestedQuestions.push(`What's the status of the overdue/missing report for ${orgName}, and is there a partial update we can use?`);
  suggestedQuestions.push(`Is there context from a recent call or email about ${orgName} that isn't written up anywhere Compass can see?`);
  if (systems.has("givingdata") && !systems.has("drive")) suggestedQuestions.push(`Is there a diligence memo or PO note on ${orgName} in Drive that adds to the GivingData record?`);

  // --- draft email (only if there's a clear internal recipient with an address) ---
  const recipient = whoToAsk.find((w) => w.person.kind === "internal" && w.person.email);
  const draftEmail = recipient
    ? {
        to: recipient.person.email!,
        toName: recipient.person.name,
        subject: `Quick context on ${orgName}`,
        body:
          `Hi ${recipient.person.name.split(/\s+/)[0]},\n\n` +
          `I'm pulling together an answer to: "${question}"\n\n` +
          `From what's in our systems I have ${hits.length} source(s)` +
          (gaps.length ? `, but there are gaps:\n` + gaps.slice(0, 3).map((g) => `  • ${g}`).join("\n") + `\n\n` : `. `) +
          (suggestedQuestions.length ? `Could you help with:\n` + suggestedQuestions.slice(0, 2).map((q) => `  • ${q}`).join("\n") + `\n\n` : ``) +
          `As ${recipient.person.role} for ${orgName} you'd know if there's something I'm missing.\n\nThanks!`,
      }
    : null;

  return { gaps: [...new Set(gaps)], whoToAsk, suggestedQuestions: [...new Set(suggestedQuestions)], draftEmail };
}

function roleRank(p: IndexPerson): number {
  if (p.role === "program officer") return 5;
  if (p.role === "relationship owner") return 4;
  if (p.role.startsWith("wrote")) return 3;
  if (p.role.startsWith("attended")) return 2;
  return p.kind === "external" ? 1 : 2;
}

function whyAsk(p: IndexPerson, grantIds: Set<string>, orgLabels: Set<string>): string {
  const g = p.grantIds.find((x) => grantIds.has(x));
  const o = p.orgLabels.find((x) => orgLabels.has(x));
  const anchor = g ? `grant ${g}` : o ? o : "this grant";
  return `${p.role} for ${anchor}${p.kind === "external" ? " (external — confirm before sharing internal context)" : ""}`;
}
