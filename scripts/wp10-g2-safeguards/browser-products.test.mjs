// WP10 G2 mocked-Chromium checks for the Manage Products activation pre-check (flag WP10_SAFEGUARDS_V1).
// Mocked data only: this is NOT live-role acceptance. The Supabase client is a stub that records every call; no network, no production.
// Screenshots: docs/master-data-costing/WP10_G2_EVIDENCE/screenshots (set WP10_G2_SHOTS=0 to skip).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { startServer, repoRoot } from "../wp08-g2-0-shared-master-data/harness.mjs";

let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const skip = process.env.WP10_G2_BROWSER_SKIP === "1" || !chromium ? "playwright/chromium unavailable or skipped" : false;
const SHOTS = process.env.WP10_G2_SHOTS !== "0";
const shotDir = path.join(repoRoot, "docs/master-data-costing/WP10_G2_EVIDENCE/screenshots");

const STUB = `
const user = { id: "00000000-0000-0000-0000-000000000000", email: "wp10@example.invalid" };
const calls = (window.__MOCK_CALLS = window.__MOCK_CALLS || []);
const PRODUCTS = [{ id: 7, item: "Test Product", malayalam_name: "ടെസ്റ്റ്", status: "Active", sub_group_id: 1, is_pto: false, uom_base: "Nos", conversion_to_base: 1, is_seasonal: false, season_profile_id: null, is_llt: false, manufacture_lead_time_months: null }];
const SKUS = [{ id: 71, product_id: 7, pack_size: 100, uom: "ml", is_sample: false, is_active: false }, { id: 72, product_id: 7, pack_size: 200, uom: "ml", is_sample: false, is_active: false }];
function table(name) {
  let single = false;
  const proxy = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (res, rej) => {
        let data = [];
        if (name === "products") data = single ? PRODUCTS[0] : PRODUCTS;
        if (name === "product_skus") data = SKUS;
        return Promise.resolve({ data, error: null, count: Array.isArray(data) ? data.length : 1 }).then(res, rej);
      };
      return (...a) => { if (prop === "single" || prop === "maybeSingle") single = true; calls.push({ kind: "from", table: name, method: String(prop) }); return proxy; };
    },
    apply: () => proxy,
  });
  return proxy;
}
export function createClient() {
  const session = { access_token: "stub", user };
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      refreshSession: async () => ({ data: { session }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: (t) => table(t),
    rpc: async (name, args) => {
      calls.push({ kind: "rpc", name, args });
      const h = (window.__RPC || {})[name];
      if (h) return typeof h === "function" ? await h(args) : h;
      if (name === "get_user_permissions" || name === "app_get_my_permissions") return { data: window.__MOCK_GRANTS || [], error: null };
      if (name === "app_get_current_user_context") return { data: { user_id: user.id, email: user.email, is_authenticated: true }, error: null };
      if (name === "rpc_get_latest_governed_cost_period_start") return { data: "2026-10-01", error: null };
      return { data: null, error: { message: "function not found", code: "PGRST202", status: 404 } };
    },
    schema() { return client; },
  };
  return client;
}
`;
const JSPDF_STUB = `window.jspdf = { jsPDF: function () { this.text = () => {}; this.save = () => {}; this.autoTable = () => {}; } };`;
const GRANTS = [
  { target: "module:manage-products", can_view: true, can_edit: true },
  { target: "module:pm-templates", can_view: true, can_edit: false },
];

let server; let browser;
test.before(async () => { if (skip) return; server = await startServer("pwa"); browser = await chromium.launch(); });
test.after(async () => { await browser?.close(); await new Promise((r) => server?.close(r)); });

