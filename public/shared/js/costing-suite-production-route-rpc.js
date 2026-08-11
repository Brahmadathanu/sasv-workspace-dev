/**
 * Production Route Manager — strict 54-RPC contract adapter.
 * Manufacturing Route Family architecture. No arbitrary payloads.
 */

import {
  PRODUCTION_ROUTE_RPC_NAMES,
  OBSOLETE_PRM_RPC_NAMES,
  buildPrmDeltaCandidateArgs,
  buildPrmMasterOptionsArgs,
  buildPrmProductAssignmentsArgs,
  buildPrmProductCandidateArgs,
  buildPrmReadinessArgs,
  buildPrmExactRunReadinessArgs,
  buildPrmMappingReviewCandidatesArgs,
  buildPrmFoundationReviewArgs,
  buildPrmProductionCostCentresArgs,
  buildPrmProductionCostCentreDetailArgs,
  buildPrmCreateProductionCostCentreDraftArgs,
  buildPrmUpdateProductionCostCentreDraftArgs,
  buildPrmValidateProductionCostCentreArgs,
  buildPrmApproveProductionCostCentreArgs,
  buildPrmInactivateProductionCostCentreArgs,
  buildPrmWorkloadDetailArgs,
  buildPrmWorkloadManagementExplainArgs,
  buildPrmWorkloadPreviewArgs,
  buildPrmRpcParams,
  coercePrmList,
  isBlankPrmValue,
  isMeaningfulPrmCancellationReason,
  isObsoletePrmRpcName,
  isMeaningfulPrmApprovalReference,
  normalizePrmAsOfDate,
  normalizePrmCode,
  normalizePrmIntegerId,
  normalizePrmIntegerIdArray,
  normalizePrmMappingBasis,
  normalizePrmProductAssignmentRow,
  normalizePrmProductAssignmentsPayload,
  normalizePrmRouteFamilyMapping,
  normalizePrmRpcPayload,
  normalizePrmStatusCounts,
  sortPrmFamilyRouteSteps,
} from "./costing-suite-production-route-helpers.js";

/** Exact accepted argument keys per RPC (Gate 5.11BU.11G / 11Y.4B live signatures). */
export const PRM_RPC_ARG_KEYS = Object.freeze({
  // General as-of-date route-maintenance readiness — not Costing exact-run queue.
  rpc_get_production_route_manager_readiness: Object.freeze([
    "p_as_of_date",
    "p_search",
    "p_readiness_status",
    "p_route_family_id",
    "p_product_group_id",
    "p_limit",
    "p_offset",
  ]),
  rpc_get_production_route_manager_exact_run_readiness: Object.freeze([
    "p_period_start",
    "p_valuation_date",
    "p_refresh_run_id",
    "p_search",
    "p_readiness_status",
    "p_route_family_id",
    "p_product_group_id",
    "p_limit",
    "p_offset",
  ]),
  rpc_get_production_route_master_options: Object.freeze([
    "p_product_id",
    "p_product_group_id",
    "p_route_family_id",
    "p_as_of_date",
  ]),
  rpc_get_route_family_route_history: Object.freeze(["p_route_family_id"]),
  rpc_get_route_family_route_detail: Object.freeze(["p_family_route_id"]),
  rpc_get_product_route_history: Object.freeze(["p_product_id"]),
  rpc_get_product_route_detail: Object.freeze(["p_product_route_id"]),
  rpc_get_effective_product_process_route: Object.freeze([
    "p_product_id",
    "p_as_of_date",
  ]),
  rpc_preview_route_family_candidate: Object.freeze([
    "p_route_family_id",
    "p_product_group_ids",
    "p_as_of_date",
    "p_lookback_months",
  ]),
  rpc_preview_product_process_route_candidate: Object.freeze([
    "p_product_id",
    "p_as_of_date",
    "p_lookback_months",
  ]),
  rpc_preview_product_route_delta_candidate: Object.freeze([
    "p_product_id",
    "p_as_of_date",
    "p_lookback_months",
  ]),
  rpc_preview_route_family_route_steps: Object.freeze([
    "p_family_route_id",
    "p_date_from",
    "p_date_to",
  ]),
  rpc_get_production_route_pipeline_status: Object.freeze([
    "p_period_start",
    "p_refresh_run_id",
    "p_valuation_date",
  ]),
  rpc_get_route_family_onboarding_status: Object.freeze([
    "p_period_start",
    "p_refresh_run_id",
    "p_route_family_id",
    "p_valuation_date",
  ]),
  rpc_get_route_family_mapping_review_candidates: Object.freeze([
    "p_period_start",
    "p_valuation_date",
    "p_refresh_run_id",
    "p_as_of_date",
    "p_candidate_class",
    "p_product_group_id",
    "p_search",
    "p_limit",
    "p_offset",
  ]),
  rpc_get_route_family_foundation_review: Object.freeze([
    "p_period_start",
    "p_valuation_date",
    "p_refresh_run_id",
    "p_as_of_date",
    "p_lookback_months",
    "p_group_evidence_class",
    "p_product_group_id",
    "p_search",
    "p_limit",
    "p_offset",
  ]),
  rpc_get_production_cost_centres: Object.freeze([
    "p_as_of_date",
    "p_status",
    "p_pool_scope",
    "p_search",
  ]),
  rpc_get_production_cost_centre_detail: Object.freeze(["p_cost_centre_id"]),
  rpc_create_production_cost_centre_draft: Object.freeze([
    "p_cost_centre_code",
    "p_cost_centre_name",
    "p_cost_centre_type",
    "p_section_id",
    "p_subsection_id",
    "p_area_id",
    "p_plant_id",
    "p_default_resource_class_code",
    "p_pool_scope",
    "p_effective_from",
    "p_description",
  ]),
  rpc_update_production_cost_centre_draft: Object.freeze([
    "p_cost_centre_id",
    "p_patch",
  ]),
  rpc_validate_production_cost_centre: Object.freeze(["p_cost_centre_id"]),
  rpc_approve_production_cost_centre: Object.freeze([
    "p_cost_centre_id",
    "p_approval_reference",
    "p_effective_from",
  ]),
  rpc_inactivate_production_cost_centre: Object.freeze([
    "p_cost_centre_id",
    "p_effective_to",
    "p_inactivation_reference",
  ]),
  rpc_create_route_family: Object.freeze([
    "p_family_code",
    "p_family_name",
    "p_effective_from",
    "p_description",
  ]),
  rpc_create_route_family_onboarding_draft: Object.freeze([
    "p_family",
    "p_route",
    "p_steps",
  ]),
  rpc_approve_route_family: Object.freeze([
    "p_route_family_id",
    "p_approval_reference",
  ]),
  rpc_map_product_group_to_route_family: Object.freeze([
    "p_route_family_id",
    "p_product_group_id",
    "p_effective_from",
    "p_mapping_basis",
    "p_mapping_note",
  ]),
  rpc_approve_route_family_mapping: Object.freeze([
    "p_mapping_id",
    "p_approval_reference",
    "p_effective_from",
  ]),
  rpc_update_route_family_mapping_draft: Object.freeze([
    "p_mapping_id",
    "p_patch",
  ]),
  rpc_create_route_family_route_draft: Object.freeze([
    "p_route_family_id",
    "p_route_name",
    "p_effective_from",
    "p_source_type",
    "p_evidence_status",
    "p_route_note",
    "p_supersedes_route_id",
  ]),
  rpc_clone_route_family_route_draft: Object.freeze([
    "p_source_family_route_id",
    "p_effective_from",
    "p_route_name",
    "p_route_note",
  ]),
  rpc_upsert_route_family_route_step: Object.freeze([
    "p_family_route_id",
    "p_step_id",
    "p_step",
  ]),
  rpc_delete_route_family_route_step: Object.freeze([
    "p_family_route_step_id",
  ]),
  rpc_validate_route_family_route: Object.freeze(["p_family_route_id"]),
  rpc_submit_route_family_route_for_review: Object.freeze([
    "p_family_route_id",
  ]),
  rpc_approve_route_family_route: Object.freeze([
    "p_family_route_id",
    "p_approval_reference",
  ]),
  rpc_supersede_route_family_route: Object.freeze([
    "p_old_family_route_id",
    "p_new_family_route_id",
  ]),
  rpc_create_product_route_draft: Object.freeze([
    "p_product_id",
    "p_base_route_family_route_id",
    "p_batch_size_ref_id",
    "p_effective_from",
    "p_source_type",
    "p_evidence_status",
    "p_route_note",
    "p_supersedes_route_id",
  ]),
  rpc_update_product_route_draft: Object.freeze([
    "p_product_route_id",
    "p_patch",
  ]),
  rpc_upsert_product_route_override: Object.freeze([
    "p_product_route_id",
    "p_override_id",
    "p_override",
  ]),
  rpc_delete_product_route_override: Object.freeze([
    "p_product_route_override_id",
  ]),
  rpc_validate_product_route: Object.freeze(["p_product_route_id"]),
  rpc_submit_product_route_for_review: Object.freeze(["p_product_route_id"]),
  rpc_approve_product_route: Object.freeze([
    "p_product_route_id",
    "p_approval_reference",
  ]),
  rpc_supersede_product_route: Object.freeze([
    "p_old_product_route_id",
    "p_new_product_route_id",
  ]),
  rpc_create_product_route_family_assignment_draft: Object.freeze([
    "p_product_id",
    "p_route_family_id",
    "p_effective_from",
    "p_assignment_basis",
    "p_assignment_note",
  ]),
  rpc_submit_product_route_family_assignment_for_review: Object.freeze([
    "p_assignment_id",
  ]),
  rpc_approve_product_route_family_assignment: Object.freeze([
    "p_assignment_id",
    "p_approval_reference",
    "p_effective_from",
  ]),
  rpc_inactivate_product_route_family_assignment: Object.freeze([
    "p_assignment_id",
    "p_effective_to",
  ]),
  rpc_get_production_route_manager_product_assignments: Object.freeze([
    "p_status",
    "p_search",
    "p_route_family_id",
    "p_product_group_id",
    "p_product_id",
    "p_limit",
    "p_offset",
  ]),
  rpc_cancel_product_route_family_assignment: Object.freeze([
    "p_assignment_id",
    "p_cancellation_reason",
  ]),
  rpc_get_production_route_manager_workload_preview: Object.freeze([
    "p_period_start",
    "p_valuation_date",
    "p_refresh_run_id",
    "p_search",
    "p_foundation_status",
    "p_quantity_driver_status",
    "p_route_family_id",
    "p_product_group_id",
    "p_product_id",
    "p_dl_scope_filter",
    "p_poh_scope_filter",
    "p_limit",
    "p_offset",
  ]),
  rpc_get_production_route_manager_workload_detail: Object.freeze([
    "p_period_start",
    "p_valuation_date",
    "p_refresh_run_id",
    "p_product_id",
  ]),
  rpc_get_route_workload_management_explain: Object.freeze([
    "p_period_start",
    "p_valuation_date",
    "p_refresh_run_id",
    "p_product_id",
  ]),
});

