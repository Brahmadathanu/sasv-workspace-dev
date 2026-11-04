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
const rect = (p, s) => p.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight }; }, s);

for (const width of [390, 1280]) {
  test(`Electron renderer ${width}px: key controls visible, table reaches final column, dialogs inside viewport`, { skip: SK }, async () => {
    const page = await openWindow({ width });
    await page.waitForSelector("#existingTable tbody tr", { timeout: 20000 });
    assert.ok(/Electron/.test(await page.evaluate(() => navigator.userAgent)));
    assert.equal(await page.evaluate(() => innerWidth), width, "genuine window width");
    for (const s of ["#homeBtn", "#maNewBtn", "#maFilterBtn", "#nameFilter"]) { const b = await rect(page, s); assert.ok(b.l >= -1 && b.r <= b.vw + 1 && b.w > 0, `${s} ${JSON.stringify(b)}`); }
    // keyboard: Tab reaches each control
    const seen = new Set(); await page.focus("#homeBtn");
    for (let i = 0; i < 8; i++) { seen.add(await page.evaluate(() => document.activeElement.id)); await page.keyboard.press("Tab"); }
    for (const id of ["homeBtn", "maNewBtn", "maFilterBtn", "nameFilter"]) assert.ok(seen.has(id), id);
    // horizontal scroll inside the container to the final column
    await page.focus(".ma-table-wrap"); for (let i = 0; i < 40; i++) await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => { const w = document.querySelector(".ma-table-wrap"); return w.scrollLeft >= w.scrollWidth - w.clientWidth - 1; }, null, { timeout: 5000 }).catch(() => {});
    const t = await page.evaluate(() => { const w = document.querySelector(".ma-table-wrap").getBoundingClientRect(); const l = document.querySelector("#existingTable thead th:last-child").getBoundingClientRect(); return { lr: l.right, ll: l.left, wr: w.right, wl: w.left, x: scrollX, doc: document.documentElement.scrollWidth, vw: innerWidth }; });
    assert.ok(t.ll >= t.wl - 1 && t.lr <= t.wr + 1, `final column visible ${JSON.stringify(t)}`);
    assert.equal(t.x, 0); assert.ok(t.doc <= t.vw + 1);
    // drawer + dialogs
    await page.click("#maFilterBtn");
    const d = await rect(page, "#maDrawer"); assert.ok(d.l >= -1 && d.r <= d.vw + 1 && d.b <= d.vh + 1, `drawer ${JSON.stringify(d)}`);
    for (let i = 0; i < 9; i++) await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => !!document.activeElement.closest("#maDrawer")));
    await page.keyboard.press("Escape");
    await page.click('tr[data-id="1"] .ma-name-link');
    let m = await rect(page, ".sasv-modal"); assert.ok(m.l >= -1 && m.r <= m.vw + 1 && m.b <= m.vh + 1, `details ${JSON.stringify(m)}`);
    await page.click('[data-act="edit"]');
    m = await rect(page, ".sasv-modal"); assert.ok(m.l >= -1 && m.r <= m.vw + 1, `edit ${JSON.stringify(m)}`);
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    assert.ok(await page.evaluate(() => !!document.activeElement.closest(".sasv-modal")));
    await page.keyboard.press("Escape");
    await page.close().catch(() => {});
  });
}
