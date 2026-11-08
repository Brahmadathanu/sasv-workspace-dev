// CW-05 package 4: table tools for the MRP applied-history register, the
// manual-provisions impact tab and scheme-master raw columns, plus the L1
// lock-screen diff guard. node:test only, no deps, no network. Same sandbox
// approach as table-tools-pkg3.test.mjs (real shell functions in node:vm).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { costingScopeReport, applyCw07Labels } from "../lib/costing-scope-guard.mjs";
import * as tools from "../../public/shared/js/costing-table-tools.js";
import { readSourceLf } from "../lib/read-source-lf.mjs";
import { stripN1 } from "../lib/n1-nav-strip.mjs";
import { stripN2 } from "../lib/n2-nav-strip.mjs";
import { stripW6 } from "../lib/w6-nav-strip.mjs";
import { stripLockP01Controller } from "../lib/sec-a2-strip.mjs";

const { COLUMN_HELP, csvCell, isSortableColumn, sortRowsBy, tableColumnsForTable } = tools;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Historical pre-N1 comparison reader: LF-normalised source with ONLY the flag-gated MDC-07 N1 additions removed from the
// shell and feature-flag files (scripts/lib/n1-nav-strip.mjs). readSourceLf itself is unchanged and strips nothing.
const read = (rel) => stripN1(rel, readSourceLf(root, rel));
const BASE = "2b3f298bdba5f4fa9f1045fe1539a38c58b5c719";
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const readBase = (rel) => applyCw07Labels(git("show", `${BASE}:${rel}`)); // CW-07: label rename tolerated, nothing else
const SHELL = "public/shared/js/costing-suite-shell.js";
const TOOLS = "public/shared/js/costing-table-tools.js";
const LOCK = "public/shared/js/costing-lock-screen.js";
const JS = "public/shared/js";

// ---- Real header constants/functions from the controller sources ----
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
const fnsFrom = (src, names, prelude = "") => {
  const ctx = vm.createContext({});
  vm.runInContext(prelude + names.map((n) => extractFn(src, n)).join("\n"), ctx);
  return Object.fromEntries(names.map((n) => [n, (...a) => plain(ctx[n](...a))]));
};
const appliedSrc = read(`${JS}/costing-suite-mrp-applied-history.js`);
const APPLIED = {
  register: [constArray(appliedSrc, "REGISTER_HEADERS"), constArray(appliedSrc, "REGISTER_ALIGNMENTS")],
  workspace: [constArray(appliedSrc, "LINE_HEADERS"), constArray(appliedSrc, "LINE_ALIGNMENTS")],
};
const PM = fnsFrom(
  read(`${JS}/costing-suite-pricing-policy.js`),
  ["policyManagerHeaders", "policyManagerAlignments"],
  'const COMMERCIAL_SALES_ASSUMPTIONS_WORKSPACE_ID = "commercial-sales-assumptions";\n',
);
const BUILD = fnsFrom(read(`${JS}/costing-suite-cost-build.js`), [
  "costGovernanceHeaders",
  "costGovernanceAlignments",
  "staffGovernanceHeaders",
  "staffGovernanceAlignments",
  "manualProvisionHeaders",
  "manualProvisionAlignments",
]);
const WORKFLOW = [["Proposal", "Product", "Status"], ["c-left", "c-left", "c-left"]];

