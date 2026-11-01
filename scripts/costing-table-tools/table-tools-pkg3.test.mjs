// CW-05 package 3: table tools for read-only tabs of pricing policy, cost build
// and material, plus SKU/Pack sort on sku-control-status. node:test only, no
// deps, no network. Same sandbox approach as the pkg 2 tests.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as tools from "../../public/shared/js/costing-table-tools.js";

const {
  COLUMN_HELP,
  TAB_TABLE_COLUMNS,
  allocationPoolSortText,
  costingClassSortText,
  csvCell,
  isSortableColumn,
  sortRowsBy,
  tableColumnsFor,
  tableColumnsForTable,
} = tools;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const PKG3_BASE = "8bc872c4b0ecb40842f7dd72eed05cf0cae532ec";
const readBase = (rel) =>
  execFileSync("git", ["show", `${PKG3_BASE}:${rel}`], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
const SHELL = "public/shared/js/costing-suite-shell.js";
const TOOLS = "public/shared/js/costing-table-tools.js";
const JS = "public/shared/js";

// ---- Real header constants/functions, read from the controller sources ----
function extractFn(src, name) {
  let start = src.indexOf(`\nfunction ${name}(`);
  const asyncStart = src.indexOf(`\nasync function ${name}(`);
  if (start < 0 || (asyncStart >= 0 && asyncStart < start)) start = asyncStart;
  assert.ok(start >= 0, `function ${name} found`);
  const end = src.indexOf("\n}\n", start);
  return src.slice(start + 1, end + 2);
}
const plain = (v) => JSON.parse(JSON.stringify(v));
const constArray = (src, name) => {
  const m = src.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]);`));
  assert.ok(m, `${name} found`);
  return plain(vm.runInNewContext(`(${m[1]})`));
};
const constObject = (src, name) => {
  const m = src.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`));
  assert.ok(m, `${name} found`);
  return plain(vm.runInNewContext(`(${m[1]})`));
};
const fnsFrom = (src, names, prelude = "") => {
  const ctx = vm.createContext({});
  vm.runInContext(prelude + names.map((n) => extractFn(src, n)).join("\n"), ctx);
  return Object.fromEntries(names.map((n) => [n, (...a) => plain(ctx[n](...a))]));
};

const pricingSrc = read(`${JS}/costing-suite-pricing-policy.js`);
const buildSrc = read(`${JS}/costing-suite-cost-build.js`);
const materialSrc = read(`${JS}/costing-suite-material-cost.js`);
const PRICING = {
  skuCurrent: [constArray(pricingSrc, "SKU_MRP_CURRENT_HEADERS"), constArray(pricingSrc, "SKU_MRP_CURRENT_ALIGNMENTS")],
  skuHistory: [constArray(pricingSrc, "SKU_MRP_HISTORY_HEADERS"), constArray(pricingSrc, "SKU_MRP_HISTORY_ALIGNMENTS")],
  derivCurrent: [constArray(pricingSrc, "PRODUCT_DERIVATION_CURRENT_HEADERS"), constArray(pricingSrc, "PRODUCT_DERIVATION_CURRENT_ALIGNMENTS")],
  derivHistory: [constArray(pricingSrc, "PRODUCT_DERIVATION_HISTORY_HEADERS"), constArray(pricingSrc, "PRODUCT_DERIVATION_HISTORY_ALIGNMENTS")],
  pm: fnsFrom(pricingSrc, ["policyManagerHeaders", "policyManagerAlignments"], 'const COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID = "commercial-sales-assumptions";\n'),
};
const BUILD = fnsFrom(buildSrc, [
  "costGovernanceHeaders",
  "costGovernanceAlignments",
  "staffGovernanceHeaders",
  "staffGovernanceAlignments",
  "manualProvisionHeaders",
  "manualProvisionAlignments",
]);
const MATERIAL = {
  headers: constObject(materialSrc, "MANUAL_RATE_HEADERS_BY_TAB"),
  alignments: constObject(materialSrc, "MANUAL_RATE_ALIGNMENTS_BY_TAB"),
};
// Placeholder headers for the MRP workflow tabs (proposals/decisions/application/
// applied history): their headers live in sub-controllers; they are OUT and must
// render the legacy template whatever the labels are.
const WORKFLOW_HEADERS = [["Proposal", "Product", "Status"], ["c-left", "c-left", "c-left"]];

