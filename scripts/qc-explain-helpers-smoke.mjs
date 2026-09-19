/**
 * Gate 5.11BS-QC.13 / QC.15 — pure QC explain helper smoke tests.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  QC_KNOWN_ACTION_CODES,
  QC_OVERHEAD_CALCULATION_LINEAGE,
  assignDefinedQcFields,
  buildQcExplainCacheEntry,
  buildQcExplainSelectedRunRpcArgs,
  clampQcQueuePagination,
  coerceNestedQcObject,
  extractNestedProductQcExplain,
  extractNestedSkuQcExplain,
  formatQcAbsorptionMethodLabel,
  formatQcAbsorptionSourceMonth,
  formatQcActionLabel,
  formatQcCoveragePercent,
  formatQcEffectiveTestSourceLabel,
  formatQcMethodWorkloadFormulaText,
  formatQcMoney,
  formatQcPercent,
  formatQcProjectionSourceLabel,
  formatQcQuantity,
  formatQcQuantitySourceLabel,
  formatQcReasonLabel,
  formatQcStatusLabel,
  hasCompleteQcExplainExactIdentity,
  isQcExplainCacheEntryReusable,
  isQcExplainExactResponseAgreement,
  isQcExplainPersistedExactRunUnavailable,
  mergeQcActionCodeOptions,
  mergeSkuAndProductQcExplain,
  nextQcQueueOffsetOnFilterChange,
  pickFirstDefined,
  QC_EXACT_RUN_UNAVAILABLE_MESSAGE,
  qcExplainRequestIdentity,
  resolveQcOverheadCalculationLineage,
  scrubObsoleteQcSalesShareText,
} from "../public/shared/js/costing-suite-qc-explain-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const costSheetSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-cost-sheet.js"),
  "utf8",
);

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

assert(formatQcStatusLabel("READY") === "Ready", "status READY");
assert(
  formatQcStatusLabel("REVIEW_REQUIRED") === "Review required",
  "status REVIEW_REQUIRED",
);
assert(formatQcStatusLabel("BLOCKED") === "Blocked", "status BLOCKED");
assert(
  formatQcStatusLabel("FUTURE_UNKNOWN_STATUS") === "Future Unknown Status" ||
    formatQcStatusLabel("FUTURE_UNKNOWN_STATUS") === "FUTURE_UNKNOWN_STATUS",
  "unknown status remains visible",
);

assert(
  formatQcReasonLabel("BLOCKED_MISSING_FG_PROTOCOL_MAPPING") ===
    "Missing FG protocol mapping",
  "reason missing protocol",
);
assert(
  formatQcActionLabel("REVIEW_REQUIRED_QC_ABSORPTION_BASIS") ===
    "Review QC absorption basis",
  "action absorption review",
);
assert(
  formatQcProjectionSourceLabel("PERSISTED_EXACT_RUN") ===
    "Persisted exact run",
  "projection persisted",
);
assert(
  formatQcProjectionSourceLabel("PERSISTED_EXACT_RUN_UNAVAILABLE") ===
    "Persisted exact run unavailable",
  "projection exact unavailable",
);
assert(
  formatQcProjectionSourceLabel("CONTROLLED_PRE_REFRESH_FALLBACK") ===
    "Controlled pre-refresh fallback",
  "projection fallback",
);

assert(
  formatQcEffectiveTestSourceLabel("BASE") === "Base specification",
  "source BASE",
);
assert(
  formatQcEffectiveTestSourceLabel("MODIFY") === "Product modification",
  "source MODIFY",
);
assert(
  formatQcEffectiveTestSourceLabel("ADD") === "Product addition",
  "source ADD",
);
assert(
  String(formatQcEffectiveTestSourceLabel("WEIRD_SOURCE")).includes("Weird") ||
    formatQcEffectiveTestSourceLabel("WEIRD_SOURCE") === "WEIRD_SOURCE",
  "unknown source visible",
);

assert(formatQcMoney(null) === null, "null money → null (not ₹0.00)");
assert(formatQcMoney(undefined) === null, "undefined money → null");
assert(formatQcMoney(0) === "₹0.00", "zero money → ₹0.00");
assert(formatQcMoney(142241.66666666666)?.startsWith("₹"), "real money formats");

assert(formatQcPercent(null) === null, "null percent → null");
assert(formatQcPercent(0) === "0%" || formatQcPercent(0) === "0.00%", "zero percent");
assert(
  formatQcCoveragePercent(0.953535)?.includes("%"),
  "coverage ratio formats",
);
assert(formatQcQuantity(null) === null, "null qty → null");
assert(formatQcQuantity(0) === "0", "zero qty → 0");

const formula = formatQcMethodWorkloadFormulaText({
  required_line_count: 2,
  method_base_units: 1,
  additional_parameter_units: 0.25,
  method_workload_units: 1.25,
});
assert(
  formula === "1 + 1 × 0.25 = 1.25 units" ||
    formula === "1.00 + 1 × 0.25 = 1.25 units" ||
    /1(\.0+)? \+ 1 × 0\.25 = 1\.25 units/.test(String(formula)),
  `method formula text (${formula})`,
);

const exactSkuTuple = {
  period_start: "2026-09-01",
  product_id: 74,
  sku_id: 12,
  valuation_date: "2026-09-01",
  refresh_run_id: 85,
  request_mode: "exact",
};
const exactSkuRun108 = {
  ...exactSkuTuple,
  valuation_date: "2026-09-10",
  refresh_run_id: 108,
};
const exactProductTuple = {
  period_start: "2026-09-01",
  product_id: 74,
  sku_id: null,
  valuation_date: "2026-09-01",
  refresh_run_id: 85,
  request_mode: "exact",
};
const currentProductTuple = {
  period_start: "2026-09-01",
  product_id: 74,
  sku_id: null,
  valuation_date: "2026-09-10",
  refresh_run_id: 108,
  request_mode: "current",
};
const currentNoFreshness = {
  period_start: "2026-09-01",
  product_id: 74,
  sku_id: null,
  valuation_date: null,
  refresh_run_id: null,
  request_mode: "current",
};
const exactIncomplete = {
  period_start: "2026-09-01",
  product_id: 74,
  sku_id: 12,
  valuation_date: "2026-09-01",
  refresh_run_id: null,
  request_mode: "exact",
};

assert(hasCompleteQcExplainExactIdentity(exactSkuTuple), "exact SKU complete");
assert(
  hasCompleteQcExplainExactIdentity(exactProductTuple),
  "exact Product complete",
);
assert(
  !hasCompleteQcExplainExactIdentity(exactIncomplete),
  "exact incomplete rejected",
);
assert(
  !hasCompleteQcExplainExactIdentity(currentProductTuple),
  "current mode is not exact identity",
);

const exactSkuArgs = buildQcExplainSelectedRunRpcArgs(exactSkuTuple);
assert(
  exactSkuArgs?.p_valuation_date === "2026-09-01" &&
    exactSkuArgs?.p_refresh_run_id === 85 &&
    Object.keys(exactSkuArgs).length === 2,
  "exact SKU emits both exact args",
);
const exactProductArgs = buildQcExplainSelectedRunRpcArgs(exactProductTuple);
assert(
  exactProductArgs?.p_valuation_date === "2026-09-01" &&
    exactProductArgs?.p_refresh_run_id === 85,
  "exact Product emits both exact args",
);
const currentArgs = buildQcExplainSelectedRunRpcArgs(currentProductTuple);
assert(
  currentArgs &&
    Object.keys(currentArgs).length === 0 &&
    !("p_valuation_date" in currentArgs) &&
    !("p_refresh_run_id" in currentArgs),
  "current emits neither exact arg despite display lineage",
);
assert(
  buildQcExplainSelectedRunRpcArgs(exactIncomplete) === null,
  "exact incomplete never emits one exact arg",
);

const id85 = qcExplainRequestIdentity(exactSkuTuple);
const id108 = qcExplainRequestIdentity(exactSkuRun108);
const idProduct = qcExplainRequestIdentity(exactProductTuple);
const idCurrent = qcExplainRequestIdentity(currentProductTuple);
assert(id85 === "2026-09-01|2026-09-01|85|74|12", "exact Run85 cache key");
assert(id108 === "2026-09-01|2026-09-10|108|74|12", "exact Run108 cache key");
assert(id85 !== id108, "Run85 key differs from Run108");
assert(idProduct === "2026-09-01|2026-09-01|85|74|product", "exact Product key");
assert(idProduct !== id85, "Product and SKU keys differ");
assert(
  idCurrent === "2026-09-01|current|74|product",
  "current key uses current sentinel not display run",
);
assert(
  qcExplainRequestIdentity(exactIncomplete) === null,
  "incomplete exact identity is null",
);

const entryOk = buildQcExplainCacheEntry({
  period_start: "2026-09-01",
  valuation_date: "2026-09-01",
  refresh_run_id: 85,
  projection_source: "PERSISTED_EXACT_RUN",
  product_id: 74,
});
assert(
  entryOk?.valuation_date === "2026-09-01" &&
    entryOk?.refresh_run_id === 85 &&
    entryOk?.period_start === "2026-09-01",
  "cache entry stores lineage metadata",
);
assert(
  isQcExplainCacheEntryReusable(entryOk, exactSkuTuple),
  "exact cache reusable when lineage matches",
);
assert(
  !isQcExplainCacheEntryReusable(
    { payload: {}, valuation_date: null, refresh_run_id: 85 },
    exactSkuTuple,
  ),
  "exact cache missing valuation rejected",
);
assert(
  !isQcExplainCacheEntryReusable(
    { payload: {}, valuation_date: "2026-09-01", refresh_run_id: null },
    exactSkuTuple,
  ),
  "exact cache missing run rejected",
);
assert(
  !isQcExplainCacheEntryReusable(
    {
      payload: {},
      valuation_date: "2026-09-01",
      refresh_run_id: 108,
    },
    exactSkuTuple,
  ),
  "exact cache mismatched run rejected",
);
assert(
  !isQcExplainCacheEntryReusable(
    {
      payload: {},
      valuation_date: "2026-09-10",
      refresh_run_id: 85,
    },
    exactSkuTuple,
  ),
  "exact cache mismatched date rejected",
);

const currentEntry = buildQcExplainCacheEntry({
  refresh_run_id: 108,
  projection_source: "CONTROLLED_PRE_REFRESH_FALLBACK",
});
assert(
  isQcExplainCacheEntryReusable(currentEntry, currentProductTuple),
  "current cache reusable when known run matches",
);
assert(
  !isQcExplainCacheEntryReusable(currentEntry, {
    ...currentProductTuple,
    refresh_run_id: 85,
  }),
  "current known-run cache mismatch rejected",
);
assert(
  !isQcExplainCacheEntryReusable(
    { payload: {}, refresh_run_id: null },
    currentProductTuple,
  ),
  "current blank cached run rejected",
);
assert(
  !isQcExplainCacheEntryReusable(currentEntry, currentNoFreshness),
  "current with no freshness run does not reuse",
);

assert(
  Object.keys(buildQcExplainSelectedRunRpcArgs(currentProductTuple)).length ===
    0,
  "cached/display lineage never becomes query identity",
);

assert(
  qcExplainRequestIdentity(exactSkuTuple) !==
    qcExplainRequestIdentity(exactSkuRun108),
  "stale Run85 identity cannot equal Run108",
);
assert(
  qcExplainRequestIdentity(currentProductTuple) !==
    qcExplainRequestIdentity(exactProductTuple),
  "current identity cannot equal exact identity",
);

const productSuccess = {
  period_start: "2026-09-01",
  valuation_date: "2026-09-01",
  refresh_run_id: 85,
  projection_source: "PERSISTED_EXACT_RUN",
  summary_status: "READY",
};
assert(
  isQcExplainExactResponseAgreement(productSuccess, exactProductTuple),
  "exact Product response requires present matching lineage",
);
assert(
  !isQcExplainExactResponseAgreement(
    { valuation_date: "2026-09-01", refresh_run_id: 85 },
    exactProductTuple,
  ),
  "missing exact Product period_start fails closed",
);
assert(
  !isQcExplainExactResponseAgreement(
    {
      period_start: "2026-09-01",
      valuation_date: "2026-09-01",
      refresh_run_id: 108,
      projection_source: "PERSISTED_EXACT_RUN",
    },
    exactProductTuple,
  ),
  "mismatched exact Product run fails closed",
);

const skuSuccess = {
  sku: {
    period_start: "2026-09-01",
    valuation_date: "2026-09-01",
    refresh_run_id: 85,
    sku_id: 12,
  },
  product: {
    period_start: "2026-09-01",
    valuation_date: "2026-09-01",
    refresh_run_id: 85,
    product_id: 74,
  },
  projection_source: "PERSISTED_EXACT_RUN",
  summary_status: "READY",
};
assert(
  isQcExplainExactResponseAgreement(skuSuccess, exactSkuTuple),
  "exact SKU requires present matching SKU lineage",
);
assert(
  !isQcExplainExactResponseAgreement(
    {
      sku: {
        period_start: "2026-09-01",
        valuation_date: "2026-09-01",
        refresh_run_id: 85,
      },
      product: {
        period_start: "2026-09-01",
        valuation_date: "2026-09-01",
        refresh_run_id: 108,
      },
      projection_source: "PERSISTED_EXACT_RUN",
    },
    exactSkuTuple,
  ),
  "nested Product lineage mismatch fails closed",
);
assert(
  !isQcExplainExactResponseAgreement(
    {
      sku: { valuation_date: "2026-09-01", refresh_run_id: 85 },
      projection_source: "PERSISTED_EXACT_RUN",
    },
    exactSkuTuple,
  ),
  "missing exact SKU period_start fails closed",
);

const unavailable = {
  period_start: "2026-09-01",
  valuation_date: "2026-09-01",
  refresh_run_id: 85,
  summary_status: "NO_TRACE_DATA",
  projection_source: "PERSISTED_EXACT_RUN_UNAVAILABLE",
};
assert(
  isQcExplainPersistedExactRunUnavailable(unavailable),
  "unavailable projection detector",
);
assert(
  isQcExplainExactResponseAgreement(unavailable, exactSkuTuple),
  "exact unavailable top-level lineage matches",
);
assert(
  !isQcExplainExactResponseAgreement(
    {
      summary_status: "NO_TRACE_DATA",
      projection_source: "PERSISTED_EXACT_RUN_UNAVAILABLE",
    },
    exactSkuTuple,
  ),
  "unavailable without top-level lineage fails closed",
);
assert(
  QC_EXACT_RUN_UNAVAILABLE_MESSAGE.includes(
    "No persisted Quality Control allocation evidence",
  ),
  "unavailable state renders truthful empty UX copy",
);
assert(
  costSheetSrc.includes("QC_EXACT_RUN_UNAVAILABLE_MESSAGE") &&
    costSheetSrc.includes("PERSISTED_EXACT_RUN_UNAVAILABLE"),
  "Cost Sheet binds unavailable empty UX",
);

assert(
  !isQcExplainExactResponseAgreement(
    {
      period_start: "2026-09-01",
      valuation_date: "2026-09-01",
      refresh_run_id: 85,
      projection_source: "CONTROLLED_PRE_REFRESH_FALLBACK",
      summary_status: "PENDING_NEW_GOVERNED_REFRESH",
    },
    exactProductTuple,
  ),
  "exact response rejects CONTROLLED_PRE_REFRESH_FALLBACK",
);
assert(
  isQcExplainExactResponseAgreement(
    {
      projection_source: "CONTROLLED_PRE_REFRESH_FALLBACK",
      summary_status: "PENDING_NEW_GOVERNED_REFRESH",
    },
    currentProductTuple,
  ),
  "current fallback remains supported (no exact match required)",
);
assert(
  costSheetSrc.includes("CONTROLLED_PRE_REFRESH_FALLBACK") &&
    costSheetSrc.includes("cp-qc-explain-fallback"),
  "ordinary current fallback banner preserved in Cost Sheet",
);

assert(nextQcQueueOffsetOnFilterChange() === 0, "filter change resets offset");
const page = clampQcQueuePagination({
  offset: 200,
  limit: 50,
  total_count: 85,
});
assert(page.offset === 50, `clamp offset beyond end → last page (${page.offset})`);
assert(page.totalPages === 2, "total pages for 85/50");

const merged = mergeQcActionCodeOptions(QC_KNOWN_ACTION_CODES, [
  "FUTURE_ACTION_CODE_X",
]);
assert(
  merged.includes("FUTURE_ACTION_CODE_X"),
  "unknown action codes retained",
);
assert(
  merged.includes("BLOCKED_MISSING_FG_PROTOCOL_MAPPING"),
  "known action codes present",
);

/* ——— Gate QC.15: nested extract / null-safe merge / aliases / lineage ——— */

