// Evidence capture: node scripts/fg-bit-ux-1/capture-evidence.mjs <repoRoot> <outDir> [label]
// Serves <repoRoot> statically, renders the real page against the in-memory fake, writes screenshots + metrics.json.
// For "before" runs point <repoRoot> at a checkout of the base commit (fake lives in this repo, absolute-imported).
import fs from "node:fs"; import http from "node:http"; import path from "node:path";
import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const [rootArg, outArg, label = "after"] = process.argv.slice(2);
const root = path.resolve(rootArg), out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });
const { chromium } = createRequire(import.meta.url)("playwright");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  const f = u.startsWith("/__fake/") ? path.join(here, u.slice(8)) : path.join(root, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }).end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
async function open(w, h, scale = 1) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith(base)) return r.fallback(); if (u.startsWith("https://esm.sh/")) return r.fulfill({ contentType: "text/javascript", body: `import { createFake } from "${base}/__fake/fake-supabase.mjs"; export const createClient = () => createFake({});` }); return r.abort(); });
  await page.goto(`${base}/fg-bulk-internal-transfer.html`);
  await page.waitForSelector("#sourceTbody tr[data-idx]");
  return { page, ctx };
}
const metrics = { label, shots: [], computed: {} };
const shot = async (page, name) => { await page.screenshot({ path: path.join(out, `${label}-${name}.png`) }); metrics.shots.push(`${label}-${name}.png`); };
for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
  const { page, ctx } = await open(w, h, 2);
  await shot(page, `${tag}-page`);
  if (tag === "desktop") {
    metrics.computed[tag] = await page.evaluate(() => {
      const c = (s, ps) => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); return Object.fromEntries(ps.map((p) => [p, cs[p]])); };
      return {
        body: c("body", ["fontFamily", "backgroundColor", "color", "paddingTop"]),
        title: c("h1", ["fontFamily", "fontSize", "fontWeight", "color"]),
        home: c("#homeBtn", ["backgroundColor", "color", "borderTopColor", "borderRadius", "fontSize", "fontWeight", "minHeight"]),
        search: c("#filterItem", ["backgroundColor", "borderTopColor", "borderRadius", "fontSize", "height", "fontFamily"]),
        th: c("thead th", ["backgroundColor", "fontSize", "fontWeight", "textTransform"]),
      };
    });
  }
  await page.click("#sourceTbody tr[data-idx='1'] td.col-item, #sourceTbody tr[data-idx='1']");
  await shot(page, `${tag}-modal`);
  await page.click("#submitBtn");
  await shot(page, `${tag}-modal-validation-error`);
  await page.evaluate(() => { document.querySelector(".modal-body").scrollTop = 9999; });
  await shot(page, `${tag}-modal-scrolled`);
  await ctx.close();
}
for (const [w, h] of [[1024, 768], [768, 1024], [844, 390]]) {
  const { page, ctx } = await open(w, h, 1);
  await page.click("#sourceTbody tr[data-idx='1']");
  await shot(page, `modal-${w}x${h}`);
  await ctx.close();
}
// Reference module (Manage Activities) computed styles for token parity, served from the same root.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith(base)) return r.fallback(); return r.abort(); });
  await page.goto(`${base}/manage-activities.html`).catch(() => {});
  metrics.computed.manageActivitiesRef = await page.evaluate(() => {
    const c = (s, ps) => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); return Object.fromEntries(ps.map((p) => [p, cs[p]])); };
    return { body: c("body", ["fontFamily", "backgroundColor", "color", "paddingTop"]), title: c(".ma-page-title", ["fontFamily", "fontSize", "fontWeight", "color"]), home: c("#homeBtn", ["backgroundColor", "color", "borderTopColor", "borderRadius", "fontSize", "fontWeight", "minHeight"]) };
  });
  await page.screenshot({ path: path.join(out, `reference-manage-activities-desktop.png`) });
  await ctx.close();
}
fs.writeFileSync(path.join(out, `${label}-metrics.json`), JSON.stringify(metrics, null, 2));
await browser.close(); server.close();
console.log(JSON.stringify(metrics.computed, null, 1));
