/**
 * Pure Production Route Manager helpers.
 * Manufacturing Route Family architecture. No DOM, RPC, or costing queries.
 */

import { buildPrmPreferredBatchSizeHandoffAction } from "./supply-batch-size-references.js";

export { buildPrmPreferredBatchSizeHandoffAction };

export const PRODUCTION_ROUTE_MODULE_KEY = "production-route-manager";
export const PRODUCTION_ROUTE_SUITE_ID = "production-route";
export const PRODUCTION_ROUTE_PERMISSION_TARGET =
  "module:production-route-manager";

export const PRODUCTION_ROUTE_LENS_IDS = Object.freeze([
  "route-readiness",
  "product-route-assignments",
  "product-subgroup-mappings",
  "shared-workload-preview",
  "route-families",
  "route-family-mapping-review",
  "route-family-foundation-review",
  "production-cost-centres",
  "route-family-route-editor",
  "product-route-editor",
  "historical-candidate-review",
  "effective-route-viewer",
  "archived-routes",
]);

export const PRODUCTION_ROUTE_DEFAULT_LENS = "route-readiness";

export const OBSOLETE_PRM_LENS_IDS = Object.freeze([
  "product-group-routes",
  "product-group-route-editor",
]);

/** Exact guarded public RPC inventory (61). */
export const PRODUCTION_ROUTE_RPC_NAMES = Object.freeze([
  // General as-of-date route-maintenance readiness (not Costing exact-run queue).
  "rpc_get_production_route_manager_readiness",
  // Costing Readiness Queue — exact-run (period / valuation / refresh_run).
  "rpc_get_production_route_manager_exact_run_readiness",
  // Product-scoped assignment history (Gate 11Y.4C.1).
  "rpc_get_production_route_manager_product_assignments",
  // Shared DL/POH Workload Preview (Gate 11Y.4D.1) — paginated list + product detail.
  "rpc_get_production_route_manager_workload_preview",
  "rpc_get_production_route_manager_workload_detail",
  // Gate 11Y.10I.2C.2B.2 — frozen exact-run Workload Management Explain (read-only).
  "rpc_get_route_workload_management_explain",
  "rpc_get_production_route_master_options",
  "rpc_get_route_family_route_history",
  "rpc_get_route_family_route_detail",
  "rpc_get_product_route_history",
  "rpc_get_product_route_detail",
  "rpc_get_effective_product_process_route",
  "rpc_preview_route_family_candidate",
  "rpc_preview_product_process_route_candidate",
  "rpc_preview_product_route_delta_candidate",
  "rpc_preview_route_family_route_steps",
  "rpc_get_production_route_pipeline_status",
  "rpc_get_route_family_onboarding_status",
  // Gate 11Y.10I.2A — Mapping Review candidates (exact-run read-only).
  "rpc_get_route_family_mapping_review_candidates",
  // Gate 11Y.10I.2B.3 — Foundation Review (exact-run read-only).
  "rpc_get_route_family_foundation_review",
  // Gate 11Y.10I.2C.1B — Production Cost Centre Manager.
  "rpc_get_production_cost_centres",
  "rpc_get_production_cost_centre_detail",
  "rpc_create_production_cost_centre_draft",
  "rpc_update_production_cost_centre_draft",
  "rpc_validate_production_cost_centre",
  "rpc_approve_production_cost_centre",
  "rpc_inactivate_production_cost_centre",
  "rpc_create_route_family",
  "rpc_create_route_family_onboarding_draft",
  "rpc_approve_route_family",
  "rpc_map_product_group_to_route_family",
  "rpc_approve_route_family_mapping",
  "rpc_update_route_family_mapping_draft",
  // Gate 11Y.10I.2C.3F.1C — Product Subgroup → Route Family mappings.
  "rpc_get_production_route_manager_subgroup_mappings",
  "rpc_map_product_subgroup_to_route_family",
  "rpc_update_product_subgroup_route_family_mapping_draft",
  "rpc_submit_product_subgroup_route_family_mapping_for_review",
  "rpc_approve_product_subgroup_route_family_mapping",
  "rpc_inactivate_product_subgroup_route_family_mapping",
  // Gate 11Y.10I.2C.3F.1C — read-only archived architecture.
  "rpc_get_archived_production_route_architecture",
  "rpc_create_route_family_route_draft",
  "rpc_clone_route_family_route_draft",
  "rpc_upsert_route_family_route_step",
  "rpc_delete_route_family_route_step",
  "rpc_validate_route_family_route",
  "rpc_submit_route_family_route_for_review",
  "rpc_approve_route_family_route",
  "rpc_supersede_route_family_route",
  "rpc_create_product_route_draft",
  "rpc_update_product_route_draft",
  "rpc_upsert_product_route_override",
  "rpc_delete_product_route_override",
  "rpc_validate_product_route",
  "rpc_submit_product_route_for_review",
  "rpc_approve_product_route",
  "rpc_supersede_product_route",
  "rpc_create_product_route_family_assignment_draft",
  "rpc_submit_product_route_family_assignment_for_review",
  "rpc_approve_product_route_family_assignment",
  "rpc_inactivate_product_route_family_assignment",
  "rpc_cancel_product_route_family_assignment",
  "rpc_correct_product_route_family_assignment_effective_from",
]);

/** Full analytical foundation — not the Workload Preview list/detail path. */
export const PRM_WORKLOAD_ANALYTICAL_RPC_NAME =
  "rpc_preview_shared_standard_batch_route_foundation";

export const PRM_WORKLOAD_DL_SCOPE_FILTERS = Object.freeze([
  { value: "HAS_DL", label: "Has DL scope" },
  { value: "NO_DL", label: "No DL scope" },
]);

export const PRM_WORKLOAD_POH_SCOPE_FILTERS = Object.freeze([
  { value: "HAS_POH", label: "Has POH scope" },
  { value: "NO_POH", label: "No POH scope" },
]);

export const PRM_WORKLOAD_BATCH_LABELS = Object.freeze({
  raw: "Raw batch requirement",
  rounded: "Rounded standard batches",
  rawExplain:
    "Raw batch requirement is the fractional/proportional batch-equivalent candidate.",
  roundedExplain:
    "Rounded standard batches is the integer standard-batch count for fixed batch workload.",
  denominatorReview:
    "The Product workload share is determined against the eligible company workload captured for the applicable pool in the exact costing run.",
});

export const PRM_WORKLOAD_POLICY_DISCLAIMER = Object.freeze([
  "Direct Labour Policy ID 1 remains REVIEW_REQUIRED.",
  "Production Overhead Policy ID 1 remains REVIEW_REQUIRED.",
  "This is a nonmonetary preview.",
  "No route-based monetary snapshot is created.",
  "Stage 03 provisional allocation remains unchanged.",
  "Raw versus rounded denominator applicability remains under policy review.",
]);

export const OBSOLETE_PRM_RPC_NAMES = Object.freeze([
  "rpc_get_product_group_route_detail",
  "rpc_get_product_group_route_history",
  "rpc_preview_product_group_route_candidate",
  "rpc_create_product_group_route_draft",
  "rpc_update_product_group_route_draft",
  "rpc_upsert_product_group_route_step",
  "rpc_delete_product_group_route_step",
  "rpc_validate_product_group_route",
  "rpc_submit_product_group_route_for_review",
  "rpc_approve_product_group_route",
  "rpc_supersede_product_group_route",
]);

/**
 * Exact-run defaults for Route Readiness (and other non-workload lenses).
 * Do not fall back to "today". Do not retarget for Workload Preview.
 */
export const PRM_EXACT_RUN_CONTEXT = Object.freeze({
  period_start: "2026-07-01",
  valuation_date: "2026-07-22",
  refresh_run_id: 80,
});

/**
 * Gate 11Y.10I.2C.2B.2 — Workload Preview + Detail + Management Explain.
 * Atomic Run 82 context for all three Workload Preview-owned reads.
 * Do not mix with PRM_EXACT_RUN_CONTEXT (Route Readiness remains Run 80).
 */
export const PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT = Object.freeze({
  period_start: "2026-08-01",
  valuation_date: "2026-08-07",
  refresh_run_id: 82,
});

/**
 * Gate 11Y.10I.2A — Mapping Review only.
 * Do not reuse for Route Readiness (PRM_EXACT_RUN_CONTEXT) or Workload Preview
 * (PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT).
 */
export const PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT = Object.freeze({
  period_start: "2026-08-01",
  valuation_date: "2026-08-07",
  refresh_run_id: 82,
});

/**
 * Gate 11Y.10I.2B.3 — Foundation Review bounded exact-run context (Run 82).
 * Independent of Mapping Review constant for lens-level smoke isolation.
 * Do not reuse for Route Readiness or Workload Preview.
 */
export const PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT = Object.freeze({
  period_start: "2026-08-01",
  valuation_date: "2026-08-07",
  refresh_run_id: 82,
});

/** Display-only reconciliation tolerances (never replace server values). */
export const PRM_WORKLOAD_RECON_FACTOR_TOLERANCE = 1e-9;
export const PRM_WORKLOAD_RECON_MONEY_TOLERANCE = 0.01;

export const PRM_WORKLOAD_EXPLAIN_POH_NEUTRALITY_NOTE =
  "Behaviour and Resource Class are retained for manufacturing traceability under this policy version; their POH multipliers are currently neutral.";

export const PRM_WORKLOAD_EXPLAIN_DL_SUPERVISION_NOTE =
  "A DL SUPERVISION scope is not itself reduced below 1 in the current policy. Reduced labour intensity comes from the associated attendance Behaviour factor.";

export const PRM_WORKLOAD_EXPLAIN_DL_FORMULA = Object.freeze([
  "Step Labour Factor = DL Scope Factor × Attendance Factor × Expected Occurrences × Standard Cycles",
  "Route Labour Intensity = sum of Step Labour Factors",
  "Product DL Workload = Route Labour Intensity × Standard Batch Count",
  "Product Workload Share = Product Workload ÷ Company Eligible DL Workload",
  "Product DL Allocation = Product Workload Share × Frozen DL Pool",
]);

export const PRM_WORKLOAD_EXPLAIN_DL_COMPONENT_FORMULA = Object.freeze([
  "Manufacturing Workload = Rounded Standard Batches × Route Attendance Intensity",
  "Manufacturing Product Allocation = Manufacturing Workload Share × Manufacturing Labour Pool",
  "Packing Labour uses frozen expected package-unit workload against the frozen company package-unit denominator.",
  "Combined Direct Labour = Manufacturing Labour + Packing Labour",
]);

export const PRM_DL_LEGACY_BANNER_TITLE = "Legacy Unified Direct Labour";
export const PRM_DL_LEGACY_BANNER_FALLBACK =
  "This frozen exact run predates the Manufacturing Labour + Packing Labour component model. Direct Labour in this run was allocated as one unified pool using route-attendance workload.";
export const PRM_DL_COMPONENT_OVERALL_STATUS_CUE =
  "Packing Labour may be calculable while Manufacturing Labour remains blocked or under review; combined Direct Labour follows Manufacturing readiness.";
export const PRM_DL_MANUFACTURING_COPY =
  "Manufacturing Labour is allocated using rounded standard batches and the governed route-attendance workload.";

const PRM_DL_DRIVER_LABELS = Object.freeze({
  FROZEN_MONTHLY_ALLOCATION_UNITS: "Frozen Expected Package Units",
  ROUNDED_STANDARD_BATCHES_ROUTE_ATTENDANCE_INTENSITY:
    "Rounded Standard Batches × Route Attendance Intensity",
});

/** Server discriminator only — do not infer from policy, date, or run id. */
export function isPrmDlComponentModelActive(directLabour) {
  return directLabour?.component_model?.component_model_active === true;
}

export function formatPrmDlWorkloadDriverLabel(code) {
  const raw = String(code ?? "").trim();
  if (!raw) return "—";
  const collapsed = normalizePrmCode(raw.replace(/×/g, " ").replace(/[^\w]+/g, "_"));
  if (collapsed && Object.prototype.hasOwnProperty.call(PRM_DL_DRIVER_LABELS, collapsed)) {
    return PRM_DL_DRIVER_LABELS[collapsed];
  }
  if (Object.prototype.hasOwnProperty.call(PRM_DL_DRIVER_LABELS, raw)) {
    return PRM_DL_DRIVER_LABELS[raw];
  }
  return humanizeUnknownPrmCode(raw) || raw;
}

export const PRM_WORKLOAD_EXPLAIN_POH_FORMULA = Object.freeze([
  "Step POH Factor = POH Scope Factor × Behaviour Factor × Resource Factor × Expected Occurrences × Standard Cycles",
  "Route Factor = sum of Step Factors",
  "Product POH Workload = Route Factor × Rounded Standard Batches",
  "Product Workload Share = Product Workload ÷ Company Ready POH Workload",
  "Product POH Allocation = Product Workload Share × Frozen POH Pool",
]);

export const PRM_MAPPING_REVIEW_CANDIDATE_CLASSES = Object.freeze([
  "SAME_GROUP_SINGLE_FAMILY_EVIDENCE",
  "NO_READY_SAME_GROUP_EVIDENCE",
  "AMBIGUOUS_SAME_GROUP_FAMILY_EVIDENCE",
]);

export const PRM_FOUNDATION_REVIEW_GROUP_EVIDENCE_CLASSES = Object.freeze([
  "ALL_PRODUCTS_SUFFICIENT",
  "MIXED_WITH_SUFFICIENT",
  "LIMITED_ONLY",
  "LIMITED_AND_NONE",
  "NO_EVIDENCE_ALL",
]);

export const PRM_FOUNDATION_REVIEW_PRODUCT_EVIDENCE_CLASSES = Object.freeze([
  "HISTORICAL_EVIDENCE_SUFFICIENT",
  "HISTORICAL_EVIDENCE_LIMITED",
  "NO_ELIGIBLE_HISTORICAL_EVIDENCE",
]);

export const PRM_READINESS_STATUSES = Object.freeze([
  "READY",
  "REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER",
  "BLOCKED_NO_VALID_EFFECTIVE_ROUTE",
  "BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE",
  "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING",
  "BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE",
  "BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE",
  "BLOCKED_NO_EFFECTIVE_ROUTE_STEPS",
  "BLOCKED_NO_GOVERNED_MONTHLY_PRODUCT_QUANTITY",
  "BLOCKED_MONTHLY_QUANTITY_DRIVER",
]);

export const PRM_DELTA_OPERATIONS = Object.freeze([
  "ADD_STEP",
  "BYPASS_STEP",
  "REPLACE_STEP",
  "ALTER_LOCATION",
  "ALTER_RESOURCE",
  "ALTER_CYCLE",
  "ALTER_MANDATORY_STATUS",
]);

export const PRM_STEP_SOURCES = Object.freeze([
  "ROUTE_FAMILY",
  "PRODUCT_OVERRIDE",
  "PRODUCT_ADDED_STEP",
]);

export const PRM_PRODUCT_ROUTE_SOURCES = Object.freeze(["ROUTE_FAMILY_ONLY"]);

export const PRM_ROUTE_WRITE_STATUSES = Object.freeze([
  "DRAFT",
  "REVIEW_REQUIRED",
  "IN_REVIEW",
  "SUBMITTED",
  "REVIEW",
]);

/** Canonical review status + legacy aliases (display/gates only). */
export const PRM_ROUTE_REVIEW_STATUSES = Object.freeze([
  "REVIEW_REQUIRED",
  "IN_REVIEW",
  "SUBMITTED",
  "REVIEW",
]);

export const PRM_ROUTE_READONLY_STATUSES = Object.freeze([
  "APPROVED",
  "SUPERSEDED",
  "INACTIVE",
  "CLOSED",
]);

export const PRM_ROUTE_CLONEABLE_STATUSES = Object.freeze([
  "APPROVED",
  "SUPERSEDED",
  "INACTIVE",
]);

export const PRM_ROUTE_STEP_SCOPES = Object.freeze([
  "BOUNDARY_RM_ISSUE",
  "PRODUCTION_PROCESS",
  "INTERMEDIATE_WIP_HOLD",
  "BOUNDARY_FG_TRANSFER",
  "QC_OTHER_POOL",
  "STORES_OTHER_POOL",
  "NON_PRODUCTION",
]);

export const PRM_DIRECT_LABOUR_SCOPES = Object.freeze([
  "INCLUDE",
  "SUPERVISION",
  "EXCLUDE_OTHER_POOL",
]);

export const PRM_PRODUCTION_OVERHEAD_SCOPES = Object.freeze([
  "INCLUDE",
  "PASSIVE",
  "EXCLUDE_OTHER_POOL",
]);

export const PRM_ROUTE_SOURCE_TYPES = Object.freeze([
  "MANUAL",
  "HISTORICAL_CANDIDATE",
  "COPIED_VERSION",
]);

export const PRM_ROUTE_EVIDENCE_STATUSES = Object.freeze([
  "MANUAL_COMPLETE",
  "HISTORICAL_COMPLETE",
  "PARTIAL_EVIDENCE",
  "NO_EVIDENCE",
]);

export const PRM_OTHER_POOL_STEP_SCOPES = Object.freeze([
  "QC_OTHER_POOL",
  "STORES_OTHER_POOL",
  "NON_PRODUCTION",
]);

const READINESS_LABELS = Object.freeze({
  READY: "Ready",
  REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER: "Quantity review required",
  BLOCKED_NO_VALID_EFFECTIVE_ROUTE: "No valid effective route",
  BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE: "Preferred batch size missing",
  BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING: "Route Family mapping missing",
  BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE: "Approved Family Route missing",
  BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE: "Product route incomplete",
  BLOCKED_NO_EFFECTIVE_ROUTE_STEPS: "Effective route has no usable steps",
  BLOCKED_NO_GOVERNED_MONTHLY_PRODUCT_QUANTITY: "Governed monthly quantity missing",
  BLOCKED_MONTHLY_QUANTITY_DRIVER: "Monthly quantity driver blocked",
  // Legacy / fallback codes that may still appear from older rows
  BLOCKED_NO_APPROVED_PRODUCT_PROCESS_ROUTE: "Product route not approved",
});

const VALIDATION_LABELS = Object.freeze({
  NO_ROUTE_STEPS: "No route steps",
  REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY:
    "Requires exactly one RM issue boundary",
  REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY:
    "Requires exactly one FG transfer boundary",
  REQUIRES_PRODUCTION_PROCESS_STEP: "Requires a production process step",
  INVALID_STEP_LOCATION_OR_PLANT: "Invalid step location or Plant",
  STEP_LOCATION_HIERARCHY_MISMATCH:
    "Step Section / Subsection / Area / Plant hierarchy is inconsistent",
  ACTIVITY_LOCATION_MISMATCH:
    "Activity location does not match the step location hierarchy",
  BATCH_REFERENCE_PRODUCT_MISMATCH: "Batch reference Product mismatch",
  INCOMPLETE_ROUTE_EVIDENCE: "Incomplete route evidence",
  DUPLICATE_EFFECTIVE_SEQUENCE: "Duplicate effective sequence",
  INVALID_COST_CENTRE: "Invalid or ineffective Cost Centre",
  INEFFECTIVE_COST_CENTRE: "Cost Centre is not approved/effective",
  INACTIVE_BEHAVIOUR: "Behaviour is inactive",
  INACTIVE_RESOURCE_CLASS: "Resource class is inactive",
  OTHER_POOL_SCOPE_REQUIRES_EXCLUSION:
    "Other-pool step scope requires DL and POH exclusion",
  EXCLUDED_COST_CENTRE_REQUIRES_EXCLUSION:
    "Excluded Cost Centre requires DL and POH exclusion",
});

const DELTA_LABELS = Object.freeze({
  ADD_STEP: "Add step",
  BYPASS_STEP: "Bypass step",
  REPLACE_STEP: "Replace step",
  ALTER_LOCATION: "Alter location",
  ALTER_RESOURCE: "Alter resource",
  ALTER_CYCLE: "Alter cycle",
  ALTER_MANDATORY_STATUS: "Alter mandatory status",
});

const SOURCE_LABELS = Object.freeze({
  ROUTE_FAMILY: "Manufacturing Route Family",
  ROUTE_FAMILY_INHERITED: "Inherited Family step",
  PRODUCT_OVERRIDE: "Product override",
  PRODUCT_ADDED_STEP: "Product-added step",
  ROUTE_FAMILY_ONLY: "Route Family only",
  MANUAL: "Manual",
  HISTORICAL_CANDIDATE: "Historical candidate",
  COPIED_VERSION: "Copied version",
});

const EVIDENCE_STATUS_LABELS = Object.freeze({
  MANUAL_COMPLETE: "Manual complete",
  HISTORICAL_COMPLETE: "Historical complete",
  PARTIAL_EVIDENCE: "Partial evidence",
  NO_EVIDENCE: "No evidence",
});

const STEP_LABELS = Object.freeze({
  RM_ISSUE_BOUNDARY: "Raw Material Issue",
  RM_DISINTEGRATION: "Raw Material Disintegration",
  PRE_EXTRACTION_WIP: "Pre-extraction WIP Holding",
  PRESSURIZED_EXTRACTION: "Pressurized Extraction",
  OPEN_VESSEL_BOILING: "Open-vessel Boiling",
  QC_ASSESSMENT_BOUNDARY: "Quality Assessment",
  LIQUID_FILL_PACK: "Liquid Filling and Packing",
  FG_TRANSFER_BOUNDARY: "Finished Goods Transfer",
});

const ROUTE_STATUS_LABELS = Object.freeze({
  DRAFT: "Draft",
  REVIEW_REQUIRED: "Review required",
  IN_REVIEW: "In review",
  SUBMITTED: "Submitted",
  REVIEW: "In review",
  APPROVED: "Approved",
  SUPERSEDED: "Superseded",
  INACTIVE: "Inactive",
  CLOSED: "Closed",
});

const ROUTE_STEP_SCOPE_LABELS = Object.freeze({
  BOUNDARY_RM_ISSUE: "RM issue boundary",
  PRODUCTION_PROCESS: "Production process",
  INTERMEDIATE_WIP_HOLD: "Intermediate WIP hold",
  BOUNDARY_FG_TRANSFER: "FG transfer boundary",
  QC_OTHER_POOL: "QC — separately costed pool",
  STORES_OTHER_POOL: "Stores — separately costed pool",
  NON_PRODUCTION: "Non-production / separately governed",
});

const DIRECT_LABOUR_SCOPE_LABELS = Object.freeze({
  INCLUDE: "Include in Direct Labour",
  SUPERVISION: "Supervision only",
  EXCLUDE_OTHER_POOL: "Excluded — cost owned by another pool",
});

const PRODUCTION_OVERHEAD_SCOPE_LABELS = Object.freeze({
  INCLUDE: "Include in Production Overhead",
  PASSIVE: "Passive / occupancy burden",
  EXCLUDE_OTHER_POOL: "Excluded — cost owned by another pool",
});

export const PRM_ACTION_LABELS = Object.freeze({
  effective: "View effective route",
  "product-candidate": "Preview route candidate evidence",
  "product-delta": "Review Product differences",
  "product-history": "View Product route history",
  "open-product-draft": "Open Product route",
  "open-product": "Open Product route",
  "create-product": "Create Product route",
  "create-product-draft": "Create DRAFT",
  "open-route-family": "Open mapped Route Family",
  "open-family-route": "Open Route Family route",
  "family-candidate": "Review Route Family evidence",
  "family-history": "View route history",
  "create-family-route": "Create Family Route Draft",
  "create-family-version": "Create new route version",
  "open-approved-family-route": "Open current approved route",
  "approve-route-family": "Approve Route Family",
  "approve-family": "Approve Route Family",
  "map-product-group": "Map Product Group",
  "approve-mapping": "Approve mapping",
  "edit-pending-mapping": "Edit pending mapping",
  "create-route-family": "Create Manufacturing Route Family",
  "review-pre-mapping-evidence": "Review pre-mapping evidence",
  "assign-route-family": "Map Product Group via Families",
  "create-assignment-draft": "Create Route Family assignment draft",
  "submit-assignment": "Submit for review",
  "approve-assignment": "Approve assignment",
  "cancel-assignment": "Cancel assignment",
  "inactivate-assignment": "Inactivate assignment",
  "correct-assignment-effective-from": "Correct effective date",
  "use-candidate-in-draft": "Use this candidate in draft form",
  "preferred-batch-size": "Open in Supply Batch Plan",
});

export const PRM_EMPTY_STATES = Object.freeze({
  routeFamilies:
    "No Manufacturing Route Families have been created.\n\nStart by reviewing historical evidence or create a Route Family manually.",
  familyEditor:
    "Select an existing Family Route or create a new Draft.",
  familyEditorSupporting:
    "Choose a governed Route Family, open an existing route, or create a new Draft.",
  productEditor:
    "No Product Route selected.\n\nOpen a Product from Route Readiness / Product Summary to create or edit a Product-specific route.",
  effectiveViewer:
    "Search or select a Product to view its effective manufacturing route.",
  subgroupMappings:
    "No Product Subgroup mappings yet.\n\nCreate a Draft to map a Product Subgroup to a Manufacturing Route Family.",
  archivedRoutes: "No archived route architecture.",
  noGroups: "No Product Groups are available from master options.",
  noReadiness: "No readiness rows for the current filters.",
});

export const PRM_ARCHIVED_ENTITY_TYPES = Object.freeze([
  "",
  "ROUTE_FAMILY",
  "FAMILY_ROUTE",
  "PRODUCT_GROUP_MAPPING",
  "PRODUCT_SUBGROUP_MAPPING",
  "PRODUCT_MAPPING",
  "PRODUCT_ROUTE",
]);

export const PRM_ARCHIVED_ENTITY_TYPE_LABELS = Object.freeze({
  ROUTE_FAMILY: "Route Family",
  FAMILY_ROUTE: "Family Route",
  PRODUCT_GROUP_MAPPING: "Product Group Mapping",
  PRODUCT_SUBGROUP_MAPPING: "Product Subgroup Mapping",
  PRODUCT_MAPPING: "Product Mapping",
  PRODUCT_ROUTE: "Product Route",
});

export const PRM_FAMILY_WORKFLOW_STEPS = Object.freeze([
  { id: "family_created", label: "Family created" },
  { id: "family_approved", label: "Family approved" },
  { id: "groups_mapped", label: "Assignments defined" },
  { id: "mappings_approved", label: "Assignments approved" },
  { id: "family_route_defined", label: "Family route defined" },
  { id: "product_routes_defined", label: "Product routes defined" },
]);

export const PRM_COST_CENTRE_SETUP_CHIP = "Cost centres: Setup required";
export const PRM_COST_CENTRE_LOADING_CHIP = "Cost centres: Loading…";
export const PRM_COST_CENTRE_UNAVAILABLE_CHIP = "Cost centres: Unavailable";
export const PRM_COST_CENTRE_SETUP_TOOLTIP =
  "No approved Production cost centres are currently defined. Route Families, Product Group mappings and route-header drafts can still be prepared. Cost centres are required before governed route steps can be completed and approved.";
export const PRM_COST_CENTRE_LOADING_TOOLTIP =
  "Production cost centre catalogues are loading from master options.";
export const PRM_COST_CENTRE_UNAVAILABLE_TOOLTIP =
  "Production cost centre catalogues could not be loaded. Retry or open Cost Centres after master options are available.";
/** @deprecated Prefer PRM_COST_CENTRE_SETUP_TOOLTIP; retained for older callers. */
export const PRM_COST_CENTRE_SETUP_DETAIL = PRM_COST_CENTRE_SETUP_TOOLTIP;
export const PRM_COST_CENTRE_CAN_PROCEED =
  "Route Families, Product Group mappings, and route-header drafts can still be prepared.";
export const PRM_COST_CENTRE_REMAINS_BLOCKED =
  "Governed route steps cannot be completed or approved until Production cost centres are defined and approved.";
export const PRM_COST_CENTRE_POSITIVE_EXPLAIN =
  "Shared-route centres may contribute to Production Overhead and Direct Labour according to the approved route policy. Excluded boundary centres remain visible for route governance but are allocated through another pool or excluded from these drivers.";
export const PRM_COST_CENTRE_POOL_SHARED = "SHARED_ROUTE";
export const PRM_COST_CENTRE_POOL_EXCLUDED = "EXCLUDED_OTHER_POOL";

export const PRM_COST_CENTRE_ACTION_DISABLED_REASON =
  "Requires an approved Production cost centre before this action can complete.";

/** Actions that require approved cost centres (not family/mapping/header drafts). */
export const PRM_COST_CENTRE_REQUIRED_ACTIONS = Object.freeze([
  "approve-family-route",
  "approve-product",
  "upsert-family-step",
  "upsert-product-override",
  "add-family-step",
  "add-product-delta",
]);

export const PRM_MAPPING_BASIS_VALUES = Object.freeze([
  "MANUAL",
  "HISTORICAL_REVIEW",
  "MIGRATED",
]);

export const PRM_ASSIGNMENT_STATUSES = Object.freeze([
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "INACTIVE",
  "CANCELLED",
  "SUPERSEDED",
]);

export const PRM_ASSIGNMENT_LIFECYCLE_ACTIONS = Object.freeze([
  "CREATE_DRAFT",
  "CREATE_ASSIGNMENT_DRAFT",
  "SUBMIT_FOR_REVIEW",
  "APPROVE",
  "CANCEL",
  "INACTIVATE",
]);

const ASSIGNMENT_STATUS_LABELS = Object.freeze({
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  INACTIVE: "Inactive",
  CANCELLED: "Cancelled",
  SUPERSEDED: "Superseded",
});

export function formatPrmAssignmentStatusLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (!upper) return "—";
  return ASSIGNMENT_STATUS_LABELS[upper] || humanizeUnknownPrmCode(upper) || upper;
}

export function buildPrmAssignmentBasisOptionsHtml(selectedValue = "MANUAL") {
  const selected = normalizePrmMappingBasis(selectedValue) || "MANUAL";
  const allowed = PRM_ASSIGNMENT_BASIS_OPTIONS.some((o) => o.value === selected)
    ? selected
    : "MANUAL";
  return PRM_ASSIGNMENT_BASIS_OPTIONS.map(
    (opt) =>
      `<option value="${opt.value}"${opt.value === allowed ? " selected" : ""}>${opt.label}</option>`,
  ).join("");
}

export function isMeaningfulPrmCancellationReason(value) {
  return isMeaningfulPrmApprovalReference(value);
}

export function normalizePrmAssignmentLifecycleActions(raw) {
  const list = Array.isArray(raw) ? raw : coercePrmList(raw);
  const out = [];
  for (const item of list) {
    if (item == null) continue;
    const code =
      typeof item === "string"
        ? normalizePrmCode(item).toUpperCase()
        : normalizePrmCode(
            item.action || item.code || item.lifecycle_action,
          ).toUpperCase();
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

export function assignmentLifecycleIncludes(actions, code) {
  const target = normalizePrmCode(code).toUpperCase();
  if (!target) return false;
  const list = normalizePrmAssignmentLifecycleActions(actions);
  return list.includes(target);
}

/** Server lifecycle_actions are authoritative; edit permission gates mutations. */
export function resolvePrmAssignmentUiActions(
  assignment = {},
  { productLifecycleActions = [], canEdit = false } = {},
) {
  const rowActions = normalizePrmAssignmentLifecycleActions(
    assignment.lifecycle_actions,
  );
  const rootActions = normalizePrmAssignmentLifecycleActions(
    productLifecycleActions,
  );
  const merged = [...new Set([...rowActions, ...rootActions])];
  if (!canEdit) return [];
  return merged.filter((code) =>
    [
      "CREATE_DRAFT",
      "CREATE_ASSIGNMENT_DRAFT",
      "SUBMIT_FOR_REVIEW",
      "APPROVE",
      "CANCEL",
      "INACTIVATE",
    ].includes(code),
  );
}

export function buildPrmProductAssignmentsArgs({
  status = null,
  search = null,
  route_family_id = null,
  product_group_id = null,
  product_id = null,
  limit = 50,
  offset = 0,
} = {}) {
  // p_product_id is optional: omit for company-wide Product Assignments lens;
  // Product detail history continues to pass a concrete Product ID.
  const params = {
    p_limit: Math.max(1, Math.min(Number(limit) || 50, 200)),
    p_offset: Math.max(0, Number(offset) || 0),
  };
  const pid = normalizePrmIntegerId(product_id);
  if (pid != null) params.p_product_id = pid;
  const q = isBlankPrmValue(search) ? "" : String(search).trim();
  if (q) params.p_search = q;
  const st = isBlankPrmValue(status) ? "" : String(status).trim();
  if (st) params.p_status = st;
  const familyId = normalizePrmIntegerId(route_family_id);
  if (familyId != null) params.p_route_family_id = familyId;
  const groupId = normalizePrmIntegerId(product_group_id);
  if (groupId != null) params.p_product_group_id = groupId;
  return { ok: true, params, errors: [] };
}

export function normalizePrmProductAssignmentRow(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const assignmentId =
    normalizePrmIntegerId(r.assignment_id) ??
    normalizePrmIntegerId(r.product_route_family_assignment_id) ??
    normalizePrmIntegerId(r.id);
  const overlapRaw =
    r.overlap_warning ?? r.overlap_evidence ?? r.overlap_conflict ?? null;
  return {
    ...r,
    assignment_id: assignmentId,
    status: normalizePrmCode(
      r.status || r.assignment_status,
    ).toUpperCase() || null,
    product_id: normalizePrmIntegerId(r.product_id),
    product_name:
      r.product_name || r.product || r.item || r.product_label || null,
    product_group_id: normalizePrmIntegerId(
      r.product_group_id ?? r.group_id,
    ),
    product_group_name:
      r.product_group_name || r.group_name || r.product_group || null,
    route_family_id: normalizePrmIntegerId(r.route_family_id),
    route_family_name:
      r.route_family_name || r.route_family_code || null,
    route_family_code: r.route_family_code ?? null,
    assignment_basis: r.assignment_basis ?? null,
    assignment_note: r.assignment_note ?? null,
    effective_from: r.effective_from ?? null,
    effective_to: r.effective_to ?? null,
    approval_reference: r.approval_reference ?? null,
    approved_at: r.approved_at ?? r.approved_on ?? null,
    cancellation_reason:
      r.cancellation_reason ?? r.cancel_reason ?? null,
    cancelled_at: r.cancelled_at ?? r.cancelled_on ?? null,
    updated_at: r.updated_at ?? r.updated_on ?? r.modified_at ?? null,
    overlap_warning: overlapRaw,
    has_overlap: hasPrmAssignmentOverlap(overlapRaw),
    definition_read_only:
      r.definition_read_only === true || r.read_only === true,
    lifecycle_actions: normalizePrmAssignmentLifecycleActions(
      r.lifecycle_actions,
    ),
    effective_route_validation: r.effective_route_validation ?? null,
    cancellation_evidence: r.cancellation_evidence ?? null,
  };
}

/** Compact overlap indicator — never stringify evidence objects. */
export function hasPrmAssignmentOverlap(value) {
  if (value == null || value === false || value === "") return false;
  if (value === true) return true;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    return trimmed !== "" && trimmed !== "false" && trimmed !== "0" && trimmed !== "none";
  }
  if (typeof value === "object") {
    if (value.has_overlap === true || value.overlap === true) return true;
    if (Array.isArray(value)) return value.length > 0;
    return Object.keys(value).length > 0;
  }
  return false;
}

export function formatPrmAssignmentReferenceSummary(row = {}) {
  const status = normalizePrmCode(row.status || row.assignment_status).toUpperCase();
  const approval = isBlankPrmValue(row.approval_reference)
    ? ""
    : String(row.approval_reference).trim();
  if (approval) return approval;
  if (status === "CANCELLED") {
    const reason = isBlankPrmValue(row.cancellation_reason)
      ? ""
      : String(row.cancellation_reason).trim();
    if (!reason) return null;
    return reason.length > 48 ? `${reason.slice(0, 45)}…` : reason;
  }
  return null;
}

export function formatPrmAssignmentProductLabel(row = {}) {
  if (!isBlankPrmValue(row.product_name)) return String(row.product_name);
  const id = normalizePrmIntegerId(row.product_id);
  return id == null ? null : `Product ${id}`;
}

export function formatPrmAssignmentGroupLabel(row = {}) {
  if (!isBlankPrmValue(row.product_group_name)) {
    return String(row.product_group_name);
  }
  const id = normalizePrmIntegerId(row.product_group_id);
  return id == null ? null : `Group ${id}`;
}

export function formatPrmAssignmentFamilyLabel(row = {}) {
  if (!isBlankPrmValue(row.route_family_name)) return String(row.route_family_name);
  if (!isBlankPrmValue(row.route_family_code)) return String(row.route_family_code);
  const id = normalizePrmIntegerId(row.route_family_id);
  return id == null ? null : `Family ${id}`;
}

/**
 * Statuses with count > 0 for primary Product Assignments filter chips.
 * Zero-count statuses remain available via the More statuses select.
 */
export function selectPrmPrimaryAssignmentFilterStatuses(statusCounts = {}) {
  const counts =
    statusCounts && typeof statusCounts === "object" ? statusCounts : {};
  const knownOrder = PRM_ASSIGNMENT_STATUSES.filter(
    (code) => Number(counts[code]) > 0,
  );
  const extras = Object.keys(counts)
    .filter(
      (code) =>
        Number(counts[code]) > 0 && !PRM_ASSIGNMENT_STATUSES.includes(code),
    )
    .sort();
  return [...knownOrder, ...extras];
}

/** Product-shaped handoff from an assignment register row. */
export function buildPrmAssignmentProductHandoff(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  return {
    product_id: normalizePrmIntegerId(r.product_id),
    product_name: r.product_name || null,
    product_group_id: normalizePrmIntegerId(r.product_group_id),
    product_group_name: r.product_group_name || null,
    route_family_id: normalizePrmIntegerId(r.route_family_id),
    route_family_name: r.route_family_name || null,
    route_family_code: r.route_family_code || null,
    category_name: r.category_name || null,
    division_name: r.division_name || null,
    segment_name: r.segment_name || null,
    assignment_source: r.assignment_basis || r.assignment_source || null,
    assignment_basis: r.assignment_basis || null,
  };
}

/** Product-shaped handoff from a Workload Preview row. */
export function buildPrmWorkloadProductHandoff(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  return {
    product_id: normalizePrmIntegerId(r.product_id),
    product_name: r.product_name || null,
    product_group_id: normalizePrmIntegerId(r.product_group_id),
    product_group_name: r.product_group_name || null,
    route_family_id: normalizePrmIntegerId(r.route_family_id),
    route_family_name: r.route_family_name || null,
    route_family_code: r.route_family_code || null,
    category_name: r.category_name || null,
    division_name: r.division_name || null,
    segment_name: r.segment_name || null,
    foundation_status: r.foundation_status || null,
    product_base_uom: r.product_base_uom || r.base_uom || null,
    monthly_product_base_qty:
      r.monthly_product_base_qty ?? r.monthly_product_quantity ?? null,
    monthly_product_quantity:
      r.monthly_product_base_qty ?? r.monthly_product_quantity ?? null,
    monthly_driver_status: r.monthly_driver_status || r.quantity_driver_status || null,
    preferred_batch_size: r.preferred_batch_size ?? null,
    raw_batch_requirement: r.raw_batch_requirement ?? null,
    standard_batch_count: r.standard_batch_count ?? null,
    route_source: r.route_source || r.effective_route_source || null,
    effective_step_count: r.effective_step_count ?? null,
  };
}

export function formatPrmFoundationStatusLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (!upper) return "—";
  return formatPrmReadinessLabel(upper) || humanizeUnknownPrmCode(upper) || upper;
}

