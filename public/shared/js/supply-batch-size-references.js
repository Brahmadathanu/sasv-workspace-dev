/**
 * Supply Batch Plan — preferred batch-size register / lifecycle helpers.
 * Pure builders + validators. No DOM / Supabase side effects.
 * Gate 5.11BU.11Y.4E.4 — server remains final authority.
 */

export const SUPPLY_BATCH_PLAN_PERMISSION_TARGET = "module:supply-batch-plan";

export const SUPPLY_BATCH_SIZE_RPC_NAMES = Object.freeze({
  register: "rpc_get_supply_batch_size_references",
  create: "rpc_create_supply_batch_size_reference",
  revise: "rpc_revise_supply_batch_size_reference",
  inactivate: "rpc_inactivate_supply_batch_size_reference",
});

export const SUPPLY_BATCH_SIZE_REGISTER_STATES = Object.freeze([
  "ALL",
  "ACTIVE",
  "INACTIVE",
  "MISSING",
]);

export const SUPPLY_BATCH_SIZE_DEEP_LINK_ACTIONS = Object.freeze([
  "create-batch-size",
  "revise-batch-size",
]);

export const SUPPLY_BATCH_SIZE_RPC_ARG_KEYS = Object.freeze({
  [SUPPLY_BATCH_SIZE_RPC_NAMES.register]: Object.freeze([
    "p_product_id",
    "p_search",
    "p_state",
    "p_limit",
    "p_offset",
  ]),
  [SUPPLY_BATCH_SIZE_RPC_NAMES.create]: Object.freeze([
    "p_product_id",
    "p_preferred_batch_size",
    "p_min_batch_size",
    "p_max_batch_size",
    "p_effective_from",
    "p_change_reason",
    "p_notes",
  ]),
  [SUPPLY_BATCH_SIZE_RPC_NAMES.revise]: Object.freeze([
    "p_reference_id",
    "p_preferred_batch_size",
    "p_min_batch_size",
    "p_max_batch_size",
    "p_effective_from",
    "p_change_reason",
    "p_notes",
  ]),
  [SUPPLY_BATCH_SIZE_RPC_NAMES.inactivate]: Object.freeze([
    "p_reference_id",
    "p_effective_to",
    "p_change_reason",
  ]),
});

export const PRM_PREFERRED_BATCH_SIZE_HANDOFF_LABEL =
  "Open in Supply Batch Plan";
export const PRM_PREFERRED_BATCH_SIZE_HANDOFF_LABEL_MISSING =
  "Open Supply Batch Plan";

export const SUPPLY_BATCH_SIZE_INACTIVATE_COPY = Object.freeze({
  historyRetained: "History is retained.",
  noActiveUntilCreate:
    "Product will have no active preferred batch-size reference until another is created.",
  noPlanRecalcUnlessRequested:
    "No plan recalculation occurs unless separately requested.",
  noCostingOrStage03: "No costing refresh or Stage 03 occurs.",
});

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

