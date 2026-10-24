-- AU-6Q QC per-batch (batch-true) allocation. PREPARED, NOT APPLIED (user approved build + test only, 2026-10-18 06:09 IST).
-- Kept OUT of supabase/migrations until approved (db push risk). Apply only via Supabase MCP apply_migration, after notifying Jarvis.
-- Keeps: QUALITY_CONTROL_OVERHEAD pool (cost_pool_monthly_snapshot), AU-4 independent QC driver (Method-3 effective-spec workload,
--        product_qc_workload_snapshot), canonical demand (fn_total_manufacturing_product_demand_as_of), all statuses / reason codes.
-- Changes only the per-unit derivation, inside the INSERT path (no snapshot UPDATEs):
--   product QC workload = Method-3 units per batch x monthly batch equivalents (qty / batch_size_ref of the run, from the POH workload snapshot)
--   rate = (pool - current-method fallback amounts) / sum(batch-true workload)      [Rs per QC workload unit per batch]
--   QC per base UOM = rate x Method-3 units / batch_size_ref        (independent of monthly volume)
--   Products without a batch size keep the current share (fallback); full pool absorbed; variance -> batch_true_absorption_variance.
-- Gate: costing.qc_batch_true_switch (separate from AU-5), effective 2026-10-01 -> Sep run 122 (valuation 2026-09-10) unaffected.
do $$ begin
  if exists (select 1 from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')) then raise exception 'AU-6Q: a costing run is in progress'; end if;
end $$;
-- AU-6Q QC batch-true: separate effective-dated switch (independent of the AU-5 DL/POH switch).
create table if not exists costing.qc_batch_true_switch(
  id boolean primary key default true check (id), is_enabled boolean not null default false,
  effective_from date not null default date '2026-10-01' check (effective_from = date_trunc('month', effective_from)::date),
  approval_reference text, changed_by text, changed_at timestamptz default now(), note text);
revoke all on costing.qc_batch_true_switch from anon, authenticated;
grant select on costing.qc_batch_true_switch to authenticated;
create or replace function costing.fn_qc_batch_true_effective(p_valuation_date date) returns boolean
language sql stable security definer set search_path to 'costing','pg_temp' as $$
  select coalesce((select s.is_enabled and p_valuation_date>=s.effective_from from costing.qc_batch_true_switch s),false)
$$;
revoke all on function costing.fn_qc_batch_true_effective(date) from public, anon, authenticated;
insert into costing.qc_batch_true_switch(id,is_enabled,effective_from,approval_reference,changed_by,note)
values (true,true,date '2026-10-01','USER-APPROVAL-AU6Q-QC-BATCH-TRUE-<DATE>','dff17104-c02a-4bca-95b1-e8ddff46a9b6','AU-6Q QC per-batch allocation from Oct 2026')
on conflict (id) do nothing;

CREATE OR REPLACE FUNCTION costing.rpc_refresh_qc_monetary_allocation_snapshot(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 RETURNS TABLE(refreshed_period_start date, product_row_count bigint, sku_row_count bigint, blocked_product_count bigint, review_required_product_count bigint, ready_product_count bigint, allocated_pool_amount numeric, pool_difference numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
    v_period_start date := date_trunc('month', p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_pool costing.cost_pool_monthly_snapshot%rowtype;
    v_workload_count bigint;
    v_basis_product_count bigint;
    v_total_ready_workload numeric;
    v_recipient_count integer;
    v_included_count integer;
    v_excluded_count integer;
    v_coverage numeric;
    v_bt boolean; -- AU-6Q
    v_pool_bt numeric;
    v_wl_bt numeric;
    v_rate_bt numeric;
begin
    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'period_start, valuation_date and refresh_run_id are required';
    end if;

    select * into v_run
    from costing.costing_refresh_run r
    where r.id = p_refresh_run_id;

    if not found then
        raise exception 'Costing refresh run % does not exist', p_refresh_run_id;
    end if;

    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'QC monetary allocation context does not match refresh run %', p_refresh_run_id;
    end if;

    select * into v_pool
    from costing.cost_pool_monthly_snapshot p
    where p.refresh_run_id = p_refresh_run_id
      and p.period_start = v_period_start
      and p.valuation_date = p_valuation_date
      and p.allocation_pool = 'QUALITY_CONTROL_OVERHEAD';

    if not found then
        raise exception 'Frozen QUALITY_CONTROL_OVERHEAD pool is missing for refresh run %', p_refresh_run_id;
    end if;

    select
      count(*)::bigint,
      max(recipient_product_count),
      max(resolved_product_count),
      max(excluded_product_count),
      max(resolved_coverage_ratio),
      sum(workload_units) filter (where workload_status = 'READY')
    into
      v_workload_count,
      v_recipient_count,
      v_included_count,
      v_excluded_count,
      v_coverage,
      v_total_ready_workload
    from costing.product_qc_workload_snapshot w
    where w.refresh_run_id = p_refresh_run_id
      and w.period_start = v_period_start
      and w.valuation_date = p_valuation_date;

    if v_workload_count = 0 or v_workload_count <> v_recipient_count then
        raise exception 'Complete Product QC workload evidence is required for refresh run %', p_refresh_run_id;
    end if;

    if v_total_ready_workload is null or v_total_ready_workload <= 0 then
        raise exception 'Positive resolved Product QC workload is required for refresh run %', p_refresh_run_id;
    end if;

    select count(*)::bigint into v_basis_product_count from costing.fn_total_manufacturing_product_demand_as_of(v_period_start,p_valuation_date,p_refresh_run_id);

    if v_basis_product_count <> v_recipient_count then
        raise exception 'Canonical Product absorption basis is incomplete or inconsistent for refresh run %', p_refresh_run_id;
    end if;

    -- AU-6Q QC batch-true (effective-dated; Sep run 122 unaffected). Pool and Method-3 workload unchanged;
    -- only the per-unit derivation: product QC workload = Method-3 units per batch x monthly batch equivalents (qty / batch_size_ref).
    v_bt := costing.fn_qc_batch_true_effective(p_valuation_date);
    create temp table if not exists _au6q_qc_bt(product_id bigint primary key, qty numeric, bs numeric, wu numeric, old_amt numeric, bt boolean, wl_bt numeric, amt numeric) on commit drop;
    truncate _au6q_qc_bt;
    if v_bt then
      insert into _au6q_qc_bt(product_id,qty,bs,wu,old_amt,bt,wl_bt)
      select w.product_id, d.total_manufacturing_base_qty, o.preferred_batch_size, w.workload_units,
             case when w.workload_status='READY' and v_pool.pool_status<>'BLOCKED' then v_pool.total_pool_amount*(w.workload_units/v_total_ready_workload) end,
             (w.workload_status='READY' and v_pool.pool_status<>'BLOCKED' and coalesce(d.total_manufacturing_base_qty,0)>0 and coalesce(o.preferred_batch_size,0)>0),
             case when w.workload_status='READY' and v_pool.pool_status<>'BLOCKED' and coalesce(d.total_manufacturing_base_qty,0)>0 and coalesce(o.preferred_batch_size,0)>0
                  then w.workload_units*d.total_manufacturing_base_qty/o.preferred_batch_size end
      from costing.product_qc_workload_snapshot w
      join costing.fn_total_manufacturing_product_demand_as_of(v_period_start,p_valuation_date,p_refresh_run_id) d on d.product_id=w.product_id
      left join costing.product_production_overhead_workload_snapshot o on o.refresh_run_id=w.refresh_run_id and o.product_id=w.product_id
      where w.refresh_run_id=p_refresh_run_id and w.period_start=v_period_start and w.valuation_date=p_valuation_date;
      select v_pool.total_pool_amount-coalesce(sum(old_amt) filter (where not bt),0), sum(wl_bt) into v_pool_bt, v_wl_bt from _au6q_qc_bt;
      if coalesce(v_wl_bt,0)<=0 then
        v_bt := false; -- no batch-true recipients: keep current method
      else
        v_rate_bt := v_pool_bt/v_wl_bt;
        update _au6q_qc_bt set amt = case when bt then v_rate_bt*wl_bt else old_amt end;
      end if;
    end if;

    delete from costing.sku_qc_allocation_snapshot s
    where s.refresh_run_id = p_refresh_run_id;

    delete from costing.product_qc_allocation_snapshot p
    where p.refresh_run_id = p_refresh_run_id;

    insert into costing.product_qc_allocation_snapshot (
      period_start, valuation_date, refresh_run_id,
      product_workload_snapshot_id, policy_id, quality_control_pool_snapshot_id,
      product_id, product_name, product_group_id, protocol_category_id, base_spec_profile_id,
      workload_units, company_resolved_workload_units, product_workload_share,
      quality_control_pool_amount, product_qc_allocation_amount,
      product_base_uom, product_absorption_base_qty,
      absorption_basis_source, absorption_basis_method, absorption_basis_source_month,
      absorption_basis_status, absorption_basis_note,
      qc_cost_per_product_base_uom,
      allocation_status, allocation_reason_code, allocation_note,
      recipient_product_count, included_product_count, excluded_product_count, resolved_coverage_ratio,
      refreshed_at
    )
    with product_basis as (
      select d.product_id,d.product_name,d.product_base_uom,
             d.total_manufacturing_base_qty as product_absorption_base_qty,
             d.demand_source as absorption_basis_source,
             'TOTAL_MANUFACTURING_DEMAND'::text as absorption_basis_method,
             v_period_start as absorption_basis_source_month,
             d.monthly_driver_status as absorption_basis_status,
             d.demand_note as absorption_basis_note
      from costing.fn_total_manufacturing_product_demand_as_of(v_period_start,p_valuation_date,p_refresh_run_id) d
    )
    select
      w.period_start, w.valuation_date, w.refresh_run_id,
      w.id, w.policy_id, v_pool.id,
      w.product_id, coalesce(w.product_name, pb.product_name), w.product_group_id, w.protocol_category_id, w.base_spec_profile_id,
      w.workload_units,
      v_total_ready_workload,
      case when w.workload_status = 'READY' then (case when v_bt and bt.bt then coalesce(nullif(bt.amt,0)/nullif(v_pool.total_pool_amount,0), w.workload_units / v_total_ready_workload) else w.workload_units / v_total_ready_workload end) else null end,
      v_pool.total_pool_amount,
      case when w.workload_status = 'READY' and v_pool.pool_status <> 'BLOCKED'
           then (case when v_bt and bt.bt then bt.amt else v_pool.total_pool_amount * (w.workload_units / v_total_ready_workload) end)
           else null end,
      pb.product_base_uom,
      case when w.workload_status = 'READY' then pb.product_absorption_base_qty else null end,
      pb.absorption_basis_source,
      pb.absorption_basis_method,
      pb.absorption_basis_source_month,
      pb.absorption_basis_status,
      pb.absorption_basis_note,
      case when w.workload_status = 'READY'
                 and v_pool.pool_status <> 'BLOCKED'
                 and pb.product_absorption_base_qty > 0
           then (case when v_bt and bt.bt then v_rate_bt*w.workload_units/bt.bs
                      else (v_pool.total_pool_amount * (w.workload_units / v_total_ready_workload)) / pb.product_absorption_base_qty end)
           else null end,
      case
        when w.workload_status = 'BLOCKED' then 'BLOCKED'
        when v_pool.pool_status = 'BLOCKED' then 'BLOCKED'
        when pb.absorption_basis_status = 'BLOCKED' or pb.product_absorption_base_qty is null or pb.product_absorption_base_qty <= 0 then 'BLOCKED'
        when w.workload_status = 'REVIEW_REQUIRED' or v_pool.pool_status = 'REVIEW_REQUIRED' or pb.absorption_basis_status = 'REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
        else 'READY'
      end,
      case
        when w.workload_status = 'BLOCKED' then w.workload_reason_code
        when v_pool.pool_status = 'BLOCKED' then 'BLOCKED_QC_POOL'
        when pb.absorption_basis_status = 'BLOCKED' or pb.product_absorption_base_qty is null or pb.product_absorption_base_qty <= 0 then 'BLOCKED_QC_ABSORPTION_DENOMINATOR'
        when w.workload_status = 'REVIEW_REQUIRED' then w.workload_reason_code
        when v_pool.pool_status = 'REVIEW_REQUIRED' then 'REVIEW_REQUIRED_QC_POOL'
        when pb.absorption_basis_status = 'REVIEW_REQUIRED' then 'REVIEW_REQUIRED_QC_ABSORPTION_BASIS'
        else 'READY_QC_WORKLOAD_AND_ABSORPTION'
      end,
      case
        when w.workload_status = 'BLOCKED' then w.workload_note
        when v_pool.pool_status = 'BLOCKED' then v_pool.pool_note
        when pb.absorption_basis_status = 'BLOCKED' or pb.product_absorption_base_qty is null or pb.product_absorption_base_qty <= 0 then 'Positive governed Product absorption quantity is unavailable.'
        when pb.absorption_basis_status = 'REVIEW_REQUIRED' then 'QC allocation is valid; the per-base-UOM rate uses a governed assumption or default quantity and requires review.'
        else 'QC pool share is driven by effective-spec Method 3 workload; per-base-UOM absorption uses the governed monthly Product quantity.'
      end || case when v_bt and bt.bt then format(' [AU-6Q QC batch-true: Rs %s per QC workload unit-batch x %s units / batch %s]', round(v_rate_bt,4), w.workload_units, bt.bs) else '' end,
      v_recipient_count, v_included_count, v_excluded_count, v_coverage,
      clock_timestamp()
    from costing.product_qc_workload_snapshot w
    join product_basis pb on pb.product_id = w.product_id
    left join _au6q_qc_bt bt on v_bt and bt.product_id = w.product_id
    where w.refresh_run_id = p_refresh_run_id
      and w.period_start = v_period_start
      and w.valuation_date = p_valuation_date;

    insert into costing.sku_qc_allocation_snapshot (
      period_start, valuation_date, refresh_run_id,
      product_qc_allocation_snapshot_id, sales_allocation_basis_snapshot_id,
      sku_id, product_id, product_name, pack_size, pack_uom,
      product_base_uom, sku_base_qty_per_unit,
      qc_cost_per_product_base_uom, quality_control_overhead_cost_per_sku,
      allocation_status, allocation_reason_code, allocation_note,
      refreshed_at
    )
    select
      b.period_start, b.valuation_date, b.refresh_run_id,
      p.id, b.id,
      b.sku_id, b.product_id, b.product_name, b.pack_size, b.pack_uom,
      b.product_base_uom,
      case when p.allocation_status <> 'BLOCKED' then b.sku_base_qty_per_unit else null end,
      p.qc_cost_per_product_base_uom,
      case when p.allocation_status <> 'BLOCKED' and b.sku_base_qty_per_unit > 0
           then p.qc_cost_per_product_base_uom * b.sku_base_qty_per_unit
           else null end,
      case
        when p.allocation_status = 'BLOCKED' then 'BLOCKED'
        when b.sku_base_qty_per_unit is null or b.sku_base_qty_per_unit <= 0 then 'BLOCKED'
        when p.allocation_status = 'REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
        else 'READY'
      end,
      case
        when p.allocation_status = 'BLOCKED' then p.allocation_reason_code
        when b.sku_base_qty_per_unit is null or b.sku_base_qty_per_unit <= 0 then 'BLOCKED_INVALID_SKU_BASE_CONVERSION'
        when p.allocation_status = 'REVIEW_REQUIRED' then p.allocation_reason_code
        else 'READY_QC_SKU_CONVERSION'
      end,
      case
        when p.allocation_status = 'BLOCKED' then p.allocation_note
        when b.sku_base_qty_per_unit is null or b.sku_base_qty_per_unit <= 0 then 'Positive SKU base quantity per unit is required.'
        when p.allocation_status = 'REVIEW_REQUIRED' then p.allocation_note
        else 'Product QC cost per base UOM converted to the SKU using its governed base quantity per unit.'
      end,
      clock_timestamp()
    from costing.sku_sales_allocation_basis_snapshot b
    join costing.product_qc_allocation_snapshot p
      on p.refresh_run_id = b.refresh_run_id
     and p.product_id = b.product_id
    where b.refresh_run_id = p_refresh_run_id
      and b.period_start = v_period_start
      and b.valuation_date = p_valuation_date;

    if v_bt then
      insert into costing.batch_true_absorption_variance(refresh_run_id,allocation_pool,pool_amount,absorbed_at_standard,variance_amount,products_batch_true,products_current_method,rate_used,rate_basis)
      select p_refresh_run_id,'QUALITY_CONTROL_OVERHEAD',v_pool.total_pool_amount,coalesce(sum(amt),0),v_pool.total_pool_amount-coalesce(sum(amt),0),
             count(*) filter (where bt),count(*) filter (where not bt and old_amt is not null),v_rate_bt,'NORMAL_VOLUME_RATE' from _au6q_qc_bt
      on conflict (refresh_run_id,allocation_pool) do update set pool_amount=excluded.pool_amount,absorbed_at_standard=excluded.absorbed_at_standard,
        variance_amount=excluded.variance_amount,products_batch_true=excluded.products_batch_true,products_current_method=excluded.products_current_method,
        rate_used=excluded.rate_used,rate_basis=excluded.rate_basis,created_at=now();
    end if;

    return query
    select
      v_period_start,
      count(*)::bigint,
      (select count(*)::bigint from costing.sku_qc_allocation_snapshot s where s.refresh_run_id = p_refresh_run_id),
      count(*) filter (where p.allocation_status = 'BLOCKED')::bigint,
      count(*) filter (where p.allocation_status = 'REVIEW_REQUIRED')::bigint,
      count(*) filter (where p.allocation_status = 'READY')::bigint,
      coalesce(sum(p.product_qc_allocation_amount),0),
      v_pool.total_pool_amount - coalesce(sum(p.product_qc_allocation_amount),0)
    from costing.product_qc_allocation_snapshot p
    where p.refresh_run_id = p_refresh_run_id;
end;
$function$
;
revoke all on function costing.rpc_refresh_qc_monetary_allocation_snapshot(date,date,bigint) from public, anon, authenticated;
comment on table costing.qc_batch_true_switch is 'AU-6Q: QC per-batch allocation gate (effective-dated). Off or valuation < effective_from = pre-AU-6Q behaviour, byte-identical.';
-- ROLLBACK: update costing.qc_batch_true_switch set is_enabled=false;  (instant, behaviour byte-identical to pre-AU-6Q; tested T1-T3)
--   full: re-create the function from the pre-AU-6Q definition (evidence/AU6Q/live_qc_alloc_pre_au6q.sql); drop function costing.fn_qc_batch_true_effective(date); drop table costing.qc_batch_true_switch;
