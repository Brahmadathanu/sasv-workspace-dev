// Rendered visual comparison: FG Bulk Internal Transfer vs Stock Checker vs Stock & Purchase Explorer.
// node scripts/fg-bit-ux-1/compare-references.mjs <outDir>  (static server on repo root; Supabase/CDN stubbed; no network)
import fs from "node:fs"; import http from "node:http"; import path from "node:path";
import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.resolve(process.argv[2] || "docs/fg-bit-ux-1/evidence"); fs.mkdirSync(out, { recursive: true });
const { chromium } = createRequire(import.meta.url)("playwright");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => { const f = path.join(root, decodeURIComponent(req.url.split("?")[0])); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }).end(fs.readFileSync(f)); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
// Permissive chainable stub: any call chains; awaiting yields empty data.
const STUB = `const mk=()=>new Proxy(function(){},{get:(t,k)=>k==="then"?(r)=>r({data:[],error:null,count:0}):k==="auth"?{getSession:async()=>({data:{session:{user:{id:"t"}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),getUser:async()=>({data:{user:{id:"t"}}})}:mk(),apply:()=>mk()});export const createClient=()=>mk();`;
const browser = await chromium.launch();
const PAGES = { fgBit: "/fg-bulk-internal-transfer.html", stockChecker: "/public/shared/stock-checker.html", stockPurchaseExplorer: "/public/shared/stock-purchase-explorer.html" };
const result = {};
for (const [name, url] of Object.entries(PAGES)) for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.on("pageerror", () => {});
  await page.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith(base)) return r.fallback(); if (/esm\.sh/.test(u)) return r.fulfill({ contentType: "text/javascript", body: STUB }); return r.abort(); });
  await page.goto(base + url, { waitUntil: "load" }).catch(() => {}); await page.waitForTimeout(800);
  result[`${name}-${tag}`] = await page.evaluate(() => {
    const pick = (sel, ps) => { const e = [...document.querySelectorAll(sel)].find((x) => x.getBoundingClientRect().width > 0); if (!e) return null; const cs = getComputedStyle(e), b = e.getBoundingClientRect(); const o = Object.fromEntries(ps.map((p) => [p, cs[p]])); o.box = `${Math.round(b.width)}x${Math.round(b.height)}`; return o; };
    return {
      body: pick("body", ["fontFamily", "backgroundColor", "color", "paddingTop"]),
      h1: pick("h1", ["fontFamily", "fontSize", "fontWeight", "color", "letterSpacing"]),
      home: pick("#homeBtn", ["backgroundColor", "color", "borderTopColor", "borderRadius", "fontSize", "fontWeight", "minHeight"]),
      search: pick("#search, #filterItem, input[type=search], input[type=text]", ["backgroundColor", "borderTopColor", "borderRadius", "fontSize", "fontFamily"]),
    };
  });
  await page.screenshot({ path: path.join(out, `ref-${name}-${tag}.png`) });
  await ctx.close();
}
fs.writeFileSync(path.join(out, "reference-comparison.json"), JSON.stringify(result, null, 2));
// Parity table: every token-driven property must equal for h1 font/size/weight/color, home colours, search fill.
const get = (k, g, p) => result[k]?.[g]?.[p];
const rows = [];
for (const [g, p] of [["body", "fontFamily"], ["body", "backgroundColor"], ["body", "color"], ["h1", "fontFamily"], ["h1", "fontSize"], ["h1", "fontWeight"], ["h1", "color"], ["home", "backgroundColor"], ["home", "color"], ["home", "borderTopColor"], ["home", "borderRadius"], ["home", "fontSize"], ["home", "fontWeight"], ["home", "minHeight"], ["search", "backgroundColor"], ["search", "borderTopColor"], ["search", "borderRadius"], ["search", "fontSize"]]) {
  const v = ["fgBit", "stockChecker", "stockPurchaseExplorer"].map((n) => get(`${n}-desktop`, g, p) ?? "n/a");
  rows.push({ prop: `${g}.${p}`, fgBit: v[0], stockChecker: v[1], stockPurchaseExplorer: v[2], matchesSC: v[0] === v[1], matchesSPE: v[0] === v[2] });
}
fs.writeFileSync(path.join(out, "reference-comparison-table.json"), JSON.stringify(rows, null, 2));
console.table(rows.map((r) => ({ prop: r.prop, fgBit: String(r.fgBit).slice(0, 34), SC: r.matchesSC, SPE: r.matchesSPE, sc: String(r.stockChecker).slice(0, 30), spe: String(r.stockPurchaseExplorer).slice(0, 30) })));
await browser.close(); server.close();
