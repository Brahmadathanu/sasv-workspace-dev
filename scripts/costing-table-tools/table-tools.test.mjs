import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import * as flags from "../../public/shared/js/costing-feature-flags.js";
import * as tools from "../../public/shared/js/costing-table-tools.js";
import {
  COLUMN_HELP,
  GENERIC_TABLE_COLUMNS,
  activeSortState,
  applySortClick,
  ariaSortFor,
  buildCsv,
  columnHelpFor,
  compareValues,
  csvCell,
  csvColumnsFor,
  nextSortState,
  sortIndicatorFor,
  sortRows,
  toLabelledCsvRows,
} from "../../public/shared/js/costing-table-tools.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const BASE = "1c505ed6c1ff90505b904048602c004e39f5fbae";
const readBase = (rel) =>
  execFileSync("git", ["show", `${BASE}:${rel}`], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
const SHELL = "public/shared/js/costing-suite-shell.js";
const TOOLS = "public/shared/js/costing-table-tools.js";

const { COSTING_TABLE_TOOLS_V1, isCostingTableToolsV1Enabled } = flags;

// 1. Flag defaults
test("COSTING_TABLE_TOOLS_V1 defaults OFF and accepts exactly string 1", () => {
  assert.equal(COSTING_TABLE_TOOLS_V1, "COSTING_TABLE_TOOLS_V1");
  for (const value of [null, undefined, "", "0", 1, true, "true", " 1", "1 "]) {
    assert.equal(isCostingTableToolsV1Enabled({ getItem: () => value }), false, String(value));
  }
  assert.equal(isCostingTableToolsV1Enabled({ getItem: () => "1" }), true);
  assert.equal(
    isCostingTableToolsV1Enabled({
      getItem: () => {
        throw new Error("blocked");
      },
    }),
    false,
  );
  assert.equal(isCostingTableToolsV1Enabled(undefined), false);
  assert.equal(isCostingTableToolsV1Enabled({}), false);
});

// 2. Independence across all seven flags
test("all 128 costing flag combinations stay independent", () => {
  const pairs = [
    ["COSTING_RECALC_WITH_DATE_V1", flags.isCostingRecalcWithDateV1Enabled],
    ["COSTING_APPROVAL_SCREEN_V1", flags.isCostingApprovalScreenV1Enabled],
    ["COSTING_LOCK_SCREEN_V1", flags.isCostingLockScreenV1Enabled],
    ["COSTING_RUN_STATUS_V1", flags.isCostingRunStatusV1Enabled],
    ["COSTING_UX_CONSISTENCY_V1", flags.isCostingUxConsistencyV1Enabled],
    ["COSTING_DIALOGS_V1", flags.isCostingDialogsV1Enabled],
    ["COSTING_TABLE_TOOLS_V1", flags.isCostingTableToolsV1Enabled],
  ];
  for (const [key, fn] of pairs) {
    assert.equal(flags[key], key);
    assert.equal(typeof fn, "function", key);
  }
  for (let bits = 0; bits < 128; bits += 1) {
    const store = new Map();
    pairs.forEach(([key], i) => {
      if (bits & (1 << i)) store.set(key, "1");
    });
    const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null) };
    pairs.forEach(([key, fn], i) => {
      assert.equal(fn(storage), Boolean(bits & (1 << i)), `${key} bits=${bits}`);
    });
  }
});

// 3. OFF path unchanged
const OLD_GENERIC_HEADER = `  tableHead.innerHTML = \`<tr>\${headers
    .map((h, i) => {
      const classes = [alignments[i] || "c-left"];
      if (i === 0 && h === "") classes.push("lane-col");
      return \`<th class="\${classes.join(" ")}">\${text(h, "")}</th>\`;
    })
    .join("")}</tr>\`;
}`;

