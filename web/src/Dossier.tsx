import { useMemo, useState } from "react";
import type { CorpusIndex } from "@compass/core/types.js";
import { grantCycle } from "@compass/grant-cycle.js";
import { PERSONAS } from "./principals.js";

/** Grantee dossier — "renewal prep in one view". Reads the client corpus index, filtered
 *  to what the selected persona may see, and assembles each grant's status + own cycle,
 *  projected-vs-reported, a relationship timeline and the other records. */
export function Dossier({ index, persona, serverMode }: { index: CorpusIndex; persona: keyof typeof PERSONAS; serverMode: boolean | null }) {
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