export function getPrmRpcAllowedKeys(rpcName) {
  return PRM_RPC_ARG_KEYS[rpcName] || null;
}

export function enforceExactPrmRpcKeys(rpcName, params = {}) {
  if (isObsoletePrmRpcName(rpcName)) {
    return {
      ok: false,
      params: {},
      errors: [`Obsolete Production Route RPC rejected: ${rpcName}`],
      extraKeys: [],
    };
  }
  const allowed = getPrmRpcAllowedKeys(rpcName);
  if (!allowed) {
    return {
      ok: false,
      params: {},
      errors: [`Unknown Production Route RPC: ${rpcName}`],
      extraKeys: [],
    };
  }
  const src = params && typeof params === "object" ? params : {};
  const extraKeys = Object.keys(src).filter((k) => !allowed.includes(k));
  const out = {};
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
    const value = src[key];
    if (value === undefined) continue;
    out[key] = value;
  }
  return {
    ok: extraKeys.length === 0,
    params: out,
    errors:
      extraKeys.length > 0
        ? [`Extra keys for ${rpcName}: ${extraKeys.join(", ")}`]
        : [],
    extraKeys,
  };
}

function finalize(rpcName, built) {
  if (!built.ok) {
    return {
      ok: false,
      params: {},
      errors: built.errors || ["Invalid parameters"],
      extraKeys: [],
    };
  }
  return enforceExactPrmRpcKeys(rpcName, built.params);
}

/* ---------- Request builders ---------- */

export function buildReadinessRpcArgs(input = {}) {
  // General as-of-date route-maintenance queue — not Costing exact-run.
  const params = buildPrmReadinessArgs(input);
  return finalize("rpc_get_production_route_manager_readiness", {
    ok: true,
    params,
    errors: [],
  });
}

export function buildExactRunReadinessRpcArgs(input = {}) {
  return finalize(
    "rpc_get_production_route_manager_exact_run_readiness",
    buildPrmExactRunReadinessArgs(input),
  );
}

export function buildMappingReviewCandidatesRpcArgs(input = {}) {
  return finalize(
    "rpc_get_route_family_mapping_review_candidates",
    buildPrmMappingReviewCandidatesArgs(input),
  );
}

export function buildFoundationReviewRpcArgs(input = {}) {
  return finalize(
    "rpc_get_route_family_foundation_review",
    buildPrmFoundationReviewArgs(input),
  );
}

export function buildProductionCostCentresRpcArgs(input = {}) {
  return finalize(
    "rpc_get_production_cost_centres",
    buildPrmProductionCostCentresArgs(input),
  );
}

export function buildProductionCostCentreDetailRpcArgs(input = {}) {
  return finalize(
    "rpc_get_production_cost_centre_detail",
    buildPrmProductionCostCentreDetailArgs(input),
  );
}

export function buildCreateProductionCostCentreDraftRpcArgs(input = {}) {
  return finalize(
    "rpc_create_production_cost_centre_draft",
    buildPrmCreateProductionCostCentreDraftArgs(input),
  );
}

export function buildUpdateProductionCostCentreDraftRpcArgs(input = {}) {
  return finalize(
    "rpc_update_production_cost_centre_draft",
    buildPrmUpdateProductionCostCentreDraftArgs(input),
  );
}

export function buildValidateProductionCostCentreRpcArgs(input = {}) {
  return finalize(
    "rpc_validate_production_cost_centre",
    buildPrmValidateProductionCostCentreArgs(input),
  );
}

export function buildApproveProductionCostCentreRpcArgs(input = {}) {
  return finalize(
    "rpc_approve_production_cost_centre",
    buildPrmApproveProductionCostCentreArgs(input),
  );
}

export function buildInactivateProductionCostCentreRpcArgs(input = {}) {
  return finalize(
    "rpc_inactivate_production_cost_centre",
    buildPrmInactivateProductionCostCentreArgs(input),
  );
}

export function buildMasterOptionsRpcArgs(input = {}) {
  return finalize(
    "rpc_get_production_route_master_options",
    buildPrmMasterOptionsArgs(input),
  );
}

function rejectInvalidApprovalReference(rpcName, approval_reference) {
  if (isMeaningfulPrmApprovalReference(approval_reference)) return null;
  return {
    ok: false,
    params: {},
    errors: [
      `${rpcName} rejects blank or placeholder p_approval_reference values`,
    ],
    extraKeys: [],
  };
}

export function buildRouteFamilyRouteHistoryArgs({
  route_family_id = null,
} = {}) {
  return finalize(
    "rpc_get_route_family_route_history",
    buildPrmRpcParams({
      p_route_family_id: {
        kind: "int",
        value: route_family_id,
        required: true,
      },
    }),
  );
}

