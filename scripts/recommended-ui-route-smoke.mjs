/**
 * Gate 11Y.10G.2 — Stage-05 recommended_ui_route resolver smoke.
 * No live DB / refresh / valuation mutation.
 */
import {
  DIRECT_LABOUR_ROUTE_BLOCKED_MESSAGE,
  DIRECT_LABOUR_ROUTE_BLOCKED_STATUS,
  NO_VERIFIED_RATE_MANAGER_REMEDIATION,
  formatFirstControlStatusLabel,
  formatRecommendedUiRouteLabel,
  resolveRecommendedUiRouteTarget,
  resolveSkuControlPrimaryMessage,
  resolveSkuControlSecondaryMaterialMessage,
} from "../public/shared/js/costing-suite-recommended-ui-route.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const controlSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-control-center.js"),
  "utf8",
);
const registrySrc = readFileSync(
  join(root, "public/shared/js/costing-suite-registry.js"),
  "utf8",
);
const routeConfigSrc = readFileSync(
  join(root, "public/shared/js/costing-route-config.js"),
  "utf8",
);
const shellSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
const resolverSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-recommended-ui-route.js"),
  "utf8",
);

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

function sameStringList(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  return expected.every((value, index) => actual[index] === value);
}

// ---------------------------------------------------------------------------
// A. PRM — existing assertions unchanged
// ---------------------------------------------------------------------------
const withProduct = resolveRecommendedUiRouteTarget("PRODUCTION_ROUTE_MANAGER", {
  productId: 42,
});
assert(withProduct.navigable === true, "PRODUCTION_ROUTE_MANAGER + product navigable");
assert(
  withProduct.moduleKey === "production-route-manager",
  "maps to production-route-manager",
);
assert(
  withProduct.lensId === "product-route-assignments",
  "lens product-route-assignments with product",
);
assert(withProduct.productId === 42, "product_id preserved");
assert(
  withProduct.navigateParams?.lens === "product-route-assignments" &&
    withProduct.navigateParams?.productId === 42,
  "navigateParams carry lens + productId",
);
assert(withProduct.newTab === true, "opens in new tab");
assert(
  withProduct.label === "Open Production Route Manager",
  "CTA label Open Production Route Manager",
);

const withoutProduct = resolveRecommendedUiRouteTarget("production_route_manager", {});
assert(
  withoutProduct.navigable === true &&
    withoutProduct.moduleKey === "production-route-manager" &&
    withoutProduct.lensId === "route-readiness",
  "missing product → route-readiness fallback",
);
assert(
  withoutProduct.navigateParams?.lens === "route-readiness" &&
    withoutProduct.navigateParams?.productId == null &&
    Object.keys(withoutProduct.navigateParams || {}).length === 1,
  "fallback navigateParams only lens (no invented product filter)",
);

const unknown = resolveRecommendedUiRouteTarget("COST_SOURCE_REVIEW", {
  productId: 1,
});
assert(unknown.navigable === false, "unknown route not navigable");
assert(
  typeof unknown.label === "string" && unknown.label.length > 0,
  "unknown route still has display label",
);

assert(
  resolveRecommendedUiRouteTarget("").navigable === false &&
    resolveRecommendedUiRouteTarget(null).navigable === false,
  "empty/null route not navigable",
);

assert(
  formatFirstControlStatusLabel(DIRECT_LABOUR_ROUTE_BLOCKED_STATUS) ===
    "Production Route required",
  "DIRECT_LABOUR_ROUTE_BLOCKED human label",
);
assert(
  formatRecommendedUiRouteLabel("PRODUCTION_ROUTE_MANAGER") ===
    "Production Route Manager",
  "PRODUCTION_ROUTE_MANAGER human label",
);
assert(
  resolveSkuControlPrimaryMessage({
    firstControlStatus: DIRECT_LABOUR_ROUTE_BLOCKED_STATUS,
  }) === DIRECT_LABOUR_ROUTE_BLOCKED_MESSAGE,
  "canonical primary message fallback",
);
assert(
  resolveSkuControlPrimaryMessage({
    firstControlStatus: DIRECT_LABOUR_ROUTE_BLOCKED_STATUS,
    controlNote: "Server note wins",
  }) === "Server note wins",
  "server control_note preferred when present",
);
assert(
  resolveSkuControlSecondaryMaterialMessage("REVIEW_REQUIRED") ===
    "Material costing also requires review.",
  "secondary material REVIEW message",
);
assert(
  resolveSkuControlSecondaryMaterialMessage("READY") === "",
  "READY material has no secondary review message",
);

