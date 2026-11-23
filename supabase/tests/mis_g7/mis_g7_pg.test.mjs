// Real PostgreSQL tests for G7 S2-S4 (ephemeral local cluster). If PostgreSQL cannot be
// started every test is SKIPPED with the label BLOCKED -- never reported as PASS.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startPg, installBaseAndMigrations, seedShimFingerprintsSql, MIGRATIONS as MIGRATION_FILES } from './pg_harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DB = 'g7';
const SIGNER = '00000000-0000-0000-0000-000000000001';
const PACKER = '00000000-0000-0000-0000-000000000002';
const EXCESS = '00000000-0000-0000-0000-000000000003';
const NOBODY = '00000000-0000-0000-0000-000000000004';
let pg = null; let blocked = null;

before(() => {
  pg = startPg();
  if (!pg) { blocked = 'BLOCKED: local PostgreSQL unavailable'; return; }
  pg.createDb(DB);
  installBaseAndMigrations(pg, DB);
  const r = pg.psql(DB, fs.readFileSync(path.join(here, '01_seed.sql'), 'utf8'));
  assert.equal(r.status, 0, r.err);
});
after(() => { if (pg) pg.stop(); });

const q = (sql, uid) => pg.psql(DB, sql, uid === undefined ? {} : { uid });
const val = (sql, uid) => { const r = q(sql, uid); assert.equal(r.status, 0, r.err + ' :: ' + sql); return r.out.split('\n').pop(); };
const json = (sql, uid) => JSON.parse(val(sql, uid));
let n = 0;
const bn = (p) => `${p}${++n}`;
function mk(batch, qty = 100) { val(`SELECT public.t_mkbatch('${batch}', ${qty})`); }
const wlFg = (b) => val(`SELECT id FROM public.daily_work_log WHERE batch_number='${b}' AND activity='FG bulk storage'`);
const evId = (b) => val(`SELECT pe.id FROM public.packaging_events pe JOIN public.daily_work_log w ON w.id=pe.work_log_id WHERE w.batch_number='${b}'`);
const sign = (b, uid = SIGNER, qty = '100', key = randomUUID(), wl) =>
  q(`SELECT public.mis_sign_batch_stage_v1('${key}',1,'${b}',${wl ?? wlFg(b)},2,1,${qty},'weighment ${b}')`, uid);
function mkSigned(batch, qty = 100) { mk(batch, qty); const r = sign(batch, SIGNER, String(qty)); assert.equal(r.status, 0, r.err); assert.equal(JSON.parse(r.out).ok, true); }
const bal = (b) => Number(val(`SELECT coalesce(sum(qty_base),0) FROM public.fg_bulk_stock_ledger WHERE product_id=1 AND batch_number='${b}'`));
const pack = (b, lines, { uid = PACKER, key = randomUUID(), excess = null } = {}) =>
  q(`SELECT public.mis_pack_fg_bulk_v1('${key}', ${evId(b)}, '${JSON.stringify(lines)}'::jsonb, ${excess ? `'${JSON.stringify(excess)}'::jsonb` : 'NULL'})`, uid);
const T = (name, fn) => test(name, async (t) => { if (blocked) return t.skip(blocked); await fn(t); });

