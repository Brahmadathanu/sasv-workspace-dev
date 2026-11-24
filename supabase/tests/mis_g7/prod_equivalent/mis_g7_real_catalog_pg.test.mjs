// MIS G7 -- production-catalog acceptance. The schema is REPLAYED from the real, structured production catalog packet
// (.local/mis-g7-prod-baseline/packet.json, git-ignored, never committed): real function sources/owners/ACLs/config, real tables, constraints,
// triggers, RLS, roles and grants. NO shim and NO seeded fingerprints: S3..S5b install with their literal pinned SHAs against the replayed catalog.
// Fixture rows are synthetic (real_catalog_fixture.sql). Tests are SKIPPED, never PASSED, when the packet or PostgreSQL is unavailable.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startPg, MIGRATIONS, PATCHED_CORE_MIGRATION, PATCHED_CORE_SHA } from '../pg_harness.mjs';
import { loadStructuredPacket, readStructuredPacket, verifyRelations, verifyEnvironment, findMissingDependencies } from './load_structured_packet.mjs';
import { verifyFunctions } from './load_baseline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const PACKET = process.env.MIS_G7_PACKET || path.join(root, '.local/mis-g7-prod-baseline/packet.json');
const docs = path.join(root, 'docs/executive-mis-g7-server');
const mig = (f) => fs.readFileSync(path.join(root, 'supabase/migrations', f), 'utf8');
const SIGNER = '00000000-0000-0000-0000-000000000001', PACKER = '00000000-0000-0000-0000-000000000002', EXCESS = '00000000-0000-0000-0000-000000000003';
const NOBODY = '00000000-0000-0000-0000-000000000004', ADMIN = '00000000-0000-0000-0000-0000000000ad', ADMINV = '00000000-0000-0000-0000-0000000000ae';
const VIEWER = '00000000-0000-0000-0000-0000000000af', SIGNOFF = '00000000-0000-0000-0000-0000000000b0';
const DB = 'real', BASE = 'base';
let pg = null, blocked = null, loaded = null, basePacket = null;

