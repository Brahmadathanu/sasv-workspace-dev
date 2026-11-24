// Batch Governance (REAL page, real Chromium) against the REAL isolated PostgreSQL server: S2–S6 as accepted + the real Costing route
// engine + S7a/S7b (and a second database WITHOUT S7). No handwritten server model is involved: every RPC and table read is executed by
// PostgreSQL as the `authenticated` role with the user's JWT subject. No production access, no network. Skips honestly when PostgreSQL or
// Playwright is unavailable. MIS_G7_EVIDENCE=<dir> writes screenshots.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startPg } from '../../supabase/tests/mis_g7/pg_harness.mjs';
import { buildS7Databases, SIGNER, PACKER, EXCESS, NOBODY, SIGNV, PACKV, EXECV } from '../../supabase/tests/mis_g7/s7/build_db.mjs';
import { createBridge } from './pg-bridge.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let chromium = null;
try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch { /* skipped below */ }
const pg = startPg();
const SK = !chromium ? 'Playwright unavailable' : !pg ? 'BLOCKED: local PostgreSQL unavailable' : false;
if (!SK) buildS7Databases(pg, ['live7']);
const EVID = process.env.MIS_G7_EVIDENCE; if (EVID) fs.mkdirSync(EVID, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(root, /^\/(shared|utilities-hub|sw\.js)(\/|$)/.test(p) ? `public${p}` : p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = chromium && !SK ? await chromium.launch() : null;
test.after(async () => { await browser?.close(); server.close(); pg?.stop(); });

const newKey = () => crypto.randomUUID();
const sql = (db, s, uid) => { const r = pg.psql(db, s, uid === undefined ? {} : { uid }); assert.equal(r.status, 0, r.err); return r.out.split('\n').pop(); };
let n = 0; const bn = (p) => `${p}${++n}`;
async function open(uid, { db = 'live7', width = 1280, height = 800 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const bridge = createBridge(pg, db, () => uid);
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(base)) return r.fallback();
    if (u === 'https://bridge.test/call') { const out = bridge.handle(JSON.parse(r.request().postData())); return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(out) }); }
    if (u.startsWith('https://esm.sh/')) return r.fulfill({ contentType: 'text/javascript', body: `import { createBridgeClient } from "${base}/scripts/mis-g7-client/bridge-client.mjs"; export const createClient = () => createBridgeClient();` });
    return r.abort();
  });
  await page.addInitScript((u) => { window.__uid = u; }, uid);
  await page.goto(`${base}/shared/mis-batch-governance.html`);
  await page.waitForSelector('#app:not([hidden]), #gate:not([hidden])');
  return { page, ctx, errors, bridge };
}
const shot = async (page, name) => { if (EVID) await page.screenshot({ path: path.join(EVID, name), fullPage: true }); };
const pick = async (page, input, text) => { await page.fill(input, text); await page.getByRole('option', { name: text, exact: true }).first().click(); };
async function select(page, product, batch) {
  await pick(page, '#productInput', product); await page.click('#batchInput'); await page.waitForFunction(() => document.querySelectorAll('#batchInput-list li').length > 0);
  await page.fill('#batchInput', batch); await page.keyboard.press('Enter'); await page.waitForFunction((b) => document.getElementById('identity').textContent.includes(`Batch ${b}`) && !!document.querySelector('#panel-sign .mbg-card'), batch);
}
const mkBatch = (item, b, date, qty = 10) => sql('live7', `SELECT public.s7_batch('${item}','${b}','${date}',${qty})`);
const mkPack = (item, b) => sql('live7', `SELECT public.s7_event(public.s7_log('${item}','${b}','Bottling','2026-11-11'))`);
async function signUi(page, logId, qty = '10') {
  await page.click(`#logTable tr[data-log="${logId}"]`); await page.waitForSelector('#stepTable'); await page.waitForFunction(() => !!document.querySelector('#stepTable tr[aria-selected="true"]'));
  await page.fill('#mqty', qty); await page.fill('#evref', 'WB-UI'); await page.click('#signBtn'); await page.click('#mSign'); await page.waitForSelector("#banner:has-text('Stage signed')");
}
const dbSigned = (b) => Number(sql('live7', `SELECT count(*) FROM app_private.mis_batch_stage_event WHERE batch_number='${b}' AND event_kind='SIGN'`));
const ledger = (b) => Number(sql('live7', `SELECT coalesce(sum(qty_base),0) FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}'`));

