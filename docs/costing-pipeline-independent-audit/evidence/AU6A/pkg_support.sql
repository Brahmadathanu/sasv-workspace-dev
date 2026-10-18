\set ON_ERROR_STOP 1
create table public.products(id bigint primary key, item text, uom_base text, conversion_to_base numeric, status text);
create table public.product_skus(id bigint primary key, product_id bigint, pack_size numeric, uom text, is_active boolean, is_sample boolean);
create table public.inv_uom(id bigint, code text, dimension_id bigint, is_base boolean, notes text);
create table public.inv_uom_conversion(id bigint, from_uom_id bigint, to_uom_id bigint, factor numeric(18,6), dimension_id bigint, notes text);
create table public.v_sales_monthly_clean(sku_id integer, product_id bigint, region_id integer, godown_id integer, month_start date, qty_clean numeric);
create table costing.cost_periods(period_start date, status text);
create table costing.sku_base_quantity_exception(sku_id bigint, product_id bigint, sku_base_qty_per_unit numeric(24,8), base_uom text, explanation text, approval_reference text, approved_by uuid, approved_at timestamptz, created_at timestamptz);
insert into costing.sku_base_quantity_exception(sku_id,product_id,sku_base_qty_per_unit,base_uom,approval_reference) values (865,685,1,'Nos','USER_CONFIRMED_KASHAYA_VASTHI_KIT_1_NOS_2026_10_15'),(878,695,1,'Nos','USER_CONFIRMED_KARKKIDAKA_KANJI_500G_ONE_PACK_2026_10_15');
insert into public.products values (685,'Kashaya Vasthi Kit','Nos',1,'Active'),(695,'Karkkidaka Kanji','Nos',1,'Active'),(1340,'Chiruvilwadi Kvatha Choornam','Kg',1,'Active');
insert into public.product_skus values (865,685,275,'g',true,false),(878,695,500,'g',true,false),(1769,1340,200,'g',true,false);
insert into public.inv_uom values (1,'Kg',1,true,null),(2,'g',1,false,null),(5,'Nos',2,true,null);
insert into public.inv_uom_conversion values (1,2,1,0.001,1,null);
insert into public.v_sales_monthly_clean values (865,685,1,1,'2026-01-01',36),(878,695,1,1,'2026-06-01',894),(1769,1340,1,1,'2026-06-01',3);
insert into costing.cost_periods values ('2026-09-01','LOCKED'),('2026-10-01','OPEN');
create schema if not exists public;
