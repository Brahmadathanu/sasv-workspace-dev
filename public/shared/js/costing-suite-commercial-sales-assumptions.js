/**
 * EVP-3I2C9E — Commercial Sales Assumptions (Pricing Policy Manager)
 *
 * Server contracts only (regenerated supabase.ts):
 * - v_costing_pricing_commercial_sales_basis
 * - rpc_get_sales_allocation_default_policies
 * - rpc_set_sales_allocation_default_policy
 * - rpc_get_sku_sales_assumptions
 * - rpc_set_sku_sales_assumption
 * - rpc_close_sku_sales_assumption
 */

export const COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID =
  "commercial-sales-assumptions";

export const CSA_FUTURE_REFRESH_MESSAGE =
  "Assumption saved. It will apply to a future costing refresh whose governed valuation date falls within its effective period. Completed refresh runs are unchanged.";

export const CSA_DEFAULT_POLICY_FUTURE_REFRESH_MESSAGE =
  "Default policy saved. It will apply to a future costing refresh whose governed valuation date falls within its effective period. Completed refresh runs are unchanged.";

const CSA_ASSUMPTION_BASES = [
  "MANUAL_ASSUMPTION",
  "NEW_SKU_ESTIMATE",
  "NEW_PRODUCT_ESTIMATE",
];

const CSA_DEFAULT_SCENARIOS = [
  "NEW_SKU_EXISTING_PRODUCT",
  "NEW_PRODUCT_NO_HISTORY",
];

const CSA_SCENARIO_BUSINESS_LABELS = {
  NEW_SKU_EXISTING_PRODUCT: "New SKU",
  NEW_PRODUCT_NO_HISTORY: "New Product",
};

/** Exact canonical tokens for source filter buckets (never rewrite stored values). */
const CSA_MANUAL_SOURCE_TOKENS = new Set([
  "MANUAL_ASSUMPTION",
  "NEW_SKU_ESTIMATE",
  "NEW_PRODUCT_ESTIMATE",
  "SKU_MANUAL_ASSUMPTION",
  "MANUAL",
]);

const CSA_ACTUAL_SOURCE_TOKENS = new Set([
  "ACTUAL_SALES",
  "ACTUAL",
  "CLEANED_SALES_12M",
  "POSITIVE_ACTUAL_SALES",
  "SKU_ACTUAL_SALES",
]);

const CSA_DEFAULT_SOURCE_TOKENS = new Set([
  "GOVERNED_DEFAULT",
  "DEFAULT_POLICY",
  "NEW_SKU_EXISTING_PRODUCT",
  "NEW_PRODUCT_NO_HISTORY",
  "DEFAULT",
  "DEFAULT_10_UNITS",
]);

const CSA_UNRESOLVED_SOURCE_TOKENS = new Set([
  "UNRESOLVED",
  "REVIEW_REQUIRED",
  "AMBIGUOUS",
  "AMBIGUOUS_ASSUMPTION",
  "AMBIGUOUS_DEFAULT",
  "MISSING_DEFAULT",
  "BLOCKED",
]);

const CSA_HEADERS = [
  "Product / Pack / SKU",
  "Effective quantity",
  "Source / basis",
  "Actual 12M",
  "Status",
];

const CSA_ALIGNMENTS = [
  "c-left",
  "c-right",
  "c-left",
  "c-right",
  "c-left",
];

function scenarioBusinessLabel(scenarioCode) {
  const code = String(scenarioCode || "").trim();
  return CSA_SCENARIO_BUSINESS_LABELS[code] || code || "--";
}

function $(id) {
  return document.getElementById(id);
}

function normalizeToken(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function isNullish(value) {
  return value === null || value === undefined || value === "";
}

function isoDateOnly(value) {
  if (isNullish(value)) return "";
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function compareIsoDate(a, b) {
  return isoDateOnly(a).localeCompare(isoDateOnly(b));
}

/**
 * Classify row into filter bucket using exact canonical tokens from the view.
 * @returns {"manual"|"actual"|"default"|"unresolved"|"other"}
 */
export function classifyCommercialSalesSourceBucket(row) {
  const tokens = [
    normalizeToken(row?.assumption_source),
    normalizeToken(row?.commercial_sales_basis),
    normalizeToken(row?.assumption_resolution_status),
    normalizeToken(row?.default_resolution_status),
    normalizeToken(row?.commercial_sales_status),
  ].filter(Boolean);

  for (const t of tokens) {
    if (CSA_UNRESOLVED_SOURCE_TOKENS.has(t)) return "unresolved";
  }
  for (const t of tokens) {
    if (CSA_MANUAL_SOURCE_TOKENS.has(t)) return "manual";
  }
  for (const t of tokens) {
    if (CSA_ACTUAL_SOURCE_TOKENS.has(t)) return "actual";
  }
  for (const t of tokens) {
    if (CSA_DEFAULT_SOURCE_TOKENS.has(t)) return "default";
  }

  if (!tokens.length) return "unresolved";
  return "other";
}

function sortPriority(row) {
  const bucket = classifyCommercialSalesSourceBucket(row);
  const status = normalizeToken(row?.commercial_sales_status);
  const assumptionRes = normalizeToken(row?.assumption_resolution_status);
  const defaultRes = normalizeToken(row?.default_resolution_status);

  if (
    bucket === "unresolved" ||
    CSA_UNRESOLVED_SOURCE_TOKENS.has(status) ||
    CSA_UNRESOLVED_SOURCE_TOKENS.has(assumptionRes) ||
    CSA_UNRESOLVED_SOURCE_TOKENS.has(defaultRes)
  ) {
    return 0;
  }
  if (
    status === "REVIEW_REQUIRED" ||
    bucket === "default" ||
    bucket === "manual"
  ) {
    return 1;
  }
  if (bucket === "actual" || status === "READY" || status === "OK") {
    return 2;
  }
  return 1;
}

export function sortCommercialSalesAssumptionRows(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const pa = sortPriority(a);
    const pb = sortPriority(b);
    if (pa !== pb) return pa - pb;
    const nameCmp = String(a?.product_name || "").localeCompare(
      String(b?.product_name || ""),
      undefined,
      { sensitivity: "base" },
    );
    if (nameCmp) return nameCmp;
    const packA = Number(a?.pack_size);
    const packB = Number(b?.pack_size);
    const packCmp =
      (Number.isFinite(packA) ? packA : Number.POSITIVE_INFINITY) -
      (Number.isFinite(packB) ? packB : Number.POSITIVE_INFINITY);
    if (packCmp) return packCmp;
    const skuA = Number(a?.sku_id);
    const skuB = Number(b?.sku_id);
    return (
      (Number.isFinite(skuA) ? skuA : Number.POSITIVE_INFINITY) -
      (Number.isFinite(skuB) ? skuB : Number.POSITIVE_INFINITY)
    );
  });
}

