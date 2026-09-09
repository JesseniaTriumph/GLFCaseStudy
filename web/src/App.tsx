import React, { useEffect, useMemo, useState } from "react";
import { answerQuestion } from "@compass/retrieval/answer.js";
import type { Answer, CorpusIndex } from "@compass/core/types.js";
import { grantCycle } from "@compass/grant-cycle.js";
import { PERSONAS, personaFunctions } from "./principals.js";

const EXAMPLES = [
  "How did Riverbend Care Collective perform against what they projected, and did the program officer flag anything?",
  "What are the biggest barriers to credential completion across our grantees?",
  "Have we funded advanced-energy maintenance training for rural workers?",
  "Did we decline an AI-upskilling applicant recently, and why?",
  "What did the board discuss about staff compensation?",
];

type Theme = "light" | "dark";

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("compass.theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      /* ignore */
    }
    try {
      // honour the OS on a first visit; fall back to dark (matches the Foundation's impact pages)
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("compass.theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return { theme, toggle };
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

type Me = { email: string; name?: string; groups: string[] };
type ServerCfg = { oauthConfigured: boolean; demoLogin: boolean };

export function App() {
  const { theme, toggle } = useTheme();
  const [index, setIndex] = useState<CorpusIndex | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // null = still probing; true = an API server is serving this page (answers go through it);
  // false = static host, retrieval runs in the browser with the persona switch.
  const [serverMode, setServerMode] = useState<boolean | null>(null);
  const [cfg, setCfg] = useState<ServerCfg | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [needAuth, setNeedAuth] = useState(false);
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

  // Is this page served by the Compass API, or by a static host?
  useEffect(() => {
    let done = false;
    fetch("/api/config", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(async (c: ServerCfg) => {
        done = true;
        setCfg(c);
        setServerMode(true);
        let m: Me | null = await fetch("/api/me", { credentials: "include" }).then((r) => (r.ok ? r.json() : null));
        // start the demo already signed in as the default persona, so the first question
        // just works — real Google sign-in (when configured) is one click from the bar
        if (!m && c.demoLogin) {
          await fetch(`/auth/demo?persona=${persona}`, { headers: { accept: "application/json" }, credentials: "include" });
          m = await fetch("/api/me", { credentials: "include" }).then((r) => (r.ok ? r.json() : null));
        }
        setMe(m);
      })
      .catch(() => {
        if (!done) setServerMode(false);
      });
  }, []);

  // The corpus index still backs the Grantee dossier + How-it-works views in both modes,
  // and drives retrieval in offline mode. A miss is only fatal offline.
  useEffect(() => {
    if (serverMode === null) return;
    fetch("./corpus-index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("index not found — run `npm run build:index`"))))
      .then(setIndex)
      .catch((e) => {
        if (!serverMode) setErr(String(e));
      });
  }, [serverMode]);

  useEffect(() => {
    try {
      localStorage.setItem("compass.deepdive", deepDive ? "on" : "off");
      localStorage.setItem("compass.rolectx", roleCtx ? "on" : "off");
    } catch {
      /* ignore */
    }
  }, [deepDive, roleCtx]);

  async function ask(question: string) {
    if (!question.trim() || serverMode === null) return;
    setBusy(true);
    setActiveCite(null);
    setFb(null);
    setExternal(false);
    setNeedAuth(false);
    try {
      let a: Answer;
      if (serverMode) {
        const r = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ question: question.trim(), deepDive, roleContext: roleCtx }),
        });
        if (r.status === 401) {
          setNeedAuth(true);
          setAns(null);
          return;
        }
        if (!r.ok) {
          const e = (await r.json().catch(() => ({}))) as { error?: string };
          setErr(e.error || `server error ${r.status}`);
          return;
        }
        a = (await r.json()) as Answer;
      } else {
        if (!index) return;
        a = await answerQuestion(index, question.trim(), PERSONAS[persona].principal, {
          followUps: deepDive,
          roleContext: roleCtx ? { functions: personaFunctions(persona) } : undefined,
        });
      }
      setAns(a);
      setQ(question);
    } finally {
      setBusy(false);
    }
  }

  // Thumbs up / down → POST to /api/feedback (server mode) so the signal reaches
  // eval/feedback.jsonl, which `npm run tune` reads. A no-op on a static host.
  async function sendFeedback(verdict: "up" | "down") {
    const next = fb === verdict ? null : verdict;
    setFb(next);
    if (!next || !serverMode || !ans) return;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question: ans.question, answerText: ans.text.slice(0, 400), verdict: next }),
      });
    } catch {
      /* best effort — the local state still reflects the click */
    }
  }

  // Server mode: switching persona means signing in as that fictional user, so the real
  // server-side permission filter re-runs. Offline mode: it's a local principal swap.
  async function switchPersona(key: keyof typeof PERSONAS) {
    setPersona(key);
    if (serverMode && cfg?.demoLogin) {
      await fetch(`/auth/demo?persona=${encodeURIComponent(key)}`, {
        headers: { accept: "application/json" },
        credentials: "include",
      });
      const m = await fetch("/api/me", { credentials: "include" }).then((r) => (r.ok ? r.json() : null));
      setMe(m);
    }
  }

  // re-run when persona / deepDive / roleCtx changes and there's a live question
  useEffect(() => {
    if ((ans || needAuth) && q) void ask(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, me, deepDive, roleCtx]);

  const orgs = useMemo(() => {
    if (!index) return [];
    return index.entities.filter((e) => e.kind === "organization").sort((a, b) => a.label.localeCompare(b.label));
  }, [index]);

  if (err) return <div className="shell"><div className="loading">{err}</div></div>;
  if (serverMode === null) return <div className="shell"><div className="loading">Connecting…</div></div>;
  if (!index) return <div className="shell"><div className="loading">Loading corpus…</div></div>;

  const tiersOf = (groups: string[]) => {
    const g = new Set(groups.map((x) => x.toLowerCase()));
    const P = ["programs", "program-ops", "impact", "impact-measurement", "impact-director", "leadership", "ceo", "coo", "operations", "partnerships", "donor-engagement", "finance", "accounting", "grants-ops", "grants-compliance", "legal", "counsel"];
    return [...g].some((x) => P.includes(x)) ? "team + programs-only" : "team";
  };

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
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggle}
          >
            {theme === "dark" ? "☀" : "☾"}
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
        <select className="persona" value={persona} onChange={(e) => void switchPersona(e.target.value as keyof typeof PERSONAS)}>
          {Object.entries(PERSONAS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {serverMode ? (
          <span className="persona-note">
            {me ? (
              <>
                <b>{me.name ?? me.email}</b> · access: {tiersOf(me.groups)} · every answer runs through the server-side
                permission filter{me.email.endsWith(".example") ? " (demo sign-in)" : ""}
              </>
            ) : needAuth ? (
              <>not signed in — pick a persona above{cfg?.oauthConfigured ? <> or <a href="/auth/login">sign in with Google</a></> : ""}</>
            ) : (
              <>{PERSONAS[persona].note}</>
            )}
            {cfg?.oauthConfigured && me && !me.email.endsWith(".example") && <> · <a href="/auth/logout">sign out</a></>}
          </span>
        ) : (
          <span className="persona-note">{PERSONAS[persona].note} · retrieval runs in your browser here; in production this is Google sign-in on the server</span>
        )}
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
                  <div className="coverage">{ans.coverage}</div>
                  <div className="meta">
                    <span className={"conf " + ans.confidence}>● {ans.confidence} — {ans.confidenceReason}</span>
                    {ans.confidence !== "refused" && (
                      <button type="button" className={"vt" + (external ? " on" : "")} onClick={() => setExternal(!external)}>
                        Request external-use review
                      </button>
                    )}
                    <span className="fb">
                      <button aria-pressed={fb === "up"} onClick={() => void sendFeedback("up")} title="Useful">▲</button>
                      <button aria-pressed={fb === "down"} onClick={() => void sendFeedback("down")} title="Wrong / incomplete">▼</button>
                      {fb && <span className="fb-ack">thanks — logged</span>}
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
                        {ans.followUps.cycle && ans.followUps.cycle.length > 0 && (
                          <div className="dd-g">
                            <h5>Where each grant is in its own cycle</h5>
                            <ul>
                              {ans.followUps.cycle.map((c, i) => (
                                <li key={i}>
                                  <b>{c.organization ?? c.grantId}</b> <span className="pill-src">{c.stage}</span> {c.summary}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
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
                    href={c.previewLink ?? c.deepLink}
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
                    <div className="src-open">
                      {c.previewLink ? `↳ open the ${c.system} record, this passage highlighted ↗` : `↳ opens in ${c.system}, this passage highlighted ↗`}
                    </div>
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

      {tab === "dossier" &&
        (index ? (
          <Dossier index={index} persona={persona} serverMode={serverMode} />
        ) : (
          <div className="rail-empty">Loading the corpus index…</div>
        ))}
      {tab === "how" &&
        (index ? <HowItWorks index={index} /> : <div className="rail-empty">Loading the corpus index…</div>)}

      <footer>
        <b>What runs here:</b>{" "}
        {serverMode
          ? "answers come from the Compass API on this same origin — every request carries your session, runs through the server-side permission filter, is rate-limited and written to the tamper-evident audit log. The permission boundary is real; only the identity provider is stubbed when you use a demo persona."
          : "the real pipeline output (`corpus-index.json`) with in-browser hybrid retrieval and the retrieval-time permission filter — the same modules as the CLI and eval harness. On a static host like this one the filter runs client-side; the server build enforces it before anything reaches the browser."}
        <br />
        <b>What is synthetic:</b> the corpus — grants, figures, quotes, and documents are illustrative composites built
        on public information about GitLab Foundation grantees, not real records. <br />
        <b>What is stubbed:</b> {serverMode ? "the identity provider (a demo persona stands in for Google sign-in unless it's configured)" : "Google sign-in (a persona switch stands in)"}, and generative answers
        (extractive by default; a zero-retention model is a config value). Citation links open a Compass-rendered
        view of the record — permission-checked — because the source-system URLs are fictional; against the live
        systems the same link lands in the record.
      </footer>
    </div>
  );
}

function Dossier({ index, persona, serverMode }: { index: CorpusIndex; persona: keyof typeof PERSONAS; serverMode: boolean | null }) {
  const principal = PERSONAS[persona].principal;
  const allowed = new Set<string>(principal.allowedTiers);
  const pr = new Set([`user:${principal.userId}`, ...principal.groups.map((g) => `group:${g}`), "*"]);
  const canRead = (c: { restrictedStub?: boolean; tier: string; acl: string[] }) =>
    !c.restrictedStub && allowed.has(c.tier) && c.acl.some((a) => pr.has(a));

  const orgs = useMemo(
    () => index.entities.filter((e) => e.kind === "organization").sort((a, b) => a.label.localeCompare(b.label)),
    [index]
  );
  const [q, setQ] = useState("");
  const shown = orgs.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  const [pick, setPick] = useState(orgs[0]?.id ?? "");
  const org = orgs.find((o) => o.id === pick);

  const chunks = useMemo(
    () => index.chunks.filter((c) => c.entities.some((e) => e.kind === "organization" && e.id === pick) && canRead(c)),
    [index, pick, persona]
  );

  // this org's grants + where each one is in its own cycle
  const grants = useMemo(() => {
    const ids = new Set<string>();
    for (const c of chunks) for (const e of c.entities) if (e.kind === "grant") ids.add(e.id);
    return [...ids]
      .map((gid) => {
        const meta = index.grantMeta?.[gid];
        const cyc = meta ? grantCycle({ grantId: gid, ...meta }) : null;
        const factSheet = chunks.find((c) => c.docTitle.startsWith("Grant fact sheet") && c.docId.includes(gid));
        const reported = chunks.filter((c) => /reported results|progress report/i.test(c.docTitle) && c.docId.includes(gid));
        return { gid, meta, cyc, factSheet, reported };
      })
      .sort((a, b) => a.gid.localeCompare(b.gid));
  }, [chunks, index]);

  const interactions = chunks
    .filter((c) => /— (Call|Email|Site visit|Check-in|Interaction)/i.test(c.docTitle) || c.docTitle.includes("thread"))
    .map((c) => ({ title: c.docTitle, date: c.date, text: c.text, system: c.system, link: c.deepLink }))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const otherDocs = useMemo(() => {
    const m = new Map<string, { title: string; system: string; tier: string; deepLink: string; docId: string; text: string }>();
    for (const c of chunks) {
      if (c.docTitle.startsWith("Grant fact sheet") || /reported results|progress report|— (Call|Email|Site visit|Check-in)/i.test(c.docTitle)) continue;
      const e = m.get(c.docId) ?? { title: c.docTitle, system: c.system, tier: c.tier, deepLink: c.deepLink, docId: c.docId, text: "" };
      e.text += (e.text ? "\n" : "") + c.text;
      m.set(c.docId, e);
    }
    return [...m.values()];
  }, [chunks]);

  // Demo: server-rendered source viewer when we're talking to the API; the fictional
  // deepLink otherwise. Production leaves previewLink unset and deepLink opens the record.
  const srcHref = (docId: string, deepLink: string) => (serverMode ? `/s/${encodeURIComponent(docId)}` : deepLink);

  const num = (t: string, re: RegExp) => {
    const m = t.match(re);
    return m ? m[1] : null;
  };

  return (
    <div className="dossier">
      <input
        className="dossier-search"
        placeholder="Filter grantees…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Filter grantees"
      />
      <div className="dossier-pick">
        {shown.map((o) => (
          <button key={o.id} aria-pressed={o.id === pick} onClick={() => setPick(o.id)}>{o.label}</button>
        ))}
        {shown.length === 0 && <span className="rail-empty">No grantee matches “{q}”.</span>}
      </div>

      {org && (
        <>
          <h2>{org.label}</h2>
          <div className="geo">
            assembled from {new Set(chunks.map((c) => c.system)).size} system(s) · {grants.length} grant(s) ·
            visible to {PERSONAS[persona].label}
          </div>

          {grants.length > 0 && (
            <div className="dossier-sec">
              <h4>Grants — status &amp; cycle</h4>
              {grants.map(({ gid, meta, cyc, factSheet, reported }) => {
                const proj = meta?.projected ?? null;
                const rep = reported[reported.length - 1]?.text ?? "";
                const repP = num(rep, /Participants reached:\s*([\d,]+)/i);
                const status = meta?.grantStatus ?? "—";
                const showStage = cyc && cyc.stage !== status.toLowerCase();
                return (
                  <div key={gid} className="dossier-grant">
                    <div className="src-title">
                      {gid}
                      {meta?.fund && <span className="pill-src">{meta.fund.replace(/ Fund$/, "")}</span>}
                      <span className="pill-src">{status}</span>
                      {showStage && <span className="pill-src">{cyc!.stage}</span>}
                    </div>
                    {cyc && <div className="dossier-cycle">{cyc.summary}</div>}
                    <div className="dossier-vs">
                      {proj?.northStar != null && <span>North Star (projected) <b>{proj.northStar}×</b></span>}
                      {proj?.participants != null && repP && (
                        <span>
                          participants <b>{Number(repP.replace(/,/g, "")).toLocaleString()}</b> reported vs{" "}
                          <b>{proj.participants.toLocaleString()}</b> projected
                        </span>
                      )}
                      {proj?.participants != null && !repP && (
                        <span>projected <b>{proj.participants.toLocaleString()}</b> participants · no results filed yet</span>
                      )}
                      {!proj?.participants && !repP && <span className="dossier-muted">no projection on file (pre-migration grant)</span>}
                    </div>
                    {factSheet && (
                      <a className="src-open" href={srcHref(factSheet.docId, factSheet.deepLink)} target="_blank" rel="noreferrer">
                        ↳ open the grant record ↗
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {interactions.length > 0 && (
            <div className="dossier-sec">
              <h4>Relationship timeline</h4>
              {interactions.slice(0, 8).map((it, i) => (
                <div key={i} className="dossier-tl">
                  <span className="dossier-tl-date">{it.date ?? "—"}</span>
                  <span>
                    <b>{it.title.replace(/^.*— /, "")}</b> <span className="pill-src">{it.system}</span>
                    <div className="src-snip">{it.text.replace(/^#.*\n/, "").slice(0, 240)}</div>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="dossier-sec">
            <h4>Other records</h4>
            {otherDocs.length === 0 && <div className="rail-empty">None visible to this persona.</div>}
            {otherDocs.map((d, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div className="src-title">
                  {d.title}
                  <span className="pill-src">{d.system}</span>
                  {d.tier === "programs-only" && <span className="pill-src">programs-only</span>}
                </div>
                <a className="src-open" href={srcHref(d.docId, d.deepLink)} target="_blank" rel="noreferrer">↳ open in {d.system} ↗</a>
                <div className="src-snip" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
                  {d.text.slice(0, 380)}
                  {d.text.length > 380 ? "…" : ""}
                </div>
              </div>
            ))}
          </div>

          <div className="dossier-sec" style={{ color: "var(--muted)", fontSize: 12 }}>
            Every line carries the system it came from and links to the source record. Cycle status is computed from each
            grant's own requirement schedule. Conflicting values across systems are flagged in an answer, not merged.
          </div>
        </>
      )}
    </div>
  );
}

function HowItWorks({ index }: { index: CorpusIndex }) {
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
