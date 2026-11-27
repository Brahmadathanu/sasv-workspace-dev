// S3L OFFLINE-ONLY safety checks for the stage executor.
// Uses Node built-in test runner. These tests inspect source patterns and
// cannot establish SQL compilation, role isolation or row-level correctness.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const s=readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'S3K_STAGE_ONLY_RETENTION_EXECUTOR_REVIEW.sql'),'utf8');
const checks=[
 ['stage-only declaration',/DO NOT APPLY TO PRODUCTION/.test(s)],
 ['never create credentials', !/\bCREATE\s+ROLE\b/i.test(s)],
 ['required NOINHERIT direct login',s.includes('rolcanlogin AND NOT rolbypassrls AND NOT rolinherit')],
 ['private schema nonexistence guard',s.includes('private schema already exists')],
 ['status guard source fingerprint',s.includes('2fc573625296de9ccde5d722fdd4a3de')],
 ['designation guard source fingerprint',s.includes('5629ce76254a5ed45cde5529ce91caee')],
 ['four enabled guard triggers gate',s.includes('expected four active run immutability triggers')],
 ['designation trigger not replaced',!s.includes('CREATE OR REPLACE FUNCTION costing.fn_guard_designated_run_rows')],
 ['only executor receives execute',s.includes('GRANT EXECUTE ON FUNCTION costing_retention.execute_leaf_batch(bigint)')&&s.includes('TO sasv_retention_executor')],
 ['archive and restore hashes',s.includes('archive_sha256')&&s.includes('restore_receipt_sha256')],
 ['batch limit 500',s.includes('LIMIT 500 FOR UPDATE')],
 ['run 87 only',s.includes('a.refresh_run_id <> 87')],
 ['terminal delete checks private predicate',s.includes('costing_retention.is_authorized_leaf_delete(v_run,TG_TABLE_NAME)')],
 ['any designation history rejects',s.includes('NOT EXISTS(SELECT 1 FROM costing.costing_run_designation')],
 ['approved pointer rejects',s.includes('v_approved=a.refresh_run_id')],
 ['all six governance reference categories present',[
  'material_review_acceptance_register','regional_marketing_evidence_acceptance',
  'sales_allocation_quantity_driver_acceptance','cost_driver_policy_cutover_acceptance',
  'manufacturing_cost_behaviour_split','costing_period_refresh_authorization'
 ].every(t=>s.includes(t))],
 ['transaction and backend binding',s.includes('txid_current()')&&s.includes('pg_backend_pid()')],
 ['direct session login check',s.includes("session_user <> 'sasv_retention_executor'")],
 ['count drift abort',s.includes('S3K_DENIED_ROW_COUNT_DRIFT')],
 ['private approval tables revoked',s.includes('REVOKE ALL ON ALL TABLES IN SCHEMA costing_retention')],
 ['no trigger disable DDL',!/\bDISABLE\s+TRIGGER\b/i.test(s.replace(/--[^\n]*/g,''))],
 ['no run-status spoof DML',!/\bUPDATE\s+costing\.costing_refresh_run\b/i.test(s)],
 ['no delete cascade construct',!/\bDELETE\s+FROM\b[\s\S]*\bCASCADE\b/i.test(s.replace(/--[^\n]*/g,''))]
];
for(const [label,ok] of checks) test(label,()=>assert.equal(ok,true));
