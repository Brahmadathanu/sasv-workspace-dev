/**
 * Production Route Manager — Manufacturing Route Family helper smoke.
 */
import {
  OBSOLETE_PRM_LENS_IDS,
  OBSOLETE_PRM_RPC_NAMES,
  PRODUCTION_ROUTE_DEFAULT_LENS,
  PRODUCTION_ROUTE_LENS_IDS,
  PRODUCTION_ROUTE_RPC_NAMES,
  PRM_ACTIVE_ROW_CLASS,
  PRM_APPROVAL_REFERENCE_HELPER_TEXT,
  PRM_COST_CENTRE_SETUP_CHIP,
  PRM_COST_CENTRE_LOADING_CHIP,
  PRM_COST_CENTRE_UNAVAILABLE_CHIP,
  PRM_COST_CENTRE_SETUP_TOOLTIP,
  PRM_EMPTY_STATES,
  PRM_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
  PRM_FAMILY_FIELD_HELPERS,
  PRM_MAPPING_BASIS_VALUES,
  PRM_READINESS_STATUSES,
  buildFamilyRouteEditorNavParams,
  buildPrmFamilyApprovalReferenceTemplate,
  buildPrmFamilyRouteApprovalReferenceTemplate,
  buildPrmProductRouteApprovalReference,
  buildPrmProductRouteFamilyAssignmentApprovalReference,
  parsePrmProductRouteApprovalReference,
  resolvePrmProductRouteApprovalIdentity,
  resolvePrmProductAssignmentCreateEligibility,
  resolvePrmProductRouteFamilyAssignmentApprovalIdentity,
  validatePrmProductRouteApprovalReference,
  validatePrmProductRouteFamilyAssignmentApprovalReference,
  PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT,
  PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_RE,
  PRM_PRODUCT_ROUTE_FAMILY_ASSIGNMENT_APPROVAL_REFERENCE_RE,
  buildPrmFamilyRouteValidationSummary,
  formatPrmHierarchyLabel,
  formatPrmRouteStepLabel,
  buildPrmFocusRestoreOptions,
  buildPrmMappingApprovalReferenceTemplate,
  buildPrmAssignmentBasisOptionsHtml,
  buildPrmProductAssignmentsArgs,
  assignmentLifecycleIncludes,
  extractCandidateRouteFamilyId,
  formatPrmAssignmentStatusLabel,
  isMeaningfulPrmCancellationReason,
  normalizePrmAssignmentLifecycleActions,
  normalizePrmProductAssignmentRow,
  normalizePrmProductAssignmentsPayload,
  PRM_ASSIGNMENT_BASIS_OPTIONS,
  resolvePrmAssignmentUiActions,
  selectPrmPrimaryAssignmentFilterStatuses,
  formatPrmAssignmentReferenceSummary,
  hasPrmAssignmentOverlap,
  buildPrmAssignmentProductHandoff,
  buildPrmWorkloadPreviewArgs,
  buildPrmWorkloadDetailArgs,
  buildPrmWorkloadManagementExplainArgs,
  buildPrmWorkloadProductHandoff,
  formatPrmDlScopeSummary,
  formatPrmPohScopeSummary,
  formatPrmWorkloadBatchBasis,
  formatPrmWorkloadBatchBasisTitle,
  formatPrmWorkloadMonthlyQuantity,
  formatPrmWorkloadProductInline,
  formatPrmWorkloadRawDisplay,
  formatPrmWorkloadSummaryLine,
  normalizePrmWorkloadPreviewPayload,
  normalizePrmWorkloadPreviewRow,
  normalizePrmWorkloadDetailPayload,
  PRM_WORKLOAD_ANALYTICAL_RPC_NAME,
  PRM_WORKLOAD_BATCH_LABELS,
  PRM_WORKLOAD_POLICY_DISCLAIMER,
  selectPrmPrimaryWorkloadFilterStatuses,
  selectPrmSecondaryWorkloadFilterStatuses,
  PRM_ASSIGNMENT_STATUSES,
  buildPrmMasterOptionsArgs,
  buildPrmProductGroupMappingOptions,
  buildPrmExactRunReadinessArgs,
  buildPrmReadinessArgs,
  buildPostExtractionEvidenceGapNotice,
  formatPrmExactRunContextCue,
  formatPrmRouteValidationSummary,
  getPrmRouteValidationTone,
  listPrmRouteValidationErrors,
  normalizePrmStatusCounts,
  selectPrmPrimaryReadinessFilterStatuses,
  sumPrmStatusCounts,
  clearPrmActiveRowClass,
  createPrmModalStack,
  formatPrmCommercialHierarchyLabel,
  formatPrmProductGroupHierarchyLabel,
  formatPrmReadinessLabel,
  formatPrmStepSourceLabel,
  getApplicableProductRouteActions,
  getApplicableRouteFamilyActions,
  getPrmReadinessTone,
  getRouteFamilyNextActionLabel,
  getRouteFamilyWorkflowSteps,
  selectPrmReadinessColumns,
  isCanonicalFamilyRouteEditorNav,
  isMeaningfulPrmApprovalReference,
  isObsoletePrmLens,
  isObsoletePrmRpcName,
  isPlaceholderPrmApprovalReference,
  isPrmPendingMappingStatus,
  isProductionRouteLens,
  normalizePrmIntegerIdArray,
  normalizePrmMappingBasis,
  normalizePrmRouteFamilyMapping,
  readPrmMapProductGroupFormValues,
  resolveDefaultPrmMappingBasis,
  resolveFamilyRouteCreateNavigation,
  resolvePrmFamilyRouteEditorLoadId,
  resolvePrmFamilyRouteEditorRouteId,
  shouldApplyPrmFamilyRouteEmptyContextRefresh,
  shouldAcceptPrmFamilyRouteDetailGeneration,
  shouldAcceptPrmPaintGeneration,
  shouldApplyPrmLensTransitionTeardown,
  applyPrmAcceptedPaint,
  applyPrmTableWrapVisible,
  resolvePrmFamilyRouteLifecycleActions,
  resolveProductionRouteLens,
  shouldRestorePrmModalLayer,
  shouldShowPrmRowFocusRing,
  sortPrmFamilyRouteSteps,
  summarizePrmCostCentreSetup,
  resolvePrmCostCentreSetupChip,
  isPrmMasterOptionsReady,
  resolvePrmMasterOptionsRequestScope,
  shouldAcceptPrmMasterOptionsGeneration,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  buildApproveRouteFamilyArgs,
  buildApproveRouteFamilyMappingArgs,
  buildMapProductGroupToRouteFamilyArgs,
  buildPreviewRouteFamilyRouteStepsArgs,
  buildUpdateRouteFamilyMappingDraftArgs,
  extractCreatedFamilyRouteId,
  normalizePreviewRouteFamilyRouteSteps,
} from "../public/shared/js/costing-suite-production-route-rpc.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let failed = 0;
function assert(condition, message) {
  if (condition) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mainSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-production-route.js"),
  "utf8",
);
const htmlSrc = readFileSync(
  join(root, "public/shared/production-route-manager.html"),
  "utf8",
);

assert(PRODUCTION_ROUTE_RPC_NAMES.length === 62, "exactly 62 RPCs");
assert(
  new Set(PRODUCTION_ROUTE_RPC_NAMES).size === 62,
  "RPC inventory has unique names",
);
assert(
  PRODUCTION_ROUTE_RPC_NAMES.includes(
    "rpc_get_production_route_manager_product_assignments",
  ) &&
    PRODUCTION_ROUTE_RPC_NAMES.includes(
      "rpc_cancel_product_route_family_assignment",
    ),
  "assignment read and cancel RPCs inventoried",
);
assert(
  PRODUCTION_ROUTE_RPC_NAMES.includes(
    "rpc_get_production_route_manager_workload_preview",
  ) &&
    PRODUCTION_ROUTE_RPC_NAMES.includes(
      "rpc_get_production_route_manager_workload_detail",
    ) &&
    PRODUCTION_ROUTE_RPC_NAMES.includes(
      "rpc_get_route_workload_management_explain",
    ),
  "workload preview, detail, and management explain RPCs inventoried",
);
assert(
  PRODUCTION_ROUTE_RPC_NAMES.includes(
    "rpc_get_production_route_manager_exact_run_readiness",
  ) &&
    PRODUCTION_ROUTE_RPC_NAMES.includes(
      "rpc_get_production_route_manager_readiness",
    ),
  "exact-run and general readiness RPCs both inventoried",
);
assert(
  OBSOLETE_PRM_RPC_NAMES.every(
    (name) =>
      isObsoletePrmRpcName(name) && !PRODUCTION_ROUTE_RPC_NAMES.includes(name),
  ),
  "obsolete RPC reject-list has zero live coexistence",
);
assert(
  PRODUCTION_ROUTE_LENS_IDS.length === 13 &&
    PRODUCTION_ROUTE_LENS_IDS.every(isProductionRouteLens) &&
    PRODUCTION_ROUTE_LENS_IDS[0] === "route-readiness" &&
    PRODUCTION_ROUTE_LENS_IDS[1] === "product-route-assignments" &&
    PRODUCTION_ROUTE_LENS_IDS[2] === "product-subgroup-mappings" &&
    PRODUCTION_ROUTE_LENS_IDS[3] === "shared-workload-preview" &&
    PRODUCTION_ROUTE_LENS_IDS.includes("archived-routes"),
  "exactly thirteen live PRM lenses with Subgroup Mappings and Archived Routes",
);
assert(
  PRODUCTION_ROUTE_LENS_IDS.includes("route-families") &&
    PRODUCTION_ROUTE_LENS_IDS.includes("route-family-mapping-review") &&
    PRODUCTION_ROUTE_LENS_IDS.includes("route-family-foundation-review") &&
    PRODUCTION_ROUTE_LENS_IDS.includes("production-cost-centres") &&
    PRODUCTION_ROUTE_LENS_IDS.indexOf("route-family-foundation-review") ===
      PRODUCTION_ROUTE_LENS_IDS.indexOf("route-family-mapping-review") + 1 &&
    PRODUCTION_ROUTE_LENS_IDS.indexOf("production-cost-centres") ===
      PRODUCTION_ROUTE_LENS_IDS.indexOf("route-family-foundation-review") + 1 &&
    PRODUCTION_ROUTE_LENS_IDS.includes("route-family-route-editor") &&
    !PRODUCTION_ROUTE_LENS_IDS.some((id) => isObsoletePrmLens(id)),
  "Route Family lenses replace obsolete Product Group lenses",
);

