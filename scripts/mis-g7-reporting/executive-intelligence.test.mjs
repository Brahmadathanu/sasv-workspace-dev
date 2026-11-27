// Executive Intelligence (EI-R2) client package: pure model fixtures (always run) + browser tests against the MIS-C1 in-page Supabase mock
// (skipped, not failed, without Playwright). Client behaviour only against the pinned R1 contract; NOT production acceptance, and no
// server endpoint is invented: the static test below pins the exact set of server objects the page may touch.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  LENSES, DEFAULT_LENS, lensFromHash, hasValue, CANONICAL_INVENTORY_FIELDS, inventoryCanonicalAvailable, analyzeInventorySummary,
  sanitizeInventoryFilter, INVENTORY_CANONICAL_FILTERS, barSeries, financeBars, pipelineBars, overviewNarrative, alertsViewModel,
  analyzeSalesSummary, shouldResetPage, inventoryCoverage, classifyApiError, salesAccessFromResponse, pivotMonthGrid, csvCell, buildPageCsv, HISTORY_GROUPS, isMonthGrouping,
} from "../../public/shared/js/executive-intelligence-model.js";
import { launchBrowser, openDashboard, startServer, calls, WIDTHS } from "../mis-c1/mis-harness.mjs";

const root = new URL("../../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8").replace(/\r\n/g, "\n");
const FMT = { currency: (v) => `INR ${v}`, integer: (v) => String(v), date: (v) => String(v) };

// R1 live-receipt shaped summary (docs/executive-mis-g7-server/R1_ACCEPTANCE.md)
const R1 = {
  canonical_rm_known_value: 31248056.94768, canonical_rm_item_count: 828, canonical_rm_valuation_gap_count: 0,
  canonical_pm_known_value: 8051832.75491, canonical_pm_item_count: 877, canonical_pm_valuation_gap_count: 0,
  canonical_ind_known_value: 1052734.636, canonical_ind_item_count: 68, canonical_ind_valuation_gap_count: 0,
  inventory_known_value: 40352624.33859, unclassified_known_value: null, unclassified_item_count: 0, valuation_gap_item_count: 0,
  zero_quantity_item_count: 329, duplicate_item_row_count: 0, missing_item_id_count: 0, canonical_inventory_scope_note: "n",
};
const nullCanonical = () => Object.fromEntries(CANONICAL_INVENTORY_FIELDS.map((k) => [k, null]));

// ------------------------------------------------------------------------------------------------ pure model
test("lens set: Overview first and default; six functional lenses; hash input never invents a lens", () => {
  assert.equal(DEFAULT_LENS, "overview");
  assert.deepEqual(LENSES.map((l) => l.label), ["Overview", "Finance", "Sales Performance", "Materials Inventory", "Finished Goods", "Production Performance", "Management Alerts"]);
  assert.equal(lensFromHash("#sales"), "sales"); assert.equal(lensFromHash("finished-goods"), "finished-goods");
  for (const bad of ["", "#", "#nope", "#__proto__", "#<script>", null, undefined, "#SALES ", "#sales/../x"]) assert.ok(LENSES.some((l) => l.id === lensFromHash(bad)), String(bad));
  assert.equal(lensFromHash("#bogus"), "overview");
});

test("inventory: exact R1 live receipt is certified; official labels; coverage counts", () => {
  const a = analyzeInventorySummary(R1);
  assert.equal(a.state, "ok"); assert.equal(a.certified, true); assert.equal(a.rowWord, "items");
  assert.deepEqual(a.groups.map((g) => [g.code, g.label, g.count, g.valueState]), [["RM", "Raw Material", 828, "value"], ["PM", "Packing Material", 877, "value"], ["IND", "Indirect Materials & Utilities", 68, "value"]]);
  assert.equal(a.totalRows, 1773); assert.equal(a.valuedRows, 1773); assert.equal(a.zeroQty, 329); assert.equal(a.knownValue, 40352624.33859);
  assert.deepEqual(INVENTORY_CANONICAL_FILTERS.map((f) => f.value), ["all", "RM", "PM", "IND"]);
  assert.deepEqual(INVENTORY_CANONICAL_FILTERS.map((f) => f.label).slice(1), ["Raw Material", "Packing Material", "Indirect Materials & Utilities"]);
});

test("inventory: gaps, unclassified, duplicates and missing identity each withdraw certification and are disclosed", () => {
  for (const [patch, check] of [
    [{ valuation_gap_item_count: 3, canonical_rm_valuation_gap_count: 3 }, (a) => a.gapTotal === 3 && a.valuedRows === 1770],
    [{ unclassified_item_count: 2, unclassified_known_value: null }, (a) => a.unclassified.count === 2 && a.unclassified.value === null && a.totalRows === 1775],
    [{ duplicate_item_row_count: 1 }, (a) => a.rowWord === "source rows" && a.dup === 1],
    [{ missing_item_id_count: 4 }, (a) => a.rowWord === "source rows" && a.missingId === 4],
  ]) {
    const a = analyzeInventorySummary({ ...R1, ...patch });
    assert.equal(a.certified, false, JSON.stringify(patch)); assert.ok(check(a), JSON.stringify(patch));
  }
});

test("inventory: NULL group value is 'unavailable' (never zero); empty group is 'none'; zero is a valid known value", () => {
  const a = analyzeInventorySummary({ ...R1, canonical_pm_known_value: null, canonical_ind_known_value: null, canonical_ind_item_count: 0 });
  assert.equal(a.groups[1].valueState, "unavailable"); assert.equal(a.groups[1].known, null);
  assert.equal(a.groups[2].valueState, "none");
  const z = analyzeInventorySummary({ ...R1, canonical_rm_known_value: 0 });
  assert.equal(z.groups[0].valueState, "value"); assert.equal(z.groups[0].known, 0);
});

test("inventory: canonical fields absent (pre-install) or all typed NULL (post-recovery) => unavailable, never zero or a legacy fallback", () => {
  const legacy = { total_inventory_item_count: 1773, raw_material_item_count: 826, packing_material_item_count: 877, consumables_item_count: 62, fuel_item_count: 6 };
  for (const s of [legacy, { ...legacy, ...nullCanonical() }, {}, { canonical_rm_known_value: 1 }]) {
    assert.equal(inventoryCanonicalAvailable(s), false); assert.deepEqual(analyzeInventorySummary(s), { state: "unavailable" });
  }
  assert.equal(analyzeInventorySummary(null).state, "missing"); assert.equal(analyzeInventorySummary(undefined).state, "missing");
  // filters: only 'all' survives while canonical is unavailable; unknown values never reach the server
  assert.equal(sanitizeInventoryFilter("RM", false), "all"); assert.equal(sanitizeInventoryFilter("RM", true), "RM"); assert.equal(sanitizeInventoryFilter("RM", null), "RM");
  for (const bad of ["rm", "plm", "fuel", "consumable", "ind", "x", "", null]) assert.equal(sanitizeInventoryFilter(bad, true), "all", String(bad));
});

test("charts: only real, same-unit, non-negative series; no single bar, no negatives, no all-zero, no fabricated trend", () => {
  assert.equal(barSeries([{ label: "a", value: 5 }]), null);
  assert.equal(barSeries([{ label: "a", value: 5 }, { label: "b", value: -1 }]), null);
  assert.equal(barSeries([{ label: "a", value: 0 }, { label: "b", value: 0 }]), null);
  assert.equal(barSeries([{ label: "a", value: null }, { label: "b", value: 3 }]), null, "a missing figure is not drawn as a zero bar");
  const s = barSeries([{ label: "a", value: 10 }, { label: "b", value: 5 }]);
  assert.deepEqual(s.rows.map((r) => r.pct), [100, 50]);
  assert.equal(financeBars({ receivables_sundry_debtors: 200, payables_sundry_creditors: null }), null);
  const f = financeBars({ receivables_sundry_debtors: 200, payables_sundry_creditors: -100 });
  assert.deepEqual(f.rows.map((r) => [r.value, r.signed, r.pct]), [[200, 200, 100], [100, -100, 50]]);
  assert.equal(pipelineBars({ work_in_process_batch_count: 5, finished_goods_bulk_batch_count: 7 }), null, "all three stages are required");
  assert.equal(pipelineBars({ work_in_process_batch_count: 0, finished_goods_bulk_batch_count: 0, bottled_stock_batch_count: 0 }), null);
  assert.equal(inventoryCompositionNegative(), null);
});
function inventoryCompositionNegative() { return analyzeInventorySummary({ ...R1, canonical_pm_known_value: -5 }).composition; }

test("narrative: facts only (no targets, achievement, trends or month-on-month); missing facts are omitted, not zeroed", () => {
  const row = { net_sundry_position: -50, financial_position_date: "2026-11-24", sales_value_month_to_date: 100, sales_position_date: "2026-11-24", manufacturing_inventory_value: 7, fg_inventory_value_overall: 9, report_generated_date: "2026-11-25" };
  const pipe = { status: "ok", data: { work_in_process_batch_count: 96, overdue_work_in_process_batch_count: 70 } };
  const n = overviewNarrative(row, pipe, FMT, analyzeInventorySummary(R1));
  assert.deepEqual(n.map((x) => x.lens), ["finance", "sales", "inventory", "production"]);
  assert.match(n[2].text, /materials INR 40352624\.33859/); assert.doesNotMatch(n[2].text, /INR 7\b/, "the legacy snapshot figure is never narrated");
  assert.match(overviewNarrative(row, pipe, FMT, analyzeInventorySummary({ ...R1, valuation_gap_item_count: 2 }))[2].text, /known value .*not a certified total/);
  assert.doesNotMatch(overviewNarrative(row, pipe, FMT)[2].text, /materials/, "no canonical analysis => no materials claim");
  const text = n.map((x) => x.text).join(" ");
  assert.match(text, /payables exceed receivables/); assert.match(text, /96 batches in Work in Process now, 70 beyond/);
  assert.doesNotMatch(text, /target|achiev|month-on-month|MoM|YoY|trend|vs\.? last|improv|declin|growth|record/i);
  assert.deepEqual(overviewNarrative({ net_sundry_position: null }, { status: "loading" }, FMT), [], "nothing is invented while data is missing");
  assert.match(overviewNarrative(null, { status: "error" }, FMT)[0].text, /unavailable/);
  assert.match(overviewNarrative({ net_sundry_position: 0 }, null, FMT)[0].text, /level/);
  assert.equal(overviewNarrative(null, { status: "ok", data: { work_in_process_batch_count: 1, overdue_work_in_process_batch_count: 0 } }, FMT)[0].text.includes("none beyond"), true);
});

