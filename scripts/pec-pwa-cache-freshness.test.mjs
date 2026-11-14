// PEC ERP: installed-PWA service-worker freshness for canonical JS and CSS.
// Offline mocked-SW verification; no network, production accounts or data writes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const current = readFileSync(path.join(root, "public/sw.js"), "utf8");
const ORIGIN = "https://pec-hub.test";
const JS = "/shared/js/procurement-execution-console.js";
const CSS = "/shared/css/sasv-procurement-execution-console.css";
const OTHER = ["/shared/js/stock-checker.js", "/shared/js/platform.js", "/shared/css/style.css"];

function load(source) {
  const listeners = {};
  const store = new Map();
  const network = { online: true, files: {}, calls: [] };
  const response = (body) => ({ ok: true, body, clone() { return this; } });
  const caches = {
    open: async () => ({ put: async (request, result) => {
      store.set(request?.url ?? request, result.body);
    } }),
    match: async (request) => store.has(request?.url ?? request)
      ? response(store.get(request?.url ?? request)) : undefined,
    keys: async () => [],
    delete: async () => true,
  };
  const fetch = async (request) => {
    const url = typeof request === "string" ? request : request.url;
    network.calls.push(url);
    if (!network.online) throw new TypeError("offline");
    const pathname = new URL(url, ORIGIN).pathname;
    return Object.hasOwn(network.files, pathname)
      ? response(network.files[pathname])
      : { ok: false, status: 404, clone() { return this; } };
  };
  vm.runInNewContext(source, {
    self: {
      addEventListener: (type, fn) => { listeners[type] = fn; },
      skipWaiting() {},
      clients: {},
    },
    location: { origin: ORIGIN },
    fetch, caches, URL, console, Promise,
  });
  async function request(pathname, method = "GET") {
    let promise;
    const req = {
      url: ORIGIN + pathname, method, mode: "no-cors",
      headers: { get: () => "*/*" },
    };
    listeners.fetch({ request: req, respondWith: (value) => { promise = value; } });
    return promise === undefined ? undefined : (await promise)?.body;
  }
  return { request, store, network };
}

// Newline-agnostic: the baseline is built from an LF-normalised copy so a CRLF checkout cannot change the verdict.
const noPec = current.replace(/\r\n/g, "\n").replace(
  / \|\|\n {4}\/\/ PEC ERP:[\s\S]*?sasv-procurement-execution-console\\\.css\$\/\.test\(url\.pathname\)/,
  "",
);
test("baseline without PEC rules serves a stale cached JS and CSS (regression proves need)", async () => {
  assert.notEqual(noPec, current, "PEC network-first rules must be removable");
  for (const p of [JS, CSS]) {
    const h = load(noPec);
    h.store.set(ORIGIN + p, "STALE");
    h.network.files[p] = "FRESH";
    assert.equal(await h.request(p), "STALE", p);
  }
});
for (const [label, file] of [["PEC JS", JS], ["PEC CSS", CSS],
                             ["JS under /public prefix", "/public" + JS],
                             ["CSS under /public prefix", "/public" + CSS]]) {
  test(`${label}: online fetches fresh, caches it, offline reuses latest copy`, async () => {
    const h = load(current);
    h.store.set(ORIGIN + file, "OLD");
    h.network.files[file] = "NEW";
    assert.equal(await h.request(file), "NEW");
    assert.equal(h.store.get(ORIGIN + file), "NEW");
    h.network.online = false;
    assert.equal(await h.request(file), "NEW");
  });
}
test("query strings do not bypass the network-first PEC cache policy", async () => {
  const h = load(current);
  const resource = JS + "?v=2";
  h.store.set(ORIGIN + resource, "OLD");
  h.network.files[JS] = "NEW";
  assert.equal(await h.request(resource), "NEW");
});
test("offline without a cached PEC JS correctly fails", async () => {
  const h = load(current); h.network.online = false;
  await assert.rejects(() => h.request(JS), /offline/);
});
test("unrelated static resources remain cache-first", async () => {
  for (const p of OTHER) {
    const h = load(current);
    h.store.set(ORIGIN + p, "OLD");
    h.network.files[p] = "NEW";
    assert.equal(await h.request(p), "OLD", p);
    assert.deepEqual(h.network.calls, [], p);
  }
});
test("existing network-first modules remain fresh", async () => {
  for (const p of ["/shared/js/fg-bulk-internal-transfer.js",
                   "/shared/css/sasv-fg-bulk-internal-transfer.css",
                   "/shared/js/costing-suite-shell.js"]) {
    const h = load(current); h.store.set(ORIGIN + p, "OLD"); h.network.files[p] = "NEW";
    assert.equal(await h.request(p), "NEW", p);
  }
});
test("non-GET requests are never intercepted", async () => {
  const h = load(current);
  assert.equal(await h.request(JS, "POST"), undefined);
});
test("cache version remains unchanged and no broad cache deletion added", () => {
  assert.match(current, /const CACHE_NAME = "hub-cache-v393"/);
  assert.equal((current.match(/\bcaches\.delete\(/g) || []).length, 1);
});
test("service-worker file has consistent newline style", () => {
  const crlf = (current.match(/\r\n/g) || []).length;
  const lf = (current.match(/\n/g) || []).length - crlf;
  assert.ok(crlf === 0 || lf === 0);
});
test("CRLF-transformed worker honours PEC network-first behaviour", async () => {
  const h = load(current.replace(/\n/g, "\r\n"));
  h.store.set(ORIGIN + CSS, "OLD"); h.network.files[CSS] = "NEW";
  assert.equal(await h.request(CSS), "NEW");
});
