// A7: regression for the EXISTING Material Cost Manager review acceptance workflow
// (saveMaterialReviewAcceptance / saveMaterialReviewCloseAcceptance). Test-only: the real controller is loaded and
// driven through its real event bindings with a mocked costingRpc/costingFrom and fake DOM nodes. No network, no
// Supabase, no production calls. Business logic is not modified.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadController } from "../costing-nav-mcm-cbm/load-controller.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(root, "public/shared/js/costing-suite-material-cost.js"), "utf8").replace(/\r\n/g, "\n");
const { createMaterialCostController } = await loadController("costing-suite-material-cost.js");

const READ_ONLY = "Read-only access. You do not have permission to change material costing actions.";
const PERIOD = "2026-10-01";

// ---- minimal fake DOM -------------------------------------------------------------------------------------------
function el(name) {
  const handlers = {};
  const classes = new Set(["hidden"]);
  return {
    name, value: "", textContent: "", disabled: false, attrs: {},
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn); },
    fire(type, ev = {}) { return Promise.all((handlers[type] || []).map((fn) => fn({ target: this, ...ev }))); },
    listeners: (type) => (handlers[type] || []).length,
    contains: () => false, blur() {}, focus() {},
    get hidden() { return classes.has("hidden"); },
  };
}
// Trace-lens chrome is looked up by id while binding; resolve every id to an inert node (not part of this workflow).
globalThis.document = {
  activeElement: null, body: {}, contains: () => false,
  addEventListener() {}, getElementById: () => el("inert"), querySelector: () => null, querySelectorAll: () => [],
};

const ACCEPT_ROW = Object.freeze({
  period_start: PERIOD, stock_item_id: 4412, stock_item_name: "Haritaki", stock_item_code: "RM-4412", material_area: "RM",
  action_severity: "REVIEW_REQUIRED", recommended_ui_route: "MATERIAL_RATE_REVIEW",
  issue_codes: "STALE_RM_PURCHASE_RATE", warning_codes: "RM_STOCK_VALUATION_FALLBACK",
  action_required_summary: "Rate older than 180 days",
});

function setup({ canEdit = true, omitCanEdit = false, registerRows = [], overrides = {} } = {}) {
  const log = { rpc: [], from: [], toasts: [], errors: [], masks: [], refresh: [], reload: 0, drawer: 0 };
  const dom = {};
  for (const n of [
    "materialReviewAcceptModal", "materialReviewAcceptCloseBtn", "materialReviewAcceptCancelBtn", "materialReviewAcceptSaveBtn",
    "materialReviewAcceptStockItem", "materialReviewAcceptMaterialArea", "materialReviewAcceptIssueCodes",
    "materialReviewAcceptWarningCodes", "materialReviewAcceptActionSummary", "materialReviewAcceptReason", "materialReviewAcceptNote",
    "materialReviewCloseAcceptanceModal", "materialReviewCloseAcceptanceCloseBtn", "materialReviewCloseAcceptanceCancelBtn",
    "materialReviewCloseAcceptanceSaveBtn", "materialReviewCloseStockItem", "materialReviewCloseDetails", "materialReviewCloseReason",
    "drawerClose",
  ]) dom[n] = el(n);
  const state = { canEdit, rpcResult: { data: {}, error: null }, rpcThrow: null, reloadFail: false, refreshFail: null, registerFail: false };
  const deps = {
    dom,
    costingFrom: (view) => {
      log.from.push(view);
      const q = { select: () => q, eq: () => (state.registerFail ? Promise.resolve({ data: null, error: new Error("register down") }) : Promise.resolve({ data: registerRows, error: null })) };
      return q;
    },
    costingRpc: async (name, payload) => {
      log.rpc.push({ name, payload });
      if (state.rpcThrow) throw state.rpcThrow;
      return state.rpcResult;
    },
    showToast: (...a) => log.toasts.push(a),
    handleError: (...a) => log.errors.push(a),
    setLoadingMask: (...a) => log.masks.push(a),
    normalizeStatus: (v) => String(v ?? "").trim().toUpperCase(),
    getActivePeriodStart: () => PERIOD,
    getCurrentLens: () => "action-queue",
    reloadRows: async () => { log.reload += 1; if (state.reloadFail) throw new Error("reload down"); },
    refreshOpenDrawerIfNeeded: async () => { log.drawer += 1; },
    runStagedCostingRefreshAndReload: async (arg) => { log.refresh.push(arg); if (state.refreshFail) throw state.refreshFail; },
    text: (v) => String(v ?? ""), escapeHtml: (v) => String(v ?? ""), statusChip: (v) => String(v ?? ""),
    formatDateTime: (v) => String(v ?? ""), setVisible() {},
    ...overrides,
  };
  if (omitCanEdit) { /* canEditMaterialCostActions intentionally undefined */ } else deps.canEditMaterialCostActions = () => state.canEdit;
  const ctl = createMaterialCostController(deps);
  ctl.bindEvents();
  return { ctl, dom, log, state, accept: (r = ACCEPT_ROW) => ctl.openMaterialReviewAcceptModal(r) };
}
const saveAccept = (s) => s.dom.materialReviewAcceptSaveBtn.fire("click");
const saveClose = (s) => s.dom.materialReviewCloseAcceptanceSaveBtn.fire("click");
const setReason = (s, v, note) => {
  s.dom.materialReviewAcceptReason.value = v;
  if (note !== undefined) s.dom.materialReviewAcceptNote.value = note;
  return s.dom.materialReviewAcceptReason.fire("input");
};