// ---- Mock controllers driven by the REAL tab/view getter values ----
function makeControllers(state) {
  const mrp = () => state.mrpTab;
  const pricingPolicyCtrl = {
    getMrpGovernanceTab: () => state.mrpTab,
    isSkuMrpPoliciesTabActive: () => mrp() === "sku-mrp-policies",
    isProductDerivationPoliciesTabActive: () => mrp() === "product-derivation-policies",
    isMrpProposalsTabActive: () => mrp() === "mrp-proposals",
    isMrpDecisionsTabActive: () => mrp() === "mrp-decisions",
    isMrpApplicationTabActive: () => mrp() === "mrp-application",
    isMrpAppliedHistoryTabActive: () => mrp() === "mrp-applied-history",
    getSkuMrpPolicyView: () => state.skuView,
    getProductDerivationPolicyView: () => state.derivView,
    getPolicyManagerTab: () => state.pmTab,
    isCommercialSalesAssumptionsTabActive: () => state.pmTab === "commercial-sales-assumptions",
    pick(lens) {
      if (lens === "mrp-governance") {
        if (["mrp-proposals", "mrp-decisions", "mrp-application", "mrp-applied-history"].includes(mrp())) return WORKFLOW_HEADERS;
        if (mrp() === "product-derivation-policies") return state.derivView === "history" ? PRICING.derivHistory : PRICING.derivCurrent;
        if (mrp() !== "sku-mrp-policies") return [[], []];
        return state.skuView === "history" ? PRICING.skuHistory : PRICING.skuCurrent;
      }
      if (lens === "policy-manager") return [PRICING.pm.policyManagerHeaders(state.pmTab), PRICING.pm.policyManagerAlignments(state.pmTab)];
      return [null, null];
    },
    getTableHeaders(lens) {
      return state.headerOverride || this.pick(lens)[0];
    },
    getTableAlignments(lens) {
      return this.pick(lens)[1];
    },
  };
  const costBuildCtrl = {
    getCostGovernanceTab: () => state.cgTab,
    getStaffGovernanceTab: () => state.sgTab,
    getManualProvisionTab: () => state.mpTab,
    getTableHeaders(lens) {
      if (state.headerOverride) return state.headerOverride;
      if (lens === "cost-governance") return BUILD.costGovernanceHeaders(state.cgTab);
      if (lens === "staff-governance") return BUILD.staffGovernanceHeaders(state.sgTab);
      if (lens === "manual-provisions") return BUILD.manualProvisionHeaders(state.mpTab);
      return null;
    },
    getTableAlignments(lens) {
      if (lens === "cost-governance") return BUILD.costGovernanceAlignments(state.cgTab);
      if (lens === "staff-governance") return BUILD.staffGovernanceAlignments(state.sgTab);
      if (lens === "manual-provisions") return BUILD.manualProvisionAlignments(state.mpTab);
      return null;
    },
  };
  const materialCostCtrl = {
    getManualRateManagerTab: () => state.mrmTab,
    key(lens) {
      if (lens === "rm-cost-trace" || lens === "pm-cost-trace") return lens;
      if (lens !== "manual-rate-manager") return null;
      if (state.mrmTab === "action-queue" && state.remediation) return "stage05-remediation";
      return MATERIAL.headers[state.mrmTab] ? state.mrmTab : "action-queue";
    },
    getTableHeaders(lens) {
      if (state.headerOverride) return state.headerOverride;
      const k = this.key(lens);
      return k ? MATERIAL.headers[k] : null;
    },
    getTableAlignments(lens) {
      const k = this.key(lens);
      return k ? MATERIAL.alignments[k] : null;
    },
  };
  return { pricingPolicyCtrl, costBuildCtrl, materialCostCtrl };
}