// ---- Mock controllers driven by the real getter values ----
function makeControllers(state) {
  const mrp = () => state.mrpTab;
  const pricingPolicyCtrl = {
    isSkuMrpPoliciesTabActive: () => mrp() === "sku-mrp-policies",
    isProductDerivationPoliciesTabActive: () => mrp() === "product-derivation-policies",
    isMrpProposalsTabActive: () => mrp() === "mrp-proposals",
    isMrpDecisionsTabActive: () => mrp() === "mrp-decisions",
    isMrpApplicationTabActive: () => mrp() === "mrp-application",
    isMrpAppliedHistoryTabActive: () => mrp() === "mrp-applied-history",
    getMrpAppliedHistoryView: () => state.ahView,
    getSkuMrpPolicyView: () => "current",
    getProductDerivationPolicyView: () => "current",
    getPolicyManagerTab: () => state.pmTab,
    isCommercialSalesAssumptionsTabActive: () => state.pmTab === "commercial-sales-assumptions",
    pick(lens) {
      if (lens === "mrp-governance") {
        if (mrp() === "mrp-applied-history") return state.ahView === "workspace" ? APPLIED.workspace : APPLIED.register;
        return WORKFLOW;
      }
      if (lens === "policy-manager") return [PM.policyManagerHeaders(state.pmTab), PM.policyManagerAlignments(state.pmTab)];
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
    getTableHeaders: () => ["", "Stock Item", "Rate"],
    getTableAlignments: () => ["c-center", "c-left", "c-right"],
  };
  return { pricingPolicyCtrl, costBuildCtrl, materialCostCtrl };
}

const IN_TABLES = {
  "mrp-governance:applied-history-register": { lens: "mrp-governance", state: { mrpTab: "mrp-applied-history", ahView: "register" }, headers: () => APPLIED.register[0], buttons: 8 },
  "manual-provisions:impact": { lens: "manual-provisions", state: { mpTab: "impact" }, headers: () => BUILD.manualProvisionHeaders("impact"), buttons: 8 },
  "policy-manager:scheme-master": { lens: "policy-manager", state: { pmTab: "scheme-master" }, headers: () => PM.policyManagerHeaders("scheme-master"), buttons: 3 },
};
const OUT_TABS = [
  ["applied-history workspace view", "mrp-governance", { mrpTab: "mrp-applied-history", ahView: "workspace" }],
  ["mrp proposals", "mrp-governance", { mrpTab: "mrp-proposals" }],
  ["mrp decisions", "mrp-governance", { mrpTab: "mrp-decisions" }],
  ["mrp application", "mrp-governance", { mrpTab: "mrp-application" }],
  ["policy-manager commercial-sales-assumptions", "policy-manager", { pmTab: "commercial-sales-assumptions" }],
  ["cost-governance unmapped", "cost-governance", { cgTab: "unmapped" }],
  ["staff-governance staff-review", "staff-governance", { sgTab: "staff-review" }],
  ["staff-governance staff-register", "staff-governance", { sgTab: "staff-register" }],
  ["manual-provisions register", "manual-provisions", { mpTab: "register" }],
  ["manual-rate-manager action-queue", "manual-rate-manager", { mrmTab: "action-queue" }],
  ["rm-cost-trace", "rm-cost-trace", { mrmTab: "register" }],
  ["pm-cost-trace", "pm-cost-trace", { mrmTab: "history" }],
];
const DEFAULT_STATE = { mrpTab: "sku-mrp-policies", ahView: "register", pmTab: "sku-overview", cgTab: "unmapped", sgTab: "staff-review", mpTab: "register", mrmTab: "action-queue", headerOverride: null };

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

function makeSandbox({ source, flagOn }) {
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
  const names = ["escapeHtml", "text", "getRowStatus", "renderTableHeaderForLens", "exportActiveViewCsv", "exportCsvForRows", "renderCw05GenericTableHeader", "exportCw05CsvForView", "cw05TabTableId"];
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

// Value cycles are in descending sort order, so no rotation is ascending:
// sorting any column ascending always reorders the three rows.
const VALUES = { number: [30, 10, null], date: ["2026-03-01", "2025-12-01T05:00:00+00:00", null], text: ["zeta", "alpha", "=mid"] };
const ACCESSOR_FIELDS = {
  allocation_pool_label: (i) => ({ allocation_pool_label: ["Zone B", null, "Admin"][i], allocation_pool: ["ZB", "MFG", "ADM"][i] }),
};
function fixtureRows(tableId) {
  const cols = tableColumnsForTable(tableId);
  return [0, 1, 2].map((i) => {
    const row = { row_no: i, proposal_id: 70 + i, proposal_number: ["P-3", null, "P-1"][i], product_id: 5 + i };
    cols.forEach((c, ci) => {
      if (!c.key) return;
      if (typeof c.get === "function") Object.assign(row, ACCESSOR_FIELDS[c.key](i));
      else row[c.key] = VALUES[c.type][(i + ci) % 3];
    });
    row.note = ["+x", "@y", "plain"][i];
    return row;
  });
}

// 1. Flag OFF identity
test("pkg4 flag OFF: IN tables and the applied-history workspace view render the base header", () => {
  const base = makeSandbox({ source: readBase(SHELL), flagOn: false });
  const head = makeSandbox({ source: read(SHELL), flagOn: false });
  const cases = [...Object.values(IN_TABLES).map((t) => [t.lens, t.state]), ...OUT_TABS.map(([, l, st]) => [l, st])];
  for (const [lens, st] of cases) {
    setTable(base, lens, st);
    setTable(head, lens, st);
    const b = headerHtml(base);
    assert.ok(b.startsWith("<tr>"), `${lens} ${JSON.stringify(st)}`);
    assert.equal(headerHtml(head), b, `${lens} ${JSON.stringify(st)}`);
    assert.doesNotMatch(headerHtml(head), /data-cw05-sort|aria-sort|<button/);
  }
});

// 2. Self-check: real screens reach the new code
test("pkg4 flag ON: IN tables render sort buttons; click sorts VIEW; row index maps to sorted row", () => {
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
      assert.equal(head.CURRENT_PAGE, 1);
      const col = cols[Number(btn.dataset.cw05Sort)];
      assert.deepEqual(Array.from(head.VIEW, (r) => r.row_no), sortRowsBy(rows, col, "asc").map((r) => r.row_no), `${id} ${col.label}`);
      assert.notDeepEqual(Array.from(head.VIEW, (r) => r.row_no), [0, 1, 2], `${id} ${col.label} reorders`);
      assert.match(headerHtml(head), new RegExp(`aria-sort="ascending"><button type="button" data-cw05-sort="${btn.dataset.cw05Sort}">`));
      head.VIEW.forEach((row, idx) => {
        const tr = { dataset: { rowIndex: String(idx) } };
        assert.equal(head.VIEW[Number(tr.dataset.rowIndex)], row);
      });
    }
  }
});