export function buildRouteFamilyRouteDetailArgs({
  family_route_id = null,
} = {}) {
  return finalize(
    "rpc_get_route_family_route_detail",
    buildPrmRpcParams({
      p_family_route_id: {
        kind: "int",
        value: family_route_id,
        required: true,
      },
    }),
  );
}

export function buildProductRouteDetailArgs({ product_route_id = null } = {}) {
  return finalize(
    "rpc_get_product_route_detail",
    buildPrmRpcParams({
      p_product_route_id: {
        kind: "int",
        value: product_route_id,
        required: true,
      },
    }),
  );
}

export function buildProductRouteHistoryArgs({ product_id = null } = {}) {
  return finalize(
    "rpc_get_product_route_history",
    buildPrmRpcParams({
      p_product_id: { kind: "int", value: product_id, required: true },
    }),
  );
}

export function buildEffectiveRouteArgs({
  product_id = null,
  as_of_date = null,
} = {}) {
  return finalize(
    "rpc_get_effective_product_process_route",
    buildPrmRpcParams({
      p_product_id: { kind: "int", value: product_id, required: true },
      p_as_of_date: {
        kind: "date",
        value: as_of_date,
        required: false,
        fallbackToToday: false,
      },
    }),
  );
}

/**
 * Mode A: p_route_family_id only.
 * Mode B: p_product_group_ids only.
 * Dual-mode payloads are rejected.
 */
export function buildRouteFamilyCandidateRpcArgs({
  route_family_id = null,
  product_group_ids = null,
  as_of_date = null,
  lookback_months = null,
} = {}) {
  const familyId = normalizePrmIntegerId(route_family_id);
  const groupIds = normalizePrmIntegerIdArray(product_group_ids);
  if (familyId != null && groupIds.length) {
    return {
      ok: false,
      params: {},
      errors: [
        "rpc_preview_route_family_candidate rejects both p_route_family_id and p_product_group_ids",
      ],
      extraKeys: [],
    };
  }
  if (familyId == null && !groupIds.length) {
    return {
      ok: false,
      params: {},
      errors: [
        "Provide either p_route_family_id or p_product_group_ids (not both)",
      ],
      extraKeys: [],
    };
  }
  const fields = {
    p_as_of_date: {
      kind: "date",
      value: as_of_date,
      required: true,
      fallbackToToday: true,
    },
    p_lookback_months: { kind: "positiveInt", value: lookback_months },
  };
  if (familyId != null) {
    fields.p_route_family_id = {
      kind: "int",
      value: familyId,
      required: true,
    };
  } else {
    fields.p_product_group_ids = {
      kind: "intArray",
      value: groupIds,
      required: true,
    };
  }
  return finalize(
    "rpc_preview_route_family_candidate",
    buildPrmRpcParams(fields),
  );
}

export function buildProductCandidateRpcArgs(input = {}) {
  return finalize(
    "rpc_preview_product_process_route_candidate",
    buildPrmProductCandidateArgs(input),
  );
}

export function buildDeltaCandidateRpcArgs(input = {}) {
  return finalize(
    "rpc_preview_product_route_delta_candidate",
    buildPrmDeltaCandidateArgs(input),
  );
}

export function buildPreviewRouteFamilyRouteStepsArgs({
  family_route_id = null,
  date_from = null,
  date_to = null,
  p_family_route_id = null,
  p_date_from = null,
  p_date_to = null,
} = {}) {
  return finalize(
    "rpc_preview_route_family_route_steps",
    buildPrmRpcParams({
      p_family_route_id: {
        kind: "int",
        value: family_route_id ?? p_family_route_id,
        required: true,
      },
      p_date_from: {
        kind: "date",
        value: date_from ?? p_date_from,
        required: true,
        fallbackToToday: false,
      },
      p_date_to: {
        kind: "date",
        value: date_to ?? p_date_to,
        required: true,
        fallbackToToday: false,
      },
    }),
  );
}

export function buildPipelineStatusArgs({
  period_start = null,
  valuation_date = null,
  refresh_run_id = null,
  p_period_start = null,
  p_valuation_date = null,
  p_refresh_run_id = null,
} = {}) {
  return finalize(
    "rpc_get_production_route_pipeline_status",
    buildPrmRpcParams({
      p_period_start: {
        kind: "date",
        value: period_start ?? p_period_start,
        required: true,
        fallbackToToday: false,
      },
      p_valuation_date: {
        kind: "date",
        value: valuation_date ?? p_valuation_date,
        required: true,
        fallbackToToday: false,
      },
      p_refresh_run_id: {
        kind: "int",
        value: refresh_run_id ?? p_refresh_run_id,
        required: true,
      },
    }),
  );
}

export function buildRouteFamilyOnboardingStatusArgs({
  route_family_id = null,
  period_start = null,
  valuation_date = null,
  refresh_run_id = null,
  p_route_family_id = null,
  p_period_start = null,
  p_valuation_date = null,
  p_refresh_run_id = null,
} = {}) {
  return finalize(
    "rpc_get_route_family_onboarding_status",
    buildPrmRpcParams({
      p_route_family_id: {
        kind: "int",
        value: route_family_id ?? p_route_family_id,
        required: true,
      },
      p_period_start: {
        kind: "date",
        value: period_start ?? p_period_start,
        required: false,
        fallbackToToday: false,
      },
      p_valuation_date: {
        kind: "date",
        value: valuation_date ?? p_valuation_date,
        required: false,
        fallbackToToday: false,
      },
      p_refresh_run_id: {
        kind: "int",
        value: refresh_run_id ?? p_refresh_run_id,
        required: false,
      },
    }),
  );
}

export function buildCreateRouteFamilyOnboardingDraftArgs({
  family = null,
  route = null,
  steps = null,
  p_family = null,
  p_route = null,
  p_steps = null,
} = {}) {
  return finalize(
    "rpc_create_route_family_onboarding_draft",
    buildPrmRpcParams({
      p_family: { kind: "json", value: family ?? p_family, required: true },
      p_route: { kind: "json", value: route ?? p_route, required: true },
      p_steps: { kind: "json", value: steps ?? p_steps, required: true },
    }),
  );
}

export function buildCreateRouteFamilyArgs({
  family_code = null,
  family_name = null,
  route_family_code = null,
  route_family_name = null,
  effective_from = null,
  description = null,
} = {}) {
  return finalize(
    "rpc_create_route_family",
    buildPrmRpcParams({
      p_family_code: {
        kind: "string",
        value: family_code ?? route_family_code,
        required: true,
      },
      p_family_name: {
        kind: "string",
        value: family_name ?? route_family_name,
        required: true,
      },
      p_effective_from: {
        kind: "date",
        value: effective_from,
        required: false,
        fallbackToToday: true,
      },
      p_description: { kind: "string", value: description },
    }),
  );
}

export function buildApproveRouteFamilyArgs({
  route_family_id = null,
  approval_reference = null,
} = {}) {
  const rejected = rejectInvalidApprovalReference(
    "rpc_approve_route_family",
    approval_reference,
  );
  if (rejected) return rejected;
  return finalize(
    "rpc_approve_route_family",
    buildPrmRpcParams({
      p_route_family_id: {
        kind: "int",
        value: route_family_id,
        required: true,
      },
      p_approval_reference: {
        kind: "string",
        value: approval_reference,
        required: true,
      },
    }),
  );
}

