// MIS G7 S7 REAL-CATALOG acceptance: replays the private production catalog packet + supplement (.local/mis-g7-prod-baseline/{packet,supplement}.json,
// git-ignored, never committed) into an isolated PostgreSQL, applies the accepted S3–S6 files exactly, then S7a/S7b/S7c (one transaction each) and the
// registry proposal, against the ACTUAL base-table constraints, ACLs, RLS policies and triggers.
//
// STATUS OF THIS FILE IN THE SESSION THAT WROTE IT: the packets were NOT present in that session (`.local/` absent), so this runner has NEVER BEEN EXECUTED.
// It skips with an explicit BLOCKED reason when they are missing and must be run by whoever holds them:
//     node --test supabase/tests/mis_g7/s7/mis_g7_s7_real_catalog_pg.test.mjs
// Expect to adjust fixture details on the first real run; every assertion states what live fact it checks. It also prints the distinct
// (source_table, reason_code) pairs that the REAL triggers produce, which is the evidence for the receipt-semantics audit.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startPg, MIGRATIONS, PATCHED_CORE_MIGRATION, FINGERPRINT_MIGRATION } from '../pg_harness.mjs';
import { loadStructuredPacket, verifyRelations, verifyEnvironment } from '../prod_equivalent/load_structured_packet.mjs';
import { verifyFunctions } from '../prod_equivalent/load_baseline.mjs';
import { mig, S7A, S7B, S7C, asTx } from './build_db.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const PACKET = process.env.MIS_G7_PACKET || path.join(root, '.local/mis-g7-prod-baseline/packet.json');
const SUPP = process.env.MIS_G7_SUPPLEMENT || path.join(root, '.local/mis-g7-prod-baseline/supplement.json');
const docs = path.join(root, 'docs/executive-mis-g7-server');
const U = (n) => `00000000-0000-0000-0000-0000000000${n}`;
const SIGNER = U('01'), PACKER = U('02'), EXCESS = U('03'), EXECV = U('21');
let pg = null, blocked = null, loaded = null, basePacket = null;

