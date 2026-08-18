/**
 * Production Route Manager — strict 45-RPC adapter smoke.
 */
import {
  OBSOLETE_PRM_RPC_NAMES,
  PRODUCTION_ROUTE_RPC_NAMES,
} from "../public/shared/js/costing-suite-production-route-helpers.js";
import {
  PRM_RPC_ARG_KEYS,
  PRM_RPC_BUILDERS,
  assertAllPrmRpcBuildersPresent,
  assertNoObsoletePrmRpcBuilders,
  buildCreateProductRouteDraftArgs,
  buildCreateRouteFamilyRouteDraftArgs,
  buildApproveRouteFamilyMappingArgs,
  buildMapProductGroupToRouteFamilyArgs,
  buildUpdateRouteFamilyMappingDraftArgs,
  buildPreviewRouteFamilyRouteStepsArgs,
  buildUpdateProductRouteDraftArgs,
  buildRouteFamilyCandidateRpcArgs,
  buildRouteFamilyRouteDetailArgs,
  buildRouteFamilyRouteHistoryArgs,
  buildPipelineStatusArgs,
  buildExactRunReadinessRpcArgs,
  buildReadinessRpcArgs,
  buildCreateProductRouteFamilyAssignmentDraftArgs,
  buildProductAssignmentsRpcArgs,
  buildWorkloadPreviewRpcArgs,
  buildWorkloadDetailRpcArgs,
  buildWorkloadManagementExplainRpcArgs,
  buildCancelProductRouteFamilyAssignmentArgs,
  buildSubmitProductRouteFamilyAssignmentArgs,
  buildApproveProductRouteFamilyAssignmentArgs,
  buildInactivateProductRouteFamilyAssignmentArgs,
  buildCloneRouteFamilyRouteDraftArgs,
  buildDeleteProductOverrideArgs,
  buildDeleteRouteFamilyRouteStepArgs,
  buildOverrideJson,
  buildUpsertProductOverrideArgs,
  enforceExactPrmRpcKeys,
  normalizePreviewRouteFamilyRouteSteps,
  normalizeReadinessPayload,
} from "../public/shared/js/costing-suite-production-route-rpc.js";