// ---------------------------------------------------------------------------
// B. MATERIAL_RATE_MANAGER — count-gated
// ---------------------------------------------------------------------------
const mrmRmOnly = resolveRecommendedUiRouteTarget("MATERIAL_RATE_MANAGER", {
  productId: 9,
  skuId: 11,
  periodStart: "2026-07-01",
  rmBlockingLineCount: 3,
  pmBlockingLineCount: 0,
});
assert(mrmRmOnly.navigable === true, "MATERIAL_RATE_MANAGER RM-only navigable");
assert(
  mrmRmOnly.moduleKey === "material-cost-manager",
  "MATERIAL_RATE_MANAGER RM-only → material-cost-manager",
);
assert(
  mrmRmOnly.lensId === "manual-rate-manager" &&
    mrmRmOnly.navigateParams?.lens === "manual-rate-manager",
  "MATERIAL_RATE_MANAGER RM-only → manual-rate-manager",
);
assert(
  mrmRmOnly.navigateParams?.managerTab === "action-queue",
  "MATERIAL_RATE_MANAGER RM-only manager_tab action-queue",
);
assert(
  sameStringList(mrmRmOnly.navigateParams?.issue, ["MATERIAL_RATE_MANAGER_RM"]),
  "MATERIAL_RATE_MANAGER RM-only issue MATERIAL_RATE_MANAGER_RM",
);
assert(
  sameStringList(mrmRmOnly.navigateParams?.source, ["RM"]),
  "MATERIAL_RATE_MANAGER RM-only source RM",
);
assert(
  mrmRmOnly.navigateParams?.periodStart === "2026-07-01",
  "MATERIAL_RATE_MANAGER RM-only periodStart forwarded",
);
assert(
  mrmRmOnly.label === "Open Material Rate Manager" && mrmRmOnly.newTab === true,
  "MATERIAL_RATE_MANAGER RM-only CTA + newTab",
);

const mrmPmOnly = resolveRecommendedUiRouteTarget("MATERIAL_RATE_MANAGER", {
  rmBlockingLineCount: 0,
  pmBlockingLineCount: 2,
});
assert(mrmPmOnly.navigable === true, "MATERIAL_RATE_MANAGER PM-only navigable");
assert(
  sameStringList(mrmPmOnly.navigateParams?.issue, ["MATERIAL_RATE_MANAGER_PM"]),
  "MATERIAL_RATE_MANAGER PM-only issue MATERIAL_RATE_MANAGER_PM",
);
assert(
  sameStringList(mrmPmOnly.navigateParams?.source, ["PM"]),
  "MATERIAL_RATE_MANAGER PM-only source PM",
);

const mrmBoth = resolveRecommendedUiRouteTarget("MATERIAL_RATE_MANAGER", {
  rmBlockingLineCount: 1,
  pmBlockingLineCount: 4,
});
assert(mrmBoth.navigable === true, "MATERIAL_RATE_MANAGER both navigable");
assert(
  mrmBoth.moduleKey === "material-cost-manager" &&
    mrmBoth.lensId === "manual-rate-manager",
  "MATERIAL_RATE_MANAGER both → one MCM destination",
);
assert(
  sameStringList(mrmBoth.navigateParams?.issue, [
    "MATERIAL_RATE_MANAGER_RM",
    "MATERIAL_RATE_MANAGER_PM",
  ]),
  "MATERIAL_RATE_MANAGER both issue codes present",
);
assert(
  sameStringList(mrmBoth.navigateParams?.source, ["RM", "PM"]),
  "MATERIAL_RATE_MANAGER both source values present",
);

const mrmZero = resolveRecommendedUiRouteTarget("MATERIAL_RATE_MANAGER", {
  productId: 9,
  rmBlockingLineCount: 0,
  pmBlockingLineCount: 0,
});
assert(mrmZero.navigable === false, "MATERIAL_RATE_MANAGER zero counts non-navigable");
assert(
  mrmZero.reason === NO_VERIFIED_RATE_MANAGER_REMEDIATION,
  "MATERIAL_RATE_MANAGER zero counts reason no-verified-rate-manager-remediation",
);

