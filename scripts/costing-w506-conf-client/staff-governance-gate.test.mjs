// WP05-W506 personnel confidentiality: client gate tests (no network, no database). Run:
//   node --test scripts/costing-w506-conf-client/staff-governance-gate.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const rd = (p) => readFileSync(join(root, p), "utf8");
const cb = await import(join(root, "public/shared/js/costing-suite-cost-build.js"));
const SALARY_PARTS = ["basic_salary", "allowance_amount", "employer_contribution", "other_salary_cost"];

// identities reduce to the CBM flags the shell resolves from get_user_permissions (route target = module:cost-build-manager)
const IDS = {
  unauthorised: { view: false, edit: false },
  moduleOnlyViewer: { view: false, edit: false }, // e.g. Cost Sheet Review / MCM view only: no CBM entry => both false
  cbmViewOnly: { view: true, edit: false },
  editWithoutView: { view: false, edit: true },
  authorisedEditor: { view: true, edit: true },
};
const allowed = (id) => id.view === true && id.edit === true; // mirrors personnelAccessAllowed() in the shell

function harness(id, tab) {
  const requests = [];
  const toasts = [];
  const mk = (view) => {
    const q = { view, cols: null, filters: [] };
    const chain = {
      select(c) { q.cols = c; return chain; },
      eq(...a) { q.filters.push(a); return chain; },
      order() { return chain; },
    };
    requests.push(q);
    return chain;
  };
  const row = { staff_id: 7, employee_code: "SYN-007", staff_display_name: "Synthetic", designation: "Role", classification_status: "CLASSIFIED",
    total_salary_cost: 1, costing_class: "PACKING", costing_class_label: "Packing", allocation_pool: "PACKING_LABOUR", effective_from: "2026-01-01", allocation_weight: 1, remarks: "r" };
  const ctrl = cb.createCostBuildController({
    dom: { staffClassificationEditModal: { classList: { remove() {}, add() {} }, setAttribute() {} } },
    costingFrom: mk, costingRpc: async () => ({ error: null }),
    fetchAllRows: async (build) => { build(); return []; },
    showToast: (m, t) => toasts.push([m, t]), handleError() {}, setLoadingMask() {}, setVisible() {},
    text: (v) => String(v ?? ""), escapeHtml: (v) => String(v ?? ""), formatMoney: (v) => String(v ?? ""), formatNumber: (v) => String(v ?? ""),
    formatDate: (v) => String(v ?? ""), formatDateTime: (v) => String(v ?? ""), compactStatusText: (v) => String(v ?? ""), normalizeStatus: (v) => String(v ?? "").toUpperCase(),
    cpCellPrimary: (v) => String(v ?? ""), cpCellPrimaryHtml: (v) => String(v ?? ""), detailPanel() {}, kvSection() {}, activePeriodIso: () => "2026-11-01",
    numberOrNullFromInput: Number, normalizeMonthStart: (v) => v, getCurrentMonthStart: () => "2026-11-01", reloadRows: async () => {}, renderTable() {},
    updateSearchClear() {}, getSearchValue: () => "", getCurrentLens: () => "staff-governance", setRowsAndView() {}, closeDetails() {}, getActivePeriodStart: () => "2026-11-01",
    canViewPersonnel: () => allowed(id), canEditPersonnel: () => allowed(id),
  });
  return { ctrl, requests, toasts, row };
}
// the tab is internal controller state; drive it through the exported tab renderer's callback
async function withTab(id, tab) {
  const h = harness(id, tab);
  const el = { classList: { add() {} }, innerHTML: "", querySelectorAll: () => [{ dataset: { staffGovernanceTab: tab }, addEventListener(_e, fn) { this.fn = fn; }, }] };
  h.ctrl.renderStaffGovernanceTabs(el, async () => {});
  const btn = el.querySelectorAll()[0];
  if (btn.fn) await btn.fn();
  return h;
}

test("exports and fail-closed defaults exist", () => {
  assert.ok(cb.STAFF_GOVERNANCE_COLUMNS && cb.STAFF_GOVERNANCE_RESTRICTED_NOTICE);
  const h = harness({ view: true, edit: true });
  assert.equal(typeof h.ctrl.getStaffGovernanceRestrictionNotice, "function");
  const bare = cb.createCostBuildController({ dom: {}, costingFrom() { throw new Error("must not be called"); }, fetchAllRows: async (b) => b(), getCurrentLens: () => "staff-governance", getActivePeriodStart: () => "x", showToast() {}, escapeHtml: String, text: String });
  assert.equal(bare.getStaffGovernanceRestrictionNotice(), cb.STAFF_GOVERNANCE_RESTRICTED_NOTICE, "no deps => personnel access denied");
});

