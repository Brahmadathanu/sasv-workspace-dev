// WP08 G2-1 Stage A: destination-proven resolver + permission gate. Pure, no network, no writes.
//   node --test scripts/wp08-g2-1-navigation/resolver.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveRecommendedUiRouteTarget as resolve,
  UNMAPPED_RECOMMENDED_ROUTE_CODES,
  describeRecommendedRouteUnavailable,
} from "../../public/shared/js/costing-suite-recommended-ui-route.js";
import { COSTING_ROUTE_CONFIG } from "../../public/shared/js/costing-route-config.js";
import { isConfiguredRemediationTarget } from "../../public/shared/js/costing-suite-readiness.js";
import { PRICING_POLICY_WORKSPACE_IDS } from "../../public/shared/js/costing-suite-pricing-policy.js";
import {
  armDestinationAccessGate,
  resetDestinationAccess,
  markDestinationAccessFailed,
  setDestinationAccessFromPermissionRows,
} from "../../public/shared/js/costing-destination-access.js";

// Ungated tests run first (gate not armed yet = pure resolver).
test("DRIVER_GOVERNANCE -> CBM driver-governance, no identity", () => {
  const t = resolve("DRIVER_GOVERNANCE", { productId: 1, skuId: 2, periodStart: "2026-10-01" });
  assert.equal(t.navigable, true);
  assert.equal(t.moduleKey, "cost-build-manager");
  assert.deepEqual(t.navigateParams, { lens: "driver-governance" });
  assert.ok(isConfiguredRemediationTarget(t));
});
for (const [code, lens] of [["QC_ACTION_QUEUE", "qc-action-queue"], ["MATERIALS_STORES_ACTION_QUEUE", "materials-stores-action-queue"]]) {
  test(`${code} -> CSR ${lens}, period only (queues ignore ids)`, () => {
    const t = resolve(code, { productId: 1, skuId: 2, periodStart: "2026-10-01" });
    assert.equal(t.moduleKey, "cost-sheet-review");
    assert.equal(t.lensId, lens);
    assert.deepEqual(t.navigateParams, { lens, periodStart: "2026-10-01" });
    assert.ok(COSTING_ROUTE_CONFIG["cost-sheet-review"].allowedLensIds.includes(lens));
    assert.ok(isConfiguredRemediationTarget(t));
    assert.deepEqual(resolve(code, {}).navigateParams, { lens });
  });
}
test("COMMERCIAL_SALES_ASSUMPTIONS -> exact PPM workspace from registry, no ids", () => {
  const t = resolve("COMMERCIAL_SALES_ASSUMPTIONS", { productId: 1, skuId: 2, periodStart: "2026-10-01" });
  assert.equal(t.moduleKey, "pricing-policy-manager");
  assert.equal(t.workspaceId, "commercial-sales-assumptions");
  assert.ok(PRICING_POLICY_WORKSPACE_IDS.includes(t.workspaceId));
  assert.deepEqual(t.navigateParams, { workspace: "commercial-sales-assumptions", periodStart: "2026-10-01" });
});
test("ambiguous / unmapped codes stay non-navigable (anti-guessing)", () => {
  for (const code of [...Object.keys(UNMAPPED_RECOMMENDED_ROUTE_CODES), "COST_APPROVAL_WORKBENCH", "MANAGE_PRODUCTS", "PM_BOM_MANAGER", "SOMETHING_NEW"]) {
    const t = resolve(code, { productId: 1, skuId: 2 });
    assert.equal(t.navigable, false, code);
    assert.equal(t.moduleKey, undefined, code);
  }
  assert.match(describeRecommendedRouteUnavailable("ambiguous-workspace"), /owner decision/);
});
test("existing behaviour preserved: MATERIAL_RATE_MANAGER needs blocking counts; PRM keeps product_id", () => {
  assert.equal(resolve("MATERIAL_RATE_MANAGER", { productId: 1 }).navigable, false);
  assert.equal(resolve("MATERIAL_RATE_MANAGER", { rmBlockingLineCount: 2 }).navigable, true);
  assert.equal(resolve("PRODUCTION_ROUTE_MANAGER", { productId: 7 }).navigateParams.productId, 7);
  assert.equal(resolve("PRICING_POLICY_REVIEW", { productId: 1 }).workspaceId, "sku-overview");
});

// Gated tests (armed, as the shell does at load).
const rows = (...a) => a.map(([target, can_view, can_edit]) => ({ target, can_view, can_edit }));
test("permission gate: unknown before resolution, denied, view, edit, malformed, failed", () => {
  armDestinationAccessGate();
  resetDestinationAccess();
  let t = resolve("DRIVER_GOVERNANCE", {});
  assert.equal(t.navigable, false); assert.equal(t.reason, "permission-unknown");

  setDestinationAccessFromPermissionRows(rows(["module:cost-build-manager", false, false]));
  t = resolve("DRIVER_GOVERNANCE", {});
  assert.equal(t.navigable, false); assert.equal(t.reason, "permission-denied");

  setDestinationAccessFromPermissionRows(rows(["module:cost-build-manager", true, false]));
  assert.equal(resolve("DRIVER_GOVERNANCE", {}).navigable, true, "view-only is enough to navigate");
  setDestinationAccessFromPermissionRows(rows(["module:cost-build-manager", true, true]));
  assert.equal(resolve("DRIVER_GOVERNANCE", {}).navigable, true);

  setDestinationAccessFromPermissionRows(rows(["module:cost-build-manager", "true", true]));
  assert.equal(resolve("DRIVER_GOVERNANCE", {}).reason, "permission-denied", "non-boolean truthy never grants");
  setDestinationAccessFromPermissionRows(rows(["module:cost-sheet-review", true, false]));
  assert.equal(resolve("DRIVER_GOVERNANCE", {}).reason, "permission-denied", "other module grant does not leak");
  assert.equal(resolve("QC_ACTION_QUEUE", {}).navigable, true);

  markDestinationAccessFailed();
  assert.equal(resolve("QC_ACTION_QUEUE", {}).reason, "permission-unknown");
  assert.match(describeRecommendedRouteUnavailable("permission-denied"), /permission/);
});
test("permission gate covers existing PRM/PPM/MCM targets and keeps label for text fallback", () => {
  setDestinationAccessFromPermissionRows(rows(["module:production-route-manager", false, false]));
  const t = resolve("PRODUCTION_ROUTE_MANAGER", { productId: 3 });
  assert.equal(t.navigable, false);
  assert.equal(t.label, "Open Production Route Manager");
  assert.equal(t.navigateParams, undefined, "no href material leaks for a denied target");
});
