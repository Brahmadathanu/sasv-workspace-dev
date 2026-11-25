import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { parseArgs, exportTable, RUN_ID, TABLES } from './archive-run87.mjs';

test('archive CLI is tightly scoped and bounded',()=>{
  assert.equal(RUN_ID,87);
  assert.equal(TABLES.length,2);
  assert.throws(()=>parseArgs(['--run-id','143','--out','/tmp/x']),/run 87/);
  assert.throws(()=>parseArgs(['--run-id','87','--out','/tmp/x','--page-size','50000']),/page-size/);
  assert.equal(parseArgs(['--run-id','87','--out','/tmp/x']).pageSize,500);
});
test('streams exact JSON, checks SHA, retains numeric precision',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'sasv-s3f-'));
  const samples=[
    {row_id:'9',row_json:'{"id":9,"big_decimal":123456789123456789.123456789}'},
    {row_id:'12',row_json:'{"id":12,"text":"Hello \\u0d2e"}'}
  ];
  const calls=[];
  const client={query:async(sql,params)=>{
    calls.push({sql,params});
    return {rows:samples.filter(x=>BigInt(x.row_id)>BigInt(params[1])).slice(0,params[2])};
  }};
  try {
    const result=await exportTable(client,{name:'marketing_signed_billed_sales_evidence_snapshot',expected:2},dir,10);
    const data=gunzipSync(await readFile(join(dir,result.filename))).toString('utf8');
    assert.equal(data,samples.map(x=>x.row_json+'\n').join(''));
    assert.equal(result.jsonlSha256,createHash('sha256').update(data).digest('hex'));
    assert.equal(result.count,2);
    assert.ok(calls.every(x=>x.sql.includes('WHERE t.refresh_run_id = $1')));
    assert.ok(calls.every(x=>x.params[0]===87));
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('rejects count drift without leaving export',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'sasv-s3f-drift-'));
  const client={query:async()=>({rows:[]})};
  try {
    await assert.rejects(()=>exportTable(client,{name:'marketing_regional_sales_evidence_snapshot',expected:100},dir,10),/archive rejected/);
    await assert.rejects(()=>readFile(join(dir,'marketing_regional_sales_evidence_snapshot.jsonl.gz')));
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('direct-FK archiver pages on (tableoid, ctid) so partitioned parents lose no rows', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('./archive-run87-direct-fks.mjs', import.meta.url), 'utf8');
  assert.match(src, /ORDER BY t\.tableoid::oid,t\.ctid/);
  assert.match(src, /cursorOid=r\.toid/);
});

