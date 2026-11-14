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

// ---- Netlify HTML-banner normalisation (Issue #410, owner-approved; strict, HTML-only, fail-closed) ----------------------
import { NETLIFY_BANNER, NETLIFY_BANNER_ID } from "../costing-acceptance/verify-served-assets.mjs";
const HTML_URL = "/shared/manage-products.html";
const CHARSET = '<meta charset="UTF-8" />\n';
const gitHtml = () => fs.readFileSync(path.join(repoRoot, "public" + HTML_URL), "utf8").replace(/\r\n/g, "\n");
const withBanner = (html, where = "after") => { const at = html.indexOf(CHARSET) + CHARSET.length; return where === "after" ? html.slice(0, at) + NETLIFY_BANNER + html.slice(at) : NETLIFY_BANNER + html; };
async function gate(mutate) {
  const { server, origin: o } = await serve(mutate);
  try { return await verifyDeployed(o, fetchText); } finally { server.close(); }
}

test("banner gate: exact matching HTML passes with nothing normalised", async () => {
  const r = await gate({});
  assert.equal(r.ok, true); assert.deepEqual(r.normalized, []); assert.equal(r.token, tokenOf(localManifest()));
});

test("banner gate: the exact Netlify comment right after <meta charset> passes, same token, raw vs normalised hashes recorded", async () => {
  const served = withBanner(gitHtml());
  const r = await gate({ [HTML_URL]: served });
  assert.deepEqual(r.problems, []);
  assert.equal(r.token, tokenOf(localManifest()), "token calculation unchanged");
  assert.equal(r.normalized.length, 1);
  const n = r.normalized[0];
  const expected = localManifest().find((m) => m.url === HTML_URL).sha256;
  assert.equal(n.url, HTML_URL); assert.equal(n.normalisation, NETLIFY_BANNER_ID);
  assert.equal(n.normalized_sha256, expected); assert.equal(n.expected_sha256, expected); assert.notEqual(n.raw_sha256, expected);
});

test("banner gate: all four HTML pages with the banner pass", async () => {
  const urls = GATE_FILES.filter((f) => /\.html$/.test(f.url)).map((f) => f.url);
  assert.equal(urls.length, 4);
  const mutate = Object.fromEntries(urls.map((u) => [u, withBanner(fs.readFileSync(path.join(repoRoot, "public" + u), "utf8").replace(/\r\n/g, "\n"))]));
  const r = await gate(mutate);
  assert.equal(r.ok, true); assert.equal(r.normalized.length, 4);
});

test("banner gate: altered, duplicated, relocated or wrongly anchored banners and unrelated edits are rejected (token withheld)", async () => {
  const base = gitHtml();
  const good = withBanner(base);
  const cases = {
    "altered campaign id": good.replace("d8ee0b4c", "deadbeef"),
    "altered text": good.replace("Anyone can build", "Anyone may build"),
    "duplicate banner": good.replace(NETLIFY_BANNER, NETLIFY_BANNER + NETLIFY_BANNER),
    "banner twice, apart": good + NETLIFY_BANNER,
    "relocated to top": withBanner(base, "top"),
    "relocated before title": base.replace("<title>", NETLIFY_BANNER + "<title>"),
    "no charset anchor": good.replace(CHARSET, '<meta charset="utf-8" />\n'),
    "unrelated modification plus banner": good.replace("</body>", "<script>alert(1)</script></body>"),
    "unrelated modification only": base.replace("</body>", "<!-- x --></body>"),
    "stripped trailing byte plus banner": good.slice(0, -1),
  };
  for (const [label, served] of Object.entries(cases)) {
    const r = await gate({ [HTML_URL]: served });
    assert.equal(r.ok, false, label); assert.equal(r.token, null, label);
    assert.ok(r.problems.some((p) => p.startsWith(HTML_URL)), label); assert.deepEqual(r.normalized, [], label);
  }
});

test("banner gate: JS, CSS and sw.js are never normalised (banner on them fails; tampering fails)", async () => {
  for (const f of GATE_FILES.filter((x) => !/\.html$/.test(x.url))) {
    const orig = fs.readFileSync(path.join(repoRoot, f.repo), "utf8").replace(/\r\n/g, "\n");
    for (const served of [NETLIFY_BANNER + orig, orig + "\n/* tamper */", orig.replace(/\S/, "#")]) {
      const r = await gate({ [f.url]: served });
      assert.equal(r.ok, false, f.url); assert.equal(r.token, null);
      assert.ok(r.problems.some((p) => p.startsWith(f.url)), f.url); assert.deepEqual(r.normalized, []);
    }
  }
  const swBanner = await gate({ "/sw.js": NETLIFY_BANNER + swSrc });
  assert.equal(swBanner.ok, true, "sw.js is not hash-compared (pattern freshness checks only, unchanged)");
  const stale = await gate({ [HTML_URL]: withBanner(gitHtml()), "/sw.js": swSrc.replace(/WP08 G2-0/g, "X") });
  assert.equal(stale.ok, false, "a banner-normalised HTML never excuses a stale service worker");
  assert.equal(stale.token, null);
});

test("banner gate: LF vs CRLF - banner with CRLF served bytes passes; CRLF banner mixed edits still reject", async () => {
  const crlf = withBanner(gitHtml()).replace(/\n/g, "\r\n");
  const r = await gate({ [HTML_URL]: crlf });
  assert.equal(r.ok, true); assert.equal(r.normalized.length, 1);
  const bad = withBanner(gitHtml()).replace("</body>", "<b>x</b></body>").replace(/\n/g, "\r\n");
  assert.equal((await gate({ [HTML_URL]: bad })).ok, false);
});

test("banner gate: CLI prints NORMALIZED rows with raw and normalised hashes", async () => {
  const { execFileSync } = await import("node:child_process");
  const { server, origin: o } = await serve({ [HTML_URL]: withBanner(gitHtml()) });
  try {
    const out = await new Promise((res, rej) => import("node:child_process").then(({ execFile }) => execFile(process.execPath, [path.join(repoRoot, "scripts/wp08-g2-0-shared-master-data/deploy-gate.mjs"), "verify", o], (e, so) => e ? rej(e) : res(so))));
    assert.match(out, /NORMALIZED \/shared\/manage-products\.html NETLIFY_INJECTED_BANNER_V1 raw=[0-9a-f]{64} normalized=[0-9a-f]{64} expected=[0-9a-f]{64}/);
    assert.match(out, /GATE PASS\nGATE TOKEN g2-0-/);
  } finally { server.close(); }
});
