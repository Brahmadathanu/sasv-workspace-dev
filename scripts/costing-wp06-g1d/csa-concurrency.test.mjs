// WP06-G1d: concurrency of the Commercial Sales Assumptions manage modal.
//  F-1  the modal snapshot identity must not depend on the clock (Date.now() collides within one millisecond);
//  F-2  a write that is still in flight must keep blocking further writes when the modal is closed/reopened, and its
//       completion must never touch a newer modal session.
// Mocked costingRpc + fake DOM, deterministic gates, no network / Supabase. RPC names, payloads and validation are
// asserted unchanged (see also WP06-G1 / PR #152 for the full payload matrix).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadController } from "../costing-nav-mcm-cbm/load-controller.mjs";

const csa = await loadController("costing-suite-commercial-sales-assumptions.js");
const PERIOD = "2026-10-01";
const WORKSPACE = csa.COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(root, "public/shared/js/costing-suite-commercial-sales-assumptions.js"), "utf8").replace(/\r\n/g, "\n");

function makeElement(id) {
  const handlers = {};
  const classes = new Set(["hidden"]);
  return {
    id, value: "", textContent: "", innerHTML: "", hidden: false, disabled: false, checked: false, attrs: {},
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) },
    setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener(t, fn) { (handlers[t] ||= []).push(fn); },
    fire(t, ev = {}) { return Promise.all((handlers[t] || []).map((fn) => fn({ target: this, preventDefault() {}, stopPropagation() {}, ...ev }))); },
    querySelector: () => null, querySelectorAll: () => [], focus() {}, blur() {}, contains: () => false, closest: () => null, style: {}, dataset: {},
  };
}
const settle = () => new Promise((r) => setTimeout(r, 10));

function setup({ history = {} } = {}) {
  const els = new Map();
  globalThis.document = {
    getElementById: (id) => { if (!els.has(id)) els.set(id, makeElement(id)); return els.get(id); },
    querySelector: () => null, querySelectorAll: () => [], activeElement: null, body: {}, contains: () => false, createElement: () => makeElement("created"),
  };
  const $ = (id) => globalThis.document.getElementById(id);
  const log = { rpc: [], toasts: [], errors: [], masks: [] };
  const gates = { history: [], write: [] };
  const state = { canEdit: true, tab: WORKSPACE, period: PERIOD, history, historyGated: false, writeResults: [] };
  const deps = {
    costingFrom: () => { throw new Error("not used"); }, fetchAllRows: async () => [],
    costingRpc: async (name, payload) => {
      log.rpc.push({ name, payload });
      if (name === "rpc_get_sku_sales_assumptions") {
        const data = state.history[String(payload.p_sku_id)] ?? [];
        if (state.historyGated) await new Promise((r) => gates.history.push(() => r()));
        return { data, error: null };
      }
      return new Promise((resolve) => gates.write.push((result = { data: null, error: null }) => resolve(result)));
    },
    showToast: (...a) => log.toasts.push(a), handleError: (...a) => log.errors.push(a), setLoadingMask: (...a) => log.masks.push(a),
    text: String, formatNumber: String, formatMoney: String, formatDate: String, formatDateTime: String, statusChip: String, cpCellPrimaryHtml: String,
    normalizeStatus: (v) => String(v ?? "").trim().toUpperCase(),
    getActivePeriodStart: () => state.period, getPolicyManagerTab: () => state.tab,
    canEditPricingPolicyActions: () => state.canEdit, requireEditAccess: () => state.canEdit,
    reloadRows: async () => {}, formatPeriodMonth: String,
  };
  const h = csa.createCommercialSalesAssumptionHandlers(deps);
  h.bindEvents();
  return { h, $, log, gates, state };
}
const SKU = (id) => ({ sku_id: id, period_start: PERIOD, product_name: `P${id}` });
const OPEN = { assumption_id: 5, status: "ACTIVE", effective_from: "2026-09-01", effective_to: null };
const SET = { csaAssumptionBasis: "MANUAL_ASSUMPTION", csaAssumedUnits: "250", csaAssumedValue: "", csaEffectiveFrom: "2026-10-01", csaRemarks: "Launch estimate agreed with sales", csaApprovalReference: "" };
const fill = ($, o) => { for (const [id, v] of Object.entries(o)) $(id).value = v; };
const writes = (log) => log.rpc.filter((c) => !c.name.startsWith("rpc_get_"));
const histReads = (log) => log.rpc.filter((c) => c.name === "rpc_get_sku_sales_assumptions");
async function withFrozenClock(fn) {
  const real = Date.now;
  Date.now = () => 1_700_000_000_000;
  try { return await fn(); } finally { Date.now = real; }
}
const clickSave = async (s) => { await s.$("csaSetSaveBtn").fire("click"); await settle(); };
const clickClose = async (s) => { await s.$("csaCloseSaveBtn").fire("click"); await settle(); };

