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
const controlCenterSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-control-center.js"),
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
await ctrl.appendNextPortfolioPage();
const nextCall = calls.slice(page1Calls).find((c) => c.name === READINESS_RPC.portfolio);
assert.equal(nextCall?.args?.p_after_sku_id, 7);
pass("keyset append uses next_after_sku_id");

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
assert.ok(/hub-cache-v342/.test(sw));
assert.ok(!/hub-cache-v341/.test(sw));
assert.ok(/costing-suite-readiness/.test(sw));
pass("registry/route/shell/html/sw integration markers");

assert.ok(!shellSrc.includes("rpc_accept_marketing"));
assert.ok(!/js\/products\.js/.test(shellSrc));
pass("shell does not add Manage Products or marketing writer paths");

// ── Track B structural assertions ──────────────────────────────────────────
assert.ok(htmlSrc.includes('id="readinessPeqFilterBody"'));
assert.ok(htmlSrc.includes('id="readinessSeverityFilters"'));
assert.ok(htmlSrc.includes('id="readinessDependencyFilters"'));
assert.ok(htmlSrc.includes('id="readinessOwnerFilters"'));
assert.ok(htmlSrc.includes('id="readinessRouteFilters"'));
assert.ok(htmlSrc.includes('id="readinessFilterApply"'));
assert.ok(htmlSrc.includes('id="readinessAppliedFilters"'));
assert.ok(!htmlSrc.includes('id="readinessSummary"'));
assert.ok(!htmlSrc.includes('id="readinessGaps"'));
assert.ok(!htmlSrc.includes('id="readinessGapDetails"'));
assert.ok(htmlSrc.includes('id="readinessMembershipExceptionsBtn"'));
assert.ok(htmlSrc.includes('id="readinessMembershipModal"'));
assert.ok(htmlSrc.includes('id="readinessAppendStatus"'));
assert.ok(htmlSrc.includes('id="genericTableCard"'));
assert.ok(htmlSrc.includes('id="peqFilterWrapper"'));
assert.ok(!htmlSrc.includes('id="readinessPeriodSelect"'));
assert.ok(!htmlSrc.includes("Membership exceptions (not filters)"));
assert.ok(!htmlSrc.includes('visually-hidden">Population scope'));
assert.ok(htmlSrc.includes('id="readinessScrollSentinel"'));
assert.ok(htmlSrc.includes('id="cccTableScrollSentinel"'));
assert.ok(htmlSrc.includes('cp-readiness-register-region'));
assert.ok(!htmlSrc.includes('cp-readiness-pagebar'));
assert.ok(!htmlSrc.includes('cp-readiness-controls'));
assert.ok(!htmlSrc.includes('id="readinessFilterBtn"'));
assert.ok(!htmlSrc.includes('id="readinessFilterDrawer"'));
assert.ok(!htmlSrc.includes('cp-readiness-ops'));
assert.ok(!/id="readinessDependencyFilter"/.test(htmlSrc));
assert.ok(!/id="readinessOwnerFilter"/.test(htmlSrc));
assert.ok(!/id="readinessRouteFilter"/.test(htmlSrc));
assert.ok(!/multiple\s+size\s*=\s*["']?3["']?/.test(htmlSrc));
assert.ok(!htmlSrc.includes('id="readinessSearch"'));
pass("Track B global filter hosts present; lens-local filter button absent");

assert.ok(shellSrc.includes("function syncReadinessShellChrome"));
assert.ok(shellSrc.includes("function syncPortfolioReadinessFilterChrome"));
assert.ok(/syncReadinessShellChrome\s*\(/.test(shellSrc));
assert.ok(/cp-readiness-active/.test(shellSrc));
assert.ok(/genericTableCard/.test(shellSrc));
assert.ok(/applyKpiStripVisibility\s*\(/.test(shellSrc.split("function syncReadinessShellChrome")[1]?.split("function syncPortfolioReadinessFilterChrome")[0] || ""));
assert.ok(!/setVisible\(\s*kpiStripWrap,\s*false/.test(shellSrc.split("function syncReadinessShellChrome")[1]?.split("function syncPortfolioReadinessFilterChrome")[0] || ""));
assert.ok(/setVisible\(\s*peqFilterWrapper,\s*true/.test(shellSrc.split("function syncReadinessShellChrome")[1] || ""));
assert.ok(!/setVisible\(\s*peqFilterWrapper,\s*false/.test(shellSrc.split("function syncReadinessShellChrome")[1]?.split("function syncPortfolioReadinessFilterChrome")[0] || ""));
assert.ok(/paintReadinessValuationFromContext/.test(shellSrc));
assert.ok(/function formatCpvDisplayDate/.test(shellSrc));
assert.ok(/formatCpvDisplayDate\(String\(valuationRaw\)/.test(shellSrc));
assert.ok(!/formatDate\(String\(valuationRaw\)/.test(shellSrc));
assert.match(
  shellSrc.match(/function formatCpvDisplayDate[\s\S]*?\n\}/)?.[0] || "",
  /"Sep"/,
);
assert.ok(/renderReadinessGovernedPeriodOptions/.test(shellSrc));
assert.ok(/formatPeriodMonth\(row\.period_start\)/.test(shellSrc));
assert.ok(/maybeFillReadinessViewport/.test(shellSrc));
assert.ok(/syncCccRegisterPaginationChrome/.test(shellSrc));
assert.ok(/setupReadinessScrollAppend/.test(shellSrc));
assert.ok(/setupCccProgressiveScroll/.test(shellSrc));
assert.ok(/IntersectionObserver/.test(shellSrc));
assert.ok(/syncPeriodControlState\s*\(/.test(shellSrc));
assert.ok(/reloadCostPeriodValuationIfNeeded\s*\(/.test(shellSrc));
assert.ok(/activeFilterCount/.test(shellSrc));
assert.ok(/applyPendingFilters/.test(shellSrc));
assert.ok(/resetGlobalFilterUi/.test(shellSrc));
assert.ok(
  /CURRENT_LENS\s*=\s*lensId[\s\S]{0,400}?syncReadinessShellChrome\s*\(/.test(
    shellSrc,
  ),
);
assert.ok(/Search product, SKU or ID/.test(shellSrc));
pass("Track B shell chrome keeps KPI + global filter under Readiness");

assert.ok(/renderMembershipGapSection/.test(readinessSrc));
assert.ok(/Membership exceptions \(\$\{noSku\}, \$\{activeGap\}\)/.test(readinessSrc));
assert.ok(/membershipExceptionsAccessibleLabel/.test(readinessSrc));
assert.ok(!/Showing first \$\{READINESS_GAP_LIMIT\}/.test(readinessSrc));
assert.ok(!/<th scope="col">Gap<\/th>/.test(readinessSrc));
assert.ok(/dedupeGapRows/.test(readinessSrc));
assert.ok(/appendNextMembershipGapPage/.test(readinessSrc));
assert.ok(/data-membership-gap-sentinel/.test(readinessSrc));
assert.ok(/afterProductId: append \? stream\.nextAfterProductId : null/.test(readinessSrc));
assert.ok(!/READINESS_GAP_PREVIEW_LIMIT/.test(readinessSrc));
assert.ok(!/cp-readiness-summary-strip/.test(readinessSrc));
assert.ok(!/LIVE_GOVERNED_PERIOD/.test(readinessSrc.split("function render")[0] || readinessSrc));
const membershipGapChunk =
  readinessSrc.split("async function fetchMembershipGapPage")[1]?.split(
    "async function loadProductGaps",
  )[0] || "";
assert.ok(!/while\s*\([^)]*has_more/.test(membershipGapChunk));
assert.ok(!/goNextGap|loadNextGap/.test(readinessSrc));
pass("Track B membership modal keyset append; Product|Status columns only");

assert.ok(/No readiness rows match the current filters/.test(readinessSrc));
assert.ok(/Readiness unavailable/.test(readinessSrc));
assert.ok(/Loading readiness|Loading…/.test(readinessSrc));
assert.ok(/openDetails\(assessment\)/.test(readinessSrc));
assert.ok(/cp-readiness-detail-disclose/.test(readinessSrc));
assert.ok(/getDrawerConfig/.test(readinessSrc));
assert.ok(/renderDrawerTab/.test(readinessSrc));
assert.ok(!/Action<\/th>/.test(htmlSrc.split("readinessLensHost")[1]?.split("genericTableCard")[0] || ""));
assert.ok(!/cp-readiness-summary-metrics/.test(readinessSrc));
assert.ok(/appendNextPortfolioPage/.test(readinessSrc));
assert.ok(/maybeFillReadinessViewport/.test(readinessSrc));
assert.ok(/append:\s*true/.test(readinessSrc));
assert.ok(/Loading more…/.test(readinessSrc));
assert.ok(/End of results/.test(readinessSrc));
assert.ok(/dedupeReadinessRows/.test(readinessSrc));
assert.ok(/applyShellPeriodStart/.test(readinessSrc));
assert.ok(!/readinessPeriodSelect/.test(readinessSrc));
pass("Track B loading/unavailable/empty states and details path preserved");

assert.ok(!readinessSrc.includes("readinessSearch"));
assert.ok(/getSearchValue/.test(readinessSrc));
pass("Track B preserves shell search as sole search authority");

const hostChunk =
  htmlSrc.split('id="readinessLensHost"')[1]?.split('id="genericTableCard"')[0] || "";
assert.ok(/table-card cp-readiness-register-region cp-ccc-table-work-surface/.test(hostChunk));
assert.ok(
  /cp-readiness-register-wrap[\s\S]*readinessScrollSentinel/.test(hostChunk),
);
assert.ok(!/cp-readiness-pagebar/.test(hostChunk));
assert.ok(!/id="readinessFilterBtn"/.test(hostChunk));
pass("Track B readiness register uses in-wrap scroll sentinel; no pagebar");

assert.ok(!/severity_precedence|clientDerivedSeverity|deriveOverallSeverity/.test(readinessSrc));
assert.ok(!cssSrc.includes("cp-readiness-active #peqFilterWrapper"));
assert.ok(
  /@media \(max-width: 520px\)[\s\S]*body\.sasv-costing-control-center #kpiStripWrap[\s\S]*display:\s*none/.test(
    cssSrc,
  ),
);
assert.ok(
  /@media \(max-width: 520px\)[\s\S]*#homeBtn \.home-label[\s\S]*clip:\s*rect\(0,\s*0,\s*0,\s*0\)/.test(
    cssSrc,
  ),
);
assert.ok(
  /@media \(max-width: 520px\)[\s\S]*#lastRefreshed \.sc-snapshot-label/.test(
    cssSrc,
  ),
);
assert.ok(
  /@media \(max-width: 520px\)[\s\S]*#readinessMembershipModal[\s\S]*100dvh/.test(
    cssSrc,
  ),
);
assert.ok(
  /@media \(max-width: 520px\)[\s\S]*#detailsModal[\s\S]*100dvh/.test(
    cssSrc,
  ),
);
assert.ok(!/#mainTable tbody tr:nth-child\(even\) td/.test(cssSrc));
assert.ok(
  !/\.cp-ccc-register-table[\s\S]*tbody[\s\S]*tr:nth-child\(even\)/.test(
    cssSrc,
  ),
);
assert.ok(
  /#mainTable thead th,[\s\S]*\.cp-ccc-register-table thead th[\s\S]*position:\s*sticky/.test(
    cssSrc,
  ),
);
assert.ok(
  /cp-readiness-membership-section[\s\S]*flex-direction:\s*column/.test(cssSrc),
);
assert.ok(
  /\.cp-readiness-membership-section-table[\s\S]*overflow-y:\s*auto/.test(
    cssSrc,
  ),
);
assert.ok(!readinessSrc.includes("membershipProgressNote"));
assert.ok(!/ of \$\{text\(matched\)\} loaded/.test(readinessSrc));
assert.ok(readinessSrc.includes(".cp-readiness-membership-section-table"));
assert.ok(/root:\s*scrollRoot/.test(readinessSrc));
assert.ok(readinessSrc.includes("data-membership-gap-retry"));
assert.ok(!cssSrc.includes("cp-readiness-active #costPeriodValuationStrip"));
assert.ok(cssSrc.includes("cp-ccc-table-work-surface"));
assert.ok(cssSrc.includes("cp-ccc-table-scroll"));
assert.ok(!/body\.sasv-costing-control-center \.cp-readiness-table th \{/.test(
  cssSrc,
));
assert.ok(cssSrc.includes("cp-readiness-active .main"));
assert.ok(
  !/cp-readiness-register-wrap\.cp-ccc-table-scroll[\s\S]{0,200}720px/.test(
    cssSrc,
  ),
);
assert.ok(/rebuildPeqFilterOptionsFromRows/.test(controlCenterSrc));
pass("Track B no client severity authority; unified CCC table work surface");

// ── Track B visual-parity polish (package §10) ─────────────────────────────
const registerRegionChunk =
  htmlSrc
    .split('class="table-card cp-readiness-register-region cp-ccc-table-work-surface"')[1]
    ?.split("</div>")[0] || "";
assert.ok(registerRegionChunk.includes('id="readinessMembershipExceptionsBtn"'));
assert.ok(registerRegionChunk.includes("cp-readiness-register-card-toolbar"));
assert.ok(!htmlSrc.includes("cp-readiness-register-toolbar"));
assert.ok(!htmlSrc.includes('class="icon-btn cp-readiness-membership-btn"'));
assert.ok(
  /cp-readiness-register-region[\s\S]*readinessMembershipExceptionsBtn[\s\S]*cp-readiness-register-wrap/.test(
    hostChunk,
  ),
);
pass("membership button lives inside register card toolbar");

assert.ok(cssSrc.includes("#lensSuiteLabel"));
assert.match(
  cssSrc.match(
    /body\.sasv-costing-control-center #lensSuiteLabel[\s\S]*?\}/,
  )?.[0] || "",
  /display:\s*none/,
);
pass("CCC lens breadcrumb hidden via CSS only");

assert.ok(cssSrc.includes(".cp-readiness-membership-btn:hover"));
assert.ok(cssSrc.includes(".cp-readiness-membership-btn:focus-visible"));
assert.ok(cssSrc.includes("cursor: pointer"));
pass("membership button actionable secondary styling");

assert.ok(readinessSrc.includes("cp-ccc-register-table costing-pricing-table cp-readiness-gap-table"));
assert.ok(readinessSrc.includes("<th scope=\"col\">Product</th>"));
assert.ok(!readinessSrc.includes("cp-readiness-gap-detail-list"));
assert.ok(!/<ul class="cp-readiness-gap/.test(readinessSrc));
pass("membership modal uses compact read-only tables");

assert.ok(
  /#mainTable thead th,\s*\nbody\.sasv-costing-control-center \.cp-ccc-register-table thead th/.test(
    cssSrc,
  ),
);
assert.ok(
  /#mainTable tbody td,\s*\nbody\.sasv-costing-control-center \.cp-ccc-register-table tbody td/.test(
    cssSrc,
  ),
);
assert.ok(!/body\.sasv-costing-control-center \.cp-readiness-table td \{/.test(cssSrc));
assert.ok(htmlSrc.includes("cp-ccc-register-table costing-pricing-table"));
pass("readiness register shares #mainTable table contract");

assert.ok(!htmlSrc.includes("margin-top: 6px"));
assert.ok(!htmlSrc.match(/class="main" style="margin-top: 8px"/));
assert.ok(htmlSrc.includes('class="main ccc-chrome-main"'));
assert.ok(cssSrc.includes(".ccc-chrome-main"));
assert.ok(cssSrc.includes(".ccc-chrome-block"));
pass("CCC vertical spacing tightened; no inline 6/8px chrome margins");

assert.ok(/readinessScrollSentinel/.test(htmlSrc));
assert.ok(/maybeFillReadinessViewport/.test(shellSrc));
assert.ok(/appendNextPortfolioPage/.test(readinessSrc));
assert.ok(/dedupeReadinessRows/.test(readinessSrc));
pass("readiness scroll sentinel and keyset runtime preserved");

assert.ok(registry.includes("portfolio-readiness"));
assert.ok(routeConfig.includes("portfolio-readiness"));
assert.ok(/hub-cache-v342/.test(sw));
assert.ok(!/hub-cache-v341/.test(sw));
pass("SW v342 and registry/route unchanged");

// ── Membership scroll-preservation (append rerender) ───────────────────────
assert.ok(/function captureMembershipSectionScrollTops/.test(readinessSrc));
assert.ok(/function restoreMembershipSectionScrollTops/.test(readinessSrc));
assert.ok(
  /data-membership-gap-stream="\$\{escapeHtml\(\s*streamKey/.test(readinessSrc),
);
assert.ok(
  /cp-readiness-membership-section-table" data-membership-gap-stream=/.test(
    readinessSrc,
  ),
);
const renderMembershipBodyFn =
  readinessSrc.split("function renderMembershipModalBody")[1]?.split(
    "function openMembershipModal",
  )[0] || "";
assert.ok(/captureMembershipSectionScrollTops\s*\(/.test(renderMembershipBodyFn));
assert.ok(/restoreMembershipSectionScrollTops\s*\(/.test(renderMembershipBodyFn));
assert.ok(/restoreScroll/.test(renderMembershipBodyFn));
assert.ok(
  /restoreMembershipSectionScrollTops[\s\S]*setupMembershipModalScroll\s*\(/.test(
    renderMembershipBodyFn,
  ),
);
assert.ok(!/localStorage|sessionStorage/.test(renderMembershipBodyFn));
const openMembershipFn =
  readinessSrc.split("function openMembershipModal")[1]?.split(
    "function closeMembershipModal",
  )[0] || "";
assert.ok(
  /renderMembershipModalBody\(\s*\{\s*restoreScroll:\s*false\s*\}\s*\)/.test(
    openMembershipFn,
  ),
);
const closeMembershipFn =
  readinessSrc.split("function closeMembershipModal")[1]?.split(
    "function membershipExceptionsAccessibleLabel",
  )[0] || "";
assert.ok(/teardownMembershipModalScroll\s*\(/.test(closeMembershipFn));
assert.ok(/membershipModalBody\.innerHTML\s*=\s*""/.test(closeMembershipFn));
assert.ok(!/restoreMembershipSectionScrollTops/.test(closeMembershipFn));
const fetchGapFinally =
  readinessSrc.split("async function fetchMembershipGapPage")[1]?.split(
    "async function loadProductGaps",
  )[0] || "";
assert.ok(
  /renderMembershipModalBody\(\s*\{\s*restoreScroll:\s*append\s*\}\s*\)/.test(
    fetchGapFinally,
  ),
);
assert.ok(
  !/renderMembershipModalBody\s*\([^)]*\);\s*setupMembershipModalScroll\s*\(/.test(
    fetchGapFinally,
  ),
);
const loadGapsFinally =
  readinessSrc.split("async function loadProductGaps")[1]?.split(
    "async function appendNextMembershipGapPage",
  )[0] || "";
assert.ok(
  /renderMembershipModalBody\(\s*\{\s*restoreScroll:\s*false\s*\}\s*\)/.test(
    loadGapsFinally,
  ),
);
assert.ok(
  !/renderMembershipModalBody\s*\([^)]*\);\s*setupMembershipModalScroll\s*\(/.test(
    loadGapsFinally,
  ),
);
assert.ok(/root:\s*scrollRoot/.test(readinessSrc));
assert.ok(/data-membership-gap-stream/.test(readinessSrc));
assert.ok(/p_after_product_id/.test(readinessSrc));
assert.ok(/next_after_product_id/.test(readinessSrc));
assert.ok(/appendNextPortfolioPage/.test(readinessSrc));
assert.ok(/maybeFillReadinessViewport/.test(readinessSrc));
assert.ok(/dedupeReadinessRows/.test(readinessSrc));
pass("Membership section scroll preserved per stream; single observer arm after restore");

console.log("\nAll WP04-G5 readiness client contract smoke checks passed.");
