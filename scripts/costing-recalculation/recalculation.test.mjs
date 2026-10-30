import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRecalculationController, createPeriodDateStatus, periodDateText, periodOfficialDateText, recalculationSuccessText, EMPTY_DATE_HELP } from "../../public/shared/js/costing-recalculation.js";
import { mapCostingApprovalError } from "../../public/shared/js/costing-approval-errors.js";
import { createRunStatusBadge, RUN_STATUS_SELECT_V1, RUN_STATUS_SELECT_APPROVAL_V1, describeRunStatus } from "../../public/shared/js/costing-run-status-badge.js";
import { describeRunStatusForApprovalFlag } from "../../public/shared/js/costing-approval-labels.js";
import { isCostingRecalcWithDateV1Enabled } from "../../public/shared/js/costing-feature-flags.js";

const read = name => fs.readFileSync(new URL("../../" + name, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const shell = read("public/shared/js/costing-suite-shell.js");
const baseShell = execFileSync("git", ["show", "HEAD:public/shared/js/costing-suite-shell.js"], { encoding: "utf8" }).replace(/\r\n/g, "\n");
function fn(src, name) {
  const start = src.indexOf("function " + name + "(");
  assert.ok(start >= 0, name);
  const end = src.indexOf("\n}", start);
  return src.slice(start, end + 2);
}
const result = { refresh_run_id: 144, period_start: "2026-10-01", valuation_date: "2026-10-29", action: "NEW_REFRESH_RUN_CREATED", pricing_note: "Not for pricing until approved." };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture(overrides = {}) {
  let period = "2026-10-01";
  const calls = [], toasts = [];
  let reloads = 0, invalidations = 0;
  const controller = createRecalculationController({
    costingRpc: async (...args) => { calls.push(args); return { data: result }; },
    getPeriod: () => period, canEdit: () => true,
    invalidateBadge: () => invalidations++,
    reloadStatus: async () => { reloads++; },
    showToast: (...args) => toasts.push(args), doc: null, ...overrides,
  });
  controller.onPeriodChange();
  return { controller, calls, toasts, change: p => { period = p; controller.onPeriodChange(); }, counts: () => ({ reloads, invalidations }) };
}

test("flag defaults off, including inaccessible storage", () => {
  assert.equal(isCostingRecalcWithDateV1Enabled({ getItem: () => null }), false);
  assert.equal(isCostingRecalcWithDateV1Enabled({ getItem() { throw Error(); } }), false);
});
test("jsonb object: exact payload, server success fields, one reload", async () => {
  const f = fixture();
  assert.deepEqual(await f.controller.submit({ reason: "Business reason" }), { data: result });
  assert.deepEqual(f.calls, [["rpc_costing_request_recalculation", { p_period_start: "2026-10-01", p_reason: "Business reason" }]]);
  assert.deepEqual(f.counts(), { reloads: 1, invalidations: 1 });
  assert.equal(f.toasts[0][0], recalculationSuccessText(result));
  for (const value of Object.values(result)) assert.ok(f.toasts[0][0].includes(String(value)));
});
test("optional date passes through, short reason reaches server", async () => {
  const f = fixture();
  await f.controller.submit({ reason: "x", valuationDate: "2040-01-01" });
  assert.equal(f.calls[0][1].p_valuation_date, "2040-01-01");
  assert.equal(f.calls[0][1].p_reason, "x");
});
test("double submit sends one request", async () => {
  const d = deferred(); let calls = 0;
  const f = fixture({ costingRpc: () => { calls++; return d.promise; } });
  const first = f.controller.submit({ reason: "a reason" });
  assert.deepEqual(await f.controller.submit({ reason: "another" }), { ignored: true });
  d.resolve({ data: result }); await first;
  assert.equal(calls, 1);
  assert.equal(f.counts().reloads, 1);
});
test("late success after period changes invalidates cache without painting stale result", async () => {
  const d = deferred(); const f = fixture({ costingRpc: () => d.promise });
  const first = f.controller.submit({ reason: "a reason" });
  f.change("2026-09-01"); f.change("2026-10-01");
  d.resolve({ data: result });
  assert.deepEqual(await first, { stale: true });
  assert.deepEqual(f.counts(), { invalidations: 1, reloads: 0 });
  assert.equal(f.toasts.length, 0);
});
test("late refusal after period change does not paint", async () => {
  const d = deferred(); const f = fixture({ costingRpc: () => d.promise });
  const first = f.controller.submit({ reason: "a reason" });
  f.change("2026-09-01"); d.resolve({ error: { code: "P0001", message: "W2_ACTIVE_RUN: wait" } });
  assert.deepEqual(await first, { stale: true });
  assert.equal(f.toasts.length, 0);
});
test("edit permission required, no owner gate", async () => {
  const f = fixture({ canEdit: () => false });
  await f.controller.submit({ reason: "a reason" });
  assert.equal(f.calls.length, 0);
  assert.match(f.toasts[0][0], /edit permission/);
  assert.doesNotMatch(f.toasts[0][0], /owner/i);
});
test("array response is rejected, not normalised", async () => {
  const f = fixture({ costingRpc: async () => ({ data: [result] }) });
  assert.ok((await f.controller.submit({ reason: "a reason" })).error);
  assert.equal(f.counts().reloads, 0);
});
test("refusal makes no reload or retry", async () => {
  let calls = 0;
  const f = fixture({ costingRpc: async () => { calls++; return { error: { code: "P0001", message: "W2_ACTIVE_RUN: waiting" } }; } });
  await f.controller.submit({ reason: "a reason" });
  assert.equal(calls, 1); assert.equal(f.counts().reloads, 0);
  assert.equal(f.toasts[0][0], "A costing run is still in progress for this month. Try again when it finishes.\nW2_ACTIVE_RUN: waiting");
});
test("status reload failure does not resend a successful request", async () => {
  const f = fixture({ reloadStatus: async () => { throw Error(); } });
  assert.ok((await f.controller.submit({ reason: "a reason" })).data);
  assert.equal(f.calls.length, 1);
  assert.match(f.toasts[1][0], /Status could not be reloaded/);
});
for (const [code, message] of [
  ["W2_RUN_DATE_BEFORE_APPROVED", "The date is before the approved run's date. Choose a later date."],
  ["CI041_FUTURE_DATE", "The date cannot be in the future."],
  ["CI041_DATE_OUTSIDE_PERIOD", "The date must fall within the month."],
  ["CI041_BAD_PERIOD", "The month is not valid. Reload and choose the month again."],
  ["CI041_DATE_REQUIRED", "A month and date are required."],
  ["W2_REASON_REQUIRED", "Please enter a reason (at least 10 characters)."],
  ["W2_AUTH_REQUIRED", "Please sign in again."],
]) test(code + " maps by message prefix despite P0001", () => {
  assert.equal(mapCostingApprovalError({ code: "P0001", message: code + ": server detail" }).title, message);
});
for (const message of ["Recalculation is only for an OPEN period", "Costing period 2026-10-01 does not exist"]) test("uncoded period refusal: " + message, () => {
  assert.equal(mapCostingApprovalError(message).title, "This month is locked or closed; no recalculation is possible.");
});
test("uncoded authentication and permission mappings remain unchanged", () => {
  assert.equal(mapCostingApprovalError("Not authenticated").title, "Please sign in again.");
  assert.equal(mapCostingApprovalError("permission denied for module:costing-control-center").title, "You don't have edit permission for the Costing Control Centre.");
});
test("unknown first line and coded precedence", () => {
  assert.equal(mapCostingApprovalError("New refusal\nprivate second line").detail, "New refusal");
  assert.equal(mapCostingApprovalError("CI041_FUTURE_DATE: period does not exist").title, "The date cannot be in the future.");
});
test("does not exist text is narrowly scoped", () => {
  assert.equal(mapCostingApprovalError("MONTHEND_RUN_NOT_FOUND: run 5 does not exist").kind, "MONTHEND_RUN_NOT_FOUND");
  assert.equal(mapCostingApprovalError("function public.x(date) does not exist").kind, "unknown");
});
test("success text omits null optional fields", () => {
  assert.equal(
    recalculationSuccessText({ ...result, pricing_note: null, action: null }),
    "Draft run 144 requested for 2026-10-01 at 2026-10-29.",
  );
});
test("labels distinguish official/draft and null official", () => {
  assert.equal(periodDateText({ official_valuation_date: "2026-10-22", latest_draft_valuation_date: "2026-10-29" }), "Official (approved) date: 2026-10-22 \u00b7 Latest draft date: 2026-10-29");
  assert.equal(periodDateText(null), "Official (approved) date: Not approved \u00b7 Latest draft date: \u2014");
  assert.equal(periodOfficialDateText({ official_valuation_date: "2026-10-22", latest_draft_valuation_date: "2026-10-29" }), "2026-10-22");
});
test("period status ignores out-of-order responses", async () => {
  let period = "2026-10-01"; const a = deferred(), b = deferred(); let n = 0;
  const status = createPeriodDateStatus({ getPeriod: () => period, supabase: { from() { return { select() { return this; }, eq() { return this; }, maybeSingle() { return (++n === 1 ? a : b).promise; } }; } } });
  const first = status.reload(); period = "2026-09-01"; const second = status.reload();
  b.resolve({ data: { period_start: period, official_valuation_date: "2026-09-10" } }); await second;
  a.resolve({ data: { period_start: "2026-10-01" } }); assert.equal(await first, null);
  assert.equal(status.get().official_valuation_date, "2026-09-10");
  assert.equal(status.get("2026-10-01"), null);
});
for (const recalc of [false, true]) for (const approval of [false, true]) test(`badge flags recalc=${recalc}, approval=${approval}`, async () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => (key === "COSTING_RECALC_WITH_DATE_V1" ? recalc : approval) ? "1" : null };
  try {
    let select; const node = { dataset: {}, setAttribute() {} };
    const row = { period_start: "2026-10-01", display_state: "APPROVED", display_label: "Old label", display_label_v2: "New label", official_valuation_date: "2026-10-22", latest_draft_valuation_date: "2026-10-29" };
    const badge = createRunStatusBadge({ supabase: { from() { return { select(value) { select = value; return this; }, eq() { return this; }, async maybeSingle() { return { data: row }; } }; } }, anchor: { insertAdjacentElement() {} }, doc: { createElement: () => node } });
    await badge.refresh({ periodStart: row.period_start, lensId: "dashboard" });
    assert.equal(select, recalc || approval ? RUN_STATUS_SELECT_APPROVAL_V1 : RUN_STATUS_SELECT_V1);
    assert.equal(node.title, (approval ? describeRunStatusForApprovalFlag(row) : describeRunStatus(row)).title);
    let opens = 0; const legacyCalls = [];
    const toolbar = new Function("isCostingRecalcWithDateV1Enabled", "recalculationCtrl", "runStagedCostingRefreshAndReload", "return async " + fn(shell, "requestCostingRefreshFromToolbar"))(
      () => recalc,
      { open() { opens++; } },
      async args => legacyCalls.push(args),
    );
    await toolbar();
    assert.equal(opens, +recalc);
    assert.equal(legacyCalls.length, recalc ? 0 : 1);
  } finally { globalThis.localStorage = previous; }
});
test("toolbar dispatch toggles, OFF staged call stays byte-identical", async () => {
  assert.equal(fn(shell, "requestStagedCostingRefresh"), fn(baseShell, "requestStagedCostingRefresh"));
  const body = fn(shell, "requestCostingRefreshFromToolbar");
  for (const flag of [false, true]) {
    let opens = 0; const calls = [];
    const run = new Function("isCostingRecalcWithDateV1Enabled", "recalculationCtrl", "runStagedCostingRefreshAndReload", "return async " + body)(() => flag, { open() { opens++; } }, async args => calls.push(args));
    await run();
    assert.equal(opens, +flag);
    assert.deepEqual(calls, flag ? [] : [{ sourceTrigger: "UI_TOOLBAR", requestNote: "Toolbar request costing refresh" }]);
  }
});
test("PRM dispatch unchanged and never opens recalculation", () => {
  assert.equal(fn(shell, "onCostingSuiteRefreshClick"), fn(baseShell, "onCostingSuiteRefreshClick"));
  let prm = 0, toolbar = 0;
  const click = new Function("isProductionRouteManagerRoute", "refreshProductionRouteManagerLens", "refreshCostingChain", "return " + fn(shell, "onCostingSuiteRefreshClick"))(() => true, () => prm++, () => toolbar++);
  click({ preventDefault() {} }); assert.equal(prm, 1); assert.equal(toolbar, 0);
});
test("material acceptance remains byte-identical and calls old staged function in both flag states", async () => {
  const path = "public/shared/js/costing-suite-material-cost.js";
  assert.equal(read(path), execFileSync("git", ["show", "HEAD:" + path], { encoding: "utf8" }).replace(/\r\n/g, "\n"));
  const src = read(path); const start = src.indexOf("  async function finalizeMaterialReviewAcceptanceAction(");
  const end = src.indexOf("\n  async function ", start + 10);
  const body = src.slice(start, end);
  assert.match(body, /await runStagedCostingRefreshAndReload/);
  assert.doesNotMatch(body, /isCostingRecalc|recalculationCtrl/);
  for (const flag of [false, true]) {
    const calls = [];
    const run = new Function("showToast", "runStagedCostingRefreshAndReload", "reloadMaterialReviewWorkbenchData", "isCostingRecalcWithDateV1Enabled", "return " + body)(() => {}, async args => calls.push(args), async () => {}, () => flag);
    await run("Saved", "MATERIAL_ACCEPTANCE", "Reason");
    assert.deepEqual(calls, [{ sourceTrigger: "MATERIAL_ACCEPTANCE", requestNote: "Reason" }]);
  }
});
test("governed module has no old poller, date maths, date bounds or retry", () => {
  const src = read("public/shared/js/costing-recalculation.js");
  assert.doesNotMatch(src, /normalizeRefreshStatusRow|runStagedCostingRefreshAndReload|rpc_get_costing_refresh_status|new Date|setTimeout|setInterval|\bmin=|\bmax=|minLength/);
  assert.ok(src.includes(EMPTY_DATE_HELP));
  assert.match(src, /mapped.kind !== "unknown"/);
  assert.doesNotMatch(shell, /paintPeriodDateContext|costingPeriodDateContext/);
  const readinessChip = shell.match(/function paintReadinessValuationFromContext[\s\S]*?\n}/)?.[0] || "";
  assert.match(readinessChip, /chipValue\.textContent = periodOfficialDateText\(periodStatus\)/);
  assert.match(readinessChip, /chipBtn\.title = periodDateText\(periodStatus\)/);
  const html = read("public/shared/costing-control-center.html");
  assert.match(html, /\.search-card \.cpv-chip\s*\{[\s\S]*max-width:\s*min\(100%, 220px\)[\s\S]*overflow:\s*hidden/);
  assert.match(html, /\.search-card \.cpv-chip\s*\{[\s\S]*white-space:\s*nowrap/);
  assert.match(html, /\.search-card \.cpv-chip-value\s*\{[\s\S]*text-overflow:\s*ellipsis/);
});
test("new forbidden valuation name is guarded; legacy controls have ON guards", () => {
  const helpers = read("public/shared/js/costing-suite-cost-period-valuation-helpers.js");
  assert.match(helpers.split("COST_PERIOD_VALUATION_FORBIDDEN_SUBSTRINGS")[1], /rpc_costing_request_recalculation/);
  const cpv = read("public/shared/js/costing-suite-cost-period-valuation.js");
  assert.match(cpv, /const hasEdit = !isCostingRecalcWithDateV1Enabled\(\)/);
  assert.match(cpv, /async function confirmChange\(\) {\s*if \(isCostingRecalcWithDateV1Enabled\(\)\) return;/);
});


function fakeDocument() {
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) {
      const attrs = new Map(), classes = new Set(["hidden"]);
      nodes.set(id, {
        id, hidden: false, disabled: false, value: "", dataset: {}, textContent: "", innerHTML: "", handlers: {},
        classList: { contains: x => classes.has(x), add: x => classes.add(x), remove: x => classes.delete(x), toggle(x, on) { if (on) classes.add(x); else classes.delete(x); } },
        setAttribute: (k, v) => attrs.set(k, v), getAttribute: k => attrs.get(k), removeAttribute: k => attrs.delete(k),
        addEventListener(name, handler) { this.handlers[name] = handler; },
        focus() { this.focused = true; },
        querySelector: () => node("stripBody"),
        close() { this.closed = true; }, showModal() { this.closed = false; },
        reset() { for (const n of nodes.values()) n.value = ""; },
      });
    }
    return nodes.get(id);
  }
  return {
    node, nodes,
    getElementById: node,
    querySelectorAll(selector) {
      if (selector === "[data-cpv-tab]" || selector === "[data-cpv-panel]") {
        const attr = selector.slice(1, -1);
        return ["overview", "change", "history"].map(name => {
          const n = node(attr + name); n.setAttribute(attr, name); return n;
        });
      }
      return [];
    },
    createElement: () => node("created"),
    body: { append() {} },
  };
}

test("dialog shows exact help, confirms selected date, cancel sends no RPC, submit uses form values", async () => {
  const doc = fakeDocument(); const calls = [];
  const controller = createRecalculationController({
    doc, costingRpc: async (...args) => { calls.push(args); return { data: result }; },
    getPeriod: () => "2026-10-01", canEdit: () => true,
    invalidateBadge() {}, reloadStatus: async () => {}, showToast() {},
  });
  controller.open();
  assert.ok(doc.node("created").innerHTML.includes(EMPTY_DATE_HELP));
  assert.equal(doc.node("created").className, "costing-recalculation-dialog");
  assert.match(doc.node("created").innerHTML, /class="cost-sheet-sign-panel"/);
  assert.match(doc.node("created").innerHTML, /class="cost-sheet-sign-header"/);
  assert.match(doc.node("created").innerHTML, /class="cost-sheet-sign-body"/);
  assert.match(doc.node("created").innerHTML, /class="cost-sheet-sign-actions"/);
  assert.match(doc.node("created").innerHTML, /id="recalcSubmit"[^>]*class="icon-btn icon-btn-primary"/);
  assert.match(doc.node("created").innerHTML, /id="recalcClose"[^>]*class="icon-btn"/);
  assert.match(doc.node("created").innerHTML, /id="recalcReason" class="form-control"/);
  const css = read("public/shared/css/sasv-costing.css");
  assert.match(css, /#costingRecalculationDialog\s*\{[\s\S]*max-width:\s*480px/);
  assert.match(css, /#costingRecalculationDialog::backdrop\s*\{\s*background:\s*color-mix\(in srgb, var\(--sasv-text, #0f172a\) 28%, transparent\)/);
  assert.match(css, /#costingRecalculationDialog \.sign-grid\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(doc.node("created").innerHTML, /aria-describedby="recalcDateHelp"/);
  assert.equal(
    doc.node("recalcConfirmation").textContent,
    "A new draft will be costed at the date the server chooses (today, India date, or the month's last day if the month has ended). It is not used for pricing until approved.",
  );
  assert.equal(doc.node("recalcReason").focused, true);
  doc.node("recalcDate").value = "";
  doc.node("recalcDate").handlers.input();
  assert.equal(
    doc.node("recalcConfirmation").textContent,
    "A new draft will be costed at the date the server chooses (today, India date, or the month's last day if the month has ended). It is not used for pricing until approved.",
  );
  doc.node("recalcDate").value = "2026-10-25";
  doc.node("recalcDate").handlers.input();
  assert.match(doc.node("recalcConfirmation").textContent, /at 2026-10-25/);
  doc.node("recalcClose").handlers.click(); assert.equal(calls.length, 0);
  controller.open();
  doc.node("recalcReason").value = "Reviewed costs";
  doc.node("recalcDate").value = "2026-10-25";
  doc.node("recalcForm").handlers.submit({ preventDefault() {} });
  assert.equal(doc.node("recalcResult").textContent, "Requesting\u2026");
  assert.equal(doc.node("recalcForm").getAttribute("aria-busy"), "true");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(doc.node("recalcForm").getAttribute("aria-busy"), undefined);
  assert.equal(calls[0][1].p_valuation_date, "2026-10-25");
  assert.equal(doc.node("recalcResult").textContent, recalculationSuccessText(result));
});

test("Close does not dismiss the dialog while a request is pending", async () => {
  const doc = fakeDocument(); const request = deferred();
  const controller = createRecalculationController({
    doc, costingRpc: () => request.promise,
    getPeriod: () => "2026-10-01", canEdit: () => true,
    invalidateBadge() {}, reloadStatus: async () => {}, showToast() {},
  });
  controller.open();
  doc.node("recalcReason").value = "Reviewed costs";
  doc.node("recalcForm").handlers.submit({ preventDefault() {} });
  assert.equal(doc.node("recalcSubmit").disabled, true);
  assert.equal(doc.node("recalcClose").disabled, true);
  assert.equal(doc.node("recalcHeaderClose").disabled, true);
  doc.node("recalcClose").handlers.click();
  assert.equal(doc.node("created").closed, false);
  let cancelPrevented = false;
  doc.node("created").handlers.cancel({ preventDefault() { cancelPrevented = true; } });
  assert.equal(cancelPrevented, true);
  request.resolve({ data: result });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(doc.node("recalcSubmit").disabled, false);
  assert.equal(doc.node("recalcClose").disabled, false);
  assert.equal(doc.node("recalcHeaderClose").disabled, false);
  doc.node("recalcClose").handlers.click();
  assert.equal(doc.node("created").closed, true);
});

test("period chip/overview render both server dates; ON blocks every legacy change entry", async () => {
  const { createCostPeriodValuationController } = await import("../../public/shared/js/costing-suite-cost-period-valuation.js");
  const previousDoc = globalThis.document, previousStorage = globalThis.localStorage;
  const doc = fakeDocument(); globalThis.document = doc;
  globalThis.localStorage = { getItem: () => "1" };
  const calls = [];
  try {
    const ctrl = createCostPeriodValuationController({
      costingRpc: async (name) => { calls.push(name); return { data: { period_start: "2026-10-01", period_status: "OPEN", valuation_date: "2026-10-22" } }; },
      getActivePeriodStart: () => "2026-10-01", canView: () => true, canEdit: () => true,
      isControlCenterRoute: () => true,
      getPeriodRunStatus: () => ({ official_valuation_date: "2026-10-22", latest_draft_valuation_date: "2026-10-29" }),
    });
    await ctrl.loadForActivePeriod();
    const chipValue = doc.node("stripBody").innerHTML.match(/data-cpv-chip-value[^>]*>([^<]*)/)?.[1] || "";
    assert.equal(chipValue, "2026-10-22");
    assert.match(doc.node("stripBody").innerHTML, /title="Official \(approved\) date: 2026-10-22 · Latest draft date: 2026-10-29"/);
    ctrl.openModal("change");
    assert.equal(ctrl.getState().activeTab, "overview");
    assert.equal(doc.node("cpvTabChange").hidden, true);
    assert.equal(doc.node("cpvChangeConfirm").hidden, true);
    assert.match(doc.node("cpvOverviewKv").innerHTML, /Official \(approved\) date/);
    assert.match(doc.node("cpvOverviewKv").innerHTML, /Latest draft date/);
    doc.node("cpvChangeConfirm").handlers.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, ["rpc_get_cost_period_valuation_context"]);
    ctrl.openModal("history");
    assert.equal(ctrl.getState().activeTab, "history");
    await new Promise(resolve => setImmediate(resolve));
  } finally {
    globalThis.document = previousDoc; globalThis.localStorage = previousStorage;
  }
});

test("badge reuses reloaded server row without a second status query", async () => {
  let reads = 0;
  const badge = createRunStatusBadge({
    supabase: { from() { reads++; throw Error("extra status read"); } },
    anchor: { insertAdjacentElement() {} },
    doc: { createElement: () => ({ dataset: {}, setAttribute() {} }) },
  });
  await badge.refresh({ periodStart: result.period_start, lensId: "dashboard", periodStatusRow: { period_start: result.period_start, display_label: "Server label" } });
  assert.equal(reads, 0);
  const body = fn(shell, "loadRowsForLens");
  assert.match(body, /isCostingRecalcWithDateV1Enabled\(\) && !isProductionRouteManagerRoute\(\)/);
});
