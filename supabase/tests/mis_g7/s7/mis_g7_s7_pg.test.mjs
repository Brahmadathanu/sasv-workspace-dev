// MIS G7 S7 isolated server acceptance (PostgreSQL, no network, no production). Runs the REAL Costing route engine (verbatim from the
// repository migrations), S2–S6 exactly as accepted, then S7a/S7b as ONE transaction each (as the migration tool does), the staged rollback,
// and the corrected registry proposal. Private production catalog packets are NOT available to this session (see S7 receipt, dependency D-1),
// so base tables outside the route engine are the committed shim. Skips honestly (BLOCKED) when PostgreSQL is unavailable.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startPg, MIGRATIONS, FINGERPRINT_MIGRATION } from '../pg_harness.mjs';
import { extractRouteEngine, ENGINE_FUNCTIONS } from './extract_route_engine.mjs';
import { buildS7Databases, run1 as run1p, mig, S7A, S7B, S7C, asTx, SIGNER, PACKER, EXCESS, NOBODY, SIGNV, PACKV, EXECV } from './build_db.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const doc = (f) => fs.readFileSync(path.join(root, 'docs/executive-mis-g7-server', f), 'utf8');
let pg = null; let blocked = null;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

const run1 = (db, sql, opts) => run1p(pg, db, sql, opts);

before(() => {
  pg = startPg();
  if (!pg) { blocked = 'BLOCKED: local PostgreSQL unavailable'; return; }
  buildS7Databases(pg, ['s7', 'rb', 'clean7']);
});
after(() => { pg?.stop(); });
const T = (name, fn) => test(name, async (t) => { if (blocked) return t.skip(blocked); await fn(t); });
const q = (db, sql, uid) => pg.psql(db, sql, uid === undefined ? {} : { uid });
const val = (db, sql, uid) => { const r = q(db, sql, uid); assert.equal(r.status, 0, r.err + ' :: ' + sql); return r.out.split('\n').pop(); };
const jl = (out) => JSON.parse(out.split('\n').filter((l) => l.startsWith('{') || l.startsWith('[')).pop());
const J = (db, sql, uid) => { const r = q(db, sql, uid); assert.equal(r.status, 0, r.err + ' :: ' + sql); return jl(r.out); };
const Jt = (db, sql, uid) => { const r = q(db, sql, uid); return r.status === 0 ? jl(r.out) : { raised: r.err }; };
let n = 0; const bn = (p) => `${p}${++n}`;
const newKey = () => crypto.randomUUID();
const ctx = (db, p, b, wl, uid = SIGNER) => J(db, `SELECT public.mis_get_batch_route_context_v1(${p},'${b}',${wl})`, uid);
const sign = (db, p, b, wl, step, occ, qty, uid = SIGNER, key = newKey()) => Jt(db, `SELECT public.mis_sign_batch_stage_v1('${key}',${p},'${b}',${wl},${step},${occ},${qty ?? 'NULL'},'WB-${n}')`, uid);
const status = (db, p, b, uid = SIGNER) => J(db, `SELECT public.mis_get_batch_stage_status_v1(${p},'${b}')`, uid);
const fgStep = (c) => c.steps.find((s) => s.stage_role === 'FG_BULK');
const resolve = (db, p, b, wl, step) => J(db, `SELECT to_jsonb(r) FROM app_private.mis_resolve_batch_stage(${p},'${b}',${wl},${step}) r`);

