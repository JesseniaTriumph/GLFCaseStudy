/**
 * Offline-mode smoke: the web app served by a dumb static host (no /api) must run retrieval
 * in the browser using the shared `src/` modules — answer + citations, restricted refusal,
 * the dossier tab, no console errors. Point BASE at a static server serving web/dist + corpus-index.json.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = process.env.BASE || "http://localhost:8796";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9224;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, "--no-first-run", "about:blank"]);
process.on("exit", () => chrome.kill());

let tgt;
for (let i = 0; i < 40 && !tgt; i++) {
  try { tgt = (await (await fetch(`http://localhost:${PORT}/json`)).json()).find((t) => t.type === "page"); } catch { await sleep(250); }
}
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) return pend.get(m.id)(m), pend.delete(m.id);
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console.error: " + m.params.args.map((a) => a.value || a.description).join(" "));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send("Page.enable"); await send("Runtime.enable");

let pass = 0, fail = 0;
const check = (label, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${label}${cond ? "" : "  " + extra}`); };

await send("Page.navigate", { url: BASE });
await sleep(2500);

const mode = await ev(`(window).__probe = document.body.innerText.length; document.querySelector('#root')?.innerText.length`);
check("app rendered (offline)", mode > 40, `root len ${mode}`);
const footer = await ev(`document.querySelector('footer')?.innerText || ''`);
check("running in offline/static mode", /retrieval runs in the browser|static host|persona switch/i.test(footer), footer.slice(0, 80));

// ask a real question
await ev(`(()=>{const el=document.querySelector('.askbar input');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(el,'How did Riverbend Care Collective perform against what they projected?');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await sleep(150);
await ev(`document.querySelector('.askbar button[type=submit]')?.click()`);
await sleep(1500);
const ans1 = await ev(`document.querySelector('.answer-card')?.innerText || ''`);
const cites = await ev(`document.querySelectorAll('.rail a.src, aside a').length`);
check("offline: a supported question returns an answer", ans1.length > 60, `len ${ans1.length}`);
check("offline: the answer has citations", cites >= 1, `${cites} citations`);

// restricted question must still refuse (this is the drift-prone path)
await ev(`(()=>{const el=document.querySelector('.askbar input');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(el,'What did the board discuss about staff compensation?');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await sleep(150);
await ev(`document.querySelector('.askbar button[type=submit]')?.click()`);
await sleep(1400);
const conf = await ev(`document.querySelector('.conf')?.innerText || ''`);
const body = await ev(`document.querySelector('.answer-body')?.innerText || ''`);
check("offline: board-compensation question is REFUSED", /refused/i.test(conf), `conf: ${conf}`);
check("offline: nothing restricted leaked", !/salary band|compensation review/i.test(body));

// legal question — the exact case that had drifted out of the web copy
await ev(`(()=>{const el=document.querySelector('.askbar input');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(el,'What confidentiality clause did counsel advise on for Riverbend?');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await sleep(150);
await ev(`document.querySelector('.askbar button[type=submit]')?.click()`);
await sleep(1400);
const conf2 = await ev(`document.querySelector('.conf')?.innerText || ''`);
check("offline: privileged-legal question is REFUSED (was drifted out)", /refused/i.test(conf2), `conf: ${conf2}`);

// dossier tab
await ev(`[...document.querySelectorAll('nav button, [role=tab]')].find(b=>/dossier/i.test(b.textContent))?.click()`);
await sleep(700);
const dossier = await ev(`document.querySelector('.dossier')?.innerText.length || 0`);
check("offline: Grantee dossier tab renders", dossier > 50, `len ${dossier}`);
await ev(`document.querySelectorAll('.dossier-pick button')[2]?.click()`);
await sleep(400);
check("offline: dossier grantee drill-down works", (await ev(`document.querySelector('.dossier h2')?.innerText.length || 0`)) > 0);

// how it works
await ev(`[...document.querySelectorAll('nav button, [role=tab]')].find(b=>/how it works/i.test(b.textContent))?.click()`);
await sleep(500);
check("offline: How it works tab renders", (await ev(`document.querySelector('.how')?.innerText.length || 0`)) > 100);

console.log(`\n${pass}/${pass + fail} offline checks OK`);
if (errors.length) console.log("console errors:\n  " + [...new Set(errors)].join("\n  "));
ws.close(); chrome.kill();
process.exit(fail ? 1 : 0);