// ------------------------------- S2 -------------------------------
T('S2 migrations compile and install on a clean schema', () => {
  assert.equal(val(`SELECT count(*) FROM pg_trigger WHERE tgname='00_mis_g7_fg_batch_lock'`), '1');
});
T('S2 unauthorized actor (no permission) cannot sign; anonymous cannot sign', () => {
  const b = bn('S2A'); mk(b);
  let r = sign(b, NOBODY); assert.notEqual(r.status, 0); assert.match(r.err, /permission denied/);
  r = sign(b, PACKER); assert.notEqual(r.status, 0);          // packer role is not signer
  r = q(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'${b}',${wlFg(b)},2,1,10,'x')`, null);
  assert.notEqual(r.status, 0);                               // no JWT at all
  r = pg.psql(DB, `SET ROLE anon; SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'${b}',1,2,1,10,'x')`);
  assert.match(r.err, /permission denied/);
  assert.equal(val(`SELECT count(*) FROM app_private.mis_batch_stage_event WHERE batch_number='${b}'`), '0');
});
T('S2 signer signs FG stage; replay is idempotent; key reuse with other payload refused', () => {
  const b = bn('S2B'); mk(b); const key = randomUUID();
  const a = JSON.parse(sign(b, SIGNER, '100', key).out); assert.equal(a.ok, true); assert.equal(a.stage_role, 'FG_BULK');
  assert.match(a.source_fingerprint, /^[0-9a-f]{64}$/);
  const again = JSON.parse(sign(b, SIGNER, '100', key).out);
  assert.equal(again.idempotent_replay, true); assert.equal(again.event_id, a.event_id);
  const reuse = JSON.parse(q(`SELECT public.mis_sign_batch_stage_v1('${key}',1,'${b}',${wlFg(b)},2,2,100,'x')`, SIGNER).out);
  assert.equal(reuse.code, 'IDEMPOTENCY_KEY_REUSED');
  assert.equal(val(`SELECT count(*) FROM app_private.mis_batch_stage_event WHERE batch_number='${b}'`), '1');
  const dup = JSON.parse(sign(b).out); assert.equal(dup.code, 'STAGE_ALREADY_SIGNED');
});
T('S2 fails closed: no route, missing FG step, overlapping routes, wrong activity/identity, missing qty', () => {
  const s = (p, b, wl, step, qty = 10) => JSON.parse(val(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',${p},'${b}',${wl},${step},1,${qty},'e')`, SIGNER));
  const wl = (b) => val(`SELECT id FROM public.daily_work_log WHERE batch_number='${b}'`);
  assert.equal(s(3, 'X3', wl('X3'), 2).code, 'PRODUCT_ROUTE_COVERAGE');
  assert.equal(s(4, 'X4', wl('X4'), 41).code, 'MANDATORY_FG_STAGE_GAP');
  assert.equal(s(5, 'X5', wl('X5'), 51).code, 'APPROVED_ROUTE_OVERLAP');
  assert.equal(s(3, 'X3', wl('X3'), 2).historical_state, 'NOT_VERIFIED');
  const b = bn('S2C'); mk(b);
  assert.equal(s(1, b, wlFg(b), 1).code, 'ACTIVITY_STEP_MISMATCH');          // Mixing step vs FG DWL
  assert.equal(s(1, b, wlFg(b), 999).code, 'STEP_NOT_IN_EFFECTIVE_ROUTE');
  assert.equal(s(1, 'WRONG', wlFg(b), 2).code, 'WORK_LOG_IDENTITY_MISMATCH');
  assert.equal(JSON.parse(val(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'${b}',${wlFg(b)},2,1,NULL,'e')`, SIGNER)).code, 'MEASURED_QTY_REQUIRED');
  assert.equal(val(`SELECT count(*) FROM app_private.mis_batch_stage_event`) >= '0', true);
  // historical DWL rows are never auto-signed
  assert.equal(val(`SELECT count(*) FROM app_private.mis_batch_stage_event WHERE batch_number IN ('X3','X4','X5')`), '0');
});
T('S2 correction is a separate event; original immutable; re-sign allowed; non-signer denied', () => {
  const b = bn('S2D'); mk(b);
  const ev = JSON.parse(sign(b).out).event_id;
  let r = q(`SELECT public.mis_correct_batch_stage_v1('${randomUUID()}',${ev},'wrong weight')`, PACKER); assert.notEqual(r.status, 0);
  const ck = randomUUID();
  const c = json(`SELECT public.mis_correct_batch_stage_v1('${ck}',${ev},'wrong weight')`, SIGNER); assert.equal(c.ok, true);
  assert.equal(json(`SELECT public.mis_correct_batch_stage_v1('${ck}',${ev},'wrong weight')`, SIGNER).idempotent_replay, true);
  assert.equal(json(`SELECT public.mis_correct_batch_stage_v1('${randomUUID()}',${ev},'again')`, SIGNER).code, 'ALREADY_CORRECTED');
  assert.equal(val(`SELECT event_kind FROM app_private.mis_batch_stage_event WHERE event_id=${ev}`), 'SIGN');
  assert.equal(val(`SELECT app_private.mis_stage_is_signed(1,'${b}','FG_BULK')`), 'f');
  assert.equal(JSON.parse(sign(b).out).ok, true);                                  // re-sign after correction
  assert.equal(val(`SELECT app_private.mis_stage_is_signed(1,'${b}','FG_BULK')`), 't');
});
T('S2 events are append-only even for superuser; direct authenticated DML denied', () => {
  const b = bn('S2E'); mk(b); const ev = JSON.parse(sign(b).out).event_id;
  assert.match(q(`UPDATE app_private.mis_batch_stage_event SET evidence_ref='x' WHERE event_id=${ev}`).err, /APPEND_ONLY/);
  assert.match(q(`DELETE FROM app_private.mis_batch_stage_event WHERE event_id=${ev}`).err, /APPEND_ONLY/);
  assert.match(q(`TRUNCATE app_private.mis_batch_stage_event`).err, /APPEND_ONLY|cannot truncate/);
  assert.match(q(`TRUNCATE app_private.mis_fg_pack_request`).err, /APPEND_ONLY/);
  for (const [tbl, col] of [['mis_batch_stage_event', 'evidence_ref'], ['mis_fg_signed_excess_receipt', 'reason'], ['mis_fg_pack_request', 'actor'], ['mis_g7_pack_ticket', 'request_id'], ['mis_g7_enforcement', 'mode'], ['mis_g7_direct_pack_audit', 'op']]) {
    for (const stmt of [`SELECT 1 FROM app_private.${tbl}`, `DELETE FROM app_private.${tbl}`, `UPDATE app_private.${tbl} SET ${col}=${col}`])
      assert.match(q(stmt, SIGNER).err, /permission denied/, stmt);
  }
  assert.match(q(`INSERT INTO app_private.mis_batch_stage_event(event_kind) VALUES ('SIGN')`, SIGNER).err, /permission denied/);
});

// ------------------------------- S4 -------------------------------
T('S4 packs atomically, converts SKU pack size/UOM to base, retry is idempotent', () => {
  const b = bn('S4A'); mkSigned(b);
  const key = randomUUID();
  const lines = [{ sku_id: 10, count: 20 }, { sku_id: 11, count: 4 }]; // 20*0.5 + 4*500g*0.001 = 12 kg
  const r = JSON.parse(pack(b, lines, { key }).out);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(Number(r.required_base), 12); assert.equal(Number(r.balance_after_base), 88);
  assert.equal(bal(b), 88);
  const again = JSON.parse(pack(b, lines, { key }).out);
  assert.equal(again.idempotent_replay, true); assert.equal(bal(b), 88);
  assert.equal(val(`SELECT count(*) FROM public.event_skus WHERE packaging_event_id=${evId(b)}`), '2');
  const reuse = JSON.parse(pack(b, [{ sku_id: 10, count: 1 }], { key }).out); assert.equal(reuse.code, 'IDEMPOTENCY_KEY_REUSED');
  assert.equal(bal(b), 88);
});
T('S4 permission matrix: no role, signer-only and anon are denied', () => {
  const b = bn('S4B'); mkSigned(b);
  for (const uid of [NOBODY, SIGNER]) { const r = pack(b, [{ sku_id: 10, count: 1 }], { uid }); assert.match(r.err, /permission denied/); }
  assert.match(pg.psql(DB, `SET ROLE anon; SELECT public.mis_pack_fg_bulk_v1('${randomUUID()}',1,'[]'::jsonb)`).err, /permission denied/);
  assert.equal(bal(b), 100);
});
T('S4 requires signed FG stage and positive receipt; historical unsigned batch NOT_VERIFIED, nothing written', () => {
  const b = bn('S4C'); mk(b);                                      // receipt exists, stage unsigned
  const r = JSON.parse(pack(b, [{ sku_id: 10, count: 2 }]).out);
  assert.equal(r.code, 'FG_STAGE_NOT_SIGNED'); assert.equal(r.historical_state, 'NOT_VERIFIED');
  assert.equal(val(`SELECT count(*) FROM public.event_skus WHERE packaging_event_id=${evId(b)}`), '0');
  // corrected (voided) stage is also not signed
  mkSigned(bn('S4Cx'));
  const b2 = `S4Cx${n}`; const ev = val(`SELECT event_id FROM app_private.mis_batch_stage_event WHERE batch_number='${b2}'`);
  json(`SELECT public.mis_correct_batch_stage_v1('${randomUUID()}',${ev},'void')`, SIGNER);
  assert.equal(JSON.parse(pack(b2, [{ sku_id: 10, count: 2 }]).out).code, 'FG_STAGE_NOT_SIGNED');
  // missing positive receipt
  const b3 = bn('S4Cy'); mk(b3); val(`SELECT 1`); sign(b3);
  q(`DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${b3}'`);
  assert.equal(JSON.parse(pack(b3, [{ sku_id: 10, count: 2 }]).out).code, 'FG_RECEIPT_MISSING');
});
T('S4 validation: sku mismatch, bad counts, non-bulk event, no trusted client flags', () => {
  const b = bn('S4D'); mkSigned(b);
  assert.equal(JSON.parse(pack(b, [{ sku_id: 20, count: 1 }]).out).code, 'SKU_PRODUCT_MISMATCH');
  assert.equal(JSON.parse(pack(b, [{ sku_id: 10, count: 0 }]).out).code, 'INVALID_INPUT');
  assert.equal(JSON.parse(pack(b, [{ sku_id: 10, count: 1 }, { sku_id: 10, count: 1 }]).out).code, 'INVALID_INPUT');
  assert.equal(JSON.parse(pack(b, []).out).code, 'INVALID_INPUT');
  q(`UPDATE public.packaging_events SET event_type='Transfer to FG store' WHERE id=${evId(b)}`);
  assert.equal(JSON.parse(pack(b, [{ sku_id: 10, count: 1 }]).out).code, 'EVENT_NOT_BULK_AFFECTING');
  assert.equal(bal(b), 100);
});
T('S4 insufficient stock returns structured quantities, writes nothing; excess_permitted reflects role', () => {
  const b = bn('S4E'); mkSigned(b, 10);
  const r = JSON.parse(pack(b, [{ sku_id: 10, count: 50 }]).out);                  // needs 25 kg, has 10
  assert.equal(r.code, 'INSUFFICIENT_BULK'); assert.equal(Number(r.required_base), 25);
  assert.equal(Number(r.available_base), 10); assert.equal(Number(r.shortfall_base), 15); assert.equal(r.base_uom, 'kg');
  assert.equal(r.excess_permitted, false);
  assert.equal(JSON.parse(pack(b, [{ sku_id: 10, count: 50 }], { uid: EXCESS }).out).excess_permitted, true);
  assert.equal(bal(b), 10);
  assert.equal(val(`SELECT count(*) FROM app_private.mis_fg_pack_request WHERE batch_number='${b}'`), '0');
});
T('S4 excess: unauthorized and client-asserted flags refused; authorized atomic commit; undersized excess refused', () => {
  const b = bn('S4F'); mkSigned(b, 10);
  const ex = { qty_base: 15, evidence_ref: 'scale-ticket-9', reason: 'overfill measured', authorized: true, committed: true, authorized_by: EXCESS };
  assert.equal(JSON.parse(pack(b, [{ sku_id: 10, count: 50 }], { uid: PACKER, excess: ex }).out).code, 'EXCESS_NOT_AUTHORIZED');
  assert.equal(bal(b), 10);
  assert.equal(JSON.parse(pack(b, [{ sku_id: 10, count: 50 }], { uid: EXCESS, excess: { ...ex, qty_base: 5 } }).out).code, 'INSUFFICIENT_AFTER_EXCESS');
  assert.equal(JSON.parse(pack(b, [{ sku_id: 10, count: 50 }], { uid: EXCESS, excess: { qty_base: -5, evidence_ref: 'e', reason: 'r' } }).out).code, 'EXCESS_INVALID');
  assert.equal(JSON.parse(pack(b, [{ sku_id: 10, count: 50 }], { uid: EXCESS, excess: { qty_base: 15, evidence_ref: '', reason: 'r' } }).out).code, 'EXCESS_INVALID');
  assert.equal(bal(b), 10); assert.equal(val(`SELECT count(*) FROM app_private.mis_fg_signed_excess_receipt WHERE batch_number='${b}'`), '0');
  const ok = JSON.parse(pack(b, [{ sku_id: 10, count: 50 }], { uid: EXCESS, excess: ex }).out);
  assert.equal(ok.ok, true, JSON.stringify(ok)); assert.equal(Number(ok.balance_after_base), 0);
  assert.equal(val(`SELECT measured_by FROM app_private.mis_fg_signed_excess_receipt WHERE batch_number='${b}'`), EXCESS); // actor from JWT, not payload
  assert.equal(val(`SELECT count(*) FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}' AND reason_code='FG_EXCESS_MEASURED'`), '1');
});
T('S4 excess not allowed when stock suffices', () => {
  const b = bn('S4G'); mkSigned(b);
  assert.equal(JSON.parse(pack(b, [{ sku_id: 10, count: 2 }], { uid: EXCESS, excess: { qty_base: 5, evidence_ref: 'e', reason: 'r' } }).out).code, 'EXCESS_NOT_NEEDED');
  assert.equal(bal(b), 100);
});
T('S4 rollback atomicity: depletion failure rolls back excess receipt, ledger, event lines and request record', () => {
  const b = bn('S4H'); mkSigned(b, 10);
  q(`ALTER TABLE public.event_skus DISABLE TRIGGER trg_fg_ledger_from_es`);       // simulate legacy silent-skip
  try {
    const r = pack(b, [{ sku_id: 10, count: 50 }], { uid: EXCESS, excess: { qty_base: 15, evidence_ref: 'e', reason: 'r' } });
    assert.match(r.err, /MIS_G7_DEPLETION_MISMATCH/);
  } finally { q(`ALTER TABLE public.event_skus ENABLE TRIGGER trg_fg_ledger_from_es`); }
  assert.equal(bal(b), 10);
  assert.equal(val(`SELECT count(*) FROM app_private.mis_fg_signed_excess_receipt WHERE batch_number='${b}'`), '0');
  assert.equal(val(`SELECT count(*) FROM public.event_skus WHERE packaging_event_id=${evId(b)}`), '0');
  assert.equal(val(`SELECT count(*) FROM app_private.mis_fg_pack_request WHERE batch_number='${b}'`), '0');
});

// ------------------------- S3 / concurrency -------------------------
const hold = (body, secs) => `BEGIN; ${body}; SELECT pg_sleep(${secs}); COMMIT;`;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