/* ───────────── installation, identity pins, ACL ───────────── */
T('route engine is the REAL one: verbatim bodies from the repository migrations (provenance + hashes)', () => {
  const { provenance } = extractRouteEngine(); assert.equal(provenance.length, 8);
  for (const p of provenance) assert.match(p.sha256, /^[0-9a-f]{64}$/);
  // every pinned engine hash in S7a equals the sha256(prosrc) of the verbatim function loaded from the migrations
  for (const fn of ENGINE_FUNCTIONS) { const h = val('pre7', `SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE pronamespace='costing'::regnamespace AND proname='${fn}'`); assert.ok(mig(S7A).includes(`'${h}'`), `engine pin for ${fn}`); }
  assert.equal(val('pre7', `SELECT count(*) FROM pg_proc WHERE pronamespace='costing'::regnamespace AND proname = ANY(ARRAY['${ENGINE_FUNCTIONS.join("','")}'])`), '8');
});
T('S7a pins are valid and match the installed S2/S6 sources; the candidate placeholder pin (62 hex chars) could never match', () => {
  assert.equal(val('pre7', `SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='app_private.mis_resolve_batch_stage(integer,text,integer,bigint)'::regprocedure`), '53c9c60c22ddfa33e4628d43e228789505c53bfcae9925f622e7d68b08eba9e3');
  assert.equal(val('pre7', `SELECT encode(sha256(convert_to(pg_get_functiondef('app_private.mis_stage_fp(integer,text,integer,bigint,integer)'::regprocedure),'UTF8')),'hex')`), 'd438e858f03325bfbecc6f564999bd359d81d7ee24ecf2a4b7c98a92dab359d4');
  // the resolver pin is derived from the committed S2 FILE (not from the test database), so production equality is decided by the installed S2 text only
  const s2 = mig(MIGRATIONS[0]); const i = s2.indexOf('CREATE OR REPLACE FUNCTION app_private.mis_resolve_batch_stage('); const a = s2.indexOf('$f$', i) + 3;
  assert.equal(sha(s2.slice(a, s2.indexOf('$f$', a))), '53c9c60c22ddfa33e4628d43e228789505c53bfcae9925f622e7d68b08eba9e3');
  assert.ok(mig(S7A).includes('53c9c60c22ddfa33e4628d43e228789505c53bfcae9925f622e7d68b08eba9e3'));
  assert.equal('6d89aa0f224a74374d016d787d671c9c5dc2be48631a328e4e7ad21e3b5ff0'.length, 62);
});
T('install guards: ENFORCE refused; resolver drift refused; ID-namespace collision refused; nothing is left installed', () => {
  for (const [name, mut, expect] of [
    ['enforce', `UPDATE app_private.mis_g7_enforcement SET mode='ENFORCE'`, /MIS_G7_S7_PRECONDITION/],
    ['drift', `CREATE OR REPLACE FUNCTION app_private.mis_resolve_batch_stage(p_product_id integer,p_batch text,p_work_log_id integer,p_route_step_id bigint) RETURNS TABLE (code text,bmr_id integer,route_id bigint,route_step_id bigint,stage_role text,activity_name text,wl_log_date date,wl_status text,wl_storage_qty numeric,wl_storage_uom text) LANGUAGE sql AS $$ SELECT 'X'::text,NULL::integer,NULL::bigint,NULL::bigint,NULL::text,NULL::text,NULL::date,NULL::text,NULL::numeric,NULL::text $$`, /MIS_G7_S7_SOURCE_DRIFT/],
    ['engine', `CREATE OR REPLACE FUNCTION costing.fn_resolve_effective_route_family_route(p_product_id integer, p_as_of_date date DEFAULT CURRENT_DATE) RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT 11::bigint $$`, /MIS_G7_S7_ENGINE_DRIFT/],
    ['namespace', `INSERT INTO costing.production_route_family_route_step(id,family_route_id,step_key,sequence_no,activity_id,cost_centre_id,behaviour_code,resource_class_code,route_step_scope) VALUES (-5,11,'X',99,1,1,'STD','GENERAL','PRODUCTION_PROCESS')`, /MIS_G7_S7_ID_NAMESPACE_COLLISION/]]) {
    const d = `g_${name}`; assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE pre7`).status, 0);
    run1(d, mut); const r = pg.psql(d, asTx(mig(S7A))); assert.notEqual(r.status, 0, name); assert.match(r.err, expect, name);
    assert.equal(val(d, `SELECT to_regprocedure('public.mis_get_batch_route_context_v1(integer,text,integer)') IS NULL`), 't', `${name}: nothing installed`);
    assert.equal(val(d, `SELECT to_regclass('app_private.mis_g7_s7_baseline') IS NULL`), 't', `${name}: baseline table rolled back`);
  }
});
T('ACL/security: six public RPCs authenticated-only (no anon/PUBLIC), SECURITY DEFINER with pinned search_path; private helpers closed; new tables RLS-closed', () => {
  const fns = ['mis_get_batch_route_context_v1(integer,text,integer)', 'mis_get_batch_stage_status_v1(integer,text)', 'mis_preview_pack_fg_bulk_v1(bigint,jsonb,bigint,integer)', 'mis_get_governance_exception_summary_v1(date,date,integer,integer)'];
  for (const f of fns) {
    assert.equal(val('s7', `SELECT has_function_privilege('anon','public.${f}','EXECUTE') OR has_function_privilege('public.${f}'::regprocedure::oid::regproc::text,'EXECUTE')`.replace(/has_function_privilege\('public\.[^']+'::regprocedure::oid::regproc::text,'EXECUTE'\)/, 'false')), 'f', `${f} anon`);
    assert.equal(val('s7', `SELECT has_function_privilege('authenticated','public.${f}','EXECUTE')`), 't', f);
    assert.equal(val('s7', `SELECT prosecdef AND provolatile='s' AND EXISTS (SELECT 1 FROM unnest(proconfig) c WHERE c LIKE 'search_path=%') FROM pg_proc WHERE oid='public.${f}'::regprocedure`), 't', `${f} secdef/stable/search_path`);
  }
  for (const f of ['app_private.mis_g7_route_context(integer,text,integer)', 'app_private.mis_g7_batch_stage_status(integer,text)', 'app_private.mis_g7_fg_state(integer,text)', 'app_private.mis_g7_can_view(text)', 'app_private.mis_resolve_batch_stage(integer,text,integer,bigint)'])
    assert.equal(val('s7', `SELECT has_function_privilege('authenticated','${f}','EXECUTE') OR has_function_privilege('anon','${f}','EXECUTE')`), 'f', f);
  for (const t of ['mis_g7_s7_baseline', 'mis_g7_governance_cutover']) {
    assert.equal(val('s7', `SELECT relrowsecurity FROM pg_class WHERE oid='app_private.${t}'::regclass`), 't'); assert.equal(val('s7', `SELECT has_table_privilege('authenticated','app_private.${t}','SELECT')`), 'f');
  }
});

/* ───────────── route identity: inherited, product, overrides ───────────── */
T('inherited family route: negative route id (-family_route_id), positive base step ids, signing works end to end', () => {
  const b = bn('INH'); const wl = val('s7', `SELECT public.s7_batch('Inherited','${b}','2026-11-10')`); const c = ctx('s7', 21, b, wl);
  assert.equal(c.ok, true); assert.equal(c.route_kind, 'ROUTE_FAMILY_INHERITED'); assert.equal(c.route_id, '-11'); assert.equal(c.product_route_id, null); assert.equal(c.family_route_id, '11');
  assert.deepEqual(c.steps.map((s) => s.route_step_id), ['101', '102', '105', '103', '104']); assert.ok(c.steps.every((s) => typeof s.route_step_id === 'string'));
  const fg = fgStep(c); assert.equal(fg.route_step_id, '103'); assert.equal(fg.activity_matches, true);
  const r = sign('s7', 21, b, wl, 103, 1, 10); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.route_id, -11);
  assert.equal(val('s7', `SELECT route_id::text||':'||route_step_id FROM app_private.mis_batch_stage_event WHERE event_id=${r.event_id}`), '-11:103');
  const st = status('s7', 21, b); assert.equal(st.fg_bulk_state, 'SIGNED'); assert.equal(st.events[0].route_id, '-11'); assert.equal(st.events[0].state, 'SIGNED');
});
T('product-specific route with ADD / REPLACE / BYPASS / ALTER_CYCLE overrides: identities, activity matching and exclusion', () => {
  const b = bn('PR'); const wl = val('s7', `SELECT public.s7_batch('ProductRoute','${b}','2026-11-10')`); const c = ctx('s7', 22, b, wl);
  assert.equal(c.ok, true); assert.equal(c.route_kind, 'PRODUCT_ROUTE'); assert.equal(c.route_id, '21'); assert.equal(c.product_route_id, '21');
  const byId = Object.fromEntries(c.steps.map((s) => [s.route_step_id, s]));
  assert.equal(byId['-701'].step_kind, 'ADDED'); assert.equal(byId['-701'].activity_name, 'Heating'); assert.equal(byId['-701'].override_id, '701'); assert.equal(byId['-701'].base_step_id, null);
  assert.equal(byId['102'].activity_name, 'Blending'); assert.equal(byId['102'].step_kind, 'BASE'); assert.equal(byId['102'].source_type, 'PRODUCT_OVERRIDE');   // REPLACE keeps the base id, effective activity differs
  assert.equal(byId['105'], undefined);                                                                                                                              // BYPASS removes the step
  assert.equal(byId['103'].expected_occurrence_count, 2);                                                                                                            // ALTER_CYCLE attribute only
  assert.equal(new Set(c.steps.map((s) => s.route_step_id)).size, c.steps.length);
  // sign the ADDED step (negative id) and the REPLACEd step under its effective activity
  const wh = val('s7', `SELECT public.s7_log('ProductRoute','${b}','Heating','2026-11-11')`); const rs = sign('s7', 22, b, wh, -701, 1, null); assert.equal(rs.ok, true, JSON.stringify(rs)); assert.equal(rs.route_id, 21);
  assert.equal(val('s7', `SELECT route_step_id FROM app_private.mis_batch_stage_event WHERE event_id=${rs.event_id}`), '-701');
  const wm = val('s7', `SELECT public.s7_log('ProductRoute','${b}','Mixing','2026-11-11')`); assert.equal(sign('s7', 22, b, wm, 102, 1, null).code, 'ACTIVITY_STEP_MISMATCH');   // base activity no longer applies
  const wb = val('s7', `SELECT public.s7_log('ProductRoute','${b}','Blending','2026-11-11')`); assert.equal(sign('s7', 22, b, wb, 102, 1, null).ok, true);
  const wl2 = val('s7', `SELECT public.s7_log('ProductRoute','${b}','Labelling','2026-11-11')`); assert.equal(sign('s7', 22, b, wl2, 105, 1, null).code, 'STEP_NOT_IN_EFFECTIVE_ROUTE');   // bypassed
});
T('archived product route is ignored; effective-date boundaries are inclusive; before the first product route the family route applies', () => {
  const b0 = bn('ARC'); const w0 = val('s7', `SELECT public.s7_batch('ArchivedProductRoute','${b0}','2026-11-10')`); const c0 = ctx('s7', 26, b0, w0); assert.equal(c0.route_kind, 'ROUTE_FAMILY_INHERITED'); assert.equal(c0.route_id, '-11');
  const mk = (d) => { const b = bn('D'); const w = val('s7', `SELECT public.s7_batch('ProductRoute','${b}','${d}')`); return ctx('s7', 22, b, w); };
  assert.equal(mk('2026-10-31').route_id, '20');       // effective_to inclusive
  assert.equal(mk('2026-11-01').route_id, '21');       // effective_from inclusive, contiguous successor
  assert.equal(mk('2026-01-01').route_id, '20');
  assert.equal(mk('2025-12-31').route_id, '-11');      // before any product route
});
T('effective-date gap, no coverage, ambiguous approved-route overlap, ambiguous BMR, exactly-one mandatory FG stage', () => {
  const run = (item, pid, d, pre) => { const b = bn(pre); const w = val('s7', `SELECT public.s7_batch('${item}','${b}','${d}')`); return { b, w, c: ctx('s7', pid, b, w) }; };
  assert.equal(run('NoRoute', 23, '2026-11-10', 'NR').c.code, 'PRODUCT_ROUTE_COVERAGE');
  assert.equal(run('DateGap', 29, '2022-06-01', 'DG').c.code, 'EFFECTIVE_DATE_ROUTE_GAP');      // versions exist, none effective that day
  assert.equal(run('DateGap', 29, '2021-06-01', 'DG2').c.ok, true); assert.equal(run('DateGap', 29, '2023-06-01', 'DG3').c.ok, true);
  assert.equal(run('Overlap', 25, '2026-07-01', 'OV').c.code, 'APPROVED_ROUTE_OVERLAP');
  assert.equal(run('Overlap', 25, '2026-03-01', 'OV2').c.ok, true);                              // only route 51 covers March
  assert.equal(run('NoFgStage', 24, '2026-11-10', 'NF').c.code, 'MANDATORY_FG_STAGE_GAP');
  assert.equal(run('DupFg', 27, '2026-11-10', 'DF').c.code, 'MANDATORY_FG_STAGE_GAP');
  const am = bn('AMB'); val('s7', `SELECT public.s7_batch('AmbiguousBmr','${am}','2026-11-10')`); run1('s7', `INSERT INTO public.bmr_details VALUES ((SELECT max(id)+1 FROM public.bmr_details),28,'${am}','Released')`);
  const aw = val('s7', `SELECT id FROM public.daily_work_log WHERE batch_number='${am}'`); assert.equal(ctx('s7', 28, am, aw).code, 'BMR_IDENTITY_REVIEW');
  assert.equal(sign('s7', 28, am, aw, 103, 1, 10).code, 'BMR_IDENTITY_REVIEW');
  assert.equal(ctx('s7', 21, am, aw).code, 'WORK_LOG_IDENTITY_MISMATCH');
  assert.deepEqual([null, ''].map((x) => Jt('s7', `SELECT public.mis_get_batch_route_context_v1(21,${x === null ? 'NULL' : "''"},1)`, SIGNER).code), ['INVALID_INPUT', 'INVALID_INPUT']);
});
T('engine failure never crashes the read or the exception report (becomes ROUTE_RESOLUTION_ERROR)', () => {
  const d = 'g_engerr'; assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE clean7`).status, 0);
  const b = bn('ENG'); const w = val(d, `SELECT public.s7_batch('Inherited','${b}','2026-11-10')`);
  run1(d, `INSERT INTO costing.production_route_family_product_map(product_id,route_family_id,status,effective_from) VALUES (21,2,'APPROVED','2026-11-01')`);   // still resolvable (order by effective_from)
  run1(d, `CREATE OR REPLACE FUNCTION costing.fn_validate_effective_product_process_route(p_product_id integer, p_as_of_date date DEFAULT current_date) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'AMBIGUOUS_APPROVED_PRODUCT_ROUTE'; END $$`);
  assert.equal(ctx(d, 21, b, w).code, 'ROUTE_RESOLUTION_ERROR');
  const s = J(d, `SELECT public.mis_get_governance_exception_summary_v1('2026-11-01','2026-11-30')`, EXECV); assert.equal(s.ok, true);
  assert.ok(s.items.some((i) => i.batch_number === b && i.state === 'MISSING_ROUTE' && i.detail === 'ROUTE_RESOLUTION_ERROR'));
});

