/**
 * Materials / Stores Explain / Action Queue — pure helper smoke tests.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MS_ACTION_TYPE_SEED,
  MS_CALCULATION_FORMULA_LABELS,
  MS_CALCULATION_FORMULA_ORDER,
  MS_FIELD_LABELS,
  MS_KNOWN_ACTION_CODES,
  MS_OVERHEAD_CALCULATION,
  MS_OVERHEAD_DESCRIPTION,
  MS_OVERHEAD_SOURCE_LINEAGE,
  MS_OVERHEAD_SOURCE_NOTE,
  MATERIALS_STORES_OVERHEAD_LINE_LABEL,
  buildMsExplainCacheEntry,
  clampMsQueuePagination,
  coerceNestedMsObject,
  containsObsoleteMsSalesShareWording,
  extractMsCalculationBlock,
  extractMsProductRm,
  extractMsProductSkus,
  extractMsSkuBlock,
  formatMsActionLabel,
  formatMsCalculationFormulaLabel,
  formatMsFieldLabel,
  formatMsMoney,
  formatMsQuantity,
  formatMsRouteLabel,
  formatMsStatusLabel,
  formatMsWorkloadSharePercent,
  isMsExplainCacheEntryReusable,
  mergeMsActionCodeOptions,
  msActionRowIdentity,
  msExplainRequestIdentity,
  nextMsQueueOffsetOnFilterChange,
  normalizeMsExplainRpcPayload,
  resolveMsOverheadCalculation,
  resolveMsOverheadDescription,
  resolveMsOverheadSourceLineage,
  resolveMsOverheadSourceNote,
  scrubObsoleteMsExplainText,
  unwrapMaterialsStoresActionQueueRpcResult,
} from "../public/shared/js/costing-suite-materials-stores-explain-helpers.js";

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

assert(MS_KNOWN_ACTION_CODES.length === 5, "five seed action codes");
assert(
  MS_ACTION_TYPE_SEED.every((item) => MS_KNOWN_ACTION_CODES.includes(item.code)),
  "seed codes match known list",
);

assert(formatMsStatusLabel("READY") === "Ready", "status READY");
assert(
  formatMsStatusLabel("REVIEW_REQUIRED") === "Review required",
  "status REVIEW_REQUIRED",
);
assert(formatMsStatusLabel("BLOCKED") === "Blocked", "status BLOCKED");

assert(
  formatMsActionLabel("BLOCKED_MISSING_PM_REFERENCE_OUTPUT") ===
    "Missing PM reference output",
  "label missing PM reference",
);
assert(
  formatMsActionLabel("BLOCKED_NO_RM_OR_PM_STANDARD_EVIDENCE") ===
    "No RM or PM standard evidence",
  "label no evidence",
);
assert(
  formatMsActionLabel("REVIEW_MONTHLY_ALLOCATION_BASIS") ===
    "Review monthly allocation basis",
  "label monthly basis",
);
assert(
  formatMsActionLabel("REVIEW_ZERO_PM_CLASSIFICATION_REQUIRED") ===
    "Classify zero PM requirement",
  "label zero PM",
);
assert(
  formatMsActionLabel("REVIEW_ZERO_RM_CLASSIFICATION_REQUIRED") ===
    "Classify zero RM requirement",
  "label zero RM",
);
assert(
  String(formatMsActionLabel("FUTURE_UNKNOWN_ACTION")).includes("Future") ||
    formatMsActionLabel("FUTURE_UNKNOWN_ACTION") === "FUTURE_UNKNOWN_ACTION",
  "unknown action humanised fallback",
);

assert(
  formatMsRouteLabel("MATERIAL_COST_MANAGER_RM") ===
    "Material Cost Manager (RM)",
  "route RM",
);
assert(
  formatMsRouteLabel("COSTING_MONTHLY_ALLOCATION_BASIS") ===
    "Monthly allocation basis review",
  "route monthly",
);

assert(formatMsMoney(null) === null, "null money → null (not ₹0.00)");
assert(formatMsMoney(undefined) === null, "undefined money → null");
assert(formatMsMoney(0) === "₹0.00", "zero money → ₹0.00");
assert(formatMsMoney(1250.5)?.startsWith("₹"), "real money formats");

assert(formatMsQuantity(null) === null, "null qty → null");
assert(formatMsQuantity(0) === "0", "zero qty → 0");

assert(formatMsWorkloadSharePercent(null) === null, "null share → null");
assert(
  formatMsWorkloadSharePercent(0.0125) === "1.25%" ||
    formatMsWorkloadSharePercent(0.0125)?.includes("1.25"),
  "workload_share ratio ×100 once",
);
assert(
  !String(formatMsWorkloadSharePercent(0.5) || "").includes("5000"),
  "does not multiply by 100 twice",
);

const nested = coerceNestedMsObject({ product_rm: { required_rm_line_count: 2 } });
assert(nested && nested.product_rm, "nested coerce object");

const productPayload = normalizeMsExplainRpcPayload({
  summary_status: "READY",
  product_rm: {
    required_rm_line_count: 3,
    distinct_purchase_item_count: 2,
    repeated_rm_line_count: 1,
    form_conversion_line_count: 0,
    rm_complexity_units: 4.5,
    rm_reference_output_qty: 100,
    rm_reference_output_uom: "g",
    rm_uom_compatibility_status: "OK",
    zero_rm_classification_code: null,
    rm_evidence_status: "READY",
    rm_evidence_reason: null,
    policy_code: "MS-POL",
    policy_version: 1,
    policy_approval_reference: "APR-1",
  },
  skus: [
    {
      sku_id: 10,
      materials_stores_overhead_cost_per_sku: null,
      allocation_status: "BLOCKED",
    },
  ],
});
const productRm = extractMsProductRm(productPayload);
assert(productRm?.required_rm_line_count === 3, "extract product_rm");
assert(extractMsProductSkus(productPayload).length === 1, "extract skus");
assert(
  formatMsMoney(productPayload.skus[0].materials_stores_overhead_cost_per_sku) ===
    null,
  "blocked null amount stays unavailable (null)",
);

const skuPayload = normalizeMsExplainRpcPayload({
  summary_status: "REVIEW_REQUIRED",
  sku: {
    monthly_sku_units: 12,
    monthly_sku_base_qty: 120,
    monthly_driver_method: "ACTUAL_MONTHLY_MAX",
    monthly_driver_source: "SALES",
    monthly_driver_source_month: "2026-07-01",
    monthly_driver_status: "REVIEW_REQUIRED",
    monthly_driver_note: "check",
    required_pm_line_count: 1,
    distinct_pm_item_count: 1,
    pm_override_line_count: 0,
    pm_complexity_units: 2,
    pm_reference_output_qty: 1,
    zero_pm_classification_code: null,
    pm_evidence_status: "READY",
    pm_evidence_reason: null,
    rm_workload_units: 3,
    pm_workload_units: 2,
    unified_workload_units: 5,
    company_eligible_workload_units: 100,
    workload_share: 0.05,
    frozen_pool_amount: 1000,
    monthly_sku_allocation_amount: 50,
    materials_stores_overhead_cost_per_sku: 0,
    allocation_status: "REVIEW_REQUIRED",
    allocation_reason_code: "REVIEW_MONTHLY_ALLOCATION_BASIS",
    allocation_note: "basis",
  },
  calculation: {
    formula_text: "pool * share",
  },
});
assert(extractMsSkuBlock(skuPayload)?.workload_share === 0.05, "extract sku");
assert(
  extractMsCalculationBlock(skuPayload)?.formula_text === "pool * share",
  "extract calculation",
);
assert(
  formatMsMoney(extractMsSkuBlock(skuPayload).materials_stores_overhead_cost_per_sku) ===
    "₹0.00",
  "genuine zero shows ₹0.00",
);

const unwrapped = unwrapMaterialsStoresActionQueueRpcResult([
  {
    total_count: 2,
    row_data: {
      refresh_run_id: 1,
      sku_id: 9,
      action_code: "BLOCKED_MISSING_PM_REFERENCE_OUTPUT",
    },
  },
]);
assert(unwrapped.total_count === 2, "unwrap total_count");
assert(unwrapped.rows.length === 1, "unwrap row_data");

assert(nextMsQueueOffsetOnFilterChange() === 0, "filter resets offset");
const pageMeta = clampMsQueuePagination({
  offset: 500,
  limit: 25,
  total_count: 85,
});
assert(pageMeta.offset === 75, "clamp out-of-range offset");

const codes = mergeMsActionCodeOptions(MS_KNOWN_ACTION_CODES, [
  "FUTURE_MS_CODE",
]);
assert(codes.includes("FUTURE_MS_CODE"), "unknown codes append");
assert(codes[0] === MS_KNOWN_ACTION_CODES[0], "seed codes first");

assert(
  msExplainRequestIdentity({
    period_start: "2026-07-01",
    product_id: 1,
    sku_id: 2,
  }) === "2026-07-01|1|2",
  "SKU explain identity",
);
assert(
  msExplainRequestIdentity({
    period_start: "2026-07-01",
    product_id: 1,
  }) === "2026-07-01|1|product",
  "Product explain identity",
);

const entry = buildMsExplainCacheEntry(skuPayload);
assert(entry?.payload, "cache entry built");
assert(isMsExplainCacheEntryReusable(entry, null) === true, "cache reusable");

assert(
  msActionRowIdentity({
    refresh_run_id: 74,
    sku_id: 12,
    action_code: "REVIEW_MONTHLY_ALLOCATION_BASIS",
  }) === "74|12|REVIEW_MONTHLY_ALLOCATION_BASIS",
  "SKU-grained queue identity",
);

assert(
  MATERIALS_STORES_OVERHEAD_LINE_LABEL === "Materials / Stores Overhead",
  "canonical line label",
);
assert(
  costSheetSrc.includes("rpc_get_sku_materials_stores_explain") &&
    costSheetSrc.includes("rpc_get_product_materials_stores_explain"),
  "cost sheet uses MS explain RPCs",
);
assert(
  costSheetSrc.includes("openSkuMaterialsStoresExplainFromQueue") &&
    costSheetSrc.includes("openProductMaterialsStoresExplainFromQueue"),
  "queue openers exported from cost sheet",
);
assert(
  costSheetSrc.includes("cpMaterialsStoresExplainHost"),
  "MS explain host id present",
);
assert(
  !costSheetSrc.includes("materials_stores_overhead_cost_per_sku") ||
    !/printable.*materials_stores_overhead_cost_per_sku|materials_stores_overhead_cost_per_sku.*printable/i.test(
      costSheetSrc,
    ),
  "no printable-derived MS money invent path asserted loosely",
);
assert(
  costSheetSrc.includes("formatMsWorkloadSharePercent"),
  "workload share formatter used in cost sheet",
);
assert(
  costSheetSrc.includes('msMoneyHtml') ||
    costSheetSrc.includes("unavailable"),
  "null money renders unavailable semantics",
);

const obsoleteSalesShare =
  "Materials/stores overhead pool allocated by product sales share and SKU pack quantity.";
const obsoleteSourceNote = "Source: exact overhead allocation snapshot.";
const obsoleteLineage =
  "public.v_costing_cost_pool_monthly_summary / costing.v_sku_detailed_cost_sheet";

assert(
  containsObsoleteMsSalesShareWording(obsoleteSalesShare),
  "detects obsolete sales-share wording",
);
assert(
  containsObsoleteMsSalesShareWording(obsoleteSourceNote),
  "detects obsolete source note",
);
assert(
  containsObsoleteMsSalesShareWording(obsoleteLineage),
  "detects obsolete view-name lineage",
);
assert(
  !containsObsoleteMsSalesShareWording(MS_OVERHEAD_CALCULATION),
  "canonical calculation is not obsolete",
);

assert(
  resolveMsOverheadDescription(obsoleteSalesShare) === MS_OVERHEAD_DESCRIPTION,
  "description falls back for obsolete sales-share",
);
assert(
  resolveMsOverheadCalculation(obsoleteSalesShare) === MS_OVERHEAD_CALCULATION,
  "calculation falls back for obsolete sales-share",
);
assert(
  resolveMsOverheadSourceNote(obsoleteSourceNote) === MS_OVERHEAD_SOURCE_NOTE,
  "source note falls back for obsolete note",
);
assert(
  resolveMsOverheadSourceLineage(obsoleteLineage) === MS_OVERHEAD_SOURCE_LINEAGE,
  "source lineage falls back for obsolete view-name",
);
const run82MsServerCalc =
  "Frozen Materials / Stores pool × governed SKU RM/PM workload share; monthly SKU allocation ÷ governed monthly SKU units.";
const run82MsServerSummary =
  "Governed Materials / Stores overhead for this SKU from the exact-run frozen pool.";
assert(
  resolveMsOverheadCalculation(run82MsServerCalc) === run82MsServerCalc,
  "calculation prefers current server narrative",
);
assert(
  resolveMsOverheadDescription(run82MsServerSummary) === run82MsServerSummary,
  "description prefers current server narrative",
);
assert(
  resolveMsOverheadCalculation("") === MS_OVERHEAD_CALCULATION &&
    resolveMsOverheadDescription(null) === MS_OVERHEAD_DESCRIPTION,
  "blank/missing uses fallback constants",
);
assert(
  !/product\s+sales\s+share/i.test(MS_OVERHEAD_CALCULATION) &&
    !/product\s+sales\s+share/i.test(MS_OVERHEAD_DESCRIPTION),
  "canonical constants have no sales-share phrase",
);
assert(
  !/exact\s+overhead\s+allocation\s+snapshot/i.test(MS_OVERHEAD_SOURCE_NOTE),
  "canonical source note has no old generic overhead note",
);
assert(
  !/v_costing_cost_pool_monthly_summary|v_sku_detailed_cost_sheet/i.test(
    MS_OVERHEAD_SOURCE_LINEAGE,
  ),
  "canonical lineage has no old view names",
);
assert(
  scrubObsoleteMsExplainText(obsoleteSalesShare, "formula") ===
    MS_OVERHEAD_CALCULATION,
  "evidence scrub replaces obsolete formula",
);
assert(
  scrubObsoleteMsExplainText("Unrelated exact-run note", "source_note") ===
    "Unrelated exact-run note",
  "evidence scrub leaves non-obsolete text",
);

assert(
  formatMsFieldLabel("allocation_status") === "Allocation status",
  "field label allocation_status",
);
assert(
  formatMsFieldLabel("materials_stores_overhead_cost_per_sku") ===
    "Stores overhead per SKU",
  "field label stores overhead per SKU",
);
assert(
  formatMsFieldLabel("future_unknown_field") === "Future Unknown Field" ||
    formatMsFieldLabel("future_unknown_field").includes("Future"),
  "unknown field humanised fallback",
);
assert(
  Object.keys(MS_FIELD_LABELS).length >= 24,
  "required field labels present",
);
assert(
  MS_CALCULATION_FORMULA_ORDER.join(",") ===
    "rm_workload_formula,pm_workload_formula,unified_workload_formula,monthly_allocation_formula,per_sku_absorption_formula",
  "formula order exact",
);
assert(
  formatMsCalculationFormulaLabel("per_sku_absorption_formula") ===
    "Stores overhead per SKU",
  "formula label per SKU",
);
assert(
  MS_CALCULATION_FORMULA_LABELS.rm_workload_formula === "RM workload",
  "formula label RM workload",
);

assert(
  costSheetSrc.includes("resolveMsOverheadCalculation") &&
    costSheetSrc.includes("isMaterialsStoresOverheadExplainLine(row)"),
  "MS-only lineage override exists in cost-sheet",
);
assert(
  costSheetSrc.includes("Overall Cost Sheet status") &&
    costSheetSrc.includes("Materials / Stores status"),
  "Overall and Materials / Stores status labels are distinct",
);
assert(
  costSheetSrc.includes("omitDisplayValueEvidence") &&
    costSheetSrc.includes("scrubObsoleteMsSalesShare"),
  "MS evidence omit/scrub options present",
);
assert(
  /isQcOverhead[\s\S]{0,80}resolveQcOverheadCalculationLineage/.test(
    costSheetSrc,
  ),
  "QC lineage scrub remains gated separately",
);
assert(
  !/production overhead[\s\S]{0,200}resolveMsOverhead/i.test(costSheetSrc) &&
    costSheetSrc.includes('"production overhead"'),
  "Production Overhead remains on generic monthly-driver set without MS override",
);
assert(
  !costSheetSrc.includes("resolveMsOverheadCalculation(row") ||
    /isMsOverhead[\s\S]{0,400}resolveMsOverheadCalculation/.test(costSheetSrc),
  "MS resolve is gated by isMsOverhead",
);
assert(
  (costSheetSrc.match(/rpc_get_sku_materials_stores_explain/g) || []).length >=
    1 &&
    (costSheetSrc.match(/rpc_get_product_materials_stores_explain/g) || [])
      .length >= 1 &&
    !costSheetSrc.includes("rpc_get_materials_stores_overhead_recompute"),
  "no new invent/recompute RPC names",
);
assert(
  !/from\(["']costing\./.test(costSheetSrc) ||
    costSheetSrc.includes("TRACEABILITY_VIEW"),
  "no direct costing-schema view invent for MS money",
);
assert(
  !/frozen_pool_amount\s*\*|materials_stores_overhead_cost_per_sku\s*=/.test(
    costSheetSrc,
  ),
  "no client monetary recomputation expressions",
);

if (failed) {
  console.error(`FAILED materials-stores-explain-helpers-smoke (${failed})`);
  process.exit(1);
}
console.log("PASSED materials-stores-explain-helpers-smoke");
