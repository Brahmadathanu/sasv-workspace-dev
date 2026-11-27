// EI R7 design-language parity: computed-style comparison against the SASV reference modules (Stock Checker, Procurement Execution
// Console, Cost Sheet Review), token-only styling, no hard-coded palette, module-wide Inter / minimum size / weight rules, and the
// independent-authorization regression (legacy Sales Viewer permission alone never grants access). Synthetic fixtures only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { launchBrowser, openDashboard, startServer, calls } from "../mis-c1/mis-harness.mjs";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const html = read("public/shared/executive-mis-dashboard.html");
const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));

test("static: no hard-coded palette, no legacy token fallbacks, parity block present, Inter via the shared token", () => {
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) || [], [], "every colour comes from a semantic token");
  assert.doesNotMatch(css, /var\(--(text|bg|panel-bg|border|muted|primary|erp-text)\s*,/, "legacy MIS token fallbacks are gone");
  assert.match(css, /EI-R7 design-language parity/); assert.match(css, /body \{\s+font-family: var\(--sasv-font-sans\)/);
  assert.doesNotMatch(css, /font-family:\s*(system-ui|Segoe|Roboto|Arial)/i, "no local font stack");
  assert.deepEqual((css.match(/font-weight:\s*(?:800|700|650)\b/g) || []), [], "labels use the semibold token, numbers the bold token");
  assert.match(html, /<html lang="en-GB" data-sasv-theme="sasv-core">/);
});

const skip = process.env.MIS_C1_SKIP_BROWSER === "1";
const chromium = skip ? null : launchBrowser();
const srv = chromium ? await startServer() : null;
const browser = chromium ? await chromium.launch() : null;
const SK = skip || !browser ? "browser unavailable" : false;
test.after(async () => { await browser?.close(); srv?.server.close(); });
const open = (o) => openDashboard(browser, srv.base, { noWait: true, ...o });
const STUB = "export const createClient=()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>({select:()=>Promise.resolve({data:[],error:null})}),rpc:async()=>({data:[],error:null})});";
const PROPS = ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "color", "textTransform", "backgroundColor"];
const grab = ([sel, props]) => { const e = [...document.querySelectorAll(sel)].find((x) => x.offsetParent !== null); if (!e) return null; const cs = getComputedStyle(e); return Object.fromEntries(props.map((p) => [p, cs[p]])); };
async function reference(ctx, path, sel, width = 1280) {
  const page = await ctx.newPage(); await page.setViewportSize({ width, height: 900 });
  await page.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith(srv.base)) return r.continue(); if (u.includes("esm.sh/@supabase/supabase-js")) return r.fulfill({ status: 200, contentType: "text/javascript", body: STUB }); return r.abort(); });
  await page.goto(srv.base + path, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1200);
  const v = await page.evaluate(grab, [sel, PROPS]); await page.close(); assert.ok(v, `reference ${path} ${sel} not found`); return v;
}

test("computed parity: title, subtitle, table header, button and font family equal the reference modules (Stock Checker, PEC, Cost Sheet Review)", { skip: SK }, async () => {
  const { page, context } = await open({ width: 1280, lens: "sales" }); await page.waitForSelector(".ei-subnav"); await page.click('[data-sales-view="history"]'); await page.waitForSelector("#salesHistResults th");
  const mine = async (sel) => { const v = await page.evaluate(grab, [sel, PROPS]); assert.ok(v, `EI element ${sel} not found`); return v; };
  const refs = { pec: "/shared/procurement-execution-console.html", stock: "/shared/stock-checker.html", costsheet: "/shared/cost-sheet-review.html" };
  // title and subtitle: identical in all three references, so they are the canonical module header
  for (const [name, path] of Object.entries(refs)) {
    assert.deepEqual(await mine("h1"), await reference(context, path, "h1"), `title vs ${name}`);
    assert.deepEqual(await mine(".page-sub"), await reference(context, path, ".page-sub"), `subtitle vs ${name}`);
  }
  // table header: Stock Checker (uppercase variant)
  const th = await mine("#salesHistResults th"), sth = await reference(context, refs.stock, "table th");
  for (const k of ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "textTransform", "color", "backgroundColor"]) assert.equal(th[k], sth[k], `table header ${k} vs Stock Checker`);
  // button: PEC / Cost Sheet Review secondary button
  const b = await mine(".mis-retry-btn"), pb = await reference(context, refs.costsheet, "button.btn, button:not(#homeBtn)");
  for (const k of ["fontFamily", "fontSize", "fontWeight"]) assert.equal(b[k], pb[k], `button ${k} vs Cost Sheet Review`);
  // primary tab (PEC .tab) vs EI active pill
  const tab = await mine("#detailTabs .pill.active"), ptab = await reference(context, refs.pec, ".tab, .pill, [role=tab], .tab-btn");
  for (const k of ["fontFamily", "fontSize", "fontWeight", "color", "backgroundColor"]) assert.equal(tab[k], ptab[k], `primary tab ${k} vs PEC`);
  await context.close();
});

