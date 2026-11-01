// C1B: read-only run selector for the review worklist (flag
// COSTING_REVIEW_WORKLIST_V1, default OFF). node:test only, no deps, no network.
// All rows are FIXTURES shaped like the run-scoped view; counts mirror the
// admin-side preflight (143: 627 READY; 148: 514 READY / 113 REVIEW / 1 BLOCKER)
// but the tests prove behaviour on whatever rows are loaded, not hard-coded UI.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import * as worklist from "../../public/shared/js/costing-review-worklist.js";
import { resolveRecommendedUiRouteTarget } from "../../public/shared/js/costing-suite-recommended-ui-route.js";
import { readSourceLf } from "../lib/read-source-lf.mjs";

const {
  REVIEW_WORKLIST_BY_RUN_VIEW,
  REVIEW_WORKLIST_DRAFT_PICKER_TEXT,
  REVIEW_WORKLIST_NO_LINK_TEXT,
  REVIEW_WORKLIST_SELECTED_RUN_DRAWER_TEXT,
  isReviewWorklistRunChoice,
  renderReviewWorklistRunPickerHtml,
  reviewWorklistRouteContext,
  reviewWorklistRunChoices,
  sortReviewWorklistRows,
  validateReviewWorklistRunRows,
} = worklist;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => readSourceLf(root, rel); // LF-normalised: see scripts/lib/read-source-lf.mjs
const SHELL = "public/shared/js/costing-suite-shell.js";
const OCT = "2026-10-01";
const SEP = "2026-09-01";

// ---- Fixtures (shaped like v_costing_pricing_sku_control_status_by_run) ----
function rowsFor({ runId, period = OCT, valuation = "2026-10-31", mix }) {
  const rows = [];
  let sku = 1;
  for (const [n, codes] of mix) {
    for (let i = 0; i < n; i += 1) {
      rows.push({
        period_start: period,
        snapshot_refreshed_at: "2026-11-01T02:30:00+05:30",
        sku_id: sku,
        product_id: 7000 + (sku % 300),
        product_name: `Product ${String(sku % 300).padStart(3, "0")}`,
        pack_size: 100,
        pack_uom: "ml",
        rm_blocking_line_count: 0,
        pm_blocking_line_count: 0,
        selling_price_bridge_status: "READY",
        pricing_bridge_status: "READY",
        valuation_date: valuation,
        refresh_run_id: runId,
        ...codes,
      });
      sku += 1;
    }
  }
  return rows;
}
const READY = { control_severity: "READY", first_control_status: "READY", recommended_ui_route: null, control_note: null };
const RUN_143 = () => rowsFor({ runId: 143, valuation: "2026-10-31", mix: [[627, READY]] });
const RUN_148 = () =>
  rowsFor({
    runId: 148,
    valuation: "2026-10-31",
    mix: [
      [1, { control_severity: "BLOCKER", first_control_status: "MATERIAL_COST_BLOCKED", recommended_ui_route: "MATERIAL_RATE_MANAGER", control_note: "No rate for I000019D.", pm_blocking_line_count: 1 }],
      [110, { control_severity: "REVIEW_REQUIRED", first_control_status: "PRIME_COST_REVIEW_REQUIRED", recommended_ui_route: "COST_REVIEW_WORKBENCH", control_note: "Prime cost review." }],
      [2, { control_severity: "REVIEW_REQUIRED", first_control_status: "MATERIAL_REVIEW_REQUIRED", recommended_ui_route: "MATERIAL_RATE_REVIEW", control_note: null }],
      [1, { control_severity: "REVIEW_REQUIRED", first_control_status: "PRICING_BRIDGE_REVIEW_REQUIRED", recommended_ui_route: "COST_REVIEW_WORKBENCH", control_note: null }],
      [514, READY],
    ],
  });
const STATUS_OCT = Object.freeze({
  period_start: OCT,
  display_state: "APPROVED_NEWER_DRAFT",
  display_label: "Approved run 143 (newer DRAFT run 148 - not approved)",
  displayed_run_id: 143,
  approved_run_id: 143,
  approved_at: "2026-10-22T10:00:00+05:30",
  approved_by: "owner",
  newer_draft_run_id: 148,
  active_run_id: null,
  active_run_status: null,
});
const STATUS_SEP = Object.freeze({ period_start: SEP, display_state: "APPROVED", display_label: "Approved run 122", displayed_run_id: 122, approved_run_id: 122, newer_draft_run_id: null, active_run_id: null, active_run_status: null });

