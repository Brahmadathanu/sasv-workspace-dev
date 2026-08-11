import {
  QC_EXCLUSION_DISCLOSURE,
  buildQcExplainCacheEntry,
  extractNestedProductQcExplain,
  formatQcAbsorptionMethodLabel,
  formatQcAbsorptionSourceMonth,
  formatQcCoveragePercent,
  formatQcEffectiveTestSourceLabel,
  formatQcMethodWorkloadFormulaText,
  formatQcMoney,
  formatQcProjectionSourceLabel,
  formatQcQuantity,
  formatQcQuantitySourceLabel,
  formatQcReasonLabel,
  formatQcStatusLabel,
  isBlankQcValue,
  isQcExplainCacheEntryReusable,
  mergeSkuAndProductQcExplain,
  pickFirstDefined,
  qcExplainRequestIdentity,
  resolveQcOverheadCalculationLineage,
  scrubObsoleteQcSalesShareText,
} from "./costing-suite-qc-explain-helpers.js";
import {
  MATERIALS_STORES_OVERHEAD_LINE_LABEL,
  MATERIALS_STORES_OVERHEAD_LINE_LABEL_NORMALIZED,
  MS_CALCULATION_FORMULA_ORDER,
  buildMsExplainCacheEntry,
  extractMsCalculationBlock,
  extractMsProductRm,
  extractMsProductSkus,
  extractMsSkuBlock,
  formatMsAbsorptionSourceMonth,
  formatMsActionLabel,
  formatMsCalculationFormulaLabel,
  formatMsFieldLabel,
  formatMsMoney,
  formatMsQuantity,
  formatMsStatusLabel,
  formatMsWorkloadSharePercent,
  isBlankMsValue,
  isMsExplainCacheEntryReusable,
  msExplainRequestIdentity,
  normalizeMsExplainRpcPayload,
  pickFirstDefinedMs,
  resolveMsOverheadCalculation,
  resolveMsOverheadDescription,
  resolveMsOverheadSourceLineage,
  resolveMsOverheadSourceNote,
  scrubObsoleteMsExplainText,
} from "./costing-suite-materials-stores-explain-helpers.js";

export const TRACEABILITY_VIEW =
  "v_costing_pricing_cost_sheet_line_traceability";

export const PRINTABLE_LINES_VIEW =
  "v_costing_pricing_printable_cost_sheet_lines";

export const PRINTABLE_PRODUCT_SUMMARY_VIEW =
  "v_costing_pricing_printable_cost_sheet_product_summary";

/**
 * Whitelisted evidence_json keys for Cost Sheet Explain.
 * Tuple: [key, label, valueType, section?]
 * section: governance | allocation_basis | workload | (default Evidence Summary)
 * Unknown keys are never dumped.
 */
export const COST_SHEET_EVIDENCE_KEY_META = [
  ["display_value_numeric", "Display Value", "money"],
  ["display_value_text", "Display Value", "text"],
  ["formula", "Formula", "text"],
  ["source_note", "Source Note", "text"],
  ["material_cost_per_sku", "Material Cost / SKU", "money"],
  ["rm_cost_per_sku", "RM Cost / SKU", "money"],
  ["pm_cost_per_sku", "PM Cost / SKU", "money"],
  ["rm_costing_status", "RM Costing Status", "text"],
  ["pm_costing_status", "PM Costing Status", "text"],
  ["material_costing_status", "Material Costing Status", "text"],
  ["rm_review_rate_line_count", "RM Review Rate Lines", "number"],
  ["pm_review_rate_line_count", "PM Review Rate Lines", "number"],
  ["pool_total_amount", "Pool Total Amount", "money"],
  ["pool_staff_amount", "Pool Staff Amount", "money"],
  ["pool_expense_provision_amount", "Pool Expense Provision", "money"],
  ["pool_status", "Pool Status", "text"],
  ["mrp_ik", "MRP IK", "money"],
  ["mrp_ok", "MRP OK", "money"],
  ["gst_percent", "GST %", "percent"],
  ["ik_discount_percent", "IK Discount %", "percent"],
  ["ok_discount_percent", "OK Discount %", "percent"],
  ["contingency_percent", "Contingency %", "percent"],
  ["scheme_name", "Scheme Name", "text"],
  ["paid_qty", "Paid Qty", "number"],
  ["free_qty", "Free Qty", "number"],
  ["ik_net_sales_realisation", "IK Net Sales Realisation", "money"],
  ["ok_net_sales_realisation", "OK Net Sales Realisation", "money"],
  ["ik_margin_amount_after_scheme", "IK Margin After Scheme", "money"],
  ["ok_margin_amount_after_scheme", "OK Margin After Scheme", "money"],
  ["cost_sheet_status", "Cost Sheet Status", "text"],
  ["cost_sheet_note", "Cost Sheet Note", "text"],
  ["more_in_module", "More In Module", "text"],

  // Common governance (run-82 non-material)
  ["policy_id", "Policy ID", "text", "governance"],
  ["policy_envelope_id", "Policy Envelope ID", "text", "governance"],
  ["pool_snapshot_id", "Pool Snapshot ID", "text", "governance"],
  ["frozen_pool_amount", "Frozen Pool Amount", "money", "governance"],

  // Allocation basis
  ["allocation_basis_snapshot_id", "Allocation Basis Snapshot", "text", "allocation_basis"],
  ["allocation_basis_source", "Allocation Basis Source", "text", "allocation_basis"],
  ["allocation_resolution_status", "Allocation Resolution Status", "text", "allocation_basis"],
  ["allocation_resolution_note", "Allocation Resolution Note", "text", "allocation_basis"],

  // Workload / product allocation (DL / POH / shared)
  ["product_workload_snapshot_id", "Product Workload Snapshot", "text", "workload"],
  ["standard_batch_count", "Standard Batch Count", "number", "workload"],
  ["rounded_batch_count", "Rounded Batch Count", "number", "workload"],
  ["product_workload_units", "Product Workload Units", "number", "workload"],
  ["company_workload_units", "Company Workload Units", "number", "workload"],
  ["product_workload_share", "Product Workload Share", "share", "workload"],
  ["product_allocation_amount", "Product Allocation Amount", "money", "workload"],

  // Materials / Stores
  ["workload_snapshot_id", "Workload Snapshot", "text", "workload"],
  ["rm_workload_units", "RM Workload Units", "number", "workload"],
  ["pm_workload_units", "PM Workload Units", "number", "workload"],
  ["unified_workload_units", "Unified Workload Units", "number", "workload"],
  ["company_eligible_workload_units", "Company Eligible Workload", "number", "workload"],
  ["workload_share", "Workload Share", "share", "workload"],
  ["monthly_sku_allocation_amount", "Monthly SKU Allocation", "money", "workload"],
  ["monthly_driver_source", "Monthly Driver Source", "text", "workload"],
  ["monthly_driver_status", "Monthly Driver Status", "text", "workload"],

  // QC
  ["product_qc_allocation_snapshot_id", "Product QC Allocation Snapshot", "text", "workload"],
  ["workload_units", "Workload Units", "number", "workload"],
  ["company_resolved_workload_units", "Company Resolved Workload", "number", "workload"],
  ["product_qc_allocation_amount", "Product QC Allocation Amount", "money", "workload"],
  ["absorption_basis_source", "Absorption Basis Source", "text", "allocation_basis"],
  ["absorption_basis_status", "Absorption Basis Status", "text", "allocation_basis"],

  // Admin / Finance
  ["resolved_product_allocation_share", "Product Allocation Share", "share", "workload"],
  ["component_allocation_status", "Component Allocation Status", "text", "governance"],
  ["component_allocation_note", "Component Allocation Note", "text", "governance"],

  // Marketing
  ["marketing_value_source", "Marketing Value Source", "text", "governance"],
  ["marketing_evidence_status", "Marketing Evidence Status", "text", "governance"],
  ["product_monetary_allocation_share", "Product Monetary Allocation Share", "share", "workload"],
  ["product_marketing_allocation", "Product Marketing Allocation", "money", "workload"],
  ["region_code", "Region", "text", "workload"],
  ["regional_basis_source", "Regional Basis Source", "text", "allocation_basis"],
  ["regional_basis_status", "Regional Basis Status", "text", "allocation_basis"],
  ["product_region_monetary_allocation_share", "Product-Region Monetary Share", "share", "workload"],
];

/** @deprecated Use COST_SHEET_EVIDENCE_KEY_META */
const EVIDENCE_KEY_META = COST_SHEET_EVIDENCE_KEY_META;

const EVIDENCE_SECTION_TITLES = Object.freeze({
  governance: "Governance",
  allocation_basis: "Allocation Basis",
  workload: "Workload / Allocation",
});

/**
 * Pure: list present whitelisted evidence entries (no unknown-key dump).
 * @returns {{ key: string, label: string, valueType: string, section: string|null, value: unknown }[]}
 */
export function listPresentWhitelistedEvidence(evidenceJson, keyMeta = COST_SHEET_EVIDENCE_KEY_META) {
  if (!evidenceJson || typeof evidenceJson !== "object" || Array.isArray(evidenceJson)) {
    return [];
  }
  const out = [];
  for (const entry of keyMeta) {
    const [key, label, valueType, section = null] = entry;
    if (!(key in evidenceJson)) continue;
    const value = evidenceJson[key];
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "object") continue;
    out.push({ key, label, valueType, section, value });
  }
  return out;
}

/**
 * Pure: decide whether Explain trace load can use exact-run filters.
 * @returns {{ mode: "exact-run"|"missing-exact-run", valuationDate: string|null, refreshRunId: number|null }}
 */
export function resolveTraceabilityExactRunMode({
  valuationDate,
  refreshRunId,
} = {}) {
  const date = String(valuationDate ?? "").trim();
  const runRaw = refreshRunId;
  const run =
    runRaw == null || runRaw === "" ? NaN : Number(runRaw);
  if (date && Number.isFinite(run)) {
    return { mode: "exact-run", valuationDate: date, refreshRunId: run };
  }
  return { mode: "missing-exact-run", valuationDate: null, refreshRunId: null };
}

/**
 * Pure: interpret 0/1/N trace rows with fail-closed semantics (no arbitrary pick).
 * @returns {{ ok: true, row: object } | { ok: false, code: string, message: string }}
 */
export function interpretTraceabilityRows(
  rows,
  {
    expectedValuationDate = null,
    expectedRefreshRunId = null,
    usedExactRunFilters = false,
  } = {},
) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (list.length === 0) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message:
        "Traceability is not available for this line. Run costing refresh and try again.",
    };
  }
  if (list.length > 1) {
    return {
      ok: false,
      code: "AMBIGUOUS",
      message:
        "Multiple trace rows matched this line. Exact costing run context is required.",
    };
  }
  const row = list[0];
  if (usedExactRunFilters || expectedRefreshRunId != null || expectedValuationDate) {
    const rowRun = Number(row.refresh_run_id);
    const rowVal = String(row.valuation_date ?? "").trim();
    const expectedRun =
      expectedRefreshRunId == null || expectedRefreshRunId === ""
        ? NaN
        : Number(expectedRefreshRunId);
    const expectedVal = String(expectedValuationDate ?? "").trim();
    if (Number.isFinite(expectedRun) && rowRun !== expectedRun) {
      return {
        ok: false,
        code: "WRONG_RUN",
        message:
          "Trace row belongs to a different refresh run than the selected cost sheet.",
      };
    }
    if (expectedVal && rowVal && rowVal !== expectedVal) {
      return {
        ok: false,
        code: "WRONG_RUN",
        message:
          "Trace row belongs to a different valuation date than the selected cost sheet.",
      };
    }
  }
  return { ok: true, row };
}

export function isTraceabilityLoadError(result) {
  return Boolean(result && result.__traceLoadError === true);
}

export function explainRequestIdentity(params = {}) {
  return [
    String(params.periodStart ?? "").trim(),
    String(params.valuationDate ?? "").trim(),
    String(params.refreshRunId ?? "").trim(),
    String(params.productId ?? "").trim(),
    String(params.skuId ?? "").trim(),
    String(params.lineLabel ?? "").trim(),
    String(params.sectionCode ?? "").trim(),
    String(params.lineOrder ?? "").trim(),
  ].join("|");
}

export const COST_SHEET_LENS_IDS = [
  "sku-cost-sheet",
  "printable-cost-sheet",
  "cost-comparison",
];

export function isCostSheetLens(lensId) {
  return COST_SHEET_LENS_IDS.includes(lensId);
}

const TABLE_HEADERS = {
  "sku-cost-sheet": [
    "",
    "Product / SKU",
    "SKU ID",
    "MRP IK",
    "MRP OK",
    "Internal Loaded Cost",
    "IK Selling Price",
    "OK Selling Price",
    "Status",
  ],
  "printable-cost-sheet": [
    "Product",
    "Category",
    "Group",
    "SKU Columns",
    "Status",
    "Refreshed At",
  ],
  "cost-comparison": [
    "Product / SKU",
    "Manufacturing COP",
    "Previous Month COP",
    "MoM COP Change %",
    "Internal Loaded Cost",
    "Previous Month Internal Loaded Cost",
    "MoM Internal Loaded Cost Change %",
    "Profit IK",
    "MoM Profit IK Change",
    "Profit OK",
    "MoM Profit OK Change",
  ],
};

const TABLE_ALIGNMENTS = {
  "sku-cost-sheet": [
    "c-center",
    "c-left",
    "c-left",
    "c-right",
    "c-right",
    "c-right",
    "c-right",
    "c-right",
    "c-left",
  ],
  "printable-cost-sheet": [
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
    "c-left",
  ],
  "cost-comparison": [
    "c-left",
    "c-right",
    "c-right",
    "c-center",
    "c-right",
    "c-right",
    "c-center",
    "c-right",
    "c-right",
    "c-right",
    "c-right",
  ],
};

