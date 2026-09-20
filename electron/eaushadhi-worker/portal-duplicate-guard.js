/* eslint-env node */

/**
 * Read-only duplicate guard for Karpooradi Product Details create.
 * Uses LoadProductDataforLegacy blank-search full-list coverage + local exact
 * classification — never visible-page inference alone.
 */

const { classifyLookupMatches, namesEqualExact, normalizeLookupName } = require("./lookup-equality");
const { EXPECTED_PORTAL_PRODUCT_NAME } = require("./product-details-field-map");

/** Upper bound for full-list refetch (pageno=0, length=TotalCount). */
const MAX_LIST_ROWS = 500;

const DUPLICATE_OUTCOME = Object.freeze({
  NONE: "NONE",
  EXACT_ONE: "EXACT_ONE",
  AMBIGUOUS: "AMBIGUOUS",
  SEARCH_INCOMPLETE: "SEARCH_INCOMPLETE",
  COVERAGE_UNPROVEN: "COVERAGE_UNPROVEN",
});

/**
 * Portal business-failure detector for list responses.
 * Fail closed on status 0 / "0" / false / "false".
 */
function isPortalListBusinessFailure(payload) {
  if (!payload || typeof payload !== "object") return false;
  const status = payload.status;
  if (status === 0 || status === false) return true;
  if (status == null) return false;
  const text = String(status).trim().toLowerCase();
  return text === "0" || text === "false";
}

function transportSearchIsBlank(res) {
  if (res?.transportSearchBlank === true) return true;
  if (Object.prototype.hasOwnProperty.call(res || {}, "transportSearch")) {
    return String(res.transportSearch ?? "").trim() === "";
  }
  return false;
}

/**
 * @param {object} searchResponse
 */
function assessSearchCoverage(searchResponse) {
  const res = searchResponse && typeof searchResponse === "object" ? searchResponse : null;
  if (!res) {
    return { ok: false, outcome: DUPLICATE_OUTCOME.SEARCH_INCOMPLETE, reason: "missing_search_response" };
  }
  const source = String(res.source || "").toLowerCase();
  if (!source || !/loadproductdataforlegacy/.test(source)) {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.SEARCH_INCOMPLETE,
      reason: "search_source_not_loadproductdataforlegacy",
    };
  }
  if (!transportSearchIsBlank(res)) {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.SEARCH_INCOMPLETE,
      reason: "transport_search_not_blank",
    };
  }
  if (res.localExactEvaluation !== true) {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.SEARCH_INCOMPLETE,
      reason: "local_exact_evaluation_not_asserted",
    };
  }
  const targetName = res.targetName || res.searchTerm || EXPECTED_PORTAL_PRODUCT_NAME;
  if (!namesEqualExact(normalizeLookupName(targetName), EXPECTED_PORTAL_PRODUCT_NAME)) {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.SEARCH_INCOMPLETE,
      reason: "target_name_not_karpooradi",
    };
  }
  if (!Array.isArray(res.rows)) {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.SEARCH_INCOMPLETE,
      reason: "rows_missing",
    };
  }
  const total =
    res.totalCount == null || res.totalCount === ""
      ? null
      : Number(res.totalCount);
  if (!Number.isFinite(total) || total < 0) {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.COVERAGE_UNPROVEN,
      reason: "total_count_unavailable",
    };
  }
  if (res.coverageComplete !== true) {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.COVERAGE_UNPROVEN,
      reason: res.reason || "result_page_incomplete_vs_total_count",
      totalCount: total,
      rowCount: res.rows.length,
    };
  }
  if (total === 0 && res.rows.length !== 0) {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.COVERAGE_UNPROVEN,
      reason: "total_zero_with_rows",
      totalCount: total,
      rowCount: res.rows.length,
    };
  }
  if (res.rows.length > total) {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.COVERAGE_UNPROVEN,
      reason: "rows_exceed_total_count",
      totalCount: total,
      rowCount: res.rows.length,
    };
  }
  if (total > 0 && res.rows.length !== total) {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.COVERAGE_UNPROVEN,
      reason: "result_page_incomplete_vs_total_count",
      totalCount: total,
      rowCount: res.rows.length,
    };
  }
  return { ok: true, totalCount: total, rows: res.rows, targetName };
}

function evaluateDuplicateGuard(searchResponse, expectedName = EXPECTED_PORTAL_PRODUCT_NAME) {
  const coverage = assessSearchCoverage(searchResponse || {});
  if (!coverage.ok) {
    return {
      ok: false,
      outcome: coverage.outcome,
      reason: coverage.reason,
      matches: [],
      totalCount: coverage.totalCount,
      rowCount: coverage.rowCount,
      message:
        coverage.outcome === DUPLICATE_OUTCOME.COVERAGE_UNPROVEN
          ? "Duplicate search coverage is unproven; refusing create."
          : "Duplicate search is incomplete; refusing create.",
    };
  }

  const classified = classifyLookupMatches(coverage.rows, expectedName);
  if (classified.outcome === "NONE") {
    return {
      ok: true,
      outcome: DUPLICATE_OUTCOME.NONE,
      matches: [],
      totalCount: coverage.totalCount,
      message:
        coverage.totalCount === 0
          ? "Blank-list coverage proved empty catalog; no exact-name match."
          : "Blank-list coverage complete; no exact-name match for Karpooradi Thailam.",
    };
  }
  if (classified.outcome === "EXACT_ONE") {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.EXACT_ONE,
      matches: classified.matches,
      totalCount: coverage.totalCount,
      message: "Exact portal product already exists; refusing duplicate create.",
    };
  }
  return {
    ok: false,
    outcome: DUPLICATE_OUTCOME.AMBIGUOUS,
    matches: classified.matches,
    totalCount: coverage.totalCount,
    message: "Ambiguous exact-name matches; refusing create.",
  };
}

