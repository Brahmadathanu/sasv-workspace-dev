// WP05-P01: Readiness usability (remediation navigation, CSV export, LIVE_AS_OF clarity).
// Pure checks always run. Browser checks use Playwright chromium with mock data and are skipped (not failed)
// when it is unavailable or COSTING_READINESS_USABILITY_SKIP=1. No network, no Supabase, no writes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  READINESS_CSV_COLUMNS,
  READINESS_EXPORT_EXTENTS,
  READINESS_RPC,
  buildReadinessCsv,
  buildReadinessCsvFilename,
  buildReadinessRemediationActions,
  buildReadinessRouteHref,
  describeReadinessLiveAsOf,
  READINESS_EXPORT_PARTIAL_REASONS as REASONS,
  validatePortfolioEnvelope,
  walkReadinessPortfolioPages,
  neutraliseReadinessCsvCell,
} from "../../public/shared/js/costing-suite-readiness.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const src = read("public/shared/js/costing-suite-readiness.js");

function assessment(skuId, over = {}) {
  return {
    context: {
      sku_id: skuId,
      product_id: 1000 + skuId,
      period_start: "2026-10-01",
      valuation_date: "2026-10-31",
      context_type: "LIVE_AS_OF",
      context_integrity_status: "OK",
    },
    identity: { product_name: `Product ${skuId}`, pack_size: 100, pack_uom: "ml" },
    lifecycle: { product_status: "ACTIVE", sku_is_active: true, sku_is_sample: false },
    summary: {
      overall_severity: skuId % 3 === 0 ? "BLOCKER" : skuId % 3 === 1 ? "REVIEW_REQUIRED" : "READY",
      product_master_foundation_status: "READY",
      sku_master_foundation_status: "READY",
      costing_foundation_status: "REVIEW_REQUIRED",
      evidence_quality_status: "UNKNOWN",
      costing_outcome_status: "BLOCKED",
    },
    dependencies:
      skuId % 3 === 0
        ? [
            { dependency_code: "ROUTE", label: "Production route", applicability: "APPLICABLE", effective_status: "BLOCKER", recommended_ui_route: "PRODUCTION_ROUTE_MANAGER" },
            { dependency_code: "BUILD", label: "Cost build", applicability: "APPLICABLE", effective_status: "REVIEW_REQUIRED", recommended_ui_route: "COST_BUILD_MANAGER" },
            { dependency_code: "BOM", label: "BOM", applicability: "APPLICABLE", effective_status: "READY", recommended_ui_route: "PM_BOM_MANAGER" },
            { dependency_code: "NA", label: "N/A dep", applicability: "NOT_APPLICABLE", effective_status: "BLOCKER", recommended_ui_route: "PRODUCTION_ROUTE_MANAGER" },
          ]
        : [],
    shared_issues: [],
    downstream_control: skuId % 3 === 0
      ? { first_control_status: "DIRECT_LABOUR_ROUTE_BLOCKED", control_severity: "BLOCKER", recommended_ui_route: "MATERIAL_RATE_MANAGER", control_note: "=cmd|' /C calc'!A0" }
      : null,
    ...over,
  };
}

test("remediation: server route + resolver give a destination only where mapped and configured", () => {
  const actions = buildReadinessRemediationActions(assessment(3));
  const route = actions.find((a) => a.routeCode === "PRODUCTION_ROUTE_MANAGER");
  assert.equal(route.navigable, true);
  assert.equal(route.moduleKey, "production-route-manager");
  assert.deepEqual(route.navigateParams, { lens: "product-route-assignments", productId: 1003 });
  assert.equal(route.buttonLabel, "Open Production Route Manager");
  // Unmapped routes stay visible, with no invented destination.
  const build = actions.find((a) => a.routeCode === "COST_BUILD_MANAGER");
  assert.equal(build.navigable, false);
  assert.equal(build.moduleKey, null);
  assert.equal(build.navigateParams, null);
  assert.match(build.unavailableReason, /No destination/);
  // READY and NOT_APPLICABLE dependencies produce no action.
  assert.equal(actions.some((a) => a.routeCode === "PM_BOM_MANAGER"), false);
  assert.equal(actions.filter((a) => a.routeCode === "PRODUCTION_ROUTE_MANAGER").length, 1);
  // Material Rate Manager needs RM/PM line counts the readiness contract does not return.
  const material = actions.find((a) => a.routeCode === "MATERIAL_RATE_MANAGER");
  assert.equal(material.navigable, false);
  assert.deepEqual(buildReadinessRemediationActions(assessment(2)), []);
  assert.deepEqual(buildReadinessRemediationActions(null), []);
});

