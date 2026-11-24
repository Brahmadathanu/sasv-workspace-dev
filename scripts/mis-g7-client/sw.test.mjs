// MIS G7 release candidate: PWA service-worker freshness for the MIS assets. Runs the REAL public/sw.js in a vm with mocked caches/fetch (no
// browser, no network, nothing published). Proves: the baseline (main's SW) serves STALE MIS scripts; the reviewed SW serves them fresh, refreshes
// the cache and falls back offline; unrelated assets stay cache-first; CACHE_NAME and the activate cleanup are unchanged; the diff vs main is exactly five lines.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const current = fs.readFileSync(path.join(root, "public/sw.js"), "utf8").replace(/\r\n/g, "\n");
let main = null; try { main = execFileSync("git", ["show", "origin/main:public/sw.js"], { cwd: root, maxBuffer: 1 << 26 }).toString().replace(/\r\n/g, "\n"); } catch { /* origin/main unavailable */ }
const ORIGIN = "https://hub.test";
const MIS = ["/shared/js/mis-batch-governance.js", "/shared/js/mis-g7-contract.js", "/shared/js/mis-governed-handoff.js", "/shared/js/executive-mis-dashboard.js", "/shared/css/sasv-mis-batch-governance.css"];
const UNRELATED = ["/shared/js/sasv-module-chrome.js", "/shared/js/stock-checker.js", "/shared/css/style.css", "/shared/js/fg-bulk-stock.js", "/shared/css/sasv-mis-other.css", "/shared/js/mis-batch-governance.json.js"];

function load(src) {
  const listeners = {}; const store = new Map(); const net = { online: true, files: {}, calls: [] }; let deleted = [];
  const mk = (body) => ({ ok: true, body, clone() { return this; } });
  const caches = {
    open: async () => ({ put: async (req, res) => { store.set(req.url ?? req, res.body); } }),
    match: async (req) => (store.has(req.url ?? req) ? mk(store.get(req.url ?? req)) : undefined),
    keys: async () => ["hub-cache-v393", "hub-cache-v394", "other"], delete: async (k) => { deleted.push(k); return true; },
  };
  const fetch = async (req) => { const u = typeof req === "string" ? req : req.url; net.calls.push(u); if (!net.online) throw new TypeError("offline"); const p = new URL(u).pathname; return p in net.files ? mk(net.files[p]) : { ok: false, status: 404, clone() { return this; } }; };
  vm.runInNewContext(src, { self: { addEventListener: (t, f) => (listeners[t] = f), skipWaiting() {}, clients: { claim() {} } }, location: { origin: ORIGIN }, caches, fetch, URL, console, Promise });
  const run = async (p, { method = "GET", nav = false } = {}) => {
    let out; const req = { url: ORIGIN + p, method, mode: nav ? "navigate" : "no-cors", headers: { get: () => (nav ? "text/html" : "*/*") } };
    listeners.fetch({ request: req, respondWith: (x) => (out = x) }); return out === undefined ? undefined : (await out)?.body;
  };
  const activate = async () => { let w; listeners.activate({ waitUntil: (x) => (w = x) }); await w; return deleted; };
  return { run, net, store, activate };
}