// ---- Sandbox around the real flag-gated shell helpers ----
function extractFn(src, name) {
  let start = src.indexOf(`\nfunction ${name}(`);
  if (start < 0) start = src.indexOf(`\nasync function ${name}(`);
  assert.ok(start >= 0, name);
  return src.slice(start + 1, src.indexOf("\n}\n", start) + 2);
}
const HELPERS = ["reviewWorklistSelectedKey", "reviewWorklistRunStatus", "reviewWorklistActiveRun", "reviewWorklistGovernedRows", "selectReviewWorklistRun", "renderReviewWorklistPanel"];

function makeShell({ flagOn = true, statusFor = { [OCT]: STATUS_OCT, [SEP]: STATUS_SEP }, realFetchAllRows = false } = {}) {
  const statusQueries = [];
  const statusPending = [];
  const runQueries = [];
  const runPending = [];
  const summary = { innerHTML: "", classes: new Set(), handlers: [] };
  summary.classList = { add: (c) => summary.classes.add(c), remove: (c) => summary.classes.delete(c) };
  summary.querySelectorAll = (sel) => {
    const attr = sel.match(/^\[data-([\w-]+)\]$/)?.[1];
    return [...summary.innerHTML.matchAll(new RegExp(`data-${attr}="([^"]*)"`, "g"))].map((m) => {
      const node = {
        value: "",
        dataset: { [attr.replace(/-(\w)/g, (_, c) => c.toUpperCase())]: m[1].replace(/&amp;/g, "&") },
        addEventListener(type, fn) {
          summary.handlers.push({ attr, key: m[1], type, fn, node });
        },
      };
      return node;
    });
  };
  function queryBuilder(view, sink) {
    const q = { view, select: null, eq: [], order: [], range: null };
    sink.push(q);
    const api = {
      select(c) { q.select = c; return api; },
      eq(k, v) { q.eq.push([k, v]); return api; },
      order(k, o) { q.order.push([k, o?.ascending]); return api; },
      range(a, b) { q.range = [a, b]; return api; },
      maybeSingle: () => new Promise((resolve) => statusPending.push({ q, resolve })),
      then(onF, onR) {
        return new Promise((resolve) => runPending.push({ q, resolve })).then(onF, onR);
      },
    };
    return api;
  }
  const ctx = {
    ...worklist,
    CURRENT_LENS: "sku-control-status",
    ACTIVE_PERIOD_START: OCT,
    ALL_ROWS: RUN_143(),
    VIEW: [],
    CURRENT_PAGE: 3,
    REVIEW_WORKLIST_GROUP: null,
    REVIEW_WORKLIST_RUN_STATUS: null,
    REVIEW_WORKLIST_RUN_SELECTION: null,
    REVIEW_WORKLIST_RUN_LOAD: null,
    REVIEW_WORKLIST_PENDING_RUN: null,
    ROWS_LOAD_GENERATION: 1,
    isRowsLoadCurrent: (g) => g === ctx.ROWS_LOAD_GENERATION,
    workbenchSummary: summary,
    isCostingReviewWorklistV1Enabled: () => flagOn,
    toasts: [],
    showToast: (m, k) => ctx.toasts.push([m, k]),
    navigations: [],
    navigateToCostingRoute: (moduleKey, params, options) => ctx.navigations.push({ moduleKey, params, options }),
    applyFilters() {
      const key = vm.runInContext("reviewWorklistSelectedKey()", ctx);
      ctx.VIEW = key ? ctx.ALL_ROWS.filter((r) => worklist.reviewWorklistGroupKey(r) === key) : ctx.ALL_ROWS;
      vm.runInContext("renderReviewWorklistPanel()", ctx);
    },
    supabase: { from: (view) => queryBuilder(view, statusQueries) },
    costingFrom: (view) => queryBuilder(view, runQueries),
    fetchAllRows: null,
  };
  vm.createContext(ctx);
  const src = read(SHELL);
  const parts = HELPERS.map((n) => extractFn(src, n));
  if (realFetchAllRows) parts.push(extractFn(src, "fetchAllRows"));
  else {
    parts.push(`async function fetchAllRows(factory) {
      const q = factory();
      const res = await q;
      if (res.error) throw res.error;
      return res.data || [];
    }`);
  }
  vm.runInContext(parts.join("\n"), ctx);
  const flush = () => new Promise((r) => setImmediate(r));
  const api = {
    ctx,
    statusQueries,
    runQueries,
    summary,
    render: () => vm.runInContext("renderReviewWorklistPanel()", ctx),
    async answerStatus(i = statusPending.length - 1) {
      const p = statusPending[i];
      const period = p.q.eq.find(([k]) => k === "period_start")?.[1];
      p.resolve({ data: statusFor[period] ?? null, error: null });
      await flush();
    },
    async failStatus(message) {
      statusPending[statusPending.length - 1].resolve({ data: null, error: { message } });
      await flush();
    },
    async answerRun(i, result) {
      runPending[i].resolve(result);
      await flush();
    },
    choose(runId) {
      const h = summary.handlers.filter((x) => x.attr === "rwl-run-select" && x.type === "change").at(-1);
      assert.ok(h, "run select rendered");
      h.node.value = String(runId);
      h.fn();
      return flush();
    },
    clickOpen(key) {
      summary.handlers.filter((x) => x.attr === "rwl-open" && x.key === key).at(-1).fn();
    },
    clickSelect(key) {
      summary.handlers.filter((x) => x.attr === "rwl-select" && x.key === key).at(-1).fn();
    },
    flush,
    runPending,
  };
  return api;
}
async function readyOctober(s) {
  s.render();
  await s.flush();
  await s.answerStatus();
}
const runIdsOf = (rows) => [...new Set(Array.from(rows, (r) => String(r.refresh_run_id)))];
const severityLine = (html) => html.match(/Loaded rows[^<]*/)?.[0];