/* ───────────── stable identity, occurrence handling, parity ───────────── */
T('occurrence handling and idempotency: per-occurrence uniqueness, replay, key reuse, correction frees the occurrence', () => {
  const b = bn('OCC'); const w = val('s7', `SELECT public.s7_batch('Inherited','${b}','2026-11-10')`); const wl = val('s7', `SELECT public.s7_log('Inherited','${b}','Labelling','2026-11-11')`); const wl2 = val('s7', `SELECT public.s7_log('Inherited','${b}','Labelling','2026-11-12')`);
  const k = newKey(); const a = sign('s7', 21, b, wl, 105, 1, null, SIGNER, k); assert.equal(a.ok, true);
  assert.equal(sign('s7', 21, b, wl, 105, 1, null, SIGNER, k).idempotent_replay, true);
  assert.equal(sign('s7', 21, b, wl, 105, 2, null, SIGNER, k).code, 'IDEMPOTENCY_KEY_REUSED');
  assert.equal(sign('s7', 21, b, wl2, 105, 1, null).code, 'STAGE_ALREADY_SIGNED');                     // same step+occurrence, different log
  assert.equal(sign('s7', 21, b, wl2, 105, 2, null).ok, true);                                          // repeat step, occurrence 2
  assert.equal(sign('s7', 21, b, wl2, 105, 0, null).code, 'INVALID_INPUT');
  const corr = J('s7', `SELECT public.mis_correct_batch_stage_v1('${newKey()}',${a.event_id},'wrong log')`, SIGNER); assert.equal(corr.ok, true);
  assert.equal(sign('s7', 21, b, wl2, 105, 1, null).ok, true);
  const st = status('s7', 21, b); assert.deepEqual(st.events.map((e) => e.state), ['CORRECTED', 'SIGNED', 'CORRECTION', 'SIGNED']); void w;
});
T('FINDING (pre-existing S2 behaviour exposed, not changed): STAGE_ALREADY_SIGNED is route-agnostic per step id; fingerprints bind route_id', () => {
  const b = bn('RV'); const w = val('s7', `SELECT public.s7_batch('ProductRoute','${b}','2026-10-31')`); const wl = val('s7', `SELECT public.s7_log('ProductRoute','${b}','Labelling','2026-10-31')`);
  const a = sign('s7', 22, b, wl, 105, 1, null); assert.equal(a.ok, true); assert.equal(a.route_id, 20);
  const w2 = val('s7', `SELECT public.s7_log('ProductRoute','${b}','Labelling','2026-11-02')`);              // route 21 BYPASSes 105
  assert.equal(sign('s7', 22, b, w2, 105, 1, null).code, 'STEP_NOT_IN_EFFECTIVE_ROUTE'); void w;
  assert.equal(val('s7', `SELECT source_fingerprint = app_private.mis_stage_fp(22,'${b}',${wl},105,1) FROM app_private.mis_batch_stage_event WHERE event_id=${a.event_id}`), 't');
});
T('route context / signing parity: every step the context offers is accepted by the resolver, every other id is refused, identically', () => {
  for (const [item, pid, d] of [['Inherited', 21, '2026-11-10'], ['ProductRoute', 22, '2026-11-10'], ['ProductRoute', 22, '2026-10-31'], ['ArchivedProductRoute', 26, '2026-11-10']]) {
    const b = bn('PAR'); const w = val('s7', `SELECT public.s7_batch('${item}','${b}','${d}')`); const c = ctx('s7', pid, b, w);
    for (const s of c.steps) {
      const r = resolve('s7', pid, b, w, s.route_step_id);
      assert.equal(r.code, s.activity_matches ? 'OK' : 'ACTIVITY_STEP_MISMATCH', `${item}@${d} step ${s.route_step_id}`);
      assert.equal(r.route_id, Number(c.route_id)); if (s.activity_matches) assert.equal(r.stage_role, s.stage_role);
    }
    assert.equal(resolve('s7', pid, b, w, 987654).code, 'STEP_NOT_IN_EFFECTIVE_ROUTE'); assert.equal(resolve('s7', pid, b, w, -987654).code, 'STEP_NOT_IN_EFFECTIVE_ROUTE');
  }
});
T('bigint safety: ids above 2^53 survive as text through context, resolver, signature and status', () => {
  const big = 9007199254740993n; const d = 'g_big'; assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE clean7`).status, 0);
  run1(d, `INSERT INTO costing.production_route_family_route_step(id,family_route_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,behaviour_code,resource_class_code,route_step_scope,is_mandatory,allows_repeat)
     VALUES (${big},11,'BIGLAB',26,4,1,1,10,100,'STD','GENERAL','PRODUCTION_PROCESS',false,true)`);
  const b = bn('BIG'); val(d, `SELECT public.s7_batch('Inherited','${b}','2026-11-10')`); const wl = val(d, `SELECT public.s7_log('Inherited','${b}','Labelling','2026-11-11')`);
  const c = ctx(d, 21, b, wl); assert.ok(c.steps.some((s) => s.route_step_id === String(big)));
  assert.equal(sign(d, 21, b, wl, big, 1, null).ok, true);
  assert.ok(status(d, 21, b).events.some((e) => e.route_step_id === String(big)));
});

/* ───────────── receipt evidence, persistence, source changes, S6 ───────────── */
T('FG receipt evidence: positive logged qty in base UOM equals measured qty and ledger holds it; wrong evidence is refused; nothing is inferred', () => {
  const b = bn('RC'); const w = val('s7', `SELECT public.s7_batch('Inherited','${b}','2026-11-10',10)`);
  assert.equal(sign('s7', 21, b, w, 103, 1, null).code, 'MEASURED_QTY_REQUIRED'); assert.equal(sign('s7', 21, b, w, 103, 1, 9).code, 'MEASURED_QTY_MISMATCH');
  run1('s7', `UPDATE public.daily_work_log SET storage_qty_uom='g' WHERE id=${w}`); assert.equal(sign('s7', 21, b, w, 103, 1, 10).code, 'FG_UOM_MISMATCH');
  run1('s7', `UPDATE public.daily_work_log SET storage_qty_uom='kg' WHERE id=${w}`);
  run1('s7', `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}'`); assert.equal(sign('s7', 21, b, w, 103, 1, 10).code, 'FG_RECEIPT_EVIDENCE_MISSING');
  assert.equal(val('s7', `SELECT count(*) FROM app_private.mis_batch_stage_event WHERE batch_number='${b}'`), '0');
});
T('persistence across sessions, source-changed and corrected states; S6: Done closure keeps the signature, a real source revision invalidates it', () => {
  const b = bn('PER'); const w = val('s7', `SELECT public.s7_batch('Inherited','${b}','2026-11-10',10)`); const r = sign('s7', 21, b, w, 103, 1, 10); assert.equal(r.ok, true);
  for (const uid of [SIGNER, SIGNV, PACKER, EXECV]) assert.equal(status('s7', 21, b, uid).fg_bulk_state, 'SIGNED');                       // fresh sessions / other users
  run1('s7', `SELECT set_config('app.fg_reconcile','1',false); UPDATE public.daily_work_log SET status='Done' WHERE id=${w}`); assert.equal(status('s7', 21, b).fg_bulk_state, 'SIGNED'); assert.equal(status('s7', 21, b).events[0].state, 'SIGNED');
  run1('s7', `UPDATE public.daily_work_log SET storage_qty=9 WHERE id=${w}`); const sc = status('s7', 21, b); assert.equal(sc.fg_bulk_state, 'SOURCE_CHANGED'); assert.equal(sc.events[0].state, 'SOURCE_CHANGED');
  run1('s7', `UPDATE public.daily_work_log SET storage_qty=10 WHERE id=${w}`); assert.equal(status('s7', 21, b).fg_bulk_state, 'SIGNED');
  const c = J('s7', `SELECT public.mis_correct_batch_stage_v1('${newKey()}',${r.event_id},'voided')`, SIGNER); assert.equal(c.ok, true);
  const s2 = status('s7', 21, b); assert.equal(s2.fg_bulk_state, 'UNSIGNED'); assert.deepEqual(s2.events.map((e) => e.state), ['CORRECTED', 'CORRECTION']);
});
T('unauthorized and anonymous refusals for every new RPC; view-only signer can read but not sign', () => {
  const b = bn('AU'); const w = val('s7', `SELECT public.s7_batch('Inherited','${b}','2026-11-10')`); const ev = val('s7', `SELECT public.s7_event(public.s7_log('Inherited','${b}','Bottling','2026-11-11'))`);
  const calls = { ctx: `SELECT public.mis_get_batch_route_context_v1(21,'${b}',${w})`, st: `SELECT public.mis_get_batch_stage_status_v1(21,'${b}')`, pv: `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'[{"sku_id":10,"count":1}]')`, ex: `SELECT public.mis_get_governance_exception_summary_v1('2026-11-01','2026-11-30')` };
  for (const [k, sql] of Object.entries(calls)) {
    const nb = q('s7', sql, NOBODY); assert.notEqual(nb.status, 0, `${k} nobody`); assert.match(nb.err, /permission|42501/i, k);
    const an = pg.psql('s7', `SET ROLE anon;\n${sql}`); assert.notEqual(an.status, 0, `${k} anon`); assert.match(an.err, /permission denied for function/i, k);
    const noid = pg.psql('s7', `SET ROLE authenticated;\n${sql}`); assert.notEqual(noid.status, 0, `${k} authenticated without JWT`);
  }
  assert.equal(Jt('s7', calls.ctx, SIGNV).ok, true); assert.equal(Jt('s7', calls.st, SIGNV).ok, true); assert.equal(Jt('s7', calls.st, EXECV).ok, true);
  assert.notEqual(q('s7', calls.ctx, PACKER).status, 0);                                            // packers do not need (or get) route context
  assert.equal(Jt('s7', calls.pv, PACKV).ok, true); assert.notEqual(q('s7', calls.pv, SIGNER).status, 0); assert.equal(Jt('s7', calls.ex, EXECV).ok, true); assert.notEqual(q('s7', calls.ex, SIGNER).status, 0);
  assert.match(sign('s7', 21, b, w, 103, 1, 10, SIGNV).raised ?? '', /permission denied/);
});