export function createCostSheetController(deps) {
  const {
    dom,
    costingFrom,
    costingRpc,
    showToast,
    text,
    formatMoney,
    formatPercent,
    formatNumber,
    formatDateTime,
    formatPeriodMonth,
    statusChip,
    getRowStatus,
    laneClass,
    compactStatusText,
    productSkuLabel,
    cpCellPrimary,
    normalizeStatus,
    uniqueValues,
    detailPanel,
    kvSection,
    simpleTable,
    getExportedAtIst,
    formatTodayIsoIst,
    toKebabSlug,
    getCurrentExportUser,
    enableLineExplain = false,
    canNavigateTraceabilityDrill,
    navigateTraceabilityDrill,
    getActivePeriodStart,
    getCurrentLens,
  } = deps;

  const {
    costSheetModal,
    costSheetA4,
    costSheetModalTitle,
    costSheetModalSubtitle,
    costSheetModalHint,
    costSheetCloseBtn,
    costSheetPdfBtn,
    costSheetSignModal,
    costSheetSignCloseBtn,
    costSheetSignCancelBtn,
    costSheetSignConfirmBtn,
    csPreparedRole,
    csPreparedOrg,
    csVerifiedRole,
    csVerifiedOrg,
    csApprovedRole,
    csApprovedOrg,
    searchBox,
    costSheetExplainDrawer,
    costSheetExplainBackdrop,
    costSheetExplainCloseBtn,
    costSheetExplainContent,
    costSheetExplainTitle,
    costSheetExplainSubtitle,
  } = dom;

  let printableLines = [];
  let printableProductSummaryCache = null;
  const printableProductLinesCache = new Map();
  /** Exact-tuple cache for rpc_get_monthly_allocation_driver_trace (successful rows only). */
  const monthlyAllocationDriverTraceCache = new Map();
  /**
   * Exact-tuple cache for rpc_get_cost_sheet_marketing_explain_summary.
   * Stores valid governed response rows only (not transport failures).
   */
  const marketingExplainSummaryCache = new Map();
  /**
   * QC Explain cache keyed by period|product|sku (or period|product|product).
   * Entries store { payload, refresh_run_id, projection_source } for successful
   * responses only. Run identity is validated before reuse.
   */
  const qcExplainCache = new Map();
  const msExplainCache = new Map();
  let currentCostSheetProductId = null;
  /** Validated printable export tuple for the open modal / PDF. */
  let currentPrintableExactRunContext = null;
  let currentPrintableSummaryRow = null;
  let costSheetReturnFocus = null;
  let costSheetSignReturnFocus = null;
  let costSheetExplainReturnFocus = null;
  let currentExplainTraceabilityRow = null;
  let costSheetExplainLoadToken = 0;
  let selectedExplainContext = null;
  let selectedExplainCell = null;
  let eventsBound = false;

  const COST_SHEET_SIGN_DEFAULTS = {
    preparedRole: "Addl. Medical Officer (Production - Siddha)",
    preparedOrg: "Santhigiri Ayurveda Siddha Vaidyasala",
    verifiedRole: "DGM (Production Control)",
    verifiedOrg: "Santhigiri Ayurveda Siddha Vaidyasala",
    approvedRole: "General Manager (Production)",
    approvedOrg: "Santhigiri Ayurveda Siddha Vaidyasala",
  };

  let costSheetSignatories = { ...COST_SHEET_SIGN_DEFAULTS };

  function normalizePrintableCachePeriod(periodStart) {
    return String(periodStart ?? "").trim();
  }

  function normalizePrintableDateOnly(value) {
    const raw = String(value ?? "").trim();
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
    return match ? match[1] : "";
  }

  class PrintableExactRunLoadError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "PrintableExactRunLoadError";
      this.code = code;
    }
  }

  const PRINTABLE_INCOMPLETE_CONTEXT_MESSAGE =
    "Unable to load this cost sheet because its costing run context is incomplete. Refresh the list and try again.";
  const PRINTABLE_MIXED_TUPLE_MESSAGE =
    "Cost-sheet lines did not match the selected costing run. No document was generated.";
  const PRINTABLE_EMPTY_LINES_MESSAGE =
    "No printable cost sheet lines found for this costing run.";

  /**
   * Canonical printable export tuple from a summary row.
   * @returns {{ periodStart: string, valuationDate: string, refreshRunId: number, productId: number } | null}
   */
  function resolvePrintableExactRunContext(summaryRow) {
    if (!summaryRow) return null;
    const periodStart = normalizePrintableDateOnly(
      summaryRow.period_start ?? summaryRow.periodStart,
    );
    const valuationDate = normalizePrintableDateOnly(
      summaryRow.valuation_date ?? summaryRow.valuationDate,
    );
    const refreshRunId = Number(
      summaryRow.refresh_run_id ?? summaryRow.refreshRunId,
    );
    const productId = Number(
      summaryRow.product_id ?? summaryRow.productId,
    );
    if (
      !periodStart ||
      !valuationDate ||
      !Number.isFinite(refreshRunId) ||
      !Number.isFinite(productId)
    ) {
      return null;
    }
    return { periodStart, valuationDate, refreshRunId, productId };
  }

  function printableExactRunCacheKey(context) {
    return `${context.periodStart}::${context.valuationDate}::${context.refreshRunId}::${context.productId}`;
  }

  function printableLineMatchesExactRunContext(row, context) {
    if (!row || !context) return false;
    const periodStart = normalizePrintableDateOnly(row.period_start);
    const valuationDate = normalizePrintableDateOnly(row.valuation_date);
    const refreshRunId = Number(row.refresh_run_id);
    const productId = Number(row.product_id);
    if (
      !periodStart ||
      !valuationDate ||
      !Number.isFinite(refreshRunId) ||
      !Number.isFinite(productId)
    ) {
      return false;
    }
    return (
      periodStart === context.periodStart &&
      valuationDate === context.valuationDate &&
      refreshRunId === context.refreshRunId &&
      productId === context.productId
    );
  }

  function validatePrintableLinesForContext(rows, context) {
    if (!rows?.length) {
      return { ok: false, code: "EMPTY", message: PRINTABLE_EMPTY_LINES_MESSAGE };
    }
    for (const row of rows) {
      if (!printableLineMatchesExactRunContext(row, context)) {
        return {
          ok: false,
          code: "MIXED_TUPLE",
          message: PRINTABLE_MIXED_TUPLE_MESSAGE,
        };
      }
    }
    return { ok: true };
  }

  async function fetchAllProductSummaryRowsForPeriod(periodStart) {
    const pageSize = 1000;
    let from = 0;
    const rows = [];

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await costingFrom(PRINTABLE_PRODUCT_SUMMARY_VIEW)
        .select("*")
        .eq("period_start", periodStart)
        .order("product_name", { ascending: true })
        .order("product_id", { ascending: true })
        .range(from, to);

      if (error) throw error;
      const pageRows = data || [];
      rows.push(...pageRows);
      if (pageRows.length < pageSize) break;
      from += pageSize;
    }

    return rows;
  }

  function mapProductSummaryRowToPrintableGroup(row) {
    const periodStart = normalizePrintableDateOnly(row.period_start);
    const valuationDate = normalizePrintableDateOnly(row.valuation_date);
    const refreshRunIdRaw = row.refresh_run_id;
    const productIdRaw = row.product_id;
    const refreshRunId = Number(refreshRunIdRaw);
    const productId = Number(productIdRaw);
    return {
      product_id: Number.isFinite(productId) ? productId : productIdRaw,
      product_name: row.product_name,
      category_name: row.category_name,
      subcategory_name: row.subcategory_name,
      group_name: row.group_name,
      sub_group_name: row.sub_group_name,
      product_hierarchy: row.product_hierarchy,
      period_start: periodStart || row.period_start,
      valuation_date: valuationDate || row.valuation_date,
      refresh_run_id: Number.isFinite(refreshRunId) ? refreshRunId : refreshRunIdRaw,
      product_cost_sheet_status: row.cost_sheet_status,
      cost_sheet_status: row.cost_sheet_status,
      cost_sheet_note: row.cost_sheet_note,
      refreshed_at: row.refreshed_at || row.snapshot_refreshed_at,
      snapshot_refreshed_at: row.snapshot_refreshed_at,
      sku_count: row.sku_count,
      sku_column_labels: row.sku_column_labels,
      line_count: row.line_count,
      blocked_line_count: row.blocked_line_count,
      review_required_line_count: row.review_required_line_count,
      ready_line_count: row.ready_line_count,
    };
  }

  function groupPrintableLinesByProduct(lines) {
    const byProduct = new Map();
    lines.forEach((line) => {
      const key = String(line.product_id ?? "");
      if (!byProduct.has(key)) byProduct.set(key, []);
      byProduct.get(key).push(line);
    });

    return [...byProduct.entries()]
      .map(([productId, rows]) => {
        const first = rows[0] || {};
        const skuLabels = uniqueValues(rows, "sku_column_label");
        const statuses = uniqueValues(rows, "cost_sheet_status");
        const status = statuses.includes("BLOCKED")
          ? "BLOCKED"
          : statuses.includes("REVIEW_REQUIRED")
            ? "REVIEW_REQUIRED"
            : statuses[0] || first.cost_sheet_status || "";
        const refreshedAt = rows
          .map((r) => r.refreshed_at)
          .filter(Boolean)
          .sort()
          .at(-1);
        return {
          product_id: productId,
          product_name: first.product_name,
          category_name: first.category_name,
          subcategory_name: first.subcategory_name,
          group_name: first.group_name,
          sub_group_name: first.sub_group_name,
          product_hierarchy: first.product_hierarchy,
          period_start: first.period_start,
          product_cost_sheet_status: status,
          cost_sheet_note: first.cost_sheet_note,
          refreshed_at: refreshedAt || first.refreshed_at,
          sku_count: uniqueValues(rows, "sku_id").length,
          sku_column_labels: skuLabels.join(", "),
        };
      })
      .sort((a, b) =>
        String(a.product_name || "").localeCompare(String(b.product_name || "")),
      );
  }

  const COST_COMPARISON_FIELDS = {
    manufacturingCop: [
      "manufacturing_cop_per_sku",
      "manufacturing_cop",
      "current_manufacturing_cop_per_sku",
      "current_manufacturing_cop",
    ],
    previousMonthCop: [
      "previous_month_manufacturing_cop_per_sku",
      "previous_month_manufacturing_cop",
      "previous_month_cop",
    ],
    momCopChangePercent: [
      "mom_manufacturing_cop_change_percent",
      "mom_cop_change_percent",
      "manufacturing_cop_mom_change_percent",
    ],
    internalLoadedCost: [
      "internal_loaded_cost_per_sku",
      "internal_loaded_cost",
      "current_internal_loaded_cost_per_sku",
      "current_internal_loaded_cost",
    ],
    previousMonthInternalLoadedCost: [
      "previous_month_internal_loaded_cost_per_sku",
      "previous_month_internal_loaded_cost",
    ],
    momInternalLoadedCostChangePercent: [
      "mom_internal_loaded_cost_change_percent",
      "internal_loaded_cost_mom_change_percent",
    ],
    profitIk: [
      "profit_value_ik",
      "profit_ik",
      "ik_profit",
      "ik_profit_value",
      "current_profit_ik",
    ],
    previousMonthProfitIk: [
      "previous_month_profit_value_ik",
      "previous_month_profit_ik",
      "previous_month_ik_profit",
      "previous_month_ik_profit_value",
    ],
    momProfitIkChange: [
      "profit_value_ik_mom_change",
      "mom_profit_ik_change",
      "mom_ik_profit_change",
      "ik_profit_mom_change",
      "mom_profit_ik_change_amount",
    ],
    profitOk: [
      "profit_value_ok",
      "profit_ok",
      "ok_profit",
      "ok_profit_value",
      "current_profit_ok",
    ],
    previousMonthProfitOk: [
      "previous_month_profit_value_ok",
      "previous_month_profit_ok",
      "previous_month_ok_profit",
      "previous_month_ok_profit_value",
    ],
    momProfitOkChange: [
      "profit_value_ok_mom_change",
      "mom_profit_ok_change",
      "mom_ok_profit_change",
      "ok_profit_mom_change",
      "mom_profit_ok_change_amount",
    ],
    previousYearCop: [
      "previous_year_manufacturing_cop_per_sku",
      "previous_year_manufacturing_cop",
      "previous_year_cop",
    ],
    yoyCopChangePercent: [
      "yoy_manufacturing_cop_change_percent",
      "yoy_cop_change_percent",
      "manufacturing_cop_yoy_change_percent",
    ],
    previousYearInternalLoadedCost: [
      "previous_year_internal_loaded_cost_per_sku",
      "previous_year_internal_loaded_cost",
    ],
    yoyInternalLoadedCostChangePercent: [
      "yoy_internal_loaded_cost_change_percent",
      "internal_loaded_cost_yoy_change_percent",
    ],
    previousYearProfitIk: [
      "previous_year_profit_value_ik",
      "previous_year_profit_ik",
      "previous_year_ik_profit",
      "previous_year_ik_profit_value",
    ],
    yoyProfitIkChange: [
      "profit_value_ik_yoy_change",
      "yoy_profit_ik_change",
      "yoy_ik_profit_change",
      "ik_profit_yoy_change",
    ],
    previousYearProfitOk: [
      "previous_year_profit_value_ok",
      "previous_year_profit_ok",
      "previous_year_ok_profit",
      "previous_year_ok_profit_value",
    ],
    yoyProfitOkChange: [
      "profit_value_ok_yoy_change",
      "yoy_profit_ok_change",
      "yoy_ok_profit_change",
      "ok_profit_yoy_change",
    ],
  };

  function costComparisonValue(row, key) {
    const fields = COST_COMPARISON_FIELDS[key] || [key];
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(row, field)) return row[field];
    }
    return null;
  }

  function comparisonCell(value, formatter, type = "money") {
    const isBlank = value === null || value === undefined || value === "";
    if (isBlank) {
      return `<td class="cp-blank-cell">--</td>`;
    }

    const cellClass = type === "percent" ? "cp-pct-cell" : "cp-num-cell";
    const wrapClass = type === "percent" ? "cp-pct-wrap" : "cp-num-wrap";

    return `<td class="${cellClass}">
    <span class="${wrapClass}">${formatter(value)}</span>
  </td>`;
  }

  function printableSkuMapKey(rowOrSku) {
    const skuId = rowOrSku?.sku_id;
    if (skuId != null && skuId !== "") return String(skuId);
    const label = rowOrSku?.sku_column_label ?? rowOrSku?.label;
    if (label != null && label !== "") return String(label);
    return "";
  }

  function isCostSheetLineExplainEnabled() {
    if (enableLineExplain === false) return false;
    return Boolean(
      costSheetExplainDrawer ||
        document.getElementById("costSheetExplainDrawer"),
    );
  }

  function findCachedProductLines(exactRunContext) {
    const context = resolvePrintableExactRunContext(exactRunContext);
    if (!context) return null;
    const cached = printableProductLinesCache.get(
      printableExactRunCacheKey(context),
    );
    return cached?.lines || null;
  }

  function findProductSummaryRow(productId, periodStart) {
    const periodKey = normalizePrintableCachePeriod(periodStart);
    if (!printableProductSummaryCache) return null;
    if (printableProductSummaryCache.periodStart !== periodKey) return null;
    return (
      printableProductSummaryCache.rows.find(
        (row) => String(row.product_id) === String(productId),
      ) || null
    );
  }

  async function loadPrintableLinesForProduct(exactRunContext) {
    const context = resolvePrintableExactRunContext(exactRunContext);
    if (!context) {
      throw new PrintableExactRunLoadError(
        "INCOMPLETE_CONTEXT",
        PRINTABLE_INCOMPLETE_CONTEXT_MESSAGE,
      );
    }

    const cached = findCachedProductLines(context);
    if (cached) return cached;

    const pageSize = 1000;
    let from = 0;
    const rows = [];

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await costingFrom(PRINTABLE_LINES_VIEW)
        .select("*")
        .eq("period_start", context.periodStart)
        .eq("valuation_date", context.valuationDate)
        .eq("refresh_run_id", context.refreshRunId)
        .eq("product_id", context.productId)
        .order("sku_column_label", { ascending: true })
        .order("section_code", { ascending: true })
        .order("line_order", { ascending: true })
        .range(from, to);

      if (error) throw error;
      const pageRows = data || [];
      rows.push(...pageRows);
      if (pageRows.length < pageSize) break;
      from += pageSize;
    }

    const validation = validatePrintableLinesForContext(rows, context);
    if (!validation.ok) {
      throw new PrintableExactRunLoadError(
        validation.code,
        validation.message,
      );
    }

    printableProductLinesCache.set(printableExactRunCacheKey(context), {
      lines: rows,
      fetchedAt: Date.now(),
    });
    return rows;
  }

  function printableRowsForProduct(productId) {
    if (
      String(currentCostSheetProductId ?? "") === String(productId ?? "") &&
      printableLines.length
    ) {
      return printableLines;
    }

    if (
      currentPrintableExactRunContext &&
      String(currentPrintableExactRunContext.productId) === String(productId)
    ) {
      const cached = findCachedProductLines(currentPrintableExactRunContext);
      return cached || [];
    }

    return [];
  }

  function getPrintableSkuColumns(rows) {
    const bySku = new Map();
    rows.forEach((row) => {
      const key = printableSkuMapKey(row);
      if (!key) return;
      if (!bySku.has(key)) {
        bySku.set(key, {
          sku_id: row.sku_id,
          label: row.sku_column_label || row.sku_id || "--",
          pack_size: Number(row.pack_size),
          pack_uom: row.pack_uom,
        });
      }
    });
    return [...bySku.values()].sort((a, b) => {
      const an = Number.isFinite(a.pack_size)
        ? a.pack_size
        : Number.MAX_SAFE_INTEGER;
      const bn = Number.isFinite(b.pack_size)
        ? b.pack_size
        : Number.MAX_SAFE_INTEGER;
      if (an !== bn) return an - bn;
      return String(a.label).localeCompare(String(b.label));
    });
  }

  function formatPrintableValue(row) {
    if (!row) return "--";
    const type = String(row.value_type || "").toLowerCase();
    if (type === "currency") return formatMoney(row.value_numeric);
    if (type === "percent") return formatPercent(row.value_numeric);
    if (type === "text") return text(row.value_text);
    if (
      row.value_text !== null &&
      row.value_text !== undefined &&
      row.value_text !== ""
    )
      return text(row.value_text);
    return formatNumber(row.value_numeric);
  }

  function closeCostSheetSignModal() {
    if (!costSheetSignModal) return;

    const active = document.activeElement;
    if (active && costSheetSignModal.contains(active)) {
      active.blur();
    }

    costSheetSignModal.classList.add("hidden");
    costSheetSignModal.setAttribute("aria-hidden", "true");

    const returnTarget =
      costSheetSignReturnFocus &&
      costSheetSignReturnFocus !== document.body &&
      document.contains(costSheetSignReturnFocus)
        ? costSheetSignReturnFocus
        : costSheetPdfBtn;

    costSheetSignReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function closeCostSheetModal() {
    if (!costSheetModal) return;

    const active = document.activeElement;
    if (active && costSheetModal.contains(active)) {
      active.blur();
    }

    closeCostSheetSignModal();

    closeCostSheetExplainDrawer();
    clearCostSheetExplainSelection();

    costSheetModal.classList.add("hidden");
    costSheetModal.setAttribute("aria-hidden", "true");

    if (costSheetA4) costSheetA4.innerHTML = "";
    currentCostSheetProductId = null;
    currentPrintableExactRunContext = null;
    currentPrintableSummaryRow = null;
    printableLines = [];

    const returnTarget =
      costSheetReturnFocus &&
      costSheetReturnFocus !== document.body &&
      document.contains(costSheetReturnFocus)
        ? costSheetReturnFocus
        : searchBox;

    costSheetReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function openCostSheetSignModal() {
    if (!costSheetSignModal) return;
    costSheetSignReturnFocus = document.activeElement;
    if (csPreparedRole)
      csPreparedRole.value = costSheetSignatories.preparedRole;
    if (csPreparedOrg) csPreparedOrg.value = costSheetSignatories.preparedOrg;
    if (csVerifiedRole)
      csVerifiedRole.value = costSheetSignatories.verifiedRole;
    if (csVerifiedOrg) csVerifiedOrg.value = costSheetSignatories.verifiedOrg;
    if (csApprovedRole)
      csApprovedRole.value = costSheetSignatories.approvedRole;
    if (csApprovedOrg) csApprovedOrg.value = costSheetSignatories.approvedOrg;
    costSheetSignModal.classList.remove("hidden");
    costSheetSignModal.setAttribute("aria-hidden", "false");

    setTimeout(() => {
      costSheetSignConfirmBtn?.focus();
    }, 0);
  }

  function readCostSheetSignatoriesFromModal() {
    costSheetSignatories = {
      preparedRole:
        csPreparedRole?.value?.trim() || COST_SHEET_SIGN_DEFAULTS.preparedRole,
      preparedOrg:
        csPreparedOrg?.value?.trim() || COST_SHEET_SIGN_DEFAULTS.preparedOrg,
      verifiedRole:
        csVerifiedRole?.value?.trim() || COST_SHEET_SIGN_DEFAULTS.verifiedRole,
      verifiedOrg:
        csVerifiedOrg?.value?.trim() || COST_SHEET_SIGN_DEFAULTS.verifiedOrg,
      approvedRole:
        csApprovedRole?.value?.trim() || COST_SHEET_SIGN_DEFAULTS.approvedRole,
      approvedOrg:
        csApprovedOrg?.value?.trim() || COST_SHEET_SIGN_DEFAULTS.approvedOrg,
    };
  }

  async function confirmCostSheetSignatories() {
    readCostSheetSignatoriesFromModal();
    const productId = currentCostSheetProductId;
    const summaryRow = currentPrintableSummaryRow;
    closeCostSheetSignModal();
    if (productId) {
      await openCostSheetModal(productId, { summaryRow });
      await generateCostSheetPdf(productId);
    }
  }

  function shouldShowCalculationInPrint(line) {
    const label = String(line?.line_label || "").toLowerCase();
    return (
      label.includes("cost of production") ||
      label.includes("manufacturing cop") ||
      label.includes("internal loaded cost") ||
      label.includes("basic price") ||
      label.includes("discount value") ||
      label.includes("selling price") ||
      label.includes("scheme value") ||
      label.includes("sales realisation") ||
      label.includes("profit value") ||
      label.includes("profit on") ||
      label.includes("cop percentage")
    );
  }

  function sectionDescription(sectionCode) {
    const code = String(sectionCode || "");
    if (code === "A_COP")
      return "(Values here flow downward - each row adds up to the next.)";
    if (code === "C_IK_PRICING")
      return "(This section calculates net Sales Realisation for Inside Kerala.)";
    if (code === "D_OK_PRICING")
      return "(This section calculates net Sales Realisation for Outside Kerala.)";
    if (code === "E_PROFIT") return "";
    return "";
  }

  function costSheetFirstColumnHeader(sectionCode) {
    const code = String(sectionCode || "");
    if (code === "A_COP" || code === "B_INTERNAL_COST") return "Cost Component";
    if (code === "C_IK_PRICING" || code === "D_OK_PRICING")
      return "Pricing Component";
    if (code === "E_PROFIT") return "Component";
    return "Component";
  }

  function normalizeCostSheetDisplayLabel(value) {
    return String(value ?? "")
      .replace(/^[\s\t\r\n]+/, "")
      .replace(/[\s\t\r\n]+$/, "");
  }

  function costSheetLineClass(line) {
    const label = String(line?.line_label || "")
      .trim()
      .toLowerCase();
    const strongRows = [
      "total material cost",
      "manufacturing cop",
      "internal loaded cost",
      "sales realisation: ik",
      "sales realisation: ok",
      "profit value: ik",
      "profit value: ok",
    ];
    if (strongRows.includes(label)) return "cost-sheet-row-strong";
    return "";
  }

  function attr(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function humanizeEvidenceKey(key) {
    return String(key || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function inferEvidenceValueType(key, hintedType) {
    if (hintedType) return hintedType;
    const normalized = String(key || "").toLowerCase();
    if (normalized.endsWith("_percent") || normalized.endsWith("_share")) {
      return normalized.endsWith("_share") ? "share" : "percent";
    }
    if (
      normalized.includes("_amount") ||
      normalized.includes("_cost") ||
      normalized.startsWith("mrp_") ||
      normalized.includes("realisation") ||
      normalized.includes("margin")
    ) {
      return "money";
    }
    if (
      normalized.endsWith("_count") ||
      normalized.endsWith("_qty") ||
      normalized.endsWith("_units")
    ) {
      return "number";
    }
    return "text";
  }

  function formatEvidenceValue(key, value, hintedType) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    // Never dump raw JSON objects into Explain.
    if (typeof value === "object") return null;

    const valueType = inferEvidenceValueType(key, hintedType);
    if (valueType === "money") return formatMoney(value);
    if (valueType === "percent") return formatPercent(value);
    if (valueType === "share") {
      const n = Number(value);
      if (!Number.isFinite(n)) return text(value);
      const pct = Math.abs(n) <= 1 ? n * 100 : n;
      return formatPercent(pct);
    }
    if (valueType === "number") return formatNumber(value);
    return text(value);
  }

  function renderEvidenceSummary(
    evidenceJson,
    {
      scrubObsoleteQcSalesShare = false,
      scrubObsoleteMsSalesShare = false,
      omitDisplayValueEvidence = false,
    } = {},
  ) {
    if (!evidenceJson || typeof evidenceJson !== "object") return "";

    const sectionItems = {
      governance: [],
      allocation_basis: [],
      workload: [],
      default: [],
    };

    const present = listPresentWhitelistedEvidence(evidenceJson, EVIDENCE_KEY_META);
    present.forEach(({ key, label, valueType, section, value }) => {
      if (
        omitDisplayValueEvidence &&
        (key === "display_value_numeric" || key === "display_value_text")
      ) {
        return;
      }
      let rawValue = value;
      if (
        scrubObsoleteQcSalesShare &&
        (key === "formula" || key === "source_note") &&
        typeof rawValue === "string"
      ) {
        rawValue = scrubObsoleteQcSalesShareText(rawValue);
      }
      if (scrubObsoleteMsSalesShare && typeof rawValue === "string") {
        if (key === "formula") {
          rawValue = scrubObsoleteMsExplainText(rawValue, "formula");
        } else if (key === "source_note") {
          rawValue = scrubObsoleteMsExplainText(rawValue, "source_note");
        }
      }
      const formatted = formatEvidenceValue(key, rawValue, valueType);
      if (formatted === null) return;
      const bucket =
        section && sectionItems[section] ? sectionItems[section] : sectionItems.default;
      bucket.push([label, formatted]);
    });

    const parts = [];
    if (sectionItems.governance.length) {
      parts.push(kvSection(EVIDENCE_SECTION_TITLES.governance, sectionItems.governance));
    }
    if (sectionItems.allocation_basis.length) {
      parts.push(
        kvSection(
          EVIDENCE_SECTION_TITLES.allocation_basis,
          sectionItems.allocation_basis,
        ),
      );
    }
    if (sectionItems.workload.length) {
      parts.push(kvSection(EVIDENCE_SECTION_TITLES.workload, sectionItems.workload));
    }
    if (sectionItems.default.length) {
      parts.push(kvSection("Evidence Summary", sectionItems.default));
    }
    return parts.join("");
  }

  function formatTraceabilityDisplayValue(row) {
    if (!row) return "--";
    const type = String(row.value_type || "").toLowerCase();
    if (type === "currency") return formatMoney(row.value_numeric);
    if (type === "percent") return formatPercent(row.value_numeric);
    if (type === "text") return text(row.value_text);
    if (
      row.value_text !== null &&
      row.value_text !== undefined &&
      row.value_text !== ""
    ) {
      return text(row.value_text);
    }
    return formatNumber(row.value_numeric);
  }

  function getTraceabilityDrillButtonLabel(row) {
    const moduleLabel = String(row?.source_module_label || "").trim();
    if (moduleLabel) return `Open ${moduleLabel}`;
    return "Open source module";
  }

  function renderTraceabilityDrillSection(row) {
    if (!canNavigateTraceabilityDrill?.(row)) return "";

    const lensId = row.drill_route_lens_id || row.source_lens_id;
    const lensHint = lensId
      ? `<div class="cp-muted-text cost-sheet-drill-lens">Lens: ${text(lensId)}</div>`
      : "";

    return `<section class="cp-detail-section cost-sheet-drill-section">
      <h3 class="cp-section-title">Source Module</h3>
      <div class="cost-sheet-drill-actions">
        <button
          type="button"
          class="icon-btn icon-btn-primary cost-sheet-drill-btn"
          data-traceability-drill="true"
        >${text(getTraceabilityDrillButtonLabel(row))}</button>
      </div>
      ${lensHint}
    </section>`;
  }

  function showExplainDrillUnavailableMessage() {
    if (!costSheetExplainContent) return;
    const existing = costSheetExplainContent.querySelector(
      "#costSheetExplainDrillStatus",
    );
    if (existing) existing.remove();
    costSheetExplainContent.insertAdjacentHTML(
      "afterbegin",
      '<div id="costSheetExplainDrillStatus" class="status" style="margin-bottom:10px">Source module navigation is not available for this line.</div>',
    );
  }

  async function handleTraceabilityDrillback() {
    const row = currentExplainTraceabilityRow;
    if (!row || !navigateTraceabilityDrill) {
      showExplainDrillUnavailableMessage();
      return;
    }

    if (!canNavigateTraceabilityDrill?.(row)) {
      console.warn("[costing-suite] traceability drillback unavailable", row);
      showExplainDrillUnavailableMessage();
      return;
    }

    const navigated = await navigateTraceabilityDrill(row, {
      onBeforeNavigate: () => {
        closeCostSheetExplainDrawer();
        closeCostSheetModal();
      },
    });

    if (!navigated) {
      showExplainDrillUnavailableMessage();
    }
  }

  function renderExplainContextSection(row, fallback = {}) {
    const period =
      row?.period_start || fallback.periodStart || fallback.period_start || "";
    const valuation =
      row?.valuation_date ||
      fallback.valuationDate ||
      fallback.valuation_date ||
      "";
    const runRaw =
      row?.refresh_run_id ?? fallback.refreshRunId ?? fallback.refresh_run_id;
    const runNum = Number(runRaw);
    const items = [
      period ? ["Period", text(formatPeriodMonth(period))] : null,
      valuation
        ? ["Valuation", text(formatMonthlyDriverDateOnly(valuation) || valuation)]
        : null,
      runRaw != null && runRaw !== ""
        ? [
            "Run",
            text(Number.isFinite(runNum) ? String(runNum) : String(runRaw)),
          ]
        : null,
    ].filter(Boolean);
    if (!items.length) return "";
    return kvSection("Context", items);
  }

  function renderCostSheetExplainContent(row, fallback = {}) {
    const isQcOverhead = isQualityControlOverheadExplainLine(row);
    const isMsOverhead = isMaterialsStoresOverheadExplainLine(row);
    const rawCalculationText = row.trace_formula || row.calculation_basis;
    let calculationText = rawCalculationText;
    let explanationSummary = row.trace_summary || row.line_description;
    let sourceNote = row.source_note;
    let sourceLineage = row.trace_source_snapshot;
    if (isQcOverhead) {
      calculationText = resolveQcOverheadCalculationLineage(rawCalculationText);
      explanationSummary = scrubObsoleteQcSalesShareText(explanationSummary);
      sourceNote = row.source_note
        ? scrubObsoleteQcSalesShareText(row.source_note)
        : row.source_note;
    } else if (isMsOverhead) {
      calculationText = resolveMsOverheadCalculation(rawCalculationText);
      explanationSummary = resolveMsOverheadDescription(explanationSummary);
      sourceNote = resolveMsOverheadSourceNote(row.source_note);
      sourceLineage = resolveMsOverheadSourceLineage(row.trace_source_snapshot);
    }
    const sourceItems = [
      sourceNote
        ? ["Source Note", text(sourceNote)]
        : null,
      row.trace_source_type
        ? ["Source Type", text(row.trace_source_type)]
        : null,
      sourceLineage
        ? ["Source Snapshot", text(sourceLineage)]
        : null,
      row.source_module_label
        ? ["Source Module", text(row.source_module_label)]
        : null,
    ].filter(Boolean);

    const technicalParts = [];
    if (row.source_module_key) technicalParts.push(text(row.source_module_key));
    if (row.source_lens_id) technicalParts.push(text(row.source_lens_id));
    const sourceTechnical = technicalParts.length
      ? `<div class="cp-muted-text" style="font-size:11px;margin-top:6px">${technicalParts.join(" · ")}</div>`
      : "";

    const auditItems = [
      row.audit_hint ? ["Audit Hint", text(row.audit_hint)] : null,
      row.control_hint ? ["Control Hint", text(row.control_hint)] : null,
    ].filter(Boolean);

    const refreshItems = [
      row.refresh_stage_code
        ? ["Refresh Stage", text(row.refresh_stage_code)]
        : null,
      row.evidence_refreshed_at
        ? ["Evidence Refreshed", formatDateTime(row.evidence_refreshed_at)]
        : null,
      row.refreshed_at
        ? ["Refreshed At", formatDateTime(row.refreshed_at)]
        : null,
    ].filter(Boolean);

    return detailPanel([
      renderExplainContextSection(row, fallback),
      kvSection("Displayed Value", [
        ["Value", formatTraceabilityDisplayValue(row)],
        row.value_type ? ["Value Type", text(row.value_type)] : null,
      ].filter(Boolean)),
      explanationSummary
        ? kvSection("Explanation", [["Summary", text(explanationSummary)]])
        : "",
      calculationText
        ? kvSection("How This Value Is Calculated", [
            ["Calculation", text(calculationText)],
          ])
        : "",
      sourceItems.length
        ? `${kvSection("Source", sourceItems)}${sourceTechnical}`
        : sourceTechnical,
      renderEvidenceSummary(row.evidence_json, {
        scrubObsoleteQcSalesShare: isQcOverhead,
        scrubObsoleteMsSalesShare: isMsOverhead,
        omitDisplayValueEvidence: isMsOverhead,
      }),
      renderTraceabilityDrillSection(row),
      auditItems.length ? kvSection("Audit / Control", auditItems) : "",
      refreshItems.length ? kvSection("Refresh", refreshItems) : "",
    ]);
  }

  function getCostSheetExplainBtn() {
    return document.getElementById("costSheetExplainBtn");
  }

  function buildCostSheetExplainContext(valueRow, line, sku, explainContext = {}) {
    const skuId = valueRow?.sku_id ?? sku?.sku_id;
    const productId = valueRow?.product_id ?? explainContext.productId;
    const periodStart = valueRow?.period_start ?? explainContext.periodStart;
    const valuationDate =
      normalizePrintableDateOnly(
        valueRow?.valuation_date ??
          valueRow?.valuationDate ??
          explainContext.valuationDate ??
          explainContext.valuation_date,
      ) || undefined;
    const refreshRunRaw =
      valueRow?.refresh_run_id ??
      valueRow?.refreshRunId ??
      explainContext.refreshRunId ??
      explainContext.refresh_run_id;
    const refreshRunNum = Number(refreshRunRaw);
    const refreshRunId = Number.isFinite(refreshRunNum)
      ? refreshRunNum
      : refreshRunRaw != null && refreshRunRaw !== ""
        ? refreshRunRaw
        : undefined;
    const lineLabel = valueRow?.line_label ?? line?.line_label;
    const sectionCode = valueRow?.section_code ?? line?.section_code ?? "";
    const lineOrder = valueRow?.line_order ?? line?.line_order;
    const skuLabel =
      sku?.label || valueRow?.sku_column_label || skuId || "";

    if (
      skuId == null ||
      skuId === "" ||
      productId == null ||
      !periodStart ||
      !lineLabel
    ) {
      return null;
    }

    return {
      periodStart,
      valuationDate,
      refreshRunId,
      productId: Number(productId),
      skuId: Number(skuId),
      sectionCode: sectionCode || undefined,
      lineOrder:
        lineOrder != null && lineOrder !== "" ? Number(lineOrder) : undefined,
      lineLabel,
      skuLabel: String(skuLabel),
    };
  }

  function buildExplainableValueCellAttrs(context) {
    if (!context) return "";
    return `data-explain-enabled="true"
      data-explain-period-start="${attr(context.periodStart)}"
      data-explain-valuation-date="${attr(context.valuationDate ?? "")}"
      data-explain-refresh-run-id="${attr(context.refreshRunId ?? "")}"
      data-explain-product-id="${attr(context.productId)}"
      data-explain-sku-id="${attr(context.skuId)}"
      data-explain-section-code="${attr(context.sectionCode ?? "")}"
      data-explain-line-order="${attr(context.lineOrder ?? "")}"
      data-explain-line-label="${attr(context.lineLabel)}"
      data-explain-sku-label="${attr(context.skuLabel)}"
      tabindex="0"
      role="button"
      aria-label="Select ${attr(context.lineLabel)} for explanation"`;
  }

  function parseExplainContextFromCell(cell) {
    const lineOrderRaw = cell.dataset.explainLineOrder;
    const refreshRunRaw = cell.dataset.explainRefreshRunId;
    const refreshRunNum = Number(refreshRunRaw);
    return {
      periodStart: cell.dataset.explainPeriodStart,
      valuationDate: cell.dataset.explainValuationDate || undefined,
      refreshRunId:
        refreshRunRaw !== undefined && refreshRunRaw !== ""
          ? Number.isFinite(refreshRunNum)
            ? refreshRunNum
            : refreshRunRaw
          : undefined,
      productId: Number(cell.dataset.explainProductId),
      skuId: Number(cell.dataset.explainSkuId),
      sectionCode: cell.dataset.explainSectionCode || undefined,
      lineOrder:
        lineOrderRaw !== undefined && lineOrderRaw !== ""
          ? Number(lineOrderRaw)
          : undefined,
      lineLabel: cell.dataset.explainLineLabel,
      skuLabel: cell.dataset.explainSkuLabel || "",
    };
  }

  function clearCostSheetExplainSelection() {
    if (selectedExplainCell) {
      selectedExplainCell.classList.remove("cost-sheet-value-cell-selected");
      selectedExplainCell
        .closest("tr")
        ?.classList.remove("cost-sheet-row-selected");
    }
    selectedExplainContext = null;
    selectedExplainCell = null;
    syncCostSheetExplainToolbar();
  }

  function syncCostSheetExplainToolbar() {
    const btn = getCostSheetExplainBtn();
    if (!btn) return;

    const hasSelection = Boolean(selectedExplainContext);
    btn.disabled = !hasSelection;
    btn.setAttribute("aria-disabled", hasSelection ? "false" : "true");

    if (hasSelection) {
      const label = selectedExplainContext.lineLabel || "line";
      const sku =
        selectedExplainContext.skuLabel ||
        selectedExplainContext.skuId ||
        "SKU";
      btn.title = `Explain ${label} for ${sku}`;
    } else {
      btn.title = "Select a value cell to explain";
    }
  }

  function selectCostSheetExplainCell(cell) {
    if (!cell) return;

    const context = parseExplainContextFromCell(cell);
    if (
      !context.periodStart ||
      !context.productId ||
      !context.skuId ||
      !context.lineLabel
    ) {
      return;
    }

    clearCostSheetExplainSelection();

    selectedExplainContext = context;
    selectedExplainCell = cell;
    cell.classList.add("cost-sheet-value-cell-selected");
    cell.closest("tr")?.classList.add("cost-sheet-row-selected");
    syncCostSheetExplainToolbar();
  }

  function closeCostSheetExplainDrawer() {
    if (!costSheetExplainDrawer) return;

    costSheetExplainLoadToken += 1;

    const active = document.activeElement;
    if (active && costSheetExplainDrawer.contains(active)) {
      active.blur();
    }

    costSheetExplainDrawer.classList.add("hidden");
    costSheetExplainDrawer.setAttribute("aria-hidden", "true");
    if (costSheetExplainContent) costSheetExplainContent.innerHTML = "";
    if (costSheetExplainSubtitle) costSheetExplainSubtitle.innerHTML = "";
    currentExplainTraceabilityRow = null;

    const returnTarget =
      costSheetExplainReturnFocus &&
      costSheetExplainReturnFocus !== document.body &&
      document.contains(costSheetExplainReturnFocus)
        ? costSheetExplainReturnFocus
        : null;

    costSheetExplainReturnFocus = null;

    if (returnTarget && typeof returnTarget.focus === "function") {
      setTimeout(() => returnTarget.focus(), 0);
    }
  }

  function setCostSheetExplainHeader(row, fallback = {}) {
    if (costSheetExplainTitle) {
      costSheetExplainTitle.textContent =
        row?.line_label || fallback.lineLabel || "Explain Line";
    }
    if (!costSheetExplainSubtitle) return;

    const isMsOverhead = isMaterialsStoresOverheadExplainLine({
      line_label: row?.line_label,
      lineLabel: fallback.lineLabel,
    });
    const statusBadge = row?.cost_sheet_status
      ? isMsOverhead
        ? `<span class="cp-ms-overall-status"><span class="cp-muted-text">Overall Cost Sheet status</span> ${statusChip(normalizeStatus(row.cost_sheet_status))}</span>`
        : statusChip(normalizeStatus(row.cost_sheet_status))
      : "";
    const productName = row?.product_name || fallback.productName || "";
    const skuLabel =
      row?.sku_column_label || row?.sku_id || fallback.skuLabel || "";
    const period = row?.period_start || fallback.periodStart || "";
    const valuation =
      row?.valuation_date || fallback.valuationDate || fallback.valuation_date || "";
    const runRaw =
      row?.refresh_run_id ?? fallback.refreshRunId ?? fallback.refresh_run_id;
    const runNum = Number(runRaw);
    const valuationBit = valuation
      ? `<span class="cs-sep">·</span><span>Valuation ${text(formatMonthlyDriverDateOnly(valuation) || valuation)}</span>`
      : "";
    const runBit =
      runRaw != null && runRaw !== ""
        ? `<span class="cs-sep">·</span><span>Run ${text(Number.isFinite(runNum) ? String(runNum) : String(runRaw))}</span>`
        : "";

    costSheetExplainSubtitle.innerHTML = `
      <span>${text(productName)}</span>
      <span class="cs-sep">·</span>
      <span>${text(skuLabel)}</span>
      <span class="cs-sep">·</span>
      <span>${formatPeriodMonth(period)}</span>
      ${valuationBit}
      ${runBit}
      ${statusBadge}`;
  }

  function setCostSheetExplainLoading(fallback = {}) {
    if (costSheetExplainTitle) {
      costSheetExplainTitle.textContent = fallback.lineLabel || "Explain Line";
    }
    if (costSheetExplainSubtitle) {
      costSheetExplainSubtitle.innerHTML = `<span>Loading traceability...</span>`;
    }
    if (costSheetExplainContent) {
      costSheetExplainContent.innerHTML = `<div class="cost-sheet-explain-loading"><span class="cp-loading-spinner" aria-hidden="true"></span><span>Loading traceability...</span></div>`;
    }
  }

  function isRawMaterialCostExplainLine(params = {}) {
    const label = normalizeCostSheetDisplayLabel(params.lineLabel);
    return label === "Raw Material Cost (RM)";
  }

  /**
   * Allocation-driven cost lines eligible for monthly-driver lineage.
   * No unique component code exists per line on the trace row (section_code is
   * shared across COP lines), so eligibility uses normalized line_label.
   */
  const MONTHLY_ALLOCATION_DRIVER_LINE_LABELS = new Set([
    "direct labour",
    "direct labour (dl)",
    "production overhead",
    "quality control overhead",
    "materials / stores overhead",
    "administrative overhead",
    "admin overhead",
    "finance admin overhead",
    "finance-administration overhead",
    "finance administration overhead",
    "marketing expense",
  ]);

  const MONTHLY_DRIVER_CODE_LABELS = {
    ACTUAL_MONTHLY_MAX: "Actual monthly max",
    GOVERNED_SKU_ASSUMPTION: "Governed SKU assumption",
    GOVERNED_SCENARIO_DEFAULT: "Governed scenario default",
    MANUAL_ASSUMPTION: "Manual assumption",
    DEFAULT_NEW_SKU_EXISTING_PRODUCT: "Default — new SKU, existing product",
    DEFAULT_NEW_PRODUCT_NO_HISTORY: "Default — new product, no history",
    NEW_SKU_EXISTING_PRODUCT: "New SKU, existing product",
    NEW_PRODUCT_NO_HISTORY: "New product, no history",
    READY: "Ready",
    REVIEW_REQUIRED: "Review required",
    BLOCKED: "Blocked",
  };

  function isBlankDriverValue(value) {
    return value === null || value === undefined || value === "";
  }

  function isMonthlyAllocationDriverExplainLine(rowOrParams = {}) {
    const raw =
      rowOrParams.line_label ??
      rowOrParams.lineLabel ??
      rowOrParams?.params?.lineLabel ??
      "";
    const label = normalizeCostSheetDisplayLabel(raw).trim().toLowerCase();
    return MONTHLY_ALLOCATION_DRIVER_LINE_LABELS.has(label);
  }

  function humanizeMonthlyDriverCode(code) {
    if (isBlankDriverValue(code)) return null;
    const raw = String(code).trim();
    if (!raw) return null;
    const mapped = MONTHLY_DRIVER_CODE_LABELS[raw];
    if (mapped) return text(mapped);
    return text(raw);
  }

  function formatMonthlyDriverStatus(code) {
    if (isBlankDriverValue(code)) return null;
    const raw = String(code).trim();
    if (!raw) return null;
    const upper = raw.toUpperCase();
    if (
      upper === "READY" ||
      upper === "REVIEW_REQUIRED" ||
      upper === "BLOCKED"
    ) {
      return statusChip(normalizeStatus(raw));
    }
    return humanizeMonthlyDriverCode(raw);
  }

  /**
   * Display-only: decimal ratio → percent with adaptive precision.
   * Does not alter or persist the underlying ratio.
   */
  function formatAllocationShareRatio(value) {
    if (isBlankDriverValue(value)) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return text(value);
    const pct = n * 100;
    const abs = Math.abs(pct);
    const digits = abs >= 1 ? 2 : abs >= 0.01 ? 3 : 4;
    return `${pct.toLocaleString("en-IN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}%`;
  }

  function formatDriverNumber(value) {
    if (isBlankDriverValue(value)) return null;
    return formatNumber(value);
  }

  /**
   * Display-only date formatter for PostgreSQL date values.
   * Parses YYYY-MM-DD without constructing a local midnight Date (avoids TZ shift).
   */
  function formatMonthlyDriverDateOnly(value) {
    if (isBlankDriverValue(value)) return null;
    const raw = String(value).trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (!match) return text(raw);
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
      return text(raw);
    }
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }

  function formatDriverDate(value) {
    return formatMonthlyDriverDateOnly(value);
  }

  function pushDriverKv(items, label, valueHtml) {
    if (valueHtml == null || valueHtml === "") return;
    items.push([label, valueHtml]);
  }

  function getMonthlyAllocationDriverTuple(row) {
    if (!row) return null;
    const period_start = String(row.period_start ?? "").trim();
    const valuation_date = String(row.valuation_date ?? "").trim();
    const refresh_run_id = row.refresh_run_id;
    const sku_id = row.sku_id;
    if (
      !period_start ||
      !valuation_date ||
      refresh_run_id == null ||
      refresh_run_id === "" ||
      sku_id == null ||
      sku_id === ""
    ) {
      return null;
    }
    const runId = Number(refresh_run_id);
    const skuNum = Number(sku_id);
    if (!Number.isFinite(runId) || !Number.isFinite(skuNum)) return null;
    return {
      period_start,
      valuation_date,
      refresh_run_id: runId,
      sku_id: skuNum,
    };
  }

  function monthlyAllocationDriverCacheKey(tuple) {
    return `${tuple.period_start}|${tuple.valuation_date}|${tuple.refresh_run_id}|${tuple.sku_id}`;
  }

  function clearMonthlyAllocationDriverTraceCache() {
    monthlyAllocationDriverTraceCache.clear();
  }

  async function loadMonthlyAllocationDriverTrace(tuple) {
    if (!tuple || typeof costingRpc !== "function") return null;
    const { data, error } = await costingRpc(
      "rpc_get_monthly_allocation_driver_trace",
      {
        p_period_start: tuple.period_start,
        p_valuation_date: tuple.valuation_date,
        p_refresh_run_id: tuple.refresh_run_id,
        p_sku_id: tuple.sku_id,
      },
    );
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row || null;
  }

  function renderMonthlyAllocationDriverStateMessage(message) {
    return `<section class="cp-detail-section cp-monthly-driver-trace" id="cpMonthlyDriverTraceHost" data-monthly-driver-trace="true">
      <h3 class="cp-section-title">Monthly Allocation Driver</h3>
      <div class="status cp-monthly-driver-trace-status">${text(message)}</div>
    </section>`;
  }

  function renderMonthlyAllocationDriverLoading() {
    return `<section class="cp-detail-section cp-monthly-driver-trace" id="cpMonthlyDriverTraceHost" data-monthly-driver-trace="true">
      <h3 class="cp-section-title">Monthly Allocation Driver</h3>
      <div class="cost-sheet-explain-loading cp-monthly-driver-trace-loading">
        <span class="cp-loading-spinner" aria-hidden="true"></span>
        <span>Loading monthly allocation-driver lineage…</span>
      </div>
    </section>`;
  }

  function renderMonthlyAllocationDriverSection(trace) {
    if (!trace) {
      return renderMonthlyAllocationDriverStateMessage(
        "No monthly allocation-driver snapshot was found for this exact costing run.",
      );
    }

    const decision = [];
    pushDriverKv(
      decision,
      "Method",
      humanizeMonthlyDriverCode(trace.monthly_driver_method),
    );
    pushDriverKv(
      decision,
      "Source",
      humanizeMonthlyDriverCode(trace.monthly_driver_source),
    );
    pushDriverKv(
      decision,
      "Status",
      formatMonthlyDriverStatus(trace.monthly_driver_status),
    );
    pushDriverKv(
      decision,
      "Monthly SKU units",
      formatDriverNumber(trace.monthly_allocation_units),
    );
    pushDriverKv(
      decision,
      "Monthly SKU base quantity",
      formatDriverNumber(trace.monthly_allocation_base_qty),
    );
    pushDriverKv(
      decision,
      "Monthly product units",
      formatDriverNumber(trace.monthly_product_allocation_units),
    );
    pushDriverKv(
      decision,
      "Monthly company units",
      formatDriverNumber(trace.monthly_company_allocation_units),
    );
    pushDriverKv(
      decision,
      "Product allocation share",
      formatAllocationShareRatio(trace.monthly_product_allocation_share),
    );
    pushDriverKv(
      decision,
      "Valuation date",
      formatDriverDate(trace.valuation_date),
    );
    pushDriverKv(
      decision,
      "Refresh run",
      formatDriverNumber(trace.refresh_run_id),
    );

    const evidence = [];
    pushDriverKv(
      evidence,
      "Historical SKU units — 12 months",
      formatDriverNumber(trace.actual_sales_units_12m),
    );
    pushDriverKv(
      evidence,
      "Historical SKU base quantity — 12 months",
      formatDriverNumber(trace.actual_sales_base_qty_12m),
    );
    pushDriverKv(
      evidence,
      "Historical product units — 12 months",
      formatDriverNumber(trace.actual_product_sales_units_12m),
    );
    pushDriverKv(
      evidence,
      "Historical product base quantity — 12 months",
      formatDriverNumber(trace.actual_product_sales_base_qty_12m),
    );
    pushDriverKv(
      evidence,
      "Historical company units — 12 months",
      formatDriverNumber(trace.actual_company_sales_units_12m),
    );
    {
      const start = formatDriverDate(trace.monthly_driver_lookback_start);
      const end = formatDriverDate(trace.monthly_driver_lookback_end);
      if (start && end) {
        pushDriverKv(evidence, "Lookback period", `${start} – ${end}`);
      } else if (start) {
        pushDriverKv(evidence, "Lookback period", start);
      } else if (end) {
        pushDriverKv(evidence, "Lookback period", end);
      }
    }
    pushDriverKv(
      evidence,
      "Source month",
      formatDriverDate(trace.monthly_driver_source_month),
    );
    pushDriverKv(
      evidence,
      "Tied-month count",
      formatDriverNumber(trace.monthly_driver_tied_month_count),
    );
    pushDriverKv(
      evidence,
      "Driver note",
      isBlankDriverValue(trace.monthly_driver_note)
        ? null
        : text(trace.monthly_driver_note),
    );

    const governance = [];
    if (!isBlankDriverValue(trace.assumption_id)) {
      pushDriverKv(
        governance,
        "Assumption ID",
        formatDriverNumber(trace.assumption_id),
      );
      pushDriverKv(
        governance,
        "Assumption basis",
        humanizeMonthlyDriverCode(trace.assumption_basis),
      );
      pushDriverKv(
        governance,
        "Effective from",
        formatDriverDate(trace.assumption_effective_from),
      );
      pushDriverKv(
        governance,
        "Effective to",
        formatDriverDate(trace.assumption_effective_to),
      );
    }
    if (!isBlankDriverValue(trace.default_policy_id)) {
      pushDriverKv(
        governance,
        "Default policy ID",
        formatDriverNumber(trace.default_policy_id),
      );
      pushDriverKv(
        governance,
        "Scenario",
        humanizeMonthlyDriverCode(trace.default_policy_scenario),
      );
      pushDriverKv(
        governance,
        "Effective from",
        formatDriverDate(trace.default_policy_effective_from),
      );
      pushDriverKv(
        governance,
        "Effective to",
        formatDriverDate(trace.default_policy_effective_to),
      );
    }
    pushDriverKv(
      governance,
      "Allocation resolution status",
      formatMonthlyDriverStatus(trace.allocation_resolution_status) ||
        humanizeMonthlyDriverCode(trace.allocation_resolution_status),
    );
    pushDriverKv(
      governance,
      "Allocation resolution note",
      isBlankDriverValue(trace.allocation_resolution_note)
        ? null
        : text(trace.allocation_resolution_note),
    );

    const parts = [
      decision.length ? kvSection("Decision", decision) : "",
      evidence.length ? kvSection("Evidence", evidence) : "",
      governance.length ? kvSection("Governance", governance) : "",
    ].filter(Boolean);

    if (!parts.length) {
      return renderMonthlyAllocationDriverStateMessage(
        "No monthly allocation-driver snapshot was found for this exact costing run.",
      );
    }

    return `<section class="cp-detail-section cp-monthly-driver-trace" id="cpMonthlyDriverTraceHost" data-monthly-driver-trace="true">
      <h3 class="cp-section-title">Monthly Allocation Driver</h3>
      <div class="cp-monthly-driver-trace-body">${parts.join("")}</div>
    </section>`;
  }

  function replaceMonthlyAllocationDriverHost(html) {
    if (!costSheetExplainContent) return;
    const host = costSheetExplainContent.querySelector(
      "#cpMonthlyDriverTraceHost",
    );
    if (!host) return;
    host.outerHTML = html;
  }

  async function fillMonthlyAllocationDriverSection(row) {
    if (!row || !costSheetExplainContent) return;
    if (currentExplainTraceabilityRow !== row) return;

    const tuple = getMonthlyAllocationDriverTuple(row);
    if (!tuple) {
      replaceMonthlyAllocationDriverHost(
        renderMonthlyAllocationDriverStateMessage(
          "Monthly allocation-driver lineage is unavailable because the exact costing context is incomplete.",
        ),
      );
      return;
    }

    const cacheKey = monthlyAllocationDriverCacheKey(tuple);
    const cached = monthlyAllocationDriverTraceCache.get(cacheKey);
    if (cached) {
      if (currentExplainTraceabilityRow !== row) return;
      replaceMonthlyAllocationDriverHost(
        renderMonthlyAllocationDriverSection(cached),
      );
      return;
    }

    try {
      const trace = await loadMonthlyAllocationDriverTrace(tuple);
      if (currentExplainTraceabilityRow !== row) return;
      if (!trace) {
        replaceMonthlyAllocationDriverHost(
          renderMonthlyAllocationDriverStateMessage(
            "No monthly allocation-driver snapshot was found for this exact costing run.",
          ),
        );
        return;
      }
      monthlyAllocationDriverTraceCache.set(cacheKey, trace);
      replaceMonthlyAllocationDriverHost(
        renderMonthlyAllocationDriverSection(trace),
      );
    } catch (err) {
      console.warn(
        "[costing-suite] rpc_get_monthly_allocation_driver_trace failed",
        err,
      );
      if (currentExplainTraceabilityRow !== row) return;
      replaceMonthlyAllocationDriverHost(
        renderMonthlyAllocationDriverStateMessage(
          "Monthly allocation-driver lineage could not be loaded.",
        ),
      );
    }
  }

  /**
   * @typedef {Object} CostSheetMarketingExplainSummary
   * @property {string} [period_start]
   * @property {string|null} [valuation_date]
   * @property {number|null} [refresh_run_id]
   * @property {number} [product_id]
   * @property {number} [sku_id]
   * @property {string|null} [marketing_driver_code]
   * @property {string|null} [marketing_value_source]
   * @property {number|null} [actual_product_signed_billed_value]
   * @property {number|null} [actual_company_signed_billed_value]
   * @property {number|null} [resolved_product_marketing_sales_value]
   * @property {number|null} [resolved_company_marketing_sales_value]
   * @property {number|null} [marketing_assumption_id]
   * @property {number|null} [marketing_assumed_sales_value]
   * @property {string|null} [marketing_assumption_approval_reference]
   * @property {string|null} [marketing_assumption_effective_from]
   * @property {string|null} [marketing_assumption_effective_to]
   * @property {number|null} [product_monetary_allocation_share]
   * @property {number|null} [product_marketing_allocation]
   * @property {number|null} [recipient_product_base_qty]
   * @property {number|null} [sku_base_qty_per_unit]
   * @property {number|null} [marketing_expense_cost_per_sku]
   * @property {string|null} [marketing_lookback_start]
   * @property {string|null} [marketing_lookback_end]
   * @property {string|null} [marketing_source_cutoff_at]
   * @property {number|null} [marketing_evidence_row_count]
   * @property {string|null} [marketing_evidence_status]
   * @property {string|null} [allocation_basis_source]
   * @property {string|null} [allocation_resolution_status]
   * @property {string|null} [allocation_resolution_note]
   * @property {string|null} [marketing_expense_allocation_status]
   * @property {string|null} [marketing_expense_allocation_note]
   * @property {string|null} [summary_status]
   * @property {string|null} [snapshot_refreshed_at]
   */

  const MARKETING_DRIVER_CODE_LABELS = {
    MARKETING_SIGNED_BILLED_SALES_VALUE: "Signed Billed Sales Value",
  };

  const MARKETING_VALUE_SOURCE_LABELS = {
    ACTUAL_SIGNED_BILLED_SALES: "Actual signed billed sales",
    APPROVED_MONETARY_ASSUMPTION: "Approved monetary assumption",
    NO_ELIGIBLE_HISTORY: "No eligible sales history",
  };

  const MARKETING_STATUS_LABELS = {
    READY: "Ready",
    REVIEW_REQUIRED: "Review required",
    BLOCKED: "Blocked",
    NO_CURRENT_SUCCESSFUL_RUN: "No current successful run",
    NO_TRACE_DATA: "No trace data",
    UNKNOWN: "Unknown",
    APPROVED_ASSUMPTION_NO_ACTUAL_HISTORY:
      "Approved assumption — no actual history",
    MANUAL_ASSUMPTION: "Manual assumption",
  };

  function isMarketingExpenseExplainLine(rowOrParams = {}) {
    const raw =
      rowOrParams.line_label ??
      rowOrParams.lineLabel ??
      rowOrParams?.params?.lineLabel ??
      "";
    const label = normalizeCostSheetDisplayLabel(raw).trim().toLowerCase();
    return label === "marketing expense";
  }

  function humanizeMarketingCode(code, map) {
    if (isBlankDriverValue(code)) return null;
    const raw = String(code).trim();
    if (!raw) return null;
    const mapped = map[raw] || map[raw.toUpperCase()];
    if (mapped) return text(mapped);
    return text(raw);
  }

  function formatMarketingStatus(code) {
    if (isBlankDriverValue(code)) return null;
    const raw = String(code).trim();
    if (!raw) return null;
    const upper = raw.toUpperCase();
    if (
      upper === "READY" ||
      upper === "REVIEW_REQUIRED" ||
      upper === "BLOCKED"
    ) {
      return statusChip(normalizeStatus(raw));
    }
    return humanizeMarketingCode(raw, MARKETING_STATUS_LABELS);
  }

  /** Null-aware money; zero is a valid displayed value. */
  function formatMarketingMoney(value) {
    if (value === null || value === undefined || value === "") return null;
    return formatMoney(value);
  }

  /** Null-aware number; zero is a valid displayed value. */
  function formatMarketingNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    return formatNumber(value);
  }

  /** Higher-precision display aid for formula reconciliation only. */
  function formatMarketingReconcileNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return text(value);
    return n.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 10,
    });
  }

  function getMarketingExplainTuple(row) {
    if (!row) return null;
    const period_start = String(row.period_start ?? "").trim();
    const product_id = Number(row.product_id);
    const sku_id = Number(row.sku_id);
    if (
      !period_start ||
      !Number.isFinite(product_id) ||
      !Number.isFinite(sku_id)
    ) {
      return null;
    }
    return { period_start, product_id, sku_id };
  }

  function marketingExplainCacheKey(tuple) {
    return `${tuple.period_start}|${tuple.product_id}|${tuple.sku_id}`;
  }

  function marketingExplainRequestIdentity(row) {
    const tuple = getMarketingExplainTuple(row);
    if (!tuple) return null;
    const label = normalizeCostSheetDisplayLabel(row.line_label ?? "")
      .trim()
      .toLowerCase();
    return `${marketingExplainCacheKey(tuple)}|${label || "marketing expense"}`;
  }

  function clearMarketingExplainSummaryCache() {
    marketingExplainSummaryCache.clear();
  }

  function isMarketingExplainResponseCurrent(row, requestIdentity) {
    if (!costSheetExplainContent || !row || !requestIdentity) return false;
    if (!currentExplainTraceabilityRow) return false;
    if (currentExplainTraceabilityRow !== row) return false;
    const currentIdentity = marketingExplainRequestIdentity(
      currentExplainTraceabilityRow,
    );
    if (!currentIdentity || currentIdentity !== requestIdentity) return false;
    const currentTuple = getMarketingExplainTuple(currentExplainTraceabilityRow);
    const requestTuple = getMarketingExplainTuple(row);
    if (!currentTuple || !requestTuple) return false;
    if (
      currentTuple.period_start !== requestTuple.period_start ||
      currentTuple.product_id !== requestTuple.product_id ||
      currentTuple.sku_id !== requestTuple.sku_id
    ) {
      return false;
    }
    return Boolean(
      costSheetExplainContent.querySelector("#cpMarketingExplainHost"),
    );
  }

  /**
   * @returns {CostSheetMarketingExplainSummary|null}
   */
  function normalizeMarketingExplainRpcRow(data) {
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

  async function loadMarketingExplainSummary(tuple) {
    if (!tuple || typeof costingRpc !== "function") return null;
    const { data, error } = await costingRpc(
      "rpc_get_cost_sheet_marketing_explain_summary",
      {
        p_period_start: tuple.period_start,
        p_product_id: tuple.product_id,
        p_sku_id: tuple.sku_id,
      },
    );
    if (error) throw error;
    return normalizeMarketingExplainRpcRow(data);
  }

  function renderMarketingExplainStateMessage(message, extraClass = "") {
    const cls = ["status", "cp-marketing-explain-status", extraClass]
      .filter(Boolean)
      .join(" ");
    return `<section class="cp-detail-section cp-marketing-explain" id="cpMarketingExplainHost" data-marketing-explain="true">
      <h3 class="cp-section-title">Marketing Allocation Explanation</h3>
      <div class="${cls}" role="status">${text(message)}</div>
    </section>`;
  }

  function renderMarketingExplainLoading() {
    return `<section class="cp-detail-section cp-marketing-explain" id="cpMarketingExplainHost" data-marketing-explain="true">
      <h3 class="cp-section-title">Marketing Allocation Explanation</h3>
      <div class="cost-sheet-explain-loading cp-marketing-explain-loading">
        <span class="cp-loading-spinner" aria-hidden="true"></span>
        <span>Loading Marketing allocation explanation…</span>
      </div>
    </section>`;
  }

  function renderMarketingExplainEmptyStatus(summaryStatus) {
    const status = String(summaryStatus || "UNKNOWN").trim().toUpperCase();
    if (status === "NO_CURRENT_SUCCESSFUL_RUN") {
      return renderMarketingExplainStateMessage(
        "No current successful costing run is available for Marketing allocation explanation on the selected period, product and SKU.",
        "cp-marketing-explain-empty",
      );
    }
    if (status === "NO_TRACE_DATA") {
      return renderMarketingExplainStateMessage(
        "No Marketing allocation trace was found for the selected product, SKU and current costing run.",
        "cp-marketing-explain-empty",
      );
    }
    if (status === "UNKNOWN" || !status) {
      return renderMarketingExplainStateMessage(
        "Marketing allocation explanation is unavailable for this selection.",
        "cp-marketing-explain-empty",
      );
    }
    return null;
  }

  function renderMarketingReconcileFormula(summary) {
    const allocation = formatMarketingReconcileNumber(
      summary.product_marketing_allocation,
    );
    const recipientQty = formatMarketingReconcileNumber(
      summary.recipient_product_base_qty,
    );
    const skuQty = formatMarketingReconcileNumber(
      summary.sku_base_qty_per_unit,
    );
    const perSku = formatMarketingReconcileNumber(
      summary.marketing_expense_cost_per_sku,
    );
    if (!allocation || !recipientQty || !skuQty || !perSku) return "";
    return `<div class="cp-marketing-explain-formula" role="note">
      <div class="cp-marketing-explain-formula-title">Reconciliation</div>
      <div class="cp-marketing-explain-formula-body">
        <div>Product Marketing allocation&nbsp;&nbsp;${allocation}</div>
        <div>÷ Recipient product base quantity&nbsp;&nbsp;${recipientQty}</div>
        <div>× SKU base quantity per unit&nbsp;&nbsp;${skuQty}</div>
        <div>= Marketing expense per SKU&nbsp;&nbsp;${perSku}</div>
        <div class="cp-marketing-explain-formula-note">Authoritative per-SKU amount is the server field marketing_expense_cost_per_sku.</div>
      </div>
    </div>`;
  }

  /**
   * @param {CostSheetMarketingExplainSummary} summary
   */
  function renderMarketingExplainSection(summary) {
    if (!summary) {
      return renderMarketingExplainStateMessage(
        "Marketing allocation explanation is unavailable for this selection.",
      );
    }

    const summaryStatus = String(summary.summary_status || "")
      .trim()
      .toUpperCase();
    const emptyOnly = renderMarketingExplainEmptyStatus(summaryStatus);
    if (emptyOnly) return emptyOnly;

    const driver = [];
    pushDriverKv(
      driver,
      "Driver",
      humanizeMarketingCode(
        summary.marketing_driver_code,
        MARKETING_DRIVER_CODE_LABELS,
      ),
    );
    pushDriverKv(
      driver,
      "Value source",
      humanizeMarketingCode(
        summary.marketing_value_source,
        MARKETING_VALUE_SOURCE_LABELS,
      ),
    );

    const monetary = [];
    pushDriverKv(
      monetary,
      "Actual product signed billed value",
      formatMarketingMoney(summary.actual_product_signed_billed_value),
    );
    pushDriverKv(
      monetary,
      "Actual eligible company signed billed value",
      formatMarketingMoney(summary.actual_company_signed_billed_value),
    );
    pushDriverKv(
      monetary,
      "Resolved product Marketing value",
      formatMarketingMoney(summary.resolved_product_marketing_sales_value),
    );
    pushDriverKv(
      monetary,
      "Resolved company Marketing value",
      formatMarketingMoney(summary.resolved_company_marketing_sales_value),
    );
    pushDriverKv(
      monetary,
      "Product monetary allocation share",
      formatAllocationShareRatio(summary.product_monetary_allocation_share),
    );

    const allocation = [];
    pushDriverKv(
      allocation,
      "Product Marketing allocation",
      formatMarketingMoney(summary.product_marketing_allocation),
    );
    pushDriverKv(
      allocation,
      "Recipient product base quantity",
      formatMarketingNumber(summary.recipient_product_base_qty),
    );
    pushDriverKv(
      allocation,
      "SKU base quantity per unit",
      formatMarketingNumber(summary.sku_base_qty_per_unit),
    );
    pushDriverKv(
      allocation,
      "Marketing expense per SKU",
      formatMarketingMoney(summary.marketing_expense_cost_per_sku),
    );

    const assumption = [];
    const isApprovedAssumption =
      String(summary.marketing_value_source || "").trim() ===
      "APPROVED_MONETARY_ASSUMPTION";
    if (isApprovedAssumption) {
      pushDriverKv(
        assumption,
        "Assumption ID",
        formatMarketingNumber(summary.marketing_assumption_id),
      );
      pushDriverKv(
        assumption,
        "Assumed sales value",
        formatMarketingMoney(summary.marketing_assumed_sales_value),
      );
      pushDriverKv(
        assumption,
        "Approval reference",
        isBlankDriverValue(summary.marketing_assumption_approval_reference)
          ? null
          : text(summary.marketing_assumption_approval_reference),
      );
      pushDriverKv(
        assumption,
        "Effective from",
        formatDriverDate(summary.marketing_assumption_effective_from),
      );
      pushDriverKv(
        assumption,
        "Effective to",
        formatDriverDate(summary.marketing_assumption_effective_to),
      );
      pushDriverKv(
        assumption,
        "Allocation basis source",
        humanizeMarketingCode(
          summary.allocation_basis_source,
          MARKETING_STATUS_LABELS,
        ),
      );
      pushDriverKv(
        assumption,
        "Review status",
        formatMarketingStatus("REVIEW_REQUIRED"),
      );
    }

    const frozen = [];
    pushDriverKv(
      frozen,
      "Lookback start",
      formatDriverDate(summary.marketing_lookback_start),
    );
    pushDriverKv(
      frozen,
      "Lookback end",
      formatDriverDate(summary.marketing_lookback_end),
    );
    pushDriverKv(
      frozen,
      "Source cutoff",
      isBlankDriverValue(summary.marketing_source_cutoff_at)
        ? null
        : formatDateTime(summary.marketing_source_cutoff_at),
    );
    pushDriverKv(
      frozen,
      "Valuation date",
      formatDriverDate(summary.valuation_date),
    );
    pushDriverKv(
      frozen,
      "Refresh run ID",
      formatMarketingNumber(summary.refresh_run_id),
    );
    pushDriverKv(
      frozen,
      "Snapshot refreshed time",
      isBlankDriverValue(summary.snapshot_refreshed_at)
        ? null
        : formatDateTime(summary.snapshot_refreshed_at),
    );

    const statusNotes = [];
    pushDriverKv(
      statusNotes,
      "Marketing evidence status",
      formatMarketingStatus(summary.marketing_evidence_status) ||
        humanizeMarketingCode(
          summary.marketing_evidence_status,
          MARKETING_STATUS_LABELS,
        ),
    );
    pushDriverKv(
      statusNotes,
      "Allocation resolution status",
      formatMarketingStatus(summary.allocation_resolution_status) ||
        humanizeMarketingCode(
          summary.allocation_resolution_status,
          MARKETING_STATUS_LABELS,
        ),
    );
    pushDriverKv(
      statusNotes,
      "Marketing allocation status",
      formatMarketingStatus(summary.marketing_expense_allocation_status) ||
        humanizeMarketingCode(
          summary.marketing_expense_allocation_status,
          MARKETING_STATUS_LABELS,
        ),
    );
    pushDriverKv(
      statusNotes,
      "Summary status",
      formatMarketingStatus(summary.summary_status) ||
        humanizeMarketingCode(summary.summary_status, MARKETING_STATUS_LABELS),
    );
    pushDriverKv(
      statusNotes,
      "Allocation resolution note",
      isBlankDriverValue(summary.allocation_resolution_note)
        ? null
        : text(summary.allocation_resolution_note),
    );
    pushDriverKv(
      statusNotes,
      "Marketing allocation note",
      isBlankDriverValue(summary.marketing_expense_allocation_note)
        ? null
        : text(summary.marketing_expense_allocation_note),
    );

    const blockedBanner =
      summaryStatus === "BLOCKED"
        ? `<div class="status cp-marketing-explain-blocked" role="status">Marketing allocation is blocked for this selection. Review the server notes below.</div>`
        : "";
    const reviewBanner =
      summaryStatus === "REVIEW_REQUIRED"
        ? `<div class="status cp-marketing-explain-review" role="status">Review required — values are shown for governance review and are not treated as invalid.</div>`
        : "";
    const assumptionNote = isApprovedAssumption
      ? `<div class="cp-marketing-explain-assumption-note" role="note">The approved monetary assumption is used because no eligible actual product sales exist. Eligible actual sales will supersede the assumption in a later governed refresh.</div>`
      : "";

    const parts = [
      blockedBanner,
      reviewBanner,
      driver.length ? kvSection("Driver", driver) : "",
      monetary.length ? kvSection("Monetary evidence", monetary) : "",
      allocation.length ? kvSection("Product allocation", allocation) : "",
      allocation.length ? renderMarketingReconcileFormula(summary) : "",
      assumption.length ? kvSection("Assumption evidence", assumption) : "",
      assumptionNote,
      frozen.length ? kvSection("Frozen evidence context", frozen) : "",
      statusNotes.length ? kvSection("Status and notes", statusNotes) : "",
    ].filter(Boolean);

    if (!parts.length) {
      return renderMarketingExplainStateMessage(
        "Marketing allocation explanation is unavailable for this selection.",
      );
    }

    return `<section class="cp-detail-section cp-marketing-explain" id="cpMarketingExplainHost" data-marketing-explain="true">
      <h3 class="cp-section-title">Marketing Allocation Explanation</h3>
      <div class="cp-marketing-explain-body">${parts.join("")}</div>
    </section>`;
  }

  function replaceMarketingExplainHost(html) {
    if (!costSheetExplainContent) return;
    const host = costSheetExplainContent.querySelector(
      "#cpMarketingExplainHost",
    );
    if (!host) return;
    host.outerHTML = html;
  }

  async function fillMarketingExplainSection(row) {
    if (!row || !costSheetExplainContent) return;
    if (currentExplainTraceabilityRow !== row) return;

    const tuple = getMarketingExplainTuple(row);
    const requestIdentity = marketingExplainRequestIdentity(row);
    if (!tuple || !requestIdentity) {
      replaceMarketingExplainHost(
        renderMarketingExplainStateMessage(
          "Marketing allocation explanation is unavailable because the exact costing context is incomplete.",
        ),
      );
      return;
    }

    if (!isMarketingExplainResponseCurrent(row, requestIdentity)) return;

    const cacheKey = marketingExplainCacheKey(tuple);
    const cached = marketingExplainSummaryCache.get(cacheKey);
    if (cached) {
      if (!isMarketingExplainResponseCurrent(row, requestIdentity)) return;
      replaceMarketingExplainHost(renderMarketingExplainSection(cached));
      return;
    }

    try {
      const summary = await loadMarketingExplainSummary(tuple);
      if (!isMarketingExplainResponseCurrent(row, requestIdentity)) return;
      if (!summary) {
        replaceMarketingExplainHost(
          renderMarketingExplainStateMessage(
            "Marketing allocation explanation is unavailable for this selection.",
          ),
        );
        return;
      }
      marketingExplainSummaryCache.set(cacheKey, summary);
      replaceMarketingExplainHost(renderMarketingExplainSection(summary));
    } catch (err) {
      console.warn(
        "[costing-suite] rpc_get_cost_sheet_marketing_explain_summary failed",
        err,
      );
      if (!isMarketingExplainResponseCurrent(row, requestIdentity)) return;
      replaceMarketingExplainHost(
        renderMarketingExplainStateMessage(
          "Marketing allocation explanation could not be loaded.",
        ),
      );
    }
  }

  function isQualityControlOverheadExplainLine(rowOrParams = {}) {
    const raw =
      rowOrParams.line_label ??
      rowOrParams.lineLabel ??
      rowOrParams?.params?.lineLabel ??
      "";
    const label = normalizeCostSheetDisplayLabel(raw).trim().toLowerCase();
    return label === "quality control overhead";
  }

  function isQcPermissionError(err) {
    if (!err) return false;
    const status = Number(err.status ?? err.statusCode ?? err.code);
    if (status === 401 || status === 403) return true;
    const msg = String(err.message || err.error_description || "").toLowerCase();
    return (
      msg.includes("permission") ||
      msg.includes("not authorized") ||
      msg.includes("forbidden") ||
      msg.includes("401") ||
      msg.includes("403")
    );
  }

  function formatQcStatusChip(code) {
    if (isBlankQcValue(code)) return null;
    const raw = String(code).trim();
    const upper = raw.toUpperCase();
    if (
      upper === "READY" ||
      upper === "REVIEW_REQUIRED" ||
      upper === "BLOCKED"
    ) {
      return statusChip(normalizeStatus(raw));
    }
    return text(formatQcStatusLabel(raw) || raw);
  }

  function getQcExplainTuple(row) {
    if (!row) return null;
    const period_start = String(row.period_start ?? "").trim();
    const product_id = Number(row.product_id);
    if (!period_start || !Number.isFinite(product_id)) return null;
    const skuRaw = row.sku_id;
    if (skuRaw == null || skuRaw === "") {
      return { period_start, product_id, sku_id: null };
    }
    const sku_id = Number(skuRaw);
    if (!Number.isFinite(sku_id)) {
      return { period_start, product_id, sku_id: null };
    }
    return { period_start, product_id, sku_id };
  }

  function qcExplainCacheKey(tuple) {
    return qcExplainRequestIdentity(tuple);
  }

  function qcExplainRowRequestIdentity(row) {
    const tuple = getQcExplainTuple(row);
    if (!tuple) return null;
    const label = normalizeCostSheetDisplayLabel(row.line_label ?? "")
      .trim()
      .toLowerCase();
    return `${qcExplainCacheKey(tuple)}|${label || "quality control overhead"}`;
  }

  function clearQcExplainCache() {
    qcExplainCache.clear();
  }

  function currentQcRunIdFromRow(row) {
    if (!row) return null;
    return pickFirstDefined(row.refresh_run_id, row.refreshRunId);
  }

  function isQcExplainResponseCurrent(row, requestIdentity) {
    if (!costSheetExplainContent || !row || !requestIdentity) return false;
    if (!currentExplainTraceabilityRow) return false;
    if (currentExplainTraceabilityRow !== row) return false;
    const currentIdentity = qcExplainRowRequestIdentity(
      currentExplainTraceabilityRow,
    );
    if (!currentIdentity || currentIdentity !== requestIdentity) return false;
    const currentTuple = getQcExplainTuple(currentExplainTraceabilityRow);
    const requestTuple = getQcExplainTuple(row);
    if (!currentTuple || !requestTuple) return false;
    if (
      currentTuple.period_start !== requestTuple.period_start ||
      currentTuple.product_id !== requestTuple.product_id ||
      currentTuple.sku_id !== requestTuple.sku_id
    ) {
      return false;
    }
    return Boolean(costSheetExplainContent.querySelector("#cpQcExplainHost"));
  }

  function normalizeQcExplainRpcRow(data) {
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

  async function loadSkuQcExplain(tuple) {
    if (!tuple || typeof costingRpc !== "function") return null;
    const { data, error } = await costingRpc("rpc_get_sku_qc_explain", {
      p_period_start: tuple.period_start,
      p_product_id: tuple.product_id,
      p_sku_id: tuple.sku_id,
    });
    if (error) throw error;
    return normalizeQcExplainRpcRow(data);
  }

  async function loadProductQcExplain(tuple) {
    if (!tuple || typeof costingRpc !== "function") return null;
    const { data, error } = await costingRpc("rpc_get_product_qc_explain", {
      p_period_start: tuple.period_start,
      p_product_id: tuple.product_id,
    });
    if (error) throw error;
    return normalizeQcExplainRpcRow(data);
  }

  function renderQcExplainStateMessage(message, extraClass = "") {
    const cls = ["status", "cp-qc-explain-status", extraClass]
      .filter(Boolean)
      .join(" ");
    return `<section class="cp-detail-section cp-qc-explain" id="cpQcExplainHost" data-qc-explain="true">
      <h3 class="cp-section-title">Quality Control Allocation Explanation</h3>
      <div class="${cls}" role="status">${text(message)}</div>
    </section>`;
  }

  function renderQcExplainLoading() {
    return `<section class="cp-detail-section cp-qc-explain" id="cpQcExplainHost" data-qc-explain="true">
      <h3 class="cp-section-title">Quality Control Allocation Explanation</h3>
      <div class="cost-sheet-explain-loading cp-qc-explain-loading">
        <span class="cp-loading-spinner" aria-hidden="true"></span>
        <span>Loading Quality Control allocation explanation…</span>
      </div>
    </section>`;
  }

  function renderQcExplainEmptyStatus(summaryStatus) {
    const status = String(summaryStatus || "UNKNOWN").trim().toUpperCase();
    if (status === "NO_CURRENT_SUCCESSFUL_RUN") {
      return renderQcExplainStateMessage(
        "No current successful costing run is available for Quality Control allocation explanation on the selected period, product and SKU.",
        "cp-qc-explain-empty",
      );
    }
    if (status === "NO_TRACE_DATA" || status === "NO_PERSISTED_DATA") {
      return renderQcExplainStateMessage(
        "No Quality Control allocation trace was found for the selected product, SKU and costing run.",
        "cp-qc-explain-empty",
      );
    }
    if (status === "UNKNOWN" || !status) {
      return renderQcExplainStateMessage(
        "Quality Control allocation explanation is unavailable for this selection.",
        "cp-qc-explain-empty",
      );
    }
    return null;
  }

  function qcPushKv(items, label, valueHtml) {
    if (valueHtml == null || valueHtml === "") return;
    items.push([label, valueHtml]);
  }

  function renderQcCalcBlock(title, lines, noteHtml = "") {
    if (!lines.length) return "";
    return `<div class="cp-qc-explain-calc" role="note">
      <div class="cp-qc-explain-calc-title">${text(title)}</div>
      <div class="cp-qc-explain-calc-body">
        ${lines.map((line) => `<div>${line}</div>`).join("")}
        ${noteHtml ? `<div class="cp-qc-explain-calc-note">${noteHtml}</div>` : ""}
      </div>
    </div>`;
  }

  function renderQcMethodSection(methods) {
    if (!Array.isArray(methods) || !methods.length) {
      return `<div class="cp-qc-method-empty status" role="status">No analytical-method evidence was returned for this Product.</div>`;
    }
    const items = methods
      .map((method, idx) => {
        const name = method?.method_name || method?.method_code || `Method ${idx + 1}`;
        const code = method?.method_code;
        const formula = formatQcMethodWorkloadFormulaText(method);
        const tests = Array.isArray(method?.effective_test_evidence)
          ? method.effective_test_evidence
          : Array.isArray(method?.tests)
            ? method.tests
            : [];
        const testHtml = tests.length
          ? `<ul class="cp-qc-test-list">${tests
              .map((test) => {
                const source = formatQcEffectiveTestSourceLabel(
                  test.source_type || test.source,
                );
                const overrideId = pickFirstDefined(test.source_override_id);
                const overrideNote = !isBlankQcValue(overrideId)
                  ? `<div class="cp-qc-test-override">Evidence came through Product-level governance (override ID ${text(overrideId)}).</div>`
                  : "";
                return `<li class="cp-qc-test">
                  <div class="cp-qc-test-head">
                    <span class="cp-qc-test-seq">#${text(test.seq_no ?? test.sequence ?? "—", "—")}</span>
                    <span class="cp-qc-test-name">${text(test.test_name || test.test_code || "Test")}</span>
                    <span class="cp-qc-test-source">${text(source || test.source_type || "—")}</span>
                  </div>
                  ${test.test_code ? `<div class="cp-muted-text">${text(test.test_code)}</div>` : ""}
                  ${overrideNote}
                </li>`;
              })
              .join("")}</ul>`
          : `<div class="cp-muted-text">No contributing effective tests returned for this method.</div>`;

        return `<details class="cp-qc-method" ${idx === 0 ? "open" : ""}>
          <summary class="cp-qc-method-summary">
            <span class="cp-qc-method-name">${text(name)}</span>
            ${code ? `<span class="cp-muted-text">${text(code)}</span>` : ""}
            <span class="cp-qc-method-units">${text(formatQcQuantity(method.method_workload_units) ?? "—")} units</span>
          </summary>
          <div class="cp-qc-method-body">
            <div class="cp-kv">
              <div><span class="cp-muted-text">Required lines</span><div>${text(formatQcQuantity(method.required_line_count, { maximumFractionDigits: 0 }) ?? "—")}</div></div>
              <div><span class="cp-muted-text">Method base units</span><div>${text(formatQcQuantity(method.method_base_units) ?? "—")}</div></div>
              <div><span class="cp-muted-text">Additional-parameter units</span><div>${text(formatQcQuantity(method.additional_parameter_units) ?? "—")}</div></div>
              <div><span class="cp-muted-text">Method workload units</span><div>${text(formatQcQuantity(method.method_workload_units) ?? "—")}</div></div>
            </div>
            ${formula ? `<div class="cp-qc-method-formula">${text(formula)}</div>` : ""}
            <div class="cp-qc-method-tests-title">Contributing effective tests</div>
            ${testHtml}
          </div>
        </details>`;
      })
      .join("");
    return `<div class="cp-qc-methods">${items}</div>`;
  }

  function resolveQcDisplayModel(payload, usedSkuRpc) {
    if (!payload) return null;
    if (usedSkuRpc) return mergeSkuAndProductQcExplain(payload) || payload;
    return {
      ...payload,
      __product: payload,
      __sku: null,
      __has_sku: false,
    };
  }

  function renderQcExplainSection(payload, { usedSkuRpc = false } = {}) {
    if (!payload) {
      return renderQcExplainStateMessage(
        "Quality Control allocation explanation is unavailable for this selection.",
      );
    }

    const model = resolveQcDisplayModel(payload, usedSkuRpc);
    const product =
      model.__product || extractNestedProductQcExplain(payload) || {};
    const sku = model.__sku || (model.__has_sku ? model : null) || {};

    const summaryStatus = String(
      pickFirstDefined(
        sku.summary_status,
        model.summary_status,
        product.summary_status,
      ) || "",
    )
      .trim()
      .toUpperCase();
    const emptyOnly = renderQcExplainEmptyStatus(summaryStatus);
    if (emptyOnly) return emptyOnly;

    const projection = String(
      pickFirstDefined(
        sku.projection_source,
        model.projection_source,
        product.projection_source,
      ) || "",
    )
      .trim()
      .toUpperCase();
    const allocationStatus = pickFirstDefined(
      sku.allocation_status,
      model.allocation_status,
      product.allocation_status,
    );
    const allocationReason = pickFirstDefined(
      sku.allocation_reason_code,
      sku.allocation_reason,
      model.allocation_reason_code,
      model.allocation_reason,
      product.allocation_reason_code,
      product.allocation_reason,
    );
    const allocationNote = pickFirstDefined(
      sku.allocation_note,
      model.allocation_note,
      product.allocation_note,
    );

    const statusItems = [];
    qcPushKv(statusItems, "Allocation status", formatQcStatusChip(allocationStatus));
    qcPushKv(
      statusItems,
      "Reason",
      isBlankQcValue(allocationReason)
        ? null
        : text(formatQcReasonLabel(allocationReason) || allocationReason),
    );
    qcPushKv(
      statusItems,
      "Note",
      isBlankQcValue(allocationNote) ? null : text(allocationNote),
    );
    qcPushKv(
      statusItems,
      "Summary status",
      formatQcStatusChip(summaryStatus) ||
        text(formatQcStatusLabel(summaryStatus) || summaryStatus),
    );

    const runItems = [];
    qcPushKv(
      runItems,
      "Refresh run ID",
      text(
        formatQcQuantity(
          pickFirstDefined(
            sku.refresh_run_id,
            model.refresh_run_id,
            product.refresh_run_id,
          ),
          { maximumFractionDigits: 0 },
        ) ?? "—",
        "—",
      ),
    );
    qcPushKv(
      runItems,
      "Valuation date",
      text(
        pickFirstDefined(
          sku.valuation_date,
          model.valuation_date,
          product.valuation_date,
        ),
        "—",
      ),
    );
    qcPushKv(
      runItems,
      "Projection source",
      text(
        formatQcProjectionSourceLabel(
          pickFirstDefined(
            sku.projection_source,
            model.projection_source,
            product.projection_source,
          ),
        ) ||
          pickFirstDefined(
            sku.projection_source,
            model.projection_source,
            product.projection_source,
          ) ||
          "—",
        "—",
      ),
    );
    qcPushKv(
      runItems,
      "Period start",
      text(
        pickFirstDefined(
          sku.period_start,
          model.period_start,
          product.period_start,
        ),
        "—",
      ),
    );

    // Product ownership first → live names → legacy aliases → model fallback
    const workloadUnits = pickFirstDefined(
      product.workload_units,
      product.product_workload_units,
      model.workload_units,
      model.product_workload_units,
    );
    const companyWorkload = pickFirstDefined(
      product.company_resolved_workload_units,
      product.company_resolved_workload,
      model.company_resolved_workload_units,
      model.company_resolved_workload,
    );
    const workloadShare = pickFirstDefined(
      product.product_workload_share,
      model.product_workload_share,
    );
    const frozenPool = pickFirstDefined(
      product.quality_control_pool_amount,
      product.frozen_qc_pool_amount,
      product.frozen_qc_pool,
      model.quality_control_pool_amount,
      model.frozen_qc_pool_amount,
      model.frozen_qc_pool,
    );
    const productAllocation = pickFirstDefined(
      product.product_qc_allocation_amount,
      product.product_qc_allocation,
      model.product_qc_allocation_amount,
      model.product_qc_allocation,
    );

    const allocationItems = [];
    qcPushKv(
      allocationItems,
      "Product workload units",
      text(formatQcQuantity(workloadUnits) ?? "—", "—"),
    );
    qcPushKv(
      allocationItems,
      "Company resolved workload units",
      text(formatQcQuantity(companyWorkload) ?? "—", "—"),
    );
    qcPushKv(
      allocationItems,
      "Product workload share",
      text(formatQcCoveragePercent(workloadShare) ?? "—", "—"),
    );
    qcPushKv(
      allocationItems,
      "Frozen QC pool",
      text(formatQcMoney(frozenPool) ?? "—", "—"),
    );
    qcPushKv(
      allocationItems,
      "Product QC allocation amount",
      text(formatQcMoney(productAllocation) ?? "—", "—"),
    );

    const absorptionQty = pickFirstDefined(
      product.product_absorption_base_qty,
      product.product_absorption_quantity,
      product.absorption_quantity,
      model.product_absorption_base_qty,
      model.product_absorption_quantity,
      model.absorption_quantity,
    );
    const baseUom = pickFirstDefined(
      sku.product_base_uom,
      product.product_base_uom,
      model.product_base_uom,
      model.base_uom,
    );
    const qcPerBase = pickFirstDefined(
      product.qc_cost_per_product_base_uom,
      model.qc_cost_per_product_base_uom,
      sku.qc_cost_per_product_base_uom,
    );
    const absorptionSource = pickFirstDefined(
      product.absorption_basis_source,
      product.absorption_source,
      model.absorption_basis_source,
      model.absorption_source,
    );
    const absorptionMethod = pickFirstDefined(
      product.absorption_basis_method,
      product.absorption_method,
      model.absorption_basis_method,
      model.absorption_method,
    );
    const absorptionSourceMonth = pickFirstDefined(
      product.absorption_basis_source_month,
      product.absorption_source_month,
      model.absorption_basis_source_month,
      model.absorption_source_month,
    );
    const absorptionStatus = pickFirstDefined(
      product.absorption_basis_status,
      product.absorption_status,
      model.absorption_basis_status,
      model.absorption_status,
    );
    const absorptionNote = pickFirstDefined(
      product.absorption_basis_note,
      product.absorption_note,
      model.absorption_basis_note,
      model.absorption_note,
    );

    const absorptionItems = [];
    qcPushKv(
      absorptionItems,
      "Product absorption quantity",
      `${text(formatQcQuantity(absorptionQty) ?? "—", "—")}${
        baseUom ? ` ${text(baseUom)}` : ""
      }`,
    );
    qcPushKv(
      absorptionItems,
      "Product base UOM",
      isBlankQcValue(baseUom) ? null : text(baseUom),
    );
    qcPushKv(
      absorptionItems,
      "Absorption source",
      text(
        formatQcQuantitySourceLabel(absorptionSource) ||
          absorptionSource ||
          "—",
        "—",
      ),
    );
    qcPushKv(
      absorptionItems,
      "Absorption method",
      text(
        formatQcAbsorptionMethodLabel(absorptionMethod) ||
          absorptionMethod ||
          "—",
        "—",
      ),
    );
    qcPushKv(
      absorptionItems,
      "Absorption source month",
      text(
        formatQcAbsorptionSourceMonth(absorptionSourceMonth) ||
          absorptionSourceMonth ||
          "—",
        "—",
      ),
    );
    qcPushKv(
      absorptionItems,
      "Absorption status",
      formatQcStatusChip(absorptionStatus),
    );
    qcPushKv(
      absorptionItems,
      "Absorption note",
      isBlankQcValue(absorptionNote) ? null : text(absorptionNote),
    );
    qcPushKv(
      absorptionItems,
      "QC cost per Product base UOM",
      text(formatQcMoney(qcPerBase) ?? "—", "—"),
    );

    // SKU ownership first
    const skuBaseQty = pickFirstDefined(
      sku.sku_base_qty_per_unit,
      sku.sku_base_quantity_per_unit,
      model.sku_base_qty_per_unit,
      model.sku_base_quantity_per_unit,
    );
    const qcPerSku = pickFirstDefined(
      sku.quality_control_overhead_cost_per_sku,
      sku.qc_overhead_cost_per_sku,
      model.quality_control_overhead_cost_per_sku,
      model.qc_overhead_cost_per_sku,
    );
    const skuId = pickFirstDefined(sku.sku_id, model.sku_id);
    const packSize = pickFirstDefined(sku.pack_size, model.pack_size);
    const packUom = pickFirstDefined(sku.pack_uom, model.pack_uom);

    const skuItems = [];
    if (model.__has_sku || usedSkuRpc) {
      qcPushKv(skuItems, "SKU ID", text(skuId, "—"));
      qcPushKv(
        skuItems,
        "Pack size",
        text(formatQcQuantity(packSize) ?? packSize ?? "—", "—"),
      );
      qcPushKv(skuItems, "Pack UOM", text(packUom, "—"));
      qcPushKv(
        skuItems,
        "SKU base quantity per unit",
        text(
          formatQcQuantity(skuBaseQty) != null
            ? `${formatQcQuantity(skuBaseQty)}${baseUom ? ` ${baseUom}` : ""}`
            : "—",
          "—",
        ),
      );
      qcPushKv(
        skuItems,
        "QC overhead cost per SKU",
        text(formatQcMoney(qcPerSku) ?? "—", "—"),
      );
    }

    const recipient = pickFirstDefined(
      product.recipient_product_count,
      model.recipient_product_count,
    );
    const included = pickFirstDefined(
      product.included_product_count,
      model.included_product_count,
    );
    const excluded = pickFirstDefined(
      product.excluded_product_count,
      model.excluded_product_count,
    );
    const coverage = pickFirstDefined(
      product.resolved_coverage_ratio,
      model.resolved_coverage_ratio,
    );

    const coverageItems = [];
    qcPushKv(
      coverageItems,
      "Recipient Products",
      text(formatQcQuantity(recipient, { maximumFractionDigits: 0 }) ?? "—", "—"),
    );
    qcPushKv(
      coverageItems,
      "Included Products",
      text(formatQcQuantity(included, { maximumFractionDigits: 0 }) ?? "—", "—"),
    );
    qcPushKv(
      coverageItems,
      "Excluded Products",
      text(formatQcQuantity(excluded, { maximumFractionDigits: 0 }) ?? "—", "—"),
    );
    qcPushKv(
      coverageItems,
      "Resolved coverage",
      text(formatQcCoveragePercent(coverage) ?? "—", "—"),
    );

    const profileItems = [];
    qcPushKv(
      profileItems,
      "Product Group ID",
      text(
        pickFirstDefined(product.product_group_id, model.product_group_id),
        "—",
      ),
    );
    qcPushKv(
      profileItems,
      "Protocol category ID",
      text(
        pickFirstDefined(
          product.protocol_category_id,
          product.protocol_category,
          model.protocol_category_id,
          model.protocol_category,
        ),
        "—",
      ),
    );
    qcPushKv(
      profileItems,
      "Base specification profile ID",
      text(
        pickFirstDefined(
          product.base_specification_profile_id,
          product.base_spec_profile_id,
          model.base_specification_profile_id,
          model.base_spec_profile_id,
        ),
        "—",
      ),
    );
    qcPushKv(
      profileItems,
      "Policy ID",
      text(pickFirstDefined(product.policy_id, model.policy_id), "—"),
    );

    const calcAllocation = renderQcCalcBlock(
      "Product workload allocation",
      [
        `Product workload&nbsp;&nbsp;${text(formatQcQuantity(workloadUnits) ?? "—", "—")}`,
        `÷ company resolved workload&nbsp;&nbsp;${text(formatQcQuantity(companyWorkload) ?? "—", "—")}`,
        `× frozen QC pool&nbsp;&nbsp;${text(formatQcMoney(frozenPool) ?? "—", "—")}`,
        `= Product QC allocation&nbsp;&nbsp;${text(formatQcMoney(productAllocation) ?? "—", "—")}`,
      ],
      "Explanatory layout using server values. Product absorption quantity is not the Product QC allocation-share driver.",
    );
    const calcAbsorption = renderQcCalcBlock(
      "Product absorption",
      [
        `Product QC allocation&nbsp;&nbsp;${text(formatQcMoney(productAllocation) ?? "—", "—")}`,
        `÷ governed Product monthly base quantity&nbsp;&nbsp;${text(formatQcQuantity(absorptionQty) ?? "—", "—")}${
          baseUom ? ` ${text(baseUom)}` : ""
        }`,
        `= QC cost per Product base UOM&nbsp;&nbsp;${text(formatQcMoney(qcPerBase) ?? "—", "—")}`,
      ],
    );
    const calcSku =
      model.__has_sku || usedSkuRpc
        ? renderQcCalcBlock("SKU conversion", [
            `QC cost per Product base UOM&nbsp;&nbsp;${text(formatQcMoney(qcPerBase) ?? "—", "—")}`,
            `× SKU base quantity per unit&nbsp;&nbsp;${text(formatQcQuantity(skuBaseQty) ?? "—", "—")}`,
            `= QC overhead cost per SKU&nbsp;&nbsp;${text(formatQcMoney(qcPerSku) ?? "—", "—")}`,
          ])
        : "";

    const fallbackBanner =
      projection === "CONTROLLED_PRE_REFRESH_FALLBACK"
        ? `<div class="status cp-qc-explain-fallback" role="status">Awaiting governed refresh. Workload and specification preview may be shown; unavailable monetary values remain unavailable and are not calculated in the browser.${
            summaryStatus === "PENDING_NEW_GOVERNED_REFRESH" ||
            String(allocationStatus || "").toUpperCase() ===
              "PENDING_NEW_GOVERNED_REFRESH"
              ? " Status: PENDING_NEW_GOVERNED_REFRESH."
              : ""
          }</div>`
        : "";
    const blockedBanner =
      String(allocationStatus || summaryStatus).toUpperCase() === "BLOCKED"
        ? `<div class="status cp-qc-explain-blocked" role="status">Quality Control allocation is blocked for this selection. Review the server notes below and the QC Action Queue.</div>`
        : "";
    const reviewBanner =
      String(allocationStatus || summaryStatus).toUpperCase() ===
      "REVIEW_REQUIRED"
        ? `<div class="status cp-qc-explain-review" role="status">Review required — values are shown for governance review and are not treated as invalid.</div>`
        : "";

    const methods = Array.isArray(product.methods)
      ? product.methods
      : Array.isArray(model.methods)
        ? model.methods
        : [];

    const parts = [
      blockedBanner,
      reviewBanner,
      fallbackBanner,
      statusItems.length ? kvSection("Status", statusItems) : "",
      runItems.length ? kvSection("Run identity", runItems) : "",
      allocationItems.length
        ? kvSection("Product workload allocation", allocationItems)
        : "",
      calcAllocation,
      absorptionItems.length
        ? kvSection("Product absorption (per base UOM)", absorptionItems)
        : "",
      calcAbsorption,
      skuItems.length ? kvSection("SKU conversion", skuItems) : "",
      calcSku,
      coverageItems.length ? kvSection("Coverage", coverageItems) : "",
      `<div class="cp-qc-explain-exclusion" role="note">${text(QC_EXCLUSION_DISCLOSURE)}</div>`,
      profileItems.length
        ? kvSection("Specification / policy identity", profileItems)
        : "",
      `<div class="cp-detail-section cp-qc-methods-wrap"><h4 class="cp-section-title">Analytical methods</h4>${renderQcMethodSection(methods)}</div>`,
    ];

    return `<section class="cp-detail-section cp-qc-explain" id="cpQcExplainHost" data-qc-explain="true">
      <h3 class="cp-section-title">Quality Control Allocation Explanation</h3>
      <div class="cp-qc-explain-body">${parts.join("")}</div>
    </section>`;
  }

  function replaceQcExplainHost(html) {
    if (!costSheetExplainContent) return;
    const host = costSheetExplainContent.querySelector("#cpQcExplainHost");
    if (!host) return;
    host.outerHTML = html;
  }

  async function fillQcExplainSection(row) {
    if (!row || !costSheetExplainContent) return;
    if (currentExplainTraceabilityRow !== row) return;

    const tuple = getQcExplainTuple(row);
    const requestIdentity = qcExplainRowRequestIdentity(row);
    if (!tuple || !requestIdentity) {
      replaceQcExplainHost(
        renderQcExplainStateMessage(
          "Quality Control allocation explanation is unavailable because the exact costing context is incomplete.",
        ),
      );
      return;
    }

    if (!isQcExplainResponseCurrent(row, requestIdentity)) return;

    const cacheKey = qcExplainCacheKey(tuple);
    const cached = qcExplainCache.get(cacheKey);
    const currentRunId = currentQcRunIdFromRow(row);
    if (cached && isQcExplainCacheEntryReusable(cached, currentRunId)) {
      if (!isQcExplainResponseCurrent(row, requestIdentity)) return;
      replaceQcExplainHost(
        renderQcExplainSection(cached.payload, {
          usedSkuRpc: tuple.sku_id != null,
        }),
      );
      return;
    }
    if (cached && !isQcExplainCacheEntryReusable(cached, currentRunId)) {
      qcExplainCache.delete(cacheKey);
    }

    try {
      let payload = null;
      let usedSkuRpc = false;
      if (tuple.sku_id != null) {
        payload = await loadSkuQcExplain(tuple);
        usedSkuRpc = true;
      } else {
        payload = await loadProductQcExplain(tuple);
      }
      if (!isQcExplainResponseCurrent(row, requestIdentity)) return;
      if (!payload) {
        replaceQcExplainHost(
          renderQcExplainStateMessage(
            "Quality Control allocation explanation is unavailable for this selection.",
          ),
        );
        return;
      }
      const entry = buildQcExplainCacheEntry(payload);
      if (entry) qcExplainCache.set(cacheKey, entry);
      replaceQcExplainHost(renderQcExplainSection(payload, { usedSkuRpc }));
    } catch (err) {
      console.warn("[costing-suite] QC explain RPC failed", err);
      if (!isQcExplainResponseCurrent(row, requestIdentity)) return;
      if (isQcPermissionError(err)) {
        replaceQcExplainHost(
          renderQcExplainStateMessage(
            "Permission denied. Quality Control allocation explanation requires module:cost-sheet-review can_view.",
            "cp-qc-explain-denied",
          ),
        );
        return;
      }
      replaceQcExplainHost(
        renderQcExplainStateMessage(
          "Quality Control allocation explanation could not be loaded.",
        ),
      );
    }
  }

  /**
   * Thin Product-only QC Explain entry for QC Action Queue.
   * Does not run SKU Explain; does not open printable cost sheet.
   */
  async function openProductQcExplainFromQueue(row = {}) {
    if (!costSheetExplainDrawer || !costSheetExplainContent) return false;
    const period_start = String(
      row.period_start ||
        (typeof getActivePeriodStart === "function"
          ? getActivePeriodStart()
          : "") ||
        "",
    ).trim();
    const product_id = Number(row.product_id);
    if (!period_start || !Number.isFinite(product_id)) {
      showToast?.(
        "Product QC Explain needs period and product context.",
        "warning",
      );
      return false;
    }

    costSheetExplainReturnFocus = document.activeElement;
    costSheetExplainDrawer.classList.remove("hidden");
    costSheetExplainDrawer.setAttribute("aria-hidden", "false");
    const synthetic = {
      period_start,
      product_id,
      sku_id: null,
      line_label: "Quality Control Overhead",
      product_name: row.product_name,
      refresh_run_id: row.refresh_run_id,
      valuation_date: row.valuation_date,
    };
    setCostSheetExplainHeader(synthetic, {
      lineLabel: "Quality Control Overhead",
      productName: row.product_name,
      periodStart: period_start,
    });
    currentExplainTraceabilityRow = synthetic;
    costSheetExplainContent.innerHTML = renderQcExplainLoading();
    setTimeout(() => {
      costSheetExplainCloseBtn?.focus();
    }, 0);
    void fillQcExplainSection(synthetic);
    return true;
  }

  function isMaterialsStoresOverheadExplainLine(rowOrParams = {}) {
    const raw =
      rowOrParams.line_label ??
      rowOrParams.lineLabel ??
      rowOrParams?.params?.lineLabel ??
      "";
    const label = normalizeCostSheetDisplayLabel(raw).trim().toLowerCase();
    return (
      label === MATERIALS_STORES_OVERHEAD_LINE_LABEL_NORMALIZED ||
      label === "materials / stores overhead"
    );
  }

  function isMsPermissionError(err) {
    if (!err) return false;
    const status = Number(err.status ?? err.statusCode ?? err.code);
    if (status === 401 || status === 403) return true;
    const msg = String(err.message || err.error_description || "").toLowerCase();
    return (
      msg.includes("permission") ||
      msg.includes("not authorized") ||
      msg.includes("forbidden") ||
      msg.includes("401") ||
      msg.includes("403")
    );
  }

  function clearMsExplainCache() {
    msExplainCache.clear();
  }

  function getMsExplainTuple(row) {
    if (!row || typeof row !== "object") return null;
    const period_start = String(
      row.period_start ||
        (typeof getActivePeriodStart === "function"
          ? getActivePeriodStart()
          : "") ||
        "",
    ).trim();
    const product_id = Number(row.product_id);
    if (!period_start || !Number.isFinite(product_id)) return null;
    const skuRaw = row.sku_id;
    if (skuRaw == null || skuRaw === "") {
      return { period_start, product_id, sku_id: null };
    }
    const sku_id = Number(skuRaw);
    if (!Number.isFinite(sku_id)) {
      return { period_start, product_id, sku_id: null };
    }
    return { period_start, product_id, sku_id };
  }

  function msExplainCacheKey(tuple) {
    return msExplainRequestIdentity(tuple);
  }

  function msExplainRowRequestIdentity(row) {
    const tuple = getMsExplainTuple(row);
    if (!tuple) return null;
    const label = normalizeCostSheetDisplayLabel(row.line_label ?? "")
      .trim()
      .toLowerCase();
    return `${msExplainCacheKey(tuple)}|${label || MATERIALS_STORES_OVERHEAD_LINE_LABEL_NORMALIZED}`;
  }

  function currentMsRunIdFromRow(row) {
    if (!row) return null;
    return pickFirstDefinedMs(row.refresh_run_id, row.refreshRunId);
  }

  function isMsExplainResponseCurrent(row, requestIdentity) {
    if (!costSheetExplainContent || !row || !requestIdentity) return false;
    if (!currentExplainTraceabilityRow) return false;
    if (currentExplainTraceabilityRow !== row) return false;
    const currentIdentity = msExplainRowRequestIdentity(
      currentExplainTraceabilityRow,
    );
    if (!currentIdentity || currentIdentity !== requestIdentity) return false;
    return Boolean(costSheetExplainContent.querySelector("#cpMaterialsStoresExplainHost"));
  }

  async function loadSkuMaterialsStoresExplain(tuple) {
    if (!tuple || typeof costingRpc !== "function") return null;
    const { data, error } = await costingRpc(
      "rpc_get_sku_materials_stores_explain",
      {
        p_period_start: tuple.period_start,
        p_product_id: tuple.product_id,
        p_sku_id: tuple.sku_id,
      },
    );
    if (error) throw error;
    return normalizeMsExplainRpcPayload(data);
  }

  async function loadProductMaterialsStoresExplain(tuple) {
    if (!tuple || typeof costingRpc !== "function") return null;
    const { data, error } = await costingRpc(
      "rpc_get_product_materials_stores_explain",
      {
        p_period_start: tuple.period_start,
        p_product_id: tuple.product_id,
      },
    );
    if (error) throw error;
    return normalizeMsExplainRpcPayload(data);
  }

  function msMoneyHtml(value) {
    const formatted = formatMsMoney(value);
    if (formatted == null) return text("unavailable");
    return text(formatted);
  }

  function msQtyHtml(value, opts) {
    const formatted = formatMsQuantity(value, opts);
    if (formatted == null) return null;
    return text(formatted);
  }

  function msShareHtml(value) {
    const formatted = formatMsWorkloadSharePercent(value);
    if (formatted == null) return null;
    return text(formatted);
  }

  function msTextHtml(value) {
    if (isBlankMsValue(value)) return null;
    return text(value);
  }

  function msStatusHtml(code) {
    if (isBlankMsValue(code)) return null;
    const raw = String(code).trim();
    const upper = raw.toUpperCase();
    if (
      upper === "READY" ||
      upper === "REVIEW_REQUIRED" ||
      upper === "BLOCKED"
    ) {
      return statusChip(normalizeStatus(raw));
    }
    return text(formatMsStatusLabel(raw) || raw);
  }

  function msPushKv(items, label, valueHtml) {
    if (valueHtml == null || valueHtml === "") return;
    items.push([label, valueHtml]);
  }

  function renderMsExplainStateMessage(message, extraClass = "") {
    const cls = ["status", "cp-ms-explain-status", extraClass]
      .filter(Boolean)
      .join(" ");
    return `<section class="cp-detail-section cp-ms-explain" id="cpMaterialsStoresExplainHost" data-ms-explain="true">
      <h3 class="cp-section-title">Materials / Stores Allocation Explanation</h3>
      <div class="${cls}" role="status">${text(message)}</div>
    </section>`;
  }

  function renderMsExplainLoading() {
    return `<section class="cp-detail-section cp-ms-explain" id="cpMaterialsStoresExplainHost" data-ms-explain="true">
      <h3 class="cp-section-title">Materials / Stores Allocation Explanation</h3>
      <div class="cost-sheet-explain-loading cp-ms-explain-loading">
        <span class="cp-loading-spinner" aria-hidden="true"></span>
        <span>Loading Materials / Stores allocation explanation…</span>
      </div>
    </section>`;
  }

  function renderMsExplainEmptyStatus(summaryStatus) {
    const status = String(summaryStatus || "UNKNOWN").trim().toUpperCase();
    if (status === "NO_CURRENT_SUCCESSFUL_RUN") {
      return renderMsExplainStateMessage(
        "No current successful costing run is available for Materials / Stores allocation explanation on the selected period, product and SKU.",
        "cp-ms-explain-empty",
      );
    }
    if (status === "NO_TRACE_DATA" || status === "NO_PERSISTED_DATA") {
      return renderMsExplainStateMessage(
        "No Materials / Stores allocation trace was found for the selected product, SKU and costing run.",
        "cp-ms-explain-empty",
      );
    }
    if (status === "UNKNOWN" || !status) {
      return renderMsExplainStateMessage(
        "Materials / Stores allocation explanation is unavailable for this selection.",
        "cp-ms-explain-empty",
      );
    }
    return null;
  }

  function renderMsCalcBlock(title, lines) {
    if (!lines.length) return "";
    return `<div class="cp-ms-explain-calc" role="note">
      <div class="cp-ms-explain-calc-title">${text(title)}</div>
      <div class="cp-ms-explain-calc-body">
        ${lines.map((line) => `<div>${line}</div>`).join("")}
      </div>
    </div>`;
  }

  function renderMsProductSkusTable(skus) {
    if (!Array.isArray(skus) || !skus.length) {
      return `<div class="cp-muted-text">No SKU rows were returned for this Product.</div>`;
    }
    const rows = skus
      .map((sku) => {
        const pack = [
          formatMsQuantity(sku.pack_size) ?? sku.pack_size,
          sku.pack_uom,
        ]
          .filter((v) => !isBlankMsValue(v))
          .join(" ");
        const cost = formatMsMoney(sku.materials_stores_overhead_cost_per_sku);
        return `<tr>
          <td>${text(sku.sku_id)}</td>
          <td>${text(pack || "—")}</td>
          <td>${msStatusHtml(sku.allocation_status) || text("—")}</td>
          <td>${text(formatMsActionLabel(sku.allocation_reason_code) || sku.allocation_reason_code || "—")}</td>
          <td>${cost != null ? text(cost) : text("unavailable")}</td>
        </tr>`;
      })
      .join("");
    return `<table class="cp-ms-sku-table">
      <thead><tr>
        <th>SKU ID</th><th>Pack</th><th>Status</th><th>Reason</th><th>Stores / SKU</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function renderMsProductExplainSection(payload) {
    if (!payload) {
      return renderMsExplainStateMessage(
        "Materials / Stores allocation explanation is unavailable for this selection.",
      );
    }
    const summaryStatus = String(payload.summary_status || "")
      .trim()
      .toUpperCase();
    const emptyOnly = renderMsExplainEmptyStatus(summaryStatus);
    if (emptyOnly) return emptyOnly;

    const productRm = extractMsProductRm(payload) || {};
    const skus = extractMsProductSkus(payload);
    const rmItems = [];
    msPushKv(rmItems, "required_rm_line_count", msQtyHtml(productRm.required_rm_line_count, { maximumFractionDigits: 0 }));
    msPushKv(rmItems, "distinct_purchase_item_count", msQtyHtml(productRm.distinct_purchase_item_count, { maximumFractionDigits: 0 }));
    msPushKv(rmItems, "repeated_rm_line_count", msQtyHtml(productRm.repeated_rm_line_count, { maximumFractionDigits: 0 }));
    msPushKv(rmItems, "form_conversion_line_count", msQtyHtml(productRm.form_conversion_line_count, { maximumFractionDigits: 0 }));
    msPushKv(rmItems, "rm_complexity_units", msQtyHtml(productRm.rm_complexity_units));
    msPushKv(rmItems, "rm_reference_output_qty", msQtyHtml(productRm.rm_reference_output_qty));
    msPushKv(rmItems, "rm_reference_output_uom", msTextHtml(productRm.rm_reference_output_uom));
    msPushKv(rmItems, "rm_uom_compatibility_status", msTextHtml(productRm.rm_uom_compatibility_status));
    msPushKv(rmItems, "zero_rm_classification_code", msTextHtml(productRm.zero_rm_classification_code));
    msPushKv(rmItems, "rm_evidence_status", msStatusHtml(productRm.rm_evidence_status) || msTextHtml(productRm.rm_evidence_status));
    msPushKv(rmItems, "rm_evidence_reason", msTextHtml(productRm.rm_evidence_reason));
    msPushKv(rmItems, "policy_code", msTextHtml(productRm.policy_code));
    msPushKv(rmItems, "policy_version", msTextHtml(productRm.policy_version));
    msPushKv(rmItems, "policy_approval_reference", msTextHtml(productRm.policy_approval_reference));

    const parts = [
      rmItems.length ? kvSection("Product RM evidence", rmItems) : "",
      `<div class="cp-detail-section"><h4 class="cp-section-title">Product SKUs</h4>${renderMsProductSkusTable(skus)}</div>`,
    ];

    return `<section class="cp-detail-section cp-ms-explain" id="cpMaterialsStoresExplainHost" data-ms-explain="true">
      <h3 class="cp-section-title">Materials / Stores Allocation Explanation</h3>
      <div class="cp-ms-explain-body">${parts.join("")}</div>
    </section>`;
  }

  function renderMsSkuExplainSection(payload) {
    if (!payload) {
      return renderMsExplainStateMessage(
        "Materials / Stores allocation explanation is unavailable for this selection.",
      );
    }
    const summaryStatus = String(payload.summary_status || "")
      .trim()
      .toUpperCase();
    const emptyOnly = renderMsExplainEmptyStatus(summaryStatus);
    if (emptyOnly) return emptyOnly;

    const sku = extractMsSkuBlock(payload) || {};
    const calculation = extractMsCalculationBlock(payload) || {};

    const statusItems = [];
    msPushKv(
      statusItems,
      formatMsFieldLabel("allocation_status"),
      msStatusHtml(sku.allocation_status) || msTextHtml(sku.allocation_status),
    );
    msPushKv(
      statusItems,
      formatMsFieldLabel("allocation_reason_code"),
      msTextHtml(
        formatMsActionLabel(sku.allocation_reason_code) ||
          sku.allocation_reason_code,
      ),
    );
    msPushKv(
      statusItems,
      formatMsFieldLabel("allocation_note"),
      msTextHtml(sku.allocation_note),
    );

    const monthlyItems = [];
    msPushKv(
      monthlyItems,
      formatMsFieldLabel("monthly_sku_units"),
      msQtyHtml(sku.monthly_sku_units),
    );
    msPushKv(
      monthlyItems,
      formatMsFieldLabel("monthly_sku_base_qty"),
      msQtyHtml(sku.monthly_sku_base_qty),
    );
    msPushKv(
      monthlyItems,
      formatMsFieldLabel("monthly_driver_method"),
      msTextHtml(sku.monthly_driver_method),
    );
    msPushKv(
      monthlyItems,
      formatMsFieldLabel("monthly_driver_source"),
      msTextHtml(sku.monthly_driver_source),
    );
    msPushKv(
      monthlyItems,
      formatMsFieldLabel("monthly_driver_source_month"),
      msTextHtml(
        formatMsAbsorptionSourceMonth(sku.monthly_driver_source_month) ||
          sku.monthly_driver_source_month,
      ),
    );
    msPushKv(
      monthlyItems,
      formatMsFieldLabel("monthly_driver_status"),
      msStatusHtml(sku.monthly_driver_status) ||
        msTextHtml(sku.monthly_driver_status),
    );
    msPushKv(
      monthlyItems,
      formatMsFieldLabel("monthly_driver_note"),
      msTextHtml(sku.monthly_driver_note),
    );

    const pmItems = [];
    msPushKv(
      pmItems,
      formatMsFieldLabel("required_pm_line_count"),
      msQtyHtml(sku.required_pm_line_count, { maximumFractionDigits: 0 }),
    );
    msPushKv(
      pmItems,
      formatMsFieldLabel("distinct_pm_item_count"),
      msQtyHtml(sku.distinct_pm_item_count, { maximumFractionDigits: 0 }),
    );
    msPushKv(
      pmItems,
      formatMsFieldLabel("pm_override_line_count"),
      msQtyHtml(sku.pm_override_line_count, { maximumFractionDigits: 0 }),
    );
    msPushKv(
      pmItems,
      formatMsFieldLabel("pm_complexity_units"),
      msQtyHtml(sku.pm_complexity_units),
    );
    msPushKv(
      pmItems,
      formatMsFieldLabel("pm_reference_output_qty"),
      msQtyHtml(sku.pm_reference_output_qty),
    );
    msPushKv(
      pmItems,
      "zero_pm_classification_code",
      msTextHtml(sku.zero_pm_classification_code),
    );
    msPushKv(
      pmItems,
      formatMsFieldLabel("pm_evidence_status"),
      msStatusHtml(sku.pm_evidence_status) || msTextHtml(sku.pm_evidence_status),
    );
    msPushKv(
      pmItems,
      formatMsFieldLabel("pm_evidence_reason"),
      msTextHtml(sku.pm_evidence_reason),
    );

    const workloadItems = [];
    msPushKv(
      workloadItems,
      formatMsFieldLabel("rm_workload_units"),
      msQtyHtml(sku.rm_workload_units),
    );
    msPushKv(
      workloadItems,
      formatMsFieldLabel("pm_workload_units"),
      msQtyHtml(sku.pm_workload_units),
    );
    msPushKv(
      workloadItems,
      formatMsFieldLabel("unified_workload_units"),
      msQtyHtml(sku.unified_workload_units),
    );
    msPushKv(
      workloadItems,
      formatMsFieldLabel("company_eligible_workload_units"),
      msQtyHtml(sku.company_eligible_workload_units),
    );
    msPushKv(
      workloadItems,
      formatMsFieldLabel("workload_share"),
      msShareHtml(sku.workload_share),
    );

    const moneyItems = [];
    msPushKv(
      moneyItems,
      formatMsFieldLabel("frozen_pool_amount"),
      msMoneyHtml(sku.frozen_pool_amount),
    );
    msPushKv(
      moneyItems,
      formatMsFieldLabel("monthly_sku_allocation_amount"),
      msMoneyHtml(sku.monthly_sku_allocation_amount),
    );
    msPushKv(
      moneyItems,
      formatMsFieldLabel("materials_stores_overhead_cost_per_sku"),
      msMoneyHtml(sku.materials_stores_overhead_cost_per_sku),
    );

    const calcLines = [];
    const seenFormulaBodies = new Set();
    for (const key of MS_CALCULATION_FORMULA_ORDER) {
      const body = calculation[key];
      if (isBlankMsValue(body)) continue;
      const bodyText = String(body);
      seenFormulaBodies.add(bodyText.trim());
      calcLines.push(
        `<div class="cp-ms-formula-item"><div class="cp-ms-formula-label">${text(formatMsCalculationFormulaLabel(key))}</div><div class="cp-ms-formula-body">${text(bodyText)}</div></div>`,
      );
    }
    if (
      !isBlankMsValue(calculation.formula_text) &&
      !seenFormulaBodies.has(String(calculation.formula_text).trim())
    ) {
      calcLines.push(text(calculation.formula_text));
      seenFormulaBodies.add(String(calculation.formula_text).trim());
    }
    if (
      !isBlankMsValue(calculation.calculation_note) &&
      !seenFormulaBodies.has(String(calculation.calculation_note).trim())
    ) {
      calcLines.push(text(calculation.calculation_note));
    }

    const parts = [
      statusItems.length
        ? kvSection("Materials / Stores status", statusItems)
        : "",
      monthlyItems.length ? kvSection("Monthly driver inputs", monthlyItems) : "",
      pmItems.length ? kvSection("PM evidence", pmItems) : "",
      workloadItems.length ? kvSection("Workload", workloadItems) : "",
      moneyItems.length ? kvSection("Allocation amounts", moneyItems) : "",
      renderMsCalcBlock("Calculation", calcLines),
    ];

    return `<section class="cp-detail-section cp-ms-explain" id="cpMaterialsStoresExplainHost" data-ms-explain="true">
      <h3 class="cp-section-title">Materials / Stores Allocation Explanation</h3>
      <div class="cp-ms-explain-body">${parts.join("")}</div>
    </section>`;
  }

  function renderMsExplainSection(payload, { usedSkuRpc = false } = {}) {
    if (usedSkuRpc) return renderMsSkuExplainSection(payload);
    return renderMsProductExplainSection(payload);
  }

  function replaceMsExplainHost(html) {
    if (!costSheetExplainContent) return;
    const host = costSheetExplainContent.querySelector(
      "#cpMaterialsStoresExplainHost",
    );
    if (!host) return;
    host.outerHTML = html;
  }

  async function fillMsExplainSection(row) {
    if (!row || !costSheetExplainContent) return;
    if (currentExplainTraceabilityRow !== row) return;

    const tuple = getMsExplainTuple(row);
    const requestIdentity = msExplainRowRequestIdentity(row);
    if (!tuple || !requestIdentity) {
      replaceMsExplainHost(
        renderMsExplainStateMessage(
          "Materials / Stores allocation explanation is unavailable because the exact costing context is incomplete.",
        ),
      );
      return;
    }

    if (!isMsExplainResponseCurrent(row, requestIdentity)) return;

    const cacheKey = msExplainCacheKey(tuple);
    const cached = msExplainCache.get(cacheKey);
    const currentRunId = currentMsRunIdFromRow(row);
    if (cached && isMsExplainCacheEntryReusable(cached, currentRunId)) {
      if (!isMsExplainResponseCurrent(row, requestIdentity)) return;
      replaceMsExplainHost(
        renderMsExplainSection(cached.payload, {
          usedSkuRpc: tuple.sku_id != null,
        }),
      );
      return;
    }
    if (cached && !isMsExplainCacheEntryReusable(cached, currentRunId)) {
      msExplainCache.delete(cacheKey);
    }

    try {
      let payload = null;
      let usedSkuRpc = false;
      if (tuple.sku_id != null) {
        payload = await loadSkuMaterialsStoresExplain(tuple);
        usedSkuRpc = true;
      } else {
        payload = await loadProductMaterialsStoresExplain(tuple);
      }
      if (!isMsExplainResponseCurrent(row, requestIdentity)) return;
      if (!payload) {
        replaceMsExplainHost(
          renderMsExplainStateMessage(
            "Materials / Stores allocation explanation is unavailable for this selection.",
          ),
        );
        return;
      }
      const entry = buildMsExplainCacheEntry(payload);
      if (entry) msExplainCache.set(cacheKey, entry);
      replaceMsExplainHost(renderMsExplainSection(payload, { usedSkuRpc }));
    } catch (err) {
      console.warn("[costing-suite] Materials / Stores explain RPC failed", err);
      if (!isMsExplainResponseCurrent(row, requestIdentity)) return;
      if (isMsPermissionError(err)) {
        replaceMsExplainHost(
          renderMsExplainStateMessage(
            "Permission denied. Materials / Stores allocation explanation requires module:cost-sheet-review can_view.",
            "cp-ms-explain-denied",
          ),
        );
        return;
      }
      replaceMsExplainHost(
        renderMsExplainStateMessage(
          "Materials / Stores allocation explanation could not be loaded.",
        ),
      );
    }
  }

  /**
   * Primary queue action: open full Cost Sheet Explain for Materials / Stores Overhead
   * so base lineage + MS Explain + Monthly Allocation Driver all compose.
   */
  async function openSkuMaterialsStoresExplainFromQueue(row = {}) {
    const periodStart = String(
      row.period_start ||
        (typeof getActivePeriodStart === "function"
          ? getActivePeriodStart()
          : "") ||
        "",
    ).trim();
    const productId = Number(row.product_id);
    const skuId = Number(row.sku_id);
    if (!periodStart || !Number.isFinite(productId) || !Number.isFinite(skuId)) {
      showToast?.(
        "SKU Materials / Stores Explain needs period, product and SKU context.",
        "warning",
      );
      return false;
    }
    const valuationDate =
      normalizePrintableDateOnly(
        row.valuation_date ??
          row.valuationDate ??
          currentPrintableExactRunContext?.valuationDate,
      ) || undefined;
    const refreshRunRaw =
      row.refresh_run_id ??
      row.refreshRunId ??
      currentPrintableExactRunContext?.refreshRunId;
    const refreshRunNum = Number(refreshRunRaw);
    const refreshRunId = Number.isFinite(refreshRunNum)
      ? refreshRunNum
      : undefined;
    await openCostSheetExplainDrawer({
      periodStart,
      valuationDate,
      refreshRunId,
      productId,
      skuId,
      lineLabel: MATERIALS_STORES_OVERHEAD_LINE_LABEL,
      productName: row.product_name,
      skuLabel: row.sku_column_label,
    });
    return true;
  }

  /**
   * Secondary queue action: Product-only Materials / Stores Explain (no SKU Monthly Driver).
   */
  async function openProductMaterialsStoresExplainFromQueue(row = {}) {
    if (!costSheetExplainDrawer || !costSheetExplainContent) return false;
    const period_start = String(
      row.period_start ||
        (typeof getActivePeriodStart === "function"
          ? getActivePeriodStart()
          : "") ||
        "",
    ).trim();
    const product_id = Number(row.product_id);
    if (!period_start || !Number.isFinite(product_id)) {
      showToast?.(
        "Product Materials / Stores Explain needs period and product context.",
        "warning",
      );
      return false;
    }

    costSheetExplainReturnFocus = document.activeElement;
    costSheetExplainDrawer.classList.remove("hidden");
    costSheetExplainDrawer.setAttribute("aria-hidden", "false");
    const synthetic = {
      period_start,
      product_id,
      sku_id: null,
      line_label: MATERIALS_STORES_OVERHEAD_LINE_LABEL,
      product_name: row.product_name,
      refresh_run_id: row.refresh_run_id,
      valuation_date: row.valuation_date,
    };
    setCostSheetExplainHeader(synthetic, {
      lineLabel: MATERIALS_STORES_OVERHEAD_LINE_LABEL,
      productName: row.product_name,
      periodStart: period_start,
    });
    currentExplainTraceabilityRow = synthetic;
    costSheetExplainContent.innerHTML = renderMsExplainLoading();
    setTimeout(() => {
      costSheetExplainCloseBtn?.focus();
    }, 0);
    void fillMsExplainSection(synthetic);
    return true;
  }

  function renderTraceSummary(summary, { component = "RM" } = {}) {
    if (!summary) return "";
    const items = [
      ["RM Total", formatMoney(summary.rm_total)],
      [
        "Contribution Lines",
        formatNumber(summary.contribution_line_count),
      ],
      ["OK Lines", formatNumber(summary.ok_line_count)],
      ["Review Lines", formatNumber(summary.review_line_count)],
      ["Blocked Lines", formatNumber(summary.blocked_line_count)],
      [
        "Calculation Warning Lines",
        formatNumber(summary.calculation_warning_line_count),
      ],
      [
        "Largest Contribution %",
        formatPercent(summary.largest_contribution_share_percent),
      ],
      ["Summary Status", compactStatusText(summary.summary_status)],
      [
        "Snapshot Refreshed",
        formatDateTime(summary.snapshot_refreshed_at),
      ],
    ];

    const detailAvailable = summary.confidential_detail_available === true;
    const ctaSection = detailAvailable
      ? `<section class="cp-detail-section cost-sheet-drill-section">
          <h3 class="cp-section-title">Confidential Detail</h3>
          <div class="cost-sheet-drill-actions">
            <button
              type="button"
              class="icon-btn icon-btn-primary cost-sheet-drill-btn"
              data-rm-trace-drill="true"
              data-trace-component="${text(component, "RM")}"
            >Open RM Cost Trace</button>
          </div>
        </section>`
      : `<section class="cp-detail-section">
          <h3 class="cp-section-title">Confidential Detail</h3>
          <div class="status">Detailed RM contribution trace is restricted.</div>
        </section>`;

    return detailPanel([
      kvSection("RM Contribution Summary", items),
      ctaSection,
    ]);
  }

  async function loadCostSheetRmExplainSummary({
    periodStart,
    productId,
    skuId,
  } = {}) {
    const period = String(periodStart ?? "").trim();
    if (!period || productId == null || skuId == null) return null;
    if (typeof costingRpc !== "function") return null;

    try {
      const { data, error } = await costingRpc(
        "rpc_get_cost_sheet_rm_explain_summary",
        {
          p_period_start: period,
          p_product_id: Number(productId),
          p_sku_id: Number(skuId),
        },
      );
      if (error) {
        console.warn(
          "[costing-suite] rpc_get_cost_sheet_rm_explain_summary failed",
          error,
        );
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      return row || null;
    } catch (err) {
      console.warn(
        "[costing-suite] rpc_get_cost_sheet_rm_explain_summary exception",
        err,
      );
      return null;
    }
  }

  async function openRmCostTraceFromExplain(summary, params = {}) {
    if (!navigateTraceabilityDrill || !summary) {
      showExplainDrillUnavailableMessage();
      return;
    }

    const sourceLensId =
      (typeof getCurrentLens === "function" && getCurrentLens()) ||
      "printable-cost-sheet";

    const row = {
      drill_route_module_key: "material-cost-manager",
      drill_route_lens_id: "rm-cost-trace",
      source_module_key: "cost-sheet-review",
      source_lens_id: sourceLensId,
      source_module_label: "Cost Sheet Review & Approval",
      drill_filter_json: {
        trace_component: "RM",
        material_area: "RM",
        period_start: summary.period_start || params.periodStart,
        product_id: summary.product_id ?? params.productId,
        sku_id: summary.sku_id ?? params.skuId,
        ...(params.stockItemId != null
          ? { stock_item_id: params.stockItemId }
          : {}),
      },
    };

    if (!canNavigateTraceabilityDrill?.(row)) {
      showExplainDrillUnavailableMessage();
      return;
    }

    const navigated = await navigateTraceabilityDrill(row, {
      onBeforeNavigate: () => {
        closeCostSheetExplainDrawer();
      },
    });
    if (!navigated) showExplainDrillUnavailableMessage();
  }

  async function openCostSheetExplainDrawer(params = {}) {
    if (!costSheetExplainDrawer || !costSheetExplainContent) return;

    const loadToken = ++costSheetExplainLoadToken;
    const requestIdentity = explainRequestIdentity(params);

    costSheetExplainReturnFocus = document.activeElement;
    costSheetExplainDrawer.classList.remove("hidden");
    costSheetExplainDrawer.setAttribute("aria-hidden", "false");
    setCostSheetExplainLoading({
      lineLabel: params.lineLabel,
      periodStart: params.periodStart,
      valuationDate: params.valuationDate,
      refreshRunId: params.refreshRunId,
    });

    setTimeout(() => {
      costSheetExplainCloseBtn?.focus();
    }, 0);

    if (isRawMaterialCostExplainLine(params)) {
      const summary = await loadCostSheetRmExplainSummary(params);
      if (loadToken !== costSheetExplainLoadToken) return;
      if (explainRequestIdentity(params) !== requestIdentity) return;
      if (!summary) {
        if (costSheetExplainTitle) {
          costSheetExplainTitle.textContent =
            params.lineLabel || "Explain Line";
        }
        if (costSheetExplainSubtitle) {
          costSheetExplainSubtitle.innerHTML = "";
        }
        costSheetExplainContent.innerHTML =
          '<div class="status">RM contribution summary is not available for this line. Run costing refresh and try again.</div>';
        currentExplainTraceabilityRow = null;
        return;
      }

      setCostSheetExplainHeader(
        {
          line_label: params.lineLabel,
          period_start: summary.period_start || params.periodStart,
          valuation_date:
            summary.valuation_date || params.valuationDate || null,
          refresh_run_id:
            summary.refresh_run_id ?? params.refreshRunId ?? null,
          product_id: summary.product_id,
          sku_id: summary.sku_id,
          product_name: params.productName,
          sku_column_label: params.skuLabel,
        },
        params,
      );
      currentExplainTraceabilityRow = {
        __rmExplainSummary: true,
        summary,
        params,
      };
      costSheetExplainContent.innerHTML = [
        renderExplainContextSection(
          {
            period_start: summary.period_start || params.periodStart,
            valuation_date:
              summary.valuation_date || params.valuationDate || null,
            refresh_run_id:
              summary.refresh_run_id ?? params.refreshRunId ?? null,
          },
          params,
        ),
        renderTraceSummary(summary, { component: "RM" }),
      ].join("");
      return;
    }

    const result = await loadCostSheetLineTraceability(params);
    if (loadToken !== costSheetExplainLoadToken) return;
    if (explainRequestIdentity(params) !== requestIdentity) return;

    if (isTraceabilityLoadError(result)) {
      if (costSheetExplainTitle) {
        costSheetExplainTitle.textContent = params.lineLabel || "Explain Line";
      }
      setCostSheetExplainHeader(
        {
          line_label: params.lineLabel,
          period_start: params.periodStart,
          valuation_date: params.valuationDate,
          refresh_run_id: params.refreshRunId,
          product_name: params.productName,
          sku_column_label: params.skuLabel,
        },
        params,
      );
      currentExplainTraceabilityRow = null;
      costSheetExplainContent.innerHTML = `<div class="status">${text(
        result.message ||
          "Traceability is not available for this line. Run costing refresh and try again.",
      )}</div>`;
      return;
    }

    const row = result;
    if (!row) {
      if (costSheetExplainTitle) {
        costSheetExplainTitle.textContent = params.lineLabel || "Explain Line";
      }
      setCostSheetExplainHeader(
        {
          line_label: params.lineLabel,
          period_start: params.periodStart,
          valuation_date: params.valuationDate,
          refresh_run_id: params.refreshRunId,
          product_name: params.productName,
          sku_column_label: params.skuLabel,
        },
        params,
      );
      currentExplainTraceabilityRow = null;
      costSheetExplainContent.innerHTML =
        '<div class="status">Traceability is not available for this line. Run costing refresh and try again.</div>';
      return;
    }

    setCostSheetExplainHeader(row, params);
    currentExplainTraceabilityRow = row;
    const explainHtml = renderCostSheetExplainContent(row, params);
    const showMarketing = isMarketingExpenseExplainLine(row);
    const showQc = isQualityControlOverheadExplainLine(row);
    const showMs = isMaterialsStoresOverheadExplainLine(row);
    const showMonthly = isMonthlyAllocationDriverExplainLine(row);
    const sections = [explainHtml];
    if (showMarketing) sections.push(renderMarketingExplainLoading());
    if (showQc) sections.push(renderQcExplainLoading());
    if (showMs) sections.push(renderMsExplainLoading());
    if (showMonthly) sections.push(renderMonthlyAllocationDriverLoading());
    costSheetExplainContent.innerHTML = sections.join("");
    if (showMarketing) void fillMarketingExplainSection(row);
    if (showQc) void fillQcExplainSection(row);
    if (showMs) void fillMsExplainSection(row);
    if (showMonthly) void fillMonthlyAllocationDriverSection(row);
  }

  function handleCostSheetExplainDrillClick(event) {
    const rmButton = event.target.closest("[data-rm-trace-drill]");
    if (rmButton && costSheetExplainContent?.contains(rmButton)) {
      event.preventDefault();
      event.stopPropagation();
      const current = currentExplainTraceabilityRow;
      void openRmCostTraceFromExplain(current?.summary, current?.params || {});
      return;
    }

    const button = event.target.closest("[data-traceability-drill]");
    if (!button || !costSheetExplainContent?.contains(button)) return;

    event.preventDefault();
    event.stopPropagation();
    void handleTraceabilityDrillback();
  }

  function handleCostSheetExplainCellClick(event) {
    const cell = event.target.closest("td[data-explain-enabled='true']");
    if (!cell || !costSheetA4?.contains(cell)) return;

    event.preventDefault();
    event.stopPropagation();
    selectCostSheetExplainCell(cell);
  }

  function handleCostSheetExplainCellDblClick(event) {
    const cell = event.target.closest("td[data-explain-enabled='true']");
    if (!cell || !costSheetA4?.contains(cell)) return;

    event.preventDefault();
    event.stopPropagation();
    selectCostSheetExplainCell(cell);
    if (selectedExplainContext) {
      void openCostSheetExplainDrawer(selectedExplainContext);
    }
  }

  function handleCostSheetExplainCellKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;

    const cell = event.target.closest("td[data-explain-enabled='true']");
    if (!cell || !costSheetA4?.contains(cell)) return;

    event.preventDefault();
    selectCostSheetExplainCell(cell);
    if (event.key === "Enter" && selectedExplainContext) {
      void openCostSheetExplainDrawer(selectedExplainContext);
    }
  }

  function handleCostSheetExplainToolbarClick() {
    if (!selectedExplainContext) return;
    void openCostSheetExplainDrawer(selectedExplainContext);
  }

  function buildCostSheetA4Table(rows, skuColumns, options = {}) {
    const { enableExplain = false, explainContext = {} } = options;
    const sectionMap = new Map();
    rows.forEach((row) => {
      if (row.section_code === "Z_STATUS") return;
      const sectionKey = `${row.section_code || ""}::${row.section_title || ""}`;
      if (!sectionMap.has(sectionKey)) {
        sectionMap.set(sectionKey, {
          section_code: row.section_code,
          section_title: row.section_title,
          lines: new Map(),
        });
      }
      const section = sectionMap.get(sectionKey);
      const lineKey = [
        row.section_code || "",
        row.section_title || "",
        row.line_order ?? "",
        row.line_label || "",
      ].join("::");
      if (!section.lines.has(lineKey)) {
        section.lines.set(lineKey, {
          section_code: row.section_code,
          section_title: row.section_title,
          line_order: row.line_order,
          line_label: row.line_label,
          calculation_basis: row.calculation_basis,
          source_note: row.source_note,
          values: new Map(),
        });
      }
      section.lines
        .get(lineKey)
        .values.set(printableSkuMapKey(row), row);
    });

    return [...sectionMap.values()]
      .sort((a, b) => {
        const section = String(a.section_code || "").localeCompare(
          String(b.section_code || ""),
        );
        if (section) return section;
        return String(a.section_title || "").localeCompare(
          String(b.section_title || ""),
        );
      })
      .map((section) => {
        const lines = [...section.lines.values()].sort((a, b) => {
          const ao = Number(a.line_order ?? 0);
          const bo = Number(b.line_order ?? 0);
          if (ao !== bo) return ao - bo;
          return String(a.line_label || "").localeCompare(
            String(b.line_label || ""),
          );
        });
        const desc = sectionDescription(section.section_code);
        const bodyRows = lines
          .map((line) => {
            const calc =
              line.calculation_basis && shouldShowCalculationInPrint(line)
                ? `<span class="cost-sheet-line-calc">${text(line.calculation_basis)}</span>`
                : "";
            return `<tr class="${costSheetLineClass(line)}">
            <td class="cost-sheet-td-component"><span class="cost-sheet-line-label">${text(normalizeCostSheetDisplayLabel(line.line_label))}</span>${calc}</td>
            ${skuColumns
              .map((sku) => {
                const valueRow = line.values.get(printableSkuMapKey(sku));
                const isText =
                  String(valueRow?.value_type || "").toLowerCase() === "text";
                const explainContextData =
                  enableExplain && valueRow
                    ? buildCostSheetExplainContext(
                        valueRow,
                        line,
                        sku,
                        explainContext,
                      )
                    : null;
                const cellClasses = [
                  "cost-sheet-td-value",
                  isText ? "cost-sheet-text-cell" : "",
                  explainContextData
                    ? "cost-sheet-value-cell-explainable cost-sheet-screen-only"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                const explainAttrs = explainContextData
                  ? buildExplainableValueCellAttrs(explainContextData)
                  : "";
                return `<td class="${cellClasses}" ${explainAttrs}><span class="cost-sheet-value-text">${formatPrintableValue(valueRow)}</span></td>`;
              })
              .join("")}
          </tr>`;
          })
          .join("");
        return `
        <div class="cost-sheet-section-title">${text(section.section_title || section.section_code || "Section")}</div>
        ${desc ? `<div class="cost-sheet-section-desc">${text(desc)}</div>` : ""}
        <table class="cost-sheet-table">
          <colgroup>
            <col class="cost-sheet-col-component" />
            ${skuColumns.map(() => `<col class="cost-sheet-col-value" />`).join("")}
          </colgroup>
          <thead>
            <tr>
              <th class="cost-sheet-th-component" scope="col">${text(costSheetFirstColumnHeader(section.section_code))}</th>
              ${skuColumns.map((sku) => `<th class="cost-sheet-th-value" scope="col">${text(sku.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>`;
      })
      .join("");
  }

  function buildCostSheetStatusNote(rows) {
    const statusNotes = uniqueValues(rows, "cost_sheet_note");
    const status = uniqueValues(rows, "cost_sheet_status").map(normalizeStatus);
    const note = statusNotes.find(Boolean);
    const stat = status.includes("BLOCKED")
      ? "BLOCKED"
      : status.includes("REVIEW_REQUIRED")
        ? "REVIEW_REQUIRED"
        : status[0] || "";
    if (!note && !stat) return "";
    return `<div class="cost-sheet-status-note"><strong>Status:</strong> ${text(stat || "--")}${note ? ` &mdash; ${text(note)}` : ""}</div>`;
  }

  function resolveProductRowForModal(productId, periodStart, lines, summaryRow) {
    return (
      summaryRow ||
      findProductSummaryRow(productId, periodStart) ||
      groupPrintableLinesByProduct(lines)[0] ||
      lines[0] ||
      {}
    );
  }

  function abortCostSheetModalLoad(message, tone = "error") {
    if (costSheetA4) costSheetA4.innerHTML = "";
    printableLines = [];
    currentCostSheetProductId = null;
    currentPrintableExactRunContext = null;
    currentPrintableSummaryRow = null;
    if (costSheetModal) {
      costSheetModal.classList.add("hidden");
      costSheetModal.setAttribute("aria-hidden", "true");
    }
    showToast(message, tone);
  }

  async function openCostSheetModal(productId, options = {}) {
    if (!costSheetModal || !costSheetA4) return;

    const periodStart = getActivePeriodStart();
    if (!periodStart) {
      showToast("Select a costing period first.", "info");
      return;
    }

    const summaryRow =
      options.summaryRow || findProductSummaryRow(productId, periodStart);
    const exactRunContext = resolvePrintableExactRunContext(summaryRow);
    if (!exactRunContext) {
      showToast(PRINTABLE_INCOMPLETE_CONTEXT_MESSAGE, "error");
      return;
    }

    if (costSheetModal.classList.contains("hidden")) {
      costSheetReturnFocus = document.activeElement;
    }
    currentCostSheetProductId = productId;
    currentPrintableSummaryRow = summaryRow;
    currentPrintableExactRunContext = exactRunContext;
    printableLines = [];

    if (costSheetModalTitle) {
      costSheetModalTitle.textContent = "Cost Sheet Review";
    }
    if (costSheetModalSubtitle) {
      costSheetModalSubtitle.textContent = `${summaryRow?.product_name || productId || ""} | ${formatPeriodMonth(periodStart)}`;
    }
    if (costSheetModalHint) {
      costSheetModalHint.textContent =
        "Printable output is available from Export PDF.";
    }

    costSheetModal.classList.remove("hidden");
    costSheetModal.setAttribute("aria-hidden", "false");
    clearCostSheetExplainSelection();
    costSheetA4.innerHTML = `<div class="cost-sheet-explain-loading"><span class="cp-loading-spinner" aria-hidden="true"></span><span>Loading printable cost sheet lines...</span></div>`;

    let rows;
    try {
      rows = await loadPrintableLinesForProduct(exactRunContext);
    } catch (err) {
      console.error("[costing-suite] loadPrintableLinesForProduct failed", err);
      const message =
        err instanceof PrintableExactRunLoadError
          ? err.message
          : "Failed to load cost sheet lines for this product.";
      abortCostSheetModalLoad(message, "error");
      return;
    }

    if (!rows.length) {
      abortCostSheetModalLoad(PRINTABLE_EMPTY_LINES_MESSAGE, "info");
      return;
    }

    printableLines = rows;
    const first = rows[0] || {};
    const productRow = resolveProductRowForModal(
      productId,
      periodStart,
      rows,
      summaryRow,
    );
    const skuColumns = getPrintableSkuColumns(rows);
    const tableHtml = buildCostSheetA4Table(rows, skuColumns, {
      enableExplain: isCostSheetLineExplainEnabled(),
      explainContext: {
        periodStart: productRow.period_start || first.period_start || periodStart,
        productId: productRow.product_id ?? productId,
        valuationDate:
          exactRunContext.valuationDate ||
          productRow.valuation_date ||
          first.valuation_date,
        refreshRunId:
          exactRunContext.refreshRunId ??
          productRow.refresh_run_id ??
          first.refresh_run_id,
      },
    });
    const notesHtml = buildCostSheetStatusNote(rows);

    const exportedAt = getExportedAtIst();
    costSheetA4.innerHTML = `
    <div class="cost-sheet-letterhead">
      <div class="cost-sheet-company">
        <div class="cost-sheet-org">Santhigiri Ayurveda Siddha Vaidyasala</div>
        <div class="cost-sheet-address">
          Santhigiri Ashram, Santhigiri P O, Thiruvananthapuram, Kerala, 695589
        </div>
        <div class="cost-sheet-title">Cost Sheet - ${text(productRow.product_name || productRow.product_id)}</div>
      </div>
      <div class="cost-sheet-logo-wrap">
        <img src="./assets/santhigiri-logo.png" class="cost-sheet-logo" alt="Santhigiri Logo" onerror="this.style.display='none'">
      </div>
    </div>

    <div class="cost-sheet-hierarchy-line">
      <span><strong>Category:</strong> ${text(productRow.category_name)}</span>
      <span class="cs-sep">||</span>
      <span><strong>Sub-category:</strong> ${text(productRow.subcategory_name)}</span>
      <span class="cs-sep">||</span>
      <span><strong>Group:</strong> ${text(productRow.group_name)}</span>
      <span class="cs-sep">||</span>
      <span><strong>Sub-group:</strong> ${text(productRow.sub_group_name)}</span>
    </div>

    <div class="cost-sheet-date-line">Costing Period: ${formatPeriodMonth(productRow.period_start)}</div>

    ${tableHtml}

    ${notesHtml}

    <div class="cost-sheet-signatures">
      <div>
        <div class="cost-sheet-sig-title">Prepared By</div>
        <div class="cost-sheet-sig-role">${text(costSheetSignatories.preparedRole)}</div>
        <div class="cost-sheet-sig-org">${text(costSheetSignatories.preparedOrg)}</div>
      </div>
      <div>
        <div class="cost-sheet-sig-title">Verified By</div>
        <div class="cost-sheet-sig-role">${text(costSheetSignatories.verifiedRole)}</div>
        <div class="cost-sheet-sig-org">${text(costSheetSignatories.verifiedOrg)}</div>
      </div>
      <div>
        <div class="cost-sheet-sig-title">Approved By</div>
        <div class="cost-sheet-sig-role">${text(costSheetSignatories.approvedRole)}</div>
        <div class="cost-sheet-sig-org">${text(costSheetSignatories.approvedOrg)}</div>
      </div>
    </div>
    <div class="cost-sheet-bottom-line"></div>
    <div class="cost-sheet-export-footer">
      Exported by: ${text(getCurrentExportUser())} | Exported at: ${text(exportedAt)} IST
    </div>`;
    costSheetModal.classList.remove("hidden");
    costSheetModal.setAttribute("aria-hidden", "false");

    clearCostSheetExplainSelection();

    setTimeout(() => {
      costSheetPdfBtn?.focus();
    }, 0);
  }

  function formatPrintablePdfValue(row) {
    if (!row) return "--";
    const type = String(row.value_type || "").toLowerCase();
    if (type === "currency") {
      if (
        row.value_numeric === null ||
        row.value_numeric === undefined ||
        row.value_numeric === ""
      )
        return "--";
      const n = Number(row.value_numeric);
      return Number.isFinite(n)
        ? `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : String(row.value_numeric);
    }
    if (type === "percent") {
      if (
        row.value_numeric === null ||
        row.value_numeric === undefined ||
        row.value_numeric === ""
      )
        return "--";
      const n = Number(row.value_numeric);
      return Number.isFinite(n)
        ? `${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
        : String(row.value_numeric);
    }
    if (type === "text") return String(row.value_text || "--");
    if (
      row.value_text !== null &&
      row.value_text !== undefined &&
      row.value_text !== ""
    )
      return String(row.value_text);
    if (
      row.value_numeric === null ||
      row.value_numeric === undefined ||
      row.value_numeric === ""
    )
      return "--";
    const n = Number(row.value_numeric);
    return Number.isFinite(n)
      ? n.toLocaleString("en-IN", { maximumFractionDigits: 3 })
      : String(row.value_numeric);
  }

  function isStrongCostSheetLine(label) {
    const l = String(label || "").toLowerCase();
    return (
      l.includes("total material cost") ||
      l.includes("manufacturing cop") ||
      l.includes("internal loaded cost") ||
      l.includes("sales realisation") ||
      l.includes("profit value")
    );
  }

  function buildCostSheetPdfBody(rows, skuColumns) {
    const lineMap = new Map();

    rows.forEach((row) => {
      if (row.section_code === "Z_STATUS") return;

      const key = [
        row.section_code || "",
        row.section_title || "",
        row.line_order ?? "",
        row.line_label || "",
      ].join("::");

      if (!lineMap.has(key)) {
        lineMap.set(key, {
          section_code: row.section_code,
          section_title: row.section_title,
          line_order: row.line_order,
          line_label: row.line_label,
          calculation_basis: row.calculation_basis,
          values: new Map(),
        });
      }

      lineMap
        .get(key)
        .values.set(String(row.sku_id ?? row.sku_column_label ?? ""), row);
    });

    const lines = [...lineMap.values()].sort((a, b) => {
      const section = String(a.section_code || "").localeCompare(
        String(b.section_code || ""),
      );
      if (section) return section;
      const ao = Number(a.line_order ?? 0);
      const bo = Number(b.line_order ?? 0);
      if (ao !== bo) return ao - bo;
      return String(a.line_label || "").localeCompare(String(b.line_label || ""));
    });

    const head = [
      ["Component", ...skuColumns.map((sku) => String(sku.label || "--"))],
    ];
    const bodyRows = [];
    let currentKey = null;

    lines.forEach((line) => {
      const key = `${line.section_code || ""}::${line.section_title || ""}`;
      if (currentKey !== key) {
        currentKey = key;
        const sectionRow = [
          {
            content: line.section_title || line.section_code || "Section",
            colSpan: skuColumns.length + 1,
          },
        ];
        sectionRow._marker = "section";
        sectionRow._sectionCode = line.section_code;
        bodyRows.push(sectionRow);

        const desc = sectionDescription(line.section_code);
        if (desc) {
          const descRow = [
            {
              content: desc,
              colSpan: skuColumns.length + 1,
            },
          ];
          descRow._marker = "section_desc";
          bodyRows.push(descRow);
        }
      }

      const displayLabel = normalizeCostSheetDisplayLabel(line.line_label);
      const hasFormula = Boolean(
        line.calculation_basis && shouldShowCalculationInPrint(line),
      );
      const trimmedBasis = String(line.calculation_basis ?? "")
        .replace(/^[\s\t\r\n]+/, "")
        .replace(/[\s\t\r\n]+$/, "");
      const componentText = hasFormula
        ? `${displayLabel}\n[${trimmedBasis}]`
        : displayLabel;
      const valueRow = [
        componentText,
        ...skuColumns.map((sku) => {
          const row = line.values.get(String(sku.sku_id ?? sku.label ?? ""));
          return formatPrintablePdfValue(row);
        }),
      ];
      valueRow._marker = isStrongCostSheetLine(line.line_label) ? "strong" : "";
      valueRow._hasFormula = hasFormula;
      valueRow._label = displayLabel;
      valueRow._lineLabel = displayLabel;
      bodyRows.push(valueRow);
    });

    return { head, bodyRows };
  }

  function addCostSheetPdfFooter(doc, dims, exportedBy, exportedAt) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(90);
      doc.text(
        `Exported by: ${exportedBy} | Exported at: ${exportedAt} IST`,
        dims.ML,
        dims.PH - 6,
        {
          maxWidth: dims.CW * 0.78,
        },
      );
      doc.text(`Page ${i} of ${pageCount}`, dims.PW - dims.MR, dims.PH - 6, {
        align: "right",
      });
    }
    doc.setTextColor(17, 24, 39);
  }

  function loadImageAsDataUrl(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve({
            dataUrl: canvas.toDataURL("image/png"),
            nw: canvas.width,
            nh: canvas.height,
          });
        } catch (err) {
          console.warn("[Cost Sheet PDF] Logo conversion failed", err);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function generateCostSheetPdf(productId) {
    const jspdfLib = window.jspdf;
    if (!jspdfLib?.jsPDF) {
      showToast("PDF library is not available. Please reload the page.", "error");
      return;
    }

    const periodStart = getActivePeriodStart();
    if (!periodStart) {
      showToast("Select a costing period first.", "info");
      return;
    }

    const exactRunContext =
      currentPrintableExactRunContext &&
      String(currentPrintableExactRunContext.productId) === String(productId)
        ? currentPrintableExactRunContext
        : resolvePrintableExactRunContext(
            currentPrintableSummaryRow ||
              findProductSummaryRow(productId, periodStart),
          );
    if (!exactRunContext) {
      showToast(PRINTABLE_INCOMPLETE_CONTEXT_MESSAGE, "error");
      return;
    }

    let rows;
    try {
      rows = await loadPrintableLinesForProduct(exactRunContext);
    } catch (err) {
      console.error("[costing-suite] generateCostSheetPdf line load failed", err);
      const message =
        err instanceof PrintableExactRunLoadError
          ? err.message
          : "Failed to load cost sheet lines for PDF.";
      showToast(message, "error");
      return;
    }

    printableLines = rows;
    if (!rows.length) {
      showToast(PRINTABLE_EMPTY_LINES_MESSAGE, "error");
      return;
    }

    const first = rows[0] || {};
    const productRow =
      currentPrintableSummaryRow ||
      findProductSummaryRow(productId, periodStart) ||
      groupPrintableLinesByProduct(rows)[0] ||
      first;
    const skuColumns = getPrintableSkuColumns(rows);
    const exportedAt = getExportedAtIst();

    const { jsPDF } = jspdfLib;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    if (typeof doc.autoTable !== "function") {
      showToast(
        "PDF table plugin is not available. Please reload the page.",
        "error",
      );
      return;
    }

    const pageSize = doc.internal.pageSize;
    const PW = pageSize.getWidth();
    const PH = pageSize.getHeight();
    const ML = 12;
    const MR = 12;
    const MT = 12;
    const MB = 14;
    const CW = PW - ML - MR;
    const dims = { PW, PH, ML, MR, MT, MB, CW };

    const { head, bodyRows } = buildCostSheetPdfBody(rows, skuColumns);
    const componentColWidth = Math.max(52, Math.min(78, CW * 0.36));
    const skuColWidth = (CW - componentColWidth) / Math.max(skuColumns.length, 1);
    const columnStyles = {
      0: {
        cellWidth: componentColWidth,
        halign: "left",
        overflow: "linebreak",
      },
    };
    skuColumns.forEach((_, idx) => {
      columnStyles[idx + 1] = {
        cellWidth: skuColWidth,
        halign: "right",
        overflow: "linebreak",
      };
    });
    let y = MT;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(17, 24, 39);
    doc.setLineWidth(0.35);
    doc.setDrawColor(75, 85, 99);
    doc.line(ML, y, PW - MR, y);
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("Santhigiri Ayurveda Siddha Vaidyasala", ML, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.text("Santhigiri Ashram, Santhigiri P O", ML, y);
    y += 3.2;
    doc.text("Thiruvananthapuram, Kerala, 695589", ML, y);

    try {
      const logoInfo = await loadImageAsDataUrl("./assets/santhigiri-logo.png");
      if (logoInfo) {
        const maxW = 22;
        const maxH = 22;
        const aspect = logoInfo.nw / logoInfo.nh;
        let w = maxW;
        let h = w / aspect;
        if (h > maxH) {
          h = maxH;
          w = h * aspect;
        }
        doc.addImage(logoInfo.dataUrl, "PNG", PW - MR - w, MT + 3, w, h);
      }
    } catch (err) {
      console.warn("[Cost Sheet PDF] Logo load failed", err);
    }

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(
      `COST SHEET - ${String(productRow.product_name || "").toUpperCase()}`,
      ML,
      y,
    );
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    const hierarchyText =
      `Category: ${productRow.category_name || "--"}  ||  ` +
      `Sub-category: ${productRow.subcategory_name || "--"}  ||  ` +
      `Group: ${productRow.group_name || "--"}  ||  ` +
      `Sub-group: ${productRow.sub_group_name || "--"}`;
    const hierarchyLines = doc.splitTextToSize(hierarchyText, CW);
    doc.text(hierarchyLines, ML, y);
    y += hierarchyLines.length * 3.4 + 1.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.text(
      `Costing Period: ${formatPeriodMonth(productRow.period_start)}`,
      ML,
      y,
    );
    y += 4;

    doc.autoTable({
      startY: y,
      head,
      body: bodyRows,
      theme: "grid",
      showHead: "everyPage",
      margin: { left: ML, right: MR, top: MT + 4, bottom: MB + 8 },
      tableWidth: CW,
      rowPageBreak: "avoid",
      tableLineColor: [80, 80, 80],
      tableLineWidth: 0.12,
      styles: {
        font: "helvetica",
        fontSize: 6.7,
        cellPadding: { top: 0.75, right: 1.0, bottom: 0.75, left: 1.0 },
        lineColor: [90, 90, 90],
        lineWidth: 0.12,
        textColor: [17, 24, 39],
        overflow: "linebreak",
        valign: "middle",
        fontStyle: "normal",
        lineHeightFactor: 1.05,
      },
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [17, 24, 39],
        fontStyle: "bold",
        fontSize: 6.9,
        halign: "center",
        lineColor: [80, 80, 80],
        lineWidth: 0.12,
      },
      columnStyles,
      didParseCell: (data) => {
        const raw = data.row.raw;
        const marker = raw?._marker;

        if (marker === "section") {
          data.cell.styles.fillColor = [255, 255, 255];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 8.0;
          data.cell.styles.halign = "left";
          data.cell.styles.textColor = [17, 24, 39];
          data.cell.styles.lineColor = [51, 51, 51];
          data.cell.styles.lineWidth = {
            top: 0.22,
            right: 0,
            bottom: 0.22,
            left: 0,
          };
          data.cell.styles.cellPadding = {
            top: 1.05,
            right: 1,
            bottom: 1.05,
            left: 1.4,
          };
        }

        if (marker === "section_desc") {
          data.cell.styles.fillColor = [255, 255, 255];
          data.cell.styles.fontStyle = "italic";
          data.cell.styles.fontSize = 6.4;
          data.cell.styles.halign = "left";
          data.cell.styles.textColor = [55, 65, 81];
          data.cell.styles.lineWidth = 0;
          data.cell.styles.cellPadding = {
            top: 0.55,
            right: 1,
            bottom: 0.55,
            left: 1.4,
          };
        }

        if (marker === "strong") {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 6.9;
        }

        if (data.section === "body" && data.column.index > 0) {
          data.cell.styles.halign = "right";
          data.cell.styles.valign = "middle";
        }

        if (
          marker === "strong" &&
          data.section === "body" &&
          data.column.index > 0
        ) {
          data.cell.styles.fontStyle = "bold";
        }

        if (
          data.section === "body" &&
          data.column.index === 0 &&
          data.row.raw?._hasFormula
        ) {
          data.cell.styles.fontSize = 6.2;
          data.cell.styles.fontStyle = "normal";
          data.cell.styles.textColor = [17, 24, 39];
          data.cell.styles.overflow = "linebreak";
          data.cell.styles.valign = "top";
          data.cell.styles.lineHeightFactor = 1.35;
          data.cell.styles.cellPadding = {
            top: 0.9,
            right: 1,
            bottom: 0.8,
            left: 1,
          };
        }
      },
    });

    y = doc.lastAutoTable.finalY + 4;

    const statusNotes = uniqueValues(rows, "cost_sheet_note").filter(Boolean);
    const statuses = uniqueValues(rows, "cost_sheet_status")
      .map(normalizeStatus)
      .filter(Boolean);
    const status = statuses.includes("BLOCKED")
      ? "BLOCKED"
      : statuses.includes("REVIEW_REQUIRED")
        ? "REVIEW_REQUIRED"
        : statuses[0] || "--";

    const requiredSigH = 34;
    if (y + requiredSigH > PH - MB) {
      doc.addPage();
      y = MT + 4;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.text(
      `Status: ${status}${statusNotes[0] ? ` - ${statusNotes[0]}` : ""}`,
      ML,
      y,
      { maxWidth: CW },
    );
    y += 16;

    const sigW = CW / 3;
    const sigY = y;
    const sigs = [
      [
        "Prepared By",
        costSheetSignatories.preparedRole,
        costSheetSignatories.preparedOrg,
      ],
      [
        "Verified By",
        costSheetSignatories.verifiedRole,
        costSheetSignatories.verifiedOrg,
      ],
      [
        "Approved By",
        costSheetSignatories.approvedRole,
        costSheetSignatories.approvedOrg,
      ],
    ];

    sigs.forEach((sig, idx) => {
      const x = ML + idx * sigW;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(sig[0], x, sigY);
      doc.setLineWidth(0.18);
      doc.line(x, sigY + 10, x + sigW - 8, sigY + 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.9);
      doc.text(sig[1], x, sigY + 14, { maxWidth: sigW - 8 });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(sig[2], x, sigY + 18, { maxWidth: sigW - 8 });
    });

    const filename = `cs-${toKebabSlug(productRow.product_name)}-${formatTodayIsoIst()}.pdf`;
    addCostSheetPdfFooter(doc, dims, getCurrentExportUser(), exportedAt);
    doc.save(filename);
    showToast(`Saved: ${filename}`, "success", 4000);
  }

  async function renderCostComparisonTab(tabId, row) {
    const selected = row || {};
    if (tabId === "overview") {
      return detailPanel([
        kvSection("Cost Comparison", [
          ["Product", text(selected.product_name || selected.product_id)],
          [
            "SKU",
            text(
              selected.sku_column_label ||
                selected.sku_display_name ||
                selected.sku_id,
            ),
          ],
          ["Snapshot Period", formatPeriodMonth(selected.snapshot_period_start)],
          [
            "Manufacturing COP",
            formatMoney(costComparisonValue(selected, "manufacturingCop")),
          ],
          [
            "Internal Loaded Cost",
            formatMoney(costComparisonValue(selected, "internalLoadedCost")),
          ],
          ["Profit IK", formatMoney(costComparisonValue(selected, "profitIk"))],
          ["Profit OK", formatMoney(costComparisonValue(selected, "profitOk"))],
        ]),
      ]);
    }

    if (tabId === "month-on-month") {
      const rows = [
        [
          "Manufacturing COP",
          costComparisonValue(selected, "manufacturingCop"),
          costComparisonValue(selected, "previousMonthCop"),
          costComparisonValue(selected, "momCopChangePercent"),
          "percent",
        ],
        [
          "Internal Loaded Cost",
          costComparisonValue(selected, "internalLoadedCost"),
          costComparisonValue(selected, "previousMonthInternalLoadedCost"),
          costComparisonValue(selected, "momInternalLoadedCostChangePercent"),
          "percent",
        ],
        [
          "Profit IK",
          costComparisonValue(selected, "profitIk"),
          costComparisonValue(selected, "previousMonthProfitIk"),
          costComparisonValue(selected, "momProfitIkChange"),
          "money",
        ],
        [
          "Profit OK",
          costComparisonValue(selected, "profitOk"),
          costComparisonValue(selected, "previousMonthProfitOk"),
          costComparisonValue(selected, "momProfitOkChange"),
          "money",
        ],
      ];
      return simpleTable(
        ["Metric", "Current", "Previous Month", "MoM Change"],
        rows,
        ([label, current, previous, change, changeType]) =>
          `<tr><td>${text(label)}</td><td class="c-right">${formatMoney(current)}</td><td class="c-right">${formatMoney(previous)}</td><td class="c-right">${changeType === "percent" ? formatPercent(change) : formatMoney(change)}</td></tr>`,
      );
    }

    const rows = [
      [
        "Manufacturing COP",
        costComparisonValue(selected, "manufacturingCop"),
        costComparisonValue(selected, "previousYearCop"),
        costComparisonValue(selected, "yoyCopChangePercent"),
        "percent",
      ],
      [
        "Internal Loaded Cost",
        costComparisonValue(selected, "internalLoadedCost"),
        costComparisonValue(selected, "previousYearInternalLoadedCost"),
        costComparisonValue(selected, "yoyInternalLoadedCostChangePercent"),
        "percent",
      ],
      [
        "Profit IK",
        costComparisonValue(selected, "profitIk"),
        costComparisonValue(selected, "previousYearProfitIk"),
        costComparisonValue(selected, "yoyProfitIkChange"),
        "money",
      ],
      [
        "Profit OK",
        costComparisonValue(selected, "profitOk"),
        costComparisonValue(selected, "previousYearProfitOk"),
        costComparisonValue(selected, "yoyProfitOkChange"),
        "money",
      ],
    ];
    return simpleTable(
      ["Metric", "Current", "Previous Year", "YoY Change"],
      rows,
      ([label, current, previous, change, changeType]) =>
        `<tr><td>${text(label)}</td><td class="c-right">${formatMoney(current)}</td><td class="c-right">${formatMoney(previous)}</td><td class="c-right">${changeType === "percent" ? formatPercent(change) : formatMoney(change)}</td></tr>`,
    );
  }

  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    costSheetCloseBtn?.addEventListener("click", closeCostSheetModal);
    costSheetPdfBtn?.addEventListener("click", openCostSheetSignModal);
    costSheetModal?.addEventListener("click", (e) => {
      if (e.target === costSheetModal) closeCostSheetModal();
    });
    costSheetSignCloseBtn?.addEventListener("click", closeCostSheetSignModal);
    costSheetSignCancelBtn?.addEventListener("click", closeCostSheetSignModal);
    costSheetSignConfirmBtn?.addEventListener(
      "click",
      confirmCostSheetSignatories,
    );
    costSheetSignModal?.addEventListener("click", (e) => {
      if (e.target === costSheetSignModal) closeCostSheetSignModal();
    });
    costSheetA4?.addEventListener("click", handleCostSheetExplainCellClick);
    costSheetA4?.addEventListener("dblclick", handleCostSheetExplainCellDblClick);
    costSheetA4?.addEventListener("keydown", handleCostSheetExplainCellKeydown);
    getCostSheetExplainBtn()?.addEventListener(
      "click",
      handleCostSheetExplainToolbarClick,
    );
    costSheetExplainContent?.addEventListener(
      "click",
      handleCostSheetExplainDrillClick,
    );
    costSheetExplainCloseBtn?.addEventListener(
      "click",
      closeCostSheetExplainDrawer,
    );
    costSheetExplainBackdrop?.addEventListener(
      "click",
      closeCostSheetExplainDrawer,
    );
  }

  function handleEscapeKeyForEditForms() {
    if (!costSheetSignModal?.classList.contains("hidden")) {
      closeCostSheetSignModal();
      return true;
    }
    return false;
  }

  function handleEscapeKey() {
    return handleEscapeKeyForEditForms();
  }

  function onLensSwitch() {
    closeCostSheetExplainDrawer();
    closeCostSheetModal();
  }

  function invalidatePrintableLinesCache() {
    printableProductSummaryCache = null;
    printableProductLinesCache.clear();
    printableLines = [];
    clearMonthlyAllocationDriverTraceCache();
    // Shared costing-data invalidation hook: selected period/lens snapshot context changed.
    clearMarketingExplainSummaryCache();
    clearQcExplainCache();
    clearMsExplainCache();
  }

  function onLensLoadStart() {
    closeCostSheetExplainDrawer();
    closeCostSheetModal();
    printableLines = [];
    printableProductSummaryCache = null;
    currentPrintableExactRunContext = null;
    currentPrintableSummaryRow = null;
    clearMonthlyAllocationDriverTraceCache();
    // Shared lens-load invalidation: period/run/snapshot context is reloading.
    clearMarketingExplainSummaryCache();
    clearQcExplainCache();
    clearMsExplainCache();
  }

  /**
   * Summary cache is reusable only when period matches and every cached row
   * still carries a complete exact-run tuple (period/valuation/run/product).
   * Stale pre-10F mapped rows fail this check and force a transparent refetch.
   */
  function isPrintableProductSummaryCacheValid(periodStart) {
    if (!printableProductSummaryCache) return false;
    if (
      printableProductSummaryCache.periodStart !==
      normalizePrintableCachePeriod(periodStart)
    ) {
      return false;
    }
    const rows = printableProductSummaryCache.rows;
    if (!Array.isArray(rows) || !rows.length) return false;
    return rows.every((row) => Boolean(resolvePrintableExactRunContext(row)));
  }

  async function loadPrintableLensRows(periodStart) {
    const periodKey = normalizePrintableCachePeriod(periodStart);
    if (isPrintableProductSummaryCacheValid(periodKey)) {
      return { groupedRows: printableProductSummaryCache.rows };
    }

    // Discard incomplete/stale shape before refetch (no user error).
    printableProductSummaryCache = null;

    const summaryRows = await fetchAllProductSummaryRowsForPeriod(periodStart);
    const groupedRows = summaryRows.map(mapProductSummaryRowToPrintableGroup);
    printableProductSummaryCache = {
      periodStart: periodKey,
      rows: groupedRows,
      fetchedAt: Date.now(),
    };
    return { groupedRows };
  }

  async function loadCostSheetLineTraceability({
    periodStart,
    productId,
    skuId,
    sectionCode,
    lineOrder,
    lineLabel,
    valuationDate,
    refreshRunId,
  } = {}) {
    const period = String(periodStart ?? "").trim();
    const label = String(lineLabel ?? "").trim();
    if (!period || productId == null || skuId == null || !label) {
      return null;
    }

    const exactMode = resolveTraceabilityExactRunMode({
      valuationDate,
      refreshRunId,
    });
    if (exactMode.mode !== "exact-run") {
      return {
        __traceLoadError: true,
        code: "MISSING_EXACT_RUN",
        message:
          "Exact costing run context (valuation date and refresh run) is required to explain this line.",
      };
    }

    try {
      let query = costingFrom(TRACEABILITY_VIEW)
        .select(
          [
            "period_start",
            "product_id",
            "product_name",
            "sku_id",
            "sku_column_label",
            "section_code",
            "line_order",
            "line_label",
            "line_description",
            "value_numeric",
            "value_text",
            "value_type",
            "cost_sheet_status",
            "trace_formula",
            "calculation_basis",
            "trace_summary",
            "source_note",
            "trace_source_type",
            "trace_source_snapshot",
            "source_module_label",
            "source_module_key",
            "source_lens_id",
            "audit_hint",
            "control_hint",
            "refresh_stage_code",
            "evidence_refreshed_at",
            "refreshed_at",
            "valuation_date",
            "refresh_run_id",
            "evidence_json",
            "drill_route_module_key",
            "drill_route_lens_id",
            "drill_filter_json",
          ].join(","),
        )
        .eq("period_start", period)
        .eq("valuation_date", exactMode.valuationDate)
        .eq("refresh_run_id", exactMode.refreshRunId)
        .eq("product_id", productId)
        .eq("sku_id", skuId)
        .eq("line_label", label);

      const section = String(sectionCode ?? "").trim();
      if (section) {
        query = query.eq("section_code", section);
      }

      if (lineOrder != null && lineOrder !== "") {
        query = query.eq("line_order", lineOrder);
      }

      const { data, error } = await query.maybeSingle();
      if (error) {
        console.warn(
          "[costing-suite] loadCostSheetLineTraceability query failed",
          error,
        );
        // maybeSingle errors when more than one row matches — fail closed.
        if (/multiple|more than one/i.test(String(error.message || ""))) {
          return {
            __traceLoadError: true,
            code: "AMBIGUOUS",
            message:
              "Multiple trace rows matched this line. Exact costing run context is required.",
          };
        }
        return {
          __traceLoadError: true,
          code: "QUERY_FAILED",
          message:
            "Traceability could not be loaded for this line. Try again after refresh completes.",
        };
      }

      const interpreted = interpretTraceabilityRows(data ? [data] : [], {
        expectedValuationDate: exactMode.valuationDate,
        expectedRefreshRunId: exactMode.refreshRunId,
        usedExactRunFilters: true,
      });
      if (!interpreted.ok) {
        return {
          __traceLoadError: true,
          code: interpreted.code,
          message: interpreted.message,
        };
      }
      return interpreted.row;
    } catch (err) {
      console.warn(
        "[costing-suite] loadCostSheetLineTraceability exception",
        err,
      );
      return {
        __traceLoadError: true,
        code: "EXCEPTION",
        message:
          "Traceability could not be loaded for this line. Try again after refresh completes.",
      };
    }
  }

  function getTableHeaders(lensId) {
    return TABLE_HEADERS[lensId] || null;
  }

  function getTableAlignments(lensId) {
    return TABLE_ALIGNMENTS[lensId] || null;
  }

  function renderTableRow(lensId, row, trAttrs) {
    if (lensId === "sku-cost-sheet") {
      return `<tr ${trAttrs}>
      <td class="lane-col"><span class="lane ${laneClass(row)}"></span></td>
      <td>${productSkuLabel(row)}</td>
      <td>${text(row.sku_id)}</td>
      <td class="c-right">${formatMoney(row.mrp_ik)}</td>
      <td class="c-right">${formatMoney(row.mrp_ok)}</td>
      <td class="c-right">${formatMoney(row.internal_loaded_cost_per_sku)}</td>
      <td class="c-right">${formatMoney(row.ik_selling_price)}</td>
      <td class="c-right">${formatMoney(row.ok_selling_price)}</td>
      <td>${statusChip(getRowStatus(row))}</td>
    </tr>`;
    }
    if (lensId === "printable-cost-sheet") {
      return `<tr ${trAttrs}>
      <td>${cpCellPrimary(row.product_name || row.product_id)}</td>
      <td>${text(row.category_name)}<div class="cp-muted-text">${text(row.subcategory_name)}</div></td>
      <td>${text(row.group_name)}<div class="cp-muted-text">${text(row.sub_group_name)}</div></td>
      <td>${text(row.sku_column_labels)}</td>
      <td>${compactStatusText(row.product_cost_sheet_status)}</td>
      <td>${formatDateTime(row.refreshed_at)}</td>
    </tr>`;
    }
    if (lensId === "cost-comparison") {
      return `<tr ${trAttrs}>
      <td>${productSkuLabel(row)}</td>
      ${comparisonCell(costComparisonValue(row, "manufacturingCop"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "previousMonthCop"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "momCopChangePercent"), formatPercent, "percent")}
      ${comparisonCell(costComparisonValue(row, "internalLoadedCost"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "previousMonthInternalLoadedCost"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "momInternalLoadedCostChangePercent"), formatPercent, "percent")}
      ${comparisonCell(costComparisonValue(row, "profitIk"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "momProfitIkChange"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "profitOk"), formatMoney, "money")}
      ${comparisonCell(costComparisonValue(row, "momProfitOkChange"), formatMoney, "money")}
    </tr>`;
    }
    return null;
  }

  async function handlePrintableRowClick(row) {
    await openCostSheetModal(row.product_id, { summaryRow: row });
  }

  function getComparisonDrawerConfig(row, preferredTab) {
    return {
      title:
        row.sku_column_label ||
        row.sku_display_name ||
        row.sku_id ||
        "Cost Comparison",
      subtitle: row.product_name || row.product_id || "",
      tabs: [
        { id: "overview", label: "Overview" },
        { id: "month-on-month", label: "Month-on-Month" },
        { id: "year-on-year", label: "Year-on-Year" },
      ],
      activeTab: preferredTab || "overview",
    };
  }

  async function renderComparisonDrawerTab(tabId, row) {
    return renderCostComparisonTab(tabId, row);
  }

  return {
    bindEvents,
    handleEscapeKey,
    onLensSwitch,
    onLensLoadStart,
    loadPrintableLensRows,
    loadPrintableLinesForProduct,
    invalidatePrintableLinesCache,
    loadCostSheetLineTraceability,
    getTableHeaders,
    getTableAlignments,
    renderTableRow,
    handlePrintableRowClick,
    getComparisonDrawerConfig,
    renderComparisonDrawerTab,
    closeCostSheetModal,
    closeCostSheetExplainDrawer,
    openProductQcExplainFromQueue,
    openSkuMaterialsStoresExplainFromQueue,
    openProductMaterialsStoresExplainFromQueue,
    handleEscapeKeyForEditForms,
  };
}
