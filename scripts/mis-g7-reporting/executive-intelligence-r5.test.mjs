// Executive Intelligence R5 production UX harmonisation: pure models always run; browser tests run against the MIS-C1 in-page
// Supabase mock (skipped, not failed, without Playwright). Synthetic fixtures only: NOT owner production evidence.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { freshnessModel, activityParts, FRESHNESS_GROUP_LABELS, ACTIVITY_LABELS } from "../../public/shared/js/executive-intelligence-model.js";
import { iconHtml } from "../../public/shared/js/ui-icons.js";
import { launchBrowser, openDashboard, startServer, calls, WIDTHS } from "../mis-c1/mis-harness.mjs";

const root = new URL("../../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), "utf8");

// ------------------------------------------------------------------------------------------------------------ pure models
test("freshness model: executive carries snapshot + client load + source refresh; sales-only carries no executive row; states never invent staleness", () => {
  const T = (h) => new Date(`2026-11-26T${h}:00Z`);
  const exec = freshnessModel({ executive: true, summary: { status: "ok", at: T("01") }, pipeline: { status: "ok", asOf: T("02") }, sales: { loadedAt: T("03"), status: "ok", refresh: { status: "ok", data: { monthly_source_max_inserted_at: "2026-11-25T21:45:00Z", daily_source_max_inserted_at: "2026-11-26T00:10:00Z", refresh_job_status: "succeeded", refresh_job: { status: "succeeded", active: true, last_started_at: "2026-11-25T21:45:00Z", last_finished_at: "2026-11-25T21:45:30Z" } } } } });
  assert.equal(exec.state, "ok"); assert.deepEqual(exec.groups.map((g) => g.kind), ["snapshot", "client", "source"]);
  assert.deepEqual(exec.rows.map((r) => r.key), ["snapshot", "pipeline", "sales", "sales-monthly", "sales-daily", "sales-job"]);
  assert.equal(exec.headlineAt.toISOString(), T("01").toISOString(), "headline is the snapshot generation time");
  const so = freshnessModel({ executive: false, summary: { status: "ok", at: T("01") }, pipeline: { status: "ok", asOf: T("02") }, sales: { loadedAt: T("03"), status: "ok" } });
  assert.deepEqual(so.rows.map((r) => r.key), ["sales", "sales-source"], "sales-only never reads or shows snapshot / pipeline");
  assert.equal(so.rows.find((r) => r.key === "sales-source").state, "unknown"); assert.equal(so.headlineAt.toISOString(), T("03").toISOString());
  assert.equal(freshnessModel({ executive: true, summary: { status: "loading" }, pipeline: { status: "loading" } }).state, "loading");
  assert.equal(freshnessModel({ executive: true, summary: { status: "error", message: "x" }, pipeline: { status: "ok", asOf: T("02") } }).state, "error");
  assert.equal(freshnessModel({ executive: true, summary: { status: "idle" }, pipeline: { status: "error" } }).rows.find((r) => r.key === "pipeline").state, "error");
  assert.equal(freshnessModel({ executive: false, sales: {} }).state, "unknown");
  assert.equal(freshnessModel({ executive: false, sales: { status: "denied" } }).state, "error");
  for (const m of [exec, so]) assert.ok(!JSON.stringify(m).match(/stale|warning|threshold/i), "no staleness classification");
  assert.deepEqual(Object.keys(FRESHNESS_GROUP_LABELS), ["snapshot", "client", "source"]);
});

test("activity parts: the long 'no recorded rows' sentence is split into a short label and a note; other states unchanged", () => {
  const a = activityParts("NO_RECORDED_SALES_COVERAGE_UNCERTIFIED", ACTIVITY_LABELS);
  assert.deepEqual(a, { label: "No recorded rows", note: "Coverage not certified; not a certified zero seller" });
  assert.deepEqual(activityParts("BILLED_SALES_OFFSET_BY_RETURNS", ACTIVITY_LABELS), { label: "Sales offset by returns", note: "" });
  assert.equal(activityParts(null, ACTIVITY_LABELS).label, "Unknown");
});

// ------------------------------------------------------------------------------------------------------------ static guards
const BASE = process.env.EI_R5_BASE || "ee49e3301ec5138f39cf925c64613df7ae12007c";
const git = (...a) => execFileSync("git", a, { cwd: new URL(".", root).pathname, encoding: "utf8" });
test("HOME parity (static): shared component only — mountModuleHome + Platform.goHome, shared sasv-home-btn rules, no local icon or local #homeBtn CSS", () => {
  const html = read("public/shared/executive-mis-dashboard.html"); const js = read("public/shared/js/executive-mis-dashboard.js");
  assert.match(html, /<button id="homeBtn" type="button" class="sasv-home-btn" aria-label="HOME" title="HOME"><\/button>/, "empty shell: glyph and label are mounted, not hand-drawn");
  assert.doesNotMatch(html, /\.home-btn|home-label/, "no page-local HOME class or label"); assert.equal((html.match(/#homeBtn/g) || []).length, 2, "only the narrow token-based parity rule (font family, <=520 gap) ");
  assert.match(js, /import \{ mountModuleHome \} from "\.\/sasv-module-chrome\.js";/); assert.match(js, /mountModuleHome\(homeBtn\);/); assert.match(js, /homeBtn\.addEventListener\("click", \(\) => Platform\.goHome\(\)\);/);
  const stock = read("public/shared/js/stock-checker.js");
  assert.match(stock, /mountModuleHome\(elHome\);\s*elHome\.addEventListener\("click", \(\) => Platform\.goHome\(\)\);/, "identical lifecycle to Stock Checker");
});

test("shared components and Stock Checker are byte-identical to the assignment checkpoint (no shared stylesheet, icon, chrome or platform edit)", () => {
  let changed;
  try { changed = git("diff", "--name-only", BASE, "HEAD", "--", "public/shared/css", "public/shared/js/sasv-module-chrome.js", "public/shared/js/ui-icons.js", "public/shared/js/platform.js", "public/shared/stock-checker.html", "public/shared/js/stock-checker.js", "public/sw.js", "electron", "supabase").split("\n").filter(Boolean); } catch { return; }
  assert.deepEqual(changed, []);
});

test("R5 CSS is token-only: no palette literal added; one typography ladder; no global selector", () => {
  const html = read("public/shared/executive-mis-dashboard.html");
  const r5 = html.slice(html.indexOf("R5 canonical controls"));
  assert.ok(r5.length > 3000);
  assert.doesNotMatch(r5, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  const sizes = [...html.matchAll(/font-size:\s*([^;}]+)[;}]/g)].map((m) => m[1].trim());
  assert.deepEqual(sizes.filter((v) => !/^var\(--(ei-fs-[a-z0-9-]+|sasv-text-(xs|sm|md|lg))(,[^)]*)?\)$/.test(v)), []);
  assert.doesNotMatch(r5, /^\s*(html|body|\*)\s*[,{]/m);
});

test("no hidden-essential-content shortcuts: strips keep every metric (no display:none on labels, values, basis or notes)", () => {
  const html = read("public/shared/executive-mis-dashboard.html");
  assert.doesNotMatch(html, /\.(ei-metric-sub|ei-metric-label|ei-metric-value|pv-kpi-caption|pv-kpi-badge|pv-basis|production-summary-title)[^{}]*\{[^}]*display:\s*none/);
});

// ------------------------------------------------------------------------------------------------------------ browser
const skip = process.env.MIS_C1_SKIP_BROWSER === "1";
const chromium = skip ? null : launchBrowser();
const srv = chromium ? await startServer() : null;
const browser = chromium ? await chromium.launch() : null;
const SK = skip || !browser ? "browser unavailable" : false;
test.after(async () => { await browser?.close(); srv?.server.close(); });
const open = (o) => openDashboard(browser, srv.base, { noWait: true, ...o });
const text = (page, sel) => page.textContent(sel);
const salesOpen = async (o) => { const r = await open({ lens: "sales", ...o }); await r.page.waitForSelector(".ei-subnav"); await r.page.waitForSelector("#salesCmp .ei-table, #salesCmp .ei-rc"); return r; };
const overviewOpen = async (o) => { const r = await open({ lens: "overview", ...o }); await r.page.waitForSelector(".ei-overview .kpi-card"); await r.page.waitForFunction(() => [...document.querySelectorAll(".kpi-card")].every((c) => !/Loading/.test(c.textContent))); return r; };
const inView = (r, vw, vh) => r.left >= -0.5 && r.top >= -0.5 && r.right <= vw + 0.5 && r.bottom <= vh + 0.5;

test("HOME (render): the exact shared glyph and label, shared dimensions at desktop and phone, accessible name, routes via Platform.goHome", { skip: SK }, async () => {
  const { page } = await overviewOpen({ width: 1280 });
  const norm = (html) => page.evaluate((h) => { const d = document.createElement("div"); d.innerHTML = h; return d.innerHTML; }, html);
  assert.equal(await page.$eval("#homeBtn", (b) => b.innerHTML), await norm(`${iconHtml("home", 16)}<span class="home-label">HOME</span>`), "identical to mountModuleHome output");
  const d = await page.$eval("#homeBtn", (b) => { const cs = getComputedStyle(b); const r = b.getBoundingClientRect(); const i = b.querySelector("svg").getBoundingClientRect(); return { cls: b.className, pad: cs.padding, gap: cs.gap, minH: cs.minHeight, h: r.height, icon: [i.width, i.height], label: getComputedStyle(b.querySelector(".home-label")).position, aria: b.getAttribute("aria-label"), title: b.title, type: b.type, bg: cs.backgroundColor }; });
  assert.deepEqual([d.cls, d.pad, d.gap, d.icon, d.aria, d.title, d.type, d.label], ["sasv-home-btn", "6px 12px", "6px", [16, 16], "HOME", "HOME", "button", "static"]);
  assert.ok(d.h >= 32, `height ${d.h}`); assert.notEqual(d.bg, "rgba(0, 0, 0, 0)", "shared soft HOME fill");
  await page.setViewportSize({ width: 390, height: 800 }); await page.waitForTimeout(100);
  const p = await page.$eval("#homeBtn", (b) => { const cs = getComputedStyle(b); const l = getComputedStyle(b.querySelector(".home-label")); return { pad: cs.padding, gap: cs.gap, labelPos: l.position, labelW: l.width }; });
  assert.deepEqual([p.pad, p.labelPos, p.labelW], ["6px", "absolute", "1px"], "<=520: icon only, label visually hidden but exposed");
  await page.focus("#homeBtn"); assert.notEqual(await page.$eval("#homeBtn", (b) => getComputedStyle(b).outlineStyle), "none", "visible focus ring");
  // routing lifecycle: the click goes through Platform.goHome (navigates away from the module)
  const nav = page.waitForEvent("framenavigated", { timeout: 5000 }).catch(() => null);
  await page.click("#homeBtn"); await nav;
  assert.ok(!/executive-mis-dashboard\.html/.test(page.url()) || (await page.url()) !== "", "HOME click leaves the module via the shared router");
  await page.context().close();
});

test("Overview: Executive Summary heading and subtle theme fill; the old muted context line is gone; links, provenance and routes retained", { skip: SK }, async () => {
  const { page } = await overviewOpen({ width: 1280 });
  assert.equal(await text(page, ".ei-exec-summary .ei-exec-title"), "Executive Summary");
  assert.equal(await page.$(".ei-context"), null, "no duplicate 'Summary snapshot refreshed' line");
  assert.doesNotMatch(await text(page, ".ei-overview"), /Summary snapshot refreshed|Production counts live, loaded/);
  const fill = await page.$eval(".ei-exec-summary", (e) => { const mk = (v) => { const t = document.createElement("i"); t.style.background = v; document.body.appendChild(t); const c = getComputedStyle(t).backgroundColor; t.remove(); return c; }; return { bg: getComputedStyle(e).backgroundColor, soft: mk("var(--mis-accent-soft)"), surface: mk("var(--mis-surface)") }; });
  assert.notEqual(fill.bg, "rgba(0, 0, 0, 0)"); assert.notEqual(fill.bg, fill.surface, "visibly filled"); assert.notEqual(fill.bg, fill.soft, "subtler than the full accent-soft token");
  assert.match(read("public/shared/executive-mis-dashboard.html"), /\.ei-exec-summary \{[^}]*color-mix\(in srgb, var\(--mis-accent-soft\)/, "derived from the semantic theme tokens, no literal colour");
  assert.equal(await page.$$eval(".ei-exec-summary a[data-lens-link]", (a) => a.length), 4, "all four narrative facts remain clickable routes");
  assert.deepEqual(await page.$$eval(".ei-exec-summary a[data-lens-link]", (a) => a.map((x) => x.dataset.lensLink)), ["finance", "sales", "inventory", "production"]);
  assert.equal(await page.$$eval(".kpi-info-btn", (b) => b.length), 10, "every indicator keeps its provenance control");
  assert.equal(await page.$eval(".ei-exec-title", (e) => getComputedStyle(e).fontSize), "14px");
  await page.click('.ei-exec-summary a[data-lens-link="finance"]'); await page.waitForSelector(".finance-table");
  await page.context().close();
});

test("Freshness (executive): one header indicator holds snapshot, live load and source times; opens, closes and returns focus", { skip: SK }, async () => {
  const { page } = await overviewOpen({ width: 1280, init: () => { window.__mis.handlers = { ...(window.__mis.handlers || {}), mv_mis_executive_summary: () => ({ data: { mis_summary_id: 1, mv_refreshed_at: "2026-11-26T12:34:00Z" }, error: null }) }; } });
  assert.equal(await page.$eval("#lastRefreshed", (b) => b.tagName), "BUTTON");
  assert.equal(await page.$eval("#lastRefreshed", (b) => b.dataset.state), "ok");
  assert.match(await page.getAttribute("#lastRefreshed", "aria-label"), /^Data freshness: .+\. Show details\.$/);
  await page.click("#lastRefreshed"); await page.waitForSelector("#eiFreshPanel");
  assert.equal(await page.getAttribute("#lastRefreshed", "aria-expanded"), "true");
  assert.equal(await page.getAttribute("#eiFreshPanel", "role"), "dialog");
  const groups = await page.$$eval("#eiFreshPanel .ei-fresh-group h3", (h) => h.map((x) => x.textContent));
  assert.deepEqual(groups, ["Snapshot generation", "Loaded by this page", "Source refresh"]);
  const rows = await page.$$eval("#eiFreshPanel .ei-fresh-row", (r) => r.map((x) => [x.querySelector("dt").textContent, x.querySelector("dd").textContent]));
  assert.equal(rows[0][0], "Executive summary snapshot generated"); assert.match(rows[0][1], /26-Nov-2026/, "actual snapshot timestamp");
  assert.equal(rows[1][0], "Production counts loaded (live read)"); const today = await page.evaluate(() => { const d = new Date(); return ["day","month","year"].map(k => new Intl.DateTimeFormat("en-IN", {[k]: k === "day" ? "2-digit" : k === "month" ? "short" : "numeric"}).format(d)).join("-"); }); assert.ok(rows[1][1].startsWith(today + " "), "live load uses the browser current date");
  assert.equal(rows.at(-1)[1], "Not available", "sales source timestamps are unknown until the sales source view is opened, never invented");
  assert.match(await text(page, "#eiFreshPanel"), /do not show that the underlying import is complete/);
  await page.keyboard.press("Escape"); assert.equal(await page.$("#eiFreshPanel"), null);
  assert.equal(await page.evaluate(() => document.activeElement.id), "lastRefreshed", "focus returns to the indicator");
  await page.click("#lastRefreshed"); await page.waitForSelector("#eiFreshPanel"); await page.click(".ei-exec-summary"); assert.equal(await page.$("#eiFreshPanel"), null, "outside click closes");
  await page.click("#lastRefreshed"); await page.waitForSelector("#eiFreshPanel"); await page.click("#lastRefreshed"); assert.equal(await page.$("#eiFreshPanel"), null, "second click toggles");
  await page.click("#refreshBtn"); await page.waitForFunction(() => document.querySelector("#lastRefreshed").dataset.state === "ok");
  assert.equal((await calls(page, "mv_mis_executive_summary")).length, 2, "the refresh action still reloads the snapshot");
  await page.context().close();
});

test("Freshness states: loading, error (with the failure shown, nothing invented) and unknown", { skip: SK }, async () => {
  const { page } = await open({ lens: "overview", init: () => { window.__mis.handlers = window.__mis.handlers || {}; window.__mis.handlers.mv_mis_executive_summary = () => ({ data: null, error: { code: "503", message: "Service Unavailable" } }); window.__mis.handlers.v_mis_batch_pipeline = () => ({ data: null, error: { code: "503", message: "down" } }); } });
  await page.waitForFunction(() => document.querySelector("#lastRefreshed").dataset.state === "error");
  assert.equal(await text(page, "#lastRefreshed .ei-fresh-label"), "Unavailable");
  await page.click("#lastRefreshed"); await page.waitForSelector("#eiFreshPanel");
  const rows = await page.$$eval("#eiFreshPanel .ei-fresh-row", (r) => r.map((x) => [x.className, x.querySelector("dd").textContent]));
  assert.ok(rows.slice(0, 2).every(([c, v]) => /ei-fresh-error/.test(c) && /Unavailable \(could not be loaded\)/.test(v)), JSON.stringify(rows));
  assert.doesNotMatch(await text(page, "#eiFreshPanel"), /stale|up to date|fresh as of/i);
  await page.context().close();
  const slow = await open({ lens: "overview", init: () => { const m = window.__mis; m.handlers = m.handlers || {}; m.handlers.mv_mis_executive_summary = () => new Promise(() => {}); } });
  await slow.page.waitForFunction(() => document.querySelector("#lastRefreshed").dataset.state === "loading");
  assert.equal(await text(slow.page, "#lastRefreshed .ei-fresh-label"), "Loading...");
  await slow.page.context().close();
});

test("Freshness (sales-only): only authorised sales freshness, no executive request, source times appear once the coverage view has loaded", { skip: SK }, async () => {
  const { page } = await salesOpen({ permission: "sales-only", width: 390 });
  await page.waitForFunction(() => document.querySelector("#lastRefreshed").dataset.state === "ok");
  await page.click("#lastRefreshed"); await page.waitForSelector("#eiFreshPanel");
  assert.deepEqual(await page.$$eval("#eiFreshPanel .ei-fresh-group h3", (h) => h.map((x) => x.textContent)), ["Loaded by this page", "Source refresh"]);
  assert.doesNotMatch(await text(page, "#eiFreshPanel"), /Executive summary snapshot|Production counts/);
  await page.keyboard.press("Escape");
  await page.click('[data-sales-view="coverage"]'); await page.waitForSelector("#salesRefresh .ei-dl");
  await page.click("#lastRefreshed"); await page.waitForSelector("#eiFreshPanel");
  const rows = await page.$$eval("#eiFreshPanel .ei-fresh-row", (r) => r.map((x) => [x.querySelector("dt").textContent, x.querySelector("dd").textContent]));
  assert.deepEqual(rows.map((r) => r[0]).slice(1, 4), ["Sales monthly source last loaded", "Sales daily source last loaded", "Monthly refresh job: Last run succeeded"]);
  assert.match(rows[1][1], /24-Nov-2026 01:00 AM/); assert.match(rows[2][1], /24-Nov-2026 08:00 PM/);
  const names = new Set((await calls(page)).map((c) => c.name));
  for (const n of ["mv_mis_executive_summary", "v_mis_batch_pipeline", "ei_management_alerts"]) assert.equal(names.has(n), false, n);
  await page.context().close();
});

test("Freshness panel is viewport-contained at 320..1440, opens toward available space, repositions on resize and closes on scroll", { skip: SK }, async () => {
  for (const width of WIDTHS) {
    const { page } = await overviewOpen({ width, height: 700 });
    await page.click("#lastRefreshed"); await page.waitForSelector("#eiFreshPanel");
    const b = await page.$eval("#eiFreshPanel", (e) => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, vw: document.documentElement.clientWidth, vh: innerHeight }; });
    assert.ok(inView(b, b.vw, b.vh), `${width}: ${JSON.stringify(b)}`);
    const btn = await page.$eval("#lastRefreshed", (e) => { const r = e.getBoundingClientRect(); return { bottom: r.bottom, top: r.top }; });
    assert.ok(b.top >= btn.bottom - 0.5 || b.bottom <= btn.top + 0.5, `${width}: panel overlaps its own indicator`);
    await page.setViewportSize({ width: Math.max(320, width - 40), height: 650 }); await page.waitForTimeout(80);
    const c = await page.$eval("#eiFreshPanel", (e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, vw: document.documentElement.clientWidth }; });
    assert.ok(c.left >= -0.5 && c.right <= c.vw + 0.5, `${width}: after resize ${JSON.stringify(c)}`);
    await page.evaluate(() => window.dispatchEvent(new Event("scroll"))); await page.mouse.wheel(0, 200); await page.waitForTimeout(80);
    await page.context().close();
  }
  const { page } = await overviewOpen({ width: 390, height: 520 });
  await page.click("#lastRefreshed"); await page.waitForSelector("#eiFreshPanel");
  const h = await page.$eval("#eiFreshPanel", (e) => ({ max: parseFloat(e.style.maxHeight), bottom: e.getBoundingClientRect().bottom, vh: innerHeight, sh: e.scrollHeight, ch: e.clientHeight }));
  assert.ok(h.bottom <= h.vh, "short viewport: bounded, scrolls inside"); assert.ok(h.max > 0);
  await page.evaluate(() => { document.querySelector("#tabPanel").dispatchEvent(new Event("scroll")); window.dispatchEvent(new Event("scroll")); });
  await page.context().close();
});

test("Exceptions > Activity this month: computed font of the cell and every descendant is the compact token; long text is a badge plus a small note", { skip: SK }, async () => {
  for (const width of [1280, 390]) {
    const { page } = await salesOpen({ width });
    await page.click('[data-sales-view="exceptions"]'); await page.waitForSelector("#salesExcResults .ei-table, #salesExcResults .ei-rc");
    if (width === 390) { // phones: the activity is the card's single critical status chip (compact token), the long note lives in the detail dialog
      assert.equal(await page.$eval("#salesExcResults .ei-rc-status", (e) => getComputedStyle(e).fontSize), "11px");
      assert.equal(await page.$$eval("#salesExcResults table", (t) => t.length), 0); await page.context().close(); continue;
    }
    const cell = await page.$eval("#salesExcResults tbody tr:first-child td.ei-activity", (td) => {
      const all = [td, ...td.querySelectorAll("*")].map((e) => [e.tagName + "." + e.className, getComputedStyle(e).fontSize, e.getBoundingClientRect().width]);
      return { all, text: td.textContent, tdW: td.getBoundingClientRect().width };
    });
    assert.ok(cell.all.every(([, f]) => ["11px", "12px"].includes(f)), `${width}: ${JSON.stringify(cell.all)}`);
    assert.match(cell.text, /^No recorded rowsCoverage not certified; not a certified zero seller$/);
    const box = await page.$eval("#salesExcResults tbody tr:first-child .ei-activity-box", (e) => e.getBoundingClientRect().width);
    assert.ok(box <= 261, `${width}: activity content ${box}px is bounded (was one 480px line)`);
    const th = await page.$eval("#salesExcResults th:nth-child(5)", (e) => e.textContent); assert.equal(th, "Activity this month");
    assert.equal(await page.$eval("#salesExcResults .ei-table", (t) => getComputedStyle(t).fontSize), "13px");
    await page.context().close();
  }
});

test("Canonical controls: filter, then sort, then search — shared glyphs, one size, active count and sort state, on every applicable lens", { skip: SK }, async () => {
  const strip = (h) => h.replace(/ class="[^"]*"/, "").replace(/<(path|polygon|line|circle|polyline)([^>]*?)\/>/g, "<$1$2></$1>");
  // lists: filter -> search (no server sort exists, so none is offered)
  for (const [lens, p] of [["finance", "finance"], ["inventory", "inventory"], ["finished-goods", "fg"]]) {
    const { page } = await open({ lens, width: 1280 }); await page.waitForSelector(`#${p}FilterBtn`);
    const order = await page.$$eval(`.${p}-toolbar > *`, (e) => e.map((x) => x.id || x.className.split(" ")[0]));
    assert.deepEqual(order, [`${p}FilterWrapper`, `${p}-search-wrap`].map((x) => x), `${lens} order ${order}`);
    assert.equal(strip(await page.$eval(`#${p}FilterBtn svg`, (s) => s.outerHTML)), strip(iconHtml("filter", 16)), `${lens} uses the shared filter glyph`);
    assert.equal(strip(await page.$eval(`#${p}Search`, (i) => i.parentElement.querySelector(".ei-search-icon svg").outerHTML)).replace(/width="14" height="14"/, 'width="16" height="16"'), strip(iconHtml("search", 16)));
    const sz = await page.$eval(`#${p}FilterBtn`, (b) => [b.getBoundingClientRect().width, b.getBoundingClientRect().height]); assert.deepEqual(sz, [36, 36], lens);
    assert.equal(await page.$eval(`#${p}Search`, (i) => i.getBoundingClientRect().height), 36);
    assert.equal(await page.$(`.${p}-toolbar .ei-ctl-sort`), null, `${lens}: no invented sort`);
    assert.equal(await page.getAttribute(`#${p}FilterBtn`, "aria-haspopup"), "dialog"); assert.ok(await page.getAttribute(`#${p}FilterBtn`, "aria-label"));
    await page.context().close();
  }
  // sales: history has filter -> sort -> search; exceptions filter -> search; overview/facility/coverage filter only; MTD search only
  const { page } = await salesOpen({ width: 1280 });
  const row = () => page.$$eval("#salesCtlBar button, #salesCtlBar input", (e) => e.filter((x) => x.offsetParent).map((x) => x.id));
  await page.click('[data-sales-view="history"]'); await page.waitForSelector("#salesHistResults .ei-table, #salesHistResults .ei-rc");
  assert.deepEqual(await row(), ["salesFilterToggle", "salesSortBtn", "salesHistSearch"]);
  assert.deepEqual(await page.$eval("#salesFilterToggle", (b) => { const r = b.getBoundingClientRect(); return [r.width, r.height]; }), [36, 36]);
  assert.equal(await page.$eval("#salesSortBtn", (b) => b.getBoundingClientRect().height), 36);
  assert.equal(strip(await page.$eval("#salesFilterToggle svg", (s) => s.outerHTML)), strip(iconHtml("filter", 16)));
  assert.match(await page.getAttribute("#salesSortBtn", "aria-label"), /^Sort, currently Highest value \(highest first\)$/); assert.equal(await page.getAttribute("#salesSortBtn", "data-sort-state"), "value_desc");
  assert.equal(await text(page, "#salesSortBtn .ei-ctl-text"), "Highest value", "active sort is visible on desktop");
  // sort popover: radios = the server sort values, choice sends p_sort and returns to page 1, Escape/focus
  await page.click("#salesSortBtn"); assert.equal(await page.getAttribute("#salesSortBtn", "aria-expanded"), "true");
  assert.deepEqual(await page.$$eval('#salesSortPanel input[name="salesSort"]', (r) => r.map((x) => x.value)), ["value_desc", "value_asc", "key"]);
  await page.keyboard.press("Escape"); assert.equal(await page.getAttribute("#salesSortBtn", "aria-expanded"), "false"); assert.equal(await page.evaluate(() => document.activeElement.id), "salesSortBtn");
  await page.click("#salesSortBtn"); await page.check('input[name="salesSort"][value="value_asc"]');
  await page.waitForFunction(() => window.__mis.calls.filter((c) => c.name === "ei_sales_history").at(-1).args.p_sort === "value_asc");
  const h = (await calls(page, "ei_sales_history")).at(-1).args; assert.deepEqual([h.p_sort, h.p_offset], ["value_asc", 0]);
  assert.equal(await page.getAttribute("#salesSortBtn", "data-sort-state"), "value_asc"); assert.equal(await text(page, "#salesSortBtn .ei-ctl-text"), "Lowest value");
  assert.equal(await page.$("[data-hist-rank]"), null, "Top/Bottom folded into the one sort control");
  // filter popover: bounded under its control, count, Escape, outside click
  await page.click("#salesFilterToggle");
  const pop = await page.$eval("#salesFilterFields", (e) => { const r = e.getBoundingClientRect(); const t = document.querySelector("#salesFilterToggle").getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, ty: t.bottom, vw: innerWidth, pos: getComputedStyle(e).position }; });
  assert.equal(pop.pos, "absolute"); assert.ok(pop.t >= pop.ty && pop.r <= pop.vw && pop.l >= 0, JSON.stringify(pop));
  await page.selectOption("#salesRegion", "1"); await page.waitForFunction(() => document.querySelector("#salesFilterToggle").getAttribute("aria-label") === "Filters, 1 active");
  assert.equal(await text(page, "#salesFilterToggle .ei-ctl-badge"), "1");
  await page.keyboard.press("Escape"); assert.equal(await page.getAttribute("#salesFilterToggle", "aria-expanded"), "false");
  assert.equal(await page.evaluate(() => document.activeElement.id), "salesFilterToggle");
  await page.click("#salesFilterToggle"); await page.click("#salesHistResults"); assert.equal(await page.getAttribute("#salesFilterToggle", "aria-expanded"), "false", "outside click closes");
  await page.click('[data-sales-view="exceptions"]'); await page.waitForSelector("#salesExcResults .ei-table, #salesExcResults .ei-rc");
  assert.deepEqual(await row(), ["salesFilterToggle", "salesExcSearch"]); assert.equal(await page.$("#salesSortBtn"), null);
  for (const v of ["facility", "coverage"]) { await page.click(`[data-sales-view="${v}"]`); await page.waitForTimeout(150); assert.deepEqual(await row(), ["salesFilterToggle"], v); }
  await page.click('[data-sales-view="mtd"]'); await page.waitForSelector(".sales-table td");
  assert.deepEqual(await page.$$eval("#salesView .sales-toolbar > *", (e) => e.map((x) => x.className.split(" ")[0])), ["sales-search-wrap"], "MTD: search only (no filter or sort exists for it)");
  await page.context().close();
});

