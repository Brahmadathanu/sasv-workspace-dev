/**
 * Costing Control Center — Portfolio Readiness lens (WP04-G5).
 * Read-only consumer of deployed WP04 server contracts.
 * Server responses are the sole readiness authority; no client-derived
 * severity precedence, portfolio totals, or writer invocation.
 */

export const PORTFOLIO_READINESS_LENS_ID = "portfolio-readiness";
export const READINESS_PAGE_LIMIT = 50;
export const READINESS_PERIOD_LIMIT = 24;
export const READINESS_GAP_LIMIT = 25;
export const READINESS_SEARCH_DEBOUNCE_MS = 300;

export const READINESS_POPULATION_SCOPES = Object.freeze([
  "OPERATIONAL",
  "ALL_EXISTING",
]);

export const READINESS_OVERALL_SEVERITIES = Object.freeze([
  "READY",
  "REVIEW_REQUIRED",
  "BLOCKER",
  "UNKNOWN",
]);

export const READINESS_RPC = Object.freeze({
  governedPeriods: "rpc_get_readiness_governed_periods",
  productGaps: "rpc_get_readiness_product_gaps",
  portfolio: "rpc_get_product_sku_readiness_portfolio",
});

const SUMMARY_DIMENSIONS = Object.freeze([
  ["product_master_foundation_status", "Product master foundation"],
  ["sku_master_foundation_status", "SKU master foundation"],
  ["costing_foundation_status", "Costing foundation"],
  ["evidence_quality_status", "Evidence quality"],
  ["costing_outcome_status", "Costing outcome"],
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  return escapeHtml(value);
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeText(value) {
  const raw = String(value ?? "").trim();
  return raw || null;
}

function toIsoDate(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
  return raw.slice(0, 10);
}

function toBigIntOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}

function clampLimit(value, fallback, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

function uniqueCodes(values) {
  const out = [];
  const seen = new Set();
  for (const value of asArray(values)) {
    const code = normalizeCode(value);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function requireNonNegativeInt(value, label) {
  if (value == null || value === "") {
    return { ok: false, error: `${label} is required.` };
  }
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    return { ok: false, error: `${label} must be a non-negative integer.` };
  }
  return { ok: true, value: n };
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") {
    return { ok: false, error: `${label} must be a boolean.` };
  }
  return { ok: true, value };
}

function requireObject(value, label) {
  const obj = asObject(value);
  if (!obj) return { ok: false, error: `${label} must be an object.` };
  return { ok: true, value: obj };
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    return { ok: false, error: `${label} must be an array.` };
  }
  return { ok: true, value };
}

function requireCodeArray(value, label, { allowEmpty = true } = {}) {
  const arr = requireArray(value, label);
  if (!arr.ok) return arr;
  const codes = uniqueCodes(arr.value);
  if (!allowEmpty && codes.length === 0) {
    return { ok: false, error: `${label} must not be empty.` };
  }
  // Reject if any non-empty input entry failed to normalize into a code.
  const rawNonEmpty = arr.value
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  if (rawNonEmpty.length !== codes.length) {
    return { ok: false, error: `${label} contains invalid codes.` };
  }
  return { ok: true, value: codes };
}

function isPermissionError(err) {
  if (!err) return false;
  const status = Number(err.status ?? err.statusCode ?? err.code);
  if (status === 401 || status === 403) return true;
  const msg = String(err.message || err.error_description || "").toLowerCase();
  return (
    msg.includes("permission") ||
    msg.includes("not authorized") ||
    msg.includes("forbidden") ||
    msg.includes("jwt") ||
    msg.includes("401") ||
    msg.includes("403")
  );
}

export function isPortfolioReadinessLens(lensId) {
  return String(lensId || "").trim() === PORTFOLIO_READINESS_LENS_ID;
}

export function buildGovernedPeriodsRequest({
  beforePeriodStart = null,
  limit = READINESS_PERIOD_LIMIT,
} = {}) {
  return {
    rpc: READINESS_RPC.governedPeriods,
    args: {
      p_before_period_start: toIsoDate(beforePeriodStart),
      p_limit: clampLimit(limit, READINESS_PERIOD_LIMIT),
    },
  };
}

export function buildProductGapsRequest({
  productScope = "ACTIVE_PRODUCTS",
  gapKind = "NO_SKU",
  search = null,
  afterProductId = null,
  limit = READINESS_GAP_LIMIT,
} = {}) {
  return {
    rpc: READINESS_RPC.productGaps,
    args: {
      p_product_scope: normalizeCode(productScope) || "ACTIVE_PRODUCTS",
      p_gap_kind: normalizeCode(gapKind) || "NO_SKU",
      p_search: normalizeText(search),
      p_after_product_id: toBigIntOrNull(afterProductId),
      p_limit: clampLimit(limit, READINESS_GAP_LIMIT),
    },
  };
}

export function buildPortfolioRequest({
  periodStart,
  populationScope = "OPERATIONAL",
  overallSeverities = null,
  dependencyCodes = null,
  ownerModules = null,
  routeCodes = null,
  search = null,
  afterSkuId = null,
  limit = READINESS_PAGE_LIMIT,
} = {}) {
  const scope = normalizeCode(populationScope) || "OPERATIONAL";
  return {
    rpc: READINESS_RPC.portfolio,
    args: {
      p_period_start: toIsoDate(periodStart),
      p_population_scope: READINESS_POPULATION_SCOPES.includes(scope)
        ? scope
        : "OPERATIONAL",
      p_overall_severities: uniqueCodes(overallSeverities),
      p_dependency_codes: uniqueCodes(dependencyCodes),
      p_owner_modules: uniqueCodes(ownerModules),
      p_route_codes: uniqueCodes(routeCodes),
      p_search: normalizeText(search),
      p_after_sku_id: toBigIntOrNull(afterSkuId),
      p_limit: clampLimit(limit, READINESS_PAGE_LIMIT),
    },
  };
}

function emptyFilterArraysToNull(args) {
  const next = { ...args };
  for (const key of [
    "p_overall_severities",
    "p_dependency_codes",
    "p_owner_modules",
    "p_route_codes",
  ]) {
    if (Array.isArray(next[key]) && next[key].length === 0) next[key] = null;
  }
  return next;
}

export function validateGovernedPeriodsEnvelope(payload) {
  const obj = asObject(payload);
  if (!obj) {
    return { ok: false, error: "Governed periods response is not an object." };
  }
  if (obj.observed_at == null || obj.observed_at === "") {
    return { ok: false, error: "Governed periods observed_at is required." };
  }
  const rowsReq = requireArray(obj.rows, "Governed periods rows");
  if (!rowsReq.ok) return rowsReq;
  const limitReq = requireNonNegativeInt(obj.limit, "Governed periods limit");
  if (!limitReq.ok) return limitReq;
  const returnedReq = requireNonNegativeInt(
    obj.returned_count,
    "Governed periods returned_count",
  );
  if (!returnedReq.ok) return returnedReq;
  const hasMoreReq = requireBoolean(obj.has_more, "Governed periods has_more");
  if (!hasMoreReq.ok) return hasMoreReq;

  const rows = [];
  for (const row of rowsReq.value) {
    const periodStart = toIsoDate(row?.period_start);
    if (!periodStart) {
      return {
        ok: false,
        error: "Governed period row missing period_start.",
      };
    }
    rows.push({
      period_start: periodStart,
      valuation_date: toIsoDate(row?.valuation_date),
    });
  }
  if (returnedReq.value !== rows.length) {
    return {
      ok: false,
      error: "Governed periods returned_count does not match rows length.",
    };
  }
  return {
    ok: true,
    value: {
      observed_at: obj.observed_at,
      before_period_start: toIsoDate(obj.before_period_start),
      limit: limitReq.value,
      rows,
      returned_count: returnedReq.value,
      has_more: hasMoreReq.value,
      next_before_period_start: toIsoDate(obj.next_before_period_start),
    },
  };
}

export function validateProductGapsEnvelope(payload) {
  const obj = asObject(payload);
  if (!obj) {
    return { ok: false, error: "Product gaps response is not an object." };
  }
  if (obj.assessment_kind !== "PRODUCT_MEMBERSHIP_GAPS") {
    return {
      ok: false,
      error: "Product gaps assessment_kind mismatch.",
    };
  }
  if (obj.observed_at == null || obj.observed_at === "") {
    return { ok: false, error: "Product gaps observed_at is required." };
  }
  const productScope = normalizeCode(obj.product_scope);
  if (!productScope) {
    return { ok: false, error: "Product gaps product_scope is required." };
  }
  const gapKind = normalizeCode(obj.gap_kind);
  if (!gapKind) {
    return { ok: false, error: "Product gaps gap_kind is required." };
  }
  const rowsReq = requireArray(obj.rows, "Product gaps rows");
  if (!rowsReq.ok) return rowsReq;
  const statsReq = requireObject(obj.statistics, "Product gaps statistics");
  if (!statsReq.ok) return statsReq;
  const productCount = requireNonNegativeInt(
    statsReq.value.product_count,
    "Product gaps statistics.product_count",
  );
  if (!productCount.ok) return productCount;
  const noSkuCount = requireNonNegativeInt(
    statsReq.value.no_sku_count,
    "Product gaps statistics.no_sku_count",
  );
  if (!noSkuCount.ok) return noSkuCount;
  const activeGapCount = requireNonNegativeInt(
    statsReq.value.active_without_active_sku_count,
    "Product gaps statistics.active_without_active_sku_count",
  );
  if (!activeGapCount.ok) return activeGapCount;
  const limitReq = requireNonNegativeInt(obj.limit, "Product gaps limit");
  if (!limitReq.ok) return limitReq;
  const matchedReq = requireNonNegativeInt(
    obj.matched_count,
    "Product gaps matched_count",
  );
  if (!matchedReq.ok) return matchedReq;
  const returnedReq = requireNonNegativeInt(
    obj.returned_count,
    "Product gaps returned_count",
  );
  if (!returnedReq.ok) return returnedReq;
  const hasMoreReq = requireBoolean(obj.has_more, "Product gaps has_more");
  if (!hasMoreReq.ok) return hasMoreReq;
  if (returnedReq.value !== rowsReq.value.length) {
    return {
      ok: false,
      error: "Product gaps returned_count does not match rows length.",
    };
  }

  return {
    ok: true,
    value: {
      assessment_kind: obj.assessment_kind,
      observed_at: obj.observed_at,
      product_scope: productScope,
      gap_kind: gapKind,
      search: obj.search ?? null,
      after_product_id: toBigIntOrNull(obj.after_product_id),
      limit: limitReq.value,
      statistics: {
        product_count: productCount.value,
        no_sku_count: noSkuCount.value,
        active_without_active_sku_count: activeGapCount.value,
      },
      matched_count: matchedReq.value,
      returned_count: returnedReq.value,
      rows: rowsReq.value.map((row) => ({
        product_id: row?.product_id ?? null,
        product_name: row?.product_name ?? null,
        product_status: row?.product_status ?? null,
        gap_kind: normalizeCode(row?.gap_kind),
      })),
      has_more: hasMoreReq.value,
      next_after_product_id: toBigIntOrNull(obj.next_after_product_id),
    },
  };
}

export function validatePortfolioEnvelope(payload) {
  const obj = asObject(payload);
  if (!obj) {
    return { ok: false, error: "Portfolio response is not an object." };
  }
  if (obj.observed_at == null || obj.observed_at === "") {
    return { ok: false, error: "Portfolio observed_at is required." };
  }
  const contextReq = requireObject(obj.context, "Portfolio context");
  if (!contextReq.ok) return contextReq;
  const context = contextReq.value;
  const periodStart = toIsoDate(context.period_start);
  if (!periodStart) {
    return { ok: false, error: "Portfolio context.period_start is required." };
  }
  const populationScope = normalizeCode(obj.population_scope);
  if (
    !populationScope ||
    !READINESS_POPULATION_SCOPES.includes(populationScope)
  ) {
    return { ok: false, error: "Portfolio population_scope is invalid." };
  }
  const rowsReq = requireArray(obj.rows, "Portfolio rows");
  if (!rowsReq.ok) return rowsReq;
  const statsReq = requireObject(obj.statistics, "Portfolio statistics");
  if (!statsReq.ok) return statsReq;
  const populationCount = requireNonNegativeInt(
    statsReq.value.population_sku_count,
    "Portfolio statistics.population_sku_count",
  );
  if (!populationCount.ok) return populationCount;
  const severityCountsReq = requireObject(
    statsReq.value.overall_severity_counts,
    "Portfolio statistics.overall_severity_counts",
  );
  if (!severityCountsReq.ok) return severityCountsReq;
  const severityCounts = {};
  for (const code of READINESS_OVERALL_SEVERITIES) {
    const countReq = requireNonNegativeInt(
      severityCountsReq.value[code],
      `Portfolio statistics.overall_severity_counts.${code}`,
    );
    if (!countReq.ok) return countReq;
    severityCounts[code] = countReq.value;
  }
  for (const key of [
    "unresolved_dependency_counts",
    "unresolved_owner_counts",
    "unresolved_route_counts",
    "unresolved_shared_issue_counts",
    "regional_marketing_counts",
  ]) {
    const arrReq = requireArray(
      statsReq.value[key],
      `Portfolio statistics.${key}`,
    );
    if (!arrReq.ok) return arrReq;
  }
  const filterOptionsReq = requireObject(
    obj.filter_options,
    "Portfolio filter_options",
  );
  if (!filterOptionsReq.ok) return filterOptionsReq;
  const overallSeverities = requireCodeArray(
    filterOptionsReq.value.overall_severities,
    "Portfolio filter_options.overall_severities",
    { allowEmpty: false },
  );
  if (!overallSeverities.ok) return overallSeverities;
  for (const code of overallSeverities.value) {
    if (!READINESS_OVERALL_SEVERITIES.includes(code)) {
      return {
        ok: false,
        error: `Portfolio filter_options.overall_severities contains unsupported code ${code}.`,
      };
    }
  }
  const dependencyCodes = requireCodeArray(
    filterOptionsReq.value.dependency_codes,
    "Portfolio filter_options.dependency_codes",
  );
  if (!dependencyCodes.ok) return dependencyCodes;
  const ownerModules = requireCodeArray(
    filterOptionsReq.value.owner_modules,
    "Portfolio filter_options.owner_modules",
  );
  if (!ownerModules.ok) return ownerModules;
  const routeCodes = requireCodeArray(
    filterOptionsReq.value.route_codes,
    "Portfolio filter_options.route_codes",
  );
  if (!routeCodes.ok) return routeCodes;
  const filtersReq = requireObject(obj.filters, "Portfolio filters");
  if (!filtersReq.ok) return filtersReq;
  const limitReq = requireNonNegativeInt(obj.limit, "Portfolio limit");
  if (!limitReq.ok) return limitReq;
  const matchedReq = requireNonNegativeInt(
    obj.matched_count,
    "Portfolio matched_count",
  );
  if (!matchedReq.ok) return matchedReq;
  const returnedReq = requireNonNegativeInt(
    obj.returned_count,
    "Portfolio returned_count",
  );
  if (!returnedReq.ok) return returnedReq;
  const hasMoreReq = requireBoolean(obj.has_more, "Portfolio has_more");
  if (!hasMoreReq.ok) return hasMoreReq;
  if (returnedReq.value !== rowsReq.value.length) {
    return {
      ok: false,
      error: "Portfolio returned_count does not match rows length.",
    };
  }
  if (hasMoreReq.value === true && toBigIntOrNull(obj.next_after_sku_id) == null) {
    return {
      ok: false,
      error: "Portfolio next_after_sku_id is required when has_more is true.",
    };
  }

  return {
    ok: true,
    value: {
      context: {
        context_type: context.context_type ?? null,
        requested_period_start: toIsoDate(context.requested_period_start),
        period_start: periodStart,
        valuation_date: toIsoDate(context.valuation_date),
        refresh_run_id: context.refresh_run_id ?? null,
        evidence_refresh_run_id: context.evidence_refresh_run_id ?? null,
        context_integrity_status: context.context_integrity_status ?? null,
      },
      observed_at: obj.observed_at,
      population_scope: populationScope,
      filters: filtersReq.value,
      filter_options: {
        overall_severities: overallSeverities.value,
        dependency_codes: dependencyCodes.value,
        owner_modules: ownerModules.value,
        route_codes: routeCodes.value,
      },
      after_sku_id: toBigIntOrNull(obj.after_sku_id),
      limit: limitReq.value,
      statistics: {
        population_sku_count: populationCount.value,
        overall_severity_counts: severityCounts,
        unresolved_dependency_counts: statsReq.value.unresolved_dependency_counts,
        unresolved_owner_counts: statsReq.value.unresolved_owner_counts,
        unresolved_route_counts: statsReq.value.unresolved_route_counts,
        unresolved_shared_issue_counts:
          statsReq.value.unresolved_shared_issue_counts,
        regional_marketing_counts: statsReq.value.regional_marketing_counts,
      },
      matched_count: matchedReq.value,
      returned_count: returnedReq.value,
      rows: rowsReq.value,
      has_more: hasMoreReq.value,
      next_after_sku_id: toBigIntOrNull(obj.next_after_sku_id),
    },
  };
}

export function assessmentSkuId(assessment) {
  const ctx = asObject(assessment?.context);
  return toBigIntOrNull(ctx?.sku_id ?? assessment?.sku_id);
}

export function assessmentOverallSeverity(assessment) {
  const summary = asObject(assessment?.summary);
  return normalizeCode(summary?.overall_severity);
}

function severityChipClass(severity) {
  switch (normalizeCode(severity)) {
    case "READY":
      return "green";
    case "REVIEW_REQUIRED":
      return "amber";
    case "BLOCKER":
      return "red";
    case "UNKNOWN":
      return "gray";
    default:
      return "gray";
  }
}

function formatLabel(code) {
  const raw = normalizeCode(code);
  if (!raw) return "—";
  return raw.replaceAll("_", " ");
}

function boolLabel(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

function assessmentSkuIdFromRow(row) {
  const ctx = asObject(row?.context);
  return toBigIntOrNull(ctx?.sku_id);
}

function dedupeReadinessRows(existingRows, incomingRows) {
  const out = Array.isArray(existingRows) ? [...existingRows] : [];
  const seen = new Set(
    out
      .map((row) => assessmentSkuIdFromRow(row))
      .filter((id) => id != null),
  );
  for (const row of asArray(incomingRows)) {
    const skuId = assessmentSkuIdFromRow(row);
    if (skuId != null) {
      if (seen.has(skuId)) continue;
      seen.add(skuId);
    }
    out.push(row);
  }
  return out;
}

export function createPortfolioReadinessController(deps = {}) {
  const {
    costingRpc,
    showToast,
    text: shellText,
    statusChip,
    normalizeStatus,
    getCurrentLens,
    canView = () => true,
    openDetails,
    closeDetails,
    getSearchValue = () => "",
    closeFilterDrawer = null,
    onFilterUiChange = null,
    onGovernedPeriodsLoaded = null,
    onPortfolioContextLoaded = null,
  } = deps;

  const t = typeof shellText === "function" ? shellText : text;

  let disposed = false;
  let loadGeneration = 0;
  let searchTimer = null;
  let boundHandlers = [];
  let selectedSkuId = null;

  const state = {
    periods: [],
    periodStart: null,
    periodsUnavailable: false,
    periodsError: null,
    populationScope: "OPERATIONAL",
    overallSeverities: [],
    dependencyCodes: [],
    ownerModules: [],
    routeCodes: [],
    search: "",
    afterSkuId: null,
    registerRows: [],
    limit: READINESS_PAGE_LIMIT,
    portfolio: null,
    portfolioUnavailable: false,
    portfolioError: null,
    gaps: null,
    gapsUnavailable: false,
    gapsError: null,
    loadingPeriods: false,
    loadingPortfolio: false,
    loadingGaps: false,
    selectedAssessment: null,
    expandedGapKind: null,
    filterDrawerOpen: false,
  };

  function hostEls() {
    const doc = typeof document !== "undefined" ? document : null;
    if (!doc) {
      return {
        host: null,
        scopeSelect: null,
        severityHost: null,
        dependencyHost: null,
        ownerHost: null,
        routeHost: null,
        filterApplyBtn: null,
        appliedFilters: null,
        summaryHost: null,
        gapHost: null,
        gapDetails: null,
        tableBody: null,
        cardHost: null,
        statusHost: null,
        scrollSentinel: null,
      };
    }
    return {
      host: doc.getElementById("readinessLensHost"),
      scopeSelect: doc.getElementById("readinessPopulationScope"),
      severityHost: doc.getElementById("readinessSeverityFilters"),
      dependencyHost: doc.getElementById("readinessDependencyFilters"),
      ownerHost: doc.getElementById("readinessOwnerFilters"),
      routeHost: doc.getElementById("readinessRouteFilters"),
      filterApplyBtn: doc.getElementById("readinessFilterApply"),
      appliedFilters: doc.getElementById("readinessAppliedFilters"),
      summaryHost: doc.getElementById("readinessSummary"),
      gapHost: doc.getElementById("readinessGaps"),
      gapDetails: doc.getElementById("readinessGapDetails"),
      tableBody: doc.getElementById("readinessTableBody"),
      cardHost: doc.getElementById("readinessCardList"),
      statusHost: doc.getElementById("readinessStatus"),
      scrollSentinel: doc.getElementById("readinessScrollSentinel"),
    };
  }

  function clearSearchTimer() {
    if (searchTimer != null) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
  }

  function unbindHandlers() {
    for (const { el, type, fn } of boundHandlers) {
      el?.removeEventListener?.(type, fn);
    }
    boundHandlers = [];
  }

  function on(el, type, fn) {
    if (!el) return;
    el.addEventListener(type, fn);
    boundHandlers.push({ el, type, fn });
  }

  function invalidatePendingRequests() {
    loadGeneration += 1;
  }

  function isActiveLens() {
    return isPortfolioReadinessLens(
      typeof getCurrentLens === "function" ? getCurrentLens() : null,
    );
  }

  function isLoadCurrent(gen) {
    return !disposed && gen === loadGeneration && isActiveLens();
  }

  function chip(status) {
    const raw = normalizeCode(status);
    if (!raw) return t("—");
    if (typeof statusChip === "function" && typeof normalizeStatus === "function") {
      return statusChip(normalizeStatus(raw));
    }
    return `<span class="chip ${severityChipClass(raw)}">${escapeHtml(raw)}</span>`;
  }

  function setHostVisibility(visible) {
    const { host } = hostEls();
    if (!host) return;
    if (visible) {
      host.hidden = false;
      host.removeAttribute("hidden");
      host.setAttribute("aria-hidden", "false");
      host.classList.add("is-visible");
    } else {
      host.hidden = true;
      host.setAttribute("hidden", "");
      host.setAttribute("aria-hidden", "true");
      host.classList.remove("is-visible");
    }
  }

  function resetKeyset() {
    state.afterSkuId = null;
    state.registerRows = [];
  }

  function resetFilters({ keepSearch = false } = {}) {
    state.overallSeverities = [];
    state.dependencyCodes = [];
    state.ownerModules = [];
    state.routeCodes = [];
    if (!keepSearch) state.search = "";
    resetKeyset();
  }

  async function rpcCall(rpcName, args) {
    if (typeof costingRpc !== "function") {
      throw new Error("costingRpc is required.");
    }
    const { data, error } = await costingRpc(rpcName, args);
    if (error) throw error;
    return data;
  }

  async function loadGovernedPeriods({
    selectNewest = true,
    generation = null,
  } = {}) {
    const gen = generation == null ? ++loadGeneration : generation;
    state.loadingPeriods = true;
    state.periodsUnavailable = false;
    state.periodsError = null;
    renderStatus();
    try {
      if (canView() !== true) {
        throw Object.assign(new Error("Permission denied"), { status: 403 });
      }
      const req = buildGovernedPeriodsRequest({
        limit: READINESS_PERIOD_LIMIT,
      });
      const data = await rpcCall(req.rpc, req.args);
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      const validated = validateGovernedPeriodsEnvelope(data);
      if (!validated.ok) {
        throw new Error(validated.error);
      }
      state.periods = validated.value.rows;
      state.periodsUnavailable = false;
      state.periodsError = null;
      if (selectNewest) {
        state.periodStart = state.periods[0]?.period_start || null;
      } else if (
        state.periodStart &&
        !state.periods.some((p) => p.period_start === state.periodStart)
      ) {
        state.periodStart = state.periods[0]?.period_start || null;
      }
      if (!state.periodStart) {
        state.periodsUnavailable = true;
        state.periodsError = "No governed periods returned.";
      }
      if (typeof onGovernedPeriodsLoaded === "function") {
        onGovernedPeriodsLoaded({
          periods: state.periods,
          periodStart: state.periodStart,
          unavailable: state.periodsUnavailable,
        });
      }
      return { ok: !state.periodsUnavailable, periods: state.periods };
    } catch (err) {
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      state.periods = [];
      state.periodStart = null;
      state.periodsUnavailable = true;
      state.periodsError = isPermissionError(err)
        ? "Unavailable — permission denied for governed periods."
        : `Unavailable — ${err?.message || "governed periods failed to load."}`;
      state.portfolio = null;
      state.portfolioUnavailable = true;
      state.portfolioError = state.periodsError;
      showToast?.(state.periodsError, "error");
      return { ok: false, error: state.periodsError };
    } finally {
      if (isLoadCurrent(gen)) {
        state.loadingPeriods = false;
        syncControlsFromState();
        renderStatus();
      }
    }
  }

  async function loadPortfolio({
    preserveKeyset = false,
    generation = null,
  } = {}) {
    const gen = generation == null ? ++loadGeneration : generation;
    if (!preserveKeyset) resetKeyset();
    state.loadingPortfolio = true;
    state.portfolioUnavailable = false;
    state.portfolioError = null;
    state.selectedAssessment = null;
    selectedSkuId = null;
    renderStatus();
    try {
      if (canView() !== true) {
        throw Object.assign(new Error("Permission denied"), { status: 403 });
      }
      if (state.periodsUnavailable || !state.periodStart) {
        state.portfolio = null;
        state.portfolioUnavailable = true;
        state.portfolioError =
          state.periodsError || "Unavailable — no governed period selected.";
        return { ok: false, unavailable: true };
      }
      const req = buildPortfolioRequest({
        periodStart: state.periodStart,
        populationScope: state.populationScope,
        overallSeverities: state.overallSeverities,
        dependencyCodes: state.dependencyCodes,
        ownerModules: state.ownerModules,
        routeCodes: state.routeCodes,
        search: state.search,
        afterSkuId: state.afterSkuId,
        limit: state.limit,
      });
      const data = await rpcCall(req.rpc, emptyFilterArraysToNull(req.args));
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      const validated = validatePortfolioEnvelope(data);
      if (!validated.ok) throw new Error(validated.error);
      const pageRows = asArray(validated.value.rows);
      if (state.afterSkuId == null) {
        state.registerRows = pageRows.slice();
      } else {
        state.registerRows = dedupeReadinessRows(state.registerRows, pageRows);
      }
      state.portfolio = { ...validated.value, rows: state.registerRows };
      state.portfolioUnavailable = false;
      state.portfolioError = null;
      if (typeof onPortfolioContextLoaded === "function") {
        onPortfolioContextLoaded(asObject(state.portfolio.context) || {});
      }
      return { ok: true, portfolio: state.portfolio };
    } catch (err) {
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      state.portfolio = null;
      state.portfolioUnavailable = true;
      state.portfolioError = isPermissionError(err)
        ? "Unavailable — permission denied for portfolio readiness."
        : `Unavailable — ${err?.message || "portfolio readiness failed to load."}`;
      showToast?.(state.portfolioError, "error");
      return { ok: false, error: state.portfolioError };
    } finally {
      if (isLoadCurrent(gen)) {
        state.loadingPortfolio = false;
        syncControlsFromState();
        render();
      }
    }
  }

  async function loadProductGaps({ generation = null } = {}) {
    const gen = generation == null ? loadGeneration : generation;
    state.loadingGaps = true;
    state.gapsUnavailable = false;
    state.gapsError = null;
    try {
      if (canView() !== true) {
        throw Object.assign(new Error("Permission denied"), { status: 403 });
      }
      const noSkuReq = buildProductGapsRequest({
        productScope: "ACTIVE_PRODUCTS",
        gapKind: "NO_SKU",
        limit: READINESS_GAP_LIMIT,
      });
      const activeGapReq = buildProductGapsRequest({
        productScope: "ACTIVE_PRODUCTS",
        gapKind: "ACTIVE_WITHOUT_ACTIVE_SKU",
        limit: READINESS_GAP_LIMIT,
      });
      const [noSkuData, activeGapData] = await Promise.all([
        rpcCall(noSkuReq.rpc, noSkuReq.args),
        rpcCall(activeGapReq.rpc, activeGapReq.args),
      ]);
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      const noSku = validateProductGapsEnvelope(noSkuData);
      const activeGap = validateProductGapsEnvelope(activeGapData);
      if (!noSku.ok) throw new Error(noSku.error);
      if (!activeGap.ok) throw new Error(activeGap.error);
      state.gaps = {
        no_sku: noSku.value,
        active_without_active_sku: activeGap.value,
      };
      state.gapsUnavailable = false;
      state.gapsError = null;
      return { ok: true, gaps: state.gaps };
    } catch (err) {
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      state.gaps = null;
      state.gapsUnavailable = true;
      state.gapsError = isPermissionError(err)
        ? "Unavailable — permission denied for product gaps."
        : `Unavailable — ${err?.message || "product gaps failed to load."}`;
      return { ok: false, error: state.gapsError };
    } finally {
      if (isLoadCurrent(gen)) {
        state.loadingGaps = false;
        renderGaps();
      }
    }
  }

  async function load({
    resetFiltersOnLoad = false,
    preserveKeyset = false,
    search = null,
  } = {}) {
    if (resetFiltersOnLoad) resetFilters();
    if (search != null) state.search = String(search || "").trim();
    else if (typeof getSearchValue === "function") {
      // Shell search is the sole visible search authority for this lens.
      state.search = String(getSearchValue() || "").trim();
    }

    setHostVisibility(true);
    ensureBound();

    const gen = ++loadGeneration;
    const periodsResult = await loadGovernedPeriods({
      selectNewest: true,
      generation: gen,
    });
    if (periodsResult?.stale) return periodsResult;
    if (!periodsResult?.ok) {
      render();
      return periodsResult;
    }

    const [portfolioResult] = await Promise.all([
      loadPortfolio({ preserveKeyset, generation: gen }),
      loadProductGaps({ generation: gen }),
    ]);
    return portfolioResult;
  }

  function syncSearchFromShell(value) {
    state.search = String(value || "").trim();
    resetKeyset();
    return loadPortfolio({ preserveKeyset: true });
  }

  async function appendNextPortfolioPage() {
    if (state.loadingPortfolio || state.portfolioUnavailable) {
      return { ok: false };
    }
    if (!state.portfolio?.has_more || state.portfolio.next_after_sku_id == null) {
      return { ok: false };
    }
    state.afterSkuId = state.portfolio.next_after_sku_id;
    return loadPortfolio({ preserveKeyset: true });
  }

  function applyShellPeriodStart(periodStart) {
    const iso = toIsoDate(periodStart);
    if (!iso) return Promise.resolve({ ok: false });
    if (iso === state.periodStart) return Promise.resolve({ ok: true });
    state.periodStart = iso;
    resetKeyset();
    invalidatePendingRequests();
    const gen = ++loadGeneration;
    return loadPortfolio({ preserveKeyset: true, generation: gen }).then(
      (result) => {
        if (result?.ok !== false) {
          void loadProductGaps({ generation: gen });
        }
        return result;
      },
    );
  }

  const READINESS_GAP_PREVIEW_LIMIT = 3;

  function readChecklistCodes(host, dataAttr) {
    if (!host) return [];
    return Array.from(
      host.querySelectorAll(`input[type="checkbox"][${dataAttr}]:checked`),
    )
      .map((el) => normalizeCode(el.value))
      .filter(Boolean);
  }

  function activeFilterCount() {
    return (
      state.overallSeverities.length +
      state.dependencyCodes.length +
      state.ownerModules.length +
      state.routeCodes.length
    );
  }

  function setFilterDrawerOpen(open) {
    state.filterDrawerOpen = Boolean(open);
    if (!open && typeof closeFilterDrawer === "function") {
      closeFilterDrawer();
    }
  }

  function notifyFilterUiChange() {
    if (typeof onFilterUiChange === "function") onFilterUiChange();
  }

  function applyControlChanges({ resetPaging = true } = {}) {
    const els = hostEls();
    if (els.scopeSelect?.value) {
      const scope = normalizeCode(els.scopeSelect.value);
      state.populationScope = READINESS_POPULATION_SCOPES.includes(scope)
        ? scope
        : "OPERATIONAL";
    }
    state.overallSeverities = readChecklistCodes(
      els.severityHost,
      "data-readiness-severity",
    );
    state.dependencyCodes = readChecklistCodes(
      els.dependencyHost,
      "data-readiness-dependency",
    );
    state.ownerModules = readChecklistCodes(
      els.ownerHost,
      "data-readiness-owner",
    );
    state.routeCodes = readChecklistCodes(els.routeHost, "data-readiness-route");
    if (typeof getSearchValue === "function") {
      state.search = String(getSearchValue() || "").trim();
    }
    if (resetPaging) resetKeyset();
    invalidatePendingRequests();
    return loadPortfolio({ preserveKeyset: true });
  }

  function fillChecklistOptions(host, options, selected, dataAttr) {
    if (!host) return;
    const selectedSet = new Set(uniqueCodes(selected));
    const values = uniqueCodes(options);
    host.innerHTML = values.length
      ? values
          .map((code) => {
            const checked = selectedSet.has(code) ? " checked" : "";
            return `<li><label class="cp-readiness-check peq-filter-check"><input type="checkbox" ${dataAttr} value="${escapeHtml(
              code,
            )}"${checked}/> ${escapeHtml(formatLabel(code))}</label></li>`;
          })
          .join("")
      : `<li class="cp-muted-text">No server options</li>`;
  }

  function removeAppliedFilter(kind, code) {
    const value = normalizeCode(code);
    if (kind === "severity") {
      state.overallSeverities = state.overallSeverities.filter((c) => c !== value);
    } else if (kind === "dependency") {
      state.dependencyCodes = state.dependencyCodes.filter((c) => c !== value);
    } else if (kind === "owner") {
      state.ownerModules = state.ownerModules.filter((c) => c !== value);
    } else if (kind === "route") {
      state.routeCodes = state.routeCodes.filter((c) => c !== value);
    }
    syncControlsFromState();
    invalidatePendingRequests();
    resetKeyset();
    return loadPortfolio({ preserveKeyset: true });
  }

  function renderAppliedFilterChips() {
    const { appliedFilters } = hostEls();
    const chips = [];
    state.overallSeverities.forEach((code) => {
      chips.push({
        kind: "severity",
        code,
        label: `Severity: ${formatLabel(code)}`,
      });
    });
    state.dependencyCodes.forEach((code) => {
      chips.push({
        kind: "dependency",
        code,
        label: `Dependency: ${formatLabel(code)}`,
      });
    });
    state.ownerModules.forEach((code) => {
      chips.push({
        kind: "owner",
        code,
        label: `Owner: ${formatLabel(code)}`,
      });
    });
    state.routeCodes.forEach((code) => {
      chips.push({
        kind: "route",
        code,
        label: `Route: ${formatLabel(code)}`,
      });
    });
    const count = chips.length;
    notifyFilterUiChange();
    if (!appliedFilters) return;
    if (!count) {
      appliedFilters.innerHTML = "";
      return;
    }
    appliedFilters.innerHTML = chips
      .map(
        (chipItem) =>
          `<button type="button" class="cp-filter-chip cp-readiness-chip" data-readiness-chip-kind="${escapeHtml(
            chipItem.kind,
          )}" data-readiness-chip-code="${escapeHtml(
            chipItem.code,
          )}" aria-label="Remove ${escapeHtml(chipItem.label)}">${escapeHtml(
            chipItem.label,
          )} ×</button>`,
      )
      .join("");
  }

  function syncControlsFromState() {
    const els = hostEls();
    if (els.scopeSelect) {
      els.scopeSelect.value = state.populationScope;
    }
    const filterOptions = state.portfolio?.filter_options || {
      overall_severities: [],
      dependency_codes: [],
      owner_modules: [],
      route_codes: [],
    };
    fillChecklistOptions(
      els.severityHost,
      Array.isArray(state.portfolio?.filter_options?.overall_severities)
        ? state.portfolio.filter_options.overall_severities
        : [],
      state.overallSeverities,
      "data-readiness-severity",
    );
    fillChecklistOptions(
      els.dependencyHost,
      filterOptions.dependency_codes,
      state.dependencyCodes,
      "data-readiness-dependency",
    );
    fillChecklistOptions(
      els.ownerHost,
      filterOptions.owner_modules,
      state.ownerModules,
      "data-readiness-owner",
    );
    fillChecklistOptions(
      els.routeHost,
      filterOptions.route_codes,
      state.routeCodes,
      "data-readiness-route",
    );
    renderAppliedFilterChips();
  }

  function clearReadinessFilters() {
    resetFilters({ keepSearch: true });
    state.expandedGapKind = null;
    setFilterDrawerOpen(false);
    syncControlsFromState();
    invalidatePendingRequests();
    return loadPortfolio({ preserveKeyset: true });
  }

  function applyPendingFilters() {
    setFilterDrawerOpen(false);
    return applyControlChanges({ resetPaging: true });
  }

  function syncGlobalFilterUi() {
    syncControlsFromState();
  }

  function resetGlobalFilterUi() {
    resetFilters({ keepSearch: true });
    state.filterDrawerOpen = false;
    const els = hostEls();
    // Clear checklist drafts so leaving Readiness cannot leak options to other lenses.
    if (els.severityHost) els.severityHost.innerHTML = "";
    if (els.dependencyHost) els.dependencyHost.innerHTML = "";
    if (els.ownerHost) els.ownerHost.innerHTML = "";
    if (els.routeHost) els.routeHost.innerHTML = "";
    if (els.appliedFilters) els.appliedFilters.innerHTML = "";
    notifyFilterUiChange();
  }

  function ensureBound() {
    const els = hostEls();
    if (!els.host || els.host.dataset.bound === "1") return;
    els.host.dataset.bound = "1";

    on(els.scopeSelect, "change", () => {
      void applyControlChanges({ resetPaging: true });
    });
    on(els.appliedFilters, "click", (ev) => {
      const btn = ev.target?.closest?.("[data-readiness-chip-kind]");
      if (!btn) return;
      void removeAppliedFilter(
        btn.dataset.readinessChipKind,
        btn.dataset.readinessChipCode,
      );
    });
    on(els.gapHost, "click", (ev) => {
      const btn = ev.target?.closest?.("[data-readiness-gap-kind]");
      if (!btn) return;
      const kind = String(btn.dataset.readinessGapKind || "");
      state.expandedGapKind = state.expandedGapKind === kind ? null : kind;
      renderGaps();
    });
    on(els.gapDetails, "click", (ev) => {
      const btn = ev.target?.closest?.("[data-readiness-gap-close]");
      if (!btn) return;
      state.expandedGapKind = null;
      renderGaps();
    });
    on(document, "keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (state.expandedGapKind) {
        state.expandedGapKind = null;
        renderGaps();
      }
    });
    on(els.tableBody, "click", (ev) => {
      const row = ev.target?.closest?.("tr[data-sku-id]");
      if (!row) return;
      void selectAssessmentBySkuId(toBigIntOrNull(row.dataset.skuId));
    });
    on(els.tableBody, "keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const row = ev.target?.closest?.("tr[data-sku-id]");
      if (!row) return;
      ev.preventDefault();
      void selectAssessmentBySkuId(toBigIntOrNull(row.dataset.skuId));
    });
    on(els.cardHost, "click", (ev) => {
      const card = ev.target?.closest?.("[data-sku-id]");
      if (!card) return;
      void selectAssessmentBySkuId(toBigIntOrNull(card.dataset.skuId));
    });
    on(els.cardHost, "keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const card = ev.target?.closest?.("[data-sku-id]");
      if (!card) return;
      ev.preventDefault();
      void selectAssessmentBySkuId(toBigIntOrNull(card.dataset.skuId));
    });
  }

  function selectAssessmentBySkuId(skuId) {
    if (skuId == null || !state.portfolio?.rows?.length) return;
    const assessment =
      state.portfolio.rows.find((row) => assessmentSkuId(row) === skuId) || null;
    if (!assessment) return;
    state.selectedAssessment = assessment;
    selectedSkuId = skuId;
    renderTableHighlight();
    if (typeof openDetails === "function") {
      openDetails(assessment);
    }
  }

  function renderStatus() {
    const { statusHost } = hostEls();
    if (!statusHost) return;
    if (state.loadingPeriods || state.loadingPortfolio) {
      statusHost.innerHTML = `<div class="status" role="status">Loading readiness…</div>`;
      return;
    }
    if (state.periodsUnavailable) {
      statusHost.innerHTML = `<div class="status error" role="alert">${escapeHtml(
        state.periodsError || "Unavailable",
      )}</div>`;
      return;
    }
    if (state.portfolioUnavailable) {
      statusHost.innerHTML = `<div class="status error" role="alert">Readiness unavailable — ${escapeHtml(
        state.portfolioError || "Unavailable",
      )}</div>`;
      return;
    }
    statusHost.innerHTML = "";
  }

  function renderSummary() {
    const { summaryHost } = hostEls();
    if (!summaryHost) return;
    if (state.loadingPeriods || state.loadingPortfolio) {
      summaryHost.innerHTML = `<div class="cp-readiness-summary-strip" role="status">Loading summary…</div>`;
      return;
    }
    if (state.portfolioUnavailable || state.periodsUnavailable || !state.portfolio) {
      summaryHost.innerHTML = "";
      return;
    }
    const ctx = state.portfolio.context || {};
    const integrity = ctx.context_integrity_status || ctx.context_type || "—";
    summaryHost.innerHTML = `
      <div class="cp-readiness-summary-strip" aria-label="Live readiness context">
        <span class="cp-readiness-summary-badge">${text(integrity)}</span>
      </div>`;
  }

  function renderGapCard(title, gapKind, gapBucket) {
    const matched = gapBucket?.matched_count ?? 0;
    const rows = Array.isArray(gapBucket?.rows) ? gapBucket.rows : [];
    const expanded = state.expandedGapKind === gapKind;
    const detailsBtn = rows.length
      ? `<button type="button" class="clear-link cp-readiness-gap-toggle" data-readiness-gap-kind="${escapeHtml(
          gapKind,
        )}">${expanded ? "Hide details" : "View details"}</button>`
      : "";
    // Count-first collapsed exception: no product-name preview rows by default.
    return `<div class="cp-readiness-gap-row${expanded ? " is-expanded" : ""}" data-gap-kind="${escapeHtml(gapKind)}">
      <span class="cp-readiness-gap-title">${escapeHtml(title)}</span>
      <span class="cp-readiness-gap-sep">—</span>
      <span class="cp-readiness-gap-count">${text(matched, "0")}</span>
      ${detailsBtn}
    </div>`;
  }

  function renderGapDetailsPanel() {
    const { gapDetails } = hostEls();
    if (!gapDetails) return;
    const kind = state.expandedGapKind;
    if (!kind || !state.gaps || state.gapsUnavailable) {
      gapDetails.hidden = true;
      gapDetails.innerHTML = "";
      return;
    }
    const bucket =
      kind === "no_sku"
        ? state.gaps.no_sku
        : kind === "active_without_active_sku"
          ? state.gaps.active_without_active_sku
          : null;
    if (!bucket) {
      gapDetails.hidden = true;
      gapDetails.innerHTML = "";
      return;
    }
    const rows = Array.isArray(bucket.rows) ? bucket.rows : [];
    const matched = bucket.matched_count ?? rows.length;
    const hasMore = Boolean(bucket.has_more);
    const boundNote = hasMore
      ? `<div class="cp-muted-text">Showing first ${READINESS_GAP_LIMIT} of ${text(
          matched,
          "0",
        )} matched</div>`
      : `<div class="cp-muted-text">Showing ${rows.length} of ${text(
          matched,
          "0",
        )} matched</div>`;
    const listHtml = rows.length
      ? `<ul class="cp-readiness-gap-detail-list">${rows
          .map(
            (row) =>
              `<li><strong>${text(row.product_name)}</strong> · ${text(
                row.product_status,
              )} · ${text(row.gap_kind)}</li>`,
          )
          .join("")}</ul>`
      : `<div class="cp-muted-text">None</div>`;
    gapDetails.hidden = false;
    gapDetails.removeAttribute("hidden");
    gapDetails.innerHTML = `
      <div class="cp-readiness-gap-details-head">
        <strong>${escapeHtml(
          kind === "no_sku"
            ? "Active products without SKU"
            : "Active products without active SKU",
        )}</strong>
        <button type="button" class="peq-filter-action-btn" data-readiness-gap-close>Close</button>
      </div>
      ${boundNote}
      ${listHtml}`;
  }

  function renderGaps() {
    const { gapHost } = hostEls();
    if (!gapHost) return;
    if (state.loadingGaps) {
      gapHost.innerHTML = `<div class="status">Loading product gaps…</div>`;
      renderGapDetailsPanel();
      return;
    }
    if (state.gapsUnavailable) {
      gapHost.innerHTML = `<div class="status error" role="alert">${escapeHtml(
        state.gapsError || "Product gaps unavailable",
      )}</div>`;
      renderGapDetailsPanel();
      return;
    }
    if (!state.gaps) {
      gapHost.innerHTML = "";
      renderGapDetailsPanel();
      return;
    }
    gapHost.innerHTML = `
      <div class="cp-readiness-gap-grid" aria-label="Product membership gaps">
        ${renderGapCard(
          "Active products without SKU",
          "no_sku",
          state.gaps.no_sku,
        )}
        ${renderGapCard(
          "Active products without active SKU",
          "active_without_active_sku",
          state.gaps.active_without_active_sku,
        )}
      </div>`;
    renderGapDetailsPanel();
  }

  function rowIdentityHtml(assessment) {
    const identity = asObject(assessment?.identity) || {};
    const lifecycle = asObject(assessment?.lifecycle) || {};
    const ctx = asObject(assessment?.context) || {};
    const name = identity.product_name || "—";
    const pack =
      identity.pack_size != null
        ? `${identity.pack_size}${identity.pack_uom ? ` ${identity.pack_uom}` : ""}`
        : "—";
    return `
      <div class="cp-cell-primary">${text(name)}</div>
      <div class="cp-muted-text">SKU ${text(ctx.sku_id)} · Product ${text(
        ctx.product_id,
      )} · ${text(pack)} · ${text(lifecycle.product_status)} · SKU ${text(
        boolLabel(lifecycle.sku_is_active),
      )}${
        lifecycle.sku_is_sample ? " · Sample" : ""
      }</div>`;
  }

  function renderRegisterRow(assessment) {
    const skuId = assessmentSkuId(assessment);
    const summary = asObject(assessment?.summary) || {};
    const severity = assessmentOverallSeverity(assessment);
    const selected = skuId != null && skuId === selectedSkuId ? " is-selected" : "";
    return `<tr class="cp-readiness-row${selected}" data-sku-id="${escapeHtml(
      skuId ?? "",
    )}" tabindex="0" role="button" aria-label="Open readiness detail for SKU ${escapeHtml(
      skuId ?? "",
    )}">
      <td>${rowIdentityHtml(assessment)}</td>
      <td>${chip(severity)}</td>
      <td>${chip(summary.product_master_foundation_status)}</td>
      <td>${chip(summary.sku_master_foundation_status)}</td>
      <td>${chip(summary.costing_foundation_status)}</td>
      <td>${chip(summary.evidence_quality_status)}</td>
      <td>${chip(summary.costing_outcome_status)}</td>
    </tr>`;
  }

  function renderCard(assessment) {
    const skuId = assessmentSkuId(assessment);
    const summary = asObject(assessment?.summary) || {};
    const severity = assessmentOverallSeverity(assessment);
    return `<article class="cp-readiness-card" data-sku-id="${escapeHtml(
      skuId ?? "",
    )}" tabindex="0" role="button" aria-label="Open readiness detail for SKU ${escapeHtml(
      skuId ?? "",
    )}">
      <div class="cp-readiness-card-top">${rowIdentityHtml(assessment)}${chip(
        severity,
      )}</div>
      <div class="cp-readiness-card-dims">
        <span>PMF ${chip(summary.product_master_foundation_status)}</span>
        <span>SMF ${chip(summary.sku_master_foundation_status)}</span>
        <span>CF ${chip(summary.costing_foundation_status)}</span>
        <span>EQ ${chip(summary.evidence_quality_status)}</span>
        <span>OUT ${chip(summary.costing_outcome_status)}</span>
      </div>
    </article>`;
  }

  function renderTableHighlight() {
    const { tableBody, cardHost } = hostEls();
    tableBody
      ?.querySelectorAll?.("tr[data-sku-id]")
      ?.forEach?.((row) => {
        row.classList.toggle(
          "is-selected",
          toBigIntOrNull(row.dataset.skuId) === selectedSkuId,
        );
      });
    cardHost
      ?.querySelectorAll?.("[data-sku-id]")
      ?.forEach?.((card) => {
        card.classList.toggle(
          "is-selected",
          toBigIntOrNull(card.dataset.skuId) === selectedSkuId,
        );
      });
  }

  function renderRows() {
    const { tableBody, cardHost } = hostEls();
    if (state.portfolioUnavailable || state.periodsUnavailable) {
      const msg = escapeHtml(
        state.portfolioError || state.periodsError || "Unavailable",
      );
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7"><div class="cp-readiness-unavailable status error" role="alert">Readiness unavailable — ${msg}</div></td></tr>`;
      }
      if (cardHost) {
        cardHost.innerHTML = `<div class="cp-readiness-unavailable status error" role="alert">Readiness unavailable — ${msg}</div>`;
      }
      return;
    }
    if (state.loadingPortfolio || state.loadingPeriods) {
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7"><div class="status" role="status">Loading…</div></td></tr>`;
      }
      if (cardHost) cardHost.innerHTML = `<div class="status" role="status">Loading…</div>`;
      return;
    }
    const rows = state.portfolio?.rows || [];
    if (!rows.length) {
      const empty =
        "No readiness rows match the current filters";
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7"><div class="status">${empty}</div></td></tr>`;
      }
      if (cardHost) {
        cardHost.innerHTML = `<div class="status">${empty}</div>`;
      }
    } else {
      if (tableBody) tableBody.innerHTML = rows.map(renderRegisterRow).join("");
      if (cardHost) cardHost.innerHTML = rows.map(renderCard).join("");
    }
  }

  function render() {
    if (!isActiveLens()) {
      setHostVisibility(false);
      return;
    }
    setHostVisibility(true);
    ensureBound();
    syncControlsFromState();
    renderStatus();
    renderSummary();
    renderGaps();
    renderRows();
  }

  function kv(label, valueHtml) {
    return `<div class="kv-row"><div class="kv-key">${escapeHtml(
      label,
    )}</div><div class="kv-val">${valueHtml}</div></div>`;
  }

  function section(title, bodyHtml, { className = "" } = {}) {
    const cls = className
      ? `cp-readiness-detail-section ${className}`
      : "cp-readiness-detail-section";
    return `<section class="${cls}"><h4>${escapeHtml(
      title,
    )}</h4>${bodyHtml}</section>`;
  }

  function disclose(title, bodyHtml, { open = false } = {}) {
    return `<details class="cp-readiness-detail-disclose"${
      open ? " open" : ""
    }><summary>${escapeHtml(
      title,
    )}</summary><div class="cp-readiness-detail-disclose-body">${bodyHtml}</div></details>`;
  }

  function renderDependency(dep) {
    const d = asObject(dep) || {};
    const status = d.effective_status || d.raw_status;
    const evidence =
      d.evidence_ids == null
        ? ""
        : `<div class="cp-readiness-evidence">${text(
            typeof d.evidence_ids === "string"
              ? d.evidence_ids
              : JSON.stringify(d.evidence_ids),
          )}</div>`;
    return `<div class="cp-readiness-dep">
      <div class="cp-readiness-dep-head">
        <strong>${text(d.label || d.dependency_code)}</strong>
        ${chip(status)}
      </div>
      <div class="cp-muted-text">
        Code ${text(d.dependency_code)} · Applicability ${text(d.applicability)} ·
        Raw ${text(d.raw_status)} · Effective ${text(d.effective_status)} ·
        Owner ${text(d.owner_module)} · Route ${text(d.recommended_ui_route)}
      </div>
      ${d.reason_code ? `<div class="cp-muted-text">Reason ${text(d.reason_code)}</div>` : ""}
      ${d.note ? `<div>${text(d.note)}</div>` : ""}
      ${evidence}
    </div>`;
  }

  function renderDetailHtml(assessment) {
    const a = asObject(assessment) || {};
    const ctx = asObject(a.context) || {};
    const lifecycle = asObject(a.lifecycle) || {};
    const identity = asObject(a.identity) || {};
    const summary = asObject(a.summary) || {};
    const downstream = asObject(a.downstream_control);
    const deps = asArray(a.dependencies);
    const shared = asArray(a.shared_issues);

    const foundationChips = SUMMARY_DIMENSIONS.map(
      ([key, label]) =>
        `<span class="cp-readiness-detail-chip">${escapeHtml(label)} ${chip(
          summary[key],
        )}</span>`,
    ).join("");

    const packLabel =
      identity.pack_size != null
        ? `${identity.pack_size}${
            identity.pack_uom ? ` ${identity.pack_uom}` : ""
          }`
        : null;

    const firstTier = `
      <section class="cp-readiness-detail-section cp-readiness-detail-primary">
        <div class="cp-readiness-detail-overall">
          <span class="cp-readiness-detail-overall-label">Overall</span>
          ${chip(summary.overall_severity)}
        </div>
        <div class="cp-readiness-detail-foundations">${foundationChips}</div>
        <div class="cp-readiness-detail-essentials">
          <span>Pack <strong>${text(packLabel)}</strong></span>
          <span>Product <strong>${text(lifecycle.product_status)}</strong></span>
          <span>SKU active <strong>${text(
            boolLabel(lifecycle.sku_is_active),
          )}</strong></span>
          <span>Sample <strong>${text(
            boolLabel(lifecycle.sku_is_sample),
          )}</strong></span>
        </div>
      </section>`;

    const contextGrid = [
      kv("Product ID", text(ctx.product_id)),
      kv("SKU ID", text(ctx.sku_id)),
      kv("Period start", text(ctx.period_start)),
      kv("Valuation date", text(ctx.valuation_date)),
      kv("Context type", text(ctx.context_type)),
      kv("Integrity", text(ctx.context_integrity_status)),
      kv("Refresh run", text(ctx.refresh_run_id)),
      kv("Evidence refresh run", text(ctx.evidence_refresh_run_id)),
      kv("Run status", text(ctx.run_status)),
    ].join("");

    const depsHtml = deps.length
      ? deps.map(renderDependency).join("")
      : `<div class="cp-muted-text">No dependencies returned.</div>`;

    const sharedHtml = shared.length
      ? shared
          .map((issue) => {
            const s = asObject(issue) || {};
            return `<div class="cp-readiness-dep">
              <div class="cp-readiness-dep-head">
                <strong>${text(s.issue_code)}</strong>
                ${chip(s.status)}
              </div>
              <div class="cp-muted-text">
                Dependency ${text(s.dependency_code)} · Scope ${text(s.scope)} ·
                Owner ${text(s.owner_module)} · Route ${text(s.recommended_ui_route)} ·
                Reason ${text(s.reason_code)}
              </div>
            </div>`;
          })
          .join("")
      : `<div class="cp-muted-text">No shared issues returned.</div>`;

    const downstreamHtml = downstream
      ? [
          kv("First control status", chip(downstream.first_control_status)),
          kv("Control severity", chip(downstream.control_severity)),
          kv("Recommended route", text(downstream.recommended_ui_route)),
          kv("Control note", text(downstream.control_note)),
          kv("Material costing", chip(downstream.material_costing_status)),
          kv("PM costing", chip(downstream.pm_costing_status)),
          kv("Manufacturing COP", chip(downstream.manufacturing_cop_status)),
          kv("Internal loaded cost", chip(downstream.internal_loaded_cost_status)),
          kv("Pricing bridge", chip(downstream.pricing_bridge_status)),
          kv("Selling price bridge", chip(downstream.selling_price_bridge_status)),
          kv("Cost sheet", chip(downstream.cost_sheet_status)),
          kv(
            "Refresh run",
            `<span class="cp-readiness-evidence">${text(
              downstream.refresh_run_id,
            )}</span>`,
          ),
        ].join("")
      : `<div class="cp-muted-text">No downstream control returned.</div>`;

    return `
      ${firstTier}
      ${section("Context", `<div class="cp-readiness-detail-grid">${contextGrid}</div>`, {
        className: "cp-readiness-detail-context",
      })}
      ${disclose("Dependencies", depsHtml)}
      ${disclose("Shared issues", sharedHtml)}
      ${disclose("Downstream control", `<div class="cp-readiness-detail-grid">${downstreamHtml}</div>`)}
    `;
  }

  function getDrawerConfig(row) {
    const assessment = asObject(row) || state.selectedAssessment || {};
    const identity = asObject(assessment.identity) || {};
    const ctx = asObject(assessment.context) || {};
    const severity = assessmentOverallSeverity(assessment);
    return {
      title: identity.product_name || `SKU ${ctx.sku_id || ""}`,
      subtitle: `Readiness · ${severity || "—"} · SKU ${ctx.sku_id ?? "—"}`,
      tabs: [{ id: "readiness", label: "Readiness" }],
      activeTab: "readiness",
    };
  }

  function renderDrawerTab(tabId, row) {
    if (tabId !== "readiness") {
      return `<div class="status">No detail for this tab.</div>`;
    }
    return renderDetailHtml(row || state.selectedAssessment);
  }

  function onLensLoadStart() {
    invalidatePendingRequests();
    clearSearchTimer();
    setHostVisibility(true);
  }

  function onLensExit() {
    invalidatePendingRequests();
    clearSearchTimer();
    setHostVisibility(false);
    state.selectedAssessment = null;
    selectedSkuId = null;
    if (typeof closeDetails === "function") {
      // Shell closes details on lens switch; no forced close here.
    }
  }

  function destroy() {
    disposed = true;
    clearSearchTimer();
    unbindHandlers();
    invalidatePendingRequests();
    const { host } = hostEls();
    if (host) delete host.dataset.bound;
    setHostVisibility(false);
  }

  return {
    load,
    render,
    onLensLoadStart,
    onLensExit,
    destroy,
    dispose: destroy,
    invalidatePendingRequests,
    syncSearchFromShell,
    appendNextPortfolioPage,
    applyShellPeriodStart,
    activeFilterCount,
    applyPendingFilters,
    clearFilters: clearReadinessFilters,
    syncGlobalFilterUi,
    resetGlobalFilterUi,
    getPeriodStart: () => state.periodStart,
    getPopulationScope: () => state.populationScope,
    getMatchedCount: () =>
      state.portfolioUnavailable ? 0 : Number(state.portfolio?.matched_count) || 0,
    getReturnedCount: () =>
      state.portfolioUnavailable ? 0 : Number(state.portfolio?.returned_count) || 0,
    getPopulationCount: () =>
      state.portfolioUnavailable
        ? 0
        : Number(state.portfolio?.statistics?.population_sku_count) || 0,
    isUnavailable: () =>
      state.periodsUnavailable === true || state.portfolioUnavailable === true,
    getUnavailableMessage: () =>
      state.periodsError || state.portfolioError || null,
    getSelectedAssessment: () => state.selectedAssessment,
    getDrawerConfig,
    renderDrawerTab,
    // Exported for smoke / contract checks only — not business calculators.
    __test: {
      getState: () => ({ ...state, selectedSkuId }),
      resetKeyset,
      resetFilters,
      buildGovernedPeriodsRequest,
      buildPortfolioRequest,
      buildProductGapsRequest,
      validateGovernedPeriodsEnvelope,
      validatePortfolioEnvelope,
      validateProductGapsEnvelope,
    },
  };
}