// ---- F-1: clock-independent session identity ----------------------------------------------------------------------
test("F-1 frozen clock: an older history answer for the SAME SKU cannot overwrite the reopened modal's newer history", async () => {
  await withFrozenClock(async () => {
    const s = setup({ history: { 41: [OPEN] } });
    s.state.historyGated = true;
    const first = s.h.openManageModal(SKU(41));   // request #1 (will answer late, with an OPEN assumption)
    await settle();
    s.h.closeManageModal();
    s.state.history = { 41: [] };                 // by the time of request #2 the assumption no longer exists
    const second = s.h.openManageModal(SKU(41));  // same SKU, same period, same millisecond
    await settle();
    s.gates.history[1]();                         // newer answer first: no open assumption
    await second;
    s.gates.history[0]();                         // stale answer arrives last
    await first;
    assert.equal(s.$("csaCloseSection").hidden, true, "no open assumption must be shown: stale answer discarded");
    assert.equal(s.$("csaSetSaveBtn").textContent, "Save Assumption");
    fill(s.$, { ...SET, csaEffectiveFrom: "2026-09-01" });
    s.state.historyGated = false;
    await clickSave(s);
    assert.equal(writes(s.log).length, 1, "validation uses the newer (empty) history, so an effective-from before the stale open row is accepted");
  });
});

test("F-1 frozen clock: stale answer for a DIFFERENT SKU is discarded too", async () => {
  await withFrozenClock(async () => {
    const s = setup({ history: { 41: [OPEN], 42: [] } });
    s.state.historyGated = true;
    const a = s.h.openManageModal(SKU(41));
    await settle();
    const b = s.h.openManageModal(SKU(42));
    await settle();
    s.gates.history[1](); await b;
    s.gates.history[0](); await a;
    assert.equal(s.$("csaCloseSection").hidden, true);
  });
});

test("F-1 source: the snapshot identity is a monotonic counter, not the clock", () => {
  assert.doesNotMatch(SRC, /token:\s*Date\.now\(\)/);
  assert.match(SRC, /token:\s*\+\+\w+/);
});

test("F-1 the real clock is not consulted for identity: tokens are strictly increasing across opens even when time goes backwards", async () => {
  const real = Date.now;
  let t = 5_000;
  Date.now = () => (t -= 100);
  try {
    const s = setup({ history: { 41: [OPEN], 42: [] } });
    s.state.historyGated = true;
    const a = s.h.openManageModal(SKU(41));
    await settle();
    const b = s.h.openManageModal(SKU(42));
    await settle();
    s.gates.history[1](); await b;
    s.gates.history[0](); await a;
    assert.equal(s.$("csaCloseSection").hidden, true);
  } finally { Date.now = real; }
});

// ---- F-2: write-in-flight survives close / reopen -----------------------------------------------------------------
async function startPendingSet(s, sku = 41) {
  await s.h.openManageModal(SKU(sku));
  fill(s.$, SET);
  await s.$("csaSetSaveBtn").fire("click");
  await settle();
  assert.equal(writes(s.log).length, 1, "first write started and is pending");
}