export function buildMapProductGroupToRouteFamilyArgs({
  route_family_id = null,
  product_group_id = null,
  effective_from = null,
  mapping_basis = null,
  mapping_note = null,
} = {}) {
  const basis = normalizePrmMappingBasis(mapping_basis);
  if (!basis) {
    return {
      ok: false,
      params: {},
      errors: [
        "p_mapping_basis must be MANUAL, HISTORICAL_REVIEW, or MIGRATED",
      ],
      extraKeys: [],
    };
  }
  const noteRaw = isBlankPrmValue(mapping_note)
    ? null
    : String(mapping_note).trim();
  const note =
    !noteRaw ||
    noteRaw === "—" ||
    noteRaw === "-" ||
    noteRaw === "–" ||
    noteRaw === "−"
      ? null
      : noteRaw;
  return finalize(
    "rpc_map_product_group_to_route_family",
    buildPrmRpcParams({
      p_route_family_id: {
        kind: "int",
        value: route_family_id,
        required: true,
      },
      p_product_group_id: {
        kind: "int",
        value: product_group_id,
        required: true,
      },
      p_effective_from: {
        kind: "date",
        value: effective_from,
        required: false,
        fallbackToToday: true,
      },
      p_mapping_basis: { kind: "string", value: basis, required: true },
      p_mapping_note: { kind: "string", value: note },
    }),
  );
}

export function buildApproveRouteFamilyMappingArgs({
  mapping_id = null,
  approval_reference = null,
  effective_from = null,
} = {}) {
  const rejected = rejectInvalidApprovalReference(
    "rpc_approve_route_family_mapping",
    approval_reference,
  );
  if (rejected) return rejected;
  return finalize(
    "rpc_approve_route_family_mapping",
    buildPrmRpcParams({
      p_mapping_id: {
        kind: "int",
        value: mapping_id,
        required: true,
      },
      p_approval_reference: {
        kind: "string",
        value: approval_reference,
        required: true,
      },
      p_effective_from: {
        kind: "date",
        value: effective_from,
        required: false,
        fallbackToToday: true,
      },
    }),
  );
}

const ROUTE_FAMILY_MAPPING_PATCH_KEYS = Object.freeze([
  "effective_from",
  "mapping_basis",
  "mapping_note",
]);

/**
 * Strict nested patch for rpc_update_route_family_mapping_draft.
 * No form aliases reach costingRpc.
 */
export function buildRouteFamilyMappingDraftPatch(fields = {}) {
  const src =
    fields && typeof fields === "object" && !Array.isArray(fields)
      ? fields.patch &&
        typeof fields.patch === "object" &&
        !Array.isArray(fields.patch)
        ? fields.patch
        : fields
      : null;
  if (!src) return { ok: false, patch: null, errors: ["p_patch is required"] };
  const unknown = Object.keys(src).filter(
    (key) => !ROUTE_FAMILY_MAPPING_PATCH_KEYS.includes(key),
  );
  if (unknown.length) {
    return {
      ok: false,
      patch: null,
      errors: [`Unknown nested patch keys: ${unknown.join(", ")}`],
    };
  }
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(src, "effective_from")) {
    const date = normalizePrmAsOfDate(src.effective_from, {
      fallbackToToday: false,
    });
    if (date == null && !isBlankPrmValue(src.effective_from)) {
      return {
        ok: false,
        patch: null,
        errors: ["effective_from requires YYYY-MM-DD"],
      };
    }
    if (date) patch.effective_from = date;
  }
  if (Object.prototype.hasOwnProperty.call(src, "mapping_basis")) {
    const basis = normalizePrmMappingBasis(src.mapping_basis);
    if (!basis) {
      return {
        ok: false,
        patch: null,
        errors: [
          "mapping_basis must be MANUAL, HISTORICAL_REVIEW, or MIGRATED",
        ],
      };
    }
    patch.mapping_basis = basis;
  }
  if (Object.prototype.hasOwnProperty.call(src, "mapping_note")) {
    const noteRaw = isBlankPrmValue(src.mapping_note)
      ? null
      : String(src.mapping_note).trim();
    patch.mapping_note =
      !noteRaw ||
      noteRaw === "—" ||
      noteRaw === "-" ||
      noteRaw === "–" ||
      noteRaw === "−"
        ? null
        : noteRaw;
  }
  if (!Object.keys(patch).length) {
    return {
      ok: false,
      patch: null,
      errors: ["p_patch must be a non-empty JSON object"],
    };
  }
  return { ok: true, patch, errors: [] };
}

export function buildUpdateRouteFamilyMappingDraftArgs({
  mapping_id = null,
  patch = null,
  ...rest
} = {}) {
  const builtPatch =
    patch && typeof patch === "object" && !Array.isArray(patch)
      ? buildRouteFamilyMappingDraftPatch({ patch })
      : buildRouteFamilyMappingDraftPatch(rest);
  if (!builtPatch.ok) {
    return {
      ok: false,
      params: {},
      errors: builtPatch.errors,
      extraKeys: [],
    };
  }
  return finalize(
    "rpc_update_route_family_mapping_draft",
    buildPrmRpcParams({
      p_mapping_id: {
        kind: "int",
        value: mapping_id,
        required: true,
      },
      p_patch: { kind: "json", value: builtPatch.patch, required: true },
    }),
  );
}

export function buildCreateRouteFamilyRouteDraftArgs({
  route_family_id = null,
  route_name = null,
  effective_from = null,
  source_type = null,
  evidence_status = null,
  route_note = null,
  supersedes_route_id = null,
  evidence_source = null,
  evidence_reference = null,
  evidence_note = null,
} = {}) {
  return finalize(
    "rpc_create_route_family_route_draft",
    buildPrmRpcParams({
      p_route_family_id: {
        kind: "int",
        value: route_family_id,
        required: true,
      },
      p_route_name: { kind: "string", value: route_name, required: true },
      p_effective_from: {
        kind: "date",
        value: effective_from,
        required: false,
        fallbackToToday: true,
      },
      p_source_type: {
        kind: "string",
        value: source_type ?? evidence_source,
      },
      p_evidence_status: {
        kind: "string",
        value: evidence_status ?? evidence_reference,
      },
      p_route_note: { kind: "string", value: route_note ?? evidence_note },
      p_supersedes_route_id: { kind: "int", value: supersedes_route_id },
    }),
  );
}

export function buildCloneRouteFamilyRouteDraftArgs({
  source_family_route_id = null,
  effective_from = null,
  route_name = null,
  route_note = null,
  p_source_family_route_id = null,
  p_effective_from = null,
  p_route_name = null,
  p_route_note = null,
} = {}) {
  const noteRaw = route_note ?? p_route_note;
  const note =
    noteRaw == null || String(noteRaw).trim() === ""
      ? null
      : String(noteRaw).trim();
  return finalize(
    "rpc_clone_route_family_route_draft",
    buildPrmRpcParams({
      p_source_family_route_id: {
        kind: "int",
        value: source_family_route_id ?? p_source_family_route_id,
        required: true,
      },
      p_effective_from: {
        kind: "date",
        value: effective_from ?? p_effective_from,
        required: true,
        fallbackToToday: false,
      },
      p_route_name: {
        kind: "string",
        value: route_name ?? p_route_name,
        required: false,
      },
      p_route_note: {
        kind: "string",
        value: note,
        required: false,
      },
    }),
  );
}

export function buildUpsertRouteFamilyRouteStepArgs({
  family_route_id = null,
  step_id = null,
  step = null,
} = {}) {
  if (step == null || typeof step !== "object" || Array.isArray(step)) {
    return {
      ok: false,
      params: {},
      errors: ["p_step must be a JSON object"],
      extraKeys: [],
    };
  }
  return finalize(
    "rpc_upsert_route_family_route_step",
    buildPrmRpcParams({
      p_family_route_id: {
        kind: "int",
        value: family_route_id,
        required: true,
      },
      p_step_id: { kind: "int", value: step_id },
      p_step: { kind: "json", value: step, required: true },
    }),
  );
}

export function buildDeleteRouteFamilyRouteStepArgs({
  family_route_step_id = null,
} = {}) {
  return finalize(
    "rpc_delete_route_family_route_step",
    buildPrmRpcParams({
      p_family_route_step_id: {
        kind: "int",
        value: family_route_step_id,
        required: true,
      },
    }),
  );
}