test("projections never request salary components, staff_details or *", () => {
  for (const [k, cols] of Object.entries(cb.STAFF_GOVERNANCE_COLUMNS)) {
    assert.ok(!cols.includes("*"), k);
    for (const bad of [...SALARY_PARTS, "staff_details"]) assert.ok(!cols.split(",").includes(bad), `${k} must not include ${bad}`);
  }
  assert.ok(!cb.STAFF_GOVERNANCE_COLUMNS.pool.includes("salary"), "pool projection is aggregates only");
  const src = rd("public/shared/js/costing-suite-cost-build.js");
  const loader = src.slice(src.indexOf("async function loadStaffGovernanceRows"), src.indexOf("/** Revoke displayed edit access"));
  assert.ok(!loader.includes('select("*")'), "Staff Governance loader must not use select('*')");
});

for (const [name, id] of Object.entries(IDS)) {
  test(`${name}: register and review tabs issue ${allowed(id) ? "a projected request" : "NO request"}`, async () => {
    for (const tab of ["staff-register", "staff-review"]) {
      const h = harness(id);
      // tab defaults to staff-review; switch via renderer for the register tab
      if (tab === "staff-register") {
        const btn = { dataset: { staffGovernanceTab: "staff-register" }, addEventListener(_e, fn) { this.fn = fn; } };
        h.ctrl.renderStaffGovernanceTabs({ classList: { add() {} }, set innerHTML(_v) {}, querySelectorAll: () => [btn] }, async () => {});
        await btn.fn?.();
      }
      await h.ctrl.loadStaffGovernanceRows("2026-11-01");
      if (allowed(id)) {
        assert.equal(h.requests.length, 1);
        assert.ok(!h.requests[0].cols.includes("*"));
        for (const bad of SALARY_PARTS) assert.ok(!h.requests[0].cols.includes(bad));
      } else {
        assert.equal(h.requests.length, 0, `${name}/${tab}: no network request for personnel views`);
        assert.equal(h.ctrl.getStaffGovernanceRestrictionNotice(), cb.STAFF_GOVERNANCE_RESTRICTED_NOTICE);
      }
    }
  });
  test(`${name}: edit control rendered only for the authorised editor`, () => {
    const h = harness(id);
    for (const tabRow of [h.ctrl.renderTableRow("staff-governance", h.row, "", 0)]) {
      assert.equal(tabRow.includes("data-edit-staff-classification-index"), allowed(id));
      if (!allowed(id)) assert.ok(tabRow.includes("View only"));
    }
  });
  test(`${name}: edit modal and save path are denied without personnel edit permission`, () => {
    const h = harness(id);
    try { h.ctrl.openStaffClassificationEditModal(h.row); } catch { /* editor path reaches DOM-only modal code the stub does not provide */ }
    const denied = h.toasts.some(([m, t]) => /permission/i.test(m) && t === "error");
    assert.equal(denied, !allowed(id), "permission-denied toast iff the caller is not the authorised editor");
    const tb = { n: 0, querySelectorAll: () => { tb.n++; return []; } };
    h.ctrl.wireStaffGovernanceTableActions(tb, () => null);
    assert.equal(tb.n, allowed(id) ? 1 : 0, "no click handlers are wired without edit permission");
  });
}

test("pool summary (aggregates) stays available to every identity, with an aggregate-only projection", async () => {
  for (const id of Object.values(IDS)) {
    const h = harness(id);
    const btn = { dataset: { staffGovernanceTab: "staff-pool-summary" }, addEventListener(_e, fn) { this.fn = fn; } };
    h.ctrl.renderStaffGovernanceTabs({ classList: { add() {} }, set innerHTML(_v) {}, querySelectorAll: () => [btn] }, async () => {});
    await btn.fn?.();
    await h.ctrl.loadStaffGovernanceRows("2026-11-01");
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].view, "v_costing_staff_cost_pool_summary");
    assert.equal(h.requests[0].cols, cb.STAFF_GOVERNANCE_COLUMNS.pool);
    assert.equal(h.ctrl.getStaffGovernanceRestrictionNotice(), "");
  }
});

