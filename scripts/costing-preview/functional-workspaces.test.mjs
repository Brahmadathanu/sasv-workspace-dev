// R4: real interactions on the real pages (search, drill-in modal, period switch, sub-tabs, workspace deep links,
// view-only vs edit-claiming identity) against contract-evidenced synthetic data. Data-dependent assertions only;
// an empty screen never passes here.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createReadOnlyLoopbackServer } from "./read-only-loopback-server.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
let server, browser, base;
test.before(async () => {
  server = await createReadOnlyLoopbackServer();
  base = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ args: ["--no-sandbox"] });
});
test.after(async () => { await browser?.close(); await new Promise((r) => server?.close(r)); });

async function open(path, { flags = [], width = 1280 } = {}) {
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width, height: 900 } });
  await context.addInitScript((list) => { for (const f of list) localStorage.setItem(f, "1"); }, flags);
  const page = await context.newPage();
  await page.goto(base + path);
  await page.waitForFunction(() => !!window.__costingSyntheticPreview);
  await page.waitForTimeout(1600);
  return { context, page };
}
const dataRows = (page) => page.evaluate(() => [...document.querySelectorAll("table tbody tr")]
  .filter((tr) => tr.querySelectorAll("td").length > 1 && !/^\s*(No |0 rows|Loading)/i.test(tr.innerText)).map((tr) => tr.innerText.replace(/\s+/g, " ").trim()));
const body = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
const denied = (page) => page.evaluate(() => window.__costingSyntheticPreview.deniedWrites.slice());

test("SKU Control Status: three outcome rows, search narrows, row opens a detail modal with the control code, period switch is honoured", async () => {
  const { context, page } = await open("/shared/costing-control-center.html?lens=sku-control-status");
  let rows = await dataRows(page);
  assert.equal(rows.length, 3);
  assert.ok(rows.some((r) => /Blocked.*Material Cost Blocked/i.test(r)) && rows.some((r) => /Review.*Material Review Required/i.test(r)) && rows.some((r) => /INFO.*Ready/i.test(r)));
  await page.fill("#search", "Powder");
  await page.waitForTimeout(700);
  rows = await dataRows(page);
  assert.equal(rows.length, 1);
  assert.match(rows[0], /Powder/);
  await page.fill("#search", "");
  await page.waitForTimeout(500);
  await page.locator("table tbody tr").first().click();
  const modal = page.locator(".modal-window").filter({ hasText: "MATERIAL_COST_BLOCKED" }).first();
  await modal.waitFor({ timeout: 5000 });
  assert.match(await modal.innerText(), /MATERIAL_COST_BLOCKED[\s\S]*SYNTHETIC fixture/i);
  await page.keyboard.press("Escape");
  await page.selectOption("#costingPeriodSelect", "2026-10-01");
  await page.waitForTimeout(1500);
  const text = await body(page);
  assert.match(text, /SYNTHETIC Approved run 900001/);
  assert.match(text, /Valuation\s*31 Oct 2026/i);
  assert.deepEqual(await denied(page), []);
  await context.close();
});

test("Dashboard KPIs and valuation date follow the selected period (Nov FAILED draft vs Oct approved)", async () => {
  const { context, page } = await open("/shared/costing-control-center.html");
  let text = await body(page);
  assert.match(text, /COSTING READINESS\s*1 \/ 3/i);
  assert.match(text, /Valuation\s*2 Nov 2026/i, "Nov valuation date must be shown, not 'unavailable'");
  assert.match(text, /SYNTHETIC DRAFT run 900004 - not approved/);
  await page.selectOption("#costingPeriodSelect", "2026-10-01");
  await page.waitForTimeout(1500);
  text = await body(page);
  assert.match(text, /COSTING READINESS\s*3 \/ 3/i);
  assert.match(text, /COSTING BLOCKED\s*0/i);
  assert.match(text, /SYNTHETIC Approved run 900001/);
  await context.close();
});

