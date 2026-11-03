/**
 * Costing Control Center — Portfolio Readiness lens (WP04-G5).
 * Read-only consumer of deployed WP04 server contracts.
 * Server responses are the sole readiness authority; no client-derived
 * severity precedence, portfolio totals, or writer invocation.
 */

import { isCostingRecalcWithDateV1Enabled, isCostingUxConsistencyV1Enabled } from "./costing-feature-flags.js";
import { costingIssueDisplayLabel } from "./costing-status-labels.js";
import { periodDateLabels } from "./costing-recalculation.js";
import { COSTING_ROUTE_CONFIG } from "./costing-route-config.js";
import {
  formatRecommendedUiRouteLabel,
  resolveRecommendedUiRouteTarget,
} from "./costing-suite-recommended-ui-route.js";
import { buildCsv } from "./costing-table-tools.js";

export const PORTFOLIO_READINESS_LENS_ID = "portfolio-readiness";
export const READINESS_PAGE_LIMIT = 50;
export const READINESS_PERIOD_LIMIT = 24;
export const READINESS_GAP_LIMIT = 25;
export const READINESS_SEARCH_DEBOUNCE_MS = 300;
/** Page size used when walking the existing portfolio RPC for "export all matching". */
export const READINESS_EXPORT_PAGE_LIMIT = 100;
/** Hard bound on pages walked by "export all matching" (100 x 200 = 20,000 rows). */
export const READINESS_EXPORT_MAX_PAGES = 200;

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

// ---------------------------------------------------------------------------
// WP05-P01 — Readiness usability helpers (pure; no RPC, no writes).
// Readiness stays a LIVE_AS_OF governed snapshot. Nothing here selects,
// reads or implies an approved/draft costing run.
// ---------------------------------------------------------------------------

export const READINESS_LIVE_AS_OF_CONTEXT_TYPE = "LIVE_AS_OF";

export const READINESS_LIVE_AS_OF_EXPLANATION =
  "Readiness is a live governed snapshot: it is evaluated as of the governed period and the time shown, and it follows current master data. It is not tied to an approved or draft costing run. SKU Control Status can instead show a frozen costing run.";

const NO_DESTINATION_TEXT = "No destination is configured for this item yet.";

const READINESS_NON_ACTIONABLE_STATUSES = new Set(["READY", "NOT_APPLICABLE"]);

/** Describe the governed period / as-of context shown above the register. */
export function describeReadinessLiveAsOf({
  periodStart = null,
  valuationDate = null,
  observedAt = null,
  contextType = null,
  integrityStatus = null,
  populationScope = null,
} = {}) {
  const ctxType = normalizeCode(contextType);
  const known = ctxType === READINESS_LIVE_AS_OF_CONTEXT_TYPE;
  return {
    basis: known ? READINESS_LIVE_AS_OF_CONTEXT_TYPE : ctxType || null,
    isLiveAsOf: known,
    periodStart: toIsoDate(periodStart),
    valuationDate: toIsoDate(valuationDate),
    observedAt: observedAt == null || observedAt === "" ? null : String(observedAt),
    integrityStatus: normalizeCode(integrityStatus) || null,
    populationScope: normalizeCode(populationScope) || null,
    // Only claim "live" when the server says so; otherwise show what it said.
    explanation: known || !ctxType ? READINESS_LIVE_AS_OF_EXPLANATION : null,
  };
}

function isActionableStatus(status, applicability) {
  if (normalizeCode(applicability) === "NOT_APPLICABLE") return false;
  const code = normalizeCode(status);
  if (!code) return true; // no server status: surface it, do not hide a gap
  return !READINESS_NON_ACTIONABLE_STATUSES.has(code);
}

/**
 * Validate a resolver target against the existing route configuration so a
 * button is only offered where a real, configured destination exists.
 */
export function isConfiguredRemediationTarget(target) {
  if (!target || target.navigable !== true) return false;
  const config = COSTING_ROUTE_CONFIG[target.moduleKey];
  if (!config?.routePath) return false;
  if (target.lensId && Array.isArray(config.allowedLensIds)) {
    return config.allowedLensIds.includes(target.lensId);
  }
  return true;
}

function remediationContext(assessment) {
  const ctx = asObject(assessment?.context) || {};
  const downstream = asObject(assessment?.downstream_control) || {};
  return {
    productId: ctx.product_id,
    skuId: ctx.sku_id,
    periodStart: ctx.period_start,
    sellingPriceBridgeStatus: downstream.selling_price_bridge_status,
    pricingBridgeStatus: downstream.pricing_bridge_status,
    // The readiness contract does not return RM/PM blocking-line counts, so
    // Material Rate Manager remediation correctly resolves as non-navigable.
  };
}

/**
 * Build fix actions from the server-provided recommended_ui_route values on an
 * assessment (dependencies, shared issues, downstream control). The resolver
 * decides the destination; where it cannot, the item stays visible without a
 * destination. No route is invented here.
 */
export function buildReadinessRemediationActions(assessment) {
  const a = asObject(assessment);
  if (!a) return [];
  const context = remediationContext(a);
  const actions = [];
  const seen = new Set();

  const push = (kind, title, status, routeCode) => {
    const route = normalizeCode(routeCode);
    if (!route) return;
    const target = resolveRecommendedUiRouteTarget(route, context);
    const navigable = isConfiguredRemediationTarget(target);
    const key = `${route}|${navigable ? JSON.stringify(target.navigateParams || {}) : title}`;
    if (seen.has(key)) return;
    seen.add(key);
    actions.push({
      kind,
      title: title || route,
      status: normalizeCode(status) || null,
      routeCode: route,
      routeLabel: formatRecommendedUiRouteLabel(route) || route,
      navigable,
      buttonLabel: navigable ? target.label : null,
      moduleKey: navigable ? target.moduleKey : null,
      navigateParams: navigable ? { ...(target.navigateParams || {}) } : null,
      unavailableReason: navigable ? null : NO_DESTINATION_TEXT,
    });
  };

  for (const dep of asArray(a.dependencies)) {
    const d = asObject(dep);
    if (!d) continue;
    const status = d.effective_status || d.raw_status;
    if (!isActionableStatus(status, d.applicability)) continue;
    push("dependency", d.label || d.dependency_code, status, d.recommended_ui_route);
  }
  for (const issue of asArray(a.shared_issues)) {
    const s = asObject(issue);
    if (!s) continue;
    if (!isActionableStatus(s.status, null)) continue;
    push("shared_issue", s.issue_code, s.status, s.recommended_ui_route);
  }
  const downstream = asObject(a.downstream_control);
  if (downstream && isActionableStatus(downstream.control_severity, null)) {
    push(
      "downstream_control",
      "Downstream costing control",
      downstream.control_severity,
      downstream.recommended_ui_route,
    );
  }
  return actions;
}

function cssQueryList(value) {
  return Array.isArray(value) ? value.join(",") : String(value);
}

/**
 * Same-origin href for a remediation target when the shell navigator is not
 * injected. Limited to targets whose query keys need no shell-side
 * canonicalisation (Pricing Policy Manager is excluded on purpose).
 */
