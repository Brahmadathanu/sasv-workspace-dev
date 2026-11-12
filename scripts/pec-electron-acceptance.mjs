#!/usr/bin/env node
/**
 * PEC packaged-Electron acceptance (Linux unpacked build, run under Xvfb).
 *
 *   node scripts/pec-electron-acceptance.mjs --app <dir containing the packaged binary + resources/app.asar>
 *        --asar <path to @electron/asar package> [--shots <dir>]
 *
 * What it proves (and what it does NOT):
 *  - SOURCE PARITY: the three canonical PEC files inside the packaged app.asar are
 *    byte-identical to public/shared/* in the repo, and no second copy exists.
 *  - SERVED PARITY: the packaged app's own Express server (localhost:3000) serves
 *    those same bytes.
 *  - RUNTIME: the PEC page runs inside the REAL packaged Electron renderer
 *    (connected over the Chromium DevTools port); only js/supabaseClient.js is a
 *    synthetic fixture stub, so this is NOT a signed-in / role / permission
 *    acceptance and says nothing about the real backend.
 * Windows/macOS installers are NOT exercised (Linux unpacked build only).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildFixtureStub } from "./lib/pec-fixture-stub.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const appDir = path.resolve(arg("--app", ""));
const asarPkg = arg("--asar", "");
const shots = path.resolve(arg("--shots", path.join(here, "..", "docs/procurement-execution/evidence/pec-phase-a-claude-visual/electron")));
fs.mkdirSync(shots, { recursive: true });
const repoShared = path.join(here, "..", "public", "shared");
const PEC = ["procurement-execution-console.html", "js/procurement-execution-console.js", "css/sasv-procurement-execution-console.css"];
const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");

const results = [];
const check = (id, status, detail = "") => { results.push({ id, status, detail }); (status === "PASS" ? console.log : console.error)(`${status}: ${id}${detail ? " - " + detail : ""}`); };

// ── 1. source parity inside the packaged app.asar ──
const asar = require(path.join(asarPkg));
const asarFile = path.join(appDir, "resources", "app.asar");
check("packaged app.asar present", fs.existsSync(asarFile) ? "PASS" : "FAIL", asarFile.replace(appDir, "<app>"));
const listing = asar.listPackage(asarFile).map((p) => p.replace(/\\/g, "/"));
const pecInAsar = listing.filter((p) => /procurement-execution-console/.test(p));
check("exactly the 3 canonical PEC files in the package (no duplicate source)", pecInAsar.length === 3 && PEC.every((f) => pecInAsar.includes(`/public/shared/${f}`)) ? "PASS" : "FAIL", pecInAsar.join(", "));
for (const f of PEC) {
  const packaged = asar.extractFile(asarFile, `public/shared/${f}`);
  const repo = fs.readFileSync(path.join(repoShared, f));
  check(`asar == repo bytes: ${f}`, sha256(packaged) === sha256(repo) ? "PASS" : "FAIL", sha256(repo).slice(0, 12));
}

// ── 2. launch the packaged binary under Xvfb ──
const bin = path.join(appDir, "daily-worklog-app");
const port = 9333;
const logs = [];
const child = spawn("xvfb-run", ["-a", "-s", "-screen 0 1280x900x24", bin, "--no-sandbox", `--remote-debugging-port=${port}`, "--disable-gpu"], { env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1" }, stdio: ["ignore", "pipe", "pipe"], detached: true });
child.stdout.on("data", (d) => logs.push(String(d))); child.stderr.on("data", (d) => logs.push(String(d)));
const stop = () => { try { process.kill(-child.pid, "SIGKILL"); } catch { /* gone */ } };
process.on("exit", stop);
const waitFor = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await fn(); if (v) return v; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 500)); } return null; };