function stripCw05(src) {
  let out = src;
  const remove = (pattern, label) => {
    const before = out;
    out = out.replace(pattern, "");
    assert.notEqual(out, before, `expected CW-05 block: ${label}`);
  };
  remove(
    'import { isCostingTableToolsV1Enabled } from "./costing-feature-flags.js";\n',
    "flag import",
  );
  remove(/import \{[^}]*\} from "\.\/costing-table-tools\.js";\n/, "tools import");
  remove(
    "// CW-05 table tools state (used only when COSTING_TABLE_TOOLS_V1 is ON).\nlet CW05_SORT_CTX = null;\nlet CW05_HEADER_LENS = null;\n",
    "state",
  );
  remove(
    "  if (isCostingTableToolsV1Enabled()) {\n    renderCw05GenericTableHeader(headers, alignments);\n    return;\n  }\n",
    "header gate",
  );
  remove(
    "      if (isCostingTableToolsV1Enabled()) {\n        renderCw05GenericTableHeader(sheetHeaders, sheetAlignments);\n        return;\n      }\n",
    "cost-sheet header gate",
  );
  remove(
    /\n\/\*\*\n \* CW-05 \(COSTING_TABLE_TOOLS_V1 ON only\): header[\s\S]*?\n}\n(?=\nfunction productSkuLabel)/,
    "header renderer",
  );
  remove(
    "    if (isCostingTableToolsV1Enabled() && exportCw05CsvForView()) return;\n",
    "csv gate",
  );
  remove(/\/\*\*\n \* CW-05 \(COSTING_TABLE_TOOLS_V1 ON only\)[\s\S]*?\n}\n\n(?=function exportCsvForRows)/, "csv helper");
  return out;
}

test("flag OFF: shell is byte-identical to base once the gated CW-05 blocks are removed", () => {
  const head = read(SHELL);
  assert.ok(head.includes(OLD_GENERIC_HEADER), "old generic header template intact");
  assert.ok(head.includes("    exportCsvForRows(VIEW);\n    return;\n"), "exportCsvForRows(VIEW) intact");
  const base = readBase(SHELL);
  assert.ok(base.includes(OLD_GENERIC_HEADER));
  assert.equal(stripCw05(head), base);
});

test("flag OFF: every CW-05 entry point sits behind isCostingTableToolsV1Enabled()", () => {
  const src = read(SHELL);
  const callers = (name) =>
    src.split("\n").filter((l) => l.includes(`${name}(`) && !l.includes(`function ${name}(`));
  for (const [name, expected] of [
    ["renderCw05GenericTableHeader", 2],
    ["exportCw05CsvForView", 1],
  ]) {
    const lines = callers(name);
    assert.equal(lines.length, expected, name);
    for (const line of lines) {
      const idx = src.indexOf(line);
      const window = src.slice(Math.max(0, idx - 80), idx + line.length);
      assert.match(window, /isCostingTableToolsV1Enabled\(\)/, name);
    }
  }
  // Every reference to the imported tool helpers lives inside the two gated functions.
  const gatedFns = [
    src.match(/function renderCw05GenericTableHeader[\s\S]*?\n}\n/)[0],
    src.match(/function exportCw05CsvForView[\s\S]*?\n}\n/)[0],
  ];
  const gated = gatedFns.join("\n");
  const outside = gatedFns.reduce((acc, fn) => acc.replace(fn, ""), src);
  const withoutImports = outside.replace(/import \{[^}]*\} from "\.\/costing-table-tools\.js";\n/, "");
  for (const helper of [
    "activeSortState(",
    "applySortClick(",
    "ariaSortFor(",
    "columnHelpFor(",
    "csvColumnsFor(",
    "sortIndicatorFor(",
    "tableColumnsFor(",
    "toLabelledCsvRows(",
    "data-cw05-sort",
  ]) {
    assert.ok(gated.includes(helper), `gated uses ${helper}`);
    assert.ok(!withoutImports.includes(helper), `${helper} only inside gated code`);
  }
});

