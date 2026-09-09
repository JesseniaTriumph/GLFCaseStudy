/**
 * Demo-only source viewer.
 *
 * Citations deep-link to fictional records (`https://airtable.com/appEXAMPLE/…`) that go
 * nowhere. In the demo we instead render the cited document *as Compass indexed it* —
 * post-redaction, post-translation — styled to evoke its source system, with the cited
 * passage highlighted. The real `deepLink` is shown on the page and kept on the citation
 * for the production rewire.
 *
 * This is not a document browser: you can only open a document by its exact id, and only
 * if `canRead` says the calling principal was entitled to retrieve it. A restricted-tier
 * document (indexed as a metadata stub only) returns the same "outside your access" page a
 * query would — it never renders content.
 */
import type { Chunk, CorpusIndex } from "../core/types.js";

interface Args {
  index: CorpusIndex;
  docId: string;
  highlight: string;
  canRead: (chunk: Pick<Chunk, "tier" | "acl">) => boolean;
}

const SYSTEMS: Record<string, { label: string; accent: string; kind: string }> = {
  drive: { label: "Google Drive", accent: "#1a73e8", kind: "Document" },
  givingdata: { label: "GivingData", accent: "#0b7285", kind: "Grant record" },
  airtable: { label: "Airtable", accent: "#e8541c", kind: "Record" },
  "zoom-chat": { label: "Zoom Team Chat", accent: "#2d8cff", kind: "Message thread" },
  notion: { label: "Notion", accent: "#111111", kind: "Page" },
};

export function renderSourcePreview({ index, docId, highlight, canRead }: Args): { status: number; html: string } {
  const chunks = index.chunks.filter((c) => c.docId === docId);
  const content = chunks.filter((c) => !c.restrictedStub);
  const stub = chunks.find((c) => c.restrictedStub);

  // Restricted (or nothing the caller may read): the same answer a query gets — no content.
  if (content.length === 0 || !canRead(content[0]!)) {
    const restricted = Boolean(stub) || content.length > 0;
    return {
      status: restricted ? 403 : 404,
      html: page(
        restricted ? "Outside your access" : "Not found",
        `<div class="card"><h1>${restricted ? "This source is outside your approved access" : "No such source"}</h1>
         <p>${
           restricted
             ? "Compass did not retrieve or inspect this document. If you believe you should have access, raise it with the data owner (the COO's office)."
             : "That document id doesn't match anything in the current corpus."
         }</p>
         <p class="back"><a href="/">← back to Compass</a></p></div>`,
        "#b42318"
      ),
    };
  }

  const first = content[0]!;
  const sys = SYSTEMS[first.system] ?? { label: first.system, accent: "#555", kind: "Record" };
  const body = content
    .slice()
    .sort((a, b) => seq(a.id) - seq(b.id))
    .map((c) => c.text)
    .join("\n\n");

  const tierLabel = first.tier === "programs-only" ? "Programs-only" : "Team";
  const translated = content.find((c) => c.translated);

  return {
    status: 200,
    html: page(
      `${first.docTitle} — ${sys.label} (demo)`,
      `<div class="banner">
         <b>Demo preview.</b> This is the document <i>as Compass indexed it</i>${
           translated ? ` — machine-translated from ${escapeHtml(translated.sourceLang ?? "another language")}, personal identifiers removed at intake` : ", personal identifiers removed at intake"
         }. In production, <b>Open in ${escapeHtml(sys.label)}</b> opens the live record:
         <a href="${escapeHtml(first.deepLink)}" rel="noreferrer nofollow">${escapeHtml(first.deepLink)}</a>
       </div>
       <div class="chrome" style="--accent:${sys.accent}">
         <div class="chrome-top"><span class="sys">${escapeHtml(sys.label)}</span><span class="kind">${escapeHtml(sys.kind)}</span>
           <span class="tier ${first.tier === "programs-only" ? "p" : ""}">${tierLabel}</span></div>
         <h1>${escapeHtml(first.docTitle)}</h1>
         <div class="doc">${renderBody(body, highlight)}</div>
       </div>
       <p class="back"><a href="/">← back to Compass</a></p>
       <script>
         var m = document.getElementById('hl');
         if (m) m.scrollIntoView({ block: 'center' });
       </script>`,
      sys.accent
    ),
  };
}

const seq = (chunkId: string) => Number(chunkId.split("#")[1] ?? 0);

/** Wrap the first occurrence of the highlight (or a loose prefix of it) in <mark id="hl">. */
function renderBody(text: string, highlight: string): string {
  const esc = escapeHtml(text);
  const needleRaw = highlight.trim();
  if (needleRaw) {
    for (const cand of [needleRaw, needleRaw.slice(0, 60), needleRaw.split(/[.!?]/)[0] ?? ""]) {
      const needle = escapeHtml(cand.trim());
      if (needle.length < 8) continue;
      const at = esc.toLowerCase().indexOf(needle.toLowerCase());
      if (at !== -1) {
        return (
          paras(esc.slice(0, at)) +
          `<mark id="hl">${esc.slice(at, at + needle.length)}</mark>` +
          paras(esc.slice(at + needle.length))
        );
      }
    }
  }
  return paras(esc);
}

const paras = (s: string) =>
  s
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function page(title: string, inner: string, accent: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         background: #f6f7f9; color: #1a1a1a; padding: 24px; }
  @media (prefers-color-scheme: dark) { body { background: #16181d; color: #e8e8ea; } .chrome, .card { background: #1f2228 !important; border-color: #333 !important; } .banner { background: #24252b !important; color: #cfcfd4 !important; } .doc { color: #dcdce0 !important; } }
  .banner { max-width: 760px; margin: 0 auto 16px; background: #fff7ed; border: 1px solid #fed7aa;
            border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #7c2d12; }
  .banner a { color: inherit; word-break: break-all; }
  .chrome, .card { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e3e5e9;
                   border-radius: 10px; overflow: hidden; }
  .chrome { border-top: 3px solid ${accent}; }
  .card { padding: 28px; }
  .chrome-top { display: flex; gap: 10px; align-items: center; padding: 10px 20px; border-bottom: 1px solid #eee;
                font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #667; }
  .chrome-top .sys { font-weight: 700; color: ${accent}; }
  .chrome-top .tier { margin-left: auto; border: 1px solid #cbd5e1; border-radius: 999px; padding: 1px 8px; }
  .chrome-top .tier.p { border-color: ${accent}; color: ${accent}; }
  .chrome h1 { font-size: 20px; margin: 18px 20px 4px; }
  .card h1 { font-size: 19px; margin: 0 0 8px; }
  .doc { padding: 8px 20px 24px; color: #2a2a2a; white-space: normal; }
  .doc p { margin: 0 0 12px; }
  mark#hl { background: ${accent}22; box-shadow: 0 0 0 2px ${accent}55; border-radius: 2px; padding: 1px 2px; }
  .back { max-width: 760px; margin: 16px auto 0; font-size: 13px; }
  a { color: ${accent}; }
</style></head><body>${inner}</body></html>`;
}