// 1. Pure helpers
test("run choices: only server ids, deduplicated, default = displayed, server-fact labels", () => {
  const c = reviewWorklistRunChoices(STATUS_OCT);
  assert.deepEqual(c.map((x) => [x.runId, x.kind, x.isDefault]), [["143", "approved", true], ["148", "draft", false]]);
  assert.equal(c[0].label, "Run 143 — Approved — displayed for this period");
  // A historical approved run (e.g. September 122) is labelled for its period only; no pricing-use wording.
  const sep = reviewWorklistRunChoices(STATUS_SEP);
  assert.deepEqual(sep.map((x) => x.label), ["Run 122 — Approved — displayed for this period"]);
  for (const x of [...c, ...sep]) assert.doesNotMatch(x.label, /in use|pricing basis|used for pricing|current pricing/i, x.label);
  assert.equal(c[1].label, "Run 148 — Draft — not for pricing");
  assert.deepEqual(reviewWorklistRunChoices({ displayed_run_id: 150, approved_run_id: null, newer_draft_run_id: null, display_state: "DRAFT" }).map((x) => x.label), ["Run 150 — Draft — not for pricing (shown by default)"]);
  assert.deepEqual(reviewWorklistRunChoices({ displayed_run_id: 90, display_state: "REFERENCE_NOT_APPROVED" }).map((x) => x.kind), ["reference"]);
  assert.deepEqual(reviewWorklistRunChoices(null), []);
  assert.deepEqual(reviewWorklistRunChoices({ displayed_run_id: 143, approved_run_id: 143, newer_draft_run_id: 143 }).length, 1);
  assert.equal(isReviewWorklistRunChoice(c, "148"), true);
  assert.equal(isReviewWorklistRunChoice(c, 148), true);
  for (const bad of ["147", "999", "", null, undefined, "148 OR 1=1", "../148"]) assert.equal(isReviewWorklistRunChoice(c, bad), false, String(bad));
  // Labels carry no dates (dates only come from loaded rows).
  assert.ok(c.every((x) => !/\d{4}-\d{2}-\d{2}/.test(x.label)));
});

