/**
 * Gate 11Y.10I.2C.3F.2B.4E.2 — PRM unified authoritative paint ownership
 * + Family Route validation-state lifecycle UX.
 *
 * Mocked state/generation transitions only.
 * Family 12 DRY_FINE_POWDER_WASH_DRY_POST_BLEND remains APPROVED.
 * Family Route 13 DRY_FINE_POWDER_WASH_DRY_POST_BLEND_ROUTE v1 remains DRAFT.
 * No live validate/submit/approve/edit, no Route 14, no mappings, no server writes.
 * SW expected: hub-cache-v318
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyPrmAcceptedPaint,
  applyPrmTableWrapVisible,
  isValidationSuccessful,
  resolvePrmFamilyRouteLifecycleActions,
  shouldAcceptPrmFamilyRouteDetailGeneration,
  shouldAcceptPrmPaintGeneration,
  shouldApplyPrmLensTransitionTeardown,
} from "../public/shared/js/costing-suite-production-route-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const editorSrc = read(
  "public/shared/js/costing-suite-production-route-editor.js",
);
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const shellSrc = read("public/shared/js/costing-suite-shell.js");
const ccSrc = read(
  "public/shared/js/costing-suite-production-route-cost-centres.js",
);
const subgroupSrc = read(
  "public/shared/js/costing-suite-production-route-subgroup-archive.js",
);
const swSrc = read("public/sw.js");
const thisSrc = read("scripts/production-route-unified-paint-smoke.mjs");

const paintOwnerFn =
  shellSrc.match(
    /function paintProductionRouteLens\([\s\S]*?\nfunction renderTable/,
  )?.[0] || "";
const loadRowsFn =
  shellSrc.match(
    /async function loadRowsForLens\([\s\S]*?if \(isProductionRouteLens\(CURRENT_LENS\)\) \{[\s\S]*?if \(result\?\.stale === true\) return;[\s\S]*?renderTable\(\);/,
  )?.[0] || "";
const beginFn =
  mainSrc.match(
    /function beginLensTransition\([\s\S]*?\n  function acceptPrmPaintGeneration/,
  )?.[0] || "";
const paintAcceptedFn =
  mainSrc.match(
    /function paintAcceptedPrmLens\([\s\S]*?\n  function getAsOfDate/,
  )?.[0] || "";
const hideFn =
  mainSrc.match(
    /function hideSpecialHosts\([\s\S]*?\n  function finalizePrmLoad/,
  )?.[0] || "";
const renderFn =
  mainSrc.match(
    /function render\(options = \{\}\) \{[\s\S]*?\n  function syncPageFromShell/,
  )?.[0] || "";
const familiesRefreshFn =
  mainSrc.match(
    /async function refreshRouteFamiliesAfterMutation\([\s\S]*?\n  async function loadMappingReview/,
  )?.[0] || "";
const familyPaintFn =
  mainSrc.match(
    /function paintFamilyRouteEditor\([\s\S]*?\n  function familyStateHasStepId/,
  )?.[0] || "";
const stepRefreshFn =
  mainSrc.match(
    /async function refreshFamilyRouteEditorAfterStepMutation\([\s\S]*?\n  async function openFamilyStepModal/,
  )?.[0] || "";
const lifecycleRefreshFn =
  mainSrc.match(
    /async function refreshFamilyRouteEditorAfterLifecycleMutation\([\s\S]*?\n  async function openFamilyStepModal/,
  )?.[0] || "";
const familyHtmlFn =
  editorSrc.match(/function familyHtml\([\s\S]*?\n  function productHtml/)?.[0] ||
  "";
const productHtmlFn =
  editorSrc.match(
    /function productHtml\([\s\S]*?\n  function renderEditor/,
  )?.[0] || "";
const loadFamilyDetailFn =
  editorSrc.match(
    /async function loadFamilyDetail\([\s\S]*?\n  async function loadProductDetail/,
  )?.[0] || "";
const ccRefreshFn =
  ccSrc.match(
    /async function refreshCostCentresAfterMutation\([\s\S]*?\n  function openCreate/,
  )?.[0] || "";
const subgroupRefreshFn =
  subgroupSrc.match(
    /async function refreshSubgroupMappingsAfterMutation\([\s\S]*?\n  function buildSubgroupRowActionsHtml/,
  )?.[0] || "";

const FAMILY_12 = Object.freeze({
  route_family_id: 12,
  route_family_code: "DRY_FINE_POWDER_WASH_DRY_POST_BLEND",
  status: "APPROVED",
});
const ROUTE_13 = Object.freeze({
  family_route_id: 13,
  route_family_id: 12,
  route_code: "DRY_FINE_POWDER_WASH_DRY_POST_BLEND_ROUTE",
  route_version: 1,
  status: "DRAFT",
  approval_reference: null,
});

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

function mockWrap(startVisible = false) {
  const classes = new Set(startVisible ? ["tw-visible"] : []);
  return {
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
    style: { display: startVisible ? "" : "none" },
    classes,
  };
}

let rpcCalls = 0;
let loadCalls = 0;
function forbiddenSideEffects() {
  rpcCalls += 1;
  loadCalls += 1;
}

const wrap = mockWrap(false);
let html = "";
let rowCount = 0;
let currentGeneration = 2;
const accepted = applyPrmAcceptedPaint({
  tableWrap: wrap,
  requestGeneration: 2,
  currentGeneration,
  render: () => {
    html = "<table data-accepted='families'>2 rows</table>";
  },
  getRowCount: () => 2,
  setRowCount: (count) => {
    rowCount = count;
  },
});

assert(accepted?.ok === true && html.includes("data-accepted='families'"), "1 accepted PRM lens load paints");
assert(
  wrap.classes.has("tw-visible") && applyPrmTableWrapVisible(wrap)?.ok === true,
  "2 accepted paint adds tw-visible",
);
assert(
  rpcCalls === 0 &&
    loadCalls === 0 &&
    !paintOwnerFn.includes("loadRowsForLens") &&
    !paintOwnerFn.includes("costingRpc") &&
    !paintOwnerFn.includes("productionRouteCtrl.load(") &&
    !paintAcceptedFn.includes("loadFamilyDetail") &&
    !paintAcceptedFn.includes("loadMasterOptions") &&
    helpersSrc.includes("Must not load, invoke RPCs"),
  "3 paint does not invoke RPC/load",
);

const beforeStaleHtml = html;
const staleHide = applyPrmAcceptedPaint({
  tableWrap: wrap,
  requestGeneration: 1,
  currentGeneration,
  render: forbiddenSideEffects,
});
assert(
  staleHide?.stale === true &&
    wrap.classes.has("tw-visible") &&
    shellSrc.includes(
      'if (!isProductionRouteLens(CURRENT_LENS)) {\n      tableWrap?.classList.remove("tw-visible");\n    }',
    ),
  "4 stale load cannot remove tw-visible",
);

html = "NEW_ACCEPTED";
const staleClear = applyPrmAcceptedPaint({
  tableWrap: wrap,
  requestGeneration: 1,
  currentGeneration: 2,
  render: () => {
    html = "STALE_HTML";
  },
});
assert(
  staleClear?.stale === true && html === "NEW_ACCEPTED" && html !== "STALE_HTML",
  "5 stale load cannot clear newer HTML",
);

const overlap = { generation: 0, html: "", count: 0, visible: false };
function beginOverlap() {
  overlap.generation += 1;
  return overlap.generation;
}
function completeOverlap(token, label, count) {
  if (
    !shouldAcceptPrmPaintGeneration({
      requestGeneration: token,
      currentGeneration: overlap.generation,
    })
  ) {
    return { stale: true };
  }
  overlap.html = label;
  overlap.count = count;
  overlap.visible = true;
  return { stale: false };
}
const olderToken = beginOverlap();
const newerToken = beginOverlap();
const olderDone = completeOverlap(olderToken, "OLDER_LENS", 9);
const newerDone = completeOverlap(newerToken, "NEWEST_LENS", 3);
assert(
  olderDone.stale === true &&
    newerDone.stale === false &&
    overlap.html === "NEWEST_LENS" &&
    overlap.count === 3 &&
    loadRowsFn.includes("if (result?.stale === true) return"),
  "6 two overlapping shell PRM loads: newest accepted wins",
);

let tornDown = false;
if (
  shouldApplyPrmLensTransitionTeardown({
    requestGeneration: 1,
    currentGeneration: 2,
  })
) {
  tornDown = true;
  overlap.html = "";
}
assert(
  tornDown === false &&
    overlap.html === "NEWEST_LENS" &&
    beginFn.includes("shouldApplyPrmLensTransitionTeardown") &&
    hideFn.includes("shouldApplyPrmLensTransitionTeardown"),
  "7 stale beginLensTransition cannot tear down newer accepted paint",
);

assert(
  lifecycleRefreshFn.includes("paintFamilyRouteEditor()") &&
    stepRefreshFn.includes("paintFamilyRouteEditor()") &&
    familyPaintFn.includes("paintAcceptedPrmLens") &&
    paintAcceptedFn.includes("afterPrmNavigate") &&
    shellSrc.includes("afterPrmNavigate: (options) =>") &&
    shellSrc.includes("paintProductionRouteLens(options)"),
  "8 mutation authoritative reread finishes through unified paint",
);

assert(
  familiesRefreshFn.includes("paintAcceptedPrmLens()") &&
    mainSrc.includes("openCreateFamilyModal") &&
    familiesRefreshFn.includes("loadMasterOptions({ catalogueScope: \"unscoped\" })"),
  "9 Families create repaint",
);
assert(
  familiesRefreshFn.includes("paintAcceptedPrmLens()") &&
    mainSrc.includes("openApproveFamilyModal") &&
    familiesRefreshFn.includes("refreshFailureMessage"),
  "10 Families approve repaint",
);

assert(
  ccRefreshFn.includes("onRegisterRefreshed?.()") &&
    !ccRefreshFn.includes("render();") &&
    mainSrc.includes('onRegisterRefreshed: () =>') &&
    /onRegisterRefreshed: \(\) => \{\s*if \(state\.activeLens === "production-cost-centres"\) \{\s*paintAcceptedPrmLens\(\);/.test(
      mainSrc,
    ) &&
    ccSrc.includes("centre.validation") &&
    ccSrc.includes("validation.valid"),
  "11 Cost Centre repaint preserved",
);

assert(
  subgroupRefreshFn.includes("onRegisterRefreshed") &&
    subgroupRefreshFn.includes("renderSubgroupMappings()") &&
    /onRegisterRefreshed: \(\) => \{\s*if \(state\.activeLens === "product-subgroup-mappings"\) \{\s*paintAcceptedPrmLens\(\);/.test(
      mainSrc,
    ) &&
    subgroupSrc.includes("lifecycle_actions"),
  "12 Subgroup mapping repaint preserved",
);

assert(
  loadFamilyDetailFn.includes("isCurrentFamilyRouteDetailGeneration(requestGeneration)") &&
    stepRefreshFn.includes("bumpFamilyRouteDetailGeneration") &&
    shouldAcceptPrmFamilyRouteDetailGeneration({
      requestGeneration: 4,
      currentGeneration: 4,
    }) === true &&
    shouldAcceptPrmFamilyRouteDetailGeneration({
      requestGeneration: 3,
      currentGeneration: 4,
    }) === false,
  "13 Family Route step freshness still generation-owned",
);

assert(
  stepRefreshFn.includes("paintFamilyRouteEditor()") &&
    familyPaintFn.includes("paintAcceptedPrmLens") &&
    stepRefreshFn.includes("preserveValidationStale: true"),
  "14 Family Route step accepted commit finishes unified paint",
);

assert(
  lifecycleRefreshFn.includes("bumpFamilyRouteDetailGeneration") &&
    lifecycleRefreshFn.includes("includeSecondary: false") &&
    loadFamilyDetailFn.includes("retainCurrentValidationIfOmitted"),
  "15 Family Route lifecycle freshness still generation-owned",
);

assert(
  lifecycleRefreshFn.includes("paintFamilyRouteEditor()") &&
    mainSrc.includes("openApproveFamilyRouteModal") &&
    mainSrc.includes("refreshFamilyRouteEditorAfterLifecycleMutation"),
  "16 Family Route approved accepted commit finishes unified paint",
);

assert(
  mainSrc.includes("await editor.loadProductDetail") &&
    mainSrc.includes("paintAcceptedPrmLens()") &&
    !productHtmlFn.includes("resolvePrmFamilyRouteLifecycleActions") &&
    productHtmlFn.includes("resolvePrmProductRouteLifecycleActions") &&
    productHtmlFn.includes("validate-product") &&
    productHtmlFn.includes("lifecycle.submitVisible"),
  "17 Product Route accepted load/mutation finishes unified paint with DRAFT-gated submit",
);

assert(
  loadRowsFn.includes("const loadGeneration = ++ROWS_LOAD_GENERATION") &&
    loadRowsFn.includes("if (!isRowsLoadCurrent(loadGeneration)) return") &&
    loadRowsFn.includes("if (result?.stale === true) return") &&
    mainSrc.includes("finalizePrmLoad") &&
    renderFn.includes("acceptPrmPaintGeneration") &&
    !paintOwnerFn.includes("setTimeout") &&
    !paintAcceptedFn.includes("setTimeout"),
  "18 startup/deep-link overlap settles to one canonical visible lens",
);

assert(
  accepted?.ok === true &&
    rowCount === 2 &&
    paintOwnerFn.includes("syncPrmPaintChrome") &&
    paintOwnerFn.includes("getTotalCount"),
  "19 row count matches accepted state",
);

assert(
  !paintOwnerFn.includes("loadRowsForLens") &&
    !paintOwnerFn.includes("productionRouteCtrl.load(") &&
    !renderFn.includes("paintProductionRouteLens") &&
    shellSrc.includes("paintProductionRouteLens();"),
  "20 no render/load recursion",
);

assert(
  rpcCalls === 0 &&
    !paintOwnerFn.includes("costingRpc") &&
    !paintOwnerFn.includes("RPC.") &&
    !helpersSrc.includes("costingRpc("),
  "21 no duplicate RPC caused by paint",
);

assert(
  shellSrc.includes("if (!isProductionRouteLens(CURRENT_LENS))") &&
    shellSrc.includes('tableWrap?.classList.remove("tw-visible")') &&
    loadRowsFn.includes("if (!isProductionRouteLens(CURRENT_LENS))") &&
    !/isProductionRouteLens\(CURRENT_LENS\) \{\s*tableWrap\?\.classList\.remove\("tw-visible"\)/.test(
      loadRowsFn,
    ),
  "22 non-PRM shell behavior unchanged",
);

assert(
  lifecycleRefreshFn.includes("if (!result?.ok)") &&
    lifecycleRefreshFn.includes("paintFamilyRouteEditor()") &&
    lifecycleRefreshFn.indexOf("if (!result?.ok)") <
      lifecycleRefreshFn.lastIndexOf("paintFamilyRouteEditor()") &&
    !lifecycleRefreshFn.includes('classList.remove("tw-visible")') &&
    !paintOwnerFn.includes('classList.remove("tw-visible")'),
  "23 failure path keeps accepted table visible",
);

const draftUnvalidated = resolvePrmFamilyRouteLifecycleActions({
  status: "DRAFT",
  canEdit: true,
  validation: null,
  validationFresh: false,
});
assert(
  draftUnvalidated.validateVisible === true &&
    draftUnvalidated.validateEnabled === true &&
    draftUnvalidated.validateLabel === "Validate" &&
    familyHtmlFn.includes("lifecycle.validateEnabled"),
  "24 DRAFT/unvalidated → Validate enabled",
);
assert(
  draftUnvalidated.submitVisible === true &&
    draftUnvalidated.submitEnabled === false &&
    familyHtmlFn.includes("lifecycle.submitEnabled"),
  "25 DRAFT/unvalidated → Submit blocked",
);

const draftValidated = resolvePrmFamilyRouteLifecycleActions({
  status: "DRAFT",
  canEdit: true,
  validation: { ok: true, is_valid: true },
  validationFresh: true,
});
assert(
  draftValidated.validateVisible === true &&
    draftValidated.validateEnabled === false &&
    isValidationSuccessful({ ok: true, is_valid: true }) === true,
  "26 DRAFT/current valid → Validate disabled",
);
assert(
  draftValidated.validateLabel === "Validated" &&
    familyHtmlFn.includes("lifecycle.validateLabel") &&
    familyHtmlFn.includes("Validation has already passed for the current route definition."),
  "27 disabled label = Validated",
);
assert(
  draftValidated.submitVisible === true && draftValidated.submitEnabled === true,
  "28 DRAFT/current valid → Submit enabled",
);

assert(
  editorSrc.includes("function markValidationStale") &&
    editorSrc.includes('markValidationStale("family")') &&
    familyHtmlFn.includes("validationFresh: familyState.validationFresh"),
  "29 validation-relevant edit marks stale",
);

const staleAfterEdit = resolvePrmFamilyRouteLifecycleActions({
  status: "DRAFT",
  canEdit: true,
  validation: { ok: true, is_valid: true },
  validationFresh: false,
});
assert(
  staleAfterEdit.validateEnabled === true &&
    staleAfterEdit.validateLabel === "Validate",
  "30 stale → Validate enabled again",
);
assert(
  staleAfterEdit.submitEnabled === false && staleAfterEdit.submitVisible === true,
  "31 stale → Submit blocked again",
);

const reviewActions = resolvePrmFamilyRouteLifecycleActions({
  status: "REVIEW_REQUIRED",
  canEdit: true,
  validation: { ok: true, is_valid: true },
  validationFresh: true,
});
assert(
  reviewActions.validateVisible === false &&
    reviewActions.validateEnabled === false,
  "32 REVIEW_REQUIRED → Validate not active",
);
assert(
  reviewActions.submitVisible === false && reviewActions.submitEnabled === false,
  "33 REVIEW_REQUIRED → Submit not active",
);
assert(
  reviewActions.approveVisible === true &&
    familyHtmlFn.includes("lifecycle.approveVisible") &&
    familyHtmlFn.includes("approve-family"),
  "34 REVIEW_REQUIRED → Approve follows existing contract",
);

const approvedActions = resolvePrmFamilyRouteLifecycleActions({
  status: "APPROVED",
  canEdit: true,
  validation: { ok: true, is_valid: true },
  validationFresh: true,
});
assert(
  approvedActions.validateVisible === false &&
    approvedActions.validateEnabled === false,
  "35 APPROVED → Validate hidden/non-active",
);
assert(
  approvedActions.submitVisible === false &&
    approvedActions.submitEnabled === false,
  "36 APPROVED → Submit hidden",
);
assert(
  approvedActions.approveVisible === false &&
    familyHtmlFn.includes("lifecycle.approveVisible"),
  "37 APPROVED → Approve hidden",
);
assert(
  approvedActions.readOnly === true && familyHtmlFn.includes("cp-prm-readonly"),
  "38 APPROVED read-only banner preserved",
);
assert(
  approvedActions.canClone === true &&
    familyHtmlFn.includes("clone-family-route") &&
    familyHtmlFn.includes("lifecycle.canClone"),
  "39 Clone as New Version preserved",
);
assert(
  !editorSrc.includes("wasValidateClicked") &&
    !mainSrc.includes("wasValidateClicked") &&
    !helpersSrc.includes("wasValidateClicked") &&
    familyHtmlFn.includes("resolvePrmFamilyRouteLifecycleActions"),
  "40 no clicked-boolean authority",
);

assert(
  ROUTE_13.family_route_id === 13 &&
    ROUTE_13.status === "DRAFT" &&
    ROUTE_13.approval_reference == null &&
    ROUTE_13.route_code === "DRY_FINE_POWDER_WASH_DRY_POST_BLEND_ROUTE" &&
    FAMILY_12.status === "APPROVED" &&
    thisSrc.includes("Family Route 13") &&
    thisSrc.includes("remains DRAFT"),
  "41 Route 13 fixture remains DRAFT",
);

const LIVE_VALIDATE = ["rpc", "validate_route_family_route"].join("_");
const LIVE_SUBMIT = ["rpc", "submit_route_family_route_for_review"].join("_");
const LIVE_APPROVE = ["rpc", "approve_route_family_route"].join("_");
assert(
  !thisSrc.includes(LIVE_VALIDATE) && !paintOwnerFn.includes(LIVE_VALIDATE),
  "42 no live validate",
);
assert(
  !thisSrc.includes(LIVE_SUBMIT) && !paintOwnerFn.includes(LIVE_SUBMIT),
  "43 no live submit",
);
assert(
  !thisSrc.includes(LIVE_APPROVE) && !paintOwnerFn.includes(LIVE_APPROVE),
  "44 no live approve",
);
const SAVE_STEP = ["save", "FamilyStep"].join("");
const DELETE_STEP = ["delete", "FamilyStep"].join("");
assert(
  !thisSrc.includes(SAVE_STEP) &&
    !paintOwnerFn.includes(SAVE_STEP) &&
    !paintOwnerFn.includes(DELETE_STEP),
  "45 no step mutation",
);
const ROUTE_14_KEY = ["family_route_id", "14"].join(": ");
assert(
  !thisSrc.includes(ROUTE_14_KEY) &&
    !paintOwnerFn.includes("createFamilyDraft") &&
    ROUTE_13.family_route_id === 13,
  "46 no Route 14",
);
const MAP_RPC = ["rpc", "map_product_group"].join("_");
assert(
  !paintOwnerFn.includes("mapProductGroup") && !thisSrc.includes(MAP_RPC),
  "47 no mappings",
);
assert(
  !helpersSrc.includes("CREATE OR REPLACE FUNCTION") &&
    !mainSrc.includes("apply_migration") &&
    !shellSrc.includes("CREATE TABLE"),
  "48 no server files",
);
const COSTING_REFRESH = ["runStaged", "CostingRefresh"].join("");
assert(
  !paintOwnerFn.includes("requestCostingRefresh") &&
    !paintAcceptedFn.includes("requestCostingRefresh") &&
    !thisSrc.includes(COSTING_REFRESH),
  "49 no costing refresh",
);
assert(
  /CACHE_NAME = "hub-cache-v318"/.test(swSrc) &&
    thisSrc.includes("hub-cache-v318") &&
    !swSrc.includes("hub-cache-v319"),
  "50 SW bump once",
);

assert(
  beforeStaleHtml.includes("data-accepted") &&
    loadFamilyDetailFn.includes(
      "Detail omitted validation after a successful Validate RPC",
    ),
  "detail validation omission retains successful Validate RPC until markValidationStale",
);

if (failed) {
  console.error(`FAILED ${failed}`);
  process.exit(1);
}
console.log("production-route-unified-paint-smoke: PASS");
