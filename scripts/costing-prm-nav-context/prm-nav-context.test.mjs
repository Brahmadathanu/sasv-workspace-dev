// MDC-07 / N4: Production Route context persistence - pure logic, tracker and source contracts (no browser).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  COSTING_PRM_NAV_CONTEXT_V1,
  PRM_LENS_CONTEXT_KEYS,
  buildPrmNavChipValues,
  collectPrmLoadedIds,
  createPrmNavContextTracker,
  hydratePrmDeepLink,
  isCostingPrmNavContextV1Enabled,
  normalizePrmNavIds,
  reconcilePrmNavContext,
} from "../../public/shared/js/costing-suite-production-route-nav-context.js";
import { createNavContextStore } from "../../public/shared/js/costing-nav-context.js";
import { COSTING_NAV_GROUP_CONTRACT } from "../../public/shared/js/costing-nav-groups.js";
import { COSTING_ROUTE_CONFIG } from "../../public/shared/js/costing-route-config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const MAIN = read("public/shared/js/costing-suite-production-route.js");
const MODULE = read("public/shared/js/costing-suite-production-route-nav-context.js");
const ids = (o) => ({ product_id: null, product_route_id: null, route_family_id: null, family_route_id: null, ...o });

const store = (initial) => new Map(Object.entries(initial || {}));
const flag = (v) => ({ getItem: (k) => (k === COSTING_PRM_NAV_CONTEXT_V1 ? v : null) });

test("flag: default OFF; only the exact string 1 enables; storage errors fail closed", () => {
  assert.equal(COSTING_PRM_NAV_CONTEXT_V1, "COSTING_PRM_NAV_CONTEXT_V1");
  assert.equal(isCostingPrmNavContextV1Enabled(flag(null)), false);
  for (const v of ["0", "true", "on", " 1", "1 ", "01", ""]) assert.equal(isCostingPrmNavContextV1Enabled(flag(v)), false, JSON.stringify(v));
  assert.equal(isCostingPrmNavContextV1Enabled(flag("1")), true);
  assert.equal(isCostingPrmNavContextV1Enabled({ getItem() { throw new Error("denied"); } }), false);
  assert.equal(isCostingPrmNavContextV1Enabled(undefined) , false, "no localStorage in node");
});

test("normalizePrmNavIds accepts positive integers only", () => {
  assert.deepEqual(normalizePrmNavIds({ product_id: "77", product_route_id: 0, route_family_id: -3, family_route_id: "x" }), ids({ product_id: 77 }));
  assert.deepEqual(normalizePrmNavIds(null), ids({}));
});

test("reconcile: a new Product drops the route version and the unrelated Family unless one is supplied", () => {
  const prev = ids({ product_id: 77, product_route_id: 9002, route_family_id: 11, family_route_id: 300 });
  assert.deepEqual(reconcilePrmNavContext(prev, { product_id: 78 }), ids({ product_id: 78 }));
  assert.deepEqual(reconcilePrmNavContext(prev, { product_id: 78, route_family_id: 12 }), ids({ product_id: 78, route_family_id: 12 }));
  assert.deepEqual(reconcilePrmNavContext(prev, { product_id: 77 }), prev, "same product changes nothing");
  assert.deepEqual(reconcilePrmNavContext(prev, { product_id: 77, product_route_id: 9001 }), { ...prev, product_route_id: 9001 });
});

test("reconcile: a new Family drops the Family route and the Product unless one is supplied", () => {
  const prev = ids({ product_id: 77, product_route_id: 9002, route_family_id: 11, family_route_id: 300 });
  assert.deepEqual(reconcilePrmNavContext(prev, { route_family_id: 12 }), ids({ route_family_id: 12 }));
  assert.deepEqual(reconcilePrmNavContext(prev, { route_family_id: 12, product_id: 77 }), ids({ route_family_id: 12, product_id: 77, product_route_id: 9002 }));
  assert.deepEqual(reconcilePrmNavContext(prev, { route_family_id: 11 }), prev);
  assert.deepEqual(reconcilePrmNavContext(prev, {}), prev, "nothing loaded: nothing changes");
  assert.deepEqual(reconcilePrmNavContext(ids({}), { product_id: 5 }), ids({ product_id: 5 }));
});