export function normalizeSupplyBatchSizeIntegerId(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function normalizeSupplyBatchSizePositiveNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function normalizeSupplyBatchSizeIsoDate(value) {
  if (isBlank(value)) return null;
  const raw = String(value).trim().slice(0, 10);
  if (!ISO_DATE_RE.test(raw)) return null;
  return raw;
}

export function isMeaningfulSupplyBatchSizeChangeReason(value) {
  if (isBlank(value)) return false;
  const text = String(value).trim();
  if (text.length < 3) return false;
  const lower = text.toLowerCase();
  if (["n/a", "na", "-", ".", "..", "...", "none", "test"].includes(lower)) {
    return false;
  }
  return true;
}

/** Local calendar YYYY-MM-DD (not UTC-shifted). */
export function supplyBatchSizeTodayIsoDate(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isFutureSupplyBatchSizeDate(isoDate, todayIso = null) {
  const date = normalizeSupplyBatchSizeIsoDate(isoDate);
  if (!date) return false;
  const today = normalizeSupplyBatchSizeIsoDate(todayIso) || supplyBatchSizeTodayIsoDate();
  return date > today;
}

/**
 * Validate min ≤ preferred ≤ max when all present.
 * Missing min/max are allowed (server may require them).
 */
export function validateSupplyBatchSizeRange({
  preferred_batch_size,
  min_batch_size,
  max_batch_size,
} = {}) {
  const preferred = normalizeSupplyBatchSizePositiveNumber(preferred_batch_size);
  const min =
    min_batch_size == null || min_batch_size === ""
      ? null
      : normalizeSupplyBatchSizePositiveNumber(min_batch_size);
  const max =
    max_batch_size == null || max_batch_size === ""
      ? null
      : normalizeSupplyBatchSizePositiveNumber(max_batch_size);
  const errors = [];
  if (preferred == null) errors.push("preferred_batch_size must be a positive number");
  if (min_batch_size != null && min_batch_size !== "" && min == null) {
    errors.push("min_batch_size must be a positive number when provided");
  }
  if (max_batch_size != null && max_batch_size !== "" && max == null) {
    errors.push("max_batch_size must be a positive number when provided");
  }
  if (preferred != null && min != null && min > preferred) {
    errors.push("min_batch_size cannot be greater than preferred_batch_size");
  }
  if (preferred != null && max != null && max < preferred) {
    errors.push("max_batch_size cannot be less than preferred_batch_size");
  }
  if (min != null && max != null && min > max) {
    errors.push("min_batch_size cannot be greater than max_batch_size");
  }
  return { ok: errors.length === 0, preferred, min, max, errors };
}

/** True when preferred/min/max are all present and violate min ≤ preferred ≤ max. */
export function isInvalidSupplyBatchSizeRange(row = {}) {
  const preferred = normalizeSupplyBatchSizePositiveNumber(
    row.preferred_batch_size ?? row.preferred,
  );
  const min = normalizeSupplyBatchSizePositiveNumber(
    row.min_batch_size ?? row.minimum_batch_size ?? row.minimum,
  );
  const max = normalizeSupplyBatchSizePositiveNumber(
    row.max_batch_size ?? row.maximum_batch_size ?? row.maximum,
  );
  if (preferred == null || min == null || max == null) return false;
  return !(min <= preferred && preferred <= max);
}

export function enforceExactSupplyBatchSizeRpcKeys(rpcName, params = {}) {
  const allowed = SUPPLY_BATCH_SIZE_RPC_ARG_KEYS[rpcName];
  if (!allowed) {
    return {
      ok: false,
      params: {},
      errors: [`Unknown supply batch-size RPC: ${rpcName}`],
    };
  }
  const keys = Object.keys(params || {});
  const unsupported = keys.filter((k) => !allowed.includes(k));
  if (unsupported.length) {
    return {
      ok: false,
      params: {},
      errors: [`Unsupported keys for ${rpcName}: ${unsupported.join(", ")}`],
    };
  }
  return { ok: true, params: { ...params }, errors: [] };
}

function rejectIfUnsupported(rpcName, params) {
  return enforceExactSupplyBatchSizeRpcKeys(rpcName, params);
}

export function buildGetSupplyBatchSizeReferencesArgs({
  product_id = null,
  search = null,
  state = "ALL",
  limit = 50,
  offset = 0,
} = {}) {
  const errors = [];
  const st = String(state || "ALL")
    .trim()
    .toUpperCase();
  if (!SUPPLY_BATCH_SIZE_REGISTER_STATES.includes(st)) {
    errors.push(`p_state must be one of ${SUPPLY_BATCH_SIZE_REGISTER_STATES.join(", ")}`);
  }
  const lim = Math.max(1, Math.min(Number(limit) || 50, 200));
  const off = Math.max(0, Number(offset) || 0);
  const params = {
    p_product_id: null,
    p_search: null,
    p_state: st,
    p_limit: lim,
    p_offset: off,
  };
  const pid = normalizeSupplyBatchSizeIntegerId(product_id);
  if (product_id != null && product_id !== "" && pid == null) {
    errors.push("p_product_id must be a positive integer when provided");
  } else if (pid != null) {
    params.p_product_id = pid;
  }
  const q = isBlank(search) ? null : String(search).trim();
  if (q) params.p_search = q;
  if (errors.length) {
    return { ok: false, params: {}, errors };
  }
  const enforced = rejectIfUnsupported(
    SUPPLY_BATCH_SIZE_RPC_NAMES.register,
    params,
  );
  if (!enforced.ok) return enforced;
  return { ok: true, params: enforced.params, errors: [] };
}

function buildLifecycleSizeArgs({
  rpcName,
  preferred_batch_size,
  min_batch_size,
  max_batch_size,
  effective_from,
  change_reason,
  notes = null,
  todayIso = null,
} = {}) {
  const errors = [];
  const range = validateSupplyBatchSizeRange({
    preferred_batch_size,
    min_batch_size,
    max_batch_size,
  });
  if (!range.ok) errors.push(...range.errors);
  const from = normalizeSupplyBatchSizeIsoDate(effective_from);
  if (!from) errors.push("effective_from must be a valid YYYY-MM-DD date");
  else if (isFutureSupplyBatchSizeDate(from, todayIso)) {
    errors.push("Future-dated create/revise is not supported");
  }
  if (!isMeaningfulSupplyBatchSizeChangeReason(change_reason)) {
    errors.push("Meaningful change_reason is required");
  }
  if (errors.length) return { ok: false, params: {}, errors };
  const params = {
    p_preferred_batch_size: range.preferred,
    p_min_batch_size: range.min,
    p_max_batch_size: range.max,
    p_effective_from: from,
    p_change_reason: String(change_reason).trim(),
    p_notes: isBlank(notes) ? null : String(notes).trim(),
  };
  return rejectIfUnsupported(rpcName, params);
}

export function buildCreateSupplyBatchSizeReferenceArgs(input = {}) {
  const pid = normalizeSupplyBatchSizeIntegerId(input.product_id);
  if (pid == null) {
    return { ok: false, params: {}, errors: ["p_product_id is required"] };
  }
  const built = buildLifecycleSizeArgs({
    rpcName: SUPPLY_BATCH_SIZE_RPC_NAMES.create,
    ...input,
  });
  if (!built.ok) return built;
  const params = { p_product_id: pid, ...built.params };
  return rejectIfUnsupported(SUPPLY_BATCH_SIZE_RPC_NAMES.create, params);
}

export function buildReviseSupplyBatchSizeReferenceArgs(input = {}) {
  const rid = normalizeSupplyBatchSizeIntegerId(input.reference_id);
  if (rid == null) {
    return { ok: false, params: {}, errors: ["p_reference_id is required"] };
  }
  const built = buildLifecycleSizeArgs({
    rpcName: SUPPLY_BATCH_SIZE_RPC_NAMES.revise,
    ...input,
  });
  if (!built.ok) return built;
  const params = { p_reference_id: rid, ...built.params };
  return rejectIfUnsupported(SUPPLY_BATCH_SIZE_RPC_NAMES.revise, params);
}

export function buildInactivateSupplyBatchSizeReferenceArgs({
  reference_id,
  effective_to,
  change_reason,
  todayIso = null,
} = {}) {
  const errors = [];
  const rid = normalizeSupplyBatchSizeIntegerId(reference_id);
  if (rid == null) errors.push("p_reference_id is required");
  const to = normalizeSupplyBatchSizeIsoDate(effective_to);
  if (!to) errors.push("effective_to must be a valid YYYY-MM-DD date");
  else if (isFutureSupplyBatchSizeDate(to, todayIso)) {
    errors.push("Future-dated inactivate is not supported");
  }
  if (!isMeaningfulSupplyBatchSizeChangeReason(change_reason)) {
    errors.push("Meaningful change_reason is required");
  }
  if (errors.length) return { ok: false, params: {}, errors };
  const params = {
    p_reference_id: rid,
    p_effective_to: to,
    p_change_reason: String(change_reason).trim(),
  };
  return rejectIfUnsupported(SUPPLY_BATCH_SIZE_RPC_NAMES.inactivate, params);
}

function coerceList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw == null) return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeSupplyBatchSizeReferenceRow(row = {}) {
  const r = row && typeof row === "object" ? row : {};
  const reference_id =
    normalizeSupplyBatchSizeIntegerId(r.reference_id) ??
    normalizeSupplyBatchSizeIntegerId(r.id) ??
    normalizeSupplyBatchSizeIntegerId(r.batch_size_ref_id);
  const product_id = normalizeSupplyBatchSizeIntegerId(r.product_id);
  const preferred = normalizeSupplyBatchSizePositiveNumber(
    r.preferred_batch_size ?? r.preferred,
  );
  const min = normalizeSupplyBatchSizePositiveNumber(
    r.min_batch_size ?? r.minimum_batch_size ?? r.minimum,
  );
  const max = normalizeSupplyBatchSizePositiveNumber(
    r.max_batch_size ?? r.maximum_batch_size ?? r.maximum,
  );
  const stateRaw = String(
    r.state || r.reference_state || r.status || "",
  )
    .trim()
    .toUpperCase();
  let state = null;
  if (SUPPLY_BATCH_SIZE_REGISTER_STATES.includes(stateRaw)) state = stateRaw;
  else if (r.is_active === true || r.is_active === "true" || stateRaw === "ACTIVE")
    state = "ACTIVE";
  else if (
    r.is_active === false ||
    r.is_active === "false" ||
    stateRaw === "INACTIVE"
  )
    state = "INACTIVE";
  else if (stateRaw === "MISSING" || (reference_id == null && product_id != null))
    state = "MISSING";

  const explicitInvalid =
    r.invalid_range === true ||
    r.range_valid === false ||
    String(r.range_validity || "").toUpperCase() === "INVALID";
  const invalid_range =
    explicitInvalid ||
    isInvalidSupplyBatchSizeRange({
      preferred_batch_size: preferred,
      min_batch_size: min,
      max_batch_size: max,
    });

  return {
    ...r,
    reference_id,
    id: reference_id,
    product_id,
    product_name:
      r.product_name || r.product || r.item || r.product_label || null,
    product_group_name:
      r.product_group_name ||
      r.group_name ||
      r.product_group ||
      r.hierarchy_label ||
      null,
    preferred_batch_size: preferred,
    min_batch_size: min,
    max_batch_size: max,
    uom:
      r.uom ||
      r.product_uom ||
      r.uom_base ||
      r.base_uom ||
      r.product_base_uom ||
      null,
    effective_from: normalizeSupplyBatchSizeIsoDate(r.effective_from) || r.effective_from || null,
    effective_to: normalizeSupplyBatchSizeIsoDate(r.effective_to) || r.effective_to || null,
    state,
    is_active: state === "ACTIVE",
    invalid_range,
    range_validity: invalid_range ? "INVALID" : "VALID",
    change_reason: r.change_reason || r.reason || null,
    notes: r.notes || null,
    supersedes_reference_id:
      normalizeSupplyBatchSizeIntegerId(r.supersedes_reference_id) ??
      normalizeSupplyBatchSizeIntegerId(r.supersedes_id) ??
      normalizeSupplyBatchSizeIntegerId(r.superseded_reference_id),
    created_at: r.created_at || null,
    updated_at: r.updated_at || r.updated_on || null,
    inactivated_at: r.inactivated_at || null,
  };
}

export function unwrapSupplyBatchSizeReferencesPayload(raw) {
  let payload = raw;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }
  if (payload == null) {
    return {
      rows: [],
      total_count: 0,
      status_counts: {},
      invalid_range_count: 0,
    };
  }
  if (Array.isArray(payload)) {
    const rows = payload.map(normalizeSupplyBatchSizeReferenceRow);
    const totalFromRow = rows.find((r) => r.total_count != null)?.total_count;
    return {
      rows,
      total_count:
        totalFromRow != null ? Number(totalFromRow) || rows.length : rows.length,
      status_counts: {},
      invalid_range_count: rows.filter((r) => r.invalid_range).length,
    };
  }
  const root = typeof payload === "object" ? payload : {};
  const list =
    root.rows ||
    root.references ||
    root.items ||
    root.data ||
    root.results ||
    [];
  const rows = coerceList(list).map(normalizeSupplyBatchSizeReferenceRow);
  const total_count = Number(
    root.total_count ?? root.total ?? root.count ?? rows.length,
  );
  const status_counts =
    root.status_counts && typeof root.status_counts === "object"
      ? { ...root.status_counts }
      : {};
  const invalid_range_count = Number(
    root.invalid_range_count ??
      rows.filter((r) => r.invalid_range).length,
  );
  return {
    rows,
    total_count: Number.isFinite(total_count) ? total_count : rows.length,
    status_counts,
    invalid_range_count: Number.isFinite(invalid_range_count)
      ? invalid_range_count
      : 0,
  };
}