test("remediation: href fallback is same-page-family, new-tab safe, excludes PPM", () => {
  const [route] = buildReadinessRemediationActions(assessment(3));
  assert.equal(buildReadinessRouteHref(route), "production-route-manager.html?lens=product-route-assignments&product_id=1003");
  assert.equal(buildReadinessRouteHref({ navigable: false }), null);
  assert.equal(buildReadinessRouteHref({ navigable: true, moduleKey: "pricing-policy-manager", navigateParams: {} }), null);
  const pricing = buildReadinessRemediationActions({
    context: { sku_id: 1, product_id: 2, period_start: "2026-10-01" },
    dependencies: [{ dependency_code: "P", label: "Pricing", effective_status: "REVIEW_REQUIRED", recommended_ui_route: "PRICING_POLICY_REVIEW" }],
    downstream_control: { pricing_bridge_status: "REVIEW_REQUIRED" },
  })[0];
  assert.equal(pricing.navigable, true);
  assert.equal(buildReadinessRouteHref(pricing), null, "needs shell canonicalisation; not built here");
});

test("CSV: formula injection is neutralised, including leading whitespace and control chars", () => {
  for (const v of ["=1+1", "+1", "-1", "@SUM(A1)", "\t=x", "\r=x", "\n=x", " =HYPERLINK(\"x\")", "  @x"]) {
    assert.match(neutraliseReadinessCsvCell(v), /^'/, JSON.stringify(v));
  }
  assert.equal(neutraliseReadinessCsvCell("Plain"), "Plain");
  assert.equal(neutraliseReadinessCsvCell(-5), -5);
  const a = assessment(3, { identity: { product_name: "=HYPERLINK(\"http://x\")", pack_size: 1, pack_uom: "kg" } });
  const csv = buildReadinessCsv([a], { extent: READINESS_EXPORT_EXTENTS.loaded, exportedRows: 1, matchedCount: 9 });
  const lines = csv.split("\n");
  assert.equal(lines.length, 2);
  assert.ok(lines[1].includes(`"'=HYPERLINK(""http://x"")"`));
  assert.ok(lines[1].includes(`"'=cmd|' /C calc'!A0"`));
  assert.doesNotMatch(csv, /,"=/);
});

test("CSV: columns carry basis/extent/matched count and raw statuses; filename never claims full when partial", () => {
  const csv = buildReadinessCsv([assessment(4)], { extent: "LOADED_PAGES", exportedRows: 1, matchedCount: 120, populationScope: "OPERATIONAL" });
  const [head, row] = csv.split("\n");
  assert.equal(head.split('","').length, READINESS_CSV_COLUMNS.length);
  assert.ok(head.includes("Export extent") && head.includes("Server matched count"));
  assert.ok(row.startsWith('"LIVE_AS_OF","LOADED_PAGES","1","","120"'));
  assert.ok(row.includes('"UNKNOWN"') && row.includes('"BLOCKED"'));
  const now = new Date("2026-11-02T10:11:12Z");
  const f = (extent) => buildReadinessCsvFilename({ periodStart: "2026-10-01", populationScope: "operational", extent, rowCount: 50, now });
  assert.match(f("LOADED_PAGES"), /LOADED_PAGES_ROWS_50/);
  assert.match(f("ALL_MATCHING"), /ALL_MATCHING_ROWS_50/);
  assert.match(f("PARTIAL_ALL_MATCHING"), /PARTIAL_ROWS_50/);
  assert.match(f("LOADED_PAGES"), /^ERP_COSTING_READINESS_LIVE_AS_OF_PERIOD_202610_OPERATIONAL_/);
});

test("LIVE_AS_OF: model states governed period and only claims live when the server says LIVE_AS_OF", () => {
  const live = describeReadinessLiveAsOf({ periodStart: "2026-10-01", valuationDate: "2026-10-31", observedAt: "2026-11-02T10:00:00Z", contextType: "live_as_of" });
  assert.equal(live.isLiveAsOf, true);
  assert.match(live.explanation, /live governed snapshot/);
  assert.match(live.explanation, /not tied to an approved or draft costing run/);
  assert.match(live.explanation, /SKU Control Status can instead show a frozen costing run/);
  const other = describeReadinessLiveAsOf({ periodStart: "2026-10-01", contextType: "RUN_SNAPSHOT" });
  assert.equal(other.isLiveAsOf, false);
  assert.equal(other.explanation, null);
});

test("boundaries: only the three governed readiness RPCs, no writes, no run selector or run-specific args", () => {
  assert.deepEqual(Object.values(READINESS_RPC).sort(), [
    "rpc_get_product_sku_readiness_portfolio",
    "rpc_get_readiness_governed_periods",
    "rpc_get_readiness_product_gaps",
  ]);
  const rpcNames = new Set([...src.matchAll(/\brpc_[a-z0-9_]+/g)].map((m) => m[0]));
  assert.deepEqual([...rpcNames].sort(), Object.values(READINESS_RPC).sort());
  assert.doesNotMatch(src, /\.(insert|update|upsert|delete)\(/);
  assert.doesNotMatch(src, /\.from\(["'`]/);
  assert.doesNotMatch(src, /p_(refresh_run|run)_id|p_run_status|runSelect|run-selector|<select[^>]*run/i);
  assert.doesNotMatch(src, /localStorage\.setItem/);
  // No new feature flag: only the pre-existing flag readers are imported.
  assert.match(src, /import \{ isCostingRecalcWithDateV1Enabled, isCostingUxConsistencyV1Enabled \} from "\.\/costing-feature-flags\.js";/);
  assert.doesNotMatch(src, /COSTING_[A-Z_]+_V1\s*=/);
});

// ---------------------------------------------------------------- browser (mock data)
const SKIP_BROWSER = process.env.COSTING_READINESS_USABILITY_SKIP === "1";
let chromium = null;
try {
  chromium = createRequire(import.meta.url)("playwright").chromium;
} catch {
  chromium = null;
}
const browserOpts = { skip: SKIP_BROWSER || !chromium ? "playwright/chromium unavailable or skipped" : false };

const html = read("public/shared/costing-control-center.html");
const hostStart = html.indexOf('<div\n        id="readinessLensHost"');
const hostEnd = html.indexOf('<div id="genericTableCard"');
const HOST_MARKUP = html.slice(hostStart, hostEnd);

const MIME = { ".js": "text/javascript", ".html": "text/html", ".css": "text/css" };

async function openHarness({ canView = true, withShellNavigator = false, searchValue = "", total = 120, mode = "" } = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("http://harness.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/harness.html") {
      return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><body><div id="filters"><select id="readinessPopulationScope"><option value="OPERATIONAL">Operational</option></select><ul id="readinessSeverityFilters"></ul><ul id="readinessDependencyFilters"></ul><ul id="readinessOwnerFilters"></ul><ul id="readinessRouteFilters"></ul><div id="readinessAppliedFilters"></div></div>
          <div id="readinessMembershipModal" class="hidden" hidden><span id="readinessMembershipModalTitle"></span><button id="readinessMembershipModalClose"></button><div id="readinessMembershipModalBody"></div></div>
          ${HOST_MARKUP}<div id="drawerContent"></div></body></html>`,
      });
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
      const TOTAL = ${total};
      const calls = []; const toasts = []; const downloads = []; const opened = []; const shellNav = [];
      window.__calls = calls; window.__toasts = toasts; window.__downloads = downloads; window.__opened = opened; window.__shellNav = shellNav;
      window.open = (...a) => { opened.push(a); return null; };
      const mk = (id) => ${assessment.toString()}(id);
      window.__search = ${JSON.stringify(searchValue)};
      async function costingRpc(name, args) {
        calls.push({ name, args });
        if (window.__onCall) await window.__onCall(calls.length, name, args);
        if (name === "rpc_get_readiness_governed_periods") return { data: { observed_at: "2026-11-02T10:00:00Z", rows: [{ period_start: "2026-10-01", valuation_date: "2026-10-31" }], limit: 24, returned_count: 1, has_more: false }, error: null };
        if (name === "rpc_get_readiness_product_gaps") return { data: { assessment_kind: "PRODUCT_MEMBERSHIP_GAPS", observed_at: "2026-11-02T10:00:00Z", product_scope: "ACTIVE_PRODUCTS", gap_kind: args.p_gap_kind, rows: [], statistics: { product_count: 1, no_sku_count: 0, active_without_active_sku_count: 0 }, limit: 25, matched_count: 0, returned_count: 0, has_more: false }, error: null };
        let ids = Array.from({ length: TOTAL }, (_, i) => i + 1);
        if (args.p_search) ids = ids.filter((id) => ("Product " + id).toLowerCase().includes(String(args.p_search).toLowerCase()));
        if (args.p_overall_severities) ids = ids.filter((id) => args.p_overall_severities.includes(mk(id).summary.overall_severity));
        const start = args.p_after_sku_id == null ? 0 : ids.findIndex((id) => id > args.p_after_sku_id);
        const slice = start < 0 ? [] : ids.slice(start, start + args.p_limit);
        const last = slice[slice.length - 1];
        const hasMore = start >= 0 && start + args.p_limit < ids.length;
        const MODE = ${JSON.stringify(mode)};
        if (MODE === "repeat-cursor" && args.p_after_sku_id != null) { return { data: { observed_at: "2026-11-02T10:00:01Z", context: { context_type: "LIVE_AS_OF", period_start: "2026-10-01", requested_period_start: "2026-10-01", valuation_date: "2026-10-31", context_integrity_status: "OK" }, population_scope: args.p_population_scope, filters: {}, filter_options: { overall_severities: ["READY"], dependency_codes: [], owner_modules: [], route_codes: [] }, after_sku_id: args.p_after_sku_id, limit: args.p_limit, statistics: { population_sku_count: TOTAL, overall_severity_counts: { READY: 1, REVIEW_REQUIRED: 1, BLOCKER: 1, UNKNOWN: 0 }, unresolved_dependency_counts: [], unresolved_owner_counts: [], unresolved_route_counts: [], unresolved_shared_issue_counts: [], regional_marketing_counts: [] }, matched_count: TOTAL, returned_count: 1, rows: [mk(args.p_after_sku_id)], has_more: true, next_after_sku_id: args.p_after_sku_id }, error: null }; }
        return { data: { observed_at: "2026-11-02T10:00:01Z", context: { context_type: MODE === "other-context" ? "RUN_SNAPSHOT" : "LIVE_AS_OF", period_start: "2026-10-01", requested_period_start: "2026-10-01", valuation_date: "2026-10-31", context_integrity_status: "OK" }, population_scope: args.p_population_scope, filters: {}, filter_options: { overall_severities: ["READY","REVIEW_REQUIRED","BLOCKER","UNKNOWN"], dependency_codes: [], owner_modules: [], route_codes: [] }, after_sku_id: args.p_after_sku_id, limit: args.p_limit, statistics: { population_sku_count: TOTAL, overall_severity_counts: { READY: 1, REVIEW_REQUIRED: 1, BLOCKER: 1, UNKNOWN: 0 }, unresolved_dependency_counts: [], unresolved_owner_counts: [], unresolved_route_counts: [], unresolved_shared_issue_counts: [], regional_marketing_counts: [] }, matched_count: ids.length, returned_count: slice.length, rows: slice.map(mk), has_more: hasMore, next_after_sku_id: hasMore ? last : null }, error: null };
      }
      const ctrl = createPortfolioReadinessController({
        costingRpc, showToast: (m, k) => toasts.push([m, k]), text: (v) => v == null || v === "" ? "—" : String(v),
        getCurrentLens: () => "portfolio-readiness", canView: () => ${canView}, getSearchValue: () => window.__search,
        openDetails: (row) => { document.getElementById("drawerContent").innerHTML = ctrl.renderDrawerTab("readiness", row); },
        downloadCsv: (csv, filename) => { downloads.push({ csv, filename }); return true; },
        ${withShellNavigator ? "navigateToCostingRoute: (m, p, o) => { shellNav.push([m, p, o]); return true; }," : ""}
      });
      window.ctrl = ctrl; window.__ready = true;
    `,
  });
  await page.waitForFunction(() => window.__ready === true);
  return { browser, page, errors };
}

test("browser: LIVE_AS_OF banner, no run selector, paged loaded export is labelled as partial", browserOpts, async () => {
  const { browser, page, errors } = await openHarness();
  try {
    await page.evaluate(() => window.ctrl.load());
    const banner = await page.locator("#readinessLiveAsOf").innerText();
    assert.match(banner, /Live as-of snapshot/);
    assert.match(banner, /Governed period\s*2026-10-01/);
    assert.match(banner, /Valuation date\s*2026-10-31/);
    assert.match(banner, /Observed at\s*2026-11-02T10:00:01Z/);
    assert.match(banner, /not tied to an approved or draft costing run/);
    assert.match(banner, /SKU Control Status can instead show a frozen costing run/);
    assert.equal(await page.locator("#readinessLensHost select, #readinessLensHost [data-run-select]").count(), 0);
    assert.equal(await page.locator("#readinessLensHost").getByText(/select (a )?run/i).count(), 0);
    assert.equal(await page.locator("#readinessExportLoadedBtn").innerText(), "Export loaded rows (50 of 120)");
    assert.equal(await page.locator("#readinessExportAllBtn").isVisible(), true);
    assert.equal(await page.locator("#readinessExportAllBtn").innerText(), "Export all matching (120)");
    assert.match(await page.locator("#readinessExportNote").innerText(), /Loaded rows only covers pages already loaded/);
    await page.click("#readinessExportLoadedBtn");
    const d = await page.evaluate(() => window.__downloads);
    assert.equal(d.length, 1);
    assert.equal(d[0].csv.split("\n").length, 51);
    assert.match(d[0].filename, /LOADED_PAGES_ROWS_50/);
    assert.match(d[0].csv.split("\n")[1], /^"LIVE_AS_OF","LOADED_PAGES","50","LOADED PAGES ONLY: 50 of 120 matching rows","120"/);
    const toast = await page.evaluate(() => window.__toasts.at(-1));
    assert.match(toast[0], /50 loaded rows of 120 matched \(not the full set\)/);
    // Pagination: load next page, the loaded export grows; at end the single button is a full export.
    await page.evaluate(() => window.ctrl.appendNextPortfolioPage());
    assert.equal(await page.locator("#readinessExportLoadedBtn").innerText(), "Export loaded rows (100 of 120)");
    await page.evaluate(() => window.ctrl.appendNextPortfolioPage());
    assert.equal(await page.locator("#readinessExportLoadedBtn").innerText(), "Export CSV (120 rows)");
    assert.equal(await page.locator("#readinessExportAllBtn").isVisible(), false);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test("browser: export all matching walks the same RPC with the same filters/search and labels complete", browserOpts, async () => {
  const h = await openHarness({ searchValue: "", total: 230 });
  try {
    await h.page.evaluate(() => window.ctrl.load());
    await h.page.evaluate(() => { window.__calls.length = 0; });
    await h.page.evaluate(() => window.ctrl.exportCsv({ scope: "all" }));
    const calls = await h.page.evaluate(() => window.__calls.filter((c) => c.name === "rpc_get_product_sku_readiness_portfolio"));
    assert.equal(calls.length, 3, "100 + 100 + 30");
    assert.deepEqual(calls.map((c) => c.args.p_after_sku_id), [null, 100, 200]);
    for (const c of calls) {
      assert.equal(c.args.p_period_start, "2026-10-01");
      assert.equal(c.args.p_population_scope, "OPERATIONAL");
      assert.equal(c.args.p_limit, 100);
      assert.equal(c.args.p_search, null);
      assert.deepEqual(Object.keys(c.args).sort(), ["p_after_sku_id", "p_dependency_codes", "p_limit", "p_overall_severities", "p_owner_modules", "p_period_start", "p_population_scope", "p_route_codes", "p_search"]);
    }
    const [d] = await h.page.evaluate(() => window.__downloads);
    assert.equal(d.csv.split("\n").length, 231);
    assert.match(d.filename, /ALL_MATCHING_ROWS_230/);
    assert.match(d.csv.split("\n")[1], /"ALL_MATCHING","230","","230"/);
    assert.deepEqual(h.errors, []);
  } finally {
    await h.browser.close();
  }
});

test("browser: filters and search are preserved in the export; permission denial blocks it", browserOpts, async () => {
  const h = await openHarness({ searchValue: "Product 1" });
  try {
    await h.page.evaluate(() => window.ctrl.load());
    await h.page.evaluate(() => window.ctrl.exportCsv({ scope: "all" }));
    const [d] = await h.page.evaluate(() => window.__downloads);
    // Product 1, 10-19, 100-120 => 32 rows, all within one page => complete.
    assert.equal(d.csv.split("\n").length, 33);
    assert.match(d.csv.split("\n")[1], /"ALL_MATCHING","32","","32"/);
    assert.match(d.csv.split("\n")[1], /"Product 1"/);
    const searchCalls = await h.page.evaluate(() => window.__calls.filter((c) => c.name === "rpc_get_product_sku_readiness_portfolio").map((c) => c.args.p_search));
    assert.ok(searchCalls.length >= 2 && searchCalls.every((x) => x === "Product 1"));
  } finally {
    await h.browser.close();
  }
  const f = await openHarness();
  try {
    await f.page.evaluate(() => window.ctrl.load());
    await f.page.check('#readinessSeverityFilters input[value="BLOCKER"]');
    await f.page.evaluate(() => window.ctrl.applyPendingFilters());
    await f.page.waitForFunction(() => window.ctrl.getMatchedCount() === 40);
    await f.page.evaluate(() => { window.__calls.length = 0; });
    await f.page.evaluate(() => window.ctrl.exportCsv({ scope: "all" }));
    const calls = await f.page.evaluate(() => window.__calls.map((c) => c.args.p_overall_severities));
    assert.ok(calls.length >= 1 && calls.every((x) => x.length === 1 && x[0] === "BLOCKER"));
    const [d] = await f.page.evaluate(() => window.__downloads);
    const lines = d.csv.split("\n");
    assert.equal(lines.length, 41);
    assert.ok(lines.slice(1).every((l) => l.includes('"BLOCKER"')));
    assert.ok(lines[1].includes('"severity=BLOCKER"'));
  } finally {
    await f.browser.close();
  }
  const denied = await openHarness({ canView: false });
  try {
    await denied.page.evaluate(() => window.ctrl.load());
    const r = await denied.page.evaluate(() => window.ctrl.exportCsv({ scope: "loaded" }));
    assert.equal(r.ok, false);
    assert.equal((await denied.page.evaluate(() => window.__downloads)).length, 0);
    assert.match((await denied.page.evaluate(() => window.__toasts.at(-1)))[0], /permission denied/i);
    assert.equal(await denied.page.locator("#readinessExportLoadedBtn").isDisabled(), true);
  } finally {
    await denied.browser.close();
  }
});

test("browser: fix actions open only configured destinations; unsupported routes are shown without a button", browserOpts, async () => {
  const h = await openHarness();
  try {
    await h.page.evaluate(() => window.ctrl.load());
    assert.equal(await h.page.locator("#readinessTableBody tr[data-sku-id='3']").getByText("Fix available: Production Route Manager").count(), 1);
    assert.equal(await h.page.locator("#readinessTableBody tr[data-sku-id='1']").getByText(/Fix available/).count(), 0);
    await h.page.click("#readinessTableBody tr[data-sku-id='3']");
    const drawer = h.page.locator("#drawerContent");
    assert.equal(await drawer.getByRole("button", { name: "Open Production Route Manager" }).count(), 1);
    assert.equal(await drawer.locator("[data-readiness-fix]").count(), 1, "only the mapped destination is a button");
    const text = await drawer.innerText();
    assert.match(text, /Cost Build Manager — No destination is configured/);
    assert.match(text, /Material Rate Manager — No destination is configured/);
    assert.doesNotMatch(text, /Production route.*N\/A dep/s);
    await drawer.getByRole("button", { name: "Open Production Route Manager" }).click();
    const opened = await h.page.evaluate(() => window.__opened);
    assert.equal(opened.length, 1);
    assert.deepEqual(opened[0], ["production-route-manager.html?lens=product-route-assignments&product_id=1003", "_blank", "noopener,noreferrer"]);
  } finally {
    await h.browser.close();
  }
  const s = await openHarness({ withShellNavigator: true });
  try {
    await s.page.evaluate(() => window.ctrl.load());
    await s.page.click("#readinessTableBody tr[data-sku-id='6']");
    await s.page.locator("#drawerContent").getByRole("button", { name: "Open Production Route Manager" }).click();
    const nav = await s.page.evaluate(() => window.__shellNav);
    assert.deepEqual(nav, [["production-route-manager", { lens: "product-route-assignments", productId: 1006 }, { newTab: true }]]);
    assert.equal((await s.page.evaluate(() => window.__opened)).length, 0);
    assert.deepEqual(s.errors, []);
  } finally {
    await s.browser.close();
  }
});

// ---------------------------------------------------------------- WP05-P01 correction pass
function fakePage(over = {}) {
  return {
    context: { period_start: "2026-10-01" },
    population_scope: "OPERATIONAL",
    observed_at: "t",
    matched_count: 4,
    after_sku_id: null,
    rows: [],
    has_more: false,
    next_after_sku_id: null,
    ...over,
  };
}
const rowsOf = (...ids) => ids.map((id) => ({ context: { sku_id: id } }));
async function walk(pages, extra = {}) {
  const seen = [];
  const res = await walkReadinessPortfolioPages({
    expectedPeriodStart: "2026-10-01",
    expectedPopulationScope: "OPERATIONAL",
    fetchPage: async (after) => {
      seen.push(after);
      const next = pages.shift();
      assert.ok(next, "unexpected extra fetch");
      return typeof next === "function" ? next(after) : next;
    },
    ...extra,
  });
  return { res, seen };
}

test("walker: well-formed chain is complete only when unique rows equal matched count", async () => {
  const { res, seen } = await walk([
    fakePage({ rows: rowsOf(1, 2), has_more: true, next_after_sku_id: 2 }),
    fakePage({ rows: rowsOf(3, 4), after_sku_id: 2 }),
  ]);
  assert.equal(res.complete, true);
  assert.equal(res.reason, null);
  assert.equal(res.rows.length, 4);
  assert.deepEqual(seen, [null, 2]);
});

test("walker: missing, repeated, regressing or empty cursors end PARTIAL with a reason, never complete", async () => {
  const more = (o) => fakePage({ has_more: true, ...o });
  const cases = [
    [REASONS.cursorMissing, [more({ rows: rowsOf(1, 2), next_after_sku_id: null })]],
    [REASONS.emptyPageWithMore, [more({ rows: [], next_after_sku_id: 5 })]],
    [REASONS.cursorNotAdvancing, [more({ rows: rowsOf(1, 2), next_after_sku_id: 2 }), more({ rows: rowsOf(3), after_sku_id: 2, next_after_sku_id: 2 })]],
    [REASONS.cursorNotAdvancing, [more({ rows: rowsOf(1, 2), next_after_sku_id: 2 }), more({ rows: rowsOf(3), after_sku_id: 2, next_after_sku_id: 1 })]],
    [REASONS.noNewRows, [more({ rows: rowsOf(1, 2), next_after_sku_id: 2 }), more({ rows: rowsOf(1, 2), after_sku_id: 2, next_after_sku_id: 9 })]],
    [REASONS.cursorEchoMismatch, [more({ rows: rowsOf(1, 2), next_after_sku_id: 2 }), fakePage({ rows: rowsOf(3, 4), after_sku_id: 1 })]],
    [REASONS.matchedCountChanged, [more({ rows: rowsOf(1, 2), next_after_sku_id: 2 }), fakePage({ rows: rowsOf(3, 4), after_sku_id: 2, matched_count: 5 })]],
    [REASONS.rowCountMismatch, [fakePage({ rows: rowsOf(1, 2, 3), matched_count: 4 })]],
  ];
  for (const [reason, pages] of cases) {
    const { res } = await walk(pages);
    assert.equal(res.complete, false, reason);
    assert.equal(res.reason, reason);
  }
});

test("walker: page bound is partial; period/scope drift throws; cancellation returns no rows", async () => {
  let n = 0;
  const bounded = await walkReadinessPortfolioPages({
    expectedPeriodStart: "2026-10-01",
    expectedPopulationScope: "OPERATIONAL",
    maxPages: 3,
    fetchPage: async (after) => { n += 1; return fakePage({ rows: rowsOf(n * 10), matched_count: 99, after_sku_id: after, has_more: true, next_after_sku_id: n * 10 }); },
  });
  assert.equal(bounded.complete, false);
  assert.equal(bounded.reason, REASONS.pageLimit);
  assert.equal(bounded.pages, 3);
  await assert.rejects(walk([fakePage({ context: { period_start: "2026-09-01" } })]), /different governed period/);
  await assert.rejects(walk([fakePage({ population_scope: "ALL_EXISTING" })]), /different population scope/);
  const cancelled = await walk([fakePage()], { isCancelled: () => true });
  assert.equal(cancelled.res.cancelled, true);
  assert.equal(cancelled.res.rows, undefined);
});

test("validator still rejects has_more=true without next_after_sku_id (first line of defence)", () => {
  const env = {
    observed_at: "t", context: { period_start: "2026-10-01", context_type: "LIVE_AS_OF" }, population_scope: "OPERATIONAL", filters: {},
    filter_options: { overall_severities: ["READY"], dependency_codes: [], owner_modules: [], route_codes: [] },
    statistics: { population_sku_count: 1, overall_severity_counts: { READY: 0, REVIEW_REQUIRED: 0, BLOCKER: 0, UNKNOWN: 0 }, unresolved_dependency_counts: [], unresolved_owner_counts: [], unresolved_route_counts: [], unresolved_shared_issue_counts: [], regional_marketing_counts: [] },
    limit: 50, matched_count: 5, returned_count: 0, rows: [], has_more: true, next_after_sku_id: null,
  };
  assert.equal(validatePortfolioEnvelope(env).ok, false);
  assert.equal(validatePortfolioEnvelope({ ...env, has_more: false }).ok, true);
  assert.equal(validatePortfolioEnvelope({ ...env, has_more: false }).value.context.context_type, "LIVE_AS_OF");
});

test("CSV: partial note column is present and formula-neutralised cells survive in partial exports", () => {
  const a = assessment(3, { identity: { product_name: "@evil", pack_size: 1, pack_uom: "kg" } });
  const csv = buildReadinessCsv([a], { extent: "PARTIAL_ALL_MATCHING", note: "PARTIAL: 1 of 9 matching rows (x)", exportedRows: 1, matchedCount: 9 });
  const [head, row] = csv.split("\n");
  assert.ok(head.includes('"Export note"'));
  assert.ok(row.startsWith('"LIVE_AS_OF","PARTIAL_ALL_MATCHING","1","PARTIAL: 1 of 9 matching rows (x)","9"'));
  assert.ok(row.includes('"\'@evil"'));
});

test("browser: misbehaving server cursor yields a clearly PARTIAL file, never ALL_MATCHING", browserOpts, async () => {
  const h = await openHarness({ mode: "repeat-cursor" });
  try {
    await h.page.evaluate(() => window.ctrl.load());
    const r = await h.page.evaluate(() => window.ctrl.exportCsv({ scope: "all" }));
    assert.equal(r.ok, true);
    assert.equal(r.extent, "PARTIAL_ALL_MATCHING");
    assert.match(r.filename, /_PARTIAL_ROWS_/);
    assert.doesNotMatch(r.filename, /ALL_MATCHING/);
    const rows = r.csv.split("\n");
    assert.match(rows[1], /"PARTIAL_ALL_MATCHING"/);
    assert.match(rows[1], /PARTIAL: .* of 120 matching rows \(server paging was inconsistent: CURSOR_NOT_ADVANCING\)/);
    assert.ok(rows.slice(1).every((l) => !l.includes('"ALL_MATCHING"')));
    const toast = await h.page.evaluate(() => window.__toasts.at(-1));
    assert.match(toast[0], /Partial export: .* not the full set/);
  } finally {
    await h.browser.close();
  }
});

test("browser: changing search, period, scope or leaving the lens mid-export cancels it with no download", browserOpts, async () => {
  const actions = {
    search: () => window.ctrl.syncSearchFromShell("Product 7"),
    period: () => window.ctrl.applyShellPeriodStart("2026-09-01"),
    exit: () => window.ctrl.onLensExit(),
    reload: () => window.ctrl.load(),
  };
  for (const [name, fn] of Object.entries(actions)) {
    const h = await openHarness({ total: 230 });
    try {
      await h.page.evaluate(() => window.ctrl.load());
      await h.page.evaluate(`window.__onCall = async (n, rpc) => { if (rpc === "rpc_get_product_sku_readiness_portfolio" && n === window.__armAt) { window.__onCall = null; await (${actions[name].toString()})(); } };`);
      await h.page.evaluate(() => { window.__armAt = window.__calls.length + 2; window.__downloads.length = 0; });
      const r = await h.page.evaluate(() => window.ctrl.exportCsv({ scope: "all" }));
      assert.equal(r.ok, false, name);
      assert.equal(r.cancelled, true, name);
      assert.equal((await h.page.evaluate(() => window.__downloads)).length, 0, name);
      assert.match((await h.page.evaluate(() => window.__toasts.find((t) => /cancelled/.test(t[0]))))[0], /nothing was downloaded/, name);
    } finally {
      await h.browser.close();
    }
  }
});

test("browser: export refuses while loading and exports under the register's own context", browserOpts, async () => {
  const h = await openHarness({ total: 230 });
  try {
    await h.page.evaluate(() => window.ctrl.load());
    // Filter change in flight: state changes synchronously, register is mid-reload.
    await h.page.evaluate(() => { window.__onCall = async () => { await new Promise((r) => setTimeout(r, 50)); }; });
    const during = await h.page.evaluate(async () => {
      const pending = window.ctrl.syncSearchFromShell("Product 2");
      const r = await window.ctrl.exportCsv({ scope: "loaded" });
      await pending;
      return r;
    });
    assert.equal(during.ok, false);
    assert.equal((await h.page.evaluate(() => window.__downloads)).length, 0);
    await h.page.evaluate(() => { window.__onCall = null; });
    const r = await h.page.evaluate(() => window.ctrl.exportCsv({ scope: "all" }));
    assert.equal(r.ok, true);
    assert.match(r.csv.split("\n")[1], /"Product 2"|"Product 2\d*"/);
    assert.ok(r.csv.split("\n").slice(1).every((l) => l.includes('"Product 2')));
    assert.match(r.filename, /ALL_MATCHING/);
  } finally {
    await h.browser.close();
  }
});

// ---- Replacement protection for the lifted UX-F1 byte-identity pin
test("guard: a user without view permission triggers no RPC and no export", browserOpts, async () => {
  const h = await openHarness({ canView: false });
  try {
    const r = await h.page.evaluate(() => window.ctrl.load());
    assert.equal((await h.page.evaluate(() => window.__calls)).length, 0);
    assert.equal(await h.page.evaluate(() => window.ctrl.isUnavailable()), true);
    const e = await h.page.evaluate(() => window.ctrl.exportCsv({ scope: "all" }));
    assert.equal(e.ok, false);
    assert.equal((await h.page.evaluate(() => window.__calls)).length, 0);
    assert.equal((await h.page.evaluate(() => window.__downloads)).length, 0);
  } finally {
    await h.browser.close();
  }
});

test("guard: every RPC issued across load, paging and both exports is allow-listed with allow-listed arguments", browserOpts, async () => {
  const h = await openHarness({ total: 230 });
  try {
    await h.page.evaluate(() => window.ctrl.load());
    await h.page.evaluate(() => window.ctrl.appendNextPortfolioPage());
    await h.page.evaluate(() => window.ctrl.exportCsv({ scope: "loaded" }));
    await h.page.evaluate(() => window.ctrl.exportCsv({ scope: "all" }));
    const calls = await h.page.evaluate(() => window.__calls);
    const allowed = {
      rpc_get_readiness_governed_periods: ["p_before_period_start", "p_limit"],
      rpc_get_readiness_product_gaps: ["p_after_product_id", "p_gap_kind", "p_limit", "p_product_scope", "p_search"],
      rpc_get_product_sku_readiness_portfolio: ["p_after_sku_id", "p_dependency_codes", "p_limit", "p_overall_severities", "p_owner_modules", "p_period_start", "p_population_scope", "p_route_codes", "p_search"],
    };
    assert.ok(calls.length > 5);
    for (const c of calls) {
      assert.ok(allowed[c.name], `unexpected RPC ${c.name}`);
      assert.deepEqual(Object.keys(c.args).sort(), allowed[c.name], c.name);
    }
    assert.deepEqual([...new Set(calls.map((c) => c.name))].sort(), Object.keys(allowed).sort());
  } finally {
    await h.browser.close();
  }
});

test("guard: LIVE_AS_OF is only asserted when the server says so; no run selector in markup or rendered page", browserOpts, async () => {
  assert.doesNotMatch(HOST_MARKUP, /<select|run-select|data-run|approved|draft/i);
  const live = await openHarness();
  try {
    await live.page.evaluate(() => window.ctrl.load());
    assert.match(await live.page.locator("#readinessLiveAsOf").innerText(), /Live as-of snapshot/);
    assert.equal(await live.page.locator("#readinessLensHost select, #readinessLensHost input[type=radio], #readinessLensHost [role=combobox]").count(), 0);
  } finally {
    await live.browser.close();
  }
  const other = await openHarness({ mode: "other-context" });
  try {
    await other.page.evaluate(() => window.ctrl.load());
    const t = await other.page.locator("#readinessLiveAsOf").innerText();
    assert.doesNotMatch(t, /Live as-of snapshot/);
    assert.match(t, /server reported context type RUN_SNAPSHOT/i);
    assert.doesNotMatch(t, /not tied to an approved or draft/);
  } finally {
    await other.browser.close();
  }
});
