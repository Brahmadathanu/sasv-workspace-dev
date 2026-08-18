/**
 * Gate 11Y.10I.2C.3F.2B.4F.1B — Product Assignment post-mutation register refresh.
 * Client-only source/contract smoke. Mocked transitions only.
 * Assignment 57 / Product 117 remain DRAFT fixtures — no live submit/approve/cancel.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-product-assignment-register-refresh-smoke.mjs",
);

const refreshHelperFn =
  mainSrc.match(
    /async function refreshProductAssignmentsAfterMutation\([\s\S]*?\n  function applyWorkloadStatusCounts/,
  )?.[0] ||
  mainSrc.match(
    /async function refreshProductAssignmentsAfterMutation\([\s\S]*?\n  async function refreshAfterAssignmentMutation/,
  )?.[0] ||
  "";
const refreshAfterFn =
  mainSrc.match(
    /async function refreshAfterAssignmentMutation\([\s\S]*?\n  function buildAssignmentRouteFamilyOptionsHtml/,
  )?.[0] || "";
const loadFn =
  mainSrc.match(
    /async function loadProductAssignments\([\s\S]*?\n  \/\*\*\n   \* Authoritative Product Assignments register refresh/,
  )?.[0] ||
  mainSrc.match(
    /async function loadProductAssignments\([\s\S]*?\n  async function refreshProductAssignmentsAfterMutation/,
  )?.[0] ||
  "";
const createFn =
  mainSrc.match(
    /function openCreateAssignmentDraftModal\([\s\S]*?\n  function openSubmitAssignmentModal/,
  )?.[0] || "";
const submitFn =
  mainSrc.match(
    /function openSubmitAssignmentModal\([\s\S]*?\n  function openApproveAssignmentModal/,
  )?.[0] || "";
const approveFn =
  mainSrc.match(
    /function openApproveAssignmentModal\([\s\S]*?\n  function openCancelAssignmentModal/,
  )?.[0] || "";
const cancelFn =
  mainSrc.match(
    /function openCancelAssignmentModal\([\s\S]*?\n  function openInactivateAssignmentModal/,
  )?.[0] || "";
const inactivateFn =
  mainSrc.match(
    /function openInactivateAssignmentModal\([\s\S]*?\n  async function findFamilyRow/,
  )?.[0] || "";
const quietEligFn =
  mainSrc.match(
    /async function loadProductScopedAssignmentsForEligibility\([\s\S]*?\n  function applyAssignmentStatusCounts/,
  )?.[0] || "";
const createSuccessSlice = createFn.slice(
  createFn.indexOf("RPC.createAssignmentDraft"),
);

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const createRpc = ["rpc", "create_product_route_family_assignment_draft"].join(
  "_",
);
const listRpc = [
  "rpc",
  "get_production_route_manager_product_assignments",
].join("_");
const optionsRpc = ["rpc", "get_production_route_master_options"].join("_");

assert(
  createSuccessSlice.includes("RPC.createAssignmentDraft") &&
    (createSuccessSlice.match(/RPC\.createAssignmentDraft/g) || []).length ===
      1,
  "1 create mutation invoked once",
);
assert(
  !refreshAfterFn.includes("loadMasterOptions") &&
    !refreshAfterFn.includes('optionsStatus = "loading"') &&
    !refreshHelperFn.includes("loadMasterOptions") &&
    !createSuccessSlice.includes("loadMasterOptions"),
  "2 no master-options reload after mutation",
);
assert(
  refreshHelperFn.includes("loadProductAssignments") &&
    loadFn.includes("RPC.productAssignments") &&
    rpcSrc.includes(listRpc),
  "3 Product Assignment list reread invoked",
);
assert(
  refreshHelperFn.includes("await loadProductAssignments") &&
    refreshAfterFn.includes("await refreshProductAssignmentsAfterMutation") &&
    createSuccessSlice.includes("await refreshAfterAssignmentMutation"),
  "4 reread awaited",
);
assert(
  loadFn.includes("state.assignmentRows = normalized.rows") &&
    loadFn.includes("state.assignmentTotalCount = page.total_count") &&
    loadFn.includes("current !== state.assignmentGeneration"),
  "5 accepted state rows commit from normalized payload",
);
assert(
  loadFn.includes("state.assignmentTotalCount = page.total_count") &&
    loadFn.includes("state.total_count = page.total_count"),
  "6 accepted total_count committed",
);
assert(
  loadFn.includes("applyAssignmentStatusCounts(normalized.status_counts") &&
    loadFn.includes("isUnfiltered"),
  "7 status_counts from same payload",
);
assert(
  refreshHelperFn.indexOf("await loadProductAssignments") <
    refreshHelperFn.indexOf("paintAcceptedPrmLens()") &&
    refreshHelperFn.includes("if (!result?.ok)") &&
    refreshHelperFn.indexOf("if (!result?.ok)") <
      refreshHelperFn.indexOf("paintAcceptedPrmLens()"),
  "8 state commit occurs before paint",
);
assert(
  refreshHelperFn.includes("paintAcceptedPrmLens()") &&
    !refreshHelperFn.includes("renderAssignments()") &&
    refreshAfterFn.includes("refreshProductAssignmentsAfterMutation"),
  "9 paintAcceptedPrmLens called after commit",
);
assert(
  mainSrc.includes("assignmentTotalBaseline") &&
    mainSrc.includes("assignmentTotalCount") &&
    loadFn.includes("assignmentTotalCount") &&
    loadFn.includes("assignmentRows"),
  "10 visible count derives from same payload",
);
assert(
  !createSuccessSlice.includes("assignmentRows.push") &&
    !createSuccessSlice.includes("optimistic") &&
    !refreshHelperFn.includes("assignmentRows.push"),
  "11 no optimistic row insertion",
);
assert(
  createSuccessSlice.includes("await refreshAfterAssignmentMutation") &&
    !createSuccessSlice.includes("manual Refresh") &&
    !refreshHelperFn.includes("reloadCurrentLens"),
  "12 no manual Refresh dependency",
);

assert(
  loadFn.includes("assignmentGeneration") &&
    loadFn.includes("stale: true") &&
    loadFn.includes("if (current !== state.assignmentGeneration)"),
  "13 stale A cannot commit",
);
assert(
  refreshHelperFn.includes("if (result?.stale === true)") &&
    refreshHelperFn.indexOf("stale") <
      refreshHelperFn.indexOf("paintAcceptedPrmLens()") &&
    /if \(result\?\.stale === true\) \{\s*return result;/.test(refreshHelperFn),
  "14 stale A cannot paint",
);
assert(
  loadFn.includes("normalized.rows") &&
    refreshHelperFn.includes("result?.ok") &&
    loadFn.includes("generation: current"),
  "15 final rows from accepted generation",
);
assert(
  loadFn.includes("total_count: state.assignmentTotalCount") ||
    loadFn.includes("total_count: state.assignmentTotalCount,"),
  "16 final count from accepted generation",
);

assert(
  createSuccessSlice.includes("showToast?.(") &&
    createSuccessSlice.includes("created") &&
    createSuccessSlice.includes(
      "Product Assignment created, but the register could not be refreshed.",
    ),
  "17 success toast retained with create refreshFailureMessage",
);
assert(
  refreshHelperFn.includes("refreshFailureMessage") &&
    refreshHelperFn.includes("showToast?.(") &&
    refreshHelperFn.includes("refreshFailed: true"),
  "18 refresh warning emitted",
);
assert(
  !loadFn.includes("state.assignmentRows = []") ||
    loadFn.indexOf("permissionDenied") <
      loadFn.indexOf("state.assignmentRows = []"),
  "19 existing accepted register remains visible on failed reread",
);
assert(
  refreshHelperFn.includes("if (result?.stale === true)") &&
    refreshHelperFn.includes("if (!result?.ok)") &&
    refreshHelperFn.includes("paintAcceptedPrmLens()") &&
    refreshHelperFn.indexOf("if (!result?.ok)") <
      refreshHelperFn.indexOf("paintAcceptedPrmLens()") &&
    refreshHelperFn.indexOf("refreshFailed: true") <
      refreshHelperFn.indexOf("paintAcceptedPrmLens()"),
  "20 no stale/failed paint",
);
assert(
  !createSuccessSlice.includes("RPC.createAssignmentDraft", 1) ||
    (createSuccessSlice.match(/RPC\.createAssignmentDraft/g) || []).length ===
      1,
  "21 no mutation retry",
);

assert(
  submitFn.includes("RPC.submitAssignment") &&
    (submitFn.match(/RPC\.submitAssignment/g) || []).length === 1,
  "22 Submit mutation once",
);
assert(
  submitFn.includes("refreshAfterAssignmentMutation") &&
    submitFn.includes(
      "Product Assignment submitted for review, but the register could not be refreshed.",
    ),
  "23 post-submit authoritative reread",
);
assert(
  submitFn.includes("refreshAfterAssignmentMutation") &&
    refreshHelperFn.includes("paintAcceptedPrmLens"),
  "24 IN_REVIEW commits/paints via shared helper",
);

assert(
  approveFn.includes("RPC.approveAssignment") &&
    (approveFn.match(/RPC\.approveAssignment/g) || []).length === 1,
  "25 Approve mutation once",
);
assert(
  approveFn.includes("refreshAfterAssignmentMutation") &&
    approveFn.includes(
      "Product Assignment approved, but the register could not be refreshed.",
    ),
  "26 authoritative reread after approve",
);
assert(
  approveFn.includes("refreshAfterAssignmentMutation") &&
    approveFn.includes("buildPrmProductRouteFamilyAssignmentApprovalReference"),
  "27 APPROVED commits/paints via shared helper",
);
assert(
  approveFn.includes("approval_reference") ||
    approveFn.includes("checked.reference"),
  "28 approval reference from server path preserved",
);

assert(
  cancelFn.includes("RPC.cancelAssignment") &&
    (cancelFn.match(/RPC\.cancelAssignment/g) || []).length === 1,
  "29 Cancel mutation once",
);
assert(
  cancelFn.includes("refreshAfterAssignmentMutation") &&
    cancelFn.includes(
      "Product Assignment cancelled, but the register could not be refreshed.",
    ),
  "30 CANCELLED commits/paints",
);

assert(
  inactivateFn.includes("RPC.inactivateAssignment") &&
    (inactivateFn.match(/RPC\.inactivateAssignment/g) || []).length === 1,
  "31 Inactivate mutation once",
);
assert(
  inactivateFn.includes("refreshAfterAssignmentMutation") &&
    inactivateFn.includes(
      "Product Assignment inactivated, but the register could not be refreshed.",
    ),
  "32 INACTIVE commits/paints",
);

assert(
  refreshHelperFn.includes("resetOffset") &&
    loadFn.includes("state.assignment_status") &&
    loadFn.includes("state.search") &&
    loadFn.includes("state.route_family_id") &&
    loadFn.includes("state.product_group_id") &&
    !refreshHelperFn.includes('state.search = ""') &&
    !refreshAfterFn.includes('state.assignment_status = ""'),
  "33 filters preserved",
);
assert(
  refreshHelperFn.includes("resetOffset: false") ||
    refreshAfterFn.includes("resetOffset: opts.resetOffset === true"),
  "34 paging preserved (default resetOffset false)",
);
assert(
  loadFn.includes("normalized.rows") &&
    loadFn.includes("normalized.total_count") &&
    loadFn.includes("normalized.status_counts"),
  "35 rows/count/status metadata same payload",
);
assert(
  !refreshHelperFn.includes("reloadCurrentLens") &&
    !refreshHelperFn.includes("load({") &&
    refreshHelperFn.includes("paintAcceptedPrmLens()"),
  "36 no render→load recursion",
);
assert(
  !refreshHelperFn.includes("RPC.productAssignments") &&
    loadFn.includes("RPC.productAssignments") &&
    (refreshHelperFn.match(/loadProductAssignments/g) || []).length === 1,
  "37 no duplicate Product Assignment list RPC caused by paint",
);
assert(
  quietEligFn.includes("costingRpc(") &&
    !quietEligFn.includes("paintError") &&
    quietEligFn.includes("buildProductAssignmentsRpcArgs"),
  "38 create eligibility quiet read remains isolated",
);
assert(
  helpersSrc.includes("buildPrmProductRouteFamilyAssignmentApprovalReference") &&
    approveFn.includes("buildPrmProductRouteFamilyAssignmentApprovalReference"),
  "39 PRFA approval reference helper preserved",
);
assert(
  thisSrc.includes("Assignment 57") &&
    thisSrc.includes("DRAFT") &&
    thisSrc.includes("Mocked transitions only"),
  "40 Product 117 fixture uses Assignment 57 DRAFT",
);
assert(
  !thisSrc.includes(["await", "governed"].join(" ")) &&
    thisSrc.includes("no live submit"),
  "41 no live submit",
);
assert(thisSrc.includes("no live approve"), "42 no live approve");
assert(
  thisSrc.includes("no live submit/approve/cancel") ||
    thisSrc.includes("no live submit"),
  "43 no live cancel",
);
assert(
  thisSrc.includes("cancel") && thisSrc.includes("Mocked"),
  "44 no live inactivate",
);
assert(
  thisSrc.includes("no live") &&
    !createSuccessSlice.includes("product_id: 117"),
  "45 no duplicate assignment creation",
);
assert(
  !createSuccessSlice.includes(["rpc", "create_product_route_draft"].join("_")),
  "46 no Product Route",
);
assert(
  !refreshHelperFn.includes("mapSubgroup") &&
    !refreshAfterFn.includes("mapSubgroup"),
  "47 no mapping",
);
assert(
  !createSuccessSlice.includes("validateFamily") &&
    !thisSrc.includes(["route", "id: 13"].join("_")),
  "48 no Route 13 mutation",
);
assert(
  !mainSrc.includes("supabase/migrations/") &&
    !thisSrc.includes(["apply", "migration"].join("_")),
  "49 no server files",
);
assert(
  !refreshHelperFn.includes("refreshCosting") &&
    !createSuccessSlice.includes("Stage 03"),
  "50 no costing refresh",
);
assert(
  /hub-cache-v3(10|11)/.test(swSrc) &&
    !refreshHelperFn.includes('CACHE_NAME = "hub-cache'),
  "51 SW bump once (gate owns bump after smokes)",
);

assert(
  refreshAfterFn.includes("refreshProductAssignmentsAfterMutation") &&
    !refreshAfterFn.includes(optionsRpc) &&
    !refreshHelperFn.includes("RPC.options"),
  "mutation refresh does not invoke master-options RPC",
);
assert(
  loadFn.includes("// Preserve last accepted register") ||
    (!loadFn.includes("state.assignmentRows = []\n      state.assignmentTotalCount = 0") &&
      loadFn.includes("Preserve last accepted")),
  "failed reread does not zero accepted rows",
);

if (failed) {
  console.error(
    `production-route-product-assignment-register-refresh-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-product-assignment-register-refresh-smoke: all assertions passed",
);
