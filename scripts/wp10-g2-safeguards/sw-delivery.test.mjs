// WP10 G2 R7 - module delivery with the UNCHANGED public/sw.js. The real service-worker source is executed in a VM with mocked caches/fetch/self.
// Claim under test: parent files (products.js, costing-suite-readiness.js) are network-first, the helpers fall to the default cache-first handler,
// and the ?v=<content-hash> import URLs make an OLD cached helper unreachable from an UPDATED parent. Installed-controller acceptance remains WP12.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { computeToken, TOKEN_RE } from "./stamp-asset-version.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const swSource = fs.readFileSync(path.join(root, "public/sw.js"), "utf8");
const ORIGIN = "https://hub.test";

function makeSw({ cache = {}, network = {}, offline = false } = {}) {
  const store = new Map(Object.entries(cache).map(([k, v]) => [ORIGIN + k, v]));
  const handlers = {};
  const fetched = [];
  const resp = (body, ok = true) => ({ ok, status: ok ? 200 : 404, body, clone() { return this; } });
  const ctx = {
    URL, console, Promise, Map, Set, RegExp, Response: class {},
    self: { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim() {} }, location: { origin: ORIGIN } },
    location: { origin: ORIGIN },
    caches: {
      match: async (req) => (store.has(typeof req === "string" ? req : req.url) ? resp(store.get(typeof req === "string" ? req : req.url)) : undefined),
      open: async () => ({ put: async (req, res) => { store.set(typeof req === "string" ? req : req.url, res.body); }, addAll: async () => {} }),
      keys: async () => [], delete: async () => true,
    },
    fetch: async (req) => { const u = typeof req === "string" ? req : req.url; fetched.push(u); if (offline) throw new Error("offline"); const p = new URL(u); const key = p.pathname + p.search; return resp(network[key] ?? network[p.pathname] ?? "NET:" + key); },
  };
  ctx.self.caches = ctx.caches;
  vm.createContext(ctx);
  vm.runInContext(swSource, ctx);
  return {
    async get(pathAndQuery) {
      let out; let responded = false;
      const request = { url: ORIGIN + pathAndQuery, method: "GET", mode: "cors", headers: { get: () => null } };
      handlers.fetch({ request, respondWith: (p) => { responded = true; out = p; } });
      return responded ? (await out).body : "(not intercepted)";
    },
    fetched,
  };
}

const TOKEN = computeToken();
const OLD = "aaaaaaaaaa";
const HELPERS = ["/shared/js/wp10-safeguards.js", "/shared/js/wp10-safeguards-ui.js"];

test("R7.1 parents are network-first in the unchanged sw.js: an updated products.js / costing-suite-readiness.js is served from the network even when an old copy is cached", async () => {
  for (const f of ["/shared/js/products.js", "/shared/js/costing-suite-readiness.js"]) {
    const sw = makeSw({ cache: { [f]: "OLD-PARENT" }, network: { [f]: "NEW-PARENT" } });
    assert.equal(await sw.get(f), "NEW-PARENT", f);
  }
});

test("R7.2 an UNVERSIONED helper URL would be served STALE from cache by the default handler (the hazard the version token removes)", async () => {
  for (const h of HELPERS) {
    const sw = makeSw({ cache: { [h]: "OLD-HELPER" }, network: { [h]: "NEW-HELPER" } });
    assert.equal(await sw.get(h), "OLD-HELPER", "demonstrates the divergence risk for unversioned imports");
  }
});

test("R7.3 VERSIONED helper URLs: an updated parent requests ?v=<new token>; an old cached ?v=<old token> copy is NOT used and the new helper is fetched from the network", async () => {
  for (const h of HELPERS) {
    const sw = makeSw({ cache: { [`${h}?v=${OLD}`]: "OLD-HELPER" }, network: { [`${h}?v=${TOKEN}`]: "NEW-HELPER" } });
    assert.equal(await sw.get(`${h}?v=${TOKEN}`), "NEW-HELPER");
    assert.ok(sw.fetched.some((u) => u.endsWith(`${h}?v=${TOKEN}`)));
  }
});

test("R7.4 once fetched, the versioned helper is cache-first as before, and an OLD parent (still importing ?v=<old>) keeps getting its own matching helper: parent and helper cannot cross versions", async () => {
  const h = HELPERS[0];
  const sw = makeSw({ cache: { [`${h}?v=${OLD}`]: "OLD-HELPER", [`${h}?v=${TOKEN}`]: "NEW-HELPER" } });
  assert.equal(await sw.get(`${h}?v=${OLD}`), "OLD-HELPER");
  assert.equal(await sw.get(`${h}?v=${TOKEN}`), "NEW-HELPER");
});

test("R7.5 the importers on disk carry the CURRENT token on every helper import, including the helper-to-helper static import (no unversioned path exists)", () => {
  for (const f of ["public/shared/js/products.js", "public/shared/js/costing-suite-readiness.js", "public/shared/js/wp10-safeguards-ui.js"]) {
    const text = fs.readFileSync(path.join(root, f), "utf8");
    const all = [...text.matchAll(/wp10-safeguards(?:-ui)?\.js(?:\?v=[0-9a-f]{10})?["']/g)].map((m) => m[0]);
    assert.ok(all.length >= 1, f);
    for (const ref of all) assert.match(ref, /\?v=[0-9a-f]{10}["']$/, `${f} has an unversioned helper reference: ${ref}`);
    for (const m of text.matchAll(TOKEN_RE)) assert.equal(m[2], TOKEN, `${f} token stale`);
  }
});

test("R7.6 existing v393 cache and WP10 G2 versioned-helper delivery stay intact while classification scripts become network-first", async () => {
  assert.match(swSource, /const CACHE_NAME = "hub-cache-v394"/);
  for (const h of HELPERS) {
    const sw = makeSw({ cache: { [h]: "OLD-HELPER" }, network: { [h]: "NEW-HELPER" } });
    assert.equal(await sw.get(h), "OLD-HELPER", "existing WP10 G2 helper must remain cache-first");
  }
  for(const f of ["categories","subcategories","product-groups","subgroups","classification-master-access","classification-html-escape"]) {
    const url="/shared/js/"+f+".js";
    const sw=makeSw({cache:{[url]:"OLD"},network:{[url]:"FRESH"}});
    assert.equal(await sw.get(url),"FRESH",url+" must be network-first");
    const fallback=makeSw({cache:{[url]:"CACHED"},offline:true});
    assert.equal(await fallback.get(url),"CACHED",url+" must retain offline fallback");
  }
});

test("R7.7 offline with an old helper cached under the same versioned URL still works (cache fallback), and a missing helper fails safe (parent catches the import and renders today's UI)", async () => {
  const h = HELPERS[1];
  const sw = makeSw({ cache: { [`${h}?v=${TOKEN}`]: "CACHED-HELPER" }, offline: true });
  assert.equal(await sw.get(`${h}?v=${TOKEN}`), "CACHED-HELPER");
  const products = fs.readFileSync(path.join(root, "public/shared/js/products.js"), "utf8");
  assert.match(products, /try \{[\s\S]{0,200}import\("\.\/wp10-safeguards\.js\?v=[0-9a-f]{10}"\)[\s\S]{0,400}\} catch \{[\s\S]{0,60}wp10Mods = null/);
});