export function buildReadinessRouteHref(action) {
  if (!action?.navigable || action.moduleKey === "pricing-policy-manager") {
    return null;
  }
  const config = COSTING_ROUTE_CONFIG[action.moduleKey];
  const file = /([^/]+\.html)$/i.exec(String(config?.routePath || ""))?.[1];
  if (!file) return null;
  const p = action.navigateParams || {};
  const qs = new URLSearchParams();
  if (p.lens) qs.set("lens", p.lens);
  if (p.status?.length) qs.set("status", cssQueryList(p.status));
  if (p.issue?.length) qs.set("issue", cssQueryList(p.issue));
  if (p.source?.length) qs.set("source", cssQueryList(p.source));
  if (p.managerTab) qs.set("manager_tab", p.managerTab);
  if (p.periodStart) qs.set("period_start", p.periodStart);
  if (p.productId != null) qs.set("product_id", String(p.productId));
  if (p.skuId != null) qs.set("sku_id", String(p.skuId));
  const query = qs.toString();
  return query ? `${file}?${query}` : file;
}

/** Spreadsheet formula-injection guard that also covers leading whitespace. */
export function neutraliseReadinessCsvCell(value) {
  if (typeof value !== "string") return value;
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export const READINESS_EXPORT_PARTIAL_REASONS = Object.freeze({
  pageLimit: "PAGE_LIMIT_REACHED",
  cursorMissing: "CURSOR_MISSING",
  cursorNotAdvancing: "CURSOR_NOT_ADVANCING",
  emptyPageWithMore: "EMPTY_PAGE_WITH_MORE",
  noNewRows: "NO_NEW_ROWS",
  cursorEchoMismatch: "CURSOR_ECHO_MISMATCH",
  matchedCountChanged: "MATCHED_COUNT_CHANGED",
  rowCountMismatch: "ROW_COUNT_MISMATCH",
});

export const READINESS_EXPORT_EXTENTS = Object.freeze({
  loaded: "LOADED_PAGES",
  all: "ALL_MATCHING",
  partial: "PARTIAL_ALL_MATCHING",
});

export const READINESS_CSV_COLUMNS = Object.freeze([
  { key: "export_basis", label: "Export basis" },
  { key: "export_extent", label: "Export extent" },
  { key: "exported_rows", label: "Rows in export" },
  { key: "export_note", label: "Export note" },
  { key: "matched_count", label: "Server matched count" },
  { key: "population_scope", label: "Population scope" },
  { key: "applied_filters", label: "Applied filters" },
  { key: "search", label: "Search" },
  { key: "period_start", label: "Period start" },
  { key: "valuation_date", label: "Valuation date" },
  { key: "observed_at", label: "Observed at (latest page)" },
  { key: "context_type", label: "Context type" },
  { key: "context_integrity_status", label: "Context integrity" },
  { key: "sku_id", label: "SKU ID" },
  { key: "product_id", label: "Product ID" },
  { key: "product_name", label: "Product" },
  { key: "pack", label: "Pack" },
  { key: "product_status", label: "Product status" },
  { key: "sku_is_active", label: "SKU active" },
  { key: "sku_is_sample", label: "Sample" },
  { key: "overall_severity", label: "Overall" },
  { key: "product_master_foundation_status", label: "Product master" },
  { key: "sku_master_foundation_status", label: "SKU master" },
  { key: "costing_foundation_status", label: "Costing foundation" },
  { key: "evidence_quality_status", label: "Evidence quality" },
  { key: "costing_outcome_status", label: "Costing outcome" },
  { key: "dependencies", label: "Dependencies (code:status)" },
  { key: "first_control_status", label: "First control status" },
  { key: "control_severity", label: "Control severity" },
  { key: "recommended_ui_route", label: "Recommended route" },
  { key: "control_note", label: "Control note" },
  { key: "fix_destination", label: "Fix destination" },
]);

function csvBool(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
}

/** Flatten one readiness assessment into CSV values (raw server values only). */
export function readinessAssessmentToCsvRow(assessment, meta = {}) {
  const a = asObject(assessment) || {};
  const ctx = asObject(a.context) || {};
  const identity = asObject(a.identity) || {};
  const lifecycle = asObject(a.lifecycle) || {};
  const summary = asObject(a.summary) || {};
  const downstream = asObject(a.downstream_control) || {};
  const pack =
    identity.pack_size != null
      ? `${identity.pack_size}${identity.pack_uom ? ` ${identity.pack_uom}` : ""}`
      : "";
  const actions = buildReadinessRemediationActions(a);
  const fix = actions
    .map((x) => `${x.routeLabel}: ${x.navigable ? x.buttonLabel : "no destination"}`)
    .join("; ");
  return {
    export_basis: READINESS_LIVE_AS_OF_CONTEXT_TYPE,
    export_extent: meta.extent ?? "",
    exported_rows: meta.exportedRows ?? "",
    export_note: meta.note ?? "",
    matched_count: meta.matchedCount ?? "",
    population_scope: meta.populationScope ?? "",
    applied_filters: meta.appliedFilters ?? "",
    search: meta.search ?? "",
    period_start: ctx.period_start ?? meta.periodStart ?? "",
    valuation_date: ctx.valuation_date ?? "",
    observed_at: meta.observedAt ?? "",
    context_type: ctx.context_type ?? "",
    context_integrity_status: ctx.context_integrity_status ?? "",
    sku_id: ctx.sku_id ?? "",
    product_id: ctx.product_id ?? "",
    product_name: identity.product_name ?? "",
    pack,
    product_status: lifecycle.product_status ?? "",
    sku_is_active: csvBool(lifecycle.sku_is_active),
    sku_is_sample: csvBool(lifecycle.sku_is_sample),
    overall_severity: summary.overall_severity ?? "",
    product_master_foundation_status: summary.product_master_foundation_status ?? "",
    sku_master_foundation_status: summary.sku_master_foundation_status ?? "",
    costing_foundation_status: summary.costing_foundation_status ?? "",
    evidence_quality_status: summary.evidence_quality_status ?? "",
    costing_outcome_status: summary.costing_outcome_status ?? "",
    dependencies: asArray(a.dependencies)
      .map((d) => {
        const o = asObject(d) || {};
        return `${o.dependency_code ?? ""}:${o.effective_status ?? o.raw_status ?? ""}`;
      })
      .join("; "),
    first_control_status: downstream.first_control_status ?? "",
    control_severity: downstream.control_severity ?? "",
    recommended_ui_route: downstream.recommended_ui_route ?? "",
    control_note: downstream.control_note ?? "",
    fix_destination: fix,
  };
}

/** Build the CSV text. Every string cell passes the formula-injection guard. */
export function buildReadinessCsv(assessments, meta = {}) {
  const rows = asArray(assessments).map((assessment) => {
    const flat = readinessAssessmentToCsvRow(assessment, meta);
    const safe = {};
    for (const [k, v] of Object.entries(flat)) safe[k] = neutraliseReadinessCsvCell(v);
    return safe;
  });
  return buildCsv(READINESS_CSV_COLUMNS, rows);
}

export function buildReadinessCsvFilename({
  periodStart,
  populationScope,
  extent,
  rowCount,
  now = new Date(),
} = {}) {
  const yyyymm = String(periodStart || "").slice(0, 7).replace("-", "");
  const ts = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const extentTag =
    extent === READINESS_EXPORT_EXTENTS.all
      ? "ALL_MATCHING"
      : extent === READINESS_EXPORT_EXTENTS.partial
        ? "PARTIAL"
        : "LOADED_PAGES";
  return `ERP_COSTING_READINESS_LIVE_AS_OF_PERIOD_${yyyymm}_${normalizeCode(
    populationScope,
  ) || "SCOPE"}_${extentTag}_ROWS_${rowCount}_TS_${ts}.csv`;
}

function defaultDownloadCsv(csv, filename) {
  if (typeof document === "undefined" || typeof Blob === "undefined") {
    return false;
  }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Walk the portfolio keyset until complete, or stop with an explicit reason.
 * `fetchPage(afterSkuId)` must return a validated portfolio page value (or
 * throw). `isCancelled()` aborts silently. Completeness is only claimed when
 * the server says has_more=false AND the cursor chain was well-formed AND the
 * unique row count equals the (stable) matched_count.
 */
export async function walkReadinessPortfolioPages({
  fetchPage,
  isCancelled = () => false,
  expectedPeriodStart,
  expectedPopulationScope,
  maxPages = READINESS_EXPORT_MAX_PAGES,
} = {}) {
  const R = READINESS_EXPORT_PARTIAL_REASONS;
  const rows = [];
  const seenRows = new Set();
  const seenCursors = new Set();
  let after = null;
  let observedAt = null;
  let matched = null;
  let pages = 0;
  let reason = null;
  let complete = false;
  while (pages < maxPages) {
    const page = await fetchPage(after);
    if (isCancelled()) return { cancelled: true };
    if (page.context.period_start !== expectedPeriodStart) {
      throw new Error("Export page returned a different governed period.");
    }
    if (page.population_scope !== expectedPopulationScope) {
      throw new Error("Export page returned a different population scope.");
    }
    pages += 1;
    observedAt = page.observed_at;
    if (matched != null && page.matched_count !== matched) {
      reason = R.matchedCountChanged;
      break;
    }
    matched = page.matched_count;
    if ((page.after_sku_id ?? null) !== (after ?? null)) {
      reason = R.cursorEchoMismatch;
      break;
    }
    let added = 0;
    for (const row of asArray(page.rows)) {
      const id = assessmentSkuIdFromRow(row);
      if (id != null) {
        if (seenRows.has(id)) continue;
        seenRows.add(id);
      }
      rows.push(row);
      added += 1;
    }
    if (!page.has_more) {
      complete = rows.length === matched;
      if (!complete) reason = R.rowCountMismatch;
      break;
    }
    const next = page.next_after_sku_id;
    if (next == null) {
      reason = R.cursorMissing;
      break;
    }
    if (page.rows.length === 0) {
      reason = R.emptyPageWithMore;
      break;
    }
    if ((after != null && next <= after) || seenCursors.has(next)) {
      reason = R.cursorNotAdvancing;
      break;
    }
    if (added === 0) {
      reason = R.noNewRows;
      break;
    }
    seenCursors.add(next);
    after = next;
  }
  if (!complete && !reason) reason = R.pageLimit;
  return { rows, observedAt, matched, complete, reason, pages };
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
  if (isCostingUxConsistencyV1Enabled()) {
    const label = costingIssueDisplayLabel(raw);
    return label === raw ? raw.replaceAll("_", " ") : label;
  }
  return raw.replaceAll("_", " ");
}

function displayStatusText(value) {
  return text(
    isCostingUxConsistencyV1Enabled()
      ? costingIssueDisplayLabel(value)
      : value,
  );
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

function dedupeGapRows(existingRows, incomingRows) {
  const out = Array.isArray(existingRows) ? [...existingRows] : [];
  const seen = new Set(
    out
      .map((row) => toBigIntOrNull(row?.product_id))
      .filter((id) => id != null),
  );
  for (const row of asArray(incomingRows)) {
    const productId = toBigIntOrNull(row?.product_id);
    if (productId != null) {
      if (seen.has(productId)) continue;
      seen.add(productId);
    }
    out.push(row);
  }
  return out;
}

const MEMBERSHIP_GAP_SPECS = Object.freeze([
  { streamKey: "no_sku", gapKind: "NO_SKU" },
  {
    streamKey: "active_without_active_sku",
    gapKind: "ACTIVE_WITHOUT_ACTIVE_SKU",
  },
]);

function emptyMembershipGapStream() {
  return {
    rows: [],
    matchedCount: null,
    hasMore: false,
    nextAfterProductId: null,
    loadingMore: false,
    appendError: null,
  };
}

export function createPortfolioReadinessController(deps = {}) {
  const {
    costingRpc,
    getPeriodRunStatus = () => null,
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
    // WP05-P01: optional shell navigator (same signature as the shell's
    // navigateToCostingRoute). When absent, same-page-family hrefs are used.
    navigateToCostingRoute = null,
    downloadCsv = defaultDownloadCsv,
  } = deps;

  const t = typeof shellText === "function" ? shellText : text;

  let disposed = false;
  let loadGeneration = 0;
  let searchTimer = null;
  let boundHandlers = [];
  let selectedSkuId = null;
  let membershipScrollGeneration = 0;
  let membershipScrollObservers = [];
  let exportGeneration = 0;

  const state = {
    exporting: false,
    // Request context (period/scope/filters/search) of the rows currently in the register.
    loadedContext: null,
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
    membershipStatistics: null,
    membershipStreams: {
      no_sku: emptyMembershipGapStream(),
      active_without_active_sku: emptyMembershipGapStream(),
    },
    loadingPeriods: false,
    loadingPortfolio: false,
    loadingGaps: false,
    appendingMore: false,
    selectedAssessment: null,
    membershipModalOpen: false,
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
        membershipBtn: null,
        membershipModal: null,
        membershipModalBody: null,
        membershipModalClose: null,
        tableBody: null,
        cardHost: null,
        statusHost: null,
        appendStatusHost: null,
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
      membershipBtn: doc.getElementById("readinessMembershipExceptionsBtn"),
      membershipModal: doc.getElementById("readinessMembershipModal"),
      membershipModalBody: doc.getElementById("readinessMembershipModalBody"),
      membershipModalClose: doc.getElementById("readinessMembershipModalClose"),
      tableBody: doc.getElementById("readinessTableBody"),
      cardHost: doc.getElementById("readinessCardList"),
      statusHost: doc.getElementById("readinessStatus"),
      appendStatusHost: doc.getElementById("readinessAppendStatus"),
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
    exportGeneration += 1;
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

  function contextFromArgs(args) {
    return Object.freeze({
      periodStart: args.p_period_start,
      populationScope: args.p_population_scope,
      overallSeverities: Object.freeze([...(args.p_overall_severities || [])]),
      dependencyCodes: Object.freeze([...(args.p_dependency_codes || [])]),
      ownerModules: Object.freeze([...(args.p_owner_modules || [])]),
      routeCodes: Object.freeze([...(args.p_route_codes || [])]),
      search: args.p_search ?? null,
    });
  }

  function sameLoadedContext(a, b) {
    return !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
  }

  /** Context the user is looking at right now (period/scope/filters/search). */
  function liveViewContext() {
    return contextFromArgs(
      emptyFilterArraysToNull(
        buildPortfolioRequest({
          periodStart: state.periodStart,
          populationScope: state.populationScope,
          overallSeverities: state.overallSeverities,
          dependencyCodes: state.dependencyCodes,
          ownerModules: state.ownerModules,
          routeCodes: state.routeCodes,
          search: state.search,
        }).args,
      ),
    );
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
    append = false,
  } = {}) {
    const gen = generation == null ? ++loadGeneration : generation;
    if (!preserveKeyset && !append) resetKeyset();
    if (append) {
      state.appendingMore = true;
    } else {
      state.loadingPortfolio = true;
      state.portfolioUnavailable = false;
      state.portfolioError = null;
      state.selectedAssessment = null;
      selectedSkuId = null;
    }
    renderStatus();
    renderAppendStatus();
    try {
      if (canView() !== true) {
        throw Object.assign(new Error("Permission denied"), { status: 403 });
      }
      if (state.periodsUnavailable || !state.periodStart) {
        if (append) {
          return { ok: false, quiet: true };
        }
        state.portfolio = null;
        state.registerRows = [];
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
      state.loadedContext = contextFromArgs(req.args);
      state.portfolioUnavailable = false;
      state.portfolioError = null;
      if (typeof onPortfolioContextLoaded === "function") {
        onPortfolioContextLoaded(asObject(state.portfolio.context) || {});
      }
      return { ok: true, portfolio: state.portfolio };
    } catch (err) {
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      if (append) {
        return {
          ok: false,
          quiet: true,
          error: err?.message || "append failed",
        };
      }
      state.portfolio = null;
      state.loadedContext = null;
      state.registerRows = [];
      state.portfolioUnavailable = true;
      state.portfolioError = isPermissionError(err)
        ? "Unavailable — permission denied for portfolio readiness."
        : `Unavailable — ${err?.message || "portfolio readiness failed to load."}`;
      showToast?.(state.portfolioError, "error");
      return { ok: false, error: state.portfolioError };
    } finally {
      if (isLoadCurrent(gen)) {
        state.loadingPortfolio = false;
        state.appendingMore = false;
        syncControlsFromState();
        render();
      }
    }
  }

  function resetMembershipGapStreams() {
    state.membershipStreams = {
      no_sku: emptyMembershipGapStream(),
      active_without_active_sku: emptyMembershipGapStream(),
    };
    syncGapsLegacySnapshot();
  }

  function resetMembershipGapStreamPresentation() {
    for (const { streamKey } of MEMBERSHIP_GAP_SPECS) {
      const stream = state.membershipStreams[streamKey];
      if (!stream) continue;
      stream.rows = [];
      stream.hasMore = false;
      stream.nextAfterProductId = null;
      stream.loadingMore = false;
      stream.appendError = null;
    }
    syncGapsLegacySnapshot();
  }

  function membershipStreamToBucket(streamKey) {
    const stream = state.membershipStreams[streamKey];
    if (!stream) return null;
    return {
      rows: stream.rows.slice(),
      matched_count: stream.matchedCount,
      has_more: stream.hasMore,
      next_after_product_id: stream.nextAfterProductId,
    };
  }

  function syncGapsLegacySnapshot() {
    state.gaps = {
      no_sku: membershipStreamToBucket("no_sku"),
      active_without_active_sku: membershipStreamToBucket(
        "active_without_active_sku",
      ),
    };
  }

  function teardownMembershipModalScroll() {
    for (const observer of membershipScrollObservers) {
      observer?.disconnect?.();
    }
    membershipScrollObservers = [];
    membershipScrollGeneration += 1;
  }

  async function fetchMembershipGapPage(
    streamKey,
    { append = false, generation = null } = {},
  ) {
    const spec = MEMBERSHIP_GAP_SPECS.find((s) => s.streamKey === streamKey);
    const stream = state.membershipStreams[streamKey];
    if (!spec || !stream) return { ok: false };
    const gen = generation == null ? loadGeneration : generation;
    if (append) {
      if (
        stream.loadingMore ||
        !stream.hasMore ||
        stream.nextAfterProductId == null
      ) {
        return { ok: false, end: true };
      }
      stream.loadingMore = true;
    }
    try {
      if (canView() !== true) {
        throw Object.assign(new Error("Permission denied"), { status: 403 });
      }
      const req = buildProductGapsRequest({
        productScope: "ACTIVE_PRODUCTS",
        gapKind: spec.gapKind,
        afterProductId: append ? stream.nextAfterProductId : null,
        limit: READINESS_GAP_LIMIT,
      });
      const data = await rpcCall(req.rpc, req.args);
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      const validated = validateProductGapsEnvelope(data);
      if (!validated.ok) throw new Error(validated.error);
      const pageRows = asArray(validated.value.rows);
      stream.rows = append
        ? dedupeGapRows(stream.rows, pageRows)
        : pageRows.slice();
      stream.matchedCount = validated.value.matched_count;
      stream.hasMore = Boolean(validated.value.has_more);
      stream.nextAfterProductId =
        validated.value.next_after_product_id ?? null;
      if (!append && validated.value.statistics) {
        state.membershipStatistics = validated.value.statistics;
      }
      stream.appendError = null;
      syncGapsLegacySnapshot();
      return { ok: true, streamKey };
    } catch (err) {
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      if (append) {
        stream.appendError =
          err?.message || "Could not load more membership exceptions.";
        return { ok: false, quiet: true, error: stream.appendError };
      }
      throw err;
    } finally {
      if (isLoadCurrent(gen)) {
        stream.loadingMore = false;
        renderMembershipExceptionsButton();
        if (state.membershipModalOpen) {
          // Append keeps per-stream scroll; first-page / reset starts at top.
          // Scroll restore + single observer arm happen inside renderMembershipModalBody.
          renderMembershipModalBody({ restoreScroll: append });
        }
      }
    }
  }

  async function loadProductGaps({ generation = null } = {}) {
    const gen = generation == null ? loadGeneration : generation;
    state.loadingGaps = true;
    state.gapsUnavailable = false;
    state.gapsError = null;
    resetMembershipGapStreams();
    try {
      if (canView() !== true) {
        throw Object.assign(new Error("Permission denied"), { status: 403 });
      }
      await Promise.all(
        MEMBERSHIP_GAP_SPECS.map(({ streamKey }) =>
          fetchMembershipGapPage(streamKey, { append: false, generation: gen }),
        ),
      );
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      state.gapsUnavailable = false;
      state.gapsError = null;
      syncGapsLegacySnapshot();
      return { ok: true, gaps: state.gaps };
    } catch (err) {
      if (!isLoadCurrent(gen)) return { ok: false, stale: true };
      resetMembershipGapStreams();
      state.membershipStatistics = null;
      state.gaps = null;
      state.gapsUnavailable = true;
      state.gapsError = isPermissionError(err)
        ? "Unavailable — permission denied for product gaps."
        : `Unavailable — ${err?.message || "product gaps failed to load."}`;
      return { ok: false, error: state.gapsError };
    } finally {
      if (isLoadCurrent(gen)) {
        state.loadingGaps = false;
        renderMembershipExceptionsButton();
        if (state.membershipModalOpen) {
          // Full Membership stream reset always starts section scroll at top.
          renderMembershipModalBody({ restoreScroll: false });
        }
      }
    }
  }

  async function appendNextMembershipGapPage(streamKey) {
    const stream = state.membershipStreams[streamKey];
    if (!stream || state.loadingGaps || state.gapsUnavailable) {
      return { ok: false };
    }
    return fetchMembershipGapPage(streamKey, { append: true });
  }

  function setupMembershipModalScroll() {
    teardownMembershipModalScroll();
    if (!state.membershipModalOpen) return;
    const { membershipModalBody } = hostEls();
    if (!membershipModalBody || typeof IntersectionObserver !== "function") {
      return;
    }
    const gen = membershipScrollGeneration;
    membershipModalBody
      .querySelectorAll(".cp-readiness-membership-section-table")
      .forEach((scrollRoot) => {
        const sentinel = scrollRoot.querySelector(
          "[data-membership-gap-sentinel]",
        );
        if (!sentinel) return;
        const observer = new IntersectionObserver(
          (entries) => {
            if (gen !== membershipScrollGeneration) return;
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const streamKey = entry.target?.dataset?.membershipGapStream;
              if (!streamKey) continue;
              void appendNextMembershipGapPage(streamKey).then((result) => {
                if (gen !== membershipScrollGeneration) return;
                if (result?.stale) return;
              });
            }
          },
          { root: scrollRoot, rootMargin: "96px 0px", threshold: 0.01 },
        );
        observer.observe(sentinel);
        membershipScrollObservers.push(observer);
      });
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

    exportGeneration += 1;
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
    exportGeneration += 1;
    resetKeyset();
    return loadPortfolio({ preserveKeyset: true });
  }

  async function appendNextPortfolioPage() {
    if (
      state.loadingPortfolio ||
      state.appendingMore ||
      state.portfolioUnavailable
    ) {
      return { ok: false };
    }
    if (!state.portfolio?.has_more || state.portfolio.next_after_sku_id == null) {
      return { ok: false, end: true };
    }
    state.afterSkuId = state.portfolio.next_after_sku_id;
    return loadPortfolio({ preserveKeyset: true, append: true });
  }

  async function maybeFillReadinessViewport(scrollerEl, { maxPasses = 2 } = {}) {
    const root =
      scrollerEl ||
      (typeof document !== "undefined"
        ? document.querySelector(
            ".cp-readiness-register-wrap.cp-ccc-table-scroll",
          )
        : null);
    if (!root || !isActiveLens()) return { ok: false };
    if (
      state.loadingPortfolio ||
      state.appendingMore ||
      state.portfolioUnavailable ||
      !state.portfolio?.has_more
    ) {
      return { ok: false };
    }
    if (root.scrollHeight > root.clientHeight + 8) {
      return { ok: false, filled: false };
    }
    let passes = 0;
    while (
      passes < maxPasses &&
      state.portfolio?.has_more &&
      !state.loadingPortfolio &&
      !state.appendingMore &&
      root.scrollHeight <= root.clientHeight + 8
    ) {
      const result = await appendNextPortfolioPage();
      passes += 1;
      if (!result?.ok) break;
    }
    return { ok: true, passes };
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
    ensureUsabilityPanels(els);

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
    on(els.membershipBtn, "click", () => {
      openMembershipModal();
    });
    on(els.membershipModalClose, "click", () => {
      closeMembershipModal();
    });
    on(els.membershipModal, "click", (ev) => {
      if (ev.target === els.membershipModal) {
        closeMembershipModal();
        return;
      }
      const retryBtn = ev.target?.closest?.("[data-membership-gap-retry]");
      if (!retryBtn) return;
      const streamKey = retryBtn.dataset.membershipGapRetry;
      const stream = streamKey ? state.membershipStreams[streamKey] : null;
      if (!stream) return;
      stream.appendError = null;
      void appendNextMembershipGapPage(streamKey);
    });
    on(document, "keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (state.membershipModalOpen) {
        closeMembershipModal();
      }
    });
    on(els.host, "click", (ev) => {
      const exportBtn = ev.target?.closest?.("[data-readiness-export]");
      if (!exportBtn) return;
      ev.preventDefault();
      void exportCsv({
        scope: exportBtn.dataset.readinessExport === "all" ? "all" : "loaded",
      });
    });
    on(document, "click", (ev) => {
      const fixBtn = ev.target?.closest?.("[data-readiness-fix]");
      if (!fixBtn) return;
      ev.preventDefault();
      ev.stopPropagation();
      runFixAction(Number(fixBtn.dataset.readinessFix));
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

  function gapMatchedCount(streamKey) {
    const stream = state.membershipStreams[streamKey];
    if (!stream || stream.matchedCount == null) return null;
    const matched = Number(stream.matchedCount);
    return Number.isFinite(matched) ? matched : null;
  }

  function membershipSectionStatus(streamKey) {
    const stream = state.membershipStreams[streamKey];
    if (!stream) return "";
    if (stream.appendError) {
      return `<div class="cp-readiness-gap-bound status error" role="alert">${escapeHtml(
        stream.appendError,
      )} <button type="button" class="cp-prm-link-btn" data-membership-gap-retry="${escapeHtml(
        streamKey,
      )}">Retry</button></div>`;
    }
    if (stream.loadingMore) {
      return `<div class="cp-muted-text cp-readiness-gap-bound" role="status">Loading…</div>`;
    }
    return "";
  }

  function renderMembershipGapSection(title, streamKey) {
    const stream = state.membershipStreams[streamKey];
    const rows = Array.isArray(stream?.rows) ? stream.rows : [];
    const matched = stream?.matchedCount;
    const matchedLabel =
      matched != null && matched !== "" ? ` (${text(matched, "0")})` : "";
    const sectionStatus = membershipSectionStatus(streamKey);
    const tableHtml = rows.length
      ? `<table class="cp-ccc-register-table costing-pricing-table cp-readiness-gap-table" aria-label="${escapeHtml(
          title,
        )}">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>${rows
            .map(
              (row) =>
                `<tr><td>${text(row.product_name)}</td><td>${text(
                  row.product_status,
                )}</td></tr>`,
            )
            .join("")}</tbody>
        </table>`
      : `<div class="cp-muted-text">None</div>`;
    const sentinel = stream?.hasMore
      ? `<div class="cp-membership-gap-sentinel" data-membership-gap-sentinel data-membership-gap-stream="${escapeHtml(
          streamKey,
        )}" aria-hidden="true"></div>`
      : "";
    return `<section class="cp-readiness-membership-section" aria-label="${escapeHtml(
      title,
    )}">
      <h4 class="cp-readiness-membership-section-title">${escapeHtml(
        title,
      )}${matchedLabel}</h4>
      <div class="cp-readiness-membership-section-table" data-membership-gap-stream="${escapeHtml(
        streamKey,
      )}">${tableHtml}${sentinel}${sectionStatus}</div>
    </section>`;
  }

  /** Capture per-stream Membership table scrollTops before DOM rebuild (same modal session only). */
  function captureMembershipSectionScrollTops() {
    const { membershipModalBody } = hostEls();
    const positions = Object.create(null);
    if (!membershipModalBody) return positions;
    membershipModalBody
      .querySelectorAll(
        ".cp-readiness-membership-section-table[data-membership-gap-stream]",
      )
      .forEach((el) => {
        const streamKey = el.getAttribute("data-membership-gap-stream");
        if (!streamKey) return;
        positions[streamKey] = el.scrollTop;
      });
    return positions;
  }

  /** Restore captured per-stream scrollTops onto matching section tables after rebuild. */
  function restoreMembershipSectionScrollTops(positions) {
    const { membershipModalBody } = hostEls();
    if (!membershipModalBody || !positions) return;
    membershipModalBody
      .querySelectorAll(
        ".cp-readiness-membership-section-table[data-membership-gap-stream]",
      )
      .forEach((el) => {
        const streamKey = el.getAttribute("data-membership-gap-stream");
        if (!streamKey || !Object.prototype.hasOwnProperty.call(positions, streamKey)) {
          return;
        }
        const top = Number(positions[streamKey]);
        el.scrollTop = Number.isFinite(top) ? top : 0;
      });
  }

  function renderMembershipModalBody({ restoreScroll = true } = {}) {
    const { membershipModalBody } = hostEls();
    if (!membershipModalBody) return;
    // Capture live per-stream scrollTops only for same-session append/status rerenders.
    // First open, close/reopen, and full stream reset pass restoreScroll:false → start at top.
    const scrollPositions = restoreScroll
      ? captureMembershipSectionScrollTops()
      : Object.create(null);
    if (state.loadingGaps) {
      membershipModalBody.innerHTML = `<div class="status" role="status">Loading product gaps…</div>`;
      teardownMembershipModalScroll();
      return;
    }
    if (state.gapsUnavailable) {
      membershipModalBody.innerHTML = `<div class="status error" role="alert">${escapeHtml(
        state.gapsError || "Product gaps unavailable",
      )}</div>`;
      teardownMembershipModalScroll();
      return;
    }
    membershipModalBody.innerHTML = `
      ${renderMembershipGapSection(
        "Active products without SKU",
        "no_sku",
      )}
      ${renderMembershipGapSection(
        "Active products without active SKU",
        "active_without_active_sku",
      )}`;
    if (restoreScroll) {
      restoreMembershipSectionScrollTops(scrollPositions);
    }
    setupMembershipModalScroll();
  }

  function openMembershipModal() {
    const { membershipModal } = hostEls();
    if (!membershipModal) return;
    state.membershipModalOpen = true;
    membershipModal.classList.remove("hidden");
    membershipModal.removeAttribute("hidden");
    membershipModal.setAttribute("aria-hidden", "false");
    if (!state.loadingGaps && !state.gapsUnavailable) {
      const needsFirstPage =
        !state.membershipStreams.no_sku.rows.length ||
        !state.membershipStreams.active_without_active_sku.rows.length;
      if (needsFirstPage) {
        void Promise.all(
          MEMBERSHIP_GAP_SPECS.map(({ streamKey }) =>
            fetchMembershipGapPage(streamKey, { append: false }),
          ),
        );
      }
    }
    renderMembershipModalBody({ restoreScroll: false });
  }

  function closeMembershipModal() {
    const { membershipModal, membershipModalBody } = hostEls();
    state.membershipModalOpen = false;
    teardownMembershipModalScroll();
    resetMembershipGapStreamPresentation();
    // Drop live section DOM so scroll positions cannot survive into the next modal session.
    if (membershipModalBody) membershipModalBody.innerHTML = "";
    if (!membershipModal) return;
    membershipModal.classList.add("hidden");
    membershipModal.setAttribute("hidden", "");
    membershipModal.setAttribute("aria-hidden", "true");
  }

  function membershipExceptionsAccessibleLabel(noSku, activeGap) {
    if (noSku == null || activeGap == null) {
      return "Membership exceptions";
    }
    return `Membership exceptions: ${noSku} active products without SKU; ${activeGap} active products without active SKU`;
  }

  function renderMembershipExceptionsButton() {
    const { membershipBtn } = hostEls();
    if (!membershipBtn) return;
    let label = "Membership exceptions";
    let title = "Membership exceptions";
    if (!state.gapsUnavailable && state.membershipStreams.no_sku) {
      const noSku = gapMatchedCount("no_sku");
      const activeGap = gapMatchedCount("active_without_active_sku");
      if (noSku != null && activeGap != null) {
        label = `Membership exceptions (${noSku}, ${activeGap})`;
        title = membershipExceptionsAccessibleLabel(noSku, activeGap);
      }
    } else if (state.loadingGaps) {
      label = "Membership exceptions (…)";
      title = "Loading membership exceptions";
    }
    membershipBtn.textContent = label;
    membershipBtn.title = title;
    membershipBtn.setAttribute("aria-label", title);
    membershipBtn.disabled = state.loadingGaps || state.gapsUnavailable;
  }

  function renderAppendStatus() {
    const { appendStatusHost } = hostEls();
    if (!appendStatusHost) return;
    if (state.appendingMore) {
      appendStatusHost.textContent = "Loading more…";
      return;
    }
    if (
      state.portfolio &&
      !state.portfolioUnavailable &&
      !state.portfolio.has_more &&
      (state.registerRows.length || state.portfolio.rows?.length)
    ) {
      appendStatusHost.textContent = "End of results";
      return;
    }
    appendStatusHost.textContent = "";
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
      )} · ${text(pack)} · ${displayStatusText(lifecycle.product_status)} · SKU ${text(
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
      <td>${rowIdentityHtml(assessment)}${rowFixHintHtml(assessment)}</td>
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
      <div class="cp-readiness-card-top">${rowIdentityHtml(assessment)}${rowFixHintHtml(assessment)}${chip(
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
    renderMembershipExceptionsButton();
    if (state.membershipModalOpen) {
      renderMembershipModalBody();
    }
    renderAppendStatus();
    renderRows();
    renderLiveAsOf();
    renderExportControls();
  }

  // ---- WP05-P01: LIVE_AS_OF clarity, remediation, CSV export ----------------

  function ensureUsabilityPanels(els) {
    const host = els.host;
    const doc = typeof document !== "undefined" ? document : null;
    if (!host || !doc) return;
    if (!doc.getElementById("readinessLiveAsOf")) {
      const banner = doc.createElement("div");
      banner.id = "readinessLiveAsOf";
      banner.className = "cp-readiness-live-asof cp-muted-text";
      banner.setAttribute("role", "note");
      banner.setAttribute("aria-label", "Readiness as-of context");
      const anchor = els.statusHost?.nextSibling || null;
      host.insertBefore(banner, anchor);
    }
    const toolbar = host.querySelector(".cp-readiness-register-card-toolbar");
    if (toolbar && !doc.getElementById("readinessExportLoadedBtn")) {
      const wrap = doc.createElement("span");
      wrap.className = "cp-readiness-export";
      wrap.innerHTML =
        `<button type="button" id="readinessExportLoadedBtn" class="cp-readiness-membership-btn" data-readiness-export="loaded">Export CSV</button> ` +
        `<button type="button" id="readinessExportAllBtn" class="cp-readiness-membership-btn" data-readiness-export="all" hidden>Export all matching</button>` +
        `<span id="readinessExportNote" class="cp-muted-text" role="status" aria-live="polite"></span>`;
      toolbar.appendChild(wrap);
    }
  }

  function currentLiveAsOf() {
    const ctx = asObject(state.portfolio?.context) || {};
    const periodRow = state.periods.find((p) => p.period_start === state.periodStart);
    return describeReadinessLiveAsOf({
      periodStart: ctx.period_start || state.periodStart,
      valuationDate: ctx.valuation_date || periodRow?.valuation_date || null,
      observedAt: state.portfolio?.observed_at ?? null,
      contextType: ctx.context_type ?? null,
      integrityStatus: ctx.context_integrity_status ?? null,
      populationScope: state.portfolio?.population_scope || state.populationScope,
    });
  }

  function renderLiveAsOf() {
    const doc = typeof document !== "undefined" ? document : null;
    const el = doc?.getElementById("readinessLiveAsOf");
    if (!el) return;
    if (state.periodsUnavailable && !state.periodStart) {
      el.innerHTML = "";
      return;
    }
    const m = currentLiveAsOf();
    const basis = m.basis
      ? `<strong>${escapeHtml(m.basis === "LIVE_AS_OF" ? "Live as-of snapshot" : `Context ${m.basis}`)}</strong>`
      : `<strong>Live as-of snapshot</strong>`;
    const bits = [
      `Governed period <strong>${text(m.periodStart)}</strong>`,
      `Valuation date <strong>${text(m.valuationDate)}</strong>`,
      `Observed at <strong>${text(m.observedAt)}</strong>`,
      `Population <strong>${text(m.populationScope ? formatLabel(m.populationScope) : null)}</strong>`,
    ];
    if (m.integrityStatus) {
      bits.push(`Integrity <strong>${text(formatLabel(m.integrityStatus))}</strong>`);
    }
    el.innerHTML = `<div>${basis} · ${bits.join(" · ")}</div>${
      m.explanation
        ? `<div>${escapeHtml(m.explanation)}</div>`
        : `<div>The server reported context type ${text(m.basis)}; values are shown as returned.</div>`
    }`;
  }

  function exportFilterSummary(ctx) {
    const parts = [];
    const add = (label, codes) => {
      if (codes.length) parts.push(`${label}=${codes.join("|")}`);
    };
    add("severity", ctx.overallSeverities);
    add("dependency", ctx.dependencyCodes);
    add("owner", ctx.ownerModules);
    add("route", ctx.routeCodes);
    return parts.join("; ");
  }

  function renderExportControls() {
    const doc = typeof document !== "undefined" ? document : null;
    const loadedBtn = doc?.getElementById("readinessExportLoadedBtn");
    const allBtn = doc?.getElementById("readinessExportAllBtn");
    const note = doc?.getElementById("readinessExportNote");
    if (!loadedBtn || !allBtn) return;
    const p = state.portfolio;
    const loaded = state.registerRows.length;
    const matched = Number(p?.matched_count) || 0;
    const usable =
      !!p && !state.portfolioUnavailable && !state.periodsUnavailable && loaded > 0;
    const more = usable && p.has_more === true;
    loadedBtn.textContent = !usable
      ? "Export CSV"
      : more
        ? `Export loaded rows (${loaded} of ${matched})`
        : `Export CSV (${loaded} row${loaded === 1 ? "" : "s"})`;
    loadedBtn.disabled = !usable || state.exporting || state.loadingPortfolio;
    allBtn.hidden = !more;
    if (more) allBtn.removeAttribute("hidden");
    else allBtn.setAttribute("hidden", "");
    allBtn.textContent = `Export all matching (${matched})`;
    allBtn.disabled = !more || state.exporting || state.loadingPortfolio;
    if (note) {
      note.textContent = state.exporting
        ? " Preparing export…"
        : more
          ? " Loaded rows only covers pages already loaded; use Export all matching for the full filtered set."
          : "";
    }
  }

  function describePartialReason(reason) {
    const R = READINESS_EXPORT_PARTIAL_REASONS;
    switch (reason) {
      case R.pageLimit:
        return "page limit reached";
      case R.matchedCountChanged:
        return "matched count changed while exporting";
      case R.rowCountMismatch:
        return "row count did not match the server matched count";
      default:
        return "server paging was inconsistent";
    }
  }

  /**
   * Export readiness as CSV through the existing portfolio contract.
   * scope "loaded": exactly the rows already loaded in the register.
   * scope "all": walks the same RPC with the context the register was loaded
   * with (period/scope/filters/search are frozen at click time; any change to
   * the view while exporting cancels the export instead of mixing contexts).
   */
  async function exportCsv({ scope = "loaded" } = {}) {
    if (state.exporting) return { ok: false, busy: true };
    try {
      if (canView() !== true) {
        throw Object.assign(new Error("Permission denied"), { status: 403 });
      }
      if (
        !state.portfolio ||
        state.portfolioUnavailable ||
        !state.periodStart ||
        !state.loadedContext
      ) {
        showToast?.("Readiness is not available to export.", "error");
        return { ok: false };
      }
      if (state.loadingPortfolio || state.appendingMore) {
        showToast?.("Readiness is still loading; try the export again.", "info");
        return { ok: false, busy: true };
      }
      const ctx = state.loadedContext;
      if (!sameLoadedContext(ctx, liveViewContext())) {
        showToast?.(
          "Filters or search changed since the register loaded; apply them before exporting.",
          "info",
        );
        return { ok: false, stale: true };
      }
      state.exporting = true;
      const gen = ++exportGeneration;
      renderExportControls();
      const viewStillSame = () =>
        gen === exportGeneration &&
        !disposed &&
        isActiveLens() &&
        sameLoadedContext(ctx, state.loadedContext) &&
        sameLoadedContext(ctx, liveViewContext());
      let rows;
      let extent;
      let note = "";
      let partialReason = null;
      let observedAt = state.portfolio.observed_at;
      let matched = state.portfolio.matched_count;
      if (scope === "all") {
        const res = await walkReadinessPortfolioPages({
          expectedPeriodStart: ctx.periodStart,
          expectedPopulationScope: ctx.populationScope,
          isCancelled: () => !viewStillSame(),
          fetchPage: async (afterSkuId) => {
            const req = buildPortfolioRequest({
              periodStart: ctx.periodStart,
              populationScope: ctx.populationScope,
              overallSeverities: ctx.overallSeverities,
              dependencyCodes: ctx.dependencyCodes,
              ownerModules: ctx.ownerModules,
              routeCodes: ctx.routeCodes,
              search: ctx.search,
              afterSkuId,
              limit: READINESS_EXPORT_PAGE_LIMIT,
            });
            const data = await rpcCall(req.rpc, emptyFilterArraysToNull(req.args));
            if (!viewStillSame()) return { cancelledPage: true, context: {} };
            const validated = validatePortfolioEnvelope(data);
            if (!validated.ok) throw new Error(validated.error);
            return validated.value;
          },
        });
        if (res.cancelled || !viewStillSame()) {
          showToast?.("Export cancelled because the view changed; nothing was downloaded.", "info");
          return { ok: false, cancelled: true };
        }
        rows = res.rows;
        observedAt = res.observedAt;
        matched = res.matched;
        extent = res.complete
          ? READINESS_EXPORT_EXTENTS.all
          : READINESS_EXPORT_EXTENTS.partial;
        if (!res.complete) {
          partialReason = res.reason;
          note = `PARTIAL: ${rows.length} of ${matched} matching rows (${describePartialReason(res.reason)}: ${res.reason})`;
        }
      } else {
        rows = state.registerRows.slice();
        extent = READINESS_EXPORT_EXTENTS.loaded;
        if (state.portfolio.has_more) {
          note = `LOADED PAGES ONLY: ${rows.length} of ${matched} matching rows`;
        }
      }
      if (!rows.length) {
        showToast?.("No rows to export", "info");
        return { ok: false, empty: true };
      }
      const meta = {
        extent,
        note,
        exportedRows: rows.length,
        matchedCount: matched,
        populationScope: ctx.populationScope,
        appliedFilters: exportFilterSummary(ctx),
        search: ctx.search ?? "",
        periodStart: ctx.periodStart,
        observedAt,
      };
      const csv = buildReadinessCsv(rows, meta);
      const filename = buildReadinessCsvFilename({
        periodStart: ctx.periodStart,
        populationScope: ctx.populationScope,
        extent,
        rowCount: rows.length,
      });
      downloadCsv(csv, filename);
      const label =
        extent === READINESS_EXPORT_EXTENTS.loaded
          ? `Exported ${rows.length} loaded row${rows.length === 1 ? "" : "s"}${
              state.portfolio.has_more ? ` of ${matched} matched (not the full set)` : ""
            }`
          : extent === READINESS_EXPORT_EXTENTS.all
            ? `Exported all ${rows.length} matching rows`
            : `Partial export: ${rows.length} of ${matched} matching rows (${describePartialReason(
                partialReason,
              )}) — not the full set`;
      showToast?.(label, extent === READINESS_EXPORT_EXTENTS.partial ? "info" : "success");
      return { ok: true, extent, rowCount: rows.length, filename, csv, note };
    } catch (err) {
      const msg = isPermissionError(err)
        ? "Export unavailable — permission denied for portfolio readiness."
        : `Export failed — ${err?.message || "could not read readiness."}`;
      showToast?.(msg, "error");
      return { ok: false, error: msg };
    } finally {
      state.exporting = false;
      renderExportControls();
    }
  }

  function currentFixActions() {
    return state.selectedAssessment
      ? buildReadinessRemediationActions(state.selectedAssessment)
      : [];
  }

  function rowFixHintHtml(assessment) {
    const nav = buildReadinessRemediationActions(assessment).filter((x) => x.navigable);
    if (!nav.length) return "";
    const names = Array.from(new Set(nav.map((x) => x.routeLabel)));
    return `<div class="cp-muted-text">Fix available: ${escapeHtml(names.join(", "))}</div>`;
  }

  function renderFixActionsHtml(assessment) {
    const actions = buildReadinessRemediationActions(assessment);
    if (!actions.length) return "";
    const items = actions
      .map((x, idx) => {
        const status = x.status ? ` ${chip(x.status)}` : "";
        const control = x.navigable
          ? `<button type="button" class="cp-prm-link-btn" data-readiness-fix="${idx}">${escapeHtml(
              x.buttonLabel,
            )}</button> <span class="cp-muted-text">opens in a new tab</span>`
          : `<span class="cp-muted-text">${escapeHtml(x.routeLabel)} — ${escapeHtml(
              x.unavailableReason,
            )}</span>`;
        return `<li class="cp-readiness-fix-item"><strong>${escapeHtml(
          formatLabel(x.title),
        )}</strong>${status}<div>${control}</div></li>`;
      })
      .join("");
    return section(
      "How to fix",
      `<ul class="cp-readiness-fix-list">${items}</ul>`,
      { className: "cp-readiness-detail-fix" },
    );
  }

  function runFixAction(index) {
    const action = currentFixActions()[index];
    if (!action || !action.navigable) {
      showToast?.(NO_DESTINATION_TEXT, "info");
      return { ok: false };
    }
    if (typeof navigateToCostingRoute === "function") {
      navigateToCostingRoute(action.moduleKey, action.navigateParams, {
        newTab: true,
      });
      return { ok: true, via: "shell" };
    }
    const href = buildReadinessRouteHref(action);
    if (href && typeof window !== "undefined" && typeof window.open === "function") {
      window.open(href, "_blank", "noopener,noreferrer");
      return { ok: true, via: "href", href };
    }
    showToast?.(NO_DESTINATION_TEXT, "info");
    return { ok: false };
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
          <span>Product <strong>${displayStatusText(lifecycle.product_status)}</strong></span>
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
      ...(isCostingRecalcWithDateV1Enabled()
        ? periodDateLabels(getPeriodRunStatus(ctx.period_start)).map(([label, value]) => kv(label, text(value)))
        : [kv("Valuation date", text(ctx.valuation_date))]),
      kv("Context type", text(ctx.context_type)),
      kv("Integrity", displayStatusText(ctx.context_integrity_status)),
      kv("Refresh run", text(ctx.refresh_run_id)),
      kv("Evidence refresh run", text(ctx.evidence_refresh_run_id)),
      kv("Run status", displayStatusText(ctx.run_status)),
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
      ${renderFixActionsHtml(a)}
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
      subtitle: `Readiness · ${
        isCostingUxConsistencyV1Enabled()
          ? costingIssueDisplayLabel(severity) || "—"
          : severity || "—"
      } · SKU ${ctx.sku_id ?? "—"}`,
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
    closeMembershipModal();
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
    teardownMembershipModalScroll();
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
    appendNextMembershipGapPage,
    maybeFillReadinessViewport,
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
    exportCsv,
    getRemediationActions: (assessment) =>
      buildReadinessRemediationActions(assessment || state.selectedAssessment),
    runFixAction,
    getLiveAsOf: currentLiveAsOf,
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
