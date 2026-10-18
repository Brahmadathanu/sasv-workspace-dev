drop schema if exists costing cascade; create schema costing;
create role anon; create role authenticated;
create table costing.sales_allocation_default_policy(id serial, scenario_code text, default_sales_units numeric, effective_from date, effective_to date, status text, default_basis text, pool_cap_share numeric);
insert into costing.sales_allocation_default_policy values (1,'NEW_PRODUCT_NO_HISTORY',10,'2026-07-01','2026-09-30','CLOSED','FLAT_UNITS',null),(3,'NEW_PRODUCT_NO_HISTORY',10,'2026-10-01',null,'APPROVED','SMART_V2',0.02);
create table costing.sku_sales_allocation_basis_snapshot(refresh_run_id bigint, product_id bigint, monthly_allocation_base_qty numeric, monthly_driver_source text);
insert into costing.sku_sales_allocation_basis_snapshot values (1,10,5,'DEFAULT_NEW_PRODUCT_NO_HISTORY'),(1,11,1,'DEFAULT_NEW_SKU_EXISTING_PRODUCT'),(1,11,9,'ACTUAL_MONTHLY_MAX'),(1,12,50,'ACTUAL_MONTHLY_MAX');
create table if not exists costing.default_volume_cap_log (
  refresh_run_id bigint not null,
  allocation_pool text not null,
  pool_cap_share numeric not null,
  eligible_workload numeric not null,
  default_workload_before numeric not null,
  scale_factor numeric not null,
  default_workload_after numeric not null,
  created_at timestamptz not null default now(),
  primary key (refresh_run_id, allocation_pool)
);
alter table costing.default_volume_cap_log enable row level security;

create or replace function costing.fn_default_volume_cap(p_refresh_run_id bigint, p_valuation_date date, p_pool text, p_items jsonb)
returns table(product_id bigint, new_workload numeric)
language plpgsql security definer set search_path to 'costing','public','pg_temp' as $f$
declare v_cap numeric; v_tot numeric; v_def numeric; v_k numeric := 1;
begin
  select max(p.pool_cap_share) into v_cap
    from costing.sales_allocation_default_policy p
   where p.default_basis = 'SMART_V2' and p.status in ('APPROVED','CLOSED')
     and p.effective_from <= p_valuation_date and (p.effective_to is null or p.effective_to >= p_valuation_date);
  if v_cap is null or p_items is null then return; end if;

  create temporary table if not exists tmp_dvc(product_id bigint, w numeric, dw numeric) on commit drop;
  truncate tmp_dvc;
  insert into tmp_dvc
  select (i->>'product_id')::bigint, (i->>'workload')::numeric,
         (i->>'workload')::numeric * least(1, coalesce(d.dq, 0) / nullif((i->>'base_qty')::numeric, 0))
    from jsonb_array_elements(p_items) i
    left join (select s.product_id, sum(s.monthly_allocation_base_qty) dq
                 from costing.sku_sales_allocation_basis_snapshot s
                where s.refresh_run_id = p_refresh_run_id
                  and s.monthly_driver_source in ('DEFAULT_NEW_SKU_EXISTING_PRODUCT','DEFAULT_NEW_PRODUCT_NO_HISTORY')
                group by s.product_id) d on d.product_id = (i->>'product_id')::bigint;

  select sum(w), coalesce(sum(dw), 0) into v_tot, v_def from tmp_dvc;
  if v_def > 0 and v_def > v_cap * v_tot then
    v_k := (v_cap * (v_tot - v_def) / (1 - v_cap)) / v_def;   -- post-scale default share = cap exactly
  end if;

  insert into costing.default_volume_cap_log(refresh_run_id, allocation_pool, pool_cap_share, eligible_workload, default_workload_before, scale_factor, default_workload_after)
  values (p_refresh_run_id, p_pool, v_cap, v_tot, v_def, v_k, v_def * v_k)
  on conflict (refresh_run_id, allocation_pool) do update set pool_cap_share = excluded.pool_cap_share,
    eligible_workload = excluded.eligible_workload, default_workload_before = excluded.default_workload_before,
    scale_factor = excluded.scale_factor, default_workload_after = excluded.default_workload_after, created_at = now();

  if v_k < 1 then
    return query select t.product_id, t.w - t.dw * (1 - v_k) from tmp_dvc t where t.dw > 0;
  end if;
end $f$;
revoke all on function costing.fn_default_volume_cap(bigint,date,text,jsonb) from public, anon, authenticated;


-- 10: all default w=10; 11: 10% default w=20 -> dw=2; 12: actual w=88. tot=118, def=12 (10.2%) > 2%
select * from costing.fn_default_volume_cap(1,'2026-10-16','PRODUCTION_OVERHEAD','[{"product_id":10,"workload":10,"base_qty":5},{"product_id":11,"workload":20,"base_qty":10},{"product_id":12,"workload":88,"base_qty":50}]');
select allocation_pool, round(scale_factor,6), round(default_workload_after/(eligible_workload-default_workload_before+default_workload_after),6) post_share from costing.default_volume_cap_log;
select count(*) sep_rows from costing.fn_default_volume_cap(2,'2026-09-10','PRODUCTION_OVERHEAD','[{"product_id":10,"workload":10,"base_qty":5}]');