export function formatPrmDlScopeSummary(row = {}, { compact = false } = {}) {
  const include = normalizePrmNullableNumber(
    row.direct_labour_include_step_count,
    row.dl_include_count,
    row.dl_included_count,
  );
  const supervision = normalizePrmNullableNumber(
    row.direct_labour_supervision_step_count,
    row.dl_supervision_count,
  );
  const excluded = normalizePrmNullableNumber(
    row.direct_labour_excluded_step_count,
    row.dl_excluded_count,
    row.dl_exclude_count,
  );
  const fmt = (n) => (n == null ? "—" : String(n));
  if (compact) {
    return `I ${fmt(include)} · S ${fmt(supervision)} · X ${fmt(excluded)}`;
  }
  return `${fmt(include)} Include · ${fmt(supervision)} Supervision · ${fmt(excluded)} Excluded`;
}

export function formatPrmPohScopeSummary(row = {}, { compact = false } = {}) {
  const include = normalizePrmNullableNumber(
    row.production_overhead_include_step_count,
    row.poh_include_count,
    row.poh_included_count,
  );
  const passive = normalizePrmNullableNumber(
    row.production_overhead_passive_step_count,
    row.poh_passive_count,
  );
  const excluded = normalizePrmNullableNumber(
    row.production_overhead_excluded_step_count,
    row.poh_excluded_count,
    row.poh_exclude_count,
  );
  const fmt = (n) => (n == null ? "—" : String(n));
  if (compact) {
    return `I ${fmt(include)} · P ${fmt(passive)} · X ${fmt(excluded)}`;
  }
  return `${fmt(include)} Include · ${fmt(passive)} Passive · ${fmt(excluded)} Excluded`;
}

export const PRM_WORKLOAD_DL_SCOPE_TITLE =
  "Route Direct Labour scopes (Include · Supervision · Excluded). Packing Labour is allocated separately under the component model.";
export const PRM_WORKLOAD_POH_SCOPE_TITLE =
  "Production Overhead steps: Include · Passive · Excluded";

export function formatPrmWorkloadPreferredBatch(row = {}) {
  const preferred = normalizePrmNullableNumber(row.preferred_batch_size);
  if (preferred == null) return "—";
  const uom = row.product_base_uom || row.base_uom || "";
  return uom ? `${preferred} ${uom}` : String(preferred);
}

export function formatPrmWorkloadRoundedBatches(row = {}) {
  const rounded = normalizePrmNullableNumber(
    row.standard_batch_count,
    row.rounded_standard_batch_count,
  );
  return rounded == null ? "—" : String(rounded);
}

export function formatPrmWorkloadMonthlyQuantity(row = {}) {
  const qty = normalizePrmNullableNumber(
    row.monthly_product_base_qty,
    row.monthly_product_quantity,
    row.monthly_quantity,
  );
  if (qty == null) return "—";
  const uom = row.product_base_uom || row.base_uom || "";
  return uom ? `${qty} ${uom}` : String(qty);
}

/** Compact table display for raw batch requirement (full precision stays in modal). */
export function formatPrmWorkloadRawDisplay(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (Object.is(n, -0) || n === 0) return "0";
  const fixed = n.toFixed(4);
  const trimmed = fixed.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
  return trimmed;
}

export function formatPrmWorkloadProductInline(row = {}) {
  const name = row.product_name || "—";
  const id = normalizePrmIntegerId(row.product_id);
  if (id == null) return String(name);
  return `${name}  #${id}`;
}

/**
 * Compact one-line Batch Basis for the Workload Preview register.
 * Modal continues to show full labels and full raw precision separately.
 */
export function formatPrmWorkloadBatchBasis(row = {}) {
  const uom = row.product_base_uom || row.base_uom || "";
  const preferred = normalizePrmNullableNumber(row.preferred_batch_size);
  const raw = normalizePrmNullableNumber(row.raw_batch_requirement);
  const rounded = normalizePrmNullableNumber(
    row.standard_batch_count,
    row.rounded_standard_batch_count,
  );
  const preferredText =
    preferred == null
      ? "—"
      : uom
        ? `${preferred}\u00A0${uom}`
        : String(preferred);
  const rawText = formatPrmWorkloadRawDisplay(raw);
  const roundedText = rounded == null ? "—" : String(rounded);
  return `Pref\u00A0${preferredText} · Raw\u00A0${rawText} · Rnd\u00A0${roundedText}`;
}

export function formatPrmWorkloadBatchBasisTitle(row = {}) {
  const preferred = normalizePrmNullableNumber(row.preferred_batch_size);
  const raw = normalizePrmNullableNumber(row.raw_batch_requirement);
  const rounded = normalizePrmNullableNumber(
    row.standard_batch_count,
    row.rounded_standard_batch_count,
  );
  const uom = row.product_base_uom || row.base_uom || "";
  const preferredText =
    preferred == null ? "—" : uom ? `${preferred} ${uom}` : String(preferred);
  const rawText = raw == null ? "—" : String(raw);
  const roundedText = rounded == null ? "—" : String(rounded);
  return `Preferred: ${preferredText}; Raw batch requirement: ${rawText}; Rounded standard batches: ${roundedText}`;
}

export function formatPrmWorkloadBatchBasisHtml(row = {}) {
  const label = formatPrmWorkloadBatchBasis(row);
  const title = formatPrmWorkloadBatchBasisTitle(row);
  return `<span class="cp-prm-workload-compact cp-prm-workload-batch" title="${escapeHtmlAttr(
    title,
  )}">${escapeHtmlText(label)}</span>`;
}

function escapeHtmlText(value) {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttr(value) {
  return escapeHtmlText(value).replace(/'/g, "&#39;");
}

function escapeHtmlMultiline(value) {
  return String(value ?? "—")
    .split("\n")
    .map((line) => escapeHtmlText(line))
    .join("<br>");
}

export function selectPrmPrimaryWorkloadFilterStatuses(statusCounts = {}) {
  const counts =
    statusCounts && typeof statusCounts === "object" ? statusCounts : {};
  const knownOrder = PRM_READINESS_STATUSES.filter(
    (code) => Number(counts[code]) > 0,
  );
  const extras = Object.keys(counts)
    .filter(
      (code) =>
        Number(counts[code]) > 0 && !PRM_READINESS_STATUSES.includes(code),
    )
    .sort();
  return [...knownOrder, ...extras];
}

/** Valid statuses for More dropdowns: exclude those already shown as primary chips. */
export function selectPrmSecondaryWorkloadFilterStatuses(
  statusCounts = {},
  knownStatuses = PRM_READINESS_STATUSES,
) {
  const counts =
    statusCounts && typeof statusCounts === "object" ? statusCounts : {};
  const primary = new Set(selectPrmPrimaryWorkloadFilterStatuses(counts));
  const known = Array.isArray(knownStatuses) ? knownStatuses : [];
  const fromKnown = known.filter((code) => !primary.has(code));
  const extras = Object.keys(counts)
    .filter((code) => !primary.has(code) && !known.includes(code))
    .sort();
  return [...fromKnown, ...extras];
}

function normalizePrmNullableNumber(...candidates) {
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickPrmScopeCounts(row = {}, exactKeys = {}, aliases = {}) {
  const nested =
    row[exactKeys.nested] && typeof row[exactKeys.nested] === "object"
      ? row[exactKeys.nested]
      : null;
  const sources = [row, nested].filter(Boolean);
  const read = (exactName, aliasNames = []) => {
    for (const source of sources) {
      if (Object.prototype.hasOwnProperty.call(source, exactName)) {
        return normalizePrmNullableNumber(source[exactName]);
      }
    }
    for (const source of sources) {
      for (const alias of aliasNames) {
        if (Object.prototype.hasOwnProperty.call(source, alias)) {
          return normalizePrmNullableNumber(source[alias]);
        }
      }
    }
    return null;
  };
  return {
    include: read(exactKeys.include, aliases.include || []),
    secondary: read(exactKeys.secondary, aliases.secondary || []),
    excluded: read(exactKeys.excluded, aliases.excluded || []),
  };
}

export function normalizePrmWorkloadPreviewRow(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const dl = pickPrmScopeCounts(
    r,
    {
      nested: "dl_scope_counts",
      include: "direct_labour_include_step_count",
      secondary: "direct_labour_supervision_step_count",
      excluded: "direct_labour_excluded_step_count",
    },
    {
      include: ["dl_include_count", "dl_included_count"],
      secondary: ["dl_supervision_count"],
      excluded: ["dl_excluded_count", "dl_exclude_count"],
    },
  );
  const poh = pickPrmScopeCounts(
    r,
    {
      nested: "poh_scope_counts",
      include: "production_overhead_include_step_count",
      secondary: "production_overhead_passive_step_count",
      excluded: "production_overhead_excluded_step_count",
    },
    {
      include: ["poh_include_count", "poh_included_count"],
      secondary: ["poh_passive_count"],
      excluded: ["poh_excluded_count", "poh_exclude_count"],
    },
  );
  const monthlyQty = normalizePrmNullableNumber(
    r.monthly_product_base_qty,
    r.monthly_product_quantity,
    r.monthly_quantity,
  );
  const preferredBatch = normalizePrmNullableNumber(r.preferred_batch_size);
  const rawBatch = normalizePrmNullableNumber(r.raw_batch_requirement);
  const roundedBatches = normalizePrmNullableNumber(
    r.standard_batch_count,
    r.rounded_standard_batch_count,
  );
  const stepCount = normalizePrmNullableNumber(
    r.effective_step_count,
    r.step_count,
  );
  return {
    ...r,
    product_id: normalizePrmIntegerId(r.product_id),
    product_name: r.product_name || r.product || null,
    product_group_id: normalizePrmIntegerId(r.product_group_id),
    product_group_name:
      r.product_group_name || r.group_name || r.product_group || null,
    product_base_uom: r.product_base_uom || r.base_uom || null,
    monthly_product_base_qty: monthlyQty,
    monthly_product_quantity: monthlyQty,
    monthly_driver_status:
      normalizePrmCode(
        r.monthly_driver_status || r.quantity_driver_status,
      ).toUpperCase() || null,
    quantity_driver_status:
      normalizePrmCode(
        r.monthly_driver_status || r.quantity_driver_status,
      ).toUpperCase() || null,
    preferred_batch_size: preferredBatch,
    raw_batch_requirement: rawBatch,
    standard_batch_count: roundedBatches,
    route_family_id: normalizePrmIntegerId(r.route_family_id),
    route_family_name: r.route_family_name || null,
    route_family_code: r.route_family_code ?? null,
    route_source: r.route_source || r.effective_route_source || null,
    effective_route_source: r.effective_route_source || r.route_source || null,
    effective_step_count: stepCount,
    foundation_status:
      normalizePrmCode(r.foundation_status || r.readiness_status).toUpperCase() ||
      null,
    foundation_note: r.foundation_note ?? r.readiness_note ?? null,
    direct_labour_include_step_count: dl.include,
    direct_labour_supervision_step_count: dl.secondary,
    direct_labour_excluded_step_count: dl.excluded,
    dl_include_count: dl.include,
    dl_supervision_count: dl.secondary,
    dl_excluded_count: dl.excluded,
    production_overhead_include_step_count: poh.include,
    production_overhead_passive_step_count: poh.secondary,
    production_overhead_excluded_step_count: poh.excluded,
    poh_include_count: poh.include,
    poh_passive_count: poh.secondary,
    poh_excluded_count: poh.excluded,
  };
}

export function normalizePrmWorkloadPreviewSummary(raw = {}) {
  const s = raw && typeof raw === "object" ? raw : {};
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    recipient_product_count: num(
      s.recipient_product_count ?? s.total_products ?? s.product_count,
    ),
    ready_count: num(s.ready_count ?? s.READY),
    review_required_count: num(
      s.review_required_count ??
        s.REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER ??
        s.review_count,
    ),
    blocked_count: num(s.blocked_count ?? s.blocked),
    total_standard_batch_count: num(
      s.total_standard_batch_count ??
        s.standard_batch_total ??
        s.total_rounded_standard_batches,
    ),
    raw: s,
  };
}

export function normalizePrmWorkloadPreviewPayload(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const rows = coercePrmList(root.rows || root.items || root.products).map(
    normalizePrmWorkloadPreviewRow,
  );
  const total =
    root.total_count != null ? Number(root.total_count) : rows.length;
  const statusCounts = normalizePrmStatusCounts(
    root.status_counts ??
      root.foundation_status_counts ??
      root.statusCounts,
  );
  const quantityCounts = normalizePrmStatusCounts(
    root.quantity_driver_status_counts ??
      root.quantity_status_counts ??
      root.monthly_driver_status_counts,
  );
  const summary = normalizePrmWorkloadPreviewSummary(
    root.summary || root.aggregates || root,
  );
  if (summary.recipient_product_count == null && Number.isFinite(total)) {
    summary.recipient_product_count = total;
  }
  if (summary.ready_count == null && statusCounts.READY != null) {
    summary.ready_count = statusCounts.READY;
  }
  if (
    summary.review_required_count == null &&
    statusCounts.REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER != null
  ) {
    summary.review_required_count =
      statusCounts.REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER;
  }
  return {
    rows,
    total_count: Number.isFinite(total) ? total : rows.length,
    status_counts: statusCounts,
    quantity_driver_status_counts: quantityCounts,
    summary,
    raw: root,
  };
}

export function normalizePrmWorkloadDetailStep(
  step = {},
  index = 0,
  resourceClassContext = {},
) {
  const s = step && typeof step === "object" ? step : {};
  const resource_class_code = normalizePrmCode(
    s.resource_class_code || s.resource_class || s.resource_class_name,
  );
  const resource_class = resolvePrmResourceClassDisplayLabel(
    resource_class_code,
    {
      catalogue: resourceClassContext.catalogue,
      catalogueIndex: resourceClassContext.catalogueIndex,
      rowLabel:
        s.resource_class_name || s.resource_class_label || s.resource_class,
    },
  );
  return {
    ...s,
    sequence_no: s.sequence_no ?? s.sequence ?? index + 1,
    activity_id: s.activity_id ?? null,
    activity: s.activity || s.activity_name || s.step_key || null,
    cost_centre_id: s.cost_centre_id ?? null,
    cost_centre_name:
      s.cost_centre_name || s.cost_centre || s.cost_centre_code || null,
    behaviour: s.behaviour_name || s.behaviour || s.behaviour_code || null,
    resource_class_code,
    resource_class,
    expected_occurrences:
      s.expected_occurrences ?? s.expected_occurrence_count ?? null,
    standard_cycles: s.standard_cycles ?? s.standard_cycle_count ?? null,
    direct_labour_scope:
      s.direct_labour_scope || s.dl_scope || null,
    production_overhead_scope:
      s.production_overhead_scope || s.poh_scope || null,
    source_type: s.source_type || s.step_source || null,
    lineage: s.lineage || s.override_lineage || s.base_override_lineage || null,
  };
}

export function normalizePrmWorkloadDetailPayload(
  payload,
  resourceClassContext = {},
) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const product =
    root.product && typeof root.product === "object" ? root.product : root;
  const steps = coercePrmList(
    root.steps ||
      root.route_steps ||
      root.effective_steps ||
      root.workload_steps,
  ).map((step, index) =>
    normalizePrmWorkloadDetailStep(step, index, resourceClassContext),
  );
  const skuEvidence = coercePrmList(
    root.sku_quantity_evidence ||
      root.sku_evidence ||
      product.sku_quantity_evidence,
  );
  const row = normalizePrmWorkloadPreviewRow({ ...root, ...product });
  return {
    ...row,
    product_base_uom:
      root.product_base_uom ||
      product.product_base_uom ||
      product.base_uom ||
      row.product_base_uom ||
      null,
    monthly_product_base_qty: normalizePrmNullableNumber(
      root.monthly_product_base_qty,
      product.monthly_product_base_qty,
      row.monthly_product_base_qty,
    ),
    monthly_driver_status:
      normalizePrmCode(
        root.monthly_driver_status ||
          product.monthly_driver_status ||
          row.monthly_driver_status,
      ).toUpperCase() || null,
    recipient_sku_count: normalizePrmNullableNumber(
      root.recipient_sku_count,
      product.recipient_sku_count,
    ),
    actual_sku_count: normalizePrmNullableNumber(
      root.actual_sku_count,
      root.actual_source_sku_count,
      product.actual_sku_count,
      product.actual_source_sku_count,
    ),
    assumption_sku_count: normalizePrmNullableNumber(
      root.assumption_sku_count,
      root.assumption_source_sku_count,
      product.assumption_sku_count,
      product.assumption_source_sku_count,
    ),
    default_sku_count: normalizePrmNullableNumber(
      root.default_sku_count,
      root.default_source_sku_count,
      product.default_sku_count,
      product.default_source_sku_count,
    ),
    sku_quantity_evidence: skuEvidence,
    preferred_batch_size: normalizePrmNullableNumber(
      root.preferred_batch_size,
      product.preferred_batch_size,
      row.preferred_batch_size,
    ),
    minimum_batch_size: normalizePrmNullableNumber(
      root.minimum_batch_size,
      product.minimum_batch_size,
    ),
    maximum_batch_size: normalizePrmNullableNumber(
      root.maximum_batch_size,
      product.maximum_batch_size,
    ),
    batch_size_effective_date:
      root.batch_size_effective_date ??
      product.batch_size_effective_date ??
      null,
    raw_batch_requirement: normalizePrmNullableNumber(
      root.raw_batch_requirement,
      product.raw_batch_requirement,
      row.raw_batch_requirement,
    ),
    standard_batch_count: normalizePrmNullableNumber(
      root.standard_batch_count,
      product.standard_batch_count,
      row.standard_batch_count,
    ),
    family_route_id: normalizePrmIntegerId(
      root.family_route_id ??
        product.family_route_id ??
        root.route_family_route_id,
    ),
    product_route_id: normalizePrmIntegerId(
      root.product_route_id ?? product.product_route_id,
    ),
    route_validation:
      root.route_validation ??
      product.route_validation ??
      root.validation_status ??
      null,
    steps,
    records_created: 0,
    monetary_allocation_created: false,
    stage_03_authorised: false,
    raw: root,
  };
}

/**
 * Exact-run Workload Preview list args.
 * Never falls back to "today"; never includes the full analytical foundation RPC.
 */
export function buildPrmWorkloadPreviewArgs({
  period_start = null,
  valuation_date = null,
  refresh_run_id = null,
  search = null,
  foundation_status = null,
  quantity_driver_status = null,
  route_family_id = null,
  product_group_id = null,
  product_id = null,
  dl_scope_filter = null,
  poh_scope_filter = null,
  limit = 25,
  offset = 0,
} = {}) {
  const errors = [];
  const period = normalizePrmAsOfDate(period_start, { fallbackToToday: false });
  const valuation = normalizePrmAsOfDate(valuation_date, {
    fallbackToToday: false,
  });
  const runId = normalizePrmIntegerId(refresh_run_id);
  if (!period) errors.push("p_period_start requires a valid YYYY-MM-DD date");
  if (!valuation) errors.push("p_valuation_date requires a valid YYYY-MM-DD date");
  if (runId == null) errors.push("p_refresh_run_id requires a positive integer");
  if (errors.length) {
    return { ok: false, params: {}, errors };
  }
  const params = {
    p_period_start: period,
    p_valuation_date: valuation,
    p_refresh_run_id: runId,
    p_limit: Math.max(1, Math.min(Number(limit) || 25, 200)),
    p_offset: Math.max(0, Number(offset) || 0),
  };
  const q = isBlankPrmValue(search) ? "" : String(search).trim();
  if (q) params.p_search = q;
  const foundation = isBlankPrmValue(foundation_status)
    ? ""
    : String(foundation_status).trim();
  if (foundation) params.p_foundation_status = foundation;
  const qtyStatus = isBlankPrmValue(quantity_driver_status)
    ? ""
    : String(quantity_driver_status).trim();
  if (qtyStatus) params.p_quantity_driver_status = qtyStatus;
  const familyId = normalizePrmIntegerId(route_family_id);
  if (familyId != null) params.p_route_family_id = familyId;
  const groupId = normalizePrmIntegerId(product_group_id);
  if (groupId != null) params.p_product_group_id = groupId;
  const pid = normalizePrmIntegerId(product_id);
  if (pid != null) params.p_product_id = pid;
  const dl = isBlankPrmValue(dl_scope_filter)
    ? ""
    : normalizePrmCode(dl_scope_filter).toUpperCase();
  if (dl) params.p_dl_scope_filter = dl;
  const poh = isBlankPrmValue(poh_scope_filter)
    ? ""
    : normalizePrmCode(poh_scope_filter).toUpperCase();
  if (poh) params.p_poh_scope_filter = poh;
  return { ok: true, params, errors: [] };
}

/** Exact-run Workload Product-detail args — Product ID required. */
export function buildPrmWorkloadDetailArgs({
  period_start = null,
  valuation_date = null,
  refresh_run_id = null,
  product_id = null,
} = {}) {
  const errors = [];
  const period = normalizePrmAsOfDate(period_start, { fallbackToToday: false });
  const valuation = normalizePrmAsOfDate(valuation_date, {
    fallbackToToday: false,
  });
  const runId = normalizePrmIntegerId(refresh_run_id);
  const pid = normalizePrmIntegerId(product_id);
  if (!period) errors.push("p_period_start requires a valid YYYY-MM-DD date");
  if (!valuation) errors.push("p_valuation_date requires a valid YYYY-MM-DD date");
  if (runId == null) errors.push("p_refresh_run_id requires a positive integer");
  if (pid == null) errors.push("p_product_id requires a positive integer");
  if (errors.length) {
    return { ok: false, params: {}, errors };
  }
  return {
    ok: true,
    params: {
      p_period_start: period,
      p_valuation_date: valuation,
      p_refresh_run_id: runId,
      p_product_id: pid,
    },
    errors: [],
  };
}

/**
 * Exact-run Workload Management Explain args (Gate 11Y.10I.2C.2B.2).
 * Same four keys as detail; no pagination / filters.
 */
export function buildPrmWorkloadManagementExplainArgs({
  period_start = null,
  valuation_date = null,
  refresh_run_id = null,
  product_id = null,
} = {}) {
  return buildPrmWorkloadDetailArgs({
    period_start,
    valuation_date,
    refresh_run_id,
    product_id,
  });
}

/**
 * Pass-through normalize for frozen management explain.
 * Does not recompute factors, shares, or allocations.
 */
export function normalizePrmWorkloadManagementExplainPayload(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const context =
    root.context && typeof root.context === "object" ? root.context : {};
  return {
    read_only: root.read_only !== false,
    frozen_exact_run: root.frozen_exact_run === true,
    records_created: Number(root.records_created) || 0,
    monetary_allocation_created: root.monetary_allocation_created === true,
    context,
    direct_labour:
      root.direct_labour && typeof root.direct_labour === "object"
        ? root.direct_labour
        : null,
    production_overhead:
      root.production_overhead && typeof root.production_overhead === "object"
        ? root.production_overhead
        : null,
    management_note:
      root.management_note != null ? String(root.management_note) : null,
    raw: root,
  };
}

/** Share 0–1 → human-readable percent; raw value for title. */
export function formatPrmWorkloadSharePercent(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const pct = n * 100;
  const abs = Math.abs(pct);
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 3 : 4;
  return `${pct.toLocaleString("en-IN", {
    minimumFractionDigits: Math.min(2, digits),
    maximumFractionDigits: digits,
  })}%`;
}

export function formatPrmWorkloadExplainNumber(value, { maxDigits = 6 } = {}) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  });
}

export function formatPrmWorkloadExplainMoney(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Display-only Reconciled / Discrepancy from server reconciliation object.
 * Uses server deltas / expected vs stored pairs — does not reconstruct formula.
 */
export function classifyPrmWorkloadReconciliation(reconciliation = {}) {
  const r =
    reconciliation && typeof reconciliation === "object" ? reconciliation : {};
  const factorDeltaKeys = [
    "route_intensity_delta",
    "route_factor_delta",
    "workload_units_delta",
  ];
  for (const key of factorDeltaKeys) {
    if (r[key] == null || r[key] === "") continue;
    const n = Number(r[key]);
    if (Number.isFinite(n) && Math.abs(n) > PRM_WORKLOAD_RECON_FACTOR_TOLERANCE) {
      return { pass: false, label: "Discrepancy" };
    }
  }
  if (
    r.expected_workload_share != null &&
    r.stored_workload_share != null &&
    r.expected_workload_share !== "" &&
    r.stored_workload_share !== ""
  ) {
    const expected = Number(r.expected_workload_share);
    const stored = Number(r.stored_workload_share);
    if (
      Number.isFinite(expected) &&
      Number.isFinite(stored) &&
      Math.abs(expected - stored) > PRM_WORKLOAD_RECON_FACTOR_TOLERANCE
    ) {
      return { pass: false, label: "Discrepancy" };
    }
  }
  if (
    r.expected_product_allocation != null &&
    r.stored_product_allocation != null &&
    r.expected_product_allocation !== "" &&
    r.stored_product_allocation !== ""
  ) {
    const expected = Number(r.expected_product_allocation);
    const stored = Number(r.stored_product_allocation);
    if (
      Number.isFinite(expected) &&
      Number.isFinite(stored) &&
      Math.abs(expected - stored) > PRM_WORKLOAD_RECON_MONEY_TOLERANCE
    ) {
      return { pass: false, label: "Discrepancy" };
    }
  }
  return { pass: true, label: "Reconciled" };
}

export function hasPrmDlSupervisionSteps(steps = []) {
  return coercePrmList(steps).some((step) => {
    const scope = normalizePrmCode(
      step?.direct_labour_scope || step?.dl_scope,
    ).toUpperCase();
    return scope === "SUPERVISION";
  });
}

export function resolvePrmWorkloadExplainRouteLineage(payload = {}) {
  const dl = payload?.direct_labour?.workload || {};
  const poh = payload?.production_overhead?.workload || {};
  const routeFamilyId = normalizePrmIntegerId(
    dl.route_family_id ?? poh.route_family_id,
  );
  const familyRouteId = normalizePrmIntegerId(
    dl.family_route_id ?? poh.family_route_id,
  );
  const productRouteId = normalizePrmIntegerId(
    dl.product_route_id ?? poh.product_route_id,
  );
  const effectiveSource =
    dl.effective_route_source || poh.effective_route_source || null;
  if (familyRouteId == null && productRouteId == null) {
    return { ok: false, reason: "missing_route_ids" };
  }
  return {
    ok: true,
    route_family_id: routeFamilyId,
    family_route_id: familyRouteId,
    product_route_id: productRouteId,
    effective_route_source: effectiveSource,
    label: "View route lineage",
    subcopy:
      "Opens current master lineage; current route may differ from this frozen run.",
  };
}

export function formatPrmWorkloadSummaryLine(summary = {}, totalCount = null) {
  const s = summary && typeof summary === "object" ? summary : {};
  const products =
    s.recipient_product_count != null
      ? s.recipient_product_count
      : totalCount != null
        ? totalCount
        : "—";
  const ready = s.ready_count != null ? s.ready_count : "—";
  const review =
    s.review_required_count != null ? s.review_required_count : "—";
  const blocked = s.blocked_count != null ? s.blocked_count : "—";
  const batches =
    s.total_standard_batch_count != null
      ? s.total_standard_batch_count
      : "—";
  return `Workload preview · ${products} Products · ${ready} ready · ${review} review · ${blocked} blocked · ${batches} rounded standard batches`;
}

export function normalizePrmProductAssignmentsPayload(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const rows = coercePrmList(root.rows || root.items || root.assignments).map(
    normalizePrmProductAssignmentRow,
  );
  const total =
    root.total_count != null ? Number(root.total_count) : rows.length;
  return {
    rows,
    total_count: Number.isFinite(total) ? total : rows.length,
    status_counts: normalizePrmStatusCounts(
      root.status_counts ?? root.statusCounts,
    ),
    lifecycle_actions: normalizePrmAssignmentLifecycleActions(
      root.lifecycle_actions,
    ),
    definition_read_only: root.definition_read_only === true,
    overlap_evidence: root.overlap_evidence ?? root.overlap_warning ?? null,
    cancellation_evidence: root.cancellation_evidence ?? null,
    effective_route_validation: root.effective_route_validation ?? null,
    raw: root,
  };
}

export function extractCandidateRouteFamilyId(candidatePayload) {
  const normalized =
    candidatePayload && typeof candidatePayload === "object"
      ? candidatePayload
      : {};
  const root = normalized.raw || normalized;
  const candidates = [
    root.route_family_id,
    root.summary?.route_family_id,
    root.product?.route_family_id,
    root.policy?.route_family_id,
  ];
  for (const item of coercePrmList(root.family_comparison)) {
    if (item?.route_family_id != null) {
      candidates.push(item.route_family_id);
    }
  }
  for (const value of candidates) {
    const id = normalizePrmIntegerId(value);
    if (id != null) return id;
  }
  return null;
}

export const PRM_MAPPING_BASIS_OPTIONS = Object.freeze([
  {
    value: "MANUAL",
    label: "Manual process confirmation",
  },
  {
    value: "HISTORICAL_REVIEW",
    label: "Historical evidence reviewed",
  },
  {
    value: "MIGRATED",
    label: "Migrated governed mapping",
  },
]);

export const PRM_ASSIGNMENT_BASIS_OPTIONS = Object.freeze(
  PRM_MAPPING_BASIS_OPTIONS.filter((opt) => opt.value !== "MIGRATED"),
);

export const PRM_APPROVAL_REFERENCE_HELPER_TEXT =
  "Use the official approval/order/minutes reference where available. The suggested reference may be edited.";

export const PRM_FAMILY_FIELD_HELPERS = Object.freeze({
  family_code:
    "Use uppercase words separated by underscores. Example: KASHAYAM_REGULAR.",
  family_name:
    "Use the standard manufacturing family name. Example: Kashayam - Regular.",
  effective_from:
    "Date from which this Route Family may be used for approved mappings and routes.",
  description:
    "Briefly state the shared manufacturing process represented by this Family. Product-specific exceptions belong in Product route overrides.",
});

export const PRM_APPROVAL_REFERENCE_PLACEHOLDERS = Object.freeze([
  "—",
  "-",
  "–",
  "−",
  "NA",
  "N/A",
  "N.A.",
  "NONE",
  "NULL",
  "NIL",
  "AUTO",
  "MIGRATION",
]);

export const PRM_ACTIVE_ROW_CLASS = "cp-prm-row--active";

export const PRM_CANDIDATE_SELECT_FAMILY_MESSAGE =
  "Select an approved Manufacturing Route Family, or one or more Product Groups.";
export const PRM_CANDIDATE_SELECT_PRODUCT_MESSAGE =
  "Select a Product to preview its historical route evidence.";

const WIP_HOLD_KINDS = Object.freeze([
  "INTERMEDIATE_WIP_HOLD",
  "WAITING_OR_COOLING",
  "STORAGE_OCCUPANCY",
]);

export const PRM_SEQUENCE_TEMP_BASE = 100000;

export function isBlankPrmValue(value) {
  return value === null || value === undefined || value === "";
}

export function normalizePrmCode(code) {
  if (isBlankPrmValue(code)) return "";
  return String(code).trim();
}

export function humanizeUnknownPrmCode(code) {
  const raw = normalizePrmCode(code);
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Deterministic primary label for workload Explain policy codes. */
export function formatPrmWorkloadPolicyLabel(code) {
  const raw = normalizePrmCode(code);
  if (!raw) return "—";
  return humanizeUnknownPrmCode(raw) || raw;
}

/** Deterministic primary label for workload Explain formula_type codes. */
export function formatPrmWorkloadFormulaLabel(code) {
  const raw = normalizePrmCode(code);
  if (!raw) return "—";
  return humanizeUnknownPrmCode(raw) || raw;
}

export function labelFromPrmMap(code, map) {
  const raw = normalizePrmCode(code);
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(map, upper)) return map[upper];
  if (Object.prototype.hasOwnProperty.call(map, raw)) return map[raw];
  return humanizeUnknownPrmCode(raw) || raw;
}

export function formatPrmReadinessLabel(code) {
  return labelFromPrmMap(code, READINESS_LABELS);
}

/** Semantic tone for readiness chips: ready | review | blocked | unknown */
export function getPrmReadinessTone(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (!upper) return "unknown";
  if (upper === "READY") return "ready";
  if (upper.startsWith("REVIEW_REQUIRED") || upper.includes("REVIEW_REQUIRED")) {
    return "review";
  }
  if (upper.startsWith("BLOCKED_")) return "blocked";
  return "unknown";
}

export function formatPrmValidationLabel(code) {
  return labelFromPrmMap(code, VALIDATION_LABELS);
}

const PRM_MONTH_SHORT = Object.freeze([
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]);

/** Compact exact-run cue for Costing Readiness (no today substitution). */
export function formatPrmExactRunContextCue(
  context = PRM_EXACT_RUN_CONTEXT,
) {
  const runId = context?.refresh_run_id;
  const period = normalizePrmAsOfDate(context?.period_start, {
    fallbackToToday: false,
  });
  const valuation = normalizePrmAsOfDate(context?.valuation_date, {
    fallbackToToday: false,
  });
  const monthYear = formatPrmMonthYearLabel(period);
  const valued = formatPrmDayMonthYearLabel(valuation);
  if (runId == null || !monthYear || !valued) return "—";
  return `Run ${runId} · ${monthYear} · Valued ${valued}`;
}

export function formatPrmMonthYearLabel(isoDate) {
  const normalised = normalizePrmAsOfDate(isoDate, { fallbackToToday: false });
  if (!normalised) return null;
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(normalised);
  if (!match) return null;
  const [, year, month] = match;
  const idx = Number(month) - 1;
  if (idx < 0 || idx > 11) return null;
  return `${PRM_MONTH_SHORT[idx]} ${year}`;
}

export function formatPrmDayMonthYearLabel(isoDate) {
  const normalised = normalizePrmAsOfDate(isoDate, { fallbackToToday: false });
  if (!normalised) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalised);
  if (!match) return null;
  const [, year, month, day] = match;
  const idx = Number(month) - 1;
  if (idx < 0 || idx > 11) return null;
  return `${Number(day)} ${PRM_MONTH_SHORT[idx]} ${year}`;
}

