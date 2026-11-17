// WP11: a client that installed the previous release (hub-cache-v393 sw.js + old PM BOM page) must obtain the corrected PM BOM
// asset after the NORMAL service-worker update lifecycle (registration.update -> install -> skipWaiting -> activate -> clients.claim),
// and the old cache must be purged. Real Chromium; the "old release" is read from git (PRIOR_REF), the new one from the working tree.
//   node --test scripts/pm-bom-responsive/sw-update-lifecycle.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { launch, repoRoot } from "../wp08-g2-0-shared-master-data/harness.mjs";

const PRIOR_REF = "275b632ec8c5b33637f9e7d0855014b471f4516d"; // main at branch point, carrying hub-cache-v393
const PM = "shared/manage-pm-bom.html";
const git = (p) => { try { return execFileSync("git", ["show", `${PRIOR_REF}:${p}`], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }); } catch { return null; } };
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };

test("v393 client updates to v394 through the normal lifecycle and receives the corrected PM BOM page", async (t) => {
  const l = await launch(); if (!l) { t.skip("Playwright/Chromium not available"); return; }
  const oldSw = git("public/sw.js"), oldPm = git(`public/${PM}`);
  if (!oldSw || !oldPm) { l.browser.close(); t.skip("prior ref not available in this clone"); return; }
  assert.match(oldSw.toString(), /CACHE_NAME = "hub-cache-v393"/);
  let phase = "old";
  const root = path.join(repoRoot, "public");
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
    let body = null;
    if (phase === "old" && rel === "sw.js") body = oldSw;
    else if (phase === "old" && rel === PM) body = oldPm;
    else { const f = path.join(root, rel); if (f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile()) body = fs.readFileSync(f); }
    if (!body) { res.writeHead(404).end("nf"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream", "cache-control": "no-cache" }).end(body);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await l.browser.newContext();
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "" }));
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/${PM}`, { waitUntil: "load" });
    await page.evaluate(async () => { await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller || true);
    await page.reload({ waitUntil: "load" }); // controlled by v393
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
    const before = await page.evaluate(async () => ({ keys: await caches.keys(), css: (await (await fetch("/shared/manage-pm-bom.html")).text()).includes("WP11: .hdr-top is nowrap") }));
    assert.deepEqual(before.keys, ["hub-cache-v393"], "old generation installed");
    assert.equal(before.css, false, "old page lacks the WP11 rule");

    phase = "new"; // the deployed release changes: new sw.js (v394) and corrected page
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await page.evaluate(() => new Promise((resolve, reject) => { const end = Date.now() + 30000; const tick = async () => { if ((await caches.keys()).join() === "hub-cache-v394") return resolve(); if (Date.now() > end) return reject(new Error("v394 did not activate in 30s")); setTimeout(tick, 250); }; tick(); }));
    await page.reload({ waitUntil: "load" });
    const after = await page.evaluate(async () => ({
      keys: await caches.keys(),
      ctrl: !!navigator.serviceWorker.controller,
      pageHasRule: document.documentElement.outerHTML.includes("WP11: .hdr-top is nowrap") || [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.cssText.includes("hdr-top")); } catch { return false; } }),
      fetched: (await (await fetch("/shared/manage-pm-bom.html")).text()).includes("WP11: .hdr-top is nowrap"),
    }));
    assert.deepEqual(after.keys, ["hub-cache-v394"], "only the new generation remains (old purged on activate)");
    assert.equal(after.ctrl, true, "still controlled");
    assert.equal(after.fetched, true, "client now receives the corrected PM BOM page");
  } finally { await context.close(); await l.close(); server.close(); }
});