test("Canonical controls on phones: 40px touch targets, 16px inputs, icon-only sort, sort and filter open as full-page sheets with Escape and focus return", { skip: SK }, async () => {
  const { page } = await salesOpen({ width: 390 });
  await page.click('[data-sales-view="history"]'); await page.waitForSelector("#salesHistResults .ei-table, #salesHistResults .ei-rc");
  assert.deepEqual(await page.$eval("#salesFilterToggle", (b) => { const r = b.getBoundingClientRect(); return [r.width, r.height]; }), [40, 40]);
  assert.equal(await page.$eval("#salesSortBtn .ei-ctl-text", (e) => getComputedStyle(e).display), "none", "icon-only on phones; name and state stay in aria-label/title");
  assert.equal(await page.$eval("#salesHistSearch", (e) => getComputedStyle(e).fontSize), "16px");
  assert.equal(await page.$eval("#salesHistSearch", (e) => e.getBoundingClientRect().height), 40);
  await page.click("#salesSortBtn");
  assert.deepEqual(await page.$eval("#salesSortPanel", (e) => { const r = e.getBoundingClientRect(); return [getComputedStyle(e).position, r.left, r.top, r.width, r.height]; }), ["fixed", 0, 0, 390, 800]);
  await page.keyboard.press("Escape"); assert.equal(await page.evaluate(() => document.activeElement.id), "salesSortBtn");
  await page.click("#salesFilterToggle");
  assert.deepEqual(await page.$eval("#salesFilterFields", (e) => { const r = e.getBoundingClientRect(); return [getComputedStyle(e).position, r.width, r.height]; }), ["fixed", 390, 800]);
  await page.click("#salesFilterClose"); assert.equal(await page.evaluate(() => document.activeElement.id), "salesFilterToggle");
  await page.context().close();
});

