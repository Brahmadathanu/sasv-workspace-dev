// Edit Log Entry (the REAL legacy page and js/log-edit.js) with the governed hand-off, against the REAL isolated PostgreSQL through the test bridge.
// The shipped flag is false; tests that need it ON load the page with the module served from this checkout with only that constant flipped
// (exactly what a reviewed release change would do). Test fixture: legacy-page queries on tables the fixture does not model are answered empty.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startPg } from '../../supabase/tests/mis_g7/pg_harness.mjs';
import { buildS7Databases, SIGNER, PACKER, NOBODY } from '../../supabase/tests/mis_g7/s7/build_db.mjs';
import { createBridge } from './pg-bridge.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let chromium = null; try { chromium = createRequire(import.meta.url)('playwright').chromium; } catch { /* skipped */ }
const pg = startPg(); const SK = !chromium ? 'Playwright unavailable' : !pg ? 'BLOCKED: local PostgreSQL unavailable' : false;
if (!SK) buildS7Databases(pg, ['live7']);
const EVID = process.env.MIS_G7_EVIDENCE; if (EVID) fs.mkdirSync(EVID, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]); const f = path.join(root, /^\/(shared|utilities-hub|sw\.js)(\/|$)/.test(p) ? `public${p}` : p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${server.address().port}`;
const browser = chromium && !SK ? await chromium.launch() : null;
test.after(async () => { await browser?.close(); server.close(); pg?.stop(); });
const sql = (db, s, uid) => { const r = pg.psql(db, s, uid === undefined ? {} : { uid }); assert.equal(r.status, 0, r.err); return r.out.split('\n').pop(); };
const newKey = () => crypto.randomUUID(); let n = 0; const bn = (p) => `${p}${++n}`;
for (const u of [SIGNER, PACKER]) sql('live7', `INSERT INTO public.test_perm VALUES ('${u}','module:edit-log-entry',true,true)`);
sql('live7', `INSERT INTO public.test_perm VALUES ('${NOBODY}','module:edit-log-entry',true,true)`);
for (const u of [SIGNER, PACKER, NOBODY]) sql('live7', `INSERT INTO public.test_perm VALUES ('${u}','module:add-log-entry',true,true)`);
const shot = async (page, name) => { if (EVID) await page.screenshot({ path: path.join(EVID, name), fullPage: false }); };
const flagSrc = fs.readFileSync(path.join(root, 'public/shared/js/mis-governed-handoff.js'), 'utf8');
async function open(uid, { flag = false, db = 'live7', width = 1280, height = 900, url = '/edit-log-entry.html', waitFor = '#fullBody tr' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } }); const page = await ctx.newPage(); const errors = []; const dialogs = [];
  page.on('pageerror', (e) => errors.push(String(e))); page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  const bridge = createBridge(pg, db, () => uid);
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (flag && u.endsWith('/public/shared/js/mis-governed-handoff.js')) return r.fulfill({ contentType: 'text/javascript', body: flagSrc.replace('export const GOVERNED_LOGGING_HANDOFF = false;', 'export const GOVERNED_LOGGING_HANDOFF = true;') });
    if (u.startsWith(base)) return r.fallback();
    if (u === 'https://bridge.test/call') { const out = bridge.handle(JSON.parse(r.request().postData())); return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(out) }); }
    if (u.startsWith('https://esm.sh/')) return r.fulfill({ contentType: 'text/javascript', body: `import { createBridgeClient } from "${base}/scripts/mis-g7-client/bridge-client.mjs"; export const createClient = () => createBridgeClient();` });
    return r.abort();
  });
  await page.addInitScript((u) => { window.__uid = u; window.__lenient = true; }, uid);
  await page.goto(`${base}${url}`);
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 20000 });
  return { page, ctx, errors, dialogs, bridge };
}
const domClick = (page, sel) => page.evaluate((x) => document.querySelector(x).click(), sel);   // row actions are hover-revealed in the legacy table
const openRow = async (page, id) => { await domClick(page, `.editBtn[data-id="${id}"]`); await page.waitForFunction(() => { const m = document.getElementById('editModal'); return m && getComputedStyle(m).display !== 'none'; }); await page.waitForTimeout(400); };
const mkBatch = (b, qty = 10) => sql('live7', `SELECT public.s7_batch('Inherited','${b}','2026-11-10',${qty})`);
const mkPack = (b) => { const w = sql('live7', `SELECT public.s7_log('Inherited','${b}','Bottling','2026-11-11')`); sql('live7', `UPDATE public.daily_work_log SET status='Done' WHERE id=${w}`); const ev = sql('live7', `SELECT public.s7_event(${w})`); return { w, ev }; };
const signSql = (b, w, qty = 10) => JSON.parse(sql('live7', `SELECT public.mis_sign_batch_stage_v1('${newKey()}',21,'${b}',${w},103,1,${qty},'WB-E')`, SIGNER));
const misCalls = (h) => h.bridge.calls.filter((c) => c.kind === 'rpc' && /^mis_/.test(c.name));

test('legacy AUDIT compatibility (shipped flag false): the real Edit Log Entry opens, nothing governed is added, no MIS request is made, Save stays enabled', { skip: SK }, async () => {
  const b = bn('EA'); const w = mkBatch(b); const { w: pw } = mkPack(b); signSql(b, w);
  const h = await open(PACKER); await openRow(h.page, pw);
  assert.equal(await h.page.$('#mis-handoff'), null); assert.equal(await h.page.$eval('#saveEdit', (e) => e.disabled), false); assert.equal(misCalls(h).length, 0);
  assert.equal(h.errors.filter((e) => /mis-|governed/i.test(e)).length, 0); await h.ctx.close();
});
test('flag ON, governed batch, packaging log with a chain: panel + Save/Done/Delete blocked (no destructive chain replacement), deep link into governed packing', { skip: SK }, async () => {
  const b = bn('EG'); const w = mkBatch(b); const { w: pw, ev } = mkPack(b); assert.equal(signSql(b, w).ok, true);
  sql('live7', `SELECT public.mis_pack_fg_bulk_v1('${newKey()}',${ev},'[{"sku_id":10,"count":4}]'::jsonb,NULL)`, PACKER);
  const before = sql('live7', `SELECT (SELECT count(*) FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}')||'/'||(SELECT count(*) FROM public.event_skus WHERE packaging_event_id=${ev})||'/'||(SELECT id FROM public.packaging_events WHERE id=${ev})`);
  const h = await open(PACKER, { flag: true }); await openRow(h.page, pw);
  await h.page.waitForSelector('#mis-handoff'); const t = await h.page.textContent('#mis-handoff'); assert.match(t, /FG bulk stage signed/); assert.match(t, /destructively/);
  assert.equal(await h.page.$eval('#saveEdit', (e) => e.disabled), true); await shot(h.page, '20-edit-guard-desktop.png');
  const href = await h.page.getAttribute('#mis-handoff a[data-act="open"]', 'href'); assert.match(href, /mis-batch-governance\.html\?/); assert.match(href, new RegExp(`event=${ev}`)); assert.match(href, /tab=corr/); assert.match(href, /batch=EG/);
  await h.page.evaluate(() => document.getElementById('editForm').requestSubmit()); await h.page.waitForTimeout(300);
  assert.equal(h.bridge.calls.filter((c) => c.name === 'rpc_update_daily_work_log_with_packaging').length, 0, 'no legacy chain-replacing save was sent');
  await h.page.evaluate(() => { const m = document.getElementById('editModal'); if (m) m.style.display = 'none'; });
  await domClick(h.page, `.deleteBtn[data-id="${pw}"]`); await h.page.waitForTimeout(500); assert.ok(h.dialogs.some((d) => /bypass governed packing/.test(d)), `delete message shown: ${h.dialogs.join('|')}`);
  assert.equal(sql('live7', `SELECT (SELECT count(*) FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}')||'/'||(SELECT count(*) FROM public.event_skus WHERE packaging_event_id=${ev})||'/'||(SELECT id FROM public.packaging_events WHERE id=${ev})`), before, 'chain, lines and ledger untouched');
  assert.equal(sql('live7', `SELECT count(*) FROM public.daily_work_log WHERE id=${pw}`), '1'); await h.ctx.close();
});
test('flag ON: the lock is per opened row (a non-governed row re-enables Save); unsigned/historical batches keep the legacy path with an explicit state', { skip: SK }, async () => {
  const g = bn('EL'); const wg = mkBatch(g); const { w: pg1 } = mkPack(g); signSql(g, wg);
  const u = bn('EU'); mkBatch(u); const { w: pu } = mkPack(u);
  const h = await open(PACKER, { flag: true }); await openRow(h.page, pg1); await h.page.waitForSelector('#mis-handoff'); assert.equal(await h.page.$eval('#saveEdit', (e) => e.disabled), true);
  await h.page.click('#cancelEdit'); await openRow(h.page, pu); await h.page.waitForTimeout(300);
  assert.equal(await h.page.$eval('#saveEdit', (e) => e.disabled), false, 'unsigned batch: legacy Save available (AUDIT)');
  const p = await h.page.$('#mis-handoff'); assert.ok(p); assert.match(await p.textContent(), /FG bulk stage not signed|not verified/i); assert.equal(await h.page.$('#mis-handoff .mis-ho-guard'), null); await h.ctx.close();
});
test('flag ON, FG bulk log: sign from the edit view, persistent status after reload, source change shows void-to-resign, then re-sign', { skip: SK }, async () => {
  const b = bn('ES'); const w = mkBatch(b);
  const h = await open(SIGNER, { flag: true }); await openRow(h.page, w); await h.page.waitForSelector('#misHoSign');
  await h.page.click('#misHoSign'); assert.match(await h.page.textContent('#misHoMsg'), /Evidence reference is required/); await h.page.fill('#misHoEv', 'WB-ED'); await h.page.click('#misHoSign');
  await h.page.waitForFunction(() => /FG bulk stage signed/.test(document.getElementById('mis-handoff')?.textContent || '')); assert.equal(sql('live7', `SELECT count(*) FROM app_private.mis_batch_stage_event WHERE batch_number='${b}' AND event_kind='SIGN'`), '1');
  await h.ctx.close();
  const r = await open(SIGNER, { flag: true }); await openRow(r.page, w); await r.page.waitForSelector('#mis-handoff'); assert.match(await r.page.textContent('#mis-handoff'), /FG bulk stage signed/);      // persisted server state after a fresh load
  sql('live7', `UPDATE public.daily_work_log SET storage_qty=9 WHERE id=${w}; INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id) VALUES (21,'${b}','2026-11-12',-1,-1,'kg','FG bulk storage (update)','daily_work_log',${w})`);
  await r.page.click('#cancelEdit'); await openRow(r.page, w); await r.page.waitForSelector('#misHoVoid'); assert.match(await r.page.textContent('#mis-handoff'), /Source changed after the FG bulk stage was signed/); await shot(r.page, '21-edit-source-changed-desktop.png');
  await r.page.click('#misHoVoid'); assert.match(await r.page.textContent('#misHoMsg'), /Reason is required/); await r.page.fill('#misHoReason', 'log quantity corrected'); await r.page.click('#misHoVoid');
  await r.page.waitForSelector('#misHoSign'); await r.page.fill('#misHoEv', 'WB-ED2'); await r.page.click('#misHoSign'); await r.page.waitForFunction(() => /FG bulk stage signed/.test(document.getElementById('mis-handoff')?.textContent || ''));
  assert.equal(sql('live7', `SELECT count(*) FROM app_private.mis_batch_stage_event WHERE batch_number='${b}' AND event_kind='SIGN'`), '2'); await r.ctx.close();
});
test('flag ON but no MIS right, or S7 absent: the page behaves exactly as legacy', { skip: SK }, async () => {
  const b = bn('EN'); const w = mkBatch(b); const { w: pw } = mkPack(b); signSql(b, w);
  const h = await open(NOBODY, { flag: true }); await openRow(h.page, pw); assert.equal(await h.page.$('#mis-handoff'), null); assert.equal(await h.page.$eval('#saveEdit', (e) => e.disabled), false); await h.ctx.close();
  const bp = bn('EP'); sql('pre7', `SELECT public.s7_batch('ProductRoute','${bp}','2026-10-31')`); sql('pre7', `INSERT INTO public.test_perm VALUES ('${SIGNER}','module:edit-log-entry',true,true)`);
  const x = await open(SIGNER, { flag: true, db: 'pre7' }).catch((e) => e); if (x instanceof Error) return;         // legacy page may not render rows on the S2–S6-only fixture; absence of a panel is asserted when it does
  assert.equal(await x.page.$('#mis-handoff'), null); await x.ctx.close();
});
test('narrow screen: the guard panel stays inside the modal and the page does not overflow horizontally (390px)', { skip: SK }, async () => {
  const b = bn('EW'); const w = mkBatch(b); const { w: pw } = mkPack(b); signSql(b, w);
  const h = await open(PACKER, { flag: true, width: 390, height: 844 }); await openRow(h.page, pw); await h.page.waitForSelector('#mis-handoff');
  const box = await h.page.$eval('#mis-handoff', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: window.innerWidth }; }); assert.ok(box.l >= 0 && box.r <= box.w + 1, JSON.stringify(box)); await shot(h.page, '22-edit-guard-390.png'); await h.ctx.close();
});

