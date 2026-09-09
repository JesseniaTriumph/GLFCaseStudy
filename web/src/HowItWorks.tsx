import type { CorpusIndex } from "@compass/core/types.js";

/** The "How it works" tab — the six pipeline stages with the reasoning behind each,
 *  the rule, and what is real vs. stubbed in the demo. */
export function HowItWorks({ index }: { index: CorpusIndex }) {
  const stages: [string, string, string][] = [
    [
      "Connect",
      "One adapter per source — Google Drive, GivingData, Airtable (Zoom and Notion are built and gated). Real connectors activate the moment a credential is present; the synthetic corpus is simply replaced by the real pull. Nothing downstream changes.",
      "A messy-source problem needs a uniform envelope. Every adapter emits the same shape, so cleaning, resolution, permissioning and retrieval never learn where a document came from.",
    ],
    [
      "Preserve",
      "Every document is cleaned, content-hashed, language-tagged and PII-scanned at intake. Participant identifiers are stripped and quarantined; instruction-like text aimed at an AI is removed; unreadable scans are set aside. Each count is disclosed on the answer.",
      "The HOPE-dashboard lesson: records your own pipeline drops are invisible until you count them. And treating a retrieved document as data, never instructions, is what makes indirect prompt injection inert.",
    ],
    [
      "Resolve",
      "Records from different systems are joined to the same grant and organization through structured keys — grant IDs, the GivingData org table — never by matching prose. Duplicates collapse to one authoritative copy (final over draft, system-of-record over a working figure); conflicting values are shown side by side, not merged. A low-confidence match goes to a review queue.",
      "“No single source of truth” is the core problem. Joining on IDs is language-neutral, so a Spanish report and an English grant record resolve to one grant. Silently merging a conflict would be exactly the measurement dishonesty the Foundation's own handbook names.",
    ],
    [
      "Retrieve",
      "Hybrid search — keyword (BM25) for exact strings like grant IDs and dollar figures, plus meaning (embeddings). The permission filter runs first, as a database WHERE clause, so a passage you may not see is never even scored. An optional cross-encoder reranker re-orders the top ~30 results; it runs after the filter, so it can only reorder what you were already entitled to see. Restricted-tier material is never indexed at all — only a metadata stub.",
      "UI hiding is not a security control. Enforcing at retrieval, before ranking and before the model, means a model can't leak a passage it never received. Exclusion beats access-gating: a document that isn't in the index can't be reached by a bug, a permission-map error, or a clever prompt.",
    ],
    [
      "Answer",
      "An evidence brief: every claim linked to a record you can open (the citation opens the source with the passage highlighted, permission re-checked), a coverage line stating what was and wasn't searched, and a confidence grade computed from the evidence — coverage, source agreement, freshness, citation completeness. Compass abstains when support is thin, and refuses outright on the topic alone for board/staff compensation, declined-applicant diligence, and privileged legal material — without confirming such a record exists.",
      "For a funder whose brand is measurement rigor, the product can never fabricate a number or surface a candid internal note to the wrong reader. Confidence describes the evidence, not the model's certainty. The existence and count of restricted records is itself sensitive, so a refusal reveals neither.",
    ],
    [
      "Improve",
      "A 46-case gold set and a 17-case adversarial red-team suite (injection, jailbreak, exfiltration, PII, legal-privilege) gate every change; a single leaked restricted string fails the build. Thumbs feedback feeds the gold set. Retrieval config and prompts evolve only through a reviewed change, always measured against the gold set.",
      "“Self-improving” means better at retrieving and citing — never at deciding. Every improvement is gated by ground truth and a human review, so the system can't drift into judgement calls.",
    ],
  ];
  return (
    <div className="how">
      <p className="intro">
        Compass is a <b>retrieval, permissioning, and citation</b> system, not a chatbot. Every security-critical
        decision is made in deterministic code, outside the language model. The model phrases; it does not decide.
      </p>
      <div className="how-stages">
        {stages.map(([name, desc, why], i) => (
          <div className="how-stage" key={name}>
            <div className="how-n">{i + 1}</div>
            <div>
              <h4>{name}</h4>
              <p>{desc}</p>
              <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 4 }}><b>Why:</b> {why}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="dossier-sec">
        <h4>The rule</h4>
        <p style={{ fontSize: 14 }}>If the user cannot open the evidence behind a sentence, Compass does not say it.</p>
      </div>
      <div className="dossier-sec">
        <h4>What's real in this demo vs. what's stubbed</h4>
        <table className="how-tbl">
          <tbody>
            <tr><td>Real</td><td>The full pipeline, hybrid retrieval, the per-chunk permission filter (also runnable as SQL), Restricted-tier exclusion + topic-level refusal, PII scrub + quarantine, indirect-injection stripping, content hashing, cross-system resolution + conflict surfacing, per-grant cycle logic, the evidence-brief schema, the source viewer, the eval + red-team harness, RS256 OIDC verification, the HMAC session + server-side revocation, the hash-chained audit log, per-user rate/cost limits, anomaly monitoring, the kill switch.</td></tr>
            <tr><td>Real, opt-in</td><td>Learned embeddings (bge-small, local). The cross-encoder reranker (bge-reranker, local). The full Google OIDC login flow. Postgres-backed retrieval. Translation-at-intake for Spanish reports.</td></tr>
            <tr><td>Stubbed</td><td>The connectors run on a synthetic, fictional corpus — real ones implement the same interface and swap in with a credential. The source-system record URLs are fictional, so a citation opens a Compass-rendered view of the record instead. Answers are extractive; a generative backend under a zero-retention agreement is one config value. On this static-only page, retrieval runs in the browser with a persona switch instead of a login; the hosted demo runs the real server.</td></tr>
          </tbody>
        </table>
      </div>
      <div className="dossier-sec" style={{ color: "var(--muted)", fontSize: 12 }}>
        Index built {new Date(index.builtAt).toLocaleString()} · {index.chunks.length} chunks · {index.entities.length} entities ·
        manifest digest {index.manifest.contentDigest.slice(0, 12)}… · all data synthetic and fictional.
      </div>
    </div>
  );
}
