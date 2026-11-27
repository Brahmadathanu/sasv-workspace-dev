#!/usr/bin/env node
// S3N generic direct-FK archive verifier. Offline only, no database actions.
import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
export async function verifyDirectArchive(out) {
  const manifest=JSON.parse(await readFile(join(out,'manifest.json'),'utf8'));
  if(manifest.format!=='sasv-direct-fk-archive-v1' ||
     manifest.sourceRunId!==87 || manifest.period!=='2026-09-01' ||
     manifest.completeness!=='DIRECT_RUN_FK_ONLY__NOT_FULL_RECOVERY' ||
     manifest.restoreVerified!==false || manifest.productionDeletionAuthorised!==false ||
     !Array.isArray(manifest.tables) || manifest.relationCount!==manifest.tables.length)
     throw Error('Untrusted or incomplete manifest');
  let rows=0;
  const visited=new Set();
  for(const table of manifest.tables) {
    if(!/^costing\.[a-z_][a-z0-9_]*$/.test(table.table) ||
       !/^[a-z_][a-z0-9_]*$/.test(table.runColumn) ||
       table.filename!==table.table+'.jsonl.gz' ||
       visited.has(table.filename))throw Error('Untrusted table name/duplicate');
    visited.add(table.filename);
    const hash=createHash('sha256');
    const lines=createInterface({input:createReadStream(join(out,table.filename)).pipe(createGunzip()),crlfDelay:Infinity});
    let n=0;
    for await(const line of lines){
      hash.update(line+'\n');n++;
      // Caller has access to sensitive raw JSON; do NOT echo row content.
    }
    if(n!==table.count || hash.digest('hex')!==table.sha256UncompressedJsonl)
      throw Error('Archive digest or count mismatch: '+table.table);
    rows+=n;
  }
  return {relationCount:visited.size,verifiedRows:rows,scope:manifest.completeness,restoreTested:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  verifyDirectArchive(resolve(process.argv[2]||'')).then(r=>console.log(JSON.stringify(r)))
    .catch(e=>{console.error('S3N:',e.message);process.exitCode=1;});