test("row validation rejects empty, foreign-run and other-period rows", () => {
  assert.equal(validateReviewWorklistRunRows([], { periodStart: OCT, runId: "148" }).reason, "empty");
  assert.equal(validateReviewWorklistRunRows(RUN_148(), { periodStart: OCT, runId: "148" }).ok, true);
  assert.equal(validateReviewWorklistRunRows(RUN_143(), { periodStart: OCT, runId: "148" }).reason, "foreign");
  const partial = [...RUN_148().slice(0, 5), ...RUN_143().slice(0, 1)];
  assert.equal(validateReviewWorklistRunRows(partial, { periodStart: OCT, runId: "148" }).reason, "foreign");
  assert.equal(validateReviewWorklistRunRows(rowsFor({ runId: 148, period: SEP, mix: [[2, READY]] }), { periodStart: OCT, runId: "148" }).reason, "foreign");
});

test("display sort equals the Control Centre's own sku-control-status order", async () => {
  const cc = read("public/shared/js/costing-suite-control-center.js");
  const ctx = vm.createContext({
    rows: [...RUN_148()].reverse(),
    costingFrom: () => ({ select: () => ({ eq: () => ({ order: () => ({ order: () => ({ order: () => ({}) }) }) }) }) }),
    fetchAllRows: async () => ctx.rows,
    clearSkuExactEvidenceCache: () => {},
  });
  // normalizeStatus is injected into the Control Centre by the shell: use the shell's own definition.
  const start = cc.indexOf("  async function loadSkuControlStatusRows(");
  assert.ok(start > 0);
  const nested = cc.slice(start, cc.indexOf("\n  }\n", start) + 4);
  vm.runInContext(`${extractFn(read(SHELL), "normalizeStatus")}\n${nested}`, ctx);
  const expected = await vm.runInContext("loadSkuControlStatusRows('2026-10-01')", ctx);
  assert.deepEqual(sortReviewWorklistRows(ctx.rows).map((r) => r.sku_id), Array.from(expected, (r) => r.sku_id));
});

test("picker: accessible native select, disabled while loading, escaped server ids, no inline layout", () => {
  const html = renderReviewWorklistRunPickerHtml({ choices: reviewWorklistRunChoices(STATUS_OCT) });
  assert.match(html, /<label for="rwlRunSelect">Run<\/label>/);
  assert.match(html, /<select id="rwlRunSelect" data-rwl-run-select="1" aria-describedby="rwlRunSelectHelp">/);
  assert.match(html, /<option value="143" selected>Run 143 — Approved — displayed for this period<\/option><option value="148">Run 148 — Draft — not for pricing<\/option>/);
  assert.doesNotMatch(html, /style=|tabindex=|onkeydown|onclick/);
  const loading = renderReviewWorklistRunPickerHtml({ choices: reviewWorklistRunChoices(STATUS_OCT), selectedRunId: "148", load: { status: "loading", runId: "148" } });
  assert.match(loading, /aria-describedby="rwlRunSelectHelp" disabled>/);
  assert.match(loading, /role="status">Loading SKU rows for run 148/);
  const evil = renderReviewWorklistRunPickerHtml({ choices: reviewWorklistRunChoices({ displayed_run_id: '"><script>x</script>', newer_draft_run_id: "<b>2</b>" }) });
  assert.doesNotMatch(evil, /<script>|<b>/);
  assert.equal(renderReviewWorklistRunPickerHtml({ choices: [] }), "");
});

// 2. Shell behaviour
test("flag OFF: no reads, no panel, selecting a run does nothing", async () => {
  const s = makeShell({ flagOn: false });
  s.render();
  await vm.runInContext("selectReviewWorklistRun('148')", s.ctx);
  await s.flush();
  assert.equal(s.statusQueries.length, 0);
  assert.equal(s.runQueries.length, 0);
  assert.equal(s.summary.innerHTML, "");
});

test("default: displayed run 143 is selected; draft 148 is offered; no run-scoped read yet", async () => {
  const s = makeShell();
  await readyOctober(s);
  const html = s.summary.innerHTML;
  assert.match(html, /<option value="143" selected>Run 143 — Approved — displayed for this period<\/option>/);
  assert.match(html, /<option value="148">Run 148 — Draft — not for pricing<\/option>/);
  assert.ok(html.includes(`Newer draft run 148 exists for this period and is not approved. ${REVIEW_WORKLIST_DRAFT_PICKER_TEXT}`));
  assert.ok(html.includes("These rows are from approved run 143."));
  assert.equal(severityLine(html), "Loaded rows (run 143): 627 — READY 627");
  assert.equal(s.runQueries.length, 0);
  assert.equal(s.statusQueries.length, 1);
});