T('S3 two concurrent legacy direct ledger writers serialize; negative guard now race-safe', async () => {
  const b = bn('S3A'); mk(b);
  const ins = (x) => `INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id) VALUES (1,'${b}',CURRENT_DATE,-${x},-${x},'kg','T','t',0)`;
  const A = pg.psqlAsync(DB, hold(ins(60), 2));
  await delay(500);
  const B = pg.psqlAsync(DB, `BEGIN; ${ins(60)}; COMMIT;`);
  const [a, bb] = await Promise.all([A, B]);
  assert.equal(a.status, 0); assert.notEqual(bb.status, 0); assert.match(bb.err, /would make stock negative/);
  assert.ok(bb.ms >= 1400, `B should have waited for A (waited ${bb.ms}ms)`);
  assert.equal(bal(b), 40);
});
T('S3 pack RPC vs force-close: force-close (reads stale balance) fails closed, no over-draw', async () => {
  const b = bn('S3B'); mkSigned(b);
  const A = pg.psqlAsync(DB, hold(`SELECT public.mis_pack_fg_bulk_v1('${randomUUID()}',${evId(b)},'[{"sku_id":10,"count":20}]'::jsonb)`, 2), { uid: PACKER });
  await delay(500);
  const B = pg.psqlAsync(DB, `SELECT public.fn_fg_force_close(1,'${b}',0)`);
  const [a, f] = await Promise.all([A, B]);
  assert.equal(a.status, 0, a.err); assert.notEqual(f.status, 0); assert.match(f.err, /would make stock negative/);
  assert.equal(bal(b), 90);
});
T('S3 two packers racing for one batch: loser gets INSUFFICIENT_BULK computed after the winner commits', async () => {
  const b = bn('S3C'); mkSigned(b, 10);
  const e = evId(b);
  const call = (k) => `SELECT public.mis_pack_fg_bulk_v1('${k}',${e},'[{"sku_id":10,"count":14}]'::jsonb)`;   // 7kg each
  const A = pg.psqlAsync(DB, hold(call(randomUUID()), 2), { uid: PACKER });
  await delay(500);
  // second packer needs a different SKU line to avoid SKU_LINE_EXISTS guard
  const B = pg.psqlAsync(DB, `SELECT public.mis_pack_fg_bulk_v1('${randomUUID()}',${e},'[{"sku_id":11,"count":14}]'::jsonb)`, { uid: PACKER }); // 14*0.5=7kg
  const [a, bb] = await Promise.all([A, B]);
  assert.equal(JSON.parse(a.out.split('\n').find((l) => l.startsWith('{'))).ok, true);
  const rb = JSON.parse(bb.out.split('\n').find((l) => l.startsWith('{')));
  assert.equal(rb.code, 'INSUFFICIENT_BULK'); assert.equal(Number(rb.available_base), 3);
  assert.ok(bb.ms >= 1400); assert.equal(bal(b), 3);
});
T('S3 concurrent identical request id: one executes, other replays (single depletion)', async () => {
  const b = bn('S3D'); mkSigned(b); const key = randomUUID();
  const call = `SELECT public.mis_pack_fg_bulk_v1('${key}',${evId(b)},'[{"sku_id":10,"count":10}]'::jsonb)`;
  const [x, y] = await Promise.all([pg.psqlAsync(DB, hold(call, 1), { uid: PACKER }), pg.psqlAsync(DB, call, { uid: PACKER })]);
  const rs = [x, y].map((r) => JSON.parse(r.out.split('\n').find((l) => l.startsWith('{'))));
  assert.equal(rs.filter((r) => r.idempotent_replay === true).length, 1); assert.ok(rs.every((r) => r.ok));
  assert.equal(bal(b), 95); assert.equal(val(`SELECT count(*) FROM public.event_skus WHERE packaging_event_id=${evId(b)}`), '1');
});
T('S3 internal transfer legs: concurrent over-transfer serialized; UPDATE/DELETE rebuild still works', async () => {
  const b = bn('S3E'); mk(b);
  const tr = `INSERT INTO public.fg_bulk_internal_transfer(product_id,batch_number,qty_base,from_plant,to_plant) VALUES (1,'${b}',80,1,2)`;
  // transfer = out -80 / in +80 in same txn; second concurrent transfer must wait then still succeed only if guard passes
  const A = pg.psqlAsync(DB, hold(tr, 2));
  await delay(500);
  const B = pg.psqlAsync(DB, `BEGIN; ${tr}; COMMIT;`);
  const [a, bb] = await Promise.all([A, B]);
  assert.equal(a.status, 0, a.err);
  assert.ok(bb.ms >= 1400, 'B waited on the shared batch lock');
  assert.equal(bal(b), 100);                                   // net-zero legs
  const id = val(`SELECT min(id) FROM public.fg_bulk_internal_transfer WHERE batch_number='${b}'`);
  assert.equal(q(`UPDATE public.fg_bulk_internal_transfer SET qty_base=30 WHERE id=${id}`).status, 0);
  assert.equal(q(`DELETE FROM public.fg_bulk_internal_transfer WHERE id=${id}`).status, 0);
  assert.equal(bal(b), 100);
});
T('S3 different batches do not block each other; opposite-order multi-lock does not deadlock', async () => {
  const b1 = bn('S3F'), b2 = bn('S3G'); mk(b1); mk(b2);
  const slow = pg.psqlAsync(DB, hold(`SELECT app_private.mis_lock_fg_batch(1,'${b1}')`, 2));
  await delay(400);
  const fast = await pg.psqlAsync(DB, `SELECT app_private.mis_lock_fg_batch(1,'${b2}')`);
  assert.ok(fast.ms < 1500, `different batch must not wait (${fast.ms}ms)`);
  await slow;
  const x = pg.psqlAsync(DB, hold(`SELECT app_private.mis_lock_fg_batches(1,'${b1}',1,'${b2}')`, 1.5));
  const y = pg.psqlAsync(DB, hold(`SELECT app_private.mis_lock_fg_batches(1,'${b2}',1,'${b1}')`, 0.2));
  const [rx, ry] = await Promise.all([x, y]);
  assert.equal(rx.status, 0, rx.err); assert.equal(ry.status, 0, ry.err);
});

// ------------------- production-shape parity / security / boundary -------------------
const LEGACY_WRITERS = ['trg_fg_ledger_from_dwl()', 'trg_fg_ledger_from_es()', 'trg_fg_bulk_internal_transfer_to_ledger()',
  'fn_fg_auto_zero(integer,text,numeric)', 'fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)', 'fn_fg_force_close(integer,text,numeric)'];
const RECON_TRIGGERS = ['trg_fg_ledger_reconcile_ins_stmt()', 'trg_fg_ledger_reconcile_upd_stmt()', 'trg_fg_ledger_reconcile_del_stmt()'];
const CHAIN = [...LEGACY_WRITERS, 'fn_fg_reconcile_batch(integer,text,numeric)', ...RECON_TRIGGERS];
const LIVE_SHAS = {
  'fn_fg_auto_zero(integer,text,numeric)': '705fecd3e68576272af73b5230737c98689c9f538d88e40d723a5b935ae5a582',
  'fn_fg_force_close(integer,text,numeric)': 'c48578e7e08d311aebdefdaaf512bbfe2a87daecf61c2bde735f46d1e7cff10d',
  'fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)': '9b9a1a4975679358a2628f3e598a75a2a4b0ac658173da9f6f1950cdd6629675',
  'trg_fg_bulk_internal_transfer_to_ledger()': '6adab6d8180d2d0f15f8415acd51403691cc6f64c58b549b71ce386e6faa69c5',
  'trg_fg_ledger_from_dwl()': 'ffe12985b5e7c135766655c4893a886adc2d1a36bd6a181c80cd185649c2eec1',
  'trg_fg_ledger_from_es()': 'cc32357d320fb63278632c5726085bdcf6b32395453838d39cac8c3584faed28',
  'trg_fg_ledger_reconcile_ins_stmt()': 'd4cdfe3dbc827d0e14122fe41993981e65b4903bd18d8da3d0013fd730cc2412',
  'trg_fg_ledger_reconcile_upd_stmt()': 'a298bcff5a7fede05d59c4d77c4673fd4fe5db2f5609914cb900dedfbf6b5f7b',
  'trg_fg_ledger_reconcile_del_stmt()': 'd09789baea588ff64d78e9b787ae769a4dff2df9f307547bfcdedd562cb995ad' };
const setMode = (m) => { const r = q(`UPDATE app_private.mis_g7_enforcement SET mode='${m}'`); assert.equal(r.status, 0, r.err); };
const anon = (sql) => pg.psql(DB, `SET ROLE anon; ${sql}`);

