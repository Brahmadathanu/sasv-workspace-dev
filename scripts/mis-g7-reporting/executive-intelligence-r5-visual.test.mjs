// EI R5 final: HOME computed parity with Stock Checker, responsive record cards, data-backed visual intelligence.
// Pure model tests always run; browser tests use the MIS-C1 in-page Supabase mock (skipped, not failed, without Playwright).
// Synthetic fixtures only: NOT owner production evidence.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { barSeriesLoose, comparisonBars, windowBars, monthlyTrend, rankedPageBars, facilityBars, facilityModel, subsetShare, segmentSeries, alertSegments, fgStatusSegments, materialFgBars } from "../../public/shared/js/executive-intelligence-model.js";
import { launchBrowser, openDashboard, startServer, calls, setHandler } from "../mis-c1/mis-harness.mjs";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// ------------------------------------------------------------------------------------------------------------ pure models
test("loose bars: a missing value is a labelled gap (never zero); negatives or a single row draw nothing", () => {
  const s = barSeriesLoose([{ label: "A", value: 10 }, { label: "B", value: null, missing: "No recorded rows" }, { label: "C", value: 0 }]);
  assert.deepEqual(s.rows.map((r) => r.pct), [100, null, 0]); assert.equal(s.rows[1].missing, "No recorded rows");
  assert.equal(barSeriesLoose([{ label: "A", value: 1 }, { label: "B", value: -1 }]), null);
  assert.equal(barSeriesLoose([{ label: "A", value: 1 }]), null);
  assert.equal(barSeriesLoose([{ label: "A", value: null }, { label: "B", value: null }]), null);
});

test("matched-period and window bars keep gaps and reasons; facility bars never turn a missing billed value into zero", () => {
  const c = comparisonBars({ periods: [{ label: "CURRENT", sales_value: 100 }, { label: "PREVIOUS_MONTH", sales_value: 200 }, { label: "PREVIOUS_YEAR", sales_value: null, coverage: "NO_RECORDED_ROWS" }] });
  assert.deepEqual(c.rows.map((r) => [r.label, r.pct]), [["Current", 50], ["Previous month", 100], ["Previous year", null]]); assert.equal(c.rows[2].missing, "No recorded rows");
  const w = windowBars({ windows: [{ n: 3, observed_months: 3, average_monthly_sales: 12 }, { n: 12, observed_months: 11, average_monthly_sales: null }] });
  assert.equal(w.rows[1].pct, null); assert.match(w.rows[1].missing, /months missing/);
  const f = facilityBars(facilityModel({ rows: [{ scope: "SASV_CANONICAL_PRODUCT", billed_value: 100, recorded_rows: 1, missing_amount_rows: 0 }, { scope: "SASV_SAMPLE", billed_value: null, recorded_rows: 1, missing_amount_rows: 2 }] }));
  assert.equal(f.rows[1].pct, null); assert.match(f.rows[1].missing, /missing an amount/);
});

test("monthly trend: chronological, calendar gaps stay gaps, anchor month is partial; partial/searched/duplicate series draw nothing", () => {
  const row = (m, v, extra = {}) => ({ month: `${m}-01`, sales_value: v, source_reported_amount: v, coverage: "OBSERVED_NOT_CERTIFIED", ...extra });
  const d = { anchor: "2026-11-24", start_date: "2026-08-01", total: 4, rows: [row("2026-11", 50), row("2026-08", 10), row("2026-10", null, { source_reported_amount: 7 }), ] };
  d.total = 3;
  const t = monthlyTrend(d, { group: "month" });
  assert.deepEqual(t.months.map((m) => [m.key, m.state]), [["2026-08", "ok"], ["2026-09", "missing"], ["2026-10", "unavailable"], ["2026-11", "ok"]], "chronological with the missing September kept as a gap");
  assert.equal(t.months[3].partial, true); assert.equal(t.months[0].partial, false); assert.equal(t.months[2].reported, 7);
  assert.equal(monthlyTrend({ ...d, total: 99 }, { group: "month" }).reason, "partial", "not the whole series in one response");
  assert.equal(monthlyTrend(d, { group: "month", search: "x" }).reason, "partial");
  assert.equal(monthlyTrend(d, { group: "product_month" }).reason, "group");
  assert.equal(monthlyTrend({ ...d, rows: [row("2026-08", 1), row("2026-08", 2)], total: 2 }, { group: "month" }).reason, "data");
});

test("ranked page bars are page-only and honest; subset only when it fits inside its parent; alerts keep unavailable apart from clear", () => {
  const r = rankedPageBars([{ dimension_name: "A", sales_value: 5 }, { dimension_name: "B", sales_value: 9 }, { dimension_name: "C", sales_value: null }]);
  assert.deepEqual([r.series.rows[0].label, r.pageRows, r.shown, r.unavailable], ["B", 3, 2, 1]);
  assert.equal(rankedPageBars([{ dimension_name: "A", sales_value: -1 }, { dimension_name: "B", sales_value: 2 }]), null);
  assert.deepEqual(subsetShare(100, 59), { total: 100, subset: 59, pct: 59 }); assert.equal(subsetShare(10, 12), null); assert.equal(subsetShare(null, 1), null); assert.equal(subsetShare(0, 0), null);
  const a = alertSegments([{ state: "UNAVAILABLE" }, { state: "CLEAR" }, { state: "REVIEW" }, { state: "REVIEW" }]);
  assert.deepEqual(a.rows.map((x) => [x.key, x.value]), [["REVIEW", 2], ["CLEAR", 1], ["UNAVAILABLE", 1]]);
  assert.equal(alertSegments([]), null); assert.equal(segmentSeries([{ key: "a", label: "a", value: 0 }, { key: "b", label: "b", value: 0 }]), null);
  assert.equal(fgStatusSegments({ sku_count: 10, zero_stock_sku_count: 2, below_1_month_cover_count: 3, above_6_month_cover_count: 1 }).rows.at(-1).value, 4);
  assert.equal(fgStatusSegments({ sku_count: 3, zero_stock_sku_count: 2, below_1_month_cover_count: 3, above_6_month_cover_count: 1 }), null, "overlapping counts are not charted");
  assert.equal(fgStatusSegments({ sku_count: 3, zero_stock_sku_count: null, below_1_month_cover_count: 0, above_6_month_cover_count: 0 }), null);
  assert.deepEqual(materialFgBars({ manufacturing_inventory_value: 999, fg_inventory_value_overall: 14 }, 7).rows.map((x) => x.pct), [50, 100]);
});