test('signer without Production Route Manager access: route comes from the server context of the chosen log; signature persists in PostgreSQL and in a fresh session', { skip: SK }, async () => {
  const b = bn('RS'); const w = mkBatch('Inherited', b, '2026-11-10');
  const a = await open(SIGNER); await select(a.page, 'Inherited', b);
  assert.match(await a.page.textContent('#panel-sign'), /Select the work log that evidences the stage/);
  await signUi(a.page, w);
  assert.equal(dbSigned(b), 1); assert.match(await a.page.textContent('#sigTable'), /FG bulk/); assert.match(await a.page.textContent('#sigTable'), /Signed/);
  assert.equal(sql('live7', `SELECT route_id::text||':'||route_step_id FROM app_private.mis_batch_stage_event WHERE batch_number='${b}'`), '-11:103');   // inherited route identity
  const rpcs = a.bridge.calls.filter((c) => c.kind === 'rpc').map((c) => c.name); assert.ok(rpcs.includes('mis_get_batch_route_context_v1')); assert.ok(!rpcs.includes('rpc_get_effective_product_process_route'));
  await shot(a.page, '10-bridge-sign-persisted.png');
  // another user / device / session: signed state is server truth
  const c = await open(SIGNV); await select(c.page, 'Inherited', b);
  await c.page.waitForSelector('#sigTable'); assert.match(await c.page.textContent('#identity'), /Signed/); assert.equal(await c.page.$('#signBtn'), null); assert.equal(await c.page.$('[data-void]'), null);
  const p = await open(PACKER); await select(p.page, 'Inherited', b); await p.page.click('#tab-pack'); assert.match(await p.page.textContent('#panel-pack'), /FG bulk stage[\s\S]*Signed/);
  assert.deepEqual([a.errors, c.errors, p.errors], [[], [], []]); await a.ctx.close(); await c.ctx.close(); await p.ctx.close();
});

test('product route with ADD/REPLACE/BYPASS overrides: ADDED step (negative id) signs through the UI; a BYPASSed step is not offered', { skip: SK }, async () => {
  const b = bn('OV'); mkBatch('ProductRoute', b, '2026-11-10'); const wh = sql('live7', `SELECT public.s7_log('ProductRoute','${b}','Heating','2026-11-11')`);
  const a = await open(SIGNER); await select(a.page, 'ProductRoute', b);
  await a.page.click(`#logTable tr[data-log="${wh}"]`); await a.page.waitForSelector('#stepTable');
  const rows = await a.page.$$eval('#stepTable tbody tr', (r) => r.map((x) => x.textContent)); assert.ok(rows.some((t) => /Heating[\s\S]*Product step/.test(t))); assert.ok(rows.some((t) => /Blending/.test(t))); assert.ok(!rows.some((t) => /Labelling/.test(t)));
  await a.page.waitForFunction(() => /Heating/.test(document.querySelector('#stepTable tr[aria-selected="true"]')?.textContent || ''));
  await a.page.fill('#evref', 'WB-H'); await a.page.click('#signBtn'); await a.page.click('#mSign'); await a.page.waitForSelector("#banner:has-text('Stage signed')");
  assert.equal(sql('live7', `SELECT route_id::text||':'||route_step_id FROM app_private.mis_batch_stage_event WHERE batch_number='${b}'`), '21:-701'); await a.ctx.close();
});