// ---- wiring ------------------------------------------------------------------------------------------------------
test("bindEvents wires save/cancel/close/backdrop and input listeners exactly once (idempotent)", () => {
  const s = setup();
  s.ctl.bindEvents();
  assert.equal(s.dom.materialReviewAcceptSaveBtn.listeners("click"), 1);
  assert.equal(s.dom.materialReviewAcceptCancelBtn.listeners("click"), 1);
  assert.equal(s.dom.materialReviewAcceptCloseBtn.listeners("click"), 1);
  assert.equal(s.dom.materialReviewAcceptModal.listeners("click"), 1);
  assert.equal(s.dom.materialReviewAcceptReason.listeners("input"), 1);
  assert.equal(s.dom.materialReviewCloseAcceptanceSaveBtn.listeners("click"), 1);
  assert.equal(s.dom.materialReviewCloseReason.listeners("input"), 1);
});

// ---- eligibility -------------------------------------------------------------------------------------------------
test("eligibility: only REVIEW_REQUIRED + MATERIAL_RATE_REVIEW without hard-blocker codes opens the modal", () => {
  const ok = setup();
  ok.accept();
  assert.equal(ok.dom.materialReviewAcceptModal.hidden, false);
  assert.equal(ok.dom.materialReviewAcceptModal.attrs["aria-hidden"], "false");
  assert.equal(ok.dom.materialReviewAcceptMaterialArea.value, "RM");
  assert.equal(ok.dom.materialReviewAcceptIssueCodes.value, "STALE_RM_PURCHASE_RATE");
  assert.equal(ok.dom.materialReviewAcceptStockItem.textContent, "Haritaki (RM-4412)");
  assert.equal(ok.log.toasts.length, 0);

  const variants = {
    "BLOCKER severity": { action_severity: "BLOCKER" },
    "READY severity": { action_severity: "READY" },
    "missing severity": { action_severity: "" },
    "manager RM route": { recommended_ui_route: "MATERIAL_RATE_MANAGER_RM" },
    "manager PM route": { recommended_ui_route: "MATERIAL_RATE_MANAGER_PM" },
    "other route": { recommended_ui_route: "COST_APPROVAL_WORKBENCH" },
    "missing RM rate (hard blocker)": { issue_codes: "MISSING_REQUIRED_RM_RATE" },
    "missing PM rate among codes (hard blocker)": { issue_codes: "STALE_PM_PURCHASE_RATE, MISSING_REQUIRED_PM_RATE" },
  };
  for (const [label, patch] of Object.entries(variants)) {
    const s = setup();
    s.accept({ ...ACCEPT_ROW, ...patch });
    assert.equal(s.dom.materialReviewAcceptModal.hidden, true, `${label}: modal stays closed`);
    assert.deepEqual(s.log.toasts[0]?.slice(0, 2), ["This queue row is not eligible for Accept Review.", "info"], label);
    assert.equal(s.log.rpc.length, 0, label);
  }
  const s = setup();
  s.accept(null);
  assert.equal(s.log.toasts.length, 0);
  assert.equal(s.dom.materialReviewAcceptModal.hidden, true);
});