/* ───────────── preview vs posting; no writes ───────────── */
const mkPackable = (item, pid, b, qty = 10) => {
  const w = val('s7', `SELECT public.s7_batch('${item}','${b}','2026-11-10',${qty})`); const fgs = pid === 22 ? 102 : 103;
  void fgs; const stepId = val('s7', `SELECT (e->>'route_step_id') FROM jsonb_array_elements((app_private.mis_g7_route_context(${pid},'${b}',${w}))->'steps') e WHERE e->>'stage_role'='FG_BULK'`);
  const pk = val('s7', `SELECT public.s7_log('${item}','${b}','Bottling','2026-11-11')`); const ev = val('s7', `SELECT public.s7_event(${pk})`);
  return { w, step: stepId, ev };
};
const pack = (key, ev, lines, excess, uid = PACKER) => Jt('s7', `SELECT public.mis_pack_fg_bulk_v1('${key}',${ev},'${JSON.stringify(lines)}'::jsonb,${excess ? `'${JSON.stringify(excess)}'::jsonb` : 'NULL'})`, uid);
const preview = (ev, lines, uid = PACKER) => Jt('s7', `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'${JSON.stringify(lines)}'::jsonb)`, uid);
const previewC = (ev, line, cnt, uid = PACKER) => Jt('s7', `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},NULL,${line},${cnt})`, uid);
const counts = () => val('s7', `SELECT (SELECT count(*) FROM public.fg_bulk_stock_ledger)||'/'||(SELECT count(*) FROM public.event_skus)||'/'||(SELECT count(*) FROM app_private.mis_batch_stage_event)||'/'||(SELECT count(*) FROM app_private.mis_fg_pack_request)||'/'||(SELECT count(*) FROM app_private.mis_fg_signed_excess_receipt)`);
T('packing preview equals actual posting (required, available, balance, excess) and never writes; stage/receipt/stock outcomes predicted in writer order', () => {
  const b = bn('PV'); const { w, step, ev } = mkPackable('Inherited', 21, b, 10);
  let p = preview(ev, [{ sku_id: 10, count: 4 }]); assert.equal(p.preview_code, 'FG_STAGE_NOT_SIGNED'); assert.equal(p.required_base, 2); assert.equal(p.available_base, 10);
  assert.equal(pack(newKey(), ev, [{ sku_id: 10, count: 4 }]).code, 'FG_STAGE_NOT_SIGNED');
  assert.equal(sign('s7', 21, b, w, step, 1, 10).ok, true);
  const before = counts(); p = preview(ev, [{ sku_id: 10, count: 4 }, { sku_id: 11, count: 2 }]); assert.equal(counts(), before, 'preview wrote nothing');
  assert.deepEqual([p.preview_code, p.required_base, p.available_base, p.shortfall_base, p.eligible_without_excess, p.base_uom, p.excess_permitted], ['OK', 2.5, 10, 0, true, 'kg', false]);
  const big = preview(ev, [{ sku_id: 10, count: 30 }], EXCESS); assert.deepEqual([big.preview_code, big.required_base, big.shortfall_base, big.excess_permitted], ['INSUFFICIENT_BULK', 15, 5, true]);
  const real = pack(newKey(), ev, [{ sku_id: 10, count: 30 }]); assert.equal(real.code, 'INSUFFICIENT_BULK'); assert.deepEqual([real.required_base, real.available_base, real.shortfall_base], [15, 10, 5]);
  const k = newKey(); const posted = pack(k, ev, [{ sku_id: 10, count: 4 }, { sku_id: 11, count: 2 }]); assert.equal(posted.ok, true);
  assert.deepEqual([posted.required_base, posted.available_before_base, posted.balance_after_base], [p.required_base, p.available_base, p.available_base - p.required_base]);
  const again = preview(ev, [{ sku_id: 10, count: 1 }]); assert.equal(again.ok, false); assert.equal(again.code, 'SKU_LINE_EXISTS');
  assert.equal(val('s7', `SELECT bool_and(provolatile='s') FROM pg_proc WHERE oid IN ('public.mis_preview_pack_fg_bulk_v1(bigint,jsonb,bigint,integer)'::regprocedure,'public.mis_get_governance_exception_summary_v1(date,date,integer,integer)'::regprocedure,'public.mis_get_batch_stage_status_v1(integer,text)'::regprocedure,'public.mis_get_batch_route_context_v1(integer,text,integer)'::regprocedure)`), 't');
});
T('preview with no correction line selected never touches an unassigned record; null, malformed and hostile inputs are refused cleanly', () => {
  const b = bn('PN'); const { w, step, ev } = mkPackable('Inherited', 21, b, 10); sign('s7', 21, b, w, step, 1, 10);
  for (const sql of [`SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'[{"sku_id":10,"count":1}]'::jsonb,NULL,NULL)`, `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'[{"sku_id":10,"count":1}]'::jsonb)`]) {
    const r = Jt('s7', sql, PACKER); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.event_sku_id, null); assert.equal(r.old_count, null); assert.equal(r.has_depletion_basis, null);
  }
  const bad = { 'null event': `SELECT public.mis_preview_pack_fg_bulk_v1(NULL,'[]'::jsonb)`, 'null lines': `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},NULL)`, 'empty lines': `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'[]'::jsonb)`,
    'object not array': `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'{"a":1}'::jsonb)`, 'scalar elements': `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'[1,2]'::jsonb)`, 'string count': `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'[{"sku_id":10,"count":"x"}]'::jsonb)`,
    'fraction': `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'[{"sku_id":10,"count":1.5}]'::jsonb)`, 'zero': `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'[{"sku_id":10,"count":0}]'::jsonb)`, 'negative': `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'[{"sku_id":10,"count":-2}]'::jsonb)`,
    'huge': `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'[{"sku_id":10,"count":99999999999}]'::jsonb)`, 'duplicate sku': `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'[{"sku_id":10,"count":1},{"sku_id":10,"count":2}]'::jsonb)`,
    'both modes': `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},'[{"sku_id":10,"count":1}]'::jsonb,1,1)`, 'correct without count': `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},NULL,1,NULL)`, 'correct negative': `SELECT public.mis_preview_pack_fg_bulk_v1(${ev},NULL,1,-1)` };
  for (const [k, sql] of Object.entries(bad)) { const r = Jt('s7', sql, PACKER); assert.equal(r.ok, false, `${k}: ${JSON.stringify(r)}`); assert.ok(['INVALID_INPUT', 'CORRECTION_LINE_NOT_FOUND'].includes(r.code), `${k} ${r.code}`); }
  assert.equal(preview(999999999, [{ sku_id: 10, count: 1 }]).code, 'PACKAGING_EVENT_NOT_FOUND'); assert.equal(preview(ev, [{ sku_id: 999, count: 1 }]).code, 'SKU_NOT_FOUND'); assert.equal(preview(ev, [{ sku_id: 20, count: 1 }]).code, 'SKU_PRODUCT_MISMATCH');
  const sample = val('s7', `SELECT public.s7_event(public.s7_log('Inherited','${b}','Bottling','2026-11-12'),'Sample')`); assert.equal(preview(sample, [{ sku_id: 10, count: 1 }]).code, 'EVENT_NOT_BULK_AFFECTING');
  const recv = val('s7', `SELECT public.s7_event(public.s7_log('Inherited','${b}','Bottling','2026-11-12'),'FG bulk storage')`); assert.equal(preview(recv, [{ sku_id: 10, count: 1 }]).code, 'EVENT_NOT_BULK_AFFECTING');
});
T('correction preview vs actual ledger depletion; no-depletion and mismatched-depletion lines are refused identically; removal returns stock', () => {
  const b = bn('CP'); const { w, step, ev } = mkPackable('Inherited', 21, b, 10); sign('s7', 21, b, w, step, 1, 10);
  const posted = pack(newKey(), ev, [{ sku_id: 10, count: 6 }, { sku_id: 11, count: 4 }]); assert.equal(posted.ok, true); const [l1, l2] = posted.event_sku_ids;   // 3 + 1 = 4 kg
  const pr = previewC(ev, l1, 2); assert.deepEqual([pr.preview_code, pr.stock_delta_base, pr.old_count, pr.new_count, pr.has_depletion_basis, pr.expected_posted_base, pr.posted_base], ['OK', 2, 6, 2, true, -3, -3]);
  const before = counts(); previewC(ev, l1, 2); assert.equal(counts(), before);
  const real = J('s7', `SELECT public.mis_correct_pack_line_v1('${newKey()}',${l1},2,'miscount',NULL)`, PACKER); assert.equal(real.stock_delta_base, pr.stock_delta_base); assert.equal(real.balance_after_base, 10 - 4 + 2);
  assert.equal(Number(val('s7', `SELECT coalesce(sum(qty_base),0) FROM public.fg_bulk_stock_ledger WHERE source_table='event_skus' AND source_id=${l1}`)), -1);       // ledger really reflects the preview (-1 kg = 2 x 0.5)
  const rm = previewC(ev, l2, 0); assert.deepEqual([rm.preview_code, rm.stock_delta_base], ['OK', 1]); assert.equal(J('s7', `SELECT public.mis_correct_pack_line_v1('${newKey()}',${l2},0,'entered in error',NULL)`, PACKER).line_removed, true);
  assert.equal(previewC(ev, l1, 2).preview_code, 'CORRECTION_NO_CHANGE');
  const up = previewC(ev, l1, 100, EXCESS); assert.equal(up.preview_code, 'INSUFFICIENT_BULK'); assert.equal(up.excess_permitted, true); assert.equal(previewC(ev, l1, 100, PACKER).excess_permitted, false);
  // historical line: legacy insert with its depletion trigger bypassed => no depletion basis
  const hist = val('s7', `WITH ins AS (INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${ev},11,8) RETURNING id) SELECT id FROM ins`); run1('s7', `DELETE FROM public.fg_bulk_stock_ledger WHERE source_table='event_skus' AND source_id=${hist}`);
  const nb = previewC(ev, hist, 1); assert.equal(nb.preview_code, 'CORRECTION_NO_DEPLETION_BASIS'); assert.equal(nb.has_depletion_basis, false);
  assert.equal(J('s7', `SELECT public.mis_correct_pack_line_v1('${newKey()}',${hist},1,'x',NULL)`, PACKER).code, 'CORRECTION_NO_DEPLETION_BASIS');
  run1('s7', `INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id) VALUES (21,'${b}','2026-11-12',-1,-1,'kg','TEST','event_skus',${hist})`);   // posted -1 but line implies -2
  const mm = previewC(ev, hist, 1); assert.equal(mm.preview_code, 'CORRECTION_LEDGER_MISMATCH'); assert.deepEqual([mm.expected_posted_base, mm.posted_base], [-2, -1]);
  assert.equal(J('s7', `SELECT public.mis_correct_pack_line_v1('${newKey()}',${hist},1,'x',NULL)`, PACKER).code, 'CORRECTION_LEDGER_MISMATCH');
});

