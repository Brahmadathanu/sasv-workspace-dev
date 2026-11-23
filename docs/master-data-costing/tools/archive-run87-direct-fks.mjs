#!/usr/bin/env node
// S3N: PostgreSQL READ-ONLY archive of every direct run-header FK relation.
// This is NOT full-run recovery: descendants without direct run_id and
// non-FK business references are explicitly OUT OF SCOPE.
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { resolve, join } from 'node:path';
import { createGzip } from 'node:zlib';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
const RUN=87;
const ensureIdentifier = s => { if(!/^[a-z_][a-z0-9_]*$/.test(s))throw Error('Unexpected identifier: '+s);return '"'+s+'"'; };
export function assertRelation(row) {
  if (row.schema_name !== 'costing' || !row.table_name || !row.run_column) throw Error('Non-costing or missing FK metadata');
  for (const k of ['schema_name','table_name','run_column']) ensureIdentifier(row[k]);
}
export async function directRelations(client) {
  const {rows}=await client.query(`SELECT n.nspname AS schema_name,c.relname AS table_name,
    att.attname AS run_column, con.conname AS fk_name,con.confdeltype AS fk_action,
    pg_total_relation_size(c.oid)::text AS allocated_bytes,
    EXISTS(SELECT 1 FROM pg_constraint f WHERE f.contype='f' AND f.confrelid=c.oid) AS has_incoming_fk,
    EXISTS(SELECT 1 FROM pg_trigger tr WHERE tr.tgrelid=c.oid AND NOT tr.tgisinternal AND tr.tgenabled<>'D') AS has_business_trigger
    FROM pg_constraint con
    JOIN pg_class c ON c.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute att ON att.attrelid=c.oid AND att.attnum=con.conkey[1]
    WHERE con.contype='f' AND con.confrelid='costing.costing_refresh_run'::regclass
      AND n.nspname='costing' AND array_length(con.conkey,1)=1
    ORDER BY n.nspname,c.relname,att.attname`);
  const keys=new Set();
  for (const row of rows) {
    assertRelation(row);
    const key=[row.schema_name,row.table_name,row.run_column].join('.');
    if(keys.has(key)) throw Error('Duplicated direct FK mapping: '+key);
    keys.add(key);
  }
  return rows;
}
export async function archiveDirectRelation(client,row,out,pageSize) {
  assertRelation(row);
  const table=ensureIdentifier(row.schema_name)+'.'+ensureIdentifier(row.table_name);
  const column=ensureIdentifier(row.run_column);
  const filename=row.schema_name+'.'+row.table_name+'.jsonl.gz';
  const partial=join(out,filename+'.partial');
  const target=join(out,filename);
  const hash=createHash('sha256');
  const gzip=createGzip({level:6});
  const output=createWriteStream(partial,{flags:'wx'});
  gzip.pipe(output);
  let cursor='(0,0)',count=0;
  try {
    while(true) {
      const {rows}=await client.query(
        `SELECT t.ctid::text AS tid,row_to_json(t)::text AS json_line
         FROM ${table} t WHERE t.${column}=$1 AND t.ctid>$2::tid
         ORDER BY t.ctid LIMIT $3`,[RUN,cursor,pageSize]);
      if(!rows.length)break;
      for(const r of rows) {
        const line=r.json_line+'\n';
        hash.update(line);
        if(!gzip.write(line)) await once(gzip,'drain');
        cursor=r.tid;count++;
      }
      if(rows.length<pageSize)break;
    }
    gzip.end();await finished(output);
    const exact=(await client.query(
      `SELECT count(*)::text AS n FROM ${table} t WHERE t.${column}=$1`,[RUN])).rows[0].n;
    if(BigInt(exact)!==BigInt(count))throw Error('Row count mismatch '+table);
    await fs.rename(partial,target);
    return {
      table:row.schema_name+'.'+row.table_name,runColumn:row.run_column,
      fkName:row.fk_name,fkAction:row.fk_action,
      hasIncomingFk:row.has_incoming_fk,hasBusinessTrigger:row.has_business_trigger,
      filename,count,sha256UncompressedJsonl:hash.digest('hex'),
      extractionCursor:'physical ctid within REPEATABLE READ snapshot'
    };
  }catch(e){gzip.destroy();output.destroy();await fs.rm(partial,{force:true}).catch(()=>{});throw e;}
}
export async function archiveDirectRun(client,out,expectedRelations=64,pageSize=500) {
  await fs.mkdir(out,{recursive:true});
  if((await fs.readdir(out)).length)throw Error('Archive directory must be empty');
  let tx=false;
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    tx=true;
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const run=(await client.query(
      "SELECT id,period_start::text AS period_start,overall_status FROM costing.costing_refresh_run WHERE id=$1",[RUN])).rows[0];
    if(!run||run.period_start!=='2026-09-01'||run.overall_status!=='SUCCESS')
      throw Error('Historical run identity drift');
    const protectedRun=(await client.query(`SELECT
      EXISTS(SELECT 1 FROM costing.costing_run_designation WHERE refresh_run_id=$1) AS designated,
      EXISTS(SELECT 1 FROM costing.v_costing_period_run_status WHERE displayed_run_id=$1 OR approved_run_id=$1) AS displayed
    `,[RUN])).rows[0];
    if(Object.values(protectedRun).some(Boolean))throw Error('Designated/displayed run; not a pilot');
    const relations=await directRelations(client);
    if(relations.length!==expectedRelations)
      throw Error(`Direct FK inventory drift: ${relations.length} vs ${expectedRelations}`);
    const inventory=[];
    for(const rel of relations)inventory.push(await archiveDirectRelation(client,rel,out,pageSize));
    await client.query('COMMIT');tx=false;
    const manifest={
      format:'sasv-direct-fk-archive-v1',sourceRunId:RUN,period:'2026-09-01',
      generatedAt:new Date().toISOString(),isolation:'REPEATABLE READ READ ONLY',
      completeness:'DIRECT_RUN_FK_ONLY__NOT_FULL_RECOVERY',
      relationCount:inventory.length,tables:inventory,
      nestedFkRestored:false,restoreVerified:false,productionDeletionAuthorised:false
    };
    await fs.writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
    return manifest;
  }catch(e){if(tx)await client.query('ROLLBACK').catch(()=>{});await fs.rm(out,{recursive:true,force:true}).catch(()=>{});throw e;}
}
function args(argv){
  const o={};for(let i=0;i<argv.length;i+=2)o[argv[i]]=argv[i+1];
  if(argv.length%2||o['--run-id']!=='87'||!o['--out'])throw Error('Usage: --run-id 87 --out PRIVATE_DIR [--expected-relations N]');
  const expected=Number(o['--expected-relations']??64);
  if(!Number.isInteger(expected)||expected<1||expected>100)throw Error('Invalid relation expectation');
  return {out:resolve(o['--out']),expected};
}
async function main(){
  const {out,expected}=args(process.argv.slice(2));
  if(!process.env.SASV_ARCHIVE_DATABASE_URL)throw Error('Set private SASV_ARCHIVE_DATABASE_URL');
  const {default:pg}=await import('pg');
  const client=new pg.Client({connectionString:process.env.SASV_ARCHIVE_DATABASE_URL});
  try{await client.connect();const x=await archiveDirectRun(client,out,expected);process.stdout.write(JSON.stringify({relationCount:x.relationCount,rows:x.tables.reduce((a,t)=>a+t.count,0),scope:x.completeness})+'\n');}
  finally{await client.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e=>{process.stderr.write('S3N: '+e.message+'\n');process.exitCode=1;});
