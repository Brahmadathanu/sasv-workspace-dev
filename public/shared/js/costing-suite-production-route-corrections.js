/**
 * WP05-P02 - Production Route Manager corrections (pure logic, no data access, no DOM).
 * Used only when COSTING_PRM_CORRECTIONS_V1 is ON; flag OFF keeps the legacy code paths untouched.
 *
 * Supersession eligibility mirrors the LIVE server contract of public.rpc_supersede_product_route
 * (migration 20260812173816): the old and the new route must both be non-archived, status APPROVED, and belong to
 * the same Product. Nothing else is decided here: the server stays authoritative, computes the old route's ending
 * date itself, and its errors are shown unmodified. The client never invents an id, a date or a rule.
 */
import {
  canonicalPrmRouteStatus,
  formatPrmExactRunContextCue,
  normalizePrmIntegerId,
  PRM_EXACT_RUN_CONTEXT,
  PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT,
  PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT,
  PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
  resolvePrmProductHistoryRouteId,
} from "./costing-suite-production-route-helpers.js";

// Feature flag (default OFF; only the string "1" in this browser's localStorage turns it on). Defined here, not in
// costing-feature-flags.js, so that shared flag file (guarded byte-for-byte by other packages' tests) stays untouched.
export const COSTING_PRM_CORRECTIONS_V1 = "COSTING_PRM_CORRECTIONS_V1";

export function isCostingPrmCorrectionsV1Enabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(COSTING_PRM_CORRECTIONS_V1) === "1";
  } catch {
    return false;
  }
}

export const SUPERSEDE_NO_REPLACEMENT_NOTE =
  "Supersede is unavailable: this Product has no other approved route version to replace this one.";
export const SUPERSEDE_HISTORY_ERROR_NOTE =
  "Supersede is unavailable: the Product's route history could not be loaded, so valid replacement routes cannot be determined.";
export const SUPERSEDE_NOT_APPROVED_NOTE = "";
export const SUPERSEDE_CHECKING_NOTE = "Checking approved route versions for this Product…";

export const FIXED_HISTORICAL_CONTEXT_NOTE =
  "Fixed historical context - not the current costing run. It cannot be changed here.";

const isApproved = (status) => canonicalPrmRouteStatus(status) === "APPROVED";

/** Route status as the editor reads it (header.status / route_status / approval_status). */
export function prmRouteHeaderStatus(header = {}) {
  return header?.status ?? header?.route_status ?? header?.approval_status ?? "";
}

/**
 * Replacement candidates for the route being superseded: other versions of the SAME Product (row.product_id must be
 * present and equal), APPROVED and not archived. Order and values come from the server history response; nothing is added or reordered.
 */
export function selectSupersedeReplacementRoutes({ oldRouteId, productId, versions } = {}) {
  const oldId = normalizePrmIntegerId(oldRouteId);
  const pid = normalizePrmIntegerId(productId);
  if (oldId == null || pid == null || !Array.isArray(versions)) return [];
  const seen = new Set();
  const out = [];
  for (const row of versions) {
    const id = resolvePrmProductHistoryRouteId(row);
    if (id == null || id === oldId || seen.has(id)) continue;
    // Fail closed: the row must itself carry the same product_id. The history RPC filters by product and returns
    // whole table rows today, but eligibility must not depend on that - a row with no (or another) product is
    // never offered.
    if (normalizePrmIntegerId(row?.product_id) !== pid) continue;
    if (row?.archived_at) continue;
    if (!isApproved(prmRouteHeaderStatus(row))) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

/**
 * Gate for the Supersede action. { visible, note, candidates }.
 * choices: { status: "loading" | "ready" | "error", versions } for the loaded route's Product.
 */
export function resolveSupersedeGate({ header, choices } = {}) {
  if (!header) return { visible: false, note: "", candidates: [] };
  if (!isApproved(prmRouteHeaderStatus(header))) {
    return { visible: false, note: SUPERSEDE_NOT_APPROVED_NOTE, candidates: [] };
  }
  if (!choices || choices.status === "loading") {
    return { visible: false, note: SUPERSEDE_CHECKING_NOTE, candidates: [] };
  }
  if (choices.status === "error") {
    return { visible: false, note: SUPERSEDE_HISTORY_ERROR_NOTE, candidates: [] };
  }
  const candidates = selectSupersedeReplacementRoutes({
    oldRouteId: resolvePrmProductHistoryRouteId(header),
    productId: header.product_id,
    versions: choices.versions,
  });
  if (!candidates.length) {
    return { visible: false, note: SUPERSEDE_NO_REPLACEMENT_NOTE, candidates: [] };
  }
  return { visible: true, note: "", candidates };
}

/** Human label for a replacement option. Dates are shown as returned by the server (no date logic). */
export function formatSupersedeOptionLabel(row = {}) {
  const id = resolvePrmProductHistoryRouteId(row);
  const version = row.version_label ?? row.route_version ?? row.version ?? "";
  const parts = [version !== "" ? `Version ${version}` : `Route ${id}`, `ID ${id}`];
  if (row.effective_from) parts.push(`effective from ${row.effective_from}`);
  if (row.effective_to) parts.push(`to ${row.effective_to}`);
  if (row.approval_reference) parts.push(`ref ${row.approval_reference}`);
  return parts.join(" · ");
}

/** Validator for the replacement selector: only an id from the offered list is accepted. */
export function createSupersedeSelectionValidator(candidates = []) {
  const allowed = new Set(candidates.map((row) => String(resolvePrmProductHistoryRouteId(row))));
  return (raw) => {
    const value = String(raw ?? "").trim();
    if (!value) return { ok: false, error: "Select the replacement route." };
    if (!allowed.has(value)) {
      return { ok: false, error: "Select one of the listed approved routes." };
    }
    return { ok: true, value };
  };
}

/** Label for a fixed exact-run context ("fixed historical context", label only - no resolver, no selector). */
export function formatFixedHistoricalContextLabel(context) {
  const cue = formatPrmExactRunContextCue(context);
  return `Fixed historical context · ${cue}. ${FIXED_HISTORICAL_CONTEXT_NOTE}`;
}

/** Documented fixed contexts per surface (for labels and tests; values come from the helper constants). */
export const PRM_FIXED_HISTORICAL_CONTEXTS = Object.freeze({
  "route-readiness-exact-run-helper": PRM_EXACT_RUN_CONTEXT,
  "shared-workload-preview": PRM_WORKLOAD_PREVIEW_EXACT_RUN_CONTEXT,
  "route-family-mapping-review": PRM_MAPPING_REVIEW_EXACT_RUN_CONTEXT,
  "route-family-foundation-review": PRM_FOUNDATION_REVIEW_EXACT_RUN_CONTEXT,
});

/** Candidate-lens scope selection, from user choice when present, else deep-link context. */
export function resolveCandidateScope({ scope = null, deepLink = {}, selectedRouteFamilyId = null, selectedProductId = null } = {}) {
  if (scope) {
    return {
      familyId: scope.familyId ?? "",
      productId: scope.productId ?? "",
      groupIds: (scope.groupIds || []).map(String),
    };
  }
  const groupId = normalizePrmIntegerId(deepLink?.product_group_id);
  return {
    familyId: selectedRouteFamilyId ?? "",
    productId: selectedProductId ?? "",
    groupIds: groupId != null ? [String(groupId)] : [],
  };
}
