/**
 * Thin RPC adapter for e-Aushadhi Review & Control.
 * No rendering. No direct regulatory table access.
 */
import { supabase } from "./supabaseClient.js";
import {
  classifyRpcError,
  optionId,
  PORTAL_DOMAINS,
} from "./eaushadhi-review-helpers.js";

export class EaushadhiRpcError extends Error {
  constructor(rpcName, original, classified) {
    super(classified?.userMessage || original?.message || "RPC failed");
    this.name = "EaushadhiRpcError";
    this.rpcName = rpcName;
    this.kind = classified?.kind || "server";
    this.original = original;
    this.code = original?.code || original?.errcode || null;
    this.retryable = classified?.retryable === true;
  }
}

function asArray(data) {
  if (data == null) return [];
  return Array.isArray(data) ? data : [data];
}

function asFirst(data) {
  if (data == null) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

function throwIfRpcError(rpcName, error) {
  if (!error) return;
  const classified = classifyRpcError(error);
  console.error(`[eaushadhi] ${rpcName} failed`, error, classified);
  throw new EaushadhiRpcError(rpcName, error, classified);
}

async function callRpc(rpcName, args) {
  const { data, error } = args
    ? await supabase.rpc(rpcName, args)
    : await supabase.rpc(rpcName);
  throwIfRpcError(rpcName, error);
  return data;
}

export async function fetchProductQueue() {
  return asArray(await callRpc("rpc_eaushadhi_product_queue"));
}

export async function fetchPortalOptions(domainCode) {
  const domain = String(domainCode || "").toUpperCase();
  if (!PORTAL_DOMAINS.includes(domain)) {
    throw new EaushadhiRpcError(
      "rpc_eaushadhi_portal_options",
      new Error(`Unsupported e-Aushadhi portal option domain: ${domainCode}`),
      classifyRpcError({ message: `Unsupported e-Aushadhi portal option domain: ${domainCode}` }),
    );
  }
  return asArray(
    await callRpc("rpc_eaushadhi_portal_options", {
      p_domain_code: domain,
    }),
  );
}

export async function fetchPermissionPurposeOptions() {
  return asArray(await callRpc("rpc_eaushadhi_permission_purpose_options"));
}

export async function fetchPharmacologicalActionOptions() {
  return asArray(await callRpc("rpc_eaushadhi_pharmacological_action_options"));
}

export async function fetchReviewQueue(productId) {
  const id = Number(optionId(productId));
  if (!Number.isInteger(id) || id <= 0) {
    throw new EaushadhiRpcError(
      "rpc_eaushadhi_review_queue",
      new Error("p_product_id is required"),
      classifyRpcError({ message: "p_product_id is required" }),
    );
  }
  return asArray(
    await callRpc("rpc_eaushadhi_review_queue", {
      p_product_id: id,
    }),
  );
}

export async function saveLineReview({
  sourceCompositionLineId,
  expectedRowVersion,
  ingredientTypeOptionId,
  ingredientFormOptionId,
  partUsedOptionId,
  measurementOptionId,
  verify = false,
  reviewNotes = null,
} = {}) {
  return asFirst(
    await callRpc("rpc_eaushadhi_save_line_review", {
      p_source_composition_line_id: Number(sourceCompositionLineId),
      p_expected_row_version: Number(expectedRowVersion),
      p_ingredient_type_option_id: ingredientTypeOptionId == null
        ? null
        : Number(ingredientTypeOptionId),
      p_ingredient_form_option_id: ingredientFormOptionId == null
        ? null
        : Number(ingredientFormOptionId),
      p_part_used_option_id: partUsedOptionId == null
        ? null
        : Number(partUsedOptionId),
      p_measurement_option_id: measurementOptionId == null
        ? null
        : Number(measurementOptionId),
      p_verify: verify === true,
      p_review_notes: reviewNotes,
    }),
  );
}

export async function fetchProductReview(productId) {
  return asFirst(
    await callRpc("rpc_eaushadhi_product_review_get", {
      p_product_id: Number(productId),
    }),
  );
}

export async function saveProductReview({
  productId,
  expectedRowVersion,
  permissionPurposeTermId,
  compositionTitle,
  diseasesConditionsText,
  containsBhang,
  containsOpium,
  containsOtherNarcotic,
  containsScheduleE1,
  containsSelfGeneratedAlcohol,
  reviewNotes = null,
  verify = false,
} = {}) {
  return asFirst(
    await callRpc("rpc_eaushadhi_product_review_save", {
      p_product_id: Number(productId),
      p_expected_row_version: Number(expectedRowVersion),
      p_permission_purpose_term_id:
        permissionPurposeTermId == null
          ? null
          : Number(permissionPurposeTermId),
      p_composition_title: compositionTitle,
      p_diseases_conditions_text: diseasesConditionsText,
      p_contains_bhang: containsBhang,
      p_contains_opium: containsOpium,
      p_contains_other_narcotic: containsOtherNarcotic,
      p_contains_schedule_e1: containsScheduleE1,
      p_contains_self_generated_alcohol: containsSelfGeneratedAlcohol,
      p_review_notes: reviewNotes,
      p_verify: verify === true,
    }),
  );
}

export async function fetchProductActions(productId) {
  return asArray(
    await callRpc("rpc_eaushadhi_product_actions_get", {
      p_product_id: Number(productId),
    }),
  );
}

export async function saveProductActions({
  productId,
  expectedWorkflowRowVersion,
  actions,
  verify = false,
} = {}) {
  return asFirst(
    await callRpc("rpc_eaushadhi_product_actions_save", {
      p_product_id: Number(productId),
      p_expected_workflow_row_version: Number(expectedWorkflowRowVersion),
      p_actions: Array.isArray(actions) ? actions : [],
      p_verify: verify === true,
    }),
  );
}

export async function fetchEvidenceStatus(productId) {
  return asFirst(
    await callRpc("rpc_eaushadhi_product_evidence_status", {
      p_product_id: Number(productId),
    }),
  );
}

export async function fetchProductIssues(productId) {
  return asArray(
    await callRpc("rpc_eaushadhi_product_issues", {
      p_product_id: Number(productId),
    }),
  );
}

export async function promoteVerifiedFormulation({
  productId,
  expectedWorkflowRowVersion,
  approvalNotes = null,
} = {}) {
  return asFirst(
    await callRpc("rpc_eaushadhi_promote_verified_formulation", {
      p_product_id: Number(productId),
      p_expected_workflow_row_version: Number(expectedWorkflowRowVersion),
      p_approval_notes: approvalNotes,
    }),
  );
}

export async function verifyProduct({
  productId,
  expectedRowVersion,
  notes = null,
} = {}) {
  return asFirst(
    await callRpc("rpc_eaushadhi_verify_product", {
      p_product_id: Number(productId),
      p_expected_row_version: Number(expectedRowVersion),
      p_notes: notes,
    }),
  );
}

export async function loadSessionCatalogs() {
  const [
    typeOptions,
    formOptions,
    partOptions,
    unitOptions,
    permissionPurposeOptions,
    pharmacologicalActionOptions,
  ] = await Promise.all([
    fetchPortalOptions("INGREDIENT_TYPE"),
    fetchPortalOptions("INGREDIENT_FORM"),
    fetchPortalOptions("PART_USED"),
    fetchPortalOptions("MEASUREMENT_UNIT"),
    fetchPermissionPurposeOptions(),
    fetchPharmacologicalActionOptions(),
  ]);
  return {
    portalOptions: {
      INGREDIENT_TYPE: typeOptions,
      INGREDIENT_FORM: formOptions,
      PART_USED: partOptions,
      MEASUREMENT_UNIT: unitOptions,
    },
    permissionPurposeOptions,
    pharmacologicalActionOptions,
  };
}

export async function loadProductWorkspace(productId) {
  const id = Number(optionId(productId));
  const [review, lines, actions, evidence, issues] = await Promise.all([
    fetchProductReview(id),
    fetchReviewQueue(id),
    fetchProductActions(id),
    fetchEvidenceStatus(id),
    fetchProductIssues(id),
  ]);
  return { review, lines, actions, evidence, issues };
}