test("reconcile: a create / chooser load clears the stored route of the same Product / Family, and only route ids", () => {
  const prev = ids({ product_id: 77, product_route_id: 9002, route_family_id: 11, family_route_id: 300 });
  assert.deepEqual(reconcilePrmNavContext(prev, { product_id: 77, clear: ["product_route_id"] }), { ...prev, product_route_id: null });
  assert.deepEqual(reconcilePrmNavContext(prev, { route_family_id: 11, clear: ["family_route_id"] }), { ...prev, family_route_id: null });
  assert.equal(reconcilePrmNavContext(prev, { product_id: 77, product_route_id: 9001, clear: ["product_route_id"] }).product_route_id, 9001, "an established id is never cleared");
  assert.deepEqual(reconcilePrmNavContext(prev, { clear: ["product_id", "route_family_id", "bogus"] }), prev, "identity ids and unknown keys are never cleared");
});

test("reconcile never mutates its inputs", () => {
  const prev = Object.freeze(ids({ product_id: 1, product_route_id: 2 }));
  const loaded = Object.freeze({ product_id: 3 });
  assert.doesNotThrow(() => reconcilePrmNavContext(prev, loaded));
});

test("hydrate: only identity lenses receive stored context; register and evidence lenses never do", () => {
  const ctx = ids({ product_id: 77, product_route_id: 9002, route_family_id: 11, family_route_id: 300 });
  assert.deepEqual(Object.keys(PRM_LENS_CONTEXT_KEYS).sort(), [
    "effective-route-viewer", "historical-candidate-review", "product-route-assignments", "product-route-editor", "route-family-route-editor",
  ]);
  for (const lens of COSTING_NAV_GROUP_CONTRACT["production-route"].flatMap((g) => g.lensIds)) {
    const dl = {};
    const r = hydratePrmDeepLink({ lensId: lens, deepLink: dl, context: ctx });
    if (!PRM_LENS_CONTEXT_KEYS[lens]) {
      assert.equal(r.deepLink, dl, `${lens}: same object, nothing injected`);
      assert.deepEqual(r.injected, []);
    }
  }
  for (const lens of ["route-readiness", "shared-workload-preview", "route-family-mapping-review", "route-family-foundation-review", "production-cost-centres", "product-subgroup-mappings", "archived-routes", "route-families"]) {
    assert.deepEqual(hydratePrmDeepLink({ lensId: lens, deepLink: {}, context: ctx }).injected, [], lens);
  }
  assert.deepEqual(hydratePrmDeepLink({ lensId: "product-route-editor", deepLink: {}, context: ctx }).deepLink, { product_id: 77, product_route_id: 9002 });
  assert.deepEqual(hydratePrmDeepLink({ lensId: "route-family-route-editor", deepLink: {}, context: ctx }).deepLink, { route_family_id: 11, family_route_id: 300 });
  assert.deepEqual(hydratePrmDeepLink({ lensId: "effective-route-viewer", deepLink: {}, context: ctx }).deepLink, { product_id: 77 });
  assert.deepEqual(hydratePrmDeepLink({ lensId: "historical-candidate-review", deepLink: {}, context: ctx }).deepLink, { product_id: 77, route_family_id: 11 });
  assert.deepEqual(hydratePrmDeepLink({ lensId: "product-route-assignments", deepLink: {}, context: ctx }).deepLink, { product_id: 77 });
});

test("hydrate: an explicit id wins; a conflicting explicit id injects nothing from the stored context", () => {
  const ctx = ids({ product_id: 77, product_route_id: 9002, route_family_id: 11 });
  // explicit different Product: no stored route version or Family may ride along
  assert.deepEqual(hydratePrmDeepLink({ lensId: "product-route-editor", deepLink: { product_id: "78" }, context: ctx }).injected, []);
  assert.deepEqual(hydratePrmDeepLink({ lensId: "historical-candidate-review", deepLink: { product_id: "78" }, context: ctx }).injected, []);
  // explicit different Family: the stored Product is unrelated
  assert.deepEqual(hydratePrmDeepLink({ lensId: "historical-candidate-review", deepLink: { route_family_id: "12" }, context: ctx }).injected, []);
  // explicit route id decides its own Product: the stored Product is not added next to it
  assert.deepEqual(hydratePrmDeepLink({ lensId: "product-route-editor", deepLink: { product_route_id: "9100" }, context: ctx }).injected, []);
  // explicit identical Product (shell keeps product_id in the URL): the rest of the context is still restored
  assert.deepEqual(hydratePrmDeepLink({ lensId: "product-route-editor", deepLink: { product_id: "77" }, context: ctx }).deepLink, { product_id: "77", product_route_id: 9002 });
  assert.deepEqual(hydratePrmDeepLink({ lensId: "historical-candidate-review", deepLink: { product_id: "77" }, context: ctx }).deepLink, { product_id: "77", route_family_id: 11 });
});