test("switch to draft 148: run-scoped read by period AND run; groups, counts and draft warning from loaded rows", async () => {
  const s = makeShell();
  await readyOctober(s);
  const governed = s.ctx.ALL_ROWS;
  await s.choose("148");
  assert.match(s.summary.innerHTML, /role="status">Loading SKU rows for run 148/);
  assert.equal(s.runQueries.length, 1);
  const q = s.runQueries[0];
  assert.equal(q.view, REVIEW_WORKLIST_BY_RUN_VIEW);
  assert.equal(q.view, "v_costing_pricing_sku_control_status_by_run");
  assert.equal(q.select, "*");
  assert.deepEqual(q.eq, [["period_start", OCT], ["refresh_run_id", "148"]]);
  assert.deepEqual(q.order, [["control_severity", true], ["product_name", true], ["sku_id", true]]);
  await s.answerRun(0, { data: RUN_148(), error: null });
  assert.deepEqual(runIdsOf(s.ctx.ALL_ROWS), ["148"]);
  assert.notEqual(s.ctx.ALL_ROWS, governed);
  assert.equal(s.ctx.CURRENT_PAGE, 1);
  const html = s.summary.innerHTML;
  const groups = worklist.groupReviewWorklistRows(s.ctx.ALL_ROWS);
  assert.deepEqual(groups.map((g) => [g.firstControlStatus, g.count]), [
    ["MATERIAL_COST_BLOCKED", 1],
    ["PRIME_COST_REVIEW_REQUIRED", 110],
    ["MATERIAL_REVIEW_REQUIRED", 2],
    ["PRICING_BRIDGE_REVIEW_REQUIRED", 1],
  ]);
  assert.equal((html.match(/data-rwl-select=/g) || []).length, 4);
  assert.equal(severityLine(html), "Loaded rows (run 148): 628 — BLOCKER 1 · REVIEW_REQUIRED 113 · READY 514");
  assert.ok(html.includes("Run shown: 148 · valuation 2026-10-31"));
  // UX-F1: one short status pill and one short visible drawer caveat; the full explanation is in the disclosure.
  assert.ok(html.includes('<span class="rwl-pill rwl-pill-draft" data-rwl-pill="selected-not-approved">Draft run 148 · Not for pricing</span>'));
  assert.ok(html.includes('<div class="rwl-alert rwl-alert-draft" role="note">Drawer evidence is from run 143, not draft 148.</div>'));
  const details = html.split('<details class="rwl-details">')[1].split("</details>")[0];
  assert.match(details, /<strong>Draft run 148 — not for pricing\.<\/strong> You are viewing its frozen SKU rows read-only, for diagnosis only\. The run displayed for this period is run 143\./);
  // Drawer limitation is prominent (warning line with a bold lead), not a muted footnote.
  assert.ok(html.includes(`<div class="rwl-rc-line rwl-rc-warn rwl-rc-drawer"><strong>Row drawer evidence is not this run's evidence.</strong> ${REVIEW_WORKLIST_SELECTED_RUN_DRAWER_TEXT.replace(/'/g, "&#039;")}</div>`));
  assert.match(REVIEW_WORKLIST_SELECTED_RUN_DRAWER_TEXT, /pinned to the displayed \(governed\) run/);
  assert.doesNotMatch(html, /in use/);
  assert.match(html, /<option value="148" selected>/);
  assert.doesNotMatch(html, /server now shows run|Reload the period/);
  assert.equal(s.statusQueries.length, 1, "no duplicate status read on run switch");
});

