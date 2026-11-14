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
import { costingScopeReport, applyCw07Labels } from "../lib/costing-scope-guard.mjs";
import * as flags from "../../public/shared/js/costing-feature-flags.js";
import * as worklist from "../../public/shared/js/costing-review-worklist.js";
import * as tableTools from "../../public/shared/js/costing-table-tools.js";
import {
  formatFirstControlStatusLabel,
  formatRecommendedUiRouteLabel,
  resolveRecommendedUiRouteTarget,
} from "../../public/shared/js/costing-suite-recommended-ui-route.js";
import { costingStatusDisplayLabel } from "../../public/shared/js/costing-status-labels.js";
import { readSourceLf } from "../lib/read-source-lf.mjs";
import { stripN1 } from "../lib/n1-nav-strip.mjs";
import { stripN2 } from "../lib/n2-nav-strip.mjs";
import { unPersonnel } from "../costing-w506-conf-client/unpersonnel.mjs";
import { stripW6, stripPostW6Approved } from "../lib/w6-nav-strip.mjs";
import { stripU11 } from "../lib/u11-label-strip.mjs";

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
// Historical pre-N1 comparison reader: LF-normalised source with ONLY the flag-gated MDC-07 N1 additions removed from the
// shell and feature-flag files (scripts/lib/n1-nav-strip.mjs). readSourceLf itself is unchanged and strips nothing.
const read = (rel) => stripN1(rel, readSourceLf(root, rel));
const BASE = "be20ea68ca4ff35bd0b9aead76438d3cf62e7cfd";
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const readBase = (rel) => applyCw07Labels(git("show", `${BASE}:${rel}`)); // CW-07: label rename tolerated, nothing else
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
  if (source.includes("\nfunction renderReviewWorklistPanel(")) names.push("normalizeStatus", "statusTokenMatches", "reviewWorklistSelectedKey", "renderReviewWorklistPanel", "setReviewWorklistGroup", "reviewWorklistFilterState", "syncReviewWorklistDrawerGroup", "removeInactiveReviewWorklistDrawerGroup", "clearReviewWorklistGroup");
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
    "if (reviewWorklistSelectedKey()) count += 1;", // UX-F2: drawer badge counts the review group
  ]);
  for (const fn of HELPERS) {
    const body = extractFn(head, fn);
    assert.match(body.split("\n")[1], /^\s+if \(!\(isCostingReviewWorklistV1Enabled\(\) && CURRENT_LENS === "sku-control-status"\)\) return/);
  }
  const gates = head.split("\n").filter((l) => l.includes('isCostingReviewWorklistV1Enabled() && CURRENT_LENS === "sku-control-status"'));
  assert.equal(gates.length, 10); // 2 call-site gates + 6 helper early returns (C1/C1B) + 2 UX-F2 (setReviewWorklistGroup, removeInactiveReviewWorklistDrawerGroup)
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
  assert.ok(html.includes('<span class="rwl-count">110</span>') && html.includes('<span class="rwl-count">1</span>'));
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
  assert.doesNotMatch(ctx.workbenchSummary.innerHTML, /data-rwl-clear|Clear group/, "UX-F5: no Clear group button");
  assert.match(ctx.workbenchSummary.innerHTML, /rwl-chip rwl-sev-review rwl-selected" data-rwl-select="REVIEW_REQUIRED\|MATERIAL_REVIEW_REQUIRED\|MATERIAL_RATE_REVIEW" data-rwl-group="[^"]+" aria-pressed="true"/);
  // Search still narrows within the group (existing search, unchanged).
  ctx.searchBox.value = "nothing-matches";
  run(ctx, "applySearch()");
  assert.equal(ctx.VIEW.length, 0);
  ctx.searchBox.value = "";
  run(ctx, "applySearch()");
  assert.equal(ctx.VIEW.length, 2);

  ctx.workbenchSummary.button("rwl-select", key).click(); // click the active chip again: clears
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

// 3. Navigation (UX-F2): the summary no longer navigates; fix screens stay on the existing row-level actions.
test("worklist navigation: the compact summary has no fix-screen links or navigation", () => {
  const ctx = makeSandbox({ source: read(SHELL), worklistOn: true });
  const rows = makeRows();
  load(ctx, rows);
  const groups = groupReviewWorklistRows(rows);
  const html = ctx.workbenchSummary.innerHTML;
  assert.doesNotMatch(html, /data-rwl-open|rwl-open|Open fix screen|No fix screen link|rwl-nolink/);
  assert.equal(ctx.workbenchSummary.querySelectorAll("[data-rwl-open]").length, 0);
  for (const g of groups) ctx.workbenchSummary.button("rwl-select", g.key).click();
  assert.equal(ctx.navigations.length, 0, "selecting pills never navigates");
  assert.equal(ctx.toasts.length, 0);
  // The route resolver itself is unchanged and still used by the row-level actions of the Control Centre.
  const blocker = groups.find((g) => g.route === "MATERIAL_RATE_MANAGER");
  const expected = resolveRecommendedUiRouteTarget("MATERIAL_RATE_MANAGER", reviewWorklistRouteContext(blocker.rows[0]));
  assert.equal(expected.navigable, true);
  assert.equal(expected.moduleKey, "material-cost-manager");
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
    assert.ok(html.includes(`<span class="rwl-chip-label">${formatFirstControlStatusLabel(g.firstControlStatus)}</span>`), g.key);
    assert.ok(html.includes(`aria-label="${costingStatusDisplayLabel(g.severity)}: ${formatFirstControlStatusLabel(g.firstControlStatus)}, `), g.key);
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
  // Scope guard (WP-07 Bundle B correction): HTML/CSS/supabase/package.json checks cover what Costing owns or
  // depends on (scripts/lib/costing-scope-guard.mjs) instead of the whole repository, so unrelated modules that
  // land on main later (e.g. WP-07 e-Aushadhi HTML/CSS and its own migration) no longer trip this package test.
  // CW-07: costing-route-config.js may differ from the base only by the Cost Sheet label rename (applied to the base text).
  // MDC-07 W6: the PPM controller may carry only the flag-gated W6 five-group projection (scripts/lib/w6-nav-strip.mjs).
  for (const rel of protectedFiles) assert.equal(stripU11(rel, stripW6(rel, stripPostW6Approved(rel, stripN2(rel, unPersonnel(rel, read(rel)))))), readBase(rel), rel);
  const scope = costingScopeReport({ git, root, base: BASE });
  assert.deepEqual(scope.supabase, [], "no Costing or history-rewriting supabase change");
  assert.deepEqual(scope.packageJson, [], "package.json unchanged");
  assert.deepEqual(scope.html, [], "no Costing HTML changed");
  const baseTools = readBase(`${JS}/costing-table-tools.js`);
  const baseMod = await import(`data:text/javascript;base64,${Buffer.from(baseTools).toString("base64")}`);
  assert.deepEqual(JSON.parse(JSON.stringify(tableTools.COLUMN_HELP)), JSON.parse(JSON.stringify(baseMod.COLUMN_HELP)));
  assert.equal(
    read("public/sw.js").split("\n")[1],
    'const CACHE_NAME = "hub-cache-v393"; // WP05-W506 Staff Governance personnel-confidentiality client gate (explicit projections, edit gating); v392 was Costing LOCK-P01 lock-screen CCC-edit guard (#211/#212); v391 was Costing #208 mobile Evidence-table scroll CSS; v390 was Costing UX-F1 Dashboard and compact CCC; v389 was WP-07 e-Aushadhi review UX (UX-1 to UX-10, Bundle A)',
  );
  const cssChanged = scope.css;
  assert.ok(cssChanged.length === 0 || (cssChanged.length === 1 && cssChanged[0] === "public/shared/css/sasv-costing.css"));
  if (cssChanged.length) {
    const head = read("public/shared/css/sasv-costing.css");
    const base = readBase("public/shared/css/sasv-costing.css");
    assert.ok(head.startsWith(base), "append only");
    // CW-13 appended a separate, delimited responsive block; it is checked by its own stricter rule below
    // (every selector body.sasv- scoped). Everything before it must still be UX-F1/F2 worklist CSS only.
    const CW13_MARKER = "/* =====================================================================\n   CW-13: responsive hardening";
    const addedAll = head.slice(base.length);
    const cw13At = addedAll.indexOf(CW13_MARKER);
    const added = cw13At === -1 ? addedAll : addedAll.slice(0, cw13At);
    if (cw13At !== -1) {
      const cw13 = addedAll.slice(cw13At);
      const cw13Selectors = cw13.split("\n").filter((l) => (/\{\s*$/.test(l) || /,\s*$/.test(l)) && !/^\s*(@media|\/\*|\*|=)/.test(l));
      assert.ok(cw13Selectors.length > 0);
      for (const l of cw13Selectors) {
        for (const part of l.replace(/\{\s*$/, "").split(",").map((x) => x.trim()).filter(Boolean)) assert.match(part, /^body\.sasv-/, part);
      }
    }
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

// ===========================================================================
// UX-F2: compact pills + unified drawer group (one canonical group key)
// ===========================================================================
const KEY_BLOCK = "BLOCKER|MATERIAL_COST_BLOCKED|MATERIAL_RATE_MANAGER";
const KEY_PRIME = "REVIEW_REQUIRED|PRIME_COST_REVIEW_REQUIRED|COST_REVIEW_WORKBENCH";
const KEY_MATREV = "REVIEW_REQUIRED|MATERIAL_REVIEW_REQUIRED|MATERIAL_RATE_REVIEW";
const KEY_BRIDGE = "REVIEW_REQUIRED|PRICING_BRIDGE_REVIEW_REQUIRED|COST_REVIEW_WORKBENCH";

// Fake filter drawer so the shell's real drawer-sync code runs in the sandbox.
function withDrawer(ctx) {
  const drawer = {
    section: null,
    querySelector: (sel) => (sel === '[data-peq-section="review-group"]' ? drawer.section : null),
    prepend: (el) => { drawer.section = el; el.remove = () => { drawer.section = null; }; },
  };
  ctx.$ = (id) => (id === "peqFilterDrawer" ? drawer : null);
  ctx.document.createElement = () => {
    const el = { className: "", attrs: {}, handlers: {}, innerHTML: "",
      setAttribute(k, v) { el.attrs[k] = v; }, addEventListener(t, fn) { el.handlers[t] = fn; } };
    return el;
  };
  drawer.pick = (value) => drawer.section.handlers.change({ target: { hasAttribute: (n) => n === "data-rwl-drawer-group", value } });
  drawer.checked = () => (drawer.section?.innerHTML.match(/value="([^"]*)" checked/) || [])[1] ?? null;
  return drawer;
}
const pressedKeys = (ctx) => [...ctx.workbenchSummary.innerHTML.matchAll(/data-rwl-select="([^"]+)" data-rwl-group="[^"]+" aria-pressed="true"/g)].map((m) => m[1]);

test("UX-F2 pills: compact markup with dynamic counts; no cards, route prose or fix links", () => {
  const rows = makeRows();
  const groups = groupReviewWorklistRows(rows);
  const html = renderReviewWorklistHtml(groups, { runContext: reviewWorklistRunContext(rows), rowCount: rows.length });
  assert.doesNotMatch(html, /rwl-card|<ul|<li|rwl-open|Open fix screen|No fix screen|rwl-route|rwl-primary|rwl-note|Show in table<\/button>/);
  const chips = [...html.matchAll(/<button type="button" class="rwl-chip [^"]*" data-rwl-select="([^"]+)"[^>]*><span class="rwl-chip-label">([^<]+)<\/span><span class="rwl-count">(\d+)<\/span><\/button>/g)];
  assert.deepEqual(chips.map((m) => [m[1], Number(m[3])]), [[KEY_BLOCK, 1], [KEY_PRIME, 110], [KEY_MATREV, 2], [KEY_BRIDGE, 1]]);
  // Counts follow the rows given (not hard-coded): a different row set gives different counts.
  const fewer = renderReviewWorklistHtml(groupReviewWorklistRows(rows.filter((r) => r.first_control_status !== "PRIME_COST_REVIEW_REQUIRED")), {});
  assert.doesNotMatch(fewer, /rwl-count">110</);
  assert.equal([...fewer.matchAll(/class="rwl-chip /g)].length, 3);
  // Labels come from the existing helper; every pill is a native button with a pressed state and an accessible name incl. count.
  for (const m of chips) {
    const g = groups.find((x) => x.key === m[1]);
    assert.equal(m[2], formatFirstControlStatusLabel(g.firstControlStatus));
  }
  assert.match(html, new RegExp(`aria-pressed="false" aria-label="${costingStatusDisplayLabel("BLOCKER")}: [^"]*, 1 SKU\\. Show in table"`));
  assert.match(html, /aria-pressed="false" aria-label="[^"]*, 110 SKUs\. Show in table"/);
  assert.doesNotMatch(html, /aria-pressed="true"|data-rwl-clear|data-rwl-scope/);
  // UX-F3: one toolbar (picker, optional draft marker, info disclosure); the run line sits inside the disclosure.
  assert.doesNotMatch(html.replace(/<details[\s\S]*?<\/details>/, ""), /Run shown/);
  assert.match(html, /<details class="rwl-details rwl-info[^"]*">\s*<summary aria-label="Run details and caveats[^"]*" title="[^"]*">/);
  assert.match(html, /<div class="rwl-run">Run shown: 148 · valuation 2026-10-31<\/div>/);
  assert.match(html, /<h2 class="rwl-title rwl-sr">/);
});

test("UX-F2 pills: selected pill is pressed with Clear; same status under two routes gets a route suffix; server text escaped", () => {
  const rows = makeRows();
  rows[rows.length - 1] = { ...rows[rows.length - 1], control_severity: "REVIEW_REQUIRED", first_control_status: "PRIME_COST_REVIEW_REQUIRED", recommended_ui_route: "<img src=x>", control_note: '"><b>x</b>' };
  const groups = groupReviewWorklistRows(rows);
  const html = renderReviewWorklistHtml(groups, { selectedKey: KEY_BLOCK, runContext: reviewWorklistRunContext(rows) });
  assert.deepEqual(pressed(html), [KEY_BLOCK]);
  assert.doesNotMatch(html, /data-rwl-clear|Clear group/);
  const prime = groups.filter((g) => g.firstControlStatus === "PRIME_COST_REVIEW_REQUIRED");
  assert.equal(prime.length, 2);
  const labels = [...html.matchAll(/<span class="rwl-chip-label">([^<]*Prime Cost Review Required[^<]*)<\/span>/g)].map((m) => m[1]);
  assert.equal(labels.length, 2);
  assert.equal(new Set(labels).size, 2, `labels are distinguishable: ${labels}`);
  assert.ok(labels.every((l) => l.includes("·")), `disambiguated: ${labels}`);
  assert.doesNotMatch(html, /<img|<b>x/);
  function pressed(h) { return [...h.matchAll(/data-rwl-select="([^"]+)"[^>]*aria-pressed="true"/g)].map((m) => m[1]); }
});

test("UX-F2 scope note: group composes with drawer filters and search; plain wording; nothing when unfiltered", () => {
  const f = worklist.describeReviewWorklistScope;
  assert.equal(f({}), null);
  assert.equal(f({ selectedLabel: "Prime cost review required" }), "Group: Prime cost review required");
  assert.equal(
    f({ selectedLabel: "Prime cost review required", drawerFilterCount: 2, searchActive: true, shownCount: 4, totalCount: 628 }),
    "Group: Prime cost review required · also 2 drawer filters + search · showing 4 of 628 rows",
  );
  assert.equal(f({ drawerFilterCount: 1 }), "Table narrowed by 1 drawer filter");
});

test("UX-F2 drawer group html: one radio set mirroring the pills; All rows when none; composition note", () => {
  const groups = groupReviewWorklistRows(makeRows());
  const none = worklist.renderReviewWorklistDrawerGroupHtml(groups, { selectedKey: null });
  assert.equal([...none.matchAll(/type="radio"/g)].length, 5);
  assert.match(none, /value="" checked/);
  assert.doesNotMatch(none, /value="[^"]+" checked/);
  const sel = worklist.renderReviewWorklistDrawerGroupHtml(groups, { selectedKey: KEY_PRIME });
  assert.deepEqual([...sel.matchAll(/value="([^"]*)" checked/g)].map((m) => m[1]), [KEY_PRIME]);
  assert.match(sel, /role="radiogroup" aria-label="Review group"/);
  assert.match(sel, /Combines \(AND\) with Status, Issue, Source and search/);
  assert.equal(worklist.renderReviewWorklistDrawerGroupHtml([], {}), "");
});

test("UX-F2 shell: pill click filters at once; clicking the active pill clears it; no second pipeline", () => {
  const ctx = makeSandbox({ source: read(SHELL), worklistOn: true });
  const rows = makeRows();
  load(ctx, rows);
  assert.equal(ctx.VIEW.length, rows.length);
  ctx.workbenchSummary.button("rwl-select", KEY_PRIME).click();
  assert.equal(ctx.VIEW.length, 110);
  assert.equal(ctx.CURRENT_PAGE, 1);
  assert.deepEqual(pressedKeys(ctx), [KEY_PRIME]);
  // Clicking another pill replaces the selection (single canonical group).
  ctx.workbenchSummary.button("rwl-select", KEY_BLOCK).click();
  assert.equal(ctx.VIEW.length, 1);
  assert.deepEqual(pressedKeys(ctx), [KEY_BLOCK]);
  // Active pill again clears.
  ctx.workbenchSummary.button("rwl-select", KEY_BLOCK).click();
  assert.equal(ctx.VIEW.length, rows.length);
  assert.deepEqual(pressedKeys(ctx), []);
  // Same pipeline: the shell has no extra filter function, and pills change only REVIEW_WORKLIST_GROUP.
  const src = read(SHELL);
  assert.equal((src.match(/filterReviewWorklistRows\(/g) || []).length, 1, "single filter call site (applySearch)");
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.ACTIVE_FILTERS)), { status: [], issue: [], source: [] });
});

test("UX-F2 shell: drawer and pills show the same selection (both directions) and never map a precise group to a broad status", () => {
  const ctx = makeSandbox({ source: read(SHELL), worklistOn: true });
  const drawer = withDrawer(ctx);
  const rows = makeRows();
  load(ctx, rows);
  assert.ok(drawer.section, "drawer section created with the panel");
  assert.equal(drawer.checked(), "");
  // Pill -> drawer.
  ctx.workbenchSummary.button("rwl-select", KEY_MATREV).click();
  assert.equal(drawer.checked(), KEY_MATREV);
  assert.equal(ctx.VIEW.length, 2);
  // Drawer -> pill.
  drawer.pick(KEY_PRIME);
  assert.equal(ctx.VIEW.length, 110);
  assert.deepEqual(pressedKeys(ctx), [KEY_PRIME]);
  assert.equal(drawer.checked(), KEY_PRIME);
  // The precise 110-SKU group is NOT the broad REVIEW_REQUIRED status (113 rows): drawer Status stays untouched.
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.ACTIVE_FILTERS.status)), []);
  ctx.ACTIVE_FILTERS.status = ["REVIEW_REQUIRED"];
  drawer.pick("");
  assert.equal(ctx.VIEW.length, 113, "broad status choice alone = 113 review rows");
  assert.deepEqual(pressedKeys(ctx), []);
  assert.equal(drawer.checked(), "");
  // Drawer "All rows" with nothing else active restores every row.
  ctx.ACTIVE_FILTERS.status = [];
  drawer.pick(KEY_BLOCK);
  drawer.pick("");
  assert.equal(ctx.VIEW.length, rows.length);
});

test("UX-F2 shell: group, drawer Status/Issue/Source and search compose (AND) and the combination is shown", () => {
  const ctx = makeSandbox({ source: read(SHELL), worklistOn: true });
  withDrawer(ctx);
  load(ctx, makeRows());
  ctx.workbenchSummary.button("rwl-select", KEY_PRIME).click();
  assert.doesNotMatch(ctx.workbenchSummary.innerHTML, /also \d+ drawer/);
  assert.match(ctx.workbenchSummary.innerHTML, /data-rwl-scope="1">Group: [^<]+ · showing 110 of 139 rows</);
  // Conflicting broad status (BLOCKER) with the REVIEW group -> no rows, and the note says why.
  ctx.ACTIVE_FILTERS.status = ["BLOCKER"];
  run(ctx, "applyFilters()");
  assert.equal(ctx.VIEW.length, 0);
  assert.match(ctx.workbenchSummary.innerHTML, /also 1 drawer filter · showing 0 of 139 rows/);
  ctx.ACTIVE_FILTERS.status = ["REVIEW_REQUIRED"];
  ctx.searchBox.value = "zzz-no-match";
  run(ctx, "applyFilters()");
  assert.equal(ctx.VIEW.length, 0);
  assert.match(ctx.workbenchSummary.innerHTML, /also 1 drawer filter \+ search/);
  ctx.searchBox.value = "";
  run(ctx, "applyFilters()");
  assert.equal(ctx.VIEW.length, 110);
  // Without a group the note still appears when other filters narrow the table.
  ctx.workbenchSummary.button("rwl-select", KEY_PRIME).click(); // active chip again clears the group
  assert.match(ctx.workbenchSummary.innerHTML, /Table narrowed by 1 drawer filter/);
  assert.equal(ctx.VIEW.length, 113);
});

test("UX-F2 shell: drawer Clear resets the group too; the filter badge counts it", () => {
  const ctx = makeSandbox({ source: read(SHELL), worklistOn: true });
  const drawer = withDrawer(ctx);
  load(ctx, makeRows());
  drawer.pick(KEY_BLOCK);
  assert.equal(ctx.VIEW.length, 1);
  // Reproduces the drawer Clear handler's two statements for the group (gated one-liner, then re-apply).
  run(ctx, "ACTIVE_FILTERS = { status: [], issue: [], source: [] }; clearReviewWorklistGroup(); applyFilters();");
  assert.equal(ctx.VIEW.length, 139);
  assert.equal(drawer.checked(), "");
  const src = read(SHELL);
  const clearHandler = src.slice(src.indexOf('$("peqFilterClear")?.addEventListener("click"'));
  assert.ok(clearHandler.indexOf("clearReviewWorklistGroup();") > 0 && clearHandler.indexOf("clearReviewWorklistGroup();") < clearHandler.indexOf("applyFilters();"));
  assert.match(src, /if \(reviewWorklistSelectedKey\(\)\) count \+= 1;/);
});

test("UX-F2 shell: reload, run switch and lens change invalidate the group in both controls", () => {
  const ctx = makeSandbox({ source: read(SHELL), worklistOn: true });
  const drawer = withDrawer(ctx);
  load(ctx, makeRows());
  drawer.pick(KEY_PRIME);
  assert.equal(ctx.VIEW.length, 110);
  // A reload / different run / different period assigns a new ALL_ROWS array: the selection is dropped.
  const other = makeRows().filter((r) => r.first_control_status !== "MATERIAL_REVIEW_REQUIRED");
  load(ctx, other);
  assert.equal(ctx.VIEW.length, other.length);
  assert.deepEqual(pressedKeys(ctx), []);
  assert.equal(drawer.checked(), "");
  assert.ok(!drawer.section.innerHTML.includes(KEY_MATREV), "group that no longer exists is not offered");
  // A group key that does not exist in the loaded rows cannot be selected.
  run(ctx, `setReviewWorklistGroup("REVIEW_REQUIRED|NOT_A_GROUP|X")`);
  assert.equal(ctx.VIEW.length, other.length, "an unknown key is ignored, not an invisible filter");
  assert.deepEqual(pressedKeys(ctx), []);
  // Leaving the lens removes the drawer section; the group is ignored on other lenses.
  ctx.CURRENT_LENS = "dashboard";
  run(ctx, "removeInactiveReviewWorklistDrawerGroup()");
  assert.equal(drawer.section, null);
  run(ctx, `setReviewWorklistGroup("${KEY_BLOCK}")`);
  assert.equal(run(ctx, "reviewWorklistSelectedKey()"), null);
});

test("UX-F2 shell: flag OFF creates no drawer section and ignores group changes", () => {
  const ctx = makeSandbox({ source: read(SHELL), worklistOn: false });
  const drawer = withDrawer(ctx);
  load(ctx, makeRows());
  assert.equal(drawer.section, null);
  run(ctx, `setReviewWorklistGroup("${KEY_BLOCK}")`);
  assert.equal(ctx.REVIEW_WORKLIST_GROUP, null);
  assert.equal(ctx.VIEW.length, 139);
  assert.equal(ctx.workbenchSummary.innerHTML, "");
});

test("UX-F2 CSS: appended compact block only; chips wrap in one row; focus-visible; touch size and no unbounded mobile header", () => {
  const css = read("public/shared/css/sasv-costing.css");
  const block = css.slice(css.indexOf("UX-F2: compact review worklist"));
  assert.ok(block.length > 200);
  assert.match(block, /\.rwl-chips \{ display: flex; flex-wrap: wrap;/);
  assert.match(block, /\.rwl-chip:focus-visible \{ outline: 2px solid/);
  assert.match(block, /\.rwl-chip\[aria-pressed="true"\]/);
  assert.match(block, /@media \(max-width: 520px\) \{[\s\S]*\.rwl-chip \{ min-height: 40px; \}[\s\S]*max-height: 40vh/);
  for (const sel of block.split("\n").map((l) => l.match(/^\s*(\.rwl-[^{]+)\{/)?.[1]).filter(Boolean)) assert.match(sel.trim(), /^\.rwl-/);
  assert.doesNotMatch(block, /\.ccc-(?!rc)|!important/);
});

// ===========================================================================
// UX-F3: toolbar de-duplication + solid secondary KPI filter chips
// ===========================================================================
function f3Html(kind, { rows = makeRows(), status = { displayed_run_id: 143, approved_run_id: 143, newer_draft_run_id: 148, display_state: "APPROVED" }, selectedRunId = null } = {}) {
  const groups = groupReviewWorklistRows(rows);
  const d = kind === "raw" ? null : { ...worklist.describeReviewWorklistRunContext({ rows, periodStart: "2026-10-01", runStatus: { status: "ready", row: status }, selectedRunId, runPickerAvailable: true }), ...(kind && kind !== "auto" ? { kind } : {}) };
  return renderReviewWorklistHtml(groups, {
    runContext: reviewWorklistRunContext(rows), runDiagnosis: d, rowCount: rows.length,
    runPicker: { choices: worklist.reviewWorklistRunChoices(status), selectedRunId },
  });
}
const outsideInfo = (h) => h.replace(/<details[\s\S]*?<\/details>/, "");

test("UX-F3 toolbar: run picker kept; approved run repeats no badge, date or run line; draft shows no badge but the picker says Draft — not for pricing", () => {
  const approved = f3Html("approved", { rows: makeRows().map((r) => ({ ...r, refresh_run_id: 143 })), selectedRunId: "143" });
  const vis = outsideInfo(approved);
  assert.match(vis, /<select id="rwlRunSelect"/);
  assert.doesNotMatch(vis, /data-rwl-pill|Run shown|valuation|Approved run|Draft run \d/);
  assert.doesNotMatch(approved, /rwl-info-warn|rwl-drawer-note/);
  const draft = outsideInfo(f3Html("selected-not-approved", { selectedRunId: "148" }));
  assert.match(draft, /<select id="rwlRunSelect"/);
  // UX-F5: no toolbar badge; the picker option carries the full draft wording.
  assert.doesNotMatch(draft, /data-rwl-pill|Draft · not for pricing|rwl-pill-draft/);
  assert.match(draft, /<option value="148" selected>Run 148 — Draft — not for pricing<\/option>/);
  assert.match(draft, />Drawer: run 143<\/span>/);
  assert.doesNotMatch(draft, /Run shown|valuation|Draft run 148|class="rwl-alert/);
  // Exactly one toolbar and one chip row.
  assert.equal((draft.match(/class="rwl-toolbar"/g) || []).length, 1);
  assert.equal((draft.match(/class="rwl-chips"/g) || []).length, 1);
});

test("UX-F3 operational problems stay visible outside the disclosure; provenance prose moves inside it", () => {
  for (const [kind, re] of [
    ["status-error", /role="alert">Run status could not be read/],
    ["mismatch", /role="alert">Rows are from run/],
    ["mixed", /role="alert">Rows from several runs/],
    ["status-missing", /role="note">No run status for this period/],
  ]) {
    const h = f3Html(kind);
    assert.match(outsideInfo(h), re, kind);
    assert.match(h, /rwl-info rwl-info-warn/, `${kind}: info control flagged`);
  }
  const draft = f3Html("selected-not-approved", { selectedRunId: "148" });
  const info = draft.match(/<details[\s\S]*?<\/details>/)[0];
  assert.match(info, /Row drawer evidence is not this run's evidence\./);
  assert.match(info, /Run shown: 148 · valuation 2026-10-31/);
  assert.doesNotMatch(outsideInfo(draft), /Row drawer evidence is not|pinned to the displayed/);
});

const f4Css = () => {
  const css = read("public/shared/css/sasv-costing.css");
  return css.slice(css.indexOf("UX-F4: restrained worklist"));
};
const cssRule = (block, sel) => block.match(new RegExp(`(?:^|\\n)${sel.replace(/[.\[\]"=()*+?^$|\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] || "";
const hexLum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const hexContrast = (a, b) => { const [x, y] = [hexLum(a), hexLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hexOf = (rule, prop) => (rule.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*(#[0-9a-f]{6})`, "i")) || [])[1];

test("UX-F4 chips: muted tinted fills with dark severity text (WCAG AA), distinct pressed and focus states", () => {
  const f4 = f4Css();
  const blocker = cssRule(f4, ".rwl-chip.rwl-sev-blocker");
  const review = cssRule(f4, ".rwl-chip.rwl-sev-review");
  const blockerOn = cssRule(f4, '.rwl-chip.rwl-sev-blocker[aria-pressed="true"]');
  const reviewOn = cssRule(f4, '.rwl-chip.rwl-sev-review[aria-pressed="true"]');
  for (const [name, r] of Object.entries({ blocker, review, blockerOn, reviewOn })) {
    const bg = hexOf(r, "background"), fg = hexOf(r, "color");
    assert.ok(bg && fg, name);
    assert.ok(hexLum(bg) > 0.7, `${name}: tinted (light) fill, not saturated: ${bg}`);
    assert.ok(hexContrast(bg, fg) >= 7, `${name}: label contrast ${hexContrast(bg, fg).toFixed(1)}`);
    assert.ok(hexContrast(bg, "#ffffff") < 1.5, `${name}: no solid saturated block`);
  }
  assert.notEqual(hexOf(blocker, "background"), hexOf(review, "background"), "severity-specific tints");
  assert.notEqual(hexOf(blocker, "color"), hexOf(review, "color"));
  assert.notEqual(hexOf(blocker, "background"), hexOf(blockerOn, "background"), "pressed differs from rest");
  assert.notEqual(hexOf(review, "background"), hexOf(reviewOn, "background"));
  // Pressed: not colour alone (inset ring + stronger border + check mark text); badge keeps readable colour.
  assert.match(cssRule(f4, '.rwl-chip[aria-pressed="true"], .rwl-chip.rwl-selected'), /box-shadow: inset 0 0 0 1px currentColor/);
  assert.ok(hexContrast(hexOf(blockerOn, "border-color"), "#ffffff") >= 4.5, "pressed border is a strong severity colour");
  assert.match(f4, /\.rwl-chip\[aria-pressed="true"\] \.rwl-chip-label::before \{ content: "\\2713/);
  assert.match(cssRule(f4, ".rwl-chip .rwl-count"), /color: inherit/);
  // Keyboard focus: its own visible outline, different from the pressed ring, never removed.
  const focus = cssRule(f4, ".rwl-chip:focus-visible");
  assert.match(focus, /outline: 2px solid/);
  assert.match(focus, /outline-offset: 2px/);
  assert.doesNotMatch(f4, /outline: (?:none|0)[^;]*;[^}]*\.rwl-chip|\.rwl-chip[^{]*\{[^}]*outline: (?:none|0)\b/);
  assert.doesNotMatch(f4, /!important|\.ccc-kpi|\.kpi/);
});

test("UX-F4 layout: chips are flexible equal columns across the width; toolbar end is pinned right; responsive breakpoints", () => {
  const f4 = f4Css();
  const chips = cssRule(f4, ".rwl-chips");
  assert.match(chips, /display: grid/);
  assert.match(chips, /grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 190px\), 1fr\)\)/, "equal flexible columns that collapse");
  assert.doesNotMatch(chips, /flex-wrap|justify-content: flex-start/);
  const chip = cssRule(f4, ".rwl-chip");
  assert.match(chip, /width: 100%/);
  assert.match(chip, /min-width: 0/);
  assert.match(cssRule(f4, ".rwl-end"), /margin-left: auto/);
  assert.match(cssRule(f4, ".rwl-compact .rwl-toolbar"), /display: flex; flex-wrap: wrap/);
  // Tablet: the end group takes its own full-width row, right-aligned; phone: narrower columns and 40px targets.
  assert.match(f4, /@media \(max-width: 900px\) \{\s*\.rwl-end \{ flex: 1 1 100%; justify-content: flex-end; margin-left: 0; \}\s*\.rwl-chips \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/); // tablet: balanced 2 x 2
  assert.match(f4, /@media \(max-width: 520px\) \{[\s\S]*minmax\(min\(100%, 150px\), 1fr\)[\s\S]*\.rwl-chip \{ min-height: 40px; \}[\s\S]*\.rwl-run-picker select \{ min-height: 40px; \}/);
  // The disclosure panel opens leftwards from the right edge so it cannot overflow the viewport.
  assert.match(cssRule(f4, ".rwl-info-body"), /right: 0/);
});

test("UX-F4/F5 run selector: SASV tokens, visibly tinted fill, chevron, soft focus ring, disabled state, native select", () => {
  const f4 = f4Css();
  const sel = cssRule(f4, ".rwl-run-picker select");
  for (const token of ["--sasv-control-md", "--sasv-radius-sm", "--sasv-text-sm", "--sasv-primary-100", "--sasv-primary-300"]) assert.ok(sel.includes(token), token);
  const focus = f4.match(/\.rwl-run-picker select:focus, \.rwl-run-picker select:focus-visible \{([^}]*)\}/)?.[1] || "";
  assert.match(focus, /--sasv-control-border-focus/);
  assert.match(focus, /box-shadow: 0 0 0 3px var\(--sasv-focus-ring/);
  // UX-F5: visibly tinted (not white) surface from the SASV primary tokens, custom chevron, disabled state.
  const bgc = sel.match(/background-color:\s*var\(--sasv-primary-100, (#[0-9a-f]{6})\)/i)?.[1];
  assert.ok(bgc, "tinted fill from --sasv-primary-100");
  assert.ok(hexContrast(bgc, "#ffffff") >= 1.15, `fill is visibly not white (${hexContrast(bgc, "#ffffff").toFixed(2)}:1)`);
  assert.ok(hexContrast(bgc, "#1f2937") >= 7, "dark text on the tint");
  assert.match(sel, /background-image: url\("data:image\/svg\+xml/, "chevron");
  assert.match(sel, /background-position: right 10px center/);
  assert.match(sel, /padding: 0 30px 0 10px/, "room for the chevron");
  assert.match(f4, /\.rwl-run-picker select:hover \{ background-color: var\(--sasv-primary-200/);
  const dis = f4.match(/\.rwl-run-picker select:disabled \{([^}]*)\}/)?.[1] || "";
  assert.match(dis, /cursor: not-allowed/);
  assert.match(dis, /--sasv-control-border/);
  assert.match(dis, /background-color: var\(--sasv-neutral-100/);
  assert.doesNotMatch(f4, /\.rwl-run-picker select[^{]*\{[^}]*(?:display: none|pointer-events: none)/);
  assert.match(read("public/shared/js/costing-review-worklist.js"), /<select id="rwlRunSelect" data-rwl-run-select="1" aria-describedby="rwlRunSelectHelp"/, "native <select> kept");
  // Same tokens as the established Costing controls.
  const css = read("public/shared/css/sasv-costing.css");
  assert.match(css, /body\.sasv-costing #costingPeriodSelect,[\s\S]*?border: 1px solid var\(--sasv-control-border\)/);
});

test("UX-F4 markup: end group (drawer note, info) is one right-aligned unit after the picker; at most two rows when unfiltered", () => {
  const draft = f3Html("selected-not-approved", { selectedRunId: "148" });
  const toolbar = draft.match(/<div class="rwl-toolbar">([\s\S]*?)<\/div>\n<div class="rwl-chips"|<div class="rwl-toolbar">([\s\S]*?)\n<\/div>/)[0];
  assert.ok(toolbar.indexOf("rwl-run-picker") < toolbar.indexOf('class="rwl-end"'), "picker first, end group last");
  const end = draft.match(/<div class="rwl-end">([\s\S]*?)<\/details>\s*<\/div>/)[1];
  assert.ok(end.indexOf("rwl-drawer-note") < end.indexOf("<details"), "note then info disclosure");
  assert.doesNotMatch(draft, /rwl-groups|rwl-card/);
  // Rows: toolbar + chip row only (no alert/scope row without errors or extra filters).
  const rowsOf = (h) => ["rwl-toolbar", "rwl-chips", "rwl-alert", "rwl-scope"].filter((c) => h.includes(`class="${c}`));
  assert.deepEqual(rowsOf(draft), ["rwl-toolbar", "rwl-chips"]);
  // Clear group lives in the end group, not in the chip grid (keeps four equal columns).
  const rows = makeRows();
  const sel = renderReviewWorklistHtml(groupReviewWorklistRows(rows), { selectedKey: KEY_PRIME, runContext: reviewWorklistRunContext(rows) });
  assert.doesNotMatch(sel, /rwl-clear|Clear group/, "no redundant Clear group button; the active chip toggles and the drawer clears");
  assert.match(sel, /aria-pressed="true"/);
  assert.equal((sel.match(/class="rwl-chip /g) || []).length, 4);
});
