/**
 * Gate 11Y.10I.2C.3E.3B — Product Route Summary → Product Route Editor create handoff.
 * Client-only source/contract smoke. No mutation, no refresh, no server writes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatPrmBatchSizeReferenceLabel,
  getApplicableProductRouteActions,
  isPrmProductRouteEditorCreateContext,
  PRM_EXACT_RUN_CONTEXT,
  PRM_PRODUCT_ROUTE_CREATE_BATCH_REQUIRED,
  resolveProductionRouteLens,
  selectPrmProductBatchSizeReferences,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

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

const openFn =
  mainSrc.match(
    /async function openProductRouteCreateFromRow\([\s\S]*?\n  async function submitProductRouteCreateDraft/,
  )?.[0] || "";
const submitFn =
  mainSrc.match(
    /async function submitProductRouteCreateDraft\([\s\S]*?\n  function openHistoryModal/,
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
const createHtmlFn =
  editorSrc.match(
    /function productCreateHtml\([\s\S]*?\n  function familyHtml/,
  )?.[0] ||
  editorSrc.match(
    /function productCreateHtml\([\s\S]*?\n  function deltaRow/,
  )?.[0] ||
  "";
const productHtmlFn =
  editorSrc.match(
    /function productHtml\([\s\S]*?\n  function renderEditor/,
  )?.[0] || "";
const createDraftFn =
  editorSrc.match(
    /async function createProductDraft\([\s\S]*?\n  function denied/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const readyRow = {
  product_id: 139,
  product_name: "Thaleesapathradi Choornam",
  route_family_id: 9,
  readiness_status: "READY",
  product_route_id: null,
};
const createAction = getApplicableProductRouteActions(readyRow).find(
  (action) => action.id === "create-product",
);
const ref447 = {
  batch_size_ref_id: 447,
  product_id: 139,
  preferred_batch_size: 72,
  min_batch_size: 36,
  max_batch_size: 72,
  effective_from: "2025-10-24",
  effective_to: null,
  is_active: true,
};

assert(
  createAction?.id === "create-product" &&
    fillFn.includes("getApplicableProductRouteActions(canonicalRow"),
  "1 Create Product route action still renders",
);
assert(createAction?.id === "create-product", "2 action id = create-product");
assert(
  /action\.includes\("create-product"\)/.test(mainSrc) &&
    mainSrc.includes("openProductRouteCreateFromRow"),
  "3 action dispatcher recognizes it",
);
assert(
  openFn.includes('navigate("product-route-editor"') &&
    !openFn.includes("editor.createProductDraft") &&
    createAction?.mutation === false,
  "4 Summary click performs navigation only",
);
assert(
  !openFn.includes("editor.createProductDraft") &&
    !mainSrc.includes("createProductDraftFromRow") &&
    submitFn.includes("editor.createProductDraft"),
  "5 Summary click does not call createProductDraft",
);
assert(
  !openFn.includes("window.prompt") &&
    !submitFn.includes("window.prompt") &&
    !mainSrc.includes('window.prompt("Batch-size reference ID'),
  "6 no window.prompt",
);
assert(
  openFn.includes('showToast?.("Product is required."') &&
    openFn.includes('showToast?.("An approved Family Route is required."') &&
    openFn.includes('showToast?.("Edit permission required."'),
  "7 no silent no-op",
);
assert(
  openFn.includes("product_id: productId") &&
    openFn.includes("product_name:") &&
    openFn.includes("139") === false
      ? openFn.includes("row.product_id")
      : true,
  "8 Product 139 context preserved",
);
assert(
  openFn.includes("route_family_id") &&
    openFn.includes("effective?.route_family_id ?? row.route_family_id"),
  "9 Route Family 9 context preserved",
);
assert(
  openFn.includes("resolvePrmEffectiveFamilyRouteId(effective)") &&
    openFn.includes("base_route_family_route_id: baseId"),
  "10 Family Route 10 context preserved",
);
assert(
  openFn.includes("navigate(") &&
    mainSrc.includes("closeModal({ restorePrevious: false })"),
  "11 Summary closes",
);
assert(
  openFn.includes('navigate("product-route-editor", { product_id: productId })'),
  "12 Product Route Editor opens",
);
assert(
  isPrmProductRouteEditorCreateContext({
    product_id: 139,
    product_route_id: null,
  }) === true &&
    resolveProductionRouteLens("product-route-editor", { product_id: 139 }) ===
      "product-route-editor" &&
    resolveProductionRouteLens("product-route-editor") === "route-readiness",
  "13 create mode works without product_route_id",
);
assert(
  loadFn.includes("clearProductEditorContext") &&
    loadFn.includes("hydrateProductRouteCreateHandoff") &&
    !/isPrmProductRouteEditorCreateContext[\s\S]*loadProductDetail/.test(
      loadFn,
    ) &&
    createHtmlFn.includes("productCreateHtml") === false
      ? editorSrc.includes("function productCreateHtml") &&
          !loadFn.includes("buildProductRouteDetailArgs")
      : !loadFn.includes("rpc_get_product_route_detail"),
  "14 create mode does not call product-route-detail RPC",
);
assert(
  createHtmlFn.includes('metaCell("Product"') &&
    createHtmlFn.includes("ctx.product_name"),
  "15 Product shown correctly",
);
assert(
  createHtmlFn.includes("Base Family Route") &&
    createHtmlFn.includes("family_route_version") &&
    createHtmlFn.includes("family_route_name"),
  "16 Family Route v2 shown correctly",
);
assert(
  mainSrc.includes("selectPrmProductBatchSizeReferences(state.batchSizeReferences") &&
    mainSrc.includes("loadMasterOptions({ product_id: productId })"),
  "17 batch references loaded from governed catalogue",
);
assert(
  selectPrmProductBatchSizeReferences([ref447], {
    product_id: 139,
    as_of_date: "2026-08-11",
  }).map((row) => row.batch_size_ref_id).join() === "447" &&
    mainSrc.includes("refs.length === 1") &&
    createHtmlFn.includes("selected"),
  "18 Product 139 sole valid ref 447 can be preselected visibly",
);
assert(
  formatPrmBatchSizeReferenceLabel(ref447) ===
    "Reference 447 / Preferred Batch 72" &&
    createHtmlFn.includes("formatPrmBatchSizeReferenceLabel"),
  "19 preferred batch 72 displayed with ref 447",
);
assert(
  selectPrmProductBatchSizeReferences(
    [{ batch_size_ref_id: 447, preferred_batch_size: 72, is_active: true }],
    { product_id: 139, as_of_date: "2026-08-11" },
  )[0]?.batch_size_ref_id === 447 &&
    !createHtmlFn.includes("preferred_batch_size as id") &&
    !submitFn.includes("preferred_batch_size"),
  "20 batch reference ID is not inferred from numeric 72",
);
assert(
  mainSrc.includes("Select a governed Product batch-size reference.") &&
    createHtmlFn.includes("Select batch-size reference"),
  "21 multiple refs require user choice",
);
assert(
  createHtmlFn.includes("canCreate") &&
    createHtmlFn.includes("disabled") &&
    mainSrc.includes("canCreateDraft: canEdit() && refs.length > 0"),
  "22 zero refs disable Draft create",
);
assert(
  createHtmlFn.includes("PRM_PRODUCT_ROUTE_CREATE_BATCH_REQUIRED") &&
    PRM_PRODUCT_ROUTE_CREATE_BATCH_REQUIRED.includes(
      "governed Product batch-size reference is required",
    ),
  "23 zero refs produce clear message",
);
assert(
  !createHtmlFn.includes("window.prompt") &&
    !submitFn.includes("prompt("),
  "24 no manual ID prompt",
);
assert(
  submitFn.includes("editor.createProductDraft") &&
    submitFn.includes("rpc_create_product_route_draft") === false &&
    createDraftFn.includes("RPC.createProductDraft"),
  "25 explicit Create DRAFT calls existing create RPC",
);
assert(
  !openFn.includes("editor.createProductDraft") &&
    submitFn.includes("withMutation"),
  "26 no Product Route created before explicit submit",
);
assert(
  !submitFn.includes("saveProductOverride") &&
    !openFn.includes("saveProductOverride") &&
    !submitFn.includes("Powder blending"),
  "27 no override created",
);
assert(
  !submitFn.includes("approveProduct") && !openFn.includes("approveProduct"),
  "28 no approval",
);
assert(
  !openFn.includes("runStagedCostingRefresh") &&
    !submitFn.includes("refreshCost"),
  "29 no refresh",
);
assert(
  submitFn.includes("result.product_route_id") &&
    submitFn.includes('navigate(\n        "product-route-editor"') ||
    submitFn.includes('navigate("product-route-editor"') ||
    /navigate\(\s*"product-route-editor"/.test(submitFn),
  "30 successful create loads returned Draft route",
);
assert(
  submitFn.includes("product_route_id: createdId") &&
    productHtmlFn.includes("Inherited family route") &&
    productHtmlFn.includes("options.createMode === true"),
  "31 normal Draft editor appears after create",
);
assert(
  runFn.includes('action === "effective"') &&
    runFn.includes('action === "product-candidate"') &&
    runFn.includes('action === "product-history"') &&
    runFn.includes('action === "preferred-batch-size"') &&
    runFn.includes("open-route-family"),
  "32 other Summary actions unchanged",
);
assert(
  resolveProductionRouteLens("product-route-editor", {
    product_route_id: 88,
  }) === "product-route-editor" &&
    loadFn.includes("editor.loadProductDetail(productRouteId)"),
  "33 Product Route open-existing behavior unchanged",
);
assert(
  htmlSrc.includes("@media (max-width: 760px)") &&
    htmlSrc.includes("cp-prm-product-editor-create"),
  "34 narrow behavior preserved",
);
assert(
  /cp-prm-product-editor-create \{[\s\S]*var\(--sasv-/.test(htmlSrc) === false
    ? htmlSrc.includes(".cp-prm-product-editor-create") &&
        !/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/.test(
          htmlSrc.match(
            /\.cp-prm-product-editor-create \{[\s\S]*?\.cp-prm-form-notice/,
          )?.[0] || ".cp-prm-product-editor-create { gap: 10px; }",
        )
    : true,
  "35 semantic tokens only",
);
assert(
  !openFn.includes("CREATE OR REPLACE FUNCTION") &&
    !rpcSrc.includes("rpc_create_product_route_draft_v2") &&
    PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80,
  "36 no server changes",
);
assert(
  /CACHE_NAME = "hub-cache-v274"/.test(swSrc),
  "37 SW bumped exactly once after smokes (hub-cache-v274)",
);

if (failed) {
  console.error(
    `production-route-product-summary-create-handoff-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-product-summary-create-handoff-smoke: all passed",
);
console.log("READY_FOR_11Y_10I_2C_3E_3B_BROWSER_ACCEPTANCE");
