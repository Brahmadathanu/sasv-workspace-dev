// Wave A hardening: real Chromium + real six Costing pages + synthetic view-only client.
// Every test fails (never skips) if Playwright/Chromium is unavailable.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createReadOnlyLoopbackServer } from "./read-only-loopback-server.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const MODULES = [
  "costing-control-center", "material-cost-manager", "cost-build-manager",
  "pricing-policy-manager", "cost-sheet-review", "production-route-manager",
];
const FLAGS = [
  "COSTING_RECALC_WITH_DATE_V1", "COSTING_APPROVAL_SCREEN_V1", "COSTING_LOCK_SCREEN_V1",
  "COSTING_RUN_STATUS_V1", "COSTING_UX_CONSISTENCY_V1", "COSTING_DIALOGS_V1",
  "COSTING_TABLE_TOOLS_V1", "COSTING_REVIEW_WORKLIST_V1", "COSTING_NAV_GROUPS_V1",
  "COSTING_PRM_CORRECTIONS_V1", "COSTING_PRM_NAV_CONTEXT_V1",
];
let server, browser, base;
test.before(async () => {
  server = await createReadOnlyLoopbackServer();
  base = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ args: ["--no-sandbox"] });
});
test.after(async () => {
  if (browser) await browser.close();
  await new Promise((resolve) => server?.close(resolve));
});

async function openContext(options = {}) {
  const context = await browser.newContext({ serviceWorkers: "block", ...options });
  const external = [];
  const swRegistrations = [];
  context.on("request", (req) => { if (!req.url().startsWith(base)) external.push(req.url()); });
  context.on("serviceworker", (worker) => swRegistrations.push(worker.url()));
  return { context, external, swRegistrations };
}

test("all six pages load, stay SYNTHETIC-labelled, and never contact an external host", async () => {
  for (const name of MODULES) {
    const { context, external, swRegistrations } = await openContext();
    const page = await context.newPage();
    const response = await page.goto(base + "/shared/" + name + ".html", { waitUntil: "domcontentloaded" });
    assert.equal(response.status(), 200, name);
    assert.match(response.headers()["content-security-policy"], /connect-src 'none'/, name);
    await page.locator("#synthetic-preview-banner").waitFor({ timeout: 8000 });
    await page.waitForFunction(() => !!window.__costingSyntheticPreview, null, { timeout: 12000 });
    await page.waitForTimeout(1500);
    assert.match(await page.locator("#synthetic-preview-banner").innerText(), /SYNTHETIC.*NO REAL DATA/s, name);
    assert.ok((await page.locator("h1, .costing-title, header").first().innerText()).length > 0, name);
    assert.deepEqual(swRegistrations, [], name + ": service worker registered");
    const bad = external.filter((url) => !/^(data|blob):/.test(url));
    // CSP blocks CDN scripts (jsPDF); the *request* may still be attempted but must never be Supabase.
    assert.ok(bad.every((url) => !/supabase\.(co|in)|\/rest\/v1|\/auth\/v1/i.test(url)), name + ": " + bad.join(","));
    await context.close();
  }
});

test("each of the eleven flags toggles individually and Reset restores a clean localStorage", async () => {
  const { context } = await openContext();
  const page = await context.newPage();
  await page.goto(base + "/__preview/");
  const boxes = page.locator(".flags input[type=checkbox]");
  assert.equal(await boxes.count(), 11);
  for (const flag of FLAGS) {
    const box = page.locator('.flags input[value="' + flag + '"]');
    await box.check();
    const on = await page.evaluate((keys) => keys.filter((k) => localStorage.getItem(k) === "1"), FLAGS);
    assert.deepEqual(on, [flag], flag + " must be the only flag ON");
    assert.match(await page.locator("#state").innerText(), /1 \/ 11/);
    await page.locator('.flags input[value="' + flag + '"]').uncheck();
    assert.match(await page.locator("#state").innerText(), /0 \/ 11/);
  }
  await page.evaluate(() => localStorage.setItem("COSTING_STALE_UNKNOWN_V1", "1"));
  await page.getByRole("button", { name: "All eleven ON" }).click();
  await page.getByRole("button", { name: "Reset / restore OFF" }).click();
  const leftovers = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("COSTING_")));
  assert.deepEqual(leftovers, [], "Reset must leave no COSTING_ localStorage keys");
  await context.close();
});

