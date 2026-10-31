// CW-05 package 2: table tools for scheme comparison, control centre
// (workbench, sku-control-status), driver governance, plus cost-sheet sort keys
// and the scoped sort-button CSS. node:test only, no deps, no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as tools from "../../public/shared/js/costing-table-tools.js";
import { DRIVER_GOVERNANCE_TABLE_HEADERS } from "../../public/shared/js/costing-suite-driver-governance-helpers.js";

const {
  COLUMN_HELP,
  GENERIC_TABLE_COLUMNS,
  categorySortText,
  csvCell,
  groupSortText,
  isSortableColumn,
  productSkuSortText,
  productSortText,
  sortRowsBy,
  stockItemSortText,
  tableColumnsFor,
  withAccessors,
} = tools;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const PKG2_BASE = "814342657804dd6770dcb8c91ec319555f19a711";
const readBase = (rel) =>
  execFileSync("git", ["show", `${PKG2_BASE}:${rel}`], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
const SHELL = "public/shared/js/costing-suite-shell.js";
const TOOLS = "public/shared/js/costing-table-tools.js";
const CSS = "public/shared/css/sasv-costing.css";
const JS = "public/shared/js";

// ---- Real header constants, read from the controller sources ----
const evalLiteral = (src, name, open) => {
  const re =
    open === "["
      ? new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\]);`)
      : new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`);
  const m = src.match(re);
  assert.ok(m, `${name} found`);
  return JSON.parse(JSON.stringify(vm.runInNewContext(`(${m[1]})`)));
};
const schemeSrc = read(`${JS}/costing-suite-scheme-comparison.js`);
const ccSrc = read(`${JS}/costing-suite-control-center.js`);
const sheetSrc = read(`${JS}/costing-suite-cost-sheet.js`);
const REAL = {
  scheme: {
    headers: evalLiteral(schemeSrc, "SCHEME_COMPARISON_HEADERS", "["),
    alignments: evalLiteral(schemeSrc, "SCHEME_COMPARISON_ALIGNMENTS", "["),
  },
  cc: {
    headers: evalLiteral(ccSrc, "HEADERS_BY_LENS", "{"),
    alignments: evalLiteral(ccSrc, "ALIGNMENTS_BY_LENS", "{"),
  },
  sheet: {
    headers: evalLiteral(sheetSrc, "TABLE_HEADERS", "{"),
    alignments: evalLiteral(sheetSrc, "TABLE_ALIGNMENTS", "{"),
  },
  driver: {
    headers: [...DRIVER_GOVERNANCE_TABLE_HEADERS],
    alignments: DRIVER_GOVERNANCE_TABLE_HEADERS.map(() => "c-left"),
  },
};

// Lens ids accepted by the shell's is*Lens predicates (verified in the sources).
const SCHEME_LENS = "scheme-comparison";
const CC_LENSES = ["dashboard", "costing-review-workbench", "sku-control-status"];
const DRIVER_LENS = "driver-governance";
const SHEET_LENSES = ["sku-cost-sheet", "printable-cost-sheet", "cost-comparison"];
const IN_LENSES = [
  SCHEME_LENS,
  "costing-review-workbench",
  "sku-control-status",
  DRIVER_LENS,
  "sku-cost-sheet",
  "printable-cost-sheet",
];
const EXPECTED_BUTTONS = {
  [SCHEME_LENS]: 9,
  "costing-review-workbench": 11,
  "sku-control-status": 4,
  [DRIVER_LENS]: 11,
  "sku-cost-sheet": 8,
  "printable-cost-sheet": 6,
  dashboard: 0,
};

// ---- Sandbox harness (same approach as table-tools.test.mjs) ----
function extractFn(src, name) {
  let start = src.indexOf(`\nfunction ${name}(`);
  const asyncStart = src.indexOf(`\nasync function ${name}(`);
  if (start < 0 || (asyncStart >= 0 && asyncStart < start)) start = asyncStart;
  assert.ok(start >= 0, `function ${name} found`);
  const end = src.indexOf("\n}\n", start);
  return src.slice(start + 1, end + 2);
}

