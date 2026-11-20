// PEC-ERP-S3-E: isolated exact PostgreSQL 17.4 runtime verifier.
// Runs on an ephemeral Unix-socket cluster using synthetic records only.
// Exit 2 when PostgreSQL 17.4 is missing; NEVER production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {findPgBin,startCluster} from '../cde2-sql-candidate/pg-isolated.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const bin=findPgBin();
if(!bin){console.error('S3-E FAIL CLOSED: no PostgreSQL 17.4 runtime; tests NOT RUN');process.exit(2);}
const fixture=fs.readFileSync(path.join(here,'fixture.sql'),'utf8');
const candidate=fs.readFileSync(path.join(root,'docs/procurement-execution/ERP_S3_EXCESS_PAGED_SQL_CANDIDATE_20261111.sql'),'utf8');
let db,passed=0;
const UID='00000000-0000-4000-8000-000000000001';
const p=(o={})=>[
  o.search??'NULL',o.cls??'NULL',o.from??'NULL',o.to??'NULL',o.min??'NULL',
  o.vendor??'NULL',o.item??'NULL',o.unmapped??'false',o.limit??30,o.offset??0
].join(',');
function run(sql, {role='authenticated',view=true,allowError=false}={}){
  const text=`BEGIN;
SET LOCAL ROLE ${role};
SELECT set_config('request.jwt.claim.sub','${UID}',true);
SELECT set_config('pec.fixture.view','${view?'yes':'no'}',true);
${sql}
ROLLBACK;`;
  return db.run('s3',text,{allowError});
}
function query(opts={},auth={}){
  const r=run(`SELECT public.proc_pec_purchase_excess_paged(${p(opts)})::text;`,auth);
  if(r.status!==0)throw Error(r.err);
  return JSON.parse(r.out.split('\n').at(-1));
}
function good(name,check){check();console.log('PASS',name);passed++;}
function bad(name,opts,expect,auth={}){
  const r=run(`SELECT public.proc_pec_purchase_excess_paged(${p(opts)})::text;`,{...auth,allowError:true});
  good(name,()=>{assert.notEqual(r.status,0);assert.match(r.err,expect);});
}
try{
  db=startCluster(bin);
  const version=Number(db.run('postgres','show server_version_num;').out);
  if(version!==170004){console.error('S3-E FAIL CLOSED: requires exact PG17.4, found '+version);process.exitCode=2;}
  else {
    db.createDb('s3'); db.run('s3',fixture); db.run('s3',candidate);
    good('ACL anonymous denied',()=>{
      const r=db.run('s3',"select has_function_privilege('anon','public.proc_pec_purchase_excess_paged(text,text,date,date,numeric,text,text,boolean,integer,integer)','EXECUTE');");
      assert.equal(r.out,'f');
    });
    good('all rows counted; first page stable',()=>{
      const v=query();assert.equal(v.total_count,65);assert.equal(v.rows.length,30);
      assert.equal(v.limit,30);assert.equal(v.offset,0);
    });
    good('page concatenation 30+30+5 no missing/duplicate IDs',()=>{
      const pages=[0,30,60].map(offset=>query({offset}));
      assert.deepEqual(pages.map(x=>x.rows.length),[30,30,5]);
      const ids=pages.flatMap(x=>x.rows.map(r=>Number(r.purchase_fact_id)));
      assert.equal(new Set(ids).size,65);
      const oracle=db.run('s3',"select string_agg(purchase_fact_id::text,',' order by net_unallocated_qty desc nulls last,voucher_date desc nulls last,purchase_fact_id desc) from public.pec_excess_fixture;").out.split(',');
      assert.deepEqual(ids,oracle.map(Number));
    });
    good('beyond-end page retains total_count',()=>{
      const v=query({offset:300});assert.equal(v.total_count,65);assert.deepEqual(v.rows,[]);
    });
    good('literal percent matches one fixture item',()=>{
      const v=query({search:"'%'"});assert.equal(v.total_count,1);assert.equal(Number(v.rows[0].purchase_fact_id),1);
    });
    good('literal underscore matches one fixture item',()=>{
      const v=query({search:"'_'" });assert.equal(v.total_count,1);assert.equal(Number(v.rows[0].purchase_fact_id),2);
    });
    good('case-insensitive item name/code OR',()=>{
      const v=query({item:"'oIl'"});assert.ok(v.total_count>0);
      const code=query({item:"'code-3'"});assert.ok(code.total_count>0);
    });
    good('material code aliases PLM to PM',()=>{
      const pm=query({cls:"'PM'"}),plm=query({cls:"'PLM'"});
      assert.deepEqual(pm.rows,plm.rows);assert.equal(pm.total_count,plm.total_count);
    });
    good('unmapped includes NULL and empty vendor',()=>{
      const v=query({unmapped:'true'});
      assert.ok(v.total_count>0);assert.ok(v.rows.every(x=>x.vendor_display_name==null||x.vendor_display_name===''));
    });
    good('inclusive date boundaries',()=>{
      const v=query({from:"'2026-11-11'::date",to:"'2026-11-11'::date"});
      assert.ok(v.total_count>0);assert.ok(v.rows.every(x=>x.voucher_date==='2026-11-11'));
    });
    good('nonpositive minimum quantity is ignored',()=>{
      assert.equal(query({min:'0'}).total_count,65);
      assert.equal(query({min:'-1'}).total_count,65);
    });
    bad('reject excessive page limit',{limit:201},/p_limit must be between/);
    bad('reject zero page limit',{limit:0},/p_limit must be between/);
    bad('reject negative offset',{offset:-1},/p_offset must be nonnegative/);
    bad('reject inverted date range',{from:"'2026-11-11'",to:"'2026-11-01'"},/Invalid date range/);
    bad('no-view denied',{},/PEC view denied/,{view:false});
    bad('anon denied',{},/permission denied for function/i,{role:'anon'});
    console.log(`PEC S3-E isolated PG17.4: ${passed} passed. Synthetic only.`);
  }
}catch(e){console.error('S3-E verifier FAILED',e.stack||String(e));process.exitCode=1;}
finally{db?.stop();}