function stripPrmLegacyVersionAlias(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const stripped = text.replace(/^v/i, "").trim();
  return stripped || null;
}

/**
 * Display-only current route version. `route_version` is authoritative.
 * Legacy aliases are used only when route_version is absent.
 * Never fabricates "1".
 */
export function resolvePrmDisplayedRouteVersion(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  if (!isBlankPrmValue(r.route_version)) {
    const raw = String(r.route_version).trim();
    const n = Number(raw);
    if (Number.isFinite(n) && Number.isInteger(n)) return String(n);
    return raw || null;
  }
  for (const key of ["version_label", "version_no", "version"]) {
    if (isBlankPrmValue(r[key])) continue;
    const stripped = stripPrmLegacyVersionAlias(r[key]);
    if (stripped) return stripped;
  }
  return null;
}

export function formatPrmRouteVersionCopy(row = {}) {
  const version = resolvePrmDisplayedRouteVersion(row);
  return version ? `Version ${version}` : "";
}

export function formatPrmEffectiveFromDisplay(isoDate) {
  return formatPrmDayMonthYearLabel(isoDate);
}

/** Open-ended effective_to (null/blank) renders Current. */
export function formatPrmEffectiveToDisplay(isoDate) {
  if (isBlankPrmValue(isoDate)) return "Current";
  return formatPrmDayMonthYearLabel(isoDate);
}

/**
 * Predecessor version for Supersedes display.
 * Matches historyRow.id === header.supersedes_route_id only.
 * Never treats the route id itself as a version.
 */
export function resolvePrmPredecessorRouteVersion(header = {}, historyRows = []) {
  const predId = normalizePrmIntegerId(header?.supersedes_route_id);
  if (predId == null) return null;
  const list = Array.isArray(historyRows) ? historyRows : [];
  const match = list.find(
    (row) => normalizePrmIntegerId(row?.id) === predId,
  );
  if (!match) return null;
  return resolvePrmDisplayedRouteVersion(match);
}

export function formatPrmSupersedesVersionCopy(header = {}, historyRows = []) {
  const version = resolvePrmPredecessorRouteVersion(header, historyRows);
  return version ? `Version ${version}` : "";
}

/**
 * Effective Family Route id from live effective-route payload.
 * Prefer base_route_family_route_id, then validation.family_route_id.
 */
export function resolvePrmEffectiveFamilyRouteId(effective = {}) {
  const root = effective && typeof effective === "object" ? effective : {};
  const validation =
    root.validation && typeof root.validation === "object"
      ? root.validation
      : {};
  return (
    normalizePrmIntegerId(root.base_route_family_route_id) ??
    normalizePrmIntegerId(validation.family_route_id) ??
    normalizePrmIntegerId(root.family_route_id) ??
    normalizePrmIntegerId(root.route_family_route_id)
  );
}

/** Version only when historyRow.id matches the effective Family Route id. */
export function resolvePrmFamilyRouteVersionFromHistory(
  familyRouteId,
  historyRows = [],
) {
  const id = normalizePrmIntegerId(familyRouteId);
  if (id == null) return null;
  const list = Array.isArray(historyRows) ? historyRows : [];
  const match = list.find((row) => {
    const rowId =
      normalizePrmIntegerId(row?.id) ??
      normalizePrmIntegerId(row?.family_route_id);
    return rowId === id;
  });
  if (!match) return null;
  return resolvePrmDisplayedRouteVersion(match);
}

export function formatPrmFamilyRouteVersionCopy(familyRouteId, historyRows = []) {
  const version = resolvePrmFamilyRouteVersionFromHistory(
    familyRouteId,
    historyRows,
  );
  return version ? `Version ${version}` : "";
}

/** Version only when history row id / product_route_id matches effective product_route_id. */
export function resolvePrmProductRouteVersionFromHistory(
  productRouteId,
  historyRows = [],
) {
  const id = normalizePrmIntegerId(productRouteId);
  if (id == null) return null;
  const list = Array.isArray(historyRows) ? historyRows : [];
  const match = list.find((row) => {
    const rowId =
      normalizePrmIntegerId(row?.id) ??
      normalizePrmIntegerId(row?.product_route_id) ??
      normalizePrmIntegerId(row?.route_id);
    return rowId === id;
  });
  if (!match) return null;
  return resolvePrmDisplayedRouteVersion(match);
}

export function formatPrmProductRouteVersionCopy(
  productRouteId,
  historyRows = [],
) {
  const version = resolvePrmProductRouteVersionFromHistory(
    productRouteId,
    historyRows,
  );
  return version ? `Version ${version}` : "";
}

export const PRM_PRODUCT_ROUTE_CREATE_BATCH_REQUIRED =
  "A governed Product batch-size reference is required before a Product Route can be created.";

export function normalizePrmBatchSizeReference(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const stateRaw = normalizePrmCode(r.state || r.status || r.lifecycle_state);
  const inactive =
    r.is_active === false ||
    r.is_active === "false" ||
    stateRaw === "INACTIVE" ||
    stateRaw === "SUPERSEDED";
  return {
    batch_size_ref_id: normalizePrmIntegerId(r.batch_size_ref_id ?? r.id),
    product_id: normalizePrmIntegerId(r.product_id),
    preferred_batch_size: r.preferred_batch_size ?? r.preferred ?? null,
    min_batch_size: r.min_batch_size ?? r.min ?? null,
    max_batch_size: r.max_batch_size ?? r.max ?? null,
    effective_from: normalizePrmAsOfDate(r.effective_from, {
      fallbackToToday: false,
    }),
    effective_to: normalizePrmAsOfDate(r.effective_to, {
      fallbackToToday: false,
    }),
    is_active: !inactive,
  };
}

export function isPrmBatchSizeReferenceEffective(ref = {}, asOfDate = null) {
  const row = normalizePrmBatchSizeReference(ref);
  if (row.batch_size_ref_id == null || row.is_active === false) return false;
  const asOf = normalizePrmAsOfDate(asOfDate, { fallbackToToday: false });
  if (row.effective_from && asOf && row.effective_from > asOf) return false;
  if (row.effective_to && asOf && row.effective_to < asOf) return false;
  return true;
}

/** Valid/effective governed batch-size references. Never treats preferred size as an id. */
export function selectPrmProductBatchSizeReferences(
  list = [],
  { product_id = null, as_of_date = null } = {},
) {
  const pid = normalizePrmIntegerId(product_id);
  const all = coercePrmList(list)
    .map(normalizePrmBatchSizeReference)
    .filter((row) => isPrmBatchSizeReferenceEffective(row, as_of_date));
  if (pid == null) return all;
  const scoped = all.filter((row) => row.product_id === pid);
  if (scoped.length) return scoped;
  return all.filter((row) => row.product_id == null);
}

export function formatPrmBatchSizeReferenceLabel(ref = {}) {
  const row = normalizePrmBatchSizeReference(ref);
  if (row.batch_size_ref_id == null) return "—";
  if (row.preferred_batch_size == null || row.preferred_batch_size === "") {
    return `Reference ${row.batch_size_ref_id}`;
  }
  return `Reference ${row.batch_size_ref_id} / Preferred Batch ${row.preferred_batch_size}`;
}

export function resolvePrmRouteFamilyAssignmentSource(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  return (
    r.route_family_assignment_source ||
    r.assignment_source ||
    r.assignment_basis ||
    null
  );
}

export function formatPrmRouteFamilyAssignmentSourceLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (!upper) return "";
  if (upper === "PRODUCT_ASSIGNMENT") return "Product-specific assignment";
  if (upper === "PRODUCT_SUBGROUP_FALLBACK") {
    return "Inherited from Product Subgroup";
  }
  if (upper === "PRODUCT_GROUP_FALLBACK") {
    return "Inherited from Product Group";
  }
  if (upper === "NONE") return "No approved assignment";
  return humanizeUnknownPrmCode(upper) || upper;
}

/** Precedence explainability — commercial hierarchy is unchanged. */
export function formatPrmRouteAssignmentSourceExplain(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (upper === "PRODUCT_ASSIGNMENT") {
    return "Product-specific assignment overrides Product Subgroup and Product Group defaults. Commercial hierarchy is unchanged.";
  }
  if (upper === "PRODUCT_SUBGROUP_FALLBACK") {
    return "Route Family is inherited from the Product Subgroup mapping.";
  }
  if (upper === "PRODUCT_GROUP_FALLBACK") {
    return "Route Family is inherited from the Product Group mapping.";
  }
  if (upper === "NONE") {
    return "No approved Product, Product Subgroup, or Product Group assignment.";
  }
  return "";
}

function normalizePrmRouteValidationErrorCode(raw) {
  if (raw == null) return "";
  if (typeof raw === "string") return normalizePrmCode(raw).toUpperCase();
  if (typeof raw === "object") {
    return normalizePrmCode(
      raw.code || raw.error || raw.error_code || raw.message || raw.key,
    ).toUpperCase();
  }
  return normalizePrmCode(String(raw)).toUpperCase();
}

function summarizePrmRouteValidationErrorCode(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (!upper) return null;
  if (upper.includes("NO_APPROVED_ROUTE_FAMILY_MAPPING")) {
    return "No approved mapping";
  }
  if (upper.includes("NO_APPROVED_ROUTE_FAMILY_ROUTE")) {
    return "No approved Family Route";
  }
  if (
    upper.includes("INCOMPLETE") &&
    (upper.includes("PRODUCT") || upper.includes("PROCESS"))
  ) {
    return "Product route incomplete";
  }
  return (
    formatPrmValidationLabel(upper) ||
    humanizeUnknownPrmCode(upper) ||
    upper
  );
}

function coercePrmValidationErrors(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((item) => item != null && item !== "");
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return coercePrmValidationErrors(parsed);
    } catch {
      return [trimmed];
    }
  }
  return [];
}

/** Compact table/modal summary — never String(object). */
export function formatPrmRouteValidationSummary(validation) {
  if (validation == null || validation === "") return "—";
  if (typeof validation === "boolean") {
    return validation ? "Valid" : "Invalid";
  }
  if (typeof validation === "string" || typeof validation === "number") {
    const raw = String(validation).trim();
    if (!raw) return "—";
    const upper = normalizePrmCode(raw).toUpperCase();
    if (upper === "VALID" || upper === "TRUE") return "Valid";
    if (upper === "INVALID" || upper === "FALSE") return "Invalid";
    return summarizePrmRouteValidationErrorCode(upper) || raw;
  }
  if (typeof validation !== "object") return "—";

  if (validation.valid === true || validation.is_valid === true) {
    return "Valid";
  }

  const errors = coercePrmValidationErrors(
    validation.errors ||
      validation.error_codes ||
      validation.validation_errors ||
      validation.issues,
  );
  if (errors.length) {
    const first = normalizePrmRouteValidationErrorCode(errors[0]);
    return summarizePrmRouteValidationErrorCode(first) || "Invalid";
  }

  if (validation.valid === false || validation.is_valid === false) {
    return "Invalid";
  }

  const statusCode = normalizePrmRouteValidationErrorCode(
    validation.status || validation.validation_status || validation.code,
  );
  if (statusCode) {
    const summary = summarizePrmRouteValidationErrorCode(statusCode);
    if (summary) return summary;
  }

  return "—";
}

/** Semantic tone for route-validation badges: ok | blocked | unknown */
export function getPrmRouteValidationTone(summary) {
  const label = String(summary || "").trim();
  if (!label || label === "—") return "unknown";
  if (label === "Valid") return "ok";
  return "blocked";
}

/** Full validation evidence for Product detail (not table). */
export function listPrmRouteValidationErrors(validation) {
  if (validation == null || typeof validation !== "object") return [];
  const errors = coercePrmValidationErrors(
    validation.errors ||
      validation.error_codes ||
      validation.validation_errors ||
      validation.issues,
  );
  return errors
    .map((item) => {
      const code = normalizePrmRouteValidationErrorCode(item);
      const label =
        summarizePrmRouteValidationErrorCode(code) ||
        (typeof item === "object" && item?.message
          ? String(item.message)
          : code);
      return label || null;
    })
    .filter(Boolean);
}

export function formatPrmDeltaLabel(code) {
  return labelFromPrmMap(code, DELTA_LABELS);
}

export function resolvePrmDeltaOperation(row = {}) {
  return normalizePrmCode(
    row?.operation_type ||
      row?.delta_operation ||
      row?.override_operation ||
      row?.operation,
  ).toUpperCase();
}

export function resolvePrmFamilyStepId(step = {}) {
  return (
    normalizePrmIntegerId(step?.family_route_step_id) ??
    normalizePrmIntegerId(step?.route_step_id) ??
    normalizePrmIntegerId(step?.base_step_id) ??
    normalizePrmIntegerId(step?.step_id) ??
    normalizePrmIntegerId(step?.id)
  );
}

export function formatPrmDeltaBaseStepLabel(step = {}) {
  const seq = step?.sequence_no;
  const name =
    step?.activity_name ||
    step?.activity ||
    step?.step_label ||
    step?.step_key ||
    "";
  const seqPart =
    seq != null && String(seq).trim() !== "" ? `Seq ${seq}` : "";
  if (seqPart && name) return `${seqPart} — ${name}`;
  return seqPart || String(name || resolvePrmFamilyStepId(step) || "");
}

export function selectPrmBypassEligibleFamilySteps(steps = []) {
  return coercePrmList(steps).filter((step) => {
    const raw = step?.allows_skip_with_approval;
    return raw === true || raw === "true" || raw === "t" || raw === 1 || raw === "1";
  });
}

export function normalizePrmProductRouteOverride(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const operation_type = resolvePrmDeltaOperation(r);
  const override_id = normalizePrmIntegerId(r.override_id ?? r.id);
  const base_step_id = normalizePrmIntegerId(r.base_step_id);
  const override_step_key = String(
    r.override_step_key || r.step_key || r.target_step_key || "",
  ).trim();
  const override_reason = String(
    r.override_reason || r.note || r.override_note || "",
  ).trim();
  return {
    ...r,
    override_id,
    id: override_id ?? r.id ?? null,
    operation_type: operation_type || null,
    delta_operation: operation_type || null,
    base_step_id,
    override_step_key: override_step_key || null,
    step_key: override_step_key || r.step_key || null,
    override_reason: override_reason || null,
    note: override_reason || r.note || null,
  };
}

export function formatPrmDeltaTargetCopy(row = {}, familySteps = []) {
  const delta = normalizePrmProductRouteOverride(row);
  const op = delta.operation_type;
  if (op === "ADD_STEP") {
    const seq =
      delta.sequence_no != null ? `Seq ${delta.sequence_no}` : "";
    const key =
      delta.override_step_key ||
      delta.activity_name ||
      delta.step_key ||
      "";
    return [seq, key].filter(Boolean).join(" · ") || "Added step";
  }
  const base =
    coercePrmList(familySteps).find(
      (step) => resolvePrmFamilyStepId(step) === delta.base_step_id,
    ) || null;
  if (base) return formatPrmDeltaBaseStepLabel(base);
  if (delta.base_step_id != null) return `Family step ${delta.base_step_id}`;
  return delta.override_step_key || "";
}

/** Enrich Activity rows with hierarchy names from master-options location catalogues. */
export function enrichPrmMasterActivities(optionsPayload = {}) {
  const root =
    optionsPayload?.activities != null
      ? optionsPayload
      : normalizePrmMasterOptions(optionsPayload);
  const sectionNames = new Map();
  const subsectionNames = new Map();
  const areaNames = new Map();
  for (const row of coercePrmList(root.sections)) {
    const id = normalizePrmIntegerId(row.section_id ?? row.id);
    if (id != null) {
      sectionNames.set(id, row.section_name || row.name || "");
    }
  }
  for (const row of coercePrmList(root.subsections)) {
    const id = normalizePrmIntegerId(row.subsection_id ?? row.id);
    if (id != null) {
      subsectionNames.set(id, row.subsection_name || row.name || "");
    }
  }
  for (const row of coercePrmList(root.areas)) {
    const id = normalizePrmIntegerId(row.area_id ?? row.id);
    if (id != null) {
      areaNames.set(id, row.area_name || row.name || "");
    }
  }
  return coercePrmList(root.activities).map((row) => {
    const activity_id = normalizePrmIntegerId(row.activity_id ?? row.id);
    const section_id = normalizePrmIntegerId(row.section_id);
    const subsection_id = normalizePrmIntegerId(row.subsection_id);
    const area_id = normalizePrmIntegerId(row.area_id);
    return {
      ...row,
      activity_id,
      id: activity_id,
      section_id,
      subsection_id,
      area_id,
      section_name:
        row.section_name || sectionNames.get(section_id) || null,
      subsection_name:
        row.subsection_name || subsectionNames.get(subsection_id) || null,
      area_name: row.area_name || areaNames.get(area_id) || null,
    };
  });
}

/** Enrich Cost Centre rows with hierarchy and default resource labels. */
export function enrichPrmMasterCostCentres(optionsPayload = {}) {
  const root =
    optionsPayload?.cost_centres != null
      ? optionsPayload
      : normalizePrmMasterOptions(optionsPayload);
  const sectionNames = new Map();
  const subsectionNames = new Map();
  const areaNames = new Map();
  const plantNames = new Map();
  const resourceLabels = new Map();
  for (const row of coercePrmList(root.sections)) {
    const id = normalizePrmIntegerId(row.section_id ?? row.id);
    if (id != null) sectionNames.set(id, row.section_name || row.name || "");
  }
  for (const row of coercePrmList(root.subsections)) {
    const id = normalizePrmIntegerId(row.subsection_id ?? row.id);
    if (id != null) {
      subsectionNames.set(id, row.subsection_name || row.name || "");
    }
  }
  for (const row of coercePrmList(root.areas)) {
    const id = normalizePrmIntegerId(row.area_id ?? row.id);
    if (id != null) areaNames.set(id, row.area_name || row.name || "");
  }
  for (const row of coercePrmList(root.plants)) {
    const id = normalizePrmIntegerId(row.plant_id ?? row.id);
    if (id != null) plantNames.set(id, row.plant_name || row.name || "");
  }
  for (const row of coercePrmList(root.resource_classes)) {
    const normalized = normalizePrmResourceClassCatalogueRow(row);
    if (
      normalized.resource_class_code &&
      !isBlankPrmValue(normalized.resource_class_label)
    ) {
      resourceLabels.set(
        normalized.resource_class_code,
        normalized.resource_class_label,
      );
    }
  }
  return coercePrmList(root.cost_centres).map((row) => {
    const normalized = normalizePrmCostCentreRow(row);
    const section_id = normalizePrmIntegerId(
      normalized.section_id ?? row.section_id,
    );
    const subsection_id = normalizePrmIntegerId(
      normalized.subsection_id ?? row.subsection_id,
    );
    const area_id = normalizePrmIntegerId(normalized.area_id ?? row.area_id);
    const plant_id = normalizePrmIntegerId(normalized.plant_id ?? row.plant_id);
    const defaultRc = normalizePrmCode(
      normalized.default_resource_class_code || row.default_resource_class_code,
    );
    return {
      ...normalized,
      section_id,
      subsection_id,
      area_id,
      plant_id,
      section_name:
        normalized.section_name ||
        row.section_name ||
        sectionNames.get(section_id) ||
        null,
      subsection_name:
        normalized.subsection_name ||
        row.subsection_name ||
        subsectionNames.get(subsection_id) ||
        null,
      area_name:
        normalized.area_name || row.area_name || areaNames.get(area_id) || null,
      plant_name:
        normalized.plant_name || row.plant_name || plantNames.get(plant_id) || null,
      default_resource_class_code: defaultRc || normalized.resource_class || null,
      default_resource_class_label:
        resourceLabels.get(defaultRc) ||
        resolvePrmResourceClassDisplayLabel(defaultRc, {
          catalogueIndex: resourceLabels,
          rowLabel: normalized.resource_class_label,
        }) ||
        null,
    };
  });
}

export function buildPrmMasterOptionsForStepAuthoring(optionsPayload = {}) {
  const root = normalizePrmMasterOptions(optionsPayload);
  const enrichedRoot = enrichPrmMasterResourceClasses(root);
  return {
    ...enrichedRoot,
    activities: enrichPrmMasterActivities(enrichedRoot),
    cost_centres: enrichPrmMasterCostCentres(enrichedRoot),
  };
}

export function extractEnrichedApprovedCostCentres(optionsPayload = {}) {
  const enriched = buildPrmMasterOptionsForStepAuthoring(optionsPayload);
  return extractApprovedCostCentres(enriched);
}

export function formatPrmActivityLocationCopy(activity = {}) {
  return (
    formatPrmHierarchyLabel([
      activity.section_name,
      activity.subsection_name,
      activity.area_name,
    ]) || ""
  );
}

export function formatPrmActivityOptionLabel(activity = {}) {
  const name = activity.activity_name || activity.name || "";
  const short = activity.short_code || activity.activity_code || "";
  const location = formatPrmActivityLocationCopy(activity);
  const primary = [name, short].filter((part) => !isBlankPrmValue(part)).join(" · ");
  if (!primary) return String(activity.activity_id ?? activity.id ?? "");
  return location ? `${primary} — ${location}` : primary;
}

export function formatPrmActivityOptionPrimary(activity = {}) {
  const name = activity.activity_name || activity.name || "";
  const short = activity.short_code || activity.activity_code || "";
  return [name, short].filter((part) => !isBlankPrmValue(part)).join(" · ");
}

export function formatPrmActivityOptionSearchText(activity = {}) {
  return [
    activity.activity_name,
    activity.short_code,
    activity.activity_kind,
    activity.section_name,
    activity.subsection_name,
    activity.area_name,
  ]
    .filter((part) => !isBlankPrmValue(part))
    .join(" ");
}

export function formatPrmCostCentreContextCopy(centre = {}) {
  return (
    formatPrmHierarchyLabel([
      centre.section_name,
      centre.subsection_name,
      centre.area_name,
    ]) || centre.hierarchy ||
    ""
  );
}

export function formatPrmCostCentreOptionLabel(centre = {}) {
  const name = centre.cost_centre_name || centre.name || "";
  const code = centre.cost_centre_code || centre.code || "";
  const location = formatPrmCostCentreContextCopy(centre);
  const resource =
    centre.default_resource_class_label ||
    resolvePrmResourceClassDisplayLabel(centre.default_resource_class_code, {
      rowLabel: centre.resource_class_label,
    }) ||
    "";
  return [name, code, location, resource]
    .filter((part) => !isBlankPrmValue(part))
    .join(" — ");
}

export function formatPrmCostCentreOptionPrimary(centre = {}) {
  return centre.cost_centre_name || centre.name || centre.cost_centre_code || "";
}

export function formatPrmCostCentreOptionSecondary(centre = {}) {
  const location = formatPrmCostCentreContextCopy(centre);
  const resource =
    centre.default_resource_class_label ||
    resolvePrmResourceClassDisplayLabel(centre.default_resource_class_code, {
      rowLabel: centre.resource_class_label,
    }) ||
    "";
  const resourceLine = resource ? `Default resource: ${resource}` : "";
  return [location, resourceLine].filter((part) => !isBlankPrmValue(part)).join(" · ");
}

export function formatPrmCostCentreOptionSearchText(centre = {}) {
  return [
    centre.cost_centre_name,
    centre.cost_centre_code,
    centre.section_name,
    centre.subsection_name,
    centre.area_name,
    centre.default_resource_class_code,
    centre.default_resource_class_label,
  ]
    .filter((part) => !isBlankPrmValue(part))
    .join(" ");
}

export const PRM_ACTIVITY_CC_COMPATIBILITY = Object.freeze({
  EXACT_CONTEXT: "EXACT_CONTEXT",
  PARTIAL_CONTEXT: "PARTIAL_CONTEXT",
  DIFFERENT_CONTEXT: "DIFFERENT_CONTEXT",
  INCOMPLETE: "INCOMPLETE",
});

export function classifyPrmActivityCostCentreCompatibility(
  activity = {},
  costCentre = {},
) {
  const aSection = normalizePrmIntegerId(activity.section_id);
  const aSub = normalizePrmIntegerId(activity.subsection_id);
  const aArea = normalizePrmIntegerId(activity.area_id);
  const cSection = normalizePrmIntegerId(costCentre.section_id);
  const cSub = normalizePrmIntegerId(costCentre.subsection_id);
  const cArea = normalizePrmIntegerId(costCentre.area_id);
  if (
    aSection == null ||
    aSub == null ||
    aArea == null ||
    cSection == null ||
    cSub == null ||
    cArea == null
  ) {
    return PRM_ACTIVITY_CC_COMPATIBILITY.INCOMPLETE;
  }
  if (aSection === cSection && aSub === cSub && aArea === cArea) {
    return PRM_ACTIVITY_CC_COMPATIBILITY.EXACT_CONTEXT;
  }
  if (aSection === cSection) {
    return PRM_ACTIVITY_CC_COMPATIBILITY.PARTIAL_CONTEXT;
  }
  return PRM_ACTIVITY_CC_COMPATIBILITY.DIFFERENT_CONTEXT;
}

export function formatPrmActivityCostCentreCompatibilityStatus(classification) {
  const code = normalizePrmCode(classification).toUpperCase();
  if (code === PRM_ACTIVITY_CC_COMPATIBILITY.EXACT_CONTEXT) {
    return "Compatible";
  }
  if (
    code === PRM_ACTIVITY_CC_COMPATIBILITY.PARTIAL_CONTEXT ||
    code === PRM_ACTIVITY_CC_COMPATIBILITY.DIFFERENT_CONTEXT
  ) {
    return "Review physical context";
  }
  return "";
}

export function requiresPrmActivityCostCentreAcknowledgement(classification) {
  const code = normalizePrmCode(classification).toUpperCase();
  return (
    code === PRM_ACTIVITY_CC_COMPATIBILITY.PARTIAL_CONTEXT ||
    code === PRM_ACTIVITY_CC_COMPATIBILITY.DIFFERENT_CONTEXT
  );
}

export function isValidPrmProductDeltaStepKey(key) {
  const raw = String(key ?? "").trim();
  if (!raw) return false;
  return /^[A-Z0-9_]+$/.test(raw);
}

export function canonicalizePrmProductDeltaStepKey(
  raw,
  { trimEdges = false } = {},
) {
  let value = String(raw ?? "").toUpperCase();
  value = value.replace(/[\s-]+/g, "_");
  value = value.replace(/[^A-Z0-9_]+/g, "");
  value = value.replace(/_+/g, "_");
  if (trimEdges) value = value.replace(/^_+|_+$/g, "");
  return value;
}

export function collectPrmProductDeltaStepKeys({
  overrides = [],
  familySteps = [],
  effectiveSteps = [],
  excludeOverrideId = null,
} = {}) {
  const keys = new Set();
  const add = (value) => {
    const raw = String(value ?? "").trim();
    if (raw) keys.add(raw.toUpperCase());
  };
  const stepKeyOf = (row = {}) =>
    row.override_step_key || row.step_key || row.effective_step_key || "";
  const overrideIdOf = (row = {}) =>
    normalizePrmIntegerId(
      row.override_id ??
        row.product_route_override_id ??
        row.product_override_id ??
        row.source_override_id ??
        row.id,
    );
  const exclude = normalizePrmIntegerId(excludeOverrideId);
  let excludedKey = "";
  for (const row of coercePrmList(overrides)) {
    const id = overrideIdOf(row);
    if (exclude != null && id === exclude) {
      excludedKey = String(stepKeyOf(row) || "").trim().toUpperCase();
      continue;
    }
    add(stepKeyOf(row));
  }
  for (const step of coercePrmList(familySteps)) {
    add(stepKeyOf(step));
  }
  for (const step of coercePrmList(effectiveSteps)) {
    const stepOverrideId = overrideIdOf(step);
    // Edit mode: the composed effective route still carries this override's key.
    // Excluding only the override row is not enough — skip that effective row too.
    if (exclude != null && stepOverrideId === exclude) continue;
    if (
      exclude != null &&
      excludedKey &&
      stepOverrideId == null &&
      String(stepKeyOf(step) || "")
        .trim()
        .toUpperCase() === excludedKey
    ) {
      continue;
    }
    add(stepKeyOf(step));
  }
  return keys;
}

