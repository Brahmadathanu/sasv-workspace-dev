import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LOCK_PERIOD_STATUS_VIEW,
  LOCK_RPC,
  LOCK_STATUS_SELECT,
  buildBatchLockPayload,
  buildSingleLockPayload,
  createCostingLockScreenController,
  lockSuccessLines,
  quarterLabel,
} from "../../public/shared/js/costing-lock-screen.js";
import {
  isCostingApprovalScreenV1Enabled,
  isCostingLockScreenV1Enabled,
  isCostingRecalcWithDateV1Enabled,
  isCostingRunStatusV1Enabled,
  isCostingUxConsistencyV1Enabled,
  isCostingDialogsV1Enabled,
} from "../../public/shared/js/costing-feature-flags.js";
import { FORBIDDEN_RPCS } from "../../public/shared/js/costing-approval-screen.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function node(id, extras = {}) {
  return {
    id, hidden: extras.hidden ?? false, value: extras.value ?? "", textContent: "", innerHTML: "", disabled: false,
    attrs: {}, listeners: {}, focused: false,
    classList: { toggle() {}, contains() { return false; } },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(k, fn) { this.listeners[k] = fn; },
    focus() { this.focused = true; },
  };
}

function harness({ rpcImpl } = {}) {
  const ids = Object.fromEntries([
    "costingLockPanel", "costingLockDialog", "clsPeriodList", "clsCloseQuarterBtn", "clsDialogTitle", "clsDialogIntro",
    "clsSelectedPeriods", "clsLockForm", "clsReason", "clsApprovalReference", "clsFormError", "clsResult",
    "clsCloseBtn", "clsCancelBtn", "clsSubmitBtn",
  ].map((id) => [id, node(id, { hidden: id.includes("Dialog") || id.includes("Error") || id.includes("Result") })]));
  ids.clsReason.value = "Quarter close authorised by board";
  ids.clsApprovalReference.value = "BOARD/2026/Q3";
  const checked = [];
  const doc = {
    getElementById: (id) => ids[id] || null,
    querySelectorAll: () => checked,
  };
  const rows = [{
    period_start: "2026-09-01", period_status: "OPEN", display_label_v2: "Approved",
    pricing_use_label: "Used for pricing", official_valuation_date: "2026-09-30", approved_run_id: 122,
  }, {
    period_start: "2026-08-01", period_status: "OPEN", display_label_v2: "Not approved",
    pricing_use_label: "Not used for pricing", official_valuation_date: null, approved_run_id: null,
  }];
  const queries = [];
  const supabase = { from(view) { queries.push(view); const q = { select(s) { queries.push(s); return q; }, order() { return Promise.resolve({ data: rows, error: null }); } }; return q; } };
  const calls = [];
  let loads = 0;
  const originalFrom = supabase.from;
  supabase.from = (...args) => { loads += 1; return originalFrom(...args); };
  const ctrl = createCostingLockScreenController({
    supabase, doc, isControlCenterRoute: () => true, showToast() {},
    costingRpc: async (name, params) => {
      calls.push({ name, params });
      if (rpcImpl) return rpcImpl(name, params);
      const single = { period_start: params.p_period_start || "2026-09-01", status: "LOCKED", approved_run: 122, official_valuation_date: "2026-09-30", audit_id: 9 };
      return { data: name === LOCK_RPC.batch ? { locked: [single], count: 1 } : single, error: null };
    },
  });
  return { ctrl, ids, rows, queries, calls, checked, get loads() { return loads; } };
}

function markupHarness({ withRunStatus = true } = {}) {
  const inserts = [];
  const anchor = (id) => ({
    id,
    insertAdjacentHTML(position, markup) { inserts.push({ id, position, markup }); },
  });
  const runStatus = anchor("costingRunStatusPanel");
  const approval = anchor("costingApprovalPanel");
  const body = anchor("body");
  const doc = {
    body,
    getElementById(id) {
      if (id === "costingRunStatusPanel" && withRunStatus) return runStatus;
      if (id === "costingApprovalPanel") return approval;
      return null;
    },
  };
  const supabase = {
    from() {
      const query = { select() { return query; }, order() { return Promise.resolve({ data: [], error: null }); } };
      return query;
    },
  };
  const ctrl = createCostingLockScreenController({
    supabase,
    doc,
    isControlCenterRoute: () => true,
    showToast() {},
    costingRpc: async () => ({ data: null, error: null }),
  });
  return { ctrl, inserts };
}

