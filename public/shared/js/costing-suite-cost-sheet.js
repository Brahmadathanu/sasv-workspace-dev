export const TRACEABILITY_VIEW =
  "v_costing_pricing_cost_sheet_line_traceability";

export const PRINTABLE_LINES_VIEW =
  "v_costing_pricing_printable_cost_sheet_lines";

export const PRINTABLE_PRODUCT_SUMMARY_VIEW =
  "v_costing_pricing_printable_cost_sheet_product_summary";

const EVIDENCE_KEY_META = [
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
];

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
  let currentCostSheetProductId = null;
  let costSheetReturnFocus = null;
  let costSheetSignReturnFocus = null;
  let costSheetExplainReturnFocus = null;
  let currentExplainTraceabilityRow = null;
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
    return {
      product_id: row.product_id,
      product_name: row.product_name,
      category_name: row.category_name,
      subcategory_name: row.subcategory_name,
      group_name: row.group_name,
      sub_group_name: row.sub_group_name,
      product_hierarchy: row.product_hierarchy,
      period_start: row.period_start,
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

  function productLinesCacheKey(periodStart, productId) {
    return `${normalizePrintableCachePeriod(periodStart)}::${String(productId ?? "")}`;
  }

  function findCachedProductLines(periodStart, productId) {
    const cached = printableProductLinesCache.get(
      productLinesCacheKey(periodStart, productId),
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

  async function loadPrintableLinesForProduct(periodStart, productId) {
    const cached = findCachedProductLines(periodStart, productId);
    if (cached) return cached;

    const pageSize = 1000;
    let from = 0;
    const rows = [];

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await costingFrom(PRINTABLE_LINES_VIEW)
        .select("*")
        .eq("period_start", periodStart)
        .eq("product_id", productId)
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

    printableProductLinesCache.set(productLinesCacheKey(periodStart, productId), {
      lines: rows,
      fetchedAt: Date.now(),
    });
    return rows;
  }

  function printableRowsForProduct(productId, periodStart = getActivePeriodStart()) {
    if (
      String(currentCostSheetProductId ?? "") === String(productId ?? "") &&
      printableLines.length
    ) {
      return printableLines;
    }

    const cached = findCachedProductLines(periodStart, productId);
    return cached || [];
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
    closeCostSheetSignModal();
    if (productId) {
      await openCostSheetModal(productId);
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
    const subRows = [
      "production overhead",
      "quality control overhead",
      "materials / stores overhead",
      "administrative overhead",
      "finance admin overhead",
    ];
    if (strongRows.includes(label)) return "cost-sheet-row-strong";
    if (subRows.includes(label)) return "cost-sheet-row-sub";
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
    if (normalized.endsWith("_percent")) return "percent";
    if (
      normalized.includes("_amount") ||
      normalized.includes("_cost") ||
      normalized.startsWith("mrp_") ||
      normalized.includes("realisation") ||
      normalized.includes("margin")
    ) {
      return "money";
    }
    if (normalized.endsWith("_count") || normalized.endsWith("_qty")) {
      return "number";
    }
    return "text";
  }

  function formatEvidenceValue(key, value, hintedType) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") {
      return `<span class="cp-muted-text">${text(JSON.stringify(value))}</span>`;
    }

    const valueType = inferEvidenceValueType(key, hintedType);
    if (valueType === "money") return formatMoney(value);
    if (valueType === "percent") return formatPercent(value);
    if (valueType === "number") return formatNumber(value);
    return text(value);
  }

  function renderEvidenceSummary(evidenceJson) {
    if (!evidenceJson || typeof evidenceJson !== "object") return "";

    const usedKeys = new Set();
    const items = [];

    EVIDENCE_KEY_META.forEach(([key, label, valueType]) => {
      if (!(key in evidenceJson)) return;
      const formatted = formatEvidenceValue(key, evidenceJson[key], valueType);
      if (formatted === null) return;
      usedKeys.add(key);
      items.push([label, formatted]);
    });

    Object.keys(evidenceJson)
      .filter((key) => !usedKeys.has(key))
      .sort((a, b) => a.localeCompare(b))
      .forEach((key) => {
        const formatted = formatEvidenceValue(key, evidenceJson[key]);
        if (formatted === null) return;
        items.push([humanizeEvidenceKey(key), formatted]);
      });

    if (!items.length) return "";
    return kvSection(
      "Evidence Summary",
      items.map(([label, value]) => [label, value]),
    );
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

  function renderCostSheetExplainContent(row) {
    const calculationText = row.trace_formula || row.calculation_basis;
    const sourceItems = [
      row.source_note ? ["Source Note", text(row.source_note)] : null,
      row.trace_source_type
        ? ["Source Type", text(row.trace_source_type)]
        : null,
      row.trace_source_snapshot
        ? ["Source Snapshot", text(row.trace_source_snapshot)]
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
      kvSection("Displayed Value", [
        ["Value", formatTraceabilityDisplayValue(row)],
        row.value_type ? ["Value Type", text(row.value_type)] : null,
      ].filter(Boolean)),
      calculationText
        ? kvSection("How This Value Is Calculated", [
            ["Calculation", text(calculationText)],
          ])
        : "",
      row.trace_summary
        ? kvSection("Explanation", [["Summary", text(row.trace_summary)]])
        : "",
      sourceItems.length
        ? `${kvSection("Source", sourceItems)}${sourceTechnical}`
        : sourceTechnical,
      renderTraceabilityDrillSection(row),
      renderEvidenceSummary(row.evidence_json),
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
    return {
      periodStart: cell.dataset.explainPeriodStart,
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

    const statusBadge = row?.cost_sheet_status
      ? statusChip(normalizeStatus(row.cost_sheet_status))
      : "";
    const productName = row?.product_name || fallback.productName || "";
    const skuLabel =
      row?.sku_column_label || row?.sku_id || fallback.skuLabel || "";
    const period = row?.period_start || fallback.periodStart || "";

    costSheetExplainSubtitle.innerHTML = `
      <span>${text(productName)}</span>
      <span class="cs-sep">·</span>
      <span>${text(skuLabel)}</span>
      <span class="cs-sep">·</span>
      <span>${formatPeriodMonth(period)}</span>
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

  async function openCostSheetExplainDrawer(params = {}) {
    if (!costSheetExplainDrawer || !costSheetExplainContent) return;

    costSheetExplainReturnFocus = document.activeElement;
    costSheetExplainDrawer.classList.remove("hidden");
    costSheetExplainDrawer.setAttribute("aria-hidden", "false");
    setCostSheetExplainLoading({
      lineLabel: params.lineLabel,
      periodStart: params.periodStart,
    });

    setTimeout(() => {
      costSheetExplainCloseBtn?.focus();
    }, 0);

    const row = await loadCostSheetLineTraceability(params);
    if (!row) {
      if (costSheetExplainTitle) {
        costSheetExplainTitle.textContent = params.lineLabel || "Explain Line";
      }
      if (costSheetExplainSubtitle) {
        costSheetExplainSubtitle.innerHTML = "";
      }
      costSheetExplainContent.innerHTML =
        '<div class="status">Traceability is not available for this line. Run costing refresh and try again.</div>';
      return;
    }

    setCostSheetExplainHeader(row);
    currentExplainTraceabilityRow = row;
    costSheetExplainContent.innerHTML = renderCostSheetExplainContent(row);
  }

  function handleCostSheetExplainDrillClick(event) {
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
            <td><span class="cost-sheet-line-label">${text(normalizeCostSheetDisplayLabel(line.line_label))}</span>${calc}</td>
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
          <thead>
            <tr>
              <th>${text(costSheetFirstColumnHeader(section.section_code))}</th>
              ${skuColumns.map((sku) => `<th>${text(sku.label)}</th>`).join("")}
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

  async function openCostSheetModal(productId, options = {}) {
    if (!costSheetModal || !costSheetA4) return;

    const periodStart = getActivePeriodStart();
    if (!periodStart) {
      showToast("Select a costing period first.", "info");
      return;
    }

    if (costSheetModal.classList.contains("hidden")) {
      costSheetReturnFocus = document.activeElement;
    }
    currentCostSheetProductId = productId;

    const summaryRow =
      options.summaryRow || findProductSummaryRow(productId, periodStart);

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
      rows = await loadPrintableLinesForProduct(periodStart, productId);
    } catch (err) {
      console.error("[costing-suite] loadPrintableLinesForProduct failed", err);
      showToast("Failed to load cost sheet lines for this product.", "error");
      costSheetModal.classList.add("hidden");
      costSheetModal.setAttribute("aria-hidden", "true");
      return;
    }

    if (!rows.length) {
      showToast("No printable cost sheet lines found for this product.", "info");
      costSheetModal.classList.add("hidden");
      costSheetModal.setAttribute("aria-hidden", "true");
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

  function isSubCostSheetLine(label) {
    const l = String(label || "").toLowerCase();
    return (
      l.includes("production overhead") ||
      l.includes("quality control overhead") ||
      l.includes("materials / stores overhead") ||
      l.includes("administrative overhead") ||
      l.includes("finance admin overhead")
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
      valueRow._marker = isStrongCostSheetLine(line.line_label)
        ? "strong"
        : isSubCostSheetLine(line.line_label)
          ? "sub"
          : "";
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

    let rows;
    try {
      rows = await loadPrintableLinesForProduct(periodStart, productId);
    } catch (err) {
      console.error("[costing-suite] generateCostSheetPdf line load failed", err);
      showToast("Failed to load cost sheet lines for PDF.", "error");
      return;
    }

    printableLines = rows;
    if (!rows.length) {
      showToast("No cost sheet rows available for PDF.", "error");
      return;
    }

    const first = rows[0] || {};
    const productRow =
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

  function onLensLoadStart() {
    closeCostSheetExplainDrawer();
    closeCostSheetModal();
    printableLines = [];
  }

  function invalidatePrintableLinesCache() {
    printableProductSummaryCache = null;
    printableProductLinesCache.clear();
    printableLines = [];
  }

  function isPrintableProductSummaryCacheValid(periodStart) {
    if (!printableProductSummaryCache) return false;
    return (
      printableProductSummaryCache.periodStart ===
      normalizePrintableCachePeriod(periodStart)
    );
  }

  async function loadPrintableLensRows(periodStart) {
    const periodKey = normalizePrintableCachePeriod(periodStart);
    if (isPrintableProductSummaryCacheValid(periodKey)) {
      return { groupedRows: printableProductSummaryCache.rows };
    }

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
  } = {}) {
    const period = String(periodStart ?? "").trim();
    const label = String(lineLabel ?? "").trim();
    if (!period || productId == null || skuId == null || !label) {
      return null;
    }

    try {
      let query = costingFrom(TRACEABILITY_VIEW)
        .select("*")
        .eq("period_start", period)
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

      const { data, error } = await query.limit(1);
      if (error) {
        console.warn(
          "[costing-suite] loadCostSheetLineTraceability query failed",
          error,
        );
        return null;
      }

      return Array.isArray(data) && data.length ? data[0] : null;
    } catch (err) {
      console.warn(
        "[costing-suite] loadCostSheetLineTraceability exception",
        err,
      );
      return null;
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
    handleEscapeKeyForEditForms,
  };
}
