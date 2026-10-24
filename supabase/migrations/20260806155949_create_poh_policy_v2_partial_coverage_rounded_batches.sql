-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table costing.production_overhead_workload_policy
  drop constraint if exists production_overhead_workload_policy_formula_type_check;

alter table costing.production_overhead_workload_policy
  add constraint production_overhead_workload_policy_formula_type_check
  check (formula_type in ('BATCH_EQUIVALENT_ROUTE_FACTOR','ROUNDED_BATCH_ROUTE_FACTOR'));

alter table costing.product_production_overhead_workload_snapshot
  add column if not exists rounded_batch_count integer;

insert into costing.production_overhead_workload_policy(
  policy_code,policy_version,status,effective_from,effective_to,formula_type,
  approval_reference,policy_note,approved_by,approved_at,created_by
)
select p.policy_code,2,'DRAFT',p.effective_from,null,'ROUNDED_BATCH_ROUTE_FACTOR',
       null,
       'Unified Production Overhead pool allocated across Products eligible in the exact run using rounded standard batches multiplied by effective route factor. Blocked Products remain individually blocked with zero allocation; incomplete company coverage does not block eligible Products. INCLUDE=1, PASSIVE=0.25, EXCLUDE=0; behaviour and resource multipliers remain neutral in policy version 2.',
       null,null,p.created_by
from costing.production_overhead_workload_policy p
where p.policy_code='PRODUCTION_ROUTE_BATCH_EQUIVALENT'
  and p.policy_version=1
  and not exists (
    select 1 from costing.production_overhead_workload_policy x
    where x.policy_code=p.policy_code and x.policy_version=2
  );

insert into costing.production_overhead_scope_factor(policy_id,scope_code,factor,note)
select p2.id,f.scope_code,f.factor,
       case f.scope_code
         when 'INCLUDE' then 'Active Production route contribution under unified POH policy version 2.'
         when 'PASSIVE' then 'Passive WIP or occupancy contribution under unified POH policy version 2.'
         else 'Allocated through another pool or excluded from Production Overhead.'
       end
from costing.production_overhead_workload_policy p1
join costing.production_overhead_workload_policy p2
  on p2.policy_code=p1.policy_code and p2.policy_version=2
join costing.production_overhead_scope_factor f on f.policy_id=p1.id
where p1.policy_code='PRODUCTION_ROUTE_BATCH_EQUIVALENT'
  and p1.policy_version=1
  and not exists (
    select 1 from costing.production_overhead_scope_factor x
    where x.policy_id=p2.id and x.scope_code=f.scope_code
  );

insert into costing.production_overhead_behaviour_factor(policy_id,behaviour_code,factor,note)
select p2.id,f.behaviour_code,1,
       'Neutral in unified Production Overhead policy version 2; behaviour metadata is retained for traceability.'
from costing.production_overhead_workload_policy p1
join costing.production_overhead_workload_policy p2
  on p2.policy_code=p1.policy_code and p2.policy_version=2
join costing.production_overhead_behaviour_factor f on f.policy_id=p1.id
where p1.policy_code='PRODUCTION_ROUTE_BATCH_EQUIVALENT'
  and p1.policy_version=1
  and not exists (
    select 1 from costing.production_overhead_behaviour_factor x
    where x.policy_id=p2.id and x.behaviour_code=f.behaviour_code
  );

insert into costing.production_overhead_resource_factor(policy_id,resource_class_code,factor,note)
select p2.id,f.resource_class_code,1,
       'Neutral in unified Production Overhead policy version 2; resource metadata is retained for traceability.'
from costing.production_overhead_workload_policy p1
join costing.production_overhead_workload_policy p2
  on p2.policy_code=p1.policy_code and p2.policy_version=2
join costing.production_overhead_resource_factor f on f.policy_id=p1.id
where p1.policy_code='PRODUCTION_ROUTE_BATCH_EQUIVALENT'
  and p1.policy_version=1
  and not exists (
    select 1 from costing.production_overhead_resource_factor x
    where x.policy_id=p2.id and x.resource_class_code=f.resource_class_code
  );

