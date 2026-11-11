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
  return `
const S = ${JSON.stringify(scenario)};
const long = "Aqueous extract of Terminalia chebula fruit pericarp standardised grade A — long item name to exercise wrapping without clipping";
const indents = Array.from({ length: 5 }, (_, i) => ({
  indent_id: 100 + i, indent_number: "IND-26-" + (100 + i), status: i % 2 ? "approved" : "draft",
  approved_date: i % 2 ? "2026-11-0" + (i + 1) : null, material_class_id: 1, material_class_code: "RM",
  line_count: 3, total_remaining_qty: 5, ...(S.indentDate ? { indent_date: "2026-10-2" + i } : {}),
}));
const data = {
  proc_pec_indent_headers: S.empty ? [] : indents,
  proc_pec_pr_headers: S.empty ? [] : [{ pr_id: 1, pr_number: "PR-1", status: "active", effective_from_date: "2026-11-01", material_class_id: 1, line_count: 2 }],
  proc_pec_purchase_excess: S.empty ? [] : [{ purchase_fact_id: 1, voucher_number: "V-1", voucher_date: "2026-11-02", stock_item_name: long, material_class_code: "RM", purchase_qty: 10, allocated_qty: 4, unallocated_qty: 6, accepted_qty: 0, net_unallocated_qty: 6 }],
  proc_pec_excess_acceptance_audit: [],
  proc_pec_buylist_material_class_options: [], proc_pec_buylist_rm_scope_options: [],
  proc_pec_sourcing_decisions: [], proc_pec_vendor_details: [],
};
const mk = (d) => ({ data: d, error: null });
export const supabase = {
  auth: { getSession: async () => ({ data: { session: { user: { id: "fixture-user" } } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  rpc: async (name) => {
    if (S.failReads && (name.startsWith("proc_pec_") || name === "proc_procurement_action_queue_paged")) return { data: null, error: { message: "fixture failure" } };
    if (name === "get_user_permissions") return mk(S.role === "none" ? [] : [{ target: "module:procurement-execution-console", can_view: true, can_edit: S.role === "edit" }]);
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

await browser.close();
server.close();
if (failures) { console.error(`pec-erp-c1-layout-smoke: ${failures} FAILED`); process.exit(1); }
console.log("pec-erp-c1-layout-smoke: PASS");
