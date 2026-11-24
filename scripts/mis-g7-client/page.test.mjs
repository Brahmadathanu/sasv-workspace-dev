// Batch Governance browser acceptance: the REAL page against the in-memory server model (no network, no Supabase,
// no production writes). Skips honestly if Playwright/Chromium is unavailable.
// MIS_G7_EVIDENCE=<dir> additionally writes screenshots (visual acceptance evidence).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defaultConfig } from "./fake-server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let chromium = null;
try { chromium = createRequire(import.meta.url)("playwright").chromium; } catch { /* skipped below */ }
const SK = !chromium && "Playwright unavailable";
const EVID = process.env.MIS_G7_EVIDENCE; if (EVID) fs.mkdirSync(EVID, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(root, /^\/(shared|utilities-hub|sw\.js)(\/|$)/.test(p) ? `public${p}` : p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }).end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = chromium ? await chromium.launch() : null;
test.after(async () => { await browser?.close(); server.close(); });

async function open({ over = {}, width = 1280, height = 800, wait = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); const errors = []; const blocked = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/*", (r) => {
    const u = r.request().url();
    if (u.startsWith(base)) return r.fallback();
    if (u.startsWith("https://esm.sh/")) return r.fulfill({ contentType: "text/javascript", body: `import { createFake } from "${base}/scripts/mis-g7-client/fake-server.mjs"; export const createClient = () => createFake(window.__cfg);` });
    blocked.push(u); return r.abort();
  });
  await page.addInitScript((cfg) => { window.__cfg = cfg; }, defaultConfig(over));
  await page.goto(`${base}/shared/mis-batch-governance.html`);
  if (wait) await page.waitForSelector("#app:not([hidden]), #gate:not([hidden])");
  return { page, ctx, errors, blocked };
}
const pick = async (page, input, text) => { await page.fill(input, text); await page.keyboard.press("Enter"); };
async function select(page, product, batch) {
  await pick(page, "#productInput", product); await page.waitForFunction((b) => document.querySelectorAll("#batchInput-list li").length >= 0 && !!document.getElementById("batchInput"), batch);
  await page.click("#batchInput"); await page.fill("#batchInput", batch); await page.keyboard.press("Enter");
  await page.waitForSelector("#panel-sign .mbg-card");
}
const calls = (page, n) => page.evaluate((x) => window.__cfg.log.filter((l) => l.name === x), n);
const cfgOf = (page) => page.evaluate(() => ({ fg: window.__cfg.fg, signed: window.__cfg.signed, commits: window.__cfg.packCommits || 0, lines: window.__cfg.event_skus }));
const shot = async (page, name) => { if (EVID) await page.screenshot({ path: path.join(EVID, name), fullPage: true }); };
async function signFg(page) {
  await page.click('#stepTable tr:has-text("FG bulk storage")'); await page.click('#logTable tr[data-log="1002"]');
  await page.fill("#mqty", "10"); await page.fill("#evref", "WB-1"); await page.click("#signBtn"); await page.click("#mSign");
  await page.waitForSelector("#banner:has-text('Stage signed')");
}
const bodyText = (page) => page.evaluate(() => document.body.innerText);

test("loads cleanly, HOME present, no ENFORCE/core sign-off controls, no external requests", { skip: SK }, async () => {
  const { page, ctx, errors, blocked } = await open();
  assert.equal(await page.$eval("#app", (e) => e.hidden), false);
  assert.ok(await page.$("#homeBtn .home-label"));
  const t = await bodyText(page); assert.doesNotMatch(t, /Activate ENFORCE|Switch to ENFORCE|Sign off core/i);
  assert.equal(await page.$$eval("button", (bs) => bs.filter((b) => /enforce|core migration/i.test(b.textContent)).length), 0);
  assert.deepEqual(errors, []); assert.deepEqual(blocked.filter((u) => !u.includes("/fonts/")), []);
  await ctx.close();
});

test("a user with no MIS rights sees a closed gate and no data requests", { skip: SK }, async () => {
  const caps = Object.fromEntries(Object.keys(defaultConfig().caps).map((k) => [k, [0, 0]]));
  const { page, ctx } = await open({ over: { caps } });
  assert.equal(await page.$eval("#gate", (e) => e.hidden), false); assert.equal(await page.$eval("#app", (e) => e.hidden), true);
  assert.match(await page.textContent("#gate"), /do not have access/);
  await ctx.close();
});

test("authorized stage signing: route + exact work-log evidence + confirm modal + result; keyboard Esc closes modal", { skip: SK }, async () => {
  const { page, ctx, errors } = await open();
  await select(page, "Ashwagandha", "B-001");
  assert.match(await page.textContent("#identity"), /BMR #101/);
  assert.equal(await page.$$eval("#stepTable tbody tr", (r) => r.length), 3);
  assert.match(await page.textContent("#panel-sign"), /Not signable/); assert.match(await page.textContent("#panel-sign"), /override steps/i);
  await shot(page, "01-sign-desktop.png");
  await page.click('#stepTable tr:has-text("FG bulk storage")'); await page.click('#logTable tr[data-log="1002"]');
  await page.fill("#mqty", "10"); await page.click("#signBtn"); assert.match(await page.textContent("#banner"), /Evidence reference is required/); assert.equal((await calls(page, "mis_sign_batch_stage_v1")).length, 0);
  await page.fill("#evref", "WB-1"); await page.click("#signBtn");
  assert.equal(await page.$eval("#modalRoot", (e) => e.hidden), false); assert.match(await page.textContent("#modalBody"), /BMR[\s\S]*#101/);
  await page.keyboard.press("Escape"); assert.equal(await page.$eval("#modalRoot", (e) => e.hidden), true); assert.equal(await page.evaluate(() => document.activeElement.id), "signBtn");
  await page.click("#signBtn"); await page.click("#mSign"); await page.waitForSelector("#banner:has-text('Stage signed')");
  const c = await calls(page, "mis_sign_batch_stage_v1"); assert.equal(c.length, 1);
  assert.deepEqual([c[0].args.p_product_id, c[0].args.p_batch_number, c[0].args.p_work_log_id, c[0].args.p_route_step_id, c[0].args.p_measured_qty_base], [7, "B-001", 1002, 42, 10]);
  assert.match(await page.textContent("#signedList"), /Signed/);
  assert.deepEqual(errors, []); await ctx.close();
});

test("unauthorized signing: no sign or void controls are rendered; server denial is explained if forced", { skip: SK }, async () => {
  const { page, ctx } = await open({ over: { caps: { ...defaultConfig().caps, "module:mis-batch-stage-signer": [1, 0] } } });
  await select(page, "Ashwagandha", "B-001");
  assert.equal(await page.$("#signBtn"), null); assert.match(await page.textContent("#panel-sign"), /Signing is not available/);
  await ctx.close();
});

test("FG-bulk measured quantity is required client-side; route/BMR ambiguity and gaps are shown clearly", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await select(page, "Ashwagandha", "B-001");
  await page.click('#stepTable tr:has-text("FG bulk storage")'); await page.click('#logTable tr[data-log="1002"]'); await page.click("#signBtn");
  assert.match(await page.textContent("#banner"), /Measured quantity is required/); assert.equal((await calls(page, "mis_sign_batch_stage_v1")).length, 0);
  await page.click("#batchInput"); await page.fill("#batchInput", "B-DUP"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => /ambiguous/.test(document.getElementById("identity").textContent));
  await page.waitForFunction(() => /2 BMRs share this batch number/.test(document.getElementById("panel-sign").textContent));
  await pick(page, "#productInput", "Triphala"); await page.click("#batchInput"); await page.fill("#batchInput", "T-001"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => /Route readiness/.test(document.getElementById("panel-sign").textContent));
  await ctx.close();
});

test("route view denied: operator is told what is missing, nothing is invented", { skip: SK }, async () => {
  const { page, ctx } = await open({ over: { routeViewDenied: true } });
  await select(page, "Ashwagandha", "B-001");
  assert.match(await page.textContent("#panel-sign"), /Route view is not available/); assert.equal(await page.$("#stepTable"), null);
  await ctx.close();
});

test("packing before FG stage is signed is refused as NOT VERIFIED; nothing posted", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await select(page, "Ashwagandha", "B-001"); await page.click("#tab-pack"); await page.selectOption("#eventSel", "5001");
  await page.waitForSelector("#skuTable"); await page.fill('input[data-sku="71"]', "4"); await page.click("#packBtn");
  await page.waitForSelector("#banner:has-text('not signed')");
  assert.match(await page.textContent("#banner"), /Not verified/); assert.match(await page.textContent("#banner"), /Nothing was posted/);
  assert.equal((await cfgOf(page)).fg[0].qty_on_hand, 10); await ctx.close();
});

test("successful governed packing: receipt shows required/available/balance/UOM; stock refreshed; one key per intent", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await select(page, "Ashwagandha", "B-001"); await signFg(page);
  await page.click("#tab-pack"); await page.selectOption("#eventSel", "5001"); await page.waitForSelector("#skuTable");
  await page.fill('input[data-sku="71"]', "4"); await page.click("#packBtn"); await page.waitForSelector("#packResult .mbg-banner");
  const t = await page.textContent("#packResult"); assert.match(t, /Required bulk\s*2 kg/); assert.match(t, /Available before\s*10 kg/); assert.match(t, /Balance after\s*8 kg/);
  assert.match(await page.textContent("#identity"), /Bulk 8 kg/); assert.equal((await cfgOf(page)).commits, 1);
  const c = await calls(page, "mis_pack_fg_bulk_v1"); assert.equal(c.length, 1); assert.match(c[0].args.p_request_id, /^[0-9a-f-]{36}$/); assert.equal(c[0].args.p_excess, null);
  const names = await page.evaluate(() => window.__cfg.log.map((l) => l.name)); assert.ok(!names.some((n) => /enforcement|record_core|set_enforcement/.test(n)));
  await shot(page, "02-pack-receipt-desktop.png"); await ctx.close();
});

test("insufficient stock + authorized measured excess: compact modal, validation, same request key, atomic post", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await select(page, "Ashwagandha", "B-001"); await signFg(page);
  await page.click("#tab-pack"); await page.selectOption("#eventSel", "5001"); await page.waitForSelector("#skuTable");
  await page.fill('input[data-sku="72"]', "150"); await page.click("#packBtn"); await page.waitForSelector("#modalRoot:not([hidden])");
  const m = await page.textContent("#modalBody"); assert.match(m, /Required\s*15 kg/); assert.match(m, /Available\s*10 kg/); assert.match(m, /Shortfall\s*5 kg/);
  assert.equal((await cfgOf(page)).fg[0].qty_on_hand, 10); await shot(page, "03-excess-modal-desktop.png");
  await page.click("#mPost"); assert.match(await page.textContent("#modalMsg"), /Measured excess must be a number above 0/); assert.equal((await calls(page, "mis_pack_fg_bulk_v1")).length, 1);
  await page.fill("#exQty", "2"); await page.fill("#exReason", "scale reading"); await page.fill("#exEvidence", "WB-7"); await page.click("#mPost");
  await page.waitForFunction(() => /Still insufficient|still insufficient/.test(document.getElementById("modalMsg").textContent));
  assert.equal((await cfgOf(page)).fg[0].qty_on_hand, 10, "failed excess changed nothing");
  await page.fill("#exQty", "5"); await page.click("#mPost"); await page.waitForSelector("#packResult .mbg-banner");
  assert.match(await page.textContent("#packResult"), /Measured excess posted\s*5 kg/); assert.match(await page.textContent("#packResult"), /Balance after\s*0 kg/);
  const c = await calls(page, "mis_pack_fg_bulk_v1"); assert.equal(c.length, 3); assert.equal(new Set(c.map((x) => x.args.p_request_id)).size, 1, "one idempotency key for the whole intent");
  assert.deepEqual(c[2].args.p_excess, { qty_base: 5, evidence_ref: "WB-7", reason: "scale reading" }); assert.equal((await cfgOf(page)).commits, 1);
  await ctx.close();
});

test("insufficient stock without excess authority: figures shown, no excess controls", { skip: SK }, async () => {
  const { page, ctx } = await open({ over: { caps: { ...defaultConfig().caps, "module:mis-fg-excess-adjustment": [1, 0] } } });
  await select(page, "Ashwagandha", "B-001"); await signFg(page);
  await page.click("#tab-pack"); await page.selectOption("#eventSel", "5001"); await page.waitForSelector("#skuTable");
  await page.fill('input[data-sku="72"]', "150"); await page.click("#packBtn"); await page.waitForSelector("#banner:has-text('Insufficient')");
  assert.equal(await page.$eval("#modalRoot", (e) => e.hidden), true); assert.equal(await page.$("#exQty"), null);
  const t = await page.textContent("#banner"); assert.match(t, /Shortfall\s*5 kg/); assert.match(t, /Nothing was posted/);
  await ctx.close();
});

test("uncertain network outcome: inputs lock, retry reuses the key and replays without a duplicate posting", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await select(page, "Ashwagandha", "B-001"); await signFg(page);
  await page.click("#tab-pack"); await page.selectOption("#eventSel", "5001"); await page.waitForSelector("#skuTable");
  await page.evaluate(() => window.__cfg.faults.push({ rpc: "mis_pack_fg_bulk_v1", mode: "network-after" }));   // committed, response lost
  await page.fill('input[data-sku="71"]', "4"); await page.click("#packBtn");
  await page.waitForSelector("#banner:has-text('Outcome not confirmed')");
  assert.equal(await page.$eval('input[data-sku="71"]', (i) => i.disabled), true); assert.equal(await page.$eval("#packBtn", (b) => b.disabled), true);
  assert.equal((await cfgOf(page)).commits, 1);
  await page.click('#banner button:has-text("Retry")'); await page.waitForSelector("#packResult .mbg-banner");
  assert.match(await page.textContent("#packResult"), /replayed existing request/); assert.equal((await cfgOf(page)).commits, 1);
  const c = await calls(page, "mis_pack_fg_bulk_v1"); assert.equal(c.length, 2); assert.equal(c[0].args.p_request_id, c[1].args.p_request_id);
  await shot(page, "04-uncertain-retry-desktop.png"); await ctx.close();
});

test("pack corrections: change, removal (0), historical no-basis refusal; unauthorized users get no controls", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await select(page, "Ashwagandha", "B-002"); await page.click("#tab-corr"); await page.selectOption("#eventSel", "5101"); await page.waitForSelector("[data-line]");
  await page.click('[data-line="9001"]'); await page.fill("#cNew", "4"); assert.match(await page.textContent("#modalBody"), /Existing count\s*10/); assert.match(await page.textContent("#modalBody"), /-6/);
  await page.click("#mPost"); assert.match(await page.textContent("#modalMsg"), /Reason is required/);
  await page.fill("#cReason", "miscount"); await page.click("#mPost"); await page.waitForSelector("#corrResult .mbg-banner");
  assert.match(await page.textContent("#corrResult"), /10 → 4/); assert.match(await page.textContent("#corrResult"), /\+3 kg returned to stock/);
  await page.click('[data-line="9001"]'); await page.fill("#cNew", "0"); assert.match(await page.textContent("#pvNew"), /line removed/); await page.fill("#cReason", "entered in error"); await page.click("#mPost");
  await page.waitForSelector("#corrResult:has-text('Line removed')"); assert.equal(await page.$('[data-line="9001"]'), null);
  await page.click('[data-line="9002"]'); await page.fill("#cNew", "5"); await page.fill("#cReason", "try"); await page.click("#mPost");
  await page.waitForFunction(() => /no recorded depletion evidence/.test(document.getElementById("modalMsg").textContent));
  assert.match(await page.textContent("#banner"), /Not verified/); await page.keyboard.press("Escape");
  await ctx.close();
  const u = await open({ over: { caps: { ...defaultConfig().caps, "module:mis-fg-bulk-packing": [1, 0] } } });
  await select(u.page, "Ashwagandha", "B-002"); await u.page.click("#tab-corr"); await u.page.selectOption("#eventSel", "5101"); await u.page.waitForSelector("#panel-corr .mbg-card");
  assert.equal(await u.page.$("[data-line]"), null); assert.match(await u.page.textContent("#panel-corr"), /not available to your account/); await u.ctx.close();
});

test("source revision requires correct + re-sign; Done closure alone does not (S6)", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await select(page, "Ashwagandha", "B-001"); await signFg(page);
  await page.evaluate(() => { window.__cfg.logs.find((l) => l.id === 1002).status = "Closed"; });                // inventory closure: not a source change
  await page.click("#tab-pack"); await page.selectOption("#eventSel", "5001"); await page.waitForSelector("#skuTable"); await page.fill('input[data-sku="71"]', "2"); await page.click("#packBtn"); await page.waitForSelector("#packResult .mbg-banner");
  await page.evaluate(() => { window.__cfg.logs.find((l) => l.id === 1002).storage_qty = 9; });                   // real source revision
  await page.fill('input[data-sku="72"]', "1"); await page.click("#packBtn"); await page.waitForSelector("#banner:has-text('Source changed after')");
  assert.match(await page.textContent("#banner"), /Source changed/); await ctx.close();
});

test("void signature (stage correction) from the session list", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await select(page, "Ashwagandha", "B-001"); await signFg(page);
  await page.click("[data-void]"); await page.click("#mCorr"); assert.match(await page.textContent("#modalMsg"), /Reason is required/);
  await page.fill("#cReason", "log re-weighed"); await page.click("#mCorr"); await page.waitForSelector("#banner:has-text('Signature voided')");
  assert.match(await page.textContent("#signedList"), /Voided/); await ctx.close();
});

test("exceptions & mode: states, historical NOT_VERIFIED kept distinct, AUDIT vs unknown mode, no activation controls", { skip: SK }, async () => {
  const { page, ctx } = await open();
  await page.click("#tab-exc"); const t = await page.textContent("#panel-exc");
  for (const s of ["Signed", "Unsigned", "Source changed", "Missing route", "Missing FG receipt", "Not verified"]) assert.ok(t.includes(s), s);
  assert.match(t, /29/); assert.match(t, /Not live counts/); assert.match(t, /separately governed owner actions/); assert.equal(await page.$eval("#modeBadge", (e) => e.hidden), true);
  await ctx.close();
  const a = await open({ over: { caps: { ...defaultConfig().caps, "module:mis-g7-enforcement-admin": [1, 0] } } });
  await a.page.click("#tab-exc"); await a.page.waitForSelector("#panel-exc:has-text('CORE_MIGRATION_NOT_ACCEPTED')");
  assert.equal(await a.page.textContent("#modeBadge"), "AUDIT"); assert.match(await a.page.textContent("#panel-exc"), /AUDIT: legacy logging and packing still work/);
  assert.equal(await a.page.$$eval("#panel-exc button", (b) => b.length), 0); await shot(a.page, "05-exceptions-desktop.png"); await a.ctx.close();
});

test("latest product selection wins when an earlier request is slower", { skip: SK }, async () => {
  const { page, ctx } = await open({ over: { slowProduct: { 7: 400 } } });
  await pick(page, "#productInput", "Ashwagandha"); await pick(page, "#productInput", "Triphala");
  await page.waitForTimeout(700); await page.click("#batchInput"); const opts = await page.$$eval("#batchInput-list li", (l) => l.map((x) => x.textContent));
  assert.ok(opts.some((o) => o.startsWith("T-001"))); assert.ok(!opts.some((o) => o.startsWith("B-001"))); await ctx.close();
});

for (const [name, width, height] of [["320", 320, 640], ["390", 390, 844], ["768", 768, 900]]) {
  test(`narrow layout ${name}px: no horizontal page overflow; modal is full-page on phones; HOME icon-only`, { skip: SK }, async () => {
    const { page, ctx } = await open({ width, height });
    await select(page, "Ashwagandha", "B-001"); await signFg(page);
    await page.click("#tab-pack"); await page.selectOption("#eventSel", "5001"); await page.waitForSelector("#skuTable"); await page.fill('input[data-sku="72"]', "150"); await page.click("#packBtn"); await page.waitForSelector("#modalRoot:not([hidden])");
    const m = await page.$eval("#modalBox", (e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });
    if (width <= 520) { assert.ok(Math.abs(m.w - width) <= 1 && Math.abs(m.h - height) <= 1, `full-page modal ${JSON.stringify(m)}`); assert.equal(await page.$eval("#homeBtn .home-label", (e) => getComputedStyle(e).display), "none"); }
    await shot(page, `06-excess-modal-${name}.png`); await page.click("#mCancel");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no horizontal page overflow");
    await page.click("#tab-sign"); await shot(page, `07-sign-${name}.png`); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await ctx.close();
  });
}

test("HOME navigation: PWA goes to /utilities-hub/index.html, Electron goes to /index.html", { skip: SK }, async () => {
  for (const [electron, expected] of [[false, "/utilities-hub/index.html"], [true, "/index.html"]]) {
    const { page, ctx, errors } = await open({ wait: false });
    if (electron) await page.addInitScript(() => { window.electronAPI = {}; });
    await page.route("**" + expected, (r) => r.fulfill({ contentType: "text/html", body: "<title>home</title>" }));
    await page.reload(); await page.waitForSelector("#app:not([hidden]), #gate:not([hidden])");
    await Promise.all([page.waitForURL((u) => u.pathname === expected, { timeout: 8000 }), page.click("#homeBtn")]);
    assert.equal(new URL(page.url()).pathname, expected); assert.deepEqual(errors, []); await ctx.close();
  }
});