assert(
  coerceNestedQcObject({ a: 1 })?.a === 1,
  "coerce accepts plain object",
);
assert(coerceNestedQcObject("not-json{") === null, "coerce rejects bad JSON");
assert(
  coerceNestedQcObject('{"workload_units":9}')?.workload_units === 9,
  "coerce parses JSON string object",
);
assert(
  coerceNestedQcObject([{ product_absorption_base_qty: 0.37 }])
    ?.product_absorption_base_qty === 0.37,
  "coerce accepts array[0] object",
);

const productObj = extractNestedProductQcExplain({
  sku_id: 1,
  product_explain: { quality_control_pool_amount: 10, workload_units: 2 },
});
assert(
  productObj?.quality_control_pool_amount === 10 &&
    productObj?.workload_units === 2,
  "extract nested product_explain object",
);

const productFromJson = extractNestedProductQcExplain({
  product_qc_explain: JSON.stringify({
    product_absorption_base_qty: 11,
    absorption_basis_source: "MANUAL_ASSUMPTION",
  }),
});
assert(
  productFromJson?.product_absorption_base_qty === 11 &&
    productFromJson?.absorption_basis_source === "MANUAL_ASSUMPTION",
  "extract nested product_qc_explain JSON string",
);

const productFromArray = extractNestedProductQcExplain({
  product: [{ quality_control_pool_amount: 142241.66666666666 }],
});
assert(
  productFromArray?.quality_control_pool_amount === 142241.66666666666,
  "extract nested product array[0]",
);

