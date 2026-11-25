#!/usr/bin/env node
/**
 * PEC-PA-02 acceptance: the Purchase Allocations lens in a REAL browser against the REAL console,
 * with the frozen V1 RPC contract answered by a page-side fixture mock (synthetic data only; see
 * scripts/lib/pec-ui-harness.mjs). This verifies client behaviour against the CONTRACT SHAPES. It is
 * NOT proof that the server endpoints exist or return these values, and not signed-in acceptance.
 *
 * Usage: node scripts/pec-purchase-allocations-ui-smoke.mjs [--shots <dir>]
 */
import fs from "node:fs";
import path from "node:path";
import { startHarness } from "./lib/pec-ui-harness.mjs";
import * as fx from "./fixtures/pec-purchase-allocations-view-model.mjs";

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.error("FAIL:", msg); } else console.log("ok  :", msg); };
const shotsIdx = process.argv.indexOf("--shots");
const shotsDir = shotsIdx > 0 ? path.resolve(process.argv[shotsIdx + 1]) : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const FIXED = "2026-11-24T05:00:00Z"; // 24 Nov 10:30 IST -> Yesterday = 2026-11-23
const VP = { name: "desktop", width: 1440, height: 900 };
const NARROW = { name: "narrow", width: 390, height: 800 };
const TABLET = { name: "tablet", width: 820, height: 1100 };

// ── contract fixtures (raw V1 snake_case) ────────────────────────────────────────────
const retarget = (r) => (r.indent_id === 840 ? { ...r, indent_id: 101 } : r); // 101 exists in the console's stub indent list
const INDENTS = fx.INDENT_ROWS_RAW.map(retarget);
const TRAIL = [...fx.NOV23_TRAIL_RAW, ...fx.REPEATED_LINE_RAW, ...fx.RETURNED_AND_UNALLOCATED_RAW, ...fx.FILTERED_RECEIPT_RAW].map(retarget);
const mat = (o) => ({ material_class_id: 1, material_class_code: "RM", uom_id: 1, uom_code: "Kg", purchase_fact_count: 1, gross_qty: "0", effective_qty: "0",
  allocated_qty: "0", matching_allocated_qty: "0", unallocated_qty: "0", accepted_qty: "0", net_unallocated_qty: "0", ...o });
const MATERIALS = [
  mat({ stock_item_id: 9001, stock_item_name: "Sathavari Kizhangu (D)", gross_qty: "135", effective_qty: "135", allocated_qty: "135", matching_allocated_qty: "135" }),
  mat({ stock_item_id: 9100, stock_item_name: "Synthetic Herb", gross_qty: "100", effective_qty: "80", allocated_qty: "60", matching_allocated_qty: "60", unallocated_qty: "20", net_unallocated_qty: "20", purchase_fact_count: 2 }),
  mat({ stock_item_id: 9200, stock_item_name: "Synthetic Resin", gross_qty: "52.5", effective_qty: "12.5", unallocated_qty: "12.5", accepted_qty: "12.5", net_unallocated_qty: "0", purchase_fact_count: 2 }),
  mat({ stock_item_id: 9201, stock_item_name: "Synthetic Returned Gum", gross_qty: "40", effective_qty: "0" }),
  mat({ stock_item_id: 9300, stock_item_name: "Synthetic Oil", uom_id: 2, uom_code: "L", gross_qty: "35", effective_qty: "35", allocated_qty: "35", matching_allocated_qty: "35" }),
];
const MANY = Array.from({ length: 75 }, (_, i) => mat({ stock_item_id: 5000 + i, stock_item_name: `Bulk Item ${String(i + 1).padStart(3, "0")}`, gross_qty: String(i + 1), effective_qty: String(i + 1), unallocated_qty: String(i + 1) }));
const VENDORS = [
  { vendor_key: "v:1", vendor_id: 1, supplier_name: "Kera Traders", material_count: 1, purchase_fact_count: 1,
    totals_by_uom: [{ uom_id: 1, uom_code: "Kg", gross_qty: "135", effective_qty: "135", allocated_qty: "135", matching_allocated_qty: "135", unallocated_qty: "0", accepted_qty: "0", net_unallocated_qty: "0" }] },
  { vendor_key: "name:cash a", vendor_id: null, supplier_name: "Cash Purchase", material_count: 1, purchase_fact_count: 1,
    totals_by_uom: [{ uom_id: 1, uom_code: "Kg", gross_qty: "40", effective_qty: "0", allocated_qty: "0", matching_allocated_qty: "0", unallocated_qty: "0", accepted_qty: "0", net_unallocated_qty: "0" }] },
  { vendor_key: "name:cash b", vendor_id: null, supplier_name: "Cash Purchase", material_count: 1, purchase_fact_count: 1,
    totals_by_uom: [{ uom_id: 1, uom_code: "Kg", gross_qty: "12.5", effective_qty: "12.5", allocated_qty: "0", matching_allocated_qty: "0", unallocated_qty: "12.5", accepted_qty: "12.5", net_unallocated_qty: "0" }] },
];
const TODAY_INDENTS = [{ indent_id: 999, indent_number: 999, approved_date: "2026-11-24", material_line_count: 1, totals_by_uom: [{ uom_id: 1, uom_code: "Kg", allocated_qty: "1" }] }];

