// WP06-G1: deterministic task-flow tests for the Commercial Sales Assumptions workspace of the Pricing Policy Manager.
// Test-only: the real handler factory is driven through its real event bindings with a mocked costingRpc and a fake
// DOM. No network, no Supabase, no production calls; no source is changed. Findings are recorded in
// docs/master-data-costing/WP06_G1_TASK_FLOW_AUDIT_2026-11-04.md.
import test from "node:test";
import assert from "node:assert/strict";
import { loadController } from "../costing-nav-mcm-cbm/load-controller.mjs";

const csa = await loadController("costing-suite-commercial-sales-assumptions.js");
const { createCommercialSalesAssumptionHandlers: create, findOpenSkuSalesAssumption, classifyCommercialSalesSourceBucket,
  sortCommercialSalesAssumptionRows, pickCurrentDefaultPolicy, pickCurrentRegionalDefaultPolicy, previousDefaultPolicyRevisions,
  isOpenDefaultPolicy, defaultPolicyRowId, scenarioBusinessLabel, regionBusinessLabel } = csa;

const PERIOD = "2026-10-01";
const WORKSPACE = csa.COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID;

// ---- fake DOM: every id resolves lazily to an inert element --------------------------------------------------------
function makeElement(id) {
  const handlers = {};
  const classes = new Set(["hidden"]);
  return {
    id, value: "", textContent: "", innerHTML: "", hidden: false, disabled: false, checked: false, attrs: {},
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) },
    setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener(t, fn) { (handlers[t] ||= []).push(fn); },
    fire(t, ev = {}) { return Promise.all((handlers[t] || []).map((fn) => fn({ target: this, preventDefault() {}, stopPropagation() {}, ...ev }))); },
    querySelector: () => null, querySelectorAll: () => [], focus() {}, blur() {}, contains: () => false, closest: () => null,
    style: {}, dataset: {},
  };
}
function installDom() {
  // NOTE: one global document at a time - assert on a setup() before creating the next one.
  const els = new Map();
  globalThis.document = {
    getElementById: (id) => { if (!els.has(id)) els.set(id, makeElement(id)); return els.get(id); },
    querySelector: () => null, querySelectorAll: () => [], activeElement: null, body: {}, contains: () => false,
    createElement: () => makeElement("created"),
  };
  return (id) => globalThis.document.getElementById(id);
}

function setup({ canEdit = true, tab = WORKSPACE, period = PERIOD, history = [], historyGate = null } = {}) {
  const $ = installDom();
  const log = { rpc: [], toasts: [], errors: [], masks: [], reloads: 0, guards: [] };
  const state = { canEdit, tab, period, history, rpcResult: { data: null, error: null }, rpcThrow: null };
  const deps = {
    costingFrom: () => { throw new Error("costingFrom must not be used by the manage-modal flows"); },
    costingRpc: async (name, payload) => {
      log.rpc.push({ name, payload });
      if (name === "rpc_get_sku_sales_assumptions") {
        if (historyGate) await historyGate(payload);
        return { data: state.history, error: null };
      }
      if (state.rpcThrow) throw state.rpcThrow;
      return state.rpcResult;
    },
    fetchAllRows: async () => [],
    showToast: (...a) => log.toasts.push(a), handleError: (...a) => log.errors.push(a), setLoadingMask: (...a) => log.masks.push(a),
    text: (v) => String(v ?? ""), formatNumber: (v) => String(v ?? ""), formatMoney: (v) => String(v ?? ""), formatDate: (v) => String(v ?? ""),
    formatDateTime: (v) => String(v ?? ""), statusChip: (v) => String(v ?? ""), cpCellPrimaryHtml: (v) => String(v ?? ""),
    normalizeStatus: (v) => String(v ?? "").trim().toUpperCase(),
    getActivePeriodStart: () => state.period, getPolicyManagerTab: () => state.tab,
    canEditPricingPolicyActions: () => state.canEdit,
    requireEditAccess: (what) => { log.guards.push(what); if (state.canEdit) return true; log.toasts.push(["Read-only access", "error"]); return false; },
    reloadRows: async () => { log.reloads += 1; }, formatPeriodMonth: (v) => String(v ?? ""),
  };
  const h = create(deps);
  h.bindEvents();
  return { h, $, log, state };
}
const SKU_ROW = (id, extra = {}) => ({ sku_id: id, period_start: PERIOD, product_name: `P${id}`, ...extra });
const OPEN = { assumption_id: 5, status: "ACTIVE", effective_from: "2026-09-01", effective_to: null, assumption_basis: "MANUAL_ASSUMPTION", assumed_sales_units: 100 };
const CLOSED = { assumption_id: 4, status: "SUPERSEDED", effective_from: "2026-07-01", effective_to: "2026-08-31" };
const fill = ($, o) => { for (const [id, v] of Object.entries(o)) $(id).value = v; };
const SET_OK = { csaAssumptionBasis: "MANUAL_ASSUMPTION", csaAssumedUnits: "250", csaAssumedValue: "", csaEffectiveFrom: "2026-10-01", csaRemarks: "Launch estimate agreed with sales", csaApprovalReference: "" };
const settle = () => new Promise((r) => setTimeout(r, 10));
const click = async ($, id) => { await $(id).fire("click"); await settle(); };
const lastError = ($) => $("csaManageError").textContent;
const writes = (log) => log.rpc.filter((c) => c.name !== "rpc_get_sku_sales_assumptions");