test("eligibility is case/whitespace tolerant for severity and route (server casing is not trusted)", () => {
  const s = setup();
  s.accept({ ...ACCEPT_ROW, action_severity: " review_required ", recommended_ui_route: "material_rate_review " });
  assert.equal(s.dom.materialReviewAcceptModal.hidden, false);
});

test("an already ACTIVE acceptance for the same key makes the row ineligible; other keys stay eligible", async () => {
  const active = { ...ACCEPT_ROW, acceptance_id: 9, acceptance_status: "ACTIVE" };
  const s = setup({ registerRows: [active] });
  await s.ctl.loadMaterialReviewAcceptanceRegister(PERIOD);
  assert.deepEqual(s.log.from, ["v_costing_material_review_acceptance_register"]);
  s.accept();
  assert.equal(s.dom.materialReviewAcceptModal.hidden, true, "same fingerprint already accepted");
  const other = setup({ registerRows: [active] });
  await other.ctl.loadMaterialReviewAcceptanceRegister(PERIOD);
  other.accept({ ...ACCEPT_ROW, issue_codes: "STALE_RM_PURCHASE_RATE,NEW_CODE" });
  assert.equal(other.dom.materialReviewAcceptModal.hidden, false, "changed issue fingerprint is a new review");
  const matched = setup({ registerRows: [{ ...ACCEPT_ROW, acceptance_register_status: "ACTIVE_MATCHED" }] });
  await matched.ctl.loadMaterialReviewAcceptanceRegister(PERIOD);
  matched.accept();
  assert.equal(matched.dom.materialReviewAcceptModal.hidden, true, "ACTIVE_MATCHED register status also blocks");
  const closed = setup({ registerRows: [{ ...ACCEPT_ROW, acceptance_status: "CLOSED" }] });
  await closed.ctl.loadMaterialReviewAcceptanceRegister(PERIOD);
  closed.accept();
  assert.equal(closed.dom.materialReviewAcceptModal.hidden, false, "closed acceptance does not block");
});

// ---- permissions -------------------------------------------------------------------------------------------------
test("permissions: view-only users cannot open either modal or save; no RPC is ever sent", async () => {
  const s = setup({ canEdit: false });
  s.accept();
  assert.equal(s.dom.materialReviewAcceptModal.hidden, true);
  s.ctl.openMaterialReviewCloseAcceptanceModal({ acceptance_id: 7 });
  assert.equal(s.dom.materialReviewCloseAcceptanceModal.hidden, true);
  assert.equal(s.log.toasts.length, 2);
  for (const t of s.log.toasts) assert.deepEqual(t.slice(0, 2), [READ_ONLY, "error"]);
  await saveAccept(s);
  await saveClose(s);
  assert.equal(s.log.toasts.length, 4);
  assert.equal(s.log.rpc.length, 0);
  assert.equal(s.log.refresh.length, 0);
});

test("permissions are re-checked at save time (revoked after the modal was opened)", async () => {
  const s = setup();
  s.accept();
  await setReason(s, "Reviewed with purchase team");
  s.state.canEdit = false;
  await saveAccept(s);
  assert.equal(s.log.rpc.length, 0);
  assert.deepEqual(s.log.toasts.at(-1).slice(0, 2), [READ_ONLY, "error"]);
  assert.equal(s.dom.materialReviewAcceptModal.hidden, false, "modal left as is");
});

