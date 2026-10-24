-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Gate 11Y.10B: canonical Production Overhead route-workload cutover wiring.
-- No refresh execution and no historical backfill are performed by this migration.

alter table costing.product_production_overhead_workload_snapshot
  add column if not exists pool_snapshot_id bigint;

alter table costing.sku_production_overhead_allocation_snapshot
  add column if not exists pool_snapshot_id bigint;

-- These two canonical POH tables are empty before cutover, so lineage is mandatory from first use.
alter table costing.product_production_overhead_workload_snapshot
  alter column pool_snapshot_id set not null;

alter table costing.sku_production_overhead_allocation_snapshot
  alter column pool_snapshot_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='product_production_overhead_workload_pool_snapshot_fk'
      and conrelid='costing.product_production_overhead_workload_snapshot'::regclass
  ) then
    alter table costing.product_production_overhead_workload_snapshot
      add constraint product_production_overhead_workload_pool_snapshot_fk
      foreign key (pool_snapshot_id)
      references costing.cost_pool_monthly_snapshot(id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='sku_production_overhead_allocation_pool_snapshot_fk'
      and conrelid='costing.sku_production_overhead_allocation_snapshot'::regclass
  ) then
    alter table costing.sku_production_overhead_allocation_snapshot
      add constraint sku_production_overhead_allocation_pool_snapshot_fk
      foreign key (pool_snapshot_id)
      references costing.cost_pool_monthly_snapshot(id)
      on delete restrict;
  end if;
end $$;

create index if not exists idx_product_poh_workload_pool_snapshot
  on costing.product_production_overhead_workload_snapshot(pool_snapshot_id);
create index if not exists idx_sku_poh_allocation_pool_snapshot
  on costing.sku_production_overhead_allocation_snapshot(pool_snapshot_id);

alter table costing.sku_overhead_allocation_snapshot
  add column if not exists production_overhead_allocation_snapshot_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='sku_overhead_production_allocation_fk'
      and conrelid='costing.sku_overhead_allocation_snapshot'::regclass
  ) then
    alter table costing.sku_overhead_allocation_snapshot
      add constraint sku_overhead_production_allocation_fk
      foreign key (production_overhead_allocation_snapshot_id)
      references costing.sku_production_overhead_allocation_snapshot(id)
      on delete restrict;
  end if;
end $$;

create index if not exists idx_sku_overhead_production_allocation
  on costing.sku_overhead_allocation_snapshot(production_overhead_allocation_snapshot_id);

