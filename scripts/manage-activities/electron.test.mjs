// Real Electron renderer checks (Electron's own Chromium + the app's main.js static server) against the in-memory fake.
// Skipped when Electron or a display is unavailable (run via `xvfb-run -a node --test ...` on headless Linux).
// Uses a genuine BrowserWindow at 390px / 1280px, NOT device emulation (emulation crops screenshots and is not representative).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const exe = path.join(root, "node_modules/electron/dist", process.platform === "win32" ? "electron.exe" : "electron");
let _electron = null;
try { _electron = createRequire(import.meta.url)("playwright")._electron; } catch { /* skip */ }
const SK = !_electron ? "Playwright unavailable" : !fs.existsSync(exe) ? "Electron binary not installed" : (process.platform === "linux" && !process.env.DISPLAY) ? "no display (use xvfb-run)" : false;
const base = "http://localhost:3000";
let app = null, ctx = null;

async function openWindow({ width, view = true, edit = true, n = 40 }) {
  if (!app) {
    app = await _electron.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-gpu", "main.js"], cwd: root });
    const first = await app.firstWindow(); ctx = first.context();
    await ctx.route("https://esm.sh/**", (r) => r.fulfill({ contentType: "text/javascript", body: `import { createFake } from "${base}/scripts/manage-activities/fake-supabase.mjs"; export const createClient = () => createFake(window.__cfg);` }));
    await ctx.route("**/js/activities.js", async (r) => { const resp = await r.fetch(); r.fulfill({ response: resp, body: "await window.__pending;\n" + (await resp.text()) }); });
  }
  await ctx.addInitScript(({ view, edit, n }) => {
    if (!location.pathname.endsWith("manage-activities.html")) return;
    window.__pending = import("http://localhost:3000/scripts/manage-activities/fake-supabase.mjs").then((m) => { window.__cfg = { data: m.makeData(n), perms: { list: m.permList(view, edit), edit } }; });
  }, { view, edit, n });
  const [page] = await Promise.all([ctx.waitForEvent("page"), app.evaluate(({ BrowserWindow }, w) => { const win = new BrowserWindow({ width: w, height: 800, useContentSize: true, webPreferences: { contextIsolation: true } }); win.loadURL("http://localhost:3000/manage-activities.html"); }, width)]);
  return page;
}
test.after(async () => { await app?.close(); });
const rect = (p, s) => p.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height, vw: document.documentElement.clientWidth, vh: innerHeight }; }, s);

const inVp = (b, tol = 1) => b.l >= -tol && b.r <= b.vw + tol && b.t >= -tol && b.b <= b.vh + tol;
for (const width of [390, 520, 768, 1280]) {
  test(`Electron renderer ${width}px: ${width <= 520 ? "cards" : "table"}, controls, popover/modals inside viewport, keyboard`, { skip: SK }, async () => {
    const page = await openWindow({ width });
    await page.waitForSelector("#existingTable tbody tr", { state: "attached", timeout: 20000 });
    assert.ok(/Electron/.test(await page.evaluate(() => navigator.userAgent)));
    assert.equal(await page.evaluate(() => innerWidth), width, "genuine window width");
    for (const s of ["#homeBtn", "#maNewBtn", "#maFilterBtn", "#nameFilter"]) { const b = await rect(page, s); assert.ok(b.l >= -1 && b.r <= b.vw + 1 && b.w > 0, `${s} ${JSON.stringify(b)}`); }
    const home = await page.evaluate(() => { const c = getComputedStyle(document.querySelector("#homeBtn")); const d = document.createElement("div"); d.style.background = "var(--sasv-action-home-bg)"; document.body.appendChild(d); const t = getComputedStyle(d).backgroundColor; d.remove(); return [c.backgroundColor, t]; });
    assert.equal(home[0], home[1], "amber HOME token");
    const seen = new Set(); await page.focus("#homeBtn");
    for (let i = 0; i < 8; i++) { seen.add(await page.evaluate(() => document.activeElement.id)); await page.keyboard.press("Tab"); }
    for (const id of ["homeBtn", "maNewBtn", "maFilterBtn", "nameFilter"]) assert.ok(seen.has(id), id);
    const narrow = width <= 520;
    assert.equal(await page.isVisible("#maCards"), narrow); assert.equal(await page.isVisible("#existingTable"), !narrow);
    if (!narrow) {
      await page.focus(".ma-table-wrap"); for (let i = 0; i < 40; i++) await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => { const w = document.querySelector(".ma-table-wrap"); return w.scrollLeft >= w.scrollWidth - w.clientWidth - 1; }, null, { timeout: 5000 }).catch(() => {});
      const t = await page.evaluate(() => { const w = document.querySelector(".ma-table-wrap").getBoundingClientRect(); const l = document.querySelector("#existingTable thead th:last-child").getBoundingClientRect(); return { lr: l.right, ll: l.left, wr: w.right, wl: w.left, x: scrollX, doc: document.documentElement.scrollWidth, vw: innerWidth }; });
      assert.ok(t.ll >= t.wl - 1 && t.lr <= t.wr + 1, `final column visible ${JSON.stringify(t)}`);
      assert.equal(t.x, 0); assert.ok(t.doc <= t.vw + 1);
    } else {
      await page.focus("#maCards .ma-card"); await page.keyboard.press("Enter");
      await page.waitForSelector("#maDlgTitle"); assert.equal(await page.textContent("#maDlgTitle"), "Activity details");
      assert.ok(inVp(await rect(page, ".ma-dialog-backdrop .ma-modal")));
      await page.keyboard.press("Escape");
    }
    // filters: popover (desktop) / full-screen modal (narrow)
    await page.click("#maFilterBtn");
    const d = await rect(page, "#maDrawer"); assert.ok(inVp(d), `filters ${JSON.stringify(d)}`);
    if (narrow) assert.ok(d.w >= d.vw - 1 && d.h >= d.vh - 1, "full-screen");
    else { const fb = await rect(page, "#maFilterBtn"); assert.ok(Math.abs(d.l - fb.l) <= 2 && d.w <= 361, "anchored compact popover"); }
    for (let i = 0; i < 10; i++) await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => !!document.activeElement.closest("#maDrawer")));
    await page.keyboard.press("Escape");
    assert.equal(await page.isVisible("#maDrawer"), false);
    // Add activities modal
    await page.click("#maNewBtn");
    const m = await rect(page, "#maBulk"); assert.ok(inVp(m), `add modal ${JSON.stringify(m)}`);
    if (narrow) assert.ok(m.w >= m.vw - 1 && m.h >= m.vh - 1, "full-screen");
    for (let i = 0; i < 40; i++) await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => !!document.activeElement.closest("#maBulk")));
    for (const sel of ["#maAddRow", "#maPasteBtn", "#multiClearBtn", "#multiAddBtn"]) { const b = await rect(page, sel); assert.ok(b.b <= b.vh + 1 && b.r <= b.vw + 1 && b.l >= -1, `${sel} ${JSON.stringify(b)}`); }
    await page.keyboard.press("Escape");
    assert.equal(await page.isVisible("#maBulk"), false);
    await page.close().catch(() => {});
  });
}