test("F-2 close then reopen the SAME SKU while a write is pending: a second write is NOT sent", async () => {
  const s = setup();
  await startPendingSet(s);
  s.h.closeManageModal();
  await s.h.openManageModal(SKU(41));
  fill(s.$, SET);
  await clickSave(s);
  assert.equal(writes(s.log).length, 1, "concurrent save prevented");
  s.gates.write[0]();
  await settle();
});

test("F-2 close then open a DIFFERENT SKU while a write is pending: save and close are blocked; the reopened form is disabled", async () => {
  const s = setup({ history: { 42: [OPEN] } });
  await startPendingSet(s, 41);
  s.h.closeManageModal();
  await s.h.openManageModal(SKU(42));
  assert.equal(s.$("csaSetSaveBtn").disabled, true, "pending write is reflected in the new session's controls");
  assert.equal(s.$("csaCloseSaveBtn").disabled, true);
  fill(s.$, { ...SET, csaCloseEffectiveTo: "2026-10-31", csaCloseRemarks: "r" });
  await clickSave(s);
  await clickClose(s);
  assert.equal(writes(s.log).length, 1);
  s.gates.write[0]();
  await settle();
  assert.equal(s.$("csaSetSaveBtn").disabled, false, "controls re-enabled once the pending write settles");
  assert.equal(s.$("csaCloseSaveBtn").disabled, false);
});

test("F-2 stale SUCCESS: completion of the old write does not reset, refresh or message the newer modal session", async () => {
  const s = setup({ history: { 42: [] } });
  await startPendingSet(s, 41);
  s.h.closeManageModal();
  await s.h.openManageModal(SKU(42));
  fill(s.$, { csaAssumedUnits: "999", csaRemarks: "typed for SKU 42" });
  const reads = histReads(s.log).length;
  s.gates.write[0]({ data: null, error: null });
  await settle();
  assert.equal(s.$("csaAssumedUnits").value, "999", "SKU 42's form was not reset by SKU 41's completion");
  assert.equal(s.$("csaRemarks").value, "typed for SKU 42");
  assert.equal(histReads(s.log).length, reads, "no history refresh for the newer session");
  assert.equal(s.$("csaManageError").textContent, "");
  assert.equal(s.log.toasts.filter((t) => t[1] === "success").length, 1, "the user is still told the write succeeded");
  assert.equal(s.$("csaManageModal").attrs["aria-hidden"], "false", "newer modal stays open");
});

test("F-2 stale ERROR: the old write's error is reported once via handleError but never shown inside the newer modal; the newer session can then save", async () => {
  const s = setup({ history: { 42: [] } });
  await startPendingSet(s, 41);
  s.h.closeManageModal();
  await s.h.openManageModal(SKU(42));
  s.gates.write[0]({ data: null, error: { message: "server said no" } });
  await settle();
  assert.equal(s.log.errors.length, 1);
  assert.equal(s.log.errors[0][0], "Failed to save SKU sales assumption");
  assert.equal(s.$("csaManageError").textContent, "", "no stale error text in SKU 42's modal");
  fill(s.$, SET);
  await clickSave(s);
  const w = writes(s.log);
  assert.equal(w.length, 2, "error recovery: the flag was cleared, SKU 42 may save");
  assert.equal(w[1].payload.p_sku_id, 42);
  assert.equal(w[1].name, "rpc_set_sku_sales_assumption");
});

test("F-2 pending CLOSE-assumption write: same protection (blocked while pending, stale completion does not touch the new session)", async () => {
  const s = setup({ history: { 41: [OPEN], 42: [OPEN] } });
  await s.h.openManageModal(SKU(41));
  fill(s.$, { csaCloseEffectiveTo: "2026-10-31", csaCloseRemarks: "Replaced by actuals" });
  await clickClose(s);
  assert.equal(writes(s.log).length, 1);
  assert.equal(writes(s.log)[0].name, "rpc_close_sku_sales_assumption");
  s.h.closeManageModal();
  await s.h.openManageModal(SKU(42));
  fill(s.$, { csaCloseEffectiveTo: "2026-10-31", csaCloseRemarks: "typed for 42" });
  await clickClose(s);
  assert.equal(writes(s.log).length, 1, "second close blocked while the first is pending");
  s.gates.write[0]({ data: null, error: null });
  await settle();
  assert.equal(s.$("csaCloseRemarks").value, "typed for 42", "newer session's form untouched");
});