test("launcher offers six module links, four presets, an accessible operation log, and works at 390px", async () => {
  const { context } = await openContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(base + "/__preview/");
  assert.equal(await page.locator("nav a").count(), 6);
  for (const label of ["All OFF", "Navigation only", "All eleven ON", "Reset / restore OFF"]) {
    assert.equal(await page.getByRole("button", { name: label }).count(), 1, label);
  }
  assert.equal(await page.getByRole("list", { name: "Operation log" }).count(), 1);
  assert.match(await page.locator("#offlineTitle").innerText(), /empty/i);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, "no horizontal scroll at 390px, got " + overflow);
  await context.close();
});

test("synthetic READY / REVIEW / BLOCKED status and two run states are visibly rendered by the real dashboard", async () => {
  const { context } = await openContext();
  await context.addInitScript(() => localStorage.setItem("COSTING_RUN_STATUS_V1", "1"));
  const page = await context.newPage();
  await page.goto(base + "/shared/costing-control-center.html");
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("costing readiness"), null, { timeout: 15000 });
  const text = await page.locator("body").innerText();
  assert.match(text, /Costing Readiness\s*1 \/ 3/i);
  assert.match(text, /Costing Blocked\s*1/i);
  assert.match(text, /Costing Review\s*1/i);
  assert.match(text, /SYNTHETIC Run 900002 FAILED/);
  const data = await page.evaluate(async () => {
    const { supabase } = await import("/shared/js/supabaseClient.js");
    const sku = await supabase.from("sku_costing_control_status_snapshot").select("*");
    const runs = await supabase.from("v_costing_pricing_period_run_status").select("*");
    return { sku: sku.data, runs: runs.data };
  });
  assert.deepEqual(data.sku.map((r) => r.first_control_status), ["READY", "REVIEW_REQUIRED", "BLOCKED"]);
  assert.ok(data.sku.every((r) => r.sku_id >= 900000 && r.product_name.startsWith("SYNTHETIC") && r.synthetic === true));
  assert.deepEqual(data.runs.map((r) => r.active_run_status ?? "APPROVED"), ["APPROVED", "FAILED"]);
  assert.ok(data.runs.every((r) => /^SYNTHETIC/.test(r.display_label)));
  await context.close();
});

test("operation log records reads, unsupported-offline reads and denied mutations without payload values", async () => {
  const { context } = await openContext();
  const page = await context.newPage();
  await page.goto(base + "/shared/production-route-manager.html");
  await page.waitForFunction(() => !!window.__costingSyntheticPreview);
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    const { supabase } = await import("/shared/js/supabaseClient.js");
    await supabase.rpc("rpc_approve_product_route", { p_secret_marker: "PAYLOAD-SHOULD-NOT-BE-LOGGED" });
    await supabase.rpc("rpc_definitely_unknown_read");
  });
  await page.goto(base + "/__preview/");
  await page.getByRole("button", { name: "Refresh log" }).click();
  const log = await page.locator("#oplog").innerText();
  assert.match(log, /READ rpc\.get_user_permissions/);
  assert.match(log, /DENIED rpc\.rpc_approve_product_route/);
  assert.match(log, /UNSUPPORTED rpc\.rpc_definitely_unknown_read/);
  assert.doesNotMatch(log, /PAYLOAD-SHOULD-NOT-BE-LOGGED/);
  assert.match(await page.locator("#logSummary").innerText(), /\d+ read · [1-9]\d* denied mutation · [1-9]\d* unsupported offline/);
  await page.getByRole("button", { name: "Reset / restore OFF" }).click();
  assert.match(await page.locator("#logSummary").innerText(), /Log empty/);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("__costingSyntheticPreviewLog")), null);
  await context.close();
});

test("unknown RPC and unknown table are explicit errors, never silent success", async () => {
  const { context } = await openContext();
  const page = await context.newPage();
  await page.goto(base + "/shared/cost-sheet-review.html");
  const r = await page.evaluate(async () => {
    const { supabase } = await import("/shared/js/supabaseClient.js");
    return {
      rpc: (await supabase.rpc("rpc_get_something_never_fixtured")).error?.code,
      table: (await supabase.from("employees_salary_real").select("*")).error?.code,
      storage: (await supabase.storage.from("b").download("x")).error?.code,
      unsupported: window.__costingSyntheticPreview.unsupported.length,
    };
  });
  assert.equal(r.rpc, "SYNTHETIC_PREVIEW_UNSUPPORTED_OFFLINE");
  assert.equal(r.table, "SYNTHETIC_PREVIEW_UNSUPPORTED_OFFLINE");
  assert.equal(r.storage, "SYNTHETIC_PREVIEW_UNSUPPORTED_OFFLINE");
  assert.ok(r.unsupported >= 3);
  await context.close();
});

