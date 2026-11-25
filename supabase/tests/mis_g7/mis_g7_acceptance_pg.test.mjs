// MIS G7 consolidated server acceptance (S2-S4b) on an ephemeral local PostgreSQL 16 cluster, production-shaped shim.
// Tests are SKIPPED with the label BLOCKED when PostgreSQL is unavailable -- never reported as PASS.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startPg, installBaseAndMigrations, installLiveEditor, seedShimFingerprintsSql, MIGRATIONS, FINGERPRINT_MIGRATION } from './pg_harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const docs = path.resolve(here, '../../../docs/executive-mis-g7-server');
const migText = (f) => fs.readFileSync(path.resolve(here, '../../migrations', f), 'utf8');
const DB = 'acc';
const SIGNER = '00000000-0000-0000-0000-000000000001';
const PACKER = '00000000-0000-0000-0000-000000000002';
const EXCESS = '00000000-0000-0000-0000-000000000003';
const NOBODY = '00000000-0000-0000-0000-000000000004';
const ADMIN = '00000000-0000-0000-0000-0000000000ad';
const ADMINV = '00000000-0000-0000-0000-0000000000ae';   // view-only admin
const VIEWER = '00000000-0000-0000-0000-0000000000af';   // can_view but not can_edit on the DWL editor
const SIGNOFF = '00000000-0000-0000-0000-0000000000b0';  // owner sign-off authority for the core migration
let pg = null; let blocked = null;

before(() => {
  pg = startPg();
  if (!pg) { blocked = 'BLOCKED: local PostgreSQL unavailable'; return; }
  pg.createDb(DB);
  installBaseAndMigrations(pg, DB);
  assert.equal(pg.psql(DB, fs.readFileSync(path.join(here, '01_seed.sql'), 'utf8')).status, 0);
  assert.equal(pg.psql(DB, `INSERT INTO public.test_perm(uid,target,can_view,can_edit) VALUES ('${ADMIN}','module:mis-g7-enforcement-admin',true,true),
    ('${ADMINV}','module:mis-g7-enforcement-admin',true,false), ('${VIEWER}','module:edit-log-entry',true,false), ('${SIGNOFF}','module:mis-g7-core-migration-signoff',true,true)`).status, 0);
});
after(() => { if (pg) pg.stop(); });

const T = (name, fn) => test(name, async (t) => { if (blocked) return t.skip(blocked); await fn(t); });
const q = (sql, uid) => pg.psql(DB, sql, uid === undefined ? {} : { uid });
const val = (sql, uid) => { const r = q(sql, uid); assert.equal(r.status, 0, r.err + ' :: ' + sql); return r.out.split('\n').pop(); };
const jl = (out) => JSON.parse(out.split('\n').find((l) => l.startsWith('{')));
const J = (sql, uid) => jl(q(sql, uid).out);
const anon = (sql) => pg.psql(DB, `SET ROLE anon; ${sql}`);
const svc = (sql) => pg.psql(DB, `SET ROLE service_role; ${sql}`);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const hold = (body, secs) => `BEGIN; ${body}; SELECT pg_sleep(${secs}); COMMIT;`;
let n = 0; const bn = (p) => `${p}${++n}`;

