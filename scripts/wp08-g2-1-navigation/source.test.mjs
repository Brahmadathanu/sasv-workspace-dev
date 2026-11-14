// WP08 G2-1 source-pinned guards: bounded change, no new data/permission surface, writer-free selection, SW freshness,
// G2-0 guard and activation artefacts untouched, canonical shared source only. No network.
//   node --test scripts/wp08-g2-1-navigation/source.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const G21_START = "26e3f9f29f5a22bdc6cdd82b66ba19918047ad51"; // main at WP08 G2-1 start
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const base = (rel) => git("show", `${G21_START}:${rel}`).replace(/\r\n/g, "\n");
const PAGES = ["products", "manage-rm-bom", "manage-sp-bom", "manage-pm-bom"].map((n) => `public/shared/js/${n}.js`);

test("reader/writer surface of the four pages is unchanged vs G2-1 start (same rpc names, tables, permission strings)", () => {
  const tok = (t) => ({
    rpc: [...t.matchAll(/\.rpc\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]).sort(),
    from: [...t.matchAll(/\.from\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]).sort(),
    perm: [...t.matchAll(/module:[a-z-]+/g)].map((m) => m[0]).sort(),
  });
  for (const f of PAGES) {
    const a = tok(read(f)); const b = tok(base(f));
    if (f.endsWith("products.js")) { b.perm = [...new Set(b.perm)]; a.perm = [...new Set(a.perm)]; }
    assert.deepEqual(a.rpc, b.rpc, `${f} rpc`);
    assert.deepEqual(a.from, b.from, `${f} tables`);
    assert.deepEqual(a.perm, b.perm, `${f} permission strings`);
  }
});
test("selection module and destination-access module are data-free: no supabase, rpc, fetch, XHR, storage", () => {
  for (const f of ["public/shared/js/master-data-selection.js", "public/shared/js/costing-destination-access.js"]) {
    const t = read(f);
    assert.doesNotMatch(t, /supabase|\.rpc\(|\.from\(|fetch\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon/, f);
    assert.doesNotMatch(t, /^import .*$/m, `${f} has no imports (cannot reach a data client)`);
  }
});
test("resolver never imports a data client or performs I/O", () => {
  const t = read("public/shared/js/costing-suite-recommended-ui-route.js");
  assert.doesNotMatch(t, /supabase|\.rpc\(|fetch\(|window\./);
  assert.deepEqual([...t.matchAll(/^import[^;]+from "([^"]+)"/gms)].map((m) => m[1]).sort(), ["./costing-destination-access.js", "./costing-route-config.js", "./costing-suite-commercial-sales-assumptions.js"]);
});
test("URL selection applies only through existing page readers: apply functions contain no writer RPC/table call", () => {
  for (const [f, fn] of [["products.js", "applySelectionFromUrl"], ["manage-rm-bom.js", "applyRmDeepLink"], ["manage-sp-bom.js", "applySpDeepLink"], ["manage-pm-bom.js", "applyPmDeepLink"]]) {
    const t = read(`public/shared/js/${f}`);
    const m = new RegExp(`(?:async )?function ${fn}\\b[\\s\\S]*?\\n\\}\\n`).exec(t);
    assert.ok(m, `${fn} found`);
    assert.doesNotMatch(m[0], /\.rpc\(|\.from\(|insert|upsert|\.update\(|\.delete\(/, `${fn} performs no data call itself`);
  }
  const pm = read("public/shared/js/manage-pm-bom.js");
  assert.doesNotMatch(/async function applyPmDeepLink[\s\S]*?\n\}\n/.exec(pm)[0], /refreshPreview|rebuild|rpc_pm/);
});
test("identity semantics are recorded in the contract: SP BOM keyed by owner stock item, RM by product, PM by SKU", () => {
  const sel = read("public/shared/js/master-data-selection.js");
  assert.match(sel, /manage-sp-bom\s+owner_item_id[\s\S]*STOCK ITEM, not a product/);
  assert.match(base("public/shared/js/manage-sp-bom.js"), /\.eq\("owner_item_id", ownerId\)/);
  assert.match(base("public/shared/js/manage-rm-bom.js"), /\.eq\("product_id", pid\)/);
});
test("existing guards, permission keys and G2-0 activation artefacts are untouched", () => {
  for (const f of ["public/shared/js/master-data-write-guard.js", "public/shared/js/master-data-platform.js"]) {
    assert.equal(read(f), base(f), `${f} unchanged`);
  }
  const changed = git("diff", "--name-only", G21_START, "HEAD").split("\n").filter(Boolean);
  for (const f of changed) {
    assert.doesNotMatch(f, /^supabase\//, `no SQL/migration change: ${f}`);
    assert.doesNotMatch(f, /WP08_G2_0_REGISTRY_PROPOSAL_UNAPPLIED|permission|registry-proposal/i, `no activation/permission artefact: ${f}`);
    assert.doesNotMatch(f, /^(?:main|preload)\.js$|^manage-.*\.html$|^js\//, `no Electron/root legacy change: ${f}`);
    assert.doesNotMatch(f, /^public\/shared\/manage-.*\.html$/, `no page HTML change: ${f}`);
  }
  assert.ok(!fs.existsSync(path.join(root, "public/shared/js/manage-pm-bom-key.js")));
  const pmNow = read("public/shared/js/manage-pm-bom.js");
  assert.equal((pmNow.match(/module:pm-templates/g) ?? []).length, (base("public/shared/js/manage-pm-bom.js").match(/module:pm-templates/g) ?? []).length, "permission literal unchanged");
  assert.doesNotMatch(pmNow + read("public/shared/js/master-data-selection.js"), /module:manage-pm-bom/, "no new PM permission key");
});
test("service worker: new modules are network-first; CACHE_NAME unchanged; G2-0 pattern byte-identical", () => {
  const sw = read("public/sw.js");
  assert.equal((sw.match(/const CACHE_NAME = "hub-cache-v393"/g) ?? []).length, 1);
  assert.ok(sw.includes("products|manage-rm-bom|manage-pm-bom|manage-sp-bom|master-data-platform|master-data-write-guard)"));
  for (const m of ["costing-suite-recommended-ui-route", "costing-destination-access", "master-data-selection", "costing-suite-control-center"]) assert.match(sw, new RegExp(m));
  const net = sw.indexOf("master-data-selection"); const handler = sw.indexOf('fetch(req, { cache: "no-store" })', net);
  assert.ok(net > 0 && handler > net, "patterns sit in the network-first condition, ahead of its no-store fetch handler");
});
test("one canonical source: no duplicate of the new modules at repo root or js/", () => {
  for (const f of ["master-data-selection.js", "costing-destination-access.js"]) {
    assert.ok(!fs.existsSync(path.join(root, "js", f)));
    assert.ok(!fs.existsSync(path.join(root, f)));
  }
});
test("route-code matrix is complete: every server-literal code is either proven-navigable or documented text-only", () => {
  const t = read("public/shared/js/costing-suite-recommended-ui-route.js");
  for (const code of ["DRIVER_GOVERNANCE", "QC_ACTION_QUEUE", "MATERIALS_STORES_ACTION_QUEUE", "COMMERCIAL_SALES_ASSUMPTIONS"]) assert.match(t, new RegExp(`"${code}"`));
  for (const code of ["MRP_GOVERNANCE", "SELLING_SCHEME_POLICIES", "BATCH_SIZES", "REGIONAL_MARKETING_REVIEW"]) assert.match(t, new RegExp(`${code}: "(?:ambiguous-workspace|unmapped)"`));
});
