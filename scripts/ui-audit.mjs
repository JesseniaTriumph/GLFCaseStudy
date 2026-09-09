/**
 * Front-to-back UI audit. Drives the real web app in headless Chrome via CDP:
 * clicks every tab, example, toggle, persona, citation, feedback control and dossier
 * button, and after each interaction asserts the app still rendered (root has text),
 * no uncaught error fired, and no request 4xx/5xx'd.
 *
 *   BASE=http://localhost:8791 node scripts/ui-audit.mjs
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = process.env.BASE || "http://localhost:8791";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9223;

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`,
  "--no-first-run", "--no-default-browser-check", "--window-size=1400,1000",
  "about:blank",
]);
process.on("exit", () => chrome.kill());

async function cdpTargets() {
  for (let i = 0; i < 40; i++) {
    try { return await (await fetch(`http://localhost:${PORT}/json`)).json(); }
    catch { await sleep(250); }
  }
  throw new Error("chrome CDP never came up");
}

const targets = await cdpTargets();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const failedRequests = [];
const requestUrls = new Map();

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") {
    consoleErrors.push("EXCEPTION: " + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    consoleErrors.push("console.error: " + m.params.args.map((a) => a.value || a.description || "").join(" "));
  }
  if (m.method === "Network.requestWillBeSent") requestUrls.set(m.params.requestId, m.params.request.url);
  if (m.method === "Network.responseReceived") {
    const { status, url } = m.params.response;
    // 401 /api/me before a persona is picked is the app correctly reporting "no session yet"
    const expected = status === 401 && url.endsWith("/api/me");
    if (status >= 400 && !expected) failedRequests.push(`${status} ${url}`);
  }
};
const send = (method, params = {}) => {
  const id = ++msgId;
  return new Promise((res) => { pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
};
const evalJS = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "eval threw");
  return r.result?.result?.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

const results = [];
const check = async (label, fn) => {
  const errBefore = consoleErrors.length, reqBefore = failedRequests.length;
  try {
    await fn();
    await sleep(350);
    const rootLen = await evalJS(`(document.querySelector('#root')?.innerText || '').trim().length`);
    const newErr = consoleErrors.slice(errBefore);
    const newReq = failedRequests.slice(reqBefore).filter((r) => !r.includes("/favicon") && !r.includes("/s/does-not"));
    const ok = rootLen > 40 && newErr.length === 0 && newReq.length === 0;
    results.push({ label, ok, rootLen, err: newErr, req: newReq });
    console.log(`${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${label}${ok ? "" : `  — root:${rootLen} ${newErr.join("; ")} ${newReq.join("; ")}`}`);
  } catch (e) {
    results.push({ label, ok: false, err: [String(e.message)] });
    console.log(`\x1b[31m✗\x1b[0m ${label}  — ${e.message}`);
  }
};

const clickSel = (sel, n = 0) => `document.querySelectorAll(${JSON.stringify(sel)})[${n}]?.click()`;

// ---- load ----
await send("Page.navigate", { url: BASE });
await sleep(1500);
await check("initial load (Ask tab)", async () => {});

// ---- persona switch: every persona ----
const personas = await evalJS(`[...document.querySelectorAll('select')].map(s=>s.id).length ? [...document.querySelector('select')?.options||[]].map(o=>o.value) : []`);
for (const p of personas) {
  await check(`persona → ${p}`, async () => {
    await evalJS(`(() => { const s=document.querySelector('select'); s.value=${JSON.stringify(p)}; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  });
}

// ---- example questions ----
const exampleCount = await evalJS(`document.querySelectorAll('.prompts button').length`);
for (let i = 0; i < exampleCount; i++) {
  await check(`example question #${i + 1}`, async () => {
    await evalJS(clickSel(".prompts button", i));
    await sleep(1400);
  });
}

// ---- ask a typed question (as a Program Officer, so there are citations to click) ----
await check("type + submit a question", async () => {
  await evalJS(`(() => { const s=document.querySelector('select'); if(s){ s.value='programs'; s.dispatchEvent(new Event('change',{bubbles:true})); } })()`);
  await sleep(600);
  await evalJS(`(() => {
    const el = document.querySelector('.askbar input');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, 'How did Riverbend Care Collective perform against projection?');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(200);
  await evalJS(`document.querySelector('.askbar button[type=submit]')?.click()`);
  await sleep(1600);
});

// ---- deep dive + role toggles ----
for (const t of ["Deep dive", "role", "cycle", "context"]) {
  const hit = await evalJS(`!!([...document.querySelectorAll('button, label, input[type=checkbox]')].find(e => e.textContent.toLowerCase().includes(${JSON.stringify(t.toLowerCase())})))`);
  if (hit) await check(`toggle "${t}"`, async () => {
    await evalJS(`[...document.querySelectorAll('button, label')].find(e => e.textContent.toLowerCase().includes(${JSON.stringify(t.toLowerCase())}))?.click()`);
    await sleep(900);
  });
}

// ---- citation links (open each /s/ view in the page; assert it renders the source) ----
const cookieHeader = async () => {
  const { result } = await send("Network.getAllCookies");
  return (result.cookies || []).map((c) => `${c.name}=${c.value}`).join("; ");
};
const citeSel = ".rail a.src, aside a.src, aside a";
const citeCount = await evalJS(`document.querySelectorAll(${JSON.stringify(citeSel)}).length`);
for (let i = 0; i < Math.min(citeCount, 10); i++) {
  await check(`citation link #${i + 1}`, async () => {
    const href = await evalJS(`document.querySelectorAll(${JSON.stringify(citeSel)})[${i}]?.getAttribute('href')`);
    if (!href) throw new Error("no href");
    if (href.startsWith("/s/")) {
      const r = await fetch(BASE + href, { headers: { cookie: await cookieHeader() }, redirect: "manual" });
      if (r.status !== 200) throw new Error(`${r.status} on ${href}`);
      const html = await r.text();
      if (!/Demo preview|source is outside your approved access/.test(html)) throw new Error("preview page missing banner");
      if (!/<mark id="hl">/.test(html) && !/source is outside/.test(html)) throw new Error("no highlight");
    } else if (!/^https?:\/\//.test(href)) {
      throw new Error(`unexpected citation href: ${href}`);
    }
  });
}

// ---- feedback thumbs ----
for (const fb of ["up", "down", "👍", "👎", "helpful", "wrong"]) {
  const hit = await evalJS(`!!([...document.querySelectorAll('button')].find(e => (e.getAttribute('aria-label')||e.textContent||'').toLowerCase().includes(${JSON.stringify(fb)})))`);
  if (hit) { await check(`feedback "${fb}"`, async () => {
    await evalJS(`[...document.querySelectorAll('button')].find(e => (e.getAttribute('aria-label')||e.textContent||'').toLowerCase().includes(${JSON.stringify(fb)}))?.click()`);
    await sleep(600);
  }); break; }
}

// ---- Grantee dossier tab ----
await check("open Grantee dossier tab", async () => {
  await evalJS(`[...document.querySelectorAll('[role=tab], .tabs button, nav button')].find(e => /dossier/i.test(e.textContent))?.click()`);
  await sleep(800);
});
// each grantee button
const granteeCount = await evalJS(`document.querySelectorAll('.dossier-pick button').length`);
for (let i = 0; i < Math.min(granteeCount, 12); i++) {
  await check(`dossier grantee #${i + 1} (${await evalJS(`document.querySelectorAll('.dossier-pick button')[${i}]?.textContent?.trim()`)})`, async () => {
    await evalJS(clickSel(".dossier-pick button", i));
    await sleep(500);
  });
}
// dossier filter
await check("dossier filter input", async () => {
  await evalJS(`(() => { const s=document.querySelector('.dossier-search'); s.value='riv'; s.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await sleep(400);
  await evalJS(`(() => { const s=document.querySelector('.dossier-search'); s.value=''; s.dispatchEvent(new Event('input',{bubbles:true})); })()`);
});
// dossier source links
const dossierLinks = await evalJS(`document.querySelectorAll('.dossier a.src-open').length`);
for (let i = 0; i < Math.min(dossierLinks, 8); i++) {
  await check(`dossier source link #${i + 1}`, async () => {
    const href = await evalJS(`document.querySelectorAll('.dossier a.src-open')[${i}]?.getAttribute('href')`);
    if (href?.startsWith("/s/")) {
      const r = await fetch(BASE + href, { headers: { cookie: await evalJS("document.cookie") } });
      if (!r.ok) throw new Error(`${r.status} on ${href}`);
    }
  });
}

// ---- How it works tab ----
await check("open How it works tab", async () => {
  await evalJS(`[...document.querySelectorAll('[role=tab], .tabs button, nav button')].find(e => /how it works/i.test(e.textContent))?.click()`);
  await sleep(600);
});

// ---- back to Ask ----
await check("back to Ask tab", async () => {
  await evalJS(`[...document.querySelectorAll('[role=tab], .tabs button, nav button')].find(e => e.textContent.trim() === 'Ask')?.click()`);
  await sleep(600);
});

// ---- summary ----
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} interactions OK`);
if (consoleErrors.length) console.log(`\nconsole errors seen (${consoleErrors.length}):\n  ` + [...new Set(consoleErrors)].join("\n  "));
if (failedRequests.length) console.log(`\nfailed requests (${failedRequests.length}):\n  ` + [...new Set(failedRequests)].join("\n  "));
ws.close();
chrome.kill();
process.exit(failed.length ? 1 : 0);