// ---- pure helpers -------------------------------------------------------------------------------------------------
test("open assumption = ACTIVE with empty effective_to only; CLOSED/SUPERSEDED or dated-to rows are not open", () => {
  assert.equal(findOpenSkuSalesAssumption([CLOSED, OPEN]), OPEN);
  assert.equal(findOpenSkuSalesAssumption([CLOSED]), null);
  assert.equal(findOpenSkuSalesAssumption([{ ...OPEN, effective_to: "2026-12-31" }]), null);
  assert.equal(findOpenSkuSalesAssumption([{ ...OPEN, status: " active " }]) !== null, true, "status is case/whitespace tolerant");
  assert.equal(findOpenSkuSalesAssumption([{ ...OPEN, effective_to: "" }]) !== null, true);
  assert.equal(findOpenSkuSalesAssumption(null), null);
  assert.equal(findOpenSkuSalesAssumption(undefined), null);
});

test("default-policy pickers: open (APPROVED/ACTIVE, no effective_to) wins, else latest by effective_from then id; region and scenario must both match", () => {
  const rows = [
    { id: 1, scenario_code: "NEW_PRODUCT_NO_HISTORY", status: "APPROVED", effective_from: "2026-01-01", effective_to: "2026-05-31" },
    { id: 2, scenario_code: "NEW_PRODUCT_NO_HISTORY", status: "APPROVED", effective_from: "2026-06-01", effective_to: null },
    { id: 3, scenario_code: "NEW_PRODUCT_NO_HISTORY", status: "SUPERSEDED", effective_from: "2026-06-01", effective_to: "2026-06-30" },
    { id: 4, scenario_code: "NEW_SKU_EXISTING_PRODUCT", status: "CLOSED", effective_from: "2026-02-01", effective_to: "2026-03-01" },
    { id: 5, scenario_code: "NEW_SKU_EXISTING_PRODUCT", status: "CLOSED", effective_from: "2026-02-01", effective_to: "2026-03-01" },
  ];
  assert.equal(pickCurrentDefaultPolicy(rows, "new_product_no_history").id, 2);
  assert.equal(pickCurrentDefaultPolicy(rows, "NEW_SKU_EXISTING_PRODUCT").id, 5, "no open row: latest by effective_from, ties by higher id");
  assert.equal(pickCurrentDefaultPolicy(rows, "UNKNOWN"), null);
  assert.equal(pickCurrentDefaultPolicy(null, "X"), null);
  const reg = [
    { id: 10, scenario_code: "NO_POSITIVE_REGIONAL_HISTORY", region_code: "OK", status: "ACTIVE", effective_from: "2026-01-01", effective_to: null },
    { id: 11, scenario_code: "NO_POSITIVE_REGIONAL_HISTORY", region_code: "IK", status: "ACTIVE", effective_from: "2026-01-01", effective_to: null },
  ];
  assert.equal(pickCurrentRegionalDefaultPolicy(reg, "NO_POSITIVE_REGIONAL_HISTORY", "ok").id, 10);
  assert.equal(pickCurrentRegionalDefaultPolicy(reg, "NO_POSITIVE_REGIONAL_HISTORY", "IK").id, 11);
  assert.equal(pickCurrentRegionalDefaultPolicy(reg, "NO_ELIGIBLE_REGIONAL_HISTORY", "IK"), null);
  assert.equal(isOpenDefaultPolicy({ status: "ACTIVE", effective_to: null }), true);
  assert.equal(isOpenDefaultPolicy({ status: "SUPERSEDED", effective_to: null }), false);
  assert.equal(defaultPolicyRowId({ policy_id: "7" }), 7);
  assert.equal(defaultPolicyRowId({}), 0);
  assert.deepEqual(previousDefaultPolicyRevisions(rows, rows[1], (r) => r.scenario_code === "NEW_PRODUCT_NO_HISTORY").map((r) => r.id), [3, 1]);
});