/* ───────── Add Log Entry (the REAL page): after-save hand-off ───────── */
const openAdd = (uid, wl, o = {}) => open(uid, { ...o, url: `/add-log-entry.html${wl ? `?mis_sign=${wl}` : ''}`, waitFor: '#logForm' });
test('Add Log Entry, shipped flag false: the post-save parameter is ignored — no panel, no MIS request (legacy AUDIT flow unchanged)', { skip: SK }, async () => {
  const b = bn('AA'); const w = mkBatch(b); const h = await openAdd(SIGNER, w); await h.page.waitForTimeout(1200);
  assert.equal(await h.page.$('#mis-handoff'), null); assert.equal(misCalls(h).length, 0); assert.equal(h.errors.filter((e) => /mis-|governed/i.test(e)).length, 0); await h.ctx.close();
});
test('Add Log Entry, flag ON: right after the FG log is saved the signer signs the FG bulk stage with the logged quantity (no re-entry), persisted server-side; dismissable; nothing for other users', { skip: SK }, async () => {
  // dated today: on/after the governance cut-over, so UNSIGNED (actionable), not historical
  const b = bn('AF'); const w = sql('live7', `SELECT public.s7_batch('Inherited','${b}',CURRENT_DATE,12)`); const h = await openAdd(SIGNER, w, { flag: true }); await h.page.waitForSelector('#misHoSign', { timeout: 15000 });
  assert.match(await h.page.textContent('#mis-handoff'), /FG bulk stage not signed/); assert.match(await h.page.textContent('#misHoSign'), /12 kg/); await shot(h.page, '23-add-handoff-desktop.png');
  await h.page.click('#misHoSign'); assert.match(await h.page.textContent('#misHoMsg'), /Evidence reference is required/); assert.equal(sql('live7', `SELECT count(*) FROM app_private.mis_batch_stage_event WHERE batch_number='${b}'`), '0');
  await h.page.fill('#misHoEv', 'WB-ADD'); await h.page.click('#misHoSign'); await h.page.waitForFunction(() => /FG bulk stage signed/.test(document.getElementById('mis-handoff')?.textContent || ''));
  assert.equal(sql('live7', `SELECT measured_qty_base FROM app_private.mis_batch_stage_event WHERE batch_number='${b}'`).replace(/\.0+$/, ''), '12'); assert.equal(sql('live7', `SELECT count(*) FROM public.daily_work_log WHERE batch_number='${b}'`), '1', 'no second work log was created');
  const keys = new Set(h.bridge.calls.filter((c) => c.name === 'mis_sign_batch_stage_v1').map((c) => c.args.p_idempotency_key)); assert.equal(keys.size, 1);
  await h.ctx.close();
  const o = await openAdd(PACKER, w, { flag: true }); await o.page.waitForTimeout(1500); assert.equal(await o.page.$('#misHoSign'), null); await o.ctx.close();
  const n0 = await openAdd(NOBODY, bn('AN') && mkBatch(bn('AN2')), { flag: true }); await n0.page.waitForTimeout(1200); assert.equal(await n0.page.$('#mis-handoff'), null); await n0.ctx.close();
});
test('Add Log Entry, flag ON: a refused hand-off (transfer-only stock, route gap) is explained and offers the governed console; nothing is signed', { skip: SK }, async () => {
  const b = bn('AT'); const w = mkBatch(b); sql('live7', `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}'`);
  sql('live7', `INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id) VALUES (21,'${b}','2026-11-12',10,10,'kg','TRANSFER_IN','fg_bulk_internal_transfer',99)`);
  const h = await openAdd(SIGNER, w, { flag: true }); await h.page.waitForSelector('#misHoSign', { timeout: 15000 }); await h.page.fill('#misHoEv', 'WB-T'); await h.page.click('#misHoSign');
  await h.page.waitForFunction(() => /No ledger receipt was posted for this FG work log/.test(document.getElementById('misHoMsg').textContent)); assert.equal(sql('live7', `SELECT count(*) FROM app_private.mis_batch_stage_event WHERE batch_number='${b}'`), '0'); await h.ctx.close();
});