test("when no permission callback is supplied the controller defaults to writable (existing behaviour)", async () => {
  const s = setup({ omitCanEdit: true });
  s.accept();
  assert.equal(s.dom.materialReviewAcceptModal.hidden, false);
});

// ---- reason validation -------------------------------------------------------------------------------------------
test("Save button state follows the trimmed reason length (>= 10) and busy flag", async () => {
  const s = setup();
  s.accept();
  assert.equal(s.dom.materialReviewAcceptSaveBtn.disabled, true, "empty reason");
  await setReason(s, "123456789");
  assert.equal(s.dom.materialReviewAcceptSaveBtn.disabled, true, "9 chars");
  await setReason(s, "   123456789   ");
  assert.equal(s.dom.materialReviewAcceptSaveBtn.disabled, true, "9 chars after trim");
  await setReason(s, "1234567890");
  assert.equal(s.dom.materialReviewAcceptSaveBtn.disabled, false, "exactly 10 chars");
});

test("save with a short reason is refused client-side: error toast, no RPC, modal kept", async () => {
  const s = setup();
  s.accept();
  await setReason(s, "too short");
  await saveAccept(s);
  assert.equal(s.log.rpc.length, 0);
  assert.deepEqual(s.log.toasts.at(-1).slice(0, 2), ["Acceptance reason must be at least 10 characters.", "error"]);
  assert.equal(s.dom.materialReviewAcceptModal.hidden, false);
  assert.equal(s.log.refresh.length, 0);
});

test("save without an opened row is refused with the missing-ID error and no RPC", async () => {
  const s = setup();
  await saveAccept(s);
  assert.deepEqual(s.log.toasts.at(-1).slice(0, 2), ["Stock item ID missing for selected queue row.", "error"]);
  const noId = setup();
  noId.accept({ ...ACCEPT_ROW, stock_item_id: null });
  await setReason(noId, "A sufficiently long reason");
  await saveAccept(noId);
  assert.equal(noId.log.rpc.length, 0);
});

// ---- exact payload + success path --------------------------------------------------------------------------------
test("accept sends exactly rpc_accept_material_review_action with the exact 10-key payload (trimmed reason, note)", async () => {
  const s = setup();
  s.accept();
  await setReason(s, "  Reviewed with purchase team  ", "  PO pending  ");
  await saveAccept(s);
  assert.equal(s.log.rpc.length, 1);
  assert.equal(s.log.rpc[0].name, "rpc_accept_material_review_action");
  assert.deepEqual(s.log.rpc[0].payload, {
    p_period_start: PERIOD,
    p_stock_item_id: 4412,
    p_material_area: "RM",
    p_action_severity: "REVIEW_REQUIRED",
    p_recommended_ui_route: "MATERIAL_RATE_REVIEW",
    p_issue_codes: "STALE_RM_PURCHASE_RATE",
    p_warning_codes: "RM_STOCK_VALUATION_FALLBACK",
    p_action_required_summary: "Rate older than 180 days",
    p_acceptance_reason: "Reviewed with purchase team",
    p_acceptance_note: "PO pending",
  });
  assert.equal(Object.keys(s.log.rpc[0].payload).length, 10);
});

test("empty note is sent as null; a row without period_start falls back to the active period", async () => {
  const s = setup();
  const { period_start, ...noPeriod } = ACCEPT_ROW;
  s.accept(noPeriod);
  await setReason(s, "Reviewed with purchase team", "");
  await saveAccept(s);
  assert.equal(s.log.rpc[0].payload.p_acceptance_note, null);
  assert.equal(s.log.rpc[0].payload.p_period_start, PERIOD);
});