test("shell wiring: personnel gate = CBM route + view AND edit + no permission-load error; restricted rows purged; export guarded", () => {
  const sh = rd("public/shared/js/costing-suite-shell.js");
  assert.match(sh, /function personnelAccessAllowed\(\) \{\s*return \(\s*PERMISSIONS_LOAD_ERROR !== true &&\s*ACTIVE_ROUTE_CONFIG\?\.permissionTarget === "module:cost-build-manager" &&\s*PERM_CAN_VIEW === true &&\s*PERM_CAN_EDIT === true\s*\);/);
  assert.ok(sh.includes("canViewPersonnel: () => personnelAccessAllowed()") && sh.includes("canEditPersonnel: () => personnelAccessAllowed()"));
  const i = sh.indexOf('if (CURRENT_LENS === "staff-governance") {\n      const rows = await costBuildCtrl.loadStaffGovernanceRows');
  assert.ok(i > 0);
  const blk = sh.slice(i, i + 900);
  assert.ok(blk.includes("ALL_ROWS = [];") && blk.includes("VIEW = [];") && blk.includes("purgeStaffGovernanceState()"));
  const ex = sh.slice(sh.indexOf('exportBtn?.addEventListener("click", () => {'));
  assert.ok(ex.slice(0, 500).includes('CURRENT_LENS === "staff-governance"') && ex.slice(0, 600).includes("return;") && ex.slice(0, 800).includes("void exportActiveViewCsv();"));
});

test("late personnel response is re-authorised before staff rows reach table state or rendering", () => {
  const sh = rd("public/shared/js/costing-suite-shell.js");
  const start = sh.indexOf('if (CURRENT_LENS === "staff-governance") {\n      const rows = await costBuildCtrl.loadStaffGovernanceRows');
  assert.ok(start > 0, "staff loading branch present");
  const end = sh.indexOf("LAST_REFRESH_TIME = new Date();", start);
  const block = sh.slice(start, end);
  const gate = block.indexOf("const restrictedNotice = costBuildCtrl.getStaffGovernanceRestrictionNotice();");
  const restricted = block.indexOf("if (restrictedNotice)", gate);
  const permitted = block.indexOf("} else {", restricted);
  const assignment = block.indexOf("ALL_ROWS = rows;", permitted);
  assert.ok(gate > 0 && restricted > gate && permitted > restricted && assignment > permitted,
    "response gate must run before assigning any fetched personnel rows");
  assert.equal(block.slice(0, gate).includes("ALL_ROWS = rows;"), false, "no speculative render before permission check");
  assert.ok(block.slice(restricted, permitted).includes("ALL_ROWS = [];"));
  assert.ok(block.slice(restricted, permitted).includes("VIEW = [];"));
  assert.ok(block.slice(restricted, permitted).includes("purgeStaffGovernanceState()"));
});
test("permission refresh invalidates outstanding staff responses and clears visible staff state", () => {
  const sh = rd("public/shared/js/costing-suite-shell.js");
  const start = sh.indexOf("async function loadPermissions(sessionUserId) {");
  const reset = sh.indexOf("PERM_CAN_VIEW = false;", start);
  const pre = sh.slice(start, reset);
  assert.ok(pre.includes('CURRENT_LENS === "staff-governance"'));
  for (const token of ["++ROWS_LOAD_GENERATION", "ALL_ROWS = []", "VIEW = []",
    "purgeStaffGovernanceState()", "tableBody.replaceChildren()"]) {
    assert.ok(pre.includes(token), `permission refresh must clear: ${token}`);
  }
  const cb = rd("public/shared/js/costing-suite-cost-build.js");
  const purgeStart = cb.indexOf("function purgeStaffGovernanceState()");
  const purgeBody = cb.slice(purgeStart, cb.indexOf("\n  function syncManualProvisionLayout()", purgeStart));
  assert.ok(purgeBody.includes("closeStaffClassificationEditModal()"), "open edit modal must close on permission loss");
  assert.ok(purgeBody.includes("staffClassificationEditRow = null;"));
});
test("service worker never caches Supabase data responses; cache generation advanced so clients receive the gated JS", () => {
  const sw = rd("public/sw.js");
  assert.match(sw, /supabase\|\\\/\(rest\|realtime\|storage\|auth\)/);
  assert.ok(Number(/hub-cache-v(\d+)/.exec(sw)[1]) >= 393);
});