test("Control Workbench shows the BLOCKER and REVIEW material issues; Readiness shows three severities with exact counts", async () => {
  const wb = await open("/shared/costing-control-center.html?lens=costing-review-workbench");
  const rows = await dataRows(wb.page);
  assert.equal(rows.length, 2);
  assert.ok(rows.some((r) => /Herb Extract/.test(r)) && rows.some((r) => /Bottle/.test(r)));
  await wb.context.close();
  const rd = await open("/shared/costing-control-center.html?lens=portfolio-readiness");
  const rrows = await dataRows(rd.page);
  assert.equal(rrows.length, 3);
  assert.ok(rrows.some((r) => /READY/.test(r)) && rrows.some((r) => /REVIEW_REQUIRED/.test(r)) && rrows.some((r) => /BLOCKER.*UNRESOLVED|UNRESOLVED.*BLOCKER/.test(r)));
  assert.match(await body(rd.page), /Export CSV \(3 rows\)/);
  await rd.context.close();
});

test("Material Cost Manager: manual-rate queue shows missing-rate BLOCKER and manual-rate REVIEW items; trace tabs are restricted", async () => {
  const { context, page } = await open("/shared/material-cost-manager.html");
  const rows = await dataRows(page);
  assert.equal(rows.length, 2);
  assert.ok(rows.some((r) => /ADD_MANUAL_RATE.*MISSING MATERIAL RATE.*Herb Extract/i.test(r)));
  assert.ok(rows.some((r) => /REVIEW_MANUAL_RATE.*MANUAL RATE USED.*Bottle.*₹50\.00/i.test(r)));
  await page.locator('button[data-lens="rm-cost-trace"]').click();
  await page.waitForTimeout(800);
  assert.match(await body(page), /Restricted RM contribution detail/i);
  await context.close();
});

test("Cost Build Manager: every sub-tab of Cost Governance shows rows; staff, provisions and driver registry are populated", async () => {
  const { context, page } = await open("/shared/cost-build-manager.html");
  assert.equal((await dataRows(page)).length, 3);
  for (const [tab, min, pattern] of [["mapping-register", 2, /Mapped Head 1/], ["excluded", 1, /Excluded Head 3/], ["cost-pool-summary", 2, /₹3,500\.00/]]) {
    await page.locator('button[data-cost-governance-tab^="' + tab.slice(0, 10) + '"]').click();
    await page.waitForTimeout(800);
    const tabRows = await dataRows(page);
    assert.ok(tabRows.length >= min, tab + " rows " + tabRows.length);
    assert.match(tabRows.join("\n"), pattern, tab);
  }
  await page.locator('button[data-lens="staff-governance"]').click();
  await page.waitForTimeout(900);
  assert.match((await dataRows(page))[0], /UNCLASSIFIED.*Staff Member/);
  await page.locator('button[data-lens="manual-provisions"]').click();
  await page.waitForTimeout(900);
  assert.match((await dataRows(page))[0], /SYN-PROV-900001.*₹1,000\.00/);
  await page.locator('button[data-lens="driver-governance"]').click();
  await page.waitForTimeout(900);
  const drivers = await dataRows(page);
  assert.equal(drivers.length, 7);
  assert.ok(drivers.some((r) => /Direct Labour.*REVIEW.REQUIRED/i.test(r)) && drivers.some((r) => /Production Overhead.*APPROVED/i.test(r)));
  await context.close();
});