test("success: modal closes, success toast, staged refresh with MATERIAL_REVIEW_ACCEPT, then reload and drawer refresh, mask cleared", async () => {
  const s = setup();
  s.accept();
  await setReason(s, "Reviewed with purchase team");
  await saveAccept(s);
  assert.equal(s.dom.materialReviewAcceptModal.hidden, true);
  assert.deepEqual(s.log.toasts[0], ["Review accepted for this costing period.", "success", 5200]);
  assert.deepEqual(s.log.refresh, [{ sourceTrigger: "MATERIAL_REVIEW_ACCEPT", requestNote: "Material review accepted" }]);
  assert.equal(s.log.reload, 1);
  assert.equal(s.log.drawer, 1);
  assert.equal(s.log.errors.length, 0);
  assert.deepEqual(s.log.masks.map((m) => m[0]), [true, false]);
  assert.equal(s.log.masks[0][1], "Saving review acceptance...");
  assert.equal(s.log.rpc.length, 1, "exactly one RPC; refresh is delegated, not an extra RPC from this module");
});

test("a second click after success cannot resubmit (row cleared) - exactly one acceptance RPC", async () => {
  const s = setup();
  s.accept();
  await setReason(s, "Reviewed with purchase team");
  await saveAccept(s);
  await saveAccept(s);
  assert.equal(s.log.rpc.length, 1);
  assert.deepEqual(s.log.toasts.at(-1).slice(0, 2), ["Stock item ID missing for selected queue row.", "error"]);
});

test("busy flag: Save is disabled while the RPC is in flight", async () => {
  const s = setup();
  s.accept();
  await setReason(s, "Reviewed with purchase team");
  let release;
  s.state.rpcResult = new Promise((r) => { release = r; });
  const pending = saveAccept(s);
  await Promise.resolve();
  assert.equal(s.dom.materialReviewAcceptSaveBtn.disabled, true);
  release({ data: {}, error: null });
  await pending;
  assert.equal(s.log.rpc.length, 1);
});

// ---- failure handling ---------------------------------------------------------------------------------------------
test("RPC error result: handleError, modal stays open for retry, no refresh, no success toast, mask cleared, Save re-enabled", async () => {
  const s = setup();
  s.accept();
  await setReason(s, "Reviewed with purchase team");
  const err = new Error("permission denied for rpc_accept_material_review_action");
  s.state.rpcResult = { data: null, error: err };
  await saveAccept(s);
  assert.equal(s.log.errors.length, 1);
  assert.equal(s.log.errors[0][0], "Failed to accept review");
  assert.equal(s.log.errors[0][1], err);
  assert.equal(s.dom.materialReviewAcceptModal.hidden, false);
  assert.equal(s.log.refresh.length, 0);
  assert.equal(s.log.reload, 0);
  assert.ok(!s.log.toasts.some((t) => t[1] === "success"));
  assert.deepEqual(s.log.masks.map((m) => m[0]), [true, false]);
  assert.equal(s.dom.materialReviewAcceptSaveBtn.disabled, false);
});

test("thrown transport error is handled the same way (no unhandled rejection)", async () => {
  const s = setup();
  s.accept();
  await setReason(s, "Reviewed with purchase team");
  s.state.rpcThrow = new Error("network down");
  await saveAccept(s);
  assert.equal(s.log.errors.length, 1);
  assert.equal(s.log.errors[0][1].message, "network down");
  assert.equal(s.log.refresh.length, 0);
  assert.equal(s.dom.materialReviewAcceptModal.hidden, false);
});

test("after a failure the same modal can be retried and then succeeds", async () => {
  const s = setup();
  s.accept();
  await setReason(s, "Reviewed with purchase team");
  s.state.rpcResult = { data: null, error: new Error("boom") };
  await saveAccept(s);
  s.state.rpcResult = { data: {}, error: null };
  await saveAccept(s);
  assert.equal(s.log.rpc.length, 2);
  assert.deepEqual(s.log.rpc[0].payload, s.log.rpc[1].payload);
  assert.equal(s.dom.materialReviewAcceptModal.hidden, true);
  assert.equal(s.log.refresh.length, 1);
});

