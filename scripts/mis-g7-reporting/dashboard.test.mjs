// Executive MIS dashboard: production evidence status section (static definitions + lazy live S7 counts). Browser tests drive the real
// page against the MIS-C1 in-page Supabase mock; skipped (not failed) without Playwright. Client behaviour only, not production acceptance.
import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser, openDashboard, startServer, calls } from "../mis-c1/mis-harness.mjs";

const skip = process.env.MIS_C1_SKIP_BROWSER === "1";
const chromium = skip ? null : launchBrowser();
const srv = chromium ? await startServer() : null;
const browser = chromium ? await chromium.launch() : null;
const SK = skip || !browser ? "browser unavailable" : false;
test.after(async () => { await browser?.close(); srv?.server.close(); });
const open = async (o) => openDashboard(browser, srv.base, o);
const production = async () => { const r = await open(); await r.page.click('[data-tab="production"], button:has-text("Production")'); await r.page.waitForSelector("#productionGovernance"); return r; };

const item = (n, state, detail) => ({ product_id: n, product: `Product ${n}`, batch_number: `B-${n}`, state, detail });
const SUMMARY = { ok: true, scope: "FG_BULK_STORAGE_LOGS_AND_DEPLETING_PACKAGING", from: "2026-10-26", to: "2026-11-24", count_unit: "distinct product/batch per state; states overlap by design", total_batches: 42, governance_cutover: "2026-11-24",
  counts: { SIGNED: 3, UNSIGNED: 5, NOT_VERIFIED: 30, MISSING_ROUTE: 7 }, line_count_unit: "distinct event_skus lines in the window", line_counts: { PACKING_LINES: 90, PACKING_LINES_WITHOUT_DEPLETION: 29 }, total_items: 60,
  items: Array.from({ length: 25 }, (_, i) => item(i, i % 2 ? "NOT_VERIFIED" : "MISSING_ROUTE", i % 2 ? "PACKING_LINE_WITHOUT_DEPLETION" : "MANDATORY_FG_STAGE_GAP")), limit: 25, offset: 0 };

test("evidence section: collapsed by default, states explained, historical figures labelled non-live, NO operational link; no live call until opened", { skip: SK }, async () => {
  const { page } = await production();
  assert.equal(await page.$eval("#productionGovernance", (d) => d.open), false);
  assert.equal((await calls(page, "mis_get_governance_exception_summary_v1")).length, 0);
  await page.click("#productionGovernance > summary");
  const t = await page.textContent("#productionGovernance");
  for (const s of ["Signed", "Unsigned", "Source changed", "Missing route", "Missing FG receipt", "Not verified"]) assert.ok(t.includes(s), s);
  assert.match(t, /not live/); assert.match(t, /never backfilled/); assert.match(t, /1,671 of 1,680/); assert.match(t, /only reports/);
  assert.equal(await page.$$eval("#productionGovernance a", (a) => a.length), 0, "no link out of the report (no operational route)");
  assert.equal(await page.$$eval("#productionGovernance button:not(#govPrev):not(#govNext)", (b) => b.length), 0, "no operational action control");
  await page.context().close();
});