assert(
  extractNestedSkuQcExplain({
    sku_explain: { sku_id: 937, pack_size: 5 },
  })?.sku_id === 937,
  "extract nested sku_explain",
);
assert(
  extractNestedSkuQcExplain({ sku: { pack_uom: "g" } })?.pack_uom === "g",
  "extract nested sku wrapper",
);
assert(
  extractNestedSkuQcExplain({ sku_id: 1, pack_size: 5 }) === null,
  "no invented SKU wrapper when absent",
);

const mergeNullSafe = mergeSkuAndProductQcExplain({
  sku_id: 937,
  quality_control_overhead_cost_per_sku: null,
  pack_size: "",
  product_explain: {
    quality_control_pool_amount: 142241.66666666666,
    product_absorption_base_qty: 0.37,
    workload_units: 0,
  },
});
assert(
  mergeNullSafe?.quality_control_pool_amount === 142241.66666666666,
  "Product pool survives SKU null overwrite",
);
assert(
  mergeNullSafe?.product_absorption_base_qty === 0.37,
  "Product absorption survives SKU empty string",
);
assert(mergeNullSafe?.workload_units === 0, "numeric zero remains valid");
assert(
  mergeNullSafe?.__product?.quality_control_pool_amount === 142241.66666666666,
  "__product remains intact",
);
assert(mergeNullSafe?.__sku?.sku_id === 937, "__sku remains intact");
assert(mergeNullSafe?.__has_sku === true, "__has_sku true when SKU evidence");

