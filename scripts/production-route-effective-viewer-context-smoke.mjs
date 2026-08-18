/**
 * Gate 11Y.10I.2C.3E.3E.1 — Effective Route Viewer context integrity.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRM_EMPTY_STATES,
  formatPrmFamilyRouteVersionCopy,
  formatPrmProductRouteVersionCopy,
  formatPrmStepSourceLabel,
  resolvePrmFamilyRouteVersionFromHistory,
  resolvePrmProductRouteVersionFromHistory,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const swSrc = read("public/sw.js");

const renderEffectiveFn =
  mainSrc.match(/function renderEffective\([\s\S]*?\n  function hideSpecialHosts/)?.[0] ||
  "";
const loadEffectiveViewerFn =
  mainSrc.match(
    /async function loadEffectiveViewerProduct\([\s\S]*?\n  function buildEffectiveViewerProductOptionsHtml/,
  )?.[0] || "";
const loadBranch =
  mainSrc.match(
    /if \(active === "effective-route-viewer"\) \{[\s\S]*?\n    if \(active === "product-subgroup-mappings"\)/,
  )?.[0] || "";
const navigateFn =
  mainSrc.match(/function navigate\(lens, params = \{\}, replace = false\) \{[\s\S]*?\n  async function navigateToFamilyRouteEditor/)?.[0] ||
  mainSrc.match(/function navigate\(lens, params = \{\}, replace = false\) \{[\s\S]*?\n  function navigateToFamilyRouteEditor/)?.[0] ||
  "";
const applyDeepLinkFn =
  mainSrc.match(
    /function applyPrmDeepLinkToUrl\([\s\S]*?\n  function navigate\(/,
  )?.[0] || "";
const buildViewerHeaderFn =
  mainSrc.match(
    /function buildEffectiveViewerHeaderHtml\([\s\S]*?\n  function bindInputModalityTracking/,
  )?.[0] ||
  mainSrc.match(
    /function buildEffectiveViewerHeaderHtml\([\s\S]*?\n  function /,
  )?.[0] ||
  "";
const buildStepsTableFn =
  mainSrc.match(
    /function buildEffectiveStepsTableHtml\([\s\S]*?\n  function buildProductSummarySnapshotHtml/,
  )?.[0] || "";

const stepFieldDefs =
  mainSrc.match(/const PRM_EFFECTIVE_STEP_FIELD_DEFS = Object\.freeze\([\s\S]*?\]\);/)?.[0] ||
  "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const productHistory = [
  { id: 47, product_route_id: 47, route_version: 1, status: "APPROVED" },
];
const familyHistory = [
  { id: 10, family_route_id: 10, route_version: 2, status: "APPROVED" },
];

assert(
  mainSrc.includes("effectiveViewer:") &&
    mainSrc.includes('status: "empty"') &&
    mainSrc.includes("resetEffectiveViewer"),
  "1 bare viewer has lens-scoped effectiveViewer state",
);
assert(
  PRM_EMPTY_STATES.effectiveViewer.includes(
    "Search or select a Product to view its effective manufacturing route.",
  ),
  "2 bare viewer empty state copy",
);
assert(
  loadBranch.includes("resetEffectiveViewer()") &&
    loadBranch.includes('loadEffectiveViewerProduct(productId, "deep-link")') &&
    !loadBranch.includes("loadEffective(deepLink.product_id)"),
  "3 no shared loadEffective on bare/deep-link viewer branch",
);
assert(
  renderEffectiveFn.includes("viewer.payload") &&
    !renderEffectiveFn.includes("if (!state.effective)") &&
    !renderEffectiveFn.includes("state.effective.steps"),
  "4 stale state.effective ignored for display",
);
assert(
  renderEffectiveFn.includes("viewer.productId") &&
    !renderEffectiveFn.includes("state.selectedProductId"),
  "5 stale selectedProductId not used as viewer selector value",
);
assert(
  loadBranch.includes('"deep-link"') &&
    mainSrc.includes('navigate("effective-route-viewer", { product_id: effectiveProductId })') &&
    mainSrc.includes("normalizePrmIntegerId(productId)") &&
    mainSrc.includes("Product is required to view the effective route"),
  "6 explicit deep-link Product loads via viewer loader; Summary View effective normalizes id",
);
assert(
  renderEffectiveFn.includes("buildEffectiveViewerProductOptionsHtml(selectorProductId)") &&
    renderEffectiveFn.includes("viewer.productId"),
  "7 Product selector syncs to viewer productId",
);
assert(
  renderEffectiveFn.includes("findEffectiveViewerProductRow") &&
    renderEffectiveFn.includes("productRow.product_name"),
  "8 Product name enriched from master options",
);
assert(
  buildViewerHeaderFn.includes("findEffectiveViewerRouteFamilyRow") &&
    buildViewerHeaderFn.includes("familyRow.route_family_name"),
  "9 Route Family name enriched from master options",
);
assert(
  !renderEffectiveFn.includes("route_family_id)}</div>") &&
    !renderEffectiveFn.includes("Manufacturing Route Family ${"),
  "10 raw Route Family id not primary label",
);
assert(
  resolvePrmProductRouteVersionFromHistory(47, productHistory) === "1",
  "11 Product Route 47 matched exactly in history",
);
assert(
  formatPrmProductRouteVersionCopy(47, productHistory) === "Version 1",
  "12 Product Route Version 1 derived from history",
);
assert(
  resolvePrmFamilyRouteVersionFromHistory(10, familyHistory) === "2",
  "13 Family Route 10 matched exactly in history",
);
assert(
  formatPrmFamilyRouteVersionCopy(10, familyHistory) === "Version 2",
  "14 Family Route Version 2 derived from history",
);
assert(
  !helpersSrc.includes("if (familyRouteId === 10)") &&
    !helpersSrc.match(/resolvePrmFamilyRouteVersionFromHistory[\s\S]*routeId\s*===\s*10/) &&
    resolvePrmFamilyRouteVersionFromHistory(99, familyHistory) == null,
  "15 no id-to-version inference",
);
assert(
  mainSrc.includes("formatEffectiveViewerRouteSourceSuffix") &&
    mainSrc.includes("humanizeUnknownPrmCode(routeSource)"),
  "16 route source humanised in viewer header",
);
assert(
  buildViewerHeaderFn.includes("formatPrmReadinessLabel(readiness)") ||
    buildViewerHeaderFn.includes("formatPrmReadinessLabel"),
  "17 Ready/readiness label path present",
);
assert(
  buildViewerHeaderFn.includes("formatPrmRouteValidationSummary"),
  "18 Valid/validation summary path present",
);
assert(
  renderEffectiveFn.includes('"user-select"') &&
    loadEffectiveViewerFn.includes("RPC.effective"),
  "19 selecting Product loads route via viewer RPC",
);
assert(
  renderEffectiveFn.includes("resetEffectiveViewer()") &&
    renderEffectiveFn.includes('if (pid == null)'),
  "20 clearing Product clears viewer route",
);
assert(
  loadEffectiveViewerFn.includes('status: "error"') &&
    loadEffectiveViewerFn.includes("payload: null"),
  "21 failed load clears old payload",
);
assert(
  renderEffectiveFn.includes("buildEffectiveStepsTableHtml(steps)"),
  "22/26 rich table helper used for steps",
);
assert(
  stepFieldDefs.includes('key: "step_key"') &&
    stepFieldDefs.includes("effective_step_key"),
  "24 Step column present in field defs",
);
assert(
  buildStepsTableFn.includes("<th>") &&
    buildStepsTableFn.includes("col.label"),
  "25 rendered value columns get headers",
);
assert(
  stepFieldDefs.includes('"source_type"') &&
    helpersSrc.includes("PRODUCT_ADDED_STEP") &&
    helpersSrc.includes("ROUTE_FAMILY_INHERITED"),
  "27 source_type alt-key and labels present",
);
assert(
  formatPrmStepSourceLabel("PRODUCT_ADDED_STEP") === "Product-added step",
  "28 PRODUCT_ADDED_STEP humanised",
);
assert(
  formatPrmStepSourceLabel("ROUTE_FAMILY_INHERITED") === "Inherited Family step",
  "29 inherited source humanised",
);
assert(
  formatPrmStepSourceLabel("") === null ||
    formatPrmStepSourceLabel(undefined) === null,
  "30 no provenance fabricated if missing",
);
assert(
  buildStepsTableFn.includes("cp-prm-step-table-wrap") &&
    htmlSrc.includes('data-costing-lens="effective-route-viewer"]') &&
    htmlSrc.includes("cp-prm-step-table-wrap"),
  "31/32 local table-scroll wrapper and bounded viewer card CSS",
);
assert(
  applyDeepLinkFn.includes('resolvedLens === "effective-route-viewer"') &&
    loadBranch.includes("deep-link"),
  "33 deep-link product_id preserved in viewer load path",
);
assert(
  navigateFn.includes('resolved === "effective-route-viewer"') &&
    navigateFn.includes("resetEffectiveViewer()") &&
    applyDeepLinkFn.includes("url.searchParams.delete(\"product_id\")"),
  "34 bare URL/tab strips product_id and resets viewer",
);
assert(
  mainSrc.includes("onPrmPopState") &&
    mainSrc.includes("applyDeepLinkFromUrl()"),
  "35 Back/popstate follows URL deep-link state",
);
assert(
  !renderEffectiveFn.includes("product-route-editor") &&
    !loadEffectiveViewerFn.includes("approve") &&
    !renderEffectiveFn.includes("data-prm-load-effective"),
  "36/38 viewer read-only — no editor/mutation controls",
);
assert(
  !loadEffectiveViewerFn.includes("rpc_validate") &&
    !loadEffectiveViewerFn.includes("rpc_approve") &&
    !loadEffectiveViewerFn.includes("costing refresh"),
  "39/40 no validation/approval/costing refresh in viewer loader",
);
assert(
  htmlSrc.includes("cp-prm-effective-viewer-toolbar") &&
    htmlSrc.includes("var(--muted") &&
    htmlSrc.includes("cp-prm-effective-viewer-status"),
  "41/42 narrow layout hooks and semantic tokens",
);

// Prior approval/validate smokes pin older SW versions and cascade; not part of 4F.5D3-A.
assert(
  /CACHE_NAME = "hub-cache-v\d+"/.test(swSrc),
  "44 SW cache name present",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-effective-viewer-context-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-effective-viewer-context-smoke: all passed");