// ---- Tables: lens + tab state → expected table id ----
const IN_TABLES = {
  "mrp-governance:sku-mrp-current": { lens: "mrp-governance", state: { mrpTab: "sku-mrp-policies", skuView: "current" }, headers: () => PRICING.skuCurrent[0], buttons: 9 },
  "mrp-governance:sku-mrp-history": { lens: "mrp-governance", state: { mrpTab: "sku-mrp-policies", skuView: "history" }, headers: () => PRICING.skuHistory[0], buttons: 9 },
  "mrp-governance:derivation-current": { lens: "mrp-governance", state: { mrpTab: "product-derivation-policies", derivView: "current" }, headers: () => PRICING.derivCurrent[0], buttons: 9 },
  "mrp-governance:derivation-history": { lens: "mrp-governance", state: { mrpTab: "product-derivation-policies", derivView: "history" }, headers: () => PRICING.derivHistory[0], buttons: 7 },
  "policy-manager:sku-overview": { lens: "policy-manager", state: { pmTab: "sku-overview" }, headers: () => PRICING.pm.policyManagerHeaders("sku-overview"), buttons: 11 },
  "policy-manager:scheme-rule-register": { lens: "policy-manager", state: { pmTab: "scheme-rule-register" }, headers: () => PRICING.pm.policyManagerHeaders("scheme-rule-register"), buttons: 9 },
  "cost-governance:mapping-register": { lens: "cost-governance", state: { cgTab: "mapping-register" }, headers: () => BUILD.costGovernanceHeaders("mapping-register"), buttons: 4 },
  "cost-governance:excluded": { lens: "cost-governance", state: { cgTab: "excluded" }, headers: () => BUILD.costGovernanceHeaders("excluded"), buttons: 4 },
  "cost-governance:cost-pool-summary": { lens: "cost-governance", state: { cgTab: "cost-pool-summary" }, headers: () => BUILD.costGovernanceHeaders("cost-pool-summary"), buttons: 8 },
  "staff-governance:staff-pool-summary": { lens: "staff-governance", state: { sgTab: "staff-pool-summary" }, headers: () => BUILD.staffGovernanceHeaders("staff-pool-summary"), buttons: 6 },
  "manual-rate-manager:register": { lens: "manual-rate-manager", state: { mrmTab: "register" }, headers: () => MATERIAL.headers.register, buttons: 9 },
  "manual-rate-manager:history": { lens: "manual-rate-manager", state: { mrmTab: "history" }, headers: () => MATERIAL.headers.history, buttons: 9 },
};
const OUT_TABS = [
  ["mrp proposals", "mrp-governance", { mrpTab: "mrp-proposals" }],
  ["mrp decisions", "mrp-governance", { mrpTab: "mrp-decisions" }],
  ["mrp application", "mrp-governance", { mrpTab: "mrp-application" }],
  // pkg 4: applied-history register is IN (see table-tools-pkg4.test.mjs).
  // pkg 4: scheme-master raw columns are IN (see table-tools-pkg4.test.mjs).
  ["policy-manager commercial-sales-assumptions", "policy-manager", { pmTab: "commercial-sales-assumptions" }],
  ["cost-governance unmapped", "cost-governance", { cgTab: "unmapped" }],
  ["staff-governance staff-review", "staff-governance", { sgTab: "staff-review" }],
  ["staff-governance staff-register", "staff-governance", { sgTab: "staff-register" }],
  ["manual-provisions register", "manual-provisions", { mpTab: "register" }],
  // pkg 4: manual-provisions impact is IN (see table-tools-pkg4.test.mjs).
  ["manual-rate-manager action-queue", "manual-rate-manager", { mrmTab: "action-queue" }],
  ["manual-rate-manager stage05 remediation", "manual-rate-manager", { mrmTab: "action-queue", remediation: true }],
  ["rm-cost-trace", "rm-cost-trace", { mrmTab: "register" }],
  ["pm-cost-trace", "pm-cost-trace", { mrmTab: "history" }],
];
const DEFAULT_STATE = {
  mrpTab: "sku-mrp-policies",
  skuView: "current",
  derivView: "current",
  pmTab: "sku-overview",
  cgTab: "unmapped",
  sgTab: "staff-review",
  mpTab: "register",
  mrmTab: "action-queue",
  remediation: false,
  headerOverride: null,
};

// ---- Sandbox harness ----
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

function makeSandbox({ source, flagOn, withCw05 = true }) {
  const state = { ...DEFAULT_STATE };
  const no = () => false;
  const ctx = {
    ...tools,
    ...makeControllers(state),
    state,
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
    document: { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } },
    isCostingTableToolsV1Enabled: () => flagOn,
    isDriverGovernanceLens: no,
    isSchemeComparisonLens: no,
    isCostSheetLens: no,
    isControlCenterLens: no,
    isCostBuildLens: (l) => ["cost-governance", "staff-governance", "manual-provisions"].includes(l),
    isMaterialCostLens: (l) => ["manual-rate-manager", "rm-cost-trace", "pm-cost-trace"].includes(l),
    isPricingPolicyLens: (l) => ["mrp-governance", "policy-manager"].includes(l),
    isMaterialCostTraceLensActive: no,
  };
  vm.createContext(ctx);
  const names = ["escapeHtml", "text", "getRowStatus", "renderTableHeaderForLens", "exportActiveViewCsv", "exportCsvForRows"];
  if (withCw05) names.push("renderCw05GenericTableHeader", "exportCw05CsvForView");
  if (withCw05 && source.includes("\nfunction cw05TabTableId(")) names.push("cw05TabTableId");
  vm.runInContext([...names.map((n) => extractFn(source, n)), "function renderTable() { renderTableCalls += 1; }"].join("\n"), ctx);
  return ctx;
}

