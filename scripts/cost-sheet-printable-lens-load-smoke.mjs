/**
 * Cost Sheet Review — printable Cost Sheet list-load smoke.
 * Source-contract + helper tests. No live DB / refresh / valuation mutation.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COSTING_ROUTE_CONFIG } from "../public/shared/js/costing-route-config.js";
import {
  PRINTABLE_LINES_VIEW,
  PRINTABLE_PRODUCT_SUMMARY_VIEW,
  PRINTABLE_SUMMARY_TIMEOUT_MAX_RETRIES,
  isPgStatementTimeoutError,
  readWithPgStatementTimeoutRetry,
} from "../public/shared/js/costing-suite-cost-sheet.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const shellSrc = read("public/shared/js/costing-suite-shell.js");
const costSheetSrc = read("public/shared/js/costing-suite-cost-sheet.js");
const migrationSrc = read(
  "supabase/migrations/20260910143000_csr_printable_cost_sheet_current_run.sql",
);

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

function extractFn(src, name) {
  const start = src.search(
    new RegExp(String.raw`(?:async\s+)?function ${name}\s*\(`),
  );
  if (start < 0) return "";
  const open = src.indexOf("{", start);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

const timeoutErr = { code: "57014", message: "canceling statement due to statement timeout" };
const otherErr = { code: "42501", message: "permission denied" };

// --- 1. Default lens ---
assert(
  COSTING_ROUTE_CONFIG["cost-sheet-review"]?.defaultLens === "sku-cost-sheet",
  "Cost Sheet Review default lens remains sku-cost-sheet",
);

// --- 2. Selector mapping ---
assert(
  /["']sku-cost-sheet["']\s*:\s*["']v_costing_pricing_sku_selector["']/.test(
    shellSrc,
  ),
  "sku-cost-sheet remains mapped to v_costing_pricing_sku_selector",
);

// --- 3. Printable list source ---
assert(
  PRINTABLE_PRODUCT_SUMMARY_VIEW ===
    "v_costing_pricing_printable_cost_sheet_product_summary",
  "printable list source constant is product summary view",
);
assert(
  /fetchAllProductSummaryRowsForPeriod[\s\S]*PRINTABLE_PRODUCT_SUMMARY_VIEW/.test(
    costSheetSrc,
  ),
  "printable list fetch uses PRINTABLE_PRODUCT_SUMMARY_VIEW",
);

// --- 4. Lines not preloaded during list load ---
const loadPrintableLensRowsFn = extractFn(costSheetSrc, "loadPrintableLensRows");
assert(
  Boolean(loadPrintableLensRowsFn),
  "loadPrintableLensRows is present",
);
assert(
  loadPrintableLensRowsFn.includes("fetchAllProductSummaryRowsForPeriod") &&
    !loadPrintableLensRowsFn.includes("PRINTABLE_LINES_VIEW") &&
    !loadPrintableLensRowsFn.includes("loadPrintableLinesForProduct"),
  "printable detail/line source is not preloaded during product-list load",
);
assert(
  PRINTABLE_LINES_VIEW === "v_costing_pricing_printable_cost_sheet_lines",
  "printable lines view constant unchanged",
);

// --- 5–6. Timeout recognizer ---
assert(
  isPgStatementTimeoutError({ code: "57014" }) === true,
  "isPgStatementTimeoutError recognizes error code 57014",
);
assert(
  isPgStatementTimeoutError({
    message: "canceling statement due to statement timeout",
  }) === true,
  "isPgStatementTimeoutError handles statement-timeout message",
);
assert(
  isPgStatementTimeoutError(otherErr) === false,
  "isPgStatementTimeoutError rejects non-timeout errors",
);
assert(
  isPgStatementTimeoutError(null) === false,
  "isPgStatementTimeoutError rejects null",
);

// --- 7–10. Retry helper ---
assert(
  PRINTABLE_SUMMARY_TIMEOUT_MAX_RETRIES === 1,
  "printable summary timeout retry max is one",
);

{
  let calls = 0;
  const sleepLog = [];
  const result = await readWithPgStatementTimeoutRetry(
    async () => {
      calls += 1;
      if (calls === 1) throw timeoutErr;
      return { data: [{ product_id: 1 }], error: null };
    },
    { sleep: async (ms) => sleepLog.push(ms) },
  );
  assert(calls === 2, "first 57014 triggers exactly one retry");
  assert(sleepLog.length === 1 && sleepLog[0] === 300, "retry waits ~300 ms once");
  assert(
    Array.isArray(result.data) && result.data.length === 1,
    "retry success returns once",
  );
}

{
  let calls = 0;
  let thrown = null;
  try {
    await readWithPgStatementTimeoutRetry(
      async () => {
        calls += 1;
        throw timeoutErr;
      },
      { sleep: async () => {} },
    );
  } catch (err) {
    thrown = err;
  }
  assert(calls === 2, "two consecutive 57014 failures attempt initial + one retry");
  assert(thrown === timeoutErr, "two consecutive 57014 failures propagate");
}

{
  let calls = 0;
  let thrown = null;
  try {
    await readWithPgStatementTimeoutRetry(
      async () => {
        calls += 1;
        throw otherErr;
      },
      { sleep: async () => {} },
    );
  } catch (err) {
    thrown = err;
  }
  assert(calls === 1, "non-timeout errors do not retry");
  assert(thrown === otherErr, "non-timeout errors propagate immediately");
}

// --- 11. No write/RPC mutation retry ---
const costingRpcBlocks = [
  ...costSheetSrc.matchAll(/costingRpc\s*\([\s\S]{0,180}/g),
].map((m) => m[0]);
assert(costingRpcBlocks.length > 0, "costingRpc call sites exist for contrast");
assert(
  costingRpcBlocks.every((block) => !block.includes("readWithPgStatementTimeoutRetry")),
  "no costingRpc call is wrapped by printable timeout retry",
);
assert(
  !/rpc_request_costing_refresh[\s\S]{0,80}readWithPgStatementTimeoutRetry/.test(
    shellSrc,
  ) &&
    !/readWithPgStatementTimeoutRetry[\s\S]{0,80}rpc_request_costing_refresh/.test(
      shellSrc,
    ),
  "timeout retry is not applied to costing refresh RPC",
);
assert(
  extractFn(costSheetSrc, "loadPrintableLinesForProduct").includes("PRINTABLE_LINES_VIEW") &&
    !extractFn(costSheetSrc, "loadPrintableLinesForProduct").includes(
      "readWithPgStatementTimeoutRetry",
    ),
  "printable line fetch is not retried by the summary timeout helper",
);

// --- 12. Stale generation cannot paint ---
const printableLoadBranch = shellSrc.match(
  /if \(CURRENT_LENS === "printable-cost-sheet"\) \{[\s\S]*?return;\s*\}/,
)?.[0] || "";
assert(
  printableLoadBranch.includes("loadPrintableLensRows") &&
    printableLoadBranch.includes("isRowsLoadCurrent(loadGeneration)") &&
    /isRowsLoadCurrent\(loadGeneration\)\) return;[\s\S]*ALL_ROWS = groupedRows/.test(
      printableLoadBranch,
    ),
  "stale generation cannot paint printable rows after lens or period change",
);

// --- 13. Loading-mask cleanup ---
const loadRowsStart = shellSrc.indexOf("async function loadRowsForLens");
const loadRowsEnd = shellSrc.indexOf("function uniqueValues", loadRowsStart);
const loadRowsFn =
  loadRowsStart >= 0 && loadRowsEnd > loadRowsStart
    ? shellSrc.slice(loadRowsStart, loadRowsEnd)
    : "";
assert(
  /finally \{[\s\S]*isRowsLoadCurrent\(loadGeneration\)[\s\S]*setLoadingMask\(false\)/.test(
    loadRowsFn,
  ),
  "final loading-mask cleanup remains present and generation-gated",
);

// --- 14. No duplicate error toasts ---
const printableFailFn = extractFn(shellSrc, "handlePrintableCostSheetLoadFailure");
const lensFailFn = extractFn(shellSrc, "handleLensLoadFailure");
assert(
  (printableFailFn.match(/showToast\(/g) || []).length === 1,
  "printable final failure shows exactly one toast",
);
assert(
  /if \(isPrintableCostSheetLens\(\)\) \{[\s\S]*handlePrintableCostSheetLoadFailure\([\s\S]*return;[\s\S]*handleError\(/.test(
    lensFailFn,
  ),
  "printable path does not also call generic handleError (no duplicate toast)",
);

// --- 15. Try again reloads data only ---
const tryAgainHandler = shellSrc.match(
  /document\.addEventListener\("click", \(event\) => \{[\s\S]*?data-printable-summary-try-again[\s\S]*?\}\);/,
)?.[0] || "";
assert(
  tryAgainHandler.includes("void loadRowsForLens()") &&
    !tryAgainHandler.includes("rpc_request_costing_refresh") &&
    !tryAgainHandler.includes("onCostingSuiteRefreshClick") &&
    !tryAgainHandler.includes("refreshCostingChain"),
  "Try again reloads lens data only and does not call costing refresh RPC",
);
assert(
  printableFailFn.includes("data-printable-summary-try-again") &&
    printableFailFn.includes("Try again") &&
    printableFailFn.includes("setStatus(detail, \"error\")") &&
    printableFailFn.includes("createElement(\"button\")") &&
    !printableFailFn.includes("innerHTML"),
  "final failure exposes a safely appended Try again button",
);
assert(
  !/#[0-9a-fA-F]{3,8}/.test(printableFailFn),
  "printable failure handler contains no hard-coded hexadecimal error colour",
);

const switchLensStart = shellSrc.indexOf("async function switchLens");
const switchLensEnd = shellSrc.indexOf("function getRowStatus", switchLensStart);
const switchLensFn =
  switchLensStart >= 0 && switchLensEnd > switchLensStart
    ? shellSrc.slice(switchLensStart, switchLensEnd)
    : "";
assert(
  switchLensFn.includes(
    'handleLensLoadFailure("Failed to load selected lens", err)',
  ),
  "switchLens selected-lens failure uses the printable-aware handler",
);

const periodStartIdx = shellSrc.indexOf("async function setActiveCostingPeriod");
const periodEndIdx = shellSrc.indexOf("async function fetchAllRows", periodStartIdx);
const periodFn =
  periodStartIdx >= 0 && periodEndIdx > periodStartIdx
    ? shellSrc.slice(periodStartIdx, periodEndIdx)
    : "";
assert(
  periodFn.includes('handleError("Failed to load costing period", err)') &&
    !periodFn.includes("handleLensLoadFailure"),
  "setActiveCostingPeriod continues to use generic handleError",
);

const initStart = shellSrc.indexOf("async function init(");
const initEnd = shellSrc.indexOf(
  "document.addEventListener(\"click\", (event) => {",
  initStart,
);
const initFn =
  initStart >= 0 && initEnd > initStart
    ? shellSrc.slice(initStart, initEnd)
    : "";
assert(
  initFn.includes('handleError("Initialization error", err)') &&
    !initFn.includes("handleLensLoadFailure"),
  "init continues to use generic handleError",
);

// --- 16. Other costing-suite route defaults unchanged ---
assert(
  COSTING_ROUTE_CONFIG["costing-control-center"]?.defaultLens === "dashboard",
  "Control Center default lens unchanged",
);
assert(
  COSTING_ROUTE_CONFIG["material-cost-manager"]?.defaultLens ===
    "manual-rate-manager",
  "Material Cost Manager default lens unchanged",
);
assert(
  COSTING_ROUTE_CONFIG["cost-build-manager"]?.defaultLens === "cost-governance",
  "Cost Build Manager default lens unchanged",
);
assert(
  COSTING_ROUTE_CONFIG["pricing-policy-manager"]?.defaultLens ===
    "policy-manager",
  "Pricing Policy Manager default lens unchanged",
);
assert(
  COSTING_ROUTE_CONFIG["production-route-manager"]?.defaultLens ===
    "route-readiness",
  "Production Route Manager default lens unchanged",
);
assert(
  /dashboard:\s*["']v_costing_pricing_dashboard_summary["']/.test(shellSrc) &&
    /["']policy-manager["']\s*:\s*["']v_costing_policy_manager_sku_overview["']/.test(
      shellSrc,
    ),
  "other costing-suite VIEW_BY_LENS mappings remain present",
);

// --- Cache invalidation still on period/refresh ---
assert(
  !extractFn(costSheetSrc, "onLensLoadStart").includes(
    "printableProductSummaryCache = null",
  ),
  "ordinary lens load does not clear printable product-summary cache",
);
assert(
  extractFn(costSheetSrc, "invalidatePrintableLinesCache").includes(
    "printableProductSummaryCache = null",
  ),
  "explicit invalidation still clears printable product-summary cache",
);
assert(
  /setActiveCostingPeriod[\s\S]*invalidatePrintableLinesCache/.test(shellSrc) &&
    /reloadCostingUiAfterRefreshRun[\s\S]*invalidatePrintableLinesCache/.test(
      shellSrc,
    ),
  "period change and costing refresh still invalidate printable cache",
);

// --- Server migration contract ---
assert(
  migrationSrc.includes("v_current_successful_costing_refresh_run") &&
    migrationSrc.includes("product_base") &&
    migrationSrc.includes("status_by_product") &&
    !/drop\s+view[\s\S]*cascade/i.test(migrationSrc),
  "migration scopes both CTEs to current governed run without DROP CASCADE",
);

if (failed) {
  console.error(`\ncost-sheet-printable-lens-load-smoke: ${failed} failure(s)`);
  process.exit(1);
}
console.log("\ncost-sheet-printable-lens-load-smoke: all checks passed");
