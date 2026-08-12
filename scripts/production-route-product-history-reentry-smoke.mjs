/**
 * Gate 11Y.10I.2C.3E.3C — Existing Product Route re-entry / history navigation.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getApplicableProductRouteActions,
  isPrmProductRouteEditorCreateContext,
  isPrmRouteReadOnlyStatus,
  normalizePrmIntegerId,
  PRM_EXACT_RUN_CONTEXT,
  resolvePrmOpenProductRouteEligibility,
  resolvePrmProductHistoryRouteId,
  resolveProductionRouteLens,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  aliasProductRouteHistoryRow,
  normalizeProductRouteHistory,
} from "../public/shared/js/costing-suite-production-route-rpc.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const htmlSrc = read("public/shared/production-route-manager.html");
const swSrc = read("public/sw.js");

const historyFn =
  mainSrc.match(
    /function openProductHistoryRoute\([\s\S]*?\n  function readinessHeader/,
  )?.[0] || "";
const fillFn =
  mainSrc.match(
    /async function fillProductSummaryEffectiveHost\([\s\S]*?\n  function resolveWorkloadActivityLabel/,
  )?.[0] || "";
const runFn =
  mainSrc.match(
    /async function runSummaryAction\([\s\S]*?\n  async function openProductCandidateAdvisory/,
  )?.[0] || "";
const loadFn =
  mainSrc.match(
    /if \(active === "product-route-editor"\) \{[\s\S]*?\n    if \(active === "historical-candidate-review"\)/,
  )?.[0] || "";
const openCreateFn =
  mainSrc.match(
    /async function openProductRouteCreateFromRow\([\s\S]*?\n  async function submitProductRouteCreateDraft/,
  )?.[0] || "";
const productHtmlFn =
  editorSrc.match(
    /function productHtml\([\s\S]*?\n  function renderEditor/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const draft47 = {
  id: 47,
  product_id: 139,
  status: "DRAFT",
  route_version: 1,
  family_route_name: "Dry Powder",
  family_route_version: "v2",
  family_route_id: 10,
};
const historyIdOnly = { id: 47, product_id: 139, status: "DRAFT" };
const placeholderRow = {
  product_route_id: "—",
  route_id: "—",
  id: "—",
  product_id: 139,
  status: "DRAFT",
};
const readyRow = {
  product_id: 139,
  product_name: "Thaleesapathradi Choornam",
  route_family_id: 9,
  readiness_status: "READY",
  product_route_id: null,
};
const aliased = aliasProductRouteHistoryRow(historyIdOnly);
const normalized = normalizeProductRouteHistory({
  versions: [historyIdOnly, placeholderRow],
});
const draftActions = getApplicableProductRouteActions(readyRow, {
  productHistory: [{ product_route_id: 47, status: "DRAFT", product_id: 139 }],
});
const emptyActions = getApplicableProductRouteActions(readyRow);
const ambiguousActions = getApplicableProductRouteActions(readyRow, {
  productHistory: [
    { product_route_id: 47, status: "DRAFT" },
    { product_route_id: 48, status: "REVIEW_REQUIRED" },
  ],
});
const eligibilityDraft = resolvePrmOpenProductRouteEligibility(readyRow, [
  { product_route_id: 47, status: "DRAFT" },
]);
const eligibilityAmbiguous = resolvePrmOpenProductRouteEligibility(readyRow, [
  { product_route_id: 47, status: "DRAFT" },
  { product_route_id: 48, status: "REVIEW_REQUIRED" },
]);
const eligibilityApprovedOnly = resolvePrmOpenProductRouteEligibility(readyRow, [
  { product_route_id: 12, status: "APPROVED" },
  { product_route_id: 9, status: "SUPERSEDED" },
]);

assert(
  resolvePrmProductHistoryRouteId(draft47) === 47 &&
    fillFn.includes("loadProductHistory(productId)") &&
    runFn.includes("openHistoryModal(") &&
    runFn.includes('"product"'),
  "1 Product history loads route 47",
);
assert(
  resolvePrmProductHistoryRouteId(historyIdOnly) === 47 &&
    aliased.product_route_id === 47 &&
    helpersSrc.includes("product_route_id") &&
    helpersSrc.includes("route_id") &&
    /row\?\.id/.test(helpersSrc),
  "2 history row resolves id from id fallback",
);
assert(
  resolvePrmProductHistoryRouteId({ product_route_id: 47 }) === 47 &&
    historyFn.includes("data-prm-history-open=\"${routeId}\"") &&
    historyFn.includes("product_route_id: routeId"),
  "3 data/action carries numeric 47",
);
assert(
  resolvePrmProductHistoryRouteId(placeholderRow) == null &&
    normalizePrmIntegerId("—") == null &&
    historyFn.includes('data-prm-history-open="${routeId}"') &&
    historyFn.includes("data-prm-history-invalid") &&
    !historyFn.includes(
      'navigate("product-route-editor", { product_route_id: id })',
    ),
  "4 no display placeholder used as route id",
);
assert(
  historyFn.includes(">Open</button>") &&
    historyFn.includes("data-prm-history-open-btn") &&
    historyFn.includes("<th>Open</th>"),
  "5 visible Open action exists",
);
assert(
  historyFn.includes("data-prm-history-row") &&
    historyFn.includes("[data-prm-history-row]") &&
    historyFn.includes('bind(host, "click"'),
  "6 row click works",
);
assert(
  historyFn.includes('event.key !== "Enter"') &&
    historyFn.includes('event.key !== " "') &&
    historyFn.includes("tabindex=\"0\""),
  "7 keyboard open works if row is interactive",
);
assert(
  historyFn.includes("product_id: navProductId") &&
    historyFn.includes("version.product_id") &&
    runFn.includes("product_id: productIdNorm"),
  "8 product_id 139 preserved",
);
assert(
  historyFn.includes("product_route_id: routeId") &&
    runFn.includes("product_route_id: routeId") &&
    loadFn.includes("editor.loadProductDetail(productRouteId)"),
  "9 product_route_id 47 preserved",
);
assert(
  historyFn.includes("This history row belongs to a different Product.") &&
    historyFn.includes("rowProductId !== contextProductId") &&
    historyFn.includes("return false"),
  "10 Product mismatch blocked",
);
assert(
  historyFn.includes("navigate(\"product-route-editor\"") &&
    mainSrc.includes("closeModal({ restorePrevious: false })") &&
    historyFn.includes("onModal"),
  "11 history modal closes on valid open",
);
assert(
  historyFn.includes('navigate("product-route-editor"') &&
    historyFn.includes("product_id: navProductId") &&
    historyFn.includes("product_route_id: routeId"),
  "12 Product Route Editor opens",
);
assert(
  loadFn.includes("editor.loadProductDetail(productRouteId)") &&
    editorSrc.includes("buildProductRouteDetailArgs({ product_route_id: productRouteId })") &&
    editorSrc.includes("RPC.productDetail"),
  "13 detail RPC receives 47",
);
assert(
  productHtmlFn.includes("formatPrmRouteStatusLabel(routeStatus(header))") &&
    editorSrc.includes("Unable to load Product route.") &&
    loadFn.includes("productRouteId != null"),
  "14 Draft route renders",
);
assert(
  productHtmlFn.includes("Inherited family route") &&
    editorSrc.includes("familySkeleton"),
  "15 inherited family route renders",
);
assert(
  productHtmlFn.includes("Product deltas") &&
    productHtmlFn.includes("productState.overrides"),
  "16 Product deltas section renders",
);
assert(
  !historyFn.includes("editor.createProductDraft") &&
    !historyFn.includes("withMutation") &&
    !runFn.includes("editor.createProductDraft") &&
    !fillFn.includes("withMutation"),
  "17 no mutation",
);
const existingDetailBranch =
  loadFn.match(
    /if \(productRouteId != null\) \{[\s\S]*?return result;\s*\}/,
  )?.[0] || "";
assert(
  !historyFn.includes("rpc_create_product_route_draft") &&
    !historyFn.includes("createProductDraft") &&
    !fillFn.includes("createProductDraft") &&
    existingDetailBranch.includes("editor.loadProductDetail(productRouteId)") &&
    !existingDetailBranch.includes("hydrateProductRouteCreateHandoff") &&
    !existingDetailBranch.includes("createProductDraft"),
  "18 no create RPC",
);
assert(
  !historyFn.includes("approveProduct") &&
    !runFn.includes("approveProduct") &&
    !fillFn.includes("approveProduct"),
  "19 no approval",
);
assert(
  !historyFn.includes("runStagedCostingRefresh") &&
    !fillFn.includes("refreshCost") &&
    !runFn.includes("runStagedCostingRefresh"),
  "20 no refresh",
);
assert(
  isPrmRouteReadOnlyStatus("APPROVED") === true &&
    productHtmlFn.includes("This Product route version is read-only.") &&
    historyFn.includes("historical versions are read-only"),
  "21 APPROVED route opens read-only",
);
assert(
  isPrmRouteReadOnlyStatus("SUPERSEDED") === true &&
    !historyFn.includes("SUPERSEDED") === false
      ? helpersSrc.includes('"SUPERSEDED"')
      : productHtmlFn.includes("cp-prm-readonly"),
  "22 SUPERSEDED route opens read-only",
);
assert(
  isPrmRouteReadOnlyStatus("INACTIVE") === true &&
    helpersSrc.includes('"INACTIVE"') &&
    productHtmlFn.includes("isPrmRouteReadOnlyStatus"),
  "23 INACTIVE route opens read-only",
);
assert(
  historyFn.includes("This history row does not have a valid Product route ID.") &&
    historyFn.includes("showToast") &&
    resolvePrmProductHistoryRouteId(placeholderRow) == null,
  "24 invalid id shows toast",
);
assert(
  !draftActions.some((action) => action.id === "create-product") &&
    fillFn.includes("loadProductHistory") &&
    fillFn.includes("resolvePrmOpenProductRouteEligibility"),
  "25 Product Summary after Draft does not show Create Product route",
);
assert(
  draftActions.some((action) => action.id === "open-product-draft") &&
    draftActions.find((action) => action.id === "open-product-draft")
      ?.product_route_id === 47 &&
    eligibilityDraft.open_product_route_id === 47,
  "26 Product Summary shows Open Product route when one current Draft exists",
);
assert(
  eligibilityAmbiguous.current_product_route_ambiguous === true &&
    !ambiguousActions.some((action) => action.id === "open-product-draft") &&
    !ambiguousActions.some((action) => action.id === "create-product") &&
    ambiguousActions.some((action) => action.id === "product-history") &&
    loadFn.includes("productRouteReentryChooser"),
  "27 multiple current writable routes are not guessed",
);
assert(
  emptyActions.some((action) => action.id === "create-product") &&
    isPrmProductRouteEditorCreateContext({
      product_id: 139,
      product_route_id: null,
    }) === true &&
    loadFn.includes("hydrateProductRouteCreateHandoff") &&
    openCreateFn.includes('navigate("product-route-editor", { product_id: productId })'),
  "28 explicit create-mode workflow remains unchanged for Products with no route",
);
assert(
  resolveProductionRouteLens("product-route-editor") === "route-readiness" &&
    loadFn.includes("return { ok: true, empty: true }") &&
    !isPrmProductRouteEditorCreateContext({
      product_id: null,
      product_route_id: null,
    }),
  "29 bare Product Route Editor remains safe",
);
assert(
  resolveProductionRouteLens("product-route-editor", {
    product_id: 139,
    product_route_id: 47,
  }) === "product-route-editor" &&
    mainSrc.includes('"product_route_id"') &&
    mainSrc.includes("PRM_DEEP_LINK_KEYS") &&
    loadFn.includes("editor.loadProductDetail(productRouteId)"),
  "30 deep-link with product_id + product_route_id reopens exact route",
);
assert(
  mainSrc.includes('window.addEventListener("popstate", onPrmPopState)') &&
    mainSrc.includes("applyPrmDeepLinkToUrl") &&
    mainSrc.includes("applyDeepLinkFromUrl"),
  "31 browser Back sane",
);
assert(
  historyFn.includes("navigateToFamilyRouteEditor") &&
    historyFn.includes("version.family_route_id") &&
    runFn.includes('"family"') &&
    rpcSrc.includes("family_route_id ?? row.route_id ?? row.id") &&
    !rpcSrc.includes("normalizeProductRouteHistory") === false,
  "32 family history unchanged",
);
assert(
  htmlSrc.includes("tr[data-prm-history-row]") &&
    htmlSrc.includes("var(--sasv-action-primary)") &&
    !/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/.test(
      htmlSrc.match(
        /\.cp-prm-step-table tr\[data-prm-history-row\] \{[\s\S]*?\.cp-prm-history-open \{[\s\S]*?\}/,
      )?.[0] || "",
    ),
  "33 semantic tokens only",
);
assert(
  !mainSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !rpcSrc.includes("rpc_create_product_route_draft_v2") &&
    PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80 &&
    eligibilityApprovedOnly.open_product_route_id == null,
  "34 no server changes",
);
assert(
  /CACHE_NAME = "hub-cache-v276"/.test(swSrc),
  "35 SW bumped exactly once after smokes (hub-cache-v276)",
);

assert(
  normalized.versions[0].product_route_id === 47 &&
    normalized.versions[1].product_route_id == null,
  "history alias keeps invalid placeholder as null",
);
assert(
  historyFn.includes("<th>Base Family Route</th>") &&
    historyFn.includes("<th>Source</th>") &&
    historyFn.includes("<th>Evidence</th>") &&
    historyFn.includes("<th>Approval Reference</th>"),
  "Product history columns include Base Family Route and Open",
);

if (failed) {
  console.error(
    `production-route-product-history-reentry-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-product-history-reentry-smoke: all passed");