test("refresh failure after a saved acceptance: info toast says it was saved, reload and drawer refresh still run, no error dialog", async () => {
  const s = setup();
  s.accept();
  await setReason(s, "Reviewed with purchase team");
  s.state.refreshFail = new Error("stage processor busy");
  await saveAccept(s);
  const info = s.log.toasts.find((t) => t[1] === "info");
  assert.deepEqual(info, ["Acceptance saved, but refresh failed: stage processor busy", "info", 9000, true]);
  assert.equal(s.log.reload, 1);
  assert.equal(s.log.drawer, 1);
  assert.equal(s.log.errors.length, 0);
  assert.equal(s.dom.materialReviewAcceptModal.hidden, true);
});

test("reload failure after a saved acceptance: register is reloaded and an info toast is shown; drawer refresh still runs", async () => {
  const s = setup();
  s.accept();
  await setReason(s, "Reviewed with purchase team");
  s.state.reloadFail = true;
  const warn = console.warn; console.warn = () => {};
  try { await saveAccept(s); } finally { console.warn = warn; }
  assert.deepEqual(s.log.from, ["v_costing_material_review_acceptance_register"]);
  assert.deepEqual(s.log.toasts.find((t) => t[0] === "Acceptance action saved, but workbench reload failed.")?.slice(1), ["info", 6200]);
  assert.equal(s.log.drawer, 1);
});

test("reload and register-reload both failing is contained (no throw out of the click handler)", async () => {
  const s = setup();
  s.accept();
  await setReason(s, "Reviewed with purchase team");
  s.state.reloadFail = true; s.state.registerFail = true;
  const warn = console.warn; console.warn = () => {};
  try { await saveAccept(s); } finally { console.warn = warn; }
  assert.equal(s.log.drawer, 1);
  assert.equal(s.log.errors.length, 0);
});

test("cancel and close buttons and backdrop close the modal without any RPC", () => {
  for (const how of ["materialReviewAcceptCancelBtn", "materialReviewAcceptCloseBtn", "materialReviewAcceptModal"]) {
    const s = setup();
    s.accept();
    s.dom[how].fire("click");
    assert.equal(s.dom.materialReviewAcceptModal.hidden, true, how);
    assert.equal(s.log.rpc.length, 0, how);
  }
  const s = setup();
  s.accept();
  s.dom.materialReviewAcceptModal.fire("click", { target: el("inner") });
  assert.equal(s.dom.materialReviewAcceptModal.hidden, false, "click inside the dialog does not close it");
});

// ---- closing an acceptance ---------------------------------------------------------------------------------------
const ACCEPTANCE = Object.freeze({ acceptance_id: 77, stock_item_id: 4412, stock_item_name: "Haritaki", material_area: "RM", accepted_by_email: "r@x", accepted_at: "2026-11-01", acceptance_reason: "ok" });

test("close acceptance: exact rpc_close_material_review_acceptance payload, success toast, MATERIAL_REVIEW_CLOSE refresh", async () => {
  const s = setup();
  s.ctl.openMaterialReviewCloseAcceptanceModal(ACCEPTANCE);
  assert.equal(s.dom.materialReviewCloseAcceptanceModal.hidden, false);
  assert.match(s.dom.materialReviewCloseDetails.value, /Material area: RM/);
  s.dom.materialReviewCloseReason.value = "  Supplier rate changed again  ";
  await s.dom.materialReviewCloseReason.fire("input");
  assert.equal(s.dom.materialReviewCloseAcceptanceSaveBtn.disabled, false);
  await saveClose(s);
  assert.deepEqual(s.log.rpc, [{ name: "rpc_close_material_review_acceptance", payload: { p_acceptance_id: 77, p_close_reason: "Supplier rate changed again" } }]);
  assert.deepEqual(s.log.toasts[0], ["Acceptance closed. Review issue will be active again after costing refresh completes.", "success", 5200]);
  assert.deepEqual(s.log.refresh, [{ sourceTrigger: "MATERIAL_REVIEW_CLOSE", requestNote: "Material review acceptance closed" }]);
  assert.equal(s.dom.materialReviewCloseAcceptanceModal.hidden, true);
  assert.equal(s.log.reload, 1);
  assert.deepEqual(s.log.masks.map((m) => m[0]), [true, false]);
});