const assigned = assignDefinedQcFields(
  { quality_control_pool_amount: 100 },
  { quality_control_pool_amount: null, sku_id: 1 },
);
assert(
  assigned.quality_control_pool_amount === 100 && assigned.sku_id === 1,
  "assignDefinedQcFields skips blank overwrite",
);

const chendooramProduct = {
  quality_control_pool_amount: 142241.66666666666,
  workload_units: 9,
  company_resolved_workload_units: 3407.25,
  product_workload_share: 0.0026414263702399295,
  product_qc_allocation_amount: 375.72088928021134,
  product_absorption_base_qty: 0.37,
  absorption_basis_source: "ACTUAL_MONTHLY_MAX",
  absorption_basis_method:
    "MAX_POSITIVE_COMPANY_WIDE_CLEANED_SKU_MONTH_IN_12M_LOOKBACK",
  absorption_basis_source_month: "2025-07-01",
  qc_cost_per_product_base_uom: 1015.46186291949,
};
const chendooramPayload = {
  sku_id: 937,
  pack_size: 5,
  pack_uom: "g",
  product_base_uom: "Kg",
  sku_base_qty_per_unit: 0.005,
  quality_control_overhead_cost_per_sku: 5.07730931459745,
  product_explain: chendooramProduct,
};
const readyModel = mergeSkuAndProductQcExplain(chendooramPayload);
assert(readyModel?.__product?.quality_control_pool_amount === 142241.66666666666, "READY pool available");
assert(readyModel?.__product?.workload_units === 9, "READY workload available");
assert(readyModel?.__product?.company_resolved_workload_units === 3407.25, "READY company workload");
assert(readyModel?.__product?.product_workload_share === 0.0026414263702399295, "READY share");
assert(readyModel?.__product?.product_qc_allocation_amount === 375.72088928021134, "READY allocation");
assert(readyModel?.__product?.product_absorption_base_qty === 0.37, "READY absorption qty");
assert(readyModel?.__product?.absorption_basis_source === "ACTUAL_MONTHLY_MAX", "READY absorption source");
assert(
  readyModel?.__product?.absorption_basis_method ===
    "MAX_POSITIVE_COMPANY_WIDE_CLEANED_SKU_MONTH_IN_12M_LOOKBACK",
  "READY absorption method",
);
assert(readyModel?.__product?.absorption_basis_source_month === "2025-07-01", "READY source month");
assert(readyModel?.__product?.qc_cost_per_product_base_uom === 1015.46186291949, "READY qc per base");
assert(readyModel?.__sku?.sku_id === 937, "READY sku id");
assert(readyModel?.__sku?.pack_size === 5, "READY pack size");
assert(readyModel?.__sku?.pack_uom === "g", "READY pack uom");
assert(readyModel?.__sku?.product_base_uom === "Kg", "READY base uom");
assert(readyModel?.__sku?.sku_base_qty_per_unit === 0.005, "READY base qty");
assert(
  readyModel?.__sku?.quality_control_overhead_cost_per_sku === 5.07730931459745,
  "READY qc per sku",
);
assert(
  pickFirstDefined(
    readyModel.__product.quality_control_pool_amount,
    readyModel.__product.frozen_qc_pool_amount,
  ) === 142241.66666666666,
  "READY live pool alias pick",
);
assert(
  pickFirstDefined(
    readyModel.__sku.quality_control_overhead_cost_per_sku,
    readyModel.__sku.qc_overhead_cost_per_sku,
  ) === 5.07730931459745,
  "READY live sku cost alias pick",
);