function makeTableHead() {
  return {
    _html: "",
    buttons: [],
    set innerHTML(v) {
      this._html = v;
      this.buttons = [...v.matchAll(/data-cw05-sort="(\d+)"/g)].map((m) => ({
        dataset: { cw05Sort: m[1] },
        handlers: [],
        addEventListener(type, fn) {
          if (type === "click") this.handlers.push(fn);
        },
        click() {
          this.handlers.forEach((fn) => fn());
        },
      }));
    },
    get innerHTML() {
      return this._html;
    },
    querySelectorAll(sel) {
      return sel === "button[data-cw05-sort]" ? this.buttons : [];
    },
  };
}

function makeSandbox({ source, flagOn, withCw05 }) {
  const no = () => false;
  const ctx = {
    ...tools,
    tableHead: makeTableHead(),
    CURRENT_LENS: "",
    VIEW: [],
    CURRENT_PAGE: 4,
    CW05_SORT_CTX: null,
    renderTableCalls: 0,
    csvOut: [],
    ACTIVE_PERIOD_START: "2026-09-01",
    showToast: () => {},
    Blob: class {
      constructor(parts) {
        ctx.csvOut.push(parts.join(""));
      }
    },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
    document: {
      createElement: () => ({ click() {}, remove() {} }),
      body: { appendChild() {} },
    },
    isCostingTableToolsV1Enabled: () => flagOn,
    isDriverGovernanceLens: (l) => l === DRIVER_LENS,
    isCostBuildLens: no,
    isMaterialCostLens: no,
    isSchemeComparisonLens: (l) => l === SCHEME_LENS,
    isCostSheetLens: (l) => SHEET_LENSES.includes(l),
    isPricingPolicyLens: no,
    isControlCenterLens: (l) => CC_LENSES.includes(l),
    isMaterialCostTraceLensActive: no,
    driverGovernanceCtrl: {
      getTableHeaders: () => [...REAL.driver.headers],
      getTableAlignments: () => [...REAL.driver.alignments],
    },
    schemeComparisonCtrl: {
      getTableHeaders: () => REAL.scheme.headers,
      getTableAlignments: () => REAL.scheme.alignments,
    },
    controlCenterCtrl: {
      getTableHeaders: (l) => REAL.cc.headers[l] || null,
      getTableAlignments: (l) => REAL.cc.alignments[l] || null,
    },
    costSheetCtrl: {
      getTableHeaders: (l) => REAL.sheet.headers[l] || null,
      getTableAlignments: (l) => REAL.sheet.alignments[l] || null,
    },
  };
  vm.createContext(ctx);
  const names = [
    "escapeHtml",
    "text",
    "getRowStatus",
    "renderTableHeaderForLens",
    "exportActiveViewCsv",
    "exportCsvForRows",
  ];
  if (withCw05) names.push("renderCw05GenericTableHeader", "exportCw05CsvForView");
  vm.runInContext(
    [...names.map((n) => extractFn(source, n)), "function renderTable() { renderTableCalls += 1; }"].join("\n"),
    ctx,
  );
  return ctx;
}

function headerHtml(ctx, lens) {
  ctx.CURRENT_LENS = lens;
  vm.runInContext("renderTableHeaderForLens()", ctx);
  return ctx.tableHead.innerHTML;
}

function exportCsv(ctx, lens, view) {
  ctx.CURRENT_LENS = lens;
  ctx.VIEW = view;
  ctx.csvOut.length = 0;
  vm.runInContext("exportActiveViewCsv()", ctx);
  assert.equal(ctx.csvOut.length, 1, lens);
  return ctx.csvOut[0];
}

