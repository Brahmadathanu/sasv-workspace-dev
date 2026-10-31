import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isCostingUxConsistencyV1Enabled,
} from "../../public/shared/js/costing-feature-flags.js";
import {
  costingIssueDisplayLabel,
  costingRunBadgeDisplayLabel,
  costingStatusDisplayLabel,
} from "../../public/shared/js/costing-status-labels.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

test("UX consistency flag defaults OFF and accepts exactly string 1", () => {
  for (const value of [null, undefined, "", "0", 1, true, "true"]) {
    assert.equal(isCostingUxConsistencyV1Enabled({ getItem: () => value }), false);
  }
  assert.equal(isCostingUxConsistencyV1Enabled({ getItem: () => "1" }), true);
  assert.equal(isCostingUxConsistencyV1Enabled({ getItem: () => { throw new Error("blocked"); } }), false);
});

test("flag ON maps only confirmed common status families", () => {
  assert.equal(costingStatusDisplayLabel("READY"), "Ready");
  assert.equal(costingStatusDisplayLabel("REVIEW_REQUIRED"), "Review required");
  assert.equal(costingStatusDisplayLabel("BLOCKER"), "Blocked");
  assert.equal(costingStatusDisplayLabel("PARTIAL_SUCCESS"), "Partial");
  assert.equal(costingStatusDisplayLabel("WARN"), "Warning");
});

test("confirmed existing issue labels are shared without changing their codes", () => {
  const code = "MISSING_RM_AND_PM_FOUNDATION";
  assert.equal(costingIssueDisplayLabel(code), "Missing RM and PM foundation");
  assert.equal(code, "MISSING_RM_AND_PM_FOUNDATION");
  assert.equal(costingIssueDisplayLabel("STALE_PM_PURCHASE_RATE"), "Stale purchase rate");
});

test("unknown status and issue codes fall back verbatim", () => {
  assert.equal(costingStatusDisplayLabel("SERVER_ADDED_STATUS"), "SERVER_ADDED_STATUS");
  assert.equal(costingIssueDisplayLabel("SERVER_ADDED_REASON"), "SERVER_ADDED_REASON");
});

test("run badge transforms only the exact known draft pattern", () => {
  assert.equal(costingRunBadgeDisplayLabel("DRAFT run 147 - not approved"), "Draft run 147 — not approved");
  for (const value of [
    "DRAFT run X - not approved",
    "DRAFT run 147: not approved",
    "Approved run 147",
    "Failed - not for pricing",
  ]) assert.equal(costingRunBadgeDisplayLabel(value), value);
});

test("server-provided approval, recalculation, lock and run-status text passes through unchanged", () => {
  for (const value of [
    "Failed - not for pricing",
    "Not for pricing",
    "Locking changes the lock state only.",
    "The server chooses today (India date), or the month's last day if the month has ended.",
  ]) {
    assert.equal(costingStatusDisplayLabel(value), value);
    assert.equal(costingIssueDisplayLabel(value), value);
    assert.equal(costingRunBadgeDisplayLabel(value), value);
  }
});

test("rendering boundaries retain their exact OFF branches", () => {
  const shell = read("public/shared/js/costing-suite-shell.js");
  const control = read("public/shared/js/costing-suite-control-center.js");
  const readiness = read("public/shared/js/costing-suite-readiness.js");
  assert.match(shell, /isCostingUxConsistencyV1Enabled\(\)[\s\S]*\? costingStatusDisplayLabel\(status\)[\s\S]*: status/);
  assert.match(control, /isCostingUxConsistencyV1Enabled\(\)[\s\S]*: row\.action_severity/);
  assert.match(readiness, /if \(isCostingUxConsistencyV1Enabled\(\)\) return costingIssueDisplayLabel\(raw\);[\s\S]*return raw\.replaceAll/);
});

test("raw codes remain in filter, severity ordering, query and CSV paths", () => {
  const shell = read("public/shared/js/costing-suite-shell.js");
  const control = read("public/shared/js/costing-suite-control-center.js");
  assert.match(shell, /filterMatch\(row, "status", ACTIVE_FILTERS\.status\)/);
  assert.match(shell, /keys\.map\(\(k\) => csvEscape\(row\[k\]\)\)/);
  assert.match(control, /severityRank\[normalizeStatus\(a\.action_severity\)\]/);
  assert.match(control, /\.eq\("action_severity", row\.action_severity\)/);
  for (const source of [shell, control]) {
    assert.doesNotMatch(source.match(/function applyFilters[\s\S]*?\n}/)?.[0] || "", /costingStatusDisplayLabel/);
  }
});

test("dead dashboard view mapping is absent while policy manager mapping remains", () => {
  const shell = read("public/shared/js/costing-suite-shell.js");
  assert.doesNotMatch(shell, /dashboard:\s*["']v_costing_pricing_dashboard_summary["']/);
  assert.match(shell, /"policy-manager":\s*"v_costing_policy_manager_sku_overview"/);
  assert.match(shell, /if \(CURRENT_LENS === "dashboard"\)[\s\S]*loadDashboardRows\(ACTIVE_PERIOD_START\)[\s\S]*return;/);
});

test("protected write-screen modules do not import or call the display mapper", () => {
  for (const rel of [
    "public/shared/js/costing-approval-screen.js",
    "public/shared/js/costing-recalculation.js",
    "public/shared/js/costing-lock-screen.js",
    "public/shared/js/costing-run-status-screen.js",
  ]) {
    const source = read(rel);
    assert.doesNotMatch(source, /costing-status-labels|costingStatusDisplayLabel|costingIssueDisplayLabel|costingRunBadgeDisplayLabel/);
  }
});