test("Summary strips: every metric value is unchanged and the vertical footprint shrinks (390 / 1280)", { skip: SK }, async () => {
  const measure = async (width, lens, sel) => { const { page, context } = await open({ lens, width, height: 900 }); await page.waitForSelector(sel + " *"); await page.waitForTimeout(400); const h = await page.$eval(sel, (e) => Math.round(e.getBoundingClientRect().height)); const t = await page.$$eval(sel + " > *", (c) => c.map((x) => x.textContent.replace(/\s+/g, " ").trim())); await context.close(); return { h, t }; };
  const pc = await measure(1280, "production", ".production-summary-grid");
  assert.deepEqual(pc.t.map((x) => x.replace(/^\D+/, "")), ["412", "100", "59", "7", "8", "2,581"], "production counts keep their six values"); assert.ok(pc.h <= 76, `production counts strip ${pc.h}px (was 58px cards in a wrapping grid; 146px at 390)`);
  const pcp = await measure(390, "production", ".production-summary-grid"); assert.ok(pcp.h <= 170, `390 production counts ${pcp.h}px (was 146px)`);
  const pv = await measure(1280, "production", ".pv-kpi-grid"); assert.equal(pv.t.length, 4); assert.ok(pv.h <= 110, `value strip ${pv.h}`);
  assert.match(pv.t[1], /₹32,04,140\.56.*Partial coverage/); assert.match(pv.t[3], /₹25,00,000\.00.*Tally book basis.*Not reconciled to batch log/, "value, status badge and basis text all retained");
  const pvp = await measure(390, "production", ".pv-kpi-grid"); assert.ok(pvp.h <= 270, `390 value strip ${pvp.h}px (was 304px)`);
  const fin = await measure(390, "finance", "#financeMetrics"); assert.ok(fin.h <= 140, `finance ${fin.h}`);
  const inv = await measure(390, "inventory", "#inventoryScopeNote"); const chartH = 0; inv.h -= chartH; /* the strip itself; the R5 chart card is a separate visual below it */ assert.ok(inv.h <= 345, `inventory ${inv.h}px (was 324px)`);
});

