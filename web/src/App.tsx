import React, { useEffect, useMemo, useState } from "react";
import { answerQuestion } from "./lib/retrieval/answer.js";
import type { Answer, CorpusIndex } from "./lib/core/types.js";
import { PERSONAS, personaFunctions } from "./principals.js";

const EXAMPLES = [
  "How did Riverbend Care Collective perform against what they projected, and did the program officer flag anything?",
  "What are the biggest barriers to credential completion across our grantees?",
  "Have we funded advanced-energy maintenance training for rural workers?",
  "Did we decline an AI-upskilling applicant recently, and why?",
  "What did the board discuss about staff compensation?",
];

function useTheme() {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem("compass.theme") || "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("compass.theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  return { theme, setTheme };
}

// tiny markdown: paragraphs, **bold**, _italic_, headings (####), lists, [n] -> cite button
function renderAnswer(text: string, onCite: (n: number) => void, active: number | null) {
  const blocks = text.split(/\n\n+/);
  return blocks.map((b, i) => {
    const key = `b${i}`;
    if (b.startsWith("_") && b.endsWith("_") && !b.includes("\n"))
      return (
        <p className="lead" key={key}>
          {b.slice(1, -1)}
        </p>
      );
    if (/^#{2,}\s/.test(b)) return <h4 key={key}>{b.replace(/^#{2,}\s/, "")}</h4>;
    if (/^[-*]\s/m.test(b))
      return (
        <ul key={key} style={{ margin: "0 0 11px", paddingLeft: 20 }}>
          {b.split("\n").map((li, j) => (
            <li key={j}>{frag(li.replace(/^[-*]\s/, ""), onCite, active)}</li>
          ))}
        </ul>
      );
    return <p key={key}>{frag(b, onCite, active)}</p>;
  });
}

function frag(s: string, onCite: (n: number) => void, active: number | null): React.ReactNode[] {
  // split on [n] and **bold** and _italic_
  const out: React.ReactNode[] = [];
  const re = /(\[\d+\]|\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    if (/^\[\d+\]$/.test(tok)) {
      const n = parseInt(tok.slice(1, -1), 10);
      out.push(
        <button key={`c${k++}`} className={"cite" + (active === n ? " on" : "")} onClick={() => onCite(n)}>
          {n}
        </button>
      );
    } else if (tok.startsWith("**")) out.push(<strong key={`s${k++}`}>{tok.slice(2, -2)}</strong>);
    else out.push(<em key={`e${k++}`}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function App() {
  const { theme, setTheme } = useTheme();
  const [index, setIndex] = useState<CorpusIndex | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [persona, setPersona] = useState<keyof typeof PERSONAS>("programs");
  const [tab, setTab] = useState<"ask" | "dossier" | "how">("ask");
  const [q, setQ] = useState("");
  const [ans, setAns] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeCite, setActiveCite] = useState<number | null>(null);
  const [fb, setFb] = useState<"up" | "down" | null>(null);
  const [external, setExternal] = useState(false);
  const [deepDive, setDeepDive] = useState<boolean>(() => {
    try {
      return localStorage.getItem("compass.deepdive") !== "off";
    } catch {
      return true;
    }
  });
  const [roleCtx, setRoleCtx] = useState<boolean>(() => {
    try {
      return localStorage.getItem("compass.rolectx") === "on";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    fetch("./corpus-index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("index not found — run `npm run build:index`"))))
      .then(setIndex)
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("compass.deepdive", deepDive ? "on" : "off");
      localStorage.setItem("compass.rolectx", roleCtx ? "on" : "off");
    } catch {
      /* ignore */
    }
  }, [deepDive, roleCtx]);

  async function ask(question: string) {
    if (!index || !question.trim()) return;
    setBusy(true);
    setActiveCite(null);
    setFb(null);
    setExternal(false);
    const a = await answerQuestion(index, question.trim(), PERSONAS[persona].principal, {
      followUps: deepDive,
      roleContext: roleCtx ? { functions: personaFunctions(persona) } : undefined,
    });
    setAns(a);
    setQ(question);
    setBusy(false);
  }

  // re-run when persona / deepDive / roleCtx changes and there's a live question
  useEffect(() => {
    if (ans && q) void ask(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, deepDive, roleCtx]);

  const orgs = useMemo(() => {
    if (!index) return [];
    return index.entities.filter((e) => e.kind === "organization").sort((a, b) => a.label.localeCompare(b.label));
  }, [index]);

  if (err) return <div className="shell"><div className="loading">{err}</div></div>;
  if (!index) return <div className="shell"><div className="loading">Loading corpus…</div></div>;

  return (
    <div className="shell">
      <header className="mast">
        <div className="brand">
          <svg className="leaf" viewBox="0 0 30 30" aria-hidden="true">
            <path d="M15 3 L18 11 L26 9 L20 15 L26 21 L18 19 L15 27 L12 19 L4 21 L10 15 L4 9 L12 11 Z" fill="var(--accent)" />
            <circle cx="15" cy="15" r="2.4" fill="var(--ground)" stroke="var(--accent)" strokeWidth="1.3" />
          </svg>
          <div>
            <div className="name">Compass</div>
            <div className="tag">Ask years of grant knowledge one question · GitLab Foundation</div>
          </div>
        </div>
        <div className="mast-right">
          <span className="pill">Prototype · synthetic data</span>
          <button
            className="iconbtn"
            title="Theme"
            onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
          >
            {theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}
          </button>
        </div>
      </header>

      <div className="strip">
        <span className="lbl">V1 corpus</span>
        <span className="chip"><span className="dot" /> GivingData <span className="rng">
          {index.coverage.dateRange ? `${index.coverage.dateRange[0]?.slice(0, 4)}–${index.coverage.dateRange[1]?.slice(0, 4)}` : ""}
        </span></span>
        <span className="chip"><span className="dot" /> Google Drive</span>
        <span className="chip"><span className="dot" /> Airtable</span>
        <span className="chip off"><span className="dot" /> Zoom Chat <span className="rng">deferred — not in V1</span></span>
        <span className="strip-note">V1 is these three systems. Zoom is deferred (retention + privacy review). This demo runs on synthetic data only.</span>
      </div>
      <div className="strip">
        <span className="lbl">Signed in as</span>
        <select className="persona" value={persona} onChange={(e) => setPersona(e.target.value as keyof typeof PERSONAS)}>
          {Object.entries(PERSONAS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <span className="persona-note">{PERSONAS[persona].note} · in production this is Google sign-in</span>
      </div>
      <div className="strip">
        <span className="lbl">Features</span>
        <label className="vt">
          <input type="checkbox" checked={deepDive} onChange={(e) => setDeepDive(e.target.checked)} /> Deep dive
        </label>
        <label className="vt">
          <input type="checkbox" checked={roleCtx} onChange={(e) => setRoleCtx(e.target.checked)} /> Role &amp; cycle context
        </label>
        <span className="persona-note">
          {roleCtx
            ? `on — tailors suggestions & reads ambiguous questions for a ${PERSONAS[persona].label}; scoping is always shown in the coverage line, never a permission`
            : "off — Compass answers the literal question over everything you may see"}
        </span>
      </div>

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "ask"} onClick={() => setTab("ask")}>Ask</button>
        <button role="tab" aria-selected={tab === "dossier"} onClick={() => setTab("dossier")}>Grantee dossier</button>
        <button role="tab" aria-selected={tab === "how"} onClick={() => setTab("how")}>How it works</button>
      </nav>

      {tab === "ask" && (
        <div className="split">
          <div>
            <p className="intro">
              Compass retrieves from the connected systems, then answers only from what it found — every claim links to
              its source, and each answer states what it searched and what it could not. When support is thin, it says so.
            </p>
            <div className="prompts">
              {EXAMPLES.map((e) => (
                <button key={e} onClick={() => ask(e)}>{e}</button>
              ))}
            </div>
            <form
              className="askbar"
              onSubmit={(ev) => {
                ev.preventDefault();
                void ask(q);
              }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ask a question…"
                aria-label="Ask a question"
              />
              <button type="submit" disabled={busy || !q.trim()}>{busy ? "…" : "Ask"}</button>
            </form>

            {ans && (
              <>
                <div className="question">{ans.question}</div>
                <div className="answer-card">
                  <div className="answer-body">{renderAnswer(ans.text, setActiveCite, activeCite)}</div>
                  <div className="coverage">
                    <b>Searched:</b>
                    <span>{ans.coverage}</span>
                  </div>
                  <div className="meta">
                    <span className={"conf " + ans.confidence}>● {ans.confidence} — {ans.confidenceReason}</span>
                    {ans.confidence !== "refused" && (
                      <button type="button" className={"vt" + (external ? " on" : "")} onClick={() => setExternal(!external)}>
                        Request external-use review
                      </button>
                    )}
                    <span className="fb">
                      <button aria-pressed={fb === "up"} onClick={() => setFb(fb === "up" ? null : "up")} title="Useful">▲</button>
                      <button aria-pressed={fb === "down"} onClick={() => setFb(fb === "down" ? null : "down")} title="Wrong / incomplete">▼</button>
                    </span>
                  </div>
                  {external && (
                    <div className="vbanner">
                      <b>External-use review requested.</b> This does not approve sharing. Before anything
                      leaves the Foundation it goes through: source-permission check · PII &amp; redaction
                      pass · grantee-consent confirmation · sign-off by an accountable approver. Every
                      figure is re-verified against its cited source. The request is logged.
                    </div>
                  )}
                </div>

                {ans.followUps && ans.confidence !== "refused" && (
                  <div className="dd">
                    <div className="dd-head">
                      Deep dive <span className="n">— what to check next, kept separate from the answer</span>
                      <label>
                        <input type="checkbox" checked={deepDive} onChange={(e) => setDeepDive(e.target.checked)} /> show
                      </label>
                    </div>
                    {deepDive && (
                      <div className="dd-body">
                        {ans.followUps.gaps.length > 0 && (
                          <div className="dd-g">
                            <h5>What would sharpen this answer</h5>
                            <ul>{ans.followUps.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
                          </div>
                        )}
                        {ans.followUps.whoToAsk.length > 0 && (
                          <div className="dd-g dd-who">
                            <h5>Who to ask</h5>
                            <ul>
                              {ans.followUps.whoToAsk.map((w, i) => (
                                <li key={i}>
                                  <strong>{w.person.name}</strong> — <span className="r">{w.why}</span>
                                  {w.person.email && <span className="src-ref"> {w.person.email}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {ans.followUps.suggestedQuestions.length > 0 && (
                          <div className="dd-g">
                            <h5>Suggested questions</h5>
                            <ul>{ans.followUps.suggestedQuestions.map((qq, i) => <li key={i}>{qq}</li>)}</ul>
                          </div>
                        )}
                        {ans.followUps.draftEmail && (
                          <div className="dd-g">
                            <h5>Draft email</h5>
                            <div className="dd-email">
                              <span className="to">To: {ans.followUps.draftEmail.to}</span>
                              <br />
                              <span className="to">Subject: {ans.followUps.draftEmail.subject}</span>
                              <pre>{ans.followUps.draftEmail.body}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="rail" aria-label="Sources for the current answer">
            <h3>Sources &amp; coverage</h3>
            <div className="rail-scroll">
              {!ans && <div className="rail-empty">Ask a question to see the documents behind the answer, which system each came from, and its sensitivity tier.</div>}
              {ans &&
                ans.citations.map((c) => (
                  <a
                    key={c.n}
                    className={"src" + (activeCite === c.n ? " on" : "")}
                    href={c.deepLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setActiveCite(c.n)}
                  >
                    <div className="src-top">
                      <span className={"sys " + c.system}>{c.system}</span>
                      <span className="src-ref">{c.ref}</span>
                    </div>
                    <div className="src-title">
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>[{c.n}]</span>{" "}
                      {c.docTitle}
                      {c.locator ? ` · ${c.locator}` : ""}
                    </div>
                    <div className="src-snip">{c.snippet}…</div>
                    <div className="src-open">↳ opens in {c.system}, this passage highlighted ↗</div>
                    <div className={"src-tier" + (c.tier === "programs-only" ? " p" : "")}>
                      {c.tier === "programs-only" ? "Programs-only" : "Team"}
                    </div>
                  </a>
                ))}
              {ans?.withheld && (
                <div className="withheld">
                  <b>{ans.withheld.count} withheld</b>
                  {ans.withheld.reason}
                </div>
              )}
              {ans && ans.citations.length === 0 && !ans.withheld && (
                <div className="rail-empty">No retrievable sources for this question in the current corpus and permission scope.</div>
              )}
            </div>
          </aside>
        </div>
      )}

      {tab === "dossier" && <Dossier index={index} persona={persona} />}
      {tab === "how" && <HowItWorks index={index} />}

      <footer>
        <b>What runs here:</b> the real pipeline output (`corpus-index.json`) with in-browser hybrid retrieval, the
        retrieval-time permission filter, `Restricted`-tier exclusion, cited answers, coverage disclosure, and the
        toggleable Deep dive — the same modules as the CLI and eval harness. <br />
        <b>What is synthetic:</b> the corpus — grants, figures, quotes, and documents are illustrative composites built
        on public information about GitLab Foundation grantees, not real records. <br />
        <b>What is stubbed for the demo:</b> Google sign-in (a persona switch stands in), deep-link targets (example
        URLs), and generative answers (extractive by default; set `ANTHROPIC_API_KEY` for the CLI).
      </footer>
    </div>
  );
}

function Dossier({ index, persona }: { index: CorpusIndex; persona: keyof typeof PERSONAS }) {
  const principal = PERSONAS[persona].principal;
  const orgs = useMemo(
    () => index.entities.filter((e) => e.kind === "organization").sort((a, b) => a.label.localeCompare(b.label)),
    [index]
  );
  const [pick, setPick] = useState(orgs[0]?.id ?? "");
  const org = orgs.find((o) => o.id === pick);

  const chunks = useMemo(() => {
    const allowed = new Set(principal.allowedTiers);
    const pr = new Set([`user:${principal.userId}`, ...principal.groups.map((g) => `group:${g}`), "*"]);
    return index.chunks.filter(
      (c) =>
        !c.restrictedStub &&
        c.entities.some((e) => e.kind === "organization" && e.id === pick) &&
        allowed.has(c.tier) &&
        c.acl.some((a) => pr.has(a))
    );
  }, [index, pick, principal]);

  const byDoc = useMemo(() => {
    const m = new Map<string, { title: string; system: string; tier: string; deepLink: string; text: string }>();
    for (const c of chunks) {
      const e = m.get(c.docId) ?? { title: c.docTitle, system: c.system, tier: c.tier, deepLink: c.deepLink, text: "" };
      e.text += (e.text ? "\n" : "") + c.text;
      m.set(c.docId, e);
    }
    return [...m.values()];
  }, [chunks]);

  return (
    <div className="dossier">
      <div className="dossier-pick">
        {orgs.map((o) => (
          <button key={o.id} aria-pressed={o.id === pick} onClick={() => setPick(o.id)}>{o.label}</button>
        ))}
      </div>
      {org && (
        <>
          <h2>{org.label}</h2>
          <div className="geo">assembled from {new Set(byDoc.map((d) => d.system)).size} system(s) · visible to {PERSONAS[persona].label}</div>
          <div className="dossier-sec">
            <h4>Records</h4>
            {byDoc.length === 0 && <div className="rail-empty">Nothing visible to this persona for {org.label}.</div>}
            {byDoc.map((d, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div className="src-title">
                  {d.title}
                  <span className="pill-src">{d.system}</span>
                  {d.tier === "programs-only" && <span className="pill-src">programs-only</span>}
                </div>
                <a className="src-open" href={d.deepLink} target="_blank" rel="noreferrer">↳ open in {d.system} ↗</a>
                <div className="src-snip" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
                  {d.text.slice(0, 500)}
                  {d.text.length > 500 ? "…" : ""}
                </div>
              </div>
            ))}
          </div>
          <div className="dossier-sec" style={{ color: "var(--muted)", fontSize: 12 }}>
            Every line carries the system it came from. In the real product each is a link to the source record, and
            conflicting values across systems are flagged rather than silently merged.
          </div>
        </>
      )}
    </div>
  );
}

function HowItWorks({ index }: { index: CorpusIndex }) {
  const stages: [string, string][] = [
    ["Connect", "One adapter per source (Drive, GivingData, Airtable). Real connectors activate the moment a credential is provided; nothing downstream changes."],
    ["Preserve", "Every document is cleaned, content-hashed, and PII-scanned at intake. Injected instructions and unreadable scans are set aside — and the count is disclosed on every answer."],
    ["Resolve", "Records from different systems are matched to the same grant and organization. Duplicates are collapsed to one authoritative copy; conflicting values are flagged, not merged."],
    ["Retrieve", "Hybrid search (keyword + meaning). The permission filter runs first — as a database WHERE clause — so a passage you may not see is never a candidate. Restricted material is never indexed at all."],
    ["Answer", "An evidence brief: every claim linked to a source you can open, a line stating what was and wasn't searched, and a confidence grade computed from the evidence — coverage, source agreement, freshness, citation completeness — never the model's own certainty."],
    ["Improve", "A gold question set and an adversarial suite gate every change. Feedback feeds the gold set. The system gets better at retrieving and citing — never at deciding."],
  ];
  return (
    <div className="how">
      <p className="intro">
        Compass is a <b>retrieval, permissioning, and citation</b> system, not a chatbot. Every security-critical
        decision is made in deterministic code, outside the language model. The model phrases; it does not decide.
      </p>
      <div className="how-stages">
        {stages.map(([name, desc], i) => (
          <div className="how-stage" key={name}>
            <div className="how-n">{i + 1}</div>
            <div>
              <h4>{name}</h4>
              <p>{desc}</p>
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
            <tr><td>Real</td><td>The pipeline, hybrid retrieval, the per-chunk permission filter (also runnable as SQL), Restricted-tier exclusion, PII scrub + quarantine, content hashing, the evidence-brief schema, the eval + adversarial harness, RS256 OIDC token verification, the HMAC session + revocation, the hash-chained audit log, per-user rate/cost limits, anomaly monitoring.</td></tr>
            <tr><td>Real, opt-in</td><td>Learned embeddings (bge-small, local). The full OIDC login flow (server). Postgres-backed retrieval.</td></tr>
            <tr><td>Stubbed</td><td>The connectors run on a synthetic fictional corpus (real ones implement the same interface). Deep-link targets are example URLs. Answers are extractive; a generative backend is a config value. This page runs retrieval in the browser with a persona switch instead of a login.</td></tr>
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
