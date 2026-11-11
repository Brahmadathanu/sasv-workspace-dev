import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// #289 targeted mocked-service-worker test. No network, credentials, browser or production API.
const sw = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const origin = "https://hub.test";
const mkResponse = (body) => ({ body, ok: true, clone() { return mkResponse(this.body); } });

function harness() {
  const callbacks = {};
  const cache = new Map();
  const network = new Map();
  let offline = false;
  const accesses = [];
  const context = {
    self: {
      addEventListener: (event, callback) => { callbacks[event] = callback; },
      skipWaiting() {},
      clients: { claim() {} }
    },
    location: { origin },
    caches: {
      open: async () => ({
        put: async (request, value) => { cache.set(typeof request === "string" ? request : request.url, value.body); }
      }),
      match: async (request) => {
        const key = typeof request === "string" ? request : request.url;
        return cache.has(key) ? mkResponse(cache.get(key)) : undefined;
      },
      keys: async () => [],
      delete: async () => true,
    },
    fetch: async (request) => {
      const key = typeof request === "string" ? request : request.url;
      accesses.push(key);
      if (offline) throw new Error("offline");
      if (!network.has(key)) return { ok: false, status: 404 };
      return mkResponse(network.get(key));
    },
    URL, console, Promise,
  };
  vm.runInNewContext(sw, context);
  return {
    cache, network, accesses,
    offline(value) { offline = value; },
    async request(path, method = "GET") {
      const url = path.startsWith("http") ? path : origin + path;
      let promise, handled = false;
      callbacks.fetch({
        request: { url, method, mode: "no-cors", headers: { get: () => "application/javascript" } },
        respondWith(value) { handled = true; promise = value; }
      });
      return { handled, body: handled ? (await promise)?.body : null };
    }
  };
}

test("Cost Comparison child imports are network-first and refresh cached assets online", async () => {
  for (const path of ["/shared/js/costing-cost-comparison-read.js", "/shared/js/costing-feature-flags.js"]) {
    const h = harness(), url = origin + path;
    h.cache.set(url, "stale");
    h.network.set(url, "fresh");
    assert.deepEqual(await h.request(path), { handled: true, body: "fresh" }, path);
    assert.ok(h.accesses.includes(url), "an online network request must occur");
    h.offline(true);
    assert.deepEqual(await h.request(path), { handled: true, body: "fresh" }, "offline fallback must use newly cached asset");
  }
});

test("unrelated static JS stays cache-first", async () => {
  const h = harness(), path = "/shared/js/unrelated.js";
  h.cache.set(origin + path, "cached");
  h.network.set(origin + path, "network");
  assert.deepEqual(await h.request(path), { handled: true, body: "cached" });
  assert.equal(h.accesses.length, 0);
});

test("API and non-GET calls are never intercepted", async () => {
  const h = harness();
  assert.equal((await h.request("https://qhmoqtxpeasamtlxaoak.supabase.co/rest/v1/rpc/example")).handled, false);
  assert.equal((await h.request("/rest/v1/rpc/example")).handled, false);
  assert.equal((await h.request("/shared/js/costing-feature-flags.js", "POST")).handled, false);
  assert.equal(h.accesses.length, 0);
});

test("existing service-worker version remains unchanged and no global flag is enabled", () => {
  assert.match(sw, /const CACHE_NAME = "hub-cache-v393"/);
  assert.doesNotMatch(sw, /localStorage\.setItem\(/);
});