test("Pricing Policy Manager: all ten workspaces open from the tab strip and a ?workspace= deep link, each with its own synthetic rows", async () => {
  const expected = { "sku-mrp-policies": [3, /₹200\.00.*₹220\.00/], "product-derivation-policies": [1, /Sample Oil/], "mrp-proposals": [4, /SYN-PROP-900001/],
    "proposal-decisions": [1, /SYN-PROP-900002/], "approved-for-application": [1, /SYN-PROP-900003/], "applied-proposal-history": [1, /SYN-PROP-900004/],
    "sku-overview": [3, /Buy 10 Get 1/], "scheme-master": [2, /Buy 20 Get 3/], "scheme-rule-register": [1, /IK|Inside/], "commercial-sales-assumptions": [3, /ACTUAL_SALES|MANUAL_ASSUMPTION/] };
  const { context, page } = await open("/shared/pricing-policy-manager.html");
  assert.match(await body(page), /View-only access — editing actions are unavailable/);
  for (const [id, [min, pattern]] of Object.entries(expected)) {
    await page.locator('button[data-pricing-policy-workspace="' + id + '"]').click();
    await page.waitForTimeout(1100);
    const rows = await dataRows(page);
    assert.ok(rows.length >= min, id + ": " + rows.length + " rows < " + min);
    assert.match(rows.join("\n"), pattern, id);
    assert.doesNotMatch(await body(page), /No synthetic fixture|cannot populate offline|Failed to load/i, id);
  }
  await page.goto(base + "/shared/pricing-policy-manager.html?workspace=scheme-master");
  await page.waitForTimeout(1600);
  assert.ok((await dataRows(page)).length >= 2, "deep link must land on Scheme Master");
  await context.close();
});

test("Pricing Policy SKU Overview shows IK and OK separately with scheme choices and bridge status per SKU", async () => {
  const { context, page } = await open("/shared/pricing-policy-manager.html?workspace=sku-overview");
  const text = await body(page);
  assert.match(text, /MRP IK/i);
  assert.match(text, /MRP OK/i);
  assert.match(text, /SCHEME IK/i);
  assert.match(text, /SCHEME OK/i);
  const rows = await dataRows(page);
  assert.equal(rows.length, 3);
  assert.ok(rows.some((r) => /READY/.test(r)) && rows.some((r) => /REVIEW_REQ/.test(r)) && rows.some((r) => /BLOCKED/.test(r)));
  await page.locator('button[data-pricing-policy-workspace="scheme-rule-register"]').click();
  await page.waitForTimeout(800);
  assert.equal((await dataRows(page)).length, 1);
  await page.getByText(/rule history/i).first().click();
  await page.waitForTimeout(700);
  assert.match((await dataRows(page)).join("\n"), /CLOSED/);
  await context.close();
});

test("Cost Sheet Review: detail, printable summary, MoM comparison and scheme comparison each carry synthetic numbers; blocked SKU has no cost", async () => {
  const { context, page } = await open("/shared/cost-sheet-review.html");
  let rows = await dataRows(page);
  assert.equal(rows.length, 3);
  const blocked = rows.find((r) => /Tablet/.test(r));
  assert.match(blocked ?? "", /₹400\.00\s*₹440\.00\s*--\s*--\s*--\s*BLOCKED/, "blocked SKU shows MRP but no cost/price: " + blocked);
  for (const [lens, pattern] of [["printable-cost-sheet", /Sample Oil.*1 SKU|Sample Oil/], ["cost-comparison", /Sample Oil/], ["scheme-comparison", /Buy 10 Get 1/]]) {
    await page.locator('button[data-lens="' + lens + '"]').click();
    await page.waitForTimeout(1100);
    rows = await dataRows(page);
    assert.equal(rows.length, 3, lens);
    assert.match(rows.join("\n"), pattern, lens);
  }
  await page.locator('button[data-lens="qc-action-queue"]').click();
  await page.waitForTimeout(900);
  assert.match((await dataRows(page)).join("\n"), /MISSING_FG_PROTOCOL|Missing FG protocol/i);
  await page.locator('button[data-lens="materials-stores-action-queue"]').click();
  await page.waitForTimeout(900);
  assert.match((await dataRows(page)).join("\n"), /NO_RM_OR_PM_STANDARD_EVIDENCE|No RM or PM standard evidence/i);
  await context.close();
});

