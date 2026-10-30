import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RUN_DISPLAY_STATUS_SELECT,
  RUN_DISPLAY_STATUS_VIEW,
  RUN_STATUS_READ_RPCS,
  RUN_STATUS_SCOPE,
  createCostingRunStatusScreenController,
  explainRunFailure,
  healthRunLabel,
} from "../../public/shared/js/costing-run-status-screen.js";
import { FORBIDDEN_RPCS } from "../../public/shared/js/costing-approval-screen.js";
import { isCostingRunStatusV1Enabled } from "../../public/shared/js/costing-feature-flags.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function element(id, hidden = false) {
  return {
    id, hidden, innerHTML: "", textContent: "", disabled: false, attrs: {}, listeners: {},
    classList: { toggle() {} },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(k, fn) { this.listeners[k] = fn; },
  };
}

const OCTOBER_RUNS = [{
  refresh_run_id: 151,
  valuation_date: "2026-10-31",
  overall_status: "SUCCESS",
  source_trigger: "UI_TOOLBAR",
  requested_at: "2026-10-30T10:00:00Z",
  finished_at: "2026-10-30T10:05:00Z",
  display_status: "Draft",
  display_label: "Draft - not for pricing",
  pricing_use_label: "Not for pricing",
}, {
  refresh_run_id: 147,
  valuation_date: "2026-10-22",
  overall_status: "FAILED",
  source_trigger: "CRON",
  requested_at: "2026-10-22T09:00:00Z",
  finished_at: "2026-10-22T09:02:00Z",
  display_status: "Failed",
  display_label: "Failed - not for pricing",
  pricing_use_label: "Not for pricing",
}];

const RUN_147 = {
  refresh_run_id: 147,
  period_start: "2026-10-01",
  error_stage_code: "02_MATERIAL_SNAPSHOT",
  error_message: "NO_EFFECTIVE_PM_BOM_REVISION: valuation_date=2026-10-22 missing_count=3 missing_sku_ids=41,105,846",
  stages: [{ stage_order: 1, stage_code: "01_ENSURE_PERIOD", stage_name: "Ensure period", stage_status: "SUCCESS", output_json: { hidden: true }, counts: { hidden: 1 } }, { stage_order: 2, stage_code: "02_MATERIAL_SNAPSHOT", stage_name: "Material snapshot", stage_status: "FAILED", error_message: "failed", output_json: { secret: true }, counts: { blocked: 3 } }],
};

const HEALTH = [
  { severity: "ERROR", check_code: "JOB_RECENT_FAILURE", period_start: null, run_id: 66, detail: "Cron job failed." },
  { severity: "WARN", check_code: "REFERENCE_FINGERPRINT_DRIFT", period_start: "2026-10-01", run_id: 143, detail: "Reference drift found." },
  { severity: "INFO", check_code: "SYSTEM_OK", period_start: null, run_id: null, detail: "Other checks passed." },
];