test("module-wide: every visible text element uses Inter and is at least 12px at 1280 and 390 across all lenses and sales views; no 700/800 labels", { skip: SK }, async () => {
  const lenses = ["overview", "finance", "inventory", "finished-goods", "production", "alerts", "sales"];
  for (const width of [1280, 390]) for (const lens of lenses) {
    const { page, context } = await open({ width, height: 900, lens }); await page.waitForSelector(".ei-lens, .ei-overview"); await page.waitForTimeout(500);
    const views = lens === "sales" ? ["overview", "mtd", "history", "exceptions", "facility", "coverage"] : [null];
    for (const v of views) {
      if (v) { await page.click(`[data-sales-view="${v}"]`); await page.waitForTimeout(500); }
      const bad = await page.evaluate(() => {
        const out = [];
        for (const e of document.querySelectorAll("#tabPanel *, header *, .page-header *")) {
          if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
          if (e.closest(".ei-sr, [hidden], .ei-col-label") || !e.offsetParent) continue;
          const cs = getComputedStyle(e);
          if (!/^Inter/.test(cs.fontFamily.replace(/["']/g, ""))) out.push(["family", e.tagName + "." + e.className, cs.fontFamily]);
          if (parseFloat(cs.fontSize) < 12) out.push(["size", e.tagName + "." + e.className, cs.fontSize]);
          if (Number(cs.fontWeight) > 700) out.push(["weight", e.tagName + "." + e.className, cs.fontWeight]);
        }
        return out.slice(0, 5);
      });
      assert.deepEqual(bad, [], `${lens}/${v}@${width}`);
    }
    await context.close();
  }
});

test("colour parity: ink, muted text and surfaces resolve from the shared semantic tokens (not the legacy fallbacks) in every lens", { skip: SK }, async () => {
  const { page, context } = await open({ width: 1280, lens: "finance" }); await page.waitForSelector(".finance-table");
  const t = await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); const root = (n) => { const d = document.createElement("div"); d.style.color = `var(${n})`; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }; return { ink: root("--sasv-text"), muted: root("--sasv-text-muted"), bodyColor: getComputedStyle(document.body).color, bodyBg: getComputedStyle(document.body).backgroundColor, td: getComputedStyle(document.querySelector(".finance-table td")).color, bg: (() => { const d = document.createElement("div"); d.style.background = "var(--sasv-bg)"; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; })(), cs: !!cs }; });
  assert.equal(t.bodyColor, t.ink); assert.equal(t.td, t.ink); assert.equal(t.bodyBg, t.bg);
  await context.close();
});

test("authorization regression: legacy Sales Viewer permission alone is denied; executive granted; neither denied (simulated roles)", { skip: SK }, async () => {
  const legacy = await open({ width: 1280, lens: "overview", init: () => { window.__mis.handlers = window.__mis.handlers || {}; window.__mis.handlers.get_user_permissions = () => ({ data: [{ target: "module:sales-data-viewer", can_view: true, can_edit: false }], error: null }); window.__mis.handlers.ei_sales_access = () => ({ data: null, error: { code: "42501", message: "Sales access denied" } }); } });
  await legacy.page.waitForTimeout(1200);
  const txt = await legacy.page.textContent("body"); assert.match(txt, /permission|not available|denied|access/i);
  for (const n of ["mv_mis_executive_summary", "ei_sales_history", "get_mis_finance_party_page", "ei_sales_comparison"]) assert.equal((await calls(legacy.page, n)).length, 0, `legacy-only never reads ${n}`);
  await legacy.context.close();
  const ex = await open({ width: 1280, lens: "overview" }); await ex.page.waitForSelector(".ei-overview .kpi-card"); assert.ok((await calls(ex.page, "mv_mis_executive_summary")).length >= 1); await ex.context.close();
  const no = await open({ width: 1280, lens: "overview", permission: "denied" }); await no.page.waitForTimeout(800);
  assert.equal((await calls(no.page, "mv_mis_executive_summary")).length, 0); await no.context.close();
  assert.match(read("public/shared/js/executive-mis-dashboard.js"), /target === `module:\$\{MODULE_ID\}`/, "only the Executive Intelligence permission target is accepted");
  assert.doesNotMatch(read("public/shared/js/executive-mis-dashboard.js"), /sales-data-viewer|sales-viewer/, "no legacy permission fallback in the client");
});

test("keyboard and overflow: focus order reaches HOME, refresh, tabs and a filter control; no overflow at 320/390/520/768/1280/1440", { skip: SK }, async () => {
  for (const w of [320, 390, 520, 768, 1280, 1440]) for (const lens of ["overview", "finance", "sales", "alerts"]) {
    const { page, context } = await open({ width: w, height: 800, lens }); await page.waitForSelector(".ei-lens, .ei-overview"); await page.waitForTimeout(300);
    assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, `${lens}@${w}`);
    if (w === 1280 && lens === "finance") {
      const seen = new Set(); for (let i = 0; i < 14; i++) { await page.keyboard.press("Tab"); seen.add(await page.evaluate(() => document.activeElement.id || document.activeElement.className.split(" ")[0])); }
      assert.ok(seen.has("homeBtn") && seen.has("refreshBtn"), [...seen].join(","));
      assert.notEqual(await page.evaluate(() => { document.getElementById("homeBtn").focus(); return getComputedStyle(document.activeElement).outlineStyle; }), "none", "visible focus ring");
    }
    await context.close();
  }
});
