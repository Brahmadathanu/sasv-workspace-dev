-- AU-6 COMBINED PACKAGE. PREPARED, NOT APPLIED. User approved BUILD + TEST only (2026-10-18 08:34 IST).
-- Contents (one migration, in this order):
--   A. AU-6Q  QC per batch (QC per base unit = rate x Method-3 units / batch_size_ref), own switch, valuation >= 2026-10-01.
--   B. AU-6S  kit/pack base quantity: K1 allocation-basis view honours costing.sku_base_quantity_exception from period 2026-10-01
--             (865 Kashaya Vasthi Kit and 878 Karkkidaka Kanji = 1 Nos per pack); K4 inventory/MRP multiplier view.
--   C. AU-6A  universal route batch-size scaling (user decision 2026-10-18: Option A, SYMMETRIC):
--             step factor x (batch_size_ref / route-family median batch in the same base UOM)^b(resource class),
--             weight-driven classes scale, fixed-cycle classes (GENERAL_AREA, EXTERNAL_JOB_WORK) do not; QC not scaled.
--             Built into the INSERT path of the Manufacturing-Labour and Production-Overhead writers; own switch; valuation >= 2026-10-01;
--             full pool absorption (rate re-derived); lineage in costing.route_batch_scaling_snapshot; fail-closed on unmapped resource classes;
--             cross-check that both writers used the same reference batch.
-- NOT included: K2 (BOM 2627/2686 to 1 Nos). Not needed: material writers keep pack_size x conversion (275 / 500) against the per-gram BOM,
--   which is numerically correct. Changing the BOM alone would multiply kit material by 275.
-- Sep run 122 (valuation 2026-09-10, APPROVED) is untouched: every gate is valuation/period >= 2026-10-01 and the snapshots are immutable.
-- Keep OUT of supabase/migrations (db push risk). Apply only via Supabase MCP apply_migration, after notifying Jarvis, with run-122 fingerprint before/after.
-- Replace USER-APPROVAL-...-<DATE> placeholders at approval time. Rollback: see the end of this file.