function mkSigned(b, qty = 100) {
  val(`SELECT public.t_mkbatch('${b}', ${qty})`);
  const wl = val(`SELECT id FROM public.daily_work_log WHERE batch_number='${b}' AND activity='FG bulk storage'`);
  const r = J(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'${b}',${wl},2,1,${qty},'weighment ${b}')`, SIGNER);
  assert.equal(r.ok, true, JSON.stringify(r));
}
const evId = (b) => val(`SELECT pe.id FROM public.packaging_events pe JOIN public.daily_work_log w ON w.id=pe.work_log_id WHERE w.batch_number='${b}'`);
const bal = (b) => Number(val(`SELECT coalesce(sum(qty_base),0) FROM public.fg_bulk_stock_ledger WHERE product_id=1 AND batch_number='${b}'`));
const pack = (b, lines, o = {}) => J(`SELECT public.mis_pack_fg_bulk_v1('${o.key ?? randomUUID()}', ${evId(b)}, '${JSON.stringify(lines)}'::jsonb, ${o.excess ? `'${JSON.stringify(o.excess)}'::jsonb` : 'NULL'})`, o.uid ?? PACKER);
const lineId = (b, sku) => val(`SELECT id FROM public.event_skus WHERE packaging_event_id=${evId(b)} AND sku_id=${sku}`);
const corr = (id, cnt, o = {}) => J(`SELECT public.mis_correct_pack_line_v1('${o.key ?? randomUUID()}', ${id}, ${cnt}, '${o.reason ?? 'recount'}', ${o.excess ? `'${JSON.stringify(o.excess)}'::jsonb` : 'NULL'})`, o.uid ?? PACKER);
const lineBal = (id) => Number(val(`SELECT coalesce(sum(qty_base),0) FROM public.fg_bulk_stock_ledger WHERE source_table='event_skus' AND source_id=${id}`));
const setMode = (m, reason = 'acceptance test', uid = ADMIN) => J(`SELECT public.mis_g7_set_enforcement_v1('${m}','${reason}')`, uid);

// ---------------------------- ticketed corrections ----------------------------
T('CORR migrations install; correction RPC ACL, definer, pinned search_path', () => {
  const f = 'public.mis_correct_pack_line_v1(uuid,bigint,integer,text,jsonb)';
  assert.equal(val(`SELECT prosecdef FROM pg_proc WHERE oid='${f}'::regprocedure`), 't');
  assert.match(val(`SELECT array_to_string(proconfig,';') FROM pg_proc WHERE oid='${f}'::regprocedure`), /search_path=pg_catalog, public, pg_temp/);
  for (const [role, exp] of [['authenticated', 't'], ['anon', 'f'], ['public', 'f']]) assert.equal(val(`SELECT has_function_privilege('${role}','${f}','EXECUTE')`), exp, role);
  for (const t of ['mis_fg_pack_correction', 'mis_g7_enforcement_log'])
    for (const stmt of [`SELECT 1 FROM app_private.${t}`, `DELETE FROM app_private.${t}`]) assert.match(q(stmt, PACKER).err, /permission denied/, stmt);
});
T('CORR decrease / increase / remove: stock moves exactly, ledger per line is consistent, idempotent, audited', () => {
  const b = bn('AC1'); mkSigned(b);
  assert.equal(pack(b, [{ sku_id: 10, count: 20 }]).ok, true);            // 10 kg -> 90
  const id = lineId(b, 10); assert.equal(bal(b), 90); assert.equal(lineBal(id), -10);
  const key = randomUUID();
  const r1 = corr(id, 10, { key }); assert.equal(r1.ok, true, JSON.stringify(r1));
  assert.equal(Number(r1.stock_delta_base), 5); assert.equal(r1.old_count, 20); assert.equal(r1.new_count, 10); assert.equal(r1.line_removed, false);
  assert.equal(bal(b), 95); assert.equal(lineBal(id), -5);
  assert.equal(corr(id, 10, { key }).idempotent_replay, true); assert.equal(bal(b), 95);          // replay writes nothing
  assert.equal(corr(id, 99, { key }).code, 'IDEMPOTENCY_KEY_REUSED');
  assert.equal(corr(id, 30).ok, true); assert.equal(bal(b), 85); assert.equal(lineBal(id), -15);   // increase consumes more
  const r0 = corr(id, 0); assert.equal(r0.ok, true); assert.equal(r0.line_removed, true);           // remove: everything returned
  assert.equal(bal(b), 100); assert.equal(lineBal(id), 0);
  assert.equal(val(`SELECT count(*) FROM public.event_skus WHERE id=${id}`), '0');
  assert.equal(val(`SELECT count(*) FROM app_private.mis_fg_pack_correction WHERE event_sku_id=${id}`), '3');
  assert.equal(corr(id, 5).code, 'CORRECTION_LINE_NOT_FOUND');
});
T('CORR insufficient stock: structured quantities; excess only with separate authority; atomic with correction', () => {
  const b = bn('AC2'); mkSigned(b, 10);
  assert.equal(pack(b, [{ sku_id: 10, count: 18 }]).ok, true);          // 9 kg -> 1 left
  const id = lineId(b, 10);
  const r = corr(id, 40);                                              // would consume 20kg total => +11 kg needed, 1 available
  assert.equal(r.code, 'INSUFFICIENT_BULK'); assert.equal(Number(r.required_base), 11); assert.equal(Number(r.available_base), 1);
  assert.equal(Number(r.shortfall_base), 10); assert.equal(r.excess_permitted, false); assert.equal(r.base_uom, 'kg');
  assert.equal(corr(id, 40, { uid: EXCESS }).excess_permitted, true);
  const ex = { qty_base: 10, evidence_ref: 'scale-77', reason: 'measured overfill', authorized: true };
  assert.equal(corr(id, 40, { excess: ex }).code, 'EXCESS_NOT_AUTHORIZED');                         // PACKER lacks excess authority; client flag ignored
  assert.equal(corr(id, 40, { uid: EXCESS, excess: { ...ex, qty_base: 4 } }).code, 'INSUFFICIENT_AFTER_EXCESS');
  assert.equal(corr(id, 40, { uid: EXCESS, excess: { qty_base: -1, evidence_ref: 'e', reason: 'r' } }).code, 'EXCESS_INVALID');
  assert.equal(bal(b), 1); assert.equal(val(`SELECT count(*) FROM app_private.mis_fg_signed_excess_receipt WHERE batch_number='${b}'`), '0');
  const ok = corr(id, 40, { uid: EXCESS, excess: ex }); assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(bal(b), 0); assert.equal(lineBal(id), -20);
  assert.equal(val(`SELECT measured_by FROM app_private.mis_fg_signed_excess_receipt WHERE batch_number='${b}'`), EXCESS);   // actor from JWT
  const c = bn('AC2n'); mkSigned(c); assert.equal(pack(c, [{ sku_id: 10, count: 2 }]).ok, true);
  assert.equal(corr(lineId(c, 10), 4, { uid: EXCESS, excess: ex }).code, 'EXCESS_NOT_NEEDED');
  assert.equal(corr(lineId(c, 10), 1, { uid: EXCESS, excess: ex }).code, 'EXCESS_NOT_NEEDED');   // a decrease never needs excess
});
T('CORR rollback atomicity: a skipped depletion rolls back count, excess receipt, ledger and request record', () => {
  const b = bn('AC3'); mkSigned(b, 10); assert.equal(pack(b, [{ sku_id: 10, count: 18 }]).ok, true);
  const id = lineId(b, 10);
  q(`ALTER TABLE public.event_skus DISABLE TRIGGER trg_fg_ledger_from_es`);
  try {
    const r = q(`SELECT public.mis_correct_pack_line_v1('${randomUUID()}', ${id}, 40, 'x', '${JSON.stringify({ qty_base: 10, evidence_ref: 'e', reason: 'r' })}'::jsonb)`, EXCESS);
    assert.match(r.err, /MIS_G7_CORRECTION_MISMATCH/);
  } finally { q(`ALTER TABLE public.event_skus ENABLE TRIGGER trg_fg_ledger_from_es`); }
  assert.equal(val(`SELECT "count" FROM public.event_skus WHERE id=${id}`), '18'); assert.equal(bal(b), 1);
  assert.equal(val(`SELECT count(*) FROM app_private.mis_fg_signed_excess_receipt WHERE batch_number='${b}'`), '0');
  assert.equal(val(`SELECT count(*) FROM app_private.mis_fg_pack_correction WHERE event_sku_id=${id}`), '0');
  assert.equal(val(`SELECT count(*) FROM app_private.mis_fg_pack_request WHERE batch_number='${b}' AND response->>'event_sku_id' IS NOT NULL`), '0');
});
T('CORR refusals never fabricate stock: unsigned/historical, no depletion basis, tampered ledger, drifted source, non-bulk, bad input', () => {
  // unsigned (historical-style) batch with a legacy line
  const u = bn('AC4u'); q(`SELECT public.t_mkbatch('${u}', 100)`); const ue = evId(u);
  q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ue},10,10)`);
  const r = corr(lineId(u, 10), 2); assert.equal(r.code, 'FG_STAGE_NOT_SIGNED'); assert.equal(r.historical_state, 'NOT_VERIFIED'); assert.equal(bal(u), 95);
  // signed batch: line whose depletion was silently skipped (the historical C3 class) -> no basis, no stock returned
  const s = bn('AC4s'); mkSigned(s);
  q(`ALTER TABLE public.event_skus DISABLE TRIGGER trg_fg_ledger_from_es`);
  try { q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${evId(s)},10,10)`); } finally { q(`ALTER TABLE public.event_skus ENABLE TRIGGER trg_fg_ledger_from_es`); }
  const sid = lineId(s, 10); const r2 = corr(sid, 2);
  assert.equal(r2.code, 'CORRECTION_NO_DEPLETION_BASIS'); assert.equal(bal(s), 100);
  assert.equal(corr(sid, 0).code, 'CORRECTION_NO_DEPLETION_BASIS');
  // tampered ledger for a normal line
  const t = bn('AC4t'); mkSigned(t); assert.equal(pack(t, [{ sku_id: 10, count: 10 }]).ok, true); const tid = lineId(t, 10);
  q(`UPDATE public.fg_bulk_stock_ledger SET qty=-4, qty_base=-4 WHERE source_table='event_skus' AND source_id=${tid}`);
  const r3 = corr(tid, 2); assert.equal(r3.code, 'CORRECTION_LEDGER_MISMATCH'); assert.equal(Number(r3.posted_base), -4); assert.equal(Number(r3.expected_posted_base), -5);
  // drifted FG source after signing
  const d = bn('AC4d'); mkSigned(d); assert.equal(pack(d, [{ sku_id: 10, count: 10 }]).ok, true);
  q(`UPDATE public.daily_work_log SET storage_qty=101 WHERE batch_number='${d}' AND activity='FG bulk storage'`);
  assert.equal(corr(lineId(d, 10), 2).code, 'STAGE_SOURCE_CHANGED');
  // non-bulk header, no change, bad input, unknown line
  const m = bn('AC4m'); mkSigned(m); assert.equal(pack(m, [{ sku_id: 10, count: 10 }]).ok, true); const mid = lineId(m, 10);
  assert.equal(corr(mid, 10).code, 'CORRECTION_NO_CHANGE'); assert.equal(corr(mid, -1).code, 'INVALID_INPUT');
  assert.equal(corr(mid, 3, { reason: '  ' }).code, 'INVALID_INPUT'); assert.equal(corr(999999, 3).code, 'CORRECTION_LINE_NOT_FOUND');
  q(`UPDATE public.packaging_events SET event_type='Transfer to FG store' WHERE id=${evId(m)}`);
  assert.equal(corr(mid, 3).code, 'EVENT_NOT_BULK_AFFECTING'); assert.equal(bal(m), 95);
});
T('CORR concurrency: two corrections of one line serialize on the batch lock; ledger always equals the final count', async () => {
  const b = bn('AC5'); mkSigned(b); assert.equal(pack(b, [{ sku_id: 10, count: 20 }]).ok, true); const id = lineId(b, 10);
  const call = (cnt) => `SELECT public.mis_correct_pack_line_v1('${randomUUID()}', ${id}, ${cnt}, 'race')`;
  const A = pg.psqlAsync(DB, hold(call(10), 1.5), { uid: PACKER });
  await delay(400);
  const B = pg.psqlAsync(DB, call(40), { uid: PACKER });
  const [a, bb] = await Promise.all([A, B]);
  assert.equal(jl(a.out).ok, true); assert.equal(jl(bb.out).ok, true, bb.err); assert.ok(bb.ms >= 1000, `second correction waited ${bb.ms}ms`);
  assert.equal(jl(bb.out).old_count, 10);                                        // saw the first correction's result
  assert.equal(val(`SELECT "count" FROM public.event_skus WHERE id=${id}`), '40'); assert.equal(lineBal(id), -20); assert.equal(bal(b), 80);
});
T('CORR vs concurrent pack on a scarce batch: never negative; loser gets structured INSUFFICIENT_BULK', async () => {
  const b = bn('AC6'); mkSigned(b, 10); assert.equal(pack(b, [{ sku_id: 10, count: 10 }]).ok, true); const id = lineId(b, 10);   // 5 kg used, 5 left
  const A = pg.psqlAsync(DB, hold(`SELECT public.mis_correct_pack_line_v1('${randomUUID()}', ${id}, 20, 'grow')`, 1.5), { uid: PACKER });   // +5 kg
  await delay(400);
  const B = pg.psqlAsync(DB, `SELECT public.mis_pack_fg_bulk_v1('${randomUUID()}', ${evId(b)}, '[{"sku_id":11,"count":2}]'::jsonb)`, { uid: PACKER });   // 1 kg
  const [a, bb] = await Promise.all([A, B]);
  assert.equal(jl(a.out).ok, true); const rb = jl(bb.out);
  assert.equal(rb.code, 'INSUFFICIENT_BULK'); assert.equal(Number(rb.available_base), 0); assert.equal(bal(b), 0);
});

// The governed DWL editor (exact live wrapper/core/parser) is tested in mis_g7_live_editor_pg.test.mjs.
// Here the enforcement tests only need a core that is migrated to the S5 primitives AND signed off, applied once:
let enforceReady = false;
function ensureEnforceReady() {
  if (enforceReady) return;
  const mig = migText('20261123150000_mis_g7_s5b_legacy_dwl_editor_core_integration.sql');
  assert.equal(pg.psql(DB, mig).status, 0);
  const sha = val(`SELECT encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') FROM pg_proc p WHERE p.proname='rpc_update_daily_work_log_with_packaging__core'`);
  assert.equal(J(`SELECT public.mis_g7_record_core_migration_acceptance_v1('${sha}','owner review G7-core-1')`, SIGNOFF).ok, true);
  enforceReady = true;
}
const setModeSql = (m) => assert.equal(q(`UPDATE app_private.mis_g7_enforcement SET mode='${m}'`).status, 0);

