// Isolated extended EI fixture, no network or live credentials.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startPg} from './pg_harness.mjs';
const db='ei_extended',sales='00000000-0000-0000-0000-000000000002',editor='00000000-0000-0000-0000-000000000004',denied='00000000-0000-0000-0000-000000000003',executive='00000000-0000-0000-0000-000000000001';
let pg;
const q=(s,uid)=>{const r=pg.psql(db,s,{uid});assert.equal(r.status,0,r.err);return r.out;};
const j=(s,uid=sales)=>JSON.parse(q(s,uid));
const load=n=>q(fs.readFileSync(new URL('../../../docs/executive-mis-g7-server/'+n,import.meta.url),'utf8'));
before(()=>{
 pg=startPg();assert.ok(pg,'PostgreSQL required, no silent skips');pg.createDb(db);
 q(` CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
 CREATE SCHEMA auth;CREATE SCHEMA app_private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
 CREATE FUNCTION public.app_has_permission(t text,m text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT (auth.uid()='00000000-0000-0000-0000-000000000001' AND t='module:executive-mis-dashboard') OR (auth.uid()='00000000-0000-0000-0000-000000000002' AND t='module:sales-data-viewer') OR (auth.uid()='00000000-0000-0000-0000-000000000004' AND t='module:sales-item-classification') OR (auth.uid()='00000000-0000-0000-0000-000000000005' AND t='module:sales-item-classification' AND m='edit')$;
 CREATE TABLE public.categories(id integer PRIMARY KEY,category_name text);
 CREATE TABLE public.sub_categories(id integer PRIMARY KEY,category_id integer,subcategory_name text);
 CREATE TABLE public.product_groups(id integer PRIMARY KEY,sub_category_id integer,group_name text);
 CREATE TABLE public.sub_groups(id integer PRIMARY KEY,product_group_id integer,sub_group_name text);
 CREATE TABLE public.products(id bigint PRIMARY KEY,item text,sub_group_id integer);
 CREATE TABLE public.product_skus(id integer PRIMARY KEY,product_id bigint,pack_size numeric,uom text,is_active boolean,price_list_ik boolean,price_list_ok boolean);
 CREATE TABLE public.regions(id integer PRIMARY KEY,code text,name text);
 CREATE TABLE public.godowns(id integer PRIMARY KEY,code text,name text,region_id integer);
 INSERT INTO public.regions VALUES(17,'IK','Inside'),(31,'OK','Outside');
 INSERT INTO public.godowns VALUES(41,'A','Depot A',17),(52,'B','Depot B',31);
 INSERT INTO public.products VALUES(1,'Same',NULL),(2,'Same',NULL),(3,'Absent',NULL),(4,'Missing',NULL);
 INSERT INTO public.product_skus VALUES(101,1,100,'g',true,true,false),(102,2,200,'mL',true,true,true),(103,3,1,'Nos',true,true,false),(104,4,1,'Nos',true,false,true),(105,3,10,'g',false,false,false);
 CREATE TABLE public.v_sales_daily_normalized(sales_date date,sku_id integer,product_id bigint,godown_id integer,region_id integer,qty_units numeric,qty_billed numeric,billed_amount numeric,inserted_at timestamptz);
 INSERT INTO public.v_sales_daily_normalized VALUES
 ('2026-11-01',101,1,41,17,10,8,100,now()),('2026-11-24',101,1,41,17,-10,-8,-100,now()),
 ('2026-11-24',102,2,41,17,4,3,120,now()),('2026-11-24',104,4,52,31,1,1,NULL,now()),
 ('2026-10-24',102,2,41,17,5,4,150,now()),('2026-10-31',102,2,41,17,10,10,500,now()),
 ('2025-11-24',102,2,41,17,2,2,80,now());
 CREATE MATERIALIZED VIEW app_private.sales_monthly AS SELECT date_trunc('month',sales_date)::date month_start,sku_id,product_id,region_id,godown_id,sum(qty_units) qty_units,sum(qty_billed) qty_billed,coalesce(sum(billed_amount),0) billed_amount,max(inserted_at) source_max_inserted_at FROM public.v_sales_daily_normalized GROUP BY 1,2,3,4,5;
 CREATE VIEW public.v_mis_inventory_tab_summary AS SELECT current_date report_date,2::bigint valuation_gap_item_count,0::bigint unclassified_item_count,NULL::bigint duplicate_item_row_count,0::bigint missing_item_id_count;
 GRANT USAGE ON SCHEMA auth,app_private TO authenticated;GRANT SELECT ON ALL TABLES IN SCHEMA public,app_private TO authenticated;
 ALTER TABLE public.product_skus ADD COLUMN is_sample boolean DEFAULT false;
 ALTER TABLE public.v_sales_daily_normalized ADD COLUMN source_key text;
 CREATE FUNCTION public.normalize_key(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT lower(regexp_replace(trim(t),'[[:space:]]+',' ','g'))$$;
 CREATE TABLE public.sku_aliases(alias_text text NOT NULL,alias_key text GENERATED ALWAYS AS (lower(btrim(alias_text))) STORED PRIMARY KEY,sku_id integer REFERENCES public.product_skus(id));
 CREATE TABLE public.godown_aliases(alias_text text,godown_id integer);
 CREATE TABLE public.tally_sales_vreg_snapshot(id bigint GENERATED ALWAYS AS IDENTITY,voucher_date date,tally_item_name text,godown_label text,billed_amount_value numeric,inserted_at timestamptz DEFAULT now());
 CREATE TABLE public.etl_jobs(id bigint,job_type text,vreg_date_extracted date,status text,finished_at timestamptz,created_at timestamptz);
 CREATE TABLE public.inv_stock_item(id bigint PRIMARY KEY);
 CREATE TABLE public.inv_stock_item_alias(tally_item_name text,inv_stock_item_id bigint,status text,source_system text,source_kind text);
 CREATE TABLE public.v_inv_stock_item_with_class(stock_item_id bigint,category_code text);
 CREATE VIEW public.v_mis_batch_pipeline AS SELECT NULL::bigint overdue_work_in_process_batch_count;
 CREATE TABLE public.v_fg_transfer_reconciliation(transfer_date date,recon_status text);
 INSERT INTO public.sku_aliases(alias_text,sku_id) VALUES('SKU A',101),('SKU B',102);
 INSERT INTO public.godown_aliases VALUES('DEPOT A',41);
 INSERT INTO public.tally_sales_vreg_snapshot(voucher_date,tally_item_name,godown_label,billed_amount_value) VALUES('2026-11-24','SKU A','DEPOT A',100),('2026-11-24','ASHTAGANDHA DHOOP 35 GM','DEPOT A',50),('2026-11-24','UNRESOLVED','DEPOT X',25),('2026-11-24','SKU B','DEPOT A',NULL);
 INSERT INTO public.products VALUES(5,'No pack',NULL);
 INSERT INTO public.inv_stock_item VALUES(1),(2);
 INSERT INTO public.v_inv_stock_item_with_class VALUES(1,'RM'),(2,'PM');
 GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
`);
 for(const n of ['R3_R4_SERVER_CANDIDATE.sql','R3_R4_COVERAGE_EXTENSION.sql','R3_HISTORICAL_MEASURE_RECONCILIATION.sql','R3_FACILITY_SALES_SCOPE.sql','R3_SALES_ITEM_SCOPE_MASTER.sql','R3_UNIFIED_SALES_CLASSIFICATION.sql'])load(n);
 // Seed exact material fixture from the approved list; validate the real guarded backfill.
 const pairs=[['CHENNINAYAKAM',207],['CHUKKU',241],['JATHIKKA PARIPPU',331],['JATHIPATHRI',332],['JEERAKAM',333],['KARUVAPPATTA - NAADAN',422],['KATAL NURA',430],['KOLARAKKU',475],['KURUMULAKU',527],['KUTA MANJAL',534],['NAKAM',643],['PASUVIN NEYYU',750],['PAVIZHA PUTTU',759],['THAKKOLAM',893],['YAVAM',1049]];
 for(const [n,id] of pairs)q("insert into public.inv_stock_item values("+id+"); insert into public.v_inv_stock_item_with_class values("+id+",'RM'); insert into public.inv_stock_item_alias values('"+n+"',"+id+",'mapped','tally','rm'); insert into public.tally_sales_vreg_snapshot(voucher_date,tally_item_name,godown_label,billed_amount_value) values('2026-10-01','"+n+" (S)','DEPOT A',1);");
 load('R3_SALES_SCOPE_MATERIAL_BACKFILL.sql');
 console.log(pg.serverVersion);
});
after(()=>pg?.stop());
test('all canonical SKUs, inactive and never-sold, plus product without pack',()=>{
 assert.equal(q("select count(*) from public.v_sales_item_classification where identity_type='CANONICAL_SKU'",sales),'5');
 assert.equal(q("select count(*) from public.v_sales_item_classification where identity_type='PRODUCT_WITHOUT_SKU'",sales),'1');
 assert.equal(q("select count(*) from public.v_sales_item_classification",denied),'0');
});
test('facility source amounts reconcile once, null amounts fail closed',()=>{
 const x=j("select public.ei_facility_sales_scope('2026-11-24',1)");
 assert.equal(x.facility.recorded_rows,4);assert.equal(x.facility.source_reported_amount,175);assert.equal(x.facility.billed_value,null);
 assert.equal(x.rows.reduce((a,b)=>a+b.recorded_rows,0),4);assert.equal(x.facility.godown_unresolved_rows,1);
});
test('material seed and role restriction',()=>{
 assert.equal(q("select count(*) from public.sales_item_scope where scope='RAW_MATERIAL'",editor),'15');
 assert.notEqual(pg.psql(db,"select public.sales_item_scope_approve('X','RAW_MATERIAL','2026-01-01','bad',null,2)",{uid:editor}).status,0);
 assert.notEqual(pg.psql(db,"select public.sales_item_scope_approve('X','OTHER_MERCHANDISE','2026-01-01','bad')",{uid:sales}).status,0);
 assert.notEqual(pg.psql(db,"insert into public.sales_item_scope(alias_text,effective_from,scope,reason,approval_source) values('X',current_date,'OTHER_MERCHANDISE','bad','OWNER_RECEIPT')",{uid:editor}).status,0);
});
test('revision preserves history and rejects stale write',()=>{
 const id=Number(q("select public.sales_item_scope_approve('UNRESOLVED','OTHER_MERCHANDISE','2026-11-01','fixture')",editor));
 assert.ok(id>0);
 assert.notEqual(pg.psql(db,"select public.sales_item_scope_approve('UNRESOLVED','UNCLASSIFIED','2026-11-01','stale')",{uid:editor}).status,0);
 q("select public.sales_item_scope_approve('UNRESOLVED','UNCLASSIFIED','2026-11-25','revision',"+id+")",editor);
 assert.equal(q("select count(*) from public.sales_item_scope where alias_key='unresolved'",editor),'2');
 const x=j("select public.ei_facility_sales_scope('2026-11-24',1)");
 assert.equal(x.rows.find(r=>r.scope==='OTHER_MERCHANDISE').source_reported_amount,25);
});
test('coverage, windows, history and alerts execute on extension',()=>{
 assert.ok(Array.isArray(j("select public.ei_sales_coverage('2026-11-24')").days));
 assert.equal(j("select public.ei_sales_window_totals('2026-11-24')").windows.length,2);
 assert.ok(Array.isArray(j("select public.ei_sales_history('2026-11-24',2,'month')").rows));
 assert.ok(Array.isArray(j("select public.ei_management_alerts()",executive).rows));
});