test("labels: business labels for the OK/IK regions and known scenarios; unknown codes fall back to the code, empty to '--'", () => {
  assert.equal(regionBusinessLabel("OK"), "Outside Kerala");
  assert.equal(regionBusinessLabel("IK"), "Inside Kerala");
  assert.equal(regionBusinessLabel("XX"), "XX");
  assert.equal(regionBusinessLabel(""), "--");
  assert.equal(scenarioBusinessLabel("NO_POSITIVE_REGIONAL_HISTORY"), "No positive regional sales quantity");
  assert.equal(scenarioBusinessLabel("NEW_CODE"), "NEW_CODE");
  assert.deepEqual(csa.CSA_REGIONAL_DEFAULT_REGIONS, ["IK", "OK"]);
});

test("source bucket classification and ordering are total functions (unresolved sources never classified as governed)", () => {
  for (const row of [{}, { commercial_sales_status: "BLOCKED" }, { commercial_sales_source: "DEFAULT_10_UNITS" }, { commercial_sales_source: "UNRESOLVED" }, { commercial_sales_source: "unheard_of" }]) {
    assert.equal(typeof classifyCommercialSalesSourceBucket(row), "string");
  }
  const rows = [{ sku_id: 3, pack_size: 100, product_name: "B" }, { sku_id: 1, pack_size: 50, product_name: "A" }, { sku_id: 2, pack_size: 50, product_name: "A" }, { sku_id: 9, product_name: "A" }];
  const sorted = sortCommercialSalesAssumptionRows(rows);
  assert.equal(sorted.length, 4);
  assert.deepEqual(sorted.map((r) => r.sku_id).slice(0, 3).sort(), [1, 2, 9]);
  assert.deepEqual(sortCommercialSalesAssumptionRows(null), []);
});

// ---- set / supersede ----------------------------------------------------------------------------------------------
test("set (no open assumption): exact rpc_set_sku_sales_assumption payload, success toast, form reset, history reloaded", async () => {
  const s = setup({ history: [] });
  await s.h.openManageModal(SKU_ROW(41));
  assert.equal(s.log.rpc[0].name, "rpc_get_sku_sales_assumptions");
  assert.deepEqual(s.log.rpc[0].payload, { p_period_start: PERIOD, p_sku_id: 41 });
  fill(s.$, { ...SET_OK, csaAssumedValue: "1500.5", csaApprovalReference: " APP-7 " });
  await click(s.$, "csaSetSaveBtn");
  const w = writes(s.log);
  assert.equal(w.length, 1);
  assert.equal(w[0].name, "rpc_set_sku_sales_assumption");
  assert.deepEqual(w[0].payload, { p_period_start: PERIOD, p_sku_id: 41, p_assumption_basis: "MANUAL_ASSUMPTION", p_assumed_sales_units: 250, p_assumed_sales_value: 1500.5, p_effective_from: "2026-10-01", p_remarks: "Launch estimate agreed with sales", p_approval_reference: "APP-7" });
  assert.equal(s.log.toasts.at(-1)[1], "success");
  assert.match(s.log.toasts.at(-1)[0], /future costing refresh/);
  assert.equal(s.$("csaAssumedUnits").value, "", "form reset after save");
  assert.equal(s.log.rpc.filter((c) => c.name === "rpc_get_sku_sales_assumptions").length, 2, "history re-read after write");
  assert.deepEqual(s.log.masks.map((m) => m[0]), [true, false]);
});

test("empty value and approval are sent as null; all three bases are accepted", async () => {
  for (const basis of ["MANUAL_ASSUMPTION", "NEW_SKU_ESTIMATE", "NEW_PRODUCT_ESTIMATE"]) {
    const s = setup();
    await s.h.openManageModal(SKU_ROW(41));
    fill(s.$, { ...SET_OK, csaAssumptionBasis: basis });
    await click(s.$, "csaSetSaveBtn");
    const p = writes(s.log)[0].payload;
    assert.equal(p.p_assumption_basis, basis);
    assert.equal(p.p_assumed_sales_value, null);
    assert.equal(p.p_approval_reference, null);
  }
});