test("switch back to 143 restores the governed rows without a new read; group selection resets", async () => {
  const s = makeShell();
  await readyOctober(s);
  const governed = s.ctx.ALL_ROWS;
  await s.choose("148");
  await s.answerRun(0, { data: RUN_148(), error: null });
  s.clickSelect("BLOCKER|MATERIAL_COST_BLOCKED|MATERIAL_RATE_MANAGER");
  assert.equal(s.ctx.VIEW.length, 1);
  await s.choose("143");
  assert.equal(s.ctx.ALL_ROWS, governed);
  assert.equal(s.ctx.REVIEW_WORKLIST_GROUP, null);
  assert.equal(s.ctx.VIEW.length, 627);
  assert.equal(s.runQueries.length, 1);
  assert.equal(s.statusQueries.length, 1);
  assert.ok(s.summary.innerHTML.includes("These rows are from approved run 143."));
  assert.doesNotMatch(s.summary.innerHTML, /Draft run 148 — not for pricing\./);
});

test("arbitrary run ids are refused; the selector is the only entry point (no URL input)", async () => {
  const s = makeShell();
  await readyOctober(s);
  for (const bad of ["147", "999", "148; drop", ""]) {
    await vm.runInContext(`selectReviewWorklistRun(${JSON.stringify(bad)})`, s.ctx);
  }
  assert.equal(s.runQueries.length, 0);
  assert.ok(s.ctx.toasts.every(([m]) => m === "This run is not offered for this period."));
  const src = read(SHELL);
  for (const fn of HELPERS) assert.doesNotMatch(extractFn(src, fn), /location|URLSearchParams|searchParams|hash/, fn);
  const callers = src.split("\n").filter((l) => l.includes("selectReviewWorklistRun(") && !l.includes("function selectReviewWorklistRun("));
  // UX-F1 adds one caller: the dashboard intent, honoured only for the server's newer_draft_run_id.
  assert.deepEqual(callers.map((l) => l.trim()), ["void selectReviewWorklistRun(pending.runId);", "void selectReviewWorklistRun(select.value);"]);
});

test("stale answers: a period switch or a newer choice discards a late run-148 response", async () => {
  // Period switch while 148 is loading.
  const s = makeShell();
  await readyOctober(s);
  await s.choose("148");
  // Governed reload for September (what loadRowsForLens does: new generation, new rows).
  s.ctx.ROWS_LOAD_GENERATION += 1;
  s.ctx.ACTIVE_PERIOD_START = SEP;
  s.ctx.ALL_ROWS = rowsFor({ runId: 122, period: SEP, valuation: "2026-09-30", mix: [[3, READY]] });
  s.render();
  await s.flush();
  await s.answerStatus();
  await s.answerRun(0, { data: RUN_148(), error: null });
  assert.deepEqual(runIdsOf(s.ctx.ALL_ROWS), ["122"]);
  assert.doesNotMatch(s.summary.innerHTML, /148/);
  assert.ok(s.summary.innerHTML.includes("Run shown: 122 · valuation 2026-09-30"));
  // Newer choice: choose 148 (pending), then back to the default 143 → the late 148 answer is ignored.
  const t = makeShell();
  await readyOctober(t);
  const governed = t.ctx.ALL_ROWS;
  await t.choose("148");
  await t.choose("143");
  await t.answerRun(0, { data: RUN_148(), error: null });
  assert.equal(t.ctx.ALL_ROWS, governed);
  assert.doesNotMatch(t.summary.innerHTML, /Draft run 148 — not for pricing\./);
});

test("reload of the same period while 148 is loading: loading state clears, late answer ignored", async () => {
  const s = makeShell();
  await readyOctober(s);
  await s.choose("148");
  assert.match(s.summary.innerHTML, /Loading SKU rows for run 148/);
  // Same-period reload by the shell: new generation, new governed rows.
  s.ctx.ROWS_LOAD_GENERATION += 1;
  const reloaded = RUN_143();
  s.ctx.ALL_ROWS = reloaded;
  s.render();
  await s.flush();
  await s.answerStatus();
  assert.doesNotMatch(s.summary.innerHTML, /Loading SKU rows|disabled>/);
  assert.match(s.summary.innerHTML, /<option value="143" selected>/);
  await s.answerRun(0, { data: RUN_148(), error: null });
  assert.equal(s.ctx.ALL_ROWS, reloaded);
  assert.doesNotMatch(s.summary.innerHTML, /Draft run 148 — not for pricing\./);
  // An earlier error message also clears after a reload.
  await s.choose("148");
  await s.answerRun(1, { data: [], error: null });
  assert.match(s.summary.innerHTML, /No SKU rows were returned for run 148/);
  s.ctx.ROWS_LOAD_GENERATION += 1;
  s.ctx.ALL_ROWS = RUN_143();
  s.render();
  await s.flush();
  await s.answerStatus();
  assert.doesNotMatch(s.summary.innerHTML, /No SKU rows were returned for run 148/);
});

