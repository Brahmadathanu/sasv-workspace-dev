/**
 * WP04-G5 — Portfolio Readiness client contract smoke (mocked).
 * Proves request generation, envelope validation, stale suppression,
 * keyset reset rules, UNKNOWN vs unavailable, and read-only boundaries.
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

const badPeriods = validateGovernedPeriodsEnvelope({ rows: "nope" });
assert.equal(badPeriods.ok, false);
const goodPeriods = validateGovernedPeriodsEnvelope({
  observed_at: "2026-10-05T00:00:00Z",
  rows: [
    { period_start: "2026-09-01", valuation_date: "2026-09-10" },
    { period_start: "2026-08-01", valuation_date: null },
  ],
  returned_count: 2,
  has_more: false,
});
assert.equal(goodPeriods.ok, true);
assert.equal(goodPeriods.value.rows[0].period_start, "2026-09-01");
pass("governed periods envelope validation");

const goodGaps = validateProductGapsEnvelope({
  assessment_kind: "PRODUCT_MEMBERSHIP_GAPS",
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
  matched_count: 1,
  returned_count: 1,
  has_more: false,
});
assert.equal(goodGaps.ok, true);
assert.equal(goodGaps.value.rows[0].gap_kind, "NO_SKU");
pass("product gaps envelope validation");

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

const goodPortfolio = validatePortfolioEnvelope({
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
  filters: {},
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
});
assert.equal(goodPortfolio.ok, true);
assert.equal(goodPortfolio.value.statistics.population_sku_count, 611);
assert.equal(assessmentOverallSeverity(unknownAssessment), "UNKNOWN");
pass("portfolio envelope + UNKNOWN severity preserved");

assert.equal(
  validatePortfolioEnvelope({ rows: [], statistics: {} }).ok,
  false,
);
pass("portfolio rejects missing context");

const calls = [];
let currentLens = PORTFOLIO_READINESS_LENS_ID;
const rpcImpl = async (name, args) => {
  calls.push({ name, args });
  if (name === READINESS_RPC.governedPeriods) {
    return {
      data: {
        observed_at: "2026-10-05T00:00:00Z",
        rows: [{ period_start: "2026-09-01", valuation_date: "2026-09-10" }],
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
        rows: [],
        statistics: {
          product_count: 0,
          no_sku_count: 0,
          active_without_active_sku_count: 0,
        },
        matched_count: 0,
        returned_count: 0,
        has_more: false,
      },
      error: null,
    };
  }
  if (name === READINESS_RPC.portfolio) {
    return {
      data: {
        context: {
          context_type: "LIVE_AS_OF",
          requested_period_start: args.p_period_start,
          period_start: args.p_period_start,
          valuation_date: "2026-09-10",
          refresh_run_id: null,
          evidence_refresh_run_id: 115,
          context_integrity_status: "LIVE_GOVERNED_PERIOD",
        },
        observed_at: "2026-10-05T00:00:00Z",
        population_scope: args.p_population_scope,
        filters: {},
        filter_options: {
          overall_severities: ["READY", "REVIEW_REQUIRED", "BLOCKER", "UNKNOWN"],
          dependency_codes: [],
          owner_modules: [],
          route_codes: [],
        },
        after_sku_id: args.p_after_sku_id,
        limit: args.p_limit,
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
        matched_count: args.p_search ? 0 : 611,
        returned_count: args.p_search ? 0 : 1,
        rows: args.p_search ? [] : [unknownAssessment],
        has_more: !args.p_search,
        next_after_sku_id: args.p_search ? null : 7,
      },
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
pass("controller load uses only readiness read RPCs");

const beforeStale = calls.length;
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
pass("search resets keyset and empty matched is not unavailable");

// Period failure must be Unavailable, not UNKNOWN/empty success.
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

// UNKNOWN remains a valid readiness severity in source (no READY coercion).
assert.ok(!/overall_severity\s*===\s*["']READY["']/.test(readinessSrc));
assert.ok(!/UNKNOWN[\s\S]{0,40}READY/.test(readinessSrc));
assert.equal(
  assessmentOverallSeverity({ summary: { overall_severity: "UNKNOWN" } }),
  "UNKNOWN",
);
pass("UNKNOWN is not coerced to READY");

// No writer / mutation RPC names and no client portfolio totals from page rows.
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
  assert.ok(
    !readinessSrc.includes(token),
    `forbidden token present: ${token}`,
  );
}
assert.ok(!/population_sku_count\s*=\s*rows\.length/.test(readinessSrc));
assert.ok(!/matched_count\s*=\s*rows\.length/.test(readinessSrc));
pass("no writer invocation / no client-derived totals");

// Registry / route / shell / sw static checks
const registry = readFileSync(
  join(root, "public/shared/js/costing-suite-registry.js"),
  "utf8",
);
const routeConfig = readFileSync(
  join(root, "public/shared/js/costing-route-config.js"),
  "utf8",
);
const shell = readFileSync(
  join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
const sw = readFileSync(join(root, "public/sw.js"), "utf8");
const html = readFileSync(
  join(root, "public/shared/costing-control-center.html"),
  "utf8",
);

assert.ok(registry.includes('"portfolio-readiness"') || registry.includes("'portfolio-readiness'"));
assert.ok(registry.includes("Readiness"));
assert.ok(routeConfig.includes("portfolio-readiness"));
assert.ok(routeConfig.includes('defaultLens: "dashboard"'));
assert.ok(shell.includes("costing-suite-readiness.js"));
assert.ok(shell.includes("isPortfolioReadinessLens"));
assert.ok(html.includes("readinessLensHost"));
assert.ok(/hub-cache-v333/.test(sw));
assert.ok(/costing-suite-readiness/.test(sw));
pass("registry/route/shell/html/sw integration markers");

assert.ok(!shell.includes("rpc_accept_marketing"));
assert.ok(!/js\/products\.js/.test(shell));
pass("shell does not add Manage Products or marketing writer paths");

console.log("\nAll WP04-G5 readiness client contract smoke checks passed.");