create or replace function costing.rpc_refresh_production_overhead_workload_snapshot(
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint
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
  v_pool_snapshot_id bigint;
  v_pool numeric;
  v_recipient_count integer;
  v_eligible_count integer;
  v_blocked_count integer;
  v_coverage numeric;
  v_company_workload numeric;
  v_allocated_pool numeric;
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

  create temporary table tmp_po_product on commit drop as
  with recipients as (
    select b.product_id,max(b.product_name) product_name,max(b.product_base_uom) product_base_uom,
           max(b.monthly_product_allocation_base_qty) monthly_product_base_qty,max(b.monthly_driver_status) monthly_driver_status
    from costing.sku_sales_allocation_basis_snapshot b
    where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id
    group by b.product_id
  ), br as (
    select distinct on (x.product_id) x.product_id,x.id batch_size_ref_id,x.preferred_batch_size
    from public.production_batch_size_ref x
    where x.is_active and x.effective_from<=p_valuation_date
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
  from recipients r
  left join route rt on rt.product_id=r.product_id
  left join br on br.product_id=r.product_id
  left join sf on sf.product_id=r.product_id;

  select count(*),count(*) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER')),
         count(*) filter(where workload_status like 'BLOCKED%'),
         count(*) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER'))::numeric/nullif(count(*),0),
         sum(workload_units) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER'))
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
    period_start,valuation_date,refresh_run_id,policy_id,pool_snapshot_id,product_workload_snapshot_id,sku_id,product_id,product_name,
    pack_size,pack_uom,sku_base_qty_per_unit,monthly_sku_base_qty,monthly_product_base_qty,sku_within_product_share,
    production_overhead_pool_amount,product_workload_share,product_production_overhead_allocation,
    production_overhead_cost_per_base_uom,production_overhead_cost_per_sku,allocation_status,allocation_reason_code,allocation_note)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,v_pool_snapshot_id,pw.id,b.sku_id,b.product_id,b.product_name,
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
              when pw.workload_status='READY' then 'READY' else 'BLOCKED' end,
         pw.workload_status,
         case when pw.workload_status='READY' then 'Full Production Overhead pool is allocated across Products eligible in this exact run.'
              when pw.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'Full Production Overhead pool is allocated across current eligible Products; this Product uses a monthly quantity requiring review.'
              else 'Product is individually blocked and receives zero Production Overhead in this exact run. A later governed run may redistribute the pool after the blocker is resolved.' end
  from costing.sku_sales_allocation_basis_snapshot b
  join costing.product_production_overhead_workload_snapshot pw
    on pw.refresh_run_id=b.refresh_run_id and pw.product_id=b.product_id
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  select coalesce(sum(x.product_allocation),0) into v_allocated_pool
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

  return jsonb_build_object(
    'period_start',v_period_start,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,'policy_id',v_policy.id,
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

create or replace function costing.rpc_refresh_sku_overhead_allocation_snapshot(
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint
)
returns table(
  refreshed_period_start date,
  inserted_row_count bigint,
  blocked_count bigint,
  review_required_count bigint,
  ready_count bigint
)
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
    v_period_start date := date_trunc('month', p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_basis_row_count bigint;
    v_basis_distinct_sku_count bigint;
    v_pool_count bigint;
    v_poh_row_count bigint;
    v_poh_distinct_sku_count bigint;
    v_qc_row_count bigint;
    v_qc_distinct_sku_count bigint;
    v_stores_row_count bigint;
    v_stores_distinct_sku_count bigint;
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
        raise exception 'Overhead allocation context does not match refresh run %', p_refresh_run_id;
    end if;

    select count(*)::bigint, count(distinct b.sku_id)::bigint
    into v_basis_row_count, v_basis_distinct_sku_count
    from costing.sku_sales_allocation_basis_snapshot b
    where b.period_start = v_period_start
      and b.valuation_date = p_valuation_date
      and b.refresh_run_id = p_refresh_run_id;

    if v_basis_row_count = 0 or v_basis_row_count <> v_basis_distinct_sku_count then
        raise exception 'Canonical sales-allocation basis missing or duplicated for refresh run %', p_refresh_run_id;
    end if;

    select count(*)::bigint into v_pool_count
    from costing.cost_pool_monthly_snapshot p
    where p.period_start = v_period_start
      and p.valuation_date = p_valuation_date
      and p.refresh_run_id = p_refresh_run_id
      and p.allocation_pool in ('PRODUCTION_OVERHEAD','QUALITY_CONTROL_OVERHEAD','MATERIALS_STORES_OVERHEAD');

    if v_pool_count <> 3 then
        raise exception 'Exactly three shared overhead pools are required for refresh run %, found %', p_refresh_run_id, v_pool_count;
    end if;

    select count(*)::bigint,count(distinct p.sku_id)::bigint
    into v_poh_row_count,v_poh_distinct_sku_count
    from costing.sku_production_overhead_allocation_snapshot p
    where p.period_start=v_period_start
      and p.valuation_date=p_valuation_date
      and p.refresh_run_id=p_refresh_run_id;

    if v_poh_row_count <> v_basis_row_count or v_poh_row_count <> v_poh_distinct_sku_count then
        raise exception 'Canonical route-workload Production Overhead SKU allocation is missing, incomplete or duplicated for refresh run %',p_refresh_run_id;
    end if;

    select count(*)::bigint, count(distinct q.sku_id)::bigint
    into v_qc_row_count, v_qc_distinct_sku_count
    from costing.sku_qc_allocation_snapshot q
    where q.period_start = v_period_start
      and q.valuation_date = p_valuation_date
      and q.refresh_run_id = p_refresh_run_id;

    if v_qc_row_count <> v_basis_row_count or v_qc_row_count <> v_qc_distinct_sku_count then
        raise exception 'Canonical effective-spec QC SKU allocation is missing, incomplete or duplicated for refresh run %', p_refresh_run_id;
    end if;

    select count(*)::bigint, count(distinct s.sku_id)::bigint
    into v_stores_row_count, v_stores_distinct_sku_count
    from costing.sku_materials_stores_allocation_snapshot s
    where s.period_start = v_period_start
      and s.valuation_date = p_valuation_date
      and s.refresh_run_id = p_refresh_run_id;

    if v_stores_row_count <> v_basis_row_count
       or v_stores_row_count <> v_stores_distinct_sku_count then
        raise exception 'Canonical Materials / Stores SKU allocation is missing, incomplete or duplicated for refresh run %', p_refresh_run_id;
    end if;

    if exists (
      select 1
      from costing.sku_production_overhead_allocation_snapshot p
      join costing.cost_pool_monthly_snapshot cp on cp.id=p.pool_snapshot_id
      where p.refresh_run_id=p_refresh_run_id
        and (
          cp.refresh_run_id is distinct from p.refresh_run_id
          or cp.valuation_date is distinct from p.valuation_date
          or cp.period_start is distinct from p.period_start
          or cp.allocation_pool is distinct from 'PRODUCTION_OVERHEAD'
          or p.production_overhead_pool_amount is distinct from cp.total_pool_amount
          or (p.allocation_status='BLOCKED' and p.production_overhead_cost_per_sku is not null)
          or (p.allocation_status<>'BLOCKED' and p.production_overhead_cost_per_sku is null)
        )
    ) then
      raise exception 'Canonical Production Overhead SKU allocation has invalid pool lineage or monetary null semantics for refresh run %',p_refresh_run_id;
    end if;

    if exists (
        select 1
        from costing.sku_materials_stores_allocation_snapshot s
        where s.period_start = v_period_start
          and s.valuation_date = p_valuation_date
          and s.refresh_run_id = p_refresh_run_id
          and (
            (s.allocation_status = 'BLOCKED' and (
                s.monthly_sku_allocation_amount is not null
                or s.materials_stores_overhead_cost_per_sku is not null
            ))
            or
            (s.allocation_status <> 'BLOCKED' and (
                s.monthly_sku_allocation_amount is null
                or s.materials_stores_overhead_cost_per_sku is null
            ))
          )
    ) then
        raise exception 'Canonical Materials / Stores SKU allocation contains invalid monetary null semantics for refresh run %', p_refresh_run_id;
    end if;

    delete from costing.sku_overhead_allocation_snapshot s
    where s.refresh_run_id = p_refresh_run_id;

    insert into costing.sku_overhead_allocation_snapshot (
        period_start,
        valuation_date,
        refresh_run_id,
        allocation_basis_snapshot_id,
        production_overhead_allocation_snapshot_id,
        quality_control_allocation_snapshot_id,
        materials_stores_allocation_snapshot_id,
        sku_id,
        product_id,
        product_name,
        pack_size,
        pack_uom,
        production_pool_snapshot_id,
        quality_control_pool_snapshot_id,
        materials_stores_pool_snapshot_id,
        production_pool_amount,
        quality_control_pool_amount,
        materials_stores_pool_amount,
        production_overhead_cost_per_sku,
        quality_control_overhead_cost_per_sku,
        materials_stores_overhead_cost_per_sku,
        allocation_basis_source,
        allocation_resolution_status,
        allocation_resolution_note,
        production_overhead_allocation_status,
        quality_control_overhead_allocation_status,
        materials_stores_overhead_allocation_status,
        refreshed_at
    )
    select
        b.period_start,
        b.valuation_date,
        b.refresh_run_id,
        b.id,
        poh.id,
        q.id,
        msa.id,
        b.sku_id,
        b.product_id,
        b.product_name,
        b.pack_size,
        b.pack_uom,
        poh.pool_snapshot_id,
        qc.id,
        ms.id,
        poh.production_overhead_pool_amount,
        qc.total_pool_amount,
        ms.total_pool_amount,
        poh.production_overhead_cost_per_sku,
        q.quality_control_overhead_cost_per_sku,
        msa.materials_stores_overhead_cost_per_sku,
        b.allocation_basis_source,
        b.allocation_resolution_status,
        b.allocation_resolution_note,
        poh.allocation_status,
        q.allocation_status,
        msa.allocation_status,
        clock_timestamp()
    from costing.sku_sales_allocation_basis_snapshot b
    join costing.sku_production_overhead_allocation_snapshot poh
      on poh.refresh_run_id=b.refresh_run_id
     and poh.sku_id=b.sku_id
    join costing.cost_pool_monthly_snapshot qc
      on qc.refresh_run_id = b.refresh_run_id
     and qc.allocation_pool = 'QUALITY_CONTROL_OVERHEAD'
    join costing.cost_pool_monthly_snapshot ms
      on ms.refresh_run_id = b.refresh_run_id
     and ms.allocation_pool = 'MATERIALS_STORES_OVERHEAD'
    join costing.sku_qc_allocation_snapshot q
      on q.refresh_run_id = b.refresh_run_id
     and q.sku_id = b.sku_id
    join costing.sku_materials_stores_allocation_snapshot msa
      on msa.refresh_run_id = b.refresh_run_id
     and msa.sku_id = b.sku_id
    where b.period_start = v_period_start
      and b.valuation_date = p_valuation_date
      and b.refresh_run_id = p_refresh_run_id;

    if exists (
      select 1
      from costing.sku_overhead_allocation_snapshot oh
      join costing.sku_production_overhead_allocation_snapshot poh
        on poh.id=oh.production_overhead_allocation_snapshot_id
      where oh.refresh_run_id=p_refresh_run_id
        and (
          oh.production_overhead_cost_per_sku is distinct from poh.production_overhead_cost_per_sku
          or oh.production_overhead_allocation_status is distinct from poh.allocation_status
          or oh.production_pool_snapshot_id is distinct from poh.pool_snapshot_id
          or oh.production_pool_amount is distinct from poh.production_overhead_pool_amount
        )
    ) then
      raise exception 'Combined overhead does not reconcile to canonical Production Overhead allocation for refresh run %',p_refresh_run_id;
    end if;

    if exists (
        select 1
        from costing.sku_overhead_allocation_snapshot oh
        join costing.sku_materials_stores_allocation_snapshot msa
          on msa.id = oh.materials_stores_allocation_snapshot_id
        where oh.refresh_run_id = p_refresh_run_id
          and (
            oh.materials_stores_overhead_cost_per_sku
                is distinct from msa.materials_stores_overhead_cost_per_sku
            or oh.materials_stores_overhead_allocation_status
                is distinct from msa.allocation_status
            or oh.materials_stores_pool_snapshot_id
                is distinct from msa.pool_snapshot_id
            or oh.materials_stores_pool_amount
                is distinct from msa.frozen_pool_amount
          )
    ) then
        raise exception 'Combined overhead does not reconcile to canonical Materials / Stores allocation for refresh run %', p_refresh_run_id;
    end if;

    return query
    select
        v_period_start,
        count(*)::bigint,
        count(*) filter (
            where s.production_overhead_allocation_status = 'BLOCKED'
               or s.quality_control_overhead_allocation_status = 'BLOCKED'
               or s.materials_stores_overhead_allocation_status = 'BLOCKED'
        )::bigint,
        count(*) filter (
            where s.production_overhead_allocation_status = 'REVIEW_REQUIRED'
               or s.quality_control_overhead_allocation_status = 'REVIEW_REQUIRED'
               or s.materials_stores_overhead_allocation_status = 'REVIEW_REQUIRED'
        )::bigint,
        count(*) filter (
            where s.production_overhead_allocation_status = 'READY'
              and s.quality_control_overhead_allocation_status = 'READY'
              and s.materials_stores_overhead_allocation_status = 'READY'
        )::bigint
    from costing.sku_overhead_allocation_snapshot s
    where s.refresh_run_id = p_refresh_run_id;
end;
$function$;

-- Direct Labour: permit only governed Stage 03 RUNNING context (or already-successful diagnostic context)
-- and read the exact frozen run pool rather than the live monthly view.
do $$
declare
  v_oid oid;
  v_def text;
  v_old text;
  v_new text;
begin
  select p.oid,pg_get_functiondef(p.oid)
  into v_oid,v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_refresh_sku_direct_labour_allocation_snapshot'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

  if v_oid is null then raise exception 'Canonical Direct Labour writer not found'; end if;

  v_old := 'if v_run.overall_status<>''SUCCESS'' then raise exception ''Direct Labour snapshots may be built only for a successful refresh run''; end if;';
  v_new := $x$if not (
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
    raise exception 'Direct Labour snapshots require governed Stage 03 RUNNING context or an already-successful exact run';
  end if;$x$;

  if position(v_old in v_def)=0 then
    raise exception 'Expected Direct Labour status guard was not found; refusing unsafe patch';
  end if;
  v_def := replace(v_def,v_old,v_new);

  v_old := $x$select total_pool_amount into v_pool from costing.v_cost_pool_monthly_combined
  where period_start=v_period_start and allocation_pool='DIRECT_LABOUR';
  if v_pool is null then raise exception 'Direct Labour pool is missing for period %',v_period_start; end if;$x$;
  v_new := $x$select total_pool_amount into v_pool from costing.cost_pool_monthly_snapshot
  where period_start=v_period_start
    and valuation_date=p_valuation_date
    and refresh_run_id=p_refresh_run_id
    and allocation_pool='DIRECT_LABOUR';
  if v_pool is null then raise exception 'Direct Labour frozen pool is missing for exact run %',p_refresh_run_id; end if;$x$;

  if position(v_old in v_def)=0 then
    raise exception 'Expected Direct Labour live-pool read was not found; refusing unsafe patch';
  end if;
  v_def := replace(v_def,v_old,v_new);

  execute v_def;
end $$;

-- Stage 03 manufacturing chain: freeze all seven pools first, then canonical DL + POH workload snapshots.
do $$
declare
  v_oid oid;
  v_def text;
  v_dl_call text := 'perform * from costing.rpc_refresh_sku_direct_labour_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);';
  v_pool_call text := 'perform * from costing.rpc_refresh_cost_pool_monthly_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);';
  v_insert text;
begin
  select p.oid,pg_get_functiondef(p.oid)
  into v_oid,v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='costing'
    and p.proname='rpc_refresh_manufacturing_cop_chain'
    and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

  if v_oid is null then raise exception 'Canonical manufacturing CoP chain not found'; end if;
  if position(v_dl_call in v_def)=0 or position(v_pool_call in v_def)=0 then
    raise exception 'Expected DL/pool calls not found in manufacturing chain; refusing unsafe patch';
  end if;
  if position('rpc_refresh_production_overhead_workload_snapshot' in v_def)>0 then
    raise exception 'Manufacturing chain already contains POH workload call; manual review required';
  end if;

  v_def := replace(v_def,v_pool_call,'');
  v_insert := v_pool_call || E'\n        ' || v_dl_call || E'\n        perform costing.rpc_refresh_production_overhead_workload_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);';
  v_def := replace(v_def,v_dl_call,v_insert);

  v_def := replace(
    v_def,
    '-- Combined overhead consumes canonical QC and Materials / Stores allocations.\n        -- Production Overhead remains on its current provisional formula pending its own driver workstream.',
    '-- Combined overhead consumes canonical route-workload Production Overhead plus canonical QC and Materials / Stores allocations.'
  );

  execute v_def;
end $$;
