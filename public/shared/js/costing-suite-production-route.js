/**
 * Production Route Manager — Manufacturing Route Family suite controller.
 * Server RPC responses remain the source of route readiness and governance.
 */

import {
  PRODUCTION_ROUTE_DEFAULT_LENS,
  PRODUCTION_ROUTE_LENS_IDS,
  PRODUCTION_ROUTE_MODULE_KEY,
  PRODUCTION_ROUTE_RPC_NAMES,
  PRM_ACTIVE_ROW_CLASS,
  PRM_APPROVAL_REFERENCE_HELPER_TEXT,
  PRM_EMPTY_STATES,
  PRM_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
  PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT,
  PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT,
  PRM_FOUNDATION_REVIEW_GROUP_EVIDENCE_CLASSES,
  PRM_FAMILY_FIELD_HELPERS,
  PRM_READINESS_STATUSES,
  buildFamilyRouteEditorNavParams,
  buildPrmFamilyApprovalReferenceTemplate,
  buildPrmFamilyRouteApprovalReference,
  buildPrmProductRouteApprovalReference,
  buildPrmProductRouteFamilyAssignmentApprovalReference,
  buildPrmRouteFamilyApprovalReference,
  buildPrmResourceClassLabelIndex,
  resolvePrmResourceClassDisplayLabel,
  buildPrmMappingApprovalReferenceTemplate,
  getPrmLocalIsoDate,
  PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT,
  PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT,
  PRM_PRODUCT_ROUTE_FAMILY_ASSIGNMENT_APPROVAL_REFERENCE_HELPER_TEXT,
  PRM_ROUTE_FAMILY_APPROVAL_REFERENCE_HELPER_TEXT,
  resolvePrmFamilyRouteApprovalIdentity,
  resolvePrmProductRouteApprovalIdentity,
  resolvePrmProductRouteFamilyAssignmentApprovalIdentity,
  resolvePrmProductAssignmentCreateEligibility,
  resolvePrmRouteFamilyApprovalIdentity,
  validatePrmFamilyRouteApprovalReference,
  validatePrmProductRouteApprovalReference,
  validatePrmProductRouteFamilyAssignmentApprovalReference,
  validatePrmRouteFamilyApprovalReference,
  filterPrmRouteFamilyGroupMappings,
  filterPrmRouteFamilySubgroupMappings,
  filterPrmRouteFamilyProductAssignments,
  summarizePrmRouteFamilyAssignments,
  buildPrmMappingBasisOptionsHtml,
  buildPrmProductGroupMappingOptions,
  clampPrmPagination,
  clearPrmActiveRowClass,
  coercePrmList,
  createPrmModalStack,
  ensurePrmAsOfDateInitialized,
  assignmentLifecycleIncludes,
  buildPrmAssignmentBasisOptionsHtml,
  buildPrmAssignmentProductHandoff,
  buildPrmWorkloadProductHandoff,
  extractCandidateRouteFamilyId,
  formatPrmActionLabel,
  formatPrmAssignmentFamilyLabel,
  formatPrmAssignmentGroupLabel,
  formatPrmAssignmentProductLabel,
  formatPrmAssignmentReferenceSummary,
  formatPrmAssignmentStatusLabel,
  formatPrmCommercialHierarchyLabel,
  formatPrmDayMonthYearLabel,
  formatPrmFamilyRouteVersionCopy,
  formatPrmProductRouteVersionCopy,
  formatPrmRouteFamilyAssignmentSourceLabel,
  formatPrmRouteAssignmentSourceExplain,
  resolvePrmEffectiveFamilyRouteId,
  resolvePrmRouteFamilyAssignmentSource,
  isPrmProductRouteEditorCreateContext,
  resolvePrmProductHistoryRouteId,
  resolvePrmProductRouteVersionFromHistory,
  resolvePrmOpenProductRouteEligibility,
  formatPrmProductHistoryBaseFamilyRoute,
  selectPrmProductBatchSizeReferences,
  PRM_PRODUCT_ROUTE_CREATE_BATCH_REQUIRED,
  PRM_PRODUCT_ROUTE_SOURCES,
  formatPrmDlScopeSummary,
  formatPrmFoundationStatusLabel,
  formatPrmPohScopeSummary,
  formatPrmWorkloadBatchBasisHtml,
  formatPrmWorkloadMonthlyQuantity,
  formatPrmWorkloadPreferredBatch,
  formatPrmWorkloadRoundedBatches,
  formatPrmWorkloadRawDisplay,
  PRM_WORKLOAD_DL_SCOPE_TITLE,
  PRM_WORKLOAD_POH_SCOPE_TITLE,
  formatPrmProductGroupHierarchyLabel,
  formatPrmExactRunContextCue,
  formatPrmMonthYearLabel,
  formatPrmMappingReviewClassLabel,
  formatPrmMappingReviewReadinessLabel,
  buildPrmMappingReviewEvidenceNote,
  aggregatePrmMappingReviewGroups,
  getPrmMappingReviewClassSummaryCounts,
  normalizePrmMappingReviewPayload,
  formatPrmFoundationGroupEvidenceClassLabel,
  formatPrmFoundationProductEvidenceClassLabel,
  formatPrmFoundationFamilyStepEvidenceClassLabel,
  formatPrmFoundationReviewGuidanceNote,
  formatPrmFoundationSupportRatio,
  formatPrmFoundationIdLabel,
  getPrmFoundationReviewClassSummaryMap,
  normalizePrmFoundationReviewPayload,
  formatPrmReadinessLabel,
  formatPrmRouteStatusLabel,
  formatPrmRouteValidationSummary,
  formatPrmRpcError,
  formatPrmWorkloadSummaryLine,
  buildPrmFocusRestoreOptions,
  getPrmRouteValidationTone,
  listPrmRouteValidationErrors,
  formatPrmStepSourceLabel,
  formatPrmValidationLabel,
  getApplicableProductRouteActions,
  getApplicableRouteFamilyActions,
  buildPrmPreferredBatchSizeHandoffAction,
  getPrmReadinessCellValue,
  getPrmReadinessTone,
  getRouteFamilyNextActionLabel,
  getRouteFamilyWorkflowSteps,
  hasApprovedCostCentres,
  hasPrmAssignmentOverlap,
  isBlankPrmValue,
  isMeaningfulPrmApprovalReference,
  isMeaningfulPrmCancellationReason,
  isPendingRouteFamilyMapping,
  isPrmMasterOptionsReady,
  resolvePrmMasterOptionsRequestScope,
  shouldAcceptPrmMasterOptionsGeneration,
  shouldAcceptPrmPaintGeneration,
  shouldApplyPrmLensTransitionTeardown,
  applyPrmTableWrapVisible,
  resolvePrmFamilyRouteEditorLoadId,
  resolvePrmFamilyRouteEditorRouteId,
  shouldApplyPrmFamilyRouteEmptyContextRefresh,
  normalizePrmAssignmentLifecycleActions,
  isPrmPendingMappingStatus,
  isProductionRouteLens,
  isPrmRouteReviewStatus,
  formatPrmRouteEvidenceStatusLabel,
  formatPrmRouteSourceTypeLabel,
  humanizeUnknownPrmCode,
  canonicalPrmRouteStatus,
  PRM_ROUTE_EVIDENCE_STATUSES,
  normalizePrmAsOfDate,
  normalizePrmCode,
  normalizePrmWorkloadDetailPayload,
  normalizePrmWorkloadPreviewPayload,
  selectPrmPrimaryAssignmentFilterStatuses,
  selectPrmPrimaryReadinessFilterStatuses,
  selectPrmPrimaryWorkloadFilterStatuses,
  selectPrmSecondaryWorkloadFilterStatuses,
  sumPrmStatusCounts,
  normalizePrmIntegerId,
  normalizePrmMappingBasis,
  normalizePrmMasterOptions,
  normalizePrmProductAssignmentRow,
  normalizePrmProductAssignmentsPayload,
  normalizePrmProductSubgroupMapping,
  normalizePrmRouteFamilyMapping,
  normalizePrmRpcPayload,
  pageToPrmOffset,
  prmTotalPages,
  PRM_ASSIGNMENT_STATUSES,
  PRM_WORKLOAD_BATCH_LABELS,
  PRM_WORKLOAD_POLICY_DISCLAIMER,
  PRM_WORKLOAD_EXPLAIN_DL_FORMULA,
  PRM_WORKLOAD_EXPLAIN_POH_FORMULA,
  PRM_WORKLOAD_EXPLAIN_POH_NEUTRALITY_NOTE,
  PRM_WORKLOAD_EXPLAIN_DL_SUPERVISION_NOTE,
  classifyPrmWorkloadReconciliation,
  formatPrmWorkloadExplainMoney,
  formatPrmWorkloadExplainNumber,
  formatPrmWorkloadSharePercent,
  formatPrmWorkloadPolicyLabel,
  formatPrmWorkloadFormulaLabel,
  formatPrmDlWorkloadDriverLabel,
  isPrmDlComponentModelActive,
  hasPrmDlSupervisionSteps,
  PRM_WORKLOAD_EXPLAIN_DL_COMPONENT_FORMULA,
  PRM_DL_LEGACY_BANNER_TITLE,
  PRM_DL_LEGACY_BANNER_FALLBACK,
  PRM_DL_COMPONENT_OVERALL_STATUS_CUE,
  PRM_DL_MANUFACTURING_COPY,
  normalizePrmWorkloadManagementExplainPayload,
  resolvePrmWorkloadExplainRouteLineage,
  readPrmEditMappingFormValues,
  readPrmMapProductGroupFormValues,
  resolveDefaultPrmMappingBasis,
  resolvePrmFamilyRouteCreateEligibility,
  formatPrmRouteFamilySelectorLabel,
  selectPrmRouteFamiliesForFamilyRouteCreate,
  isPrmRouteFamilyEligibleForFamilyRouteCreate,
  resolveFamilyRouteCreateNavigation,
  resolveProductionRouteLens,
  resolvePrmFamilyRouteCreateProvenanceContext,
  validatePrmFamilyRouteCreateProvenance,
  canonicalizePrmFamilyRouteStepKey,
  PRM_FAMILY_ROUTE_CREATE_SOURCE_HELPER,
  PRM_FAMILY_ROUTE_CREATE_EVIDENCE_HELPER,
  selectPrmReadinessColumns,
  summarizePrmCostCentreSetup,
  resolvePrmCostCentreSetupChip,
} from "./costing-suite-production-route-helpers.js";
import {
  buildApproveProductRouteFamilyAssignmentArgs,
  buildApproveRouteFamilyArgs,
  buildApproveRouteFamilyMappingArgs,
  buildCancelProductRouteFamilyAssignmentArgs,
  buildCorrectProductRouteFamilyAssignmentEffectiveFromArgs,
  buildCreateProductRouteFamilyAssignmentDraftArgs,
  buildCreateRouteFamilyArgs,
  buildEffectiveRouteArgs,
  buildInactivateProductRouteFamilyAssignmentArgs,
  buildMapProductGroupToRouteFamilyArgs,
  buildMasterOptionsRpcArgs,
  buildProductAssignmentsRpcArgs,
  buildProductCandidateRpcArgs,
  buildProductRouteHistoryArgs,
  buildExactRunReadinessRpcArgs,
  buildReadinessRpcArgs,
  buildMappingReviewCandidatesRpcArgs,
  buildFoundationReviewRpcArgs,
  buildRouteFamilyRouteHistoryArgs,
  buildSubmitProductRouteFamilyAssignmentArgs,
  buildUpdateRouteFamilyMappingDraftArgs,
  buildWorkloadDetailRpcArgs,
  buildWorkloadManagementExplainRpcArgs,
  buildWorkloadPreviewRpcArgs,
  extractCreatedRouteFamilyId,
  normalizeEffectiveRoute,
  normalizeProductCandidate,
  normalizeProductRouteFamilyAssignmentPayload,
  normalizeReadinessPayload,
  normalizeRouteHistory,
  normalizeProductRouteHistory,
  resolveRouteFamilyRouteStateFromHistory,
} from "./costing-suite-production-route-rpc.js";
import { createProductionRouteEditorController } from "./costing-suite-production-route-editor.js";
import { createProductionRouteCandidatesController } from "./costing-suite-production-route-candidates.js";
import { createProductionCostCentresController } from "./costing-suite-production-route-cost-centres.js";
import { createPrmSubgroupArchiveController } from "./costing-suite-production-route-subgroup-archive.js";
import {
  closeOpenSearchableSelectLists,
  destroySearchableSelectsIn,
  enhanceSearchableSelect,
} from "./sasv-module-chrome.js";

export {
  PRODUCTION_ROUTE_DEFAULT_LENS,
  PRODUCTION_ROUTE_LENS_IDS,
  PRODUCTION_ROUTE_MODULE_KEY,
  PRODUCTION_ROUTE_RPC_NAMES,
  isProductionRouteLens,
  pageToPrmOffset,
  prmTotalPages,
  resolveProductionRouteLens,
};

const RPC = Object.freeze({
  // Costing Readiness Queue uses exact-run only — never fall back to general readiness.
  exactRunReadiness: "rpc_get_production_route_manager_exact_run_readiness",
  // General as-of-date route-maintenance readiness (retained adapter; not Costing queue).
  generalReadiness: "rpc_get_production_route_manager_readiness",
  options: "rpc_get_production_route_master_options",
  familyHistory: "rpc_get_route_family_route_history",
  productHistory: "rpc_get_product_route_history",
  effective: "rpc_get_effective_product_process_route",
  createFamily: "rpc_create_route_family",
  approveFamily: "rpc_approve_route_family",
  mapProductGroup: "rpc_map_product_group_to_route_family",
  approveMapping: "rpc_approve_route_family_mapping",
  updateMappingDraft: "rpc_update_route_family_mapping_draft",
  createAssignmentDraft: "rpc_create_product_route_family_assignment_draft",
  productAssignments:
    "rpc_get_production_route_manager_product_assignments",
  submitAssignment:
    "rpc_submit_product_route_family_assignment_for_review",
  approveAssignment: "rpc_approve_product_route_family_assignment",
  cancelAssignment: "rpc_cancel_product_route_family_assignment",
  inactivateAssignment: "rpc_inactivate_product_route_family_assignment",
  correctAssignmentEffectiveFrom:
    "rpc_correct_product_route_family_assignment_effective_from",
  productCandidate: "rpc_preview_product_process_route_candidate",
  workloadPreview: "rpc_get_production_route_manager_workload_preview",
  workloadDetail: "rpc_get_production_route_manager_workload_detail",
  workloadExplain: "rpc_get_route_workload_management_explain",
  mappingReview: "rpc_get_route_family_mapping_review_candidates",
  foundationReview: "rpc_get_route_family_foundation_review",
  costCentres: "rpc_get_production_cost_centres",
  costCentreDetail: "rpc_get_production_cost_centre_detail",
  createCostCentre: "rpc_create_production_cost_centre_draft",
  updateCostCentre: "rpc_update_production_cost_centre_draft",
  validateCostCentre: "rpc_validate_production_cost_centre",
  approveCostCentre: "rpc_approve_production_cost_centre",
  inactivateCostCentre: "rpc_inactivate_production_cost_centre",
});

/** Step fields for effective-route table — render only keys present on steps. */
const PRM_EFFECTIVE_STEP_FIELD_DEFS = Object.freeze([
  { key: "sequence_no", label: "Seq", alts: ["sequence"] },
  { key: "step_key", label: "Step", alts: ["effective_step_key"] },
  { key: "activity", label: "Activity", alts: ["activity_name"] },
  { key: "activity_kind", label: "Activity kind", alts: ["activity_type"] },
  {
    key: "cost_centre_name",
    label: "Cost centre",
    alts: ["cost_centre", "cost_centre_code"],
  },
  { key: "section_name", label: "Section", alts: ["section"] },
  { key: "subsection_name", label: "Subsection", alts: ["subsection"] },
  { key: "area_name", label: "Area", alts: ["area"] },
  { key: "plant_name", label: "Plant", alts: ["plant"] },
  {
    key: "behaviour_name",
    label: "Behaviour",
    alts: ["behaviour", "behaviour_code"],
  },
  {
    key: "resource_class_name",
    label: "Resource class",
    alts: ["resource_class", "resource_class_code"],
  },
  {
    key: "expected_occurrences",
    label: "Expected occurrences",
    alts: ["expected_occurrence_count"],
  },
  {
    key: "standard_cycles",
    label: "Standard cycles",
    alts: ["standard_cycle_count"],
  },
  {
    key: "route_step_scope",
    label: "Route-step scope",
    alts: ["route_step_scope_label", "step_scope"],
  },
  {
    key: "direct_labour_scope",
    label: "DL",
    alts: ["dl_scope"],
  },
  {
    key: "production_overhead_scope",
    label: "POH",
    alts: ["poh_scope"],
  },
  {
    key: "step_source",
    label: "Source type",
    alts: ["source", "source_type"],
  },
  {
    key: "base_step_id",
    label: "Base step",
    alts: ["base_family_step_id", "family_step_id"],
  },
  {
    key: "override_id",
    label: "Override lineage",
    alts: ["product_override_id", "override_lineage"],
  },
]);

const PRM_ROUTE_BLOCKED_READINESS = Object.freeze([
  "BLOCKED_NO_VALID_EFFECTIVE_ROUTE",
  "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING",
  "BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE",
  "BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE",
  "BLOCKED_NO_EFFECTIVE_ROUTE_STEPS",
]);

const PRM_CANDIDATE_ADVISORY_LABEL =
  "Advisory historical evidence — no assignment or route is created automatically.";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value, fallback = "—") {
  return isBlankPrmValue(value) ? fallback : escapeHtml(value);
}

function hierarchy(row = {}) {
  return (
    formatPrmCommercialHierarchyLabel(row) ||
    [
      row.category_name,
      row.division_name,
      row.segment_name,
      row.product_group_name,
    ]
      .filter(Boolean)
      .join(" / ") ||
    "—"
  );
}

export function createProductionRouteController(deps = {}) {
  const {
    costingRpc,
    showToast,
    statusChip,
    normalizeStatus,
    canView = () => true,
    canEdit = () => false,
    getCurrentLens = () => PRODUCTION_ROUTE_DEFAULT_LENS,
    navigateToCostingRoute = null,
    syncShellLens = null,
    beginPrmSoftNavLock = null,
    endPrmSoftNavLock = null,
    afterPrmNavigate = null,
  } = deps;

  let disposed = false;
  let generation = 0;
  let handlers = [];
  let modalHandlers = [];
  let popoverDismissHandlers = [];
  let mutationInFlight = false;
  let modalReturnFocus = null;
  let modalOpenerModality = "keyboard";
  let lastInputModality = "keyboard";
  let modalLayerCleanup = null;
  let modalParent = null;
  let prmOwnsDetailsModal = false;
  let prmEscapeCapture = null;
  let prmInputModalityBound = false;
  let pendingOpenRouteFamilyId = null;
  let lastProductCandidatePayload = null;
  let prmPopstateBound = false;
  let lensRenderGeneration = 0;
  let familyRouteOpenGeneration = 0;
  let activeLensRequestController = null;
  const modalStack = createPrmModalStack();
  const PRM_DEEP_LINK_KEYS = Object.freeze([
    "product_id",
    "product_group_id",
    "product_subgroup_id",
    "route_family_id",
    "family_route_id",
    "product_route_id",
    "mapping_id",
    "as_of_date",
    "candidate_kind",
    "entity_type",
  ]);
  let state = {
    activeLens: PRODUCTION_ROUTE_DEFAULT_LENS,
    as_of_date: null,
    search: "",
    readiness_status: "",
    product_group_id: "",
    route_family_id: "",
    limit: 25,
    offset: 0,
    page: 1,
    total_count: 0,
    exact_run_total: null,
    status_counts: {},
    status_counts_baseline: {},
    readinessRows: [],
    readinessLoadError: null,
    // Product Assignments register (Gate 11Y.4C.2)
    assignment_status: "",
    assignmentRows: [],
    assignmentTotalCount: 0,
    assignment_status_counts: {},
    assignment_status_counts_baseline: {},
    assignmentTotalBaseline: null,
    assignmentLoadError: null,
    assignmentLoading: false,
    assignmentGeneration: 0,
    /** Transient remediation focus from deep-link product_id (not sticky). */
    assignmentFocusProductId: null,
    // Workload Preview register (Gate 11Y.4D.1 / 2B.2A infinite scroll)
    workloadRows: [],
    workloadTotalCount: 0,
    workloadSummary: {},
    workload_status_counts: {},
    workload_status_counts_baseline: {},
    workload_quantity_status_counts: {},
    workload_quantity_status_counts_baseline: {},
    workloadTotalBaseline: null,
    foundation_status: "",
    quantity_driver_status: "",
    dl_scope_filter: "",
    poh_scope_filter: "",
    product_id: "",
    workloadLoadError: null,
    workloadLoading: false,
    workloadLoadingMore: false,
    workloadLoadMoreError: null,
    workloadLimit: 50,
    workloadOffset: 0,
    workloadGeneration: 0,
    workloadDetailGeneration: 0,
    workloadScrollTop: null,
    workloadProductModalGeneration: 0,
    workloadExplainPayload: null,
    workloadExplainProductId: null,
    workloadExplainGeneration: 0,
    workloadExplainInflight: null,
    workloadExplainError: null,
    productDetailSourceContext: null,
    focusAssignmentId: null,
    options: null,
    optionsStatus: "uninitialized",
    optionsError: null,
    productGroups: [],
    productSubgroups: [],
    products: [],
    routeFamilies: [],
    routeFamilyMappings: [],
    routeFamilySubgroupMappings: [],
    approvedFamilyRoutes: [],
    batchSizeReferences: [],
    costCentreBlocker: true,
    selectedProductId: null,
    productRouteCreateHandoff: null,
    productRouteReentryChooser: null,
    selectedProductRouteId: null,
    selectedRouteFamilyId: null,
    selectedFamilyRouteId: null,
    familyRouteCreateFamilyId: null,
    familyRouteCreateEligibility: null,
    familyHistory: [],
    productHistory: [],
    effective: null,
    effectiveViewer: {
      productId: null,
      source: null,
      payload: null,
      status: "empty",
      error: null,
      productHistory: [],
      familyHistory: [],
    },
    deepLink: {},
    preselectProductGroupId: null,
    pendingMapFromEvidence: false,
    mappingReviewPayload: null,
    mappingReviewGroups: [],
    mappingReviewLoadError: null,
    foundationReviewPayload: null,
    foundationReviewGroups: [],
    foundationReviewLoadError: null,
    foundationTotalCount: 0,
    costCentresPayload: null,
    costCentres: [],
    costCentresLoadError: null,
    costCentreStatusFilter: "",
    costCentrePoolFilter: "",
    costCentreDetail: null,
    // Gate 11Y.10I.2C.3F.1C — Subgroup Mappings
    subgroup_mapping_status: "",
    product_subgroup_id: "",
    subgroupMappingRows: [],
    subgroupMappingTotalCount: 0,
    subgroup_mapping_status_counts: {},
    subgroupMappingLoadError: null,
    subgroupMappingLoading: false,
    subgroupMappingGeneration: 0,
    // Gate 11Y.10I.2C.3F.1C — Archived Routes
    archived_entity_type: "",
    archivedRouteRows: [],
    archivedRouteTotalCount: 0,
    archivedRouteLoadError: null,
    archivedRouteLoading: false,
    archivedRouteGeneration: 0,
    loading: false,
    error: null,
    permissionDenied: false,
  };

  const editor = createProductionRouteEditorController({
    costingRpc,
    showToast,
    canEdit,
    getOptions: () => state.options,
  });
  const candidates = createProductionRouteCandidatesController({
    costingRpc,
    showToast,
    canEdit,
    confirmCandidateUse: openCandidateReviewModal,
    applyCandidateToDraft: (mode, prefill) =>
      editor.applyCandidateToDraft(mode, prefill, {
        costCentreBlocked: state.costCentreBlocker,
      }),
  });
  let costCentres = null;

  function on(el, type, fn, options) {
    if (!el) return;
    el.addEventListener(type, fn, options);
    handlers.push({ el, type, fn, options });
  }

  function onModal(el, type, fn, options) {
    if (!el) return;
    el.addEventListener(type, fn, options);
    modalHandlers.push({ el, type, fn, options });
  }

  function unbindModalHandlers() {
    for (const item of modalHandlers) {
      item.el?.removeEventListener?.(item.type, item.fn, item.options);
    }
    modalHandlers = [];
  }

  function unbindPopoverDismiss() {
    for (const item of popoverDismissHandlers) {
      item.el?.removeEventListener?.(item.type, item.fn, item.options);
    }
    popoverDismissHandlers = [];
  }

  /** Page/register handlers only — modal listeners belong to closeModal / applyModalContent. */
  function unbind() {
    unbindPopoverDismiss();
    if (!prmOwnsDetailsModal) {
      detachPrmEscapeCapture();
    }
    for (const item of handlers) {
      item.el?.removeEventListener?.(item.type, item.fn, item.options);
    }
    handlers = [];
  }

  function hosts() {
    return {
      summary: document.getElementById("workbenchSummary"),
      tableHead: document.getElementById("tableHead"),
      tableBody: document.getElementById("tableBody"),
      tableWrap: document.getElementById("tableWrap"),
      setup: document.getElementById("prmSetupBanner"),
    };
  }

  function clearLensOwnedDom() {
    const wrap = hosts().tableWrap;
    const root = wrap?.querySelector?.("[data-prm-lens-root]");
    if (root) root.remove();
    document
      .getElementById("mainTable")
      ?.removeAttribute("data-prm-workload-table");
    document
      .getElementById("mainTable")
      ?.removeAttribute("data-prm-subgroup-mappings-table");
  }

  function ensureLensRoot(lensId) {
    const wrap = hosts().tableWrap;
    if (!wrap) return null;
    clearLensOwnedDom();
    const root = document.createElement("div");
    root.setAttribute("data-prm-lens-root", lensId || "");
    wrap.appendChild(root);
    return root;
  }

  function beginLensTransition(nextLens) {
    lensRenderGeneration += 1;
    const token = lensRenderGeneration;
    if (activeLensRequestController) {
      try {
        activeLensRequestController.abort();
      } catch {
        /* ignore */
      }
    }
    activeLensRequestController = new AbortController();
    if (
      shouldApplyPrmLensTransitionTeardown({
        requestGeneration: token,
        currentGeneration: lensRenderGeneration,
      })
    ) {
      editor.bumpFamilyRouteDetailGeneration?.();
      editor.clearFamilyStepExpansion?.();
      clearActiveRowHighlight();
      clearLensOwnedDom();
      // Register lenses paint into mainTable; editor/viewer lenses hide it.
      // Clear immediately so a stale/competing paint cannot leave Route Readiness
      // rows visible after modal close during soft-nav.
      if (
        nextLens === "route-family-route-editor" ||
        nextLens === "product-route-editor" ||
        nextLens === "historical-candidate-review" ||
        nextLens === "effective-route-viewer"
      ) {
        const table = document.getElementById("mainTable");
        if (table) table.style.display = "none";
        const host = hosts();
        if (host.tableHead) host.tableHead.innerHTML = "";
        if (host.tableBody) host.tableBody.innerHTML = "";
      }
    }
    return token;
  }

  function acceptPrmPaintGeneration(generation) {
    return shouldAcceptPrmPaintGeneration({
      requestGeneration: generation,
      currentGeneration: lensRenderGeneration,
    });
  }

  function paintAcceptedPrmLens({ generation } = {}) {
    const token =
      generation != null ? Number(generation) : lensRenderGeneration;
    if (!acceptPrmPaintGeneration(token)) {
      return { ok: false, stale: true };
    }
    if (typeof afterPrmNavigate === "function") {
      return afterPrmNavigate({ generation: token }) || { ok: true };
    }
    applyPrmTableWrapVisible(hosts().tableWrap);
    render({ paintGeneration: token });
    return { ok: true };
  }

  function getAsOfDate() {
    state.as_of_date =
      normalizePrmAsOfDate(state.as_of_date, { fallbackToToday: false }) ||
      ensurePrmAsOfDateInitialized();
    return state.as_of_date;
  }

  function paintError(message) {
    state.error = String(message || "");
    const host = document.getElementById("statusArea");
    if (host) host.textContent = state.error;
  }

  async function invoke(name, built, fallback) {
    if (!built?.ok) {
      const message = built?.errors?.join("; ") || fallback;
      paintError(message);
      showToast?.(message, "warning", 5200);
      return { ok: false, errors: built?.errors || [message] };
    }
    const { data, error } = await costingRpc(name, built.params);
    if (error) {
      const message =
        formatPrmRpcError(name, built.params, error) ||
        error.message ||
        fallback;
      console.error(message);
      paintError(message);
      showToast?.(error.message || fallback, "error", 9000, true);
      return { ok: false, error };
    }
    state.error = null;
    return { ok: true, data };
  }

  async function withMutation(button, work) {
    if (mutationInFlight) {
      showToast?.(
        "Please wait for the current action to finish.",
        "info",
        3200,
      );
      return { ok: false, reason: "busy" };
    }
    mutationInFlight = true;
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }
    try {
      return await work();
    } finally {
      mutationInFlight = false;
      if (button) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
    }
  }

  let masterOptionsGeneration = 0;
  let masterOptionsInflight = null;
  let masterOptionsInflightGeneration = 0;

  function syncCostCentreBlockerFromOptions() {
    if (!isPrmMasterOptionsReady(state.optionsStatus)) {
      state.costCentreBlocker = true;
      return;
    }
    state.costCentreBlocker = !hasApprovedCostCentres(state.options);
  }

  function commitMasterOptionsPayload(payload, generation) {
    if (
      !shouldAcceptPrmMasterOptionsGeneration(
        generation,
        masterOptionsGeneration,
      )
    ) {
      return { ok: true, stale: true, generation, data: state.options };
    }
    state.options = payload;
    state.optionsStatus = "ready";
    state.optionsError = null;
    state.productGroups = payload.product_groups || [];
    state.productSubgroups = payload.product_subgroups || [];
    state.products = payload.products || [];
    state.routeFamilies = payload.route_families || [];
    state.routeFamilyMappings = payload.route_family_mappings || [];
    state.routeFamilySubgroupMappings =
      payload.route_family_subgroup_mappings || [];
    state.approvedFamilyRoutes = payload.approved_route_family_routes || [];
    state.batchSizeReferences = payload.batch_size_references || [];
    if (state.activeLens === "route-families") {
      state.total_count = (state.routeFamilies || []).length;
    }
    syncCostCentreBlockerFromOptions();
    renderSetupChip();
    return { ok: true, data: payload, generation, stale: false };
  }

  async function loadMasterOptions(filters = {}) {
    const generation = ++masterOptionsGeneration;
    const scope = resolvePrmMasterOptionsRequestScope(filters, {
      selectedProductId: state.selectedProductId,
      product_group_id: state.product_group_id,
      route_family_id: state.route_family_id,
      deepLink: state.deepLink || {},
    });
    state.optionsStatus = "loading";
    state.optionsError = null;
    syncCostCentreBlockerFromOptions();
    renderSetupChip();
    const run = (async () => {
      const response = await invoke(
        RPC.options,
        buildMasterOptionsRpcArgs({
          as_of_date: getAsOfDate(),
          product_id: scope.product_id,
          product_group_id: scope.product_group_id,
          route_family_id: scope.route_family_id,
        }),
        "Unable to load route master options.",
      );
      if (
        !shouldAcceptPrmMasterOptionsGeneration(
          generation,
          masterOptionsGeneration,
        )
      ) {
        return { ok: true, stale: true, generation, data: state.options };
      }
      if (!response.ok) {
        if (
          !shouldAcceptPrmMasterOptionsGeneration(
            generation,
            masterOptionsGeneration,
          )
        ) {
          return { ok: true, stale: true, generation, data: state.options };
        }
        state.optionsStatus = "error";
        state.optionsError =
          response.error?.message ||
          "Unable to load route master options.";
        syncCostCentreBlockerFromOptions();
        renderSetupChip();
        return response;
      }
      const payload = normalizePrmMasterOptions(
        normalizePrmRpcPayload(response.data) || response.data,
      );
      return commitMasterOptionsPayload(payload, generation);
    })();
    masterOptionsInflightGeneration = generation;
    masterOptionsInflight = run.finally(() => {
      if (masterOptionsInflightGeneration === generation) {
        masterOptionsInflight = null;
      }
    });
    return run;
  }

  async function ensureMasterOptions(filters = {}) {
    if (isPrmMasterOptionsReady(state.optionsStatus) && state.options) {
      return { ok: true, data: state.options, cached: true };
    }
    if (masterOptionsInflight) {
      return masterOptionsInflight;
    }
    return loadMasterOptions(filters);
  }

  async function requireMasterOptionsForStepAuthoring() {
    const result = await ensureMasterOptions();
    if (!result?.ok || !isPrmMasterOptionsReady(state.optionsStatus)) {
      showToast?.(
        state.optionsError ||
          "Catalogue options are unavailable. Retry after master options load.",
        "warning",
      );
      return { ok: false, reason: "options_unavailable" };
    }
    if (state.costCentreBlocker) {
      showToast?.(
        "Approved Production cost centres are required before adding steps.",
        "warning",
      );
      return { ok: false, reason: "cost_centre_required" };
    }
    return { ok: true, data: state.options };
  }

  async function loadReadiness({ resetOffset = false, search } = {}) {
    if (!canView()) {
      state.permissionDenied = true;
      return { ok: false, permissionDenied: true };
    }
    const current = ++generation;
    state.loading = true;
    state.permissionDenied = false;
    state.readinessLoadError = null;
    if (resetOffset) {
      state.page = 1;
      state.offset = 0;
    }
    if (search != null) state.search = String(search || "").trim();
    if (!isPrmMasterOptionsReady(state.optionsStatus) || !state.options) {
      const options = await ensureMasterOptions();
      if (!options.ok) {
        state.loading = false;
        return options;
      }
    }
    const isUnfiltered =
      !state.readiness_status &&
      !state.search &&
      !state.product_group_id &&
      !state.route_family_id;
    const response = await invoke(
      RPC.generalReadiness,
      buildReadinessRpcArgs({
        as_of_date: getAsOfDate(),
        search: state.search,
        readiness_status: state.readiness_status || null,
        product_group_id: state.product_group_id || null,
        route_family_id: state.route_family_id || null,
        limit: state.limit,
        offset: state.offset,
      }),
      "Unable to load Route Readiness.",
    );
    if (current !== generation) return { ok: false, stale: true };
    state.loading = false;
    if (!response.ok) {
      state.readinessRows = [];
      state.total_count = 0;
      state.readinessLoadError =
        response.error?.message || "Route Readiness failed to load.";
      showToast?.(state.readinessLoadError, "error");
      return { ok: false, error: response.error };
    }
    const normalized = normalizeReadinessPayload(response.data);
    const page = clampPrmPagination({
      offset: state.offset,
      limit: state.limit,
      total_count: normalized.total_count,
    });
    state.offset = page.offset;
    state.page = page.pageIndex + 1;
    state.total_count = page.total_count;
    state.readinessRows = normalized.rows || [];
    applyExactRunStatusCounts(normalized.status_counts || {}, {
      isUnfiltered,
      pageTotal: normalized.total_count,
    });
    if (isUnfiltered) {
      state.exact_run_total = normalized.total_count;
    } else if (state.exact_run_total == null) {
      const baselineSum = sumPrmStatusCounts(state.status_counts_baseline);
      if (baselineSum > 0) state.exact_run_total = baselineSum;
    }
    rebuildReadinessPeqOptions();
    return { ok: true, total_count: state.total_count };
  }

  function applyExactRunStatusCounts(incoming, { isUnfiltered, pageTotal } = {}) {
    const counts =
      incoming && typeof incoming === "object" ? { ...incoming } : {};
    const keys = Object.keys(counts);
    if (isUnfiltered && keys.length) {
      state.status_counts_baseline = counts;
      state.status_counts = counts;
      return;
    }
    if (!keys.length) {
      state.status_counts = { ...(state.status_counts_baseline || {}) };
      return;
    }
    const sum = sumPrmStatusCounts(counts);
    const baselineSum = sumPrmStatusCounts(state.status_counts_baseline);
    const looksFullCompany =
      keys.length > 1 ||
      (state.exact_run_total != null && sum === state.exact_run_total) ||
      (baselineSum > 0 && sum === baselineSum) ||
      (pageTotal != null && sum > Number(pageTotal));
    if (looksFullCompany) {
      state.status_counts_baseline = counts;
      state.status_counts = counts;
      return;
    }
    // Filtered-only counts — keep baseline for primary chips.
    state.status_counts = { ...(state.status_counts_baseline || {}) };
  }

  async function loadRouteFamilies() {
    state.loading = true;
    const result = await loadMasterOptions({ catalogueScope: "unscoped" });
    state.loading = false;
    return result;
  }

  async function refreshRouteFamiliesAfterMutation({
    refreshFailureMessage = "Route Family updated, but the register could not be refreshed.",
  } = {}) {
    const result = await loadMasterOptions({ catalogueScope: "unscoped" });
    if (result?.stale && isPrmMasterOptionsReady(state.optionsStatus)) {
      if (state.activeLens === "route-families") {
        paintAcceptedPrmLens();
      }
      return { ok: true, data: state.options, stale: true };
    }
    if (state.activeLens === "route-families") {
      paintAcceptedPrmLens();
    }
    if (!result?.ok) {
      showToast?.(refreshFailureMessage, "warning", 5200);
    }
    return result;
  }

  async function loadMappingReview({ search = state.search } = {}) {
    if (!canView()) {
      state.permissionDenied = true;
      state.mappingReviewLoadError =
        "Permission denied. Mapping Review requires module:production-route-manager view.";
      state.mappingReviewPayload = null;
      state.mappingReviewGroups = [];
      return { ok: false, reason: "permission" };
    }
    state.permissionDenied = false;
    state.loading = true;
    state.mappingReviewLoadError = null;
    const ctx = PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT;
    const response = await invoke(
      RPC.mappingReview,
      buildMappingReviewCandidatesRpcArgs({
        period_start: ctx.period_start,
        valuation_date: ctx.valuation_date,
        refresh_run_id: ctx.refresh_run_id,
        as_of_date: getAsOfDate(),
        candidate_class: "SAME_GROUP_SINGLE_FAMILY_EVIDENCE",
        search: search || null,
        limit: 500,
        offset: 0,
      }),
      "Unable to load Route Family mapping review candidates.",
    );
    state.loading = false;
    if (!response.ok) {
      state.mappingReviewPayload = null;
      state.mappingReviewGroups = [];
      state.mappingReviewLoadError =
        response.error?.message ||
        "Unable to load Route Family mapping review candidates.";
      return response;
    }
    const payload = normalizePrmMappingReviewPayload(response.data);
    state.mappingReviewPayload = payload;
    state.mappingReviewGroups = aggregatePrmMappingReviewGroups(payload.rows);
    // Keep master options warm for Map Product Group handoff.
    await ensureMasterOptions();
    return { ok: true, data: payload };
  }

  async function loadFoundationReview({
    resetOffset = false,
    search = state.search,
  } = {}) {
    if (!canView()) {
      state.permissionDenied = true;
      state.foundationReviewLoadError =
        "Permission denied. Foundation Review requires module:production-route-manager view.";
      state.foundationReviewPayload = null;
      state.foundationReviewGroups = [];
      state.foundationTotalCount = 0;
      return { ok: false, reason: "permission" };
    }
    state.permissionDenied = false;
    state.loading = true;
    state.foundationReviewLoadError = null;
    if (resetOffset) {
      state.page = 1;
      state.offset = 0;
    }
    if (search != null) state.search = String(search || "").trim();
    const ctx = PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT;
    const response = await invoke(
      RPC.foundationReview,
      buildFoundationReviewRpcArgs({
        period_start: ctx.period_start,
        valuation_date: ctx.valuation_date,
        refresh_run_id: ctx.refresh_run_id,
        as_of_date: getAsOfDate(),
        search: state.search || null,
        limit: state.limit || 25,
        offset: state.offset || 0,
      }),
      "Unable to load Route Family foundation review.",
    );
    state.loading = false;
    if (!response.ok) {
      state.foundationReviewPayload = null;
      state.foundationReviewGroups = [];
      state.foundationTotalCount = 0;
      state.foundationReviewLoadError =
        response.error?.message ||
        "Unable to load Route Family foundation review.";
      return response;
    }
    const payload = normalizePrmFoundationReviewPayload(response.data);
    state.foundationReviewPayload = payload;
    state.foundationReviewGroups = payload.groups || [];
    const page = clampPrmPagination({
      offset: state.offset,
      limit: state.limit,
      total_count: payload.filtered_group_count,
    });
    state.offset = page.offset;
    state.page = page.pageIndex + 1;
    state.foundationTotalCount = page.total_count;
    state.total_count = page.total_count;
    await ensureMasterOptions();
    return { ok: true, data: payload, total_count: state.foundationTotalCount };
  }

  async function loadFamilyHistory(routeFamilyId) {
    const response = await invoke(
      RPC.familyHistory,
      buildRouteFamilyRouteHistoryArgs({ route_family_id: routeFamilyId }),
      "Unable to load family route history.",
    );
    if (!response.ok) return [];
    const history = normalizeRouteHistory(response.data);
    state.familyHistory = history.versions || [];
    state.selectedRouteFamilyId = routeFamilyId;
    return state.familyHistory;
  }

  async function loadProductHistory(productId) {
    const pid = normalizePrmIntegerId(productId);
    if (pid == null) return { ok: false, versions: [] };
    const response = await invoke(
      RPC.productHistory,
      buildProductRouteHistoryArgs({ product_id: pid }),
      "Unable to load Product route history.",
    );
    if (!response.ok) {
      state.productHistory = [];
      return { ok: false, versions: [], error: response.error };
    }
    const history = normalizeProductRouteHistory(response.data);
    state.productHistory = history.versions || [];
    return { ok: true, versions: state.productHistory };
  }

  async function loadEffective(productId, asOf = null) {
    const response = await invoke(
      RPC.effective,
      buildEffectiveRouteArgs({
        product_id: productId,
        as_of_date: asOf || getAsOfDate(),
      }),
      "Unable to load effective Product route.",
    );
    if (!response.ok) return response;
    state.effective = normalizeEffectiveRoute(response.data);
    state.selectedProductId = productId;
    return { ok: true, data: state.effective };
  }

  function createEmptyEffectiveViewer() {
    return {
      productId: null,
      source: null,
      payload: null,
      status: "empty",
      error: null,
      productHistory: [],
      familyHistory: [],
    };
  }

  function resetEffectiveViewer() {
    state.effectiveViewer = createEmptyEffectiveViewer();
  }

  function findEffectiveViewerProductRow(productId) {
    const id = normalizePrmIntegerId(productId);
    if (id == null) return {};
    return (
      (state.products || []).find(
        (item) => normalizePrmIntegerId(item.product_id ?? item.id) === id,
      ) || {}
    );
  }

  function findEffectiveViewerRouteFamilyRow(familyId) {
    const id = normalizePrmIntegerId(familyId);
    if (id == null) return {};
    return (
      (state.routeFamilies || []).find(
        (item) => normalizePrmIntegerId(item.route_family_id ?? item.id) === id,
      ) || {}
    );
  }

  async function loadEffectiveViewerProduct(productId, source = "user-select") {
    const pid = normalizePrmIntegerId(productId);
    if (pid == null) {
      resetEffectiveViewer();
      return { ok: false };
    }
    state.effectiveViewer = {
      ...createEmptyEffectiveViewer(),
      productId: pid,
      source,
      status: "loading",
    };
    const response = await invoke(
      RPC.effective,
      buildEffectiveRouteArgs({
        product_id: pid,
        as_of_date: getAsOfDate(),
      }),
      "Unable to load effective Product route.",
    );
    if (state.activeLens !== "effective-route-viewer") {
      return { ok: false, stale: true };
    }
    if (!response.ok) {
      state.effectiveViewer = {
        productId: pid,
        source,
        payload: null,
        status: "error",
        error:
          response.error ||
          response.errors?.join("; ") ||
          "Unable to load effective Product route.",
        productHistory: [],
        familyHistory: [],
      };
      return response;
    }
    const payload = normalizeEffectiveRoute(response.data);
    const routeFamilyId = normalizePrmIntegerId(payload?.route_family_id);
    const familyRouteId = resolvePrmEffectiveFamilyRouteId(payload);
    let productHistory = [];
    let familyHistory = [];
    const productHistoryResult = await loadProductHistory(pid);
    if (productHistoryResult.ok) {
      productHistory = productHistoryResult.versions || [];
    }
    if (routeFamilyId != null && familyRouteId != null) {
      familyHistory = (await loadFamilyHistory(routeFamilyId)) || [];
    }
    if (state.activeLens !== "effective-route-viewer") {
      return { ok: false, stale: true };
    }
    state.effectiveViewer = {
      productId: pid,
      source,
      payload,
      status: "ready",
      error: null,
      productHistory,
      familyHistory,
    };
    return { ok: true, data: payload };
  }

  function buildEffectiveViewerProductOptionsHtml(selectedId) {
    const selected = normalizePrmIntegerId(selectedId);
    const opts = ['<option value="">Search or select Product</option>'];
    for (const product of coercePrmList(state.products)) {
      const id = normalizePrmIntegerId(product.product_id ?? product.id);
      if (id == null) continue;
      const name = product.product_name || product.name || `Product ${id}`;
      const group =
        product.product_group_name ||
        formatPrmProductGroupHierarchyLabel(product) ||
        "";
      const search = [name, group, String(id)].filter(Boolean).join(" ");
      const title = group ? `${name} · ${group}` : name;
      opts.push(
        `<option value="${escapeHtml(id)}" data-primary="${escapeHtml(name)}" data-secondary="${escapeHtml(group)}" data-search="${escapeHtml(search)}" title="${escapeHtml(title)}"${selected === id ? " selected" : ""}>${escapeHtml(name)}</option>`,
      );
    }
    return opts.join("");
  }

  function viewerPlainText(value) {
    return isBlankPrmValue(value) ? "" : escapeHtml(value);
  }

  function formatEffectiveViewerRouteSourceSuffix(routeSource, productRouteId) {
    const upper = normalizePrmCode(routeSource).toUpperCase();
    const pid = normalizePrmIntegerId(productRouteId);
    if (upper === "ROUTE_FAMILY_ONLY" || (pid == null && upper.includes("FAMILY"))) {
      return humanizeUnknownPrmCode(routeSource) || "Route Family only";
    }
    if (pid != null) {
      const human = humanizeUnknownPrmCode(routeSource);
      if (human && !/^product route$/i.test(human)) return human;
      return "Product-specific";
    }
    return humanizeUnknownPrmCode(routeSource) || "";
  }

  function buildEffectiveViewerHeaderHtml(viewer = {}) {
    const payload = viewer.payload || {};
    const productRow = findEffectiveViewerProductRow(viewer.productId);
    const productName =
      productRow.product_name ||
      productRow.name ||
      (viewer.productId != null ? `Product ${viewer.productId}` : "");
    const routeFamilyId = normalizePrmIntegerId(payload.route_family_id);
    const familyRow = findEffectiveViewerRouteFamilyRow(routeFamilyId);
    const familyName =
      familyRow.route_family_name ||
      familyRow.name ||
      familyRow.route_family_code ||
      "";
    const productRouteId = normalizePrmIntegerId(payload.product_route_id);
    const productVersionCopy = formatPrmProductRouteVersionCopy(
      productRouteId,
      viewer.productHistory || [],
    );
    const familyRouteId = resolvePrmEffectiveFamilyRouteId(payload);
    const familyVersionCopy = formatPrmFamilyRouteVersionCopy(
      familyRouteId,
      viewer.familyHistory || [],
    );
    const routeSourceRaw =
      payload.route_source || payload.validation?.route_source || "";
    const routeSourceSuffix = formatEffectiveViewerRouteSourceSuffix(
      routeSourceRaw,
      productRouteId,
    );
    const readiness =
      payload.readiness_status || payload.route_readiness_status || "";
    const validationSummary = formatPrmRouteValidationSummary(payload.validation);
    const lines = [];
    if (productName) {
      lines.push(
        `<div class="cp-cell-primary">${viewerPlainText(productName)}</div>`,
      );
    }
    const productLine = [];
    if (productRouteId != null) {
      productLine.push(
        productVersionCopy
          ? `Product Route ${productVersionCopy}`
          : `Product Route ${productRouteId}`,
      );
    }
    if (routeSourceSuffix) productLine.push(routeSourceSuffix);
    if (productLine.length) {
      lines.push(
        `<div class="cp-muted-text">${viewerPlainText(productLine.join(" · "))}</div>`,
      );
    }
    const familyLine = [];
    if (familyName) familyLine.push(familyName);
    if (familyVersionCopy) familyLine.push(`Family Route ${familyVersionCopy}`);
    if (familyLine.length) {
      const familyTitle =
        routeFamilyId != null ? `Route family ${routeFamilyId}` : "";
      lines.push(
        `<div class="cp-muted-text"${familyTitle ? ` title="${viewerPlainText(familyTitle)}"` : ""}>${viewerPlainText(familyLine.join(" · "))}</div>`,
      );
    }
    const statusParts = [];
    if (readiness) {
      statusParts.push(formatPrmReadinessLabel(readiness) || readiness);
    }
    if (validationSummary && validationSummary !== "—") {
      statusParts.push(validationSummary);
    }
    if (statusParts.length) {
      lines.push(
        `<div class="cp-prm-effective-viewer-status">${statusParts.map((part) => `<span>${viewerPlainText(part)}</span>`).join(" · ")}</div>`,
      );
    }
    const validationErrors = listPrmRouteValidationErrors(payload.validation);
    const errorBlock = validationErrors.length
      ? `<ul class="cp-prm-validation-issues">${validationErrors
          .map((item) => `<li>${viewerPlainText(item)}</li>`)
          .join("")}</ul>`
      : "";
    return `<header class="cp-prm-editor-header cp-prm-effective-viewer-header">${lines.join("")}${errorBlock}</header>`;
  }

  function bindInputModalityTracking() {
    if (prmInputModalityBound || typeof document === "undefined") return;
    prmInputModalityBound = true;
    document.addEventListener(
      "pointerdown",
      () => {
        lastInputModality = "pointer";
      },
      true,
    );
    document.addEventListener(
      "keydown",
      () => {
        lastInputModality = "keyboard";
      },
      true,
    );
  }

  function bindPrmPopstate() {
    if (prmPopstateBound || typeof window === "undefined") return;
    prmPopstateBound = true;
    window.addEventListener("popstate", onPrmPopState);
  }

  function onPrmPopState() {
    if (disposed) return;
    const deepLink = applyDeepLinkFromUrl();
    const lens =
      new URLSearchParams(window.location.search).get("lens") ||
      getCurrentLens() ||
      PRODUCTION_ROUTE_DEFAULT_LENS;
    const resolved = resolveProductionRouteLens(lens, {
      family_route_id: deepLink.family_route_id,
      product_route_id: deepLink.product_route_id,
      product_id: deepLink.product_id,
    });
    if (typeof syncShellLens === "function") {
      syncShellLens(resolved);
    }
    void (async () => {
      const result = await load({ lens: resolved, deepLink });
      if (result?.stale === true || state.activeLens !== resolved) return;
      paintAcceptedPrmLens({ generation: result?.generation });
    })();
  }

  bindInputModalityTracking();
  bindPrmPopstate();

  function clearActiveRowHighlight() {
    clearPrmActiveRowClass(document, PRM_ACTIVE_ROW_CLASS);
  }

  function markActiveRowFromTrigger(trigger) {
    clearActiveRowHighlight();
    const row = trigger?.closest?.(".cp-prm-row");
    if (row) row.classList.add(PRM_ACTIVE_ROW_CLASS);
  }

  function isDetailsModalOpen() {
    const modal = document.getElementById("detailsModal");
    return Boolean(modal && !modal.classList.contains("hidden"));
  }

  function captureModalSnapshot() {
    return {
      title: document.getElementById("drawerTitle")?.textContent || "",
      subtitle: document.getElementById("drawerSubtitle")?.textContent || "",
      html: document.getElementById("drawerContent")?.innerHTML || "",
      cleanup: modalLayerCleanup,
    };
  }

  function isCostCentreSetupModalOpen() {
    const content = document.getElementById("drawerContent");
    return Boolean(
      prmOwnsDetailsModal &&
        isDetailsModalOpen() &&
        content?.querySelector?.("[data-prm-cost-centre-modal]"),
    );
  }

  function closeCostCentreSetupModal() {
    if (!isCostCentreSetupModalOpen()) return false;
    closeModal({ restorePrevious: false });
    return true;
  }

  function renderCostCentreRows(centres = []) {
    if (!centres.length) {
      return `<tr><td colspan="4"><div class="status">None listed.</div></td></tr>`;
    }
    const resourceCtx = prmResourceClassDisplayContext();
    return centres
      .map((centre) => {
        const resourceLabel = resolvePrmResourceClassDisplayLabel(
          centre.default_resource_class_code ||
            centre.resource_class ||
            centre.resource_class_code,
          {
            ...resourceCtx,
            rowLabel: centre.resource_class_label,
          },
        );
        return `<tr class="cp-prm-cost-centre-row">
        <td class="cp-prm-cc-code">${text(centre.code)}</td>
        <td><div class="cp-cell-primary">${text(centre.name || centre.code)}</div>${
          centre.type
            ? `<div class="cp-muted-text">${text(centre.type)}</div>`
            : ""
        }</td>
        <td title="${text(
          centre.default_resource_class_code ||
            centre.resource_class ||
            centre.resource_class_code,
          "",
        )}">${text(resourceLabel)}</td>
        <td>${text(centre.hierarchy || "—")}</td>
      </tr>`;
      })
      .join("");
  }

  function openCostCentreSetupModal() {
    const summary = resolvePrmCostCentreSetupChip({
      options: state.options,
      optionsStatus: state.optionsStatus,
      optionsError: state.optionsError,
    });
    const sharedCount = (summary.shared || []).length;
    const excludedCount = (summary.excluded || []).length;
    let body;
    if (summary.tone === "loading") {
      body = `<div class="cp-prm-cost-centre-modal" data-prm-cost-centre-modal>
          <div class="cp-prm-cc-metrics">
            <span class="cp-prm-badge">Loading…</span>
          </div>
          <p class="cp-muted-text" style="margin:0">${text(summary.tooltip)}</p>
        </div>`;
    } else if (summary.tone === "error") {
      body = `<div class="cp-prm-cost-centre-modal" data-prm-cost-centre-modal>
          <div class="cp-prm-cc-metrics">
            <span class="cp-prm-badge cp-prm-badge-warn">Unavailable</span>
          </div>
          <p class="cp-muted-text" style="margin:0">${text(summary.tooltip)}</p>
          <div class="cp-prm-form-actions" style="margin-top:10px">
            <button type="button" class="icon-btn" data-prm-retry-master-options>Retry</button>
          </div>
        </div>`;
    } else if (summary.setupRequired) {
      body = `<div class="cp-prm-cost-centre-modal" data-prm-cost-centre-modal>
          <div class="cp-prm-cc-metrics">
            <span class="cp-prm-badge cp-prm-badge-warn">Setup required</span>
            <span class="cp-prm-badge">Defined ${text(summary.defined, "0")}</span>
            <span class="cp-prm-badge">Approved ${text(summary.approved, "0")}</span>
          </div>
          <section class="cp-detail-section">
            <h3 class="cp-section-title">Can proceed</h3>
            <p class="cp-muted-text" style="margin:0">${text(summary.canProceed)}</p>
          </section>
          <section class="cp-detail-section">
            <h3 class="cp-section-title">Remains blocked</h3>
            <p class="cp-muted-text" style="margin:0">${text(summary.remainsBlocked)}</p>
          </section>
        </div>`;
    } else {
      body = `<div class="cp-prm-cost-centre-modal" data-prm-cost-centre-modal>
          <div class="cp-prm-cc-metrics">
            <span class="cp-prm-badge cp-prm-badge-ok">${text(summary.approved, "0")} approved</span>
            <span class="cp-prm-badge">Defined ${text(summary.defined, "0")}</span>
            <span class="cp-prm-badge">Shared ${text(sharedCount, "0")}</span>
            <span class="cp-prm-badge">Excluded ${text(excludedCount, "0")}</span>
          </div>
          <section class="cp-detail-section">
            <h3 class="cp-section-title">Shared-route centres</h3>
            <div class="cp-prm-cc-table-wrap">
              <table class="cp-prm-cc-table">
                <thead><tr><th>Code</th><th>Name</th><th>Resource</th><th>Location</th></tr></thead>
                <tbody>${renderCostCentreRows(summary.shared)}</tbody>
              </table>
            </div>
          </section>
          <section class="cp-detail-section">
            <h3 class="cp-section-title">Excluded boundary centres</h3>
            <div class="cp-prm-cc-table-wrap">
              <table class="cp-prm-cc-table">
                <thead><tr><th>Code</th><th>Name</th><th>Resource</th><th>Location</th></tr></thead>
                <tbody>${renderCostCentreRows(summary.excluded)}</tbody>
              </table>
            </div>
          </section>
          <p class="cp-prm-cc-policy">${text(summary.explain)}</p>
        </div>`;
    }
    openModal({
      title: "Production cost centres",
      subtitle:
        summary.tone === "loading"
          ? "Loading master options"
          : summary.tone === "error"
            ? "Master options unavailable"
            : summary.setupRequired
              ? "Setup required before governed route steps"
              : "Approved centres available for route governance",
      html: body,
      bind: (host) => {
        onModal(host, "click", async (event) => {
          const retry = event.target.closest("[data-prm-retry-master-options]");
          if (!retry) return;
          await withMutation(retry, async () => {
            const result = await loadMasterOptions();
            if (result?.ok) {
              closeModal({ restorePrevious: false });
              openCostCentreSetupModal();
            }
            return result;
          });
        });
      },
      cleanup: () => {
        hosts()
          .setup?.querySelector?.("[data-prm-setup]")
          ?.setAttribute?.("aria-expanded", "false");
      },
    });
    hosts()
      .setup?.querySelector?.("[data-prm-setup]")
      ?.setAttribute?.("aria-expanded", "true");
  }

  function renderSetupChip() {
    const host = hosts().setup;
    if (!host) return;
    const summary = resolvePrmCostCentreSetupChip({
      options: state.options,
      optionsStatus: state.optionsStatus,
      optionsError: state.optionsError,
    });
    host.classList.remove("hidden");
    const chipClass =
      summary.tone === "ok"
        ? "cp-prm-setup-chip cp-prm-setup-chip--ok"
        : summary.tone === "loading"
          ? "cp-prm-setup-chip cp-prm-setup-chip--loading"
          : "cp-prm-setup-chip";
    host.innerHTML = `<button type="button" class="${chipClass}" data-prm-setup
        title="${text(summary.tooltip)}"
        aria-label="${text(summary.chip)}. Open Cost Centres lens."
        aria-expanded="false"
        aria-haspopup="false">${text(summary.chip)}</button>`;
    on(host, "click", (event) => {
      const chip = event.target.closest("[data-prm-setup]");
      if (!chip) return;
      navigate("production-cost-centres");
    });
  }

  function attachPrmEscapeCapture() {
    if (prmEscapeCapture) return;
    prmEscapeCapture = (event) => {
      if (event.key !== "Escape") return;
      if (!prmOwnsDetailsModal) return;
      if (closeOpenSearchableSelectLists()) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      handleEscapeKey();
    };
    document.addEventListener("keydown", prmEscapeCapture, true);
  }

  function detachPrmEscapeCapture() {
    if (!prmEscapeCapture) return;
    document.removeEventListener("keydown", prmEscapeCapture, true);
    prmEscapeCapture = null;
  }

  function maybeDetachPrmEscapeCapture() {
    if (!prmOwnsDetailsModal) {
      detachPrmEscapeCapture();
    }
  }

  function restoreFocusAfterModalClose() {
    const target =
      modalReturnFocus &&
      modalReturnFocus !== document.body &&
      document.contains(modalReturnFocus)
        ? modalReturnFocus
        : null;
    const openerModality = modalOpenerModality || "keyboard";
    modalReturnFocus = null;
    modalOpenerModality = "keyboard";
    clearActiveRowHighlight();
    if (target && typeof target.focus === "function") {
      const focusOptions = buildPrmFocusRestoreOptions(openerModality);
      setTimeout(() => {
        try {
          target.focus(focusOptions);
        } catch {
          try {
            target.focus({ preventScroll: true });
          } catch {
            target.focus();
          }
        }
        if (openerModality === "pointer") {
          target.classList?.remove?.(PRM_ACTIVE_ROW_CLASS);
          clearActiveRowHighlight();
        }
      }, 0);
    }
  }

  async function restoreModalParent() {
    const parent = modalParent;
    modalParent = null;
    if (!parent) return false;
    if (parent.type === "family-summary" && parent.row) {
      await openFamilySummary(parent.row, { fromStackRestore: true });
      return true;
    }
    if (parent.type === "product-summary" && parent.row) {
      openProductSummary(parent.row, { fromStackRestore: true });
      return true;
    }
    return false;
  }

  function closeModal({ restorePrevious = true } = {}) {
    const modal = document.getElementById("detailsModal");
    if (!prmOwnsDetailsModal || !modal || modal.classList.contains("hidden")) {
      return false;
    }
    if (typeof modalLayerCleanup === "function") {
      try {
        modalLayerCleanup();
      } catch {
        /* ignore cleanup errors */
      }
      modalLayerCleanup = null;
    }
    unbindModalHandlers();
    if (restorePrevious && modalParent) {
      void restoreModalParent();
      return true;
    }
    modalStack.clear();
    modalParent = null;
    prmOwnsDetailsModal = false;
    clearWorkloadProductModalChrome(modal);
    const focused = document.activeElement;
    if (focused && modal.contains(focused) && typeof focused.blur === "function") {
      focused.blur();
    }
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    const content = document.getElementById("drawerContent");
    if (content) content.innerHTML = "";
    restoreFocusAfterModalClose();
    restoreWorkloadPreviewScroll();
    maybeDetachPrmEscapeCapture();
    return true;
  }

  function clearWorkloadProductModalChrome(modal = document.getElementById("detailsModal")) {
    const windowEl = modal?.querySelector?.(".modal-window");
    windowEl?.classList?.remove(
      "cp-prm-modal-window--wide",
      "cp-prm-modal-window--workload-summary",
      "cp-prm-modal-window--product-summary",
    );
    modal?.classList?.remove(
      "cp-prm-modal-overlay--workload-summary",
      "cp-prm-modal-overlay--product-summary",
    );
    state.workloadExplainPayload = null;
    state.workloadExplainProductId = null;
    state.workloadExplainInflight = null;
    state.workloadExplainError = null;
    state.workloadExplainGeneration = 0;
  }

  function captureWorkloadPreviewScroll() {
    const wrap = hosts().tableWrap;
    if (!wrap) {
      state.workloadScrollTop = null;
      return;
    }
    state.workloadScrollTop = wrap.scrollTop;
  }

  function restoreWorkloadPreviewScroll() {
    if (state.workloadScrollTop == null) return;
    const top = state.workloadScrollTop;
    state.workloadScrollTop = null;
    requestAnimationFrame(() => {
      const wrap = hosts().tableWrap;
      if (wrap) wrap.scrollTop = top;
    });
  }

  function setWorkloadWideModal(enabled) {
    const modal = document.getElementById("detailsModal");
    const windowEl = modal?.querySelector?.(".modal-window");
    if (!windowEl) return;
    windowEl.classList.toggle("cp-prm-modal-window--wide", !!enabled);
    windowEl.classList.toggle(
      "cp-prm-modal-window--workload-summary",
      !!enabled,
    );
    modal.classList.toggle("cp-prm-modal-overlay--workload-summary", !!enabled);
  }

  function setProductSummaryWideModal(enabled) {
    const modal = document.getElementById("detailsModal");
    const windowEl = modal?.querySelector?.(".modal-window");
    if (!windowEl) return;
    windowEl.classList.toggle("cp-prm-modal-window--wide", !!enabled);
    windowEl.classList.toggle(
      "cp-prm-modal-window--product-summary",
      !!enabled,
    );
    modal.classList.toggle("cp-prm-modal-overlay--product-summary", !!enabled);
  }

  function applyModalContent({
    title,
    subtitle = "",
    html = "",
    bind = null,
    cleanup = null,
  }) {
    const modal = document.getElementById("detailsModal");
    const titleEl = document.getElementById("drawerTitle");
    const subtitleEl = document.getElementById("drawerSubtitle");
    const tabs = document.getElementById("drawerTabs");
    const content = document.getElementById("drawerContent");
    if (!modal || !content) return;
    unbindModalHandlers();
    destroySearchableSelectsIn(content);
    if (titleEl) titleEl.textContent = title || "Details";
    if (subtitleEl) subtitleEl.textContent = subtitle;
    if (tabs) tabs.innerHTML = "";
    content.innerHTML = html;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    modalLayerCleanup = typeof cleanup === "function" ? cleanup : null;
    if (typeof bind === "function") bind(content);
  }

  function openModal(
    { title, subtitle = "", html = "", bind = null, cleanup = null } = {},
    { nested = false, replace = false, fromStackRestore = false } = {},
  ) {
    const modal = document.getElementById("detailsModal");
    if (!modal) return;
    if (fromStackRestore) {
      prmOwnsDetailsModal = true;
      attachPrmEscapeCapture();
      applyModalContent({ title, subtitle, html, bind, cleanup });
      return;
    }
    const wasOpen = isDetailsModalOpen() && prmOwnsDetailsModal;
    if (wasOpen && nested && !replace) {
      modalStack.push(captureModalSnapshot());
    } else if (!wasOpen) {
      modalStack.clear();
      modalParent = null;
      bindInputModalityTracking();
      modalOpenerModality = lastInputModality === "pointer" ? "pointer" : "keyboard";
      modalReturnFocus = document.activeElement;
      markActiveRowFromTrigger(modalReturnFocus);
    } else if (replace) {
      modalStack.clear();
      modalParent = null;
    }
    prmOwnsDetailsModal = true;
    attachPrmEscapeCapture();
    applyModalContent({ title, subtitle, html, bind, cleanup });
  }

  function handleEscapeKey() {
    if (prmOwnsDetailsModal && isDetailsModalOpen()) {
      closeModal({ restorePrevious: true });
      return true;
    }
    return false;
  }

  /** Shared PRM form field markup aligned with detail-grid / section patterns. */
  function formField({
    id,
    label,
    type = "text",
    value = "",
    placeholder = "",
    rows = 3,
    full = false,
    required = false,
    optionsHtml = null,
    hint = "",
    dataField = "",
    readonly = false,
    disabled = false,
  } = {}) {
    const req = required ? " required" : "";
    const ro = readonly ? " readonly" : "";
    const dis = disabled ? " disabled" : "";
    const fullClass = full ? " cp-prm-form-field--full" : "";
    const dataAttr = dataField
      ? ` data-prm-map-field="${text(dataField)}" data-prm-edit-mapping-field="${text(dataField)}"`
      : "";
    let control = "";
    if (type === "textarea") {
      control = `<textarea id="${text(id)}" name="${text(id)}"${dataAttr} rows="${Number(rows) || 3}" placeholder="${text(placeholder)}"${req}${ro}${dis}>${text(value, "")}</textarea>`;
    } else if (type === "select") {
      control = `<select id="${text(id)}" name="${text(id)}"${dataAttr}${req}${dis}>${optionsHtml || ""}</select>`;
    } else {
      control = `<input id="${text(id)}" name="${text(id)}"${dataAttr} type="${text(type)}" value="${text(value, "")}" placeholder="${text(placeholder)}"${req}${ro}${dis} />`;
    }
    return `<label class="cp-prm-form-field${fullClass}" for="${text(id)}"><span class="cp-field-label">${text(label)}</span>${control}${
      hint ? `<span class="cp-prm-field-hint">${text(hint)}</span>` : ""
    }</label>`;
  }

  function formShell({
    notice = "",
    sectionTitle = "Details",
    fieldsHtml = "",
    actionsHtml = "",
    extraClass = "",
  } = {}) {
    const className = ["cp-prm-summary", "cp-prm-form", extraClass]
      .filter(Boolean)
      .join(" ");
    return `<div class="${className}">
      ${notice ? `<p class="cp-prm-form-notice">${notice}</p>` : ""}
      <section class="cp-detail-section">
        ${
          sectionTitle
            ? `<h3 class="cp-section-title">${text(sectionTitle)}</h3>`
            : ""
        }
        <div class="cp-detail-grid cp-detail-grid--2col">${fieldsHtml}</div>
      </section>
      <div class="cp-prm-form-actions">${actionsHtml}</div>
    </div>`;
  }

  costCentres = createProductionCostCentresController({
    governed,
    showToast,
    canEdit,
    openModal,
    closeModal,
    onModal,
    withMutation,
    formField,
    formShell,
    getAsOfDate,
    loadMasterOptions,
    getOptions: () => state.options,
    getSearch: () => state.search,
    isActiveLens: () => state.activeLens === "production-cost-centres",
    clearLensOwnedDom,
    hosts,
    bindRows,
    on,
    onRegisterRefreshed: () => {
      if (state.activeLens === "production-cost-centres") {
        paintAcceptedPrmLens();
      }
    },
  });

  const subgroupArchive = createPrmSubgroupArchiveController({
    state,
    invoke,
    governed,
    canView,
    canEdit,
    showToast,
    openModal,
    closeModal,
    isDetailsModalOpen,
    formShell,
    formField,
    onModal,
    withMutation,
    chip,
    getAsOfDate,
    ensureMasterOptions,
    onRegisterRefreshed: () => {
      if (state.activeLens === "product-subgroup-mappings") {
        paintAcceptedPrmLens();
      }
    },
    hosts,
    on,
    buildEffectiveStepsTableHtml,
  });

  function openCandidateReviewModal(review) {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (confirmed) => {
        if (settled) return;
        settled = true;
        closeModal({ restorePrevious: true });
        resolve(confirmed);
      };
      openModal(
        {
          title: review.title || "Review candidate evidence",
          subtitle: "Confirmation required",
          html: `<div class="cp-prm-summary">
          <p>${text(review.message)}</p>
          <div class="cp-detail-section"><pre>${text(
            JSON.stringify(review.prefill || {}, null, 2),
            "",
          )}</pre></div>
          <div class="cp-prm-actions">
            <button type="button" class="icon-btn" data-prm-stage-evidence>Stage evidence for later review</button>
            <button type="button" class="icon-btn icon-btn-primary" data-prm-confirm-candidate>Confirm use in draft</button>
          </div>
        </div>`,
          bind: (host) => {
            onModal(host, "click", (event) => {
              if (event.target.closest("[data-prm-confirm-candidate]")) {
                settle(true);
              } else if (event.target.closest("[data-prm-stage-evidence]")) {
                settle(false);
              }
            });
          },
          cleanup: () => {
            if (!settled) {
              settled = true;
              resolve(false);
            }
          },
        },
        { nested: isDetailsModalOpen() },
      );
    });
  }

  function chip(code) {
    const upper = normalizePrmCode(code).toUpperCase();
    if (!upper) {
      return `<span class="cp-prm-badge">—</span>`;
    }
    const tone = getPrmReadinessTone(code);
    const label =
      formatPrmReadinessLabel(code) ||
      formatPrmRouteStatusLabel(code) ||
      formatPrmValidationLabel(code) ||
      code;
    let toneClass = "";
    if (tone === "ready") toneClass = " cp-prm-badge-ok";
    else if (tone === "review") toneClass = " cp-prm-badge-warn";
    else if (tone === "blocked") toneClass = " cp-prm-badge-danger";
    const title = `${upper} — ${label}`;
    if (tone === "unknown" && typeof statusChip === "function") {
      const fallback = statusChip(normalizeStatus?.(upper) || upper);
      if (fallback) return fallback;
    }
    return `<span class="cp-prm-badge${toneClass}" title="${text(title)}">${text(label)}</span>`;
  }

  function prmResourceClassDisplayContext() {
    const catalogue = state.options?.resource_classes || [];
    return {
      catalogue,
      catalogueIndex: buildPrmResourceClassLabelIndex(catalogue),
    };
  }

  function resolvePrmResourceClassCellLabel(step = {}, rawValue = null) {
    const code = normalizePrmCode(
      step.resource_class_code ||
        step.resource_class ||
        rawValue,
    );
    return resolvePrmResourceClassDisplayLabel(code, {
      ...prmResourceClassDisplayContext(),
      rowLabel: rawValue,
    });
  }

  function stepFieldValue(step = {}, def) {
    if (!def) return null;
    if (!isBlankPrmValue(step[def.key])) return step[def.key];
    for (const alt of def.alts || []) {
      if (!isBlankPrmValue(step[alt])) return step[alt];
    }
    return null;
  }

  function selectEffectiveStepColumns(steps = []) {
    const list = coercePrmList(steps);
    return PRM_EFFECTIVE_STEP_FIELD_DEFS.filter((def) =>
      list.some((step) => !isBlankPrmValue(stepFieldValue(step, def))),
    );
  }

  function formatEffectiveStepCell(def, value, step = {}) {
    if (isBlankPrmValue(value)) return "—";
    if (def.key === "step_source") {
      return formatPrmStepSourceLabel(value) || value;
    }
    if (
      def.key === "resource_class_name" ||
      (def.alts || []).some((alt) =>
        ["resource_class", "resource_class_code"].includes(alt),
      )
    ) {
      return resolvePrmResourceClassCellLabel(step, value);
    }
    return value;
  }

  function buildEffectiveStepsTableHtml(steps = []) {
    const list = coercePrmList(steps);
    if (!list.length) {
      return `<p class="cp-muted-text">No effective steps.</p>`;
    }
    const cols = selectEffectiveStepColumns(list);
    if (!cols.length) {
      return `<p class="cp-muted-text">Effective steps returned without displayable fields.</p>`;
    }
    return `<div class="cp-prm-step-table-wrap"><table class="cp-prm-step-table">
      <thead><tr>${cols.map((col) => `<th>${text(col.label)}</th>`).join("")}</tr></thead>
      <tbody>${list
        .map(
          (step) =>
            `<tr>${cols
              .map(
                (col) =>
                  `<td>${text(formatEffectiveStepCell(col, stepFieldValue(step, col), step))}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("")}</tbody>
    </table></div>`;
  }

  function productSummaryMetaCell(label, valueHtml, extras = {}) {
    const full = extras.full ? " cp-prm-product-summary-meta-cell--full" : "";
    const field = extras.field
      ? ` data-prm-summary-field="${text(extras.field)}"`
      : "";
    const title = extras.title ? ` title="${text(extras.title)}"` : "";
    return `<div class="cp-prm-product-summary-meta-cell${full}"${field}${title}><div class="cp-field-label">${text(label)}</div><div class="cp-prm-product-summary-meta-value">${valueHtml}</div></div>`;
  }

  function mergeProductSummaryCanonicalRow(identityRow = {}, effective = {}) {
    const familyRouteId = resolvePrmEffectiveFamilyRouteId(effective);
    return {
      ...identityRow,
      readiness_status:
        effective?.readiness_status ||
        effective?.route_readiness_status ||
        null,
      route_source:
        effective?.route_source || effective?.validation?.route_source || null,
      route_family_id:
        effective?.route_family_id ?? identityRow?.route_family_id ?? null,
      family_route_id: familyRouteId,
      base_route_family_route_id:
        effective?.base_route_family_route_id ?? familyRouteId,
      product_route_id: effective?.product_route_id ?? null,
      route_validation: effective?.validation ?? null,
    };
  }

  function buildProductSummarySnapshotHtml(
    identityRow = {},
    effective = {},
    historyRows = [],
  ) {
    const familyRouteId = resolvePrmEffectiveFamilyRouteId(effective);
    const versionCopy = formatPrmFamilyRouteVersionCopy(
      familyRouteId,
      historyRows,
    );
    const productRouteId = normalizePrmIntegerId(effective?.product_route_id);
    const routeSourceRaw =
      effective?.route_source || effective?.validation?.route_source || "";
    const routeSourceLabel =
      humanizeUnknownPrmCode(routeSourceRaw) || routeSourceRaw || "—";
    const assignmentRaw = resolvePrmRouteFamilyAssignmentSource(identityRow);
    const assignmentLabel =
      formatPrmRouteFamilyAssignmentSourceLabel(assignmentRaw) || "—";
    const readiness =
      effective?.readiness_status || effective?.route_readiness_status;
    const familyName =
      identityRow.route_family_name || identityRow.route_family_code || "—";
    const uom = identityRow.base_uom || identityRow.product_base_uom;
    return `<div class="cp-prm-product-summary-meta" data-prm-product-snapshot>
      ${productSummaryMetaCell("Product", `<span class="cp-cell-primary">${text(identityRow.product_name)}</span>`, { field: "product" })}
      ${productSummaryMetaCell("Product Group", text(formatPrmProductGroupHierarchyLabel(identityRow) || identityRow.product_group_name), { field: "product-group" })}
      ${productSummaryMetaCell("Base UOM", text(uom), { field: "base-uom" })}
      ${productSummaryMetaCell("Preferred Batch Size", text(identityRow.preferred_batch_size), { field: "preferred-batch-size" })}
      ${productSummaryMetaCell("Route Family", text(familyName), {
        field: "route-family",
        title:
          identityRow.route_family_id != null
            ? `Route family ${identityRow.route_family_id}`
            : "",
      })}
      ${productSummaryMetaCell("Assignment Source", text(assignmentLabel), {
        field: "assignment-source",
        title: [
          String(assignmentRaw || ""),
          formatPrmRouteAssignmentSourceExplain(assignmentRaw),
        ]
          .filter(Boolean)
          .join(" — "),
      })}
      ${productSummaryMetaCell("Effective Route Source", text(routeSourceLabel), {
        field: "route-source",
        title: String(routeSourceRaw || ""),
      })}
      ${productSummaryMetaCell(
        "Family Route / Version",
        text(versionCopy || (familyRouteId != null ? String(familyRouteId) : "—")),
        {
          field: "family-route",
          title: familyRouteId != null ? `Family route ${familyRouteId}` : "",
        },
      )}
      ${productSummaryMetaCell(
        "Product Route / Version",
        text(productRouteId == null ? "None" : productRouteId),
        { field: "product-route" },
      )}
      ${productSummaryMetaCell("Readiness", chip(readiness), {
        field: "readiness",
      })}
      ${productSummaryMetaCell(
        "Validation",
        routeValidationDetailHtml(effective?.validation),
        { field: "validation" },
      )}
      ${productSummaryMetaCell("Commercial hierarchy", text(hierarchy(identityRow)), {
        field: "hierarchy",
        full: true,
      })}
    </div>`;
  }

  function buildEffectiveRoutePanelHtml(effective) {
    if (!effective) {
      return `<p class="cp-muted-text">No effective route returned.</p>`;
    }
    const steps = coercePrmList(effective.steps || effective.effective_steps);
    const routeSourceRaw =
      effective.route_source || effective.validation?.route_source || "";
    const routeSourceLabel =
      humanizeUnknownPrmCode(routeSourceRaw) || routeSourceRaw || "—";
    const familyRouteId = resolvePrmEffectiveFamilyRouteId(effective);
    const metaCell = (label, valueHtml, { title = "" } = {}) =>
      `<div class="cp-prm-workload-effective-meta-cell"${
        title ? ` title="${text(title, title)}"` : ""
      }><div class="cp-field-label">${text(label)}</div><div class="cp-prm-workload-effective-meta-value">${valueHtml}</div></div>`;
    return `<div class="cp-prm-workload-effective-meta" data-prm-effective-meta>
      ${metaCell("Route Family ID", text(effective.route_family_id))}
      ${metaCell("Family Route ID", text(familyRouteId), {
        title: familyRouteId != null ? `Family route ${familyRouteId}` : "",
      })}
      ${metaCell("Product Route ID", text(effective.product_route_id))}
      ${metaCell("Route Source", text(routeSourceLabel), {
        title: String(routeSourceRaw || ""),
      })}
      ${metaCell(
        "Readiness",
        chip(effective.readiness_status || effective.route_readiness_status),
      )}
      ${metaCell("Validation", routeValidationDetailHtml(effective.validation))}
    </div>
    <h4 class="cp-section-title">Ordered steps</h4>
    ${buildEffectiveStepsTableHtml(steps)}`;
  }

  function buildCandidateAdvisoryHtml(normalized) {
    const steps = coercePrmList(normalized?.candidate_steps);
    return `<div class="cp-prm-candidate-advisory" data-prm-candidate-advisory>
      <p class="cp-prm-form-notice">${text(PRM_CANDIDATE_ADVISORY_LABEL)}</p>
      <div class="cp-muted-text">${text(
        normalized?.product?.product_name ||
          normalized?.product?.name ||
          normalized?.summary?.product_name,
      )}</div>
      <div class="cp-prm-cards">${
        steps.length
          ? steps
              .map(
                (step, index) => `<article class="cp-prm-card">
            <div class="cp-cell-primary">${text(
              step.step_key ||
                step.activity ||
                step.activity_name ||
                `Step ${index + 1}`,
            )}</div>
            <div class="cp-muted-text">${text(
              step.activity || step.activity_name || step.step_key,
            )}</div>
          </article>`,
              )
              .join("")
          : `<div class="status">No candidate steps.</div>`
      }</div>
    </div>`;
  }

  function isRouteBlockedReadiness(code) {
    const upper = normalizePrmCode(code).toUpperCase();
    return PRM_ROUTE_BLOCKED_READINESS.includes(upper);
  }

  function routeValidationDetailHtml(validation) {
    const summary = formatPrmRouteValidationSummary(validation);
    const tone = getPrmRouteValidationTone(summary);
    const toneClass =
      tone === "ok"
        ? " cp-prm-badge-ok"
        : tone === "blocked"
          ? " cp-prm-badge-danger"
          : "";
    const errors = listPrmRouteValidationErrors(validation);
    return `<div class="cp-prm-validation-detail">
      ${
        summary === "—"
          ? `<span class="cp-muted-text">—</span>`
          : `<span class="cp-prm-badge${toneClass}">${text(summary)}</span>`
      }
      ${
        errors.length
          ? `<ul class="cp-prm-validation-issues">${errors
              .map((item) => `<li>${text(item)}</li>`)
              .join("")}</ul>`
          : ""
      }
    </div>`;
  }

  function readinessCellHtml(row, def) {
    const value = getPrmReadinessCellValue(row, def);
    if (def.key === "readiness_status") return chip(value);
    if (def.key === "product_name") {
      return `<div class="cp-cell-primary">${text(value)}</div>`;
    }
    if (def.key === "route_validation") {
      const summary = formatPrmRouteValidationSummary(value);
      if (summary === "—") {
        return `<span class="cp-muted-text">—</span>`;
      }
      const tone = getPrmRouteValidationTone(summary);
      const toneClass =
        tone === "ok"
          ? " cp-prm-badge-ok"
          : tone === "blocked"
            ? " cp-prm-badge-danger"
            : "";
      return `<span class="cp-prm-badge${toneClass}" title="${text(summary)}">${text(summary)}</span>`;
    }
    if (def.key === "route_status") {
      return text(formatPrmRouteStatusLabel(value) || value);
    }
    return text(value);
  }

  function exactRunContextHtml(context = PRM_EXACT_RUN_CONTEXT) {
    return `<p class="cp-muted-text cp-prm-exact-run" data-prm-exact-run>${text(
      formatPrmExactRunContextCue(context),
    )}</p>`;
  }

  function readinessAsOfContextHtml() {
    const asOf =
      formatPrmDayMonthYearLabel(getAsOfDate()) || getAsOfDate() || "—";
    return `<p class="cp-muted-text cp-prm-readiness-asof" data-prm-readiness-asof>${text(
      `Effective manufacturing-route readiness as of ${asOf}`,
    )}</p>`;
  }

  function syncPrmAsOfDateChrome() {
    const wrap = document.getElementById("prmAsOfDateWrap");
    const input = document.getElementById("prmAsOfDate");
    if (!wrap || !input) return;
    const workloadExactRunLens = state.activeLens === "shared-workload-preview";
    const exactRunTitle =
      "Workload Preview uses fixed Run 82 context (period 2026-08-01 · valued 2026-08-07).";
    const readinessTitle =
      "Route Readiness uses the selected effective/as-of date for manufacturing-route DQ discovery.";
    const defaultTitle = "Route as-of date (not Costing period)";
    if (workloadExactRunLens) {
      input.disabled = true;
      input.setAttribute("aria-disabled", "true");
      wrap.title = exactRunTitle;
      input.title = exactRunTitle;
      wrap.classList.add("cp-prm-asof-disabled");
    } else {
      input.disabled = false;
      input.removeAttribute("aria-disabled");
      wrap.title =
        state.activeLens === "route-readiness" ? readinessTitle : defaultTitle;
      input.title =
        state.activeLens === "route-readiness" ? readinessTitle : defaultTitle;
      wrap.classList.remove("cp-prm-asof-disabled");
    }
  }

  function applyPrmDeepLinkToUrl(resolvedLens, params = {}, replace = false) {
    const url = new URL(window.location.href);
    url.searchParams.set("lens", resolvedLens);
    for (const key of PRM_DEEP_LINK_KEYS) {
      const value = params[key];
      if (value == null || value === "") url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    }
    if (resolvedLens === "route-family-route-editor") {
      url.searchParams.delete("product_route_id");
      url.searchParams.delete("product_id");
    }
    if (resolvedLens === "product-route-editor") {
      url.searchParams.delete("family_route_id");
    }
    if (resolvedLens === "effective-route-viewer") {
      if (params.product_id == null || params.product_id === "") {
        url.searchParams.delete("product_id");
      }
    }
    const href = url.toString();
    if (replace) window.history.replaceState({}, "", href);
    else window.history.pushState({}, "", href);
    return href;
  }

  function navigate(lens, params = {}, replace = false) {
    const familyRouteId = normalizePrmIntegerId(params.family_route_id);
    const productRouteId = normalizePrmIntegerId(params.product_route_id);
    const productId = normalizePrmIntegerId(params.product_id);
    const routeFamilyId = normalizePrmIntegerId(params.route_family_id);
    const requestedLens = String(lens || "").trim();
    const allowEditorWithoutId =
      (requestedLens === "route-family-route-editor" &&
        familyRouteId == null) ||
      requestedLens === "product-route-editor";
    const resolved = resolveProductionRouteLens(lens, {
      family_route_id: familyRouteId,
      product_route_id: productRouteId,
      product_id: productId,
      allowEditorWithoutId,
    });
    const nextParams = { ...params };
    if (familyRouteId != null) nextParams.family_route_id = familyRouteId;
    else delete nextParams.family_route_id;
    if (productRouteId != null) nextParams.product_route_id = productRouteId;
    else delete nextParams.product_route_id;
    if (routeFamilyId != null) nextParams.route_family_id = routeFamilyId;
    else if (params.route_family_id == null || params.route_family_id === "") {
      delete nextParams.route_family_id;
    }
    if (resolved === "route-family-route-editor") {
      delete nextParams.product_route_id;
      delete nextParams.product_id;
    }
    if (resolved === "product-route-editor") {
      delete nextParams.family_route_id;
    }
    if (resolved === "effective-route-viewer") {
      if (productId == null) {
        delete nextParams.product_id;
        resetEffectiveViewer();
      }
    }
    if (
      resolved === "product-subgroup-mappings" ||
      resolved === "archived-routes"
    ) {
      delete nextParams.family_route_id;
      delete nextParams.product_route_id;
      delete nextParams.product_id;
      state.selectedFamilyRouteId = null;
      state.selectedProductRouteId = null;
      state.productRouteCreateHandoff = null;
      state.productRouteReentryChooser = null;
    }
    if (resolved === "product-subgroup-mappings") {
      const subgroupId = normalizePrmIntegerId(params.product_subgroup_id);
      if (subgroupId != null) nextParams.product_subgroup_id = subgroupId;
      else delete nextParams.product_subgroup_id;
      delete nextParams.entity_type;
    }
    if (resolved === "archived-routes") {
      delete nextParams.product_subgroup_id;
      delete nextParams.mapping_id;
      if (params.entity_type) {
        nextParams.entity_type = normalizePrmCode(params.entity_type).toUpperCase();
      } else {
        delete nextParams.entity_type;
      }
    }
    if (resolved === "route-families" && routeFamilyId != null) {
      pendingOpenRouteFamilyId = routeFamilyId;
    } else if (
      resolved === "route-family-route-editor" ||
      resolved === "product-route-editor"
    ) {
      pendingOpenRouteFamilyId = null;
    }

    const onPrmPage =
      typeof window !== "undefined" &&
      /production-route-manager/i.test(window.location?.pathname || "");

    if (onPrmPage && typeof window.history?.replaceState === "function") {
      // Always leave the details modal before changing lens/host.
      modalParent = null;
      closeModal({ restorePrevious: false });
      applyPrmDeepLinkToUrl(resolved, nextParams, replace);
      state.deepLink = applyDeepLinkFromUrl();
      if (resolved === "route-family-route-editor") {
        state.selectedFamilyRouteId = familyRouteId;
        state.selectedProductRouteId = null;
        state.selectedProductId = null;
        if (routeFamilyId != null) {
          state.selectedRouteFamilyId = routeFamilyId;
          state.familyRouteCreateFamilyId = routeFamilyId;
        } else if (familyRouteId == null) {
          state.selectedFamilyRouteId = null;
        }
      } else if (resolved === "product-route-editor") {
        state.selectedProductRouteId = productRouteId;
        state.selectedProductId = productId;
        state.selectedFamilyRouteId = null;
        // Create context (product_id, no product_route_id): preserve handoff.
        if (
          !isPrmProductRouteEditorCreateContext({
            product_id: productId,
            product_route_id: productRouteId,
          })
        ) {
          state.productRouteCreateHandoff = null;
        }
      } else {
        state.selectedFamilyRouteId = null;
        state.selectedProductRouteId = null;
        state.productRouteCreateHandoff = null;
        state.productRouteReentryChooser = null;
      }
      // Soft-nav owns load/paint; block competing switchLens/loadRowsForLens.
      if (typeof beginPrmSoftNavLock === "function") {
        beginPrmSoftNavLock(resolved);
      }
      // Keep shell CURRENT_LENS / pills aligned with soft navigation.
      if (typeof syncShellLens === "function") {
        syncShellLens(resolved);
      }
      const loadPromise = (async () => {
        try {
          let result = await load({
            lens: resolved,
            deepLink: state.deepLink,
          });
          // One retry when a competing generation raced the soft-nav load.
          if (
            (result?.stale === true || state.activeLens !== resolved) &&
            typeof applyDeepLinkFromUrl === "function"
          ) {
            state.deepLink = applyDeepLinkFromUrl();
            result = await load({
              lens: resolved,
              deepLink: state.deepLink,
            });
          }
          if (result?.stale === true || state.activeLens !== resolved) {
            showToast?.(
              "Could not open the selected view. Use the lens tabs if the editor did not appear.",
              "warning",
              5200,
            );
            return { ok: false, stale: true };
          }
          // Re-assert shell chrome immediately before paint so readiness cannot win.
          if (typeof syncShellLens === "function") {
            syncShellLens(resolved);
          }
          paintAcceptedPrmLens({ generation: result?.generation });
          if (typeof syncShellLens === "function") {
            syncShellLens(resolved);
          }
          return result;
        } finally {
          if (typeof endPrmSoftNavLock === "function") {
            endPrmSoftNavLock();
          }
        }
      })();
      return loadPromise;
    }

    if (typeof navigateToCostingRoute === "function") {
      navigateToCostingRoute(
        PRODUCTION_ROUTE_MODULE_KEY,
        { lens: resolved, ...nextParams },
        { replace },
      );
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("lens", resolved);
    for (const [key, value] of Object.entries(nextParams)) {
      if (value == null || value === "") url.searchParams.delete(key);
      else url.searchParams.set(key, String(value));
    }
    if (resolved === "route-family-route-editor") {
      url.searchParams.delete("product_route_id");
      url.searchParams.delete("product_id");
    }
    if (resolved === "effective-route-viewer") {
      if (params.product_id == null || params.product_id === "") {
        url.searchParams.delete("product_id");
      }
    }
    if (replace) window.location.replace(url.toString());
    else window.location.href = url.toString();
  }

  async function navigateToFamilyRouteEditor({
    route_family_id = null,
    family_route_id = null,
    replace = false,
  } = {}) {
    const nav = resolveFamilyRouteCreateNavigation(
      { family_route_id },
      route_family_id,
    );
    const params =
      nav?.params ||
      buildFamilyRouteEditorNavParams({ route_family_id, family_route_id });
    if (!params?.family_route_id) {
      showToast?.(
        "Created Family route ID was missing from the server response.",
        "error",
      );
      return { ok: false, reason: "missing_family_route_id" };
    }
    familyRouteOpenGeneration += 1;
    modalParent = null;
    closeModal({ restorePrevious: false });
    state.selectedFamilyRouteId = params.family_route_id;
    state.selectedProductRouteId = null;
    state.selectedProductId = null;
    if (params.route_family_id != null) {
      state.selectedRouteFamilyId = params.route_family_id;
      state.familyRouteCreateFamilyId = params.route_family_id;
    }
    state.deepLink = {
      ...(state.deepLink || {}),
      route_family_id: params.route_family_id,
      family_route_id: params.family_route_id,
    };
    // Canonical Family editor deep link: never carry Product route ids.
    const navResult = navigate(
      "route-family-route-editor",
      {
        route_family_id: params.route_family_id,
        family_route_id: params.family_route_id,
      },
      replace,
    );
    if (navResult && typeof navResult.then === "function") {
      return navResult;
    }
    return { ok: true, family_route_id: params.family_route_id };
  }

  async function openCreatedFamilyRoute({
    route_family_id = null,
    family_route_id = null,
  } = {}) {
    const familyRouteId = normalizePrmIntegerId(family_route_id);
    const routeFamilyId = normalizePrmIntegerId(route_family_id);
    if (familyRouteId == null) {
      showToast?.(
        "Created Family route ID was missing from the server response.",
        "error",
      );
      return { ok: false, reason: "missing_family_route_id" };
    }
    const result = await navigateToFamilyRouteEditor({
      route_family_id: routeFamilyId,
      family_route_id: familyRouteId,
      replace: true,
    });
    const detail = editor.getFamilyState?.()?.detail || {};
    const openedId =
      normalizePrmIntegerId(detail.family_route_id) ??
      normalizePrmIntegerId(detail.route_family_route_id) ??
      normalizePrmIntegerId(detail.id);
    const opened =
      result?.ok !== false &&
      result?.empty !== true &&
      openedId === familyRouteId;
    if (!opened) {
      showToast?.(
        "Family Route created, but the new Draft could not be opened.",
        "warning",
        5200,
      );
      return {
        ok: false,
        created: true,
        opened: false,
        family_route_id: familyRouteId,
      };
    }
    return {
      ok: true,
      created: true,
      opened: true,
      family_route_id: familyRouteId,
    };
  }

  function actionsHtml(actions = []) {
    let list = Array.isArray(actions) ? [...actions] : [];
    // View-only: hide mutation actions entirely (do not disable-as-permission).
    if (!canEdit()) {
      list = list.filter((action) => action.mutation !== true);
    }
    return `<div class="cp-prm-actions">${list
      .map((action) => {
        const mappingId =
          action.mapping_id ??
          action.selectedMapping?.id ??
          action.selectedMapping?.mapping_id ??
          "";
        const label = action.label || formatPrmActionLabel(action.id);
        if (action.serverContractRequired === true) {
          return `<span class="cp-prm-action-blocked">
            <button type="button" class="icon-btn" data-prm-summary-action="${text(action.id)}" data-prm-mapping-id="${text(mappingId)}" disabled>${text(label)}</button>
            <span class="cp-muted-text cp-prm-server-contract" title="Server contract required">SERVER CONTRACT REQUIRED</span>
          </span>`;
        }
        if (action.id === "preferred-batch-size" && action.navigateHandoff) {
          const href = action.href || "";
          return `<button type="button" class="icon-btn" data-prm-summary-action="${text(action.id)}" data-prm-mapping-id="${text(mappingId)}" data-prm-handoff-href="${text(href)}" ${action.disabled || !href ? "disabled" : ""}>${text(label)}</button>`;
        }
        const productRouteId = normalizePrmIntegerId(action.product_route_id);
        const productRouteAttr =
          productRouteId != null
            ? ` data-prm-product-route-id="${productRouteId}"`
            : "";
        return `<button type="button" class="icon-btn" data-prm-summary-action="${text(action.id)}" data-prm-mapping-id="${text(mappingId)}"${productRouteAttr} ${action.disabled ? "disabled" : ""}>${text(label)}</button>`;
      })
      .join("")}</div>`;
  }

  async function fillProductSummaryEffectiveHost(root, identityRow = {}) {
    const row =
      identityRow && typeof identityRow === "object"
        ? identityRow
        : { product_id: identityRow };
    const snapshotHost = root?.querySelector?.("[data-prm-product-snapshot-host]");
    const stepsHost = root?.querySelector?.("[data-prm-effective-host]");
    const actionsHost = root?.querySelector?.("[data-prm-product-actions-host]");
    const candidateHost = root?.querySelector?.("[data-prm-candidate-section-host]");
    const productId = normalizePrmIntegerId(row.product_id);
    if (snapshotHost) {
      snapshotHost.innerHTML = `<div class="cost-sheet-explain-loading">Loading live route…</div>`;
    }
    if (stepsHost) {
      stepsHost.innerHTML = `<div class="cost-sheet-explain-loading">Loading effective route…</div>`;
    }
    if (productId == null) {
      if (snapshotHost) {
        snapshotHost.innerHTML = `<p class="cp-muted-text">Product ID is required.</p>`;
      }
      if (stepsHost) {
        stepsHost.innerHTML = `<p class="cp-muted-text">Unable to load effective route.</p>`;
      }
      return;
    }
    const result = await loadEffective(productId);
    if (!root.isConnected) return;
    if (!result?.ok) {
      if (snapshotHost) {
        snapshotHost.innerHTML = `<p class="cp-muted-text">Unable to load live route.</p>`;
      }
      if (stepsHost) {
        stepsHost.innerHTML = `<p class="cp-muted-text">Unable to load effective route.</p>`;
      }
      return;
    }
    const effective = result.data || {};
    const familyRouteId = resolvePrmEffectiveFamilyRouteId(effective);
    const routeFamilyId = normalizePrmIntegerId(
      effective.route_family_id ?? row.route_family_id,
    );
    let historyRows = [];
    if (familyRouteId != null && routeFamilyId != null) {
      const cached =
        String(state.selectedRouteFamilyId) === String(routeFamilyId)
          ? state.familyHistory || []
          : [];
      if (formatPrmFamilyRouteVersionCopy(familyRouteId, cached)) {
        historyRows = cached;
      } else {
        historyRows = (await loadFamilyHistory(routeFamilyId)) || [];
        if (!root.isConnected) return;
      }
    }
    const canonicalRow = mergeProductSummaryCanonicalRow(row, effective);
    const effectiveProductRouteId = normalizePrmIntegerId(
      canonicalRow.product_route_id,
    );
    let productHistoryRows = [];
    let productHistoryUnavailable = false;
    if (effectiveProductRouteId == null) {
      const historyResult = await loadProductHistory(productId);
      if (!root.isConnected) return;
      productHistoryUnavailable = historyResult.ok !== true;
      productHistoryRows = historyResult.versions || [];
    }
    const eligibility = resolvePrmOpenProductRouteEligibility(
      canonicalRow,
      productHistoryRows,
    );
    if (eligibility.open_product_route_id != null) {
      canonicalRow.draft_product_route_id = eligibility.open_product_route_id;
      state.selectedProductRouteId = eligibility.open_product_route_id;
    }
    if (snapshotHost) {
      snapshotHost.innerHTML = buildProductSummarySnapshotHtml(
        row,
        effective,
        historyRows,
      );
      if (stepsHost) {
        stepsHost.innerHTML = buildEffectiveStepsTableHtml(
          coercePrmList(effective.steps || effective.effective_steps),
        );
      }
    } else if (stepsHost) {
      stepsHost.innerHTML = buildEffectiveRoutePanelHtml(effective);
    }
    const canonicalReadiness = normalizePrmCode(
      canonicalRow.readiness_status,
    ).toUpperCase();
    if (candidateHost) {
      candidateHost.innerHTML = isRouteBlockedReadiness(canonicalReadiness)
        ? `<section class="cp-detail-section" data-prm-candidate-section>
          <h3 class="cp-section-title">Route candidate evidence</h3>
          <p class="cp-muted-text">${text(PRM_CANDIDATE_ADVISORY_LABEL)}</p>
          <div class="cp-prm-actions">
            <button type="button" class="icon-btn" data-prm-load-product-candidate>Preview advisory candidate</button>
          </div>
          <div data-prm-candidate-host></div>
        </section>`
        : "";
    }
    if (actionsHost) {
      actionsHost.innerHTML = actionsHtml(
        getApplicableProductRouteActions(canonicalRow, {
          hasApprovedCostCentres: !state.costCentreBlocker,
          productHistory: productHistoryRows,
          productHistoryUnavailable,
        }),
      );
    }
  }

  function resolveWorkloadActivityLabel(step) {
    const id = step?.activity_id;
    const options = state.options?.activities || [];
    if (id != null) {
      const match = options.find(
        (row) => String(row.activity_id ?? row.id) === String(id),
      );
      if (match) {
        return (
          match.activity_name ||
          match.name ||
          match.activity_code ||
          match.code ||
          id
        );
      }
    }
    return step?.activity || id || "—";
  }

  function resolveWorkloadCostCentreLabel(step) {
    const id = step?.cost_centre_id;
    const options = state.options?.cost_centres || [];
    if (id != null) {
      const match = options.find(
        (row) => String(row.cost_centre_id ?? row.id) === String(id),
      );
      if (match) {
        return (
          match.cost_centre_name ||
          match.name ||
          match.cost_centre_code ||
          match.code ||
          id
        );
      }
    }
    return step?.cost_centre_name || id || "—";
  }

  function formatWorkloadSkuEvidence(list = []) {
    if (!Array.isArray(list) || !list.length) {
      return `<p class="cp-muted-text">No SKU quantity evidence returned.</p>`;
    }
    return `<ul class="cp-prm-mapping-list">${list
      .map((item) => {
        const row = item && typeof item === "object" ? item : {};
        const sku =
          row.sku_code ||
          row.sku_name ||
          row.sku_id ||
          row.product_sku_id ||
          "SKU";
        const qty =
          row.monthly_quantity ??
          row.quantity ??
          row.sku_monthly_quantity ??
          "—";
        const source =
          row.source_type ||
          row.quantity_source ||
          row.driver_source ||
          null;
        return `<li><div class="cp-cell-primary">${text(sku)}</div><div>${text(
          qty,
        )}${source ? ` · ${text(source)}` : ""}</div></li>`;
      })
      .join("")}</ul>`;
  }

  function workloadSectionHead(title, actionHtml = "") {
    return `<div class="cp-prm-workload-section-head">
      <h4 class="cp-prm-workload-section-title">${text(title)}</h4>
      ${actionHtml || ""}
    </div>`;
  }

  function buildWorkloadFoundationHtml(detail) {
    if (!detail) {
      return `<p class="cp-muted-text">No workload foundation detail.</p>`;
    }
    const preferredHandoff = buildPrmPreferredBatchSizeHandoffAction(detail);
    const preferredHandoffAction = preferredHandoff.href
      ? `<button type="button" class="cp-prm-link-btn" data-prm-summary-action="preferred-batch-size" data-prm-handoff-href="${text(
          preferredHandoff.href,
        )}">${text(preferredHandoff.label)}</button>`
      : "";
    const steps = Array.isArray(detail.steps) ? detail.steps : [];
    const disclaimer = PRM_WORKLOAD_POLICY_DISCLAIMER.map(
      (line) => `<li>${text(line)}</li>`,
    ).join("");
    const foundationCell = (label, valueHtml, { full = false } = {}) =>
      `<div class="cp-prm-workload-foundation-cell${
        full ? " cp-prm-workload-foundation-cell--full" : ""
      }"><div class="cp-field-label">${text(label)}</div><div class="cp-prm-workload-foundation-value">${valueHtml}</div></div>`;
    const stepRows = steps.length
      ? `<div class="table-scroll cp-prm-workload-foundation-full"><table class="data-table cp-prm-workload-steps">
        <thead><tr>
          <th>Seq</th><th>Activity</th><th>Cost centre</th><th>Behaviour</th>
          <th>Resource class</th><th>Expected occurrences</th><th>Standard cycles</th>
          <th>Direct Labour scope</th><th>Production Overhead scope</th>
          <th>Source type</th><th>Lineage</th>
        </tr></thead>
        <tbody>${steps
          .map(
            (step) => `<tr>
            <td>${text(step.sequence_no)}</td>
            <td>${text(resolveWorkloadActivityLabel(step))}</td>
            <td>${text(resolveWorkloadCostCentreLabel(step))}</td>
            <td>${text(step.behaviour)}</td>
            <td title="${text(step.resource_class_code || step.resource_class, "")}">${text(step.resource_class)}</td>
            <td>${text(step.expected_occurrences)}</td>
            <td>${text(step.standard_cycles)}</td>
            <td>${text(step.direct_labour_scope)}</td>
            <td>${text(step.production_overhead_scope)}</td>
            <td>${text(formatPrmStepSourceLabel(step.source_type) || step.source_type)}</td>
            <td>${text(
              typeof step.lineage === "string"
                ? step.lineage
                : step.lineage?.label || step.base_step_id || step.override_id,
            )}</td>
          </tr>`,
          )
          .join("")}</tbody></table></div>`
      : `<p class="cp-muted-text">No effective steps returned.</p>`;
    return `
      <section class="cp-detail-section" data-prm-workload-foundation>
        <h3 class="cp-section-title">Workload Foundation</h3>
        <p class="cp-muted-text cp-prm-workload-foundation-full">${text(PRM_WORKLOAD_BATCH_LABELS.rawExplain)}</p>
        <p class="cp-muted-text cp-prm-workload-foundation-full">${text(PRM_WORKLOAD_BATCH_LABELS.roundedExplain)}</p>
        <p class="cp-muted-text cp-prm-workload-foundation-full">${text(PRM_WORKLOAD_BATCH_LABELS.denominatorReview)}</p>

        ${workloadSectionHead("Product Context")}
        <div class="cp-prm-workload-foundation-grid" data-prm-foundation-group="product-context">
          ${foundationCell(
            "Commercial hierarchy",
            text(hierarchy(detail)),
            { full: true },
          )}
          ${foundationCell(
            "Product Group",
            text(
              formatPrmProductGroupHierarchyLabel(detail) ||
                detail.product_group_name ||
                hierarchy(detail),
            ),
          )}
          ${foundationCell("Product Base UOM", text(detail.product_base_uom))}
        </div>

        ${workloadSectionHead("Quantity")}
        <div class="cp-prm-workload-foundation-grid" data-prm-foundation-group="quantity">
          ${foundationCell(
            "Monthly Product Quantity",
            text(detail.monthly_product_quantity),
          )}
          ${foundationCell(
            "Monthly Driver Status",
            chip(detail.quantity_driver_status),
          )}
          ${foundationCell(
            "Recipient SKU Count",
            text(detail.recipient_sku_count),
          )}
          ${foundationCell(
            "Actual-source SKU Count",
            text(detail.actual_sku_count),
          )}
          ${foundationCell(
            "Assumption-source SKU Count",
            text(detail.assumption_sku_count),
          )}
          ${foundationCell(
            "Default-source SKU Count",
            text(detail.default_sku_count),
          )}
        </div>

        ${workloadSectionHead("SKU Quantity Evidence")}
        <div class="cp-prm-workload-foundation-full" data-prm-foundation-group="sku-evidence">
          ${formatWorkloadSkuEvidence(detail.sku_quantity_evidence)}
        </div>

        ${workloadSectionHead("Batch", preferredHandoffAction)}
        <div class="cp-prm-workload-foundation-grid" data-prm-foundation-group="batch">
          ${foundationCell("Preferred Batch", text(detail.preferred_batch_size))}
          ${foundationCell("Min Batch", text(detail.minimum_batch_size))}
          ${foundationCell("Max Batch", text(detail.maximum_batch_size))}
          ${foundationCell(
            "Raw Batch Requirement",
            text(detail.raw_batch_requirement),
          )}
          ${foundationCell(
            "Rounded Standard Batches",
            text(detail.standard_batch_count),
          )}
          ${foundationCell(
            "Effective From",
            text(
              formatPrmDayMonthYearLabel(detail.batch_size_effective_date) ||
                detail.batch_size_effective_date,
            ),
          )}
        </div>

        ${workloadSectionHead("Route")}
        <div class="cp-prm-workload-foundation-grid" data-prm-foundation-group="route">
          ${foundationCell(
            "Route Family",
            text(detail.route_family_name || detail.route_family_code),
          )}
          ${foundationCell("Family Route", text(detail.family_route_id))}
          ${foundationCell("Product Route", text(detail.product_route_id))}
          ${foundationCell(
            "Effective Route Source",
            text(detail.route_source),
          )}
          ${foundationCell(
            "Step Count",
            text(detail.effective_step_count ?? steps.length),
          )}
          ${foundationCell(
            "Route Validation",
            routeValidationDetailHtml(detail.route_validation),
          )}
        </div>

        ${workloadSectionHead("DL Scopes")}
        <div class="cp-prm-workload-foundation-grid" data-prm-foundation-group="dl-scopes">
          ${foundationCell("Included-step count", text(detail.dl_include_count))}
          ${foundationCell(
            "Supervision-step count",
            text(detail.dl_supervision_count),
          )}
          ${foundationCell("Excluded-step count", text(detail.dl_excluded_count))}
        </div>

        ${workloadSectionHead("POH Scopes")}
        <div class="cp-prm-workload-foundation-grid" data-prm-foundation-group="poh-scopes">
          ${foundationCell("Included-step count", text(detail.poh_include_count))}
          ${foundationCell("Passive-step count", text(detail.poh_passive_count))}
          ${foundationCell("Excluded-step count", text(detail.poh_excluded_count))}
        </div>

        ${workloadSectionHead("Step Table")}
        ${stepRows}

        ${workloadSectionHead("Foundation Status")}
        <div class="cp-prm-workload-foundation-grid" data-prm-foundation-group="foundation-status">
          ${foundationCell("Foundation Status", chip(detail.foundation_status))}
          ${foundationCell(
            "Foundation Note",
            text(detail.foundation_note),
            { full: true },
          )}
          ${foundationCell("Preview only", "Yes")}
          ${foundationCell("Records created", "0")}
          ${foundationCell("Monetary allocation created", "No")}
          ${foundationCell("Stage 03", "Not authorised by this gate")}
        </div>
        <ul class="cp-muted-text cp-prm-workload-foundation-full" data-prm-workload-policy style="margin-top:8px;padding-left:1.1rem">${disclaimer}</ul>
      </section>`;
  }

  async function fillProductSummaryWorkloadHost(root, productId) {
    const host = root?.querySelector?.("[data-prm-workload-host]");
    if (!host) return;
    const pid = normalizePrmIntegerId(productId);
    const generation = ++state.workloadDetailGeneration;
    const modalGeneration = state.workloadProductModalGeneration;
    host.innerHTML = `<div class="cost-sheet-explain-loading">Loading workload foundation…</div>`;
    if (pid == null) {
      host.innerHTML = `<p class="cp-muted-text">Product ID is required for workload detail.</p>`;
      return;
    }
    const response = await invoke(
      RPC.workloadDetail,
      buildWorkloadDetailRpcArgs({
        product_id: pid,
        period_start: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.period_start,
        valuation_date: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.valuation_date,
        refresh_run_id: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id,
      }),
      "Unable to load Workload Foundation detail.",
    );
    if (generation !== state.workloadDetailGeneration || !root.isConnected) {
      return;
    }
    if (modalGeneration !== state.workloadProductModalGeneration) {
      return;
    }
    if (!response.ok) {
      host.innerHTML = `<p class="cp-muted-text">${text(
        response.error?.message || "Unable to load workload foundation.",
      )}</p>`;
      return;
    }
    host.innerHTML = buildWorkloadFoundationHtml(
      normalizePrmWorkloadDetailPayload(
        response.data,
        prmResourceClassDisplayContext(),
      ),
    );
  }

  async function fillProductSummaryCandidateHost(root, productId) {
    const host = root?.querySelector?.("[data-prm-candidate-host]");
    if (!host) return;
    host.innerHTML = `<div class="cost-sheet-explain-loading">Loading advisory candidate…</div>`;
    const response = await invoke(
      RPC.productCandidate,
      buildProductCandidateRpcArgs({
        product_id: productId,
        as_of_date: getAsOfDate(),
      }),
      "Unable to load Product route candidate preview.",
    );
    if (!root.isConnected) return;
    if (!response.ok) {
      host.innerHTML = `<p class="cp-muted-text">Unable to load advisory candidate evidence.</p>`;
      return;
    }
    host.innerHTML = buildCandidateAdvisoryHtml(
      normalizeProductCandidate(response.data),
    );
    lastProductCandidatePayload = normalizeProductCandidate(response.data);
    if (canEdit()) {
      host.insertAdjacentHTML(
        "beforeend",
        `<div class="cp-prm-actions">
          <button type="button" class="icon-btn" data-prm-use-candidate-in-draft>${text(
            formatPrmActionLabel("use-candidate-in-draft"),
          )}</button>
        </div>`,
      );
    }
  }

  function listApprovedRouteFamiliesForAssignment() {
    return (state.routeFamilies || []).filter((family) => {
      const status = normalizePrmCode(
        family.status || family.family_status || family.route_family_status,
      ).toUpperCase();
      return !status || status === "APPROVED" || status === "ACTIVE";
    });
  }

  async function loadProductScopedAssignments(productId) {
    const pid = normalizePrmIntegerId(productId);
    if (pid == null) {
      return { ok: false, errors: ["Product ID is required."] };
    }
    const response = await invoke(
      RPC.productAssignments,
      buildProductAssignmentsRpcArgs({
        product_id: pid,
        limit: 100,
        offset: 0,
      }),
      "Unable to load Product Route Family assignments.",
    );
    if (!response.ok) return response;
    return {
      ok: true,
      data: normalizePrmProductAssignmentsPayload(response.data),
    };
  }

  /**
   * Modal eligibility probe — same RPC/builder/normalizer as register reads,
   * without paintError / register status side effects.
   */
  async function loadProductScopedAssignmentsForEligibility(productId) {
    const pid = normalizePrmIntegerId(productId);
    if (pid == null) {
      return { ok: false, error: "Product ID is required." };
    }
    const built = buildProductAssignmentsRpcArgs({
      product_id: pid,
      limit: 100,
      offset: 0,
    });
    if (!built?.ok) {
      return {
        ok: false,
        error:
          (built?.errors || []).filter(Boolean).join("; ") ||
          "Unable to load Product Route Family assignments.",
      };
    }
    const { data, error } = await costingRpc(RPC.productAssignments, built.params);
    if (error) {
      const formatted =
        formatPrmRpcError(RPC.productAssignments, built.params, error) ||
        error.message ||
        "";
      const safeDetail = String(formatted || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 280);
      return {
        ok: false,
        error:
          safeDetail || "Unable to load Product Route Family assignments.",
      };
    }
    const normalized = normalizePrmProductAssignmentsPayload(data);
    const rows = Array.isArray(normalized?.rows) ? normalized.rows : [];
    return {
      ok: true,
      data: normalized,
      empty: rows.length === 0,
    };
  }

  function applyAssignmentStatusCounts(incoming, { isUnfiltered, pageTotal } = {}) {
    const counts =
      incoming && typeof incoming === "object" ? { ...incoming } : {};
    const keys = Object.keys(counts);
    if (isUnfiltered && keys.length) {
      state.assignment_status_counts_baseline = counts;
      state.assignment_status_counts = counts;
      return;
    }
    if (!keys.length) {
      state.assignment_status_counts = {
        ...(state.assignment_status_counts_baseline || {}),
      };
      return;
    }
    const sum = sumPrmStatusCounts(counts);
    const baselineSum = sumPrmStatusCounts(
      state.assignment_status_counts_baseline,
    );
    const looksFullCompany =
      keys.length > 1 ||
      (state.assignmentTotalBaseline != null &&
        sum === state.assignmentTotalBaseline) ||
      (baselineSum > 0 && sum === baselineSum) ||
      (pageTotal != null && sum > Number(pageTotal));
    if (looksFullCompany) {
      state.assignment_status_counts_baseline = counts;
      state.assignment_status_counts = counts;
      return;
    }
    state.assignment_status_counts = {
      ...(state.assignment_status_counts_baseline || {}),
    };
  }

  /** Product Assignments register (Gate 11Y.4C.2). Optional deep-link product focus. */
  async function loadProductAssignments({ resetOffset = false, search } = {}) {
    if (!canView()) {
      state.permissionDenied = true;
      state.assignmentRows = [];
      state.assignmentTotalCount = 0;
      return { ok: false, permissionDenied: true };
    }
    const current = ++state.assignmentGeneration;
    state.assignmentLoading = true;
    state.permissionDenied = false;
    state.assignmentLoadError = null;
    if (resetOffset) {
      state.page = 1;
      state.offset = 0;
    }
    if (search != null) state.search = String(search || "").trim();
    // Hydrate catalogues only when not ready — never force a reload for register truth.
    if (!isPrmMasterOptionsReady(state.optionsStatus) || !state.options) {
      const options = await ensureMasterOptions();
      if (current !== state.assignmentGeneration) {
        return { ok: false, stale: true, generation: current };
      }
      if (!options.ok) {
        state.assignmentLoading = false;
        return {
          ok: false,
          error: options.error || options.errors,
          generation: current,
        };
      }
    }
    const focusProductId = normalizePrmIntegerId(state.assignmentFocusProductId);
    const isUnfiltered =
      !state.assignment_status &&
      !state.search &&
      !state.product_group_id &&
      !state.route_family_id &&
      focusProductId == null;
    const response = await invoke(
      RPC.productAssignments,
      buildProductAssignmentsRpcArgs({
        status: state.assignment_status || null,
        search: state.search || null,
        route_family_id: state.route_family_id || null,
        product_group_id: state.product_group_id || null,
        // Company-wide when no remediation focus; deep-link focus passes p_product_id.
        product_id: focusProductId,
        limit: state.limit,
        offset: state.offset,
      }),
      "Unable to load Product Route Family assignments.",
    );
    if (current !== state.assignmentGeneration) {
      return { ok: false, stale: true, generation: current };
    }
    state.assignmentLoading = false;
    if (!response.ok) {
      // Preserve last accepted register rows/count — do not wipe on failed reread.
      state.assignmentLoadError =
        response.error?.message ||
        "Product Assignments failed to load.";
      return {
        ok: false,
        error: response.error,
        generation: current,
      };
    }
    const normalized = normalizePrmProductAssignmentsPayload(response.data);
    if (current !== state.assignmentGeneration) {
      return { ok: false, stale: true, generation: current };
    }
    const page = clampPrmPagination({
      offset: state.offset,
      limit: state.limit,
      total_count: normalized.total_count,
    });
    state.offset = page.offset;
    state.page = page.pageIndex + 1;
    state.assignmentTotalCount = page.total_count;
    state.total_count = page.total_count;
    state.assignmentRows = normalized.rows || [];
    applyAssignmentStatusCounts(normalized.status_counts || {}, {
      isUnfiltered,
      pageTotal: normalized.total_count,
    });
    if (isUnfiltered) {
      state.assignmentTotalBaseline = normalized.total_count;
    } else if (state.assignmentTotalBaseline == null) {
      const baselineSum = sumPrmStatusCounts(
        state.assignment_status_counts_baseline,
      );
      if (baselineSum > 0) state.assignmentTotalBaseline = baselineSum;
    }
    rebuildAssignmentPeqOptions();
    return {
      ok: true,
      total_count: state.assignmentTotalCount,
      generation: current,
      rows: state.assignmentRows,
    };
  }

  /**
   * Authoritative Product Assignments register refresh after mutation.
   * No master-options reload. Paint only after accepted commit.
   */
  async function refreshProductAssignmentsAfterMutation({
    refreshFailureMessage = "Product Assignment updated, but the register could not be refreshed.",
    resetOffset = false,
  } = {}) {
    if (state.activeLens !== "product-route-assignments") {
      return { ok: false, skipped: true, reason: "lens" };
    }
    const result = await loadProductAssignments({ resetOffset });
    if (result?.stale === true) {
      return result;
    }
    if (!result?.ok) {
      if (refreshFailureMessage) {
        showToast?.(refreshFailureMessage, "warning", 5200);
      }
      return {
        ok: false,
        error: result?.error,
        refreshFailed: true,
        generation: result?.generation,
      };
    }
    if (state.activeLens === "product-route-assignments") {
      paintAcceptedPrmLens();
    }
    return result;
  }

  function applyWorkloadStatusCounts(payload, { isUnfiltered }) {
    const counts = payload?.status_counts || {};
    const qtyCounts = payload?.quantity_driver_status_counts || {};
    if (isUnfiltered) {
      state.workload_status_counts_baseline = { ...counts };
      state.workload_quantity_status_counts_baseline = { ...qtyCounts };
      state.workload_status_counts = { ...counts };
      state.workload_quantity_status_counts = { ...qtyCounts };
      return;
    }
    if (
      !state.workload_status_counts_baseline ||
      !Object.keys(state.workload_status_counts_baseline).length
    ) {
      state.workload_status_counts_baseline = { ...counts };
    }
    if (
      !state.workload_quantity_status_counts_baseline ||
      !Object.keys(state.workload_quantity_status_counts_baseline).length
    ) {
      state.workload_quantity_status_counts_baseline = { ...qtyCounts };
    }
    state.workload_status_counts = {
      ...state.workload_status_counts_baseline,
      ...counts,
    };
    state.workload_quantity_status_counts = {
      ...state.workload_quantity_status_counts_baseline,
      ...qtyCounts,
    };
  }

  function enrichWorkloadSummary(summary, statusCounts) {
    const next = { ...(summary || {}) };
    if (next.blocked_count == null && statusCounts) {
      let blocked = 0;
      let hasBlocked = false;
      for (const [code, n] of Object.entries(statusCounts)) {
        const upper = normalizePrmCode(code).toUpperCase();
        if (upper.startsWith("BLOCKED_") && Number.isFinite(Number(n))) {
          blocked += Number(n);
          hasBlocked = true;
        }
      }
      if (hasBlocked) next.blocked_count = blocked;
    }
    return next;
  }

  function appendWorkloadRowsDeduped(existing, incoming) {
    const seen = new Set(
      (existing || [])
        .map((row) => normalizePrmIntegerId(row?.product_id))
        .filter((id) => id != null)
        .map(String),
    );
    const next = [...(existing || [])];
    for (const row of incoming || []) {
      const id = normalizePrmIntegerId(row?.product_id);
      const key = id == null ? null : String(id);
      if (key != null && seen.has(key)) continue;
      if (key != null) seen.add(key);
      next.push(row);
    }
    return next;
  }

  function workloadHasMore() {
    const total = Number(state.workloadTotalCount) || 0;
    const loaded = (state.workloadRows || []).length;
    return total > 0 && loaded < total;
  }

  async function loadWorkloadPreview({
    resetOffset = false,
    search,
    append = false,
  } = {}) {
    if (!canView()) {
      state.permissionDenied = true;
      state.workloadRows = [];
      state.workloadTotalCount = 0;
      state.workloadSummary = {};
      return { ok: false, permissionDenied: true };
    }
    if (append) {
      if (
        state.workloadLoading ||
        state.workloadLoadingMore ||
        !workloadHasMore()
      ) {
        return { ok: true, skipped: true };
      }
      state.workloadLoadingMore = true;
      state.workloadLoadMoreError = null;
    } else {
      const current = ++state.workloadGeneration;
      state.workloadLoading = true;
      state.permissionDenied = false;
      state.workloadLoadError = null;
      state.workloadLoadMoreError = null;
      state.workloadLoadingMore = false;
      if (resetOffset || !append) {
        state.page = 1;
        state.offset = 0;
        state.workloadOffset = 0;
        state.workloadRows = [];
      }
      if (search != null) state.search = String(search || "").trim();
      void current;
    }
    const generation = state.workloadGeneration;
    const filterSnapshot = {
      search: state.search || "",
      foundation_status: state.foundation_status || "",
      quantity_driver_status: state.quantity_driver_status || "",
      route_family_id: state.route_family_id || "",
      product_group_id: state.product_group_id || "",
      product_id: state.product_id || "",
      dl_scope_filter: state.dl_scope_filter || "",
      poh_scope_filter: state.poh_scope_filter || "",
      refresh_run_id: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id,
    };
    if (!isPrmMasterOptionsReady(state.optionsStatus) || !state.options) {
      const options = await ensureMasterOptions();
      if (!options.ok) {
        state.workloadLoading = false;
        state.workloadLoadingMore = false;
        return options;
      }
    }
    const limit = Math.max(1, Number(state.workloadLimit) || 50);
    state.workloadLimit = limit;
    const offset = append
      ? (state.workloadRows || []).length
      : Math.max(0, Number(state.workloadOffset) || 0);
    const isUnfiltered =
      !filterSnapshot.foundation_status &&
      !filterSnapshot.quantity_driver_status &&
      !filterSnapshot.search &&
      !filterSnapshot.product_group_id &&
      !filterSnapshot.route_family_id &&
      !filterSnapshot.product_id &&
      !filterSnapshot.dl_scope_filter &&
      !filterSnapshot.poh_scope_filter;
    const response = await invoke(
      RPC.workloadPreview,
      buildWorkloadPreviewRpcArgs({
        search: filterSnapshot.search || null,
        foundation_status: filterSnapshot.foundation_status || null,
        quantity_driver_status: filterSnapshot.quantity_driver_status || null,
        route_family_id: filterSnapshot.route_family_id || null,
        product_group_id: filterSnapshot.product_group_id || null,
        product_id: filterSnapshot.product_id || null,
        dl_scope_filter: filterSnapshot.dl_scope_filter || null,
        poh_scope_filter: filterSnapshot.poh_scope_filter || null,
        limit,
        offset,
        period_start: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.period_start,
        valuation_date: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.valuation_date,
        refresh_run_id: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id,
      }),
      "Unable to load Workload Preview.",
    );
    if (generation !== state.workloadGeneration) {
      return { ok: false, stale: true };
    }
    if (
      filterSnapshot.search !== (state.search || "") ||
      filterSnapshot.foundation_status !== (state.foundation_status || "") ||
      filterSnapshot.quantity_driver_status !==
        (state.quantity_driver_status || "") ||
      filterSnapshot.route_family_id !== (state.route_family_id || "") ||
      filterSnapshot.product_group_id !== (state.product_group_id || "") ||
      filterSnapshot.product_id !== (state.product_id || "") ||
      filterSnapshot.dl_scope_filter !== (state.dl_scope_filter || "") ||
      filterSnapshot.poh_scope_filter !== (state.poh_scope_filter || "")
    ) {
      return { ok: false, stale: true };
    }
    if (append) state.workloadLoadingMore = false;
    else state.workloadLoading = false;
    if (!response.ok) {
      if (append) {
        state.workloadLoadMoreError =
          response.error?.message || "Unable to load more Products.";
        return { ok: false, error: response.error, append: true };
      }
      state.workloadRows = [];
      state.workloadTotalCount = 0;
      state.total_count = 0;
      state.workloadSummary = {};
      state.workloadLoadError =
        response.error?.message || "Workload Preview failed to load.";
      showToast?.(state.workloadLoadError, "error");
      return { ok: false, error: response.error };
    }
    const normalized = normalizePrmWorkloadPreviewPayload(response.data);
    const page = clampPrmPagination({
      offset,
      limit,
      total_count: normalized.total_count,
    });
    state.offset = page.offset;
    state.workloadOffset = page.offset;
    state.page = page.pageIndex + 1;
    state.limit = limit;
    state.workloadTotalCount = page.total_count;
    state.total_count = page.total_count;
    const incoming = normalized.rows || [];
    state.workloadRows = append
      ? appendWorkloadRowsDeduped(state.workloadRows, incoming)
      : incoming;
    applyWorkloadStatusCounts(normalized, { isUnfiltered });
    state.workloadSummary = enrichWorkloadSummary(
      normalized.summary,
      state.workload_status_counts_baseline,
    );
    if (isUnfiltered) {
      state.workloadTotalBaseline = normalized.total_count;
    } else if (state.workloadTotalBaseline == null) {
      const baselineSum = sumPrmStatusCounts(
        state.workload_status_counts_baseline,
      );
      if (baselineSum > 0) state.workloadTotalBaseline = baselineSum;
    }
    rebuildWorkloadPeqOptions();
    return { ok: true, total_count: state.workloadTotalCount, append };
  }

  async function loadMoreWorkloadPreview() {
    const result = await loadWorkloadPreview({ append: true });
    if (result?.ok && !result.skipped && state.activeLens === "shared-workload-preview") {
      renderWorkloadPreview({ preserveScroll: true });
    } else if (
      result &&
      !result.ok &&
      result.append &&
      state.activeLens === "shared-workload-preview"
    ) {
      renderWorkloadPreview({ preserveScroll: true });
    }
    return result;
  }

  async function refreshAfterAssignmentMutation(productId, row, opts = {}) {
    const focusAssignmentId =
      normalizePrmIntegerId(opts.focusAssignmentId) ??
      state.focusAssignmentId;
    const openSummaryAfter = opts.openProductSummary !== false;
    const refreshFailureMessage =
      opts.refreshFailureMessage ||
      "Product Assignment updated, but the register could not be refreshed.";
    if (state.activeLens === "product-route-assignments") {
      await refreshProductAssignmentsAfterMutation({
        refreshFailureMessage,
        resetOffset: opts.resetOffset === true,
      });
    } else {
      await loadReadiness({ resetOffset: false });
      if (state.activeLens === "route-readiness") {
        paintAcceptedPrmLens();
      }
    }
    const refreshed =
      (state.activeLens === "product-route-assignments"
        ? state.assignmentRows.find(
            (item) => String(item.product_id) === String(productId),
          )
        : state.readinessRows.find(
            (item) => String(item.product_id) === String(productId),
          )) || row;
    const summaryRoot = document.querySelector("[data-prm-product-summary]");
    if (summaryRoot?.isConnected) {
      await fillProductSummaryAssignmentHost(summaryRoot, refreshed, {
        focusAssignmentId,
      });
      await fillProductSummaryEffectiveHost(summaryRoot, refreshed);
    } else if (
      openSummaryAfter &&
      state.activeLens !== "product-route-assignments" &&
      refreshed
    ) {
      openProductSummary(refreshed, { focusAssignmentId });
    }
    return refreshed;
  }

  function buildAssignmentRouteFamilyOptionsHtml({
    selectedFamilyId = null,
  } = {}) {
    return listApprovedRouteFamiliesForAssignment()
      .map((family) => {
        const id = family.route_family_id ?? family.id;
        const code = family.route_family_code || family.family_code || "";
        const name =
          family.route_family_name ||
          family.family_name ||
          code ||
          `Family ${id}`;
        const label = code ? `${code} — ${name}` : name;
        const selected =
          selectedFamilyId != null && String(id) === String(selectedFamilyId);
        return option(id, label, selected);
      })
      .join("");
  }

  function buildAssignmentProductOptionsHtml({
    selectedProductId = null,
  } = {}) {
    return coercePrmList(state.products)
      .map((product) => {
        const id = normalizePrmIntegerId(product.product_id ?? product.id);
        if (id == null) return "";
        const name = product.product_name || product.name || `Product ${id}`;
        return option(id, name, selectedProductId != null && String(id) === String(selectedProductId));
      })
      .filter(Boolean)
      .join("");
  }

  async function evaluateProductAssignmentCreateEligibility(productId) {
    const result = await loadProductScopedAssignmentsForEligibility(productId);
    if (!result?.ok) {
      const detail = String(result?.error || "").trim();
      const generic = "Unable to load Product Route Family assignments.";
      return {
        ok: false,
        empty: false,
        eligibility: resolvePrmProductAssignmentCreateEligibility({
          payload: null,
          canEdit: canEdit(),
        }),
        payload: null,
        error: generic,
        errorDetail:
          detail && detail !== generic ? detail : null,
      };
    }
    return {
      ok: true,
      empty: result.empty === true,
      eligibility: resolvePrmProductAssignmentCreateEligibility({
        payload: result.data,
        canEdit: canEdit(),
      }),
      payload: result.data,
    };
  }

  function buildAssignmentRowActionsHtml(assignment) {
    if (!canEdit()) return "";
    const status = assignment.status;
    const rowActions = normalizePrmAssignmentLifecycleActions(
      assignment.lifecycle_actions,
    );
    const buttons = [];
    if (
      assignmentLifecycleIncludes(rowActions, "SUBMIT_FOR_REVIEW") &&
      status === "DRAFT"
    ) {
      buttons.push("submit-assignment");
    }
    if (
      assignmentLifecycleIncludes(rowActions, "APPROVE") &&
      status === "IN_REVIEW"
    ) {
      buttons.push("approve-assignment");
    }
    if (
      assignmentLifecycleIncludes(rowActions, "CANCEL") &&
      (status === "DRAFT" || status === "IN_REVIEW")
    ) {
      buttons.push("cancel-assignment");
    }
    if (
      assignmentLifecycleIncludes(rowActions, "INACTIVATE") &&
      status === "APPROVED"
    ) {
      buttons.push("inactivate-assignment");
    }
    if (status === "APPROVED") {
      buttons.push("correct-assignment-effective-from");
    }
    if (!buttons.length) return "";
    return `<div class="cp-prm-actions">${buttons
      .map(
        (id) =>
          `<button type="button" class="icon-btn" data-prm-assignment-action="${text(id)}" data-prm-assignment-id="${text(assignment.assignment_id)}">${text(formatPrmActionLabel(id))}</button>`,
      )
      .join("")}</div>`;
  }

  function buildProductAssignmentRowHtml(assignment) {
    const overlap = assignment.overlap_warning;
    const isDraft = assignment.status === "DRAFT";
    return `<li class="cp-prm-assignment-row" data-prm-assignment-id="${text(assignment.assignment_id)}">
      <div class="cp-detail-grid cp-detail-grid--2col">
        <div><div class="cp-field-label">Assignment ID</div><div>${text(assignment.assignment_id)}</div></div>
        <div><div class="cp-field-label">Status</div><div><span class="cp-prm-badge">${text(formatPrmAssignmentStatusLabel(assignment.status))}</span></div></div>
        <div><div class="cp-field-label">Route Family</div><div>${text(
          assignment.route_family_name ||
            assignment.route_family_code ||
            assignment.route_family_id,
        )}</div></div>
        <div><div class="cp-field-label">Assignment basis</div><div>${text(assignment.assignment_basis)}</div></div>
        <div class="cp-detail-span-full"><div class="cp-field-label">Assignment note</div><div>${text(assignment.assignment_note)}</div></div>
        <div><div class="cp-field-label">Effective from</div><div>${text(assignment.effective_from)}</div></div>
        <div><div class="cp-field-label">Effective to</div><div>${text(assignment.effective_to)}</div></div>
        <div><div class="cp-field-label">Approval reference</div><div>${text(assignment.approval_reference)}</div></div>
        <div><div class="cp-field-label">Approved at</div><div>${text(assignment.approved_at)}</div></div>
        <div class="cp-detail-span-full"><div class="cp-field-label">Cancellation reason</div><div>${text(assignment.cancellation_reason)}</div></div>
        <div><div class="cp-field-label">Cancelled at</div><div>${text(assignment.cancelled_at)}</div></div>
      </div>
      ${
        overlap
          ? `<p class="cp-prm-form-notice">Overlap warning: ${text(
              typeof overlap === "object"
                ? JSON.stringify(overlap)
                : overlap,
            )}</p>`
          : ""
      }
      ${
        isDraft
          ? `<p class="cp-muted-text">Draft definition is read-only. Cancel this draft to create a replacement.</p>`
          : ""
      }
      ${buildAssignmentRowActionsHtml(assignment)}
    </li>`;
  }

  function buildProductAssignmentFallbackHtml(row = {}) {
    const assignmentRaw = resolvePrmRouteFamilyAssignmentSource(row);
    const assignmentLabel =
      formatPrmRouteFamilyAssignmentSourceLabel(assignmentRaw) || "None";
    const familyName =
      row.route_family_name || row.route_family_code || "—";
    return `<div class="cp-prm-product-summary-meta" data-prm-assignment-fallback>
      ${productSummaryMetaCell("Product-specific assignment", text("None"), {
        field: "product-assignment",
      })}
      ${productSummaryMetaCell("Effective assignment", text(assignmentLabel), {
        field: "effective-assignment",
        title: String(assignmentRaw || ""),
      })}
      ${productSummaryMetaCell("Route Family", text(familyName), {
        field: "assignment-route-family",
      })}
    </div>`;
  }

  function buildProductAssignmentsPanelHtml(payload, row) {
    const rows = payload?.rows || [];
    const canCreate =
      canEdit() &&
      (assignmentLifecycleIncludes(payload?.lifecycle_actions, "CREATE_DRAFT") ||
        assignmentLifecycleIncludes(
          payload?.lifecycle_actions,
          "CREATE_ASSIGNMENT_DRAFT",
        ));
    const overlapEvidence = payload?.overlap_evidence;
    return `${
      canCreate
        ? `<div class="cp-prm-actions"><button type="button" class="icon-btn icon-btn-primary" data-prm-create-assignment-draft>${text(
            formatPrmActionLabel("create-assignment-draft"),
          )}</button></div>`
        : ""
    }
    ${
      overlapEvidence
        ? `<p class="cp-prm-form-notice">Overlap evidence: ${text(
            typeof overlapEvidence === "object"
              ? JSON.stringify(overlapEvidence)
              : overlapEvidence,
          )}</p>`
        : ""
    }
    ${
      rows.length
        ? `<ul class="cp-prm-assignment-list">${rows
            .map((item) => buildProductAssignmentRowHtml(item))
            .join("")}</ul>`
        : buildProductAssignmentFallbackHtml(row)
    }`;
  }

  async function fillProductSummaryAssignmentHost(
    root,
    row,
    { focusAssignmentId = null } = {},
  ) {
    const host = root?.querySelector?.("[data-prm-assignment-host]");
    if (!host) return;
    host.innerHTML = `<div class="cost-sheet-explain-loading">Loading assignments…</div>`;
    const productId = normalizePrmIntegerId(row?.product_id);
    if (productId == null) {
      host.innerHTML = `<p class="cp-muted-text">Product ID is required.</p>`;
      return;
    }
    if (!state.routeFamilies?.length) {
      await loadRouteFamilies().catch(() => null);
    }
    const result = await loadProductScopedAssignments(productId);
    if (!root.isConnected) return;
    if (!result?.ok) {
      host.innerHTML = `<p class="cp-muted-text">Unable to load Product Route Family assignments.</p>`;
      return;
    }
    host.innerHTML = buildProductAssignmentsPanelHtml(result.data, row);
    host.dataset.prmAssignmentsLoaded = "1";
    focusProductAssignmentInHost(
      host,
      focusAssignmentId ?? state.focusAssignmentId,
    );
  }

  function focusProductAssignmentInHost(host, assignmentId) {
    const id = normalizePrmIntegerId(assignmentId);
    if (id == null || !host) return;
    clearPrmActiveRowClass(host, PRM_ACTIVE_ROW_CLASS);
    const safeId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(String(id))
        : String(id);
    const target = host.querySelector(`[data-prm-assignment-id="${safeId}"]`);
    if (!target) return;
    target.classList.add(PRM_ACTIVE_ROW_CLASS);
    try {
      target.scrollIntoView({ block: "nearest", behavior: "auto" });
    } catch {
      /* ignore scroll failures */
    }
  }

  function bindProductAssignmentActions(host, row) {
    onModal(host, "click", async (event) => {
      const createBtn = event.target.closest("[data-prm-create-assignment-draft]");
      if (createBtn) {
        openCreateAssignmentDraftModal(row);
        return;
      }
      const useCandidate = event.target.closest("[data-prm-use-candidate-in-draft]");
      if (useCandidate) {
        const routeFamilyId = extractCandidateRouteFamilyId(
          lastProductCandidatePayload,
        );
        openCreateAssignmentDraftModal(row, {
          route_family_id: routeFamilyId,
          assignment_basis: "HISTORICAL_REVIEW",
          fromCandidate: true,
        });
        return;
      }
      const actionBtn = event.target.closest("[data-prm-assignment-action]");
      if (!actionBtn) return;
      const assignmentId = normalizePrmIntegerId(
        actionBtn.getAttribute("data-prm-assignment-id"),
      );
      if (assignmentId == null) return;
      const action = actionBtn.getAttribute("data-prm-assignment-action");
      const assignmentRow = (await loadProductScopedAssignments(row.product_id))
        ?.data?.rows?.find(
          (item) => String(item.assignment_id) === String(assignmentId),
        );
      const assignment =
        assignmentRow ||
        ({ assignment_id: assignmentId, product_id: row.product_id });
      if (action === "submit-assignment") {
        openSubmitAssignmentModal(assignment, row);
      } else if (action === "approve-assignment") {
        openApproveAssignmentModal(assignment, row);
      } else if (action === "cancel-assignment") {
        openCancelAssignmentModal(assignment, row);
      } else if (action === "inactivate-assignment") {
        openInactivateAssignmentModal(assignment, row);
      } else if (action === "correct-assignment-effective-from") {
        openCorrectAssignmentEffectiveFromModal(assignment, row);
      }
    });
  }

  function buildWorkloadOverviewPanelHtml(row = {}) {
    return `<div class="cp-prm-workload-explain-strip" data-prm-workload-overview>
      ${workloadExplainStripItem("Monthly Quantity", formatPrmWorkloadMonthlyQuantity(row))}
      ${workloadExplainStripItem("Preferred Batch", formatPrmWorkloadPreferredBatch(row))}
      ${workloadExplainStripItem("Raw Batch Requirement", formatPrmWorkloadRawDisplay(row.raw_batch_requirement))}
      ${workloadExplainStripItem("Rounded Batches", formatPrmWorkloadRoundedBatches(row))}
      ${workloadExplainStripItem("Route Family", row.route_family_name || row.route_family_code || "—")}
      ${workloadExplainStripItem("Route Source", row.route_source || row.effective_route_source || "—")}
      ${workloadExplainStripItem("DL Steps", formatPrmDlScopeSummary(row))}
      ${workloadExplainStripItem("POH Steps", formatPrmPohScopeSummary(row))}
      ${workloadExplainStripItem(
        "Foundation Status",
        formatPrmFoundationStatusLabel(row.foundation_status) ||
          row.foundation_status ||
          "—",
      )}
    </div>
    <p class="cp-muted-text">Overview uses Workload Preview list values for this Product. Foundation and Explain tabs load exact-run detail when opened.</p>`;
  }

  async function ensureWorkloadExplainPayload(productId, modalGeneration) {
    const pid = normalizePrmIntegerId(productId);
    if (pid == null) {
      return { ok: false, error: { message: "Product ID is required." } };
    }
    if (
      state.workloadExplainPayload &&
      state.workloadExplainProductId === pid &&
      state.workloadExplainGeneration === modalGeneration
    ) {
      return { ok: true, payload: state.workloadExplainPayload, cached: true };
    }
    if (
      state.workloadExplainInflight &&
      state.workloadExplainProductId === pid &&
      state.workloadExplainGeneration === modalGeneration
    ) {
      return state.workloadExplainInflight;
    }
    state.workloadExplainProductId = pid;
    state.workloadExplainGeneration = modalGeneration;
    state.workloadExplainError = null;
    const request = (async () => {
      const response = await invoke(
        RPC.workloadExplain,
        buildWorkloadManagementExplainRpcArgs({
          product_id: pid,
          period_start: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.period_start,
          valuation_date: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.valuation_date,
          refresh_run_id: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id,
        }),
        "Unable to load Workload Explain.",
      );
      if (modalGeneration !== state.workloadProductModalGeneration) {
        return { ok: false, stale: true };
      }
      if (pid !== state.workloadExplainProductId) {
        return { ok: false, stale: true };
      }
      if (!response.ok) {
        state.workloadExplainError =
          response.error?.message || "Unable to load Workload Explain.";
        state.workloadExplainPayload = null;
        return { ok: false, error: response.error };
      }
      const payload = normalizePrmWorkloadManagementExplainPayload(
        response.data,
      );
      state.workloadExplainPayload = payload;
      state.workloadExplainError = null;
      return { ok: true, payload };
    })();
    state.workloadExplainInflight = request;
    try {
      return await request;
    } finally {
      if (state.workloadExplainInflight === request) {
        state.workloadExplainInflight = null;
      }
    }
  }

  async function fillWorkloadExplainPanel(host, productId, modalGeneration, pool) {
    const panel = host?.querySelector?.(
      `[data-prm-workload-summary-panel="${pool}"]`,
    );
    if (!panel) return;
    panel.innerHTML = `<div class="cost-sheet-explain-loading">Loading ${
      pool === "dl" ? "Direct Labour" : "Production Overhead"
    } Explain…</div>`;
    const result = await ensureWorkloadExplainPayload(productId, modalGeneration);
    if (modalGeneration !== state.workloadProductModalGeneration) return;
    if (result?.stale) return;
    if (!result?.ok) {
      panel.innerHTML = `<div class="status">${text(
        result?.error?.message ||
          state.workloadExplainError ||
          "Unable to load Workload Explain.",
      )} <button type="button" class="cp-prm-link-btn" data-prm-workload-explain-retry="${text(
        pool,
      )}">Retry</button></div>`;
      return;
    }
    panel.innerHTML =
      pool === "dl"
        ? buildWorkloadExplainDlPanelHtml(result.payload.direct_labour)
        : buildWorkloadExplainPohPanelHtml(result.payload.production_overhead);
  }

  function openWorkloadProductSummary(
    row,
    { fromStackRestore = false, focusAssignmentId = null } = {},
  ) {
    const pid = normalizePrmIntegerId(row.product_id);
    const focusId = normalizePrmIntegerId(focusAssignmentId);
    const modalGeneration = ++state.workloadProductModalGeneration;
    state.workloadExplainPayload = null;
    state.workloadExplainProductId = pid;
    state.workloadExplainGeneration = modalGeneration;
    state.workloadExplainInflight = null;
    state.workloadExplainError = null;
    const runCue = formatPrmExactRunContextCue(
      PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
    );
    openModal(
      {
        title: row.product_name || `Product ${pid}`,
        subtitle: `Product Workload Summary · ${runCue}`,
        html: `<div class="cp-prm-summary cp-prm-workload-product-summary" data-prm-product-summary data-prm-workload-product-summary data-prm-frozen-exact-run="1" data-prm-workload-modal-generation="${modalGeneration}">
          <section class="cp-detail-section">
            <div class="cp-prm-workload-explain-identity cp-prm-workload-explain-strip">
              ${workloadExplainStripItem("Product", row.product_name || "—")}
              ${workloadExplainStripItem("Product ID", pid)}
              ${workloadExplainStripItem(
                "Product Group",
                formatPrmProductGroupHierarchyLabel(row) ||
                  row.product_group_name ||
                  "—",
              )}
              ${workloadExplainStripItem(
                "Frozen Run",
                PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id,
              )}
              ${workloadExplainStripItem(
                "Valuation Date",
                formatPrmDayMonthYearLabel(
                  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.valuation_date,
                ) || PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.valuation_date,
              )}
              ${workloadExplainStripItem(
                "Preferred Batch",
                formatPrmWorkloadPreferredBatch(row),
              )}
              ${workloadExplainStripItem(
                "Route Family",
                row.route_family_name || row.route_family_code || "—",
              )}
              ${workloadExplainStripItem(
                "Route Source",
                row.route_source || row.effective_route_source || "—",
              )}
              ${workloadExplainStripItem(
                "Foundation Status",
                formatPrmFoundationStatusLabel(row.foundation_status) ||
                  row.foundation_status ||
                  "—",
              )}
            </div>
            <p class="cp-muted-text">Frozen exact-run evidence for Workload Foundation and Explain uses Run ${text(
              PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id,
            )}. Current Route Master edits do not rewrite this historical evidence.</p>
          </section>
          <div class="cp-prm-workload-explain-tabs" role="tablist" aria-label="Product workload summary">
            <button type="button" class="cp-prm-workload-explain-tab is-active" role="tab" aria-selected="true" data-prm-workload-summary-tab="overview">Overview</button>
            <button type="button" class="cp-prm-workload-explain-tab" role="tab" aria-selected="false" data-prm-workload-summary-tab="foundation">Foundation</button>
            <button type="button" class="cp-prm-workload-explain-tab" role="tab" aria-selected="false" data-prm-workload-summary-tab="dl">Direct Labour</button>
            <button type="button" class="cp-prm-workload-explain-tab" role="tab" aria-selected="false" data-prm-workload-summary-tab="poh">Production Overhead</button>
            <button type="button" class="cp-prm-workload-explain-tab" role="tab" aria-selected="false" data-prm-workload-summary-tab="route">Route</button>
          </div>
          <div class="cp-prm-workload-explain-panel" data-prm-workload-summary-panel="overview" role="tabpanel">${buildWorkloadOverviewPanelHtml(
            row,
          )}</div>
          <div class="cp-prm-workload-explain-panel hidden" data-prm-workload-summary-panel="foundation" role="tabpanel">
            <div data-prm-workload-host>Loading workload foundation…</div>
          </div>
          <div class="cp-prm-workload-explain-panel hidden" data-prm-workload-summary-panel="dl" role="tabpanel">
            <div class="cp-muted-text">Open this tab to load frozen Direct Labour Explain.</div>
          </div>
          <div class="cp-prm-workload-explain-panel hidden" data-prm-workload-summary-panel="poh" role="tabpanel">
            <div class="cp-muted-text">Open this tab to load frozen Production Overhead Explain.</div>
          </div>
          <div class="cp-prm-workload-explain-panel hidden" data-prm-workload-summary-panel="route" role="tabpanel">
            <section class="cp-detail-section">
              ${workloadSectionHead("Product Route Family Assignment")}
              <div data-prm-assignment-host>Loading assignments…</div>
            </section>
            <section class="cp-detail-section">
              ${workloadSectionHead("Effective Route")}
              <div data-prm-effective-host>Loading effective route…</div>
            </section>
            <p class="cp-muted-text">Route tab shows current master lineage for this Product. It may differ from frozen Run ${text(
              PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id,
            )} Explain evidence.</p>
          </div>
        </div>`,
        bind: (host) => {
          setWorkloadWideModal(true);
          bindSummaryActions(host, "product", row);
          bindProductAssignmentActions(host, row);
          const activateTab = (tab) => {
            host
              .querySelectorAll("[data-prm-workload-summary-tab]")
              .forEach((btn) => {
                const active =
                  btn.getAttribute("data-prm-workload-summary-tab") === tab;
                btn.classList.toggle("is-active", active);
                btn.setAttribute("aria-selected", active ? "true" : "false");
              });
            host
              .querySelectorAll("[data-prm-workload-summary-panel]")
              .forEach((panel) => {
                panel.classList.toggle(
                  "hidden",
                  panel.getAttribute("data-prm-workload-summary-panel") !== tab,
                );
              });
            if (tab === "foundation") {
              void fillProductSummaryWorkloadHost(host, pid);
            }
            if (tab === "dl" || tab === "poh") {
              void fillWorkloadExplainPanel(host, pid, modalGeneration, tab);
            }
            if (tab === "route") {
              void fillProductSummaryAssignmentHost(host, row, {
                focusAssignmentId: focusId,
              });
              void fillProductSummaryEffectiveHost(host, pid);
            }
          };
          onModal(host, "click", (event) => {
            const tabBtn = event.target.closest(
              "[data-prm-workload-summary-tab]",
            );
            if (tabBtn) {
              activateTab(
                tabBtn.getAttribute("data-prm-workload-summary-tab"),
              );
              return;
            }
            const retry = event.target.closest(
              "[data-prm-workload-explain-retry]",
            );
            if (retry) {
              state.workloadExplainPayload = null;
              state.workloadExplainInflight = null;
              void fillWorkloadExplainPanel(
                host,
                pid,
                modalGeneration,
                retry.getAttribute("data-prm-workload-explain-retry"),
              );
            }
          });
        },
        cleanup: () => {
          setWorkloadWideModal(false);
          if (state.workloadProductModalGeneration === modalGeneration) {
            state.workloadExplainPayload = null;
            state.workloadExplainInflight = null;
            state.workloadExplainError = null;
          }
        },
      },
      {
        fromStackRestore,
        replace: isDetailsModalOpen() && !fromStackRestore,
      },
    );
  }

  function openProductSummary(
    row,
    {
      fromStackRestore = false,
      focusAssignmentId = null,
      sourceContext = null,
    } = {},
  ) {
    state.selectedProductId = row.product_id;
    state.selectedProductRouteId =
      normalizePrmIntegerId(row.draft_product_route_id) ??
      normalizePrmIntegerId(row.product_route_id);
    const resolvedContext =
      sourceContext ||
      (state.activeLens === "product-route-assignments"
        ? "ASSIGNMENT_REGISTER"
        : state.activeLens === "shared-workload-preview"
          ? "WORKLOAD_PREVIEW"
          : state.activeLens === "route-readiness"
            ? "EXACT_RUN_READINESS"
            : state.productDetailSourceContext);
    state.productDetailSourceContext = resolvedContext || null;
    if (resolvedContext === "WORKLOAD_PREVIEW") {
      openWorkloadProductSummary(row, {
        fromStackRestore,
        focusAssignmentId,
      });
      return;
    }
    const focusId = normalizePrmIntegerId(focusAssignmentId);
    state.focusAssignmentId = focusId;
    const fromWorkloadPreview = resolvedContext === "WORKLOAD_PREVIEW";
    const asOfLabel = formatPrmDayMonthYearLabel(getAsOfDate()) || getAsOfDate();

    openModal(
      {
        title: row.product_name || `Product ${row.product_id}`,
        subtitle: "Product Route Summary",
        html: `<div class="cp-prm-summary cp-prm-product-summary" data-prm-product-summary>
        <p class="cp-muted-text cp-prm-product-summary-asof" data-prm-as-of-cue>As of ${text(asOfLabel)}</p>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Product / Route Snapshot</h3>
          <div data-prm-product-snapshot-host>Loading live route…</div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Ordered steps</h3>
          <div data-prm-effective-host>Loading effective route…</div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Route Family Assignment</h3>
          <div data-prm-assignment-host>Loading assignments…</div>
        </section>
        <div data-prm-candidate-section-host></div>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Actions</h3>
          <div data-prm-product-actions-host></div>
        </section>
      </div>`,
        bind: (host) => {
          setProductSummaryWideModal(true);
          bindSummaryActions(host, "product", row);
          bindProductAssignmentActions(host, row);
          onModal(host, "click", (event) => {
            if (event.target.closest("[data-prm-load-product-candidate]")) {
              void fillProductSummaryCandidateHost(host, row.product_id);
            }
          });
          void fillProductSummaryAssignmentHost(host, row, {
            focusAssignmentId: focusId,
          });
          void fillProductSummaryEffectiveHost(host, row);
          if (fromWorkloadPreview) {
            void fillProductSummaryWorkloadHost(host, row.product_id);
          }
        },
        cleanup: () => setProductSummaryWideModal(false),
      },
      {
        fromStackRestore,
        replace: isDetailsModalOpen() && !fromStackRestore,
      },
    );
  }

  function workflowHtml(row) {
    const steps = getRouteFamilyWorkflowSteps(row);
    return `<ol class="cp-prm-workflow" aria-label="Route Family workflow">
      ${steps
        .map(
          (step) =>
            `<li data-state="${text(step.state)}"><span class="cp-prm-workflow-mark">${text(step.state === "complete" ? "Complete" : step.state === "current" ? "Current" : "Pending")}</span> ${text(step.label)}</li>`,
        )
        .join("")}
    </ol>
    <p class="cp-muted-text">Next: ${text(getRouteFamilyNextActionLabel(row))}</p>`;
  }

  function mappingsSectionHtml(mappings = []) {
    if (!mappings.length) {
      return `<p class="cp-muted-text">No Product Groups mapped yet.</p>`;
    }
    return `<ul class="cp-prm-mapping-list">${mappings
      .map((raw) => {
        const mapping = normalizePrmRouteFamilyMapping(raw);
        const mappingId = mapping.id ?? mapping.mapping_id;
        const status = mapping.status || mapping.mapping_status;
        const pending = isPrmPendingMappingStatus(status);
        return `<li data-prm-mapping-id="${text(mappingId)}">
          <div class="cp-cell-primary">${text(formatPrmProductGroupHierarchyLabel(mapping) || hierarchy(mapping))}</div>
          <div>${chip(status)} · Effective ${text(mapping.effective_from)}</div>
          <div class="cp-muted-text">Product Group · Basis: ${text(mapping.mapping_basis)} · Note: ${text(mapping.mapping_note)}</div>
          <div class="cp-muted-text">Approval reference: ${text(mapping.approval_reference)}</div>
          ${
            pending
              ? `<div class="cp-prm-actions">
                  <button type="button" class="icon-btn" data-prm-edit-mapping-id="${text(mappingId)}">Edit pending mapping</button>
                  <button type="button" class="icon-btn" data-prm-approve-mapping-id="${text(mappingId)}">Approve mapping</button>
                </div>`
              : ""
          }
        </li>`;
      })
      .join("")}</ul>`;
  }

  function subgroupMappingsSectionHtml(mappings = []) {
    if (!mappings.length) {
      return `<p class="cp-muted-text">No Product Subgroups mapped yet.</p>`;
    }
    return `<ul class="cp-prm-mapping-list">${mappings
      .map((raw) => {
        const mapping = normalizePrmProductSubgroupMapping(raw);
        const label =
          mapping.hierarchy_label ||
          mapping.product_subgroup_name ||
          `Product Subgroup ${mapping.product_subgroup_id ?? ""}`;
        return `<li data-prm-subgroup-mapping-id="${text(mapping.mapping_id)}">
          <div class="cp-cell-primary">${text(label)}</div>
          <div>${chip(mapping.status || mapping.mapping_status)} · Effective ${text(mapping.effective_from)}</div>
          <div class="cp-muted-text">Product Subgroup · Basis: ${text(mapping.mapping_basis)} · Note: ${text(mapping.mapping_note)}</div>
          <div class="cp-muted-text">Approval reference: ${text(mapping.approval_reference)}</div>
        </li>`;
      })
      .join("")}</ul>`;
  }

  function productAssignmentsSectionHtml(assignments = []) {
    if (!assignments.length) {
      return `<p class="cp-muted-text">No direct Product assignments yet.</p>`;
    }
    return `<ul class="cp-prm-mapping-list">${assignments
      .map((raw) => {
        const assignment = normalizePrmProductAssignmentRow(raw);
        const label =
          formatPrmAssignmentProductLabel(assignment) ||
          assignment.product_name ||
          `Product ${assignment.product_id ?? ""}`;
        return `<li data-prm-product-assignment-id="${text(assignment.assignment_id)}">
          <div class="cp-cell-primary">${text(label)}</div>
          <div>${chip(assignment.status)} · Effective ${text(assignment.effective_from)}</div>
          <div class="cp-muted-text">${text(formatPrmRouteFamilyAssignmentSourceLabel("PRODUCT_ASSIGNMENT"))} · Basis: ${text(assignment.assignment_basis)} · Note: ${text(assignment.assignment_note)}</div>
          <div class="cp-muted-text">Approval reference: ${text(assignment.approval_reference)}</div>
        </li>`;
      })
      .join("")}</ul>`;
  }

  function familyAssignmentsSummaryHtml(summary = {}) {
    const counts = summary.counts || { subgroups: 0, groups: 0, products: 0 };
    return `<p class="cp-muted-text cp-prm-assignment-summary-counts">${text(
      counts.subgroups,
    )} Product Subgroups · ${text(counts.groups)} Product Groups · ${text(
      counts.products,
    )} direct Products</p>
    <section class="cp-detail-section cp-prm-assignment-detail">
      <h4 class="cp-section-subtitle">Mapped Product Subgroups</h4>
      ${subgroupMappingsSectionHtml(summary.subgroupMappings || [])}
    </section>
    <section class="cp-detail-section cp-prm-assignment-detail">
      <h4 class="cp-section-subtitle">Mapped Product Groups</h4>
      ${mappingsSectionHtml(summary.groupMappings || [])}
    </section>
    <section class="cp-detail-section cp-prm-assignment-detail">
      <h4 class="cp-section-subtitle">Direct Product Assignments</h4>
      ${productAssignmentsSectionHtml(summary.productAssignments || [])}
    </section>`;
  }

  async function openFamilySummary(row, { fromStackRestore = false } = {}) {
    const routeFamilyId = row.route_family_id ?? row.id;
    state.selectedRouteFamilyId = routeFamilyId;
    await ensureMasterOptions();
    await loadFamilyHistory(routeFamilyId);
    const routeState = resolveRouteFamilyRouteStateFromHistory(
      state.familyHistory,
    );
    const groupMappings = filterPrmRouteFamilyGroupMappings(
      state.routeFamilyMappings,
      routeFamilyId,
    );
    const subgroupMappings = filterPrmRouteFamilySubgroupMappings(
      state.routeFamilySubgroupMappings,
      routeFamilyId,
    );
    const productAssignments = filterPrmRouteFamilyProductAssignments(
      state.assignmentRows || [],
      routeFamilyId,
    );
    const assignmentSummary = summarizePrmRouteFamilyAssignments({
      groupMappings,
      subgroupMappings,
      productAssignments,
    });
    const enriched = {
      ...row,
      ...routeState,
      mappings: groupMappings,
      subgroup_mappings: subgroupMappings,
      product_assignments: productAssignments,
      status: row.status || row.approval_status || "DRAFT",
    };
    const actions = getApplicableRouteFamilyActions(enriched, {
      hasApprovedCostCentres: !state.costCentreBlocker,
    });
    openModal(
      {
      title:
        row.route_family_name ||
        row.family_name ||
        `Manufacturing Route Family ${routeFamilyId}`,
      subtitle: "Route Family Summary",
      html: `<div class="cp-prm-summary">
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Family</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Code</div><div>${text(row.route_family_code || row.family_code)}</div></div>
            <div><div class="cp-field-label">Name</div><div>${text(row.route_family_name || row.family_name)}</div></div>
            <div><div class="cp-field-label">Status</div><div>${chip(enriched.status)}</div></div>
            <div><div class="cp-field-label">Approved family route</div><div>${text(routeState.approved_route_version || routeState.approved_family_route_id)}</div></div>
            <div><div class="cp-field-label">Effective from</div><div>${text(row.effective_from)}</div></div>
            <div><div class="cp-field-label">Effective to</div><div>${text(row.effective_to)}</div></div>
            <div class="cp-detail-span-full"><div class="cp-field-label">Description</div><div>${text(row.description || row.route_family_description)}</div></div>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Workflow</h3>${workflowHtml(enriched)}
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Assignments</h3>${familyAssignmentsSummaryHtml(assignmentSummary)}
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Actions</h3>${actionsHtml(actions)}
        </section>
      </div>`,
      bind: (host) => {
        bindSummaryActions(host, "family", enriched);
        onModal(host, "click", async (event) => {
          const editBtn = event.target.closest("[data-prm-edit-mapping-id]");
          if (editBtn) {
            const mappingId = normalizePrmIntegerId(
              editBtn.getAttribute("data-prm-edit-mapping-id"),
            );
            const selectedMapping =
              groupMappings.find(
                (mapping) =>
                  String(mapping.id ?? mapping.mapping_id) === String(mappingId),
              ) || null;
            if (!selectedMapping) {
              showToast?.("Selected mapping was not found.", "warning");
              return;
            }
            modalParent = { type: "family-summary", row: enriched };
            await openEditPendingMappingModal(selectedMapping, {
              familyRow: enriched,
              nested: true,
            });
            return;
          }
          const approveBtn = event.target.closest(
            "[data-prm-approve-mapping-id]",
          );
          if (!approveBtn) return;
          const mappingId = normalizePrmIntegerId(
            approveBtn.getAttribute("data-prm-approve-mapping-id"),
          );
          const selectedMapping =
            mappings.find(
              (mapping) =>
                String(mapping.id ?? mapping.mapping_id) === String(mappingId),
            ) || null;
          if (!selectedMapping) {
            showToast?.("Selected mapping was not found.", "warning");
            return;
          }
          modalParent = { type: "family-summary", row: enriched };
          await openApproveMappingModal(enriched, {
            selectedMapping,
            nested: true,
          });
        });
      },
      },
      {
        fromStackRestore,
        replace: isDetailsModalOpen() && !fromStackRestore,
      },
    );
  }

  function bindSummaryActions(host, mode, row) {
    onModal(host, "click", async (event) => {
      const button = event.target.closest("[data-prm-summary-action]");
      if (!button) return;
      if (button.disabled || button.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        return;
      }
      const actionId = button.getAttribute("data-prm-summary-action");
      if (actionId === "preferred-batch-size") {
        // Navigation-only handoff; allow natural <a href> or assign in runner.
        event.preventDefault();
      }
      const mappingId = normalizePrmIntegerId(
        button.getAttribute("data-prm-mapping-id"),
      );
      const buttonProductRouteId = normalizePrmIntegerId(
        button.getAttribute("data-prm-product-route-id"),
      );
      const selectedMapping =
        (mappingId != null &&
          coercePrmList(row.mappings)
            .map(normalizePrmRouteFamilyMapping)
            .find(
              (mapping) =>
                String(mapping.id ?? mapping.mapping_id) === String(mappingId),
            )) ||
        null;
      const actionRow = {
        ...(selectedMapping
          ? { ...row, selectedMapping, mapping_id: mappingId }
          : row),
        ...(buttonProductRouteId != null
          ? { draft_product_route_id: buttonProductRouteId }
          : {}),
      };
      await runSummaryAction(actionId, mode, actionRow);
    });
  }

  async function governed(name, built, fallback) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return { ok: false, reason: "permission" };
    }
    return invoke(name, built, fallback);
  }

  async function runSummaryAction(action, mode, row) {
    const productId = row.product_id;
    const routeFamilyId = row.route_family_id ?? row.id;
    if (action === "product-candidate") {
      await openProductCandidateAdvisory(row);
      return;
    }
    if (action === "preferred-batch-size") {
      const handoff = buildPrmPreferredBatchSizeHandoffAction(row);
      const href = handoff.href;
      if (!href) {
        showToast?.("Product ID required for Supply Batch Plan handoff.", "warning");
        return;
      }
      // Navigation only — open Supply Batch Plan in a new window so PRM stays open.
      const opened = window.open(href, "_blank", "noopener,noreferrer");
      if (!opened) {
        showToast?.(
          "Unable to open Supply Batch Plan in a new window. Allow pop-ups for this site, then try again.",
          "warning",
        );
      }
      return;
    }
    if (action === "effective" || action === "view-effective-route") {
      const effectiveProductId = normalizePrmIntegerId(productId);
      if (effectiveProductId == null) {
        showToast?.(
          "Product is required to view the effective route.",
          "warning",
        );
        return;
      }
      navigate("effective-route-viewer", { product_id: effectiveProductId });
      return;
    }
    if (action.includes("candidate") || action.includes("evidence")) {
      state.pendingMapFromEvidence = mode === "family";
      navigate("historical-candidate-review", {
        product_id: productId,
        route_family_id: routeFamilyId,
        candidate_kind: mode === "family" ? "family" : "product",
      });
      return;
    }
    if (action.includes("delta") || action.includes("differences")) {
      navigate("historical-candidate-review", {
        product_id: productId,
        candidate_kind: "delta",
      });
      return;
    }
    if (action === "product-history") {
      const historyResult = await loadProductHistory(productId);
      if (!historyResult.ok) return;
      openHistoryModal(
        "Product route history",
        historyResult.versions,
        "product",
        null,
        normalizePrmIntegerId(productId),
      );
      return;
    }
    if (action.includes("history") && mode === "family") {
      openHistoryModal(
        "Manufacturing Route Family history",
        state.familyHistory,
        "family",
        routeFamilyId,
      );
      return;
    }
    if (action.includes("open-product")) {
      const productIdNorm = normalizePrmIntegerId(productId);
      if (productIdNorm == null) {
        showToast?.("Product is required to open the Product route.", "warning");
        return;
      }
      let routeId =
        normalizePrmIntegerId(row.draft_product_route_id) ??
        normalizePrmIntegerId(row.product_route_id) ??
        normalizePrmIntegerId(state.selectedProductRouteId);
      if (routeId == null) {
        const eligibility = resolvePrmOpenProductRouteEligibility(
          row,
          state.productHistory,
        );
        if (eligibility.current_product_route_ambiguous) {
          showToast?.(
            "Multiple current Product routes exist. Open one from history.",
            "warning",
          );
          return;
        }
        routeId = eligibility.open_product_route_id;
      }
      if (routeId == null) {
        await openProductRouteCreateFromRow(row);
        return;
      }
      navigate("product-route-editor", {
        product_id: productIdNorm,
        product_route_id: routeId,
      });
      return;
    }
    if (action === "open-route-family") {
      const familyId = row.route_family_id;
      if (!normalizePrmIntegerId(familyId)) return;
      pendingOpenRouteFamilyId = familyId;
      navigate("route-families", { route_family_id: familyId });
      return;
    }
    if (action.includes("create-product")) {
      await openProductRouteCreateFromRow(row);
      return;
    }
    if (action.includes("open-family-route")) {
      const familyRouteId =
        row.draft_family_route_id ||
        row.approved_family_route_id ||
        row.family_route_id ||
        resolvePrmEffectiveFamilyRouteId(state.effective);
      if (!normalizePrmIntegerId(familyRouteId)) {
        showToast?.("Family route ID is required to open the editor.", "warning");
        return;
      }
      navigateToFamilyRouteEditor({
        route_family_id: routeFamilyId,
        family_route_id: familyRouteId,
        replace: false,
      });
      return;
    }
    if (action.includes("create-family-route") || action.includes("create-family-version")) {
      modalParent = { type: "family-summary", row };
      await openCreateFamilyRouteDraftModal({
        routeFamilyId,
        supersedesRouteId: action.includes("create-family-version")
          ? row.approved_family_route_id
          : null,
        nested: true,
        source: "summary",
      });
      return;
    }
    if (action === "approve-route-family" || action === "approve-family") {
      modalParent = { type: "family-summary", row };
      await openApproveFamilyModal(row, { nested: true });
      return;
    }
    if (action.includes("map-product-group")) {
      modalParent = { type: "family-summary", row };
      await openMapProductGroupModal(routeFamilyId, {
        fromEvidence: state.pendingMapFromEvidence === true,
        nested: true,
      });
      state.pendingMapFromEvidence = false;
      return;
    }
    if (action === "edit-pending-mapping" || action.includes("edit-pending-mapping")) {
      const selectedMapping =
        row.selectedMapping ||
        coercePrmList(row.mappings)
          .map(normalizePrmRouteFamilyMapping)
          .find((mapping) => isPrmPendingMappingStatus(mapping.status)) ||
        null;
      if (!selectedMapping?.id && !selectedMapping?.mapping_id) {
        showToast?.("A pending mapping is required.", "warning");
        return;
      }
      modalParent = { type: "family-summary", row };
      await openEditPendingMappingModal(selectedMapping, {
        familyRow: row,
        nested: true,
      });
      return;
    }
    if (action.includes("approve-mapping")) {
      const selectedMapping =
        row.selectedMapping ||
        coercePrmList(row.mappings)
          .map(normalizePrmRouteFamilyMapping)
          .find(
            (mapping) =>
              String(mapping.id ?? mapping.mapping_id) ===
              String(row.mapping_id),
          ) ||
        coercePrmList(row.mappings)
          .map(normalizePrmRouteFamilyMapping)
          .find((mapping) => isPrmPendingMappingStatus(mapping.status)) ||
        null;
      if (!selectedMapping) {
        showToast?.("A pending mapping is required.", "warning");
        return;
      }
      modalParent = { type: "family-summary", row };
      await openApproveMappingModal(row, {
        selectedMapping,
        nested: true,
      });
      return;
    }
    if (action === "assign-route-family") {
      state.preselectProductGroupId = normalizePrmIntegerId(
        row.product_group_id,
      );
      state.pendingMapFromEvidence = false;
      navigate("route-families", {
        product_group_id: state.preselectProductGroupId || null,
      });
      showToast?.(
        "Open an approved Manufacturing Route Family and choose Map Product Group. The Product Group is preselected by ID only.",
        "info",
      );
    }
  }

  async function openProductCandidateAdvisory(row) {
    const productId = row.product_id;
    const summaryRoot = document.querySelector("[data-prm-product-summary]");
    const candidateHost = summaryRoot?.querySelector?.("[data-prm-candidate-host]");
    if (candidateHost && summaryRoot) {
      await fillProductSummaryCandidateHost(summaryRoot, productId);
      return;
    }
    openModal(
      {
        title: row.product_name || `Product ${productId}`,
        subtitle: "Advisory candidate preview",
        html: `<div class="cp-prm-summary">
          <p class="cp-prm-form-notice">${text(PRM_CANDIDATE_ADVISORY_LABEL)}</p>
          <div data-prm-candidate-host>Loading advisory candidate…</div>
          <div class="cp-prm-actions" style="margin-top:12px">
            <button type="button" class="icon-btn" data-prm-open-candidate-lens>Open historical candidate review</button>
          </div>
        </div>`,
        bind: (host) => {
          onModal(host, "click", (event) => {
            if (event.target.closest("[data-prm-open-candidate-lens]")) {
              navigate("historical-candidate-review", {
                product_id: productId,
                candidate_kind: "product",
              });
            }
          });
          void fillProductSummaryCandidateHost(host, productId);
        },
      },
      { nested: isDetailsModalOpen() },
    );
  }

  function openCreateAssignmentDraftModal(row = null, prefill = {}) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const registerLaunch = row == null || normalizePrmIntegerId(row.product_id) == null;
    const lockedProductId = registerLaunch
      ? null
      : normalizePrmIntegerId(row.product_id);
    if (!registerLaunch && lockedProductId == null) {
      showToast?.("Product ID is required.", "warning");
      return;
    }
    void (async () => {
      if (!isPrmMasterOptionsReady(state.optionsStatus) || !state.options) {
        const options = await ensureMasterOptions();
        if (!options?.ok) {
          showToast?.(
            "Unable to load Product and Route Family options.",
            "warning",
          );
          return;
        }
      }
      const prefillFamilyId = normalizePrmIntegerId(prefill.route_family_id);
      const basisDefault =
        normalizePrmMappingBasis(prefill.assignment_basis) || "MANUAL";
      const registerBasisLocked =
        registerLaunch && !prefill.fromCandidate;
      const defaultFrom =
        getAsOfDate() || PRM_EXACT_RUN_CONTEXT.period_start || "";
      const candidateNotice = prefill.fromCandidate
        ? "Prefilled from advisory candidate evidence (HISTORICAL_REVIEW). Confirm all fields before creating the draft."
        : "";
      const selectedFamilyId =
        prefillFamilyId ??
        normalizePrmIntegerId(row?.route_family_id) ??
        null;
      const familyOptions = buildAssignmentRouteFamilyOptionsHtml({
        selectedFamilyId,
      });
      const productField = registerLaunch
        ? formField({
            id: "prmAssignProduct",
            label: "Product",
            type: "select",
            required: true,
            full: true,
            optionsHtml: `<option value="">Search or select Product</option>${buildAssignmentProductOptionsHtml()}`,
          })
        : formField({
            id: "prmAssignProduct",
            label: "Product",
            value: row.product_name
              ? `${row.product_name} (${lockedProductId})`
              : String(lockedProductId),
            full: true,
            readonly: true,
          });
      const basisField = registerBasisLocked
        ? formField({
            id: "prmAssignBasis",
            label: "Assignment basis",
            value: "MANUAL",
            readonly: true,
            hint: "Ordinary register creation uses MANUAL. Historical candidate review may prefill HISTORICAL_REVIEW.",
          })
        : formField({
            id: "prmAssignBasis",
            label: "Assignment basis",
            type: "select",
            optionsHtml: buildPrmAssignmentBasisOptionsHtml(basisDefault),
          });
      openModal(
        {
          title: "Create Product Assignment",
          subtitle: "Draft only — further review and approval remain governed",
          html: formShell({
            notice:
              (candidateNotice ? `${candidateNotice} ` : "") +
              "Creates a Product → Route Family assignment draft only. It will not submit or approve automatically.",
            sectionTitle: "Assignment draft",
            fieldsHtml: [
              productField,
              formField({
                id: "prmAssignRouteFamily",
                label: "Route Family",
                type: "select",
                required: true,
                optionsHtml: `<option value="">Select approved Route Family</option>${familyOptions}`,
              }),
              formField({
                id: "prmAssignEffectiveFrom",
                label: "Effective from",
                type: "date",
                value: defaultFrom,
                hint: "Business applicability date. Separate from the approval-event date.",
              }),
              basisField,
              formField({
                id: "prmAssignNote",
                label: "Assignment note",
                type: "textarea",
                full: true,
                placeholder: "Optional note",
              }),
              `<div class="cp-prm-form-field cp-prm-form-field--full" data-prm-assignment-eligibility-host>
                <p class="cp-muted-text">Select a Product to review assignment eligibility.</p>
              </div>`,
            ].join(""),
            actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-assignment-draft-submit>Create assignment draft</button>`,
          }),
          bind: (host) => {
            let eligibilityState = {
              mode: "pending",
              canCreate: false,
              message: "Select a Product to review assignment eligibility.",
              writableAssignment: null,
              approvedAssignment: null,
            };
            let eligibilityLoading = false;
            let eligibilityReady = false;
            let eligibilityErrorDetail = null;
            const eligibilityHost = host.querySelector(
              "[data-prm-assignment-eligibility-host]",
            );
            const submitBtn = host.querySelector(
              "[data-prm-assignment-draft-submit]",
            );
            const productSelect = host.querySelector("#prmAssignProduct");
            const familySelect = host.querySelector("#prmAssignRouteFamily");
            const effectiveInput = host.querySelector("#prmAssignEffectiveFrom");
            const basisSelect = host.querySelector("#prmAssignBasis");
            if (registerLaunch && productSelect?.tagName === "SELECT") {
              enhanceSearchableSelect(productSelect, {
                placeholder: "Search or select Product",
                allowEmptyOption: true,
                openOnFocus: true,
                showAllWhenEmpty: true,
                clearSelectedOnBackspace: true,
                portalLayer: "modal",
              });
            } else if (productSelect && productSelect.tagName !== "SELECT") {
              productSelect.readOnly = true;
              productSelect.setAttribute("aria-readonly", "true");
            }
            if (familySelect) {
              enhanceSearchableSelect(familySelect, {
                placeholder: "Search or select Route Family",
                allowEmptyOption: true,
                openOnFocus: true,
                showAllWhenEmpty: true,
                clearSelectedOnBackspace: true,
                portalLayer: "modal",
              });
            }
            const resolveModalProductId = () =>
              registerLaunch
                ? normalizePrmIntegerId(productSelect?.value)
                : lockedProductId;
            const resolveModalFamilyId = () =>
              normalizePrmIntegerId(familySelect?.value);
            const resolveModalEffectiveFrom = () =>
              String(effectiveInput?.value || "").trim();
            const resolveModalBasis = () => {
              if (registerBasisLocked) return "MANUAL";
              return (
                normalizePrmMappingBasis(basisSelect?.value) || "MANUAL"
              );
            };
            const syncCreateSubmitEnabled = () => {
              if (!submitBtn) return;
              const productOk = resolveModalProductId() != null;
              const familyOk = resolveModalFamilyId() != null;
              const effectiveOk = Boolean(resolveModalEffectiveFrom());
              const basisOk = Boolean(resolveModalBasis());
              const eligible =
                eligibilityReady &&
                !eligibilityLoading &&
                eligibilityState.canCreate === true &&
                eligibilityState.mode !== "load_failed";
              submitBtn.disabled = !(
                canEdit() &&
                productOk &&
                familyOk &&
                effectiveOk &&
                basisOk &&
                eligible
              );
            };
            const paintEligibility = () => {
              if (!eligibilityHost) return;
              const message = eligibilityState.message || "";
              const writableId = normalizePrmIntegerId(
                eligibilityState.writableAssignment?.assignment_id,
              );
              const openExisting =
                writableId != null
                  ? `<button type="button" class="text-link" data-prm-open-existing-assignment="${writableId}">Open existing assignment</button>`
                  : "";
              if (eligibilityState.mode === "load_failed") {
                const detail =
                  eligibilityErrorDetail &&
                  eligibilityErrorDetail !== message
                    ? `<p class="cp-muted-text">${text(eligibilityErrorDetail)}</p>`
                    : "";
                eligibilityHost.innerHTML = `<p class="cp-prm-form-notice">${text(
                  message ||
                    "Unable to load Product Route Family assignments.",
                )}</p>${detail}`;
              } else if (!message) {
                eligibilityHost.innerHTML =
                  '<p class="cp-muted-text">Ready to create a Product Assignment draft.</p>';
              } else {
                eligibilityHost.innerHTML = `<p class="cp-prm-form-notice">${text(message)}${
                  openExisting ? ` ${openExisting}` : ""
                }</p>`;
              }
              syncCreateSubmitEnabled();
            };
            const refreshEligibilityForProduct = async (productId) => {
              if (productId == null) {
                eligibilityLoading = false;
                eligibilityReady = false;
                eligibilityErrorDetail = null;
                eligibilityState = {
                  mode: "pending",
                  canCreate: false,
                  message: "Select a Product to review assignment eligibility.",
                  writableAssignment: null,
                  approvedAssignment: null,
                };
                paintEligibility();
                return;
              }
              eligibilityLoading = true;
              eligibilityReady = false;
              eligibilityErrorDetail = null;
              if (submitBtn) submitBtn.disabled = true;
              if (eligibilityHost) {
                eligibilityHost.innerHTML =
                  '<p class="cp-muted-text">Checking Product assignment eligibility…</p>';
              }
              const checked = await evaluateProductAssignmentCreateEligibility(
                productId,
              );
              eligibilityLoading = false;
              if (!checked.ok) {
                eligibilityReady = false;
                eligibilityErrorDetail = checked.errorDetail || null;
                eligibilityState = {
                  mode: "load_failed",
                  canCreate: false,
                  message:
                    checked.error ||
                    "Unable to load Product Route Family assignments.",
                  writableAssignment: null,
                  approvedAssignment: null,
                };
                paintEligibility();
                return;
              }
              eligibilityReady = true;
              eligibilityErrorDetail = null;
              eligibilityState = checked.eligibility;
              paintEligibility();
            };
            onModal(host, "change", (event) => {
              if (
                event.target === familySelect ||
                event.target === effectiveInput ||
                event.target === basisSelect
              ) {
                syncCreateSubmitEnabled();
              }
            });
            onModal(host, "input", (event) => {
              if (event.target === effectiveInput) {
                syncCreateSubmitEnabled();
              }
            });
            if (registerLaunch && productSelect) {
              onModal(host, "change", (event) => {
                if (event.target !== productSelect) return;
                void refreshEligibilityForProduct(
                  normalizePrmIntegerId(productSelect.value),
                );
              });
              void refreshEligibilityForProduct(null);
            } else {
              void refreshEligibilityForProduct(lockedProductId);
            }
            onModal(host, "click", async (event) => {
              const openExisting = event.target.closest(
                "[data-prm-open-existing-assignment]",
              );
              if (openExisting) {
                const productId = resolveModalProductId();
                const assignmentId = normalizePrmIntegerId(
                  openExisting.getAttribute("data-prm-open-existing-assignment"),
                );
                if (productId == null) return;
                const handoffRow =
                  row && normalizePrmIntegerId(row.product_id) === productId
                    ? row
                    : {
                        product_id: productId,
                        product_name:
                          coercePrmList(state.products).find(
                            (item) =>
                              String(item.product_id ?? item.id) ===
                              String(productId),
                          )?.product_name || null,
                      };
                closeModal({ restorePrevious: false });
                openProductSummary(handoffRow, {
                  focusAssignmentId: assignmentId,
                });
                return;
              }
              const submit = event.target.closest(
                "[data-prm-assignment-draft-submit]",
              );
              if (!submit) return;
              await withMutation(submit, async () => {
                const productId = resolveModalProductId();
                if (productId == null) {
                  showToast?.("Select a Product.", "warning");
                  return { ok: false };
                }
                const checked =
                  await evaluateProductAssignmentCreateEligibility(productId);
                if (!checked.ok) {
                  eligibilityReady = false;
                  eligibilityErrorDetail = checked.errorDetail || null;
                  eligibilityState = {
                    mode: "load_failed",
                    canCreate: false,
                    message:
                      checked.error ||
                      "Unable to load Product Route Family assignments.",
                    writableAssignment: null,
                    approvedAssignment: null,
                  };
                  paintEligibility();
                  showToast?.(
                    checked.errorDetail ||
                      checked.error ||
                      "Unable to load Product Route Family assignments.",
                    "warning",
                  );
                  return { ok: false };
                }
                eligibilityReady = true;
                eligibilityErrorDetail = null;
                eligibilityState = checked.eligibility;
                paintEligibility();
                if (!eligibilityState.canCreate) {
                  showToast?.(
                    eligibilityState.message ||
                      "Create assignment draft is not available for this Product.",
                    "warning",
                  );
                  return { ok: false, reason: eligibilityState.mode };
                }
                const routeFamilyId = resolveModalFamilyId();
                if (routeFamilyId == null) {
                  showToast?.("Select an approved Route Family.", "warning");
                  return { ok: false };
                }
                const effectiveFrom = resolveModalEffectiveFrom();
                if (!effectiveFrom) {
                  showToast?.("Enter Effective from.", "warning");
                  return { ok: false };
                }
                const assignmentBasis = resolveModalBasis();
                if (!assignmentBasis) {
                  showToast?.("Select an assignment basis.", "warning");
                  return { ok: false };
                }
                const noteRaw =
                  host.querySelector("#prmAssignNote")?.value || null;
                const response = await governed(
                  RPC.createAssignmentDraft,
                  buildCreateProductRouteFamilyAssignmentDraftArgs({
                    product_id: productId,
                    route_family_id: routeFamilyId,
                    effective_from: effectiveFrom,
                    assignment_basis: assignmentBasis,
                    assignment_note: noteRaw,
                  }),
                  "Unable to create Product Route Family assignment draft.",
                );
                if (!response.ok) return response;
                const normalized = normalizeProductRouteFamilyAssignmentPayload(
                  response.data,
                );
                const assignmentId = normalized.assignment_id;
                const status = normalized.status || "DRAFT";
                showToast?.(
                  `Assignment draft ${assignmentId ?? "—"} created (${formatPrmAssignmentStatusLabel(status)}). Further review and approval remain governed — nothing was submitted or approved.`,
                  "success",
                  9000,
                );
                closeModal({ restorePrevious: false });
                const handoffRow =
                  row && normalizePrmIntegerId(row.product_id) === productId
                    ? row
                    : {
                        product_id: productId,
                        product_name:
                          coercePrmList(state.products).find(
                            (item) =>
                              String(item.product_id ?? item.id) ===
                              String(productId),
                          )?.product_name || null,
                      };
                await refreshAfterAssignmentMutation(productId, handoffRow, {
                  focusAssignmentId: assignmentId,
                  openProductSummary: !registerLaunch,
                  refreshFailureMessage:
                    "Product Assignment created, but the register could not be refreshed.",
                });
                return response;
              });
            });
          },
        },
        { nested: isDetailsModalOpen() },
      );
    })();
  }

  function openSubmitAssignmentModal(assignment, row) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const assignmentId = normalizePrmIntegerId(assignment.assignment_id);
    if (
      !assignmentId ||
      assignment.status !== "DRAFT" ||
      !assignmentLifecycleIncludes(
        assignment.lifecycle_actions,
        "SUBMIT_FOR_REVIEW",
      )
    ) {
      showToast?.("Submit is not available for this assignment.", "warning");
      return;
    }
    openModal(
      {
        title: "Submit assignment for review",
        subtitle: "Moves the draft into formal review",
        html: formShell({
          notice:
            "This proposal will move to formal review. It will not be approved automatically.",
          sectionTitle: "Assignment summary",
          fieldsHtml: [
            formField({
              id: "prmSubmitAssignId",
              label: "Assignment ID",
              value: String(assignmentId),
            }),
            formField({
              id: "prmSubmitProduct",
              label: "Product",
              value: row.product_name
                ? `${row.product_name} (${row.product_id})`
                : String(row.product_id),
              full: true,
            }),
            formField({
              id: "prmSubmitFamily",
              label: "Route Family",
              value:
                assignment.route_family_name ||
                assignment.route_family_code ||
                assignment.route_family_id,
            }),
            formField({
              id: "prmSubmitEffective",
              label: "Effective from",
              value: assignment.effective_from,
            }),
            formField({
              id: "prmSubmitBasis",
              label: "Assignment basis",
              value: assignment.assignment_basis,
            }),
            formField({
              id: "prmSubmitNote",
              label: "Assignment note",
              type: "textarea",
              value: assignment.assignment_note || "",
              full: true,
            }),
          ].join(""),
          actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-submit-assignment-confirm>Submit for review</button>`,
        }),
        bind: (host) => {
          host.querySelectorAll("input, textarea, select").forEach((el) => {
            el.readOnly = true;
            el.disabled = el.tagName === "SELECT";
          });
          onModal(host, "click", async (event) => {
            const submit = event.target.closest(
              "[data-prm-submit-assignment-confirm]",
            );
            if (!submit) return;
            await withMutation(submit, async () => {
              const response = await governed(
                RPC.submitAssignment,
                buildSubmitProductRouteFamilyAssignmentArgs({
                  assignment_id: assignmentId,
                }),
                "Unable to submit assignment for review.",
              );
              if (!response.ok) return;
              showToast?.("Assignment submitted for review.", "success", 4200);
              await refreshAfterAssignmentMutation(row.product_id, row, {
                refreshFailureMessage:
                  "Product Assignment submitted for review, but the register could not be refreshed.",
              });
              closeModal({ restorePrevious: false });
            });
          });
        },
      },
      { nested: isDetailsModalOpen() },
    );
  }

  function openApproveAssignmentModal(assignment, row) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const assignmentId = normalizePrmIntegerId(assignment.assignment_id);
    if (
      !assignmentId ||
      assignment.status !== "IN_REVIEW" ||
      !assignmentLifecycleIncludes(assignment.lifecycle_actions, "APPROVE")
    ) {
      showToast?.("Approve is not available for this assignment.", "warning");
      return;
    }
    const productId = normalizePrmIntegerId(
      assignment.product_id ?? row?.product_id,
    );
    const familyCode =
      assignment.route_family_code ||
      listApprovedRouteFamiliesForAssignment().find(
        (family) =>
          String(family.route_family_id ?? family.id) ===
          String(assignment.route_family_id),
      )?.route_family_code ||
      assignment.route_family_name ||
      "";
    const identity = resolvePrmProductRouteFamilyAssignmentApprovalIdentity({
      routeFamilyCode: familyCode,
      productId,
      assignment,
      product: row,
    });
    if (!identity.ok) {
      showToast?.(identity.error, "warning");
      return;
    }
    const suggested = buildPrmProductRouteFamilyAssignmentApprovalReference({
      routeFamilyCode: identity.routeFamilyCode,
      productId: identity.productId,
      approvalDate: getPrmLocalIsoDate(),
    });
    if (!suggested.ok) {
      showToast?.(suggested.error, "warning");
      return;
    }
    const effectiveDefault =
      assignment.effective_from ||
      PRM_EXACT_RUN_CONTEXT.period_start ||
      getAsOfDate();
    openModal(
      {
        title: "Approve Product Route Family Assignment",
        subtitle: "Governed approval — does not trigger costing refresh",
        html: formShell({
          notice:
            "Approval may change the effective manufacturing route when the date becomes effective. Approving a replacement assignment from a later Effective From date supersedes the current approved assignment on the server. It may affect future DL/POH workload and Product costing readiness. It does not trigger a costing refresh, invoke Stage 03, or retroactively alter stored run-80 costing outputs. The live run-80 readiness projection may change when resolved as of 22 Jul 2026.",
          sectionTitle: "Approval",
          fieldsHtml: [
            formField({
              id: "prmApproveAssignId",
              label: "Assignment ID",
              value: String(assignmentId),
              readonly: true,
            }),
            formField({
              id: "prmApproveAssignProduct",
              label: "Product",
              value: row.product_name
                ? `${row.product_name} (${productId})`
                : String(productId),
              full: true,
              readonly: true,
            }),
            formField({
              id: "prmApproveAssignFamily",
              label: "Route Family",
              value:
                assignment.route_family_name ||
                assignment.route_family_code ||
                assignment.route_family_id,
              readonly: true,
            }),
            formField({
              id: "prmApproveAssignRef",
              label: "Approval reference",
              required: true,
              full: true,
              value: suggested.reference,
              readonly: true,
              hint: PRM_PRODUCT_ROUTE_FAMILY_ASSIGNMENT_APPROVAL_REFERENCE_HELPER_TEXT,
            }),
            formField({
              id: "prmApproveAssignEffective",
              label: "Effective from",
              type: "date",
              value: effectiveDefault,
              required: true,
              hint: "Business applicability date. Separate from the approval-event date used in the reference.",
            }),
          ].join(""),
          actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-approve-assignment-confirm>Approve assignment</button>`,
        }),
        bind: (host) => {
          const refInput = host.querySelector("#prmApproveAssignRef");
          if (refInput) {
            refInput.readOnly = true;
            refInput.setAttribute("aria-readonly", "true");
          }
          onModal(host, "click", async (event) => {
            const submit = event.target.closest(
              "[data-prm-approve-assignment-confirm]",
            );
            if (!submit) return;
            await withMutation(submit, async () => {
              const recomputed =
                buildPrmProductRouteFamilyAssignmentApprovalReference({
                  routeFamilyCode: identity.routeFamilyCode,
                  productId: identity.productId,
                  approvalDate: getPrmLocalIsoDate(),
                });
              if (!recomputed.ok) {
                showToast?.(recomputed.error, "warning");
                return { ok: false, reason: recomputed.reason };
              }
              const checked =
                validatePrmProductRouteFamilyAssignmentApprovalReference(
                  recomputed.reference,
                  {
                    routeFamilyCode: identity.routeFamilyCode,
                    productId: identity.productId,
                    approvalDate: getPrmLocalIsoDate(),
                  },
                );
              if (!checked.ok) {
                showToast?.(checked.error, "warning");
                return { ok: false, reason: checked.reason };
              }
              if (refInput) refInput.value = checked.reference;
              const response = await governed(
                RPC.approveAssignment,
                buildApproveProductRouteFamilyAssignmentArgs({
                  assignment_id: assignmentId,
                  approval_reference: checked.reference,
                  effective_from:
                    host.querySelector("#prmApproveAssignEffective")
                      ?.value || effectiveDefault,
                }),
                "Unable to approve assignment.",
              );
              if (!response.ok) return response;
              showToast?.("Assignment approved.", "success", 4200);
              await refreshAfterAssignmentMutation(productId, row, {
                openProductSummary: false,
                refreshFailureMessage:
                  "Product Assignment approved, but the register could not be refreshed.",
              });
              closeModal({ restorePrevious: false });
              return response;
            });
          });
        },
      },
      { nested: isDetailsModalOpen() },
    );
  }

  function openCancelAssignmentModal(assignment, row) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const assignmentId = normalizePrmIntegerId(assignment.assignment_id);
    if (
      !assignmentId ||
      (assignment.status !== "DRAFT" && assignment.status !== "IN_REVIEW") ||
      !assignmentLifecycleIncludes(assignment.lifecycle_actions, "CANCEL")
    ) {
      showToast?.("Cancel is not available for this assignment.", "warning");
      return;
    }
    openModal(
      {
        title: "Cancel assignment",
        subtitle: "Retains audit history — does not delete the record",
        html: formShell({
          notice:
            "Cancellation retains the assignment as audit history. It does not delete the record, allows a future replacement Draft, and does not trigger refresh or Stage 03.",
          sectionTitle: "Cancellation",
          fieldsHtml: [
            formField({
              id: "prmCancelAssignId",
              label: "Assignment ID",
              value: String(assignmentId),
            }),
            formField({
              id: "prmCancelAssignReason",
              label: "Cancellation reason",
              type: "textarea",
              required: true,
              full: true,
              placeholder: "Meaningful reason required",
            }),
          ].join(""),
          actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-cancel-assignment-confirm>Cancel assignment</button>`,
        }),
        bind: (host) => {
          host.querySelector("#prmCancelAssignReason")?.focus();
          onModal(host, "click", async (event) => {
            const submit = event.target.closest(
              "[data-prm-cancel-assignment-confirm]",
            );
            if (!submit) return;
            await withMutation(submit, async () => {
              const reason = host
                .querySelector("#prmCancelAssignReason")
                ?.value?.trim();
              if (!isMeaningfulPrmCancellationReason(reason)) {
                showToast?.(
                  "Enter a meaningful cancellation reason. Placeholders such as — or N/A are not allowed.",
                  "warning",
                );
                return { ok: false };
              }
              const response = await governed(
                RPC.cancelAssignment,
                buildCancelProductRouteFamilyAssignmentArgs({
                  assignment_id: assignmentId,
                  cancellation_reason: reason,
                }),
                "Unable to cancel assignment.",
              );
              if (!response.ok) return response;
              showToast?.("Assignment cancelled.", "success", 4200);
              await refreshAfterAssignmentMutation(row.product_id, row, {
                refreshFailureMessage:
                  "Product Assignment cancelled, but the register could not be refreshed.",
              });
              closeModal({ restorePrevious: false });
              return response;
            });
          });
        },
      },
      { nested: isDetailsModalOpen() },
    );
  }

  function openInactivateAssignmentModal(assignment, row) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const assignmentId = normalizePrmIntegerId(assignment.assignment_id);
    if (
      !assignmentId ||
      assignment.status !== "APPROVED" ||
      !assignmentLifecycleIncludes(assignment.lifecycle_actions, "INACTIVATE")
    ) {
      showToast?.("Inactivate is not available for this assignment.", "warning");
      return;
    }
    const effectiveDefault =
      assignment.effective_to ||
      PRM_EXACT_RUN_CONTEXT.valuation_date ||
      getAsOfDate();
    openModal(
      {
        title: "Inactivate assignment",
        subtitle: "Ends the approved assignment — record is retained",
        html: formShell({
          notice:
            "Inactivation sets an effective-to date. The assignment record is retained for audit history.",
          sectionTitle: "Inactivation",
          fieldsHtml: [
            formField({
              id: "prmInactivateAssignId",
              label: "Assignment ID",
              value: String(assignmentId),
            }),
            formField({
              id: "prmInactivateEffectiveTo",
              label: "Effective to",
              type: "date",
              value: effectiveDefault,
              required: true,
            }),
          ].join(""),
          actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-inactivate-assignment-confirm>Inactivate assignment</button>`,
        }),
        bind: (host) => {
          onModal(host, "click", async (event) => {
            const submit = event.target.closest(
              "[data-prm-inactivate-assignment-confirm]",
            );
            if (!submit) return;
            await withMutation(submit, async () => {
              const effectiveTo =
                host.querySelector("#prmInactivateEffectiveTo")?.value ||
                effectiveDefault;
              const response = await governed(
                RPC.inactivateAssignment,
                buildInactivateProductRouteFamilyAssignmentArgs({
                  assignment_id: assignmentId,
                  effective_to: effectiveTo,
                }),
                "Unable to inactivate assignment.",
              );
              if (!response.ok) return response;
              showToast?.("Assignment inactivated.", "success", 4200);
              await refreshAfterAssignmentMutation(row.product_id, row, {
                refreshFailureMessage:
                  "Product Assignment inactivated, but the register could not be refreshed.",
              });
              closeModal({ restorePrevious: false });
              return response;
            });
          });
        },
      },
      { nested: isDetailsModalOpen() },
    );
  }

  function openCorrectAssignmentEffectiveFromModal(assignment, row) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const assignmentId = normalizePrmIntegerId(assignment.assignment_id);
    if (!assignmentId || assignment.status !== "APPROVED") {
      showToast?.(
        "Effective-date correction is only available for APPROVED assignments.",
        "warning",
      );
      return;
    }
    const productId = normalizePrmIntegerId(
      assignment.product_id ?? row?.product_id,
    );
    const currentEffectiveFrom = assignment.effective_from || "";
    const productLabel = row?.product_name
      ? `${row.product_name} (${productId ?? row.product_id ?? "—"})`
      : String(productId ?? assignment.product_id ?? "—");
    const familyLabel =
      assignment.route_family_name ||
      assignment.route_family_code ||
      assignment.route_family_id ||
      "—";
    openModal(
      {
        title: "Correct effective date",
        subtitle: "Administrative correction — assignment remains APPROVED",
        html: formShell({
          notice:
            "Corrects an erroneous approved applicability date only. Does not create a replacement, supersede or inactivate this assignment, change Product or Route Family, alter the original approval reference, or trigger costing refresh / Stage 03.",
          sectionTitle: "Correction",
          fieldsHtml: [
            formField({
              id: "prmCorrectAssignId",
              label: "Assignment ID",
              value: String(assignmentId),
              readonly: true,
            }),
            formField({
              id: "prmCorrectAssignProduct",
              label: "Product",
              value: productLabel,
              full: true,
              readonly: true,
            }),
            formField({
              id: "prmCorrectAssignFamily",
              label: "Route Family",
              value: String(familyLabel),
              readonly: true,
            }),
            formField({
              id: "prmCorrectAssignCurrentFrom",
              label: "Current Effective From",
              value: currentEffectiveFrom || "—",
              readonly: true,
            }),
            formField({
              id: "prmCorrectAssignEffectiveFrom",
              label: "Corrected Effective From",
              type: "date",
              value: currentEffectiveFrom,
              required: true,
            }),
            formField({
              id: "prmCorrectAssignReason",
              label: "Correction Reason",
              type: "textarea",
              full: true,
              required: true,
              placeholder: "Why this approved date is being corrected",
            }),
            formField({
              id: "prmCorrectAssignReference",
              label: "Correction Reference",
              full: true,
              required: true,
              placeholder: "Audit / correction reference",
            }),
          ].join(""),
          actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-correct-assignment-effective-confirm>Apply correction</button>`,
        }),
        bind: (host) => {
          onModal(host, "click", async (event) => {
            const submit = event.target.closest(
              "[data-prm-correct-assignment-effective-confirm]",
            );
            if (!submit) return;
            await withMutation(submit, async () => {
              const correctedFrom = String(
                host.querySelector("#prmCorrectAssignEffectiveFrom")?.value ||
                  "",
              ).trim();
              if (!correctedFrom) {
                showToast?.("Enter Corrected Effective From.", "warning");
                return { ok: false };
              }
              const reason =
                host.querySelector("#prmCorrectAssignReason")?.value || "";
              const reference =
                host.querySelector("#prmCorrectAssignReference")?.value || "";
              if (!isMeaningfulPrmCancellationReason(reason)) {
                showToast?.(
                  "Enter a meaningful correction reason. Placeholders such as — or N/A are not allowed.",
                  "warning",
                );
                return { ok: false };
              }
              if (!isMeaningfulPrmApprovalReference(reference)) {
                showToast?.(
                  "Enter a meaningful correction reference. Placeholders such as — or N/A are not allowed.",
                  "warning",
                );
                return { ok: false };
              }
              const response = await governed(
                RPC.correctAssignmentEffectiveFrom,
                buildCorrectProductRouteFamilyAssignmentEffectiveFromArgs({
                  assignment_id: assignmentId,
                  corrected_effective_from: correctedFrom,
                  correction_reason: reason,
                  correction_reference: reference,
                }),
                "Unable to correct assignment effective from.",
              );
              if (!response.ok) return response;
              showToast?.("Assignment effective date corrected.", "success", 4200);
              closeModal({ restorePrevious: false });
              await refreshAfterAssignmentMutation(
                productId ?? row?.product_id,
                row,
                {
                  focusAssignmentId: assignmentId,
                  openProductSummary: false,
                  refreshFailureMessage:
                    "Effective from corrected, but the register could not be refreshed.",
                },
              );
              return response;
            });
          });
        },
      },
      { nested: isDetailsModalOpen() },
    );
  }

  async function findFamilyRow(routeFamilyId) {
    await loadRouteFamilies();
    return (
      state.routeFamilies.find(
        (family) =>
          String(family.route_family_id ?? family.id) ===
          String(routeFamilyId),
      ) || { route_family_id: routeFamilyId }
    );
  }

  async function reloadFamilySummary(routeFamilyId) {
    modalParent = null;
    const row = await findFamilyRow(routeFamilyId);
    await openFamilySummary(row, { fromStackRestore: false });
  }

  function openCreateFamilyModal() {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    openModal({
      title: "Create Manufacturing Route Family",
      subtitle: "Family master only — no Product Group is mapped automatically",
      html: formShell({
        notice:
          "Enter the governed Family identity below. You can approve and map Product Groups after creation.",
        sectionTitle: "Family identity",
        fieldsHtml: [
          formField({
            id: "prmFamilyCode",
            label: "Family code",
            required: true,
            placeholder: "KASHAYAM_REGULAR",
            hint: PRM_FAMILY_FIELD_HELPERS.family_code,
          }),
          formField({
            id: "prmFamilyName",
            label: "Family name",
            required: true,
            placeholder: "Kashayam - Regular",
            hint: PRM_FAMILY_FIELD_HELPERS.family_name,
          }),
          formField({
            id: "prmFamilyEffectiveFrom",
            label: "Effective from",
            type: "date",
            value: getAsOfDate(),
            required: true,
            hint: PRM_FAMILY_FIELD_HELPERS.effective_from,
          }),
          formField({
            id: "prmFamilyDescription",
            label: "Description",
            type: "textarea",
            rows: 3,
            full: true,
            placeholder: "Shared manufacturing process for this Family",
            hint: PRM_FAMILY_FIELD_HELPERS.description,
          }),
        ].join(""),
        actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-create-family-submit>Create Manufacturing Route Family</button>`,
      }),
      bind: (host) => {
        host.querySelector("#prmFamilyCode")?.focus();
        onModal(host, "click", async (event) => {
          const submit = event.target.closest(
            "[data-prm-create-family-submit]",
          );
          if (!submit) return;
          await withMutation(submit, async () => {
            const code = String(
              host.querySelector("#prmFamilyCode")?.value || "",
            )
              .trim()
              .toUpperCase();
            const name = host.querySelector("#prmFamilyName")?.value?.trim();
            const effectiveFrom =
              host.querySelector("#prmFamilyEffectiveFrom")?.value || "";
            const description =
              host.querySelector("#prmFamilyDescription")?.value?.trim() ||
              null;
            if (!code) {
              showToast?.("Family code is required.", "warning");
              return { ok: false };
            }
            if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
              showToast?.(
                "Family code must be uppercase letters, numbers, and underscores, starting with a letter.",
                "warning",
              );
              return { ok: false };
            }
            if (!name) {
              showToast?.("Family name is required.", "warning");
              return { ok: false };
            }
            if (!effectiveFrom) {
              showToast?.("Effective from is required.", "warning");
              return { ok: false };
            }
            const response = await governed(
              RPC.createFamily,
              buildCreateRouteFamilyArgs({
                route_family_code: code,
                route_family_name: name,
                effective_from: effectiveFrom,
                description,
              }),
              "Unable to create Manufacturing Route Family.",
            );
            if (!response.ok) return response;
            const id = extractCreatedRouteFamilyId(response.data);
            showToast?.(
              "Manufacturing Route Family created. No Product Group was mapped.",
              "success",
              4200,
            );
            closeModal({ restorePrevious: false });
            const refresh = await refreshRouteFamiliesAfterMutation({
              refreshFailureMessage:
                "Route Family created, but the register could not be refreshed.",
            });
            if (!refresh?.ok) return response;
            const created = (state.routeFamilies || []).find(
              (family) =>
                String(family.route_family_id ?? family.id) === String(id),
            );
            if (created) {
              await openFamilySummary(created, { fromStackRestore: false });
            } else if (id != null) {
              showToast?.(
                "Route Family created, but the new Family could not be located in the register.",
                "warning",
                7200,
              );
            }
            return response;
          });
        });
      },
    });
  }

  async function openApproveFamilyModal(row, { nested = false } = {}) {
    const routeFamilyId = row.route_family_id ?? row.id;
    const identity = resolvePrmRouteFamilyApprovalIdentity({ detail: row });
    if (!identity.ok) {
      showToast?.(identity.error, "warning");
      return;
    }
    const generated = buildPrmRouteFamilyApprovalReference({
      routeFamilyCode: identity.routeFamilyCode,
      approvalDate: getPrmLocalIsoDate(),
    });
    if (!generated.ok) {
      showToast?.(generated.error, "warning");
      return;
    }
    openModal(
      {
        title: "Approve Route Family",
        subtitle: "Canonical approval reference",
        html: formShell({
          notice:
            "After approval, Map Product Group becomes the next governed action.",
          sectionTitle: "Approval",
          fieldsHtml: [
            formField({
              id: "prmApproveFamilyRef",
              label: "Approval reference",
              required: true,
              full: true,
              readonly: true,
              value: generated.reference,
              hint: PRM_ROUTE_FAMILY_APPROVAL_REFERENCE_HELPER_TEXT,
            }),
          ].join(""),
          actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-approve-family-submit>Approve Route Family</button>`,
        }),
        bind: (host) => {
          host
            .querySelector("[data-prm-approve-family-submit]")
            ?.focus();
          onModal(host, "click", async (event) => {
            const submit = event.target.closest(
              "[data-prm-approve-family-submit]",
            );
            if (!submit) return;
            await withMutation(submit, async () => {
              const currentIdentity = resolvePrmRouteFamilyApprovalIdentity({
                detail: row,
              });
              if (!currentIdentity.ok) {
                showToast?.(currentIdentity.error, "warning");
                return { ok: false, reason: currentIdentity.reason };
              }
              const recomputed = buildPrmRouteFamilyApprovalReference({
                routeFamilyCode: currentIdentity.routeFamilyCode,
                approvalDate: getPrmLocalIsoDate(),
              });
              if (!recomputed.ok) {
                showToast?.(recomputed.error, "warning");
                return { ok: false, reason: recomputed.reason };
              }
              const checked = validatePrmRouteFamilyApprovalReference(
                recomputed.reference,
                {
                  routeFamilyCode: currentIdentity.routeFamilyCode,
                  approvalDate: getPrmLocalIsoDate(),
                },
              );
              if (!checked.ok) {
                showToast?.(checked.error, "warning");
                return { ok: false, reason: checked.reason };
              }
              const response = await governed(
                RPC.approveFamily,
                buildApproveRouteFamilyArgs({
                  route_family_id: routeFamilyId,
                  approval_reference: recomputed.reference,
                }),
                "Unable to approve Manufacturing Route Family.",
              );
              if (!response.ok) return response;
              showToast?.(
                "Manufacturing Route Family approved.",
                "success",
                4200,
              );
              closeModal({ restorePrevious: false });
              const refresh = await refreshRouteFamiliesAfterMutation({
                refreshFailureMessage:
                  "Route Family approved, but the register could not be refreshed.",
              });
              if (refresh?.ok) {
                const approved = (state.routeFamilies || []).find(
                  (family) =>
                    String(family.route_family_id ?? family.id) ===
                    String(routeFamilyId),
                );
                if (approved) {
                  await openFamilySummary(approved, {
                    fromStackRestore: false,
                  });
                }
              }
              return response;
            });
          });
        },
      },
      { nested },
    );
  }

  async function openMapProductGroupModal(
    routeFamilyId,
    { fromEvidence = false, nested = false, mapping_note = "" } = {},
  ) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    if (!state.productGroups.length) {
      await loadMasterOptions();
    }
    const options = buildPrmProductGroupMappingOptions(state.productGroups);
    if (!options.length) {
      showToast?.(
        "No Product Groups are available from master options.",
        "warning",
      );
      return;
    }
    const family =
      state.routeFamilies.find(
        (item) =>
          String(item.route_family_id ?? item.id) === String(routeFamilyId),
      ) || null;
    const effectiveDefault =
      family?.effective_from || getAsOfDate() || "2026-07-01";
    const preselect = normalizePrmIntegerId(state.preselectProductGroupId);
    const defaultBasis = resolveDefaultPrmMappingBasis({ fromEvidence });
    const noteDefault = isBlankPrmValue(mapping_note)
      ? ""
      : String(mapping_note).trim();
    const optionsHtml = `<option value="">Select Product Group</option>${options
      .map(
        (opt) =>
          `<option value="${text(opt.product_group_id)}" ${
            preselect && preselect === opt.product_group_id ? "selected" : ""
          }>${text(opt.label)} · ${text(opt.secondary)}</option>`,
      )
      .join("")}`;
    openModal(
      {
        title: "Map Product Group",
        subtitle:
          "Select by full commercial hierarchy. Names never auto-map.",
        html: formShell({
          notice:
            "Matching commercial names never create mappings. Choose the Product Group explicitly.",
          sectionTitle: "Mapping",
          fieldsHtml: [
            formField({
              id: "prmMapProductGroupSelect",
              label: "Product Group",
              type: "select",
              full: true,
              required: true,
              dataField: "product_group_id",
              optionsHtml,
            }),
            formField({
              id: "prmMapEffectiveFrom",
              label: "Effective from",
              type: "date",
              value: effectiveDefault,
              dataField: "effective_from",
            }),
            formField({
              id: "prmMapBasis",
              label: "Mapping basis",
              type: "select",
              required: true,
              dataField: "mapping_basis",
              optionsHtml: buildPrmMappingBasisOptionsHtml(defaultBasis),
            }),
            formField({
              id: "prmMapNote",
              label: "Mapping note",
              type: "textarea",
              rows: 2,
              full: true,
              value: noteDefault,
              dataField: "mapping_note",
              placeholder: "Optional governance note",
            }),
          ].join(""),
          actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-map-submit>Map Product Group</button>`,
        }),
        bind: (host) => {
          host.querySelector("#prmMapProductGroupSelect")?.focus();
          onModal(host, "click", async (event) => {
            const submit = event.target.closest("[data-prm-map-submit]");
            if (!submit) return;
            await withMutation(submit, async () => {
              // Read live control values only at submit — never open-time defaults.
              const formValues = readPrmMapProductGroupFormValues(host);
              if (!formValues.ok) {
                showToast?.(
                  formValues.errors.join("; ") ||
                    "Complete Product Group and mapping basis.",
                  "warning",
                );
                return { ok: false };
              }
              const response = await governed(
                RPC.mapProductGroup,
                buildMapProductGroupToRouteFamilyArgs({
                  product_group_id: formValues.product_group_id,
                  route_family_id: routeFamilyId,
                  effective_from: formValues.effective_from || getAsOfDate(),
                  mapping_basis: formValues.mapping_basis,
                  mapping_note: formValues.mapping_note,
                }),
                "Unable to map Product Group.",
              );
              if (!response.ok) return response;
              state.preselectProductGroupId = null;
              showToast?.(
                "Product Group mapping created as pending. Approve mapping is the next action.",
                "success",
                4200,
              );
              if (state.activeLens === "route-family-mapping-review") {
                await loadMappingReview({ search: state.search });
              }
              await reloadFamilySummary(routeFamilyId);
              return response;
            });
          });
        },
      },
      { nested },
    );
  }

  async function openEditPendingMappingModal(
    selectedMapping,
    { familyRow = null, nested = false } = {},
  ) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const mapping = normalizePrmRouteFamilyMapping(selectedMapping);
    const mappingId = normalizePrmIntegerId(mapping.id ?? mapping.mapping_id);
    if (!mappingId) {
      showToast?.("A pending mapping is required.", "warning");
      return;
    }
    if (!isPrmPendingMappingStatus(mapping.status || mapping.mapping_status)) {
      showToast?.("Only DRAFT or IN_REVIEW mappings can be edited.", "warning");
      return;
    }
    const routeFamilyId =
      mapping.route_family_id ??
      familyRow?.route_family_id ??
      familyRow?.id ??
      state.selectedRouteFamilyId;
    const currentBasis =
      normalizePrmMappingBasis(mapping.mapping_basis) || "MANUAL";
    openModal(
      {
        title: "Edit pending mapping",
        subtitle: `Mapping ID ${mappingId}`,
        html: formShell({
          notice:
            "Update the draft mapping fields, then approve when the metadata is correct.",
          sectionTitle: "Pending mapping",
          fieldsHtml: [
            formField({
              id: "prmEditMapEffectiveFrom",
              label: "Effective from",
              type: "date",
              value: mapping.effective_from || getAsOfDate(),
              dataField: "effective_from",
            }),
            formField({
              id: "prmEditMapBasis",
              label: "Mapping basis",
              type: "select",
              required: true,
              dataField: "mapping_basis",
              optionsHtml: buildPrmMappingBasisOptionsHtml(currentBasis),
            }),
            formField({
              id: "prmEditMapNote",
              label: "Mapping note",
              type: "textarea",
              rows: 4,
              full: true,
              value: mapping.mapping_note || "",
              dataField: "mapping_note",
              placeholder: "Governance note for this mapping",
            }),
          ].join(""),
          actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-edit-mapping-submit>Save pending mapping</button>`,
        }),
        bind: (host) => {
          host.querySelector("#prmEditMapBasis")?.focus();
          onModal(host, "click", async (event) => {
            const submit = event.target.closest(
              "[data-prm-edit-mapping-submit]",
            );
            if (!submit) return;
            await withMutation(submit, async () => {
              const formValues = readPrmEditMappingFormValues(host);
              if (!formValues.ok) {
                showToast?.(
                  formValues.errors.join("; ") || "Mapping basis is required.",
                  "warning",
                );
                return { ok: false };
              }
              const response = await governed(
                RPC.updateMappingDraft,
                buildUpdateRouteFamilyMappingDraftArgs({
                  mapping_id: mappingId,
                  patch: {
                    effective_from: formValues.effective_from,
                    mapping_basis: formValues.mapping_basis,
                    mapping_note: formValues.mapping_note,
                  },
                }),
                "Unable to update pending mapping.",
              );
              if (!response.ok) return response;
              showToast?.("Pending mapping updated.", "success", 4200);
              await reloadFamilySummary(routeFamilyId);
              return response;
            });
          });
        },
      },
      { nested },
    );
  }

  async function openApproveMappingModal(
    row,
    { selectedMapping = null, mapping_id = null, nested = false } = {},
  ) {
    const routeFamilyId = row.route_family_id ?? row.id;
    const mapping = normalizePrmRouteFamilyMapping(
      selectedMapping || {
        id: mapping_id,
        mapping_id,
        route_family_id: routeFamilyId,
        product_group_id: row.product_group_id,
      },
    );
    const mappingId = normalizePrmIntegerId(mapping.id ?? mapping.mapping_id);
    if (!mappingId) {
      showToast?.("A pending mapping is required.", "warning");
      return;
    }
    const familyCode =
      row.route_family_code || row.family_code || routeFamilyId;
    const productGroupId = mapping.product_group_id;
    const suggested = buildPrmMappingApprovalReferenceTemplate(
      familyCode,
      productGroupId,
      getAsOfDate(),
    );
    const effectiveDefault =
      mapping.effective_from ||
      row.effective_from ||
      getAsOfDate();
    openModal(
      {
        title: "Approve mapping",
        subtitle:
          "Confirm the Product Group to Manufacturing Route Family mapping",
        html: formShell({
          notice:
            "Submit the approval reference and effective date for this mapping.",
          sectionTitle: "Approval",
          fieldsHtml: [
            formField({
              id: "prmApproveMappingRef",
              label: "Approval reference",
              required: true,
              full: true,
              value: suggested,
              hint: PRM_APPROVAL_REFERENCE_HELPER_TEXT,
            }),
            formField({
              id: "prmApproveMappingEffective",
              label: "Effective from",
              type: "date",
              value: effectiveDefault,
              required: true,
            }),
          ].join(""),
          actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-approve-mapping-submit>Approve mapping</button>`,
        }),
        bind: (host) => {
          host.querySelector("#prmApproveMappingRef")?.focus();
          onModal(host, "click", async (event) => {
            const submit = event.target.closest(
              "[data-prm-approve-mapping-submit]",
            );
            if (!submit) return;
            await withMutation(submit, async () => {
              const reference = host
                .querySelector("#prmApproveMappingRef")
                ?.value?.trim();
              if (!isMeaningfulPrmApprovalReference(reference)) {
                showToast?.(
                  "Enter a meaningful approval reference. Placeholders such as — or N/A are not allowed.",
                  "warning",
                );
                return { ok: false };
              }
              const response = await governed(
                RPC.approveMapping,
                buildApproveRouteFamilyMappingArgs({
                  mapping_id: mappingId,
                  approval_reference: reference,
                  effective_from:
                    host.querySelector("#prmApproveMappingEffective")
                      ?.value || getAsOfDate(),
                }),
                "Unable to approve mapping.",
              );
              if (!response.ok) return response;
              showToast?.("Mapping approved.", "success", 4200);
              if (state.activeLens === "route-family-mapping-review") {
                await loadMappingReview({ search: state.search });
              }
              await reloadFamilySummary(routeFamilyId);
              return response;
            });
          });
        },
      },
      { nested },
    );
  }

  function findRouteFamilyById(routeFamilyId) {
    const fid = normalizePrmIntegerId(routeFamilyId);
    if (fid == null) return null;
    return (
      (state.routeFamilies || []).find(
        (row) => normalizePrmIntegerId(row.route_family_id ?? row.id) === fid,
      ) || null
    );
  }

  function buildPrmRouteFamilySelectOptionsHtml(families = [], selectedId = null) {
    const asOf = getAsOfDate();
    const eligible = selectPrmRouteFamiliesForFamilyRouteCreate(families, asOf);
    const selected = normalizePrmIntegerId(selectedId);
    const options = [`<option value="">Select Route Family</option>`];
    for (const family of eligible) {
      const id = normalizePrmIntegerId(family.route_family_id ?? family.id);
      if (id == null) continue;
      options.push(
        `<option value="${text(id)}" ${
          selected === id ? "selected" : ""
        }>${text(formatPrmRouteFamilySelectorLabel(family))}</option>`,
      );
    }
    return options.join("");
  }

  function buildFamilyRouteCreateContextNoticeHtml(eligibility, familyLabel = "") {
    if (!eligibility?.ok) return "";
    const approvedLine = `<div><span class="cp-field-label">Current approved Family Route</span> <span data-prm-approved-family-route-label>${text(
      eligibility.approvedRouteLabel || "None",
    )}</span></div>`;
    if (eligibility.mode === "writable_exists") {
      return `<p class="cp-muted-text">${text(eligibility.message)}</p>${approvedLine}`;
    }
    if (eligibility.mode === "approved_successor") {
      return `<p class="cp-muted-text">${text(eligibility.message)} ${text(
        eligibility.successorNotice || "",
      )}</p>${approvedLine}`;
    }
    return `<div class="cp-detail-grid cp-detail-grid--2col">
      <div><span class="cp-field-label">Route Family</span><div>${text(
        familyLabel,
      )}</div></div>
      ${approvedLine}
    </div>`;
  }

  async function resolveFamilyRouteCreateContext(routeFamilyId) {
    const fid = normalizePrmIntegerId(routeFamilyId);
    if (fid == null) {
      return { ok: false, reason: "missing_route_family_id" };
    }
    const family = findRouteFamilyById(fid);
    if (
      family &&
      !isPrmRouteFamilyEligibleForFamilyRouteCreate(family, getAsOfDate())
    ) {
      return {
        ok: false,
        reason: "ineligible_route_family",
        error: "Selected Route Family is not approved for Family Route creation.",
      };
    }
    const versions = await loadFamilyHistory(fid);
    const routeState = resolveRouteFamilyRouteStateFromHistory(versions);
    const eligibility = resolvePrmFamilyRouteCreateEligibility(routeState);
    return {
      ok: true,
      routeFamilyId: fid,
      family,
      routeState,
      eligibility,
    };
  }

  function applyFamilyRouteCreateModalUi(host, ctx, { successorMode = false } = {}) {
    const eligibility = ctx?.eligibility;
    const formSection = host.querySelector("[data-prm-family-create-form]");
    const contextHost = host.querySelector("[data-prm-family-create-context]");
    const submitBtn = host.querySelector("[data-prm-family-route-draft-submit]");
    const successorBtn = host.querySelector(
      "[data-prm-family-create-successor-start]",
    );
    const openExistingBtn = host.querySelector(
      "[data-prm-family-create-open-existing]",
    );
    if (contextHost) {
      contextHost.innerHTML = buildFamilyRouteCreateContextNoticeHtml(
        eligibility,
        formatPrmRouteFamilySelectorLabel(ctx?.family || {}),
      );
    }
    const writable = eligibility?.mode === "writable_exists";
    const approvedSuccessor =
      eligibility?.mode === "approved_successor" && !successorMode;
    const showForm =
      eligibility?.mode === "first_draft" ||
      (eligibility?.mode === "approved_successor" && successorMode);
    if (formSection) {
      formSection.classList.toggle("hidden", !showForm);
    }
    if (submitBtn) {
      submitBtn.disabled = !showForm;
      submitBtn.classList.toggle("hidden", !showForm);
    }
    if (successorBtn) {
      successorBtn.classList.toggle(
        "hidden",
        !(eligibility?.mode === "approved_successor" && !successorMode),
      );
      if (eligibility?.mode === "approved_successor" && !successorMode) {
        successorBtn.setAttribute(
          "data-prm-approved-family-route-id",
          String(eligibility.approvedRouteId),
        );
      }
    }
    if (openExistingBtn) {
      openExistingBtn.classList.toggle("hidden", !writable);
      if (writable) {
        openExistingBtn.setAttribute(
          "data-prm-family-route-id",
          String(eligibility.writableRouteId),
        );
      }
    }
  }

  async function refreshFamilyRouteEmptyContext(host) {
    const requestGeneration = familyRouteOpenGeneration;
    if (
      !shouldApplyPrmFamilyRouteEmptyContextRefresh({
        selectedFamilyRouteId: state.selectedFamilyRouteId,
        deepLinkFamilyRouteId: state.deepLink?.family_route_id,
        requestGeneration,
        currentGeneration: familyRouteOpenGeneration,
      })
    ) {
      return;
    }
    const selectEl = host.querySelector("[data-prm-family-empty-select]");
    const contextHost = host.querySelector("[data-prm-family-empty-context]");
    const createBtn = host.querySelector("[data-prm-create-family-route-draft]");
    const openBtn = host.querySelector("[data-prm-open-existing-family-route]");
    const openApprovedBtn = host.querySelector(
      "[data-prm-open-approved-family-route]",
    );
    const successorBtn = host.querySelector(
      "[data-prm-create-family-route-successor]",
    );
    const familyId =
      normalizePrmIntegerId(selectEl?.value) ??
      normalizePrmIntegerId(state.familyRouteCreateFamilyId) ??
      normalizePrmIntegerId(state.deepLink.route_family_id);
    state.familyRouteCreateFamilyId = familyId;
    if (familyId != null) {
      if (
        !shouldApplyPrmFamilyRouteEmptyContextRefresh({
          selectedFamilyRouteId: state.selectedFamilyRouteId,
          deepLinkFamilyRouteId: state.deepLink?.family_route_id,
          requestGeneration,
          currentGeneration: familyRouteOpenGeneration,
        })
      ) {
        return;
      }
      state.familyRouteCreateFamilyId = familyId;
      state.selectedRouteFamilyId = familyId;
      state.deepLink = {
        ...state.deepLink,
        route_family_id: familyId,
      };
      delete state.deepLink.family_route_id;
      applyPrmDeepLinkToUrl("route-family-route-editor", state.deepLink, true);
    }
    if (!contextHost) return;
    if (familyId == null) {
      contextHost.innerHTML =
        '<p class="cp-muted-text">Select a Route Family to review route status.</p>';
      createBtn?.classList.remove("hidden");
      openBtn?.classList.add("hidden");
      openApprovedBtn?.classList.add("hidden");
      successorBtn?.classList.add("hidden");
      state.familyRouteCreateEligibility = null;
      return;
    }
    contextHost.innerHTML =
      '<p class="cp-muted-text">Loading Route Family route status…</p>';
    const ctx = await resolveFamilyRouteCreateContext(familyId);
    if (
      !shouldApplyPrmFamilyRouteEmptyContextRefresh({
        selectedFamilyRouteId: state.selectedFamilyRouteId,
        deepLinkFamilyRouteId: state.deepLink?.family_route_id,
        requestGeneration,
        currentGeneration: familyRouteOpenGeneration,
      })
    ) {
      return;
    }
    if (!ctx.ok) {
      contextHost.innerHTML = `<p class="cp-muted-text">${text(
        ctx.error || "Unable to resolve Route Family route status.",
      )}</p>`;
      return;
    }
    state.familyRouteCreateEligibility = ctx.eligibility;
    contextHost.innerHTML = buildFamilyRouteCreateContextNoticeHtml(
      ctx.eligibility,
      formatPrmRouteFamilySelectorLabel(ctx.family || {}),
    );
    const writable = ctx.eligibility.mode === "writable_exists";
    const approvedSuccessor = ctx.eligibility.mode === "approved_successor";
    const firstDraft = ctx.eligibility.mode === "first_draft";
    createBtn?.classList.toggle("hidden", !firstDraft);
    createBtn?.classList.toggle("icon-btn-primary", firstDraft);
    openBtn?.classList.toggle("hidden", !writable);
    openBtn?.classList.toggle("icon-btn-primary", writable);
    openApprovedBtn?.classList.toggle("hidden", !approvedSuccessor);
    openApprovedBtn?.classList.toggle("icon-btn-primary", approvedSuccessor);
    successorBtn?.classList.toggle("hidden", !approvedSuccessor);
    successorBtn?.classList.remove("icon-btn-primary");
    if (writable) {
      openBtn?.setAttribute(
        "data-prm-family-route-id",
        String(ctx.eligibility.writableRouteId),
      );
    }
    if (approvedSuccessor) {
      openApprovedBtn?.setAttribute(
        "data-prm-family-route-id",
        String(ctx.eligibility.approvedRouteId),
      );
      successorBtn?.setAttribute(
        "data-prm-approved-family-route-id",
        String(ctx.eligibility.approvedRouteId),
      );
    }
  }

  function buildFamilyRouteEmptyRenderOptions() {
    const selectedId =
      normalizePrmIntegerId(state.familyRouteCreateFamilyId) ??
      normalizePrmIntegerId(state.deepLink.route_family_id);
    const eligibility = state.familyRouteCreateEligibility;
    return {
      canCreateFamilyRoute: canEdit(),
      familySelectorOptionsHtml: buildPrmRouteFamilySelectOptionsHtml(
        state.routeFamilies,
        selectedId,
      ),
      familyCreateContextHtml: eligibility
        ? buildFamilyRouteCreateContextNoticeHtml(
            eligibility,
            formatPrmRouteFamilySelectorLabel(
              findRouteFamilyById(selectedId) || {},
            ),
          )
        : selectedId
          ? "Loading Route Family route status…"
          : "Select a Route Family to review route status.",
    };
  }

  async function openCreateFamilyRouteDraftModal({
    routeFamilyId = null,
    supersedesRouteId = null,
    nested = false,
    source = null,
  } = {}) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    await ensureMasterOptions();
    const lockedFamilyId =
      normalizePrmIntegerId(routeFamilyId) ??
      normalizePrmIntegerId(state.familyRouteCreateFamilyId) ??
      normalizePrmIntegerId(state.deepLink.route_family_id);
    const explicitSuccessorId = normalizePrmIntegerId(supersedesRouteId);
    const successorMode = explicitSuccessorId != null;
    const asOf = getAsOfDate();
    const buildProvenanceFieldsHtml = () => {
      const provenance = resolvePrmFamilyRouteCreateProvenanceContext({
        supersedesRouteId: successorMode ? explicitSuccessorId : null,
      });
      return [
        formField({
          id: "prmFamilyRouteSource",
          label: "Source type",
          value: formatPrmRouteSourceTypeLabel(provenance.source_type),
          readonly: true,
          disabled: true,
          hint: PRM_FAMILY_ROUTE_CREATE_SOURCE_HELPER,
        }),
        formField({
          id: "prmFamilyRouteEvidence",
          label: "Evidence status",
          value: formatPrmRouteEvidenceStatusLabel(provenance.evidence_status),
          readonly: true,
          disabled: true,
          hint: PRM_FAMILY_ROUTE_CREATE_EVIDENCE_HELPER,
        }),
      ].join("");
    };
    const familyLocked = lockedFamilyId != null;
    const familyFieldHtml = familyLocked
      ? formField({
          id: "prmFamilyRouteFamily",
          label: "Route Family",
          value: formatPrmRouteFamilySelectorLabel(
            findRouteFamilyById(lockedFamilyId) || {},
          ),
          full: true,
          readonly: true,
          disabled: true,
        })
      : formField({
          id: "prmFamilyRouteFamilySelect",
          label: "Route Family",
          type: "select",
          required: true,
          full: true,
          optionsHtml: buildPrmRouteFamilySelectOptionsHtml(
            state.routeFamilies,
            lockedFamilyId,
          ),
        });
    openModal(
      {
        title: "Create Family Route Draft",
        subtitle:
          "Creates a DRAFT route header only. Governed steps are added in the editor.",
        html: formShell({
          notice:
            "Available even when Production cost centres are not yet approved. Steps requiring a cost centre remain unresolved until setup is complete. Approval later requires complete evidence status (Manual complete or Historical complete). Historical evidence remains advisory — it does not auto-approve.",
          sectionTitle: "Route header",
          fieldsHtml: [
            familyFieldHtml,
            `<div data-prm-family-create-context class="cp-detail-span-full"></div>`,
            `<div data-prm-family-create-form class="cp-detail-span-full">
              ${[
                formField({
                  id: "prmFamilyRouteName",
                  label: "Route name",
                  required: true,
                  full: true,
                  placeholder: "e.g. Dry Fine Powder — No-Wash Manufacturing Route",
                }),
                formField({
                  id: "prmFamilyRouteEffective",
                  label: "Effective from",
                  type: "date",
                  value: asOf,
                  required: true,
                }),
                buildProvenanceFieldsHtml(),
                formField({
                  id: "prmFamilyRouteNote",
                  label: "Route note",
                  type: "textarea",
                  rows: 2,
                  full: true,
                  placeholder: "Optional route header note",
                }),
              ].join("")}
            </div>`,
          ].join(""),
          actionsHtml: `<button type="button" class="icon-btn hidden" data-prm-family-create-open-existing>Open existing route</button>
            <button type="button" class="icon-btn hidden" data-prm-family-create-successor-start>Create new route version</button>
            <button type="button" class="icon-btn icon-btn-primary hidden" data-prm-family-route-draft-submit>Create DRAFT</button>`,
        }),
        bind: (host) => {
          let modalSuccessorMode = successorMode;
          let modalApprovedRouteId = explicitSuccessorId;
          const familySelect = host.querySelector("#prmFamilyRouteFamilySelect");
          if (familySelect) {
            enhanceSearchableSelect(familySelect, {
              placeholder: "Search or select Route Family",
              allowEmptyOption: true,
              openOnFocus: true,
              showAllWhenEmpty: true,
              clearSelectedOnBackspace: true,
              portalLayer: "modal",
            });
          }
          const syncContext = async () => {
            const selectedFamilyId =
              lockedFamilyId ??
              normalizePrmIntegerId(familySelect?.value) ??
              null;
            if (selectedFamilyId == null) {
              host.querySelector("[data-prm-family-create-context]").innerHTML =
                '<p class="cp-muted-text">Select a Route Family to review route status.</p>';
              applyFamilyRouteCreateModalUi(host, null);
              return;
            }
            const ctx = await resolveFamilyRouteCreateContext(selectedFamilyId);
            if (!ctx.ok) {
              showToast?.(
                ctx.error || "Unable to resolve Route Family route status.",
                "warning",
              );
              return;
            }
            if (
              ctx.eligibility.mode === "approved_successor" &&
              !modalSuccessorMode
            ) {
              modalApprovedRouteId = ctx.eligibility.approvedRouteId;
            }
            applyFamilyRouteCreateModalUi(host, ctx, {
              successorMode: modalSuccessorMode,
            });
          };
          void syncContext();
          if (familySelect) {
            onModal(host, "change", (event) => {
              if (event.target !== familySelect) return;
              modalSuccessorMode = false;
              modalApprovedRouteId = null;
              void syncContext();
            });
          }
          onModal(host, "click", async (event) => {
            const openExisting = event.target.closest(
              "[data-prm-family-create-open-existing]",
            );
            if (openExisting) {
              const routeId = normalizePrmIntegerId(
                openExisting.getAttribute("data-prm-family-route-id"),
              );
              const familyId =
                lockedFamilyId ??
                normalizePrmIntegerId(familySelect?.value) ??
                null;
              if (routeId == null || familyId == null) return;
              closeModal({ restorePrevious: false });
              navigateToFamilyRouteEditor({
                route_family_id: familyId,
                family_route_id: routeId,
                replace: true,
              });
              return;
            }
            const startSuccessor = event.target.closest(
              "[data-prm-family-create-successor-start]",
            );
            if (startSuccessor) {
              modalSuccessorMode = true;
              modalApprovedRouteId =
                normalizePrmIntegerId(
                  startSuccessor.getAttribute("data-prm-approved-family-route-id"),
                ) ?? modalApprovedRouteId;
              void syncContext();
              return;
            }
            const submit = event.target.closest(
              "[data-prm-family-route-draft-submit]",
            );
            if (!submit) return;
            await withMutation(submit, async () => {
              const selectedFamilyId =
                lockedFamilyId ??
                normalizePrmIntegerId(familySelect?.value) ??
                null;
              if (selectedFamilyId == null) {
                showToast?.("Route Family is required.", "warning");
                return { ok: false };
              }
              const ctx = await resolveFamilyRouteCreateContext(selectedFamilyId);
              if (!ctx.ok) {
                showToast?.(
                  ctx.error || "Unable to resolve Route Family route status.",
                  "warning",
                );
                return { ok: false };
              }
              if (ctx.eligibility.mode === "writable_exists") {
                showToast?.(ctx.eligibility.message, "warning");
                return { ok: false, reason: "writable_exists" };
              }
              const useSuccessor =
                modalSuccessorMode && modalApprovedRouteId != null;
              if (
                ctx.eligibility.mode === "approved_successor" &&
                !useSuccessor
              ) {
                showToast?.(
                  "An approved Family Route already exists. Use Create new route version.",
                  "warning",
                );
                return { ok: false, reason: "approved_successor_required" };
              }
              const provenanceContext = resolvePrmFamilyRouteCreateProvenanceContext({
                supersedesRouteId: useSuccessor ? modalApprovedRouteId : null,
              });
              const provenanceCheck = validatePrmFamilyRouteCreateProvenance(
                provenanceContext,
                {
                  source_type: provenanceContext.source_type,
                  evidence_status: provenanceContext.evidence_status,
                },
              );
              if (!provenanceCheck.ok) {
                showToast?.(provenanceCheck.error, "warning");
                return { ok: false, reason: "invalid_provenance" };
              }
              const routeName = host
                .querySelector("#prmFamilyRouteName")
                ?.value?.trim();
              if (!routeName) {
                showToast?.("Route name is required.", "warning");
                return { ok: false };
              }
              const result = await editor.createFamilyDraft({
                route_family_id: selectedFamilyId,
                route_name: routeName,
                effective_from:
                  host.querySelector("#prmFamilyRouteEffective")?.value || asOf,
                source_type: provenanceCheck.source_type,
                evidence_status: provenanceCheck.evidence_status,
                route_note:
                  host.querySelector("#prmFamilyRouteNote")?.value?.trim() ||
                  null,
                supersedes_route_id: useSuccessor ? modalApprovedRouteId : null,
              });
              if (!result.ok) return result;
              const familyRouteIdNorm = normalizePrmIntegerId(
                result.family_route_id,
              );
              if (familyRouteIdNorm == null) {
                showToast?.(
                  "Created Family route ID was missing from the server response.",
                  "error",
                );
                return { ok: false, error: "missing_family_route_id" };
              }
              showToast?.("Family Route Draft created.", "success", 4200);
              await openCreatedFamilyRoute({
                route_family_id: selectedFamilyId,
                family_route_id: familyRouteIdNorm,
              });
              return result;
            });
          });
          host.querySelector("#prmFamilyRouteName")?.focus();
        },
      },
      { nested },
    );
  }

  async function openCloneFamilyRouteModal(sourceRouteId = null, { nested = false } = {}) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const detail = editor.getFamilyState?.()?.detail || {};
    const sourceId =
      normalizePrmIntegerId(sourceRouteId) ??
      normalizePrmIntegerId(
        detail.family_route_id ??
          detail.route_family_route_id ??
          detail.route_id ??
          detail.id,
      );
    if (sourceId == null) {
      showToast?.("Source family route is required to clone.", "warning");
      return;
    }
    const suggestedName = detail.route_name
      ? `${detail.route_name} (new version)`
      : "";
    openModal(
      {
        title: "Clone as New Version",
        subtitle:
          "Creates a DRAFT successor via the server clone RPC. Steps and lineage are preserved server-side.",
        html: formShell({
          notice:
            "Do not reconstruct steps client-side. After clone, edit the new DRAFT, validate, submit, then approve to supersede the prior APPROVED route.",
          sectionTitle: "New version",
          fieldsHtml: [
            formField({
              id: "prmCloneFamilyEffective",
              label: "Effective from",
              type: "date",
              value: getAsOfDate(),
              required: true,
            }),
            formField({
              id: "prmCloneFamilyName",
              label: "Route name",
              full: true,
              value: suggestedName,
              placeholder: "Optional — defaults from source when blank",
            }),
            formField({
              id: "prmCloneFamilyNote",
              label: "Route note",
              type: "textarea",
              rows: 2,
              full: true,
              placeholder: "Optional note for the new draft version",
            }),
          ].join(""),
          actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-clone-family-submit>Clone as New Version</button>`,
        }),
        bind: (host) => {
          host.querySelector("#prmCloneFamilyEffective")?.focus();
          onModal(host, "click", async (event) => {
            const submit = event.target.closest(
              "[data-prm-clone-family-submit]",
            );
            if (!submit) return;
            await withMutation(submit, async () => {
              const effectiveFrom = host
                .querySelector("#prmCloneFamilyEffective")
                ?.value?.trim();
              if (!effectiveFrom) {
                showToast?.("Effective from is required.", "warning");
                return { ok: false };
              }
              const result = await editor.cloneFamilyDraft({
                source_family_route_id: sourceId,
                effective_from: effectiveFrom,
                route_name:
                  host.querySelector("#prmCloneFamilyName")?.value?.trim() ||
                  null,
                route_note:
                  host.querySelector("#prmCloneFamilyNote")?.value?.trim() ||
                  null,
              });
              if (!result.ok) return result;
              const familyRouteIdNorm = normalizePrmIntegerId(
                result.family_route_id,
              );
              if (familyRouteIdNorm == null) {
                showToast?.(
                  "Cloned Family route ID was missing from the server response.",
                  "error",
                );
                return { ok: false, error: "missing_family_route_id" };
              }
              const routeFamilyId =
                normalizePrmIntegerId(detail.route_family_id) ??
                normalizePrmIntegerId(state.selectedRouteFamilyId);
              closeModal({ restorePrevious: false });
              navigateToFamilyRouteEditor({
                route_family_id: routeFamilyId,
                family_route_id: familyRouteIdNorm,
                replace: true,
              });
              return result;
            });
          });
        },
      },
      { nested },
    );
  }

  async function hydrateProductRouteCreateHandoff(productId) {
    const pid = normalizePrmIntegerId(productId);
    if (pid == null) return null;
    let handoff = state.productRouteCreateHandoff;
    if (
      handoff &&
      normalizePrmIntegerId(handoff.product_id) === pid &&
      normalizePrmIntegerId(handoff.base_route_family_route_id) != null
    ) {
      return handoff;
    }
    let effective = state.effective;
    if (normalizePrmIntegerId(effective?.product_id) !== pid) {
      const loaded = await loadEffective(pid);
      effective = loaded?.ok ? loaded.data : null;
    }
    const baseId = resolvePrmEffectiveFamilyRouteId(effective);
    const routeFamilyId = normalizePrmIntegerId(
      effective?.route_family_id ?? handoff?.route_family_id,
    );
    let familyRouteName = handoff?.family_route_name || "";
    let familyRouteVersion = handoff?.family_route_version || "";
    if (baseId != null && routeFamilyId != null && !familyRouteVersion) {
      const history = (await loadFamilyHistory(routeFamilyId)) || [];
      familyRouteVersion = formatPrmFamilyRouteVersionCopy(baseId, history);
      const match = history.find(
        (row) =>
          (normalizePrmIntegerId(row?.id) ??
            normalizePrmIntegerId(row?.family_route_id)) === baseId,
      );
      familyRouteName =
        match?.route_name ||
        match?.family_route_name ||
        familyRouteName;
    }
    const productRow =
      (state.products || []).find(
        (item) =>
          normalizePrmIntegerId(item.product_id ?? item.id) === pid,
      ) || {};
    const familyRow =
      (state.routeFamilies || []).find(
        (item) =>
          normalizePrmIntegerId(item.route_family_id ?? item.id) ===
          routeFamilyId,
      ) || {};
    handoff = {
      product_id: pid,
      product_name:
        handoff?.product_name ||
        effective?.product_name ||
        productRow.product_name ||
        productRow.name ||
        "",
      route_family_id: routeFamilyId,
      route_family_name:
        handoff?.route_family_name ||
        effective?.route_family_name ||
        familyRow.route_family_name ||
        familyRow.family_name ||
        "",
      base_route_family_route_id: baseId,
      family_route_name: familyRouteName,
      family_route_version: familyRouteVersion,
      as_of_date: getAsOfDate(),
    };
    state.productRouteCreateHandoff = handoff;
    return handoff;
  }

  async function openProductRouteCreateFromRow(row = {}) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const productId = normalizePrmIntegerId(row.product_id);
    if (productId == null) {
      showToast?.("Product is required.", "warning");
      return;
    }
    let effective = state.effective;
    if (normalizePrmIntegerId(effective?.product_id) !== productId) {
      const loaded = await loadEffective(productId);
      if (!loaded?.ok) {
        showToast?.(
          "Unable to load the live Product route. A Product Route was not created.",
          "warning",
        );
        return;
      }
      effective = loaded.data;
    }
    const liveProductRouteId = normalizePrmIntegerId(effective?.product_route_id);
    if (liveProductRouteId != null) {
      showToast?.("A Product route already exists for this Product.", "info");
      state.productRouteCreateHandoff = null;
      await navigate("product-route-editor", {
        product_id: productId,
        product_route_id: liveProductRouteId,
      });
      return;
    }
    const existingHistory = await loadProductHistory(productId);
    const existingEligibility = resolvePrmOpenProductRouteEligibility(
      { product_id: productId, product_route_id: liveProductRouteId },
      existingHistory.versions || [],
    );
    if (existingEligibility.current_product_route_ambiguous) {
      showToast?.(
        "Multiple current Product routes exist. Open one from history.",
        "warning",
      );
      state.productRouteCreateHandoff = null;
      openHistoryModal(
        "Product route history",
        existingHistory.versions || [],
        "product",
        null,
        productId,
      );
      return;
    }
    if (existingEligibility.open_product_route_id != null) {
      showToast?.("A Product route already exists for this Product.", "info");
      state.productRouteCreateHandoff = null;
      await navigate("product-route-editor", {
        product_id: productId,
        product_route_id: existingEligibility.open_product_route_id,
      });
      return;
    }
    const baseId = resolvePrmEffectiveFamilyRouteId(effective);
    if (baseId == null) {
      showToast?.("An approved Family Route is required.", "warning");
      return;
    }
    const readiness = normalizePrmCode(
      effective?.readiness_status || effective?.route_readiness_status,
    ).toUpperCase();
    if (
      readiness === "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING" ||
      readiness === "BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE"
    ) {
      showToast?.(
        "This Product is not eligible to create a Product route from the current live route.",
        "warning",
      );
      return;
    }
    const routeFamilyId = normalizePrmIntegerId(
      effective?.route_family_id ?? row.route_family_id,
    );
    let familyRouteName = "";
    let familyRouteVersion = "";
    if (routeFamilyId != null) {
      const history = (await loadFamilyHistory(routeFamilyId)) || [];
      familyRouteVersion = formatPrmFamilyRouteVersionCopy(baseId, history);
      const match = history.find(
        (item) =>
          (normalizePrmIntegerId(item?.id) ??
            normalizePrmIntegerId(item?.family_route_id)) === baseId,
      );
      familyRouteName =
        match?.route_name || match?.family_route_name || "";
    }
    state.productRouteCreateHandoff = {
      product_id: productId,
      product_name: row.product_name || effective?.product_name || "",
      route_family_id: routeFamilyId,
      route_family_name:
        row.route_family_name || effective?.route_family_name || "",
      base_route_family_route_id: baseId,
      family_route_name: familyRouteName,
      family_route_version: familyRouteVersion,
      as_of_date: getAsOfDate(),
    };
    await navigate("product-route-editor", { product_id: productId });
  }

  async function submitProductRouteCreateDraft(button, host) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const handoff = state.productRouteCreateHandoff || {};
    const productId = normalizePrmIntegerId(
      handoff.product_id ?? state.selectedProductId,
    );
    if (productId == null) {
      showToast?.("Product is required.", "warning");
      return;
    }
    const baseId = normalizePrmIntegerId(handoff.base_route_family_route_id);
    if (baseId == null) {
      showToast?.("An approved Family Route is required.", "warning");
      return;
    }
    const liveProductRouteId = normalizePrmIntegerId(
      state.effective?.product_route_id,
    );
    if (
      liveProductRouteId != null &&
      normalizePrmIntegerId(state.effective?.product_id) === productId
    ) {
      showToast?.("A Product route already exists for this Product.", "info");
      state.productRouteCreateHandoff = null;
      navigate("product-route-editor", {
        product_id: productId,
        product_route_id: liveProductRouteId,
      }, true);
      return;
    }
    const refs = selectPrmProductBatchSizeReferences(state.batchSizeReferences, {
      product_id: productId,
      as_of_date: handoff.as_of_date || getAsOfDate(),
    });
    if (!refs.length) {
      showToast?.(PRM_PRODUCT_ROUTE_CREATE_BATCH_REQUIRED, "warning");
      return;
    }
    const selected = normalizePrmIntegerId(
      host?.querySelector?.("[data-prm-create-batch-ref]")?.value,
    );
    if (selected == null) {
      showToast?.(
        refs.length > 1
          ? "Select a governed Product batch-size reference."
          : PRM_PRODUCT_ROUTE_CREATE_BATCH_REQUIRED,
        "warning",
      );
      return;
    }
    const allowed = refs.some(
      (ref) => normalizePrmIntegerId(ref.batch_size_ref_id) === selected,
    );
    if (!allowed) {
      showToast?.(PRM_PRODUCT_ROUTE_CREATE_BATCH_REQUIRED, "warning");
      return;
    }
    await withMutation(button, async () => {
      const result = await editor.createProductDraft({
        product_id: productId,
        base_route_family_route_id: baseId,
        batch_size_ref_id: selected,
        effective_from: handoff.as_of_date || getAsOfDate(),
        source_type: PRM_PRODUCT_ROUTE_SOURCES[0] || "ROUTE_FAMILY_ONLY",
        evidence_status: "MANUAL_COMPLETE",
      });
      if (!result?.ok) return result;
      const createdId = normalizePrmIntegerId(result.product_route_id);
      if (createdId == null) {
        showToast?.(
          "Created Product route ID was missing from the server response.",
          "error",
        );
        return { ok: false, error: "missing_product_route_id" };
      }
      state.productRouteCreateHandoff = null;
      state.selectedProductRouteId = createdId;
      navigate(
        "product-route-editor",
        {
          product_id: productId,
          product_route_id: createdId,
        },
        true,
      );
      return result;
    });
  }

  function openProductHistoryRoute(version = {}, productId = null) {
    const routeId = resolvePrmProductHistoryRouteId(version);
    if (routeId == null) {
      showToast?.(
        "This history row does not have a valid Product route ID.",
        "warning",
      );
      return false;
    }
    const rowProductId = normalizePrmIntegerId(version.product_id);
    const contextProductId =
      normalizePrmIntegerId(productId) ??
      normalizePrmIntegerId(state.selectedProductId);
    if (
      rowProductId != null &&
      contextProductId != null &&
      rowProductId !== contextProductId
    ) {
      showToast?.(
        "This history row belongs to a different Product.",
        "warning",
      );
      return false;
    }
    const navProductId = rowProductId ?? contextProductId;
    if (navProductId == null) {
      showToast?.("Product is required to open the Product route.", "warning");
      return false;
    }
    navigate("product-route-editor", {
      product_id: navProductId,
      product_route_id: routeId,
    });
    return true;
  }

  function buildProductHistoryTableHtml(versions = [], productId = null) {
    const rows = (versions || [])
      .map((version, index) => {
        const routeId = resolvePrmProductHistoryRouteId(version);
        const openAttr =
          routeId != null
            ? `data-prm-history-open="${routeId}"`
            : `data-prm-history-invalid="1"`;
        const status =
          formatPrmRouteStatusLabel(
            canonicalPrmRouteStatus(version.status) || version.status,
          ) || version.status;
        const source =
          formatPrmRouteSourceTypeLabel(version.source_type || version.source) ||
          version.source_type ||
          version.source ||
          "";
        const evidence =
          formatPrmRouteEvidenceStatusLabel(version.evidence_status) ||
          version.evidence_status ||
          "";
        const baseFamily = formatPrmProductHistoryBaseFamilyRoute(version);
        const openDisabled = routeId == null ? "disabled" : "";
        const rowProductId =
          normalizePrmIntegerId(version.product_id) ??
          normalizePrmIntegerId(productId);
        const productAttr =
          rowProductId != null
            ? `data-prm-history-product-id="${rowProductId}"`
            : "";
        return `<tr class="cp-prm-row" tabindex="0" data-prm-history-row="${index}" ${productAttr} ${openAttr}>
          <td>${text(version.version_label || version.version || version.route_version || routeId)}</td>
          <td>${text(status)}</td>
          <td>${text(version.effective_from)}</td>
          <td>${text(version.effective_to)}</td>
          <td>${text(baseFamily)}</td>
          <td title="${text(version.source_type || version.source)}">${text(source)}</td>
          <td title="${text(version.evidence_status)}">${text(evidence)}</td>
          <td>${text(version.approval_reference)}</td>
          <td class="cp-prm-history-open"><button type="button" class="icon-btn" data-prm-history-open-btn ${openAttr} ${openDisabled}>Open</button></td>
        </tr>`;
      })
      .join("");
    return `<div class="cp-prm-step-table-wrap"><table class="cp-prm-step-table" data-prm-history-table data-prm-product-history>
        <thead><tr><th>Version</th><th>Status</th><th>Effective From</th><th>Effective To</th><th>Base Family Route</th><th>Source</th><th>Evidence</th><th>Approval Reference</th><th>Open</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="9"><div class="status">No history returned.</div></td></tr>`}</tbody>
      </table></div>`;
  }

  function bindProductHistoryOpen(
    host,
    versions = [],
    productId = null,
    { modal = true } = {},
  ) {
    const bind = modal ? onModal : on;
    const openFromTarget = (target) => {
      const rowEl = target?.closest?.("[data-prm-history-row]");
      if (!rowEl || !host.contains(rowEl)) return false;
      const index = Number(rowEl.getAttribute("data-prm-history-row"));
      const version =
        Number.isInteger(index) && index >= 0 ? versions[index] : null;
      const fallbackId = normalizePrmIntegerId(
        rowEl.getAttribute("data-prm-history-open"),
      );
      return openProductHistoryRoute(
        version || { product_route_id: fallbackId },
        productId,
      );
    };
    bind(host, "click", (event) => {
      const hit = event.target.closest(
        "[data-prm-history-open-btn], [data-prm-history-row]",
      );
      if (!hit || !host.contains(hit)) return;
      openFromTarget(hit);
    });
    bind(host, "keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest?.("[data-prm-history-row]");
      if (!row || !host.contains(row)) return;
      if (event.target.closest?.("[data-prm-history-open-btn]")) return;
      event.preventDefault();
      openFromTarget(row);
    });
  }

  function openHistoryModal(
    title,
    versions,
    mode,
    routeFamilyId = null,
    productId = null,
  ) {
    if (mode === "product") {
      openModal({
        title,
        subtitle:
          "Select a version to open in the editor (historical versions are read-only).",
        html: buildProductHistoryTableHtml(versions, productId),
        bind: (host) => bindProductHistoryOpen(host, versions || [], productId),
      });
      return;
    }
    const rows = (versions || [])
      .map((version) => {
        const id = version.family_route_id;
        return `<tr class="cp-prm-row" tabindex="0" data-prm-history-open="${text(id)}">
          <td>${text(version.version_label || version.version || id)}</td>
          <td>${text(formatPrmRouteStatusLabel(canonicalPrmRouteStatus(version.status) || version.status) || version.status)}</td>
          <td>${text(version.effective_from || "—")}</td>
          <td>${text(version.effective_to || "—")}</td>
          <td title="${text(version.source_type)}">${text(formatPrmRouteSourceTypeLabel(version.source_type) || version.source_type || "—")}</td>
          <td title="${text(version.evidence_status)}">${text(formatPrmRouteEvidenceStatusLabel(version.evidence_status) || version.evidence_status || "—")}</td>
          <td>${text(version.approval_reference || "—")}</td>
        </tr>`;
      })
      .join("");
    openModal({
      title,
      subtitle: "Select a version to open in the editor (historical versions are read-only).",
      html: `<div class="cp-prm-step-table-wrap"><table class="cp-prm-step-table" data-prm-history-table>
        <thead><tr><th>Version</th><th>Status</th><th>Effective From</th><th>Effective To</th><th>Source Type</th><th>Evidence Status</th><th>Approval Reference</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7"><div class="status">No history returned.</div></td></tr>`}</tbody>
      </table></div>`,
      bind: (host) => {
        const openVersion = (button) => {
          const id = button.getAttribute("data-prm-history-open");
          if (!id) return;
          navigateToFamilyRouteEditor({
            route_family_id: routeFamilyId,
            family_route_id: id,
            replace: false,
          });
        };
        onModal(host, "click", (event) => {
          const row = event.target.closest("[data-prm-history-open]");
          if (!row) return;
          openVersion(row);
        });
        onModal(host, "keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const row = event.target.closest?.("[data-prm-history-open]");
          if (!row) return;
          event.preventDefault();
          openVersion(row);
        });
      },
    });
  }

  function readinessHeader() {
    const cols = selectPrmReadinessColumns(state.readinessRows);
    return `<tr>${cols.map((col) => `<th>${text(col.label)}</th>`).join("")}</tr>`;
  }

  function assignmentRegisterToolbarHtml() {
    const createBtn = canEdit()
      ? `<button type="button" class="icon-btn icon-btn-primary" data-prm-create-product-assignment>Create Product Assignment</button>`
      : "";
    return `<div class="cp-prm-actions cp-prm-assignment-register-toolbar">${createBtn}</div>`;
  }

  function assignmentRegisterSummaryHtml() {
    const total =
      state.assignmentTotalBaseline != null
        ? state.assignmentTotalBaseline
        : state.assignmentTotalCount;
    const status = normalizePrmCode(state.assignment_status).toUpperCase();
    const statusLabel = status
      ? formatPrmAssignmentStatusLabel(status)
      : "All statuses";
    const focusId = normalizePrmIntegerId(state.assignmentFocusProductId);
    let focusCue = "";
    if (focusId != null) {
      const focusedRow = (state.assignmentRows || []).find(
        (row) => String(row.product_id) === String(focusId),
      );
      const productName = String(focusedRow?.product_name || "").trim();
      focusCue = productName
        ? ` · Focused Product: ${productName}`
        : ` · Focused Product ID: ${focusId}`;
    }
    return `${assignmentRegisterToolbarHtml()}<p class="cp-muted-text cp-prm-assignment-register" data-prm-assignment-register>${text(
      `Assignment lifecycle register · ${total ?? 0} records · ${statusLabel}${focusCue}`,
    )}</p>`;
  }

  function workloadPreviewSummaryHtml() {
    const total =
      state.workloadTotalBaseline != null
        ? state.workloadTotalBaseline
        : state.workloadTotalCount;
    const loaded = (state.workloadRows || []).length;
    const loadedCue =
      total != null && loaded > 0
        ? ` · ${loaded} of ${total} loaded`
        : "";
    return `${exactRunContextHtml(
      PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
    )}<p class="cp-muted-text cp-prm-workload-summary" data-prm-workload-summary>${text(
      formatPrmWorkloadSummaryLine(state.workloadSummary, total) + loadedCue,
    )}</p>`;
  }

  function workloadCellHtml(row, key) {
    if (key === "product_id") {
      return text(row.product_id);
    }
    if (key === "product") {
      return `<span class="cp-cell-primary">${text(row.product_name || "—")}</span>`;
    }
    if (key === "monthly_quantity") {
      const qtyText = formatPrmWorkloadMonthlyQuantity(row);
      const qtyStatus = normalizePrmCode(
        row.monthly_driver_status || row.quantity_driver_status,
      ).toUpperCase();
      const showStatusChip =
        qtyStatus && qtyStatus !== "READY"
          ? ` <span class="cp-prm-badge">${text(
              formatPrmFoundationStatusLabel(qtyStatus) || qtyStatus,
            )}</span>`
          : "";
      return `<span class="cp-prm-workload-compact cp-prm-workload-qty">${text(
        qtyText,
        qtyText,
      )}</span>${showStatusChip}`;
    }
    if (key === "preferred_batch") {
      return text(formatPrmWorkloadPreferredBatch(row));
    }
    if (key === "raw_batch") {
      return text(formatPrmWorkloadRawDisplay(row.raw_batch_requirement));
    }
    if (key === "rounded_batches") {
      return text(formatPrmWorkloadRoundedBatches(row));
    }
    if (key === "route_family") {
      return text(row.route_family_name || row.route_family_code);
    }
    if (key === "dl_steps") {
      return `<span class="cp-prm-workload-compact" title="${text(
        PRM_WORKLOAD_DL_SCOPE_TITLE,
        PRM_WORKLOAD_DL_SCOPE_TITLE,
      )}" aria-label="${text(
        PRM_WORKLOAD_DL_SCOPE_TITLE,
        PRM_WORKLOAD_DL_SCOPE_TITLE,
      )}">${text(formatPrmDlScopeSummary(row))}</span>`;
    }
    if (key === "poh_steps") {
      return `<span class="cp-prm-workload-compact" title="${text(
        PRM_WORKLOAD_POH_SCOPE_TITLE,
        PRM_WORKLOAD_POH_SCOPE_TITLE,
      )}" aria-label="${text(
        PRM_WORKLOAD_POH_SCOPE_TITLE,
        PRM_WORKLOAD_POH_SCOPE_TITLE,
      )}">${text(formatPrmPohScopeSummary(row))}</span>`;
    }
    if (key === "foundation_status") {
      return `<span class="cp-prm-badge">${text(
        formatPrmFoundationStatusLabel(row.foundation_status) ||
          row.foundation_status,
      )}</span>`;
    }
    return text(row[key]);
  }

  function bindWorkloadInfiniteScroll(wrap) {
    if (!wrap || wrap.dataset.prmWorkloadScrollBound === "1") return;
    wrap.dataset.prmWorkloadScrollBound = "1";
    on(wrap, "scroll", () => {
      if (state.activeLens !== "shared-workload-preview") return;
      if (!workloadHasMore()) return;
      if (state.workloadLoading || state.workloadLoadingMore) return;
      const remaining =
        wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight;
      if (remaining > 240) return;
      void loadMoreWorkloadPreview();
    });
  }

  function renderWorkloadPreview({ preserveScroll = false } = {}) {
    const host = hosts();
    const priorScroll = preserveScroll ? host.tableWrap?.scrollTop : null;
    host.tableWrap?.classList.remove("hidden");
    const table = document.getElementById("mainTable");
    if (table) table.style.display = "";
    clearLensOwnedDom();
    if (table) table.setAttribute("data-prm-workload-table", "1");
    bindWorkloadInfiniteScroll(host.tableWrap);
    const headers = [
      { label: "Product ID", title: "Product ID" },
      { label: "Product", title: "Product name" },
      {
        label: "Monthly Quantity",
        title: "Monthly Product quantity with base UOM",
      },
      { label: "Preferred Batch", title: "Preferred batch size" },
      { label: "Raw Batch Requirement", title: PRM_WORKLOAD_BATCH_LABELS.raw },
      {
        label: "Rounded Batches",
        title: PRM_WORKLOAD_BATCH_LABELS.rounded,
      },
      { label: "Route Family", title: "Manufacturing Route Family" },
      { label: "DL Steps", title: PRM_WORKLOAD_DL_SCOPE_TITLE },
      { label: "POH Steps", title: PRM_WORKLOAD_POH_SCOPE_TITLE },
      { label: "Foundation Status", title: "Workload foundation status" },
    ];
    const keys = [
      "product_id",
      "product",
      "monthly_quantity",
      "preferred_batch",
      "raw_batch",
      "rounded_batches",
      "route_family",
      "dl_steps",
      "poh_steps",
      "foundation_status",
    ];
    const colCount = headers.length;
    if (host.tableHead) {
      host.tableHead.innerHTML = `<tr>${headers
        .map(
          (col) =>
            `<th title="${text(col.title, col.title)}">${text(col.label)}</th>`,
        )
        .join("")}</tr>`;
    }
    if (state.permissionDenied) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="status">Permission denied.</div></td></tr>`;
      host.summary.innerHTML = workloadPreviewSummaryHtml();
      return;
    }
    if (state.workloadLoadError) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="status">${text(
        state.workloadLoadError,
      )}</div></td></tr>`;
      host.summary.innerHTML = workloadPreviewSummaryHtml();
      return;
    }
    if (state.workloadLoading && !state.workloadRows.length) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="cost-sheet-explain-loading">Loading Workload Preview…</div></td></tr>`;
      host.summary.innerHTML = workloadPreviewSummaryHtml();
      return;
    }
    if (!state.workloadRows.length) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="status">No workload preview rows for the current filters.</div></td></tr>`;
      host.summary.innerHTML = workloadPreviewSummaryHtml();
      return;
    }
    const footerRows = [];
    if (state.workloadLoadingMore) {
      footerRows.push(
        `<tr data-prm-workload-load-more><td colspan="${colCount}"><div class="cost-sheet-explain-loading">Loading more Products…</div></td></tr>`,
      );
    } else if (state.workloadLoadMoreError) {
      footerRows.push(
        `<tr data-prm-workload-load-more><td colspan="${colCount}"><div class="status">${text(
          state.workloadLoadMoreError,
        )} <button type="button" class="cp-prm-link-btn" data-prm-workload-retry-more>Retry</button></div></td></tr>`,
      );
    } else if (workloadHasMore()) {
      footerRows.push(
        `<tr data-prm-workload-load-more><td colspan="${colCount}"><div class="cp-muted-text">Scroll for more Products…</div></td></tr>`,
      );
    }
    host.tableBody.innerHTML =
      state.workloadRows
        .map(
          (row, index) =>
            `<tr class="cp-prm-row cp-prm-workload-row" tabindex="0" role="button" data-prm-workload-row="${index}">
          ${keys.map((key) => `<td>${workloadCellHtml(row, key)}</td>`).join("")}
        </tr>`,
        )
        .join("") + footerRows.join("");
    host.summary.innerHTML = workloadPreviewSummaryHtml();
    bindRows();
    if (priorScroll != null && host.tableWrap) {
      host.tableWrap.scrollTop = priorScroll;
    }
  }

  function assignmentCellHtml(row, key) {
    if (key === "assignment_id") return text(row.assignment_id);
    if (key === "product") return text(formatPrmAssignmentProductLabel(row));
    if (key === "product_group") {
      return text(formatPrmAssignmentGroupLabel(row));
    }
    if (key === "route_family") {
      return text(formatPrmAssignmentFamilyLabel(row));
    }
    if (key === "status") {
      return `<span class="cp-prm-badge">${text(
        formatPrmAssignmentStatusLabel(row.status),
      )}</span>`;
    }
    if (key === "basis") return text(row.assignment_basis);
    if (key === "effective_from") {
      return text(
        formatPrmDayMonthYearLabel(row.effective_from) || row.effective_from,
      );
    }
    if (key === "effective_to") {
      return text(
        formatPrmDayMonthYearLabel(row.effective_to) || row.effective_to,
      );
    }
    if (key === "reference") {
      return text(formatPrmAssignmentReferenceSummary(row));
    }
    if (key === "overlap") {
      return hasPrmAssignmentOverlap(row.overlap_warning) || row.has_overlap
        ? `<span class="cp-prm-badge cp-prm-badge-warn">Overlap</span>`
        : `<span class="cp-muted-text">—</span>`;
    }
    if (key === "updated") {
      return text(
        formatPrmDayMonthYearLabel(row.updated_at) || row.updated_at,
      );
    }
    return text(null);
  }

  function bindAssignmentRegisterChrome(host) {
    if (host.summary?.classList) {
      host.summary.classList.add("is-visible");
    }
    on(host.summary, "click", (event) => {
      if (event.target.closest("[data-prm-create-product-assignment]")) {
        openCreateAssignmentDraftModal(null);
      }
    });
  }

  function renderAssignments() {
    const host = hosts();
    host.tableWrap?.classList.remove("hidden");
    const table = document.getElementById("mainTable");
    if (table) table.style.display = "";
    clearLensOwnedDom();
    const headers = [
      "Assignment ID",
      "Product",
      "Product Group",
      "Route Family",
      "Status",
      "Basis",
      "Effective from",
      "Effective to",
      "Reference",
      "Overlap",
      "Updated",
    ];
    const keys = [
      "assignment_id",
      "product",
      "product_group",
      "route_family",
      "status",
      "basis",
      "effective_from",
      "effective_to",
      "reference",
      "overlap",
      "updated",
    ];
    const colCount = headers.length;
    if (host.tableHead) {
      host.tableHead.innerHTML = `<tr>${headers
        .map((label) => `<th>${text(label)}</th>`)
        .join("")}</tr>`;
    }
    if (state.permissionDenied) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="status">Permission denied.</div></td></tr>`;
      host.summary.innerHTML = assignmentRegisterSummaryHtml();
      bindAssignmentRegisterChrome(host);
      return;
    }
    if (state.assignmentLoadError) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="status">${text(
        state.assignmentLoadError,
      )}</div></td></tr>`;
      host.summary.innerHTML = assignmentRegisterSummaryHtml();
      bindAssignmentRegisterChrome(host);
      return;
    }
    if (state.assignmentLoading && !state.assignmentRows.length) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="cost-sheet-explain-loading">Loading Product Assignments…</div></td></tr>`;
      host.summary.innerHTML = assignmentRegisterSummaryHtml();
      bindAssignmentRegisterChrome(host);
      return;
    }
    if (!state.assignmentRows.length) {
      const focusId = normalizePrmIntegerId(state.assignmentFocusProductId);
      const emptyMsg =
        focusId != null
          ? "No route assignment is currently available for the focused Product."
          : "No Product Route Family assignments for the current filters.";
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="status">${text(
        emptyMsg,
      )}</div></td></tr>`;
      host.summary.innerHTML = assignmentRegisterSummaryHtml();
      bindAssignmentRegisterChrome(host);
      return;
    }
    const focusId = normalizePrmIntegerId(state.assignmentFocusProductId);
    host.tableBody.innerHTML = state.assignmentRows
      .map((row, index) => {
        const isFocused =
          focusId != null && String(row.product_id) === String(focusId);
        const rowClass = isFocused
          ? `cp-prm-row ${PRM_ACTIVE_ROW_CLASS}`
          : "cp-prm-row";
        return `<tr class="${rowClass}" tabindex="0" role="button" data-prm-assignment-row="${index}"${
          isFocused ? ' aria-current="true"' : ""
        }>
          ${keys.map((key) => `<td>${assignmentCellHtml(row, key)}</td>`).join("")}
        </tr>`;
      })
      .join("");
    host.summary.innerHTML = assignmentRegisterSummaryHtml();
    bindRows();
    bindAssignmentRegisterChrome(host);
  }

  function renderReadiness() {
    const host = hosts();
    host.tableWrap?.classList.remove("hidden");
    const table = document.getElementById("mainTable");
    if (table) table.style.display = "";
    clearLensOwnedDom();
    const cols = selectPrmReadinessColumns(state.readinessRows);
    const colCount = Math.max(cols.length, 1);
    if (host.tableHead) host.tableHead.innerHTML = readinessHeader();
    if (state.permissionDenied) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="status">Permission denied.</div></td></tr>`;
      host.summary.innerHTML = readinessAsOfContextHtml();
      return;
    }
    if (state.readinessLoadError) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="status">${text(state.readinessLoadError)}</div></td></tr>`;
      host.summary.innerHTML = readinessAsOfContextHtml();
      return;
    }
    if (state.loading && !state.readinessRows.length) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="cost-sheet-explain-loading">Loading Route Readiness…</div></td></tr>`;
      host.summary.innerHTML = readinessAsOfContextHtml();
      return;
    }
    if (!state.readinessRows.length) {
      host.tableBody.innerHTML = `<tr><td colspan="${colCount}"><div class="status">No readiness rows for the current filters.</div></td></tr>`;
      host.summary.innerHTML = readinessAsOfContextHtml();
      return;
    }
    host.tableBody.innerHTML = state.readinessRows
      .map(
        (row, index) => `<tr class="cp-prm-row" tabindex="0" data-prm-product-row="${index}">
          ${cols
            .map((col) => `<td>${readinessCellHtml(row, col)}</td>`)
            .join("")}
        </tr>`,
      )
      .join("");
    host.summary.innerHTML = `${readinessAsOfContextHtml()}<div class="cp-prm-cards">${state.readinessRows
      .map(
        (row, index) => `<article class="cp-prm-card cp-prm-row" tabindex="0" data-prm-product-row="${index}">
          <div class="cp-cell-primary">${text(row.product_name)}</div>
          <div>${text(row.route_family_name || row.route_family_code)}</div>
          <div>${chip(row.readiness_status)}</div>
        </article>`,
      )
      .join("")}</div>`;
    bindRows();
  }

  function mappingReviewGroupStateLabel(group = {}) {
    if (group.has_pending_group_mapping === true) return "Pending mapping";
    if (group.has_pending_product_assignment === true) {
      return "Pending Product assignment";
    }
    return "No pending Group mapping";
  }

  async function handoffMappingReviewToMapProductGroup(group) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    if (!group || group.has_pending_group_mapping) return;
    const familyId = normalizePrmIntegerId(group.candidate_route_family_id);
    const groupId = normalizePrmIntegerId(group.product_group_id);
    if (familyId == null || groupId == null) {
      showToast?.(
        "Server candidate Route Family and Product Group are required.",
        "warning",
      );
      return;
    }
    // Close review modal first — never nest Map Product Group on top of it.
    closeModal({ restorePrevious: false });
    state.preselectProductGroupId = groupId;
    state.pendingMapFromEvidence = true;
    await openMapProductGroupModal(familyId, {
      fromEvidence: true,
      mapping_note: buildPrmMappingReviewEvidenceNote(group),
      nested: false,
    });
    state.pendingMapFromEvidence = false;
  }

  function openMappingReviewGroupModal(group) {
    if (!group) return;
    const familyCode = group.candidate_route_family_code;
    const familyName = group.candidate_route_family_name;
    const familyLabel = [familyCode, familyName]
      .filter((v) => !isBlankPrmValue(v))
      .join(" · ");
    const pendingGroup = group.has_pending_group_mapping === true;
    const mappingState = mappingReviewGroupStateLabel(group);
    const editOk = canEdit();
    const canReviewMap =
      editOk &&
      !pendingGroup &&
      group.candidate_class === "SAME_GROUP_SINGLE_FAMILY_EVIDENCE" &&
      normalizePrmIntegerId(group.candidate_route_family_id) != null;
    const productRows = (group.members || [])
      .map(
        (member) => `<tr class="cp-prm-mapping-review-product-row">
          <td>
            <div class="cp-cell-primary">${text(member.product_name || member.product_id)}</div>
          </td>
          <td>${text(member.product_id)}</td>
          <td title="${text(member.readiness_status || "")}">${text(
            formatPrmMappingReviewReadinessLabel(member.readiness_status),
          )}</td>
          <td>${
            member.has_pending_product_assignment
              ? `<span class="cp-prm-badge">Pending Product assignment</span>`
              : `<span class="cp-muted-text">—</span>`
          }</td>
        </tr>`,
      )
      .join("");
    let actionsHtml = "";
    if (pendingGroup) {
      actionsHtml = `<div class="cp-prm-form-actions" data-prm-mapping-review-actions>
        <span class="cp-prm-badge">Pending mapping</span>
        <button type="button" class="icon-btn" data-prm-mapping-review-open-pending>Open pending in Manufacturing Route Families</button>
      </div>`;
    } else if (canReviewMap) {
      actionsHtml = `<div class="cp-prm-form-actions" data-prm-mapping-review-actions>
        <button type="button" class="icon-btn icon-btn-primary" data-prm-mapping-review-review>Review Mapping</button>
      </div>`;
    }

    openModal({
      title: group.product_group_name || `Product Group ${group.product_group_id}`,
      subtitle: "Mapping Review — evidence",
      html: `<div class="cp-prm-summary" data-prm-mapping-review-modal>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Product Group</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Category</div><div>${text(group.category_name)}</div></div>
            <div><div class="cp-field-label">Subcategory</div><div>${text(group.subcategory_name)}</div></div>
            <div><div class="cp-field-label">Product Group</div><div class="cp-cell-primary">${text(
              group.product_group_name || group.product_group_id,
            )}</div></div>
            <div><div class="cp-field-label">Product Group ID</div><div>${text(group.product_group_id)}</div></div>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Current state</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Blocked Products</div><div class="cp-cell-primary">${text(
              group.blocked_product_count,
            )}</div></div>
            <div><div class="cp-field-label">Ready same-group evidence</div><div class="cp-cell-primary">${text(
              group.ready_products_same_group,
            )}</div></div>
            <div class="cp-detail-span-full"><div class="cp-field-label">Candidate class</div><div>${text(
              formatPrmMappingReviewClassLabel(group.candidate_class),
            )}</div></div>
            <div class="cp-detail-span-full"><div class="cp-field-label">Mapping state</div><div>${text(
              mappingState,
            )}</div></div>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Candidate Route Family</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Code</div><div class="cp-cell-primary">${text(
              familyCode || "—",
            )}</div></div>
            <div><div class="cp-field-label">Name</div><div>${text(familyName || "—")}</div></div>
            <div class="cp-detail-span-full"><div class="cp-field-label">Evidence</div><div>${text(
              familyLabel || "—",
            )} · Evidence-backed candidate — review required</div></div>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Affected Products</h3>
          <div class="cp-prm-mapping-review-products-wrap">
            <table class="cp-prm-mapping-review-products">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Product ID</th>
                  <th>Readiness</th>
                  <th>Pending Product Assignment</th>
                </tr>
              </thead>
              <tbody>${
                productRows ||
                `<tr><td colspan="4"><span class="cp-muted-text">No affected Products in this evidence group.</span></td></tr>`
              }</tbody>
            </table>
          </div>
        </section>
        ${actionsHtml}
      </div>`,
      bind: (host) => {
        onModal(host, "click", async (event) => {
          if (event.target.closest("[data-prm-mapping-review-review]")) {
            event.preventDefault();
            await handoffMappingReviewToMapProductGroup(group);
            return;
          }
          if (event.target.closest("[data-prm-mapping-review-open-pending]")) {
            event.preventDefault();
            const familyId = normalizePrmIntegerId(
              group.candidate_route_family_id,
            );
            closeModal({ restorePrevious: false });
            showToast?.(
              "Open Manufacturing Route Families summary to edit or approve the pending Group mapping.",
              "info",
              5200,
            );
            if (familyId != null) {
              navigate("route-families", { route_family_id: familyId });
            } else {
              navigate("route-families");
            }
          }
        });
      },
    });
  }

  function renderMappingReview() {
    const host = hosts();
    host.tableWrap?.classList.remove("hidden");
    const table = document.getElementById("mainTable");
    if (table) table.style.display = "";
    clearLensOwnedDom();
    const payload = state.mappingReviewPayload;
    const counts = getPrmMappingReviewClassSummaryCounts(
      payload?.class_summary,
    );
    const periodLabel =
      formatPrmMonthYearLabel(payload?.period_start) ||
      formatPrmMonthYearLabel(PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT.period_start) ||
      "—";
    const valuationLabel =
      formatPrmDayMonthYearLabel(payload?.valuation_date) ||
      formatPrmDayMonthYearLabel(
        PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT.valuation_date,
      ) ||
      "—";
    const runId =
      payload?.refresh_run_id ??
      PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT.refresh_run_id;
    const asOfLabel =
      formatPrmDayMonthYearLabel(payload?.as_of_date) ||
      formatPrmDayMonthYearLabel(getAsOfDate()) ||
      "—";

    if (host.summary) {
      host.summary.classList.remove("cp-prm-foundation-review-summary-host");
      host.summary.classList.add("is-visible", "cp-prm-mapping-review-summary-host");
      const immutability =
        `Current source review does not rewrite Run ${runId}.`;
      host.summary.innerHTML = `<div
      class="cp-prm-mapping-review-meta"
      data-prm-mapping-review-context
      title="${text(immutability)}"
      aria-description="${text(immutability)}"
    >
      <span data-prm-mapping-review-frozen>Frozen: Run ${text(runId)} · ${text(periodLabel)} · Valuation ${text(valuationLabel)}</span>
      <span class="cp-prm-mapping-review-meta-sep" aria-hidden="true">·</span>
      <span data-prm-mapping-review-asof>Current source: ${text(asOfLabel)}</span>
      <span class="cp-prm-mapping-review-meta-sep" aria-hidden="true">·</span>
      <span data-prm-mapping-review-class-same title="${text(formatPrmMappingReviewClassLabel("SAME_GROUP_SINGLE_FAMILY_EVIDENCE"))}">${text(counts.same_group_products)} Products / ${text(counts.same_group_groups)} mapping-candidate groups</span>
      <span class="cp-prm-mapping-review-meta-sep" aria-hidden="true">·</span>
      <span data-prm-mapping-review-class-no-ready title="${text(formatPrmMappingReviewClassLabel("NO_READY_SAME_GROUP_EVIDENCE"))}">${text(counts.no_ready_products)} Products / ${text(counts.no_ready_groups)} foundation groups</span>
    </div>`;
    }

    host.tableHead.innerHTML = `<tr>
      <th>Category</th>
      <th>Subcategory</th>
      <th>Product Group</th>
      <th class="c-right">Blocked</th>
      <th class="c-right">Ready Evidence</th>
      <th>Candidate Route Family</th>
      <th>Evidence Class</th>
      <th>Mapping State</th>
    </tr>`;

    if (state.mappingReviewLoadError) {
      host.tableBody.innerHTML = `<tr><td colspan="8"><div class="status">${text(state.mappingReviewLoadError)}</div></td></tr>`;
      return;
    }
    if (state.loading && !state.mappingReviewGroups.length) {
      host.tableBody.innerHTML = `<tr><td colspan="8"><div class="cost-sheet-explain-loading">Loading Mapping Review candidates…</div></td></tr>`;
      return;
    }
    if (!state.mappingReviewGroups.length) {
      host.tableBody.innerHTML = `<tr><td colspan="8"><div class="status">No same-group single-family evidence candidates for this exact-run context.</div></td></tr>`;
      return;
    }

    host.tableBody.innerHTML = state.mappingReviewGroups
      .map((group, index) => {
        const familyLabel = [
          group.candidate_route_family_code,
          group.candidate_route_family_name,
        ]
          .filter((v) => !isBlankPrmValue(v))
          .join(" · ");
        const mappingState = mappingReviewGroupStateLabel(group);
        const groupName =
          group.product_group_name || `Product Group ${group.product_group_id}`;
        const ariaLabel = `Open Mapping Review for ${groupName}`;
        return `<tr class="cp-prm-row cp-prm-mapping-review-row" tabindex="0" role="button" data-prm-mapping-review-group="${index}" aria-label="${text(
          ariaLabel,
        )}">
          <td>${text(group.category_name)}</td>
          <td>${text(group.subcategory_name)}</td>
          <td>
            <div class="cp-cell-primary">${text(groupName)}</div>
            <div class="cp-muted-text">Group ${text(group.product_group_id)}</div>
          </td>
          <td class="c-right">${text(group.blocked_product_count)}</td>
          <td class="c-right">${text(group.ready_products_same_group)}</td>
          <td title="${text(familyLabel || "")}">${text(familyLabel || "—")}</td>
          <td>${text(formatPrmMappingReviewClassLabel(group.candidate_class))}</td>
          <td>${text(mappingState)}</td>
        </tr>`;
      })
      .join("");

    bindRows();
  }

  function openFoundationReviewGroupModal(group) {
    if (!group) return;
    const classCode = group.group_evidence_class;
    const classLabel = formatPrmFoundationGroupEvidenceClassLabel(classCode);
    const guidance = formatPrmFoundationReviewGuidanceNote(classCode);
    const note =
      group.approval_note ||
      state.foundationReviewPayload?.approval_note ||
      "Foundation evidence is review-only. It never creates a Route Family, mapping or approved route.";
    const productRows = (group.products || [])
      .map((member, index) => {
        const evidence = normalizePrmCode(member.evidence_class).toUpperCase();
        const canDrill =
          evidence === "HISTORICAL_EVIDENCE_SUFFICIENT" ||
          evidence === "HISTORICAL_EVIDENCE_LIMITED";
        const drill = canDrill
          ? `<button type="button" class="icon-btn" data-prm-foundation-historical="${index}">View Historical Evidence</button>`
          : `<span class="cp-muted-text">—</span>`;
        return `<tr class="cp-prm-foundation-product-row">
          <td><div class="cp-cell-primary">${text(member.product_name || member.product_id)}</div></td>
          <td>${text(member.product_id)}</td>
          <td title="${text(member.evidence_class || "")}">${text(
            formatPrmFoundationProductEvidenceClassLabel(member.evidence_class),
          )}</td>
          <td class="c-right">${text(member.eligible_batches)}</td>
          <td>${text(member.candidate_status || "—")}</td>
          <td>${drill}</td>
        </tr>`;
      })
      .join("");
    const stepRows = (group.family_steps || [])
      .map((step) => {
        const activity =
          step.activity_kind_name ||
          step.activity_short_code ||
          formatPrmFoundationIdLabel("Activity kind", step.activity_kind_id);
        const area =
          step.modal_area_name ||
          (step.modal_area_id != null
            ? formatPrmFoundationIdLabel("Area", step.modal_area_id)
            : "—");
        const plant =
          step.modal_plant_name ||
          (step.modal_plant_id != null
            ? formatPrmFoundationIdLabel("Plant", step.modal_plant_id)
            : "—");
        return `<tr class="cp-prm-foundation-step-row">
          <td>${text(activity)}</td>
          <td>${text(step.activity_short_code || "—")}</td>
          <td title="${text(step.family_evidence_class || "")}">${text(
            formatPrmFoundationFamilyStepEvidenceClassLabel(
              step.family_evidence_class,
            ),
          )}</td>
          <td class="c-right">${text(step.products_supporting_step)}</td>
          <td class="c-right">${text(
            formatPrmFoundationSupportRatio(step.product_support_ratio),
          )}</td>
          <td class="c-right">${text(
            formatPrmFoundationSupportRatio(step.average_product_batch_coverage),
          )}</td>
          <td>${text(area)}</td>
          <td>${text(plant)}</td>
        </tr>`;
      })
      .join("");

    openModal({
      title:
        group.product_group_name || `Product Group ${group.product_group_id}`,
      subtitle: "Foundation Review — evidence",
      html: `<div class="cp-prm-summary" data-prm-foundation-review-modal>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Product Group</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Category</div><div>${text(group.category_name)}</div></div>
            <div><div class="cp-field-label">Subcategory</div><div>${text(group.subcategory_name)}</div></div>
            <div><div class="cp-field-label">Product Group</div><div class="cp-cell-primary">${text(
              group.product_group_name || group.product_group_id,
            )}</div></div>
            <div><div class="cp-field-label">Product Group ID</div><div>${text(group.product_group_id)}</div></div>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Evidence summary</h3>
          <div class="cp-detail-grid cp-detail-grid--2col">
            <div><div class="cp-field-label">Products</div><div class="cp-cell-primary">${text(group.product_count)}</div></div>
            <div><div class="cp-field-label">Sufficient</div><div>${text(group.sufficient_products)}</div></div>
            <div><div class="cp-field-label">Limited</div><div>${text(group.limited_products)}</div></div>
            <div><div class="cp-field-label">No evidence</div><div>${text(group.no_evidence_products)}</div></div>
            <div><div class="cp-field-label">Total eligible batches</div><div>${text(group.total_eligible_batches)}</div></div>
            <div><div class="cp-field-label">Average eligible batches</div><div>${text(
              group.avg_eligible_batches == null ? "—" : group.avg_eligible_batches,
            )}</div></div>
            <div><div class="cp-field-label">Maximum eligible batches</div><div>${text(group.max_eligible_batches)}</div></div>
            <div class="cp-detail-span-full"><div class="cp-field-label">Group evidence class</div><div title="${text(
              classCode || "",
            )}">${text(classLabel)}</div></div>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Products</h3>
          <div class="cp-prm-foundation-products-wrap">
            <table class="cp-prm-foundation-products">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Product ID</th>
                  <th>Evidence Class</th>
                  <th class="c-right">Eligible Batches</th>
                  <th>Candidate Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>${
                productRows ||
                `<tr><td colspan="6"><span class="cp-muted-text">No Products in this group.</span></td></tr>`
              }</tbody>
            </table>
          </div>
        </section>
        <section class="cp-detail-section">
          <h3 class="cp-section-title">Representative family-step evidence</h3>
          <div class="cp-prm-foundation-steps-wrap">
            <table class="cp-prm-foundation-steps">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Code</th>
                  <th>Evidence Class</th>
                  <th class="c-right">Products Supporting</th>
                  <th class="c-right">Support Ratio</th>
                  <th class="c-right">Average Batch Coverage</th>
                  <th>Modal Area</th>
                  <th>Modal Plant</th>
                </tr>
              </thead>
              <tbody>${
                stepRows ||
                `<tr><td colspan="8"><span class="cp-muted-text">No family-step evidence returned for this group.</span></td></tr>`
              }</tbody>
            </table>
          </div>
        </section>
        <p class="cp-prm-form-notice" data-prm-foundation-review-note>${text(guidance)}</p>
        <p class="cp-muted-text" style="margin:6px 0 0">${text(note)}</p>
      </div>`,
      bind: (host) => {
        onModal(host, "click", (event) => {
          const btn = event.target.closest("[data-prm-foundation-historical]");
          if (!btn) return;
          event.preventDefault();
          const idx = Number(btn.getAttribute("data-prm-foundation-historical"));
          const member = (group.products || [])[idx];
          const productId = normalizePrmIntegerId(member?.product_id);
          if (productId == null) return;
          closeModal({ restorePrevious: false });
          navigate("historical-candidate-review", {
            product_id: productId,
            candidate_kind: "product",
          });
        });
      },
    });
  }

  function renderFoundationReview() {
    const host = hosts();
    host.tableWrap?.classList.remove("hidden");
    const table = document.getElementById("mainTable");
    if (table) table.style.display = "";
    clearLensOwnedDom();
    const payload = state.foundationReviewPayload;
    const classMap = getPrmFoundationReviewClassSummaryMap(payload?.class_summary);
    const periodLabel =
      formatPrmMonthYearLabel(payload?.period_start) ||
      formatPrmMonthYearLabel(PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.period_start) ||
      "—";
    const valuationLabel =
      formatPrmDayMonthYearLabel(payload?.valuation_date) ||
      formatPrmDayMonthYearLabel(
        PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.valuation_date,
      ) ||
      "—";
    const runId =
      payload?.refresh_run_id ??
      PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.refresh_run_id;
    const asOfLabel =
      formatPrmDayMonthYearLabel(payload?.as_of_date) ||
      formatPrmDayMonthYearLabel(getAsOfDate()) ||
      "—";
    const targetProducts = payload?.target_product_count ?? 0;
    const targetGroups = payload?.target_product_group_count ?? 0;
    const immutability = `Current source review does not rewrite Run ${runId}.`;

    if (host.summary) {
      host.summary.classList.remove("cp-prm-mapping-review-summary-host");
      host.summary.classList.add(
        "is-visible",
        "cp-prm-foundation-review-summary-host",
      );
      const classChips = PRM_FOUNDATION_REVIEW_GROUP_EVIDENCE_CLASSES.map(
        (code) => {
          const counts = classMap[code] || { group_count: 0, product_count: 0 };
          const short =
            code === "ALL_PRODUCTS_SUFFICIENT"
              ? "all-sufficient groups"
              : code === "MIXED_WITH_SUFFICIENT"
                ? "mixed-with-sufficient"
                : code === "LIMITED_ONLY"
                  ? "limited-only"
                  : code === "LIMITED_AND_NONE"
                    ? "limited + none"
                    : "no-evidence";
          return `<span class="cp-prm-foundation-class-chip" data-prm-foundation-class="${text(
            code,
          )}" title="${text(formatPrmFoundationGroupEvidenceClassLabel(code))}">${text(
            counts.group_count,
          )} ${text(short)}</span>`;
        },
      ).join(
        '<span class="cp-prm-foundation-meta-sep" aria-hidden="true">·</span>',
      );
      host.summary.innerHTML = `<div
      class="cp-prm-foundation-review-meta"
      data-prm-foundation-review-context
      title="${text(immutability)}"
      aria-description="${text(immutability)}"
    >
      <span data-prm-foundation-review-frozen>Frozen: Run ${text(runId)} · ${text(periodLabel)} · Valuation ${text(valuationLabel)}</span>
      <span class="cp-prm-foundation-meta-sep" aria-hidden="true">·</span>
      <span data-prm-foundation-review-asof>Current source: ${text(asOfLabel)}</span>
      <span class="cp-prm-foundation-meta-sep" aria-hidden="true">·</span>
      <span data-prm-foundation-target>${text(targetProducts)} Products · ${text(targetGroups)} uncovered groups</span>
      <span class="cp-prm-foundation-meta-sep" aria-hidden="true">·</span>
      ${classChips}
    </div>`;
    }

    host.tableHead.innerHTML = `<tr>
      <th>Category</th>
      <th>Subcategory</th>
      <th>Product Group</th>
      <th class="c-right">Products</th>
      <th class="c-right">Sufficient</th>
      <th class="c-right">Limited</th>
      <th class="c-right">No Evidence</th>
      <th class="c-right">Eligible Batches</th>
      <th>Evidence Class</th>
    </tr>`;

    if (state.foundationReviewLoadError) {
      host.tableBody.innerHTML = `<tr><td colspan="9"><div class="status">${text(state.foundationReviewLoadError)}</div></td></tr>`;
      return;
    }
    if (state.loading && !state.foundationReviewGroups.length) {
      host.tableBody.innerHTML = `<tr><td colspan="9"><div class="cost-sheet-explain-loading">Loading Foundation Review…</div></td></tr>`;
      return;
    }
    if (!state.foundationReviewGroups.length) {
      host.tableBody.innerHTML = `<tr><td colspan="9"><div class="status">No uncovered Product Group foundation evidence for this exact-run context.</div></td></tr>`;
      return;
    }

    host.tableBody.innerHTML = state.foundationReviewGroups
      .map((group, index) => {
        const groupName =
          group.product_group_name || `Product Group ${group.product_group_id}`;
        const ariaLabel = `Open Foundation Review for ${groupName}`;
        return `<tr class="cp-prm-row cp-prm-foundation-review-row" tabindex="0" role="button" data-prm-foundation-review-group="${index}" aria-label="${text(
          ariaLabel,
        )}">
          <td>${text(group.category_name)}</td>
          <td>${text(group.subcategory_name)}</td>
          <td>
            <div class="cp-cell-primary">${text(groupName)}</div>
            <div class="cp-muted-text">Group ${text(group.product_group_id)}</div>
          </td>
          <td class="c-right">${text(group.product_count)}</td>
          <td class="c-right">${text(group.sufficient_products)}</td>
          <td class="c-right">${text(group.limited_products)}</td>
          <td class="c-right">${text(group.no_evidence_products)}</td>
          <td class="c-right">${text(group.total_eligible_batches)}</td>
          <td title="${text(group.group_evidence_class || "")}">${text(
            formatPrmFoundationGroupEvidenceClassLabel(group.group_evidence_class),
          )}</td>
        </tr>`;
      })
      .join("");

    bindRows();
  }


  function renderRouteFamilies() {
    const host = hosts();
    host.tableWrap?.classList.remove("hidden");
    const table = document.getElementById("mainTable");
    if (table) table.style.display = "";
    clearLensOwnedDom();
    if (host.summary) {
      host.summary.classList.remove(
        "cp-prm-mapping-review-summary-host",
        "cp-prm-foundation-review-summary-host",
        "cp-prm-cost-centres-summary-host",
      );
      host.summary.classList.add(
        "is-visible",
        "cp-prm-route-families-summary-host",
      );
    }
    host.tableHead.innerHTML = `<tr><th>Manufacturing Route Family</th><th>Code</th><th>Status</th><th>Mapped hierarchy</th><th>Approved family route</th></tr>`;
    const createBtn = canEdit()
      ? `<button type="button" class="icon-btn icon-btn-primary" data-prm-create-route-family>Create Route Family</button>`
      : "";
    const toolbar = `<div class="cp-prm-actions cp-prm-route-families-toolbar">
      <button type="button" class="icon-btn" data-prm-open-mapping-review>Open Mapping Review</button>
      <button type="button" class="icon-btn" data-prm-review-pre-mapping>Review pre-mapping evidence</button>
      ${createBtn}
    </div>`;
    if (!state.routeFamilies.length) {
      host.tableBody.innerHTML = `<tr><td colspan="5"><div class="status">
        <p>${text(PRM_EMPTY_STATES.routeFamilies).replace(/\n/g, "<br>")}</p>
        <div class="cp-prm-actions" style="margin-top:12px">
          <button type="button" class="icon-btn" data-prm-empty-review-evidence>Review historical evidence</button>
          ${
            canEdit()
              ? `<button type="button" class="icon-btn icon-btn-primary" data-prm-create-route-family>Create Route Family</button>`
              : ""
          }
        </div>
      </div></td></tr>`;
      host.summary.innerHTML = toolbar;
    } else {
      host.tableBody.innerHTML = state.routeFamilies
        .map((family, index) => {
          const id = family.route_family_id ?? family.id;
          const mappings = state.routeFamilyMappings.filter(
            (mapping) => String(mapping.route_family_id) === String(id),
          );
          const approved = state.approvedFamilyRoutes.find(
            (route) => String(route.route_family_id) === String(id),
          );
          return `<tr class="cp-prm-row" tabindex="0" data-prm-family-row="${index}">
            <td><div class="cp-cell-primary">${text(family.route_family_name || family.family_name)}</div></td>
            <td>${text(family.route_family_code || family.family_code)}</td>
            <td>${chip(family.status || family.approval_status)}</td>
            <td>${mappings.map((mapping) => text(formatPrmProductGroupHierarchyLabel(mapping) || hierarchy(mapping))).join("<br>") || "—"}</td>
            <td>${text(approved?.version_label || approved?.family_route_id)}</td>
          </tr>`;
        })
        .join("");
      host.summary.innerHTML = `${toolbar}${
        state.preselectProductGroupId
          ? `<p class="cp-muted-text">Product Group ID ${text(state.preselectProductGroupId)} is ready to map. Open an approved Family and choose Map Product Group.</p>`
          : ""
      }`;
    }
    const bindToolbar = (root) => {
      on(root, "click", async (event) => {
        if (event.target.closest("[data-prm-create-route-family]")) {
          openCreateFamilyModal();
          return;
        }
        if (event.target.closest("[data-prm-open-mapping-review]")) {
          navigate("route-family-mapping-review");
          return;
        }
        if (
          event.target.closest("[data-prm-review-pre-mapping]") ||
          event.target.closest("[data-prm-empty-review-evidence]")
        ) {
          state.pendingMapFromEvidence = true;
          navigate("historical-candidate-review", {
            candidate_kind: "family",
            product_group_id: state.preselectProductGroupId || null,
          });
        }
      });
    };
    bindToolbar(host.summary);
    bindToolbar(host.tableBody);
    bindRows();
    syncFamiliesRegisterCount();
  }

  function syncFamiliesRegisterCount() {
    const n = Array.isArray(state.routeFamilies) ? state.routeFamilies.length : 0;
    state.total_count = n;
    if (state.activeLens !== "route-families") return;
    const el = document.getElementById("peqRowCount");
    if (!el) return;
    el.style.display = "";
    el.textContent = `${n.toLocaleString("en-IN")} row${n === 1 ? "" : "s"}`;
  }

  function workloadExplainStripItem(
    label,
    value,
    { title = "", span = 1, audit = "" } = {},
  ) {
    const spanN = Number(span) === 2 ? 2 : 1;
    const spanClass =
      spanN === 2 ? " cp-prm-workload-explain-metric--span-2" : "";
    const titleAttr = title ? ` title="${text(title, title)}"` : "";
    const auditHtml = audit
      ? `<div class="cp-prm-workload-explain-metric-audit">${text(audit)}</div>`
      : "";
    return `<div class="cp-prm-workload-explain-metric${spanClass}"${titleAttr}><div class="cp-field-label">${text(
      label,
    )}</div><div class="cp-prm-workload-explain-metric-value">${text(
      value,
    )}</div>${auditHtml}</div>`;
  }

  function buildWorkloadExplainFormulaGuidanceHtml(lines) {
    const rows = (Array.isArray(lines) ? lines : [])
      .map((line) => {
        const raw = String(line ?? "");
        const idx = raw.indexOf(" = ");
        if (idx > 0) {
          return `<div class="cp-prm-workload-explain-formula-row">
            <div class="cp-prm-workload-explain-formula-meaning">${text(
              raw.slice(0, idx),
            )}</div>
            <div class="cp-prm-workload-explain-formula-expression">${text(
              raw.slice(idx + 3),
            )}</div>
          </div>`;
        }
        return `<div class="cp-prm-workload-explain-formula-row cp-prm-workload-explain-formula-row--plain">${text(
          raw,
        )}</div>`;
      })
      .join("");
    return `<div class="cp-prm-workload-explain-formula-grid">${rows}</div>`;
  }

  function workloadExplainCostCentreLabel(step = {}) {
    return (
      step.cost_centre_name ||
      step.cost_centre_code ||
      (step.cost_centre_id != null ? `#${step.cost_centre_id}` : "—")
    );
  }

  function workloadExplainFactorTitle(note) {
    return note ? String(note) : "";
  }

  function buildWorkloadExplainReconciliationHtml(
    reconciliation,
    { heading = "Reconciliation" } = {},
  ) {
    const recon =
      reconciliation && typeof reconciliation === "object"
        ? reconciliation
        : {};
    const classified = classifyPrmWorkloadReconciliation(recon);
    const tone = classified.pass
      ? "cp-prm-badge"
      : "cp-prm-badge cp-prm-badge-warn";
    const metric = (label, value) => {
      if (value == null || value === "") return "";
      const display =
        typeof value === "number" ||
        (typeof value === "string" && /^-?\d/.test(value))
          ? formatPrmWorkloadExplainNumber(value, { maxDigits: 8 })
          : value;
      return `<div class="cp-prm-workload-explain-metric"><div class="cp-field-label">${text(
        label,
      )}</div><div class="cp-prm-workload-explain-metric-value" title="${text(
        String(value),
        String(value),
      )}">${text(display)}</div></div>`;
    };
    const groups = [
      [
        metric("Step Sum", recon.step_factor_sum),
        metric(
          "Route Intensity / Factor",
          recon.route_intensity ?? recon.route_factor,
        ),
        metric(
          "Route Delta",
          recon.route_intensity_delta ?? recon.route_factor_delta,
        ),
      ],
      [
        metric("Expected Workload", recon.expected_workload_units),
        metric("Stored Workload", recon.stored_workload_units),
        metric("Workload Delta", recon.workload_units_delta),
      ],
      [
        metric("Expected Share", recon.expected_workload_share),
        metric("Stored Share", recon.stored_workload_share),
        metric(
          "Share Delta",
          recon.workload_share_delta ?? recon.share_delta,
        ),
      ],
      [
        metric("Expected Allocation", recon.expected_product_allocation),
        metric("Stored Allocation", recon.stored_product_allocation),
        metric(
          "Allocation Delta",
          recon.product_allocation_delta ?? recon.allocation_delta,
        ),
      ],
    ]
      .map((cells) => cells.filter(Boolean).join(""))
      .filter(Boolean)
      .join("");
    return `<section class="cp-detail-section" data-prm-workload-explain-recon>
      <div class="cp-prm-workload-section-head">
        <h4 class="cp-prm-workload-section-title">${text(heading)} <span class="${tone}">${text(
          classified.label,
        )}</span></h4>
      </div>
      <div class="cp-prm-workload-explain-recon-grid">${
        groups ||
        `<p class="cp-muted-text">No reconciliation deltas returned.</p>`
      }</div>
    </section>`;
  }

  function buildWorkloadExplainSkuTableHtml(skus = []) {
    const rows = Array.isArray(skus) ? skus : [];
    if (!rows.length) {
      return `<p class="cp-muted-text">No SKU absorption rows returned.</p>`;
    }
    return `<div class="table-scroll"><table class="data-table cp-prm-workload-explain-table">
      <thead><tr>
        <th>SKU</th><th>Pack</th><th>Within-Product Share</th>
        <th>Product Allocation</th><th>Cost / Base UOM</th>
        <th title="Unit cost per SKU pack — not the total SKU allocation amount">Cost / SKU Unit</th>
        <th>Status</th>
      </tr></thead>
      <tbody>${rows
        .map((sku) => {
          const pack =
            sku.pack_size != null
              ? `${sku.pack_size}${sku.pack_uom ? ` ${sku.pack_uom}` : ""}`
              : "—";
          const share = formatPrmWorkloadSharePercent(
            sku.sku_within_product_share,
          );
          return `<tr>
            <td>${text(sku.sku_id)}</td>
            <td>${text(pack)}</td>
            <td title="${text(String(sku.sku_within_product_share ?? ""), String(sku.sku_within_product_share ?? ""))}">${text(share)}</td>
            <td title="${text(String(sku.product_allocation ?? ""), String(sku.product_allocation ?? ""))}">${text(formatPrmWorkloadExplainMoney(sku.product_allocation))}</td>
            <td title="${text(String(sku.cost_per_base_uom ?? ""), String(sku.cost_per_base_uom ?? ""))}">${text(formatPrmWorkloadExplainMoney(sku.cost_per_base_uom))}</td>
            <td title="${text(String(sku.cost_per_sku_unit ?? ""), String(sku.cost_per_sku_unit ?? ""))}">${text(formatPrmWorkloadExplainMoney(sku.cost_per_sku_unit))}</td>
            <td>${text(sku.allocation_status || "—")}</td>
          </tr>`;
        })
        .join("")}</tbody></table></div>`;
  }

  function buildWorkloadExplainDlStepRows(steps) {
    return (Array.isArray(steps) ? steps : [])
      .map((step) => {
        const scopeTitle = workloadExplainFactorTitle(step.scope_factor_note);
        const attendTitle = workloadExplainFactorTitle(
          step.attendance_factor_note,
        );
        const resourceTitle = step.resource_class_code
          ? `Resource Class: ${step.resource_class_code}`
          : "";
        return `<tr>
              <td>${text(step.sequence_no)}</td>
              <td title="${text(resourceTitle, resourceTitle)}">${text(step.activity_name || step.activity_id || "—")}</td>
              <td>${text(workloadExplainCostCentreLabel(step))}</td>
              <td>${text(step.direct_labour_scope)}</td>
              <td title="${text(scopeTitle, scopeTitle)}">${text(formatPrmWorkloadExplainNumber(step.scope_factor))}</td>
              <td>${text(step.behaviour_code)}</td>
              <td title="${text(attendTitle, attendTitle)}">${text(formatPrmWorkloadExplainNumber(step.attendance_factor))}</td>
              <td>${text(formatPrmWorkloadExplainNumber(step.expected_occurrence_count))}</td>
              <td>${text(formatPrmWorkloadExplainNumber(step.standard_cycle_count))}</td>
              <td>${text(formatPrmWorkloadExplainNumber(step.step_factor))}</td>
            </tr>`;
      })
      .join("");
  }

  function buildWorkloadExplainDlStepsSectionHtml(steps) {
    const list = Array.isArray(steps) ? steps : [];
    const stepRows = buildWorkloadExplainDlStepRows(list);
    if (!list.length) {
      return `<p class="cp-muted-text">No DL step rows returned.</p>`;
    }
    return `<div class="table-scroll"><table class="data-table cp-prm-workload-explain-table">
          <thead><tr>
            <th>Seq</th><th>Activity</th><th>Cost Centre</th><th>DL Scope</th>
            <th>Scope Factor</th><th>Behaviour</th><th>Attendance Factor</th>
            <th>Occurrences</th><th>Cycles</th><th>Step Factor</th>
          </tr></thead>
          <tbody>${stepRows}</tbody></table></div>
          <p class="cp-muted-text">Factor notes are available on Scope Factor and Attendance Factor cells (hover).</p>`;
  }

  function buildWorkloadExplainCombinedReconHtml(combined, combinedPool) {
    const recon = combined && typeof combined === "object" ? combined : {};
    const metric = (label, value) => {
      if (value == null || value === "") return "";
      const display =
        typeof value === "number" ||
        (typeof value === "string" && /^-?\d/.test(value))
          ? formatPrmWorkloadExplainNumber(value, { maxDigits: 8 })
          : value;
      const moneyish = /allocation|pool/i.test(label);
      return `<div class="cp-prm-workload-explain-metric"><div class="cp-field-label">${text(
        label,
      )}</div><div class="cp-prm-workload-explain-metric-value" title="${text(
        String(value),
        String(value),
      )}">${text(
        moneyish ? formatPrmWorkloadExplainMoney(value) : display,
      )}</div></div>`;
    };
    const cells = [
      metric("Expected Product Allocation", recon.expected_product_allocation),
      metric("Combined Product Direct Labour Allocation", recon.product_allocation),
      metric("Product Allocation Delta", recon.product_allocation_delta),
      metric("Pool Component Sum", recon.pool_component_sum),
      metric("Combined Direct Labour Pool", combinedPool),
      metric("Pool Reconciliation Delta", recon.pool_reconciliation_delta),
    ]
      .filter(Boolean)
      .join("");
    return `<section class="cp-detail-section" data-prm-workload-explain-combined-recon>
      ${workloadSectionHead("Combined Direct Labour Reconciliation")}
      <div class="cp-prm-workload-explain-recon-grid">${
        cells ||
        `<p class="cp-muted-text">No combined Direct Labour reconciliation fields returned.</p>`
      }</div>
    </section>`;
  }

  function buildWorkloadExplainComponentSkuTableHtml(
    combinedSkus = [],
    packingSkus = [],
  ) {
    const rows = Array.isArray(combinedSkus) ? combinedSkus : [];
    if (!rows.length) {
      return `<p class="cp-muted-text">No SKU absorption rows returned.</p>`;
    }
    const packingById = new Map();
    for (const row of Array.isArray(packingSkus) ? packingSkus : []) {
      if (row?.sku_id == null) continue;
      packingById.set(String(row.sku_id), row);
    }
    return `<div class="table-scroll"><table class="data-table cp-prm-workload-explain-table" data-prm-dl-component-sku-table>
      <thead><tr>
        <th>Pack</th>
        <th>Expected Packages</th>
        <th>Manufacturing Labour / Unit</th>
        <th>Packing Labour / Unit</th>
        <th>Combined DL / Unit</th>
        <th>Status</th>
      </tr></thead>
      <tbody>${rows
        .map((sku) => {
          const pack =
            sku.pack_size != null
              ? `${sku.pack_size}${sku.pack_uom ? ` ${sku.pack_uom}` : ""}`
              : "—";
          const packing = packingById.get(String(sku.sku_id));
          const expectedHtml =
            packing && packing.expected_package_units != null
              ? text(
                  formatPrmWorkloadExplainNumber(packing.expected_package_units, {
                    maxDigits: 4,
                  }),
                )
              : `<span class="cp-muted-text">Not returned</span>`;
          const shareTitle = packing?.package_workload_share != null
            ? String(packing.package_workload_share)
            : "";
          const mfgAllocTitle =
            sku.manufacturing_labour_allocation != null
              ? `Manufacturing allocation: ${sku.manufacturing_labour_allocation}`
              : String(sku.manufacturing_labour_cost_per_sku ?? "");
          const packAllocTitle =
            sku.packing_labour_allocation != null
              ? `Packing allocation: ${sku.packing_labour_allocation}`
              : String(sku.packing_labour_cost_per_sku ?? "");
          return `<tr>
            <td>${text(pack)}</td>
            <td title="${text(shareTitle, shareTitle)}">${expectedHtml}</td>
            <td title="${text(mfgAllocTitle, mfgAllocTitle)}">${text(
              formatPrmWorkloadExplainMoney(sku.manufacturing_labour_cost_per_sku),
            )}</td>
            <td title="${text(packAllocTitle, packAllocTitle)}">${text(
              formatPrmWorkloadExplainMoney(sku.packing_labour_cost_per_sku),
            )}</td>
            <td title="${text(String(sku.combined_direct_labour_cost_per_sku ?? ""), String(sku.combined_direct_labour_cost_per_sku ?? ""))}">${text(
              formatPrmWorkloadExplainMoney(sku.combined_direct_labour_cost_per_sku),
            )}</td>
            <td>${text(sku.allocation_status || "—")}</td>
          </tr>`;
        })
        .join("")}</tbody></table></div>`;
  }

  function buildWorkloadExplainLegacyDlPanelHtml(directLabour) {
    const policy = directLabour.policy || {};
    const workload = directLabour.workload || {};
    const steps = Array.isArray(directLabour.steps) ? directLabour.steps : [];
    const component = directLabour.component_model || {};
    const sharePct = formatPrmWorkloadSharePercent(
      workload.product_workload_share,
    );
    const supervisionNote = hasPrmDlSupervisionSteps(steps)
      ? `<p class="cp-prm-form-notice" data-prm-dl-supervision-note>${text(
          PRM_WORKLOAD_EXPLAIN_DL_SUPERVISION_NOTE,
        )}</p>`
      : "";
    const policyRaw = policy.policy_code || policy.policy_id || "";
    const formulaRaw = policy.formula_type || "";
    const bannerNote =
      component.management_note || PRM_DL_LEGACY_BANNER_FALLBACK;
    return `
      <section class="cp-detail-section" data-prm-dl-legacy-banner>
        ${workloadSectionHead(PRM_DL_LEGACY_BANNER_TITLE)}
        <p class="cp-prm-form-notice">${text(bannerNote)}</p>
      </section>
      ${workloadSectionHead("Policy / Unified Workload Summary")}
      <div class="cp-prm-workload-explain-strip" data-prm-workload-explain-dl-summary>
        ${workloadExplainStripItem("Policy", formatPrmWorkloadPolicyLabel(policyRaw), { title: String(policyRaw), span: 2, audit: policyRaw ? String(policyRaw) : "" })}
        ${workloadExplainStripItem("Policy Version", policy.policy_version)}
        ${workloadExplainStripItem("Formula Type", formatPrmWorkloadFormulaLabel(formulaRaw), { title: String(formulaRaw), span: 2, audit: formulaRaw ? String(formulaRaw) : "" })}
        ${workloadExplainStripItem("Standard Batch Count", formatPrmWorkloadExplainNumber(workload.standard_batch_count, { maxDigits: 4 }))}
        ${workloadExplainStripItem("Route Labour Intensity", formatPrmWorkloadExplainNumber(workload.route_intensity), { title: String(workload.route_intensity ?? "") })}
        ${workloadExplainStripItem("Product Unified DL Workload", formatPrmWorkloadExplainNumber(workload.product_workload_units), { title: String(workload.product_workload_units ?? "") })}
        ${workloadExplainStripItem("Company Eligible Unified DL Workload", formatPrmWorkloadExplainNumber(workload.company_eligible_workload_units), { title: String(workload.company_eligible_workload_units ?? "") })}
        ${workloadExplainStripItem("Product Workload Share", sharePct, { title: String(workload.product_workload_share ?? "") })}
        ${workloadExplainStripItem("Frozen Unified DL Pool", formatPrmWorkloadExplainMoney(workload.pool_amount), { title: String(workload.pool_amount ?? "") })}
        ${workloadExplainStripItem("Product Unified DL Allocation", formatPrmWorkloadExplainMoney(workload.product_allocation), { title: String(workload.product_allocation ?? "") })}
      </div>
      ${supervisionNote}
      <section class="cp-detail-section">
        ${workloadSectionHead("Step Labour Factors")}
        ${buildWorkloadExplainDlStepsSectionHtml(steps)}
      </section>
      <section class="cp-detail-section">
        ${workloadSectionHead("Formula Guidance")}
        ${buildWorkloadExplainFormulaGuidanceHtml(PRM_WORKLOAD_EXPLAIN_DL_FORMULA)}
        <p class="cp-muted-text">Explanatory only — server frozen values remain authoritative.</p>
      </section>
      ${buildWorkloadExplainReconciliationHtml(directLabour.reconciliation)}
      <section class="cp-detail-section">
        ${workloadSectionHead("SKU Absorption")}
        ${buildWorkloadExplainSkuTableHtml(directLabour.skus)}
      </section>`;
  }

  function buildWorkloadExplainComponentDlPanelHtml(directLabour) {
    const policy = directLabour.policy || {};
    const workload = directLabour.workload || {};
    const component = directLabour.component_model || {};
    const combined = component.combined || {};
    const manufacturing = component.manufacturing_labour || {};
    const packing = component.packing_labour || {};
    const mfgWorkload = manufacturing.workload || workload;
    const mfgSteps = Array.isArray(manufacturing.steps)
      ? manufacturing.steps
      : Array.isArray(directLabour.steps)
        ? directLabour.steps
        : [];
    const policyRaw = policy.policy_code || policy.policy_id || "";
    const formulaRaw = policy.formula_type || "";
    const modelRaw = component.model_code || "";
    const mfgDriverRaw = manufacturing.driver || "";
    const packDriverRaw = packing.driver || "";
    const overallStatus = workload.workload_status;
    const sharePct = formatPrmWorkloadSharePercent(
      mfgWorkload.product_workload_share,
    );
    const supervisionNote = hasPrmDlSupervisionSteps(mfgSteps)
      ? `<p class="cp-prm-form-notice" data-prm-dl-supervision-note>${text(
          PRM_WORKLOAD_EXPLAIN_DL_SUPERVISION_NOTE,
        )}</p>`
      : "";
    const mfgPoolTitle =
      manufacturing.component_pool_snapshot_id != null
        ? `Component pool snapshot ${manufacturing.component_pool_snapshot_id}`
        : String(manufacturing.pool_amount ?? "");
    const packPoolTitle =
      packing.component_pool_snapshot_id != null
        ? `Component pool snapshot ${packing.component_pool_snapshot_id}`
        : String(packing.pool_amount ?? "");
    return `
      ${workloadSectionHead("Direct Labour")}
      <p class="cp-muted-text">${text(
        component.management_note ||
          "Direct Labour is the sum of Manufacturing Labour and Packing Labour.",
      )}</p>

      ${workloadSectionHead("Combined Direct Labour")}
      <div class="cp-prm-workload-explain-strip" data-prm-dl-combined-summary>
        ${workloadExplainStripItem("Combined Direct Labour Pool", formatPrmWorkloadExplainMoney(component.combined_direct_labour_pool), { title: String(component.combined_direct_labour_pool ?? ""), span: 2 })}
        ${workloadExplainStripItem("Combined Product Direct Labour Allocation", formatPrmWorkloadExplainMoney(combined.product_allocation), { title: String(combined.product_allocation ?? ""), span: 2 })}
        ${workloadExplainStripItem("Overall Direct Labour Status", overallStatus, { title: String(workload.workload_reason_code || overallStatus || "") })}
        ${workloadExplainStripItem("Policy", formatPrmWorkloadPolicyLabel(policyRaw), { title: String(policyRaw), span: 2, audit: policyRaw ? String(policyRaw) : "" })}
        ${workloadExplainStripItem("Policy Version", policy.policy_version)}
        ${workloadExplainStripItem("Formula Type", formatPrmWorkloadFormulaLabel(formulaRaw), { title: String(formulaRaw), span: 2, audit: formulaRaw ? String(formulaRaw) : "" })}
        ${workloadExplainStripItem("Model", formatPrmWorkloadFormulaLabel(modelRaw), { title: String(modelRaw), audit: modelRaw ? String(modelRaw) : "" })}
      </div>
      ${
        overallStatus
          ? `<div>${chip(overallStatus)}</div>`
          : ""
      }
      ${
        workload.workload_note
          ? `<p class="cp-muted-text">${text(workload.workload_note)}</p>`
          : ""
      }
      <p class="cp-prm-form-notice" data-prm-dl-overall-status-cue>${text(
        PRM_DL_COMPONENT_OVERALL_STATUS_CUE,
      )}</p>

      ${workloadSectionHead("Manufacturing Labour")}
      <p class="cp-muted-text">${text(PRM_DL_MANUFACTURING_COPY)}</p>
      <div class="cp-prm-workload-explain-strip" data-prm-dl-manufacturing-summary>
        ${workloadExplainStripItem("Manufacturing Labour Pool", formatPrmWorkloadExplainMoney(manufacturing.pool_amount), { title: mfgPoolTitle, span: 2 })}
        ${workloadExplainStripItem("Product Manufacturing Labour Allocation", formatPrmWorkloadExplainMoney(manufacturing.product_allocation), { title: String(manufacturing.product_allocation ?? ""), span: 2 })}
        ${workloadExplainStripItem("Driver", formatPrmDlWorkloadDriverLabel(mfgDriverRaw), { title: String(mfgDriverRaw), span: 2, audit: mfgDriverRaw ? String(mfgDriverRaw) : "" })}
        ${workloadExplainStripItem("Standard Batch Count", formatPrmWorkloadExplainNumber(mfgWorkload.standard_batch_count, { maxDigits: 4 }))}
        ${workloadExplainStripItem("Route Labour Intensity", formatPrmWorkloadExplainNumber(mfgWorkload.route_intensity), { title: String(mfgWorkload.route_intensity ?? "") })}
        ${workloadExplainStripItem("Product Manufacturing Workload", formatPrmWorkloadExplainNumber(mfgWorkload.product_workload_units), { title: String(mfgWorkload.product_workload_units ?? "") })}
        ${workloadExplainStripItem("Company Eligible Manufacturing Workload", formatPrmWorkloadExplainNumber(mfgWorkload.company_eligible_workload_units), { title: String(mfgWorkload.company_eligible_workload_units ?? "") })}
        ${workloadExplainStripItem("Product Workload Share", sharePct, { title: String(mfgWorkload.product_workload_share ?? "") })}
      </div>
      ${supervisionNote}
      <section class="cp-detail-section">
        ${workloadSectionHead("Manufacturing Step Labour Factors")}
        ${buildWorkloadExplainDlStepsSectionHtml(mfgSteps)}
      </section>

      ${workloadSectionHead("Packing Labour")}
      <div class="cp-prm-workload-explain-strip" data-prm-dl-packing-summary>
        ${workloadExplainStripItem("Packing Labour Pool", formatPrmWorkloadExplainMoney(packing.pool_amount), { title: packPoolTitle, span: 2 })}
        ${workloadExplainStripItem("Product Packing Labour Allocation", formatPrmWorkloadExplainMoney(packing.product_allocation), { title: String(packing.product_allocation ?? ""), span: 2 })}
        ${workloadExplainStripItem("Product Expected Package Units", formatPrmWorkloadExplainNumber(packing.product_expected_package_units, { maxDigits: 4 }), { title: String(packing.product_expected_package_units ?? "") })}
        ${workloadExplainStripItem("Company Expected Package Units", formatPrmWorkloadExplainNumber(packing.company_expected_package_units, { maxDigits: 4 }), { title: String(packing.company_expected_package_units ?? "") })}
        ${workloadExplainStripItem("Driver", formatPrmDlWorkloadDriverLabel(packDriverRaw), { title: String(packDriverRaw), span: 2, audit: packDriverRaw ? String(packDriverRaw) : "" })}
      </div>

      <section class="cp-detail-section">
        ${workloadSectionHead("Formula / Basis Guidance")}
        ${buildWorkloadExplainFormulaGuidanceHtml(PRM_WORKLOAD_EXPLAIN_DL_COMPONENT_FORMULA)}
        <p class="cp-muted-text">Explanatory only — server frozen values remain authoritative.</p>
      </section>
      ${buildWorkloadExplainReconciliationHtml(
        manufacturing.reconciliation,
        { heading: "Manufacturing Reconciliation" },
      )}
      <section class="cp-detail-section" data-prm-dl-packing-evidence>
        ${workloadSectionHead("Packing Workload Evidence")}
        <div class="cp-prm-workload-explain-strip">
          ${workloadExplainStripItem("Product Expected Packages", formatPrmWorkloadExplainNumber(packing.product_expected_package_units, { maxDigits: 4 }))}
          ${workloadExplainStripItem("Company Expected Packages", formatPrmWorkloadExplainNumber(packing.company_expected_package_units, { maxDigits: 4 }))}
          ${workloadExplainStripItem("Packing Labour Pool", formatPrmWorkloadExplainMoney(packing.pool_amount), { title: String(packing.pool_amount ?? "") })}
          ${workloadExplainStripItem("Product Packing Labour Allocation", formatPrmWorkloadExplainMoney(packing.product_allocation), { title: String(packing.product_allocation ?? "") })}
        </div>
      </section>
      ${buildWorkloadExplainCombinedReconHtml(
        combined,
        component.combined_direct_labour_pool,
      )}
      <section class="cp-detail-section">
        ${workloadSectionHead("SKU Direct Labour Absorption")}
        ${buildWorkloadExplainComponentSkuTableHtml(
          combined.skus,
          packing.skus,
        )}
      </section>`;
  }

  function buildWorkloadExplainDlPanelHtml(directLabour) {
    if (!directLabour) {
      return `<p class="cp-muted-text">No Direct Labour frozen evidence for this Product in the selected run.</p>`;
    }
    if (isPrmDlComponentModelActive(directLabour)) {
      return buildWorkloadExplainComponentDlPanelHtml(directLabour);
    }
    return buildWorkloadExplainLegacyDlPanelHtml(directLabour);
  }

  function buildWorkloadExplainPohPanelHtml(productionOverhead) {
    if (!productionOverhead) {
      return `<p class="cp-muted-text">No Production Overhead frozen evidence for this Product in the selected run.</p>`;
    }
    const policy = productionOverhead.policy || {};
    const workload = productionOverhead.workload || {};
    const steps = Array.isArray(productionOverhead.steps)
      ? productionOverhead.steps
      : [];
    const sharePct = formatPrmWorkloadSharePercent(
      workload.product_workload_share,
    );
    const behaviourNeutral =
      policy.behaviour_multipliers_currently_neutral === true;
    const resourceNeutral =
      policy.resource_multipliers_currently_neutral === true;
    const neutralityNote =
      behaviourNeutral || resourceNeutral
        ? `<p class="cp-prm-form-notice" data-prm-poh-neutrality-note>${text(
            PRM_WORKLOAD_EXPLAIN_POH_NEUTRALITY_NOTE,
          )}</p>`
        : "";
    const policyRaw = policy.policy_code || policy.policy_id || "";
    const formulaRaw = policy.formula_type || "";
    const stepRows = steps.length
      ? steps
          .map((step) => {
            const scopeTitle = workloadExplainFactorTitle(step.scope_factor_note);
            const behaviourTitle = workloadExplainFactorTitle(
              step.behaviour_factor_note,
            );
            const resourceTitle = workloadExplainFactorTitle(
              step.resource_factor_note,
            );
            return `<tr>
              <td>${text(step.sequence_no)}</td>
              <td>${text(step.activity_name || step.activity_id || "—")}</td>
              <td>${text(workloadExplainCostCentreLabel(step))}</td>
              <td>${text(step.production_overhead_scope)}</td>
              <td title="${text(scopeTitle, scopeTitle)}">${text(formatPrmWorkloadExplainNumber(step.scope_factor))}</td>
              <td>${text(step.behaviour_code)}</td>
              <td title="${text(behaviourTitle, behaviourTitle)}">${text(formatPrmWorkloadExplainNumber(step.behaviour_factor))}</td>
              <td title="${text(step.resource_class_code || "", "")}">${text(
                resolvePrmResourceClassDisplayLabel(step.resource_class_code, {
                  ...prmResourceClassDisplayContext(),
                  rowLabel: step.resource_class_label,
                }),
              )}</td>
              <td title="${text(resourceTitle, resourceTitle)}">${text(formatPrmWorkloadExplainNumber(step.resource_factor))}</td>
              <td>${text(formatPrmWorkloadExplainNumber(step.expected_occurrence_count))}</td>
              <td>${text(formatPrmWorkloadExplainNumber(step.standard_cycle_count))}</td>
              <td>${text(formatPrmWorkloadExplainNumber(step.step_factor))}</td>
            </tr>`;
          })
          .join("")
      : "";
    return `
      ${workloadSectionHead("Policy / Workload Summary")}
      <div class="cp-prm-workload-explain-strip" data-prm-workload-explain-poh-summary>
        ${workloadExplainStripItem("Policy", formatPrmWorkloadPolicyLabel(policyRaw), { title: String(policyRaw), span: 2, audit: policyRaw ? String(policyRaw) : "" })}
        ${workloadExplainStripItem("Policy Version", policy.policy_version)}
        ${workloadExplainStripItem("Formula Type", formatPrmWorkloadFormulaLabel(formulaRaw), { title: String(formulaRaw), span: 2, audit: formulaRaw ? String(formulaRaw) : "" })}
        ${workloadExplainStripItem("Rounded Standard Batches", formatPrmWorkloadExplainNumber(workload.rounded_batch_count, { maxDigits: 4 }))}
        ${workloadExplainStripItem("Route Factor", formatPrmWorkloadExplainNumber(workload.route_factor), { title: String(workload.route_factor ?? "") })}
        ${workloadExplainStripItem("Product Workload", formatPrmWorkloadExplainNumber(workload.product_workload_units), { title: String(workload.product_workload_units ?? "") })}
        ${workloadExplainStripItem("Company Ready POH Workload", formatPrmWorkloadExplainNumber(workload.company_ready_workload_units), { title: String(workload.company_ready_workload_units ?? "") })}
        ${workloadExplainStripItem("Product Workload Share", sharePct, { title: String(workload.product_workload_share ?? "") })}
        ${workloadExplainStripItem("Frozen POH Pool", formatPrmWorkloadExplainMoney(workload.pool_amount), { title: String(workload.pool_amount ?? "") })}
        ${workloadExplainStripItem("Product POH Allocation", formatPrmWorkloadExplainMoney(workload.product_allocation), { title: String(workload.product_allocation ?? "") })}
      </div>
      ${
        neutralityNote
          ? `${workloadSectionHead("Neutrality / Policy Note")}${neutralityNote}`
          : ""
      }
      <section class="cp-detail-section">
        ${workloadSectionHead("Step Factors")}
        ${
          steps.length
            ? `<div class="table-scroll"><table class="data-table cp-prm-workload-explain-table">
          <thead><tr>
            <th>Seq</th><th>Activity</th><th>Cost Centre</th><th>POH Scope</th>
            <th>Scope Factor</th><th>Behaviour</th><th>Behaviour Factor</th>
            <th>Resource</th><th>Resource Factor</th>
            <th>Occurrences</th><th>Cycles</th><th>Step Factor</th>
          </tr></thead>
          <tbody>${stepRows}</tbody></table></div>
          <p class="cp-muted-text">Factor notes are available on factor cells (hover).</p>`
            : `<p class="cp-muted-text">No POH step rows returned.</p>`
        }
      </section>
      <section class="cp-detail-section">
        ${workloadSectionHead("Formula Guidance")}
        ${buildWorkloadExplainFormulaGuidanceHtml(PRM_WORKLOAD_EXPLAIN_POH_FORMULA)}
        <p class="cp-muted-text">Explanatory only — server frozen values remain authoritative.</p>
      </section>
      ${buildWorkloadExplainReconciliationHtml(productionOverhead.reconciliation)}
      <section class="cp-detail-section">
        ${workloadSectionHead("SKU Absorption")}
        ${buildWorkloadExplainSkuTableHtml(productionOverhead.skus)}
      </section>`;
  }

  function buildWorkloadExplainModalHtml(payload) {
    const context = payload?.context || {};
    const dl = payload?.direct_labour;
    const poh = payload?.production_overhead;
    const effectiveSource =
      dl?.workload?.effective_route_source ||
      poh?.workload?.effective_route_source ||
      "—";
    const lineage = resolvePrmWorkloadExplainRouteLineage(payload);
    const lineageHtml = lineage.ok
      ? `<div class="cp-prm-workload-explain-lineage">
          <button type="button" class="cp-prm-text-action" data-prm-workload-explain-lineage>${text(
            lineage.label,
          )}</button>
          <p class="cp-muted-text">${text(lineage.subcopy)}</p>
        </div>`
      : "";
    const note =
      payload?.management_note ||
      "Frozen exact-run evidence. Current route edits do not rewrite this historical explain result.";
    return `<div class="cp-prm-summary cp-prm-workload-explain" data-prm-workload-explain-modal data-prm-frozen-exact-run="1">
      <section class="cp-detail-section">
        <div class="cp-prm-workload-explain-identity cp-detail-grid cp-detail-grid--2col">
          <div><div class="cp-field-label">Product</div><div class="cp-cell-primary">${text(
            context.product_name || `Product ${context.product_id}`,
          )}</div></div>
          <div><div class="cp-field-label">Frozen Run</div><div>${text(
            context.refresh_run_id,
          )}</div></div>
          <div><div class="cp-field-label">Period</div><div>${text(
            formatPrmMonthYearLabel(context.period_start) ||
              context.period_start,
          )}</div></div>
          <div><div class="cp-field-label">Valuation Date</div><div>${text(
            formatPrmDayMonthYearLabel(context.valuation_date) ||
              context.valuation_date,
          )}</div></div>
          <div class="cp-detail-span-full"><div class="cp-field-label">Effective Route Source</div><div>${text(
            effectiveSource,
          )}</div></div>
        </div>
        <p class="cp-prm-form-notice" data-prm-workload-management-note>${text(
          note,
        )}</p>
        <p class="cp-muted-text">Frozen exact-run evidence. Current Route Master edits do not rewrite this historical explain evidence.</p>
        ${lineageHtml}
      </section>
      <div class="cp-prm-workload-explain-tabs" role="tablist" aria-label="Workload explain pools">
        <button type="button" class="cp-prm-workload-explain-tab is-active" role="tab" aria-selected="true" data-prm-workload-explain-tab="dl">Direct Labour</button>
        <button type="button" class="cp-prm-workload-explain-tab" role="tab" aria-selected="false" data-prm-workload-explain-tab="poh">Production Overhead</button>
      </div>
      <div class="cp-prm-workload-explain-panel" data-prm-workload-explain-panel="dl" role="tabpanel">${buildWorkloadExplainDlPanelHtml(
        dl,
      )}</div>
      <div class="cp-prm-workload-explain-panel hidden" data-prm-workload-explain-panel="poh" role="tabpanel">${buildWorkloadExplainPohPanelHtml(
        poh,
      )}</div>
    </div>`;
  }

  async function openWorkloadManagementExplain(
    productId,
    { nested = false } = {},
  ) {
    if (!canView()) {
      showToast?.("Permission denied.", "error");
      return;
    }
    const pid = normalizePrmIntegerId(productId);
    if (pid == null) {
      showToast?.("Product ID is required for Workload Explain.", "error");
      return;
    }
    openModal(
      {
        title: "Workload Explain",
        subtitle: "Frozen exact-run DL / POH allocation",
        html: `<div class="cp-prm-summary" data-prm-workload-explain-loading><div class="cost-sheet-explain-loading">Loading Workload Explain…</div></div>`,
      },
      { nested },
    );
    const response = await invoke(
      RPC.workloadExplain,
      buildWorkloadManagementExplainRpcArgs({
        product_id: pid,
        period_start: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.period_start,
        valuation_date: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.valuation_date,
        refresh_run_id: PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT.refresh_run_id,
      }),
      "Unable to load Workload Explain.",
    );
    if (!response.ok) {
      openModal(
        {
          title: "Workload Explain",
          subtitle: "Frozen exact-run DL / POH allocation",
          html: `<div class="cp-prm-summary"><p class="cp-muted-text">${text(
            response.error?.message || "Unable to load Workload Explain.",
          )}</p></div>`,
        },
        { nested, replace: true },
      );
      return;
    }
    const payload = normalizePrmWorkloadManagementExplainPayload(response.data);
    const lineage = resolvePrmWorkloadExplainRouteLineage(payload);
    openModal(
      {
        title: "Workload Explain",
        subtitle: formatPrmExactRunContextCue(
          PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
        ),
        html: buildWorkloadExplainModalHtml(payload),
        bind: (host) => {
          onModal(host, "click", (event) => {
            const tabBtn = event.target.closest(
              "[data-prm-workload-explain-tab]",
            );
            if (tabBtn) {
              const tab = tabBtn.getAttribute("data-prm-workload-explain-tab");
              host
                .querySelectorAll("[data-prm-workload-explain-tab]")
                .forEach((btn) => {
                  const active =
                    btn.getAttribute("data-prm-workload-explain-tab") === tab;
                  btn.classList.toggle("is-active", active);
                  btn.setAttribute("aria-selected", active ? "true" : "false");
                });
              host
                .querySelectorAll("[data-prm-workload-explain-panel]")
                .forEach((panel) => {
                  panel.classList.toggle(
                    "hidden",
                    panel.getAttribute("data-prm-workload-explain-panel") !==
                      tab,
                  );
                });
              return;
            }
            if (event.target.closest("[data-prm-workload-explain-lineage]")) {
              if (!lineage.ok) return;
              if (lineage.family_route_id != null) {
                navigateToFamilyRouteEditor({
                  route_family_id: lineage.route_family_id,
                  family_route_id: lineage.family_route_id,
                });
                return;
              }
              if (lineage.product_route_id != null) {
                modalParent = null;
                closeModal({ restorePrevious: false });
                navigate("product-route-editor", {
                  product_id: pid,
                  product_route_id: lineage.product_route_id,
                });
              }
            }
          });
        },
      },
      { nested, replace: true },
    );
  }

  function bindRows() {
    const open = (target) => {
      const foundationRow = target.closest(
        "[data-prm-foundation-review-group]",
      );
      if (foundationRow) {
        const row =
          state.foundationReviewGroups[
            Number(
              foundationRow.getAttribute("data-prm-foundation-review-group"),
            )
          ];
        if (!row) return;
        openFoundationReviewGroupModal(row);
        return;
      }
      const mappingReviewRow = target.closest("[data-prm-mapping-review-group]");
      if (mappingReviewRow) {
        const row =
          state.mappingReviewGroups[
            Number(mappingReviewRow.getAttribute("data-prm-mapping-review-group"))
          ];
        if (!row) return;
        openMappingReviewGroupModal(row);
        return;
      }
      const workloadRow = target.closest("[data-prm-workload-row]");
      if (workloadRow) {
        const row =
          state.workloadRows[
            Number(workloadRow.getAttribute("data-prm-workload-row"))
          ];
        if (!row) return;
        captureWorkloadPreviewScroll();
        openProductSummary(buildPrmWorkloadProductHandoff(row), {
          sourceContext: "WORKLOAD_PREVIEW",
        });
        return;
      }
      const assignmentRow = target.closest("[data-prm-assignment-row]");
      if (assignmentRow) {
        const row =
          state.assignmentRows[
            Number(assignmentRow.getAttribute("data-prm-assignment-row"))
          ];
        if (!row) return;
        openProductSummary(buildPrmAssignmentProductHandoff(row), {
          focusAssignmentId: row.assignment_id,
          sourceContext: "ASSIGNMENT_REGISTER",
        });
        return;
      }
      const productRow = target.closest("[data-prm-product-row]");
      if (productRow) {
        openProductSummary(
          state.readinessRows[
            Number(productRow.getAttribute("data-prm-product-row"))
          ],
          { sourceContext: "EXACT_RUN_READINESS" },
        );
        return;
      }
      const familyRow = target.closest("[data-prm-family-row]");
      if (familyRow) {
        void openFamilySummary(
          state.routeFamilies[
            Number(familyRow.getAttribute("data-prm-family-row"))
          ],
        );
      }
    };
    for (const host of [hosts().tableBody, hosts().summary]) {
      on(host, "click", (event) => {
        if (event.target.closest("[data-prm-workload-retry-more]")) {
          event.preventDefault();
          event.stopPropagation();
          void loadMoreWorkloadPreview();
          return;
        }
        if (event.target.closest("button,a,input,select")) return;
        open(event.target);
      });
      on(host, "keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.target.closest("[data-prm-workload-retry-more]")) return;
        event.preventDefault();
        open(event.target);
      });
    }
  }

  function renderEditorLens(mode) {
    const host = hosts();
    host.tableWrap?.classList.remove("hidden");
    host.tableHead.innerHTML = "";
    host.tableBody.innerHTML = "";
    const table = document.getElementById("mainTable");
    if (table) table.style.display = "none";
    if (mode === "family") {
      const detail = editor.getFamilyState?.()?.detail || {};
      const routeFamilyId =
        normalizePrmIntegerId(detail.route_family_id) ??
        normalizePrmIntegerId(state.selectedRouteFamilyId) ??
        normalizePrmIntegerId(state.deepLink.route_family_id);
      host.summary.innerHTML = `<button type="button" class="cp-prm-text-action" data-prm-back-families>Back to Manufacturing Route Families</button>`;
      const backBtn = host.summary.querySelector("[data-prm-back-families]");
      if (backBtn) {
        on(backBtn, "click", () => {
          navigate("route-families", {
            route_family_id: routeFamilyId,
          });
        });
      }
    } else {
      host.summary.innerHTML = "";
    }
    const lensRoot = ensureLensRoot(mode === "family" ? "route-family-route-editor" : "product-route-editor");
    const chooser =
      mode === "product" && state.productRouteReentryChooser
        ? state.productRouteReentryChooser
        : null;
    const createMode =
      mode === "product" &&
      !chooser &&
      !!state.productRouteCreateHandoff &&
      isPrmProductRouteEditorCreateContext({
        product_id: state.selectedProductId,
        product_route_id: state.selectedProductRouteId,
      });
    if (chooser) {
      const chooserProductId = normalizePrmIntegerId(chooser.product_id);
      lensRoot.innerHTML = `<div class="cp-prm-editor" data-prm-editor="product-history-chooser">
        <p class="cp-muted-text">Select a Product route version to open. Historical versions are read-only. Current Draft and Review routes are not inferred automatically when more than one exists.</p>
        ${buildProductHistoryTableHtml(chooser.versions || [], chooserProductId)}
      </div>`;
      bindProductHistoryOpen(
        lensRoot,
        chooser.versions || [],
        chooserProductId,
        { modal: false },
      );
      return;
    }
    const createOptions = createMode ? buildProductRouteCreateRenderOptions() : {};
    const familyEmpty =
      mode === "family" && !editor.getFamilyState?.()?.detail;
    const familyEmptyOptions = familyEmpty
      ? buildFamilyRouteEmptyRenderOptions()
      : {};
    editor.renderEditor(lensRoot, mode, {
      costCentreBlocked: state.costCentreBlocker,
      emptyMessage:
        mode === "product"
          ? PRM_EMPTY_STATES.productEditor
          : PRM_EMPTY_STATES.familyEditor,
      emptySupporting: PRM_EMPTY_STATES.familyEditorSupporting,
      createMode,
      ...createOptions,
      ...familyEmptyOptions,
    });
    if (familyEmpty) {
      const selectEl = lensRoot.querySelector("[data-prm-family-empty-select]");
      if (selectEl) {
        enhanceSearchableSelect(selectEl, {
          placeholder: "Search or select Route Family",
          allowEmptyOption: true,
          openOnFocus: true,
          showAllWhenEmpty: true,
          clearSelectedOnBackspace: true,
        });
      }
      void refreshFamilyRouteEmptyContext(lensRoot);
    }
    bindEditor(lensRoot, mode);
  }

  function buildProductRouteCreateRenderOptions() {
    const handoff = state.productRouteCreateHandoff || {};
    const productId = normalizePrmIntegerId(
      handoff.product_id ?? state.selectedProductId,
    );
    const refs = selectPrmProductBatchSizeReferences(state.batchSizeReferences, {
      product_id: productId,
      as_of_date: handoff.as_of_date || getAsOfDate(),
    });
    const selectedBatchSizeRefId =
      refs.length === 1
        ? normalizePrmIntegerId(refs[0].batch_size_ref_id)
        : null;
    return {
      createContext: handoff,
      batchSizeReferences: refs,
      selectedBatchSizeRefId,
      canCreateDraft: canEdit() && refs.length > 0,
      pbsHandoff: buildPrmPreferredBatchSizeHandoffAction({
        product_id: productId,
      }),
    };
  }

  function openFamilyRouteOverviewModal() {
    openModal({
      title: "Route details",
      subtitle: "Identity, validation, and evidence",
      html: editor.buildFamilyRouteOverviewHtml?.() ||
        `<div class="status">Route overview unavailable.</div>`,
    });
  }

  function paintFamilyRouteEditor() {
    editor.readyFamilyDetailForPaint?.();
    paintAcceptedPrmLens();
  }

  function familyStateHasStepId(stepId) {
    const want = normalizePrmIntegerId(stepId);
    if (want == null) return true;
    const steps = editor.getFamilyState?.()?.steps || [];
    return steps.some(
      (step) =>
        normalizePrmIntegerId(
          step?.family_route_step_id ??
            step?.route_step_id ??
            step?.step_id ??
            step?.id,
        ) === want,
    );
  }

  async function refreshFamilyRouteEditorAfterStepMutation({
    successMessage = "Route step saved.",
    refreshFailureMessage = "Route step saved, but the Family Route could not be refreshed.",
    expectedStepId = null,
  } = {}) {
    const familyRouteId = resolvePrmFamilyRouteEditorRouteId({
      selectedFamilyRouteId: state.selectedFamilyRouteId,
      deepLink: state.deepLink,
      detail: editor.getFamilyState?.()?.detail,
    });
    if (familyRouteId == null) {
      showToast?.(successMessage, "success", 4200);
      closeModal({ restorePrevious: false });
      showToast?.(refreshFailureMessage, "warning", 5200);
      paintFamilyRouteEditor();
      return { ok: false, reason: "missing_family_route_id" };
    }
    showToast?.(successMessage, "success", 4200);
    closeModal({ restorePrevious: false });
    const expectedId = normalizePrmIntegerId(expectedStepId);
    const attempts = expectedId != null ? 3 : 1;
    let result = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const generation = editor.bumpFamilyRouteDetailGeneration?.();
      result = await editor.loadFamilyDetail(familyRouteId, {
        preserveValidationStale: true,
        generation,
        includeSecondary: false,
      });
      if (result?.ok && familyStateHasStepId(expectedId)) break;
      if (result?.stale === true) break;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
      }
    }
    if (!result?.ok) {
      showToast?.(refreshFailureMessage, "warning", 5200);
    }
    paintFamilyRouteEditor();
    return result;
  }

  async function refreshFamilyRouteEditorAfterLifecycleMutation({
    successMessage = "Family Route updated.",
    refreshFailureMessage = "Family Route updated, but the editor could not be refreshed.",
    preserveValidationStale = false,
    retainCurrentValidationIfOmitted = false,
  } = {}) {
    const familyRouteId = resolvePrmFamilyRouteEditorRouteId({
      selectedFamilyRouteId: state.selectedFamilyRouteId,
      deepLink: state.deepLink,
      detail: editor.getFamilyState?.()?.detail,
    });
    if (familyRouteId == null) {
      showToast?.(successMessage, "success", 4200);
      closeModal({ restorePrevious: false });
      showToast?.(refreshFailureMessage, "warning", 5200);
      paintFamilyRouteEditor();
      return { ok: false, reason: "missing_family_route_id" };
    }
    showToast?.(successMessage, "success", 4200);
    closeModal({ restorePrevious: false });
    const generation = editor.bumpFamilyRouteDetailGeneration?.();
    const result = await editor.loadFamilyDetail(familyRouteId, {
      preserveValidationStale,
      retainCurrentValidationIfOmitted,
      generation,
      includeSecondary: false,
    });
    if (!result?.ok) {
      showToast?.(refreshFailureMessage, "warning", 5200);
    }
    paintFamilyRouteEditor();
    return result;
  }

  async function openFamilyStepModal(stepId, returnFocus = null, createOptions = null) {
    const isCreate = Boolean(createOptions?.create);
    const step = isCreate ? null : editor.findFamilyStepById?.(stepId);
    if (!isCreate && !step) {
      showToast?.("Step details unavailable.", "warning");
      return;
    }
    const detail = editor.getFamilyState?.()?.detail || {};
    const status = String(
      detail.status || detail.route_status || detail.approval_status || "",
    )
      .trim()
      .toUpperCase();
    let allowEdit =
      Boolean(editor.isEditable?.(detail)) &&
      (status === "DRAFT" || isPrmRouteReviewStatus(status));
    if (allowEdit) {
      const catalogues = await requireMasterOptionsForStepAuthoring();
      if (!catalogues.ok) {
        // Still allow read-only inspect when mutation catalogues are unavailable.
        if (!isCreate) allowEdit = false;
        else return;
      }
    }
    const stepLabel = isCreate
      ? "Add route step"
      : step.step_label ||
        step.activity_name ||
        step.step_key ||
        "Step details";
    if (returnFocus && typeof returnFocus.focus === "function") {
      try {
        returnFocus.focus({ preventScroll: true });
      } catch {
        /* ignore focus failures */
      }
    }
    const formAllowEdit = allowEdit && (isCreate || allowEdit);
    openModal({
      title: stepLabel,
      subtitle: isCreate
        ? "Governed step authoring"
        : `Sequence ${step.sequence_no ?? "—"}`,
      html:
        editor.buildFamilyStepDetailHtml?.(step, {
          allowEdit: formAllowEdit,
          sequenceSuggestion: createOptions?.sequenceSuggestion ?? null,
          stepKeySuggestion: createOptions?.stepKeySuggestion ?? null,
        }) || `<div class="status">Step details unavailable.</div>`,
      bind: (modalHost) => {
        if (formAllowEdit) {
          editor.bindFamilyStepFormCascade?.(modalHost, {
            seed: step,
            excludeStepId:
              step?.family_route_step_id ??
              step?.route_step_id ??
              step?.step_id ??
              step?.id ??
              null,
          });
        }
        onModal(modalHost, "click", async (event) => {
          const stepSave = event.target.closest("[data-prm-family-step-save]");
          if (stepSave) {
            await withMutation(stepSave, async () => {
              const values = editor.readFamilyStepFormValues?.(modalHost);
              const excludeId =
                step?.family_route_step_id ??
                step?.route_step_id ??
                step?.step_id ??
                step?.id ??
                null;
              const integrity = editor.validateFamilyStepForm?.(values, {
                excludeStepId: excludeId,
                isPersistedStep: excludeId != null,
              });
              if (!integrity?.ok) {
                showToast?.(
                  integrity.errors?.[0] || "Step validation failed.",
                  "warning",
                );
                return { ok: false };
              }
              values.step_key = canonicalizePrmFamilyRouteStepKey(
                values.step_key,
                { trimEdges: true },
              );
              const result = await editor.saveFamilyStep(
                {
                  step_id: excludeId,
                  step: values,
                },
                { costCentreBlocked: state.costCentreBlocker },
              );
              if (result?.ok) {
                const saved = normalizePrmRpcPayload(result.data) || result.data || {};
                await refreshFamilyRouteEditorAfterStepMutation({
                  successMessage: "Route step saved.",
                  refreshFailureMessage:
                    "Route step saved, but the Family Route could not be refreshed.",
                  expectedStepId:
                    saved.step_id ??
                    saved.family_route_step_id ??
                    excludeId,
                });
              }
              return result;
            });
            return;
          }
          const stepDelete = event.target.closest("[data-prm-step-delete]");
          if (!stepDelete) return;
          await withMutation(stepDelete, async () => {
            const result = await editor.deleteFamilyStep({
              family_route_step_id: stepDelete.getAttribute("data-prm-step-delete"),
            });
            if (result?.ok) {
              await refreshFamilyRouteEditorAfterStepMutation({
                successMessage: "Route step removed.",
                refreshFailureMessage:
                  "Route step removed, but the Family Route could not be refreshed.",
              });
            }
            return result;
          });
        });
      },
    });
  }

  async function openFamilyStepCreateModal({ before = false, relativeStepId = null } = {}) {
    const catalogues = await requireMasterOptionsForStepAuthoring();
    if (!catalogues.ok) return;
    const detail = editor.getFamilyState?.()?.detail || {};
    if (!editor.isEditable?.(detail)) {
      showToast?.("Family route is read-only.", "warning");
      return;
    }
    let sequenceSuggestion;
    if (relativeStepId) {
      const relative = editor.findFamilyStepById?.(relativeStepId);
      const seq = Number(relative?.sequence_no);
      sequenceSuggestion = before
        ? editor.previousFamilyStepSequence?.(seq)
        : editor.nextFamilyStepSequence?.(seq);
    } else {
      sequenceSuggestion = before
        ? editor.previousFamilyStepSequence?.()
        : editor.nextFamilyStepSequence?.();
    }
    await openFamilyStepModal(null, null, {
      create: true,
      sequenceSuggestion,
      stepKeySuggestion: editor.suggestFamilyStepKey?.({}, sequenceSuggestion),
    });
  }

  async function openProductDeltaModal(overrideId = null) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return;
    }
    const detail = editor.getProductState?.()?.detail || {};
    if (!editor.isEditable?.(detail)) {
      showToast?.("Product route is read-only.", "warning");
      return;
    }
    const productRouteId = normalizePrmIntegerId(
      state.selectedProductRouteId ??
        detail.product_route_id ??
        detail.route_id ??
        detail.id,
    );
    if (productRouteId == null) {
      showToast?.("Product route ID is required.", "warning");
      return;
    }
    const catalogues = await requireMasterOptionsForStepAuthoring();
    if (!catalogues.ok) return;
    const existing =
      overrideId != null
        ? editor.findProductOverrideById?.(overrideId)
        : null;
    if (overrideId != null && !existing) {
      showToast?.("Product delta was not found.", "warning");
      return;
    }
    openModal({
      title: existing ? "Edit Product delta" : "Add Product delta",
      subtitle: "Governed Product difference. Saved only when you confirm.",
      html:
        editor.buildProductDeltaFormHtml?.(existing) ||
        `<div class="status">Product delta form unavailable.</div>`,
      bind: (modalHost) => {
        editor.bindProductDeltaForm?.(modalHost, existing);
        onModal(modalHost, "click", async (event) => {
          const cancel = event.target.closest("[data-prm-product-delta-cancel]");
          if (cancel) {
            closeModal({ restorePrevious: false });
            return;
          }
          const save = event.target.closest("[data-prm-product-delta-save]");
          if (!save) return;
          await withMutation(save, async () => {
            const values = editor.readProductDeltaFormValues?.(modalHost);
            const checked = editor.validateProductDeltaForm?.(
              values,
              modalHost,
              existing
                ? normalizePrmIntegerId(existing.override_id ?? existing.id)
                : null,
            ) || {
              ok: false,
              errors: ["Unable to validate the Product delta."],
            };
            if (!checked.ok) {
              showToast?.(checked.errors?.[0] || "Complete the required fields.", "warning");
              return { ok: false, reason: "invalid_form" };
            }
            const result = await editor.saveProductOverride(
              {
                override_id: existing
                  ? normalizePrmIntegerId(existing.override_id ?? existing.id)
                  : null,
                override: values,
              },
              { costCentreBlocked: state.costCentreBlocker },
            );
            if (result?.ok && state.selectedProductRouteId) {
              closeModal({ restorePrevious: false });
              await editor.loadProductDetail(state.selectedProductRouteId, {
                preserveValidationStale: true,
              });
              paintAcceptedPrmLens();
            }
            return result;
          });
        });
      },
      cleanup: () => {
        const content = document.getElementById("drawerContent");
        destroySearchableSelectsIn(content);
      },
    });
  }

  function bindEditor(host, mode) {
    on(host, "click", async (event) => {
      if (mode === "product") {
        const createDraft = event.target.closest(
          "[data-prm-action='create-product-draft']",
        );
        if (createDraft) {
          await submitProductRouteCreateDraft(createDraft, host);
          return;
        }
        const pbsBtn = event.target.closest(
          "[data-prm-action='preferred-batch-size']",
        );
        if (pbsBtn) {
          const href =
            pbsBtn.getAttribute("data-prm-handoff-href") ||
            buildPrmPreferredBatchSizeHandoffAction({
              product_id: state.selectedProductId,
            }).href;
          if (!href) {
            showToast?.(
              "Product ID required for Supply Batch Plan handoff.",
              "warning",
            );
            return;
          }
          const opened = window.open(href, "_blank", "noopener,noreferrer");
          if (!opened) {
            showToast?.(
              "Unable to open Supply Batch Plan in a new window. Allow pop-ups for this site, then try again.",
              "warning",
            );
          }
          return;
        }
      }
      if (mode === "family") {
        const createDraft = event.target.closest(
          "[data-prm-create-family-route-draft]",
        );
        if (createDraft) {
          if (!canEdit()) {
            showToast?.("Edit permission required.", "warning");
            return;
          }
          await openCreateFamilyRouteDraftModal({
            routeFamilyId:
              normalizePrmIntegerId(state.familyRouteCreateFamilyId) ??
              normalizePrmIntegerId(state.deepLink.route_family_id),
            source: "editor",
          });
          return;
        }
        const openRoute = event.target.closest(
          "[data-prm-open-existing-family-route], [data-prm-open-approved-family-route]",
        );
        if (openRoute) {
          const routeId = normalizePrmIntegerId(
            openRoute.getAttribute("data-prm-family-route-id"),
          );
          const familyId =
            normalizePrmIntegerId(state.familyRouteCreateFamilyId) ??
            normalizePrmIntegerId(state.deepLink.route_family_id);
          if (routeId == null || familyId == null) return;
          navigateToFamilyRouteEditor({
            route_family_id: familyId,
            family_route_id: routeId,
            replace: true,
          });
          return;
        }
        const startSuccessor = event.target.closest(
          "[data-prm-create-family-route-successor]",
        );
        if (startSuccessor) {
          if (!canEdit()) {
            showToast?.("Edit permission required.", "warning");
            return;
          }
          await openCreateFamilyRouteDraftModal({
            routeFamilyId:
              normalizePrmIntegerId(state.familyRouteCreateFamilyId) ??
              normalizePrmIntegerId(state.deepLink.route_family_id),
            supersedesRouteId: normalizePrmIntegerId(
              startSuccessor.getAttribute("data-prm-approved-family-route-id"),
            ),
            source: "editor",
          });
          return;
        }
        const overviewTrigger = event.target.closest("[data-prm-route-overview]");
        if (overviewTrigger) {
          openFamilyRouteOverviewModal();
          return;
        }
        const stepRow = event.target.closest("[data-prm-step-row]");
        if (stepRow && !event.target.closest("[data-prm-action]")) {
          await openFamilyStepModal(
            stepRow.getAttribute("data-prm-step-row"),
            stepRow,
          );
          return;
        }
      }
      const action = event.target.closest("[data-prm-action]")?.getAttribute(
        "data-prm-action",
      );
      if (mode === "family" && action === "family-history") {
        const detail = editor.getFamilyState?.()?.detail || {};
        const routeFamilyId =
          normalizePrmIntegerId(detail.route_family_id) ??
          normalizePrmIntegerId(state.selectedRouteFamilyId);
        if (routeFamilyId == null) {
          showToast?.("Route Family is required to load history.", "warning");
          return;
        }
        const history = await loadFamilyHistory(routeFamilyId);
        openHistoryModal(
          "Route Family route history",
          history,
          "family",
          routeFamilyId,
        );
        return;
      }
      if (mode === "family" && action === "clone-family-route") {
        await openCloneFamilyRouteModal();
        return;
      }
      if (mode === "family" && action === "add-family-step-before") {
        await openFamilyStepCreateModal({ before: true });
        return;
      }
      if (mode === "family" && action === "add-family-step-after") {
        await openFamilyStepCreateModal({ before: false });
        return;
      }
      if (action === `validate-${mode}`) {
        if (mode === "family") {
          const familyButton = event.target.closest(
            '[data-prm-action="validate-family"]',
          );
          await withMutation(familyButton, async () => {
            const originalLabel = familyButton?.textContent;
            if (familyButton) familyButton.textContent = "Validating…";
            try {
              const result = await editor.validateFamily();
              if (result?.rpcFailed || result?.error) {
                return result;
              }
              await refreshFamilyRouteEditorAfterLifecycleMutation({
                successMessage: result?.ok
                  ? "Validation passed"
                  : "Validation failed",
                refreshFailureMessage:
                  "Family Route validated, but the editor could not be refreshed.",
                preserveValidationStale: false,
                retainCurrentValidationIfOmitted: true,
              });
              return result;
            } finally {
              if (familyButton && originalLabel) {
                familyButton.textContent = originalLabel;
              }
            }
          });
          return;
        }
        const button = event.target.closest(
          '[data-prm-action="validate-product"]',
        );
        await withMutation(button, async () => {
          const originalLabel = button?.textContent;
          if (button) button.textContent = "Validating…";
          try {
            const result = await editor.validateProduct();
            if (result?.rpcFailed || result?.error) {
              return result;
            }
            if (result?.ok) {
              showToast?.("Validation passed", "success");
            } else {
              showToast?.("Validation failed", "warning");
            }
            paintAcceptedPrmLens();
            return result;
          } finally {
            if (button && originalLabel) button.textContent = originalLabel;
          }
        });
        return;
      }
      if (action === `submit-${mode}`) {
        if (mode === "family") {
          const detail = editor.getFamilyState?.()?.detail || {};
          const status = String(
            detail.status || detail.route_status || detail.approval_status || "",
          )
            .trim()
            .toUpperCase();
          if (status !== "DRAFT") {
            showToast?.("Submit for review is available for DRAFT routes only.", "warning");
            return;
          }
          const dupes = editor.findDuplicateFamilyStepSequences?.() || [];
          if (dupes.length) {
            const proceed = window.confirm(
              `Duplicate sequence number(s) within this route: ${dupes.join(", ")}. Server uniqueness remains authoritative. Continue submit?`,
            );
            if (!proceed) return;
          }
          const result = await editor.submitFamily();
          if (result?.ok) {
            await refreshFamilyRouteEditorAfterLifecycleMutation({
              successMessage: "Family Route submitted for review.",
              refreshFailureMessage:
                "Family Route submitted for review, but the editor could not be refreshed.",
              preserveValidationStale: false,
            });
          }
          return;
        }
        const productDetail = editor.getProductState?.()?.detail || {};
        const productStatus = String(
          productDetail.status ||
            productDetail.route_status ||
            productDetail.approval_status ||
            "",
        )
          .trim()
          .toUpperCase();
        if (productStatus !== "DRAFT") {
          showToast?.(
            productStatus
              ? `Submit for review is available for DRAFT routes only (current: ${formatPrmRouteStatusLabel(productStatus) || productStatus}).`
              : "Submit for review is available for DRAFT routes only.",
            "warning",
          );
          return;
        }
        const submitted = await editor.submitProduct();
        if (submitted?.ok && state.selectedProductRouteId) {
          await editor.loadProductDetail(state.selectedProductRouteId);
          paintAcceptedPrmLens();
        } else if (state.selectedProductRouteId) {
          await editor.loadProductDetail(state.selectedProductRouteId);
          paintAcceptedPrmLens();
        }
        return;
      }
      if (action === `approve-${mode}`) {
        if (mode === "product") {
          openApproveProductRouteModal();
          return;
        }
        openApproveFamilyRouteModal();
        return;
      }
      if (action === `supersede-${mode}`) {
        if (mode === "family") {
          showToast?.(
            "Manual supersede is not the normal workflow. Use Clone as New Version, then Approve the successor.",
            "info",
          );
          return;
        }
        const newId = window.prompt("New approved draft route ID:", "");
        if (newId) {
          await editor.supersedeProduct({ new_product_route_id: newId });
          if (state.selectedProductRouteId) {
            await editor.loadProductDetail(state.selectedProductRouteId);
          }
          paintAcceptedPrmLens();
        }
        return;
      }
      if (action === "add-family-step") {
        await openFamilyStepCreateModal({ before: false });
        return;
      }
      if (action === "apply-family-order") {
        const orderedStepIds = [...host.querySelectorAll("[data-prm-step-row]")].map(
          (row) => row.getAttribute("data-prm-step-row"),
        );
        const result = await editor.applyFamilyStepOrder(orderedStepIds, {
          costCentreBlocked: state.costCentreBlocker,
        });
        if (result?.ok) {
          await refreshFamilyRouteEditorAfterStepMutation({
            successMessage: "Route step order saved.",
            refreshFailureMessage:
              "Route step order saved, but the Family Route could not be refreshed.",
          });
        }
        return;
      }
      if (action === "add-product-delta") {
        await openProductDeltaModal(null);
        return;
      }
      const deltaEdit = event.target.closest("[data-prm-delta-edit]");
      if (deltaEdit) {
        await openProductDeltaModal(
          deltaEdit.getAttribute("data-prm-delta-edit"),
        );
        return;
      }
      const deltaDelete = event.target.closest("[data-prm-delta-delete]");
      if (deltaDelete) {
        await withMutation(deltaDelete, async () => {
          const result = await editor.deleteProductOverride({
            override_id: deltaDelete.getAttribute("data-prm-delta-delete"),
          });
          if (result?.ok && mode === "product" && state.selectedProductRouteId) {
            await editor.loadProductDetail(state.selectedProductRouteId, {
              preserveValidationStale: true,
            });
            paintAcceptedPrmLens();
          }
          return result;
        });
      }
    });
    if (mode === "family") {
      const emptySelect = host.querySelector("[data-prm-family-empty-select]");
      if (emptySelect) {
        on(host, "change", (event) => {
          if (event.target !== emptySelect) return;
          void refreshFamilyRouteEmptyContext(host);
        });
      }
      on(host, "keydown", (event) => {
        const stepRow = event.target.closest?.("[data-prm-step-row]");
        if (!stepRow || !host.contains(stepRow)) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        void openFamilyStepModal(
          stepRow.getAttribute("data-prm-step-row"),
          stepRow,
        );
      });
    }
  }

  function resolveFamilyRouteApprovalLookupCode(detail = {}) {
    const fromDetail = detail.route_family_code || detail.family_code || "";
    if (String(fromDetail).trim()) return fromDetail;
    const familyId =
      normalizePrmIntegerId(detail.route_family_id) ??
      normalizePrmIntegerId(state.selectedRouteFamilyId);
    if (familyId == null) return "";
    return (
      state.routeFamilies.find(
        (family) =>
          normalizePrmIntegerId(family.route_family_id ?? family.id) === familyId,
      )?.route_family_code || ""
    );
  }

  function openApproveFamilyRouteModal() {
    const detail = editor.getFamilyState?.()?.detail || {};
    const identity = resolvePrmFamilyRouteApprovalIdentity({
      detail,
      routeFamilyCode: resolveFamilyRouteApprovalLookupCode(detail),
    });
    if (!identity.ok) {
      showToast?.(identity.error, "warning");
      return;
    }
    const generated = buildPrmFamilyRouteApprovalReference({
      routeFamilyCode: identity.routeFamilyCode,
      routeVersion: identity.routeVersion,
      approvalDate: getPrmLocalIsoDate(),
    });
    if (!generated.ok) {
      showToast?.(generated.error, "warning");
      return;
    }
    openModal({
      title: "Approve Route Family route",
      subtitle: "Canonical approval reference",
      html: formShell({
        sectionTitle: "Approval",
        fieldsHtml: [
          formField({
            id: "prmApproveRouteRef",
            label: "Approval reference",
            required: true,
            full: true,
            readonly: true,
            value: generated.reference,
            hint: PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT,
          }),
        ].join(""),
        actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-approve-route-submit>Approve</button>`,
      }),
      bind: (approveHost) => {
        approveHost.querySelector("[data-prm-approve-route-submit]")?.focus();
        onModal(approveHost, "click", async (event) => {
          const submit = event.target.closest(
            "[data-prm-approve-route-submit]",
          );
          if (!submit) return;
          await withMutation(submit, async () => {
            const currentDetail = editor.getFamilyState?.()?.detail || {};
            const currentIdentity = resolvePrmFamilyRouteApprovalIdentity({
              detail: currentDetail,
              routeFamilyCode: resolveFamilyRouteApprovalLookupCode(currentDetail),
            });
            if (!currentIdentity.ok) {
              showToast?.(currentIdentity.error, "warning");
              return { ok: false, reason: currentIdentity.reason };
            }
            const recomputed = buildPrmFamilyRouteApprovalReference({
              routeFamilyCode: currentIdentity.routeFamilyCode,
              routeVersion: currentIdentity.routeVersion,
              approvalDate: getPrmLocalIsoDate(),
            });
            if (!recomputed.ok) {
              showToast?.(recomputed.error, "warning");
              return { ok: false, reason: recomputed.reason };
            }
            const checked = validatePrmFamilyRouteApprovalReference(
              recomputed.reference,
              {
                routeFamilyCode: currentIdentity.routeFamilyCode,
                routeVersion: currentIdentity.routeVersion,
                approvalDate: getPrmLocalIsoDate(),
              },
            );
            if (!checked.ok) {
              showToast?.(checked.error, "warning");
              return { ok: false, reason: checked.reason };
            }
            const result = await editor.approveFamily(checked.reference, {
              costCentreBlocked: state.costCentreBlocker,
            });
            if (result.ok) {
              const refresh = await refreshFamilyRouteEditorAfterLifecycleMutation({
                successMessage: "Family Route approved.",
                refreshFailureMessage:
                  "Family Route approved, but the editor could not be refreshed.",
                preserveValidationStale: false,
              });
              if (refresh?.ok) {
                const refreshed = editor.getFamilyState?.()?.detail || {};
                const routeFamilyId =
                  normalizePrmIntegerId(refreshed.route_family_id) ??
                  normalizePrmIntegerId(state.selectedRouteFamilyId);
                if (routeFamilyId != null) {
                  await loadFamilyHistory(routeFamilyId);
                }
              }
            }
            return result;
          });
        });
      },
    });
  }

  function openApproveProductRouteModal() {
    const detail = editor.getProductState?.()?.detail || {};
    const identity = resolvePrmProductRouteApprovalIdentity({
      detail,
      selectedProductId: state.selectedProductId,
    });
    if (!identity.ok) {
      showToast?.(identity.error, "warning");
      return;
    }
    const generated = buildPrmProductRouteApprovalReference({
      productId: identity.productId,
      routeVersion: identity.routeVersion,
      approvalDate: getPrmLocalIsoDate(),
    });
    if (!generated.ok) {
      showToast?.(generated.error, "warning");
      return;
    }
    openModal({
      title: "Approve Product route",
      subtitle: "Canonical approval reference",
      html: formShell({
        sectionTitle: "Approval",
        fieldsHtml: [
          formField({
            id: "prmApproveRouteRef",
            label: "Approval reference",
            required: true,
            full: true,
            readonly: true,
            value: generated.reference,
            hint: PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT,
          }),
        ].join(""),
        actionsHtml: `<button type="button" class="icon-btn icon-btn-primary" data-prm-approve-route-submit>Approve</button>`,
      }),
      bind: (approveHost) => {
        approveHost.querySelector("[data-prm-approve-route-submit]")?.focus();
        onModal(approveHost, "click", async (event) => {
          const submit = event.target.closest(
            "[data-prm-approve-route-submit]",
          );
          if (!submit) return;
          await withMutation(submit, async () => {
            const currentDetail = editor.getProductState?.()?.detail || {};
            const currentIdentity = resolvePrmProductRouteApprovalIdentity({
              detail: currentDetail,
              selectedProductId: state.selectedProductId,
            });
            if (!currentIdentity.ok) {
              showToast?.(currentIdentity.error, "warning");
              return { ok: false, reason: currentIdentity.reason };
            }
            const recomputed = buildPrmProductRouteApprovalReference({
              productId: currentIdentity.productId,
              routeVersion: currentIdentity.routeVersion,
              approvalDate: getPrmLocalIsoDate(),
            });
            if (!recomputed.ok) {
              showToast?.(recomputed.error, "warning");
              return { ok: false, reason: recomputed.reason };
            }
            const checked = validatePrmProductRouteApprovalReference(
              recomputed.reference,
              {
                productId: currentIdentity.productId,
                routeVersion: currentIdentity.routeVersion,
                approvalDate: getPrmLocalIsoDate(),
              },
            );
            if (!checked.ok) {
              showToast?.(checked.error, "warning");
              return { ok: false, reason: checked.reason };
            }
            const result = await editor.approveProduct(checked.reference, {
              costCentreBlocked: state.costCentreBlocker,
            });
            if (result.ok) {
              closeModal({ restorePrevious: false });
              if (state.selectedProductRouteId) {
                await editor.loadProductDetail(state.selectedProductRouteId);
              }
              paintAcceptedPrmLens();
            }
            return result;
          });
        });
      },
    });
  }

  function option(value, label, selected = false) {
    return `<option value="${text(value)}" ${selected ? "selected" : ""}>${text(label)}</option>`;
  }

  function renderCandidates() {
    const host = hosts();
    host.tableWrap?.classList.remove("hidden");
    const table = document.getElementById("mainTable");
    if (table) table.style.display = "none";
    host.tableHead.innerHTML = "";
    host.tableBody.innerHTML = "";
    const lensRoot = ensureLensRoot("historical-candidate-review");
    const bodyRoot = document.createElement("div");
    lensRoot.appendChild(bodyRoot);
    host.summary.innerHTML = `<div class="cp-prm-candidate-controls">
      <div class="cp-prm-actions">
        <label>Approved Manufacturing Route Family<select id="prmCandidateFamily" class="cp-period-select"><option value="">Select family</option>${state.routeFamilies.map((family) => option(family.route_family_id ?? family.id, family.route_family_name || family.family_name)).join("")}</select></label>
        <label>Product Groups (Mode B)<select id="prmCandidateGroups" class="cp-period-select" multiple>${state.productGroups.map((group) => option(group.product_group_id ?? group.id, hierarchy(group))).join("")}</select></label>
        <label>Product<select id="prmCandidateProduct" class="cp-period-select"><option value="">Select Product</option>${state.products.map((product) => option(product.product_id ?? product.id, product.product_name || product.name)).join("")}</select></label>
      </div>
      <div class="cp-prm-actions">
        <button class="icon-btn" data-prm-candidate="family-a">Preview family evidence</button>
        <button class="icon-btn" data-prm-candidate="family-b">Preview selected hierarchy</button>
        <button class="icon-btn" data-prm-candidate="product">Preview Product evidence</button>
        <button class="icon-btn" data-prm-candidate="delta">Preview Product differences</button>
      </div>
    </div>`;
    bodyRoot.innerHTML = candidates.render();
    bindCandidates({ ...host, candidates: bodyRoot });
  }

  function bindCandidates(host) {
    on(host.summary, "click", async (event) => {
      const kind = event.target.closest("[data-prm-candidate]")?.getAttribute(
        "data-prm-candidate",
      );
      if (!kind) return;
      const familyId = document.getElementById("prmCandidateFamily")?.value;
      const productId = document.getElementById("prmCandidateProduct")?.value;
      const productGroupIds = [
        ...(document.getElementById("prmCandidateGroups")?.selectedOptions || []),
      ].map((item) => Number(item.value));
      if (kind === "family-a") {
        await candidates.previewFamilyCandidate({
          route_family_id: familyId,
          as_of_date: getAsOfDate(),
        });
      } else if (kind === "family-b") {
        await candidates.previewFamilyCandidate({
          product_group_ids: productGroupIds,
          as_of_date: getAsOfDate(),
        });
      } else if (kind === "product") {
        await candidates.previewProductCandidate({
          product_id: productId,
          as_of_date: getAsOfDate(),
        });
      } else {
        await candidates.previewDeltaCandidate({
          product_id: productId,
          as_of_date: getAsOfDate(),
        });
      }
      paintAcceptedPrmLens();
    });
    on(host.candidates, "click", async (event) => {
      const use = event.target.closest("[data-prm-use-candidate]");
      if (use) {
        const step =
          candidates.getCandidateSteps()[
            Number(use.getAttribute("data-prm-use-candidate"))
          ];
        candidates.setDraftContext({
          family_route_id: state.selectedFamilyRouteId,
          product_route_id: state.selectedProductRouteId,
        });
        await candidates.requestUseInDraft(step || {});
      }
      if (event.target.closest("[data-prm-create-family]")) {
        const name = window.prompt("Manufacturing Route Family name:", "");
        if (name) {
          const result = await candidates.createRouteFamily({
            route_family_name: name,
          });
          if (result.ok) {
            showToast?.("Manufacturing Route Family created. Product Groups remain unmapped.", "success");
          }
        }
      }
    });
  }

  function renderEffective() {
    const host = hosts();
    host.tableWrap?.classList.remove("hidden");
    const table = document.getElementById("mainTable");
    if (table) table.style.display = "none";
    host.tableHead.innerHTML = "";
    host.tableBody.innerHTML = "";
    destroySearchableSelectsIn(host.summary);
    const lensRoot = ensureLensRoot("effective-route-viewer");
    const viewer = state.effectiveViewer || createEmptyEffectiveViewer();
    const selectorProductId = viewer.productId;
    host.summary.innerHTML = `<div class="cp-prm-actions cp-prm-effective-viewer-toolbar">
      <label class="cp-field-label" for="prmEffectiveProduct">Select Product</label>
      <select id="prmEffectiveProduct" class="cp-period-select" aria-label="Search or select Product">
        ${buildEffectiveViewerProductOptionsHtml(selectorProductId)}
      </select>
    </div>`;
    host.summary.classList.add("is-visible");
    const selectEl = document.getElementById("prmEffectiveProduct");
    if (selectEl) {
      enhanceSearchableSelect(selectEl, {
        placeholder: "Search or select Product",
        allowEmptyOption: true,
        openOnFocus: true,
        showAllWhenEmpty: true,
        clearSelectedOnBackspace: true,
      });
      on(selectEl, "change", async () => {
        const pid = normalizePrmIntegerId(selectEl.value);
        if (pid == null) {
          resetEffectiveViewer();
          paintAcceptedPrmLens();
          return;
        }
        await loadEffectiveViewerProduct(pid, "user-select");
        if (state.activeLens !== "effective-route-viewer") return;
        paintAcceptedPrmLens();
      });
    }
    if (viewer.status === "loading") {
      lensRoot.innerHTML = `<div class="status">Loading effective route…</div>`;
      return;
    }
    if (!viewer.productId || viewer.status === "empty") {
      lensRoot.innerHTML = `<div class="status cp-prm-empty-state">${escapeHtml(PRM_EMPTY_STATES.effectiveViewer)}</div>`;
      return;
    }
    if (viewer.status === "error") {
      const productRow = findEffectiveViewerProductRow(viewer.productId);
      const productName =
        productRow.product_name ||
        productRow.name ||
        (viewer.productId != null ? `Product ${viewer.productId}` : "");
      lensRoot.innerHTML = `<div class="cp-prm-effective">
        ${productName ? `<div class="cp-cell-primary">${viewerPlainText(productName)}</div>` : ""}
        <div class="status cp-prm-badge-danger">${viewerPlainText(viewer.error || "Unable to load effective route.")}</div>
      </div>`;
      return;
    }
    const payload = viewer.payload;
    if (!payload) {
      lensRoot.innerHTML = `<div class="status cp-prm-empty-state">${escapeHtml(PRM_EMPTY_STATES.effectiveViewer)}</div>`;
      return;
    }
    const steps = coercePrmList(payload.steps || payload.effective_steps);
    lensRoot.innerHTML = `<div class="cp-prm-effective">
      ${buildEffectiveViewerHeaderHtml(viewer)}
      ${buildEffectiveStepsTableHtml(steps)}
    </div>`;
  }

  function hideSpecialHosts(generation = null) {
    if (
      !shouldApplyPrmLensTransitionTeardown({
        requestGeneration: generation == null ? lensRenderGeneration : generation,
        currentGeneration: lensRenderGeneration,
      })
    ) {
      return;
    }
    clearLensOwnedDom();
  }

  function finalizePrmLoad(token, active, result = {}) {
    if (token !== lensRenderGeneration || state.activeLens !== active) {
      return { ok: false, stale: true, generation: token };
    }
    return { ...result, generation: token, stale: false };
  }

  async function load({ lens, deepLink = {}, resetOffset = false, search } = {}) {
    if (disposed) return { ok: false };
    state.deepLink = { ...deepLink };
    if (deepLink.as_of_date) state.as_of_date = deepLink.as_of_date;
    const requestedLens =
      lens || getCurrentLens() || PRODUCTION_ROUTE_DEFAULT_LENS;
    // Intentional Family / Product Route Editor tab entry may omit route ids.
    const allowEditorWithoutId =
      String(requestedLens || "").trim() === "route-family-route-editor" ||
      String(requestedLens || "").trim() === "product-route-editor";
    let active = resolveProductionRouteLens(requestedLens, {
      family_route_id: deepLink.family_route_id,
      product_route_id: deepLink.product_route_id,
      product_id: deepLink.product_id,
      allowEditorWithoutId,
    });
    if (
      active === PRODUCTION_ROUTE_DEFAULT_LENS &&
      (lens === "product-group-routes" || lens === "product-group-route-editor")
    ) {
      state.deepLink = {
        as_of_date: deepLink.as_of_date || null,
        product_id: deepLink.product_id || null,
        product_group_id: deepLink.product_group_id || null,
        route_family_id: deepLink.route_family_id || null,
      };
      navigate(active, state.deepLink, true);
    }
    state.activeLens = active;
    const token = beginLensTransition(active);
    hideSpecialHosts(token);
    if (active === "route-readiness") {
      const result = await loadReadiness({ resetOffset, search });
      return finalizePrmLoad(token, active, result);
    }
    if (active === "product-route-assignments") {
      if (deepLink.product_group_id) {
        state.product_group_id = String(deepLink.product_group_id);
      }
      if (deepLink.route_family_id) {
        state.route_family_id = String(deepLink.route_family_id);
      }
      const focusPid = normalizePrmIntegerId(deepLink.product_id);
      state.assignmentFocusProductId = focusPid;
      if (focusPid != null) {
        state.selectedProductId = focusPid;
      }
      const result = await loadProductAssignments({ resetOffset, search });
      return finalizePrmLoad(token, active, result);
    }
    if (active === "shared-workload-preview") {
      if (deepLink.product_group_id) {
        state.product_group_id = String(deepLink.product_group_id);
      }
      if (deepLink.route_family_id) {
        state.route_family_id = String(deepLink.route_family_id);
      }
      if (deepLink.product_id) {
        state.product_id = String(deepLink.product_id);
      }
      const result = await loadWorkloadPreview({ resetOffset, search });
      return finalizePrmLoad(token, active, result);
    }
    if (active === "route-families") {
      if (deepLink.product_group_id) {
        state.preselectProductGroupId = normalizePrmIntegerId(
          deepLink.product_group_id,
        );
      }
      const result = await loadRouteFamilies();
      const accepted = finalizePrmLoad(token, active, result);
      if (accepted.stale) return accepted;
      // Open Family summary only from an explicit one-shot intent (navigate or
      // Families-only deep link). Do not reopen from leftover editor URL params.
      const openFamilyId = normalizePrmIntegerId(pendingOpenRouteFamilyId);
      pendingOpenRouteFamilyId = null;
      if (result.ok && openFamilyId != null) {
        const family = await findFamilyRow(openFamilyId);
        await openFamilySummary(family);
      }
      return finalizePrmLoad(token, active, result);
    }
    if (active === "route-family-mapping-review") {
      const result = await loadMappingReview({ search });
      return finalizePrmLoad(token, active, result);
    }
    if (active === "route-family-foundation-review") {
      const result = await loadFoundationReview({ resetOffset, search });
      return finalizePrmLoad(token, active, result);
    }
    if (active === "production-cost-centres") {
      await ensureMasterOptions();
      const afterOptions = finalizePrmLoad(token, active, { ok: true });
      if (afterOptions.stale) return afterOptions;
      if (!costCentres) return { ok: false, generation: token };
      costCentres.paintLoading?.();
      const result = await costCentres.load({ search });
      return finalizePrmLoad(token, active, result);
    }
    if (active === "route-family-route-editor") {
      const familyRouteId = resolvePrmFamilyRouteEditorLoadId({
        requestDeepLink: deepLink,
        committedDeepLink: state.deepLink,
      });
      state.selectedFamilyRouteId = familyRouteId;
      const optionsPromise = ensureMasterOptions();
      if (familyRouteId == null) {
        editor.clearFamilyEditorContext?.();
        const routeFamilyId = normalizePrmIntegerId(
          deepLink.route_family_id ?? state.deepLink?.route_family_id,
        );
        state.familyRouteCreateFamilyId = routeFamilyId;
        if (routeFamilyId != null) {
          state.selectedRouteFamilyId = routeFamilyId;
        } else {
          state.familyRouteCreateEligibility = null;
        }
        await optionsPromise;
        return finalizePrmLoad(token, active, { ok: true, empty: true });
      }
      familyRouteOpenGeneration += 1;
      state.deepLink = {
        ...(state.deepLink || {}),
        ...(deepLink || {}),
        family_route_id: familyRouteId,
      };
      const [result] = await Promise.all([
        editor.loadFamilyDetail(familyRouteId),
        optionsPromise,
      ]);
      return finalizePrmLoad(token, active, result);
    }
    if (active === "product-route-editor") {
      const productRouteId = normalizePrmIntegerId(deepLink.product_route_id);
      const productId = normalizePrmIntegerId(deepLink.product_id);
      state.selectedProductRouteId = productRouteId;
      state.selectedProductId = productId;
      if (productRouteId != null) {
        state.productRouteCreateHandoff = null;
        state.productRouteReentryChooser = null;
        const [result] = await Promise.all([
          editor.loadProductDetail(productRouteId),
          ensureMasterOptions(),
        ]);
        return finalizePrmLoad(token, active, result);
      }
      if (
        isPrmProductRouteEditorCreateContext({
          product_id: productId,
          product_route_id: productRouteId,
        })
      ) {
        const historyResult = await loadProductHistory(productId);
        const historyAccepted = finalizePrmLoad(token, active, historyResult);
        if (historyAccepted.stale) return historyAccepted;
        const eligibility = resolvePrmOpenProductRouteEligibility(
          { product_id: productId },
          historyResult.versions || [],
        );
        const historyRows = historyResult.versions || [];
        if (
          eligibility.current_product_route_ambiguous ||
          (eligibility.open_product_route_id == null && historyRows.length > 0)
        ) {
          state.productRouteCreateHandoff = null;
          state.productRouteReentryChooser = {
            product_id: productId,
            versions: historyRows,
          };
          editor.clearProductEditorContext?.();
          await ensureMasterOptions();
          return finalizePrmLoad(token, active, { ok: true, chooser: true });
        }
        if (eligibility.open_product_route_id != null) {
          const openId = eligibility.open_product_route_id;
          state.productRouteCreateHandoff = null;
          state.productRouteReentryChooser = null;
          state.selectedProductRouteId = openId;
          applyPrmDeepLinkToUrl(
            "product-route-editor",
            { product_id: productId, product_route_id: openId },
            true,
          );
          state.deepLink = applyDeepLinkFromUrl();
          const [result] = await Promise.all([
            editor.loadProductDetail(openId),
            ensureMasterOptions(),
          ]);
          return finalizePrmLoad(token, active, result);
        }
        state.productRouteReentryChooser = null;
        editor.clearProductEditorContext?.();
        await loadMasterOptions({ product_id: productId });
        const afterMasters = finalizePrmLoad(token, active, { ok: true });
        if (afterMasters.stale) return afterMasters;
        await hydrateProductRouteCreateHandoff(productId);
        return finalizePrmLoad(token, active, { ok: true, create: true });
      }
      state.productRouteCreateHandoff = null;
      state.productRouteReentryChooser = null;
      editor.clearProductEditorContext?.();
      await ensureMasterOptions();
      return finalizePrmLoad(token, active, { ok: true, empty: true });
    }
    if (active === "historical-candidate-review") {
      const result = await ensureMasterOptions();
      const acceptedCandidates = finalizePrmLoad(token, active, result);
      if (acceptedCandidates.stale) return acceptedCandidates;
      state.selectedRouteFamilyId = deepLink.route_family_id || null;
      state.selectedProductId = deepLink.product_id || null;
      return acceptedCandidates;
    }
    if (active === "effective-route-viewer") {
      const result = await ensureMasterOptions();
      const afterOptions = finalizePrmLoad(token, active, result);
      if (afterOptions.stale) return afterOptions;
      if (!result.ok) return afterOptions;
      const productId = normalizePrmIntegerId(deepLink.product_id);
      if (productId == null) {
        resetEffectiveViewer();
        return finalizePrmLoad(token, active, result);
      }
      await loadEffectiveViewerProduct(productId, "deep-link");
      return finalizePrmLoad(token, active, { ok: true });
    }
    if (active === "product-subgroup-mappings") {
      if (deepLink.product_group_id) {
        state.product_group_id = String(deepLink.product_group_id);
      }
      if (deepLink.route_family_id) {
        state.route_family_id = String(deepLink.route_family_id);
      }
      if (deepLink.product_subgroup_id) {
        state.product_subgroup_id = String(deepLink.product_subgroup_id);
      }
      const result = await subgroupArchive.loadSubgroupMappings({
        resetOffset,
        search,
      });
      return finalizePrmLoad(token, active, result);
    }
    if (active === "archived-routes") {
      if (deepLink.entity_type) {
        state.archived_entity_type = normalizePrmCode(
          deepLink.entity_type,
        ).toUpperCase();
      }
      const result = await subgroupArchive.loadArchivedRoutes({
        resetOffset,
        search,
      });
      return finalizePrmLoad(token, active, result);
    }
    return { ok: false, generation: token };
  }

  async function reloadCurrentLens() {
    return load({
      lens: state.activeLens,
      deepLink: state.deepLink,
      search: state.search,
    });
  }

  function clearPrmDormantStatus() {
    const el = document.getElementById("statusArea");
    if (!el) return;
    el.textContent = "";
    el.innerHTML = "";
    el.hidden = true;
    el.removeAttribute("data-type");
    el.style.display = "none";
  }

  function render(options = {}) {
    const paintGeneration = options.paintGeneration;
    if (
      !acceptPrmPaintGeneration(
        paintGeneration == null ? lensRenderGeneration : paintGeneration,
      )
    ) {
      return;
    }
    unbind();
    renderSetupChip();
    hideSpecialHosts();
    document
      .querySelector(".main .table-card, .table-card")
      ?.classList.toggle(
        "cp-prm-cost-centres-chrome-active",
        state.activeLens === "production-cost-centres",
      );
    document
      .querySelector(".main .table-card, .table-card")
      ?.classList.toggle(
        "cp-prm-route-families-chrome-active",
        state.activeLens === "route-families",
      );
    const summaryHost = hosts().summary;
    const familiesActive = state.activeLens === "route-families";
    const mappingActive = state.activeLens === "route-family-mapping-review";
    const foundationActive =
      state.activeLens === "route-family-foundation-review";
    const costCentresActive = state.activeLens === "production-cost-centres";
    if (summaryHost?.classList) {
      if (
        !familiesActive &&
        !mappingActive &&
        !foundationActive &&
        !costCentresActive
      ) {
        summaryHost.classList.remove("is-visible");
      }
      if (!mappingActive) {
        summaryHost.classList.remove("cp-prm-mapping-review-summary-host");
      }
      if (!foundationActive) {
        summaryHost.classList.remove("cp-prm-foundation-review-summary-host");
      }
      if (!costCentresActive) {
        summaryHost.classList.remove("cp-prm-cost-centres-summary-host");
      }
      if (!familiesActive) {
        summaryHost.classList.remove("cp-prm-route-families-summary-host");
      }
    }
    if (state.activeLens === "route-readiness") renderReadiness();
    else if (state.activeLens === "product-route-assignments") {
      renderAssignments();
    }
    else if (state.activeLens === "shared-workload-preview") {
      renderWorkloadPreview();
    }
    else if (state.activeLens === "route-families") renderRouteFamilies();
    else if (state.activeLens === "route-family-mapping-review") {
      renderMappingReview();
    }
    else if (state.activeLens === "route-family-foundation-review") {
      renderFoundationReview();
    }
    else if (state.activeLens === "production-cost-centres") {
      costCentres?.render();
    }
    else if (state.activeLens === "route-family-route-editor") renderEditorLens("family");
    else if (state.activeLens === "product-route-editor") renderEditorLens("product");
    else if (state.activeLens === "historical-candidate-review") renderCandidates();
    else if (state.activeLens === "effective-route-viewer") renderEffective();
    else if (state.activeLens === "product-subgroup-mappings") {
      subgroupArchive.renderSubgroupMappings();
    } else if (state.activeLens === "archived-routes") {
      subgroupArchive.renderArchivedRoutes();
    }
    syncPrmAsOfDateChrome();
    syncPrmFilterDrawerSections();
    clearPrmDormantStatus();
    const asOf = document.getElementById("prmAsOfDate");
    on(asOf, "change", async () => {
      if (state.activeLens === "shared-workload-preview") return;
      // Assignment list itself does not depend on as-of date.
      if (state.activeLens === "product-route-assignments") return;
      state.as_of_date = asOf.value;
      const result = await reloadCurrentLens();
      if (result?.stale === true) return;
      paintAcceptedPrmLens({ generation: result?.generation });
    });
  }

  function syncPageFromShell(page, pageSize = 25) {
    if (state.activeLens === "shared-workload-preview") {
      // Infinite scroll owns paging; shell must not force page flips.
      state.page = 1;
      state.offset = 0;
      state.workloadOffset = 0;
      state.limit = Math.max(1, Number(state.workloadLimit) || 50);
      return;
    }
    state.page = Math.max(1, Number(page) || 1);
    state.limit = Math.max(1, Number(pageSize) || 25);
    state.offset = pageToPrmOffset(state.page, state.limit);
  }

  async function setReadinessStatus(code) {
    state.readiness_status = normalizePrmCode(code);
    return loadReadiness({ resetOffset: true });
  }

  async function setAssignmentStatus(code) {
    state.assignment_status = normalizePrmCode(code);
    return loadProductAssignments({ resetOffset: true });
  }

  async function setSubgroupMappingStatus(code) {
    state.subgroup_mapping_status = normalizePrmCode(code);
    return subgroupArchive.loadSubgroupMappings({ resetOffset: true });
  }

  async function setProductSubgroupFilter(id) {
    state.product_subgroup_id = id == null ? "" : String(id);
    if (state.activeLens === "product-subgroup-mappings") {
      return subgroupArchive.loadSubgroupMappings({ resetOffset: true });
    }
    return { ok: true };
  }

  async function setArchivedEntityType(code) {
    state.archived_entity_type = normalizePrmCode(code).toUpperCase();
    if (state.activeLens === "archived-routes") {
      return subgroupArchive.loadArchivedRoutes({ resetOffset: true });
    }
    return { ok: true };
  }

  async function setFoundationStatus(code) {
    state.foundation_status = normalizePrmCode(code);
    return loadWorkloadPreview({ resetOffset: true });
  }

  async function setQuantityDriverStatus(code) {
    state.quantity_driver_status = normalizePrmCode(code);
    return loadWorkloadPreview({ resetOffset: true });
  }

  async function setDlScopeFilter(code) {
    state.dl_scope_filter = normalizePrmCode(code);
    return loadWorkloadPreview({ resetOffset: true });
  }

  async function setPohScopeFilter(code) {
    state.poh_scope_filter = normalizePrmCode(code);
    return loadWorkloadPreview({ resetOffset: true });
  }

  async function setProductGroupFilter(id) {
    state.product_group_id = id == null ? "" : String(id);
    if (state.activeLens === "product-route-assignments") {
      return loadProductAssignments({ resetOffset: true });
    }
    if (state.activeLens === "product-subgroup-mappings") {
      return subgroupArchive.loadSubgroupMappings({ resetOffset: true });
    }
    if (state.activeLens === "shared-workload-preview") {
      return loadWorkloadPreview({ resetOffset: true });
    }
    return loadReadiness({ resetOffset: true });
  }

  async function setRouteFamilyFilter(id) {
    state.route_family_id = id == null ? "" : String(id);
    if (state.activeLens === "product-route-assignments") {
      return loadProductAssignments({ resetOffset: true });
    }
    if (state.activeLens === "product-subgroup-mappings") {
      return subgroupArchive.loadSubgroupMappings({ resetOffset: true });
    }
    if (state.activeLens === "shared-workload-preview") {
      return loadWorkloadPreview({ resetOffset: true });
    }
    return loadReadiness({ resetOffset: true });
  }

  async function clearSubgroupFilters() {
    state.subgroup_mapping_status = "";
    state.search = "";
    state.product_group_id = "";
    state.route_family_id = "";
    state.product_subgroup_id = "";
    return subgroupArchive.loadSubgroupMappings({
      resetOffset: true,
      search: "",
    });
  }

  async function clearArchivedFilters() {
    state.archived_entity_type = "";
    state.search = "";
    return subgroupArchive.loadArchivedRoutes({
      resetOffset: true,
      search: "",
    });
  }

  async function clearAssignmentFilters() {
    state.assignment_status = "";
    state.search = "";
    state.product_group_id = "";
    state.route_family_id = "";
    state.assignmentFocusProductId = null;
    const nextDeepLink = { ...(state.deepLink || {}) };
    delete nextDeepLink.product_id;
    state.deepLink = nextDeepLink;
    if (state.activeLens === "product-route-assignments") {
      applyPrmDeepLinkToUrl("product-route-assignments", nextDeepLink, true);
    }
    return loadProductAssignments({ resetOffset: true, search: "" });
  }

  async function clearReadinessFilters() {
    state.readiness_status = "";
    state.search = "";
    state.product_group_id = "";
    state.route_family_id = "";
    return loadReadiness({ resetOffset: true, search: "" });
  }

  async function clearWorkloadFilters() {
    state.foundation_status = "";
    state.quantity_driver_status = "";
    state.dl_scope_filter = "";
    state.poh_scope_filter = "";
    state.search = "";
    state.product_group_id = "";
    state.route_family_id = "";
    state.product_id = "";
    return loadWorkloadPreview({ resetOffset: true, search: "" });
  }

  async function clearCostCentreFilters() {
    state.search = "";
    if (!costCentres) return { ok: false };
    return costCentres.clearFilters?.() || { ok: false };
  }

  function rebuildCostCentrePeqOptions() {
    syncPrmFilterDrawerSections();
    costCentres?.syncDrawerFilters?.();
  }

  function syncPrmFilterDrawerSections() {
    const readinessSection = document.querySelector(
      '#peqFilterDrawer [data-peq-section="prm-readiness"]',
    );
    const assignmentsSection = document.querySelector(
      '#peqFilterDrawer [data-peq-section="prm-assignments"]',
    );
    const subgroupSection = document.querySelector(
      '#peqFilterDrawer [data-peq-section="prm-subgroup"]',
    );
    const archivedSection = document.querySelector(
      '#peqFilterDrawer [data-peq-section="prm-archived"]',
    );
    const workloadSection = document.querySelector(
      '#peqFilterDrawer [data-peq-section="prm-workload"]',
    );
    const groupSection = document.querySelector(
      '#peqFilterDrawer [data-peq-section="prm-group"]',
    );
    const familySection = document.querySelector(
      '#peqFilterDrawer [data-peq-section="prm-family"]',
    );
    const costCentresSection = document.querySelector(
      '#peqFilterDrawer [data-peq-section="prm-cost-centres"]',
    );
    const assignmentsActive = state.activeLens === "product-route-assignments";
    const subgroupActive = state.activeLens === "product-subgroup-mappings";
    const archivedActive = state.activeLens === "archived-routes";
    const readinessActive = state.activeLens === "route-readiness";
    const workloadActive = state.activeLens === "shared-workload-preview";
    const costCentresActive = state.activeLens === "production-cost-centres";
    const showSharedFilters =
      assignmentsActive ||
      readinessActive ||
      workloadActive ||
      subgroupActive;
    if (readinessSection) {
      readinessSection.hidden = !readinessActive;
      readinessSection.style.display = readinessActive ? "" : "none";
    }
    if (assignmentsSection) {
      assignmentsSection.hidden = !assignmentsActive;
      assignmentsSection.style.display = assignmentsActive ? "" : "none";
    }
    if (subgroupSection) {
      subgroupSection.hidden = !subgroupActive;
      subgroupSection.style.display = subgroupActive ? "" : "none";
    }
    if (archivedSection) {
      archivedSection.hidden = !archivedActive;
      archivedSection.style.display = archivedActive ? "" : "none";
    }
    if (workloadSection) {
      workloadSection.hidden = !workloadActive;
      workloadSection.style.display = workloadActive ? "" : "none";
    }
    if (groupSection) {
      groupSection.hidden = !showSharedFilters;
      groupSection.style.display = showSharedFilters ? "" : "none";
    }
    if (familySection) {
      familySection.hidden = !showSharedFilters;
      familySection.style.display = showSharedFilters ? "" : "none";
    }
    if (costCentresSection) {
      costCentresSection.hidden = !costCentresActive;
      costCentresSection.style.display = costCentresActive ? "" : "none";
    }
    if (costCentresActive) {
      costCentres?.syncDrawerFilters?.();
    }
    if (subgroupActive) {
      rebuildSubgroupPeqOptions();
    }
  }

  function rebuildSubgroupPeqOptions() {
    const statusList = document.getElementById("prmSubgroupStatusChecklist");
    if (statusList) {
      const counts = state.subgroup_mapping_status_counts || {};
      const activeStatus = normalizePrmCode(
        state.subgroup_mapping_status,
      ).toUpperCase();
      const statuses = [
        "",
        "DRAFT",
        "IN_REVIEW",
        "APPROVED",
        "SUPERSEDED",
        "INACTIVE",
      ];
      statusList.innerHTML = statuses
        .map((code) => {
          const label = code
            ? formatPrmAssignmentStatusLabel(code) || code
            : "All";
          const count = code ? counts[code] : state.subgroupMappingTotalCount;
          const checked =
            (code && activeStatus === code) || (!code && !activeStatus)
              ? "checked"
              : "";
          return `<li><label><input type="radio" name="prmSubgroupStatus" data-prm-subgroup-status="${text(code)}" ${checked}> ${text(label)}${
            count != null && Number.isFinite(Number(count))
              ? ` <span class="cp-muted-text">(${text(count)})</span>`
              : ""
          }</label></li>`;
        })
        .join("");
    }
    const subgroupSelect = document.getElementById("prmSubgroupFilterSelect");
    if (subgroupSelect) {
      const selected = normalizePrmIntegerId(state.product_subgroup_id);
      const opts = coercePrmList(state.productSubgroups);
      subgroupSelect.innerHTML = `<option value="">All Product Subgroups</option>${opts
        .map((row) => {
          const id = normalizePrmIntegerId(
            row.product_subgroup_id ?? row.subgroup_id ?? row.id,
          );
          if (id == null) return "";
          const name =
            row.product_subgroup_name ||
            row.subgroup_name ||
            row.name ||
            `Subgroup ${id}`;
          return `<option value="${text(id)}" ${
            selected === id ? "selected" : ""
          }>${text(name)}</option>`;
        })
        .join("")}`;
    }
  }

  function rebuildAssignmentPeqOptions() {
    syncPrmFilterDrawerSections();
    const list = document.getElementById("prmAssignmentChecklist");
    if (list) {
      const counts =
        state.assignment_status_counts_baseline ||
        state.assignment_status_counts ||
        {};
      const allTotal =
        state.assignmentTotalBaseline != null
          ? state.assignmentTotalBaseline
          : sumPrmStatusCounts(counts);
      const primary = selectPrmPrimaryAssignmentFilterStatuses(counts);
      const activeStatus = normalizePrmCode(state.assignment_status).toUpperCase();
      const primarySet = new Set(primary);
      list.innerHTML = [
        `<li><label><input type="radio" name="prmAssignmentStatus" data-prm-assignment-status="" ${
          activeStatus ? "" : "checked"
        }> All${
          allTotal != null && Number.isFinite(Number(allTotal))
            ? ` <span class="cp-muted-text">(${text(allTotal)})</span>`
            : ""
        }</label></li>`,
        ...primary.map((code) => {
          const n = Number(counts[code]);
          return `<li><label><input type="radio" name="prmAssignmentStatus" data-prm-assignment-status="${text(
            code,
          )}" ${
            activeStatus === code ? "checked" : ""
          }> ${text(formatPrmAssignmentStatusLabel(code))}${
            Number.isFinite(n)
              ? ` <span class="cp-muted-text">(${text(n)})</span>`
              : ""
          }</label></li>`;
        }),
      ].join("");
      // If active status is zero-count (selected via More), keep a checked radio.
      if (activeStatus && !primarySet.has(activeStatus)) {
        const radios = list.querySelectorAll(
          'input[name="prmAssignmentStatus"]',
        );
        radios.forEach((el) => {
          el.checked = false;
        });
      }
    }
    const more = document.getElementById("prmAssignmentMoreStatuses");
    if (more) {
      const counts =
        state.assignment_status_counts_baseline ||
        state.assignment_status_counts ||
        {};
      const activeStatus = normalizePrmCode(state.assignment_status).toUpperCase();
      more.innerHTML = `<option value="">Select status…</option>${PRM_ASSIGNMENT_STATUSES.map(
        (code) => {
          const n = Number(counts[code]);
          const label = `${formatPrmAssignmentStatusLabel(code)} (${
            Number.isFinite(n) ? n : 0
          })`;
          return option(code, label, activeStatus === code);
        },
      ).join("")}`;
    }
    rebuildSharedPrmFilterSelects();
  }

  function rebuildWorkloadPeqOptions() {
    syncPrmFilterDrawerSections();
    const foundationCounts =
      state.workload_status_counts_baseline ||
      state.workload_status_counts ||
      {};
    const quantityCounts =
      state.workload_quantity_status_counts_baseline ||
      state.workload_quantity_status_counts ||
      {};
    const allTotal =
      state.workloadTotalBaseline != null
        ? state.workloadTotalBaseline
        : sumPrmStatusCounts(foundationCounts);
    const foundationList = document.getElementById(
      "prmWorkloadFoundationChecklist",
    );
    if (foundationList) {
      const primary = selectPrmPrimaryWorkloadFilterStatuses(foundationCounts);
      const active = normalizePrmCode(state.foundation_status).toUpperCase();
      const primarySet = new Set(primary);
      foundationList.innerHTML = [
        `<li><label><input type="radio" name="prmWorkloadFoundation" data-prm-workload-foundation="" ${
          active ? "" : "checked"
        }> All${
          allTotal != null && Number.isFinite(Number(allTotal))
            ? ` <span class="cp-muted-text">(${text(allTotal)})</span>`
            : ""
        }</label></li>`,
        ...primary.map((code) => {
          const n = Number(foundationCounts[code]);
          return `<li><label><input type="radio" name="prmWorkloadFoundation" data-prm-workload-foundation="${text(
            code,
          )}" ${
            active === code ? "checked" : ""
          }> ${text(formatPrmFoundationStatusLabel(code))}${
            Number.isFinite(n)
              ? ` <span class="cp-muted-text">(${text(n)})</span>`
              : ""
          }</label></li>`;
        }),
      ].join("");
      if (active && !primarySet.has(active)) {
        foundationList
          .querySelectorAll('input[name="prmWorkloadFoundation"]')
          .forEach((el) => {
            el.checked = false;
          });
      }
    }
    const moreFoundations = document.getElementById(
      "prmWorkloadMoreFoundations",
    );
    if (moreFoundations) {
      const active = normalizePrmCode(state.foundation_status).toUpperCase();
      const primary = selectPrmPrimaryWorkloadFilterStatuses(foundationCounts);
      const secondary = selectPrmSecondaryWorkloadFilterStatuses(
        foundationCounts,
        PRM_READINESS_STATUSES,
      );
      // More lists only non-primary statuses (esp. zero-count), avoiding chip duplication.
      moreFoundations.innerHTML = `<option value="">Select status…</option>${secondary
        .map((code) => {
          const n = Number(foundationCounts[code]);
          return option(
            code,
            `${formatPrmFoundationStatusLabel(code)} (${
              Number.isFinite(n) ? n : 0
            })`,
            active === code,
          );
        })
        .join("")}`;
      if (active && primary.includes(active)) {
        moreFoundations.value = "";
      }
    }
    const quantityList = document.getElementById(
      "prmWorkloadQuantityChecklist",
    );
    if (quantityList) {
      const primary = selectPrmPrimaryWorkloadFilterStatuses(quantityCounts);
      const active = normalizePrmCode(
        state.quantity_driver_status,
      ).toUpperCase();
      const primarySet = new Set(primary);
      const qtyTotal = sumPrmStatusCounts(quantityCounts);
      quantityList.innerHTML = [
        `<li><label><input type="radio" name="prmWorkloadQuantity" data-prm-workload-quantity="" ${
          active ? "" : "checked"
        }> All${
          qtyTotal != null && Number.isFinite(Number(qtyTotal))
            ? ` <span class="cp-muted-text">(${text(qtyTotal)})</span>`
            : ""
        }</label></li>`,
        ...primary.map((code) => {
          const n = Number(quantityCounts[code]);
          return `<li><label><input type="radio" name="prmWorkloadQuantity" data-prm-workload-quantity="${text(
            code,
          )}" ${
            active === code ? "checked" : ""
          }> ${text(formatPrmFoundationStatusLabel(code))}${
            Number.isFinite(n)
              ? ` <span class="cp-muted-text">(${text(n)})</span>`
              : ""
          }</label></li>`;
        }),
      ].join("");
      if (active && !primarySet.has(active)) {
        quantityList
          .querySelectorAll('input[name="prmWorkloadQuantity"]')
          .forEach((el) => {
            el.checked = false;
          });
      }
    }
    const moreQuantities = document.getElementById(
      "prmWorkloadMoreQuantities",
    );
    if (moreQuantities) {
      const active = normalizePrmCode(
        state.quantity_driver_status,
      ).toUpperCase();
      const primary = selectPrmPrimaryWorkloadFilterStatuses(quantityCounts);
      const knownQty = Object.keys(quantityCounts).sort();
      const secondary = selectPrmSecondaryWorkloadFilterStatuses(
        quantityCounts,
        knownQty.length ? knownQty : Object.keys(quantityCounts),
      );
      moreQuantities.innerHTML = `<option value="">Select status…</option>${secondary
        .map((code) => {
          const n = Number(quantityCounts[code]);
          return option(
            code,
            `${formatPrmFoundationStatusLabel(code)} (${
              Number.isFinite(n) ? n : 0
            })`,
            active === code,
          );
        })
        .join("")}`;
      if (active && primary.includes(active)) {
        moreQuantities.value = "";
      }
    }
    const dlSelect = document.getElementById("prmWorkloadDlScopeFilter");
    if (dlSelect) {
      const active = normalizePrmCode(state.dl_scope_filter).toUpperCase();
      dlSelect.value = active || "";
    }
    const pohSelect = document.getElementById("prmWorkloadPohScopeFilter");
    if (pohSelect) {
      const active = normalizePrmCode(state.poh_scope_filter).toUpperCase();
      pohSelect.value = active || "";
    }
    rebuildSharedPrmFilterSelects();
  }

  function rebuildSharedPrmFilterSelects() {
    const select = document.getElementById("prmProductGroupFilter");
    if (select) {
      select.innerHTML = `<option value="">All Product Groups</option>${state.productGroups
        .map((group) =>
          option(
            group.product_group_id ?? group.id,
            hierarchy(group),
            String(state.product_group_id) ===
              String(group.product_group_id ?? group.id),
          ),
        )
        .join("")}`;
    }
    const familySelect = document.getElementById("prmRouteFamilyFilter");
    if (familySelect) {
      familySelect.innerHTML = `<option value="">All Manufacturing Route Families</option>${state.routeFamilies
        .map((family) =>
          option(
            family.route_family_id ?? family.id,
            family.route_family_name ||
              family.family_name ||
              family.route_family_code ||
              family.family_code,
            String(state.route_family_id) ===
              String(family.route_family_id ?? family.id),
          ),
        )
        .join("")}`;
    }
  }

  function rebuildReadinessPeqOptions() {
    syncPrmFilterDrawerSections();
    const list = document.getElementById("prmReadinessChecklist");
    if (list) {
      const counts = state.status_counts_baseline || state.status_counts || {};
      const allTotal =
        state.exact_run_total != null
          ? state.exact_run_total
          : sumPrmStatusCounts(counts);
      const primary = selectPrmPrimaryReadinessFilterStatuses(counts);
      list.innerHTML = [
        `<li><label><input type="radio" name="prmReadinessStatus" data-prm-readiness="" ${state.readiness_status ? "" : "checked"}> All statuses${
          allTotal != null && Number.isFinite(Number(allTotal))
            ? ` <span class="cp-muted-text">(${text(allTotal)})</span>`
            : ""
        }</label></li>`,
        ...primary.map((code) => {
          const n = Number(counts[code]);
          return `<li><label><input type="radio" name="prmReadinessStatus" data-prm-readiness="${text(code)}" ${
            state.readiness_status === code ? "checked" : ""
          }> ${text(formatPrmReadinessLabel(code))}${
            Number.isFinite(n)
              ? ` <span class="cp-muted-text">(${text(n)})</span>`
              : ""
          }</label></li>`;
        }),
      ].join("");
    }
    rebuildSharedPrmFilterSelects();
    if (state.activeLens === "product-route-assignments") {
      rebuildAssignmentPeqOptions();
    }
    if (state.activeLens === "shared-workload-preview") {
      rebuildWorkloadPeqOptions();
    }
  }

  function applyDeepLinkFromUrl() {
    const query = new URLSearchParams(window.location.search);
    const deepLink = {};
    for (const key of [
      "product_id",
      "product_group_id",
      "product_subgroup_id",
      "route_family_id",
      "family_route_id",
      "product_route_id",
      "mapping_id",
      "as_of_date",
      "candidate_kind",
      "entity_type",
    ]) {
      const value = query.get(key);
      if (value) deepLink[key] = value;
    }
    state.deepLink = deepLink;
    const lens = String(query.get("lens") || "").trim();
    // Families-only deep link may open the summary once. Editor deep links that
    // also carry route_family_id must not auto-open the Family summary.
    if (
      (lens === "route-families" || (!lens && !deepLink.family_route_id)) &&
      deepLink.route_family_id &&
      !deepLink.family_route_id &&
      !deepLink.product_route_id
    ) {
      pendingOpenRouteFamilyId = deepLink.route_family_id;
    }
    return deepLink;
  }

  function destroy() {
    disposed = true;
    if (prmOwnsDetailsModal) {
      closeModal({ restorePrevious: false });
    } else {
      unbindModalHandlers();
    }
    unbind();
    if (prmPopstateBound && typeof window !== "undefined") {
      window.removeEventListener("popstate", onPrmPopState);
      prmPopstateBound = false;
    }
  }

  function onLensExit() {
    unbind();
    hideSpecialHosts();
    state.productRouteCreateHandoff = null;
    state.productRouteReentryChooser = null;
    // Do not leave a PRM-owned modal open across lens switches.
    if (prmOwnsDetailsModal) {
      closeModal({ restorePrevious: false });
    }
  }

  return {
    load,
    reloadCurrentLens,
    render,
    paintAcceptedPrmLens,
    getPaintGeneration: () => lensRenderGeneration,
    syncPageFromShell,
    getPage: () => state.page,
    getTotalCount: () =>
      state.activeLens === "product-route-assignments"
        ? state.assignmentTotalCount
        : state.activeLens === "product-subgroup-mappings"
          ? state.subgroupMappingTotalCount
          : state.activeLens === "archived-routes"
            ? state.archivedRouteTotalCount
        : state.activeLens === "shared-workload-preview"
          ? state.workloadTotalCount
          : state.activeLens === "route-family-foundation-review"
            ? state.foundationTotalCount
            : state.activeLens === "production-cost-centres"
              ? costCentres?.getTotalCount?.() || 0
              : state.activeLens === "route-families"
                ? (state.routeFamilies || []).length
              : state.total_count,
    getReadinessStatus: () => state.readiness_status,
    getAssignmentStatus: () => state.assignment_status,
    getSubgroupMappingStatus: () => state.subgroup_mapping_status,
    getProductSubgroupFilter: () => state.product_subgroup_id,
    getArchivedEntityType: () => state.archived_entity_type,
    getFoundationStatus: () => state.foundation_status,
    getQuantityDriverStatus: () => state.quantity_driver_status,
    getDlScopeFilter: () => state.dl_scope_filter,
    getPohScopeFilter: () => state.poh_scope_filter,
    setReadinessStatus,
    setAssignmentStatus,
    setSubgroupMappingStatus,
    setProductSubgroupFilter,
    setArchivedEntityType,
    setFoundationStatus,
    setQuantityDriverStatus,
    setDlScopeFilter,
    setPohScopeFilter,
    setProductGroupFilter,
    setRouteFamilyFilter,
    clearAssignmentFilters,
    clearReadinessFilters,
    clearSubgroupFilters,
    clearArchivedFilters,
    clearWorkloadFilters,
    clearCostCentreFilters,
    getProductGroupFilter: () => state.product_group_id,
    getRouteFamilyFilter: () => state.route_family_id,
    getCostCentreStatusFilter: () =>
      costCentres?.getState?.()?.statusFilter || "",
    getCostCentrePoolFilter: () => costCentres?.getState?.()?.poolFilter || "",
    getProductGroups: () => state.productGroups,
    getProductSubgroups: () => state.productSubgroups,
    getRouteFamilies: () => state.routeFamilies,
    rebuildReadinessPeqOptions,
    rebuildAssignmentPeqOptions,
    rebuildSubgroupPeqOptions,
    rebuildWorkloadPeqOptions,
    rebuildCostCentrePeqOptions,
    syncPrmFilterDrawerSections,
    applyDeepLinkFromUrl,
    getAsOfDate,
    loadMasterOptions,
    ensureMasterOptions,
    editor,
    candidates,
    onLensLoadStart() {
      state.optionsStatus = "uninitialized";
    },
    onLensExit,
    handleEscapeKey,
    closeModal,
    destroy,
    getState: () => state,
    buildExactRunReadinessRpcArgs,
    buildReadinessRpcArgs,
    PRODUCTION_ROUTE_RPC_NAMES,
  };
}