test("close acceptance: short reason, missing id and RPC failure are refused/handled without a refresh", async () => {
  const short = setup();
  short.ctl.openMaterialReviewCloseAcceptanceModal(ACCEPTANCE);
  short.dom.materialReviewCloseReason.value = "too short";
  await short.dom.materialReviewCloseReason.fire("input");
  assert.equal(short.dom.materialReviewCloseAcceptanceSaveBtn.disabled, true);
  await saveClose(short);
  assert.equal(short.log.rpc.length, 0);
  assert.deepEqual(short.log.toasts.at(-1).slice(0, 2), ["Close reason must be at least 10 characters.", "error"]);

  const none = setup();
  await saveClose(none);
  assert.deepEqual(none.log.toasts.at(-1).slice(0, 2), ["Acceptance ID missing.", "error"]);
  const noId = setup();
  noId.ctl.openMaterialReviewCloseAcceptanceModal({ ...ACCEPTANCE, acceptance_id: null });
  noId.dom.materialReviewCloseReason.value = "A long enough reason";
  await saveClose(noId);
  assert.equal(noId.log.rpc.length, 0);

  const fail = setup();
  fail.ctl.openMaterialReviewCloseAcceptanceModal(ACCEPTANCE);
  fail.dom.materialReviewCloseReason.value = "A long enough reason";
  fail.state.rpcResult = { data: null, error: new Error("denied") };
  await saveClose(fail);
  assert.equal(fail.log.errors[0][0], "Failed to close acceptance");
  assert.equal(fail.log.refresh.length, 0);
  assert.equal(fail.dom.materialReviewCloseAcceptanceModal.hidden, false);
});

// ---- source-level safety guards ----------------------------------------------------------------------------------
test("source: each acceptance RPC name is used exactly once, only via costingRpc; module never calls approval/finalise/lock RPCs or supabase.rpc directly", () => {
  for (const name of ["rpc_accept_material_review_action", "rpc_close_material_review_acceptance"]) {
    assert.equal(SRC.split(`"${name}"`).length - 1, 1, name);
    assert.match(SRC, new RegExp(`costingRpc\\(\\s*"${name}"`));
  }
  assert.doesNotMatch(SRC, /\bsupabase\s*\.\s*rpc\s*\(/);
  assert.doesNotMatch(SRC, /\.rpc\(/);
  for (const forbidden of [
    "rpc_costing_approve_run", "rpc_costing_approve_run_with_preview", "rpc_costing_finalize_monthend_run",
    "rpc_costing_supersede_approved_run", "rpc_accept_regional_marketing_review", "rpc_accept_sales_allocation_quantity_driver_review",
  ]) assert.ok(!SRC.includes(forbidden), forbidden);
  assert.deepEqual([...new Set(SRC.match(/rpc_[a-z_]*accept[a-z_]*/g))].sort(), ["rpc_accept_material_review_action", "rpc_close_material_review_acceptance"].filter((n) => /accept/.test(n)).sort());
});

test("source: acceptance is single-row (no bulk/loop over rows) and guarded by the edit check before every write", () => {
  const body = (name, next) => { const i = SRC.indexOf(`async function ${name}(`); return SRC.slice(i, SRC.indexOf(next, i)); };
  const accept = body("saveMaterialReviewAcceptance", "async function saveMaterialReviewCloseAcceptance");
  const close = body("saveMaterialReviewCloseAcceptance", "function renderControlWorkbenchSummaryTab");
  for (const b of [accept, close]) {
    assert.match(b, /^[^]*?if \(!guardMaterialCostWriteAction\(\)\) return;/);
    assert.doesNotMatch(b, /\.(forEach|map|filter|reduce)\(|\bfor\s*\(|\bwhile\s*\(/, "no bulk iteration around the write");
    assert.equal((b.match(/costingRpc\(/g) || []).length, 1);
  }
  assert.ok(accept.indexOf("guardMaterialCostWriteAction") < accept.indexOf("costingRpc("));
  assert.ok(accept.indexOf("isMaterialReviewAcceptEligible(row)") < accept.indexOf("costingRpc("));
});