test('route gaps and identity discrepancies from the server are shown with their codes (no route / ambiguous BMR / overlap)', { skip: SK }, async () => {
  const nr = bn('NR'); const w1 = mkBatch('NoRoute', nr, '2026-11-10');
  const a = await open(SIGNER); await select(a.page, 'NoRoute', nr); await a.page.click(`#logTable tr[data-log="${w1}"]`); await a.page.waitForFunction(() => /No approved route covers this product/.test(document.getElementById('panel-sign').textContent)); await shot(a.page, '11-bridge-route-gap.png');
  const ov = bn('OVL'); const w2 = mkBatch('Overlap', ov, '2026-07-01'); await select(a.page, 'Overlap', ov); await a.page.click(`#logTable tr[data-log="${w2}"]`); await a.page.waitForFunction(() => /More than one approved route/.test(document.getElementById('panel-sign').textContent));
  const am = bn('AM'); const w3 = mkBatch('AmbiguousBmr', am, '2026-11-10'); sql('live7', `INSERT INTO public.bmr_details VALUES ((SELECT max(id)+1 FROM public.bmr_details),28,'${am}','Released')`);
  await select(a.page, 'AmbiguousBmr', am); assert.match(await a.page.textContent('#identity'), /BMR ambiguous \(2\)/); await a.page.click(`#logTable tr[data-log="${w3}"]`); await a.page.waitForFunction(() => /does not resolve to exactly one BMR/.test(document.getElementById('panel-sign').textContent));
  await a.ctx.close();
});

test('authoritative packing preview equals the posting; unsigned batch is blocked by the preview; mandatory FG stage gate', { skip: SK }, async () => {
  const b = bn('PK'); const w = mkBatch('Inherited', b, '2026-11-10'); const ev = mkPack('Inherited', b);
  const a = await open(PACKER); await select(a.page, 'Inherited', b); await a.page.click('#tab-pack'); await a.page.selectOption('#eventSel', ev); await a.page.waitForSelector('#skuTable');
  await a.page.fill('input[data-sku="10"]', '4'); await a.page.waitForFunction(() => /FG bulk stage is not signed/.test(document.getElementById('packPreview').textContent));
  assert.equal(await a.page.$eval('#packBtn', (x) => x.disabled), true); assert.match(await a.page.textContent('#packPreview'), /Not verified/);
  const s = await open(SIGNER); await select(s.page, 'Inherited', b); await signUi(s.page, w); await s.ctx.close();
  await a.page.click('#tab-sign'); await a.page.click('#tab-pack'); await a.page.fill('input[data-sku="10"]', '4'); await a.page.fill('input[data-sku="11"]', '2');
  await a.page.waitForFunction(() => /Ready to post/.test(document.getElementById('packPreview').textContent));
  const pv = await a.page.textContent('#packPreview'); assert.match(pv, /Required\s*2\.5 kg/); assert.match(pv, /Available\s*10 kg/); assert.match(pv, /Balance after\s*7\.5 kg/); await shot(a.page, '12-bridge-pack-preview.png');
  assert.equal(await a.page.$eval('#packBtn', (x) => x.disabled), false); await a.page.click('#packBtn'); await a.page.waitForSelector('#packResult .mbg-banner');
  const r = await a.page.textContent('#packResult'); assert.match(r, /Required bulk\s*2\.5 kg/); assert.match(r, /Available before\s*10 kg/); assert.match(r, /Balance after\s*7\.5 kg/); assert.equal(ledger(b), 7.5);
  const names = a.bridge.calls.filter((c) => c.kind === 'rpc').map((c) => c.name); assert.ok(names.includes('mis_preview_pack_fg_bulk_v1') && names.includes('mis_pack_fg_bulk_v1'));
  await a.ctx.close();
});