// 4. Sorting
test("compareValues and sortRows: numbers, dates, text, blanks, stability, no mutation", () => {
  const nums = [{ v: "10" }, { v: "9" }, { v: 2 }, { v: "-1" }];
  const numsCopy = JSON.parse(JSON.stringify(nums));
  assert.deepEqual(sortRows(nums, "v", "asc", "number").map((r) => r.v), ["-1", 2, "9", "10"]);
  assert.deepEqual(sortRows(nums, "v", "desc", "number").map((r) => r.v), ["10", "9", 2, "-1"]);
  assert.deepEqual(nums, numsCopy, "input not mutated");
  assert.notEqual(sortRows(nums, "v", "asc", "number"), nums);
  assert.notEqual(sortRows(nums, "v", "none", "number"), nums);

  // NaN falls back to text compare
  assert.ok(compareValues("abc", "abd", "number") < 0);

  const dates = [
    { d: "2026-10-01T05:00:00+00:00" },
    { d: "2025-12-31" },
    { d: "2026-01-15" },
  ];
  assert.deepEqual(sortRows(dates, "d", "asc", "date").map((r) => r.d), [
    "2025-12-31",
    "2026-01-15",
    "2026-10-01T05:00:00+00:00",
  ]);
  assert.deepEqual(sortRows(dates, "d", "desc", "date").map((r) => r.d), [
    "2026-10-01T05:00:00+00:00",
    "2026-01-15",
    "2025-12-31",
  ]);

  const words = [{ t: "beta" }, { t: "Alpha" }, { t: "alpha" }, { t: "Gamma" }];
  assert.deepEqual(sortRows(words, "t", "asc").map((r) => r.t), ["Alpha", "alpha", "beta", "Gamma"]);
  assert.deepEqual(sortRows(words, "t", "desc").map((r) => r.t), ["Gamma", "beta", "Alpha", "alpha"]);
  assert.equal(compareValues("SKU2", "SKU10", "text") < 0, true);

  const ties = [
    { k: 1, id: "a" },
    { k: 0, id: "b" },
    { k: 1, id: "c" },
    { k: 0, id: "d" },
  ];
  assert.deepEqual(sortRows(ties, "k", "asc", "number").map((r) => r.id), ["b", "d", "a", "c"]);
  assert.deepEqual(sortRows(ties, "k", "desc", "number").map((r) => r.id), ["a", "c", "b", "d"]);

  const blanks = [
    { v: null, id: 1 },
    { v: "5", id: 2 },
    { v: "", id: 3 },
    { v: "--", id: 4 },
    { v: "1", id: 5 },
    { id: 6 },
  ];
  const asc = sortRows(blanks, "v", "asc", "number").map((r) => r.id);
  const desc = sortRows(blanks, "v", "desc", "number").map((r) => r.id);
  assert.deepEqual(asc, [5, 2, 1, 3, 4, 6]);
  assert.deepEqual(desc, [2, 5, 1, 3, 4, 6]);
  for (const type of ["text", "date"]) {
    const a = sortRows(blanks, "v", "asc", type).map((r) => r.id);
    const d = sortRows(blanks, "v", "desc", type).map((r) => r.id);
    assert.deepEqual(a.slice(2), [1, 3, 4, 6], type);
    assert.deepEqual(d.slice(2), [1, 3, 4, 6], type);
  }
});

test("nextSortState cycles none -> asc -> desc -> none; new key restarts at asc", () => {
  let s = { key: null, dir: "none" };
  s = nextSortState(s, "a");
  assert.deepEqual(s, { key: "a", dir: "asc" });
  s = nextSortState(s, "a");
  assert.deepEqual(s, { key: "a", dir: "desc" });
  s = nextSortState(s, "a");
  assert.deepEqual(s, { key: null, dir: "none" });
  s = nextSortState(nextSortState(null, "a"), "b");
  assert.deepEqual(s, { key: "b", dir: "asc" });
});

// 5. aria-sort
test("ariaSortFor and sortIndicatorFor", () => {
  assert.equal(ariaSortFor({ key: "a", dir: "asc" }, "a"), "ascending");
  assert.equal(ariaSortFor({ key: "a", dir: "desc" }, "a"), "descending");
  assert.equal(ariaSortFor({ key: "a", dir: "asc" }, "b"), "none");
  assert.equal(ariaSortFor({ key: null, dir: "none" }, "a"), "none");
  assert.equal(ariaSortFor(null, "a"), "none");
  assert.equal(sortIndicatorFor({ key: "a", dir: "asc" }, "a"), " ▲");
  assert.equal(sortIndicatorFor({ key: "a", dir: "desc" }, "a"), " ▼");
  assert.equal(sortIndicatorFor({ key: "a", dir: "desc" }, "b"), "");
});

