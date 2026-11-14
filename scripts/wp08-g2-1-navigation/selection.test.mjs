// WP08 G2-1 pure tests: selection URL contract parsing/building, anti-guessing, permission offer rules. No DOM, no network.
//   node --test scripts/wp08-g2-1-navigation/selection.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  MASTER_DATA_PAGES, parseStrictId, parseMasterDataSelection as parse, buildMasterDataHref as build, canOfferMasterDataLink,
} from "../../public/shared/js/master-data-selection.js";
import {
  buildRecommendedRouteHref, resolveRecommendedUiRouteTarget as resolve, recommendedTargetCarriesIdentity,
} from "../../public/shared/js/costing-suite-recommended-ui-route.js";
import { PRICING_POLICY_WORKSPACES } from "../../public/shared/js/costing-suite-pricing-policy.js";

test("permission keys: PM BOM stays module:pm-templates; no manage-pm-bom key introduced", () => {
  assert.equal(MASTER_DATA_PAGES["pm-templates"].permissionTarget, "module:pm-templates");
  assert.equal(MASTER_DATA_PAGES["pm-templates"].file, "manage-pm-bom.html");
  assert.ok(!("manage-pm-bom" in MASTER_DATA_PAGES));
  assert.deepEqual(Object.keys(MASTER_DATA_PAGES).sort(), ["manage-products", "manage-rm-bom", "manage-sp-bom", "pm-templates"]);
});
test("strict ids", () => {
  for (const ok of ["1", "42", 7, "9007199254740991"]) assert.ok(parseStrictId(ok) !== null, String(ok));
  for (const bad of ["", "0", "-1", "1.5", "1e3", " 1", "01", "abc", "1;DROP", "9007199254740993", "12345678901234567", null, undefined, {}, [], NaN, 1.5, -2, 0]) assert.equal(parseStrictId(bad), null, String(bad));
});
test("parse: Manage Products", () => {
  assert.deepEqual(parse("?product_id=11&sku_id=501&tab=skus", "manage-products"), { present: true, productId: 11, skuId: 501, ownerItemId: null, tab: "skus", issues: [] });
  assert.equal(parse("", "manage-products").present, false);
  assert.equal(parse("?lens=x&foo=1", "manage-products").present, false, "unrelated params are not selection");
  const dup = parse("?product_id=1&product_id=2", "manage-products");
  assert.equal(dup.productId, null); assert.match(dup.issues[0], /more than once/);
  assert.match(parse("?tab=bogus", "manage-products").issues[0], /tab is not recognised/);
  assert.equal(parse("?product_id=1&tab=PRODUCTS", "manage-products").tab, null, "tab is case-exact");
});
test("parse: pages ignore keys outside their own contract (no cross-contract guessing)", () => {
  assert.equal(parse("?sku_id=5", "manage-rm-bom").skuId, null);
  assert.equal(parse("?product_id=5", "pm-templates").productId, null);
  assert.equal(parse("?tpl_id=5&template_id=5", "pm-templates").present, false, "PM template id is not a SKU id");
  const sp = parse("?product_id=5", "manage-sp-bom");
  assert.equal(sp.ownerItemId, null); assert.match(sp.issues[0], /not an SP BOM identity/);
  assert.equal(parse("?owner_item_id=9", "manage-sp-bom").ownerItemId, 9);
  assert.equal(parse("?owner_item_id=9", "manage-rm-bom").present, false);
  assert.equal(parse("?product_id=1", "unknown-page").present, false);
});
test("build: strict, contract-bound, relative same-folder hrefs", () => {
  assert.equal(build("manage-products", { productId: 11 }), "manage-products.html?product_id=11");
  assert.equal(build("manage-products", { productId: 11, skuId: 501, tab: "readiness" }), "manage-products.html?product_id=11&sku_id=501&tab=readiness");
  assert.equal(build("manage-products", { skuId: 501 }), null, "sku_id without product_id is never built");
  assert.equal(build("manage-products", { productId: 11, tab: "x" }), null);
  assert.equal(build("manage-products", { productId: "11; x" }), null);
  assert.equal(build("manage-rm-bom", { productId: 11 }), "manage-rm-bom.html?product_id=11");
  assert.equal(build("manage-rm-bom", {}), null);
  assert.equal(build("manage-sp-bom", { ownerItemId: 901 }), "manage-sp-bom.html?owner_item_id=901");
  assert.equal(build("manage-sp-bom", { productId: 11 }), null, "no Product -> SP owner guess");
  assert.equal(build("pm-templates", { skuId: 501 }), "manage-pm-bom.html?sku_id=501");
  assert.equal(build("pm-templates", { productId: 11 }), null);
  for (const h of ["manage-products.html?product_id=1"]) assert.ok(!/^[/]|:/.test(h), "relative, platform-neutral");
});
test("offer rules: only boolean can_view === true on the destination's own row", () => {
  const rows = (...a) => a.map(([target, can_view]) => ({ target, can_view }));
  assert.equal(canOfferMasterDataLink("manage-rm-bom", rows(["module:manage-rm-bom", true])), true);
  assert.equal(canOfferMasterDataLink("manage-rm-bom", rows(["module:manage-rm-bom", false])), false);
  assert.equal(canOfferMasterDataLink("manage-rm-bom", rows(["module:manage-rm-bom", "true"])), false);
  assert.equal(canOfferMasterDataLink("manage-rm-bom", rows(["module:manage-products", true])), false);
  assert.equal(canOfferMasterDataLink("pm-templates", rows(["module:manage-pm-bom", true])), false, "wrong key never grants PM BOM");
  assert.equal(canOfferMasterDataLink("pm-templates", rows(["module:pm-templates", true])), true);
  assert.equal(canOfferMasterDataLink("manage-rm-bom", null), false);
  assert.equal(canOfferMasterDataLink("manage-rm-bom", []), false);
});
test("standalone Costing hrefs: sibling-relative, PPM never carries ids", () => {
  assert.equal(buildRecommendedRouteHref(resolve("PRODUCTION_ROUTE_MANAGER", { productId: 3 })), "production-route-manager.html?lens=product-route-assignments&product_id=3");
  assert.equal(buildRecommendedRouteHref(resolve("DRIVER_GOVERNANCE", {})), "cost-build-manager.html?lens=driver-governance");
  const ppm = resolve("PRICING_POLICY_REVIEW", { productId: 3, skuId: 4 });
  assert.equal(recommendedTargetCarriesIdentity(ppm), false);
  assert.equal(buildRecommendedRouteHref(ppm), "pricing-policy-manager.html?workspace=sku-overview");
  assert.equal(buildRecommendedRouteHref(resolve("MRP_GOVERNANCE", { productId: 3 })), null);
  assert.equal(buildRecommendedRouteHref(resolve("MATERIAL_RATE_MANAGER", {})), null);
});
test("PPM identity tripwire: no PPM workspace declares Product/SKU focus support (owner decision pending)", () => {
  for (const w of PRICING_POLICY_WORKSPACES) {
    assert.ok(!Object.keys(w).some((k) => /product|sku.?focus|identity|rowfocus/i.test(k)), `${w.id} must not claim identity support; update the G2-1 matrix if this changes`);
  }
  for (const id of ["sku-mrp-policies", "product-derivation-policies", "mrp-proposals", "sku-overview", "scheme-master", "scheme-rule-register", "commercial-sales-assumptions"]) {
    assert.ok(PRICING_POLICY_WORKSPACES.some((w) => w.id === id), `workspace ${id} exists in the registry`);
  }
});
