/**
 * Production Route Manager — historical candidate previews.
 * Previewing creates nothing; applying evidence always requires confirmation.
 */

import {
  formatPrmCommercialHierarchyLabel,
  formatPrmDeltaLabel,
  formatPrmRpcError,
  isBlankPrmValue,
  normalizePrmIntegerId,
  pickSupportedCandidatePrefill,
  unresolvedGovernanceLabel,
} from "./costing-suite-production-route-helpers.js";
import {
  buildCreateRouteFamilyArgs,
  buildDeltaCandidateRpcArgs,
  buildProductCandidateRpcArgs,
  buildRouteFamilyCandidateRpcArgs,
  extractCreatedRouteFamilyId,
  normalizeDeltaCandidate,
  normalizeProductCandidate,
  normalizeRouteFamilyCandidate,
  partitionDeltaCandidatesBySuggestion,
} from "./costing-suite-production-route-rpc.js";

const RPC = Object.freeze({
  familyCandidate: "rpc_preview_route_family_candidate",
  productCandidate: "rpc_preview_product_process_route_candidate",
  deltaCandidate: "rpc_preview_product_route_delta_candidate",
  createFamily: "rpc_create_route_family",
});

export const PRM_PRODUCT_GROUP_FIXTURE_IDS = Object.freeze([28, 30, 29, 83]);

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

function hierarchyLabel(row = {}) {
  return (
    formatPrmCommercialHierarchyLabel(row) ||
    [
      row.category_name,
      row.division_name,
      row.segment_name,
      row.product_group_name || row.name,
    ]
      .filter(Boolean)
      .join(" / ") ||
    `Product Group ${row.product_group_id ?? row.id ?? ""}`.trim()
  );
}

