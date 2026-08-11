/**
 * Pure Materials / Stores Explain / Action Queue display helpers.
 * No DOM, RPC, global state, or routing.
 */

export const MATERIALS_STORES_ACTION_QUEUE_LENS_ID =
  "materials-stores-action-queue";
export const MATERIALS_STORES_OVERHEAD_LINE_LABEL =
  "Materials / Stores Overhead";
export const MATERIALS_STORES_OVERHEAD_LINE_LABEL_NORMALIZED =
  "materials / stores overhead";

/** Canonical Materials / Stores Overhead base-Explain presentation (display-only). */
export const MS_OVERHEAD_DESCRIPTION =
  "Materials and stores handling overhead absorbed by the SKU from the frozen monthly Stores pool.";

export const MS_OVERHEAD_CALCULATION =
  "Frozen Materials / Stores pool × governed SKU RM/PM workload share; monthly SKU allocation ÷ governed monthly SKU units.";

export const MS_OVERHEAD_SOURCE_NOTE =
  "Underlying allocation is provided by the canonical exact-run Materials / Stores workload and monetary allocation snapshots.";

export const MS_OVERHEAD_SOURCE_LINEAGE =
  "Materials / Stores workload snapshot → Materials / Stores allocation snapshot → combined overhead snapshot.";

export const MS_FIELD_LABELS = Object.freeze({
  allocation_status: "Allocation status",
  allocation_reason_code: "Reason",
  allocation_note: "Explanation",
  monthly_sku_units: "Monthly SKU units",
  monthly_sku_base_qty: "Monthly base quantity",
  monthly_driver_method: "Monthly basis method",
  monthly_driver_source: "Monthly basis source",
  monthly_driver_source_month: "Source month",
  monthly_driver_status: "Monthly basis status",
  monthly_driver_note: "Monthly basis note",
  required_pm_line_count: "Required PM lines",
  distinct_pm_item_count: "Distinct PM items",
  pm_override_line_count: "PM override lines",
  pm_complexity_units: "PM complexity",
  pm_reference_output_qty: "PM reference output",
  pm_evidence_status: "PM evidence status",
  pm_evidence_reason: "PM evidence reason",
  rm_workload_units: "RM workload",
  pm_workload_units: "PM workload",
  unified_workload_units: "Unified workload",
  company_eligible_workload_units: "Company eligible workload",
  workload_share: "SKU workload share",
  frozen_pool_amount: "Frozen Stores pool",
  monthly_sku_allocation_amount: "Monthly SKU allocation",
  materials_stores_overhead_cost_per_sku: "Stores overhead per SKU",
});

export const MS_CALCULATION_FORMULA_LABELS = Object.freeze({
  rm_workload_formula: "RM workload",
  pm_workload_formula: "PM workload",
  unified_workload_formula: "Unified workload",
  monthly_allocation_formula: "Monthly Stores allocation",
  per_sku_absorption_formula: "Stores overhead per SKU",
});

/** Visible order for server-provided calculation formula strings. */
export const MS_CALCULATION_FORMULA_ORDER = Object.freeze([
  "rm_workload_formula",
  "pm_workload_formula",
  "unified_workload_formula",
  "monthly_allocation_formula",
  "per_sku_absorption_formula",
]);

const OBSOLETE_MS_SALES_SHARE_PATTERN =
  /product\s+sales\s+share|sku\s+pack\s+quantity/i;
const OBSOLETE_MS_SOURCE_NOTE_PATTERN =
  /exact\s+overhead\s+allocation\s+snapshot/i;
const OBSOLETE_MS_VIEW_LINEAGE_PATTERN =
  /v_costing_cost_pool_monthly_summary|v_sku_detailed_cost_sheet/i;

export const MS_ACTION_TYPE_SEED = Object.freeze([
  {
    code: "BLOCKED_MISSING_PM_REFERENCE_OUTPUT",
    label: "Missing PM reference output",
  },
  {
    code: "BLOCKED_NO_RM_OR_PM_STANDARD_EVIDENCE",
    label: "No RM or PM standard evidence",
  },
  {
    code: "REVIEW_MONTHLY_ALLOCATION_BASIS",
    label: "Review monthly allocation basis",
  },
  {
    code: "REVIEW_ZERO_PM_CLASSIFICATION_REQUIRED",
    label: "Classify zero PM requirement",
  },
  {
    code: "REVIEW_ZERO_RM_CLASSIFICATION_REQUIRED",
    label: "Classify zero RM requirement",
  },
]);