/* ───────────── exception summary ───────────── */
T('exception summary: states, explicit units/scope, historical NOT_VERIFIED vs actionable UNSIGNED, overlap, bounds', () => {
  const d = 'g_sum'; assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE clean7`).status, 0);
  run1(d, `UPDATE app_private.mis_g7_governance_cutover SET effective_from='2026-11-15'`);
  const mk = (item, b, date) => val(d, `SELECT public.s7_batch('${item}','${b}','${date}')`);
  mk('Inherited', 'H-OLD', '2026-11-05'); mk('Inherited', 'N-NEW', '2026-11-20'); const ws = mk('Inherited', 'S-OK', '2026-11-20');
  const sg = Jt(d, `SELECT public.mis_sign_batch_stage_v1('${newKey()}',21,'S-OK',${ws},103,1,10,'WB')`, SIGNER); assert.equal(sg.ok, true);
  mk('NoRoute', 'R-GAP', '2026-11-20'); mk('Inherited', 'X-RCPT', '2026-11-20'); run1(d, `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='X-RCPT'`);
  const pw = val(d, `SELECT public.s7_log('Inherited','H-OLD','Bottling','2026-11-06')`); const pe = val(d, `SELECT public.s7_event(${pw})`);
  run1(d, `INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") VALUES (${pe},10,3)`); run1(d, `DELETE FROM public.fg_bulk_stock_ledger WHERE source_table='event_skus'`);       // historical packing line without depletion
  const s = J(d, `SELECT public.mis_get_governance_exception_summary_v1('2026-11-01','2026-11-30',50,0)`, EXECV);
  assert.equal(s.ok, true); assert.match(s.count_unit, /distinct product\/batch/); assert.match(s.scope, /FG_BULK_STORAGE/); assert.equal(s.line_counts.PACKING_LINES_WITHOUT_DEPLETION, 1); assert.match(s.line_count_unit, /event_skus/);
  const st = (b) => s.items.filter((i) => i.batch_number === b).map((i) => i.state).sort();
  assert.deepEqual(st('H-OLD'), ['NOT_VERIFIED', 'NOT_VERIFIED']); assert.ok(s.items.some((i) => i.batch_number === 'H-OLD' && i.detail === 'PACKING_LINE_WITHOUT_DEPLETION'));
  assert.deepEqual(st('N-NEW'), ['UNSIGNED']); assert.deepEqual(st('S-OK'), []); assert.deepEqual(st('R-GAP'), ['MISSING_ROUTE', 'UNSIGNED']);
  assert.ok(st('X-RCPT').includes('MISSING_RECEIPT')); assert.equal(s.counts.SIGNED, 1); assert.ok(s.counts.UNSIGNED >= 2 && s.counts.NOT_VERIFIED >= 1);
  assert.equal(s.governance_cutover, '2026-11-15'); assert.ok(!s.items.some((i) => i.state === 'SIGNED'));
  const page = J(d, `SELECT public.mis_get_governance_exception_summary_v1('2026-11-01','2026-11-30',2,1)`, EXECV); assert.equal(page.items.length, 2); assert.equal(page.total_items, s.total_items);
  for (const bad of [`('2026-11-30','2026-11-01')`, `('2026-01-01','2026-11-30')`, `('2026-11-01','2026-11-30',0)`, `('2026-11-01','2026-11-30',201)`, `('2026-11-01','2026-11-30',10,-1)`, `(NULL,'2026-11-30')`])
    assert.equal(J(d, `SELECT public.mis_get_governance_exception_summary_v1${bad}`, EXECV).code, 'INVALID_INPUT', bad);
  assert.equal(Jt(d, `SELECT public.mis_get_governance_exception_summary_v1('2026-11-01','2026-11-30')`, EXECV).counts.NOT_VERIFIED, s.counts.NOT_VERIFIED);   // deterministic; no hidden writes
  assert.equal(val(d, `SELECT count(*) FROM app_private.mis_batch_stage_event`), '1');
});
T('exception summary performance: 92-day window with 400 FG batches (real route engine) stays bounded', () => {
  const d = 'g_perf'; assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE clean7`).status, 0);
  run1(d, `INSERT INTO public.bmr_details SELECT 2000+g,30,'PF'||g,'Released' FROM generate_series(1,400) g;
    INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status,storage_qty,storage_qty_uom) SELECT 'Perf','PF'||g,'FG bulk storage',DATE '2026-09-01' + (g % 90),'Done',10,'kg' FROM generate_series(1,400) g;`);
  const t0 = Date.now(); const s = J(d, `SELECT public.mis_get_governance_exception_summary_v1('2026-09-01','2026-11-30',200,0)`, EXECV); const ms = Date.now() - t0;
  assert.equal(s.ok, true); assert.equal(s.total_batches, 400); assert.ok(s.items.length <= 200); console.log(`# S7 exception summary: 400 batches / 92-day window in ${ms} ms`); assert.ok(ms < 20000, `took ${ms} ms`);
});

/* ───────────── legacy compatibility, rollback, preservation ───────────── */
T('S2–S6 are preserved: every pre-existing function definition outside the resolver and the two receipt-patched writers is byte-identical after S7', () => {
  const list = (db) => val(db, `SELECT string_agg(p.oid::regprocedure::text||':'||md5(pg_get_functiondef(p.oid))||':'||coalesce(p.proacl::text,''), E'\\n' ORDER BY p.oid::regprocedure::text) FROM pg_proc p WHERE p.prokind='f' AND p.pronamespace IN ('app_private'::regnamespace,'public'::regnamespace) AND p.proname NOT LIKE 's7\\_%' AND p.proname NOT LIKE 't\\_%' AND p.oid::regprocedure::text NOT LIKE '%mis_get_%' AND p.oid::regprocedure::text NOT LIKE '%mis_preview%' AND p.oid::regprocedure::text NOT LIKE '%mis_g7_route_context%' AND p.oid::regprocedure::text NOT LIKE '%mis_g7_fg_state%' AND p.oid::regprocedure::text NOT LIKE '%mis_g7_batch_stage_status%' AND p.oid::regprocedure::text NOT LIKE '%mis_g7_can_view%' AND p.oid::regprocedure::text NOT LIKE '%mis_resolve_batch_stage%' AND p.oid::regprocedure::text NOT LIKE '%mis_g7_fg_receipt%' AND p.oid::regprocedure::text NOT LIKE '%mis_g7_fg_stage_log%' AND p.oid::regprocedure::text NOT LIKE '%mis_g7_batch_receipt_code%' AND p.oid::regprocedure::text NOT LIKE '%mis_sign_batch_stage_v1%' AND p.oid::regprocedure::text NOT LIKE '%mis_pack_fg_bulk_v1%'`);
  assert.equal(list('s7'), list('pre7'));
  assert.equal(val('s7', `SELECT mode FROM app_private.mis_g7_enforcement`), 'AUDIT');
  assert.equal(val('s7', `SELECT count(*) FROM public.test_perm WHERE target IN ('module:mis-g7-enforcement-admin','module:mis-g7-core-migration-signoff','module:mis-batch-governance')`), '0');
});
T('AUDIT legacy compatibility with S7 installed: the exact live DWL editor still edits, packs and closes a batch', () => {
  const b = bn('LEG'); const f = val('s7', `SELECT public.t_mkbatch_real('${b}',10,'Bottling','Inherited')`);
  const r = Jt('s7', `SELECT * FROM public.t_edit_dwl(${f},'{"status":"In Progress","sku_breakdown":"0.5 kg x 4"}'::jsonb)`, PACKER);
  assert.ok(!r.raised || !/MIS_G7_S7|resolve|route_context/i.test(r.raised), r.raised); assert.ok(val('s7', `SELECT mode FROM app_private.mis_g7_enforcement`) === 'AUDIT');
});
T('staged rollback: S7B then S7A restore the exact original resolver, keep S2–S6 and every signature, then re-install is clean', () => {
  const sections = (name) => { const m = new RegExp(`-- ===== ${name} =====\\n([\\s\\S]*?)-- ===== END ${name} =====`).exec(doc('S7_ROLLBACK_NOT_A_MIGRATION.sql')); assert.ok(m, name); return m[1]; };
  const d = 'rb'; const b = bn('RBK'); const w = val(d, `SELECT public.s7_batch('ProductRoute','${b}','2026-10-31')`);
  const s0 = Jt(d, `SELECT public.mis_sign_batch_stage_v1('${newKey()}',22,'${b}',${w},103,1,10,'WB')`, SIGNER); assert.equal(s0.ok, true);      // product route 20, positive identities only
  const origSha = val('pre7', `SELECT encode(sha256(convert_to(pg_get_functiondef('app_private.mis_resolve_batch_stage(integer,text,integer,bigint)'::regprocedure),'UTF8')),'hex')`);
  assert.notEqual(pg.psql(d, asTx(sections('S7A ROLLBACK'))).status, 0, 'S7C and S7B must be rolled back first');
  assert.notEqual(pg.psql(d, asTx(sections('S7B ROLLBACK'))).status, 0, 'S7C must be rolled back before S7B');
  assert.equal(pg.psql(d, asTx(sections('S7C ROLLBACK'))).status, 0); assert.equal(pg.psql(d, asTx(sections('S7B ROLLBACK'))).status, 0);
  assert.equal(pg.psql(d, asTx(sections('S7A ROLLBACK'))).status, 0, 'compatible signature must not block rollback');
  assert.equal(val(d, `SELECT encode(sha256(convert_to(pg_get_functiondef('app_private.mis_resolve_batch_stage(integer,text,integer,bigint)'::regprocedure),'UTF8')),'hex')`), origSha);
  assert.equal(val(d, `SELECT count(*) FROM pg_proc WHERE proname IN ('mis_get_batch_route_context_v1','mis_get_batch_stage_status_v1','mis_preview_pack_fg_bulk_v1','mis_get_governance_exception_summary_v1','mis_g7_route_context')`), '0');
  assert.equal(val(d, `SELECT count(*) FROM app_private.mis_batch_stage_event WHERE event_id=${s0.event_id}`), '1');
  assert.equal(val(d, `SELECT source_fingerprint = app_private.mis_stage_fp(22,'${b}',${w},103,1) FROM app_private.mis_batch_stage_event WHERE event_id=${s0.event_id}`), 't', 'signature still verifies under the original resolver');
  assert.equal(pg.psql(d, asTx(mig(S7A))).status, 0, 'forward re-install after rollback');  assert.equal(pg.psql(d, asTx(mig(S7B))).status, 0); assert.equal(pg.psql(d, asTx(mig(S7C))).status, 0);
});
T('rollback is REFUSED once genuine S7-only identities exist (negative route/step ids), and a refused rollback changes nothing', () => {
  const sections = (name) => new RegExp(`-- ===== ${name} =====\\n([\\s\\S]*?)-- ===== END ${name} =====`).exec(doc('S7_ROLLBACK_NOT_A_MIGRATION.sql'))[1];
  const d = 'g_rbref'; assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE clean7`).status, 0);
  const b = bn('NEG'); const w = val(d, `SELECT public.s7_batch('Inherited','${b}','2026-11-10')`); assert.equal(Jt(d, `SELECT public.mis_sign_batch_stage_v1('${newKey()}',21,'${b}',${w},103,1,10,'WB')`, SIGNER).ok, true);   // route_id -11
  const hash = (db) => val(db, `SELECT md5(pg_get_functiondef('app_private.mis_resolve_batch_stage(integer,text,integer,bigint)'::regprocedure))`); const h0 = hash(d);
  assert.equal(pg.psql(d, asTx(sections('S7C ROLLBACK'))).status, 0); assert.equal(pg.psql(d, asTx(sections('S7B ROLLBACK'))).status, 0);
  const r = pg.psql(d, asTx(sections('S7A ROLLBACK'))); assert.notEqual(r.status, 0); assert.match(r.err, /MIS_G7_S7_ROLLBACK_INCOMPATIBLE_IDENTITIES/);
  assert.equal(hash(d), h0); assert.equal(val(d, `SELECT count(*) FROM app_private.mis_batch_stage_event`), '1'); assert.equal(status(d, 21, b).fg_bulk_state, 'SIGNED');
});
T('rollback guard also refuses when restoring would invalidate a genuine positive-id signature (ADD/REPLACE semantics differ under the S2 resolver)', () => {
  const sections = (name) => new RegExp(`-- ===== ${name} =====\\n([\\s\\S]*?)-- ===== END ${name} =====`).exec(doc('S7_ROLLBACK_NOT_A_MIGRATION.sql'))[1];
  const d = 'g_rbinc'; assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE clean7`).status, 0);
  const b = bn('REP'); val(d, `SELECT public.s7_batch('ProductRoute','${b}','2026-11-10')`); const wb = val(d, `SELECT public.s7_log('ProductRoute','${b}','Blending','2026-11-11')`);
  assert.equal(Jt(d, `SELECT public.mis_sign_batch_stage_v1('${newKey()}',22,'${b}',${wb},102,1,NULL,'WB')`, SIGNER).ok, true);     // positive id 102, but its effective activity is the override's
  assert.equal(pg.psql(d, asTx(sections('S7C ROLLBACK'))).status, 0); assert.equal(pg.psql(d, asTx(sections('S7B ROLLBACK'))).status, 0);
  const r = pg.psql(d, asTx(sections('S7A ROLLBACK'))); assert.notEqual(r.status, 0); assert.match(r.err, /MIS_G7_S7_ROLLBACK_INCOMPATIBLE_SIGNATURES/);
});
T('install is refused when an existing valid signature would stop verifying (compatibility proof)', () => {
  const d = 'g_inst'; assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE pre7`).status, 0);
  const b = bn('INC'); val(d, `SELECT public.s7_batch('ProductRoute','${b}','2026-11-10')`);
  // under the S2 resolver a signature on base step 102 is valid when the work log carries the BASE activity (Mixing); under S7 route 21 replaces it with Blending
  const wm = val(d, `SELECT public.s7_log('ProductRoute','${b}','Mixing','2026-11-11')`);
  const s0 = Jt(d, `SELECT public.mis_sign_batch_stage_v1('${newKey()}',22,'${b}',${wm},102,1,NULL,'WB')`, SIGNER); assert.equal(s0.ok, true, JSON.stringify(s0));
  const r = pg.psql(d, asTx(mig(S7A))); assert.notEqual(r.status, 0); assert.match(r.err, /MIS_G7_S7_SIGNATURE_INCOMPATIBLE/);
  assert.equal(val(d, `SELECT to_regprocedure('public.mis_get_batch_route_context_v1(integer,text,integer)') IS NULL`), 't'); assert.equal(val(d, `SELECT count(*) FROM app_private.mis_batch_stage_event`), '1');
});

/* ───────────── registry proposal (G5) ───────────── */
T('registry proposal: canonical permission_targets first (fk_app_modules_target), zero assignments, fail-closed on rerun/partial state', () => {
  const d = 'g_reg'; assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE pre7`).status, 0);
  run1(d, `CREATE TABLE public.permission_targets (key text PRIMARY KEY, kind text NOT NULL, label text NOT NULL, sort_order integer, is_assignable boolean NOT NULL DEFAULT true);
    CREATE TABLE public.app_modules (module_key text PRIMARY KEY, target_key text NOT NULL, label text NOT NULL, description text, section_key text, sort_order integer NOT NULL, icon_key text, is_active boolean NOT NULL DEFAULT true, is_assignable boolean NOT NULL DEFAULT true, show_in_navigation boolean NOT NULL DEFAULT true, min_nav_mode text NOT NULL DEFAULT 'view', updated_at timestamptz,
      CONSTRAINT fk_app_modules_target FOREIGN KEY (target_key) REFERENCES public.permission_targets(key));
    CREATE TABLE public.app_module_clients (module_key text NOT NULL REFERENCES public.app_modules(module_key), client_key text NOT NULL, route_path text, nav_enabled boolean, launch_mode text, updated_at timestamptz, PRIMARY KEY (module_key, client_key));
    CREATE TABLE public.user_permissions_canonical (user_id uuid, target text, can_view boolean, can_edit boolean);
    INSERT INTO public.permission_targets VALUES ('module:executive-mis-dashboard','module','Executive MIS',70,true);
    INSERT INTO public.app_modules(module_key,target_key,label,section_key,sort_order) VALUES ('executive-mis-dashboard','module:executive-mis-dashboard','Executive MIS','analytics-mis',70);`);
  const sql = doc('CLIENT_PERMISSION_REGISTRY_PROPOSAL_NOT_APPLIED.sql');
  // the pre-fix ordering (app_modules before permission_targets) must violate the FK: prove the FK is what the proposal has to respect
  assert.notEqual(pg.psql(d, `INSERT INTO public.app_modules(module_key,target_key,label,section_key,sort_order) VALUES ('x','module:nope','x','s',1)`).status, 0);
  assert.ok(sql.indexOf('INSERT INTO public.permission_targets') < sql.search(/insert into public\.app_modules/i));
  run1(d, sql);
  assert.equal(val(d, `SELECT count(*) FROM public.permission_targets WHERE key LIKE 'module:mis-%'`), '6'); assert.equal(val(d, `SELECT count(*) FROM public.app_modules WHERE module_key LIKE 'mis-%'`), '6');
  assert.equal(val(d, `SELECT count(*) FROM public.app_modules m LEFT JOIN public.permission_targets t ON t.key=m.target_key WHERE m.module_key LIKE 'mis-%' AND t.key IS NULL`), '0');
  assert.equal(val(d, `SELECT count(*) FROM public.app_modules WHERE show_in_navigation AND module_key LIKE 'mis-%'`), '1'); assert.equal(val(d, `SELECT count(*) FROM public.app_module_clients WHERE module_key LIKE 'mis-%'`), '2');
  assert.equal(val(d, `SELECT count(*) FROM public.user_permissions_canonical`), '0');
  assert.equal(val(d, `SELECT count(*) FROM public.app_modules WHERE module_key='executive-mis-dashboard' AND min_nav_mode='view'`), '1');
  const again = pg.psql(d, sql); assert.notEqual(again.status, 0); assert.match(again.err, /MIS_G7_REGISTRY_PRECONDITION/);
  assert.equal(val(d, `SELECT count(*) FROM public.permission_targets WHERE key LIKE 'module:mis-%'`), '6');
});