export function suggestPrmProductDeltaStepKey(activity = {}, takenKeys = []) {
  const taken = takenKeys instanceof Set ? takenKeys : collectPrmProductDeltaStepKeys({
    overrides: coercePrmList(takenKeys).map((key) => ({
      override_step_key: key,
    })),
  });
  const base =
    canonicalizePrmProductDeltaStepKey(
      activity.activity_name || activity.name || "",
      { trimEdges: true },
    ) || "STEP";
  if (!taken.has(base)) return base;
  const token = canonicalizePrmProductDeltaStepKey(
    activity.subsection_name || "",
    { trimEdges: true },
  );
  if (token) {
    const withSub = `${base}_${token}`;
    if (!taken.has(withSub)) return withSub;
  }
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

export const isValidPrmFamilyRouteStepKey = isValidPrmProductDeltaStepKey;

export const canonicalizePrmFamilyRouteStepKey = canonicalizePrmProductDeltaStepKey;

/** Governed Activity name tokens → stable Family Route step keys. */
export const PRM_FAMILY_ROUTE_ACTIVITY_STEP_KEY_BY_TOKEN = Object.freeze({
  RM_DISPENSATION: "RM_ISSUE",
  DISINTEGRATION: "DISINTEGRATION",
  PULVERIZATION: "PULVERIZATION",
  SIEVING: "SIEVING",
  FINISHED_GOODS_QUALITY_ASSESSMENT: "QC_ASSESSMENT",
  TRANSFER_TO_FG_STORE: "FG_TRANSFER",
});

export function resolvePrmFamilyRouteActivityStepKeyBase(activity = {}) {
  const nameRaw = String(
    activity.activity_name || activity.name || activity.label || "",
  ).trim();
  if (!nameRaw) return "";
  const token = canonicalizePrmFamilyRouteStepKey(nameRaw, { trimEdges: true });
  if (token && PRM_FAMILY_ROUTE_ACTIVITY_STEP_KEY_BY_TOKEN[token]) {
    return PRM_FAMILY_ROUTE_ACTIVITY_STEP_KEY_BY_TOKEN[token];
  }
  const upper = nameRaw.toUpperCase();
  if (upper.includes("RM") && upper.includes("DISPENS")) return "RM_ISSUE";
  if (
    upper.includes("QUALITY") &&
    (upper.includes("ASSESS") || upper.includes("QC"))
  ) {
    return "QC_ASSESSMENT";
  }
  if (
    upper.includes("TRANSFER") &&
    (upper.includes("FG") || upper.includes("FINISHED GOODS"))
  ) {
    return "FG_TRANSFER";
  }
  if (upper.includes("DISINTEGRATION")) return "DISINTEGRATION";
  if (upper.includes("PULVERIZATION") || upper.includes("PULVERISATION")) {
    return "PULVERIZATION";
  }
  if (upper.includes("SIEVING") || upper.includes("SIEVE")) return "SIEVING";
  return token;
}

export function collectPrmFamilyRouteStepKeys({
  steps = [],
  excludeStepId = null,
} = {}) {
  const keys = new Set();
  const exclude = normalizePrmIntegerId(excludeStepId);
  for (const step of coercePrmList(steps)) {
    const id = normalizePrmIntegerId(
      step.family_route_step_id ?? step.route_step_id ?? step.step_id ?? step.id,
    );
    if (exclude != null && id === exclude) continue;
    const raw = String(step.step_key || "").trim();
    if (raw) keys.add(raw.toUpperCase());
  }
  return keys;
}

export function suggestPrmFamilyRouteStepKey(activity = {}, takenKeys = []) {
  const taken =
    takenKeys instanceof Set
      ? takenKeys
      : collectPrmFamilyRouteStepKeys({ steps: coercePrmList(takenKeys) });
  const base = resolvePrmFamilyRouteActivityStepKeyBase(activity);
  if (!base) return "";
  if (!taken.has(base)) return base;
  const codeToken = canonicalizePrmFamilyRouteStepKey(
    activity.activity_code || activity.short_code || "",
    { trimEdges: true },
  );
  if (codeToken && codeToken !== base) {
    const withCode = `${base}_${codeToken}`;
    if (!taken.has(withCode)) return withCode;
  }
  const areaToken = canonicalizePrmFamilyRouteStepKey(
    activity.area_name || activity.subsection_name || "",
    { trimEdges: true },
  );
  if (areaToken && areaToken !== base) {
    const withArea = `${base}_${areaToken}`;
    if (!taken.has(withArea)) return withArea;
  }
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

export function validatePrmFamilyRouteStepKey(key) {
  const canonical = canonicalizePrmFamilyRouteStepKey(key, { trimEdges: true });
  if (!canonical) {
    return { ok: false, error: "Step key is required.", canonical: "" };
  }
  if (!isValidPrmFamilyRouteStepKey(canonical)) {
    return {
      ok: false,
      error:
        "Step key must use uppercase letters, numbers, and underscores only.",
      canonical,
    };
  }
  return { ok: true, canonical };
}

export function resolvePrmPoolScopeDlPohRequirement({
  costCentre = null,
  routeStepScope = null,
} = {}) {
  const pool = normalizePrmCode(costCentre?.pool_scope).toUpperCase();
  const scope = normalizePrmCode(routeStepScope).toUpperCase();
  const excludedCc = pool === PRM_COST_CENTRE_POOL_EXCLUDED;
  const otherPool = PRM_OTHER_POOL_STEP_SCOPES.includes(scope);
  if (!excludedCc && !otherPool) return null;
  return {
    direct_labour_scope: "EXCLUDE_OTHER_POOL",
    production_overhead_scope: "EXCLUDE_OTHER_POOL",
    forced: true,
  };
}

export function validatePrmProductDeltaMasterIntegrity(
  values = {},
  {
    options = {},
    familySteps = [],
    existingOverrides = [],
    effectiveSteps = [],
    excludeOverrideId = null,
    compatibilityAcknowledged = false,
  } = {},
) {
  const errors = [];
  const enriched = buildPrmMasterOptionsForStepAuthoring(options);
  const activities = enriched.activities || [];
  const centres = extractApprovedCostCentres(enriched);
  const behaviours = enriched.behaviours || [];
  const resources = enriched.resource_classes || [];
  const op = normalizePrmCode(values.operation_type).toUpperCase();

  const findActivity = (id) =>
    activities.find(
      (row) => normalizePrmIntegerId(row.activity_id ?? row.id) === id,
    ) || null;
  const findCentre = (id) =>
    centres.find(
      (row) => normalizePrmIntegerId(row.cost_centre_id ?? row.id) === id,
    ) || null;

  if (op === "ADD_STEP" || op === "REPLACE_STEP") {
    const activityId = normalizePrmIntegerId(values.activity_id);
    const activity = findActivity(activityId);
    if (!activity) {
      errors.push("Selected Activity is unavailable. Reload master options.");
    } else if (
      normalizePrmIntegerId(values.section_id) !==
        normalizePrmIntegerId(activity.section_id) ||
      normalizePrmIntegerId(values.subsection_id) !==
        normalizePrmIntegerId(activity.subsection_id) ||
      normalizePrmIntegerId(values.area_id) !==
        normalizePrmIntegerId(activity.area_id)
    ) {
      errors.push(
        "Activity location no longer matches the selected Activity. Reselect Activity.",
      );
    }

    const ccId = normalizePrmIntegerId(values.cost_centre_id);
    const centre = findCentre(ccId);
    if (!centre) {
      errors.push(
        "Selected Cost Centre is not approved or is unavailable. Choose another centre.",
      );
    }

    if (values.override_step_key) {
      values.override_step_key = canonicalizePrmProductDeltaStepKey(
        values.override_step_key,
        { trimEdges: true },
      );
      if (!isValidPrmProductDeltaStepKey(values.override_step_key)) {
        errors.push(
          "Override step key must use uppercase letters, numbers, and underscores only.",
        );
      }
      const taken = collectPrmProductDeltaStepKeys({
        overrides: existingOverrides,
        familySteps,
        effectiveSteps,
        excludeOverrideId,
      });
      const want = String(values.override_step_key).trim().toUpperCase();
      if (taken.has(want)) {
        errors.push("Override step key must be unique within this Product route.");
      }
    }

    if (values.plant_id != null) {
      const plants = filterPrmPlantsByLocation(enriched.plants || [], {
        section_id: values.section_id,
        subsection_id: values.subsection_id,
        area_id: values.area_id,
      });
      const plantOk = plants.some(
        (row) =>
          normalizePrmIntegerId(row.plant_id ?? row.id) ===
          normalizePrmIntegerId(values.plant_id),
      );
      if (!plantOk) {
        errors.push("Selected Plant is not valid for the Activity location.");
      }
    }

    if (values.behaviour_code) {
      const ok = coercePrmList(behaviours).some(
        (row) =>
          normalizePrmCode(row.behaviour_code || row.code) ===
          normalizePrmCode(values.behaviour_code),
      );
      if (!ok) errors.push("Selected Behaviour is no longer available.");
    }
    if (values.resource_class_code) {
      const ok = coercePrmList(resources).some(
        (row) =>
          normalizePrmCode(row.resource_class_code || row.code) ===
          normalizePrmCode(values.resource_class_code),
      );
      if (!ok) errors.push("Selected Resource class is no longer available.");
    }

    const poolRule = resolvePrmPoolScopeDlPohRequirement({
      costCentre: centre,
      routeStepScope: values.route_step_scope,
    });
    if (poolRule?.forced) {
      if (values.direct_labour_scope !== "EXCLUDE_OTHER_POOL") {
        errors.push(
          "Excluded Cost Centre or other-pool step scope requires Direct Labour exclusion.",
        );
      }
      if (values.production_overhead_scope !== "EXCLUDE_OTHER_POOL") {
        errors.push(
          "Excluded Cost Centre or other-pool step scope requires Production Overhead exclusion.",
        );
      }
    }

    if (activity && centre) {
      const compatibility = classifyPrmActivityCostCentreCompatibility(
        activity,
        centre,
      );
      if (
        requiresPrmActivityCostCentreAcknowledgement(compatibility) &&
        !compatibilityAcknowledged
      ) {
        errors.push(
          "Confirm that the selected Cost Centre is appropriate for the Activity location.",
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Operator-facing location field — never raw catalogue ids. */
export function formatPrmActivityLocationFieldLabel(value) {
  if (value == null || value === "") return "—";
  return String(value);
}

export function validatePrmActivityLocationCatalogueIntegrity(
  activity = {},
  catalogues = {},
) {
  const errors = [];
  const activityId = normalizePrmIntegerId(activity.activity_id ?? activity.id);
  if (activityId == null) {
    return { ok: false, errors: ["Activity is required."], activity: null };
  }
  const enriched = buildPrmMasterOptionsForStepAuthoring(catalogues);
  const full =
    coercePrmList(enriched.activities).find(
      (row) => normalizePrmIntegerId(row.activity_id ?? row.id) === activityId,
    ) ||
    enrichPrmMasterActivities({ ...enriched, activities: [activity] })[0] ||
    null;
  if (!full) {
    return {
      ok: false,
      errors: ["Selected Activity is unavailable. Reload master options."],
      activity: null,
    };
  }
  const sectionId = normalizePrmIntegerId(full.section_id);
  const subsectionId = normalizePrmIntegerId(full.subsection_id);
  const areaId = normalizePrmIntegerId(full.area_id);
  if (sectionId != null && isBlankPrmValue(full.section_name)) {
    errors.push(
      "Activity section location could not be resolved from master catalogues.",
    );
  }
  if (subsectionId != null && isBlankPrmValue(full.subsection_name)) {
    errors.push(
      "Activity subsection location could not be resolved from master catalogues.",
    );
  }
  if (areaId != null && full.area_name == null) {
    errors.push(
      "Activity area location could not be resolved from master catalogues.",
    );
  }
  return { ok: errors.length === 0, errors, activity: full };
}

export function validatePrmFamilyStepMasterIntegrity(
  values = {},
  {
    options = {},
    existingSteps = [],
    excludeStepId = null,
    isPersistedStep = false,
  } = {},
) {
  const errors = [];
  const enriched = buildPrmMasterOptionsForStepAuthoring(options);
  const activities = enriched.activities || [];
  const centres = extractApprovedCostCentres(enriched);
  const behaviours = enriched.behaviours || [];
  const resources = enriched.resource_classes || [];

  const findActivity = (id) =>
    activities.find(
      (row) => normalizePrmIntegerId(row.activity_id ?? row.id) === id,
    ) || null;
  const findCentre = (id) =>
    centres.find(
      (row) => normalizePrmIntegerId(row.cost_centre_id ?? row.id) === id,
    ) || null;

  const activityId = normalizePrmIntegerId(values.activity_id);
  if (!activityId) {
    errors.push("Activity is required.");
  }
  const activityRow = findActivity(activityId);
  const locationCheck = validatePrmActivityLocationCatalogueIntegrity(
    activityRow || { activity_id: activityId },
    enriched,
  );
  if (!activityRow) {
    errors.push("Selected Activity is unavailable. Reload master options.");
  } else if (!locationCheck.ok) {
    errors.push(...locationCheck.errors);
  } else if (
    normalizePrmIntegerId(values.section_id) !==
      normalizePrmIntegerId(activityRow.section_id) ||
    normalizePrmIntegerId(values.subsection_id) !==
      normalizePrmIntegerId(activityRow.subsection_id) ||
    normalizePrmIntegerId(values.area_id) !==
      normalizePrmIntegerId(activityRow.area_id)
  ) {
    errors.push(
      "Activity location no longer matches the selected Activity. Reselect Activity.",
    );
  }

  const ccId = normalizePrmIntegerId(values.cost_centre_id);
  if (!ccId) {
    errors.push("Cost Centre is required.");
  }
  const centre = findCentre(ccId);
  if (!centre) {
    errors.push(
      "Selected Cost Centre is not approved or is unavailable. Choose another centre.",
    );
  }

  const stepKeyCheck = validatePrmFamilyRouteStepKey(values.step_key);
  if (!stepKeyCheck.ok) {
    errors.push(stepKeyCheck.error);
  } else {
    values.step_key = stepKeyCheck.canonical;
    const taken = collectPrmFamilyRouteStepKeys({
      steps: existingSteps,
      excludeStepId,
    });
    const want = String(values.step_key || "").trim().toUpperCase();
    if (want && taken.has(want)) {
      errors.push("Step key must be unique within this route version.");
    }
  }

  if (values.sequence_no == null || values.sequence_no <= 0) {
    errors.push("Sequence must be a positive number.");
  }
  if (
    values.expected_occurrence_count == null ||
    values.expected_occurrence_count <= 0
  ) {
    errors.push("Expected occurrence count must be greater than 0.");
  }
  if (values.standard_cycle_count == null || values.standard_cycle_count <= 0) {
    errors.push("Standard cycle count must be greater than 0.");
  }

  if (!values.behaviour_code) {
    errors.push("Behaviour is required.");
  } else {
    const behaviourOk = coercePrmList(behaviours).some(
      (row) =>
        normalizePrmCode(row.behaviour_code || row.code) ===
        normalizePrmCode(values.behaviour_code),
    );
    if (!behaviourOk) {
      errors.push("Selected Behaviour is no longer available.");
    }
  }

  if (!values.resource_class_code) {
    errors.push("Resource class is required.");
  } else {
    const resourceOk = coercePrmList(resources).some(
      (row) =>
        normalizePrmCode(row.resource_class_code || row.code) ===
        normalizePrmCode(values.resource_class_code),
    );
    if (!resourceOk) {
      errors.push("Selected Resource class is no longer available.");
    }
  }

  if (!values.route_step_scope) {
    errors.push("Route step scope is required.");
  } else if (!PRM_ROUTE_STEP_SCOPES.includes(values.route_step_scope)) {
    errors.push("Selected Route step scope is no longer available.");
  }

  if (!values.direct_labour_scope) {
    errors.push("Direct Labour scope is required.");
  } else if (!PRM_DIRECT_LABOUR_SCOPES.includes(values.direct_labour_scope)) {
    errors.push("Selected Direct Labour scope is no longer available.");
  }

  if (!values.production_overhead_scope) {
    errors.push("Production Overhead scope is required.");
  } else if (
    !PRM_PRODUCTION_OVERHEAD_SCOPES.includes(values.production_overhead_scope)
  ) {
    errors.push("Selected Production Overhead scope is no longer available.");
  }

  const poolRule = resolvePrmPoolScopeDlPohRequirement({
    costCentre: centre,
    routeStepScope: values.route_step_scope,
  });
  if (poolRule?.forced) {
    if (values.direct_labour_scope !== "EXCLUDE_OTHER_POOL") {
      errors.push(
        "Excluded Cost Centre or other-pool step scope requires Direct Labour exclusion.",
      );
    }
    if (values.production_overhead_scope !== "EXCLUDE_OTHER_POOL") {
      errors.push(
        "Excluded Cost Centre or other-pool step scope requires Production Overhead exclusion.",
      );
    }
  }

  if (values.plant_id != null && activityRow) {
    const plants = filterPrmPlantsByLocation(enriched.plants || [], {
      section_id: values.section_id,
      subsection_id: values.subsection_id,
      area_id: values.area_id,
    });
    const plantOk = plants.some(
      (row) =>
        normalizePrmIntegerId(row.plant_id ?? row.id) ===
        normalizePrmIntegerId(values.plant_id),
    );
    if (!plantOk) {
      errors.push("Selected Plant is not valid for the Activity location.");
    }
  }

  return { ok: errors.length === 0, errors };
}

export function formatPrmStepSourceLabel(code) {
  return labelFromPrmMap(code, SOURCE_LABELS);
}

export function formatPrmRouteStatusLabel(code) {
  return labelFromPrmMap(code, ROUTE_STATUS_LABELS);
}

export function formatPrmActionLabel(actionId) {
  const id = String(actionId || "").trim();
  if (Object.prototype.hasOwnProperty.call(PRM_ACTION_LABELS, id)) {
    return PRM_ACTION_LABELS[id];
  }
  return humanizeUnknownPrmCode(id) || id;
}

/**
 * Full commercial hierarchy label.
 * Category → Subcategory → Product Group → Subgroup → Product
 */
export function formatPrmCommercialHierarchyLabel(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const parts = [
    r.category_name || r.category || r.category_label,
    r.subcategory_name ||
      r.sub_category_name ||
      r.subcategory ||
      r.division_name ||
      r.segment_name,
    r.product_group_name || r.group_name || r.product_group,
    r.subgroup_name || r.sub_group_name || r.subgroup,
    r.product_name || r.item || r.product,
  ]
    .map((part) => (isBlankPrmValue(part) ? "" : String(part).trim()))
    .filter(Boolean);
  return parts.length ? parts.join(" › ") : "";
}

/**
 * Product Group mapping selector label: Category › Subcategory › Product Group.
 * Product Group ID is returned separately as metadata — never inferred by name.
 */
export function formatPrmProductGroupHierarchyLabel(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const parts = [
    r.category_name || r.category || r.category_label,
    r.subcategory_name ||
      r.sub_category_name ||
      r.subcategory ||
      r.division_name ||
      r.segment_name,
    r.product_group_name || r.group_name || r.product_group,
  ]
    .map((part) => (isBlankPrmValue(part) ? "" : String(part).trim()))
    .filter(Boolean);
  return parts.length ? parts.join(" › ") : "";
}

/**
 * Build governed Product Group mapping selector options from master-options.
 * Does not preselect by name match.
 */
export function buildPrmProductGroupMappingOptions(groups = []) {
  return coercePrmList(groups)
    .map((group) => {
      const product_group_id = normalizePrmIntegerId(
        group.product_group_id ?? group.id,
      );
      if (product_group_id == null) return null;
      const label =
        formatPrmProductGroupHierarchyLabel(group) ||
        `Product Group ${product_group_id}`;
      return {
        product_group_id,
        label,
        secondary: `ID ${product_group_id}`,
      };
    })
    .filter(Boolean);
}

/**
 * Build governed Product Subgroup mapping selector options from master-options.
 * Primary: Subgroup name. Secondary: hierarchy / Product Group. Ids are search metadata only.
 */
export function buildPrmProductSubgroupMappingOptions(subgroups = []) {
  return coercePrmList(subgroups)
    .map((row) => {
      const product_subgroup_id = normalizePrmIntegerId(
        row.product_subgroup_id ?? row.subgroup_id ?? row.id,
      );
      if (product_subgroup_id == null) return null;
      const name =
        row.product_subgroup_name ||
        row.subgroup_name ||
        row.name ||
        `Product Subgroup ${product_subgroup_id}`;
      const groupName = row.product_group_name || "";
      const hierarchy =
        row.hierarchy_label ||
        formatPrmProductGroupHierarchyLabel(row) ||
        [row.category_name, row.subcategory_name, groupName, name]
          .filter((part) => !isBlankPrmValue(part))
          .join(" › ");
      const secondary = hierarchy && hierarchy !== name ? hierarchy : groupName;
      const search = [name, groupName, hierarchy, String(product_subgroup_id)]
        .filter(Boolean)
        .join(" ");
      return {
        product_subgroup_id,
        product_group_id: normalizePrmIntegerId(row.product_group_id),
        label: name,
        secondary,
        search,
      };
    })
    .filter(Boolean);
}

export function buildPrmSubgroupMappingsArgs({
  status = null,
  search = null,
  route_family_id = null,
  product_group_id = null,
  product_subgroup_id = null,
  limit = 50,
  offset = 0,
} = {}) {
  const params = {
    p_limit: Math.max(1, Math.min(Number(limit) || 50, 200)),
    p_offset: Math.max(0, Number(offset) || 0),
  };
  const q = isBlankPrmValue(search) ? "" : String(search).trim();
  if (q) params.p_search = q;
  const st = isBlankPrmValue(status) ? "" : String(status).trim();
  if (st) params.p_status = st;
  const familyId = normalizePrmIntegerId(route_family_id);
  if (familyId != null) params.p_route_family_id = familyId;
  const groupId = normalizePrmIntegerId(product_group_id);
  if (groupId != null) params.p_product_group_id = groupId;
  const subgroupId = normalizePrmIntegerId(product_subgroup_id);
  if (subgroupId != null) params.p_product_subgroup_id = subgroupId;
  return { ok: true, params, errors: [] };
}

export function normalizePrmProductSubgroupMapping(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const id = normalizePrmIntegerId(
    r.mapping_id ?? r.id ?? r.product_subgroup_route_family_mapping_id,
  );
  return {
    ...r,
    mapping_id: id,
    id,
    status: normalizePrmCode(r.status || r.mapping_status).toUpperCase() || null,
    mapping_status: r.mapping_status || r.status || null,
    route_family_id: normalizePrmIntegerId(r.route_family_id),
    route_family_code: r.route_family_code ?? null,
    route_family_name: r.route_family_name ?? null,
    product_subgroup_id: normalizePrmIntegerId(
      r.product_subgroup_id ?? r.subgroup_id,
    ),
    product_subgroup_name:
      r.product_subgroup_name || r.subgroup_name || r.name || null,
    product_group_id: normalizePrmIntegerId(r.product_group_id),
    product_group_name: r.product_group_name ?? null,
    sub_category_id: normalizePrmIntegerId(r.sub_category_id),
    subcategory_name: r.subcategory_name ?? r.sub_category_name ?? null,
    category_id: normalizePrmIntegerId(r.category_id),
    category_name: r.category_name ?? null,
    hierarchy_label: r.hierarchy_label ?? null,
    mapping_basis: r.mapping_basis ?? null,
    mapping_note: r.mapping_note ?? null,
    effective_from: r.effective_from ?? null,
    effective_to: r.effective_to ?? null,
    approval_reference: r.approval_reference ?? null,
    approved_by: r.approved_by ?? null,
    approved_at: r.approved_at ?? null,
    supersedes_mapping_id: normalizePrmIntegerId(r.supersedes_mapping_id),
    lifecycle_actions: normalizePrmAssignmentLifecycleActions(
      r.lifecycle_actions,
    ),
    definition_read_only: Boolean(r.definition_read_only),
  };
}

export function normalizePrmSubgroupMappingsPayload(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const rows = coercePrmList(
    root.rows || root.mappings || root.items || root.data || root,
  ).map(normalizePrmProductSubgroupMapping);
  const total =
    root.total_count ??
    root.total ??
    root.count ??
    (Array.isArray(root.rows) || Array.isArray(root.mappings)
      ? rows.length
      : null);
  return {
    rows,
    total_count: total == null ? rows.length : Number(total) || 0,
    status_counts: normalizePrmStatusCounts(
      root.status_counts || root.counts || {},
    ),
    raw: root,
  };
}

export function findPrmApprovedSubgroupMapping(
  mappings = [],
  productSubgroupId,
) {
  const sid = normalizePrmIntegerId(productSubgroupId);
  if (sid == null) return null;
  return (
    coercePrmList(mappings).find((row) => {
      const mapped = normalizePrmProductSubgroupMapping(row);
      return (
        mapped.product_subgroup_id === sid &&
        normalizePrmCode(mapped.status).toUpperCase() === "APPROVED"
      );
    }) || null
  );
}

export function findPrmWritableSubgroupMapping(
  mappings = [],
  productSubgroupId,
) {
  const sid = normalizePrmIntegerId(productSubgroupId);
  if (sid == null) return null;
  return (
    coercePrmList(mappings).find((row) => {
      const mapped = normalizePrmProductSubgroupMapping(row);
      const status = normalizePrmCode(mapped.status).toUpperCase();
      return (
        mapped.product_subgroup_id === sid &&
        (status === "DRAFT" || status === "IN_REVIEW")
      );
    }) || null
  );
}

export function buildPrmArchivedRoutesArgs({
  search = null,
  entity_type = null,
  limit = 50,
  offset = 0,
} = {}) {
  const params = {
    p_limit: Math.max(1, Math.min(Number(limit) || 50, 200)),
    p_offset: Math.max(0, Number(offset) || 0),
  };
  const q = isBlankPrmValue(search) ? "" : String(search).trim();
  if (q) params.p_search = q;
  const entity = normalizePrmCode(entity_type).toUpperCase();
  if (entity && PRM_ARCHIVED_ENTITY_TYPES.includes(entity)) {
    params.p_entity_type = entity;
  }
  return { ok: true, params, errors: [] };
}

export function formatPrmArchivedEntityTypeLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (!upper) return "Archived";
  if (Object.prototype.hasOwnProperty.call(PRM_ARCHIVED_ENTITY_TYPE_LABELS, upper)) {
    return PRM_ARCHIVED_ENTITY_TYPE_LABELS[upper];
  }
  return humanizeUnknownPrmCode(upper) || upper;
}

export function normalizePrmArchivedRouteRow(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const entityType = normalizePrmCode(
    r.entity_type || r.archived_entity_type || r.type,
  ).toUpperCase();
  return {
    ...r,
    entity_type: entityType || null,
    entity_id: normalizePrmIntegerId(
      r.entity_id ?? r.id ?? r.archived_entity_id,
    ),
    name:
      r.name ||
      r.entity_name ||
      r.route_family_name ||
      r.route_name ||
      r.product_name ||
      r.product_subgroup_name ||
      r.product_group_name ||
      null,
    code: r.code || r.route_family_code || r.entity_code || null,
    parent_name:
      r.parent_name ||
      r.route_family_name ||
      r.parent_route_family_name ||
      r.base_family_route_name ||
      null,
    route_family_id: normalizePrmIntegerId(r.route_family_id),
    route_family_name: r.route_family_name ?? null,
    original_status: normalizePrmCode(
      r.original_status || r.status || r.lifecycle_status,
    ).toUpperCase() || null,
    status: normalizePrmCode(r.status || r.original_status).toUpperCase() || null,
    effective_from: r.effective_from ?? null,
    effective_to: r.effective_to ?? null,
    approval_reference: r.approval_reference ?? null,
    approved_at: r.approved_at ?? null,
    archived_at: r.archived_at ?? null,
    archived_by: r.archived_by ?? null,
    archive_reason: r.archive_reason ?? null,
    route_version: r.route_version ?? r.version_label ?? r.version ?? null,
    source_type: r.source_type ?? null,
    family_route_step_count:
      r.family_route_step_count ?? r.step_count ?? r.steps_count ?? null,
    product_route_override_count:
      r.product_route_override_count ?? r.override_count ?? null,
    product_id: normalizePrmIntegerId(r.product_id),
    product_name: r.product_name ?? null,
    product_group_id: normalizePrmIntegerId(r.product_group_id),
    product_group_name: r.product_group_name ?? null,
    product_subgroup_id: normalizePrmIntegerId(r.product_subgroup_id),
    product_subgroup_name: r.product_subgroup_name ?? null,
    family_route_id: normalizePrmIntegerId(
      r.family_route_id ?? r.base_route_family_route_id,
    ),
    product_route_id: normalizePrmIntegerId(r.product_route_id),
    mapping_id: normalizePrmIntegerId(r.mapping_id),
    mapping_basis: r.mapping_basis ?? null,
    read_only: true,
  };
}

export function normalizePrmArchivedRoutesPayload(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const rows = coercePrmList(
    root.rows || root.items || root.archived || root.data || root,
  ).map(normalizePrmArchivedRouteRow);
  const total =
    root.total_count ??
    root.total ??
    root.count ??
    (Array.isArray(root.rows) || Array.isArray(root.items)
      ? rows.length
      : null);
  return {
    rows,
    total_count: total == null ? rows.length : Number(total) || 0,
    raw: root,
  };
}

export function formatPrmArchivedEffectivePeriod(row = {}) {
  const from = row.effective_from || "";
  const to = isBlankPrmValue(row.effective_to) ? "Current" : row.effective_to;
  if (!from && isBlankPrmValue(row.effective_to)) return "";
  if (!from) return String(to);
  return `${from} → ${to}`;
}

export function classifyPrmUiNotice(kind) {
  const k = String(kind || "").toLowerCase();
  if (k === "error" || k === "rpc_error") return "error";
  if (k === "setup") return "setup";
  if (k === "selection") return "selection";
  return "empty";
}

export function isProductionRouteLens(lensId) {
  return PRODUCTION_ROUTE_LENS_IDS.includes(String(lensId || "").trim());
}

export function isObsoletePrmLens(lensId) {
  return OBSOLETE_PRM_LENS_IDS.includes(String(lensId || "").trim());
}

/**
 * Fresh launch / stale lens / invalid editor deep-link resolution.
 */
export function isPrmProductRouteEditorCreateContext({
  product_id = null,
  product_route_id = null,
} = {}) {
  return (
    normalizePrmIntegerId(product_id) != null &&
    normalizePrmIntegerId(product_route_id) == null
  );
}

/**
 * Product Route history row id: product_route_id ?? route_id ?? id.
 * Display placeholders such as "—" must not be treated as ids.
 */
export function resolvePrmProductHistoryRouteId(row = {}) {
  return (
    normalizePrmIntegerId(row?.product_route_id) ??
    normalizePrmIntegerId(row?.route_id) ??
    normalizePrmIntegerId(row?.id)
  );
}

/** Current writable Product Route: DRAFT or REVIEW. Not APPROVED/SUPERSEDED/INACTIVE. */
export function isPrmCurrentProductRouteStatus(status) {
  return isPrmRouteWritableStatus(status);
}

export function selectPrmCurrentProductHistoryRoutes(versions = []) {
  return coercePrmList(versions).filter((row) =>
    isPrmCurrentProductRouteStatus(
      row?.status || row?.route_status || row?.approval_status,
    ),
  );
}

/**
 * Open vs Create eligibility for Product Summary.
 * 1. effective.product_route_id (row.product_route_id)
 * 2. unique current DRAFT / REVIEW from Product history
 * 3. opening-row draft_product_route_id
 * Multiple current writable routes: do not guess.
 */
export function resolvePrmOpenProductRouteEligibility(
  row = {},
  historyVersions = [],
) {
  const effectiveId = normalizePrmIntegerId(row?.product_route_id);
  const rowDraftId = normalizePrmIntegerId(row?.draft_product_route_id);
  const currentIds = [];
  const seen = new Set();
  for (const current of selectPrmCurrentProductHistoryRoutes(historyVersions)) {
    const id = resolvePrmProductHistoryRouteId(current);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    currentIds.push(id);
  }
  const ambiguous = effectiveId == null && currentIds.length > 1;
  const historyCurrentId = currentIds.length === 1 ? currentIds[0] : null;
  return {
    open_product_route_id: ambiguous
      ? null
      : (effectiveId ?? historyCurrentId ?? rowDraftId),
    current_product_route_ambiguous: ambiguous,
    current_product_route_ids: currentIds,
    current_count: currentIds.length,
  };
}

/** Base Family Route copy for Product history when the payload supplies it. */
export function formatPrmProductHistoryBaseFamilyRoute(row = {}) {
  const name = String(
    row?.family_route_name ||
      row?.base_route_family_route_name ||
      row?.route_family_route_name ||
      row?.base_family_route_name ||
      "",
  ).trim();
  const versionLabel = String(
    row?.family_route_version ||
      row?.base_route_version ||
      row?.base_family_route_version ||
      "",
  ).trim();
  if (name && versionLabel) return `${name} ${versionLabel}`;
  if (name) return name;
  if (versionLabel) return versionLabel;
  const id =
    normalizePrmIntegerId(row?.family_route_id) ??
    normalizePrmIntegerId(row?.base_route_family_route_id) ??
    normalizePrmIntegerId(row?.base_family_route_id);
  return id != null ? String(id) : "";
}

export function resolveProductionRouteLens(
  lensId,
  {
    family_route_id = null,
    product_route_id = null,
    product_id = null,
    allowEditorWithoutId = false,
  } = {},
) {
  const raw = String(lensId || "").trim();
  if (!raw || isObsoletePrmLens(raw) || !isProductionRouteLens(raw)) {
    return PRODUCTION_ROUTE_DEFAULT_LENS;
  }
  // Intentional no-context Family / Product Route Editor entry (tab click).
  // Malformed deep links without this flag still fall back to readiness for Family.
  if (
    allowEditorWithoutId === true &&
    (raw === "route-family-route-editor" || raw === "product-route-editor")
  ) {
    return raw;
  }
  if (!allowEditorWithoutId) {
    if (
      raw === "route-family-route-editor" &&
      normalizePrmIntegerId(family_route_id) == null
    ) {
      return PRODUCTION_ROUTE_DEFAULT_LENS;
    }
    if (
      raw === "product-route-editor" &&
      normalizePrmIntegerId(product_route_id) == null &&
      normalizePrmIntegerId(product_id) == null
    ) {
      return PRODUCTION_ROUTE_DEFAULT_LENS;
    }
  }
  return raw;
}

export function isPrmRouteWritableStatus(status) {
  const upper = normalizePrmCode(status).toUpperCase();
  return PRM_ROUTE_WRITE_STATUSES.includes(upper);
}

export function isPrmRouteReviewStatus(status) {
  const upper = normalizePrmCode(status).toUpperCase();
  return PRM_ROUTE_REVIEW_STATUSES.includes(upper);
}

export function isPrmRouteCloneableStatus(status) {
  const upper = normalizePrmCode(status).toUpperCase();
  return PRM_ROUTE_CLONEABLE_STATUSES.includes(upper);
}

/** Canonical display/gate bucket for review (never sent to server). */
export function canonicalPrmRouteStatus(status) {
  const upper = normalizePrmCode(status).toUpperCase();
  if (isPrmRouteReviewStatus(upper)) return "REVIEW_REQUIRED";
  return upper;
}

export function isPrmRouteReadOnlyStatus(status) {
  const upper = normalizePrmCode(status).toUpperCase();
  if (!upper) return false;
  if (PRM_ROUTE_READONLY_STATUSES.includes(upper)) return true;
  return !isPrmRouteWritableStatus(upper) && upper === "APPROVED";
}

export function formatPrmRouteEvidenceStatusLabel(code) {
  return labelFromPrmMap(code, EVIDENCE_STATUS_LABELS);
}

export function formatPrmRouteSourceTypeLabel(code) {
  return labelFromPrmMap(code, SOURCE_LABELS);
}

export function isWipHoldKind(code) {
  return WIP_HOLD_KINDS.includes(normalizePrmCode(code).toUpperCase());
}

export function isRouteBoundaryKind(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  return (
    upper.includes("RM_ISSUE") ||
    upper.includes("FG_TRANSFER") ||
    upper === "RM_ISSUE_BOUNDARY" ||
    upper === "FG_TRANSFER_BOUNDARY"
  );
}

export function normalizePrmRpcPayload(data) {
  if (data == null) return null;
  if (Array.isArray(data)) {
    if (!data.length) return null;
    const first = data[0];
    return first && typeof first === "object" ? first : null;
  }
  if (typeof data === "object") return data;
  return null;
}

export function coercePrmList(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === "object");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value.trim());
      return coercePrmList(parsed);
    } catch {
      return [];
    }
  }
  if (typeof value === "object") {
    for (const key of [
      "rows",
      "items",
      "options",
      "steps",
      "overrides",
      "versions",
      "issues",
      "products",
      "groups",
      "route_families",
      "route_family_mappings",
      "approved_route_family_routes",
      "mappings",
      "family_steps",
      "candidate_steps",
      "delta_candidates",
    ]) {
      if (Array.isArray(value[key])) return coercePrmList(value[key]);
    }
  }
  return [];
}

export function unwrapPrmReadinessRpcResult(data) {
  if (data == null) return { rows: [], total_count: 0 };
  if (Array.isArray(data)) {
    const rows = [];
    let total_count = 0;
    let sawTotal = false;
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      if (item.row_data != null) {
        const nested = coercePrmList(
          Array.isArray(item.row_data) ? item.row_data : [item.row_data],
        );
        if (nested.length) rows.push(...nested);
        else if (typeof item.row_data === "object") rows.push(item.row_data);
      } else if (
        item.product_id != null ||
        item.readiness_status != null ||
        item.product_name != null
      ) {
        rows.push(item);
      }
      if (item.total_count != null && item.total_count !== "") {
        const n = Number(item.total_count);
        if (Number.isFinite(n)) {
          total_count = n;
          sawTotal = true;
        }
      }
    }
    if (!sawTotal) total_count = rows.length;
    return { rows, total_count };
  }
  if (typeof data === "object") {
    const rows = coercePrmList(
      data.rows || data.items || data.readiness_rows || data,
    );
    const total =
      data.total_count != null ? Number(data.total_count) : rows.length;
    return {
      rows,
      total_count: Number.isFinite(total) ? total : rows.length,
    };
  }
  return { rows: [], total_count: 0 };
}

export function pageToPrmOffset(page, pageSize = 25) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || 25);
  return (p - 1) * size;
}

export function prmTotalPages(totalCount, pageSize = 25) {
  const total = Math.max(0, Number(totalCount) || 0);
  const size = Math.max(1, Number(pageSize) || 25);
  return total === 0 ? 1 : Math.ceil(total / size);
}

export function clampPrmPagination({
  offset = 0,
  limit = 25,
  total_count = 0,
} = {}) {
  const lim = Math.max(1, Number(limit) || 25);
  const total = Math.max(0, Number(total_count) || 0);
  const totalPages = total === 0 ? 1 : Math.ceil(total / lim);
  let off = Math.max(0, Number(offset) || 0);
  if (total > 0 && off >= total) off = (totalPages - 1) * lim;
  return {
    offset: off,
    pageIndex: Math.floor(off / lim),
    totalPages,
    limit: lim,
    total_count: total,
  };
}

export const PRM_COST_CENTRE_TYPES = Object.freeze([
  "EQUIPMENT_CENTRED",
  "PROCESS_AREA_CENTRED",
  "SERVICE_CENTRED",
]);

export const PRM_COST_CENTRE_POOL_SCOPES = Object.freeze([
  "PRODUCTION_OVERHEAD",
  "DIRECT_LABOUR",
  "SHARED_ROUTE",
  "EXCLUDED_OTHER_POOL",
]);

export const PRM_COST_CENTRE_STATUSES = Object.freeze([
  "DRAFT",
  "APPROVED",
  "INACTIVE",
]);

/** Proven Plant/Machinery status labels from plants.js master UI (O/N). */
export const PRM_PLANT_MACHINERY_STATUS_LABELS = Object.freeze({
  O: "Operational",
  N: "Non-operational",
});

export function formatPrmCostCentrePoolScopeLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (upper === "PRODUCTION_OVERHEAD") return "Production overhead";
  if (upper === "DIRECT_LABOUR") return "Direct labour";
  if (upper === PRM_COST_CENTRE_POOL_SHARED) {
    return "Shared route (DL/POH allocation pool)";
  }
  if (upper === PRM_COST_CENTRE_POOL_EXCLUDED) {
    return "Excluded other pool (boundary / non-DL-POH allocation)";
  }
  return humanizeUnknownPrmCode(upper) || "—";
}

export function formatPrmCostCentreTypeLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (upper === "EQUIPMENT_CENTRED") return "Equipment-centred";
  if (upper === "PROCESS_AREA_CENTRED") return "Process-area-centred";
  if (upper === "SERVICE_CENTRED") return "Service-centred";
  return humanizeUnknownPrmCode(upper) || "—";
}

export function formatPrmPlantMachineryStatusLabel(status) {
  const raw = String(status ?? "").trim();
  if (!raw) return "—";
  const upper = raw.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(PRM_PLANT_MACHINERY_STATUS_LABELS, upper)) {
    return PRM_PLANT_MACHINERY_STATUS_LABELS[upper];
  }
  return raw;
}

/**
 * UX assistance only — mirrors proven server validation contract.
 * Server validation remains authoritative.
 */
export function getPrmCostCentreLocationRequirements(costCentreType) {
  const upper = normalizePrmCode(costCentreType).toUpperCase();
  return {
    areaRequired:
      upper === "EQUIPMENT_CENTRED" || upper === "PROCESS_AREA_CENTRED",
    plantRequired: upper === "EQUIPMENT_CENTRED",
  };
}

export function formatPrmResourceClassLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (!upper) return "—";
  return humanizeUnknownPrmCode(upper) || upper;
}

export function normalizePrmResourceClassCatalogueRow(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const resource_class_code =
    normalizePrmCode(r.resource_class_code || r.code).toUpperCase() || null;
  const governedLabel = firstNonBlankPrmText(
    r.resource_class_label,
    r.label,
  );
  const resource_class_label = isBlankPrmValue(governedLabel)
    ? null
    : String(governedLabel);
  return {
    ...r,
    resource_class_code,
    resource_class_label,
    resolved: !!resource_class_code && resource_class_label != null,
  };
}

export function buildPrmResourceClassLabelIndex(catalogue = []) {
  const index = new Map();
  for (const row of coercePrmList(catalogue)) {
    const normalized = normalizePrmResourceClassCatalogueRow(row);
    if (
      normalized.resource_class_code &&
      !isBlankPrmValue(normalized.resource_class_label)
    ) {
      index.set(normalized.resource_class_code, normalized.resource_class_label);
    }
  }
  return index;
}

export function resolvePrmResourceClassDisplayLabel(
  code,
  { catalogue = null, catalogueIndex = null, rowLabel = null } = {},
) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (!upper) return "—";
  const index =
    catalogueIndex ||
    (catalogue ? buildPrmResourceClassLabelIndex(catalogue) : null);
  if (index?.has(upper)) return index.get(upper);
  if (!isBlankPrmValue(rowLabel)) return String(rowLabel);
  return formatPrmResourceClassLabel(upper);
}

export function enrichPrmMasterResourceClasses(root = {}) {
  const resource_classes = coercePrmList(root.resource_classes).map((row) => {
    const normalized = normalizePrmResourceClassCatalogueRow(row);
    const displayLabel = resolvePrmResourceClassDisplayLabel(
      normalized.resource_class_code,
      { rowLabel: normalized.resource_class_label },
    );
    return {
      ...row,
      resource_class_code: normalized.resource_class_code,
      code: normalized.resource_class_code,
      resource_class_label: normalized.resource_class_label || displayLabel,
      label: normalized.resource_class_label || displayLabel,
    };
  });
  return {
    ...root,
    resource_classes,
  };
}

function isPlaceholderHierarchyPart(value) {
  const text = normalizePrmCode(value);
  if (!text) return true;
  const upper = text.toUpperCase();
  return (
    upper === "-" ||
    upper === "—" ||
    upper === "–" ||
    upper === "NULL" ||
    upper === "NIL" ||
    upper === "NONE" ||
    upper === "N/A"
  );
}

export function formatPrmHierarchyLabel(parts = []) {
  const cleaned = (Array.isArray(parts) ? parts : [parts]).filter(
    (part) => !isPlaceholderHierarchyPart(part),
  );
  return cleaned.join(" › ");
}

