// WP05-W506 personnel confidentiality: DYNAMIC tests. The real shell functions (loadRowsForLens, loadPermissions, personnelAccessAllowed,
// applyPermissionEntriesFromRpc, the CSV click guard) and the real controller are executed in a vm sandbox with controllable promises.
// No network, no database. Run: node --test scripts/costing-w506-conf-client/staff-governance-dynamic.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const shellSrc = readFileSync(join(root, "public/shared/js/costing-suite-shell.js"), "utf8").replace(/\r\n/g, "\n");
const cb = await import(join(root, "public/shared/js/costing-suite-cost-build.js"));

function extractFn(src, name) {
  let start = src.indexOf(`\nfunction ${name}(`);
  const a = src.indexOf(`\nasync function ${name}(`);
  if (start < 0 || (a >= 0 && a < start)) start = a;
  assert.ok(start >= 0, `function ${name} found`);
  return src.slice(start + 1, src.indexOf("\n}\n", start) + 2);
}
globalThis.document = globalThis.document || new Proxy({ activeElement: null, body: {}, contains: () => false }, { get: (t, k) => (k in t ? t[k] : () => null) });
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const deep = () => new Proxy(function () {}, { get: () => deep(), apply: () => undefined });

function makeShell() {
  const log = { purge: 0, status: [], toasts: [], applyFilters: 0, requests: [], exports: 0 };
  const state = { pending: [] };
  const modal = { hidden: false, classList: { contains: (c) => c === "hidden" && modal.hidden, add: (c) => { if (c === "hidden") modal.hidden = true; }, remove: () => { modal.hidden = false; } }, setAttribute() {} };
  const mkChain = (view) => { const q = { view, cols: null }; log.requests.push(q); const ch = { select(c) { q.cols = c; return ch; }, eq() { return ch; }, order() { return ch; } }; return ch; };
  const perms = { rows: [] };
  const ctx = vm.createContext({
    console, Array, Map, Promise, String, Number,
    CURRENT_LENS: "staff-governance", ACTIVE_PERIOD_START: "2026-11-01", ROWS_LOAD_GENERATION: 0, softNavLockLens: null,
    ALL_ROWS: [], VIEW: [], CURRENT_PAGE: 1, LAST_REFRESH_TIME: null,
    PERM_CAN_VIEW: false, PERM_CAN_EDIT: false, PERM_CONTROL_CENTER_EDIT: false, PERM_PRM_EDIT: false, PERMISSIONS_LOAD_ERROR: false,
    TRACE_PERMISSIONS_RESOLVED: false, CAN_VIEW_TRACE: false, CAN_EXPORT_TRACE: false, CAN_VIEW_RM_TRACE: false, CAN_EXPORT_RM_TRACE: false,
    CAN_VIEW_PM_TRACE: false, CAN_EXPORT_PM_TRACE: false,
    ACTIVE_ROUTE_CONFIG: { permissionTarget: "module:cost-build-manager" },
    document: new Proxy({}, { get: () => () => null }), window: { location: { search: '' } }, VIEW_BY_LENS: {}, LENSES: [], tableBody: { replaceChildren() { log.tableCleared = (log.tableCleared || 0) + 1; } }, tableWrap: null, searchBox: null,
    statusArea: null,
    supabase: { rpc: () => { const d = deferred(); state.pending.push(d); return d.promise; } },
    setLoadingMask() {}, showToast: (m, t) => log.toasts.push([m, t]), setStatus: (m, t) => log.status.push([m, t]),
    updateFreshnessIndicator() {}, applyFilters() { log.applyFilters++; ctx.APPLIED = ctx.ALL_ROWS.slice(); }, renderTable() {},
    syncRefreshButtonDisabled() {}, syncTraceExportButtonState() {}, syncPricingPolicyPermissionUi() {},
    runStatusBadge: deep(), costSheetCtrl: deep(), controlCenterCtrl: deep(), portfolioReadinessCtrl: deep(), recalculationCtrl: deep(), periodDateStatus: deep(),
    costingApprovalScreenCtrl: deep(), materialCostCtrl: deep(), pricingPolicyCtrl: deep(), schemeComparisonCtrl: deep(),
    handleError: (m, e) => log.status.push(["ERR " + m, String(e)]),
    exportActiveViewCsv() { log.exports++; },
    exportBtn: { listeners: {}, addEventListener(ev, fn) { this.listeners[ev] = fn; } },
  });
  // unknown helper calls on the path to the staff branch behave as "false"
  const loadSrc = extractFn(shellSrc, "loadRowsForLens");
  const permSrc = extractFn(shellSrc, "loadPermissions");
  const applySrc = extractFn(shellSrc, "applyPermissionEntriesFromRpc");
  const own = new Set(["loadRowsForLens", "loadPermissions", "applyPermissionEntriesFromRpc", "isRowsLoadCurrent", "personnelAccessAllowed", "setLoadingMask", "showToast", "setStatus", "applyFilters", "renderTable", "handleError", "exportActiveViewCsv", "updateFreshnessIndicator", "syncRefreshButtonDisabled", "syncTraceExportButtonState", "syncPricingPolicyPermissionUi"]);
  const called = new Set([...loadSrc.matchAll(/\b([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]));
  const kw = new Set(["if", "for", "while", "switch", "catch", "function", "return", "await", "typeof", "async", "Number", "String", "Boolean", "Array", "Date", "Math", "Promise", "Object", "JSON", "parseInt"]);
  const mis = [...called].filter((n) => !own.has(n) && !kw.has(n) && !(n in ctx) && !/^(costBuildCtrl)$/.test(n));
  vm.runInContext(mis.map((n) => `function ${n}() { return false; }`).join("\n"), ctx);
  // the real controller + the real shell functions
  const ctrl = cb.createCostBuildController({
    dom: { staffClassificationEditModal: modal }, costingFrom: mkChain, costingRpc: async () => ({ error: null }),
    fetchAllRows: async (build) => { const ch = build(); const d = deferred(); state.pending.push(d); return d.promise; },
    showToast: (m, t) => log.toasts.push([m, t]), handleError() {}, setLoadingMask() {}, setVisible() {},
    text: String, escapeHtml: String, formatMoney: String, formatNumber: String, formatDate: String, formatDateTime: String, compactStatusText: String,
    normalizeStatus: (v) => String(v ?? "").toUpperCase(), cpCellPrimary: String, cpCellPrimaryHtml: String, detailPanel() {}, kvSection() {}, activePeriodIso: () => "2026-11-01",
    numberOrNullFromInput: Number, normalizeMonthStart: (v) => v, getCurrentMonthStart: () => "2026-11-01", reloadRows() {}, renderTable() {}, updateSearchClear() {}, getSearchValue: () => "",
    getCurrentLens: () => ctx.CURRENT_LENS, setRowsAndView() {}, closeDetails() {}, getActivePeriodStart: () => "2026-11-01",
    canViewPersonnel: () => vm.runInContext("personnelAccessAllowed()", ctx), canEditPersonnel: () => vm.runInContext("personnelAccessAllowed()", ctx),
  });
  const spied = { ...ctrl, purgeStaffGovernanceState() { log.purge++; ctrl.purgeStaffGovernanceState(); } };
  ctx.costBuildCtrl = spied;
  vm.runInContext([extractFn(shellSrc, "personnelAccessAllowed"), extractFn(shellSrc, "isRowsLoadCurrent"), applySrc, permSrc, loadSrc].join("\n"), ctx);
  // the real export click guard from the shell source
  const click = shellSrc.slice(shellSrc.indexOf('exportBtn?.addEventListener("click", () => {'));
  vm.runInContext(click.slice(0, click.indexOf("\n});\n") + 5).replace("exportBtn?.addEventListener", "exportBtn.addEventListener"), ctx);
  return { ctx, log, state, modal, ctrl,
    grant: (view, edit) => { ctx.PERM_CAN_VIEW = view; ctx.PERM_CAN_EDIT = edit; },
    run: (code) => vm.runInContext(code, ctx),
    permRows: (view, edit) => [{ target: "module:cost-build-manager", can_view: view, can_edit: edit }],
  };
}
const ROWS = [{ staff_id: 1, employee_code: "SYN-1", total_salary_cost: 1 }];
const tick = () => new Promise((r) => setImmediate(r));
// the staff tab is "staff-review" by default (internal controller state)

test("baseline: authorised editor load assigns and renders the response", async () => {
  const s = makeShell(); s.grant(true, true);
  const p = s.run("loadRowsForLens()"); await tick();
  s.state.pending.shift().resolve(ROWS); await p;
  assert.equal(s.ctx.ALL_ROWS.length, 1); assert.equal(s.log.status.length, 0);
});

test("restricted identities: no request is issued and nothing is rendered (unauthorised, CBM view-only, edit-without-view)", async () => {
  for (const [v, e] of [[false, false], [true, false], [false, true]]) {
    const s = makeShell(); s.grant(v, e);
    await s.run("loadRowsForLens()");
    assert.equal(s.log.requests.length, 0); assert.equal(s.ctx.ALL_ROWS.length, 0);
    assert.ok(s.log.status.some(([m]) => /view and edit permission/.test(m)));
  }
});

test("late response after PERMISSION LOSS without a new load (same generation): the stale rows are never assigned or rendered, state purged", async () => {
  const s = makeShell(); s.grant(true, true);
  const p = s.run("loadRowsForLens()"); await tick();
  s.grant(false, false);                                   // access revoked while the staff query is in flight
  s.state.pending.shift().resolve(ROWS); await p;
  assert.equal(s.ctx.ALL_ROWS.length, 0, "stale response not assigned"); assert.equal(s.ctx.VIEW.length, 0);
  assert.equal(s.ctx.APPLIED?.length ?? 0, 0, "nothing rendered from the late response");
  assert.ok(s.log.purge >= 1);
});

test("late response after a permission REFRESH (loadPermissions bumps the generation): stale rows are discarded; rows visible before refresh are cleared immediately", async () => {
  const s = makeShell(); s.grant(true, true);
  s.ctx.ALL_ROWS = ROWS.slice(); s.ctx.VIEW = ROWS.slice();      // data already on screen
  const p = s.run("loadRowsForLens()"); await tick();
  const refresh = s.run("loadPermissions('user-1')");           // refresh starts: must clear BEFORE awaiting the RPC
  assert.equal(s.ctx.ALL_ROWS.length, 0, "displayed rows cleared synchronously"); assert.equal(s.ctx.VIEW.length, 0);
  assert.ok(s.log.tableCleared >= 1, "table body cleared");
  assert.equal(s.ctx.PERM_CAN_VIEW, false); assert.equal(s.ctx.PERM_CAN_EDIT, false, "grants dropped until the RPC resolves");
  s.state.pending.shift().resolve(ROWS); await p;               // late staff response
  assert.equal(s.ctx.ALL_ROWS.length, 0, "late response discarded (generation changed)");
  s.state.pending.shift().resolve({ data: s.permRows(true, true), error: null }); await refresh;
  assert.equal(s.ctx.PERM_CAN_EDIT, true, "authorised again only after the RPC");
});

test("permission REVOCATION via refresh result: after the RPC returns view-only, personnel access is false and a reload shows nothing", async () => {
  const s = makeShell(); s.grant(true, true);
  const refresh = s.run("loadPermissions('user-1')"); s.state.pending.shift().resolve({ data: s.permRows(true, false), error: null }); await refresh;
  assert.equal(s.run("personnelAccessAllowed()"), false);
  await s.run("loadRowsForLens()");
  assert.equal(s.log.requests.length, 0); assert.equal(s.ctx.ALL_ROWS.length, 0);
});

test("permission RPC failure fails closed (PERMISSIONS_LOAD_ERROR): no personnel access", async () => {
  const s = makeShell();
  const refresh = s.run("loadPermissions('user-1')"); s.state.pending.shift().resolve({ data: null, error: { message: "x" } }); await refresh;
  assert.equal(s.ctx.PERMISSIONS_LOAD_ERROR, true); assert.equal(s.run("personnelAccessAllowed()"), false);
});

test("TAB CHANGE / superseded load: an older in-flight staff response can never overwrite a newer one", async () => {
  const s = makeShell(); s.grant(true, true);
  const p1 = s.run("loadRowsForLens()"); await tick();
  const p2 = s.run("loadRowsForLens()"); await tick();          // user switched tab: a newer load supersedes
  const [d1, d2] = s.state.pending.splice(0, 2);
  d2.resolve([{ staff_id: 2 }]); await p2;
  d1.resolve([{ staff_id: 1 }, { staff_id: 9 }]); await p1;
  assert.deepEqual(s.ctx.ALL_ROWS.map((r) => r.staff_id), [2]);
});

test("TAB CHANGE to a personnel tab while denied: no request; pool-summary tab still loads aggregates only", async () => {
  const s = makeShell(); s.grant(true, false);
  const btn = (tab) => ({ dataset: { staffGovernanceTab: tab }, addEventListener(_e, fn) { this.fn = fn; } });
  for (const [tab, expectReq] of [["staff-register", 0], ["staff-review", 0], ["staff-pool-summary", 1]]) {
    s.log.requests.length = 0; s.state.pending.length = 0;
    const b = btn(tab);
    s.ctrl.renderStaffGovernanceTabs({ classList: { add() {} }, set innerHTML(_v) {}, querySelectorAll: () => [b] }, async () => {});
    await b.fn?.();
    const p = s.run("loadRowsForLens()"); await tick();
    assert.equal(s.log.requests.length, expectReq, tab);
    if (expectReq) { assert.ok(!s.log.requests[0].cols.includes("staff_details")); s.state.pending.shift().resolve([]); }
    await p;
  }
});

test("MODAL CLOSURE: purge on permission loss closes an open edit modal and discards the retained row; edit is then refused", async () => {
  const s = makeShell(); s.grant(true, true);
  s.modal.hidden = false;                                         // modal open with a retained staff row
  s.grant(false, false);
  s.run("costBuildCtrl.purgeStaffGovernanceState()");
  assert.equal(s.modal.hidden, true, "modal closed");
  s.ctrl.openStaffClassificationEditModal(ROWS[0]);
  assert.ok(s.log.toasts.some(([m, t]) => /permission/i.test(m) && t === "error"), "re-opening is refused without permission");
  const p = s.run("loadPermissions('user-1')");                  // refresh also purges
  assert.ok(s.log.purge >= 1); s.state.pending.shift().resolve({ data: [], error: null }); await p;
});

test("CSV EXPORT: blocked and nothing exported while restricted; allowed for the authorised editor; blocked again after revocation", async () => {
  const s = makeShell();
  s.grant(false, false); s.ctx.exportBtn.listeners.click();
  assert.equal(s.log.exports, 0); assert.ok(s.log.toasts.some(([m]) => /export requires/i.test(m)));
  s.grant(true, false); s.ctx.exportBtn.listeners.click(); assert.equal(s.log.exports, 0, "view-only blocked");
  s.grant(true, true); s.ctx.exportBtn.listeners.click(); assert.equal(s.log.exports, 1, "editor allowed");
  s.grant(false, false); s.ctx.exportBtn.listeners.click(); assert.equal(s.log.exports, 1, "blocked again after revocation");
  s.ctx.CURRENT_LENS = "dashboard"; s.ctx.exportBtn.listeners.click(); assert.equal(s.log.exports, 2, "other lenses unaffected");
});

test("SIGN-OUT: an auth SIGNED_OUT event purges staff rows, edit state and grants and invalidates in-flight loads", async () => {
  const sh = readFileSync(join(root, "public/shared/js/costing-suite-shell.js"), "utf8");
  assert.ok(/supabase\.auth\.onAuthStateChange\(/.test(sh) && sh.includes('"SIGNED_OUT"') && sh.includes("function purgePersonnelOnSignOut()"), "sign-out handler is registered in the shell");
  const s = makeShell(); s.grant(true, true);
  s.ctx.ALL_ROWS = ROWS.slice(); s.ctx.VIEW = ROWS.slice();
  const p = s.run("loadRowsForLens()"); await tick();
  vm.runInContext(extractFn(shellSrc, "purgePersonnelOnSignOut"), s.ctx);
  s.run("purgePersonnelOnSignOut()");
  assert.equal(s.ctx.ALL_ROWS.length, 0); assert.equal(s.ctx.VIEW.length, 0);
  assert.equal(s.ctx.PERM_CAN_VIEW, false); assert.equal(s.ctx.PERM_CAN_EDIT, false);
  assert.ok(s.log.purge >= 1);
  s.state.pending.shift().resolve(ROWS); await p;
  assert.equal(s.ctx.ALL_ROWS.length, 0, "in-flight response discarded after sign-out");
});