const bhasmamModel = mergeSkuAndProductQcExplain({
  sku_id: 1792,
  pack_size: 1000,
  pack_uom: "g",
  sku_base_qty_per_unit: 1,
  quality_control_overhead_cost_per_sku: 34.15644448001921,
  product_explain: {
    quality_control_pool_amount: 142241.66666666666,
    product_absorption_base_qty: 11,
    absorption_basis_source: "MANUAL_ASSUMPTION",
    absorption_basis_method: "GOVERNED_SKU_ASSUMPTION",
    absorption_basis_status: "REVIEW_REQUIRED",
  },
});
assert(bhasmamModel?.__product?.product_absorption_base_qty === 11, "REVIEW absorption qty");
assert(bhasmamModel?.__product?.absorption_basis_source === "MANUAL_ASSUMPTION", "REVIEW source");
assert(bhasmamModel?.__product?.absorption_basis_method === "GOVERNED_SKU_ASSUMPTION", "REVIEW method");
assert(bhasmamModel?.__product?.absorption_basis_status === "REVIEW_REQUIRED", "REVIEW status");
assert(bhasmamModel?.__sku?.sku_id === 1792, "REVIEW sku id");
assert(bhasmamModel?.__sku?.pack_size === 1000, "REVIEW pack");
assert(bhasmamModel?.__sku?.sku_base_qty_per_unit === 1, "REVIEW base qty");
assert(
  bhasmamModel?.__sku?.quality_control_overhead_cost_per_sku === 34.15644448001921,
  "REVIEW qc per sku",
);

