// MIS G7 production-equivalent acceptance.
//  * MIS_G7_BASELINE_DIR set  -> PRODUCTION-EQUIVALENT run: the captured live baseline packet is loaded (no shim, no reconstructed functions, NO
//    fingerprint seeding) with S2 as INSTALLED (taken from the packet, never replayed), then S3..S5b are applied in order.
//  * not set                  -> PIPELINE SELF-TEST only: a shim database that already holds the exact live editor and S2 acts as a stand-in
//    "production", the real capture scripts run against it, the packet is loaded into a fresh database and the same steps run. This proves the
//    tooling round-trip; it is NOT production parity (every non-editor function is still a reconstruction there) and is labelled so.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startPg, installLiveEditor, seedShimFingerprintsSql, MIGRATIONS, PATCHED_CORE_MIGRATION, PATCHED_CORE_SHA } from '../pg_harness.mjs';
import { loadBaseline, verifyFunctions, readPacket } from './load_baseline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const migText = (f) => fs.readFileSync(path.resolve(here, '../../../migrations', f), 'utf8');
const REAL = process.env.MIS_G7_BASELINE_DIR ? path.resolve(process.env.MIS_G7_BASELINE_DIR) : null;
const MODE = REAL ? 'PRODUCTION-EQUIVALENT' : 'PIPELINE SELF-TEST (stand-in, NOT production parity)';
const PINNED = { 'fn_fg_auto_zero(integer,text,numeric)': '705fecd3e68576272af73b5230737c98689c9f538d88e40d723a5b935ae5a582', 'fn_fg_force_close(integer,text,numeric)': 'c48578e7e08d311aebdefdaaf512bbfe2a87daecf61c2bde735f46d1e7cff10d',
  'fn_fg_ledger_add(integer,text,numeric,text,integer,text,date)': '9b9a1a4975679358a2628f3e598a75a2a4b0ac658173da9f6f1950cdd6629675', 'trg_fg_bulk_internal_transfer_to_ledger()': '6adab6d8180d2d0f15f8415acd51403691cc6f64c58b549b71ce386e6faa69c5',
  'trg_fg_ledger_from_dwl()': 'ffe12985b5e7c135766655c4893a886adc2d1a36bd6a181c80cd185649c2eec1', 'trg_fg_ledger_from_es()': 'cc32357d320fb63278632c5726085bdcf6b32395453838d39cac8c3584faed28',
  'trg_fg_ledger_reconcile_ins_stmt()': 'd4cdfe3dbc827d0e14122fe41993981e65b4903bd18d8da3d0013fd730cc2412', 'trg_fg_ledger_reconcile_upd_stmt()': 'a298bcff5a7fede05d59c4d77c4673fd4fe5db2f5609914cb900dedfbf6b5f7b',
  'trg_fg_ledger_reconcile_del_stmt()': 'd09789baea588ff64d78e9b787ae769a4dff2df9f307547bfcdedd562cb995ad', 'fn_fg_reconcile_batch(integer,text,numeric)': 'b229faad84f128420eb61caae3fb0678b15772d22b0d13f416c0332a92b9a7be',
  'fn_fg_mark_done_if_zero(integer,text,numeric)': '278f4fdc43cc5886b57995407d6cc5cdc52404362fb0135ab19aedd440cacb6a' };
let pg = null; let blocked = null; let packet = null; let tmp = null; const DB = 'prodeq';

before(() => {
  pg = startPg();
  if (!pg) { blocked = 'BLOCKED: local PostgreSQL unavailable'; return; }
  let dir = REAL;
  if (!REAL) {   // stand-in production + REAL capture scripts (psql query + pg_dump), written to a private temp dir
    pg.createDb('stand');
    for (const f of ['00_base_schema_shim.sql']) assert.equal(pg.psql('stand', fs.readFileSync(path.resolve(here, '..', f), 'utf8')).status, 0);
    installLiveEditor(pg, 'stand');
    assert.equal(pg.psql('stand', migText(MIGRATIONS[0])).status, 0);                    // S2 "installed in production"
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mis-g7-baseline-')); fs.chmodSync(tmp, 0o700); dir = tmp;
    const q = pg.psql('stand', fs.readFileSync(path.join(here, 'capture_queries.sql'), 'utf8'));
    assert.equal(q.status, 0, q.err); fs.writeFileSync(path.join(dir, 'catalog.json'), q.out.slice(q.out.indexOf('{')));
    const d = spawnSync(path.join(pg.bin, 'pg_dump'), [pg.url('stand'), '--schema-only', '--no-comments', '--no-security-labels', '--no-publications', '--no-subscriptions', '-n', 'public', '-n', 'costing', '-n', 'app_private', '-f', path.join(dir, '10_schema.sql')], { encoding: 'utf8' });
    assert.equal(d.status, 0, d.stderr);
  }
  pg.createDb(DB);
  const r = loadBaseline(pg, DB, dir); packet = r.packet; blocked = null; globalThis.__loadErrors = r.errors;
});
after(() => { if (pg) pg.stop(); if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });
const T = (name, fn) => test(`[${MODE}] ${name}`, async (t) => { if (blocked) return t.skip(blocked); await fn(t); });
const q = (sql, o) => pg.psql(DB, sql, o ?? {});
const val = (sql) => { const r = q(sql); assert.equal(r.status, 0, r.err + ' :: ' + sql); return r.out.split('\n').pop(); };