test("lock flag defaults off", () => assert.equal(isCostingLockScreenV1Enabled({ getItem: () => null }), false));
test("lock flag accepts exactly string 1", () => {
  assert.equal(isCostingLockScreenV1Enabled({ getItem: () => "1" }), true);
  for (const value of ["0", 1, true, "true"]) assert.equal(isCostingLockScreenV1Enabled({ getItem: () => value }), false);
});
test("all sixty-four costing flag combinations stay independent", () => {
  for (let bits = 0; bits < 64; bits += 1) {
    const storage = { getItem: (key) => ({ COSTING_LOCK_SCREEN_V1: bits & 1 ? "1" : null, COSTING_APPROVAL_SCREEN_V1: bits & 2 ? "1" : null, COSTING_RECALC_WITH_DATE_V1: bits & 4 ? "1" : null, COSTING_RUN_STATUS_V1: bits & 8 ? "1" : null, COSTING_UX_CONSISTENCY_V1: bits & 16 ? "1" : null, COSTING_DIALOGS_V1: bits & 32 ? "1" : null })[key] };
    assert.equal(isCostingLockScreenV1Enabled(storage), Boolean(bits & 1));
    assert.equal(isCostingApprovalScreenV1Enabled(storage), Boolean(bits & 2));
    assert.equal(isCostingRecalcWithDateV1Enabled(storage), Boolean(bits & 4));
    assert.equal(isCostingRunStatusV1Enabled(storage), Boolean(bits & 8));
    assert.equal(isCostingUxConsistencyV1Enabled(storage), Boolean(bits & 16));
    assert.equal(isCostingDialogsV1Enabled(storage), Boolean(bits & 32));
  }
});
test("quarter grouping uses period text", () => { assert.equal(quarterLabel("2026-09-01"), "2026 Q3"); assert.equal(quarterLabel("2026-10-01"), "2026 Q4"); });
test("single payload has exact arguments", () => assert.deepEqual(buildSingleLockPayload("2026-09-01", " reason ", " ref "), { p_period_start: "2026-09-01", p_reason: "reason", p_approval_reference: "ref" }));
test("batch payload sends only supplied ticked months", () => assert.deepEqual(buildBatchLockPayload(["2026-07-01", "2026-09-01"], " reason ", " ref "), { p_period_starts: ["2026-07-01", "2026-09-01"], p_reason: "reason", p_approval_reference: "ref" }));
test("single success preserves returned period and bigint run id", () => assert.deepEqual(lockSuccessLines({ period_start: "2026-09-01", approved_run: "9223372036854775806", official_valuation_date: "2026-09-30", audit_id: 8 }), ["2026-09-01: LOCKED; approved run 9223372036854775806; official date 2026-09-30; audit 8"]));
test("batch success renders every returned line", () => assert.equal(lockSuccessLines({ locked: [{ period_start: "2026-07-01", approved_run: 120, official_valuation_date: "2026-07-31", audit_id: 1 }, { period_start: "2026-08-01", approved_run: 121, official_valuation_date: "2026-08-31", audit_id: 2 }] }).length, 2));
test("route and select constants are exact", () => { assert.equal(LOCK_PERIOD_STATUS_VIEW, "v_costing_pricing_period_run_status"); assert.equal(LOCK_STATUS_SELECT, "period_start,period_status,display_label,display_label_v2,official_valuation_date,approved_run_id,pricing_use_label"); });
test("mount reads status view and renders all months unticked", async () => { const h = harness(); h.ctrl.mount(); await h.ctrl.reload(); assert.equal(h.queries[0], LOCK_PERIOD_STATUS_VIEW); assert.match(h.ids.clsPeriodList.innerHTML, /type="checkbox"/); assert.doesNotMatch(h.ids.clsPeriodList.innerHTML, /checked/); });
test("server values and Not approved render unchanged", async () => { const h = harness(); await h.ctrl.reload(); assert.match(h.ids.clsPeriodList.innerHTML, /Run 122/); assert.match(h.ids.clsPeriodList.innerHTML, /Not approved/); assert.match(h.ids.clsPeriodList.innerHTML, /2026-09-30/); });
test("batch dialog lists exact selected period_start values", () => { const h = harness(); h.ctrl.openBatch(["2026-07-01", "2026-09-01"]); assert.match(h.ids.clsSelectedPeriods.innerHTML, /2026-07-01/); assert.match(h.ids.clsSelectedPeriods.innerHTML, /2026-09-01/); });
test("single dialog contains exception and fixed reminder wording", () => { const h = harness(); h.ctrl.openSingle("2026-09-01"); assert.match(h.ids.clsDialogIntro.innerHTML, /Normally months are locked together at quarter close/); assert.match(h.ids.clsDialogIntro.innerHTML, /server does not yet check this/); });
test("batch dialog contains state-only and all-or-nothing wording", () => { const h = harness(); h.ctrl.openBatch(["2026-09-01"]); assert.match(h.ids.clsDialogIntro.innerHTML, /does not change any date, run or price/); assert.match(h.ids.clsDialogIntro.innerHTML, /All or nothing/); });
test("batch submit calls only batch route with exact payload", async () => { const h = harness(); h.ctrl.openBatch(["2026-09-01"]); await h.ctrl.submit(); assert.deepEqual(h.calls[0], { name: LOCK_RPC.batch, params: { p_period_starts: ["2026-09-01"], p_reason: "Quarter close authorised by board", p_approval_reference: "BOARD/2026/Q3" } }); });
test("single submit calls only exception route with exact payload", async () => { const h = harness(); h.ctrl.openSingle("2026-09-01"); await h.ctrl.submit(); assert.equal(h.calls[0].name, LOCK_RPC.single); assert.equal(h.calls[0].params.p_period_start, "2026-09-01"); });
test("double submit while pending sends one call", async () => { let release; const gate = new Promise((r) => { release = r; }); const h = harness({ rpcImpl: async () => { await gate; return { data: { period_start: "2026-09-01", approved_run: 122, official_valuation_date: "2026-09-30", audit_id: 1 }, error: null }; } }); h.ctrl.openSingle("2026-09-01"); const first = h.ctrl.submit(); const second = h.ctrl.submit(); assert.equal(h.calls.length, 1); release(); await Promise.all([first, second]); });
test("batch failure shows no locked result", async () => { const h = harness({ rpcImpl: async () => ({ data: null, error: { message: "W2_BATCH_MIXED_QUARTER: no" } }) }); h.ctrl.openBatch(["2026-09-01"]); await h.ctrl.submit(); assert.equal(h.ids.clsResult.hidden, true); assert.match(h.ids.clsFormError.textContent, /one calendar quarter/); });
test("success displays result and reloads status exactly once", async () => { const h = harness(); h.ctrl.openSingle("2026-09-01"); const before = h.loads; await h.ctrl.submit(); assert.equal(h.loads, before + 1); assert.equal(h.ids.clsResult.hidden, false); assert.match(h.ids.clsResult.textContent, /approved run 122/); });
test("successful lock keeps Submit disabled until either dialog mode is reopened", async () => { const h = harness(); h.ctrl.openSingle("2026-09-01"); await h.ctrl.submit(); assert.equal(h.ids.clsSubmitBtn.disabled, true); assert.equal(h.ids.clsResult.hidden, false); await h.ctrl.submit(); assert.equal(h.calls.length, 1); assert.equal(h.ids.clsReason.value, "Quarter close authorised by board"); h.ctrl.openBatch(["2026-09-01"]); assert.equal(h.ids.clsSubmitBtn.disabled, false); });
test("a successful retry clears the previous attempt error", async () => { let attempt = 0; const h = harness({ rpcImpl: async () => (++attempt === 1 ? { data: null, error: { message: "W2_ACTIVE_RUN: wait" } } : { data: { period_start: "2026-09-01", approved_run: 122, official_valuation_date: "2026-09-30", audit_id: 1 }, error: null }) }); h.ctrl.openSingle("2026-09-01"); await h.ctrl.submit(); assert.equal(h.ids.clsFormError.hidden, false); await h.ctrl.submit(); assert.equal(h.ids.clsFormError.hidden, true); assert.equal(h.ids.clsFormError.textContent, ""); assert.equal(h.ids.clsResult.hidden, false); });
test("lock panel inserts before the run-status panel when available", () => { const h = markupHarness(); h.ctrl.mount(); assert.deepEqual(h.inserts[0] && { id: h.inserts[0].id, position: h.inserts[0].position }, { id: "costingRunStatusPanel", position: "beforebegin" }); assert.match(h.inserts[0].markup, /id="costingLockPanel"/); });
test("lock panel falls back to after the approval panel", () => { const h = markupHarness({ withRunStatus: false }); h.ctrl.mount(); assert.deepEqual(h.inserts[0] && { id: h.inserts[0].id, position: h.inserts[0].position }, { id: "costingApprovalPanel", position: "afterend" }); assert.match(h.inserts[0].markup, /id="costingLockPanel"/); });
test("source contains no Date arithmetic or owner call and preserves OFF safety contracts", () => { const src = read("public/shared/js/costing-lock-screen.js"); assert.doesNotMatch(src, /new Date|Date\.now|get.*owner|is.*owner/i); assert.ok(FORBIDDEN_RPCS.includes(LOCK_RPC.batch)); assert.ok(FORBIDDEN_RPCS.includes(LOCK_RPC.single)); const sw = read("public/sw.js"); assert.match(sw, /hub-cache-v383/); const html = read("public/shared/costing-control-center.html"); assert.doesNotMatch(html, /costingLockPanel|costingLockDialog/); const shell = read("public/shared/js/costing-suite-shell.js"); assert.match(shell, /const costingLockScreenCtrl = isCostingLockScreenV1Enabled\(\)/); });