test("F-2 period change while a write is pending closes the modal; completion neither reopens it nor refreshes history", async () => {
  const s = setup();
  await startPendingSet(s, 41);
  s.state.period = "2026-11-01";
  s.h.onPeriodChanged("2026-11-01");
  assert.equal(s.$("csaManageModal").attrs["aria-hidden"], "true");
  const reads = histReads(s.log).length;
  s.gates.write[0]({ data: null, error: null });
  await settle();
  assert.equal(s.$("csaManageModal").attrs["aria-hidden"], "true");
  assert.equal(histReads(s.log).length, reads);
  assert.equal(s.log.toasts.filter((t) => t[1] === "success").length, 1);
});

// ---- behaviour that must NOT change --------------------------------------------------------------------------------
test("unchanged: normal completion in the same session resets the form, refreshes history and re-enables controls; payload and RPC name are exact", async () => {
  const s = setup();
  await startPendingSet(s, 41);
  assert.deepEqual(writes(s.log)[0], { name: "rpc_set_sku_sales_assumption", payload: { p_period_start: PERIOD, p_sku_id: 41, p_assumption_basis: "MANUAL_ASSUMPTION", p_assumed_sales_units: 250, p_assumed_sales_value: null, p_effective_from: "2026-10-01", p_remarks: "Launch estimate agreed with sales", p_approval_reference: null } });
  const reads = histReads(s.log).length;
  s.gates.write[0]({ data: null, error: null });
  await settle();
  assert.equal(s.$("csaAssumedUnits").value, "", "form reset in the same session");
  assert.equal(histReads(s.log).length, reads + 1, "history refreshed in the same session");
  assert.equal(s.$("csaSetSaveBtn").disabled, false);
  assert.equal(s.log.toasts.at(-1)[1], "success");
});

test("unchanged: same-session error keeps the form and shows the message inline; a second click while pending is still a no-op", async () => {
  const s = setup();
  await startPendingSet(s, 41);
  await clickSave(s);
  assert.equal(writes(s.log).length, 1, "double click blocked");
  s.gates.write[0]({ data: null, error: { message: "approval required" } });
  await settle();
  assert.equal(s.$("csaManageError").textContent, "approval required");
  assert.equal(s.$("csaAssumedUnits").value, "250");
  await clickSave(s);
  assert.equal(writes(s.log).length, 2, "retry allowed after the error");
});

test("unchanged: validation, permission and context guards still run before any write", async () => {
  const s = setup();
  await s.h.openManageModal(SKU(41));
  fill(s.$, { ...SET, csaAssumedUnits: "0" });
  await clickSave(s);
  assert.equal(s.$("csaManageError").textContent, "Assumed sales units must be greater than zero.");
  fill(s.$, SET);
  s.state.canEdit = false;
  await clickSave(s);
  s.state.canEdit = true;
  s.state.tab = "sku-overview";
  await clickSave(s);
  assert.equal(writes(s.log).length, 0);
});