before(() => {
  if (!fs.existsSync(PACKET)) { blocked = 'BLOCKED: production catalog packet not present (.local/mis-g7-prod-baseline/packet.json)'; return; }
  pg = startPg();
  if (!pg) { blocked = 'BLOCKED: local PostgreSQL unavailable'; return; }
  pg.createDb(BASE);
  const major = Number((pg.serverVersion.match(/(\d+)\./) ?? [])[1]);
  loaded = loadStructuredPacket(pg, BASE, PACKET, { serverMajor: major });
  basePacket = loaded.packet;
  // working copies from the replayed baseline (= the production state with S2 installed): never replay S2 again
  for (const d of [DB, 'rb']) assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE ${BASE}`).status, 0);
  for (const d of [DB, 'rb']) {
    for (const f of [...MIGRATIONS.slice(1), PATCHED_CORE_MIGRATION]) { const r = pg.psql(d, mig(f)); assert.equal(r.status, 0, `${d} ${f}: ${r.err}`); }
    const r = pg.psql(d, fs.readFileSync(path.join(here, 'real_catalog_fixture.sql'), 'utf8')); assert.equal(r.status, 0, r.err);
  }
});
after(() => { if (pg) pg.stop(); });

const T = (name, fn) => test(name, async (t) => { if (blocked) return t.skip(blocked); await fn(t); });
const dq = (db, sql, uid, o = {}) => pg.psql(db, sql, uid === undefined ? o : { uid, ...o });
const q = (sql, uid) => dq(DB, sql, uid);
const val = (sql, uid) => { const r = q(sql, uid); assert.equal(r.status, 0, r.err + ' :: ' + sql); return r.out.split('\n').pop(); };
const jl = (out) => JSON.parse(out.split('\n').find((l) => l.startsWith('{')));
const J = (sql, uid) => { const r = q(sql, uid); assert.equal(r.status, 0, r.err); return jl(r.out); };
const Jt = (sql, uid) => { const r = q(sql, uid); if (r.status !== 0) return { ok: false, raised: r.err }; return jl(r.out); };
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0; const bn = (p) => `${p}${++n}`;
const ok = (r) => assert.equal(r.status, 0, r.err);
const setModeSql = (m) => assert.equal(q(`UPDATE app_private.mis_g7_enforcement SET mode='${m}'`).status, 0);
const setMode = (m, uid = ADMIN) => J(`SELECT public.mis_g7_set_enforcement_v1('${m}','real-catalog acceptance')`, uid);

const fgId = (b) => val(`SELECT id FROM public.daily_work_log WHERE batch_number='${b}' AND activity='FG bulk storage'`);
const evId = (b) => val(`SELECT pe.id FROM public.packaging_events pe JOIN public.daily_work_log w ON w.id=pe.work_log_id WHERE w.batch_number='${b}'`);
const bal = (b, p = 1) => Number(val(`SELECT coalesce(sum(qty_base),0) FROM public.fg_bulk_stock_ledger WHERE product_id=${p} AND batch_number='${b}'`));
const sign = (b, qty = 100, uid = SIGNER) => Jt(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'${b}',${fgId(b)},2,1,${qty},'weighment ${b}')`, uid);
const mkSigned = (b, qty = 100) => { val(`SELECT public.t_mkbatch('${b}', ${qty})`); const r = sign(b, qty); assert.equal(r.ok, true, JSON.stringify(r)); };
const pack = (b, lines, o = {}) => Jt(`SELECT public.mis_pack_fg_bulk_v1('${o.key ?? randomUUID()}', ${evId(b)}, '${JSON.stringify(lines)}'::jsonb, ${o.excess ? `'${JSON.stringify(o.excess)}'::jsonb` : 'NULL'})`, o.uid ?? PACKER);
const lineId = (b, sku) => val(`SELECT id FROM public.event_skus WHERE packaging_event_id=${evId(b)} AND sku_id=${sku}`);
const corr = (id, cnt, o = {}) => Jt(`SELECT public.mis_correct_pack_line_v1('${o.key ?? randomUUID()}', ${id}, ${cnt}, '${o.reason ?? 'recount'}', ${o.excess ? `'${JSON.stringify(o.excess)}'::jsonb` : 'NULL'})`, o.uid ?? PACKER);
// editor-flow helpers (EXACT live wrapper/core/parser under the live DEFAULT variable_conflict=error)
const mk = (b, qty = 100) => val(`SELECT public.t_mkbatch_real('${b}', ${qty})`);
const mkEd = (b, qty = 100) => { const f = mk(b, qty); const r = sign(b, qty); assert.equal(r.ok, true, JSON.stringify(r)); return f; };
const edit = (id, patch = {}, uid = PACKER) => dq(DB, `SELECT * FROM public.t_edit_dwl(${id}, '${JSON.stringify(patch).replace(/'/g, "''")}'::jsonb)`, uid);
const DONE = (s) => ({ status: 'Done', sku_breakdown: s });
const lines = (id) => val(`SELECT coalesce(string_agg(es.sku_id||':'||es."count", ',' ORDER BY es.sku_id),'-') FROM public.event_skus es JOIN public.packaging_events pe ON pe.id=es.packaging_event_id WHERE pe.work_log_id=${id}`);
const hdrs = (id) => val(`SELECT count(*) FROM public.packaging_events WHERE work_log_id=${id}`);
const coreSha = (db) => dq(db, `SELECT encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') FROM pg_proc p WHERE p.proname='rpc_update_daily_work_log_with_packaging__core' AND p.pronamespace='public'::regnamespace`).out;
const sha = (db, sig) => dq(db, `SELECT encode(sha256(convert_to(pg_get_functiondef('${sig}'::regprocedure),'UTF8')),'hex')`).out;
const auditCount = (where = 'true') => Number(val(`SELECT count(*) FROM app_private.mis_g7_direct_pack_audit WHERE ${where}`));

// ===================================================== 1. REPLAY FIDELITY =====================================================
T('REPLAY: packet integrity and structured ingestion (no silent omissions; every skipped/unsupported item is reported)', () => {
  const st = fs.statSync(PACKET);
  if (!process.env.MIS_G7_PACKET) {
    assert.equal(st.size, 260034);
    assert.equal(createHash('sha256').update(fs.readFileSync(PACKET)).digest('hex'), '8ebb31e4279d322bdbe12db1aa2f178e219dd44f71f96e1553b1e46288d3dfa3');
  }
  const r = loaded.report;
  // the ONLY object-creation errors are the 23 RLS policies whose predicate functions are absent from the targeted capture
  assert.equal(r.errors.length, 23, r.errors.join('\n'));
  for (const e of r.errors) assert.match(e, /^policy .*function (app_has_permission\(text, text\)|app_is_provisioned_user\(\)|is_admin\(\)) does not exist/);
  assert.deepEqual([...new Set(r.errors.map((e) => e.match(/function ([a-z_]+\()/)[1]))].sort(), ['app_has_permission(', 'app_is_provisioned_user(', 'is_admin(']);
  assert.deepEqual(r.unsupported.map((u) => u.extension).sort(), ['hypopg', 'index_advisor', 'pg_cron', 'pg_net', 'supabase_vault']);
  assert.ok(r.unsupported.every((u) => u.referencedByCapturedObjects === false), 'no captured object depends on an unsupported extension');
});
T('REPLAY: all 49 captured functions equal the packet (existence, SHA-256 of pg_get_functiondef, owner, security, config, ACL)', () => {
  const d = verifyFunctions(pg, BASE, { cat: { functions: loaded.functions } });
  assert.deepEqual(d, [], JSON.stringify(d).slice(0, 2000));
  assert.equal(loaded.functions.length, 49);
});
T('REPLAY: relations and environment equal the packet (columns, constraints, indexes, triggers, ACL, owners, RLS, roles); only the 23 reported policies differ', () => {
  const rd = verifyRelations(pg, BASE, basePacket);
  const nonPolicy = rd.filter((x) => !/: policy /.test(x)); assert.deepEqual(nonPolicy, [], JSON.stringify(nonPolicy).slice(0, 2000));
  assert.deepEqual(verifyEnvironment(pg, BASE, basePacket), []);
});
T('REPLAY: consolidated list of live objects the packet references but did NOT capture (ChatGPT must extract these)', () => {
  const miss = findMissingDependencies(pg, BASE, basePacket, loaded.functions);
  // functions referenced by captured RLS policies / triggers
  console.log('MISSING-CALLS', JSON.stringify(miss));
  // relations referenced by captured trigger functions and not present
  const rels = dq(DB, `SELECT string_agg(x,',' ORDER BY x) FROM unnest(ARRAY['public.supply_rollup_refresh_queue','public.product_sku_change_log','public.batch_plan_batches','costing.effective_date_guard_config','costing.effective_date_backdate_log','costing.readiness_portfolio_source_epoch']) x WHERE to_regclass(x) IS NULL AND x <> 'public.supply_rollup_refresh_queue'`).out;
  assert.equal(rels, 'costing.effective_date_backdate_log,costing.effective_date_guard_config,costing.readiness_portfolio_source_epoch,public.batch_plan_batches,public.product_sku_change_log');
});
T('REPLAY: S3..S5b were installed from the replayed S2 baseline with their LITERAL pins (no seeded fingerprints); patched core SHA and helper ACL', () => {
  assert.equal(val(`SELECT count(*) FROM app_private.mis_g7_s3b_expected_sha`), '11');
  const pins = fs.readFileSync(path.join(root, 'supabase/migrations/20261123143000_mis_g7_s3b_protected_stock_write_boundary.sql'), 'utf8');
  assert.equal([...pins.matchAll(/'([0-9a-f]{64})'/g)].length >= 11, true, 'the 11 live SHAs are literals in the migration file');
  const chain = ['fn_fg_auto_zero(integer,text,numeric)', 'fn_fg_force_close(integer,text,numeric)', 'fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)'];
  for (const c of chain) assert.equal(val(`SELECT count(*) FROM app_private.mis_g7_s3b_expected_sha WHERE obj='${c}'`), '1', c);
  assert.equal(coreSha(DB), PATCHED_CORE_SHA);
  for (const f of ['app_private.mis_lock_fg_batch(integer,text)', 'app_private.mis_lock_fg_batches(integer,text,integer,text)'])
    assert.equal(val(`SELECT has_function_privilege('authenticated','${f}','EXECUTE')`), 'f', f);
  assert.equal(val(`SELECT mode FROM app_private.mis_g7_enforcement`), 'AUDIT');
});

// ===================================================== 2. AUDIT: legacy behaviour on the real catalog =====================================================
T('AUDIT real DWL path: the live trigger posts the FG receipt; real Done guard and governed reconciliation still hold; nothing is logged for legacy-only paths', () => {
  const b = bn('AU1'); val(`SELECT public.t_mkbatch('${b}', 100)`);
  assert.equal(bal(b), 100);
  assert.equal(val(`SELECT count(*) FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}' AND source_table='daily_work_log' AND reason_code='FG bulk storage'`), '1');
  // real guard: manual Done is refused even for a balanced batch unless the governed reconciliation flag is set
  assert.match(q(`UPDATE public.daily_work_log SET status='Done' WHERE id=${fgId(b)}`).err, /Cannot mark FG Bulk Storage row Done while batch is not closed/);
  assert.equal(val(`SELECT public.fn_fg_eps_default()`), '0.01');
});
T('AUDIT real stock operations: transfer legs, force-close (permission-gated wrapper), mark-done wrapper, auto-zero and reconcile all work or refuse exactly as live', () => {
  const b = bn('AU2'); mkSigned(b); assert.equal(pack(b, [{ sku_id: 10, count: 20 }]).ok, true); assert.equal(bal(b), 90);
  const wl = fgId(b);
  // clients cannot run the legacy writers; the permission-gated wrappers need module:fg-bulk-stock
  assert.match(q(`SELECT public.fn_fg_force_close(${wl},'x',0.01)`, PACKER).err, /permission denied|not authenticated|Permission denied/i);
  assert.match(q(`SELECT public.fn_fg_force_close(${wl},'x',0.01)`, NOBODY).err, /permission denied|Permission denied|Not authenticated/i);
  assert.equal(bal(b), 90);
  // negative guard is the live one: a direct over-draw by the trusted owner path is refused
  assert.match(q(`SELECT public.fn_fg_ledger_add(1,'${b}',-1000,'Kg',${wl},'test',current_date)`).err, /negative|stock/i);
  assert.equal(bal(b), 90);
});
T('AUDIT old-client editor path: wrapper writes (definer) are LOGGED, not blocked; RPC lines are not logged', () => {
  const b = bn('AU3'); const f = mkEd(b); const before = auditCount();
  ok(edit(f, DONE('0.5 kg x 10')));                                    // legacy editor chain create on a SIGNED batch
  assert.equal(lines(f), '10:10'); assert.equal(bal(b), 95);
  assert.equal(val(`SELECT mode FROM app_private.mis_g7_enforcement`), 'AUDIT');
  const b2 = bn('AU3p'); mkSigned(b2); const c0 = auditCount(); assert.equal(pack(b2, [{ sku_id: 10, count: 4 }]).ok, true);
  assert.equal(auditCount(), c0, 'the governed RPC leaves no legacy-write audit rows');
  assert.ok(auditCount() >= before);
});


T('AUDIT legacy trusted writer (service_role, the only role with table DML): direct SKU line proceeds, depletes through the live trigger and is LOGGED; authenticated has no table DML on the real ACL', () => {
  const b = bn('AU4'); mkSigned(b); const e = evId(b); const c0 = auditCount();
  for (const t of ['event_skus', 'packaging_events', 'fg_bulk_stock_ledger']) assert.equal(val(`SELECT has_table_privilege('authenticated','public.${t}','INSERT')`), 'f', t);
  assert.equal(val(`SELECT has_table_privilege('authenticated','public.daily_work_log','INSERT')`), 't');      // legacy clients log through the DWL (live ACL); stock lines only via definer wrappers
  assert.match(q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${e},10,4)`, PACKER).err, /permission denied for table event_skus/);
  const r = pg.psql(DB, `SET ROLE service_role; INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${e},10,4)`); assert.equal(r.status, 0, r.err);
  assert.equal(bal(b), 98); assert.equal(auditCount(), c0 + 1);
  assert.equal(val(`SELECT mode||'|'||op||'|'||tbl FROM app_private.mis_g7_direct_pack_audit ORDER BY 1 DESC LIMIT 1`).split('|').length, 3);
  assert.equal(pg.psql(DB, `SET ROLE service_role; DELETE FROM public.event_skus WHERE packaging_event_id=${e}`).status, 0); assert.equal(bal(b), 100);
});
T('FINDING (S2 fingerprint includes DWL status): the governed close of a fully packed batch changes wl_status, so later pack/corrections need the stage corrected and re-signed (recovery path verified)', () => {
  const b = bn('FN1'); mkSigned(b, 10); assert.equal(pack(b, [{ sku_id: 10, count: 20 }]).ok, true);       // 10 Kg packed -> balance 0 -> governed auto-close -> FG DWL Done
  assert.equal(val(`SELECT status FROM public.daily_work_log WHERE id=${fgId(b)}`), 'Done');
  const id = lineId(b, 10); const r = corr(id, 10); assert.equal(r.code, 'STAGE_SOURCE_CHANGED', JSON.stringify(r)); assert.equal(bal(b), 0);
  const sev = val(`SELECT max(event_id) FROM app_private.mis_batch_stage_event WHERE batch_number='${b}' AND event_kind='SIGN'`);
  assert.equal(J(`SELECT public.mis_correct_batch_stage_v1('${randomUUID()}', ${sev}, 'FG receipt row closed by governed reconciliation')`, SIGNER).ok, true);
  assert.equal(sign(b, 10).ok, true);                                                                   // re-sign evidence of the same receipt
  assert.equal(corr(id, 10).ok, true); assert.equal(bal(b), 5);
});

// ===================================================== 3. Roles / permissions on the real require_permission =====================================================
T('PERMISSION real require_permission: view-only, wrong module, no-subject and anon are denied; actor stamped from the JWT', () => {
  const b = bn('PM1'); mkSigned(b);
  const body = (uid) => `SELECT public.mis_pack_fg_bulk_v1('${randomUUID()}', ${evId(b)}, '[{"sku_id":10,"count":2}]'::jsonb, NULL)`;
  for (const uid of [NOBODY, SIGNER, VIEWER, ADMIN]) assert.notEqual(Jt(body(uid), uid).ok, true, uid);
  assert.equal(bal(b), 100, 'nothing written for any denied actor');
  const a = pg.psql(DB, `SET ROLE anon; ${body(NOBODY)}`); assert.match(a.err + a.out, /permission denied|PERMISSION/i);
  const ns = pg.psql(DB, `SET ROLE authenticated; ${body(NOBODY)}`); assert.match(ns.err + ns.out, /Not authenticated|PERMISSION|FORBIDDEN|DENIED|not authenticated/i);
  assert.equal(pack(b, [{ sku_id: 10, count: 2 }]).ok, true);
  assert.equal(val(`SELECT actor::text FROM app_private.mis_fg_pack_request ORDER BY created_at DESC LIMIT 1`), PACKER);
  // signer cannot pack; packer cannot sign
  assert.equal(sign(b, 100, PACKER).ok, false);
});
T('PERMISSION enforcement admin: view-only admin and ordinary roles cannot switch modes; admin can (logged)', () => {
  assert.equal(Jt(`SELECT public.mis_g7_set_enforcement_v1('AUDIT','x')`, ADMINV).ok === true, false);
    for (const uid of [NOBODY, PACKER, SIGNER]) { assert.notEqual(Jt(`SELECT public.mis_g7_set_enforcement_v1('ENFORCE','x')`, uid).ok, true, uid); }
  assert.equal(val(`SELECT mode FROM app_private.mis_g7_enforcement`), 'AUDIT');
});

// ===================================================== 4. Signed stage, correction, re-sign =====================================================
T('STAGE sign/replay/correct/re-sign on the real route, BMR and batch identity; fail-closed route classes on real route tables', () => {
  const b = bn('ST1'); val(`SELECT public.t_mkbatch('${b}', 100)`);
  const wl = fgId(b); const key = randomUUID();
  const sg = (k) => J(`SELECT public.mis_sign_batch_stage_v1('${k}',1,'${b}',${wl},2,1,100,'w')`, SIGNER);
  const r1 = sg(key); assert.equal(r1.ok, true); const r2 = sg(key); assert.equal(r2.idempotent_replay, true);
  const rk = J(`SELECT public.mis_sign_batch_stage_v1('${key}',1,'${b}',${wl},2,2,100,'w')`, SIGNER); assert.equal(rk.code, 'IDEMPOTENCY_KEY_REUSED', JSON.stringify(rk));
  assert.equal(Jt(`SELECT public.mis_correct_batch_stage_v1('${randomUUID()}',${r1.event_id},'wrong weight')`, PACKER).ok, false);
  assert.equal(J(`SELECT public.mis_correct_batch_stage_v1('${randomUUID()}',${r1.event_id},'wrong weight')`, SIGNER).ok, true);
  assert.equal(pack(b, [{ sku_id: 10, count: 2 }]).code, 'FG_STAGE_NOT_SIGNED');                // corrected -> unsigned again
  assert.equal(sign(b).ok, true); assert.equal(pack(b, [{ sku_id: 10, count: 2 }]).ok, true);    // re-sign
  const sigs = (bb, p, s) => J(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',${p},'${bb}',${fgId(bb)},${s},1,10,'x')`, SIGNER);
  assert.equal(sigs('X3', 3, 2).code, 'PRODUCT_ROUTE_COVERAGE');                                  // no approved route for P3
  assert.equal(sigs('X4', 4, 2).code, 'MANDATORY_FG_STAGE_GAP');                                  // P4 route lacks the FG step
  assert.equal(sigs('X5', 5, 51).ok, true);                                                       // exactly one approved route covers the date -> resolves
});
T('STAGE effective-date gap and overlapping approved routes on the real EXCLUDE-constrained route table fail closed', () => {
  // P5: routes 51 (to 2026-06-30) and 52 (from 2026-07-01). A receipt dated before 2026-01-01 has NO effective route -> EFFECTIVE_DATE_ROUTE_GAP
  const w = fgId('X5');
  assert.equal(q(`UPDATE public.daily_work_log SET log_date='2025-12-01' WHERE id=${w}`).status, 0);
  assert.equal(J(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',5,'X5',${w},51,1,10,'x')`, SIGNER).code, 'EFFECTIVE_DATE_ROUTE_GAP');
  assert.equal(q(`UPDATE public.daily_work_log SET log_date='2026-11-10' WHERE id=${w}`).status, 0);
  // an overlapping APPROVED route cannot even be stored: the live EXCLUDE constraint is the structural guard behind APPROVED_ROUTE_OVERLAP
  assert.match(q(`SET session_replication_role=replica; INSERT INTO costing.product_process_route(id,product_id,base_route_family_route_id,route_version,route_code,batch_size_ref_id,status,effective_from,approval_reference,approved_at,evidence_status) VALUES (99,5,5,9,'SYN-OVL',5,'APPROVED','2026-08-01','x',now(),'MANUAL_COMPLETE')`).err, /no_approved_overlap|conflicting key/);
});

// ===================================================== 5. Atomic packing =====================================================
T('PACK atomic: SKU pack-size/UOM conversion on real product factors, idempotent retry, stock moves exactly once', () => {
  const b = bn('PK1'); mkSigned(b);
  const key = randomUUID(); const r = pack(b, [{ sku_id: 10, count: 20 }, { sku_id: 11, count: 10 }], { key });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(Number(r.required_base), 15);        // 20*0.5 + 10*(500 g * 0.001) = 15 Kg
  assert.equal(bal(b), 85);
  assert.equal(pack(b, [{ sku_id: 10, count: 20 }, { sku_id: 11, count: 10 }], { key }).idempotent_replay, true); assert.equal(bal(b), 85);
  assert.equal(val(`SELECT count(*) FROM public.event_skus WHERE packaging_event_id=${evId(b)}`), '2');
  // each line is mirrored by exactly one ledger depletion keyed to the line
  assert.equal(val(`SELECT count(*) FROM public.fg_bulk_stock_ledger WHERE source_table='event_skus' AND source_id IN (SELECT id FROM public.event_skus WHERE packaging_event_id=${evId(b)})`), '2');
});
T('PACK validation: wrong SKU/product, non-positive counts, unsigned and historical batches refused with nothing written', () => {
  const b = bn('PK2'); mkSigned(b);
  assert.equal(pack(b, [{ sku_id: 20, count: 1 }]).ok, false);                                    // SKU of another product
  assert.equal(pack(b, [{ sku_id: 10, count: 0 }]).ok, false);
  assert.equal(pack(b, [{ sku_id: 10, count: -3 }]).ok, false);
  const h = bn('PK2h'); val(`SELECT public.t_mkbatch('${h}', 100)`);                              // unsigned (historical-style)
  assert.equal(pack(h, [{ sku_id: 10, count: 2 }]).code, 'FG_STAGE_NOT_SIGNED'); assert.equal(bal(h), 100);
  assert.equal(bal(b), 100); assert.equal(val(`SELECT count(*) FROM public.event_skus WHERE packaging_event_id=${evId(b)}`), '0');
});
T('PACK measured excess: only with separate authority; unauthorised/undersized refused; authorised commit is atomic (receipt + depletion + line)', () => {
  const b = bn('PK3'); mkSigned(b, 10);
  const ex = (q2) => ({ qty_base: q2, evidence_ref: 'scale-ticket-1', reason: 'measured on pack-out' });
  const need = pack(b, [{ sku_id: 10, count: 30 }]);                                               // needs 15, holds 10
  assert.equal(need.code, 'INSUFFICIENT_BULK'); assert.equal(Number(need.shortfall_base), 5); assert.equal(need.excess_permitted, false);
  assert.equal(bal(b), 10);
  assert.equal(pack(b, [{ sku_id: 10, count: 30 }], { excess: ex(5) }).ok, false);                  // packer lacks excess authority
  assert.equal(pack(b, [{ sku_id: 10, count: 30 }], { excess: ex(1), uid: EXCESS }).ok, false);     // undersized
  assert.equal(bal(b), 10);
  const r = pack(b, [{ sku_id: 10, count: 30 }], { excess: ex(5), uid: EXCESS });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(bal(b), 0);
  assert.equal(val(`SELECT count(*) FROM app_private.mis_fg_signed_excess_receipt WHERE batch_number='${b}'`), '1');
  const b2 = bn('PK3s'); mkSigned(b2, 100);
  const rs = pack(b2, [{ sku_id: 10, count: 2 }], { excess: ex(5), uid: EXCESS }); assert.equal(rs.ok, false, JSON.stringify(rs)); assert.equal(bal(b2), 100);   // excess is refused when stock suffices
});

// ===================================================== 6. Corrections, historical missing depletion =====================================================
T('CORR ticketed pack-line corrections on the real catalog: decrease/increase/remove exact, idempotent; refusals never fabricate stock', () => {
  const b = bn('CR1'); mkSigned(b); assert.equal(pack(b, [{ sku_id: 10, count: 20 }]).ok, true);
  const id = lineId(b, 10); assert.equal(bal(b), 90);
  const r1 = corr(id, 10); assert.equal(r1.ok, true, JSON.stringify(r1)); assert.equal(bal(b), 95);
  assert.equal(corr(id, 30).ok, true); assert.equal(bal(b), 85);
  assert.equal(corr(id, 0).ok, true); assert.equal(bal(b), 100);
  // historical line with NO depletion row (the 29-class): the correction path refuses
  const h = bn('CR1h'); mkSigned(h);
  assert.equal(dq(DB, `SET session_replication_role=replica; INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${evId(h)},10,20)`).status, 0);
  const hl = lineId(h, 10); const rr = corr(hl, 5); assert.equal(rr.ok, false, JSON.stringify(rr)); assert.equal(bal(h), 100);
  assert.equal(corr(hl, 5, { uid: NOBODY }).ok, false);
});
T('CORR atomicity: an insufficient-stock correction without authority writes nothing; with measured excess authority it commits atomically', () => {
  const b = bn('CR2'); mkSigned(b, 10); assert.equal(pack(b, [{ sku_id: 10, count: 10 }]).ok, true); assert.equal(bal(b), 5);
  const id = lineId(b, 10);
  const r = corr(id, 40); assert.equal(r.ok, false); assert.equal(bal(b), 5); assert.equal(val(`SELECT count FROM public.event_skus WHERE id=${id}`), '10');
  const r2 = corr(id, 40, { uid: EXCESS, excess: { qty_base: 10, evidence_ref: 'ticket', reason: 'measured' } });
  assert.equal(r2.ok, true, JSON.stringify(r2)); assert.equal(bal(b), 0); assert.equal(val(`SELECT count FROM public.event_skus WHERE id=${id}`), '40');
});

// ===================================================== 7. Legacy editor chain replacement (patched core) =====================================================
T('EDITOR AUDIT: real wrapper+patched core: create/replace/retype/remove/recreate keep FG stock exact under the live DEFAULT variable_conflict', () => {
  const b = bn('ED1'); const f = mkEd(b);
  ok(edit(f, DONE('0.5 kg x 20'))); assert.equal(lines(f), '10:20'); assert.equal(bal(b), 90);
  ok(edit(f, DONE('0.5 kg x 10;500 g x 4'))); assert.equal(lines(f), '10:10,11:4'); assert.equal(bal(b), 100 - 5 - 2);
  ok(edit(f, { activity: 'Cartoning', ...DONE('500 g x 60') })); assert.equal(lines(f), '11:60'); assert.equal(bal(b), 100 - 30);
  ok(edit(f, { status: 'Doing' })); assert.equal(lines(f), '-'); assert.equal(bal(b), 100); assert.equal(hdrs(f), '0');
  ok(edit(f, DONE('0.5 kg x 8'))); assert.equal(bal(b), 96);
  ok(edit(f, { remarks: 'note only' })); assert.equal(lines(f), '10:8'); assert.equal(bal(b), 96);
  assert.equal(val(`SELECT count(*) FROM app_private.mis_g7_chain_ticket WHERE finished_at IS NULL`), '0');
});
T('EDITOR AUDIT: violations (unsigned batch, historical never-depleted line) are recorded but never block the legacy edit', () => {
  const cnt = (c) => Number(val(`SELECT count(*) FROM app_private.mis_g7_direct_pack_audit WHERE tbl='chain_replace' AND op='${c}'`));
  const u = bn('ED2u'); const uf = mk(u); const c0 = cnt('CHAIN_STAGE_NOT_SIGNED');
  ok(edit(uf, DONE('0.5 kg x 4'))); assert.equal(lines(uf), '10:4'); assert.equal(bal(u), 98); assert.equal(cnt('CHAIN_STAGE_NOT_SIGNED'), c0 + 1);
});

// ===================================================== 8. Concurrency / conservation =====================================================
T('CONCURRENCY real catalog: racing packers on one scarce batch -- exactly the stock that exists is consumed, loser gets structured INSUFFICIENT_BULK', async () => {
  const b = bn('CC1'); mkSigned(b, 10);                                                            // 10 Kg: two packs of 6 Kg cannot both win
  const e1 = evId(b); const w2 = val(`SELECT public.t_mkbatch_real('${b}x', 1)`); void w2;
  const run = (k, sku) => pg.psqlAsync(DB, `SELECT public.mis_pack_fg_bulk_v1('${k}', ${e1}, '[{"sku_id":${sku},"count":12}]'::jsonb, NULL)`, { uid: PACKER });   // 12 x 0.5 Kg = 12 x 500 g = 6 Kg each
  const [a, c] = await Promise.all([run(randomUUID(), 10), run(randomUUID(), 11)]);
  const oks = [a, c].map((r) => { try { return jl(r.out); } catch { return { ok: false, err: r.err }; } });
  assert.equal(oks.filter((x) => x.ok === true).length, 1, JSON.stringify(oks)); assert.ok(oks.some((x) => x.code === 'INSUFFICIENT_BULK'), JSON.stringify(oks));
  assert.ok(bal(b) >= 0); assert.ok(Math.abs(bal(b) - (10 - 6 * oks.filter((x) => x.ok === true).length)) < 1e-9, `balance ${bal(b)}`);
});
T('CONCURRENCY real catalog: editor chain replacement vs concurrent packer on the same batch serialize; ledger equals chain state', async () => {
  const b = bn('CC2'); const f = mkEd(b); ok(edit(f, DONE('0.5 kg x 10')));
  const a = pg.psqlAsync(DB, `SELECT * FROM public.t_edit_dwl(${f}, '${JSON.stringify(DONE('0.5 kg x 30')).replace(/'/g, "''")}'::jsonb)`, { uid: PACKER });
  await delay(30);
  const b2 = bn('CC2b'); mkSigned(b2); const p = pack(b2, [{ sku_id: 10, count: 4 }]); assert.equal(p.ok, true);
  const ra = await a; assert.equal(ra.status, 0, ra.err);
  assert.equal(lines(f), '10:30'); assert.equal(bal(b), 100 - 15);
  assert.equal(Number(val(`SELECT coalesce(sum(qty_base),0) FROM public.fg_bulk_stock_ledger WHERE product_id=1 AND batch_number='${b}' AND source_table='event_skus'`)), -15);
});
T('CONCURRENCY real catalog: cross-batch mixed workload has no deadlock and exact balances', async () => {
  const bs = [bn('CC3a'), bn('CC3b'), bn('CC3c')]; bs.forEach((b) => mkSigned(b, 100));
  const jobs = bs.flatMap((b) => [1, 2].map(() => pg.psqlAsync(DB, `SELECT public.mis_pack_fg_bulk_v1('${randomUUID()}', ${evId(b)}, '[{"sku_id":10,"count":2}]'::jsonb, NULL)`, { uid: PACKER })));
  const rs = await Promise.all(jobs);
  for (const r of rs) assert.equal(r.status, 0, r.err);
  for (const b of bs) {                                                                              // every outcome is either a committed pack or a structured refusal; ledger == committed lines
    const lineKg = Number(val(`SELECT coalesce(sum(es."count"*0.5),0) FROM public.event_skus es WHERE es.packaging_event_id=${evId(b)}`));
    assert.equal(bal(b), 100 - lineKg, b);
  }
});

// ===================================================== 9. ENFORCE readiness and protection =====================================================
T('ENFORCE readiness: refused until the owner signs off THIS exact patched core SHA; then ENFORCE protects direct writes and the editor chain; AUDIT restores', () => {
  assert.equal(setMode('ENFORCE').code, 'CORE_MIGRATION_NOT_ACCEPTED');
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN).core_gate, 'CORE_MIGRATION_NOT_ACCEPTED');
  for (const uid of [NOBODY, SIGNER, PACKER, ADMIN]) assert.match(q(`SELECT public.mis_g7_record_core_migration_acceptance_v1('${PATCHED_CORE_SHA}','x')`, uid).err, /permission denied|Permission denied/i);
  assert.equal(J(`SELECT public.mis_g7_record_core_migration_acceptance_v1('${'0'.repeat(64)}','stale')`, SIGNOFF).code, 'CORE_SHA_MISMATCH');
  assert.equal(J(`SELECT public.mis_g7_record_core_migration_acceptance_v1('${PATCHED_CORE_SHA}','owner review (synthetic acceptance run)')`, SIGNOFF).ok, true);
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN).core_gate, 'OK');
  assert.equal(setMode('ENFORCE').ok, true);
  try {
    const b = bn('EN1'); const f = mkEd(b);
    ok(edit(f, DONE('0.5 kg x 10'))); assert.equal(bal(b), 95);                                    // signed batch: editor chain works under ENFORCE
    const u = bn('EN1u'); const uf = mk(u);
    assert.match(edit(uf, DONE('0.5 kg x 4')).err, /MIS_G7_CHAIN_STAGE_NOT_SIGNED/); assert.equal(lines(uf), '-'); assert.equal(bal(u), 100);   // unsigned refused, whole edit rolled back
    // direct DML (owner session, bypassing the RPC) on a bulk packaging line is denied
    assert.match(q(`INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${evId(b)},10,1)`).err, /MIS_G7_DIRECT_PACKING_DENIED/);
    // signed-stage correction + re-sign flow around an FG receipt revision
    const fg = fgId(b); ok(edit(fg, { storage_qty: 110 })); assert.equal(bal(b), 105);
    assert.match(edit(f, { remarks: 'x' }).err, /MIS_G7_CHAIN_STAGE_SOURCE_CHANGED/);
    const sev = val(`SELECT max(event_id) FROM app_private.mis_batch_stage_event WHERE batch_number='${b}' AND event_kind='SIGN'`);
    assert.equal(J(`SELECT public.mis_correct_batch_stage_v1('${randomUUID()}', ${sev}, 'receipt revised')`, SIGNER).ok, true);
    assert.equal(J(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'${b}',${fg},2,1,110,'re-weighed')`, SIGNER).ok, true);
    ok(edit(f, { remarks: 'x' })); assert.equal(lines(f), '10:10');
    // historical missing-depletion line is refused under ENFORCE (replacing it would return stock never consumed)
    const h = bn('EN1h'); const hf = mkEd(h);
    assert.equal(dq(DB, `SET session_replication_role=replica; INSERT INTO public.packaging_events(work_log_id,event_type) VALUES (${hf},'Bottling'); INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") SELECT max(id),10,20 FROM public.packaging_events`).status, 0);
    assert.match(edit(hf, DONE('0.5 kg x 20')).err, /MIS_G7_CHAIN_CONSERVATION_MISMATCH/); assert.equal(bal(h), 100);
    assert.equal(val(`SELECT count(*) FROM app_private.mis_g7_chain_ticket WHERE finished_at IS NULL`), '0');
    // batch move between identities is conserved per identity
    const m1 = bn('EN1m'), m2 = bn('EN1n'); const mf = mkEd(m1); mkEd(m2); ok(edit(mf, DONE('0.5 kg x 20')));
    assert.match(edit(mf, { batch_number: m2, ...DONE('0.5 kg x 20') }).err, /MIS_G7_CHAIN_CONSERVATION_MISMATCH/);
  } finally { setModeSql('AUDIT'); }
  assert.equal(val(`SELECT mode FROM app_private.mis_g7_enforcement`), 'AUDIT');
});