test("governed reload after choosing 148 returns to the displayed run (never the old run under a new label)", async () => {
  const s = makeShell();
  await readyOctober(s);
  await s.choose("148");
  await s.answerRun(0, { data: RUN_148(), error: null });
  // Reload of the same period by the shell (new ALL_ROWS from the governed view).
  s.ctx.ROWS_LOAD_GENERATION += 1;
  s.ctx.ALL_ROWS = RUN_143();
  s.render();
  await s.flush();
  assert.equal(s.ctx.REVIEW_WORKLIST_RUN_SELECTION, null);
  assert.equal(severityLine(s.summary.innerHTML), "Loaded rows (run 143): 627 — READY 627");
  assert.doesNotMatch(s.summary.innerHTML, /run 148\b.*selected|Draft run 148 — not for pricing\./);
  await s.answerStatus(); // reload re-reads status once (new governed rows); picker returns with 143 selected
  assert.equal(s.statusQueries.length, 2);
  assert.match(s.summary.innerHTML, /<option value="143" selected>/);
});

test("no rows (permission), failed read, foreign rows: table keeps run 143 and says why", async () => {
  for (const [result, re] of [
    [{ data: [], error: null }, /No SKU rows were returned for run 148 \(no permission, or the run has no SKU rows\)\. The table still shows run 143\./],
    [{ data: null, error: { message: "permission denied for view v_costing_pricing_sku_control_status_by_run" } }, /SKU rows for run 148 could not be loaded: permission denied for view v_costing_pricing_sku_control_status_by_run\. The table still shows run 143\./],
    [{ data: RUN_143().slice(0, 3), error: null }, /rows that do not belong to run 148 for this period; nothing was shown/],
  ]) {
    const s = makeShell();
    await readyOctober(s);
    const governed = s.ctx.ALL_ROWS;
    await s.choose("148");
    await s.answerRun(0, result);
    assert.equal(s.ctx.ALL_ROWS, governed);
    assert.match(s.summary.innerHTML, re);
    assert.match(s.summary.innerHTML, /role="alert"/);
    assert.match(s.summary.innerHTML, /<option value="143" selected>/);
    // Recovery: choosing 148 again retries.
    await s.choose("148");
    assert.equal(s.runQueries.length, 2);
  }
});

test("paging: the real fetchAllRows assembles every page of the run-scoped read (no truncation)", async () => {
  const s = makeShell({ realFetchAllRows: true });
  await readyOctober(s);
  const big = rowsFor({ runId: 148, mix: [[2345, READY]] });
  await s.choose("148");
  for (let page = 0; page < 3; page += 1) {
    const q = s.runQueries[page];
    assert.deepEqual(q.range, [page * 1000, page * 1000 + 999]);
    assert.deepEqual(q.eq, [["period_start", OCT], ["refresh_run_id", "148"]]);
    await s.answerRun(page, { data: big.slice(page * 1000, page * 1000 + 1000), error: null });
  }
  assert.equal(s.runQueries.length, 3);
  assert.equal(s.ctx.ALL_ROWS.length, 2345);
  assert.equal(severityLine(s.summary.innerHTML), "Loaded rows (run 148): 2345 — READY 2345");
});

test("status read failure: no selector, honest message, rows stay as stored", async () => {
  const s = makeShell();
  s.render();
  await s.flush();
  await s.failStatus("permission denied for view v_costing_pricing_period_run_status");
  assert.doesNotMatch(s.summary.innerHTML, /data-rwl-run-select/);
  assert.ok(s.summary.innerHTML.includes("The run's current designation (approved or draft) could not be verified."));
  await vm.runInContext("selectReviewWorklistRun('148')", s.ctx);
  assert.equal(s.runQueries.length, 0);
});