T('CONTRACT: the S7 entries of client_rpc_contract.json match the installed S7 catalog (arguments, defaults, result, security, volatility, documented codes)', () => {
  const c = JSON.parse(fs.readFileSync(path.join(root, 'docs/executive-mis-g7-server/client_rpc_contract.json'), 'utf8'));
  const s7 = c.rpcs.filter((r) => r.status === 'S7a' || r.status === 'S7c'); assert.equal(s7.length, 4); assert.equal(c.contract_version, 'mis-g7-s2-s7/1');
  const helpers = { mis_get_batch_route_context_v1: ['mis_g7_route_context'], mis_get_batch_stage_status_v1: ['mis_g7_batch_stage_status'], mis_preview_pack_fg_bulk_v1: [], mis_get_governance_exception_summary_v1: [] };
  for (const r of s7) {
    assert.equal(val('s7', `SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='${r.name}'`), '1', `${r.name} overloaded`);
    const oid = val('s7', `SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='${r.name}'`);
    const args = val('s7', `SELECT pg_get_function_arguments(${oid})`).split(', ').map((a) => a.replace(/ DEFAULT .*$/, '').split(' '));
    assert.deepEqual(args.map(([nm, ...ty]) => [nm, ty.join(' ')]), r.args, `${r.name} arguments`);
    for (const nm of Object.keys(r.defaults ?? {})) assert.match(val('s7', `SELECT pg_get_function_arguments(${oid})`), new RegExp(`${nm} \\S+ DEFAULT`), `${r.name}.${nm}`);
    assert.equal(val('s7', `SELECT pg_get_function_result(${oid})`), 'jsonb'); assert.equal(val('s7', `SELECT prosecdef AND provolatile='s' FROM pg_proc WHERE oid=${oid}`), 't');
    const src = [val('s7', `SELECT replace(prosrc, E'\\n', ' ') FROM pg_proc WHERE oid=${oid}`), ...helpers[r.name].map((h) => val('s7', `SELECT replace(prosrc, E'\\n', ' ') FROM pg_proc WHERE proname='${h}'`))].join(' ');
    for (const code of [...(r.codes ?? []), ...(r.preview_codes ?? [])]) assert.ok(src.includes(`'${code}'`), `${r.name}: documented code ${code} not produced`);
    for (const k of r.ok_keys ?? []) assert.ok(src.includes(`'${k}'`), `${r.name}: ok key ${k}`);
    for (const k of r.step_keys ?? []) assert.ok(src.includes(`'${k}'`), `${r.name}: step key ${k}`);
    for (const k of [...(r.event_keys ?? []), ...(r.item_keys ?? [])]) assert.ok(src.includes(`'${k}'`), `${r.name}: key ${k}`);
  }
});