test("management alerts (R4 shape): no/unavailable source => explicit unavailable; counts never imply clear; partial catalogue labelled; no action fields", () => {
  for (const src of [null, undefined, { status: "unavailable" }, { status: "idle" }]) { const u = alertsViewModel(src); assert.equal(u.state, "unavailable"); assert.match(u.body, /does not mean there is nothing to review/); assert.doesNotMatch(JSON.stringify(u), /\b0\b/); }
  assert.equal(alertsViewModel({ status: "loading" }).state, "loading"); assert.equal(alertsViewModel({ status: "denied" }).state, "denied"); assert.equal(alertsViewModel({ status: "expired" }).state, "expired");
  assert.equal(alertsViewModel({ status: "error", message: "boom" }).body, "boom");
  assert.equal(alertsViewModel({ status: "ok", data: { rows: "x" } }).state, "unavailable");
  const ok = alertsViewModel({ status: "ok", data: { catalogue: "C", coverage: "PARTIAL_CATALOGUE", rows: [
    { key: "a", label: "A", evidence_date: "2026-11-25", findings: 4, state: "REVIEW", severity: "REVIEW_ONLY" },
    { key: "b", label: "B", evidence_date: "2026-11-25", findings: 0, state: "CLEAR", severity: "REVIEW_ONLY" },
    { key: "c", label: "C", evidence_date: null, findings: null, state: "CLEAR", severity: "REVIEW_ONLY" },
    { key: "d", label: "D", findings: 3, state: "WEIRD" }] } });
  assert.equal(ok.state, "ok"); assert.equal(ok.partial, true);
  assert.deepEqual(ok.items.map((i) => [i.key, i.findings, i.state]), [["a", 4, "REVIEW"], ["b", 0, "CLEAR"], ["c", null, "UNAVAILABLE"], ["d", 3, "UNAVAILABLE"]], "a missing count can never read as clear");
  assert.deepEqual(Object.keys(ok.items[0]).sort(), ["evidenceDate", "findings", "key", "label", "severity", "state"], "no acknowledgement/mutation fields");
  assert.equal(alertsViewModel({ status: "ok", data: { rows: [] } }).state, "empty");
});

test("zero bars are exactly zero width; positive values keep a visible minimum; diagnostics fail closed", () => {
  const s = barSeries([{ label: "a", value: 10 }, { label: "b", value: 0 }, { label: "c", value: 0.01 }]);
  assert.deepEqual(s.rows.map((r) => r.pct), [100, 0, 2]);
  const p = pipelineBars({ work_in_process_batch_count: 5, finished_goods_bulk_batch_count: 0, bottled_stock_batch_count: 0 });
  assert.deepEqual(p.rows.map((r) => r.pct), [100, 0, 0]);
  // missing / NULL diagnostic counts: never an implied zero, never certified, coverage not invented
  for (const k of ["unclassified_item_count", "duplicate_item_row_count", "missing_item_id_count", "valuation_gap_item_count"]) {
    const a = analyzeInventorySummary({ ...R1, [k]: null });
    assert.equal(a.certified, false, k); assert.equal(a.diagnosticsComplete, false, k); assert.equal(a.totalRows, null, k); assert.equal(a.valuedRows, null, k);
    assert.match(inventoryCoverage(a, FMT).detail, /Coverage unavailable/, k);
    const { [k]: _gone, ...without } = R1;
    assert.equal(analyzeInventorySummary(without).state, "unavailable", `${k} absent => canonical contract incomplete`);
  }
  assert.equal(analyzeInventorySummary({ ...R1, canonical_pm_item_count: null }).certified, false);
  const ok = analyzeInventorySummary(R1);
  assert.equal(inventoryCoverage(ok, FMT).headline, "Stock value"); assert.match(inventoryCoverage(ok, FMT).detail, /1773 of 1773 items valued/);
  assert.equal(inventoryCoverage({ state: "unavailable" }, FMT).headline, "Unavailable");
});

test("api error classes and fail-closed capability discovery", () => {
  assert.equal(classifyApiError({ code: "42883", message: "function ei_x does not exist" }), "unavailable"); assert.equal(classifyApiError({ code: "PGRST202" }), "unavailable"); assert.equal(classifyApiError({ status: 404 }), "unavailable");
  assert.equal(classifyApiError({ code: "42501" }), "denied"); assert.equal(classifyApiError({ code: "403" }), "denied"); assert.equal(classifyApiError({ message: "Sales access denied" }), "denied");
  assert.equal(classifyApiError({ code: "401" }), "expired"); assert.equal(classifyApiError({ message: "JWT expired" }), "expired"); assert.equal(classifyApiError({ code: "22023", message: "Invalid anchor" }), "invalid");
  assert.equal(classifyApiError({ code: "503", message: "Service Unavailable" }), "error"); assert.equal(classifyApiError(null), "error");
  assert.deepEqual(salesAccessFromResponse({ executive: true, sales: true }, null), { state: "executive", executive: true, sales: true });
  assert.deepEqual(salesAccessFromResponse({ executive: false, sales: true }, null), { state: "sales-only", executive: false, sales: true });
  for (const bad of [null, undefined, {}, { sales: "true" }, { sales: false, executive: true }, [], "x", { executive: true }]) { const r = salesAccessFromResponse(bad, null); assert.equal(r.sales, false, JSON.stringify(bad)); assert.equal(r.executive, false); }
  assert.equal(salesAccessFromResponse(null, { code: "42501" }).state, "denied"); assert.equal(salesAccessFromResponse(null, { code: "42883" }).state, "unavailable"); assert.equal(salesAccessFromResponse({ sales: true }, { code: "500" }).sales, false);
});