test('S3R script is PowerShell 5.1 compatible, ASCII-only and demands distinct physical disks', async () => {
  const { readFile } = await import('node:fs/promises');
  const ps = await readFile(new URL('./run87-secure-archive-windows.ps1', import.meta.url), 'utf8');
  assert.doesNotMatch(ps, /[^\x00-\x7F]/);
  assert.match(ps, /#Requires -Version 5\.1/);
  assert.match(ps, /share physical disk/);
});

test('no authentication material is tracked in git (SCRAM verifiers, DPAPI files, role passwords)', async () => {
  const { execFileSync } = await import('node:child_process');
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.equal(files.filter(f => /\.dpapi$|R2_02_enable_login\.sql$/.test(f)).length, 0);
  const { readFile } = await import('node:fs/promises');
  for (const f of files.filter(f => /(^|\/)(route2\/|tools\/).*\.(sql|ps1|mjs|sh)$/.test(f))) {
    const txt = await readFile(f, 'utf8');
    assert.doesNotMatch(txt, /SCRAM-SHA-256\$\d+:/, `verifier-like string in ${f}`);
  }
});

test('SEC-01 package: separate, minimal, fail-closed, identical pin lists, no direct-DB eAushadhi clients', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const dir = 'docs/master-data-costing/sql/sec01/';
  const rd = f => readFile(dir + f, 'utf8');
  const s00 = await rd('S1_00_discover_public_definer_functions.sql');
  const s01 = await rd('S1_01_revoke_public_execute_eaushadhi_rpc.sql');
  const s02 = await rd('S1_02_verify_public_execute_revoked.sql');
  const s99 = await rd('S1_99_rollback_restore_public_execute.sql');
  const s03 = await rd('S1_03_role_compatibility_assessment.sql');
  // Only the two reviewed statements change privileges; discovery/verify are read-only.
  assert.match(s00, /BEGIN READ ONLY/); assert.match(s02, /BEGIN READ ONLY/); assert.match(s03, /BEGIN READ ONLY/);
  for (const t of [s00, s02]) assert.doesNotMatch(t, /\b(GRANT|REVOKE|ALTER|DROP|CREATE)\b(?![^\n]*--)(?=\s+(?:EXECUTE|ON|ROLE|FUNCTION|TABLE))/);
  assert.equal([...s01.matchAll(/EXECUTE format\('([^']*)'/g)].map(m => m[1]).filter(x => !/^SELECT /.test(x)).join('|'), 'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC');
  assert.equal([...s99.matchAll(/EXECUTE format\('([^']*)'/g)].map(m => m[1]).filter(x => !/^SELECT /.test(x)).join('|'), 'GRANT EXECUTE ON FUNCTION %s TO PUBLIC');
  for (const t of [s01, s02, s99]) {
    assert.match(t, /c_expected constant int := 10/);
    assert.match(t, /pinned list not populated/);
    assert.doesNotMatch(t, /DROP (ROLE|OWNED)|ALTER ROLE|BYPASSRLS|DISABLE TRIGGER|DELETE FROM|TRUNCATE/i);
    assert.doesNotMatch(t, /SCRAM-SHA-256\$/);
  }
  // Pin arrays are identical across S1_01 / S1_02 / S1_99 (and still empty until the owner approves a list).
  const pin = t => t.match(/c_pinned constant text\[\] := (ARRAY\[[^;]*\]::text\[\]);/)[1];
  assert.equal(pin(s01), pin(s02)); assert.equal(pin(s01), pin(s99)); assert.equal(pin(s01), pin(s03));
  const entries = [...pin(s01).matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.equal(entries.length, 10); assert.equal(new Set(entries).size, 10);
  for (const e of entries) assert.match(e, /^public\.rpc_eaushadhi_[a-z_]+\([a-z, ]*\)\|[0-9a-f]{32}$/);
  assert.deepEqual(entries.map(e => e.split('|')[0]).sort(), entries.map(e => e.split('|')[0]));
  assert.match(s01, /c_accepted_losers constant text\[\] := ARRAY\[\]::text\[\];/);
  // SEC-01 must stay separate from Route 2 role creation.
  for (const t of [s01, s02, s99]) assert.doesNotMatch(t, /CREATE ROLE|GRANT SELECT|R2_0[1-5]/);
  assert.deepEqual((await readdir(dir)).sort(), ['S1_00_discover_public_definer_functions.sql','S1_01_revoke_public_execute_eaushadhi_rpc.sql','S1_02_verify_public_execute_revoked.sql','S1_03_role_compatibility_assessment.sql','S1_99_rollback_restore_public_execute.sql','S1_FIXTURE_ACCEPTANCE.sh']);
  // Every eAushadhi client calls RPCs through PostgREST/Supabase API roles (anon/authenticated/service_role),
  // which keep their explicit EXECUTE grants; none connects as a direct database login.
  const { execFileSync } = await import('node:child_process');
  const files = execFileSync('git', ['ls-files', 'electron/eaushadhi-worker', 'public/shared/js/eaushadhi-review-api.js', 'supabase/functions/eaushadhi-qc-report-verify'], { encoding: 'utf8' }).split('\n').filter(f => /\.(js|ts|mjs)$/.test(f));
  assert.ok(files.length > 5);
  for (const f of files) assert.doesNotMatch(await readFile(f, 'utf8'), /require\(['"]pg['"]\)|from ['"]pg['"]|postgres(ql)?:\/\//, `direct DB client in ${f}`);
});
