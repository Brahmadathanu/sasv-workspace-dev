// Issue #395 (WP07 P8): lens-aware presentation of remembered PRM context chips - pure tracker + source contracts.
// Chips are shown only on an identity lens (PRM_LENS_CONTEXT_KEYS); every other accepted lens publishes none, while the
// remembered ids and N4 hydration are untouched. No browser here; see prm-nav-lens-presentation-browser.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_LENS_CONTEXT_KEYS,
  createPrmNavContextTracker,
  hydratePrmDeepLink,
  isPrmIdentityLens,
} from "../../public/shared/js/costing-suite-production-route-nav-context.js";
import { createNavContextStore } from "../../public/shared/js/costing-nav-context.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const MAIN = read("public/shared/js/costing-suite-production-route.js");

const IDENTITY = Object.keys(PRM_LENS_CONTEXT_KEYS);
const NON_IDENTITY = [
  "shared-workload-preview",
  "route-readiness",
  "route-family-mapping-review",
  "route-family-foundation-review",
  "production-cost-centres",
  "product-subgroup-mappings",
  "archived-routes",
  "route-families",
];
const NAMES = { product: "Mock Product", family: "Mock Family" };
const make = (enabled = true) => {
  const store = createNavContextStore();
  const flag = { on: enabled };
  const t = createPrmNavContextTracker({ isEnabled: () => flag.on, store, getNames: () => NAMES });
  return { store, t, flag };
};
const shown = (store) => {
  const s = store.get();
  return { product: s.product ?? "", family: s.family ?? "", route: s.route ?? "" };
};
const NONE = { product: "", family: "", route: "" };
const ev = (productId, familyId) => ({ effectiveViewer: { status: "ready", productId, payload: { route_family_id: familyId } } });

test("isPrmIdentityLens: exactly the lenses of PRM_LENS_CONTEXT_KEYS (no prototype keys, no non-strings)", () => {
  for (const l of IDENTITY) assert.equal(isPrmIdentityLens(l), true, l);
  for (const l of NON_IDENTITY) assert.equal(isPrmIdentityLens(l), false, l);
  for (const l of ["toString", "constructor", "__proto__", "", null, undefined, 7]) assert.equal(isPrmIdentityLens(l), false, String(l));
});

test("identity lens commit shows chips; accepted non-identity commit (no identity established) clears them", () => {
  const { store, t } = make();
  t.commit("effective-route-viewer", ev(77, 11));
  assert.deepEqual(shown(store), { product: "Mock Product (#77)", family: "Mock Family (#11)", route: "" });
  for (const lens of NON_IDENTITY) {
    t.commit("effective-route-viewer", ev(77, 11));
    assert.notDeepEqual(shown(store), NONE, "precondition: chips shown");
    assert.equal(t.commit(lens, {}), false, `${lens}: establishes no identity`);
    assert.deepEqual(shown(store), NONE, `${lens}: chips cleared even though commit returned false`);
  }
});

test("remembered context is preserved across non-identity lenses and restored on return to an identity lens", () => {
  const { store, t } = make();
  t.commit("effective-route-viewer", ev(77, 11));
  const before = t.get();
  t.commit("shared-workload-preview", {});
  t.commit("route-readiness", {});
  assert.deepEqual(t.get(), before, "stored ids unchanged by presentation");
  // Return to an identity lens that establishes nothing new (e.g. a Product Route Editor chooser without ids).
  t.present("product-route-editor");
  assert.deepEqual(shown(store), { product: "Mock Product (#77)", family: "Mock Family (#11)", route: "" });
  assert.deepEqual(t.get(), before);
});

test("hydrate semantics are unchanged by presentation: identity lenses still receive stored ids, register lenses never do", () => {
  const { t } = make();
  t.commit("effective-route-viewer", ev(77, 11));
  t.present("shared-workload-preview");
  assert.deepEqual(t.hydrate("effective-route-viewer", {}).injected, ["product_id"]);
  assert.deepEqual(t.hydrate("shared-workload-preview", {}), { deepLink: {}, injected: [] });
  assert.deepEqual(t.hydrate("route-readiness", { product_id: "5" }).injected, []);
  // pure function parity
  assert.deepEqual(hydratePrmDeepLink({ lensId: "shared-workload-preview", deepLink: {}, context: t.get() }).injected, []);
});

