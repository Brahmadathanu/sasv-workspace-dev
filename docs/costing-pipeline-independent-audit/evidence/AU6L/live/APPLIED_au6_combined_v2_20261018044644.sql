-- AU-6 COMBINED PACKAGE v2. PREPARED, NOT APPLIED. User approved BUILD + LOCAL TEST only (2026-10-18 09:22 IST).
-- Supersedes proposals/au6_combined/PREPARED_au6_combined_package.sql (its part C, AU-6A power-exponent scaling, was rejected 09:06 IST).
-- Contents (one migration, in this order):
--   A. AU-6Q   QC per batch (unchanged from v1).
--   B. AU-6S   kit/pack base quantity K1 + K4 (unchanged from v1): 865 = 1 kit (275 g), 878 = 1 kit (500 g) from period 2026-10-01.
--   C. AU-6L   equipment-loads route workload: step weight x loads, loads = ceil(batch charge / capacity per load), min 1, for
--              weight-driven equipment; 1 per batch for fixed steps; batch_size_ref is the batch; full pool absorbed (rate re-derived).
--              Capacities in costing.route_equipment_load_capacity (editable, effective-dated, PROVISIONAL flag + source note).
--              Built into the INSERT path of the Manufacturing-Labour and Production-Overhead writers; own switch; valuation >= 2026-10-01.
--   D. SALES-01 costing-only sales feed: company-wide monthly net units, negatives = 0, no per-godown outlier filter; seasonal SKUs
--              (top-3 months >= 60% of the 12-month volume, editable) use the 12-month average monthly volume; own switch; period >= 2026-10-01.
--              public.v_sales_monthly_clean / fn_sales_monthly_clean_as_of are NOT changed (forecasting uses them).
-- Sep run 122 (period 2026-09, valuation 2026-09-10, APPROVED) is untouched: every gate is >= 2026-10-01 and its snapshots are immutable.
-- Keep OUT of supabase/migrations. Apply only via Supabase MCP apply_migration after notifying Jarvis, with run-122 fingerprint before/after.
-- Approval placeholders filled: USER-APPROVAL-20261018-AU6-V2 (user dff17104-c02a-4bca-95b1-e8ddff46a9b6, approved 2026-10-18 10:13 IST). Rollback: end of file.

