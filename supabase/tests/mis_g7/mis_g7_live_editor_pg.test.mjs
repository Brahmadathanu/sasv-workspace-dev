// MIS G7 S5/S5b acceptance against the EXACT live DWL editor source (wrapper + __core + SKU parser), installed from the production
// reference committed in docs/executive-mis-g7-server/LIVE_DWL_EDITOR_REFERENCE_ONLY_20261124.md. Everything around it (tables, the
// reconcile chain bodies, require_permission, auth.*) is still the production-shaped SHIM -- those parts are NOT real source.
// Tests are SKIPPED with the label BLOCKED when PostgreSQL is unavailable -- never reported as PASS.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startPg, installBaseAndMigrations, installLiveEditor, liveEditorBlocks, seedShimFingerprintsSql, MIGRATIONS, LIVE_EDITOR_SHA, PATCHED_CORE_MIGRATION, PATCHED_CORE_SHA } from './pg_harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const docs = path.resolve(here, '../../../docs/executive-mis-g7-server');
const migText = (f) => fs.readFileSync(path.resolve(here, '../../migrations', f), 'utf8');
const DB = 'live';
const SIGNER = '00000000-0000-0000-0000-000000000001';
const PACKER = '00000000-0000-0000-0000-000000000002';   // module:edit-log-entry (edit), module:fg-bulk-stock, module:mis-fg-bulk-packing
const NOBODY = '00000000-0000-0000-0000-000000000004';
const ADMIN = '00000000-0000-0000-0000-0000000000ad';
const VIEWER = '00000000-0000-0000-0000-0000000000af';   // module:edit-log-entry can_view only
const SIGNOFF = '00000000-0000-0000-0000-0000000000b0';
const ORIG_CORE_SHA = LIVE_EDITOR_SHA.rpc_update_daily_work_log_with_packaging__core;
let pg = null; let blocked = null;

before(() => {
  pg = startPg();
  if (!pg) { blocked = 'BLOCKED: local PostgreSQL unavailable'; return; }
  pg.createDb(DB);
  installBaseAndMigrations(pg, DB);                      // shim + EXACT live editor + migrations 1..6 (S2..S5); S5b patch is applied explicitly
  assert.equal(pg.psql(DB, fs.readFileSync(path.join(here, '01_seed.sql'), 'utf8')).status, 0);
  assert.equal(pg.psql(DB, `INSERT INTO public.test_perm(uid,target,can_view,can_edit) VALUES ('${ADMIN}','module:mis-g7-enforcement-admin',true,true),
    ('${VIEWER}','module:edit-log-entry',true,false), ('${SIGNOFF}','module:mis-g7-core-migration-signoff',true,true)`).status, 0);
});
after(() => { if (pg) pg.stop(); });

const T = (name, fn) => test(name, async (t) => { if (blocked) return t.skip(blocked); await fn(t); });
const q = (sql, uid) => pg.psql(DB, sql, uid === undefined ? {} : { uid });
const val = (sql, uid) => { const r = q(sql, uid); assert.equal(r.status, 0, r.err + ' :: ' + sql); return r.out.split('\n').pop(); };
const jl = (out) => JSON.parse(out.split('\n').find((l) => l.startsWith('{')));
const J = (sql, uid) => jl(q(sql, uid).out);
const anon = (sql) => pg.psql(DB, `SET ROLE anon; ${sql}`);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const hold = (body, secs) => `BEGIN; ${body}; SELECT pg_sleep(${secs}); COMMIT;`;
let n = 0; const bn = (p) => `${p}${++n}`;

const mk = (b, qty = 100) => val(`SELECT public.t_mkbatch_real('${b}', ${qty})`);            // returns the packaging work log id
const fgId = (b) => val(`SELECT id FROM public.daily_work_log WHERE batch_number='${b}' AND activity='FG bulk storage'`);
const sign = (b, qty = 100) => J(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'${b}',${fgId(b)},2,1,${qty},'weighment ${b}')`, SIGNER);
const mkSigned = (b, qty = 100) => { const f = mk(b, qty); const r = sign(b, qty); assert.equal(r.ok, true, JSON.stringify(r)); return f; };
const edit = (id, patch = {}, uid = PACKER) => q(`SELECT * FROM public.t_edit_dwl(${id}, '${JSON.stringify(patch).replace(/'/g, "''")}'::jsonb)`, uid);
const bal = (b) => Number(val(`SELECT coalesce(sum(qty_base),0) FROM public.fg_bulk_stock_ledger WHERE product_id=1 AND batch_number='${b}'`));
const lines = (id) => val(`SELECT coalesce(string_agg(es.sku_id||':'||es."count", ',' ORDER BY es.sku_id),'-') FROM public.event_skus es JOIN public.packaging_events pe ON pe.id=es.packaging_event_id WHERE pe.work_log_id=${id}`);
const hdrs = (id) => val(`SELECT count(*) FROM public.packaging_events WHERE work_log_id=${id}`);
const status = (id) => val(`SELECT status FROM public.daily_work_log WHERE id=${id}`);
const chainNet = (b) => Number(val(`SELECT coalesce(sum(qty_base),0) FROM public.fg_bulk_stock_ledger WHERE product_id=1 AND batch_number='${b}' AND source_table='event_skus'`));
const ok = (r) => assert.equal(r.status, 0, r.err);
const setModeSql = (m) => assert.equal(q(`UPDATE app_private.mis_g7_enforcement SET mode='${m}'`).status, 0);
const sha = (name) => val(`SELECT encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') FROM pg_proc p WHERE p.proname='${name}' AND p.pronamespace='public'::regnamespace`);
const DONE = (s) => ({ status: 'Done', sku_breakdown: s });
const coreOid = "(SELECT oid FROM pg_proc WHERE proname='rpc_update_daily_work_log_with_packaging__core' AND pronamespace='public'::regnamespace)";