T('PARITY live-evidenced types: bigint ids, enum event_type, integer ledger source_id, new RPC/table types', () => {
  const t = (tbl, col) => val(`SELECT data_type||':'||udt_name FROM information_schema.columns WHERE table_schema='${tbl.split('.')[0]}' AND table_name='${tbl.split('.')[1]}' AND column_name='${col}'`);
  for (const [tbl, col] of [['public.packaging_events', 'id'], ['public.packaging_events', 'work_log_id'], ['public.event_skus', 'id'],
    ['public.event_skus', 'packaging_event_id'], ['public.event_skus', 'sku_id'], ['public.product_skus', 'id'], ['public.product_skus', 'product_id'],
    ['app_private.mis_fg_pack_request', 'packaging_event_id'], ['app_private.mis_fg_signed_excess_receipt', 'packaging_event_id'], ['app_private.mis_g7_pack_ticket', 'packaging_event_id']])
    assert.equal(t(tbl, col), 'bigint:int8', `${tbl}.${col}`);
  assert.equal(t('public.packaging_events', 'event_type'), 'USER-DEFINED:citext');
  assert.equal(t('public.fg_bulk_stock_ledger', 'source_id'), 'integer:int4');
  assert.equal(val(`SELECT pg_get_function_identity_arguments('public.mis_pack_fg_bulk_v1(uuid,bigint,jsonb,jsonb)'::regprocedure)`), 'p_request_id uuid, p_packaging_event_id bigint, p_lines jsonb, p_excess jsonb');
  assert.equal(val(`SELECT to_regprocedure('public.mis_pack_fg_bulk_v1(uuid,integer,jsonb,jsonb)') IS NULL`), 't');   // no narrowing overload
  assert.equal(val(`SELECT count(*) FROM pg_proc WHERE proname='mis_pack_fg_bulk_v1'`), '1');
});
T('PARITY writers SECURITY DEFINER after S3b; public RPCs definer; helpers not callable by clients; ACLs', () => {
  for (const w of LEGACY_WRITERS) assert.equal(val(`SELECT prosecdef FROM pg_proc WHERE oid='public.${w}'::regprocedure`), 't', w);
  for (const [fn, acl] of [['mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text)', true], ['mis_correct_batch_stage_v1(uuid,bigint,text)', true], ['mis_pack_fg_bulk_v1(uuid,bigint,jsonb,jsonb)', true]]) {
    assert.equal(val(`SELECT prosecdef FROM pg_proc WHERE oid='public.${fn}'::regprocedure`), 't');
    assert.equal(val(`SELECT has_function_privilege('authenticated','public.${fn}','EXECUTE')`), 't');
    assert.equal(val(`SELECT has_function_privilege('anon','public.${fn}','EXECUTE')`), 'f');
  }
  for (const f of ['app_private.mis_lock_fg_batch(integer,text)', 'app_private.mis_resolve_batch_stage(integer,text,integer,bigint)', 'app_private.mis_stage_fp(integer,text,integer,bigint,integer)', 'app_private.mis_g7_gate_check(text,text,bigint,bigint,boolean)'])
    assert.equal(val(`SELECT has_function_privilege('authenticated','${f}','EXECUTE')`), 'f', f);
  assert.match(q(`SELECT app_private.mis_lock_fg_batch(1,'x')`, SIGNER).err, /permission denied/);
  for (const p of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) for (const role of ['authenticated', 'anon'])
    assert.equal(val(`SELECT has_table_privilege('${role}','public.fg_bulk_stock_ledger','${p}')`), 'f', `${role} ${p}`);
  assert.equal(val(`SELECT has_table_privilege('authenticated','public.fg_bulk_stock_ledger','SELECT')`), 't');
  assert.equal(val(`SELECT has_function_privilege('authenticated','app_private.trg_mis_fg_ledger_batch_lock()','EXECUTE')`), 'f');
});
T('PARITY S3 lock trigger fires first among all BEFORE INSERT ledger triggers (installed trigger list)', () => {
  const names = val(`SELECT string_agg(tgname, ',' ORDER BY tgname COLLATE "C") FROM pg_trigger WHERE tgrelid='public.fg_bulk_stock_ledger'::regclass AND NOT tgisinternal AND (tgtype & 2)=2 AND (tgtype & 4)=4`);
  assert.equal(names.split(',')[0], '00_mis_g7_fg_batch_lock', names);
  assert.ok(names.includes('trg_fg_ledger_check_neg'));
  assert.equal(val(`SELECT count(*) FROM pg_trigger WHERE tgrelid='public.fg_bulk_stock_ledger'::regclass AND tgname='00_mis_g7_fg_batch_lock' AND (tgtype&2)=2 AND (tgtype&4)=4 AND (tgtype&8)=8 AND (tgtype&16)=16`), '1'); // BEFORE INSERT/DELETE/UPDATE
});
T('BOUNDARY direct authenticated/anon ledger DML denied (insert/update/delete)', () => {
  const b = bn('BD1'); mk(b);
  const row = `INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,qty,qty_base,uom) VALUES (1,'${b}',1,1,'kg')`;
  for (const stmt of [row, `UPDATE public.fg_bulk_stock_ledger SET qty_base=qty_base+1 WHERE batch_number='${b}'`, `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}'`]) {
    assert.match(q(stmt, SIGNER).err, /permission denied/, stmt); assert.match(anon(stmt).err, /permission denied/, stmt);
  }
  assert.equal(bal(b), 100);
});
T('BOUNDARY old-client authenticated writers still work (AUDIT mode): DWL receipt, direct SKU insert/update/delete, transfer, force-close wrapper', () => {
  setMode('AUDIT');
  const b = bn('BD2'); const AU = PACKER;
  // DWL receipt trigger as authenticated (invoker -> definer)
  assert.equal(q(`INSERT INTO public.bmr_details(id,product_id,bn,lifecycle_status) VALUES ((SELECT max(id)+1 FROM public.bmr_details),1,'${b}','Released'); INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status,storage_qty,storage_qty_uom) VALUES ('P1','${b}','FG bulk storage','2026-11-12','Done',50,'kg')`, AU).status, 0);
  assert.equal(bal(b), 50);
  // legacy direct event_skus insert (old client) depletes via es trigger and is audited
  q(`INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status) VALUES ('P1','${b}','Filling','2026-11-12','Done'); INSERT INTO public.packaging_events(work_log_id,event_type) SELECT max(id),'Bottling' FROM public.daily_work_log`, AU);
  const ev = evId(b);
  const before = Number(val(`SELECT count(*) FROM app_private.mis_g7_direct_pack_audit`));
  let r = q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ev},10,10)`, AU); assert.equal(r.status, 0, r.err);
  assert.equal(bal(b), 45);
  assert.equal(Number(val(`SELECT count(*) FROM app_private.mis_g7_direct_pack_audit`)), before + 1);
  assert.equal(q(`UPDATE public.event_skus SET "count"=20 WHERE packaging_event_id=${ev}`, AU).status, 0); assert.equal(bal(b), 40);
  assert.equal(q(`DELETE FROM public.event_skus WHERE packaging_event_id=${ev}`, AU).status, 0); assert.equal(bal(b), 50);
  // helpers are NOT client-callable after S3b (P0 review fix): see 'AUTHZ' tests. Server-side callers (owner) still work:
  assert.equal(q(`SELECT public.fn_fg_ledger_add(1,'${b}',5,'ADJ',0,'manual','2026-11-12')`).status, 0); assert.equal(bal(b), 55);
  assert.equal(q(`INSERT INTO public.fg_bulk_internal_transfer(product_id,batch_number,qty_base,from_plant,to_plant) VALUES (1,'${b}',10,1,2)`, AU).status, 0); assert.equal(bal(b), 55);
  assert.equal(q(`SELECT public.fn_fg_auto_zero(1,'${b}',0.001)`).status, 0);
  assert.equal(q(`SELECT public.fn_fg_force_close(1,'${b}')`, AU).status, 0); assert.equal(bal(b), 0);   // permission-gated definer wrapper (client's real call)
  // negative guard still protects the server-side writer path
  assert.match(q(`SELECT public.fn_fg_ledger_add(1,'${b}',-1,'ADJ',0,'manual','2026-11-12')`).err, /would make stock negative/);
});
T('BOUNDARY ENFORCE mode: direct SKU INSERT/UPDATE/DELETE, header reassignment/retype/delete denied; RPC and non-bulk still allowed', () => {
  const b = bn('BD3'); mkSigned(b); const ev = evId(b);
  const r0 = JSON.parse(pack(b, [{ sku_id: 10, count: 10 }]).out); assert.equal(r0.ok, true);   // RPC creates a line (AUDIT)
  setMode('ENFORCE');
  try {
    const d = (stmt) => assert.match(q(stmt, PACKER).err, /MIS_G7_DIRECT_PACKING_DENIED/, stmt);
    d(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ev},11,1)`);
    d(`UPDATE public.event_skus SET "count"=99 WHERE packaging_event_id=${ev}`);
    d(`DELETE FROM public.event_skus WHERE packaging_event_id=${ev}`);
    const other = bn('BD3o'); mk(other); const ev2 = evId(other);
    d(`UPDATE public.event_skus SET packaging_event_id=${ev2} WHERE packaging_event_id=${ev}`);          // line reassignment
    d(`UPDATE public.packaging_events SET work_log_id=(SELECT work_log_id FROM public.packaging_events WHERE id=${ev2}) WHERE id=${ev}`); // header reassignment
    d(`UPDATE public.packaging_events SET event_type='Labelling' WHERE id=${ev}`);
    d(`DELETE FROM public.packaging_events WHERE id=${ev}`);                                             // cascade path
    assert.equal(bal(b), 95);
    // RPC still works under ENFORCE (ticketed)
    const r = JSON.parse(pack(b, [{ sku_id: 11, count: 2 }]).out); assert.equal(r.ok, true, JSON.stringify(r));  // 2*0.5kg
    assert.equal(bal(b), 94);
    // non-bulk event headers/lines are not gated
    q(`UPDATE public.packaging_events SET event_type='Transfer to FG store' WHERE id=${ev2}`, PACKER);
    assert.equal(q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ev2},10,3)`, PACKER).status, 0);
    assert.equal(bal(other), 100);                                                                       // affects=0 -> no depletion
    // ticket must not authorize another transaction: ticket for ev exists, a later direct write is still denied
    d(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ev},10,1)`);
  } finally { setMode('AUDIT'); }
});
T('BOUNDARY denied direct write leaves header intact and creates no orphan lines', () => {
  const b = bn('BD4'); mkSigned(b); const ev = evId(b);
  setMode('ENFORCE');
  try { assert.match(q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ev},10,5)`, PACKER).err, /DIRECT_PACKING_DENIED/); }
  finally { setMode('AUDIT'); }
  assert.equal(val(`SELECT count(*) FROM public.packaging_events WHERE id=${ev}`), '1');
  assert.equal(val(`SELECT count(*) FROM public.event_skus WHERE packaging_event_id=${ev}`), '0');
  assert.equal(bal(b), 100);
  // RPC refusal on same header leaves header and zero lines too
  assert.equal(JSON.parse(pack(b, [{ sku_id: 10, count: 9999 }]).out).code, 'INSUFFICIENT_BULK');
  assert.equal(val(`SELECT count(*) FROM public.event_skus WHERE packaging_event_id=${ev}`), '0');
  // existing line on header: the RPC refuses duplicate SKU line rather than double posting
  assert.equal(JSON.parse(pack(b, [{ sku_id: 10, count: 2 }]).out).ok, true);
  assert.equal(JSON.parse(pack(b, [{ sku_id: 10, count: 2 }]).out).code, 'SKU_LINE_EXISTS');
});
T('C1 evidence: measured qty must equal DWL FG receipt in base UOM; ledger must hold it; stale source blocks pack', () => {
  const s = (b, qty, wl) => JSON.parse(val(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'${b}',${wl ?? wlFg(b)},2,1,${qty},'e')`, SIGNER));
  const b1 = bn('C1a'); mk(b1);
  assert.equal(s(b1, 99).code, 'MEASURED_QTY_MISMATCH');
  assert.equal(s(b1, 1000).code, 'MEASURED_QTY_MISMATCH');
  q(`UPDATE public.daily_work_log SET storage_qty_uom='g' WHERE id=${wlFg(b1)}`);
  assert.equal(s(b1, 100).code, 'FG_UOM_MISMATCH');
  q(`UPDATE public.daily_work_log SET storage_qty_uom='kg', storage_qty=0 WHERE id=${wlFg(b1)}`);
  assert.equal(s(b1, 100).code, 'FG_RECEIPT_EVIDENCE_MISSING');
  const b2 = bn('C1b'); mk(b2); q(`DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${b2}'`);
  assert.equal(s(b2, 100).code, 'FG_RECEIPT_EVIDENCE_MISSING');
  assert.equal(val(`SELECT count(*) FROM app_private.mis_batch_stage_event WHERE batch_number IN ('${b1}','${b2}')`), '0');
  const b3 = bn('C1c'); mkSigned(b3);                                  // sign OK, then source quantity drifts
  q(`UPDATE public.daily_work_log SET storage_qty=101 WHERE id=${wlFg(b3)}`);
  const r = JSON.parse(pack(b3, [{ sku_id: 10, count: 2 }]).out);
  assert.equal(r.code, 'STAGE_SOURCE_CHANGED'); assert.equal(bal(b3), 100);
  const b4 = bn('C1d'); mkSigned(b4);                                  // route un-approved after signing
  q(`UPDATE costing.product_process_route SET status='RETIRED' WHERE id=1`);
  try { assert.equal(JSON.parse(pack(b4, [{ sku_id: 10, count: 2 }]).out).code, 'STAGE_SOURCE_CHANGED'); }
  finally { q(`UPDATE costing.product_process_route SET status='APPROVED' WHERE id=1`); }
  assert.equal(JSON.parse(pack(b4, [{ sku_id: 10, count: 2 }]).out).ok, true);
});
T('PERMISSION unregistered targets fail closed even for an authenticated admin-like user', () => {
  const ADMIN = '00000000-0000-0000-0000-0000000000aa';   // authenticated, holds only unrelated permissions
  q(`INSERT INTO public.test_perm VALUES ('${ADMIN}','module:production-route-manager')`);
  const b = bn('PM1'); mk(b);
  assert.match(sign(b, ADMIN).err, /permission denied/);
  assert.match(pack(b, [{ sku_id: 10, count: 1 }], { uid: ADMIN }).err, /permission denied/);
  assert.match(q(`SELECT public.mis_correct_batch_stage_v1('${randomUUID()}',1,'x')`, ADMIN).err, /permission denied/);
});