// ── page-side mock of the five V1 RPCs ───────────────────────────────────────────────
function mockInit({ data, opts }) {
  globalThis.__paCalls = [];
  globalThis.__paData = data;
  globalThis.__paOpts = opts || {};
  const fail = { ...(opts?.failFirst || {}) };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const page = (rows, p) => rows.slice(p.p_offset || 0, (p.p_offset || 0) + (p.p_limit || 50)).map((r) => ({ row_data: r, total_count: rows.length }));
  globalThis.__paRpc = async (name, p) => {
    if (!name.startsWith("proc_pec_purchase_alloc_")) return undefined;
    globalThis.__paCalls.push({ name, p: JSON.parse(JSON.stringify(p)) });
    const D = globalThis.__paData; const O = globalThis.__paOpts;
    for (const d of O.delays || []) if (p.p_date_from === d.date && name.includes(d.name)) await sleep(d.ms);
    if (fail[name] > 0) { fail[name] -= 1; return { data: null, error: { message: "permission denied for fixture" } }; }
    const day = (D.byDate && D.byDate[p.p_date_from]) || D;
    const q = (s) => String(s ?? "").toLowerCase();
    if (name.endsWith("_summary")) return { data: day.summary || D.summary, error: null };
    if (name.endsWith("_indent_paged")) {
      let rows = day.indent || D.indent;
      if (p.p_indent_q) rows = rows.filter((r) => String(r.indent_number).includes(p.p_indent_q));
      return { data: page(rows, p), error: null };
    }
    if (name.endsWith("_material_paged")) {
      let rows = day.material || D.material;
      if (p.p_q) rows = rows.filter((r) => q(r.stock_item_name).includes(q(p.p_q)));
      return { data: page(rows, p), error: null };
    }
    if (name.endsWith("_vendor_paged")) {
      let rows = D.vendor;
      if (p.p_vendor_q) rows = rows.filter((r) => q(r.supplier_name).includes(q(p.p_vendor_q)));
      return { data: page(rows, p), error: null };
    }
    let rows = D.trail;
    if (p.p_indent_id) rows = rows.filter((r) => r.indent_id === p.p_indent_id);
    if (p.p_indent_q) rows = rows.filter((r) => r.indent_number !== null && String(r.indent_number).includes(p.p_indent_q));
    if (p.p_stock_item_id) rows = rows.filter((r) => r.stock_item_id === p.p_stock_item_id);
    if (p.p_uom_id) rows = rows.filter((r) => r.uom_id === p.p_uom_id);
    if (p.p_vendor_key) rows = rows.filter((r) => r.vendor_key === p.p_vendor_key);
    const out = page(rows, p);
    if (O.driftTrail) { O.driftTrail.n = (O.driftTrail.n || 0) + 1; if (O.driftTrail.n > 1) out.forEach((r) => { r.total_count += 1; }); } // total changes between pages
    return { data: out, error: null };
  };
}

const baseData = (extra = {}) => ({
  summary: fx.SUMMARY_RAW, indent: INDENTS, material: MATERIALS, vendor: VENDORS, trail: TRAIL,
  byDate: { "2026-11-24": { indent: TODAY_INDENTS, summary: { ...fx.SUMMARY_RAW, date_from: "2026-11-24", date_to: "2026-11-24", affected_indent_count: 1 } } }, ...extra,
});

const h = await startHarness();
async function openLens(vp, { role = "edit", data = baseData(), opts = {} } = {}) {
  const r = await h.open({ role, indentDate: true }, vp, { dsf: shotsDir ? 2 : 1, fixedTime: FIXED, init: { fn: mockInit, arg: { data, opts } } });
  if (vp.width <= 520) await r.page.selectOption("#procTabSelect", "purchase-allocations");
  else await r.page.click('.tabs .tab-btn[data-tab="purchase-allocations"]');
  await r.page.waitForSelector("#tab-purchase-allocations.active");
  return r;
}
const calls = (page, suffix) => page.evaluate((s) => globalThis.__paCalls.filter((c) => c.name.endsWith(s)), suffix);
const shot = async (page, name) => { if (shotsDir) { await page.waitForTimeout(250); await page.screenshot({ path: path.join(shotsDir, `${name}.png`) }); } };
// Filter panel helpers: the panel is draft-and-apply; nothing changes until "Apply filters".
const openFilters = async (page, via = "#paFilterBtn") => { await page.click(via); await page.waitForSelector("#paFilterDrawer.open"); };
const applyFilters = async (page) => { await page.click("#paFilterDrawer .pec-filter-done-btn"); await page.waitForFunction(() => !document.querySelector("#paFilterDrawer.open")); };
const setFilters = async (page, fn) => { await openFilters(page); await fn(page); await applyFilters(page); };
const openSummary = async (page) => { if ((await page.getAttribute("#paSummaryToggle", "aria-expanded")) !== "true") await page.click("#paSummaryToggle"); };
const shown = (page) => page.evaluate(() => [...document.querySelectorAll(".modal-backdrop.show")].map((e) => e.id));

// ── 1. navigation, defaults, request contract ────────────────────────────────────────
{
  const { ctx, page, errors } = await openLens(VP);
  const tabs = await page.$$eval(".tabs .tab-btn", (n) => n.map((b) => b.dataset.tab));
  check(tabs.indexOf("purchase-allocations") === tabs.indexOf("excess") - 1, `Purchase Allocations sits immediately before Excess Purchases (${tabs.join(",")})`);
  check(await page.getAttribute('[data-pa-mode="indent"]', "aria-pressed") === "true", "Indent-wise is the default mode");
  check((await page.innerText("#paPeriodText")) === "Yesterday · 23 Nov 2026", `Yesterday is the default voucher period (${await page.innerText("#paPeriodText")})`);
  await openFilters(page);
  check(await page.getAttribute('[data-pa-preset="yesterday"]', "aria-pressed") === "true", "Yesterday is the default preset in the filter panel");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".pa-indent-card");
  const [first] = await calls(page, "_indent_paged");
  check(first.p.p_date_from === "2026-11-23" && first.p.p_date_to === "2026-11-23", `Yesterday resolves in Asia/Kolkata (${first.p.p_date_from})`);
  check(first.p.p_status === "all" && first.p.p_limit === 30 && first.p.p_offset === 0 && first.p.p_material_class_code === null, "common V1 arguments and defaults are sent");
  const sum = (await calls(page, "_summary"))[0];
  check(sum && !("p_limit" in sum.p) && !("p_offset" in sum.p), "summary RPC takes no paging parameters");
  check(await page.isHidden("#paSummary") && (await page.getAttribute("#paSummaryToggle", "aria-expanded")) === "false", "Allocation Summary is collapsed by default");
  await openSummary(page);
  await shot(page, "desktop-summary-expanded");
  const summaryText = await page.innerText("#paSummary");
  check(/39 receipts/.test(summaryText) && /9 indents/.test(summaryText) && /38 indent lines/.test(summaryText), `summary counts (${summaryText.slice(0, 60).replace(/\s+/g, " ")})`);
  check(/9,369\.455/.test(summaryText) && /8,914\.463741/.test(summaryText) && /454\.991259/.test(summaryText), "Kg totals keep 6-decimal precision");
  check(["Purchased", "Effective", "Allocated", "Unallocated", "Accepted excess", "Net unallocated"].every((l) => summaryText.includes(l)), "expanded summary exposes every figure");
  check(/41,066/.test(summaryText) && /\bL\b/.test(summaryText) && /Nos/.test(summaryText), "L and Nos totals shown separately");
  check(/reconstructed/i.test(summaryText) && /never totalled across units/i.test(summaryText), "balance basis and no-mixing notes are shown");
  const titles = await page.$$eval(".pa-indent-title", (n) => n.map((e) => e.textContent.trim()));
  check(titles.join("|") === "Indent 156|Indent 84|Indent 191", `indent order is the server's order, not re-sorted (${titles.join("|")})`);
  check(errors.length === 0, `no browser errors ${errors.join("|")}`);
  await shot(page, "desktop-indent-wise");
  await ctx.close();
}