test("hydrate: a route version needs its Product (and a Family route its Family) in the stored context", () => {
  assert.deepEqual(hydratePrmDeepLink({ lensId: "product-route-editor", deepLink: {}, context: ids({ product_route_id: 9002 }) }).injected, []);
  assert.deepEqual(hydratePrmDeepLink({ lensId: "route-family-route-editor", deepLink: {}, context: ids({ family_route_id: 300 }) }).injected, []);
  assert.equal(hydratePrmDeepLink({ lensId: "product-route-editor", deepLink: {}, context: ids({}) }).injected.length, 0);
});

test("hydrate preserves unrelated deep-link keys (as_of_date, product_group_id) and never mutates the input", () => {
  const dl = Object.freeze({ as_of_date: "2026-11-01", product_group_id: "502" });
  const r = hydratePrmDeepLink({ lensId: "effective-route-viewer", deepLink: dl, context: ids({ product_id: 77 }) });
  assert.deepEqual(r.deepLink, { as_of_date: "2026-11-01", product_group_id: "502", product_id: 77 });
  assert.notEqual(r.deepLink, dl);
});

test("collectPrmLoadedIds: header ids are authoritative; evidence/register lenses establish nothing", () => {
  assert.deepEqual(collectPrmLoadedIds("product-route-editor", { deepLink: { product_id: "5", product_route_id: "9" }, productHeader: { product_route_id: 9001, product_id: 77 } }), { product_id: 77, product_route_id: 9001 });
  assert.deepEqual(collectPrmLoadedIds("product-route-editor", { deepLink: { product_id: "78" }, productHeader: null }), { product_id: 78, clear: ["product_route_id"] }, "create / chooser flow: Product only, stored route cleared");
  assert.equal(collectPrmLoadedIds("product-route-editor", { deepLink: { product_route_id: "9" }, productHeader: null }), null, "failed/absent header: nothing established");
  assert.deepEqual(collectPrmLoadedIds("route-family-route-editor", { deepLink: {}, familyHeader: { family_route_id: 300, route_family_id: 11 } }), { route_family_id: 11, family_route_id: 300 });
  assert.deepEqual(collectPrmLoadedIds("effective-route-viewer", { effectiveViewer: { status: "ready", productId: 77, payload: { route_family_id: 11 } } }), { product_id: 77, route_family_id: 11 });
  assert.equal(collectPrmLoadedIds("effective-route-viewer", { effectiveViewer: { status: "loading", productId: 77 } }), null);
  assert.equal(collectPrmLoadedIds("effective-route-viewer", { effectiveViewer: { status: "error", productId: 77 } }), null);
  for (const lens of ["route-readiness", "shared-workload-preview", "route-family-mapping-review", "route-family-foundation-review", "production-cost-centres", "product-subgroup-mappings", "archived-routes", "route-families"]) {
    assert.equal(collectPrmLoadedIds(lens, { deepLink: { product_id: "1", route_family_id: "2" } }), null, lens);
  }
});

test("chip values: names only when supplied, never invented; empty ids remove chips; no run", () => {
  assert.deepEqual(buildPrmNavChipValues(ids({}), {}), { product: "", family: "", route: "" });
  assert.deepEqual(buildPrmNavChipValues(ids({ product_id: 77, route_family_id: 11, product_route_id: 9002 }), { product: "Mock Product", family: "" }), {
    product: "Mock Product (#77)", family: "Family #11", route: "Product route #9002",
  });
  assert.equal(buildPrmNavChipValues(ids({ product_route_id: 1, family_route_id: 2 })).route, "Product route #1 · Family route #2");
  assert.equal("run" in buildPrmNavChipValues(ids({ product_id: 1 })), false);
});

function tracker(enabled = true, extra = {}) {
  const s = createNavContextStore();
  const t = createPrmNavContextTracker({ isEnabled: () => enabled, store: s, getNames: () => ({ product: "Mock Product", family: "Mock Family" }), ...extra });
  return { t, s };
}

