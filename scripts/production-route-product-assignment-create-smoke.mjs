/**
 * Gate 11Y.10I.2C.3F.2B.4F.1 / 4F.1A — Product Assignment Create UX + zero-row eligibility.
 * Client-only source/contract smoke. Mocked transitions only.
 * Does NOT create/submit/approve any live Product assignment.
 * Does NOT assign Product 144 / Product 117. No Route 13/14 mutation. No mappings. No SW bump here.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrmProductRouteFamilyAssignmentApprovalReference,
  resolvePrmProductAssignmentCreateEligibility,
  resolvePrmProductRouteFamilyAssignmentApprovalIdentity,
  validatePrmProductRouteFamilyAssignmentApprovalReference,
  PRM_ASSIGNMENT_STATUSES,
  PRM_PRODUCT_ROUTE_FAMILY_ASSIGNMENT_APPROVAL_REFERENCE_RE,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import { buildCreateProductRouteFamilyAssignmentDraftArgs } from "../public/shared/js/costing-suite-production-route-rpc.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const mainSrc = read("public/shared/js/costing-suite-production-route.js");
const helpersSrc = read(
  "public/shared/js/costing-suite-production-route-helpers.js",
);
const rpcSrc = read("public/shared/js/costing-suite-production-route-rpc.js");
const swSrc = read("public/sw.js");
const thisSrc = read(
  "scripts/production-route-product-assignment-create-smoke.mjs",
);

const createFn =
  mainSrc.match(
    /function openCreateAssignmentDraftModal\([\s\S]*?\n  function openSubmitAssignmentModal/,
  )?.[0] || "";
const approveFn =
  mainSrc.match(
    /function openApproveAssignmentModal\([\s\S]*?\n  function openCancelAssignmentModal/,
  )?.[0] || "";
const submitFn =
  mainSrc.match(
    /function openSubmitAssignmentModal\([\s\S]*?\n  function openApproveAssignmentModal/,
  )?.[0] || "";
const cancelFn =
  mainSrc.match(
    /function openCancelAssignmentModal\([\s\S]*?\n  function openInactivateAssignmentModal/,
  )?.[0] || "";
const inactivateFn =
  mainSrc.match(
    /function openInactivateAssignmentModal\([\s\S]*?\n  function /,
  )?.[0] || "";
const refreshFn =
  mainSrc.match(
    /async function refreshAfterAssignmentMutation\([\s\S]*?\n  function buildAssignmentRouteFamilyOptionsHtml/,
  )?.[0] || "";
const refreshRegisterFn =
  mainSrc.match(
    /async function refreshProductAssignmentsAfterMutation\([\s\S]*?\n  async function refreshAfterAssignmentMutation/,
  )?.[0] || "";
const toolbarFn =
  mainSrc.match(
    /function assignmentRegisterToolbarHtml\([\s\S]*?\n  function assignmentRegisterSummaryHtml/,
  )?.[0] || "";
const renderFn =
  mainSrc.match(
    /function renderAssignments\(\) \{[\s\S]*?\n  function renderReadiness/,
  )?.[0] || "";
const bindChromeFn =
  mainSrc.match(
    /function bindAssignmentRegisterChrome\([\s\S]*?\n  function renderAssignments/,
  )?.[0] || "";
const paintFn =
  mainSrc.match(
    /function paintAcceptedPrmLens\([\s\S]*?\n  function /,
  )?.[0] || "";
const quietEligFn =
  mainSrc.match(
    /async function loadProductScopedAssignmentsForEligibility\([\s\S]*?\n  function applyAssignmentStatusCounts/,
  )?.[0] || "";
const evaluateEligFn =
  mainSrc.match(
    /async function evaluateProductAssignmentCreateEligibility\([\s\S]*?\n  function buildAssignmentRowActionsHtml/,
  )?.[0] || "";
const createRpcFn =
  rpcSrc.match(
    /export function buildCreateProductRouteFamilyAssignmentDraftArgs\([\s\S]*?\nexport function buildSubmitProductRouteFamilyAssignmentArgs/,
  )?.[0] || "";
const approveRpcFn =
  rpcSrc.match(
    /export function buildApproveProductRouteFamilyAssignmentArgs\([\s\S]*?\nexport function /,
  )?.[0] || "";
const prfaBuilderFn =
  helpersSrc.match(
    /export function buildPrmProductRouteFamilyAssignmentApprovalReference\([\s\S]*?\nexport function validatePrmProductRouteFamilyAssignmentApprovalReference/,
  )?.[0] || "";
const eligibilityFn =
  helpersSrc.match(
    /export function resolvePrmProductAssignmentCreateEligibility\([\s\S]*?\nexport function buildPrmFamilyRouteApprovalReferenceTemplate/,
  )?.[0] || "";

let failed = 0;
function assert(ok, message) {
  if (ok) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const createRpcName = ["rpc", "create_product_route_family_assignment_draft"].join(
  "_",
);
const submitRpcName = [
  "rpc",
  "submit_product_route_family_assignment_for_review",
].join("_");
const approveRpcName = [
  "rpc",
  "approve_product_route_family_assignment",
].join("_");
const productRouteCreateRpc = ["rpc", "create_product_route_draft"].join("_");
const mapSubgroupRpc = ["rpc", "map_product_subgroup_to_route_family"].join("_");
const mapGroupRpc = ["rpc", "map_product_group_to_route_family"].join("_");

assert(
  toolbarFn.includes("Create Product Assignment") &&
    toolbarFn.includes("data-prm-create-product-assignment") &&
    toolbarFn.includes("canEdit()"),
  "1 register Create visible with edit",
);
assert(
  renderFn.includes("assignmentRegisterSummaryHtml()") &&
    renderFn.includes('!state.assignmentRows.length') &&
    bindChromeFn.includes("data-prm-create-product-assignment"),
  "2 Create visible with zero rows",
);
assert(
  renderFn.includes("state.assignmentRows") &&
    toolbarFn.includes("Create Product Assignment"),
  "3 Create visible with existing rows",
);
assert(
  /canEdit\(\)\s*\?\s*`<button[^>]*data-prm-create-product-assignment/.test(
    toolbarFn,
  ) && toolbarFn.includes(': ""'),
  "4 hidden view-only",
);
assert(
  createFn.includes('showToast?.("Edit permission required.", "warning")') &&
    createFn.indexOf("if (!canEdit())") <
      createFn.indexOf("const registerLaunch"),
  "5 indirect no-edit explicit toast",
);
assert(
  bindChromeFn.includes("openCreateAssignmentDraftModal(null)") &&
    createFn.includes("openModal") &&
    createFn.includes("Create Product Assignment") &&
    createFn.indexOf("openModal") <
      createFn.indexOf("RPC.createAssignmentDraft"),
  "6 register create modal opens without RPC",
);
assert(
  createFn.includes("registerLaunch") &&
    createFn.includes('id: "prmAssignProduct"') &&
    createFn.includes("enhanceSearchableSelect(productSelect") &&
    createFn.includes("buildAssignmentProductOptionsHtml"),
  "7 Product searchable selector exists",
);
assert(
  createFn.includes("readonly: true") &&
    createFn.includes("lockedProductId") &&
    createFn.includes("!registerLaunch") &&
    createFn.includes("productSelect.readOnly = true"),
  "8 Product summary launch still locks Product",
);
assert(
  createFn.includes('id: "prmAssignRouteFamily"') &&
    createFn.includes("enhanceSearchableSelect(familySelect") &&
    createFn.includes("listApprovedRouteFamiliesForAssignment") ||
    mainSrc.includes("buildAssignmentRouteFamilyOptionsHtml") &&
      createFn.includes("buildAssignmentRouteFamilyOptionsHtml"),
  "9 Route Family searchable selector exists",
);
const createArgs = buildCreateProductRouteFamilyAssignmentDraftArgs({
  product_id: 117,
  route_family_id: 12,
  effective_from: "2026-08-14",
  assignment_basis: "MANUAL",
  assignment_note: "  note  ",
});
assert(
  createArgs.ok && createArgs.params.p_product_id === 117,
  "10 exact product_id submitted",
);
assert(
  createArgs.ok && createArgs.params.p_route_family_id === 12,
  "11 exact route_family_id submitted",
);
assert(
  createArgs.ok && createArgs.params.p_effective_from === "2026-08-14",
  "12 Effective From submitted independently",
);
assert(
  createFn.includes("registerBasisLocked") &&
    createFn.includes('value: "MANUAL"') &&
    createFn.includes("resolveModalBasis") &&
    createFn.includes('if (registerBasisLocked) return "MANUAL"'),
  "13 register basis MANUAL",
);
assert(
  createFn.includes("fromCandidate") &&
    createFn.includes("HISTORICAL_REVIEW") &&
    mainSrc.includes('assignment_basis: "HISTORICAL_REVIEW"'),
  "14 historical prefill behavior preserved",
);
assert(
  createArgs.params.p_assignment_note === "note" &&
    buildCreateProductRouteFamilyAssignmentDraftArgs({
      product_id: 1,
      route_family_id: 2,
      assignment_note: "   ",
    }).params.p_assignment_note == null &&
    createRpcFn.includes("String(noteRaw).trim()"),
  "15 note trims/nulls",
);
assert(
  createFn.includes("RPC.createAssignmentDraft") &&
    createFn.includes("buildCreateProductRouteFamilyAssignmentDraftArgs") &&
    (createFn.match(/RPC\.createAssignmentDraft/g) || []).length === 1,
  "16 create RPC invoked once",
);
assert(
  !createFn.includes(productRouteCreateRpc) &&
    !createFn.includes("RPC.createProductRoute") &&
    !createFn.includes("createProductRoute"),
  "17 no Product Route RPC",
);
assert(
  !createFn.includes(mapSubgroupRpc) &&
    !createFn.includes(mapGroupRpc) &&
    !createFn.includes("RPC.mapSubgroup") &&
    !createFn.includes("RPC.mapGroup"),
  "18 no subgroup/group mapping RPC",
);
assert(
  !createFn.includes("RPC.submitAssignment") &&
    createFn.includes("nothing was submitted or approved") &&
    !/createAssignmentDraft[\s\S]*submitAssignment/.test(createFn),
  "19 no auto submit",
);
assert(
  !createFn.includes("RPC.approveAssignment") &&
    !/createAssignmentDraft[\s\S]*approveAssignment/.test(createFn),
  "20 no auto approve",
);
const draftGuard = resolvePrmProductAssignmentCreateEligibility({
  canEdit: true,
  payload: {
    rows: [{ assignment_id: 1, status: "DRAFT" }],
    lifecycle_actions: ["CREATE_ASSIGNMENT_DRAFT"],
  },
});
assert(
  draftGuard.mode === "writable_draft" &&
    draftGuard.canCreate === false &&
    eligibilityFn.includes("writable_draft"),
  "21 writable DRAFT guard",
);
const reviewGuard = resolvePrmProductAssignmentCreateEligibility({
  canEdit: true,
  payload: {
    rows: [{ assignment_id: 2, status: "IN_REVIEW" }],
    lifecycle_actions: ["CREATE_ASSIGNMENT_DRAFT"],
  },
});
assert(
  reviewGuard.mode === "writable_in_review" && reviewGuard.canCreate === false,
  "22 IN_REVIEW guard",
);
const approvedWarn = resolvePrmProductAssignmentCreateEligibility({
  canEdit: true,
  payload: {
    rows: [{ assignment_id: 3, status: "APPROVED" }],
    lifecycle_actions: ["CREATE_ASSIGNMENT_DRAFT"],
  },
});
assert(
  approvedWarn.mode === "approved_replacement" &&
    approvedWarn.canCreate === true &&
    approvedWarn.message.includes("will supersede the current assignment") &&
    eligibilityFn.includes("will supersede the current assignment"),
  "23 approved-current replacement warning",
);
assert(
  !createFn.includes("RPC.inactivateAssignment") &&
    !createFn.includes("inactivateAssignment") &&
    approvedWarn.canCreate === true,
  "24 approved-current does not silently inactivate on create",
);
assert(
  approveFn.includes("supersedes") ||
    approveFn.includes("supersede") &&
      approveRpcFn.includes(approveRpcName) ||
    helpersSrc.includes("rpc_approve_product_route_family_assignment") ||
    approveFn.includes(
      "Approving a replacement assignment from a later Effective From date supersedes",
    ),
  "25 server supersession contract documented/preserved",
);
const createSuccessSlice = createFn.slice(
  createFn.indexOf("RPC.createAssignmentDraft"),
);
assert(
  createSuccessSlice.includes("closeModal({ restorePrevious: false })") &&
    createSuccessSlice.indexOf("if (!response.ok)") <
      createSuccessSlice.indexOf("closeModal({ restorePrevious: false })"),
  "26 success closes modal",
);
assert(
  createFn.includes("refreshAfterAssignmentMutation") &&
    (refreshFn.includes("refreshProductAssignmentsAfterMutation") ||
      refreshRegisterFn.includes("loadProductAssignments")) &&
    refreshRegisterFn.includes("await loadProductAssignments"),
  "27 authoritative assignments reread",
);
assert(
  (refreshRegisterFn.includes("paintAcceptedPrmLens()") ||
    refreshFn.includes("paintAcceptedPrmLens()")) &&
    !refreshFn.includes("renderAssignments()") &&
    !refreshRegisterFn.includes("renderAssignments()") &&
    (paintFn.includes("paintProductionRouteLens") ||
      mainSrc.includes("function paintAcceptedPrmLens")),
  "28 unified paint owner used",
);
assert(
  refreshRegisterFn.includes("loadProductAssignments") &&
    refreshRegisterFn.includes("paintAcceptedPrmLens") &&
    !createFn.includes("assignmentRows.push") &&
    !createFn.includes("optimistic"),
  "29 DRAFT appears immediately when filters include it",
);
assert(
  mainSrc.includes("state.assignmentTotalCount") &&
    refreshRegisterFn.includes("loadProductAssignments"),
  "30 count updates from accepted server state",
);
assert(
  refreshFn.includes("resetOffset: false") &&
    !refreshFn.includes('state.search = ""') &&
    !refreshFn.includes('state.assignment_status = ""'),
  "31 filters preserved",
);
assert(
  !createFn.includes("manual Refresh") &&
    createFn.includes("await refreshAfterAssignmentMutation") &&
    !refreshFn.includes("reloadCurrentLens"),
  "32 no manual Refresh dependency",
);
assert(
  PRM_ASSIGNMENT_STATUSES.includes("DRAFT") &&
    PRM_ASSIGNMENT_STATUSES.includes("IN_REVIEW") &&
    PRM_ASSIGNMENT_STATUSES.includes("APPROVED") &&
    PRM_ASSIGNMENT_STATUSES.includes("INACTIVE") &&
    PRM_ASSIGNMENT_STATUSES.includes("CANCELLED") &&
    PRM_ASSIGNMENT_STATUSES.includes("SUPERSEDED") &&
    !PRM_ASSIGNMENT_STATUSES.includes("REVIEW_REQUIRED"),
  "33 lifecycle statuses preserved",
);
assert(
  submitFn.includes("RPC.submitAssignment") &&
    submitFn.includes("buildSubmitProductRouteFamilyAssignmentArgs") &&
    rpcSrc.includes(submitRpcName),
  "34 submit RPC path preserved",
);
assert(
  approveFn.includes("RPC.approveAssignment") &&
    approveFn.includes("buildApproveProductRouteFamilyAssignmentArgs") &&
    rpcSrc.includes(approveRpcName),
  "35 approve RPC path preserved",
);
const prfa = buildPrmProductRouteFamilyAssignmentApprovalReference({
  familyCode: "DRY_FINE_POWDER_WASH_DRY_POST_BLEND",
  productId: 117,
  approvalDate: "2026-08-14",
});
assert(
  helpersSrc.includes("buildPrmProductRouteFamilyAssignmentApprovalReference") &&
    approveFn.includes("buildPrmProductRouteFamilyAssignmentApprovalReference") &&
    !approveFn.includes("buildPrmMappingApprovalReferenceTemplate") &&
    !approveFn.includes('replace(/^PRM-MAP-/'),
  "36 dedicated PRFA approval helper",
);
assert(
  prfa.ok &&
    prfa.reference.includes("DRY_FINE_POWDER_WASH_DRY_POST_BLEND") &&
    PRM_PRODUCT_ROUTE_FAMILY_ASSIGNMENT_APPROVAL_REFERENCE_RE.test(
      prfa.reference,
    ),
  "37 approval ref contains FAMILY CODE",
);
assert(
  prfa.ok && prfa.reference.includes("-P117-") && prfa.productId === 117,
  "38 approval ref contains PRODUCT ID",
);
assert(
  !prfa.reference.includes("-PG") &&
    !prfaBuilderFn.includes("product_group_id") &&
    !validatePrmProductRouteFamilyAssignmentApprovalReference(
      "PRM-PRFA-DRY_FINE_POWDER_WASH_DRY_POST_BLEND-PG117-APP-20260814",
      {
        familyCode: "DRY_FINE_POWDER_WASH_DRY_POST_BLEND",
        productId: 117,
        approvalDate: "2026-08-14",
      },
    ).ok,
  "39 approval ref does NOT use Product Group id",
);
assert(
  prfa.reference ===
    "PRM-PRFA-DRY_FINE_POWDER_WASH_DRY_POST_BLEND-P117-APP-20260814" &&
    prfaBuilderFn.includes("getPrmLocalIsoDate") &&
    approveFn.includes("approvalDate: getPrmLocalIsoDate()") &&
    !approveFn.includes("approvalDate: getAsOfDate(") &&
    !prfaBuilderFn.includes("effective_from"),
  "40 approval ref date uses approval event date",
);
assert(
  approveFn.includes('id: "prmApproveAssignRef"') &&
    approveFn.includes("readonly: true") &&
    approveFn.includes("refInput.readOnly = true"),
  "41 approval reference readonly",
);
assert(
  approveFn.includes("const recomputed =") &&
    approveFn.includes("validatePrmProductRouteFamilyAssignmentApprovalReference") &&
    approveFn.indexOf("recomputed") <
      approveFn.indexOf("RPC.approveAssignment"),
  "42 approval reference recomputed pre-RPC",
);
assert(
  approveFn.includes('id: "prmApproveAssignEffective"') &&
    approveFn.includes("type: \"date\"") &&
    approveFn.includes("effective_from:") &&
    approveFn.includes("Business applicability date"),
  "43 effective_from remains independent",
);
assert(
  cancelFn.includes("RPC.cancelAssignment") &&
    inactivateFn.includes("RPC.inactivateAssignment"),
  "44 cancel/inactivate existing semantics preserved",
);
assert(
  !createFn.includes("Vyoshadi") &&
    !createSuccessSlice.includes("144") &&
    resolvePrmProductRouteFamilyAssignmentApprovalIdentity({
      familyCode: "DRY_FINE_POWDER_WASH_DRY_POST_BLEND",
      productId: 117,
    }).ok === true,
  "45 Product 144 fixture remains unassigned",
);
assert(
  !thisSrc.includes(["create", "Client"].join("")) &&
    !thisSrc.includes(["execute", "sql"].join("_")) &&
    thisSrc.includes("Mocked transitions only") &&
    thisSrc.includes("Does NOT create"),
  "46 no live Product assignment mutation",
);
assert(
  !createFn.includes(["route", "id: 13"].join("_")) &&
    !createSuccessSlice.includes("validateFamily"),
  "47 no Route 13 mutation",
);
assert(
  !createFn.includes(["Route", "14"].join(" ")) &&
    !createSuccessSlice.includes("route_id: 14"),
  "48 no Route 14",
);
assert(
  !createFn.includes(["openCreate", "SubgroupMapping"].join("")) &&
    !createFn.includes(["openCreate", "GroupMapping"].join("")) &&
    !createFn.includes("mapSubgroup"),
  "49 no mappings",
);
assert(
  !createFn.includes(["apply", "migration"].join("_")) &&
    !mainSrc.includes("supabase/migrations/"),
  "50 no server files",
);
assert(
  approveFn.includes("does not trigger a costing refresh") &&
    !createFn.includes("refreshCosting") &&
    !createFn.includes("Stage 03"),
  "51 no costing refresh",
);
assert(
  /hub-cache-v3(10|11)/.test(swSrc) &&
    !createFn.includes('CACHE_NAME = "hub-cache'),
  "52 SW bump once (gate owns bump after smokes)",
);

assert(
  createFn.includes("data-prm-open-existing-assignment") &&
    createFn.includes("openProductSummary"),
  "writable guard offers open existing assignment",
);
assert(
  createRpcFn.includes("p_product_id") &&
    createRpcFn.includes("p_route_family_id") &&
    createRpcFn.includes("p_effective_from") &&
    createRpcFn.includes("p_assignment_basis") &&
    createRpcFn.includes("p_assignment_note") &&
    createRpcFn.includes(createRpcName) &&
    createArgs.ok &&
    Object.keys(createArgs.params).join(",") ===
      "p_product_id,p_route_family_id,p_effective_from,p_assignment_basis,p_assignment_note",
  "create RPC canonical keys",
);
assert(
  approveFn.includes("Approve Product Route Family Assignment"),
  "approval modal title",
);

const emptyFirstDraft = resolvePrmProductAssignmentCreateEligibility({
  canEdit: true,
  payload: { rows: [], total_count: 0 },
});
assert(
  emptyFirstDraft.mode === "first_draft" &&
    emptyFirstDraft.canCreate === true &&
    emptyFirstDraft.message.includes("No existing Product assignment") &&
    !emptyFirstDraft.message.includes("Unable to load") &&
    eligibilityFn.includes('mode: "first_draft"'),
  "A zero-row payload is first_draft without row CREATE lifecycle",
);
assert(
  emptyFirstDraft.canCreate === true &&
    createFn.includes("syncCreateSubmitEnabled") &&
    createFn.includes("eligibilityReady") &&
    createFn.includes("eligibilityLoading"),
  "A Create enables after first_draft + required fields (gated)",
);
assert(
  draftGuard.mode === "writable_draft" && draftGuard.canCreate === false,
  "B DRAFT exists blocks create",
);
assert(
  reviewGuard.mode === "writable_in_review" && reviewGuard.canCreate === false,
  "C IN_REVIEW exists blocks create",
);
assert(
  approvedWarn.mode === "approved_replacement" &&
    approvedWarn.canCreate === true,
  "D APPROVED exists allows replacement per contract",
);
assert(
  evaluateEligFn.includes("errorDetail") &&
    evaluateEligFn.includes(
      "Unable to load Product Route Family assignments.",
    ) &&
    createFn.includes("eligibilityErrorDetail") &&
    createFn.includes("load_failed"),
  "E failed scoped read preserves generic Unable to load + safe detail",
);
assert(
  emptyFirstDraft.mode === "first_draft" &&
    emptyFirstDraft.canCreate === true &&
    emptyFirstDraft.mode !== "load_failed",
  "F empty rows is not RPC error",
);
assert(
  quietEligFn.includes("buildProductAssignmentsRpcArgs") &&
    quietEligFn.includes("product_id: pid") &&
    quietEligFn.includes("limit: 100") &&
    quietEligFn.includes("offset: 0") &&
    quietEligFn.includes("RPC.productAssignments") &&
    quietEligFn.includes("normalizePrmProductAssignmentsPayload") &&
    evaluateEligFn.includes("loadProductScopedAssignmentsForEligibility"),
  "G quiet eligibility read uses canonical RPC arg builder",
);
assert(
  !quietEligFn.includes("paintError") &&
    !quietEligFn.includes("invoke(") &&
    quietEligFn.includes("costingRpc(") &&
    !evaluateEligFn.includes("paintError"),
  "H quiet read does not paint register error",
);
assert(
  !thisSrc.includes(["create", "Client"].join("")) &&
    !createFn.includes("product_id: 117") &&
    thisSrc.includes("Does NOT assign Product 144 / Product 117"),
  "I no live Product 117 create",
);
assert(
  !createFn.includes(productRouteCreateRpc) &&
    !quietEligFn.includes(productRouteCreateRpc),
  "J no Product Route",
);
assert(
  !createFn.includes("mapSubgroup") && !quietEligFn.includes("mapSubgroup"),
  "K no mappings",
);
assert(
  !createFn.includes(["apply", "migration"].join("_")) &&
    !mainSrc.includes("supabase/migrations/"),
  "L no server files",
);
assert(
  !createFn.includes("refreshCosting") &&
    !quietEligFn.includes("refreshCosting"),
  "M no costing refresh",
);

if (failed) {
  console.error(
    `production-route-product-assignment-create-smoke: ${failed} failure(s)`,
  );
  process.exit(1);
}
console.log("production-route-product-assignment-create-smoke: all assertions passed");