function setTable(ctx, lens, state) {
  Object.assign(ctx.state, DEFAULT_STATE, state);
  ctx.CURRENT_LENS = lens;
}
function headerHtml(ctx) {
  vm.runInContext("renderTableHeaderForLens()", ctx);
  return ctx.tableHead.innerHTML;
}
function exportCsv(ctx, view) {
  ctx.VIEW = view;
  ctx.csvOut.length = 0;
  vm.runInContext("exportActiveViewCsv()", ctx);
  assert.equal(ctx.csvOut.length, 1);
  return ctx.csvOut[0];
}

// Fixture rows built from each table's column map (uniform keys, plus the raw
// fields the accessors read). Values vary so every sortable column reorders.
const ACCESSOR_FIELDS = {
  product_sku_label: (i) => ({ product_name: ["Zeta", "Alpha", null][i], product_id: [3, 1, 2][i], sku_display_name: ["Z 1kg", null, "B 50g"][i], sku_column_label: [null, "A 10s", null][i], sku_id: [30, 10, 20][i] }),
  stock_item_label: (i) => ({ stock_item_name: ["Zinc", null, "Amla"][i], stock_item_id: [503, 501, 502][i], stock_item_code: ["ZN", "XX", "AM"][i] }),
  allocation_pool_label: (i) => ({ allocation_pool_label: ["Zone B", null, "Admin"][i], allocation_pool: ["ZB", "MFG", "ADM"][i] }),
  costing_class_label: (i) => ({ costing_class_label: [null, "Direct", "Indirect"][i], costing_class: ["Z_CLASS", "DIR", "IND"][i] }),
};
// Each cycle is in descending sort order, so no rotation of it is ascending:
// sorting any column ascending always reorders the three rows.
const VALUES = {
  number: [30, 10, null],
  date: ["2026-03-01", "2025-12-01T05:00:00+00:00", null],
  text: ["zeta", "alpha", "=mid"],
};
function fixtureRows(tableId) {
  const cols = tableColumnsForTable(tableId);
  return [0, 1, 2].map((i) => {
    const row = { row_no: i, period_ref: "2026-09-01" };
    for (const c of cols) {
      if (!c.key) continue;
      if (typeof c.get === "function") Object.assign(row, ACCESSOR_FIELDS[c.key](i));
      else row[c.key] = VALUES[c.type][(i + cols.indexOf(c)) % 3];
    }
    row.note = ["+x", "@y", "plain"][i];
    return row;
  });
}

const legacyTh = (cls, label) => `<th class="${cls}">${label}</th>`;