// Representative fixture rows (every field each lens renders, plus extras).
const FIXTURES = {
  [SCHEME_LENS]: [
    { period_start: "2026-09-01", product_id: 3, product_name: "Gamma", sku_id: 30, sku_display_name: "G 1kg", scheme_name: "=Promo", ik_net_sales_realisation: 120.5, ik_margin_percent_after_scheme: 12, ik_scheme_margin_band: "GREEN", ok_net_sales_realisation: 130, ok_margin_percent_after_scheme: -3.5, ok_scheme_margin_band: "RED", scheme_viability_status: "VIABLE" },
    { period_start: "2026-09-01", product_id: 1, product_name: "Alpha", sku_id: 10, sku_display_name: "A 10s", scheme_name: "Base", ik_net_sales_realisation: 80, ik_margin_percent_after_scheme: 30, ik_scheme_margin_band: "-AMBER", ok_net_sales_realisation: null, ok_margin_percent_after_scheme: 5, ok_scheme_margin_band: "GREEN", scheme_viability_status: "REVIEW" },
    { period_start: "2026-09-01", product_id: 2, product_name: null, sku_id: 20, sku_display_name: null, sku_column_label: "B 50g", scheme_name: "@Flat", ik_net_sales_realisation: 100, ik_margin_percent_after_scheme: 20, ik_scheme_margin_band: "AMBER", ok_net_sales_realisation: 90, ok_margin_percent_after_scheme: "--", ok_scheme_margin_band: "", scheme_viability_status: "+NOT_VIABLE" },
  ],
  "costing-review-workbench": [
    { stock_item_id: 501, stock_item_name: "Zinc", stock_item_code: "ZN", material_area: "RM", action_severity: "BLOCKER", recommended_ui_route: "material-cost", affected_line_count: 10, affected_product_count: 2, affected_sku_count: 5, approval_blocking_sku_count: 1, review_sku_count: 4, action_note_summary: "=check", snapshot_refreshed_at: "2026-10-02T05:00:00+00:00" },
    { stock_item_id: 502, stock_item_name: null, stock_item_code: "PK", material_area: "PM", action_severity: "WARN", recommended_ui_route: "-route", affected_line_count: 9, affected_product_count: 7, affected_sku_count: 3, approval_blocking_sku_count: 0, review_sku_count: 3, action_note_summary: "note, with comma", snapshot_refreshed_at: "2026-09-30T23:00:00+00:00" },
    { stock_item_id: 503, stock_item_name: "Amla", stock_item_code: "AM", material_area: "RM", action_severity: "INFO", recommended_ui_route: "cost-build", affected_line_count: 100, affected_product_count: 1, affected_sku_count: 1, approval_blocking_sku_count: 2, review_sku_count: null, action_note_summary: 'say "hi"', snapshot_refreshed_at: null },
  ],
  "sku-control-status": [
    { product_id: 2, product_name: "Beta", sku_id: 21, pack_size: 100, control_severity: "WARN", first_control_status: "COST_MISSING", overall_control_status: "BLOCKED", recommended_ui_route: "material-cost" },
    { product_id: 1, product_name: "@Alpha", sku_id: 11, pack_size: 10, control_severity: "BLOCKER", first_control_status: "=POLICY", overall_control_status: "BLOCKED", recommended_ui_route: "pricing-policy" },
    { product_id: 3, product_name: "", sku_id: 31, pack_size: null, control_severity: "OK", first_control_status: null, overall_control_status: "OK", recommended_ui_route: "" },
  ],
  [DRIVER_LENS]: [
    { cost_element_code: "C2", cost_element_label: "Power", driver_domain: "UTIL", formula_type: "RATE", lifecycle_status: "ACTIVE", validation_status: "PASS", effective_from: "2026-04-01", maturity_status: "M2", client_status: "OK", data_quality_status: "GOOD", cutover_status: "DONE", owner_module: "cost-build" },
    { cost_element_code: "C1", cost_element_label: "=Labour", driver_domain: "HR", formula_type: "-PER_HOUR", lifecycle_status: "DRAFT", validation_status: null, effective_from: "2025-12-01", maturity_status: "M1", client_status: "WARN", data_quality_status: "POOR", cutover_status: "PENDING", owner_module: "@hr" },
    { cost_element_code: "C3", cost_element_label: "Freight", driver_domain: "LOG", formula_type: "FLAT", lifecycle_status: "ACTIVE", validation_status: "FAIL", effective_from: null, maturity_status: "M3", client_status: "OK", data_quality_status: "GOOD", cutover_status: "DONE", owner_module: "logistics" },
  ],
  "sku-cost-sheet": [
    { product_id: 11, product_name: "Alpha Tablet", sku_id: 101, sku_display_name: "Alpha 10s", mrp_ik: 30, mrp_ok: 32, internal_loaded_cost_per_sku: 12.75, ik_selling_price: 25.5, ok_selling_price: 27, cost_sheet_status: "READY", notes: "=x" },
    { product_id: 12, product_name: "@Beta", sku_id: 102, sku_display_name: null, sku_column_label: "OK 100ml", mrp_ik: 10, mrp_ok: null, internal_loaded_cost_per_sku: -12.5, ik_selling_price: "-12.5", ok_selling_price: 9, action_severity: "BLOCKER", cost_sheet_status: "READY", notes: "plain" },
    { product_id: 13, product_name: null, sku_id: 103, sku_display_name: "Gamma 1kg", mrp_ik: 20, mrp_ok: 22, internal_loaded_cost_per_sku: 8, ik_selling_price: 18, ok_selling_price: 19, cost_sheet_status: "+WARN", notes: "-n" },
  ],
  "printable-cost-sheet": [
    { product_id: 21, product_name: "Zeta Oil", category_name: "Oils", subcategory_name: "Thailam", group_name: "G2", sub_group_name: "SG1", sku_column_labels: "=IK 100ml", product_cost_sheet_status: "READY", refreshed_at: "2026-10-01T05:00:00+00:00" },
    { product_id: 22, product_name: null, category_name: null, subcategory_name: "Powder", group_name: "G1", sub_group_name: null, sku_column_labels: "IK 50g", product_cost_sheet_status: "-PARTIAL", refreshed_at: "2026-09-15T05:00:00+00:00" },
    { product_id: 23, product_name: "Eta", category_name: "Churna", subcategory_name: null, group_name: "", sub_group_name: "", sku_column_labels: "@x", product_cost_sheet_status: "READY", refreshed_at: null },
  ],
};

