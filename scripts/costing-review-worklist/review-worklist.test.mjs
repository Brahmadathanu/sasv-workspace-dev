// Costing review worklist v1 (flag COSTING_REVIEW_WORKLIST_V1, default OFF).
// node:test only, no deps, no network. Sandbox approach as in
// scripts/costing-table-tools/table-tools-pkg3.test.mjs: the REAL shell
// functions (head and base) run in node:vm with mocked DOM/controllers.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as flags from "../../public/shared/js/costing-feature-flags.js";
import * as worklist from "../../public/shared/js/costing-review-worklist.js";
import * as tableTools from "../../public/shared/js/costing-table-tools.js";
import {
  formatFirstControlStatusLabel,
  formatRecommendedUiRouteLabel,
  resolveRecommendedUiRouteTarget,
} from "../../public/shared/js/costing-suite-recommended-ui-route.js";
import { costingStatusDisplayLabel } from "../../public/shared/js/costing-status-labels.js";

const {
  REVIEW_WORKLIST_EMPTY_TEXT,
  REVIEW_WORKLIST_FROZEN_RUN_TEXT,
  REVIEW_WORKLIST_MIXED_NOTES_TEXT,
  REVIEW_WORKLIST_NO_LINK_TEXT,
  REVIEW_WORKLIST_NO_NAV_TOAST,
  groupReviewWorklistRows,
  renderReviewWorklistHtml,
  reviewWorklistGroupKey,
  reviewWorklistRouteContext,
  reviewWorklistRunContext,
} = worklist;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const BASE = "be20ea68ca4ff35bd0b9aead76438d3cf62e7cfd";
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const readBase = (rel) => git("show", `${BASE}:${rel}`);
const SHELL = "public/shared/js/costing-suite-shell.js";
const MODULE = "public/shared/js/costing-review-worklist.js";
const JS = "public/shared/js";
const LENS = "sku-control-status";

