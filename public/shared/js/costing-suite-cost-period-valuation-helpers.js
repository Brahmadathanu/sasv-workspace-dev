/**
 * Costing Control Center — Cost Period Valuation Governance helpers.
 * Gate 11Y.10C.0. Pure helpers only. No DOM / Supabase side effects.
 */

export const COST_PERIOD_VALUATION_PERMISSION_TARGET =
  "module:costing-control-center";

export const COST_PERIOD_VALUATION_RPC_NAMES = Object.freeze({
  context: "rpc_get_cost_period_valuation_context",
  history: "rpc_get_cost_period_governance_history",
  setValuationDate: "rpc_set_cost_period_valuation_date",
});

export const COST_PERIOD_VALUATION_RPC_ALLOWLIST = Object.freeze([
  COST_PERIOD_VALUATION_RPC_NAMES.context,
  COST_PERIOD_VALUATION_RPC_NAMES.history,
  COST_PERIOD_VALUATION_RPC_NAMES.setValuationDate,
]);

export const COST_PERIOD_VALUATION_RPC_ARG_KEYS = Object.freeze({
  [COST_PERIOD_VALUATION_RPC_NAMES.context]: Object.freeze(["p_period_start"]),
  [COST_PERIOD_VALUATION_RPC_NAMES.history]: Object.freeze(["p_period_start"]),
  [COST_PERIOD_VALUATION_RPC_NAMES.setValuationDate]: Object.freeze([
    "p_period_start",
    "p_valuation_date",
    "p_reason",
    "p_approval_reference",
  ]),
});

export const COST_PERIOD_VALUATION_FORBIDDEN_SUBSTRINGS = Object.freeze([
  "v_cost_periods",
  "rpc_request_costing_refresh",
  "rpc_refresh_cost",
  "create_costing_snapshot",
  "rebuild_costing",
  "stage_03",
  "stage03",
]);

export const COST_PERIOD_VALUATION_CHANGE_WARNING =
  "Future refresh requests for this period will capture this valuation date. Existing refresh runs remain unchanged.";

export const COST_PERIOD_VALUATION_REASON_MIN_LENGTH = 10;

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