// ── 2. indent expand: canonical serials, repeated balances, per-UOM, open indent ─────
{
  const { ctx, page } = await openLens(VP);
  await page.waitForSelector(".pa-indent-card");
  await page.click('.pa-indent-card[data-indent-id="1910"] .pa-indent-toggle');
  await page.waitForSelector('.pa-indent-card[data-indent-id="1910"] .pa-lines-table');
  const [t] = (await calls(page, "_trail_paged")).slice(-1);
  check(t.p.p_indent_id === 1910 && t.p.p_limit === 200, "expanding an indent requests its trail with p_indent_id");
  const row = await page.$$eval('.pa-indent-card[data-indent-id="1910"] .pa-lines-table tbody tr', (n) => n.map((r) => [...r.children].map((c) => c.textContent.trim())));
  check(row.length === 1 && row[0][0] === "198" && row[0][1].startsWith("Sathavari") && row[0][5] === "80" && row[0][6] === "20", `line shows serial 198, allocated 80, closing 20 (${row[0]?.join("|")})`);
  check(await page.getAttribute('.pa-indent-card[data-indent-id="1910"] .pa-indent-toggle', "aria-expanded") === "true", "toggle exposes aria-expanded");
  check((await page.innerText('.pa-indent-card[data-indent-id="1910"]')).includes("reconstructed"), "opening/closing labelled reconstructed");
  await page.click('.pa-indent-card[data-indent-id="1910"] .pa-indent-toggle');
  check(await page.isHidden('.pa-indent-card[data-indent-id="1910"] .pa-indent-lines'), "second click collapses");
  await ctx.close();
}
{
  // repeated period balances across two receipts collapse to ONE indent line
  const data = baseData({ indent: [{ indent_id: 500, indent_number: 500, approved_date: "2026-11-23", material_line_count: 1, totals_by_uom: [{ uom_id: 1, uom_code: "Kg", allocated_qty: "50" }] }] });
  const { ctx, page } = await openLens(VP, { data });
  await page.click('.pa-indent-card[data-indent-id="500"] .pa-indent-toggle');
  await page.waitForSelector('.pa-indent-card[data-indent-id="500"] .pa-lines-table');
  const n = await page.$$eval('.pa-indent-card[data-indent-id="500"] .pa-lines-table tbody tr', (r) => r.length);
  const alloc = await page.$eval('.pa-indent-card[data-indent-id="500"] .pa-lines-table tbody tr td:nth-child(6)', (e) => e.textContent.trim());
  check(n === 1 && alloc === "50", `two receipts for one line render one line with period allocation 50, not 100 (${n} row, ${alloc})`);
  await ctx.close();
}

// ── 3. material mode ────────────────────────────────────────────────────────────────
{
  const { ctx, page } = await openLens(VP);
  await page.click('[data-pa-mode="material"]');
  await page.waitForSelector("#paMaterialTbody tr.clickable-row");
  const rows = await page.$$eval("#paMaterialTbody tr", (n) => n.map((r) => [...r.children].map((c) => c.textContent.replace(/\s+/g, " ").trim())));
  const byName = Object.fromEntries(rows.map((r) => [r[0].replace(/\s*(RM|PM|IND)$/, ""), r]));
  check(rows.length === 5, `all five materials listed, incl. fully unallocated and returned (${rows.length})`);
  check(byName["Sathavari Kizhangu (D)"][3] === "—" && byName["Synthetic Herb"][3] === "80", "effective shown only where it differs from purchased");
  check(/Partly allocated/.test(byName["Synthetic Herb"][7]) && /Fully allocated/.test(byName["Sathavari Kizhangu (D)"][7]), "status badges: partly / fully allocated");
  check(/Returned \(nil effective\)/.test(byName["Synthetic Returned Gum"][7]) && !/Unallocated/.test(byName["Synthetic Returned Gum"][7]), "zero-effective returned material is not 'Unallocated'");
  check(byName["Synthetic Resin"][6] === "12.5", "accepted excess shown");
  check(await page.isHidden("#tab-purchase-allocations th.pa-col-match"), "matching-indent column hidden without an indent filter");
  check(!(await page.innerText("#paMaterialTbody")).includes("NaN"), "no NaN in quantities");
  await shot(page, "desktop-material-wise");
  // search -> p_q
  await page.fill("#paSearch", "resin");
  await page.waitForFunction(() => document.querySelectorAll("#paMaterialTbody tr.clickable-row").length === 1);
  const c = (await calls(page, "_material_paged")).slice(-1)[0];
  check(c.p.p_q === "resin", "search is sent as p_q");
  // indent filter -> p_indent_q; matching column appears
  await page.fill("#paSearch", "");
  await setFilters(page, (p) => p.fill("#paFIndent", "84"));
  await page.waitForFunction(() => !document.querySelector("#tab-purchase-allocations th.pa-col-match").hidden);
  const ic = (await calls(page, "_material_paged")).slice(-1)[0];
  check(ic.p.p_indent_q === "84", "indent filter is sent as p_indent_q");
  await openSummary(page);
  const s2 = await page.innerText("#paSummary");
  check(/Allocated \(any indent\)/.test(s2) && /Allocated to filtered indent/.test(s2) && /not excess/.test(s2), "filtered summary distinguishes receipt-wide vs matching allocation and says other-indent allocation is not excess");
  check(await page.innerText("#paFilterBadge") === "1", "filter badge counts active filters");
  await ctx.close();
}

