#!/usr/bin/env node
// S3P: typed TEMP-table restore verification of all directly run-linked archive
// relations. Not a production import and not a full FK-dependent restore proof.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { verifyDirectArchive } from './verify-run87-direct-fks.mjs';
import { readJsonLines, assertStageConnection } from './restore-verify-run87.mjs';

function ident(x){if(!/^[a-z_][a-z0-9_]*$/.test(x))throw Error('Unsafe table name');return '"'+x+'"';}
export async function restoreDirectToTemp(client,dir,opts={}) {
  const expected=opts.expectedRelations??64;
  const pageSize=opts.pageSize??200;
  if(!Number.isInteger(pageSize)||pageSize<10||pageSize>500)throw Error('Invalid page size');
  await verifyDirectArchive(dir);
  const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
  if(manifest.relationCount!==expected)throw Error('Direct relation count drift');
  let transaction=false;
  try{
    await client.query('BEGIN');
    transaction=true;
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query("SET LOCAL lock_timeout='3s'");
    await client.query("SET LOCAL statement_timeout='20min'");
    let total=0,index=0;
    for(const t of manifest.tables){
      const bits=t.table.split('.');
      if(bits.length!==2||bits[0]!=='costing')throw Error('Unexpected schema');
      const full=ident(bits[0])+'.'+ident(bits[1]);
      const temp='s3p_temp_'+(++index);
      // No INCLUDING IDENTITY: real costing contains 12 GENERATED ALWAYS
      // identities and 19 BY DEFAULT identities. Original identity ID values
      // are loaded as normal bigint columns in TEMP to verify their semantics.
      // No FK cloning: this verifies typed rows, not referential recovery.
      await client.query(`CREATE TEMP TABLE ${ident(temp)} (LIKE ${full} INCLUDING CONSTRAINTS) ON COMMIT DROP`);
      let inserted=0,batch=[];
      const flush=async()=>{
        if(!batch.length)return;
        const {rowCount}=await client.query(
          `INSERT INTO ${ident(temp)} SELECT (jsonb_populate_record(NULL::${full},j.doc)).*
           FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS j(doc,ord)
           ORDER BY j.ord`,['['+batch.join(',')+']']);
        inserted+=rowCount;batch=[];
      };
      for await(const line of readJsonLines(join(dir,t.filename))){
        batch.push(line);if(batch.length>=pageSize)await flush();
      }
      await flush();
      if(inserted!==t.count)throw Error('Typed table restore count mismatch: '+t.table);
      const hash=createHash('sha256');let last='(0,0)',read=0;
      while(true){
        const {rows}=await client.query(
          `SELECT ctid::text AS tid,row_to_json(z)::text AS json_line FROM ${ident(temp)} z
           WHERE ctid>$1::tid ORDER BY ctid LIMIT $2`,[last,pageSize]);
        if(!rows.length)break;
        for(const row of rows){hash.update(row.json_line+'\n');last=row.tid;read++;}
        if(rows.length<pageSize)break;
      }
      if(read!==t.count||hash.digest('hex')!==t.sha256UncompressedJsonl)
        throw Error('Typed restored digest mismatch: '+t.table);
      total+=read;
    }
    return {typedTempRestoreVerified:true,relationCount:manifest.relationCount,verifiedRows:total,
      productionDataChanged:false,nestedFkRestored:false};
  }finally{if(transaction)await client.query('ROLLBACK');}
}
async function main(){
  if(process.argv.length!==3)throw Error('Usage: node restore-verify-run87-direct-fks.mjs <archive>');
  const conn=process.env.SASV_ISOLATED_STAGE_DATABASE_URL;
  if(!conn)throw Error('Missing isolated stage DSN');
  assertStageConnection(conn,process.env.SASV_STAGE_RESTORE_ATTESTATION);
  const {default:pg}=await import('pg');
  const client=new pg.Client({connectionString:conn});
  try{await client.connect();const r=await restoreDirectToTemp(client,resolve(process.argv[2]));console.log(JSON.stringify(r));}
  finally{await client.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e=>{console.error('S3P:',e.message);process.exitCode=1;});