test("Product A -> B: no stale chips from A at any point; Workload hides both", () => {
  const { store, t } = make();
  t.commit("effective-route-viewer", ev(77, 11));
  t.commit("effective-route-viewer", ev(78, 12));
  assert.match(store.get().product, /#78/);
  assert.doesNotMatch(JSON.stringify(store.get()), /#77|#11\b/);
  t.commit("shared-workload-preview", {});
  assert.deepEqual(shown(store), NONE);
  t.present("effective-route-viewer");
  assert.match(store.get().product, /#78/);
  assert.doesNotMatch(JSON.stringify(store.get()), /#77/);
});

test("route chip (Product route version) follows the same rule", () => {
  const { store, t } = make();
  t.commit("product-route-editor", { productHeader: { product_id: 77, product_route_id: 9002 } });
  assert.equal(store.get().route, "Product route #9002");
  t.commit("route-readiness", {});
  assert.equal(store.get().route ?? "", "");
  t.present("product-route-editor");
  assert.equal(store.get().route, "Product route #9002");
});

test("selectFamily / invalidate publish consistently with the active lens", () => {
  const { store, t } = make();
  t.commit("route-family-route-editor", { familyHeader: { route_family_id: 11, family_route_id: 300 } });
  assert.match(store.get().family, /#11/);
  t.commit("route-families", {});
  assert.deepEqual(shown(store), NONE);
  t.selectFamily(12); // Route Families is not an identity lens: remembered, not shown
  assert.deepEqual(shown(store), NONE);
  assert.equal(t.get().route_family_id, 12);
  t.present("historical-candidate-review");
  assert.match(store.get().family, /#12/);
  t.present("route-readiness");
  t.invalidate(["route_family_id"]);
  assert.deepEqual(shown(store), NONE);
  assert.equal(t.get().route_family_id, null);
});

test("period / run / basis and other modules' keys in the shared store are never touched", () => {
  const { store, t } = make();
  store.set({ run: "Run 42", period: "2026-10", basis: "FIXED_HISTORICAL" });
  const keep = () => ({ run: store.get().run, period: store.get().period });
  t.commit("effective-route-viewer", ev(77, 11));
  t.commit("shared-workload-preview", {});
  t.present("route-readiness");
  assert.deepEqual(keep(), { run: "Run 42", period: "2026-10" });
});

test("flag OFF: present / commit / selectFamily / invalidate stay inert and never touch the store", () => {
  const { store, t } = make(false);
  let emitted = 0;
  store.subscribe(() => { emitted += 1; });
  assert.equal(t.present("shared-workload-preview"), false);
  assert.equal(t.commit("shared-workload-preview", {}), false);
  assert.equal(t.commit("effective-route-viewer", ev(77, 11)), false);
  assert.equal(t.selectFamily(11), false);
  assert.equal(t.invalidate(["product_id"]), false);
  assert.equal(emitted, 0);
  assert.deepEqual(store.get(), {});
});

test("flag turned OFF after use: chips are not re-published by present()", () => {
  const { store, t, flag } = make();
  t.commit("effective-route-viewer", ev(77, 11));
  flag.on = false;
  const snapshot = JSON.stringify(store.get());
  t.present("shared-workload-preview");
  assert.equal(JSON.stringify(store.get()), snapshot);
});

test("before any accepted load the tracker behaves as before (empty context, nothing shown)", () => {
  const { store, t } = make();
  t.selectFamily(11); // legacy path without an accepted lens still publishes stored context
  assert.match(store.get().family, /#11/);
  t.clear();
  assert.deepEqual(shown(store), NONE);
});

test("source contract: controller re-presents on every accepted load, before invalidating a failed one; shell untouched", () => {
  const load = MAIN.slice(MAIN.indexOf("async function load(options = {})"), MAIN.indexOf("async function loadPrmLens("));
  assert.ok(load.includes("navContext.commit(state.activeLens"), "commit on accepted loads");
  const failBlock = load.slice(load.indexOf("if (result.ok === false)"), load.indexOf("navContext.commit(state.activeLens"));
  assert.ok(failBlock.indexOf("navContext.present(state.activeLens)") >= 0, "failed accepted load re-presents");
  assert.ok(failBlock.indexOf("navContext.present(") < failBlock.indexOf("navContext.invalidate("), "present before invalidate");
  assert.ok(load.indexOf("result.stale !== false") < load.indexOf("navContext.present("), "stale / superseded loads return before presenting");
});
