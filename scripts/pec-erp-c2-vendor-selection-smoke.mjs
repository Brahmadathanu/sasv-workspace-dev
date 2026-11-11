#!/usr/bin/env node
/**
 * PEC-ERP-C2 regression: immediate vendor selection from the Indents modal.
 * Real shared module in Chromium; only js/supabaseClient.js is a synthetic
 * fixture stub that records RPC calls. NOT signed-in operational acceptance.
 *
 * Usage: node scripts/pec-erp-c2-vendor-selection-smoke.mjs [--shots <dir>]
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const si = process.argv.indexOf("--shots");
const shotsDir = si > 0 ? path.resolve(process.argv[si + 1]) : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

function stub(S) {
  return `
const S = ${JSON.stringify(S)};
const calls = (globalThis.__rpcCalls = []);
const sel = {}; // indent_line_id -> {vendor, rate}
const statuses = { 100: "draft", 101: "approved", 102: "issued", 103: "closed", 104: "cancelled" };
const headers = () => Object.entries(statuses).map(([id, status]) => ({ indent_id: +id, indent_number: "IND-26-" + id, status, approved_date: null, indent_date: "2026-11-10", material_class_id: 1, material_class_code: "RM", line_count: 2, source_pr_id: id == 101 ? 55 : null, total_remaining_qty: 5 }));
const lines = (indentId) => [1, 2].map((n) => { const id = indentId * 10 + n; const s = sel[id]; return {
  indent_line_id: id, indent_id: indentId, indent_line_sort_no: n, stock_item_id: n, stock_item_name: "Item " + n, material_class_code: "RM", uom_code: "KG",
  requested_qty: 10, allocated_qty: 0, remaining_qty: 10,
  recommended_vendor_id: n === 2 ? 7 : null, recommended_vendor_name: n === 2 ? "Rec Vendor" : null, recommended_rate: n === 2 ? 12 : null,
  selected_vendor_id: s ? s.vendor : null, selected_vendor_name: s ? s.name : null, selected_rate: s ? s.rate : null,
  resolved_vendor_name: s ? s.name : null, resolved_rate: s ? s.rate : null }; });
const vendors = [{ vendor_id: 5, display_name: "Active Vendor A" }, { vendor_id: 6, display_name: "Active Vendor B" }, { vendor_id: 7, display_name: "Rec Vendor" }];
const mk = (d) => ({ data: d, error: null });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const supabase = {
  auth: { getSession: async () => ({ data: { session: { user: { id: "fixture" } } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  rpc: async (name, params) => {
    calls.push({ name, params });
    if (name === "get_user_permissions") return mk([{ target: "module:procurement-execution-console", can_view: true, can_edit: S.role === "edit" }]);
    if (name === "proc_pec_indent_headers") return mk(headers());
    if (name === "proc_pec_indent_lines") return mk(lines(params.p_indent_id));
    if (name === "proc_vendor_lookup") { const q = (params.p_q || "").toLowerCase(); return mk(vendors.filter((v) => v.display_name.toLowerCase().includes(q))); }
    if (name === "proc_indent_set_vendor_selection") {
      if (S.slowSave) await sleep(600);
      if (S.saveError) return { data: null, error: { message: S.saveError } };
      const v = vendors.find((x) => x.vendor_id === params.p_selected_vendor_id);
      sel[params.p_indent_line_id] = { vendor: v.vendor_id, name: v.display_name, rate: params.p_selected_rate };
      return mk(null);
    }
    if (name === "proc_procurement_action_queue_paged") return mk([]); // snapshot not published: nothing
    return mk([]);
  },
  from: () => { const b = { select: () => b, eq: () => b, limit: () => b, order: () => b, in: () => b, ilike: () => b, then: (r) => r(mk([])) }; return b; },
  schema: () => ({ from: () => ({}) }),
};
export const labSupabase = supabase; export const hrSupabase = supabase; export const handleSupabaseError = (e) => e;
`;
}

const browser = await chromium.launch();
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.error("FAIL:", msg); } else console.log("ok  :", msg); };

async function open(S, vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/js/supabaseClient.js", (r) => r.fulfill({ contentType: "text/javascript", body: stub(S) }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.goto(`${base}/shared/procurement-execution-console.html`);
  await page.waitForSelector("#mainPanel:not([hidden])", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  if (vp.width <= 520) await page.selectOption("#procTabSelect", "indents"); else await page.click('.tabs .tab-btn[data-tab="indents"]');
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}
const openIndent = async (page, id) => {
  await page.click(`#iTbody tr:has-text("IND-26-${id}")`);
  await page.waitForSelector("#iLinesTbody tr", { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(300);
};
const calls = (page, name) => page.evaluate((n) => globalThis.__rpcCalls.filter((c) => c.name === n), name);
const toasts = (page) => page.$$eval("#toastContainer > div", (n) => n.map((e) => e.textContent));
const btnState = (page) => page.evaluate(() => { const b = document.getElementById("iBtnSelectVendor"); return { hidden: b.hidden || b.offsetParent === null, disabled: b.disabled }; });

// 1. Eligibility by status (edit role)
{
  const { ctx, page } = await open({ role: "edit" });
  for (const [id, expectVisible] of [[100, true], [101, true], [102, true], [103, false], [104, false]]) {
    await openIndent(page, id);
    const b = await btnState(page);
    check(expectVisible ? !b.hidden && !b.disabled : b.hidden, `status of IND-26-${id}: Select Vendor ${expectVisible ? "available" : "not exposed"}`);
    await page.click("#btnIndentViewClose");
    await page.waitForTimeout(150);
  }
  await ctx.close();
}

// 2. Read-only role: not exposed, no RPC reachable
{
  const { ctx, page } = await open({ role: "view" });
  await openIndent(page, 100);
  check((await btnState(page)).hidden, "read-only: Select Vendor not exposed");
  await page.evaluate(() => document.getElementById("iBtnSelectVendor").click());
  await page.waitForTimeout(200);
  check(!(await page.isVisible("#vendorModalBackdrop.show")), "read-only: forced click opens no modal");
  check((await calls(page, "proc_indent_set_vendor_selection")).length === 0, "read-only: no mutation RPC");
  await ctx.close();
}

// 3. Draft: immediate selection, no recommendation, search, required reason, save, refresh
{
  const { ctx, page } = await open({ role: "edit" });
  await openIndent(page, 100);
  await page.click("#iBtnSelectVendor");
  await page.waitForTimeout(200);
  check(!(await page.isVisible("#vendorModalBackdrop.show")), "no line selected: modal does not open");
  check((await toasts(page)).some((t) => /select a line first/i.test(t)), "no line selected: guidance shown");

  await page.click('#iLinesTbody tr:nth-child(1)');
  await page.click("#iBtnSelectVendor");
  await page.waitForSelector("#vendorModalBackdrop.show");
  const sugg = await page.$$eval("#vendorSuggestedList button", (n) => n.length);
  check(sugg === 0, "line without recommendation: no suggested vendors fabricated");
  check(await page.isVisible("#vendorSuggestedEmpty"), "line without recommendation: explanatory empty note");
  check((await page.textContent("#vendorModalItem")).includes("IND-26-100"), "modal shows parent indent context");
  check(((await calls(page, "proc_procurement_action_queue_paged")).length === 0), "no Action Queue / snapshot read needed before selecting");
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, "c2-wide-vendor-modal-draft.png") });

  await page.fill("#aqVendorSearchInput", "Active");
  await page.waitForSelector("#aqVendorSearchResults li:not(.no-results)", { timeout: 3000 });
  await page.click("#aqVendorSearchResults li:not(.no-results) >> nth=0");
  await page.fill("#vendorRate", "40");
  await page.click("#btnVendorSave");
  await page.waitForTimeout(200);
  check((await calls(page, "proc_indent_set_vendor_selection")).length === 0, "manual selection without reason: blocked client-side");
  check((await toasts(page)).some((t) => /reason is required/i.test(t)), "manual selection without reason: message shown");

  await page.fill("#vendorReason", "Urgent manual choice");
  await page.click("#btnVendorSave");
  await page.waitForTimeout(700);
  const sv = await calls(page, "proc_indent_set_vendor_selection");
  check(sv.length === 1 && sv[0].params.p_selected_rate === 40 && sv[0].params.p_reason === "Urgent manual choice" && sv[0].params.p_indent_line_id === 1001, "saved through existing RPC with line id, rate and reason");
  check(!(await page.isVisible("#vendorModalBackdrop.show")), "modal closed after success");
  check(await page.isVisible("#indentViewModalBackdrop.show"), "operator stays in indent modal");
  const rowText = await page.textContent("#iLinesTbody tr:nth-child(1)");
  check(rowText.includes("Active Vendor A"), "indent line refreshed immediately with selected vendor");
  check(await page.getAttribute("#iLinesTbody tr:nth-child(1)", "aria-selected") === "true", "selected line preserved after refresh");
  check((await calls(page, "proc_vendorwise_buylist_filtered")).length === 0, "Vendor-wise Buying List not queried / draft not placed in published list");
  const order = await page.$$eval("#iLinesTbody tr td:first-child", (n) => n.map((e) => e.textContent.trim()));
  check(order.join(",") === "1,2", `serial/insertion order preserved (${order.join(",")})`);
  check((await toasts(page)).some((t) => /rate|assigned/i.test(t)), "visible confirmation toast");
  await ctx.close();
}

// 4. Recommendation present, deviation requires reason; recommended pick with rate does not
{
  const { ctx, page } = await open({ role: "edit" });
  await openIndent(page, 101); // approved (PR-linked) also allowed
  await page.click('#iLinesTbody tr:nth-child(2)');
  await page.click("#iBtnSelectVendor");
  await page.waitForSelector("#vendorModalBackdrop.show");
  const labels = await page.$$eval("#vendorSuggestedList button", (n) => n.map((e) => e.textContent.trim()));
  check(labels.length === 1 && /Recommended: Rec Vendor/.test(labels[0]), `only the live-read recommendation is offered`);
  await page.click("#vendorSuggestedList button");
  await page.fill("#vendorRate", "12");
  await page.click("#btnVendorSave");
  await page.waitForTimeout(500);
  const sv = await calls(page, "proc_indent_set_vendor_selection");
  check(sv.length === 1 && sv[0].params.p_selected_vendor_id === 7 && sv[0].params.p_reason === null, "recommended vendor with rate: no reason demanded");
  await page.click('#iLinesTbody tr:nth-child(2)');
  await page.click("#iBtnSelectVendor");
  await page.waitForSelector("#vendorModalBackdrop.show");
  await page.fill("#aqVendorSearchInput", "Active");
  await page.waitForSelector("#aqVendorSearchResults li:not(.no-results)");
  await page.click("#aqVendorSearchResults li:not(.no-results) >> nth=0");
  await page.fill("#vendorRate", "9");
  await page.click("#btnVendorSave");
  await page.waitForTimeout(300);
  check((await calls(page, "proc_indent_set_vendor_selection")).length === 1, "deviation from recommendation without reason: blocked");
  // pending rate
  await page.fill("#vendorRate", "");
  await page.fill("#vendorReason", "");
  await page.click("#btnVendorSave");
  await page.waitForTimeout(300);
  check((await toasts(page)).some((t) => /rate is pending/i.test(t)), "pending rate without reason: blocked with rate-pending message");
  await page.fill("#vendorReason", "Rate to follow");
  await page.click("#btnVendorSave");
  await page.waitForTimeout(500);
  const sv2 = await calls(page, "proc_indent_set_vendor_selection");
  check(sv2.length === 2 && sv2[1].params.p_selected_rate === null, "pending rate with reason saved (rate null)");
  check((await toasts(page)).some((t) => /rate is pending/i.test(t)), "success toast reflects pending rate");
  await ctx.close();
}

// 5. Inactive vendor / save failure keep the modal open and allow retry
{
  const { ctx, page } = await open({ role: "edit", saveError: "selected vendor is inactive" });
  await openIndent(page, 100);
  await page.click('#iLinesTbody tr:nth-child(1)');
  await page.click("#iBtnSelectVendor");
  await page.waitForSelector("#vendorModalBackdrop.show");
  await page.fill("#aqVendorSearchInput", "Active");
  await page.waitForSelector("#aqVendorSearchResults li:not(.no-results)");
  await page.click("#aqVendorSearchResults li:not(.no-results) >> nth=0");
  await page.fill("#vendorRate", "5");
  await page.fill("#vendorReason", "test");
  await page.click("#btnVendorSave");
  await page.waitForTimeout(500);
  check((await toasts(page)).some((t) => /inactive/i.test(t)), "inactive vendor rejected by server: clear message");
  check(await page.isVisible("#vendorModalBackdrop.show"), "save failure: modal stays open for correction");
  check(!(await page.$eval("#btnVendorSave", (b) => b.disabled)), "save failure: Save re-enabled");
  const none = await page.$$eval("#iLinesTbody tr:nth-child(1) td", (n) => n.map((e) => e.textContent).join("|"));
  check(!none.includes("Active Vendor A"), "save failure: line unchanged");
  const lookups = await calls(page, "proc_vendor_lookup");
  check(lookups.length > 0 && lookups.every((c) => c.params.p_active_only === true), "vendor search always requests active vendors only");
  await ctx.close();
}

// 6. Duplicate submission
{
  const { ctx, page } = await open({ role: "edit", slowSave: true });
  await openIndent(page, 100);
  await page.click('#iLinesTbody tr:nth-child(1)');
  await page.click("#iBtnSelectVendor");
  await page.waitForSelector("#vendorModalBackdrop.show");
  await page.fill("#aqVendorSearchInput", "Active");
  await page.waitForSelector("#aqVendorSearchResults li:not(.no-results)");
  await page.click("#aqVendorSearchResults li:not(.no-results) >> nth=0");
  await page.fill("#vendorRate", "5");
  await page.fill("#vendorReason", "dup test");
  await page.evaluate(() => { const b = document.getElementById("btnVendorSave"); b.click(); b.click(); b.click(); });
  await page.keyboard.press("Escape");
  await page.click("#btnVendorClose", { force: true }).catch(() => {});
  await page.waitForTimeout(900);
  check((await calls(page, "proc_indent_set_vendor_selection")).length === 1, "triple click while saving: exactly one RPC");
  await ctx.close();
}

// 7. Mobile layout + labels
{
  const { ctx, page } = await open({ role: "edit" }, { width: 390, height: 800 });
  await openIndent(page, 100);
  await page.click('#iLinesTbody tr:nth-child(1)');
  const r = await page.evaluate(() => { const b = document.getElementById("iBtnSelectVendor"); const l = b.querySelector(".pec-action-label"); const box = b.getBoundingClientRect(); return { name: b.getAttribute("aria-label"), labelShown: l && getComputedStyle(l).display !== "none", w: box.width, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  check(r.name === "Select Vendor" && !r.labelShown && r.w <= 40, `mobile: icon-only with accessible name (w=${r.w})`);
  await page.click("#iBtnSelectVendor");
  await page.waitForSelector("#vendorModalBackdrop.show");
  const o = await page.evaluate(() => ({ h: document.documentElement.scrollWidth - document.documentElement.clientWidth, m: document.querySelector("#vendorModalBackdrop .modal").getBoundingClientRect().width }));
  check(o.h <= 1 && o.m <= 390, `mobile: vendor modal fits viewport (modal ${Math.round(o.m)}px, overflow ${o.h}px)`);
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, "c2-mobile-vendor-modal.png") });
  await ctx.close();
}
// 8. Wide label
{
  const { ctx, page } = await open({ role: "edit" });
  await openIndent(page, 100);
  const shown = await page.evaluate(() => { const l = document.querySelector("#iBtnSelectVendor .pec-action-label"); return l && getComputedStyle(l).display !== "none" && l.textContent; });
  check(shown === "Select Vendor", "wide: icon + 'Select Vendor' label");
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, "c2-wide-indent-modal.png") });
  await ctx.close();
}

await browser.close();
server.close();
if (failures) { console.error(`pec-erp-c2-vendor-selection-smoke: ${failures} FAILED`); process.exit(1); }
console.log("pec-erp-c2-vendor-selection-smoke: PASS");