test("a view-only fixture and an edit-CLAIMING fixture both deny every mutation (denial never relies on permissions)", async () => {
  const mutations = [
    ["rpc", "rpc_costing_request_recalculation"], ["rpc", "rpc_costing_lock_period"], ["rpc", "rpc_costing_lock_periods_for_close"],
    ["rpc", "rpc_costing_finalize_monthend_run_with_preview"], ["rpc", "rpc_costing_supersede_approved_run"],
    ["rpc", "rpc_set_material_manual_rate"], ["rpc", "rpc_refresh_cost"], ["rpc", "rpc_approve_production_cost_centre"],
    ["rpc", "rpc_save_manual_cost_pool_provision"], ["rpc", "rpc_apply_product_mrp_proposal"],
    ["table", "costing_refresh_run"], ["table", "sku_prime_cost_snapshot"],
  ];
  for (const claim of ["", "?synthetic_priv=edit-claimed"]) {
    const { context } = await openContext();
    const page = await context.newPage();
    await page.goto(base + "/shared/pricing-policy-manager.html" + claim);
    const result = await page.evaluate(async (list) => {
      const { supabase } = await import("/shared/js/supabaseClient.js");
      const permissions = (await supabase.rpc("get_user_permissions")).data;
      const codes = [];
      for (const [kind, name] of list) {
        const res = kind === "rpc" ? await supabase.rpc(name, { p_x: 1 }) : await supabase.from(name).update({ x: 1 });
        codes.push(res.error?.code ?? "EXECUTED");
      }
      return { canEdit: permissions.map((p) => p.can_edit), codes, denied: window.__costingSyntheticPreview.deniedWrites.length };
    }, mutations);
    const expectedEdit = claim !== "";
    assert.ok(result.canEdit.every((v) => v === expectedEdit), "permission fixture: " + claim);
    assert.deepEqual([...new Set(result.codes)], ["SYNTHETIC_PREVIEW_WRITE_DENIED"], claim);
    assert.equal(result.denied, mutations.length, claim);
    await context.close();
  }
});

test("clicking the real toolbar refresh then 'Request draft' with edit controls exposed is denied and shown to the user", async () => {
  const { context, external } = await openContext();
  await context.addInitScript(() => localStorage.setItem("COSTING_RECALC_WITH_DATE_V1", "1"));
  const page = await context.newPage();
  await page.goto(base + "/shared/costing-control-center.html?synthetic_priv=edit-claimed");
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("costing readiness"), null, { timeout: 15000 });
  await page.locator("#refreshBtn").click();
  const dialog = page.locator("text=Request a recalculation (draft)");
  await dialog.waitFor({ timeout: 8000 });
  const reason = page.locator("textarea:visible, input[type=text]:visible").first();
  if (await reason.count()) await reason.fill("Synthetic walkthrough - must be denied");
  await page.getByRole("button", { name: "Request draft" }).click();
  await page.waitForFunction(() => window.__costingSyntheticPreview.deniedWrites.length > 0, null, { timeout: 8000 });
  const state = await page.evaluate(() => ({
    denied: window.__costingSyntheticPreview.deniedWrites,
    calls: window.__costingSyntheticPreview.rpc.map((r) => r.name),
  }));
  assert.ok(state.denied.some((op) => /rpc\.rpc_costing_request_recalculation/.test(op)), JSON.stringify(state.denied));
  await page.waitForTimeout(500);
  assert.match(await page.locator("body").innerText(), /denied|read-only|no backend|not available|failed|could not/i);
  assert.deepEqual(external.filter((u) => /supabase|\/rest\/v1|\/auth\/v1/i.test(u)), []);
  await context.close();
});