export function buildValidateRouteFamilyRouteArgs({
  family_route_id = null,
} = {}) {
  return finalize(
    "rpc_validate_route_family_route",
    buildPrmRpcParams({
      p_family_route_id: {
        kind: "int",
        value: family_route_id,
        required: true,
      },
    }),
  );
}

export function buildSubmitRouteFamilyRouteArgs({
  family_route_id = null,
} = {}) {
  return finalize(
    "rpc_submit_route_family_route_for_review",
    buildPrmRpcParams({
      p_family_route_id: {
        kind: "int",
        value: family_route_id,
        required: true,
      },
    }),
  );
}

export function buildApproveRouteFamilyRouteArgs({
  family_route_id = null,
  approval_reference = null,
} = {}) {
  const rejected = rejectInvalidApprovalReference(
    "rpc_approve_route_family_route",
    approval_reference,
  );
  if (rejected) return rejected;
  return finalize(
    "rpc_approve_route_family_route",
    buildPrmRpcParams({
      p_family_route_id: {
        kind: "int",
        value: family_route_id,
        required: true,
      },
      p_approval_reference: {
        kind: "string",
        value: approval_reference,
        required: true,
      },
    }),
  );
}

export function buildSupersedeRouteFamilyRouteArgs({
  old_family_route_id = null,
  new_family_route_id = null,
} = {}) {
  return finalize(
    "rpc_supersede_route_family_route",
    buildPrmRpcParams({
      p_old_family_route_id: {
        kind: "int",
        value: old_family_route_id,
        required: true,
      },
      p_new_family_route_id: {
        kind: "int",
        value: new_family_route_id,
        required: true,
      },
    }),
  );
}

export function buildCreateProductRouteDraftArgs({
  product_id = null,
  base_route_family_route_id = null,
  batch_size_ref_id = null,
  effective_from = null,
  source_type = null,
  evidence_status = null,
  route_note = null,
  supersedes_route_id = null,
  evidence_source = null,
  evidence_reference = null,
  evidence_note = null,
} = {}) {
  return finalize(
    "rpc_create_product_route_draft",
    buildPrmRpcParams({
      p_product_id: { kind: "int", value: product_id, required: true },
      p_base_route_family_route_id: {
        kind: "int",
        value: base_route_family_route_id,
        required: true,
      },
      p_batch_size_ref_id: {
        kind: "int",
        value: batch_size_ref_id,
        required: true,
      },
      p_effective_from: {
        kind: "date",
        value: effective_from,
        required: false,
        fallbackToToday: false,
      },
      p_source_type: {
        kind: "string",
        value: source_type ?? evidence_source,
      },
      p_evidence_status: {
        kind: "string",
        value: evidence_status ?? evidence_reference,
      },
      p_route_note: { kind: "string", value: route_note ?? evidence_note },
      p_supersedes_route_id: { kind: "int", value: supersedes_route_id },
    }),
  );
}

/**
 * Normalize form/controller aliases into a server p_patch object.
 * Outgoing payload uses only exact patch keys — never evidence_source / p_notes.
 */
export function buildProductRouteDraftPatch(fields = {}) {
  const src = fields && typeof fields === "object" && !Array.isArray(fields)
    ? fields.patch && typeof fields.patch === "object" && !Array.isArray(fields.patch)
      ? fields.patch
      : fields
    : null;
  if (!src) return null;
  const patch = {};
  const routeNote =
    src.route_note ?? src.notes ?? src.evidence_note ?? null;
  const sourceType =
    src.source_type ?? src.evidence_source ?? null;
  const evidenceStatus =
    src.evidence_status ?? src.evidence_reference ?? null;
  const effectiveFrom = src.effective_from ?? null;
  if (!isBlankPrmValue(routeNote)) patch.route_note = String(routeNote).trim();
  if (!isBlankPrmValue(sourceType)) patch.source_type = String(sourceType).trim();
  if (!isBlankPrmValue(evidenceStatus)) {
    patch.evidence_status = String(evidenceStatus).trim();
  }
  if (!isBlankPrmValue(effectiveFrom)) {
    const date = normalizePrmAsOfDate(effectiveFrom, { fallbackToToday: false });
    if (date) patch.effective_from = date;
  }
  return Object.keys(patch).length ? patch : null;
}

export function buildUpdateProductRouteDraftArgs({
  product_route_id = null,
  patch = null,
  ...rest
} = {}) {
  const normalizedPatch =
    patch && typeof patch === "object" && !Array.isArray(patch)
      ? buildProductRouteDraftPatch({ patch })
      : buildProductRouteDraftPatch(rest);
  if (
    normalizedPatch == null ||
    typeof normalizedPatch !== "object" ||
    Array.isArray(normalizedPatch)
  ) {
    return {
      ok: false,
      params: {},
      errors: ["p_patch must be a non-empty JSON object"],
      extraKeys: [],
    };
  }
  return finalize(
    "rpc_update_product_route_draft",
    buildPrmRpcParams({
      p_product_route_id: {
        kind: "int",
        value: product_route_id,
        required: true,
      },
      p_patch: { kind: "json", value: normalizedPatch, required: true },
    }),
  );
}

export function buildUpsertProductOverrideArgs({
  product_route_id = null,
  override_id = null,
  override = null,
} = {}) {
  if (
    override == null ||
    typeof override !== "object" ||
    Array.isArray(override)
  ) {
    return {
      ok: false,
      params: {},
      errors: ["p_override must be a JSON object"],
      extraKeys: [],
    };
  }
  return finalize(
    "rpc_upsert_product_route_override",
    buildPrmRpcParams({
      p_product_route_id: {
        kind: "int",
        value: product_route_id,
        required: true,
      },
      p_override_id: { kind: "int", value: override_id },
      p_override: { kind: "json", value: override, required: true },
    }),
  );
}

export function buildDeleteProductOverrideArgs({
  product_route_override_id = null,
} = {}) {
  return finalize(
    "rpc_delete_product_route_override",
    buildPrmRpcParams({
      p_product_route_override_id: {
        kind: "int",
        value: product_route_override_id,
        required: true,
      },
    }),
  );
}

export function buildValidateProductRouteArgs({
  product_route_id = null,
} = {}) {
  return finalize(
    "rpc_validate_product_route",
    buildPrmRpcParams({
      p_product_route_id: {
        kind: "int",
        value: product_route_id,
        required: true,
      },
    }),
  );
}

export function buildSubmitProductRouteArgs({ product_route_id = null } = {}) {
  return finalize(
    "rpc_submit_product_route_for_review",
    buildPrmRpcParams({
      p_product_route_id: {
        kind: "int",
        value: product_route_id,
        required: true,
      },
    }),
  );
}

export function buildApproveProductRouteArgs({
  product_route_id = null,
  approval_reference = null,
} = {}) {
  const rejected = rejectInvalidApprovalReference(
    "rpc_approve_product_route",
    approval_reference,
  );
  if (rejected) return rejected;
  return finalize(
    "rpc_approve_product_route",
    buildPrmRpcParams({
      p_product_route_id: {
        kind: "int",
        value: product_route_id,
        required: true,
      },
      p_approval_reference: {
        kind: "string",
        value: approval_reference,
        required: true,
      },
    }),
  );
}

export function buildSupersedeProductRouteArgs({
  old_product_route_id = null,
  new_product_route_id = null,
} = {}) {
  return finalize(
    "rpc_supersede_product_route",
    buildPrmRpcParams({
      p_old_product_route_id: {
        kind: "int",
        value: old_product_route_id,
        required: true,
      },
      p_new_product_route_id: {
        kind: "int",
        value: new_product_route_id,
        required: true,
      },
    }),
  );
}