test("Production Route Manager: readiness status counts, assignments, subgroup mappings, route families, cost centres and archive are populated", async () => {
  const { context, page } = await open("/shared/production-route-manager.html");
  let rows = await dataRows(page);
  assert.equal(rows.length, 3);
  assert.match(rows.join("\n"), /Route Family A Ready[\s\S]*Quantity review required[\s\S]*Approved Family Route missing/);
  for (const [lens, min, pattern] of [["product-route-assignments", 2, /Route Family A/], ["product-subgroup-mappings", 3, /Subgroup B2/], ["route-families", 2, /SYN-FAM-B/],
    ["production-cost-centres", 3, /SYN-CC-1/], ["archived-routes", 1, /Retired Route Family/]]) {
    await page.locator('button[data-lens="' + lens + '"]').click();
    await page.waitForTimeout(1100);
    rows = await dataRows(page);
    assert.ok(rows.length >= min, lens + " rows " + rows.length);
    assert.match(rows.join("\n"), pattern, lens);
  }
  await context.close();
});

test("view-only identity shows the notice and cannot write; an edit-claiming identity loses the notice yet every write is still denied", async () => {
  const view = await open("/shared/pricing-policy-manager.html?workspace=scheme-master");
  assert.match(await body(view.page), /View-only access/);
  await view.context.close();
  const edit = await open("/shared/pricing-policy-manager.html?workspace=scheme-master&synthetic_priv=edit-claimed");
  assert.doesNotMatch(await body(edit.page), /View-only access — editing actions are unavailable/);
  const result = await edit.page.evaluate(async () => {
    const { supabase } = await import("/shared/js/supabaseClient.js");
    return [(await supabase.rpc("rpc_create_scheme_master", { p_scheme_name: "x" })).error?.code, (await supabase.rpc("rpc_deactivate_scheme_master", { p_scheme_id: 900001 })).error?.code,
      (await supabase.from("v_costing_scheme_master_register").update({ is_active: false })).error?.code];
  });
  assert.deepEqual(result, Array(3).fill("SYNTHETIC_PREVIEW_WRITE_DENIED"));
  const rows = await dataRows(edit.page);
  assert.equal(rows.length, 2, "data unchanged after denied writes");
  await edit.context.close();
});

test("Navigation Only: group labels and context chips appear, role-restricted trace lenses disappear, data is identical", async () => {
  const off = await open("/shared/costing-control-center.html?lens=sku-control-status");
  const on = await open("/shared/costing-control-center.html?lens=sku-control-status", { flags: ["COSTING_NAV_GROUPS_V1"] });
  const offText = await body(off.page), onText = await body(on.page);
  assert.doesNotMatch(offText, /Run-scoped · frozen data/i);
  assert.match(onText, /OVERVIEW/);
  assert.match(onText, /WORKBENCH/);
  assert.match(onText, /SKU REVIEW/);
  assert.match(onText, /Run-scoped · frozen data of the governed costing run/i);
  assert.deepEqual(await dataRows(on.page), await dataRows(off.page));
  await off.context.close(); await on.context.close();
  const mcmOff = await open("/shared/material-cost-manager.html");
  const mcmOn = await open("/shared/material-cost-manager.html", { flags: ["COSTING_NAV_GROUPS_V1"] });
  assert.equal(await mcmOff.page.locator('button[data-lens="rm-cost-trace"]').isVisible(), true);
  assert.equal(await mcmOn.page.locator('button[data-lens="rm-cost-trace"]').isVisible(), false);
  await mcmOff.context.close(); await mcmOn.context.close();
});

test("390px mobile: lens picker is a select, a lens switches by select, and the data renders without horizontal scroll", async () => {
  const { context, page } = await open("/shared/cost-sheet-review.html", { width: 390 });
  assert.equal(await page.locator('button[data-lens="printable-cost-sheet"]').isVisible(), false);
  await page.locator("#lensSelect").selectOption("cost-comparison");
  await page.waitForTimeout(1200);
  assert.match(await body(page), /SYNTHETIC Sample Oil/);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1);
  await context.close();
});
