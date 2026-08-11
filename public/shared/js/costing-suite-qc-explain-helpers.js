/**
 * Pure QC Explain / Action Queue display helpers.
 * No DOM, RPC, global state, or routing.
 */

const STATUS_LABELS = Object.freeze({
  READY: "Ready",
  REVIEW_REQUIRED: "Review required",
  BLOCKED: "Blocked",
  PENDING_NEW_GOVERNED_REFRESH: "Pending governed refresh",
});

const REASON_LABELS = Object.freeze({
  READY_QC_WORKLOAD_AND_ABSORPTION: "QC workload and absorption ready",
  READY_QC_SKU_CONVERSION: "QC SKU conversion ready",
  REVIEW_REQUIRED_QC_ABSORPTION_BASIS: "Review QC absorption basis",
  BLOCKED_MISSING_FG_PROTOCOL_MAPPING: "Missing FG protocol mapping",
  BLOCKED_MISSING_EFFECTIVE_FG_BASE_SPEC: "Missing effective FG base specification",
  BLOCKED_EFFECTIVE_SPEC_RESOLUTION_ERROR: "Effective specification resolution error",
  BLOCKED_NO_REQUIRED_EFFECTIVE_SPEC_LINES: "No required effective specification lines",
  BLOCKED_MISSING_QC_ANALYTICAL_METHOD: "Missing QC analytical method",
  BLOCKED_QC_POOL: "QC pool blocked",
  BLOCKED_QC_ABSORPTION_DENOMINATOR: "QC absorption denominator blocked",
  BLOCKED_INVALID_SKU_BASE_CONVERSION: "Invalid SKU base conversion",
  PENDING_NEW_GOVERNED_REFRESH: "Pending new governed refresh",
});

const ACTION_LABELS = Object.freeze({
  ...REASON_LABELS,
});

const PROJECTION_SOURCE_LABELS = Object.freeze({
  PERSISTED_EXACT_RUN: "Persisted exact run",
  CONTROLLED_PRE_REFRESH_FALLBACK: "Controlled pre-refresh fallback",
});

const EFFECTIVE_TEST_SOURCE_LABELS = Object.freeze({
  BASE: "Base specification",
  MODIFY: "Product modification",
  ADD: "Product addition",
});

const ALLOCATION_SOURCE_LABELS = Object.freeze({
  WORKLOAD_SHARE: "Workload share",
  PRODUCT_WORKLOAD_SHARE: "Product workload share",
});

const QUANTITY_SOURCE_LABELS = Object.freeze({
  GOVERNED_PRODUCT_MONTHLY_BASE_QTY: "Governed Product monthly base quantity",
  COMMERCIAL_SALES_ASSUMPTION: "Commercial sales assumption",
  APPROVED_ASSUMPTION: "Approved assumption",
  ACTUAL_SALES: "Actual sales",
  ACTUAL_MONTHLY_MAX: "Actual monthly max",
  MANUAL_ASSUMPTION: "Manual assumption",
});

const ABSORPTION_METHOD_LABELS = Object.freeze({
  GOVERNED_SKU_ASSUMPTION: "Governed SKU assumption",
  MAX_POSITIVE_COMPANY_WIDE_CLEANED_SKU_MONTH_IN_12M_LOOKBACK:
    "Maximum positive monthly quantity in the frozen 12-month lookback",
});

/** Fallback QC Overhead calculation lineage when server narrative is blank/obsolete. */
export const QC_OVERHEAD_CALCULATION_LINEAGE =
  "Effective-spec analytical-method workload determines the Product QC pool share. The Product allocation is absorbed using the governed monthly Product base quantity and converted to SKU cost using the SKU base quantity per unit.";

const OBSOLETE_QC_SALES_SHARE_PATTERN = /product\s+sales\s+share/i;

export function isBlankQcValue(value) {
  return value === null || value === undefined || value === "";
}

export function normalizeQcCode(code) {
  if (isBlankQcValue(code)) return "";
  return String(code).trim();
}

export function humanizeUnknownQcCode(code) {
  const raw = normalizeQcCode(code);
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function labelFromMap(code, map) {
  const raw = normalizeQcCode(code);
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(map, upper)) return map[upper];
  if (Object.prototype.hasOwnProperty.call(map, raw)) return map[raw];
  return humanizeUnknownQcCode(raw) || raw;
}