do $g$
begin
  if exists (select 1 from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')) then
    raise exception 'AU-6 v2 package: a costing run is in progress'; end if;
  if md5(pg_get_functiondef('costing.rpc_refresh_production_overhead_workload_snapshot(date,date,bigint)'::regprocedure)) <> '65148089c070ac95002caa3ee83a8098'
  or md5(pg_get_functiondef('costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint)'::regprocedure)) <> '5b77af292903abb73cd30ded2f36e5e0'
  or md5(pg_get_functiondef('costing.rpc_refresh_qc_monetary_allocation_snapshot(date,date,bigint)'::regprocedure)) <> '7a599a4dad0c4436cc8431d109470f2c'
  or md5(pg_get_functiondef('costing.rpc_refresh_sku_sales_allocation_basis_snapshot(date,date,bigint)'::regprocedure)) <> '73eaacaa6bd41180b26e72eedadb0e78' then
    raise exception 'AU-6 v2 package: a writer drifted from the reviewed live definition (2026-10-18)'; end if;
end $g$;

-- ============================== A. AU-6Q ==============================
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
values (true,true,date '2026-10-01','USER-APPROVAL-20261018-AU6-V2','dff17104-c02a-4bca-95b1-e8ddff46a9b6','AU-6Q QC per-batch allocation from Oct 2026')
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


-- ============================== B. AU-6S kit / pack base quantity ==============================
do $g$
begin
  if md5(pg_get_viewdef('costing.v_sku_sales_volume_allocation_basis'::regclass,true)) <> '1b3332c46400c1934fba6872a60e6a6a'
  or md5(pg_get_viewdef('public.v_sku_to_base_multiplier'::regclass,true)) <> '22cfc332dcebe754c90618259f149737' then
    raise exception 'AU6S-K: view drifted from the reviewed definition'; end if;
  if (select count(*) from costing.sku_base_quantity_exception
       where (sku_id,product_id,sku_base_qty_per_unit,base_uom) in ((865,685,1,'Nos'),(878,695,1,'Nos'))) <> 2 then
    raise exception 'AU6S-K: governed exception rows are not as approved'; end if;
  if (select preferred_batch_size from public.production_batch_size_ref where id=311 and product_id=695 and effective_to is null) is distinct from 50000 then
    raise exception 'AU6S-K: Kanji batch ref 311 changed since review'; end if;
end $g$;
-- K1a: activation date per exception. NULL means documented but not used by the costing writers.
alter table costing.sku_base_quantity_exception add column if not exists costing_effective_from date;
comment on column costing.sku_base_quantity_exception.costing_effective_from is
  'First costing period in which the run writers use sku_base_qty_per_unit. NULL = not active in runs.';
update costing.sku_base_quantity_exception set costing_effective_from = date '2026-10-01'
 where (sku_id, product_id) in ((865,685),(878,695)) and costing_effective_from is null;
-- 878 (user 2026-10-18: 1 pack = 500 g = 1 unit). Batch ref 311 = 50,000 Nos is kept: BMR SP718 (50,000 Nos) was transferred as
-- 50,052 x 500 g packets (Tally FG transfer, Jun-Jul 2025), so 50,000 is packs per batch, not grams.

-- K1b: the allocation-basis view feeds sku_sales_allocation_basis_snapshot, which drives monthly base qty,
--      DL/POH/QC workload, pricing and the negative-margin set. Column list and order are unchanged.
create or replace view costing.v_sku_sales_volume_allocation_basis as
WITH periods AS (
         SELECT cost_periods.period_start
           FROM costing.cost_periods
          WHERE cost_periods.status = ANY (ARRAY['OPEN'::text, 'LOCKED'::text])
        ), active_skus AS (
         SELECT ps.id AS sku_id,
            ps.product_id,
            p_1.item AS product_name,
            p_1.uom_base AS product_base_uom,
            p_1.conversion_to_base,
            ps.pack_size,
            ps.uom AS pack_uom,
            COALESCE(ps.pack_size, 0::numeric) * COALESCE(p_1.conversion_to_base, 1::numeric) AS sku_base_qty_per_unit,
            x.sku_base_qty_per_unit AS exception_base_qty,
            x.costing_effective_from AS exception_costing_from
           FROM product_skus ps
             JOIN products p_1 ON p_1.id = ps.product_id
             LEFT JOIN costing.sku_base_quantity_exception x ON x.sku_id = ps.id AND x.product_id = ps.product_id AND x.base_uom = p_1.uom_base
          WHERE ps.is_active = true AND COALESCE(p_1.status, ''::text) ~~* 'active'::text
        ), sku_sales_12m AS (
         SELECT pr.period_start,
            s_1.sku_id,
            s_1.product_id,
            s_1.product_name,
            s_1.product_base_uom,
            s_1.conversion_to_base,
            s_1.pack_size,
            s_1.pack_uom,
            CASE WHEN s_1.exception_base_qty IS NOT NULL AND s_1.exception_costing_from IS NOT NULL AND pr.period_start >= s_1.exception_costing_from THEN s_1.exception_base_qty ELSE s_1.sku_base_qty_per_unit END AS sku_base_qty_per_unit,
            COALESCE(sum(COALESCE(v.qty_clean, 0::numeric)), 0::numeric) AS sales_units_12m,
            COALESCE(sum(COALESCE(v.qty_clean, 0::numeric)), 0::numeric) * COALESCE(CASE WHEN s_1.exception_base_qty IS NOT NULL AND s_1.exception_costing_from IS NOT NULL AND pr.period_start >= s_1.exception_costing_from THEN s_1.exception_base_qty ELSE s_1.sku_base_qty_per_unit END, 0::numeric) AS sales_base_qty_12m
           FROM periods pr
             CROSS JOIN active_skus s_1
             LEFT JOIN v_sales_monthly_clean v ON v.sku_id = s_1.sku_id AND v.month_start >= (pr.period_start - '1 year'::interval) AND v.month_start < pr.period_start
          GROUP BY pr.period_start, s_1.sku_id, s_1.product_id, s_1.product_name, s_1.product_base_uom, s_1.conversion_to_base, s_1.pack_size, s_1.pack_uom, s_1.sku_base_qty_per_unit, s_1.exception_base_qty, s_1.exception_costing_from
        ), product_sales_12m AS (
         SELECT sku_sales_12m.period_start,
            sku_sales_12m.product_id,
            sum(sku_sales_12m.sales_units_12m) AS product_sales_units_12m,
            sum(sku_sales_12m.sales_base_qty_12m) AS product_sales_base_qty_12m
           FROM sku_sales_12m
          GROUP BY sku_sales_12m.period_start, sku_sales_12m.product_id
        ), company_sales_12m AS (
         SELECT product_sales_12m.period_start,
            sum(product_sales_12m.product_sales_units_12m) AS company_sales_units_12m
           FROM product_sales_12m
          GROUP BY product_sales_12m.period_start
        )
 SELECT s.period_start,
    s.sku_id,
    s.product_id,
    s.product_name,
    s.product_base_uom,
    s.conversion_to_base,
    s.pack_size,
    s.pack_uom,
    s.sku_base_qty_per_unit,
    s.sales_units_12m,
    s.sales_base_qty_12m,
    p.product_sales_units_12m,
    p.product_sales_base_qty_12m,
    c.company_sales_units_12m,
        CASE
            WHEN c.company_sales_units_12m > 0::numeric THEN p.product_sales_units_12m / c.company_sales_units_12m
            ELSE 0::numeric
        END AS product_allocation_share,
        CASE
            WHEN c.company_sales_units_12m IS NULL OR c.company_sales_units_12m = 0::numeric THEN 'NO_TOTAL_SALES_BASIS'::text
            WHEN p.product_sales_units_12m = 0::numeric THEN 'NO_PRODUCT_SALES_IN_LOOKBACK'::text
            WHEN s.sales_units_12m = 0::numeric THEN 'NO_SKU_SALES_IN_LOOKBACK'::text
            WHEN p.product_sales_base_qty_12m = 0::numeric THEN 'NO_PRODUCT_BASE_QTY'::text
            ELSE 'OK'::text
        END AS allocation_basis_status,
    (s.period_start - '1 year'::interval)::date AS lookback_start,
    (s.period_start - '1 mon'::interval)::date AS lookback_end
   FROM sku_sales_12m s
     JOIN product_sales_12m p ON p.period_start = s.period_start AND p.product_id = s.product_id
     JOIN company_sales_12m c ON c.period_start = s.period_start;

do $c$
declare n int;
begin
  select count(*) into n from costing.v_sku_sales_volume_allocation_basis
   where period_start >= date '2026-10-01' and sku_id = 865 and sku_base_qty_per_unit = 1;
  if n < 1 then raise exception 'AU6S-K: 865 not resolved to 1 Nos'; end if;
  select count(*) into n from costing.v_sku_sales_volume_allocation_basis
   where (period_start < date '2026-10-01' and sku_id = 865 and sku_base_qty_per_unit <> 275)
      or (period_start < date '2026-10-01' and sku_id = 878 and sku_base_qty_per_unit <> 500)
      or (period_start >= date '2026-10-01' and sku_id = 878 and sku_base_qty_per_unit <> 1);
  if n > 0 then raise exception 'AU6S-K: pre-October periods changed or 878 not resolved'; end if;
end $c$;

-- K4: inventory/MRP base view. There is no g->Nos UOM conversion, so 865 and 878 return NULL today.
--     Honour the exception here. This view describes the physical pack, so it is not period-gated.
--     Dependents: v_fg_stock_latest_product_region_base and v_industries_sku_canonical_rate.
--     The column list is unchanged.
create or replace view public.v_sku_to_base_multiplier as
 WITH uom_map AS (
         SELECT inv_uom.id, inv_uom.code FROM inv_uom
        ), sku_uom AS (
         SELECT ps.id AS sku_id, ps.product_id, ps.pack_size, ps.uom AS sku_uom_code, u.id AS sku_uom_id
           FROM product_skus ps JOIN uom_map u ON u.code = ps.uom
        ), prod_uom AS (
         SELECT p_1.id AS product_id, p_1.uom_base AS prod_uom_code, u.id AS prod_uom_id,
            COALESCE(p_1.conversion_to_base, 1::numeric) AS prod_conv_to_base
           FROM products p_1 JOIN uom_map u ON u.code = p_1.uom_base
        )
 SELECT s.sku_id, s.product_id, p.prod_uom_code AS product_base_uom, s.pack_size, s.sku_uom_code AS sku_uom,
    COALESCE(CASE WHEN s.sku_uom_id = p.prod_uom_id THEN 1::numeric ELSE NULL::numeric END, c.factor,
             x.sku_base_qty_per_unit / NULLIF(s.pack_size, 0))::numeric(18,6) AS uom_factor,
    COALESCE(x.sku_base_qty_per_unit,
             s.pack_size * COALESCE(CASE WHEN s.sku_uom_id = p.prod_uom_id THEN 1::numeric ELSE NULL::numeric END, c.factor) * p.prod_conv_to_base
            )::numeric(18,6) AS base_qty_per_sku_unit
   FROM sku_uom s
     JOIN prod_uom p ON p.product_id = s.product_id
     LEFT JOIN inv_uom_conversion c ON c.from_uom_id = s.sku_uom_id AND c.to_uom_id = p.prod_uom_id
     LEFT JOIN costing.sku_base_quantity_exception x
            ON x.sku_id = s.sku_id AND x.product_id = s.product_id AND x.base_uom = p.prod_uom_code;



-- ============================== C. AU-6L equipment-loads route workload ==============================
-- Step workload = approved step weight x loads, loads = ceil(batch charge / capacity per load) (min 1) for weight-driven
-- equipment, 1 per batch for fixed steps. Charge from batch_size_ref: SOLID steps use batch kg (Kg products) or the RM BOM
-- kg lines scaled to the batch (L / Nos products); OUTPUT steps use the output batch (kg or L). Unit-mass overrides
-- (kit 865 / Kanji 878, per-gram BOMs) give charge = batch x unit mass. Own switch, valuation >= 2026-10-01, AU-5 batch-true required.
create table if not exists costing.route_load_scaling_switch(
  id boolean primary key default true check (id),
  is_enabled boolean not null default false,
  effective_from date not null default date '2026-10-01'
    check (effective_from >= date '2026-10-01' and effective_from = date_trunc('month', effective_from)::date),
  approval_reference text, changed_by text, changed_at timestamptz default now(), note text);
revoke all on costing.route_load_scaling_switch from anon, authenticated;
grant select on costing.route_load_scaling_switch to authenticated;

-- Editable, effective-dated capacity table: one row per equipment class. Exactly one row per resource class must be the
-- class default on any date (that is the capacity the writers use); other rows document equipment sharing the class.
create table if not exists costing.route_equipment_load_capacity(
  id bigint generated by default as identity primary key,
  equipment_class_code text not null,
  equipment_class_label text not null,
  resource_class_code text not null references costing.production_resource_class(code),
  load_basis text not null check (load_basis in ('WEIGHT','FIXED')),
  charge_basis text check (charge_basis in ('SOLID','OUTPUT')),
  capacity_kg numeric check (capacity_kg > 0),
  capacity_l numeric check (capacity_l > 0),
  is_resource_class_default boolean not null default false,
  is_provisional boolean not null default true,
  source_note text not null,
  approval_reference text not null,
  effective_from date not null check (effective_from >= date '2026-10-01'),
  effective_to date,
  created_at timestamptz not null default now(), created_by text,
  check (effective_to is null or effective_to >= effective_from),
  check ((load_basis = 'FIXED' and charge_basis is null and capacity_kg is null and capacity_l is null)
      or (load_basis = 'WEIGHT' and charge_basis is not null and coalesce(capacity_kg, capacity_l) is not null)),
  unique (equipment_class_code, effective_from));
create unique index if not exists route_equipment_load_capacity_one_default
  on costing.route_equipment_load_capacity(resource_class_code, effective_from) where is_resource_class_default;
revoke all on costing.route_equipment_load_capacity from anon, authenticated;
grant select on costing.route_equipment_load_capacity to authenticated;

insert into costing.route_equipment_load_capacity(equipment_class_code,equipment_class_label,resource_class_code,load_basis,charge_basis,capacity_kg,capacity_l,is_resource_class_default,is_provisional,source_note,approval_reference,effective_from) values
 ('GRINDER_PULVERISER','Grinder / pulveriser / disintegrator','GRINDER','WEIGHT','SOLID',50,null,true,true,'PROVISIONAL user value 2026-10-18 (no capacity in machine master)','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('SIEVE','Sieve / vibro-sifter (steps carry resource class GRINDER)','GRINDER','WEIGHT','SOLID',50,null,false,true,'PROVISIONAL user value 2026-10-18','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('TRAY_DRYER','Electric tray dryer','DRYER_OR_OVEN','WEIGHT','SOLID',50,null,true,true,'PROVISIONAL user value 2026-10-18 (24 trays x ~2 kg)','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('FIREWOOD_DRYER','Firewood dryer (steps carry resource class DRYER_OR_OVEN)','DRYER_OR_OVEN','WEIGHT','SOLID',50,null,false,true,'PROVISIONAL user value 2026-10-18','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('MANUAL_LOT','Manual cleaning / washing / handling lot','MANUAL','WEIGHT','SOLID',50,null,true,true,'PROVISIONAL user value 2026-10-18','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('TABLET_CAPSULE_PILL','Granulator / tablet press / capsule filler / pill machine','TABLET_OR_CAPSULE_EQUIPMENT','WEIGHT','SOLID',50,null,true,true,'PROVISIONAL user value 2026-10-18','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('PLANETARY_MIXER','Planetary mixer','MIXING_EQUIPMENT','WEIGHT','SOLID',200,null,true,true,'PROVISIONAL user value 2026-10-18','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('PUTA','Puta (calcination) charge','CALCINATION','WEIGHT','SOLID',25,null,true,true,'PROVISIONAL user value 2026-10-18','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('TRADITIONAL_FURNACE','Traditional furnace / stove charge (puta value applied)','TRADITIONAL_FURNACE','WEIGHT','SOLID',25,null,true,true,'PROVISIONAL: puta value applied (user list has no separate furnace value)','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('PROCESSING_VESSEL','SS processing vessel','PROCESSING_VESSEL','WEIGHT','OUTPUT',220,500,true,true,'Evidence: daily_work_log P90 single-vessel batch 220 kg / 500 L; user value 2026-10-18','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('FILTRATION','Filtration (follows processing vessel)','FILTRATION_SYSTEM','WEIGHT','OUTPUT',220,500,true,true,'PROVISIONAL: vessel value applied (filtration follows the vessel charge)','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('COOKER','SS cooker / extraction (juice press shares the class)','EXTRACTION_SYSTEM','WEIGHT','OUTPUT',370,500,true,true,'Evidence: daily_work_log P90 single-cooker batch 370 kg / 500 L; user value 2026-10-18','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('FERMENTATION_TANK','Fermentation tank','FERMENTATION_VESSEL','WEIGHT','OUTPUT',null,3000,true,true,'Evidence: plant names (1500 / 3000 L tanks); user value 2026-10-18','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('GENERAL_AREA','General area (fixed)','GENERAL_AREA','FIXED',null,null,null,true,false,'Fixed: 1 per batch','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('STORAGE','Storage / holding (fixed)','STORAGE_OCCUPANCY','FIXED',null,null,null,true,false,'Fixed: 1 per batch','USER-APPROVAL-20261018-AU6-V2','2026-10-01'),
 ('EXTERNAL_JOB_WORK','External job work (fixed)','EXTERNAL_JOB_WORK','FIXED',null,null,null,true,false,'Fixed: 1 per batch','USER-APPROVAL-20261018-AU6-V2','2026-10-01')
on conflict (equipment_class_code, effective_from) do nothing;

-- Unit-mass overrides where the BOM unit is not the costing unit (per-gram BOMs of the kit SKUs).
create table if not exists costing.route_batch_charge_unit_mass(
  id bigint generated by default as identity primary key,
  product_id bigint not null, unit_mass_kg numeric not null check (unit_mass_kg > 0),
  effective_from date not null check (effective_from >= date '2026-10-01'), effective_to date,
  source_note text not null, approval_reference text not null, created_at timestamptz not null default now(),
  unique (product_id, effective_from));
revoke all on costing.route_batch_charge_unit_mass from anon, authenticated;
grant select on costing.route_batch_charge_unit_mass to authenticated;
insert into costing.route_batch_charge_unit_mass(product_id,unit_mass_kg,effective_from,source_note,approval_reference) values
 (685,0.275,'2026-10-01','Kashaya Vasthi Kit: 1 kit = 275 g (K1); BOM 2627 is per gram','USER-APPROVAL-20261018-AU6-V2'),
 (695,0.500,'2026-10-01','Karkkidaka Kanji: 1 kit = 500 g (K1); BOM 2686 is per gram','USER-APPROVAL-20261018-AU6-V2')
on conflict (product_id, effective_from) do nothing;

-- Per-run lineage: charges, raw vs loads-weighted factor and per-step loads actually used (capacities frozen per run).
create table if not exists costing.route_load_scaling_snapshot(
  id bigint generated by default as identity primary key,
  period_start date not null, valuation_date date not null, refresh_run_id bigint not null,
  allocation_pool text not null check (allocation_pool in ('PRODUCTION_OVERHEAD','MANUFACTURING_LABOUR')),
  product_id bigint not null, product_base_uom text, preferred_batch_size numeric,
  solid_charge_kg numeric, output_charge numeric, output_charge_uom text, charge_source text,
  raw_factor numeric, scaled_factor numeric, approval_reference text,
  step_detail jsonb, created_at timestamptz not null default now(),
  unique (refresh_run_id, allocation_pool, product_id));
revoke all on costing.route_load_scaling_snapshot from anon, authenticated;
grant select on costing.route_load_scaling_snapshot to authenticated;
drop trigger if exists trg_au2_designated_run_guard on costing.route_load_scaling_snapshot;
create trigger trg_au2_designated_run_guard before insert or delete or update on costing.route_load_scaling_snapshot for each row execute function costing.fn_guard_designated_run_rows();
drop trigger if exists trg_au2_mutable_run_guard on costing.route_load_scaling_snapshot;
create trigger trg_au2_mutable_run_guard before insert or delete or update on costing.route_load_scaling_snapshot for each row execute function costing.fn_enforce_mutable_refresh_run_snapshot();
drop trigger if exists trg_au2_snapshot_truncate_guard on costing.route_load_scaling_snapshot;
create trigger trg_au2_snapshot_truncate_guard before truncate on costing.route_load_scaling_snapshot for each statement execute function costing.fn_guard_snapshot_truncate();

-- Gate: switch on AND valuation >= effective_from AND AU-5 batch-true effective (Sep run 122, valuation 2026-09-10: never).
create or replace function costing.fn_route_load_scaling_mode(p_valuation_date date)
returns table(approval_reference text)
language sql stable security definer set search_path to 'costing','pg_temp' as $$
  select coalesce(s.approval_reference,'(none)') from costing.route_load_scaling_switch s
   where s.is_enabled and p_valuation_date >= s.effective_from and costing.fn_batch_true_effective(p_valuation_date)
$$;
revoke all on function costing.fn_route_load_scaling_mode(date) from public, anon, authenticated;

-- Batch charge from batch_size_ref (kg solids; output qty + uom).
create or replace function costing.fn_route_batch_charge(p_product_id bigint, p_batch_size numeric, p_base_uom text, p_valuation_date date)
returns table(solid_kg numeric, output_qty numeric, output_uom text, charge_source text)
language sql stable security definer set search_path to 'costing','public','pg_temp' as $$
  with um as (select u.unit_mass_kg from costing.route_batch_charge_unit_mass u
               where u.product_id = p_product_id and u.effective_from <= p_valuation_date
                 and (u.effective_to is null or u.effective_to >= p_valuation_date)
               order by u.effective_from desc limit 1),
  h as (select h.id, h.reference_output_qty ref from public.rm_bom_header h
         where h.product_id = p_product_id and coalesce(h.reference_output_qty,0) > 0 order by h.id desc limit 1),
  b as (select h.ref,
               sum(l.qty_per_reference_output * case u.code when 'Kg' then 1 when 'g' then 0.001 else 0 end) kg,
               sum(l.qty_per_reference_output * case u.code when 'L' then 1 when 'mL' then 0.001 else 0 end) lt
          from h join public.rm_bom_line l on l.rm_bom_id = h.id join public.inv_uom u on u.id = l.uom_id
         group by h.ref)
  select case when (select unit_mass_kg from um) is not null then p_batch_size * (select unit_mass_kg from um)
              when p_base_uom = 'Kg' then p_batch_size
              when (select kg from b) > 0 then p_batch_size * (select kg from b) / (select ref from b)
              when p_base_uom = 'L' then p_batch_size
              when (select kg + lt from b) > 0 then p_batch_size * (select kg + lt from b) / (select ref from b) end,
         case when (select unit_mass_kg from um) is not null then p_batch_size * (select unit_mass_kg from um)
              when p_base_uom in ('Kg','L') then p_batch_size
              when (select kg + lt from b) > 0 then p_batch_size * (select kg + lt from b) / (select ref from b) end,
         case when (select unit_mass_kg from um) is null and p_base_uom = 'L' then 'L' else 'Kg' end,
         case when (select unit_mass_kg from um) is not null then 'UNIT_MASS_OVERRIDE'
              when p_base_uom in ('Kg','L') or (select kg + lt from b) > 0 then 'BATCH_SIZE_REF_AND_RM_BOM'
              else 'NO_CHARGE_EVIDENCE_ONE_LOAD' end
$$;
revoke all on function costing.fn_route_batch_charge(bigint,numeric,text,date) from public, anon, authenticated;

-- Loads for one step (null = resource class has no capacity row: callers fail closed).
create or replace function costing.fn_route_step_loads(p_resource_class_code text, p_solid_kg numeric, p_output_qty numeric, p_output_uom text, p_valuation_date date)
returns numeric language sql stable security definer set search_path to 'costing','pg_temp' as $$
  select case when c.load_basis = 'FIXED' then 1::numeric
              else greatest(1::numeric, ceil(coalesce(case when c.charge_basis = 'OUTPUT' then p_output_qty else p_solid_kg end, 0)
                     / case when c.charge_basis = 'OUTPUT' and p_output_uom = 'L' then coalesce(c.capacity_l, c.capacity_kg)
                            else coalesce(c.capacity_kg, c.capacity_l) end)) end
    from costing.route_equipment_load_capacity c
   where c.resource_class_code = p_resource_class_code and c.is_resource_class_default
     and c.effective_from <= p_valuation_date and (c.effective_to is null or c.effective_to >= p_valuation_date)
   order by c.effective_from desc limit 1
$$;
revoke all on function costing.fn_route_step_loads(text,numeric,numeric,text,date) from public, anon, authenticated;
comment on table costing.route_load_scaling_switch is 'AU-6L: route step workload = step weight x equipment loads per batch. Off or valuation < effective_from = pre-AU-6L behaviour.';
comment on table costing.route_equipment_load_capacity is 'AU-6L: capacity per load by equipment class (editable, effective-dated, provisional flag). The class-default row per resource class is used by the writers.';

CREATE OR REPLACE FUNCTION costing.rpc_refresh_sku_direct_labour_component_split_snapshot(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 RETURNS TABLE(refreshed_period_start date, inserted_row_count bigint, blocked_count bigint, review_required_count bigint, ready_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
  v_period_start date := date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_policy costing.direct_labour_workload_policy%rowtype;
  v_preview jsonb;
  v_total_pool numeric;
  v_mfg_component_id bigint;
  v_pack_component_id bigint;
  v_mfg_pool numeric;
  v_pack_pool numeric;
  v_mfg_staff_count bigint;
  v_pack_staff_count bigint;
  v_recipient_count integer;
  v_eligible_count integer;
  v_blocked_product_count integer;
  v_company_mfg_workload numeric;
  v_company_pack_units numeric;
  v_bt boolean;
  v_rl text;          -- AU-6L equipment-loads approval (null = off)
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'period_start, valuation_date and refresh_run_id are required';
  end if;

  select * into v_run from costing.costing_refresh_run where id=p_refresh_run_id;
  if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;
  if v_run.period_start is distinct from v_period_start
     or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Direct Labour component snapshot context does not match refresh run %',p_refresh_run_id;
  end if;
  if not (
    v_run.overall_status='SUCCESS'
    or (
      v_run.overall_status='RUNNING'
      and v_run.current_stage_code='03_COST_BUILD_TO_SCHEME'
      and exists (
        select 1 from costing.costing_refresh_run_stage s
        where s.refresh_run_id=p_refresh_run_id
          and s.stage_code='03_COST_BUILD_TO_SCHEME'
          and s.stage_status='RUNNING'
      )
    )
  ) then
    raise exception 'Direct Labour component snapshots require governed Stage 03 RUNNING context or an already-successful exact run';
  end if;

  select * into v_policy from costing.fn_resolve_direct_labour_workload_policy(p_valuation_date);
  if v_policy.formula_type is distinct from 'MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS' then
    raise exception 'Resolved Direct Labour policy %/% is not component-split and cannot use this writer',v_policy.policy_code,v_policy.policy_version;
  end if;

  if exists(select 1 from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.product_direct_labour_step_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_direct_labour_allocation_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_packing_labour_workload_snapshot where refresh_run_id=p_refresh_run_id) then
    raise exception 'Direct Labour snapshots already exist for refresh run % and are immutable',p_refresh_run_id;
  end if;

  select total_pool_amount into v_total_pool
  from costing.cost_pool_monthly_snapshot
  where period_start=v_period_start
    and valuation_date=p_valuation_date
    and refresh_run_id=p_refresh_run_id
    and allocation_pool='DIRECT_LABOUR';
  if v_total_pool is null then raise exception 'Direct Labour frozen pool is missing for exact run %',p_refresh_run_id; end if;

  select id,component_pool_amount,staff_count
    into v_mfg_component_id,v_mfg_pool,v_mfg_staff_count
  from costing.direct_labour_component_pool_snapshot
  where refresh_run_id=p_refresh_run_id and component_code='MANUFACTURING_LABOUR';

  select id,component_pool_amount,staff_count
    into v_pack_component_id,v_pack_pool,v_pack_staff_count
  from costing.direct_labour_component_pool_snapshot
  where refresh_run_id=p_refresh_run_id and component_code='PACKING_LABOUR';

  if v_mfg_component_id is null or v_pack_component_id is null then
    raise exception 'Frozen Direct Labour component pools are incomplete for run %',p_refresh_run_id;
  end if;
  if (v_mfg_pool+v_pack_pool) is distinct from v_total_pool then
    raise exception 'Frozen Direct Labour component pools do not reconcile for run %: manufacturing %, packing %, total %',p_refresh_run_id,v_mfg_pool,v_pack_pool,v_total_pool;
  end if;

  v_preview:=costing.fn_preview_direct_labour_shadow_workload(v_policy.id,v_period_start,p_valuation_date,p_refresh_run_id,null);

  create temporary table tmp_dl_product on commit drop as
  select x.*,
    case when x.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and x.direct_labour_workload_units>0 then true else false end as is_eligible
  from jsonb_to_recordset(v_preview->'rows') as x(
    product_id bigint,product_name text,product_base_uom text,recipient_sku_count integer,
    monthly_product_base_qty numeric,monthly_driver_status text,standard_batch_count bigint,
    route_family_id bigint,family_route_id bigint,product_route_id bigint,effective_route_source text,
    foundation_status text,foundation_note text,workload_status text,workload_note text,
    direct_labour_route_intensity numeric,direct_labour_workload_units numeric,labour_step_evidence jsonb
  );

  create temporary table tmp_packing_responsibility on commit drop as
  select t.product_id,t.route_family_id,pr.rule_id,pr.responsibility_code,pr.resolution_source,pr.rationale
  from tmp_dl_product t
  cross join lateral costing.fn_resolve_packing_labour_responsibility(t.route_family_id,p_valuation_date) pr;

  update tmp_dl_product t
  set workload_status = case
          when t.foundation_status like 'REVIEW_REQUIRED%' then 'REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR'
          else 'READY_ZERO_MANUFACTURING_LABOUR'
      end,
      workload_note = case
          when t.foundation_status like 'REVIEW_REQUIRED%' then
              'The governed route intentionally contains no Manufacturing-Labour steps; Manufacturing Labour is zero, while the quantity foundation requires review. Packing Labour remains separate.'
          else
              'The governed route intentionally contains no Manufacturing-Labour steps. Manufacturing Labour is validly zero and Packing Labour remains separate.'
      end
  where t.workload_status='BLOCKED_NO_POSITIVE_DIRECT_LABOUR_ROUTE_INTENSITY'
    and coalesce(t.direct_labour_route_intensity,0)=0
    and t.foundation_status not like 'BLOCKED%'
    and jsonb_typeof(t.labour_step_evidence)='array'
    and jsonb_array_length(t.labour_step_evidence)>0
    and not exists (
        select 1
        from jsonb_array_elements(t.labour_step_evidence) e
        where coalesce(e->>'direct_labour_scope','') <> 'EXCLUDE_OTHER_POOL'
    )
    and (
      not exists (
        select 1 from costing.production_route_family rf
        where rf.id=t.route_family_id and rf.family_code='OUTSOURCED_SOFT_GEL_JOB_WORK'
      )
      or exists (
        select 1 from tmp_packing_responsibility pr
        where pr.product_id=t.product_id
          and pr.responsibility_code='EXTERNAL_FULLY_PACKED'
          and pr.rule_id is not null
      )
    );

  -- AU-5 batch-true: manufacturing-labour workload on unrounded normal batch equivalents (route intensity x qty / batch_size_ref)
  v_bt := costing.fn_batch_true_effective(p_valuation_date);
  if v_bt then
    update tmp_dl_product t
       set direct_labour_workload_units = t.direct_labour_route_intensity * t.monthly_product_base_qty / br.preferred_batch_size
      from (select distinct on (b.product_id) b.product_id,b.preferred_batch_size
              from public.production_batch_size_ref b
             where b.effective_from<=p_valuation_date and (b.effective_to is null or b.effective_to>=p_valuation_date)
             order by b.product_id,b.effective_from desc,b.id desc) br
     where br.product_id=t.product_id and br.preferred_batch_size>0
       and coalesce(t.monthly_product_base_qty,0)>0 and coalesce(t.direct_labour_workload_units,0)>0;

    -- AU-6L: each labour step x equipment loads per batch; intensity re-stated, workload on unrounded batch equivalents.
    select m.approval_reference into v_rl from costing.fn_route_load_scaling_mode(p_valuation_date) m;
    if v_rl is not null then
      create temporary table tmp_dl_bs on commit drop as
      select distinct on (b.product_id) b.product_id,b.preferred_batch_size
        from public.production_batch_size_ref b
       where b.effective_from<=p_valuation_date and (b.effective_to is null or b.effective_to>=p_valuation_date)
       order by b.product_id,b.effective_from desc,b.id desc;

      if exists (select 1 from tmp_dl_product t
                 cross join lateral jsonb_array_elements(case when jsonb_typeof(t.labour_step_evidence)='array' then t.labour_step_evidence else '[]'::jsonb end) e
                 where coalesce(nullif(e->>'step_labour_factor','')::numeric,0) <> 0
                   and costing.fn_route_step_loads(e->>'resource_class_code', 1, 1, 'Kg', p_valuation_date) is null) then
        raise exception 'AU-6L: labour step resource class without an effective equipment capacity row (fail-closed)';
      end if;

      create temporary table tmp_dl_scale on commit drop as
      select t.product_id, t.product_base_uom, br.preferred_batch_size bs, ch.solid_kg, ch.output_qty, ch.output_uom, ch.charge_source,
             t.direct_labour_route_intensity raw_intensity,
             sum(nullif(e->>'step_labour_factor','')::numeric) f,
             sum(nullif(e->>'step_labour_factor','')::numeric
                 *costing.fn_route_step_loads(e->>'resource_class_code', ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)) fs,
             jsonb_agg(jsonb_build_object('seq',nullif(e->>'sequence_no','')::numeric,'rc',e->>'resource_class_code',
                       'loads',costing.fn_route_step_loads(e->>'resource_class_code', ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date))
                       order by nullif(e->>'sequence_no','')::numeric) step_detail
        from tmp_dl_product t
        join tmp_dl_bs br on br.product_id=t.product_id and br.preferred_batch_size>0
        cross join lateral costing.fn_route_batch_charge(t.product_id, br.preferred_batch_size, t.product_base_uom, p_valuation_date) ch
        cross join lateral jsonb_array_elements(case when jsonb_typeof(t.labour_step_evidence)='array' then t.labour_step_evidence else '[]'::jsonb end) e
       where coalesce(t.monthly_product_base_qty,0)>0 and coalesce(t.direct_labour_workload_units,0)>0
       group by t.product_id, t.product_base_uom, br.preferred_batch_size, ch.solid_kg, ch.output_qty, ch.output_uom, ch.charge_source, t.direct_labour_route_intensity;

      update tmp_dl_product t
         set direct_labour_route_intensity = t.direct_labour_route_intensity * s.fs / s.f,
             direct_labour_workload_units  = (t.direct_labour_route_intensity * s.fs / s.f) * t.monthly_product_base_qty / s.bs
        from tmp_dl_scale s
       where s.product_id=t.product_id and s.f > 0;
    end if;
  end if;

    -- AU-6: default-volume cap (default-driven workload <= policy pool_cap_share of eligible workload).
  update tmp_dl_product t
     set direct_labour_workload_units = c.new_workload
    from costing.fn_default_volume_cap(
           p_refresh_run_id, p_valuation_date, 'MANUFACTURING_LABOUR',
           (select jsonb_agg(jsonb_build_object('product_id',x.product_id,'workload',x.direct_labour_workload_units,'base_qty',x.monthly_product_base_qty))
              from tmp_dl_product x
             where x.is_eligible and x.direct_labour_workload_units > 0)) c
   where c.product_id = t.product_id;

  select count(*),count(*) filter(where is_eligible),count(*) filter(where workload_status like 'BLOCKED%'),
         sum(direct_labour_workload_units) filter(where is_eligible)
    into v_recipient_count,v_eligible_count,v_blocked_product_count,v_company_mfg_workload
  from tmp_dl_product;

  if coalesce(v_eligible_count,0)=0 or coalesce(v_company_mfg_workload,0)<=0 then
    raise exception 'Manufacturing Labour allocation has no eligible positive route workload for refresh run %',p_refresh_run_id;
  end if;

  select sum(b.monthly_allocation_units)
    into v_company_pack_units
  from costing.sku_sales_allocation_basis_snapshot b
  join tmp_packing_responsibility pr on pr.product_id=b.product_id
  cross join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) ar
  where b.period_start=v_period_start
    and b.valuation_date=p_valuation_date
    and b.refresh_run_id=p_refresh_run_id
    and b.monthly_allocation_units>0
    and pr.responsibility_code='SASV_INTERNAL_PACKING';

  if coalesce(v_company_pack_units,0)<=0 then
    raise exception 'Packing Labour allocation has no positive frozen monthly package units for SASV-packed recipient SKUs in refresh run %',p_refresh_run_id;
  end if;

  insert into costing.product_direct_labour_workload_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_id,product_name,product_base_uom,
    route_family_id,family_route_id,product_route_id,effective_route_source,monthly_product_base_qty,
    monthly_driver_status,standard_batch_count,direct_labour_route_intensity,direct_labour_workload_units,
    workload_status,workload_reason_code,workload_note,recipient_product_count,eligible_product_count,
    blocked_product_count,eligible_coverage_ratio,company_eligible_workload_units,direct_labour_pool_amount,
    product_workload_share,product_direct_labour_allocation,direct_labour_pool_snapshot_id,
    manufacturing_labour_component_pool_snapshot_id
  )
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,t.product_id,t.product_name,t.product_base_uom,
    t.route_family_id,t.family_route_id,t.product_route_id,t.effective_route_source,t.monthly_product_base_qty,
    t.monthly_driver_status,t.standard_batch_count,t.direct_labour_route_intensity,t.direct_labour_workload_units,
    t.workload_status,t.workload_status,
    case when t.workload_status='READY' then 'Manufacturing Labour workload is ready under the component-split Direct Labour policy.'
         when t.workload_status='READY_ZERO_MANUFACTURING_LABOUR' then 'Manufacturing Labour is validly zero because the governed route contains no Manufacturing-Labour steps; Packing Labour responsibility is resolved separately.'
         when t.workload_status='REVIEW_REQUIRED_FOUNDATION' then 'Manufacturing Labour workload is calculated but the governed quantity foundation requires review.'
         when t.workload_status='REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR' then 'Manufacturing Labour is validly zero under the governed route, while the quantity foundation requires review; Packing Labour responsibility is resolved separately.'
         else t.workload_note end,
    v_recipient_count,v_eligible_count,v_blocked_product_count,
    v_eligible_count::numeric/nullif(v_recipient_count,0),v_company_mfg_workload,v_mfg_pool,
    case when t.is_eligible then t.direct_labour_workload_units/v_company_mfg_workload else 0 end,
    case when t.is_eligible then v_mfg_pool*t.direct_labour_workload_units/v_company_mfg_workload else 0 end,
    (select id from costing.cost_pool_monthly_snapshot where refresh_run_id=p_refresh_run_id and allocation_pool='DIRECT_LABOUR'),
    v_mfg_component_id
  from tmp_dl_product t;

  if v_rl is not null then -- AU-6L lineage
    insert into costing.route_load_scaling_snapshot(period_start,valuation_date,refresh_run_id,allocation_pool,product_id,product_base_uom,preferred_batch_size,
      solid_charge_kg,output_charge,output_charge_uom,charge_source,raw_factor,scaled_factor,approval_reference,step_detail)
    select v_period_start,p_valuation_date,p_refresh_run_id,'MANUFACTURING_LABOUR',s.product_id,s.product_base_uom,s.bs,
           s.solid_kg,s.output_qty,s.output_uom,s.charge_source,s.raw_intensity,case when s.f>0 then s.raw_intensity*s.fs/s.f else s.raw_intensity end,v_rl,s.step_detail
      from tmp_dl_scale s;
  end if;

  insert into costing.product_direct_labour_step_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_workload_snapshot_id,product_id,
    sequence_no,effective_step_key,source_type,activity_id,cost_centre_id,direct_labour_scope,scope_factor,
    behaviour_code,attendance_factor,expected_occurrence_count,standard_cycle_count,step_labour_factor,resource_class_code
  )
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,pw.id,pw.product_id,
    nullif(e->>'sequence_no','')::numeric,e->>'effective_step_key',e->>'source_type',
    nullif(e->>'activity_id','')::bigint,nullif(e->>'cost_centre_id','')::bigint,e->>'direct_labour_scope',
    nullif(e->>'scope_factor','')::numeric,e->>'behaviour_code',nullif(e->>'attendance_factor','')::numeric,
    nullif(e->>'expected_occurrence_count','')::numeric,nullif(e->>'standard_cycle_count','')::numeric,
    nullif(e->>'step_labour_factor','')::numeric,e->>'resource_class_code'
  from costing.product_direct_labour_workload_snapshot pw
  join tmp_dl_product t on t.product_id=pw.product_id
  cross join lateral jsonb_array_elements(case when jsonb_typeof(t.labour_step_evidence)='array' then t.labour_step_evidence else '[]'::jsonb end)e
  where pw.refresh_run_id=p_refresh_run_id;

  insert into costing.sku_packing_labour_workload_snapshot(
    period_start,valuation_date,refresh_run_id,allocation_basis_snapshot_id,sku_id,product_id,product_name,
    pack_size,pack_uom,sku_base_qty_per_unit,monthly_sku_base_qty,expected_package_units,
    company_expected_package_units,package_workload_share,packing_labour_component_pool_snapshot_id,
    packing_labour_pool_amount,packing_labour_allocation,packing_labour_cost_per_sku_unit,
    packing_responsibility_rule_id,packing_responsibility_code,packing_responsibility_resolution_source,
    workload_status,workload_reason_code,workload_note,source_method,created_at
  )
  select
    b.period_start,b.valuation_date,b.refresh_run_id,b.id,b.sku_id,b.product_id,b.product_name,
    b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,b.monthly_allocation_base_qty,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' then 0 else b.monthly_allocation_units end,
    v_company_pack_units,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' then 0
         when b.monthly_allocation_units>0 then b.monthly_allocation_units/v_company_pack_units else 0 end,
    v_pack_component_id,v_pack_pool,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' then 0
         when b.monthly_allocation_units>0 then v_pack_pool*(b.monthly_allocation_units/v_company_pack_units) else 0 end,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' then 0
         when b.monthly_allocation_units>0 then v_pack_pool/v_company_pack_units else 0 end,
    pr.rule_id,pr.responsibility_code,pr.resolution_source,
    case
      when pr.responsibility_code='EXTERNAL_FULLY_PACKED' and pr.rule_id is not null then 'READY'
      when b.monthly_allocation_units is null or b.monthly_allocation_units<=0 then 'BLOCKED'
      when ar.effective_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
      else 'READY'
    end,
    case
      when pr.responsibility_code='EXTERNAL_FULLY_PACKED' and pr.rule_id is not null then 'READY_EXTERNAL_FULLY_PACKED'
      when b.monthly_allocation_units is null or b.monthly_allocation_units<=0 then 'BLOCKED_NO_POSITIVE_EXPECTED_PACKAGE_UNITS'
      when ar.effective_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_PACKING_QUANTITY_FOUNDATION'
      else 'READY'
    end,
    case
      when pr.responsibility_code='EXTERNAL_FULLY_PACKED' and pr.rule_id is not null then 'SASV Packing Labour is validly zero because the approved route-family responsibility rule governs this finished SKU as externally fully packed.'
      when b.monthly_allocation_units is null or b.monthly_allocation_units<=0 then 'Packing Labour cannot be allocated because frozen monthly package units are not positive.'
      when ar.effective_status='REVIEW_REQUIRED' then 'Packing Labour is calculable from frozen monthly package units, but the quantity foundation requires review.'
      else 'Packing Labour workload is ready from frozen exact-run monthly package units.'
    end,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' and pr.rule_id is not null
         then 'PACKING_LABOUR_RESPONSIBILITY_RULE.EXTERNAL_FULLY_PACKED'
         else 'SKU_SALES_ALLOCATION_BASIS_SNAPSHOT.MONTHLY_ALLOCATION_UNITS' end,
    clock_timestamp()
  from costing.sku_sales_allocation_basis_snapshot b
  join tmp_packing_responsibility pr on pr.product_id=b.product_id
  cross join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) ar
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  create temporary table tmp_dl_product_pack on commit drop as
  select product_id,sum(packing_labour_allocation) as product_packing_labour_allocation
  from costing.sku_packing_labour_workload_snapshot
  where refresh_run_id=p_refresh_run_id
  group by product_id;

  -- These exact-run snapshots are populated immediately before the large SKU join.
  -- Refresh planner statistics so the current run is not mis-estimated as a one-row slice,
  -- which otherwise causes catastrophic nested-loop rescans of the same run snapshots.
  execute 'analyze costing.sku_sales_allocation_basis_snapshot';
  execute 'analyze costing.product_direct_labour_workload_snapshot';
  execute 'analyze costing.sku_packing_labour_workload_snapshot';

  insert into costing.sku_direct_labour_allocation_snapshot(
    period_start,valuation_date,refresh_run_id,allocation_basis_snapshot_id,sku_id,product_id,product_name,
    product_base_uom,pack_size,pack_uom,sku_base_qty_per_unit,direct_labour_pool_amount,direct_labour_staff_count,
    sales_units_12m,sales_base_qty_12m,product_sales_units_12m,product_sales_base_qty_12m,company_sales_units_12m,
    product_allocation_share,resolved_sales_units,resolved_sales_base_qty,resolved_product_sales_units,
    resolved_product_sales_base_qty,resolved_company_sales_units,resolved_product_allocation_share,
    product_direct_labour_allocation,direct_labour_cost_per_base_uom,direct_labour_cost_per_sku,
    allocation_basis_status,allocation_basis_source,allocation_resolution_status,allocation_resolution_note,
    direct_labour_allocation_status,direct_labour_allocation_note,refreshed_at,policy_id,
    product_workload_snapshot_id,standard_batch_count,direct_labour_route_intensity,direct_labour_workload_units,
    product_workload_share,sku_within_product_share,allocation_reason_code,direct_labour_pool_snapshot_id,
    manufacturing_direct_labour_pool_amount,packing_labour_pool_amount,
    manufacturing_direct_labour_allocation,packing_labour_allocation,
    manufacturing_direct_labour_cost_per_sku,packing_labour_cost_per_sku,
    packing_labour_workload_snapshot_id,direct_labour_component_model_code
  )
  select
    b.period_start,b.valuation_date,b.refresh_run_id,b.id,b.sku_id,b.product_id,b.product_name,
    b.product_base_uom,b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,v_total_pool,coalesce(v_mfg_staff_count,0)+coalesce(v_pack_staff_count,0),
    b.actual_sales_units_12m,b.actual_sales_base_qty_12m,b.actual_product_sales_units_12m,
    b.actual_product_sales_base_qty_12m,b.actual_company_sales_units_12m,b.product_allocation_share,
    b.resolved_sales_units,b.resolved_sales_base_qty,b.resolved_product_sales_units,
    b.resolved_product_sales_base_qty,b.resolved_company_sales_units,b.resolved_product_allocation_share,
    pw.product_direct_labour_allocation+coalesce(pp.product_packing_labour_allocation,0),
    case when b.sku_base_qty_per_unit>0 then
      ((case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.monthly_product_base_qty>0
              then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/pw.monthly_product_base_qty) else 0 end)
        + coalesce(pk.packing_labour_allocation,0))/b.sku_base_qty_per_unit else 0 end,
    case when b.monthly_allocation_units>0 then
      ((case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.monthly_product_base_qty>0
              then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/pw.monthly_product_base_qty) else 0 end)
        + coalesce(pk.packing_labour_allocation,0))/b.monthly_allocation_units else 0 end,
    b.allocation_basis_status,'DIRECT_LABOUR_COMPONENT_SPLIT',b.allocation_resolution_status,b.allocation_resolution_note,
    case
      when pw.workload_status not in ('READY','REVIEW_REQUIRED_FOUNDATION','READY_ZERO_MANUFACTURING_LABOUR','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') or pk.workload_status='BLOCKED' then 'BLOCKED'
      when pw.workload_status in ('REVIEW_REQUIRED_FOUNDATION','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') or pk.workload_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
      else 'READY'
    end,
    case
      when pw.workload_status not in ('READY','REVIEW_REQUIRED_FOUNDATION','READY_ZERO_MANUFACTURING_LABOUR','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') then 'Direct Labour is blocked because the Manufacturing Labour component is blocked by Product route/foundation readiness. Packing Labour evidence is retained separately.'
      when pk.workload_status='BLOCKED' then 'Direct Labour is blocked because the Packing Labour quantity basis is blocked.'
      when pw.workload_status in ('REVIEW_REQUIRED_FOUNDATION','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') or pk.workload_status='REVIEW_REQUIRED' then 'Direct Labour is calculated from Manufacturing Labour plus Packing Labour, with one or more quantity foundations requiring review.'
      when pw.workload_status='READY_ZERO_MANUFACTURING_LABOUR' and pk.packing_responsibility_code='EXTERNAL_FULLY_PACKED' then 'Direct Labour is ready with valid zero SASV Manufacturing Labour and zero SASV Packing Labour under the approved externally fully-packed responsibility rule.'
      when pw.workload_status='READY_ZERO_MANUFACTURING_LABOUR' then 'Direct Labour is ready with a valid zero Manufacturing-Labour component plus the governed Packing-Labour component.'
      else 'Direct Labour is ready as Manufacturing Labour plus Packing Labour under the approved component-split policy.'
    end,
    clock_timestamp(),v_policy.id,pw.id,pw.standard_batch_count,pw.direct_labour_route_intensity,
    pw.direct_labour_workload_units,pw.product_workload_share,
    case when pw.monthly_product_base_qty>0 then b.monthly_allocation_base_qty/pw.monthly_product_base_qty end,
    case
      when pw.workload_status not in ('READY','REVIEW_REQUIRED_FOUNDATION','READY_ZERO_MANUFACTURING_LABOUR','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') then pw.workload_status
      when pk.workload_status='BLOCKED' then pk.workload_reason_code
      when pw.workload_status in ('REVIEW_REQUIRED_FOUNDATION','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') or pk.workload_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_DIRECT_LABOUR_COMPONENT_FOUNDATION'
      when pw.workload_status='READY_ZERO_MANUFACTURING_LABOUR' and pk.packing_responsibility_code='EXTERNAL_FULLY_PACKED' then 'READY_ZERO_SASV_MANUFACTURING_AND_PACKING_LABOUR'
      when pw.workload_status='READY_ZERO_MANUFACTURING_LABOUR' then 'READY_ZERO_MANUFACTURING_LABOUR_PACKING_ONLY'
      else 'READY'
    end,
    pw.direct_labour_pool_snapshot_id,
    v_mfg_pool,v_pack_pool,
    case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.monthly_product_base_qty>0
         then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/pw.monthly_product_base_qty) else 0 end,
    coalesce(pk.packing_labour_allocation,0),
    case when b.monthly_allocation_units>0 then
      (case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.monthly_product_base_qty>0
            then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/pw.monthly_product_base_qty) else 0 end)/b.monthly_allocation_units else 0 end,
    coalesce(pk.packing_labour_cost_per_sku_unit,0),
    pk.id,'MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS'
  from costing.sku_sales_allocation_basis_snapshot b
  join costing.product_direct_labour_workload_snapshot pw
    on pw.refresh_run_id=b.refresh_run_id and pw.product_id=b.product_id
  join costing.sku_packing_labour_workload_snapshot pk
    on pk.refresh_run_id=b.refresh_run_id and pk.sku_id=b.sku_id
  left join tmp_dl_product_pack pp on pp.product_id=b.product_id
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  if abs((select coalesce(sum(product_direct_labour_allocation),0) from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id)-v_mfg_pool)>0.000001 then
    raise exception 'Manufacturing Labour Product allocation does not reconcile to component pool for run %',p_refresh_run_id;
  end if;
  if abs((select coalesce(sum(packing_labour_allocation),0) from costing.sku_packing_labour_workload_snapshot where refresh_run_id=p_refresh_run_id)-v_pack_pool)>0.000001 then
    raise exception 'Packing Labour allocation does not reconcile to component pool for run %',p_refresh_run_id;
  end if;

  if v_bt then
    insert into costing.batch_true_absorption_variance(refresh_run_id,allocation_pool,pool_amount,absorbed_at_standard,variance_amount,products_batch_true,products_current_method,rate_used,rate_basis)
    select p_refresh_run_id,'MANUFACTURING_LABOUR',v_mfg_pool,sum(product_direct_labour_allocation),v_mfg_pool-sum(product_direct_labour_allocation),v_eligible_count,v_recipient_count-v_eligible_count,v_mfg_pool/nullif(v_company_mfg_workload,0),'NORMAL_VOLUME_RATE'
      from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id
    on conflict (refresh_run_id,allocation_pool) do nothing;
  end if;

  return query
  select v_period_start,count(*)::bigint,
    count(*) filter(where s.direct_labour_allocation_status='BLOCKED')::bigint,
    count(*) filter(where s.direct_labour_allocation_status='REVIEW_REQUIRED')::bigint,
    count(*) filter(where s.direct_labour_allocation_status='READY')::bigint
  from costing.sku_direct_labour_allocation_snapshot s
  where s.refresh_run_id=p_refresh_run_id;
end;
$function$
;
revoke all on function costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint) from public, anon, authenticated;
CREATE OR REPLACE FUNCTION costing.rpc_refresh_production_overhead_workload_snapshot(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
  v_period_start date:=date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_policy costing.production_overhead_workload_policy%rowtype;
  v_pool_snapshot_id bigint;
  v_pool numeric;
  v_foundation jsonb;
  v_recipient_count integer;
  v_eligible_count integer;
  v_blocked_count integer;
  v_coverage numeric;
  v_company_workload numeric;
  v_allocated_pool numeric;
  v_bt boolean;
  v_rl text;          -- AU-6L equipment-loads approval (null = off)
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'period_start, valuation_date and refresh_run_id are required';
  end if;

  select * into v_run
  from costing.costing_refresh_run
  where id=p_refresh_run_id;

  if not found then
    raise exception 'Costing refresh run % not found',p_refresh_run_id;
  end if;

  if v_run.period_start is distinct from v_period_start
     or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Production Overhead snapshot context does not match refresh run %',p_refresh_run_id;
  end if;

  if not (
      v_run.overall_status='SUCCESS'
      or (
        v_run.overall_status='RUNNING'
        and v_run.current_stage_code='03_COST_BUILD_TO_SCHEME'
        and exists (
          select 1
          from costing.costing_refresh_run_stage s
          where s.refresh_run_id=p_refresh_run_id
            and s.stage_code='03_COST_BUILD_TO_SCHEME'
            and s.stage_status='RUNNING'
        )
      )
  ) then
    raise exception 'Production Overhead snapshots require governed Stage 03 RUNNING context or an already-successful exact run';
  end if;

  if exists(select 1 from costing.product_production_overhead_workload_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.product_production_overhead_step_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_production_overhead_allocation_snapshot where refresh_run_id=p_refresh_run_id) then
    raise exception 'Production Overhead snapshots already exist for refresh run % and are immutable',p_refresh_run_id;
  end if;

  select * into v_policy
  from costing.fn_resolve_production_overhead_workload_policy(p_valuation_date);

  if v_policy.id is null then
    raise exception 'No uniquely resolvable approved Production Overhead policy exists for valuation date %',p_valuation_date;
  end if;

  v_bt := costing.fn_batch_true_effective(p_valuation_date); -- AU-5
  select m.approval_reference into v_rl from costing.fn_route_load_scaling_mode(p_valuation_date) m; -- AU-6L

  select p.id,p.total_pool_amount
  into v_pool_snapshot_id,v_pool
  from costing.cost_pool_monthly_snapshot p
  where p.period_start=v_period_start
    and p.valuation_date=p_valuation_date
    and p.refresh_run_id=p_refresh_run_id
    and p.allocation_pool='PRODUCTION_OVERHEAD';

  if v_pool_snapshot_id is null or v_pool is null then
    raise exception 'Production Overhead frozen pool is missing for exact run %',p_refresh_run_id;
  end if;

  -- Reuse the canonical shared exact-run route/batch foundation rather than
  -- resolving and validating Product routes repeatedly inside POH.
  v_foundation := costing.fn_preview_shared_standard_batch_route_foundation(
    v_period_start,p_valuation_date,p_refresh_run_id,null
  );

  create temporary table tmp_po_foundation on commit drop as
  select *
  from jsonb_to_recordset(coalesce(v_foundation->'rows','[]'::jsonb)) as f(
    product_id bigint,
    product_name text,
    product_base_uom text,
    recipient_sku_count integer,
    monthly_product_base_qty numeric,
    monthly_driver_status text,
    actual_source_sku_count integer,
    assumption_source_sku_count integer,
    default_source_sku_count integer,
    sku_quantity_evidence jsonb,
    batch_size_ref_id bigint,
    preferred_batch_size numeric,
    min_batch_size numeric,
    max_batch_size numeric,
    batch_size_effective_from date,
    raw_batch_requirement numeric,
    standard_batch_count bigint,
    route_family_id bigint,
    family_route_id bigint,
    product_route_id bigint,
    effective_route_source text,
    route_validation jsonb,
    effective_step_count integer,
    direct_labour_include_step_count integer,
    direct_labour_supervision_step_count integer,
    direct_labour_excluded_step_count integer,
    production_overhead_include_step_count integer,
    production_overhead_passive_step_count integer,
    production_overhead_excluded_step_count integer,
    step_evidence jsonb,
    foundation_status text,
    foundation_note text
  );

  -- AU-6L: batch charge per product from batch_size_ref (+ RM BOM / unit-mass override).
  create temporary table tmp_po_charge on commit drop as
  select f.product_id, c.solid_kg, c.output_qty, c.output_uom, c.charge_source
    from tmp_po_foundation f
    cross join lateral costing.fn_route_batch_charge(f.product_id, f.preferred_batch_size, f.product_base_uom, p_valuation_date) c
   where v_rl is not null and f.preferred_batch_size > 0;

  if v_rl is not null and exists (
       select 1 from tmp_po_foundation f
       cross join lateral jsonb_to_recordset(case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end)
         as e(resource_class_code text, expected_occurrence_count numeric, standard_cycle_count numeric)
       where coalesce(e.expected_occurrence_count,0)*coalesce(e.standard_cycle_count,0) <> 0
         and costing.fn_route_step_loads(e.resource_class_code, 1, 1, 'Kg', p_valuation_date) is null) then
    raise exception 'AU-6L: route step resource class without an effective equipment capacity row (fail-closed)';
  end if;

  create temporary table tmp_po_product on commit drop as
  with sf as (
    select f.product_id,
           count(*)::integer effective_step_count,
           count(*) filter(where e.production_overhead_scope='INCLUDE')::integer included_step_count,
           count(*) filter(where e.production_overhead_scope='PASSIVE')::integer passive_step_count,
           count(*) filter(where e.production_overhead_scope='EXCLUDE_OTHER_POOL')::integer excluded_step_count,
           sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count) raw_route_factor,
           case when v_rl is null or ch.product_id is null then sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count)
                else sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count
                         *costing.fn_route_step_loads(e.resource_class_code, ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)) end route_factor -- AU-6L
    from tmp_po_foundation f
    cross join lateral jsonb_to_recordset(
      case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end
    ) as e(
      effective_step_key text,
      sequence_no numeric,
      activity_id integer,
      cost_centre_id bigint,
      behaviour_code text,
      resource_class_code text,
      expected_occurrence_count numeric,
      standard_cycle_count numeric,
      direct_labour_scope text,
      production_overhead_scope text,
      source_type text,
      base_step_id bigint,
      override_id bigint
    )
    left join costing.production_overhead_scope_factor sc
      on sc.policy_id=v_policy.id and sc.scope_code=e.production_overhead_scope
    left join costing.production_overhead_behaviour_factor bh
      on bh.policy_id=v_policy.id and bh.behaviour_code=e.behaviour_code
    left join costing.production_overhead_resource_factor rs
      on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
    left join tmp_po_charge ch on ch.product_id=f.product_id
    group by f.product_id, ch.product_id
  )
  select
    f.product_id,
    f.product_name,
    f.product_base_uom,
    f.monthly_product_base_qty,
    f.monthly_driver_status,
    f.route_family_id,
    f.family_route_id,
    f.product_route_id,
    f.effective_route_source,
    f.batch_size_ref_id,
    f.preferred_batch_size,
    sf.effective_step_count,
    sf.included_step_count,
    sf.passive_step_count,
    sf.excluded_step_count,
    sf.route_factor,
    sf.raw_route_factor,
    case when f.preferred_batch_size>0 then f.monthly_product_base_qty/f.preferred_batch_size end monthly_batch_equivalents,
    case when f.preferred_batch_size>0 and f.monthly_product_base_qty>0
         then ceil(f.monthly_product_base_qty/f.preferred_batch_size)::integer end rounded_batch_count,
    case when f.preferred_batch_size>0 and f.monthly_product_base_qty>0 and sf.route_factor is not null
         then (case when v_bt then f.monthly_product_base_qty/f.preferred_batch_size else ceil(f.monthly_product_base_qty/f.preferred_batch_size) end)*sf.route_factor end workload_units, -- AU-5: batch-equivalent (unrounded) when batch-true effective
    case
      when f.family_route_id is null then 'BLOCKED_NO_APPROVED_EFFECTIVE_ROUTE'
      when (sf.route_factor is null or sf.route_factor<=0)
           and f.foundation_status not like 'BLOCKED%'
           and coalesce(sf.effective_step_count,0)>0
           and coalesce(sf.included_step_count,0)=0
           and coalesce(sf.passive_step_count,0)=0
           and coalesce(sf.excluded_step_count,0)=coalesce(sf.effective_step_count,0)
        then 'READY_ZERO_PRODUCTION_OVERHEAD'
      when sf.route_factor is null or sf.route_factor<=0 then 'BLOCKED_NO_POSITIVE_ROUTE_FACTOR'
      when f.batch_size_ref_id is null or f.preferred_batch_size<=0 then 'BLOCKED_NO_ACTIVE_BATCH_SIZE'
      when f.monthly_product_base_qty is null or f.monthly_product_base_qty<=0 then 'BLOCKED_NO_MONTHLY_PRODUCT_BASE_QTY'
      when f.monthly_driver_status='BLOCKED' then 'BLOCKED_MONTHLY_DRIVER'
      when f.monthly_driver_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_MONTHLY_DRIVER'
      else 'READY'
    end workload_status
  from tmp_po_foundation f
  left join sf on sf.product_id=f.product_id;

    -- AU-6: default-volume cap (default-driven workload <= policy pool_cap_share of eligible workload).
  update tmp_po_product t
     set workload_units = c.new_workload
    from costing.fn_default_volume_cap(
           p_refresh_run_id, p_valuation_date, 'PRODUCTION_OVERHEAD',
           (select jsonb_agg(jsonb_build_object('product_id',x.product_id,'workload',x.workload_units,'base_qty',x.monthly_product_base_qty))
              from tmp_po_product x
             where x.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD')
               and x.workload_units > 0)) c
   where c.product_id = t.product_id;

  select count(*),
         count(*) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD')),
         count(*) filter(where workload_status like 'BLOCKED%'),
         count(*) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD'))::numeric/nullif(count(*),0),
         sum(workload_units) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD'))
  into v_recipient_count,v_eligible_count,v_blocked_count,v_coverage,v_company_workload
  from tmp_po_product;

  if coalesce(v_eligible_count,0)=0 or coalesce(v_company_workload,0)<=0 then
    raise exception 'Production Overhead allocation requires at least one eligible Product with positive workload';
  end if;

  insert into costing.product_production_overhead_workload_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,pool_snapshot_id,product_id,product_name,product_base_uom,
    route_family_id,family_route_id,product_route_id,effective_route_source,batch_size_ref_id,preferred_batch_size,
    monthly_product_base_qty,monthly_driver_status,monthly_batch_equivalents,rounded_batch_count,effective_step_count,included_step_count,
    passive_step_count,excluded_step_count,route_factor,workload_units,workload_status,workload_reason_code,workload_note,
    recipient_product_count,ready_product_count,blocked_product_count,workload_coverage_ratio,company_ready_workload_units)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,v_pool_snapshot_id,t.product_id,t.product_name,t.product_base_uom,
         t.route_family_id,t.family_route_id,t.product_route_id,t.effective_route_source,t.batch_size_ref_id,t.preferred_batch_size,
         t.monthly_product_base_qty,t.monthly_driver_status,t.monthly_batch_equivalents,t.rounded_batch_count,coalesce(t.effective_step_count,0),
         coalesce(t.included_step_count,0),coalesce(t.passive_step_count,0),coalesce(t.excluded_step_count,0),t.route_factor,t.workload_units,
         t.workload_status,t.workload_status,
         case when t.workload_status='READY_ZERO_PRODUCTION_OVERHEAD' then 'The governed route contains effective steps, all explicitly excluded from Production Overhead. Production Overhead is validly zero and non-blocking.'
              when t.workload_status='READY' then 'Production Overhead workload is eligible and ready for the exact-run pool allocation.'
              when t.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'Production Overhead workload is eligible using a governed monthly quantity requiring review.'
              else 'Production Overhead workload is individually blocked with zero allocation: '||t.workload_status end,
         v_recipient_count,v_eligible_count,v_blocked_count,v_coverage,v_company_workload
  from tmp_po_product t;

  -- Step lineage comes from the same once-resolved shared foundation.
  insert into costing.product_production_overhead_step_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_workload_snapshot_id,product_id,sequence_no,effective_step_key,
    source_type,base_step_id,override_id,production_overhead_scope,scope_factor,behaviour_code,behaviour_factor,
    resource_class_code,resource_factor,expected_occurrence_count,standard_cycle_count,step_factor)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,s.id,s.product_id,e.sequence_no,e.effective_step_key,
         e.source_type,e.base_step_id,e.override_id,e.production_overhead_scope,sc.factor,e.behaviour_code,bh.factor,
         e.resource_class_code,rs.factor,e.expected_occurrence_count,e.standard_cycle_count,
         sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count
  from costing.product_production_overhead_workload_snapshot s
  join tmp_po_foundation f on f.product_id=s.product_id
  cross join lateral jsonb_to_recordset(
    case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end
  ) as e(
    effective_step_key text,
    sequence_no numeric,
    activity_id integer,
    cost_centre_id bigint,
    behaviour_code text,
    resource_class_code text,
    expected_occurrence_count numeric,
    standard_cycle_count numeric,
    direct_labour_scope text,
    production_overhead_scope text,
    source_type text,
    base_step_id bigint,
    override_id bigint
  )
  join costing.production_overhead_scope_factor sc
    on sc.policy_id=v_policy.id and sc.scope_code=e.production_overhead_scope
  join costing.production_overhead_behaviour_factor bh
    on bh.policy_id=v_policy.id and bh.behaviour_code=e.behaviour_code
  join costing.production_overhead_resource_factor rs
    on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
  where s.refresh_run_id=p_refresh_run_id and s.family_route_id is not null;

  -- AU-6L lineage (only when loads are effective).
  if v_rl is not null then
    insert into costing.route_load_scaling_snapshot(period_start,valuation_date,refresh_run_id,allocation_pool,product_id,product_base_uom,preferred_batch_size,
      solid_charge_kg,output_charge,output_charge_uom,charge_source,raw_factor,scaled_factor,approval_reference,step_detail)
    select v_period_start,p_valuation_date,p_refresh_run_id,'PRODUCTION_OVERHEAD',t.product_id,t.product_base_uom,t.preferred_batch_size,
           ch.solid_kg,ch.output_qty,ch.output_uom,ch.charge_source,t.raw_route_factor,t.route_factor,v_rl,
           (select jsonb_agg(jsonb_build_object('seq',e.sequence_no,'rc',e.resource_class_code,
                     'loads',costing.fn_route_step_loads(e.resource_class_code, ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)) order by e.sequence_no)
              from tmp_po_foundation f
              cross join lateral jsonb_to_recordset(case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end)
                as e(sequence_no numeric, resource_class_code text)
             where f.product_id=t.product_id)
      from tmp_po_product t
      join tmp_po_charge ch on ch.product_id=t.product_id
     where t.raw_route_factor is not null;

    -- Manufacturing Labour (written earlier in the chain) must have used the same batch charge per product.
    if exists (select 1 from costing.route_load_scaling_snapshot d
                join costing.route_load_scaling_snapshot p on p.refresh_run_id=d.refresh_run_id and p.product_id=d.product_id
               where d.refresh_run_id=p_refresh_run_id and d.allocation_pool='MANUFACTURING_LABOUR' and p.allocation_pool='PRODUCTION_OVERHEAD'
                 and (d.preferred_batch_size is distinct from p.preferred_batch_size or d.solid_charge_kg is distinct from p.solid_charge_kg
                      or d.output_charge is distinct from p.output_charge)) then
      raise exception 'AU-6L: Manufacturing Labour and Production Overhead used different batch charges in run %',p_refresh_run_id;
    end if;
  end if;

  insert into costing.sku_production_overhead_allocation_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,pool_snapshot_id,product_workload_snapshot_id,sku_id,product_id,product_name,
    pack_size,pack_uom,sku_base_qty_per_unit,monthly_sku_base_qty,monthly_product_base_qty,sku_within_product_share,
    production_overhead_pool_amount,product_workload_share,product_production_overhead_allocation,
    production_overhead_cost_per_base_uom,production_overhead_cost_per_sku,allocation_status,allocation_reason_code,allocation_note)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,v_pool_snapshot_id,pw.id,b.sku_id,b.product_id,b.product_name,
         b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,b.monthly_allocation_base_qty,pw.monthly_product_base_qty,
         case when pw.monthly_product_base_qty>0 then b.monthly_allocation_base_qty/pw.monthly_product_base_qty end,
         v_pool,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD') then pw.workload_units/v_company_workload else 0 end,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD') then v_pool*pw.workload_units/v_company_workload else 0 end,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD') and pw.monthly_product_base_qty>0
              then (v_pool*pw.workload_units/v_company_workload)/pw.monthly_product_base_qty end,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD') and pw.monthly_product_base_qty>0
              then ((v_pool*pw.workload_units/v_company_workload)/pw.monthly_product_base_qty)*b.sku_base_qty_per_unit end,
         case when pw.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'REVIEW_REQUIRED'
              when pw.workload_status in ('READY','READY_ZERO_PRODUCTION_OVERHEAD') then 'READY' else 'BLOCKED' end,
         pw.workload_status,
         case when pw.workload_status='READY_ZERO_PRODUCTION_OVERHEAD' then 'The governed route is explicitly outside the Production Overhead pool; this SKU receives valid zero Production Overhead while the full pool remains allocated across positive-workload eligible Products.'
              when pw.workload_status='READY' then 'Full Production Overhead pool is allocated across Products eligible in this exact run.'
              when pw.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'Full Production Overhead pool is allocated across current eligible Products; this Product uses a monthly quantity requiring review.'
              else 'Product is individually blocked and receives zero Production Overhead in this exact run. A later governed run may redistribute the pool after the blocker is resolved.' end
  from costing.sku_sales_allocation_basis_snapshot b
  join costing.product_production_overhead_workload_snapshot pw
    on pw.refresh_run_id=b.refresh_run_id and pw.product_id=b.product_id
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  select coalesce(sum(x.product_allocation),0)
    + coalesce((select sum(v_pool*w.workload_units/nullif(w.company_ready_workload_units,0))
                from costing.product_production_overhead_workload_snapshot w
                where w.refresh_run_id=p_refresh_run_id
                  and w.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD')
                  and not exists (select 1 from costing.sku_sales_allocation_basis_snapshot b where b.refresh_run_id=p_refresh_run_id and b.product_id=w.product_id)),0)
    into v_allocated_pool
    from (
      select product_id,max(product_production_overhead_allocation) product_allocation
      from costing.sku_production_overhead_allocation_snapshot
      where refresh_run_id=p_refresh_run_id
      group by product_id
    ) x;

  if abs(coalesce(v_pool,0)-coalesce(v_allocated_pool,0)) > 0.000001 then
    raise exception 'Production Overhead exact-run allocation does not reconcile to frozen pool for refresh run %: pool %, allocated %',
      p_refresh_run_id,v_pool,v_allocated_pool;
  end if;

  if exists (
    select 1
    from costing.sku_production_overhead_allocation_snapshot s
    where s.refresh_run_id=p_refresh_run_id
      and (s.pool_snapshot_id is distinct from v_pool_snapshot_id
           or s.production_overhead_pool_amount is distinct from v_pool)
  ) then
    raise exception 'Production Overhead SKU snapshot pool lineage mismatch for refresh run %',p_refresh_run_id;
  end if;

  if v_bt then
    insert into costing.batch_true_absorption_variance(refresh_run_id,allocation_pool,pool_amount,absorbed_at_standard,variance_amount,products_batch_true,products_current_method,rate_used,rate_basis)
    values(p_refresh_run_id,'PRODUCTION_OVERHEAD',v_pool,v_allocated_pool,v_pool-v_allocated_pool,v_eligible_count,v_recipient_count-v_eligible_count,v_pool/nullif(v_company_workload,0),'NORMAL_VOLUME_RATE')
    on conflict (refresh_run_id,allocation_pool) do nothing;
  end if;

  return jsonb_build_object(
    'period_start',v_period_start,'batch_true',v_bt,'route_load_scaling',v_rl,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,'policy_id',v_policy.id,
    'pool_snapshot_id',v_pool_snapshot_id,
    'allocation_mode','FULL_POOL_TO_CURRENT_ELIGIBLE_PRODUCTS','recipient_product_count',v_recipient_count,
    'eligible_product_count',v_eligible_count,'blocked_product_count',v_blocked_count,'eligible_coverage_ratio',v_coverage,
    'company_eligible_workload_units',v_company_workload,'pool_amount',v_pool,'allocated_pool_amount',v_allocated_pool,
    'unallocated_pool_amount',v_pool-v_allocated_pool,'monetary_allocation_enabled',true,
    'product_snapshot_count',(select count(*) from costing.product_production_overhead_workload_snapshot where refresh_run_id=p_refresh_run_id),
    'step_snapshot_count',(select count(*) from costing.product_production_overhead_step_snapshot where refresh_run_id=p_refresh_run_id),
    'sku_snapshot_count',(select count(*) from costing.sku_production_overhead_allocation_snapshot where refresh_run_id=p_refresh_run_id)
  );
