/* /sw.js (root) */
const CACHE_NAME = "sasv-utils-v5"; // bump!

const PRECACHE = [
  // Hub shell
  "/utilities-hub/index.html",
  "/utilities-hub/auth/callback.html",

  // Shared/vendor used by the hub or pages
  "/shared/css/style.css",
  "/shared/js/platform.js",
  "/vendor/tom-select/tom-select.css",
  "/vendor/tom-select/tom-select.complete.min.js",

  // Utility pages (optional shell)
  "/shared/fill-planner.html",
  "/shared/stock-checker.html",

  // Icons that the manifest references
  "/utilities-hub/icons/icon-48x48.png",
  "/utilities-hub/icons/icon-72x72.png",
  "/utilities-hub/icons/icon-96x96.png",
  "/utilities-hub/icons/icon-144x144.png",
  "/utilities-hub/icons/icon-152x152.png",
  "/utilities-hub/icons/icon-192x192.png",
  "/utilities-hub/icons/icon-384x384.png",
  "/utilities-hub/icons/icon-512x512.png",
  "/utilities-hub/icons/icon-1024.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const results = await Promise.allSettled(
        PRECACHE.map((u) => fetch(u, { cache: "no-store" }))
      );
      await Promise.all(
        results.map((res, i) => {
          if (res.status === "fulfilled" && res.value.ok) {
            return cache.put(PRECACHE[i], res.value);
          } else {
            console.warn("[SW] Skipping missing asset:", PRECACHE[i]);
          }
        })
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : undefined))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (/supabase|\/(rest|realtime|storage|auth)\b/i.test(url.href)) return;

  if (
    url.pathname === "/utilities-hub/index.html" ||
    url.pathname === "/utilities-hub/js/hub-auth.js"
  ) {
    event.respondWith(fetch(req)); // no cache → avoids stale auth/UI
    return;
  }

  // Navigations → network-first, fallback to correct hub path (NO /public)
  if (
    req.mode === "navigate" ||
    req.headers.get("accept")?.includes("text/html")
  ) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return (
            (await caches.match(req)) ||
            (await caches.match("/utilities-hub/index.html"))
          );
        }
      })()
    );
    return;
  }

  // Static → cache-first
  event.respondWith(
    (async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (
        /\.(css|js|png|jpe?g|svg|webp|ico|woff2?)$/i.test(url.pathname) &&
        res.ok
      ) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
      }
      return res;
    })()
  );
});
