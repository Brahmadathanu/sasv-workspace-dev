/* eslint-env node */

/**
 * Read-only duplicate guard for Karpooradi Product Details create.
 * Uses LoadProductDataforLegacy search response coverage — never visible-page inference alone.
 */

const { classifyLookupMatches, namesEqualExact, normalizeLookupName } = require("./lookup-equality");
const { EXPECTED_PORTAL_PRODUCT_NAME } = require("./product-details-field-map");

const DUPLICATE_OUTCOME = Object.freeze({
  NONE: "NONE",
  EXACT_ONE: "EXACT_ONE",
  AMBIGUOUS: "AMBIGUOUS",
  SEARCH_INCOMPLETE: "SEARCH_INCOMPLETE",
  COVERAGE_UNPROVEN: "COVERAGE_UNPROVEN",
});

/**
 * @param {object} searchResponse
 * @param {string} [searchResponse.searchTerm]
 * @param {boolean} [searchResponse.searchApplied]
 * @param {number|null} [searchResponse.totalCount] TotalCount from list response
 * @param {Array} [searchResponse.rows] aaData / result rows for this search
 * @param {boolean} [searchResponse.coverageComplete] Explicit full-result coverage flag
 * @param {string} [searchResponse.source] Must identify LoadProductDataforLegacy
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
  if (res.searchApplied !== true) {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.SEARCH_INCOMPLETE,
      reason: "exact_search_not_applied",
    };
  }
  const expected = normalizeLookupName(res.searchTerm || EXPECTED_PORTAL_PRODUCT_NAME);
  if (!namesEqualExact(expected, EXPECTED_PORTAL_PRODUCT_NAME)) {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.SEARCH_INCOMPLETE,
      reason: "search_term_not_karpooradi",
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
  if (total === 0) {
    return { ok: true, outcome: DUPLICATE_OUTCOME.NONE, totalCount: 0, rows: [] };
  }
  const coverageComplete =
    res.coverageComplete === true || total === res.rows.length;
  if (!coverageComplete) {
    return {
      ok: false,
      outcome: DUPLICATE_OUTCOME.COVERAGE_UNPROVEN,
      reason: "result_page_incomplete_vs_total_count",
      totalCount: total,
      rowCount: res.rows.length,
    };
  }
  return { ok: true, totalCount: total, rows: res.rows };
}

function evaluateDuplicateGuard(searchResponse, expectedName = EXPECTED_PORTAL_PRODUCT_NAME) {
  const coverage = assessSearchCoverage({
    ...(searchResponse || {}),
    searchTerm: searchResponse?.searchTerm || expectedName,
  });
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

  if (coverage.outcome === DUPLICATE_OUTCOME.NONE || coverage.totalCount === 0) {
    return {
      ok: true,
      outcome: DUPLICATE_OUTCOME.NONE,
      matches: [],
      totalCount: 0,
      message: "Exact-name duplicate search proved no match.",
    };
  }

  const classified = classifyLookupMatches(coverage.rows, expectedName);
  if (classified.outcome === "NONE") {
    // Rows present for search but none exact after normalization → treat as NONE only if total covered.
    return {
      ok: true,
      outcome: DUPLICATE_OUTCOME.NONE,
      matches: [],
      totalCount: coverage.totalCount,
      message: "Search coverage complete; no exact-name match.",
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

module.exports = {
  DUPLICATE_OUTCOME,
  assessSearchCoverage,
  evaluateDuplicateGuard,
};