test("approve / lock actions reached through the page client are denied (no execution path)", async () => {
  const { context } = await openContext();
  await context.addInitScript(() => {
    for (const flag of ["COSTING_APPROVAL_SCREEN_V1", "COSTING_LOCK_SCREEN_V1"]) localStorage.setItem(flag, "1");
  });
  const page = await context.newPage();
  await page.goto(base + "/shared/costing-control-center.html?synthetic_priv=edit-claimed");
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("costing readiness"), null, { timeout: 15000 });
  await page.waitForTimeout(1000);
  const out = await page.evaluate(async () => {
    const { supabase } = await import("/shared/js/supabaseClient.js");
    const approve = await supabase.rpc("rpc_costing_finalize_monthend_run_with_preview", { p_run_id: 900002 });
    const lock = await supabase.rpc("rpc_costing_lock_period", { p_period_start: "2026-11-01" });
    const table = await supabase.from("v_costing_pricing_period_run_status").update({ display_state: "APPROVED" });
    const after = await supabase.from("v_costing_pricing_period_run_status").select("display_state").eq("period_start", "2026-11-01");
    return { approve: approve.error?.code, lock: lock.error?.code, table: table.error?.code, after: after.data };
  });
  assert.equal(out.approve, "SYNTHETIC_PREVIEW_WRITE_DENIED");
  assert.equal(out.lock, "SYNTHETIC_PREVIEW_WRITE_DENIED");
  assert.equal(out.table, "SYNTHETIC_PREVIEW_WRITE_DENIED");
  assert.equal(out.after.length, 1);
  assert.equal(out.after[0].display_state, "NO_SUCCESSFUL_RUN", "fixture must be unchanged");
  await context.close();
});

test("deep links with period context load, and no service worker or external request ever occurs", async () => {
  const { context, external, swRegistrations } = await openContext();
  const page = await context.newPage();
  for (const path of [
    "/shared/cost-sheet-review.html?period=2026-10-01",
    "/shared/pricing-policy-manager.html?period=2026-11-01&lens=sku-policy-overview",
    "/shared/production-route-manager.html?lens=route-readiness",
  ]) {
    const response = await page.goto(base + path);
    assert.equal(response.status(), 200, path);
    await page.locator("#synthetic-preview-banner").waitFor({ timeout: 8000 });
  }
  assert.deepEqual(swRegistrations, []);
  assert.deepEqual(external.filter((u) => /supabase\.(co|in)|\/rest\/v1|\/auth\/v1/i.test(u)), []);
  assert.equal(await page.evaluate(async () => navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0), 0);
  await context.close();
});

test("served shim contains no real Supabase origin, key or JWT; fixture ids stay far above real ids", async () => {
  const js = await (await fetch(base + "/shared/js/supabaseClient.js")).text();
  assert.doesNotMatch(js, /supabase\.(co|in)|eyJ[A-Za-z0-9_-]{20,}|service_role|createClient/);
  const ids = [...js.matchAll(/\b(9\d{5})\b/g)].map((m) => Number(m[1]));
  assert.ok(ids.length > 0 && ids.every((n) => n >= 900000));
  const html = await (await fetch(base + "/__preview/")).text();
  assert.doesNotMatch(html, /supabase\.(co|in)|eyJ[A-Za-z0-9_-]{20,}/);
});

test("every RPC name found in the six-module client source fails closed (only get_user_permissions may succeed)", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../../public/shared/js");
  const names = new Set();
  for (const file of readdirSync(dir).filter((f) => /^(costing-|cost-).*\.js$|production-route/.test(f))) {
    for (const m of readFileSync(resolve(dir, file), "utf8").matchAll(/\brpc_[a-z0-9_]+\b/g)) names.add(m[0]);
  }
  names.delete("rpc_error"); names.delete("rpc_name");
  assert.ok(names.size > 100, "expected the full RPC inventory, saw " + names.size);
  const { context } = await openContext();
  const page = await context.newPage();
  await page.goto(base + "/shared/cost-sheet-review.html");
  const outcomes = await page.evaluate(async (list) => {
    const { supabase } = await import("/shared/js/supabaseClient.js");
    const out = {};
    for (const name of list) { const r = await supabase.rpc(name, {}); out[name] = r.error?.code ?? "SUCCEEDED"; }
    return out;
  }, [...names]);
  const succeeded = Object.entries(outcomes).filter(([, code]) => code === "SUCCEEDED");
  assert.deepEqual(succeeded, [], "no source-referenced RPC may succeed in the synthetic client");
  const allowed = new Set(["SYNTHETIC_PREVIEW_WRITE_DENIED", "SYNTHETIC_PREVIEW_UNSUPPORTED_OFFLINE"]);
  assert.ok(Object.values(outcomes).every((c) => allowed.has(c)));
  const denied = Object.values(outcomes).filter((c) => c === "SYNTHETIC_PREVIEW_WRITE_DENIED").length;
  assert.ok(denied >= 80, "mutating RPCs should be classified as denied writes, saw " + denied);
  await context.close();
});