// ── 4. drill-down: receipts, returned, unallocated, filtered note, open indent + return path ──
{
  const { ctx, page } = await openLens(VP);
  await page.click('[data-pa-mode="material"]');
  await page.waitForSelector("#paMaterialTbody tr.clickable-row");
  await page.click('#paMaterialTbody tr:has-text("Sathavari")');
  await page.waitForSelector("#paDrillModalBackdrop.show .pa-receipt");
  const tc = (await calls(page, "_trail_paged")).slice(-1)[0];
  check(tc.p.p_stock_item_id === 9001 && tc.p.p_uom_id === 1, "material drill requests the trail by stock item and UOM");
  const text = await page.innerText("#paDrillBody");
  check(/Kera Traders/.test(text) && /Purchase fact 169565/.test(text) && /2026-11-23/.test(text), "receipt shows supplier, voucher date and the technical purchase-fact id");
  check(/Purchased 135 Kg/.test(text) && /Allocated 135 Kg/.test(text) && /Unallocated 0 Kg/.test(text), "receipt quantities shown once (not tripled)");
  const rowsTxt = await page.$$eval("#paDrillBody .pa-lines-table tbody tr", (n) => n.map((r) => [...r.children].slice(0, 5).map((c) => c.textContent.trim().replace(/\s+/g, " ")).join("|")));
  check(rowsTxt.map((r) => r.split("|").slice(0, 3).join("|")).join(";") === "84|107|5 Kg;156|170|50 Kg;191|198|80 Kg",
    `allocations in canonical indent/serial order (${rowsTxt.join(" ; ")})`);
  await shot(page, "desktop-drill-material");
  // return path
  await page.click('#paDrillBody [data-open-indent="101"]');
  await page.waitForSelector("#indentViewModalBackdrop.show", { timeout: 5000 });
  check(!(await shown(page)).includes("paDrillModalBackdrop"), "drill closes while the indent is open");
  const before = (await calls(page, "_summary")).length;
  await page.keyboard.press("Escape");
  await page.waitForSelector("#tab-purchase-allocations.active");
  await page.waitForSelector("#paDrillModalBackdrop.show .pa-receipt");
  check((await page.getAttribute('[data-pa-mode="material"]', "aria-pressed")) === "true", "returns to the lens with the same mode");
  const afterCalls = await calls(page, "_summary");
  check(afterCalls.length === before, `returning does not reload the summary (state preserved) (${before} -> ${afterCalls.length}: ${afterCalls.map((c) => c.p.p_date_from).join(",")})`);
  await page.keyboard.press("Escape");
  check((await shown(page)).length === 0, "Escape closes the drill-down (modal stack)");
  await ctx.close();
}
{
  // returned / unallocated receipt messaging, and filtered receipt reconciliation note
  const { ctx, page } = await openLens(VP);
  await page.click('[data-pa-mode="material"]');
  await page.waitForSelector("#paMaterialTbody tr.clickable-row");
  await page.click('#paMaterialTbody tr:has-text("Synthetic Resin")');
  await page.waitForSelector("#paDrillModalBackdrop.show .pa-receipt");
  const t = await page.innerText("#paDrillBody");
  check(/Returned: nil effective quantity/.test(t) && /Not allocated to any indent/.test(t), "returned receipt and positive unallocated receipt are explained differently");
  check(/Returned \(nil effective\)/.test(t) && /Unallocated/.test(t), "both status badges present");
  await page.keyboard.press("Escape");
  await setFilters(page, (p) => p.fill("#paFIndent", "300"));
  await ctx.close();
}
{
  const data = baseData({ material: [mat({ stock_item_id: 9300, stock_item_name: "Synthetic Root", gross_qty: "100", effective_qty: "100", allocated_qty: "100", matching_allocated_qty: "60" })] });
  const { ctx, page } = await openLens(VP, { data });
  await page.click('[data-pa-mode="material"]');
  await setFilters(page, (p) => p.fill("#paFIndent", "300"));
  await page.waitForSelector("#paMaterialTbody tr.clickable-row");
  await page.waitForFunction(() => !document.querySelector("#tab-purchase-allocations th.pa-col-match").hidden);
  await page.click("#paMaterialTbody tr.clickable-row");
  await page.waitForSelector("#paDrillModalBackdrop.show .pa-receipt");
  const t = await page.innerText("#paDrillBody");
  check(/Allocated 100 Kg/.test(t) && /Unallocated 0 Kg/.test(t) && /40 Kg of this receipt is allocated to other indents \(not excess\)/.test(t),
    "filtered receipt: 60 shown, 40 allocated to other indents, labelled not excess, unallocated stays 0");
  await ctx.close();
}

// ── 5. vendor mode ──────────────────────────────────────────────────────────────────
{
  const { ctx, page } = await openLens(VP);
  await page.click('[data-pa-mode="vendor"]');
  await page.waitForSelector("#paVendorTbody tr.clickable-row");
  const names = await page.$$eval("#paVendorTbody tr", (n) => n.map((r) => r.children[0].textContent.replace(/\s+/g, " ").trim()));
  check(names.filter((x) => x.startsWith("Cash Purchase")).length === 2, `two different unmapped suppliers stay separate rows (${names.join(" | ")})`);
  check(names.filter((x) => /Unmapped supplier/.test(x)).length === 2, "unmapped suppliers are labelled");
  await shot(page, "desktop-vendor-wise");
  await page.click('#paVendorTbody tr:has-text("Cash Purchase") >> nth=1');
  await page.waitForSelector("#paDrillModalBackdrop.show .pa-receipt");
  const tc = (await calls(page, "_trail_paged")).slice(-1)[0];
  check(tc.p.p_vendor_key === "name:cash b", `vendor drill uses vendor_key, not the name (${tc.p.p_vendor_key})`);
  check(/Synthetic Resin/.test(await page.innerText("#paDrillBody")), "vendor drill groups by material");
  await ctx.close();
}