create or replace function costing.fn_preview_production_overhead_workload(
    p_policy_id bigint,
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint,
    p_route_family_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
    v_period_start date:=date_trunc('month',p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_policy costing.production_overhead_workload_policy%rowtype;
    v_pool numeric;
    v_result jsonb;
begin
    if p_policy_id is null or p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'policy_id, period_start, valuation_date and refresh_run_id are required';
    end if;
    select * into v_policy from costing.production_overhead_workload_policy where id=p_policy_id;
    if not found then raise exception 'Production Overhead workload policy % not found',p_policy_id; end if;
    if not coalesce((costing.fn_validate_production_overhead_workload_policy(p_policy_id)->>'valid')::boolean,false) then
        raise exception 'Production Overhead workload policy % is invalid',p_policy_id;
    end if;
    select * into v_run from costing.costing_refresh_run where id=p_refresh_run_id;
    if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;
    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Preview context does not match refresh run %',p_refresh_run_id;
    end if;
    select total_pool_amount into v_pool
    from costing.cost_pool_monthly_snapshot
    where period_start=v_period_start and valuation_date=p_valuation_date
      and refresh_run_id=p_refresh_run_id and allocation_pool='PRODUCTION_OVERHEAD';

    with recipients as (
      select b.product_id,max(b.product_name) product_name,max(b.product_base_uom) product_base_uom,
             max(b.monthly_product_allocation_base_qty) monthly_product_base_qty,
             max(b.monthly_driver_status) monthly_driver_status
      from costing.sku_sales_allocation_basis_snapshot b
      where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id
      group by b.product_id
    ), products_in_scope as (
      select p.id product_id,p.item product_name,p.uom_base product_base_uom,
             costing.fn_resolve_route_family_for_product(p.id,p_valuation_date) route_family_id,
             costing.fn_resolve_effective_route_family_route(p.id,p_valuation_date) family_route_id
      from public.products p
      where upper(coalesce(p.status,''))='ACTIVE'
        and (p_route_family_id is null or costing.fn_resolve_route_family_for_product(p.id,p_valuation_date)=p_route_family_id)
    ), batch_ref as (
      select distinct on (b.product_id) b.product_id,b.id batch_size_ref_id,b.preferred_batch_size,b.effective_from
      from public.production_batch_size_ref b
      where b.is_active and b.effective_from<=p_valuation_date
      order by b.product_id,b.effective_from desc,b.id desc
    ), step_factor as (
      select p.product_id,
             count(*) effective_step_count,
             count(*) filter(where e.production_overhead_scope='INCLUDE') included_step_count,
             count(*) filter(where e.production_overhead_scope='PASSIVE') passive_step_count,
             count(*) filter(where e.production_overhead_scope='EXCLUDE_OTHER_POOL') excluded_step_count,
             sum(sf.factor*bf.factor*rf.factor*e.expected_occurrence_count*e.standard_cycle_count) route_factor,
             jsonb_agg(jsonb_build_object(
               'effective_step_key',e.effective_step_key,'sequence_no',e.sequence_no,
               'production_overhead_scope',e.production_overhead_scope,'scope_factor',sf.factor,
               'behaviour_code',e.behaviour_code,'behaviour_factor',bf.factor,
               'resource_class_code',e.resource_class_code,'resource_factor',rf.factor,
               'expected_occurrence_count',e.expected_occurrence_count,'standard_cycle_count',e.standard_cycle_count,
               'step_factor',sf.factor*bf.factor*rf.factor*e.expected_occurrence_count*e.standard_cycle_count,
               'source_type',e.source_type
             ) order by e.sequence_no,e.effective_step_key) step_evidence
      from products_in_scope p
      cross join lateral costing.fn_effective_product_process_steps(p.product_id,p_valuation_date) e
      join costing.production_overhead_scope_factor sf on sf.policy_id=p_policy_id and sf.scope_code=e.production_overhead_scope
      join costing.production_overhead_behaviour_factor bf on bf.policy_id=p_policy_id and bf.behaviour_code=e.behaviour_code
      join costing.production_overhead_resource_factor rf on rf.policy_id=p_policy_id and rf.resource_class_code=e.resource_class_code
      group by p.product_id
    ), base_rows as (
      select p.product_id,p.product_name,p.product_base_uom,p.route_family_id,p.family_route_id,
             r.monthly_product_base_qty,r.monthly_driver_status,b.batch_size_ref_id,b.preferred_batch_size,
             s.effective_step_count,s.included_step_count,s.passive_step_count,s.excluded_step_count,s.route_factor,s.step_evidence,
             case when b.preferred_batch_size>0 and r.monthly_product_base_qty is not null
                  then r.monthly_product_base_qty/b.preferred_batch_size end monthly_batch_equivalents,
             case when b.preferred_batch_size>0 and r.monthly_product_base_qty>0
                  then ceil(r.monthly_product_base_qty/b.preferred_batch_size)::integer end rounded_batch_count,
             case
               when r.product_id is null then 'NOT_IN_CURRENT_RECIPIENT_SET'
               when p.family_route_id is null then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE'
               when s.route_factor is null or s.route_factor<=0 then 'BLOCKED_NO_POSITIVE_ROUTE_FACTOR'
               when b.batch_size_ref_id is null or b.preferred_batch_size<=0 then 'BLOCKED_NO_ACTIVE_BATCH_SIZE'
               when r.monthly_product_base_qty is null or r.monthly_product_base_qty<=0 then 'BLOCKED_NO_MONTHLY_PRODUCT_BASE_QTY'
               when r.monthly_driver_status='BLOCKED' then 'BLOCKED_MONTHLY_DRIVER'
               when r.monthly_driver_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_MONTHLY_DRIVER'
               else 'READY' end workload_status
      from products_in_scope p
      left join recipients r on r.product_id=p.product_id
      left join batch_ref b on b.product_id=p.product_id
      left join step_factor s on s.product_id=p.product_id
    ), rows_with_workload as (
      select b.*,
             case when b.rounded_batch_count is not null and b.route_factor is not null
                  then b.rounded_batch_count*b.route_factor end workload_units
      from base_rows b
    ), totals as (
      select sum(workload_units) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER')) eligible_company_workload_units,
             count(*) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER')) eligible_product_count,
             count(*) filter(where workload_status like 'BLOCKED%') blocked_product_count,
             count(*) filter(where workload_status<>'NOT_IN_CURRENT_RECIPIENT_SET') recipient_product_count
      from rows_with_workload
    ), rows as (
      select r.*,
             case when r.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER') and t.eligible_company_workload_units>0
                  then r.workload_units/t.eligible_company_workload_units else 0 end product_workload_share,
             case when r.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER') and t.eligible_company_workload_units>0 and v_pool is not null
                  then v_pool*r.workload_units/t.eligible_company_workload_units else 0 end product_production_overhead_allocation,
             case when t.recipient_product_count>0 then t.eligible_product_count::numeric/t.recipient_product_count end eligible_coverage_ratio,
             t.eligible_company_workload_units,t.eligible_product_count,t.blocked_product_count,t.recipient_product_count
      from rows_with_workload r cross join totals t
    )
    select jsonb_build_object(
      'preview_only',true,'approvable',false,'records_created',0,
      'allocation_mode','FULL_POOL_TO_CURRENT_ELIGIBLE_PRODUCTS',
      'blocked_product_treatment','ZERO_ALLOCATION_RETAIN_BLOCKER',
      'future_redistribution','NEW_EXACT_RUN_ONLY',
      'policy',to_jsonb(v_policy),'period_start',v_period_start,'valuation_date',p_valuation_date,
      'refresh_run_id',p_refresh_run_id,'route_family_id',p_route_family_id,'pool_amount',v_pool,
      'summary',jsonb_build_object(
        'product_count',count(*),'ready_count',count(*) filter(where workload_status='READY'),
        'review_required_count',count(*) filter(where workload_status like 'REVIEW_REQUIRED%'),
        'blocked_count',count(*) filter(where workload_status like 'BLOCKED%'),
        'not_in_recipient_set_count',count(*) filter(where workload_status='NOT_IN_CURRENT_RECIPIENT_SET'),
        'eligible_product_count',max(eligible_product_count),'recipient_product_count',max(recipient_product_count),
        'eligible_coverage_ratio',max(eligible_coverage_ratio),
        'eligible_company_workload_units',max(eligible_company_workload_units),
        'allocated_pool_amount',sum(product_production_overhead_allocation),
        'unallocated_pool_amount',coalesce(v_pool,0)-sum(product_production_overhead_allocation)
      ),
      'status_counts',coalesce((select jsonb_object_agg(workload_status,cnt) from (select workload_status,count(*) cnt from rows group by workload_status) x),'{}'::jsonb),
      'rows',coalesce(jsonb_agg(to_jsonb(rows) order by product_name,product_id),'[]'::jsonb)
    ) into v_result from rows;
    return v_result;
end;
$function$;

create or replace function costing.rpc_refresh_production_overhead_workload_snapshot(
  p_period_start date,p_valuation_date date,p_refresh_run_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_period_start date:=date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_policy costing.production_overhead_workload_policy%rowtype;
  v_pool numeric;
  v_recipient_count integer;
  v_eligible_count integer;
  v_blocked_count integer;
  v_coverage numeric;
  v_company_workload numeric;
  v_allocated_pool numeric;
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then raise exception 'period_start, valuation_date and refresh_run_id are required'; end if;
  select * into v_run from costing.costing_refresh_run where id=p_refresh_run_id;
  if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;
  if v_run.period_start is distinct from v_period_start or v_run.valuation_date is distinct from p_valuation_date or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Production Overhead snapshot context does not match refresh run %',p_refresh_run_id;
  end if;
  if v_run.overall_status<>'SUCCESS' then raise exception 'Production Overhead snapshots may be built only for a successful refresh run'; end if;
  if exists(select 1 from costing.product_production_overhead_workload_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.product_production_overhead_step_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_production_overhead_allocation_snapshot where refresh_run_id=p_refresh_run_id) then
    raise exception 'Production Overhead snapshots already exist for refresh run % and are immutable',p_refresh_run_id;
  end if;
  select * into v_policy from costing.fn_resolve_production_overhead_workload_policy(p_valuation_date);
  select total_pool_amount into v_pool
  from costing.cost_pool_monthly_snapshot
  where period_start=v_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id and allocation_pool='PRODUCTION_OVERHEAD';
  if v_pool is null then raise exception 'Production Overhead pool is missing for exact run %',p_refresh_run_id; end if;

  create temporary table tmp_po_product on commit drop as
  with recipients as (
    select b.product_id,max(b.product_name) product_name,max(b.product_base_uom) product_base_uom,
           max(b.monthly_product_allocation_base_qty) monthly_product_base_qty,max(b.monthly_driver_status) monthly_driver_status
    from costing.sku_sales_allocation_basis_snapshot b
    where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id
    group by b.product_id
  ), br as (
    select distinct on (x.product_id) x.product_id,x.id batch_size_ref_id,x.preferred_batch_size
    from public.production_batch_size_ref x where x.is_active and x.effective_from<=p_valuation_date
    order by x.product_id,x.effective_from desc,x.id desc
  ), route as (
    select r.product_id,
           costing.fn_resolve_route_family_for_product(r.product_id::integer,p_valuation_date) route_family_id,
           costing.fn_resolve_effective_route_family_route(r.product_id::integer,p_valuation_date) family_route_id,
           (costing.fn_validate_effective_product_process_route(r.product_id::integer,p_valuation_date)->>'product_route_id')::bigint product_route_id,
           costing.fn_validate_effective_product_process_route(r.product_id::integer,p_valuation_date)->>'route_source' effective_route_source
    from recipients r
  ), sf as (
    select r.product_id,count(*) effective_step_count,
           count(*) filter(where e.production_overhead_scope='INCLUDE') included_step_count,
           count(*) filter(where e.production_overhead_scope='PASSIVE') passive_step_count,
           count(*) filter(where e.production_overhead_scope='EXCLUDE_OTHER_POOL') excluded_step_count,
           sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count) route_factor
    from recipients r
    left join lateral costing.fn_effective_product_process_steps(r.product_id::integer,p_valuation_date) e on true
    left join costing.production_overhead_scope_factor sc on sc.policy_id=v_policy.id and sc.scope_code=e.production_overhead_scope
    left join costing.production_overhead_behaviour_factor bh on bh.policy_id=v_policy.id and bh.behaviour_code=e.behaviour_code
    left join costing.production_overhead_resource_factor rs on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
    group by r.product_id
  )
  select r.*,rt.route_family_id,rt.family_route_id,rt.product_route_id,rt.effective_route_source,
         br.batch_size_ref_id,br.preferred_batch_size,sf.effective_step_count,sf.included_step_count,sf.passive_step_count,sf.excluded_step_count,sf.route_factor,
         case when br.preferred_batch_size>0 then r.monthly_product_base_qty/br.preferred_batch_size end monthly_batch_equivalents,
         case when br.preferred_batch_size>0 and r.monthly_product_base_qty>0 then ceil(r.monthly_product_base_qty/br.preferred_batch_size)::integer end rounded_batch_count,
         case when br.preferred_batch_size>0 and r.monthly_product_base_qty>0 and sf.route_factor is not null
              then ceil(r.monthly_product_base_qty/br.preferred_batch_size)*sf.route_factor end workload_units,
         case when rt.family_route_id is null then 'BLOCKED_NO_APPROVED_EFFECTIVE_ROUTE'
              when sf.route_factor is null or sf.route_factor<=0 then 'BLOCKED_NO_POSITIVE_ROUTE_FACTOR'
              when br.batch_size_ref_id is null or br.preferred_batch_size<=0 then 'BLOCKED_NO_ACTIVE_BATCH_SIZE'
              when r.monthly_product_base_qty is null or r.monthly_product_base_qty<=0 then 'BLOCKED_NO_MONTHLY_PRODUCT_BASE_QTY'
              when r.monthly_driver_status='BLOCKED' then 'BLOCKED_MONTHLY_DRIVER'
              when r.monthly_driver_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_MONTHLY_DRIVER'
              else 'READY' end workload_status
  from recipients r left join route rt on rt.product_id=r.product_id left join br on br.product_id=r.product_id left join sf on sf.product_id=r.product_id;

  select count(*),count(*) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER')),
         count(*) filter(where workload_status like 'BLOCKED%'),
         count(*) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER'))::numeric/nullif(count(*),0),
         sum(workload_units) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER'))
  into v_recipient_count,v_eligible_count,v_blocked_count,v_coverage,v_company_workload from tmp_po_product;

  if coalesce(v_eligible_count,0)=0 or coalesce(v_company_workload,0)<=0 then
    raise exception 'Production Overhead allocation requires at least one eligible Product with positive workload';
  end if;

  insert into costing.product_production_overhead_workload_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_id,product_name,product_base_uom,
    route_family_id,family_route_id,product_route_id,effective_route_source,batch_size_ref_id,preferred_batch_size,
    monthly_product_base_qty,monthly_driver_status,monthly_batch_equivalents,rounded_batch_count,effective_step_count,included_step_count,
    passive_step_count,excluded_step_count,route_factor,workload_units,workload_status,workload_reason_code,workload_note,
    recipient_product_count,ready_product_count,blocked_product_count,workload_coverage_ratio,company_ready_workload_units)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,t.product_id,t.product_name,t.product_base_uom,
         t.route_family_id,t.family_route_id,t.product_route_id,t.effective_route_source,t.batch_size_ref_id,t.preferred_batch_size,
         t.monthly_product_base_qty,t.monthly_driver_status,t.monthly_batch_equivalents,t.rounded_batch_count,coalesce(t.effective_step_count,0),
         coalesce(t.included_step_count,0),coalesce(t.passive_step_count,0),coalesce(t.excluded_step_count,0),t.route_factor,t.workload_units,
         t.workload_status,t.workload_status,
         case when t.workload_status='READY' then 'Production Overhead workload is eligible and ready for the exact-run pool allocation.'
              when t.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'Production Overhead workload is eligible using a governed monthly quantity requiring review.'
              else 'Production Overhead workload is individually blocked with zero allocation: '||t.workload_status end,
         v_recipient_count,v_eligible_count,v_blocked_count,v_coverage,v_company_workload
  from tmp_po_product t;

  insert into costing.product_production_overhead_step_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_workload_snapshot_id,product_id,sequence_no,effective_step_key,
    source_type,base_step_id,override_id,production_overhead_scope,scope_factor,behaviour_code,behaviour_factor,
    resource_class_code,resource_factor,expected_occurrence_count,standard_cycle_count,step_factor)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,s.id,s.product_id,e.sequence_no,e.effective_step_key,
         e.source_type,e.base_step_id,e.override_id,e.production_overhead_scope,sc.factor,e.behaviour_code,bh.factor,
         e.resource_class_code,rs.factor,e.expected_occurrence_count,e.standard_cycle_count,
         sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count
  from costing.product_production_overhead_workload_snapshot s
  cross join lateral costing.fn_effective_product_process_steps(s.product_id::integer,p_valuation_date) e
  join costing.production_overhead_scope_factor sc on sc.policy_id=v_policy.id and sc.scope_code=e.production_overhead_scope
  join costing.production_overhead_behaviour_factor bh on bh.policy_id=v_policy.id and bh.behaviour_code=e.behaviour_code
  join costing.production_overhead_resource_factor rs on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
  where s.refresh_run_id=p_refresh_run_id and s.family_route_id is not null;

  insert into costing.sku_production_overhead_allocation_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_workload_snapshot_id,sku_id,product_id,product_name,
    pack_size,pack_uom,sku_base_qty_per_unit,monthly_sku_base_qty,monthly_product_base_qty,sku_within_product_share,
    production_overhead_pool_amount,product_workload_share,product_production_overhead_allocation,
    production_overhead_cost_per_base_uom,production_overhead_cost_per_sku,allocation_status,allocation_reason_code,allocation_note)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,pw.id,b.sku_id,b.product_id,b.product_name,
         b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,b.monthly_allocation_base_qty,b.monthly_product_allocation_base_qty,
         case when b.monthly_product_allocation_base_qty>0 then b.monthly_allocation_base_qty/b.monthly_product_allocation_base_qty end,
         v_pool,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER') then pw.workload_units/v_company_workload else 0 end,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER') then v_pool*pw.workload_units/v_company_workload else 0 end,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER') and b.monthly_product_allocation_base_qty>0
              then (v_pool*pw.workload_units/v_company_workload)/b.monthly_product_allocation_base_qty end,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER') and b.monthly_product_allocation_base_qty>0
              then ((v_pool*pw.workload_units/v_company_workload)/b.monthly_product_allocation_base_qty)*b.sku_base_qty_per_unit end,
         case when pw.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'REVIEW_REQUIRED'
              when pw.workload_status='READY' then 'READY' else pw.workload_status end,
         pw.workload_status,
         case when pw.workload_status='READY' then 'Full Production Overhead pool is allocated across Products eligible in this exact run.'
              when pw.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'Full Production Overhead pool is allocated across current eligible Products; this Product uses a monthly quantity requiring review.'
              else 'Product is individually blocked and receives zero Production Overhead in this exact run. A later governed run may redistribute the pool after the blocker is resolved.' end
  from costing.sku_sales_allocation_basis_snapshot b
  join costing.product_production_overhead_workload_snapshot pw on pw.refresh_run_id=b.refresh_run_id and pw.product_id=b.product_id
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  select coalesce(sum(x.product_allocation),0) into v_allocated_pool
  from (
    select product_id,max(product_production_overhead_allocation) product_allocation
    from costing.sku_production_overhead_allocation_snapshot
    where refresh_run_id=p_refresh_run_id
    group by product_id
  ) x;

  return jsonb_build_object(
    'period_start',v_period_start,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,'policy_id',v_policy.id,
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