export function createProductionRouteCandidatesController(deps = {}) {
  const {
    costingRpc,
    showToast,
    canEdit = () => false,
    confirmCandidateUse = null,
    applyCandidateToDraft = null,
  } = deps;

  let state = {
    kind: "family",
    familyMode: "A",
    normalized: null,
    loading: false,
    error: null,
    selectionGuard: null,
    lastParams: null,
    context: {
      route_family_id: null,
      product_group_ids: [],
      product_id: null,
      family_route_id: null,
      product_route_id: null,
    },
    stagedEvidence: [],
  };

  function setSelectionGuard(message) {
    state.selectionGuard = message || null;
    state.error = null;
    state.normalized = null;
    state.loading = false;
  }

  async function invoke(name, built, fallback) {
    if (!built?.ok) {
      const message = built?.errors?.join("; ") || fallback;
      setSelectionGuard(message);
      return { ok: false, errors: built?.errors || [message] };
    }
    state.loading = true;
    state.error = null;
    state.selectionGuard = null;
    state.lastParams = built.params;
    try {
      const { data, error } = await costingRpc(name, built.params);
      if (error) throw error;
      return { ok: true, data };
    } catch (error) {
      state.error = formatPrmRpcError(name, built.params, error);
      showToast?.(error?.message || fallback, "error");
      return { ok: false, error };
    } finally {
      state.loading = false;
    }
  }

  async function previewFamilyCandidate(args = {}) {
    const routeFamilyId =
      args.route_family_id ?? args.p_route_family_id ?? null;
    const selectedIds = (
      args.product_group_ids ??
      args.p_product_group_ids ??
      []
    )
      .map(normalizePrmIntegerId)
      .filter((id) => id != null);
    const familyMode = routeFamilyId != null ? "A" : "B";

    if (familyMode === "A" && selectedIds.length) {
      setSelectionGuard(
        "Choose either one approved Manufacturing Route Family or Product Groups, not both.",
      );
      return { ok: false, reason: "mixed_scope" };
    }
    if (familyMode === "A" && !normalizePrmIntegerId(routeFamilyId)) {
      setSelectionGuard("Select an approved Manufacturing Route Family.");
      return { ok: false, reason: "missing_route_family_id" };
    }
    if (familyMode === "B" && !selectedIds.length) {
      setSelectionGuard("Select one or more Product Groups.");
      return { ok: false, reason: "missing_product_group_ids" };
    }

    state.kind = "family";
    state.familyMode = familyMode;
    state.context.route_family_id =
      familyMode === "A" ? normalizePrmIntegerId(routeFamilyId) : null;
    state.context.product_group_ids = familyMode === "B" ? selectedIds : [];
    const response = await invoke(
      RPC.familyCandidate,
      buildRouteFamilyCandidateRpcArgs({
        route_family_id:
          familyMode === "A" ? state.context.route_family_id : null,
        product_group_ids: familyMode === "B" ? selectedIds : null,
        as_of_date: args.as_of_date ?? args.p_as_of_date,
        lookback_months: args.lookback_months ?? args.p_lookback_months,
      }),
      "Unable to preview family evidence.",
    );
    if (response.ok) {
      state.normalized = normalizeRouteFamilyCandidate(response.data);
      state.normalized.approvable = false;
    }
    return response.ok
      ? { ...response, data: state.normalized }
      : response;
  }

  async function previewProductCandidate(args = {}) {
    const productId = normalizePrmIntegerId(
      args.product_id ?? args.p_product_id,
    );
    if (!productId) {
      setSelectionGuard("Select a Product.");
      return { ok: false, reason: "missing_product_id" };
    }
    state.kind = "product";
    state.context.product_id = productId;
    const response = await invoke(
      RPC.productCandidate,
      buildProductCandidateRpcArgs({
        product_id: productId,
        as_of_date: args.as_of_date ?? args.p_as_of_date,
        lookback_months: args.lookback_months ?? args.p_lookback_months,
      }),
      "Unable to preview Product evidence.",
    );
    if (response.ok) state.normalized = normalizeProductCandidate(response.data);
    return response.ok
      ? { ...response, data: state.normalized }
      : response;
  }

  async function previewDeltaCandidate(args = {}) {
    const productId = normalizePrmIntegerId(
      args.product_id ?? args.p_product_id,
    );
    if (!productId) {
      setSelectionGuard("Select a Product.");
      return { ok: false, reason: "missing_product_id" };
    }
    state.kind = "delta";
    state.context.product_id = productId;
    const response = await invoke(
      RPC.deltaCandidate,
      buildDeltaCandidateRpcArgs({
        product_id: productId,
        as_of_date: args.as_of_date ?? args.p_as_of_date,
        lookback_months: args.lookback_months ?? args.p_lookback_months,
      }),
      "Unable to preview Product differences.",
    );
    if (response.ok) {
      state.normalized = normalizeDeltaCandidate(response.data);
      state.normalized.partitioned =
        state.normalized.partitioned ||
        partitionDeltaCandidatesBySuggestion(
          state.normalized.delta_candidates || [],
        );
    }
    return response.ok
      ? { ...response, data: state.normalized }
      : response;
  }

  async function createRouteFamily(input = {}) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return { ok: false, reason: "permission" };
    }
    const built = buildCreateRouteFamilyArgs(input);
    if (!built.ok) {
      showToast?.(built.errors.join("; "), "warning");
      return { ok: false, errors: built.errors };
    }
    const { data, error } = await costingRpc(RPC.createFamily, built.params);
    if (error) {
      showToast?.(error.message || "Unable to create Manufacturing Route Family.", "error");
      return { ok: false, error };
    }
    return {
      ok: true,
      data,
      route_family_id: extractCreatedRouteFamilyId(data),
    };
  }

  function stageEvidence(candidateStep = {}, association = {}) {
    const prefill = pickSupportedCandidatePrefill(candidateStep);
    const staged = {
      prefill,
      route_family_id:
        association.route_family_id ?? state.context.route_family_id ?? null,
      product_id: association.product_id ?? state.context.product_id ?? null,
      staged_at: new Date().toISOString(),
    };
    state.stagedEvidence.push(staged);
    showToast?.(
      "Evidence staged for later review; no draft was changed.",
      "info",
      7200,
    );
    return staged;
  }

  async function requestUseInDraft(candidateStep = {}, association = {}) {
    if (!canEdit()) {
      showToast?.("Edit permission required.", "warning");
      return { ok: false, reason: "permission" };
    }
    const prefill = pickSupportedCandidatePrefill(candidateStep);
    const mode = state.kind === "family" ? "family" : "product";
    const hasWritableDraft =
      mode === "family"
        ? Boolean(association.family_route_id ?? state.context.family_route_id)
        : Boolean(
            association.product_route_id ?? state.context.product_route_id,
          );
    if (!hasWritableDraft || typeof applyCandidateToDraft !== "function") {
      return {
        ok: true,
        staged: true,
        evidence: stageEvidence(candidateStep, association),
      };
    }

    const review = {
      title: "Review candidate evidence",
      message:
        "Confirm to add this evidence to the open writable draft. Previewing alone changes nothing.",
      mode,
      prefill,
      candidateStep,
    };
    const confirmed =
      typeof confirmCandidateUse === "function"
        ? await confirmCandidateUse(review)
        : window.confirm(review.message);
    if (!confirmed) {
      return {
        ok: true,
        staged: true,
        evidence: stageEvidence(candidateStep, association),
      };
    }
    return applyCandidateToDraft(mode, prefill, association);
  }

  function unresolvedHtml(prefill) {
    const fields = Object.keys(prefill || {}).filter((key) =>
      key.startsWith("__unresolved_"),
    );
    return fields
      .map(
        (key) =>
          `<span class="cp-prm-badge cp-prm-badge-warn">${text(key.replace("__unresolved_", ""))}: ${text(unresolvedGovernanceLabel(null))}</span>`,
      )
      .join(" ");
  }

  function candidateCard(step, index, deltaOperation = null) {
    const prefill = pickSupportedCandidatePrefill(step);
    const operation =
      deltaOperation || step.delta_suggestion || step.delta_operation;
    return `<article class="cp-prm-card">
      <div class="cp-cell-primary">${text(operation ? formatPrmDeltaLabel(operation) : step.step_key || step.activity || `Step ${index + 1}`)}</div>
      <div class="cp-muted-text">${text(step.activity || step.activity_name || step.step_key)}</div>
      <div class="cp-prm-unresolved">${unresolvedHtml(prefill)}</div>
      <button type="button" class="icon-btn" data-prm-use-candidate="${index}">Use in draft</button>
    </article>`;
  }

  function familyHtml(payload) {
    const steps = payload.family_steps || payload.candidate_steps || [];
    const selected = payload.selected_product_groups || [];
    const counts = payload.counts || {};
    return `<div class="cp-prm-candidate" data-prm-candidate="family">
      <div class="status">Preview only — approvable: false; no records were created.</div>
      <div class="cp-detail-grid">
        <div><div class="cp-field-label">Scope mode</div><div>${text(payload.scope_mode || state.familyMode)}</div></div>
        <div><div class="cp-field-label">Selected Product Groups</div><div>${selected.map((row) => text(hierarchyLabel(row))).join("<br>") || text(state.context.product_group_ids.join(", "))}</div></div>
        <div><div class="cp-field-label">Counts</div><div>${text(typeof counts === "object" ? JSON.stringify(counts) : counts)}</div></div>
      </div>
      <h3 class="cp-section-title">Candidate steps</h3>
      <div class="cp-prm-cards">${steps.map((step, index) => candidateCard(step, index)).join("") || `<div class="status">No candidate steps.</div>`}</div>
      ${state.familyMode === "B" && canEdit() ? `<button type="button" class="icon-btn" data-prm-create-family>Create Manufacturing Route Family</button><p class="cp-muted-text">Creation does not map any Product Group.</p>` : ""}
    </div>`;
  }

  function productHtml(payload) {
    const steps = payload.candidate_steps || [];
    return `<div class="cp-prm-candidate" data-prm-candidate="product">
      <div class="status">Preview only — no draft was changed.</div>
      <div class="cp-muted-text">${text(payload.product?.product_name || payload.product_name || state.context.product_id)}</div>
      <div class="cp-prm-cards">${steps.map((step, index) => candidateCard(step, index)).join("") || `<div class="status">No candidate steps.</div>`}</div>
    </div>`;
  }

  function deltaHtml(payload) {
    const partitioned =
      payload.partitioned ||
      partitionDeltaCandidatesBySuggestion(payload.delta_candidates || []);
    const rows = Object.entries(partitioned).flatMap(([operation, items]) =>
      (items || []).map((item) => ({ ...item, __operation: operation })),
    );
    return `<div class="cp-prm-candidate" data-prm-candidate="delta">
      <div class="status">Preview only — no Product route was changed.</div>
      <h3 class="cp-section-title">Product difference proposals</h3>
      <div class="cp-prm-cards">${rows.map((row, index) => candidateCard(row, index, row.__operation)).join("") || `<div class="status">No differences.</div>`}</div>
    </div>`;
  }

  function render() {
    if (state.loading) {
      return `<div class="cost-sheet-explain-loading">Loading historical evidence…</div>`;
    }
    if (state.selectionGuard) {
      return `<div class="status" data-prm-notice="selection">${text(state.selectionGuard)}</div>`;
    }
    if (state.error) {
      return `<div class="status" data-prm-notice="error">${text(state.error)}</div>`;
    }
    if (!state.normalized) {
      return `<div class="status">Choose a scope, then explicitly preview historical evidence.</div>`;
    }
    if (state.kind === "product") return productHtml(state.normalized);
    if (state.kind === "delta") return deltaHtml(state.normalized);
    return familyHtml(state.normalized);
  }

  function getCandidateSteps() {
    if (!state.normalized) return [];
    if (state.kind === "family") {
      return (
        state.normalized.family_steps ||
        state.normalized.candidate_steps ||
        []
      );
    }
    if (state.kind === "product") {
      return state.normalized.candidate_steps || [];
    }
    const partitioned = state.normalized.partitioned || {};
    return Object.values(partitioned).flatMap((rows) => rows || []);
  }

  function setDraftContext(context = {}) {
    state.context = { ...state.context, ...context };
  }

  return {
    getState: () => state,
    setDraftContext,
    setSelectionGuard,
    previewFamilyCandidate,
    previewProductCandidate,
    previewDeltaCandidate,
    createRouteFamily,
    requestUseInDraft,
    stageEvidence,
    getCandidateSteps,
    getProductGroupLabel: hierarchyLabel,
    render,
    PRODUCT_GROUP_FIXTURE_IDS: PRM_PRODUCT_GROUP_FIXTURE_IDS,
  };
}
