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
 CREATE FUNCTION public.app_has_permission(t text,m text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT auth.uid()='00000000-0000-0000-0000-000000000001' AND t='module:executive-mis-dashboard'$$;
 GRANT USAGE ON SCHEMA auth TO authenticated,service_role;`);
 q(fs.readFileSync(new URL('./ei_access_live_catalog_fixture.sql',import.meta.url),'utf8'));
 q(`insert into public.v_stock_current_by_item(source_kind,inv_stock_item_id,name,qty_value,avg_rate_value,category_code) values('rm',1,'Fixture',2,10,'RM');
 insert into public.v_stock_checker(product_id,item,sku_id,stock_ik,stock_value_overall) values(1,'Fixture',1,2,20);
 insert into public.products(id,item) values(1,'Fixture');
 insert into public.v_sales_daily_normalized(sales_date,sku_id,product_id,qty_units,qty_billed,billed_amount) values(current_date,1,1,2,2,20);
 insert into public.tally_group_outstanding_snapshot(as_of_date,group_name,vendor_name,outstanding_amount_value) values(current_date,'Sundry Creditors','Fixture',20);`);
 old=snapshot(exec);
 assert.notEqual(old.v_mis_inventory_tab_summary,'[]');
 assert.notEqual(old['get_mis_inventory_item_page()'],'[]');
 assert.equal(q('select count(*) from public.mv_mis_executive_summary',sales),'1');
 q(fs.readFileSync(new URL('../../../docs/executive-mis-g7-server/R3_MIS_ACCESS_CANDIDATE.sql',import.meta.url),'utf8'));
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