/**
 * Open assumption from history: ACTIVE and effective_to is null.
 */
export function findOpenSkuSalesAssumption(historyRows) {
  const rows = Array.isArray(historyRows) ? historyRows : [];
  return (
    rows.find(
      (row) =>
        normalizeToken(row?.status) === "ACTIVE" && isNullish(row?.effective_to),
    ) || null
  );
}

function pickDefaultPolicyForScenario(rows, scenarioCode) {
  const forScenario = (Array.isArray(rows) ? rows : []).filter(
    (row) => normalizeToken(row?.scenario_code) === normalizeToken(scenarioCode),
  );
  const activeOpen = forScenario.find(
    (row) =>
      normalizeToken(row?.status) === "ACTIVE" && isNullish(row?.effective_to),
  );
  if (activeOpen) return activeOpen;
  return (
    [...forScenario].sort((a, b) =>
      compareIsoDate(b?.effective_from, a?.effective_from),
    )[0] || null
  );
}

export function createCommercialSalesAssumptionHandlers(deps) {
  const {
    costingFrom,
    costingRpc,
    fetchAllRows,
    showToast,
    handleError,
    setLoadingMask,
    text,
    formatNumber,
    formatMoney,
    formatDate,
    formatDateTime,
    statusChip,
    cpCellPrimaryHtml,
    normalizeStatus,
    getActivePeriodStart,
    getPolicyManagerTab,
    canEditPricingPolicyActions,
    requireEditAccess,
    reloadRows,
    formatPeriodMonth,
  } = deps;

  let sourceFilter = "all";
  let statusFilter = "all";
  let defaultsRows = [];
  let defaultsError = null;
  let defaultsLoading = false;
  let listLoadToken = 0;
  let defaultsLoadToken = 0;

  let modalSnapshot = null;
  let historyRows = [];
  let historyLoading = false;
  let historyError = null;
  let writeInFlight = false;
  let defaultWriteInFlight = false;
  let defaultReviseScenario = null;

  function canEdit() {
    return (
      typeof canEditPricingPolicyActions === "function" &&
      canEditPricingPolicyActions() === true
    );
  }

  function isActiveWorkspace() {
    return getPolicyManagerTab?.() === COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID;
  }

  function getTableHeaders() {
    return CSA_HEADERS;
  }

  function getTableAlignments() {
    return CSA_ALIGNMENTS;
  }

  function getSourceFilter() {
    return sourceFilter;
  }

  function getStatusFilter() {
    return statusFilter;
  }

  function getDefaultsRows() {
    return defaultsRows;
  }

  function getDefaultsError() {
    return defaultsError;
  }

  function getStatusFilterOptions(rows) {
    const set = new Set();
    for (const row of Array.isArray(rows) ? rows : []) {
      const status = String(row?.commercial_sales_status ?? "").trim();
      if (status) set.add(status);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  function filterRows(rows) {
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      if (sourceFilter !== "all") {
        const bucket = classifyCommercialSalesSourceBucket(row);
        if (sourceFilter === "unresolved") {
          if (bucket !== "unresolved") return false;
        } else if (bucket !== sourceFilter) {
          return false;
        }
      }
      if (statusFilter !== "all") {
        if (
          normalizeToken(row?.commercial_sales_status) !==
          normalizeToken(statusFilter)
        ) {
          return false;
        }
      }
      return true;
    });
  }

  function enrichSearchBlob(row) {
    return [
      row?.product_name,
      row?.sku_id,
      row?.pack_size,
      row?.pack_uom,
      row?.commercial_sales_basis,
      row?.assumption_source,
      row?.commercial_sales_status,
      row?.commercial_sales_warning,
      row?.allocation_basis_status,
      row?.assumption_resolution_status,
      row?.default_resolution_status,
      row?.default_policy_scenario,
    ]
      .filter((v) => !isNullish(v))
      .map((v) => String(v).toLowerCase())
      .join(" ");
  }

  async function loadRows(periodStart) {
    const token = ++listLoadToken;
    const period = periodStart || getActivePeriodStart?.();
    if (!period) {
      return [];
    }
    const rows = await fetchAllRows(
      () =>
        costingFrom("v_costing_pricing_commercial_sales_basis")
          .select("*")
          .eq("period_start", period)
          .order("product_name", { ascending: true })
          .order("pack_size", { ascending: true })
          .order("sku_id", { ascending: true }),
      1000,
    );
    if (token !== listLoadToken) return null;
    return sortCommercialSalesAssumptionRows(rows);
  }

  async function loadDefaultPolicies() {
    const token = ++defaultsLoadToken;
    defaultsLoading = true;
    defaultsError = null;
    try {
      const { data, error } = await costingRpc(
        "rpc_get_sales_allocation_default_policies",
      );
      if (error) throw error;
      if (token !== defaultsLoadToken) return null;
      defaultsRows = Array.isArray(data) ? data : [];
      return defaultsRows;
    } catch (err) {
      if (token !== defaultsLoadToken) return null;
      defaultsRows = [];
      defaultsError = err;
      throw err;
    } finally {
      if (token === defaultsLoadToken) defaultsLoading = false;
    }
  }

  function formatSourceLabel(row) {
    const source = row?.assumption_source;
    const basis = row?.commercial_sales_basis;
    if (!isNullish(source)) return text(source);
    if (!isNullish(basis)) return text(basis);
    return "--";
  }

  function formatDefaultCell(row) {
    const scenario = row?.default_policy_scenario;
    const qty = row?.default_sales_units;
    if (isNullish(scenario) && isNullish(qty)) return "--";
    if (isNullish(scenario)) return formatNumber(qty);
    if (isNullish(qty)) return text(scenarioBusinessLabel(scenario));
    return `${text(scenarioBusinessLabel(scenario))} · ${formatNumber(qty)}`;
  }

  function formatManualCell(row) {
    const qty = row?.manual_assumed_sales_units;
    const status = row?.manual_assumption_status;
    if (isNullish(qty) && isNullish(status)) return "--";
    const parts = [];
    if (!isNullish(qty)) parts.push(formatNumber(qty));
    if (!isNullish(status)) parts.push(text(status));
    return parts.join(" · ") || "--";
  }

  function formatSourceBasisCell(row) {
    const bucket = classifyCommercialSalesSourceBucket(row);
    const primary = formatSourceLabel(row);
    let secondary = "";
    if (bucket === "manual" && !isNullish(row?.manual_assumed_sales_units)) {
      secondary = `Manual · ${formatNumber(row.manual_assumed_sales_units)} units`;
    } else if (bucket === "default") {
      const label = scenarioBusinessLabel(row?.default_policy_scenario);
      if (!isNullish(row?.default_sales_units)) {
        secondary = `${label} · ${formatNumber(row.default_sales_units)} units`;
      } else if (!isNullish(row?.default_policy_scenario)) {
        secondary = label;
      }
    } else if (
      bucket === "actual" &&
      !isNullish(row?.actual_sales_units_12m)
    ) {
      secondary = `Actual 12M · ${formatNumber(row.actual_sales_units_12m)}`;
    }
    if (!secondary) {
      return primary;
    }
    return `${primary}<div class="cp-muted-text">${text(secondary)}</div>`;
  }

  function formatWarningCell(row) {
    const status = row?.commercial_sales_status;
    const warning = row?.commercial_sales_warning;
    const statusHtml = !isNullish(status)
      ? statusChip(normalizeStatus(status))
      : "";
    if (isNullish(warning)) {
      return statusHtml || '<span class="cp-muted-text">--</span>';
    }
    const short =
      String(warning).length > 72
        ? `${text(String(warning).slice(0, 69))}…`
        : text(warning);
    return `${statusHtml}${
      statusHtml ? " " : ""
    }<span class="cp-muted-text" title="${text(warning)}">${short}</span>`;
  }

  function packLabel(row) {
    const size = row?.pack_size;
    const uom = row?.pack_uom;
    if (isNullish(size) && isNullish(uom)) return "--";
    if (isNullish(uom)) return formatNumber(size);
    if (isNullish(size)) return text(uom);
    return `${formatNumber(size)} ${text(uom)}`;
  }

  function productSkuPackHtml(row) {
    return `${cpCellPrimaryHtml(text(row?.product_name || "--"))}
      <div class="cp-muted-text">SKU ${text(row?.sku_id ?? "--")} · ${packLabel(row)}</div>`;
  }

  function mergeCsaRowAttrs(trAttrs, row) {
    const attrs = String(trAttrs || "").trim();
    const product = String(row?.product_name || "product").trim() || "product";
    const sku = row?.sku_id != null ? String(row.sku_id) : "";
    const ariaLabel = text(
      `Open commercial sales assumption details for ${product}${
        sku ? `, SKU ${sku}` : ""
      }`,
    );
    const skuAttr = sku ? ` data-sku-id="${text(sku)}"` : "";
    const extra = `tabindex="0" aria-label="${ariaLabel}"${skuAttr}`;
    if (/class\s*=\s*"/i.test(attrs)) {
      return `${attrs.replace(
        /class\s*=\s*"([^"]*)"/i,
        'class="$1 cp-csa-mobile-card-row"',
      )} ${extra}`;
    }
    return `${attrs} class="cp-csa-mobile-card-row" ${extra}`.trim();
  }

  function renderTableRow(row, trAttrs) {
    return `<tr ${mergeCsaRowAttrs(trAttrs, row)}>
      <td class="mrp-card-primary" data-label="Product / Pack / SKU">${productSkuPackHtml(row)}</td>
      <td class="c-right mrp-card-value" data-label="Effective quantity">${formatNumber(row?.commercial_sales_units)}</td>
      <td data-label="Source / basis">${formatSourceBasisCell(row)}</td>
      <td class="c-right" data-label="Actual 12M">${formatNumber(row?.actual_sales_units_12m)}</td>
      <td data-label="Status">${formatWarningCell(row)}</td>
    </tr>`;
  }

  function valuationDateFromRows(rows) {
    const list = Array.isArray(rows) ? rows : [];
    for (const row of list) {
      if (!isNullish(row?.management_valuation_date)) {
        return row.management_valuation_date;
      }
    }
    return null;
  }

  function filtersAreActive() {
    return sourceFilter !== "all" || statusFilter !== "all";
  }

  function getActiveFilterCount() {
    let count = 0;
    if (sourceFilter !== "all") count += 1;
    if (statusFilter !== "all") count += 1;
    return count;
  }

  function defaultsQuantityTitleParts() {
    if (defaultsLoading) return "Loading defaults…";
    if (defaultsError) return "Defaults unavailable";
    return CSA_DEFAULT_SCENARIOS.map((scenario) => {
      const policy = pickDefaultPolicyForScenario(defaultsRows, scenario);
      const label = scenarioBusinessLabel(scenario);
      const qty = policy ? formatNumber(policy.default_sales_units) : "--";
      return `${label}: ${qty}`;
    }).join(". ");
  }

  /** Meta-row Manage/View Defaults button config (no chrome chips). */
  function getDefaultsMetaButtonConfig() {
    const label = canEdit() ? "Manage Defaults" : "View Defaults";
    const qtyTitle = defaultsQuantityTitleParts();
    return {
      label,
      title: qtyTitle ? `${label}. ${qtyTitle}` : label,
    };
  }

  /**
   * Filter drawer body for PPM funnel (period host + valuation + source/status).
   * Period select is relocated by shell into #csaPeriodSelectHost.
   */
  function getFilterDrawerContent(allRows) {
    const valuation = valuationDateFromRows(allRows);
    const statusOptions = getStatusFilterOptions(allRows);
    const clearHidden = filtersAreActive() ? "" : " hidden";

    const html = `
      <div class="cp-csa-filter-drawer" data-csa-workspace="true">
        <div class="peq-filter-section">
          <div class="peq-filter-section-title">Costing period</div>
          <div id="csaPeriodSelectHost" class="cp-csa-period-host"></div>
          <div class="cp-csa-valuation-inline cp-muted-text">
            Valuation · <strong>${formatDate(valuation)}</strong>
          </div>
        </div>
        <div class="peq-filter-section">
          <div class="peq-filter-section-title">Source</div>
          <label class="cp-csa-filter-control">
            <span class="cp-visually-hidden">Source</span>
            <select id="csaSourceFilterSelect" class="cp-csa-status-select" aria-label="Commercial sales source filter">
              <option value="all"${sourceFilter === "all" ? " selected" : ""}>All sources</option>
              <option value="manual"${sourceFilter === "manual" ? " selected" : ""}>Manual</option>
              <option value="actual"${sourceFilter === "actual" ? " selected" : ""}>Actual</option>
              <option value="default"${sourceFilter === "default" ? " selected" : ""}>Governed default</option>
              <option value="unresolved"${sourceFilter === "unresolved" ? " selected" : ""}>Unresolved / review</option>
            </select>
          </label>
        </div>
        <div class="peq-filter-section">
          <div class="peq-filter-section-title">Status</div>
          <label class="cp-csa-filter-control">
            <span class="cp-visually-hidden">Status</span>
            <select id="csaStatusFilterSelect" class="cp-csa-status-select" aria-label="Commercial sales status filter">
              <option value="all"${statusFilter === "all" ? " selected" : ""}>All</option>
              ${statusOptions
                .map(
                  (s) =>
                    `<option value="${text(s)}"${
                      statusFilter === s ? " selected" : ""
                    }>${text(s)}</option>`,
                )
                .join("")}
            </select>
          </label>
        </div>
        <div class="peq-filter-actions cp-csa-filter-actions">
          <button type="button" class="peq-filter-action-btn" id="csaClearFiltersBtn"${clearHidden}>
            Clear
          </button>
        </div>
      </div>`;

    return { html, activeCount: getActiveFilterCount() };
  }

  function wireFilterDrawer(container, onFilterChange) {
    if (!container) return;
    container
      .querySelector("#csaSourceFilterSelect")
      ?.addEventListener("change", (e) => {
        sourceFilter = e.target?.value || "all";
        if (typeof onFilterChange === "function") onFilterChange("filter");
      });
    container
      .querySelector("#csaStatusFilterSelect")
      ?.addEventListener("change", (e) => {
        statusFilter = e.target?.value || "all";
        if (typeof onFilterChange === "function") onFilterChange("filter");
      });
    container.querySelector("#csaClearFiltersBtn")?.addEventListener("click", () => {
      sourceFilter = "all";
      statusFilter = "all";
      if (typeof onFilterChange === "function") onFilterChange("filter");
    });
  }

  function clearModalError() {
    const el = $("csaManageError");
    if (el) {
      el.hidden = true;
      el.textContent = "";
    }
  }

  function setModalError(message) {
    const el = $("csaManageError");
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function clearDefaultModalError() {
    const el = $("csaDefaultPolicyError");
    if (el) {
      el.hidden = true;
      el.textContent = "";
    }
  }

  function setDefaultModalError(message) {
    const el = $("csaDefaultPolicyError");
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
  }

  function setWriteControlsDisabled(disabled) {
    const ids = [
      "csaAssumptionBasis",
      "csaAssumedUnits",
      "csaAssumedValue",
      "csaEffectiveFrom",
      "csaRemarks",
      "csaApprovalReference",
      "csaSetSaveBtn",
      "csaCloseEffectiveTo",
      "csaCloseRemarks",
      "csaCloseApprovalReference",
      "csaCloseSaveBtn",
    ];
    ids.forEach((id) => {
      const el = $(id);
      if (el) el.disabled = !!disabled;
    });
  }

  function renderHistoryTable() {
    const host = $("csaHistoryTableHost");
    if (!host) return;
    if (historyLoading) {
      host.innerHTML = `<div class="cp-muted-text">Loading assumption history…</div>`;
      return;
    }
    if (historyError) {
      host.innerHTML = `<div class="status error">Failed to load assumption history.</div>`;
      return;
    }
    if (!historyRows.length) {
      host.innerHTML = `<div class="cp-muted-text">No assumption history for this SKU and period.</div>`;
      return;
    }
    const ordered = [...historyRows].sort((a, b) => {
      const fromCmp = compareIsoDate(b?.effective_from, a?.effective_from);
      if (fromCmp) return fromCmp;
      return Number(b?.assumption_id || 0) - Number(a?.assumption_id || 0);
    });
    host.innerHTML = `<div class="table-scroll"><table class="cp-simple-table">
      <thead><tr>
        <th>Status</th><th>Basis</th><th class="c-right">Units</th><th class="c-right">Value</th>
        <th>From</th><th>To</th><th>Remarks</th><th>Approval</th>
        <th>Created</th><th>Created by</th>
      </tr></thead>
      <tbody>
        ${ordered
          .map(
            (r) => `<tr>
            <td>${statusChip(normalizeStatus(r.status))}</td>
            <td>${text(r.assumption_basis)}</td>
            <td class="c-right">${formatNumber(r.assumed_sales_units)}</td>
            <td class="c-right">${formatMoney(r.assumed_sales_value)}</td>
            <td>${formatDate(r.effective_from)}</td>
            <td>${formatDate(r.effective_to)}</td>
            <td>${text(r.remarks || "--")}</td>
            <td>${text(r.approval_reference || "--")}</td>
            <td>${formatDateTime(r.created_at)}</td>
            <td>${text(r.created_by || "--")}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table></div>`;
  }

  function renderModalContext(row) {
    const host = $("csaManageContext");
    if (!host || !row) return;
    host.innerHTML = `
      <div class="cp-csa-context-grid">
        <div><span class="cp-muted-text">Product</span><div>${text(row.product_name || "--")}</div></div>
        <div><span class="cp-muted-text">Pack</span><div>${packLabel(row)}</div></div>
        <div><span class="cp-muted-text">SKU ID</span><div>${text(row.sku_id ?? "--")}</div></div>
        <div><span class="cp-muted-text">Costing period</span><div>${text(
          formatPeriodMonth?.(row.period_start) || row.period_start || "--",
        )}</div></div>
        <div><span class="cp-muted-text">Governed valuation date</span><div>${formatDate(row.management_valuation_date)}</div></div>
        <div><span class="cp-muted-text">Actual SKU sales (12m)</span><div>${formatNumber(row.actual_sales_units_12m)}</div></div>
        <div><span class="cp-muted-text">Product sales (12m)</span><div>${formatNumber(row.product_sales_units_12m)}</div></div>
        <div><span class="cp-muted-text">Effective commercial-sales qty</span><div>${formatNumber(row.commercial_sales_units)}</div></div>
        <div><span class="cp-muted-text">Effective source</span><div>${formatSourceLabel(row)}</div></div>
        <div><span class="cp-muted-text">Governed default</span><div>${formatDefaultCell(row)}</div></div>
        <div><span class="cp-muted-text">Manual assumption</span><div>${formatManualCell(row)}</div></div>
        <div style="grid-column:1/-1"><span class="cp-muted-text">Status / warning</span><div>${formatWarningCell(row)}</div></div>
      </div>`;
  }

  function syncSetFormMode() {
    const open = findOpenSkuSalesAssumption(historyRows);
    const title = $("csaSetFormTitle");
    const hint = $("csaSetFormHint");
    const saveBtn = $("csaSetSaveBtn");
    const closeSection = $("csaCloseSection");
    if (open) {
      if (title) title.textContent = "Supersede Assumption";
      if (hint) {
        hint.textContent =
          "A new revision will be created. Effective-from must be later than the open assumption’s effective-from. History is retained.";
      }
      if (saveBtn) saveBtn.textContent = "Supersede Assumption";
    } else {
      if (title) title.textContent = "Set Assumption";
      if (hint) {
        hint.textContent =
          "Enter a positive assumed sales quantity. Zero is not valid. Blank means no override — do not enter zero to clear.";
      }
      if (saveBtn) saveBtn.textContent = "Save Assumption";
    }
    if (closeSection) {
      closeSection.hidden = !open || !canEdit();
    }
  }

  function syncWriteVisibility() {
    const write = canEdit();
    const setSection = $("csaSetSection");
    const closeSection = $("csaCloseSection");
    if (setSection) setSection.hidden = !write;
    if (closeSection) {
      const open = findOpenSkuSalesAssumption(historyRows);
      closeSection.hidden = !write || !open;
    }
    const mode = $("csaManageModeLabel");
    if (mode) mode.textContent = write ? "Manage" : "View";
  }

  async function loadHistoryForSnapshot() {
    if (!modalSnapshot) return;
    const { periodStart, skuId, token } = modalSnapshot;
    historyLoading = true;
    historyError = null;
    renderHistoryTable();
    try {
      const { data, error } = await costingRpc("rpc_get_sku_sales_assumptions", {
        p_period_start: periodStart,
        p_sku_id: Number(skuId),
      });
      if (error) throw error;
      if (!modalSnapshot || modalSnapshot.token !== token) return;
      if (String(modalSnapshot.skuId) !== String(skuId)) return;
      historyRows = Array.isArray(data) ? data : [];
    } catch (err) {
      if (!modalSnapshot || modalSnapshot.token !== token) return;
      historyRows = [];
      historyError = err;
      handleError("Failed to load SKU sales assumption history", err);
    } finally {
      if (modalSnapshot && modalSnapshot.token === token) {
        historyLoading = false;
        renderHistoryTable();
        syncSetFormMode();
        syncWriteVisibility();
      }
    }
  }

  function resetSetForm() {
    const basis = $("csaAssumptionBasis");
    if (basis) {
      basis.innerHTML = CSA_ASSUMPTION_BASES.map(
        (b) => `<option value="${b}">${b}</option>`,
      ).join("");
      basis.value = "MANUAL_ASSUMPTION";
    }
    const units = $("csaAssumedUnits");
    if (units) units.value = "";
    const value = $("csaAssumedValue");
    if (value) value.value = "";
    const from = $("csaEffectiveFrom");
    if (from) from.value = "";
    const remarks = $("csaRemarks");
    if (remarks) remarks.value = "";
    const approval = $("csaApprovalReference");
    if (approval) approval.value = "";
    const closeTo = $("csaCloseEffectiveTo");
    if (closeTo) closeTo.value = "";
    const closeRemarks = $("csaCloseRemarks");
    if (closeRemarks) closeRemarks.value = "";
    const closeApproval = $("csaCloseApprovalReference");
    if (closeApproval) closeApproval.value = "";
  }

  async function openManageModal(row) {
    if (!row?.sku_id) {
      showToast("SKU ID missing for selected row.", "error");
      return;
    }
    const periodStart =
      row.period_start || getActivePeriodStart?.() || null;
    if (!periodStart) {
      showToast("Select a costing period first.", "error");
      return;
    }
    const modal = $("csaManageModal");
    if (!modal) return;

    modalSnapshot = {
      workspaceId: COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID,
      periodStart: String(periodStart),
      skuId: row.sku_id,
      token: Date.now(),
      row,
    };
    historyRows = [];
    historyError = null;
    clearModalError();
    resetSetForm();
    renderModalContext(row);
    syncWriteVisibility();
    syncSetFormMode();
    renderHistoryTable();

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    await loadHistoryForSnapshot();
  }

  function closeManageModal() {
    const modal = $("csaManageModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    modalSnapshot = null;
    historyRows = [];
    writeInFlight = false;
    setWriteControlsDisabled(false);
    clearModalError();
  }

  function assertModalContextFresh() {
    if (!modalSnapshot) return false;
    if (!isActiveWorkspace()) {
      closeManageModal();
      showToast("Workspace changed — commercial sales modal closed.", "info");
      return false;
    }
    const activePeriod = String(getActivePeriodStart?.() || "");
    if (activePeriod && activePeriod !== String(modalSnapshot.periodStart)) {
      closeManageModal();
      showToast(
        "Costing period changed — commercial sales modal closed.",
        "info",
      );
      return false;
    }
    return true;
  }

  async function refreshModalAfterWrite() {
    if (!modalSnapshot) return;
    const skuId = modalSnapshot.skuId;
    const periodStart = modalSnapshot.periodStart;
    if (typeof reloadRows === "function") {
      await reloadRows();
    }
    if (!modalSnapshot || String(modalSnapshot.skuId) !== String(skuId)) return;
    const updated =
      typeof deps.findRowBySkuId === "function"
        ? deps.findRowBySkuId(skuId)
        : null;
    if (updated) {
      modalSnapshot.row = updated;
      modalSnapshot.periodStart = updated.period_start || periodStart;
      renderModalContext(updated);
    }
    await loadHistoryForSnapshot();
  }

  async function saveSetOrSupersede() {
    if (!requireEditAccess?.("set or supersede SKU sales assumption")) return;
    if (!assertModalContextFresh()) return;
    if (writeInFlight) return;

    const open = findOpenSkuSalesAssumption(historyRows);
    const basis = String($("csaAssumptionBasis")?.value || "").trim();
    const unitsRaw = String($("csaAssumedUnits")?.value ?? "").trim();
    const valueRaw = String($("csaAssumedValue")?.value ?? "").trim();
    const effectiveFrom = String($("csaEffectiveFrom")?.value || "").trim();
    const remarks = String($("csaRemarks")?.value || "").trim();
    const approval = String($("csaApprovalReference")?.value || "").trim();

    clearModalError();

    if (!CSA_ASSUMPTION_BASES.includes(basis)) {
      setModalError("Select a valid assumption basis.");
      return;
    }
    if (!unitsRaw) {
      setModalError("Assumed sales units are required.");
      return;
    }
    const units = Number(unitsRaw);
    if (!Number.isFinite(units)) {
      setModalError("Assumed sales units must be a finite number.");
      return;
    }
    if (units <= 0) {
      setModalError("Assumed sales units must be greater than zero.");
      return;
    }
    if (!effectiveFrom) {
      setModalError("Effective-from date is required.");
      return;
    }
    if (!remarks) {
      setModalError("Remarks are required.");
      return;
    }
    if (open) {
      const openFrom = isoDateOnly(open.effective_from);
      if (!openFrom || compareIsoDate(effectiveFrom, openFrom) <= 0) {
        setModalError(
          "Effective-from must be later than the open assumption’s effective-from.",
        );
        return;
      }
    }

    let assumedValue = null;
    if (valueRaw !== "") {
      const n = Number(valueRaw);
      if (!Number.isFinite(n)) {
        setModalError("Assumed sales value must be a finite number when set.");
        return;
      }
      assumedValue = n;
    }

    writeInFlight = true;
    setWriteControlsDisabled(true);
    setLoadingMask(true, "Saving SKU sales assumption...");
    try {
      const { error } = await costingRpc("rpc_set_sku_sales_assumption", {
        p_period_start: modalSnapshot.periodStart,
        p_sku_id: Number(modalSnapshot.skuId),
        p_assumption_basis: basis,
        p_assumed_sales_units: units,
        p_assumed_sales_value: assumedValue,
        p_effective_from: effectiveFrom,
        p_remarks: remarks,
        p_approval_reference: approval || null,
      });
      if (error) throw error;
      showToast(CSA_FUTURE_REFRESH_MESSAGE, "success", 6200);
      resetSetForm();
      await refreshModalAfterWrite();
    } catch (err) {
      handleError("Failed to save SKU sales assumption", err);
      setModalError(
        err?.message || err?.error_description || "Save failed.",
      );
    } finally {
      writeInFlight = false;
      setWriteControlsDisabled(false);
      setLoadingMask(false);
    }
  }

  async function saveClose() {
    if (!requireEditAccess?.("close SKU sales assumption")) return;
    if (!assertModalContextFresh()) return;
    if (writeInFlight) return;

    const open = findOpenSkuSalesAssumption(historyRows);
    if (!open) {
      setModalError("There is no open ACTIVE assumption to close.");
      return;
    }

    const effectiveTo = String($("csaCloseEffectiveTo")?.value || "").trim();
    const remarks = String($("csaCloseRemarks")?.value || "").trim();
    const approval = String($("csaCloseApprovalReference")?.value || "").trim();
    clearModalError();

    if (!effectiveTo) {
      setModalError("Effective-to date is required.");
      return;
    }
    if (!remarks) {
      setModalError("Closure remarks are required.");
      return;
    }
    const openFrom = isoDateOnly(open.effective_from);
    if (openFrom && compareIsoDate(effectiveTo, openFrom) < 0) {
      setModalError(
        "Effective-to cannot be before the open assumption’s effective-from.",
      );
      return;
    }

    writeInFlight = true;
    setWriteControlsDisabled(true);
    setLoadingMask(true, "Closing SKU sales assumption...");
    try {
      const { error } = await costingRpc("rpc_close_sku_sales_assumption", {
        p_period_start: modalSnapshot.periodStart,
        p_sku_id: Number(modalSnapshot.skuId),
        p_effective_to: effectiveTo,
        p_remarks: remarks,
        p_approval_reference: approval || null,
      });
      if (error) throw error;
      showToast(CSA_FUTURE_REFRESH_MESSAGE, "success", 6200);
      resetSetForm();
      await refreshModalAfterWrite();
    } catch (err) {
      handleError("Failed to close SKU sales assumption", err);
      setModalError(
        err?.message || err?.error_description || "Close failed.",
      );
    } finally {
      writeInFlight = false;
      setWriteControlsDisabled(false);
      setLoadingMask(false);
    }
  }

  function openDefaultPolicyReviseModal(scenarioCode) {
    if (!requireEditAccess?.("revise sales allocation default policy")) return;
    const scenario = String(scenarioCode || "").trim();
    if (!CSA_DEFAULT_SCENARIOS.includes(scenario)) {
      showToast("Unknown default policy scenario.", "error");
      return;
    }
    defaultReviseScenario = scenario;
    clearDefaultModalError();
    const title = $("csaDefaultPolicyTitle");
    if (title) {
      title.textContent = `Revise Default Policy — ${scenarioBusinessLabel(scenario)}`;
    }
    const scenarioEl = $("csaDefaultPolicyScenario");
    if (scenarioEl) scenarioEl.value = scenario;
    const units = $("csaDefaultPolicyUnits");
    if (units) units.value = "";
    const from = $("csaDefaultPolicyEffectiveFrom");
    if (from) from.value = "";
    const reason = $("csaDefaultPolicyReason");
    if (reason) reason.value = "";
    const approval = $("csaDefaultPolicyApproval");
    if (approval) approval.value = "";

    const modal = $("csaDefaultPolicyModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function renderDefaultsHubBody() {
    const host = $("csaDefaultsHubBody");
    if (!host) return;
    if (defaultsLoading) {
      host.innerHTML = `<div class="cp-muted-text">Loading governed defaults…</div>`;
      return;
    }
    if (defaultsError) {
      host.innerHTML = `<div class="status error">Failed to load governed default policies.</div>`;
      return;
    }
    const canWrite = canEdit();
    host.innerHTML = CSA_DEFAULT_SCENARIOS.map((scenario) => {
      const policy = pickDefaultPolicyForScenario(defaultsRows, scenario);
      const label = scenarioBusinessLabel(scenario);
      const reviseBtn = canWrite
        ? `<button type="button" class="icon-btn" data-csa-hub-revise="${text(scenario)}">Revise</button>`
        : "";
      if (!policy) {
        return `<div class="cp-csa-hub-scenario" data-scenario="${text(scenario)}">
          <div class="cp-csa-hub-scenario-head">
            <div>
              <div class="cp-csa-hub-scenario-label">${text(label)}</div>
              <div class="cp-muted-text">${text(scenario)}</div>
            </div>
            ${reviseBtn}
          </div>
          <div class="cp-muted-text">No policy for this scenario.</div>
        </div>`;
      }
      return `<div class="cp-csa-hub-scenario" data-scenario="${text(scenario)}">
        <div class="cp-csa-hub-scenario-head">
          <div>
            <div class="cp-csa-hub-scenario-label">${text(label)}</div>
            <div class="cp-muted-text">${text(scenario)}</div>
          </div>
          ${reviseBtn}
        </div>
        <div class="cp-csa-default-grid">
          <div><span class="cp-muted-text">Quantity</span><div>${formatNumber(policy.default_sales_units)}</div></div>
          <div><span class="cp-muted-text">Status</span><div>${statusChip(normalizeStatus(policy.status))}</div></div>
          <div><span class="cp-muted-text">Effective from</span><div>${formatDate(policy.effective_from)}</div></div>
          <div><span class="cp-muted-text">Effective to</span><div>${formatDate(policy.effective_to)}</div></div>
          <div><span class="cp-muted-text">Reason</span><div>${text(policy.reason || "--")}</div></div>
          <div><span class="cp-muted-text">Approval</span><div>${text(policy.approval_reference || "--")}</div></div>
          <div><span class="cp-muted-text">Previous policy</span><div>${text(policy.previous_policy_id ?? "--")}</div></div>
          <div><span class="cp-muted-text">Created</span><div>${formatDateTime(policy.created_at)} · ${text(policy.created_by || "--")}</div></div>
        </div>
      </div>`;
    }).join("");

    host.querySelectorAll("[data-csa-hub-revise]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openDefaultPolicyReviseModal(btn.getAttribute("data-csa-hub-revise"));
      });
    });
  }

  function openDefaultsHubModal() {
    const modal = $("csaDefaultsHubModal");
    if (!modal) return;
    const title = $("csaDefaultsHubTitle");
    if (title) {
      title.textContent = canEdit()
        ? "Manage Governed Defaults"
        : "View Governed Defaults";
    }
    renderDefaultsHubBody();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeDefaultsHubModal() {
    const modal = $("csaDefaultsHubModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function isDefaultsHubOpen() {
    const modal = $("csaDefaultsHubModal");
    return !!(modal && !modal.classList.contains("hidden"));
  }

  function closeDefaultPolicyModal() {
    const modal = $("csaDefaultPolicyModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    defaultReviseScenario = null;
    defaultWriteInFlight = false;
    clearDefaultModalError();
    const saveBtn = $("csaDefaultPolicySaveBtn");
    if (saveBtn) saveBtn.disabled = false;
  }

  async function saveDefaultPolicyRevision() {
    if (!requireEditAccess?.("revise sales allocation default policy")) return;
    if (defaultWriteInFlight) return;
    const scenario =
      defaultReviseScenario ||
      String($("csaDefaultPolicyScenario")?.value || "").trim();
    if (!CSA_DEFAULT_SCENARIOS.includes(scenario)) {
      setDefaultModalError("Scenario is required.");
      return;
    }
    const unitsRaw = String($("csaDefaultPolicyUnits")?.value ?? "").trim();
    const effectiveFrom = String(
      $("csaDefaultPolicyEffectiveFrom")?.value || "",
    ).trim();
    const reason = String($("csaDefaultPolicyReason")?.value || "").trim();
    const approval = String($("csaDefaultPolicyApproval")?.value || "").trim();
    clearDefaultModalError();

    if (!unitsRaw) {
      setDefaultModalError("Default sales units are required.");
      return;
    }
    const units = Number(unitsRaw);
    if (!Number.isFinite(units) || units <= 0) {
      setDefaultModalError("Default sales units must be greater than zero.");
      return;
    }
    if (!effectiveFrom) {
      setDefaultModalError("Effective-from date is required.");
      return;
    }
    if (!reason) {
      setDefaultModalError("Reason is required.");
      return;
    }

    defaultWriteInFlight = true;
    const saveBtn = $("csaDefaultPolicySaveBtn");
    if (saveBtn) saveBtn.disabled = true;
    setLoadingMask(true, "Saving default sales allocation policy...");
    try {
      const { error } = await costingRpc(
        "rpc_set_sales_allocation_default_policy",
        {
          p_scenario_code: scenario,
          p_default_sales_units: units,
          p_effective_from: effectiveFrom,
          p_reason: reason,
          p_approval_reference: approval || null,
        },
      );
      if (error) throw error;
      closeDefaultPolicyModal();
      showToast(CSA_DEFAULT_POLICY_FUTURE_REFRESH_MESSAGE, "success", 6200);
      try {
        await loadDefaultPolicies();
      } catch (err) {
        handleError("Failed to reload default policies", err);
      }
      if (isDefaultsHubOpen()) renderDefaultsHubBody();
      if (typeof reloadRows === "function") await reloadRows();
    } catch (err) {
      handleError("Failed to save default sales allocation policy", err);
      setDefaultModalError(
        err?.message || err?.error_description || "Save failed.",
      );
    } finally {
      defaultWriteInFlight = false;
      if (saveBtn) saveBtn.disabled = false;
      setLoadingMask(false);
    }
  }

  function onPeriodChanged(periodStart) {
    if (!modalSnapshot) return;
    if (
      periodStart &&
      String(periodStart) !== String(modalSnapshot.periodStart)
    ) {
      closeManageModal();
      showToast(
        "Costing period changed — commercial sales modal closed.",
        "info",
      );
    }
  }

  function wireTableActions(tableBody, getViewRow) {
    if (!tableBody) return;
    tableBody
      .querySelectorAll("tr[data-row-index].cp-csa-mobile-card-row")
      .forEach((tr) => {
        tr.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          if (e.key === " ") e.preventDefault();
          const skuId = tr.getAttribute("data-sku-id");
          const row =
            typeof getViewRow === "function"
              ? getViewRow((r) => String(r?.sku_id) === String(skuId))
              : null;
          if (row) void openManageModal(row);
        });
      });
  }

  function bindEvents() {
    $("csaManageCloseBtn")?.addEventListener("click", closeManageModal);
    $("csaManageDismissBtn")?.addEventListener("click", closeManageModal);
    $("csaManageModal")?.addEventListener("click", (e) => {
      if (e.target === $("csaManageModal")) closeManageModal();
    });
    $("csaSetSaveBtn")?.addEventListener("click", () => {
      void saveSetOrSupersede();
    });
    $("csaCloseSaveBtn")?.addEventListener("click", () => {
      void saveClose();
    });
    $("csaDefaultsHubCloseBtn")?.addEventListener("click", closeDefaultsHubModal);
    $("csaDefaultsHubDismissBtn")?.addEventListener(
      "click",
      closeDefaultsHubModal,
    );
    $("csaDefaultsHubModal")?.addEventListener("click", (e) => {
      if (e.target === $("csaDefaultsHubModal")) closeDefaultsHubModal();
    });
    $("csaDefaultPolicyCloseBtn")?.addEventListener(
      "click",
      closeDefaultPolicyModal,
    );
    $("csaDefaultPolicyCancelBtn")?.addEventListener(
      "click",
      closeDefaultPolicyModal,
    );
    $("csaDefaultPolicyModal")?.addEventListener("click", (e) => {
      if (e.target === $("csaDefaultPolicyModal")) closeDefaultPolicyModal();
    });
    $("csaDefaultPolicySaveBtn")?.addEventListener("click", () => {
      void saveDefaultPolicyRevision();
    });
  }

  function handleEscapeKey() {
    const reviseModal = $("csaDefaultPolicyModal");
    if (reviseModal && !reviseModal.classList.contains("hidden")) {
      closeDefaultPolicyModal();
      return true;
    }
    const hubModal = $("csaDefaultsHubModal");
    if (hubModal && !hubModal.classList.contains("hidden")) {
      closeDefaultsHubModal();
      return true;
    }
    const manageModal = $("csaManageModal");
    if (manageModal && !manageModal.classList.contains("hidden")) {
      closeManageModal();
      return true;
    }
    return false;
  }

  return {
    isActiveWorkspace,
    getTableHeaders,
    getTableAlignments,
    loadRows,
    loadDefaultPolicies,
    filterRows,
    enrichSearchBlob,
    renderTableRow,
    getFilterDrawerContent,
    wireFilterDrawer,
    getDefaultsMetaButtonConfig,
    openDefaultsHubModal,
    wireTableActions,
    openManageModal,
    closeManageModal,
    onPeriodChanged,
    bindEvents,
    handleEscapeKey,
    getSourceFilter,
    getStatusFilter,
    getActiveFilterCount,
    getDefaultsRows,
    getDefaultsError,
    classifyCommercialSalesSourceBucket,
    findOpenSkuSalesAssumption,
  };
}
