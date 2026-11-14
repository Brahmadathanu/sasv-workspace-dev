// WP08 G2-0: service-worker freshness for the shared Master Data modules and the deployment gate that guards step A.
// Mocked service worker + local HTTP servers only. No network, no cache-version change.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import http from "node:http";
import { repoRoot, GATE_FILES, localManifest, tokenOf, verifyDeployed, swProblems } from "./deploy-gate.mjs";

const swSrc = fs.readFileSync(path.join(repoRoot, "public/sw.js"), "utf8");
const origin = "https://hub.test";
const mk = (body) => ({ body, ok: true, clone() { return mk(this.body); } });

function harness(src = swSrc) {
  const callbacks = {}; const cache = new Map(); const network = new Map(); let offline = false; const accesses = [];
  const context = {
    self: { addEventListener: (e, cb) => { callbacks[e] = cb; }, skipWaiting() {}, clients: { claim() {} } },
    location: { origin },
    caches: { open: async () => ({ put: async (r, v) => { cache.set(typeof r === "string" ? r : r.url, v.body); } }), match: async (r) => { const k = typeof r === "string" ? r : r.url; return cache.has(k) ? mk(cache.get(k)) : undefined; }, keys: async () => [], delete: async () => true },
    fetch: async (r) => { const k = typeof r === "string" ? r : r.url; accesses.push(k); if (offline) throw new Error("offline"); return network.has(k) ? mk(network.get(k)) : { ok: false, status: 404 }; },
    URL, console, Promise,
  };
  vm.runInNewContext(src, context);
  return {
    cache, network, accesses, offline(v) { offline = v; },
    async request(p) { const url = origin + p; let promise, handled = false; callbacks.fetch({ request: { url, method: "GET", mode: "no-cors", headers: { get: () => "application/javascript" } }, respondWith(v) { handled = true; promise = v; } }); return { handled, body: handled ? (await promise)?.body : null }; },
  };
}

const MODULE_ASSETS = ["/shared/js/products.js", "/shared/js/manage-rm-bom.js", "/shared/js/manage-pm-bom.js", "/shared/js/manage-sp-bom.js", "/shared/js/master-data-platform.js", "/shared/css/shared-ui.css", "/shared/css/sasv-bom.css"];

test("the four modules' scripts and styles are network-first: a stale cached copy is replaced online, and the fresh copy serves offline", async () => {
  for (const p of MODULE_ASSETS) {
    const h = harness();
    h.cache.set(origin + p, "stale");
    h.network.set(origin + p, "fresh");
    assert.deepEqual(await h.request(p), { handled: true, body: "fresh" }, `${p} must not be served cache-first`);
    assert.ok(h.accesses.includes(origin + p), "network consulted");
    h.offline(true);
    assert.deepEqual(await h.request(p), { handled: true, body: "fresh" }, `${p} offline uses the newly cached copy`);
  }
});

test("control: an unrelated shared script stays cache-first (strategy otherwise unchanged)", async () => {
  const h = harness();
  h.cache.set(origin + "/shared/js/unrelated.js", "cached");
  h.network.set(origin + "/shared/js/unrelated.js", "network");
  assert.deepEqual(await h.request("/shared/js/unrelated.js"), { handled: true, body: "cached" });
  assert.equal(h.accesses.length, 0);
});

test("negative control: the BASE service worker WOULD have served stale cached module JS (proves the test detects the hazard)", async () => {
  const { execFileSync } = await import("node:child_process");
  const base = execFileSync("git", ["show", "3f47b11517c0592c71d6c27bf3601ec5e3c51658:public/sw.js"], { cwd: repoRoot, encoding: "utf8", maxBuffer: 1 << 26 });
  const h = harness(base);
  h.cache.set(origin + "/shared/js/products.js", "stale");
  h.network.set(origin + "/shared/js/products.js", "fresh");
  assert.equal((await h.request("/shared/js/products.js")).body, "stale");
});

test("no cache-generation change: CACHE_NAME is still the single hub-cache-v393 line (these URLs were never cached by an earlier generation)", () => {
  assert.equal((swSrc.match(/const CACHE_NAME = "hub-cache-v393"/g) ?? []).length, 1);
  assert.equal((swSrc.match(/const CACHE_NAME\b/g) ?? []).length, 1);
});

// ---- deployment gate ------------------------------------------------------------------------------------------------
function serve(mutate = {}) {
  const pub = path.join(repoRoot, "public");
  const server = http.createServer((req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    if (p in mutate) return mutate[p] === null ? res.writeHead(404).end() : res.writeHead(200).end(mutate[p]);
    const f = path.join(pub, p);
    if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200).end(fs.readFileSync(f));
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}
const fetchText = async (url) => { const r = await fetch(url); return { status: r.status, text: () => r.text() }; };

test("gate: identical deployed bytes + modern sw.js -> PASS with the token that step A embeds", async () => {
  const { server, origin: o } = await serve();
  try {
    const r = await verifyDeployed(o, fetchText);
    assert.deepEqual(r.problems, []);
    assert.equal(r.token, tokenOf(localManifest()));
  } finally { server.close(); }
});

test("gate: any difference withholds the token (changed JS, missing page, old service worker)", async () => {
  const sw = swSrc;
  const swOld = sw.replace(/WP08 G2-0/g, "X").replace(/products\|manage-rm-bom\|manage-pm-bom\|manage-sp-bom\|master-data-platform/g, "x").replace(/shared-ui\|sasv-bom/g, "y");
  const cases = [
    { "/shared/js/manage-pm-bom.js": "tampered();" },
    { "/shared/manage-sp-bom.html": null },
    { "/sw.js": swOld },
    { "/sw.js": null },
  ];
  for (const mutate of cases) {
    const { server, origin: o } = await serve(mutate);
    try {
      const r = await verifyDeployed(o, fetchText);
      assert.equal(r.ok, false, JSON.stringify(Object.keys(mutate)));
      assert.equal(r.token, null);
      assert.ok(r.problems.length >= 1);
    } finally { server.close(); }
  }
});

test("gate: CRLF line endings on either side do not change the verdict (Windows checkout vs LF host)", async () => {
  const f = GATE_FILES.find((x) => x.url.endsWith("master-data-platform.js"));
  const crlf = fs.readFileSync(path.join(repoRoot, f.repo), "utf8").replace(/\r?\n/g, "\r\n");
  const { server, origin: o } = await serve({ [f.url]: crlf });
  try { assert.equal((await verifyDeployed(o, fetchText)).ok, true); } finally { server.close(); }
});

test("gate: swProblems recognises the committed service worker and rejects one that lacks the branch", () => {
  assert.deepEqual(swProblems(swSrc), []);
  assert.ok(swProblems("self.addEventListener('fetch',()=>{}); // Static → cache-first").length >= 2);
});
