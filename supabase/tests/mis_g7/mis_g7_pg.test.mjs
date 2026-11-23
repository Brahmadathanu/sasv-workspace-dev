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
  for (const tbl of ['mis_batch_stage_event', 'mis_fg_signed_excess_receipt', 'mis_fg_pack_request']) {
    for (const stmt of [`SELECT 1 FROM app_private.${tbl}`, `DELETE FROM app_private.${tbl}`, `UPDATE app_private.${tbl} SET evidence_ref=evidence_ref`])
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
  q(`UPDATE public.packaging_events SET event_type='Labeling' WHERE id=${evId(b)}`);
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
T('S3 legacy ledger access for authenticated is UNCHANGED (hardening is a draft, not applied)', () => {
  // Documents the residual: direct authenticated DML on the ledger still works => the shared
  // lock protects concurrency (all paths take it) but does not forbid bypass of S2/S4 gates.
  const b = bn('S3H'); mk(b);
  const r = q(`INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,qty,qty_base,uom) VALUES (1,'${b}',1,1,'kg')`, SIGNER);
  assert.equal(r.status, 0, 'expected direct authenticated insert still permitted');
});
test('BLOCKED (not PASS): ledger direct-DML denial, early-lock force-close/auto-zero wrappers, live-schema compile', { skip: 'BLOCKED: requires live function security attributes / owner authorization; see README' }, () => {});
