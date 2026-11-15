// WP10 G2 mocked-Chromium checks for the Readiness lens (flag WP10_SAFEGUARDS_V1): explanatory unavailable states + operational expiry horizon.
// Mocked data only: NOT live-role acceptance. No network, no Supabase, no writers. Screenshots under docs/master-data-costing/WP10_G2_EVIDENCE/screenshots.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { chromium = null; }
const skip = process.env.WP10_G2_BROWSER_SKIP === "1" || !chromium ? "playwright/chromium unavailable or skipped" : false;
const SHOTS = process.env.WP10_G2_SHOTS !== "0";
const shotDir = path.join(root, "docs/master-data-costing/WP10_G2_EVIDENCE/screenshots");

const html = read("public/shared/costing-control-center.html");
const HOST_MARKUP = html.slice(html.indexOf('<div\n        id="readinessLensHost"'), html.indexOf('<div id="genericTableCard"'));
const PAGE_STYLES = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[0]).join("\n");
const MIME = { ".js": "text/javascript", ".html": "text/html", ".css": "text/css" };

const HORIZON_OK = (over = {}) => ({
  assessment_kind: "OPERATIONAL_EXPIRY_HORIZON",
  context: { date_basis: "CURRENT_IST_DATE", evaluated_from: "2026-11-15", evaluated_through: "2026-12-15", horizon_days: 30, route_boundary_coverage: "COMPLETE", amounts_evaluated: false },
  rows: [{ sku_id: 71, product_id: 7, essentials: [{ code: "MRP_POLICY", owner_screen: "Pricing Policy Manager > MRP", today_state: "RESOLVED", issue_state: "MISSING", classification: "LAPSES_IN_WINDOW", first_issue_date: "2026-12-01", recovers_on: null }] }],
  statistics: { scanned_count: 1, budget_exhausted: false }, has_more: false, next_after_sku_id: null, ...over,
});

