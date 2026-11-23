#!/usr/bin/env node
// S3F read-only two-table archive for historical run 87.
// No deletion, restore, schema changes, or scheduler operations.
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createGzip } from 'node:zlib';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

export const RUN_ID = 87;
export const TABLES = Object.freeze([
  { name: 'marketing_signed_billed_sales_evidence_snapshot', expected: 108982 },
  { name: 'marketing_regional_sales_evidence_snapshot', expected: 108982 },
]);
export function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (!['--run-id', '--out', '--page-size'].includes(argv[i]) || !argv[i+1])
      throw new Error(`Unknown or incomplete argument: ${argv[i] ?? '(missing)'}`);
    if (opts[argv[i]] !== undefined) throw new Error(`Repeated argument ${argv[i]}`);
    opts[argv[i]] = argv[++i];
  }
  if (opts['--run-id'] !== String(RUN_ID)) throw new Error('This tool is scoped to historical run 87 only');
  if (!opts['--out']) throw new Error('--out must name a dedicated new directory');
  const pageSize = opts['--page-size'] === undefined ? 500 : Number(opts['--page-size']);
  if (!Number.isInteger(pageSize) || pageSize < 10 || pageSize > 2000)
    throw new Error('page-size must be 10–2000');
  return { out: resolve(opts['--out']), pageSize };
}
export async function exportTable(client, item, outputDir, pageSize) {
  // Table identifier is from the fixed allowlist and never user input.
  const table = `costing.${item.name}`;
  const target = join(outputDir, `${item.name}.jsonl.gz`);
  const partial = target + '.partial';
  const rawSha = createHash('sha256');
  const gzip = createGzip({ level: 6 });
  const output = createWriteStream(partial, { flags: 'wx' });
  gzip.pipe(output);
  let count = 0;
  let lastId = '0';
  try {
    while (true) {
      const { rows } = await client.query(
        `SELECT t.id::text AS row_id, row_to_json(t)::text AS row_json
         FROM ${table} t
         WHERE t.refresh_run_id = $1 AND t.id > $2::bigint
         ORDER BY t.id ASC LIMIT $3`, [RUN_ID, lastId, pageSize]);
      if (!rows.length) break;
      for (const r of rows) {
        const line = r.row_json + '\n'; // Never parse high-precision numerics into JS.
        rawSha.update(line, 'utf8');
        if (!gzip.write(line, 'utf8')) await once(gzip, 'drain');
        count++;
        lastId = r.row_id;
      }
      if (rows.length < pageSize) break;
    }
    gzip.end();
    await finished(output);
    if (count !== item.expected)
      throw new Error(`${item.name}: ${count} rows, expected ${item.expected}; archive rejected`);
    await rename(partial, target);
    return { table, filename: `${item.name}.jsonl.gz`, count, firstColumn: 'id', lastId,
      jsonlSha256: rawSha.digest('hex') };
  } catch (error) {
    gzip.destroy();
    output.destroy();
    await rm(partial, {force:true}).catch(() => {});
    throw error;
  }
}
export async function archiveRun(client, outputDir, pageSize=500) {
  await mkdir(outputDir, {recursive:true});
  if ((await readdir(outputDir)).length) throw new Error('Output directory is not empty');
  let tx = false;
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    tx = true;
    const {rows:run} = await client.query(
      'SELECT id::text AS id, period_start::text, overall_status FROM costing.costing_refresh_run WHERE id=$1',[RUN_ID]);
    if (run.length!==1 || run[0].period_start!=='2026-09-01' || run[0].overall_status!=='SUCCESS')
      throw new Error('Run 87 identity/status does not match verified fixture');
    const {rows:protections} = await client.query(`SELECT
      EXISTS(SELECT 1 FROM costing.costing_run_designation WHERE refresh_run_id=$1) AS has_designation,
      EXISTS(SELECT 1 FROM costing.material_review_acceptance_register WHERE source_refresh_run_id=$1) AS material_reference,
      EXISTS(SELECT 1 FROM costing.regional_marketing_evidence_acceptance WHERE source_refresh_run_id=$1) AS regional_reference,
      EXISTS(SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance WHERE source_refresh_run_id=$1) AS sales_reference,
      EXISTS(SELECT 1 FROM costing.cost_driver_policy_cutover_acceptance WHERE accepted_refresh_run_id=$1) AS driver_reference,
      EXISTS(SELECT 1 FROM costing.manufacturing_cost_behaviour_split WHERE reference_refresh_run_id=$1) AS behaviour_reference,
      EXISTS(SELECT 1 FROM costing.costing_period_refresh_authorization WHERE consumed_by_run_id=$1) AS authorization_reference,
      EXISTS(SELECT 1 FROM costing.v_costing_period_run_status WHERE displayed_run_id=$1 OR approved_run_id=$1) AS displayed_or_approved`, [RUN_ID]);
    if (!protections.length || Object.values(protections[0]).some(Boolean))
      throw new Error('Run 87 is protected; archive refused');
    const manifests = [];
    for (const item of TABLES) manifests.push(await exportTable(client,item,outputDir,pageSize));
    await client.query('COMMIT');
    tx = false;
    const manifest = {format:'sasv-costing-run-jsonl-v1',sourceRunId:RUN_ID,
      sourcePeriod:'2026-09-01',generatedAt:new Date().toISOString(),
      snapshot:'PostgreSQL REPEATABLE READ READ ONLY',
      scope:'two sales evidence leaf tables only; NOT a full-run backup',
      tables:manifests,restoreVerified:false,productionDeletionAuthorised:false};
    await writeFile(join(outputDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
    return manifest;
  } catch(err) {
    if (tx) await client.query('ROLLBACK').catch(()=>{});
    await rm(outputDir,{recursive:true,force:true}).catch(()=>{});
    throw err;
  }
}
async function main() {
  const {out,pageSize}=parseArgs(process.argv.slice(2));
  const url=process.env.SASV_ARCHIVE_DATABASE_URL;
  if (!url) throw new Error('SASV_ARCHIVE_DATABASE_URL must be set for read-only Postgres access');
  const {default:pg}=await import('pg');
  const client=new pg.Client({connectionString:url,application_name:'sasv-s3f-readonly-archive'});
  try {
    await client.connect();
    const manifest=await archiveRun(client,out,pageSize);
    process.stdout.write(`Read-only archive completed: ${manifest.tables.map(t=>t.count).join(' + ')} rows. Manifest at ${join(out,'manifest.json')}\n`);
  } finally { await client.end(); }
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(err=>{process.stderr.write(`S3F: ${err.message}\n`);process.exitCode=1;});
}