export function parseSupplyBatchPlanDeepLink(searchOrUrl = "") {
  let params;
  try {
    if (
      typeof searchOrUrl === "string" &&
      (searchOrUrl.includes("://") || searchOrUrl.includes("?"))
    ) {
      const url = new URL(
        searchOrUrl,
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost",
      );
      params = url.searchParams;
    } else if (typeof searchOrUrl === "string") {
      params = new URLSearchParams(
        searchOrUrl.startsWith("?") ? searchOrUrl : `?${searchOrUrl}`,
      );
    } else {
      params = new URLSearchParams();
    }
  } catch {
    params = new URLSearchParams();
  }
  const tabRaw = String(params.get("tab") || "").trim();
  const tab =
    tabRaw === "batch-sizes" || tabRaw === "tab-batch-sizes"
      ? "batch-sizes"
      : tabRaw || null;
  const product_id = normalizeSupplyBatchSizeIntegerId(params.get("product_id"));
  const actionRaw = String(params.get("action") || "").trim();
  const action = SUPPLY_BATCH_SIZE_DEEP_LINK_ACTIONS.includes(actionRaw)
    ? actionRaw
    : null;
  return {
    tab,
    product_id,
    action,
    openBatchSizesTab: tab === "batch-sizes",
    /** Deep links never auto-mutate. */
    autoMutate: false,
  };
}