test('review queue exposes unresolved and historical pending items, denies sales readers',()=>{
 q("insert into public.tally_sales_vreg_snapshot(voucher_date,tally_item_name,godown_label,billed_amount_value) values('2026-11-23','NEW UNCLASSIFIED','DEPOT A',55),('2026-11-23','HRIDAYARENJINI LEPAM  250 GM','DEPOT A',10)");
 const x=j("select public.sales_item_scope_review('2026-11-01','2026-11-24',1,0)",editor);
 assert.ok(x.total>=2);assert.equal(x.rows.length,1);assert.equal(x.rows[0].tally_item_name,'NEW UNCLASSIFIED');
 const y=j("select public.sales_item_scope_review('2026-11-01','2026-11-24',100,0)",editor);
 assert.ok(y.rows.some(r=>r.state==='SASV_HISTORICAL_PACK'));
 for(const uid of [sales,denied,null])assert.notEqual(pg.psql(db,"select public.sales_item_scope_review('2026-11-01','2026-11-24')",{uid}).status,0);
 assert.notEqual(pg.psql(db,"select public.sales_item_scope_review('2025-01-01','2026-11-24')",{uid:editor}).status,0);
});

test('canonical normalization matches production generated-key discrepancy and supersedes compatible historical scope',()=>{
 q("insert into public.sku_aliases(alias_text,sku_id) values('HRIDAYARENJINI LEPAM  250 GM',101)");
 const y=j("select public.sales_item_scope_review('2026-11-01','2026-11-24',100,0)",editor);
 assert.ok(!y.rows.some(r=>r.tally_item_name==='HRIDAYARENJINI LEPAM  250 GM'));
 const x=j("select public.ei_facility_sales_scope('2026-11-24',1)");
 assert.ok(!x.rows.some(r=>r.scope==='CLASSIFICATION_CONFLICT'));
 assert.equal(x.rows.find(r=>r.scope==='SASV_CANONICAL_PRODUCT').source_reported_amount,110);
});
test('edit-only identity cannot approve scope',()=>{
 const result=pg.psql(db,"select public.sales_item_scope_approve('EDIT ONLY','OTHER_MERCHANDISE','2026-01-01','denied')",{uid:'00000000-0000-0000-0000-000000000005'});
 assert.notEqual(result.status,0);assert.match(result.err,/Classification edit denied/);
});
test('missing and duplicate summary evidence produces explicit unavailable alerts',()=>{
 q("create or replace view public.v_mis_inventory_tab_summary as select current_date report_date,2::bigint valuation_gap_item_count,0::bigint unclassified_item_count,NULL::bigint duplicate_item_row_count,0::bigint missing_item_id_count where false; create or replace view public.v_mis_batch_pipeline as select NULL::bigint overdue_work_in_process_batch_count where false;");
 let x=j("select public.ei_management_alerts()",executive);
 assert.equal(x.rows.length,6);assert.ok(x.rows.every(r=>r.state==='UNAVAILABLE'));
 q("create or replace view public.v_mis_inventory_tab_summary as select current_date report_date,0::bigint valuation_gap_item_count,0::bigint unclassified_item_count,0::bigint duplicate_item_row_count,0::bigint missing_item_id_count from generate_series(1,2);");
 x=j("select public.ei_management_alerts()",executive);
 assert.equal(x.rows.length,6);assert.ok(x.rows.every(r=>r.state==='UNAVAILABLE'));
});
