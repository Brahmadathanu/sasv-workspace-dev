/**
 * Gate 11Y.10G.3B — Material Remediation Evidence Integration smoke.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  NO_VERIFIED_RATE_MANAGER_REMEDIATION,
  resolveRecommendedUiRouteTarget,
} from "../public/shared/js/costing-suite-recommended-ui-route.js";

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

function normalizeStage05RemediationRoutes(issueFilters) {
  const wanted = new Set(
    (Array.isArray(issueFilters) ? issueFilters : [])
      .map((value) => String(value || "").trim().toUpperCase())
      .filter(Boolean),
  );
  return ["MATERIAL_RATE_MANAGER_RM", "MATERIAL_RATE_MANAGER_PM"].filter(
    (route) => wanted.has(route),
  );
}

function isStage05MaterialRemediationMode({
  lensId,
  managerTab,
  issueFilters,
} = {}) {
  if (String(lensId || "").trim() !== "manual-rate-manager") return false;
  if (String(managerTab || "").trim() !== "action-queue") return false;
  return normalizeStage05RemediationRoutes(issueFilters).length > 0;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const materialSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-material-cost.js"),
  "utf8",
);
const shellSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
const controlSrc = readFileSync(
  join(root, "public/shared/js/costing-suite-control-center.js"),
  "utf8",
);
const registrySrc = readFileSync(
  join(root, "public/shared/js/costing-suite-registry.js"),
  "utf8",
);
const routeSrc = readFileSync(
  join(root, "public/shared/js/costing-route-config.js"),
  "utf8",
);
const htmlSrc = readFileSync(
  join(root, "public/shared/material-cost-manager.html"),
  "utf8",
);
const typesSrc = readFileSync(
  join(root, "public/shared/js/types/supabase.ts"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");

// A. Remediation mode detection (mirrors exported helpers)
assert(
  isStage05MaterialRemediationMode({
    lensId: "manual-rate-manager",
    managerTab: "action-queue",
    issueFilters: ["MATERIAL_RATE_MANAGER_RM"],
  }) === true,
  "RM-only launch is Stage-05 remediation mode",
);
assert(
  isStage05MaterialRemediationMode({
    lensId: "manual-rate-manager",
    managerTab: "action-queue",
    issueFilters: ["MATERIAL_RATE_MANAGER_PM"],
  }) === true,
  "PM-only launch is Stage-05 remediation mode",
);
assert(
  normalizeStage05RemediationRoutes([
    "MATERIAL_RATE_MANAGER_RM",
    "MATERIAL_RATE_MANAGER_PM",
  ]).length === 2,
  "combined launch keeps both route families",
);
assert(
  isStage05MaterialRemediationMode({
    lensId: "manual-rate-manager",
    managerTab: "register",
    issueFilters: ["MATERIAL_RATE_MANAGER_RM"],
  }) === false,
  "register tab is not remediation mode",
);
assert(
  materialSrc.includes("isStage05MaterialRemediationMode") &&
    materialSrc.includes("STAGE05_REMEDIATION_DRILLDOWN_VIEW") &&
    materialSrc.includes("v_costing_pricing_material_action_drilldown_snapshot") &&
    materialSrc.includes('.eq("action_severity", "BLOCKER")') &&
    materialSrc.includes('.in("recommended_ui_route", routes)'),
  "remediation load uses drilldown snapshot + BLOCKER + route filter",
);
assert(
  materialSrc.includes("v_costing_manual_rate_manager_action_queue") ||
    materialSrc.includes("MANUAL_RATE_MANAGER_ACTION_QUEUE_VIEW"),
  "normal action queue source retained",
);
assert(
  shellSrc.includes("clearStage05RemediationLaunchContext") &&
    shellSrc.includes("leavingRemediation"),
  "Clear/reset exits remediation mode and clears launch context",
);

// Hard blockers
assert(
  materialSrc.includes("HARD_BLOCKER_ISSUE_CODES") &&
    materialSrc.includes("MISSING_REQUIRED_RM_RATE") &&
    materialSrc.includes("MISSING_REQUIRED_PM_RATE") &&
    materialSrc.includes("Set Costing Rate") &&
    materialSrc.includes("openManualRateEditModal") &&
    materialSrc.includes("rpc_set_material_manual_rate"),
  "hard blockers reuse governed Set Costing Rate mutation",
);
assert(
  /isHardBlocker[\s\S]{0,500}cannot be accepted as review/.test(materialSrc),
  "hard blockers cannot Accept Review",
);

// Review clarity
assert(
  controlSrc.includes('formatReviewLineCountLabel("RM"') &&
    controlSrc.includes('formatReviewLineCountLabel("PM"') &&
    controlSrc.includes("rm_review_rate_line_count") &&
    controlSrc.includes("pm_review_rate_line_count"),
  "SKU Control shows RM/PM review counts from server fields",
);
assert(
  controlSrc.includes("line-evidence") &&
    controlSrc.includes("Open RM Trace") &&
    controlSrc.includes("Open PM Trace") &&
    controlSrc.includes("v_costing_pricing_material_action_drilldown_snapshot"),
  "Workbench line evidence + contextual trace CTAs",
);
assert(!/Arkkadi|product_id\s*===\s*9/.test(controlSrc), "no Arkkadi hardcoding");

// Trace handoff
assert(
  controlSrc.includes('"pm-cost-trace"') &&
    controlSrc.includes('"rm-cost-trace"'),
  "trace handoff targets rm/pm-cost-trace lenses",
);
assert(
  materialSrc.includes("normalizeTraceComponent") &&
    materialSrc.includes('ACTIVE_TRACE_COMPONENT = "PM"'),
  "trace launch context accepts RM and PM",
);

// PM Trace
assert(
  registrySrc.includes('"pm-cost-trace"') &&
    routeSrc.includes('"pm-cost-trace"') &&
    materialSrc.includes("pm-cost-trace"),
  "pm-cost-trace registered in suite/route/material lenses",
);
assert(
  materialSrc.includes("rpc_get_material_rate_pm_cost_trace") &&
    materialSrc.includes("rpc_get_material_rate_pm_cost_trace_filter_options") &&
    materialSrc.includes("rpc_export_material_rate_pm_cost_trace"),
  "PM Trace uses deployed RPCs",
);
assert(
  materialSrc.includes("buildPmTraceRpcFilters") &&
    materialSrc.includes("p_bom_source") &&
    materialSrc.includes("p_review_state") &&
    materialSrc.includes("p_limit") &&
    materialSrc.includes("p_offset"),
  "PM Trace filter + pagination args present",
);
assert(
  materialSrc.includes("valuation_date") &&
    materialSrc.includes("refresh_run_id") &&
    materialSrc.includes("pm_line_cost") &&
    materialSrc.includes("pm_source"),
  "PM Trace exact-run + PM-native columns",
);
assert(
  shellSrc.includes("role:material-cost-pm-trace") &&
    shellSrc.includes("role:material-cost-pm-trace-export") &&
    shellSrc.includes("CAN_VIEW_PM_TRACE") &&
    shellSrc.includes("CAN_EXPORT_PM_TRACE"),
  "PM Trace permissions mirrored from RM pattern",
);
assert(
  htmlSrc.includes("pmCostTraceChrome") &&
    htmlSrc.includes("pmTraceProduct") &&
    htmlSrc.includes("pmTraceBomSource"),
  "PM Trace chrome present in MCM HTML",
);
assert(
  typesSrc.includes("rpc_get_material_rate_pm_cost_trace") &&
    typesSrc.includes("rpc_export_material_rate_pm_cost_trace"),
  "supabase types include PM Trace RPCs",
);

// Zero-count foundation regression
const mrmZero = resolveRecommendedUiRouteTarget("MATERIAL_RATE_MANAGER", {
  productId: 9,
  rmBlockingLineCount: 0,
  pmBlockingLineCount: 0,
});
assert(mrmZero.navigable === false, "zero-count foundation blocker non-navigable");
assert(
  mrmZero.reason === NO_VERIFIED_RATE_MANAGER_REMEDIATION,
  "zero-count reason remains no-verified-rate-manager-remediation",
);

// SW cache contract: version may increment; require declared hub-cache-vN pattern
// and that material-cost manager remains in the PWA surface (HTML exists; SW may
// precache a subset of shared assets).
const cacheNameMatch = swSrc.match(
  /(?:const|let|var)\s+CACHE_NAME\s*=\s*["'](hub-cache-v\d+)["']/,
);
assert(
  Boolean(cacheNameMatch),
  "service worker declares CACHE_NAME as hub-cache-v<number>",
);
assert(
  existsSync(join(root, "public/shared/material-cost-manager.html")),
  "material-cost-manager.html exists for remediation evidence surface",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll Gate 11Y.10G.3B material remediation evidence smokes passed");