test("source guard: exactly the same three write RPC names and no new RPC", () => {
  const names = [...new Set([...SRC.matchAll(/costingRpc\(\s*"([a-z_]+)"/g)].map((m) => m[1]))].sort();
  assert.deepEqual(names, ["rpc_close_sku_sales_assumption", "rpc_get_regional_sales_allocation_default_policies", "rpc_get_sales_allocation_default_policies", "rpc_get_sku_sales_assumptions", "rpc_preview_sales_allocation_default_policy_scope", "rpc_set_sales_allocation_default_policies_scoped", "rpc_set_sku_sales_assumption"]);
});

// ---- review of #153: reopen while pending, completion after reopen, controls, async refresh isolation --------------
const CTRL_IDS = ["csaAssumptionBasis", "csaAssumedUnits", "csaAssumedValue", "csaEffectiveFrom", "csaRemarks", "csaApprovalReference", "csaSetSaveBtn", "csaCloseEffectiveTo", "csaCloseRemarks", "csaCloseApprovalReference", "csaCloseSaveBtn"];
const allDisabled = (s) => CTRL_IDS.map((id) => s.$(id).disabled);

for (const [label, reopenSku] of [["same SKU", 41], ["different SKU", 42]]) {
  test(`#153 review: reopen (${label}) while a write is pending -> all write controls stay disabled; after completion (success) every control is re-enabled and the new session can save`, async () => {
    const s = setup({ history: { 41: [], 42: [] } });
    await startPendingSet(s, 41);
    assert.ok(allDisabled(s).every(Boolean), "disabled while pending");
    s.h.closeManageModal();
    assert.ok(allDisabled(s).every(Boolean), "closing keeps them disabled while the write is pending");
    await s.h.openManageModal(SKU(reopenSku));
    assert.ok(allDisabled(s).every(Boolean), "reopened session starts disabled while the write is pending");
    s.gates.write[0]({ data: null, error: null });
    await settle();
    assert.ok(allDisabled(s).every((d) => d === false), "all eleven controls re-enabled after completion");
    fill(s.$, SET);
    await clickSave(s);
    const w = writes(s.log);
    assert.equal(w.length, 2);
    assert.equal(w[1].payload.p_sku_id, reopenSku, "the new session writes for its own SKU");
    s.gates.write[1]();
    await settle();
  });

  test(`#153 review: reopen (${label}) while a write is pending -> completion by FAILURE also re-enables every control`, async () => {
    const s = setup({ history: { 41: [], 42: [] } });
    await startPendingSet(s, 41);
    s.h.closeManageModal();
    await s.h.openManageModal(SKU(reopenSku));
    s.gates.write[0]({ data: null, error: { message: "denied" } });
    await settle();
    assert.ok(allDisabled(s).every((d) => d === false));
    assert.equal(s.$("csaManageError").textContent, "");
    assert.equal(s.log.masks.at(-1)[0], false, "loading mask cleared");
  });
}

for (const order of ["stale-first", "new-first"]) {
  test(`#153 review: the history refresh that follows a write cannot mutate a newer modal session (close/reopen during its await; ${order})`, async () => {
    const s = setup({ history: { 41: [] } });
    await startPendingSet(s, 41);
    s.state.history = { 41: [OPEN] };            // what the old session's post-write refresh will read
    s.state.historyGated = true;
    s.gates.write[0]({ data: null, error: null });
    await settle();                               // write done; refreshModalAfterWrite -> history read #A pending
    assert.equal(s.gates.history.length, 1, "post-write refresh is waiting for its history answer");
    s.h.closeManageModal();                       // close during the refresh's await
    s.state.history = { 41: [] };                 // what the reopened session reads
    const reopened = s.h.openManageModal(SKU(41));
    await settle();
    assert.equal(s.gates.history.length, 2);
    const releaseStale = () => s.gates.history[0]();
    const releaseNew = () => s.gates.history[1]();
    if (order === "stale-first") { releaseStale(); await settle(); releaseNew(); } else { releaseNew(); await settle(); releaseStale(); }
    await reopened;
    await settle();
    assert.equal(s.$("csaCloseSection").hidden, true, "no open assumption leaked from the stale refresh into the new session");
    assert.equal(s.$("csaSetSaveBtn").textContent, "Save Assumption");
    s.state.historyGated = false;
    fill(s.$, { ...SET, csaEffectiveFrom: "2026-09-01" });
    await clickSave(s);
    assert.equal(writes(s.log).length, 2, "the new session validates against its own (empty) history");
  });
}

test("#153 review: a write that completes while the modal is CLOSED (no reopen) does not reopen it, reset anything or read history", async () => {
  const s = setup({ history: { 41: [] } });
  await startPendingSet(s, 41);
  s.h.closeManageModal();
  const reads = histReads(s.log).length;
  s.gates.write[0]({ data: null, error: null });
  await settle();
  assert.equal(s.$("csaManageModal").attrs["aria-hidden"], "true");
  assert.equal(histReads(s.log).length, reads);
  assert.ok(allDisabled(s).every((d) => d === false));
});