export function formatPrmRouteStepLabel(stepKey, fallback = "") {
  const upper = normalizePrmCode(stepKey).toUpperCase();
  if (!upper) return fallback;
  return STEP_LABELS[upper] || humanizeUnknownPrmCode(upper) || fallback || upper;
}

export function normalizePrmCostCentreRow(row = {}, resourceClassContext = {}) {
  const r = row && typeof row === "object" ? row : {};
  const id = normalizePrmIntegerId(r.cost_centre_id ?? r.id);
  const pool_scope = normalizePrmCode(
    r.pool_scope || r.cost_centre_pool_scope || r.pool_scope_code,
  ).toUpperCase();
  const resource_class = normalizePrmCode(
    r.resource_class || r.resource_class_code || r.resource_class_name,
  );
  const hierarchy =
    formatPrmHierarchyLabel([
      r.section_name || r.section,
      r.subsection_name || r.subsection,
      r.area_name || r.area,
      r.plant_name || r.plant,
    ]) ||
    formatPrmCommercialHierarchyLabel(r) ||
    "";
  return {
    ...r,
    cost_centre_id: id,
    id,
    code: r.code || r.cost_centre_code || "",
    name: r.name || r.cost_centre_name || "",
    type: r.type || r.cost_centre_type || r.centre_type || "",
    pool_scope,
    pool_scope_label: formatPrmCostCentrePoolScopeLabel(pool_scope),
    resource_class,
    resource_class_label: resolvePrmResourceClassDisplayLabel(resource_class, {
      catalogue: resourceClassContext.catalogue,
      catalogueIndex: resourceClassContext.catalogueIndex,
      rowLabel: r.resource_class_label,
    }),
    hierarchy,
    status: normalizePrmCode(
      r.status || r.approval_status || r.cost_centre_status,
    ).toUpperCase(),
  };
}

export function extractApprovedCostCentres(optionsPayload) {
  const root =
    optionsPayload?.cost_centres != null
      ? optionsPayload
      : normalizePrmMasterOptions(optionsPayload);
  const rows = coercePrmList(root.cost_centres).map(normalizePrmCostCentreRow);
  if (!rows.length) return [];
  return rows.filter((row) => {
    const status = row.status;
    if (!status) return true;
    return status === "APPROVED" || status === "ACTIVE" || status === "READY";
  });
}

export function hasApprovedCostCentres(optionsPayload) {
  return extractApprovedCostCentres(optionsPayload).length > 0;
}

export function countDefinedPrmCostCentres(optionsPayload) {
  const root =
    optionsPayload?.cost_centres != null
      ? optionsPayload
      : normalizePrmMasterOptions(optionsPayload);
  return coercePrmList(root.cost_centres).length;
}

export function groupPrmApprovedCostCentres(optionsPayload) {
  const approved = extractApprovedCostCentres(optionsPayload);
  const shared = approved.filter(
    (row) => row.pool_scope === PRM_COST_CENTRE_POOL_SHARED,
  );
  const excluded = approved.filter(
    (row) => row.pool_scope === PRM_COST_CENTRE_POOL_EXCLUDED,
  );
  const other = approved.filter(
    (row) =>
      row.pool_scope !== PRM_COST_CENTRE_POOL_SHARED &&
      row.pool_scope !== PRM_COST_CENTRE_POOL_EXCLUDED,
  );
  return { approved, shared, excluded, other };
}

export function summarizePrmCostCentreSetup(optionsPayload) {
  const defined = countDefinedPrmCostCentres(optionsPayload);
  const grouped = groupPrmApprovedCostCentres(optionsPayload);
  const approved = grouped.approved.length;
  const setupRequired = approved === 0;
  return {
    defined,
    approved,
    setupRequired,
    chip: setupRequired
      ? PRM_COST_CENTRE_SETUP_CHIP
      : `Cost centres: ${approved} approved`,
    tooltip: setupRequired
      ? PRM_COST_CENTRE_SETUP_TOOLTIP
      : PRM_COST_CENTRE_POSITIVE_EXPLAIN,
    canProceed: setupRequired
      ? PRM_COST_CENTRE_CAN_PROCEED
      : "Approved Production cost centres are available for governed route steps.",
    remainsBlocked: setupRequired
      ? PRM_COST_CENTRE_REMAINS_BLOCKED
      : "Shared-route and excluded boundary centres are listed for route governance.",
    explain: PRM_COST_CENTRE_POSITIVE_EXPLAIN,
    shared: grouped.shared,
    excluded: grouped.excluded,
    other: grouped.other,
  };
}

/**
 * Chip/modal display gated by master-options hydration status.
 * Inventory summary alone must not treat unhydrated as Setup required.
 */
export function resolvePrmCostCentreSetupChip({
  options = null,
  optionsStatus = "uninitialized",
  optionsError = null,
} = {}) {
  const status = String(optionsStatus || "uninitialized").toLowerCase();
  if (status === "uninitialized" || status === "loading") {
    return {
      defined: null,
      approved: null,
      setupRequired: false,
      chip: PRM_COST_CENTRE_LOADING_CHIP,
      tooltip: PRM_COST_CENTRE_LOADING_TOOLTIP,
      canProceed: PRM_COST_CENTRE_LOADING_TOOLTIP,
      remainsBlocked: PRM_COST_CENTRE_LOADING_TOOLTIP,
      explain: PRM_COST_CENTRE_LOADING_TOOLTIP,
      shared: [],
      excluded: [],
      other: [],
      tone: "loading",
      optionsStatus: status,
    };
  }
  if (status === "error") {
    const tip =
      String(optionsError || "").trim() || PRM_COST_CENTRE_UNAVAILABLE_TOOLTIP;
    return {
      defined: null,
      approved: null,
      setupRequired: false,
      chip: PRM_COST_CENTRE_UNAVAILABLE_CHIP,
      tooltip: tip,
      canProceed: tip,
      remainsBlocked: tip,
      explain: tip,
      shared: [],
      excluded: [],
      other: [],
      tone: "error",
      optionsStatus: "error",
    };
  }
  const summary = summarizePrmCostCentreSetup(options);
  return {
    ...summary,
    tone: summary.setupRequired ? "warn" : "ok",
    optionsStatus: "ready",
  };
}

export function isPrmMasterOptionsReady(optionsStatus) {
  return String(optionsStatus || "").toLowerCase() === "ready";
}

/**
 * Request-scope only. catalogueScope "unscoped" forces null IDs and does not
 * read leftover Product / Product Group / Route Family UI or deep-link state.
 */
export function resolvePrmMasterOptionsRequestScope(filters = {}, context = {}) {
  if (filters?.catalogueScope === "unscoped") {
    return {
      product_id: null,
      product_group_id: null,
      route_family_id: null,
    };
  }
  return {
    product_id:
      filters.product_id ??
      context.selectedProductId ??
      context.deepLink?.product_id ??
      null,
    product_group_id:
      filters.product_group_id ??
      context.product_group_id ??
      context.deepLink?.product_group_id ??
      null,
    route_family_id:
      filters.route_family_id ??
      context.route_family_id ??
      context.deepLink?.route_family_id ??
      null,
  };
}

/** Last-started master-options generation wins at state commit. */
export function shouldAcceptPrmMasterOptionsGeneration(
  requestGeneration,
  currentGeneration,
) {
  return Number(requestGeneration) === Number(currentGeneration);
}

export function normalizePrmMappingBasis(value) {
  const upper = normalizePrmCode(value).toUpperCase();
  if (!upper) return null;
  if (upper === "—" || upper === "-" || upper === "–" || upper === "−") {
    return null;
  }
  return PRM_MAPPING_BASIS_VALUES.includes(upper) ? upper : null;
}

export function resolveDefaultPrmMappingBasis({ fromEvidence = false } = {}) {
  return fromEvidence ? "HISTORICAL_REVIEW" : "MANUAL";
}

export function buildPrmMappingBasisOptionsHtml(selectedValue = "MANUAL") {
  const selected = normalizePrmMappingBasis(selectedValue) || "MANUAL";
  return PRM_MAPPING_BASIS_OPTIONS.map(
    (option) =>
      `<option value="${option.value}"${
        option.value === selected ? " selected" : ""
      }>${option.label}</option>`,
  ).join("");
}

export function isPlaceholderPrmApprovalReference(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return true;
  const upper = raw.toUpperCase();
  if (PRM_APPROVAL_REFERENCE_PLACEHOLDERS.includes(raw)) return true;
  if (PRM_APPROVAL_REFERENCE_PLACEHOLDERS.includes(upper)) return true;
  if (/^[-\u2013\u2014._\s]+$/.test(raw)) return true;
  return false;
}

export function isMeaningfulPrmApprovalReference(value) {
  return !isPlaceholderPrmApprovalReference(value);
}

export function formatPrmApprovalReferenceDate(dateInput = null) {
  const raw = normalizePrmAsOfDate(dateInput, { fallbackToToday: true });
  if (!raw) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  }
  return raw.replace(/-/g, "");
}

