#!/usr/bin/env node
/**
 * S3Q - bounded READ-ONLY internal FK cross-run safety audit.
 * Scope: explicitly one historical run, 87; no production data exports.
 * Reads PostgreSQL catalog and tests every internal FK in BOTH directions.
 * A timeout, SQL error, missing constraint, or count drift is a blocking UNKNOWN.
 * NEVER regard a PASS as permission to delete: archive, approvals, normal
 * consumer provenance and non-FK references remain independent gates.
 */
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const PILOT_RUN = 87;
const allowed = /^[a-z_][a-z0-9_]*$/;
const quote = id => {
  if (!allowed.test(id)) throw new Error('Unexpected SQL identifier: '+id);
  return '"'+id+'"';
};
function qualified(schema,table) {return quote(schema)+'.'+quote(table);}

export async function loadFkEdges(client) {
  const {rows}=await client.query(`
    WITH direct AS (
      SELECT c.conrelid AS relid, a.attname AS run_column
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
      WHERE c.contype='f' AND c.confrelid='costing.costing_refresh_run'::regclass
        AND array_length(c.conkey,1)=1
    )
    SELECT
      f.conname AS fk_name,
      child_n.nspname AS child_schema, child.relname AS child_table,
      parent_n.nspname AS parent_schema, parent.relname AS parent_table,
      dc.run_column AS child_run_column, dp.run_column AS parent_run_column,
      array_agg(ca.attname::text ORDER BY u.n) AS child_columns,
      array_agg(pa.attname::text ORDER BY u.n) AS parent_columns
    FROM pg_constraint f
    JOIN direct dc ON dc.relid=f.conrelid
    JOIN direct dp ON dp.relid=f.confrelid
    JOIN pg_class child ON child.oid=f.conrelid
    JOIN pg_namespace child_n ON child_n.oid=child.relnamespace
    JOIN pg_class parent ON parent.oid=f.confrelid
    JOIN pg_namespace parent_n ON parent_n.oid=parent.relnamespace
    JOIN LATERAL unnest(f.conkey,f.confkey) WITH ORDINALITY u(child_att,parent_att,n) ON TRUE
    JOIN pg_attribute ca ON ca.attrelid=f.conrelid AND ca.attnum=u.child_att
    JOIN pg_attribute pa ON pa.attrelid=f.confrelid AND pa.attnum=u.parent_att
    WHERE f.contype='f'
    GROUP BY f.oid,f.conname,child_n.nspname,child.relname,
      parent_n.nspname,parent.relname,dc.run_column,dp.run_column
    ORDER BY child_n.nspname,child.relname,f.conname
  `);
  for (const edge of rows) {
    for (const value of [edge.child_schema,edge.child_table,edge.parent_schema,
        edge.parent_table,edge.child_run_column,edge.parent_run_column,...edge.child_columns,...edge.parent_columns])
      quote(value);
    if (edge.child_schema!=='costing'||edge.parent_schema!=='costing'
        ||edge.child_columns.length!==edge.parent_columns.length)
      throw new Error('Unsafe FK catalog topology');
  }
  return rows;
}
export function edgeQueries(edge) {
  const child=qualified(edge.child_schema,edge.child_table);
  const parent=qualified(edge.parent_schema,edge.parent_table);
  const join=edge.child_columns.map((key,i) =>
    'c.'+quote(key)+' = p.'+quote(edge.parent_columns[i])).join(' AND ');
  const cRun='c.'+quote(edge.child_run_column),pRun='p.'+quote(edge.parent_run_column);
  return [
    {direction:'child_run87_to_other_parent',
      sql:`SELECT EXISTS (SELECT 1 FROM ${child} c JOIN ${parent} p ON ${join}
      WHERE ${cRun} = $1 AND ${pRun} IS DISTINCT FROM $1 LIMIT 1) AS crossing`},
    {direction:'other_child_to_parent_run87',
      sql:`SELECT EXISTS (SELECT 1 FROM ${child} c JOIN ${parent} p ON ${join}
      WHERE ${pRun} = $1 AND ${cRun} IS DISTINCT FROM $1 LIMIT 1) AS crossing`}
  ];
}
export async function auditCrossRun(client, {expectedEdges=62,timeoutMs=2500}={}) {
  if (!Number.isInteger(expectedEdges)||expectedEdges<1||expectedEdges>200)
    throw Error('Invalid expected FK count');
  if (!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>10000)
    throw Error('Invalid per-statement budget');
  let tx=false;const checks=[];
  try{
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    tx=true;
    await client.query(`SET LOCAL statement_timeout = '${timeoutMs}ms'`);
    const run=(await client.query(
      'SELECT period_start::text AS period_start,overall_status FROM costing.costing_refresh_run WHERE id=$1',
      [PILOT_RUN])).rows[0];
    if(!run||run.period_start!=='2026-09-01'||run.overall_status!=='SUCCESS')
      throw Error('Pilot run identity/status drift');
    const edges=await loadFkEdges(client);
    if(edges.length!==expectedEdges) throw Error(`FK topology drift: expected ${expectedEdges}, found ${edges.length}`);
    for(const edge of edges) {
      for(const direction of edgeQueries(edge)) {
        // One failed SQL statement would abort the read-only transaction:
        // savepoint + rollback to savepoint lets the remaining checks run.
        await client.query('SAVEPOINT s3q_edge');
        try {
          const r=await client.query(direction.sql,[PILOT_RUN]);
          checks.push({fk:edge.fk_name,child:edge.child_schema+'.'+edge.child_table,
            parent:edge.parent_schema+'.'+edge.parent_table,direction:direction.direction,
            outcome:r.rows[0]?.crossing===true?'BLOCK_CROSS_RUN':'PASS',
          });
          await client.query('RELEASE SAVEPOINT s3q_edge');
        } catch(error) {
          await client.query('ROLLBACK TO SAVEPOINT s3q_edge');
          await client.query('RELEASE SAVEPOINT s3q_edge');
          checks.push({fk:edge.fk_name,child:edge.child_schema+'.'+edge.child_table,
            parent:edge.parent_schema+'.'+edge.parent_table,direction:direction.direction,
            outcome:'UNKNOWN_ERROR_OR_TIMEOUT',sqlstate:error.code??'UNKNOWN'});
        }
      }
    }
    const blockers=checks.filter(c=>c.outcome!=='PASS');
    const evidenceHash=createHash('sha256').update(JSON.stringify(checks)).digest('hex');
    return {sourceRunId:PILOT_RUN,expectedEdges,checksExpected:expectedEdges*2,
      checksPerformed:checks.length,passed:checks.length-blockers.length,
      blocked:blockers.length,decision:blockers.length===0?'FK_LINKS_ONLY_PASS':'HOLD',
      evidenceSha256:evidenceHash,blockers,
      limitedScope:'ONLY_DATABASE_FK_EDGES__NOT_FULL_CONSUMER_OR_ARCHIVE_CLEARANCE'};
  } finally {
    if(tx)await client.query('ROLLBACK').catch(()=>{});
  }
}
async function main(){
  if(process.argv.length!==2)throw Error('No arguments: run 87 only');
  const url=process.env.SASV_AUDIT_DATABASE_URL;
  if(!url)throw Error('Read-only SASV_AUDIT_DATABASE_URL required');
  const {default:pg}=await import('pg');
  const client=new pg.Client({connectionString:url,application_name:'sasv-s3q-readonly-fk-audit'});
  try{await client.connect();const result=await auditCrossRun(client);
    console.log(JSON.stringify(result));
    if(result.decision!=='FK_LINKS_ONLY_PASS')process.exitCode=2;
  }finally{await client.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e=>{console.error('S3Q:',e.message);process.exitCode=2;});