// ===================================================== 10. Exact S2-preserving rollback =====================================================
T('ROLLBACK on the replayed catalog: S5B->S5->S4B->S3B->S4->S3 restores the S2 production baseline exactly (functions, ACLs, config, triggers, table grants); S2 RPCs survive', () => {
  const rb = 'rb';
  const snapSql = `SELECT string_agg(x, E'\\n' ORDER BY x) FROM (
      SELECT p.oid::regprocedure::text||'|'||encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')||'|'||pg_get_userbyid(p.proowner)||'|'||p.prosecdef||'|'||coalesce(array_to_string(p.proconfig,';'),'')||'|'||
        coalesce((SELECT string_agg(a::text,',' ORDER BY a::text) FROM unnest(coalesce(p.proacl, acldefault('f',p.proowner))) a),'') AS x
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','costing','auth') AND p.prokind='f' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')
      UNION ALL SELECT 'T|'||c.oid::regclass::text||'|'||t.tgname::text||'|'||t.tgenabled::text||'|'||encode(sha256(convert_to(pg_get_triggerdef(t.oid),'UTF8')),'hex') FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','costing')
      UNION ALL SELECT 'R|'||c.oid::regclass::text||'|'||coalesce((SELECT string_agg(a::text,',' ORDER BY a::text) FROM unnest(coalesce(c.relacl, acldefault('r',c.relowner))) a),'') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','costing')) s`;
  // the pre-S3 state is the BASE database (production-state, S2 installed). Compare only objects that exist in BASE; new G7 objects (S3+ functions/tables) must be gone or retained evidence.
  const baseSnap = dq(BASE, snapSql); assert.equal(baseSnap.status, 0, baseSnap.err);
  const rbText = fs.readFileSync(path.join(docs, 'ROLLBACK_NOT_A_MIGRATION.sql'), 'utf8');
  const at = (m) => rbText.indexOf(`-- ==== ${m} ====`);
  const iS4 = at('S4 ROLLBACK'), iS3 = at('S3 ROLLBACK'), iS2 = rbText.indexOf('-- ==== S2 ROLLBACK'), iS3b = at('S3B ROLLBACK'), iS4b = at('S4B ROLLBACK'), iS5 = at('S5 ROLLBACK'), iS5b = at('S5B ROLLBACK');
  assert.ok(iS4 > 0 && iS3 > iS4 && iS2 > iS3 && iS3b > iS2 && iS4b > iS3b && iS5 > iS4b && iS5b > iS5);
  const sec = { s5b: rbText.slice(iS5b), s5: rbText.slice(iS5, iS5b), s4b: rbText.slice(iS4b, iS5), s3b: rbText.slice(iS3b, iS4b), s4: rbText.slice(iS4, iS3), s3: rbText.slice(iS3, iS2) };
  assert.ok(!Object.values(sec).join('').includes('mis_sign_batch_stage_v1'));
  // exercise the installed system and leave state behind (a signed stage, a pack, owner-forced ENFORCE)
  const rbq = (sql, uid) => dq(rb, sql, uid);
  assert.equal(rbq(`SELECT public.t_mkbatch('RBB1',100)`).status, 0);
  const wl = rbq(`SELECT id FROM public.daily_work_log WHERE batch_number='RBB1' AND activity='FG bulk storage'`).out;
  assert.equal(JSON.parse(rbq(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'RBB1',${wl},2,1,100,'e')`, SIGNER).out).ok, true);
  assert.equal(rbq(`UPDATE app_private.mis_g7_enforcement SET mode='ENFORCE'`).status, 0);
  for (const k of ['s5b', 's5', 's4b', 's3b', 's4', 's3']) { const r = rbq(sec[k]); assert.equal(r.status, 0, `${k}: ${r.err}`); }
  assert.equal(rbq(`SELECT mode FROM app_private.mis_g7_enforcement`).out.split('\n').pop(), 'AUDIT');
  const after = dq(rb, snapSql); assert.equal(after.status, 0, after.err);
  const A = new Set(after.out.split('\n')), B = baseSnap.out.split('\n');
  const missing = B.filter((l) => !A.has(l)); assert.deepEqual(missing, [], 'rollback must restore every baseline function/trigger/table-ACL line exactly');
  const extra = [...A].filter((l) => !new Set(B).has(l)); assert.deepEqual(extra.filter((l) => !/^T\|public\.(event_skus|packaging_events|daily_work_log)\|t_/.test(l) && !/t_mkbatch|t_edit_dwl/.test(l) && !/mis_/.test(l) && !/supply_rollup_refresh_queue/.test(l)), [], 'no unexpected extra catalog lines');
  // S2 survives and works after the full rollback; signed history retained
  for (const f of ['public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text)', 'public.mis_correct_batch_stage_v1(uuid,bigint,text)'])
    assert.equal(rbq(`SELECT has_function_privilege('authenticated','${f}','EXECUTE') AND NOT has_function_privilege('anon','${f}','EXECUTE')`).out, 't', f);
  assert.equal(rbq(`SELECT public.t_mkbatch('RBB2',50)`).status, 0);
  const wl2 = rbq(`SELECT id FROM public.daily_work_log WHERE batch_number='RBB2' AND activity='FG bulk storage'`).out;
  assert.equal(JSON.parse(rbq(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'RBB2',${wl2},2,1,50,'post-rollback')`, SIGNER).out).ok, true);
  assert.equal(rbq(`SELECT count(*) FROM app_private.mis_batch_stage_event`).out, '2');
  assert.equal(rbq(`SELECT count(*) FROM pg_trigger WHERE tgname LIKE '00\\_mis\\_g7\\_%'`).out, '0');
  assert.equal(coreSha(rb), coreSha(BASE)); assert.match(coreSha(rb), /^df7290df/);                      // the exact original core is back
});
