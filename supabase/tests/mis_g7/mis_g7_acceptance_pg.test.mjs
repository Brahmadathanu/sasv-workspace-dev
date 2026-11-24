// MIS G7 consolidated server acceptance (S2-S4b) on an ephemeral local PostgreSQL 16 cluster, production-shaped shim.
// Tests are SKIPPED with the label BLOCKED when PostgreSQL is unavailable -- never reported as PASS.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startPg, installBaseAndMigrations, seedShimFingerprintsSql, MIGRATIONS } from './pg_harness.mjs';

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

// ---------------------------- legacy DWL editor (rpc_update_daily_work_log_with_packaging + __core) ----------------------------
// Shim bodies are RECONSTRUCTIONS of the live behavior described by the independent review (live core sha256 df7290df...).
const WRAP = (wl, status, breakdown, type = 'Bottling', fgQty = 'NULL') => `SELECT public.rpc_update_daily_work_log_with_packaging(${wl}, '${status}', ${breakdown === null ? 'NULL' : `'${breakdown}'`}, '${type}', ${fgQty})`;
const fillWl = (b) => val(`SELECT id FROM public.daily_work_log WHERE batch_number='${b}' AND activity='Filling'`);
const fgWl = (b) => val(`SELECT id FROM public.daily_work_log WHERE batch_number='${b}' AND activity='FG bulk storage'`);
const chainLedger = (b) => Number(val(`SELECT coalesce(sum(qty_base),0) FROM public.fg_bulk_stock_ledger WHERE product_id=1 AND batch_number='${b}' AND source_table='event_skus'`));
const lines = (b) => val(`SELECT coalesce(string_agg(es.sku_id||':'||es."count", ',' ORDER BY es.sku_id),'-') FROM public.event_skus es JOIN public.packaging_events pe ON pe.id=es.packaging_event_id JOIN public.daily_work_log w ON w.id=pe.work_log_id WHERE w.batch_number='${b}'`);
const wlStatus = (id) => val(`SELECT status FROM public.daily_work_log WHERE id=${id}`);
const applyRef = () => assert.equal(pg.psql(DB, fs.readFileSync(path.join(here, '02_reference_migrated_core.sql'), 'utf8')).status, 0);
const coreSha = () => val(`SELECT encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') FROM pg_proc p WHERE p.proname='rpc_update_daily_work_log_with_packaging__core'`);
const accept = (sha, uid = SIGNOFF) => J(`SELECT public.mis_g7_record_core_migration_acceptance_v1('${sha}','owner review ticket G7-core-1')`, uid);
const setModeSql = (m) => assert.equal(q(`UPDATE app_private.mis_g7_enforcement SET mode='${m}'`).status, 0);

