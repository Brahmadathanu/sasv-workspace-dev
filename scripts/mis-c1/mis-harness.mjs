// MIS-C1 browser harness for the Executive MIS Dashboard.
// Serves /public from disk and replaces the Supabase ESM import with an in-page mock whose responses the test
// controls (deferred/slow/failing). No network, no real Supabase, no writes. A pass here is a *simulation*
// result; it is not authenticated production acceptance.
//
// Requires Playwright (chromium) on NODE_PATH; callers should skip (not fail) when launchBrowser() returns null.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PAGE_PATH = "/shared/executive-mis-dashboard.html";
export const WIDTHS = [320, 390, 520, 768, 1280];
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2" };

// In-page Supabase mock. Fixtures are keyed by RPC / table name; tests override via window.__mis.handlers[name].
const SUPABASE_STUB = `
const user = { id: "00000000-0000-0000-0000-000000000000", email: "mis-test@example.invalid" };
const session = { access_token: "stub", user };
const mis = (window.__mis = window.__mis || {});
mis.calls = [];
mis.handlers = mis.handlers || {};
mis.permission = mis.permission || "granted"; // granted | denied | error
mis.defer = () => { let resolve; const promise = new Promise((r) => (resolve = r)); return { promise, resolve }; };
const names = (n, make) => Array.from({ length: n }, (_, i) => make(i));
const page = (total, args, make) => {
  const off = args.p_offset || 0, lim = args.p_limit || 25;
  return { data: names(Math.max(0, Math.min(lim, total - off)), (i) => ({ ...make(off + i), total_rows: total })), error: null };
};
const searchTotal = (args, all, hit) => (args.p_search ? hit : all);
const fixtures = {
  get_user_permissions: () => mis.permission === "error"
    ? { data: null, error: { message: "permission lookup failed" } }
    : { data: [{ target: "module:executive-mis-dashboard", can_view: mis.permission === "granted", can_edit: false }], error: null },
  mv_mis_executive_summary: () => ({ data: { mis_summary_id: 1, mv_refreshed_at: new Date().toISOString(), payables_sundry_creditors: -100, receivables_sundry_debtors: 200, net_sundry_position: 100, sales_value_month_to_date: 5000, manufacturing_inventory_value: 7000, fg_inventory_value_overall: 9000, active_pipeline_batch_count: 412, work_in_process_batch_count: 100, overdue_work_in_process_batch_count: 59, transferred_to_finished_goods_value: 123456, planning_period_status: "CURRENT_MONTH_PLAN_AVAILABLE" }, error: null }),
  v_mis_finance_tab_summary: () => ({ data: { finance_scope_note: "Finance scope note" }, error: null }),
  v_mis_sales_tab_summary: () => ({ data: { month_start: "2026-05-01", month_upto_date: "2026-05-31", sales_days_available_in_month: 30, products_sold_month_to_date: 410, skus_sold_month_to_date: 509, sales_scope_note: "Sales note" }, error: null }),
  v_mis_inventory_tab_summary: () => ({ data: { total_inventory_item_count: 1628, raw_material_item_count: 789, packing_material_item_count: 795, consumables_item_count: 38, fuel_item_count: 6, inventory_scope_note: "Inventory note" }, error: null }),
  v_mis_finished_goods_tab_summary: () => ({ data: { sku_count: 622, stock_value_overall: 100, zero_stock_sku_count: 54, below_1_month_cover_count: 104, above_6_month_cover_count: 101, finished_goods_scope_note: "FG note" }, error: null }),
  v_mis_production_tab_summary: () => ({ data: { report_month_start: "2026-05-01", report_month_end: "2026-05-31", planning_month_start: "2026-05-01", planning_period_status: "CURRENT_MONTH_PLAN_AVAILABLE", planned_production_base_qty: 929887.73, bulk_produced_base_qty: 500000, transferred_to_finished_goods_base_qty: 400000, bulk_production_achievement_pct: 53.77, fg_transfer_achievement_pct: 43.02, active_pipeline_batch_count: 412, overdue_work_in_process_batch_count: 59, work_in_process_batch_count: 100, transferred_to_finished_goods_value: 123456, production_scope_note: "Production scope note" }, error: null }),
  v_mis_finance_outstanding_detail: () => ({ data: [{ bill_date_text: "1-Apr-26", bill_ref: "B-1", outstanding_amount_tally_value: -50, outstanding_amount_abs_line_value: 50 }], error: null }),
  get_mis_finance_party_page: (a) => page(searchTotal(a, 60, 3), a, (i) => ({ party_name: (a.p_search ? "Match " : "Party ") + (i + 1), mis_group_name: a.p_group_filter === "receivables" ? "Sundry Debtors" : "Sundry Creditors", bill_count: 2, outstanding_amount_mis_value: 100, signed_outstanding_tally_value: -100 })),
  get_mis_sales_product_page: (a) => page(searchTotal(a, 60, 4), a, (i) => ({ product_name: (a.p_search ? "Sprod " : "Product ") + (i + 1), sku_count: 2, sales_value: 10, sales_units: 3, latest_day_sales_value: 1, average_daily_sales_value: 1 })),
  get_mis_inventory_item_page: (a) => page(searchTotal(a, 60, 5), a, (i) => ({ code: "C" + i, item_name: (a.p_search ? "Iitem " : "Item ") + (i + 1), source_label: a.p_source_kind, qty_value: 1, avg_rate_value: 1, stock_value: 1, category_label: "Cat", subcategory_label: "Sub" })),
  get_mis_finished_goods_sku_page: (a) => page(searchTotal(a, 60, 2), a, (i) => ({ item: (a.p_search ? "Fitem " : "SKU ") + (i + 1), pack_size: 100, uom: "ml", stock_overall: 1, forecast_overall: 1, mos_overall: 1, stock_value_overall: 1, mos_status: ["ZERO_STOCK", "BELOW_1_MONTH", "ONE_TO_THREE_MONTHS", "ABOVE_6_MONTHS", "NORMAL"][i % 5], classification: "Cls" })),
};
function respond(kind, name, args, chain) {
  mis.calls.push({ kind, name, args: args || null, chain: chain || null, at: Date.now() });
  const handler = mis.handlers[name] || fixtures[name];
  return Promise.resolve(handler ? handler(args || {}, chain || []) : { data: null, error: null });
}
function chain(table) {
  const steps = [];
  const proxy = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (res, rej) => respond("from", table, null, steps).then(res, rej);
      if (prop === "catch" || prop === "finally") return () => proxy;
      return (...a) => { steps.push([prop, ...a]); return proxy; };
    },
  });
  return proxy;
}
export function createClient() {
  const client = {
    auth: { getSession: async () => ({ data: { session }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from: (t) => chain(t),
    rpc: (name, args) => respond("rpc", name, args),
    schema: () => client,
  };
  return client;
}
`;

