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

const SUMMARY = { ok: true, scope: "FG_BULK_STORAGE_LOGS_AND_DEPLETING_PACKAGING", from: "2026-10-25", to: "2026-11-24", count_unit: "distinct product/batch per state; states overlap by design", total_batches: 42, governance_cutover: "2026-11-24",
  counts: { SIGNED: 3, UNSIGNED: 5, NOT_VERIFIED: 30, MISSING_ROUTE: 7 }, line_count_unit: "distinct event_skus lines in the window", line_counts: { PACKING_LINES: 90, PACKING_LINES_WITHOUT_DEPLETION: 29 }, total_items: 40, items: [], limit: 1, offset: 0 };

test("governance section: collapsed by default, states explained, historical figures labelled non-live, link present; no live call until opened", { skip: SK }, async () => {
  const { page } = await production();
  assert.equal(await page.$eval("#productionGovernance", (d) => d.open), false);
  assert.equal((await calls(page, "mis_get_governance_exception_summary_v1")).length, 0);
  await page.click("#productionGovernance > summary");
  const t = await page.textContent("#productionGovernance");
  for (const s of ["Signed", "Unsigned", "Source changed", "Missing route", "Missing FG receipt", "Not verified"]) assert.ok(t.includes(s), s);
  assert.match(t, /not live/); assert.match(t, /never backfilled/); assert.equal(await page.getAttribute("#productionGovernance a", "href"), "mis-batch-governance.html");
  await page.context().close();
});

test("live counts: shown with units, scope window and cut-over; S7 absent leaves the static text untouched; denied is stated; latest read only", { skip: SK }, async () => {
  const a = await production();
  await a.page.evaluate((s) => { window.__mis.handlers.mis_get_governance_exception_summary_v1 = () => ({ data: s, error: null }); }, SUMMARY);
  await a.page.click("#productionGovernance > summary"); await a.page.waitForFunction(() => /Live, 2026-10-25 to 2026-11-24/.test(document.getElementById("govLive").textContent));
  const live = await a.page.textContent("#govLive"); assert.match(live, /distinct product\/batch per state/); assert.match(live, /Not verified 30/); assert.match(live, /29 of 90 packing lines/); assert.match(live, /cut-over 2026-11-24/);
  const c = await calls(a.page, "mis_get_governance_exception_summary_v1"); assert.equal(c.length, 1); assert.equal(c[0].args.p_limit, 1);
  assert.match(await a.page.textContent("#productionGovernance"), /Historical, not verified/);                // static reference stays, distinct from live
  await a.page.context().close();
  const u = await production(); await u.page.evaluate(() => { window.__mis.handlers.mis_get_governance_exception_summary_v1 = () => ({ data: null, error: { code: "42883", message: "function mis_get_governance_exception_summary_v1 does not exist" } }); });
  await u.page.click("#productionGovernance > summary"); await u.page.waitForTimeout(400); assert.equal(await u.page.textContent("#govLive"), ""); assert.match(await u.page.textContent("#productionGovernance"), /Historical, not verified/); await u.page.context().close();
  const d = await production(); await d.page.evaluate(() => { window.__mis.handlers.mis_get_governance_exception_summary_v1 = () => ({ data: null, error: { code: "42501", message: "permission required" } }); });
  await d.page.click("#productionGovernance > summary"); await d.page.waitForFunction(() => /unavailable for your account/.test(document.getElementById("govLive").textContent)); await d.page.context().close();
});