T('EDITOR ACLs and roles: wrapper callable by authenticated editors only (View-only denied), core and primitives closed', () => {
  const w = 'public.rpc_update_daily_work_log_with_packaging(bigint,text,text,text,numeric)', c = 'public.rpc_update_daily_work_log_with_packaging__core(bigint,text,text,text,numeric)';
  assert.equal(val(`SELECT prosecdef FROM pg_proc WHERE oid='${w}'::regprocedure`), 't'); assert.equal(val(`SELECT prosecdef FROM pg_proc WHERE oid='${c}'::regprocedure`), 't');
  for (const [role, fn, exp] of [['authenticated', w, 't'], ['anon', w, 'f'], ['public', w, 'f'], ['authenticated', c, 'f'], ['anon', c, 'f'], ['public', c, 'f'],
    ['authenticated', 'app_private.mis_g7_chain_replace_begin(bigint)', 'f'], ['authenticated', 'app_private.mis_g7_chain_replace_finish(bigint)', 'f'],
    ['anon', 'app_private.mis_g7_chain_replace_begin(bigint)', 'f'], ['authenticated', 'app_private.mis_g7_core_gate()', 'f']])
    assert.equal(val(`SELECT has_function_privilege('${role}','${fn}','EXECUTE')`), exp, `${role} ${fn}`);
  const b = bn('ED0'); mkSigned(b); const f = fillWl(b);
  for (const uid of [NOBODY, VIEWER, SIGNER]) assert.match(q(WRAP(f, 'Done', '10:2'), uid).err, /permission denied/, uid);   // VIEWER holds can_view only
  assert.match(anon(WRAP(f, 'Done', '10:2')).err, /permission denied/);
  assert.match(q(`SELECT public.rpc_update_daily_work_log_with_packaging__core(${f},'Done','10:2','Bottling',NULL)`, PACKER).err, /permission denied for function/);
  assert.match(q(`SELECT app_private.mis_g7_chain_replace_begin(${f})`, PACKER).err, /permission denied/);
  assert.match(q(`INSERT INTO app_private.mis_g7_chain_ticket(txid,work_log_id) VALUES (1,${f})`, PACKER).err, /permission denied/);
  assert.equal(lines(b), '-'); assert.equal(bal(b), 100);
});
T('EDITOR AUDIT mode (legacy core unchanged): delete/recreate keeps FG stock conserved, logs direct writes, rolls back atomically', () => {
  assert.equal(val(`SELECT mode FROM app_private.mis_g7_enforcement`), 'AUDIT');
  const b = bn('ED1'); mkSigned(b); const f = fillWl(b); const aud = () => Number(val(`SELECT count(*) FROM app_private.mis_g7_direct_pack_audit`));
  const a0 = aud();
  assert.equal(q(WRAP(f, 'Done', '10:20'), PACKER).status, 0); assert.equal(bal(b), 90); assert.equal(chainLedger(b), -10);   // create: 20 x 0.5 kg
  assert.equal(q(WRAP(f, 'Done', '10:10,11:4'), PACKER).status, 0); assert.equal(lines(b), '10:10,11:4');                          // recreate: old chain returned, new consumed (5 + 2 kg)
  assert.equal(bal(b), 93); assert.equal(chainLedger(b), -7);
  assert.equal(q(WRAP(f, 'Done', '11:60', 'Cartoning'), PACKER).status, 0); assert.equal(bal(b), 70);                              // retyped header, 30 kg
  assert.equal(q(WRAP(f, 'In Progress', null), PACKER).status, 0); assert.equal(lines(b), '-'); assert.equal(bal(b), 100);       // row stops being Done: whole chain deleted, stock returned
  assert.equal(val(`SELECT count(*) FROM public.packaging_events WHERE work_log_id=${f}`), '0'); assert.equal(chainLedger(b), 0);
  assert.ok(aud() >= a0 + 4, 'legacy editor writes are logged in AUDIT mode (production logging compatibility)');
  // insufficient stock: the legacy negative guard fires, the WHOLE edit rolls back (status, old lines, ledger)
  assert.equal(q(WRAP(f, 'Done', '10:10'), PACKER).status, 0); const before = bal(b);
  const bad = q(WRAP(f, 'Done', '10:1000'), PACKER); assert.match(bad.err, /would make stock negative/);
  assert.equal(lines(b), '10:10'); assert.equal(bal(b), before); assert.equal(wlStatus(f), 'Done');
  // FG source quantity delta through the governed editor is a ledger source correction and conserves per its own source
  assert.equal(q(WRAP(fgWl(b), 'Done', null, 'Bottling', 120), PACKER).status, 0); assert.equal(bal(b), before + 20);
  // stage-first: that edit drifted the signed FG source, so the new RPCs refuse (fail closed) until the stage is re-signed
  assert.equal(pack(b, [{ sku_id: 11, count: 2 }]).code, 'STAGE_SOURCE_CHANGED');
});
T('EDITOR AUDIT hazard documented: legacy delete of a line that was never depleted manufactures stock (what S5 conservation prevents)', () => {
  const b = bn('ED2'); mkSigned(b); const f = fillWl(b);
  q(`ALTER TABLE public.event_skus DISABLE TRIGGER trg_fg_ledger_from_es`);
  try { q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${evId(b)},10,20)`); } finally { q(`ALTER TABLE public.event_skus ENABLE TRIGGER trg_fg_ledger_from_es`); }
  assert.equal(bal(b), 100);                                                                                   // historical line: no depletion
  assert.equal(q(WRAP(f, 'In Progress', null), PACKER).status, 0);
  assert.equal(bal(b), 110);                                                                                   // legacy behavior: +10 kg that was never consumed
});
T('ENFORCE FAILS CLOSED while the legacy editor core is unmigrated: refusal code, mode unchanged, readiness shows the blocker', () => {
  assert.equal(setMode('ENFORCE').code, 'LEGACY_DWL_EDITOR_NOT_MIGRATED'); assert.equal(val(`SELECT mode FROM app_private.mis_g7_enforcement`), 'AUDIT');
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN).core_gate, 'LEGACY_DWL_EDITOR_NOT_MIGRATED');
  assert.equal(accept(coreSha()).code, 'LEGACY_DWL_EDITOR_NOT_MIGRATED');                                       // cannot sign off an unmigrated core
  assert.equal(val(`SELECT count(*) FROM app_private.mis_g7_core_migration_acceptance`), '0');
  // why the gate exists: if the owner forced ENFORCE directly, the unmigrated editor is refused and rolls back whole
  const b = bn('ED3'); mkSigned(b); const f = fillWl(b); setModeSql('ENFORCE');
  try { const r = q(WRAP(f, 'Done', '10:4'), PACKER); assert.match(r.err, /MIS_G7_DIRECT_PACKING_DENIED/); assert.equal(lines(b), '-'); assert.equal(bal(b), 100); }
  finally { setModeSql('AUDIT'); }
  // unknown core (function missing) also fails closed
  q(`ALTER FUNCTION public.rpc_update_daily_work_log_with_packaging__core(bigint,text,text,text,numeric) RENAME TO core_tmp`);
  try { assert.equal(setMode('ENFORCE').code, 'LEGACY_DWL_EDITOR_NOT_FOUND'); }
  finally { q(`ALTER FUNCTION public.core_tmp(bigint,text,text,text,numeric) RENAME TO rpc_update_daily_work_log_with_packaging__core`); }
});
T('CORE MIGRATION acceptance: needs primitives in the core AND owner sign-off bound to its exact SHA; any later core change re-blocks', () => {
  applyRef();                                                                                                    // reviewed core now calls begin/finish
  assert.equal(setMode('ENFORCE').code, 'CORE_MIGRATION_NOT_ACCEPTED');
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN).core_gate, 'CORE_MIGRATION_NOT_ACCEPTED');
  const sha = coreSha();
  for (const uid of [NOBODY, SIGNER, PACKER, EXCESS, ADMIN]) assert.match(q(`SELECT public.mis_g7_record_core_migration_acceptance_v1('${sha}','x')`, uid).err, /permission denied/);
  assert.match(anon(`SELECT public.mis_g7_record_core_migration_acceptance_v1('${sha}','x')`).err, /permission denied/);
  assert.equal(accept('not-a-sha').code, 'INVALID_INPUT'); assert.equal(accept(sha, SIGNOFF).ok, true);        // owner sign-off bound to this exact SHA
  assert.equal(accept(sha).code, 'ALREADY_ACCEPTED');
  assert.equal(accept('0'.repeat(64)).code, 'CORE_SHA_MISMATCH');
  assert.equal(J(`SELECT public.mis_g7_record_core_migration_acceptance_v1('${sha}','  ')`, SIGNOFF).code, 'INVALID_INPUT');
  assert.match(q(`UPDATE app_private.mis_g7_core_migration_acceptance SET evidence_ref='x'`).err, /APPEND_ONLY/);
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN).core_gate, 'OK');
  // any change of the core (even a comment) invalidates the sign-off
  q(`COMMENT ON FUNCTION public.rpc_update_daily_work_log_with_packaging__core(bigint,text,text,text,numeric) IS 'x'`);   // metadata only: identity unchanged
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN).core_gate, 'OK');
  const tampered = fs.readFileSync(path.join(here, '02_reference_migrated_core.sql'), 'utf8').replace("v_old numeric;", "v_old numeric; v_x int := 0;");
  assert.equal(pg.psql(DB, tampered).status, 0);
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN).core_gate, 'CORE_MIGRATION_NOT_ACCEPTED');
  assert.equal(setMode('ENFORCE').code, 'CORE_MIGRATION_NOT_ACCEPTED');
  applyRef();                                                                                                    // back to the signed-off body (same SHA)
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN).core_gate, 'OK');
});
T('MIGRATED editor under ENFORCE: delete/recreate workflow works with stage authorization and exact FG stock conservation', () => {
  assert.equal(setMode('ENFORCE', 'migrated editor accepted').ok, true);
  try {
    const b = bn('ED4'); mkSigned(b); const f = fillWl(b);
    assert.equal(q(WRAP(f, 'Done', '10:20'), PACKER).status, 0); assert.equal(bal(b), 90); assert.equal(chainLedger(b), -10);
    assert.equal(q(WRAP(f, 'Done', '10:10,11:4'), PACKER).status, 0); assert.equal(bal(b), 93); assert.equal(chainLedger(b), -7);          // add/remove/change lines
    assert.equal(q(WRAP(f, 'Done', '11:60', 'Cartoning'), PACKER).status, 0); assert.equal(bal(b), 70); assert.equal(chainLedger(b), -30);   // retype + replace
    assert.equal(q(WRAP(f, 'In Progress', null), PACKER).status, 0); assert.equal(bal(b), 100); assert.equal(chainLedger(b), 0);            // chain removed
    assert.equal(q(WRAP(f, 'Done', '10:10'), PACKER).status, 0); const keep = bal(b);
    // direct client writes remain denied under ENFORCE (the ticket is private, per transaction and per work log)
    assert.match(q(`DELETE FROM public.event_skus WHERE packaging_event_id=${evId(b)}`, PACKER).err, /MIS_G7_DIRECT_PACKING_DENIED/);
    // insufficient stock: legacy guard raises; everything (including the chain ticket) rolls back
    assert.match(q(WRAP(f, 'Done', '10:1000'), PACKER).err, /would make stock negative/); assert.equal(lines(b), '10:10'); assert.equal(bal(b), keep);
    assert.equal(val(`SELECT count(*) FROM app_private.mis_g7_chain_ticket WHERE work_log_id=${f} AND finished_at IS NULL`), '0');
    // FG row edit without chain: no stage requirement at edit time; the new RPCs then refuse on drift (fail closed)
    assert.equal(q(WRAP(fgWl(b), 'Done', null, 'Bottling', 105), PACKER).status, 0); assert.equal(bal(b), keep + 5);
    assert.equal(pack(b, [{ sku_id: 11, count: 2 }]).code, 'STAGE_SOURCE_CHANGED');
    // non-bulk event type: chain replace needs no stage and moves no stock
    const nb = bn('ED4n'); mkSigned(nb); assert.equal(q(WRAP(fillWl(nb), 'Done', '10:7', 'Transfer to FG store'), PACKER).status, 0); assert.equal(bal(nb), 100);
    // non-packaging work log (no chain, no sku_breakdown) is unaffected and never needs a stage
    const od = bn('ED4o'); val(`SELECT public.t_mkbatch('${od}', 50)`); assert.equal(q(WRAP(fillWl(od), 'In Progress', null), PACKER).status, 0);
  } finally { setMode('AUDIT', 'back to audit'); }
});
T('MIGRATED editor under ENFORCE: unsigned stage, drifted stage and historical no-depletion lines are refused atomically (no stock manufactured)', () => {
  // historical fixture first: under ENFORCE even a superuser session cannot insert bulk lines directly
  const h = bn('ED5h'); mkSigned(h); const hf = fillWl(h);
  q(`ALTER TABLE public.event_skus DISABLE TRIGGER trg_fg_ledger_from_es`);
  try { assert.equal(q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${evId(h)},10,20)`).status, 0); } finally { q(`ALTER TABLE public.event_skus ENABLE TRIGGER trg_fg_ledger_from_es`); }
  assert.equal(lines(h), '10:20');
  assert.equal(setMode('ENFORCE', 'migrated editor accepted').ok, true);
  try {
    // unsigned (historical-style) batch
    const u = bn('ED5u'); val(`SELECT public.t_mkbatch('${u}', 100)`); const uf = fillWl(u);
    assert.match(q(WRAP(uf, 'Done', '10:10'), PACKER).err, /MIS_G7_CHAIN_STAGE_NOT_SIGNED/); assert.equal(lines(u), '-'); assert.equal(bal(u), 100); assert.equal(wlStatus(uf), 'Done');
    // drifted stage
    const d = bn('ED5d'); mkSigned(d); q(`UPDATE public.daily_work_log SET storage_qty=101 WHERE id=${fgWl(d)}`);
    assert.match(q(WRAP(fillWl(d), 'Done', '10:10'), PACKER).err, /MIS_G7_CHAIN_STAGE_SOURCE_CHANGED/); assert.equal(lines(d), '-'); assert.equal(bal(d), 100);
    // historical line without depletion: removing/replacing it would return stock that was never consumed
    const r = q(WRAP(hf, 'In Progress', null), PACKER); assert.match(r.err, /MIS_G7_CHAIN_CONSERVATION_MISMATCH/);
    assert.equal(lines(h), '10:20'); assert.equal(bal(h), 100); assert.equal(wlStatus(hf), 'Done');
    assert.match(q(WRAP(hf, 'Done', '10:20'), PACKER).err, /MIS_G7_CHAIN_CONSERVATION_MISMATCH/); assert.equal(bal(h), 100);
    // tampered ledger for a normal chain
    const t = bn('ED5t'); mkSigned(t); const tf = fillWl(t); assert.equal(q(WRAP(tf, 'Done', '10:10'), PACKER).status, 0);
    q(`UPDATE public.fg_bulk_stock_ledger SET qty=-4, qty_base=-4 WHERE source_table='event_skus' AND batch_number='${t}'`);
    assert.match(q(WRAP(tf, 'Done', '10:4'), PACKER).err, /MIS_G7_CHAIN_CONSERVATION_MISMATCH/); assert.equal(lines(t), '10:10');
    // wrapper permissions still apply under ENFORCE
    assert.match(q(WRAP(tf, 'Done', '10:4'), VIEWER).err, /permission denied/);
  } finally { setMode('AUDIT', 'back to audit'); }
});
T('MIGRATED editor: a core that skips finish cannot commit; tickets are scoped to one work log and one transaction; no client can issue a ticket', () => {
  const b = bn('ED6'); mkSigned(b); const f = fillWl(b);
  // a "migrated" core variant that begins but never finishes
  const noFinish = fs.readFileSync(path.join(here, '02_reference_migrated_core.sql'), 'utf8').replace("  PERFORM app_private.mis_g7_chain_replace_finish(p_work_log_id);\n", "");
  assert.equal(pg.psql(DB, noFinish).status, 0);
  try {
    for (const m of ['AUDIT', 'ENFORCE']) {
      setModeSql(m);
      try { const r = q(WRAP(f, 'Done', '10:4'), PACKER); assert.match(r.err, /MIS_G7_CHAIN_REPLACE_NOT_FINISHED/, m); }
      finally { setModeSql('AUDIT'); }
      assert.equal(lines(b), '-'); assert.equal(bal(b), 100); assert.equal(wlStatus(f), 'Done');                  // whole edit rolled back at commit
    }
  } finally { applyRef(); }
  // scope probe: a ticket for one work log must not authorize writes on another work log's chain
  const a2 = bn('ED6a'), b2 = bn('ED6b'); mkSigned(a2); mkSigned(b2); q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${evId(b2)},10,2)`);
  q(`CREATE OR REPLACE FUNCTION public.t_scope_probe(p_a bigint, p_evb bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
     BEGIN PERFORM app_private.mis_g7_chain_replace_begin(p_a); DELETE FROM public.event_skus WHERE packaging_event_id = p_evb;
           PERFORM app_private.mis_g7_chain_replace_finish(p_a); END $$`);
  setModeSql('ENFORCE');
  try { assert.match(q(`SELECT public.t_scope_probe(${fillWl(a2)}, ${evId(b2)})`).err, /MIS_G7_DIRECT_PACKING_DENIED/); }
  finally { setModeSql('AUDIT'); q(`DROP FUNCTION public.t_scope_probe(bigint,bigint)`); }
  assert.equal(lines(b2), '10:2');
});
T('MIGRATED editor concurrency: chain replacement serializes with a pack on the same batch; conservation holds', async () => {
  const b = bn('ED7'); mkSigned(b, 10); const f = fillWl(b);
  q(`INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status) VALUES ('P1','${b}','Filling','2026-11-12','Done'); INSERT INTO public.packaging_events(work_log_id,event_type) SELECT max(id),'Bottling' FROM public.daily_work_log`);
  const e = val(`SELECT max(pe.id) FROM public.packaging_events pe JOIN public.daily_work_log w ON w.id=pe.work_log_id WHERE w.batch_number='${b}'`);   // second header, untouched by the editor
  assert.equal(q(WRAP(f, 'Done', '10:10'), PACKER).status, 0);                                                    // 5 kg used, 5 left
  const A = pg.psqlAsync(DB, hold(WRAP(f, 'Done', '10:16'), 1.5), { uid: PACKER });                               // grow to 8 kg (+3)
  await delay(400);
  const B = pg.psqlAsync(DB, `SELECT public.mis_pack_fg_bulk_v1('${randomUUID()}', ${e}, '[{"sku_id":11,"count":8}]'::jsonb)`, { uid: PACKER });   // needs 4 kg, only 2 left after A
  const [a, bb] = await Promise.all([A, B]);
  assert.equal(a.status, 0, a.err); const rb = jl(bb.out);
  assert.equal(rb.code, 'INSUFFICIENT_BULK'); assert.equal(Number(rb.available_base), 2); assert.ok(bb.ms >= 1000, `pack waited ${bb.ms}`);
  assert.equal(bal(b), 2); assert.equal(chainLedger(b), -8);
});
T('S5 ROLLBACK: refuses while the core calls the primitives; restores replaced functions exactly; keeps tickets/acceptances/signed history', () => {
  const run = freshChain('accs5');
  for (const f of MIGRATIONS.slice(0, 3)) assert.equal(run(migText(f)).status, 0, f);
  assert.equal(run(seedShimFingerprintsSql()).status, 0);
  for (const f of MIGRATIONS.slice(3)) assert.equal(run(migText(f)).status, 0, f);
  const fns = ['app_private.mis_g7_gate_check(text,text,bigint,bigint,boolean)', 'public.mis_g7_set_enforcement_v1(text,text)', 'public.mis_g7_enforcement_readiness_v1(integer)'];
  const sha = (f) => run(`SELECT encode(sha256(convert_to(pg_get_functiondef('${f}'::regprocedure),'UTF8')),'hex')`).out;
  const after = fns.map(sha);
  assert.deepEqual(run(`SELECT def_sha FROM app_private.mis_g7_s5_baseline ORDER BY obj`).out.split('\n').length, 3);   // baseline holds the 3 pre-S5 definitions
  const rb = fs.readFileSync(path.join(docs, 'ROLLBACK_NOT_A_MIGRATION.sql'), 'utf8');
  const s5 = rb.slice(rb.indexOf('-- ==== S5 ROLLBACK ===='));
  run(fs.readFileSync(path.join(here, '02_reference_migrated_core.sql'), 'utf8'));
  const refused = run(s5); assert.notEqual(refused.status, 0); assert.match(refused.err, /live core still calls the S5 primitives/);
  assert.equal(run(`SELECT to_regprocedure('app_private.mis_g7_chain_replace_begin(bigint)') IS NOT NULL`).out, 't');   // nothing was applied
  // revert the core to the legacy body (the shim's original), leave an ENFORCE state and a recorded ticket behind
  const shim = fs.readFileSync(path.join(here, '00_base_schema_shim.sql'), 'utf8');
  const legacy = shim.slice(shim.indexOf('CREATE FUNCTION public.rpc_update_daily_work_log_with_packaging__core'), shim.indexOf('CREATE FUNCTION public.rpc_update_daily_work_log_with_packaging(')).replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');
  assert.equal(run(legacy).status, 0);
  run(`UPDATE app_private.mis_g7_enforcement SET mode='ENFORCE'`);
  const ok = run(s5); assert.equal(ok.status, 0, ok.err);
  assert.equal(run(`SELECT mode FROM app_private.mis_g7_enforcement`).out, 'AUDIT');
  assert.equal(run(`SELECT count(*) FROM app_private.mis_g7_enforcement_log WHERE reason LIKE 'S5 rollback%'`).out, '1');
  for (const f of ['app_private.mis_g7_chain_replace_begin(bigint)', 'app_private.mis_g7_chain_replace_finish(bigint)', 'app_private.mis_g7_core_gate()', 'public.mis_g7_record_core_migration_acceptance_v1(text,text)'])
    assert.equal(run(`SELECT to_regprocedure('${f}') IS NULL`).out, 't', f);
  assert.equal(run(`SELECT count(*) FROM pg_trigger WHERE tgname='mis_g7_chain_ticket_must_finish'`).out, '0');
  assert.notDeepEqual(fns.map(sha), after);                                                                      // definitions changed back...
  assert.equal(run(`SELECT def_sha = encode(sha256(convert_to(pg_get_functiondef(obj::regprocedure),'UTF8')),'hex') FROM app_private.mis_g7_s5_baseline ORDER BY obj`).out.split('\n').every((x) => x === 't'), true);   // ...to EXACTLY the baseline
  assert.equal(run(`SELECT to_regclass('app_private.mis_g7_chain_ticket') IS NOT NULL AND to_regclass('app_private.mis_g7_core_migration_acceptance') IS NOT NULL`).out, 't');
  assert.equal(run(`SELECT pg_get_function_result('public.mis_g7_enforcement_readiness_v1(integer)'::regprocedure)`).out, 'jsonb');
});

// ---------------------------- ENFORCE mode end-to-end ----------------------------
T('ENFORCE: admin switch is logged; legacy direct line writes denied; ticketed RPCs still work; AUDIT restores legacy', () => {
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
    dwl_editor: `SELECT public.rpc_update_daily_work_log_with_packaging(999999,'Done',NULL,'Bottling',NULL)`,
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

T('CORE read-only pre-migration check executes against the shim (creates nothing); live SHA pin never equals the reconstruction', () => {
  const sqlFile = fs.readFileSync(path.join(docs, 'CORE_PREINSTALL_LIVE_CHECK_READONLY.sql'), 'utf8');
  const r = q(sqlFile); assert.equal(r.status, 0, r.err);
  const rows = Object.fromEntries(r.out.split('\n').filter(Boolean).map((l) => { const [a, b] = l.split('|'); return [a, b]; }));
  assert.equal(Object.keys(rows).length, 6);
  assert.equal(rows['core sha256 matches reviewed value'], 'f');                    // shim body is a reconstruction, by design
  assert.equal(rows['exactly one core overload'], 't'); assert.equal(rows['core is SECURITY DEFINER and not executable by authenticated/anon'], 't');
  assert.equal(rows['wrapper is SECURITY DEFINER, authenticated-callable, requires module:edit-log-entry'], 't');
  assert.equal(rows['core deletes event_skus and packaging_events (delete/recreate workflow present)'], 't');
  assert.ok(sqlFile.includes('df7290df4a17e4af9f0aed43cf564007a35b957d8899b98869d7d35531296aec'));
  const man = JSON.parse(fs.readFileSync(path.join(docs, 'LIVE_BASELINE_MANIFEST.json'), 'utf8'));
  assert.equal(man.legacy_dwl_editor.core_sha256, 'df7290df4a17e4af9f0aed43cf564007a35b957d8899b98869d7d35531296aec');
});

// ---------------------------- contract / baseline consistency ----------------------------
T('CONTRACT client_rpc_contract.json matches catalog signatures and refusal codes bidirectionally', () => {
  const c = JSON.parse(fs.readFileSync(path.join(docs, 'client_rpc_contract.json'), 'utf8'));
  const resolverSrc = val(`SELECT replace(prosrc, E'\\n', ' ') FROM pg_proc WHERE oid='app_private.mis_resolve_batch_stage(integer,text,integer,bigint)'::regprocedure`);
  for (const r of c.rpcs) {
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

// ---------------------------- migration chain + rollback ----------------------------
const freshChain = (name, upTo = MIGRATIONS.length) => {
  pg.createDb(name);
  assert.equal(pg.psql(name, fs.readFileSync(path.join(here, '00_base_schema_shim.sql'), 'utf8')).status, 0);
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
T('ROLLBACK full reverse chain (S4B -> S3B -> S2-S4) restores the pre-S3b catalog exactly and keeps signed history', () => {
  const run = freshChain('accrb');
  for (const f of MIGRATIONS.slice(0, 3)) assert.equal(run(migText(f)).status, 0, f);
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
  const iS3b = rb.indexOf('-- ==== S3B ROLLBACK ===='); const iS4b = rb.indexOf('-- ==== S4B ROLLBACK ===='); const iS5 = rb.indexOf('-- ==== S5 ROLLBACK ====');
  assert.ok(iS3b > 0 && iS4b > iS3b && iS5 > iS4b);
  const secTop = rb.slice(0, iS3b), secS3b = rb.slice(iS3b, iS4b), secS4b = rb.slice(iS4b, iS5), secS5 = rb.slice(iS5);
  let r = run(secS5); assert.equal(r.status, 0, r.err);
  assert.equal(run(`SELECT mode FROM app_private.mis_g7_enforcement`).out, 'AUDIT');
  r = run(secS4b); assert.equal(r.status, 0, r.err);
  assert.equal(run(`SELECT to_regprocedure('public.mis_correct_pack_line_v1(uuid,bigint,integer,text,jsonb)') IS NULL`).out, 't');
  assert.equal(run(`SELECT count(*) FROM app_private.mis_g7_enforcement_log WHERE actor='00000000-0000-0000-0000-000000000000'`).out, '1');   // only the S5 rollback needed to log (already AUDIT for S4B)
  r = run(secS3b); assert.equal(r.status, 0, r.err);
  assert.equal(snap(), before, 'S3b rollback must restore chain definitions/ACLs exactly');
  r = run(secTop); assert.equal(r.status, 0, r.err);
  assert.equal(run(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'mis\\_%'`).out, '0');
  assert.equal(run(`SELECT count(*) FROM pg_trigger WHERE tgname LIKE '00\\_mis\\_g7\\_%'`).out, '0');
  assert.equal(run(`SELECT count(*) FROM app_private.mis_batch_stage_event`).out, '1');                                // signed history retained
  assert.equal(run(`SELECT has_function_privilege('authenticated','public.fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)','EXECUTE')`).out, 't');   // legacy ACL back
  // legacy compatibility restored: governed definer path and legacy invoker behavior are the pre-S3b ones
  assert.equal(sess(`SELECT public.t_client_rpc($q$INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") SELECT id,10,2 FROM public.packaging_events ORDER BY id DESC LIMIT 1$q$)`, PACKER).status, 0);
});