// the same edit script is run against the ORIGINAL and the PATCHED core: outcomes must be identical (behavior preserved)
function workflow(prefix) {
  const b = bn(prefix); const f = mkSigned(b); const out = [];
  const snap = (label) => out.push([label, lines(f), bal(b), status(f), hdrs(f)].join('|'));
  { const r0 = edit(f, DONE('0.5 kg x 20')); assert.equal(r0.status, 0, r0.err); } snap('create');
  ok(edit(f, DONE('0.5 kg x 10;500 g x 4'))); snap('replace-2-segments');
  ok(edit(f, { activity: 'Cartoning', ...DONE('500 g x 60') })); snap('retype-cartoning');
  ok(edit(f, { status: 'In Progress' })); snap('chain-removed');
  ok(edit(f, DONE('0.5 kg x 8'))); snap('recreate');
  ok(edit(f, { remarks: 'note only' })); snap('same-chain-reedit');
  return out;
}
let baselineWorkflow = null;

// ====================================== fidelity of the fixtures ======================================
T('FIDELITY: the installed wrapper, core and parser are the EXACT live sources (pg_get_functiondef SHA-256 equals the production values)', () => {
  for (const [name, want] of Object.entries(LIVE_EDITOR_SHA)) assert.equal(sha(name), want, name);
  assert.equal(val(`SELECT count(*) FROM pg_proc WHERE proname LIKE 'rpc_update_daily_work_log_with_packaging%' OR proname='fn_parse_sku_breakdown'`), '3');
  for (const [role, fn, exp] of [['authenticated', "'public.rpc_update_daily_work_log_with_packaging'", 't'], ['anon', "'public.rpc_update_daily_work_log_with_packaging'", 'f']]) {
    const oid = val(`SELECT oid FROM pg_proc WHERE proname='rpc_update_daily_work_log_with_packaging' AND pronamespace='public'::regnamespace`);
    assert.equal(val(`SELECT has_function_privilege('${role}', ${oid}, 'EXECUTE')`), exp, `${role} ${fn}`);
  }
  assert.equal(val(`SELECT prosecdef FROM pg_proc WHERE oid=${coreOid}`), 't');
  assert.equal(val(`SELECT has_function_privilege('authenticated', ${coreOid}, 'EXECUTE')`), 'f');
  assert.equal(val(`SELECT array_to_string(proconfig,';') FROM pg_proc WHERE oid=${coreOid}`), 'search_path=public');
  const rows = q(fs.readFileSync(path.join(docs, 'CORE_PREINSTALL_LIVE_CHECK_READONLY.sql'), 'utf8')).out.split('\n').filter(Boolean).map((l) => l.split('|'));
  assert.equal(rows.length, 7); for (const [name, ok] of rows) assert.equal(ok, 't', name);   // incl. core sha == df7290df... and 'not yet migrated'
});
T('PARSER real inputs (exact live grammar): pack size / UOM / count, ";" separators; invalid formats raise', () => {
  const p = (s) => q(`SELECT string_agg(pack_size||'|'||uom||'|'||sku_count, ',') FROM public.fn_parse_sku_breakdown('${s}')`).out;
  assert.equal(p('40 g x 576'), '40|g|576'); assert.equal(p('10 mL x 480'), '10|mL|480'); assert.equal(p('25 g x 2992'), '25|g|2992');
  assert.equal(p('0.5 kg x 20; 500 g x 4'), '0.5|kg|20,500|g|4');
  for (const bad of ['10 mL', '10 mL x 0', 'x 5', '10 mL x -3']) assert.match(q(`SELECT * FROM public.fn_parse_sku_breakdown('${bad}')`).err, /Invalid/, bad);
});

