// Exact review SQL against ephemeral local PostgreSQL; never connects to Supabase.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startPg} from './pg_harness.mjs';
let pg,blocked;
const db='ei_r3_fixture';
const executive='00000000-0000-0000-0000-000000000001';
const sales='00000000-0000-0000-0000-000000000002';
const denied='00000000-0000-0000-0000-000000000003';
const q=(s,uid)=>{const r=pg.psql(db,s,{uid});assert.equal(r.status,0,r.err);return r.out;};
const j=(s,uid=sales)=>JSON.parse(q(s,uid));
const T=(name,fn)=>test(name,async t=>{if(blocked)return t.skip(blocked);await fn();});
before(()=>{
 pg=startPg();if(!pg){blocked='Local PostgreSQL unavailable';return;}pg.createDb(db);
 q(`
 CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;
 CREATE SCHEMA auth;CREATE SCHEMA app_private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
 CREATE FUNCTION public.app_has_permission(t text,m text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT (auth.uid()='00000000-0000-0000-0000-000000000001' AND t='module:executive-mis-dashboard') OR (auth.uid()='00000000-0000-0000-0000-000000000002' AND t='module:sales-data-viewer')$$;
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
 `);
 q(fs.readFileSync(new URL('../../../docs/executive-mis-g7-server/R3_R4_SERVER_CANDIDATE.sql',import.meta.url),'utf8'));
 console.log(pg.serverVersion);
});
after(()=>{if(pg)pg.stop();});
T('sales only and executive allowed; unrelated and absent claims denied',()=>{
 assert.equal(j('select public.ei_sales_access()').executive,false);
 assert.equal(j('select public.ei_sales_access()',executive).executive,true);
 for(const uid of [denied,null])assert.notEqual(pg.psql(db,'select public.ei_sales_access()',{uid}).status,0);
 assert.equal(q("select has_function_privilege('anon','public.ei_sales_access()','EXECUTE')"),'f');
 assert.notEqual(pg.psql(db,"set role anon; select public.ei_sales_dimensions()").status,0);
});
T('dynamic dimensions use master IDs',()=>{const x=j('select public.ei_sales_dimensions()');assert.deepEqual(x.regions.map(r=>r.id),[17,31]);assert.equal(x.last_mapped_date,'2026-11-24');});
T('matched elapsed period excludes later sales, weighted package ASP',()=>{
 const x=j("select public.ei_sales_comparison('2026-11-24',17)");
 const p=Object.fromEntries(x.periods.map(r=>[r.label,r]));
 assert.equal(p.CURRENT.sales_value,120);assert.equal(p.PREVIOUS_MONTH.sales_value,150);assert.equal(p.PREVIOUS_YEAR.sales_value,80);
 assert.equal(p.CURRENT.actual_packages,4);assert.equal(p.CURRENT.asp_actual_package,30);assert.equal(p.CURRENT.asp_billed_package,40);
 assert.equal(p.CURRENT.negative_rows,1);assert.equal(x.import_completeness,'NOT_CERTIFIED');
});
T('null amount fails closed; no observations remain null',()=>{
 const x=j("select public.ei_sales_comparison('2026-11-24',31)");
 const p=Object.fromEntries(x.periods.map(r=>[r.label,r]));
 assert.equal(p.CURRENT.sales_value,null);assert.equal(p.CURRENT.missing_amount_rows,1);assert.equal(p.PREVIOUS_MONTH.sales_value,null);
});
T('history uses full previous month and bounded anchor, deterministic paging',()=>{
 const x=j("select public.ei_sales_history('2026-11-24',2,'month',17)");
 assert.equal(x.rows.find(r=>r.month==='2026-10-01').sales_value,650);
 assert.equal(x.rows.find(r=>r.month==='2026-11-01').sales_value,120);
 const pages=[0,1].map(o=>j("select public.ei_sales_history('2026-11-24',2,'sku',17,p_limit=>1,p_offset=>"+o+")"));
 assert.notEqual(pages[0].rows[0].dimension_id,pages[1].rows[0].dimension_id);
 assert.notEqual(pg.psql(db,"select public.ei_sales_history(p_months=>13)",{uid:sales}).status,0);
});
T('return offsets and absent sales differ, eligibility current only',()=>{
 const x=j("select public.ei_sales_exceptions('2026-11-24',17)");
 assert.equal(x.rows.find(r=>r.sku_id===101).activity_state,'BILLED_SALES_OFFSET_BY_RETURNS');
 assert.equal(x.rows.find(r=>r.sku_id===103).activity_state,'NO_RECORDED_SALES_COVERAGE_UNCERTIFIED');
 assert.equal(x.rows.find(r=>r.sku_id===105).eligibility,'INACTIVE_CURRENT_MASTER');
});
T('alerts deny sales-only and unknown counts do not certify clear',()=>{
 assert.notEqual(pg.psql(db,'select public.ei_management_alerts()',{uid:sales}).status,0);
 const x=j('select public.ei_management_alerts()',executive);
 assert.equal(x.rows.find(r=>r.key==='inventory.duplicate_identity').state,'UNAVAILABLE');
 assert.equal(x.rows.find(r=>r.key==='inventory.valuation_gap').state,'REVIEW');
});
T('concurrent candidate calls under eight-second role budget',async()=>{
 const rs=await Promise.all(['select public.ei_sales_dimensions()','select public.ei_sales_comparison()','select public.ei_sales_history()','select public.ei_sales_exceptions()'].map(s=>pg.psqlAsync(db,"set statement_timeout='8s';"+s,{uid:sales})));
 for(const r of rs){assert.equal(r.status,0,r.err);console.log('fixture ms',r.ms);}
});
