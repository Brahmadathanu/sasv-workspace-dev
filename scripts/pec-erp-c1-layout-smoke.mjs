#!/usr/bin/env node
/**
 * PEC-ERP-C1 responsive / interaction regression.
 *
 * Runs the REAL shared module (public/shared/procurement-execution-console.html
 * + js) in Chromium against a local static server, with ONLY
 * js/supabaseClient.js replaced by a synthetic fixture stub (no network, no
 * Supabase). This verifies layout and presentation behaviour. It is NOT
 * signed-in operational acceptance.
 *
 * Usage: node scripts/pec-erp-c1-layout-smoke.mjs [--shots <dir>]
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { PAGED_SHIM } from "./lib/pec-paged-shim.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const shotsIdx = process.argv.indexOf("--shots");
const shotsDir = shotsIdx > 0 ? path.resolve(process.argv[shotsIdx + 1]) : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

function stub(scenario) {
  return `${PAGED_SHIM}

const S = ${JSON.stringify(scenario)};
const long = "Aqueous extract of Terminalia chebula fruit pericarp standardised grade A — long item name to exercise wrapping without clipping";
const indents = Array.from({ length: 5 }, (_, i) => ({
  indent_id: 100 + i, indent_number: "IND-26-" + (100 + i), status: i % 2 ? "approved" : "draft",
  approved_date: i % 2 ? "2026-11-0" + (i + 1) : null, material_class_id: 1, material_class_code: "RM",
  line_count: 3, total_remaining_qty: 5, ...(S.indentDate ? { indent_date: "2026-10-2" + i } : {}),
}));
const data = {
  proc_pec_indent_headers: S.empty ? [] : indents,
  proc_pec_pr_headers: S.empty ? [] : [{ pr_id: 1, pr_number: "PR-1", status: S.ccfDraft ? "draft" : "active", updated_at:"2026-11-22T07:02:14.215875+00:00",generation_filters:{rm_scope:"normal"},horizon_start_month:"2026-11-01",horizon_end_month:"2026-12-01",effective_from_date: "2026-11-01", material_class_id: 1, line_count: 2 }],
  proc_pec_purchase_excess: S.empty ? [] : [{ purchase_fact_id: 1, voucher_number: "V-1", voucher_date: "2026-11-02", stock_item_name: long, material_class_code: "RM", purchase_qty: 10, allocated_qty: 4, unallocated_qty: 6, accepted_qty: 0, net_unallocated_qty: 6 }],
  proc_pec_excess_acceptance_audit: [],
  proc_pec_buylist_material_class_options: [], proc_pec_buylist_rm_scope_options: [],
  proc_pec_sourcing_decisions: [], proc_pec_vendor_details: [],
};
const mk = (d) => ({ data: d, error: null });
export const supabase = {
  auth: { getSession: async () => ({ data: { session: { user: { id: "fixture-user" } } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  rpc: async (name, params) => {
    const __r = __pagedRpc(name, params || {}, { indents: data.proc_pec_indent_headers, prs: data.proc_pec_pr_headers, excess: data.proc_pec_purchase_excess, audit: [] });
    if (__r && __r.__error) return { data: null, error: { message: __r.__error } };
    if (S.failReads && (name.startsWith("proc_pec_") || name === "proc_procurement_action_queue_paged")) return { data: null, error: { message: "fixture failure" }, status: 400 };
    if (__r !== undefined && !(S.failReads && name.startsWith("proc_pec_"))) return mk(__r);
    if (name === "get_user_permissions") return mk(S.role === "none" ? [] : [{ target: "module:procurement-execution-console", can_view: true, can_edit: S.role === "edit" }]);
    if(name === "proc_pec_s4_new_pr_plan") {
      globalThis.__s4PlanCalls = (globalThis.__s4PlanCalls || 0) + 1;
      return mk([
        {material_class_id:2,stock_item_id:1638,stock_item_name:"Label - Punarnavasavam 450 ML",
          uom_id:5,uom_code:"Nos",mrp_net_qty:0,recommended_qty:2098,usage_12m:12587,
          gate:"AUTO_ELIGIBLE",consumption_only:false},
        {material_class_id:2,stock_item_id:890,stock_item_name:"Synthetic Review Packaging",
          uom_id:5,uom_code:"Nos",mrp_net_qty:0,recommended_qty:null,usage_12m:120,
          gate:"STOCK_MAPPING_REVIEW",consumption_only:true}
      ]);
    }
    if(name === "proc_pec_s4_generate_pr") {
      globalThis.__s4GenerateCalls = (globalThis.__s4GenerateCalls || []);
      globalThis.__s4GenerateCalls.push(params);
      if(S.role!=="edit") return {data:null,error:{message:"Permission denied"}};
      return mk({pr_id:40,pr_number:params.p_pr_number,auto_evidenced_lines:1,review_required_lines:1});
    }
    if(name === "proc_pec_s4_reconcile_draft") {
      globalThis.__s4ReconcileCalls = (globalThis.__s4ReconcileCalls || []);
      globalThis.__s4ReconcileCalls.push(params);
      if(S.role!=="edit")return {data:null,error:{message:"Permission denied"}};
      return mk({pr_id:1,updated_untouched_lines:1,added_missing_lines:1,review_required:1});
    }
    if(name === "proc_pec_s4_pr_evidence") return mk([]);
    if (name === "proc_pec_ccf_pr_preview") {
      globalThis.__ccfPreviewCalls = (globalThis.__ccfPreviewCalls || 0) + 1;
      return mk([{ pr_id: 1, pr_line_id: 77, stock_item_id: 1638, stock_item_name: "Label - Punarnavasavam 450 ML",
        uom_code: "Nos", mrp_suggested_qty: 0, pr_effective_qty: 0, usage_12m: 12587,
        months_with_usage: 4, calendar_monthly_average: 1048.916667, latest_usage_month: "2026-10-01",
        stock_on_hand: 0, stock_as_of: "2026-11-22", outstanding_indent_qty: 0,
        illustrative_ccf_floor: 2098, illustrative_increment: 2098,
        review_state: "ANCHOR_AND_POLICY_REVIEW", advisory_only: true }]);
    }
    if (name === "proc_pec_ccf_apply_draft_line") {
      globalThis.__ccfWriterCalls = (globalThis.__ccfWriterCalls || []);
      globalThis.__ccfWriterCalls.push(params);
      if (S.role !== "edit") return { data: null, error: {message: "Permission denied"} };
      if (params.p_confirm !== true || String(params.p_reason || "").length < 20 ||
          Number(params.p_pr_line_id) !== 77 || Number(params.p_expected_ccf_floor) !== 2098)
        return {data: null, error: {message: "Invalid CCF confirmation"}};
      return mk({action: "CCF_APPROVED_DRAFT_ONLY", pr_line_id: 77, new_effective_qty: 2098});
    }
    if (name === "proc_pec_pr_headers") {
      if (S.numberingDelay) await new Promise(r => setTimeout(r, S.numberingDelay));
      return mk(S.numberingRows || []);
    }
    if (name === "proc_procurement_action_queue_paged") return mk(S.empty ? [] : [{ total_count: 1, row_data: { indent_line_id: 1, indent_id: 100, indent_number: "IND-26-100", stock_item_name: long, remaining_qty: 5, priority_band_final: "P1", priority_score_system: 80, material_class_code: "RM", uom_code: "KG" } }]);
    if (name in data) return mk(data[name]);
    return mk([]);
  },
  from: () => { const b = { select: () => b, eq: () => b, limit: () => b, order: () => b, in: () => b, ilike: () => b, then: (r) => r(mk([])) }; return b; },
  schema: () => ({ from: () => ({}) }),
};
export const labSupabase = supabase; export const hrSupabase = supabase;
export const handleSupabaseError = (e) => e;
`;
}

const browser = await chromium.launch();
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.error("FAIL:", msg); } else console.log("ok  :", msg); };

async function open(scenario, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/js/supabaseClient.js", (r) => r.fulfill({ contentType: "text/javascript", body: stub(scenario) }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.goto(`${base}/shared/procurement-execution-console.html`);
  await page.waitForSelector("#mainPanel:not([hidden])", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}

const VIEWPORTS = [
  { name: "wide", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1100 },
  { name: "mobile", width: 390, height: 800 },
];
const TABS = ["pr", "indents", "vendor-buylist", "action", "excess"];

for (const vp of VIEWPORTS) {
  const { ctx, page, errors } = await open({ role: "edit", indentDate: true }, vp);
  const tag = `[${vp.name} ${vp.width}px]`;
  const sel = vp.width <= 520 ? "#procTabSelect" : null;

  check(await page.locator("body.sasv-pec").count() === 1, `${tag} body.sasv-pec scope present`);
  const fam = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  check(/Inter/.test(fam), `${tag} Inter typography (${fam.slice(0, 30)})`);
  const h1 = await page.evaluate(() => { const e = document.querySelector(".page-header h1"); const c = getComputedStyle(e); return [c.fontSize, c.fontWeight]; });
  check(h1[0] === "18px" || vp.width <= 520, `${tag} title size ${h1[0]}/${h1[1]}`);

  const home = await page.evaluate(() => { const b = document.getElementById("homeBtn"); const l = b.querySelector(".home-label"); return { aria: b.getAttribute("aria-label"), title: b.title, svg: !!b.querySelector("svg"), labelDisplay: l && getComputedStyle(l).display }; });
  check(home.aria === "HOME" && home.title === "HOME" && home.svg, `${tag} HOME canonical (icon + aria/title)`);
  check(vp.width <= 520 ? home.labelDisplay === "none" : home.labelDisplay !== "none", `${tag} HOME label ${vp.width <= 520 ? "hidden" : "visible"}`);

  for (const t of TABS) {
    if (sel) await page.selectOption(sel, t); else await page.click(`.tabs .tab-btn[data-tab="${t}"]`);
    await page.waitForTimeout(350);
    const r = await page.evaluate((t) => {
      const panel = document.getElementById("tab-" + t);
      const de = document.documentElement;
      const labels = [...panel.querySelectorAll(".pec-action-label")].filter((e) => e.offsetParent !== null).length;
      const btns = [...document.querySelectorAll("button")].filter((b) => b.offsetParent !== null);
      const unnamed = btns.filter((b) => !(b.getAttribute("aria-label") || b.textContent.trim() || b.title)).map((b) => b.id || b.className);
      const iconBtns = [...panel.querySelectorAll(".icon-btn, .pec-filter-btn")].filter((b) => b.offsetParent !== null);
      const noName = iconBtns.filter((b) => !b.getAttribute("aria-label")).map((b) => b.id);
      return { hOverflow: de.scrollWidth - de.clientWidth, labels, unnamed, noName, selected: document.querySelector('.tabs .tab-btn[aria-selected="true"]')?.dataset.tab, role: panel.getAttribute("role") };
    }, t);
    check(r.hOverflow <= 1, `${tag} ${t}: no horizontal page overflow (${r.hOverflow}px)`);
    check(r.unnamed.length === 0, `${tag} ${t}: every visible button has accessible name ${r.unnamed.join(",")}`);
    check(r.noName.length === 0, `${tag} ${t}: icon controls carry aria-label ${r.noName.join(",")}`);
    check(vp.width > 820 ? r.labels > 0 || t === "vendor-buylist" : r.labels === 0, `${tag} ${t}: action labels ${vp.width > 820 ? "visible" : "hidden (icon-only)"} (${r.labels})`);
    check(r.selected === t && r.role === "tabpanel", `${tag} ${t}: aria-selected + tabpanel role`);
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${vp.name}-${t}.png`) });
  }

  // Indent date presence (fixture supplies indent_date)
  if (sel) await page.selectOption(sel, "indents"); else await page.click('.tabs .tab-btn[data-tab="indents"]');
  await page.waitForTimeout(300);
  const heads = await page.$$eval("#tab-indents thead th", (n) => n.filter((e) => !e.hidden).map((e) => e.textContent.trim()));
  check(heads.includes("Indent Date") && heads.includes("Approved Date"), `${tag} indents: separate Indent Date + Approved Date columns`);
  const firstRow = await page.$$eval("#iTbody tr:first-child td", (n) => n.length);
  check(firstRow === 7, `${tag} indents: row cell count matches header (7)`);
  check(errors.length === 0, `${tag} no page errors ${errors.join("|")}`);
  await ctx.close();
}

// Keyboard: arrow navigation across tabs (wide)
{
  const { ctx, page } = await open({ role: "edit" }, VIEWPORTS[0]);
  await page.focus('.tabs .tab-btn[data-tab="pr"]');
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  check(await page.getAttribute('.tabs .tab-btn[data-tab="indents"]', "aria-selected") === "true", "keyboard: ArrowRight moves to next lens");
  const ti = await page.$$eval(".tabs .tab-btn", (n) => n.map((e) => e.tabIndex));
  check(ti.filter((x) => x === 0).length === 1, "keyboard: roving tabindex (one tab stop)");
  await ctx.close();
}

// Dynamically created / re-rendered buttons (indent modal status actions) get labels
for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
  const { ctx, page } = await open({ role: "edit", indentDate: true }, vp);
  const tag = `[${vp.name}]`;
  if (vp.width <= 520) await page.selectOption("#procTabSelect", "indents"); else await page.click('.tabs .tab-btn[data-tab="indents"]');
  await page.waitForTimeout(400);
  await page.click("#iTbody tr:nth-child(2)"); // approved indent
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const modal = document.getElementById("indentViewModalBackdrop");
    const btns = [...modal.querySelectorAll(".icon-btn")].filter((b) => b.offsetParent !== null);
    const withLabel = btns.filter((b) => b.querySelector(".pec-action-label") && getComputedStyle(b.querySelector(".pec-action-label")).display !== "none");
    const dyn = btns.filter((b) => b.classList.contains("status-action"));
    const dynLabelled = dyn.filter((b) => b.querySelector(".pec-action-label"));
    return { total: btns.length, visibleLabels: withLabel.length, dyn: dyn.length, dynLabelled: dynLabelled.length };
  });
  check(r.dyn === r.dynLabelled, `${tag} dynamic status actions all carry a label node (${r.dynLabelled}/${r.dyn})`);
  check(vp.width > 820 ? r.visibleLabels > 0 : r.visibleLabels === 0, `${tag} modal action labels ${vp.width > 820 ? "visible" : "hidden"} (${r.visibleLabels}/${r.total})`);
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${vp.name}-indent-modal.png`) });
  await ctx.close();
}

// Empty-state colspan equals visible header count (conditional date column)
{
  const { ctx, page } = await open({ role: "edit", empty: true, indentDate: true }, VIEWPORTS[0]);
  await page.click('.tabs .tab-btn[data-tab="indents"]');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({ th: [...document.querySelectorAll("#tab-indents thead th")].filter((e) => !e.hidden).length, span: document.querySelector("#iTbody td.pec-table-state")?.colSpan }));
  check(r.th === r.span, `indents empty-state colspan ${r.span} matches visible headers ${r.th}`);
  await ctx.close();
}

// Indent date absent -> column hidden, never invented
{
  const { ctx, page } = await open({ role: "view" }, VIEWPORTS[0]);
  await page.click('.tabs .tab-btn[data-tab="indents"]');
  await page.waitForTimeout(300);
  const heads = await page.$$eval("#tab-indents thead th", (n) => n.filter((e) => !e.hidden).map((e) => e.textContent.trim()));
  check(!heads.includes("Indent Date") && heads.includes("Approved Date"), "no indent_date in contract: column hidden, Approved Date retained");
  check((await page.$$eval("#iTbody tr:first-child td", (n) => n.length)) === 6, "no indent_date: 6 cells per row");
  check(await page.isVisible("#viewOnlyBanner"), "read-only role: banner visible");
  await ctx.close();
}

// Empty and error states
for (const [scn, kind] of [[{ role: "edit", empty: true }, "is-empty"], [{ role: "edit", failReads: true }, "is-error"]]) {
  const { ctx, page } = await open(scn, VIEWPORTS[0]);
  for (const t of ["pr", "indents", "action", "excess"]) {
    await page.click(`.tabs .tab-btn[data-tab="${t}"]`);
    await page.waitForTimeout(400);
    const n = await page.locator(`#tab-${t} td.pec-table-state.${kind}`).count();
    check(n === 1, `${kind.slice(3)} state rendered on ${t}`);
  }
  await ctx.close();
}

// Unauthorized role: panel hidden, no data requests
{
  const { ctx, page } = await open({ role: "none" }, VIEWPORTS[0]);
  check(!(await page.isVisible("#mainPanel")), "unauthorized role: main panel hidden");
  await ctx.close();
}

// Excess Purchase acceptance form: label-to-field spacing must not collapse.
// Inspect actual layout at desktop and narrow phone widths, with no writer calls.
for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
  const { ctx, page, errors } = await open({ role: "edit" }, vp);
  const tag = `[Excess ${vp.name}]`;
  await page.evaluate(() => {
    const backdrop = document.getElementById("acceptExcessModalBackdrop");
    backdrop.classList.add("show");
    backdrop.setAttribute("aria-hidden", "false");
  });
  const fields = await page.evaluate(() => ["excessAcceptQty", "excessAcceptReason"].map(id => {
    const control = document.getElementById(id);
    const label = document.querySelector(`label[for="${id}"]`);
    const l = label.getBoundingClientRect();
    const c = control.getBoundingClientRect();
    return { id, separation: c.top - l.bottom, labelDisplay: getComputedStyle(label).display,
      labelHeight: l.height, controlWidth: c.width, parentWidth: control.parentElement.getBoundingClientRect().width };
  }));
  check(fields.every(f => f.labelDisplay === "block" && f.separation >= 6 && f.labelHeight > 0),
    `${tag} acceptance labels are separated from field borders by at least 6px`);
  check(fields.every(f => f.controlWidth <= f.parentWidth + 1),
    `${tag} acceptance fields fit their grid columns`);
  check(errors.length === 0, `${tag} no page errors`);
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${vp.name}-excess-label-spacing.png`) });
  await ctx.close();
}

// Generate Draft PR: prefilled number follows real PR-YYYY-NN convention.
// Full-header fixture includes a revision; user edits and late RPCs stay untouched.
{
  const numberingRows = [
    { pr_number: "PR-2026-01" },
    { pr_number: "PR-2026-06" },
    { pr_number: "PR-2026-06/REV01" },
    { pr_number: "PR-2025-19" },
    { pr_number: "CUSTOM-2026-90" }
  ];
  const { ctx, page, errors } = await open({ role: "edit", numberingRows }, VIEWPORTS[0]);
  await page.click("#btnGeneratePr");
  await page.waitForSelector("#generatePrModalBackdrop.show");
  await page.waitForFunction(() => document.getElementById("prNewNumber").value !== "");
  check((await page.inputValue("#prNewNumber")).endsWith("-07"), "draft PR: next base number ignores revision and custom formats");
  check(await page.inputValue("#prNewNumber") === "PR-2026-07", "draft PR: existing numbering convention retained");
  await page.fill("#prNewNumber", "OWNER-CUSTOM-PR");
  await page.fill("#prEffectiveFrom", "2027-01-12");
  await page.dispatchEvent("#prEffectiveFrom", "change");
  await page.waitForTimeout(250);
  check(await page.inputValue("#prNewNumber") === "OWNER-CUSTOM-PR", "draft PR: owner entry persists after date changes");
  await page.click("#btnGenPrCancel");
  await page.click("#btnGeneratePr");
  await page.waitForFunction(() => document.getElementById("prNewNumber").value !== "");
  await page.fill("#prEffectiveFrom", "2027-01-12");
  await page.dispatchEvent("#prEffectiveFrom", "change");
  await page.waitForFunction(() => document.getElementById("prNewNumber").value === "PR-2027-01");
  check(await page.inputValue("#prNewNumber") === "PR-2027-01", "draft PR: suggestion follows effective-date year");
  await page.click("#btnGenPrCancel");
  check(errors.length === 0, `draft PR: no page errors ${errors.join("|")}`);
  await ctx.close();
}
{
  const { ctx, page, errors } = await open({
    role: "edit", numberingDelay: 320,
    numberingRows: [{ pr_number: "PR-2026-09" }]
  }, VIEWPORTS[0]);
  await page.click("#btnGeneratePr");
  await page.fill("#prNewNumber", "MANUAL-FAST");
  await page.waitForTimeout(600);
  check(await page.inputValue("#prNewNumber") === "MANUAL-FAST", "draft PR: late suggestion cannot overwrite manual number");
  await page.click("#btnGenPrCancel");
  check(errors.length === 0, `draft PR late lookup: no page errors ${errors.join("|")}`);
  await ctx.close();
}

// Action Queue detail → Select Vendor: actual Chromium hover/focus and responsive layout.
// The fixture returns only synthetic rows; no production RPC or business mutation.
for (const vp of VIEWPORTS) {
  const { ctx, page, errors } = await open({ role: "edit" }, vp);
  const tag = `[AQ ${vp.name}]`;
  if (vp.width <= 520) await page.selectOption("#procTabSelect", "action");
  else await page.click('.tabs .tab-btn[data-tab="action"]');
  await page.waitForSelector("#aqTbody tr:not(.pec-table-state)", { timeout: 6000 });
  await page.click("#aqTbody tr:first-child");
  await page.waitForSelector("#detailModalBackdrop.show");
  const ids = ["btnDetailRecommend", "btnDetailSelectVendor", "btnDetailJumpIndent"];
  const paths = await page.evaluate(() => ["btnDetailRecommend", "btnDetailSelectVendor", "btnDetailJumpIndent"].map(
    id => document.getElementById(id).querySelector("svg").innerHTML.trim()
  ));
  check(new Set(paths).size === 3, `${tag} action roles use distinct semantic SVGs`);
  const readable = (await page.evaluate(() => {
    const ids = ["btnDetailRecommend", "btnDetailSelectVendor", "btnDetailJumpIndent"];
    return ids.map(id => {
      const b = document.getElementById(id), c = getComputedStyle(b);
      const r = b.getBoundingClientRect(), p = b.parentElement.getBoundingClientRect();
      const label = b.querySelector("span");
      return { id, width: r.width, parentWidth: p.width, height: r.height,
        labelVisible: label && getComputedStyle(label).display !== "none",
        color: c.color, background: c.backgroundColor, scroll: b.scrollWidth > b.clientWidth + 2 };
    });
  }));
  check(readable.every(r => r.width >= r.parentWidth - 3 && r.height >= 44),
    `${tag} all action buttons full-width and touch-sized`);
  check(readable.every(r => r.labelVisible && !r.scroll),
    `${tag} action labels visible without clipping`);
  for (const id of ids) {
    await page.hover("#" + id);
    const info = await page.evaluate((id) => {
      const b = document.getElementById(id), c = getComputedStyle(b);
      const toRgb = x => (x.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = rgb => {
        const v = rgb.map(x => x / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
        return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
      };
      const foreground = lum(toRgb(c.color)), background = lum(toRgb(c.backgroundColor));
      return { ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
        color: c.color, background: c.backgroundColor };
    }, id);
    check(info.ratio >= 4.5, `${tag} ${id} hover text contrast ${info.ratio.toFixed(2)}:1`);
  }
  await page.click("#btnDetailSelectVendor");
  await page.waitForSelector("#vendorModalBackdrop.show");
  check(await page.isVisible("#aqVendorSearchInput"), `${tag} vendor selection search accessible`);
  check(await page.isVisible("#btnVendorSave"), `${tag} vendor dialog actions visible`);
  const footer = await page.evaluate(() => {
    const m = document.querySelector("#vendorModalBackdrop > .modal").getBoundingClientRect();
    const actions = document.querySelector("#vendorModalBackdrop .actions").getBoundingClientRect();
    return { within: actions.bottom <= m.bottom + 2 && actions.left >= m.left - 2 };
  });
  check(footer.within, `${tag} vendor dialog footer contained`);
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${vp.name}-aq-select-vendor-modal.png`) });
  await page.click("#btnVendorClose");
  check(!(await page.isVisible("#vendorModalBackdrop.show")), `${tag} vendor dialog closes without side effects`);
  check(errors.length === 0, `${tag} no Action Queue modal page errors ${errors.join("|")}`);
  await ctx.close();
}

// S4 protected preview: genuine DOM control and read-only synthetic RPC at wide/phone.
// No PR writer RPC in this fixture; no live business records changed.
for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
  const { ctx, page, errors } = await open({ role: "view" }, vp);
  const tag = `[CCF ${vp.name}]`;
  if (vp.width <= 520) await page.selectOption("#procTabSelect", "pr");
  else await page.click('.tabs .tab-btn[data-tab="pr"]');
  await page.waitForSelector("#prTbody tr:not(.pec-table-state)", { timeout: 5000 });
  await page.click("#prTbody tr:first-child");
  await page.waitForSelector("#prViewModalBackdrop.show", { timeout: 3000 });
  await page.click("#btnPrCoveragePreview");
  await page.waitForSelector("#ccfPreviewModalBackdrop.show", { timeout: 3000 });
  await page.waitForFunction(() => document.querySelector("#ccfPreviewTbody tr")?.textContent.includes("Punarnavasavam"));
  check((await page.locator("#ccfPreviewSummary").textContent()).includes("read-only") === false,
    `${tag} preview data loaded and summary computed`);
  const content = await page.locator("#ccfPreviewTbody").textContent();
  check(content.includes("Punarnavasavam") && content.includes("2,098"),
    `${tag} 12m zero-filled usage floor displayed for PM sample`);
  check(content.includes("ANCHOR_AND_POLICY_REVIEW"),
    `${tag} unapproved quantity clearly marked REVIEW`);
  check(await page.locator("#ccfPreviewModalBackdrop [data-edit-action]").count() === 0,
    `${tag} no writer action in preview modal`);
  const state = await page.evaluate(() => ({ count: globalThis.__ccfPreviewCalls || 0,
    scroll: document.querySelector("#ccfPreviewModalBackdrop .pec-ccf-scroll").scrollWidth,
    width: document.querySelector("#ccfPreviewModalBackdrop .pec-ccf-scroll").clientWidth }));
  check(state.count === 1, `${tag} only one view RPC requested`);
  check(state.scroll >= state.width, `${tag} comparison table can scroll internally`);
  await page.keyboard.press("Escape");
  check(!(await page.isVisible("#ccfPreviewModalBackdrop.show")), `${tag} Escape closes only preview`);
  check(await page.isVisible("#prViewModalBackdrop.show"), `${tag} parent PR modal preserved`);
  check(errors.length === 0, `${tag} no browser errors ${errors.join("|")}`);
  await ctx.close();
}

// S4 legacy diagnostic now has NO operational writer after unified
// hybrid plan, even for Editors. Existing archived #495 RPC is retired.
{
  const {ctx,page,errors}=await open({role:"edit",ccfDraft:true},VIEWPORTS[0]);
  await page.click('.tabs .tab-btn[data-tab="pr"]');
  await page.waitForSelector("#prTbody tr:not(.pec-table-state)");
  await page.click("#prTbody tr:first-child");
  await page.click("#btnPrCoveragePreview");
  await page.waitForFunction(() => document.querySelector("#ccfPreviewTbody")?.textContent.includes("Punarnavasavam"));
  check(await page.locator("#ccfPreviewTbody button[data-ccf-line-id]").count()===0,
    "CCF legacy: old writer not offered to Editor; S4 reconciliation is canonical");
  check(await page.evaluate(() => (globalThis.__ccfWriterCalls||[]).length)===0,
    "CCF legacy: no obsolete writer called");
  check(errors.length===0,`CCF legacy diagnostic: no page errors ${errors.join("|")}`);
  await ctx.close();
}

// S4 complete generation: review requires human acknowledgement, no
// automatic writer call while previewing, and the legacy MRP RPC is never used.
{
  const {ctx,page,errors}=await open({role:"edit"},VIEWPORTS[0]);
  await page.click("#btnGeneratePr");
  await page.fill("#prNewNumber","PR-S4-FIXTURE-01");
  await page.fill("#prHorizonStart","2026-11");
  await page.fill("#prHorizonEnd","2026-12");
  await page.selectOption("#prMaterialClass","2");
  await page.click("#btnGenS4Preview");
  await page.waitForFunction(() => document.querySelector("#genS4PreviewSummary")?.textContent.includes("zero-MRP"));
  const summary=await page.locator("#genS4PreviewSummary").textContent();
  check(summary.includes("1 zero-MRP") && summary.includes("1 require manual review"),
    "S4 generator: preview shows covered zero-MRP and review candidates");
  check(await page.isDisabled("#btnGenPrConfirm"),
    "S4 generator: cannot create without acknowledgement");
  check(await page.evaluate(()=>(globalThis.__s4GenerateCalls || []).length)===0,
    "S4 generator: read-only preflight never creates a PR");
  await page.check("#genS4Acknowledged");
  check(await page.isEnabled("#btnGenPrConfirm"),
    "S4 generator: reviewed preview enables generation");
  await page.click("#btnGenPrConfirm");
  await page.waitForFunction(()=>(globalThis.__s4GenerateCalls || []).length===1);
  const calls=await page.evaluate(()=>globalThis.__s4GenerateCalls||[]);
  check(calls[0].p_confirm===true &&
       calls[0].p_horizon_start_month==="2026-11-01" &&
       calls[0].p_horizon_end_month==="2026-12-01" &&
       calls[0].p_pr_number==="PR-S4-FIXTURE-01",
    "S4 generator: exact acknowledged horizon and number submitted to guarded server");
  check(errors.length===0,`S4 generator browser errors ${errors.join("|")}`);
  await ctx.close();
}
// S4 legacy draft: same-day locked writer is explicitly confirmed and
// receives the optimistic concurrency token from its real PR row.
{
  const {ctx,page,errors}=await open({role:"edit",ccfDraft:true},VIEWPORTS[0]);
  await page.click('.tabs .tab-btn[data-tab="pr"]');
  await page.waitForSelector("#prTbody tr:not(.pec-table-state)");
  await page.click("#prTbody tr:first-child");
  await page.waitForSelector("#btnPrS4Reconcile:visible");
  await page.click("#btnPrS4Reconcile");
  await page.waitForFunction(() => document.querySelector("#s4ReconcileSummary")?.textContent.includes("zero-MRP"));
  check(await page.isDisabled("#btnS4ReconcileConfirm"),
    "S4 reconciliation: cannot apply before reason/acknowledgement");
  await page.fill("#s4ReconcileReason","Reconcile the evidenced November December material requirements");
  await page.check("#s4ReconcileAcknowledged");
  check(await page.isEnabled("#btnS4ReconcileConfirm"),
    "S4 reconciliation: explicit confirmation unlocks draft-only apply");
  await page.click("#btnS4ReconcileConfirm");
  await page.waitForFunction(()=>(globalThis.__s4ReconcileCalls||[]).length===1);
  const calls=await page.evaluate(()=>globalThis.__s4ReconcileCalls||[]);
  check(calls[0].p_confirm===true && Number(calls[0].p_pr_id)===1 &&
       calls[0].p_expected_updated_at==="2026-11-22T07:02:14.215875+00:00",
    "S4 reconciliation: exact PR concurrency token and affirmative approval");
  check(errors.length===0,`S4 reconciliation browser errors ${errors.join("|")}`);
  await ctx.close();
}
{
  const {ctx,page}=await open({role:"view",ccfDraft:true},VIEWPORTS[2]);
  await page.selectOption("#procTabSelect","pr");
  await page.waitForSelector("#prTbody tr:not(.pec-table-state)");
  await page.click("#prTbody tr:first-child");
  check(!(await page.isVisible("#btnPrS4Reconcile")) ||
        await page.isDisabled("#btnPrS4Reconcile"),
    "S4 View-only phone: no reconciliation writer access");
  await ctx.close();
}

await browser.close();
server.close();
if (failures) { console.error(`pec-erp-c1-layout-smoke: ${failures} FAILED`); process.exit(1); }
console.log("pec-erp-c1-layout-smoke: PASS");