// ── 6. latest-response-wins, errors, empty, invalid range, paging ────────────────────
{
  const { ctx, page } = await openLens(VP, { opts: { delays: [{ date: "2026-11-24", name: "indent_paged", ms: 900 }] } });
  await page.waitForSelector(".pa-indent-card");
  await setFilters(page, (p) => p.click('[data-pa-preset="today"]'));
  await setFilters(page, (p) => p.click('[data-pa-preset="yesterday"]'));
  await page.waitForTimeout(1300);
  const titles = await page.$$eval(".pa-indent-title", (n) => n.map((e) => e.textContent.trim()));
  check(titles.join("|") === "Indent 156|Indent 84|Indent 191", `slow stale response for Today never overwrites Yesterday (${titles.join("|")})`);
  await ctx.close();
}
{
  const { ctx, page } = await openLens(VP, { opts: { failFirst: { proc_pec_purchase_alloc_indent_paged: 1 } } });
  await page.waitForSelector(".pa-state.is-error");
  check(/Could not load purchase allocations/.test(await page.innerText("#paIndentList")), "API error shows an error state, not an empty list");
  await page.click("#paIndentList [data-pa-retry]");
  await page.waitForSelector(".pa-indent-card");
  check(true, "Retry recovers");
  await ctx.close();
}
{
  const { ctx, page } = await openLens(VP, { data: baseData({ indent: [], summary: { ...fx.SUMMARY_RAW, purchase_fact_count: 0, affected_indent_count: 0, affected_indent_line_count: 0, totals_by_uom: [] } }) });
  await page.waitForSelector(".pa-state");
  check(/No allocations in the selected period/.test(await page.innerText("#paIndentList")), "empty result has a meaningful empty state");
  await openSummary(page);
  check(/0 receipts/.test(await page.innerText("#paSummary")), "zero summary renders");
  await ctx.close();
}
{
  const { ctx, page } = await openLens(VP);
  await page.waitForSelector(".pa-indent-card");
  const n0 = (await calls(page, "_indent_paged")).length;
  await openFilters(page);
  await page.click('[data-pa-preset="custom"]');
  await page.fill("#paDateFrom", "2026-11-24"); await page.fill("#paDateTo", "2026-11-01");
  check(/must not be after/.test(await page.innerText("#paDateError")), "reversed custom range shows a validation message in the panel");
  await page.click("#paFilterDrawer .pec-filter-done-btn");
  check(await page.isVisible("#paFilterDrawer.open"), "Apply is refused for an invalid range (panel stays open)");
  await page.waitForTimeout(300);
  check((await calls(page, "_indent_paged")).length === n0, "no RPC is sent for an invalid range");
  check((await page.innerText("#paPeriodText")) === "Yesterday · 23 Nov 2026", "applied period indicator is unchanged by an invalid draft");
  await page.fill("#paDateTo", "2026-11-23");
  await page.fill("#paDateFrom", "2026-11-22");
  await applyFilters(page);
  await page.waitForSelector(".pa-indent-card");
  const last = (await calls(page, "_indent_paged")).slice(-1)[0];
  check(last.p.p_date_from === "2026-11-22" && last.p.p_date_to === "2026-11-23", `valid range resumes requests (${last.p.p_date_from}..${last.p.p_date_to})`);
  check((await page.innerText("#paPeriodText")) === "22–23 Nov 2026", `indicator shows the applied range (${await page.innerText("#paPeriodText")})`);
  await ctx.close();
}
{
  const { ctx, page } = await openLens(VP, { data: baseData({ material: MANY }) });
  await page.click('[data-pa-mode="material"]');
  await page.waitForSelector("#paMaterialTbody tr.clickable-row");
  check((await page.$$eval("#paMaterialTbody tr.clickable-row", (n) => n.length)) === 30, "first page is 30 rows (server-side paging)");
  await page.evaluate(() => { const s = document.getElementById("paScrollMaterial"); s.scrollTop = s.scrollHeight; });
  await page.waitForFunction(() => document.querySelectorAll("#paMaterialTbody tr.clickable-row").length >= 60, null, { timeout: 5000 });
  await page.evaluate(() => { const s = document.getElementById("paScrollMaterial"); s.scrollTop = s.scrollHeight; });
  await page.waitForFunction(() => document.querySelectorAll("#paMaterialTbody tr.clickable-row").length === 75, null, { timeout: 5000 });
  const names = await page.$$eval("#paMaterialTbody tr.clickable-row td:first-child", (n) => n.map((e) => e.textContent.trim().replace(/\s*RM$/, "")));
  check(new Set(names).size === 75, "infinite scroll loads all 75 rows with no duplicates");
  const offs = (await calls(page, "_material_paged")).map((c) => c.p.p_offset);
  check(offs.join(",") === "0,30,60", `pages requested at offsets 0,30,60 (${offs})`);
  check(!/\d+\s*\/\s*\d+/.test(await page.innerText("#paMeta")), "no redundant n/N counter");
  await ctx.close();
}