export function sanitizePrmApprovalReferenceToken(value, fallback = "X") {
  const token = normalizePrmCode(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return token || fallback;
}

export function buildPrmFamilyApprovalReferenceTemplate(
  familyCode,
  dateInput = null,
) {
  const built = buildPrmRouteFamilyApprovalReference({
    routeFamilyCode: familyCode,
    approvalDate: dateInput,
  });
  if (built.ok) return built.reference;
  const code = sanitizePrmApprovalReferenceToken(familyCode, "FAMILY");
  const ymd = formatPrmApprovalReferenceDate(dateInput);
  return `PRM-RF-${code}-APP-${ymd}`;
}

export const PRM_ROUTE_FAMILY_APPROVAL_REFERENCE_RE =
  /^PRM-RF-[A-Z][A-Z0-9_]*-APP-[0-9]{8}$/;

export const PRM_ROUTE_FAMILY_APPROVAL_REFERENCE_HELPER_TEXT =
  "Generated from Route Family identity and approval date.";

/**
 * Canonical Route Family approval reference.
 * APP date is the approval-event local/business date (getPrmLocalIsoDate),
 * not effective_from and not the PRM as-of filter.
 */
export function resolvePrmRouteFamilyApprovalIdentity({ detail = {} } = {}) {
  const raw = normalizePrmCode(
    detail?.route_family_code ?? detail?.family_code ?? detail?.code ?? "",
  );
  const routeFamilyCode = raw ? raw.toUpperCase() : "";
  if (!routeFamilyCode) {
    return {
      ok: false,
      reason: "missing_route_family_code",
      error: "Route Family code is required to generate the approval reference.",
    };
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(routeFamilyCode)) {
    return {
      ok: false,
      reason: "invalid_route_family_code",
      error: "Route Family code is invalid for the approval reference.",
    };
  }
  return { ok: true, routeFamilyCode };
}

export function buildPrmRouteFamilyApprovalReference({
  routeFamilyCode = null,
  approvalDate = null,
} = {}) {
  const identity = resolvePrmRouteFamilyApprovalIdentity({
    detail: { route_family_code: routeFamilyCode },
  });
  if (!identity.ok) return identity;
  const iso = isBlankPrmValue(approvalDate)
    ? getPrmLocalIsoDate()
    : normalizePrmAsOfDate(approvalDate, { fallbackToToday: false });
  if (!iso) {
    return {
      ok: false,
      reason: "invalid_approval_date",
      error: "Approval date is required to generate the approval reference.",
    };
  }
  const approvalYmd = iso.replace(/-/g, "");
  if (!/^[0-9]{8}$/.test(approvalYmd)) {
    return {
      ok: false,
      reason: "invalid_approval_date",
      error: "Approval date is required to generate the approval reference.",
    };
  }
  const reference = `PRM-RF-${identity.routeFamilyCode}-APP-${approvalYmd}`;
  return {
    ok: true,
    reference,
    routeFamilyCode: identity.routeFamilyCode,
    approvalYmd,
  };
}

export function validatePrmRouteFamilyApprovalReference(
  reference,
  { routeFamilyCode = null, approvalDate = null } = {},
) {
  const expected = buildPrmRouteFamilyApprovalReference({
    routeFamilyCode,
    approvalDate,
  });
  if (!expected.ok) return expected;
  const raw = String(reference ?? "").trim();
  if (!PRM_ROUTE_FAMILY_APPROVAL_REFERENCE_RE.test(raw)) {
    return {
      ok: false,
      reason: "invalid_format",
      error: "Approval reference is not the canonical Route Family format.",
    };
  }
  if (raw !== expected.reference) {
    return {
      ok: false,
      reason: "reference_mismatch",
      error:
        "Approval reference does not match the canonical Route Family reference.",
    };
  }
  return {
    ok: true,
    reference: expected.reference,
    routeFamilyCode: expected.routeFamilyCode,
    approvalYmd: expected.approvalYmd,
  };
}

export function buildPrmMappingApprovalReferenceTemplate(
  familyCode,
  productGroupId,
  dateInput = null,
) {
  const code = sanitizePrmApprovalReferenceToken(familyCode, "FAMILY");
  const pg = normalizePrmIntegerId(productGroupId);
  const pgToken = pg == null ? "PG" : `PG${pg}`;
  const ymd = formatPrmApprovalReferenceDate(dateInput);
  return `PRM-MAP-${code}-${pgToken}-APP-${ymd}`;
}

export const PRM_PRODUCT_SUBGROUP_MAPPING_APPROVAL_REFERENCE_RE =
  /^PRM-MAP-[A-Z][A-Z0-9_]*-SG[1-9][0-9]*-APP-[0-9]{8}$/;

export const PRM_PRODUCT_SUBGROUP_MAPPING_APPROVAL_REFERENCE_HELPER_TEXT =
  "Generated from Route Family identity, Product Subgroup identity, and approval date.";

/**
 * Canonical Product Subgroup → Route Family mapping approval identity.
 * Uses SG<product_subgroup_id>, never PG (Product Group) or mapping id.
 */
export function resolvePrmProductSubgroupMappingApprovalIdentity({
  routeFamilyCode = null,
  productSubgroupId = null,
  mapping = null,
  routeFamily = null,
} = {}) {
  const rawCode = normalizePrmCode(
    routeFamilyCode ??
      routeFamily?.route_family_code ??
      routeFamily?.family_code ??
      mapping?.route_family_code ??
      "",
  );
  const code = rawCode ? rawCode.toUpperCase() : "";
  if (!code) {
    return {
      ok: false,
      reason: "missing_route_family_code",
      error: "Route Family code is required to generate the approval reference.",
    };
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
    return {
      ok: false,
      reason: "invalid_route_family_code",
      error: "Route Family code is invalid for the approval reference.",
    };
  }
  const subgroupId = normalizePrmIntegerId(
    productSubgroupId ??
      mapping?.product_subgroup_id ??
      mapping?.subgroup_id,
  );
  if (subgroupId == null) {
    return {
      ok: false,
      reason: "missing_product_subgroup_id",
      error:
        "Product Subgroup id is required to generate the approval reference.",
    };
  }
  return {
    ok: true,
    routeFamilyCode: code,
    productSubgroupId: subgroupId,
  };
}

/**
 * Canonical Product Subgroup mapping approval reference.
 * Pattern: PRM-MAP-<ROUTE_FAMILY_CODE>-SG<PRODUCT_SUBGROUP_ID>-APP-YYYYMMDD
 * APP date is the approval-event local/business date (getPrmLocalIsoDate),
 * not effective_from and not the PRM as-of filter.
 */
export function buildPrmProductSubgroupMappingApprovalReference({
  routeFamilyCode = null,
  productSubgroupId = null,
  approvalDate = null,
} = {}) {
  const identity = resolvePrmProductSubgroupMappingApprovalIdentity({
    routeFamilyCode,
    productSubgroupId,
  });
  if (!identity.ok) return identity;
  const iso = isBlankPrmValue(approvalDate)
    ? getPrmLocalIsoDate()
    : normalizePrmAsOfDate(approvalDate, { fallbackToToday: false });
  if (!iso) {
    return {
      ok: false,
      reason: "invalid_approval_date",
      error: "Approval date is required to generate the approval reference.",
    };
  }
  const approvalYmd = iso.replace(/-/g, "");
  if (!/^[0-9]{8}$/.test(approvalYmd)) {
    return {
      ok: false,
      reason: "invalid_approval_date",
      error: "Approval date is required to generate the approval reference.",
    };
  }
  const reference = `PRM-MAP-${identity.routeFamilyCode}-SG${identity.productSubgroupId}-APP-${approvalYmd}`;
  return {
    ok: true,
    reference,
    routeFamilyCode: identity.routeFamilyCode,
    productSubgroupId: identity.productSubgroupId,
    approvalYmd,
  };
}

export function validatePrmProductSubgroupMappingApprovalReference(
  reference,
  {
    routeFamilyCode = null,
    productSubgroupId = null,
    approvalDate = null,
  } = {},
) {
  const expected = buildPrmProductSubgroupMappingApprovalReference({
    routeFamilyCode,
    productSubgroupId,
    approvalDate,
  });
  if (!expected.ok) return expected;
  const raw = String(reference ?? "").trim();
  if (!PRM_PRODUCT_SUBGROUP_MAPPING_APPROVAL_REFERENCE_RE.test(raw)) {
    return {
      ok: false,
      reason: "invalid_format",
      error:
        "Approval reference is not the canonical Product Subgroup mapping format.",
    };
  }
  if (raw !== expected.reference) {
    return {
      ok: false,
      reason: "reference_mismatch",
      error:
        "Approval reference does not match the canonical Product Subgroup mapping reference.",
    };
  }
  if (/-PG[1-9][0-9]*-APP-/.test(raw)) {
    return {
      ok: false,
      reason: "product_group_token",
      error:
        "Product Subgroup mapping approval reference must use SG, not PG.",
    };
  }
  return {
    ok: true,
    reference: expected.reference,
    routeFamilyCode: expected.routeFamilyCode,
    productSubgroupId: expected.productSubgroupId,
    approvalYmd: expected.approvalYmd,
  };
}

export const PRM_PRODUCT_ROUTE_FAMILY_ASSIGNMENT_APPROVAL_REFERENCE_RE =
  /^PRM-PRFA-[A-Z][A-Z0-9_]*-P[1-9][0-9]*-APP-[0-9]{8}$/;

export const PRM_PRODUCT_ROUTE_FAMILY_ASSIGNMENT_APPROVAL_REFERENCE_HELPER_TEXT =
  "Generated from Route Family identity, Product identity, and approval-event date.";

/**
 * Canonical Product → Route Family assignment approval identity.
 * Uses P{product_id}, never PG (Product Group) or mapping id.
 */
export function resolvePrmProductRouteFamilyAssignmentApprovalIdentity({
  routeFamilyCode = null,
  familyCode = null,
  productId = null,
  assignment = null,
  routeFamily = null,
  product = null,
} = {}) {
  const rawCode = normalizePrmCode(
    routeFamilyCode ??
      familyCode ??
      routeFamily?.route_family_code ??
      routeFamily?.family_code ??
      assignment?.route_family_code ??
      "",
  );
  const code = rawCode ? rawCode.toUpperCase() : "";
  if (!code) {
    return {
      ok: false,
      reason: "missing_route_family_code",
      error: "Route Family code is required to generate the approval reference.",
    };
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
    return {
      ok: false,
      reason: "invalid_route_family_code",
      error: "Route Family code is invalid for the approval reference.",
    };
  }
  const pid = normalizePrmIntegerId(
    productId ??
      product?.product_id ??
      product?.id ??
      assignment?.product_id,
  );
  if (pid == null) {
    return {
      ok: false,
      reason: "missing_product_id",
      error: "Product ID is required to generate the approval reference.",
    };
  }
  return {
    ok: true,
    routeFamilyCode: code,
    productId: pid,
  };
}

/**
 * Canonical Product Route Family Assignment approval reference.
 * Pattern: PRM-PRFA-<ROUTE_FAMILY_CODE>-P<PRODUCT_ID>-APP-YYYYMMDD
 * APP date is the approval-event local/business date (getPrmLocalIsoDate),
 * not effective_from and not assignment creation date.
 */
export function buildPrmProductRouteFamilyAssignmentApprovalReference({
  routeFamilyCode = null,
  familyCode = null,
  productId = null,
  approvalDate = null,
} = {}) {
  const identity = resolvePrmProductRouteFamilyAssignmentApprovalIdentity({
    routeFamilyCode: routeFamilyCode ?? familyCode,
    productId,
  });
  if (!identity.ok) return identity;
  const iso = isBlankPrmValue(approvalDate)
    ? getPrmLocalIsoDate()
    : normalizePrmAsOfDate(approvalDate, { fallbackToToday: false });
  if (!iso) {
    return {
      ok: false,
      reason: "invalid_approval_date",
      error: "Approval date is required to generate the approval reference.",
    };
  }
  const approvalYmd = iso.replace(/-/g, "");
  if (!/^[0-9]{8}$/.test(approvalYmd)) {
    return {
      ok: false,
      reason: "invalid_approval_date",
      error: "Approval date is required to generate the approval reference.",
    };
  }
  const reference = `PRM-PRFA-${identity.routeFamilyCode}-P${identity.productId}-APP-${approvalYmd}`;
  return {
    ok: true,
    reference,
    routeFamilyCode: identity.routeFamilyCode,
    productId: identity.productId,
    approvalYmd,
  };
}

export function validatePrmProductRouteFamilyAssignmentApprovalReference(
  reference,
  {
    routeFamilyCode = null,
    familyCode = null,
    productId = null,
    approvalDate = null,
  } = {},
) {
  const expected = buildPrmProductRouteFamilyAssignmentApprovalReference({
    routeFamilyCode: routeFamilyCode ?? familyCode,
    productId,
    approvalDate,
  });
  if (!expected.ok) return expected;
  const raw = String(reference ?? "").trim();
  if (!PRM_PRODUCT_ROUTE_FAMILY_ASSIGNMENT_APPROVAL_REFERENCE_RE.test(raw)) {
    return {
      ok: false,
      reason: "invalid_format",
      error:
        "Approval reference is not the canonical Product Route Family Assignment format.",
    };
  }
  if (raw !== expected.reference) {
    return {
      ok: false,
      reason: "reference_mismatch",
      error:
        "Approval reference does not match the canonical Product Route Family Assignment reference.",
    };
  }
  if (/-PG[1-9][0-9]*-APP-/.test(raw)) {
    return {
      ok: false,
      reason: "product_group_token",
      error:
        "Product Route Family Assignment approval reference must use P{product_id}, not PG.",
    };
  }
  return {
    ok: true,
    reference: expected.reference,
    routeFamilyCode: expected.routeFamilyCode,
    productId: expected.productId,
    approvalYmd: expected.approvalYmd,
  };
}

/**
 * Pre-create Product Assignment eligibility from product-scoped assignment
 * payload. Server lifecycle_actions remain authoritative for CREATE_* /
 * supersession. Client only classifies for UX messaging.
 */
export function resolvePrmProductAssignmentCreateEligibility({
  payload = null,
  canEdit = false,
} = {}) {
  if (!canEdit) {
    return {
      mode: "permission_denied",
      canCreate: false,
      message: "Edit permission required.",
      writableAssignment: null,
      approvedAssignment: null,
    };
  }
  const root = payload && typeof payload === "object" ? payload : {};
  const rows = coercePrmList(root.rows).map((row) =>
    normalizePrmProductAssignmentRow(row),
  );
  const rootActions = normalizePrmAssignmentLifecycleActions(
    root.lifecycle_actions,
  );
  const serverAllowsCreate =
    rootActions.length === 0 ||
    assignmentLifecycleIncludes(rootActions, "CREATE_DRAFT") ||
    assignmentLifecycleIncludes(rootActions, "CREATE_ASSIGNMENT_DRAFT");
  const writableAssignment =
    rows.find((row) => {
      const status = normalizePrmCode(row.status).toUpperCase();
      return status === "DRAFT" || status === "IN_REVIEW";
    }) || null;
  const approvedAssignment =
    rows.find((row) => normalizePrmCode(row.status).toUpperCase() === "APPROVED") ||
    null;

  if (writableAssignment) {
    const status = normalizePrmCode(writableAssignment.status).toUpperCase();
    return {
      mode: status === "IN_REVIEW" ? "writable_in_review" : "writable_draft",
      canCreate: false,
      message:
        status === "IN_REVIEW"
          ? "This Product already has an assignment In review. Open or cancel that assignment before creating another draft."
          : "This Product already has a Draft assignment. Open or cancel that draft before creating another.",
      writableAssignment,
      approvedAssignment,
      serverAllowsCreate,
    };
  }

  if (approvedAssignment) {
    return {
      mode: "approved_replacement",
      canCreate: serverAllowsCreate,
      message: serverAllowsCreate
        ? "An approved Product assignment already exists. Approving this new assignment from the selected Effective From date will supersede the current assignment."
        : "An approved Product assignment already exists, and create is not available for this Product under the current lifecycle.",
      writableAssignment: null,
      approvedAssignment,
      serverAllowsCreate,
    };
  }

  if (!serverAllowsCreate) {
    return {
      mode: "create_blocked",
      canCreate: false,
      message:
        "Create assignment draft is not available for this Product under the current lifecycle.",
      writableAssignment: null,
      approvedAssignment: null,
      serverAllowsCreate,
    };
  }

  if (rows.length === 0) {
    return {
      mode: "first_draft",
      canCreate: true,
      message:
        "No existing Product assignment. A new DRAFT assignment can be created.",
      writableAssignment: null,
      approvedAssignment: null,
      serverAllowsCreate,
    };
  }

  return {
    mode: "ordinary_create",
    canCreate: true,
    message: "",
    writableAssignment: null,
    approvedAssignment: null,
    serverAllowsCreate,
  };
}

export function buildPrmFamilyRouteApprovalReferenceTemplate(
  familyCode,
  version,
  dateInput = null,
) {
  const code = sanitizePrmApprovalReferenceToken(familyCode, "FAMILY");
  const versionToken = sanitizePrmApprovalReferenceToken(
    version == null || version === "" ? "1" : version,
    "1",
  ).replace(/^V/i, "");
  const ymd = formatPrmApprovalReferenceDate(dateInput);
  return `PRM-RFR-${code}-V${versionToken}-APP-${ymd}`;
}

export const PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_RE =
  /^PRM-RFR-[A-Z][A-Z0-9_]*-V[1-9][0-9]*-APP-[0-9]{8}$/;

export const PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT =
  "Generated from Route Family identity, route version, and approval date.";

/**
 * Canonical Family Route approval reference.
 * APP date is the approval-event local/business date (getPrmLocalIsoDate),
 * not effective_from and not the PRM as-of filter.
 */
export function resolvePrmFamilyRouteApprovalIdentity({
  detail = {},
  routeFamilyCode = null,
} = {}) {
  const raw = normalizePrmCode(
    detail?.route_family_code ??
      detail?.family_code ??
      routeFamilyCode ??
      "",
  );
  const code = raw ? raw.toUpperCase() : "";
  if (!code) {
    return {
      ok: false,
      reason: "missing_route_family_code",
      error: "Route Family code is required to generate the approval reference.",
    };
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(code)) {
    return {
      ok: false,
      reason: "invalid_route_family_code",
      error: "Route Family code is invalid for the approval reference.",
    };
  }
  const routeVersion = normalizePrmIntegerId(
    detail?.route_version ?? detail?.version_no ?? detail?.version,
  );
  if (routeVersion == null) {
    return {
      ok: false,
      reason: "missing_route_version",
      error: "Family Route version is required to generate the approval reference.",
    };
  }
  return { ok: true, routeFamilyCode: code, routeVersion };
}

export function buildPrmFamilyRouteApprovalReference({
  routeFamilyCode = null,
  routeVersion = null,
  approvalDate = null,
} = {}) {
  const identity = resolvePrmFamilyRouteApprovalIdentity({
    detail: {
      route_family_code: routeFamilyCode,
      route_version: routeVersion,
    },
  });
  if (!identity.ok) return identity;
  const iso = isBlankPrmValue(approvalDate)
    ? getPrmLocalIsoDate()
    : normalizePrmAsOfDate(approvalDate, { fallbackToToday: false });
  if (!iso) {
    return {
      ok: false,
      reason: "invalid_approval_date",
      error: "Approval date is required to generate the approval reference.",
    };
  }
  const approvalYmd = iso.replace(/-/g, "");
  if (!/^[0-9]{8}$/.test(approvalYmd)) {
    return {
      ok: false,
      reason: "invalid_approval_date",
      error: "Approval date is required to generate the approval reference.",
    };
  }
  const reference = `PRM-RFR-${identity.routeFamilyCode}-V${identity.routeVersion}-APP-${approvalYmd}`;
  if (!PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_RE.test(reference)) {
    return {
      ok: false,
      reason: "invalid_generation",
      error: "Generated Family Route approval reference is not canonical.",
    };
  }
  return {
    ok: true,
    reference,
    routeFamilyCode: identity.routeFamilyCode,
    routeVersion: identity.routeVersion,
    approvalYmd,
  };
}

export function validatePrmFamilyRouteApprovalReference(
  reference,
  { routeFamilyCode = null, routeVersion = null, approvalDate = null } = {},
) {
  const expected = buildPrmFamilyRouteApprovalReference({
    routeFamilyCode,
    routeVersion,
    approvalDate,
  });
  if (!expected.ok) return expected;
  const raw = String(reference ?? "").trim();
  if (!PRM_FAMILY_ROUTE_APPROVAL_REFERENCE_RE.test(raw)) {
    return {
      ok: false,
      reason: "invalid_format",
      error: "Approval reference is not the canonical Family Route format.",
    };
  }
  if (raw !== expected.reference) {
    return {
      ok: false,
      reason: "reference_mismatch",
      error:
        "Approval reference does not match the canonical Family Route reference.",
    };
  }
  return {
    ok: true,
    reference: expected.reference,
    routeFamilyCode: expected.routeFamilyCode,
    routeVersion: expected.routeVersion,
    approvalYmd: expected.approvalYmd,
  };
}

export const PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_RE =
  /^PRM-PR-[1-9][0-9]*-V[1-9][0-9]*-APP-[0-9]{8}$/;

export const PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_HELPER_TEXT =
  "Generated from Product Route identity and approval date.";

/**
 * Canonical Product Route approval reference.
 * APP date is the approval-event local/business date (getPrmLocalIsoDate),
 * not effective_from and not the PRM as-of filter.
 * Residual: UTC vs local midnight can disagree near 00:00; server is unchanged in this gate.
 */
export function parsePrmProductRouteApprovalReference(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(
    /^PRM-PR-([1-9][0-9]*)-V([1-9][0-9]*)-APP-([0-9]{8})$/,
  );
  if (!match) return null;
  return {
    productId: Number(match[1]),
    routeVersion: Number(match[2]),
    approvalYmd: match[3],
  };
}

export function resolvePrmProductRouteApprovalIdentity({
  detail = {},
  selectedProductId = null,
} = {}) {
  const productId = normalizePrmIntegerId(detail?.product_id);
  if (productId == null) {
    return {
      ok: false,
      reason: "missing_product_id",
      error: "Product ID is required to generate the approval reference.",
    };
  }
  const selected = normalizePrmIntegerId(selectedProductId);
  if (selected != null && selected !== productId) {
    return {
      ok: false,
      reason: "product_id_mismatch",
      error: "Selected Product does not match this Product Route.",
    };
  }
  const routeVersion = normalizePrmIntegerId(detail?.route_version);
  if (routeVersion == null) {
    return {
      ok: false,
      reason: "missing_route_version",
      error: "Product Route version is required to generate the approval reference.",
    };
  }
  return { ok: true, productId, routeVersion };
}

export function buildPrmProductRouteApprovalReference({
  productId = null,
  routeVersion = null,
  approvalDate = null,
} = {}) {
  const pid = normalizePrmIntegerId(productId);
  if (pid == null) {
    return {
      ok: false,
      reason: "missing_product_id",
      error: "Product ID is required to generate the approval reference.",
    };
  }
  const version = normalizePrmIntegerId(routeVersion);
  if (version == null) {
    return {
      ok: false,
      reason: "missing_route_version",
      error: "Product Route version is required to generate the approval reference.",
    };
  }
  const iso = isBlankPrmValue(approvalDate)
    ? getPrmLocalIsoDate()
    : normalizePrmAsOfDate(approvalDate, { fallbackToToday: false });
  if (!iso) {
    return {
      ok: false,
      reason: "invalid_approval_date",
      error: "Approval date is required to generate the approval reference.",
    };
  }
  const approvalYmd = iso.replace(/-/g, "");
  if (!/^[0-9]{8}$/.test(approvalYmd)) {
    return {
      ok: false,
      reason: "invalid_approval_date",
      error: "Approval date is required to generate the approval reference.",
    };
  }
  const reference = `PRM-PR-${pid}-V${version}-APP-${approvalYmd}`;
  return {
    ok: true,
    reference,
    productId: pid,
    routeVersion: version,
    approvalYmd,
  };
}

export function validatePrmProductRouteApprovalReference(
  reference,
  { productId = null, routeVersion = null, approvalDate = null } = {},
) {
  const expected = buildPrmProductRouteApprovalReference({
    productId,
    routeVersion,
    approvalDate,
  });
  if (!expected.ok) return expected;
  const raw = String(reference ?? "").trim();
  if (!PRM_PRODUCT_ROUTE_APPROVAL_REFERENCE_RE.test(raw)) {
    return {
      ok: false,
      reason: "invalid_format",
      error: "Approval reference is not the canonical Product Route format.",
    };
  }
  const parsed = parsePrmProductRouteApprovalReference(raw);
  if (!parsed) {
    return {
      ok: false,
      reason: "invalid_format",
      error: "Approval reference is not the canonical Product Route format.",
    };
  }
  if (parsed.productId !== expected.productId) {
    return {
      ok: false,
      reason: "product_id_mismatch",
      error: "Approval reference Product ID does not match this Product Route.",
    };
  }
  if (parsed.routeVersion !== expected.routeVersion) {
    return {
      ok: false,
      reason: "route_version_mismatch",
      error: "Approval reference version does not match this Product Route.",
    };
  }
  if (parsed.approvalYmd !== expected.approvalYmd) {
    return {
      ok: false,
      reason: "approval_date_mismatch",
      error: "Approval reference date does not match the approval event date.",
    };
  }
  if (raw !== expected.reference) {
    return {
      ok: false,
      reason: "reference_mismatch",
      error: "Approval reference does not match the canonical Product Route reference.",
    };
  }
  return {
    ok: true,
    reference: expected.reference,
    productId: expected.productId,
    routeVersion: expected.routeVersion,
    approvalYmd: expected.approvalYmd,
  };
}

export const PRM_PRODUCTION_COST_CENTRE_APPROVAL_REFERENCE_RE =
  /^PRM-CC-[A-Z][A-Z0-9_]*-APP-[0-9]{8}$/;

export const PRM_PRODUCTION_COST_CENTRE_APPROVAL_REFERENCE_HELPER_TEXT =
  "Generated from Cost Centre identity and approval date.";

/**
 * Canonical Production Cost Centre approval reference.
 * APP date is the approval-event local/business date (getPrmLocalIsoDate),
 * not effective_from and not Cost Centre id/name.
 */
export function resolvePrmProductionCostCentreApprovalIdentity({
  detail = {},
} = {}) {
  const raw = normalizePrmCode(
    detail?.cost_centre_code ?? detail?.code ?? "",
  );
  const costCentreCode = raw ? raw.toUpperCase() : "";
  if (!costCentreCode) {
    return {
      ok: false,
      reason: "missing_cost_centre_code",
      error: "Cost Centre code is required to generate the approval reference.",
    };
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(costCentreCode)) {
    return {
      ok: false,
      reason: "invalid_cost_centre_code",
      error: "Cost Centre code is invalid for the approval reference.",
    };
  }
  return { ok: true, costCentreCode };
}

export function buildPrmProductionCostCentreApprovalReference({
  costCentreCode = null,
  approvalDate = null,
} = {}) {
  const identity = resolvePrmProductionCostCentreApprovalIdentity({
    detail: { cost_centre_code: costCentreCode },
  });
  if (!identity.ok) return identity;
  const iso = isBlankPrmValue(approvalDate)
    ? getPrmLocalIsoDate()
    : normalizePrmAsOfDate(approvalDate, { fallbackToToday: false });
  if (!iso) {
    return {
      ok: false,
      reason: "invalid_approval_date",
      error: "Approval date is required to generate the approval reference.",
    };
  }
  const approvalYmd = iso.replace(/-/g, "");
  if (!/^[0-9]{8}$/.test(approvalYmd)) {
    return {
      ok: false,
      reason: "invalid_approval_date",
      error: "Approval date is required to generate the approval reference.",
    };
  }
  const reference = `PRM-CC-${identity.costCentreCode}-APP-${approvalYmd}`;
  return {
    ok: true,
    reference,
    costCentreCode: identity.costCentreCode,
    approvalYmd,
  };
}

export function validatePrmProductionCostCentreApprovalReference(
  reference,
  { costCentreCode = null, approvalDate = null } = {},
) {
  const expected = buildPrmProductionCostCentreApprovalReference({
    costCentreCode,
    approvalDate,
  });
  if (!expected.ok) return expected;
  const raw = String(reference ?? "").trim();
  if (!PRM_PRODUCTION_COST_CENTRE_APPROVAL_REFERENCE_RE.test(raw)) {
    return {
      ok: false,
      reason: "invalid_format",
      error:
        "Approval reference is not the canonical Production Cost Centre format.",
    };
  }
  if (raw !== expected.reference) {
    return {
      ok: false,
      reason: "reference_mismatch",
      error:
        "Approval reference does not match the canonical Production Cost Centre reference.",
    };
  }
  return {
    ok: true,
    reference: expected.reference,
    costCentreCode: expected.costCentreCode,
    approvalYmd: expected.approvalYmd,
  };
}

/** Pure Escape/modal stack helpers for PRM detailsModal workflows. */
export function createPrmModalStack() {
  const stack = [];
  return {
    push(snapshot) {
      if (snapshot) stack.push(snapshot);
      return stack.length;
    },
    pop() {
      return stack.pop() || null;
    },
    clear() {
      stack.length = 0;
    },
    get depth() {
      return stack.length;
    },
    get hasPrevious() {
      return stack.length > 0;
    },
  };
}

export function shouldRestorePrmModalLayer(stackDepth) {
  return Number(stackDepth) > 0;
}

export function clearPrmActiveRowClass(root, className = PRM_ACTIVE_ROW_CLASS) {
  if (!root || typeof root.querySelectorAll !== "function") return 0;
  const nodes = root.querySelectorAll(`.${className}`);
  let cleared = 0;
  nodes.forEach((node) => {
    node.classList.remove(className);
    cleared += 1;
  });
  return cleared;
}

export function normalizePrmMasterOptions(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const products = coercePrmList(root.products).map((row) => {
    const r = row && typeof row === "object" ? row : {};
    return {
      ...r,
      product_id: normalizePrmIntegerId(r.product_id ?? r.id),
      product_subgroup_id: normalizePrmIntegerId(
        r.product_subgroup_id ?? r.subgroup_id,
      ),
      product_subgroup_name:
        r.product_subgroup_name || r.subgroup_name || null,
    };
  });
  return {
    product_groups: coercePrmList(root.product_groups),
    product_subgroups: coercePrmList(
      root.product_subgroups || root.subgroups,
    ),
    products,
    product: root.product && typeof root.product === "object" ? root.product : null,
    product_group:
      root.product_group && typeof root.product_group === "object"
        ? root.product_group
        : null,
    route_families: coercePrmList(root.route_families).map(
      normalizePrmRouteFamilyMasterRow,
    ),
    route_family_mappings: coercePrmList(root.route_family_mappings).map(
      normalizePrmRouteFamilyMapping,
    ),
    route_family_subgroup_mappings: coercePrmList(
      root.route_family_subgroup_mappings ||
        root.product_subgroup_route_family_mappings,
    ).map(normalizePrmProductSubgroupMapping),
    approved_route_family_routes: coercePrmList(
      root.approved_route_family_routes,
    ).map(normalizePrmApprovedFamilyRouteMasterRow),
    batch_size_references: coercePrmList(root.batch_size_references),
    behaviours: coercePrmList(root.behaviours),
    resource_classes: coercePrmList(root.resource_classes),
    cost_centres: coercePrmList(root.cost_centres),
    activities: coercePrmList(root.activities),
    sections: coercePrmList(root.sections).map(normalizePrmLocationSection),
    subsections: coercePrmList(root.subsections).map(
      normalizePrmLocationSubsection,
    ),
    areas: coercePrmList(root.areas).map(normalizePrmLocationArea),
    plants: coercePrmList(root.plants).map(normalizePrmLocationPlant),
    as_of_date: root.as_of_date ?? null,
  };
}

export function normalizePrmLocationSection(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const section_id = normalizePrmIntegerId(r.section_id ?? r.id);
  return {
    section_id,
    section_name: r.section_name ?? r.name ?? null,
  };
}

export function normalizePrmLocationSubsection(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  return {
    subsection_id: normalizePrmIntegerId(r.subsection_id ?? r.id),
    subsection_name: r.subsection_name ?? r.name ?? null,
    section_id: normalizePrmIntegerId(r.section_id),
  };
}

export function normalizePrmLocationArea(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  return {
    area_id: normalizePrmIntegerId(r.area_id ?? r.id),
    area_name: r.area_name ?? r.name ?? null,
    section_id: normalizePrmIntegerId(r.section_id),
    subsection_id: normalizePrmIntegerId(r.subsection_id),
  };
}

export function normalizePrmLocationPlant(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const status = r.status == null || r.status === "" ? null : String(r.status);
  return {
    plant_id: normalizePrmIntegerId(r.plant_id ?? r.id),
    plant_name: r.plant_name ?? r.name ?? null,
    section_id: normalizePrmIntegerId(r.section_id),
    subsection_id: normalizePrmIntegerId(r.subsection_id),
    area_id: normalizePrmIntegerId(r.area_id),
    status,
    status_label: formatPrmPlantMachineryStatusLabel(status),
    type_id: normalizePrmIntegerId(r.type_id),
  };
}

export function filterPrmSubsectionsBySection(subsections = [], sectionId) {
  const sid = normalizePrmIntegerId(sectionId);
  if (sid == null) return [];
  return coercePrmList(subsections).filter(
    (row) => normalizePrmIntegerId(row?.section_id) === sid,
  );
}

export function filterPrmAreasBySectionSubsection(
  areas = [],
  sectionId,
  subsectionId,
) {
  const sid = normalizePrmIntegerId(sectionId);
  const ssid = normalizePrmIntegerId(subsectionId);
  if (sid == null || ssid == null) return [];
  return coercePrmList(areas).filter(
    (row) =>
      normalizePrmIntegerId(row?.section_id) === sid &&
      normalizePrmIntegerId(row?.subsection_id) === ssid,
  );
}

export function filterPrmPlantsByLocation(
  plants = [],
  { section_id = null, subsection_id = null, area_id = null } = {},
) {
  const sid = normalizePrmIntegerId(section_id);
  const ssid = normalizePrmIntegerId(subsection_id);
  const aid = normalizePrmIntegerId(area_id);
  if (sid == null || ssid == null || aid == null) return [];
  return coercePrmList(plants).filter(
    (row) =>
      normalizePrmIntegerId(row?.section_id) === sid &&
      normalizePrmIntegerId(row?.subsection_id) === ssid &&
      normalizePrmIntegerId(row?.area_id) === aid,
  );
}

/**
 * Normalize live master-options mapping rows.
 * Canonical server field is `id`; client also exposes mapping_id = id.
 */
export function normalizePrmRouteFamilyMapping(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const id = normalizePrmIntegerId(
    r.id ?? r.mapping_id ?? r.route_family_mapping_id,
  );
  return {
    ...r,
    id,
    mapping_id: id,
    route_family_id: normalizePrmIntegerId(r.route_family_id),
    product_group_id: normalizePrmIntegerId(r.product_group_id),
    status: r.status || r.mapping_status || null,
    mapping_status: r.mapping_status || r.status || null,
    effective_from: r.effective_from ?? null,
    mapping_basis: r.mapping_basis ?? null,
    mapping_note: r.mapping_note ?? null,
    approval_reference: r.approval_reference ?? null,
  };
}

/**
 * Read Map Product Group form controls at submit time only.
 * Never reuse open-time defaults from closure state.
 */
export function readPrmMapProductGroupFormValues(root) {
  if (!root || typeof root.querySelector !== "function") {
    return {
      ok: false,
      product_group_id: null,
      effective_from: null,
      mapping_basis: null,
      mapping_note: null,
      errors: ["Mapping form root is missing"],
    };
  }
  const productGroupEl =
    root.querySelector("[data-prm-map-field='product_group_id']") ||
    root.querySelector("#prmMapProductGroupSelect");
  const effectiveEl =
    root.querySelector("[data-prm-map-field='effective_from']") ||
    root.querySelector("#prmMapEffectiveFrom");
  const basisEl =
    root.querySelector("[data-prm-map-field='mapping_basis']") ||
    root.querySelector("#prmMapBasis");
  const noteEl =
    root.querySelector("[data-prm-map-field='mapping_note']") ||
    root.querySelector("#prmMapNote");
  const product_group_id = normalizePrmIntegerId(productGroupEl?.value);
  const effective_from = effectiveEl?.value || null;
  const mapping_basis = normalizePrmMappingBasis(basisEl?.value);
  const noteRaw = String(noteEl?.value ?? "").trim();
  const mapping_note =
    !noteRaw ||
    noteRaw === "—" ||
    noteRaw === "-" ||
    noteRaw === "–" ||
    noteRaw === "−"
      ? null
      : noteRaw;
  const errors = [];
  if (product_group_id == null) errors.push("Product Group is required");
  if (!mapping_basis) {
    errors.push("mapping_basis must be MANUAL, HISTORICAL_REVIEW, or MIGRATED");
  }
  return {
    ok: errors.length === 0,
    product_group_id,
    effective_from,
    mapping_basis,
    mapping_note,
    errors,
  };
}

export function readPrmEditMappingFormValues(root) {
  if (!root || typeof root.querySelector !== "function") {
    return {
      ok: false,
      effective_from: null,
      mapping_basis: null,
      mapping_note: null,
      errors: ["Edit mapping form root is missing"],
    };
  }
  const effectiveEl =
    root.querySelector("[data-prm-edit-mapping-field='effective_from']") ||
    root.querySelector("#prmEditMapEffectiveFrom");
  const basisEl =
    root.querySelector("[data-prm-edit-mapping-field='mapping_basis']") ||
    root.querySelector("#prmEditMapBasis");
  const noteEl =
    root.querySelector("[data-prm-edit-mapping-field='mapping_note']") ||
    root.querySelector("#prmEditMapNote");
  const effective_from = effectiveEl?.value || null;
  const mapping_basis = normalizePrmMappingBasis(basisEl?.value);
  const noteRaw = String(noteEl?.value ?? "").trim();
  const mapping_note =
    !noteRaw ||
    noteRaw === "—" ||
    noteRaw === "-" ||
    noteRaw === "–" ||
    noteRaw === "−"
      ? null
      : noteRaw;
  const errors = [];
  if (!mapping_basis) {
    errors.push("mapping_basis must be MANUAL, HISTORICAL_REVIEW, or MIGRATED");
  }
  return {
    ok: errors.length === 0,
    effective_from,
    mapping_basis,
    mapping_note,
    errors,
  };
}

export function extractProductGroups(optionsPayload) {
  return normalizePrmMasterOptions(optionsPayload).product_groups;
}

export function extractProducts(optionsPayload) {
  return normalizePrmMasterOptions(optionsPayload).products;
}

export function extractRouteFamilies(optionsPayload) {
  return normalizePrmMasterOptions(optionsPayload).route_families;
}

export function extractBehaviours(optionsPayload) {
  return normalizePrmMasterOptions(optionsPayload).behaviours;
}

export function extractResourceClasses(optionsPayload) {
  return normalizePrmMasterOptions(optionsPayload).resource_classes;
}

export function getApplicableProductRouteActions(
  row = {},
  {
    hasApprovedCostCentres: _hasCc = true,
    productHistory = [],
    productHistoryUnavailable = false,
  } = {},
) {
  const readiness = normalizePrmCode(row.readiness_status).toUpperCase();
  const actions = [];
  const missingFamily =
    isBlankPrmValue(row.route_family_id) ||
    readiness === "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING";
  if (missingFamily) {
    actions.push({
      id: "assign-route-family",
      label: formatPrmActionLabel("assign-route-family"),
      mutation: true,
      product_group_id: row.product_group_id ?? null,
    });
  }
  actions.push(
    { id: "effective", label: formatPrmActionLabel("effective") },
    {
      id: "product-candidate",
      label: formatPrmActionLabel("product-candidate"),
    },
    { id: "product-delta", label: formatPrmActionLabel("product-delta") },
    {
      id: "product-history",
      label: formatPrmActionLabel("product-history"),
    },
  );
  const eligibility = resolvePrmOpenProductRouteEligibility(row, productHistory);
  if (eligibility.current_product_route_ambiguous) {
    // History is the chooser. Do not guess Open or Create.
  } else if (eligibility.open_product_route_id != null) {
    actions.push({
      id: "open-product-draft",
      label: formatPrmActionLabel("open-product-draft"),
      product_route_id: eligibility.open_product_route_id,
      mutation: false,
    });
  } else if (
    !productHistoryUnavailable &&
    readiness !== "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING" &&
    readiness !== "BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE"
  ) {
    actions.push({
      id: "create-product",
      label: formatPrmActionLabel("create-product"),
      requiresCostCentre: false,
      disabled: false,
      disabledReason: null,
      mutation: false,
      navigateHandoff: true,
    });
  }
  if (!isBlankPrmValue(row.route_family_id)) {
    actions.push({
      id: "open-route-family",
      label: formatPrmActionLabel("open-route-family"),
      route_family_id: row.route_family_id,
    });
  }
  if (
    !isBlankPrmValue(row.family_route_id) ||
    !isBlankPrmValue(row.approved_family_route_id)
  ) {
    actions.push({
      id: "open-family-route",
      label: formatPrmActionLabel("open-family-route"),
      family_route_id: row.family_route_id || row.approved_family_route_id,
      route_family_id: row.route_family_id,
    });
  }
  actions.push(buildPrmPreferredBatchSizeHandoffAction(row));
  return actions;
}

function isApprovedFamilyStatus(status) {
  return normalizePrmCode(status).toUpperCase() === "APPROVED";
}

/** Pending/approvable mapping statuses — exactly DRAFT and IN_REVIEW. */
export function isPrmPendingMappingStatus(status) {
  const upper = normalizePrmCode(status).toUpperCase();
  return upper === "DRAFT" || upper === "IN_REVIEW";
}

/** @deprecated Prefer isPrmPendingMappingStatus; retained for older callers. */
function isPendingMappingStatus(status) {
  return isPrmPendingMappingStatus(status);
}

/**
 * Status-aware Manufacturing Route Family summary actions.
 * Draft: approve + evidence. Approved: map / approve mapping / route draft / evidence / history.
 */
export function getApplicableRouteFamilyActions(
  row = {},
  { hasApprovedCostCentres: _hasCc = true } = {},
) {
  const actions = [];
  const status = normalizePrmCode(row.status || row.approval_status).toUpperCase();
  const approved = isApprovedFamilyStatus(status);
  const mappings = coercePrmList(row.mappings).map(normalizePrmRouteFamilyMapping);
  const pendingMappings = mappings.filter((m) =>
    isPrmPendingMappingStatus(m.status || m.mapping_status),
  );
  const hasPending = pendingMappings.length > 0 || !!row.has_pending_mapping;
  const firstPending = pendingMappings[0] || null;

  if (!approved) {
    actions.push({
      id: "approve-route-family",
      label: formatPrmActionLabel("approve-route-family"),
      mutation: true,
    });
    actions.push({
      id: "family-candidate",
      label: formatPrmActionLabel("family-candidate"),
    });
    return actions;
  }

  actions.push({
    id: "map-product-group",
    label: formatPrmActionLabel("map-product-group"),
    mutation: true,
  });
  if (hasPending && firstPending) {
    actions.push({
      id: "edit-pending-mapping",
      label: formatPrmActionLabel("edit-pending-mapping"),
      mutation: true,
      mapping_id: firstPending.id ?? firstPending.mapping_id ?? null,
      selectedMapping: firstPending,
    });
    actions.push({
      id: "approve-mapping",
      label: formatPrmActionLabel("approve-mapping"),
      mutation: true,
      mapping_id: firstPending.id ?? firstPending.mapping_id ?? null,
      selectedMapping: firstPending,
    });
  }

  const openId =
    row.draft_family_route_id ||
    row.approved_family_route_id ||
    row.open_family_route_id ||
    null;
  if (!isBlankPrmValue(openId)) {
    actions.push({
      id: "open-family-route",
      label: formatPrmActionLabel("open-family-route"),
      family_route_id: openId,
    });
    if (!isBlankPrmValue(row.approved_family_route_id)) {
      actions.push({
        id: "create-family-version",
        label: formatPrmActionLabel("create-family-version"),
        requiresCostCentre: false,
        mutation: true,
      });
    }
  } else {
    actions.push({
      id: "create-family-route",
      label: formatPrmActionLabel("create-family-route"),
      requiresCostCentre: false,
      mutation: true,
    });
  }

  actions.push({
    id: "family-candidate",
    label: formatPrmActionLabel("family-candidate"),
  });
  actions.push({
    id: "family-history",
    label: formatPrmActionLabel("family-history"),
  });
  return actions;
}

/**
 * Compact 6-step workflow indicator for Route Family summary.
 * Returns { id, label, state: complete|current|pending }.
 * Family route defined is complete only when an approved Family route exists;
 * a draft/open route keeps that step current (not complete).
 */
export function isPrmDefinedRouteFamilyAssignmentStatus(status) {
  const s = normalizePrmCode(status).toUpperCase();
  return s === "DRAFT" || s === "IN_REVIEW" || s === "APPROVED";
}

export function filterPrmRouteFamilyGroupMappings(mappings = [], routeFamilyId = null) {
  const fid = normalizePrmIntegerId(routeFamilyId);
  if (fid == null) return [];
  return coercePrmList(mappings)
    .map(normalizePrmRouteFamilyMapping)
    .filter((mapping) => mapping.route_family_id === fid);
}

export function filterPrmRouteFamilySubgroupMappings(
  mappings = [],
  routeFamilyId = null,
) {
  const fid = normalizePrmIntegerId(routeFamilyId);
  if (fid == null) return [];
  return coercePrmList(mappings)
    .map(normalizePrmProductSubgroupMapping)
    .filter((mapping) => mapping.route_family_id === fid);
}

export function filterPrmRouteFamilyProductAssignments(
  assignments = [],
  routeFamilyId = null,
) {
  const fid = normalizePrmIntegerId(routeFamilyId);
  if (fid == null) return [];
  return coercePrmList(assignments)
    .map(normalizePrmProductAssignmentRow)
    .filter((assignment) => assignment.route_family_id === fid);
}

export function summarizePrmRouteFamilyAssignments({
  groupMappings = [],
  subgroupMappings = [],
  productAssignments = [],
} = {}) {
  const groups = coercePrmList(groupMappings).map(normalizePrmRouteFamilyMapping);
  const subgroups = coercePrmList(subgroupMappings).map(
    normalizePrmProductSubgroupMapping,
  );
  const products = coercePrmList(productAssignments).map(
    normalizePrmProductAssignmentRow,
  );
  const hasDefinedAssignment =
    groups.some((m) =>
      isPrmDefinedRouteFamilyAssignmentStatus(m.status || m.mapping_status),
    ) ||
    subgroups.some((m) =>
      isPrmDefinedRouteFamilyAssignmentStatus(m.status || m.mapping_status),
    ) ||
    products.some((a) =>
      isPrmDefinedRouteFamilyAssignmentStatus(a.status || a.assignment_status),
    );
  const hasApprovedAssignment =
    groups.some(
      (m) =>
        normalizePrmCode(m.status || m.mapping_status).toUpperCase() ===
        "APPROVED",
    ) ||
    subgroups.some(
      (m) =>
        normalizePrmCode(m.status || m.mapping_status).toUpperCase() ===
        "APPROVED",
    ) ||
    products.some(
      (a) =>
        normalizePrmCode(a.status || a.assignment_status).toUpperCase() ===
        "APPROVED",
    );
  const hasPendingAssignment =
    groups.some((m) =>
      isPrmPendingMappingStatus(m.status || m.mapping_status),
    ) ||
    subgroups.some((m) =>
      isPrmPendingMappingStatus(m.status || m.mapping_status),
    ) ||
    products.some((a) =>
      isPrmPendingMappingStatus(a.status || a.assignment_status),
    );
  return {
    groupMappings: groups,
    subgroupMappings: subgroups,
    productAssignments: products,
    hasDefinedAssignment,
    hasApprovedAssignment,
    hasPendingAssignment,
    assignmentsApproved: hasApprovedAssignment && !hasPendingAssignment,
    counts: {
      subgroups: subgroups.length,
      groups: groups.length,
      products: products.length,
    },
  };
}

export function getRouteFamilyWorkflowSteps(row = {}) {
  const status = normalizePrmCode(row.status || row.approval_status).toUpperCase();
  const familyApproved = status === "APPROVED";
  const assignmentSummary = summarizePrmRouteFamilyAssignments({
    groupMappings: row.mappings,
    subgroupMappings: row.subgroup_mappings,
    productAssignments: row.product_assignments,
  });
  const hasMappedGroup = assignmentSummary.hasDefinedAssignment;
  const mappingsApproved = assignmentSummary.assignmentsApproved;
  const hasPendingMapping =
    assignmentSummary.hasPendingAssignment || !!row.has_pending_mapping;
  const familyRouteApproved = !isBlankPrmValue(row.approved_family_route_id);
  const productRoutesDefined = !!row.product_routes_defined;

  const flags = [
    true,
    familyApproved,
    hasMappedGroup,
    mappingsApproved,
    familyRouteApproved,
    productRoutesDefined,
  ];
  let currentSet = false;
  return PRM_FAMILY_WORKFLOW_STEPS.map((step, index) => {
    const done = !!flags[index];
    let state = "pending";
    if (done) state = "complete";
    else if (!currentSet) {
      state = "current";
      currentSet = true;
    }
    return { ...step, state };
  });
}

export function getRouteFamilyNextActionLabel(row = {}) {
  const steps = getRouteFamilyWorkflowSteps(row);
  const current = steps.find((s) => s.state === "current");
  if (!current) return "Workflow complete";
  if (current.id === "family_approved") return "Approve Route Family";
  if (current.id === "groups_mapped") return "Define assignment";
  if (current.id === "mappings_approved") return "Approve assignment";
  if (current.id === "family_route_defined") {
    if (
      !isBlankPrmValue(row.draft_family_route_id) ||
      !isBlankPrmValue(row.open_family_route_id) ||
      row.has_defined_route
    ) {
      return "Complete and approve Family route";
    }
    return "Create Family Route Draft";
  }
  if (current.id === "product_routes_defined") {
    return "Define Product route differences";
  }
  return current.label;
}

export const PRM_ROUTE_FAMILY_DETAILS_UNAVAILABLE =
  "Route Family details unavailable";

function firstNonBlankPrmText(...values) {
  for (const value of values) {
    if (isBlankPrmValue(value)) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function formatPrmCompactVersionToken(version) {
  const raw = String(version ?? "").trim();
  if (!raw) return "";
  const stripped = raw.replace(/^v/i, "").trim();
  return stripped ? `V${stripped}` : "";
}

/** Alias-safe Route Family master row. Numeric id is never the business name. */
export function normalizePrmRouteFamilyMasterRow(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const route_family_id = normalizePrmIntegerId(
    r.route_family_id ?? r.family_id ?? r.id,
  );
  const route_family_code =
    firstNonBlankPrmText(r.route_family_code, r.family_code, r.code) || null;
  const route_family_name =
    firstNonBlankPrmText(r.route_family_name, r.family_name, r.name) || null;
  const status =
    normalizePrmCode(
      r.status || r.family_status || r.route_family_status || r.approval_status,
    ).toUpperCase() || null;
  const is_active = r.is_active !== false && r.active !== false;
  return {
    ...r,
    route_family_id,
    id: route_family_id,
    route_family_code,
    family_code: r.family_code || route_family_code,
    route_family_name,
    family_name: r.family_name || route_family_name,
    status,
    is_active,
  };
}

export function findPrmRouteFamilyMasterById(families = [], routeFamilyId) {
  const fid = normalizePrmIntegerId(routeFamilyId);
  if (fid == null) return null;
  return (
    coercePrmList(families)
      .map(normalizePrmRouteFamilyMasterRow)
      .find((row) => row.route_family_id === fid) || null
  );
}

export function isPrmRouteFamilyInactiveForMapping(family = {}) {
  const row = normalizePrmRouteFamilyMasterRow(family);
  if (!row.is_active) return true;
  const status = normalizePrmCode(row.status).toUpperCase();
  if (status === "INACTIVE") return true;
  return isPrmRouteFamilyArchived(row);
}

/**
 * Operator-facing Route Family identity from the governed master.
 * Never uses "Route Family <id>" as the primary label.
 */
export function resolvePrmRouteFamilyMasterIdentity(family = {}) {
  const row = normalizePrmRouteFamilyMasterRow(family);
  const id = row.route_family_id;
  const name = row.route_family_name || "";
  const code = row.route_family_code || "";
  const status = row.status || "";
  const statusLabel = formatPrmRouteStatusLabel(status) || "";
  const resolved = Boolean(name || code);
  const primaryLabel = resolved
    ? name || code
    : PRM_ROUTE_FAMILY_DETAILS_UNAVAILABLE;
  const compactLabel = resolved
    ? code && name && code !== name
      ? `${code} — ${name}`
      : name || code
    : PRM_ROUTE_FAMILY_DETAILS_UNAVAILABLE;
  const secondaryParts = [];
  if (code && code !== primaryLabel) secondaryParts.push(code);
  if (statusLabel) secondaryParts.push(statusLabel);
  else if (status) secondaryParts.push(status);
  const title = id != null ? `Route family ${id}` : "";
  const search = [
    name,
    code,
    status,
    statusLabel,
    compactLabel,
    resolved ? "" : PRM_ROUTE_FAMILY_DETAILS_UNAVAILABLE,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    route_family_id: id,
    route_family_name: name || null,
    route_family_code: code || null,
    status: status || null,
    statusLabel: statusLabel || null,
    resolved,
    is_active: row.is_active,
    primaryLabel,
    compactLabel,
    secondaryLabel: secondaryParts.join(" · "),
    title,
    search,
    genericIdLabel: id != null ? `Route Family ${id}` : "",
  };
}

export function formatPrmRouteFamilyPrimaryLabel(family = {}) {
  return resolvePrmRouteFamilyMasterIdentity(family).primaryLabel;
}

export function formatPrmRouteFamilySelectorLabel(family = {}) {
  const identity = resolvePrmRouteFamilyMasterIdentity(family);
  return identity.resolved ? identity.compactLabel : "";
}

export function buildPrmRouteFamilyMappingSelectOptions(families = []) {
  return coercePrmList(families)
    .map((row) => {
      const identity = resolvePrmRouteFamilyMasterIdentity(row);
      if (identity.route_family_id == null) return null;
      return {
        route_family_id: identity.route_family_id,
        label: identity.compactLabel,
        primary: identity.primaryLabel,
        secondary: identity.secondaryLabel,
        search: identity.search,
        title: identity.title,
        resolved: identity.resolved,
        route_family_code: identity.route_family_code,
        route_family_name: identity.route_family_name,
        status: identity.status,
      };
    })
    .filter(Boolean);
}

export function normalizePrmApprovedFamilyRouteMasterRow(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const family_route_id = normalizePrmIntegerId(
    r.family_route_id ??
      r.route_family_route_id ??
      r.approved_family_route_id ??
      r.id,
  );
  const route_version = resolvePrmDisplayedRouteVersion(r);
  const route_name =
    firstNonBlankPrmText(
      r.route_name,
      r.family_route_name,
      r.route_family_route_name,
      r.name,
    ) || null;
  const route_code =
    firstNonBlankPrmText(r.route_code, r.family_route_code, r.code) || null;
  return {
    ...r,
    family_route_id,
    id: family_route_id,
    route_family_id: normalizePrmIntegerId(r.route_family_id),
    route_name,
    family_route_name: r.family_route_name || route_name,
    route_code,
    route_version,
    version_label:
      r.version_label || (route_version != null ? String(route_version) : null),
    status: normalizePrmCode(r.status || r.route_status).toUpperCase() || null,
  };
}

export function resolvePrmApprovedFamilyRouteForFamily(
  family = {},
  approvedRoutes = [],
) {
  const row = normalizePrmRouteFamilyMasterRow(family);
  const fid = row.route_family_id;
  const list = coercePrmList(approvedRoutes).map(
    normalizePrmApprovedFamilyRouteMasterRow,
  );
  const approvedFromFamily = list.find((item) => {
    if (fid != null && item.route_family_id === fid) {
      const status = normalizePrmCode(item.status).toUpperCase();
      return !status || status === "APPROVED";
    }
    return false;
  });
  if (approvedFromFamily?.route_name || approvedFromFamily?.route_code) {
    return approvedFromFamily;
  }
  const approvedId = normalizePrmIntegerId(
    row.approved_family_route_id ?? row.approved_route_id,
  );
  if (approvedId != null) {
    const byId = list.find((item) => item.family_route_id === approvedId);
    if (byId?.route_name || byId?.route_code) return byId;
    const nestedName = firstNonBlankPrmText(
      row.approved_family_route_name,
      row.approved_route_name,
    );
    if (nestedName) {
      return normalizePrmApprovedFamilyRouteMasterRow({
        family_route_id: approvedId,
        route_family_id: fid,
        route_name: nestedName,
        route_version:
          row.approved_route_version ?? row.approved_family_route_version,
        status: "APPROVED",
      });
    }
  }
  return approvedFromFamily || null;
}

export function formatPrmApprovedFamilyRouteContextLabel(route = {}) {
  const row = normalizePrmApprovedFamilyRouteMasterRow(route);
  const name = firstNonBlankPrmText(row.route_name, row.route_code);
  if (!name) return "";
  const version = formatPrmCompactVersionToken(row.route_version);
  return version ? `${name} · ${version}` : name;
}

function isPrmProductSubgroupInactiveForMapping(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  if (r.is_active === false || r.active === false) return true;
  const status = normalizePrmCode(r.status).toUpperCase();
  return status === "INACTIVE" || status === "ARCHIVED";
}

function findPrmProductSubgroupMasterById(subgroups = [], productSubgroupId) {
  const sid = normalizePrmIntegerId(productSubgroupId);
  if (sid == null) return null;
  return (
    coercePrmList(subgroups).find((row) => {
      const id = normalizePrmIntegerId(
        row.product_subgroup_id ?? row.subgroup_id ?? row.id,
      );
      return id === sid;
    }) || null
  );
}

/**
 * Create-time revalidation against current master options.
 * Does not substitute another Route Family. Server uniqueness remains authoritative.
 */
export function validatePrmSubgroupMappingCreateSelection({
  product_subgroup_id = null,
  route_family_id = null,
  productSubgroups = [],
  routeFamilies = [],
  mappings = [],
  approvedFamilyRoutes = [],
} = {}) {
  const reasons = [];
  const sid = normalizePrmIntegerId(product_subgroup_id);
  const fid = normalizePrmIntegerId(route_family_id);
  const subgroup = findPrmProductSubgroupMasterById(productSubgroups, sid);
  if (sid == null) {
    reasons.push({
      code: "missing_product_subgroup",
      message: "Product Subgroup is required.",
      blocksCreate: true,
    });
  } else if (!subgroup) {
    reasons.push({
      code: "product_subgroup_missing",
      message:
        "Selected Product Subgroup is no longer available in the governed master.",
      blocksCreate: true,
    });
  } else if (isPrmProductSubgroupInactiveForMapping(subgroup)) {
    reasons.push({
      code: "product_subgroup_inactive",
      message: "Selected Product Subgroup is inactive.",
      blocksCreate: true,
    });
  }

  const family = findPrmRouteFamilyMasterById(routeFamilies, fid);
  const identity = family
    ? resolvePrmRouteFamilyMasterIdentity(family)
    : fid != null
      ? resolvePrmRouteFamilyMasterIdentity({ route_family_id: fid })
      : resolvePrmRouteFamilyMasterIdentity({});
  let approvedRoute = null;
  if (fid == null) {
    reasons.push({
      code: "missing_route_family",
      message: "Route Family is required.",
      blocksCreate: true,
    });
  } else if (!family) {
    reasons.push({
      code: "stale_route_family",
      message:
        "Selected Route Family is no longer available in the governed master. Mapping cannot be created.",
      blocksCreate: true,
    });
  } else if (identity.route_family_id !== fid) {
    reasons.push({
      code: "stale_route_family",
      message:
        "Selected Route Family no longer matches the governed master. Mapping cannot be created.",
      blocksCreate: true,
    });
  } else if (!identity.resolved) {
    reasons.push({
      code: "route_family_unresolved",
      message: PRM_ROUTE_FAMILY_DETAILS_UNAVAILABLE,
      blocksCreate: true,
    });
  } else if (isPrmRouteFamilyInactiveForMapping(family)) {
    reasons.push({
      code: "route_family_inactive",
      message: "Selected Route Family is inactive.",
      blocksCreate: true,
    });
  } else if (!isPrmRouteFamilyApprovedForGovernance(family)) {
    reasons.push({
      code: "route_family_unapproved",
      message:
        "Selected Route Family is not APPROVED. Mapping cannot be created.",
      blocksCreate: true,
    });
  } else {
    approvedRoute = resolvePrmApprovedFamilyRouteForFamily(
      family,
      approvedFamilyRoutes,
    );
    const catalogue = coercePrmList(approvedFamilyRoutes);
    const catalogueHasRows = catalogue.length > 0;
    const explicitNone =
      Object.prototype.hasOwnProperty.call(family, "approved_family_route_id") &&
      family.approved_family_route_id == null;
    const approvedLabel = approvedRoute
      ? formatPrmApprovedFamilyRouteContextLabel(approvedRoute)
      : "";
    if (!approvedLabel && (catalogueHasRows || explicitNone)) {
      reasons.push({
        code: "no_approved_family_route",
        message:
          "This Route Family has no approved Family Route. Mapping cannot be created until an approved Family Route exists.",
        blocksCreate: true,
      });
    }
  }

  const writable = sid != null ? findPrmWritableSubgroupMapping(mappings, sid) : null;
  if (writable) {
    reasons.push({
      code: "writable_exists",
      message:
        "A replacement mapping already exists. Open the existing mapping.",
      blocksCreate: true,
      mapping_id: writable.mapping_id,
    });
  }
  const approvedMapping =
    sid != null ? findPrmApprovedSubgroupMapping(mappings, sid) : null;

  return {
    ok: reasons.length === 0,
    reasons,
    product_subgroup_id: sid,
    route_family_id: fid,
    subgroup,
    family,
    identity,
    approvedRoute,
    writable,
    approvedMapping,
    requiresApprovedReplacement: Boolean(approvedMapping) && !writable,
  };
}

export function isPrmRouteFamilyArchived(family = {}) {
  if (!isBlankPrmValue(family.archived_at)) return true;
  const status = normalizePrmCode(
    family.status ||
      family.family_status ||
      family.route_family_status ||
      family.approval_status,
  ).toUpperCase();
  return status === "ARCHIVED";
}

export function isPrmRouteFamilyApprovedForGovernance(family = {}) {
  const status = normalizePrmCode(
    family.status ||
      family.family_status ||
      family.route_family_status ||
      family.approval_status,
  ).toUpperCase();
  return status === "APPROVED";
}

export function isPrmRouteFamilyEffectiveForAsOf(family = {}, asOfDate = null) {
  const asOf = normalizePrmAsOfDate(asOfDate, { fallbackToToday: false });
  const from = normalizePrmAsOfDate(family.effective_from, {
    fallbackToToday: false,
  });
  const to = normalizePrmAsOfDate(family.effective_to, { fallbackToToday: false });
  if (from && asOf && from > asOf) return false;
  if (to && asOf && to < asOf) return false;
  return true;
}

/** Master-options Route Families eligible for governed Family Route Draft creation. */
export function isPrmRouteFamilyEligibleForFamilyRouteCreate(
  family = {},
  asOfDate = null,
) {
  if (!family || typeof family !== "object") return false;
  if (isPrmRouteFamilyArchived(family)) return false;
  if (!isPrmRouteFamilyApprovedForGovernance(family)) return false;
  return isPrmRouteFamilyEffectiveForAsOf(family, asOfDate);
}

export function selectPrmRouteFamiliesForFamilyRouteCreate(
  families = [],
  asOfDate = null,
) {
  return coercePrmList(families).filter((row) =>
    isPrmRouteFamilyEligibleForFamilyRouteCreate(row, asOfDate),
  );
}

export function resolvePrmFamilyRouteCreateEligibility(routeState = {}) {
  const approvedId = normalizePrmIntegerId(routeState.approved_family_route_id);
  const openWritableId = normalizePrmIntegerId(routeState.draft_family_route_id);
  const writableVersion = coercePrmList(routeState.versions).find((version) =>
    isPrmRouteWritableStatus(
      version?.status || version?.route_status || version?.approval_status,
    ),
  );
  const writableRouteId =
    openWritableId ??
    normalizePrmIntegerId(
      writableVersion?.family_route_id ??
        writableVersion?.route_id ??
        writableVersion?.id,
    );

  if (writableRouteId != null) {
    return {
      ok: true,
      mode: "writable_exists",
      writableRouteId,
      approvedRouteId: approvedId,
      canCreateFirstDraft: false,
      canCreateSuccessor: false,
      approvedRouteLabel: approvedId != null ? String(approvedId) : "None",
      message: "An editable Family Route version already exists.",
    };
  }

  if (approvedId != null) {
    const approvedVersion =
      routeState.approved ||
      coercePrmList(routeState.versions).find(
        (version) =>
          normalizePrmIntegerId(
            version?.family_route_id ?? version?.route_id ?? version?.id,
          ) === approvedId,
      ) ||
      null;
    const approvedLabel =
      approvedVersion?.route_name ||
      approvedVersion?.version_label ||
      approvedVersion?.version ||
      String(approvedId);
    return {
      ok: true,
      mode: "approved_successor",
      writableRouteId: null,
      approvedRouteId: approvedId,
      canCreateFirstDraft: false,
      canCreateSuccessor: true,
      approvedRouteLabel: approvedLabel,
      message: "An approved Family Route already exists.",
      successorNotice:
        "Creating another Family Route will create a governed successor/new version.",
    };
  }

  return {
    ok: true,
    mode: "first_draft",
    writableRouteId: null,
    approvedRouteId: null,
    canCreateFirstDraft: true,
    canCreateSuccessor: false,
    approvedRouteLabel: "None",
    message: null,
  };
}

/** Deep-link params for Family Route Editor — never includes product ids. */
export function buildFamilyRouteEditorNavParams({
  route_family_id = null,
  family_route_id = null,
} = {}) {
  const familyRouteId = normalizePrmIntegerId(family_route_id);
  if (familyRouteId == null) return null;
  const params = { family_route_id: familyRouteId };
  const routeFamilyId = normalizePrmIntegerId(route_family_id);
  if (routeFamilyId != null) params.route_family_id = routeFamilyId;
  return params;
}

/**
 * Canonical post-create / open Family route navigation target.
 * Opens route-family-route-editor only; never product-route-editor.
 */
export function resolveFamilyRouteCreateNavigation(
  createResult = {},
  routeFamilyId = null,
) {
  const familyRouteId = normalizePrmIntegerId(
    createResult?.family_route_id ?? createResult?.id ?? null,
  );
  const params = buildFamilyRouteEditorNavParams({
    route_family_id: routeFamilyId,
    family_route_id: familyRouteId,
  });
  if (!params) return null;
  return {
    lens: "route-family-route-editor",
    params,
    product_route_id: null,
    product_id: null,
  };
}

/**
 * Resolve Family Route Editor load identity.
 * Request deep-link wins when present; otherwise the committed navigation
 * deep-link. Does not fall back to unrelated selected ids.
 */
export function resolvePrmFamilyRouteEditorLoadId({
  requestDeepLink = {},
  committedDeepLink = {},
} = {}) {
  return (
    normalizePrmIntegerId(requestDeepLink?.family_route_id) ??
    normalizePrmIntegerId(committedDeepLink?.family_route_id) ??
    null
  );
}

/**
 * Empty-context refresh may rewrite family-only URL only when no Family Route
 * is open or being opened, and the request generation is still current.
 */
export function shouldApplyPrmFamilyRouteEmptyContextRefresh({
  selectedFamilyRouteId = null,
  deepLinkFamilyRouteId = null,
  requestGeneration = 0,
  currentGeneration = 0,
} = {}) {
  if (Number(requestGeneration) !== Number(currentGeneration)) return false;
  if (normalizePrmIntegerId(selectedFamilyRouteId) != null) return false;
  if (normalizePrmIntegerId(deepLinkFamilyRouteId) != null) return false;
  return true;
}

/**
 * Family Route editor detail loads may overlap; only the current generation may
 * commit detail/steps/validation into editor state.
 */
export function shouldAcceptPrmFamilyRouteDetailGeneration({
  requestGeneration = 0,
  currentGeneration = 0,
} = {}) {
  return Number(requestGeneration) === Number(currentGeneration);
}

/**
 * Unified PRM visible-paint generation. A stale/superseded load must not paint,
 * hide, or tear down a newer accepted lens.
 * Null/empty request generation means "paint the current accepted generation".
 */
export function shouldAcceptPrmPaintGeneration({
  requestGeneration = null,
  currentGeneration = 0,
} = {}) {
  if (requestGeneration == null || requestGeneration === "") return true;
  return Number(requestGeneration) === Number(currentGeneration);
}

export function shouldApplyPrmLensTransitionTeardown({
  requestGeneration = 0,
  currentGeneration = 0,
} = {}) {
  return shouldAcceptPrmPaintGeneration({
    requestGeneration,
    currentGeneration,
  });
}

export function applyPrmTableWrapVisible(tableWrap) {
  if (!tableWrap?.classList) return { ok: false, reason: "missing_table_wrap" };
  tableWrap.classList.remove("hidden");
  tableWrap.classList.add("tw-visible");
  if (tableWrap.style) tableWrap.style.display = "";
  return { ok: true };
}

/**
 * Pure final visible-paint step. Must not load, invoke RPCs, or mutate business
 * state. Callers pass already-accepted state via render/getRowCount.
 */
export function applyPrmAcceptedPaint({
  tableWrap = null,
  requestGeneration = null,
  currentGeneration = 0,
  render = null,
  getRowCount = null,
  setRowCount = null,
} = {}) {
  if (
    !shouldAcceptPrmPaintGeneration({
      requestGeneration,
      currentGeneration,
    })
  ) {
    return { ok: false, stale: true };
  }
  applyPrmTableWrapVisible(tableWrap);
  if (typeof render === "function") render();
  if (typeof setRowCount === "function") {
    const count =
      typeof getRowCount === "function" ? Number(getRowCount() || 0) : 0;
    setRowCount(count);
  }
  return { ok: true, stale: false };
}

/**
 * Family Route editor lifecycle action-state. Derived from status + validation
 * currentness. Not a local "Validate was clicked" boolean.
 *
 * If route-detail hydration omits a validation blob after a successful
 * validate RPC, callers keep that RPC result as current until
 * markValidationStale() on a validation-relevant mutation.
 */
export function resolvePrmFamilyRouteLifecycleActions({
  status = "",
  canEdit = false,
  validation = null,
  validationFresh = false,
} = {}) {
  const statusUpper = normalizePrmCode(status).toUpperCase();
  const statusCanonical = canonicalPrmRouteStatus(statusUpper) || statusUpper;
  const writable = Boolean(canEdit) && isPrmRouteWritableStatus(statusUpper);
  const review = isPrmRouteReviewStatus(statusUpper);
  const draft = statusUpper === "DRAFT";
  const validCurrent =
    validationFresh === true && isValidationSuccessful(validation);

  const validateVisible = Boolean(canEdit) && draft && writable;
  const submitVisible = writable && draft;
  const approveVisible = Boolean(canEdit) && review;

  return {
    status: statusCanonical,
    validateVisible,
    validateEnabled: validateVisible && !validCurrent,
    validateLabel: validateVisible && validCurrent ? "Validated" : "Validate",
    submitVisible,
    submitEnabled: submitVisible && validCurrent,
    approveVisible,
    canMutateSteps: writable && (draft || review),
    canClone: Boolean(canEdit) && isPrmRouteCloneableStatus(statusUpper),
    readOnly: isPrmRouteReadOnlyStatus(statusUpper),
  };
}

/**
 * Product Route editor lifecycle. Submit matches server
 * rpc_submit_product_route_for_review (DRAFT only). Validate/deltas remain
 * available while the route is writable (DRAFT or review).
 */
export function resolvePrmProductRouteLifecycleActions({
  status = "",
  canEdit = false,
  validation = null,
  validationFresh = false,
} = {}) {
  const statusUpper = normalizePrmCode(status).toUpperCase();
  const statusCanonical = canonicalPrmRouteStatus(statusUpper) || statusUpper;
  const writable = Boolean(canEdit) && isPrmRouteWritableStatus(statusUpper);
  const review = isPrmRouteReviewStatus(statusUpper);
  const draft = statusUpper === "DRAFT";
  const validCurrent =
    validationFresh === true && isValidationSuccessful(validation);

  return {
    status: statusCanonical,
    validateVisible: Boolean(canEdit) && writable,
    validateEnabled: Boolean(canEdit) && writable,
    validateLabel: validCurrent ? "Validated" : "Validate",
    submitVisible: writable && draft,
    submitEnabled: writable && draft && validCurrent,
    approveVisible: Boolean(canEdit) && review,
    canAddDelta: writable,
    canMutateDeltas: writable,
    readOnly: isPrmRouteReadOnlyStatus(statusUpper),
  };
}

/**
 * Resolve the exact family_route_id for the currently open Family Route editor.
 * Does not infer by route name, family, version, or latest route.
 */
export function resolvePrmFamilyRouteEditorRouteId({
  selectedFamilyRouteId = null,
  deepLink = {},
  detail = null,
} = {}) {
  return (
    normalizePrmIntegerId(selectedFamilyRouteId) ??
    normalizePrmIntegerId(deepLink?.family_route_id) ??
    normalizePrmIntegerId(detail?.family_route_id) ??
    normalizePrmIntegerId(detail?.route_family_route_id) ??
    normalizePrmIntegerId(detail?.route_id) ??
    normalizePrmIntegerId(detail?.id) ??
    null
  );
}

export function isCanonicalFamilyRouteEditorNav(nav = {}) {
  if (!nav || nav.lens !== "route-family-route-editor") return false;
  if (normalizePrmIntegerId(nav.params?.family_route_id) == null) return false;
  if (nav.product_route_id != null && nav.product_route_id !== "") return false;
  if (nav.product_id != null && nav.product_id !== "") return false;
  if (
    Object.prototype.hasOwnProperty.call(nav.params || {}, "product_route_id")
  ) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(nav.params || {}, "product_id")) {
    return false;
  }
  return true;
}

/** Pointer-opened modals restore focus without a heavy focus ring. */
export function buildPrmFocusRestoreOptions(openerModality = "keyboard") {
  const options = { preventScroll: true };
  if (openerModality === "pointer") {
    options.focusVisible = false;
  } else {
    options.focusVisible = true;
  }
  return options;
}

export function shouldShowPrmRowFocusRing(openerModality = "keyboard") {
  return openerModality !== "pointer";
}

export function isPendingRouteFamilyMapping(mapping = {}) {
  return isPrmPendingMappingStatus(mapping.status || mapping.mapping_status);
}

export function extractValidationIssues(validatePayload) {
  const root = normalizePrmRpcPayload(validatePayload) || validatePayload;
  if (!root) return [];
  const list = coercePrmList(
    root.issues || root.validation_issues || root.errors || root.messages,
  );
  if (list.length) return list;
  if (root.is_valid === false && root.message) {
    return [{ code: root.code || "INVALID", message: root.message }];
  }
  return [];
}

export function isValidationSuccessful(validatePayload) {
  const root = normalizePrmRpcPayload(validatePayload) || validatePayload;
  if (!root) return false;
  if (root.is_valid === true || root.valid === true || root.ok === true) {
    return extractValidationIssues(root).length === 0;
  }
  if (root.is_valid === false || root.valid === false || root.ok === false) {
    return false;
  }
  const issues = extractValidationIssues(root);
  if (issues.length) return false;
  if (root.status) {
    const status = normalizePrmCode(root.status).toUpperCase();
    return status === "VALID" || status === "PASSED" || status === "OK";
  }
  return false;
}

export function formatPrmBehaviourLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (!upper) return "—";
  return humanizeUnknownPrmCode(upper) || upper;
}

export function formatPrmRouteStepScopeLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (!upper) return "—";
  if (Object.prototype.hasOwnProperty.call(ROUTE_STEP_SCOPE_LABELS, upper)) {
    return ROUTE_STEP_SCOPE_LABELS[upper];
  }
  if (upper.includes("RM") && upper.includes("ISSUE")) return "RM issue boundary";
  if (upper.includes("FG") && upper.includes("TRANSFER")) {
    return "FG transfer boundary";
  }
  if (upper.includes("PRODUCTION") || upper.includes("PROCESS")) {
    return "Production process";
  }
  return humanizeUnknownPrmCode(upper) || upper;
}

export function formatPrmDirectLabourScopeLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (!upper) return "—";
  if (Object.prototype.hasOwnProperty.call(DIRECT_LABOUR_SCOPE_LABELS, upper)) {
    return DIRECT_LABOUR_SCOPE_LABELS[upper];
  }
  return humanizeUnknownPrmCode(upper) || upper;
}

export function formatPrmProductionOverheadScopeLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (!upper) return "—";
  if (
    Object.prototype.hasOwnProperty.call(PRODUCTION_OVERHEAD_SCOPE_LABELS, upper)
  ) {
    return PRODUCTION_OVERHEAD_SCOPE_LABELS[upper];
  }
  return humanizeUnknownPrmCode(upper) || upper;
}

export function formatPrmDriverScopeLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (!upper) return "—";
  if (Object.prototype.hasOwnProperty.call(DIRECT_LABOUR_SCOPE_LABELS, upper)) {
    return DIRECT_LABOUR_SCOPE_LABELS[upper];
  }
  if (
    Object.prototype.hasOwnProperty.call(PRODUCTION_OVERHEAD_SCOPE_LABELS, upper)
  ) {
    return PRODUCTION_OVERHEAD_SCOPE_LABELS[upper];
  }
  return humanizeUnknownPrmCode(upper) || upper;
}

export function isPrmOtherPoolStepScope(code) {
  return PRM_OTHER_POOL_STEP_SCOPES.includes(
    normalizePrmCode(code).toUpperCase(),
  );
}

export function normalizePrmFamilyRouteStep(row = {}, resourceClassContext = {}) {
  const r = row && typeof row === "object" ? row : {};
  const id = normalizePrmIntegerId(
    r.id ?? r.family_route_step_id ?? r.route_step_id ?? r.step_id,
  );
  const sequence_no = Number(r.sequence_no ?? r.sequence ?? r.seq);
  const behaviour_code = normalizePrmCode(
    r.behaviour_code || r.behaviour || r.behavior,
  );
  const resource_class_code = normalizePrmCode(
    r.resource_class_code || r.resource_class,
  );
  const route_step_scope = normalizePrmCode(
    r.route_step_scope || r.step_scope || r.scope,
  );
  const production_overhead_scope = normalizePrmCode(
    r.production_overhead_scope || r.overhead_scope,
  );
  const direct_labour_scope = normalizePrmCode(
    r.direct_labour_scope || r.labor_scope || r.labour_scope,
  );
  const section_name = r.section_name || r.section || "";
  const subsection_name = r.subsection_name || r.subsection || "";
  const area_name = r.area_name || r.area || "";
  const plant_name = r.plant_name || r.plant || "";
  const activity_name =
    r.activity_name || r.activity || r.activity_label || "";
  const cost_centre_name =
    r.cost_centre_name || r.cost_centre || r.cost_centre_label || "";
  const cost_centre_code = r.cost_centre_code || "";
  const step_key = r.step_key || r.step_name || activity_name || "";
  return {
    ...r,
    id,
    family_route_step_id: id,
    step_key,
    sequence_no: Number.isFinite(sequence_no) ? sequence_no : null,
    activity_id: normalizePrmIntegerId(r.activity_id),
    activity_name,
    cost_centre_id: normalizePrmIntegerId(r.cost_centre_id),
    cost_centre_code,
    cost_centre_name,
    section_name,
    subsection_name,
    area_name,
    plant_name,
    behaviour_code,
    behaviour_label: r.behaviour_label || formatPrmBehaviourLabel(behaviour_code),
    resource_class_code,
    resource_class_label: resolvePrmResourceClassDisplayLabel(resource_class_code, {
      catalogue: resourceClassContext.catalogue,
      catalogueIndex: resourceClassContext.catalogueIndex,
      rowLabel: r.resource_class_label || r.resource_class_name,
    }),
    route_step_scope,
    route_step_scope_label:
      r.route_step_scope_label || formatPrmRouteStepScopeLabel(route_step_scope),
    expected_occurrence_count:
      r.expected_occurrence_count ?? r.occurrence_count ?? null,
    standard_cycle_count: r.standard_cycle_count ?? r.cycle_count ?? null,
    is_mandatory: !!(
      r.is_mandatory ??
      r.mandatory ??
      r.is_required
    ),
    allows_repeat: !!(r.allows_repeat ?? r.repeat_allowed ?? r.allows_repeat),
    allows_skip_with_approval: !!(
      r.allows_skip_with_approval ??
      r.skip_with_approval ??
      r.allows_skip
    ),
    production_overhead_scope,
    production_overhead_scope_label:
      r.production_overhead_scope_label ||
      formatPrmProductionOverheadScopeLabel(production_overhead_scope),
    direct_labour_scope,
    direct_labour_scope_label:
      r.direct_labour_scope_label ||
      formatPrmDirectLabourScopeLabel(direct_labour_scope),
    step_note: r.step_note || r.note || r.route_step_note || "",
    step_label:
      r.step_label || formatPrmRouteStepLabel(step_key, activity_name || "Step"),
    location_label: formatPrmHierarchyLabel([
      section_name,
      subsection_name,
      area_name,
      plant_name,
    ]),
  };
}

export function sortPrmFamilyRouteSteps(steps = [], resourceClassContext = {}) {
  return coercePrmList(steps)
    .map((step) => normalizePrmFamilyRouteStep(step, resourceClassContext))
    .sort((a, b) => {
      const sa = a.sequence_no == null ? Number.POSITIVE_INFINITY : a.sequence_no;
      const sb = b.sequence_no == null ? Number.POSITIVE_INFINITY : b.sequence_no;
      if (sa !== sb) return sa - sb;
      return String(a.step_key || "").localeCompare(String(b.step_key || ""));
    });
}

function classifyPrmRouteStepBucket(step = {}) {
  const scope = normalizePrmCode(
    step.route_step_scope || step.step_scope || step.scope,
  ).toUpperCase();
  if (scope === "BOUNDARY_RM_ISSUE") {
    return "rm";
  }
  if (scope === "BOUNDARY_FG_TRANSFER") {
    return "fg";
  }
  if (scope.startsWith("BOUNDARY_")) {
    return "other_boundary";
  }
  return "production";
}

export const PRM_FAMILY_ROUTE_CREATE_PROVENANCE_MODES = Object.freeze({
  MANUAL_FIRST_DRAFT: "manual_first_draft",
  MANUAL_SUCCESSOR: "manual_successor",
  HISTORICAL_HANDOFF: "historical_handoff",
});

export const PRM_FAMILY_ROUTE_CREATE_SOURCE_HELPER =
  "Manual — directly governed from confirmed manufacturing process knowledge.";

export const PRM_FAMILY_ROUTE_CREATE_EVIDENCE_HELPER =
  "Manual complete — the manually defined route is sufficiently specified for governance review. This does not mean the route is approved.";

/** Reserved for future explicit historical handoff — not enabled in current UI. */
export function resolvePrmFamilyRouteCreateProvenanceContext({
  supersedesRouteId = null,
  historicalHandoff = false,
} = {}) {
  if (historicalHandoff === true) {
    return {
      ok: true,
      mode: PRM_FAMILY_ROUTE_CREATE_PROVENANCE_MODES.HISTORICAL_HANDOFF,
      enabled: false,
      source_type: null,
      evidence_status: null,
      readonly: true,
    };
  }
  const successor = normalizePrmIntegerId(supersedesRouteId) != null;
  return {
    ok: true,
    mode: successor
      ? PRM_FAMILY_ROUTE_CREATE_PROVENANCE_MODES.MANUAL_SUCCESSOR
      : PRM_FAMILY_ROUTE_CREATE_PROVENANCE_MODES.MANUAL_FIRST_DRAFT,
    enabled: true,
    source_type: "MANUAL",
    evidence_status: "MANUAL_COMPLETE",
    readonly: true,
  };
}

export function validatePrmFamilyRouteCreateProvenance(
  provenanceContext = {},
  { source_type = null, evidence_status = null } = {},
) {
  if (provenanceContext.enabled === false) {
    return {
      ok: false,
      error: "Historical candidate create is not available.",
    };
  }
  const source = normalizePrmCode(source_type).toUpperCase();
  const evidence = normalizePrmCode(evidence_status).toUpperCase();
  if (source === "COPIED_VERSION") {
    return {
      ok: false,
      error:
        "Copied version provenance is not available in create. Use Clone as New Version.",
    };
  }
  if (source === "HISTORICAL_CANDIDATE") {
    return {
      ok: false,
      error:
        "Historical candidate provenance requires an explicit supported handoff.",
    };
  }
  if (source !== "MANUAL" || evidence !== "MANUAL_COMPLETE") {
    return {
      ok: false,
      error:
        "Family Route create requires Manual source and Manual complete evidence.",
    };
  }
  return {
    ok: true,
    source_type: "MANUAL",
    evidence_status: "MANUAL_COMPLETE",
  };
}

export const PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION = Object.freeze({
  NOT_VALIDATED: "NOT_VALIDATED",
  INCOMPLETE: "INCOMPLETE",
  INVALID: "INVALID",
  VALID: "VALID",
  STALE: "STALE",
});

export function isPrmFamilyRouteStructurallyIncomplete(counts = {}) {
  const stepCount = Number(counts.step_count) || 0;
  const rm = Number(counts.rm_boundary_count) || 0;
  const production = Number(counts.production_process_count) || 0;
  const fg = Number(counts.fg_boundary_count) || 0;
  if (stepCount === 0) return true;
  return rm < 1 || production < 1 || fg < 1;
}

function buildPrmFamilyRouteValidationMetricLabels(summary, presentationMode) {
  const stepCount = summary.step_count;
  const rm = summary.rm_boundary_count;
  const production = summary.production_process_count;
  const fg = summary.fg_boundary_count;
  const issueCount = summary.issues.length;

  if (presentationMode === PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INCOMPLETE) {
    return {
      valid: "Route incomplete — steps required",
      steps: `${stepCount} steps`,
      rm: rm < 1 ? "RM boundary missing" : `${rm} RM boundary`,
      production:
        production < 1
          ? "Production steps missing"
          : `${production} Production steps`,
      fg: fg < 1 ? "FG boundary missing" : `${fg} FG boundary`,
      errors: null,
      showErrors: false,
    };
  }

  const validLabel =
    presentationMode === PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.VALID
      ? "Route valid"
      : "Route invalid";

  return {
    valid: validLabel,
    steps: `${stepCount} steps`,
    rm: `${rm} RM boundary`,
    production: `${production} Production steps`,
    fg: `${fg} FG boundary`,
    errors: issueCount
      ? `${issueCount} error${issueCount === 1 ? "" : "s"}`
      : "0 errors",
    showErrors: true,
  };
}

export function classifyPrmFamilyRouteValidationPresentation(
  validationPayload = null,
  steps = [],
) {
  if (validationPayload == null || validationPayload === "") {
    return {
      mode: PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.NOT_VALIDATED,
    };
  }

  const root = normalizePrmRpcPayload(validationPayload) || validationPayload || {};
  const issues = extractValidationIssues(root);
  const valid = isValidationSuccessful(root);
  const ordered = sortPrmFamilyRouteSteps(steps);
  const fromPayloadSteps =
    root.step_count ??
    root.total_steps ??
    root.steps_count ??
    ordered.length;
  const rmFromPayload = root.rm_boundary_count;
  const prodFromPayload =
    root.production_step_count ?? root.production_process_count;
  const fgFromPayload = root.fg_boundary_count;

  let rm = Number(rmFromPayload);
  let production = Number(prodFromPayload);
  let fg = Number(fgFromPayload);
  if (!Number.isFinite(rm) || !Number.isFinite(production) || !Number.isFinite(fg)) {
    rm = 0;
    production = 0;
    fg = 0;
    for (const step of ordered) {
      const bucket = classifyPrmRouteStepBucket(step);
      if (bucket === "rm") rm += 1;
      else if (bucket === "fg") fg += 1;
      else if (bucket === "production") production += 1;
    }
  }

  const counts = {
    step_count: Number(fromPayloadSteps) || ordered.length,
    rm_boundary_count: rm,
    production_process_count: production,
    fg_boundary_count: fg,
  };

  if (issues.length > 0) {
    return {
      mode: PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INVALID,
      ...counts,
      issues,
      valid: false,
    };
  }

  if (valid) {
    return {
      mode: PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.VALID,
      ...counts,
      issues,
      valid: true,
    };
  }

  if (isPrmFamilyRouteStructurallyIncomplete(counts)) {
    return {
      mode: PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INCOMPLETE,
      ...counts,
      issues,
      valid: false,
    };
  }

  return {
    mode: PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INVALID,
    ...counts,
    issues,
    valid: false,
  };
}

export function buildPrmFamilyRouteValidationSummary(
  validationPayload = null,
  steps = [],
) {
  const root = normalizePrmRpcPayload(validationPayload) || validationPayload || {};
  const ordered = sortPrmFamilyRouteSteps(steps);
  const issues = extractValidationIssues(root);
  const valid = isValidationSuccessful(root);
  const fromPayloadSteps =
    root.step_count ??
    root.total_steps ??
    root.steps_count ??
    ordered.length;
  const rmFromPayload = root.rm_boundary_count;
  const prodFromPayload = root.production_step_count ?? root.production_process_count;
  const fgFromPayload =
    root.fg_boundary_count;

  let rm = Number(rmFromPayload);
  let production = Number(prodFromPayload);
  let fg = Number(fgFromPayload);
  if (!Number.isFinite(rm) || !Number.isFinite(production) || !Number.isFinite(fg)) {
    rm = 0;
    production = 0;
    fg = 0;
    for (const step of ordered) {
      const bucket = classifyPrmRouteStepBucket(step);
      if (bucket === "rm") rm += 1;
      else if (bucket === "fg") fg += 1;
      else if (bucket === "production") production += 1;
    }
  }

  const step_count = Number(fromPayloadSteps) || ordered.length;
  const presentation = classifyPrmFamilyRouteValidationPresentation(root, ordered);
  const presentationMode =
    presentation.mode === PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.NOT_VALIDATED
      ? valid
        ? PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.VALID
        : issues.length > 0
          ? PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INVALID
          : isPrmFamilyRouteStructurallyIncomplete({
              step_count,
              rm_boundary_count: rm,
              production_process_count: production,
              fg_boundary_count: fg,
            })
            ? PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INCOMPLETE
            : PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INVALID
      : presentation.mode;

  const metricBase = {
    step_count,
    rm_boundary_count: rm,
    production_process_count: production,
    fg_boundary_count: fg,
    issues,
  };
  const labels = buildPrmFamilyRouteValidationMetricLabels(
    metricBase,
    presentationMode,
  );

  return {
    valid,
    stale: false,
    presentationMode,
    step_count,
    rm_boundary_count: rm,
    production_process_count: production,
    fg_boundary_count: fg,
    issues,
    has_errors: issues.length > 0,
    labels,
  };
}

export function buildPostExtractionEvidenceGapNotice(previewPayload = null) {
  const root = normalizePrmRpcPayload(previewPayload) || previewPayload || {};
  const evidence =
    root.batch_evidence && typeof root.batch_evidence === "object"
      ? root.batch_evidence
      : root;
  const total = Number(
    evidence.total_batches ?? evidence.batch_count ?? evidence.total,
  );
  const withWip = Number(
    evidence.with_post_extraction_wip ??
      evidence.post_extraction_wip_batches ??
      evidence.with_post_extraction_holding,
  );
  const gaps = coercePrmList(root.evidence_gaps || root.gaps);
  const hasGap =
    gaps.some((gap) => {
      const code = normalizePrmCode(
        gap.code || gap.gap_code || gap.kind || gap.type || gap,
      ).toUpperCase();
      return (
        code.includes("POST_EXTRACTION") ||
        code.includes("FINISHED_BULK") ||
        code.includes("WIP_HOLD")
      );
    }) ||
    (Number.isFinite(withWip) && withWip > 0);

  if (!hasGap || !Number.isFinite(total) || !Number.isFinite(withWip)) {
    return null;
  }
  return {
    informational: true,
    blocks_route: false,
    label: "Informational",
    secondary_label: "Does not block this route",
    message: `Post-extraction finished-bulk holding was observed in ${withWip} of ${total} batches and remains under separate review.`,
    total_batches: total,
    with_post_extraction_wip: withWip,
  };
}

export function buildCollisionSafeSequencePlan(steps = [], orderedIds = []) {
  const byId = new Map();
  for (const step of steps) {
    const id = step?.route_step_id ?? step?.step_id ?? step?.id;
    if (id == null) continue;
    byId.set(String(id), step);
  }
  const order = orderedIds.map(String).filter((id) => byId.has(id));
  for (const id of byId.keys()) {
    if (!order.includes(id)) order.push(id);
  }
  const tempPhase = order.map((id, index) => ({
    id,
    sequence_no: PRM_SEQUENCE_TEMP_BASE + index + 1,
    phase: "temp",
  }));
  const finalPhase = order.map((id, index) => ({
    id,
    sequence_no: index + 1,
    phase: "final",
  }));
  return { order, updates: [...tempPhase, ...finalPhase] };
}

export function filterUntouchedFamilyStepsFromOverrides(overrides = []) {
  return coercePrmList(overrides)
    .map(normalizePrmProductRouteOverride)
    .filter((row) => PRM_DELTA_OPERATIONS.includes(row.operation_type));
}

export function unresolvedGovernanceLabel(value) {
  if (isBlankPrmValue(value)) return "Unresolved — requires review";
  return null;
}

export function pickSupportedCandidatePrefill(candidateStep = {}) {
  const out = {};
  const allowed = [
    "step_key",
    "activity",
    "activity_name",
    "activity_kind",
    "sequence_no",
    "section",
    "subsection",
    "area",
    "plant",
    "expected_occurrence_count",
    "standard_cycle_count",
    "mandatory",
    "repeat_allowed",
    "skip_with_approval",
    "note",
    "evidence_note",
  ];
  for (const key of allowed) {
    if (!isBlankPrmValue(candidateStep[key])) out[key] = candidateStep[key];
  }
  for (const key of [
    "cost_centre_id",
    "cost_centre",
    "behaviour",
    "resource_class",
    "route_step_scope",
    "production_overhead_scope",
    "direct_labour_scope",
  ]) {
    if (!isBlankPrmValue(candidateStep[key])) out[key] = candidateStep[key];
    else out[`__unresolved_${key}`] = true;
  }
  return out;
}

export function isPrmRpcName(name) {
  return PRODUCTION_ROUTE_RPC_NAMES.includes(String(name || "").trim());
}

export function isObsoletePrmRpcName(name) {
  return OBSOLETE_PRM_RPC_NAMES.includes(String(name || "").trim());
}

export function getPrmLocalIsoDate(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const PRM_ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizePrmAsOfDate(value, { fallbackToToday = true } = {}) {
  if (isBlankPrmValue(value)) {
    return fallbackToToday ? getPrmLocalIsoDate() : null;
  }
  const trimmed = String(value).trim();
  if (!PRM_ISO_DATE_RE.test(trimmed)) return null;
  const [y, m, d] = trimmed.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return trimmed;
}

export function normalizePrmIntegerId(value) {
  if (isBlankPrmValue(value)) return null;
  const n = Number(String(value).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function normalizePrmPositiveInteger(value) {
  return normalizePrmIntegerId(value);
}

/** Distinct positive integer array for p_product_group_ids. */
export function normalizePrmIntegerIdArray(value) {
  let list = value;
  if (isBlankPrmValue(list)) return [];
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = String(list)
        .split(/[,\s]+/)
        .filter(Boolean);
    }
  }
  if (!Array.isArray(list)) list = [list];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const id = normalizePrmIntegerId(item);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function buildPrmRpcParams(fields = {}) {
  const params = {};
  const errors = [];

  for (const [key, spec] of Object.entries(fields || {})) {
    if (!spec || typeof spec !== "object") continue;
    const kind = String(spec.kind || "string");
    const required = spec.required === true;
    const raw = spec.value;

    if (kind === "date") {
      // Explicit fallbackToToday:false must win even when required (no silent today).
      const fallbackToToday =
        spec.fallbackToToday === true ||
        (required && spec.fallbackToToday !== false);
      const date = normalizePrmAsOfDate(raw, { fallbackToToday });
      if (date == null) {
        if (required) errors.push(`${key} requires a valid YYYY-MM-DD date`);
        continue;
      }
      params[key] = date;
      continue;
    }

    if (kind === "int" || kind === "bigint") {
      const id = normalizePrmIntegerId(raw);
      if (id == null) {
        if (required) errors.push(`${key} requires a positive integer`);
        continue;
      }
      params[key] = id;
      continue;
    }

    if (kind === "positiveInt") {
      const n = normalizePrmPositiveInteger(raw);
      if (n == null) {
        if (required) errors.push(`${key} requires a positive integer`);
        continue;
      }
      params[key] = n;
      continue;
    }

    if (kind === "intArray") {
      const arr = normalizePrmIntegerIdArray(raw);
      if (!arr.length) {
        if (required) errors.push(`${key} requires a positive integer array`);
        continue;
      }
      params[key] = arr;
      continue;
    }

    if (kind === "json") {
      if (raw === undefined || raw === null) {
        if (required) errors.push(`${key} is required`);
        continue;
      }
      if (typeof raw === "string" && !raw.trim()) {
        if (required) errors.push(`${key} is required`);
        continue;
      }
      params[key] = raw;
      continue;
    }

    if (isBlankPrmValue(raw)) {
      if (required) errors.push(`${key} is required`);
      continue;
    }
    const trimmed = String(raw).trim();
    if (!trimmed) {
      if (required) errors.push(`${key} is required`);
      continue;
    }
    params[key] = trimmed;
  }

  return {
    ok: errors.length === 0,
    params,
    errors,
  };
}

export function buildPrmReadinessArgs({
  as_of_date = null,
  search = null,
  readiness_status = null,
  route_family_id = null,
  product_group_id = null,
  limit = 25,
  offset = 0,
} = {}) {
  const asOf = normalizePrmAsOfDate(as_of_date, { fallbackToToday: true });
  const params = {
    p_as_of_date: asOf || getPrmLocalIsoDate(),
    p_limit: Math.max(1, Number(limit) || 25),
    p_offset: Math.max(0, Number(offset) || 0),
  };
  const q = isBlankPrmValue(search) ? "" : String(search).trim();
  if (q) params.p_search = q;
  const status = isBlankPrmValue(readiness_status)
    ? ""
    : String(readiness_status).trim();
  if (status) params.p_readiness_status = status;
  const familyId = normalizePrmIntegerId(route_family_id);
  if (familyId != null) params.p_route_family_id = familyId;
  const groupId = normalizePrmIntegerId(product_group_id);
  if (groupId != null) params.p_product_group_id = groupId;
  return params;
}

export const PRM_READINESS_COLUMN_DEFS = Object.freeze([
  { key: "product_name", label: "Product", always: true },
  { key: "product_id", label: "Product ID", always: true },
  { key: "product_group_name", label: "Product Group", always: false },
  { key: "route_family_name", label: "Route Family", always: false, altKeys: ["route_family_code"] },
  { key: "monthly_product_quantity", label: "Monthly qty", always: false, altKeys: ["monthly_quantity"] },
  { key: "preferred_batch_size", label: "Preferred batch size", always: false },
  { key: "route_source", label: "Route source", always: false, altKeys: ["effective_route_source"] },
  { key: "route_validation", label: "Route validation", always: false, altKeys: ["validation_status", "is_valid"] },
  { key: "step_count", label: "Steps", always: false },
  { key: "readiness_status", label: "Readiness", always: true },
  { key: "readiness_note", label: "Note", always: false, altKeys: ["blocking_reason", "blocker_reason", "block_reason"] },
]);

export function rowHasPrmReadinessField(row = {}, def) {
  if (!def) return false;
  if (!isBlankPrmValue(row[def.key])) return true;
  for (const alt of def.altKeys || []) {
    if (!isBlankPrmValue(row[alt])) return true;
  }
  return false;
}

export function selectPrmReadinessColumns(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  return PRM_READINESS_COLUMN_DEFS.filter(
    (def) => def.always || list.some((row) => rowHasPrmReadinessField(row, def)),
  );
}

export function getPrmReadinessCellValue(row = {}, def) {
  if (!def) return null;
  if (!isBlankPrmValue(row[def.key])) return row[def.key];
  for (const alt of def.altKeys || []) {
    if (!isBlankPrmValue(row[alt])) return row[alt];
  }
  return null;
}

/** Normalize status_counts object or [{status,count}] into { CODE: number }. */
export function normalizePrmStatusCounts(raw) {
  if (raw == null) return {};
  const out = {};
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const code = normalizePrmCode(
        item.status ?? item.readiness_status ?? item.code ?? item.key,
      ).toUpperCase();
      const n = Number(item.count ?? item.total ?? item.n ?? item.value);
      if (code && Number.isFinite(n) && n >= 0) out[code] = n;
    }
    return out;
  }
  if (typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      const code = normalizePrmCode(key).toUpperCase();
      const n = Number(value);
      if (code && Number.isFinite(n) && n >= 0) out[code] = n;
    }
  }
  return out;
}