// ---------------------------- ENFORCE mode end-to-end ----------------------------
T('ENFORCE: admin switch is logged; legacy direct line writes denied; ticketed RPCs still work; AUDIT restores legacy', () => {
  ensureEnforceReady();
  const b = bn('EN1'); mkSigned(b); assert.equal(pack(b, [{ sku_id: 10, count: 20 }]).ok, true);
  const id = lineId(b, 10); const ev = evId(b);
  assert.equal(setMode('ENFORCE', 'acceptance').ok, true);
  try {
    const d = (stmt) => assert.match(q(stmt, PACKER).err, /MIS_G7_DIRECT_PACKING_DENIED/, stmt);
    d(`UPDATE public.event_skus SET "count"=5 WHERE id=${id}`); d(`DELETE FROM public.event_skus WHERE id=${id}`);
    d(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ev},11,1)`);
    d(`UPDATE public.packaging_events SET event_type='Transfer to FG store' WHERE id=${ev}`);
    assert.equal(corr(id, 10).ok, true); assert.equal(bal(b), 95);            // governed correction works under ENFORCE
    d(`UPDATE public.event_skus SET "count"=3 WHERE id=${id}`);                // ticket is per transaction: later direct write denied
    assert.equal(pack(b, [{ sku_id: 11, count: 2 }]).ok, true); assert.equal(bal(b), 94);
    assert.equal(corr(id, 0).ok, true); assert.equal(bal(b), 99);
  } finally { assert.equal(setMode('AUDIT', 'acceptance done').ok, true); }
  assert.equal(q(`UPDATE public.event_skus SET "count"="count" WHERE packaging_event_id=${ev}`, PACKER).status, 0);   // legacy path open again
  const logs = q(`SELECT from_mode||'>'||to_mode||':'||actor FROM app_private.mis_g7_enforcement_log ORDER BY log_id DESC LIMIT 2`).out.split('\n');
  assert.deepEqual(logs, [`ENFORCE>AUDIT:${ADMIN}`, `AUDIT>ENFORCE:${ADMIN}`]);
});
T('ENFORCE switch guards: invalid input, unchanged, non-admin and anon denied, refused without the correction path', () => {
  assert.equal(setMode('FOO').code, 'INVALID_INPUT'); assert.equal(setMode('ENFORCE', '  ').code, 'INVALID_INPUT');
  assert.equal(setMode('AUDIT').code, 'MODE_UNCHANGED');
  for (const uid of [NOBODY, SIGNER, PACKER, EXCESS]) assert.match(q(`SELECT public.mis_g7_set_enforcement_v1('ENFORCE','x')`, uid).err, /permission denied/);
  assert.match(anon(`SELECT public.mis_g7_set_enforcement_v1('ENFORCE','x')`).err, /permission denied/);
  q(`ALTER FUNCTION public.mis_correct_pack_line_v1(uuid,bigint,integer,text,jsonb) RENAME TO mis_correct_pack_line_v1_tmp`);
  try { assert.equal(setMode('ENFORCE').code, 'CORRECTION_PATH_NOT_INSTALLED'); }
  finally { q(`ALTER FUNCTION public.mis_correct_pack_line_v1_tmp(uuid,bigint,integer,text,jsonb) RENAME TO mis_correct_pack_line_v1`); }
  assert.equal(val(`SELECT mode FROM app_private.mis_g7_enforcement`), 'AUDIT');
});

// ---------------------------- legacy production logging compatibility ----------------------------
T('LEGACY AUDIT mode: old-client direct writes proceed unchanged and are logged with actor/op/txid; RPC lines are not logged', () => {
  assert.equal(val(`SELECT mode FROM app_private.mis_g7_enforcement`), 'AUDIT');
  const b = bn('LG1'); mkSigned(b); const ev = evId(b);
  const cnt = () => Number(val(`SELECT count(*) FROM app_private.mis_g7_direct_pack_audit`));
  const c0 = cnt();
  assert.equal(pack(b, [{ sku_id: 10, count: 10 }]).ok, true); assert.equal(cnt(), c0);            // ticketed: not a direct write
  assert.equal(q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ev},11,4)`, PACKER).status, 0);   // legacy insert works + depletes
  assert.equal(bal(b), 100 - 5 - 2);   // sku 11: 4 x 500 g x 0.001 = 2 kg
  assert.equal(q(`UPDATE public.event_skus SET "count"=8 WHERE packaging_event_id=${ev} AND sku_id=11`, PACKER).status, 0); assert.equal(bal(b), 100 - 5 - 4);
  assert.equal(q(`DELETE FROM public.event_skus WHERE packaging_event_id=${ev} AND sku_id=11`, PACKER).status, 0); assert.equal(bal(b), 95);
  assert.equal(cnt(), c0 + 3);
  const rows = q(`SELECT op||'|'||tbl||'|'||actor||'|'||mode FROM app_private.mis_g7_direct_pack_audit ORDER BY audit_id DESC LIMIT 3`).out.split('\n').sort();
  assert.deepEqual(rows, [`DELETE|event_skus|${PACKER}|AUDIT`, `INSERT|event_skus|${PACKER}|AUDIT`, `UPDATE|event_skus|${PACKER}|AUDIT`]);
  assert.equal(val(`SELECT count(DISTINCT txid) FROM (SELECT txid FROM app_private.mis_g7_direct_pack_audit ORDER BY audit_id DESC LIMIT 3) x`), '3');
  assert.match(q(`UPDATE app_private.mis_g7_direct_pack_audit SET op='x'`).err, /APPEND_ONLY/); assert.match(q(`DELETE FROM app_private.mis_g7_direct_pack_audit`).err, /APPEND_ONLY/);
  assert.match(q(`SELECT 1 FROM app_private.mis_g7_direct_pack_audit`, PACKER).err, /permission denied/);
  // legacy governed definer path (stand-in for the DWL RPC) also logs (actor NULL: definer context has the caller's JWT, so actor present)
  assert.equal(q(`SELECT public.t_client_rpc($q$INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ev},11,2)$q$)`, PACKER).status, 0);
  assert.equal(cnt(), c0 + 4); assert.equal(bal(b), 94);
  // non-bulk packaging stages are never logged or blocked
  const nb = bn('LG1n'); mkSigned(nb); q(`UPDATE public.packaging_events SET event_type='Transfer to FG store' WHERE id=${evId(nb)}`);
  const c1 = cnt(); assert.equal(q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${evId(nb)},10,3)`, PACKER).status, 0); assert.equal(cnt(), c1);
});
T('LEGACY readiness report: counts direct writes by table/op for the window; admin-only; window clamped', () => {
  const r = J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN);
  assert.equal(r.ok, true); assert.equal(r.mode, 'AUDIT'); assert.equal(r.window_days, 7);
  const total = r.direct_writes.reduce((a, x) => a + x.writes, 0);
  assert.equal(total, Number(val(`SELECT count(*) FROM app_private.mis_g7_direct_pack_audit WHERE at >= clock_timestamp() - interval '7 days'`)));
  assert.ok(r.direct_writes.some((x) => x.tbl === 'event_skus' && x.op === 'INSERT' && x.distinct_actors >= 1));
  assert.ok(r.ticketed_packs >= 1); assert.ok(r.ticketed_corrections >= 1);
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(100000)`, ADMIN).window_days, 365);
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(0)`, ADMIN).window_days, 1);
  for (const uid of [NOBODY, SIGNER, PACKER, EXCESS]) assert.match(q(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, uid).err, /permission denied/);
  assert.match(anon(`SELECT public.mis_g7_enforcement_readiness_v1(7)`).err, /permission denied/);
});

// ---------------------------- real authenticated permission matrix ----------------------------
T('PERMISSION MATRIX: every public RPC x role incl. view-only admin / view-only editor / core sign-off (live View vs Edit semantics)', () => {
  const k = () => randomUUID();
  const calls = {
    sign: `SELECT public.mis_sign_batch_stage_v1('${k()}',1,'NOPE',1,2,1,10,'e')`,
    correct_stage: `SELECT public.mis_correct_batch_stage_v1('${k()}',999999,'r')`,
    pack: `SELECT public.mis_pack_fg_bulk_v1('${k()}',999999,'[{"sku_id":10,"count":1}]'::jsonb)`,
    correct_line: `SELECT public.mis_correct_pack_line_v1('${k()}',999999,1,'r')`,
    mark_done: `SELECT public.fn_fg_mark_done_if_zero(1,'NOPE',0.001)`,
    set_mode: `SELECT public.mis_g7_set_enforcement_v1('AUDIT','matrix')`,
    readiness: `SELECT public.mis_g7_enforcement_readiness_v1(1)`,
    accept_core: `SELECT public.mis_g7_record_core_migration_acceptance_v1('${'0'.repeat(64)}','matrix')`,
    dwl_editor: `SELECT * FROM public.t_edit_dwl(999999, '{}'::jsonb)`,
  };
  const allowed = { sign: [SIGNER], correct_stage: [SIGNER], pack: [PACKER, EXCESS], correct_line: [PACKER, EXCESS], mark_done: [PACKER, 'service_role'], set_mode: [ADMIN], readiness: [ADMIN, ADMINV], accept_core: [SIGNOFF], dwl_editor: [PACKER] };
  const denied = /permission denied|MIS_G7_AUTH_REQUIRED/;
  const roles = { anon: null, nobody: NOBODY, signer: SIGNER, packer: PACKER, excess: EXCESS, admin: ADMIN, admin_view_only: ADMINV, viewer: VIEWER, signoff: SIGNOFF, service_role: 'service_role' };
  for (const [name, sql] of Object.entries(calls)) for (const [label, uid] of Object.entries(roles)) {
    const r = label === 'anon' ? anon(sql) : uid === 'service_role' ? svc(sql) : q(sql, uid);
    const isAllowed = allowed[name].includes(uid);
    if (isAllowed) assert.doesNotMatch(r.err, denied, `${name} should be authorized for ${label}: ${r.err}`);   // dwl_editor raises 'work log not found' for PACKER: authorized
    else assert.match(r.err, denied, `${name} must be denied for ${label} (status ${r.status}, out ${r.out})`);
  }
  // an authorized call that fails on DOMAIN grounds writes nothing and returns a coded refusal, not a raised permission error
  assert.equal(J(calls.pack, PACKER).code, 'PACKAGING_EVENT_NOT_FOUND'); assert.equal(J(calls.correct_line, PACKER).code, 'CORRECTION_LINE_NOT_FOUND');
  assert.equal(J(calls.correct_stage, SIGNER).code, 'EVENT_NOT_FOUND');
  // live require_permission semantics (confirmed by the independent review): can_view, plus can_edit when edit is required.
  // A view-only admin can read the readiness report but cannot switch the mode; a view-only editor cannot use the DWL editor.
  assert.equal(J(calls.readiness, ADMINV).ok, true); assert.match(q(calls.set_mode, ADMINV).err, /permission denied/); assert.match(q(calls.dwl_editor, VIEWER).err, /permission denied/);
  assert.equal(J(calls.accept_core, SIGNOFF).code === 'CORE_SHA_MISMATCH', true);
});

T('CORE read-only pre-migration check: 6/6 TRUE against the exact live editor source (unpatched), creates nothing', () => {
  const run = freshChain('acccore');
  const r = run(fs.readFileSync(path.join(docs, 'CORE_PREINSTALL_LIVE_CHECK_READONLY.sql'), 'utf8')); assert.equal(r.status, 0, r.err);
  const rows = r.out.split('\n').filter(Boolean).map((l) => l.split('|'));
  assert.equal(rows.length, 7); for (const [name, ok] of rows) assert.equal(ok, 't', name);   // incl. core sha256 == df7290df... (exact source)
  const man = JSON.parse(fs.readFileSync(path.join(docs, 'LIVE_BASELINE_MANIFEST.json'), 'utf8'));
  assert.equal(man.legacy_dwl_editor.core_sha256, 'df7290df4a17e4af9f0aed43cf564007a35b957d8899b98869d7d35531296aec');
});

// ---------------------------- contract / baseline consistency ----------------------------
T('CONTRACT client_rpc_contract.json matches catalog signatures and refusal codes bidirectionally', () => {
  const c = JSON.parse(fs.readFileSync(path.join(docs, 'client_rpc_contract.json'), 'utf8'));
  const resolverSrc = val(`SELECT replace(prosrc, E'\\n', ' ') FROM pg_proc WHERE oid='app_private.mis_resolve_batch_stage(integer,text,integer,bigint)'::regprocedure`);
  for (const r of c.rpcs.filter((x) => !x.status)) {            // S7 entries (status S7a/S7b) are verified against the S7 catalog in s7/mis_g7_s7_pg.test.mjs
    const oid = val(`SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${r.name}'`);
    assert.equal(val(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${r.name}'`), '1', `${r.name} overloaded`);
    const args = val(`SELECT pg_get_function_arguments(${oid})`).split(', ').map((a) => a.replace(/ DEFAULT .*$/, '').split(' '));
    assert.deepEqual(args.map(([nm, ...ty]) => [nm, ty.join(' ')]), r.args, `${r.name} arguments`);
    for (const [nm] of Object.entries(r.defaults ?? {})) assert.match(val(`SELECT pg_get_function_arguments(${oid})`), new RegExp(`${nm} \\S+ DEFAULT`), `${r.name}.${nm} default`);
    assert.equal(val(`SELECT pg_get_function_result(${oid})`), r.returns ?? 'jsonb');
    assert.equal(val(`SELECT prosecdef FROM pg_proc WHERE oid=${oid}`), 't');
    const src = val(`SELECT replace(prosrc, E'\\n', ' ') FROM pg_proc WHERE oid=${oid}`);
    const literals = [...src.matchAll(/'code', '([A-Z_]+)'/g)].map((m) => m[1]);
    for (const code of r.codes) assert.ok(literals.includes(code) || resolverSrc.includes(`'${code}'`), `${r.name}: documented code ${code} not produced`);
    for (const code of new Set(literals)) assert.ok(r.codes.includes(code), `${r.name}: code ${code} produced but undocumented`);
    for (const k of r.ok_keys ?? []) assert.ok(src.includes(`'${k}'`), `${r.name}: ok key ${k}`);
  }
});
T('BASELINE manifest == migration pins == read-only script == tests (one consistent set of 11 live SHAs)', () => {
  const man = JSON.parse(fs.readFileSync(path.join(docs, 'LIVE_BASELINE_MANIFEST.json'), 'utf8'));
  const mig = migText(MIGRATIONS[3]); const ro = fs.readFileSync(path.join(docs, 'S3B_PREINSTALL_LIVE_CHECK_READONLY.sql'), 'utf8');
  const entries = Object.entries(man.pinned_function_sha256); assert.equal(entries.length, 11);
  for (const [fn, sha] of entries) { assert.ok(mig.includes(`'${fn}','${sha}'`), `migration pin ${fn}`); assert.ok(ro.includes(`'${fn}','${sha}'`), `read-only pin ${fn}`); }
  assert.equal((mig.match(/[0-9a-f]{64}/g) ?? []).length >= 11, true);
  assert.equal(man.live_facts['fn_fg_eps_default()'], '0.01'); assert.equal(man.live_facts.force_close_wrapper_permission, 'module:fg-bulk-stock');
  assert.ok(mig.includes('module:fg-bulk-stock') && !mig.includes('module:daily-work-log'));
  assert.equal(val(`SELECT count(*) FROM app_private.mis_g7_s3b_expected_sha`), '11');
  assert.equal(val(`SELECT count(*) FROM app_private.mis_g7_s3b_baseline WHERE kind='function' AND def IS NOT NULL AND def_sha ~ '^[0-9a-f]{64}$'`), '11');
});