test("static: bounded scope, cache keys advanced, no new dependency, token-only", () => {
  const html = read("public/shared/executive-mis-dashboard.html"), js = read("public/shared/js/executive-mis-dashboard.js");
  assert.match(html, /<html lang="en-GB" data-sasv-theme="sasv-core">/, "the shared themed home tokens");
  assert.match(html, /executive-mis-dashboard\.js\?mis-c1=ei-r8-kyc-3/); assert.match(js, /executive-intelligence-model\.js\?ei-r8=3/);
  assert.doesNotMatch(js, /import\s+[^;]*from\s+"https?:/); assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  const r5 = html.slice(html.indexOf("EI-R5 final: visual intelligence"));
  assert.ok(r5.length > 2500); assert.doesNotMatch(r5, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
});

// ------------------------------------------------------------------------------------------------------------ browser
const skip = process.env.MIS_C1_SKIP_BROWSER === "1";
const chromium = skip ? null : launchBrowser();
const srv = chromium ? await startServer() : null;
const browser = chromium ? await chromium.launch() : null;
const SK = skip || !browser ? "browser unavailable" : false;
test.after(async () => { await browser?.close(); srv?.server.close(); });
const open = (o) => openDashboard(browser, srv.base, { noWait: true, ...o });
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const HOME_PROPS = ["backgroundColor", "backgroundImage", "borderTopColor", "borderTopWidth", "borderRadius", "paddingTop", "paddingRight", "paddingLeft", "gap", "minHeight", "height", "width", "color", "fontSize", "fontWeight", "fontFamily", "boxShadow", "display"];

test("HOME: computed style equals Stock Checker (fill, border, radius, padding, height, font, colour, glyph) at desktop and phone, light and dark", { skip: SK }, async () => {
  for (const w of [1280, 390]) for (const scheme of ["light", "dark"]) {
    const { page, context } = await open({ width: w, height: 800, lens: "overview" });
    await page.emulateMedia({ colorScheme: scheme }); await page.waitForSelector("#homeBtn svg");
    const grab = (b, props) => { const cs = getComputedStyle(b); return Object.fromEntries(props.map((p) => [p, cs[p]])); };
    const mis = await page.$eval("#homeBtn", grab, HOME_PROPS);
    const sc = await context.newPage(); await sc.setViewportSize({ width: w, height: 800 }); await sc.emulateMedia({ colorScheme: scheme });
    await sc.goto(`${srv.base}/shared/stock-checker.html`, { waitUntil: "domcontentloaded" }); await sc.waitForSelector("#homeBtn");
    await sc.evaluate(async () => { const m = await import("/shared/js/sasv-module-chrome.js"); m.mountModuleHome(document.getElementById("homeBtn")); });
    const ref = await sc.$eval("#homeBtn", grab, HOME_PROPS);
    assert.deepEqual(mis, ref, `HOME computed style differs at ${w}/${scheme}`);
    assert.notEqual(mis.backgroundColor, "rgba(0, 0, 0, 0)"); assert.notEqual(mis.backgroundColor, "rgb(244, 247, 248)", "soft home tint, not the neutral default surface");
    assert.equal(await page.$eval("#homeBtn", (b) => b.innerHTML), await sc.$eval("#homeBtn", (b) => b.innerHTML), "same glyph markup");
    const label = await page.$eval("#homeBtn .home-label", (l) => getComputedStyle(l).position); assert.equal(label, w <= 520 ? "absolute" : "static");
    await context.close();
  }
});

const GOOD_MONTHS = (a) => ({ data: { anchor: "2026-11-24", start_date: "2026-07-01", latest_mapped_date: "2026-11-24", total: 4, limit: 50, offset: 0, import_completeness: "NOT_CERTIFIED", quantity_basis: "NET_PACKAGE_COUNTS_NOT_PHYSICAL_QUANTITY", rows: [
  { dimension_id: "ALL", dimension_name: "All sales", month: "2026-11-01", sales_value: 500, source_reported_amount: 500, actual_packages: 1, billed_packages: 1, coverage: "OBSERVED_NOT_CERTIFIED" },
  { dimension_id: "ALL", dimension_name: "All sales", month: "2026-07-01", sales_value: 300, source_reported_amount: 300, actual_packages: 1, billed_packages: 1, coverage: "OBSERVED_NOT_CERTIFIED" },
  { dimension_id: "ALL", dimension_name: "All sales", month: "2026-10-01", sales_value: null, source_reported_amount: 90, actual_packages: 1, billed_packages: 1, coverage: "MISSING_OR_AMBIGUOUS_MEASURES" },
  { dimension_id: "ALL", dimension_name: "All sales", month: "2026-09-01", sales_value: 400, source_reported_amount: 400, actual_packages: 1, billed_packages: 1, coverage: "OBSERVED_NOT_CERTIFIED" }] }, error: null });

