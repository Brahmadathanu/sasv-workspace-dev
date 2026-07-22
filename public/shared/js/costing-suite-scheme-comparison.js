/**
 * Scheme Comparison lens controller (SC2).
 * Suite owner: cost-sheet-review (SC1). PPM entry removed in SC4; SC5 redirects
 * legacy PPM Scheme Comparison URLs to this CSR lens.
 * Server source: public.v_costing_pricing_sku_scheme_comparison
 */

export const SCHEME_COMPARISON_LENS_ID = "scheme-comparison";

export const SCHEME_COMPARISON_VIEW =
  "v_costing_pricing_sku_scheme_comparison";

export function isSchemeComparisonLens(lensId) {
  return String(lensId || "").trim() === SCHEME_COMPARISON_LENS_ID;
}

const SCHEME_COMPARISON_HEADERS = [
  "Product / SKU",
  "Scheme",
  "IK Net Realisation",
  "IK Margin %",
  "IK Margin Band",
  "OK Net Realisation",
  "OK Margin %",
  "OK Margin Band",
  "Status",
];

const SCHEME_COMPARISON_ALIGNMENTS = [
  "c-left",
  "c-left",
  "c-right",
  "c-right",
  "c-left",
  "c-right",
  "c-right",
  "c-left",
  "c-left",
];

const SCHEME_COMPARISON_PURPOSE =
  "Compare scheme viability and pricing outcomes across SKUs for the selected costing period.";
const SCHEME_COMPARISON_SEARCH_PLACEHOLDER =
  "Search product, SKU, scheme or status";

/**
 * PEQ dimensions supported by Scheme Comparison row shape.
 * Status → scheme_viability_status
 * Issue / Source → unsupported (no matching columns on the view)
 */
export function schemeComparisonSupportsPeqGroup(groupId) {
  return String(groupId || "").trim() === "status";
}

export function getSchemeComparisonSearchPlaceholder() {
  return SCHEME_COMPARISON_SEARCH_PLACEHOLDER;
}

export function getSchemeComparisonDescription() {
  return SCHEME_COMPARISON_PURPOSE;
}

/**
 * @param {object} deps
 * @param {Function} deps.costingFrom
 * @param {Function} deps.fetchAllRows
 * @param {Function} deps.text
 * @param {Function} deps.formatMoney
 * @param {Function} deps.formatPercent
 * @param {Function} deps.compactStatusText
 * @param {Function} deps.productSkuLabel
 */
export function createSchemeComparisonController(deps) {
  const {
    costingFrom,
    fetchAllRows,
    text,
    formatMoney,
    formatPercent,
    compactStatusText,
    productSkuLabel,
  } = deps;

  function getTableHeaders() {
    return SCHEME_COMPARISON_HEADERS;
  }

  function getTableAlignments() {
    return SCHEME_COMPARISON_ALIGNMENTS;
  }

  /**
   * Load scheme comparison rows for the shell-owned period.
   * @param {string} periodStart ISO month-start (ACTIVE_PERIOD_START)
   */
  async function loadRows(periodStart) {
    return fetchAllRows(() =>
      costingFrom(SCHEME_COMPARISON_VIEW)
        .select("*")
        .eq("period_start", periodStart)
        .order("sku_display_name", { ascending: true }),
    );
  }

  function renderTableRow(row, trAttrs) {
    return `<tr ${trAttrs}>
      <td>${productSkuLabel(row)}</td>
      <td>${text(row.scheme_name)}</td>
      <td class="c-right">${formatMoney(row.ik_net_sales_realisation)}</td>
      <td class="c-right">${formatPercent(row.ik_margin_percent_after_scheme)}</td>
      <td class="cp-muted-text">${text(row.ik_scheme_margin_band)}</td>
      <td class="c-right">${formatMoney(row.ok_net_sales_realisation)}</td>
      <td class="c-right">${formatPercent(row.ok_margin_percent_after_scheme)}</td>
      <td class="cp-muted-text">${text(row.ok_scheme_margin_band)}</td>
      <td>${compactStatusText(row.scheme_viability_status)}</td>
    </tr>`;
  }

  function getPreferredDrawerTab() {
    return "scheme";
  }

  function getEmptyStateMessage() {
    return "No scheme comparison rows were found for the selected period and filters.";
  }

  function getSearchPlaceholder() {
    return SCHEME_COMPARISON_SEARCH_PLACEHOLDER;
  }

  function getDescription() {
    return SCHEME_COMPARISON_PURPOSE;
  }

  return {
    getTableHeaders,
    getTableAlignments,
    loadRows,
    /** @deprecated alias — prefer loadRows */
    loadSchemeComparisonRows: loadRows,
    renderTableRow,
    getPreferredDrawerTab,
    getEmptyStateMessage,
    getSearchPlaceholder,
    getDescription,
    supportsPeqGroup: schemeComparisonSupportsPeqGroup,
  };
}
