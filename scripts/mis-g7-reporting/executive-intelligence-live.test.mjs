// Executive Intelligence live-contract client integration (R3/R4 installed 2026-11-26). Pure model + registry fixtures always run;
// browser tests run against the MIS-C1 in-page Supabase mock (skipped, not failed, without Playwright). Synthetic data only:
// this is NOT production acceptance and it never touches a database.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  HIERARCHY_LEVELS, emptyHierarchy, hierarchyOptions, reconcileHierarchy, hierarchyArgs, hierarchyActive, hierarchyLabels, exportScopeLine,
  refreshJobModel, refreshFreshnessModel, facilityModel, HISTORY_GROUPS,
} from "../../public/shared/js/executive-intelligence-model.js";
import { launchBrowser, openDashboard, startServer, calls, WIDTHS } from "../mis-c1/mis-harness.mjs";

const root = new URL("../../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8").replace(/\r\n/g, "\n"); // line-ending neutral: a Windows checkout may hold CRLF

// module-registry.js imports the browser-only Supabase client from a CDN URL; the pure registry logic is loaded with that one import stubbed.
const { getModuleAccessLevel, buildPermissionMap } = await import(`data:text/javascript;base64,${Buffer.from(read("public/shared/js/module-registry.js").replace(/^import \{ supabase \} from "\.\/supabaseClient\.js";/, "const supabase = null;")).toString("base64")}`);

const DIMS = {
  categories: [{ id: 1, name: "Medicines" }, { id: 2, name: "Cosmetics" }],
  subcategories: [{ id: 11, category_id: 1, name: "Kashayam" }, { id: 12, category_id: 1, name: "Arishtam" }, { id: 21, category_id: 2, name: "Oils" }],
  groups: [{ id: 111, subcategory_id: 11, name: "Group A" }, { id: 121, subcategory_id: 12, name: "Group B" }, { id: 211, subcategory_id: 21, name: "Group C" }],
  subgroups: [{ id: 1111, group_id: 111, name: "Sub X" }, { id: 1112, group_id: 111, name: "Sub Y" }, { id: 2111, group_id: 211, name: "Sub Z" }],
};

// ---------------------------------------------------------------------------------------------------------- launcher / registry
test("launcher: legacy Sales Viewer permissions never open Executive Intelligence; independent executive checks unchanged", () => {
  const exec = { moduleKey: "executive-mis-dashboard", minNavMode: "view" };
  const map = (...rows) => buildPermissionMap(rows.map(([target, can_view, can_edit]) => ({ target, can_view, can_edit })));
  assert.equal(getModuleAccessLevel(exec, map(["module:sales-data-viewer", true, false])), "none", "legacy view does not authorize EI");
  assert.equal(getModuleAccessLevel({ ...exec, minNavMode: "read" }, map(["module:sales-viewer", true, false])), "none", "legacy alias does not authorize EI");
  assert.equal(getModuleAccessLevel({ ...exec, minNavMode: "edit" }, map(["module:sales-data-viewer", true, false])), "none", "min_nav_mode edit still hides it, as for executives");
  assert.equal(getModuleAccessLevel(exec, map(["module:sales-data-viewer", false, false])), "none", "no sales view => no entry");
  assert.equal(getModuleAccessLevel(exec, map()), "none"); assert.equal(getModuleAccessLevel(exec, undefined), "none");
  assert.equal(getModuleAccessLevel(exec, map(["module:sales-data-viewer", true, true])), "none", "legacy edit does not authorize EI");
  // existing executive behaviour exactly as before
  assert.equal(getModuleAccessLevel(exec, map(["module:executive-mis-dashboard", true, false])), "view");
  assert.equal(getModuleAccessLevel({ ...exec, minNavMode: "read" }, map(["module:executive-mis-dashboard", true, false])), "read");
  assert.equal(getModuleAccessLevel(exec, map(["module:executive-mis-dashboard", true, true])), "use");
  assert.equal(getModuleAccessLevel(exec, map(["module:executive-mis-dashboard", true, false], ["module:sales-data-viewer", true, false])), "view");
  // the exception is for that one key only: no other module is opened by sales-data-viewer
  for (const key of ["finance-dashboard", "pec", "costing", "e-aushadhi", "sales-data-viewer-admin", "view-logs", "admin-console"])
    assert.equal(getModuleAccessLevel({ moduleKey: key, minNavMode: "view" }, map(["module:sales-data-viewer", true, false])), "none", key);
  assert.equal(getModuleAccessLevel({ moduleKey: "sales-data-viewer", minNavMode: "view" }, map(["module:sales-data-viewer", true, false])), "view", "the legacy Sales Viewer stays until formal replacement");
});