// 6. CSV
test("csvCell quotes, doubles quotes and neutralises formula-leading strings only", () => {
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(undefined), '""');
  for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
    assert.equal(csvCell(`${lead}X`), `"'${lead}X"`, JSON.stringify(lead));
  }
  assert.equal(csvCell("-12.5"), `"'-12.5"`);
  assert.equal(csvCell(-12.5), '"-12.5"');
  assert.equal(csvCell(0), '"0"');
  assert.equal(csvCell("ok=1"), '"ok=1"');
});

test("buildCsv uses displayed labels in displayed order and only the given rows", () => {
  const columns = [
    { key: "mrp_ik", label: "MRP IK" },
    { key: "sku_id", label: "SKU ID" },
  ];
  const rows = [
    { sku_id: "S1", mrp_ik: 10, extra: "x" },
    { sku_id: "=S2", mrp_ik: "1,5", extra: "y" },
  ];
  const csv = buildCsv(columns, rows);
  assert.equal(csv, ['"MRP IK","SKU ID"', '"10","S1"', `"1,5","'=S2"`].join("\n"));
  assert.ok(!csv.includes("mrp_ik"));
  assert.ok(!csv.includes("extra"));
  assert.equal(buildCsv(columns, rows.slice(0, 1)).split("\n").length, 2);
});

test("label-keyed rows fed through the legacy exportCsvForRows escape equal buildCsv", () => {
  // Re-implementation of the unchanged legacy body (see exportCsvForRows in the shell).
  const legacy = (rows) => {
    const keys = Array.from(
      rows.reduce((set, row) => {
        Object.keys(row).forEach((k) => set.add(k));
        return set;
      }, new Set()),
    );
    const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    return [
      keys.map(csvEscape).join(","),
      ...rows.map((row) => keys.map((k) => csvEscape(row[k])).join(",")),
    ].join("\n");
  };
  const shell = read(SHELL);
  assert.ok(shell.includes("const csvEscape = (value) => `\"${String(value ?? \"\").replace(/\"/g, '\"\"')}\"`;"));
  for (const lens of Object.keys(GENERIC_TABLE_COLUMNS)) {
    const columns = csvColumnsFor(lens);
    const rows = [
      Object.fromEntries(columns.map((c, i) => [c.key, i % 2 ? `-${i}` : i])),
      Object.fromEntries(columns.map((c) => [c.key, null])),
      Object.fromEntries(columns.map((c) => [c.key, 'q"uote,\nnl'])),
    ];
    if (!columns.length) continue;
    assert.equal(legacy(toLabelledCsvRows(columns, rows)), buildCsv(columns, rows), lens);
  }
  assert.deepEqual(csvColumnsFor("sku-cost-sheet").map((c) => c.label), [
    "SKU ID",
    "MRP IK",
    "MRP OK",
    "Internal Loaded Cost",
    "IK Selling Price",
    "OK Selling Price",
  ]);
  assert.deepEqual(csvColumnsFor("cost-comparison"), []);
  assert.deepEqual(csvColumnsFor("unknown-lens"), []);
});