// ---------------- real multi-writer concurrency (beyond helper calls) ----------------
T('RACE auto-zero (read-before-write) vs concurrent ledger writer: fails closed, never over-draws', async () => {
  const b = bn('RC1'); mk(b, 0.4);
  const A = pg.psqlAsync(DB, hold(`SELECT public.fn_fg_ledger_add(1,'${b}',-0.4,'ADJ',0,'manual','2026-11-12')`, 2));
  await delay(400);
  const B = pg.psqlAsync(DB, `SELECT public.fn_fg_auto_zero(1,'${b}',1)`);     // reads +0.4 (A uncommitted), then inserts -0.4
  const [a, bb] = await Promise.all([A, B]);
  assert.equal(a.status, 0, a.err); assert.notEqual(bb.status, 0); assert.match(bb.err, /would make stock negative/);
  assert.equal(bal(b), 0);
});
T('RACE force-close (read-before-write) vs concurrent transfer INSERT: no negative balance', async () => {
  const b = bn('RC2'); mk(b);
  const tr = `INSERT INTO public.fg_bulk_internal_transfer(product_id,batch_number,qty_base,from_plant,to_plant) VALUES (1,'${b}',100,1,2)`;
  const A = pg.psqlAsync(DB, hold(tr, 2));
  await delay(400);
  const B = pg.psqlAsync(DB, `SELECT public.fn_fg_force_close(1,'${b}',0)`);
  const [a, bb] = await Promise.all([A, B]);
  assert.equal(a.status, 0, a.err); assert.equal(bb.status, 0, bb.err);        // out/in legs net zero; close then drains cleanly
  assert.ok(bb.ms >= 1400); assert.equal(bal(b), 0);
});
T('RACE transfer UPDATE/DELETE leg rebuild vs pack RPC: serialized, balance consistent', async () => {
  const b = bn('RC3'); mkSigned(b);
  q(`INSERT INTO public.fg_bulk_internal_transfer(product_id,batch_number,qty_base,from_plant,to_plant) VALUES (1,'${b}',40,1,2)`);
  const id = val(`SELECT id FROM public.fg_bulk_internal_transfer WHERE batch_number='${b}'`);
  const A = pg.psqlAsync(DB, hold(`UPDATE public.fg_bulk_internal_transfer SET qty_base=60 WHERE id=${id}`, 2));
  await delay(400);
  const B = pg.psqlAsync(DB, `SELECT public.mis_pack_fg_bulk_v1('${randomUUID()}',${evId(b)},'[{"sku_id":10,"count":10}]'::jsonb)`, { uid: PACKER });
  const [a, bb] = await Promise.all([A, B]);
  assert.equal(a.status, 0, a.err); assert.ok(bb.ms >= 1400, `pack waited ${bb.ms}`);
  assert.equal(JSON.parse(bb.out.split('\n').find((l) => l.startsWith('{'))).ok, true);
  assert.equal(bal(b), 95);
  const D = pg.psqlAsync(DB, hold(`DELETE FROM public.fg_bulk_internal_transfer WHERE id=${id}`, 1.5));
  await delay(300);
  const P = pg.psqlAsync(DB, `SELECT public.fn_fg_ledger_add(1,'${b}',-1,'ADJ',0,'manual','2026-11-12')`);
  const [d, p] = await Promise.all([D, P]); assert.equal(d.status, 0); assert.equal(p.status, 0); assert.equal(bal(b), 94);
});
T('RACE multi-row ledger INSERT with opposite batch order: deadlock is detected, loser rolls back fully (fail closed)', async () => {
  const b1 = bn('RC4'), b2 = bn('RC5'); mk(b1); mk(b2);
  const stmt = (x, y) => `INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,qty,qty_base,uom,reason_code,source_table,source_id)
     SELECT 1, v.bn, -1, -1, 'kg', 'MR', 'mr', ${'v.o'} FROM (SELECT bn, o, pg_sleep(1) FROM (VALUES ('${x}',1),('${y}',2)) t(bn,o)) v`;
  // service-role style direct DML (superuser) to bypass the S3b revoke: tests writer ordering only
  const [ra, rb] = await Promise.all([pg.psqlAsync(DB, stmt(b1, b2)), pg.psqlAsync(DB, stmt(b2, b1))]);
  const fails = [ra, rb].filter((r) => r.status !== 0);
  assert.equal(fails.length, 1, `exactly one session must lose: ${ra.err} | ${rb.err}`);
  assert.match(fails[0].err, /deadlock detected/);
  assert.equal(bal(b1), 99); assert.equal(bal(b2), 99);       // winner's 2 rows only, loser fully rolled back
});
T('RACE concurrent excess packs on same batch: only one excess + one pack can consume the measured stock', async () => {
  const b = bn('RC6'); mkSigned(b, 10); const e = evId(b);
  const ex = { qty_base: 15, evidence_ref: 'scale', reason: 'measured' };
  const call = (sku, k) => `SELECT public.mis_pack_fg_bulk_v1('${k}',${e},'[{"sku_id":${sku},"count":50}]'::jsonb,'${JSON.stringify(ex)}'::jsonb)`;   // each needs 25 kg (sku10) / 25 kg (sku11 500g*0.001*50)
  const [x, y] = await Promise.all([pg.psqlAsync(DB, hold(call(10, randomUUID()), 1.5), { uid: EXCESS }), (async () => { await delay(300); return pg.psqlAsync(DB, call(11, randomUUID()), { uid: EXCESS }); })()]);
  const rs = [x, y].map((r) => JSON.parse(r.out.split('\n').find((l) => l.startsWith('{'))));
  assert.equal(rs[0].ok, true); assert.equal(rs[1].ok, false);
  assert.ok(['INSUFFICIENT_AFTER_EXCESS', 'SKU_LINE_EXISTS'].includes(rs[1].code), rs[1].code);
  assert.equal(bal(b), 0); assert.equal(val(`SELECT count(*) FROM app_private.mis_fg_signed_excess_receipt WHERE batch_number='${b}'`), '1');
});

