// C1: run context for the review worklist (flag COSTING_REVIEW_WORKLIST_V1,
// default OFF). node:test only, no deps, no network. All data below are
// FIXTURES: the counts mirror the server's reported run-148 split, but nothing
// here claims the browser retrieved run 148 (it cannot; see the PR body).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import * as worklist from "../../public/shared/js/costing-review-worklist.js";
import { RUN_STATUS_SELECT_V1, RUN_STATUS_VIEW } from "../../public/shared/js/costing-run-status-badge.js";
import { resolveRecommendedUiRouteTarget } from "../../public/shared/js/costing-suite-recommended-ui-route.js";

const {
  REVIEW_WORKLIST_DRAFT_UNAVAILABLE_TEXT,
  REVIEW_WORKLIST_EMPTY_TEXT,
  REVIEW_WORKLIST_FIX_SCREEN_TEXT,
  REVIEW_WORKLIST_FROZEN_RUN_TEXT,
  REVIEW_WORKLIST_NO_ROWS_TEXT,
  createReviewWorklistRunStatusLoader,
  describeReviewWorklistRunContext,
  groupReviewWorklistRows,
  renderReviewWorklistHtml,
  renderReviewWorklistRunDiagnosisHtml,
  reviewWorklistRouteContext,
  reviewWorklistRunContext,
  reviewWorklistSeverityCounts,
} = worklist;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const SHELL = "public/shared/js/costing-suite-shell.js";
const PERIOD = "2026-10-01";

