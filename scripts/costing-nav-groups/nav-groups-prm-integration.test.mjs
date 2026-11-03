// MDC-07 / N1: grouped navigation must not interfere with the merged P01 (Readiness) and P02 (Production Route
// corrections) workflows. Mock backend only (no Supabase/network). Skips cleanly without Playwright.
import test from "node:test";
import assert from "node:assert/strict";
import { launch, openPage, rpcCalls, writeCalls } from "../costing-prm-corrections/prm-corrections-harness.mjs";
import { COSTING_NAV_GROUP_CONTRACT } from "../../public/shared/js/costing-nav-groups.js";

const SKIP = process.env.COSTING_NAV_SKIP_BROWSER === "1" || process.env.COSTING_DIALOGS_BROWSER_SKIP === "1";
const NAV_ON = { COSTING_NAV_GROUPS_V1: "1" };
let env = null;
test.before(async () => { if (!SKIP) env = await launch(); });
test.after(async () => { await env?.close(); });

const PRM_LENSES = COSTING_NAV_GROUP_CONTRACT["production-route"].flatMap((g) => g.lensIds);

async function clickThroughAllLenses(page) {
  for (const lens of PRM_LENSES) {
    await page.click(`#lensPills .pill[data-lens="${lens}"]`);
    await page.waitForTimeout(250);
  }
  return rpcCalls(page);
}

test("RPC parity: the same click-through of all 13 PRM lenses issues the identical RPC sequence (names and payloads) with the nav flag ON and OFF, and no writes", async (t) => {
  if (SKIP) return t.skip("browser tests skipped");
  if (!env) return t.skip("playwright not available");
  const runs = [];
  for (const storage of [{}, NAV_ON]) {
    const { context, page, errors } = await openPage(env.browser, env.base, "", { storage });
    await page.waitForSelector('#lensPills .pill[data-lens="route-readiness"]');
    const calls = await clickThroughAllLenses(page);
    assert.deepEqual(await writeCalls(page), [], "navigation never writes");
    assert.deepEqual(errors, []);
    assert.equal((await page.locator("#lensPills .cp-nav-group").count()) > 0, !!storage.COSTING_NAV_GROUPS_V1);
    runs.push(calls);
    await context.close();
  }
  assert.ok(runs[0].length > 0);
  assert.deepEqual(runs[1], runs[0]);
});

test("P02 with grouped nav ON: Historical Evidence Review scope controls are visible and preselected from the deep link", async (t) => {
  if (SKIP) return t.skip("browser tests skipped");
  if (!env) return t.skip("playwright not available");
  const { context, page, errors } = await openPage(env.browser, env.base, "?lens=historical-candidate-review&route_family_id=12&product_id=78&product_group_id=502", { storage: NAV_ON });
  await page.waitForSelector("#prmCandidateGroups");
  for (const sel of ["#prmCandidateFamily", "#prmCandidateGroups", "#prmCandidateProduct"]) {
    assert.equal(await page.evaluate((s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, sel), true, sel);
  }
  assert.equal(await page.inputValue("#prmCandidateFamily"), "12");
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#cpNavContext .cp-breadcrumb-item")].map((e) => e.textContent)), ["Production Route Manager", "Review", "Historical Evidence Review"]);
  assert.deepEqual(await writeCalls(page), []);
  // moving to another group and back keeps the controls working
  await page.click('#lensPills .pill[data-lens="route-families"]');
  await page.waitForFunction(() => !document.getElementById("prmCandidateGroups"));
  await page.click('#lensPills .pill[data-lens="historical-candidate-review"]');
  await page.waitForSelector("#prmCandidateGroups");
  assert.deepEqual(errors, []);
  await context.close();
});

test("P02 with grouped nav ON: product route editor deep link lands on the right lens and breadcrumb, with no writes", async (t) => {
  if (SKIP) return t.skip("browser tests skipped");
  if (!env) return t.skip("playwright not available");
  const { context, page, errors } = await openPage(env.browser, env.base, "?lens=product-route-editor&product_route_id=9001&product_id=77", { storage: NAV_ON, dialogs: true });
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#lensPills .pill.active[data-lens="product-route-editor"]').count(), 1);
  assert.equal(await page.evaluate(() => document.querySelector("#cpNavContext .cp-breadcrumb-item[aria-current]")?.textContent), "Product Route Editor");
  assert.deepEqual(await writeCalls(page), []);
  assert.deepEqual(errors, []);
  await context.close();
});

test("P01 with grouped nav ON: Readiness lens still loads through its single governed read path and writes nothing", async (t) => {
  if (SKIP) return t.skip("browser tests skipped");
  if (!env) return t.skip("playwright not available");
  const { context, page, errors } = await openPage(env.browser, env.base, "?lens=route-readiness", { storage: NAV_ON });
  await page.waitForTimeout(1200);
  const names = [...new Set((await rpcCalls(page)).map((c) => c.name))];
  assert.ok(!names.some((n) => /^rpc_(create|update|upsert|delete|submit|approve|supersede)/.test(n)));
  assert.deepEqual(await writeCalls(page), []);
  assert.deepEqual(errors, []);
  await context.close();
});
