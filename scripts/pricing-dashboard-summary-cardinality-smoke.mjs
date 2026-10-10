/**
 * CCC global-summary / period / KPI contract smoke (source only; no DB calls).
 * Legacy v_costing_pricing_dashboard_summary is parked — not used on normal CCC startup.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const controlSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-control-center.js"),
  "utf8",
);
const shellSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
const readinessSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-readiness.js"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");
const registry = readFileSync(
  join(root, "public/shared/js/costing-suite-registry.js"),
  "utf8",
);
const routeConfig = readFileSync(
  join(root, "public/shared/js/costing-route-config.js"),
  "utf8",
);

let failed = 0;
function assert(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${message}`);
}

function sliceFn(source, name, nextName) {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf(`async function ${nextName}(`);
  if (start < 0 || end < 0 || end <= start) return "";
  return source.slice(start, end);
}

function sliceFnTo(source, name, nextMarker) {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf(nextMarker, start + 1);
  if (start < 0 || end < 0 || end <= start) return "";
  return source.slice(start, end);
}

const businessFn = sliceFn(
  controlSrc,
  "loadBusinessKpiSummary",
  "loadControlDashboardSummary",
);
const controlFn = sliceFn(
  controlSrc,
  "loadControlDashboardSummary",
  "loadControlAuditSnapshot",
);
const auditFn = sliceFn(
  controlSrc,
  "loadControlAuditSnapshot",
  "loadGlobalSummaries",
);
const globalFn = sliceFn(controlSrc, "loadGlobalSummaries", "loadDashboardRows");

const LEGACY_DASHBOARD = "v_costing_pricing_dashboard_summary";

assert(
  !controlSrc.includes("function loadDashboardSummary"),
  "loadDashboardSummary removed from CCC runtime",
);
assert(
  !/\bDASHBOARD_SUMMARY\b/.test(controlSrc),
  "DASHBOARD_SUMMARY state removed from CCC runtime",
);
assert(
  !globalFn.includes("loadDashboardSummary"),
  "loadGlobalSummaries() does not call loadDashboardSummary",
);
assert(
  !globalFn.includes(LEGACY_DASHBOARD),
  "loadGlobalSummaries() does not query legacy dashboard summary",
);
assert(
  /await loadBusinessKpiSummary\(periodStart\);\s*await loadControlDashboardSummary\(periodStart\);\s*await loadControlAuditSnapshot\(periodStart\);/.test(
    globalFn,
  ),
  "loadGlobalSummaries() loads business + control + audit only",
);

const loaders = [
  [
    "loadBusinessKpiSummary",
    businessFn,
    "v_costing_pricing_business_kpi_summary",
  ],
  [
    "loadControlDashboardSummary",
    controlFn,
    "v_costing_pricing_control_dashboard_snapshot",
  ],
];

for (const [name, body, view] of loaders) {
  assert(body.length > 0, `${name} body located`);
  assert(body.includes(view), `${name} reads ${view}`);
  assert(body.includes(".maybeSingle()"), `${name} uses .maybeSingle()`);
  assert(!body.includes(".limit(1)"), `${name} does not use .limit(1)`);
  assert(!body.includes("data?.[0]"), `${name} does not use data?.[0]`);
  assert(
    body.includes('.eq("period_start", periodStart)'),
    `${name} still filters period_start`,
  );
  assert(
    !body.includes("valuation_date"),
    `${name} does not filter valuation_date`,
  );
  assert(
    !body.includes("refresh_run_id"),
    `${name} does not filter refresh_run_id`,
  );
  assert(!body.includes(".order("), `${name} does not add ordering`);
  assert(
    body.includes("if (error) throw error;"),
    `${name} preserves if (error) throw error`,
  );
  assert(!body.includes("catch"), `${name} does not locally catch`);
  assert(
    /=\s*data\s*\|\|\s*null/.test(body),
    `${name} assigns data || null`,
  );
}

assert(auditFn.includes("fetchAllRows"), "loadControlAuditSnapshot remains fetchAllRows");
assert(
  auditFn.includes("v_costing_pricing_control_integrity_audit_snapshot"),
  "control audit still reads the integrity snapshot",
);
assert(
  !auditFn.includes(".maybeSingle()"),
  "control audit does not use .maybeSingle()",
);

const shellFallback = sliceFnTo(
  shellSrc,
  "resolveActivePeriodStart",
  "function isRmCostTraceLensActive",
);
assert(shellFallback.length > 0, "shell period resolver located");
assert(
  shellFallback.includes("v_costing_pricing_control_dashboard_snapshot"),
  "shell primary period path still uses control dashboard snapshot",
);
assert(
  !shellFallback.includes(LEGACY_DASHBOARD),
  "active-period fallback does not query legacy dashboard summary",
);
assert(
  shellFallback.includes("v_costing_pricing_business_kpi_summary"),
  "active-period fallback uses business KPI summary",
);
assert(
  shellFallback.includes('.order("period_start", { ascending: false })'),
  "shell period fallback still orders period_start descending",
);
assert(shellFallback.includes(".limit(1)"), "shell fallback still keeps .limit(1)");
assert(
  shellFallback.includes("getCurrentMonthStart"),
  "shell preserves safe current-month fallback helper",
);

const kpiFn =
  controlSrc.slice(
    controlSrc.indexOf("function renderKpiStrip("),
    controlSrc.indexOf("async function handleKpiAction("),
  ) || "";
assert(kpiFn.length > 0, "renderKpiStrip body located");
assert(!/legacy\./.test(kpiFn), "KPI renderer contains no legacy.* fallback");
assert(
  !kpiFn.includes("pricing_bridge_sku_count"),
  "KPI renderer drops legacy pricing_bridge_sku_count",
);
assert(
  !kpiFn.includes("pricing_bridge_blocked_count"),
  "KPI renderer drops legacy pricing_bridge_blocked_count",
);
assert(
  !kpiFn.includes("pricing_bridge_review_required_count"),
  "KPI renderer drops legacy pricing_bridge_review_required_count",
);
assert(
  !kpiFn.includes("selling_price_sku_count"),
  "KPI renderer drops legacy selling_price_sku_count",
);
assert(
  !kpiFn.includes("scheme_blocked_count"),
  "KPI renderer drops legacy scheme_blocked_count",
);
assert(
  !kpiFn.includes("scheme_review_required_count"),
  "KPI renderer drops legacy scheme_review_required_count",
);
assert(
  /riskTotal\(\s*business\.scheme_blocked_row_count,\s*business\.scheme_review_row_count,\s*\)/.test(
    kpiFn,
  ),
  "Scheme / Margin Risk uses business scheme blocked + review exactly once",
);

assert(
  /function loadDashboardRows[\s\S]*return CONTROL_DASHBOARD_SUMMARY \? \[CONTROL_DASHBOARD_SUMMARY\] : \[\]/.test(
    controlSrc,
  ),
  "Dashboard row still comes from CONTROL_DASHBOARD_SUMMARY",
);

assert(
  !controlSrc.includes(LEGACY_DASHBOARD),
  "control-center normal paths do not reference legacy dashboard summary view",
);

const readinessBefore = readinessSrc.length;
assert(readinessBefore > 0, "Readiness source present (untouched by this package)");
assert(
  registry.includes("portfolio-readiness"),
  "registry still includes portfolio-readiness",
);
assert(
  routeConfig.includes("portfolio-readiness"),
  "route config still includes portfolio-readiness",
);
assert(
  !controlSrc.includes("20260926062836") &&
    !controlSrc.includes(
      "constrain_pricing_dashboard_summary_to_current_successful_run",
    ) &&
    !shellSrc.includes("20260926062836"),
  "no SQL/migration parity strings",
);
assert(
  /CACHE_NAME = "hub-cache-v346"/.test(swSrc),
  "current SW generation is v346",
);
assert(!/hub-cache-v342/.test(swSrc), "SW no longer v342");

if (failed) {
  console.error(`\npricing-dashboard-summary-cardinality-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("\npricing-dashboard-summary-cardinality-smoke: all checks passed");
