-- PEC ERP S3-E isolated synthetic fixture. Never load into production.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create or replace function public.require_permission(p_target text,p_need_edit boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or p_target<>'module:procurement-execution-console'
   or current_setting('pec.fixture.view',true) is distinct from 'yes'
 then raise exception 'PEC view denied'; end if;
end $$;
create table public.pec_excess_fixture(
 purchase_fact_id bigint primary key,
 voucher_date date,
 material_class_id bigint,
 material_class_code text,
 material_class_label text,
 stock_item_id bigint,
 stock_item_name text,
 stock_item_code text,
 uom_id bigint,
 uom_code text,
 purchase_qty numeric,
 allocated_qty numeric,
 unallocated_qty numeric,
 accepted_qty numeric,
 net_unallocated_qty numeric,
 vendor_id bigint,
 vendor_display_name text
);
-- Exact column contract for the candidate reader; no production source data.
create view public.v_proc_purchase_excess_console as
select * from public.pec_excess_fixture;

-- 65 records with deliberately tied quantities, dates, case variations,
-- null/blank vendors, and literal '%' and '_' in item names.
insert into public.pec_excess_fixture (
 purchase_fact_id,voucher_date,material_class_id,material_class_code,
 material_class_label,stock_item_id,stock_item_name,stock_item_code,
 uom_id,uom_code,purchase_qty,allocated_qty,unallocated_qty,accepted_qty,
 net_unallocated_qty,vendor_id,vendor_display_name
)
select n,
 date '2026-11-11' - (n%11),
 case when n%4=0 then 2 else 1 end,
 case when n%13=0 then 'PLM' when n%4=0 then 'PM' else 'RM' end,
 'Fixture',n,
 case when n=1 then 'literal % oil' when n=2 then 'literal _ oil'
      when n%5=0 then 'OIL Component' else 'Item '||n end,
 'CODE-'||n,1,'Kg',100,0,100,0,
 case when n%7=0 then 25 else (n%17)+1 end,
 case when n%6=0 then null else n end,
 case when n%6=0 then null when n%8=0 then '' else 'Vendor '||n end
from generate_series(1,65) n;
