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
