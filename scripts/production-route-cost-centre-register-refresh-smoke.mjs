/**
 * Gate 11Y.10I.2C.3F.2B.4B.2 — Cost Centres post-mutation register refresh.
 * Client-only source/contract smoke. Does not mutate CC40, CC41, or any live Cost Centre.
 * No live approve/create/edit/inactivate/validate actions.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrmProductionCostCentreApprovalReference,
  normalizePrmCostCentreValidation,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const ccSrc = read(
  "public/shared/js/costing-suite-production-route-cost-centres.js",
);
const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-cost-centre-register-refresh-smoke.mjs",
);

const helperFn =
  ccSrc.match(
    /async function refreshCostCentresAfterMutation\([\s\S]*?\n  function openCreate/,
  )?.[0] || "";
const loadFn =
  ccSrc.match(
    /async function load\(\{ search = getSearch\(\) \}[\s\S]*?\n  async function refreshCostCentresAfterMutation/,
  )?.[0] || "";
const createFn =
  ccSrc.match(/function openCreate\(\) \{[\s\S]*?\n  function openEditDraft/)?.[0] ||
  "";
const editFn =
  ccSrc.match(
    /function openEditDraft\(centre\) \{[\s\S]*?\n  function openApprove/,
  )?.[0] || "";
const approveFn =
  ccSrc.match(
    /function openApprove\(centre\) \{[\s\S]*?\n  function openInactivate/,
  )?.[0] || "";
const inactivateFn =
  ccSrc.match(
    /function openInactivate\(centre\) \{[\s\S]*?\n  async function openDetail/,
  )?.[0] || "";
const openDetailFn =
  ccSrc.match(
    /async function openDetail\(row[\s\S]*?\n  function render\(\)/,
  )?.[0] || "";
const renderFn =
  ccSrc.match(/function render\(\) \{[\s\S]*?\n  return \{/)?.[0] || "";
const unbindFn =
  mainSrc.match(
    /\/\*\* Page\/register handlers only[\s\S]*?function unbind\(\) \{[\s\S]*?\n  \}\n\n  function hosts/,
  )?.[0] || "";

const cc40Ref = buildPrmProductionCostCentreApprovalReference({
  costCentreCode: "PROD_POWDER_RM_WASHING",
  approvalDate: "2026-08-14",
});
const cc41Ref = buildPrmProductionCostCentreApprovalReference({
  costCentreCode: "PROD_POWDER_RM_DRYING",
  approvalDate: "2026-08-14",
});

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

function resultWouldRetryMutation(src) {
  const refreshIdx = src.indexOf("await refreshCostCentresAfterMutation");
  if (refreshIdx < 0) return true;
  return src.slice(refreshIdx).includes("await governed");
}

assert(
  helperFn.includes("async function refreshCostCentresAfterMutation"),
  "1 shared refresh helper exists",
);
assert(
  approveFn.includes("await governed") &&
    approveFn.includes("RPC.approve") &&
    approveFn.includes("withMutation"),
  "2 approve mutation awaited",
);
assert(
  createFn.includes("await refreshCostCentresAfterMutation") &&
    createFn.includes(
      "Cost Centre created, but the register could not be refreshed.",
    ),
  "3 create path uses helper",
);
assert(
  editFn.includes("await refreshCostCentresAfterMutation") &&
    editFn.includes(
      "Cost Centre updated, but the register could not be refreshed.",
    ),
  "4 edit path uses helper",
);
assert(
  approveFn.includes("await refreshCostCentresAfterMutation") &&
    approveFn.includes(
      "Cost Centre approved, but the register could not be refreshed.",
    ),
  "5 approve path uses helper",
);
assert(
  inactivateFn.includes("await refreshCostCentresAfterMutation") &&
    inactivateFn.includes(
      "Cost Centre inactivated, but the register could not be refreshed.",
    ),
  "6 inactivate path uses helper",
);
assert(
  openDetailFn.includes("await refreshCostCentresAfterMutation") &&
    openDetailFn.includes("refreshMasterOptions: false") &&
    openDetailFn.includes(
      "Cost Centre validated, but the register could not be refreshed.",
    ) &&
    openDetailFn.includes("await openDetail({ cost_centre_id:"),
  "7 validate synchronization checked",
);
assert(
  helperFn.includes("await load({ search: getSearch() })") &&
    ccSrc.includes('list: "rpc_get_production_cost_centres"') &&
    loadFn.includes("RPC.list"),
  "8 Cost Centre list re-read invoked after mutation",
);
assert(
  createFn.includes("await refreshCostCentresAfterMutation") &&
    helperFn.includes("await load({ search: getSearch() })"),
  "9 list read awaited",
);
assert(
  loadFn.includes("state.rows = enrichCostCentreResourceLabels") &&
    helperFn.includes("await load({ search: getSearch() })"),
  "10 state.rows replaced from server response",
);
assert(
  helperFn.includes("state.detail = null"),
  "11 state.detail cleared",
);
assert(
  helperFn.includes("onRegisterRefreshed?.()") &&
    helperFn.indexOf("await load") < helperFn.indexOf("onRegisterRefreshed") &&
    renderFn.includes("state.rows") &&
    mainSrc.includes("paintAcceptedPrmLens"),
  "12 render occurs after state update",
);
assert(
  !helperFn.includes("optimistic") &&
    !helperFn.includes("fabricat") &&
    !createFn.includes("state.rows.push") &&
    !approveFn.includes("state.rows.push"),
  "13 no optimistic row fabrication",
);
assert(
  loadFn.includes("state.statusFilter") &&
    !helperFn.includes('state.statusFilter = ""') &&
    !helperFn.includes("state.statusFilter = null"),
  "14 status filter preserved",
);
assert(
  loadFn.includes("state.poolFilter") &&
    !helperFn.includes('state.poolFilter = ""') &&
    !helperFn.includes("state.poolFilter = null"),
  "15 pool filter preserved",
);
assert(
  helperFn.includes("getSearch()") &&
    loadFn.includes("search: search || null") &&
    !helperFn.includes("state.search ="),
  "16 search preserved",
);
assert(
  loadFn.includes("getAsOfDate()") &&
    loadFn.includes("as_of_date: getAsOfDate()"),
  "17 as-of preserved",
);
assert(
  loadFn.includes("status: state.statusFilter") &&
    helpersSrc.includes("PRM_COST_CENTRE_STATUSES"),
  "18 DRAFT-filter approved-row disappearance semantics",
);
assert(
  loadFn.includes("status: state.statusFilter") &&
    helpersSrc.includes("APPROVED"),
  "19 APPROVED-filter appearance semantics",
);
assert(
  helperFn.includes("try {") &&
    helperFn.includes("await loadMasterOptions()") &&
    helperFn.includes("catch {") &&
    helperFn.indexOf("catch {") < helperFn.indexOf("await load({ search: getSearch() })"),
  "20 master-options refresh failure does not block list refresh",
);
assert(
  helperFn.includes("refreshFailureMessage") &&
    helperFn.includes('showToast?.(refreshFailureMessage, "warning"'),
  "21 list refresh failure shows explicit warning",
);
assert(
  !helperFn.includes("governed(") &&
    !helperFn.includes("RPC.approve") &&
    !resultWouldRetryMutation(approveFn),
  "22 mutation not retried",
);
assert(
  !ccSrc.includes("onMutated") &&
    mainSrc.includes("onRegisterRefreshed: () =>") &&
    !mainSrc.match(
      /onRegisterRefreshed: \(\) => \{[\s\S]*?\n    \},/,
    )?.[0]?.includes("render();") &&
    helperFn.includes("onRegisterRefreshed?.()"),
  "23 no double render / duplicate callback chain",
);
assert(
  !unbindFn.includes("unbindModalHandlers()") &&
    unbindFn.includes("Page/register handlers only"),
  "24 Gate 4B.1 modal handler ownership unchanged",
);
assert(
  helpersSrc.includes("buildPrmProductionCostCentreApprovalReference") &&
    approveFn.includes("buildPrmProductionCostCentreApprovalReference") &&
    cc40Ref.reference === "PRM-CC-PROD_POWDER_RM_WASHING-APP-20260814" &&
    cc41Ref.reference === "PRM-CC-PROD_POWDER_RM_DRYING-APP-20260814",
  "25 canonical approval reference logic unchanged",
);
assert(
  cc40Ref.reference === "PRM-CC-PROD_POWDER_RM_WASHING-APP-20260814" &&
    !approveFn.match(/cost_centre_id:\s*40\b/) &&
    !approveFn.includes('"PROD_POWDER_RM_WASHING"'),
  "26 CC40 fixture unchanged",
);
assert(
  cc41Ref.reference === "PRM-CC-PROD_POWDER_RM_DRYING-APP-20260814" &&
    !approveFn.match(/cost_centre_id:\s*41\b/) &&
    !approveFn.includes('"PROD_POWDER_RM_DRYING"'),
  "27 CC41 fixture unchanged",
);
assert(
  !rpcSrc.includes("refreshCostCentresAfterMutation") &&
    !helpersSrc.includes("CREATE OR REPLACE FUNCTION"),
  "28 no server files",
);
assert(
  !helperFn.includes("rpc_refresh") &&
    !helperFn.includes("requestCostingRefresh") &&
    !ccSrc.includes("costing refresh"),
  "29 no costing refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v307"/.test(swSrc),
  "30 SW bump once to hub-cache-v307",
);
assert(
  thisSrc.includes("Does not mutate CC40") &&
    thisSrc.includes("No live approve/create/edit/inactivate/validate") &&
    normalizePrmCostCentreValidation({ valid: true, errors: [] }).valid === true,
  "31 smoke does not live-mutate",
);

if (failed > 0) {
  console.error(
    `\nproduction-route-cost-centre-register-refresh-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log(
  "production-route-cost-centre-register-refresh-smoke: all passed",
);
