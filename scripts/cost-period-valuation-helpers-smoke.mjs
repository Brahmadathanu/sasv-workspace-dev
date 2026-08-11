/**
 * Gate 11Y.10C.0 — Cost Period Valuation helpers smoke.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COST_PERIOD_VALUATION_CHANGE_WARNING,
  COST_PERIOD_VALUATION_FORBIDDEN_SUBSTRINGS,
  COST_PERIOD_VALUATION_PERMISSION_TARGET,
  COST_PERIOD_VALUATION_REASON_MIN_LENGTH,
  COST_PERIOD_VALUATION_RPC_ARG_KEYS,
  COST_PERIOD_VALUATION_RPC_ALLOWLIST,
  COST_PERIOD_VALUATION_RPC_NAMES,
  buildGetCostPeriodGovernanceHistoryArgs,
  buildGetCostPeriodValuationContextArgs,
  buildSetCostPeriodValuationDateArgs,
  canChangeCostPeriodValuation,
  formatCostPeriodStatusLabel,
  formatCostPeriodValuationSourceLabel,
  formatCostPeriodValuationStatusLabel,
  normalizeCostPeriodValuationContext,
  softValidateCostPeriodValuationChange,
  unwrapCostPeriodGovernanceHistoryPayload,
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

assert(
  COST_PERIOD_VALUATION_RPC_NAMES.context ===
    "rpc_get_cost_period_valuation_context",
  "exact context RPC name",
);
assert(
  COST_PERIOD_VALUATION_RPC_ARG_KEYS[
    COST_PERIOD_VALUATION_RPC_NAMES.context
  ].join(",") === "p_period_start",
  "exact context arg key: p_period_start",
);
assert(
  COST_PERIOD_VALUATION_RPC_NAMES.history ===
    "rpc_get_cost_period_governance_history",
  "exact History RPC",
);
assert(
  COST_PERIOD_VALUATION_RPC_ARG_KEYS[
    COST_PERIOD_VALUATION_RPC_NAMES.history
  ].join(",") === "p_period_start",
  "exact History args",
);
assert(
  COST_PERIOD_VALUATION_RPC_NAMES.setValuationDate ===
    "rpc_set_cost_period_valuation_date",
  "exact Set RPC",
);
assert(
  COST_PERIOD_VALUATION_RPC_ARG_KEYS[
    COST_PERIOD_VALUATION_RPC_NAMES.setValuationDate
  ].join(",") ===
    "p_period_start,p_valuation_date,p_reason,p_approval_reference",
  "exact Set args",
);
assert(
  COST_PERIOD_VALUATION_RPC_ALLOWLIST.length === 3,
  "exactly three valuation RPCs allowlisted",
);
assert(
  COST_PERIOD_VALUATION_PERMISSION_TARGET === "module:costing-control-center",
  "permission target is costing-control-center",
);

const ctxArgs = buildGetCostPeriodValuationContextArgs({
  period_start: "2026-08-01",
});
assert(ctxArgs.ok && ctxArgs.params.p_period_start === "2026-08-01", "context builder ok");

const histArgs = buildGetCostPeriodGovernanceHistoryArgs({
  period_start: "2026-08-01",
});
assert(histArgs.ok, "history builder ok");

const setOk = buildSetCostPeriodValuationDateArgs({
  period_start: "2026-08-01",
  period_end: "2026-08-31",
  valuation_date: "2026-08-07",
  reason: "Align with seven-policy effective date",
  approval_reference: "ACC-TEST-REF",
});
assert(
  setOk.ok &&
    setOk.params.p_period_start === "2026-08-01" &&
    setOk.params.p_valuation_date === "2026-08-07" &&
    setOk.params.p_reason.length >= COST_PERIOD_VALUATION_REASON_MIN_LENGTH &&
    setOk.params.p_approval_reference === "ACC-TEST-REF",
  "set builder exact keys",
);

const setExtra = softValidateCostPeriodValuationChange({
  period_start: "2026-08-01",
  period_end: "2026-08-31",
  valuation_date: "2026-08-07",
  reason: "Align with seven-policy effective date",
});
assert(setExtra.ok, "set without approval still ok (optional)");

assert(
  !buildSetCostPeriodValuationDateArgs({
    period_start: "2026-08-01",
    period_end: "2026-08-31",
    valuation_date: "2026-08-07",
    reason: "short",
  }).ok,
  "reason soft validation",
);

assert(
  !buildSetCostPeriodValuationDateArgs({
    period_start: "2026-08-01",
    period_end: "2026-08-31",
    valuation_date: "2026-09-01",
    reason: "Outside August bounds intentionally",
  }).ok,
  "date-range soft validation",
);

assert(
  formatCostPeriodValuationSourceLabel("SYSTEM_DEFAULT") === "System Default" &&
    formatCostPeriodValuationSourceLabel("GOVERNED_MANUAL") === "Governed Manual",
  "source label mapping",
);
assert(
  formatCostPeriodValuationStatusLabel("DRAFT") === "Draft" &&
    formatCostPeriodStatusLabel("OPEN") === "Open" &&
    formatCostPeriodStatusLabel("LOCKED") === "Locked" &&
    formatCostPeriodStatusLabel("CLOSED") === "Closed",
  "status label mapping",
);

const normalized = normalizeCostPeriodValuationContext({
  period_start: "2026-08-01",
  period_end: "2026-08-31",
  period_status: "OPEN",
  valuation_date: "2026-08-01",
  valuation_date_source: "SYSTEM_DEFAULT",
  valuation_date_status: "DRAFT",
  queued_or_running_refresh_count: 0,
});
assert(
  normalized?.valuation_date === "2026-08-01" &&
    normalized.queued_or_running_refresh_count === 0,
  "defensive normalization",
);

assert(
  canChangeCostPeriodValuation(normalized, { canEdit: true }) === true,
  "OPEN period editable with edit permission",
);
assert(
  canChangeCostPeriodValuation(normalized, { canEdit: false }) === false,
  "Change is edit-permission gated",
);
assert(
  canChangeCostPeriodValuation(
    { ...normalized, period_status: "LOCKED" },
    { canEdit: true },
  ) === false,
  "LOCKED period not editable",
);
assert(
  canChangeCostPeriodValuation(
    { ...normalized, queued_or_running_refresh_count: 1 },
    { canEdit: true },
  ) === false,
  "queued refresh blocks change UX",
);

const history = unwrapCostPeriodGovernanceHistoryPayload([
  {
    audit_id: 1,
    event_type: "VALUATION_DATE_SET",
    previous_valuation_date: "2026-08-01",
    new_valuation_date: "2026-08-07",
    reason: "test",
    evidence_json: { nested: true },
    occurred_at: "2026-08-07T10:00:00Z",
  },
]);
assert(
  history.length === 1 &&
    !Object.prototype.hasOwnProperty.call(history[0], "evidence_json"),
  "history normalize omits raw evidence_json",
);

assert(
  COST_PERIOD_VALUATION_CHANGE_WARNING.includes("Future refresh requests"),
  "change warning copy present",
);

const helpersJs = fs.readFileSync(
  path.join(
    root,
    "public/shared/js/costing-suite-cost-period-valuation-helpers.js",
  ),
  "utf8",
);
const ctrlJs = fs.readFileSync(
  path.join(root, "public/shared/js/costing-suite-cost-period-valuation.js"),
  "utf8",
);
assert(
  !ctrlJs.includes('costingFrom("v_cost_periods")') &&
    !ctrlJs.includes("costingFrom('v_cost_periods')") &&
    !ctrlJs.includes(".from(\"v_cost_periods\")") &&
    !ctrlJs.includes("costingFrom("),
  "no v_cost_periods / costingFrom read path in controller",
);
assert(
  !ctrlJs.includes("rpc_request_costing_refresh") &&
    !ctrlJs.includes("create_costing_snapshot") &&
    !ctrlJs.includes("rpc_refresh_cost") &&
    !/rpc_[a-z0-9_]*stage_?03/i.test(ctrlJs),
  "no refresh/Stage03/snapshot mutation builders",
);
assert(
  COST_PERIOD_VALUATION_FORBIDDEN_SUBSTRINGS.includes("v_cost_periods") &&
    COST_PERIOD_VALUATION_FORBIDDEN_SUBSTRINGS.includes(
      "rpc_request_costing_refresh",
    ),
  "forbidden substring inventory present",
);
assert(
  ctrlJs.includes("COST_PERIOD_VALUATION_RPC_NAMES.context") &&
    helpersJs.includes("rpc_get_cost_period_valuation_context"),
  "controller uses context RPC",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll cost-period-valuation helpers smokes passed");