const stripFormulaGuard = (csv) => csv.replace(/"'([=+\-@\t\r])/g, '"$1');

// 1. Flag OFF identity
test("pkg2 flag OFF: header HTML for every IN lens and dashboard is identical to base", () => {
  const base = makeSandbox({ source: readBase(SHELL), flagOn: false, withCw05: true });
  const head = makeSandbox({ source: read(SHELL), flagOn: false, withCw05: true });
  for (const lens of [...IN_LENSES, "dashboard", "cost-comparison"]) {
    const b = headerHtml(base, lens);
    const h = headerHtml(head, lens);
    assert.ok(b.startsWith("<tr><th"), lens);
    assert.equal(h, b, lens);
    if (lens !== "sku-cost-sheet" && lens !== "printable-cost-sheet") {
      assert.doesNotMatch(h, /data-cw05-sort|aria-sort/, lens);
    }
  }
  for (const lens of [SCHEME_LENS, "costing-review-workbench", "sku-control-status", DRIVER_LENS, "dashboard"]) {
    assert.doesNotMatch(headerHtml(head, lens), /data-cw05-sort|aria-sort|<button/, lens);
  }
});

test("pkg2 flag OFF: legacy templates intact; shell equals base apart from gated CW-05 code", () => {
  const head = read(SHELL);
  const base = readBase(SHELL);
  const legacy = (hv, av) =>
    `      .map((h, i) => {\n${" ".repeat(av === "alignments" ? 8 : 10)}const classes = [${av}[i] || "c-left"];\n${" ".repeat(av === "alignments" ? 8 : 10)}return \`<th class="\${classes.join(" ")}">\${text(h, "")}</th>\`;`;
  for (const [hv, av] of [
    ["headers", "alignments"],
    ["schemeHeaders", "schemeAlignments"],
    ["ccHeaders", "ccAlignments"],
  ]) {
    const opener = `innerHTML = \`<tr>\${${hv}\n`;
    assert.ok(head.includes(opener), `${hv} template opener intact`);
    assert.equal(head.split(opener).length, base.split(opener).length, hv);
  }
  const gates = [
    "    if (isCostingTableToolsV1Enabled()) {\n      renderCw05GenericTableHeader(headers, alignments);\n      return;\n    }\n",
    "      if (isCostingTableToolsV1Enabled()) {\n        renderCw05GenericTableHeader(schemeHeaders, schemeAlignments);\n        return;\n      }\n",
    "      if (isCostingTableToolsV1Enabled()) {\n        renderCw05GenericTableHeader(ccHeaders, ccAlignments);\n        return;\n      }\n",
  ];
  let stripped = head;
  for (const g of gates) {
    assert.equal(stripped.split(g).length, 2, g);
    stripped = stripped.replace(g, "");
  }
  const dropRenderer = (s) =>
    s
      .replace(/\n\/\*\*\n \* CW-05 \(COSTING_TABLE_TOOLS_V1 ON only\): header[\s\S]*?\n}\n(?=\nfunction productSkuLabel)/, "")
      .replace(/import \{[^}]*\} from "\.\/costing-table-tools\.js";\n/, "");
  assert.equal(dropRenderer(stripped), dropRenderer(base));
  // Every renderCw05GenericTableHeader call sits right after a flag check.
  const calls = head.split("\n").filter((l) => l.includes("renderCw05GenericTableHeader(") && !l.includes("function "));
  assert.equal(calls.length, 5);
  for (const line of calls) {
    const idx = head.indexOf(line);
    assert.match(head.slice(idx - 60, idx), /if \(isCostingTableToolsV1Enabled\(\)\) \{\n\s*$/);
  }
  // Legacy branch bodies (map callback) still present for the three branches.
  assert.ok(head.includes(legacy("headers", "alignments")));
});