export function launchBrowser() {
  try {
    const require = createRequire(import.meta.url);
    return require("playwright").chromium;
  } catch {
    return null;
  }
}

export function startServer() {
  const pub = path.join(root, "public");
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = path.join(pub, url);
    if (!file.startsWith(pub) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end("not found"); return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

// Opens the dashboard with the mock installed. Resolves once the first Finance load has settled unless opts.noWait.
export async function openDashboard(browser, base, { width = 1280, height = 800, permission = "granted", init, noWait = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(base)) return route.continue();
    if (u.includes("esm.sh/@supabase/supabase-js")) return route.fulfill({ status: 200, contentType: "text/javascript", body: SUPABASE_STUB });
    return route.abort();
  });
  await page.addInitScript((p) => { window.__mis = { permission: p }; }, permission);
  if (init) await page.addInitScript(init);
  await page.goto(base + PAGE_PATH);
  if (!noWait && permission === "granted") await page.waitForSelector("#financePartyTableWrap .finance-table", { timeout: 8000 });
  return { context, page, consoleErrors };
}

export const calls = (page, name) => page.evaluate((n) => window.__mis.calls.filter((c) => !n || c.name === n).map((c) => ({ name: c.name, args: c.args, chain: c.chain })), name);
export const setHandler = (page, name, fn) => page.evaluate(([n, src]) => { window.__mis.handlers[n] = (0, eval)("(" + src + ")"); }, [name, fn.toString()]);