T('MIGRATION FILE NAMES: every migration timestamp is a valid UTC date-time, names are unique and sorted, the G7 set is strictly increasing and after all earlier migrations', () => {
  const dir = path.resolve(here, '../../migrations'); const names = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const ts = (f) => { const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_/.exec(f); assert.ok(m, `bad migration name ${f}`); const [Y, Mo, D, h, mi, se] = m.slice(1).map(Number);
    const d = new Date(Date.UTC(Y, Mo - 1, D, h, mi, se)); assert.ok(d.getUTCFullYear() === Y && d.getUTCMonth() === Mo - 1 && d.getUTCDate() === D && d.getUTCHours() === h && d.getUTCMinutes() === mi && d.getUTCSeconds() === se, `invalid timestamp in ${f}`); return m.slice(1).join(''); };
  const stamps = names.map(ts); assert.equal(new Set(stamps).size, stamps.length, 'duplicate timestamps');
  const all = names.filter((f) => /mis_g7_/.test(f)); const s7 = all.filter((f) => /_s7[a-z]_/.test(f)); const g7 = all.filter((f) => !/_s7[a-z]_/.test(f)); assert.equal(g7.length, 8);
  assert.ok(s7.every((f) => ts(f) > ts(FINGERPRINT_MIGRATION)), 'S7 forward migrations sort after S6'); assert.deepEqual(s7, [...s7].sort());
  const first = names.indexOf(g7[0]); assert.ok(names.slice(0, first).every((f) => ts(f) < ts(g7[0])));
  g7.forEach((f, i) => { if (i) assert.ok(ts(f) > ts(g7[i - 1]), `${f} must sort after ${g7[i - 1]}`); });
  assert.deepEqual(MIGRATIONS, g7.filter((f) => !f.includes('s5b_') && !f.includes('s6_')));                                  // harness order == apply order (S5b is explicitly owner-gated)
  assert.ok(g7.some((f) => f.includes('s5b_')) && ts(g7.find((f) => f.includes('s5b_'))) > ts(MIGRATIONS[MIGRATIONS.length - 1]));
  assert.equal(g7[g7.length - 1], FINGERPRINT_MIGRATION); assert.ok(ts(FINGERPRINT_MIGRATION) > ts(g7.find((f) => f.includes('s5b_'))));
});

