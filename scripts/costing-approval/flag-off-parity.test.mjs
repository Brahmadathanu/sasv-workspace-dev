import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RUN_STATUS_SELECT_V1,
} from "../../public/shared/js/costing-run-status-badge.js";
import { FORBIDDEN_RPCS } from "../../public/shared/js/costing-approval-screen.js";
import { isCostingApprovalScreenV1Enabled } from "../../public/shared/js/costing-feature-flags.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

test("flag off by default", () => {
  assert.equal(isCostingApprovalScreenV1Enabled({ getItem: () => null }), false);
});

test("flag-off badge select list remains the original ten columns", () => {
  assert.equal(
    RUN_STATUS_SELECT_V1,
    "period_start,display_state,display_label,displayed_run_id,approved_run_id,approved_at,approved_by,newer_draft_run_id,active_run_id,active_run_status",
  );
});

test("approval module never calls forbidden RPCs", () => {
  const src = read("public/shared/js/costing-approval-screen.js");
  const callSites = [...src.matchAll(/costingRpc\(([^,\n]+)[,\)]/g)].map(
    (m) => m[1].trim(),
  );
  assert.deepEqual(
    [...new Set(callSites)].sort(),
    ["RPC.preview", "rpcName"].sort(),
  );
  for (const name of FORBIDDEN_RPCS) {
    assert.equal(
      callSites.some((site) => site.includes(name) || site === `"${name}"`),
      false,
      `${name} must not be a costingRpc argument`,
    );
  }
  assert.ok(FORBIDDEN_RPCS.includes("rpc_costing_lock_periods_for_close"));
  assert.ok(FORBIDDEN_RPCS.includes("rpc_set_cost_period_valuation_date"));
  assert.ok(FORBIDDEN_RPCS.includes("rpc_costing_health_check"));
});

test("shell mounts approval controller only behind the flag helper", () => {
  const shell = read("public/shared/js/costing-suite-shell.js");
  assert.match(shell, /isCostingApprovalScreenV1Enabled/);
  assert.match(
    shell,
    /const costingApprovalScreenCtrl = isCostingApprovalScreenV1Enabled\(\)/,
  );
});

test("refresh and valuation setter modules remain present and untouched by approval deny-list usage", () => {
  const shell = read("public/shared/js/costing-suite-shell.js");
  assert.match(shell, /rpc_request_costing_refresh/);
  assert.match(shell, /rpc_get_costing_refresh_status/);
  const helpers = read(
    "public/shared/js/costing-suite-cost-period-valuation-helpers.js",
  );
  assert.match(helpers, /rpc_set_cost_period_valuation_date/);
  const approval = read("public/shared/js/costing-approval-screen.js");
  assert.doesNotMatch(approval, /costingRpc\([^\n]*rpc_set_cost_period_valuation_date/);
  assert.ok(FORBIDDEN_RPCS.includes("rpc_set_cost_period_valuation_date"));
});