test('real insufficient stock + measured excess: preview shows the shortfall, one key, atomic post; unauthorized packer gets no excess controls', { skip: SK }, async () => {
  const b = bn('EX'); const w = mkBatch('Inherited', b, '2026-11-10'); const ev = mkPack('Inherited', b);
  const s = await open(SIGNER); await select(s.page, 'Inherited', b); await signUi(s.page, w); await s.ctx.close();
  const a = await open(EXCESS); await select(a.page, 'Inherited', b); await a.page.click('#tab-pack'); await a.page.selectOption('#eventSel', ev); await a.page.waitForSelector('#skuTable');
  await a.page.fill('input[data-sku="10"]', '30'); await a.page.waitForFunction(() => /Insufficient bulk/.test(document.getElementById('packPreview').textContent));
  assert.match(await a.page.textContent('#packPreview'), /Shortfall\s*5 kg/); await a.page.click('#packBtn'); await a.page.waitForSelector('#modalRoot:not([hidden])');
  assert.match(await a.page.textContent('#modalBody'), /Required\s*15 kg/); assert.equal(ledger(b), 10); await shot(a.page, '13-bridge-excess-modal.png');
  await a.page.fill('#exQty', '5'); await a.page.fill('#exReason', 'scale reading'); await a.page.fill('#exEvidence', 'WB-9'); await a.page.click('#mPost'); await a.page.waitForSelector('#packResult .mbg-banner');
  assert.match(await a.page.textContent('#packResult'), /Measured excess posted\s*5 kg/); assert.equal(ledger(b), 0);
  const keys = new Set(a.bridge.calls.filter((c) => c.kind === 'rpc' && c.name === 'mis_pack_fg_bulk_v1').map((c) => c.args.p_request_id)); assert.equal(keys.size, 1);
  assert.equal(Number(sql('live7', `SELECT qty_base FROM app_private.mis_fg_signed_excess_receipt WHERE batch_number='${b}'`)), 5);
  await a.ctx.close();
  const b2 = bn('EN'); const w2 = mkBatch('Inherited', b2, '2026-11-10'); const ev2 = mkPack('Inherited', b2); const s2 = await open(SIGNER); await select(s2.page, 'Inherited', b2); await signUi(s2.page, w2); await s2.ctx.close();
  const u = await open(PACKER); await select(u.page, 'Inherited', b2); await u.page.click('#tab-pack'); await u.page.selectOption('#eventSel', ev2); await u.page.waitForSelector('#skuTable'); await u.page.fill('input[data-sku="10"]', '30');
  await u.page.waitForFunction(() => /Insufficient bulk/.test(document.getElementById('packPreview').textContent)); await u.page.click('#packBtn'); await u.page.waitForSelector("#banner:has-text('Insufficient')");
  assert.equal(await u.page.$('#exQty'), null); assert.equal(ledger(b2), 10); await u.ctx.close();
});

test('real corrections: preview shows stock impact and depletion basis; historical line is blocked as not verified; removal returns stock', { skip: SK }, async () => {
  const b = bn('CR'); const w = mkBatch('Inherited', b, '2026-11-10'); const ev = mkPack('Inherited', b);
  const s = await open(SIGNER); await select(s.page, 'Inherited', b); await signUi(s.page, w); await s.ctx.close();
  const k = newKey(); sql('live7', `SELECT public.mis_pack_fg_bulk_v1('${k}',${ev},'[{"sku_id":10,"count":6},{"sku_id":11,"count":4}]'::jsonb,NULL)`, PACKER);
  const ids = sql('live7', `SELECT string_agg(id::text,',' ORDER BY id) FROM public.event_skus WHERE packaging_event_id=${ev}`).split(','); assert.equal(ledger(b), 6);
  const hist = sql('live7', `WITH i AS (INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ev},11,8) RETURNING id) SELECT id FROM i`); sql('live7', `DELETE FROM public.fg_bulk_stock_ledger WHERE source_table='event_skus' AND source_id=${hist}`);
  const a = await open(PACKER); await select(a.page, 'Inherited', b); await a.page.click('#tab-corr'); await a.page.selectOption('#eventSel', ev); await a.page.waitForSelector('[data-line]');
  await a.page.click(`[data-line="${ids[0]}"]`); await a.page.fill('#cNew', '2'); await a.page.waitForFunction(() => /Ready to post/.test(document.getElementById('cvPrev').textContent));
  const cv = await a.page.textContent('#cvPrev'); assert.match(cv, /Stock impact\s*\+?2 kg returned to stock/); assert.match(cv, /matches/); await a.page.fill('#cReason', 'miscount'); await shot(a.page, '14-bridge-correction-preview.png');
  await a.page.click('#mPost'); await a.page.waitForSelector('#corrResult .mbg-banner'); assert.match(await a.page.textContent('#corrResult'), /6 → 2/); assert.equal(ledger(b), 8);
  await a.page.click(`[data-line="${ids[1]}"]`); await a.page.fill('#cNew', '0'); await a.page.waitForFunction(() => /Ready to post/.test(document.getElementById('cvPrev').textContent)); await a.page.fill('#cReason', 'entered in error'); await a.page.click('#mPost');
  await a.page.waitForSelector("#corrResult:has-text('Line removed')"); assert.equal(ledger(b), 9);
  await a.page.click(`[data-line="${hist}"]`); await a.page.fill('#cNew', '1'); await a.page.waitForFunction(() => /no recorded depletion evidence/i.test(document.getElementById('cvPrev').textContent));
  assert.equal(await a.page.$eval('#mPost', (x) => x.disabled), true); assert.match(await a.page.textContent('#cvPrev'), /Not verified/); await a.page.keyboard.press('Escape'); assert.equal(ledger(b), 9); await a.ctx.close();
});