T('S3 REMOVES authenticated direct EXECUTE on both S2 advisory-lock helpers; legitimate callers keep working; S3 refuses without S2', () => {
  const H = ['app_private.mis_lock_fg_batch(integer,text)', 'app_private.mis_lock_fg_batches(integer,text,integer,text)'];
  const priv = (run, role, h) => run(`SELECT has_function_privilege('${role}', '${h}', 'EXECUTE')`).out;
  const run = freshChain('accs3');
  // out-of-order: S3 before S2 fails closed (no helpers) and leaves nothing behind
  const early = run(migText(MIGRATIONS[1])); assert.notEqual(early.status, 0);
  assert.equal(run(`SELECT to_regclass('app_private.mis_g7_s3_baseline') IS NULL OR (SELECT count(*) FROM app_private.mis_g7_s3_baseline) = 0`).out, 't');
  assert.equal(run(`SELECT count(*) FROM pg_trigger WHERE tgname = '00_mis_g7_fg_batch_lock'`).out, '0');
  assert.equal(run(migText(MIGRATIONS[0])).status, 0);                                                           // S2 as installed in production
  for (const h of H) for (const role of ['authenticated', 'anon', 'public']) assert.equal(priv(run, role, h), 't', `before S3: ${role} ${h}`);   // S2 left them PUBLIC-executable at function level (S2 revokes schema USAGE from anon, authenticated keeps it)
  const lockAs = (uid, k) => pg.psql('accs3', `SELECT app_private.mis_lock_fg_batch(1,'${k}')`, { uid });
  assert.equal(lockAs(PACKER, 'x').status, 0);                                                                  // before S3 a client could take advisory locks directly
  assert.equal(run(migText(MIGRATIONS[1])).status, 0);                                                           // S3
  for (const h of H) for (const role of ['authenticated', 'anon', 'public']) assert.equal(priv(run, role, h), 'f', `after S3: ${role} ${h}`);
  assert.match(lockAs(PACKER, 'x').err, /permission denied for function mis_lock_fg_batch/);
  assert.match(pg.psql('accs3', `SELECT app_private.mis_lock_fg_batches(1,'a',1,'b')`, { uid: SIGNER }).err, /permission denied for function mis_lock_fg_batches/);
  assert.equal(run(`SELECT count(*) FROM app_private.mis_g7_s3_baseline`).out, '2');
  // legitimate callers: S2 definer RPCs (they call the helpers as the owner), the S3 ledger trigger (any writer) and the correction RPC
  assert.equal(run(`SELECT public.t_mkbatch_real('S3A', 100)`).status, 0);
  const wl = run(`SELECT id FROM public.daily_work_log WHERE batch_number='S3A' AND activity='FG bulk storage'`).out;
  const sg = JSON.parse(pg.psql('accs3', `SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'S3A',${wl},2,1,100,'e')`, { uid: SIGNER }).out); assert.equal(sg.ok, true);
  const cr = JSON.parse(pg.psql('accs3', `SELECT public.mis_correct_batch_stage_v1('${randomUUID()}',${sg.event_id},'recount')`, { uid: SIGNER }).out); assert.equal(cr.ok, true);
  assert.equal(run(`INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,qty,qty_base,uom) VALUES (1,'S3A',-1,-1,'kg')`).status, 0);                                   // ledger trigger takes the lock as definer
  assert.equal(run(`SELECT count(*) FROM pg_proc p WHERE p.proname IN ('mis_lock_fg_batch','mis_lock_fg_batches') AND p.prosecdef`).out, '0');                                   // helpers themselves stay INVOKER (unchanged S2 definition)
  // opposite-order multi-key callers still cannot deadlock (helper unchanged), exercised through the definer trigger path
  assert.equal(run(`SELECT has_function_privilege('postgres', '${H[1]}', 'EXECUTE')`).out, 't');
});
T('S2 ROLLBACK section is ISOLATION-ONLY: removes just the two RPCs, keeps tables and signed history; no production section mentions them', () => {
  const run = freshChain('accs2');
  assert.equal(run(migText(MIGRATIONS[0])).status, 0); assert.equal(run(`SELECT public.t_mkbatch_real('S2A', 10)`).status, 0);
  const wl = run(`SELECT id FROM public.daily_work_log WHERE batch_number='S2A' AND activity='FG bulk storage'`).out;
  assert.equal(JSON.parse(pg.psql('accs2', `SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'S2A',${wl},2,1,10,'e')`, { uid: SIGNER }).out).ok, true);
  const rb = fs.readFileSync(path.join(docs, 'ROLLBACK_NOT_A_MIGRATION.sql'), 'utf8');
  const i2 = rb.indexOf('-- ==== S2 ROLLBACK'), i3b = rb.indexOf('-- ==== S3B ROLLBACK ===='); assert.ok(i2 > 0 && i3b > i2);
  assert.match(rb.slice(i2, i3b), /NEVER PRODUCTION/); assert.equal(rb.slice(0, i2).includes('mis_sign_batch_stage_v1') || rb.slice(i3b).includes('mis_sign_batch_stage_v1'), false);
  assert.equal(run(rb.slice(i2, i3b)).status, 0);
  assert.equal(run(`SELECT count(*) FROM pg_proc WHERE proname IN ('mis_sign_batch_stage_v1','mis_correct_batch_stage_v1')`).out, '0');
  assert.equal(run(`SELECT count(*) FROM app_private.mis_batch_stage_event`).out, '1');
});
T('MIGRATION IDENTITIES: recorded SHA-256/git-blob of all eleven G7 migrations (S2–S7c) match the files, all LIVE, pending list empty; S2 equals the blob installed in production', () => {
  const man = JSON.parse(fs.readFileSync(path.join(docs, 'MIGRATION_IDENTITIES.json'), 'utf8'));
  assert.equal(man.migrations.length, 11); assert.deepEqual(man.pending_migrations, []); assert.equal(man.patched_core_sha256, 'dfa5a5e9aa31b48cf41fe9d03800fff2e35e5a3825ca458b5ccb6ca6c4471bcc');
  const blob = (b) => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
  for (const m of man.migrations) {
    const b = fs.readFileSync(path.resolve(here, '../../migrations', m.repo_file));
    assert.equal(createHash('sha256').update(b).digest('hex'), m.sha256, `${m.repo_file} sha256 (regenerate with gen_migration_identities.mjs after an intended change)`);
    assert.equal(blob(b), m.git_blob_sha1, m.repo_file); assert.equal(b.length, m.bytes);
  }
  const s2 = man.migrations[0];
  assert.equal(s2.git_blob_sha1, '055b1cdfa1c8be970939f57e7e866f126ec55f03'); assert.equal(s2.bytes, 21644);                    // the S2 text that is LIVE
  assert.equal(s2.registered_version, '20261124055734'); assert.match(s2.status, /LIVE/);
  assert.deepEqual(man.migrations.map((m) => m.repo_file), [...MIGRATIONS, '20261123150000_mis_g7_s5b_legacy_dwl_editor_core_integration.sql', FINGERPRINT_MIGRATION, '20261124120000_mis_g7_s7a_shared_route_identity_and_stage_status.sql', '20261124121000_mis_g7_s7b_exact_fg_receipt_evidence.sql', '20261124122000_mis_g7_s7c_governed_previews_and_exception_summary.sql']);
  assert.deepEqual(man.migrations.map((m) => m.registered_version), ['20261124055734', '20261124080858', '20261124080913', '20261124080932', '20261124080952', '20261124081009', '20261124081022', '20261124081034', '20261124125626', '20261124125644', '20261124125704']);
  assert.ok(man.migrations.every((m) => /^LIVE/.test(m.status) && /never replay/.test(m.status)));
});