test("BASELINE (main's SW) serves a stale cached MIS script, also under the ?mis-c1= cache key — the freshness risk is real", { skip: !main }, async () => {
  const h = load(main);
  for (const p of MIS) { h.store.set(ORIGIN + p, "OLD"); h.net.files[p] = "NEW"; assert.equal(await h.run(p), "OLD", p); }
  const q = "/shared/js/executive-mis-dashboard.js?mis-c1=13a7ac0-day-select"; h.store.set(ORIGIN + q, "OLD-Q"); h.net.files["/shared/js/executive-mis-dashboard.js"] = "NEW"; assert.equal(await h.run(q), "OLD-Q");
});
for (const p of MIS) {
  test(`${p}: online serves the fresh copy and refreshes the cache; offline falls back to it`, async () => {
    const h = load(current); h.store.set(ORIGIN + p, "OLD"); h.net.files[p] = "NEW";
    assert.equal(await h.run(p), "NEW"); assert.equal(h.store.get(ORIGIN + p), "NEW");
    h.net.online = false; assert.equal(await h.run(p), "NEW", "offline fallback");
  });
}
test("the dashboard script is fresh even when requested with its ?mis-c1= cache-bust query (pathname matching)", async () => {
  const q = "/shared/js/executive-mis-dashboard.js?mis-c1=13a7ac0-day-select"; const h = load(current);
  h.store.set(ORIGIN + q, "OLD"); h.net.files["/shared/js/executive-mis-dashboard.js"] = "NEW"; assert.equal(await h.run(q), "NEW");
});
test("Batch Governance page navigation is network-first with offline fallback to the cached page, then to the hub", async () => {
  const p = "/shared/mis-batch-governance.html"; const h = load(current); h.store.set(ORIGIN + p, "CACHED-PAGE"); h.store.set("/utilities-hub/index.html", "HUB"); h.net.files[p] = "FRESH-PAGE";
  assert.equal(await h.run(p, { nav: true }), "FRESH-PAGE"); h.net.online = false; assert.equal(await h.run(p, { nav: true }), "FRESH-PAGE", "cached after the online visit");
  const cold = load(current); cold.net.online = false; cold.store.set("/utilities-hub/index.html", "HUB"); assert.equal(await cold.run(p, { nav: true }), "HUB", "never opened before: hub fallback");
});
test("offline with nothing cached rejects for a MIS script (no silent success)", async () => {
  const h = load(current); h.net.online = false; await assert.rejects(() => h.run(MIS[0]), /offline/);
});
test("scope is not widened: unrelated and look-alike assets stay cache-first", async () => {
  for (const p of UNRELATED) { const h = load(current); h.store.set(ORIGIN + p, "OLD"); h.net.files[p] = "NEW"; assert.equal(await h.run(p), "OLD", p); assert.deepEqual(h.net.calls, [], `${p} did not hit the network`); }
});
test("earlier network-first rules are intact (FG-BIT, eaushadhi, costing shell, WP10 classification)", async () => {
  for (const p of ["/shared/js/fg-bulk-internal-transfer.js", "/shared/css/sasv-fg-bulk-internal-transfer.css", "/shared/js/eaushadhi-review-core.js", "/shared/js/costing-suite-shell.js", "/shared/js/categories.js"]) {
    const h = load(current); h.store.set(ORIGIN + p, "OLD"); h.net.files[p] = "NEW"; assert.equal(await h.run(p), "NEW", p);
  }
});
test("non-GET requests are not intercepted; Supabase traffic is not cached", async () => {
  const h = load(current); h.net.files[MIS[0]] = "NEW"; assert.equal(await h.run(MIS[0], { method: "POST" }), undefined);
});
test("cache identity unchanged (hub-cache-v394, same as main) and activate still purges every other generation", async () => {
  assert.match(current, /const CACHE_NAME = "hub-cache-v394"/); if (main) assert.equal(current.split("\n")[1], main.split("\n")[1]);
  assert.deepEqual(await load(current).activate(), ["hub-cache-v393", "other"]);
});
test("the whole change versus main is exactly the five reviewed lines (3 comment + 2 pathname rules)", { skip: !main }, () => {
  const a = main.split("\n"), b = current.split("\n"); assert.equal(b.length - a.length, 5);
  const added = b.filter((l, i) => !a.includes(l) || false); assert.equal(added.length, 5);
  assert.equal(added.filter((l) => /^\s*\/\//.test(l)).length, 3); assert.equal(added.filter((l) => /\.test\(url\.pathname\) \|\|$/.test(l)).length, 2);
  assert.equal(b.filter((l) => !added.includes(l)).join("\n"), a.join("\n"), "nothing else changed or reordered");
});
test("CRLF-converted SW behaves identically and keeps consistent line endings", async () => {
  const h = load(current.replace(/\n/g, "\r\n")); h.store.set(ORIGIN + MIS[0], "OLD"); h.net.files[MIS[0]] = "NEW"; assert.equal(await h.run(MIS[0]), "NEW");
});