test("tracker flag OFF: every method is inert and the store is never touched", () => {
  const { t, s } = tracker(false);
  s.set({ run: "82", period: "2026-10-01" });
  let events = 0;
  s.subscribe(() => events++);
  const dl = { product_id: "5" };
  assert.equal(t.hydrate("product-route-editor", dl).deepLink, dl);
  assert.equal(t.commit("effective-route-viewer", { effectiveViewer: { status: "ready", productId: 77, payload: {} } }), false);
  assert.equal(t.selectFamily(11), false);
  assert.equal(t.invalidate(["product_id"]), false);
  t.clear();
  assert.deepEqual(t.get(), ids({}));
  assert.deepEqual(s.get(), { run: "82", period: "2026-10-01" });
  assert.equal(events, 0);
});

test("tracker ON: commit feeds the N1 store with Product / Family / Route only; run and period are never touched", () => {
  const { t, s } = tracker(true);
  s.set({ run: "80", period: "2026-10-01" });
  t.commit("product-route-editor", { deepLink: {}, productHeader: { product_route_id: 9002, product_id: 77 } });
  assert.deepEqual(s.get(), { run: "80", period: "2026-10-01", product: "Mock Product (#77)", route: "Product route #9002" });
  t.commit("effective-route-viewer", { effectiveViewer: { status: "ready", productId: 77, payload: { route_family_id: 11 } } });
  assert.equal(s.get().family, "Mock Family (#11)");
  assert.equal(s.get().run, "80", "historical run chip is left exactly as the shell/controller set it");
});

test("tracker ON: switching Product clears the old route and Family chips (no stale carry)", () => {
  const { t, s } = tracker(true);
  t.commit("effective-route-viewer", { effectiveViewer: { status: "ready", productId: 77, payload: { route_family_id: 11 } } });
  t.commit("product-route-editor", { deepLink: {}, productHeader: { product_route_id: 9002, product_id: 77 } });
  assert.deepEqual(t.get(), ids({ product_id: 77, product_route_id: 9002, route_family_id: 11 }));
  t.commit("product-route-editor", { deepLink: { product_id: "78" }, productHeader: null });
  assert.deepEqual(t.get(), ids({ product_id: 78 }));
  assert.equal(s.get().route, undefined);
  assert.equal(s.get().family, undefined);
  assert.equal(s.get().product, "Mock Product (#78)");
});

test("tracker ON: selectFamily replaces Family context and drops the unrelated Product", () => {
  const { t } = tracker(true);
  t.commit("effective-route-viewer", { effectiveViewer: { status: "ready", productId: 77, payload: { route_family_id: 11 } } });
  t.selectFamily(12);
  assert.deepEqual(t.get(), ids({ route_family_id: 12 }));
  assert.equal(t.selectFamily("abc"), false);
  assert.equal(t.selectFamily(0), false);
});

test("tracker ON: invalidate forgets a failed hydrated id and its dependants only", () => {
  const { t } = tracker(true);
  t.commit("product-route-editor", { deepLink: {}, productHeader: { product_route_id: 9002, product_id: 77 } });
  t.invalidate(["product_route_id"]);
  assert.deepEqual(t.get(), ids({ product_id: 77 }));
  t.invalidate(["product_id"]);
  assert.deepEqual(t.get(), ids({}));
});

test("tracker clear removes only its own chips and leaves other store keys alone", () => {
  const { t, s } = tracker(true);
  s.set({ run: "82", period: "2026-10-01", basis: "FIXED_HISTORICAL" });
  t.commit("effective-route-viewer", { effectiveViewer: { status: "ready", productId: 77, payload: {} } });
  t.clear();
  assert.deepEqual(s.get(), { run: "82", period: "2026-10-01", basis: "FIXED_HISTORICAL" });
});

test("tracker survives a throwing flag reader and a throwing name lookup", () => {
  const s = createNavContextStore();
  const t = createPrmNavContextTracker({ isEnabled: () => { throw new Error("x"); }, store: s });
  assert.equal(t.isEnabled(), false);
  const t2 = createPrmNavContextTracker({ isEnabled: () => true, store: s, getNames: () => { throw new Error("names"); } });
  t2.commit("effective-route-viewer", { effectiveViewer: { status: "ready", productId: 5, payload: {} } });
  assert.equal(s.get().product, "Product #5");
});

test("rapid changes: later commits always win, earlier ones cannot resurrect their ids", () => {
  const { t } = tracker(true);
  for (const pid of [1, 2, 3, 4, 5]) t.commit("effective-route-viewer", { effectiveViewer: { status: "ready", productId: pid, payload: { route_family_id: pid + 100 } } });
  assert.deepEqual(t.get(), ids({ product_id: 5, route_family_id: 105 }));
});

