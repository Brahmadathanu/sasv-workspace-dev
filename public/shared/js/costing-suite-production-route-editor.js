/**
 * Production Route Manager — Manufacturing Route Family and Product editors.
 * RPC-only; Product routes persist deltas over an approved family route.
 */

import {
  PRM_COST_CENTRE_ACTION_DISABLED_REASON,
  PRM_DELTA_OPERATIONS,
  buildCollisionSafeSequencePlan,
  buildPrmFamilyRouteValidationSummary,
  buildPostExtractionEvidenceGapNotice,
  classifyPrmFamilyRouteValidationPresentation,
  extractValidationIssues,
  PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION,
  filterUntouchedFamilyStepsFromOverrides,
  formatPrmActionLabel,
  formatPrmBatchSizeReferenceLabel,
  formatPrmDayMonthYearLabel,
  formatPrmDeltaLabel,
  formatPrmDeltaTargetCopy,
  formatPrmEffectiveFromDisplay,
  formatPrmEffectiveToDisplay,
  PRM_PRODUCT_ROUTE_CREATE_BATCH_REQUIRED,
  formatPrmRouteEvidenceStatusLabel,
  formatPrmRouteSourceTypeLabel,
  formatPrmRouteStatusLabel,
  formatPrmRouteVersionCopy,
  formatPrmStepSourceLabel,
  formatPrmSupersedesVersionCopy,
  formatPrmValidationLabel,
  formatPrmRpcError,
  getPrmLocalIsoDate,
  isBlankPrmValue,
  isMeaningfulPrmApprovalReference,
  isPrmRouteCloneableStatus,
  isPrmRouteReadOnlyStatus,
  isPrmRouteReviewStatus,
  isPrmRouteWritableStatus,
  isValidationSuccessful,
  normalizePrmAsOfDate,
  normalizePrmCode,
  normalizePrmIntegerId,
  canonicalPrmRouteStatus,
  resolvePrmProductRouteApprovalIdentity,
  resolvePrmFamilyRouteApprovalIdentity,
  buildPrmResourceClassLabelIndex,
  shouldAcceptPrmFamilyRouteDetailGeneration,
  resolvePrmFamilyRouteLifecycleActions,
  resolvePrmProductRouteLifecycleActions,
  sortPrmFamilyRouteSteps,
  normalizePrmFamilyRouteStep,
  normalizePrmProductRouteOverride,
  collectPrmFamilyRouteStepKeys,
  suggestPrmFamilyRouteStepKey,
  validatePrmFamilyRouteApprovalReference,
  validatePrmProductRouteApprovalReference,
} from "./costing-suite-production-route-helpers.js";
import {
  buildApproveRouteFamilyRouteArgs,
  buildApproveProductRouteArgs,
  buildCloneRouteFamilyRouteDraftArgs,
  buildCreateRouteFamilyRouteDraftArgs,
  buildCreateProductRouteDraftArgs,
  buildDeleteRouteFamilyRouteStepArgs,
  buildDeleteProductOverrideArgs,
  buildFamilyStepJson,
  buildOverrideJson,
  buildPreviewRouteFamilyRouteStepsArgs,
  buildProductRouteDetailArgs,
  buildRouteFamilyRouteDetailArgs,
  buildSubmitRouteFamilyRouteArgs,
  buildSubmitProductRouteArgs,
  buildSupersedeRouteFamilyRouteArgs,
  buildSupersedeProductRouteArgs,
  buildUpdateProductRouteDraftArgs,
  buildUpsertRouteFamilyRouteStepArgs,
  buildUpsertProductOverrideArgs,
  buildValidateRouteFamilyRouteArgs,
  buildValidateProductRouteArgs,
  buildRouteFamilyRouteHistoryArgs,
  extractCreatedFamilyRouteId,
  extractCreatedProductRouteId,
  normalizePreviewRouteFamilyRouteSteps,
  normalizeProductRouteDetail,
  normalizeRouteFamilyRouteDetail,
  normalizeRouteHistory,
} from "./costing-suite-production-route-rpc.js";
import {
  bindFamilyStepFormCascade,
  buildFamilyStepFormHtml,
  findDuplicatePrmFamilyStepKeys,
  findDuplicatePrmFamilyStepSequences,
  nextPrmFamilyStepSequence,
  previousPrmFamilyStepSequence,
  readFamilyStepFormValues,
  validatePrmFamilyStepForm,
} from "./costing-suite-production-route-step-form.js";
import {
  bindProductDeltaForm,
  buildProductDeltaFormHtml,
  readProductDeltaFormValues,
  validatePrmProductDeltaForm,
} from "./costing-suite-production-route-delta-form.js";

const RPC = Object.freeze({
  familyDetail: "rpc_get_route_family_route_detail",
  productDetail: "rpc_get_product_route_detail",
  createFamilyDraft: "rpc_create_route_family_route_draft",
  cloneFamilyDraft: "rpc_clone_route_family_route_draft",
  familyStepSave: "rpc_upsert_route_family_route_step",
  familyStepDelete: "rpc_delete_route_family_route_step",
  validateFamily: "rpc_validate_route_family_route",
  submitFamily: "rpc_submit_route_family_route_for_review",
  approveFamily: "rpc_approve_route_family_route",
  supersedeFamily: "rpc_supersede_route_family_route",
  createProductDraft: "rpc_create_product_route_draft",
  updateProductDraft: "rpc_update_product_route_draft",
  productDeltaSave: "rpc_upsert_product_route_override",
  productDeltaDelete: "rpc_delete_product_route_override",
  validateProduct: "rpc_validate_product_route",
  submitProduct: "rpc_submit_product_route_for_review",
  approveProduct: "rpc_approve_product_route",
  supersedeProduct: "rpc_supersede_product_route",
  previewFamilySteps: "rpc_preview_route_family_route_steps",
  familyHistory: "rpc_get_route_family_route_history",
});

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

function routeStatus(header) {
  return normalizePrmCode(
    header?.status || header?.route_status || header?.approval_status,
  );
}

function resultError(built, fallback) {
  return built?.errors?.join("; ") || fallback;
}