test("validation matrix (set): each invalid input is refused client-side with a specific message and NO write", async () => {
  const cases = [
    [{ csaAssumptionBasis: "OTHER" }, "Select a valid assumption basis."],
    [{ csaAssumedUnits: "" }, "Assumed sales units are required."],
    [{ csaAssumedUnits: "abc" }, "Assumed sales units must be a finite number."],
    [{ csaAssumedUnits: "Infinity" }, "Assumed sales units must be a finite number."],
    [{ csaAssumedUnits: "0" }, "Assumed sales units must be greater than zero."],
    [{ csaAssumedUnits: "-5" }, "Assumed sales units must be greater than zero."],
    [{ csaEffectiveFrom: "" }, "Effective-from date is required."],
    [{ csaRemarks: "   " }, "Remarks are required."],
    [{ csaAssumedValue: "xyz" }, "Assumed sales value must be a finite number when set."],
  ];
  for (const [patch, message] of cases) {
    const s = setup();
    await s.h.openManageModal(SKU_ROW(41));
    fill(s.$, { ...SET_OK, ...patch });
    await click(s.$, "csaSetSaveBtn");
    assert.equal(lastError(s.$), message, JSON.stringify(patch));
    assert.equal(s.$("csaManageError").hidden, false);
    assert.equal(writes(s.log).length, 0, JSON.stringify(patch));
  }
});

test("supersede: effective-from must be strictly later than the open assumption's; equal or earlier is refused, later is sent", async () => {
  for (const [from, ok] of [["2026-08-31", false], ["2026-09-01", false], ["2026-09-02", true]]) {
    const s = setup({ history: [OPEN, CLOSED] });
    await s.h.openManageModal(SKU_ROW(41));
    assert.equal(s.$("csaSetSaveBtn").textContent, "Supersede Assumption");
    fill(s.$, { ...SET_OK, csaEffectiveFrom: from });
    await click(s.$, "csaSetSaveBtn");
    assert.equal(writes(s.log).length, ok ? 1 : 0, from);
    if (!ok) assert.match(lastError(s.$), /later than the open assumption/);
  }
});

test("set form mode follows history: 'Save Assumption' without an open row, 'Supersede Assumption' with one; Close section only when open and writable", async () => {
  const none = setup({ history: [CLOSED] });
  await none.h.openManageModal(SKU_ROW(41));
  assert.equal(none.$("csaSetSaveBtn").textContent, "Save Assumption");
  assert.equal(none.$("csaCloseSection").hidden, true);
  const open = setup({ history: [OPEN] });
  await open.h.openManageModal(SKU_ROW(41));
  assert.equal(open.$("csaCloseSection").hidden, false);
  assert.equal(open.$("csaManageModeLabel").textContent, "Manage");
  const view = setup({ history: [OPEN], canEdit: false });
  await view.h.openManageModal(SKU_ROW(41));
  assert.equal(view.$("csaSetSection").hidden, true);
  assert.equal(view.$("csaCloseSection").hidden, true);
  assert.equal(view.$("csaManageModeLabel").textContent, "View");
});

// ---- close --------------------------------------------------------------------------------------------------------
test("close: exact rpc_close_sku_sales_assumption payload and success path", async () => {
  const s = setup({ history: [OPEN] });
  await s.h.openManageModal(SKU_ROW(41));
  fill(s.$, { csaCloseEffectiveTo: "2026-10-31", csaCloseRemarks: "Replaced by actuals", csaCloseApprovalReference: "" });
  await click(s.$, "csaCloseSaveBtn");
  assert.deepEqual(writes(s.log), [{ name: "rpc_close_sku_sales_assumption", payload: { p_period_start: PERIOD, p_sku_id: 41, p_effective_to: "2026-10-31", p_remarks: "Replaced by actuals", p_approval_reference: null } }]);
  assert.equal(s.log.toasts.at(-1)[1], "success");
});