// ====================================== ORIGINAL core (unpatched), AUDIT ======================================
T('ORIGINAL core, AUDIT: delete/recreate with sku_breakdown keeps FG stock exact; edits are logged (production logging compatibility)', () => {
  assert.equal(val(`SELECT mode FROM app_private.mis_g7_enforcement`), 'AUDIT'); assert.equal(sha('rpc_update_daily_work_log_with_packaging__core'), ORIG_CORE_SHA);
  const a0 = Number(val(`SELECT count(*) FROM app_private.mis_g7_direct_pack_audit`));
  baselineWorkflow = workflow('W');
  assert.deepEqual(baselineWorkflow.map((x) => x.split('|').slice(0, 3).join('|')), [
    'create|' + baselineWorkflow[0].split('|')[1] + '|90', 'replace-2-segments|' + baselineWorkflow[1].split('|')[1] + '|93', 'retype-cartoning|' + baselineWorkflow[2].split('|')[1] + '|70',
    'chain-removed|-|100', 'recreate|' + baselineWorkflow[4].split('|')[1] + '|96', 'same-chain-reedit|' + baselineWorkflow[5].split('|')[1] + '|96']);
  assert.ok(Number(val(`SELECT count(*) FROM app_private.mis_g7_direct_pack_audit`)) > a0);
});
T('ORIGINAL core, AUDIT: error paths roll back whole; wrapper source-identity rules and FG source-quantity corrections work', () => {
  const b = bn('E1'); const f = mkSigned(b); const fg = fgId(b);
  ok(edit(f, DONE('0.5 kg x 10'))); const keep = bal(b);
  assert.match(edit(f, DONE('0.5 kg x 1000')).err, /would make stock negative/); assert.equal(lines(f), '10:10'); assert.equal(bal(b), keep);
  assert.match(edit(f, DONE('77 kg x 3')).err, /could not be matched to product_skus/); assert.equal(lines(f), '10:10'); assert.equal(bal(b), keep);
  assert.match(edit(f, DONE('bad')).err, /Invalid sku_breakdown segment/); assert.equal(lines(f), '10:10');
  assert.match(edit(f, { status: 'Done', sku_breakdown: null }).err, /requires sku_breakdown/); assert.equal(lines(f), '10:10');
  // FG row immutability and quantity corrections come from the (untouched) wrapper
  assert.match(edit(fg, { batch_number: 'ZZ' }).err, /FG stock source identity is immutable/); assert.match(edit(fg, { item: 'P2' }).err, /FG stock source identity is immutable/);
  assert.match(edit(fg, { storage_qty: null }).err, /cannot be cleared/); assert.match(edit(fg, { storage_qty: -1 }).err, /must be zero or positive/);
  assert.match(edit(fg, { storage_qty_uom: 'g' }).err, /UOM is immutable/);
  ok(edit(fg, { storage_qty: 120 })); assert.equal(bal(b), keep + 20);
  assert.equal(val(`SELECT reason_code||'|'||qty_base||'|'||created_by FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}' AND reason_code LIKE 'FG source quantity correction%'`), `FG source quantity correction increase|20|${PACKER}@example.test`);   // actor from the JWT email claim
  ok(edit(fg, { storage_qty: 100 })); assert.equal(bal(b), keep);
  // the revision was reversed, so the signed source is un-drifted again and the new RPCs accept the batch
  assert.equal(J(`SELECT public.mis_pack_fg_bulk_v1('${randomUUID()}', ${val(`SELECT id FROM public.packaging_events WHERE work_log_id=${f}`)}, '[{"sku_id":11,"count":2}]'::jsonb)`, PACKER).ok, true);
});
T('ORIGINAL core, AUDIT: legacy hazards the S5 verification exists for (documented): never-depleted line delete and cross-batch move manufacture stock', () => {
  const h = bn('E2'); const hf = mkSigned(h);
  q(`ALTER TABLE public.event_skus DISABLE TRIGGER trg_fg_ledger_from_es`);
  try { q(`INSERT INTO public.packaging_events(work_log_id,event_type) VALUES (${hf},'Bottling'); INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") SELECT max(id),10,20 FROM public.packaging_events`); }
  finally { q(`ALTER TABLE public.event_skus ENABLE TRIGGER trg_fg_ledger_from_es`); }
  assert.equal(bal(h), 100); ok(edit(hf, { status: 'In Progress' })); assert.equal(bal(h), 110);                         // +10 kg never consumed
  const a = bn('E3'), c = bn('E4'); const af = mkSigned(a), cf = mkSigned(c);
  ok(edit(af, DONE('0.5 kg x 20'))); assert.equal(bal(a), 90);
  ok(edit(af, { batch_number: c, ...DONE('0.5 kg x 20') }));                                                              // identity change in one edit
  assert.equal(bal(a), 90); assert.equal(bal(c), 100);                                                                                       // old batch never returned; new batch: +10 (delete) -10 (create) -- stock is mis-assigned
  assert.equal(chainNet(a), -10);
});
T('ENFORCE FAILS CLOSED with the unpatched core: refusal code, readiness blocker, owner-forced ENFORCE rolls the real editor back whole', () => {
  assert.equal(J(`SELECT public.mis_g7_set_enforcement_v1('ENFORCE','try')`, ADMIN).code, 'LEGACY_DWL_EDITOR_NOT_MIGRATED');
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN).core_gate, 'LEGACY_DWL_EDITOR_NOT_MIGRATED');
  assert.equal(J(`SELECT public.mis_g7_record_core_migration_acceptance_v1('${ORIG_CORE_SHA}','x')`, SIGNOFF).code, 'LEGACY_DWL_EDITOR_NOT_MIGRATED');
  const b = bn('E5'); const f = mkSigned(b); setModeSql('ENFORCE');
  try { assert.match(edit(f, DONE('0.5 kg x 4')).err, /MIS_G7_DIRECT_PACKING_DENIED/); assert.equal(lines(f), '-'); assert.equal(bal(b), 100); assert.equal(status(f), 'In Progress'); }
  finally { setModeSql('AUDIT'); }
});

// ====================================== S5b patch install ======================================
const fresh = (name, prep) => { pg.createDb(name); assert.equal(pg.psql(name, fs.readFileSync(path.join(here, '00_base_schema_shim.sql'), 'utf8')).status, 0); installLiveEditor(pg, name);
  for (const f of MIGRATIONS.slice(0, 3)) assert.equal(pg.psql(name, migText(f)).status, 0, f);
  assert.equal(pg.psql(name, seedShimFingerprintsSql()).status, 0);
  for (const f of MIGRATIONS.slice(3)) assert.equal(pg.psql(name, migText(f)).status, 0, f);
  if (prep) assert.equal(pg.psql(name, prep).status, 0, prep); return (sql) => pg.psql(name, sql); };