export function buildCreateProductRouteFamilyAssignmentDraftArgs({
  product_id = null,
  route_family_id = null,
  effective_from = null,
  assignment_basis = null,
  assignment_note = null,
  p_product_id = null,
  p_route_family_id = null,
  p_effective_from = null,
  p_assignment_basis = null,
  p_assignment_note = null,
} = {}) {
  const basisRaw = assignment_basis ?? p_assignment_basis;
  const noteRaw = assignment_note ?? p_assignment_note;
  const basis =
    basisRaw == null || String(basisRaw).trim() === ""
      ? null
      : String(basisRaw).trim();
  const note =
    noteRaw == null || String(noteRaw).trim() === ""
      ? null
      : String(noteRaw).trim();
  return finalize(
    "rpc_create_product_route_family_assignment_draft",
    buildPrmRpcParams({
      p_product_id: {
        kind: "int",
        value: product_id ?? p_product_id,
        required: true,
      },
      p_route_family_id: {
        kind: "int",
        value: route_family_id ?? p_route_family_id,
        required: true,
      },
      p_effective_from: {
        kind: "date",
        value: effective_from ?? p_effective_from,
        required: false,
        fallbackToToday: false,
      },
      p_assignment_basis: { kind: "string", value: basis, required: false },
      p_assignment_note: { kind: "string", value: note, required: false },
    }),
  );
}

export function buildSubmitProductRouteFamilyAssignmentArgs({
  assignment_id = null,
  p_assignment_id = null,
} = {}) {
  return finalize(
    "rpc_submit_product_route_family_assignment_for_review",
    buildPrmRpcParams({
      p_assignment_id: {
        kind: "int",
        value: assignment_id ?? p_assignment_id,
        required: true,
      },
    }),
  );
}

export function buildApproveProductRouteFamilyAssignmentArgs({
  assignment_id = null,
  approval_reference = null,
  effective_from = null,
  p_assignment_id = null,
  p_approval_reference = null,
  p_effective_from = null,
} = {}) {
  const reference = approval_reference ?? p_approval_reference;
  if (!isMeaningfulPrmApprovalReference(reference)) {
    return {
      ok: false,
      params: {},
      errors: [
        "Enter a meaningful approval reference. Placeholders such as — or N/A are not allowed.",
      ],
      extraKeys: [],
    };
  }
  return finalize(
    "rpc_approve_product_route_family_assignment",
    buildPrmRpcParams({
      p_assignment_id: {
        kind: "int",
        value: assignment_id ?? p_assignment_id,
        required: true,
      },
      p_approval_reference: {
        kind: "string",
        value: reference,
        required: true,
      },
      p_effective_from: {
        kind: "date",
        value: effective_from ?? p_effective_from,
        required: false,
        fallbackToToday: false,
      },
    }),
  );
}

export function buildInactivateProductRouteFamilyAssignmentArgs({
  assignment_id = null,
  effective_to = null,
  p_assignment_id = null,
  p_effective_to = null,
} = {}) {
  return finalize(
    "rpc_inactivate_product_route_family_assignment",
    buildPrmRpcParams({
      p_assignment_id: {
        kind: "int",
        value: assignment_id ?? p_assignment_id,
        required: true,
      },
      p_effective_to: {
        kind: "date",
        value: effective_to ?? p_effective_to,
        required: true,
        fallbackToToday: false,
      },
    }),
  );
}

export function buildProductAssignmentsRpcArgs(input = {}) {
  return finalize(
    "rpc_get_production_route_manager_product_assignments",
    buildPrmProductAssignmentsArgs(input),
  );
}

export function buildCancelProductRouteFamilyAssignmentArgs({
  assignment_id = null,
  cancellation_reason = null,
  p_assignment_id = null,
  p_cancellation_reason = null,
} = {}) {
  const reason = cancellation_reason ?? p_cancellation_reason;
  if (!isMeaningfulPrmCancellationReason(reason)) {
    return {
      ok: false,
      params: {},
      errors: [
        "Enter a meaningful cancellation reason. Placeholders such as — or N/A are not allowed.",
      ],
      extraKeys: [],
    };
  }
  return finalize(
    "rpc_cancel_product_route_family_assignment",
    buildPrmRpcParams({
      p_assignment_id: {
        kind: "int",
        value: assignment_id ?? p_assignment_id,
        required: true,
      },
      p_cancellation_reason: {
        kind: "string",
        value: String(reason).trim(),
        required: true,
      },
    }),
  );
}

export function buildWorkloadPreviewRpcArgs(input = {}) {
  return finalize(
    "rpc_get_production_route_manager_workload_preview",
    buildPrmWorkloadPreviewArgs(input),
  );
}

export function buildWorkloadDetailRpcArgs(input = {}) {
  return finalize(
    "rpc_get_production_route_manager_workload_detail",
    buildPrmWorkloadDetailArgs(input),
  );
}

export function buildWorkloadManagementExplainRpcArgs(input = {}) {
  return finalize(
    "rpc_get_route_workload_management_explain",
    buildPrmWorkloadManagementExplainArgs(input),
  );
}

export const PRM_RPC_BUILDERS = Object.freeze({
  rpc_get_production_route_manager_readiness: buildReadinessRpcArgs,
  rpc_get_production_route_manager_exact_run_readiness: buildExactRunReadinessRpcArgs,
  rpc_get_production_route_manager_product_assignments:
    buildProductAssignmentsRpcArgs,
  rpc_get_production_route_manager_workload_preview: buildWorkloadPreviewRpcArgs,
  rpc_get_production_route_manager_workload_detail: buildWorkloadDetailRpcArgs,
  rpc_get_route_workload_management_explain:
    buildWorkloadManagementExplainRpcArgs,
  rpc_get_production_route_master_options: buildMasterOptionsRpcArgs,
  rpc_get_route_family_route_history: buildRouteFamilyRouteHistoryArgs,
  rpc_get_route_family_route_detail: buildRouteFamilyRouteDetailArgs,
  rpc_get_product_route_history: buildProductRouteHistoryArgs,
  rpc_get_product_route_detail: buildProductRouteDetailArgs,
  rpc_get_effective_product_process_route: buildEffectiveRouteArgs,
  rpc_preview_route_family_candidate: buildRouteFamilyCandidateRpcArgs,
  rpc_preview_product_process_route_candidate: buildProductCandidateRpcArgs,
  rpc_preview_product_route_delta_candidate: buildDeltaCandidateRpcArgs,
  rpc_preview_route_family_route_steps: buildPreviewRouteFamilyRouteStepsArgs,
  rpc_get_production_route_pipeline_status: buildPipelineStatusArgs,
  rpc_get_route_family_onboarding_status: buildRouteFamilyOnboardingStatusArgs,
  rpc_get_route_family_mapping_review_candidates:
    buildMappingReviewCandidatesRpcArgs,
  rpc_get_route_family_foundation_review: buildFoundationReviewRpcArgs,
  rpc_get_production_cost_centres: buildProductionCostCentresRpcArgs,
  rpc_get_production_cost_centre_detail: buildProductionCostCentreDetailRpcArgs,
  rpc_create_production_cost_centre_draft:
    buildCreateProductionCostCentreDraftRpcArgs,
  rpc_update_production_cost_centre_draft:
    buildUpdateProductionCostCentreDraftRpcArgs,
  rpc_validate_production_cost_centre: buildValidateProductionCostCentreRpcArgs,
  rpc_approve_production_cost_centre: buildApproveProductionCostCentreRpcArgs,
  rpc_inactivate_production_cost_centre:
    buildInactivateProductionCostCentreRpcArgs,
  rpc_create_route_family: buildCreateRouteFamilyArgs,
  rpc_create_route_family_onboarding_draft: buildCreateRouteFamilyOnboardingDraftArgs,
  rpc_approve_route_family: buildApproveRouteFamilyArgs,
  rpc_map_product_group_to_route_family: buildMapProductGroupToRouteFamilyArgs,
  rpc_approve_route_family_mapping: buildApproveRouteFamilyMappingArgs,
  rpc_update_route_family_mapping_draft: buildUpdateRouteFamilyMappingDraftArgs,
  rpc_create_route_family_route_draft: buildCreateRouteFamilyRouteDraftArgs,
  rpc_clone_route_family_route_draft: buildCloneRouteFamilyRouteDraftArgs,
  rpc_upsert_route_family_route_step: buildUpsertRouteFamilyRouteStepArgs,
  rpc_delete_route_family_route_step: buildDeleteRouteFamilyRouteStepArgs,
  rpc_validate_route_family_route: buildValidateRouteFamilyRouteArgs,
  rpc_submit_route_family_route_for_review: buildSubmitRouteFamilyRouteArgs,
  rpc_approve_route_family_route: buildApproveRouteFamilyRouteArgs,
  rpc_supersede_route_family_route: buildSupersedeRouteFamilyRouteArgs,
  rpc_create_product_route_draft: buildCreateProductRouteDraftArgs,
  rpc_update_product_route_draft: buildUpdateProductRouteDraftArgs,
  rpc_upsert_product_route_override: buildUpsertProductOverrideArgs,
  rpc_delete_product_route_override: buildDeleteProductOverrideArgs,
  rpc_validate_product_route: buildValidateProductRouteArgs,
  rpc_submit_product_route_for_review: buildSubmitProductRouteArgs,
  rpc_approve_product_route: buildApproveProductRouteArgs,
  rpc_supersede_product_route: buildSupersedeProductRouteArgs,
  rpc_create_product_route_family_assignment_draft:
    buildCreateProductRouteFamilyAssignmentDraftArgs,
  rpc_submit_product_route_family_assignment_for_review:
    buildSubmitProductRouteFamilyAssignmentArgs,
  rpc_approve_product_route_family_assignment:
    buildApproveProductRouteFamilyAssignmentArgs,
  rpc_inactivate_product_route_family_assignment:
    buildInactivateProductRouteFamilyAssignmentArgs,
  rpc_cancel_product_route_family_assignment:
    buildCancelProductRouteFamilyAssignmentArgs,
});