/** Returns friendly label, or raw code when unknown. Never drops the code. */
export function formatQcStatusLabel(code) {
  const raw = normalizeQcCode(code);
  if (!raw) return null;
  return labelFromMap(raw, STATUS_LABELS) || raw;
}

export function formatQcReasonLabel(code) {
  const raw = normalizeQcCode(code);
  if (!raw) return null;
  return labelFromMap(raw, REASON_LABELS) || raw;
}

export function formatQcActionLabel(code) {
  const raw = normalizeQcCode(code);
  if (!raw) return null;
  return labelFromMap(raw, ACTION_LABELS) || raw;
}

export function formatQcProjectionSourceLabel(code) {
  const raw = normalizeQcCode(code);
  if (!raw) return null;
  return labelFromMap(raw, PROJECTION_SOURCE_LABELS) || raw;
}

export function formatQcEffectiveTestSourceLabel(code) {
  const raw = normalizeQcCode(code);
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(EFFECTIVE_TEST_SOURCE_LABELS, upper)) {
    return EFFECTIVE_TEST_SOURCE_LABELS[upper];
  }
  return labelFromMap(raw, EFFECTIVE_TEST_SOURCE_LABELS) || raw;
}

export function formatQcAllocationSourceLabel(code) {
  const raw = normalizeQcCode(code);
  if (!raw) return null;
  return labelFromMap(raw, ALLOCATION_SOURCE_LABELS) || raw;
}

export function formatQcQuantitySourceLabel(code) {
  const raw = normalizeQcCode(code);
  if (!raw) return null;
  return labelFromMap(raw, QUANTITY_SOURCE_LABELS) || raw;
}

export function formatQcAbsorptionMethodLabel(code) {
  const raw = normalizeQcCode(code);
  if (!raw) return null;
  return labelFromMap(raw, ABSORPTION_METHOD_LABELS) || raw;
}

/**
 * Display-only month formatter for absorption_basis_source_month.
 * Parses YYYY-MM-DD without local-midnight Date construction.
 * 2025-07-01 → July 2025
 */