let failed = 0;
function assert(condition, message) {
  if (condition) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

const expected = {
  rpc_get_production_route_manager_readiness: ["p_as_of_date", "p_search", "p_readiness_status", "p_route_family_id", "p_product_group_id", "p_limit", "p_offset"],
  rpc_get_production_route_manager_exact_run_readiness: ["p_period_start", "p_valuation_date", "p_refresh_run_id", "p_search", "p_readiness_status", "p_route_family_id", "p_product_group_id", "p_limit", "p_offset"],
  rpc_get_production_route_manager_product_assignments: ["p_status", "p_search", "p_route_family_id", "p_product_group_id", "p_product_id", "p_limit", "p_offset"],
  rpc_get_production_route_manager_workload_preview: ["p_period_start", "p_valuation_date", "p_refresh_run_id", "p_search", "p_foundation_status", "p_quantity_driver_status", "p_route_family_id", "p_product_group_id", "p_product_id", "p_dl_scope_filter", "p_poh_scope_filter", "p_limit", "p_offset"],
  rpc_get_production_route_manager_workload_detail: ["p_period_start", "p_valuation_date", "p_refresh_run_id", "p_product_id"],
  rpc_get_route_workload_management_explain: ["p_period_start", "p_valuation_date", "p_refresh_run_id", "p_product_id"],
  rpc_get_production_route_master_options: ["p_product_id", "p_product_group_id", "p_route_family_id", "p_as_of_date"],
  rpc_get_route_family_route_history: ["p_route_family_id"],
  rpc_get_route_family_route_detail: ["p_family_route_id"],
  rpc_get_product_route_history: ["p_product_id"],
  rpc_get_product_route_detail: ["p_product_route_id"],
  rpc_get_effective_product_process_route: ["p_product_id", "p_as_of_date"],
  rpc_preview_route_family_candidate: ["p_route_family_id", "p_product_group_ids", "p_as_of_date", "p_lookback_months"],
  rpc_preview_product_process_route_candidate: ["p_product_id", "p_as_of_date", "p_lookback_months"],
  rpc_preview_product_route_delta_candidate: ["p_product_id", "p_as_of_date", "p_lookback_months"],
  rpc_preview_route_family_route_steps: ["p_family_route_id", "p_date_from", "p_date_to"],
  rpc_get_production_route_pipeline_status: ["p_period_start", "p_refresh_run_id", "p_valuation_date"],
  rpc_get_route_family_onboarding_status: ["p_period_start", "p_refresh_run_id", "p_route_family_id", "p_valuation_date"],
  rpc_get_route_family_mapping_review_candidates: ["p_period_start", "p_valuation_date", "p_refresh_run_id", "p_as_of_date", "p_candidate_class", "p_product_group_id", "p_search", "p_limit", "p_offset"],
  rpc_get_route_family_foundation_review: ["p_period_start", "p_valuation_date", "p_refresh_run_id", "p_as_of_date", "p_lookback_months", "p_group_evidence_class", "p_product_group_id", "p_search", "p_limit", "p_offset"],
  rpc_get_production_cost_centres: ["p_as_of_date", "p_status", "p_pool_scope", "p_search"],
  rpc_get_production_cost_centre_detail: ["p_cost_centre_id"],
  rpc_create_production_cost_centre_draft: ["p_cost_centre_code", "p_cost_centre_name", "p_cost_centre_type", "p_section_id", "p_subsection_id", "p_area_id", "p_plant_id", "p_default_resource_class_code", "p_pool_scope", "p_effective_from", "p_description"],
  rpc_update_production_cost_centre_draft: ["p_cost_centre_id", "p_patch"],
  rpc_validate_production_cost_centre: ["p_cost_centre_id"],
  rpc_approve_production_cost_centre: ["p_cost_centre_id", "p_approval_reference", "p_effective_from"],
  rpc_inactivate_production_cost_centre: ["p_cost_centre_id", "p_effective_to", "p_inactivation_reference"],
  rpc_create_route_family: ["p_family_code", "p_family_name", "p_effective_from", "p_description"],
  rpc_create_route_family_onboarding_draft: ["p_family", "p_route", "p_steps"],
  rpc_approve_route_family: ["p_route_family_id", "p_approval_reference"],
  rpc_map_product_group_to_route_family: ["p_route_family_id", "p_product_group_id", "p_effective_from", "p_mapping_basis", "p_mapping_note"],
  rpc_approve_route_family_mapping: ["p_mapping_id", "p_approval_reference", "p_effective_from"],
  rpc_update_route_family_mapping_draft: ["p_mapping_id", "p_patch"],
  rpc_get_production_route_manager_subgroup_mappings: ["p_status", "p_search", "p_route_family_id", "p_product_group_id", "p_product_subgroup_id", "p_limit", "p_offset"],
  rpc_map_product_subgroup_to_route_family: ["p_route_family_id", "p_product_subgroup_id", "p_effective_from", "p_mapping_basis", "p_mapping_note"],
  rpc_update_product_subgroup_route_family_mapping_draft: ["p_mapping_id", "p_patch"],
  rpc_submit_product_subgroup_route_family_mapping_for_review: ["p_mapping_id"],
  rpc_approve_product_subgroup_route_family_mapping: ["p_mapping_id", "p_approval_reference", "p_effective_from"],
  rpc_inactivate_product_subgroup_route_family_mapping: ["p_mapping_id", "p_effective_to", "p_inactivation_reason"],
  rpc_get_archived_production_route_architecture: ["p_search", "p_entity_type", "p_limit", "p_offset"],
  rpc_create_route_family_route_draft: ["p_route_family_id", "p_route_name", "p_effective_from", "p_source_type", "p_evidence_status", "p_route_note", "p_supersedes_route_id"],
  rpc_clone_route_family_route_draft: ["p_source_family_route_id", "p_effective_from", "p_route_name", "p_route_note"],
  rpc_upsert_route_family_route_step: ["p_family_route_id", "p_step_id", "p_step"],
  rpc_delete_route_family_route_step: ["p_family_route_id", "p_step_id"],
  rpc_validate_route_family_route: ["p_family_route_id"],
  rpc_submit_route_family_route_for_review: ["p_family_route_id"],
  rpc_approve_route_family_route: ["p_family_route_id", "p_approval_reference"],
  rpc_supersede_route_family_route: ["p_old_family_route_id", "p_new_family_route_id"],
  rpc_create_product_route_draft: ["p_product_id", "p_base_route_family_route_id", "p_batch_size_ref_id", "p_effective_from", "p_source_type", "p_evidence_status", "p_route_note", "p_supersedes_route_id"],
  rpc_update_product_route_draft: ["p_product_route_id", "p_patch"],
  rpc_upsert_product_route_override: ["p_product_route_id", "p_override_id", "p_override"],
  rpc_delete_product_route_override: ["p_product_route_id", "p_override_id"],
  rpc_validate_product_route: ["p_product_route_id"],
  rpc_submit_product_route_for_review: ["p_product_route_id"],
  rpc_approve_product_route: ["p_product_route_id", "p_approval_reference"],
  rpc_supersede_product_route: ["p_old_product_route_id", "p_new_product_route_id"],
  rpc_create_product_route_family_assignment_draft: ["p_product_id", "p_route_family_id", "p_effective_from", "p_assignment_basis", "p_assignment_note"],
  rpc_submit_product_route_family_assignment_for_review: ["p_assignment_id"],
  rpc_approve_product_route_family_assignment: ["p_assignment_id", "p_approval_reference", "p_effective_from"],
  rpc_inactivate_product_route_family_assignment: ["p_assignment_id", "p_effective_to"],
  rpc_correct_product_route_family_assignment_effective_from: [
    "p_assignment_id",
    "p_corrected_effective_from",
    "p_correction_reason",
    "p_correction_reference",
  ],
  rpc_cancel_product_route_family_assignment: ["p_assignment_id", "p_cancellation_reason"],
};

assert(PRODUCTION_ROUTE_RPC_NAMES.length === 62, "exactly 62 RPCs");
assert(Object.keys(PRM_RPC_ARG_KEYS).length === 62, "key map covers 62 RPCs");
assert(
  PRODUCTION_ROUTE_RPC_NAMES.includes(
    "rpc_get_production_route_manager_exact_run_readiness",
  ),
  "exact-run readiness RPC allowed",
);
assert(assertAllPrmRpcBuildersPresent(), "every live RPC has a builder");
assert(assertNoObsoletePrmRpcBuilders(), "obsolete RPCs have no builders");
assert(
  OBSOLETE_PRM_RPC_NAMES.every((name) => !(name in PRM_RPC_ARG_KEYS)),
  "obsolete RPCs have no key contracts",
);

const unlocked = [
  "rpc_get_production_route_pipeline_status",
  "rpc_get_route_family_onboarding_status",
  "rpc_create_route_family_onboarding_draft",
  "rpc_clone_route_family_route_draft",
  "rpc_create_product_route_family_assignment_draft",
  "rpc_submit_product_route_family_assignment_for_review",
  "rpc_approve_product_route_family_assignment",
  "rpc_inactivate_product_route_family_assignment",
  "rpc_correct_product_route_family_assignment_effective_from",
  "rpc_cancel_product_route_family_assignment",
  "rpc_get_production_route_manager_product_assignments",
  "rpc_get_production_route_manager_workload_preview",
  "rpc_get_production_route_manager_workload_detail",
];
for (const name of unlocked) {
  assert(PRODUCTION_ROUTE_RPC_NAMES.includes(name), `unlocked RPC allowed: ${name}`);
}

assert(
  !PRODUCTION_ROUTE_RPC_NAMES.includes("rpc_request_costing_refresh") &&
    !PRODUCTION_ROUTE_RPC_NAMES.some((n) => /stage.?03/i.test(n)) &&
    !PRODUCTION_ROUTE_RPC_NAMES.some((n) => /direct_labour.*approv|approv.*direct_labour|production_overhead.*approv/i.test(n)),
  "no Stage 03, costing refresh, or policy-approval RPCs in inventory",
);

for (const name of PRODUCTION_ROUTE_RPC_NAMES) {
  assert(typeof PRM_RPC_BUILDERS[name] === "function", `builder callable: ${name}`);
  assert(
    JSON.stringify(PRM_RPC_ARG_KEYS[name]) === JSON.stringify(expected[name]),
    `exact payload keys: ${name}`,
  );
}

const pipeline = buildPipelineStatusArgs({
  period_start: "2026-07-01",
  valuation_date: "2026-07-22",
  refresh_run_id: 80,
});
assert(
  pipeline.ok &&
    pipeline.params.p_period_start === "2026-07-01" &&
    pipeline.params.p_valuation_date === "2026-07-22" &&
    pipeline.params.p_refresh_run_id === 80,
  "pipeline status exact-run args",
);

const exactRunReady = buildExactRunReadinessRpcArgs({
  period_start: "2026-07-01",
  valuation_date: "2026-07-22",
  refresh_run_id: 80,
  limit: 25,
  offset: 0,
});
assert(
  exactRunReady.ok &&
    exactRunReady.params.p_period_start === "2026-07-01" &&
    exactRunReady.params.p_valuation_date === "2026-07-22" &&
    exactRunReady.params.p_refresh_run_id === 80 &&
    exactRunReady.params.p_offset === 0,
  "exact-run readiness builder emits fixed context + pagination",
);
assert(
  !enforceExactPrmRpcKeys("rpc_get_production_route_manager_exact_run_readiness", {
    ...exactRunReady.params,
    p_extra: true,
  }).ok,
  "exact-run readiness rejects unsupported keys",
);
const generalReady = buildReadinessRpcArgs({
  as_of_date: "2026-07-22",
  limit: 25,
  offset: 0,
});
assert(
  generalReady.ok && generalReady.params.p_as_of_date === "2026-07-22",
  "general as-of readiness adapter retained",
);
const normalizedCounts = normalizeReadinessPayload({
  rows: [],
  total_count: 495,
  status_counts: {
    READY: 130,
    REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER: 13,
    BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING: 313,
    BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE: 39,
  },
});
assert(
  normalizedCounts.total_count === 495 &&
    normalizedCounts.status_counts.READY === 130,
  "normalizeReadinessPayload preserves status_counts and exact-run total",
);
assert(
  !enforceExactPrmRpcKeys("rpc_get_production_route_pipeline_status", {
    ...pipeline.params,
    p_extra: 1,
  }).ok,
  "pipeline rejects unsupported keys via finalize",
);

const assignmentDraft = buildCreateProductRouteFamilyAssignmentDraftArgs({
  product_id: 10,
  route_family_id: 4,
  effective_from: "2026-07-01",
  assignment_basis: "MANUAL",
  assignment_note: "test",
});
assert(
  assignmentDraft.ok &&
    assignmentDraft.params.p_product_id === 10 &&
    assignmentDraft.params.p_route_family_id === 4,
  "assignment draft builder emits exact args",
);

const assignmentRead = buildProductAssignmentsRpcArgs({
  product_id: 618,
  limit: 100,
  offset: 0,
});
assert(
  assignmentRead.ok &&
    assignmentRead.params.p_product_id === 618 &&
    assignmentRead.params.p_limit === 100 &&
    assignmentRead.params.p_offset === 0 &&
    !("p_status" in assignmentRead.params),
  "product assignments read builder uses p_product_id",
);
assert(
  buildProductAssignmentsRpcArgs({}).ok &&
    !("p_product_id" in buildProductAssignmentsRpcArgs({}).params),
  "product assignments read allows omitting product_id for company-wide lens",
);
assert(
  !enforceExactPrmRpcKeys(
    "rpc_get_production_route_manager_product_assignments",
    { ...assignmentRead.params, p_extra: 1 },
  ).ok,
  "product assignments read rejects unsupported keys",
);

const workloadPreview = buildWorkloadPreviewRpcArgs({
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
  poh_scope_filter: "NO_POH",
  limit: 25,
  offset: 25,
});
assert(
  workloadPreview.ok &&
    workloadPreview.params.p_period_start === "2026-08-01" &&
    workloadPreview.params.p_valuation_date === "2026-08-07" &&
    workloadPreview.params.p_refresh_run_id === 82 &&
    workloadPreview.params.p_limit === 25 &&
    workloadPreview.params.p_offset === 25 &&
    !("p_as_of_date" in workloadPreview.params),
  "workload preview builder uses fixed exact-run args and pagination",
);
assert(
  !enforceExactPrmRpcKeys(
    "rpc_get_production_route_manager_workload_preview",
    { ...workloadPreview.params, p_extra: true },
  ).ok,
  "workload preview rejects unsupported keys",
);
assert(
  !buildWorkloadPreviewRpcArgs({
    period_start: null,
    valuation_date: "2026-08-07",
    refresh_run_id: 82,
  }).ok,
  "workload preview has no current-date fallback",
);
const workloadDetail = buildWorkloadDetailRpcArgs({
  period_start: "2026-08-01",
  valuation_date: "2026-08-07",
  refresh_run_id: 82,
  product_id: 618,
});
assert(
  workloadDetail.ok &&
    workloadDetail.params.p_product_id === 618 &&
    Object.keys(workloadDetail.params).length === 4,
  "workload detail builder is product-scoped with exact allowlist",
);
assert(
  !buildWorkloadDetailRpcArgs({
    period_start: "2026-08-01",
    valuation_date: "2026-08-07",
    refresh_run_id: 82,
  }).ok,
  "workload detail requires product_id",
);
assert(
  !enforceExactPrmRpcKeys(
    "rpc_get_production_route_manager_workload_detail",
    { ...workloadDetail.params, p_search: "x" },
  ).ok,
  "workload detail rejects unsupported keys",
);
const workloadExplain = buildWorkloadManagementExplainRpcArgs({
  period_start: "2026-08-01",
  valuation_date: "2026-08-07",
  refresh_run_id: 82,
  product_id: 149,
});
assert(
  workloadExplain.ok &&
    Object.keys(workloadExplain.params).length === 4 &&
    workloadExplain.params.p_refresh_run_id === 82 &&
    workloadExplain.params.p_product_id === 149,
  "workload management explain builder uses exact four Run-82 args",
);
assert(
  !enforceExactPrmRpcKeys(
    "rpc_get_route_workload_management_explain",
    { ...workloadExplain.params, p_search: "x" },
  ).ok,
  "workload management explain rejects unsupported keys",
);

const assignmentCancel = buildCancelProductRouteFamilyAssignmentArgs({
  assignment_id: 12,
  cancellation_reason: "Wrong Route Family selected during review",
});
assert(
  assignmentCancel.ok &&
    assignmentCancel.params.p_assignment_id === 12 &&
    assignmentCancel.params.p_cancellation_reason.includes("Wrong"),
  "cancel assignment builder emits exact args",
);
assert(
  !buildCancelProductRouteFamilyAssignmentArgs({
    assignment_id: 12,
    cancellation_reason: "N/A",
  }).ok,
  "cancel assignment requires meaningful reason",
);

const assignmentSubmit = buildSubmitProductRouteFamilyAssignmentArgs({
  assignment_id: 12,
});
assert(
  assignmentSubmit.ok && assignmentSubmit.params.p_assignment_id === 12,
  "submit assignment builder emits exact args",
);

const clone = buildCloneRouteFamilyRouteDraftArgs({
  source_family_route_id: 4,
  effective_from: "2026-07-01",
});
assert(clone.ok && clone.params.p_source_family_route_id === 4, "clone draft builder");

const extra = enforceExactPrmRpcKeys("rpc_get_route_family_route_detail", {
  p_family_route_id: 4,
  p_product_group_id: 9,
});
assert(
  !extra.ok && extra.extraKeys.join(",") === "p_product_group_id",
  "extra payload keys are rejected",
);

for (const obsolete of OBSOLETE_PRM_RPC_NAMES) {
  assert(
    !enforceExactPrmRpcKeys(obsolete, {}).ok,
    `obsolete RPC rejected: ${obsolete}`,
  );
}

const familyMode = buildRouteFamilyCandidateRpcArgs({
  route_family_id: "41",
  as_of_date: "2026-08-02",
  lookback_months: "6",
});
assert(
  familyMode.ok &&
    familyMode.params.p_route_family_id === 41 &&
    !("p_product_group_ids" in familyMode.params),
  "candidate family mode is exclusive",
);

const groupMode = buildRouteFamilyCandidateRpcArgs({
  product_group_ids: ["7", 3, "7", 0, "bad"],
  as_of_date: "2026-08-02",
});
assert(
  groupMode.ok &&
    JSON.stringify(groupMode.params.p_product_group_ids) ===
      JSON.stringify([7, 3]) &&
    !("p_route_family_id" in groupMode.params),
  "candidate Product Group mode normalizes IDs and is exclusive",
);
assert(
  !buildRouteFamilyCandidateRpcArgs({
    route_family_id: 41,
    product_group_ids: [7],
  }).ok,
  "candidate dual mode is rejected",
);
assert(
  !buildRouteFamilyCandidateRpcArgs({}).ok,
  "candidate missing mode is rejected",
);

const history = buildRouteFamilyRouteHistoryArgs({ route_family_id: "9" });
const detail = buildRouteFamilyRouteDetailArgs({ family_route_id: "10" });
assert(
  history.ok &&
    Object.keys(history.params).join(",") === "p_route_family_id" &&
    detail.ok &&
    Object.keys(detail.params).join(",") === "p_family_route_id",
  "Route Family history/detail IDs use exact contracts",
);

const familyDraft = buildCreateRouteFamilyRouteDraftArgs({
  route_family_id: 9,
  route_name: "Classical liquid route",
  effective_from: "2026-08-02",
  source_type: "HISTORICAL",
  evidence_status: "REVIEWED",
  route_note: "Approved evidence set",
  supersedes_route_id: 8,
});
assert(
  familyDraft.ok &&
    JSON.stringify(Object.keys(familyDraft.params)) ===
      JSON.stringify(expected.rpc_create_route_family_route_draft),
  "family route draft emits exact payload keys",
);

const productDraft = buildCreateProductRouteDraftArgs({
  product_id: 618,
  base_route_family_route_id: 44,
  batch_size_ref_id: 7,
  effective_from: "2026-08-02",
  source_type: "ROUTE_FAMILY",
  evidence_status: "REVIEWED",
  route_note: "Product delta",
  supersedes_route_id: 43,
});
assert(
  productDraft.ok &&
    JSON.stringify(Object.keys(productDraft.params)) ===
      JSON.stringify(expected.rpc_create_product_route_draft) &&
    productDraft.params.p_base_route_family_route_id === 44,
  "product route draft emits exact Family architecture keys",
);

const aliasCreate = buildCreateProductRouteDraftArgs({
  product_id: 618,
  base_route_family_route_id: 44,
  batch_size_ref_id: 7,
  evidence_source: "HISTORICAL",
  evidence_reference: "REVIEWED",
  evidence_note: "Staged note",
});
assert(
  aliasCreate.ok &&
    aliasCreate.params.p_source_type === "HISTORICAL" &&
    aliasCreate.params.p_evidence_status === "REVIEWED" &&
    aliasCreate.params.p_route_note === "Staged note" &&
    !("evidence_source" in aliasCreate.params) &&
    !("p_notes" in aliasCreate.params),
  "evidence_source normalizes to p_source_type and never reaches costingRpc params",
);

const approveMapping = buildApproveRouteFamilyMappingArgs({
  mapping_id: "55",
  approval_reference: "MAP-OK-1",
  effective_from: "2026-08-03",
});
assert(
  approveMapping.ok &&
    approveMapping.params.p_mapping_id === 55 &&
    approveMapping.params.p_approval_reference === "MAP-OK-1" &&
    approveMapping.params.p_effective_from === "2026-08-03" &&
    !("p_route_family_mapping_id" in approveMapping.params),
  "mapping approval uses p_mapping_id",
);
assert(
  !buildMapProductGroupToRouteFamilyArgs({
    route_family_id: 8,
    product_group_id: 28,
    mapping_basis: "—",
  }).ok,
  "mapping basis placeholder dash rejected",
);
assert(
  buildMapProductGroupToRouteFamilyArgs({
    route_family_id: 8,
    product_group_id: 28,
    mapping_basis: "HISTORICAL_REVIEW",
    effective_from: "2026-07-01",
  }).params.p_mapping_basis === "HISTORICAL_REVIEW",
  "mapping basis HISTORICAL_REVIEW accepted",
);
assert(
  !buildApproveRouteFamilyMappingArgs({
    mapping_id: 55,
    approval_reference: "N/A",
  }).ok,
  "mapping approval placeholder N/A rejected",
);
{
  const updateMapping = buildUpdateRouteFamilyMappingDraftArgs({
    mapping_id: 7,
    patch: {
      mapping_basis: "HISTORICAL_REVIEW",
      mapping_note:
        "Mapped following review of historical production evidence for the regular Kashayam manufacturing family. Commercial classification remains distinct from the shared manufacturing route.",
      effective_from: "2026-07-01",
    },
  });
  assert(
    updateMapping.ok &&
      updateMapping.params.p_mapping_id === 7 &&
      updateMapping.params.p_patch.mapping_basis === "HISTORICAL_REVIEW" &&
      String(Object.keys(updateMapping.params).sort()) ===
        String(["p_mapping_id", "p_patch"].sort()),
    "update mapping RPC exact keys",
  );
  assert(
    !buildUpdateRouteFamilyMappingDraftArgs({
      mapping_id: 7,
      patch: { mapping_basis: "HISTORICAL_REVIEW", unknown_field: "x" },
    }).ok,
    "nested unknown key rejected",
  );
}
assert(
  !enforceExactPrmRpcKeys("rpc_approve_route_family_mapping", {
    p_mapping_id: 55,
    p_approval_reference: "MAP-OK-1",
    p_effective_from: "2026-08-03",
    p_route_family_mapping_id: 55,
  }).ok,
  "p_route_family_mapping_id rejected as extra/obsolete key",
);

const updatePatch = buildUpdateProductRouteDraftArgs({
  product_route_id: 90,
  patch: {
    route_note: "Updated note",
    source_type: "HISTORICAL",
    evidence_status: "REVIEWED",
    effective_from: "2026-08-03",
  },
});
assert(
  updatePatch.ok &&
    updatePatch.params.p_product_route_id === 90 &&
    typeof updatePatch.params.p_patch === "object" &&
    !Array.isArray(updatePatch.params.p_patch) &&
    updatePatch.params.p_patch.route_note === "Updated note" &&
    updatePatch.params.p_patch.source_type === "HISTORICAL" &&
    !("p_notes" in updatePatch.params) &&
    !("route_note" in updatePatch.params) &&
    Object.keys(updatePatch.params).sort().join(",") === "p_patch,p_product_route_id",
  "Product update uses nested p_patch only",
);

const aliasUpdate = buildUpdateProductRouteDraftArgs({
  product_route_id: 91,
  notes: "From notes alias",
  evidence_source: "HISTORICAL",
});
assert(
  aliasUpdate.ok &&
    aliasUpdate.params.p_patch.route_note === "From notes alias" &&
    aliasUpdate.params.p_patch.source_type === "HISTORICAL" &&
    !("p_notes" in aliasUpdate.params) &&
    !("evidence_source" in aliasUpdate.params),
  "p_notes never reaches costingRpc; aliases nest inside p_patch",
);

assert(
  !buildUpdateProductRouteDraftArgs({ product_route_id: 92 }).ok,
  "blank/missing p_patch is rejected",
);
assert(
  !enforceExactPrmRpcKeys("rpc_update_product_route_draft", {
    p_product_route_id: 90,
    p_patch: { route_note: "x" },
    p_notes: "bad",
  }).ok,
  "top-level p_notes rejected on product draft update",
);

{
  const preview = buildPreviewRouteFamilyRouteStepsArgs({
    family_route_id: 4,
    date_from: "2026-01-01",
    date_to: "2026-07-01",
  });
  assert(
    preview.ok &&
      Object.keys(preview.params).join(",") ===
        "p_family_route_id,p_date_from,p_date_to" &&
      preview.params.p_family_route_id === 4,
    "preview RPC exact arguments",
  );
  assert(
    !buildPreviewRouteFamilyRouteStepsArgs({
      family_route_id: 4,
      date_from: "bad",
      date_to: "2026-07-01",
    }).ok,
    "preview RPC rejects invalid date",
  );
  assert(
    !enforceExactPrmRpcKeys("rpc_preview_route_family_route_steps", {
      p_family_route_id: 4,
      p_date_from: "2026-01-01",
      p_date_to: "2026-07-01",
      p_extra: 1,
    }).ok,
    "unknown preview argument rejected",
  );
  const normalized = normalizePreviewRouteFamilyRouteSteps({
    preview_only: true,
    approvable: false,
    candidate_steps: [{ sequence_no: 20, step_key: "B" }],
    batch_evidence: { total_batches: 254, with_post_extraction_wip: 19 },
    evidence_gaps: [{ code: "POST_EXTRACTION_WIP" }],
    decision_notes: ["review"],
    records_created: [],
  });
  assert(
    normalized.preview_only === true &&
      normalized.approvable === false &&
      normalized.candidate_steps.length === 1 &&
      normalized.batch_evidence.total_batches === 254 &&
      normalized.evidence_gaps.length === 1 &&
      normalized.decision_notes.length === 1 &&
      Array.isArray(normalized.records_created),
    "preview payload normalized",
  );
}

const liveOverride = buildOverrideJson({
  operation_type: "ADD_STEP",
  override_step_key: "added-step",
  sequence_no: 99,
  activity_id: 1,
  cost_centre_id: 2,
  override_reason: "Product-specific added step",
  delta_operation: "ADD_STEP",
  step_key: "stale",
  target_step_key: "stale",
  note: "stale note",
});
assert(
  liveOverride.operation_type === "ADD_STEP" &&
    liveOverride.base_step_id === null &&
    liveOverride.override_step_key === "added-step" &&
    liveOverride.override_reason === "Product-specific added step" &&
    !Object.prototype.hasOwnProperty.call(liveOverride, "delta_operation") &&
    !Object.prototype.hasOwnProperty.call(liveOverride, "step_key") &&
    !Object.prototype.hasOwnProperty.call(liveOverride, "target_step_key") &&
    !Object.prototype.hasOwnProperty.call(liveOverride, "note"),
  "upsert override JSON uses live keys and omits stale aliases",
);
const aliasOverride = buildOverrideJson({
  delta_operation: "BYPASS_STEP",
  base_step_id: 51,
  note: "Skip pulverization for this Product",
});
assert(
  aliasOverride.operation_type === "BYPASS_STEP" &&
    aliasOverride.base_step_id === 51 &&
    aliasOverride.override_reason === "Skip pulverization for this Product" &&
    !Object.prototype.hasOwnProperty.call(aliasOverride, "delta_operation") &&
    !Object.prototype.hasOwnProperty.call(aliasOverride, "note"),
  "stale alias inputs map into live override keys",
);
const upsertBuilt = buildUpsertProductOverrideArgs({
  product_route_id: 47,
  override_id: 12,
  override: liveOverride,
});
assert(
  upsertBuilt.ok &&
    upsertBuilt.params.p_product_route_id === 47 &&
    upsertBuilt.params.p_override_id === 12 &&
    upsertBuilt.params.p_override.operation_type === "ADD_STEP",
  "upsert adapter passes p_product_route_id, p_override_id, p_override",
);
const deleteBuilt = buildDeleteProductOverrideArgs({
  product_route_id: 47,
  override_id: 12,
});
assert(
  deleteBuilt.ok &&
    deleteBuilt.params.p_product_route_id === 47 &&
    deleteBuilt.params.p_override_id === 12 &&
    !("p_product_route_override_id" in deleteBuilt.params),
  "delete adapter uses live p_product_route_id + p_override_id",
);
assert(
  !buildDeleteProductOverrideArgs({ override_id: 12 }).ok,
  "delete adapter requires p_product_route_id",
);

const familyStepDelete = buildDeleteRouteFamilyRouteStepArgs({
  family_route_id: 20,
  step_id: 155,
});
assert(
  familyStepDelete.ok &&
    JSON.stringify(familyStepDelete.params) ===
      JSON.stringify({ p_family_route_id: 20, p_step_id: 155 }) &&
    !("p_family_route_step_id" in familyStepDelete.params) &&
    !("p_route_step_id" in familyStepDelete.params) &&
    !("route_id" in familyStepDelete.params) &&
    !("step_id" in familyStepDelete.params),
  "family step delete emits exact p_family_route_id + p_step_id",
);
assert(
  !buildDeleteRouteFamilyRouteStepArgs({ step_id: 155 }).ok,
  "family step delete requires family_route_id",
);
assert(
  !buildDeleteRouteFamilyRouteStepArgs({ family_route_id: 20 }).ok,
  "family step delete requires step_id",
);
assert(
  !buildDeleteRouteFamilyRouteStepArgs({
    family_route_id: 0,
    step_id: 155,
  }).ok,
  "family step delete rejects non-positive family_route_id",
);
assert(
  !buildDeleteRouteFamilyRouteStepArgs({
    family_route_id: 20,
    step_id: -1,
  }).ok,
  "family step delete rejects non-positive step_id",
);
assert(
  !buildDeleteRouteFamilyRouteStepArgs({
    family_route_id: "20.5",
    step_id: 155,
  }).ok,
  "family step delete rejects non-integer family_route_id",
);

if (failed) {
  console.error(`production-route-rpc-adapter-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("production-route-rpc-adapter-smoke: all passed");