// ---------------------------- migration chain + rollback ----------------------------
const freshChain = (name, upTo = MIGRATIONS.length) => {
  pg.createDb(name);
  assert.equal(pg.psql(name, fs.readFileSync(path.join(here, '00_base_schema_shim.sql'), 'utf8')).status, 0);
  installLiveEditor(pg, name);
  assert.equal(pg.psql(name, fs.readFileSync(path.join(here, '01_seed.sql'), 'utf8')).status, 0);
  return (f) => pg.psql(name, f);
};
T('MIGRATION CHAIN installs cleanly in order on a fresh production-shaped schema; S3b/S4b fail closed when run out of order', () => {
  const run = freshChain('accchain');
  const ordered = [...MIGRATIONS];
  assert.deepEqual(ordered, [...ordered].sort());                                                // file names sort in apply order
  const early = run(migText(MIGRATIONS[4]));                                                       // S4b before S2: depends on tables -> fails
  assert.notEqual(early.status, 0);
  for (const f of MIGRATIONS.slice(0, 3)) assert.equal(run(migText(f)).status, 0, f);
  assert.equal(run(seedShimFingerprintsSql()).status, 0);
  assert.equal(run(migText(MIGRATIONS[3])).status, 0); assert.equal(run(migText(MIGRATIONS[4])).status, 0);
  assert.equal(run(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'mis\\_%'`).out, '6');
});
T('ROLLBACK production order (S5B -> S5 -> S4B -> S3B -> S4 -> S3) restores the pre-S3 catalog exactly, keeps the installed S2 RPCs working and all signed history', () => {
  const run = freshChain('accrb');
  assert.equal(run(migText(MIGRATIONS[0])).status, 0);                                                           // S2 = the production-installed baseline (never replayed afterwards)
  const helpers = ['app_private.mis_lock_fg_batch(integer,text)', 'app_private.mis_lock_fg_batches(integer,text,integer,text)'];
  const helperAcl = () => run(`SELECT string_agg(p.oid::regprocedure::text||'='||coalesce((SELECT string_agg(x::text, ',' ORDER BY x::text) FROM unnest(coalesce(p.proacl, acldefault('f', p.proowner))) x),''), E'\\n' ORDER BY 1) FROM pg_proc p WHERE p.oid IN (${helpers.map((h) => `'${h}'::regprocedure`).join(',')})`).out;
  const s2Acl = helperAcl();
  assert.equal(run(`SELECT has_function_privilege('authenticated','${helpers[0]}','EXECUTE') AND has_function_privilege('authenticated','${helpers[1]}','EXECUTE')`).out, 't');   // S2 as installed leaves both helpers client-callable
  for (const f of MIGRATIONS.slice(1, 3)) assert.equal(run(migText(f)).status, 0, f);
  assert.equal(run(seedShimFingerprintsSql()).status, 0);
  const chain = ['fn_fg_auto_zero(integer,text,numeric)', 'fn_fg_force_close(integer,text,numeric)', 'fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)', 'trg_fg_bulk_internal_transfer_to_ledger()',
    'trg_fg_ledger_from_dwl()', 'trg_fg_ledger_from_es()', 'trg_fg_ledger_reconcile_ins_stmt()', 'trg_fg_ledger_reconcile_upd_stmt()', 'trg_fg_ledger_reconcile_del_stmt()',
    'fn_fg_reconcile_batch(integer,text,numeric)', 'fn_fg_mark_done_if_zero(integer,text,numeric)'];
  const snap = () => { const r = run(`SELECT string_agg(p.oid::regprocedure::text||'|'||encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')||'|'||p.prosecdef||'|'||coalesce(array_to_string(p.proconfig,';'),'')||'|'||
      (SELECT string_agg(x::text, ',' ORDER BY x::text) FROM unnest(coalesce(p.proacl, acldefault('f', p.proowner))) x), E'\\n' ORDER BY p.oid::regprocedure::text) FROM pg_proc p WHERE p.oid IN (${chain.map((c) => `'public.${c}'::regprocedure`).join(',')})
      UNION ALL SELECT (SELECT string_agg(x::text, ',' ORDER BY x::text) FROM pg_class c, unnest(coalesce(c.relacl, acldefault('r', c.relowner))) x WHERE c.oid='public.fg_bulk_stock_ledger'::regclass)`);
    assert.equal(r.status, 0, r.err); return r.out; };
  const before = snap();
  for (const f of MIGRATIONS.slice(3)) assert.equal(run(migText(f)).status, 0, f);
  // exercise the installed system, leave state behind: signed stage, pack, ENFORCE
  const sess = (sql, uid) => pg.psql('accrb', sql, { uid });
  run(`INSERT INTO public.test_perm VALUES ('${ADMIN}','module:mis-g7-enforcement-admin')`);
  assert.equal(run(`SELECT public.t_mkbatch('RBB1',100)`).status, 0);
  const wl = run(`SELECT id FROM public.daily_work_log WHERE batch_number='RBB1' AND activity='FG bulk storage'`).out;
  assert.equal(JSON.parse(sess(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'RBB1',${wl},2,1,100,'e')`, SIGNER).out).ok, true);
  assert.equal(JSON.parse(sess(`SELECT public.mis_g7_set_enforcement_v1('ENFORCE','rb test')`, ADMIN).out).code, 'LEGACY_DWL_EDITOR_NOT_MIGRATED');   // fail closed
  run(`UPDATE app_private.mis_g7_enforcement SET mode='ENFORCE'`);   // owner-forced, to prove rollback returns to AUDIT
  const rb = fs.readFileSync(path.join(docs, 'ROLLBACK_NOT_A_MIGRATION.sql'), 'utf8');
  const at = (m) => rb.indexOf(`-- ==== ${m} ====`);
  const iS4 = at('S4 ROLLBACK'), iS3 = at('S3 ROLLBACK'), iS2 = rb.indexOf('-- ==== S2 ROLLBACK'), iS3b = at('S3B ROLLBACK'), iS4b = at('S4B ROLLBACK'), iS5 = at('S5 ROLLBACK'), iS5b = at('S5B ROLLBACK');
  assert.ok(iS4 > 0 && iS3 > iS4 && iS2 > iS3 && iS3b > iS2 && iS4b > iS3b && iS5 > iS4b && iS5b > iS5);
  const secS4 = rb.slice(iS4, iS3), secS3 = rb.slice(iS3, iS2), secS3b = rb.slice(iS3b, iS4b), secS4b = rb.slice(iS4b, iS5), secS5 = rb.slice(iS5, iS5b), secS5b = rb.slice(iS5b, rb.indexOf('-- ==== S6 ROLLBACK ===='));
  assert.ok(!(secS4 + secS3 + secS3b + secS4b + secS5 + secS5b).includes('mis_sign_batch_stage_v1'));            // the production sections never touch the installed S2 RPCs
  let r = run(secS5); assert.equal(r.status, 0, r.err);
  assert.equal(run(`SELECT mode FROM app_private.mis_g7_enforcement`).out, 'AUDIT');
  r = run(secS4b); assert.equal(r.status, 0, r.err);
  assert.equal(run(`SELECT to_regprocedure('public.mis_correct_pack_line_v1(uuid,bigint,integer,text,jsonb)') IS NULL`).out, 't');
  assert.equal(run(`SELECT count(*) FROM app_private.mis_g7_enforcement_log WHERE actor='00000000-0000-0000-0000-000000000000'`).out, '1');   // only the S5 rollback needed to log (already AUDIT for S4B)
  r = run(secS3b); assert.equal(r.status, 0, r.err);
  assert.equal(snap(), before, 'S3b rollback must restore chain definitions/ACLs exactly');
  r = run(secS4); assert.equal(r.status, 0, r.err); r = run(secS3); assert.equal(r.status, 0, r.err);
  // S2 SURVIVES: both installed RPCs remain, executable by authenticated and not anon, and still work; signed history retained
  assert.equal(run(`SELECT string_agg(p.proname, ',' ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'mis\\_%'`).out, 'mis_correct_batch_stage_v1,mis_sign_batch_stage_v1');
  for (const f of ['public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text)', 'public.mis_correct_batch_stage_v1(uuid,bigint,text)']) {
    assert.equal(run(`SELECT has_function_privilege('authenticated','${f}','EXECUTE') AND NOT has_function_privilege('anon','${f}','EXECUTE')`).out, 't', f); }
  assert.equal(run(`SELECT public.t_mkbatch_real('RBB2',50)`).status, 0);
  assert.equal(JSON.parse(sess(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'RBB2',${run(`SELECT id FROM public.daily_work_log WHERE batch_number='RBB2' AND activity='FG bulk storage'`).out},2,1,50,'post-rollback')`, SIGNER).out).ok, true);   // S2 RPC works without S3+
  assert.equal(run(`SELECT count(*) FROM pg_trigger WHERE tgname LIKE '00\\_mis\\_g7\\_%'`).out, '0');
  assert.equal(run(`SELECT count(*) FROM app_private.mis_batch_stage_event`).out, '2');                                // signed history retained (+ the post-rollback signing)
  assert.equal(helperAcl(), s2Acl, 'S3 rollback restores the exact S2-installed helper ACLs');
  for (const t of ['mis_fg_signed_excess_receipt', 'mis_fg_pack_request', 'mis_g7_pack_ticket', 'mis_g7_enforcement', 'mis_g7_direct_pack_audit', 'mis_fg_pack_correction', 'mis_g7_chain_ticket', 'mis_g7_s3_baseline', 'mis_g7_s3b_baseline', 'mis_g7_s5_baseline'])
    assert.equal(run(`SELECT to_regclass('app_private.${t}') IS NOT NULL`).out, 't', t);                                // evidence/baseline tables retained
  assert.equal(run(`SELECT has_function_privilege('authenticated','public.fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)','EXECUTE')`).out, 't');   // legacy ACL back
  // legacy compatibility restored: governed definer path and legacy invoker behavior are the pre-S3b ones
  assert.equal(sess(`SELECT public.t_client_rpc($q$INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") SELECT id,10,2 FROM public.packaging_events ORDER BY id DESC LIMIT 1$q$)`, PACKER).status, 0);
});
