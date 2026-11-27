#!/usr/bin/env node
// S3G: Restore archival evidence into TRANSACTION-LOCAL TEMP tables on an
// independently isolated PostgreSQL database. Never touches original tables.
// It ROLLBACKs after verification and never marks production deletion as safe.
// Fails closed unless an isolated connection is operator-attested.
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { verifyArchive } from './verify-run87.mjs';
import { TABLES, RUN_ID } from './archive-run87.mjs';

const CONFIRM='ISOLATED_STAGE_RESTORE_RUN87_NOT_PRODUCTION';
export function assertStageConnection(connectionString, attestation) {
  if(attestation!==CONFIRM) throw new Error('Isolated staging attestation not supplied');
  const u=new URL(connectionString);
  if(!['postgres:','postgresql:'].includes(u.protocol)) throw new Error('Not a PostgreSQL URL');
  const full=decodeURIComponent(u.toString()).toLowerCase();
  if(full.includes('qhmoqtxpeasamtlxaoak')) throw new Error('SASV production project ref detected: refusing connection');
  if(!u.hostname || !u.pathname.slice(1)) throw new Error('Missing staging host/database');
  // This is NOT proof of isolation: an operator must independently confirm
  // hostname/credentials against a separately restored staging database.
}
export async function* readJsonLines(file) {
  const stream=createReadStream(file).pipe(createGunzip());
  const lines=createInterface({input:stream,crlfDelay:Infinity});
  try { for await(const line of lines) {
    if(line) yield line;
  }} finally { lines.close(); stream.destroy(); }
}
export async function performRestoreVerification(client, archiveDir, opts={}) {
  const pageSize=opts.pageSize??200;
  if(!Number.isInteger(pageSize)||pageSize<10||pageSize>500) throw new Error('Invalid page size');
  // Verify offline before even beginning staged temp-table writes.
  await verifyArchive(archiveDir);
  const manifest=JSON.parse(await readFile(join(archiveDir,'manifest.json'),'utf8'));
  let inTransaction=false;
  const receipts=[];
  try {
    await client.query('BEGIN');
    inTransaction=true;
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '10min'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '12min'");
    for(const item of TABLES) {
      // Identifiers from immutable allowlist: no dynamic user table names.
      const source=`costing.${item.name}`;
      const temp=`s3g_restore_${item.name}`;
      await client.query(`CREATE TEMP TABLE ${temp} (LIKE ${source} INCLUDING CONSTRAINTS INCLUDING INDEXES INCLUDING IDENTITY INCLUDING GENERATED) ON COMMIT DROP`);
      const details=manifest.tables.find(t=>t.table===source);
      let inserted=0;
      let batch=[];
      const flush=async()=>{
        if(!batch.length) return;
        // JSON text is transmitted as $1, retaining decimal/token precision
        // until PostgreSQL casts values into the original column types.
        const {rowCount}=await client.query(
          `INSERT INTO ${temp} SELECT (jsonb_populate_record(NULL::${source}, j.doc)).*
           FROM jsonb_array_elements($1::jsonb) AS j(doc)`,['['+batch.join(',')+']']);
        inserted+=rowCount;
        batch=[];
      };
      for await(const row of readJsonLines(join(archiveDir,details.filename))) {
        if(!/^\{"id":/.test(row) || !new RegExp('"refresh_run_id":'+RUN_ID+'(?:,|\\})').test(row))
          throw new Error('Invalid run identity in '+item.name);
        batch.push(row);
        if(batch.length>=pageSize) await flush();
      }
      await flush();
      if(inserted!==item.expected) throw new Error('Count mismatch restoring '+item.name);
      // Re-read temp rows through same PostgreSQL projection/ordering used
      // for archive; verify byte-for-byte SHA256 of serialized JSONL.
      const hash=createHash('sha256');
      let lastId='0',checked=0;
      while(true) {
        const {rows}=await client.query(
          `SELECT t.id::text AS row_id, row_to_json(t)::text AS row_json FROM ${temp} t
           WHERE t.id>$1::bigint ORDER BY t.id LIMIT $2`,[lastId,pageSize]);
        if(!rows.length) break;
        for(const row of rows){hash.update(row.row_json+'\n','utf8');checked++;lastId=row.row_id;}
        if(rows.length<pageSize) break;
      }
      if(checked!==item.expected||hash.digest('hex')!==details.jsonlSha256)
        throw new Error('Typed restore digest mismatch for '+item.name);
      receipts.push({table:source,rows:checked,typedRestoreDigestMatched:true});
    }
    return {runId:RUN_ID,isolatedTempRestoreVerified:true,productionDataChanged:false,receipts};
  } finally {
    if(inTransaction) await client.query('ROLLBACK');
  }
}
async function main() {
  if(process.argv.length!==3) throw new Error('Usage: node restore-verify-run87.mjs <archive-directory>');
  const url=process.env.SASV_ISOLATED_STAGE_DATABASE_URL;
  if(!url) throw new Error('Provide SASV_ISOLATED_STAGE_DATABASE_URL (NOT production)');
  assertStageConnection(url,process.env.SASV_STAGE_RESTORE_ATTESTATION);
  const {default:pg}=await import('pg');
  const client=new pg.Client({connectionString:url,application_name:'sasv-s3g-stage-temp-restore'});
  try {await client.connect();const receipt=await performRestoreVerification(client,resolve(process.argv[2]));process.stdout.write(JSON.stringify(receipt,null,2)+'\n');}
  finally{await client.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main().catch(e=>{process.stderr.write('S3G restore: '+e.message+'\n');process.exitCode=1;});
}
