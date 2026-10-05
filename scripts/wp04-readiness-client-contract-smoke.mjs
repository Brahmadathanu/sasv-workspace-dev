/**
 * WP04-G5 — Portfolio Readiness client contract smoke (mocked).
 * Proves request generation, fail-closed envelope validation, stale suppression,
 * keyset reset rules, single shell search authority, UNKNOWN vs unavailable,
 * and read-only boundaries.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readinessPath = join(
  root,
  "public/shared/js/costing-suite-readiness.js",
);
const readinessSrc = readFileSync(readinessPath, "utf8");
const htmlSrc = readFileSync(
  join(root, "public/shared/costing-control-center.html"),
  "utf8",
);
const shellSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
const cssSrc = readFileSync(
  join(root, "public/shared/css/sasv-costing.css"),
  "utf8",
);

const {
  READINESS_RPC,
  buildGovernedPeriodsRequest,
  buildProductGapsRequest,
  buildPortfolioRequest,
  validateGovernedPeriodsEnvelope,
  validateProductGapsEnvelope,
  validatePortfolioEnvelope,
  assessmentOverallSeverity,
  createPortfolioReadinessController,
  isPortfolioReadinessLens,
  PORTFOLIO_READINESS_LENS_ID,
} = await import(pathToFileURL(readinessPath).href);

function pass(label) {
  console.log(`PASS ${label}`);
}

assert.equal(isPortfolioReadinessLens(PORTFOLIO_READINESS_LENS_ID), true);
assert.equal(isPortfolioReadinessLens("dashboard"), false);
pass("lens id helper");

const periodsReq = buildGovernedPeriodsRequest({ limit: 24 });
assert.equal(periodsReq.rpc, "rpc_get_readiness_governed_periods");
assert.equal(periodsReq.args.p_limit, 24);
assert.equal(periodsReq.args.p_before_period_start, null);
pass("governed periods request");

const gapsReq = buildProductGapsRequest({
  productScope: "ACTIVE_PRODUCTS",
  gapKind: "NO_SKU",
  afterProductId: 12,
  limit: 25,
});
assert.equal(gapsReq.rpc, "rpc_get_readiness_product_gaps");
assert.deepEqual(
  [
    gapsReq.args.p_product_scope,
    gapsReq.args.p_gap_kind,
    gapsReq.args.p_after_product_id,
    gapsReq.args.p_limit,
  ],
  ["ACTIVE_PRODUCTS", "NO_SKU", 12, 25],
);
pass("product gaps request");

const portfolioReq = buildPortfolioRequest({
  periodStart: "2026-09-01",
  populationScope: "OPERATIONAL",
  overallSeverities: ["BLOCKER", "UNKNOWN"],
  dependencyCodes: ["MRP_POLICY"],
  ownerModules: ["PRICING_POLICY_MANAGER"],
  routeCodes: ["MRP_GOVERNANCE"],
  search: "ashwa",
  afterSkuId: 40,
  limit: 50,
});
assert.equal(portfolioReq.rpc, "rpc_get_product_sku_readiness_portfolio");
assert.equal(portfolioReq.args.p_period_start, "2026-09-01");
assert.equal(portfolioReq.args.p_population_scope, "OPERATIONAL");
assert.deepEqual(portfolioReq.args.p_overall_severities, ["BLOCKER", "UNKNOWN"]);
assert.equal(portfolioReq.args.p_after_sku_id, 40);
assert.equal(portfolioReq.args.p_limit, 50);
assert.notEqual(portfolioReq.args.p_limit, null);
pass("portfolio request args");

const unlimited = buildPortfolioRequest({
  periodStart: "2026-09-01",
  limit: 9999,
});
assert.equal(unlimited.args.p_limit, 100);
pass("portfolio limit remains bounded");

assert.equal(validateGovernedPeriodsEnvelope({ rows: "nope" }).ok, false);
assert.equal(
  validateGovernedPeriodsEnvelope({
    observed_at: "2026-10-05T00:00:00Z",
    rows: [{ period_start: "2026-09-01", valuation_date: "2026-09-10" }],
    // missing limit / returned_count / has_more
  }).ok,
  false,
);
assert.equal(
  validateGovernedPeriodsEnvelope({
    observed_at: "2026-10-05T00:00:00Z",
    rows: [{ period_start: "2026-09-01", valuation_date: "2026-09-10" }],
    limit: 24,
    returned_count: 0, // fabricated mismatch vs rows.length
    has_more: false,
  }).ok,
  false,
);
const goodPeriods = validateGovernedPeriodsEnvelope({
  observed_at: "2026-10-05T00:00:00Z",
  rows: [
    { period_start: "2026-09-01", valuation_date: "2026-09-10" },
    { period_start: "2026-08-01", valuation_date: null },
  ],
  limit: 24,
  returned_count: 2,
  has_more: false,
  next_before_period_start: null,
});
assert.equal(goodPeriods.ok, true);
assert.equal(goodPeriods.value.rows[0].period_start, "2026-09-01");
pass("governed periods fail-closed + valid envelope");

assert.equal(
  validateProductGapsEnvelope({
    assessment_kind: "PRODUCT_MEMBERSHIP_GAPS",
    observed_at: "2026-10-05T00:00:00Z",
    product_scope: "ACTIVE_PRODUCTS",
    gap_kind: "NO_SKU",
    rows: [],
    // missing statistics / counts
    has_more: false,
  }).ok,
  false,
);
assert.equal(
  validateProductGapsEnvelope({
    assessment_kind: "PRODUCT_MEMBERSHIP_GAPS",
    observed_at: "2026-10-05T00:00:00Z",
    product_scope: "ACTIVE_PRODUCTS",
    gap_kind: "NO_SKU",
    rows: [],
    statistics: {}, // missing count fields -> must not become zeros
    limit: 25,
    matched_count: 0,
    returned_count: 0,
    has_more: false,
  }).ok,
  false,
);
const goodGaps = validateProductGapsEnvelope({
  assessment_kind: "PRODUCT_MEMBERSHIP_GAPS",
  observed_at: "2026-10-05T00:00:00Z",
  product_scope: "ACTIVE_PRODUCTS",
  gap_kind: "NO_SKU",
  rows: [
    {
      product_id: 1,
      product_name: "A",
      product_status: "Active",
      gap_kind: "NO_SKU",
    },
  ],
  statistics: {
    product_count: 10,
    no_sku_count: 1,
    active_without_active_sku_count: 0,
  },
  limit: 25,
  matched_count: 1,
  returned_count: 1,
  has_more: false,
  next_after_product_id: null,
});
assert.equal(goodGaps.ok, true);
assert.equal(goodGaps.value.rows[0].gap_kind, "NO_SKU");
assert.equal(goodGaps.value.statistics.active_without_active_sku_count, 0);
pass("product gaps fail-closed + valid envelope");

const unknownAssessment = {
  context: {
    context_type: "LIVE_AS_OF",
    sku_id: 7,
    product_id: 3,
    period_start: "2026-09-01",
    valuation_date: "2026-09-10",
    refresh_run_id: null,
    context_integrity_status: "LIVE_GOVERNED_PERIOD",
  },
  lifecycle: {
    product_status: "Active",
    sku_is_active: true,
    sku_is_sample: false,
  },
  identity: { product_name: "Demo", pack_size: 100, pack_uom: "g" },
  summary: {
    product_master_foundation_status: "RESOLVED",
    sku_master_foundation_status: "RESOLVED",
    costing_foundation_status: "RESOLVED",
    evidence_quality_status: "UNKNOWN",
    costing_outcome_status: "UNKNOWN",
    overall_severity: "UNKNOWN",
  },
  dependencies: [],
  shared_issues: [],
  downstream_control: null,
};

function validPortfolioPayload(overrides = {}) {
  return {
    context: {
      context_type: "LIVE_AS_OF",
      requested_period_start: "2026-09-01",
      period_start: "2026-09-01",
      valuation_date: "2026-09-10",
      refresh_run_id: null,
      evidence_refresh_run_id: 115,
      context_integrity_status: "LIVE_GOVERNED_PERIOD",
    },
    observed_at: "2026-10-05T00:00:00Z",
    population_scope: "OPERATIONAL",
    filters: {
      overall_severities: null,
      dependency_codes: null,
      owner_modules: null,
      route_codes: null,
      search: null,
    },
    filter_options: {
      overall_severities: ["READY", "REVIEW_REQUIRED", "BLOCKER", "UNKNOWN"],
      dependency_codes: ["MRP_POLICY"],
      owner_modules: ["PRICING_POLICY_MANAGER"],
      route_codes: ["MRP_GOVERNANCE"],
    },
    after_sku_id: null,
    limit: 50,
    statistics: {
      population_sku_count: 611,
      overall_severity_counts: {
        READY: 10,
        REVIEW_REQUIRED: 20,
        BLOCKER: 30,
        UNKNOWN: 551,
      },
      unresolved_dependency_counts: [],
      unresolved_owner_counts: [],
      unresolved_route_counts: [],
      unresolved_shared_issue_counts: [],
      regional_marketing_counts: [],
    },
    matched_count: 611,
    returned_count: 1,
    rows: [unknownAssessment],
    has_more: true,
    next_after_sku_id: 7,
    ...overrides,
  };
}

assert.equal(validatePortfolioEnvelope({ rows: [], statistics: {} }).ok, false);
assert.equal(
  validatePortfolioEnvelope(
    validPortfolioPayload({
      filter_options: undefined,
    }),
  ).ok,
  false,
);
assert.equal(
  validatePortfolioEnvelope(
    validPortfolioPayload({
      statistics: {
        population_sku_count: 611,
        // missing overall_severity_counts
        unresolved_dependency_counts: [],
        unresolved_owner_counts: [],
        unresolved_route_counts: [],
        unresolved_shared_issue_counts: [],
        regional_marketing_counts: [],
      },
    }),
  ).ok,
  false,
);
assert.equal(
  validatePortfolioEnvelope(
    validPortfolioPayload({
      statistics: {
        population_sku_count: 611,
        overall_severity_counts: {
          READY: 10,
          REVIEW_REQUIRED: 20,
          BLOCKER: 30,
          // UNKNOWN missing -> must not default to 0 success
        },
        unresolved_dependency_counts: [],
        unresolved_owner_counts: [],
        unresolved_route_counts: [],
        unresolved_shared_issue_counts: [],
        regional_marketing_counts: [],
      },
    }),
  ).ok,
  false,
);
assert.equal(
  validatePortfolioEnvelope(
    validPortfolioPayload({
      matched_count: undefined,
    }),
  ).ok,
  false,
);
assert.equal(
  validatePortfolioEnvelope(
    validPortfolioPayload({
      filter_options: {
        overall_severities: [],
        dependency_codes: [],
        owner_modules: [],
        route_codes: [],
      },
    }),
  ).ok,
  false,
);

const goodPortfolio = validatePortfolioEnvelope(validPortfolioPayload());
assert.equal(goodPortfolio.ok, true);
assert.equal(goodPortfolio.value.statistics.population_sku_count, 611);
assert.equal(goodPortfolio.value.statistics.overall_severity_counts.UNKNOWN, 551);
assert.deepEqual(goodPortfolio.value.filter_options.overall_severities, [
  "READY",
  "REVIEW_REQUIRED",
  "BLOCKER",
  "UNKNOWN",
]);
assert.equal(assessmentOverallSeverity(unknownAssessment), "UNKNOWN");
pass("portfolio fail-closed + valid envelope + UNKNOWN preserved");

assert.ok(
  !/filter_options\.overall_severities\?\.length\s*\?\s*filterOptions\.overall_severities\s*:\s*READINESS_OVERALL_SEVERITIES/.test(
    readinessSrc,
  ),
);
assert.ok(
  !/severityHost\.innerHTML\s*=\s*READINESS_OVERALL_SEVERITIES\.map/.test(
    readinessSrc,
  ),
);
assert.ok(
  readinessSrc.includes(
    "state.portfolio.filter_options.overall_severities",
  ) ||
    readinessSrc.includes(
      "filter_options?.overall_severities",
    ),
);
pass("severity filter options derive only from server filter_options");

assert.ok(!htmlSrc.includes('id="readinessSearch"'));
assert.ok(!readinessSrc.includes("readinessSearch"));
assert.ok(!readinessSrc.includes("getElementById(\"readinessSearch\")"));
assert.ok(shellSrc.includes("portfolioReadinessCtrl.syncSearchFromShell"));
assert.ok(htmlSrc.includes('id="search"'));
pass("single shell search authority; no readiness-local search input");

const calls = [];
let currentLens = PORTFOLIO_READINESS_LENS_ID;
const rpcImpl = async (name, args) => {
  calls.push({ name, args });
  if (name === READINESS_RPC.governedPeriods) {
    return {
      data: {
        observed_at: "2026-10-05T00:00:00Z",
        rows: [{ period_start: "2026-09-01", valuation_date: "2026-09-10" }],
        limit: 24,
        returned_count: 1,
        has_more: false,
        next_before_period_start: null,
      },
      error: null,
    };
  }
  if (name === READINESS_RPC.productGaps) {
    return {
      data: {
        assessment_kind: "PRODUCT_MEMBERSHIP_GAPS",
        observed_at: "2026-10-05T00:00:00Z",
        product_scope: args.p_product_scope,
        gap_kind: args.p_gap_kind,
        rows: [],
        statistics: {
          product_count: 0,
          no_sku_count: 0,
          active_without_active_sku_count: 0,
        },
        limit: 25,
        matched_count: 0,
        returned_count: 0,
        has_more: false,
        next_after_product_id: null,
      },
      error: null,
    };
  }
  if (name === READINESS_RPC.portfolio) {
    const matched = args.p_search ? 0 : 611;
    const rows = args.p_search ? [] : [unknownAssessment];
    return {
      data: validPortfolioPayload({
        population_scope: args.p_population_scope,
        after_sku_id: args.p_after_sku_id,
        limit: args.p_limit,
        matched_count: matched,
        returned_count: rows.length,
        rows,
        has_more: !args.p_search,
        next_after_sku_id: args.p_search ? null : 7,
        statistics: {
          population_sku_count: 611,
          overall_severity_counts: {
            READY: 0,
            REVIEW_REQUIRED: 0,
            BLOCKER: 0,
            UNKNOWN: 611,
          },
          unresolved_dependency_counts: [],
          unresolved_owner_counts: [],
          unresolved_route_counts: [],
          unresolved_shared_issue_counts: [],
          regional_marketing_counts: [],
        },
      }),
      error: null,
    };
  }
  return { data: null, error: new Error(`unexpected rpc ${name}`) };
};

const ctrl = createPortfolioReadinessController({
  costingRpc: rpcImpl,
  getCurrentLens: () => currentLens,
  canView: () => true,
  getSearchValue: () => "",
});

const loaded = await ctrl.load();
assert.equal(loaded.ok, true);
assert.equal(ctrl.getPeriodStart(), "2026-09-01");
assert.equal(ctrl.getPopulationCount(), 611);
assert.equal(ctrl.getMatchedCount(), 611);
assert.equal(ctrl.getReturnedCount(), 1);
assert.ok(calls.some((c) => c.name === READINESS_RPC.governedPeriods));
assert.ok(calls.some((c) => c.name === READINESS_RPC.portfolio));
assert.ok(calls.some((c) => c.name === READINESS_RPC.productGaps));
const rpcNames = [...new Set(calls.map((c) => c.name))];
assert.deepEqual(rpcNames.sort(), [
  "rpc_get_product_sku_readiness_portfolio",
  "rpc_get_readiness_governed_periods",
  "rpc_get_readiness_product_gaps",
].sort());
pass("controller load uses only the three approved read RPCs");

ctrl.invalidatePendingRequests();
currentLens = "dashboard";
const stale = await ctrl.load();
assert.equal(stale?.stale === true || stale?.ok === false, true);
currentLens = PORTFOLIO_READINESS_LENS_ID;
pass("stale/inactive lens suppression");

const page1Calls = calls.length;
await ctrl.goNextPage();
const nextCall = calls.slice(page1Calls).find((c) => c.name === READINESS_RPC.portfolio);
assert.equal(nextCall?.args?.p_after_sku_id, 7);
pass("keyset next uses next_after_sku_id");

ctrl.__test.resetFilters();
ctrl.__test.resetKeyset();
const searchCalls = calls.length;
await ctrl.syncSearchFromShell("none");
const searchCall = calls
  .slice(searchCalls)
  .find((c) => c.name === READINESS_RPC.portfolio);
assert.equal(searchCall?.args?.p_search, "none");
assert.equal(searchCall?.args?.p_after_sku_id, null);
assert.equal(ctrl.getMatchedCount(), 0);
assert.equal(ctrl.isUnavailable(), false);
pass("shell search resets keyset; empty matched is not unavailable");

const failingCtrl = createPortfolioReadinessController({
  costingRpc: async (name) => {
    if (name === READINESS_RPC.governedPeriods) {
      return { data: null, error: Object.assign(new Error("boom"), { status: 500 }) };
    }
    return { data: null, error: new Error("should not call") };
  },
  getCurrentLens: () => PORTFOLIO_READINESS_LENS_ID,
  canView: () => true,
});
const failed = await failingCtrl.load();
assert.equal(failed.ok, false);
assert.equal(failingCtrl.isUnavailable(), true);
assert.match(String(failingCtrl.getUnavailableMessage()), /Unavailable/i);
pass("period-load failure is Unavailable");

const malformedPortfolioCtrl = createPortfolioReadinessController({
  costingRpc: async (name) => {
    if (name === READINESS_RPC.governedPeriods) {
      return {
        data: {
          observed_at: "2026-10-05T00:00:00Z",
          rows: [{ period_start: "2026-09-01", valuation_date: "2026-09-10" }],
          limit: 24,
          returned_count: 1,
          has_more: false,
        },
        error: null,
      };
    }
    if (name === READINESS_RPC.productGaps) {
      return {
        data: {
          assessment_kind: "PRODUCT_MEMBERSHIP_GAPS",
          observed_at: "2026-10-05T00:00:00Z",
          product_scope: "ACTIVE_PRODUCTS",
          gap_kind: "NO_SKU",
          rows: [],
          statistics: {
            product_count: 0,
            no_sku_count: 0,
            active_without_active_sku_count: 0,
          },
          limit: 25,
          matched_count: 0,
          returned_count: 0,
          has_more: false,
        },
        error: null,
      };
    }
    if (name === READINESS_RPC.portfolio) {
      return {
        data: validPortfolioPayload({
          matched_count: undefined,
          statistics: {
            population_sku_count: 611,
            overall_severity_counts: {
              READY: 0,
              REVIEW_REQUIRED: 0,
              BLOCKER: 0,
              // UNKNOWN omitted on purpose
            },
            unresolved_dependency_counts: [],
            unresolved_owner_counts: [],
            unresolved_route_counts: [],
            unresolved_shared_issue_counts: [],
            regional_marketing_counts: [],
          },
        }),
        error: null,
      };
    }
    return { data: null, error: new Error(`unexpected ${name}`) };
  },
  getCurrentLens: () => PORTFOLIO_READINESS_LENS_ID,
  canView: () => true,
});
const malformed = await malformedPortfolioCtrl.load();
assert.equal(malformed.ok, false);
assert.equal(malformedPortfolioCtrl.isUnavailable(), true);
assert.equal(malformedPortfolioCtrl.getMatchedCount(), 0);
assert.match(String(malformedPortfolioCtrl.getUnavailableMessage()), /Unavailable/i);
pass("malformed portfolio counts/filter fields fail closed to Unavailable");

assert.ok(!/overall_severity\s*===\s*["']READY["']/.test(readinessSrc));
assert.equal(
  assessmentOverallSeverity({ summary: { overall_severity: "UNKNOWN" } }),
  "UNKNOWN",
);
pass("UNKNOWN is not coerced to READY");

const forbidden = [
  "rpc_accept",
  "rpc_upsert",
  "rpc_insert",
  "rpc_update",
  "rpc_delete",
  "rpc_run_",
  "rpc_refresh",
  "severityPrecedence",
  "deriveOverallSeverity",
  "computePortfolioTotal",
  "reduce((sum",
];
for (const token of forbidden) {
  assert.ok(!readinessSrc.includes(token), `forbidden token present: ${token}`);
}
assert.ok(!/population_sku_count\s*=\s*rows\.length/.test(readinessSrc));
assert.ok(!/matched_count\s*=\s*rows\.length/.test(readinessSrc));
assert.ok(!/Number\([^)]*matched_count[^)]*\)\s*\|\|\s*0/.test(
  readinessSrc.split("export function validate")[1]?.split("export function assessment")[0] || "",
));
pass("no writer invocation / no client-derived totals / no silent zero defaults in validators");

const registry = readFileSync(
  join(root, "public/shared/js/costing-suite-registry.js"),
  "utf8",
);
const routeConfig = readFileSync(
  join(root, "public/shared/js/costing-route-config.js"),
  "utf8",
);
const sw = readFileSync(join(root, "public/sw.js"), "utf8");

assert.ok(registry.includes('"portfolio-readiness"') || registry.includes("'portfolio-readiness'"));
assert.ok(registry.includes("Readiness"));
assert.ok(routeConfig.includes("portfolio-readiness"));
assert.ok(routeConfig.includes('defaultLens: "dashboard"'));
assert.ok(shellSrc.includes("costing-suite-readiness.js"));
assert.ok(shellSrc.includes("isPortfolioReadinessLens"));
assert.ok(htmlSrc.includes("readinessLensHost"));
assert.ok(/hub-cache-v335/.test(sw));
assert.ok(!/hub-cache-v334/.test(sw));
assert.ok(/costing-suite-readiness/.test(sw));
pass("registry/route/shell/html/sw integration markers");

assert.ok(!shellSrc.includes("rpc_accept_marketing"));
assert.ok(!/js\/products\.js/.test(shellSrc));
pass("shell does not add Manage Products or marketing writer paths");

// ── Track B structural assertions ──────────────────────────────────────────
assert.ok(htmlSrc.includes('id="readinessFilterBtn"'));
assert.ok(htmlSrc.includes('id="readinessFilterDrawer"'));
assert.ok(htmlSrc.includes('id="readinessFilterBadge"'));
assert.ok(htmlSrc.includes('id="readinessAppliedFilters"'));
assert.ok(htmlSrc.includes('id="readinessSummary"'));
assert.ok(htmlSrc.includes('id="readinessGapDetails"'));
assert.ok(htmlSrc.includes('id="genericTableCard"'));
assert.ok(htmlSrc.includes('cp-readiness-ops'));
assert.ok(htmlSrc.includes('cp-readiness-register-region'));
assert.ok(!/id="readinessDependencyFilter"/.test(htmlSrc));
assert.ok(!/id="readinessOwnerFilter"/.test(htmlSrc));
assert.ok(!/id="readinessRouteFilter"/.test(htmlSrc));
assert.ok(!/multiple\s+size\s*=\s*["']?3["']?/.test(htmlSrc));
assert.ok(!htmlSrc.includes('id="readinessSearch"'));
pass("Track B filter drawer / chip hosts present; raw multi-selects absent");

assert.ok(shellSrc.includes("function syncReadinessShellChrome"));
assert.ok(/syncReadinessShellChrome\s*\(/.test(shellSrc));
assert.ok(/cp-readiness-active/.test(shellSrc));
assert.ok(/genericTableCard/.test(shellSrc));
assert.ok(/peqFilterWrapper/.test(shellSrc.split("function syncReadinessShellChrome")[1] || ""));
assert.ok(/costPeriodValuationStrip/.test(shellSrc.split("function syncReadinessShellChrome")[1] || ""));
assert.ok(/closeFilterDrawer\s*\(/.test(shellSrc.split("function syncReadinessShellChrome")[1] || ""));
assert.ok(/setVisible\(\s*kpiStripWrap,\s*false/.test(shellSrc));
assert.ok(/setVisible\(\s*lastRefreshed,\s*false/.test(shellSrc));
assert.ok(/setVisible\(\s*peqFilterWrapper,\s*false/.test(shellSrc));
assert.ok(/setVisible\(\s*peqFilterWrapper,\s*true/.test(shellSrc));
assert.ok(/applyKpiStripVisibility\s*\(/.test(shellSrc));
assert.ok(/syncPeriodControlState\s*\(/.test(shellSrc));
assert.ok(/reloadCostPeriodValuationIfNeeded\s*\(/.test(shellSrc));
assert.ok(
  /CURRENT_LENS\s*=\s*lensId[\s\S]{0,400}?syncReadinessShellChrome\s*\(/.test(
    shellSrc,
  ),
);
assert.ok(/Search product, SKU or ID/.test(shellSrc));
pass("Track B shell chrome hide/restore synchronizer present");

assert.ok(/READINESS_GAP_PREVIEW_LIMIT\s*=\s*3/.test(readinessSrc));
assert.ok(/Count-first collapsed exception/.test(readinessSrc));
assert.ok(
  !/cp-readiness-gap-preview/.test(
    readinessSrc.split("function renderGapCard")[1]?.split("function renderGapDetailsPanel")[0] ||
      "",
  ),
);
assert.ok(!/rows\.slice\(\s*0\s*,\s*READINESS_GAP_PREVIEW_LIMIT\s*\)/.test(readinessSrc));
assert.ok(!/after_product_id/.test(
  readinessSrc.split("async function loadProductGaps")[1]?.split("async function load(")[0] || "",
) || /limit:\s*READINESS_GAP_LIMIT/.test(
  readinessSrc.split("async function loadProductGaps")[1]?.split("async function load(")[0] || "",
));
assert.ok(!/while\s*\([^)]*has_more/.test(
  readinessSrc.split("async function loadProductGaps")[1]?.split("async function load(")[0] || "",
));
assert.ok(!/goNextGap|loadNextGap|after_product_id\s*=/.test(readinessSrc));
pass("Track B product-gap preview bounded; no auto gap page traversal");

assert.ok(/No readiness rows match the current filters/.test(readinessSrc));
assert.ok(/Readiness unavailable/.test(readinessSrc));
assert.ok(/Loading readiness|Loading…/.test(readinessSrc));
assert.ok(/openDetails\(assessment\)/.test(readinessSrc));
assert.ok(/cp-readiness-detail-disclose/.test(readinessSrc));
assert.ok(/getDrawerConfig/.test(readinessSrc));
assert.ok(/renderDrawerTab/.test(readinessSrc));
assert.ok(!/Action<\/th>/.test(htmlSrc.split("readinessLensHost")[1]?.split("genericTableCard")[0] || ""));
pass("Track B loading/unavailable/empty states and details path preserved");

assert.ok(!readinessSrc.includes("readinessSearch"));
assert.ok(/getSearchValue/.test(readinessSrc));
pass("Track B preserves shell search as sole search authority");

// Pager attached to register region (not a pre-register peer block)
const hostChunk =
  htmlSrc.split('id="readinessLensHost"')[1]?.split('id="genericTableCard"')[0] || "";
assert.ok(/cp-readiness-register-region[\s\S]*cp-readiness-pagebar/.test(hostChunk));
assert.ok(!/cp-readiness-pagebar[\s\S]*cp-readiness-register-region/.test(hostChunk));
assert.ok(/clear-link/.test(hostChunk));
pass("Track B pager attached to register region; Clear is link-style");

assert.ok(!/severity_precedence|clientDerivedSeverity|deriveOverallSeverity/.test(readinessSrc));
assert.ok(cssSrc.includes("cp-readiness-active #peqFilterWrapper"));
assert.ok(cssSrc.includes("costPeriodValuationStrip"));
pass("Track B no client severity authority; CSS chrome hide rules present");

console.log("\nAll WP04-G5 readiness client contract smoke checks passed.");
