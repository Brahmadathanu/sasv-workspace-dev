// #264 — installed-PWA freshness of costing-suite-pricing-policy.js.
// Runs public/sw.js in a vm with mocked caches/fetch; asserts before/after
// behaviour (cache-first baseline is reconstructed from the current source).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const swPath = path.join(root, "public/sw.js");
const ORIGIN = "https://hub.test";
const PPM = "/shared/js/costing-suite-pricing-policy.js";
const OTHER = "/shared/js/costing-suite-cost-build.js";

function load(src) {
  const listeners = {};
  const store = new Map();
  const net = { online: true, files: {}, calls: [] };
  const mkRes = (body) => ({
    ok: true,
    body,
    clone() {
      return this;
    },
  });
  const caches = {
    open: async () => ({
      put: async (req, res) => {
        store.set(req.url ?? req, res.body);
      },
    }),
    match: async (req) =>
      store.has(req.url ?? req) ? mkRes(store.get(req.url ?? req)) : undefined,
    keys: async () => [],
    delete: async () => true,
  };
  const fetch = async (req) => {
    const u = typeof req === "string" ? req : req.url;
    net.calls.push(u);
    if (!net.online) throw new TypeError("offline");
    const p = new URL(u).pathname;
    if (!(p in net.files))
      return {
        ok: false,
        status: 404,
        clone() {
          return this;
        },
      };
    return mkRes(net.files[p]);
  };
  const ctx = {
    self: {
      addEventListener: (t, f) => (listeners[t] = f),
      skipWaiting() {},
      clients: {},
    },
    location: { origin: ORIGIN },
    caches,
    fetch,
    URL,
    console,
    Promise,
  };
  vm.runInNewContext(src, ctx);
  const request = (p) => ({
    url: ORIGIN + p,
    method: "GET",
    mode: "no-cors",
    headers: { get: () => "*/*" },
  });
  const run = async (p) => {
    let out;
    const req = request(p);
    listeners.fetch({ request: req, respondWith: (x) => (out = x) });
    const res = await out;
    return res?.body;
  };
  return { run, net, store };
}

const current = fs.readFileSync(swPath, "utf8");
const baseline = current.replace(
  "    /costing-suite-pricing-policy\\.js$/.test(url.pathname) ||\n",
  "",
);

test("baseline (pre-fix) serves stale cached PPM JS", async () => {
  assert.notEqual(baseline, current, "baseline reconstruction must differ");
  const h = load(baseline);
  h.store.set(ORIGIN + PPM, "OLD");
  h.net.files[PPM] = "NEW";
  assert.equal(await h.run(PPM), "OLD");
});

test("fixed SW: online serves fresh PPM JS and refreshes cache", async () => {
  const h = load(current);
  h.store.set(ORIGIN + PPM, "OLD");
  h.net.files[PPM] = "NEW";
  assert.equal(await h.run(PPM), "NEW");
  assert.equal(h.store.get(ORIGIN + PPM), "NEW");
});

test("fixed SW: offline falls back to cached copy (old->new->offline)", async () => {
  const h = load(current);
  h.store.set(ORIGIN + PPM, "OLD");
  h.net.files[PPM] = "NEW";
  await h.run(PPM);
  h.net.online = false;
  assert.equal(await h.run(PPM), "NEW");
});

test("fixed SW: offline with no cache entry rejects", async () => {
  const h = load(current);
  h.net.online = false;
  await assert.rejects(() => h.run(PPM), /offline/);
});

test("fixed SW: other static costing JS stays cache-first (scope not widened)", async () => {
  const h = load(current);
  h.store.set(ORIGIN + OTHER, "OLD");
  h.net.files[OTHER] = "NEW";
  assert.equal(await h.run(OTHER), "OLD");
});

test("cache version unchanged (v394 is a proposal needing owner approval)", () => {
  assert.match(current, /const CACHE_NAME = "hub-cache-v393"/);
});

test("sw.js has consistent line endings (all LF or all CRLF)", () => {
  const crlf = (current.match(/\r\n/g) || []).length;
  const lf = (current.match(/\n/g) || []).length - crlf;
  assert.ok(crlf === 0 || lf === 0, `mixed endings crlf=${crlf} lf=${lf}`);
});

test("CRLF-converted SW behaves identically", async () => {
  const h = load(current.replace(/\n/g, "\r\n"));
  h.store.set(ORIGIN + PPM, "OLD");
  h.net.files[PPM] = "NEW";
  assert.equal(await h.run(PPM), "NEW");
});