const mrmNull = resolveRecommendedUiRouteTarget("MATERIAL_RATE_MANAGER", {
  productId: 9,
});
assert(
  mrmNull.navigable === false &&
    mrmNull.reason === NO_VERIFIED_RATE_MANAGER_REMEDIATION,
  "MATERIAL_RATE_MANAGER null counts non-navigable",
);

assert(
  !resolverSrc.includes("control_note") ||
    !/MATERIAL_RATE_MANAGER[\s\S]{0,400}control_note/.test(resolverSrc),
  "MATERIAL_RATE_MANAGER routing does not parse control_note",
);

// ---------------------------------------------------------------------------
// C. MATERIAL_RATE_REVIEW → CCC workbench (not MCM)
// ---------------------------------------------------------------------------
const mrr = resolveRecommendedUiRouteTarget("MATERIAL_RATE_REVIEW", {
  periodStart: "2026-07-01",
  skuId: 55,
});
assert(mrr.navigable === true, "MATERIAL_RATE_REVIEW navigable");
assert(
  mrr.moduleKey === "costing-control-center",
  "MATERIAL_RATE_REVIEW → costing-control-center",
);
assert(
  mrr.lensId === "costing-review-workbench" &&
    mrr.navigateParams?.lens === "costing-review-workbench",
  "MATERIAL_RATE_REVIEW → costing-review-workbench",
);
assert(
  sameStringList(mrr.navigateParams?.issue, ["MATERIAL_RATE_REVIEW"]),
  "MATERIAL_RATE_REVIEW issue MATERIAL_RATE_REVIEW",
);
assert(
  sameStringList(mrr.navigateParams?.status, ["REVIEW_REQUIRED"]),
  "MATERIAL_RATE_REVIEW status REVIEW_REQUIRED",
);
assert(
  mrr.moduleKey !== "material-cost-manager",
  "MATERIAL_RATE_REVIEW does not route to MCM",
);
assert(
  mrr.label === "Open Costing Review Workbench" && mrr.newTab === true,
  "MATERIAL_RATE_REVIEW CTA + newTab",
);

// ---------------------------------------------------------------------------
// D. SELLING_PRICE_POLICY_REVIEW → PPM sku-overview
// ---------------------------------------------------------------------------
const sell = resolveRecommendedUiRouteTarget("SELLING_PRICE_POLICY_REVIEW", {
  productId: 3,
  skuId: 7,
  sellingPriceBridgeStatus: "SELLING_PRICE_BRIDGE_BLOCKED",
});
assert(sell.navigable === true, "SELLING_PRICE_POLICY_REVIEW navigable");
assert(
  sell.moduleKey === "pricing-policy-manager",
  "SELLING_PRICE_POLICY_REVIEW → pricing-policy-manager",
);
assert(
  sell.navigateParams?.workspace === "sku-overview" &&
    sell.workspaceId === "sku-overview",
  "SELLING_PRICE_POLICY_REVIEW workspace sku-overview",
);
assert(
  sell.navigateParams?.lens == null,
  "SELLING_PRICE_POLICY_REVIEW uses workspace not lens",
);
assert(
  sameStringList(sell.navigateParams?.status, ["SELLING_PRICE_BRIDGE_BLOCKED"]),
  "SELLING_PRICE_POLICY_REVIEW status forwarded when present",
);
assert(
  sell.navigateParams?.productId === 3 && sell.navigateParams?.skuId === 7,
  "SELLING_PRICE_POLICY_REVIEW product/sku URL continuity",
);
assert(
  sell.label === "Open Pricing Policy Manager" && sell.newTab === true,
  "SELLING_PRICE_POLICY_REVIEW CTA + newTab",
);

const sellNoStatus = resolveRecommendedUiRouteTarget(
  "SELLING_PRICE_POLICY_REVIEW",
  { skuId: 7 },
);
assert(
  sellNoStatus.navigable === true && sellNoStatus.navigateParams?.status == null,
  "SELLING_PRICE_POLICY_REVIEW omits status when absent",
);

