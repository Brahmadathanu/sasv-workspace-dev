/**
 * Workbench / MCM Trace launch-lineage lifecycle.
 * Covers controller reuse: exact A → non-exact B → exact C.
 * Does not claim RM/PM Trace list RPCs are exact-run filtered.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const materialSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-material-cost.js"),
  "utf8",
);
const controlSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-control-center.js"),
  "utf8",
);
const shellSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");

const applyTraceLaunchSrc =
  materialSrc.match(
    /function applyTraceLaunchContext\([\s\S]*?\n  function /,
  )?.[0] || "";
const assignTraceExactSrc =
  materialSrc.match(
    /function assignTraceExactRunDisplay\([\s\S]*?\n  function /,
  )?.[0] || "";
const rmTraceRpcSrc =
  materialSrc.match(
    /function buildRmTraceRpcFilters\([\s\S]*?\n  function /,
  )?.[0] || "";
const pmTraceRpcSrc =
  materialSrc.match(
    /function buildPmTraceRpcFilters\([\s\S]*?\n  function /,
  )?.[0] || "";

assert(
  applyTraceLaunchSrc.indexOf("TRACE_LAUNCH_VALUATION_DATE = null") >= 0 &&
    applyTraceLaunchSrc.indexOf("TRACE_LAUNCH_REFRESH_RUN_ID = null") >= 0 &&
    applyTraceLaunchSrc.indexOf("TRACE_LAUNCH_VALUATION_DATE = null") <
      applyTraceLaunchSrc.indexOf(
        "context.valuationDate || context.valuation_date",
      ) &&
    applyTraceLaunchSrc.indexOf("TRACE_LAUNCH_REFRESH_RUN_ID = null") <
      applyTraceLaunchSrc.indexOf(
        "context.valuationDate || context.valuation_date",
      ),
  "incoming launch always resets TRACE_LAUNCH_* before evaluating the tuple",
);
assert(
  /TRACE_LAUNCH_VALUATION_DATE = valuationDate/.test(applyTraceLaunchSrc) &&
    /TRACE_LAUNCH_REFRESH_RUN_ID = refreshRunId/.test(applyTraceLaunchSrc),
  "complete exact tuple still seeds launch lineage",
);
assert(
  /else \{\s*TRACE_VALUATION_DATE = null;\s*TRACE_REFRESH_RUN_ID = null;\s*\}/.test(
    applyTraceLaunchSrc,
  ),
  "incomplete launch unpins previous TRACE_* display values",
);
assert(
  /hasTraceLaunchExactIdentity\(\)/.test(assignTraceExactSrc) &&
    /seedTraceExactRunDisplayFromLaunch\(\)/.test(assignTraceExactSrc),
  "period-scoped display assignment still cannot overwrite an active exact launch",
);

function createTraceLaunchState() {
  return {
    TRACE_LAUNCH_VALUATION_DATE: null,
    TRACE_LAUNCH_REFRESH_RUN_ID: null,
    TRACE_VALUATION_DATE: null,
    TRACE_REFRESH_RUN_ID: null,
    TRACE_FILTERS: { product_id: 10, sku_id: 134, stock_item_id: 351 },
  };
}

function hasTraceLaunchExactIdentity(state) {
  return (
    Boolean(state.TRACE_LAUNCH_VALUATION_DATE) &&
    state.TRACE_LAUNCH_REFRESH_RUN_ID != null &&
    Number.isFinite(Number(state.TRACE_LAUNCH_REFRESH_RUN_ID))
  );
}

function applyTraceLaunchContext(state, context = {}) {
  state.TRACE_LAUNCH_VALUATION_DATE = null;
  state.TRACE_LAUNCH_REFRESH_RUN_ID = null;

  if (context.productId != null) state.TRACE_FILTERS.product_id = context.productId;
  if (context.skuId != null) state.TRACE_FILTERS.sku_id = context.skuId;
  if (context.stockItemId != null) {
    state.TRACE_FILTERS.stock_item_id = context.stockItemId;
  }

  const valuationDate = String(
    context.valuationDate || context.valuation_date || "",
  ).trim();
  const refreshRunRaw = context.refreshRunId ?? context.refresh_run_id;
  const refreshRunId = Number(refreshRunRaw);
  if (
    valuationDate &&
    refreshRunRaw != null &&
    refreshRunRaw !== "" &&
    Number.isFinite(refreshRunId)
  ) {
    state.TRACE_LAUNCH_VALUATION_DATE = valuationDate;
    state.TRACE_LAUNCH_REFRESH_RUN_ID = refreshRunId;
    state.TRACE_VALUATION_DATE = valuationDate;
    state.TRACE_REFRESH_RUN_ID = refreshRunId;
  } else {
    state.TRACE_VALUATION_DATE = null;
    state.TRACE_REFRESH_RUN_ID = null;
  }
}

function assignTraceExactRunDisplay(state, valuationDate, refreshRunId) {
  if (hasTraceLaunchExactIdentity(state)) {
    state.TRACE_VALUATION_DATE = state.TRACE_LAUNCH_VALUATION_DATE;
    state.TRACE_REFRESH_RUN_ID = state.TRACE_LAUNCH_REFRESH_RUN_ID;
    return;
  }
  if (valuationDate) state.TRACE_VALUATION_DATE = valuationDate;
  if (refreshRunId != null && refreshRunId !== "") {
    state.TRACE_REFRESH_RUN_ID = refreshRunId;
  }
}

const state = createTraceLaunchState();

applyTraceLaunchContext(state, {
  valuation_date: "2026-08-07",
  refresh_run_id: 108,
  productId: 10,
});
assert(
  hasTraceLaunchExactIdentity(state) === true &&
    state.TRACE_LAUNCH_VALUATION_DATE === "2026-08-07" &&
    state.TRACE_LAUNCH_REFRESH_RUN_ID === 108 &&
    state.TRACE_VALUATION_DATE === "2026-08-07" &&
    state.TRACE_REFRESH_RUN_ID === 108,
  "exact launch A seeds launch lineage and display",
);
assignTraceExactRunDisplay(state, "2026-09-01", 99);
assert(
  state.TRACE_VALUATION_DATE === "2026-08-07" &&
    state.TRACE_REFRESH_RUN_ID === 108,
  "exact launch A is not overwritten by later filter-options / first-row values",
);

applyTraceLaunchContext(state, { productId: 10, skuId: 134 });
assert(
  hasTraceLaunchExactIdentity(state) === false &&
    state.TRACE_LAUNCH_VALUATION_DATE === null &&
    state.TRACE_LAUNCH_REFRESH_RUN_ID === null &&
    state.TRACE_VALUATION_DATE === null &&
    state.TRACE_REFRESH_RUN_ID === null,
  "later non-exact launch B clears stale launch lineage and unpins display A",
);
assert(
  state.TRACE_FILTERS.product_id === 10 && state.TRACE_FILTERS.sku_id === 134,
  "non-exact launch B does not wipe unrelated Trace filters",
);
assignTraceExactRunDisplay(state, "2026-09-01", 99);
assert(
  hasTraceLaunchExactIdentity(state) === false &&
    state.TRACE_VALUATION_DATE === "2026-09-01" &&
    state.TRACE_REFRESH_RUN_ID === 99,
  "period-scoped display assignment for B can use its own valuation/run",
);

applyTraceLaunchContext(state, {
  valuationDate: "2026-07-22",
  refreshRunId: 80,
});
assert(
  hasTraceLaunchExactIdentity(state) === true &&
    state.TRACE_LAUNCH_VALUATION_DATE === "2026-07-22" &&
    state.TRACE_LAUNCH_REFRESH_RUN_ID === 80 &&
    state.TRACE_VALUATION_DATE === "2026-07-22" &&
    state.TRACE_REFRESH_RUN_ID === 80,
  "later exact launch C reseeds launch lineage and display",
);
assignTraceExactRunDisplay(state, "2026-09-01", 99);
assert(
  state.TRACE_VALUATION_DATE === "2026-07-22" &&
    state.TRACE_REFRESH_RUN_ID === 80,
  "exact launch C is not overwritten by later filter-options / first-row values",
);

assert(
  /async function loadWorkbenchLineEvidenceRows[\s\S]*\.eq\("valuation_date"/.test(
    controlSrc,
  ) &&
    /async function loadWorkbenchLineEvidenceRows[\s\S]*\.eq\("refresh_run_id"/.test(
      controlSrc,
    ),
  "Workbench exact drilldown filtering remains in place",
);
assert(
  /row\?\.valuation_date \?\? ""/.test(controlSrc) &&
    /row\?\.refresh_run_id \?\? ""/.test(controlSrc),
  "Workbench hierarchy still separates by valuation_date and refresh_run_id",
);
assert(
  /String\(line\.valuation_date\) === String\(valuationDate\)/.test(controlSrc) &&
    /String\(line\.refresh_run_id\) === String\(refreshRunId\)/.test(controlSrc),
  "Trace sharing still requires a matching exact tuple",
);
assert(
  /qs\.set\(\s*"valuation_date"/.test(shellSrc) &&
    /qs\.set\("refresh_run_id"/.test(shellSrc) &&
    /qs\.set\("family_route_id"/.test(shellSrc),
  "shell route round-trip and PRM deep-link IDs remain intact",
);
assert(
  !/p_valuation_date/.test(rmTraceRpcSrc) &&
    !/p_refresh_run_id/.test(rmTraceRpcSrc) &&
    !/p_valuation_date/.test(pmTraceRpcSrc) &&
    !/p_refresh_run_id/.test(pmTraceRpcSrc),
  "RM/PM Trace RPC argument lists remain unchanged",
);
assert(
  /CACHE_NAME = "hub-cache-v324"/.test(swSrc),
  "current SW cache name remains hub-cache-v324",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll Trace launch-lineage lifecycle smokes passed.");