/**
 * Relative handoff URL from hub / shared pages to Supply Batch Plan.
 * Absolute root path keeps Electron + PWA compatible.
 */
export function buildSupplyBatchPlanPreferredBatchSizeHandoffUrl(
  productId,
  { action = null } = {},
) {
  const pid = normalizeSupplyBatchSizeIntegerId(productId);
  const params = new URLSearchParams();
  params.set("tab", "batch-sizes");
  if (pid != null) params.set("product_id", String(pid));
  if (action === "create-batch-size" || action === "revise-batch-size") {
    params.set("action", action);
  }
  return `/supply-batch-plan.html?${params.toString()}`;
}

export function buildPrmPreferredBatchSizeHandoffAction(row = {}) {
  const product_id = normalizeSupplyBatchSizeIntegerId(row.product_id);
  const readiness = String(row.readiness_status || "")
    .trim()
    .toUpperCase();
  const missing =
    readiness === "BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE" ||
    (row.preferred_batch_size == null &&
      row.preferred_batch_size !== 0 &&
      isBlank(row.preferred_batch_size));
  const action = missing ? "create-batch-size" : null;
  return {
    id: "preferred-batch-size",
    label: missing
      ? PRM_PREFERRED_BATCH_SIZE_HANDOFF_LABEL_MISSING
      : PRM_PREFERRED_BATCH_SIZE_HANDOFF_LABEL,
    mutation: false,
    disabled: product_id == null,
    serverContractRequired: false,
    navigateHandoff: true,
    product_id,
    href:
      product_id == null
        ? null
        : buildSupplyBatchPlanPreferredBatchSizeHandoffUrl(product_id, {
            action,
          }),
    disabledReason:
      product_id == null ? "Product ID required for handoff" : null,
  };
}

export function resolveQuickEditSupplyBatchSizeBranch(activeReference) {
  if (activeReference && (activeReference.reference_id || activeReference.id)) {
    return "revise";
  }
  return "create";
}