test('source revision shows SOURCE_CHANGED from the server; Done closure does not; void + re-sign restores SIGNED', { skip: SK }, async () => {
  const b = bn('SC'); const w = mkBatch('Inherited', b, '2026-11-10'); const s = await open(SIGNER); await select(s.page, 'Inherited', b); await signUi(s.page, w);
  sql('live7', `SELECT set_config('app.fg_reconcile','1',false); UPDATE public.daily_work_log SET status='Done' WHERE id=${w}`);
  await select(s.page, 'Inherited', b); assert.match(await s.page.textContent('#identity'), /Signed/);
  sql('live7', `UPDATE public.daily_work_log SET storage_qty=9 WHERE id=${w}; INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id) VALUES (21,'${b}','2026-11-12',-1,-1,'kg','FG bulk storage (update)','daily_work_log',${w})`); await select(s.page, 'Inherited', b);
  await s.page.waitForFunction(() => /Source changed/.test(document.getElementById('identity').textContent)); assert.match(await s.page.textContent('#sigTable'), /Void to re-sign/);
  await s.page.click('[data-void]'); await s.page.fill('#cReason', 'quantity corrected in log'); await s.page.click('#mCorr'); await s.page.waitForSelector("#banner:has-text('Signature voided')");
  await s.page.waitForFunction(() => /Unsigned/.test(document.getElementById('identity').textContent)); await signUi(s.page, w, '9'); assert.equal(dbSigned(b), 2); await s.ctx.close();
});

test('live exception summary with drill-down: counts, units, historical NOT_VERIFIED, paging and jump to the batch', { skip: SK }, async () => {
  const x = bn('XC'); mkBatch('Inherited', x, '2026-11-12'); mkBatch('NoRoute', bn('XN'), '2026-11-12');
  const a = await open(EXECV); await a.page.click('#tab-exc'); await a.page.waitForSelector('#excTable');
  assert.match(await a.page.textContent('#excLive'), /distinct product\/batch per state/); assert.match(await a.page.textContent('#excLive'), /Governance cut-over/); assert.match(await a.page.textContent('#excLive'), /without recorded depletion/);
  await a.page.fill('#excFrom', '2026-11-01'); await a.page.fill('#excTo', '2026-11-30'); await a.page.click('#excGo'); await a.page.waitForFunction(() => document.querySelectorAll('#excTable tbody tr[data-x], #excTable tbody tr').length > 0);
  assert.ok((await a.page.$$eval('.mbg-tile', (t) => t.length)) >= 2); await shot(a.page, '15-bridge-exceptions.png');
  await a.page.fill('#excFrom', '2026-01-01'); await a.page.click('#excGo'); await a.page.waitForFunction(() => /at most 92 days/.test(document.getElementById('excLive').textContent));
  await a.page.fill('#excFrom', '2026-11-01'); await a.page.click('#excGo'); await a.page.waitForSelector('#excTable [data-open]');
  const first = await a.page.$eval('#excTable [data-open]', (e) => e.dataset.open); await a.page.click('#excTable [data-open]'); const [pid, bnum] = first.split('|');
  await a.page.waitForFunction((b) => document.getElementById('identity').textContent.includes(`Batch ${b}`), bnum); assert.equal(await a.page.getAttribute('#tab-sign', 'aria-selected'), 'true'); assert.equal(await a.page.$eval('#productInput', (i) => i.value.length > 0), true); void pid;
  await a.ctx.close();
  const none = await open(SIGNER); await none.page.click('#tab-exc'); assert.match(await none.page.textContent('#excLive'), /visible to Executive MIS viewers/); await none.ctx.close();
});