assert(
  PRM_READINESS_STATUSES.includes("READY") &&
    PRM_READINESS_STATUSES.includes("REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER") &&
    PRM_READINESS_STATUSES.includes("BLOCKED_NO_VALID_EFFECTIVE_ROUTE") &&
    PRM_READINESS_STATUSES.includes("BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE") &&
    PRM_READINESS_STATUSES.includes("BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING") &&
    PRM_READINESS_STATUSES.includes("BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE") &&
    PRM_READINESS_STATUSES.includes("BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE") &&
    PRM_READINESS_STATUSES.includes("BLOCKED_NO_EFFECTIVE_ROUTE_STEPS") &&
    PRM_READINESS_STATUSES.includes("BLOCKED_NO_GOVERNED_MONTHLY_PRODUCT_QUANTITY") &&
    PRM_READINESS_STATUSES.includes("BLOCKED_MONTHLY_QUANTITY_DRIVER") &&
    !PRM_READINESS_STATUSES.includes("Incomplete"),
  "required readiness statuses are distinct (no Incomplete collapse)",
);
assert(
  formatPrmReadinessLabel("READY") === "Ready" &&
    formatPrmReadinessLabel("BLOCKED_NO_VALID_EFFECTIVE_ROUTE") ===
      "No valid effective route" &&
    getPrmReadinessTone("READY") === "ready" &&
    getPrmReadinessTone("REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER") === "review" &&
    getPrmReadinessTone("BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE") === "blocked",
  "distinct blocker labels and readiness tones",
);
assert(
  PRM_EXACT_RUN_CONTEXT.period_start === "2026-07-01" &&
    PRM_EXACT_RUN_CONTEXT.valuation_date === "2026-07-22" &&
    PRM_EXACT_RUN_CONTEXT.refresh_run_id === 80,
  "exact-run context constants preserved",
);
assert(
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.period_start === "2026-08-01" &&
    PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.valuation_date === "2026-08-07" &&
    PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id === 82,
  "Workload Preview dedicated exact-run context is Run 82",
);
assert(
  formatPrmExactRunContextCue(PRM_EXACT_RUN_CONTEXT) ===
    "Run 80 · Jul 2026 · Valued 22 Jul 2026",
  "exact-run cue includes run 80, July 2026, valuation 22 July 2026",
);
assert(
  formatPrmRouteValidationSummary({ valid: true }) === "Valid" &&
    formatPrmRouteValidationSummary({
      valid: false,
      errors: ["NO_APPROVED_ROUTE_FAMILY_MAPPING"],
    }) === "No approved mapping" &&
    formatPrmRouteValidationSummary(null) === "—" &&
    !String(formatPrmRouteValidationSummary({ valid: false, errors: ["X"] })).includes(
      "[object Object]",
    ),
  "route validation summary never renders [Object Object]",
);
assert(
  formatPrmRouteValidationSummary({
    valid: false,
    errors: ["NO_APPROVED_ROUTE_FAMILY_ROUTE"],
  }) === "No approved Family Route" &&
    formatPrmRouteValidationSummary({
      valid: false,
      errors: ["BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE"],
    }) === "Product route incomplete",
  "route validation summary maps known error codes",
);
assert(
  getPrmRouteValidationTone("Valid") === "ok" &&
    getPrmRouteValidationTone("No approved mapping") === "blocked",
  "route validation tone supports compact badges",
);

const readinessCols = selectPrmReadinessColumns([
  {
    product_name: "A",
    product_id: 1,
    readiness_status: "READY",
    preferred_batch_size: 50,
  },
]);
assert(
  readinessCols.some((c) => c.key === "preferred_batch_size") &&
    readinessCols.every((c) => c.key !== "assignment_source"),
  "readiness columns omit fields absent from page rows",
);

const viewActions = getApplicableProductRouteActions({
  readiness_status: "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING",
  product_id: 1,
  product_group_id: 2,
});
assert(
  !viewActions.some((a) => a.id === "create-assignment-draft") &&
    viewActions.some(
      (a) =>
        a.id === "preferred-batch-size" &&
        a.navigateHandoff === true &&
        a.serverContractRequired !== true &&
        a.mutation === false &&
        String(a.href || "").includes("supply-batch-plan.html"),
    ),
  "assignment create moved to product detail section; preferred batch-size navigates to Supply Batch Plan",
);

