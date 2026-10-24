-- AU-5 batch-true standard conversion cost (PROPOSAL; switch DEFAULT OFF). Minimal change to the existing engine:
--  1 switch table, 1 variance table, 1 applier function, and ONE added line in costing.rpc_refresh_manufacturing_cop_chain
--  (after the POH workload refresh, before overhead/prime/COP roll-ups read the SKU allocation snapshots).
-- Standard per base unit = rate x workload-per-batch / normal batch output (batch_size_ref preferred size, i.e. the
-- approved-standard tier of the fallback hierarchy). Monthly volume affects only absorption: pool minus absorbed-at-standard
-- is recorded as variance, never forced into SKU cost. Products without a batch size keep the current method (tier CURRENT_METHOD).
create table if not exists costing.batch_true_standard_switch(
  id boolean primary key default true check (id), is_enabled boolean not null default false,
  rate_basis text not null default 'NORMAL_VOLUME_RATE' check (rate_basis in ('NORMAL_VOLUME_RATE','APPROVED_RATE')),
  changed_by text, changed_at timestamptz default now(), note text);
insert into costing.batch_true_standard_switch(id,is_enabled,note) values (true,false,'AU-5 default OFF') on conflict (id) do nothing;

create table if not exists costing.batch_true_absorption_variance(
  refresh_run_id bigint not null, allocation_pool text not null, pool_amount numeric, absorbed_at_standard numeric,
  variance_amount numeric, products_batch_true int, products_current_method int, created_at timestamptz default now(),
  primary key(refresh_run_id, allocation_pool));

create or replace function costing.fn_apply_batch_true_standard(p_refresh_run_id bigint)
returns text language plpgsql security definer set search_path to 'costing','public','pg_temp' as $f$
declare v_poh_rate numeric; v_dl_rate numeric; v_poh_pool numeric; v_dl_pool numeric; v_vd date;
begin
  if not coalesce((select is_enabled from costing.batch_true_standard_switch),false) then return 'OFF'; end if;
  select max(valuation_date) into v_vd from costing.product_production_overhead_workload_snapshot where refresh_run_id=p_refresh_run_id;
  select max(production_overhead_pool_amount) into v_poh_pool from costing.sku_production_overhead_allocation_snapshot where refresh_run_id=p_refresh_run_id;
  select v_poh_pool/nullif(max(company_ready_workload_units),0) into v_poh_rate from costing.product_production_overhead_workload_snapshot where refresh_run_id=p_refresh_run_id;
  select max(direct_labour_pool_amount), max(direct_labour_pool_amount)/nullif(max(company_eligible_workload_units),0)
    into v_dl_pool, v_dl_rate from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id;
  -- APPROVED_RATE basis: approved normal rate preferred when present
  select coalesce((select r.standard_rate from costing.fn_resolve_manufacturing_standard_rate('MANUFACTURING_LABOUR','MANUFACTURING_LABOUR',v_vd) r limit 1), v_dl_rate) into v_dl_rate;

  if (select rate_basis from costing.batch_true_standard_switch)='NORMAL_VOLUME_RATE' then
    -- rate re-based on normal batch volume: pool / sum(workload per batch x monthly batch equivalents at batch_size_ref)
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

  insert into costing.batch_true_absorption_variance(refresh_run_id,allocation_pool,pool_amount,absorbed_at_standard,variance_amount,products_batch_true,products_current_method)
  select p_refresh_run_id,'PRODUCTION_OVERHEAD',v_poh_pool, sum(coalesce(poh_pb*qty_poh,product_production_overhead_allocation_cur)), v_poh_pool-sum(coalesce(poh_pb*qty_poh,product_production_overhead_allocation_cur)), count(poh_pb), count(*)-count(poh_pb) from _bt
  union all
  select p_refresh_run_id,'MANUFACTURING_LABOUR',v_dl_pool, sum(coalesce(dl_pb*qty_dl,dl_cur,0)), v_dl_pool-sum(coalesce(dl_pb*qty_dl,dl_cur,0)), count(dl_pb), count(*)-count(dl_pb) from _bt
  on conflict (refresh_run_id,allocation_pool) do update set pool_amount=excluded.pool_amount,absorbed_at_standard=excluded.absorbed_at_standard,variance_amount=excluded.variance_amount,products_batch_true=excluded.products_batch_true,products_current_method=excluded.products_current_method,created_at=now();
  return 'APPLIED';
end $f$;
-- HOOK (live migration only): in costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint), directly after
--   perform costing.rpc_refresh_production_overhead_workload_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
-- add:
--   perform costing.fn_apply_batch_true_standard(p_refresh_run_id);
-- ROLLBACK: restore the chain without that line; drop function costing.fn_apply_batch_true_standard(bigint);
--   drop table costing.batch_true_absorption_variance; drop table costing.batch_true_standard_switch.