end;
$function$
;
revoke all on function costing.rpc_refresh_production_overhead_workload_snapshot(date,date,bigint) from public, anon, authenticated;
insert into costing.route_load_scaling_switch(id,is_enabled,effective_from,approval_reference,changed_by,note)
values (true,true,date '2026-10-01','USER-APPROVAL-20261018-AU6-V2','dff17104-c02a-4bca-95b1-e8ddff46a9b6','AU-6L equipment-loads route workload from Oct 2026')
on conflict (id) do nothing;

do $c$ begin
  if (select count(*) from costing.fn_route_load_scaling_mode(date '2026-09-10')) <> 0 then raise exception 'AU-6L gate open for Sep valuation'; end if;
  if exists (select r.code from costing.production_resource_class r
              where r.is_active and costing.fn_route_step_loads(r.code, 1, 1, 'Kg', date '2026-10-16') is null
                and r.code <> 'PACKING_MACHINE'  -- live 2026-10-18: 4 family packing steps (section 6), 0 rows in run-126 DL/POH step snapshots; writers still fail closed if one appears
                and exists (select 1 from costing.production_route_family_route_step s where s.resource_class_code = r.code)) then
    raise exception 'AU-6L: a resource class used by route steps has no capacity row'; end if;
end $c$;

-- ============================== D. SALES-01 costing-only sales feed ==============================
-- Costing basis only (public.v_sales_monthly_clean / fn_sales_monthly_clean_as_of stay untouched for forecasting):
--   company-wide monthly net qty_units per SKU (all godowns), negative months set to 0, no per-godown IQR filter;
--   monthly driver = max positive company-wide month, EXCEPT seasonal SKUs (top-3 months >= threshold of the 12-month volume)
--   which use the 12-month average monthly volume (user decision 2026-10-18). Own switch, period >= 2026-10-01 (Sep run 122 never).
create table if not exists costing.costing_sales_feed_switch(
  id boolean primary key default true check (id),
  is_enabled boolean not null default false,
  effective_from date not null default date '2026-10-01'
    check (effective_from >= date '2026-10-01' and effective_from = date_trunc('month', effective_from)::date),
  seasonal_top3_share_threshold numeric not null default 0.60 check (seasonal_top3_share_threshold > 0.25 and seasonal_top3_share_threshold <= 1),
  approval_reference text, changed_by text, changed_at timestamptz default now(), note text);