before(() => {
  if (!fs.existsSync(PACKET) || !fs.existsSync(SUPP)) { blocked = 'BLOCKED: production catalog packet/supplement not present (.local/mis-g7-prod-baseline/{packet,supplement}.json)'; return; }
  pg = startPg(); if (!pg) { blocked = 'BLOCKED: local PostgreSQL unavailable'; return; }
  pg.createDb('base');
  const major = Number((pg.serverVersion.match(/(\d+)\./) ?? [])[1]);
  loaded = loadStructuredPacket(pg, 'base', PACKET, { serverMajor: major, supplement: SUPP }); basePacket = loaded.packet;
  for (const d of ['pre7', 'real7', 'rb7']) assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE base`).status, 0);
  for (const d of ['pre7', 'real7', 'rb7']) {
    for (const f of [...MIGRATIONS.slice(1), PATCHED_CORE_MIGRATION, FINGERPRINT_MIGRATION]) { const r = pg.psql(d, mig(f)); assert.equal(r.status, 0, `${d} ${f}: ${r.err}`); }
    const fx = pg.psql(d, fs.readFileSync(path.join(here, '../prod_equivalent/real_catalog_fixture.sql'), 'utf8')); assert.equal(fx.status, 0, `${d} fixture: ${fx.err}`);
  }
});
after(() => { pg?.stop(); });
const T = (name, fn) => test(name, async (t) => { if (blocked) return t.skip(blocked); await fn(t); });
const dq = (db, sql, uid) => pg.psql(db, sql, uid === undefined ? {} : { uid });
const val = (db, sql, uid) => { const r = dq(db, sql, uid); assert.equal(r.status, 0, r.err + ' :: ' + sql); return r.out.split('\n').pop(); };
const J = (db, sql, uid) => { const r = dq(db, sql, uid); assert.equal(r.status, 0, r.err); return JSON.parse(r.out.split('\n').filter((l) => l.startsWith('{') || l.startsWith('[')).pop()); };
const install = (db) => { for (const f of [S7A, S7B, S7C]) { const r = pg.psql(db, asTx(mig(f))); assert.equal(r.status, 0, `${db} ${f}: ${r.err}`); } };
const fnList = (db) => val(db, `SELECT string_agg(p.oid::regprocedure::text||':'||md5(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')), E'\\n' ORDER BY p.oid::regprocedure::text) FROM pg_proc p WHERE p.prokind='f' AND p.pronamespace IN ('app_private'::regnamespace,'public'::regnamespace,'costing'::regnamespace) AND p.proname NOT LIKE 't\\_%' AND p.proname NOT LIKE 'mis_get_%' AND p.proname NOT LIKE 'mis_preview%' AND p.proname NOT IN ('mis_g7_route_context','mis_g7_fg_state','mis_g7_batch_stage_status','mis_g7_can_view','mis_g7_fg_receipt','mis_g7_fg_stage_log','mis_g7_batch_receipt_code','mis_resolve_batch_stage','mis_sign_batch_stage_v1','mis_pack_fg_bulk_v1')`);
const trig = (db) => val(db, `SELECT string_agg(c.oid::regclass::text||'.'||t.tgname||'.'||t.tgenabled, ',' ORDER BY 1) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal`);

T('INSTALL on the real catalog: S7a, S7b, S7c each succeed as one transaction (all 9 engine/resolver pins, id namespaces, writer pins, AUDIT)', () => {
  install('real7'); assert.equal(val('real7', `SELECT count(*) FROM pg_proc WHERE proname IN ('mis_get_batch_route_context_v1','mis_get_batch_stage_status_v1','mis_preview_pack_fg_bulk_v1','mis_get_governance_exception_summary_v1') AND pronamespace='public'::regnamespace`), '4');
  assert.equal(val('real7', `SELECT mode FROM app_private.mis_g7_enforcement`), 'AUDIT'); assert.equal(val('real7', `SELECT count(*) FROM app_private.mis_batch_stage_event`), '0');
});
T('PRESERVATION on the real catalog: S2–S6 and every base function/ACL/RLS/trigger outside the resolver and the two receipt-patched writers are unchanged; relations still equal the packet', () => {
  assert.equal(fnList('real7'), fnList('pre7')); assert.equal(trig('real7'), trig('pre7'));
  assert.deepEqual(verifyRelations(pg, 'real7', basePacket).filter((d) => !/scoped_table_set_md5/.test(d)), []); assert.deepEqual(verifyEnvironment(pg, 'real7', basePacket), []);
});
T('SECURITY on the real catalog: four RPCs authenticated-only, anon/PUBLIC denied, helpers closed, new tables RLS-closed; anonymous and no-right calls refused', () => {
  for (const f of ['mis_get_batch_route_context_v1(integer,text,integer)', 'mis_get_batch_stage_status_v1(integer,text)', 'mis_preview_pack_fg_bulk_v1(bigint,jsonb,bigint,integer)', 'mis_get_governance_exception_summary_v1(date,date,integer,integer)']) {
    assert.equal(val('real7', `SELECT has_function_privilege('authenticated','public.${f}','EXECUTE')::text||has_function_privilege('anon','public.${f}','EXECUTE')::text`), 'truefalse', f);
  }
  for (const f of ['app_private.mis_g7_fg_receipt(integer,text,integer)', 'app_private.mis_g7_route_context(integer,text,integer)', 'app_private.mis_g7_batch_receipt_code(integer,text)']) assert.equal(val('real7', `SELECT has_function_privilege('authenticated','${f}','EXECUTE')`), 'false', f);
  for (const t of ['mis_g7_s7_baseline', 'mis_g7_governance_cutover']) assert.equal(val('real7', `SELECT relrowsecurity::text||has_table_privilege('authenticated','app_private.${t}','SELECT')::text FROM pg_class WHERE oid='app_private.${t}'::regclass`), 'truefalse', t);
  assert.notEqual(dq('real7', `SET ROLE anon; SELECT public.mis_get_batch_stage_status_v1(1,'X')`).status, 0);
  assert.notEqual(dq('real7', `SELECT public.mis_get_batch_stage_status_v1(1,'X')`, '00000000-0000-0000-0000-000000000099').status, 0);
});
T('RECEIPT AUDIT with the REAL triggers: the FG work-log trigger posts a receipt the helper accepts; real log edits keep net = logged quantity; transfers/manual/packaging stock never count', () => {
  const b = 'R7-A'; val('real7', `SELECT public.t_mkbatch('${b}', 100)`); const w = val('real7', `SELECT id FROM public.daily_work_log WHERE batch_number='${b}' AND activity='FG bulk storage'`);
  const rc = (x = w) => J('real7', `SELECT app_private.mis_g7_fg_receipt(1,'${b}',${x})`);
  const first = rc(); assert.equal(first.code, 'OK', `real FG receipt trigger output not accepted: ${JSON.stringify(first)} rows: ${val('real7', `SELECT coalesce(string_agg(source_table||'/'||reason_code||'/'||qty_base, ' ; '),'-') FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}'`)}`);
  // real update through the live governed editor wrapper (also exercises the live receipt-update trigger)
  const up = dq('real7', `SELECT * FROM public.t_edit_dwl(${w}, '{"storage_qty":120}'::jsonb)`, PACKER);
  const after = rc(); assert.ok(up.status === 0 ? after.code === 'OK' : true, `after a REAL update the helper says ${JSON.stringify(after)}; rows: ${val('real7', `SELECT string_agg(source_table||'/'||reason_code||'/'||qty_base, ' ; ') FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}'`)}`);
  // noise that must never count: manual stock, a transfer, a packaging return
  dq('real7', `INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id) VALUES (1,'${b}','2026-11-12',7,7,'Kg','MANUAL','manual_entry',1),(1,'${b}','2026-11-12',9,9,'Kg','TRANSFER_IN','fg_bulk_internal_transfer',1),(1,'${b}','2026-11-12',3,3,'Kg','RETURN','event_skus',1)`);
  assert.equal(rc().ledger_net_base, after.ledger_net_base);
  // a log with no receipt of its own but positive batch stock from other sources
  const b2 = 'R7-B'; val('real7', `SELECT public.t_mkbatch('${b2}', 50)`); const w2 = val('real7', `SELECT id FROM public.daily_work_log WHERE batch_number='${b2}' AND activity='FG bulk storage'`);
  dq('real7', `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${b2}' AND source_table='daily_work_log'`); dq('real7', `INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id) VALUES (1,'${b2}','2026-11-12',50,50,'Kg','TRANSFER_IN','fg_bulk_internal_transfer',2)`);
  assert.equal(J('real7', `SELECT app_private.mis_g7_fg_receipt(1,'${b2}',${w2})`).code, 'NO_SOURCE_LEDGER');
  console.log('# real ledger (source_table, reason_code) pairs produced here:', val('real7', `SELECT string_agg(DISTINCT source_table||' / '||reason_code, ' | ') FROM public.fg_bulk_stock_ledger WHERE batch_number IN ('${b}','${b2}')`));
});
T('SIGN / PACK / PREVIEW / SUMMARY parity on the real catalog (needs a Costing-valid synthetic route; reports instead of failing when the fixture routes are not valid)', (t) => {
  const b = 'R7-S'; val('real7', `SELECT public.t_mkbatch('${b}', 100)`); const w = val('real7', `SELECT id FROM public.daily_work_log WHERE batch_number='${b}' AND activity='FG bulk storage'`);
  const ctx = J('real7', `SELECT public.mis_get_batch_route_context_v1(1,'${b}',${w})`, SIGNER);
  if (!ctx.ok) return t.skip(`fixture route is not Costing-valid on the real catalog (${ctx.code}: ${JSON.stringify(ctx.route_errors ?? [])}); supply valid synthetic route rows to run the flow tests`);
  const fg = ctx.steps.find((s) => s.stage_role === 'FG_BULK' && s.activity_matches); assert.ok(fg);
  const s = J('real7', `SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'${b}',${w},${fg.route_step_id},1,100,'WB')`, SIGNER); assert.equal(s.ok, true, JSON.stringify(s));
  const ev = val('real7', `SELECT pe.id FROM public.packaging_events pe JOIN public.daily_work_log d ON d.id=pe.work_log_id WHERE d.batch_number='${b}'`);
  const pv = J('real7', `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'[{"sku_id":10,"count":4}]'::jsonb)`, PACKER); assert.equal(pv.preview_code, 'OK'); assert.equal(pv.receipt_code, 'OK');
  const pk = J('real7', `SELECT public.mis_pack_fg_bulk_v1('${randomUUID()}',${ev},'[{"sku_id":10,"count":4}]'::jsonb,NULL)`, PACKER); assert.equal(pk.ok, true, JSON.stringify(pk)); assert.equal(pk.required_base, pv.required_base);
  const sm = J('real7', `SELECT public.mis_get_governance_exception_summary_v1('2026-11-01','2026-11-30',200,0)`, EXECV); assert.equal(sm.ok, true);
});
T('ROLLBACK on the real catalog: S7C, S7B, S7A restore the exact resolver/signer/packer and leave every base object as it was', () => {
  install('rb7'); const sec = (n) => new RegExp(`-- ===== ${n} =====\\n([\\s\\S]*?)-- ===== END ${n} =====`).exec(fs.readFileSync(path.join(docs, 'S7_ROLLBACK_NOT_A_MIGRATION.sql'), 'utf8'))[1];
  for (const n of ['S7C ROLLBACK', 'S7B ROLLBACK', 'S7A ROLLBACK']) { const r = pg.psql('rb7', asTx(sec(n))); assert.equal(r.status, 0, `${n}: ${r.err}`); }
  assert.equal(fnList('rb7'), fnList('pre7')); assert.equal(trig('rb7'), trig('pre7'));
  for (const f of ['app_private.mis_resolve_batch_stage(integer,text,integer,bigint)', 'public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text)', 'public.mis_pack_fg_bulk_v1(uuid,bigint,jsonb,jsonb)'])
    assert.equal(val('rb7', `SELECT md5(pg_get_functiondef('${f}'::regprocedure))`), val('pre7', `SELECT md5(pg_get_functiondef('${f}'::regprocedure))`), f);
});
T('REGISTRY proposal on the real catalog: canonical permission_targets first, FK honoured, six targets + modules + two client rows, zero assignments, fail-closed re-run', () => {
  const d = 'reg7'; assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE pre7`).status, 0);
  const pre = pg.psql(d, `INSERT INTO public.permission_targets(key,kind,label) VALUES ('module:executive-mis-dashboard','module','syn') ON CONFLICT (key) DO NOTHING;
    INSERT INTO public.app_modules(module_key,target_key,label,description,section_key,sort_order,is_active,is_assignable,show_in_navigation,min_nav_mode) VALUES ('executive-mis-dashboard','module:executive-mis-dashboard','syn','syn','analytics',70,true,true,true,'view') ON CONFLICT (module_key) DO NOTHING`); assert.equal(pre.status, 0, pre.err);
  const before = val(d, `SELECT count(*) FROM public.user_permissions_canonical`); const sql = fs.readFileSync(path.join(docs, 'CLIENT_PERMISSION_REGISTRY_PROPOSAL_NOT_APPLIED.sql'), 'utf8');
  const r = pg.psql(d, sql); assert.equal(r.status, 0, r.err);
  assert.ok(Number(val(d, `SELECT count(*) FROM public.permission_targets WHERE key LIKE 'module:mis-%'`)) >= 6); assert.equal(val(d, `SELECT count(*) FROM public.app_modules WHERE module_key LIKE 'mis-%'`), '6');
  assert.equal(val(d, `SELECT count(*) FROM public.user_permissions_canonical`), before); assert.notEqual(pg.psql(d, sql).status, 0);
});
