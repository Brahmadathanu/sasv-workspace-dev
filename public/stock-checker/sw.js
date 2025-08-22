const CACHE_NAME = "stock-checker-v1";
const TO_CACHE = [
  "./index.html",
  "../shared/stock-checker.html",
  "../shared/css/style.css",
  "../shared/js/supabaseClient.js",
  "../shared/js/stock-checker.js",
];

// Install: cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(TO_CACHE))
      .catch((err) => console.warn("Cache failed", err))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

// Fetch: network-first, cache-fallback
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!["http:", "https:"].includes(url.protocol)) return;

  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        if (event.request.method === "GET") {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy).catch(() => {});
          });
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