// 1. Flag OFF identity
const REVIEW_WORKLIST_SHELL_BLOCKS = [
  'import { isCostingReviewWorklistV1Enabled } from "./costing-feature-flags.js";\n',
  // C1: the worklist import list may grow; still exactly one import line from the module.
  /import \{[^}]*\} from "\.\/costing-review-worklist\.js";\n/,
  "// Costing review worklist v1 selection (used only when COSTING_REVIEW_WORKLIST_V1 is ON):\n// { key, rows } where rows is the ALL_ROWS array the group was picked on, so any\n// reload, period change or lens switch (each assigns a new ALL_ROWS) clears it.\nlet REVIEW_WORKLIST_GROUP = null;\n",
  '  if (isCostingReviewWorklistV1Enabled() && CURRENT_LENS === "sku-control-status") {\n    rows = filterReviewWorklistRows(rows, reviewWorklistSelectedKey());\n  }\n',
  '    if (isCostingReviewWorklistV1Enabled() && CURRENT_LENS === "sku-control-status") {\n      renderReviewWorklistPanel();\n    }\n',
];
const REVIEW_WORKLIST_FN_RE =
  /\/\*\* Review worklist v1 \(flag ON only\): selected group key[\s\S]*?\n}\n\n(?=function applyFilters\(\) \{\n)/;

test("pkg3 flag OFF: every IN table and OUT tab renders the base header exactly", () => {
  const base = makeSandbox({ source: readBase(SHELL), flagOn: false });
  const head = makeSandbox({ source: read(SHELL), flagOn: false });
  const cases = [
    ...Object.values(IN_TABLES).map((t) => [t.lens, t.state]),
    ...OUT_TABS.map(([, lens, st]) => [lens, st]),
  ];
  for (const [lens, st] of cases) {
    setTable(base, lens, st);
    setTable(head, lens, st);
    const b = headerHtml(base);
    const h = headerHtml(head);
    assert.ok(b.startsWith("<tr>"), `${lens} ${JSON.stringify(st)}`);
    assert.equal(h, b, `${lens} ${JSON.stringify(st)}`);
    assert.doesNotMatch(h, /data-cw05-sort|aria-sort|<button/);
  }
});

test("pkg3 flag OFF: legacy templates verbatim; shell equals base apart from gated CW-05 code", () => {
  const head = read(SHELL);
  const base = readBase(SHELL);
  for (const [h, a, lane] of [
    ["buildHeaders", "buildAlignments", true],
    ["materialHeaders", "materialAlignments", true],
    ["policyHeaders", "policyAlignments", false],
  ]) {
    const tpl =
      `      tableHead.innerHTML = \`<tr>\${${h}\n        .map((h, i) => {\n          const classes = [${a}[i] || "c-left"];\n` +
      (lane ? `          if (i === 0 && h === "") classes.push("lane-col");\n` : "") +
      `          return \`<th class="\${classes.join(" ")}">\${text(h, "")}</th>\`;\n        })\n        .join("")}</tr>\`;\n      return;\n`;
    assert.ok(base.includes(tpl), `${h} template in base`);
    assert.ok(head.includes(tpl), `${h} template intact in head`);
  }
  const gates = ["buildHeaders, buildAlignments", "materialHeaders, materialAlignments", "policyHeaders, policyAlignments"].map(
    (args) =>
      `      if (isCostingTableToolsV1Enabled()) {\n        if (renderCw05GenericTableHeader(${args}, cw05TabTableId())) return;\n      }\n`,
  );
  let stripped = head;
  for (const g of gates) {
    assert.equal(stripped.split(g).length, 2, g);
    stripped = stripped.replace(g, "");
  }
  // Costing review worklist v1 (separate feature, flag-gated): each block stripped exactly once.
  for (const w of REVIEW_WORKLIST_SHELL_BLOCKS) {
    assert.equal(stripped.split(w).length, 2, String(w));
    stripped = stripped.replace(w, "");
  }
  assert.match(stripped, REVIEW_WORKLIST_FN_RE);
  stripped = stripped.replace(REVIEW_WORKLIST_FN_RE, "");
  const dropCw05 = (s) =>
    s
      .replace(/\n\/\*\*\n \* CW-05 \(COSTING_TABLE_TOOLS_V1 ON only\): header[\s\S]*?\n}\n(?=\nfunction productSkuLabel)/, "")
      .replace(/import \{[^}]*\} from "\.\/costing-table-tools\.js";\n/, "");
  assert.equal(dropCw05(stripped), dropCw05(base));
  // cw05TabTableId only used inside the three gates.
  const uses = head
    .split("\n")
    .filter((l) => l.includes("cw05TabTableId(") && !l.includes("function cw05TabTableId(") && !/^\s*\*/.test(l));
  assert.equal(uses.length, 3);
  uses.forEach((l) => assert.match(l, /^\s+if \(renderCw05GenericTableHeader\(\w+, \w+, cw05TabTableId\(\)\)\) return;$/));
});