T('PACKET: captured baseline loads with no unexplained errors; every captured function loads with identical SHA-256, owner and security attribute', () => {
  assert.deepEqual(globalThis.__loadErrors, [], `load errors:\n${globalThis.__loadErrors.join('\n')}`);
  assert.deepEqual(verifyFunctions(pg, DB, packet), []);
  assert.ok(packet.cat.functions.length >= 5);
  const have = (id) => packet.cat.functions.find((f) => f.identity.replace(/^public\./, '') === id);
  for (const id of ['rpc_update_daily_work_log_with_packaging__core(bigint,date,integer,integer,integer,integer,text,text,numeric,text,text,text,text,integer,text,text,text,date,date,text,date,numeric,text,text,text,text,numeric,text,numeric,text)'])
    assert.ok(have(id), 'live editor core present in the packet');
  assert.equal(packet.cat.settings['plpgsql.variable_conflict'] ?? 'error', 'error');                               // live default: no override assumed
  if (REAL) assert.ok(/^17\./.test(packet.cat.server_version), `captured from server ${packet.cat.server_version}`);
});
T('verifyFunctions COMPARES ACL, configuration, owner, security attribute and source (each mutation is detected; it previously fetched ACL/config without comparing)', () => {
  assert.deepEqual(verifyFunctions(pg, DB, packet), []);
  const f = packet.cat.functions.find((x) => /fn_parse_sku_breakdown/.test(x.identity)) ?? packet.cat.functions[0]; const id = f.identity;
  const mut = (sql) => { assert.equal(pg.psql(DB, sql).status, 0, sql); };
  const only = (re, n = 1) => { const d = verifyFunctions(pg, DB, packet).filter((x) => x.startsWith(id)); assert.equal(d.length, n, JSON.stringify(d)); assert.ok(d.some((x) => re.test(x)), JSON.stringify(d)); };
  const clean = () => assert.deepEqual(verifyFunctions(pg, DB, packet).filter((x) => x.startsWith(id)), []);
  const probe = (apply, undo, re, n = 1) => { mut(apply); try { only(re, n); } finally { mut(undo); } clean(); };
  probe(`GRANT EXECUTE ON FUNCTION ${id} TO anon`, `REVOKE EXECUTE ON FUNCTION ${id} FROM anon`, /ACL/);
  probe(`REVOKE EXECUTE ON FUNCTION ${id} FROM PUBLIC`, `GRANT EXECUTE ON FUNCTION ${id} TO PUBLIC`, /ACL/);
  probe(`ALTER FUNCTION ${id} SET work_mem = '8MB'`, `ALTER FUNCTION ${id} RESET work_mem`, /configuration|SHA differs/);       // a SET clause is part of the definition text
  probe(`ALTER FUNCTION ${id} SECURITY DEFINER`, `ALTER FUNCTION ${id} SECURITY INVOKER`, /SECURITY DEFINER|SHA differs/);
  mut(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='g7_tmp_owner') THEN CREATE ROLE g7_tmp_owner NOLOGIN; END IF; END $$`);
  probe(`ALTER FUNCTION ${id} OWNER TO g7_tmp_owner`, `ALTER FUNCTION ${id} OWNER TO ${f.owner}`, /owner/, 2); mut(`DROP ROLE g7_tmp_owner`);   // a new owner changes the owner AND the owner-derived default ACL
  // a missing function and a changed body are both reported
  const body = pg.psql(DB, `SELECT pg_get_functiondef(to_regprocedure('${id}'))`).out;
  mut(`DROP FUNCTION ${id}`); try { only(/MISSING/); } finally { mut(body); mut(`ALTER FUNCTION ${id} OWNER TO ${f.owner}`); }
  clean();
});
T('S2 comes from the packet (INSTALLED baseline, never replayed): RPCs and tables present, zero signed rows, lock helpers still client-executable before S3', () => {
  assert.equal(val(`SELECT string_agg(proname, ',' ORDER BY proname) FROM pg_proc WHERE proname IN ('mis_sign_batch_stage_v1','mis_correct_batch_stage_v1')`), 'mis_correct_batch_stage_v1,mis_sign_batch_stage_v1');
  assert.equal(val(`SELECT count(*) FROM app_private.mis_batch_stage_event`), '0');
  assert.equal(val(`SELECT to_regclass('app_private.mis_g7_s3_baseline') IS NULL`), 't');                          // S3 not applied yet
  assert.equal(val(`SELECT has_function_privilege('authenticated','app_private.mis_lock_fg_batch(integer,text)','EXECUTE')`), 't');
});
T('S3 .. S5 apply in order against the captured schema with the REAL pinned fingerprint checks (no seeding in production-equivalent mode)', () => {
  if (!REAL) assert.equal(pg.psql(DB, seedShimFingerprintsSql()).status, 0);                                         // self-test only: stand-in functions are not the live ones
  for (const f of MIGRATIONS.slice(1)) { const r = pg.psql(DB, migText(f)); assert.equal(r.status, 0, `${f}: ${r.err}`); }
  assert.equal(val(`SELECT count(*) FROM app_private.mis_g7_s3b_expected_sha`), '11');
  if (REAL) for (const [fn, sha] of Object.entries(PINNED)) assert.equal(val(`SELECT sha FROM app_private.mis_g7_s3b_expected_sha WHERE obj='${fn}'`), sha, fn);   // literal live pins, not test-derived
  assert.equal(val(`SELECT has_function_privilege('authenticated','app_private.mis_lock_fg_batch(integer,text)','EXECUTE') OR has_function_privilege('authenticated','app_private.mis_lock_fg_batches(integer,text,integer,text)','EXECUTE')`), 'f');   // S3 closes both helpers
});
T('S5b produces the accepted patched core SHA; wrapper and parser unchanged; ENFORCE still refused until sign-off', () => {
  const sha = (n) => val(`SELECT encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') FROM pg_proc p WHERE p.proname='${n}' AND p.pronamespace='public'::regnamespace`);
  assert.equal(sha('rpc_update_daily_work_log_with_packaging__core'), 'df7290df4a17e4af9f0aed43cf564007a35b957d8899b98869d7d35531296aec');
  const r = pg.psql(DB, migText(PATCHED_CORE_MIGRATION)); assert.equal(r.status, 0, r.err);
  assert.equal(sha('rpc_update_daily_work_log_with_packaging__core'), 'dfa5a5e9aa31b48cf41fe9d03800fff2e35e5a3825ca458b5ccb6ca6c4471bcc'); assert.equal(PATCHED_CORE_SHA, 'dfa5a5e9aa31b48cf41fe9d03800fff2e35e5a3825ca458b5ccb6ca6c4471bcc');
  assert.equal(sha('rpc_update_daily_work_log_with_packaging'), '4c82b4a3263f3f868e8ac4dc696f5b68efd58e593fe4adb4d92a7ec7fb1bd7b4');
  assert.equal(sha('fn_parse_sku_breakdown'), 'ec5fe3ead3e839d4ccad6c9f7e37c5775e1299c0b46ad71cc9a6b9eb7c5b29db');
  assert.equal(val(`SELECT app_private.mis_g7_core_gate()`), 'CORE_MIGRATION_NOT_ACCEPTED');                         // patched but not signed off: ENFORCE stays closed
  assert.equal(val(`SELECT mode FROM app_private.mis_g7_enforcement`), 'AUDIT');
  // no global setting was changed by any migration
  assert.equal(val(`SELECT count(*) FROM pg_db_role_setting WHERE setconfig::text ILIKE '%variable_conflict%'`), '0');
});
T('BUSINESS-FLOW acceptance (signing, atomic pack/excess, correction, editor chain, concurrency, rollback with fixtures) needs synthetic fixtures written against the captured schema', (t) => {
  if (!REAL) return t.skip('BLOCKED in self-test: business flows are exercised by the three shim-based suites; production-equivalent fixtures are authored after the first real capture');
  assert.fail('author supabase/tests/mis_g7/prod_equivalent/fixtures_real.sql against the captured schema, then extend this file (see README_PROD_EQUIVALENT.md)');
});
