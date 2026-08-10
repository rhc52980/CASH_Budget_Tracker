// CACHE and PRECACHE are rewritten at build time (see vite.config.js) so each
// deploy gets a fresh cache and the app shell is available offline on the very
// first visit rather than the second.
const CACHE = "cash-__BUILD__";
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // Individually, so one failed asset can't abandon the whole precache
      .then((c) => Promise.allSettled(PRECACHE.map((url) => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  // Navigations: network first so updates land, cached shell when offline.
  // Keyed by registration scope so this works under a subpath (GitHub Pages).
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(self.registration.scope, copy));
          return res;
        })
        .catch(() => caches.match(self.registration.scope).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // Everything else (hashed assets, fonts): cache first
  e.respondWith(
    caches.match(request).then((hit) =>
      hit ||
      fetch(request).then((res) => {
        if (res.ok || res.type === "opaque") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
    )
  );
});