test("if the server stops advertising the chosen run, the screen returns to the displayed run", async () => {
  const s = makeShell();
  await readyOctober(s);
  const governed = s.ctx.ALL_ROWS;
  await s.choose("148");
  await s.answerRun(0, { data: RUN_148(), error: null });
  const ready = { status: "ready", periodStart: OCT, row: { ...STATUS_OCT, newer_draft_run_id: null, display_state: "APPROVED", display_label: "Approved run 143" }, error: null };
  s.ctx.REVIEW_WORKLIST_RUN_STATUS = { ensure: () => ready, state: () => ready };
  s.render();
  assert.equal(s.ctx.ALL_ROWS, governed);
  assert.equal(s.ctx.REVIEW_WORKLIST_RUN_SELECTION, null);
  assert.ok(s.ctx.toasts.some(([m]) => m.startsWith("The selected run is no longer offered")));
  assert.doesNotMatch(s.summary.innerHTML, /run 148/);
});

test("on run 148: group filter and existing fix links (SKU/period kept); unmapped route explained", async () => {
  const s = makeShell();
  await readyOctober(s);
  await s.choose("148");
  await s.answerRun(0, { data: RUN_148(), error: null });
  s.clickSelect("REVIEW_REQUIRED|PRIME_COST_REVIEW_REQUIRED|COST_REVIEW_WORKBENCH");
  assert.equal(s.ctx.VIEW.length, 110);
  assert.ok(s.ctx.VIEW.every((r) => String(r.refresh_run_id) === "148"));
  s.clickOpen("BLOCKER|MATERIAL_COST_BLOCKED|MATERIAL_RATE_MANAGER");
  const blocked = s.ctx.ALL_ROWS.find((r) => r.control_severity === "BLOCKER");
  const expected = resolveRecommendedUiRouteTarget(blocked.recommended_ui_route, reviewWorklistRouteContext(blocked));
  assert.equal(s.ctx.navigations.length, 1);
  assert.equal(s.ctx.navigations[0].moduleKey, "material-cost-manager");
  assert.deepEqual(JSON.parse(JSON.stringify(s.ctx.navigations[0].params)), JSON.parse(JSON.stringify(expected.navigateParams)));
  assert.equal(s.ctx.navigations[0].params.periodStart, OCT);
  const html = s.summary.innerHTML;
  for (const key of ["REVIEW_REQUIRED|PRIME_COST_REVIEW_REQUIRED|COST_REVIEW_WORKBENCH", "REVIEW_REQUIRED|PRICING_BRIDGE_REVIEW_REQUIRED|COST_REVIEW_WORKBENCH"]) {
    assert.ok(!s.summary.handlers.some((h) => h.attr === "rwl-open" && h.key === key), key);
    assert.ok(html.split(`data-rwl-group="${key}"`)[1].split("rwl-actions")[1].includes(REVIEW_WORKLIST_NO_LINK_TEXT), key);
  }
  // Only read/select/navigate controls exist.
  const controls = [...new Set([...html.matchAll(/data-(rwl-[\w-]+)=/g)].map((m) => m[1]))].sort();
  assert.deepEqual(controls, ["rwl-clear", "rwl-group", "rwl-open", "rwl-pill", "rwl-run-context", "rwl-run-select", "rwl-select"]);
});

test("no writes or new endpoints: only the two read views are queried", async () => {
  const s = makeShell();
  await readyOctober(s);
  await s.choose("148");
  await s.answerRun(0, { data: RUN_148(), error: null });
  const views = [...new Set([...s.statusQueries, ...s.runQueries].map((q) => q.view))].sort();
  assert.deepEqual(views, ["v_costing_pricing_period_run_status", "v_costing_pricing_sku_control_status_by_run"]);
  const src = read(SHELL);
  const helperText = HELPERS.map((n) => extractFn(src, n)).join("\n");
  assert.doesNotMatch(helperText, /\.rpc\(|costingRpc|insert|upsert|\.update\(|\.delete\(|service_role|new Date|Date\.now/);
  assert.doesNotMatch(read("public/shared/js/costing-review-worklist.js"), /supabase|\.rpc\(|\.from\(|fetch\(|service_role/);
});