// ── 7. exports ──────────────────────────────────────────────────────────────────────
{
  const { ctx, page } = await openLens(VP, { data: baseData({ material: MANY }) });
  await page.click('[data-pa-mode="material"]');
  await page.waitForSelector("#paMaterialTbody tr.clickable-row");
  await page.click("#btnPaExportMenu");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#btnPaExportCsv")]);
  const csv = fs.readFileSync(await dl.path(), "utf8");
  const dataRows = csv.split("\r\n").filter((l) => l.startsWith("Bulk Item"));
  check(dataRows.length === 75, `CSV contains the complete filtered dataset, not just loaded pages (${dataRows.length}/75)`);
  check(csv.startsWith("﻿") && /Voucher date range,2026-11-23/.test(csv) && /Generated,2026-11-24 10:30 IST/.test(csv), "CSV carries BOM, voucher range and generation time");
  check(/voucher-period allocations/i.test(csv) && /reconstructed/i.test(csv) && /never totalled across/i.test(csv), "CSV carries the period-vs-current, reconstructed and no-mixing notices");
  check(/Purchased \(gross\) \(per unit of measure\)\r\nKg,2850\r\n/.test(csv), "CSV totals are per UOM");
  check(/purchase-allocations_material_2026-11-23_2026-11-23_/.test(dl.suggestedFilename()), `filename (${dl.suggestedFilename()})`);
  const mats = (await calls(page, "_material_paged")).map((c) => `${c.p.p_limit}@${c.p.p_offset}`);
  check(mats.includes("200@0"), `export pages at the 200 limit (${mats.join(",")})`);
  await ctx.close();
}
{
  // indent-wise CSV: canonical order, de-duplicated lines, reconstructed labels; print statement
  const { ctx, page } = await openLens(VP);
  await page.waitForSelector(".pa-indent-card");
  await page.click("#btnPaExportMenu");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#btnPaExportCsv")]);
  const csv = fs.readFileSync(await dl.path(), "utf8");
  const lines = csv.split("\r\n").filter((l) => /^(84|156|191|300|500),/.test(l));
  check(lines.map((l) => l.split(",")[0]).join(",") === "84,156,191,300,500", `indent CSV in canonical indent order (${lines.map((l) => l.split(",")[0]).join(",")})`);
  check(lines.filter((l) => l.startsWith("500,")).length === 1, "indent CSV has one row per indent line (repeated period balances de-duplicated)");
  check(/Opening balance \(reconstructed\)/.test(csv) && /Closing balance \(reconstructed\)/.test(csv), "indent CSV labels reconstructed balances");
  await page.click("#btnPaExportMenu");
  await page.click("#btnPaPrint");
  await page.waitForSelector('iframe[srcdoc*="Indent deduction statement"]', { state: "attached", timeout: 5000 });
  const src = await page.getAttribute('iframe[srcdoc*="Indent deduction statement"]', "srcdoc");
  const order = [...src.matchAll(/<h2>Indent (\d+)<\/h2>/g)].map((m) => m[1]);
  check(order.join(",") === "84,156,191,300,500", `print statement lists indents in canonical order (${order})`);
  check(/Voucher date range: 2026-11-23/.test(src) && /Generated: 2026-11-24 IST/.test(src), "print statement carries range and generation date");
  await ctx.close();
}
{
  // export refuses a drifting dataset
  const big = Array.from({ length: 250 }, (_, i) => ({ ...fx.NOV23_TRAIL_RAW[0], purchase_fact_id: 200000 + i, indent_line_id: 900000 + i, indent_id: 7000 + i }));
  const { ctx, page } = await openLens(VP, { data: baseData({ trail: big }), opts: { driftTrail: {} } });
  await page.waitForSelector(".pa-indent-card");
  let downloaded = false;
  page.on("download", () => { downloaded = true; });
  await page.click("#btnPaExportMenu");
  await page.click("#btnPaExportCsv");
  await page.waitForFunction(() => /Export failed/.test(document.getElementById("toastContainer")?.innerText || ""), null, { timeout: 5000 }).catch(() => {});
  check(!downloaded && /Export failed: Incomplete retrieval/.test(await page.innerText("#toastContainer")), "a dataset whose total changes between pages is refused (no partial download)");
  await ctx.close();
}

