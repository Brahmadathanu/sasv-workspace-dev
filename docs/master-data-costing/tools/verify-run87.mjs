#!/usr/bin/env node
// S3F offline archive integrity check. No database access.
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TABLES, RUN_ID } from './archive-run87.mjs';

export async function verifyArchive(dir) {
  const root = resolve(dir);
  const manifest = JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
  if (manifest.format!=='sasv-costing-run-jsonl-v1' ||
      manifest.sourceRunId!==RUN_ID || manifest.sourcePeriod!=='2026-09-01' ||
      !Array.isArray(manifest.tables) || manifest.tables.length!==TABLES.length ||
      manifest.restoreVerified!==false || manifest.productionDeletionAuthorised!==false)
    throw new Error('Invalid archive manifest or unsafe status');
  const receipts=[];
  for (const t of TABLES) {
    const e=manifest.tables.find(x=>x.table===`costing.${t.name}`);
    if (!e || e.filename!==`${t.name}.jsonl.gz` || e.count!==t.expected)
      throw new Error(`Archive manifest mismatch for ${t.name}`);
    const sha=createHash('sha256');
    const raw=createReadStream(join(root,e.filename)).pipe(createGunzip());
    const lines=createInterface({input:raw,crlfDelay:Infinity});
    let count=0;
    for await (const line of lines) {
      sha.update(line+'\n','utf8');
      // Do not round-trip archived numeric fields through JS numbers.
      if (!/^\{"id":/.test(line) || !/"refresh_run_id":87(?:,|\})/.test(line))
        throw new Error(`Unexpected row structure or run ID in ${t.name}`);
      count++;
    }
    if (count!==e.count || sha.digest('hex')!==e.jsonlSha256)
      throw new Error(`Digest/count mismatch in ${t.name}`);
    receipts.push({table:t.name,verifiedRows:count});
  }
  return receipts;
}
async function main() {
  if (process.argv.length!==3) throw new Error('Usage: node verify-run87.mjs <archive-directory>');
  const receipts=await verifyArchive(process.argv[2]);
  process.stdout.write(JSON.stringify({offlineDigestVerified:true,restoreTested:false,receipts})+'\n');
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(e=>{process.stderr.write(`S3F verification failed: ${e.message}\n`);process.exitCode=1;});
}