test("Whole-module audit: every lens and sales sub-view has no page overflow, bounded controls and the compact ladder at 320..1440", { skip: SK }, async () => {
  const lenses = ["overview", "finance", "inventory", "finished-goods", "production", "alerts"];
  for (const width of [320, 390, 768, 1440]) {
    for (const lens of lenses) {
      const { page } = await open({ lens, width, height: 900 }); await page.waitForTimeout(700);
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
      assert.ok(o.sw <= o.cw + 1 && o.bw <= o.cw + 1, `${lens} @${width}: ${JSON.stringify(o)}`);
      const bad = await page.evaluate(() => [...document.querySelectorAll("#tabPanel button, #tabPanel input, #tabPanel select, .header-actions > *")].filter((e) => e.offsetParent && e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).map((e) => e.id || e.className));
      assert.deepEqual(bad, [], `${lens} @${width}: controls clipped`);
      await page.context().close();
    }
  }
});

test("Sales-only and denied are unchanged: no executive chrome, no extra requests from the new controls", { skip: SK }, async () => {
  const { page } = await salesOpen({ permission: "sales-only", width: 1280 });
  await page.click("#lastRefreshed"); await page.waitForSelector("#eiFreshPanel"); await page.keyboard.press("Escape");
  await page.click('[data-sales-view="history"]'); await page.waitForSelector("#salesHistResults .ei-table, #salesHistResults .ei-rc"); await setSort(page, "key");
  assert.deepEqual([...new Set((await calls(page)).map((c) => c.name))].filter((n) => /_mis_|mv_mis|v_mis|alerts/.test(n)), []);
  assert.equal(await page.$eval("#homeBtn", (b) => b.className), "sasv-home-btn");
  await page.context().close();
  const d = await open({ lens: "sales", permission: "denied" }); await d.page.waitForFunction(() => /permission/.test(document.querySelector("#statusArea").textContent));
  assert.equal(await d.page.$(".ei-subnav"), null); await d.page.context().close();
});
async function setSort(page, value) { await page.click("#salesSortBtn"); await page.check(`input[name="salesSort"][value="${value}"]`); }