// ---------------- review round 2: P0 EXECUTE bypass, citext, retyping, overflow, rollback ----------------
const ROLES = [['authenticated ordinary', SIGNER], ['authenticated packer', PACKER], ['authenticated excess', EXCESS], ['authenticated nobody', NOBODY]];
T('AUTHZ P0: no client role can execute any stock-writing legacy function directly (positive or negative stock)', () => {
  const b = bn('AZ1'); mk(b);
  const calls = [`SELECT public.fn_fg_ledger_add(1,'${b}',5,'X',0,'manual','2026-11-12')`, `SELECT public.fn_fg_ledger_add(1,'${b}',-5,'X',0,'manual','2026-11-12')`,
    `SELECT public.fn_fg_auto_zero(1,'${b}',1000)`, `SELECT public.fn_fg_force_close(1,'${b}',0)`];
  for (const [label, uid] of ROLES) for (const c of calls) assert.match(q(c, uid).err, /permission denied for function/, `${label}: ${c}`);
  for (const c of calls) assert.match(anon(c).err, /permission denied for function/, `anon: ${c}`);
  for (const f of LEGACY_WRITERS) for (const role of ['authenticated', 'anon', 'public'])
    assert.equal(val(`SELECT has_function_privilege('${role}','public.${f}','EXECUTE')`), 'f', `${role} ${f}`);
  assert.equal(bal(b), 100);
});
T('AUTHZ P0: force-close wrapper stays permission-gated (no permission -> denied, nothing written)', () => {
  const b = bn('AZ2'); mk(b);
  assert.match(q(`SELECT public.fn_fg_force_close(1,'${b}')`, NOBODY).err, /permission denied/);
  assert.match(anon(`SELECT public.fn_fg_force_close(1,'${b}')`).err, /permission denied/);
  assert.equal(bal(b), 100);
});
T('AUTHZ P0 allowlist: only reviewed SECURITY DEFINER functions that touch the ledger are executable by clients', () => {
  const rows = val(`SELECT coalesce(string_agg(p.oid::regprocedure::text, ' | ' ORDER BY p.oid::regprocedure::text),'')
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prosecdef AND n.nspname IN ('public','app_private','costing') AND p.prokind='f'
      AND (p.prosrc ILIKE '%fg_bulk_stock_ledger%' OR p.prosrc ILIKE '%fn_fg_ledger_add%' OR p.prosrc ILIKE '%fn_fg_force_close%' OR p.prosrc ILIKE '%fn_fg_auto_zero%')
      AND (has_function_privilege('authenticated', p.oid, 'EXECUTE') OR has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('public'::name, p.oid, 'EXECUTE'))`);
  // trigger functions are executable only as triggers (have no direct-call surface) and are asserted separately above
  const allowed = new Set(['fn_fg_force_close(integer,text)', 'mis_pack_fg_bulk_v1(uuid,bigint,jsonb,jsonb)', 'mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text)']);
  for (const r of rows.split(' | ').filter(Boolean)) assert.ok([...allowed].some((a) => r.endsWith(a)), `unexpected client-executable ledger-touching definer: ${r}`);
});
T('AUTHZ S3b hardening: legacy writers pin search_path with pg_temp last (dwl was public-only)', () => {
  for (const w of LEGACY_WRITERS) {
    const cfg = val(`SELECT array_to_string(proconfig,';') FROM pg_proc WHERE oid='public.${w}'::regprocedure`);
    assert.match(cfg, /search_path=/, w);
    assert.doesNotMatch(cfg.split('search_path=')[1], /^public(;|$)/, `${w} still public-only: ${cfg}`);
  }
  assert.match(val(`SELECT array_to_string(proconfig,';') FROM pg_proc WHERE oid='public.trg_fg_ledger_from_dwl()'::regprocedure`), /pg_catalog, public, pg_temp/);
  // temp-table shadow attack on the DEFINER dwl trigger has no effect
  const b = bn('AZ3');
  const r = q(`CREATE TEMP TABLE products (id int, item text); INSERT INTO products VALUES (999,'P1');
    INSERT INTO public.bmr_details(id,product_id,bn,lifecycle_status) VALUES ((SELECT max(id)+1 FROM public.bmr_details),1,'${b}','Released');
    INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status,storage_qty,storage_qty_uom) VALUES ('P1','${b}','FG bulk storage','2026-11-12','Done',7,'kg')`, PACKER);
  assert.equal(r.status, 0, r.err);
  assert.equal(bal(b), 7);                                    // receipt posted to the REAL product 1, not the shadow row
});
T('CITEXT parity: case-variant event types are still bulk-affecting (RPC, gate), legacy trigger agrees', () => {
  const b = bn('CI1'); mkSigned(b); const ev = evId(b);
  q(`UPDATE public.packaging_events SET event_type='bOtTlInG' WHERE id=${ev}`);
  assert.equal(val(`SELECT app_private.mis_g7_event_is_bulk(${ev})`), 't');
  assert.equal(val(`SELECT pg_typeof(event_type)::text FROM public.packaging_events WHERE id=${ev}`), 'citext');
  const r = JSON.parse(pack(b, [{ sku_id: 10, count: 4 }]).out); assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(bal(b), 98);                                   // legacy trigger depleted despite case difference
  q(`UPDATE public.packaging_events SET event_type='TRANSFER to fg STORE' WHERE id=${ev}`);
  assert.equal(val(`SELECT app_private.mis_g7_event_is_bulk(${ev})`), 'f');
});
T('RETYPE non-bulk -> bulk (and bulk -> non-bulk) with existing SKU lines is audited/denied; ledger never fabricates stock', () => {
  const b = bn('RT1'); mkSigned(b); const ev = evId(b);
  q(`UPDATE public.packaging_events SET event_type='Transfer to FG store' WHERE id=${ev}`);            // header now non-bulk
  assert.equal(q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ev},10,10)`, PACKER).status, 0);   // no depletion (affects=0)
  assert.equal(bal(b), 100);
  const aud = () => Number(val(`SELECT count(*) FROM app_private.mis_g7_direct_pack_audit WHERE tbl='packaging_events'`));
  setMode('ENFORCE');
  try {
    assert.match(q(`UPDATE public.packaging_events SET event_type='Bottling' WHERE id=${ev}`, PACKER).err, /MIS_G7_DIRECT_PACKING_DENIED/);
    assert.match(q(`UPDATE public.packaging_events SET event_type='labelling' WHERE id=${ev}`, PACKER).err, /MIS_G7_DIRECT_PACKING_DENIED/);   // citext case variant
    assert.equal(val(`SELECT event_type FROM public.packaging_events WHERE id=${ev}`), 'Transfer to FG store');
  } finally { setMode('AUDIT'); }
  const before = aud();
  assert.equal(q(`UPDATE public.packaging_events SET event_type='Bottling' WHERE id=${ev}`, PACKER).status, 0);   // AUDIT allows but logs
  assert.equal(aud(), before + 1);
  // the hazard the guard exists for: after retype, deleting the pre-existing line returns stock that was never depleted
  setMode('ENFORCE');
  try { assert.match(q(`DELETE FROM public.event_skus WHERE packaging_event_id=${ev}`, PACKER).err, /DIRECT_PACKING_DENIED/); assert.equal(bal(b), 100); }
  finally { setMode('AUDIT'); }
  // retype of a header with NO lines carries no ledger effect and is not gated
  const b2 = bn('RT2'); mk(b2); setMode('ENFORCE');
  try { assert.equal(q(`UPDATE public.packaging_events SET event_type='Cartoning' WHERE id=${evId(b2)}`, PACKER).status, 0); } finally { setMode('AUDIT'); }
});
T('OVERFLOW integer ledger source_id: excess_id beyond int range raises and rolls everything back', () => {
  const b = bn('OV1'); mkSigned(b, 10);
  q(`ALTER TABLE app_private.mis_fg_signed_excess_receipt ALTER COLUMN excess_id RESTART WITH 2147483648`);
  try {
    const r = pack(b, [{ sku_id: 10, count: 50 }], { uid: EXCESS, excess: { qty_base: 15, evidence_ref: 'e', reason: 'r' } });
    assert.match(r.err, /MIS_G7_SOURCE_ID_OVERFLOW/);
  } finally { q(`ALTER TABLE app_private.mis_fg_signed_excess_receipt ALTER COLUMN excess_id RESTART WITH 500000`); }
  assert.equal(bal(b), 10); assert.equal(val(`SELECT count(*) FROM app_private.mis_fg_signed_excess_receipt WHERE batch_number='${b}'`), '0');
  assert.equal(val(`SELECT count(*) FROM app_private.mis_fg_pack_request WHERE batch_number='${b}'`), '0');
});
T('CONCURRENCY cross-batch workload: mixed pack/transfer/ledger sessions on 3 batches, no deadlock, exact final balances', async () => {
  const bs = [bn('XW'), bn('XW'), bn('XW')]; bs.forEach((b) => mkSigned(b, 200));
  const jobs = [];
  for (let i = 0; i < 12; i++) {
    const b = bs[i % 3];
    if (i % 3 === 0) jobs.push(pg.psqlAsync(DB, `SELECT public.mis_pack_fg_bulk_v1('${randomUUID()}',${evId(b)},'[{"sku_id":${i % 2 ? 10 : 11},"count":2}]'::jsonb)`, { uid: PACKER }));   // -1 kg once per SKU line; second same-sku refused
    else if (i % 3 === 1) jobs.push(pg.psqlAsync(DB, `INSERT INTO public.fg_bulk_internal_transfer(product_id,batch_number,qty_base,from_plant,to_plant) VALUES (1,'${b}',10,1,2)`));
    else jobs.push(pg.psqlAsync(DB, `SELECT public.fn_fg_ledger_add(1,'${b}',-2,'WL',0,'manual','2026-11-12')`));
  }
  const res = await Promise.all(jobs);
  assert.ok(res.every((r) => !/deadlock/.test(r.err)), res.map((r) => r.err).join('|'));
  const packed = (b) => val(`SELECT count(*) FROM public.event_skus WHERE packaging_event_id=${evId(b)}`);
  assert.equal(bal(bs[0]), 200 - Number(packed(bs[0])));       // each accepted pack line = exactly 1 kg
  assert.equal(bal(bs[1]), 200);                               // transfers net zero
  assert.equal(bal(bs[2]), 200 - 2 * 4);                       // 4 writers x -2
});
T('CONCURRENCY multi-row opposite-order ledger INSERT: deadlock victim retried once succeeds (documented bounded-retry policy)', async () => {
  const b1 = bn('RR1'), b2 = bn('RR2'); mk(b1); mk(b2);
  const stmt = (x, y) => `INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,qty,qty_base,uom,reason_code,source_table,source_id)
     SELECT 1, v.bn, -1, -1, 'kg', 'MR', 'mr', v.o FROM (SELECT bn, o, pg_sleep(1) FROM (VALUES ('${x}',1),('${y}',2)) t(bn,o)) v`;
  const run = async (x, y) => { for (let a = 1; a <= 3; a++) { const r = await pg.psqlAsync(DB, stmt(x, y)); if (r.status === 0) return { ...r, attempts: a }; if (!/deadlock detected/.test(r.err)) return r; } return { status: 1, err: 'retry exhausted' }; };
  const [ra, rb] = await Promise.all([run(b1, b2), run(b2, b1)]);
  assert.equal(ra.status, 0, ra.err); assert.equal(rb.status, 0, rb.err);
  assert.equal(bal(b1), 98); assert.equal(bal(b2), 98);        // both complete exactly once; no partial rows from the aborted attempt
});
T('PRECHECK S3b fails closed when an invoker function still calls a revoked helper', () => {
  pg.createDb('g7pc');
  const files = ['00_base_schema_shim.sql'];
  const base = fs.readFileSync(path.join(here, '00_base_schema_shim.sql'), 'utf8');
  assert.equal(pg.psql('g7pc', base).status, 0);
  const mig = (f) => fs.readFileSync(path.resolve(here, '../../migrations', f), 'utf8');
  for (const f of MIGRATION_FILES.slice(0, 3)) assert.equal(pg.psql('g7pc', mig(f)).status, 0);
  assert.equal(pg.psql('g7pc', seedShimFingerprintsSql()).status, 0);
  assert.equal(pg.psql('g7pc', `CREATE FUNCTION public.sneaky_invoker() RETURNS void LANGUAGE sql AS $$ SELECT public.fn_fg_ledger_add(1,'x',1,'x',0,'x',CURRENT_DATE) $$;`).status, 0);
  const r = pg.psql('g7pc', mig(MIGRATION_FILES[3]));
  assert.notEqual(r.status, 0); assert.match(r.err, /invoker functions call revoked helpers: sneaky_invoker\(\)/);
  assert.equal(pg.psql('g7pc', `SELECT prosecdef FROM pg_proc WHERE oid='public.fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)'::regprocedure`).out, 'f');   // nothing partially applied
  assert.equal(pg.psql('g7pc', `SELECT has_table_privilege('authenticated','public.fg_bulk_stock_ledger','INSERT')`).out, 't');
  // and a missing search_path pin also fails closed
  pg.psql('g7pc', `DROP FUNCTION public.sneaky_invoker(); ALTER FUNCTION public.fn_fg_auto_zero(integer,text,numeric) RESET search_path`);
  assert.match(pg.psql('g7pc', mig(MIGRATION_FILES[3])).err, /no pinned search_path/);
});
T('ROLLBACK exact: S3b rollback restores function defs (sha), ACLs, search_path, table privileges; old-client CRUD before/after', () => {
  pg.createDb('g7rb');
  const base = fs.readFileSync(path.join(here, '00_base_schema_shim.sql'), 'utf8');
  const mig = (f) => fs.readFileSync(path.resolve(here, '../../migrations', f), 'utf8');
  const x = (sql, o) => pg.psql('g7rb', sql, o);
  assert.equal(x(base).status, 0); assert.equal(x(fs.readFileSync(path.join(here, '01_seed.sql'), 'utf8')).status, 0);
  for (const f of MIGRATION_FILES.slice(0, 3)) assert.equal(x(mig(f)).status, 0, f);
  assert.equal(x(seedShimFingerprintsSql()).status, 0);
  // NULL acl is treated as acldefault() (semantically identical effective privileges)
  const snapR = () => x(`SELECT jsonb_pretty(jsonb_agg(jsonb_build_object('fn', p.oid::regprocedure::text, 'def_sha', encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
       'secdef', p.prosecdef, 'cfg', p.proconfig, 'acl', (SELECT string_agg(x::text, ',' ORDER BY x::text) FROM unnest(coalesce(p.proacl, acldefault('f', p.proowner))) x)) ORDER BY p.oid::regprocedure::text))
     FROM pg_proc p WHERE p.oid IN (${CHAIN.map((w) => `'public.${w}'::regprocedure`).join(',')})
    UNION ALL SELECT (SELECT string_agg(x::text, ',' ORDER BY x::text) FROM pg_class c, unnest(coalesce(c.relacl, acldefault('r', c.relowner))) x WHERE c.oid='public.fg_bulk_stock_ledger'::regclass)
    UNION ALL SELECT (SELECT string_agg(polname::text||':'||polcmd::text, ',') FROM pg_policy WHERE polrelid='public.fg_bulk_stock_ledger'::regclass)
    UNION ALL SELECT (SELECT relrowsecurity::text FROM pg_class WHERE oid='public.fg_bulk_stock_ledger'::regclass)`);
  const snap = () => { const r = snapR(); assert.equal(r.status, 0, r.err); assert.ok(r.out.length > 200); return r.out; };
  const before = snap();
  const crud = (b, governed = false) => {   // old-client DWL, packaging and transfer CRUD; governed = via definer RPC stand-in (the only path that works pre-S3b)
    const w = (sql) => governed ? x(`SELECT public.t_client_rpc($q$${sql}$q$)`, { uid: PACKER }) : x(sql, { uid: PACKER });
    assert.equal(w(`INSERT INTO public.bmr_details(id,product_id,bn,lifecycle_status) VALUES ((SELECT max(id)+1 FROM public.bmr_details),1,'${b}','Released'); INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status,storage_qty,storage_qty_uom) VALUES ('P1','${b}','FG bulk storage','2026-11-12','In Storage',50,'kg')`).status, 0);
    w(`INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status) VALUES ('P1','${b}','Filling','2026-11-12','Done'); INSERT INTO public.packaging_events(work_log_id,event_type) SELECT max(id),'Bottling' FROM public.daily_work_log`);
    const ev = x(`SELECT pe.id FROM public.packaging_events pe JOIN public.daily_work_log w ON w.id=pe.work_log_id WHERE w.batch_number='${b}'`).out;
    assert.equal(w(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ev},10,10)`).status, 0);
    assert.equal(w(`UPDATE public.event_skus SET "count"=20 WHERE packaging_event_id=${ev}`).status, 0);
    assert.equal(w(`INSERT INTO public.fg_bulk_internal_transfer(product_id,batch_number,qty_base,from_plant,to_plant) VALUES (1,'${b}',5,1,2)`).status, 0);
    assert.equal(w(`DELETE FROM public.event_skus WHERE packaging_event_id=${ev}`).status, 0);
    return Number(x(`SELECT sum(qty_base) FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}'`).out);
  };
  assert.equal(crud('RB1', true), 50);                                              // before S3b (legacy state, governed definer path)
  const preSha = Object.fromEntries(x(`SELECT p.oid::regprocedure::text||'='||encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') FROM pg_proc p WHERE p.oid IN (${CHAIN.map((w) => `'public.${w}'::regprocedure`).join(',')})`).out.split('\n').map((l) => l.split('=')));
  // pre-S3b a direct authenticated ledger write fires the INVOKER statement trigger, which cannot reach the postgres/service_role-only reconciler
  assert.match(x(`SELECT public.fn_fg_ledger_add(1,'RB1',1,'x',0,'m',CURRENT_DATE)`, { uid: PACKER }).err, /permission denied for function fn_fg_reconcile_batch/);
  assert.equal(x(`SELECT public.t_client_rpc($q$SELECT public.fn_fg_ledger_add(1,'RB1',1,'x',0,'m',CURRENT_DATE)$q$)`, { uid: PACKER }).status, 0);   // governed definer path works
  assert.equal(x(mig(MIGRATION_FILES[3])).status, 0);
  assert.notEqual(snap(), before);
  // immutable packet: baseline stores full source + sha of every chain function as it was pre-S3b
  for (const [fn, sha] of Object.entries(preSha)) {
    assert.equal(x(`SELECT def_sha FROM app_private.mis_g7_s3b_baseline WHERE obj='${fn}'`).out, sha, fn);
    assert.equal(x(`SELECT encode(sha256(convert_to(def,'UTF8')),'hex')=def_sha AND length(def)>50 FROM app_private.mis_g7_s3b_baseline WHERE obj='${fn}'`).out, 't');
  }
  assert.equal(x(`SELECT count(*) FROM app_private.mis_g7_s3b_baseline WHERE kind='function'`).out, String(CHAIN.length));
  assert.equal(crud('RB2'), 50);                                                    // after S3b (direct authenticated path now runs through the definer chain)
  assert.match(x(`INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,qty,qty_base) VALUES (1,'RB2',1,1)`, { uid: PACKER }).err, /permission denied/);
  const rb = fs.readFileSync(path.resolve(here, '../../../docs/executive-mis-g7-server/ROLLBACK_NOT_A_MIGRATION.sql'), 'utf8');
  const s3b = rb.slice(rb.indexOf('-- ==== S3B ROLLBACK ===='));
  assert.ok(s3b.length > 100);
  assert.equal(x(s3b).status, 0, x(s3b).err);
  assert.equal(snap(), before, 'rollback must restore exact pg_get_functiondef sha, ACLs, search_path, secdef, table ACL, policies, RLS');
  assert.equal(crud('RB3', true), 50);                                              // after rollback (governed definer path, as before S3b)
  assert.match(x(`INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status,storage_qty,storage_qty_uom) VALUES ('P1','RB3','FG bulk storage','2026-11-12','In Storage',1,'kg')`, { uid: PACKER }).err, /permission denied for function fn_fg_reconcile_batch/);   // legacy direct-invoker behavior restored exactly
  assert.equal(x(`SELECT has_function_privilege('authenticated','public.fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)','EXECUTE')`).out, 't');   // helper EXECUTE restored exactly
  assert.equal(x(`SELECT has_function_privilege('authenticated','public.fn_fg_reconcile_batch(integer,text,numeric)','EXECUTE')`).out, 'f');   // reconciler ACL never widened
  // signed history retained, gate objects remain but are inert (triggers dropped)
  assert.equal(x(`SELECT count(*) FROM pg_trigger WHERE tgname LIKE '00_mis_g7_%gate'`).out, '0');
  assert.equal(x(`SELECT to_regclass('app_private.mis_batch_stage_event') IS NOT NULL`).out, 't');
  assert.equal(x(`SELECT to_regclass('app_private.mis_g7_direct_pack_audit') IS NOT NULL`).out, 't');
});