// ── 8. responsive layouts, roles, regressions ────────────────────────────────────────
for (const vp of [NARROW, TABLET]) {
  const { ctx, page, errors } = await openLens(vp);
  await page.waitForSelector(".pa-indent-card");
  for (const mode of ["indent", "material", "vendor"]) {
    await page.click(`[data-pa-mode="${mode}"]`);
    await page.waitForTimeout(400);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(o <= 1, `[${vp.name}] ${mode}: no horizontal page overflow (${o}px)`);
    await shot(page, `${vp.name}-${mode}-wise`);
  }
  await page.click('[data-pa-mode="material"]');
  await page.waitForSelector("#paMaterialTbody tr.clickable-row");
  if (vp.width <= 520) {
    // card labels must line up with their values (a hidden column must not shift them)
    const pairs = await page.$eval("#paMaterialTbody tr.clickable-row", (r) => Object.fromEntries([...r.children].map((c) => [c.dataset.label, c.textContent.trim()])));
    check(pairs.Purchased === "135" && pairs.Allocated === "135" && pairs.Unallocated === "0" && pairs.Effective === "—" && /Fully allocated/.test(pairs.Status || ""),
      `[${vp.name}] card labels align with values (${JSON.stringify(pairs)})`);
  }
  await page.click("#paMaterialTbody tr.clickable-row >> nth=0");
  await page.waitForSelector("#paDrillModalBackdrop.show .pa-receipt");
  await shot(page, `${vp.name}-drill`);
  const ov = await page.evaluate(() => { const m = document.querySelector("#paDrillModalBackdrop .modal"); return m.scrollWidth - m.clientWidth; });
  check(ov <= 1, `[${vp.name}] drill dialog has no horizontal overflow (${ov}px)`);
  check(errors.length === 0, `[${vp.name}] no browser errors ${errors.join("|")}`);
  await ctx.close();
}
{
  const { ctx, page } = await openLens(VP, { role: "view" });
  await page.waitForSelector(".pa-indent-card");
  check(await page.isVisible("#btnPaExportMenu") && (await page.locator("#tab-purchase-allocations [data-edit-action]").count()) === 0, "view-only user can use the lens; it has no edit controls");
  const writes = await page.evaluate(() => (globalThis.__rpcNames || []).filter((n) => !n.startsWith("proc_pec_purchase_alloc_") && /accept|issue|clear|delete|set_|apply|update|create|close/i.test(n)));
  check(writes.length === 0, `lens issued no mutating RPC (${writes.join(",")})`);
  const rpc = (await page.evaluate(() => globalThis.__paCalls.map((c) => c.name))).filter((n, i, a) => a.indexOf(n) === i);
  check(rpc.every((n) => /^proc_pec_purchase_alloc_(summary|indent_paged|material_paged|vendor_paged|trail_paged)$/.test(n)), `only the five frozen RPC names are used (${rpc.join(",")})`);
  await ctx.close();
}
// ── 9. PEC-UX03: filter panel, period indicator, summary, density ────────────────────
{
  const { ctx, page } = await openLens(VP);
  await page.waitForSelector(".pa-indent-card");
  check((await page.locator("[data-pa-preset]").count()) === 4 && (await page.locator("#tab-purchase-allocations > .pa-card [data-pa-preset], #tab-purchase-allocations > .pec-search-card > :not(.pec-filter-wrap) [data-pa-preset]").count()) === 0, "date presets exist once (four buttons) and only inside the filter panel; no permanent date-control panel in the lens body");
  await openFilters(page);
  check(await page.evaluate(() => ["paDateSeg", "paDateSpecific", "paDateFrom", "paDateTo"].every((id) => document.getElementById(id).closest("#paFilterDrawer"))), "presets and pickers are inside the filter panel");
  const geo = await page.evaluate(() => { const d = document.getElementById("paFilterDrawer").getBoundingClientRect(), b = document.getElementById("paFilterBtn").getBoundingClientRect(); return { sheet: document.getElementById("paFilterDrawer").classList.contains("is-sheet"), dl: d.left, dt: d.top, bl: b.left, bb: b.bottom, dw: d.width, vw: innerWidth }; });
  check(!geo.sheet && Math.abs(geo.dl - geo.bl) < 16 && geo.dt >= geo.bb && geo.dw >= 320, `desktop: anchored panel opens at the filter button (${JSON.stringify(geo)})`);
  await shot(page, "desktop-filter-anchored");
  await page.keyboard.press("Escape");
  check(await page.waitForFunction(() => document.activeElement?.id === "paFilterBtn", null, { timeout: 3000 }).then(() => true, () => false), "Escape closes the panel and returns focus to the filter button");
  // indicator opens the SAME panel, anchored at the indicator, focused on the period section
  await page.click("#paPeriodBtn");
  await page.waitForSelector("#paFilterDrawer.open");
  const g2 = await page.evaluate(() => { const d = document.getElementById("paFilterDrawer").getBoundingClientRect(), b = document.getElementById("paPeriodBtn").getBoundingClientRect(); return { dl: d.left, dt: d.top, bl: b.left, bb: b.bottom, focus: document.activeElement?.closest("#paDateSeg") !== null, n: document.querySelectorAll("#paFilterDrawer").length }; });
  check(g2.n === 1 && g2.focus && Math.abs(g2.dl - g2.bl) < 16 && g2.dt >= g2.bb, `indicator opens the same single panel near itself, focus on the period section (${JSON.stringify(g2)})`);
  await page.keyboard.press("Escape");
  check(await page.waitForFunction(() => document.activeElement?.id === "paPeriodBtn", null, { timeout: 3000 }).then(() => true, () => false), "focus returns to the period indicator");
  // draft is separate from applied state
  const n0 = (await calls(page, "_indent_paged")).length;
  await openFilters(page);
  await page.click('[data-pa-preset="today"]');
  await page.selectOption("#paFClass", "RM");
  await page.fill("#paFVendor", "kera");
  await page.waitForTimeout(450);
  check((await calls(page, "_indent_paged")).length === n0 && (await page.innerText("#paPeriodText")) === "Yesterday · 23 Nov 2026", "unapplied changes neither request data nor change the indicator");
  await page.click("#paFilterDrawer .pec-filter-close");
  await openFilters(page);
  check((await page.getAttribute('[data-pa-preset="yesterday"]', "aria-pressed")) === "true" && (await page.inputValue("#paFClass")) === "" && (await page.inputValue("#paFVendor")) === "", "closing without Apply discards the draft; the panel re-opens at the applied values");
  await page.click('[data-pa-preset="today"]');
  await page.selectOption("#paFClass", "RM");
  await page.fill("#paFVendor", "kera");
  const before = (await calls(page, "_indent_paged")).length;
  await applyFilters(page);
  await page.waitForFunction((n) => globalThis.__paCalls.filter((c) => c.name.endsWith("_indent_paged")).length > n, before);
  await page.waitForTimeout(300);
  const applied = (await calls(page, "_indent_paged")).slice(before);
  check(applied.length === 1 && applied[0].p.p_date_from === "2026-11-24" && applied[0].p.p_material_class_code === "RM" && applied[0].p.p_vendor_q === "kera", `Apply commits period and filters in ONE request (${applied.length})`);
  check((await page.innerText("#paPeriodText")) === "Today · 24 Nov 2026" && (await page.innerText("#paFilterBadge")) === "2", "indicator and badge reflect the applied state");
  // Reset restores defaults (Yesterday, no filters); Apply commits them
  await openFilters(page, "#paPeriodBtn");
  await page.click("#paFilterDrawer .pec-filter-clear-btn");
  check((await page.getAttribute('[data-pa-preset="yesterday"]', "aria-pressed")) === "true" && (await page.inputValue("#paFClass")) === "", "Reset restores Yesterday and clears the draft filters");
  await applyFilters(page);
  await page.waitForFunction(() => document.getElementById("paPeriodText").textContent === "Yesterday · 23 Nov 2026");
  check(await page.isHidden("#paFilterBadge"), "after Reset + Apply there are no active filters");
  // specific date and range
  await setFilters(page, async (p) => { await p.click('[data-pa-preset="specific"]'); await p.fill("#paDateSpecific", "2026-11-20"); });
  await page.waitForFunction(() => document.getElementById("paPeriodText").textContent === "20 Nov 2026");
  const sp = (await calls(page, "_indent_paged")).slice(-1)[0];
  check(sp.p.p_date_from === "2026-11-20" && sp.p.p_date_to === "2026-11-20", "specific date is an inclusive single voucher day");
  await setFilters(page, async (p) => { await p.click('[data-pa-preset="custom"]'); await p.fill("#paDateFrom", "2026-11-01"); await p.fill("#paDateTo", "2026-11-23"); });
  await page.waitForFunction(() => document.getElementById("paPeriodText").textContent === "1–23 Nov 2026");
  const rg = (await calls(page, "_indent_paged")).slice(-1)[0];
  check(rg.p.p_date_from === "2026-11-01" && rg.p.p_date_to === "2026-11-23", "custom range is inclusive");
  // summary collapse keeps state and does not reload
  await openSummary(page);
  const sc0 = (await calls(page, "_summary")).length, ic0 = (await calls(page, "_indent_paged")).length;
  await page.click("#paSummaryToggle");
  await page.waitForTimeout(250);
  check(await page.isHidden("#paSummary") && (await calls(page, "_summary")).length === sc0 && (await calls(page, "_indent_paged")).length === ic0 && (await page.innerText("#paPeriodText")) === "1–23 Nov 2026", "collapsing the summary reloads nothing and keeps filters");
  await ctx.close();
}
{
  // narrow: the same panel is a full-viewport sheet (shared PEC implementation)
  const { ctx, page } = await openLens({ name: "phone", width: 390, height: 844 });
  await page.waitForSelector(".pa-indent-card");
  const first = await page.$eval(".pa-indent-card", (e) => Math.round(e.getBoundingClientRect().top));
  check(first <= 386, `pre-data height at 390x844 is <= 386px (35% below the 594px v6.5.0 baseline): ${first}px`);
  check(await page.isHidden("#paSummary"), "[narrow] Allocation Summary collapsed by default");
  for (const via of ["#paFilterBtn", "#paPeriodBtn"]) {
    await openFilters(page, via);
    const r = await page.evaluate(() => { const d = document.getElementById("paFilterDrawer"), b = d.getBoundingClientRect(), body = d.querySelector(".pec-filter-drawer-body"), f = d.querySelector(".pec-filter-actions").getBoundingClientRect();
      return { sheet: d.classList.contains("is-sheet"), l: b.left, t: b.top, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight, bodyScroll: getComputedStyle(body).overflowY, footBottom: f.bottom, locked: document.body.classList.contains("pec-sheet-open"),
        title: d.querySelector(".pec-filter-drawer-title").textContent, close: !!d.querySelector(".pec-filter-close"), apply: d.querySelector(".pec-filter-done-btn").textContent, reset: d.querySelector(".pec-filter-clear-btn").textContent }; });
    check(r.sheet && r.l === 0 && r.t === 0 && r.w === r.vw && r.h === r.vh && r.bodyScroll === "auto" && Math.round(r.footBottom) === r.vh && r.locked && r.close && r.apply === "Apply filters" && r.reset === "Reset",
      `[narrow] ${via} opens the full-page sheet: header+close, scrolling body, Reset/Apply footer, background locked (${JSON.stringify(r)})`);
    await page.keyboard.press("Escape");
    check(!(await page.isVisible("#paFilterDrawer")) && (await page.evaluate(() => !document.body.classList.contains("pec-sheet-open"))), `[narrow] Escape dismisses the sheet and unlocks the page (${via})`);
  }
  await page.click("#paSummaryToggle");
  const o = await page.evaluate(() => { const s = document.getElementById("paSummary"); return { w: s.scrollWidth - s.clientWidth, page: document.documentElement.scrollWidth - innerWidth }; });
  check(o.w <= 1 && o.page <= 1, `[narrow] expanded summary has no horizontal clipping (${JSON.stringify(o)})`);
  await shot(page, "phone-summary-expanded");
  await page.click("#paSummaryToggle");
  await openFilters(page, "#paPeriodBtn");
  await shot(page, "phone-filter-sheet");
  await ctx.close();
}