// ---- Fixtures ----
function fixtureRows({ runId = 143, valuation = "2026-10-31", period = PERIOD } = {}) {
  const rows = [];
  let sku = 1;
  const add = (n, codes) => {
    for (let i = 0; i < n; i += 1) {
      rows.push({ period_start: period, refresh_run_id: runId, valuation_date: valuation, sku_id: sku, product_id: 5000 + sku, product_name: `P${sku}`, rm_blocking_line_count: 0, pm_blocking_line_count: 0, ...codes });
      sku += 1;
    }
  };
  add(514, { control_severity: "READY", first_control_status: "READY", recommended_ui_route: null, control_note: null });
  add(110, { control_severity: "REVIEW_REQUIRED", first_control_status: "PRIME_COST_REVIEW_REQUIRED", recommended_ui_route: "COST_REVIEW_WORKBENCH", control_note: "Prime cost review." });
  add(2, { control_severity: "REVIEW_REQUIRED", first_control_status: "MATERIAL_REVIEW_REQUIRED", recommended_ui_route: "MATERIAL_RATE_REVIEW", control_note: null });
  add(1, { control_severity: "REVIEW_REQUIRED", first_control_status: "PRICING_BRIDGE_REVIEW_REQUIRED", recommended_ui_route: "COST_REVIEW_WORKBENCH", control_note: null });
  add(1, { control_severity: "BLOCKER", first_control_status: "MATERIAL_COST_BLOCKED", recommended_ui_route: "MATERIAL_RATE_MANAGER", control_note: "No rate for I000019D.", pm_blocking_line_count: 1 });
  return rows;
}
const STATUS_APPROVED_NEWER_DRAFT = Object.freeze({
  period_start: PERIOD,
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
const ready = (row) => ({ status: "ready", row, error: null });

// 1. Contract
test("C1 run status reads the same view and columns as the existing run-status badge", () => {
  assert.equal(worklist.REVIEW_WORKLIST_RUN_STATUS_VIEW, RUN_STATUS_VIEW);
  assert.equal(worklist.REVIEW_WORKLIST_RUN_STATUS_SELECT, RUN_STATUS_SELECT_V1);
  assert.equal(RUN_STATUS_VIEW, "v_costing_pricing_period_run_status");
  // Every selected column exists in the repo definition of the period status view.
  const def = read("supabase/migrations/20261019014458_w1_approved_run_feed_and_labels.sql");
  for (const col of RUN_STATUS_SELECT_V1.split(",")) assert.match(def, new RegExp(`\\b${col}\\b`), col);
  const src = read("public/shared/js/costing-review-worklist.js");
  assert.doesNotMatch(src, /supabase|\.rpc\(|\.from\(|costingFrom|fetch\(|new Date|Date\.now|Date\.parse|refresh_run_id\s*=|\.eq\(/);
});

// 2. October fixture: approved 143 shown, newer draft 148 reported as unavailable
test("C1 approved run with a newer draft: counts of loaded rows, verbatim server label, honest draft notice", () => {
  const rows = fixtureRows();
  const d = describeReviewWorklistRunContext({ rows, periodStart: PERIOD, runStatus: ready(STATUS_APPROVED_NEWER_DRAFT) });
  assert.equal(d.kind, "approved");
  assert.equal(d.listRunId, "143");
  assert.equal(d.newerDraftRunId, "148");
  assert.deepEqual(d.severityCounts.map((c) => [c.severity, c.count]), [["BLOCKER", 1], ["REVIEW_REQUIRED", 113], ["READY", 514]]);
  const groups = groupReviewWorklistRows(rows);
  assert.deepEqual(groups.map((g) => g.count), [1, 110, 2, 1]);
  const html = renderReviewWorklistHtml(groups, { runContext: reviewWorklistRunContext(rows), runDiagnosis: d, rowCount: rows.length });
  assert.ok(html.includes("Server run status: Approved run 143 (newer DRAFT run 148 - not approved)"));
  assert.ok(html.includes('<span class="rwl-rc-code">[APPROVED_NEWER_DRAFT]</span>'));
  assert.ok(html.includes("These rows are from approved run 143."));
  assert.ok(html.includes(`Newer draft run 148 exists for this period and is not approved. ${REVIEW_WORKLIST_DRAFT_UNAVAILABLE_TEXT.replace(/'/g, "&#039;")}`));
  assert.ok(html.includes("Loaded rows (run 143): 628 — BLOCKER 1 · REVIEW_REQUIRED 113 · READY 514"));
  assert.ok(html.includes("Run shown: 143 · valuation 2026-10-31"));
  assert.ok(html.includes(REVIEW_WORKLIST_FROZEN_RUN_TEXT));
  assert.ok(html.includes(REVIEW_WORKLIST_FIX_SCREEN_TEXT));
  // No selector and no claim that run 148 rows were shown.
  assert.doesNotMatch(html, /<select|data-rwl-run=|run 148\)/);
  assert.ok(html.includes('data-rwl-run-context="approved"'));
});

// 3. Other states
test("C1 run states: draft-only, mismatch, mixed runs, other period, active run", () => {
  const draftOnly = describeReviewWorklistRunContext({
    rows: fixtureRows({ runId: 150 }),
    periodStart: PERIOD,
    runStatus: ready({ display_state: "DRAFT", display_label: "DRAFT run 150 - not approved", displayed_run_id: 150, approved_run_id: null, newer_draft_run_id: null }),
  });
  assert.equal(draftOnly.kind, "not-approved");
  assert.ok(renderReviewWorklistRunDiagnosisHtml(draftOnly).includes("These rows are from run 150, which is not an approved run."));

  const mismatch = describeReviewWorklistRunContext({ rows: fixtureRows({ runId: 143 }), periodStart: PERIOD, runStatus: ready({ ...STATUS_APPROVED_NEWER_DRAFT, displayed_run_id: 149, approved_run_id: 149 }) });
  assert.equal(mismatch.kind, "mismatch");
  assert.match(renderReviewWorklistRunDiagnosisHtml(mismatch), /loaded rows are from run 143, but the server now shows run 149/);

  const mixedRows = [...fixtureRows({ runId: 143 }).slice(0, 3), ...fixtureRows({ runId: 148 }).slice(0, 2)];
  const mixed = describeReviewWorklistRunContext({ rows: mixedRows, periodStart: PERIOD, runStatus: ready(STATUS_APPROVED_NEWER_DRAFT) });
  assert.equal(mixed.kind, "mixed");
  assert.match(renderReviewWorklistRunDiagnosisHtml(mixed), /Rows from more than one run are loaded \(143, 148\)/);

  const otherPeriod = describeReviewWorklistRunContext({ rows: fixtureRows({ period: "2026-09-01" }), periodStart: PERIOD, runStatus: ready(STATUS_APPROVED_NEWER_DRAFT) });
  assert.equal(otherPeriod.periodMismatch, true);
  assert.match(renderReviewWorklistRunDiagnosisHtml(otherPeriod), /belong to another period than 2026-10-01/);

  const active = describeReviewWorklistRunContext({ rows: fixtureRows(), periodStart: PERIOD, runStatus: ready({ ...STATUS_APPROVED_NEWER_DRAFT, active_run_id: 151, active_run_status: "RUNNING" }) });
  assert.match(renderReviewWorklistRunDiagnosisHtml(active), /Run 151 is RUNNING for this period/);
});

// 4. Loading / error / permission / empty
test("C1 loading, read error, no status row (permission) and no rows are all explicit", () => {
  const rows = fixtureRows();
  const loading = describeReviewWorklistRunContext({ rows, periodStart: PERIOD, runStatus: { status: "loading" } });
  assert.equal(loading.kind, "loading");
  assert.match(renderReviewWorklistRunDiagnosisHtml(loading), /role="status">Loading run status for 2026-10-01/);

  const error = describeReviewWorklistRunContext({ rows, periodStart: PERIOD, runStatus: { status: "error", error: "permission denied for view" } });
  assert.equal(error.kind, "status-error");
  const errorHtml = renderReviewWorklistHtml(groupReviewWorklistRows(rows), { runDiagnosis: error, rowCount: rows.length });
  assert.match(errorHtml, /role="alert">Run status could not be read: permission denied for view/);
  // The failed status read must not claim the server's current run was verified.
  assert.ok(errorHtml.includes("The run's current designation (approved or draft) could not be verified."));
  assert.ok(errorHtml.includes("The loaded rows still show the run they are stored under (run 143)."));
  assert.doesNotMatch(errorHtml, /still the run shown by the server|approved run 143/);
  assert.equal((errorHtml.match(/data-rwl-select=/g) || []).length, 4, "list still rendered on status failure");

  const missing = describeReviewWorklistRunContext({ rows: [], periodStart: PERIOD, runStatus: ready(null) });
  assert.equal(missing.kind, "status-missing");
  const missingHtml = renderReviewWorklistHtml([], { runDiagnosis: missing, rowCount: 0 });
  assert.ok(missingHtml.includes("no permission to read Control Centre status"));
  assert.ok(missingHtml.includes(REVIEW_WORKLIST_NO_ROWS_TEXT));

  const allReady = fixtureRows().filter((r) => r.control_severity === "READY");
  const readyHtml = renderReviewWorklistHtml(groupReviewWorklistRows(allReady), { rowCount: allReady.length });
  assert.ok(readyHtml.includes(REVIEW_WORKLIST_EMPTY_TEXT));
  assert.ok(!readyHtml.includes(REVIEW_WORKLIST_NO_ROWS_TEXT));

  const idle = describeReviewWorklistRunContext({ rows: [], periodStart: null, runStatus: { status: "idle" } });
  assert.match(renderReviewWorklistRunDiagnosisHtml(idle), /No period selected/);
});

// 5. Escaping
test("C1 server text in the run context is HTML-escaped", () => {
  const d = describeReviewWorklistRunContext({
    rows: fixtureRows(),
    periodStart: PERIOD,
    runStatus: ready({ ...STATUS_APPROVED_NEWER_DRAFT, display_label: "<img src=x onerror=alert(1)>", display_state: "<b>X</b>", active_run_id: 1, active_run_status: "<script>" }),
  });
  const html = renderReviewWorklistRunDiagnosisHtml(d);
  assert.doesNotMatch(html, /<img|<b>|<script>/);
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  const err = renderReviewWorklistRunDiagnosisHtml(describeReviewWorklistRunContext({ rows: [], periodStart: PERIOD, runStatus: { status: "error", error: '<svg onload="x">' } }));
  assert.doesNotMatch(err, /<svg/);
});

// 6. Loader: stale responses discarded, keyed by period + rows
test("C1 loader discards stale responses and re-reads only on a new period or reload", async () => {
  const pending = [];
  const query = (periodStart) => new Promise((resolve) => pending.push({ periodStart, resolve }));
  const loader = createReviewWorklistRunStatusLoader({ query });
  let settled = 0;
  const rowsA = [];
  assert.equal(loader.ensure("2026-09-01", rowsA, () => (settled += 1)).status, "loading");
  assert.equal(loader.ensure("2026-09-01", rowsA, () => (settled += 1)).status, "loading");
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(pending.length, 1, "same key: one query");
  const rowsB = [];
  loader.ensure(PERIOD, rowsB, () => (settled += 1));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(pending.length, 2);
  // Late answer for September arrives after the switch to October: ignored.
  pending[0].resolve({ data: { display_label: "September" }, error: null });
  await new Promise((r) => setImmediate(r));
  assert.equal(loader.state().status, "loading");
  assert.equal(loader.state().periodStart, PERIOD);
  assert.equal(settled, 0);
  pending[1].resolve({ data: STATUS_APPROVED_NEWER_DRAFT, error: null });
  await new Promise((r) => setImmediate(r));
  assert.equal(loader.state().status, "ready");
  assert.equal(loader.state().row.display_label, STATUS_APPROVED_NEWER_DRAFT.display_label);
  assert.equal(settled, 1);
  // Same period, new rows array (reload) → re-read.
  loader.ensure(PERIOD, [], () => (settled += 1));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(pending.length, 3);
  pending[2].resolve({ data: null, error: { message: "boom" } });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual({ status: loader.state().status, error: loader.state().error }, { status: "error", error: "boom" });
  // Rejected promise → error state; no period → idle.
  const rejecting = createReviewWorklistRunStatusLoader({ query: () => Promise.reject(new Error("network down")) });
  rejecting.ensure(PERIOD, [], () => {});
  await new Promise((r) => setImmediate(r));
  assert.equal(rejecting.state().error, "network down");
  assert.equal(rejecting.ensure(null, [], () => {}).status, "idle");
});

// 7. Shell integration (real flag-gated helpers in a sandbox)
function extractFn(src, name) {
  const start = src.indexOf(`\nfunction ${name}(`);
  assert.ok(start >= 0, name);
  return src.slice(start + 1, src.indexOf("\n}\n", start) + 2);
}
function makeShell({ flagOn }) {
  const queries = [];
  const deferred = [];
  const summary = { innerHTML: "", classes: new Set(), classList: null, nodes: [] };
  summary.classList = { add: (c) => summary.classes.add(c), remove: (c) => summary.classes.delete(c) };
  summary.querySelectorAll = (sel) => {
    const attr = sel.match(/^\[data-([\w-]+)\]$/)?.[1];
    return [...summary.innerHTML.matchAll(new RegExp(`data-${attr}="([^"]*)"`, "g"))].map((m) => ({
      dataset: { [attr.replace(/-(\w)/g, (_, c) => c.toUpperCase())]: m[1].replace(/&amp;/g, "&") },
      addEventListener(type, fn) {
        if (type === "click") summary.nodes.push({ attr, value: m[1], fn });
      },
    }));
  };
  const ctx = {
    ...worklist,
    CURRENT_LENS: "sku-control-status",
    ACTIVE_PERIOD_START: PERIOD,
    ALL_ROWS: fixtureRows(),
    CURRENT_PAGE: 1,
    REVIEW_WORKLIST_GROUP: null,
    REVIEW_WORKLIST_RUN_STATUS: null,
    workbenchSummary: summary,
    isCostingReviewWorklistV1Enabled: () => flagOn,
    applyFilters: () => {},
    showToast: () => {},
    navigations: [],
    navigateToCostingRoute: (moduleKey, params, options) => ctx.navigations.push({ moduleKey, params, options }),
    supabase: {
      from(view) {
        const q = { view, cols: null, eq: [] };
        queries.push(q);
        const api = {
          select(c) { q.cols = c; return api; },
          eq(k, v) { q.eq.push([k, v]); return api; },
          maybeSingle: () => new Promise((resolve) => deferred.push({ q, resolve })),
        };
        return api;
      },
    },
  };
  vm.createContext(ctx);
  const src = read(SHELL);
  vm.runInContext(["reviewWorklistSelectedKey", "reviewWorklistRunStatus", "renderReviewWorklistPanel"].map((n) => extractFn(src, n)).join("\n"), ctx);
  return { ctx, queries, deferred, summary, render: () => vm.runInContext("renderReviewWorklistPanel()", ctx) };
}
const flush = () => new Promise((r) => setImmediate(r));

test("C1 shell: flag OFF makes no status read and renders nothing", async () => {
  const s = makeShell({ flagOn: false });
  s.render();
  await flush();
  assert.equal(s.queries.length, 0);
  assert.equal(s.summary.innerHTML, "");
});

test("C1 shell: flag ON reads the status view once, shows loading, then the run context; period switch drops the stale answer", async () => {
  const s = makeShell({ flagOn: true });
  s.render();
  assert.match(s.summary.innerHTML, /data-rwl-run-context="loading"/);
  await flush();
  assert.equal(s.queries.length, 1);
  assert.deepEqual({ view: s.queries[0].view, cols: s.queries[0].cols, eq: s.queries[0].eq }, { view: RUN_STATUS_VIEW, cols: RUN_STATUS_SELECT_V1, eq: [["period_start", PERIOD]] });
  s.render(); // re-render with the same period and rows: no new read
  await flush();
  assert.equal(s.queries.length, 1);
  // Switch to September (new rows) before October answers.
  s.ctx.ACTIVE_PERIOD_START = "2026-09-01";
  s.ctx.ALL_ROWS = fixtureRows({ runId: 122, valuation: "2026-09-30", period: "2026-09-01" });
  s.render();
  await flush();
  assert.equal(s.queries.length, 2);
  s.deferred[0].resolve({ data: STATUS_APPROVED_NEWER_DRAFT, error: null }); // late October answer
  await flush();
  assert.doesNotMatch(s.summary.innerHTML, /148/);
  assert.match(s.summary.innerHTML, /data-rwl-run-context="loading"/);
  s.deferred[1].resolve({ data: { period_start: "2026-09-01", display_state: "APPROVED", display_label: "Approved run 122", displayed_run_id: 122, approved_run_id: 122, newer_draft_run_id: null, active_run_id: null, active_run_status: null }, error: null });
  await flush();
  assert.match(s.summary.innerHTML, /data-rwl-run-context="approved"/);
  assert.ok(s.summary.innerHTML.includes("These rows are from approved run 122."));
  assert.ok(s.summary.innerHTML.includes("Run shown: 122 · valuation 2026-09-30"));
  assert.doesNotMatch(s.summary.innerHTML, /run 143|run 148/);
});

test("C1 shell: blocked SKU opens the existing fix screen with the period preserved; no write paths", async () => {
  const s = makeShell({ flagOn: true });
  s.render();
  await flush();
  s.deferred[0].resolve({ data: STATUS_APPROVED_NEWER_DRAFT, error: null });
  await flush();
  const open = s.summary.nodes.filter((n) => n.attr === "rwl-open");
  const blockedKey = "BLOCKER|MATERIAL_COST_BLOCKED|MATERIAL_RATE_MANAGER";
  const btn = open.find((n) => n.value === blockedKey);
  assert.ok(btn, "blocked group has an Open fix screen button");
  btn.fn();
  const row = s.ctx.ALL_ROWS.find((r) => r.control_severity === "BLOCKER");
  const expected = resolveRecommendedUiRouteTarget(row.recommended_ui_route, reviewWorklistRouteContext(row));
  assert.equal(s.ctx.navigations.length, 1);
  assert.equal(s.ctx.navigations[0].moduleKey, "material-cost-manager");
  assert.deepEqual(JSON.parse(JSON.stringify(s.ctx.navigations[0].params)), JSON.parse(JSON.stringify(expected.navigateParams)));
  assert.equal(s.ctx.navigations[0].params.periodStart, PERIOD);
  // Only read/select/navigate controls are rendered.
  const controls = [...s.summary.innerHTML.matchAll(/data-(rwl-[\w-]+)=/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(controls)].sort(), ["rwl-group", "rwl-open", "rwl-run-context", "rwl-select"]);
  assert.equal(s.queries.length, 1);
  assert.ok(s.queries.every((q) => q.view === RUN_STATUS_VIEW));
});

test("C1 severity counts keep raw server codes, unknown codes last", () => {
  const counts = reviewWorklistSeverityCounts([
    { control_severity: "READY" },
    { control_severity: "weird_new_code" },
    { control_severity: null },
    { control_severity: "BLOCKER" },
  ]);
  assert.deepEqual(counts.map((c) => c.severity), ["BLOCKER", "READY", "(none)", "WEIRD_NEW_CODE"]);
});