test('unauthorized users: no MIS rights -> closed gate; view-only roles get no write controls; real server refusals still apply', { skip: SK }, async () => {
  const g = await open(NOBODY); assert.equal(await g.page.$eval('#gate', (e) => e.hidden), false); await g.ctx.close();
  const b = bn('UA'); const w = mkBatch('Inherited', b, '2026-11-10'); const ev = mkPack('Inherited', b);
  const v = await open(SIGNV); await select(v.page, 'Inherited', b); await v.page.click(`#logTable tr[data-log="${w}"]`); await v.page.waitForSelector('#stepTable'); assert.equal(await v.page.$('#signBtn'), null); await v.ctx.close();
  const pv = await open(PACKV); await select(pv.page, 'Inherited', b); await pv.page.click('#tab-pack'); await pv.page.selectOption('#eventSel', ev); await pv.page.waitForSelector('#skuTable'); assert.equal(await pv.page.$('#packBtn'), null); assert.equal(await pv.page.$eval('input[data-sku="10"]', (i) => i.disabled), true); await pv.ctx.close();
});

test('S7 NOT installed: the same page degrades to the S2–S6 contract; packing still works through real S4; exceptions say S7 is required', { skip: SK }, async () => {
  const b = bn('NS'); const w = sql('pre7', `SELECT public.s7_batch('ProductRoute','${b}','2026-10-31')`); const ev = sql('pre7', `SELECT public.s7_event(public.s7_log('ProductRoute','${b}','Bottling','2026-11-01'))`);
  assert.equal(JSON.parse(sql('pre7', `SELECT public.mis_sign_batch_stage_v1('${newKey()}',22,'${b}',${w},103,1,10,'WB')`, SIGNER)).ok, true);            // S2 signer on a product route (positive base ids)
  const a = await open(PACKER, { db: 'pre7' }); await select(a.page, 'ProductRoute', b); await a.page.click('#tab-pack'); await a.page.selectOption('#eventSel', ev); await a.page.waitForSelector('#skuTable');
  await a.page.fill('input[data-sku="20"]', '4'); await a.page.waitForTimeout(500); assert.equal(await a.page.textContent('#packPreview'), ''); assert.match(await a.page.textContent('#panel-pack'), /required bulk is shown after posting/);
  await a.page.click('#packBtn'); await a.page.waitForSelector('#packResult .mbg-banner'); assert.match(await a.page.textContent('#packResult'), /Required bulk\s*2 kg/); assert.equal(Number(sql('pre7', `SELECT coalesce(sum(qty_base),0) FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}'`)), 8);
  assert.ok(a.bridge.calls.some((c) => c.name === 'mis_get_batch_stage_status_v1')); await a.ctx.close();
  const e = await open(EXECV, { db: 'pre7' }); await e.page.click('#tab-exc'); await e.page.waitForFunction(() => /not installed yet/.test(document.getElementById('excLive').textContent)); await e.ctx.close();
});

test('narrow layouts against the real server: 390px full-page modal and no horizontal overflow on the new views', { skip: SK }, async () => {
  const b = bn('NW'); const w = mkBatch('Inherited', b, '2026-11-10'); const ev = mkPack('Inherited', b);
  const s = await open(SIGNER, { width: 390, height: 844 }); await select(s.page, 'Inherited', b); await signUi(s.page, w);
  assert.ok(await s.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)); await shot(s.page, '16-bridge-sign-390.png'); await s.ctx.close();
  const a = await open(EXCESS, { width: 390, height: 844 }); await select(a.page, 'Inherited', b); await a.page.click('#tab-pack'); await a.page.selectOption('#eventSel', ev); await a.page.waitForSelector('#skuTable'); await a.page.fill('input[data-sku="10"]', '30');
  await a.page.waitForFunction(() => /Insufficient bulk/.test(document.getElementById('packPreview').textContent)); assert.ok(await a.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)); await shot(a.page, '17-bridge-preview-390.png');
  await a.page.click('#packBtn'); await a.page.waitForSelector('#modalRoot:not([hidden])'); const m = await a.page.$eval('#modalBox', (e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; }); assert.ok(Math.abs(m.w - 390) <= 1 && Math.abs(m.h - 844) <= 1); await a.ctx.close();
});