export function assertAllPrmRpcBuildersPresent() {
  return PRODUCTION_ROUTE_RPC_NAMES.every((name) => !!PRM_RPC_BUILDERS[name]);
}

export function assertNoObsoletePrmRpcBuilders() {
  return OBSOLETE_PRM_RPC_NAMES.every((name) => !PRM_RPC_BUILDERS[name]);
}

/* ---------- Response normalizers ---------- */

export function normalizeReadinessRow(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  return {
    ...r,
    product_id: r.product_id ?? null,
    product_name: r.product_name ?? null,
    category_name: r.category_name ?? r.category ?? null,
    subcategory_name:
      r.subcategory_name ?? r.subcategory ?? r.division_name ?? null,
    product_group_id: r.product_group_id ?? null,
    product_group_name: r.product_group_name ?? null,
    route_family_id: r.route_family_id ?? null,
    route_family_code: r.route_family_code ?? null,
    route_family_name: r.route_family_name ?? null,
    family_route_id: r.family_route_id ?? r.approved_family_route_id ?? null,
    family_route_name: r.family_route_name ?? null,
    family_route_version:
      r.family_route_version ?? r.approved_family_route_version ?? null,
    product_route_id: r.product_route_id ?? r.draft_product_route_id ?? null,
    product_route_name: r.product_route_name ?? null,
    product_route_version:
      r.product_route_version ?? r.approved_product_route_version ?? null,
    base_route_family_route_id: r.base_route_family_route_id ?? null,
    assignment_source: r.assignment_source ?? r.assignment_basis ?? null,
    assignment_basis: r.assignment_basis ?? null,
    route_source:
      r.route_source ?? r.effective_route_source ?? null,
    route_status: r.route_status ?? r.family_route_status ?? null,
    route_validation:
      r.route_validation ?? r.validation_status ?? r.is_valid ?? null,
    preferred_batch_size:
      r.preferred_batch_size ?? r.preferred_batch_size_value ?? null,
    raw_batch_requirement: r.raw_batch_requirement ?? null,
    standard_batch_count: r.standard_batch_count ?? null,
    monthly_product_quantity:
      r.monthly_product_quantity ?? r.monthly_quantity ?? null,
    monthly_quantity: r.monthly_quantity ?? r.monthly_product_quantity ?? null,
    monthly_driver_status: r.monthly_driver_status ?? null,
    actual_sku_count: r.actual_sku_count ?? null,
    assumption_sku_count: r.assumption_sku_count ?? null,
    default_sku_count: r.default_sku_count ?? null,
    step_count: r.step_count ?? r.effective_step_count ?? null,
    readiness_status: r.readiness_status ?? null,
    readiness_note: r.readiness_note ?? null,
    readiness_errors: r.readiness_errors ?? null,
    blocking_reason:
      r.blocking_reason ??
      r.blocker_reason ??
      r.block_reason ??
      r.readiness_note ??
      null,
    effective_from: r.effective_from ?? null,
    effective_to: r.effective_to ?? null,
    draft_product_route_id: r.draft_product_route_id ?? null,
    base_uom: r.base_uom ?? r.product_base_uom ?? r.uom ?? null,
  };
}

export function normalizeReadinessPayload(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const rows = coercePrmList(root.rows || root.items || root.data).map(
    normalizeReadinessRow,
  );
  const total =
    root.total_count != null ? Number(root.total_count) : rows.length;
  const status_counts = normalizePrmStatusCounts(
    root.status_counts ?? root.statusCounts ?? root.counts,
  );
  return {
    rows,
    total_count: Number.isFinite(total) ? total : rows.length,
    status_counts,
  };
}

export function normalizeRouteFamilyRouteDetail(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const header =
    root.header && typeof root.header === "object" ? root.header : root;
  return {
    header,
    validation: root.validation ?? null,
    steps: sortPrmFamilyRouteSteps(root.steps),
  };
}

export function normalizePreviewRouteFamilyRouteSteps(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const batch_evidence =
    root.batch_evidence && typeof root.batch_evidence === "object"
      ? root.batch_evidence
      : {
          total_batches: root.total_batches ?? null,
          with_post_extraction_wip:
            root.with_post_extraction_wip ??
            root.post_extraction_wip_batches ??
            null,
        };
  const noteSource = root.decision_notes ?? root.notes ?? [];
  const decision_notes = Array.isArray(noteSource)
    ? noteSource.filter((note) => note != null && note !== "")
    : noteSource == null || noteSource === ""
      ? []
      : [noteSource];
  const createdSource = root.records_created ?? [];
  const records_created = Array.isArray(createdSource)
    ? createdSource
    : coercePrmList(createdSource);
  return {
    preview_only: root.preview_only !== false,
    approvable: root.approvable === true,
    candidate_steps: sortPrmFamilyRouteSteps(
      root.candidate_steps || root.steps || [],
    ),
    batch_evidence,
    evidence_gaps: coercePrmList(root.evidence_gaps || root.gaps),
    decision_notes,
    records_created,
    raw: root,
  };
}

export function normalizeProductRouteDetail(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const header =
    root.header && typeof root.header === "object" ? root.header : root;
  return {
    header,
    validation: root.validation ?? null,
    overrides: coercePrmList(root.overrides),
    effective_steps: coercePrmList(root.effective_steps),
  };
}

export function normalizeEffectiveRoute(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  return {
    ...root,
    steps: coercePrmList(root.steps || root.effective_steps),
  };
}

export function normalizeRouteHistory(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const versions = coercePrmList(
    root.versions || root.history || root.routes || root,
  );
  return { versions, raw: root };
}