export function normalizeIsoDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function enforceExactCostPeriodValuationRpcKeys(rpcName, params = {}) {
  const allowed = COST_PERIOD_VALUATION_RPC_ARG_KEYS[rpcName];
  if (!allowed) {
    return {
      ok: false,
      params: {},
      errors: [`Unknown cost-period valuation RPC: ${rpcName}`],
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

export function buildGetCostPeriodValuationContextArgs({ period_start } = {}) {
  const periodStart = normalizeIsoDate(period_start);
  if (!periodStart) {
    return {
      ok: false,
      params: {},
      errors: ["p_period_start is required"],
    };
  }
  return enforceExactCostPeriodValuationRpcKeys(
    COST_PERIOD_VALUATION_RPC_NAMES.context,
    { p_period_start: periodStart },
  );
}

export function buildGetCostPeriodGovernanceHistoryArgs({
  period_start,
} = {}) {
  const periodStart = normalizeIsoDate(period_start);
  if (!periodStart) {
    return {
      ok: false,
      params: {},
      errors: ["p_period_start is required"],
    };
  }
  return enforceExactCostPeriodValuationRpcKeys(
    COST_PERIOD_VALUATION_RPC_NAMES.history,
    { p_period_start: periodStart },
  );
}

export function isMeaningfulCostPeriodValuationReason(value) {
  const raw = String(value ?? "").trim();
  if (raw.length < COST_PERIOD_VALUATION_REASON_MIN_LENGTH) return false;
  const upper = raw.toUpperCase();
  if (["N/A", "NA", "NONE", "TEST", "TODO", "TBD", "-", "—"].includes(upper)) {
    return false;
  }
  if (/^[-\u2013\u2014._\s]+$/.test(raw)) return false;
  return true;
}

/**
 * Soft UX validation only — server remains authoritative.
 */
export function softValidateCostPeriodValuationChange({
  period_start,
  period_end,
  valuation_date,
  reason,
  approval_reference = null,
} = {}) {
  const errors = [];
  const periodStart = normalizeIsoDate(period_start);
  const periodEnd = normalizeIsoDate(period_end);
  const valuationDate = normalizeIsoDate(valuation_date);

  if (!periodStart) errors.push("Period is required.");
  if (!valuationDate) errors.push("New valuation date is required.");
  if (!isMeaningfulCostPeriodValuationReason(reason)) {
    errors.push(
      `Reason is required (minimum ${COST_PERIOD_VALUATION_REASON_MIN_LENGTH} meaningful characters).`,
    );
  }
  if (valuationDate && periodStart && periodEnd) {
    if (valuationDate < periodStart || valuationDate > periodEnd) {
      errors.push("Valuation date must lie within the costing period.");
    }
  } else if (valuationDate && periodStart && !periodEnd) {
    if (valuationDate < periodStart) {
      errors.push("Valuation date must not be before the period start.");
    }
  }

  if (errors.length) {
    return { ok: false, errors, params: {} };
  }

  const params = {
    p_period_start: periodStart,
    p_valuation_date: valuationDate,
    p_reason: String(reason).trim(),
    p_approval_reference: isBlank(approval_reference)
      ? null
      : String(approval_reference).trim(),
  };
  return enforceExactCostPeriodValuationRpcKeys(
    COST_PERIOD_VALUATION_RPC_NAMES.setValuationDate,
    params,
  );
}

export function buildSetCostPeriodValuationDateArgs(input = {}) {
  return softValidateCostPeriodValuationChange(input);
}

export function formatCostPeriodValuationSourceLabel(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return null;
  if (raw === "SYSTEM_DEFAULT") return "System Default";
  if (raw === "GOVERNED_MANUAL") return "Governed Manual";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatCostPeriodValuationStatusLabel(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return null;
  if (raw === "DRAFT") return "Draft";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatCostPeriodStatusLabel(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return null;
  if (raw === "OPEN") return "Open";
  if (raw === "LOCKED") return "Locked";
  if (raw === "CLOSED") return "Closed";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function canChangeCostPeriodValuation(context, { canEdit = false } = {}) {
  if (canEdit !== true) return false;
  if (!context || typeof context !== "object") return false;
  const status = String(context.period_status || "")
    .trim()
    .toUpperCase();
  if (status && status !== "OPEN") return false;
  const queued = Number(context.queued_or_running_refresh_count || 0);
  if (Number.isFinite(queued) && queued > 0) return false;
  return true;
}

function unwrapFirstRow(raw) {
  let payload = raw;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (Array.isArray(payload)) return payload[0] || null;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.rows)) return payload.rows[0] || null;
    if (Array.isArray(payload.data)) return payload.data[0] || null;
    return payload;
  }
  return null;
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

export function normalizeCostPeriodValuationContext(raw) {
  const row = unwrapFirstRow(raw);
  if (!row || typeof row !== "object") return null;

  const queued = Number(
    row.queued_or_running_refresh_count ?? row.queued_running_refresh_count ?? 0,
  );

  return {
    period_start: normalizeIsoDate(row.period_start),
    period_end: normalizeIsoDate(row.period_end),
    period_status: row.period_status || row.status || null,
    remarks: row.remarks ?? null,
    valuation_date: normalizeIsoDate(row.valuation_date),
    valuation_date_source: row.valuation_date_source || null,
    valuation_date_status: row.valuation_date_status || null,
    valuation_date_change_reason: row.valuation_date_change_reason || null,
    valuation_date_approval_reference:
      row.valuation_date_approval_reference || null,
    valuation_date_set_at: row.valuation_date_set_at || null,
    valuation_date_set_by: row.valuation_date_set_by || null,
    locked_at: row.locked_at || null,
    lock_reason: row.lock_reason || null,
    closed_at: row.closed_at || null,
    close_reason: row.close_reason || null,
    queued_or_running_refresh_count:
      Number.isFinite(queued) && queued > 0 ? queued : 0,
  };
}

export function normalizeCostPeriodGovernanceHistoryRow(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    audit_id: r.audit_id ?? r.id ?? null,
    period_start: normalizeIsoDate(r.period_start),
    event_type: r.event_type || r.event || null,
    previous_status: r.previous_status || null,
    new_status: r.new_status || null,
    previous_valuation_date: normalizeIsoDate(r.previous_valuation_date),
    new_valuation_date: normalizeIsoDate(r.new_valuation_date),
    previous_valuation_date_status: r.previous_valuation_date_status || null,
    new_valuation_date_status: r.new_valuation_date_status || null,
    reason: r.reason || null,
    approval_reference: r.approval_reference || null,
    event_source: r.event_source || r.source || null,
    actor_user_id: r.actor_user_id || r.actor_id || null,
    actor_display_name:
      r.actor_display_name ||
      r.actor_name ||
      r.display_name ||
      (typeof r.actor === "object"
        ? r.actor.display_name || r.actor.name || null
        : null),
    occurred_at: r.occurred_at || r.created_at || null,
  };
}

export function unwrapCostPeriodGovernanceHistoryPayload(raw) {
  let payload = raw;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = [];
    }
  }
  let rows = [];
  if (Array.isArray(payload)) rows = payload;
  else if (payload && typeof payload === "object") {
    rows = coerceList(
      payload.rows || payload.history || payload.items || payload.data,
    );
  }
  return rows
    .map(normalizeCostPeriodGovernanceHistoryRow)
    .sort((a, b) => {
      const at = Date.parse(a.occurred_at || "") || 0;
      const bt = Date.parse(b.occurred_at || "") || 0;
      return bt - at;
    });
}

export function formatCostPeriodValuationActor(row) {
  if (!row || typeof row !== "object") return null;
  if (!isBlank(row.actor_display_name)) return String(row.actor_display_name);
  const id = row.actor_user_id;
  if (isBlank(id)) return null;
  const raw = String(id);
  if (raw.length <= 12) return raw;
  return `${raw.slice(0, 8)}…`;
}
