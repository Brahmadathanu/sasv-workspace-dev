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