export function sumPrmStatusCounts(counts = {}) {
  return Object.values(counts || {}).reduce((sum, n) => {
    const v = Number(n);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
}

/**
 * Statuses with count > 0 for primary Costing Readiness filter chips.
 * Unknown codes still get a humanised label via formatPrmReadinessLabel.
 */
export function selectPrmPrimaryReadinessFilterStatuses(statusCounts = {}) {
  const counts = statusCounts && typeof statusCounts === "object" ? statusCounts : {};
  const knownOrder = PRM_READINESS_STATUSES.filter(
    (code) => Number(counts[code]) > 0,
  );
  const extras = Object.keys(counts)
    .filter((code) => Number(counts[code]) > 0 && !PRM_READINESS_STATUSES.includes(code))
    .sort();
  return [...knownOrder, ...extras];
}

/**
 * Exact-run Costing Readiness args.
 * Never falls back to "today" for period/valuation; refresh_run_id required.
 * Offset may be 0 (pagination start) — built manually like general readiness.
 */
export function buildPrmExactRunReadinessArgs({
  period_start = null,
  valuation_date = null,
  refresh_run_id = null,
  search = null,
  readiness_status = null,
  route_family_id = null,
  product_group_id = null,
  limit = 25,
  offset = 0,
} = {}) {
  const errors = [];
  const period = normalizePrmAsOfDate(period_start, { fallbackToToday: false });
  const valuation = normalizePrmAsOfDate(valuation_date, {
    fallbackToToday: false,
  });
  const runId = normalizePrmIntegerId(refresh_run_id);
  if (!period) errors.push("p_period_start requires a valid YYYY-MM-DD date");
  if (!valuation) errors.push("p_valuation_date requires a valid YYYY-MM-DD date");
  if (runId == null) errors.push("p_refresh_run_id requires a positive integer");
  if (errors.length) {
    return { ok: false, params: {}, errors };
  }
  const params = {
    p_period_start: period,
    p_valuation_date: valuation,
    p_refresh_run_id: runId,
    p_limit: Math.max(1, Number(limit) || 25),
    p_offset: Math.max(0, Number(offset) || 0),
  };
  const q = isBlankPrmValue(search) ? "" : String(search).trim();
  if (q) params.p_search = q;
  const status = isBlankPrmValue(readiness_status)
    ? ""
    : String(readiness_status).trim();
  if (status) params.p_readiness_status = status;
  const familyId = normalizePrmIntegerId(route_family_id);
  if (familyId != null) params.p_route_family_id = familyId;
  const groupId = normalizePrmIntegerId(product_group_id);
  if (groupId != null) params.p_product_group_id = groupId;
  return { ok: true, params, errors: [] };
}

export function buildPrmMasterOptionsArgs({
  product_id = null,
  product_group_id = null,
  route_family_id = null,
  as_of_date = null,
} = {}) {
  return buildPrmRpcParams({
    p_product_id: { kind: "int", value: product_id },
    p_product_group_id: { kind: "int", value: product_group_id },
    p_route_family_id: { kind: "int", value: route_family_id },
    p_as_of_date: {
      kind: "date",
      value: as_of_date,
      required: true,
      fallbackToToday: true,
    },
  });
}

export function buildPrmProductCandidateArgs({
  product_id = null,
  as_of_date = null,
  lookback_months = null,
} = {}) {
  return buildPrmRpcParams({
    p_product_id: { kind: "bigint", value: product_id, required: true },
    p_as_of_date: {
      kind: "date",
      value: as_of_date,
      required: true,
      fallbackToToday: true,
    },
    p_lookback_months: { kind: "positiveInt", value: lookback_months },
  });
}

export function buildPrmDeltaCandidateArgs({
  product_id = null,
  as_of_date = null,
  lookback_months = null,
} = {}) {
  return buildPrmProductCandidateArgs({
    product_id,
    as_of_date,
    lookback_months,
  });
}

export function ensurePrmAsOfDateInitialized(inputEl = null) {
  const el =
    inputEl ||
    (typeof document !== "undefined"
      ? document.getElementById("prmAsOfDate")
      : null);
  const today = getPrmLocalIsoDate();
  const current = el?.value;
  const normalised = normalizePrmAsOfDate(current, { fallbackToToday: true });
  const value = normalised || today;
  if (el && el.value !== value) el.value = value;
  return value;
}

export function formatPrmRpcError(rpcName, params, error) {
  const name = String(rpcName || "rpc").trim() || "rpc";
  const msg =
    error?.message ||
    error?.error_description ||
    error?.hint ||
    "Unknown RPC error";
  const details = error?.details || error?.detail || null;
  const hint = error?.hint || null;
  const code = error?.code || error?.status || error?.statusCode || null;
  const safeParams = params && typeof params === "object" ? params : {};
  const lines = [
    `${name} failed${code != null ? ` (${code})` : ""}: ${msg}`,
    `Parameters: ${JSON.stringify(safeParams)}`,
  ];
  if (details) lines.push(`Details: ${String(details)}`);
  if (hint) lines.push(`Hint: ${String(hint)}`);
  return lines.join("\n");
}

/** Gate 11Y.10I.2A — Mapping Review candidate RPC args (bounded Run-82 context). */
export function buildPrmMappingReviewCandidatesArgs({
  period_start = PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT.period_start,
  valuation_date = PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT.valuation_date,
  refresh_run_id = PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT.refresh_run_id,
  as_of_date = null,
  candidate_class = null,
  product_group_id = null,
  search = null,
  limit = 100,
  offset = 0,
} = {}) {
  const errors = [];
  const period = normalizePrmAsOfDate(period_start, { fallbackToToday: false });
  const valuation = normalizePrmAsOfDate(valuation_date, {
    fallbackToToday: false,
  });
  const runId = normalizePrmIntegerId(refresh_run_id);
  if (!period) errors.push("p_period_start requires a valid YYYY-MM-DD date");
  if (!valuation) errors.push("p_valuation_date requires a valid YYYY-MM-DD date");
  if (runId == null) errors.push("p_refresh_run_id requires a positive integer");
  const asOf = normalizePrmAsOfDate(as_of_date, { fallbackToToday: true });
  const classRaw = isBlankPrmValue(candidate_class)
    ? ""
    : String(candidate_class).trim().toUpperCase();
  if (
    classRaw &&
    !PRM_MAPPING_REVIEW_CANDIDATE_CLASSES.includes(classRaw)
  ) {
    errors.push("p_candidate_class is not a recognised mapping-review class");
  }
  if (errors.length) {
    return { ok: false, params: {}, errors };
  }
  const params = {
    p_period_start: period,
    p_valuation_date: valuation,
    p_refresh_run_id: runId,
    p_as_of_date: asOf,
    p_limit: Math.max(1, Math.min(Number(limit) || 100, 500)),
    p_offset: Math.max(0, Number(offset) || 0),
  };
  if (classRaw) params.p_candidate_class = classRaw;
  const groupId = normalizePrmIntegerId(product_group_id);
  if (groupId != null) params.p_product_group_id = groupId;
  const q = isBlankPrmValue(search) ? "" : String(search).trim();
  if (q) params.p_search = q;
  return { ok: true, params, errors: [] };
}

export function normalizePrmMappingReviewCandidateRow(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  return {
    ...r,
    product_id: normalizePrmIntegerId(r.product_id),
    product_name: r.product_name ?? null,
    category_id: normalizePrmIntegerId(r.category_id),
    category_name: r.category_name ?? null,
    sub_category_id: normalizePrmIntegerId(r.sub_category_id),
    subcategory_name: r.subcategory_name ?? null,
    product_group_id: normalizePrmIntegerId(r.product_group_id),
    product_group_name: r.product_group_name ?? null,
    readiness_status: r.readiness_status ?? null,
    ready_products_same_group: Number(r.ready_products_same_group) || 0,
    distinct_ready_route_families_same_group:
      Number(r.distinct_ready_route_families_same_group) || 0,
    candidate_route_family_id: normalizePrmIntegerId(
      r.candidate_route_family_id,
    ),
    candidate_route_family_code: r.candidate_route_family_code ?? null,
    candidate_route_family_name: r.candidate_route_family_name ?? null,
    candidate_route_family_status: r.candidate_route_family_status ?? null,
    candidate_class: normalizePrmCode(r.candidate_class).toUpperCase() || null,
    has_pending_group_mapping: r.has_pending_group_mapping === true,
    has_pending_product_assignment: r.has_pending_product_assignment === true,
  };
}

export function normalizePrmMappingReviewPayload(raw) {
  const payload = normalizePrmRpcPayload(raw) || raw || {};
  const rows = coercePrmList(payload.rows).map(normalizePrmMappingReviewCandidateRow);
  const classSummary = coercePrmList(payload.class_summary).map((item) => {
    const row = item && typeof item === "object" ? item : {};
    return {
      candidate_class:
        normalizePrmCode(row.candidate_class).toUpperCase() || null,
      product_count: Number(row.product_count) || 0,
      product_group_count: Number(row.product_group_count) || 0,
    };
  });
  return {
    period_start: payload.period_start ?? null,
    valuation_date: payload.valuation_date ?? null,
    refresh_run_id: normalizePrmIntegerId(payload.refresh_run_id),
    as_of_date: payload.as_of_date ?? null,
    total_blocked_product_count:
      Number(payload.total_blocked_product_count) || 0,
    filtered_count: Number(payload.filtered_count) || 0,
    limit: Number(payload.limit) || 0,
    offset: Number(payload.offset) || 0,
    class_summary: classSummary,
    rows,
  };
}

/**
 * Presentation aggregation only — candidate family/class must already be on
 * each server row (never inferred).
 */
export function aggregatePrmMappingReviewGroups(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const byGroup = new Map();
  for (const raw of list) {
    const row = normalizePrmMappingReviewCandidateRow(raw);
    const groupId = row.product_group_id;
    if (groupId == null) continue;
    if (!byGroup.has(groupId)) {
      byGroup.set(groupId, {
        product_group_id: groupId,
        product_group_name: row.product_group_name,
        category_id: row.category_id,
        category_name: row.category_name,
        sub_category_id: row.sub_category_id,
        subcategory_name: row.subcategory_name,
        candidate_class: row.candidate_class,
        candidate_route_family_id: row.candidate_route_family_id,
        candidate_route_family_code: row.candidate_route_family_code,
        candidate_route_family_name: row.candidate_route_family_name,
        candidate_route_family_status: row.candidate_route_family_status,
        ready_products_same_group: row.ready_products_same_group,
        has_pending_group_mapping: false,
        has_pending_product_assignment: false,
        members: [],
      });
    }
    const group = byGroup.get(groupId);
    group.members.push(row);
    if (row.has_pending_group_mapping) group.has_pending_group_mapping = true;
    if (row.has_pending_product_assignment) {
      group.has_pending_product_assignment = true;
    }
    if (row.ready_products_same_group > group.ready_products_same_group) {
      group.ready_products_same_group = row.ready_products_same_group;
    }
    // Preserve server candidate fields; do not invent when missing.
    if (
      group.candidate_route_family_id == null &&
      row.candidate_route_family_id != null
    ) {
      group.candidate_route_family_id = row.candidate_route_family_id;
      group.candidate_route_family_code = row.candidate_route_family_code;
      group.candidate_route_family_name = row.candidate_route_family_name;
      group.candidate_route_family_status = row.candidate_route_family_status;
    }
    if (!group.candidate_class && row.candidate_class) {
      group.candidate_class = row.candidate_class;
    }
  }
  return [...byGroup.values()]
    .map((group) => ({
      ...group,
      blocked_product_count: group.members.length,
    }))
    .sort((a, b) => {
      const cat = String(a.category_name || "").localeCompare(
        String(b.category_name || ""),
      );
      if (cat) return cat;
      const sub = String(a.subcategory_name || "").localeCompare(
        String(b.subcategory_name || ""),
      );
      if (sub) return sub;
      return String(a.product_group_name || "").localeCompare(
        String(b.product_group_name || ""),
      );
    });
}

export function formatPrmMappingReviewClassLabel(candidateClass) {
  const code = normalizePrmCode(candidateClass).toUpperCase();
  if (code === "SAME_GROUP_SINGLE_FAMILY_EVIDENCE") {
    return "Mapping candidate — review required";
  }
  if (code === "NO_READY_SAME_GROUP_EVIDENCE") {
    return "New Route Family foundation required";
  }
  if (code === "AMBIGUOUS_SAME_GROUP_FAMILY_EVIDENCE") {
    return "Ambiguous same-group evidence — review only";
  }
  return humanizeUnknownPrmCode(code) || code || "—";
}

export function formatPrmMappingReviewReadinessLabel(status) {
  const code = normalizePrmCode(status).toUpperCase();
  if (code === "BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING") {
    return "No approved Route Family mapping";
  }
  return humanizeUnknownPrmCode(code) || code || "—";
}

export function buildPrmMappingReviewEvidenceNote(group = {}) {
  const ready = Number(group.ready_products_same_group) || 0;
  const code =
    group.candidate_route_family_code ||
    (group.candidate_route_family_id != null
      ? `Family ${group.candidate_route_family_id}`
      : "candidate family");
  return `Same Product Group evidence: ${ready} Ready Product${
    ready === 1 ? "" : "s"
  } consistently resolve to ${code}.`;
}

export function getPrmMappingReviewClassSummaryCounts(classSummary = []) {
  const list = Array.isArray(classSummary) ? classSummary : [];
  const find = (code) =>
    list.find(
      (item) =>
        normalizePrmCode(item?.candidate_class).toUpperCase() === code,
    ) || null;
  const same = find("SAME_GROUP_SINGLE_FAMILY_EVIDENCE");
  const none = find("NO_READY_SAME_GROUP_EVIDENCE");
  const ambiguous = find("AMBIGUOUS_SAME_GROUP_FAMILY_EVIDENCE");
  return {
    same_group_products: Number(same?.product_count) || 0,
    same_group_groups: Number(same?.product_group_count) || 0,
    no_ready_products: Number(none?.product_count) || 0,
    no_ready_groups: Number(none?.product_group_count) || 0,
    ambiguous_products: Number(ambiguous?.product_count) || 0,
    ambiguous_groups: Number(ambiguous?.product_group_count) || 0,
  };
}

/** Gate 11Y.10I.2B.3 — Foundation Review RPC args (bounded Run-82 context). */
export function buildPrmFoundationReviewArgs({
  period_start = PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.period_start,
  valuation_date = PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.valuation_date,
  refresh_run_id = PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT.refresh_run_id,
  as_of_date = null,
  lookback_months = null,
  group_evidence_class = null,
  product_group_id = null,
  search = null,
  limit = 25,
  offset = 0,
} = {}) {
  const errors = [];
  const period = normalizePrmAsOfDate(period_start, { fallbackToToday: false });
  const valuation = normalizePrmAsOfDate(valuation_date, {
    fallbackToToday: false,
  });
  const runId = normalizePrmIntegerId(refresh_run_id);
  if (!period) errors.push("p_period_start requires a valid YYYY-MM-DD date");
  if (!valuation) errors.push("p_valuation_date requires a valid YYYY-MM-DD date");
  if (runId == null) errors.push("p_refresh_run_id requires a positive integer");
  const asOf = normalizePrmAsOfDate(as_of_date, { fallbackToToday: true });
  const classRaw = isBlankPrmValue(group_evidence_class)
    ? ""
    : String(group_evidence_class).trim().toUpperCase();
  if (
    classRaw &&
    !PRM_FOUNDATION_REVIEW_GROUP_EVIDENCE_CLASSES.includes(classRaw)
  ) {
    errors.push(
      "p_group_evidence_class is not a recognised foundation-review class",
    );
  }
  if (errors.length) {
    return { ok: false, params: {}, errors };
  }
  const params = {
    p_period_start: period,
    p_valuation_date: valuation,
    p_refresh_run_id: runId,
    p_as_of_date: asOf,
    p_limit: Math.max(1, Math.min(Number(limit) || 25, 100)),
    p_offset: Math.max(0, Number(offset) || 0),
  };
  if (classRaw) params.p_group_evidence_class = classRaw;
  const lookback = normalizePrmIntegerId(lookback_months);
  if (lookback != null) params.p_lookback_months = lookback;
  const groupId = normalizePrmIntegerId(product_group_id);
  if (groupId != null) params.p_product_group_id = groupId;
  const q = isBlankPrmValue(search) ? "" : String(search).trim();
  if (q) params.p_search = q;
  return { ok: true, params, errors: [] };
}

export function formatPrmFoundationGroupEvidenceClassLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (upper === "ALL_PRODUCTS_SUFFICIENT") {
    return "All Products have sufficient historical evidence";
  }
  if (upper === "MIXED_WITH_SUFFICIENT") {
    return "Mixed evidence; some Products are sufficient";
  }
  if (upper === "LIMITED_ONLY") {
    return "Limited historical evidence only";
  }
  if (upper === "LIMITED_AND_NONE") {
    return "Limited evidence plus Products with no eligible history";
  }
  if (upper === "NO_EVIDENCE_ALL") {
    return "No eligible historical evidence";
  }
  return upper || "—";
}

export function formatPrmFoundationProductEvidenceClassLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (upper === "HISTORICAL_EVIDENCE_SUFFICIENT") return "Sufficient";
  if (upper === "HISTORICAL_EVIDENCE_LIMITED") return "Limited";
  if (upper === "NO_ELIGIBLE_HISTORICAL_EVIDENCE") {
    return "No eligible historical evidence";
  }
  return upper || "—";
}

export function formatPrmFoundationFamilyStepEvidenceClassLabel(code) {
  const upper = normalizePrmCode(code).toUpperCase();
  if (upper === "FAMILY_CORE_STEP") return "Core";
  if (upper === "FAMILY_COMMON_STEP") return "Common";
  if (upper === "FAMILY_OCCASIONAL_STEP") return "Occasional";
  if (upper === "FAMILY_EXCEPTION_STEP") return "Exception";
  return upper || "—";
}

export function formatPrmFoundationReviewGuidanceNote(groupEvidenceClass) {
  const upper = normalizePrmCode(groupEvidenceClass).toUpperCase();
  if (
    upper === "ALL_PRODUCTS_SUFFICIENT" ||
    upper === "MIXED_WITH_SUFFICIENT"
  ) {
    return "Foundation evidence available for governed design review.";
  }
  if (upper === "LIMITED_ONLY" || upper === "LIMITED_AND_NONE") {
    return "Historical evidence is incomplete and requires operator/domain review before Route Family design.";
  }
  if (upper === "NO_EVIDENCE_ALL") {
    return "Historical process evidence unavailable — governed manual foundation design required.";
  }
  return "Foundation evidence is review-only.";
}

export function normalizePrmFoundationReviewProduct(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  return {
    product_id: normalizePrmIntegerId(r.product_id),
    product_name: r.product_name ?? null,
    evidence_class: normalizePrmCode(r.evidence_class).toUpperCase() || null,
    eligible_batches: Number(r.eligible_batches) || 0,
    candidate_status: r.candidate_status ?? null,
  };
}

export function normalizePrmFoundationReviewFamilyStep(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  return {
    activity_kind_id: normalizePrmIntegerId(r.activity_kind_id),
    activity_kind_name: r.activity_kind_name ?? null,
    activity_short_code: r.activity_short_code ?? null,
    family_evidence_class:
      normalizePrmCode(r.family_evidence_class).toUpperCase() || null,
    products_supporting_step: Number(r.products_supporting_step) || 0,
    products_with_any_evidence: Number(r.products_with_any_evidence) || 0,
    product_support_ratio:
      r.product_support_ratio == null || r.product_support_ratio === ""
        ? null
        : Number(r.product_support_ratio),
    average_product_batch_coverage:
      r.average_product_batch_coverage == null ||
      r.average_product_batch_coverage === ""
        ? null
        : Number(r.average_product_batch_coverage),
    modal_area_id: normalizePrmIntegerId(r.modal_area_id ?? r.area_id),
    modal_plant_id: normalizePrmIntegerId(r.modal_plant_id ?? r.plant_id),
    modal_area_name: r.modal_area_name ?? r.area_name ?? null,
    modal_plant_name: r.modal_plant_name ?? r.plant_name ?? null,
    modal_section_id: normalizePrmIntegerId(r.modal_section_id),
    modal_subsection_id: normalizePrmIntegerId(r.modal_subsection_id),
  };
}

export function normalizePrmFoundationReviewGroup(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  return {
    category_id: normalizePrmIntegerId(r.category_id),
    category_name: r.category_name ?? null,
    sub_category_id: normalizePrmIntegerId(r.sub_category_id),
    subcategory_name: r.subcategory_name ?? null,
    product_group_id: normalizePrmIntegerId(r.product_group_id),
    product_group_name: r.product_group_name ?? null,
    product_count: Number(r.product_count) || 0,
    sufficient_products: Number(r.sufficient_products) || 0,
    limited_products: Number(r.limited_products) || 0,
    no_evidence_products: Number(r.no_evidence_products) || 0,
    total_eligible_batches: Number(r.total_eligible_batches) || 0,
    avg_eligible_batches:
      r.avg_eligible_batches == null || r.avg_eligible_batches === ""
        ? null
        : Number(r.avg_eligible_batches),
    max_eligible_batches: Number(r.max_eligible_batches) || 0,
    group_evidence_class:
      normalizePrmCode(r.group_evidence_class).toUpperCase() || null,
    products: coercePrmList(r.products).map(normalizePrmFoundationReviewProduct),
    family_steps: coercePrmList(r.family_steps).map(
      normalizePrmFoundationReviewFamilyStep,
    ),
    foundation_summary: r.foundation_summary ?? null,
    historical_policy: r.historical_policy ?? r.policy ?? null,
    approvable: false,
    approval_note:
      r.approval_note ||
      "Foundation evidence is review-only. It never creates a Route Family, mapping or approved route.",
  };
}

export function normalizePrmFoundationReviewPayload(raw) {
  const payload = normalizePrmRpcPayload(raw) || raw || {};
  const classSummary = coercePrmList(payload.class_summary).map((item) => {
    const row = item && typeof item === "object" ? item : {};
    return {
      group_evidence_class:
        normalizePrmCode(row.group_evidence_class).toUpperCase() || null,
      group_count: Number(row.group_count) || 0,
      product_count: Number(row.product_count) || 0,
    };
  });
  return {
    period_start: payload.period_start ?? null,
    valuation_date: payload.valuation_date ?? null,
    refresh_run_id: normalizePrmIntegerId(payload.refresh_run_id),
    as_of_date: payload.as_of_date ?? null,
    lookback_months: normalizePrmIntegerId(payload.lookback_months),
    policy: payload.policy ?? null,
    target_product_count: Number(payload.target_product_count) || 0,
    target_product_group_count: Number(payload.target_product_group_count) || 0,
    filtered_group_count: Number(payload.filtered_group_count) || 0,
    limit: Number(payload.limit) || 25,
    offset: Number(payload.offset) || 0,
    class_summary: classSummary,
    groups: coercePrmList(payload.groups).map(normalizePrmFoundationReviewGroup),
    approvable: false,
    approval_note:
      payload.approval_note ||
      "Foundation evidence is review-only. It never creates a Route Family, mapping or approved route.",
  };
}

export function getPrmFoundationReviewClassSummaryMap(classSummary = []) {
  const list = Array.isArray(classSummary) ? classSummary : [];
  const out = {};
  for (const code of PRM_FOUNDATION_REVIEW_GROUP_EVIDENCE_CLASSES) {
    const match = list.find(
      (item) =>
        normalizePrmCode(item?.group_evidence_class).toUpperCase() === code,
    );
    out[code] = {
      group_count: Number(match?.group_count) || 0,
      product_count: Number(match?.product_count) || 0,
    };
  }
  return out;
}

export function formatPrmFoundationSupportRatio(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  if (n <= 1) return Math.round(n * 1000) / 10 + "%";
  return String(n);
}

export function formatPrmFoundationIdLabel(kind, id) {
  const normalized = normalizePrmIntegerId(id);
  if (normalized == null) return "—";
  return String(kind) + " " + String(normalized);
}

/** Gate 11Y.10I.2C.1B — Cost Centre list/detail helpers. */
export function normalizePrmCostCentreValidation(raw) {
  const v = raw && typeof raw === "object" ? raw : {};
  const errors = Array.isArray(v.errors)
    ? v.errors.map((e) => String(e))
    : coercePrmList(v.errors).map((e) => String(e));
  return {
    cost_centre_id: normalizePrmIntegerId(v.cost_centre_id),
    status: normalizePrmCode(v.status).toUpperCase() || null,
    valid: v.valid === true || v.valid === "true",
    errors,
  };
}

export function formatPrmCostCentreValidationLabel(validation) {
  const v = normalizePrmCostCentreValidation(validation);
  if (v.valid) return "Valid";
  if (v.errors?.length) return `Invalid (${v.errors.length})`;
  return "Invalid";
}

export function normalizePrmProductionCostCentreRow(
  row = {},
  resourceClassContext = {},
) {
  const r = row && typeof row === "object" ? row : {};
  const base = normalizePrmCostCentreRow(r, resourceClassContext);
  const validation = normalizePrmCostCentreValidation(r.validation);
  const type = normalizePrmCode(
    r.cost_centre_type || r.type || base.type,
  ).toUpperCase();
  const defaultCode = normalizePrmCode(
    r.default_resource_class_code || r.resource_class || base.resource_class,
  ).toUpperCase() || null;
  return {
    ...base,
    cost_centre_id: normalizePrmIntegerId(
      r.cost_centre_id ?? r.id ?? base.cost_centre_id,
    ),
    cost_centre_code: r.cost_centre_code || base.code || "",
    cost_centre_name: r.cost_centre_name || base.name || "",
    cost_centre_type: type,
    type,
    type_label: formatPrmCostCentreTypeLabel(type),
    section_id: normalizePrmIntegerId(r.section_id),
    subsection_id: normalizePrmIntegerId(r.subsection_id),
    area_id: normalizePrmIntegerId(r.area_id),
    plant_id: normalizePrmIntegerId(r.plant_id),
    section_name: r.section_name ?? null,
    subsection_name: r.subsection_name ?? null,
    area_name: r.area_name ?? null,
    plant_name: r.plant_name ?? null,
    default_resource_class_code: defaultCode,
    resource_class_label: resolvePrmResourceClassDisplayLabel(defaultCode, {
      catalogue: resourceClassContext.catalogue,
      catalogueIndex: resourceClassContext.catalogueIndex,
      rowLabel: r.resource_class_label || base.resource_class_label,
    }),
    default_resource_class_label: resolvePrmResourceClassDisplayLabel(
      defaultCode,
      {
        catalogue: resourceClassContext.catalogue,
        catalogueIndex: resourceClassContext.catalogueIndex,
        rowLabel:
          r.default_resource_class_label ||
          r.resource_class_label ||
          base.resource_class_label,
      },
    ),
    pool_scope: base.pool_scope,
    pool_scope_label: formatPrmCostCentrePoolScopeLabel(base.pool_scope),
    status: normalizePrmCode(
      r.status || r.approval_status || base.status,
    ).toUpperCase() || null,
    effective_from: r.effective_from ?? null,
    effective_to: r.effective_to ?? null,
    approval_reference: r.approval_reference ?? null,
    inactivation_reference: r.inactivation_reference ?? null,
    description: r.description ?? null,
    validation,
    validation_label: formatPrmCostCentreValidationLabel(validation),
    section_subsection_label:
      formatPrmHierarchyLabel([r.section_name, r.subsection_name]) || "—",
  };
}

export function normalizePrmProductionCostCentresPayload(
  raw,
  resourceClassContext = {},
) {
  const payload = normalizePrmRpcPayload(raw) || raw || {};
  const centres = coercePrmList(payload.cost_centres).map((row) =>
    normalizePrmProductionCostCentreRow(row, resourceClassContext),
  );
  return {
    as_of_date: payload.as_of_date ?? null,
    cost_centres: centres,
    total_count: centres.length,
  };
}

export function normalizePrmProductionCostCentreDetailPayload(
  raw,
  resourceClassContext = {},
) {
  const payload = normalizePrmRpcPayload(raw) || raw || {};
  const centreRaw =
    payload.cost_centre && typeof payload.cost_centre === "object"
      ? payload.cost_centre
      : payload;
  return {
    cost_centre: normalizePrmProductionCostCentreRow(
      centreRaw,
      resourceClassContext,
    ),
  };
}

export function buildPrmProductionCostCentresArgs({
  as_of_date = null,
  status = null,
  pool_scope = null,
  search = null,
} = {}) {
  const asOf = normalizePrmAsOfDate(as_of_date, { fallbackToToday: true });
  const statusRaw = isBlankPrmValue(status)
    ? ""
    : String(status).trim().toUpperCase();
  const poolRaw = isBlankPrmValue(pool_scope)
    ? ""
    : String(pool_scope).trim().toUpperCase();
  const errors = [];
  if (statusRaw && !PRM_COST_CENTRE_STATUSES.includes(statusRaw)) {
    errors.push("p_status is not a recognised cost-centre status");
  }
  if (poolRaw && !PRM_COST_CENTRE_POOL_SCOPES.includes(poolRaw)) {
    errors.push("p_pool_scope is not a recognised pool scope");
  }
  if (errors.length) return { ok: false, params: {}, errors };
  const params = { p_as_of_date: asOf };
  if (statusRaw) params.p_status = statusRaw;
  if (poolRaw) params.p_pool_scope = poolRaw;
  if (!isBlankPrmValue(search)) params.p_search = String(search).trim();
  return { ok: true, params, errors: [] };
}

export function buildPrmProductionCostCentreDetailArgs({
  cost_centre_id = null,
} = {}) {
  const id = normalizePrmIntegerId(cost_centre_id);
  if (id == null) {
    return {
      ok: false,
      params: {},
      errors: ["p_cost_centre_id requires a positive integer"],
    };
  }
  return { ok: true, params: { p_cost_centre_id: id }, errors: [] };
}

export function buildPrmCreateProductionCostCentreDraftArgs({
  cost_centre_code = null,
  cost_centre_name = null,
  cost_centre_type = null,
  section_id = null,
  subsection_id = null,
  area_id = null,
  plant_id = null,
  default_resource_class_code = null,
  pool_scope = "SHARED_ROUTE",
  effective_from = null,
  description = null,
} = {}) {
  const errors = [];
  const code = String(cost_centre_code ?? "").trim().toUpperCase();
  const name = String(cost_centre_name ?? "").trim();
  const type = String(cost_centre_type ?? "").trim().toUpperCase();
  const pool = String(pool_scope ?? "SHARED_ROUTE").trim().toUpperCase();
  if (!code) errors.push("Cost-centre code is required");
  if (!name) errors.push("Cost-centre name is required");
  if (!PRM_COST_CENTRE_TYPES.includes(type)) {
    errors.push("Invalid cost-centre type");
  }
  if (!PRM_COST_CENTRE_POOL_SCOPES.includes(pool)) {
    errors.push("Invalid pool scope");
  }
  if (errors.length) return { ok: false, params: {}, errors };
  const params = {
    p_cost_centre_code: code,
    p_cost_centre_name: name,
    p_cost_centre_type: type,
    p_pool_scope: pool,
  };
  const sectionId = normalizePrmIntegerId(section_id);
  const subsectionId = normalizePrmIntegerId(subsection_id);
  const areaId = normalizePrmIntegerId(area_id);
  const plantId = normalizePrmIntegerId(plant_id);
  if (sectionId != null) params.p_section_id = sectionId;
  if (subsectionId != null) params.p_subsection_id = subsectionId;
  if (areaId != null) params.p_area_id = areaId;
  if (plantId != null) params.p_plant_id = plantId;
  if (!isBlankPrmValue(default_resource_class_code)) {
    params.p_default_resource_class_code = String(default_resource_class_code)
      .trim()
      .toUpperCase();
  }
  const effective = normalizePrmAsOfDate(effective_from, {
    fallbackToToday: true,
  });
  if (effective) params.p_effective_from = effective;
  if (!isBlankPrmValue(description)) {
    params.p_description = String(description).trim();
  }
  return { ok: true, params, errors: [] };
}

export const PRM_COST_CENTRE_DRAFT_PATCH_KEYS = Object.freeze([
  "cost_centre_code",
  "cost_centre_name",
  "cost_centre_type",
  "section_id",
  "subsection_id",
  "area_id",
  "plant_id",
  "default_resource_class_code",
  "pool_scope",
  "effective_from",
  "effective_to",
  "description",
]);

export function buildPrmUpdateProductionCostCentreDraftArgs({
  cost_centre_id = null,
  patch = null,
} = {}) {
  const id = normalizePrmIntegerId(cost_centre_id);
  if (id == null) {
    return {
      ok: false,
      params: {},
      errors: ["p_cost_centre_id requires a positive integer"],
    };
  }
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return {
      ok: false,
      params: {},
      errors: ["A non-empty patch object is required"],
    };
  }
  const out = {};
  for (const key of PRM_COST_CENTRE_DRAFT_PATCH_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    out[key] = patch[key];
  }
  if (!Object.keys(out).length) {
    return {
      ok: false,
      params: {},
      errors: ["A non-empty patch object is required"],
    };
  }
  const unknown = Object.keys(patch).filter(
    (k) => !PRM_COST_CENTRE_DRAFT_PATCH_KEYS.includes(k),
  );
  if (unknown.length) {
    return {
      ok: false,
      params: {},
      errors: [`Unsupported cost-centre patch keys: ${unknown.join(", ")}`],
    };
  }
  return {
    ok: true,
    params: { p_cost_centre_id: id, p_patch: out },
    errors: [],
  };
}

export function buildPrmValidateProductionCostCentreArgs({
  cost_centre_id = null,
} = {}) {
  return buildPrmProductionCostCentreDetailArgs({ cost_centre_id });
}

export function buildPrmApproveProductionCostCentreArgs({
  cost_centre_id = null,
  approval_reference = null,
  effective_from = null,
} = {}) {
  const id = normalizePrmIntegerId(cost_centre_id);
  if (id == null) {
    return {
      ok: false,
      params: {},
      errors: ["p_cost_centre_id requires a positive integer"],
    };
  }
  if (!isMeaningfulPrmApprovalReference(approval_reference)) {
    return {
      ok: false,
      params: {},
      errors: [
        "Enter a meaningful approval reference. Placeholders such as —, N/A, AUTO or MIGRATION are not allowed.",
      ],
    };
  }
  const params = {
    p_cost_centre_id: id,
    p_approval_reference: String(approval_reference).trim(),
  };
  const effective = normalizePrmAsOfDate(effective_from, {
    fallbackToToday: false,
  });
  if (effective) params.p_effective_from = effective;
  return { ok: true, params, errors: [] };
}

export function buildPrmInactivateProductionCostCentreArgs({
  cost_centre_id = null,
  effective_to = null,
  inactivation_reference = null,
} = {}) {
  const id = normalizePrmIntegerId(cost_centre_id);
  const to = normalizePrmAsOfDate(effective_to, { fallbackToToday: false });
  if (id == null) {
    return {
      ok: false,
      params: {},
      errors: ["p_cost_centre_id requires a positive integer"],
    };
  }
  if (!to) {
    return {
      ok: false,
      params: {},
      errors: ["Effective-to date is required"],
    };
  }
  if (!isMeaningfulPrmApprovalReference(inactivation_reference)) {
    return {
      ok: false,
      params: {},
      errors: [
        "Enter a meaningful inactivation reference. Placeholders such as —, N/A, AUTO or MIGRATION are not allowed.",
      ],
    };
  }
  return {
    ok: true,
    params: {
      p_cost_centre_id: id,
      p_effective_to: to,
      p_inactivation_reference: String(inactivation_reference).trim(),
    },
    errors: [],
  };
}

export const PRM_COST_CENTRE_ROUTE_USE_NOTE =
  "Route usage is enforced by the server during inactivation.";

