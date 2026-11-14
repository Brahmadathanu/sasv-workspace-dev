/* /sw.js (root) */
const CACHE_NAME = "hub-cache-v393"; // WP05-W506 Staff Governance personnel-confidentiality client gate (explicit projections, edit gating); v392 was Costing LOCK-P01 lock-screen CCC-edit guard (#211/#212); v391 was Costing #208 mobile Evidence-table scroll CSS; v390 was Costing UX-F1 Dashboard and compact CCC; v389 was WP-07 e-Aushadhi review UX (UX-1 to UX-10, Bundle A)

const PRECACHE = [
  // Hub shell
  "/utilities-hub/index.html",
  "/utilities-hub/auth/callback.html",

  // Admin (optional but recommended)
  "/utilities-hub/admin.html",
  "/utilities-hub/js/admin.js",

  // Shared/vendor
  "/shared/css/style.css",
  "/shared/js/platform.js",
  "/vendor/tom-select/tom-select.css",
  "/vendor/tom-select/tom-select.complete.min.js",

  // Utility pages
  "/shared/fill-planner.html",
  "/shared/stock-checker.html",
  "/shared/production-execution-queue.html",
  "/shared/js/production-execution-queue.js",
  "/shared/etl-monitor.html",
  "/shared/js/etl-control.js",

  // Icons referenced by the Hub manifest (canonical branding derived)
  "/shared/assets/branding/derived/icon-48.png",
  "/shared/assets/branding/derived/icon-72.png",
  "/shared/assets/branding/derived/icon-96.png",
  "/shared/assets/branding/derived/icon-144.png",
  "/shared/assets/branding/derived/icon-152.png",
  "/shared/assets/branding/derived/icon-192.png",
  "/shared/assets/branding/derived/icon-384.png",
  "/shared/assets/branding/derived/icon-512.png",
  "/shared/assets/branding/derived/apple-touch-icon-180.png",
  "/shared/assets/branding/derived/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const results = await Promise.allSettled(
        PRECACHE.map((u) => fetch(u, { cache: "no-store" })),
      );
      await Promise.all(
        results.map((res, i) => {
          if (res.status === "fulfilled" && res.value.ok) {
            return cache.put(PRECACHE[i], res.value);
          } else {
            console.warn("[SW] Skipping missing asset:", PRECACHE[i]);
          }
        }),
      );
    })(),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : undefined)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (/supabase|\/(rest|realtime|storage|auth)\b/i.test(url.href)) return;

  if (
    url.pathname === "/utilities-hub/index.html" ||
    url.pathname === "/utilities-hub/js/hub-auth.js" ||
    url.pathname === "/utilities-hub/js/admin.js"
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // PRM editor scripts must not stay cache-first — step-table paint depends on
  // the current post-mutation refresh path. The Pricing Policy module is a
  // static child import of costing-suite-shell.js, so it needs the same
  // network-first (offline cache fallback) treatment (#264).
  if (
    /costing-suite-production-route/.test(url.pathname) ||
    /costing-suite-shell\.js$/.test(url.pathname) ||
    /costing-suite-readiness\.js$/.test(url.pathname) ||
    /costing-suite-pricing-policy\.js$/.test(url.pathname) ||
    // Keep the Scheme History actor formatter in step with its network-first parent.
    /\/shared\/js\/costing-suite-scheme-audit-actor\.mjs$/.test(url.pathname) ||
    // #289: these Cost Comparison child imports must track the network-first shell
    // so installed PWAs do not keep an older RPC reader or flag contract.
    /\/shared\/js\/costing-cost-comparison-read\.js$/.test(url.pathname) ||
    /\/shared\/js\/costing-feature-flags\.js$/.test(url.pathname) ||
    /\/shared\/js\/eaushadhi-review-.*\.js$/.test(url.pathname) ||
    /\/shared\/js\/eaushadhi-.*\.js$/.test(url.pathname) ||
    /\/shared\/css\/sasv-eaushadhi-review\.css$/.test(url.pathname) ||
    // FG-BIT-UX-1: the page HTML is network-first, so its script/stylesheet must
    // be too, otherwise an installed PWA pairs new HTML with stale cached JS.
    /\/shared\/js\/fg-bulk-internal-transfer\.js$/.test(url.pathname) ||
    /\/shared\/css\/sasv-fg-bulk-internal-transfer\.css$/.test(url.pathname) ||
    // WP08 G2-0: the four shared Master Data pages (HTML is network-first) must not pair new HTML with a stale
    // cache-first script/stylesheet. These URLs were never cached by any earlier cache generation, so no
    // CACHE_NAME advance is needed; they simply must never enter the cache-first path.
    /\/shared\/js\/(?:products|manage-rm-bom|manage-pm-bom|manage-sp-bom|master-data-platform)\.js$/.test(url.pathname) ||
    /\/shared\/css\/(?:shared-ui|sasv-bom)\.css$/.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch {
          const hit = await caches.match(req);
          return hit || fetch(req);
        }
      })(),
    );
    return;
  }

  // Ensure forecast-console gets the freshest copy on first load to avoid
  // stale cached JS causing DOM-race errors. Use network-first for this file.
  if (url.pathname === "/shared/js/forecast-console.js") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch {
          const hit = await caches.match(req);
          return hit || fetch(req);
        }
      })(),
    );
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
      })(),
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
    })(),
  );
});
/* ------------------------------------------------------------------ */
/* Sign-in handoff: wake/focus PWA after magic-link callback          */
/* ------------------------------------------------------------------ */
self.addEventListener("message", (event) => {
  if (event?.data?.type !== "signed-in") return;

  const hubUrl = "/utilities-hub/";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      let found = false;
      for (const client of clients) {
        if (client.url.includes("/utilities-hub/")) {
          // tell the page it can re-render using the new session
          client.postMessage({ type: "signed-in" });

          try {
            await client.navigate(hubUrl);
          } catch (err) {
            // navigation may be disallowed in some contexts — safe to ignore
            console.debug("[SW] client.navigate failed:", err);
          }

          try {
            await client.focus();
          } catch (err) {
            // focusing can fail on backgrounded tabs — safe to ignore
            console.debug("[SW] client.focus failed:", err);
          }

          found = true;
        }
      }

      if (!found) {
        try {
          await self.clients.openWindow(hubUrl);
        } catch (err) {
          console.warn("[SW] openWindow failed:", err);
        }
      }
    })(),
  );
});