test("live counts + drilldown: units/window/cut-over shown; server-side paging with offset; window change resets paging; latest read wins", { skip: SK }, async () => {
  const a = await production();
  await a.page.evaluate((s) => { window.__SUMMARY = s; window.__mis.handlers.mis_get_governance_exception_summary_v1 = (args) => { const d = JSON.parse(JSON.stringify(window.__SUMMARY)); d.offset = args.p_offset; d.items = d.items.slice(0, Math.max(0, Math.min(25, 60 - args.p_offset))).map((x, i) => ({ ...x, product: `P${args.p_offset + i}` })); d.from = args.p_from; d.to = args.p_to; return { data: d, error: null }; }; }, SUMMARY);
  await a.page.click("#productionGovernance > summary"); await a.page.waitForSelector("#govItems table");
  const live = await a.page.textContent("#govLive"); assert.match(live, /distinct product\/batch per state/); assert.match(live, /Not verified 30/); assert.match(live, /29 of 90 packing lines/); assert.match(live, /cut-over 2026-11-24/);
  assert.equal(await a.page.$$eval("#govItems tbody tr", (r) => r.length), 25); assert.match(await a.page.textContent("#govItems"), /1–25 of 60/);
  assert.match(await a.page.textContent("#govItems"), /Effective route has no mandatory FG bulk stage/);
  await a.page.click("#govNext"); await a.page.waitForFunction(() => /26–50 of 60/.test(document.getElementById("govItems").textContent));
  await a.page.click("#govNext"); await a.page.waitForFunction(() => /51–60 of 60/.test(document.getElementById("govItems").textContent));
  assert.equal(await a.page.$eval("#govNext", (b) => b.disabled), true);
  await a.page.selectOption("#govWindow", "7"); await a.page.waitForFunction(() => /1–25 of 60/.test(document.getElementById("govItems").textContent));
  const c = await calls(a.page, "mis_get_governance_exception_summary_v1"); assert.deepEqual(c.map((x) => x.args.p_offset), [0, 25, 50, 0]); assert.equal(c[3].args.p_limit, 25);
  assert.equal((Date.parse(c[3].args.p_to) - Date.parse(c[3].args.p_from)) / 86400000, 6);
  assert.match(await a.page.textContent("#productionGovernance"), /Historical, not verified/);
  await a.page.context().close();
});

test("S7 absent leaves the static text only; permission denied and server errors are stated; the report never hides the Production tab", { skip: SK }, async () => {
  const u = await production(); await u.page.evaluate(() => { window.__mis.handlers.mis_get_governance_exception_summary_v1 = () => ({ data: null, error: { code: "42883", message: "function mis_get_governance_exception_summary_v1 does not exist" } }); });
  await u.page.click("#productionGovernance > summary"); await u.page.waitForTimeout(400); assert.equal(await u.page.textContent("#govLive"), ""); assert.match(await u.page.textContent("#productionGovernance"), /Historical, not verified/); await u.page.context().close();
  const d = await production(); await d.page.evaluate(() => { window.__mis.handlers.mis_get_governance_exception_summary_v1 = () => ({ data: null, error: { code: "42501", message: "permission required" } }); });
  await d.page.click("#productionGovernance > summary"); await d.page.waitForFunction(() => /unavailable for your account/.test(document.getElementById("govLive").textContent)); assert.match(await d.page.textContent("#govLive"), /not live/); await d.page.context().close();
  const e = await production(); await e.page.evaluate(() => { window.__mis.handlers.mis_get_governance_exception_summary_v1 = () => ({ data: null, error: { message: "Failed to fetch" } }); });
  await e.page.click("#productionGovernance > summary"); await e.page.waitForFunction(() => /unavailable/.test(document.getElementById("govLive").textContent)); assert.ok(await e.page.$("#productionCounts")); await e.page.context().close();
});

test("responsive: no horizontal page overflow and the evidence table scrolls inside its own wrapper at 320/390/520/768/1280", { skip: SK }, async () => {
  for (const width of [320, 390, 520, 768, 1280]) {
    const r = await open({ width }); await r.page.evaluate(() => document.querySelector('[data-tab="production"]').click()); await r.page.waitForSelector("#productionGovernance");
    await r.page.evaluate((s) => { window.__mis.handlers.mis_get_governance_exception_summary_v1 = () => ({ data: s, error: null }); }, SUMMARY);
    await r.page.click("#productionGovernance > summary"); await r.page.waitForSelector("#govItems table");
    const overflow = await r.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(overflow <= 1, `page overflow ${overflow}px at ${width}`);
    assert.equal(await r.page.$eval("#govItems .mis-gov-table-wrap", (w) => getComputedStyle(w).overflowX), "auto");
    await r.page.context().close();
  }
});