const assignmentArgs = buildPrmProductAssignmentsArgs({
  product_id: 618,
  limit: 100,
  offset: 0,
});
assert(
  assignmentArgs.ok &&
    assignmentArgs.params.p_product_id === 618 &&
    assignmentArgs.params.p_limit === 100 &&
    assignmentArgs.params.p_offset === 0 &&
    !("p_status" in assignmentArgs.params),
  "product-scoped assignment read uses p_product_id with null status omitted",
);
const companyWideArgs = buildPrmProductAssignmentsArgs({
  status: "APPROVED",
  search: "ashwa",
  route_family_id: 4,
  product_group_id: 12,
  limit: 25,
  offset: 50,
});
assert(
  companyWideArgs.ok &&
    !("p_product_id" in companyWideArgs.params) &&
    companyWideArgs.params.p_status === "APPROVED" &&
    companyWideArgs.params.p_search === "ashwa" &&
    companyWideArgs.params.p_route_family_id === 4 &&
    companyWideArgs.params.p_product_group_id === 12 &&
    companyWideArgs.params.p_limit === 25 &&
    companyWideArgs.params.p_offset === 50,
  "company-wide assignment builder omits p_product_id and maps filters",
);
assert(
  buildPrmProductAssignmentsArgs({}).ok &&
    !("p_product_id" in buildPrmProductAssignmentsArgs({}).params),
  "assignment builder succeeds without product_id",
);
assert(
  PRM_ASSIGNMENT_STATUSES.length === 6 &&
    selectPrmPrimaryAssignmentFilterStatuses({
      APPROVED: 49,
      DRAFT: 0,
      IN_REVIEW: 0,
    }).join(",") === "APPROVED" &&
    selectPrmPrimaryAssignmentFilterStatuses({
      APPROVED: 49,
      DRAFT: 0,
    }).every((code) => Number({ APPROVED: 49, DRAFT: 0 }[code]) > 0),
  "primary assignment chips use nonzero counts; zero-count statuses stay in More",
);
assert(
  hasPrmAssignmentOverlap({ conflict: true }) &&
    !hasPrmAssignmentOverlap(null) &&
    formatPrmAssignmentReferenceSummary({
      status: "APPROVED",
      approval_reference: "PRM-REF-1",
    }) === "PRM-REF-1" &&
    formatPrmAssignmentReferenceSummary({
      status: "CANCELLED",
      cancellation_reason: "Wrong family",
    }) === "Wrong family" &&
    buildPrmAssignmentProductHandoff({
      product_id: 9,
      product_name: "X",
      assignment_id: 1,
    }).product_id === 9,
  "assignment table helpers avoid raw objects and support handoff",
);
assert(
  PRM_ASSIGNMENT_BASIS_OPTIONS.length === 2 &&
    PRM_ASSIGNMENT_BASIS_OPTIONS.every((o) => o.value !== "MIGRATED") &&
    buildPrmAssignmentBasisOptionsHtml("MANUAL").includes('value="MANUAL" selected') &&
    !buildPrmAssignmentBasisOptionsHtml("MANUAL").includes('value="MIGRATED"'),
  "assignment basis select defaults MANUAL and excludes MIGRATED",
);
const lifecyclePayload = normalizePrmProductAssignmentsPayload({
  rows: [
    {
      assignment_id: 9,
      status: "DRAFT",
      lifecycle_actions: ["SUBMIT_FOR_REVIEW", "CANCEL"],
    },
  ],
  lifecycle_actions: ["CREATE_ASSIGNMENT_DRAFT"],
});
assert(
  lifecyclePayload.rows[0].lifecycle_actions.includes("SUBMIT_FOR_REVIEW") &&
    lifecyclePayload.lifecycle_actions.includes("CREATE_ASSIGNMENT_DRAFT") &&
    resolvePrmAssignmentUiActions(lifecyclePayload.rows[0], {
      canEdit: false,
    }).length === 0 &&
    resolvePrmAssignmentUiActions(lifecyclePayload.rows[0], {
      canEdit: true,
    }).includes("SUBMIT_FOR_REVIEW"),
  "lifecycle actions come from server response; view-only hides mutations",
);
assert(
  assignmentLifecycleIncludes(["APPROVE"], "APPROVE") &&
    !assignmentLifecycleIncludes(["SUBMIT_FOR_REVIEW"], "APPROVE") &&
    formatPrmAssignmentStatusLabel("IN_REVIEW") === "In review" &&
    isMeaningfulPrmCancellationReason("Wrong family selected") &&
    !isMeaningfulPrmCancellationReason("N/A"),
  "assignment lifecycle helpers and cancellation reason validation",
);
const prfaRef = buildPrmProductRouteFamilyAssignmentApprovalReference({
  familyCode: "DRY_FINE_POWDER_WASH_DRY_POST_BLEND",
  productId: 117,
  approvalDate: "2026-08-14",
});
assert(
  prfaRef.ok &&
    prfaRef.reference ===
      "PRM-PRFA-DRY_FINE_POWDER_WASH_DRY_POST_BLEND-P117-APP-20260814" &&
    PRM_PRODUCT_ROUTE_FAMILY_ASSIGNMENT_APPROVAL_REFERENCE_RE.test(
      prfaRef.reference,
    ) &&
    validatePrmProductRouteFamilyAssignmentApprovalReference(prfaRef.reference, {
      familyCode: "DRY_FINE_POWDER_WASH_DRY_POST_BLEND",
      productId: 117,
      approvalDate: "2026-08-14",
    }).ok &&
    resolvePrmProductRouteFamilyAssignmentApprovalIdentity({
      familyCode: "DRY_FINE_POWDER_WASH_DRY_POST_BLEND",
      productId: 117,
    }).ok,
  "PRFA approval reference uses family code + product id + approval-event date",
);
assert(
  resolvePrmProductAssignmentCreateEligibility({
    canEdit: true,
    payload: {
      rows: [{ assignment_id: 1, status: "DRAFT" }],
      lifecycle_actions: ["CREATE_ASSIGNMENT_DRAFT"],
    },
  }).canCreate === false &&
    resolvePrmProductAssignmentCreateEligibility({
      canEdit: true,
      payload: {
        rows: [{ assignment_id: 2, status: "APPROVED" }],
        lifecycle_actions: ["CREATE_ASSIGNMENT_DRAFT"],
      },
    }).mode === "approved_replacement",
  "product assignment create eligibility blocks writable and warns on approved",
);
const firstDraftElig = resolvePrmProductAssignmentCreateEligibility({
  canEdit: true,
  payload: { rows: [], total_count: 0, lifecycle_actions: [] },
});
assert(
  firstDraftElig.mode === "first_draft" &&
    firstDraftElig.canCreate === true &&
    firstDraftElig.message.includes("No existing Product assignment") &&
    resolvePrmProductAssignmentCreateEligibility({
      canEdit: true,
      payload: {
        rows: [],
        total_count: 0,
        lifecycle_actions: ["VIEW_ONLY"],
      },
    }).canCreate === false,
  "zero-row product assignment eligibility is first_draft without row CREATE action",
);
assert(
  extractCandidateRouteFamilyId({ route_family_id: 4 }) === 4 &&
    extractCandidateRouteFamilyId({ summary: { route_family_id: 7 } }) === 7 &&
    extractCandidateRouteFamilyId({ product_group_name: "Kashayam" }) == null,
  "candidate route family prefill uses server fields only",
);
assert(
  mainSrc.includes("Product Route Family Assignment") &&
    mainSrc.includes("data-prm-assignment-host") &&
    mainSrc.includes("buildPrmAssignmentBasisOptionsHtml") &&
    mainSrc.includes("openSubmitAssignmentModal") &&
    mainSrc.includes("openApproveAssignmentModal") &&
    mainSrc.includes("openCancelAssignmentModal") &&
    mainSrc.includes("openInactivateAssignmentModal") &&
    mainSrc.includes("data-prm-use-candidate-in-draft") &&
    mainSrc.includes("Draft definition is read-only") &&
    mainSrc.includes('active === "product-route-assignments"') &&
    mainSrc.includes("renderAssignments") &&
    mainSrc.includes("ASSIGNMENT_REGISTER") &&
    mainSrc.includes("EXACT_RUN_READINESS") &&
    mainSrc.includes("focusAssignmentId") &&
    mainSrc.includes("assignmentGeneration") &&
    mainSrc.includes("Assignment lifecycle register") &&
    mainSrc.includes('active === "shared-workload-preview"') &&
    mainSrc.includes("renderWorkloadPreview") &&
    mainSrc.includes("loadWorkloadPreview") &&
    mainSrc.includes("WORKLOAD_PREVIEW") &&
    mainSrc.includes("workloadGeneration") &&
    mainSrc.includes("workloadDetailGeneration") &&
    mainSrc.includes("PRM_WORKLOAD_BATCH_LABELS") &&
    mainSrc.includes("Raw Batch Requirement") &&
    PRM_WORKLOAD_BATCH_LABELS.rounded === "Rounded standard batches" &&
    mainSrc.includes("data-prm-workload-host") &&
    mainSrc.includes("fillProductSummaryWorkloadHost") &&
    !mainSrc.includes("rpc_preview_shared_standard_batch_route_foundation") &&
    !mainSrc.includes("Edit Draft") &&
    !mainSrc.includes("edit-assignment-draft") &&
    !mainSrc.includes("data-prm-assignment-approve-inline"),
  "product assignment section + Workload Preview lens wired without analytical list RPC",
);
assert(
  mainSrc.includes("assignmentFocusProductId") &&
    /deepLink\.product_id[\s\S]{0,220}assignmentFocusProductId/.test(mainSrc) &&
    /product_id:\s*focusProductId/.test(mainSrc) &&
    mainSrc.includes(
      "No route assignment is currently available for the focused Product.",
    ) &&
    mainSrc.includes("Focused Product") &&
    /clearAssignmentFilters[\s\S]{0,400}assignmentFocusProductId\s*=\s*null/.test(
      mainSrc,
    ) &&
    /clearAssignmentFilters[\s\S]{0,500}delete nextDeepLink\.product_id/.test(
      mainSrc,
    ) &&
    !/load\([\s\S]{0,80}product-route-assignments[\s\S]{0,800}openProductSummary\(/.test(
      mainSrc,
    ),
  "assignments deep-link product focus: RPC args, cue, empty message, clear, no auto modal",
);
assert(
  /\/\/ Company-wide when no remediation focus[\s\S]{0,80}product_id:\s*focusProductId/.test(
    mainSrc,
  ) ||
    /focusProductId == null[\s\S]{0,200}product_id:\s*focusProductId/.test(
      mainSrc,
    ),
  "company-wide assignments still omit p_product_id when focusProductId is null",
);

const workloadListArgs = buildPrmWorkloadPreviewArgs({
  period_start: "2026-08-01",
  valuation_date: "2026-08-07",
  refresh_run_id: 82,
  search: "oil",
  foundation_status: "READY",
  quantity_driver_status: "ACTUAL",
  route_family_id: 4,
  product_group_id: 12,
  product_id: 618,
  dl_scope_filter: "HAS_DL",
  poh_scope_filter: "HAS_POH",
  limit: 25,
  offset: 50,
});
assert(
  workloadListArgs.ok &&
    JSON.stringify(Object.keys(workloadListArgs.params).sort()) ===
      JSON.stringify(
        [
          "p_dl_scope_filter",
          "p_foundation_status",
          "p_limit",
          "p_offset",
          "p_period_start",
          "p_poh_scope_filter",
          "p_product_group_id",
          "p_product_id",
          "p_quantity_driver_status",
          "p_refresh_run_id",
          "p_route_family_id",
          "p_search",
          "p_valuation_date",
        ].sort(),
      ) &&
    workloadListArgs.params.p_period_start === "2026-08-01" &&
    workloadListArgs.params.p_valuation_date === "2026-08-07" &&
    workloadListArgs.params.p_refresh_run_id === 82 &&
    workloadListArgs.params.p_limit === 25 &&
    workloadListArgs.params.p_offset === 50,
  "workload preview list uses exact allowlist + fixed run-82 context + pagination",
);
assert(
  !buildPrmWorkloadPreviewArgs({
    period_start: null,
    valuation_date: "2026-08-07",
    refresh_run_id: 82,
  }).ok,
  "workload preview rejects missing period_start (no today fallback)",
);
const workloadDetailArgs = buildPrmWorkloadDetailArgs({
  period_start: "2026-08-01",
  valuation_date: "2026-08-07",
  refresh_run_id: 82,
  product_id: 618,
});
assert(
  workloadDetailArgs.ok &&
    JSON.stringify(Object.keys(workloadDetailArgs.params).sort()) ===
      JSON.stringify(
        [
          "p_period_start",
          "p_product_id",
          "p_refresh_run_id",
          "p_valuation_date",
        ].sort(),
      ) &&
    workloadDetailArgs.params.p_product_id === 618,
  "workload detail uses exact allowlist and requires product_id",
);
assert(
  !buildPrmWorkloadDetailArgs({
    period_start: "2026-08-01",
    valuation_date: "2026-08-07",
    refresh_run_id: 82,
  }).ok,
  "workload detail rejects missing product_id",
);
const workloadExplainArgs = buildPrmWorkloadManagementExplainArgs({
  period_start: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.period_start,
  valuation_date: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.valuation_date,
  refresh_run_id: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id,
  product_id: 149,
});
assert(
  workloadExplainArgs.ok &&
    Object.keys(workloadExplainArgs.params).length === 4 &&
    workloadExplainArgs.params.p_refresh_run_id === 82 &&
    workloadExplainArgs.params.p_product_id === 149,
  "workload management explain uses exact four args with Run 82 context",
);
assert(
  PRM_WORKLOAD_ANALYTICAL_RPC_NAME ===
    "rpc_preview_shared_standard_batch_route_foundation" &&
    !PRODUCTION_ROUTE_RPC_NAMES.includes(PRM_WORKLOAD_ANALYTICAL_RPC_NAME),
  "full analytical foundation RPC is not in browser inventory",
);
assert(
  PRM_WORKLOAD_BATCH_LABELS.raw === "Raw batch requirement" &&
    PRM_WORKLOAD_BATCH_LABELS.rounded === "Rounded standard batches" &&
    PRM_WORKLOAD_POLICY_DISCLAIMER.some((line) =>
      line.includes("REVIEW_REQUIRED"),
    ) &&
    PRM_WORKLOAD_POLICY_DISCLAIMER.some((line) =>
      line.includes("nonmonetary"),
    ),
  "raw/rounded labels and policy disclaimer present",
);
assert(
  formatPrmDlScopeSummary({
    dl_include_count: 2,
    dl_supervision_count: 1,
    dl_excluded_count: 3,
  }) === "2 Include · 1 Supervision · 3 Excluded" &&
    formatPrmPohScopeSummary({
      poh_include_count: 4,
      poh_passive_count: 0,
      poh_excluded_count: 1,
    }) === "4 Include · 0 Passive · 1 Excluded",
  "DL/POH table summaries are compact and non-JSON",
);
const workloadPayload = normalizePrmWorkloadPreviewPayload({
  rows: [
    {
      product_id: 616,
      product_name: "Karappan Kashayam",
      product_base_uom: "L",
      monthly_product_base_qty: 65.25,
      monthly_driver_status: "READY",
      preferred_batch_size: 150,
      raw_batch_requirement: 0.435,
      standard_batch_count: 1,
      effective_step_count: 8,
      direct_labour_include_step_count: 4,
      direct_labour_supervision_step_count: 1,
      direct_labour_excluded_step_count: 3,
      production_overhead_include_step_count: 4,
      production_overhead_passive_step_count: 1,
      production_overhead_excluded_step_count: 3,
      foundation_status: "READY",
      route_family_name: "Kashayam",
      route_source: "ROUTE_FAMILY",
      product_group_name: "Kashayam",
    },
  ],
  total_count: 495,
  status_counts: { READY: 131 },
  quantity_driver_status_counts: { READY: 100, BLOCKED: 0 },
  summary: {
    recipient_product_count: 495,
    ready_count: 131,
    review_required_count: 15,
    blocked_count: 349,
    total_standard_batch_count: 166,
  },
});
const karappan = workloadPayload.rows[0];
assert(
  karappan.monthly_product_base_qty === 65.25 &&
    karappan.monthly_product_quantity === 65.25 &&
    formatPrmWorkloadMonthlyQuantity(karappan) === "65.25 L" &&
    karappan.preferred_batch_size === 150 &&
    karappan.raw_batch_requirement === 0.435 &&
    karappan.standard_batch_count === 1 &&
    karappan.direct_labour_include_step_count === 4 &&
    karappan.direct_labour_supervision_step_count === 1 &&
    karappan.direct_labour_excluded_step_count === 3 &&
    karappan.production_overhead_include_step_count === 4 &&
    karappan.production_overhead_passive_step_count === 1 &&
    karappan.production_overhead_excluded_step_count === 3 &&
    formatPrmDlScopeSummary(karappan) === "4 Include · 1 Supervision · 3 Excluded" &&
    formatPrmPohScopeSummary(karappan) === "4 Include · 1 Passive · 3 Excluded" &&
    formatPrmWorkloadBatchBasis(karappan).replace(/\u00A0/g, " ") ===
      "Pref 150 L · Raw 0.435 · Rnd 1" &&
    !formatPrmWorkloadBatchBasis(karappan).includes("\n") &&
    formatPrmWorkloadBatchBasisTitle(karappan).includes(
      "Raw batch requirement: 0.435",
    ) &&
    formatPrmWorkloadProductInline(karappan) === "Karappan Kashayam  #616",
  "Karappan-style row maps exact server fields with compact one-line batch basis",
);
assert(
  formatPrmWorkloadRawDisplay(0.435) === "0.435" &&
    formatPrmWorkloadRawDisplay(0.110716666666667) === "0.1107" &&
    formatPrmWorkloadRawDisplay(0) === "0" &&
    formatPrmWorkloadRawDisplay(1) === "1" &&
    formatPrmWorkloadRawDisplay(null) === "—",
  "raw display formatter keeps four meaningful decimals without trailing zeros",
);
assert(
  normalizePrmWorkloadPreviewRow({
    monthly_product_base_qty: 0,
    preferred_batch_size: 0,
    direct_labour_include_step_count: 0,
  }).monthly_product_base_qty === 0 &&
    normalizePrmWorkloadPreviewRow({
      monthly_product_base_qty: 0,
      preferred_batch_size: 0,
      direct_labour_include_step_count: 0,
    }).preferred_batch_size === 0 &&
    normalizePrmWorkloadPreviewRow({
      monthly_product_base_qty: 0,
      preferred_batch_size: 0,
      direct_labour_include_step_count: 0,
    }).direct_labour_include_step_count === 0 &&
    normalizePrmWorkloadPreviewRow({}).monthly_product_base_qty == null &&
    formatPrmDlScopeSummary({}).includes("—"),
  "numeric zero remains zero; null stays unavailable",
);
assert(
  workloadPayload.total_count === 495 &&
    formatPrmWorkloadSummaryLine(workloadPayload.summary).includes("495") &&
    formatPrmWorkloadSummaryLine(workloadPayload.summary).includes("166") &&
    selectPrmPrimaryWorkloadFilterStatuses({ READY: 131, BLOCKED_X: 0 }).join(
      ",",
    ) === "READY" &&
    selectPrmSecondaryWorkloadFilterStatuses(
      { READY: 131, BLOCKED_X: 0 },
      ["READY", "BLOCKED_X"],
    ).join(",") === "BLOCKED_X",
  "workload summary uses server counts; More statuses exclude primary chips",
);
assert(
  normalizePrmWorkloadDetailPayload({
    product_id: 9,
    product_group_name: "Group",
    route_source: "ROUTE_FAMILY",
    effective_step_count: 8,
    steps: [{ sequence_no: 1, activity_id: 2 }],
  }).effective_step_count === 8 &&
    buildPrmWorkloadProductHandoff({ product_id: 9, product_name: "X" })
      .product_id === 9,
  "workload detail retains modal evidence fields + product handoff",
);

const readiness = buildPrmReadinessArgs({
  as_of_date: "2026-08-02",
  search: "ashwa",
  readiness_status: "READY",
  route_family_id: "8",
  product_group_id: "12",
  limit: 25,
  offset: 50,
});
assert(
  JSON.stringify(Object.keys(readiness).sort()) ===
    JSON.stringify(
      [
        "p_as_of_date",
        "p_limit",
        "p_offset",
        "p_product_group_id",
        "p_readiness_status",
        "p_route_family_id",
        "p_search",
      ].sort(),
    ),
  "general readiness emits exact payload keys",
);
assert(
  readiness.p_route_family_id === 8 &&
    readiness.p_product_group_id === 12 &&
    !("p_q" in readiness),
  "general readiness normalizes filters and never emits p_q",
);

const exactRun = buildPrmExactRunReadinessArgs({
  period_start: "2026-07-01",
  valuation_date: "2026-07-22",
  refresh_run_id: 80,
  search: "oil",
  readiness_status: "READY",
  route_family_id: 8,
  product_group_id: 12,
  limit: 25,
  offset: 0,
});
assert(
  exactRun.ok &&
    JSON.stringify(Object.keys(exactRun.params).sort()) ===
      JSON.stringify(
        [
          "p_limit",
          "p_offset",
          "p_period_start",
          "p_product_group_id",
          "p_readiness_status",
          "p_refresh_run_id",
          "p_route_family_id",
          "p_search",
          "p_valuation_date",
        ].sort(),
      ),
  "exact-run readiness emits exact payload keys",
);
assert(
  exactRun.params.p_period_start === "2026-07-01" &&
    exactRun.params.p_valuation_date === "2026-07-22" &&
    exactRun.params.p_refresh_run_id === 80 &&
    !("p_as_of_date" in exactRun.params),
  "exact-run context args fixed; no as_of_date",
);
assert(
  !buildPrmExactRunReadinessArgs({
    period_start: null,
    valuation_date: "2026-07-22",
    refresh_run_id: 80,
  }).ok,
  "exact-run rejects missing period_start (no today fallback)",
);

const statusCounts = normalizePrmStatusCounts({
  READY: 130,
  REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER: 13,
  BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING: 313,
  BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE: 39,
  BLOCKED_NO_VALID_EFFECTIVE_ROUTE: 0,
});
assert(sumPrmStatusCounts(statusCounts) === 495, "status_counts sum is exact-run total");
const primary = selectPrmPrimaryReadinessFilterStatuses(statusCounts);
assert(
  primary.includes("READY") &&
    primary.includes("REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER") &&
    primary.includes("BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING") &&
    primary.includes("BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE") &&
    !primary.includes("BLOCKED_NO_VALID_EFFECTIVE_ROUTE"),
  "primary chips only for populated status_counts",
);
assert(
  selectPrmPrimaryReadinessFilterStatuses({
    ...statusCounts,
    FUTURE_SERVER_STATUS: 2,
  }).includes("FUTURE_SERVER_STATUS"),
  "future server statuses appear automatically when counted",
);
assert(
  mainSrc.includes("rpc_get_production_route_manager_readiness") &&
    mainSrc.includes("buildReadinessRpcArgs") &&
    mainSrc.includes("RPC.generalReadiness") &&
    /await invoke\(\r?\n\s*RPC\.generalReadiness/.test(mainSrc) &&
    /async function loadReadiness[\s\S]*?RPC\.generalReadiness[\s\S]*?buildReadinessRpcArgs/.test(
      mainSrc,
    ) &&
    !/async function loadReadiness[\s\S]*?RPC\.exactRunReadiness/.test(mainSrc) &&
    mainSrc.includes("rpc_get_production_route_manager_exact_run_readiness") &&
    mainSrc.includes("buildExactRunReadinessRpcArgs") &&
    mainSrc.includes("exactRunReadiness:"),
  "Route Readiness uses general readiness RPC; exact-run retained elsewhere",
);
assert(
  mainSrc.includes("status_counts_baseline") &&
    mainSrc.includes("selectPrmPrimaryReadinessFilterStatuses") &&
    mainSrc.includes("exact_run_total") &&
    mainSrc.includes("readinessLoadError") &&
    mainSrc.includes("clearReadinessFilters"),
  "status_counts chips and readiness clear-filters wired",
);
assert(
  mainSrc.includes("formatPrmRouteValidationSummary") &&
    mainSrc.includes("formatPrmExactRunContextCue") &&
    mainSrc.includes("readinessAsOfContextHtml") &&
    mainSrc.includes("syncPrmAsOfDateChrome") &&
    !mainSrc.includes("[Object Object]") &&
    mainSrc.includes('state.activeLens === "route-readiness"') &&
    mainSrc.includes('state.activeLens === "shared-workload-preview"') &&
    mainSrc.includes("cp-prm-asof-disabled") &&
    !mainSrc.includes(
      "Costing Readiness uses fixed exact-run context (Run 80",
    ),
  "route validation formatter and as-of date chrome wired",
);

const options = buildPrmMasterOptionsArgs({
  product_id: "618",
  product_group_id: "12",
  route_family_id: "8",
  as_of_date: "2026-08-02",
});
assert(
  options.ok &&
    JSON.stringify(Object.keys(options.params).sort()) ===
      JSON.stringify(
        [
          "p_as_of_date",
          "p_product_group_id",
          "p_product_id",
          "p_route_family_id",
        ].sort(),
      ),
  "master-options emits exact payload keys",
);

assert(
  JSON.stringify(normalizePrmIntegerIdArray(["3", 2, "2", 0, "x", 7])) ===
    JSON.stringify([3, 2, 7]),
  "Product Group ID arrays normalize, deduplicate, and reject invalid IDs",
);

assert(
  formatPrmCommercialHierarchyLabel({
    category_name: "Ayurveda",
    subcategory_name: "Arishtam",
    product_group_name: "Digestive",
    subgroup_name: "Classical",
    product_name: "Abhayarishtam",
  }) ===
    "Ayurveda › Arishtam › Digestive › Classical › Abhayarishtam",
  "commercial hierarchy label preserves all five levels",
);
assert(
  formatPrmProductGroupHierarchyLabel({
    category_name: "Ayurveda",
    subcategory_name: "Classical",
    product_group_name: "Kashayam – Regular",
    subgroup_name: "ShouldNotAppear",
    product_name: "ShouldNotAppear",
  }) === "Ayurveda › Classical › Kashayam – Regular",
  "mapping selector hierarchy is Category › Subcategory › Product Group",
);
{
  const opts = buildPrmProductGroupMappingOptions([
    {
      product_group_id: "28",
      category_name: "Ayurveda",
      subcategory_name: "Classical",
      product_group_name: "Kashayam – Regular",
    },
    {
      id: 30,
      category_name: "Ayurveda",
      subcategory_name: "Proprietary",
      product_group_name: "Kashayam – Regular",
    },
    { product_group_id: "bad" },
  ]);
  assert(
    opts.length === 2 &&
      opts[0].product_group_id === 28 &&
      opts[0].label === "Ayurveda › Classical › Kashayam – Regular" &&
      opts[1].product_group_id === 30 &&
      opts[1].label === "Ayurveda › Proprietary › Kashayam – Regular",
    "mapping selector renders full hierarchy",
  );
  assert(
    opts[0].product_group_id === 28 &&
      opts[1].product_group_id === 30 &&
      opts.every((o) => typeof o.product_group_id === "number"),
    "selected hierarchy submits the correct numeric Product Group ID",
  );
}
assert(
  formatPrmStepSourceLabel("ROUTE_FAMILY") === "Manufacturing Route Family",
  "Route Family source label is user-facing",
);

assert(
  resolveProductionRouteLens() === PRODUCTION_ROUTE_DEFAULT_LENS,
  "fresh launch resolves to readiness",
);
assert(
  resolveProductionRouteLens("route-family-route-editor") ===
    PRODUCTION_ROUTE_DEFAULT_LENS,
  "malformed family editor deep-link without id still falls back to readiness",
);
assert(
  resolveProductionRouteLens("route-family-route-editor", {
    allowEditorWithoutId: true,
  }) === "route-family-route-editor",
  "intentional no-context family editor entry stays on route-family-route-editor",
);
assert(
  resolveProductionRouteLens("route-family-route-editor", {
    family_route_id: 91,
  }) === "route-family-route-editor",
  "valid family editor deep-link is retained",
);
assert(
  resolveProductionRouteLens("route-family-route-editor", {
    family_route_id: 4,
  }) === "route-family-route-editor",
  "valid Family editor deep link family_route_id 4 does not fall back to Route Readiness",
);
for (const obsoleteLens of OBSOLETE_PRM_LENS_IDS) {
  assert(
    resolveProductionRouteLens(obsoleteLens) === PRODUCTION_ROUTE_DEFAULT_LENS,
    `obsolete lens falls back: ${obsoleteLens}`,
  );
}

assert(
  PRM_COST_CENTRE_SETUP_CHIP === "Cost centres: Setup required",
  "compact setup chip text is exact",
);
assert(
  PRM_COST_CENTRE_SETUP_TOOLTIP.includes(
    "No approved Production cost centres are currently defined",
  ) &&
    PRM_COST_CENTRE_SETUP_TOOLTIP.includes(
      "Route Families, Product Group mappings and route-header drafts can still be prepared",
    ),
  "cost-centre tooltip explains proceed vs blocked",
);
{
  const summary = summarizePrmCostCentreSetup({ cost_centres: [] });
  assert(
    summary.defined === 0 &&
      summary.approved === 0 &&
      summary.setupRequired === true &&
      summary.chip === PRM_COST_CENTRE_SETUP_CHIP,
    "cost-centre summary reports Defined 0 / Approved 0",
  );
}
{
  const centres = [
    { id: 22, code: "A", name: "Shared A", status: "APPROVED", pool_scope: "SHARED_ROUTE", resource_class: "LABOUR" },
    { id: 23, code: "B", name: "Shared B", status: "APPROVED", pool_scope: "SHARED_ROUTE", resource_class: "MACHINE" },
    { id: 24, code: "C", name: "Shared C", status: "APPROVED", pool_scope: "SHARED_ROUTE", resource_class: "UTILITIES" },
    { id: 25, code: "D", name: "Shared D", status: "APPROVED", pool_scope: "SHARED_ROUTE", resource_class: "LABOUR" },
    { id: 26, code: "E", name: "Boundary E", status: "APPROVED", pool_scope: "EXCLUDED_OTHER_POOL", resource_class: "STORE" },
    { id: 27, code: "F", name: "Boundary F", status: "APPROVED", pool_scope: "EXCLUDED_OTHER_POOL", resource_class: "QC" },
    { id: 28, code: "G", name: "Boundary G", status: "APPROVED", pool_scope: "EXCLUDED_OTHER_POOL", resource_class: "PACK" },
  ];
  const positive = summarizePrmCostCentreSetup({ cost_centres: centres });
  assert(
    positive.setupRequired === false &&
      positive.chip === "Cost centres: 7 approved" &&
      positive.shared.length === 4 &&
      positive.excluded.length === 3,
    "seven approved centres produce positive chip with shared/excluded groups",
  );
  assert(
    summarizePrmCostCentreSetup({ cost_centres: [] }).chip ===
      PRM_COST_CENTRE_SETUP_CHIP,
    "zero approved produces Setup required",
  );
}
assert(
  resolvePrmCostCentreSetupChip({
    options: null,
    optionsStatus: "uninitialized",
  }).chip === PRM_COST_CENTRE_LOADING_CHIP &&
    resolvePrmCostCentreSetupChip({
      options: null,
      optionsStatus: "uninitialized",
    }).setupRequired === false,
  "uninitialized options do not produce Setup required",
);
assert(
  resolvePrmCostCentreSetupChip({
    options: null,
    optionsStatus: "loading",
  }).chip === PRM_COST_CENTRE_LOADING_CHIP &&
    resolvePrmCostCentreSetupChip({
      options: { cost_centres: [] },
      optionsStatus: "loading",
    }).setupRequired === false,
  "loading options do not produce Setup required",
);
assert(
  resolvePrmCostCentreSetupChip({
    options: { cost_centres: [] },
    optionsStatus: "ready",
  }).chip === PRM_COST_CENTRE_SETUP_CHIP,
  "ready + empty inventory produces Setup required",
);
assert(
  resolvePrmCostCentreSetupChip({
    options: null,
    optionsStatus: "error",
    optionsError: "timeout",
  }).chip === PRM_COST_CENTRE_UNAVAILABLE_CHIP &&
    resolvePrmCostCentreSetupChip({
      options: { cost_centres: [] },
      optionsStatus: "error",
    }).setupRequired === false,
  "error options produce Unavailable, not Setup required",
);
assert(
  isPrmMasterOptionsReady("ready") === true &&
    isPrmMasterOptionsReady("loading") === false,
  "isPrmMasterOptionsReady gates on ready only",
);
assert(
  resolvePrmMasterOptionsRequestScope(
    { catalogueScope: "unscoped" },
    {
      selectedProductId: 139,
      product_group_id: 7,
      route_family_id: 10,
      deepLink: {
        product_id: 139,
        product_group_id: 7,
        route_family_id: 10,
      },
    },
  ).product_id === null &&
    resolvePrmMasterOptionsRequestScope(
      { catalogueScope: "unscoped" },
      {
        selectedProductId: 139,
        product_group_id: 7,
        route_family_id: 10,
        deepLink: { route_family_id: 10 },
      },
    ).product_group_id === null &&
    resolvePrmMasterOptionsRequestScope(
      { catalogueScope: "unscoped" },
      { route_family_id: 10, deepLink: { route_family_id: 10 } },
    ).route_family_id === null,
  "unscoped master-options catalogue does not inherit leftover IDs",
);
assert(
  shouldAcceptPrmMasterOptionsGeneration(2, 2) === true &&
    shouldAcceptPrmMasterOptionsGeneration(1, 2) === false,
  "only the current master-options generation may commit",
);
assert(
  htmlSrc.includes("cp-prm-setup-chip") &&
    mainSrc.includes('navigate("production-cost-centres")') &&
    mainSrc.includes("data-prm-setup") &&
    !mainSrc.includes("openSetupPopover") &&
    !mainSrc.includes("function openSetupModal"),
  "no large persistent cost-centre warning; compact chip deep-links to Cost Centres lens",
);

assert(
  PRM_MAPPING_BASIS_VALUES.join(",") ===
    "MANUAL,HISTORICAL_REVIEW,MIGRATED",
  "mapping basis permits only three canonical values",
);
assert(
  normalizePrmMappingBasis("—") === null &&
    normalizePrmMappingBasis("") === null &&
    normalizePrmMappingBasis("MANUAL") === "MANUAL" &&
    normalizePrmMappingBasis("historical_review") === "HISTORICAL_REVIEW",
  'placeholder "—" and blank mapping basis rejected',
);
assert(
  resolveDefaultPrmMappingBasis({ fromEvidence: false }) === "MANUAL",
  "manual workflow defaults MANUAL",
);
assert(
  resolveDefaultPrmMappingBasis({ fromEvidence: true }) ===
    "HISTORICAL_REVIEW",
  "evidence workflow defaults HISTORICAL_REVIEW",
);
assert(
  resolveDefaultPrmMappingBasis({ fromEvidence: true }) !== "MIGRATED",
  "MIGRATED is never the default",
);
assert(
  !buildMapProductGroupToRouteFamilyArgs({
    route_family_id: 1,
    product_group_id: 28,
    mapping_basis: "—",
  }).ok &&
    !buildMapProductGroupToRouteFamilyArgs({
      route_family_id: 1,
      product_group_id: 28,
      mapping_basis: "",
    }).ok &&
    buildMapProductGroupToRouteFamilyArgs({
      route_family_id: 1,
      product_group_id: 28,
      mapping_basis: "HISTORICAL_REVIEW",
      mapping_note: "Reviewed Kashayam evidence",
      effective_from: "2026-07-01",
    }).ok,
  "adapter rejects invalid mapping basis and accepts HISTORICAL_REVIEW",
);

assert(
  isPlaceholderPrmApprovalReference("—") &&
    isPlaceholderPrmApprovalReference("-") &&
    isPlaceholderPrmApprovalReference("NA") &&
    isPlaceholderPrmApprovalReference("N/A") &&
    !isMeaningfulPrmApprovalReference("—") &&
    isMeaningfulPrmApprovalReference("PRM-RF-KASHAYAM_REGULAR-APP-20260803"),
  "approval-reference placeholders rejected",
);
assert(
  !buildApproveRouteFamilyArgs({
    route_family_id: 1,
    approval_reference: "—",
  }).ok &&
    !buildApproveRouteFamilyMappingArgs({
      mapping_id: 9,
      approval_reference: "N/A",
    }).ok,
  "adapter rejects placeholder approval references",
);
assert(
  buildPrmFamilyApprovalReferenceTemplate("KASHAYAM_REGULAR", "2026-08-03") ===
    "PRM-RF-KASHAYAM_REGULAR-APP-20260803",
  "family approval reference template generated correctly",
);
assert(
  buildPrmMappingApprovalReferenceTemplate(
    "KASHAYAM_REGULAR",
    28,
    "2026-08-03",
  ) === "PRM-MAP-KASHAYAM_REGULAR-PG28-APP-20260803",
  "mapping approval reference template generated correctly",
);
assert(
  buildPrmFamilyRouteApprovalReferenceTemplate(
    "KASHAYAM_REGULAR",
    "1",
    "2026-08-03",
  ) === "PRM-RFR-KASHAYAM_REGULAR-V1-APP-20260803",
  "family route approval reference template generated correctly",
);
assert(
  buildPrmProductRouteApprovalReference({
    productId: 139,
    routeVersion: 1,
    approvalDate: "2026-08-12",
  }).reference === "PRM-PR-139-V1-APP-20260812",
  "product route approval reference generated canonically",
);
assert(
  !buildPrmProductRouteApprovalReference({
    productId: null,
    routeVersion: 1,
    approvalDate: "2026-08-12",
  }).ok &&
    !buildPrmProductRouteApprovalReference({
      productId: 139,
      routeVersion: null,
      approvalDate: "2026-08-12",
    }).ok,
  "product approval reference requires product id and version",
);
assert(
  validatePrmProductRouteApprovalReference("PRM-PR-139-V1-APP-20260812", {
    productId: 139,
    routeVersion: 1,
    approvalDate: "2026-08-12",
  }).ok &&
    !validatePrmProductRouteApprovalReference(
      "PRM-RFR-FAMILY-V1-APP-20260812",
      { productId: 139, routeVersion: 1, approvalDate: "2026-08-12" },
    ).ok &&
    !validatePrmProductRouteApprovalReference("PRM-PR-47-V1-APP-20260812", {
      productId: 139,
      routeVersion: 1,
      approvalDate: "2026-08-12",
    }).ok,
  "product approval reference identity is validated",
);
assert(
  PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_RE.test("PRM-PR-139-V1-APP-20260812") &&
    parsePrmProductRouteApprovalReference("PRM-PR-139-V1-APP-20260812")
      .productId === 139 &&
    resolvePrmProductRouteApprovalIdentity({
      detail: { product_id: 139, route_version: 1 },
      selectedProductId: 139,
    }).ok &&
    PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT.includes(
      "Product Route identity",
    ),
  "product approval reference helpers parse and resolve identity",
);
assert(
  PRM_APPROVAL_REFERENCE_HELPER_TEXT.includes("suggested reference may be edited"),
  "approval reference helper text present",
);
assert(
  PRM_FAMILY_FIELD_HELPERS.family_code.includes("KASHAYAM_REGULAR") &&
    PRM_FAMILY_FIELD_HELPERS.family_name.includes("Kashayam - Regular"),
  "Route Family creation helper text present",
);

{
  const stack = createPrmModalStack();
  stack.push({ id: "parent" });
  assert(stack.hasPrevious === true && shouldRestorePrmModalLayer(stack.depth), "Escape closes active/nested modal layer");
  assert(stack.pop().id === "parent" && stack.hasPrevious === false, "modal stack pops topmost layer only");
}
{
  const node = {
    classList: {
      removed: false,
      remove(name) {
        if (name === PRM_ACTIVE_ROW_CLASS) this.removed = true;
      },
    },
  };
  const fakeRoot = {
    querySelectorAll() {
      return [node];
    },
  };
  assert(
    clearPrmActiveRowClass(fakeRoot) === 1 && node.classList.removed === true,
    "no stale active-row class after clear",
  );
}
assert(
  mainSrc.includes("handleEscapeKey") &&
    mainSrc.includes("modalReturnFocus") &&
    mainSrc.includes("clearActiveRowHighlight") &&
    mainSrc.includes("withMutation") &&
    mainSrc.includes("mutationInFlight"),
  "Escape closes active modal, restores focus, and duplicate submits blocked",
);
assert(
  mainSrc.includes("attachPrmEscapeCapture") &&
    mainSrc.includes("stopImmediatePropagation") &&
    mainSrc.includes("unbindModalHandlers") &&
    mainSrc.includes("prmOwnsDetailsModal"),
  "details modal Escape closes the actual PRM layer",
);
assert(
  mainSrc.includes("modalParent") &&
    mainSrc.includes("fromStackRestore") &&
    mainSrc.includes('type: "family-summary"'),
  "nested modal returns to summary",
);
assert(
  mainSrc.includes('navigate("production-cost-centres")') &&
    mainSrc.includes("renderSetupChip") &&
    mainSrc.includes("summarizePrmCostCentreSetup") &&
    mainSrc.includes("data-prm-setup"),
  "cost-centre chip deep-links to Cost Centres lens",
);
assert(
  mainSrc.includes("readPrmMapProductGroupFormValues") &&
    mainSrc.includes("openEditPendingMappingModal") &&
    mainSrc.includes("rpc_update_route_family_mapping_draft") &&
    !mainSrc.includes("runStagedCostingRefresh"),
  "mapping create reads live form values and edit pending mapping has no Costing refresh",
);

{
  const openDefaultBasis = resolveDefaultPrmMappingBasis({
    fromEvidence: false,
  });
  assert(openDefaultBasis === "MANUAL", "open-time default remains MANUAL");
  const fakeRoot = (values) => ({
    querySelector(sel) {
      const map = {
        "[data-prm-map-field='product_group_id']": {
          value: String(values.product_group_id),
        },
        "[data-prm-map-field='effective_from']": {
          value: values.effective_from,
        },
        "[data-prm-map-field='mapping_basis']": {
          value: values.mapping_basis,
        },
        "[data-prm-map-field='mapping_note']": {
          value: values.mapping_note,
        },
      };
      return map[sel] || null;
    },
  });
  const changed = readPrmMapProductGroupFormValues(
    fakeRoot({
      product_group_id: 28,
      effective_from: "2026-07-01",
      mapping_basis: "HISTORICAL_REVIEW",
      mapping_note:
        "Mapped following review of historical production evidence for the regular Kashayam manufacturing family.",
    }),
  );
  assert(
    changed.ok &&
      changed.mapping_basis === "HISTORICAL_REVIEW" &&
      changed.mapping_basis !== openDefaultBasis,
    "mapping create submits changed select value",
  );
  assert(
    changed.mapping_note &&
      changed.mapping_note.includes("historical production evidence"),
    "mapping create submits changed note",
  );
  const built = buildMapProductGroupToRouteFamilyArgs({
    route_family_id: 4,
    product_group_id: changed.product_group_id,
    effective_from: changed.effective_from,
    mapping_basis: changed.mapping_basis,
    mapping_note: changed.mapping_note,
  });
  assert(
    built.ok &&
      built.params.p_mapping_basis === "HISTORICAL_REVIEW" &&
      built.params.p_mapping_note.includes("historical production evidence") &&
      built.params.p_product_group_id === 28,
    "outgoing create payload uses changed form-control values",
  );
}

assert(isPrmPendingMappingStatus("DRAFT"), "DRAFT is pending");
assert(isPrmPendingMappingStatus("IN_REVIEW"), "IN_REVIEW is pending");
assert(!isPrmPendingMappingStatus("APPROVED"), "APPROVED is not pending");

{
  const normalized = normalizePrmRouteFamilyMapping({
    id: 7,
    route_family_id: 4,
    product_group_id: 28,
    status: "DRAFT",
    effective_from: "2026-07-01",
    mapping_basis: "MANUAL",
    mapping_note: null,
  });
  assert(
    normalized.id === 7 &&
      normalized.mapping_id === 7 &&
      normalized.route_family_id === 4 &&
      normalized.product_group_id === 28 &&
      normalized.mapping_basis === "MANUAL",
    "mapping row id normalizes correctly",
  );
}

assert(
  buildApproveRouteFamilyMappingArgs({
    mapping_id: 7,
    approval_reference: "PRM-MAP-KASHAYAM_REGULAR-PG28-APP-20260803",
    effective_from: "2026-07-01",
  }).params.p_mapping_id === 7,
  "approve uses selected mapping id 7 directly",
);

assert(
  PRM_EMPTY_STATES.routeFamilies.includes(
    "No Manufacturing Route Families have been created",
  ) &&
    PRM_EMPTY_STATES.routeFamilies.includes("reviewing historical evidence"),
  "empty Family lens explains create and evidence path",
);

{
  const draftActions = getApplicableRouteFamilyActions({
    status: "DRAFT",
    mappings: [],
  });
  assert(
    draftActions.some((a) => a.id === "approve-route-family") &&
      !draftActions.some((a) => a.id === "map-product-group") &&
      draftActions.some((a) => a.id === "family-candidate"),
    "Draft Family shows Approve Family and evidence, not Map",
  );
  const approvedActions = getApplicableRouteFamilyActions({
    status: "APPROVED",
    mappings: [{ id: 7, status: "DRAFT", product_group_id: 28 }],
  });
  assert(
    approvedActions.some((a) => a.id === "map-product-group") &&
      approvedActions.some((a) => a.id === "approve-mapping") &&
      approvedActions.some((a) => a.id === "edit-pending-mapping") &&
      approvedActions.some((a) => a.id === "create-family-route"),
    "Approved Family shows Map, Edit pending, Approve mapping, and route draft",
  );
  assert(
    approvedActions.find((a) => a.id === "approve-mapping")?.mapping_id === 7 &&
      approvedActions.find((a) => a.id === "edit-pending-mapping")
        ?.selectedMapping?.id === 7,
    "selected mapping id is used directly",
  );
  assert(
    approvedActions.every((a) => a.requiresCostCentre !== true),
    "Route Family route-header draft remains available without cost centres",
  );
  assert(
    approvedActions.some((a) => a.id === "edit-pending-mapping") &&
      approvedActions.some((a) => a.id === "approve-mapping"),
    "Edit pending mapping visible for DRAFT and Approve mapping visible for DRAFT",
  );
}

{
  const productActions = getApplicableProductRouteActions({
    readiness_status: "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING",
    product_group_id: 28,
  });
  assert(
    productActions.some((a) => a.id === "assign-route-family") &&
      productActions.find((a) => a.id === "assign-route-family")
        .product_group_id === 28,
    "readiness row with missing mapping exposes Assign to Route Family",
  );
}

{
  const steps = getRouteFamilyWorkflowSteps({
    status: "DRAFT",
    mappings: [],
  });
  assert(
    steps[0].state === "complete" &&
      steps[1].state === "current" &&
      steps[2].state === "pending",
    "workflow marks Family created complete and Family approved current",
  );
}

{
  // Family ID 4 retained production state: APPROVED family, APPROVED mapping,
  // DRAFT family route (no approved complete Family route).
  const family4Steps = getRouteFamilyWorkflowSteps({
    status: "APPROVED",
    mappings: [
      normalizePrmRouteFamilyMapping({
        id: 7,
        mapping_id: 7,
        product_group_id: 28,
        status: "APPROVED",
      }),
    ],
    draft_family_route_id: 4,
    approved_family_route_id: null,
    product_routes_defined: false,
  });
  assert(
    family4Steps.map((s) => s.state).join(",") ===
      "complete,complete,complete,complete,current,pending",
    "Family ID 4 workflow: Complete×4, Family route defined Current, Product routes Pending",
  );
  assert(
    getRouteFamilyNextActionLabel({
      status: "APPROVED",
      mappings: [{ id: 7, status: "APPROVED" }],
      draft_family_route_id: 4,
    }).includes("Complete and approve"),
    "Draft Family route next action completes/approves the route",
  );
}

{
  const mappedOnly = getRouteFamilyWorkflowSteps({
    status: "APPROVED",
    mappings: [{ id: 1, status: "APPROVED" }],
  });
  assert(
    mappedOnly[2].state === "complete" && mappedOnly[3].state === "complete",
    "APPROVED mapping counts as mapped and approved",
  );
  const draftRoute = getRouteFamilyWorkflowSteps({
    status: "APPROVED",
    mappings: [{ id: 1, status: "APPROVED" }],
    draft_family_route_id: 4,
  });
  assert(
    draftRoute[4].state === "current" && draftRoute[4].id === "family_route_defined",
    "Draft route makes Family route step Current",
  );
}

{
  const navParams = buildFamilyRouteEditorNavParams({
    route_family_id: 4,
    family_route_id: 4,
  });
  assert(
    navParams?.family_route_id === 4 &&
      navParams?.route_family_id === 4 &&
      !("product_route_id" in navParams),
    "Family route editor nav params populate family_route_id and omit product_route_id",
  );
  const createNav = resolveFamilyRouteCreateNavigation(
    { family_route_id: extractCreatedFamilyRouteId({ family_route_id: 4 }) },
    4,
  );
  assert(
    createNav?.lens === "route-family-route-editor" &&
      createNav?.params?.family_route_id === 4 &&
      createNav?.product_route_id == null,
    "Family route creation result opens route-family-route-editor with family_route_id",
  );
  assert(
    extractCreatedFamilyRouteId({
      route_family_id: 99,
      family_route_id: 4,
    }) === 4,
    "extractCreatedFamilyRouteId prefers family_route_id over route_family_id",
  );
  assert(
    resolvePrmFamilyRouteEditorLoadId({
      requestDeepLink: {},
      committedDeepLink: { family_route_id: 12, route_family_id: 11 },
    }) === 12 &&
      resolvePrmFamilyRouteEditorLoadId({
        requestDeepLink: { family_route_id: 12 },
        committedDeepLink: {},
      }) === 12 &&
      resolvePrmFamilyRouteEditorLoadId({
        requestDeepLink: {},
        committedDeepLink: { route_family_id: 11 },
      }) == null,
    "family editor load id uses committed family_route_id, not family master id",
  );
  assert(
    shouldApplyPrmFamilyRouteEmptyContextRefresh({
      selectedFamilyRouteId: 12,
      deepLinkFamilyRouteId: 12,
      requestGeneration: 1,
      currentGeneration: 1,
    }) === false &&
      shouldApplyPrmFamilyRouteEmptyContextRefresh({
        selectedFamilyRouteId: null,
        deepLinkFamilyRouteId: null,
        requestGeneration: 1,
        currentGeneration: 1,
      }) === true &&
      shouldApplyPrmFamilyRouteEmptyContextRefresh({
        selectedFamilyRouteId: null,
        deepLinkFamilyRouteId: null,
        requestGeneration: 1,
        currentGeneration: 2,
      }) === false,
    "empty-context refresh is blocked when a Family Route is open or stale",
  );
  assert(
    resolvePrmFamilyRouteEditorRouteId({
      selectedFamilyRouteId: 12,
      deepLink: { family_route_id: 12 },
      detail: { family_route_id: 12 },
    }) === 12 &&
      resolvePrmFamilyRouteEditorRouteId({
        selectedFamilyRouteId: null,
        deepLink: { family_route_id: 12 },
        detail: null,
      }) === 12 &&
      resolvePrmFamilyRouteEditorRouteId({
        selectedFamilyRouteId: null,
        deepLink: {},
        detail: { family_route_id: 12 },
      }) === 12,
    "family editor route id resolves exact open route without name inference",
  );
  assert(
    shouldAcceptPrmFamilyRouteDetailGeneration({
      requestGeneration: 3,
      currentGeneration: 3,
    }) === true &&
      shouldAcceptPrmFamilyRouteDetailGeneration({
        requestGeneration: 2,
        currentGeneration: 3,
      }) === false,
    "family route detail generation accepts only current request",
  );
  assert(
    shouldAcceptPrmPaintGeneration({
      requestGeneration: 4,
      currentGeneration: 4,
    }) === true &&
      shouldAcceptPrmPaintGeneration({
        requestGeneration: 3,
        currentGeneration: 4,
      }) === false &&
      shouldAcceptPrmPaintGeneration({
        requestGeneration: null,
        currentGeneration: 4,
      }) === true &&
      shouldApplyPrmLensTransitionTeardown({
        requestGeneration: 1,
        currentGeneration: 2,
      }) === false,
    "PRM paint generation accepts only current request and blocks stale teardown",
  );
  const wrap = { classList: { add() {}, remove() {}, _added: [] } };
  wrap.classList.add = (name) => {
    wrap.classList._added.push(name);
  };
  wrap.classList.remove = () => {};
  let painted = 0;
  let loaded = 0;
  const paintResult = applyPrmAcceptedPaint({
    tableWrap: wrap,
    requestGeneration: 2,
    currentGeneration: 2,
    render: () => {
      painted += 1;
    },
    getRowCount: () => {
      loaded += 1;
      return 7;
    },
    setRowCount: (count) => {
      wrap.count = count;
    },
  });
  const stalePaint = applyPrmAcceptedPaint({
    tableWrap: wrap,
    requestGeneration: 1,
    currentGeneration: 2,
    render: () => {
      painted += 1;
    },
  });
  assert(
    paintResult?.ok === true &&
      painted === 1 &&
      wrap.count === 7 &&
      wrap.classList._added.includes("tw-visible") &&
      stalePaint?.stale === true &&
      painted === 1,
    "accepted paint is visible, generation-guarded, and does not load",
  );
  const draftUnvalidated = resolvePrmFamilyRouteLifecycleActions({
    status: "DRAFT",
    canEdit: true,
    validation: null,
    validationFresh: false,
  });
  const draftValidated = resolvePrmFamilyRouteLifecycleActions({
    status: "DRAFT",
    canEdit: true,
    validation: { ok: true, is_valid: true },
    validationFresh: true,
  });
  const reviewActions = resolvePrmFamilyRouteLifecycleActions({
    status: "REVIEW_REQUIRED",
    canEdit: true,
    validation: { ok: true, is_valid: true },
    validationFresh: true,
  });
  const approvedActions = resolvePrmFamilyRouteLifecycleActions({
    status: "APPROVED",
    canEdit: true,
    validation: { ok: true, is_valid: true },
    validationFresh: true,
  });
  assert(
    draftUnvalidated.validateEnabled === true &&
      draftUnvalidated.validateLabel === "Validate" &&
      draftUnvalidated.submitEnabled === false &&
      draftValidated.validateEnabled === false &&
      draftValidated.validateLabel === "Validated" &&
      draftValidated.submitEnabled === true &&
      reviewActions.validateVisible === false &&
      reviewActions.submitVisible === false &&
      reviewActions.approveVisible === true &&
      approvedActions.validateVisible === false &&
      approvedActions.submitVisible === false &&
      approvedActions.approveVisible === false &&
      approvedActions.canClone === true &&
      approvedActions.readOnly === true,
    "Family Route lifecycle actions derive from status and validation currentness",
  );
}

assert(
  buildPrmFocusRestoreOptions("pointer").focusVisible === false &&
    shouldShowPrmRowFocusRing("pointer") === false,
  "pointer-restored focus has no heavy active styling",
);
assert(
  buildPrmFocusRestoreOptions("keyboard").focusVisible === true &&
    shouldShowPrmRowFocusRing("keyboard") === true,
  "keyboard-restored focus retains subtle focus-visible treatment",
);

assert(
  mainSrc.includes("refreshFamilyRouteEditorAfterStepMutation") &&
    mainSrc.includes("refreshFamilyRouteEditorAfterLifecycleMutation") &&
    mainSrc.includes("bumpFamilyRouteDetailGeneration") &&
    mainSrc.includes("resolvePrmFamilyRouteEditorRouteId"),
  "family route step and lifecycle post-mutation refresh share generation + canonical route id",
);
assert(
  mainSrc.includes("navigateToFamilyRouteEditor") &&
    mainSrc.includes("resolveFamilyRouteCreateNavigation") &&
    mainSrc.includes("pendingOpenRouteFamilyId") &&
    mainSrc.includes("syncShellLens") &&
    mainSrc.includes("delete nextParams.product_route_id") &&
    mainSrc.includes("delete nextParams.product_id") &&
    !mainSrc.includes(
      'navigate("product-route-editor", {\n                route_family_id',
    ),
  "route creation opens Family editor with no Product editor transition",
);
assert(
  mainSrc.includes("open-family-route") &&
    mainSrc.includes("navigateToFamilyRouteEditor({") &&
    mainSrc.includes("data-prm-history-open") &&
    mainSrc.includes("navigateToFamilyRouteEditor({") &&
    /mode === \"family\"[\s\S]*navigateToFamilyRouteEditor/.test(mainSrc) &&
    mainSrc.includes("closeModal({ restorePrevious: false })"),
  "Open Family Route closes modal and navigates to Family editor",
);
assert(
  (mainSrc.match(/navigateToFamilyRouteEditor\(/g) || []).length >= 3,
  "all Family-route openings use canonical helper",
);
assert(
  isCanonicalFamilyRouteEditorNav(
    resolveFamilyRouteCreateNavigation({ family_route_id: 4 }, 4),
  ),
  "canonical Family route nav omits product ids",
);
assert(
  mainSrc.includes("pendingOpenRouteFamilyId") &&
    !/deepLink\.route_family_id\)\s*\{\s*const family = await findFamilyRow\(deepLink\.route_family_id\)/.test(
      mainSrc,
    ),
  "Family summary does not auto-open from leftover editor deep-link params",
);

{
  const ordered = sortPrmFamilyRouteSteps([
    { id: 15, sequence_no: 80, step_key: "FG transfer boundary", activity_name: "FG transfer", route_step_scope: "FG_TRANSFER_BOUNDARY" },
    { id: 8, sequence_no: 10, step_key: "RM issue boundary", activity_name: "RM issue", route_step_scope: "RM_ISSUE_BOUNDARY", behaviour: "BOUNDARY", resource_class: "STORE", is_mandatory: true },
    { id: 11, sequence_no: 40, step_key: "Pressurized extraction", activity_name: "Extraction", route_step_scope: "PRODUCTION_PROCESS" },
    { id: 9, sequence_no: 20, step_key: "Raw-material disintegration", activity_name: "Disintegration", route_step_scope: "PRODUCTION_PROCESS" },
    { id: 10, sequence_no: 30, step_key: "Pre-extraction WIP holding", activity_name: "WIP hold", route_step_scope: "PRODUCTION_PROCESS" },
    { id: 12, sequence_no: 50, step_key: "Open-vessel boiling", activity_name: "Boiling", route_step_scope: "PRODUCTION_PROCESS" },
    { id: 13, sequence_no: 60, step_key: "QC assessment boundary", activity_name: "QC", route_step_scope: "QC_BOUNDARY" },
    { id: 14, sequence_no: 70, step_key: "Liquid filling and packing", activity_name: "Filling", route_step_scope: "PRODUCTION_PROCESS" },
  ]);
  assert(
    ordered.map((s) => s.sequence_no).join(",") === "10,20,30,40,50,60,70,80" &&
      ordered[0].step_key === "RM issue boundary" &&
      ordered[0].behaviour_label &&
      ordered[0].resource_class_label &&
      ordered.length === 8,
    "eight steps sort by numeric sequence with governed metadata",
  );
  const summary = buildPrmFamilyRouteValidationSummary(
    {
      valid: true,
      step_count: 8,
      rm_boundary_count: 1,
      production_process_count: 4,
      fg_boundary_count: 1,
      issues: [],
    },
    ordered,
  );
  assert(
    summary.valid &&
      summary.labels.steps === "8 steps" &&
      summary.labels.rm === "1 RM boundary" &&
      summary.labels.production === "4 Production steps" &&
      summary.labels.fg === "1 FG boundary" &&
      summary.labels.errors === "0 errors",
    "valid route summary shows 8 / 1 / 4 / 1 / 0",
  );
  const fallbackSummary = buildPrmFamilyRouteValidationSummary(
    { valid: true, errors: [] },
    ordered,
  );
  assert(
    fallbackSummary.rm_boundary_count === 0 &&
      fallbackSummary.fg_boundary_count === 0,
    "fallback does not infer RM/FG boundaries from step names",
  );
  const notice = buildPostExtractionEvidenceGapNotice({
    batch_evidence: { total_batches: 254, with_post_extraction_wip: 19 },
    evidence_gaps: [{ code: "POST_EXTRACTION_FINISHED_BULK_HOLDING" }],
  });
  assert(
    notice &&
      notice.informational &&
      notice.blocks_route === false &&
      notice.message.includes("19 of 254"),
    "evidence gap values derive from RPC response and remain informational",
  );
}
assert(
  formatPrmRouteStepLabel("RM_ISSUE_BOUNDARY") === "Raw Material Issue" &&
    formatPrmRouteStepLabel("RM_DISINTEGRATION") === "Raw Material Disintegration" &&
    formatPrmRouteStepLabel("PRE_EXTRACTION_WIP") === "Pre-extraction WIP Holding" &&
    formatPrmRouteStepLabel("PRESSURIZED_EXTRACTION") === "Pressurized Extraction" &&
    formatPrmRouteStepLabel("OPEN_VESSEL_BOILING") === "Open-vessel Boiling" &&
    formatPrmRouteStepLabel("QC_ASSESSMENT_BOUNDARY") === "Quality Assessment" &&
    formatPrmRouteStepLabel("LIQUID_FILL_PACK") === "Liquid Filling and Packing" &&
    formatPrmRouteStepLabel("FG_TRANSFER_BOUNDARY") === "Finished Goods Transfer",
  "human-readable step labels are mapped",
);
assert(
  formatPrmHierarchyLabel(["Raw Material Store", "Dispensation", "-"]) ===
    "Raw Material Store › Dispensation" &&
    formatPrmHierarchyLabel(["Pulverizer Section", "-", "Powdering and Sieving Area"]) ===
      "Pulverizer Section › Powdering and Sieving Area",
  "hierarchy placeholders are removed",
);
assert(
  resolveProductionRouteLens("route-family-route-editor") ===
    PRODUCTION_ROUTE_DEFAULT_LENS,
  "empty Family editor still resolves to Route Readiness",
);
const editorSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-production-route-editor.js"),
  "utf8",
);
const stepFormSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-production-route-step-form.js"),
  "utf8",
);
assert(
  editorSrc.includes("resolvePrmFamilyRouteLifecycleActions") &&
    /lifecycle\.validateVisible[\s\S]*data-prm-action="validate-family"/.test(
      editorSrc,
    ) &&
    editorSrc.includes("canMutateSteps") &&
    editorSrc.includes("canSubmit") &&
    /canMutateSteps \?[\s\S]*add-family-step-after[\s\S]*canSubmit \?[\s\S]*submit-family/.test(
      editorSrc,
    ) &&
    /canReviewApprove \?[\s\S]*approve-family/.test(editorSrc) &&
    /canClone \?[\s\S]*clone-family-route/.test(editorSrc) &&
    !editorSrc.includes('data-prm-action="supersede-family"') &&
    editorSrc.includes("buildFamilyStepDetailHtml") &&
    stepFormSrc.includes("data-prm-family-step-save") &&
    !editorSrc.includes('summary.valid ? "Route valid"') &&
    !editorSrc.includes('summary.step_count, "0")} steps'),
  "Validate is edit-gated; Draft mutate/submit; review approve; clone replaces manual supersede",
);
assert(
  !editorSrc.includes("19 of 254 batches"),
  "evidence gap message is not hardcoded with fixed batch counts",
);
assert(
  editorSrc.includes("rpc_preview_route_family_route_steps") &&
    editorSrc.includes("buildPrmFamilyRouteValidationSummary") &&
    editorSrc.includes("Does not block this route") &&
    !editorSrc.includes("submitFamily();") &&
    !/loadFamilyDetail[\s\S]*approveFamily\(/.test(editorSrc),
  "no automatic submit or approval call on Family editor load",
);

assert(
  mainSrc.includes("buildPrmFocusRestoreOptions") &&
    mainSrc.includes("modalOpenerModality") &&
    mainSrc.includes("clearActiveRowHighlight"),
  "active-row class clears and modal focus restore is modality-aware",
);

const shellSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
assert(
  shellSrc.includes('qs.set("family_route_id"') &&
    shellSrc.includes('qs.set("route_family_id"') &&
    shellSrc.includes('qs.set("product_route_id"'),
  "shared buildCostingRouteQuery retains PRM deep-link IDs",
);
assert(
  shellSrc.includes("DETAILS_OPENER_MODALITY") &&
    shellSrc.includes("focusVisible") &&
    shellSrc.includes("cp-prm-row--active"),
  "shared shell restores focus with opener modality",
);

const csrHtml = readFileSync(
  join(root, "public/shared/cost-sheet-review.html"),
  "utf8",
);
assert(
  !csrHtml.includes(
    ".cp-qc-aq-card:focus,\n      .cp-qc-aq-row:focus {\n        outline: 2px solid",
  ),
  "QC/MS tables no longer apply heavy unconditional :focus border",
);
assert(
  htmlSrc.includes(".cp-prm-row:focus-visible") &&
    htmlSrc.includes("outline: 1px solid") &&
    /\.cp-prm-row:focus\s*\{\s*outline:\s*none;/.test(htmlSrc) &&
    htmlSrc.includes('tr[tabindex="0"]:focus'),
  "PRM row focus uses subtle focus-visible only",
);

if (failed) {
  console.error(`production-route-helpers-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("production-route-helpers-smoke: all passed");