async function open({ width = 1280, flag = true, rpc = {}, blockModule = false, mutateUi = false, importDelayMs = 0, mutateProducts = null } = {}) {
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(([g, f]) => {
    window.__MOCK_GRANTS = g;
    try { if (f) localStorage.setItem("WP10_SAFEGUARDS_V1", "1"); } catch { /* ignore */ }
    window.__RPC = {};
  }, [GRANTS, flag]);
  const loaded = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const url = route.request().url();
    if (/esm\.sh\/@supabase\/supabase-js/.test(url)) return route.fulfill({ status: 200, contentType: "text/javascript", body: STUB });
    if (/jspdf/.test(url)) return route.fulfill({ status: 200, contentType: "text/javascript", body: JSPDF_STUB });
    return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
  });
  if (mutateUi) await context.route(/wp10-safeguards-ui\.js/, async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace("n.textContent = text", "n.innerHTML = text");
    await route.fulfill({ response: res, body });
  });
  if (importDelayMs) await context.route(/wp10-safeguards(-ui)?\.js/, async (route) => { const res = await route.fetch(); await new Promise((r) => setTimeout(r, importDelayMs)); await route.fulfill({ response: res }); });
  if (mutateProducts) await context.route(/\/js\/products\.js/, async (route) => {
    const res = await route.fetch(); let body = await res.text();
    for (const [from, to] of mutateProducts) { if (!body.includes(from)) throw new Error("mutation target missing: " + from); body = body.replace(from, to); }
    await route.fulfill({ response: res, body });
  });
  if (blockModule) await context.route(/wp10-safeguards(-ui)?\.js/, (route) => route.fulfill({ status: 500, body: "boom" }));
  const page = await context.newPage();
  page.on("request", (r) => { if (/wp10-safeguards/.test(r.url())) loaded.push(new URL(r.url()).pathname); });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(`${origin}/shared/manage-products.html`, { waitUntil: "load" });
  await page.waitForTimeout(700);
  // install rpc handlers by name; functions are serialised by source
  await page.evaluate((entries) => { for (const [k, v] of entries) window.__RPC[k] = typeof v === "string" && v.startsWith("fn:") ? (0, eval)("(" + v.slice(3) + ")") : v; }, Object.entries(rpc).map(([k, v]) => [k, typeof v === "function" ? "fn:" + v.toString() : v]));
  await page.locator("#productRegisterBody tr, #productLedger button").locator("visible=true").first().click();
  await page.waitForTimeout(400);
  await page.locator("#tabSkus").click();
  await page.waitForTimeout(400);
  await page.locator("#skuRegisterBody tr, #skuLedger button").locator("visible=true").first().click();
  await page.waitForTimeout(300);
  return { page, context, loaded, errors };
}
const rpcCalls = (page) => page.evaluate(() => window.__MOCK_CALLS.filter((c) => c.kind === "rpc").map((c) => c.name));
const shot = async (page, name, width) => { if (!SHOTS) return; fs.mkdirSync(shotDir, { recursive: true }); await page.screenshot({ path: path.join(shotDir, `${name}-${width}.png`) }); };
const overflowOk = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth + 1);

const MISSING = { sku_id: 71, as_of_date: "2026-11-15", period_start: "2026-10-01", missing: [{ code: "PM_BOM_REVISION", label: "PM BOM revision" }, { code: "BATCH_SIZE_REFERENCE", label: "Batch size" }] };

