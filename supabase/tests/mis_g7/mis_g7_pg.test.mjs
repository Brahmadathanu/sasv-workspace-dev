// Real PostgreSQL tests for G7 S2-S4 (ephemeral local cluster). If PostgreSQL cannot be
// started every test is SKIPPED with the label BLOCKED -- never reported as PASS.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startPg, installBaseAndMigrations } from './pg_harness.mjs';

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
  const B = pg.psqlAsync(DB, `SELECT public.fn_fg_force_close(1,'${b}')`);
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
const setMode = (m) => { const r = q(`UPDATE app_private.mis_g7_enforcement SET mode='${m}'`); assert.equal(r.status, 0, r.err); };
const anon = (sql) => pg.psql(DB, `SET ROLE anon; ${sql}`);

T('PARITY live-evidenced types: bigint ids, enum event_type, integer ledger source_id, new RPC/table types', () => {
  const t = (tbl, col) => val(`SELECT data_type||':'||udt_name FROM information_schema.columns WHERE table_schema='${tbl.split('.')[0]}' AND table_name='${tbl.split('.')[1]}' AND column_name='${col}'`);
  for (const [tbl, col] of [['public.packaging_events', 'id'], ['public.packaging_events', 'work_log_id'], ['public.event_skus', 'id'],
    ['public.event_skus', 'packaging_event_id'], ['public.event_skus', 'sku_id'], ['public.product_skus', 'id'], ['public.product_skus', 'product_id'],
    ['app_private.mis_fg_pack_request', 'packaging_event_id'], ['app_private.mis_fg_signed_excess_receipt', 'packaging_event_id'], ['app_private.mis_g7_pack_ticket', 'packaging_event_id']])
    assert.equal(t(tbl, col), 'bigint:int8', `${tbl}.${col}`);
  assert.equal(t('public.packaging_events', 'event_type'), 'USER-DEFINED:packaging_event_type');
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
  for (const f of ['app_private.mis_lock_fg_batch(integer,text)', 'app_private.mis_resolve_batch_stage(integer,text,integer,bigint)', 'app_private.mis_stage_fp(integer,text,integer,bigint,integer)', 'app_private.mis_g7_gate_check(text,text,bigint,bigint)'])
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
T('BOUNDARY old-client authenticated writers still work (AUDIT mode): DWL receipt, direct SKU insert, transfer, auto-zero, ledger_add, force-close', () => {
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
  assert.equal(q(`SELECT public.fn_fg_ledger_add(1,'${b}',5,'ADJ',0,'manual','2026-11-12')`, AU).status, 0); assert.equal(bal(b), 55);
  assert.equal(q(`INSERT INTO public.fg_bulk_internal_transfer(product_id,batch_number,qty_base,from_plant,to_plant) VALUES (1,'${b}',10,1,2)`, AU).status, 0); assert.equal(bal(b), 55);
  assert.equal(q(`SELECT public.fn_fg_auto_zero(1,'${b}',0.001)`, AU).status, 0);
  assert.equal(q(`SELECT public.fn_fg_force_close(1,'${b}')`, AU).status, 0); assert.equal(bal(b), 0);
  // negative guard still protects old clients
  assert.match(q(`SELECT public.fn_fg_ledger_add(1,'${b}',-1,'ADJ',0,'manual','2026-11-12')`, AU).err, /would make stock negative/);
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
  const B = pg.psqlAsync(DB, `SELECT public.fn_fg_force_close(1,'${b}')`);
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
test('BLOCKED (not PASS): live-schema compile, live role/JWT simulation, early-lock force-close/auto-zero wrappers, legitimate corrections under ENFORCE', { skip: 'BLOCKED: needs live definitions / owner authorization; see README' }, () => {});