// 2. Self-check (i)
test("pkg3 self-check (i): every IN table renders its sort buttons; click sorts VIEW; row index maps to sorted row", () => {
  for (const [id, t] of Object.entries(IN_TABLES)) {
    const head = makeSandbox({ source: read(SHELL), flagOn: true });
    setTable(head, t.lens, t.state);
    assert.equal(vm.runInContext("cw05TabTableId()", head), id);
    const rows = fixtureRows(id);
    head.VIEW = rows.slice();
    const html = headerHtml(head);
    const cols = tableColumnsForTable(id);
    const sortable = cols.map((c, i) => (isSortableColumn(c) ? String(i) : null)).filter((x) => x !== null);
    assert.equal(head.tableHead.buttons.length, t.buttons, id);
    assert.deepEqual(head.tableHead.buttons.map((b) => b.dataset.cw05Sort), sortable, id);
    // Unsortable columns keep their legacy th (incl. the lane column).
    const base = makeSandbox({ source: readBase(SHELL), flagOn: false });
    setTable(base, t.lens, t.state);
    const baseThs = headerHtml(base).match(/<th[^>]*>[^<]*<\/th>/g);
    cols.forEach((c, i) => {
      if (!isSortableColumn(c)) assert.ok(html.includes(baseThs[i]), `${id} legacy th ${i}`);
    });
    for (const btn of head.tableHead.buttons.slice()) {
      head.VIEW = rows.slice();
      head.CURRENT_PAGE = 4;
      headerHtml(head);
      head.tableHead.buttons.find((x) => x.dataset.cw05Sort === btn.dataset.cw05Sort).click();
      assert.equal(head.CURRENT_PAGE, 1, id);
      const col = cols[Number(btn.dataset.cw05Sort)];
      const expected = sortRowsBy(rows, col, "asc");
      assert.deepEqual(head.VIEW.map((r) => r.row_no), expected.map((r) => r.row_no), `${id} ${col.label}`);
      assert.match(headerHtml(head), new RegExp(`aria-sort="ascending"><button type="button" data-cw05-sort="${btn.dataset.cw05Sort}">`), id);
      for (const page of [1, 2]) {
        const start = (page - 1) * 2;
        head.VIEW.slice(start, start + 2).forEach((row, idx) => {
          const tr = { dataset: { rowIndex: String(start + idx) } };
          assert.equal(head.VIEW[Number(tr.dataset.rowIndex)], row);
        });
      }
    }
    // At least one column actually reorders the fixture.
    head.VIEW = rows.slice();
    headerHtml(head);
    head.tableHead.buttons[0].click();
    assert.notDeepEqual(head.VIEW.map((r) => r.row_no), [0, 1, 2], `${id} first sort reorders`);
  }
});

test("pkg3 self-check (i): OUT tabs and trace lenses get 0 buttons and the legacy header", () => {
  for (const [name, lens, st] of OUT_TABS) {
    const head = makeSandbox({ source: read(SHELL), flagOn: true });
    const base = makeSandbox({ source: readBase(SHELL), flagOn: false });
    setTable(head, lens, st);
    setTable(base, lens, st);
    assert.equal(vm.runInContext("cw05TabTableId()", head), null, name);
    assert.equal(headerHtml(head), headerHtml(base), name);
    assert.equal(head.tableHead.buttons.length, 0, name);
  }
  // Empty mrp tab (no active sub-tab): tableId null; the empty-guard keeps its output.
  const head = makeSandbox({ source: read(SHELL), flagOn: true });
  setTable(head, "mrp-governance", { mrpTab: "unknown-tab" });
  assert.equal(vm.runInContext("cw05TabTableId()", head), null);
  assert.equal(headerHtml(head), "");
});

test("pkg3 self-check (i): switching tab or view with a sort active shows no stale aria-sort", () => {
  const head = makeSandbox({ source: read(SHELL), flagOn: true });
  const rows = fixtureRows("mrp-governance:sku-mrp-current");
  setTable(head, "mrp-governance", IN_TABLES["mrp-governance:sku-mrp-current"].state);
  head.VIEW = rows.slice();
  headerHtml(head);
  head.tableHead.buttons[0].click();
  assert.match(headerHtml(head), /aria-sort="ascending"/);
  const sorted = head.VIEW;
  // Same VIEW array, different view (current -> history): sort is scoped to the table id.
  setTable(head, "mrp-governance", IN_TABLES["mrp-governance:sku-mrp-history"].state);
  head.VIEW = sorted;
  assert.doesNotMatch(headerHtml(head), /ascending|descending|▲|▼/);
  // Back to current with the same array: the scoped sort applies again (no cross-tab leak either way).
  setTable(head, "mrp-governance", IN_TABLES["mrp-governance:sku-mrp-current"].state);
  assert.match(headerHtml(head), /aria-sort="ascending"/);
  // Tab switch in cost governance (mapping-register -> excluded), same array.
  const cg = makeSandbox({ source: read(SHELL), flagOn: true });
  setTable(cg, "cost-governance", { cgTab: "mapping-register" });
  cg.VIEW = fixtureRows("cost-governance:mapping-register");
  headerHtml(cg);
  cg.tableHead.buttons[0].click();
  setTable(cg, "cost-governance", { cgTab: "excluded" });
  assert.doesNotMatch(headerHtml(cg), /ascending|descending/);
  // Reload replaces VIEW: cleared.
  setTable(cg, "cost-governance", { cgTab: "mapping-register" });
  cg.VIEW = cg.VIEW.slice();
  assert.doesNotMatch(headerHtml(cg), /ascending|descending/);
});