test("pkg4 flag ON: OUT tabs (incl. applied-history workspace) get 0 buttons and the legacy header", () => {
  for (const [name, lens, st] of OUT_TABS) {
    const head = makeSandbox({ source: read(SHELL), flagOn: true });
    const base = makeSandbox({ source: readBase(SHELL), flagOn: false });
    setTable(head, lens, st);
    setTable(base, lens, st);
    assert.equal(vm.runInContext("cw05TabTableId()", head), null, name);
    assert.equal(headerHtml(head), headerHtml(base), name);
    assert.equal(head.tableHead.buttons.length, 0, name);
  }
});

test("pkg4 flag ON: switching tab or view with a sort active shows no stale aria-sort", () => {
  // Applied history: register (sorted) -> workspace -> register with the same array.
  const ah = makeSandbox({ source: read(SHELL), flagOn: true });
  setTable(ah, "mrp-governance", IN_TABLES["mrp-governance:applied-history-register"].state);
  ah.VIEW = fixtureRows("mrp-governance:applied-history-register");
  headerHtml(ah);
  ah.tableHead.buttons[0].click();
  assert.match(headerHtml(ah), /aria-sort="ascending"/);
  setTable(ah, "mrp-governance", { mrpTab: "mrp-applied-history", ahView: "workspace" });
  assert.doesNotMatch(headerHtml(ah), /aria-sort|▲|▼/);
  // Reload replaces VIEW: back on register the sort is cleared.
  setTable(ah, "mrp-governance", IN_TABLES["mrp-governance:applied-history-register"].state);
  ah.VIEW = ah.VIEW.slice();
  assert.doesNotMatch(headerHtml(ah), /ascending|descending/);
  // Scheme master (sorted) -> SKU overview (a sortable table) with the same array.
  const pm = makeSandbox({ source: read(SHELL), flagOn: true });
  setTable(pm, "policy-manager", { pmTab: "scheme-master" });
  pm.VIEW = fixtureRows("policy-manager:scheme-master");
  headerHtml(pm);
  pm.tableHead.buttons[0].click();
  assert.match(headerHtml(pm), /aria-sort="ascending"/);
  setTable(pm, "policy-manager", { pmTab: "sku-overview" });
  assert.doesNotMatch(headerHtml(pm), /ascending|descending/);
  // Manual provisions impact (sorted) -> register tab with the same array.
  const mp = makeSandbox({ source: read(SHELL), flagOn: true });
  setTable(mp, "manual-provisions", { mpTab: "impact" });
  mp.VIEW = fixtureRows("manual-provisions:impact");
  headerHtml(mp);
  mp.tableHead.buttons[0].click();
  setTable(mp, "manual-provisions", { mpTab: "register" });
  assert.doesNotMatch(headerHtml(mp), /aria-sort/);
});

