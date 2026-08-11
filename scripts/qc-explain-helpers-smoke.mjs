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
  isQcExplainCacheEntryReusable,
  mergeQcActionCodeOptions,
  mergeSkuAndProductQcExplain,
  nextQcQueueOffsetOnFilterChange,
  pickFirstDefined,
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

const id = qcExplainRequestIdentity({
  period_start: "2026-07-01",
  product_id: 10,
  sku_id: 20,
});
assert(id === "2026-07-01|10|20", "request identity sku");

const entry = buildQcExplainCacheEntry({
  refresh_run_id: 74,
  projection_source: "PERSISTED_EXACT_RUN",
  product_id: 10,
});
assert(isQcExplainCacheEntryReusable(entry, null), "cache reusable when run unknown");
assert(isQcExplainCacheEntryReusable(entry, 74), "cache reusable same run");
assert(
  !isQcExplainCacheEntryReusable(entry, 75),
  "cache NOT reused when run changes",
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