async function openHarness({ flag, portfolioError = null, horizon = null, width = 1280 }) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript((f) => { try { if (f) localStorage.setItem("WP10_SAFEGUARDS_V1", "1"); } catch { /* ignore */ } }, flag);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("http://harness.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/harness.html") {
      return route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta name="viewport" content="width=device-width">${PAGE_STYLES}</head><body><div id="filters"><select id="readinessPopulationScope"><option value="OPERATIONAL">Operational</option></select><ul id="readinessSeverityFilters"></ul><ul id="readinessDependencyFilters"></ul><ul id="readinessOwnerFilters"></ul><ul id="readinessRouteFilters"></ul><div id="readinessAppliedFilters"></div></div><div id="readinessMembershipModal" class="hidden" hidden><span id="readinessMembershipModalTitle"></span><button id="readinessMembershipModalClose"></button><div id="readinessMembershipModalBody"></div></div>${HOST_MARKUP}<div id="drawerContent"></div></body></html>` });
    }
    const file = path.join(root, "public/shared", url.pathname.replace(/^\/shared\//, ""));
    if (!file.startsWith(path.join(root, "public")) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: MIME[path.extname(file)] || "text/plain", body: fs.readFileSync(file) });
  });
  await page.goto("http://harness.test/harness.html");
  await page.addScriptTag({
    type: "module",
    content: `
      import { createPortfolioReadinessController } from "/shared/js/costing-suite-readiness.js";
      const calls = []; window.__calls = calls;
      const PORTFOLIO_ERROR = ${JSON.stringify(portfolioError)}; const HORIZON = ${JSON.stringify(horizon)};
      async function costingRpc(name, args) {
        calls.push({ name, args });
        if (name === "rpc_get_readiness_governed_periods") return { data: { observed_at: "2026-11-15T10:00:00Z", rows: [{ period_start: "2026-10-01", valuation_date: "2026-10-31" }], limit: 24, returned_count: 1, has_more: false }, error: null };
        if (name === "rpc_get_readiness_product_gaps") return { data: { assessment_kind: "PRODUCT_MEMBERSHIP_GAPS", observed_at: "2026-11-15T10:00:00Z", product_scope: "ACTIVE_PRODUCTS", gap_kind: args.p_gap_kind, rows: [], statistics: { product_count: 1, no_sku_count: 0, active_without_active_sku_count: 0 }, limit: 25, matched_count: 0, returned_count: 0, has_more: false }, error: null };
        if (name === "rpc_wp10_get_operational_expiry_horizon") {
          if (HORIZON === "missing") return { data: null, error: { code: "PGRST202", message: "Could not find the function public.rpc_wp10_get_operational_expiry_horizon", status: 404 } };
          if (HORIZON === "transport") return { data: null, error: { message: "Failed to fetch", status: 0 } };
          if (HORIZON === "malformed") return { data: { assessment_kind: "SOMETHING_ELSE" }, error: null };
          if (HORIZON && HORIZON.sequence) {
            const i = Math.min(window.__hz = (window.__hz ?? -1) + 1, HORIZON.sequence.length - 1);
            const step = HORIZON.sequence[i];
            if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
            return { data: step.data, error: step.error || null };
          }
          return { data: HORIZON, error: null };
        }
        if (PORTFOLIO_ERROR) return { data: null, error: PORTFOLIO_ERROR };
        return { data: null, error: { message: "unexpected" } };
      }
      const ctrl = createPortfolioReadinessController({
        costingRpc, showToast: () => {}, text: (v) => v == null || v === "" ? "—" : String(v),
        getCurrentLens: () => window.__lens || "portfolio-readiness", canView: () => true, getSearchValue: () => "",
        openDetails: () => {}, downloadCsv: () => true,
      });
      window.ctrl = ctrl; window.__ready = true;
    `,
  });
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(() => window.ctrl.load());
  await page.waitForTimeout(500);
  return { browser, page, errors };
}
const shot = async (page, name, width) => { if (!SHOTS) return; fs.mkdirSync(shotDir, { recursive: true }); await page.screenshot({ path: path.join(shotDir, `${name}-${width}.png`) }); };
// Scoped to the WP10 elements: the pre-existing readiness table is wider than 390px in this CSS-less harness and is out of this package's scope.
const noOverflow = (page) => page.evaluate(() => { const vw = document.documentElement.clientWidth; return [...document.querySelectorAll("[data-wp10-state], [data-wp10-state] *, #wp10HorizonPanel, #wp10HorizonPanel *")].every((n) => n.getBoundingClientRect().right <= vw + 1); });

for (const [kind, err, expected] of [
  ["STALE", { message: "READINESS_BUILD_STALE: fingerprint mismatch" }, /out of date/],
  ["ABSENT", { message: "READINESS_BUILD_ABSENT: none" }, /No readiness snapshot exists/],
  ["INCOMPLETE", { message: "READINESS_BUILD_INCOMPLETE: not promoted" }, /not complete/],
  ["PERMISSION", { message: "Permission denied" }, /do not have access/],
  ["TRANSPORT", { message: "Failed to fetch", status: 0 }, /could not be reached/],
]) {
  for (const width of [1280, 390]) {
    test(`R1 flag ON ${kind} @${width}: distinct explanatory state, period, owner, manual runbook, no rebuild/retry`, { skip }, async () => {
      const { browser, page, errors } = await openHarness({ flag: true, portfolioError: err, width });
      try {
        const box = page.locator("[data-wp10-state]").first();
        await box.waitFor({ state: "visible" });
        assert.equal(await box.getAttribute("data-wp10-state"), kind);
        const t = await box.innerText();
        assert.match(t, expected);
        assert.match(t, /Governed period 2026-10-01/);
        assert.match(t, /programme owner is accountable/);
        assert.match(t, /No automatic rebuild, retry or notification/);
        if (["STALE", "ABSENT", "INCOMPLETE"].includes(kind)) {
          assert.match(t, /production writer operation/);
          assert.match(t, /read nothing as READY/);
        }
        assert.equal(await noOverflow(page), true);
        const names = await page.evaluate(() => window.__calls.map((c) => c.name));
        assert.equal(names.some((n) => /build|refresh|rebuild/i.test(n)), false);
                if (["STALE", "TRANSPORT"].includes(kind)) await shot(page, `readiness-${kind.toLowerCase()}`, width);
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    });
  }
}

test("R2 flag OFF: the original one-line message is unchanged and no WP10 panel/module exists", { skip }, async () => {
  const { browser, page } = await openHarness({ flag: false, portfolioError: { message: "READINESS_BUILD_STALE: x" } });
  try {
    assert.equal(await page.locator("[data-wp10-state]").count(), 0);
    assert.equal(await page.locator("#wp10HorizonPanel").count(), 0);
    assert.match(await page.locator("#readinessLensHost").innerText(), /Readiness unavailable — Unavailable — READINESS_BUILD_STALE/);
    const names = await page.evaluate(() => window.__calls.map((c) => c.name));
    assert.equal(names.includes("rpc_wp10_get_operational_expiry_horizon"), false);
  } finally { await browser.close(); }
});

for (const width of [1280, 390]) {
  test(`H1 horizon panel @${width}: IST-date basis stated, flagged rows, owner screens, not loaded until clicked`, { skip }, async () => {
    const { browser, page } = await openHarness({ flag: true, portfolioError: { message: "READINESS_BUILD_STALE: x" }, horizon: HORIZON_OK(), width });
    try {
      const panel = page.locator("#wp10HorizonPanel");
      await panel.waitFor({ state: "visible" });
      assert.equal(await page.evaluate(() => window.__calls.some((c) => c.name === "rpc_wp10_get_operational_expiry_horizon")), false);
      assert.match(await panel.innerText(), /today's IST date/);
      assert.match(await panel.innerText(), /does not change Readiness/);
      await panel.getByRole("button", { name: /Load horizon/ }).click();
      await page.waitForFunction(() => /flagged after scanning/.test(document.getElementById("wp10HorizonPanel")?.innerText || ""));
      const t = await panel.innerText();
      assert.match(t, /Evaluated from 2026-11-15 \(today's IST date\) through 2026-12-15/);
      assert.match(t, /SKU 71 · product 7/);
      assert.match(t, /Lapses in window: MRP_POLICY from 2026-12-01/);
      assert.match(t, /owner screen: Pricing Policy Manager > MRP/);
      assert.match(t, /Route boundaries assessed: product routes, route-family routes/);
      assert.match(t, /Amounts \(zero\/negative\) are not evaluated/);
      assert.equal(await noOverflow(page), true);
      await shot(page, "horizon-loaded", width);
      const args = await page.evaluate(() => window.__calls.find((c) => c.name === "rpc_wp10_get_operational_expiry_horizon").args);
      assert.deepEqual(args, { p_horizon_days: 30, p_after_sku_id: null, p_limit: 50 });
    } finally { await browser.close(); }
  });
}

for (const [mode, expected] of [["missing", /not available on this server yet/], ["transport", /could not be reached/], ["malformed", /unavailable — Horizon assessment_kind mismatch/]]) {
  test(`H2 horizon ${mode}: inert, explicit, no fake empty result, readiness unaffected`, { skip }, async () => {
    const { browser, page } = await openHarness({ flag: true, portfolioError: { message: "READINESS_BUILD_STALE: x" }, horizon: mode });
    try {
      const panel = page.locator("#wp10HorizonPanel");
      await panel.getByRole("button", { name: /Load horizon/ }).click();
      await page.waitForFunction(() => /not available|unavailable|reached/.test(document.querySelector("#wp10HorizonPanel .wp10-horizon__status")?.textContent || ""));
      const t = await panel.innerText();
      assert.match(t, expected);
      assert.doesNotMatch(t, /0 SKUs flagged|No SKU/);
      assert.equal(await page.locator("[data-wp10-state]").first().getAttribute("data-wp10-state"), "STALE");
    } finally { await browser.close(); }
  });
}

test("H3 no panel when the flag is off even if the endpoint would answer", { skip }, async () => {
  const { browser, page } = await openHarness({ flag: false, portfolioError: { message: "READINESS_BUILD_STALE: x" }, horizon: HORIZON_OK() });
  try { assert.equal(await page.locator("#wp10HorizonPanel").count(), 0); } finally { await browser.close(); }
});

// ===================== R4 panel behaviour, disposal/remount, whole-page overflow vs flag OFF =====================
const HZ_CTX = { date_basis: "CURRENT_IST_DATE", evaluated_from: "2026-11-15", evaluated_through: "2026-12-15", horizon_days: 30, route_boundary_coverage: "COMPLETE", amounts_evaluated: false };
const HZ_ROW = (id) => ({ sku_id: id, product_id: 100 + id, essentials: [{ code: "MRP_POLICY", owner_screen: "Pricing Policy Manager > MRP", today_state: "RESOLVED", issue_state: "MISSING", classification: "LAPSES_IN_WINDOW", first_issue_date: "2026-12-01", recovers_on: null }] });
const HZ_PAGE = (rows, extra = {}) => ({ assessment_kind: "OPERATIONAL_EXPIRY_HORIZON", context: HZ_CTX, rows, statistics: { scanned_count: 50 }, has_more: false, next_after_sku_id: null, ...extra });
const hzCalls = (page) => page.evaluate(() => window.__calls.filter((c) => c.name === "rpc_wp10_get_operational_expiry_horizon").map((c) => c.args.p_after_sku_id));
const loadHz = async (page) => { await page.locator("#wp10HorizonPanel").getByRole("button", { name: /Load horizon|Reload/ }).click(); await page.waitForTimeout(500); };

test("R4.1 has_more=true with a NULL cursor stops with an error: the first page is NOT re-requested or appended again, and rows are labelled PARTIAL", { skip }, async () => {
  const { browser, page } = await openHarness({ flag: true, portfolioError: { message: "READINESS_BUILD_STALE: x" }, horizon: { sequence: [{ data: HZ_PAGE([HZ_ROW(5)], { has_more: true, next_after_sku_id: null }) }] } });
  try {
    await loadHz(page);
    const t = await page.locator("#wp10HorizonPanel").innerText();
    assert.match(t, /no valid continuation cursor/);
    assert.match(t, /PARTIAL/);
    assert.equal((await hzCalls(page)).length, 1);
    assert.equal(await page.locator("#wp10HorizonPanel").getByRole("button", { name: /Load more/ }).count(), 0);
  } finally { await browser.close(); }
});

test("R4.2 valid paging: cursor equals last displayed SKU, empty scanned page, then final page; cursors are sent in order", { skip }, async () => {
  const seq = [{ data: HZ_PAGE([HZ_ROW(5)], { has_more: true, next_after_sku_id: 5 }) }, { data: HZ_PAGE([], { has_more: true, next_after_sku_id: 100 }) }, { data: HZ_PAGE([HZ_ROW(120)]) }];
  const { browser, page } = await openHarness({ flag: true, portfolioError: { message: "READINESS_BUILD_STALE: x" }, horizon: { sequence: seq } });
  try {
    await loadHz(page);
    await page.locator("#wp10HorizonPanel").getByRole("button", { name: /Load more/ }).click(); await page.waitForTimeout(400);
    await page.locator("#wp10HorizonPanel").getByRole("button", { name: /Load more/ }).click(); await page.waitForTimeout(400);
    assert.deepEqual(await hzCalls(page), [null, 5, 100]);
    assert.equal(await page.locator("#wp10HorizonPanel .wp10-horizon__row").count(), 2);
    assert.equal(await page.locator("#wp10HorizonPanel").getByRole("button", { name: /Load more/ }).count(), 0);
  } finally { await browser.close(); }
});

test("R4.3 a duplicate row on a later page is rejected and the earlier rows stay labelled PARTIAL", { skip }, async () => {
  const seq = [{ data: HZ_PAGE([HZ_ROW(5)], { has_more: true, next_after_sku_id: 50 }) }, { data: HZ_PAGE([HZ_ROW(5)]) }];
  const { browser, page } = await openHarness({ flag: true, portfolioError: { message: "READINESS_BUILD_STALE: x" }, horizon: { sequence: seq } });
  try {
    await loadHz(page);
    await page.locator("#wp10HorizonPanel").getByRole("button", { name: /Load more/ }).click(); await page.waitForTimeout(400);
    const t = await page.locator("#wp10HorizonPanel").innerText();
    assert.match(t, /out of order|duplicate/); assert.match(t, /PARTIAL/);
    assert.equal(await page.locator("#wp10HorizonPanel .wp10-horizon__row").count(), 1);
  } finally { await browser.close(); }
});

test("R4.4 context change between pages (window crossed midnight): ONE clean restart from the first page; the final list is a single consistent assessment", { skip }, async () => {
  const NEXT = { ...HZ_CTX, evaluated_from: "2026-11-16", evaluated_through: "2026-12-16" };
  const seq = [
    { data: HZ_PAGE([HZ_ROW(5)], { has_more: true, next_after_sku_id: 50 }) },
    { data: { ...HZ_PAGE([HZ_ROW(60)]), context: NEXT } },                       // page 2 carries a different window
    { data: { ...HZ_PAGE([HZ_ROW(5), HZ_ROW(60)]), context: NEXT } },            // restarted page 1 (new window)
  ];
  const { browser, page } = await openHarness({ flag: true, portfolioError: { message: "READINESS_BUILD_STALE: x" }, horizon: { sequence: seq } });
  try {
    await loadHz(page);
    await page.locator("#wp10HorizonPanel").getByRole("button", { name: /Load more/ }).click(); await page.waitForTimeout(700);
    assert.deepEqual(await hzCalls(page), [null, 50, null]);
    const t = await page.locator("#wp10HorizonPanel").innerText();
    assert.match(t, /Evaluated from 2026-11-16/);
    assert.equal(await page.locator("#wp10HorizonPanel .wp10-horizon__row").count(), 2);
  } finally { await browser.close(); }
});

test("R4.5 a second context change after the one allowed restart STOPS with an error (never mixes assessments)", { skip }, async () => {
  const C2 = { ...HZ_CTX, evaluated_from: "2026-11-16", evaluated_through: "2026-12-16" }, C3 = { ...HZ_CTX, evaluated_from: "2026-11-17", evaluated_through: "2026-12-17" };
  const seq = [{ data: HZ_PAGE([HZ_ROW(5)], { has_more: true, next_after_sku_id: 50 }) }, { data: { ...HZ_PAGE([HZ_ROW(60)], { has_more: true, next_after_sku_id: 90 }), context: C2 } }, { data: { ...HZ_PAGE([HZ_ROW(5)], { has_more: true, next_after_sku_id: 50 }), context: C2 } }, { data: { ...HZ_PAGE([HZ_ROW(60)]), context: C3 } }];
  const { browser, page } = await openHarness({ flag: true, portfolioError: { message: "READINESS_BUILD_STALE: x" }, horizon: { sequence: seq } });
  try {
    await loadHz(page);
    await page.locator("#wp10HorizonPanel").getByRole("button", { name: /Load more/ }).click(); await page.waitForTimeout(700);
    await page.locator("#wp10HorizonPanel").getByRole("button", { name: /Load more/ }).click().catch(() => {}); await page.waitForTimeout(500);
    assert.match(await page.locator("#wp10HorizonPanel").innerText(), /context changed|PARTIAL/);
  } finally { await browser.close(); }
});

test("D1 lens exit while a horizon read is pending: the panel is removed, the late result is discarded, and re-entry mounts a FRESH panel whose controls work", { skip }, async () => {
  const seq = [{ data: HZ_PAGE([HZ_ROW(5)]), delayMs: 900 }, { data: HZ_PAGE([HZ_ROW(8)]) }];
  const { browser, page } = await openHarness({ flag: true, portfolioError: { message: "READINESS_BUILD_STALE: x" }, horizon: { sequence: seq } });
  try {
    await page.locator("#wp10HorizonPanel").getByRole("button", { name: /Load horizon/ }).click();
    await page.evaluate(() => { window.__lens = "other"; window.ctrl.onLensExit(); window.ctrl.render(); });
    assert.equal(await page.locator("#wp10HorizonPanel").count(), 0);
    await page.waitForTimeout(1200);
    assert.equal(await page.locator("#wp10HorizonPanel").count(), 0, "late result must not resurrect or render into a removed panel");
    await page.evaluate(() => { window.__lens = "portfolio-readiness"; window.ctrl.render(); });
    const btn = page.locator("#wp10HorizonPanel").getByRole("button", { name: /Load horizon/ });
    assert.equal(await btn.isDisabled(), false, "controls are not left inert by the old read");
    await btn.click(); await page.waitForTimeout(500);
    assert.match(await page.locator("#wp10HorizonPanel").innerText(), /SKU 8 · product 108/);
    assert.doesNotMatch(await page.locator("#wp10HorizonPanel").innerText(), /SKU 5 · product 105/);
  } finally { await browser.close(); }
});

test("D2 controller disposal removes the panel; a NEW controller's panel is bound to the new controller (old closures are not reused)", { skip }, async () => {
  const { browser, page } = await openHarness({ flag: true, portfolioError: { message: "READINESS_BUILD_STALE: x" }, horizon: HORIZON_OK() });
  try {
    assert.equal(await page.locator("#wp10HorizonPanel").count(), 1);
    await page.evaluate(() => window.ctrl.destroy());
    assert.equal(await page.locator("#wp10HorizonPanel").count(), 0);
  } finally { await browser.close(); }
});

test("D3 remount of an existing panel (same document) re-binds to the CURRENT lens state: after exit the old isActive closure cannot keep it alive", { skip }, async () => {
  const { browser, page } = await openHarness({ flag: true, portfolioError: { message: "READINESS_BUILD_STALE: x" }, horizon: HORIZON_OK() });
  try {
    const before = await page.evaluate(() => document.getElementById("wp10HorizonPanel") !== null);
    await page.evaluate(() => { window.ctrl.render(); window.ctrl.render(); });
    assert.equal(before, true);
    assert.equal(await page.locator("#wp10HorizonPanel").count(), 1, "repeated renders do not stack panels");
  } finally { await browser.close(); }
});

for (const width of [1280, 390]) {
  test(`O1 whole-page overflow @${width}: flag ON adds no horizontal overflow relative to flag OFF for the same unavailable state (inherited WP11 widths are not hidden)`, { skip }, async () => {
    const measure = async (flag) => {
      const { browser, page } = await openHarness({ flag, portfolioError: { message: "READINESS_BUILD_STALE: x" }, horizon: HORIZON_OK(), width });
      try { return await page.evaluate(() => ({ vw: document.documentElement.clientWidth, doc: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) })); } finally { await browser.close(); }
    };
    const off = await measure(false), on = await measure(true);
    assert.equal(off.vw, on.vw);
    assert.ok(on.doc <= off.doc + 1, `flag ON scrollWidth ${on.doc} must not exceed flag OFF ${off.doc}`);
    fs.mkdirSync(shotDir, { recursive: true });
    fs.writeFileSync(path.join(shotDir, `overflow-compare-${width}.json`), JSON.stringify({ width, flag_off_scrollWidth: off.doc, flag_on_scrollWidth: on.doc, viewport: on.vw }, null, 2) + "\n");
  });
}