// 3. CSV
test("pkg4 flag ON: CSV keeps every legacy column and value; order follows sorted VIEW", () => {
  for (const [id, t] of Object.entries(IN_TABLES)) {
    const rows = fixtureRows(id);
    const base = makeSandbox({ source: readBase(SHELL), flagOn: false });
    const off = makeSandbox({ source: read(SHELL), flagOn: false });
    setTable(base, t.lens, t.state);
    setTable(off, t.lens, t.state);
    const offCsv = exportCsv(off, rows.slice());
    assert.equal(offCsv, exportCsv(base, rows.slice()), `${id} OFF identical`);
    const header = offCsv.split("\n")[0];
    assert.deepEqual(header.split(",").map((h) => JSON.parse(h)), Object.keys(rows[0]));
    const on = makeSandbox({ source: read(SHELL), flagOn: true });
    setTable(on, t.lens, t.state);
    on.VIEW = rows.slice();
    headerHtml(on);
    on.tableHead.buttons[0].click();
    const sorted = on.VIEW;
    assert.notDeepEqual(Array.from(sorted, (r) => r.row_no), [0, 1, 2]);
    const onCsv = exportCsv(on, sorted);
    assert.equal(onCsv.split("\n")[0], header);
    assert.equal(onCsv.replace(/"'([=+\-@\t\r])/g, '"$1'), exportCsv(base, sorted));
    const keys = Object.keys(rows[0]);
    assert.equal(onCsv, [header, ...Array.from(sorted, (r) => keys.map((k) => csvCell(r[k])).join(","))].join("\n"));
    assert.ok(/"'[=+\-@]/.test(onCsv));
  }
});

// 4. Labels and the mismatch safety net
test("pkg4 labels equal the controller header arrays; a mismatched label renders the legacy th", () => {
  for (const [id, t] of Object.entries(IN_TABLES)) {
    const headers = t.headers();
    const cols = tableColumnsForTable(id);
    assert.ok(Object.isFrozen(cols));
    assert.equal(cols.length, headers.length, id);
    headers.forEach((h, i) => assert.equal(cols[i].label, h, `${id}[${i}]`));
  }
  const head = makeSandbox({ source: read(SHELL), flagOn: true });
  setTable(head, "manual-provisions", { mpTab: "impact" });
  head.state.headerOverride = BUILD.manualProvisionHeaders("impact").map((h) => (h === "Staff Amount" ? "Staff Amount (x)" : h));
  const html = headerHtml(head);
  assert.ok(html.includes('<th class="c-right">Staff Amount (x)</th>'));
  assert.equal(head.tableHead.buttons.length, 7);
  // Scheme-master row template has no per-row button (table stays read-only).
  const pp = read(`${JS}/costing-suite-pricing-policy.js`);
  const rowTpl = pp.slice(pp.indexOf('if (getPolicyManagerTab() === "scheme-master") {\n        const paid'), pp.indexOf("</tr>`;", pp.indexOf('if (getPolicyManagerTab() === "scheme-master") {\n        const paid')));
  assert.ok(rowTpl.length > 100);
  assert.doesNotMatch(rowTpl, /<button/);
});

// 5. Unsortable columns, diffs and safety
test("pkg4 unsortable columns key null; table-tools diff is only the three entries; lock-screen diff is exactly L1", async () => {
  const unsortable = {
    "mrp-governance:applied-history-register": ["Proposal", "Trace status"],
    "manual-provisions:impact": [],
    "policy-manager:scheme-master": ["Scheme", "Total Qty", "Effective Free Discount %", "Status", "Type", "Active Direct Policies", "Active Hierarchy Rules", "Viability Periods"],
  };
  for (const [id, labels] of Object.entries(unsortable)) {
    const cols = tableColumnsForTable(id);
    assert.deepEqual(cols.filter((c) => !isSortableColumn(c)).map((c) => c.label), labels, id);
    cols.filter((c) => !isSortableColumn(c)).forEach((c) => assert.equal(c.key, null));
  }
  const src = read(TOOLS);
  assert.doesNotMatch(src, /supabase|\.rpc\(|new Date|Date\.now|fetch\(/);
  assert.doesNotMatch(src, /today|readinessFor|lifecycle\(|registerTraceHint|schemeMasterTotalQty|schemeMasterEffectiveDiscount/i);
  // costing-table-tools.js: only added lines, all inside the three new TAB_TABLE_COLUMNS entries.
  const toolsDiff = git("diff", "-U0", BASE, "--", TOOLS).split("\n");
  assert.ok(!toolsDiff.some((l) => l.startsWith("-") && !l.startsWith("---")));
  const addedTools = toolsDiff.filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1)).join("\n");
  const baseTools = readBase(TOOLS);
  assert.equal(src.replace(addedTools + "\n", ""), baseTools);
  for (const id of Object.keys(IN_TABLES)) assert.ok(addedTools.includes(`"${id}": Object.freeze([`), id);
  assert.equal((addedTools.match(/Object\.freeze\(\[/g) || []).length, 3);
  const baseMod = await import(`data:text/javascript;base64,${Buffer.from(baseTools).toString("base64")}`);
  assert.deepEqual(plain(COLUMN_HELP), plain(baseMod.COLUMN_HELP));
  // costing-lock-screen.js: exactly the L1 hunk. LOCK-P01 (issue #211) later added the CCC-edit guard; that text is reversed by its own strict strip helper first.
  const L1_BEFORE = "      await reload();\n";
  const L1_AFTER = "      try {\n        await reload();\n      } catch {\n        showToast?.(\"Period lock recorded, but the period list could not refresh. Reload the page to see it.\", \"error\");\n      }\n";
  const baseLock = readBase(LOCK);
  assert.equal(baseLock.split(L1_BEFORE).length, 2, "L1 anchor occurs once in the base");
  assert.equal(stripLockP01Controller(read(LOCK)), baseLock.replace(L1_BEFORE, () => L1_AFTER));
  // Shell (feature-scoped, C1): cw05TabTableId() equals its base text plus exactly the pkg 4 additions;
  // the lock wiring is untouched. Other shell features are checked by their own suites.
  const PKG4_SHELL_ADDITIONS = [
    '    if (pricingPolicyCtrl.isMrpAppliedHistoryTabActive()) {\n      return pricingPolicyCtrl.getMrpAppliedHistoryView() !== "workspace"\n        ? "mrp-governance:applied-history-register"\n        : null;\n    }\n',
    '    if (tab === "scheme-master") return "policy-manager:scheme-master";\n',
    '  if (CURRENT_LENS === "manual-provisions") {\n    return costBuildCtrl.getManualProvisionTab() === "impact" ? "manual-provisions:impact" : null;\n  }\n',
  ];
  let fnText = extractFn(read(SHELL), "cw05TabTableId");
  for (const add of PKG4_SHELL_ADDITIONS) {
    assert.equal(fnText.split(add).length, 2, add);
    fnText = fnText.replace(add, "");
  }
  assert.equal(fnText, extractFn(readBase(SHELL), "cw05TabTableId"));
  assert.ok(read(SHELL).includes("const costingLockScreenCtrl = isCostingLockScreenV1Enabled()"));
  // FORBIDDEN_RPCS, controllers, CSS/HTML, supabase, package.
  const rel = `${JS}/costing-approval-screen.js`;
  const slice = (s) => {
    const i = s.indexOf("export const FORBIDDEN_RPCS");
    return s.slice(i, s.indexOf("]);", i) + 3);
  };
  assert.equal(slice(read(rel)), slice(readBase(rel)));
  const controllers = ["control-center", "pricing-policy", "cost-build", "material-cost", "mrp-applied-history"].map((f) => `${JS}/costing-suite-${f}.js`);
  // costing-review-worklist.js is changed by C1 and covered by scripts/costing-review-worklist/run-context.test.mjs.
  // Scope guard (WP-07 Bundle B correction): HTML/CSS/supabase/package.json checks cover what Costing owns or
  // depends on (scripts/lib/costing-scope-guard.mjs) instead of the whole repository, so unrelated modules that
  // land on main later (e.g. WP-07 e-Aushadhi HTML/CSS and its own migration) no longer trip this package test.
  // MDC-07 N2: cost-build and material-cost may carry only the flag-gated N2 additions (scripts/lib/n2-nav-strip.mjs).
  // MDC-07 W6: the PPM controller may carry only the flag-gated W6 five-group projection (scripts/lib/w6-nav-strip.mjs).
  const n2Controllers = controllers.filter((c) => /cost-build|material-cost|pricing-policy/.test(c));
  for (const c of n2Controllers) assert.equal(stripW6(c, stripN2(c, read(c))), git("show", `${BASE}:${c}`).replace(/\r\n/g, "\n"), c);
  assert.equal(git("diff", BASE, "--", ...controllers.filter((c) => !n2Controllers.includes(c))), "");
  assert.ok(readSourceLf(root, `${JS}/costing-feature-flags.js`).includes("COSTING_NAV_GROUPS_V1"), "plain source read still contains the N1 flag");
  assert.equal(read(`${JS}/costing-feature-flags.js`), git("show", `${BASE}:${JS}/costing-feature-flags.js`).replace(/\r\n/g, "\n"), "feature flags unchanged apart from the N1 append");
  const scope = costingScopeReport({ git, root, base: BASE });
  assert.deepEqual(scope.supabase, [], "no Costing or history-rewriting supabase change");
  assert.deepEqual(scope.packageJson, [], "package.json unchanged");
  // Reconciled with UX-F1 (#121): within the Costing CSS scope only public/shared/css/sasv-costing.css may
  // change, and only append-only since base (later features append their own scoped blocks).
  assert.deepEqual(scope.css.filter((f) => f !== "public/shared/css/sasv-costing.css"), [], "no other Costing or shared-contract CSS changed");
  const cssBase = git("show", `${BASE}:public/shared/css/sasv-costing.css`);
  assert.ok(read("public/shared/css/sasv-costing.css").startsWith(cssBase), "sasv-costing.css append-only since base");
  assert.deepEqual(scope.html, [], "no Costing HTML changed");
});

// 6. Cache pin
test("pkg4 sw.js line 2 is the current v391 line (v390 UX-F1 release is kept in its comment)", () => {
  assert.equal(
    read("public/sw.js").split("\n")[1],
    'const CACHE_NAME = "hub-cache-v391"; // Costing #208 mobile Evidence-table scroll CSS; v390 was Costing UX-F1 Dashboard and compact CCC; v389 was WP-07 e-Aushadhi review UX (UX-1 to UX-10, Bundle A)',
  );
});