/* ───────── hand-off from existing production logging (default-disabled transition path), real server ───────── */
async function openHost(uid, db = 'live7') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const bridge = createBridge(pg, db, () => uid);
  await page.route('**/*', (r) => {
    const u = r.request().url(); if (u.startsWith(base)) return r.fallback();
    if (u === 'https://bridge.test/call') { const out = bridge.handle(JSON.parse(r.request().postData())); return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(out) }); }
    if (u.startsWith('https://esm.sh/')) return r.fulfill({ contentType: 'text/javascript', body: `import { createBridgeClient } from "${base}/scripts/mis-g7-client/bridge-client.mjs"; export const createClient = () => createBridgeClient();` });
    return r.abort();
  });
  await page.addInitScript((u) => { window.__uid = u; }, uid);
  await page.goto(`${base}/scripts/mis-g7-client/handoff-host.html`); await page.waitForFunction(() => !!window.run);
  return { page, ctx, errors, bridge };
}
test('hand-off is DEFAULT-DISABLED: the shipped flag is false, adds no DOM and makes no request, and the legacy save flow is untouched', { skip: SK }, async () => {
  const b = bn('HO0'); const w = mkBatch('Inherited', b, '2026-11-10'); const h = await openHost(SIGNER);
  assert.equal(await h.page.evaluate(() => window.api.GOVERNED_LOGGING_HANDOFF), false); assert.equal(await h.page.evaluate(() => window.api.handoffParam(5, 'FG bulk storage')), '');
  const r = await h.page.evaluate((id) => window.run({ search: `?mis_sign=${id}` }), w);   // shipped default flag
  assert.deepEqual([r.shown, r.reason], [false, 'disabled']); assert.equal(await h.page.$('#mis-handoff'), null); assert.equal(h.bridge.calls.length, 0); assert.equal(dbSigned(b), 0);
  assert.equal(await h.page.evaluate(() => window.api.savedWorkLogId([{ daily_work_log_id: 77 }])), 77); await h.ctx.close();
});
test('hand-off (flag on): the signer signs the FG bulk stage right after logging with the logged quantity; one key; evidence required; persisted in PostgreSQL', { skip: SK }, async () => {
  const b = bn('HO1'); const w = mkBatch('Inherited', b, '2026-11-10', 12); const h = await openHost(SIGNER);
  const r = await h.page.evaluate((id) => window.run({ flag: true, search: `?mis_sign=${id}` }), w); assert.deepEqual([r.shown, r.reason], [true, 'offered']);
  assert.match(await h.page.textContent('#mis-handoff'), /not signed[\s\S]*12 kg/); await h.page.click('#misHoSign'); assert.match(await h.page.textContent('#misHoMsg'), /Evidence reference is required/); assert.equal(dbSigned(b), 0);
  await h.page.fill('#misHoEv', 'WB-HO'); await h.page.click('#misHoSign'); await h.page.waitForFunction(() => /Signed \(event/.test(document.getElementById('misHoMsg').textContent));
  assert.equal(dbSigned(b), 1); assert.equal(sql('live7', `SELECT measured_qty_base FROM app_private.mis_batch_stage_event WHERE batch_number='${b}'`), '12.000000'.replace(/\.?0+$/, '')); await shot(h.page, '18-handoff-signed.png');
  const keys = new Set(h.bridge.calls.filter((c) => c.name === 'mis_sign_batch_stage_v1').map((c) => c.args.p_idempotency_key)); assert.equal(keys.size, 1);
  const again = await openHost(PACKER); const r2 = await again.page.evaluate((id) => window.run({ flag: true, search: `?mis_sign=${id}` }), w); assert.equal(r2.shown, false); await h.ctx.close(); await again.ctx.close();
});
test('hand-off (flag on) shows nothing without the signer right, when already signed, off-activity, or when S7 is absent; a route gap is stated, not hidden', { skip: SK }, async () => {
  const b = bn('HO2'); const w = mkBatch('Inherited', b, '2026-11-10'); const run = (h, id = w) => h.page.evaluate((x) => window.run({ flag: true, search: `?mis_sign=${x}` }), id);
  for (const [uid, why] of [[SIGNV, 'no-right'], [PACKER, 'no-right'], [NOBODY, 'no-right']]) { const h = await openHost(uid); const r = await run(h); assert.deepEqual([r.shown, r.reason], [false, why]); assert.equal(await h.page.$('#mis-handoff'), null); await h.ctx.close(); }
  const other = sql('live7', `SELECT public.s7_log('Inherited','${b}','Mixing','2026-11-11')`); const h = await openHost(SIGNER); assert.equal((await run(h, other)).reason, 'not-applicable'); assert.equal((await run(h, 'x')).reason, 'no-log');
  const nr = bn('HO3'); const wn = mkBatch('NoRoute', nr, '2026-11-10'); const g = await run(h, wn); assert.deepEqual([g.shown, g.reason, g.code], [true, 'blocked', 'PRODUCT_ROUTE_COVERAGE']); assert.match(await h.page.textContent('#mis-handoff'), /cannot be signed yet[\s\S]*No approved route/); assert.equal(await h.page.$('#misHoSign'), null);
  await h.page.evaluate((id) => window.run({ flag: true, search: `?mis_sign=${id}` }), w); await h.page.fill('#misHoEv', 'E'); await h.page.click('#misHoSign'); await h.page.waitForFunction(() => /Signed \(event/.test(document.getElementById('misHoMsg').textContent));
  assert.equal((await run(h)).reason, 'already-signed'); await h.ctx.close();
  const bp = bn('HO4'); const wp = sql('pre7', `SELECT public.s7_batch('ProductRoute','${bp}','2026-10-31')`); const a = await openHost(SIGNER, 'pre7'); assert.equal((await run(a, wp)).reason, 's7-absent'); assert.equal(await a.page.$('#mis-handoff'), null); await a.ctx.close();
});

/* ───────── exact FG receipt evidence (S7b) through the real page and the real server ───────── */
test('transfer-only / unrelated positive stock is not a receipt: the signer is refused with a clear reason, exceptions say why, preview agrees', { skip: SK }, async () => {
  const b = bn('TR'); const w = mkBatch('Inherited', b, '2026-11-10'); sql('live7', `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}'`);
  sql('live7', `INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id) VALUES (21,'${b}','2026-11-12',10,10,'kg','TRANSFER_IN','fg_bulk_internal_transfer',77)`);
  const s = await open(SIGNER); await select(s.page, 'Inherited', b);
  await s.page.click(`#logTable tr[data-log="${w}"]`); await s.page.waitForFunction(() => !!document.querySelector('#stepTable tr[aria-selected="true"]'));
  await s.page.fill('#mqty', '10'); await s.page.fill('#evref', 'WB-TR'); await s.page.click('#signBtn'); await s.page.click('#mSign');
  await s.page.waitForFunction(() => /No ledger receipt was posted for this FG work log/.test(document.getElementById('modalMsg').textContent)); assert.match(await s.page.textContent('#modalMsg'), /Transfers, packaging returns and manual stock entries are not receipts/); assert.equal(dbSigned(b), 0);
  await shot(s.page, '19-bridge-receipt-refused.png'); await s.ctx.close();
  const e = await open(EXECV); await e.page.click('#tab-exc'); await e.page.fill('#excFrom', '2026-11-01'); await e.page.fill('#excTo', '2026-11-30'); await e.page.click('#excGo');
  await e.page.waitForFunction((x) => [...document.querySelectorAll('#excTable tbody tr')].some((r) => r.textContent.includes(x) && /Missing FG receipt/.test(r.textContent) && /No ledger receipt posted by the FG work log/.test(r.textContent)), b); await e.ctx.close();
});
test('legitimate receipt update through the UI: edit invalidates the signature (Source changed), void, re-sign certifies the new exact net', { skip: SK }, async () => {
  const b = bn('UP'); const w = mkBatch('Inherited', b, '2026-11-10'); const s = await open(SIGNER); await select(s.page, 'Inherited', b); await signUi(s.page, w);
  sql('live7', `UPDATE public.daily_work_log SET storage_qty=12 WHERE id=${w}; INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id) VALUES (21,'${b}','2026-11-12',2,2,'kg','FG bulk storage (update)','daily_work_log',${w})`);
  await select(s.page, 'Inherited', b); await s.page.waitForFunction(() => /Source changed/.test(document.getElementById('identity').textContent));
  await s.page.click('[data-void]'); await s.page.fill('#cReason', 'log quantity updated'); await s.page.click('#mCorr'); await s.page.waitForSelector("#banner:has-text('Signature voided')");
  await signUi(s.page, w, '12'); assert.equal(dbSigned(b), 2); assert.equal(ledger(b), 12); await s.ctx.close();
});