function harness({ runs = OCTOBER_RUNS, rpcImpl, periodRef = { value: "2026-10-01" } } = {}) {
  const ids = Object.fromEntries(["costingRunStatusPanel", "crsRunList", "crsRunDetail", "crsHealthRefresh", "crsHealthList"].map((id) => [id, element(id, id === "costingRunStatusPanel")]));
  const doc = { getElementById: (id) => ids[id] || null };
  const queryCalls = [];
  const supabase = {
    from(view) {
      queryCalls.push(["from", view]);
      const query = {
        select(fields) { queryCalls.push(["select", fields]); return query; },
        eq(column, value) { queryCalls.push(["eq", column, value]); return query; },
        order(column, options) { queryCalls.push(["order", column, options]); return Promise.resolve({ data: runs, error: null }); },
      };
      return query;
    },
  };
  const rpcCalls = [];
  const ctrl = createCostingRunStatusScreenController({
    supabase,
    costingRpc: async (name, params) => {
      rpcCalls.push({ name, params });
      if (rpcImpl) return rpcImpl(name, params, rpcCalls);
      if (name === RUN_STATUS_READ_RPCS[0]) return { data: [RUN_147], error: null };
      if (name === RUN_STATUS_READ_RPCS[1]) return { data: HEALTH, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
    getActivePeriodStart: () => periodRef.value,
    isControlCenterRoute: () => true,
    stageLabels: { "02_MATERIAL_SNAPSHOT": "Material snapshot fallback" },
    formatDate: (value) => `DATE(${value})`,
    formatDateTime: (value) => `TIME(${value})`,
    doc,
  });
  return { ctrl, ids, queryCalls, rpcCalls, periodRef };
}

test("run-status flag defaults OFF and requires exact string 1", () => {
  assert.equal(isCostingRunStatusV1Enabled({ getItem: () => null }), false);
  assert.equal(isCostingRunStatusV1Enabled({ getItem: () => "1" }), true);
  assert.equal(isCostingRunStatusV1Enabled({ getItem: () => 1 }), false);
});

test("read allow-list is exact and approval forbidden list is byte-identical", () => {
  assert.deepEqual(RUN_STATUS_READ_RPCS, ["rpc_get_costing_refresh_status", "rpc_costing_health_check"]);
  assert.deepEqual(FORBIDDEN_RPCS, ["rpc_costing_approve_run", "rpc_costing_supersede_approved_run", "rpc_costing_finalize_monthend_run", "rpc_costing_authorise_supersession", "rpc_set_cost_period_valuation_date", "rpc_costing_lock_periods_for_close", "rpc_costing_lock_period", "rpc_costing_health_check"]);
});

test("run-list view and select string are exact", () => {
  assert.equal(RUN_DISPLAY_STATUS_VIEW, "v_costing_pricing_run_display_status");
  assert.equal(RUN_DISPLAY_STATUS_SELECT, "refresh_run_id,valuation_date,overall_status,source_trigger,requested_at,finished_at,display_status,display_label,pricing_use_label");
});

test("mount queries active month and orders newest run first", async () => {
  const h = harness();
  h.ctrl.mount();
  await h.ctrl.reload();
  assert.deepEqual(h.queryCalls.slice(-4), [["from", RUN_DISPLAY_STATUS_VIEW], ["select", RUN_DISPLAY_STATUS_SELECT], ["eq", "period_start", "2026-10-01"], ["order", "refresh_run_id", { ascending: false }]]);
});

test("run cards preserve server display and pricing labels", async () => {
  const h = harness(); await h.ctrl.reload();
  assert.match(h.ids.crsRunList.innerHTML, /Failed - not for pricing/);
  assert.match(h.ids.crsRunList.innerHTML, /Not for pricing/);
  assert.doesNotMatch(h.ids.crsRunList.innerHTML, /never used for pricing/);
});

test("zero visible rows use the permission-safe empty copy", async () => {
  const h = harness({ runs: [] }); await h.ctrl.reload();
  assert.match(h.ids.crsRunList.innerHTML, /No runs visible for this month/);
});

test("only FAILED cards expose a detail action", async () => {
  const h = harness(); await h.ctrl.reload();
  assert.equal((h.ids.crsRunList.innerHTML.match(/data-crs-detail=/g) || []).length, 1);
});

test("detail rejects a run id absent from the loaded list", async () => {
  const h = harness(); await h.ctrl.reload();
  assert.equal(await h.ctrl.openRunDetail(999), false);
  assert.equal(h.rpcCalls.filter((call) => call.name === RUN_STATUS_READ_RPCS[0]).length, 0);
});

test("detail rejects a non-failed loaded run", async () => {
  const h = harness(); await h.ctrl.reload();
  assert.equal(await h.ctrl.openRunDetail(151), false);
});

test("detail sends exact arguments and reads data[0]", async () => {
  const h = harness(); await h.ctrl.reload(); await h.ctrl.openRunDetail(147);
  assert.deepEqual(h.rpcCalls.find((call) => call.name === RUN_STATUS_READ_RPCS[0]), { name: "rpc_get_costing_refresh_status", params: { p_refresh_run_id: 147, p_period_start: "2026-10-01", p_requested_scope: RUN_STATUS_SCOPE } });
  assert.match(h.ids.crsRunDetail.innerHTML, /Material snapshot/);
});

test("empty detail array shows Run details not found", async () => {
  const h = harness({ rpcImpl: async (name) => name === RUN_STATUS_READ_RPCS[0] ? { data: [], error: null } : { data: HEALTH, error: null } });
  await h.ctrl.reload(); await h.ctrl.openRunDetail(147);
  assert.match(h.ids.crsRunDetail.innerHTML, /Run details not found/);
});

test("detail discards a row from another period", async () => {
  const h = harness({ rpcImpl: async (name) => name === RUN_STATUS_READ_RPCS[0] ? { data: [{ ...RUN_147, period_start: "2026-09-01" }], error: null } : { data: HEALTH, error: null } });
  await h.ctrl.reload(); assert.equal(await h.ctrl.openRunDetail(147), false);
  assert.doesNotMatch(h.ids.crsRunDetail.innerHTML, /Server message/);
});

test("detail discards a stale response after period change", async () => {
  let release; const gate = new Promise((resolve) => { release = resolve; });
  const h = harness({ rpcImpl: async (name) => { if (name === RUN_STATUS_READ_RPCS[0]) { await gate; return { data: [RUN_147], error: null }; } return { data: HEALTH, error: null }; } });
  await h.ctrl.reload(); const detail = h.ctrl.openRunDetail(147); h.periodRef.value = "2026-11-01"; release();
  assert.equal(await detail, false);
});

test("run 147 mapping uses existing formatter and preserves server message", () => {
  const mapped = explainRunFailure(RUN_147.error_message, (value) => `DATE(${value})`);
  assert.equal(mapped.text, "No packing-material BOM was in force on DATE(2026-10-22) for 3 product(s): SKU 41, 105, 846. This run was not used for pricing.");
  assert.equal(mapped.serverMessage, RUN_147.error_message);
});

test("run 110 fixture maps one SKU", () => {
  const message = "NO_EFFECTIVE_PM_BOM_REVISION: valuation_date=2026-09-10 missing_count=1 missing_sku_ids=114";
  assert.match(explainRunFailure(message, (value) => value).text, /1 product\(s\): SKU 114/);
});

test("near-match and unknown failures pass through unchanged", () => {
  for (const message of ["NO_EFFECTIVE_PM_BOM_REVISION: valuation_date=2026-9-10 missing_count=1 missing_sku_ids=114", "Unknown server failure"]) {
    const result = explainRunFailure(message);
    assert.equal(result.text, message); assert.equal(result.serverMessage, message); assert.equal(result.mapped, false);
  }
});

test("detail renders stage chips but never output_json or counts", async () => {
  const h = harness(); await h.ctrl.reload(); await h.ctrl.openRunDetail(147);
  assert.match(h.ids.crsRunDetail.innerHTML, /Ensure period · SUCCESS/);
  assert.match(h.ids.crsRunDetail.innerHTML, /Material snapshot · FAILED/);
  assert.doesNotMatch(h.ids.crsRunDetail.innerHTML, /output_json|counts|secret|blocked/);
});

test("health rows stay in returned order with exact fields", async () => {
  const h = harness(); await h.ctrl.reloadHealth(); const html = h.ids.crsHealthList.innerHTML;
  assert.ok(html.indexOf("JOB_RECENT_FAILURE") < html.indexOf("REFERENCE_FINGERPRINT_DRIFT"));
  assert.ok(html.indexOf("REFERENCE_FINGERPRINT_DRIFT") < html.indexOf("SYSTEM_OK"));
  assert.match(html, /Cron job failed/); assert.match(html, /2026-10-01/);
});

test("JOB_ run ids are labelled Job; other run ids are Run", () => {
  assert.equal(healthRunLabel(HEALTH[0]), "Job 66");
  assert.equal(healthRunLabel(HEALTH[1]), "Run 143");
});

test("Check again calls only health RPC and does not poll", async () => {
  const h = harness(); await h.ctrl.reloadHealth(); await h.ctrl.reloadHealth();
  assert.deepEqual(h.rpcCalls.map((call) => call.name), [RUN_STATUS_READ_RPCS[1], RUN_STATUS_READ_RPCS[1]]);
});

test("health double click while loading sends one call", async () => {
  let release; const gate = new Promise((resolve) => { release = resolve; });
  const h = harness({ rpcImpl: async () => { await gate; return { data: HEALTH, error: null }; } });
  const first = h.ctrl.reloadHealth(); const second = h.ctrl.reloadHealth();
  assert.equal(h.rpcCalls.length, 1); release(); await Promise.all([first, second]);
});

test("flag-OFF shell path leaves static panel hidden and has no controller calls", () => {
  const shell = read("public/shared/js/costing-suite-shell.js");
  const html = read("public/shared/costing-control-center.html");
  assert.match(shell, /const costingRunStatusScreenCtrl = isCostingRunStatusV1Enabled\(\)/);
  assert.match(html, /id="costingRunStatusPanel"[\s\S]*class="cas-panel hidden"[\s\S]*hidden/);
});

test("controller source has no write RPCs, polling, Date arithmetic, output_json or counts rendering", () => {
  const source = read("public/shared/js/costing-run-status-screen.js");
  assert.doesNotMatch(source, /rpc_(request|approve|finalize|lock|recalculation|preview)/i);
  assert.doesNotMatch(source, /setInterval|setTimeout|new Date|Date\.now/);
  assert.doesNotMatch(source, /stage\.output_json|stage\.counts/);
});