export const MS_KNOWN_ACTION_CODES = Object.freeze(
  MS_ACTION_TYPE_SEED.map((item) => item.code),
);

const STATUS_LABELS = Object.freeze({
  READY: "Ready",
  REVIEW_REQUIRED: "Review required",
  BLOCKED: "Blocked",
  PENDING_NEW_GOVERNED_REFRESH: "Pending governed refresh",
});

const ACTION_LABELS = Object.freeze(
  Object.fromEntries(MS_ACTION_TYPE_SEED.map((item) => [item.code, item.label])),
);

const ROUTE_LABELS = Object.freeze({
  MATERIAL_COST_MANAGER_RM: "Material Cost Manager (RM)",
  MATERIAL_COST_MANAGER_PM: "Material Cost Manager (PM)",
  COSTING_MONTHLY_ALLOCATION_BASIS: "Monthly allocation basis review",
  COST_SHEET_REVIEW: "Cost Sheet Review",
});

export function isBlankMsValue(value) {
  return value === null || value === undefined || value === "";
}

export function normalizeMsCode(code) {
  if (isBlankMsValue(code)) return "";
  return String(code).trim();
}

export function humanizeUnknownMsCode(code) {
  const raw = normalizeMsCode(code);
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function labelFromMsMap(code, map) {
  const raw = normalizeMsCode(code);
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(map, upper)) return map[upper];
  if (Object.prototype.hasOwnProperty.call(map, raw)) return map[raw];
  return humanizeUnknownMsCode(raw) || raw;
}

export function formatMsStatusLabel(code) {
  const raw = normalizeMsCode(code);
  if (!raw) return null;
  return labelFromMsMap(raw, STATUS_LABELS) || raw;
}

export function formatMsActionLabel(code) {
  const raw = normalizeMsCode(code);
  if (!raw) return null;
  return labelFromMsMap(raw, ACTION_LABELS) || raw;
}

export function formatMsRouteLabel(code) {
  const raw = normalizeMsCode(code);
  if (!raw) return null;
  return labelFromMsMap(raw, ROUTE_LABELS) || raw;
}

export function formatMsFieldLabel(key) {
  const raw = String(key ?? "").trim();
  if (!raw) return "";
  if (Object.prototype.hasOwnProperty.call(MS_FIELD_LABELS, raw)) {
    return MS_FIELD_LABELS[raw];
  }
  return humanizeUnknownMsCode(raw) || raw;
}

export function formatMsCalculationFormulaLabel(key) {
  const raw = String(key ?? "").trim();
  if (!raw) return "";
  if (Object.prototype.hasOwnProperty.call(MS_CALCULATION_FORMULA_LABELS, raw)) {
    return MS_CALCULATION_FORMULA_LABELS[raw];
  }
  return humanizeUnknownMsCode(raw) || raw;
}

/**
 * Detect obsolete frozen Materials / Stores sales-share / view-lineage wording.
 * Used for evidence scrubbing and tests — not for the main Explain override gate.
 */
export function containsObsoleteMsSalesShareWording(value) {
  if (isBlankMsValue(value)) return false;
  const raw = String(value);
  return (
    OBSOLETE_MS_SALES_SHARE_PATTERN.test(raw) ||
    OBSOLETE_MS_SOURCE_NOTE_PATTERN.test(raw) ||
    OBSOLETE_MS_VIEW_LINEAGE_PATTERN.test(raw)
  );
}

/**
 * Prefer server Materials / Stores narrative; client constant is fallback only
 * when blank or clearly obsolete legacy wording.
 */
export function resolveMsOverheadDescription(serverText) {
  if (isBlankMsValue(serverText)) return MS_OVERHEAD_DESCRIPTION;
  if (containsObsoleteMsSalesShareWording(serverText)) {
    return MS_OVERHEAD_DESCRIPTION;
  }
  return String(serverText);
}

