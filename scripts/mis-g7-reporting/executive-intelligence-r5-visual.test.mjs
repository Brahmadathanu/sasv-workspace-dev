// EI R5 final: HOME computed parity with Stock Checker, responsive record cards, data-backed visual intelligence.
// Pure model tests always run; browser tests use the MIS-C1 in-page Supabase mock (skipped, not failed, without Playwright).
// Synthetic fixtures only: NOT owner production evidence.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { barSeriesLoose, comparisonBars, windowBars, monthlyTrend, rankedPageBars, facilityBars, facilityModel, subsetShare, segmentSeries, alertSegments, fgStatusSegments, materialFgBars } from "../../public/shared/js/executive-intelligence-model.js";
import { launchBrowser, openDashboard, startServer, calls, setHandler } from "../mis-c1/mis-harness.mjs";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

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

test("static: bounded scope, cache keys advanced, cards are CSS over the same markup (no second table), no new dependency, token-only", () => {
  const html = read("public/shared/executive-mis-dashboard.html"), js = read("public/shared/js/executive-mis-dashboard.js");
  assert.match(html, /<html lang="en-GB" data-sasv-theme="sasv-core">/, "the shared themed home tokens");
  assert.match(html, /executive-mis-dashboard\.js\?mis-c1=ei-r7-1/); assert.match(js, /executive-intelligence-model\.js\?ei-r7=1/);
  assert.doesNotMatch(js, /import\s+[^;]*from\s+"https?:/); assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  const r5 = html.slice(html.indexOf("EI-R5 final: visual intelligence"));
  assert.ok(r5.length > 2500); assert.doesNotMatch(r5, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  assert.match(r5, /@media \(max-width: 640px\)[^{]*\{[^]*table\.ei-cards/);
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

const LENS_TABLES = [
  ["finance", ".finance-table", null], ["inventory", ".inventory-table", null], ["finished-goods", ".fg-table", null],
  ["alerts", ".ei-alerts .ei-table", null], ["sales", "#salesCmp .ei-table", null],
  ["sales", ".sales-table td", "mtd"], ["sales", "#salesHistResults .ei-table", "history"], ["sales", "#salesExcResults .ei-table", "exceptions"],
  ["sales", "#salesFac .ei-table", "facility"], ["sales", "#salesCov .ei-table", "coverage"],
];
async function openLens(lens, view, w) {
  const r = await open({ width: w, height: 800, lens });
  await r.page.waitForSelector(".ei-lens, .finance-table, .inventory-table, .fg-table");
  if (view) await r.page.click(`[data-sales-view="${view}"]`);
  return r;
}

test("record cards: phone tables become labelled cards over the SAME rows (parity, no overflow, no second request); desktop stays a table", { skip: SK }, async () => {
  for (const [lens, sel, view] of LENS_TABLES) {
    const tsel = sel.replace(/ td$/, "");
    const wide = await openLens(lens, view, 1280); await wide.page.waitForSelector(sel);
    const d = await wide.page.$eval(tsel, (t) => ({ display: getComputedStyle(t).display, rows: t.tBodies[0].rows.length, texts: [...t.tBodies[0].rows].map((r) => [...r.cells].map((c) => c.textContent.trim())) }));
    assert.equal(d.display, "table", `${lens}/${view}: desktop keeps the table`);
    const rpcAt1280 = (await calls(wide.page)).map((c) => c.name).sort().join(",");
    await wide.context.close();
    for (const w of [320, 390, 520]) {
      const { page, context } = await openLens(lens, view, w); await page.waitForSelector(sel);
      await page.waitForSelector(`${tsel}.ei-cards`);
      const m = await page.$eval(tsel, (t) => { const rows = [...t.tBodies[0].rows]; const cs = getComputedStyle(rows[0]); return { tdisplay: getComputedStyle(t).display, rowDisplay: cs.display, rows: rows.length, texts: rows.map((r) => [...r.cells].map((c) => c.textContent.trim())), labeled: rows.every((r) => [...r.cells].every((c) => c.hasAttribute("data-label"))), primary: rows.every((r) => r.querySelectorAll("[data-card-primary]").length === 1), roles: t.getAttribute("role") + "/" + rows[0].getAttribute("role") + "/" + rows[0].cells[0].getAttribute("role"), ids: document.querySelectorAll("[id]").length === new Set([...document.querySelectorAll("[id]")].map((e) => e.id)).size }; });
      assert.equal(m.tdisplay, "block", `${lens}/${view}@${w}: card layout`); assert.equal(m.rowDisplay, "grid");
      assert.deepEqual(m.texts, d.texts, `${lens}/${view}@${w}: same rows and cell values as the desktop table`);
      assert.ok(m.labeled && m.primary, "every cell labelled, exactly one identity cell per card"); assert.equal(m.roles, "table/row/cell"); assert.ok(m.ids, "no duplicate ids");
      assert.ok((await overflow(page)) <= 0, `${lens}/${view}@${w}: no page overflow`);
      const wrapOverflow = await page.$eval(tsel, (t) => { const w = t.closest(".ei-table-wrap, .finance-table-wrap, .sales-table-wrap, .inventory-table-wrap, .fg-table-wrap"); return w ? w.scrollWidth - w.clientWidth : 0; });
      assert.ok(wrapOverflow <= 1, `${lens}/${view}@${w}: no horizontal scrolling inside the card list (${wrapOverflow})`);
      if (w === 390) assert.equal((await calls(page)).map((c) => c.name).sort().join(","), rpcAt1280, `${lens}/${view}: identical requests, no card-only fetch`);
      await context.close();
    }
  }
});

test("record cards: finance row stays a keyboard-operable record (Enter opens bills); month grid stays a contained scrolling matrix", { skip: SK }, async () => {
  const { page, context } = await openLens("finance", null, 390); await page.waitForSelector(".finance-table.ei-cards");
  await page.focus(".finance-table tbody tr"); assert.equal(await page.$eval(".finance-table tbody tr", (r) => r.getAttribute("aria-haspopup")), "dialog");
  await page.keyboard.press("Enter"); await page.waitForSelector(".finance-table-wrap .finance-table.ei-cards, #financeModalContent .finance-table", { timeout: 5000 });
  assert.ok((await overflow(page)) <= 0);
  await context.close();
  const g = await openLens("sales", "history", 390); await g.page.waitForSelector("#salesHistResults .ei-table");
  await g.page.selectOption("#salesHistGroup", "product_month"); await g.page.waitForSelector("[data-hist-grid]"); await g.page.click("[data-hist-grid]");
  await g.page.waitForSelector(".ei-grid");
  const grid = await g.page.$eval(".ei-grid", (t) => ({ display: getComputedStyle(t).display, cards: t.classList.contains("ei-cards"), wrapScroll: t.closest(".ei-table-wrap").scrollWidth > t.closest(".ei-table-wrap").clientWidth, hint: getComputedStyle(document.querySelector(".ei-grid-hint")).display }));
  assert.deepEqual([grid.display, grid.cards, grid.hint], ["table", false, "block"]); assert.ok(grid.wrapScroll, "contained scrolling with a visible hint");
  assert.ok((await overflow(g.page)) <= 0, "the page itself never scrolls sideways");
  await g.context.close();
});

const GOOD_MONTHS = (a) => ({ data: { anchor: "2026-11-24", start_date: "2026-07-01", latest_mapped_date: "2026-11-24", total: 4, limit: 50, offset: 0, import_completeness: "NOT_CERTIFIED", quantity_basis: "NET_PACKAGE_COUNTS_NOT_PHYSICAL_QUANTITY", rows: [
  { dimension_id: "ALL", dimension_name: "All sales", month: "2026-11-01", sales_value: 500, source_reported_amount: 500, actual_packages: 1, billed_packages: 1, coverage: "OBSERVED_NOT_CERTIFIED" },
  { dimension_id: "ALL", dimension_name: "All sales", month: "2026-07-01", sales_value: 300, source_reported_amount: 300, actual_packages: 1, billed_packages: 1, coverage: "OBSERVED_NOT_CERTIFIED" },
  { dimension_id: "ALL", dimension_name: "All sales", month: "2026-10-01", sales_value: null, source_reported_amount: 90, actual_packages: 1, billed_packages: 1, coverage: "MISSING_OR_AMBIGUOUS_MEASURES" },
  { dimension_id: "ALL", dimension_name: "All sales", month: "2026-09-01", sales_value: 400, source_reported_amount: 400, actual_packages: 1, billed_packages: 1, coverage: "OBSERVED_NOT_CERTIFIED" }] }, error: null });

test("visual intelligence: Sales comparison/window bars, History monthly trend (gaps, partial, unavailable) and page-only ranking; no fake trend for a partial series", { skip: SK }, async () => {
  const { page, context } = await open({ width: 1280, lens: "sales" }); await page.waitForSelector("#salesCmp .ei-bars");
  const cmp = await page.$$eval("#salesCmp .ei-bar-row", (r) => r.map((x) => [x.querySelector(".ei-bar-label").textContent, x.querySelector(".ei-bar-value").textContent, x.classList.contains("ei-bar-gap")]));
  assert.deepEqual(cmp.map((r) => r[0]), ["Current", "Previous month", "Previous year"]); assert.deepEqual(cmp[2].slice(1), ["No recorded rows", true], "missing period is a labelled gap, not a zero bar");
  assert.match(await page.textContent("#salesCmp .ei-chart"), /not certified/i);
  const win = await page.$$eval("#salesWin .ei-bar-row", (r) => r.map((x) => [x.querySelector(".ei-bar-value").textContent, x.classList.contains("ei-bar-gap")]));
  assert.equal(win.length, 2); assert.equal(win[1][1], true, "12-month window has no valued average");
  // default fixture: month group returns 50 of 60 rows => no trend, and it says so
  await page.click('[data-sales-view="history"]'); await page.waitForSelector("#salesHistResults .ei-table");
  assert.equal(await page.$$eval("#salesHistResults .ei-cols", (e) => e.length), 0); assert.match(await page.textContent("#salesHistResults"), /No monthly trend is drawn/);
  await setHandler(page, "ei_sales_history", (a) => ({ data: { anchor: "2026-11-24", start_date: "2026-07-01", latest_mapped_date: "2026-11-24", total: 4, limit: 50, offset: 0, import_completeness: "NOT_CERTIFIED", rows: [
    { dimension_id: "ALL", dimension_name: "All sales", month: "2026-11-01", sales_value: 500, source_reported_amount: 500, coverage: "OBSERVED_NOT_CERTIFIED" },
    { dimension_id: "ALL", dimension_name: "All sales", month: "2026-07-01", sales_value: 300, source_reported_amount: 300, coverage: "OBSERVED_NOT_CERTIFIED" },
    { dimension_id: "ALL", dimension_name: "All sales", month: "2026-10-01", sales_value: null, source_reported_amount: 90, coverage: "MISSING_OR_AMBIGUOUS_MEASURES" },
    { dimension_id: "ALL", dimension_name: "All sales", month: "2026-09-01", sales_value: 400, source_reported_amount: 400, coverage: "OBSERVED_NOT_CERTIFIED" }] }, error: null }));
  await page.selectOption("#salesHistGroup", "product"); await page.selectOption("#salesHistGroup", "month");
  await page.waitForSelector("#salesHistResults .ei-cols");
  const cols = await page.$$eval("#salesHistResults .ei-col", (c) => c.map((x) => [x.className.replace("ei-col ", ""), x.getAttribute("aria-label")]));
  assert.deepEqual(cols.map((c) => c[0].split(" ")[0]), ["ei-col-ok", "ei-col-missing", "ei-col-ok", "ei-col-unavailable", "ei-col-ok"].map((x) => x), "Jul..Nov chronological: Aug has no row (gap), Oct unavailable");
  assert.match(cols[1][1], /No row returned.*not zero/); assert.match(cols[3][1], /Unavailable; source reported .*not certified/); assert.match(cols[4][1], /partial month/);
  assert.equal(await page.$eval("#salesHistResults .ei-cols .ei-col:last-child .ei-col-bar", (b) => b.classList.contains("ei-col-partial")), true);
  assert.ok(await page.$eval("#salesHistResults .ei-col", (e) => e.tabIndex === 0), "focusable with a text equivalent");
  // non-month grouping: ranked bars say page-only
  await page.selectOption("#salesHistGroup", "product"); await page.waitForSelector("#salesHistResults .ei-bars");
  assert.match(await page.textContent("#salesHistResults .ei-chart .ei-bars-note"), /This page only.*Not a share of the total/);
  // facility
  await page.click('[data-sales-view="facility"]'); await page.waitForSelector("#salesFac .ei-bars");
  const fac = await page.$$eval("#salesFac .ei-bar-row", (r) => r.map((x) => [x.querySelector(".ei-bar-label").textContent, x.querySelector(".ei-bar-value").textContent, x.classList.contains("ei-bar-gap")]));
  assert.ok(fac.find((r) => /sample/i.test(r[0]) && r[2] && /missing an amount/.test(r[1])), "scope with a missing amount is a gap, not zero");
  assert.match(await page.textContent("#salesFac .ei-chart"), /not product sales/);
  await context.close();
});

test("visual intelligence: Overview, Finance, Materials, FG, Production and Alerts graphics carry basis, text and subset semantics; sales-only/denied get none", { skip: SK }, async () => {
  const ov = await open({ width: 1280, lens: "overview" }); await ov.page.waitForSelector(".ei-overview .kpi-card");
  await ov.page.waitForFunction(() => [...document.querySelectorAll(".kpi-card")].every((c) => !/Loading/.test(c.textContent))); await ov.page.waitForSelector("[data-domain=production] .ei-subset");
  assert.equal(await ov.page.$$eval(".ei-exec-summary a[data-lens-link]", (a) => a.length), 4, "executive summary intact");
  assert.equal(await ov.page.$$eval(".kpi-info-btn", (b) => b.length), 10, "ten provenance controls intact");
  assert.match(await ov.page.textContent("[data-domain=stock] .ei-chart"), /never added into one stock total/);
  assert.match(await ov.page.textContent("[data-domain=production] .ei-subset"), /59 overdue \(59%\)/); assert.match(await ov.page.textContent("[data-domain=production]"), /not a sequence or throughput/);
  assert.match(await ov.page.textContent("[data-domain=finance]"), /Net sundry position \(signed/); assert.match(await ov.page.textContent("[data-domain=sales]"), /nothing is loaded here for them/);
  assert.equal((await calls(ov.page, "ei_sales_history")).length + (await calls(ov.page, "ei_sales_comparison")).length, 0, "no eager sales fan-out from Overview");
  await ov.context.close();
  const fin = await open({ width: 1280, lens: "finance" }); await fin.page.waitForSelector("#financeChart .ei-bars");
  assert.match(await fin.page.textContent("#financeChart"), /No ageing is shown/); await fin.context.close();
  const fg = await open({ width: 1280, lens: "finished-goods" }); await fg.page.waitForSelector(".fg-table");
  const seg = await fg.page.$$("figure.ei-chart .ei-seg"); if (seg.length) assert.match(await fg.page.$eval(".ei-seg", (e) => e.getAttribute("aria-label")), /SKUs/);
  await fg.context.close();
  const pr = await open({ width: 1280, lens: "production" }); await pr.page.waitForSelector("#productionCounts .ei-subset");
  assert.ok(await pr.page.$("#productionCounts .ei-bars")); await pr.context.close();
  const al = await open({ width: 1280, lens: "alerts" }); await al.page.waitForSelector(".ei-seg");
  const label = await al.page.$eval(".ei-seg", (e) => e.getAttribute("aria-label")); assert.match(label, /Needs review 2/); assert.match(label, /No findings 1/); assert.match(label, /Unavailable 1/);
  assert.match(await al.page.textContent(".ei-alerts"), /Unavailable is its own state and is never counted as clear/); await al.context.close();
  const so = await open({ width: 1280, permission: "sales-only", lens: "sales" }); await so.page.waitForSelector("#salesCmp");
  assert.equal(await so.page.$$eval("[data-lens-link=alerts], [data-lens-link=finance]", (x) => x.length), 0); assert.equal(await so.page.$$eval("[data-domain=finance]", (x) => x.length), 0);
  assert.equal((await calls(so.page, "mv_mis_executive_summary")).length, 0, "sales-only reads no executive data"); await so.context.close();
  const dn = await open({ width: 1280, permission: "denied", lens: "overview" }); await dn.page.waitForTimeout(500);
  assert.equal(await dn.page.$$eval(".ei-chart, .ei-seg, .ei-bars", (x) => x.length), 0); await dn.context.close();
});

test("visual intelligence: charts and cards fit 320/390/520/768/1280 with no page overflow", { skip: SK }, async () => {
  for (const w of [320, 390, 520, 768, 1280]) for (const [lens, view] of [["overview", null], ["finance", null], ["production", null], ["alerts", null], ["sales", null], ["sales", "facility"], ["sales", "history"]]) {
    const { page, context } = await open({ width: w, height: 800, lens });
    await page.waitForSelector(".ei-lens, .ei-overview"); if (view) await page.click(`[data-sales-view="${view}"]`); await page.waitForTimeout(250);
    assert.ok((await overflow(page)) <= 0, `${lens}/${view}@${w}: page overflow ${await overflow(page)}`);
    const clipped = await page.$$eval(".ei-chart", (cs) => cs.filter((c) => c.scrollWidth > c.clientWidth + 1).length); assert.equal(clipped, 0, `${lens}/${view}@${w}: chart clipped`);
    await context.close();
  }
});
