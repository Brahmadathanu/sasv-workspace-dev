import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {assertStageConnection,readJsonLines} from './restore-verify-run87.mjs';

test('requires explicit attestation for isolated restore',()=>{
  assert.throws(()=>assertStageConnection('postgresql://stage:pass@localhost:5432/stage',''),/attestation/);
  assert.doesNotThrow(()=>assertStageConnection('postgresql://stage:pass@localhost:5432/stage','ISOLATED_STAGE_RESTORE_RUN87_NOT_PRODUCTION'));
});
test('rejects SASV production database in URL, including URL-encoded string',()=>{
  const prod='postgresql://postgres:secret@db.qhmoqtxpeasamtlxaoak.supabase.co:5432/postgres';
  assert.throws(()=>assertStageConnection(prod,'ISOLATED_STAGE_RESTORE_RUN87_NOT_PRODUCTION'),/production/);
  assert.throws(()=>assertStageConnection('postgresql://postgres.qhmoqtxpeasamtlxaoak:secret@aws-0-ap-south-1.pooler.supabase.com/postgres','ISOLATED_STAGE_RESTORE_RUN87_NOT_PRODUCTION'),/production/);
});
test('gzip JSONL reader streams rows without JS decimal parsing',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'sasv-s3g-'));
  try {
    const content='{"id":9,"decimal":123456789123456789.123456789,"refresh_run_id":87}\n{"id":11,"refresh_run_id":87}\n';
    const f=join(dir,'fixture.gz');
    await writeFile(f,gzipSync(content));
    const rows=[];
    for await (const row of readJsonLines(f)) rows.push(row);
    assert.deepEqual(rows,content.trimEnd().split('\n'));
  }finally{await rm(dir,{recursive:true,force:true});}
});