T('S5b install FAILS CLOSED: changed core/wrapper/parser, client-executable core, missing S5, double apply', () => {
  const mig = migText(PATCHED_CORE_MIGRATION); const blocks = liveEditorBlocks();
  const core = (r) => r.err.match(/MIS_G7_S5B[^\n]*/)?.[0] ?? r.err.split('\n')[0];
  const coreName = 'rpc_update_daily_work_log_with_packaging__core';
  let run = fresh('s5bA', `COMMENT ON FUNCTION public.${coreName}(bigint,date,integer,integer,integer,integer,text,text,numeric,text,text,text,text,integer,text,text,text,date,date,text,date,numeric,text,text,text,text,numeric,text,numeric,text) IS 'c'`);
  assert.equal(run(mig).status, 0);                                                                                             // metadata does not change pg_get_functiondef
  let r = run(mig); assert.notEqual(r.status, 0); assert.match(core(r), /live editor definitions changed since review/);        // double apply: core is now patched -> refuses
  run = fresh('s5bB'); r = run(blocks.rpc_update_daily_work_log_with_packaging.replace('perform public.require_permission(', 'perform public.require_permission(').replace("'module:edit-log-entry'", "'module:edit-log-entry-x'"));
  assert.equal(r.status, 0); r = run(mig); assert.notEqual(r.status, 0); assert.match(core(r), /wrapper|rpc_update_daily_work_log_with_packaging live=/);   // mutated wrapper
  run = fresh('s5bC'); assert.equal(run(blocks.fn_parse_sku_breakdown.replace("'100 mL x 420'", "'100 mL x 420'").replace('Invalid SKU count', 'Invalid SKU count!')).status, 0);
  r = run(mig); assert.notEqual(r.status, 0); assert.match(core(r), /fn_parse_sku_breakdown live=/);                             // mutated parser
  run = fresh('s5bD', blocks.rpc_update_daily_work_log_with_packaging__core.replace('RAISE EXCEPTION \'No daily_work_log row found for id %\'', 'RAISE EXCEPTION \'No row found for id %\''));
  r = run(mig); assert.notEqual(r.status, 0); assert.match(core(r), /rpc_update_daily_work_log_with_packaging__core live=/);     // mutated core
  run = fresh('s5bE', `GRANT EXECUTE ON FUNCTION public.${coreName}(bigint,date,integer,integer,integer,integer,text,text,numeric,text,text,text,text,integer,text,text,text,date,date,text,date,numeric,text,text,text,text,numeric,text,numeric,text) TO authenticated`);
  r = run(mig); assert.notEqual(r.status, 0); assert.match(core(r), /core is client-executable/);
  run = fresh('s5bF', 'DROP FUNCTION app_private.mis_g7_chain_replace_begin(bigint)'); r = run(mig); assert.notEqual(r.status, 0); assert.match(core(r), /S5 primitives missing/);
  assert.equal(run(`SELECT encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') FROM pg_proc p WHERE proname='${coreName}'`).out, ORIG_CORE_SHA);   // nothing applied
});
T('S5b install: ONLY three statements added; wrapper/parser untouched; patched core pins to the reviewed SHA; ACL/security unchanged; baseline retained', () => {
  const diff = fs.readFileSync(path.join(docs, 'LIVE_DWL_EDITOR_CORE_S5_PATCH.diff'), 'utf8');
  const dl = diff.split('\n'); const added = dl.filter((l) => l.startsWith('+') && !l.startsWith('+++')); const removed = dl.filter((l) => l.startsWith('-') && !l.startsWith('---'));
  assert.equal(added.filter((l) => /PERFORM app_private\.mis_g7_chain_replace_(begin|finish)/.test(l)).length, 3);                // exactly three added statements ...
  assert.equal(removed.length, 0);                                                                                                // ... and nothing removed from the live core
  const r = q(migText(PATCHED_CORE_MIGRATION)); assert.equal(r.status, 0, r.err);
  assert.equal(sha('rpc_update_daily_work_log_with_packaging__core'), PATCHED_CORE_SHA);
  assert.notEqual(PATCHED_CORE_SHA, ORIG_CORE_SHA);
  assert.equal(sha('rpc_update_daily_work_log_with_packaging'), LIVE_EDITOR_SHA.rpc_update_daily_work_log_with_packaging);
  assert.equal(sha('fn_parse_sku_breakdown'), LIVE_EDITOR_SHA.fn_parse_sku_breakdown);
  assert.equal(val(`SELECT prosecdef FROM pg_proc WHERE oid=${coreOid}`), 't'); assert.equal(val(`SELECT has_function_privilege('authenticated', ${coreOid}, 'EXECUTE')`), 'f');
  assert.equal(val(`SELECT array_to_string(proconfig,';') FROM pg_proc WHERE oid=${coreOid}`), 'search_path=public');
  assert.equal(val(`SELECT def_sha FROM app_private.mis_g7_s5b_baseline`), ORIG_CORE_SHA);
  assert.equal(val(`SELECT encode(sha256(convert_to(def,'UTF8')),'hex')=def_sha FROM app_private.mis_g7_s5b_baseline`), 't');
  assert.match(q(`UPDATE app_private.mis_g7_s5b_baseline SET def='x'`).err, /APPEND_ONLY/);
  assert.equal(val(`SELECT count(*) FROM pg_proc WHERE proname LIKE 'rpc_update_daily_work_log_with_packaging%'`), '2');       // no new overload
});
T('GATE after patch: still refused until the owner signs off THIS exact patched SHA; sign-off authority and binding', () => {
  assert.equal(J(`SELECT public.mis_g7_set_enforcement_v1('ENFORCE','try')`, ADMIN).code, 'CORE_MIGRATION_NOT_ACCEPTED');
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN).core_gate, 'CORE_MIGRATION_NOT_ACCEPTED');
  for (const uid of [NOBODY, SIGNER, PACKER, ADMIN]) assert.match(q(`SELECT public.mis_g7_record_core_migration_acceptance_v1('${PATCHED_CORE_SHA}','x')`, uid).err, /permission denied/);
  assert.equal(J(`SELECT public.mis_g7_record_core_migration_acceptance_v1('${ORIG_CORE_SHA}','stale')`, SIGNOFF).code, 'CORE_SHA_MISMATCH');   // cannot sign off the old text
  assert.equal(J(`SELECT public.mis_g7_record_core_migration_acceptance_v1('${PATCHED_CORE_SHA}','owner review G7-core-1')`, SIGNOFF).ok, true);
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN).core_gate, 'OK');
});