// 2. Self-check (i): real screens reach the new code, sort VIEW, rows map
test("pkg2 self-check (i): each IN lens renders sort buttons; click sorts VIEW and row index maps to sorted row", () => {
  for (const lens of [...IN_LENSES, "dashboard"]) {
    const head = makeSandbox({ source: read(SHELL), flagOn: true, withCw05: true });
    const rows = (FIXTURES[lens] || [{ period_start: "2026-09-01" }]).slice();
    head.VIEW = rows.slice();
    const html = headerHtml(head, lens);
    assert.equal(head.tableHead.buttons.length, EXPECTED_BUTTONS[lens], lens);
    if (lens === "dashboard") {
      const base = makeSandbox({ source: readBase(SHELL), flagOn: false, withCw05: true });
      assert.equal(html, headerHtml(base, lens));
      continue;
    }
    // Every column whose map entry is sortable got a button, in header order.
    const cols = withAccessors(tableColumnsFor(lens), { row_status: () => "" });
    const sortableIdx = cols.map((c, i) => (isSortableColumn(c) ? String(i) : null)).filter((x) => x !== null);
    assert.deepEqual(head.tableHead.buttons.map((b) => b.dataset.cw05Sort), sortableIdx, lens);
    if (lens !== "sku-cost-sheet") assert.doesNotMatch(html, /lane-col/, lens);

    // Click each sortable column once (asc) and check VIEW + row mapping.
    for (const btn of head.tableHead.buttons.slice()) {
      head.VIEW = rows.slice();
      head.CURRENT_PAGE = 4;
      headerHtml(head, lens);
      const b = head.tableHead.buttons.find((x) => x.dataset.cw05Sort === btn.dataset.cw05Sort);
      b.click();
      assert.equal(head.CURRENT_PAGE, 1, lens);
      const col = vm.runInContext(
        `withAccessors(tableColumnsFor(${JSON.stringify(lens)}), { row_status: getRowStatus })[${b.dataset.cw05Sort}]`,
        head,
      );
      const expected = sortRowsBy(rows, col, "asc");
      assert.deepEqual(head.VIEW.map((r) => rows.indexOf(r)), expected.map((r) => rows.indexOf(r)), `${lens} ${col.label}`);
      assert.match(headerHtml(head, lens), new RegExp(`aria-sort="ascending"[^>]*><button type="button" data-cw05-sort="${b.dataset.cw05Sort}">`), lens);
      const PAGE_SIZE = 2;
      for (const page of [1, 2]) {
        const start = (page - 1) * PAGE_SIZE;
        head.VIEW.slice(start, start + PAGE_SIZE).forEach((row, idx) => {
          const tr = { dataset: { rowIndex: String(start + idx) } };
          assert.equal(head.VIEW[Number(tr.dataset.rowIndex)], row);
        });
      }
    }
    // Filter/search/reload replaces VIEW: sort indicator cleared.
    head.VIEW = rows.slice();
    assert.doesNotMatch(headerHtml(head, lens), /ascending|descending/);
  }
});