/**
 * Normalize LoadProductDataforLegacy list response into duplicate-guard input.
 * Accepts DataTable-style TotalCount / aaData payloads only.
 * Does not set coverageComplete from a single page alone for non-zero catalogs
 * unless rows.length === TotalCount.
 */
function normalizeLoadProductDataforLegacyResponse(raw, targetName) {
  const resolvedTarget = targetName || EXPECTED_PORTAL_PRODUCT_NAME;
  const payload = raw && typeof raw === "object" ? raw : null;
  if (!payload) {
    return {
      source: "LoadProductDataforLegacy",
      mechanism: "datatable_list_post",
      transportSearch: "",
      transportSearchBlank: true,
      targetName: resolvedTarget,
      localExactEvaluation: true,
      totalCount: null,
      rows: null,
      coverageComplete: false,
      reason: "response_not_object",
    };
  }
  if (isPortalListBusinessFailure(payload)) {
    return {
      source: "LoadProductDataforLegacy",
      mechanism: "datatable_list_post",
      transportSearch: "",
      transportSearchBlank: true,
      targetName: resolvedTarget,
      localExactEvaluation: true,
      totalCount: null,
      rows: null,
      coverageComplete: false,
      reason: "portal_business_failure",
      portalStatus: payload.status,
      portalMessage: payload.message != null ? String(payload.message) : null,
    };
  }
  const rowsRaw = Array.isArray(payload.aaData)
    ? payload.aaData
    : Array.isArray(payload.statusData)
      ? payload.statusData
      : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.rows)
          ? payload.rows
          : null;
  const totalCount =
    payload.TotalCount != null
      ? Number(payload.TotalCount)
      : payload.iTotalRecords != null
        ? Number(payload.iTotalRecords)
        : payload.totalCount != null
          ? Number(payload.totalCount)
          : null;
  const rows = Array.isArray(rowsRaw)
    ? rowsRaw.map((row) => {
        if (row == null) return { name: "" };
        if (typeof row === "string") return { name: row };
        if (Array.isArray(row)) return { name: String(row[1] || row[0] || "") };
        return {
          name: String(row.name || row.product_name || row.ProductName || ""),
          id: row.id != null ? row.id : row.product_id,
        };
      })
    : null;
  const finiteTotal = Number.isFinite(totalCount) ? totalCount : null;
  const coverageComplete =
    finiteTotal != null &&
    Array.isArray(rows) &&
    ((finiteTotal === 0 && rows.length === 0) ||
      (finiteTotal > 0 && rows.length === finiteTotal));
  return {
    source: "LoadProductDataforLegacy",
    mechanism: "datatable_list_post",
    transportSearch: "",
    transportSearchBlank: true,
    targetName: resolvedTarget,
    localExactEvaluation: true,
    totalCount: finiteTotal,
    rows,
    coverageComplete,
  };
}

/**
 * Query params for the proven read-only list endpoint (portal DataTable path).
 * Transport search defaults to blank. targetName is never written into search.
 */
function buildLoadProductDataforLegacyListParams(transportSearchOrOptions, options = {}) {
  let transportSearch = "";
  let opts = options;
  if (
    transportSearchOrOptions != null &&
    typeof transportSearchOrOptions === "object" &&
    !Array.isArray(transportSearchOrOptions)
  ) {
    opts = transportSearchOrOptions;
    transportSearch =
      opts.transportSearch != null ? String(opts.transportSearch) : "";
  } else if (typeof transportSearchOrOptions === "string") {
    // Legacy callers passed searchTerm as first arg — ignore as transport; blank only.
    transportSearch = "";
    opts = options;
  }
  return {
    pageno: opts.pageno != null ? Number(opts.pageno) : 0,
    length: opts.length != null ? Number(opts.length) : 10,
    search: String(transportSearch),
    order: opts.order || "1,null",
    licenseid: opts.licenseid != null ? String(opts.licenseid) : "",
  };
}

/**
 * Build the relative list URL with encoded query parameters.
 */
function buildLoadProductDataforLegacyListUrl(
  baseRelativeUrl = "../admin/LoadProductDataforLegacy",
  params = {},
) {
  const base = String(baseRelativeUrl || "../admin/LoadProductDataforLegacy");
  const qs = new URLSearchParams();
  qs.set("pageno", String(params.pageno != null ? params.pageno : 0));
  qs.set("length", String(params.length != null ? params.length : 10));
  qs.set("search", String(params.search != null ? params.search : ""));
  qs.set("order", String(params.order != null ? params.order : "1,null"));
  qs.set("licenseid", String(params.licenseid != null ? params.licenseid : ""));
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${qs.toString()}`;
}

/** @deprecated Use buildLoadProductDataforLegacyListParams — list inputs are query params, not body. */
function buildLoadProductDataforLegacyListBody(transportSearchOrOptions, options = {}) {
  return buildLoadProductDataforLegacyListParams(transportSearchOrOptions, options);
}

module.exports = {
  MAX_LIST_ROWS,
  DUPLICATE_OUTCOME,
  isPortalListBusinessFailure,
  assessSearchCoverage,
  evaluateDuplicateGuard,
  normalizeLoadProductDataforLegacyResponse,
  buildLoadProductDataforLegacyListParams,
  buildLoadProductDataforLegacyListUrl,
  buildLoadProductDataforLegacyListBody,
};