// ---- source contracts ----
test("source: the module is pure - no RPC, supabase, DOM, storage writes, dates, run numbers or current-run resolver", () => {
  assert.doesNotMatch(MODULE, /\.rpc\(|costingRpc|supabase|document\.|window\.|sessionStorage|setItem|removeItem|new Date|Date\.now|fetch\(/);
  assert.doesNotMatch(MODULE, /\b(80|82)\b/, "no fixed run number");
  assert.doesNotMatch(MODULE, /run:\s*["'`]|set\(\{[^}]*\brun\b|current[_-]?run|resolveRun|costing_run_id/i);
  assert.match(MODULE, /=== "1"/);
});

test("source: controller wiring is flag-gated - OFF delegates straight to the unchanged loader", () => {
  assert.match(MAIN, /if \(!navContext\.isEnabled\(\)\) return loadPrmLens\(options\);/);
  assert.match(MAIN, /async function loadPrmLens\(\{ lens, deepLink = \{\}, resetOffset = false, search \} = \{\}\) \{\n    if \(disposed\) return \{ ok: false \};/);
  assert.equal((MAIN.match(/explicit: true,/g) || []).length, 2, "only navigate() marks its loads explicit");
  assert.match(MAIN, /if \(disposed \|\| !result \|\| result\.stale !== false \|\| result\.generation !== lensRenderGeneration\) return result;/);
  assert.match(MAIN, /if \(state\.activeLens === "route-families"\) navContext\.selectFamily\(routeFamilyId\);/);
  assert.match(MAIN, /function syncNavProductToUrl\(productId\) \{\n    if \(!navContext\.isEnabled\(\) \|\| typeof window === "undefined"\) return;/, "URL sync is flag-gated");
});

test("source: RPC names, lens ids and P02 safeguards in the controller are unchanged", () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, "scripts/costing-prm-corrections/rpc-names.baseline.json"), "utf8"));
  assert.deepEqual([...new Set(MAIN.match(/"rpc_[a-z0-9_]+"/g) || [])].sort(), baseline);
  for (const marker of ["resolveSupersedeGate", "selectSupersedeReplacementRoutes", "openSupersedeSelectorDialog", "bindProductEditorPicker", "openCreateFamilyModal", "state.supersedeChoices = null"]) {
    assert.ok(MAIN.includes(marker), marker);
  }
  const cfg = COSTING_ROUTE_CONFIG["production-route-manager"];
  assert.equal(cfg.allowedLensIds.length, 13);
  assert.equal(COSTING_NAV_GROUP_CONTRACT["production-route"].flatMap((g) => g.lensIds).length, 13);
});

test("source: three evidence lenses stay three separate lenses in the Review group, never merged or tabbed by N4", () => {
  const review = COSTING_NAV_GROUP_CONTRACT["production-route"].find((g) => g.id === "review");
  for (const id of ["route-family-mapping-review", "route-family-foundation-review", "historical-candidate-review"]) {
    assert.ok(review.lensIds.includes(id));
    assert.ok(cfgLensIds().includes(id));
  }
  assert.doesNotMatch(MODULE, /mapping-review|foundation-review/, "N4 context code does not touch the fixed-historical evidence lenses");
});
function cfgLensIds() { return COSTING_ROUTE_CONFIG["production-route-manager"].allowedLensIds; }

test("scope guard: N1 shared files, registry, route config, HTML, SQL and cache are untouched by this package", () => {
  let changed;
  try {
    // Compared with current main (N1/N2/N3 merged) so only this package's own files are judged.
    changed = execFileSync("git", ["diff", "--name-only", "7f46f3784dcbc2b5059e940763c80befd3437746"], { cwd: root, encoding: "utf8" })
      .split("\n").filter(Boolean);
    changed.push(...execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean));
  } catch {
    return; // no git / base commit not available: skip
  }
  const forbidden = /(^|\/)(costing-suite-shell|costing-suite-registry|costing-route-config|costing-nav-groups|costing-nav-context|costing-feature-flags)\.js$|sasv-costing\.css$|\.html$|^supabase\/|^sql\/|sw\.js$|service-worker|cache/i;
  assert.deepEqual(changed.filter((f) => forbidden.test(f)), []);
});