// MA-UX-4 — genuine-Electron checks: header description breakpoint and narrow full-screen dialogs.
for (const width of [390, 520, 768, 1280]) {
  test(`Electron renderer ${width}px: header description ${width <= 520 ? "hidden" : "shown"}; dialogs ${width <= 520 ? "full-screen" : "floating"} with pinned header/footer`, { skip: SK }, async () => {
    const page = await openWindow({ width });
    await page.waitForSelector("#existingTable tbody tr", { state: "attached", timeout: 20000 });
    const narrow = width <= 520;
    assert.equal(await page.isVisible(".ma-page-sub"), !narrow);
    if (!narrow) assert.equal((await page.innerText(".ma-page-sub")).trim(), "Maintain production activities, classifications and standard durations.");
    const target = narrow ? '#maCards li[data-id="1"] .ma-card' : '#existingTable tr[data-id="1"] .ma-name-link';
    const geom = (sel) => page.evaluate((sel) => { const m = document.querySelector(sel); const r = m.getBoundingClientRect(); const hd = m.querySelector(".ma-modal-header,.ma-popover-header").getBoundingClientRect(); const ft = m.querySelector(".ma-modal-footer,.ma-popover-footer").getBoundingClientRect(); const body = m.querySelector(".ma-modal-body,.ma-popover-body"); return { l: r.left, t: r.top, w: r.width, h: r.height, vw: document.documentElement.clientWidth, vh: innerHeight, radius: getComputedStyle(m).borderTopLeftRadius, hdTop: hd.top, ftBottom: ft.bottom, ov: getComputedStyle(body).overflowY, x: !!m.querySelector(".ma-x svg"), over: document.documentElement.scrollWidth - innerWidth }; }, sel);
    const check = (g, label) => {
      assert.ok(g.x, `${label} X`); assert.ok(g.over <= 1, `${label} overflow`); assert.ok(["auto", "scroll"].includes(g.ov));
      if (narrow) { assert.ok(Math.abs(g.l) <= 1 && Math.abs(g.t) <= 1 && Math.abs(g.w - g.vw) <= 1 && Math.abs(g.h - g.vh) <= 1, `${label} fills viewport ${JSON.stringify(g)}`); assert.equal(g.radius, "0px"); assert.ok(g.hdTop <= 1 && Math.abs(g.ftBottom - g.vh) <= 1, `${label} pinned`); }
      else { assert.ok(g.l >= 0 && g.l + g.w <= g.vw + 1 && g.t >= 0 && g.t + g.h <= g.vh + 1, `${label} inside`); assert.notEqual(g.radius, "0px"); }
    };
    const D = ".ma-dialog-backdrop .ma-modal";
    await page.click(target); check(await geom(D), "details");
    await page.click('[data-act="edit"]'); check(await geom(D), "edit");
    await page.keyboard.press("Escape"); await page.waitForSelector(".ma-detail-list");
    await page.click('[data-act="delete"]'); check(await geom(D), "delete");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => window.__cfg.data.activities.length), 40, "Escape never deletes");
    await page.keyboard.press("Escape");
    await page.click("#maNewBtn"); check(await geom("#maBulk"), "add");
    await page.click("#maPasteBtn"); check(await geom(D), "paste");
    await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
    await page.click("#maFilterBtn"); check(await geom("#maDrawer"), "filter");
    await page.keyboard.press("Escape");
    await page.close().catch(() => {});
  });
}