test("launcher: one module key, no duplicate route, no new permission target, no legacy launcher exception", () => {
  const reg = read("public/shared/js/module-registry.js");
  assert.equal((reg.match(/"executive-mis-dashboard"/g) || []).length, 0, "no legacy launcher exception");
  assert.doesNotMatch(reg, /module:sales-item-classification|supabase\.rpc|\.insert\(|\.upsert\(/);
  assert.equal(fs.existsSync(new URL("public/shared/executive-intelligence.html", root)), false);
  const contract = read("public/shared/js/launcher-presentation-contract.js");
  assert.equal((contract.match(/"executive-mis-dashboard"/g) || []).length, 1);
});

// ---------------------------------------------------------------------------------------------------------- hierarchy cascade
test("hierarchy: options follow the parent; choosing a level clears everything below; stale picks are dropped; empty is null (never 0)", () => {
  assert.deepEqual(HIERARCHY_LEVELS.map((l) => l.arg), ["p_category", "p_subcategory", "p_group_id", "p_subgroup"], "p_group_id is the hierarchy id; p_group is the grouping");
  assert.deepEqual(hierarchyOptions(DIMS, emptyHierarchy(), "subcategory").map((r) => r.id), [11, 12, 21], "no parent => all rows");
  assert.deepEqual(hierarchyOptions(DIMS, { ...emptyHierarchy(), category: "1" }, "subcategory").map((r) => r.id), [11, 12]);
  assert.deepEqual(hierarchyOptions(DIMS, { ...emptyHierarchy(), category: "1", subcategory: "11" }, "group").map((r) => r.id), [111]);
  assert.deepEqual(hierarchyOptions(DIMS, { ...emptyHierarchy(), group: "111" }, "subgroup").map((r) => r.id), [1111, 1112]);
  const full = { category: "1", subcategory: "11", group: "111", subgroup: "1112" };
  const r = reconcileHierarchy(DIMS, { ...full, category: "2" }, "category");
  assert.deepEqual(r.sel, { category: "2", subcategory: "", group: "", subgroup: "" }); assert.deepEqual(r.cleared, ["subcategory", "group", "subgroup"]);
  assert.deepEqual(reconcileHierarchy(DIMS, { ...full, subgroup: "" }, "subgroup").cleared, [], "choosing the last level clears nothing");
  assert.deepEqual(reconcileHierarchy(DIMS, full, "group").sel, { ...full, subgroup: "" }, "choosing a group clears only the subgroup");
  assert.deepEqual(reconcileHierarchy(DIMS, { ...emptyHierarchy(), category: "1", subcategory: "21" }).cleared, ["subcategory"], "a subcategory under another category is dropped");
  assert.deepEqual(reconcileHierarchy(DIMS, { ...emptyHierarchy(), category: "99" }).cleared, ["category"], "an id the server no longer lists is dropped");
  assert.deepEqual(reconcileHierarchy(null, full).sel, full, "dimensions unavailable: nothing is cleared silently");
  assert.deepEqual(hierarchyArgs(emptyHierarchy()), { p_category: null, p_subcategory: null, p_group_id: null, p_subgroup: null });
  assert.deepEqual(hierarchyArgs({ category: "1", subcategory: "11", group: "", subgroup: "abc" }), { p_category: 1, p_subcategory: 11, p_group_id: null, p_subgroup: null });
  assert.equal(hierarchyActive(full), 4); assert.equal(hierarchyActive(emptyHierarchy()), 0);
  assert.deepEqual(hierarchyLabels(DIMS, { ...emptyHierarchy(), category: "1", group: "999" }), ["Category: Medicines", "Group: #999"]);
  assert.ok(HISTORY_GROUPS.some((g) => g.value === "group_month") && HISTORY_GROUPS.some((g) => g.value === "subgroup_month"));
});

// ---------------------------------------------------------------------------------------------------------- export / refresh / facility models
test("export scope line: page only, filters, total and has_more are always disclosed", () => {
  const a = exportScopeLine({ title: "sales history", rowsOnPage: 50, page: 1, size: 50, total: 120, anchor: "2026-11-25", filters: ["Region: Kerala", "Category: Medicines"], note: "grouped by sku" });
  assert.match(a, /PAGE ONLY: 50 rows from page 1 \(page size 50\); not the whole dataset/); /* legacy page-scope helper kept for compatibility; the UI now uses exportLoadedScopeLine */ assert.match(a, /120 rows match the filters/); assert.match(a, /has_more=true/);
  assert.match(a, /filters: Region: Kerala; Category: Medicines/); assert.match(a, /import completeness not certified/);
  assert.match(exportScopeLine({ title: "x", rowsOnPage: 1, page: 3, size: 50, total: 101 }), /has_more=false/, "last page");
  assert.match(exportScopeLine({ title: "x", rowsOnPage: 1, page: 1, size: 50, total: null }), /total rows unknown \| has_more unknown/);
  assert.match(exportScopeLine({ title: "x", rowsOnPage: 1, page: 1, size: 50, total: 1 }), /filters: none/);
});

test("refresh job: latest run reported as-is; unknown or placeholder is never success; freshness is direction only", () => {
  const ok = refreshJobModel({ refresh_job_status: "succeeded", refresh_job: { status: "succeeded", active: true, last_started_at: "2026-11-25T21:45:00Z", last_finished_at: "2026-11-25T21:45:30Z" } });
  assert.deepEqual([ok.state, ok.label, ok.tone, ok.active], ["known", "Last run succeeded", "ok", true]);
  assert.equal(refreshJobModel({ refresh_job_status: "failed", refresh_job: { status: "failed" } }).tone, "bad");
  assert.equal(refreshJobModel({ refresh_job_status: "running", refresh_job: { status: "running", last_started_at: "2026-11-26T01:00:00Z", last_finished_at: null } }).finishedAt, null);
  for (const st of ["DISABLED", "UNAVAILABLE_JOB_IDENTITY"]) assert.equal(refreshJobModel({ refresh_job_status: st }).tone, "bad", st);
  assert.equal(refreshJobModel({ refresh_job_status: "NO_RECORDED_RUN" }).label, "No recorded run");
  assert.equal(refreshJobModel({ refresh_job_status: "UNAVAILABLE_TO_THIS_CONTRACT" }).state, "unavailable");
  assert.equal(refreshJobModel({}).state, "unavailable"); assert.equal(refreshJobModel(null).state, "missing");
  const odd = refreshJobModel({ refresh_job_status: "mystery" }); assert.deepEqual([odd.state, odd.tone], ["unrecognised", "warn"]); assert.match(odd.label, /Unrecognised status: mystery/);
  const f = (m, d, diff = 0) => refreshFreshnessModel({ monthly_source_max_inserted_at: m, daily_source_max_inserted_at: d, amount_difference: diff });
  assert.equal(f("2026-11-25T01:00:00Z", "2026-11-25T20:00:00Z").order, "daily_newer"); assert.equal(f("2026-11-25T20:00:00Z", "2026-11-25T01:00:00Z").order, "monthly_newer");
  assert.equal(f("2026-11-25T01:00:00Z", "2026-11-25T01:00:00Z").order, "same"); assert.equal(f(null, "2026-11-25T01:00:00Z").order, "unknown");
  assert.equal(f("2026-11-25T01:00:00Z", "2026-11-25T01:00:00Z", 640245.62).difference, 640245.62); assert.equal(f(null, null, null).difference, null);
});

test("facility model: scopes, review counts and unresolved godown are surfaced; nothing is summed or equated; missing stays unknown", () => {
  const d = {
    anchor: "2026-11-25", start_date: "2025-12-01", latest_raw_date: "2026-11-25", import_completeness: "NOT_CERTIFIED", scope_note: "n",
    facility: { recorded_rows: 111012, missing_amount_rows: 0, source_reported_amount: 203948174.96, billed_value: 203948174.96, godown_unresolved_rows: 63 },
    rows: [
      { scope: "SASV_CANONICAL_PRODUCT", recorded_rows: 109607, missing_amount_rows: 0, source_reported_amount: 200824422.5, billed_value: 200824422.5, godown_unresolved_rows: 60 },
      { scope: "UNCLASSIFIED", recorded_rows: 55, missing_amount_rows: 0, source_reported_amount: 72273.79, billed_value: 72273.79, godown_unresolved_rows: 3 },
      { scope: "CLASSIFICATION_CONFLICT", recorded_rows: 0, missing_amount_rows: 0, source_reported_amount: 0, billed_value: 0, godown_unresolved_rows: 0 },
      { scope: "SOMETHING_NEW", recorded_rows: 2, missing_amount_rows: 2, source_reported_amount: 5, billed_value: null, godown_unresolved_rows: null }],
  };
  const m = facilityModel(d);
  assert.equal(m.state, "ok"); assert.equal(m.facility.unresolvedGodown, 63); assert.equal(m.facility.recorded, 111012); assert.equal(m.reviewRowCount, 55);
  assert.deepEqual(m.review.map((r) => [r.scope, r.recorded]), [["UNCLASSIFIED", 55], ["CLASSIFICATION_CONFLICT", 0]]);
  assert.equal(m.rows[0].inProductAnalytics, true); assert.equal(m.rows[1].review, true); assert.equal(m.rows[0].label, "SASV canonical product");
  assert.equal(m.rows[3].label, "something new", "an unknown scope is shown, never hidden"); assert.equal(m.rows[3].billed, null); assert.equal(m.rows[3].unresolvedGodown, null);
  assert.equal(facilityModel({ ...d, rows: [{ scope: "UNCLASSIFIED", recorded_rows: null }] }).reviewRowCount, null, "unknown review count stays unknown");
  assert.equal(facilityModel({ ...d, rows: [] }).reviewRowCount, 0);
  assert.equal(facilityModel({ coverage: "NO_RAW_DATA", rows: [] }).state, "no-data"); assert.equal(facilityModel({}).state, "unrecognised"); assert.equal(facilityModel(null).state, "missing");
});

// ---------------------------------------------------------------------------------------------------------- static guards
test("static: typography is one token ladder; no hardcoded font sizes, palette or global selector added; HOME icon-only at <=520px", () => {
  const html = read("public/shared/executive-mis-dashboard.html");
  const style = html.slice(html.indexOf("<style>"), html.lastIndexOf("</style>"));
  const sizes = [...style.matchAll(/font-size:\s*([^;}]+)[;}]/g)].map((m) => m[1].trim());
  const literal = sizes.filter((v) => !/^var\(--(ei-fs-[a-z0-9-]+|sasv-text-(xs|sm|md|lg|xl))(,[^)]*)?\)$/.test(v));
  assert.deepEqual(literal, [], "every font-size resolves to a typography token");
  const px = { "ei-fs-2xs": 11, "ei-fs-xs": 12, "ei-fs-sm": 13, "ei-fs-md": 14, "ei-fs-lg": 16, "ei-fs-title": 18, "ei-fs-input-phone": 16, "sasv-text-xs": 12, "sasv-text-sm": 13, "sasv-text-md": 14, "sasv-text-lg": 16 };
  const resolved = new Set(sizes.map((v) => px[v.match(/--(ei-fs-[a-z0-9-]+|sasv-text-[a-z]+)/)[1]]));
  assert.deepEqual([...resolved].sort((a, b) => a - b), [11, 12, 13, 14, 16, 18], "the whole page resolves to a six-step ladder (no 20px+ text)");
  const root = style.slice(style.indexOf("Executive Intelligence typography scale"));
  for (const t of ["--ei-fs-2xs", "--ei-fs-xs", "--ei-fs-sm", "--ei-fs-md", "--ei-fs-lg", "--ei-fs-title", "--ei-fs-input-phone"]) assert.match(root, new RegExp(`${t}:`));
  assert.match(root, /--ei-fs-title: 1\.125rem/); assert.match(root, /--ei-fs-input-phone: 16px/);
  assert.doesNotMatch(html, /home-label/, "HOME label comes only from the shared component"); assert.equal((html.match(/#homeBtn/g) || []).length, 2, "only the narrow token-based parity rule (shared sans family; zero icon gap at <=520px), no page-local HOME fill/border/size");
  assert.match(read("public/shared/js/executive-mis-dashboard.js"), /import \{ supabase \}/);
});

test("static: Sales-only isolation is enforced in the client as defence in depth (not relied on); no executive contract in the sales path", () => {
  const js = read("public/shared/js/executive-mis-dashboard.js");
  for (const fn of ["loadExecutiveSummary", "loadOverviewInventory", "loadLivePipeline", "loadAlertsLens", "loadProductionTab", "loadProductionCounts", "loadProductionValue", "openFinancePartyDetails"])
    assert.match(js, new RegExp(`function ${fn}\\([^)]*\\) \\{(\\n  if \\(!tabPanel\\) return;)?\\n  if \\(!ACCESS\\.executive\\)`), `${fn} refuses without executive access`);
  assert.match(js, /if \(p !== "sales" && !ACCESS\.executive\) return;/);
  assert.match(js, /if \(!ACCESS\.executive && ACTIVE_TAB !== "sales"\) ACTIVE_TAB = "sales";/);
  const sales = js.slice(js.indexOf("// Sales Performance (R3)"), js.indexOf("// Management Alerts (R4 initial"));
  assert.doesNotMatch(sales, /ei_management_alerts|mv_mis_executive_summary|v_mis_|get_mis_/, "the sales section touches no executive contract");
});

test("protected files: PEC, PWL, Costing, e-Aushadhi, migrations, workflows and Electron are untouched by this package", () => {
  const base = process.env.EI_PROTECTED_BASE || "ee49e3301ec5138f39cf925c64613df7ae12007c";
  let changed;
  try { changed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { cwd: new URL(".", root).pathname, encoding: "utf8" }).split("\n").filter(Boolean); } catch { return; }
  const allowed = [/^public\/shared\/(executive-mis-dashboard\.html|js\/(executive-mis-dashboard|executive-intelligence-model|ei-debtor-contract|ei-debtor-workspace|module-registry|mis-evidence-report)\.js)$/, /^scripts\/(mis-c1|mis-g7-reporting)\//, /^scripts\/wp10-g2-safeguards\/(ei-approved-delta\.mjs|source\.test\.mjs)$/, /^docs\/executive-intelligence-r2\//, /^\.github\/workflows\/ei-/];
  const stray = changed.filter((f) => !allowed.some((re) => re.test(f)));
  assert.deepEqual(stray, [], "only the Executive Intelligence client, its tests and its docs may change relative to the server checkpoint");
  assert.equal(changed.some((f) => /^supabase\/migrations\//.test(f)), false, "no migration is added or edited");
});

// ---------------------------------------------------------------------------------------------------------- browser
const skip = process.env.MIS_C1_SKIP_BROWSER === "1";
const chromium = skip ? null : launchBrowser();
const srv = chromium ? await startServer() : null;
const browser = chromium ? await chromium.launch() : null;
const SK = skip || !browser ? "browser unavailable" : false;
test.after(async () => { await browser?.close(); srv?.server.close(); });
const open = (o) => openDashboard(browser, srv.base, { lens: "sales", noWait: true, ...o });
const text = (page, sel) => page.textContent(sel);
const lastArgs = async (page, name) => (await calls(page, name)).at(-1)?.args;
// R5: sales filters live behind the canonical filter button (popover on desktop, full-page sheet on phones). Open it once; it stays open across filter changes.
const fopen = async (page) => { if ((await page.$eval("#salesFilterToggle", (e) => e.getAttribute("aria-expanded"))) !== "true") await page.click("#salesFilterToggle"); };
const setSort = async (page, value) => { await page.click("#salesSortBtn"); await page.check(`input[name="salesSort"][value="${value}"]`); };
const H0 = { p_category: null, p_subcategory: null, p_group_id: null, p_subgroup: null };
const salesOpen = async (o) => { const r = await open(o); await r.page.waitForSelector(".ei-subnav"); await r.page.waitForSelector("#salesCmp .ei-table, #salesCmp .ei-rc"); return r; };
const countCalls = (page, name) => page.evaluate((n) => window.__mis.calls.filter((c) => c.name === n).length, name);

test("hierarchy filters cascade in the UI: parent narrows children, change clears below, pagination resets, exact request signatures", { skip: SK }, async () => {
  const { page } = await salesOpen();
  assert.equal(await page.$eval("#salesFilterFields", (e) => getComputedStyle(e).display), "none", "filters sit behind the canonical filter control until opened");
  assert.deepEqual(await page.$$eval("#salesHier-category option", (o) => o.map((x) => x.textContent)), ["All categories", "Medicines", "Cosmetics"]);
  assert.deepEqual(await page.$$eval("#salesHier-subcategory option", (o) => o.map((x) => x.textContent)), ["All subcategories", "Kashayam", "Arishtam", "Oils"]);
  await fopen(page); await page.selectOption("#salesHier-category", "1");
  assert.deepEqual(await page.$$eval("#salesHier-subcategory option", (o) => o.map((x) => x.textContent)), ["All subcategories", "Kashayam", "Arishtam"]);
  await fopen(page); await page.selectOption("#salesHier-subcategory", "11"); await fopen(page); await page.selectOption("#salesHier-group", "111"); await fopen(page); await page.selectOption("#salesHier-subgroup", "1112");
  await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_comparison").at(-1).args.p_subgroup === 1112);
  const cmp = await lastArgs(page, "ei_sales_comparison");
  assert.deepEqual([cmp.p_category, cmp.p_subcategory, cmp.p_group_id, cmp.p_subgroup], [1, 11, 111, 1112]);
  assert.deepEqual(await lastArgs(page, "ei_sales_window_totals"), { p_anchor: null, p_region: null, p_godown: null, p_product: null, p_sku: null, p_active_only: false, p_category: 1, p_subcategory: 11, p_group_id: 111, p_subgroup: 1112 });
  assert.match(await page.getAttribute("#salesFilterToggle", "aria-label"), /^Filters, 4 active$/);
  // History: page 2 then a parent change resets to page 1; p_group stays the grouping, p_group_id the hierarchy id
  await page.click('[data-sales-view="history"]'); await page.waitForSelector("#salesHistResults .ei-table, #salesHistResults .ei-rc");
  assert.deepEqual([(await lastArgs(page, "ei_sales_history")).p_category, (await lastArgs(page, "ei_sales_history")).p_group_id], [1, 111]);
  await page.selectOption("#salesHistGroup", "group_month"); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_history").at(-1).args.p_group === "group_month");
  await page.selectOption("#salesHistGroup", "subgroup"); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_history").at(-1).args.p_group === "subgroup");
  await page.waitForFunction(() => document.querySelectorAll("#salesHistResults tbody tr").length === 50);
  await page.$eval("#salesHistResults .ei-table-wrap", (e) => { e.scrollTop = e.scrollHeight; }); await page.waitForFunction(() => document.querySelectorAll("#salesHistResults tbody tr").length === 60);
  assert.equal((await lastArgs(page, "ei_sales_history")).p_offset, 50);
  await fopen(page); await page.selectOption("#salesHier-category", "2");
  await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_history").at(-1).args.p_category === 2);
  const h = await lastArgs(page, "ei_sales_history");
  assert.deepEqual([h.p_category, h.p_subcategory, h.p_group_id, h.p_subgroup, h.p_offset, h.p_group], [2, null, null, null, 0, "subgroup"], "downstream cleared, page reset, grouping kept");
  assert.match(await text(page, ".ei-filter-note"), /Subcategory, Group, Subgroup cleared because the level above changed/);
  assert.deepEqual(await page.$$eval("#salesHier-subcategory option", (o) => o.map((x) => x.textContent)), ["All subcategories", "Oils"]);
  // exceptions carry the same hierarchy; coverage / facility / refresh take none
  await page.click('[data-sales-view="exceptions"]'); await page.waitForSelector("#salesExcResults .ei-table, #salesExcResults .ei-rc");
  assert.deepEqual(await lastArgs(page, "ei_sales_exceptions"), { p_anchor: null, p_region: null, p_godown: null, p_search: null, p_limit: 50, p_offset: 0, ...H0, p_category: 2 });
  await page.click('[data-sales-view="coverage"]'); await page.waitForSelector("#salesCov .ei-table");
  assert.deepEqual(await lastArgs(page, "ei_sales_coverage"), { p_anchor: null }); assert.deepEqual(await lastArgs(page, "ei_sales_refresh_status"), {});
  assert.equal(await page.$("#salesHier-category"), null, "coverage has no hierarchy filter");
  await page.click('[data-sales-view="history"]'); await fopen(page); await page.click("#salesFilterReset");
  await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_history").at(-1).args.p_category === null);
  assert.equal(await page.$eval("#salesHier-category", (e) => e.value), "");
  await page.context().close();
});

test("hierarchy: a remembered choice the server no longer lists is dropped and the view reloads without it", { skip: SK }, async () => {
  const { page } = await salesOpen();
  await fopen(page); await page.selectOption("#salesHier-category", "1");
  await page.evaluate(() => { const h = window.__mis.handlers; const base = h.ei_sales_dimensions; window.__mis.handlers.ei_sales_dimensions = (a) => { const r = (base || (() => ({ data: {} })))(a); return r; }; });
  // Simulate the server dropping category 1 from the dimensions, then reopening the lens
  await page.evaluate(async () => {
    const orig = window.__mis.handlers.ei_sales_dimensions;
    window.__mis.handlers.ei_sales_dimensions = (a) => ({ data: { regions: [], godowns: [], categories: [{ id: 2, name: "Cosmetics" }], subcategories: [], groups: [], subgroups: [], first_mapped_date: "2024-01-01", last_mapped_date: "2026-11-24" }, error: null });
    document.querySelector("#refreshBtn").click();
  });
  await page.waitForFunction(() => /Category filter cleared because it is no longer a valid choice/.test(document.querySelector("#salesNotice").textContent));
  await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_comparison").at(-1).args.p_category === null);
  assert.equal(await page.$eval("#salesHier-category", (e) => e.value), "");
  await page.context().close();
});

test("MTD runs on the installed ei_* contracts for BOTH roles with the exact (p_search, p_limit, p_offset) signature and never the legacy executive objects", { skip: SK }, async () => {
  for (const permission of ["granted", "sales-only"]) {
    const { page } = await salesOpen({ permission });
    await page.click('[data-sales-view="mtd"]'); await page.waitForSelector(".sales-table td"); await page.waitForSelector(".ei-metric-group");
    assert.deepEqual(await lastArgs(page, "ei_sales_mtd_product_page"), { p_search: "", p_limit: 25, p_offset: 0 }, permission);
    assert.equal((await calls(page, "v_ei_sales_mtd_summary")).length, 1, permission);
    const names = new Set((await calls(page)).map((c) => c.name)); assert.equal(names.has("get_mis_sales_product_page"), false); assert.equal(names.has("v_mis_sales_tab_summary"), false);
    await page.fill("#salesSearch", "Sprod"); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_mtd_product_page").at(-1).args.p_search === "Sprod");
    assert.equal((await lastArgs(page, "ei_sales_mtd_product_page")).p_offset, 0);
    await page.context().close();
  }
});

test("Month-to-date unavailable / denied states fail closed with no executive fallback", { skip: SK }, async () => {
  const { page } = await salesOpen({ permission: "sales-only" });
  await page.evaluate(() => { const f = (code, message) => () => ({ data: null, error: { code, message } }); window.__mis.handlers.v_ei_sales_mtd_summary = f("42883", "does not exist"); window.__mis.handlers.ei_sales_mtd_product_page = f("42501", "Sales access denied"); });
  await page.click('[data-sales-view="mtd"]'); await page.waitForSelector("#salesScopeNote .ei-state.error, #salesProductTableWrap *");
  await page.waitForFunction(() => !document.querySelector(".sales-table td"));
  assert.equal(await page.$(".sales-table td"), null, "no rows are shown for a denied contract");
  assert.equal((await calls(page, "get_mis_sales_product_page")).length, 0);
  await page.context().close();
});

test("Facility reconciliation: scope classification, review counts, unresolved godown and the not-equal disclosure; both roles; exact signature", { skip: SK }, async () => {
  for (const permission of ["granted", "sales-only"]) {
    const { page } = await salesOpen({ permission });
    assert.equal((await calls(page, "ei_facility_sales_scope")).length, 0, "not requested until the view is opened");
    await page.click('[data-sales-view="facility"]'); await page.waitForSelector("#salesFac .ei-table");
    assert.deepEqual(await lastArgs(page, "ei_facility_sales_scope"), { p_anchor: null, p_months: 1 });
    const metrics = await page.$$eval("#salesFac .ei-metric", (m) => m.map((x) => [x.querySelector(".ei-metric-label").textContent, x.querySelector(".ei-metric-value").textContent]));
    assert.deepEqual(metrics.map((x) => x[0]), ["Facility rows recorded", "Facility billed value", "Rows with unresolved godown", "Needs classification review"]);
    assert.equal(metrics[0][1], "1,000"); assert.equal(metrics[2][1], "20"); assert.equal(metrics[3][1], "20", "15 unclassified + 5 conflict rows, each from the server");
    const rows = await page.$$eval("#salesFac tbody tr", (r) => r.map((x) => [...x.children].map((c) => c.textContent.trim())));
    assert.equal(rows.length, 5);
    const by = (label) => rows.find((r) => r[0].startsWith(label));
    assert.match(by("SASV canonical product")[0], /Counted in product analytics when the godown is also resolved/);
    assert.match(by("Unclassified")[0], /Needs classification review/); assert.match(by("Classification conflict")[0], /Needs classification review/);
    assert.match(by("SASV sample")[3], /^Unavailable \(amounts missing\)/, "billed value unavailable when an amount is missing; the reported sum is separate");
    assert.equal(by("SASV sample")[4], "₹1,000.00"); assert.equal(by("SASV canonical product")[5], "18", "unresolved godown rows is its own column");
    assert.equal(await page.$$eval("#salesFac tr.ei-review-row", (r) => r.length), 2);
    assert.match(await text(page, "#salesFac"), /Facility sales and product sales are different measures/); assert.match(await text(page, "#salesFac"), /no difference between them is derived here/);
    assert.match(await text(page, "#salesFac"), /Classification assignment and approval are not available on this page/);
    assert.equal(await page.$$eval("#salesFac button, #salesFac input[type=checkbox]", (e) => e.length), 0, "no classification admin affordance");
    await fopen(page); await page.selectOption("#salesFacMonths", "12"); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_facility_sales_scope").at(-1).args.p_months === 12);
    await fopen(page); await page.fill("#salesAnchor", "2026-11-10"); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_facility_sales_scope").at(-1).args.p_anchor === "2026-11-10");
    assert.deepEqual(await lastArgs(page, "ei_facility_sales_scope"), { p_anchor: "2026-11-10", p_months: 12 });
    assert.equal(await page.$("#salesHier-category"), null, "the facility contract takes no hierarchy filter");
    assert.equal((await calls(page, "sales_item_scope_review")).length + (await calls(page, "sales_item_scope_approve")).length, 0, "no classification reader or writer is called");
    await page.context().close();
  }
});

test("Facility reconciliation: not-installed / denied / error / no-data / unrecognised states are honest; review needing none is stated", { skip: SK }, async () => {
  const { page } = await salesOpen();
  const states = [
    [{ data: null, error: { code: "42883", message: "does not exist" } }, /not available on this server yet/],
    [{ data: null, error: { code: "42501", message: "Sales access denied" } }, /does not have access to Facility sales classification/],
    [{ data: null, error: { code: "503", message: "Service Unavailable" } }, /could not be loaded\. Service Unavailable/],
    [{ data: { coverage: "NO_RAW_DATA", rows: [] }, error: null }, /No raw sales vouchers are available/],
    [{ data: { anchor: "2026-11-25" }, error: null }, /unrecognised facility response/],
  ];
  await page.click('[data-sales-view="facility"]'); await page.waitForSelector("#salesFac .ei-table");
  for (const [resp, re] of states) {
    await page.evaluate((r) => { window.__mis.handlers.ei_facility_sales_scope = () => r; }, resp);
    await fopen(page); await page.selectOption("#salesFacMonths", String(2 + states.indexOf(states.find((s) => s[0] === resp))));
    await page.waitForFunction((r) => new RegExp(r).test(document.getElementById("salesFac").textContent), re.source);
    assert.equal(await page.$("#salesFac .ei-table"), null, "no figures in place of a failed contract");
  }
  await page.evaluate(() => { window.__mis.handlers.ei_facility_sales_scope = () => ({ data: { anchor: "2026-11-25", start_date: "2026-11-01", latest_raw_date: "2026-11-25", facility: { recorded_rows: 5, missing_amount_rows: 0, source_reported_amount: 9, billed_value: 9, godown_unresolved_rows: 0 }, rows: [{ scope: "SASV_CANONICAL_PRODUCT", recorded_rows: 5, missing_amount_rows: 0, source_reported_amount: 9, billed_value: 9, godown_unresolved_rows: 0 }] }, error: null }); });
  await fopen(page); await page.selectOption("#salesFacMonths", "9"); await page.waitForSelector("#salesFac .ei-table");
  assert.match(await text(page, "#salesFac"), /No rows in the unclassified or conflict scopes for this period/);
  await page.context().close();
});

test("Refresh intelligence: job status, started/finished, daily vs monthly freshness; failure, disabled and missing job are never shown as success", { skip: SK }, async () => {
  const { page } = await salesOpen();
  await page.click('[data-sales-view="coverage"]'); await page.waitForSelector("#salesRefresh .ei-dl");
  assert.match(await text(page, "#salesRefresh"), /Monthly refresh job\s*Last run succeeded/); assert.equal(await page.$$eval("#salesRefresh .ei-job-ok", (e) => e.length), 1);
  assert.match(await text(page, "#salesRefresh"), /Load orderDaily source was loaded after the monthly aggregate/);
  assert.equal(await page.$$eval("#salesRefresh [class*=badge-clear], #salesCov [class*=badge-clear]", (e) => e.length), 0, "no all-clear badge");
  const cases = [
    [{ status: "failed", active: true, last_started_at: "2026-11-26T01:00:00Z", last_finished_at: "2026-11-26T01:00:09Z" }, /Last run failed/, "ei-job-bad"],
    [{ status: "DISABLED", active: false, last_started_at: null, last_finished_at: null }, /Refresh job disabled/, "ei-job-bad"],
    [{ status: "NO_RECORDED_RUN", active: true, last_started_at: null, last_finished_at: null }, /No recorded run/, "ei-job-warn"],
    [{ status: "running", active: true, last_started_at: "2026-11-26T01:00:00Z", last_finished_at: null }, /Still running/, "ei-job-warn"],
    [{ status: "UNAVAILABLE_JOB_IDENTITY" }, /Refresh job not found/, "ei-job-bad"],
  ];
  for (const [job, re, cls] of cases) {
    await page.evaluate((j) => { window.__mis.handlers.ei_sales_refresh_status = () => ({ data: { monthly_latest_month: "2026-11-01", monthly_source_max_inserted_at: "2026-11-25T21:45:00Z", daily_source_max_inserted_at: "2026-11-25T21:45:00Z", daily_last_date_in_month: "2026-11-25", monthly_reported_amount: 1, daily_reported_amount: 1, amount_difference: 0, coverage: "NOT_CERTIFIED", refresh_job_status: j.status, refresh_job: j }, error: null }); }, job);
    await page.click("#refreshBtn");
    await page.waitForFunction((r) => new RegExp(r).test(document.getElementById("salesRefresh").textContent), re.source);
    assert.equal(await page.$(`#salesRefresh .${cls}`) !== null, true, cls);
    assert.equal(await page.$("#salesRefresh .ei-job-ok"), null, "never shown as success");
  }
  await page.evaluate(() => { window.__mis.handlers.ei_sales_refresh_status = () => ({ data: { monthly_latest_month: "2026-11-01", refresh_job_status: "UNAVAILABLE_TO_THIS_CONTRACT" }, error: null }); });
  await page.click("#refreshBtn");
  await page.waitForFunction(() => /Status unavailable\. No success is inferred/.test(document.getElementById("salesRefresh").textContent));
  assert.match(await text(page, "#salesRefresh"), /Load orderLoad order cannot be determined/);
  await page.context().close();
});

test("Sales-only: no stale 'Loading...' status line, only the Sales sub-views, no executive chrome", { skip: SK }, async () => {
  const { page } = await salesOpen({ permission: "sales-only", width: 390 });
  assert.equal(await page.$eval("#statusArea", (e) => e.textContent.trim() === "" || getComputedStyle(e).display === "none"), true, "initial Loading... is cleared");
  assert.notEqual(await page.$eval("#lastRefreshed", (e) => getComputedStyle(e).display), "none", "R5: the freshness indicator is shown to sales-only (sales freshness only)");
  assert.deepEqual(await page.$$eval("[data-sales-view]", (b) => b.map((x) => x.dataset.salesView)), ["overview", "mtd", "history", "exceptions", "facility", "coverage"]);
  await page.context().close();
});

test("Management alerts: sales-only never requests them (fails closed); executive keeps unavailable / denied / error states", { skip: SK }, async () => {
  const { page } = await salesOpen({ permission: "sales-only" });
  await page.evaluate(() => { location.hash = "#alerts"; });
  await page.waitForTimeout(250);
  assert.equal((await calls(page, "ei_management_alerts")).length, 0);
  assert.deepEqual([...new Set((await calls(page)).map((c) => c.name))].filter((n) => /alerts|mis_|executive|pipeline|finance|inventory|production/.test(n)), [], "no executive contract at any point");
  await page.context().close();
});

test("Phone filters: compact toggle opens a full-page sheet; Escape and Done close it and restore focus; keyboard trapped inside", { skip: SK }, async () => {
  const { page } = await salesOpen({ width: 390 });
  assert.equal(await page.$eval("#salesFilterFields", (e) => getComputedStyle(e).display), "none", "fields collapsed on a phone");
  assert.equal(await page.$eval("#salesFilterToggle", (e) => e.getAttribute("aria-expanded")), "false");
  await page.click("#salesFilterToggle");
  assert.equal(await page.$eval("#salesFilterToggle", (e) => e.getAttribute("aria-expanded")), "true");
  const box = await page.$eval("#salesFilterFields", (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, pos: getComputedStyle(e).position }; });
  assert.deepEqual([box.pos, box.x, box.y, box.w, box.h], ["fixed", 0, 0, 390, 800], "full-page sheet");
  assert.equal(await page.evaluate(() => document.body.classList.contains("ei-sheet-lock")), true);
  assert.ok(await page.$eval("#salesHier-category", (e) => e.getBoundingClientRect().height >= 44), "touch-sized controls");
  const sizes = await page.$$eval("#salesFilterFields select, #salesFilterFields input:not([type=checkbox])", (e) => e.map((x) => getComputedStyle(x).fontSize)); assert.ok(sizes.every((s) => s === "16px"), "16px controls avoid iOS focus-zoom");
  await page.keyboard.press("Escape");
  assert.equal(await page.$eval("#salesFilterToggle", (e) => e.getAttribute("aria-expanded")), "false");
  assert.equal(await page.evaluate(() => document.activeElement.id), "salesFilterToggle", "focus returns to the toggle");
  assert.equal(await page.evaluate(() => document.body.classList.contains("ei-sheet-lock")), false);
  await page.click("#salesFilterToggle"); await page.selectOption("#salesHier-category", "1");
  await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_comparison").at(-1).args.p_category === 1);
  assert.equal(await page.$eval("#salesFilterToggle", (e) => e.getAttribute("aria-expanded")), "true", "sheet stays open across a filter change");
  await page.click("#salesFilterClose");
  assert.equal(await page.getAttribute("#salesFilterToggle", "aria-label"), "Filters, 1 active", "the control states how many filters are active");
  assert.equal(await text(page, "#salesFilterToggle .ei-ctl-badge"), "1");
  await page.click("#salesFilterToggle"); for (let i = 0; i < 14; i++) await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => !!document.activeElement.closest("#salesFilterFields")), true, "Tab never leaves the sheet");
  await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(100);
  assert.equal(await page.$eval("#salesFilterFields", (e) => getComputedStyle(e).position), "absolute", "widening the window turns the open sheet into the bounded popover");
  await page.context().close();
});

test("Typography: every visible text node uses the compact ladder at desktop and phone widths in every lens; title 18px; no oversized text", { skip: SK }, async () => {
  const lenses = ["overview", "finance", "sales", "inventory", "finished-goods", "production", "alerts"];
  for (const width of [1280, 390]) {
    for (const lens of lenses) {
      const { page } = await open({ lens, width, height: 900 });
      await page.waitForTimeout(900);
      const bad = await page.evaluate(() => {
        const out = new Map();
        for (const el of document.body.querySelectorAll("*")) {
          if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
          if (el.closest(".ei-sr, option, script, style")) continue;
          const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
          const px = parseFloat(cs.fontSize);
          if (![11, 12, 13, 14, 16, 18].includes(px)) out.set(`${el.className || el.tagName}:${cs.fontSize}`, px);
          // 16px is reserved for hero figures and (on phones) form controls; labels, buttons, tables and notes never inherit it.
          const phoneControl = window.innerWidth <= 640 && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
          if (px === 16 && !phoneControl && !el.closest(".kpi-value, .pv-kpi-value, .ei-metric-value, .production-summary-value, .ei-filter-sheet-head, .ei-drawer-title, .ei-insight-figure, .ei-cover-value")) out.set(`inherited16:${el.tagName}.${el.className}`, px);
        }
        return [...out.entries()];
      });
      assert.deepEqual(bad, [], `${lens} @${width}`);
      const h1 = await page.$eval("h1", (e) => getComputedStyle(e).fontSize); assert.equal(h1, "18px", `${lens} @${width} title`);
      const kpis = await page.$$eval(".kpi-value, .pv-kpi-value, .production-summary-value, .ei-metric-value", (e) => e.map((x) => parseFloat(getComputedStyle(x).fontSize)));
      assert.ok(kpis.every((s) => s <= 16), `${lens} @${width} KPI values stay compact: ${kpis}`);
      await page.context().close();
    }
  }
});

test("Responsive: sales sub-views at 320..1440 never overflow the page; HOME is icon-only at <=520 and labelled above", { skip: SK }, async () => {
  for (const width of WIDTHS) {
    const { page } = await salesOpen({ width, height: 900 });
    for (const view of ["overview", "mtd", "history", "exceptions", "facility", "coverage"]) {
      if (view !== "overview") { await page.click(`[data-sales-view="${view}"]`); }
      await page.waitForTimeout(250);
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
      assert.ok(o.sw <= o.cw + 1 && o.bw <= o.cw + 1, `${view} @${width}: ${JSON.stringify(o)}`);
    }
    const hidden = await page.$eval("#homeBtn .home-label", (e) => { const c = getComputedStyle(e); return c.position === "absolute" && parseFloat(c.width) <= 1; });
    assert.equal(hidden, width <= 520, `HOME label @${width}`);
    assert.ok(await page.$("#homeBtn svg"), "HOME keeps its icon");
    await page.context().close();
  }
});

test("Stale responses: a hierarchy change drops the older response; a view switch cannot be repainted by a late facility result", { skip: SK }, async () => {
  const { page } = await salesOpen();
  await page.evaluate(() => { const m = window.__mis; m.slow = []; m.handlers.ei_sales_history = () => { const d = m.defer(); m.slow.push(d); return d.promise; }; });
  await page.click('[data-sales-view="history"]'); await page.waitForFunction(() => window.__mis.slow.length === 1);
  await fopen(page); await page.selectOption("#salesHier-category", "1"); await page.waitForFunction(() => window.__mis.slow.length === 2);
  const rows = (name) => ({ data: { anchor: "2026-11-24", start_date: "2025-12-01", total: 1, rows: [{ dimension_id: "N", dimension_name: name, sales_value: 1, source_reported_amount: 1, coverage: "OBSERVED_NOT_CERTIFIED" }] }, error: null });
  await page.evaluate((r) => window.__mis.slow[1].resolve(r), rows("NEWER"));
  await page.waitForFunction(() => /NEWER/.test(document.getElementById("salesHistResults").textContent));
  await page.evaluate((r) => window.__mis.slow[0].resolve(r), rows("OLDER-STALE")); await page.waitForTimeout(150);
  assert.doesNotMatch(await text(page, "#salesHistResults"), /OLDER-STALE/);
  await page.evaluate(() => { window.__mis.handlers.ei_facility_sales_scope = () => (window.__mis.late = window.__mis.defer()).promise; });
  await page.click('[data-sales-view="facility"]'); await page.waitForFunction(() => !!window.__mis.late);
  await page.click('[data-sales-view="coverage"]'); await page.waitForSelector("#salesCov .ei-table");
  await page.evaluate(() => window.__mis.late.resolve({ data: { anchor: "x", rows: [{ scope: "UNCLASSIFIED", recorded_rows: 1 }], facility: { recorded_rows: 99999 } }, error: null })); await page.waitForTimeout(150);
  assert.doesNotMatch(await text(page, "#tabPanel"), /99,999/);
  const n = await countCalls(page, "ei_sales_history"); await page.click('[data-sales-view="history"]'); await page.waitForTimeout(150);
  assert.ok((await countCalls(page, "ei_sales_history")) <= n + 1, "no duplicate expensive request on revisit");
  await page.context().close();
});

test("Export parity: history and exceptions export one page with scope, filters, total and has_more; MTD and facility add no whole-dataset export", { skip: SK }, async () => {
  const { page } = await salesOpen();
  await fopen(page); await page.selectOption("#salesHier-category", "1"); await fopen(page); await page.selectOption("#salesRegion", "1");
  await page.click('[data-sales-view="history"]'); await page.waitForSelector("#salesHistResults .ei-table, #salesHistResults .ei-rc");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click('[data-sales-export="hist"]')]);
  const lines = fs.readFileSync(await dl.path(), "utf8").replace(/^﻿/, "").trim().split("\r\n");
  assert.match(lines[0], /LOADED ROWS ONLY: 50 rows loaded so far/); assert.match(lines[0], /60 rows match the filters/); assert.match(lines[0], /has_more=true/);
  assert.match(lines[0], /Region: Inside Kerala; Category: Medicines/); assert.equal(lines.length, 52);
  await page.click('[data-sales-view="exceptions"]'); await page.waitForSelector("#salesExcResults .ei-table, #salesExcResults .ei-rc");
  const [dl2] = await Promise.all([page.waitForEvent("download"), page.click('[data-sales-export="exc"]')]);
  assert.match(dl2.suggestedFilename(), /^executive-intelligence-sales-exceptions-loaded-rows\.csv$/);
  const l2 = fs.readFileSync(await dl2.path(), "utf8").replace(/^﻿/, "").trim().split("\r\n");
  assert.match(l2[0], /LOADED ROWS ONLY: 3 rows loaded so far/); assert.match(l2[0], /has_more=false/); assert.match(l2[0], /Category: Medicines/); assert.equal(l2.length, 5);
  for (const v of ["mtd", "facility", "coverage"]) { await page.click(`[data-sales-view="${v}"]`); await page.waitForTimeout(200); assert.equal(await page.$("[data-sales-export]"), null, `${v} has no export`); }
  await page.context().close();
});

test("Stale browser audit: executive session still has all lenses and every executive contract; sales module key unchanged", { skip: SK }, async () => {
  const { page } = await open({ lens: "overview", permission: "granted" });
  await page.waitForSelector(".ei-overview .kpi-card");
  assert.deepEqual(await page.$$eval("#detailTabs .pill", (b) => b.map((x) => x.dataset.tab)), ["overview", "finance", "sales", "inventory", "finished-goods", "production", "alerts"]);
  const names = new Set((await calls(page)).map((c) => c.name));
  for (const n of ["mv_mis_executive_summary", "v_mis_batch_pipeline", "v_mis_inventory_tab_summary"]) assert.ok(names.has(n), n);
  assert.equal(names.has("ei_sales_access"), false, "an executive is not routed through capability discovery");
  await page.context().close();
});
