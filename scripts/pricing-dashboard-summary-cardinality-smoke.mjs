/**
 * Pricing dashboard period summaries must be zero-or-one reads.
 * Source contract only: no database calls.
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
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");

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

const dashboardFn = sliceFn(
  controlSrc,
  "loadDashboardSummary",
  "loadBusinessKpiSummary",
);
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

const loaders = [
  ["loadDashboardSummary", dashboardFn, "v_costing_pricing_dashboard_summary"],
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

const shellFallback = shellSrc.slice(
  shellSrc.indexOf("async function resolveActivePeriodStart"),
  shellSrc.indexOf("function isRmCostTraceLensActive"),
);
assert(shellFallback.length > 0, "shell period resolver located");
assert(
  shellFallback.includes('costingFrom(\n    "v_costing_pricing_dashboard_summary",\n  )') ||
    shellFallback.includes('"v_costing_pricing_dashboard_summary"'),
  "shell latest-period fallback still reads dashboard summary",
);
assert(
  shellFallback.includes('.order("period_start", { ascending: false })'),
  "shell latest-period fallback still orders period_start descending",
);
assert(shellFallback.includes(".limit(1)"), "shell fallback still keeps .limit(1)");

assert(
  /await loadDashboardSummary\(periodStart\);\s*await loadBusinessKpiSummary\(periodStart\);\s*await loadControlDashboardSummary\(periodStart\);\s*await loadControlAuditSnapshot\(periodStart\);/.test(
    globalFn,
  ),
  "loadGlobalSummaries() ordering remains unchanged",
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
  /CACHE_NAME = "hub-cache-v327"/.test(swSrc),
  "current SW generation is v327",
);

if (failed) {
  console.error(`\npricing-dashboard-summary-cardinality-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("\npricing-dashboard-summary-cardinality-smoke: all checks passed");
