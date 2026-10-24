-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- AU-5 insert-path fix (user approved 2026-10-16 after run 123 failed: post-step UPDATE hit immutable POH trigger).
-- Batch-true (NORMAL_VOLUME_RATE) is baked into the INSERT path of the POH and Manufacturing-Labour writers:
--   workload = route factor x UNROUNDED monthly batch equivalents (qty / batch_size_ref) instead of ceil(...).
--   Full pool allocated over that workload  ==  rate(pool / sum workload) x workload-per-batch / batch_size_ref per base unit.
-- No snapshot UPDATEs; immutable/designated/lineage triggers untouched. Post-step call removed from the chain.
-- Gate: switch ON, basis NORMAL_VOLUME_RATE, valuation_date >= effective_from (2026-10-01). Otherwise byte-identical behaviour.
create or replace function costing.fn_batch_true_effective(p_valuation_date date) returns boolean
language sql stable security definer set search_path to 'costing','pg_temp' as $$
  select coalesce((select s.is_enabled and s.rate_basis='NORMAL_VOLUME_RATE' and p_valuation_date>=s.effective_from from costing.batch_true_standard_switch s),false)
$$;
revoke all on function costing.fn_batch_true_effective(date) from public, anon, authenticated;

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

  create temporary table tmp_po_product on commit drop as
  with sf as (
    select f.product_id,
           count(*)::integer effective_step_count,
           count(*) filter(where e.production_overhead_scope='INCLUDE')::integer included_step_count,
           count(*) filter(where e.production_overhead_scope='PASSIVE')::integer passive_step_count,
           count(*) filter(where e.production_overhead_scope='EXCLUDE_OTHER_POOL')::integer excluded_step_count,
           sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count) route_factor
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
    'period_start',v_period_start,'batch_true',v_bt,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,'policy_id',v_policy.id,
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
  end if;

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

-- Remove AU-5 post-step UPDATE call from the stage-03 chain
do $h$
declare d text; k text := E'\n        perform costing.fn_apply_batch_true_standard(p_refresh_run_id); -- AU-5 (switch-gated, effective-dated)';
begin
  d := pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure);
  if position(k in d)=0 then
    if position('fn_apply_batch_true_standard' in d)>0 then raise exception 'AU-5 hook present in unexpected form'; end if;
    return;
  end if;
  execute replace(d,k,'');
end $h$;
-- Retire the UPDATE-based applier so it can never run.
create or replace function costing.fn_apply_batch_true_standard(p_refresh_run_id bigint) returns text
language sql stable as $$ select 'RETIRED_USE_INSERT_PATH'::text $$;