assert(
  formatQcQuantitySourceLabel("ACTUAL_MONTHLY_MAX") === "Actual monthly max",
  "label ACTUAL_MONTHLY_MAX",
);
assert(
  formatQcQuantitySourceLabel("MANUAL_ASSUMPTION") === "Manual assumption",
  "label MANUAL_ASSUMPTION",
);
assert(
  formatQcAbsorptionMethodLabel("GOVERNED_SKU_ASSUMPTION") ===
    "Governed SKU assumption",
  "label GOVERNED_SKU_ASSUMPTION",
);
assert(
  formatQcAbsorptionMethodLabel(
    "MAX_POSITIVE_COMPANY_WIDE_CLEANED_SKU_MONTH_IN_12M_LOOKBACK",
  ) === "Maximum positive monthly quantity in the frozen 12-month lookback",
  "label MAX_POSITIVE lookback method",
);
assert(
  formatQcAbsorptionSourceMonth("2025-07-01") === "July 2025",
  "month July 2025",
);

assert(
  !/product\s+sales\s+share/i.test(QC_OVERHEAD_CALCULATION_LINEAGE),
  "QC lineage constant has no product sales share",
);
assert(
  /Effective-spec analytical-method workload/i.test(
    QC_OVERHEAD_CALCULATION_LINEAGE,
  ),
  "QC lineage fallback constant has workload wording",
);
const currentServerQcFormula =
  "Frozen Quality Control pool × governed Product QC workload share; Product allocation is absorbed to SKU using the governed exact-run SKU quantity basis.";
