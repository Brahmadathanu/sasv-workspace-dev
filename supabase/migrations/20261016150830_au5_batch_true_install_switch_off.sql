-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- AU-5 batch-true standard conversion cost: LIVE install, switch OFF (user approval 2026-10-16 "Approve AU-5 with re-based rates").
-- Adds effective_from gate to the switch: the applier is a no-op for any run whose valuation_date < effective_from.
create table if not exists costing.batch_true_standard_switch(
  id boolean primary key default true check (id), is_enabled boolean not null default false,
  rate_basis text not null default 'NORMAL_VOLUME_RATE' check (rate_basis in ('NORMAL_VOLUME_RATE','APPROVED_RATE')),
  effective_from date not null default date '2026-10-01',
  changed_by text, changed_at timestamptz default now(), note text);
insert into costing.batch_true_standard_switch(id,is_enabled,note) values (true,false,'AU-5 installed OFF') on conflict (id) do nothing;

create table if not exists costing.batch_true_absorption_variance(
  refresh_run_id bigint not null, allocation_pool text not null, pool_amount numeric, absorbed_at_standard numeric,
  variance_amount numeric, products_batch_true int, products_current_method int, rate_used numeric, rate_basis text,
  created_at timestamptz default now(), primary key(refresh_run_id, allocation_pool));
revoke all on costing.batch_true_standard_switch, costing.batch_true_absorption_variance from anon, authenticated;
grant select on costing.batch_true_standard_switch, costing.batch_true_absorption_variance to authenticated;