export function formatQcAbsorptionSourceMonth(value) {
  if (isBlankQcValue(value)) return null;
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

export function containsObsoleteQcSalesShareWording(value) {
  if (isBlankQcValue(value)) return false;
  return OBSOLETE_QC_SALES_SHARE_PATTERN.test(String(value));
}

/**
 * Resolve QC base-lineage calculation text for the Quality Control Overhead line.
 * Prefer canonical server narrative; client constant is fallback only when blank
 * or clearly obsolete sales-share wording.
 */
export function resolveQcOverheadCalculationLineage(serverText) {
  if (isBlankQcValue(serverText)) return QC_OVERHEAD_CALCULATION_LINEAGE;
  if (containsObsoleteQcSalesShareWording(serverText)) {
    return QC_OVERHEAD_CALCULATION_LINEAGE;
  }
  return String(serverText);
}

/**
 * When evidence/summary text is obsolete sales-share wording, return the
 * authoritative lineage; otherwise return the original text unchanged.
 */
export function scrubObsoleteQcSalesShareText(value) {
  if (isBlankQcValue(value)) return value;
  if (containsObsoleteQcSalesShareWording(value)) {
    return QC_OVERHEAD_CALCULATION_LINEAGE;
  }
  return value;
}

/**
 * Null → null (unavailable). Zero → formatted zero.
 * Never converts null to ₹0.00.
 */
export function formatQcMoney(value) {
  if (isBlankQcValue(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Null → null. Zero → "0%".
 * If value looks like a 0–1 ratio (abs <= 1) and opts.asRatio, multiply by 100.
 */
export function formatQcPercent(value, opts = {}) {
  if (isBlankQcValue(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const asRatio = opts.asRatio === true;
  const pct = asRatio ? n * 100 : n;
  const abs = Math.abs(pct);
  const digits =
    opts.maximumFractionDigits != null
      ? opts.maximumFractionDigits
      : abs >= 1
        ? 2
        : abs >= 0.01
          ? 3
          : 4;
  return `${pct.toLocaleString("en-IN", {
    minimumFractionDigits: Math.min(2, digits),
    maximumFractionDigits: digits,
  })}%`;
}

/** Coverage ratio (0–1) or already-percent value → display percent. */
export function formatQcCoveragePercent(value) {
  if (isBlankQcValue(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  // Heuristic: values in [0, 1.5] treated as ratios; larger as already-percent.
  if (n >= 0 && n <= 1.5) return formatQcPercent(n, { asRatio: true });
  return formatQcPercent(n, { asRatio: false });
}

/** Null → null. Zero → "0". */
export function formatQcQuantity(value, opts = {}) {
  if (isBlankQcValue(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const max =
    opts.maximumFractionDigits != null ? opts.maximumFractionDigits : 4;
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: max,
  });
}

export function formatQcInteger(value) {
  if (isBlankQcValue(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/**
 * Explanatory Method 3 formula text from server-returned units.
 * Does not compute authoritative allocation amounts.
 *
 * Example: 1.00 + 1 × 0.25 = 1.25 units
 */
export function formatQcMethodWorkloadFormulaText({
  required_line_count,
  method_base_units,
  additional_parameter_units,
  method_workload_units,
} = {}) {
  const base = formatQcQuantity(method_base_units, {
    maximumFractionDigits: 4,
  });
  const add = formatQcQuantity(additional_parameter_units, {
    maximumFractionDigits: 4,
  });
  const total = formatQcQuantity(method_workload_units, {
    maximumFractionDigits: 4,
  });
  const lines = Number(required_line_count);
  const extraCount =
    Number.isFinite(lines) && lines > 1 ? Math.trunc(lines) - 1 : 0;

  if (base == null && add == null && total == null) return null;

  const basePart = base != null ? base : "—";
  const addPart = add != null ? add : "—";
  const totalPart = total != null ? total : "—";
  return `${basePart} + ${extraCount} × ${addPart} = ${totalPart} units`;
}

export function pickFirstDefined(...values) {
  for (const value of values) {
    if (!isBlankQcValue(value)) return value;
  }
  return null;
}

/**
 * Coerce a nested payload candidate into a plain object.
 * Accepts object, JSON string of object, or array[0] object.
 * Malformed JSON / non-objects → null (never throws).
 */
export function coerceNestedQcObject(value) {
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

/**
 * Unwrap nested Product explain payload from a SKU explain response.
 * Aliases: product_explain → product_qc_explain → product
 */
export function extractNestedProductQcExplain(skuPayload) {
  if (!skuPayload || typeof skuPayload !== "object") return null;
  return (
    coerceNestedQcObject(skuPayload.product_explain) ||
    coerceNestedQcObject(skuPayload.product_qc_explain) ||
    coerceNestedQcObject(skuPayload.product)
  );
}

/**
 * Defensive SKU wrapper extraction when present.
 * Aliases: sku → sku_explain → sku_conversion
 * Does not invent business data when wrappers are absent.
 */
export function extractNestedSkuQcExplain(skuPayload) {
  if (!skuPayload || typeof skuPayload !== "object") return null;
  return (
    coerceNestedQcObject(skuPayload.sku) ||
    coerceNestedQcObject(skuPayload.sku_explain) ||
    coerceNestedQcObject(skuPayload.sku_conversion)
  );
}

/**
 * Merge source onto target, skipping null / undefined / "" overwrites.
 * Numeric zero is preserved as a valid value.
 */
export function assignDefinedQcFields(target, source) {
  if (!source || typeof source !== "object") return target;
  const out = target && typeof target === "object" ? target : {};
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith("__")) continue;
    if (isBlankQcValue(value)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Build a display model merging SKU-level fields with nested Product fields.
 * Null-safe: blank SKU values do not wipe populated Product values.
 * Preserves __product, __sku, __has_sku for renderer ownership.
 */
export function mergeSkuAndProductQcExplain(skuPayload) {
  if (!skuPayload || typeof skuPayload !== "object") return null;
  const product = extractNestedProductQcExplain(skuPayload) || {};
  const nestedSku = extractNestedSkuQcExplain(skuPayload) || {};

  // Outer payload without nested blob keys (avoid nesting objects on flat model).
  const {
    product_explain: _pe,
    product_qc_explain: _pqe,
    product: _p,
    sku: _s,
    sku_explain: _se,
    sku_conversion: _sc,
    ...outerScalars
  } = skuPayload;

  const sku = assignDefinedQcFields({ ...nestedSku }, outerScalars);

  const merged = {};
  assignDefinedQcFields(merged, product);
  assignDefinedQcFields(merged, sku);

  const hasSkuEvidence = !isBlankQcValue(
    pickFirstDefined(
      sku.sku_id,
      sku.pack_size,
      sku.sku_base_qty_per_unit,
      sku.sku_base_quantity_per_unit,
      sku.quality_control_overhead_cost_per_sku,
      sku.qc_overhead_cost_per_sku,
    ),
  );

  return {
    ...merged,
    __product: product,
    __sku: sku,
    __has_sku: hasSkuEvidence || Object.keys(sku).length > 0,
  };
}

export function qcExplainRequestIdentity({
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

/**
 * Cache reuse guard: reject cached payload when a known current run id
 * disagrees with the cached refresh_run_id.
 */
export function isQcExplainCacheEntryReusable(cacheEntry, currentRunId) {
  if (!cacheEntry || typeof cacheEntry !== "object") return false;
  if (cacheEntry.payload == null) return false;
  if (isBlankQcValue(currentRunId)) return true;
  if (isBlankQcValue(cacheEntry.refresh_run_id)) return true;
  return Number(cacheEntry.refresh_run_id) === Number(currentRunId);
}

export function buildQcExplainCacheEntry(payload) {
  if (!payload || typeof payload !== "object") return null;
  return {
    payload,
    refresh_run_id: pickFirstDefined(payload.refresh_run_id),
    projection_source: pickFirstDefined(payload.projection_source),
    cached_at: Date.now(),
  };
}

export function unwrapQcActionQueueRpcResult(data) {
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
      }
    } else if (
      item.action_code != null ||
      item.product_id != null ||
      item.allocation_status != null
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

/** Reset offset to 0 when search/filter/page-size changes. */
export function nextQcQueueOffsetOnFilterChange() {
  return 0;
}

/**
 * Clamp offset into a valid page for total_count and limit.
 * Returns { offset, pageIndex (0-based), totalPages }.
 */
export function clampQcQueuePagination({
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

/** Collect action codes: known seeds + dynamic server codes (exact raw). */
export function mergeQcActionCodeOptions(knownCodes = [], serverCodes = []) {
  const seen = new Set();
  const out = [];
  for (const code of [...knownCodes, ...serverCodes]) {
    const raw = normalizeQcCode(code);
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

export const QC_KNOWN_ACTION_CODES = Object.freeze([
  "BLOCKED_MISSING_FG_PROTOCOL_MAPPING",
  "REVIEW_REQUIRED_QC_ABSORPTION_BASIS",
  "BLOCKED_MISSING_EFFECTIVE_FG_BASE_SPEC",
  "BLOCKED_EFFECTIVE_SPEC_RESOLUTION_ERROR",
  "BLOCKED_NO_REQUIRED_EFFECTIVE_SPEC_LINES",
  "BLOCKED_MISSING_QC_ANALYTICAL_METHOD",
  "BLOCKED_QC_POOL",
  "BLOCKED_QC_ABSORPTION_DENOMINATOR",
  "BLOCKED_INVALID_SKU_BASE_CONVERSION",
  "PENDING_NEW_GOVERNED_REFRESH",
]);

export const QC_EXCLUSION_DISCLOSURE =
  "Products without resolvable effective analytical specifications receive no QC allocation. The frozen QC pool is allocated across Products whose workload is resolvable. Excluded Products remain visible in the QC Action Queue.";

export {
  STATUS_LABELS,
  REASON_LABELS,
  ACTION_LABELS,
  PROJECTION_SOURCE_LABELS,
  EFFECTIVE_TEST_SOURCE_LABELS,
  ALLOCATION_SOURCE_LABELS,
  QUANTITY_SOURCE_LABELS,
  ABSORPTION_METHOD_LABELS,
};