// Real sku-control-status headers/alignments, read from the controller source.
const ccSrc = read(`${JS}/costing-suite-control-center.js`);
const literal = (name) =>
  JSON.parse(JSON.stringify(vm.runInNewContext(`(${ccSrc.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`))[1]})`)));
const CC_HEADERS = literal("HEADERS_BY_LENS");
const CC_ALIGNMENTS = literal("ALIGNMENTS_BY_LENS");

// ---- Fixture rows mirroring the run 148 server codes, plus READY rows ----
function makeRows() {
  const base = { period_start: "2026-10-01", refresh_run_id: 148, valuation_date: "2026-10-31", snapshot_refreshed_at: "2026-11-01T04:00:00+00:00" };
  const rows = [];
  let sku = 1;
  const add = (n, codes, extra = {}) => {
    for (let i = 0; i < n; i += 1) {
      rows.push({
        ...base,
        sku_id: sku,
        product_id: 1000 + sku,
        product_name: `Product ${String(sku).padStart(3, "0")}`,
        pack_size: (sku % 7) * 50 + 10,
        pack_uom: "ml",
        rm_blocking_line_count: 0,
        pm_blocking_line_count: 0,
        selling_price_bridge_status: "READY",
        pricing_bridge_status: "READY",
        mrp_ik: 100 + sku,
        ...codes,
        ...extra,
      });
      sku += 1;
    }
  };
  add(20, { control_severity: "READY", first_control_status: "READY", recommended_ui_route: null, control_note: null });
  add(110, { control_severity: "REVIEW_REQUIRED", first_control_status: "PRIME_COST_REVIEW_REQUIRED", recommended_ui_route: "COST_REVIEW_WORKBENCH", control_note: "Prime cost needs review." });
  add(1, { control_severity: "BLOCKER", first_control_status: "MATERIAL_COST_BLOCKED", recommended_ui_route: "MATERIAL_RATE_MANAGER", control_note: "No rate for I000019D.", pm_blocking_line_count: 1 });
  add(2, { control_severity: "REVIEW_REQUIRED", first_control_status: "MATERIAL_REVIEW_REQUIRED", recommended_ui_route: "MATERIAL_RATE_REVIEW", control_note: null }, {});
  rows[rows.length - 1].control_note = "Rate older than policy.";
  add(1, { control_severity: "REVIEW_REQUIRED", first_control_status: "PRICING_BRIDGE_REVIEW_REQUIRED", recommended_ui_route: "COST_REVIEW_WORKBENCH", control_note: "=Regional <b>bridge</b>" });
  add(5, { control_severity: "READY", first_control_status: "READY", recommended_ui_route: "", control_note: null });
  return rows;
}

// ---- Sandbox harness ----
function extractFn(src, name) {
  let start = src.indexOf(`\nfunction ${name}(`);
  const asyncStart = src.indexOf(`\nasync function ${name}(`);
  if (start < 0 || (asyncStart >= 0 && asyncStart < start)) start = asyncStart;
  assert.ok(start >= 0, `function ${name} found`);
  const end = src.indexOf("\n}\n", start);
  return src.slice(start + 1, end + 2);
}

function makeElement() {
  const el = {
    _html: "",
    classes: new Set(),
    nodes: [],
    classList: {
      add: (c) => el.classes.add(c),
      remove: (c) => el.classes.delete(c),
      contains: (c) => el.classes.has(c),
    },
    set innerHTML(v) {
      el._html = v;
      el.nodes = [...v.matchAll(/<button[^>]*?\sdata-(rwl-select|rwl-clear|rwl-open|cw05-sort)="([^"]*)"[^>]*>/g)].map((m) => {
        const attr = m[1];
        const dsKey = attr.replace(/-(\w)/g, (_, c) => c.toUpperCase());
        const value = m[2].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#039;/g, "'");
        const node = {
          attr,
          dataset: { [dsKey]: value },
          handlers: [],
          addEventListener(type, fn) {
            if (type === "click") node.handlers.push(fn);
          },
          click() {
            node.handlers.forEach((fn) => fn({ preventDefault() {}, stopPropagation() {} }));
          },
        };
        return node;
      });
    },
    get innerHTML() {
      return el._html;
    },
    querySelectorAll(sel) {
      const m = sel.match(/^(?:button)?\[data-([\w-]+)\]$/);
      return m ? el.nodes.filter((n) => n.attr === m[1]) : [];
    },
    button(attr, value) {
      return el.nodes.find((n) => n.attr === attr && (value === undefined || Object.values(n.dataset)[0] === value));
    },
  };
  return el;
}

// renderTable stand-in: runs the shell's REAL workbench-summary branch text
// (legacy line + any gated worklist call), then renders the head and a body
// with data-row-index like the shell's generic body.
function summaryBranch(src) {
  const m = src.match(/ else \{\n    controlCenterCtrl\.renderWorkbenchSummary\(ALL_ROWS, CURRENT_LENS\);\n(?:    [\s\S]*?\n)?  \}\n/);
  assert.ok(m, "summary branch found");
  return m[0].replace(/^ else /, "");
}

function makeSandbox({ source, worklistOn, tableToolsOn = false }) {
  const no = () => false;
  const ctx = {
    ...tableTools,
    ...worklist,
    CURRENT_LENS: LENS,
    ALL_ROWS: [],
    VIEW: [],
    CURRENT_PAGE: 3,
    PAGE_SIZE: 25,
    CW05_SORT_CTX: null,
    REVIEW_WORKLIST_GROUP: null,
    REVIEW_WORKLIST_RUN_STATUS: null,
    REVIEW_WORKLIST_RUN_SELECTION: null,
    REVIEW_WORKLIST_RUN_LOAD: null,
    REVIEW_WORKLIST_PENDING_RUN: null,
    renderCccRunContextChrome: () => null,
    ROWS_LOAD_GENERATION: 0,
    isRowsLoadCurrent: (g) => g === ctx.ROWS_LOAD_GENERATION,
    fetchAllRows: async () => [],
    costingFrom: (view) => ctx.supabase.from(view),
    runStatusQueries: [],
    // C1: run-status reads go to the existing period status view (mocked; approved run 148 for the fixture).
    supabase: {
      from(view) {
        const q = { view, select: null, filters: [] };
        ctx.runStatusQueries.push(q);
        const api = {
          select(cols) { q.select = cols; return api; },
          eq(k, v) { q.filters.push([k, v]); return api; },
          maybeSingle: () => Promise.resolve({ data: { period_start: "2026-10-01", display_state: "APPROVED", display_label: "Approved run 148", displayed_run_id: 148, approved_run_id: 148, newer_draft_run_id: null, active_run_id: null, active_run_status: null }, error: null }),
        };
        return api;
      },
    },
    ACTIVE_FILTERS: { status: [], issue: [], source: [] },
    ACTIVE_PERIOD_START: "2026-10-01",
    searchBox: { value: "" },
    tableHead: makeElement(),
    tableBody: makeElement(),
    workbenchSummary: makeElement(),
    toasts: [],
    navigations: [],
    csvOut: [],
    showToast: (msg, kind) => ctx.toasts.push([msg, kind]),
    navigateToCostingRoute: (moduleKey, params, options) => {
      ctx.navigations.push({ moduleKey, params, options });
      return true;
    },
    Blob: class {
      constructor(parts) {
        ctx.csvOut.push(parts.join(""));
      }
    },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
    document: { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } },
    isCostingReviewWorklistV1Enabled: () => worklistOn,
    isCostingTableToolsV1Enabled: () => tableToolsOn,
    isQcActionQueueLens: no,
    isMaterialsStoresActionQueueLens: no,
    isProductionRouteLens: no,
    isDriverGovernanceLens: no,
    isCostBuildLens: no,
    isMaterialCostLens: no,
    isSchemeComparisonLens: no,
    isCostSheetLens: no,
    isPricingPolicyLens: no,
    isControlCenterLens: (l) => ["dashboard", "costing-review-workbench", "sku-control-status"].includes(l),
    isRmCostTraceLensActive: no,
    isPmCostTraceLensActive: no,
    isMaterialCostTraceLensActive: no,
    shouldUseCccProgressiveRender: no,
    shouldRenderAllCccDashboardRows: no,
    resetCccProgressiveWindow: () => {},
    updateSearchClear: () => {},
    pricingPolicyCtrl: {},
    costBuildCtrl: {},
    materialCostCtrl: {},
    controlCenterCtrl: {
      getTableHeaders: (l) => CC_HEADERS[l] || null,
      getTableAlignments: (l) => CC_ALIGNMENTS[l] || null,
      renderWorkbenchSummary() {
        ctx.workbenchSummary.classList.remove("is-visible");
        ctx.workbenchSummary.innerHTML = "";
      },
    },
  };
  vm.createContext(ctx);
  const names = [
    "escapeHtml",
    "text",
    "getRowStatus",
    "getSearchBlob",
    "filterMatch",
    "applyFilters",
    "applySearch",
    "renderTableHeaderForLens",
    "renderCw05GenericTableHeader",
    "cw05TabTableId",
    "exportActiveViewCsv",
    "exportCw05CsvForView",
    "exportCsvForRows",
  ];
  if (source.includes("\nfunction renderReviewWorklistPanel(")) names.push("reviewWorklistSelectedKey", "renderReviewWorklistPanel");
  if (source.includes("\nfunction reviewWorklistRunStatus(")) names.push("reviewWorklistRunStatus");
  if (source.includes("\nfunction reviewWorklistActiveRun(")) names.push("reviewWorklistActiveRun", "reviewWorklistGovernedRows", "selectReviewWorklistRun");
  vm.runInContext(
    [
      ...names.map((n) => extractFn(source, n)),
      `function renderTable() {
  ${summaryBranch(source)}
  renderTableHeaderForLens();
  const start = (CURRENT_PAGE - 1) * PAGE_SIZE;
  tableBody.innerHTML = VIEW.slice(start, start + PAGE_SIZE)
    .map((row, idx) => '<tr class="clickable" data-row-index="' + (start + idx) + '"><td>' + text(row.product_name) + '</td></tr>')
    .join("");
}`,
    ].join("\n"),
    ctx,
  );
  return ctx;
}

const run = (ctx, code) => vm.runInContext(code, ctx);
function load(ctx, rows) {
  ctx.ALL_ROWS = rows; // the shell's load block: ALL_ROWS = rows; applyFilters();
  run(ctx, "applyFilters()");
}
function exportCsv(ctx) {
  ctx.csvOut.length = 0;
  run(ctx, "exportActiveViewCsv()");
  assert.equal(ctx.csvOut.length, 1);
  return ctx.csvOut[0];
}
const ids = (rows) => Array.from(rows, (r) => r.sku_id);

// 1. Flag OFF byte-identical
test("worklist flag OFF: summary host, head, body, VIEW order and CSV equal base; no rwl output", () => {
  for (const tableToolsOn of [false, true]) {
    const base = makeSandbox({ source: readBase(SHELL), worklistOn: false, tableToolsOn });
    const head = makeSandbox({ source: read(SHELL), worklistOn: false, tableToolsOn });
    const rows = makeRows();
    load(base, rows);
    load(head, rows);
    for (const k of ["workbenchSummary", "tableHead", "tableBody"]) {
      assert.equal(head[k].innerHTML, base[k].innerHTML, k);
      assert.doesNotMatch(head[k].innerHTML, /rwl-|data-rwl/, k);
    }
    assert.deepEqual([...head.workbenchSummary.classes], [...base.workbenchSummary.classes]);
    assert.deepEqual(ids(head.VIEW), ids(base.VIEW));
    assert.equal(exportCsv(head), exportCsv(base));
  }
});

test("worklist flag OFF: legacy shell lines unchanged; every new line is behind the flag", () => {
  const head = read(SHELL);
  const base = readBase(SHELL);
  for (const legacy of [
    "    controlCenterCtrl.renderWorkbenchSummary(ALL_ROWS, CURRENT_LENS);\n",
    `    if (CURRENT_LENS === "sku-control-status") {\n      const rows = await controlCenterCtrl.loadSkuControlStatusRows(\n        ACTIVE_PERIOD_START,\n      );\n      if (!isRowsLoadCurrent(loadGeneration)) return;\n      ALL_ROWS = rows;\n      applyFilters();\n      LAST_REFRESH_TIME = new Date();\n      updateFreshnessIndicator();\n      void reloadCostPeriodValuationIfNeeded();\n      return;\n    }\n`,
  ]) {
    assert.equal(base.split(legacy).length, 2, "in base");
    assert.equal(head.split(legacy).length, 2, "intact in head");
  }
  const added = git("diff", "-U0", BASE, "--", SHELL)
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"));
  assert.ok(added.length > 0);
  // The only call sites outside the two helpers sit directly inside the flag + lens gate.
  for (const gated of [
    '  if (isCostingReviewWorklistV1Enabled() && CURRENT_LENS === "sku-control-status") {\n    rows = filterReviewWorklistRows(rows, reviewWorklistSelectedKey());\n  }\n',
    '    if (isCostingReviewWorklistV1Enabled() && CURRENT_LENS === "sku-control-status") {\n      renderReviewWorklistPanel();\n    }\n',
    // UX-F1: run-context chrome (KPI caption + Dashboard card), flag only (any CCC lens).
    '    if (isCostingReviewWorklistV1Enabled()) {\n      renderCccRunContextChrome();\n    }\n',
    '      if (isCostingReviewWorklistV1Enabled()) {\n        renderCccKpiRunCaption();\n      }\n',
  ]) {
    assert.equal(head.split(gated).length, 2, gated);
  }
  for (const fn of ["renderCccKpiRunCaption", "renderCccRunContextChrome"]) {
    assert.match(extractFn(head, fn).split("\n")[1], /^\s+if \(!isCostingReviewWorklistV1Enabled\(\)\) return null;$/, fn);
  }
  const HELPERS = ["reviewWorklistSelectedKey", "reviewWorklistRunStatus", "reviewWorklistActiveRun", "reviewWorklistGovernedRows", "selectReviewWorklistRun", "renderReviewWorklistPanel"];
  const helpers = HELPERS.map((fn) => extractFn(head, fn));
  const outsideHelpers = helpers.reduce((acc, h) => acc.replace(h, ""), head);
  const calls = outsideHelpers.split("\n").filter((l) => /reviewWorklistSelectedKey\(\)|renderReviewWorklistPanel\(\)/.test(l));
  assert.deepEqual(calls.map((l) => l.trim()), [
    "rows = filterReviewWorklistRows(rows, reviewWorklistSelectedKey());",
    "renderReviewWorklistPanel();",
  ]);
  for (const fn of HELPERS) {
    const body = extractFn(head, fn);
    assert.match(body.split("\n")[1], /^\s+if \(!\(isCostingReviewWorklistV1Enabled\(\) && CURRENT_LENS === "sku-control-status"\)\) return/);
  }
  const gates = head.split("\n").filter((l) => l.includes('isCostingReviewWorklistV1Enabled() && CURRENT_LENS === "sku-control-status"'));
  assert.equal(gates.length, 8); // 2 call-site gates + 6 helper early returns (C1: run status; C1B: active run, governed rows, select run)
  for (const re of [/\.rpc\(/, /new Date/, /Date\.now/, /Date\.parse/]) {
    assert.ok(!added.some((l) => re.test(l)), String(re));
  }
  // C1B + UX-F1: the only added costingFrom reads are of the run-scoped view, inside the gated
  // run selector (C1B) and the gated dashboard draft summary (UX-F1).
  const costingFromLines = added.filter((l) => /costingFrom\(/.test(l));
  assert.deepEqual(costingFromLines.map((l) => l.slice(1).trim()), ["costingFrom(REVIEW_WORKLIST_BY_RUN_VIEW)", "costingFrom(REVIEW_WORKLIST_BY_RUN_VIEW)"]);
  assert.ok(extractFn(head, "selectReviewWorklistRun").includes("costingFrom(REVIEW_WORKLIST_BY_RUN_VIEW)"));
  assert.ok(extractFn(head, "renderCccRunContextChrome").includes("costingFrom(REVIEW_WORKLIST_BY_RUN_VIEW)"));
  assert.equal(worklist.REVIEW_WORKLIST_BY_RUN_VIEW, "v_costing_pricing_sku_control_status_by_run");
  // C1: exactly one added read, of the existing authorised period run-status view (same view and
  // columns as the run-status badge), and only inside the flag-gated reviewWorklistRunStatus helper.
  const fromLines = added.filter((l) => /\.from\(/.test(l));
  assert.deepEqual(fromLines.map((l) => l.slice(1).trim()), [".from(REVIEW_WORKLIST_RUN_STATUS_VIEW)", ".from(REVIEW_WORKLIST_RUN_STATUS_VIEW)"]);
  assert.ok(extractFn(head, "reviewWorklistRunStatus").includes(".from(REVIEW_WORKLIST_RUN_STATUS_VIEW)"));
  assert.ok(extractFn(head, "renderCccRunContextChrome").includes(".from(REVIEW_WORKLIST_RUN_STATUS_VIEW)"));
  assert.equal(worklist.REVIEW_WORKLIST_RUN_STATUS_VIEW, "v_costing_pricing_period_run_status");
  assert.equal(
    worklist.REVIEW_WORKLIST_RUN_STATUS_SELECT,
    "period_start,display_state,display_label,displayed_run_id,approved_run_id,approved_at,approved_by,newer_draft_run_id,active_run_id,active_run_status",
  );
});

// 2. Self-check (i)
test("worklist self-check (i): 4 server-code groups; show in table filters VIEW; row index maps; clear and reload reset", () => {
  const ctx = makeSandbox({ source: read(SHELL), worklistOn: true });
  const rows = makeRows();
  load(ctx, rows);
  assert.equal(ctx.VIEW.length, rows.length);
  const html = ctx.workbenchSummary.innerHTML;
  assert.ok(ctx.workbenchSummary.classes.has("is-visible"));
  const groups = groupReviewWorklistRows(rows);
  assert.deepEqual(
    groups.map((g) => [g.key, g.count]),
    [
      ["BLOCKER|MATERIAL_COST_BLOCKED|MATERIAL_RATE_MANAGER", 1],
      ["REVIEW_REQUIRED|PRIME_COST_REVIEW_REQUIRED|COST_REVIEW_WORKBENCH", 110],
      ["REVIEW_REQUIRED|MATERIAL_REVIEW_REQUIRED|MATERIAL_RATE_REVIEW", 2],
      ["REVIEW_REQUIRED|PRICING_BRIDGE_REVIEW_REQUIRED|COST_REVIEW_WORKBENCH", 1],
    ],
  );
  assert.ok(groups.every((g) => g.severity !== "READY"));
  assert.equal(ctx.workbenchSummary.querySelectorAll("[data-rwl-select]").length, 4);
  assert.ok(html.includes("110 SKUs") && html.includes("1 SKU<"));
  // Group rows keep identity and input order.
  assert.ok(groups[1].rows.every((r) => rows.includes(r)));

  const key = "REVIEW_REQUIRED|MATERIAL_REVIEW_REQUIRED|MATERIAL_RATE_REVIEW";
  ctx.workbenchSummary.button("rwl-select", key).click();
  assert.equal(ctx.CURRENT_PAGE, 1);
  assert.equal(ctx.VIEW.length, 2);
  assert.ok(ctx.VIEW.every((r) => reviewWorklistGroupKey(r) === key));
  for (const tr of ctx.tableBody.innerHTML.match(/data-row-index="(\d+)"/g)) {
    const idx = Number(tr.match(/\d+/)[0]);
    assert.equal(reviewWorklistGroupKey(ctx.VIEW[idx]), key);
  }
  assert.match(ctx.workbenchSummary.innerHTML, /data-rwl-clear/);
  assert.match(ctx.workbenchSummary.innerHTML, /rwl-group rwl-card rwl-sev-review rwl-selected" data-rwl-group="REVIEW_REQUIRED\|MATERIAL_REVIEW_REQUIRED\|MATERIAL_RATE_REVIEW"/);
  // Search still narrows within the group (existing search, unchanged).
  ctx.searchBox.value = "nothing-matches";
  run(ctx, "applySearch()");
  assert.equal(ctx.VIEW.length, 0);
  ctx.searchBox.value = "";
  run(ctx, "applySearch()");
  assert.equal(ctx.VIEW.length, 2);

  ctx.workbenchSummary.button("rwl-clear").click();
  assert.equal(ctx.VIEW.length, rows.length);
  assert.deepEqual(ids(ctx.VIEW), ids(rows));
  assert.doesNotMatch(ctx.workbenchSummary.innerHTML, /data-rwl-clear/);

  // Reload / period change / lens re-entry assign a new ALL_ROWS: selection resets.
  ctx.workbenchSummary.button("rwl-select", key).click();
  assert.equal(ctx.VIEW.length, 2);
  load(ctx, makeRows());
  assert.equal(ctx.VIEW.length, rows.length);
  assert.equal(ctx.REVIEW_WORKLIST_GROUP, null);
  assert.doesNotMatch(ctx.workbenchSummary.innerHTML, /rwl-selected|data-rwl-clear/);
});

test("worklist self-check (i): empty state when the run shown has no blocked or review SKUs", () => {
  const ctx = makeSandbox({ source: read(SHELL), worklistOn: true });
  load(ctx, makeRows().filter((r) => r.control_severity === "READY"));
  assert.ok(ctx.workbenchSummary.innerHTML.includes(REVIEW_WORKLIST_EMPTY_TEXT));
  assert.equal(ctx.workbenchSummary.querySelectorAll("[data-rwl-select]").length, 0);
  assert.ok(ctx.workbenchSummary.innerHTML.includes("Run shown: 148 · valuation 2026-10-31"));
  load(ctx, []);
  // C1: no rows at all is distinguished from "rows, but none blocked or under review".
  assert.ok(ctx.workbenchSummary.innerHTML.includes(worklist.REVIEW_WORKLIST_NO_ROWS_TEXT));
  assert.ok(ctx.workbenchSummary.innerHTML.includes("Run shown: -- · valuation --"));
});

// 3. Navigation
test("worklist navigation: mapped groups open via the existing resolver; unmapped groups have no button", () => {
  const ctx = makeSandbox({ source: read(SHELL), worklistOn: true });
  const rows = makeRows();
  load(ctx, rows);
  const groups = groupReviewWorklistRows(rows);
  const blocker = groups.find((g) => g.route === "MATERIAL_RATE_MANAGER");
  ctx.workbenchSummary.button("rwl-open", blocker.key).click();
  const expected = resolveRecommendedUiRouteTarget("MATERIAL_RATE_MANAGER", reviewWorklistRouteContext(blocker.rows[0]));
  assert.equal(expected.navigable, true);
  assert.equal(ctx.navigations.length, 1);
  assert.equal(ctx.navigations[0].moduleKey, "material-cost-manager");
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.navigations[0].params)), JSON.parse(JSON.stringify(expected.navigateParams || { lens: expected.lensId })));
  assert.deepEqual({ ...ctx.navigations[0].options }, { newTab: expected.newTab === true });

  const rateReview = groups.find((g) => g.route === "MATERIAL_RATE_REVIEW");
  ctx.workbenchSummary.button("rwl-open", rateReview.key).click();
  const rr = resolveRecommendedUiRouteTarget("MATERIAL_RATE_REVIEW", reviewWorklistRouteContext(rateReview.rows[0]));
  assert.equal(ctx.navigations[1].moduleKey, "costing-control-center");
  assert.equal(ctx.navigations[1].params.lens ?? rr.lensId, "costing-review-workbench");
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.navigations[1].params)), JSON.parse(JSON.stringify(rr.navigateParams || { lens: rr.lensId })));

  for (const g of groups.filter((x) => x.route === "COST_REVIEW_WORKBENCH")) {
    assert.equal(ctx.workbenchSummary.button("rwl-open", g.key), undefined, g.key);
    const block = ctx.workbenchSummary.innerHTML.split(`data-rwl-group="${g.key}"`)[1].split("</div>\n</div>")[0];
    assert.ok(block.includes(REVIEW_WORKLIST_NO_LINK_TEXT), g.key);
  }
  assert.equal(ctx.navigations.length, 2);
  assert.equal(ctx.toasts.length, 0);

  // Non-navigable fallback uses the control centre's existing toast text.
  assert.equal(REVIEW_WORKLIST_NO_NAV_TOAST, "No dedicated navigation is configured for this control yet.");
  assert.ok(ccSrc.includes(`"${REVIEW_WORKLIST_NO_NAV_TOAST}"`), "same toast text as the control centre");
});

// 4. Self-check (ii): exports keep every column
test("worklist self-check (ii): CSV of a selected group keeps the legacy header and values; only group rows", () => {
  for (const tableToolsOn of [false, true]) {
    const ctx = makeSandbox({ source: read(SHELL), worklistOn: true, tableToolsOn });
    const legacy = makeSandbox({ source: readBase(SHELL), worklistOn: false, tableToolsOn: false });
    const rows = makeRows();
    load(ctx, rows);
    const key = "REVIEW_REQUIRED|PRICING_BRIDGE_REVIEW_REQUIRED|COST_REVIEW_WORKBENCH";
    ctx.workbenchSummary.button("rwl-select", key).click();
    const groupRows = rows.filter((r) => reviewWorklistGroupKey(r) === key);
    const csv = exportCsv(ctx);
    load(legacy, rows);
    legacy.VIEW = groupRows;
    const legacyCsv = exportCsv(legacy);
    assert.equal(csv.split("\n")[0], legacyCsv.split("\n")[0], `header (table tools ${tableToolsOn})`);
    assert.deepEqual(csv.split("\n")[0].split(",").map((h) => JSON.parse(h)), Object.keys(rows[0]));
    assert.equal(csv.split("\n").length, 1 + groupRows.length);
    if (tableToolsOn) {
      assert.notEqual(csv, legacyCsv);
      assert.equal(csv.replace(/"'([=+\-@\t\r])/g, '"$1'), legacyCsv);
    } else {
      assert.equal(csv, legacyCsv);
    }
  }
  // With table tools ON, a CW-05 header sort still applies within the group.
  const ctx = makeSandbox({ source: read(SHELL), worklistOn: true, tableToolsOn: true });
  load(ctx, makeRows());
  ctx.workbenchSummary.button("rwl-select", "REVIEW_REQUIRED|PRIME_COST_REVIEW_REQUIRED|COST_REVIEW_WORKBENCH").click();
  const before = ids(ctx.VIEW);
  const packBtn = ctx.tableHead.button("cw05-sort", "2");
  packBtn.click();
  assert.equal(ctx.VIEW.length, 110);
  assert.notDeepEqual(ids(ctx.VIEW), before);
  assert.ok(ctx.VIEW.every((r) => r.first_control_status === "PRIME_COST_REVIEW_REQUIRED"));
});

// 5. No writes / no new data access
test("worklist module: no data access, writes or clock; FORBIDDEN_RPCS identical; no new view names", () => {
  const src = read(MODULE);
  assert.doesNotMatch(src, /supabase|\.rpc\(|\.from\(|costingFrom|fetch\(|insert|update|upsert|delete|new Date|Date\.now|Date\.parse/);
  assert.doesNotMatch(src, /\bdocument\b|\bwindow\b|localStorage/);
  const rel = `${JS}/costing-approval-screen.js`;
  const slice = (s) => {
    const i = s.indexOf("export const FORBIDDEN_RPCS");
    return s.slice(i, s.indexOf("]);", i) + 3);
  };
  assert.ok(slice(read(rel)).length > 40);
  assert.equal(slice(read(rel)), slice(readBase(rel)));
  const views = (s) => [...s.matchAll(/costingFrom\(\s*"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(views(read(SHELL)), views(readBase(SHELL)));
  const rpcs = (s) => [...s.matchAll(/\.rpc\(\s*"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(rpcs(read(SHELL)), rpcs(readBase(SHELL)));
});

// 6. Labels, escaping, fixed sentence, raw run line
test("worklist labels come from the existing helpers; server text escaped; fixed sentence; raw run line", () => {
  const rows = makeRows();
  rows[rows.length - 6].product_name = "<script>alert(1)</script>";
  const groups = groupReviewWorklistRows(rows);
  const html = renderReviewWorklistHtml(groups, { selectedKey: null, runContext: reviewWorklistRunContext(rows) });
  for (const g of groups) {
    assert.ok(html.includes(`<span class="rwl-severity">${costingStatusDisplayLabel(g.severity)}</span>`), g.key);
    assert.ok(html.includes(`<div class="rwl-primary">${formatFirstControlStatusLabel(g.firstControlStatus)}</div>`), g.key);
    assert.ok(html.includes(`<div class="rwl-route">${formatRecommendedUiRouteLabel(g.route)}</div>`), g.key);
  }
  assert.ok(html.includes(REVIEW_WORKLIST_FROZEN_RUN_TEXT));
  assert.equal(
    REVIEW_WORKLIST_FROZEN_RUN_TEXT,
    "Fixes you make on the fix screens do not change this frozen run. They count only after a separate, approved recalculation.",
  );
  assert.ok(html.includes("Run shown: 148 · valuation 2026-10-31"));
  assert.doesNotMatch(html, /<script>|<b>/);
  assert.ok(html.includes("=Regional &lt;b&gt;bridge&lt;/b&gt;"));
  // Notes: shared note shown; differing notes -> fixed text; all-empty -> nothing.
  const byRoute = Object.fromEntries(groups.map((g) => [g.firstControlStatus, g]));
  assert.equal(byRoute.PRIME_COST_REVIEW_REQUIRED.note, "Prime cost needs review.");
  assert.equal(byRoute.MATERIAL_REVIEW_REQUIRED.notesDiffer, true);
  assert.ok(html.includes(REVIEW_WORKLIST_MIXED_NOTES_TEXT));
  // Several runs / dates are listed verbatim.
  const mixed = [{ refresh_run_id: 143, valuation_date: "2026-09-30" }, { refresh_run_id: "148", valuation_date: "2026-10-31" }];
  assert.deepEqual(reviewWorklistRunContext(mixed), { runIds: ["143", "148"], valuationDates: ["2026-09-30", "2026-10-31"] });
  assert.ok(renderReviewWorklistHtml([], { runContext: reviewWorklistRunContext(mixed) }).includes("Run shown: 143, 148 · valuation 2026-09-30, 2026-10-31"));
  // Escaped key attributes round-trip; group keys are raw upper-cased server codes.
  assert.equal(reviewWorklistGroupKey({ control_severity: " review_required ", first_control_status: "x", recommended_ui_route: null }), "REVIEW_REQUIRED|X|");
});

// 7. Route-context drift guard
test("worklist route context keys equal the control centre's buildSkuControlRouteContext", () => {
  const body = ccSrc.match(/function buildSkuControlRouteContext\(row\) \{\n\s+return \{([\s\S]*?)\};\n\s+\}/)[1];
  const pairs = [...body.matchAll(/(\w+): row\?\.(\w+),/g)].map((m) => [m[1], m[2]]);
  assert.equal(pairs.length, 7);
  const row = Object.fromEntries(pairs.map(([, field], i) => [field, `v${i}`]));
  const ctx = reviewWorklistRouteContext(row);
  assert.deepEqual(Object.keys(ctx), pairs.map(([k]) => k));
  pairs.forEach(([k], i) => assert.equal(ctx[k], `v${i}`, k));
});

// 8. Flag
test("COSTING_REVIEW_WORKLIST_V1 defaults OFF and accepts exactly string 1", () => {
  assert.equal(flags.COSTING_REVIEW_WORKLIST_V1, "COSTING_REVIEW_WORKLIST_V1");
  for (const value of [null, undefined, "", "0", 1, true, "true", " 1", "1 "]) {
    assert.equal(flags.isCostingReviewWorklistV1Enabled({ getItem: () => value }), false, String(value));
  }
  assert.equal(flags.isCostingReviewWorklistV1Enabled({ getItem: (k) => (k === "COSTING_REVIEW_WORKLIST_V1" ? "1" : null) }), true);
  assert.equal(flags.isCostingReviewWorklistV1Enabled({ getItem: () => { throw new Error("blocked"); } }), false);
  assert.equal(flags.isCostingReviewWorklistV1Enabled(undefined), false);
  const src = read(`${JS}/costing-feature-flags.js`);
  assert.ok(src.trimEnd().endsWith('return storage?.getItem?.(COSTING_REVIEW_WORKLIST_V1) === "1";\n  } catch {\n    return false;\n  }\n}'));
  assert.ok(src.startsWith(readBase(`${JS}/costing-feature-flags.js`)), "append only");
});

// 9. Protected files, help, sw, CSS
test("worklist: protected files unchanged; COLUMN_HELP unchanged; sw line 2; CSS append-only .rwl- block", async () => {
  const protectedFiles = [
    "costing-approval-screen.js", "costing-approval-errors.js", "costing-approval-labels.js",
    // costing-run-status-badge.js: changed by UX-F1 (compact chip, flag ON only); its flag-OFF path is
    // checked in scripts/costing-ccc-uxf1/uxf1.test.mjs.
    "costing-run-status-screen.js", "costing-recalculation.js", "costing-status-labels.js",
    "costing-suite-control-center.js", "costing-suite-recommended-ui-route.js", "costing-route-config.js",
    "costing-suite-pricing-policy.js", "costing-suite-cost-build.js", "costing-suite-material-cost.js",
  ].map((f) => `${JS}/${f}`);
  assert.equal(git("diff", BASE, "--", ...protectedFiles, "supabase/", "package.json"), "");
  assert.equal(git("diff", "--name-only", BASE, "--", "*.html").trim(), "");
  const baseTools = readBase(`${JS}/costing-table-tools.js`);
  const baseMod = await import(`data:text/javascript;base64,${Buffer.from(baseTools).toString("base64")}`);
  assert.deepEqual(JSON.parse(JSON.stringify(tableTools.COLUMN_HELP)), JSON.parse(JSON.stringify(baseMod.COLUMN_HELP)));
  assert.equal(
    read("public/sw.js").split("\n")[1],
    'const CACHE_NAME = "hub-cache-v388"; // Costing review worklist run context and run selector (C1/C1B); v387 was CW-05 pkg 4 table tools',
  );
  const cssChanged = git("diff", "--name-only", BASE, "--", "*.css").trim().split("\n").filter(Boolean);
  assert.ok(cssChanged.length === 0 || (cssChanged.length === 1 && cssChanged[0] === "public/shared/css/sasv-costing.css"));
  if (cssChanged.length) {
    const head = read("public/shared/css/sasv-costing.css");
    const base = readBase("public/shared/css/sasv-costing.css");
    assert.ok(head.startsWith(base), "append only");
    const added = head.slice(base.length);
    const selectors = added.split("\n").filter((l) => /\{\s*$/.test(l) || /,\s*$/.test(l));
    assert.ok(selectors.length > 0);
    // Every selector is scoped to flag-only markup: .rwl- (worklist), .ccc- (UX-F1 run context) or
    // the compact header chip (.sc-run-status[data-compact="1"], set only when the flag is ON).
    for (const l of selectors) {
      if (/^\s*@media/.test(l)) continue;
      for (const part of l.replace(/\{\s*$/, "").split(",").map((x) => x.trim()).filter(Boolean)) {
        assert.match(part, /^(\.rwl-|\.ccc-|\.sc-run-status\[data-compact="1"\])/, part);
      }
    }
  }
});