/** Prefer server calculation; fallback constant only when blank/obsolete. */
export function resolveMsOverheadCalculation(serverText) {
  if (isBlankMsValue(serverText)) return MS_OVERHEAD_CALCULATION;
  if (containsObsoleteMsSalesShareWording(serverText)) {
    return MS_OVERHEAD_CALCULATION;
  }
  return String(serverText);
}

/** Prefer server source note; fallback constant only when blank/obsolete. */
export function resolveMsOverheadSourceNote(serverText) {
  if (isBlankMsValue(serverText)) return MS_OVERHEAD_SOURCE_NOTE;
  if (containsObsoleteMsSalesShareWording(serverText)) {
    return MS_OVERHEAD_SOURCE_NOTE;
  }
  return String(serverText);
}

/** Prefer server source lineage; fallback constant only when blank/obsolete. */
export function resolveMsOverheadSourceLineage(serverText) {
  if (isBlankMsValue(serverText)) return MS_OVERHEAD_SOURCE_LINEAGE;
  if (containsObsoleteMsSalesShareWording(serverText)) {
    return MS_OVERHEAD_SOURCE_LINEAGE;
  }
  return String(serverText);
}

/**
 * Scrub obsolete evidence/supplementary text for Materials / Stores.
 * @param {unknown} value
 * @param {"description"|"calculation"|"source_note"|"source_lineage"|"formula"} [kind]
 */
export function scrubObsoleteMsExplainText(value, kind = "calculation") {
  if (isBlankMsValue(value)) return value;
  if (!containsObsoleteMsSalesShareWording(value)) return value;
  if (kind === "description") return MS_OVERHEAD_DESCRIPTION;
  if (kind === "source_note") return MS_OVERHEAD_SOURCE_NOTE;
  if (kind === "source_lineage") return MS_OVERHEAD_SOURCE_LINEAGE;
  return MS_OVERHEAD_CALCULATION;
}

/** Null → null (unavailable). Zero → formatted zero. Never null → ₹0.00. */
export function formatMsMoney(value) {
  if (isBlankMsValue(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMsQuantity(value, opts = {}) {
  if (isBlankMsValue(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const max =
    opts.maximumFractionDigits != null ? opts.maximumFractionDigits : 4;
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: max,
  });
}

/**
 * workload_share is a 0–1 ratio. Multiply by 100 exactly once for display.
 */
export function formatMsWorkloadSharePercent(value) {
  if (isBlankMsValue(value)) return null;
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

export function formatMsAbsorptionSourceMonth(value) {
  if (isBlankMsValue(value)) return null;
  const raw = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return raw;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return raw;
  }
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
  });
}

export function pickFirstDefinedMs(...values) {
  for (const value of values) {
    if (!isBlankMsValue(value)) return value;
  }
  return null;
}

export function coerceNestedMsObject(value) {
  if (value == null) return null;
  let candidate = value;
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    try {
      candidate = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (Array.isArray(candidate)) {
    if (!candidate.length) return null;
    candidate = candidate[0];
  }
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    return candidate;
  }
  return null;
}

export function normalizeMsExplainRpcPayload(data) {
  if (data == null) return null;
  if (Array.isArray(data)) {
    if (!data.length) return null;
    const first = data[0];
    if (!first || typeof first !== "object") return null;
    return first;
  }
  if (typeof data !== "object") return null;
  return data;
}

export function extractMsProductRm(payload) {
  const root = normalizeMsExplainRpcPayload(payload);
  if (!root) return null;
  return coerceNestedMsObject(root.product_rm);
}

export function extractMsProductSkus(payload) {
  const root = normalizeMsExplainRpcPayload(payload);
  if (!root) return [];
  let list = root.skus;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list.trim());
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list.filter((item) => item && typeof item === "object");
}

export function extractMsSkuBlock(payload) {
  const root = normalizeMsExplainRpcPayload(payload);
  if (!root) return null;
  return coerceNestedMsObject(root.sku) || root;
}

export function extractMsCalculationBlock(payload) {
  const root = normalizeMsExplainRpcPayload(payload);
  if (!root) return null;
  return coerceNestedMsObject(root.calculation);
}