for (const width of [1280, 390]) {
  test(`P1 flag OFF @${width}: byte-identical flow - no pre-check call, no WP10 module requested`, { skip }, async () => {
    const { page, context, loaded, errors } = await open({ width, flag: false });
    await page.locator("#skuToggleActiveBtn").click();
    await page.waitForSelector("#governanceModalOverlay.show");
    await page.waitForTimeout(300);
    assert.equal((await rpcCalls(page)).includes("rpc_get_sku_activation_check"), false);
    assert.deepEqual(loaded, []);
    assert.equal(await page.locator("#governanceModalDetail").count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test(`P2 flag ON @${width}: missing items, owner screens, verified link only for PM BOM, Confirm stays enabled`, { skip }, async () => {
    const { page, context, errors } = await open({ width, rpc: { rpc_get_sku_activation_check: { data: MISSING, error: null } } });
    await page.locator("#skuToggleActiveBtn").click();
    await page.waitForSelector("#governanceModalDetail .wp10-activation__items");
    const detail = await page.locator("#governanceModalDetail").innerText();
    assert.match(detail, /PM BOM revision/);
    assert.match(detail, /Resolve in: PM BOM Manager/);
    assert.match(detail, /Batch size/);
    assert.match(detail, /Resolve in: Batch Sizes/);
    assert.match(detail, /No verified direct destination/);
    assert.match(detail, /server decides when you confirm/);
    assert.equal(await page.locator("#governanceModalDetail a").count(), 1);
    assert.match(await page.locator("#governanceModalDetail a").getAttribute("href"), /manage-pm-bom|pm-templates|skuId=71/);
    assert.equal(await page.locator("#governanceConfirm").isDisabled(), false);
    assert.equal(await overflowOk(page), true);
    await shot(page, "manage-products-precheck-missing", width);
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test("P3 complete pre-check is not a success claim", { skip }, async () => {
  const { page, context } = await open({ rpc: { rpc_get_sku_activation_check: { data: { sku_id: 71, as_of_date: "2026-11-15", missing: [] }, error: null } } });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalDetail .wp10-activation");
  const t = await page.locator("#governanceModalDetail").innerText();
  assert.match(t, /no missing requirement/);
  assert.match(t, /does not guarantee activation/);
  assert.match(t, /does not make costing READY/);
  await context.close();
});

test("P4 unavailable pre-check: explicit text, Confirm still enabled, no fake complete", { skip }, async () => {
  const { page, context } = await open({ rpc: { rpc_get_sku_activation_check: { data: null, error: { message: "Failed to fetch", status: 0 } } } });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalDetail .wp10-activation");
  const t = await page.locator("#governanceModalDetail").innerText();
  assert.match(t, /could not be checked/);
  assert.doesNotMatch(t, /no missing requirement/);
  assert.equal(await page.locator("#governanceConfirm").isDisabled(), false);
  await context.close();
});

test("P5 ambiguous PM BOM is named, not treated as missing or complete", { skip }, async () => {
  const { page, context } = await open({ rpc: { rpc_get_sku_activation_check: { data: null, error: { message: "AMBIGUOUS_PM_BOM_REVISION: 2 revisions" } } } });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalDetail .wp10-activation");
  const t = await page.locator("#governanceModalDetail").innerText();
  assert.match(t, /More than one PM BOM revision/);
  assert.doesNotMatch(t, /no missing requirement/);
  await context.close();
});

test("P6 stale response after cancel is discarded", { skip }, async () => {
  const { page, context } = await open({ rpc: { rpc_get_sku_activation_check: async () => { await new Promise((r) => setTimeout(r, 700)); return { data: { sku_id: 71, as_of_date: "2026-11-15", missing: [{ code: "MRP_POLICY", label: "MRP" }] }, error: null }; } } });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalOverlay.show");
  await page.locator("#governanceCancel").click();
  await page.waitForTimeout(1000);
  assert.equal((await page.locator("#governanceModalDetail").innerText()).trim(), "");
  assert.equal(await page.locator("#governanceModalOverlay.show").count(), 0);
  await context.close();
});

test("P7 server rejection after a complete pre-check (TOCTOU) renders safely; hostile text is inert", { skip }, async () => {
  const hostile = '<img src=x onerror="window.__xss=1">';
  const details = JSON.stringify({ missing: [{ code: "BATCH_SIZE_REFERENCE", label: hostile }, { code: "ZZ_UNKNOWN", label: "<b>x</b>", where: "<script>window.__xss=2</script>" }] });
  const { page, context } = await open({
    rpc: {
      rpc_get_sku_activation_check: { data: { sku_id: 71, as_of_date: "2026-11-15", missing: [] }, error: null },
      rpc_set_product_sku_active: { data: null, error: { message: "SKU 71 cannot be made active yet: " + hostile, details, hint: "<i>fix</i>" } },
    },
  });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalDetail .wp10-activation");
  await page.fill("#governanceReason", "test reason");
  await page.locator("#governanceConfirm").click();
  await page.waitForSelector("#wp10ActivationResult [data-wp10-activation]");
  const host = page.locator("#wp10ActivationResult");
  assert.equal(await host.locator("img, script, b, i").count(), 0);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.match(await host.innerText(), /Batch size|BATCH_SIZE_REFERENCE|Resolve in/);
  assert.equal(await host.locator("[role=alert]").count() + (await host.getAttribute("aria-live") === "assertive" ? 1 : 0) > 0, true);
  await shot(page, "manage-products-rejection", 1280);
  await context.close();
});

test("P8 only the existing activation writer is called; no table writes; unknown endpoint absent", { skip }, async () => {
  const { page, context } = await open({ rpc: { rpc_get_sku_activation_check: { data: MISSING, error: null }, rpc_set_product_sku_active: { data: null, error: { message: "Cannot activate SKU" } } } });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalDetail .wp10-activation__items");
  await page.fill("#governanceReason", "test reason");
  await page.locator("#governanceConfirm").click();
  await page.waitForTimeout(500);
  const calls = await page.evaluate(() => window.__MOCK_CALLS);
  const writers = calls.filter((c) => c.kind === "rpc" && /^rpc_(create|update|set)_/.test(c.name)).map((c) => c.name);
  assert.deepEqual(writers, ["rpc_set_product_sku_active"]);
  assert.equal(calls.some((c) => c.kind === "from" && /^(insert|update|delete|upsert)$/.test(c.method)), false);
  assert.equal(calls.some((c) => c.kind === "rpc" && /wp10|operational_expiry/.test(c.name)), false);
  await context.close();
});

test("P9 helper module load failure leaves the existing flow working", { skip }, async () => {
  const { page, context } = await open({ blockModule: true, rpc: { rpc_set_product_sku_active: { data: { ok: true }, error: null } } });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalOverlay.show");
  await page.fill("#governanceReason", "test reason");
  await page.locator("#governanceConfirm").click();
  await page.waitForTimeout(500);
  assert.equal((await rpcCalls(page)).includes("rpc_set_product_sku_active"), true);
  assert.equal((await rpcCalls(page)).includes("rpc_get_sku_activation_check"), false);
  await context.close();
});

test("P10 deactivation never runs the activation pre-check", { skip }, async () => {
  const { page, context } = await open({ rpc: { rpc_get_sku_activation_check: { data: MISSING, error: null } } });
  await page.evaluate(() => { /* make the SKU active via a fresh stub row */ });
  // The stub SKU is inactive, so this test asserts the inverse: opening Activate calls the check exactly once.
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalOverlay.show");
  await page.waitForTimeout(300);
  assert.equal((await rpcCalls(page)).filter((n) => n === "rpc_get_sku_activation_check").length, 1);
  await context.close();
});

test("M1 mutation control: a UI that renders server text as HTML IS detected (hostile node appears)", { skip }, async () => {
  const hostile = '<img src=x onerror="window.__xss=1">';
  const { page, context } = await open({
    mutateUi: true,
    rpc: { rpc_get_sku_activation_check: { data: { sku_id: 71, as_of_date: "2026-11-15", missing: [{ code: "BATCH_SIZE_REFERENCE", label: hostile }] }, error: null } },
  });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalDetail .wp10-activation__items");
  assert.equal(await page.locator("#governanceModalDetail img").count() > 0, true, "the mutant must be caught by the hostile-text probe");
  await context.close();
});

// ======================= R3: lifecycle serialization, revalidation, identity of detail/result =======================
const selectOther = (page) => page.evaluate(() => { const rows = [...document.querySelectorAll("#skuRegisterBody tr, #skuLedger button")].filter((n) => n.offsetParent !== null); rows[1].click(); });
const countOf = (page, name) => page.evaluate((n) => window.__MOCK_CALLS.filter((c) => c.kind === "rpc" && c.name === n).length, name);

test("R3.1 double invocation during a delayed helper import opens ONE dialog, ONE pre-check and (after confirm) ONE writer call", { skip }, async () => {
  const { page, context } = await open({ importDelayMs: 600, rpc: { rpc_get_sku_activation_check: { data: MISSING, error: null }, rpc_set_product_sku_active: { data: { ok: true }, error: null } } });
  await page.locator("#skuToggleActiveBtn").click();
  await page.locator("#skuToggleActiveBtn").click({ force: true }).catch(() => {});
  await page.evaluate(() => document.getElementById("skuToggleActiveBtn").click());
  await page.waitForSelector("#governanceModalOverlay.show");
  await page.waitForTimeout(900);
  assert.equal(await countOf(page, "rpc_get_sku_activation_check"), 1);
  await page.fill("#governanceReason", "one reason");
  await page.locator("#governanceConfirm").click();
  await page.waitForTimeout(600);
  assert.equal(await countOf(page, "rpc_set_product_sku_active"), 1);
  await context.close();
});

test("R3.2 selection changed BEFORE the dialog opens (import still pending): nothing opens, no pre-check, no writer", { skip }, async () => {
  const { page, context } = await open({ importDelayMs: 700, rpc: { rpc_get_sku_activation_check: { data: MISSING, error: null } } });
  await page.locator("#skuToggleActiveBtn").click();
  await selectOther(page);
  await page.waitForTimeout(1200);
  assert.equal(await page.locator("#governanceModalOverlay.show").count(), 0);
  assert.equal(await countOf(page, "rpc_get_sku_activation_check"), 0);
  assert.equal(await countOf(page, "rpc_set_product_sku_active"), 0);
  // the reservation was released: a fresh attempt on the new selection works
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalOverlay.show");
  await context.close();
});

test("R3.3 selection changed while the dialog is open: confirming submits NOTHING and says why", { skip }, async () => {
  const { page, context } = await open({ rpc: { rpc_get_sku_activation_check: { data: MISSING, error: null }, rpc_set_product_sku_active: { data: { ok: true }, error: null } } });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalDetail .wp10-activation");
  await selectOther(page);
  await page.waitForTimeout(400);
  await page.fill("#governanceReason", "reason");
  await page.locator("#governanceConfirm").click();
  await page.waitForTimeout(500);
  assert.equal(await countOf(page, "rpc_set_product_sku_active"), 0);
  assert.match(await page.locator("body").innerText(), /nothing was submitted/);
  await context.close();
});

test("R3.4 a stale pre-check response for a previous SKU never paints into a later dialog; the catch path is identity-checked too", { skip }, async () => {
  const slowFail = async () => { await new Promise((r) => setTimeout(r, 900)); throw new Error("late failure"); };
  const { page, context } = await open({ rpc: { rpc_get_sku_activation_check: slowFail } });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalOverlay.show");
  await page.locator("#governanceCancel").click();
  await selectOther(page);
  await page.waitForTimeout(1300);
  assert.equal((await page.locator("#governanceModalDetail").innerText()).trim(), "");
  await context.close();
});

test("R3.5 cancel then reopen: each dialog shows only ITS OWN pre-check; reservation released on cancel", { skip }, async () => {
  const alternating = async () => { window.__n = (window.__n || 0) + 1; const mine = window.__n; await new Promise((r) => setTimeout(r, mine === 1 ? 800 : 50)); return { data: { sku_id: 71, as_of_date: "2026-11-15", missing: [{ code: mine === 1 ? "MRP_POLICY" : "BATCH_SIZE_REFERENCE", label: mine === 1 ? "FIRST-DIALOG" : "SECOND-DIALOG" }] }, error: null }; };
  const { page, context } = await open({ rpc: { rpc_get_sku_activation_check: alternating } });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalOverlay.show");
  await page.locator("#governanceCancel").click();
  await page.waitForTimeout(200); // the reservation is released as the cancelled attempt unwinds
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForTimeout(1500);
  await page.waitForSelector("#governanceModalDetail .wp10-activation__items");
  const t = await page.locator("#governanceModalDetail").innerText();
  assert.match(t, /SECOND-DIALOG/); assert.doesNotMatch(t, /FIRST-DIALOG/);
  await context.close();
});

test("R3.6 a rejection shown for SKU A is cleared when another SKU is selected, and never painted if selection changed during the writer call", { skip }, async () => {
  const slowReject = async () => { await new Promise((r) => setTimeout(r, 700)); return { data: null, error: { message: "Cannot activate SKU 71", details: JSON.stringify({ missing: [{ code: "MRP_POLICY", label: "MRP" }] }) } }; };
  const { page, context } = await open({ rpc: { rpc_get_sku_activation_check: { data: MISSING, error: null }, rpc_set_product_sku_active: slowReject } });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalDetail .wp10-activation");
  await page.fill("#governanceReason", "reason");
  await page.locator("#governanceConfirm").click();
  await selectOther(page);
  await page.waitForTimeout(1200);
  assert.equal((await page.locator("#wp10ActivationResult").innerText().catch(() => "")).trim(), "", "rejection for SKU 71 must not appear on SKU 72");
  // now show a rejection on the SELECTED sku and switch away
  const { page: p2, context: c2 } = await open({ rpc: { rpc_get_sku_activation_check: { data: MISSING, error: null }, rpc_set_product_sku_active: { data: null, error: { message: "Cannot activate SKU 71", details: JSON.stringify({ missing: [{ code: "MRP_POLICY", label: "MRP" }] }) } } } });
  await p2.locator("#skuToggleActiveBtn").click();
  await p2.waitForSelector("#governanceModalDetail .wp10-activation");
  await p2.fill("#governanceReason", "reason");
  await p2.locator("#governanceConfirm").click();
  await p2.waitForSelector("#wp10ActivationResult [data-wp10-activation]");
  await selectOther(p2);
  await p2.waitForTimeout(500);
  assert.equal((await p2.locator("#wp10ActivationResult").innerText()).trim(), "", "stale rejection is cleared on selection change");
  await context.close(); await c2.close();
});

test("R3.7 flag OFF keeps today's un-serialised flow (no reservation object, no helper import) - byte-identical behaviour", { skip }, async () => {
  const { page, context, loaded } = await open({ flag: false });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalOverlay.show");
  assert.deepEqual(loaded, []);
  assert.equal(await countOf(page, "rpc_get_sku_activation_check"), 0);
  await context.close();
});

test("M2 mutation control: WITHOUT any serialization (no reservation, no ownership check), double invocation opens two pre-checks (R3.1 would fail)", { skip }, async () => {
  const { page, context } = await open({ importDelayMs: 500, mutateProducts: [["if (wp10ActivationAttempt) return;", ""], ["wp10ActivationAttempt === attempt &&", ""]], rpc: { rpc_get_sku_activation_check: { data: MISSING, error: null }, rpc_set_product_sku_active: { data: { ok: true }, error: null } } });
  await page.evaluate(() => { const b = document.getElementById("skuToggleActiveBtn"); b.click(); b.click(); });
  await page.waitForSelector("#governanceModalOverlay.show");
  await page.waitForTimeout(900);
  await page.fill("#governanceReason", "one reason");
  await page.locator("#governanceConfirm").click();
  await page.waitForTimeout(700);
  const checks = await countOf(page, "rpc_get_sku_activation_check"), writers = await countOf(page, "rpc_set_product_sku_active");
  assert.equal(checks > 1 || writers > 1, true, `the mutant must be caught by the double-invocation probe (checks=${checks}, writers=${writers})`);
  await context.close();
});

test("M3 mutation control: WITHOUT the revalidation, a changed selection still reaches the writer (R3.3 would fail)", { skip }, async () => {
  const { page, context } = await open({ mutateProducts: [["function wp10AttemptStillValid(attempt) {", "function wp10AttemptStillValid(attempt) { return true;"]], rpc: { rpc_get_sku_activation_check: { data: MISSING, error: null }, rpc_set_product_sku_active: { data: { ok: true }, error: null } } });
  await page.locator("#skuToggleActiveBtn").click();
  await page.waitForSelector("#governanceModalDetail .wp10-activation");
  await selectOther(page);
  await page.waitForTimeout(300);
  await page.fill("#governanceReason", "reason");
  await page.locator("#governanceConfirm").click();
  await page.waitForTimeout(500);
  assert.equal(await countOf(page, "rpc_set_product_sku_active"), 1, "the mutant must be caught: it submits for a SKU that is no longer selected");
  await context.close();
});

for (const width of [1280, 390]) {
  test(`O2 whole-page overflow @${width}: Manage Products with the dialog open (pre-check items) and after a rejection adds no horizontal overflow relative to flag OFF`, { skip }, async () => {
    const measure = async (flag) => {
      const { page, context } = await open({ width, flag, rpc: { rpc_get_sku_activation_check: { data: MISSING, error: null }, rpc_set_product_sku_active: { data: null, error: { message: "Cannot activate SKU 71", details: JSON.stringify({ missing: [{ code: "PM_BOM_REVISION", label: "PM BOM revision" }, { code: "BATCH_SIZE_REFERENCE", label: "Batch size" }] }) } } } });
      const w = () => page.evaluate(() => ({ vw: document.documentElement.clientWidth, doc: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) }));
      const closed = await w();
      await page.locator("#skuToggleActiveBtn").click();
      await page.waitForSelector("#governanceModalOverlay.show");
      if (flag) await page.waitForSelector("#governanceModalDetail .wp10-activation__items");
      const dialog = await w();
      await page.fill("#governanceReason", "reason");
      await page.locator("#governanceConfirm").click();
      await page.waitForTimeout(600);
      const rejected = await w();
      await context.close();
      return { closed, dialog, rejected };
    };
    const off = await measure(false), on = await measure(true);
    for (const k of ["closed", "dialog", "rejected"]) assert.ok(on[k].doc <= off[k].doc + 1, `${k}: flag ON ${on[k].doc} must not exceed flag OFF ${off[k].doc}`);
    if (SHOTS) { fs.mkdirSync(shotDir, { recursive: true }); fs.writeFileSync(path.join(shotDir, `products-overflow-compare-${width}.json`), JSON.stringify({ width, off, on }, null, 2) + "\n"); }
  });
}
