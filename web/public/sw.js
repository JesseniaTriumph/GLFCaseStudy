/**
 * Compass service worker — installable PWA shell only.
 *
 * SECURITY: this worker caches ONLY the static app shell (HTML, JS, CSS, icons, fonts).
 * It never touches `/api/*` or `/auth/*` — answers, identity, and sessions are never
 * written to the cache, on any device. Those always go straight to the network.
 *
 * Strategy:
 *   - navigations: network-first, fall back to the cached shell when offline
 *   - same-origin static assets: stale-while-revalidate
 *   - Google Fonts: cache-first (immutable)
 *   - everything else (api, auth, cross-origin): pass straight through, never cached
 */
const VERSION = "compass-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/corpus-index.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // never cache the API or auth surface — not offline, not ever
  if (url.origin === location.origin && /^\/(api|auth|admin)\b/.test(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html").then((r) => r || Response.error()))
    );
    return;
  }

  if (url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com") {
    event.respondWith(
      caches.open(VERSION).then((c) => c.match(request).then((hit) => hit || fetch(request).then((res) => { c.put(request, res.clone()); return res; })))
    );
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(
      caches.open(VERSION).then((c) =>
        c.match(request).then((hit) => {
          const net = fetch(request)
            .then((res) => {
              if (res.ok) c.put(request, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || net;
        })
      )
    );
  }
});