revoke all on costing.costing_sales_feed_switch from anon, authenticated;
grant select on costing.costing_sales_feed_switch to authenticated;

create or replace function costing.fn_costing_sales_feed_mode(p_period_start date)
returns table(approval_reference text, seasonal_top3_share_threshold numeric)
language sql stable security definer set search_path to 'costing','pg_temp' as $$
  select coalesce(s.approval_reference,'(none)'), s.seasonal_top3_share_threshold from costing.costing_sales_feed_switch s
   where s.is_enabled and p_period_start >= s.effective_from
$$;
revoke all on function costing.fn_costing_sales_feed_mode(date) from public, anon, authenticated;

-- Same signature as public.fn_sales_monthly_clean_as_of; one company-wide row per SKU-month (region/godown null).
create or replace function costing.fn_costing_sales_monthly_as_of(p_as_of_date date)
returns table(sku_id integer, product_id bigint, region_id integer, godown_id integer, month_start date, qty_clean numeric)
language sql stable security definer set search_path to 'public','pg_temp' as $$
  select m.sku_id, m.product_id, null::integer, null::integer, m.month_start,
         greatest(coalesce(sum(m.qty_units), 0), 0)::numeric
    from public.sales_monthly m
   where p_as_of_date is not null
     and m.month_start >= (date_trunc('month', p_as_of_date) - interval '12 months')::date
     and m.month_start <  date_trunc('month', p_as_of_date)::date
   group by m.sku_id, m.product_id, m.month_start