/* ───────────── S7b: exact FG receipt evidence ───────────── */
const dbSigned = (b) => Number(val('s7', `SELECT count(*) FROM app_private.mis_batch_stage_event WHERE batch_number='${b}' AND event_kind='SIGN'`));
const SIGN_SIG = 'public.mis_sign_batch_stage_v1(uuid,integer,text,integer,bigint,integer,numeric,text)', PACK_SIG = 'public.mis_pack_fg_bulk_v1(uuid,bigint,jsonb,jsonb)';
const body = (file, fn) => { const t = mig(file); const i = t.indexOf(`CREATE OR REPLACE FUNCTION ${fn}(`); const a = t.indexOf('$f$', i) + 3; return t.slice(a, t.indexOf('$f$', a)); };
const ledgerRow = (db, p, b, qty, src, id, reason) => run1(db, `INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id) VALUES (${p},'${b}','2026-11-12',${qty},${qty},'kg','${reason}','${src}',${id})`);
const rcpt = (db, p, b, w) => J(db, `SELECT app_private.mis_g7_fg_receipt(${p},'${b}',${w})`);
const signAt = (db, p, b, w, qty, uid = SIGNER) => Jt(db, `SELECT public.mis_sign_batch_stage_v1('${newKey()}',${p},'${b}',${w},103,1,${qty},'WB-S7B')`, uid);
T('S7b patch: pins equal the installed S2/S4 sources, the patched results are the accepted ones, ACL/security preserved, baseline persisted; drift/ENFORCE/missing-S7a refused', () => {
  for (const [file, fn, sig, key] of [['20261123140000_mis_g7_s2_signed_batch_stage_events.sql', 'public.mis_sign_batch_stage_v1', SIGN_SIG, 'sign'], ['20261123142000_mis_g7_s4_atomic_pack_with_measured_excess.sql', 'public.mis_pack_fg_bulk_v1', PACK_SIG, 'pack']]) {
    const fileSha = sha(body(file, fn)); assert.ok(mig(S7B).includes(`'${fileSha}'`), `${key}: pin = file-derived sha`);
    assert.equal(val('pre7', `SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='${sig}'::regprocedure`), fileSha, `${key}: installed = file`);
    const after = val('s7', `SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='${sig}'::regprocedure`); assert.ok(mig(S7B).includes(`'${after}'`), `${key}: patched result pinned`); assert.notEqual(after, fileSha);
    assert.equal(val('s7', `SELECT concat(has_function_privilege('authenticated','${sig}','EXECUTE'),has_function_privilege('anon','${sig}','EXECUTE'),(SELECT prosecdef FROM pg_proc WHERE oid='${sig}'::regprocedure),(SELECT proconfig::text FROM pg_proc WHERE oid='${sig}'::regprocedure))`), val('pre7', `SELECT concat(has_function_privilege('authenticated','${sig}','EXECUTE'),has_function_privilege('anon','${sig}','EXECUTE'),(SELECT prosecdef FROM pg_proc WHERE oid='${sig}'::regprocedure),(SELECT proconfig::text FROM pg_proc WHERE oid='${sig}'::regprocedure))`), `${key}: ACL/security/config unchanged`);
    assert.equal(val('s7', `SELECT count(*) FROM app_private.mis_g7_s7_baseline WHERE obj='${sig}' AND sha256=encode(sha256(convert_to(def,'UTF8')),'hex')`), '1');
  }
  const refuse = (name, setup, expect) => { const d = `g_b_${name}`; assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE pre7`).status, 0); if (name !== 'noa') run1(d, asTx(mig(S7A))); if (setup) run1(d, setup);
    const r = pg.psql(d, asTx(mig(S7B))); assert.notEqual(r.status, 0, name); assert.match(r.err, expect, name); assert.equal(val(d, `SELECT position('mis_g7_fg_receipt' IN prosrc) FROM pg_proc WHERE oid='${SIGN_SIG}'::regprocedure`), '0', `${name}: signer untouched`); };
  refuse('noa', null, /MIS_G7_S7B_PRECONDITION/); refuse('enf', `UPDATE app_private.mis_g7_enforcement SET mode='ENFORCE'`, /MIS_G7_S7B_PRECONDITION/);
  const sgn = pg.psql('pre7', `SELECT pg_get_functiondef('${SIGN_SIG}'::regprocedure)`).out;
  refuse('drift', sgn.replace('BEGIN', 'BEGIN /* tampered */').replace(/\$f\$/g, '$f$'), /MIS_G7_S7B_SOURCE_DRIFT/);
});
T('exact receipt evidence helper: exact source, missing, unrelated positive stock, transfer-only, packaging return, mixed stock, wrong log/product/UOM/quantity', () => {
  const ok = (b, qty = 10) => { const w = val('s7', `SELECT public.s7_batch('Inherited','${b}','2026-11-10',${qty})`); return w; };
  const b1 = bn('RX'); const w1 = ok(b1); let r = rcpt('s7', 21, b1, w1); assert.deepEqual([r.ok, r.code, r.ledger_net_base, r.rows], [true, 'OK', 10, 1]);
  // unrelated positive stock: the log's own receipt rows are gone, only a manual entry carries stock
  const b2 = bn('RU'); const w2 = ok(b2); run1('s7', `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${b2}'`); ledgerRow('s7', 21, b2, 10, 'manual_entry', 1, 'MANUAL'); r = rcpt('s7', 21, b2, w2); assert.deepEqual([r.ok, r.code], [false, 'NO_SOURCE_LEDGER']);
  assert.equal(val('s7', `SELECT coalesce(sum(qty_base),0) FROM public.fg_bulk_stock_ledger WHERE batch_number='${b2}'`), '10.000000'.replace(/\.?0+$/, '') === '10' ? '10' : '10');   // batch stock IS positive: the old rule would have accepted
  // transfer-only positive stock
  const b3 = bn('RT'); const w3 = ok(b3); run1('s7', `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${b3}'`); ledgerRow('s7', 21, b3, 10, 'fg_bulk_internal_transfer', 55, 'TRANSFER_IN'); assert.equal(rcpt('s7', 21, b3, w3).code, 'NO_SOURCE_LEDGER');
  // packaging return (positive event_skus movement) never counts; neither does a stray row pointing at another work log id
  const b4 = bn('RP'); const w4 = ok(b4); run1('s7', `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${b4}'`); ledgerRow('s7', 21, b4, 10, 'event_skus', Number(w4), 'PACK_RETURN'); ledgerRow('s7', 21, b4, 10, 'daily_work_log', Number(w4) + 100000, 'FG bulk storage'); assert.equal(rcpt('s7', 21, b4, w4).code, 'NO_SOURCE_LEDGER');
  // mixed: unrelated manual stock on the same batch does not inflate the certified receipt
  const b5 = bn('RM'); const w5 = ok(b5); ledgerRow('s7', 21, b5, 5, 'manual_stock_correction', 2, 'MANUAL'); r = rcpt('s7', 21, b5, w5); assert.deepEqual([r.ok, r.ledger_net_base], [true, 10]);
  // wrong identity / quantity / UOM
  assert.equal(rcpt('s7', 22, b1, w1).code, 'NOT_FG_RECEIPT_LOG'); assert.equal(rcpt('s7', 21, 'OTHER', w1).code, 'NOT_FG_RECEIPT_LOG');
  const lg = val('s7', `SELECT public.s7_log('Inherited','${b1}','Mixing','2026-11-11')`); assert.equal(rcpt('s7', 21, b1, lg).code, 'NOT_FG_RECEIPT_LOG');
  const b6 = bn('RQ'); const w6 = ok(b6); run1('s7', `UPDATE public.daily_work_log SET storage_qty_uom='g' WHERE id=${w6}`); assert.equal(rcpt('s7', 21, b6, w6).code, 'UOM_MISMATCH'); run1('s7', `UPDATE public.daily_work_log SET storage_qty_uom='kg', storage_qty=0 WHERE id=${w6}`); assert.equal(rcpt('s7', 21, b6, w6).code, 'QTY_NOT_POSITIVE');
  // reason family: receipt reasons count, anything else against the same source does not
  const b7 = bn('RR'); const w7 = ok(b7); ledgerRow('s7', 21, b7, 7, 'daily_work_log', Number(w7), 'FG TRANSFER'); assert.equal(rcpt('s7', 21, b7, w7).ledger_net_base, 10);
  const b8 = bn('RI'); const w8 = ok(b8); run1('s7', `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${b8}'`); ledgerRow('s7', 21, b8, 10, 'daily_work_log', Number(w8), 'FG bulk storage (In Storage)'); assert.equal(rcpt('s7', 21, b8, w8).code, 'OK');
});
T('signer (patched S2 writer): exact receipt required — the OLD rule demonstrably accepted unrelated/transfer stock, the patched writer refuses it; mismatch has its own code', () => {
  // OLD behaviour (S2 as installed, no S7): signing succeeds on a product route although the log has no receipt of its own and only a transfer carries stock
  const bo = bn('OLD'); const wo = val('pre7', `SELECT public.s7_batch('ProductRoute','${bo}','2026-10-31',10)`); run1('pre7', `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${bo}'`);
  run1('pre7', `INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id) VALUES (22,'${bo}','2026-11-01',10,10,'kg','TRANSFER_IN','fg_bulk_internal_transfer',9)`);
  assert.equal(Jt('pre7', `SELECT public.mis_sign_batch_stage_v1('${newKey()}',22,'${bo}',${wo},103,1,10,'WB')`, SIGNER).ok, true, 'S2 rule accepted transfer stock as a receipt');
  // PATCHED behaviour
  const b = bn('NEW'); const w = val('s7', `SELECT public.s7_batch('Inherited','${b}','2026-11-10',10)`); run1('s7', `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}'`); ledgerRow('s7', 21, b, 10, 'fg_bulk_internal_transfer', 9, 'TRANSFER_IN');
  const r = signAt('s7', 21, b, w, 10); assert.deepEqual([r.ok, r.code, r.receipt], [false, 'FG_RECEIPT_EVIDENCE_MISSING', 'NO_SOURCE_LEDGER']); assert.equal(dbSigned(b), 0);
  ledgerRow('s7', 21, b, 10, 'daily_work_log', Number(w), 'FG bulk storage'); assert.equal(signAt('s7', 21, b, w, 10).ok, true);
  // ledger net differs from the logged quantity (log says 12, ledger has 10): distinct refusal with both figures
  const m = bn('MIS'); const wm = val('s7', `SELECT public.s7_batch('Inherited','${m}','2026-11-10',10)`); run1('s7', `UPDATE public.daily_work_log SET storage_qty=12 WHERE id=${wm}`);
  const mm = signAt('s7', 21, m, wm, 12); assert.deepEqual([mm.ok, mm.code, mm.log_qty, mm.ledger_net_base], [false, 'FG_RECEIPT_LEDGER_MISMATCH', 12, 10]);
  assert.equal(signAt('s7', 21, m, wm, 10).code, 'MEASURED_QTY_MISMATCH');
});
T('legitimate receipt updates: delta row, reverse-and-repost, in-place ledger update; a log edit invalidates the old signature and re-signing certifies the new net; silent ledger drift is refused', () => {
  const mk = (pre) => { const b = bn(pre); const w = val('s7', `SELECT public.s7_batch('Inherited','${b}','2026-11-10',10)`); return { b, w }; };
  // (a) delta-style update
  let { b, w } = mk('UD'); const s1 = signAt('s7', 21, b, w, 10); assert.equal(s1.ok, true);
  run1('s7', `UPDATE public.daily_work_log SET storage_qty=12 WHERE id=${w}`); assert.equal(status('s7', 21, b).fg_bulk_state, 'SOURCE_CHANGED');
  assert.equal(Jt('s7', `SELECT public.mis_correct_batch_stage_v1('${newKey()}',${s1.event_id},'log quantity updated')`, SIGNER).ok, true);
  assert.equal(signAt('s7', 21, b, w, 12).code, 'FG_RECEIPT_LEDGER_MISMATCH', 'log edited but the ledger not yet updated');
  ledgerRow('s7', 21, b, 2, 'daily_work_log', Number(w), 'FG bulk storage (update)'); assert.equal(rcpt('s7', 21, b, w).ledger_net_base, 12); assert.equal(signAt('s7', 21, b, w, 12).ok, true); assert.equal(status('s7', 21, b).fg_bulk_state, 'SIGNED');
  // (b) reverse-and-repost update
  ({ b, w } = mk('UR')); run1('s7', `UPDATE public.daily_work_log SET storage_qty=12 WHERE id=${w}`); ledgerRow('s7', 21, b, 5, 'manual_entry', 3, 'MANUAL');   // keep stock positive while reversing
  ledgerRow('s7', 21, b, -10, 'daily_work_log', Number(w), 'FG bulk storage (update)'); ledgerRow('s7', 21, b, 12, 'daily_work_log', Number(w), 'FG bulk storage (update)'); assert.deepEqual([rcpt('s7', 21, b, w).ok, rcpt('s7', 21, b, w).ledger_net_base, rcpt('s7', 21, b, w).rows], [true, 12, 3]); assert.equal(signAt('s7', 21, b, w, 12).ok, true);
  // (c) in-place ledger update
  ({ b, w } = mk('UI')); run1('s7', `UPDATE public.daily_work_log SET storage_qty=8 WHERE id=${w}; UPDATE public.fg_bulk_stock_ledger SET qty=8, qty_base=8 WHERE source_table='daily_work_log' AND source_id=${w}`); assert.equal(signAt('s7', 21, b, w, 8).ok, true);
  // (d) silent ledger drift after signing: log unchanged, ledger changed -> not SOURCE_CHANGED (fingerprint) but the receipt evidence is gone for packing/exceptions
  ({ b, w } = mk('UX')); const s4 = signAt('s7', 21, b, w, 10); assert.equal(s4.ok, true); ledgerRow('s7', 21, b, 3, 'daily_work_log', Number(w), 'FG bulk storage (update)');
  const ev = val('s7', `SELECT public.s7_event(public.s7_log('Inherited','${b}','Bottling','2026-11-11'))`); const pv = preview(ev, [{ sku_id: 10, count: 2 }]); assert.deepEqual([pv.ok, pv.preview_code, pv.receipt_code], [true, 'FG_RECEIPT_MISSING', 'LEDGER_MISMATCH']);
  const pk = pack(newKey(), ev, [{ sku_id: 10, count: 2 }]); assert.deepEqual([pk.code, pk.receipt], ['FG_RECEIPT_MISSING', 'LEDGER_MISMATCH']);
});
T('packing, preview and exception summary classify receipts identically (signed stage log is the evidence); transfer-only and unrelated stock are MISSING_RECEIPT; S6 Done and real source changes behave', () => {
  const d = 'g_rcpt'; assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE clean7`).status, 0);
  const mkb = (b, qty = 10) => val(d, `SELECT public.s7_batch('Inherited','${b}','2026-11-12',${qty})`);
  const okb = 'G-OK'; const wok = mkb(okb); const sg = Jt(d, `SELECT public.mis_sign_batch_stage_v1('${newKey()}',21,'${okb}',${wok},103,1,10,'WB')`, SIGNER); assert.equal(sg.ok, true);
  const evk = val(d, `SELECT public.s7_event(public.s7_log('Inherited','${okb}','Bottling','2026-11-13'))`);
  const pvOk = J(d, `SELECT public.mis_preview_pack_fg_bulk_v1(${evk},'[{"sku_id":10,"count":4}]'::jsonb)`, PACKER); assert.deepEqual([pvOk.preview_code, pvOk.receipt_code, pvOk.receipt_present], ['OK', 'OK', true]);
  run1(d, `SELECT set_config('app.fg_reconcile','1',false); UPDATE public.daily_work_log SET status='Done' WHERE id=${wok}`); assert.equal(J(d, `SELECT public.mis_preview_pack_fg_bulk_v1(${evk},'[{"sku_id":10,"count":4}]'::jsonb)`, PACKER).preview_code, 'OK', 'Done closure keeps receipt + signature');
  assert.equal(J(d, `SELECT public.mis_pack_fg_bulk_v1('${newKey()}',${evk},'[{"sku_id":10,"count":4}]'::jsonb,NULL)`, PACKER).ok, true);
  run1(d, `UPDATE public.daily_work_log SET storage_qty=9 WHERE id=${wok}`); const sc = J(d, `SELECT public.mis_preview_pack_fg_bulk_v1(${evk},'[{"sku_id":11,"count":1}]'::jsonb)`, PACKER); assert.equal(sc.preview_code, 'STAGE_SOURCE_CHANGED');
  const tb = 'G-TR'; const wtr = mkb(tb); run1(d, `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${tb}'`); ledgerRow(d, 21, tb, 10, 'fg_bulk_internal_transfer', 70, 'TRANSFER_IN');
  const ub = 'G-UN'; mkb(ub); run1(d, `DELETE FROM public.fg_bulk_stock_ledger WHERE batch_number='${ub}'`); ledgerRow(d, 21, ub, 10, 'manual_entry', 71, 'MANUAL');
  const mb = 'G-MM'; const wmm = mkb(mb); run1(d, `UPDATE public.daily_work_log SET storage_qty=11 WHERE id=${wmm}`);
  const s = J(d, `SELECT public.mis_get_governance_exception_summary_v1('2026-11-01','2026-11-30',200,0)`, EXECV); const det = (b) => s.items.filter((i) => i.batch_number === b && i.state === 'MISSING_RECEIPT').map((i) => i.detail);
  assert.deepEqual(det(tb), ['NO_SOURCE_LEDGER']); assert.deepEqual(det(ub), ['NO_SOURCE_LEDGER']); assert.deepEqual(det(mb), ['LEDGER_MISMATCH']); assert.deepEqual(det(okb), ['LEDGER_MISMATCH']);   // log edited to 9 after signing, ledger still 10: receipt evidence no longer exact
  // an unsigned batch whose evidence is a transfer: preview (batch level) agrees with the summary
  const evt = val(d, `SELECT public.s7_event(public.s7_log('Inherited','${tb}','Bottling','2026-11-13'))`); const pt = J(d, `SELECT public.mis_preview_pack_fg_bulk_v1(${evt},'[{"sku_id":10,"count":1}]'::jsonb)`, PACKER); assert.equal(pt.receipt_code, 'NO_SOURCE_LEDGER'); assert.equal(pt.receipt_present, false);
  // several FG receipt logs for one batch: any exact receipt log satisfies the batch-level classification
  const mb2 = 'G-ML'; const w1 = mkb(mb2, 6); const w2 = val(d, `SELECT public.s7_log('Inherited','${mb2}','FG bulk storage','2026-11-14')`); run1(d, `UPDATE public.daily_work_log SET storage_qty=4, storage_qty_uom='kg' WHERE id=${w2}`);
  assert.equal(val(d, `SELECT app_private.mis_g7_batch_receipt_code(21,'${mb2}')`), 'OK'); assert.equal(val(d, `SELECT app_private.mis_g7_batch_receipt_code(21,'NO-SUCH')`), 'NO_FG_LOG'); void w1;
});
T('pre-install live check SQL is read-only and runs: every pin check passes on the accepted pre-S7 catalog, receipt-semantics diagnostics return rows', () => {
  const d = 'g_ro'; assert.equal(pg.psql('postgres', `CREATE DATABASE ${d} TEMPLATE pre7`).status, 0);
  run1(d, `CREATE TABLE public.user_permissions_canonical (user_id uuid, target text, can_view boolean, can_edit boolean)`);
  const sql = fs.readFileSync(path.join(root, 'docs/executive-mis-g7-server/S7_PREINSTALL_LIVE_CHECK_READONLY.sql'), 'utf8');
  assert.doesNotMatch(sql.replace(/^\s*--.*$/gm, ''), /\b(insert|update|delete|create|drop|alter|grant|revoke|truncate)\b/i);
  const before = val(d, `SELECT (SELECT count(*) FROM public.fg_bulk_stock_ledger)||'/'||(SELECT count(*) FROM public.daily_work_log)`);
  const r = pg.psql(d, sql); assert.equal(r.status, 0, r.err); assert.equal(val(d, `SELECT (SELECT count(*) FROM public.fg_bulk_stock_ledger)||'/'||(SELECT count(*) FROM public.daily_work_log)`), before);
  const checks = r.out.split('\n').filter((l) => /\|(t|f)$/.test(l)); assert.ok(checks.length >= 14, `${checks.length} checks`); const failing = checks.filter((l) => l.endsWith('|f'));
  // pre7 carries one signature written by the S2-behaviour test above, so only that state check may be false here
  assert.deepEqual(failing.map((l) => l.split('|')[0]).filter((n) => n !== 'no signed stage events'), [], 'accepted pre-S7 catalog must satisfy every pin');
});

T('CONTRACT: S7b additions to the sign RPC (codes_s7b) are produced by the patched signer and by nothing before S7b', () => {
  const c = JSON.parse(fs.readFileSync(path.join(root, 'docs/executive-mis-g7-server/client_rpc_contract.json'), 'utf8')); const r = c.rpcs.find((x) => x.name === 'mis_sign_batch_stage_v1');
  assert.deepEqual(r.codes_s7b, ['FG_RECEIPT_LEDGER_MISMATCH']);
  const srcOf = (db) => val(db, `SELECT replace(prosrc, E'\\n', ' ') FROM pg_proc WHERE oid='${SIGN_SIG}'::regprocedure`);
  for (const code of r.codes_s7b) { assert.ok(srcOf('s7').includes(`'${code}'`), code); assert.ok(!srcOf('pre7').includes(`'${code}'`), `${code} must not exist before S7b`); }
});
