import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startPg} from './pg_harness.mjs';
let pg;const db='ei_access_replay',exec='00000000-0000-0000-0000-000000000001',sales='00000000-0000-0000-0000-000000000002',denied='00000000-0000-0000-0000-000000000003';
const q=(s,uid)=>{const r=pg.psql(db,s,{uid});assert.equal(r.status,0,r.err);return r.out;};
const views=['v_mis_finance_outstanding_detail','v_mis_finance_outstanding_party_summary','v_mis_finance_tab_summary','v_mis_financial_position','v_mis_expense_position','v_mis_fg_inventory_position','v_mis_finished_goods_tab_summary','v_mis_inventory_position','v_mis_inventory_tab_summary','v_mis_batch_pipeline','v_mis_production_position','v_mis_production_tab_summary','v_mis_sales_position','v_mis_sales_tab_summary','mv_mis_executive_summary'];
const calls=['get_mis_finance_party_page()','get_mis_finished_goods_sku_page()','get_mis_inventory_item_page()','get_mis_sales_product_page()'];
const snapshot=(uid)=>Object.fromEntries([...views,...calls].map(n=>[n,q("select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb) from public."+n+" x",uid)]));
let old;
before(()=>{
 pg=startPg();assert.ok(pg,'PostgreSQL required');pg.createDb(db);
 q(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
 CREATE FUNCTION public.app_has_permission(t text,m text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT (auth.uid()='00000000-0000-0000-0000-000000000001' AND t='module:executive-mis-dashboard') OR (auth.uid()='00000000-0000-0000-0000-000000000002' AND t='module:sales-data-viewer') OR (auth.uid()='00000000-0000-0000-0000-000000000004' AND t='module:sales-item-classification')$$;
 GRANT USAGE ON SCHEMA auth TO authenticated,service_role;`);
 q(fs.readFileSync(new URL('./ei_access_live_catalog_fixture.sql',import.meta.url),'utf8'));
 q(`insert into public.v_stock_current_by_item(source_kind,inv_stock_item_id,name,qty_value,avg_rate_value,category_code) values('rm',1,'Fixture',2,10,'RM');
 insert into public.v_stock_checker(product_id,item,sku_id,stock_ik,stock_value_overall) values(1,'Fixture',1,2,20);
 insert into public.products(id,item) values(1,'Fixture');
 insert into public.v_sales_daily_normalized(sales_date,sku_id,product_id,qty_units,qty_billed,billed_amount) values(current_date,1,1,2,2,20);
 insert into public.tally_group_outstanding_snapshot(as_of_date,group_name,vendor_name,outstanding_amount_value) values(current_date,'Sundry Creditors','Fixture',20);`);
 // Add typed shims for the new candidate sequence; retain the exact legacy reporting definitions.
 q(`CREATE TABLE public.categories(id integer PRIMARY KEY,category_name text);
 CREATE TABLE public.sub_categories(id integer PRIMARY KEY,category_id integer,subcategory_name text);
 CREATE TABLE public.product_groups(id integer PRIMARY KEY,sub_category_id integer,group_name text);
 CREATE TABLE public.sub_groups(id integer PRIMARY KEY,product_group_id integer,sub_group_name text);
 CREATE TABLE public.product_skus(id bigint PRIMARY KEY,product_id bigint,pack_size numeric,uom text,is_active boolean,is_sample boolean,price_list_ik boolean,price_list_ok boolean);
 CREATE TABLE public.regions(id integer PRIMARY KEY,code text,name text);
 CREATE TABLE public.godowns(id integer PRIMARY KEY,code text,name text,region_id integer);
 CREATE FUNCTION public.normalize_key(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT lower(regexp_replace(trim(t),'[[:space:]]+',' ','g'))$$;
 CREATE TABLE public.sku_aliases(alias_text text NOT NULL,alias_key text GENERATED ALWAYS AS (lower(btrim(alias_text))) STORED PRIMARY KEY,sku_id bigint REFERENCES public.product_skus(id));
 CREATE TABLE public.godown_aliases(alias_text text,godown_id integer);
 CREATE TABLE public.tally_sales_vreg_snapshot(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,voucher_date date NOT NULL,tally_item_name text NOT NULL,godown_label text NOT NULL,act_qty_value numeric,bill_qty_value numeric,billed_amount_value numeric,source_key text,inserted_at timestamptz NOT NULL DEFAULT now(),UNIQUE(voucher_date,tally_item_name,godown_label));
 CREATE TABLE public.etl_jobs(id bigint,job_type text,vreg_date_extracted date,status text,finished_at timestamptz,created_at timestamptz);
 CREATE TABLE public.inv_stock_item(id bigint PRIMARY KEY);
 CREATE TABLE public.inv_stock_item_alias(tally_item_name text,inv_stock_item_id bigint,status text,source_system text,source_kind text);
 CREATE TABLE public.v_inv_stock_item_with_class(stock_item_id bigint,category_code text);
 CREATE TABLE public.permission_targets(key text PRIMARY KEY,kind text NOT NULL,label text NOT NULL,sort_order integer NOT NULL DEFAULT 1000,is_assignable boolean NOT NULL DEFAULT true,meta jsonb NOT NULL DEFAULT '{}');
 CREATE TABLE public.user_permissions_canonical(user_id uuid,target text REFERENCES public.permission_targets(key),can_view boolean,can_edit boolean,PRIMARY KEY(user_id,target));
 INSERT INTO public.permission_targets(key,kind,label) VALUES('module:executive-mis-dashboard','module','Executive Intelligence'),('module:sales-data-viewer','module','Sales Data Viewer');
 INSERT INTO public.user_permissions_canonical VALUES('00000000-0000-0000-0000-000000000001','module:executive-mis-dashboard',true,false),('00000000-0000-0000-0000-000000000002','module:sales-data-viewer',true,false);
 INSERT INTO public.categories VALUES(10,'First'),(20,'Second');
 INSERT INTO public.sub_categories VALUES(11,10,'First sub'),(21,20,'Second sub');
 INSERT INTO public.product_groups VALUES(12,11,'First group'),(22,21,'Second group');
 INSERT INTO public.sub_groups VALUES(13,12,'First subgroup'),(23,22,'Second subgroup');
 UPDATE public.products SET sub_group_id=13 WHERE id=1;
 INSERT INTO public.products(id,item,sub_group_id) VALUES(2,'Another',23);
 INSERT INTO public.product_skus VALUES(1,1,10,'g',true,false,true,true),(2,2,20,'g',true,false,true,true),(3,2,50,'g',false,false,false,false);
 INSERT INTO public.regions VALUES(17,'IK','Inside');
 INSERT INTO public.godowns VALUES(41,'A','Depot A',17);
 INSERT INTO public.sku_aliases(alias_text,sku_id) VALUES('FIXTURE  A',1),('FIXTURE B',2);
 INSERT INTO public.godown_aliases VALUES('DEPOT A',41);
 UPDATE public.v_sales_daily_normalized SET godown_id=41,region_id=17,source_key='batch-A',inserted_at='2026-11-01 00:00:00+00' WHERE sku_id=1;
 INSERT INTO public.v_sales_daily_normalized(sales_date,sku_id,product_id,godown_id,region_id,qty_units,qty_billed,billed_amount,source_key,inserted_at) VALUES(current_date,2,2,41,17,4,4,40,'batch-A','2026-11-01 00:00:00+00');
 INSERT INTO public.tally_sales_vreg_snapshot(voucher_date,tally_item_name,godown_label,act_qty_value,bill_qty_value,billed_amount_value,source_key,inserted_at) VALUES(current_date,'FIXTURE A','DEPOT A',2,2,20,'batch-A','2026-11-01 00:00:00+00'),(current_date,'FIXTURE B','DEPOT A',4,4,40,'batch-A','2026-11-01 00:00:00+00');
 CREATE MATERIALIZED VIEW app_private.sales_monthly AS SELECT date_trunc('month',sales_date)::date month_start,sku_id,product_id,region_id,godown_id,sum(qty_units) qty_units,sum(qty_billed) qty_billed,sum(billed_amount) billed_amount,max(inserted_at) source_max_inserted_at FROM public.v_sales_daily_normalized GROUP BY 1,2,3,4,5;
 CREATE SCHEMA cron;
 CREATE TABLE cron.job(jobid bigint PRIMARY KEY,username text,command text,active boolean);
 CREATE TABLE cron.job_run_details(jobid bigint,runid bigint PRIMARY KEY,username text,command text,status text,start_time timestamptz,end_time timestamptz,return_message text);
 INSERT INTO cron.job VALUES(17,'postgres','select public.refresh_sales_monthly();',true),(18,'postgres','other',true);
 INSERT INTO cron.job_run_details VALUES(17,1,'postgres','select public.refresh_sales_monthly();','failed',now()-interval '2 days',now()-interval '2 days','hidden error'),(17,2,'postgres','select public.refresh_sales_monthly();','succeeded',now()-interval '1 day',now()-interval '1 day','hidden success'),(18,3,'postgres','other','failed',now(),now(),'hidden other');
 GRANT SELECT ON ALL TABLES IN SCHEMA public,app_private TO authenticated;`);
 const pairs=[['CHENNINAYAKAM',207],['CHUKKU',241],['JATHIKKA PARIPPU',331],['JATHIPATHRI',332],['JEERAKAM',333],['KARUVAPPATTA - NAADAN',422],['KATAL NURA',430],['KOLARAKKU',475],['KURUMULAKU',527],['KUTA MANJAL',534],['NAKAM',643],['PASUVIN NEYYU',750],['PAVIZHA PUTTU',759],['THAKKOLAM',893],['YAVAM',1049]];
 for(const [n,id] of pairs)q("insert into public.inv_stock_item values("+id+"); insert into public.v_inv_stock_item_with_class values("+id+",'RM'); insert into public.inv_stock_item_alias values('"+n+"',"+id+",'mapped','tally','rm'); insert into public.tally_sales_vreg_snapshot(voucher_date,tally_item_name,godown_label,billed_amount_value) values((current_date-interval '2 months')::date,'"+n+" (S)','DEPOT A',1);");
 old=snapshot(exec);
 assert.notEqual(old.v_mis_inventory_tab_summary,'[]');
 assert.notEqual(old['get_mis_inventory_item_page()'],'[]');
 assert.equal(q('select count(*) from public.mv_mis_executive_summary',sales),'1');
 // Entire ordered candidate set in one transaction, not separate commits. Literal live catalog guard
 // is deliberately not substituted with fixture hashes: production pins are checked separately.
 // Replay the exact registered artifacts; only production fingerprint guard is replaced by the typed-fixture baseline.
 const migrations=['20261126102211_executive_intelligence_r3_r4_reporting_parity.sql','20261126103241_executive_intelligence_product_rows_type_fix.sql','20261126103624_executive_intelligence_facility_latency_fix.sql'];
 q("CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text);");
 for(const n of migrations){
  let sql=fs.readFileSync(new URL('../../migrations/'+n,import.meta.url),'utf8');
  if(n.startsWith('20261126102211')){const guard=fs.readFileSync(new URL('../../../docs/executive-mis-g7-server/R3_MIS_ACCESS_INSTALL_GUARD.sql',import.meta.url),'utf8').trim();if(!sql.includes(guard))throw Error('guard identity drift');sql=sql.replace(guard,'-- Production-only fingerprint guard verified independently.');}
  q(sql);
  q("INSERT INTO supabase_migrations.schema_migrations VALUES('"+n.slice(0,14)+"','"+n.slice(15,-4)+"');");
 }
});
after(()=>pg?.stop());
test('exact candidate preserves executive outputs',()=>assert.deepEqual(snapshot(exec),old));
test('all reporting views and pagination deny sales-only and unrelated authenticated roles',()=>{
 for(const uid of [sales,denied,null])for(const [n,v] of Object.entries(snapshot(uid)))assert.equal(v,'[]',n);
});
test('private summary direct select revoked but authorized wrapper and owner refresh remain available',()=>{
 assert.notEqual(pg.psql(db,'select * from app_private.mv_mis_executive_summary',{uid:exec}).status,0);
 assert.equal(q('select count(*) from public.mv_mis_executive_summary',exec),'1');
 q('refresh materialized view app_private.mv_mis_executive_summary');
 assert.equal(q('select count(*) from public.mv_mis_executive_summary'),'1');
});
test('shared upstream unchanged and anonymous JWT fails closed',()=>{
 assert.equal(q('select count(*) from public.v_stock_current_by_item',sales),'1');
 assert.equal(q("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false); select count(*) from public.mv_mis_executive_summary",exec).split('\n').at(-1),'0');
});

test('combined installation: sales-only MTD equals original executive report while legacy remains denied',()=>{
 const read=(n,uid)=>q("select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb) from public."+n+" x",uid);
 for(const uid of [exec,sales]){
  assert.equal(read('v_ei_sales_mtd_summary',uid),old.v_mis_sales_tab_summary);
  assert.equal(read('ei_sales_mtd_product_page()',uid),old['get_mis_sales_product_page()']);
 }
 for(const uid of [denied,null]){
  assert.equal(read('v_ei_sales_mtd_summary',uid),'[]');
  assert.equal(read('ei_sales_mtd_product_page()',uid),'[]');
  assert.equal(q("select count(*) from public.ei_sales_product_rows(date_trunc('month',current_date)::date,current_date)",uid),'0');
 }
});
test('combined installation: hierarchy filters, stable page-only export and grouped history',()=>{
 const j=s=>JSON.parse(q(s,sales));
 const d=j('select public.ei_sales_dimensions()');
 assert.equal(d.categories.length,2);assert.equal(d.subgroups.length,2);
 const comp=j('select public.ei_sales_comparison(p_category=>10,p_subcategory=>11,p_group_id=>12,p_subgroup=>13)');
 assert.equal(comp.periods.find(r=>r.label==='CURRENT').sales_value,20);
 const none=j('select public.ei_sales_comparison(p_category=>10,p_subgroup=>23)');
 assert.equal(none.periods.find(r=>r.label==='CURRENT').sales_value,null);
 const h=j("select public.ei_sales_history(p_months=>1,p_group=>'product',p_limit=>1)");
 assert.equal(h.total,2);assert.equal(h.rows.length,1);assert.equal(h.export_scope,'CURRENT_PAGE_ONLY');assert.equal(h.has_more,true);
 const filtered=j("select public.ei_sales_history(p_months=>1,p_group=>'subgroup_month',p_subgroup=>23)");
 assert.equal(filtered.total,1);assert.equal(filtered.rows[0].sales_value,40);
 const e=j('select public.ei_sales_exceptions(p_category=>20)');
 assert.ok(e.rows.some(r=>r.sku_id===3));assert.ok(e.rows.every(r=>r.product_id===2));
});
test('combined installation: repeated import key is not a transaction identity',()=>{
 const x=JSON.parse(q('select public.ei_sales_coverage()',sales));
 const day=x.days.find(d=>d.raw_rows===2);
 assert.ok(day);assert.equal(day.distinct_source_keys,1);assert.equal(day.uniquely_mapped_raw_rows,2);assert.equal(day.ambiguous_mapping_rows,0);assert.equal(day.state,'OBSERVED_NOT_CERTIFIED');
 assert.equal(q("select count(*) from public.ei_sales_product_rows(date_trunc('month',current_date)::date,current_date)",sales),'2');
});
test('combined installation: facility retains incompatible scope while product analytics excludes it',()=>{
 q("insert into public.sku_aliases(alias_text,sku_id) values('ASHTAGANDHA DHOOP 35 GM',1); insert into public.tally_sales_vreg_snapshot(voucher_date,tally_item_name,godown_label,act_qty_value,bill_qty_value,billed_amount_value,source_key) values(current_date,'ASHTAGANDHA DHOOP 35 GM','DEPOT A',5,5,500,'batch-A');");
 try{
  const f=JSON.parse(q('select public.ei_facility_sales_scope()',sales));
  assert.equal(f.rows.find(r=>r.scope==='CLASSIFICATION_CONFLICT').source_reported_amount,500);
  const p=JSON.parse(q('select public.ei_sales_comparison()',sales));
  assert.equal(p.periods.find(r=>r.label==='CURRENT').sales_value,60);
  assert.equal(q("select count(*) from public.ei_sales_product_rows(date_trunc('month',current_date)::date,current_date)",sales),'2');
 }finally{q("delete from public.tally_sales_vreg_snapshot where tally_item_name='ASHTAGANDHA DHOOP 35 GM'; delete from public.sku_aliases where alias_text='ASHTAGANDHA DHOOP 35 GM';");}
});
test('combined installation: bounded cron status and target registration do not broaden privileges',()=>{
 assert.equal(q("select count(*) from public.permission_targets where key='module:sales-item-classification'"),'1');
 assert.equal(q("select count(*) from public.user_permissions_canonical where target='module:sales-item-classification'"),'0');
 assert.equal(q("select count(*) from public.sales_item_scope where scope='RAW_MATERIAL'"),'15');
 const x=JSON.parse(q('select public.ei_sales_refresh_status()',sales));
 assert.equal(x.refresh_job_status,'succeeded');assert.equal(x.refresh_job.active,true);
 assert.equal(x.refresh_job.return_message,undefined);assert.equal(x.refresh_job.command,undefined);
 assert.notEqual(pg.psql(db,'select * from cron.job_run_details',{uid:sales}).status,0);
 assert.notEqual(pg.psql(db,'select app_private.ei_sales_refresh_job_status()',{uid:denied}).status,0);
});

test('bounded product source rejects oversized windows',()=>{
 assert.notEqual(pg.psql(db,"select count(*) from public.ei_sales_product_rows('2025-01-01','2026-12-31')",{uid:sales}).status,0);
 assert.equal(q("select count(*) from public.ei_sales_product_rows(null,null)",sales),'0');
});
test('combined installation: same effective date revisions resolve once, including conflict period',()=>{
 const editor='00000000-0000-0000-0000-000000000004';
 // Scope decision precedes canonical alias, then later revision at the same effective date.
 const id=Number(q("select public.sales_item_scope_approve('FUTURE LABEL','OTHER_MANUFACTURING_UNIT',current_date,'fixture decision')",editor));
 q("select public.sales_item_scope_approve('FUTURE LABEL','SASV_HISTORICAL_PACK',current_date,'fixture revision',"+id+")",editor);
 q("insert into public.sku_aliases(alias_text,sku_id) values('FUTURE LABEL',1); insert into public.tally_sales_vreg_snapshot(voucher_date,tally_item_name,godown_label,act_qty_value,bill_qty_value,billed_amount_value,source_key) values(current_date,'FUTURE LABEL','DEPOT A',1,1,10,'batch-A');");
 try{
  const x=JSON.parse(q('select public.ei_facility_sales_scope()',sales));
  assert.ok(!x.rows.some(r=>r.scope==='CLASSIFICATION_CONFLICT'));
  assert.equal(x.rows.find(r=>r.scope==='SASV_CANONICAL_PRODUCT').source_reported_amount,70);
  assert.equal(q("select count(*) from public.ei_sales_product_rows(current_date,current_date)",sales),'3');
 }finally{q("delete from public.tally_sales_vreg_snapshot where tally_item_name='FUTURE LABEL'; delete from public.sku_aliases where alias_text='FUTURE LABEL';");}
});
