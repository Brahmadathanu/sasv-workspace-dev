/* -------------------------------------------------------
   sw.js  –  very small cache‑first service‑worker
   ----------------------------------------------------- */
const CACHE = 'fill-planner-v1';   // bump the number to clear old cache
const ASSETS = [
  './',                // index.html
  './fill-planner.js',
  '../css/style.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

/* Install: cache the shell */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

/* Activate: clean old caches if any */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Fetch: cache‑first for ASSETS, network‑first for everything else */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then(
      cached => cached || fetch(req)
    )
  );
});