create or replace function costing.fn_apply_batch_true_standard(p_refresh_run_id bigint)
returns text language plpgsql security definer set search_path to 'costing','public','pg_temp' as $f$
declare v_poh_rate numeric; v_dl_rate numeric; v_poh_pool numeric; v_dl_pool numeric; v_vd date; v_sw costing.batch_true_standard_switch%rowtype;
begin
  select * into v_sw from costing.batch_true_standard_switch;
  if not coalesce(v_sw.is_enabled,false) then return 'OFF'; end if;
  select valuation_date into v_vd from costing.costing_refresh_run where id=p_refresh_run_id;
  if v_vd is null or v_vd < v_sw.effective_from then return 'NOT_EFFECTIVE'; end if;
  select max(production_overhead_pool_amount) into v_poh_pool from costing.sku_production_overhead_allocation_snapshot where refresh_run_id=p_refresh_run_id;
  select v_poh_pool/nullif(max(company_ready_workload_units),0) into v_poh_rate from costing.product_production_overhead_workload_snapshot where refresh_run_id=p_refresh_run_id;
  select max(direct_labour_pool_amount), max(direct_labour_pool_amount)/nullif(max(company_eligible_workload_units),0)
    into v_dl_pool, v_dl_rate from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id;
  select coalesce((select r.standard_rate from costing.fn_resolve_manufacturing_standard_rate('MANUFACTURING_LABOUR','MANUFACTURING_LABOUR',v_vd) r limit 1), v_dl_rate) into v_dl_rate;
  if v_sw.rate_basis='NORMAL_VOLUME_RATE' then
    select v_poh_pool/nullif(sum(w.workload_units/greatest(w.rounded_batch_count,1)*w.monthly_product_base_qty/w.preferred_batch_size),0) into v_poh_rate
      from costing.product_production_overhead_workload_snapshot w where w.refresh_run_id=p_refresh_run_id and coalesce(w.preferred_batch_size,0)>0;
    select v_dl_pool/nullif(sum(d.direct_labour_workload_units/greatest(d.standard_batch_count,1)*d.monthly_product_base_qty/w.preferred_batch_size),0) into v_dl_rate
      from costing.product_direct_labour_workload_snapshot d join costing.product_production_overhead_workload_snapshot w on w.refresh_run_id=d.refresh_run_id and w.product_id=d.product_id
     where d.refresh_run_id=p_refresh_run_id and coalesce(w.preferred_batch_size,0)>0;
  end if;
  create temp table _bt on commit drop as
  select o.product_id, o.preferred_batch_size bs,
         case when coalesce(o.preferred_batch_size,0)>0 then v_poh_rate*o.workload_units/greatest(o.rounded_batch_count,1)/o.preferred_batch_size end poh_pb,
         case when coalesce(o.preferred_batch_size,0)>0 and d.product_id is not null then v_dl_rate*d.direct_labour_workload_units/greatest(d.standard_batch_count,1)/o.preferred_batch_size end dl_pb,
         o.monthly_product_base_qty qty_poh, d.monthly_product_base_qty qty_dl, o.product_production_overhead_allocation_cur, d.product_direct_labour_allocation dl_cur
  from (select w.*, (select max(s.product_production_overhead_allocation) from costing.sku_production_overhead_allocation_snapshot s where s.refresh_run_id=p_refresh_run_id and s.product_id=w.product_id) product_production_overhead_allocation_cur
        from costing.product_production_overhead_workload_snapshot w where w.refresh_run_id=p_refresh_run_id) o
  left join costing.product_direct_labour_workload_snapshot d on d.refresh_run_id=p_refresh_run_id and d.product_id=o.product_id;
  update costing.sku_production_overhead_allocation_snapshot s set
    production_overhead_cost_per_base_uom=b.poh_pb, production_overhead_cost_per_sku=b.poh_pb*s.sku_base_qty_per_unit
  from _bt b where s.refresh_run_id=p_refresh_run_id and s.product_id=b.product_id and b.poh_pb is not null;
  update costing.sku_direct_labour_allocation_snapshot s set
    manufacturing_direct_labour_cost_per_sku=b.dl_pb*s.sku_base_qty_per_unit,
    direct_labour_cost_per_sku=b.dl_pb*s.sku_base_qty_per_unit+coalesce(s.packing_labour_cost_per_sku,0)
  from _bt b where s.refresh_run_id=p_refresh_run_id and s.product_id=b.product_id and b.dl_pb is not null;
  insert into costing.batch_true_absorption_variance(refresh_run_id,allocation_pool,pool_amount,absorbed_at_standard,variance_amount,products_batch_true,products_current_method,rate_used,rate_basis)
  select p_refresh_run_id,'PRODUCTION_OVERHEAD',v_poh_pool, sum(coalesce(poh_pb*qty_poh,product_production_overhead_allocation_cur)), v_poh_pool-sum(coalesce(poh_pb*qty_poh,product_production_overhead_allocation_cur)), count(poh_pb), count(*)-count(poh_pb), v_poh_rate, v_sw.rate_basis from _bt
  union all
  select p_refresh_run_id,'MANUFACTURING_LABOUR',v_dl_pool, sum(coalesce(dl_pb*qty_dl,dl_cur,0)), v_dl_pool-sum(coalesce(dl_pb*qty_dl,dl_cur,0)), count(dl_pb), count(*)-count(dl_pb), v_dl_rate, v_sw.rate_basis from _bt
  on conflict (refresh_run_id,allocation_pool) do update set pool_amount=excluded.pool_amount,absorbed_at_standard=excluded.absorbed_at_standard,variance_amount=excluded.variance_amount,products_batch_true=excluded.products_batch_true,products_current_method=excluded.products_current_method,rate_used=excluded.rate_used,rate_basis=excluded.rate_basis,created_at=now();
  return 'APPLIED';
end $f$;
revoke all on function costing.fn_apply_batch_true_standard(bigint) from public, anon, authenticated;

-- Hook: one line in the stage-03 chain, after the POH workload refresh (idempotent).
do $h$
declare d text; k text := 'perform costing.rpc_refresh_production_overhead_workload_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);';
begin
  d := pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure);
  if position('fn_apply_batch_true_standard' in d)>0 then return; end if;
  if position(k in d)=0 then raise exception 'AU-5 hook anchor not found'; end if;
  execute replace(d, k, k||E'\n        perform costing.fn_apply_batch_true_standard(p_refresh_run_id); -- AU-5 (switch-gated, effective-dated)');
end $h$;
-- ROLLBACK: recreate chain without the AU-5 line; drop function costing.fn_apply_batch_true_standard(bigint);
--   drop table costing.batch_true_absorption_variance, costing.batch_true_standard_switch;