assert(
  resolveQcOverheadCalculationLineage(currentServerQcFormula) ===
    currentServerQcFormula,
  "resolve prefers nonblank current server QC formula",
);
assert(
  resolveQcOverheadCalculationLineage(
    "QC overhead pool allocated by product sales share and SKU pack quantity.",
  ) === QC_OVERHEAD_CALCULATION_LINEAGE,
  "resolve falls back when obsolete sales-share calculation",
);
assert(
  resolveQcOverheadCalculationLineage("") === QC_OVERHEAD_CALCULATION_LINEAGE &&
    resolveQcOverheadCalculationLineage(null) === QC_OVERHEAD_CALCULATION_LINEAGE,
  "resolve falls back when blank formula",
);
assert(
  scrubObsoleteQcSalesShareText(
    "QC overhead pool allocated by product sales share and SKU pack quantity.",
  ) === QC_OVERHEAD_CALCULATION_LINEAGE,
  "scrub replaces obsolete sales-share text",
);
assert(
  scrubObsoleteQcSalesShareText("Unrelated note about refresh") ===
    "Unrelated note about refresh",
  "scrub leaves non-obsolete text",
);

assert(
  costSheetSrc.includes("resolveQcOverheadCalculationLineage") &&
    costSheetSrc.includes("isQualityControlOverheadExplainLine(row)"),
  "QC-only lineage override exists in cost-sheet",
);
assert(
  costSheetSrc.includes("quality_control_pool_amount") &&
    costSheetSrc.includes("product_absorption_base_qty") &&
    costSheetSrc.includes("quality_control_overhead_cost_per_sku"),
  "renderer binds live Product/SKU field aliases",
);
assert(
  costSheetSrc.includes("isRawMaterialCostExplainLine") &&
    costSheetSrc.includes("isMarketingExpenseExplainLine"),
  "RM and Marketing explain paths remain present",
);
assert(
  /isRawMaterialCostExplainLine\(params\)[\s\S]{0,200}loadCostSheetRmExplainSummary/.test(
    costSheetSrc,
  ),
  "RM generic rendering path unchanged (early branch)",
);
assert(
  costSheetSrc.includes("fillMarketingExplainSection") &&
    !/resolveQcOverheadCalculationLineage[\s\S]{0,80}fillMarketingExplainSection/.test(
      costSheetSrc,
    ),
  "Marketing path not gated through QC lineage helper",
);

if (failed) {
  console.error(`\nqc-explain-helpers-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("\nqc-explain-helpers-smoke: all checks passed");