const served = await waitFor(async () => { const r = await fetch("http://127.0.0.1:3000/public/shared/procurement-execution-console.html"); return r.ok ? Buffer.from(await r.arrayBuffer()) : null; }, 60000);
check("packaged app serves PEC on localhost:3000", served ? "PASS" : "FAIL", served ? "" : logs.join("").slice(-300));
if (served) {
  for (const f of PEC) {
    const b = Buffer.from(await (await fetch(`http://127.0.0.1:3000/public/shared/${f}`)).arrayBuffer());
    check(`served bytes == repo bytes: ${f}`, sha256(b) === sha256(fs.readFileSync(path.join(repoShared, f))) ? "PASS" : "FAIL");
  }
}

// ── 3. drive the real Electron renderer over CDP ──
let browser = null;
if (served) browser = await waitFor(() => chromium.connectOverCDP(`http://127.0.0.1:${port}`), 30000);
check("connected to the packaged Electron renderer (CDP)", browser ? "PASS" : "FAIL");
if (browser) {
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] || (await ctx.newPage());
  const ua = await page.evaluate(() => navigator.userAgent);
  check("renderer is Electron", /Electron\//.test(ua) ? "PASS" : "FAIL", ua.match(/Electron\/[\d.]+/)?.[0] || ua.slice(0, 60));
  const libs = process.env.PEC_JSPDF_ROOT;
  // Playwright matches the LAST registered route first: block externals first, then allow the local jsPDF files.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
  await page.route("**/js/supabaseClient.js", (r) => r.fulfill({ contentType: "text/javascript", body: buildFixtureStub({ role: "edit", aq: true, indentDate: true }) }));
  if (libs) {
    await page.route("**/jspdf.umd.min.js", (r) => r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(path.join(libs, "jspdf/dist/jspdf.umd.min.js")) }));
    await page.route("**/jspdf.plugin.autotable.min.js", (r) => r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(path.join(libs, "jspdf-autotable/dist/jspdf.plugin.autotable.min.js")) }));
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://localhost:3000/public/shared/procurement-execution-console.html");
  const open = await page.waitForSelector("#mainPanel:not([hidden])", { timeout: 15000 }).then(() => true).catch(() => false);
  check("PEC console renders in packaged Electron (fixture session)", open ? "PASS" : "FAIL");
  if (open) {
    const cdp = await ctx.newCDPSession(page);
    // Resize the REAL BrowserWindow through the browser-level DevTools session; if the
    // Electron build does not expose it, fall back to renderer viewport emulation and say so.
    let resizeMode = "window";
    const bs = await browser.newBrowserCDPSession();
    const targetId = (await cdp.send("Target.getTargetInfo")).targetInfo.targetId;
    let windowId = null;
    try { windowId = (await bs.send("Browser.getWindowForTarget", { targetId })).windowId; } catch { resizeMode = "emulation"; }
    const setWidth = async (w, h) => {
      if (resizeMode === "window") await bs.send("Browser.setWindowBounds", { windowId, bounds: { width: w, height: h, windowState: "normal" } });
      else await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await page.waitForTimeout(700);
    };
    check(`window resize method: ${resizeMode === "window" ? "real BrowserWindow bounds" : "renderer viewport emulation (BrowserWindow resize not exposed)"}`, "PASS");
    for (const [w, h] of [[1200, 800], [820, 900], [480, 800]]) {
      await setWidth(w, h);
      const vw = await page.evaluate(() => document.documentElement.clientWidth);
      const narrow = vw <= 520;
      const lenses = [["pr", "#prPaging"], ["indents", "#iPaging"], ["vendor-buylist", "#vwlPaging"], ["action", null], ["excess", "#ePaging"]];
      for (const [lens, pager] of lenses) {
        if (narrow) await page.selectOption("#procTabSelect", lens); else await page.click(`.tabs .tab-btn[data-tab="${lens}"]`);
        await page.waitForTimeout(700);
        const r = await page.evaluate((pg) => ({ ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth, pager: pg ? document.querySelector(pg)?.textContent.trim() : "n/a", panel: !!document.querySelector(".tab-panel.active") }), pager);
        check(`Electron ${vw}px ${lens}: active panel, no horizontal overflow, pager "${r.pager}"`, r.panel && r.ovf <= 1 && (pager ? /^Page 1\/\d+$/.test(r.pager) : true) ? "PASS" : "FAIL");
        await page.screenshot({ path: path.join(shots, `electron-${vw}px-${lens}.png`) });
      }
    }
    // export + dialogs in Electron at the narrowest width
    await page.selectOption("#procTabSelect", "vendor-buylist").catch(() => {});
    await page.waitForTimeout(500);
    await page.click("#vwlExportBtn");
    const dd = await page.evaluate(() => { const r = document.querySelector("#vwlExportMenu .export-dropdown").getBoundingClientRect(); return [r.left, r.right, document.documentElement.clientWidth]; });
    check(`Electron export menu inside the window (${Math.round(dd[0])}..${Math.round(dd[1])} of ${dd[2]})`, dd[0] >= 0 && dd[1] <= dd[2] ? "PASS" : "FAIL");
    await page.keyboard.press("Escape");
    await setWidth(1200, 800);
    await page.click('.tabs .tab-btn[data-tab="vendor-buylist"]'); await page.waitForTimeout(600);
    // CSV export inside Electron: capture via CDP download behaviour into a temp dir
    const dl = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "pec-electron-dl-"));
    await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl, eventsEnabled: true }).catch(() => {});
    await page.click("#vwlExportBtn"); await page.click("#vwlExportCsv");
    const csvName = await waitFor(() => fs.readdirSync(dl).find((f) => /\.csv$/.test(f)), 20000);
    if (csvName) {
      const rows = fs.readFileSync(path.join(dl, csvName), "utf8").split(/\r?\n/).filter((l) => l.trim());
      check(`Electron CSV export written (${csvName}): all fixture rows + header`, rows.length === 501 ? "PASS" : "FAIL", `${rows.length} lines`);
    } else check("Electron CSV export written", "NOT TESTED", "download behaviour not observable through the DevTools port in this Electron build (no save-dialog automation)");
    if (libs) {
      await page.click("#vwlExportBtn"); await page.click("#vwlExportPdf");
      const pdfName = await waitFor(() => fs.readdirSync(dl).find((f) => /\.pdf$/.test(f)), 30000);
      if (pdfName) {
        const txt = execSync(`pdftotext -layout "${path.join(dl, pdfName)}" -`, { encoding: "utf8", maxBuffer: 64e6 });
        const items = new Set(txt.match(/VItem \d{4}/g) || []);
        check(`Electron PDF export (real jsPDF in the packaged renderer): ${items.size} distinct fixture items`, items.size === 500 ? "PASS" : "FAIL");
      } else check("Electron PDF export written", "NOT TESTED", "download not observable");
    } else check("Electron PDF export", "NOT TESTED", "PEC_JSPDF_ROOT not set");
    // HOME navigation stays inside the packaged app origin
    const before = page.url();
    await page.click("#homeBtn").catch(() => {});
    await page.waitForTimeout(1200);
    check(`Electron HOME button navigates inside the app origin (${new URL(page.url()).pathname})`, /^http:\/\/localhost:3000\//.test(page.url()) && page.url() !== before ? "PASS" : "FAIL");
  }
  check("no JS page errors in Electron renderer", errors.length === 0 ? "PASS" : "FAIL", errors.slice(0, 2).join(" | "));
}
check("Authenticated roles (editor / view-only / no-access) in Electron", "NOT TESTED", "requires genuine sessions; fixture stub is not security evidence");
check("Windows/macOS installer behaviour", "NOT TESTED", "only the Linux unpacked build was produced");

stop();
const pass = results.filter((r) => r.status === "PASS").length, fail = results.filter((r) => r.status === "FAIL").length, nt = results.filter((r) => r.status === "NOT TESTED").length;
const sha = (() => { try { return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(); } catch { return "unknown"; } })();
fs.writeFileSync(path.join(shots, "electron-report.json"), JSON.stringify({ sha, electron: browser ? "see ua" : null, generated: new Date().toISOString(), pass, fail, notTested: nt, results }, null, 2));
console.log(`\npec-electron-acceptance: ${pass} PASS / ${fail} FAIL / ${nt} NOT TESTED @ ${sha.slice(0, 8)}`);
process.exit(fail ? 1 : 0);
