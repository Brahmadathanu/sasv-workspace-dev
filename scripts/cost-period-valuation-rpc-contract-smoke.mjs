/**
 * Gate 11Y.10C.0 — Cost Period Valuation RPC contract smoke.
 * Read-only / structural only. No live mutation. No live refresh.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COST_PERIOD_VALUATION_RPC_NAMES,
  buildGetCostPeriodValuationContextArgs,
  buildSetCostPeriodValuationDateArgs,
} from "../public/shared/js/costing-suite-cost-period-valuation-helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log("OK", msg);
  else {
    failed += 1;
    console.error("FAIL", msg);
  }
}

const ctrlJs = fs.readFileSync(
  path.join(root, "public/shared/js/costing-suite-cost-period-valuation.js"),
  "utf8",
);
const shellJs = fs.readFileSync(
  path.join(root, "public/shared/js/costing-suite-shell.js"),
  "utf8",
);
const html = fs.readFileSync(
  path.join(root, "public/shared/costing-control-center.html"),
  "utf8",
);

assert(
  ctrlJs.includes("COST_PERIOD_VALUATION_RPC_NAMES.context") &&
    COST_PERIOD_VALUATION_RPC_NAMES.context ===
      "rpc_get_cost_period_valuation_context",
  "controller uses rpc_get_cost_period_valuation_context",
);
assert(
  !ctrlJs.includes('costingFrom("v_cost_periods")') &&
    !ctrlJs.includes("costingFrom(") &&
    !shellJs.includes('costingFrom("v_cost_periods")'),
  'controller DOES NOT use costingFrom("v_cost_periods")',
);
assert(
  ctrlJs.includes("COST_PERIOD_VALUATION_RPC_NAMES.history"),
  "History uses governance-history RPC",
);
assert(
  ctrlJs.includes("COST_PERIOD_VALUATION_RPC_NAMES.setValuationDate"),
  "mutation uses exact Set RPC",
);

const refreshBlock = shellJs.match(
  /rpc_request_costing_refresh[\s\S]{0,400}/,
);
assert(!!refreshBlock, "refresh call site found");
assert(
  refreshBlock &&
    !refreshBlock[0].includes("valuation_date") &&
    !refreshBlock[0].includes("p_valuation_date"),
  "existing Refresh payload still contains NO valuation_date",
);

assert(
  html.includes('id="costPeriodValuationStrip"') &&
    html.includes('id="cpvValuationChip"') &&
    html.includes('id="costPeriodValuationModal"') &&
    html.includes('data-cpv-tab="overview"') &&
    html.includes('data-cpv-tab="change"') &&
    html.includes('data-cpv-tab="history"'),
  "CCC HTML contains valuation chip host + unified modal tabs",
);
assert(
  !html.includes('id="costPeriodValuationChangeModal"') &&
    !html.includes('id="costPeriodValuationHistoryModal"'),
  "old standalone Change/History modal IDs removed",
);

assert(
  shellJs.includes("createCostPeriodValuationController") &&
    shellJs.includes("costPeriodValuationCtrl") &&
    shellJs.includes("reloadCostPeriodValuationIfNeeded"),
  "shell wires valuation controller",
);

assert(
  ctrlJs.includes("canEdit") &&
    ctrlJs.includes("canChangeCostPeriodValuation") &&
    ctrlJs.includes("cpvTabChange") &&
    ctrlJs.includes("setActiveTab"),
  "Change is edit-permission gated via unified modal tab",
);

assert(
  !ctrlJs.includes("await costingRpc(\n        COST_PERIOD_VALUATION_RPC_NAMES.setValuationDate") ||
    ctrlJs.includes("confirmChange"),
  "set RPC only reachable via confirmChange path",
);

const thisSmoke = fs.readFileSync(
  path.join(root, "scripts/cost-period-valuation-rpc-contract-smoke.mjs"),
  "utf8",
);
const helpersSmoke = fs.readFileSync(
  path.join(root, "scripts/cost-period-valuation-helpers-smoke.mjs"),
  "utf8",
);

// Structural: smokes themselves must not invoke live mutation or refresh.
assert(
  !/supabase\.rpc\s*\(/.test(thisSmoke) &&
    !/supabase\.rpc\s*\(/.test(helpersSmoke) &&
    !/createClient\s*\(/.test(thisSmoke) &&
    !/createClient\s*\(/.test(helpersSmoke),
  "no routine smoke performs the actual mutation",
);
assert(
  !/await\s+costingRpc\s*\(\s*["']rpc_request_costing_refresh/.test(thisSmoke) &&
    !/await\s+costingRpc\s*\(\s*["']rpc_request_costing_refresh/.test(
      helpersSmoke,
    ),
  "no routine smoke requests a costing refresh",
);

assert(
  buildGetCostPeriodValuationContextArgs({ period_start: "2026-08-01" }).ok,
  "context args builder callable",
);
assert(
  buildSetCostPeriodValuationDateArgs({
    period_start: "2026-08-01",
    period_end: "2026-08-31",
    valuation_date: "2026-08-07",
    reason: "Align valuation with seven-policy effective date",
  }).ok,
  "set args builder callable (mocked only)",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll cost-period-valuation RPC contract smokes passed");