do $g$
begin
  if exists (select 1 from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')) then
    raise exception 'AU-6 package: a costing run is in progress'; end if;
  if md5(pg_get_functiondef('costing.rpc_refresh_production_overhead_workload_snapshot(date,date,bigint)'::regprocedure)) <> '65148089c070ac95002caa3ee83a8098'
  or md5(pg_get_functiondef('costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint)'::regprocedure)) <> '5b77af292903abb73cd30ded2f36e5e0'
  or md5(pg_get_functiondef('costing.rpc_refresh_qc_monetary_allocation_snapshot(date,date,bigint)'::regprocedure)) <> '7a599a4dad0c4436cc8431d109470f2c' then
    raise exception 'AU-6 package: a writer drifted from the reviewed live definition (2026-10-18)'; end if;
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


-- ============================== C. AU-6A route batch scaling ==============================
-- AU-6A route batch-size scaling: configuration objects (switch, exponents, lineage, helpers).
create table if not exists costing.route_batch_scaling_switch(
  id boolean primary key default true check (id),
  is_enabled boolean not null default false,
  scaling_mode text not null default 'SYMMETRIC' check (scaling_mode in ('SYMMETRIC')),
  effective_from date not null default date '2026-10-01'
    check (effective_from >= date '2026-10-01' and effective_from = date_trunc('month', effective_from)::date),
  approval_reference text, changed_by text, changed_at timestamptz default now(), note text);
revoke all on costing.route_batch_scaling_switch from anon, authenticated;
grant select on costing.route_batch_scaling_switch to authenticated;

create table if not exists costing.route_step_scale_exponent(
  resource_class_code text primary key,
  exponent numeric not null check (exponent >= 0 and exponent <= 1),
  scaling_basis text not null check (scaling_basis in ('WEIGHT_DRIVEN','PARTLY_WEIGHT_DRIVEN','FIXED_CYCLE')),
  rationale text not null,
  approval_reference text not null,
  created_at timestamptz not null default now());
revoke all on costing.route_step_scale_exponent from anon, authenticated;
grant select on costing.route_step_scale_exponent to authenticated;

insert into costing.route_step_scale_exponent(resource_class_code,exponent,scaling_basis,rationale,approval_reference) values
 ('TABLET_OR_CAPSULE_EQUIPMENT',0.9,'WEIGHT_DRIVEN','machine run time ~ units','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>'),
 ('GRINDER',0.8,'WEIGHT_DRIVEN','throughput-bound: time ~ mass','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>'),
 ('MANUAL',0.7,'WEIGHT_DRIVEN','handling ~ mass, small setup','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>'),
 ('FILTRATION_SYSTEM',0.7,'WEIGHT_DRIVEN','volume-bound','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>'),
 ('MIXING_EQUIPMENT',0.6,'PARTLY_WEIGHT_DRIVEN','charge/clean fixed, run partly mass','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>'),
 ('PROCESSING_VESSEL',0.5,'PARTLY_WEIGHT_DRIVEN','heating cycle partly fixed','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>'),
 ('EXTRACTION_SYSTEM',0.5,'PARTLY_WEIGHT_DRIVEN','cycle partly fixed','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>'),
 ('DRYER_OR_OVEN',0.5,'PARTLY_WEIGHT_DRIVEN','cycle fixed, loading ~ mass','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>'),
 ('FERMENTATION_VESSEL',0.4,'PARTLY_WEIGHT_DRIVEN','occupancy time mostly fixed','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>'),
 ('CALCINATION',0.3,'PARTLY_WEIGHT_DRIVEN','puta cycles mostly fixed','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>'),
 ('TRADITIONAL_FURNACE',0.3,'PARTLY_WEIGHT_DRIVEN','firing cycle mostly fixed','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>'),
 ('STORAGE_OCCUPANCY',0.3,'PARTLY_WEIGHT_DRIVEN','occupancy mostly time','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>'),
 ('GENERAL_AREA',0,'FIXED_CYCLE','per batch','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>'),
 ('EXTERNAL_JOB_WORK',0,'FIXED_CYCLE','per batch','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>')
on conflict (resource_class_code) do nothing;

-- Per-run lineage: reference batch, raw vs scaled factor and per-step scales actually used (exponents frozen per run).
create table if not exists costing.route_batch_scaling_snapshot(
  id bigint generated by default as identity primary key,
  period_start date not null, valuation_date date not null, refresh_run_id bigint not null,
  allocation_pool text not null check (allocation_pool in ('PRODUCTION_OVERHEAD','MANUFACTURING_LABOUR')),
  product_id bigint not null, route_family_id bigint, product_base_uom text,
  preferred_batch_size numeric, reference_batch_size numeric, family_product_count integer,
  raw_factor numeric, scaled_factor numeric, scaling_mode text not null, approval_reference text,
  step_detail jsonb, created_at timestamptz not null default now(),
  unique (refresh_run_id, allocation_pool, product_id));
revoke all on costing.route_batch_scaling_snapshot from anon, authenticated;
grant select on costing.route_batch_scaling_snapshot to authenticated;
drop trigger if exists trg_au2_designated_run_guard on costing.route_batch_scaling_snapshot;
create trigger trg_au2_designated_run_guard before insert or delete or update on costing.route_batch_scaling_snapshot for each row execute function costing.fn_guard_designated_run_rows();
drop trigger if exists trg_au2_mutable_run_guard on costing.route_batch_scaling_snapshot;
create trigger trg_au2_mutable_run_guard before insert or delete or update on costing.route_batch_scaling_snapshot for each row execute function costing.fn_enforce_mutable_refresh_run_snapshot();
drop trigger if exists trg_au2_snapshot_truncate_guard on costing.route_batch_scaling_snapshot;
create trigger trg_au2_snapshot_truncate_guard before truncate on costing.route_batch_scaling_snapshot for each statement execute function costing.fn_guard_snapshot_truncate();

-- Gate: AU-5 batch-true must be effective AND scaling switch on AND valuation_date >= effective_from (Sep run 122 valuation 2026-09-10: never).
create or replace function costing.fn_route_batch_scaling_mode(p_valuation_date date)
returns table(scaling_mode text, approval_reference text)
language sql stable security definer set search_path to 'costing','pg_temp' as $$
  select s.scaling_mode, s.approval_reference from costing.route_batch_scaling_switch s
   where s.is_enabled and p_valuation_date >= s.effective_from and costing.fn_batch_true_effective(p_valuation_date)
$$;
revoke all on function costing.fn_route_batch_scaling_mode(date) from public, anon, authenticated;

create or replace function costing.fn_route_batch_scale(p_bs numeric, p_ref_bs numeric, p_exponent numeric)
returns numeric language sql immutable as $$
  select case when p_bs is null or p_ref_bs is null or p_bs <= 0 or p_ref_bs <= 0 or p_exponent is null then 1::numeric
              when p_exponent = 0 then 1::numeric
              else power(p_bs / p_ref_bs, p_exponent) end
$$;
revoke all on function costing.fn_route_batch_scale(numeric,numeric,numeric) from public, anon, authenticated;
comment on table costing.route_batch_scaling_switch is 'AU-6A: route workload scaled by batch size vs route-family median batch (f x (bs/ref)^b). Off or valuation < effective_from = pre-AU-6A behaviour.';

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
  v_rs text;          -- AU-6A route batch scaling mode (null = off)
  v_rs_appr text;
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

    -- AU-6A: scale each labour step by (batch / route-family median batch)^exponent(resource class); intensity re-stated, workload on unrounded batch equivalents.
    select m.scaling_mode, m.approval_reference into v_rs, v_rs_appr from costing.fn_route_batch_scaling_mode(p_valuation_date) m;
    if v_rs is not null then
      create temporary table tmp_dl_bs on commit drop as
      select distinct on (b.product_id) b.product_id,b.preferred_batch_size
        from public.production_batch_size_ref b
       where b.effective_from<=p_valuation_date and (b.effective_to is null or b.effective_to>=p_valuation_date)
       order by b.product_id,b.effective_from desc,b.id desc;

      create temporary table tmp_dl_ref on commit drop as
      select t.route_family_id, t.product_base_uom,
             (percentile_cont(0.5) within group (order by br.preferred_batch_size))::numeric ref_bs, count(*)::integer n
        from tmp_dl_product t join tmp_dl_bs br on br.product_id=t.product_id
       where t.route_family_id is not null and br.preferred_batch_size>0
       group by t.route_family_id, t.product_base_uom;

      if exists (select 1 from tmp_dl_product t
                 cross join lateral jsonb_array_elements(case when jsonb_typeof(t.labour_step_evidence)='array' then t.labour_step_evidence else '[]'::jsonb end) e
                 where coalesce(nullif(e->>'step_labour_factor','')::numeric,0) <> 0
                   and not exists (select 1 from costing.route_step_scale_exponent x where x.resource_class_code = e->>'resource_class_code')) then
        raise exception 'AU-6A: labour step resource class without an approved scale exponent (fail-closed)';
      end if;

      create temporary table tmp_dl_scale on commit drop as
      select t.product_id, t.route_family_id, t.product_base_uom, br.preferred_batch_size bs, r.ref_bs, r.n,
             t.direct_labour_route_intensity raw_intensity,
             sum(nullif(e->>'step_labour_factor','')::numeric) f,
             sum(nullif(e->>'step_labour_factor','')::numeric*costing.fn_route_batch_scale(br.preferred_batch_size, r.ref_bs, ex.exponent)) fs,
             jsonb_agg(jsonb_build_object('rc',e->>'resource_class_code','b',ex.exponent,
                       'scale',costing.fn_route_batch_scale(br.preferred_batch_size, r.ref_bs, ex.exponent))
                       order by nullif(e->>'sequence_no','')::numeric) step_detail
        from tmp_dl_product t
        join tmp_dl_bs br on br.product_id=t.product_id and br.preferred_batch_size>0
        left join tmp_dl_ref r on r.route_family_id=t.route_family_id and r.product_base_uom=t.product_base_uom
        cross join lateral jsonb_array_elements(case when jsonb_typeof(t.labour_step_evidence)='array' then t.labour_step_evidence else '[]'::jsonb end) e
        left join costing.route_step_scale_exponent ex on ex.resource_class_code=e->>'resource_class_code'
       where coalesce(t.monthly_product_base_qty,0)>0 and coalesce(t.direct_labour_workload_units,0)>0
       group by t.product_id, t.route_family_id, t.product_base_uom, br.preferred_batch_size, r.ref_bs, r.n, t.direct_labour_route_intensity;

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

  if v_rs is not null then -- AU-6A lineage
    insert into costing.route_batch_scaling_snapshot(period_start,valuation_date,refresh_run_id,allocation_pool,product_id,route_family_id,product_base_uom,
      preferred_batch_size,reference_batch_size,family_product_count,raw_factor,scaled_factor,scaling_mode,approval_reference,step_detail)
    select v_period_start,p_valuation_date,p_refresh_run_id,'MANUFACTURING_LABOUR',s.product_id,s.route_family_id,s.product_base_uom,
           s.bs,s.ref_bs,s.n,s.raw_intensity,case when s.f>0 then s.raw_intensity*s.fs/s.f else s.raw_intensity end,v_rs,v_rs_appr,s.step_detail
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
$function$;

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
  v_rs text;          -- AU-6A route batch scaling mode (null = off)
  v_rs_appr text;
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
  select m.scaling_mode, m.approval_reference into v_rs, v_rs_appr from costing.fn_route_batch_scaling_mode(p_valuation_date) m; -- AU-6A

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

  -- AU-6A: route-family reference batch = median batch_size_ref of the family within the same base UOM.
  create temporary table tmp_po_ref on commit drop as
  select f.route_family_id, f.product_base_uom,
         (percentile_cont(0.5) within group (order by f.preferred_batch_size))::numeric ref_bs, count(*)::integer n
    from tmp_po_foundation f
   where v_rs is not null and f.route_family_id is not null and f.preferred_batch_size > 0
   group by f.route_family_id, f.product_base_uom;

  if v_rs is not null and exists (
       select 1 from tmp_po_foundation f
       cross join lateral jsonb_to_recordset(case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end)
         as e(resource_class_code text, expected_occurrence_count numeric, standard_cycle_count numeric)
       where coalesce(e.expected_occurrence_count,0)*coalesce(e.standard_cycle_count,0) <> 0
         and not exists (select 1 from costing.route_step_scale_exponent x where x.resource_class_code = e.resource_class_code)) then
    raise exception 'AU-6A: route step resource class without an approved scale exponent (fail-closed)';
  end if;

  create temporary table tmp_po_product on commit drop as
  with sf as (
    select f.product_id,
           count(*)::integer effective_step_count,
           count(*) filter(where e.production_overhead_scope='INCLUDE')::integer included_step_count,
           count(*) filter(where e.production_overhead_scope='PASSIVE')::integer passive_step_count,
           count(*) filter(where e.production_overhead_scope='EXCLUDE_OTHER_POOL')::integer excluded_step_count,
           sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count) raw_route_factor,
           case when v_rs is null then sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count)
                else sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count
                         *costing.fn_route_batch_scale(f.preferred_batch_size, pr.ref_bs, ex.exponent)) end route_factor -- AU-6A
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
    left join tmp_po_ref pr on pr.route_family_id=f.route_family_id and pr.product_base_uom=f.product_base_uom
    left join costing.route_step_scale_exponent ex on v_rs is not null and ex.resource_class_code=e.resource_class_code
    group by f.product_id
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

  -- AU-6A lineage (only when scaling is effective).
  if v_rs is not null then
    insert into costing.route_batch_scaling_snapshot(period_start,valuation_date,refresh_run_id,allocation_pool,product_id,route_family_id,product_base_uom,
      preferred_batch_size,reference_batch_size,family_product_count,raw_factor,scaled_factor,scaling_mode,approval_reference,step_detail)
    select v_period_start,p_valuation_date,p_refresh_run_id,'PRODUCTION_OVERHEAD',t.product_id,t.route_family_id,t.product_base_uom,
           t.preferred_batch_size,pr.ref_bs,pr.n,t.raw_route_factor,t.route_factor,v_rs,v_rs_appr,
           (select jsonb_agg(jsonb_build_object('rc',e.resource_class_code,'b',ex.exponent,
                     'scale',costing.fn_route_batch_scale(t.preferred_batch_size, pr.ref_bs, ex.exponent)) order by e.sequence_no)
              from tmp_po_foundation f
              cross join lateral jsonb_to_recordset(case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end)
                as e(sequence_no numeric, resource_class_code text)
              left join costing.route_step_scale_exponent ex on ex.resource_class_code=e.resource_class_code
             where f.product_id=t.product_id)
      from tmp_po_product t
      left join tmp_po_ref pr on pr.route_family_id=t.route_family_id and pr.product_base_uom=t.product_base_uom
     where t.raw_route_factor is not null;

    -- Manufacturing Labour (written earlier in the chain) must have used the same reference batch per product.
    if exists (select 1 from costing.route_batch_scaling_snapshot d
                join costing.route_batch_scaling_snapshot p on p.refresh_run_id=d.refresh_run_id and p.product_id=d.product_id
               where d.refresh_run_id=p_refresh_run_id and d.allocation_pool='MANUFACTURING_LABOUR' and p.allocation_pool='PRODUCTION_OVERHEAD'
                 and (d.reference_batch_size is distinct from p.reference_batch_size or d.preferred_batch_size is distinct from p.preferred_batch_size)) then
      raise exception 'AU-6A: Manufacturing Labour and Production Overhead used different reference batches in run %',p_refresh_run_id;
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
    'period_start',v_period_start,'batch_true',v_bt,'route_batch_scaling',v_rs,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,'policy_id',v_policy.id,
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
$function$;