$$;
revoke all on function costing.fn_costing_sales_monthly_as_of(date) from public, anon, authenticated;

-- Allowed monthly-driver methods: superset (existing rows unaffected).
alter table costing.sku_sales_allocation_basis_snapshot drop constraint if exists sku_sales_allocation_basis_monthly_method_chk;
alter table costing.sku_sales_allocation_basis_snapshot add constraint sku_sales_allocation_basis_monthly_method_chk
  check (monthly_driver_method is null or monthly_driver_method = any (array[
    'MAX_POSITIVE_COMPANY_WIDE_CLEANED_SKU_MONTH_IN_12M_LOOKBACK','MAX_POSITIVE_COMPANY_WIDE_NET_SKU_MONTH_IN_12M_LOOKBACK',
    'SEASONAL_12M_AVERAGE_COMPANY_WIDE_NET_SKU_MONTH','GOVERNED_SKU_ASSUMPTION','GOVERNED_NEW_PRODUCT_PLAN','GOVERNED_SCENARIO_DEFAULT','UNRESOLVED']));
comment on table costing.costing_sales_feed_switch is 'SALES-01: costing-only sales feed (company-wide net units, negatives 0, no per-godown IQR) + seasonal 12-month-average driver. Off or period < effective_from = pre-SALES-01 behaviour.';

