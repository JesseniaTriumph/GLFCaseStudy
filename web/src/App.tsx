import React, { useEffect, useMemo, useState } from "react";
import { answerQuestion } from "@compass/retrieval/answer.js";
import type { Answer, CorpusIndex } from "@compass/core/types.js";
import { PERSONAS } from "./principals.js";

const EXAMPLES = [
  "How did Carina perform against what they projected, and did the program officer flag anything?",
  "What are the biggest barriers to credential completion across our grantees?",
  "Have we funded nuclear-maintenance training in Appalachia?",
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
  const [tab, setTab] = useState<"ask" | "dossier">("ask");
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

  useEffect(() => {
    fetch("./corpus-index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("index not found — run `npm run build:index`"))))
      .then(setIndex)
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("compass.deepdive", deepDive ? "on" : "off");
    } catch {
      /* ignore */
    }
  }, [deepDive]);

  async function ask(question: string) {
    if (!index || !question.trim()) return;
    setBusy(true);
    setActiveCite(null);
    setFb(null);
    setExternal(false);
    const a = await answerQuestion(index, question.trim(), PERSONAS[persona].principal, { followUps: deepDive });
    setAns(a);
    setQ(question);
    setBusy(false);
  }

  // re-run when persona or deepDive changes and there's a live question
  useEffect(() => {
    if (ans && q) void ask(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, deepDive]);

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
        <span className="lbl">Corpus</span>
        <span className="chip"><span className="dot" /> GivingData <span className="rng">
          {index.coverage.dateRange ? `${index.coverage.dateRange[0]?.slice(0, 4)}–${index.coverage.dateRange[1]?.slice(0, 4)}` : ""}
        </span></span>
        <span className="chip"><span className="dot" /> Google Drive</span>
        <span className="chip"><span className="dot" /> Airtable</span>
        <span className="chip off"><span className="dot" /> Zoom Chat <span className="rng">not connected</span></span>
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

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "ask"} onClick={() => setTab("ask")}>Ask</button>
        <button role="tab" aria-selected={tab === "dossier"} onClick={() => setTab("dossier")}>Grantee dossier</button>
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
                      <label className="vt">
                        <input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} />
                        mark for external use
                      </label>
                    )}
                    <span className="fb">
                      <button aria-pressed={fb === "up"} onClick={() => setFb(fb === "up" ? null : "up")} title="Useful">▲</button>
                      <button aria-pressed={fb === "down"} onClick={() => setFb(fb === "down" ? null : "down")} title="Wrong / incomplete">▼</button>
                    </span>
                  </div>
                  {external && (
                    <div className="vbanner">
                      Verify each figure against its cited source before this leaves the building. Logged to the evaluation set.
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
