/**
 * Shared offline browser harness for PEC UI scripts.
 *
 * Serves the REAL shared module (public/shared/procurement-execution-console.html + js)
 * from a local static server and replaces ONLY js/supabaseClient.js with the synthetic
 * fixture stub already maintained in scripts/pec-erp-c1-layout-smoke.mjs (that file is
 * not modified; its `stub()` source is reused verbatim so fixtures cannot drift).
 * No network, no Supabase, no production data. This is NOT signed-in operational
 * acceptance.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { PAGED_SHIM } from "./pec-paged-shim.mjs";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "public");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };

function loadStub() {
  const src = fs.readFileSync(path.join(here, "..", "pec-erp-c1-layout-smoke.mjs"), "utf8");
  const a = src.indexOf("function stub(scenario) {");
  const b = src.indexOf("\nconst browser = await chromium.launch()");
  if (a < 0 || b < 0 || b < a) throw new Error("pec-ui-harness: cannot locate the stub() fixture in pec-erp-c1-layout-smoke.mjs");
  const stub = new Function("PAGED_SHIM", `${src.slice(a, b)}\nreturn stub;`)(PAGED_SHIM);
  // Harness-only extension: scenario.delays = { rpcName: ms } slows a named RPC so busy
  // (in-flight) states can be held open deterministically. Fixture source is not modified.
  return (scenario) => stub(scenario).replace(
    "rpc: async (name, params) => {",
    "rpc: async (name, params) => { if (S.delays && S.delays[name]) await new Promise((r) => setTimeout(r, S.delays[name]));" +
    // Test hook: a page-side handler (globalThis.__paRpc) may answer a named RPC with a full {data,error} result.
    " if (globalThis.__paRpc) { const __h = await globalThis.__paRpc(name, params); if (__h !== undefined) return __h; }",
  );
}

export async function startHarness() {
  const { chromium } = require("playwright");
  const stub = loadStub();
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]);
    const f = path.join(root, u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  async function open(scenario, vp, { dsf = 1, fixedTime = null, init = null } = {}) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dsf });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    if (fixedTime) await page.clock.setFixedTime(fixedTime); // Date only; timers keep running
    if (init) await page.addInitScript(init.fn, init.arg);
    await page.route("**/js/supabaseClient.js", (r) => r.fulfill({ contentType: "text/javascript", body: stub(scenario) }));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.goto(`${base}/shared/procurement-execution-console.html`);
    await page.waitForSelector("#mainPanel:not([hidden])", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    return { ctx, page, errors };
  }
  /** Open the approved fixture indent modal (Purchase Indents lens, 2nd row). */
  async function openIndentModal(page, vp) {
    if (vp.width <= 520) await page.selectOption("#procTabSelect", "indents");
    else await page.click('.tabs .tab-btn[data-tab="indents"]');
    await page.waitForTimeout(400);
    await page.click("#iTbody tr:nth-child(2)");
    await page.waitForSelector("#indentViewModalBackdrop.show");
    await page.waitForTimeout(500);
  }
  /** Same as openIndentModal but for the n-th row (1-based). Row 1 is a draft indent in the fixture. */
  async function openIndentModalAt(page, vp, row) {
    if (vp.width <= 520) await page.selectOption("#procTabSelect", "indents");
    else await page.click('.tabs .tab-btn[data-tab="indents"]');
    await page.waitForTimeout(400);
    await page.click(`#iTbody tr:nth-child(${row})`);
    await page.waitForSelector("#indentViewModalBackdrop.show");
    await page.waitForTimeout(500);
  }
  return { open, openIndentModal, openIndentModalAt, close: async () => { await browser.close(); server.close(); } };
}
