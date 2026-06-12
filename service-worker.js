// Service Worker für Ausgaben Trocken
// Bump CACHE_VERSION when you ship changes so clients refetch.
const CACHE_VERSION = "ausgaben-trocken-v22";

// Only files that actually exist on the server
const CORE_ASSETS = [
  "./index.html",
  "./styles.css",
  "./utils.js",
  "./idb.js",
  "./tweaks-panel.js",
  "./components.js",
  "./detail.js",
  "./investments.js",
  "./scanner.js",
  "./scanner-patches.js",
  "./crypto.js",
  "./steuerbot.js",
  "./budgetbot.js",
  "./tax-optimizer.js",
  "./tax-engine.js",
  "./elster-export.js",
  "./tax-fristen.js",
  "./tax-interview.js",
  "./tax-einspruch.js",
  "./budget-heatmap.js",
  "./monatsarchiv.js",
  "./app.js",
  "./tax-config.json",
  "./manifest.webmanifest",
];

// Network-first für App-Dateien (JS, CSS, HTML, JSON) — immer frisch vom Server
// Cache-first nur für Fonts/Bilder (ändert sich selten)
const APP_EXTS = /\.(js|css|html|json|webmanifest)(\?.*)?$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.allSettled(CORE_ASSETS.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Externe Requests (z.B. React CDN) nicht intercepten
  if (url.origin !== self.location.origin) return;

  const isAppFile = APP_EXTS.test(url.pathname) || url.pathname.endsWith("/");

  if (isAppFile) {
    // Network-first: immer vom Server, Fallback auf Cache bei Offline
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first für Fonts, Bilder etc.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