// 3. Self-check (ii)
test("pkg3 self-check (ii): flag-ON CSV keeps every legacy column and value; order follows sorted VIEW", () => {
  for (const [id, t] of Object.entries(IN_TABLES)) {
    const rows = fixtureRows(id);
    const off = makeSandbox({ source: read(SHELL), flagOn: false });
    const base = makeSandbox({ source: readBase(SHELL), flagOn: false });
    setTable(off, t.lens, t.state);
    setTable(base, t.lens, t.state);
    const offCsv = exportCsv(off, rows.slice());
    assert.equal(offCsv, exportCsv(base, rows.slice()), `${id} OFF identical to base`);
    const header = offCsv.split("\n")[0];
    assert.deepEqual(header.split(",").map((h) => JSON.parse(h)), Object.keys(rows[0]), `${id} all keys`);

    const on = makeSandbox({ source: read(SHELL), flagOn: true });
    setTable(on, t.lens, t.state);
    on.VIEW = rows.slice();
    headerHtml(on);
    on.tableHead.buttons[0].click();
    const sorted = on.VIEW;
    assert.notDeepEqual(sorted.map((r) => r.row_no), [0, 1, 2]);
    const onCsv = exportCsv(on, sorted);
    const legacySorted = exportCsv(base, sorted);
    assert.equal(onCsv.split("\n")[0], header, `${id} header = legacy`);
    assert.equal(onCsv.replace(/"'([=+\-@\t\r])/g, '"$1'), legacySorted, `${id} values = legacy except guard`);
    const keys = Object.keys(rows[0]);
    assert.equal(onCsv, [header, ...sorted.map((r) => keys.map((k) => csvCell(r[k])).join(","))].join("\n"));
    assert.ok(/"'[=+\-@]/.test(onCsv), `${id} guard exercised`);
    assert.ok(!/"'[=+\-@]/.test(offCsv));
  }
});

// 4. Labels and the label safety net
test("pkg3 labels equal the controller header arrays; a mismatched label renders the legacy th", () => {
  for (const [id, t] of Object.entries(IN_TABLES)) {
    const headers = t.headers();
    const cols = tableColumnsForTable(id);
    assert.ok(Object.isFrozen(cols), id);
    assert.equal(cols.length, headers.length, id);
    headers.forEach((h, i) => assert.equal(cols[i].label, h, `${id}[${i}]`));
    const keys = cols.filter((c) => c.key).map((c) => c.key);
    assert.equal(new Set(keys).size, keys.length, `${id} keys unique`);
  }
  assert.ok(Object.isFrozen(TAB_TABLE_COLUMNS));
  const PKG4_TABLE_IDS = ["mrp-governance:applied-history-register", "manual-provisions:impact", "policy-manager:scheme-master"];
  assert.deepEqual(Object.keys(TAB_TABLE_COLUMNS).sort(), [...Object.keys(IN_TABLES), ...PKG4_TABLE_IDS].sort());
  assert.equal(tableColumnsForTable("cost-governance:unmapped"), null);
  // No IN pricing header is "" (pricing branch has no lane-col rule).
  for (const id of Object.keys(IN_TABLES).filter((k) => k.startsWith("mrp-governance") || k.startsWith("policy-manager"))) {
    assert.ok(!IN_TABLES[id].headers().includes(""), id);
  }
  // Deliberate mismatch: rename "Costing Rate" -> "Costing Rate (x)".
  const head = makeSandbox({ source: read(SHELL), flagOn: true });
  setTable(head, "manual-rate-manager", { mrmTab: "register" });
  head.state.headerOverride = MATERIAL.headers.register.map((h) => (h === "Costing Rate" ? "Costing Rate (x)" : h));
  const html = headerHtml(head);
  assert.ok(html.includes(legacyTh("c-right", "Costing Rate (x)")));
  assert.equal(head.tableHead.buttons.length, 8);
  assert.ok(!head.tableHead.buttons.some((b) => b.dataset.cw05Sort === "2"));
});

// 5. sku-control-status SKU / Pack
test("pkg3 sku-control-status: SKU sorts numerically by sku_id, Pack by pack_size; blanks last; controller untouched", () => {
  const cols = tableColumnsFor("sku-control-status");
  const sku = cols.find((c) => c.label === "SKU");
  const pack = cols.find((c) => c.label === "Pack");
  assert.deepEqual([sku.key, sku.type], ["sku_id", "number"]);
  assert.deepEqual([pack.key, pack.type], ["pack_size", "number"]);
  const rows = [{ sku_id: 10 }, { sku_id: "9" }, { sku_id: null }, { sku_id: 100 }, { sku_id: "" }];
  assert.deepEqual(sortRowsBy(rows, sku, "asc").map((r) => r.sku_id), ["9", 10, 100, null, ""]);
  assert.deepEqual(sortRowsBy(rows, sku, "desc").map((r) => r.sku_id), [100, 10, "9", null, ""]);
  const packs = [{ pack_size: 250 }, { pack_size: "--" }, { pack_size: 50 }, { pack_size: undefined }];
  assert.deepEqual(sortRowsBy(packs, pack, "asc").map((r) => r.pack_size), [50, 250, "--", undefined]);
  assert.deepEqual(sortRowsBy(packs, pack, "desc").map((r) => r.pack_size), [250, 50, "--", undefined]);
  assert.equal(git("diff", PKG3_BASE, "--", `${JS}/costing-suite-control-center.js`), "");
});

// 6. Unsortable columns, accessors, no client business logic
test("pkg3 unsortable columns have key null; accessors read raw fields in render order; no client logic", () => {
  const unsortable = {
    "mrp-governance:sku-mrp-history": ["Effective period"],
    "mrp-governance:derivation-current": ["Readiness"],
    "mrp-governance:derivation-history": ["Reference MRP", "Lifecycle", "Effective period"],
    "cost-governance:mapping-register": ["", "Include in Costing"],
    "cost-governance:excluded": ["", "Include in Costing"],
    "manual-rate-manager:register": ["", "Origin"],
    "manual-rate-manager:history": ["", "Origin / Evidence"],
  };
  for (const id of Object.keys(IN_TABLES)) {
    const expected = unsortable[id] || [];
    const actual = tableColumnsForTable(id).filter((c) => !isSortableColumn(c)).map((c) => c.label);
    assert.deepEqual(actual, expected, id);
    tableColumnsForTable(id).filter((c) => !isSortableColumn(c)).forEach((c) => assert.equal(c.key, null, `${id} ${c.label}`));
  }
  assert.equal(allocationPoolSortText({ allocation_pool_label: "Admin", allocation_pool: "ADM" }), "Admin");
  assert.equal(allocationPoolSortText({ allocation_pool_label: "", allocation_pool: "ADM" }), "ADM");
  assert.equal(allocationPoolSortText({}), "");
  assert.equal(costingClassSortText({ costing_class_label: null, costing_class: "DIR" }), "DIR");
  assert.equal(costingClassSortText({ costing_class_label: "Direct", costing_class: "DIR" }), "Direct");
  const src = read(TOOLS);
  assert.doesNotMatch(src, /today|readinessFor|formatDerivationLifecycle|schemeMasterTotalQty|schemeMasterEffectiveDiscount|include_in_costing/i);
});

// 7. Help, module safety, no CSS/HTML
test("pkg3 COLUMN_HELP unchanged; module safety; FORBIDDEN_RPCS identical; no CSS or HTML changed", async () => {
  const baseSrc = readBase(TOOLS);
  const baseMod = await import(`data:text/javascript;base64,${Buffer.from(baseSrc).toString("base64")}`);
  assert.deepEqual(plain(COLUMN_HELP), plain(baseMod.COLUMN_HELP));
  const helpSlice = (s) => s.slice(s.indexOf("export const COLUMN_HELP"), s.indexOf("export function columnHelpFor"));
  assert.equal(helpSlice(read(TOOLS)), helpSlice(baseSrc));
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
  assert.equal(git("diff", "--name-only", PKG3_BASE, "--", "*.css", "*.html").trim(), "");
  for (const f of ["pricing-policy", "cost-build", "material-cost", "control-center"]) {
    assert.equal(git("diff", PKG3_BASE, "--", `${JS}/costing-suite-${f}.js`), "", f);
  }
});

// 8. Cache pin
test("pkg3 sw.js line 2 is the v388 line", () => {
  assert.equal(
    read("public/sw.js").split("\n")[1],
    'const CACHE_NAME = "hub-cache-v389"; // WP-07 e-Aushadhi review UX (UX-1 to UX-10, Bundle A); v388 was Costing review worklist run selector (C1/C1B)',
  );
});