export function createProductionRouteEditorController(deps = {}) {
  const {
    costingRpc,
    showToast,
    canEdit = () => false,
    onValidationStateChange = null,
    getOptions = () => null,
  } = deps;

  let familyState = {
    detail: null,
    steps: [],
    validation: null,
    validationFresh: false,
    evidencePreview: null,
    evidenceGapNotice: null,
    evidenceLoadWarning: null,
    predecessorHistory: [],
    loading: false,
    error: null,
  };
  let productState = {
    detail: null,
    familySkeleton: [],
    overrides: [],
    effective: [],
    validation: null,
    validationFresh: false,
    loading: false,
    error: null,
  };
  let familyRouteDetailGeneration = 0;

  function bumpFamilyRouteDetailGeneration() {
    familyRouteDetailGeneration += 1;
    return familyRouteDetailGeneration;
  }

  function isCurrentFamilyRouteDetailGeneration(requestGeneration) {
    return shouldAcceptPrmFamilyRouteDetailGeneration({
      requestGeneration,
      currentGeneration: familyRouteDetailGeneration,
    });
  }

  const familyId = () =>
    familyState.detail?.family_route_id ??
    familyState.detail?.route_family_route_id ??
    familyState.detail?.route_id ??
    familyState.detail?.id ??
    null;
  const productId = () =>
    productState.detail?.product_route_id ??
    productState.detail?.route_id ??
    productState.detail?.id ??
    null;

  function resourceClassStepContext() {
    const catalogue = getOptions?.()?.resource_classes || [];
    return {
      catalogue,
      catalogueIndex: buildPrmResourceClassLabelIndex(catalogue),
    };
  }

  const editable = (header) =>
    canEdit() && isPrmRouteWritableStatus(routeStatus(header));

  function markValidationStale(mode) {
    const target = mode === "family" ? familyState : productState;
    target.validationFresh = false;
    onValidationStateChange?.(mode, target);
  }

  async function invoke(name, built, fallback) {
    if (!built?.ok) {
      const message = resultError(built, fallback);
      showToast?.(message, "warning");
      return { ok: false, errors: built?.errors || [message] };
    }
    const { data, error } = await costingRpc(name, built.params);
    if (error) {
      showToast?.(error.message || fallback, "error");
      return { ok: false, error };
    }
    return { ok: true, data };
  }

  async function loadFamilyEvidencePreview(
    familyRouteId,
    header = {},
    { requestGeneration = null } = {},
  ) {
    const dateTo =
      normalizePrmAsOfDate(header.as_of_date || header.effective_to, {
        fallbackToToday: true,
      }) || getPrmLocalIsoDate();
    const dateFrom =
      normalizePrmAsOfDate(header.effective_from || header.evidence_from, {
        fallbackToToday: false,
      }) || dateTo;
    const built = buildPreviewRouteFamilyRouteStepsArgs({
      family_route_id: familyRouteId,
      date_from: dateFrom,
      date_to: dateTo,
    });
    if (!built.ok) {
      if (
        requestGeneration == null ||
        isCurrentFamilyRouteDetailGeneration(requestGeneration)
      ) {
        familyState.evidenceLoadWarning =
          "Supplementary evidence could not be loaded.";
      }
      return { ok: false };
    }
    try {
      const { data, error } = await costingRpc(RPC.previewFamilySteps, built.params);
      if (error) throw error;
      const normalized = normalizePreviewRouteFamilyRouteSteps(data);
      if (
        requestGeneration != null &&
        !isCurrentFamilyRouteDetailGeneration(requestGeneration)
      ) {
        return { ok: false, stale: true };
      }
      familyState.evidencePreview = normalized;
      familyState.evidenceGapNotice =
        buildPostExtractionEvidenceGapNotice(normalized);
      return { ok: true, data: normalized };
    } catch {
      if (
        requestGeneration == null ||
        isCurrentFamilyRouteDetailGeneration(requestGeneration)
      ) {
        familyState.evidenceLoadWarning =
          "Supplementary evidence could not be loaded.";
      }
      return { ok: false };
    }
  }

  async function loadPredecessorHistoryIfNeeded(
    header = {},
    { requestGeneration = null } = {},
  ) {
    const supersedesId = normalizePrmIntegerId(header?.supersedes_route_id);
    if (supersedesId == null) return [];
    const routeFamilyId = normalizePrmIntegerId(header?.route_family_id);
    if (routeFamilyId == null) return [];
    const built = buildRouteFamilyRouteHistoryArgs({
      route_family_id: routeFamilyId,
    });
    if (!built?.ok) return [];
    try {
      const { data, error } = await costingRpc(RPC.familyHistory, built.params);
      if (error) return [];
      if (
        requestGeneration != null &&
        !isCurrentFamilyRouteDetailGeneration(requestGeneration)
      ) {
        return { ok: false, stale: true, history: [] };
      }
      const history = normalizeRouteHistory(data).versions || [];
      familyState.predecessorHistory = history;
      return history;
    } catch {
      if (
        requestGeneration == null ||
        isCurrentFamilyRouteDetailGeneration(requestGeneration)
      ) {
        familyState.predecessorHistory = [];
      }
      return [];
    }
  }

  async function loadFamilyDetail(
    familyRouteId,
    {
      preserveValidationStale = false,
      retainCurrentValidationIfOmitted = false,
      generation = null,
      includeSecondary = true,
    } = {},
  ) {
    const requestGeneration =
      generation != null
        ? Number(generation)
        : bumpFamilyRouteDetailGeneration();
    const quiet = includeSecondary === false;
    if (!quiet) {
      familyState.loading = true;
    }
    familyState.error = null;
    try {
      const response = await invoke(
        RPC.familyDetail,
        buildRouteFamilyRouteDetailArgs({ family_route_id: familyRouteId }),
        "Unable to load Manufacturing Route Family route.",
      );
      if (!isCurrentFamilyRouteDetailGeneration(requestGeneration)) {
        return { ok: false, stale: true };
      }
      if (!response.ok) return response;
      const normalized = normalizeRouteFamilyRouteDetail(response.data);
      if (!isCurrentFamilyRouteDetailGeneration(requestGeneration)) {
        return { ok: false, stale: true };
      }
      familyState.detail = normalized.header;
      familyState.steps = sortPrmFamilyRouteSteps(
        normalized.steps || [],
        resourceClassStepContext(),
      );
      if (normalized.validation) {
        familyState.validation = normalized.validation;
        familyState.validationFresh = preserveValidationStale
          ? false
          : isValidationSuccessful(familyState.validation);
      } else if (
        retainCurrentValidationIfOmitted &&
        familyState.validationFresh &&
        isValidationSuccessful(familyState.validation)
      ) {
        // Detail omitted validation after a successful Validate RPC. Keep the
        // RPC result current until a validation-relevant mutation marks stale.
      } else {
        familyState.validation = normalized.validation || null;
        familyState.validationFresh = preserveValidationStale
          ? false
          : isValidationSuccessful(familyState.validation);
      }
      if (!includeSecondary) {
        return { ok: true, detail: normalized.header, normalized };
      }
      familyState.evidencePreview = null;
      familyState.evidenceGapNotice = null;
      familyState.evidenceLoadWarning = null;
      familyState.predecessorHistory = [];
      const historyResult = await loadPredecessorHistoryIfNeeded(
        familyState.detail || {},
        { requestGeneration },
      );
      if (!isCurrentFamilyRouteDetailGeneration(requestGeneration)) {
        return { ok: true, detail: normalized.header, normalized };
      }
      if (historyResult?.stale !== true) {
        const evidenceResult = await loadFamilyEvidencePreview(
          familyRouteId,
          familyState.detail || {},
          { requestGeneration },
        );
        if (evidenceResult?.stale === true) {
          return { ok: true, detail: normalized.header, normalized };
        }
      }
      return { ok: true, detail: normalized.header, normalized };
    } catch (error) {
      if (isCurrentFamilyRouteDetailGeneration(requestGeneration)) {
        familyState.error =
          error?.message || "Unable to load Manufacturing Route Family route.";
        showToast?.(familyState.error, "error");
      }
      return { ok: false, error };
    } finally {
      if (isCurrentFamilyRouteDetailGeneration(requestGeneration)) {
        familyState.loading = false;
      }
    }
  }

  async function loadProductDetail(
    productRouteId,
    { preserveValidationStale = false } = {},
  ) {
    productState.loading = true;
    productState.error = null;
    try {
      const response = await invoke(
        RPC.productDetail,
        buildProductRouteDetailArgs({ product_route_id: productRouteId }),
        "Unable to load Product route.",
      );
      if (!response.ok) return response;
      const normalized = normalizeProductRouteDetail(response.data);
      productState.detail = normalized.header;
      productState.overrides = filterUntouchedFamilyStepsFromOverrides(
        normalized.overrides || [],
      );
      productState.effective =
        normalized.effective_steps || normalized.steps || [];
      productState.validation = normalized.validation || null;
      productState.validationFresh = preserveValidationStale
        ? false
        : isValidationSuccessful(productState.validation);
      productState.familySkeleton = [];

      const baseId = normalized.header?.base_route_family_route_id;
      if (baseId != null) {
        const inherited = await invoke(
          RPC.familyDetail,
          buildRouteFamilyRouteDetailArgs({ family_route_id: baseId }),
          "Unable to load inherited family route.",
        );
        if (inherited.ok) {
          const family = normalizeRouteFamilyRouteDetail(inherited.data);
          productState.familySkeleton = (family.steps || []).map((step) => ({
            ...step,
            step_source: "ROUTE_FAMILY",
          }));
        }
      }
      return { ok: true, detail: normalized.header, normalized };
    } catch (error) {
      productState.error = error?.message || "Unable to load Product route.";
      showToast?.(productState.error, "error");
      return { ok: false, error };
    } finally {
      productState.loading = false;
    }
  }

  async function createFamilyDraft(input = {}) {
    if (!canEdit()) return denied();
    const response = await invoke(
      RPC.createFamilyDraft,
      buildCreateRouteFamilyRouteDraftArgs(input),
      "Unable to create family route draft.",
    );
    if (!response.ok) return response;
    markValidationStale("family");
    return {
      ...response,
      family_route_id: extractCreatedFamilyRouteId(response.data),
    };
  }

  async function cloneFamilyDraft(input = {}) {
    if (!canEdit()) return denied();
    const response = await invoke(
      RPC.cloneFamilyDraft,
      buildCloneRouteFamilyRouteDraftArgs({
        source_family_route_id: input.source_family_route_id ?? familyId(),
        effective_from: input.effective_from,
        route_name: input.route_name,
        route_note: input.route_note,
      }),
      "Unable to clone family route draft.",
    );
    if (!response.ok) return response;
    markValidationStale("family");
    return {
      ...response,
      family_route_id: extractCreatedFamilyRouteId(response.data),
    };
  }

  async function createProductDraft({
    product_id = null,
    base_route_family_route_id = null,
    batch_size_ref_id = null,
    effective_from = null,
    source_type = null,
    evidence_status = null,
    route_note = null,
    evidence_source = null,
    evidence_reference = null,
    evidence_note = null,
  } = {}) {
    if (!canEdit()) return denied();
    const response = await invoke(
      RPC.createProductDraft,
      buildCreateProductRouteDraftArgs({
        product_id,
        base_route_family_route_id,
        batch_size_ref_id,
        effective_from,
        source_type,
        evidence_status,
        route_note,
        evidence_source,
        evidence_reference,
        evidence_note,
      }),
      "Unable to create Product route draft.",
    );
    if (!response.ok) return response;
    markValidationStale("product");
    return {
      ...response,
      product_route_id: extractCreatedProductRouteId(response.data),
    };
  }

  function denied() {
    showToast?.("Edit permission required.", "warning");
    return { ok: false, reason: "permission" };
  }

  function blocked() {
    showToast?.(PRM_COST_CENTRE_ACTION_DISABLED_REASON, "warning");
    return { ok: false, reason: "cost_centre_required" };
  }

  function readOnly(mode) {
    showToast?.(`${mode === "family" ? "Family" : "Product"} route is read-only.`, "warning");
    return { ok: false, reason: "read_only" };
  }

  async function saveFamilyStep(
    { step_id = null, step = {}, ...fields } = {},
    { costCentreBlocked = false } = {},
  ) {
    if (!editable(familyState.detail)) return readOnly("family");
    if (costCentreBlocked) return blocked();
    const response = await invoke(
      RPC.familyStepSave,
      buildUpsertRouteFamilyRouteStepArgs({
        family_route_id: familyId(),
        step_id,
        step: buildFamilyStepJson({ ...fields, ...step }),
      }),
      "Unable to save family route step.",
    );
    if (response.ok) markValidationStale("family");
    return response;
  }

  async function deleteFamilyStep({
    family_route_step_id = null,
    step_id = null,
  } = {}) {
    if (!editable(familyState.detail)) return readOnly("family");
    const familyRouteId = normalizePrmIntegerId(familyId());
    const stepId = normalizePrmIntegerId(step_id ?? family_route_step_id);
    if (familyRouteId == null || stepId == null) {
      showToast?.(
        "Family Route ID and step ID are required to remove a step.",
        "warning",
      );
      return { ok: false, reason: "invalid_ids" };
    }
    const built = buildDeleteRouteFamilyRouteStepArgs({
      family_route_id: familyRouteId,
      step_id: stepId,
    });
    const response = await invoke(
      RPC.familyStepDelete,
      built,
      "Unable to delete family route step.",
    );
    if (!response.ok) {
      console.error(
        formatPrmRpcError(RPC.familyStepDelete, built.params, response.error),
        response.error,
      );
    }
    if (response.ok) markValidationStale("family");
    return response;
  }

  async function applyFamilyStepOrder(
    orderedStepIds = [],
    { costCentreBlocked = false } = {},
  ) {
    if (!editable(familyState.detail)) return readOnly("family");
    if (costCentreBlocked) return blocked();
    const plan = buildCollisionSafeSequencePlan(
      familyState.steps,
      orderedStepIds,
    );
    for (const update of plan.updates) {
      const existing = familyState.steps.find((step) =>
        String(step.family_route_step_id ?? step.route_step_id ?? step.step_id ?? step.id) ===
        String(update.id),
      );
      const result = await saveFamilyStep(
        {
          step_id: update.id,
          step: { ...(existing || {}), sequence_no: update.sequence_no },
        },
        { costCentreBlocked },
      );
      if (!result.ok) return { ...result, plan };
    }
    markValidationStale("family");
    return { ok: true, plan };
  }

  async function updateProductDraft(fields = {}) {
    if (!editable(productState.detail)) return readOnly("product");
    const patchSource =
      fields.patch && typeof fields.patch === "object"
        ? fields.patch
        : fields;
    const response = await invoke(
      RPC.updateProductDraft,
      buildUpdateProductRouteDraftArgs({
        product_route_id: productId(),
        patch: patchSource,
      }),
      "Unable to update Product route draft.",
    );
    if (response.ok) markValidationStale("product");
    return response;
  }

  async function saveProductOverride(
    { override_id = null, override = {}, ...fields } = {},
    { costCentreBlocked = false } = {},
  ) {
    if (!editable(productState.detail)) return readOnly("product");
    const clean = filterUntouchedFamilyStepsFromOverrides([
      buildOverrideJson({ ...fields, ...override }),
    ]);
    if (!clean.length) {
      showToast?.("Only explicit Product deltas can be saved.", "warning");
      return { ok: false, reason: "untouched_family_step" };
    }
    const operation = normalizePrmCode(
      clean[0].operation_type ||
        clean[0].delta_operation ||
        clean[0].override_operation,
    ).toUpperCase();
    if (operation && !PRM_DELTA_OPERATIONS.includes(operation)) {
      showToast?.("Unsupported Product delta operation.", "warning");
      return { ok: false, reason: "invalid_delta" };
    }
    if (costCentreBlocked && operation === "ADD_STEP") return blocked();
    const response = await invoke(
      RPC.productDeltaSave,
      buildUpsertProductOverrideArgs({
        product_route_id: productId(),
        override_id,
        override: clean[0],
      }),
      "Unable to save Product delta.",
    );
    if (response.ok) markValidationStale("product");
    return response;
  }

  async function deleteProductOverride({
    override_id = null,
    product_route_override_id = null,
  } = {}) {
    if (!editable(productState.detail)) return readOnly("product");
    const id = normalizePrmIntegerId(override_id ?? product_route_override_id);
    const routeId = normalizePrmIntegerId(productId());
    if (routeId == null) {
      showToast?.("Product route ID is required.", "warning");
      return { ok: false, reason: "missing_product_route_id" };
    }
    if (id == null) {
      showToast?.("Product delta ID is required.", "warning");
      return { ok: false, reason: "missing_override_id" };
    }
    const response = await invoke(
      RPC.productDeltaDelete,
      buildDeleteProductOverrideArgs({
        product_route_id: routeId,
        override_id: id,
      }),
      "Unable to delete Product delta.",
    );
    if (response.ok) markValidationStale("product");
    return response;
  }

  async function validate(mode) {
    if (!canEdit()) return denied();
    const family = mode === "family";
    const target = family ? familyState : productState;
    // Explicit Validate always re-confirms with the server.
    // Do not skip merely because validationFresh is already true.
    const response = await invoke(
      family ? RPC.validateFamily : RPC.validateProduct,
      family
        ? buildValidateRouteFamilyRouteArgs({ family_route_id: familyId() })
        : buildValidateProductRouteArgs({ product_route_id: productId() }),
      "Route validation failed.",
    );
    if (!response.ok) {
      if (family) target.validationFresh = false;
      return { ...response, rpcFailed: true };
    }
    target.validation = response.data;
    target.validationFresh = isValidationSuccessful(response.data);
    onValidationStateChange?.(mode, target);
    return {
      ...response,
      ok: target.validationFresh,
      issues: extractValidationIssues(response.data),
    };
  }

  async function submit(mode) {
    if (!canEdit()) return denied();
    const family = mode === "family";
    const target = family ? familyState : productState;
    if (!family) {
      const status = normalizePrmCode(routeStatus(target.detail)).toUpperCase();
      if (status !== "DRAFT") {
        showToast?.(
          status
            ? `Submit for review is available for DRAFT routes only (current: ${formatPrmRouteStatusLabel(status) || status}).`
            : "Submit for review is available for DRAFT routes only.",
          "warning",
        );
        return { ok: false, reason: "not_draft" };
      }
    }
    if (!target.validationFresh) {
      showToast?.("Validate after the latest edits before submitting.", "warning");
      return { ok: false, reason: "stale_validation" };
    }
    const response = await invoke(
      family ? RPC.submitFamily : RPC.submitProduct,
      family
        ? buildSubmitRouteFamilyRouteArgs({ family_route_id: familyId() })
        : buildSubmitProductRouteArgs({ product_route_id: productId() }),
      "Unable to submit route.",
    );
    if (response.ok) markValidationStale(mode);
    return response;
  }

  async function approve(
    mode,
    approvalReference,
    { costCentreBlocked = false } = {},
  ) {
    if (!canEdit()) return denied();
    if (costCentreBlocked) return blocked();
    const family = mode === "family";
    let approval_reference = String(approvalReference || "").trim();
    if (!isMeaningfulPrmApprovalReference(approval_reference)) {
      showToast?.(
        "Enter a meaningful approval reference. Placeholders such as — or N/A are not allowed.",
        "warning",
      );
      return { ok: false, reason: "placeholder_approval_reference" };
    }
    if (family) {
      const identity = resolvePrmFamilyRouteApprovalIdentity({
        detail: familyState.detail || {},
      });
      if (!identity.ok) {
        showToast?.(identity.error, "warning");
        return { ok: false, reason: identity.reason };
      }
      const checked = validatePrmFamilyRouteApprovalReference(
        approval_reference,
        {
          routeFamilyCode: identity.routeFamilyCode,
          routeVersion: identity.routeVersion,
          approvalDate: getPrmLocalIsoDate(),
        },
      );
      if (!checked.ok) {
        showToast?.(checked.error, "warning");
        return { ok: false, reason: checked.reason };
      }
      approval_reference = checked.reference;
    }
    if (!family) {
      const identity = resolvePrmProductRouteApprovalIdentity({
        detail: productState.detail || {},
      });
      if (!identity.ok) {
        showToast?.(identity.error, "warning");
        return { ok: false, reason: identity.reason };
      }
      const checked = validatePrmProductRouteApprovalReference(
        approval_reference,
        {
          productId: identity.productId,
          routeVersion: identity.routeVersion,
          approvalDate: getPrmLocalIsoDate(),
        },
      );
      if (!checked.ok) {
        showToast?.(checked.error, "warning");
        return { ok: false, reason: checked.reason };
      }
      approval_reference = checked.reference;
    }
    return invoke(
      family ? RPC.approveFamily : RPC.approveProduct,
      family
        ? buildApproveRouteFamilyRouteArgs({
            family_route_id: familyId(),
            approval_reference,
          })
        : buildApproveProductRouteArgs({
            product_route_id: productId(),
            approval_reference,
          }),
      "Unable to approve route.",
    );
  }

  async function supersedeFamily({
    old_family_route_id = null,
    new_family_route_id = null,
  } = {}) {
    if (!canEdit()) return denied();
    const response = await invoke(
      RPC.supersedeFamily,
      buildSupersedeRouteFamilyRouteArgs({
        old_family_route_id: old_family_route_id ?? familyId(),
        new_family_route_id,
      }),
      "Unable to supersede family route.",
    );
    if (response.ok) markValidationStale("family");
    return response;
  }

  async function supersedeProduct({
    old_product_route_id = null,
    new_product_route_id = null,
  } = {}) {
    if (!canEdit()) return denied();
    const response = await invoke(
      RPC.supersedeProduct,
      buildSupersedeProductRouteArgs({
        old_product_route_id: old_product_route_id ?? productId(),
        new_product_route_id,
      }),
      "Unable to supersede Product route.",
    );
    if (response.ok) markValidationStale("product");
    return response;
  }

  async function applyCandidateToDraft(mode, prefill, options = {}) {
    if (mode === "family") {
      return saveFamilyStep({ step: prefill }, options);
    }
    return saveProductOverride({ override: prefill }, options);
  }

  function validationHtml(target, mode = "family") {
    if (!target.validation) {
      return `<div class="cp-prm-validation-strip" data-prm-validation-empty="true"><span class="cp-muted-text">Not validated yet.</span></div>`;
    }
    const issues = extractValidationIssues(target.validation);
    const current = target.validationFresh;
    if (mode !== "family") {
      const badge = current
        ? "Validation current"
        : issues.length
          ? "Validation failed"
          : "Validation requires refresh";
      const body = issues.length
        ? `<ul>${issues
            .map(
              (issue) =>
                `<li>${text(formatPrmValidationLabel(issue.code) || issue.message || issue.code)}</li>`,
            )
            .join("")}</ul>`
        : current
          ? " Route validation passed."
          : ` <span class="cp-muted-text">Previous validation passed before the latest route change.</span>`;
      return `<div class="status cp-prm-validation">
      <span class="cp-prm-badge ${current ? "cp-prm-badge-ok" : "cp-prm-badge-warn"}">${badge}</span>
      ${body}
    </div>`;
    }
    const summary = buildPrmFamilyRouteValidationSummary(
      target.validation,
      target.steps || [],
    );
    const errorsBadge =
      summary.labels.showErrors === false
        ? ""
        : `<span class="cp-prm-badge">${text(summary.labels.errors)}</span>`;
    const badgeTone =
      summary.presentationMode ===
      PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INCOMPLETE
        ? "cp-prm-badge-warn"
        : summary.valid
          ? "cp-prm-badge-ok"
          : "cp-prm-badge-warn";
    return `<div class="cp-prm-validation-strip cp-prm-validation-summary" data-prm-validation-presentation="${text(summary.presentationMode || "")}" data-prm-validation-valid="${summary.valid ? "true" : "false"}">
      <div class="cp-prm-validation-metrics">
        <span class="cp-prm-badge ${badgeTone}">${text(summary.labels.valid)}</span>
        <span class="cp-prm-badge">${text(summary.labels.steps)}</span>
        <span class="cp-prm-badge">${text(summary.labels.rm)}</span>
        <span class="cp-prm-badge">${text(summary.labels.production)}</span>
        <span class="cp-prm-badge">${text(summary.labels.fg)}</span>
        ${errorsBadge}
        <span class="cp-muted-text">${current ? "Validation current" : "Validation stale"}</span>
      </div>
      ${
        issues.length
          ? `<ul class="cp-prm-validation-issues">${issues
              .map(
                (issue) =>
                  `<li>${text(formatPrmValidationLabel(issue.code) || issue.message || issue.code)}</li>`,
              )
              .join("")}</ul>`
          : ""
      }
    </div>`;
  }

  function evidenceGapHtml() {
    const parts = [];
    if (familyState.evidenceGapNotice) {
      const notice = familyState.evidenceGapNotice;
      parts.push(`<div class="cp-prm-evidence-strip" data-prm-evidence-gap="informational">
        <span class="cp-prm-badge cp-prm-badge-info">${text(notice.label)}</span>
        <span class="cp-muted-text">${text(notice.secondary_label)}</span>
        <span class="cp-muted-text">${text(notice.message)}</span>
      </div>`);
    }
    if (familyState.evidenceLoadWarning) {
      parts.push(`<div class="cp-prm-evidence-strip" data-prm-evidence-gap="load-warning">
        <span class="cp-prm-badge cp-prm-badge-warn">Informational</span>
        <span class="cp-muted-text">Does not block this route</span>
        <span class="cp-muted-text">${text(familyState.evidenceLoadWarning)}</span>
      </div>`);
    }
    return parts.join("");
  }

  function yesNo(flag) {
    return flag ? "Yes" : "No";
  }

  function stepIdentity(step) {
    return String(
      step?.family_route_step_id ??
        step?.route_step_id ??
        step?.step_id ??
        step?.id ??
        "",
    );
  }

  function findFamilyStepById(stepId) {
    const want = String(stepId || "");
    if (!want) return null;
    return (
      sortPrmFamilyRouteSteps(familyState.steps, resourceClassStepContext()).find(
        (step) => stepIdentity(step) === want,
      ) || null
    );
  }

  function findProductOverrideById(overrideId) {
    const want = normalizePrmIntegerId(overrideId);
    if (want == null) return null;
    return (
      (productState.overrides || []).find(
        (row) =>
          normalizePrmIntegerId(row.override_id ?? row.id) === want,
      ) || null
    );
  }

  function stepRow(step, options = {}) {
    const interactive = Boolean(options.interactive);
    const normalized =
      sortPrmFamilyRouteSteps([step], resourceClassStepContext())[0] || step;
    const id = stepIdentity(normalized);
    const costCentreLabel =
      [normalized.cost_centre_code, normalized.cost_centre_name]
        .filter((part) => !isBlankPrmValue(part))
        .join(" · ") ||
      normalized.cost_centre_name ||
      "—";
    const stepId = String(id);
    const rowAttrs = interactive
      ? ` class="cp-prm-row cp-prm-step-primary" tabindex="0" data-prm-step-row="${escapeHtml(stepId)}" aria-label="Open step details"`
      : ` class="cp-prm-step-primary"`;
    return `<tr${rowAttrs}>
      <td>${text(normalized.sequence_no)}</td>
      <td>${text(normalized.activity_name)}</td>
      <td>${text(costCentreLabel)}</td>
      <td>${text(normalized.location_label)}</td>
      <td title="${text(normalized.behaviour_code)}">${text(normalized.behaviour_label)}</td>
      <td title="${text(normalized.resource_class_code)}">${text(normalized.resource_class_label)}</td>
      <td title="${text(normalized.direct_labour_scope)}">${text(normalized.direct_labour_scope_label)}</td>
      <td title="${text(normalized.production_overhead_scope)}">${text(normalized.production_overhead_scope_label)}</td>
      <td>${text(normalized.expected_occurrence_count)}</td>
      <td>${text(normalized.standard_cycle_count)}</td>
    </tr>`;
  }

  function buildFamilyStepDetailHtml(
    step,
    {
      allowEdit = false,
      sequenceSuggestion = null,
      stepKeySuggestion = null,
    } = {},
  ) {
    const normalized = step
      ? sortPrmFamilyRouteSteps([step], resourceClassStepContext())[0] || step
      : null;
    if (!normalized && !allowEdit) {
      return `<div class="status">Step details unavailable.</div>`;
    }
    if (allowEdit) {
      const options = getOptions?.() || {};
      const seq =
        sequenceSuggestion ??
        normalized?.sequence_no ??
        nextPrmFamilyStepSequence(familyState.steps);
      const activity =
        (options.activities || []).find(
          (row) =>
            String(row.activity_id ?? row.id) ===
            String(normalized?.activity_id ?? ""),
        ) || {};
      const takenKeys = collectPrmFamilyRouteStepKeys({
        steps: familyState.steps,
        excludeStepId:
          normalized?.family_route_step_id ??
          normalized?.route_step_id ??
          normalized?.step_id ??
          normalized?.id ??
          null,
      });
      const hasActivity = normalizePrmIntegerId(
        normalized?.activity_id ?? activity.activity_id ?? activity.id,
      ) != null;
      return buildFamilyStepFormHtml({
        step: normalized,
        options,
        sequenceSuggestion: seq,
        stepKeySuggestion:
          stepKeySuggestion ||
          normalized?.step_key ||
          (hasActivity
            ? suggestPrmFamilyRouteStepKey(
                activity.activity_id != null ? activity : normalized,
                takenKeys,
              )
            : ""),
      });
    }
    const id = stepIdentity(normalized);
    const costCentreLabel =
      [normalized.cost_centre_code, normalized.cost_centre_name]
        .filter((part) => !isBlankPrmValue(part))
        .join(" · ") ||
      normalized.cost_centre_name ||
      "—";
    return `<div class="cp-prm-step-detail" data-prm-step-detail="${escapeHtml(id)}">
      <div class="cp-prm-step-detail-meta">
        <span class="cp-prm-badge">Seq ${text(normalized.sequence_no)}</span>
        <span class="cp-prm-badge" title="${text(normalized.route_step_scope)}">${text(normalized.route_step_scope_label || "—")}</span>
      </div>
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Step</h3>
        <div class="cp-detail-grid cp-detail-grid--2col">
          <div><div class="cp-field-label">Step key</div><div class="cp-cell-primary">${text(normalized.step_key)}</div></div>
          <div><div class="cp-field-label">Activity</div><div>${text(normalized.activity_name)}</div></div>
          <div><div class="cp-field-label">Cost centre</div><div>${text(costCentreLabel)}</div></div>
          <div><div class="cp-field-label">Location</div><div>${text(normalized.location_label)}</div></div>
        </div>
      </section>
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Classification</h3>
        <div class="cp-detail-grid cp-detail-grid--2col">
          <div><div class="cp-field-label">Behaviour</div><div title="${text(normalized.behaviour_code)}">${text(normalized.behaviour_label)}</div></div>
          <div><div class="cp-field-label">Resource class</div><div title="${text(normalized.resource_class_code)}">${text(normalized.resource_class_label)}</div></div>
          <div><div class="cp-field-label">Route scope</div><div title="${text(normalized.route_step_scope)}">${text(normalized.route_step_scope_label)}</div></div>
          <div><div class="cp-field-label">Direct Labour scope</div><div title="${text(normalized.direct_labour_scope)}">${text(normalized.direct_labour_scope_label)}</div></div>
          <div><div class="cp-field-label">Production Overhead scope</div><div title="${text(normalized.production_overhead_scope)}">${text(normalized.production_overhead_scope_label)}</div></div>
          <div><div class="cp-field-label">Expected occurrence</div><div>${text(normalized.expected_occurrence_count)}</div></div>
          <div><div class="cp-field-label">Standard cycles</div><div>${text(normalized.standard_cycle_count)}</div></div>
          <div><div class="cp-field-label">Mandatory</div><div>${text(yesNo(normalized.is_mandatory))}</div></div>
          <div><div class="cp-field-label">Repeat allowed</div><div>${text(yesNo(normalized.allows_repeat))}</div></div>
          <div><div class="cp-field-label">Skip with approval</div><div>${text(yesNo(normalized.allows_skip_with_approval))}</div></div>
          <div class="cp-detail-span-full"><div class="cp-field-label">Step note</div><div>${text(normalized.step_note, "None")}</div></div>
        </div>
      </section>
    </div>`;
  }

  function buildFamilyRouteOverviewHtml() {
    const header = familyState.detail;
    if (!header) {
      return `<div class="status">Route overview unavailable.</div>`;
    }
    const steps = sortPrmFamilyRouteSteps(
      familyState.steps,
      resourceClassStepContext(),
    );
    const summary = buildPrmFamilyRouteValidationSummary(
      familyState.validation,
      steps,
    );
    const familyLabel =
      header.route_family_name ||
      header.family_name ||
      header.route_family_code ||
      header.family_code ||
      "";
    const status = routeStatus(header);
    const versionCopy = formatPrmRouteVersionCopy(header);
    const effectiveFrom = formatPrmEffectiveFromDisplay(header.effective_from);
    const effectiveTo = formatPrmEffectiveToDisplay(header.effective_to);
    const supersedesCopy = formatPrmSupersedesVersionCopy(
      header,
      familyState.predecessorHistory,
    );
    const overviewErrorsBadge =
      summary.labels.showErrors === false
        ? ""
        : `<span class="cp-prm-badge">${text(summary.labels.errors)}</span>`;
    const overviewBadgeTone =
      summary.presentationMode ===
      PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INCOMPLETE
        ? "cp-prm-badge-warn"
        : summary.valid
          ? "cp-prm-badge-ok"
          : "cp-prm-badge-warn";
    return `<div class="cp-prm-route-overview" data-prm-route-overview-modal>
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Route identity</h3>
        <div class="cp-detail-grid cp-detail-grid--2col">
          <div><div class="cp-field-label">Route Family</div><div>${text(familyLabel)}</div></div>
          <div><div class="cp-field-label">Route code</div><div>${text(header.route_code || header.family_route_code || "—")}</div></div>
          <div><div class="cp-field-label">Route name</div><div class="cp-cell-primary">${text(header.route_name || "Manufacturing Route")}</div></div>
          ${versionCopy ? `<div><div class="cp-field-label">Version</div><div>${text(versionCopy)}</div></div>` : ""}
          <div><div class="cp-field-label">Status</div><div><span class="cp-prm-badge">${text(formatPrmRouteStatusLabel(status))}</span></div></div>
          <div><div class="cp-field-label">Effective from</div><div>${text(effectiveFrom)}</div></div>
          <div><div class="cp-field-label">Effective to</div><div>${text(effectiveTo)}</div></div>
          <div><div class="cp-field-label">Source type</div><div title="${text(header.source_type)}">${text(formatPrmRouteSourceTypeLabel(header.source_type) || header.source_type || "—")}</div></div>
          <div><div class="cp-field-label">Evidence status</div><div title="${text(header.evidence_status)}">${text(formatPrmRouteEvidenceStatusLabel(header.evidence_status) || header.evidence_status || "—")}</div></div>
          ${supersedesCopy ? `<div><div class="cp-field-label">Supersedes</div><div>${text(supersedesCopy)}</div></div>` : ""}
          <div><div class="cp-field-label">Approval reference</div><div>${text(header.approval_reference || "—")}</div></div>
        </div>
      </section>
      <section class="cp-detail-section">
        <h3 class="cp-section-title">Validation</h3>
        <div class="cp-prm-overview-metrics" data-prm-validation-presentation="${text(summary.presentationMode || "")}" data-prm-validation-valid="${summary.valid ? "true" : "false"}">
          <span class="cp-prm-badge ${overviewBadgeTone}">${text(summary.labels.valid)}</span>
          <span class="cp-prm-badge">${text(summary.labels.steps)}</span>
          <span class="cp-prm-badge">${text(summary.labels.rm)}</span>
          <span class="cp-prm-badge">${text(summary.labels.production)}</span>
          <span class="cp-prm-badge">${text(summary.labels.fg)}</span>
          ${overviewErrorsBadge}
        </div>
        ${validationHtml(familyState, "family")}
      </section>
      ${
        familyState.evidenceGapNotice || familyState.evidenceLoadWarning
          ? `<section class="cp-detail-section">
        <h3 class="cp-section-title">Evidence</h3>
        ${evidenceGapHtml()}
      </section>`
          : ""
      }
    </div>`;
  }

  function clearFamilyEditorContext() {
    familyState.detail = null;
    familyState.steps = [];
    familyState.validation = null;
    familyState.validationFresh = false;
    familyState.evidencePreview = null;
    familyState.evidenceGapNotice = null;
    familyState.evidenceLoadWarning = null;
    familyState.predecessorHistory = [];
    familyState.error = null;
    familyState.loading = false;
  }

  function clearProductEditorContext() {
    productState.detail = null;
    productState.familySkeleton = [];
    productState.overrides = [];
    productState.effective = [];
    productState.validation = null;
    productState.validationFresh = false;
    productState.error = null;
    productState.loading = false;
  }

  function productCreateHtml(options = {}) {
    const ctx = options.createContext && typeof options.createContext === "object"
      ? options.createContext
      : {};
    const refs = Array.isArray(options.batchSizeReferences)
      ? options.batchSizeReferences
      : [];
    const selectedId = normalizePrmIntegerId(options.selectedBatchSizeRefId);
    const asOfLabel =
      formatPrmDayMonthYearLabel(ctx.as_of_date) || ctx.as_of_date || "—";
    const versionCopy = ctx.family_route_version || "";
    const baseRouteName =
      ctx.family_route_name ||
      (ctx.base_route_family_route_id != null
        ? `Family route ${ctx.base_route_family_route_id}`
        : "—");
    const canCreate = options.canCreateDraft === true && refs.length > 0;
    const pbs = options.pbsHandoff && typeof options.pbsHandoff === "object"
      ? options.pbsHandoff
      : {};
    const requireChoice = refs.length > 1;
    const optionsHtml = [
      requireChoice
        ? `<option value="">Select batch-size reference</option>`
        : "",
      ...refs.map((ref) => {
        const id = normalizePrmIntegerId(ref.batch_size_ref_id);
        if (id == null) return "";
        const selected =
          selectedId != null && id === selectedId ? " selected" : "";
        return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(
          formatPrmBatchSizeReferenceLabel(ref),
        )}</option>`;
      }),
    ]
      .filter(Boolean)
      .join("");
    const metaCell = (label, valueHtml, field) =>
      `<div class="cp-prm-product-summary-meta-cell" data-prm-create-field="${escapeHtml(field)}"><div class="cp-field-label">${text(label)}</div><div class="cp-prm-product-summary-meta-value">${valueHtml}</div></div>`;
    return `<div class="cp-prm-editor" data-prm-editor="product" data-prm-product-editor-create="true">
      <div class="cp-prm-product-editor-create">
        <p class="cp-cell-primary">Create Product route DRAFT</p>
        <p class="cp-muted-text">No Product Route is created until you press Create DRAFT.</p>
        <div class="cp-prm-product-summary-meta" data-prm-product-create-snapshot>
          ${metaCell("Product", `<span class="cp-cell-primary">${text(ctx.product_name)}</span>`, "product")}
          ${metaCell("Route Family", text(ctx.route_family_name || ctx.route_family_id), "route-family")}
          ${metaCell(
            "Base Family Route",
            `${text(baseRouteName)}${versionCopy ? ` · ${text(versionCopy)}` : ""}`,
            "family-route",
          )}
          ${metaCell("As of", text(asOfLabel), "as-of")}
        </div>
        <label class="cp-prm-form-field cp-prm-form-field--full" for="prmProductCreateBatchRef">
          <span class="cp-field-label">Batch Size Reference</span>
          <select id="prmProductCreateBatchRef" name="prmProductCreateBatchRef" data-prm-create-batch-ref ${
            refs.length ? "" : "disabled"
          }>${optionsHtml || `<option value="">No governed reference</option>`}</select>
        </label>
        ${
          refs.length
            ? ""
            : `<p class="cp-prm-form-notice" data-prm-create-batch-required>${text(
                PRM_PRODUCT_ROUTE_CREATE_BATCH_REQUIRED,
              )}</p>`
        }
        <div class="cp-prm-actions">
          <button type="button" class="icon-btn icon-btn-primary" data-prm-action="create-product-draft" ${
            canCreate ? "" : "disabled"
          }>${text(formatPrmActionLabel("create-product-draft"))}</button>
          ${
            pbs.href
              ? `<button type="button" class="icon-btn" data-prm-action="preferred-batch-size" data-prm-handoff-href="${escapeHtml(
                  pbs.href,
                )}">${text(pbs.label || formatPrmActionLabel("preferred-batch-size"))}</button>`
              : ""
          }
        </div>
      </div>
    </div>`;
  }

  function familyHtml(options = {}) {
    if (familyState.loading) return `<div class="cost-sheet-explain-loading">Loading family route…</div>`;
    const header = familyState.detail;
    if (!header) {
      const primary =
        options.emptyMessage ||
        "Select an existing Family Route or create a new Draft.";
      const supporting =
        options.emptySupporting ||
        "Choose a governed Route Family, open an existing route, or create a new Draft.";
      const canCreate = options.canCreateFamilyRoute === true;
      const selectorHtml =
        options.familySelectorOptionsHtml != null
          ? `<label class="cp-prm-form-field cp-prm-form-field--full" for="prmFamilyEditorFamilySelect">
              <span class="cp-field-label">Route Family</span>
              <select id="prmFamilyEditorFamilySelect" class="cp-period-select" data-prm-searchable-select data-prm-family-empty-select>
                ${options.familySelectorOptionsHtml}
              </select>
            </label>`
          : "";
      const createBtn = canCreate
        ? `<button type="button" class="icon-btn icon-btn-primary" data-prm-create-family-route-draft>Create Family Route Draft</button>`
        : "";
      const openExistingBtn = `<button type="button" class="icon-btn hidden" data-prm-open-existing-family-route>Open existing route</button>`;
      const openApprovedBtn = `<button type="button" class="icon-btn icon-btn-primary hidden" data-prm-open-approved-family-route>Open current approved route</button>`;
      const successorBtn = `<button type="button" class="icon-btn hidden" data-prm-create-family-route-successor>Create new route version</button>`;
      return `<div class="cp-prm-editor" data-prm-editor="family" data-prm-family-editor-empty="true">
        <div class="cp-prm-family-editor-empty">
          <p class="cp-cell-primary">${text(primary)}</p>
          <p class="cp-muted-text">${text(supporting)}</p>
          ${selectorHtml}
          <div class="cp-prm-family-create-context" data-prm-family-empty-context>${text(
            options.familyCreateContextHtml || "",
            "",
          )}</div>
          <div class="cp-prm-actions cp-prm-family-empty-actions">
            ${openApprovedBtn}
            ${openExistingBtn}
            ${createBtn}
            ${successorBtn}
          </div>
        </div>
      </div>`;
    }
    const readOnly = isPrmRouteReadOnlyStatus(routeStatus(header));
    const steps = sortPrmFamilyRouteSteps(
      familyState.steps,
      resourceClassStepContext(),
    );
    const status = normalizePrmCode(routeStatus(header)).toUpperCase();
    const statusCanonical = canonicalPrmRouteStatus(status) || status;
    const lifecycle = resolvePrmFamilyRouteLifecycleActions({
      status,
      canEdit: canEdit(),
      validation: familyState.validation,
      validationFresh: familyState.validationFresh,
    });
    const canMutateSteps = lifecycle.canMutateSteps;
    const canSubmit = lifecycle.submitVisible;
    const canReviewApprove = lifecycle.approveVisible;
    const canClone = lifecycle.canClone;
    const summary = buildPrmFamilyRouteValidationSummary(
      familyState.validation,
      steps,
    );
    const routeTitle = header.route_name || "Manufacturing Route";
    const presentation = familyState.validation
      ? classifyPrmFamilyRouteValidationPresentation(
          familyState.validation,
          steps,
        )
      : null;
    const attentionCue = !familyState.validation
      ? `<button type="button" class="cp-prm-editor-cue" data-prm-route-overview>Not validated yet — open route details</button>`
      : presentation?.mode === PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INCOMPLETE
        ? `<button type="button" class="cp-prm-editor-cue" data-prm-route-overview>Route incomplete — add required route steps</button>`
        : presentation?.mode === PRM_FAMILY_ROUTE_VALIDATION_PRESENTATION.INVALID
          ? `<button type="button" class="cp-prm-editor-cue cp-prm-editor-cue--warn" data-prm-route-overview>Route invalid — open route details</button>`
          : !familyState.validationFresh
            ? `<button type="button" class="cp-prm-editor-cue" data-prm-route-overview>Validation stale — open route details</button>`
            : "";
    const versionCopy = formatPrmRouteVersionCopy(header);
    return `<div class="cp-prm-editor" data-prm-editor="family">
      <div class="cp-prm-editor-toolbar">
        <div class="cp-prm-editor-toolbar-primary" data-prm-route-header-primary>
          <div class="cp-prm-editor-toolbar-left">
            <div class="cp-prm-editor-title-block">
              <button type="button" class="cp-prm-title-action" data-prm-route-overview title="Open route details" aria-label="${escapeHtml(`${routeTitle} — open route details`)}">
                <span class="cp-cell-primary">${text(routeTitle)}</span>
                <span class="cp-prm-title-chevron" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </span>
              </button>
              <span class="cp-prm-badge" data-prm-route-status="${escapeHtml(statusCanonical)}">${text(formatPrmRouteStatusLabel(statusCanonical))}</span>
              ${versionCopy ? `<span class="cp-muted-text" data-prm-route-version>${text(versionCopy)}</span>` : ""}
            </div>
          </div>
          <div class="cp-prm-editor-toolbar-right">
            <div class="cp-prm-actions cp-prm-editor-lifecycle">
              <button type="button" class="icon-btn" data-prm-action="family-history">History</button>
              ${
                lifecycle.validateVisible
                  ? `<button type="button" class="icon-btn" data-prm-action="validate-family"${lifecycle.validateEnabled ? "" : " disabled"} title="${lifecycle.validateEnabled ? "Validate this Family Route" : "Validation has already passed for the current route definition."}">${text(lifecycle.validateLabel)}</button>`
                  : ""
              }
              ${canMutateSteps ? `<button type="button" class="icon-btn" data-prm-action="add-family-step-before" ${options.costCentreBlocked ? "disabled" : ""}>Add step before</button>` : ""}
              ${canMutateSteps ? `<button type="button" class="icon-btn" data-prm-action="add-family-step-after" ${options.costCentreBlocked ? "disabled" : ""}>Add step after</button>` : ""}
              ${canSubmit ? `<button type="button" class="icon-btn icon-btn-primary" data-prm-action="submit-family" ${lifecycle.submitEnabled ? "" : "disabled"}>Submit for review</button>` : ""}
              ${canReviewApprove ? `<button type="button" class="icon-btn icon-btn-primary" data-prm-action="approve-family" ${options.costCentreBlocked ? "disabled" : ""}>Approve…</button>` : ""}
              ${canClone ? `<button type="button" class="icon-btn icon-btn-primary" data-prm-action="clone-family-route">Clone as New Version</button>` : ""}
            </div>
          </div>
        </div>
      </div>
      ${readOnly ? `<div class="status cp-prm-readonly">Approved, superseded, and inactive versions are read-only. Use Clone as New Version to revise.</div>` : ""}
      ${attentionCue}
      <div class="cp-prm-step-table-wrap"><table class="cp-prm-step-table" data-prm-family-step-table>
        <thead><tr><th>Seq</th><th>Activity</th><th>Cost Centre</th><th>Location</th><th>Behaviour</th><th>Resource</th><th>DL</th><th>POH</th><th>Occ</th><th>Cycles</th></tr></thead>
        <tbody>${steps.map((step) => stepRow(step, { interactive: true })).join("") || `<tr><td colspan="10"><div class="status">No steps.</div></td></tr>`}</tbody>
      </table></div>
    </div>`;
  }

  function deltaRow(delta) {
    const normalized = normalizePrmProductRouteOverride(delta);
    const id = normalized.override_id ?? "";
    const operation = normalized.operation_type;
    const writable = editable(productState.detail);
    const actions = writable
      ? `<button type="button" class="icon-btn" data-prm-delta-edit="${escapeHtml(id)}">Edit</button> <button type="button" class="icon-btn" data-prm-delta-delete="${escapeHtml(id)}">Remove</button>`
      : "—";
    return `<tr>
      <td>${text(formatPrmDeltaLabel(operation) || operation)}</td>
      <td>${text(formatPrmDeltaTargetCopy(normalized, productState.familySkeleton))}</td>
      <td>${text(normalized.override_reason)}</td>
      <td>${actions}</td>
    </tr>`;
  }

  function productHtml(options = {}) {
    if (productState.loading) return `<div class="cost-sheet-explain-loading">Loading Product route…</div>`;
    if (options.createMode === true && !productState.detail) {
      return productCreateHtml(options);
    }
    const header = productState.detail;
    if (!header) {
      const empty =
        options.emptyMessage ||
        "No Product Route selected.\n\nOpen a Product from Route Readiness / Product Summary to create or edit a Product-specific route.";
      return `<div class="status cp-prm-empty-state">${text(empty).replace(/\n/g, "<br>")}</div>`;
    }
    const lifecycle = resolvePrmProductRouteLifecycleActions({
      status: routeStatus(header),
      canEdit: canEdit(),
      validation: productState.validation,
      validationFresh: productState.validationFresh,
    });
    return `<div class="cp-prm-editor" data-prm-editor="product">
      <header class="cp-prm-editor-header">
        <div class="cp-cell-primary">${text(header.product_name)}</div>
        <div class="cp-muted-text">Manufacturing Route Family ${text(header.route_family_name || header.route_family_id)}</div>
        <div>${text(header.version_label || header.version)} · <span class="cp-prm-badge">${text(formatPrmRouteStatusLabel(routeStatus(header)))}</span></div>
        ${header.approval_reference ? `<div><span class="cp-field-label">Approval reference</span> ${text(header.approval_reference)}</div>` : ""}
      </header>
      ${isPrmRouteReadOnlyStatus(routeStatus(header)) ? `<div class="status cp-prm-readonly">This Product route version is read-only.</div>` : ""}
      ${validationHtml(productState, "product")}
      <div class="cp-prm-actions">
        ${
          lifecycle.validateVisible
            ? `<button type="button" class="icon-btn" data-prm-action="validate-product"${lifecycle.validateEnabled ? "" : " disabled"}>${text(lifecycle.validateLabel)}</button>`
            : ""
        }
        ${
          lifecycle.submitVisible
            ? `<button type="button" class="icon-btn icon-btn-primary" data-prm-action="submit-product"${lifecycle.submitEnabled ? "" : " disabled"}>Submit for review</button>`
            : ""
        }
        ${
          lifecycle.approveVisible
            ? `<button type="button" class="icon-btn icon-btn-primary" data-prm-action="approve-product" ${options.costCentreBlocked ? "disabled" : ""}>Approve…</button>`
            : ""
        }
        <button type="button" class="icon-btn" data-prm-action="supersede-product">Supersede</button>
        ${lifecycle.canAddDelta ? `<button type="button" class="icon-btn" data-prm-action="add-product-delta">Add delta</button>` : ""}
      </div>
      <section class="cp-detail-section"><h3 class="cp-section-title">A. Inherited family route</h3>
        <table class="cp-prm-step-table"><thead><tr><th>Seq</th><th>Step</th><th>Activity</th><th>Cost centre</th><th>Location</th><th>Scope</th></tr></thead>
        <tbody>${productState.familySkeleton.map((step) => stepRow(step)).join("") || `<tr><td colspan="6"><div class="status">No inherited steps.</div></td></tr>`}</tbody></table>
      </section>
      <section class="cp-detail-section"><h3 class="cp-section-title">B. Product deltas</h3>
        <p class="cp-muted-text">Only explicit Product differences are stored.</p>
        <table class="cp-prm-step-table"><thead><tr><th>Operation</th><th>Target / Step</th><th>Reason</th><th>Actions</th></tr></thead>
        <tbody>${productState.overrides.map(deltaRow).join("") || `<tr><td colspan="4"><div class="status">No Product deltas.</div></td></tr>`}</tbody></table>
      </section>
      <section class="cp-detail-section"><h3 class="cp-section-title">C. Resolved effective route</h3>
        <table class="cp-prm-step-table"><thead><tr><th>Seq</th><th>Step</th><th>Activity</th><th>Cost centre</th><th>Location</th><th>Scope</th></tr></thead>
        <tbody>${productState.effective.map((step) => stepRow(step)).join("") || `<tr><td colspan="6"><div class="status">Effective route unavailable.</div></td></tr>`}</tbody></table>
      </section>
    </div>`;
  }

  function renderEditor(host, mode, options = {}) {
    const html = mode === "family" ? familyHtml(options) : productHtml(options);
    if (host) host.innerHTML = html;
    return html;
  }

  return {
    getFamilyState: () => familyState,
    getProductState: () => productState,
    clearFamilyEditorContext,
    clearProductEditorContext,
    loadFamilyDetail,
    bumpFamilyRouteDetailGeneration,
    readyFamilyDetailForPaint() {
      familyState.loading = false;
    },
    loadProductDetail,
    createFamilyDraft,
    cloneFamilyDraft,
    createProductDraft,
    saveFamilyStep,
    deleteFamilyStep,
    applyFamilyStepOrder,
    updateProductDraft,
    saveProductOverride,
    deleteProductOverride,
    validateFamily: () => validate("family"),
    validateProduct: () => validate("product"),
    submitFamily: () => submit("family"),
    submitProduct: () => submit("product"),
    approveFamily: (reference, options) => approve("family", reference, options),
    approveProduct: (reference, options) => approve("product", reference, options),
    supersedeFamily,
    supersedeProduct,
    applyCandidateToDraft,
    markFamilyValidationStale: () => markValidationStale("family"),
    markProductValidationStale: () => markValidationStale("product"),
    clearFamilyStepExpansion() {},
    findFamilyStepById,
    findProductOverrideById,
    buildProductDeltaFormHtml: (delta, extras = {}) =>
      buildProductDeltaFormHtml({
        delta,
        options: getOptions?.() || {},
        familySteps: productState.familySkeleton || [],
        ...extras,
      }),
    bindProductDeltaForm: (host, delta = null) =>
      bindProductDeltaForm(
        host,
        getOptions?.() || {},
        productState.familySkeleton || [],
        "prmProductDelta",
        {
          existingOverrides: productState.overrides || [],
          effectiveSteps: productState.effective || [],
          excludeOverrideId:
            delta != null
              ? normalizePrmIntegerId(delta.override_id ?? delta.id)
              : null,
          seed: delta ? normalizePrmProductRouteOverride(delta) : null,
        },
      ),
    readProductDeltaFormValues,
    validateProductDeltaForm: (values, host = null, excludeOverrideId = null) =>
      validatePrmProductDeltaForm(values, {
        familySteps: productState.familySkeleton || [],
        options: getOptions?.() || {},
        existingOverrides: productState.overrides || [],
        effectiveSteps: productState.effective || [],
        excludeOverrideId,
        compatibilityAcknowledged:
          host?._prmDeltaFormContext?.compatibilityAcknowledged?.() ?? false,
      }),
    buildFamilyStepDetailHtml,
    buildFamilyRouteOverviewHtml,
    bindFamilyStepFormCascade: (host, context = {}) => {
      const normalized = context.seed
        ? normalizePrmFamilyRouteStep(context.seed, resourceClassStepContext())
        : null;
      return bindFamilyStepFormCascade(host, getOptions?.() || {}, "prmFamilyStep", {
        existingSteps: familyState.steps,
        excludeStepId:
          context.excludeStepId ??
          normalized?.family_route_step_id ??
          normalized?.route_step_id ??
          normalized?.step_id ??
          normalized?.id ??
          null,
        seed: normalized,
      });
    },
    readFamilyStepFormValues,
    validateFamilyStepForm: (values, context = {}) =>
      validatePrmFamilyStepForm(values, {
        options: getOptions?.() || {},
        existingSteps: familyState.steps,
        excludeStepId: context.excludeStepId ?? null,
        isPersistedStep: Boolean(context.isPersistedStep),
      }),
    nextFamilyStepSequence: (after) =>
      nextPrmFamilyStepSequence(familyState.steps, after),
    previousFamilyStepSequence: (before) =>
      previousPrmFamilyStepSequence(familyState.steps, before),
    suggestFamilyStepKey: (activity, takenKeys) =>
      suggestPrmFamilyRouteStepKey(activity, takenKeys),
    findDuplicateFamilyStepSequences: () =>
      findDuplicatePrmFamilyStepSequences(familyState.steps),
    findDuplicateFamilyStepKey: (key, excludeId) =>
      findDuplicatePrmFamilyStepKeys(familyState.steps, key, excludeId),
    renderEditor,
    isEditable: editable,
    RPC,
  };
}