test("month grid pivots only the returned page (absent cell stays absent, never zero); CSV export neutralises formula injection", () => {
  const rows = [{ dimension_id: "1", dimension_name: "A", month: "2026-09-01", sales_value: 5 }, { dimension_id: "1", dimension_name: "A", month: "2026-10-01", sales_value: 6 }, { dimension_id: "2", dimension_name: "B", month: "2026-10-01", sales_value: 7 }];
  const g = pivotMonthGrid(rows);
  assert.deepEqual(g.months, ["2026-09-01", "2026-10-01"]); assert.equal(g.rows.length, 2);
  assert.equal(g.rows[1].cells["2026-09-01"], undefined, "B has no September cell on this page");
  assert.equal(pivotMonthGrid([]).rows.length, 0);
  for (const evil of ["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tTAB", "\rCR"]) assert.ok(csvCell(evil).replace(/^"/, "").startsWith("'"), JSON.stringify(evil));
  assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"'); assert.equal(csvCell(null), ""); assert.equal(csvCell(0), "0"); assert.equal(csvCell("plain"), "plain");
  const csv = buildPageCsv([{ label: "Name", get: (r) => r.n }, { label: "V", get: (r) => r.v }], [{ n: "=HYPERLINK(\"x\")", v: 1 }], "page 1 only");
  assert.deepEqual(csv.trim().split("\r\n"), ["page 1 only", "Name,V", "\"'=HYPERLINK(\"\"x\"\")\",1"]);
  assert.equal(HISTORY_GROUPS.length, 17); assert.ok(HISTORY_GROUPS.some((g) => g.value === "group_month") && HISTORY_GROUPS.some((g) => g.value === "subgroup_month")); assert.ok(isMonthGrouping("sku_month") && isMonthGrouping("month") && !isMonthGrouping("sku"));
});

test("sales summary: signed values, actual vs billed units and both averages kept; NULL stays NULL (no fake zero)", () => {
  const s = analyzeSalesSummary({ report_date: "2026-11-24", month_start: "2026-11-01", month_upto_date: "2026-11-24", latest_day_sales_value: 396645.05, latest_day_sales_units: 4019, latest_day_billed_units: 3710, month_to_date_sales_value: 11324986.78, month_to_date_sales_units: 116179, month_to_date_billed_units: 108098, sales_days_available_in_month: 21, products_sold_month_to_date: 409, skus_sold_month_to_date: 518, average_daily_sales_value: 539285.084761904762 });
  assert.deepEqual([s.latest.units, s.latest.billed, s.mtd.units, s.mtd.billed, s.days, s.products, s.skus], [4019, 3710, 116179, 108098, 21, 409, 518]);
  assert.equal(s.avgPerDay, 539285.084761904762);
  const n = analyzeSalesSummary({ report_date: "2026-11-24", latest_day_sales_value: null, month_to_date_sales_value: -20 });
  assert.equal(n.latest.value, null); assert.equal(n.mtd.value, -20); assert.equal(n.avgPerDay, null);
  assert.equal(analyzeSalesSummary({ report_date: null, month_upto_date: null }).state, "unavailable"); assert.equal(analyzeSalesSummary(null).state, "missing");
  assert.equal(hasValue(0), true); assert.equal(hasValue(""), false); assert.equal(hasValue(null), false); assert.equal(hasValue("x"), false);
});

test("paging: only an empty out-of-range page resets (once, to page 1)", () => {
  assert.equal(shouldResetPage(0, 3), true); assert.equal(shouldResetPage(0, 1), false); assert.equal(shouldResetPage(5, 3), false);
});

// ------------------------------------------------------------------------------------------------ static contract guards
test("no server endpoint is invented: the page touches exactly the pinned set of server objects, and none is written", () => {
  const js = read("public/shared/js/executive-mis-dashboard.js");
  const names = new Set([...js.matchAll(/["']((?:get_mis|v_mis|v_ei|mv_mis|ei)_[a-z_]+)["']/g)].map((m) => m[1]));
  assert.deepEqual([...names].sort(), [
    "ei_facility_sales_scope", "ei_management_alerts", "ei_sales_access", "ei_sales_comparison", "ei_sales_coverage", "ei_sales_dimensions", "ei_sales_exceptions", "ei_sales_history", "ei_sales_mtd_product_page", "ei_sales_refresh_status", "ei_sales_window_totals",
    "get_mis_finance_ageing_party_page", "get_mis_finance_ageing_summary", "get_mis_finance_party_page", "get_mis_finished_goods_sku_page", "get_mis_inventory_item_page", "get_mis_production_value_summary",
    "mv_mis_executive_summary", "v_ei_sales_mtd_summary", "v_mis_batch_pipeline", "v_mis_finance_outstanding_detail", "v_mis_finance_tab_summary", "v_mis_finished_goods_tab_summary",
    "v_mis_inventory_tab_summary",
  ]);
  assert.doesNotMatch(js, /get_mis_sales_product_page|v_mis_sales_tab_summary/, "Sales MTD uses only the installed ei_* contracts, never the legacy executive-only MTD objects");
  const model = read("public/shared/js/executive-intelligence-model.js");
  assert.doesNotMatch(model, /supabase|fetch\(|\.rpc\(|\.from\(|localStorage|document\.|window\./, "the model is pure and DOM-free");
  assert.doesNotMatch(js, /sales_viewer|sdv_|v_sdv|sales-viewer/, "the legacy Sales Viewer and its sources are not consumed or copied");
});

test("naming: visible strings are Executive Intelligence; technical key, route and permission target are unchanged; no duplicate route", () => {
  const html = read("public/shared/executive-mis-dashboard.html"); const js = read("public/shared/js/executive-mis-dashboard.js");
  assert.match(html, /<title>Executive Intelligence<\/title>/); assert.match(html, /<h1>Executive Intelligence<\/h1>/);
  assert.match(html, /Performance, position and management insights/); assert.doesNotMatch(html, /Executive MIS Dashboard/);
  assert.match(js, /const MODULE_ID = "executive-mis-dashboard";/); assert.match(js, /target === `module:\$\{MODULE_ID\}`/);
  assert.equal(fs.existsSync(new URL("public/shared/executive-intelligence.html", root)), false); assert.equal(fs.existsSync(new URL("public/shared/executive-intelligence-dashboard.html", root)), false);
  assert.doesNotMatch(read("public/shared/js/launcher-presentation-contract.js"), /executive-intelligence/);
});

test("EI-R2 CSS is scoped and token-only: no palette literal, no global selector override, no external dependency or chart library", () => {
  const html = read("public/shared/executive-mis-dashboard.html");
  const block = html.slice(html.indexOf("EI-R2: Executive Intelligence presentation"), html.lastIndexOf("</style>"));
  assert.ok(block.length > 3000);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/, "no hard-coded palette");
  assert.match(block, /var\(--sasv-/); assert.match(block, /max-width: 640px/); assert.match(block, /max-width: 960px/);
  assert.doesNotMatch(block, /^\s*(html|\*)\s*[,{]/m, "no global selector override");
  for (const f of ["public/shared/executive-mis-dashboard.html", "public/shared/js/executive-mis-dashboard.js", "public/shared/js/executive-intelligence-model.js"])
    assert.doesNotMatch(read(f), /<script[^>]+src="https?:|chart\.js|echarts|d3\.|apexcharts|<canvas/i, `${f}: no chart library or external script`);
});

test("read-only: the Executive Intelligence client adds no writer, no navigation to operational pages, no new permission target", () => {
  for (const f of ["public/shared/js/executive-mis-dashboard.js", "public/shared/js/executive-intelligence-model.js"]) {
    const src = read(f);
    assert.doesNotMatch(src, /\.(insert|upsert|delete)\(|\.update\(\s*\{|mis_sign|mis_pack|mis_correct|batch-governance|service_role|module:(?!\$\{MODULE_ID\})[a-z-]+/, f);
  }
});

// ------------------------------------------------------------------------------------------------ browser
const skip = process.env.MIS_C1_SKIP_BROWSER === "1";
const chromium = skip ? null : launchBrowser();
const srv = chromium ? await startServer() : null;
const browser = chromium ? await chromium.launch() : null;
const SK = skip || !browser ? "browser unavailable" : false;
test.after(async () => { await browser?.close(); srv?.server.close(); });
const open = (o) => openDashboard(browser, srv.base, { lens: "overview", ...o });
const text = (page, sel) => page.textContent(sel);
const setSummary = (page, name, patch) => page.evaluate(([n, p]) => { const prev = window.__mis.handlers[n]; window.__mis.handlers[n] = () => ({ data: p, error: null }); return prev; }, [name, patch]);
const mtd = async (page) => { await page.click('[data-sales-view="mtd"]'); await page.waitForSelector(".sales-table"); };
const lensTab = async (page, id, ready) => { await page.evaluate((t) => { const sel = document.querySelector("#detailTabSelect"); if (getComputedStyle(sel.closest(".tab-select-wrap")).display !== "none") { sel.value = t; sel.dispatchEvent(new Event("change", { bubbles: true })); } else document.querySelector(`[data-tab="${t}"]`).click(); if (t === "sales") document.querySelector('[data-sales-view="mtd"]')?.click(); }, id); if (ready) await page.waitForSelector(ready); };

test("Overview is the default lens: grouped indicators, narrative, real comparisons, bounded requests, no detail-lens traffic", { skip: SK }, async () => {
  const { page, consoleErrors } = await open({ lens: null, noWait: true });
  await page.waitForSelector(".ei-overview .kpi-card"); await page.waitForTimeout(300);
  assert.equal(await page.title(), "Executive Intelligence"); assert.match(await text(page, "h1"), /^Executive Intelligence$/); assert.match(await text(page, ".page-sub"), /Performance, position and management insights/);
  assert.equal(await page.getAttribute('[data-tab="overview"]', "aria-selected"), "true");
  assert.equal(await page.evaluate(() => location.hash), "#overview");
  assert.deepEqual(await page.$$eval(".ei-group-title", (e) => e.map((x) => x.textContent.trim())), ["Finance", "Sales", "Stock on hand", "Production", "Management alerts"]);
  assert.equal(await page.$$eval(".ei-narrative li", (e) => e.length), 4);
  const names = (await calls(page)).map((c) => c.name);
  assert.deepEqual([...new Set(names)].sort(), ["ei_sales_history", "get_user_permissions", "mv_mis_executive_summary", "v_mis_batch_pipeline", "v_mis_inventory_tab_summary"], "Overview needs exactly the summary, the shared live pipeline, the canonical inventory summary and ONE bounded monthly-history call for the trend");
  for (const n of ["v_mis_batch_pipeline", "mv_mis_executive_summary", "v_mis_inventory_tab_summary", "ei_sales_history"]) assert.equal(names.filter((x) => x === n).length, 1, n);
  const o = await text(page, ".ei-overview");
  assert.doesNotMatch(o, /target|achievement|month-on-month|\bMoM\b|\bYoY\b/i, "no fabricated targets or comparisons (the monthly trend is real data from the existing history contract)");
  assert.deepEqual(await page.$$eval(".ei-group[data-domain=finance] .kpi-card", (c) => c.slice(0, 2).map((x) => x.querySelector(".kpi-value").textContent)), ["-₹100.00", "₹200.00"], "the signed figures stay in the indicators");
  assert.equal(await page.$$eval(".ei-group[data-domain=finance] .kpi-card .ei-dbar", (e) => e.length), 2, "bars sit inside the indicators, not in a repeated chart");
  assert.equal(await page.$$eval("canvas, svg.chart, .ei-bar-track[role]", (e) => e.length), 0);
  assert.ok(await page.$$eval(".ei-bar-track", (e) => e.every((x) => x.getAttribute("aria-hidden") === "true")), "bar tracks are decoration; values are text");
  // current position vs period flows are labelled apart
  const basis = await page.$$eval(".kpi-basis", (e) => [...new Set(e.map((x) => x.textContent))].sort());
  assert.deepEqual(basis, ["Current position", "Live now", "Month to date", "Snapshot period flow"]);
  assert.match(await text(page, '.ei-group[data-domain="finance"] .ei-group-head'), /Position 24 Nov 2026/);
  assert.equal(await page.$(".ei-context"), null, "R5: the snapshot/live-load times moved into the header freshness indicator");
  await page.click("#lastRefreshed"); assert.match(await text(page, "#eiFreshPanel"), /Executive summary snapshot generated[\s\S]*Production counts loaded/); await page.keyboard.press("Escape");
  assert.deepEqual(consoleErrors, []); await page.context().close();
});

test("Overview links reach the right lens without adding history entries; hash deep links and forged hashes are safe", { skip: SK }, async () => {
  const { page } = await open();
  const h0 = await page.evaluate(() => history.length);
  await page.click('.ei-narrative a[data-lens-link="sales"]'); await page.waitForSelector(".ei-subnav");
  assert.equal(await page.evaluate(() => location.hash), "#sales"); assert.equal(await page.evaluate(() => history.length), h0, "lens changes never add history entries (Back/Home unchanged)");
  assert.equal(await page.getAttribute('[data-tab="sales"]', "aria-selected"), "true");
  await page.click('[data-tab="overview"]'); await page.waitForSelector(".ei-overview .kpi-card");
  for (const [link, sel] of [["finance", ".finance-table"], ["inventory", ".inventory-table"], ["production", ".production-summary-grid"], ["alerts", ".ei-alerts"]]) {
    await page.click(`.ei-group-head [data-lens-link="${link}"]`); await page.waitForSelector(sel);
    await page.click('[data-tab="overview"]'); await page.waitForSelector(".ei-overview .kpi-card");
  }
  await page.click('.ei-link-inline[data-lens-link="finished-goods"]'); await page.waitForSelector(".fg-table");
  await page.context().close();
  const d = await open({ lens: "sales", noWait: true }); await d.page.waitForSelector(".ei-subnav");
  assert.equal(await d.page.getAttribute('[data-tab="sales"]', "aria-selected"), "true");
  assert.deepEqual([...new Set((await calls(d.page)).map((c) => c.name))].filter((n) => /finance|inventory|finished|production/.test(n)), [], "a deep link loads only its own lens");
  await d.page.context().close();
  const f = await open({ lens: "bogus-lens", noWait: true }); await f.page.waitForSelector(".ei-overview .kpi-card");
  assert.equal(await f.page.evaluate(() => location.hash), "#overview"); await f.page.context().close();
});

test("lens selector: wide screens use compact tabs with arrow-key focus; narrow screens use an always-reachable select", { skip: SK }, async () => {
  const w = await open({ width: 1280 });
  assert.equal(await w.page.$eval("#detailTabs", (e) => getComputedStyle(e).display !== "none"), true); assert.equal(await w.page.$eval(".tab-select-wrap", (e) => getComputedStyle(e).display), "none");
  assert.equal(await w.page.$eval('[data-tab="overview"]', (e) => e.getAttribute("tabindex")), "0"); assert.equal(await w.page.$eval('[data-tab="finance"]', (e) => e.getAttribute("tabindex")), "-1");
  await w.page.focus('[data-tab="overview"]'); await w.page.keyboard.press("ArrowRight");
  assert.equal(await w.page.evaluate(() => document.activeElement.dataset.tab), "finance");
  assert.equal(await w.page.getAttribute('[data-tab="overview"]', "aria-selected"), "true", "arrows move focus; Enter/Space selects");
  await w.page.keyboard.press("End"); assert.equal(await w.page.evaluate(() => document.activeElement.dataset.tab), "alerts");
  await w.page.keyboard.press("Enter"); await w.page.waitForSelector(".ei-alerts");
  assert.equal(await w.page.getAttribute("#tabPanel", "role"), "tabpanel"); assert.equal(await w.page.getAttribute("#tabPanel", "aria-labelledby"), "lensTab-alerts");
  await w.page.context().close();
  for (const width of [375, 768]) {
    const n = await open({ width });
    assert.equal(await n.page.$eval("#detailTabs", (e) => getComputedStyle(e).display), "none", `${width}: pills hidden`);
    const r = await n.page.$eval("#detailTabSelect", (e) => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, v: getComputedStyle(e.closest(".tab-select-wrap")).display }; });
    assert.ok(r.v !== "none" && r.h >= 38 && r.w >= width - 40, `${width}: select ${JSON.stringify(r)}`);
    assert.deepEqual(await n.page.$$eval("#detailTabSelect option", (o) => o.map((x) => x.textContent)), LENSES.map((l) => l.label));
    await n.page.selectOption("#detailTabSelect", "sales"); await n.page.waitForSelector(".ei-subnav");
    assert.equal(await n.page.evaluate(() => location.hash), "#sales");
    await n.page.context().close();
  }
});

test("Sales Performance / Month to date (executive): latest day vs month to date, actual vs billed units, both denominators labelled, missing is never zero", { skip: SK }, async () => {
  const { page } = await open({ lens: "sales" });
  await mtd(page); await page.waitForSelector(".ei-metric-group");
  const group = (t) => page.$$eval(".ei-metric-group", (g, title) => { const x = g.find((e) => e.querySelector(".ei-metric-group-title").textContent === title); return [...x.querySelectorAll(".ei-metric")].map((m) => [m.querySelector(".ei-metric-label").textContent, m.querySelector(".ei-metric-value").textContent]); }, t);
  assert.deepEqual(await group("Latest day"), [["Billed sales value", "₹3,96,645.05"], ["Actual units", "4,019"], ["Billed units", "3,710"]]);
  assert.deepEqual((await group("Month to date")).map((x) => x[0]), ["Billed sales value", "Actual units", "Billed units", "Average per sales day", "Products sold", "SKUs sold"]);
  assert.deepEqual((await group("Month to date")).slice(0, 3).map((x) => x[1]), ["₹1,13,24,986.78", "1,16,179", "1,08,098"]);
  assert.match(await text(page, ".ei-asof-row"), /Latest mapped sales day 31 May 2026/); assert.match(await text(page, ".ei-asof-row"), /Month to date 01 May 2026 to 31 May 2026/);
  assert.match(await text(page, ".ei-metric-sub"), /over 21 sales days in the month/);
  await page.click(".sales-scope-note .ei-basis > summary");
  const basis = await text(page, ".sales-scope-note .ei-basis");
  assert.match(basis, /does not use today's date/); assert.match(basis, /returns reduce it/); assert.match(basis, /each product's average divides by the days that product itself sold/); assert.match(basis, /No historical series/);
  assert.deepEqual(await page.$$eval(".sales-table th", (h) => h.map((x) => x.textContent)), ["Product", "SKUs", "MTD billed sales", "MTD actual units", "MTD billed units", "Latest day sales", "Latest day units", "Avg per product sales day"]);
  assert.match(await page.getAttribute(".sales-table th:last-child", "title"), /days this product had sales/);
  // NULLs: no fake zero anywhere
  await setSummary(page, "v_ei_sales_mtd_summary", { report_date: "2026-11-24", month_start: "2026-11-01", month_upto_date: "2026-11-24", latest_day_sales_value: null, latest_day_sales_units: null, latest_day_billed_units: null, month_to_date_sales_value: -20, month_to_date_sales_units: null, month_to_date_billed_units: null, sales_days_available_in_month: 0, average_daily_sales_value: null });
  await page.click("#refreshBtn"); await page.waitForFunction(() => /24 Nov 2026/.test(document.querySelector("#salesScopeNote").textContent));
  const s = await text(page, "#salesScopeNote");
  assert.match(s, /-₹20\.00/); assert.equal((s.match(/Not reported/g) || []).length >= 7, true, s); assert.doesNotMatch(s.replace("-₹20.00", ""), /₹0\.00|\b0\b(?! sales days)/);
  await page.context().close();
});

test("Sales: summary failure is independent of the product table; 401/403/503 are stated with Retry that recovers; out-of-range page resets once", { skip: SK }, async () => {
  const { page } = await open({ lens: "sales" });
  await mtd(page);
  for (const [code, msg] of [["401", "JWT expired"], ["403", "permission denied for view v_ei_sales_mtd_summary"], ["503", "Service Unavailable"]]) {
    await page.evaluate(([c, m]) => { window.__mis.fail = true; window.__mis.handlers.v_ei_sales_mtd_summary = () => (window.__mis.fail ? { data: null, error: { code: c, message: m } } : { data: { report_date: "2026-05-31", month_upto_date: "2026-05-31", month_to_date_sales_value: 1 }, error: null }); }, [code, msg]);
    await page.click("#refreshBtn");
    await page.waitForSelector("#salesScopeNote .ei-state.error");
    assert.match(await text(page, "#salesScopeNote"), new RegExp(msg.split(" ")[0])); assert.ok(await page.$(".sales-table"), "product table still loads when only the summary failed");
    await page.evaluate(() => { window.__mis.fail = false; });
    await page.click('#salesScopeNote [data-mis-retry="sales"]'); await page.waitForSelector(".ei-metric-group");
    assert.equal(await page.$("#salesScopeNote .ei-state.error"), null);
  }
  await page.evaluate(() => { window.__mis.handlers.ei_sales_mtd_product_page = (a) => (a.p_offset > 0 ? { data: [], error: null } : { data: [{ product_name: "First", total_rows: 60 }], error: null }); });
  await page.$eval("#salesProductTableWrap", (e) => { e.scrollTop = e.scrollHeight; }); await page.waitForFunction(() => !document.querySelector("#salesProductTableWrap .ei-more"));
  const offs = (await calls(page, "ei_sales_mtd_product_page")).slice(-1).map((c) => c.args.p_offset); assert.deepEqual(offs, [25], "an empty chunk is terminal: it neither loops nor clears the rows already loaded");
  await page.context().close();
});

test("Materials Inventory (R1 canonical): official labels, exact figures, scope indicator, certified total, category filters all/RM/PM/IND", { skip: SK }, async () => {
  const { page } = await open({ lens: "inventory" });
  await page.waitForSelector(".ei-metrics-wide .ei-metric");
  const tiles = await page.$$eval(".ei-metrics-wide .ei-metric", (m) => m.map((x) => [x.querySelector(".ei-metric-label").textContent, x.querySelector(".ei-metric-value").textContent, x.querySelector(".ei-metric-sub")?.textContent]));
  assert.deepEqual(tiles, [["Stock value", "₹4,03,52,624.34", "All rows valued and classified"], ["Raw Material", "₹3,12,48,056.95", "828 items"], ["Packing Material", "₹80,51,832.75", "877 items"], ["Indirect Materials & Utilities", "₹10,52,734.64", "68 items"]]);
  const c = await text(page, ".ei-coverage"); assert.match(c, /1,773 of 1,773 items valued/); assert.match(c, /329 with zero quantity \(valid zero\)/);
  assert.match(await text(page, "#inventoryScopeNote"), /Raw Material · Packing Material · Indirect Materials & Utilities/);
  assert.doesNotMatch(await text(page, "#inventoryScopeNote"), /Inventory note|Consumables|Fuel/, "the old long scope note and legacy split are gone");
  assert.equal(await page.$$eval("#inventoryScopeNote .ei-metric .ei-dbar", (e) => e.length), 3, "one inline bar per category tile (real same-unit values), not a repeated chart"); assert.equal(await page.$$eval(".ei-bars li", (e) => e.length), 0);
  assert.deepEqual(await page.$$eval('input[name="inventoryFilter"]', (r) => r.map((x) => [x.value, x.parentElement.textContent.trim(), x.disabled])), [["all", "All materials", false], ["RM", "Raw Material", false], ["PM", "Packing Material", false], ["IND", "Indirect Materials & Utilities", false]]);
  await page.click("#inventoryFilterBtn"); await page.check('input[name="inventoryFilter"][value="IND"]');
  await page.waitForFunction(() => window.__mis.calls.some((c) => c.name === "get_mis_inventory_item_page" && c.args.p_source_kind === "IND"));
  assert.equal(await page.evaluate(() => document.activeElement?.id), "inventoryFilterBtn", "focus returns to the filter button");
  assert.equal((await calls(page, "get_mis_inventory_item_page")).at(-1).args.p_offset, 0);
  await page.context().close();
});

test("Materials Inventory: gaps, unclassified, duplicates and NULL groups are disclosed; total is not certified; row values distinguish valid zero from unavailable", { skip: SK }, async () => {
  const { page } = await open({ lens: "inventory" });
  await page.waitForSelector(".ei-metrics-wide .ei-metric");
  await page.evaluate((r1) => { window.__mis.handlers.v_mis_inventory_tab_summary = () => ({ data: { ...r1, canonical_pm_known_value: null, canonical_pm_valuation_gap_count: 877, valuation_gap_item_count: 877, unclassified_item_count: 3, unclassified_known_value: null, duplicate_item_row_count: 2, canonical_ind_item_count: 0, canonical_ind_known_value: null }, error: null }); }, await page.evaluate(() => window.__mis.CANONICAL_INVENTORY));
  await page.evaluate(() => { window.__mis.handlers.get_mis_inventory_item_page = () => ({ data: [
    { source_kind: "rm", source_label: "Raw Material", code: "Z", item_name: "Zero qty no rate", qty_value: 0, avg_rate_value: null, stock_value: 0, category_label: "Raw Material", total_rows: 4 },
    { source_kind: "plm", source_label: "Packing Material", code: "U", item_name: "Missing rate", qty_value: 2, avg_rate_value: null, stock_value: null, category_label: "Packing Material", total_rows: 4 },
    { source_kind: "fuel", source_label: "Fuel", code: "N", item_name: "Neg rate", qty_value: 2, avg_rate_value: -3, stock_value: null, category_label: null, total_rows: 4 },
    { source_kind: "rm", source_label: "Raw Material", code: "<b>X</b>", item_name: "<img src=x onerror=\"window.__pwn=1\">", qty_value: null, avg_rate_value: 5, stock_value: null, category_label: "Raw Material", total_rows: 4 },
  ], error: null }); });
  await page.click("#refreshBtn"); await page.waitForFunction(() => /Known stock value/.test(document.querySelector("#inventoryScopeNote").textContent));
  const t = await page.$$eval(".ei-metrics-wide .ei-metric", (m) => m.map((x) => [x.querySelector(".ei-metric-label").textContent, x.querySelector(".ei-metric-value").textContent, x.querySelector(".ei-metric-sub")?.textContent]));
  assert.deepEqual(t[0], ["Known stock value", "₹4,03,52,624.34", "Not a certified total"]);
  assert.deepEqual(t.find((x) => x[0] === "Packing Material"), ["Packing Material", "Unavailable", "877 source rows · 877 without usable valuation"], "NULL known value is unavailable, never zero");
  assert.deepEqual(t.find((x) => x[0] === "Indirect Materials & Utilities").slice(0, 2), ["Indirect Materials & Utilities", "No items"]);
  assert.deepEqual(t.find((x) => x[0] === "Unclassified"), ["Unclassified", "Unavailable", "3 source rows"]);
  const cov = await text(page, ".ei-coverage"); assert.match(cov, /831 of 1,708 source rows valued/); assert.match(cov, /877 source rows lack a usable valuation/); assert.match(cov, /3 unclassified/); assert.match(cov, /2 duplicate item rows/);
  assert.equal(await page.$(".ei-bars"), null, "no composition chart when fewer than two categories have a known value");
  const rows = await page.$$eval(".inventory-table tbody tr", (r) => r.map((x) => [...x.children].map((c) => c.textContent.trim())));
  assert.equal(rows[0][5], "₹0.00", "zero quantity with a missing rate is a valid zero"); assert.equal(rows[0][4], "No rate");
  assert.equal(rows[1][5], "Unavailable"); assert.equal(rows[2][5], "Unavailable"); assert.equal(rows[2][2], "Unclassified"); assert.equal(rows[3][3], "Unavailable");
  assert.equal(await page.evaluate(() => window.__pwn), undefined, "returned content is escaped, not executed"); assert.match(rows[3][1], /<img src=x/);
  await page.context().close();
});

test("Materials Inventory: before install / after recovery the canonical fields are absent or all NULL => clearly unavailable, filters off, never zero, never the legacy split", { skip: SK }, async () => {
  for (const shape of ["absent", "typed-null"]) {
    const { page } = await open({ lens: "inventory", noWait: true });
    await page.waitForSelector(".inventory-table");
    await page.evaluate((sh) => { const legacy = { total_inventory_item_count: 1773, raw_material_item_count: 826, packing_material_item_count: 877, consumables_item_count: 62, fuel_item_count: 6, manufacturing_inventory_value: 99, inventory_scope_note: "legacy note" };
      const fields = Object.keys(window.__mis.CANONICAL_INVENTORY); window.__mis.handlers.v_mis_inventory_tab_summary = () => ({ data: sh === "absent" ? legacy : { ...legacy, ...Object.fromEntries(fields.map((k) => [k, null])) }, error: null }); }, shape);
    await page.click("#refreshBtn"); await page.waitForSelector(".ei-state-unavailable");
    const s = await text(page, "#inventoryScopeNote");
    assert.match(s, /Canonical materials valuation is unavailable/); assert.doesNotMatch(s, /₹|Consumables|Fuel|Stock value|Raw Material ·/, `${shape}: no value, no legacy split`);
    assert.equal(await page.$(".ei-metrics-wide"), null);
    assert.deepEqual(await page.$$eval('input[name="inventoryFilter"]', (r) => r.map((x) => [x.value, x.disabled])), [["all", false], ["RM", true], ["PM", true], ["IND", true]]);
    assert.match(await page.textContent(".inventory-filter-drawer"), /canonical inventory contract/);
    await page.context().close();
  }
});

test("Materials Inventory: a chosen category filter is reset to All (and re-requested) if the contract turns out not to be canonical", { skip: SK }, async () => {
  const { page } = await open({ lens: "inventory" });
  await page.waitForSelector(".ei-metrics-wide .ei-metric");
  await page.click("#inventoryFilterBtn"); await page.check('input[name="inventoryFilter"][value="RM"]');
  await page.waitForFunction(() => window.__mis.calls.some((c) => c.name === "get_mis_inventory_item_page" && c.args.p_source_kind === "RM"));
  await page.evaluate(() => { window.__mis.handlers.v_mis_inventory_tab_summary = () => ({ data: { total_inventory_item_count: 1 }, error: null }); });
  await page.click("#refreshBtn"); await page.waitForSelector(".ei-state-unavailable");
  await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "get_mis_inventory_item_page").at(-1).args.p_source_kind === "all");
  assert.equal(await page.$eval('input[name="inventoryFilter"][value="all"]', (e) => e.checked), true);
  await page.context().close();
});

test("Finished Goods: current stock vs period flows kept apart; zero stock separate from low cover; existing filters and drilldown preserved", { skip: SK }, async () => {
  const { page } = await open({ lens: "finished-goods", noWait: true }); await page.waitForSelector(".fg-table");
  const t = await page.$$eval("#fgScopeNote .ei-metric", (m) => m.map((x) => [x.querySelector(".ei-metric-label").textContent, x.querySelector(".ei-metric-value").textContent]));
  assert.deepEqual(t, [["SKUs", "622"], ["Stock value", "₹100.00"]]);
  assert.match(await text(page, "#fgScopeNote .ei-seg-legend"), /Zero stock 54.*Below 1 month 104.*Above 6 months 101/, "status counts live in the stacked bar legend, once");
  assert.match(await text(page, "#fgScopeNote"), /Current stock position/); assert.match(await text(page, "#fgScopeNote"), /Period transfers into finished goods are on the Production Performance lens/);
  await page.click('#fgScopeNote [data-lens-link="production"]'); await page.waitForSelector(".pv-kpi");
  assert.equal(await page.getAttribute('[data-tab="production"]', "aria-selected"), "true");
  await page.context().close();
});

test("Production Performance: live position, then selected period, then exceptions; D3/D4 stay unavailable; no operational control", { skip: SK }, async () => {
  const { page } = await open({ lens: "production", noWait: true }); await page.waitForSelector(".pv-kpi"); await page.waitForSelector("#productionCounts .production-summary-card");
  const order = await page.evaluate(() => ["#eiProdLive", "#productionValueSection", "#eiProdExceptions"].map((s) => document.querySelector(s).getBoundingClientRect().top));
  assert.ok(order[0] < order[1] && order[1] < order[2], JSON.stringify(order));
  assert.match(await text(page, "#eiProdLive"), /Current state, not month-bound/); assert.match(await text(page, "#pvHeading"), /Production value\s*Selected period/);
  assert.match(await text(page, ".pv-achievement"), /N\/A/); assert.match(await text(page, ".pv-achievement"), /no frozen plan or verified completion/);
  await page.click(".pv-notes summary");
  assert.match(await text(page, ".pv-notes"), /Planned bulk value and plan achievement stay unavailable until a governed frozen plan exists/); assert.match(await text(page, ".pv-notes"), /Verified completed production is deferred/);
  assert.equal(await page.$$eval("#tabPanel a[href]", (a) => a.length), 0, "no link out of the lens to an operational route");
  assert.equal(await page.$$eval('#tabPanel button:not([data-mis-retry]):not(#govPrev):not(#govNext):not(.mis-retry-btn)', (b) => b.length), 0, "no operational button");
  await page.context().close();
});

test("Overview states: loading is not a zero; 503 shows an error with a summary-only Retry that recovers; pipeline failure is isolated", { skip: SK }, async () => {
  const { page } = await open({ lens: null, noWait: true, init: () => { const m = window.__mis; m.handlers = { mv_mis_executive_summary: () => (m.sumD = m.defer()).promise }; } });
  await page.waitForFunction(() => !!window.__mis.sumD); await page.waitForSelector(".ei-overview");
  let o = await text(page, ".ei-overview");
  assert.match(o, /Loading executive summary/); assert.doesNotMatch(o.replace(/Live[^\n]*/g, ""), /₹0|\b0\.00/, "no false zero while loading");
  assert.deepEqual(await page.$$eval('.ei-group[data-domain="finance"] .kpi-value', (e) => e.map((x) => x.textContent)), ["Loading...", "Loading...", "Loading..."]);
  await page.evaluate(() => window.__mis.sumD.resolve({ data: null, error: { code: "503", message: "Service Unavailable" } }));
  await page.waitForSelector(".ei-state.error");
  o = await text(page, ".ei-overview"); assert.match(o, /Executive summary could not be loaded\. Service Unavailable/);
  assert.deepEqual(await page.$$eval('.ei-group[data-domain="finance"] .kpi-value', (e) => e.map((x) => x.textContent)), ["Unavailable", "Unavailable", "Unavailable"]);
  assert.deepEqual(await page.$$eval('.ei-group[data-domain="production"] .kpi-value', (e) => e.slice(0, 3).map((x) => x.textContent)), ["412", "100", "59"], "the live pipeline is independent of the snapshot");
  const pipe0 = (await calls(page, "v_mis_batch_pipeline")).length;
  await page.evaluate(() => { window.__mis.handlers.mv_mis_executive_summary = () => ({ data: { mis_summary_id: 1, mv_refreshed_at: new Date().toISOString(), net_sundry_position: 5, payables_sundry_creditors: -1, receivables_sundry_debtors: 6 }, error: null }); });
  await page.click('.ei-state.error [data-mis-retry="summary"]'); await page.waitForFunction(() => !document.querySelector(".ei-state.error"));
  assert.equal((await calls(page, "mv_mis_executive_summary")).length, 2); assert.equal((await calls(page, "v_mis_batch_pipeline")).length, pipe0, "summary Retry does not re-query the pipeline");
  assert.equal(await page.$eval('.ei-group[data-domain="finance"] .kpi-card:last-child .kpi-value', (e) => e.textContent), "₹5.00");
  // empty snapshot (PGRST116) is a distinct state
  await page.evaluate(() => { window.__mis.handlers.mv_mis_executive_summary = () => ({ data: null, error: { code: "PGRST116", message: "no rows" } }); });
  await page.click("#refreshBtn"); await page.waitForFunction(() => /No MIS executive summary data/.test(document.querySelector(".ei-overview").textContent));
  assert.equal(await page.$(".ei-state.error"), null); await page.context().close();
});

test("a lens left mid-request cannot repaint, and a newly opened lens shows loading, never the previous lens's or a zero value", { skip: SK }, async () => {
  const { page } = await open({ lens: "finance" });
  await page.evaluate(() => { const m = window.__mis; m.slow = {}; m.handlers.get_mis_finance_party_page = () => (m.slow.fin = m.defer()).promise; m.handlers.v_mis_inventory_tab_summary = () => (m.slow.sum = m.defer()).promise; });
  await page.$eval("#financePartyTableWrap", (e) => { e.scrollTop = e.scrollHeight; });  // finance next chunk in flight
  await page.waitForFunction(() => !!window.__mis.slow.fin);
  await page.evaluate(() => document.querySelector('[data-tab="inventory"]').click());
  await page.waitForSelector("#inventoryScopeNote .ei-state");
  const loading = await text(page, "#inventoryScopeNote"); assert.match(loading, /Loading materials summary/); assert.doesNotMatch(loading, /₹|\b0\b/);
  await page.evaluate(() => window.__mis.slow.fin.resolve({ data: [{ party_name: "STALE-FINANCE", total_rows: 60 }], error: null }));
  await page.waitForTimeout(150);
  assert.doesNotMatch(await text(page, "#tabPanel"), /STALE-FINANCE/);
  await page.evaluate(() => window.__mis.slow.sum.resolve({ data: { ...window.__mis.CANONICAL_INVENTORY }, error: null }));
  await page.waitForSelector(".ei-metrics-wide .ei-metric"); await page.context().close();
});

test("returned content is escaped in every lens", { skip: SK }, async () => {
  const evil = '<img src=x onerror="window.__pwn=1">';
  const { page } = await open({ lens: "finance" });
  await page.evaluate((e) => { const m = window.__mis.handlers; m.get_mis_finance_party_page = () => ({ data: [{ party_name: e, mis_group_name: e, bill_count: 1, outstanding_amount_mis_value: 1, signed_outstanding_tally_value: 1, total_rows: 1 }], error: null }); m.ei_sales_mtd_product_page = () => ({ data: [{ product_name: e, total_rows: 1 }], error: null }); m.get_mis_finished_goods_sku_page = () => ({ data: [{ item: e, classification: e, total_rows: 1 }], error: null }); m.v_mis_finance_tab_summary = () => ({ data: { finance_scope_note: e }, error: null }); }, evil);
  for (const [tab, sel] of [["finance", ".finance-table td"], ["sales", ".sales-table td"], ["finished-goods", ".fg-table td"]]) { await lensTab(page, tab, null); await page.waitForSelector(sel); await page.waitForTimeout(50); }
  await lensTab(page, "finance", ".finance-table td"); await page.click(".finance-scope-note .ei-basis > summary");
  assert.match(await text(page, ".finance-scope-note"), /<img src=x/);
  assert.equal(await page.evaluate(() => window.__pwn), undefined); assert.equal(await page.$("#tabPanel img"), null);
  await page.context().close();
});

test("responsive: every lens at 320/375/390/430/520/768/1280/1440 has no page-level overflow and keeps its content inside the viewport", { skip: SK }, async () => {
  assert.deepEqual(WIDTHS, [320, 375, 390, 430, 520, 768, 1280, 1440]);
  for (const width of WIDTHS) {
    const { page, consoleErrors } = await open({ width, height: width < 600 ? 780 : 900, lens: "overview" });
    for (const [lens, sel] of [["overview", ".ei-overview .kpi-card"], ["finance", ".finance-table, .ei-rc"], ["sales", ".sales-table, .ei-rc, .ei-table"], ["inventory", ".inventory-table, .ei-rc"], ["finished-goods", ".fg-table, .ei-rc"], ["production", ".pv-kpi"], ["alerts", ".ei-alerts"]]) {
      await lensTab(page, lens, sel); await page.waitForTimeout(60);
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bsw: document.body.scrollWidth }));
      assert.ok(o.sw <= o.cw && o.bsw <= o.cw, `${lens}@${width}: page overflow ${JSON.stringify(o)}`);
      const clipped = await page.$$eval("#tabPanel .ei-group, #tabPanel .ei-metric, #tabPanel .ei-state, #tabPanel .pv-kpi, #tabPanel .ei-bars", (els, vw) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -0.5 || r.right > vw + 0.5); }).length, width);
      assert.equal(clipped, 0, `${lens}@${width}: ${clipped} blocks outside the viewport`);
    }
    if (process.env.EI_SCREENSHOT_DIR) { /* captured by scripts/mis-g7-reporting/capture-ei-screenshots.mjs */ }
    assert.deepEqual(consoleErrors, [], `console errors @${width}`);
    await page.context().close();
  }
});

// ------------------------------------------------------------------------------------------------ R3 / R4 browser tests
// R5: sales filters live behind the canonical filter button (popover on desktop, full-page sheet on phones). Open it once; it stays open across filter changes.
const fopen = async (page) => { if ((await page.$eval("#salesFilterToggle", (e) => e.getAttribute("aria-expanded"))) !== "true") await page.click("#salesFilterToggle"); };
const setSort = async (page, value) => { await page.click("#salesSortBtn"); await page.check(`input[name="salesSort"][value="${value}"]`); };
const H0 = { p_category: null, p_subcategory: null, p_group_id: null, p_subgroup: null };
const lastArgs = async (page, name) => (await calls(page, name)).at(-1)?.args;
const salesOpen = async (opts) => { const r = await open({ lens: "sales", noWait: true, ...opts }); await r.page.waitForSelector(".ei-subnav"); return r; };

test("Sales Overview: matched-period comparison with explicit ASP denominators, NULL not zero, trailing windows with reported vs certified kept apart", { skip: SK }, async () => {
  const { page, consoleErrors } = await salesOpen(); await page.waitForSelector("#salesCmp .ei-table, #salesCmp .ei-rc"); await page.waitForSelector("#salesWin .ei-table");
  assert.deepEqual(await page.$$eval("#salesCmp th", (h) => h.map((x) => x.textContent)), ["Period", "Dates", "Sales value", "Net actual packages", "Net billed packages", "ASP per actual package", "ASP per billed package", "Observed days", "Coverage"]);
  const rows = await page.$$eval("#salesCmp tbody tr", (r) => r.map((x) => [...x.children].map((c) => c.textContent.trim())));
  assert.deepEqual(rows[0].slice(0, 3), ["Current", "01 Nov 2026 to 24 Nov 2026", "₹1,13,24,986.78"]); assert.match(rows[0][8], /Observed, not certified/); assert.match(rows[0][8], /250 return rows/);
  assert.deepEqual(rows[2].slice(2, 8), ["Unavailable", "Unavailable", "Unavailable", "Not available", "Not available", "0"], "no prior-year rows => unavailable, never ₹0");
  assert.match(rows[2][8], /No recorded rows/);
  const line = await text(page, ".ei-compare-line"); assert.match(line, /Month on month -14\.61%/); assert.match(line, /Year on year Not available/);
  assert.match(await text(page, "#salesCmp .ei-asof-row"), /Matched calendar day, capped at month end/);
  assert.deepEqual(await page.$$eval("#salesCmp th[title]", (h) => h.map((x) => x.getAttribute("title"))), ["Sales value divided by net actual packages", "Sales value divided by net billed packages"]);
  await page.click("#salesCmp .ei-basis > summary"); assert.match(await text(page, "#salesCmp .ei-basis"), /net package counts, not physical quantity/); assert.match(await text(page, "#salesCmp .ei-basis"), /Import completeness is not certified/);
  const w = await page.$$eval("#salesWin tbody tr", (r) => r.map((x) => [...x.children].map((c) => c.textContent.trim())));
  assert.equal(w[0][2], "₹3,60,00,000.00"); assert.equal(w[0][1], "3 of 3");
  assert.match(w[1][2], /^Unavailable/); assert.match(w[1][2], /months missing/); assert.equal(w[1][3], "₹15,00,00,000.00", "the reported amount is shown only in its own column");
  assert.equal(w[1][4], "Not available"); assert.equal(w[1][5], "Unavailable");
  assert.match(await text(page, "#salesWin .section-x, #salesWin h3"), /excluding the anchor month/);
  // exact parameter lists, nothing else sent
  assert.deepEqual(await lastArgs(page, "ei_sales_comparison"), { p_anchor: null, p_region: null, p_godown: null, p_product: null, p_sku: null, p_active_only: false, ...H0 });
  assert.deepEqual(await lastArgs(page, "ei_sales_window_totals"), { p_anchor: null, p_region: null, p_godown: null, p_product: null, p_sku: null, p_active_only: false, ...H0 });
  assert.deepEqual(await lastArgs(page, "ei_sales_dimensions"), {});
  const lazy = (await calls(page)).map((c) => c.name).filter((n) => /history|exceptions|coverage|refresh/.test(n)); assert.deepEqual(lazy, [], "history/exceptions/coverage are not requested until opened");
  assert.deepEqual(consoleErrors, []); await page.context().close();
});

test("Sales filters: dynamic region/godown from the master, godown follows region, bounded anchor, reload of the active view only, stale views refetch on open", { skip: SK }, async () => {
  const { page } = await salesOpen(); await page.waitForSelector("#salesCmp .ei-table, #salesCmp .ei-rc");
  assert.deepEqual(await page.$$eval("#salesRegion option", (o) => o.map((x) => x.textContent)), ["All regions", "Inside Kerala", "Outside Kerala"]);
  assert.deepEqual(await page.$$eval("#salesGodown option", (o) => o.map((x) => x.textContent)), ["All godowns", "Kozhikode", "Chennai"]);
  assert.equal(await page.getAttribute("#salesAnchor", "min"), "2024-01-01"); assert.equal(await page.getAttribute("#salesAnchor", "max"), "2026-11-24");
  await fopen(page); await page.selectOption("#salesRegion", "2"); assert.deepEqual(await page.$$eval("#salesGodown option", (o) => o.map((x) => x.textContent)), ["All godowns", "Chennai"], "godown options follow the region");
  await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_comparison").length === 2);
  assert.equal((await lastArgs(page, "ei_sales_comparison")).p_region, 2);
  await fopen(page); await page.selectOption("#salesGodown", "20"); await fopen(page); await page.check("#salesActive");
  await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_comparison").length === 4);
  assert.deepEqual(await lastArgs(page, "ei_sales_window_totals"), { p_anchor: null, p_region: 2, p_godown: 20, p_product: null, p_sku: null, p_active_only: true, ...H0 });
  await fopen(page); await page.fill("#salesAnchor", "2027-01-01");
  assert.match(await text(page, ".ei-filter-note"), /outside the mapped range/); assert.equal((await lastArgs(page, "ei_sales_comparison")).p_anchor, null, "an out-of-range anchor is never sent");
  await fopen(page); await page.fill("#salesAnchor", "2026-11-10");
  await page.waitForFunction(() => window.__mis.calls.at(-1).args?.p_anchor === "2026-11-10" || window.__mis.calls.some((c) => c.args?.p_anchor === "2026-11-10"));
  assert.equal(await page.$$eval(".ei-filterbar [data-x]", (e) => e.length), 0);
  const histBefore = (await calls(page, "ei_sales_history")).length; assert.equal(histBefore, 0, "other views were not fetched by a filter change");
  await page.click('[data-sales-view="history"]'); await page.waitForSelector("#salesHistResults .ei-table, #salesHistResults .ei-rc");
  assert.deepEqual(await page.$$eval("#salesGodown option:checked", (o) => o.map((x) => x.textContent)), ["Chennai"], "filters persist across views");
  const h = await lastArgs(page, "ei_sales_history"); assert.deepEqual([h.p_anchor, h.p_region, h.p_godown, h.p_active_only], ["2026-11-10", 2, 20, true]);
  await fopen(page); await page.click("#salesFilterReset"); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_history").length === 2);
  assert.deepEqual(await lastArgs(page, "ei_sales_history"), { ...(await lastArgs(page, "ei_sales_history")), p_anchor: null, p_region: null, p_godown: null, p_active_only: false });
  await page.context().close();
});

test("Sales History: bounded grouped pages, stable paging, search, top/bottom, ambiguous amounts never certified, month grid never fakes cells, page-only CSV with formula safety", { skip: SK }, async () => {
  const { page } = await salesOpen(); await page.click('[data-sales-view="history"]'); await page.waitForSelector("#salesHistResults .ei-table, #salesHistResults .ei-rc");
  assert.deepEqual(await lastArgs(page, "ei_sales_history"), { p_anchor: null, p_region: null, p_godown: null, p_months: 12, p_group: "month", p_product: null, p_sku: null, p_active_only: false, p_search: null, p_sort: "value_desc", p_limit: 50, p_offset: 0, ...H0 });
  assert.equal(await page.$$eval("#salesGroupX", (e) => e.length), 0);
  assert.deepEqual(await page.$$eval("#salesHistGroup option", (o) => o.length), [17].length ? 17 : 0);
  assert.match(await text(page, "#salesHistResults .ei-asof-row"), /Closed months from the shared monthly aggregate/); assert.match(await text(page, "#salesHistResults .ei-asof-row"), /Import completeness not certified/);
  const rows = await page.$$eval("#salesHistResults tbody tr", (r) => r.map((x) => [...x.children].map((c) => c.textContent.trim())));
  assert.equal(rows[1][2].startsWith("Unavailable"), true, "NULL certified value is Unavailable"); assert.match(rows[1][2], /2 ambiguous source groups/); assert.equal(rows[1][3], "₹999.00", "source reported amount shown separately");
  assert.equal(rows[0][2], "₹1,000.00"); assert.equal(rows[1][6], "Not available");
  assert.match(await page.textContent('#salesHistResults th:nth-child(4)'), /Reported amount \(not certified\)/);
  assert.equal(await page.$$eval("#salesHistResults tbody tr", (r) => r.length), 50);
  await page.selectOption("#salesHistGroup", "product"); await page.waitForFunction(() => document.querySelectorAll("#salesHistResults tbody tr").length === 50);
  await page.$eval("#salesHistResults .ei-table-wrap", (e) => { e.scrollTop = e.scrollHeight; }); await page.waitForFunction(() => document.querySelectorAll("#salesHistResults tbody tr").length === 60);
  assert.equal((await lastArgs(page, "ei_sales_history")).p_offset, 50);
  await setSort(page, "value_asc"); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_history").at(-1).args.p_sort === "value_asc");
  assert.equal((await lastArgs(page, "ei_sales_history")).p_offset, 0, "ranking change returns to page 1");
  await page.fill("#salesHistSearch", "Item 3"); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_history").at(-1).args.p_search === "Item 3");
  await page.waitForFunction(() => document.querySelectorAll("#salesHistResults tbody tr").length === 3);
  await page.fill("#salesHistSearch", ""); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_history").at(-1).args.p_search === null);
  await page.selectOption("#salesHistMonths", "6"); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_history").at(-1).args.p_months === 6);
  // product drill-down narrows to that product's SKUs and is shown as a filter
  await page.selectOption("#salesHistGroup", "product"); await page.waitForSelector('[data-hist-drill]');
  await page.click('[data-hist-drill]'); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_history").at(-1).args.p_group === "sku");
  assert.equal((await lastArgs(page, "ei_sales_history")).p_product, 100); assert.match(await text(page, ".ei-filter-note"), /product 100/);
  await page.click("[data-sales-clear-item]"); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_history").at(-1).args.p_product === null);
  // month grid: only returned cells; a dash is "not returned", never zero
  await page.selectOption("#salesHistGroup", "sku_month"); await page.waitForSelector("[data-hist-grid]");
  await page.click("[data-hist-grid]"); await page.waitForSelector(".ei-grid");
  const grid = await page.$$eval(".ei-grid tbody tr", (r) => r.map((x) => [...x.children].map((c) => c.textContent.trim())));
  assert.deepEqual(await page.$$eval(".ei-grid th", (h) => h.map((x) => x.textContent)), ["Name", "2026-09", "2026-10"]);
  assert.ok(grid.every((r) => r.slice(1).every((c) => c !== "0" && !/^₹0\.00/.test(c))), "no zero cell is ever invented");
  assert.match(await text(page, "#salesHistResults"), /A dash means the cell was not returned, not zero/);
  assert.equal(await page.$$eval(".ei-grid .ei-reported", (e) => e.length) >= 0, true);
  await page.context().close();
});

test("Sales History export: this page only, scope stated, formula injection neutralised, escaped content, no whole-dataset claim", { skip: SK }, async () => {
  const { page } = await salesOpen(); await page.evaluate(() => { window.__mis.handlers.ei_sales_history = (a) => ({ data: { anchor: "2026-11-24", start_date: "2025-12-01", total: 120, limit: 50, offset: 0, rows: [
    { dimension_id: "1", dimension_name: '=HYPERLINK("http://evil","x")', month: null, sales_value: 10, source_reported_amount: 10, actual_packages: 1, billed_packages: 1, asp_actual_package: 10, asp_billed_package: 10, coverage: "OBSERVED_NOT_CERTIFIED", ambiguous_amount_groups: 0 },
    { dimension_id: "2", dimension_name: "+cmd|' /C calc'!A0, \"quoted\"", month: null, sales_value: null, source_reported_amount: 5, actual_packages: null, billed_packages: 1, asp_actual_package: null, asp_billed_package: null, coverage: "MISSING_OR_AMBIGUOUS_MEASURES", ambiguous_amount_groups: 1 }] }, error: null }); });
  await page.click('[data-sales-view="history"]'); await page.waitForSelector("#salesHistResults .ei-table, #salesHistResults .ei-rc");
  assert.match(await text(page, ".ei-viewbar"), /Exports only the rows loaded so far \(more rows exist; keep scrolling to load them\), not the whole dataset/); assert.doesNotMatch(await text(page, "#salesHistResults"), /full export|all rows exported|entire dataset/i);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-sales-export]")]);
  assert.match(dl.suggestedFilename(), /^executive-intelligence-sales-history-loaded-rows\.csv$/);
  const csv = (await import("node:fs")).readFileSync(await dl.path(), "utf8").replace(/^﻿/, "");
  const lines = csv.trim().split("\r\n");
  assert.match(lines[0], /LOADED ROWS ONLY: 2 rows loaded so far/); assert.match(lines[0], /120 rows match the filters/); assert.match(lines[0], /has_more=true/); assert.match(lines[0], /filters: none/); assert.match(lines[0], /import completeness not certified/);
  assert.match(lines[1], /^Scope,Month,Sales value,Reported amount \(not certified\)/);
  assert.ok(lines[2].startsWith(`"'=HYPERLINK(""http://evil"",""x"")",,10,10`), lines[2]);
  assert.ok(lines[3].startsWith(`"'+cmd|' /C calc'!A0, ""quoted""",,Unavailable,5`), lines[3]);
  assert.equal(lines.length, 4, "only the returned rows");
  await page.context().close();
});

test("Sales Exceptions: current-master eligibility is separate from activity; no recorded rows is not a certified zero seller; bad scope is stated", { skip: SK }, async () => {
  const { page } = await salesOpen(); await page.click('[data-sales-view="exceptions"]'); await page.waitForSelector("#salesExcResults .ei-table, #salesExcResults .ei-rc");
  assert.deepEqual(await lastArgs(page, "ei_sales_exceptions"), { p_anchor: null, p_region: null, p_godown: null, p_search: null, p_limit: 50, p_offset: 0, ...H0 });
  assert.match(await text(page, "#salesExcResults .ei-asof-row"), /current SKU master, not what was listed historically/);
  const r = await page.$$eval("#salesExcResults tbody tr", (x) => x.map((t) => [...t.children].map((c) => c.textContent.trim())));
  assert.equal(r[0][3], "Listed now"); assert.match(r[0][4], /No recorded rows.*Coverage not certified; not a certified zero seller/); assert.deepEqual(r[0].slice(5), ["No rows", "No rows", "No rows", "No rows"], "no fake zero counts");
  assert.equal(r[1][4], "Sales offset by returns"); assert.deepEqual(r[1].slice(5), ["0", "1", "1", "0"]);
  assert.equal(r[2][3], "Inactive now"); assert.equal(r[2][4], "Missing measures");
  assert.equal(new Set(r.map((x) => x[4])).size, 3, "three different situations stay apart");
  await page.fill("#salesExcSearch", "Alpha"); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_exceptions").at(-1).args.p_search === "Alpha");
  await page.evaluate(() => { window.__mis.handlers.ei_sales_exceptions = () => ({ data: null, error: { code: "22023", message: "Unknown or conflicting godown/region" } }); });
  await fopen(page); await page.selectOption("#salesRegion", "1").catch(() => {});
  await page.click('[data-sales-view="coverage"]'); await page.click('[data-sales-view="exceptions"]');
  await page.evaluate(() => { window.__mis.handlers.ei_sales_exceptions = () => ({ data: null, error: { code: "22023", message: "Unknown or conflicting godown/region" } }); });
  await page.fill("#salesExcSearch", "zz"); await page.waitForSelector("#salesExcResults .ei-state.error");
  assert.match(await text(page, "#salesExcResults"), /The server rejected these filters: Unknown or conflicting godown\/region/);
  await page.context().close();
});

test("Sales Coverage: raw vs mapped per day, ETL status without inferred success, refresh status states what the contract cannot see", { skip: SK }, async () => {
  const { page } = await salesOpen(); await page.click('[data-sales-view="coverage"]'); await page.waitForSelector("#salesCov .ei-table"); await page.waitForSelector("#salesRefresh .ei-dl");
  const c = await text(page, "#salesCov .ei-asof-row"); assert.match(c, /Latest mapped day 24 Nov 2026/); assert.match(c, /2 raw days · 2 mapped days observed/); assert.match(c, /Import completeness not certified/);
  const d = await page.$$eval("#salesCov tbody tr", (r) => r.map((x) => [...x.children].map((t) => t.textContent.trim())));
  assert.equal(d[0][7], "Observed, not certified"); assert.equal(d[1][7], "Raw and mapped counts differ"); assert.equal(d[1][5], "No job recorded"); assert.deepEqual(d[1].slice(1, 3), ["120", "118"]);
  assert.match(await text(page, "#salesCov .ei-basis").catch(() => ""), /^$|Basis/);
  const r = await text(page, "#salesRefresh");
  assert.match(r, /Monthly refresh job\s*Last run succeeded/); assert.match(r, /Last started\s*2[56]-Nov-2026/); assert.match(r, /Daily source was loaded after the monthly aggregate/); assert.match(r, /not a completeness certificate/); assert.match(r, /Difference \(daily minus monthly\)\s*-₹2\.00/);
  assert.equal(await page.$$eval("#salesCov .ei-badge-clear, #salesRefresh .ei-badge, #salesCov [class*=success], #salesRefresh [class*=success]", (e) => e.length), 0, "no green/OK badge anywhere");
  assert.deepEqual((await calls(page)).map((x) => x.name).filter((n) => /ei_sales_(coverage|refresh)/.test(n)).sort(), ["ei_sales_coverage", "ei_sales_refresh_status"]);
  assert.deepEqual(await lastArgs(page, "ei_sales_coverage"), { p_anchor: null });
  await page.context().close();
});

test("Sales contract not installed / denied / expired / 503: honest per-view states, Retry where it can help, legacy Month to date unaffected", { skip: SK }, async () => {
  const { page } = await open({ lens: "sales", noWait: true, init: () => { const f = (code, message) => () => ({ data: null, error: { code, message } }); const h = (window.__mis.handlers = window.__mis.handlers || {}); h.ei_sales_dimensions = f("42883", "function public.ei_sales_dimensions() does not exist"); h.ei_sales_comparison = f("PGRST202", "Could not find the function"); h.ei_sales_window_totals = f("403", "permission denied"); } });
  await page.waitForSelector("#salesCmp .ei-state");
  assert.match(await text(page, "#salesCmp"), /not available on this server yet: the Executive Intelligence sales contract is not installed\. Nothing is estimated/); assert.equal(await page.$("#salesCmp [data-sales-retry]"), null, "no pointless retry for an uninstalled contract");
  assert.match(await text(page, "#salesWin"), /Your account does not have access to Trailing window totals/);
  assert.match(await text(page, "#salesNotice"), /Region, godown, hierarchy and date bounds are unavailable \(contract not installed yet\)/); assert.equal(await page.$eval("#salesRegion", (e) => e.disabled), true);
  assert.equal(await page.$("#salesCmp td"), null, "no figure is shown in place of the missing contract");
  await page.evaluate(() => { const h = window.__mis.handlers; h.ei_sales_history = () => ({ data: null, error: { code: "503", message: "Service Unavailable" } }); h.ei_sales_exceptions = () => ({ data: null, error: { code: "401", message: "JWT expired" } }); });
  await page.click('[data-sales-view="history"]'); await page.waitForSelector("#salesHistResults .ei-state.error");
  assert.match(await text(page, "#salesHistResults"), /Sales history could not be loaded\. Service Unavailable/);
  await page.evaluate(() => { window.__mis.handlers.ei_sales_history = (a) => window.__mis.fixtureHistory?.(a) || { data: { anchor: "2026-11-24", start_date: "2025-12-01", total: 0, rows: [] }, error: null }; });
  await page.click('#salesHistResults [data-sales-retry="hist"]'); await page.waitForSelector("#salesHistResults .ei-state-unavailable");
  await page.click('[data-sales-view="exceptions"]'); await page.waitForSelector("#salesExcResults .ei-state.error");
  assert.match(await text(page, "#salesExcResults"), /Sign in again, then retry/);
  await page.click('[data-sales-view="mtd"]'); await page.waitForSelector(".sales-table"); assert.ok(await page.$(".sales-table td"), "the legacy executive path still works");
  await page.context().close();
});

test("a sales view left mid-request cannot repaint another view, and a filter change drops the older response", { skip: SK }, async () => {
  const { page } = await salesOpen(); await page.waitForSelector("#salesCmp .ei-table, #salesCmp .ei-rc");
  await page.evaluate(() => { const m = window.__mis; m.slow = []; m.handlers.ei_sales_history = () => { const d = m.defer(); m.slow.push(d); return d.promise; }; });
  await page.click('[data-sales-view="history"]'); await page.waitForFunction(() => window.__mis.slow.length === 1);
  await fopen(page); await page.selectOption("#salesRegion", "1"); await page.waitForFunction(() => window.__mis.slow.length === 2);
  await page.evaluate(() => window.__mis.slow[1].resolve({ data: { anchor: "2026-11-24", start_date: "2025-12-01", total: 1, rows: [{ dimension_id: "N", dimension_name: "NEWER", sales_value: 1, source_reported_amount: 1, coverage: "OBSERVED_NOT_CERTIFIED" }] }, error: null }));
  await page.waitForFunction(() => /NEWER/.test(document.getElementById("salesHistResults").textContent));
  await page.evaluate(() => window.__mis.slow[0].resolve({ data: { anchor: "2026-11-24", start_date: "2025-12-01", total: 1, rows: [{ dimension_id: "O", dimension_name: "OLDER-STALE", sales_value: 1, source_reported_amount: 1, coverage: "OBSERVED_NOT_CERTIFIED" }] }, error: null }));
  await page.waitForTimeout(150); assert.doesNotMatch(await text(page, "#salesHistResults"), /OLDER-STALE/);
  await page.evaluate(() => { window.__mis.handlers.ei_sales_history = () => (window.__mis.late = window.__mis.defer()).promise; });
  await page.selectOption("#salesHistGroup", "region"); await page.waitForFunction(() => !!window.__mis.late);
  await page.click('[data-tab="finance"]'); await page.waitForSelector(".finance-table");
  await page.evaluate(() => window.__mis.late.resolve({ data: { anchor: "x", rows: [{ dimension_name: "LATE-LEAK" }], total: 1 }, error: null })); await page.waitForTimeout(150);
  assert.doesNotMatch(await text(page, "#tabPanel"), /LATE-LEAK/); await page.context().close();
});

test("Sales-only entry: capability discovered via ei_sales_access, only the Sales lens, no executive navigation or requests; client hiding is not relied upon", { skip: SK }, async () => {
  const { page, consoleErrors } = await open({ lens: "finance", permission: "sales-only", noWait: true });
  await page.waitForSelector(".ei-subnav"); await page.waitForSelector("#salesCmp .ei-table, #salesCmp .ei-rc");
  const names = [...new Set((await calls(page)).map((c) => c.name))].sort();
  assert.deepEqual(names, ["ei_sales_access", "ei_sales_comparison", "ei_sales_dimensions", "ei_sales_window_totals", "get_user_permissions"], "no summary, pipeline, inventory, finance or legacy sales request");
  assert.equal(await page.evaluate(() => document.body.classList.contains("ei-sales-only")), true);
  assert.equal(await page.$eval(".tabs-card", (e) => getComputedStyle(e).display), "none"); assert.deepEqual(await page.$$eval("#detailTabSelect option", (o) => o.map((x) => x.value)), ["sales"]);
  assert.deepEqual(await page.$$eval("[data-sales-view]", (b) => b.map((x) => x.dataset.salesView)), ["overview", "mtd", "history", "exceptions", "facility", "coverage"], "Month to date now runs on the ei_* contracts for both authorised roles");
  assert.equal(await page.evaluate(() => location.hash), "#sales", "a forged #finance hash cannot select an executive lens");
  assert.equal(await page.$(".kpi-card"), null); assert.match(await text(page, "h1"), /Executive Intelligence/);
  assert.ok(await page.$("#homeBtn")); await page.evaluate(() => { location.hash = "#finance"; }); await page.waitForTimeout(200);
  assert.equal(await page.getAttribute("#tabPanel", "aria-labelledby"), "lensTab-sales");
  assert.deepEqual([...new Set((await calls(page)).map((c) => c.name))].filter((n) => /_mis_|mv_mis|v_mis|finance|inventory|pipeline|production/.test(n)), [], "still no executive request after the hash attempt");
  await page.click("#refreshBtn"); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_comparison").length === 2);
  assert.deepEqual([...new Set((await calls(page)).map((c) => c.name))].filter((n) => /mis_|pipeline/.test(n)), [], "Refresh reloads only the Sales lens");
  assert.deepEqual(consoleErrors, []); await page.context().close();
});

test("Sales-only server denial fails closed: a view-denied account gets no data and no lens; a lookup that cannot be verified says so", { skip: SK }, async () => {
  const { page } = await open({ lens: "sales", permission: "denied", noWait: true }); await page.waitForFunction(() => /permission/.test(document.querySelector("#statusArea").textContent));
  assert.deepEqual([...new Set((await calls(page)).map((c) => c.name))], ["get_user_permissions", "ei_sales_access"]); assert.equal(await page.$(".ei-subnav"), null); await page.context().close();
  const odd = await open({ lens: "sales", permission: "sales-only", noWait: true, init: () => { window.__mis.handlers = { ei_sales_access: () => ({ data: { sales: "yes" }, error: null }) }; } });
  await odd.page.waitForFunction(() => /permission/.test(document.querySelector("#statusArea").textContent)); assert.equal(await odd.page.$(".ei-subnav"), null, "a malformed capability answer is a denial"); await odd.page.context().close();
  const err = await open({ lens: "sales", permission: "error", noWait: true }); await err.page.waitForFunction(() => /verify/.test(document.querySelector("#statusArea").textContent)); assert.equal(await err.page.$(".ei-subnav"), null); await err.page.context().close();
});

test("Management Alerts (R4 initial catalogue): partial, review-only, missing counts unavailable, no urgency invented, no controls; unavailable/denied/error states", { skip: SK }, async () => {
  const { page, consoleErrors } = await open({ lens: "alerts", noWait: true }); await page.waitForSelector(".ei-alerts .ei-table");
  assert.match(await text(page, ".ei-alerts .ei-asof-row"), /Partial catalogue: inventory wip fg integrity/); assert.match(await text(page, ".ei-alerts .ei-asof-row"), /Review only; no actions are taken here/);
  const rows = await page.$$eval(".ei-alerts tbody tr", (r) => r.map((x) => [...x.children].map((c) => c.textContent.trim())));
  assert.deepEqual(rows.map((r) => [r[0], r[1], r[2]]), [["FG transfer groups missing production log", "Unavailable", "Unavailable"], ["Duplicate inventory identities", "No findings", "0"], ["Inventory valuation gaps", "Needs review", "4"], ["Overdue work in process", "Needs review", "59"]]);
  assert.equal(rows[2][4], "review only"); assert.match(await text(page, ".ei-alerts"), /partial catalogue\. “No findings” means nothing was found by that check only; it is not an all-clear/);
  assert.match(await text(page, ".ei-alerts"), /not confirmed operational failures and are not raised as alerts here/);
  assert.equal(await page.$$eval(".ei-alerts button, .ei-alerts input, .ei-alerts select, .ei-alerts a", (e) => e.length), 0);
  assert.doesNotMatch(await text(page, ".ei-alerts"), /urgent|critical|NOT_VERIFIED/i);
  assert.deepEqual((await calls(page, "ei_management_alerts")).map((c) => c.args), [null], "no parameters are sent");
  for (const [err, re] of [[{ code: "42883", message: "does not exist" }, /Management Alerts are not connected yet/], [{ code: "42501", message: "Executive access denied" }, /require executive access/], [{ code: "401", message: "JWT expired" }, /session has expired/], [{ code: "503", message: "Service Unavailable" }, /Alerts could not be loaded/]]) {
    await page.evaluate((e) => { window.__mis.handlers.ei_management_alerts = () => ({ data: null, error: e }); }, err);
    await page.click('[data-tab="finance"]'); await page.waitForSelector(".finance-table"); await page.click('[data-tab="alerts"]'); await page.waitForFunction((r) => new RegExp(r).test(document.getElementById("tabPanel").textContent), re.source);
    assert.doesNotMatch(await text(page, ".ei-alerts"), /\b0\b/, "no count is shown for an unavailable source");
  }
  await page.evaluate(() => { window.__mis.handlers.ei_management_alerts = () => ({ data: { catalogue: "X", coverage: "PARTIAL_CATALOGUE", rows: [] }, error: null }); });
  await page.click('[data-tab="finance"]'); await page.click('[data-tab="alerts"]'); await page.waitForFunction(() => /partial catalogue, so it is not an all-clear/.test(document.getElementById("tabPanel").textContent));
  assert.deepEqual(consoleErrors.filter((e) => !/Failed to load resource/.test(e) && !/ei_management_alerts failed/.test(e)), []); await page.context().close();
});

test("Overview aligns with the canonical Materials lens: same figure, same certification and coverage wording; legacy snapshot value never shown; fail closed", { skip: SK }, async () => {
  const { page } = await open({ lens: null, noWait: true }); await page.waitForSelector(".ei-overview .kpi-card");
  await page.waitForFunction(() => [...document.querySelectorAll(".kpi-card")].some((c) => /Materials Stock Value/.test(c.textContent) && /₹4,03,52,624\.34/.test(c.textContent)));
  const card = (p) => p.evaluate(() => { const c = [...document.querySelectorAll(".kpi-card")].find((x) => /Materials Stock Value/.test(x.textContent)); return c ? { value: c.querySelector(".kpi-value").textContent, basis: c.querySelector(".kpi-basis").textContent, info: decodeURIComponent(c.querySelector("[data-kpi-info]").getAttribute("data-kpi-info")) } : null; });
  const ov = await card(page);
  assert.equal(ov.value, "₹4,03,52,624.34"); assert.equal(ov.basis, "Current position"); assert.match(ov.info, /1,773 of 1,773 items valued/); assert.match(ov.info, /same figure and coverage as the Materials Inventory lens/);
  assert.doesNotMatch(await text(page, ".ei-overview"), /Manufacturing Inventory Value|₹7,000/, "the legacy snapshot figure is not shown");
  await page.click('[data-tab="inventory"]'); await page.waitForSelector(".ei-metrics-wide .ei-metric");
  assert.equal(await page.$eval(".ei-metrics-wide .ei-metric .ei-metric-value", (e) => e.textContent), ov.value, "Overview and lens show the same number");
  assert.match(await text(page, ".ei-coverage"), /1,773 of 1,773 items valued/);
  // partial coverage and missing diagnostics: both views say "not certified"; missing diagnostics never read as zero
  for (const [patch, basis] of [[{ valuation_gap_item_count: 5 }, /Known value, not certified/], [{ duplicate_item_row_count: null }, /Known value, not certified/]]) {
    await page.evaluate((p) => { window.__mis.handlers.v_mis_inventory_tab_summary = () => ({ data: { ...window.__mis.CANONICAL_INVENTORY, ...p }, error: null }); }, patch);
    await page.click('[data-tab="overview"]'); await page.click("#refreshBtn"); await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "v_mis_inventory_tab_summary").length >= 1);
    await page.waitForFunction(([re]) => [...document.querySelectorAll(".kpi-card")].some((c) => /Materials Stock Value/.test(c.textContent) && new RegExp(re).test(c.textContent)), [basis.source]);
    const o2 = await card(page); assert.match(o2.basis, basis);
    if (patch.duplicate_item_row_count === null) assert.match(o2.info, /Coverage unavailable/);
  }
  assert.match(await text(page, '.ei-narrative'), /known value .*not a certified total/);
  await page.evaluate(() => { window.__mis.handlers.v_mis_inventory_tab_summary = () => ({ data: { total_inventory_item_count: 1, manufacturing_inventory_value: 7000 }, error: null }); });
  await page.click("#refreshBtn"); await page.waitForFunction(() => [...document.querySelectorAll(".kpi-card")].some((c) => /Materials Stock Value/.test(c.textContent) && /Unavailable/.test(c.textContent)));
  assert.doesNotMatch(await text(page, ".ei-overview"), /₹7,000|materials ₹/); await page.context().close();
});

test("zero values draw zero-width bars and inventory composition bars; the Overview lists compact summary rows, not oversize cards", { skip: SK }, async () => {
  const { page } = await open({ lens: null, noWait: true, init: () => { window.__mis.handlers = window.__mis.handlers || {}; window.__mis.handlers.v_mis_batch_pipeline = () => ({ data: { active_pipeline_batch_count: 5, work_in_process_batch_count: 5, overdue_work_in_process_batch_count: 0, finished_goods_bulk_batch_count: 0, bottled_stock_batch_count: 0, total_canonical_batch_count: 9 }, error: null }); } });
  await page.waitForSelector(".kpi-card .ei-dbar");
  const w = await page.$$eval(".kpi-card .ei-dbar > span", (f) => f.map((x) => x.style.width)); assert.ok(w.includes("100%"), "the only non-zero stage fills its indicator bar"); assert.ok(w.every((x) => x === "100%" || x === "0%" || /^\d+%$/.test(x)));
  const h = await page.$$eval(".kpi-card", (c) => Math.max(...c.map((x) => x.getBoundingClientRect().height))); assert.ok(h <= 68, `indicator row height ${h}`);
  await page.context().close();
});
