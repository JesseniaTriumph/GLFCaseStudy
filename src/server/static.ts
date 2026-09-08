/**
 * Minimal static file server for the built web app (`web/dist`).
 *
 * The API process and the web app are ONE origin in every deployment — there is no CORS
 * allowlist by design (see app.ts). Serving the SPA from the same Node process is what
 * makes that true for the demo: `npm run demo` → one URL is the whole product.
 *
 * - Only GET / HEAD, only paths that resolve inside the web root (path traversal is
 *   rejected), a small MIME table, long cache on hashed assets, no-cache on index.html.
 * - Unknown non-asset paths fall back to index.html (client-side routing).
 * - HTML gets an app-appropriate CSP (self + inline styles + same-origin API/img). This
 *   is deliberately looser than the API's `default-src 'none'` because it has to render a
 *   page; it still blocks third-party script, framing, and object embeds.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize, extname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

// The web app pulls Inter + Poppins from Google Fonts. That is the ONLY third-party origin
// the page is allowed to touch — no third-party script, XHR, frame, or object. Self-hosting
// the two font files removes even this (a documented hardening step, HARDEN_CHECKLIST.md).
const APP_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export interface StaticHandler {
  (req: IncomingMessage, res: ServerResponse, pathname: string): boolean;
}

/** Returns a handler that serves `root`, or a no-op that always returns false if root is missing. */
export function makeStaticHandler(root: string | undefined): StaticHandler {
  if (!root || !existsSync(root)) return () => false;
  const indexHtml = join(root, "index.html");

  return (req, res, pathname) => {
    if (req.method !== "GET" && req.method !== "HEAD") return false;

    // resolve inside the root; reject traversal
    const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
    const abs = normalize(join(root, rel));
    if (!abs.startsWith(normalize(root))) {
      res.writeHead(403).end("forbidden");
      return true;
    }

    let file = abs;
    if (!existsSync(file) || statSync(file).isDirectory()) {
      // asset-looking miss → 404; anything else → SPA fallback to index.html
      if (extname(rel)) {
        res.writeHead(404, { "content-type": "text/plain" }).end("not found");
        return true;
      }
      if (!existsSync(indexHtml)) return false;
      file = indexHtml;
    }

    const ext = extname(file).toLowerCase();
    const isHtml = ext === ".html";
    // setHeader (not writeHead headers) so these overwrite the strict API defaults app.ts
    // already set on `res` for this request.
    res.setHeader("content-type", MIME[ext] ?? "application/octet-stream");
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("referrer-policy", "same-origin");
    res.setHeader("content-security-policy", isHtml ? APP_CSP : "default-src 'none'");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("cross-origin-opener-policy", "same-origin");
    res.setHeader("cross-origin-resource-policy", "same-origin");
    // hashed build assets are immutable; html and the manifest must revalidate
    res.setHeader(
      "cache-control",
      isHtml || ext === ".webmanifest" || rel === "sw.js" ? "no-cache" : "public, max-age=31536000, immutable"
    );

    if (req.method === "HEAD") {
      res.writeHead(200).end();
      return true;
    }
    res.writeHead(200);
    createReadStream(file).pipe(res);
    return true;
  };
}