// ---------------------------------------------------------------------------
// E. PRICING_POLICY_REVIEW → PPM sku-overview
// ---------------------------------------------------------------------------
const price = resolveRecommendedUiRouteTarget("PRICING_POLICY_REVIEW", {
  productId: 4,
  skuId: 8,
  pricingBridgeStatus: "PRICING_BRIDGE_BLOCKED",
});
assert(price.navigable === true, "PRICING_POLICY_REVIEW navigable");
assert(
  price.moduleKey === "pricing-policy-manager" &&
    price.navigateParams?.workspace === "sku-overview",
  "PRICING_POLICY_REVIEW → pricing-policy-manager sku-overview",
);
assert(
  sameStringList(price.navigateParams?.status, ["PRICING_BRIDGE_BLOCKED"]),
  "PRICING_POLICY_REVIEW pricing bridge status forwarded",
);
assert(
  price.label === "Open Pricing Policy Manager",
  "PRICING_POLICY_REVIEW CTA Open Pricing Policy Manager",
);

// ---------------------------------------------------------------------------
// F. COST_APPROVAL_WORKBENCH remains non-navigable
// ---------------------------------------------------------------------------
assert(
  resolveRecommendedUiRouteTarget("COST_APPROVAL_WORKBENCH", {
    productId: 9,
    skuId: 1,
  }).navigable === false,
  "COST_APPROVAL_WORKBENCH remains non-navigable",
);

// ---------------------------------------------------------------------------
// G. Existing unknown route cases remain non-navigable
// ---------------------------------------------------------------------------
for (const code of [
  "COST_SOURCE_REVIEW",
  "COST_BUILD_REVIEW",
  "COST_SHEET_REVIEW",
  "COST_REVIEW_WORKBENCH",
  "DIAGNOSTIC_REVIEW",
]) {
  assert(
    resolveRecommendedUiRouteTarget(code, { productId: 9 }).navigable === false,
    `${code} remains non-navigable`,
  );
}

// ---------------------------------------------------------------------------
// CCC / registry / shell wiring
// ---------------------------------------------------------------------------
assert(
  registrySrc.includes('"sku-control-status"') &&
    /lensIds:\s*\[[\s\S]*sku-control-status/.test(registrySrc),
  "sku-control-status registered in suite registry",
);
assert(
  routeConfigSrc.includes("sku-control-status") &&
    /"costing-control-center"[\s\S]*allowedLensIds:[\s\S]*sku-control-status/.test(
      routeConfigSrc,
    ),
  "sku-control-status allowed in costing-control-center route config",
);
assert(
  controlSrc.includes("v_costing_pricing_sku_control_status_snapshot") &&
    controlSrc.includes("loadSkuControlStatusRows"),
  "CCC loads sku control status snapshot",
);
assert(
  /costing-blocked[\s\S]{0,200}sku-control-status/.test(controlSrc) ||
    /sku-control-status[\s\S]{0,80}BLOCKER/.test(controlSrc),
  "Costing Blocked KPI targets sku-control-status",
);
assert(
  controlSrc.includes("resolveRecommendedUiRouteTarget") &&
    controlSrc.includes("buildSkuControlRouteContext") &&
    controlSrc.includes("data-sku-control-nav"),
  "resolver used for row/drawer CTA with richer context helper",
);
assert(
  controlSrc.includes("rmBlockingLineCount") &&
    controlSrc.includes("pmBlockingLineCount") &&
    controlSrc.includes("sellingPriceBridgeStatus") &&
    controlSrc.includes("pricingBridgeStatus") &&
    controlSrc.includes("periodStart") &&
    controlSrc.includes("skuId"),
  "CCC wires richer SKU-control route context fields",
);
assert(
  shellSrc.includes('"sku-control-status"') &&
    shellSrc.includes("loadSkuControlStatusRows"),
  "shell recognizes sku-control-status loader",
);
assert(
  controlSrc.includes("No dedicated navigation is configured") ||
    controlSrc.includes("unmapped"),
  "unknown route remains safe in CCC UI",
);
assert(
  !controlSrc.includes("applyTraceLaunchContext") &&
    !/auto-focus|autoFocus|focusSku|focusProduct/.test(controlSrc),
  "CCC SKU-control nav does not add Product/SKU auto-focus consumers",
);

if (failed) {
  console.error(`\nrecommended-ui-route-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("\nrecommended-ui-route-smoke: all checks passed");