// ── 10. PEC v6.5.1: Summary control pinned right, PEC chevron, no overlap for long periods ──
for (const w of [375, 390, 430, 820, 1440]) {
  const { ctx, page } = await openLens({ name: `w${w}`, width: w, height: 844 });
  await page.waitForSelector(".pa-indent-card");
  for (const mode of ["indent", "material", "vendor"]) {
    await page.click(`[data-pa-mode="${mode}"]`);
    const g = await page.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), st = document.querySelector(".pa-strip").getBoundingClientRect(), c = r("paPeriodBtn"), t = r("paSummaryToggle");
      return { stRight: st.right, tRight: t.right, tLeft: t.left, cLeft: c.left, cRight: c.right, stLeft: st.left, ch: c.height, th: t.height }; });
    check(Math.abs(g.stRight - g.tRight) <= 1 && g.cRight < g.tLeft && Math.abs(g.cLeft - g.stLeft) <= 1 && Math.abs(g.ch - g.th) <= 1, `[${w}] ${mode}: Summary pinned to the far right, period indicator left, equal heights, no overlap (${JSON.stringify(g)})`);
  }
  const svg = await page.$eval("#paSummaryToggle svg", (e) => ({ pts: e.querySelector("polyline").getAttribute("points"), w: e.getAttribute("width"), sw: e.getAttribute("stroke-width"), txt: document.getElementById("paSummaryToggle").textContent.includes("▸") }));
  check(svg.pts === "6 9 12 15 18 9" && svg.w === "14" && svg.sw === "2.5" && !svg.txt, `[${w}] Summary uses the PEC chevron svg, not the solid triangle`);
  const rot = () => page.$eval("#paSummaryToggle svg", (e) => getComputedStyle(e).transform);
  await page.waitForTimeout(200);
  check((await rot()) === "none", `[${w}] collapsed: chevron points down`);
  await page.click("#paSummaryToggle");
  await page.waitForTimeout(250);
  check((await rot()).startsWith("matrix(-1") && (await page.getAttribute("#paSummaryToggle", "aria-expanded")) === "true", `[${w}] expanded: chevron points up, aria-expanded=true`);
  await page.click("#paSummaryToggle");
  await setFilters(page, async (p) => { await p.click('[data-pa-preset="custom"]'); await p.fill("#paDateFrom", "2026-10-28"); await p.fill("#paDateTo", "2026-11-03"); });
  await page.waitForFunction(() => document.getElementById("paPeriodText").textContent === "28 Oct – 3 Nov 2026");
  const lg = await page.evaluate(() => { const c = document.getElementById("paPeriodBtn").getBoundingClientRect(), t = document.getElementById("paSummaryToggle").getBoundingClientRect(); return { gap: t.left - c.right, over: document.documentElement.scrollWidth - innerWidth, tR: t.right, vw: innerWidth }; });
  check(lg.gap >= 0 && lg.over <= 1 && lg.tR <= lg.vw, `[${w}] long custom range: no overlap or clipping (${JSON.stringify(lg)})`);
  await shot(page, `refine-${w}`);
  await ctx.close();
}

{
  // existing lenses still load and the excess lens is unaffected
  const { ctx, page, errors } = await openLens(VP);
  for (const t of ["pr", "indents", "action", "excess"]) {
    await page.click(`.tabs .tab-btn[data-tab="${t}"]`);
    await page.waitForTimeout(300);
    check(await page.isVisible(`#tab-${t}.active`), `existing lens ${t} still opens`);
  }
  await page.click('.tabs .tab-btn[data-tab="purchase-allocations"]');
  check(errors.length === 0, `no browser errors across lens switching ${errors.join("|")}`);
  await ctx.close();
}

await h.close();
if (failures) { console.error(`pec-purchase-allocations-ui-smoke: ${failures} FAILED`); process.exit(1); }
console.log("pec-purchase-allocations-ui-smoke: PASS");