test("column map labels match the shell generic header labels exactly", () => {
  const shell = read(SHELL);
  for (const [lens, cols] of Object.entries(GENERIC_TABLE_COLUMNS)) {
    const block = shell.match(new RegExp(`  const headers = \\{[\\s\\S]*?"${lens}": \\[([\\s\\S]*?)\\]`))[1];
    const labels = [...block.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(cols.map((c) => c.label), labels, lens);
    assert.ok(Object.isFrozen(cols));
  }
});

// 7. Column help
test("columnHelpFor returns strings for mapped keys, '' otherwise; map is frozen", () => {
  assert.ok(Object.isFrozen(COLUMN_HELP));
  for (const [lens, byKey] of Object.entries(COLUMN_HELP)) {
    assert.ok(Object.isFrozen(byKey), lens);
    for (const key of Object.keys(byKey)) {
      const help = columnHelpFor(lens, key);
      assert.equal(typeof help, "string");
      assert.ok(help.length > 0);
    }
  }
  assert.equal(columnHelpFor("sku-cost-sheet", "mrp_ik"), "MRP IK. Click to sort.");
  assert.equal(columnHelpFor("sku-cost-sheet", "nope"), "");
  assert.equal(columnHelpFor("nope", "mrp_ik"), "");
  assert.equal(columnHelpFor("sku-cost-sheet", null), "");
  assert.throws(() => {
    "use strict";
    COLUMN_HELP["sku-cost-sheet"].mrp_ik = "changed";
  });
});

// 8. Module safety
test("table tools module has no data-layer, network or clock use; FORBIDDEN_RPCS unchanged", () => {
  const src = read(TOOLS);
  assert.doesNotMatch(src, /supabase|\.rpc\(|new Date|Date\.now|fetch\(/);
  assert.doesNotMatch(src, /\bdocument\b|\bwindow\b|localStorage/);
  const slice = (s) => s.slice(s.indexOf("export const FORBIDDEN_RPCS"), s.indexOf("]);", s.indexOf("export const FORBIDDEN_RPCS")) + 3);
  const rel = "public/shared/js/costing-approval-screen.js";
  assert.equal(slice(read(rel)), slice(readBase(rel)));
  assert.ok(slice(read(rel)).length > 40);
  // No new .rpc( names or clock calls added to the shell by CW-05.
  const added = read(SHELL).length - stripCw05(read(SHELL)).length;
  assert.ok(added > 0);
  const head = read(SHELL);
  const base = readBase(SHELL);
  const count = (s, re) => (s.match(re) || []).length;
  assert.equal(count(head, /\.rpc\(/g), count(base, /\.rpc\(/g));
  assert.equal(count(head, /new Date/g), count(base, /new Date/g));
  assert.equal(count(head, /Date\.now/g), count(base, /Date\.now/g));
});

// 9. Row click mapping after a sort
test("row-click index resolves to the sorted row after a header sort", () => {
  const PAGE_SIZE = 2;
  const ALL_ROWS = [
    { sku_id: "C", mrp_ik: 30 },
    { sku_id: "A", mrp_ik: 10 },
    { sku_id: "D", mrp_ik: null },
    { sku_id: "B", mrp_ik: 20 },
  ];
  let VIEW = [...ALL_ROWS];
  let ctx = null;
  const col = GENERIC_TABLE_COLUMNS["sku-cost-sheet"].find((c) => c.key === "mrp_ik");
  ({ ctx, view: VIEW } = applySortClick(ctx, "sku-cost-sheet", VIEW, col));
  assert.deepEqual(activeSortState(ctx, "sku-cost-sheet", VIEW), { key: "mrp_ik", dir: "asc" });
  for (const page of [1, 2]) {
    const start = (page - 1) * PAGE_SIZE;
    const pageRows = VIEW.slice(start, start + PAGE_SIZE);
    const rendered = pageRows.map((row, idx) => ({ rowIndex: start + idx, row }));
    for (const tr of rendered) {
      assert.equal(VIEW[Number(String(tr.rowIndex))], tr.row);
    }
  }
  assert.deepEqual(VIEW.map((r) => r.sku_id), ["A", "B", "C", "D"]);
  ({ ctx, view: VIEW } = applySortClick(ctx, "sku-cost-sheet", VIEW, col));
  assert.deepEqual(VIEW.map((r) => r.sku_id), ["C", "B", "A", "D"]);
  assert.equal(VIEW[0].sku_id, "C");
  ({ ctx, view: VIEW } = applySortClick(ctx, "sku-cost-sheet", VIEW, col));
  assert.deepEqual(VIEW.map((r) => r.sku_id), ["C", "A", "D", "B"], "none restores original order");
  assert.deepEqual(ALL_ROWS.map((r) => r.sku_id), ["C", "A", "D", "B"], "ALL_ROWS untouched");

  // Filter/search reassigns VIEW from ALL_ROWS: sort state is treated as cleared.
  ({ ctx, view: VIEW } = applySortClick(ctx, "sku-cost-sheet", VIEW, col));
  VIEW = [...ALL_ROWS];
  assert.deepEqual(activeSortState(ctx, "sku-cost-sheet", VIEW), { key: null, dir: "none" });
  ({ ctx, view: VIEW } = applySortClick(ctx, "sku-cost-sheet", VIEW, col));
  assert.deepEqual(ctx.state, { key: "mrp_ik", dir: "asc" });
  // Lens switch also clears.
  assert.deepEqual(activeSortState(ctx, "printable-cost-sheet", VIEW), { key: null, dir: "none" });
});

// 10. Cache pin
test("service worker cache is hub-cache-v383", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /const CACHE_NAME = "hub-cache-v383"/);
  assert.equal(
    sw.split("\n")[1],
    'const CACHE_NAME = "hub-cache-v383"; // CW-05 table tools; v382 was costing dialogs CW-06 item 1',
  );
});

// ---- Shell header/CSV behaviour in a sandbox (real shell function source, mocked DOM) ----
const COST_SHEET_LENSES = ["sku-cost-sheet", "printable-cost-sheet", "cost-comparison"];

function extractFn(src, name) {
  let start = src.indexOf(`\nfunction ${name}(`);
  let asyncStart = src.indexOf(`\nasync function ${name}(`);
  if (start < 0 || (asyncStart >= 0 && asyncStart < start)) start = asyncStart;
  assert.ok(start >= 0, `function ${name} found`);
  const end = src.indexOf("\n}\n", start);
  return src.slice(start + 1, end + 2);
}

function costSheetModuleTables() {
  const src = read("public/shared/js/costing-suite-cost-sheet.js");
  const grab = (name) =>
    vm.runInNewContext(`(${src.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`))[1]})`);
  return { headers: grab("TABLE_HEADERS"), alignments: grab("TABLE_ALIGNMENTS") };
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

function makeShellSandbox({ source, flagOn, withCw05 }) {
  const tables = costSheetModuleTables();
  const no = () => false;
  const ctx = {
    ...tools,
    tableHead: makeTableHead(),
    CURRENT_LENS: "",
    VIEW: [],
    CURRENT_PAGE: 3,
    CW05_SORT_CTX: null,
    CW05_HEADER_LENS: null,
    renderTableCalls: 0,
    exported: [],
    isCostingTableToolsV1Enabled: () => flagOn,
    isDriverGovernanceLens: no,
    isCostBuildLens: no,
    isMaterialCostLens: no,
    isSchemeComparisonLens: no,
    isCostSheetLens: (lens) => COST_SHEET_LENSES.includes(lens),
    isPricingPolicyLens: no,
    isControlCenterLens: no,
    isMaterialCostTraceLensActive: no,
    costSheetCtrl: {
      getTableHeaders: (lens) => tables.headers[lens] || null,
      getTableAlignments: (lens) => tables.alignments[lens] || null,
    },
  };
  vm.createContext(ctx);
  const names = ["escapeHtml", "text", "renderTableHeaderForLens", "exportActiveViewCsv"];
  if (withCw05) names.push("renderCw05GenericTableHeader", "exportCw05CsvForView");
  vm.runInContext(
    [
      ...names.map((n) => extractFn(source, n)),
      "function renderTable() { renderTableCalls += 1; }",
      "function exportCsvForRows(rows) { exported.push(rows); }",
    ].join("\n"),
    ctx,
  );
  return ctx;
}

function headerHtml(ctx, lens) {
  ctx.CURRENT_LENS = lens;
  vm.runInContext("renderTableHeaderForLens()", ctx);
  return ctx.tableHead.innerHTML;
}

const SAMPLE_SKU_ROWS = [
  { sku_id: "S-C", product_name: "P1", mrp_ik: 30, mrp_ok: 31 },
  { sku_id: "S-A", product_name: "P2", mrp_ik: "10", mrp_ok: null },
  { sku_id: "S-D", product_name: "P3", mrp_ik: null, mrp_ok: 5 },
  { sku_id: "S-B", product_name: "=P4", mrp_ik: 20, mrp_ok: 9 },
];

test("(c) flag OFF: header HTML for all three cost-sheet lenses is identical to main", () => {
  const base = makeShellSandbox({ source: readBase(SHELL), flagOn: false, withCw05: false });
  const head = makeShellSandbox({ source: read(SHELL), flagOn: false, withCw05: true });
  for (const lens of COST_SHEET_LENSES) {
    const b = headerHtml(base, lens);
    assert.ok(b.startsWith("<tr><th"), lens);
    assert.equal(headerHtml(head, lens), b, lens);
    assert.equal(head.CW05_HEADER_LENS, null, lens);
  }
  // Flag OFF CSV goes straight to the legacy export with VIEW itself.
  head.VIEW = SAMPLE_SKU_ROWS;
  head.CURRENT_LENS = "sku-cost-sheet";
  vm.runInContext("exportActiveViewCsv()", head);
  assert.equal(head.exported.length, 1);
  assert.equal(head.exported[0], SAMPLE_SKU_ROWS);
});

test("(a) flag ON: cost-sheet lenses reach the CW-05 header with aria-sort, title and sort buttons", () => {
  const head = makeShellSandbox({ source: read(SHELL), flagOn: true, withCw05: true });
  const base = makeShellSandbox({ source: readBase(SHELL), flagOn: false, withCw05: false });
  const sku = headerHtml(head, "sku-cost-sheet");
  assert.equal(head.CW05_HEADER_LENS, "sku-cost-sheet");
  assert.match(
    sku,
    /<th class="c-right" aria-sort="none" title="MRP IK\. Click to sort\."><button type="button" data-cw05-sort="3">MRP IK<\/button><\/th>/,
  );
  assert.equal(head.tableHead.buttons.length, 6);
  // Unsortable columns keep the legacy markup.
  assert.ok(sku.includes('<th class="c-center lane-col"></th>'));
  assert.ok(sku.includes('<th class="c-left">Product / SKU</th>'));
  assert.ok(sku.includes('<th class="c-left">Status</th>'));
  // Same labels as the cost-sheet branch, in the same order.
  const strip = (html) => html.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");
  assert.equal(strip(sku), strip(headerHtml(base, "sku-cost-sheet")));

  const printable = headerHtml(head, "printable-cost-sheet");
  assert.equal(head.tableHead.buttons.length, 3);
  assert.match(printable, /aria-sort="none" title="Refreshed At\. Click to sort\."><button type="button" data-cw05-sort="5">Refreshed At<\/button>/);
  assert.ok(printable.includes('<th class="c-left">Product</th>'));
});

test("(b) flag ON: cost-comparison stays unsortable and renders exactly as on main", () => {
  const head = makeShellSandbox({ source: read(SHELL), flagOn: true, withCw05: true });
  const base = makeShellSandbox({ source: readBase(SHELL), flagOn: false, withCw05: false });
  const html = headerHtml(head, "cost-comparison");
  assert.equal(html, headerHtml(base, "cost-comparison"));
  assert.doesNotMatch(html, /aria-sort|data-cw05-sort|<button|title=/);
  assert.equal(head.tableHead.buttons.length, 0);
  // CSV for cost-comparison falls back to the legacy export of VIEW.
  head.VIEW = [{ a: 1 }];
  vm.runInContext("exportActiveViewCsv()", head);
  assert.equal(head.exported[0], head.VIEW);
});

test("(d) flag ON: header click sorts VIEW in memory, resets page, row index maps to sorted row; filter clears", () => {
  const head = makeShellSandbox({ source: read(SHELL), flagOn: true, withCw05: true });
  const ALL_ROWS = SAMPLE_SKU_ROWS.slice();
  head.VIEW = [...ALL_ROWS];
  headerHtml(head, "sku-cost-sheet");
  const mrpIk = () => head.tableHead.buttons.find((b) => b.dataset.cw05Sort === "3");
  mrpIk().click();
  assert.equal(head.CURRENT_PAGE, 1);
  assert.equal(head.renderTableCalls, 1);
  assert.deepEqual(head.VIEW.map((r) => r.sku_id), ["S-A", "S-B", "S-C", "S-D"]);
  assert.deepEqual(ALL_ROWS.map((r) => r.sku_id), ["S-C", "S-A", "S-D", "S-B"], "ALL_ROWS untouched");
  const html = headerHtml(head, "sku-cost-sheet");
  assert.match(html, /aria-sort="ascending"[^>]*><button type="button" data-cw05-sort="3">MRP IK ▲<\/button>/);
  // Row click mapping exactly as renderTable/click handler do it.
  const PAGE_SIZE = 2;
  for (const page of [1, 2]) {
    const start = (page - 1) * PAGE_SIZE;
    head.VIEW.slice(start, start + PAGE_SIZE).forEach((row, idx) => {
      const attr = `data-row-index="${start + idx}"`;
      const rowIndex = Number(attr.match(/"(\d+)"/)[1]);
      assert.equal(head.VIEW[rowIndex], row);
    });
  }
  mrpIk().click();
  assert.deepEqual(head.VIEW.map((r) => r.sku_id), ["S-C", "S-B", "S-A", "S-D"]);
  assert.match(headerHtml(head, "sku-cost-sheet"), /aria-sort="descending"[^>]*><button[^>]*>MRP IK ▼</);
  // Filter/search/reload replace VIEW from ALL_ROWS: the sort is cleared.
  head.VIEW = [...ALL_ROWS];
  const cleared = headerHtml(head, "sku-cost-sheet");
  assert.doesNotMatch(cleared, /ascending|descending|▲|▼/);
  mrpIk().click();
  assert.deepEqual(head.VIEW.map((r) => r.sku_id), ["S-A", "S-B", "S-C", "S-D"], "fresh cycle starts at asc");
});

test("(e) flag ON: cost-sheet CSV uses displayed labels, displayed order and sorted VIEW", () => {
  const head = makeShellSandbox({ source: read(SHELL), flagOn: true, withCw05: true });
  head.VIEW = SAMPLE_SKU_ROWS.slice();
  headerHtml(head, "sku-cost-sheet");
  head.tableHead.buttons.find((b) => b.dataset.cw05Sort === "3").click();
  vm.runInContext("exportActiveViewCsv()", head);
  assert.equal(head.exported.length, 1);
  const rows = head.exported[0];
  const labels = ["SKU ID", "MRP IK", "MRP OK", "Internal Loaded Cost", "IK Selling Price", "OK Selling Price"];
  assert.deepEqual(Object.keys(rows[0]), labels);
  assert.deepEqual(rows.map((r) => r["SKU ID"]), ["S-A", "S-B", "S-C", "S-D"]);
  assert.ok(!Object.keys(rows[0]).includes("mrp_ik"));
  assert.equal(rows.length, head.VIEW.length);

  head.VIEW = [{ sku_column_labels: "IK 100ml", product_cost_sheet_status: "-ok", refreshed_at: "2026-10-01T05:00:00Z", product_name: "X" }];
  headerHtml(head, "printable-cost-sheet");
  vm.runInContext("exportActiveViewCsv()", head);
  assert.deepEqual(head.exported[1], [
    { "SKU Columns": "IK 100ml", Status: "'-ok", "Refreshed At": "2026-10-01T05:00:00Z" },
  ]);
});

test("column map labels match the cost-sheet module's own header labels", () => {
  const { headers } = costSheetModuleTables();
  for (const lens of COST_SHEET_LENSES) {
    assert.deepEqual(GENERIC_TABLE_COLUMNS[lens].map((c) => c.label), [...headers[lens]], lens);
  }
  assert.ok(GENERIC_TABLE_COLUMNS["cost-comparison"].every((c) => c.key === null));
});