revoke all on function costing.rpc_refresh_production_overhead_workload_snapshot(date,date,bigint) from public, anon, authenticated;
insert into costing.route_batch_scaling_switch(id,is_enabled,scaling_mode,effective_from,approval_reference,changed_by,note)
values (true,true,'SYMMETRIC',date '2026-10-01','USER-APPROVAL-AU6A-ROUTE-SCALING-<DATE>','dff17104-c02a-4bca-95b1-e8ddff46a9b6','AU-6A universal route batch scaling from Oct 2026')
on conflict (id) do nothing;

do $c$ begin
  if (select count(*) from costing.fn_route_batch_scaling_mode(date '2026-09-10')) <> 0 then raise exception 'AU-6A gate open for Sep valuation'; end if;
  if (select count(*) from costing.fn_qc_batch_true_effective(date '2026-09-10') x where x) <> 0 then raise exception 'AU-6Q gate open for Sep valuation'; end if;
end $c$;

-- ROLLBACK (instant, behaviour byte-identical to pre-package for new runs):
--   update costing.route_batch_scaling_switch set is_enabled=false;   update costing.qc_batch_true_switch set is_enabled=false;
--   update costing.sku_base_quantity_exception set costing_effective_from=null where sku_id in (865,878);
-- Full: re-create the three writers from evidence/AU6A/live_*.sql, and the two views from evidence/AU6S/live_*.sql.