CREATE OR REPLACE FUNCTION costing.rpc_refresh_sku_sales_allocation_basis_snapshot(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 RETURNS TABLE(refreshed_period_start date, inserted_row_count bigint, blocked_count bigint, review_required_count bigint, ready_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
    v_period_start date :=
        date_trunc(
            'month',
            p_period_start
        )::date;

    v_driver_lookback_start date;
    v_driver_lookback_end date;

    v_run costing.costing_refresh_run%rowtype;

    -- SALES-01 costing-only sales feed (null = off).
    v_sf_appr text;
    v_sf_thr numeric;
    v_sf boolean;
begin
    if p_period_start is null then
        raise exception
            'Costing period is required.';
    end if;

    if p_valuation_date is null then
        raise exception
            'Valuation date is required.';
    end if;

    if p_refresh_run_id is null then
        raise exception
            'Refresh run ID is required.';
    end if;

    select *
    into v_run
    from costing.costing_refresh_run r
    where r.id = p_refresh_run_id;

    if not found then
        raise exception
            'Costing refresh run % does not exist.',
            p_refresh_run_id;
    end if;

    if v_run.period_start
       is distinct from v_period_start then
        raise exception
            'Allocation period % does not match refresh run % period %.',
            v_period_start,
            p_refresh_run_id,
            v_run.period_start;
    end if;

    if v_run.valuation_date
       is distinct from p_valuation_date then
        raise exception
            'Allocation valuation date % does not match refresh run % valuation date %.',
            p_valuation_date,
            p_refresh_run_id,
            v_run.valuation_date;
    end if;

    if v_run.valuation_context_source
       is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception
            'Refresh run % is not based on captured-at-request valuation context.',
            p_refresh_run_id;
    end if;

    if p_valuation_date < v_period_start
       or p_valuation_date >=
          (
              v_period_start
              + interval '1 month'
          )::date then
        raise exception
            'Valuation date % is outside costing period %.',
            p_valuation_date,
            v_period_start;
    end if;

    v_driver_lookback_start :=
        (
            v_period_start
            - interval '12 months'
        )::date;

    v_driver_lookback_end :=
        v_period_start;

    select m.approval_reference, m.seasonal_top3_share_threshold
      into v_sf_appr, v_sf_thr
      from costing.fn_costing_sales_feed_mode(v_period_start) m;
    v_sf := v_sf_thr is not null;

    perform *
    from costing.rpc_ensure_cost_period(
        v_period_start
    );

    -- Exact-run replacement only.
    delete
    from costing.sku_sales_allocation_basis_snapshot s
    where s.refresh_run_id = p_refresh_run_id;

    insert into costing.sku_sales_allocation_basis_snapshot (
        period_start,
        valuation_date,
        refresh_run_id,

        sku_id,
        product_id,
        product_name,

        product_base_uom,
        conversion_to_base,
        pack_size,
        pack_uom,
        sku_base_qty_per_unit,

        -- Historical annual evidence: meanings retained.
        sales_units_12m,
        sales_base_qty_12m,
        product_sales_units_12m,
        product_sales_base_qty_12m,
        company_sales_units_12m,
        product_allocation_share,

        actual_sales_units_12m,
        actual_sales_base_qty_12m,
        actual_product_sales_units_12m,
        actual_product_sales_base_qty_12m,
        actual_company_sales_units_12m,

        -- Existing downstream compatibility projection.
        resolved_sales_units,
        resolved_sales_base_qty,
        resolved_product_sales_units,
        resolved_product_sales_base_qty,
        resolved_company_sales_units,
        resolved_product_allocation_share,

        allocation_basis_status,
        allocation_basis_source,
        allocation_resolution_status,
        allocation_resolution_note,

        assumption_id,
        assumption_basis,
        assumption_effective_from,
        assumption_effective_to,

        default_policy_id,
        default_policy_scenario,
        default_policy_effective_from,
        default_policy_effective_to,

        lookback_start,
        lookback_end,

        -- Explicit monthly-driver contract.
        monthly_allocation_units,
        monthly_allocation_base_qty,
        monthly_product_allocation_units,
        monthly_product_allocation_base_qty,
        monthly_company_allocation_units,
        monthly_product_allocation_share,

        monthly_driver_method,
        monthly_driver_source,
        monthly_driver_source_month,
        monthly_driver_lookback_start,
        monthly_driver_lookback_end,
        monthly_driver_tied_month_count,
        monthly_driver_status,
                monthly_driver_note,
        monthly_driver_plan_id,
        refreshed_at
    )

    with
    -- Reuse the established active costing universe and diagnostic
    -- classification from the existing governed allocation-basis view.
    basis_universe as materialized (
        select
            b.period_start,
            b.sku_id,
            b.product_id,
            b.product_name,

            b.product_base_uom,
            b.conversion_to_base,
            b.pack_size,
            b.pack_uom,
            b.sku_base_qty_per_unit,

            b.allocation_basis_status

        from costing.v_sku_sales_volume_allocation_basis b

        where b.period_start = v_period_start
    ),

    cleaned_sales as materialized (
        select
            c.sku_id::bigint as sku_id,
            c.product_id,
            c.region_id,
            c.godown_id,
            c.month_start,
            c.qty_clean

        from (
            select * from public.fn_sales_monthly_clean_as_of(p_valuation_date)
             where not v_sf
            union all
            select * from costing.fn_costing_sales_monthly_as_of(p_valuation_date)
             where v_sf
        ) c

        join basis_universe u
          on u.sku_id = c.sku_id
         and u.product_id = c.product_id
    ),

    -- Annual historical evidence remains a 12-month sum.
    annual_sku as materialized (
        select
            u.sku_id,
            u.product_id,

            coalesce(
                sum(c.qty_clean)
                    filter (
                        where c.qty_clean is not null
                    ),
                0::numeric
            ) as actual_sales_units_12m

        from basis_universe u

        left join cleaned_sales c
          on c.sku_id = u.sku_id
         and c.product_id = u.product_id
         and c.month_start >= v_driver_lookback_start
         and c.month_start < v_driver_lookback_end

        group by
            u.sku_id,
            u.product_id
    ),

    annual_sku_qty as materialized (
        select
            u.sku_id,
            u.product_id,

            a.actual_sales_units_12m,

            a.actual_sales_units_12m
            * u.sku_base_qty_per_unit
                as actual_sales_base_qty_12m

        from basis_universe u

        join annual_sku a
          on a.sku_id = u.sku_id
         and a.product_id = u.product_id
    ),

    annual_product as materialized (
        select
            a.product_id,

            sum(a.actual_sales_units_12m)
                as actual_product_sales_units_12m,

            sum(a.actual_sales_base_qty_12m)
                as actual_product_sales_base_qty_12m

        from annual_sku_qty a

        group by a.product_id
    ),

    annual_company as materialized (
        select
            sum(a.actual_sales_units_12m)
                as actual_company_sales_units_12m

        from annual_sku_qty a
    ),

    -- First aggregate every location to one company-wide SKU-month.
    company_sku_month as materialized (
        select
            u.sku_id,
            u.product_id,
            c.month_start,

            sum(c.qty_clean)
                filter (
                    where c.qty_clean is not null
                ) as company_sku_month_qty

        from basis_universe u

        left join cleaned_sales c
          on c.sku_id = u.sku_id
         and c.product_id = u.product_id
         and c.month_start >= v_driver_lookback_start
         and c.month_start < v_driver_lookback_end

        group by
            u.sku_id,
            u.product_id,
            c.month_start
    ),

    monthly_maximum as materialized (
        select
            m.sku_id,
            m.product_id,

            max(m.company_sku_month_qty)
                filter (
                    where m.company_sku_month_qty > 0
                ) as maximum_positive_monthly_qty

        from company_sku_month m

        group by
            m.sku_id,
            m.product_id
    ),

    monthly_max_candidates as materialized (
        select
            m.sku_id,
            m.product_id,
            m.month_start,
            m.company_sku_month_qty,
            x.maximum_positive_monthly_qty

        from company_sku_month m

        join monthly_maximum x
          on x.sku_id = m.sku_id
         and x.product_id = m.product_id

        where x.maximum_positive_monthly_qty is not null
          and m.company_sku_month_qty =
              x.maximum_positive_monthly_qty
    ),

    actual_monthly_driver as materialized (
        select
            u.sku_id,
            u.product_id,

            c.maximum_positive_monthly_qty
                as actual_monthly_units,

            max(c.month_start)
                as actual_monthly_source_month,

            count(c.month_start)::bigint
                as tied_month_count

        from basis_universe u

        left join monthly_max_candidates c
          on c.sku_id = u.sku_id
         and c.product_id = u.product_id

        group by
            u.sku_id,
            u.product_id,
            c.maximum_positive_monthly_qty
    ),

    -- SALES-01: seasonal SKUs (top-3 company-wide months >= threshold of the 12-month volume) use the 12-month average.
    seasonal_driver as materialized (
        select
            m.sku_id,
            m.product_id,
            sum(m.company_sku_month_qty) filter (where m.company_sku_month_qty > 0) as positive_12m_units,
            (select sum(x.q) from (
                select m2.company_sku_month_qty q
                  from company_sku_month m2
                 where m2.sku_id = m.sku_id and m2.product_id = m.product_id and m2.company_sku_month_qty > 0
                 order by m2.company_sku_month_qty desc
                 limit 3) x) as top3_units
        from company_sku_month m
        where v_sf
        group by m.sku_id, m.product_id
    ),

    actual_monthly_driver_qty as materialized (
        select
            u.*,

            case when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end
                as actual_monthly_units,
            case when sd.is_seasonal then null::date else d.actual_monthly_source_month end
                as actual_monthly_source_month,
            case when sd.is_seasonal then null::bigint else d.tied_month_count end
                as tied_month_count,
            coalesce(sd.is_seasonal, false) as is_seasonal_average,

            case
                when (case when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end) is null
                    then null::numeric
                else
                    (case when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end)
                    * u.sku_base_qty_per_unit
            end as actual_monthly_base_qty

        from basis_universe u

        left join actual_monthly_driver d
          on d.sku_id = u.sku_id
         and d.product_id = u.product_id

        left join lateral (
            select
                (s.positive_12m_units > 0 and s.top3_units / s.positive_12m_units >= v_sf_thr) as is_seasonal,
                s.positive_12m_units / 12.0 as avg_units
            from seasonal_driver s
            where s.sku_id = u.sku_id and s.product_id = u.product_id
        ) sd on v_sf
    ),

    actual_product_monthly as materialized (
        select
            d.product_id,

            count(*) filter (
                where d.actual_monthly_units > 0
            )::bigint as positive_actual_sku_count,

            sum(d.actual_monthly_units)
                filter (
                    where d.actual_monthly_units > 0
                ) as actual_product_monthly_units,

            sum(d.actual_monthly_base_qty)
                filter (
                    where d.actual_monthly_base_qty > 0
                ) as actual_product_monthly_base_qty

        from actual_monthly_driver_qty d

        group by d.product_id
    ),

    with_assumption as materialized (
        select
            d.*,

            a.assumption_id,
            a.assumption_basis,
            a.assumed_sales_units,
            a.assumed_sales_value,
            a.remarks as assumption_remarks,
            a.approval_reference
                as assumption_approval_reference,
            a.effective_from
                as assumption_effective_from,
            a.effective_to
                as assumption_effective_to,
            a.resolution_status
                as assumption_resolution_status,
            a.qualifying_assumption_count,
            a.resolution_note
                as assumption_resolution_note,

            coalesce(
                p.positive_actual_sku_count,
                0
            ) as product_positive_actual_sku_count,

            case
                when d.actual_monthly_units > 0
                    then null::text

                when a.resolution_status in (
                    'AMBIGUOUS',
                    'RESOLVED'
                )
                    then null::text

                when coalesce(
                    p.positive_actual_sku_count,
                    0
                ) > 0
                    then 'NEW_SKU_EXISTING_PRODUCT'

                else 'NEW_PRODUCT_NO_HISTORY'
            end as required_default_scenario

        from actual_monthly_driver_qty d

        left join actual_product_monthly p
          on p.product_id = d.product_id

        cross join lateral
            costing.fn_resolve_sku_sales_assumption_as_of(
                v_period_start,
                d.sku_id,
                p_valuation_date
            ) a
    ),

    -- AU-6: SKUs needing a non-actual, non-assumption driver, per product.
    default_sku_count as materialized (
        select a.product_id, count(*)::numeric as n
        from with_assumption a
        where a.required_default_scenario is not null
        group by a.product_id
    ),

    with_default as materialized (
        select
            a.*,

            d.policy_id as default_policy_id,
            d.scenario_code
                as default_policy_scenario,
            d.default_sales_units,
            d.effective_from
                as default_policy_effective_from,
            d.effective_to
                as default_policy_effective_to,
            d.resolution_status
                as default_policy_resolution_status,
            d.qualifying_policy_count,
            d.resolution_note
                as default_policy_resolution_note,

            -- AU-6 smart-default parameters (governed policy row).
            pol.default_basis,
            pol.batch_interval_months,
            pol.new_sku_max_share_of_product,
            pol.default_max_age_months,
            apm.actual_product_monthly_base_qty as product_actual_monthly_base_qty,
            dsc.n as product_default_sku_count,
            br.preferred_batch_size as std_batch_size,
            pl.plan_id,
            pl.plan_monthly_base_qty,
            case
                when pl.plan_monthly_base_qty > 0 and a.sku_base_qty_per_unit > 0
                    then pl.plan_monthly_base_qty / a.sku_base_qty_per_unit
            end as plan_monthly_units,
            fd.first_default_period

        from with_assumption a

        left join lateral
            costing.fn_resolve_sales_allocation_default_policy_as_of(
                a.required_default_scenario,
                p_valuation_date
            ) d
          on a.required_default_scenario is not null

        left join costing.sales_allocation_default_policy pol
          on pol.id = d.policy_id

        left join actual_product_monthly apm
          on apm.product_id = a.product_id

        left join default_sku_count dsc
          on dsc.product_id = a.product_id

        -- batch_size_ref is the standard reference (same resolution as the AU-5 writers).
        left join lateral (
            select b.preferred_batch_size
            from public.production_batch_size_ref b
            where b.product_id = a.product_id
              and b.effective_from <= p_valuation_date
              and (b.effective_to is null or b.effective_to >= p_valuation_date)
              and coalesce(b.preferred_batch_size, 0) > 0
            order by b.effective_from desc, b.id desc
            limit 1
        ) br on true

        -- Step 3: governed new-product volume plan (owner, approval, expiry).
        left join lateral (
            select
                p.id as plan_id,
                coalesce(
                    p.planned_monthly_base_qty,
                    p.planned_batches_per_year * br.preferred_batch_size / 12.0
                ) / case when p.sku_id is null then nullif(dsc.n, 0) else 1 end
                    as plan_monthly_base_qty
            from costing.new_product_volume_plan p
            where p.product_id = a.product_id
              and (p.sku_id = a.sku_id or p.sku_id is null)
              and p.status = 'APPROVED'
              and p.effective_from <= p_valuation_date
              and p.expires_on > p_valuation_date
            order by (p.sku_id is null), p.effective_from desc, p.id desc
            limit 1
        ) pl on a.required_default_scenario is not null

        -- Default age for the 12-month expiry (successful runs only).
        left join lateral (
            select min(s.period_start) as first_default_period
            from costing.sku_sales_allocation_basis_snapshot s
            join costing.costing_refresh_run rr
              on rr.id = s.refresh_run_id
             and rr.overall_status = 'SUCCESS'
            where s.sku_id = a.sku_id
              and s.monthly_driver_source in (
                  'DEFAULT_NEW_SKU_EXISTING_PRODUCT',
                  'DEFAULT_NEW_PRODUCT_NO_HISTORY'
              )
        ) fd on a.required_default_scenario is not null
    ),

    with_smart as materialized (
        select
            w.*,

            case
                when coalesce(w.default_basis, 'FLAT_UNITS') <> 'SMART_V2'
                    then w.default_sales_units
                when w.required_default_scenario = 'NEW_PRODUCT_NO_HISTORY'
                    -- min(ceiling packs, one batch_size_ref per N months split over the product's default SKUs)
                    then least(
                        w.default_sales_units,
                        case
                            when w.std_batch_size > 0 and w.batch_interval_months > 0
                             and w.sku_base_qty_per_unit > 0 and w.product_default_sku_count > 0
                                then w.std_batch_size / w.batch_interval_months
                                     / w.product_default_sku_count / w.sku_base_qty_per_unit
                        end
                    )
                when w.required_default_scenario = 'NEW_SKU_EXISTING_PRODUCT'
                    -- min(ceiling packs, x% of the product's actual monthly base qty)
                    then least(
                        w.default_sales_units,
                        case
                            when w.new_sku_max_share_of_product > 0 and w.sku_base_qty_per_unit > 0
                             and w.product_actual_monthly_base_qty > 0
                                then w.new_sku_max_share_of_product
                                     * w.product_actual_monthly_base_qty / w.sku_base_qty_per_unit
                        end
                    )
                else w.default_sales_units
            end as smart_default_units,

            (
                w.default_max_age_months is not null
                and w.first_default_period is not null
                and v_period_start >= (w.first_default_period
                    + make_interval(months => w.default_max_age_months))::date
            ) as default_expired

        from with_default w
    ),

    resolved_sku as materialized (
        select
            r.*,

            case
                -- Ambiguous assumption remains a hard governance block.
                when r.assumption_resolution_status = 'AMBIGUOUS'
                    then null::numeric

                -- Positive actual monthly evidence has priority over
                -- a single resolved manual assumption.
                when r.actual_monthly_units > 0
                    then r.actual_monthly_units

                when r.assumption_resolution_status = 'RESOLVED'
                    then r.assumed_sales_units

                                when r.plan_id is not null
                 and r.plan_monthly_units > 0
                    then r.plan_monthly_units

                when r.default_policy_resolution_status = 'RESOLVED'
                    then r.smart_default_units


                else null::numeric
            end as resolved_monthly_units,

            case
                when r.assumption_resolution_status = 'AMBIGUOUS'
                    then 'UNRESOLVED'

                when r.actual_monthly_units > 0
                    then 'ACTUAL_MONTHLY_MAX'

                when r.assumption_resolution_status = 'RESOLVED'
                    then r.assumption_basis

                                when r.plan_id is not null
                 and r.plan_monthly_units > 0
                    then 'NEW_PRODUCT_ESTIMATE'

                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.required_default_scenario =
                     'NEW_SKU_EXISTING_PRODUCT'
                    then 'DEFAULT_NEW_SKU_EXISTING_PRODUCT'


                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.required_default_scenario =
                     'NEW_PRODUCT_NO_HISTORY'
                    then 'DEFAULT_NEW_PRODUCT_NO_HISTORY'

                else 'UNRESOLVED'
            end as resolved_source,

            case
                when r.assumption_resolution_status = 'AMBIGUOUS'
                    then 'BLOCKED'

                when r.actual_monthly_units > 0
                    then 'READY'

                when r.assumption_resolution_status = 'RESOLVED'
                    then 'REVIEW_REQUIRED'

                                when r.plan_id is not null
                 and r.plan_monthly_units > 0
                    then 'READY'

                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.default_expired
                    then 'BLOCKED'

                when r.default_policy_resolution_status = 'RESOLVED'
                    then 'REVIEW_REQUIRED'

                else 'BLOCKED'
            end as resolved_status,

            case
                when r.assumption_resolution_status = 'AMBIGUOUS'
                    then
                        'Allocation basis is blocked because multiple active SKU assumptions overlap on the frozen valuation date.'

                when r.actual_monthly_units > 0 and r.is_seasonal_average
                    then format(
                        'SALES-01 seasonal SKU (top-3 months >= %s of 12-month volume): allocation basis uses the 12-month average company-wide net monthly quantity.',
                        v_sf_thr)

                when r.actual_monthly_units > 0 and v_sf
                    then
                        'SALES-01: allocation basis uses the maximum positive company-wide net SKU-month quantity (no per-godown outlier filter) in the frozen 12-month lookback.'

                when r.actual_monthly_units > 0
                    then
                        'Allocation basis uses the maximum positive company-wide cleaned SKU-month quantity in the frozen 12-month lookback.'

                when r.assumption_resolution_status = 'RESOLVED'
                    then
                        'No positive actual monthly evidence exists; allocation basis uses one governed SKU-specific assumption effective on the frozen valuation date.'

                                when r.plan_id is not null
                 and r.plan_monthly_units > 0
                    then format(
                        'No actual sales or SKU assumption; governed new-product volume plan %s is used (%s base qty/month).',
                        r.plan_id, round(r.plan_monthly_base_qty, 4))

                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.default_expired
                    then format(
                        'Default driver older than %s months (first default %s); blocked until a volume plan, assumption or inactivation.',
                        r.default_max_age_months, r.first_default_period)

                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.default_basis = 'SMART_V2'
                    then format(
                        'Smart default v2 (%s, policy %s): %s units = least(%s packs, %s).',
                        r.required_default_scenario, r.default_policy_id,
                        round(r.smart_default_units, 4), r.default_sales_units,
                        case when r.required_default_scenario = 'NEW_PRODUCT_NO_HISTORY'
                             then format('1 batch_size_ref %s per %s months / %s SKU(s)',
                                         r.std_batch_size, r.batch_interval_months, r.product_default_sku_count)
                             else format('%s of product actual monthly base qty %s',
                                         r.new_sku_max_share_of_product, round(r.product_actual_monthly_base_qty, 4)) end)

                when r.default_policy_resolution_status = 'AMBIGUOUS'
                    then

                        'Allocation basis is blocked because multiple governed default policies overlap on the frozen valuation date.'

                when r.default_policy_resolution_status = 'MISSING'
                    then
                        'Allocation basis is blocked because no governed default policy is effective on the frozen valuation date.'

                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.required_default_scenario =
                     'NEW_SKU_EXISTING_PRODUCT'
                    then
                        'SKU has no positive actual monthly evidence, while another active SKU of the product does; the governed new-SKU default is used.'

                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.required_default_scenario =
                     'NEW_PRODUCT_NO_HISTORY'
                    then
                        'No active SKU of the product has positive actual monthly evidence; the governed new-product default is used.'

                else
                    'Allocation basis could not be resolved.'
            end as resolved_note,

            case
                when r.assumption_resolution_status = 'AMBIGUOUS'
                    then 'UNRESOLVED'

                when r.actual_monthly_units > 0 and r.is_seasonal_average
                    then 'SEASONAL_12M_AVERAGE_COMPANY_WIDE_NET_SKU_MONTH'

                when r.actual_monthly_units > 0 and v_sf
                    then 'MAX_POSITIVE_COMPANY_WIDE_NET_SKU_MONTH_IN_12M_LOOKBACK'

                when r.actual_monthly_units > 0
                    then
                        'MAX_POSITIVE_COMPANY_WIDE_CLEANED_SKU_MONTH_IN_12M_LOOKBACK'

                when r.assumption_resolution_status = 'RESOLVED'
                    then 'GOVERNED_SKU_ASSUMPTION'

                                when r.plan_id is not null
                 and r.plan_monthly_units > 0
                    then 'GOVERNED_NEW_PRODUCT_PLAN'

                when r.default_policy_resolution_status = 'RESOLVED'
                    then 'GOVERNED_SCENARIO_DEFAULT'

                else 'UNRESOLVED'
            end as resolved_method

                from with_smart r
    ),

    resolved_sku_qty as materialized (
        select
            r.*,

            case
                when r.resolved_monthly_units is null
                    then null::numeric
                else
                    r.resolved_monthly_units
                    * r.sku_base_qty_per_unit
            end as resolved_monthly_base_qty

        from resolved_sku r
    ),

    resolved_product as materialized (
        select
            r.product_id,

            sum(r.resolved_monthly_units)
                filter (
                    where r.resolved_monthly_units is not null
                ) as resolved_product_monthly_units,

            sum(r.resolved_monthly_base_qty)
                filter (
                    where r.resolved_monthly_base_qty is not null
                ) as resolved_product_monthly_base_qty

        from resolved_sku_qty r

        group by r.product_id
    ),

    resolved_company as materialized (
        select
            sum(r.resolved_monthly_units)
                filter (
                    where r.resolved_monthly_units is not null
                ) as resolved_company_monthly_units

        from resolved_sku_qty r
    )

    select
        r.period_start,
        p_valuation_date,
        p_refresh_run_id,

        r.sku_id,
        r.product_id,
        r.product_name,

        r.product_base_uom,
        r.conversion_to_base,
        r.pack_size,
        r.pack_uom,
        r.sku_base_qty_per_unit,

        -- Existing annual fields retain annual semantics.
        a.actual_sales_units_12m,
        a.actual_sales_base_qty_12m,
        ap.actual_product_sales_units_12m,
        ap.actual_product_sales_base_qty_12m,
        ac.actual_company_sales_units_12m,

        case
            when ac.actual_company_sales_units_12m > 0
                then
                    ap.actual_product_sales_units_12m
                    / ac.actual_company_sales_units_12m
            else null::numeric
        end,

        a.actual_sales_units_12m,
        a.actual_sales_base_qty_12m,
        ap.actual_product_sales_units_12m,
        ap.actual_product_sales_base_qty_12m,
        ac.actual_company_sales_units_12m,

        -- Existing resolved fields now project the canonical monthly
        -- resolution for unchanged downstream writers.
        r.resolved_monthly_units,
        r.resolved_monthly_base_qty,
        rp.resolved_product_monthly_units,
        rp.resolved_product_monthly_base_qty,
        rc.resolved_company_monthly_units,

        case
            when rc.resolved_company_monthly_units > 0
                then
                    rp.resolved_product_monthly_units
                    / rc.resolved_company_monthly_units
            else null::numeric
        end,

        r.allocation_basis_status,
        r.resolved_source,
        r.resolved_status,
        r.resolved_note,

        case
            when r.resolved_source in (
                'MANUAL_ASSUMPTION',
                'NEW_SKU_ESTIMATE',
                'NEW_PRODUCT_ESTIMATE'
            )
                then r.assumption_id
            else null::bigint
        end,

        case
            when r.resolved_source in (
                'MANUAL_ASSUMPTION',
                'NEW_SKU_ESTIMATE',
                'NEW_PRODUCT_ESTIMATE'
            )
                then r.assumption_basis
            else null::text
        end,

        case
            when r.resolved_source in (
                'MANUAL_ASSUMPTION',
                'NEW_SKU_ESTIMATE',
                'NEW_PRODUCT_ESTIMATE'
            )
                then r.assumption_effective_from
            else null::date
        end,

        case
            when r.resolved_source in (
                'MANUAL_ASSUMPTION',
                'NEW_SKU_ESTIMATE',
                'NEW_PRODUCT_ESTIMATE'
            )
                then r.assumption_effective_to
            else null::date
        end,

        case
            when r.resolved_source in (
                'DEFAULT_NEW_SKU_EXISTING_PRODUCT',
                'DEFAULT_NEW_PRODUCT_NO_HISTORY'
            )
                then r.default_policy_id
            else null::bigint
        end,

        case
            when r.resolved_source in (
                'DEFAULT_NEW_SKU_EXISTING_PRODUCT',
                'DEFAULT_NEW_PRODUCT_NO_HISTORY'
            )
                then r.default_policy_scenario
            else null::text
        end,

        case
            when r.resolved_source in (
                'DEFAULT_NEW_SKU_EXISTING_PRODUCT',
                'DEFAULT_NEW_PRODUCT_NO_HISTORY'
            )
                then r.default_policy_effective_from
            else null::date
        end,

        case
            when r.resolved_source in (
                'DEFAULT_NEW_SKU_EXISTING_PRODUCT',
                'DEFAULT_NEW_PRODUCT_NO_HISTORY'
            )
                then r.default_policy_effective_to
            else null::date
        end,

        v_driver_lookback_start,
        v_driver_lookback_end,

        r.resolved_monthly_units,
        r.resolved_monthly_base_qty,
        rp.resolved_product_monthly_units,
        rp.resolved_product_monthly_base_qty,
        rc.resolved_company_monthly_units,

        case
            when rc.resolved_company_monthly_units > 0
                then
                    rp.resolved_product_monthly_units
                    / rc.resolved_company_monthly_units
            else null::numeric
        end,

        r.resolved_method,
        r.resolved_source,

        case
            when r.resolved_source = 'ACTUAL_MONTHLY_MAX'
                then r.actual_monthly_source_month
            else null::date
        end,

        v_driver_lookback_start,
        v_driver_lookback_end,

        case
            when r.resolved_source = 'ACTUAL_MONTHLY_MAX'
                then r.tied_month_count
            else null::bigint
        end,

        r.resolved_status,
                r.resolved_note,

        r.plan_id,

        clock_timestamp()

    from resolved_sku_qty r

    join annual_sku_qty a
      on a.sku_id = r.sku_id
     and a.product_id = r.product_id

    join annual_product ap
      on ap.product_id = r.product_id

    cross join annual_company ac

    join resolved_product rp
      on rp.product_id = r.product_id

    cross join resolved_company rc;

    return query
    select
        v_period_start,
        count(*)::bigint,

        count(*) filter (
            where s.allocation_resolution_status = 'BLOCKED'
        )::bigint,

        count(*) filter (
            where s.allocation_resolution_status =
                  'REVIEW_REQUIRED'
        )::bigint,

        count(*) filter (
            where s.allocation_resolution_status = 'READY'
        )::bigint

    from costing.sku_sales_allocation_basis_snapshot s

    where s.period_start = v_period_start
      and s.valuation_date = p_valuation_date
      and s.refresh_run_id = p_refresh_run_id;
end;
$function$
;
revoke all on function costing.rpc_refresh_sku_sales_allocation_basis_snapshot(date,date,bigint) from public, anon, authenticated;
insert into costing.costing_sales_feed_switch(id,is_enabled,effective_from,seasonal_top3_share_threshold,approval_reference,changed_by,note)
values (true,true,date '2026-10-01',0.60,'USER-APPROVAL-20261018-AU6-V2','dff17104-c02a-4bca-95b1-e8ddff46a9b6','SALES-01 costing-only sales feed + seasonal 12-month average from Oct 2026')
on conflict (id) do nothing;

do $c$ begin
  if (select count(*) from costing.fn_costing_sales_feed_mode(date '2026-09-01')) <> 0 then raise exception 'SALES-01 gate open for Sep period'; end if;
  if (select count(*) from costing.fn_qc_batch_true_effective(date '2026-09-10') x where x) <> 0 then raise exception 'AU-6Q gate open for Sep valuation'; end if;
end $c$;

-- ROLLBACK (instant; new runs behave exactly as before the package):
--   update costing.route_load_scaling_switch set is_enabled=false;  update costing.costing_sales_feed_switch set is_enabled=false;
--   update costing.qc_batch_true_switch set is_enabled=false;       update costing.sku_base_quantity_exception set costing_effective_from=null where sku_id in (865,878);
-- Full: re-create the four writers from evidence/AU6A/live_*.sql and evidence/AU6L/live_rpc_refresh_sku_sales_allocation_basis_snapshot.sql,
--   and the two views from evidence/AU6S/live_*.sql. The extended method check constraint is a superset and can stay.