export function resolveRouteFamilyRouteStateFromHistory(versions = []) {
  const list = coercePrmList(versions);
  const byStatus = (want) =>
    list.find((v) => {
      const s = normalizePrmCode(
        v.status || v.route_status || v.approval_status,
      ).toUpperCase();
      return want.includes(s);
    }) || null;
  const approved = byStatus(["APPROVED"]);
  const draft = byStatus(["DRAFT"]);
  const review = byStatus(["IN_REVIEW", "SUBMITTED", "REVIEW"]);
  const pickId = (row) =>
    row ? row.family_route_id ?? row.route_id ?? row.id ?? null : null;
  return {
    versions: list,
    approved,
    draft,
    review,
    approved_family_route_id: pickId(approved),
    draft_family_route_id: pickId(draft) || pickId(review),
    approved_route_version:
      approved?.version_label ||
      approved?.version ||
      approved?.route_version ||
      null,
    draft_status:
      draft?.status || draft?.route_status || review?.status || null,
    review_status: review?.status || review?.route_status || null,
    open_family_route_id:
      pickId(draft) || pickId(review) || pickId(approved) || null,
    has_defined_route: list.length > 0,
  };
}

export function normalizeRouteFamilyCandidate(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const scope_mode =
    root.scope_mode ||
    (root.route_family_id
      ? "APPROVED_MAPPING_ROUTE_FAMILY"
      : "PRE_MAPPING_PRODUCT_GROUP_SET");
  return {
    scope_mode,
    route_family: root.route_family ?? null,
    product_groups: coercePrmList(root.product_groups || root.selected_product_groups),
    product_group_count:
      root.product_group_count ??
      coercePrmList(root.product_groups || root.selected_product_groups).length,
    product_count: root.product_count ?? null,
    products_with_eligible_history:
      root.products_with_eligible_history ?? null,
    eligible_batch_count: root.eligible_batch_count ?? null,
    policy: root.policy ?? null,
    summary: root.summary ?? null,
    family_steps: coercePrmList(root.family_steps || root.candidate_steps),
    approvable: false,
    creates_nothing: true,
    raw: root,
  };
}

export function normalizeProductCandidate(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  return {
    product: root.product ?? null,
    policy: root.policy ?? null,
    summary: root.summary ?? null,
    batch_quality: root.batch_quality ?? null,
    candidate_steps: coercePrmList(root.candidate_steps),
    family_comparison: coercePrmList(root.family_comparison),
    raw: root,
  };
}

export function partitionDeltaCandidatesBySuggestion(deltaCandidates = []) {
  const list = coercePrmList(deltaCandidates);
  const buckets = {
    ADD_STEP: [],
    BYPASS_STEP: [],
    REPLACE_STEP: [],
    ALTER_LOCATION: [],
    ALTER_RESOURCE: [],
    ALTER_CYCLE: [],
    ALTER_MANDATORY_STATUS: [],
    OTHER: [],
  };
  for (const row of list) {
    const suggestion = normalizePrmCode(
      row.delta_suggestion || row.delta_operation || row.suggested_operation,
    ).toUpperCase();
    if (Object.prototype.hasOwnProperty.call(buckets, suggestion)) {
      buckets[suggestion].push(row);
    } else {
      buckets.OTHER.push(row);
    }
  }
  return buckets;
}

export function normalizeDeltaCandidate(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  const delta_candidates = coercePrmList(root.delta_candidates);
  return {
    product: root.product ?? null,
    product_candidate_summary: root.product_candidate_summary ?? null,
    family_candidate_summary: root.family_candidate_summary ?? null,
    delta_candidates,
    approval_note: root.approval_note ?? null,
    partitioned: partitionDeltaCandidatesBySuggestion(delta_candidates),
    raw: root,
  };
}

export function extractCreatedRouteFamilyId(data) {
  const root = normalizePrmRpcPayload(data) || data || {};
  return (
    root.route_family_id ??
    root.family_id ??
    root.header?.route_family_id ??
    root.id ??
    null
  );
}

export function extractCreatedFamilyRouteId(data) {
  const root = normalizePrmRpcPayload(data) || data || {};
  // Prefer explicit Family-route keys. Never treat route_family_id (Family
  // master id) as the created Family route id.
  const candidates = [
    root.family_route_id,
    root.route_family_route_id,
    root.header?.family_route_id,
    root.header?.route_family_route_id,
    root.family_route?.id,
    root.route?.family_route_id,
    root.route_id,
    root.id,
  ];
  for (const candidate of candidates) {
    const id = normalizePrmIntegerId(candidate);
    if (id != null) return id;
  }
  return null;
}

export function extractCreatedProductRouteId(data) {
  const root = normalizePrmRpcPayload(data) || data || {};
  return (
    root.product_route_id ??
    root.header?.product_route_id ??
    root.route_id ??
    root.id ??
    null
  );
}

export function extractCreatedMappingId(data) {
  const root = normalizePrmRpcPayload(data) || data || {};
  return (
    root.id ??
    root.mapping_id ??
    root.route_family_mapping_id ??
    null
  );
}

export function extractCreatedAssignmentId(data) {
  const root = normalizePrmRpcPayload(data) || data || {};
  return (
    normalizePrmIntegerId(root.assignment_id) ??
    normalizePrmIntegerId(root.product_route_family_assignment_id) ??
    normalizePrmIntegerId(root.id) ??
    null
  );
}

export function normalizeProductRouteFamilyAssignmentPayload(data) {
  const root = normalizePrmRpcPayload(data) || data || {};
  return {
    assignment_id: extractCreatedAssignmentId(root),
    status: root.status || root.assignment_status || null,
    product_id: root.product_id ?? null,
    route_family_id: root.route_family_id ?? null,
    effective_from: root.effective_from ?? null,
    assignment_basis: root.assignment_basis ?? null,
    assignment_note: root.assignment_note ?? null,
    raw: root,
  };
}

export function normalizePipelineStatusPayload(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  return { ...root, raw: root };
}

export function normalizeRouteFamilyOnboardingStatusPayload(payload) {
  const root = normalizePrmRpcPayload(payload) || payload || {};
  return { ...root, raw: root };
}

export function normalizeRouteFamilyMappingPayload(data) {
  const root = normalizePrmRpcPayload(data) || data || {};
  const row =
    root.mapping && typeof root.mapping === "object"
      ? root.mapping
      : root.route_family_mapping && typeof root.route_family_mapping === "object"
        ? root.route_family_mapping
        : root;
  return normalizePrmRouteFamilyMapping(row);
}

export function buildFamilyStepJson(fields = {}) {
  const step = {};
  const keys = [
    "step_key",
    "sequence_no",
    "activity_id",
    "activity",
    "activity_name",
    "cost_centre_id",
    "section_id",
    "subsection_id",
    "area_id",
    "plant_id",
    "behaviour",
    "behaviour_code",
    "resource_class",
    "resource_class_code",
    "location",
    "area",
    "plant",
    "route_step_scope",
    "expected_occurrence_count",
    "standard_cycle_count",
    "is_mandatory",
    "allows_repeat",
    "allows_skip_with_approval",
    "production_overhead_scope",
    "direct_labour_scope",
    "note",
    "step_note",
  ];
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
    if (fields[key] === undefined) continue;
    step[key] = fields[key];
  }
  if (step.behaviour_code && !step.behaviour) {
    step.behaviour = step.behaviour_code;
  }
  if (step.resource_class_code && !step.resource_class) {
    step.resource_class = step.resource_class_code;
  }
  if (step.step_note && !step.note) {
    step.note = step.step_note;
  }
  return step;
}

export function buildOverrideJson(fields = {}) {
  const override = {};
  const keys = [
    "delta_operation",
    "override_operation",
    "target_step_key",
    "step_key",
    "sequence_no",
    "activity_id",
    "cost_centre_id",
    "behaviour",
    "resource_class",
    "location",
    "area",
    "plant",
    "note",
    "override_note",
  ];
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
    if (fields[key] === undefined) continue;
    override[key] = fields[key];
  }
  return override;
}

export function normalizePrmAsOfForEffective(asOf) {
  return normalizePrmAsOfDate(asOf, { fallbackToToday: false });
}

export function isBlankPrmRpcValue(value) {
  return isBlankPrmValue(value);
}