export function unwrapMaterialsStoresActionQueueRpcResult(data) {
  if (data == null) {
    return { rows: [], total_count: 0 };
  }
  const list = Array.isArray(data) ? data : [data];
  const rows = [];
  let total_count = 0;
  let sawTotal = false;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rowData = item.row_data;
    if (rowData != null) {
      if (Array.isArray(rowData)) {
        for (const r of rowData) {
          if (r && typeof r === "object") rows.push(r);
        }
      } else if (typeof rowData === "object") {
        rows.push(rowData);
      } else if (typeof rowData === "string") {
        try {
          const parsed = JSON.parse(rowData);
          if (Array.isArray(parsed)) {
            for (const r of parsed) {
              if (r && typeof r === "object") rows.push(r);
            }
          } else if (parsed && typeof parsed === "object") {
            rows.push(parsed);
          }
        } catch {
          /* ignore malformed */
        }
      }
    } else if (
      item.action_code != null ||
      item.sku_id != null ||
      item.product_id != null
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

export function nextMsQueueOffsetOnFilterChange() {
  return 0;
}

export function clampMsQueuePagination({
  offset = 0,
  limit = 100,
  total_count = 0,
} = {}) {
  const lim = Math.max(1, Number(limit) || 100);
  const total = Math.max(0, Number(total_count) || 0);
  const totalPages = total === 0 ? 1 : Math.ceil(total / lim);
  let off = Math.max(0, Number(offset) || 0);
  if (total > 0 && off >= total) {
    off = (totalPages - 1) * lim;
  }
  const pageIndex = Math.floor(off / lim);
  return { offset: off, pageIndex, totalPages, limit: lim, total_count: total };
}

export function mergeMsActionCodeOptions(knownCodes = [], serverCodes = []) {
  const seen = new Set();
  const out = [];
  for (const code of [...knownCodes, ...serverCodes]) {
    const raw = normalizeMsCode(code);
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

export function msExplainRequestIdentity({
  period_start,
  product_id,
  sku_id = null,
} = {}) {
  const period = String(period_start || "").trim();
  const productId = Number(product_id);
  if (!period || !Number.isFinite(productId)) return null;
  if (sku_id == null || sku_id === "") {
    return `${period}|${productId}|product`;
  }
  const skuId = Number(sku_id);
  if (!Number.isFinite(skuId)) return null;
  return `${period}|${productId}|${skuId}`;
}

export function isMsExplainCacheEntryReusable(cacheEntry, currentRunId) {
  if (!cacheEntry || typeof cacheEntry !== "object") return false;
  if (cacheEntry.payload == null) return false;
  if (isBlankMsValue(currentRunId)) return true;
  if (isBlankMsValue(cacheEntry.refresh_run_id)) return true;
  return Number(cacheEntry.refresh_run_id) === Number(currentRunId);
}

export function buildMsExplainCacheEntry(payload) {
  if (!payload || typeof payload !== "object") return null;
  const sku = extractMsSkuBlock(payload);
  return {
    payload,
    refresh_run_id: pickFirstDefinedMs(
      payload.refresh_run_id,
      sku?.refresh_run_id,
    ),
    projection_source: pickFirstDefinedMs(
      payload.projection_source,
      sku?.projection_source,
    ),
    cached_at: Date.now(),
  };
}

export function isMaterialsStoresActionQueueLens(lensId) {
  return String(lensId || "").trim() === MATERIALS_STORES_ACTION_QUEUE_LENS_ID;
}

export function pageToMsOffset(page, pageSize = 25) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Number(pageSize) || 25);
  return (p - 1) * size;
}

export function msTotalPages(totalCount, pageSize = 25) {
  const total = Math.max(0, Number(totalCount) || 0);
  const size = Math.max(1, Number(pageSize) || 25);
  return total === 0 ? 1 : Math.ceil(total / size);
}

/** SKU-grained queue identity. */
export function msActionRowIdentity(row) {
  if (!row || typeof row !== "object") return "";
  const run = row.refresh_run_id ?? "";
  const sku = row.sku_id ?? "";
  const action = normalizeMsCode(row.action_code);
  return `${run}|${sku}|${action}`;
}

export {
  STATUS_LABELS,
  ACTION_LABELS,
  ROUTE_LABELS,
};