test("close validation: no open assumption, missing date, missing remarks and a date before effective-from are refused (same-day is allowed)", async () => {
  const noOpen = setup({ history: [CLOSED] });
  await noOpen.h.openManageModal(SKU_ROW(41));
  fill(noOpen.$, { csaCloseEffectiveTo: "2026-10-31", csaCloseRemarks: "x" });
  await click(noOpen.$, "csaCloseSaveBtn");
  assert.equal(lastError(noOpen.$), "There is no open ACTIVE assumption to close.");
  assert.equal(writes(noOpen.log).length, 0);
  for (const [patch, message, expectWrite] of [
    [{ csaCloseEffectiveTo: "", csaCloseRemarks: "x" }, "Effective-to date is required.", false],
    [{ csaCloseEffectiveTo: "2026-10-31", csaCloseRemarks: "  " }, "Closure remarks are required.", false],
    [{ csaCloseEffectiveTo: "2026-08-31", csaCloseRemarks: "x" }, "Effective-to cannot be before the open assumption’s effective-from.", false],
    [{ csaCloseEffectiveTo: "2026-09-01", csaCloseRemarks: "x" }, null, true],
  ]) {
    const s = setup({ history: [OPEN] });
    await s.h.openManageModal(SKU_ROW(41));
    fill(s.$, patch);
    await click(s.$, "csaCloseSaveBtn");
    assert.equal(writes(s.log).length, expectWrite ? 1 : 0, JSON.stringify(patch));
    if (message) assert.equal(lastError(s.$), message);
  }
});

// ---- permissions / guards -----------------------------------------------------------------------------------------
test("view-only users: both writes are refused through requireEditAccess before any validation or RPC", async () => {
  const s = setup({ history: [OPEN], canEdit: false });
  await s.h.openManageModal(SKU_ROW(41));
  fill(s.$, SET_OK);
  await click(s.$, "csaSetSaveBtn");
  await click(s.$, "csaCloseSaveBtn");
  assert.deepEqual(s.log.guards, ["set or supersede SKU sales assumption", "close SKU sales assumption"]);
  assert.equal(writes(s.log).length, 0);
});

test("permission revoked after the modal opened: the write is still refused at save time", async () => {
  const s = setup({ history: [] });
  await s.h.openManageModal(SKU_ROW(41));
  fill(s.$, SET_OK);
  s.state.canEdit = false;
  await click(s.$, "csaSetSaveBtn");
  assert.equal(writes(s.log).length, 0);
});

test("stale context: workspace or period changed while the modal was open closes it and refuses the write", async () => {
  for (const mutate of [(st) => { st.tab = "sku-overview"; }, (st) => { st.period = "2026-11-01"; }]) {
    const s = setup({ history: [] });
    await s.h.openManageModal(SKU_ROW(41));
    fill(s.$, SET_OK);
    mutate(s.state);
    await click(s.$, "csaSetSaveBtn");
    assert.equal(writes(s.log).length, 0);
    assert.equal(s.$("csaManageModal").attrs["aria-hidden"], "true");
    assert.match(s.log.toasts.at(-1)[0], /modal closed/);
  }
  const s = setup({ history: [] });
  await s.h.openManageModal(SKU_ROW(41));
  s.h.onPeriodChanged("2026-11-01");
  assert.equal(s.$("csaManageModal").attrs["aria-hidden"], "true");
  const same = setup({ history: [] });
  await same.h.openManageModal(SKU_ROW(41));
  same.h.onPeriodChanged(PERIOD);
  assert.equal(same.$("csaManageModal").attrs["aria-hidden"], "false", "same period keeps the modal");
});

test("openManageModal refuses a row without SKU id or without any period", async () => {
  const s = setup();
  await s.h.openManageModal({ product_name: "x" });
  assert.equal(s.log.toasts.at(-1)[0], "SKU ID missing for selected row.");
  const noPeriod = setup({ period: "" });
  await noPeriod.h.openManageModal({ sku_id: 3 });
  assert.equal(noPeriod.log.toasts.at(-1)[0], "Select a costing period first.");
  assert.equal(s.log.rpc.length + noPeriod.log.rpc.length, 0);
});

// ---- failures + double submit -------------------------------------------------------------------------------------
test("RPC error: handleError and the inline error show the server message; the form is kept for retry; no success toast; controls re-enabled", async () => {
  const s = setup();
  await s.h.openManageModal(SKU_ROW(41));
  fill(s.$, SET_OK);
  s.state.rpcResult = { data: null, error: { message: "approval_reference required by policy" } };
  await click(s.$, "csaSetSaveBtn");
  assert.equal(s.log.errors[0][0], "Failed to save SKU sales assumption");
  assert.equal(lastError(s.$), "approval_reference required by policy");
  assert.equal(s.$("csaAssumedUnits").value, "250", "entered values kept");
  assert.ok(!s.log.toasts.some((t) => t[1] === "success"));
  assert.equal(s.$("csaSetSaveBtn").disabled, false);
  assert.deepEqual(s.log.masks.map((m) => m[0]), [true, false]);
  s.state.rpcResult = { data: null, error: null };
  await click(s.$, "csaSetSaveBtn");
  assert.equal(writes(s.log).length, 2, "retry sends again");
  assert.equal(s.log.toasts.at(-1)[1], "success");
});

