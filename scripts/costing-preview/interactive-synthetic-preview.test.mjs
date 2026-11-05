import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createReadOnlyLoopbackServer } from "./read-only-loopback-server.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const modules = [
  "costing-control-center", "material-cost-manager", "cost-build-manager",
  "pricing-policy-manager", "cost-sheet-review", "production-route-manager",
];
let server, browser, base;
test.before(async () => {
  server = await createReadOnlyLoopbackServer();
  base = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ args: ["--no-sandbox"] });
});
test.after(async () => {
  if (browser) await browser.close();
  await new Promise(resolve => server?.close(resolve));
});

test("six real Costing HTML pages show synthetic banner and load replacement view-only client", async () => {
  for (const name of modules) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const attempted = [];
    page.on("request", req => { if (!req.url().startsWith(base)) attempted.push(req.url()); });
    const response = await page.goto(base + "/shared/" + name + ".html", { waitUntil: "domcontentloaded" });
    assert.equal(response.status(), 200, name);
    await assert.doesNotReject(() => page.locator("#synthetic-preview-banner").waitFor({ timeout: 8000 }));
    assert.match(await page.locator("#synthetic-preview-banner").innerText(), /NO REAL DATA/);
    // Page scripts may block remote CDN (correct); fake client must still run.
    await page.waitForFunction(() => !!window.__costingSyntheticPreview, { timeout: 12000 });
    const state = await page.evaluate(async () => {
      const api = await import("/shared/js/supabaseClient.js");
      const permissions = await api.supabase.rpc("get_user_permissions");
      const denied = await api.supabase.rpc("rpc_refresh_costing");
      const deniedTable = await api.supabase.from("sku_prime_cost_snapshot").update({ sample: true });
      return {
        email: (await api.supabase.auth.getUser()).data.user.email,
        realClient: !!api.supabase.supabaseUrl,
        permissions: permissions.data,
        deniedRpcCode: denied.error?.code,
        deniedTableCode: deniedTable.error?.code,
        fixtureCount: window.__costingSyntheticPreview.syntheticSkus.length,
      };
    });
    assert.equal(state.email, "synthetic-preview@example.invalid", name);
    assert.equal(state.realClient, false, name);
    assert.equal(state.permissions.length, 6, name);
    assert.ok(state.permissions.every(r => r.can_view === true && r.can_edit === false), name);
    assert.equal(state.deniedRpcCode, "SYNTHETIC_PREVIEW_WRITE_DENIED", name);
    assert.equal(state.deniedTableCode, "SYNTHETIC_PREVIEW_WRITE_DENIED", name);
    assert.equal(state.fixtureCount, 2, name);
    // Any external attempt is prevented by the CSP and must not complete.
    assert.ok(attempted.every(x => !x.includes(".supabase.co")), name + ": unexpected real Supabase request");
    await context.close();
  }
});

test("synthetic sample rows are returned only from the fake status snapshot, never a costing API", async () => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  await page.goto(base + "/shared/cost-sheet-review.html", { waitUntil: "domcontentloaded" });
  const r = await page.evaluate(async () => {
    const { supabase } = await import("/shared/js/supabaseClient.js");
    const samples = await supabase.from("sku_costing_control_status_snapshot").select("sku_id,product_name");
    const protectedRead = await supabase.from("costing.sku_prime_cost_snapshot").select("*");
    return { rows: samples.data, protectedRead: protectedRead.data };
  });
  assert.equal(r.rows.length, 2);
  assert.ok(r.rows.every(x => x.product_name.startsWith("SYNTHETIC")));
  assert.deepEqual(r.protectedRead, []);
  assert.equal((await fetch(base + "/rest/v1/sku_costing_control_status_snapshot")).status, 403);
  await context.close();
});

test("every preview client module is local and real Supabase origin/key never appears in served shim", async () => {
  const response = await fetch(base + "/shared/js/supabaseClient.js");
  assert.equal(response.status, 200);
  const js = await response.text();
  assert.doesNotMatch(js, /qhmoqtxpeasamtlxaoak|supabase\.co|eyJhbGci/);
  assert.match(js, /SYNTHETIC_PREVIEW_WRITE_DENIED/);
  assert.equal((await fetch(base + "/sw.js")).status, 403);
});