// ====================================== PATCHED core: behavior preserved, protections active ======================================
T('PATCHED core, AUDIT: identical outcomes to the original core for the same edit script (sku_breakdown, delete/recreate, retype, remove)', () => {
  const got = workflow('P');
  assert.equal(got.length, baselineWorkflow.length);
  const norm = (x) => x.split('|').slice(0, 1).concat(x.split('|').slice(1)).join('|');
  got.forEach((x, i) => assert.equal(norm(x), norm(baselineWorkflow[i]), `step ${i}`));
});
T('PATCHED core: ENFORCE works end to end through the real wrapper; FG source corrections and non-packaging edits unaffected; direct client writes still denied', () => {
  assert.equal(J(`SELECT public.mis_g7_set_enforcement_v1('ENFORCE','patched core accepted')`, ADMIN).ok, true);
  try {
    const got = workflow('PE'); assert.deepEqual(got.map((x) => x.split('|').slice(2).join('|')), baselineWorkflow.map((x) => x.split('|').slice(2).join('|')));
    const b = bn('EN1'); const f = mkSigned(b); const fg = fgId(b);
    ok(edit(f, DONE('0.5 kg x 10'))); assert.equal(bal(b), 95);
    assert.match(q(`DELETE FROM public.event_skus WHERE packaging_event_id IN (SELECT id FROM public.packaging_events WHERE work_log_id=${f})`, PACKER).err, /MIS_G7_DIRECT_PACKING_DENIED/);
    assert.equal(lines(f), '10:10');
    ok(edit(fg, { storage_qty: 110 })); assert.equal(bal(b), 105);                                            // FG source correction (wrapper) still posts
    assert.equal(val(`SELECT count(*) FROM public.fg_bulk_stock_ledger WHERE batch_number='${b}' AND reason_code='FG source quantity correction increase' AND created_by='${PACKER}@example.test'`), '1');
    // the FG receipt was revised after signing: any further delete/recreate of this batch's chain needs the stage re-signed first (fail closed)
    assert.match(edit(f, { remarks: 'x' }).err, /MIS_G7_CHAIN_STAGE_SOURCE_CHANGED/); assert.equal(lines(f), '10:10');
    assert.equal(J(`SELECT public.mis_correct_batch_stage_v1('${randomUUID()}', ${val(`SELECT max(event_id) FROM app_private.mis_batch_stage_event WHERE batch_number='${b}' AND event_kind='SIGN'`)}, 'receipt revised')`, SIGNER).ok, true);
    assert.equal(J(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'${b}',${fg},2,1,110,'re-weighed')`, SIGNER).ok, true);
    ok(edit(f, { remarks: 'x' })); assert.equal(lines(f), '10:10'); assert.equal(bal(b), 105);
    const od = bn('EN1o'); val(`SELECT public.t_mkbatch_real('${od}', 50, 'Mixing')`);                                              // non-packaging activity: no chain, never needs a stage
    ok(edit(val(`SELECT id FROM public.daily_work_log WHERE batch_number='${od}' AND activity='Mixing'`), { remarks: 'ok' }));
    assert.equal(val(`SELECT count(*) FROM app_private.mis_g7_chain_ticket WHERE finished_at IS NULL`), '0');
  } finally { setModeSql('AUDIT'); }
});
T('PATCHED core: stage authorization and FG stock conservation (unsigned, drifted, old FG receipt revisions, missing-depletion 29-class, tampered ledger, insufficient stock)', () => {
  // fixtures first (direct inserts are denied under ENFORCE even for the owner session)
  const h = bn('PS_h'); const hf = mkSigned(h);
  q(`ALTER TABLE public.event_skus DISABLE TRIGGER trg_fg_ledger_from_es`);
  try { assert.equal(q(`INSERT INTO public.packaging_events(work_log_id,event_type) VALUES (${hf},'Bottling'); INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") SELECT max(id),10,20 FROM public.packaging_events`).status, 0); }
  finally { q(`ALTER TABLE public.event_skus ENABLE TRIGGER trg_fg_ledger_from_es`); }
  for (const mode of ['ENFORCE']) {                                                    // ENFORCE raises; AUDIT records and proceeds (see the AUDIT test below)
    assert.equal(J(`SELECT public.mis_g7_set_enforcement_v1('ENFORCE','x')`, ADMIN).ok, true);
    try {
      // unsigned batch (historical style)
      const u = bn('PS_u'); const uf = mk(u); assert.match(edit(uf, DONE('0.5 kg x 4')).err, /MIS_G7_CHAIN_STAGE_NOT_SIGNED/);
      assert.equal(lines(uf), '-'); assert.equal(bal(u), 100); assert.equal(status(uf), 'In Progress');
      // signed, then old FG receipt revised: stage drifted -> chain edits refused until re-signed
      const d = bn('PS_d'); const df = mkSigned(d); ok(edit(df, DONE('0.5 kg x 10')));
      ok(edit(fgId(d), { storage_qty: 101 }));                    // old FG receipt revision (governed correction, +1)
      assert.match(edit(df, DONE('0.5 kg x 12')).err, /MIS_G7_CHAIN_STAGE_SOURCE_CHANGED/); assert.equal(lines(df), '10:10');
      assert.match(edit(df, { status: 'In Progress' }).err, /MIS_G7_CHAIN_STAGE_SOURCE_CHANGED/); assert.equal(hdrs(df), '1'); assert.equal(bal(d), 96);
      const evId = val(`SELECT max(event_id) FROM app_private.mis_batch_stage_event WHERE batch_number='${d}' AND event_kind='SIGN'`);
      assert.equal(J(`SELECT public.mis_correct_batch_stage_v1('${randomUUID()}', ${evId}, 'FG receipt revised')`, SIGNER).ok, true);
      assert.equal(J(`SELECT public.mis_sign_batch_stage_v1('${randomUUID()}',1,'${d}',${fgId(d)},2,1,101,'re-weighed')`, SIGNER).ok, true);   // re-sign the revised receipt
      ok(edit(df, DONE('0.5 kg x 12'))); assert.equal(lines(df), '10:12'); assert.equal(bal(d), 101 - 6);
      // historical line without depletion (the 29-class): replacing/removing it would return stock never consumed
      assert.match(edit(hf, { status: 'In Progress' }).err, /MIS_G7_CHAIN_CONSERVATION_MISMATCH/);
      assert.match(edit(hf, DONE('0.5 kg x 20')).err, /MIS_G7_CHAIN_CONSERVATION_MISMATCH/); assert.equal(bal(h), 100); assert.equal(lines(hf), '10:20');
      // tampered ledger for a normal chain
      const t = bn('PS_t'); const tf = mkSigned(t); ok(edit(tf, DONE('0.5 kg x 10')));
      q(`UPDATE public.fg_bulk_stock_ledger SET qty=-4, qty_base=-4 WHERE source_table='event_skus' AND batch_number='${t}'`);
      assert.match(edit(tf, DONE('0.5 kg x 4')).err, /MIS_G7_CHAIN_CONSERVATION_MISMATCH/); assert.equal(lines(tf), '10:10');
      // insufficient stock: legacy guard raises, everything incl. the ticket rolls back
      const s = bn('PS_s'); const sf = mkSigned(s, 10); ok(edit(sf, DONE('0.5 kg x 10'))); const keep = bal(s);
      assert.match(edit(sf, DONE('0.5 kg x 1000')).err, /would make stock negative/); assert.equal(lines(sf), '10:10'); assert.equal(bal(s), keep);
      assert.equal(val(`SELECT count(*) FROM app_private.mis_g7_chain_ticket WHERE finished_at IS NULL`), '0');
    } finally { setModeSql('AUDIT'); }
  }
});
T('PATCHED core, ENFORCE: DWL identity change (batch move) is conserved per identity; both batches must be signed', () => {
  const a = bn('PI_a'), c = bn('PI_c'), u = bn('PI_u'); const af = mkSigned(a), cf = mkSigned(c); const uf = mk(u);
  ok(edit(af, DONE('0.5 kg x 20'))); assert.equal(bal(a), 90);
  assert.equal(J(`SELECT public.mis_g7_set_enforcement_v1('ENFORCE','x')`, ADMIN).ok, true); try {
  // old batch's consumption would stay unreturned while the new batch is credited by the legacy delete trigger -> refused
  const r = edit(af, { batch_number: c, ...DONE('0.5 kg x 20') }); assert.notEqual(r.status, 0); assert.match(r.err, /MIS_G7_CHAIN_CONSERVATION_MISMATCH/);
  assert.equal(val(`SELECT batch_number FROM public.daily_work_log WHERE id=${af}`), a); assert.equal(bal(a), 90); assert.equal(bal(c), 100);
  // the target batch must be signed as well (moving INTO an unsigned batch)
  assert.match(edit(cf, { batch_number: u, ...DONE('0.5 kg x 4') }).err, /MIS_G7_CHAIN_STAGE_NOT_SIGNED/); assert.equal(bal(u), 100);
  // a row that is not packaging yet may be moved freely (no chain either side)
  ok(edit(cf, { batch_number: c, remarks: 'same' }));
  } finally { setModeSql('AUDIT'); }
});
T('PATCHED core, AUDIT: violations are RECORDED (append-only) but never block -- legacy behavior and documented hazards are preserved until ENFORCE', () => {
  assert.equal(val(`SELECT mode FROM app_private.mis_g7_enforcement`), 'AUDIT');
  const cnt = (code) => Number(val(`SELECT count(*) FROM app_private.mis_g7_direct_pack_audit WHERE tbl='chain_replace' AND op='${code}'`));
  // unsigned batch: edit proceeds exactly as the legacy core would
  const u = bn('AV_u'); const uf = mk(u); const c0 = cnt('CHAIN_STAGE_NOT_SIGNED');
  ok(edit(uf, DONE('0.5 kg x 4'))); assert.equal(lines(uf), '10:4'); assert.equal(bal(u), 98); assert.equal(cnt('CHAIN_STAGE_NOT_SIGNED'), c0 + 1);
  // historical never-depleted line: legacy hazard (+10 kg) proceeds, the violation is recorded
  const h = bn('AV_h'); const hf = mkSigned(h); const k0 = cnt('CHAIN_CONSERVATION_MISMATCH');
  q(`ALTER TABLE public.event_skus DISABLE TRIGGER trg_fg_ledger_from_es`);
  try { assert.equal(q(`INSERT INTO public.packaging_events(work_log_id,event_type) VALUES (${hf},'Bottling'); INSERT INTO public.event_skus(packaging_event_id,sku_id,"count") SELECT max(id),10,20 FROM public.packaging_events`).status, 0); }
  finally { q(`ALTER TABLE public.event_skus ENABLE TRIGGER trg_fg_ledger_from_es`); }
  ok(edit(hf, { status: 'In Progress' })); assert.equal(bal(h), 110); assert.equal(cnt('CHAIN_CONSERVATION_MISMATCH'), k0 + 1);
  // drifted source after signing, and a batch move: both proceed (legacy) and are recorded
  const d = bn('AV_d'); const df = mkSigned(d); ok(edit(df, DONE('0.5 kg x 10'))); ok(edit(fgId(d), { storage_qty: 101 })); const s0 = cnt('CHAIN_STAGE_SOURCE_CHANGED');
  ok(edit(df, DONE('0.5 kg x 12'))); assert.equal(lines(df), '10:12'); assert.equal(cnt('CHAIN_STAGE_SOURCE_CHANGED'), s0 + 1);
  const a = bn('AV_a'), c = bn('AV_c'); const af = mkSigned(a); mkSigned(c); ok(edit(af, DONE('0.5 kg x 20'))); const m0 = cnt('CHAIN_CONSERVATION_MISMATCH');
  ok(edit(af, { batch_number: c, ...DONE('0.5 kg x 20') })); assert.ok(cnt('CHAIN_CONSERVATION_MISMATCH') > m0);                    // stock mis-assigned by the legacy move, now visible
  // the log is append-only, carries the actor and detail, and feeds the readiness report
  assert.match(q(`UPDATE app_private.mis_g7_direct_pack_audit SET detail='x' WHERE tbl='chain_replace'`).err, /APPEND_ONLY/);
  assert.equal(val(`SELECT count(*) FROM app_private.mis_g7_direct_pack_audit WHERE tbl='chain_replace' AND actor='${PACKER}' AND detail LIKE 'work_log %' AND mode='AUDIT'`) >= '4', true);
  assert.ok(J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN).direct_writes.some((x) => x.tbl === 'chain_replace' && x.op === 'CHAIN_STAGE_NOT_SIGNED'));
  // structural legacy errors are untouched: insufficient stock still raises and rolls back
  const s1 = bn('AV_s'); const sf = mkSigned(s1, 10); ok(edit(sf, DONE('0.5 kg x 10'))); const keep = bal(s1);
  assert.match(edit(sf, DONE('0.5 kg x 1000')).err, /would make stock negative/); assert.equal(bal(s1), keep);
});
T('PATCHED core: a core that never calls finish cannot commit; one that skips begin gets no bypass; tickets are private, scoped and per transaction', () => {
  const b = bn('PF'); const f = mkSigned(b); const def = q(`SELECT pg_get_functiondef(${coreOid})`).out;
  const finishLess = def.replaceAll('PERFORM app_private.mis_g7_chain_replace_finish(p_id);', '');
  const beginLess = def.replace('PERFORM app_private.mis_g7_chain_replace_begin(p_id);', '');
  assert.notEqual(finishLess, def); assert.notEqual(beginLess, def);
  try {
    assert.equal(q(finishLess).status, 0);
    for (const m of ['AUDIT', 'ENFORCE']) {
      if (m === 'ENFORCE') assert.equal(J(`SELECT public.mis_g7_set_enforcement_v1('ENFORCE','x')`, ADMIN).code, 'LEGACY_DWL_EDITOR_NOT_MIGRATED');   // a core without the finish call is refused by the gate (and has a different SHA)
      setModeSql(m);
      try { assert.match(edit(f, DONE('0.5 kg x 4')).err, /MIS_G7_CHAIN_REPLACE_NOT_FINISHED/, m); } finally { setModeSql('AUDIT'); }
      assert.equal(lines(f), '-'); assert.equal(bal(b), 100); assert.equal(status(f), 'In Progress');                              // whole edit rolled back at commit
    }
    assert.equal(q(beginLess).status, 0); setModeSql('ENFORCE');
    try { assert.match(edit(f, DONE('0.5 kg x 4')).err, /MIS_G7_DIRECT_PACKING_DENIED|MIS_G7_CHAIN_REPLACE_NOT_BEGUN/); assert.equal(lines(f), '-'); }
    finally { setModeSql('AUDIT'); }
  } finally {                                                                                                                      // restore the exact patched core
    const m = migText(PATCHED_CORE_MIGRATION); const body = m.slice(m.indexOf('CREATE OR REPLACE FUNCTION public.rpc_update_daily_work_log_with_packaging__core'), m.lastIndexOf('DO $$'));
    assert.equal(q(body).status, 0); assert.equal(sha('rpc_update_daily_work_log_with_packaging__core'), PATCHED_CORE_SHA);
  }
  assert.equal(J(`SELECT public.mis_g7_enforcement_readiness_v1(7)`, ADMIN).core_gate, 'OK');                                       // same text, same SHA: sign-off valid again
  // clients can neither call the primitives/core nor mint tickets
  for (const uid of [NOBODY, VIEWER, PACKER]) {
    assert.match(q(`SELECT app_private.mis_g7_chain_replace_begin(${f})`, uid).err, /permission denied/);
    assert.match(q(`SELECT * FROM public.rpc_update_daily_work_log_with_packaging__core(${f}${',NULL'.repeat(29)})`, uid).err, /permission denied for function/);
    assert.match(q(`INSERT INTO app_private.mis_g7_chain_ticket(txid,work_log_id) VALUES (txid_current(),${f})`, uid).err, /permission denied/);
  }
  // ticket scope: a ticket for one work log does not authorize another work log's chain
  const a2 = bn('PF_a'), b2 = bn('PF_b'); const a2f = mkSigned(a2), b2f = mkSigned(b2); ok(edit(b2f, DONE('0.5 kg x 2')));
  q(`CREATE FUNCTION public.t_scope_probe(p_a bigint, p_b bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN PERFORM app_private.mis_g7_chain_replace_begin(p_a);
     DELETE FROM public.event_skus WHERE packaging_event_id IN (SELECT id FROM public.packaging_events WHERE work_log_id = p_b); PERFORM app_private.mis_g7_chain_replace_finish(p_a); END $$`);
  setModeSql('ENFORCE');
  try { assert.match(q(`SELECT public.t_scope_probe(${a2f}, ${b2f})`).err, /MIS_G7_DIRECT_PACKING_DENIED/); } finally { setModeSql('AUDIT'); q(`DROP FUNCTION public.t_scope_probe(bigint,bigint)`); }
  assert.equal(lines(b2f), '10:2');
});
T('JWT / ROLES on the real editor: View-only, no-permission, anon and service_role-less callers are denied; actor is stamped from the JWT; edits never trust client flags', () => {
  const b = bn('JR'); const f = mkSigned(b);
  for (const uid of [NOBODY, VIEWER, SIGNER]) assert.match(edit(f, DONE('0.5 kg x 2'), uid).err, /permission denied/, uid);
  assert.match(anon(`SELECT * FROM public.t_edit_dwl(${f}, '{}'::jsonb)`).err, /permission denied/);
  assert.match(pg.psql(DB, `SET ROLE authenticated; SELECT * FROM public.t_edit_dwl(${f}, '{}'::jsonb)`).err, /permission denied|auth/);   // authenticated role without a JWT subject
  assert.equal(lines(f), '-'); assert.equal(bal(b), 100);
  ok(edit(f, DONE('0.5 kg x 2'), PACKER)); assert.equal(bal(b), 99);
  // client-supplied identity/flag-like fields in the patch cannot widen anything (the wrapper ignores them: they are not parameters)
  ok(edit(f, { authorized: true, app_fg_reconcile: '1' }, PACKER));
  assert.equal(val(`SELECT coalesce(current_setting('app.allow_dwl_fg_qty_correction', true),'') <> '1'`), 't');
});
T('PATCHED core concurrency: a chain replacement holds the batch lock; a concurrent pack waits and sees the committed result; conservation holds', async () => {
  const b = bn('PC'); const f = mkSigned(b, 10);
  q(`INSERT INTO public.daily_work_log(item,batch_number,activity,log_date,status) VALUES ('P1','${b}','Filling','2026-11-12','Done'); INSERT INTO public.packaging_events(work_log_id,event_type) SELECT max(id),'Bottling' FROM public.daily_work_log`);
  const e2 = val(`SELECT max(pe.id) FROM public.packaging_events pe JOIN public.daily_work_log w ON w.id=pe.work_log_id WHERE w.batch_number='${b}'`);
  ok(edit(f, DONE('0.5 kg x 10')));                                                                              // 5 kg used, 5 left
  const A = pg.psqlAsync(DB, hold(`SELECT * FROM public.t_edit_dwl(${f}, '${JSON.stringify(DONE('0.5 kg x 16'))}'::jsonb)`, 1.5), { uid: PACKER });   // grow to 8 kg
  await delay(400);
  const B = pg.psqlAsync(DB, `SELECT public.mis_pack_fg_bulk_v1('${randomUUID()}', ${e2}, '[{"sku_id":11,"count":8}]'::jsonb)`, { uid: PACKER });   // needs 4 kg; 2 left after A
  const [a, bb] = await Promise.all([A, B]);
  assert.equal(a.status, 0, a.err); const rb = jl(bb.out);
  assert.equal(rb.code, 'INSUFFICIENT_BULK'); assert.equal(Number(rb.available_base), 2); assert.ok(bb.ms >= 1000, `pack waited ${bb.ms}`);
  assert.equal(bal(b), 2); assert.equal(chainNet(b), -8);
});

// ====================================== rollback ======================================
T('ROLLBACK: S5b rollback restores the EXACT original core (SHA df7290df…), wrapper/parser untouched, S5 refuses until S5b is rolled back', () => {
  const run = fresh('s5rb', fs.readFileSync(path.join(here, '01_seed.sql'), 'utf8'));
  const dsha = (name) => run(`SELECT encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') FROM pg_proc p WHERE proname='${name}'`).out;
  const aclOf = (name) => run(`SELECT coalesce((SELECT string_agg(x::text, ',' ORDER BY x::text) FROM unnest(coalesce(p.proacl, acldefault('f', p.proowner))) x),'') || '|' || p.prosecdef || '|' || coalesce(array_to_string(p.proconfig,';'),'') FROM pg_proc p WHERE proname='${name}'`).out;
  const before = Object.fromEntries(Object.keys(LIVE_EDITOR_SHA).map((nm) => [nm, [dsha(nm), aclOf(nm)]]));
  assert.equal(before.rpc_update_daily_work_log_with_packaging__core[0], ORIG_CORE_SHA);
  assert.equal(run(migText(PATCHED_CORE_MIGRATION)).status, 0); assert.equal(dsha('rpc_update_daily_work_log_with_packaging__core'), PATCHED_CORE_SHA);
  const rb = fs.readFileSync(path.join(docs, 'ROLLBACK_NOT_A_MIGRATION.sql'), 'utf8');
  const iS5 = rb.indexOf('-- ==== S5 ROLLBACK ===='), iS5b = rb.indexOf('-- ==== S5B ROLLBACK ===='); assert.ok(iS5 > 0 && iS5b > iS5);
  const s5 = rb.slice(iS5, iS5b), s5b = rb.slice(iS5b);
  const early = run(s5); assert.notEqual(early.status, 0); assert.match(early.err, /live core still calls the S5 primitives/);       // wrong order is refused
  run(`UPDATE app_private.mis_g7_enforcement SET mode='ENFORCE'`);                                                                    // owner-forced state to prove the mode return
  const r = run(s5b); assert.equal(r.status, 0, r.err);
  assert.deepEqual(Object.fromEntries(Object.keys(LIVE_EDITOR_SHA).map((nm) => [nm, [dsha(nm), aclOf(nm)]])), before);               // SHA, ACL, secdef, config identical for all three
  assert.equal(run(`SELECT mode FROM app_private.mis_g7_enforcement`).out, 'AUDIT');
  assert.equal(run(`SELECT count(*) FROM app_private.mis_g7_enforcement_log WHERE reason LIKE 'S5B rollback%'`).out, '1');
  assert.equal(run(`SELECT count(*) FROM app_private.mis_g7_s5b_baseline`).out, '1');                                                // baseline retained
  const ok = run(s5); assert.equal(ok.status, 0, ok.err);                                                                             // now S5 can be rolled back
  assert.equal(run(`SELECT to_regprocedure('app_private.mis_g7_chain_replace_begin(bigint)') IS NULL`).out, 't');
  // original editor works exactly as before (legacy behavior), including a real edit
  run(`SELECT public.t_mkbatch_real('RBX', 100)`);
  const wl = run(`SELECT id FROM public.daily_work_log WHERE batch_number='RBX' AND activity='Bottling'`).out;
  const e = pg.psql('s5rb', `SELECT * FROM public.t_edit_dwl(${wl}, '{"status":"Done","sku_breakdown":"0.5 kg x 4"}'::jsonb)`, { uid: PACKER }); assert.equal(e.status, 0, e.err);
  assert.equal(Number(run(`SELECT coalesce(sum(qty_base),0) FROM public.fg_bulk_stock_ledger WHERE batch_number='RBX'`).out), 98);
});