// ---------------- review round 3: reconcile chain (fn_fg_reconcile_batch + 3 statement triggers) ----------------
const SERVICE = '00000000-0000-0000-0000-0000000000bb';
const asService = (sql) => pg.psql(DB, `SET ROLE service_role; ${sql}`);
const fgDwl = (b, qty, status = 'In Storage') => q(`INSERT INTO public.bmr_details(id,product_id,bn,lifecycle_status) VALUES ((SELECT max(id)+1 FROM public.bmr_details),1,'${b}','Released');
   INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status,storage_qty,storage_qty_uom) VALUES ('P1','${b}','FG bulk storage','2026-11-10','${status}',${qty},'kg');
   INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status) VALUES ('P1','${b}','Filling','2026-11-11','Done');
   INSERT INTO public.packaging_events(work_log_id,event_type) SELECT max(id),'Bottling' FROM public.daily_work_log`);
const dwlStatus = (b) => val(`SELECT status FROM public.daily_work_log WHERE batch_number='${b}' AND activity='FG bulk storage'`);

T('CHAIN structure: three statement triggers -> definer chain; reconciler ACL postgres+service_role only; helpers closed', () => {
  for (const f of RECON_TRIGGERS) {
    assert.equal(val(`SELECT prosecdef FROM pg_proc WHERE oid='public.${f}'::regprocedure`), 't', f);
    assert.equal(val(`SELECT count(*) FROM pg_trigger t WHERE t.tgfoid='public.${f}'::regprocedure AND t.tgrelid='public.fg_bulk_stock_ledger'::regclass AND (t.tgtype & 1)=0 AND NOT t.tgisinternal`), '1', f);
    for (const role of ['authenticated', 'anon', 'public']) assert.equal(val(`SELECT has_function_privilege('${role}','public.${f}','EXECUTE')`), 'f', `${role} ${f}`);
  }
  const rb = 'public.fn_fg_reconcile_batch(integer,text,numeric)';
  assert.equal(val(`SELECT prosecdef FROM pg_proc WHERE oid='${rb}'::regprocedure`), 't');
  for (const role of ['authenticated', 'anon', 'public']) assert.equal(val(`SELECT has_function_privilege('${role}','${rb}','EXECUTE')`), 'f', role);
  assert.equal(val(`SELECT has_function_privilege('service_role','${rb}','EXECUTE')`), 't');
  assert.match(val(`SELECT array_to_string(proconfig,';') FROM pg_proc WHERE oid='${rb}'::regprocedure`), /search_path=pg_catalog, public, pg_temp/);
});
T('CHAIN direct calls denied for authenticated, anon and PUBLIC; service_role keeps trusted reconcile', () => {
  const b = bn('CH0'); mk(b);
  const calls = [`SELECT public.fn_fg_reconcile_batch(1,'${b}',0.001)`, `SELECT public.fn_fg_auto_zero(1,'${b}',0.001)`];
  for (const [label, uid] of ROLES) for (const c of calls) assert.match(q(c, uid).err, /permission denied for function/, `${label}: ${c}`);
  for (const c of calls) assert.match(anon(c).err, /permission denied for function/, `anon: ${c}`);
  const r = asService(`SELECT public.fn_fg_reconcile_batch(1,'${b}',0.001)`); assert.equal(r.status, 0, r.err);   // definer: runs as owner
  assert.match(asService(`SELECT public.fn_fg_auto_zero(1,'${b}',0.001)`).err, /permission denied for function/);   // helper stays closed even to service_role
  assert.equal(bal(b), 100);
});
T('CHAIN insert path: authenticated pack leaves epsilon dust -> statement trigger -> reconcile -> auto-zero -> guarded Done', () => {
  const b = bn('CH1'); fgDwl(b, 0.5005);
  assert.equal(dwlStatus(b), 'In Storage'); assert.equal(bal(b), 0.5005);          // insert trigger chain ran: non-zero stays In Storage
  assert.equal(JSON.parse(sign(b, SIGNER, '0.5005').out).ok, true);
  const r = JSON.parse(pack(b, [{ sku_id: 10, count: 1 }]).out);                   // PACKER (authenticated) -> definer RPC -> es -> ledger -> stmt trigger
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(Number(r.balance_after_base), 0);
  assert.equal(bal(b), 0);
  assert.equal(val(`SELECT count(*) FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}' AND reason_code='AUTO_ZERO'`), '1');
  assert.equal(dwlStatus(b), 'Done');
});
T('CHAIN direct authenticated old-client SKU insert also runs the full chain (no client privilege needed)', () => {
  const b = bn('CH2'); fgDwl(b, 0.5005); const ev = evId(b);
  const r = q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ev},10,1)`, PACKER); assert.equal(r.status, 0, r.err);
  assert.equal(bal(b), 0); assert.equal(dwlStatus(b), 'Done');
});
T('CHAIN update and delete statement triggers: reconcile on UPDATE/DELETE, Done only when balance is exactly zero', () => {
  const b = bn('CH3'); fgDwl(b, 5);
  assert.equal(q(`UPDATE public.fg_bulk_stock_ledger SET qty=0, qty_base=0 WHERE batch_number='${b}' AND source_table='daily_work_log'`).status, 0);   // upd_stmt
  assert.equal(dwlStatus(b), 'Done');
  q(`UPDATE public.daily_work_log SET status='In Storage' WHERE batch_number='${b}' AND activity='FG bulk storage'`);   // reopening is allowed; only marking Done is governed
  assert.equal(q(`SELECT public.fn_fg_ledger_add(1,'${b}',2,'ADJ',77,'manual','2026-11-12')`).status, 0);            // bal 2 -> stays open
  assert.equal(dwlStatus(b), 'In Storage');
  assert.equal(q(`DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}' AND reason_code='ADJ'`).status, 0);   // del_stmt -> bal 0 -> Done
  assert.equal(dwlStatus(b), 'Done');
  // update touching a batch with remaining stock must not mark Done
  const c = bn('CH4'); fgDwl(c, 5);
  q(`UPDATE public.fg_bulk_stock_ledger SET qty=4, qty_base=4 WHERE batch_number='${c}' AND source_table='daily_work_log'`);
  assert.equal(dwlStatus(c), 'In Storage');
  // transfer UPDATE/DELETE leg rebuild goes through the same triggers without breaking
  q(`INSERT INTO public.fg_bulk_internal_transfer(product_id,batch_number,qty_base,from_plant,to_plant) VALUES (1,'${c}',3,1,2)`, PACKER);
  const id = val(`SELECT max(id) FROM public.fg_bulk_internal_transfer WHERE batch_number='${c}'`);
  assert.equal(q(`UPDATE public.fg_bulk_internal_transfer SET qty_base=2 WHERE id=${id}`, PACKER).status, 0);
  assert.equal(q(`DELETE FROM public.fg_bulk_internal_transfer WHERE id=${id}`, PACKER).status, 0);
  assert.equal(bal(c), 4); assert.equal(dwlStatus(c), 'In Storage');
});
T('CHAIN governed Done: ordinary users cannot mark an FG bulk work log Done directly; reconciliation can', () => {
  const b = bn('CH5'); fgDwl(b, 5);
  assert.match(q(`UPDATE public.daily_work_log SET status='Done' WHERE batch_number='${b}' AND activity='FG bulk storage'`, PACKER).err, /Done is set only by batch reconciliation/);
  assert.equal(dwlStatus(b), 'In Storage');
  // the guard flag is transaction-local and cleared by the reconciler: it does not leak to a later statement
  assert.equal(q(`SELECT public.fn_fg_ledger_add(1,'${b}',-5,'ADJ',78,'manual','2026-11-12')`).status, 0);
  assert.equal(dwlStatus(b), 'Done');
  assert.equal(val(`SELECT coalesce(current_setting('mis.fg_reconcile', true),'')`), '');
});
T('CHAIN concurrency: reconciliation inside the batch lock; concurrent dust packers resolve to one Done, zero balance', async () => {
  const b = bn('CH6'); fgDwl(b, 1.0005); sign(b, SIGNER, '1.0005'); const e = evId(b);
  const call = (sku) => `SELECT public.mis_pack_fg_bulk_v1('${randomUUID()}',${e},'[{"sku_id":${sku},"count":1}]'::jsonb)`;   // 0.5 kg each
  const [x, y] = await Promise.all([pg.psqlAsync(DB, call(10), { uid: PACKER }), pg.psqlAsync(DB, call(11).replace('"count":1', '"count":1'), { uid: PACKER })]);
  const rs = [x, y].map((r) => JSON.parse(r.out.split('\n').find((l) => l.startsWith('{'))));
  assert.ok(rs.every((r) => r.ok), JSON.stringify(rs));
  assert.equal(bal(b), 0); assert.equal(dwlStatus(b), 'Done');
  assert.equal(val(`SELECT count(*) FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}' AND reason_code='AUTO_ZERO'`), '1');
});

