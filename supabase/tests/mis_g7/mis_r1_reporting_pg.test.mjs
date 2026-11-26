// R1 exact DDL + synthetic source fixture. Local ephemeral PostgreSQL only; never connects to production.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPg } from './pg_harness.mjs';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/executive-mis-g7-server');
const read=n=>fs.readFileSync(path.join(dir,n),'utf8');
let pg, blocked, baselineSales, baselinePage, baselineInv, baselineACL;
const db='mis_r1_fixture';
const q=(sql,opts)=>{const r=pg.psql(db,sql,opts);assert.equal(r.status,0,r.err+' :: '+sql.slice(0,300));return r.out;};
const one=(sql,opts)=>q(sql,opts).split('\n').at(-1);
const asJson=sql=>JSON.parse(one(sql));
const T=(name,fn)=>test(name,async t=>{if(blocked)return t.skip(blocked);await fn();});
const canonicalKeys=['canonical_rm_known_value','canonical_rm_item_count','canonical_rm_valuation_gap_count','canonical_pm_known_value','canonical_pm_item_count','canonical_pm_valuation_gap_count','canonical_ind_known_value','canonical_ind_item_count','canonical_ind_valuation_gap_count','inventory_known_value','unclassified_known_value','unclassified_item_count','valuation_gap_item_count','zero_quantity_item_count','duplicate_item_row_count','missing_item_id_count','canonical_inventory_scope_note'];
const aclQuery=`select jsonb_agg(x order by name) from (select c.relname name,c.relacl::text acl,pg_get_userbyid(c.relowner) owner,c.reloptions::text opts from pg_class c where c.oid in ('public.v_mis_sales_tab_summary'::regclass,'public.v_mis_inventory_tab_summary'::regclass) union all select p.proname,p.proacl::text,pg_get_userbyid(p.proowner),p.proconfig::text from pg_proc p where p.oid in ('public.get_mis_sales_product_page(text,integer,integer)'::regprocedure,'public.get_mis_inventory_item_page(text,text,integer,integer)'::regprocedure)) x`;
const pageQuery=`select jsonb_agg(x order by product_id) from public.get_mis_sales_product_page('',100,0) x`;
before(()=>{
  pg=startPg();if(!pg){blocked='BLOCKED: local PostgreSQL binaries unavailable';return;}
  pg.createDb(db);
  q(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
  CREATE TABLE public.products(id bigint primary key,item text);
  INSERT INTO public.products VALUES(1,'Shared name'),(2,'Shared name'),(3,'Historical product');
  CREATE TABLE public.r1_raw_sales(sales_date date,sku_id bigint,product_id bigint,godown_id bigint,region_id bigint,qty_units numeric,qty_billed numeric,billed_amount numeric,source_key text,inserted_at timestamptz,mapped boolean);
  INSERT INTO public.r1_raw_sales VALUES
  ('2026-11-01',101,1,1,1,10,9,100,'a',now(),true),
  ('2026-11-24',101,1,1,1,-2,-2,-20,'b',now(),true),
  ('2026-11-24',102,2,1,1,8,8,80,'c',now(),true),
  ('2026-10-31',103,3,1,1,100,100,1000,'d',now(),true),
  ('2026-11-25',999,99,1,1,100,100,9999,'e',now(),false),
  (NULL,104,1,1,1,1,1,1000,'f',now(),true);
  CREATE VIEW public.v_sales_daily_normalized WITH(security_invoker=true) AS SELECT sales_date,sku_id,product_id,godown_id,region_id,qty_units,qty_billed,billed_amount,source_key,inserted_at FROM public.r1_raw_sales WHERE mapped;
  CREATE TABLE public.r1_raw_inventory(source_kind text,inv_stock_item_id bigint,code text,name text,qty_value numeric,avg_rate_value numeric,category_code text,category_label text,subcategory_label text,group_label text,subgroup_label text);
  INSERT INTO public.r1_raw_inventory SELECT kind,id,'I'||id,'Item '||id,qty,rate,cat,CASE cat WHEN 'RM' THEN 'Raw Material' WHEN 'PM' THEN 'Packing Material' WHEN 'IND' THEN 'Indirect Materials & Utilities' END,NULL,NULL,NULL FROM (VALUES
  ('rm',1,2::numeric,10::numeric,'RM'),('plm',2,3,4,'PM'),('consumable',3,1,5,'IND'),('fuel',4,4,3,'IND'),('consumable',5,2,7,'RM'),('rm',6,0,NULL,'RM'),('rm',7,2,NULL,'RM'),('plm',8,5,0,'PM'),('fuel',9,1,-2,'IND'),('rm',10,1,9,NULL),('plm',11,NULL,3,'PM'),('consumable',12,-1,5,'IND')) a(kind,id,qty,rate,cat);
  CREATE VIEW public.v_stock_current_by_item WITH(security_invoker=true) AS SELECT * FROM public.r1_raw_inventory;
  `);
  q(read('R1_LIVE_BASELINE.sql'));
  q(`GRANT SELECT ON public.products,public.r1_raw_sales,public.r1_raw_inventory,public.v_sales_daily_normalized,public.v_stock_current_by_item,public.v_mis_sales_tab_summary,public.v_mis_inventory_tab_summary TO authenticated,service_role;
  REVOKE EXECUTE ON FUNCTION public.get_mis_sales_product_page(text,integer,integer),public.get_mis_inventory_item_page(text,text,integer,integer) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.get_mis_sales_product_page(text,integer,integer),public.get_mis_inventory_item_page(text,text,integer,integer) TO authenticated,service_role;`);
  baselineSales=asJson('select to_jsonb(v) from public.v_mis_sales_tab_summary v');
  baselinePage=asJson(pageQuery);
  baselineInv=asJson('select to_jsonb(v) from public.v_mis_inventory_tab_summary v');
  baselineACL=asJson(aclQuery);
  q('BEGIN;\n'+read('R1_SERVER_CANDIDATE.sql')+'\nCOMMIT;');
});
after(()=>{if(pg)pg.stop();});
T('R1 exact candidate DDL compiles; sales summary and complete page preserve baseline arithmetic',()=>{
  assert.deepEqual(asJson('select to_jsonb(v) from public.v_mis_sales_tab_summary v'),baselineSales);
  assert.deepEqual(asJson(pageQuery),baselinePage);
  assert.equal(baselineSales.report_date,'2026-11-24');assert.equal(Number(baselineSales.month_to_date_sales_value),160);
});
T('sales ties, search, bounds and signed returns',()=>{
  assert.equal(one("select product_id from public.get_mis_sales_product_page('',1,0)"),'1');
  assert.equal(one("select product_id from public.get_mis_sales_product_page('',1,1)"),'2');
  assert.equal(one("select count(*) from public.get_mis_sales_product_page('Shared name',25,0)"),'2');
  assert.equal(one("select count(*) from public.get_mis_sales_product_page('absent',25,0)"),'0');
  assert.equal(one("select count(*) from public.get_mis_sales_product_page('',25,20)"),'0');
});
T('sales NULL-only and empty mapped source preserve null/date/count contract',()=>{
  for(const deletion of ["DELETE FROM public.r1_raw_sales WHERE sales_date IS NOT NULL","DELETE FROM public.r1_raw_sales"]){
    assert.equal(one(`BEGIN; ${deletion}; SELECT report_date IS NULL AND month_to_date_sales_value IS NULL AND sales_days_available_in_month=0 FROM public.v_mis_sales_tab_summary; ROLLBACK;`),'t');
    assert.equal(one(`BEGIN; ${deletion}; SELECT count(*) FROM public.get_mis_sales_product_page('',25,0); ROLLBACK;`),'0');
  }
});
T('canonical summary preserves every legacy column even when source kind disagrees with category',()=>{
  const data=asJson('select to_jsonb(v) from public.v_mis_inventory_tab_summary v');
  const legacy={...data};for(const key of canonicalKeys)delete legacy[key];assert.deepEqual(legacy,baselineInv);
  assert.equal(data.canonical_rm_item_count,4);assert.equal(data.canonical_pm_item_count,3);assert.equal(data.canonical_ind_item_count,4);
  assert.equal(Number(data.canonical_rm_known_value),34);assert.equal(Number(data.canonical_pm_known_value),12);assert.equal(Number(data.canonical_ind_known_value),12);
  assert.equal(Number(data.inventory_known_value),67);assert.equal(data.unclassified_item_count,1);assert.equal(Number(data.unclassified_known_value),9);
  assert.equal(data.valuation_gap_item_count,4);assert.equal(data.canonical_rm_valuation_gap_count,1);assert.equal(data.canonical_pm_valuation_gap_count,2);assert.equal(data.canonical_ind_valuation_gap_count,1);
  assert.equal(data.zero_quantity_item_count,1);assert.equal(data.duplicate_item_row_count,0);assert.equal(data.missing_item_id_count,0);
});
T('canonical and legacy filters, stable paging, search and unavailable stock values',()=>{
  for(const [k,n] of Object.entries({all:12,RM:4,PM:3,IND:4,rm:4,plm:3,consumable:3,fuel:2})){
    assert.equal(one(`select count(*) from public.get_mis_inventory_item_page('${k}','',100,0)`),String(n));
  }
  assert.equal(one("select stock_value=0 from public.get_mis_inventory_item_page('all','I6',100,0) where inv_stock_item_id=6"),'t');
  assert.equal(one("select count(*) from public.get_mis_inventory_item_page('all','',100,0) where stock_value is null"),'4');
  assert.equal(one("select count(*) from public.get_mis_inventory_item_page('RM','Item 5',100,0)"),'1');
  assert.equal(one("select count(*) from public.get_mis_inventory_item_page('rm','Item 5',100,0)"),'0');
  assert.equal(one("select count(*) from public.get_mis_inventory_item_page('IND','',2,0) a join public.get_mis_inventory_item_page('IND','',2,2) b using(inv_stock_item_id)"),'0');
});
T('duplicate and missing item identity are exposed, not silently deduplicated',()=>{
  assert.equal(one("BEGIN; INSERT INTO public.r1_raw_inventory SELECT * FROM public.r1_raw_inventory WHERE inv_stock_item_id=1; SELECT duplicate_item_row_count FROM public.v_mis_inventory_tab_summary; ROLLBACK;"),'1');
  assert.equal(one("BEGIN; UPDATE public.r1_raw_inventory SET inv_stock_item_id=NULL WHERE inv_stock_item_id=1; SELECT missing_item_id_count FROM public.v_mis_inventory_tab_summary; ROLLBACK;"),'1');
});
T('ACL and invoker configuration unchanged; anonymous denied; authenticated fixture access',()=>{
  assert.deepEqual(asJson(aclQuery),baselineACL);
  assert.equal(one("select has_table_privilege('anon','public.v_mis_sales_tab_summary','SELECT') or has_table_privilege('anon','public.v_mis_inventory_tab_summary','SELECT') or has_function_privilege('anon','public.get_mis_sales_product_page(text,integer,integer)','EXECUTE') or has_function_privilege('anon','public.get_mis_inventory_item_page(text,text,integer,integer)','EXECUTE')"),'f');
  assert.equal(one("select count(*) from public.get_mis_sales_product_page('',25,0)",{uid:null}),'2');
  assert.equal(one("select count(*) from public.get_mis_inventory_item_page('IND','',100,0)",{uid:null}),'4');
});
T('parallel authenticated fixture reads under unchanged session timeout',async()=>{
  const rs=await Promise.all([pg.psqlAsync(db,"set statement_timeout='5s'; select month_to_date_sales_value from public.v_mis_sales_tab_summary",{uid:null}),pg.psqlAsync(db,"set statement_timeout='5s'; select count(*) from public.get_mis_sales_product_page('',25,0)",{uid:null})]);
  for(const r of rs)assert.equal(r.status,0,r.err);assert.equal(Number(rs[0].out),160);assert.equal(rs[1].out,'2');
});
T('exact forward recovery compiles, restores legacy results and marks canonical columns unavailable',()=>{
  q('BEGIN;\n'+read('R1_FORWARD_RECOVERY.sql')+'\nCOMMIT;');
  const data=asJson('select to_jsonb(v) from public.v_mis_inventory_tab_summary v');
  for(const key of canonicalKeys){assert.equal(data[key],null);delete data[key];}
  assert.deepEqual(data,baselineInv);assert.deepEqual(asJson(pageQuery),baselinePage);assert.deepEqual(asJson('select to_jsonb(v) from public.v_mis_sales_tab_summary v'),baselineSales);assert.deepEqual(asJson(aclQuery),baselineACL);
});