// 3. Self-check (ii): CSV content unchanged apart from VIEW order + formula guard
test("pkg2 self-check (ii): flag-ON CSV keeps legacy header/values for every IN lens; order follows sorted VIEW", () => {
  for (const lens of IN_LENSES) {
    const rows = FIXTURES[lens];
    const off = makeSandbox({ source: read(SHELL), flagOn: false, withCw05: true });
    const base = makeSandbox({ source: readBase(SHELL), flagOn: false, withCw05: true });
    const on = makeSandbox({ source: read(SHELL), flagOn: true, withCw05: true });

    const offCsv = exportCsv(off, lens, rows.slice());
    assert.equal(offCsv, exportCsv(base, lens, rows.slice()), `${lens} flag OFF identical to base`);
    const header = offCsv.split("\n")[0];
    const unionKeys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    assert.deepEqual(header.split(",").map((h) => JSON.parse(h)), unionKeys, `${lens} legacy header = all row keys`);

    on.VIEW = rows.slice();
    headerHtml(on, lens);
    // Sort ascending on the first sortable column.
    on.tableHead.buttons[0].click();
    const sortedView = on.VIEW;
    assert.notDeepEqual(sortedView.map((r) => rows.indexOf(r)), rows.map((_, i) => i), `${lens} VIEW reordered`);
    const onCsv = exportCsv(on, lens, sortedView);
    const legacyOfSorted = exportCsv(
      makeSandbox({ source: readBase(SHELL), flagOn: false, withCw05: true }),
      lens,
      sortedView,
    );
    // Header = legacy derivation over the same (sorted) rows; same column set as unsorted.
    const onHeader = onCsv.split("\n")[0];
    assert.equal(onHeader, legacyOfSorted.split("\n")[0], `${lens} header equals legacy for the same rows`);
    assert.deepEqual(
      onHeader.split(",").map((h) => JSON.parse(h)).sort(),
      header.split(",").map((h) => JSON.parse(h)).sort(),
      `${lens} same columns, none dropped`,
    );
    // With uniform row keys (server view rows) the header is byte-identical to the unsorted export.
    const uniform = rows.map((r) => Object.fromEntries(unionKeys.map((k) => [k, r[k] ?? null])));
    const uniformOff = exportCsv(makeSandbox({ source: read(SHELL), flagOn: false, withCw05: true }), lens, uniform);
    const uniformOn = makeSandbox({ source: read(SHELL), flagOn: true, withCw05: true });
    uniformOn.VIEW = uniform.slice();
    headerHtml(uniformOn, lens);
    uniformOn.tableHead.buttons[0].click();
    assert.equal(exportCsv(uniformOn, lens, uniformOn.VIEW).split("\n")[0], uniformOff.split("\n")[0], lens);
    assert.equal(stripFormulaGuard(onCsv), legacyOfSorted, `${lens} values equal legacy except formula guard`);
    const keys = onHeader.split(",").map((h) => JSON.parse(h));
    assert.equal(
      onCsv,
      [onHeader, ...sortedView.map((r) => keys.map((k) => csvCell(r[k])).join(","))].join("\n"),
      lens,
    );
    assert.ok(/"'[=+\-@]/.test(onCsv), `${lens} fixture exercises the formula guard`);
    assert.ok(!/"'[=+\-@]/.test(offCsv), `${lens} OFF has no guard`);
  }
  // Numbers are never prefixed.
  const on = makeSandbox({ source: read(SHELL), flagOn: true, withCw05: true });
  const csv = exportCsv(on, SCHEME_LENS, [{ a: -3.5, b: "-3.5" }]);
  assert.equal(csv, `"a","b"\n"-3.5","'-3.5"`);
});

// 4. Labels equal the source header arrays
test("pkg2 column map labels equal the source header arrays element by element", () => {
  const pairs = [
    [SCHEME_LENS, REAL.scheme.headers],
    ["costing-review-workbench", REAL.cc.headers["costing-review-workbench"]],
    ["sku-control-status", REAL.cc.headers["sku-control-status"]],
    [DRIVER_LENS, REAL.driver.headers],
    ["sku-cost-sheet", REAL.sheet.headers["sku-cost-sheet"]],
    ["printable-cost-sheet", REAL.sheet.headers["printable-cost-sheet"]],
  ];
  for (const [lens, headers] of pairs) {
    const cols = tableColumnsFor(lens);
    assert.ok(Object.isFrozen(cols), lens);
    assert.equal(cols.length, headers.length, lens);
    headers.forEach((h, i) => assert.equal(cols[i].label, h, `${lens}[${i}]`));
    const keys = cols.filter((c) => c.key).map((c) => c.key);
    assert.equal(new Set(keys).size, keys.length, `${lens} keys unique`);
  }
  assert.equal(tableColumnsFor("dashboard"), null);
  // SKU and Pack (controller-internal formatters) stay unsortable.
  const scs = tableColumnsFor("sku-control-status");
  assert.equal(isSortableColumn(scs[1]), false);
  assert.equal(isSortableColumn(scs[2]), false);
  // cost-comparison unchanged: all unsortable.
  assert.ok(tableColumnsFor("cost-comparison").every((c) => !isSortableColumn(c)));
});

// 5. Accessors
test("pkg2 accessors follow render fallbacks; Status uses injected getRowStatus; blanks last; dates lexical", () => {
  assert.equal(productSkuSortText({ product_name: "A", sku_display_name: "S", sku_id: 1 }), "A S");
  assert.equal(productSkuSortText({ product_id: 7, sku_column_label: "L", sku_id: 1 }), "7 L");
  assert.equal(productSkuSortText({ product_name: "", product_id: 7, sku_id: 9 }), "7 9");
  assert.equal(productSkuSortText({}), "");
  assert.equal(productSortText({ product_name: null, product_id: 5 }), 5);
  assert.equal(categorySortText({ category_name: "Oils", subcategory_name: "Thailam" }), "Oils Thailam");
  assert.equal(categorySortText({ category_name: null, subcategory_name: "Powder" }), "Powder");
  assert.equal(groupSortText({ group_name: "G1", sub_group_name: "" }), "G1");
  assert.equal(stockItemSortText({ stock_item_name: null, stock_item_id: 502 }), 502);

  // Status: static map has get null (unsortable until injected); table-tools has no status chain.
  const statusCol = tableColumnsFor("sku-cost-sheet")[8];
  assert.equal(statusCol.key, "row_status");
  assert.equal(statusCol.get, null);
  assert.equal(isSortableColumn(statusCol), false);
  const src = read(TOOLS);
  assert.doesNotMatch(src, /overall_control_status|costing_status|pricing_bridge_status/);
  const injected = withAccessors(tableColumnsFor("sku-cost-sheet"), { row_status: (r) => r.s })[8];
  assert.ok(Object.isFrozen(injected));
  assert.equal(isSortableColumn(injected), true);
  assert.equal(statusCol.get, null, "static map not mutated");
  // In the sandbox, the shell's real getRowStatus drives the Status sort.
  const head = makeSandbox({ source: read(SHELL), flagOn: true, withCw05: true });
  const rows = FIXTURES["sku-cost-sheet"];
  head.VIEW = rows.slice();
  headerHtml(head, "sku-cost-sheet");
  head.tableHead.buttons.find((b) => b.dataset.cw05Sort === "8").click();
  const statuses = head.VIEW.map((r) => vm.runInContext("getRowStatus", head)(r));
  assert.deepEqual(statuses, ["+WARN", "BLOCKER", "READY"]);

  // Blanks last both ways, ISO dates lexical.
  const dg = tableColumnsFor(DRIVER_LENS)[5];
  assert.equal(dg.type, "date");
  const d = [{ effective_from: "2026-04-01" }, { effective_from: null }, { effective_from: "2025-12-01" }, { effective_from: "--" }, { effective_from: "" }];
  assert.deepEqual(sortRowsBy(d, dg, "asc").map((r) => r.effective_from), ["2025-12-01", "2026-04-01", null, "--", ""]);
  assert.deepEqual(sortRowsBy(d, dg, "desc").map((r) => r.effective_from), ["2026-04-01", "2025-12-01", null, "--", ""]);
  const p = tableColumnsFor("printable-cost-sheet")[0];
  const pr = [{ product_name: "b" }, { product_name: null, product_id: null }, { product_name: "A" }];
  assert.deepEqual(sortRowsBy(pr, p, "asc").map((r) => r.product_name), ["A", "b", null]);
  assert.deepEqual(sortRowsBy(pr, p, "desc").map((r) => r.product_name), ["b", "A", null]);
});

// 6. COLUMN_HELP unchanged
test("pkg2 COLUMN_HELP is unchanged from base", async () => {
  const baseSrc = readBase(TOOLS);
  const baseMod = await import(`data:text/javascript;base64,${Buffer.from(baseSrc).toString("base64")}`);
  assert.deepEqual(JSON.parse(JSON.stringify(COLUMN_HELP)), JSON.parse(JSON.stringify(baseMod.COLUMN_HELP)));
  const slice = (s) => s.slice(s.indexOf("export const COLUMN_HELP"), s.indexOf("export function columnHelpFor"));
  assert.equal(slice(read(TOOLS)), slice(baseSrc));
});

// 7. CSS
test("pkg2 CSS: one appended block at file end, every selector scoped to [data-cw05-sort]", () => {
  const head = read(CSS);
  const base = readBase(CSS);
  assert.ok(head.startsWith(base), "existing rules untouched (append-only)");
  const added = head.slice(base.length);
  assert.ok(added.length > 0);
  assert.match(added, /^\n\/\* CW-05 table tools/);
  const selectorLines = added
    .split("\n")
    .filter((l) => /\{\s*$/.test(l) || /,\s*$/.test(l));
  assert.ok(selectorLines.length >= 4);
  for (const l of selectorLines) assert.ok(l.includes("[data-cw05-sort]"), l);
  const diff = execFileSync("git", ["diff", PKG2_BASE, "--", CSS], { cwd: root, encoding: "utf8" });
  assert.ok(!diff.split("\n").some((l) => l.startsWith("-") && !l.startsWith("---")), "only added lines");
  const changed = execFileSync("git", ["diff", "--name-only", PKG2_BASE, "--", "*.css", "*.html"], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  assert.deepEqual(changed, [CSS]);
});

// 8. Module safety
test("pkg2 module safety: no data layer/network/clock in table tools; FORBIDDEN_RPCS identical to base", () => {
  assert.doesNotMatch(read(TOOLS), /supabase|\.rpc\(|new Date|Date\.now|fetch\(/);
  const rel = `${JS}/costing-approval-screen.js`;
  const slice = (s) => {
    const i = s.indexOf("export const FORBIDDEN_RPCS");
    return s.slice(i, s.indexOf("]);", i) + 3);
  };
  assert.ok(slice(read(rel)).length > 40);
  assert.equal(slice(read(rel)), slice(readBase(rel)));
  const count = (s, re) => (s.match(re) || []).length;
  for (const re of [/\.rpc\(/g, /new Date/g, /Date\.now/g]) {
    assert.equal(count(read(SHELL), re), count(readBase(SHELL), re), String(re));
  }
});