// ---------------- fingerprint + resolved-graph install prechecks ----------------
const freshPre = (name) => {
  pg.createDb(name);
  const mig = (f) => fs.readFileSync(path.resolve(here, '../../migrations', f), 'utf8');
  assert.equal(pg.psql(name, fs.readFileSync(path.join(here, '00_base_schema_shim.sql'), 'utf8')).status, 0);
  for (const f of MIGRATION_FILES.slice(0, 3)) assert.equal(pg.psql(name, mig(f)).status, 0, f);
  return { mig3b: mig(MIGRATION_FILES[3]), run: (sql) => pg.psql(name, sql) };
};
T('FINGERPRINT migration pins the supplied live SHAs; literal pins refuse a non-identical schema; mutation after seeding refuses', () => {
  const mig3b = fs.readFileSync(path.resolve(here, '../../migrations', MIGRATION_FILES[3]), 'utf8');
  for (const [fn, sha] of Object.entries(LIVE_SHAS)) assert.ok(mig3b.includes(`'${fn}','${sha}'`), fn);
  const a = freshPre('g7fp');                                         // no shim seeding: literal live SHAs are enforced
  const r = a.run(a.mig3b); assert.notEqual(r.status, 0); assert.match(r.err, /live function fingerprint mismatch/);
  assert.equal(a.run(`SELECT prosecdef FROM pg_proc WHERE oid='public.fn_fg_auto_zero(integer,text,numeric)'::regprocedure`).out, 'f');   // nothing applied
  assert.equal(a.run(`SELECT has_table_privilege('authenticated','public.fg_bulk_stock_ledger','INSERT')`).out, 't');
  const b = freshPre('g7fm'); assert.equal(b.run(seedShimFingerprintsSql()).status, 0);
  assert.equal(b.run(`CREATE OR REPLACE FUNCTION public.fn_fg_ledger_add(p_product integer, p_bn text, p_qty numeric, p_reason text, p_src_id integer, p_src text, p_date date) RETURNS void LANGUAGE sql SET search_path TO 'pg_catalog','public','public','pg_temp' AS $$ SELECT 1 $$`).status, 0);
  assert.match(b.run(b.mig3b).err, /fingerprint mismatch.*fn_fg_ledger_add/);
});
T('GRAPH precheck refuses: invoker caller of the reconciler, client-executable reconciler, missing statement trigger, unpinned chain member', () => {
  const run1 = (setup, re) => { const g = freshPre(`g7g${++n}`); assert.equal(g.run(seedShimFingerprintsSql()).status, 0); assert.equal(g.run(setup).status, 0, setup);
    const r = g.run(g.mig3b); assert.notEqual(r.status, 0); assert.match(r.err, re, r.err);
    assert.equal(g.run(`SELECT prosecdef FROM pg_proc WHERE oid='public.fn_fg_reconcile_batch(integer,text,numeric)'::regprocedure`).out, 'f'); };
  run1(`CREATE FUNCTION public.sneaky_reconcile() RETURNS void LANGUAGE sql AS $$ SELECT public.fn_fg_reconcile_batch(1,'x',0.001) $$`, /invoker functions call revoked helpers: sneaky_reconcile\(\)/);
  run1(`GRANT EXECUTE ON FUNCTION public.fn_fg_reconcile_batch(integer,text,numeric) TO authenticated`, /fn_fg_reconcile_batch is executable by a client role/);
  run1(`DROP TRIGGER trg_fg_ledger_reconcile_del_stmt ON public.fg_bulk_stock_ledger`, /trg_fg_ledger_reconcile_del_stmt\(\) is not an installed statement-level trigger/);
  run1(`ALTER FUNCTION public.fn_fg_reconcile_batch(integer,text,numeric) RESET search_path`, /fn_fg_reconcile_batch\(integer,text,numeric\) has no pinned search_path/);
});
test('BLOCKED (not PASS): live-schema compile, live role/JWT simulation, early-lock force-close/auto-zero wrappers, legitimate corrections under ENFORCE', { skip: 'BLOCKED: needs live definitions / owner authorization; see README' }, () => {});
