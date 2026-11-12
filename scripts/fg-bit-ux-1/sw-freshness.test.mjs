// FG-BIT-UX-1: installed-PWA freshness of the FG Bulk Internal Transfer script/stylesheet.
// Runs public/sw.js in a vm with mocked caches/fetch (no browser, no network).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const current = fs.readFileSync(path.join(root, "public/sw.js"), "utf8").replace(/\r\n/g, "\n"); // LF-normalised (CRLF checkouts)
const ORIGIN = "https://hub.test";
const JS = "/shared/js/fg-bulk-internal-transfer.js";
const CSS = "/shared/css/sasv-fg-bulk-internal-transfer.css";
const UNRELATED = ["/shared/js/sasv-module-chrome.js", "/shared/js/ui-icons.js", "/shared/css/sasv-stock-checker.css", "/shared/css/style.css", "/shared/js/fg-bulk-stock.js"];

function load(src) {
  const listeners = {}; const store = new Map(); const net = { online: true, files: {}, calls: [] };
  const mk = (body) => ({ ok: true, body, clone() { return this; } });
  const caches = {
    open: async () => ({ put: async (req, res) => { store.set(req.url ?? req, res.body); } }),
    match: async (req) => (store.has(req.url ?? req) ? mk(store.get(req.url ?? req)) : undefined),
    keys: async () => [], delete: async () => true,
  };
  const fetch = async (req) => {
    const u = typeof req === "string" ? req : req.url; net.calls.push(u);
    if (!net.online) throw new TypeError("offline");
    const p = new URL(u).pathname;
    return p in net.files ? mk(net.files[p]) : { ok: false, status: 404, clone() { return this; } };
  };
  vm.runInNewContext(src, { self: { addEventListener: (t, f) => (listeners[t] = f), skipWaiting() {}, clients: {} }, location: { origin: ORIGIN }, caches, fetch, URL, console, Promise });
  const run = async (p, method = "GET") => {
    let out; const req = { url: ORIGIN + p, method, mode: "no-cors", headers: { get: () => "*/*" } };
    listeners.fetch({ request: req, respondWith: (x) => (out = x) });
    return out === undefined ? undefined : (await out)?.body;
  };
  return { run, net, store };
}
const baseline = current
  .replace(/ \|\|\n {4}\/\/ FG-BIT-UX-1:[\s\S]*?sasv-fg-bulk-internal-transfer\\\.css\$\/\.test\(url\.pathname\)/, "");

test("baseline reconstruction differs and serves STALE cached FG-BIT JS (proves the risk)", async () => {
  assert.notEqual(baseline, current);
  const h = load(baseline); h.store.set(ORIGIN + JS, "OLD"); h.net.files[JS] = "NEW";
  assert.equal(await h.run(JS), "OLD");
});
for (const [label, p] of [["JS", JS], ["CSS", CSS], ["JS under /public prefix", "/public" + JS]]) {
  test(`${label}: online serves fresh copy, refreshes cache, then offline falls back to it`, async () => {
    const h = load(current); h.store.set(ORIGIN + p, "OLD"); h.net.files[p] = "NEW";
    assert.equal(await h.run(p), "NEW");
    assert.equal(h.store.get(ORIGIN + p), "NEW");
    h.net.online = false;
    assert.equal(await h.run(p), "NEW", "offline fallback");
  });
}
test("offline with nothing cached rejects (no silent success)", async () => {
  const h = load(current); h.net.online = false;
  await assert.rejects(() => h.run(JS), /offline/);
});
test("unrelated static files stay cache-first (scope not widened)", async () => {
  for (const p of UNRELATED) {
    const h = load(current); h.store.set(ORIGIN + p, "OLD"); h.net.files[p] = "NEW";
    assert.equal(await h.run(p), "OLD", p);
    assert.deepEqual(h.net.calls, [], `${p} did not hit the network`);
  }
});
test("existing network-first rules still intact (eaushadhi, costing shell)", async () => {
  for (const p of ["/shared/js/eaushadhi-review-core.js", "/shared/css/sasv-eaushadhi-review.css", "/shared/js/costing-suite-shell.js"]) {
    const h = load(current); h.store.set(ORIGIN + p, "OLD"); h.net.files[p] = "NEW";
    assert.equal(await h.run(p), "NEW", p);
  }
});
test("non-GET requests are not intercepted", async () => {
  const h = load(current); h.net.files[JS] = "NEW";
  assert.equal(await h.run(JS, "POST"), undefined);
});
test("cache name is unchanged (no version bump, no cache sweep)", () => {
  assert.match(current, /const CACHE_NAME = "hub-cache-v393"/);
  assert.equal(current.match(/\bcaches\.delete\(/g).length, 1, "activate cleanup unchanged");
});
test("sw.js keeps consistent line endings (all LF or all CRLF)", () => {
  const crlf = (current.match(/\r\n/g) || []).length;
  const lf = (current.match(/\n/g) || []).length - crlf;
  assert.ok(crlf === 0 || lf === 0);
});
test("CRLF-converted SW behaves identically", async () => {
  const h = load(current.replace(/\n/g, "\r\n")); h.store.set(ORIGIN + JS, "OLD"); h.net.files[JS] = "NEW";
  assert.equal(await h.run(JS), "NEW");
});
