import { test } from "node:test";
import assert from "node:assert/strict";
import { makeStaticHandler } from "../src/server/static.js";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";

function fakeRes() {
  const r: any = new EventEmitter();
  r.statusCode = 0;
  r.headers = {};
  r.setHeader = (k: string, v: string) => (r.headers[k.toLowerCase()] = v);
  r.getHeader = (k: string) => r.headers[k.toLowerCase()];
  r.writeHead = (code: number, h?: Record<string, string>) => {
    r.statusCode = code;
    if (h) for (const [k, v] of Object.entries(h)) r.headers[k.toLowerCase()] = v;
    return r;
  };
  r.end = (body?: string) => {
    r.body = body ?? r.body;
    r.ended = true;
    return r;
  };
  r.write = (b: string) => ((r.body = (r.body ?? "") + b), true);
  // piped ReadStream calls .end() via pipe; emulate enough
  return r;
}
const req = (method = "GET") => ({ method });

const root = mkdtempSync(join(tmpdir(), "compass-web-"));
mkdirSync(join(root, "assets"));
writeFileSync(join(root, "index.html"), "<!doctype html><title>Compass</title>");
writeFileSync(join(root, "assets", "app.js"), "console.log(1)");
writeFileSync(join(root, "manifest.webmanifest"), "{}");

test("no root → handler is a no-op that returns false", () => {
  const h = makeStaticHandler(undefined);
  assert.equal(h(req() as any, fakeRes(), "/"), false);
});

test("serves index.html with the app CSP and no-cache", async () => {
  const h = makeStaticHandler(root);
  const res = fakeRes();
  const handled = h(req("HEAD") as any, res, "/");
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-security-policy"], /script-src 'self'/);
  assert.equal(res.headers["x-frame-options"], "DENY");
  assert.equal(res.headers["cache-control"], "no-cache");
});

test("hashed assets get long immutable caching and a locked-down CSP", () => {
  const h = makeStaticHandler(root);
  const res = fakeRes();
  h(req("HEAD") as any, res, "/assets/app.js");
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["cache-control"], /immutable/);
  assert.equal(res.headers["content-security-policy"], "default-src 'none'");
  assert.match(res.headers["content-type"], /javascript/);
});

test("path traversal is rejected", () => {
  const h = makeStaticHandler(root);
  const res = fakeRes();
  h(req() as any, res, "/../../etc/passwd");
  assert.equal(res.statusCode, 403);
});

test("unknown path with an extension → 404", () => {
  const h = makeStaticHandler(root);
  const res = fakeRes();
  h(req() as any, res, "/nope.js");
  assert.equal(res.statusCode, 404);
});

test("unknown path without an extension → SPA fallback to index.html (200)", () => {
  const h = makeStaticHandler(root);
  const res = fakeRes();
  h(req("HEAD") as any, res, "/grantee/riverbend");
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"], /html/);
});

test("POST is not served by the static handler", () => {
  const h = makeStaticHandler(root);
  assert.equal(h(req("POST") as any, fakeRes(), "/"), false);
});