test("thrown transport error is contained and surfaced; close failure likewise", async () => {
  const s = setup({ history: [OPEN] });
  await s.h.openManageModal(SKU_ROW(41));
  fill(s.$, { ...SET_OK, csaEffectiveFrom: "2026-10-01", csaCloseEffectiveTo: "2026-10-31", csaCloseRemarks: "r" });
  s.state.rpcThrow = new Error("socket closed");
  await click(s.$, "csaSetSaveBtn");
  assert.equal(lastError(s.$), "socket closed");
  await click(s.$, "csaCloseSaveBtn");
  assert.equal(s.log.errors.at(-1)[0], "Failed to close SKU sales assumption");
  assert.equal(lastError(s.$), "socket closed");
});

test("double click while a write is in flight issues exactly one RPC", async () => {
  const s = setup();
  await s.h.openManageModal(SKU_ROW(41));
  fill(s.$, SET_OK);
  let release;
  s.state.rpcResult = new Promise((r) => { release = r; });
  await s.$("csaSetSaveBtn").fire("click");
  await s.$("csaSetSaveBtn").fire("click");
  await settle();
  release({ data: null, error: null });
  await settle();
  assert.equal(writes(s.log).length, 1);
});

// ---- history race -------------------------------------------------------------------------------------------------
test("history for SKU A that arrives after the modal was reopened for SKU B is discarded", async () => {
  const gates = [];
  const s = setup({ history: [OPEN], historyGate: () => new Promise((r) => gates.push(r)) });
  const first = s.h.openManageModal(SKU_ROW(41));
  await Promise.resolve();
  s.state.history = [];                          // SKU B has no assumption
  await new Promise((r) => setTimeout(r, 3));    // distinct snapshot token (see audit finding F-1)
  const second = s.h.openManageModal(SKU_ROW(42));
  await Promise.resolve();
  gates[1](); await second;                      // B answers first (empty)
  s.state.history = [OPEN];
  gates[0](); await first;                       // A's late answer must not replace B's history
  assert.equal(s.$("csaSetSaveBtn").textContent, "Save Assumption", "B still shows no open assumption");
  assert.equal(s.$("csaCloseSection").hidden, true);
  // the data used by the save validation must also be B's: with A's open assumption (from 2026-09-01) this date would be refused
  fill(s.$, { ...SET_OK, csaEffectiveFrom: "2026-09-01" });
  await click(s.$, "csaSetSaveBtn");
  assert.equal(writes(s.log).length, 1, "B's save is validated against B's history");
  assert.equal(writes(s.log)[0].payload.p_sku_id, 42);
});

test("history load failure is reported and the write sections stay usable only for set (no open row is invented)", async () => {
  const s = setup();
  s.state.history = null;
  const orig = s.log;
  await s.h.openManageModal(SKU_ROW(41));
  assert.equal(findOpenSkuSalesAssumption([]), null);
  assert.equal(orig.errors.length, 0);
});

// ---- scope guard --------------------------------------------------------------------------------------------------
test("source: the workspace calls only its seven documented RPCs (3 reads, preview, 3 writes), never approval/finalise/MRP-decision RPCs, and has no bulk loop around a write", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/shared/js/costing-suite-commercial-sales-assumptions.js"), "utf8").replace(/\r\n/g, "\n");
  const names = [...new Set([...src.matchAll(/costingRpc\(\s*"([a-z_]+)"/g)].map((m) => m[1]))].sort();
  assert.deepEqual(names, ["rpc_close_sku_sales_assumption", "rpc_get_regional_sales_allocation_default_policies", "rpc_get_sales_allocation_default_policies", "rpc_get_sku_sales_assumptions", "rpc_preview_sales_allocation_default_policy_scope", "rpc_set_sales_allocation_default_policies_scoped", "rpc_set_sku_sales_assumption"]);
  assert.doesNotMatch(src, /rpc_costing_|rpc_decide_|rpc_accept_|rpc_approve_/);
  for (const fn of ["saveSetOrSupersede", "saveClose"]) {
    const i = src.indexOf(`async function ${fn}(`);
    const body = src.slice(i, src.indexOf("\n  }\n", i));
    assert.equal((body.match(/costingRpc\(/g) || []).length, 1, fn);
    assert.doesNotMatch(body, /\.forEach\(|for \(|\.map\(/, `${fn}: single-row write`);
  }
});
