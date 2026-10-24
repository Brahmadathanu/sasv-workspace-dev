-- ==== costing.fn_resolve_product_internal_conversion_burden(bigint,bigint,bigint[])
CREATE OR REPLACE FUNCTION costing.fn_resolve_product_internal_conversion_burden(p_source_product_id bigint, p_refresh_run_id bigint, p_visited_source_product_ids bigint[] DEFAULT ARRAY[]::bigint[])
 RETURNS TABLE(source_product_id bigint, source_product_name text, source_product_base_uom text, direct_manufacturing_labour_per_base numeric, direct_production_overhead_per_base numeric, direct_qc_overhead_per_base numeric, direct_rm_stores_overhead_per_base numeric, child_internal_conversion_per_base numeric, total_conversion_burden_per_base numeric, conversion_status text, reason_code text, evidence_json jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
 v_run costing.costing_refresh_run%rowtype;
 v_name text; v_product_status text; v_base_uom text; v_base_qty numeric; v_demand_status text; v_demand_source text;
 v_dl numeric; v_poh numeric; v_qc numeric; v_stores numeric; v_child_total numeric:=0; v_direct numeric;
 v_dl_status text; v_poh_status text; v_qc_status text; v_stores_status text;
 v_blocked boolean:=false; v_review boolean:=false; v_rec record; v_child record; v_evidence jsonb:='[]'::jsonb;
begin
 if p_source_product_id is null or p_refresh_run_id is null then raise exception 'source_product_id and refresh_run_id are required'; end if;
 select * into v_run from costing.costing_refresh_run r where r.id=p_refresh_run_id;
 if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;
 if p_source_product_id=any(coalesce(p_visited_source_product_ids,array[]::bigint[])) then
   return query select p_source_product_id,null::text,null::text,null::numeric,null::numeric,null::numeric,null::numeric,
     null::numeric,null::numeric,'BLOCKED'::text,'INTERNAL_CONVERSION_CYCLE'::text,
     jsonb_build_array(jsonb_build_object('visited',p_visited_source_product_ids,'source_product_id',p_source_product_id)); return;
 end if;
 select p.item,p.status into v_name,v_product_status from public.products p where p.id=p_source_product_id;
 if v_product_status is distinct from 'Active' then
   return query select p_source_product_id,v_name,null::text,null::numeric,null::numeric,null::numeric,null::numeric,
     null::numeric,null::numeric,'BLOCKED'::text,'INTERNAL_SOURCE_PRODUCT_INACTIVE'::text,
     jsonb_build_array(jsonb_build_object('product_status',v_product_status)); return;
 end if;

 select d.product_base_uom,d.total_manufacturing_base_qty,d.monthly_driver_status,d.demand_source
 into v_base_uom,v_base_qty,v_demand_status,v_demand_source
 from costing.fn_total_manufacturing_product_demand_as_of(v_run.period_start,v_run.valuation_date,p_refresh_run_id) d
 where d.product_id=p_source_product_id;
 if v_base_uom is null or v_base_qty is null or v_base_qty<=0 then
   return query select p_source_product_id,v_name,v_base_uom,null::numeric,null::numeric,null::numeric,null::numeric,
     null::numeric,null::numeric,'BLOCKED'::text,'MISSING_SOURCE_PRODUCT_ABSORPTION_BASIS'::text,'[]'::jsonb; return;
 end if;
 if v_demand_status='BLOCKED' then v_blocked:=true; elsif v_demand_status='REVIEW_REQUIRED' then v_review:=true; end if;

 select case when w.product_direct_labour_allocation is not null and v_base_qty>0 then w.product_direct_labour_allocation/v_base_qty end,w.workload_status
 into v_dl,v_dl_status
 from costing.product_direct_labour_workload_snapshot w
 where w.refresh_run_id=p_refresh_run_id and w.product_id=p_source_product_id;
 if v_dl is null or coalesce(v_dl_status,'BLOCKED') like 'BLOCKED%' then v_blocked:=true;
 elsif v_dl_status like 'REVIEW_REQUIRED%' then v_review:=true; end if;

 select case when w.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD')
                  and w.company_ready_workload_units>0 and v_base_qty>0
             then p.total_pool_amount*w.workload_units/w.company_ready_workload_units/v_base_qty end,
        w.workload_status
 into v_poh,v_poh_status
 from costing.product_production_overhead_workload_snapshot w
 join costing.cost_pool_monthly_snapshot p on p.id=w.pool_snapshot_id and p.refresh_run_id=w.refresh_run_id
 where w.refresh_run_id=p_refresh_run_id and w.product_id=p_source_product_id;
 if v_poh is null or coalesce(v_poh_status,'BLOCKED') like 'BLOCKED%' then v_blocked:=true;
 elsif v_poh_status like 'REVIEW_REQUIRED%' then v_review:=true; end if;

 select q.qc_cost_per_product_base_uom,q.allocation_status into v_qc,v_qc_status
 from costing.product_qc_allocation_snapshot q
 where q.refresh_run_id=p_refresh_run_id and q.product_id=p_source_product_id;
 if v_qc is null or coalesce(v_qc_status,'BLOCKED')='BLOCKED' then v_blocked:=true;
 elsif v_qc_status='REVIEW_REQUIRED' then v_review:=true; end if;

 select s.materials_stores_cost_per_base_uom,s.allocation_status into v_stores,v_stores_status
 from costing.product_internal_source_materials_stores_allocation_snapshot s
 where s.refresh_run_id=p_refresh_run_id and s.source_product_id=p_source_product_id;
 if v_stores is null or coalesce(v_stores_status,'BLOCKED')='BLOCKED' then v_blocked:=true;
 elsif v_stores_status='REVIEW_REQUIRED' then v_review:=true; end if;

 v_direct:=case when v_blocked then null else coalesce(v_dl,0)+coalesce(v_poh,0)+coalesce(v_qc,0)+coalesce(v_stores,0) end;
 v_evidence:=v_evidence||jsonb_build_array(jsonb_build_object(
   'absorption_base_qty',v_base_qty,'product_base_uom',v_base_uom,'demand_source',v_demand_source,'demand_status',v_demand_status,
   'direct_manufacturing_labour_per_base',v_dl,'direct_labour_status',v_dl_status,
   'direct_production_overhead_per_base',v_poh,'production_overhead_status',v_poh_status,
   'direct_qc_overhead_per_base',v_qc,'qc_status',v_qc_status,
   'direct_rm_stores_overhead_per_base',v_stores,'stores_status',v_stores_status));

 for v_rec in
   select l.qty_purchase_form_per_base_unit,il.source_product_id child_source_product_id,l.purchase_stock_item_id,l.purchase_stock_item_name
   from costing.product_rm_material_cost_line_snapshot l
   join costing.internal_material_source_lineage il
     on il.consume_stock_item_id=l.purchase_stock_item_id and il.status='APPROVED'
    and il.effective_from<=v_run.valuation_date and (il.effective_to is null or il.effective_to>=v_run.valuation_date)
   where l.refresh_run_id=p_refresh_run_id and l.product_id=p_source_product_id and coalesce(l.is_optional,false)=false
 loop
   select * into v_child from costing.fn_resolve_product_internal_conversion_burden(
     v_rec.child_source_product_id,p_refresh_run_id,coalesce(p_visited_source_product_ids,array[]::bigint[])||p_source_product_id);
   if v_rec.qty_purchase_form_per_base_unit is null or v_child.total_conversion_burden_per_base is null or v_child.conversion_status='BLOCKED' then
     v_blocked:=true;
   else
     v_child_total:=v_child_total+v_rec.qty_purchase_form_per_base_unit*v_child.total_conversion_burden_per_base;
     if v_child.conversion_status='REVIEW_REQUIRED' then v_review:=true; end if;
   end if;
   v_evidence:=v_evidence||jsonb_build_array(jsonb_build_object(
     'child_stock_item_id',v_rec.purchase_stock_item_id,'child_source_product_id',v_rec.child_source_product_id,
     'qty_per_source_base',v_rec.qty_purchase_form_per_base_unit,'child_conversion_per_base',v_child.total_conversion_burden_per_base,
     'child_status',v_child.conversion_status));
 end loop;

 if v_blocked then
   return query select p_source_product_id,v_name,v_base_uom,v_dl,v_poh,v_qc,v_stores,v_child_total,null::numeric,
     'BLOCKED'::text,'INTERNAL_SOURCE_CONVERSION_BLOCKED'::text,v_evidence;
 elsif v_review then
   return query select p_source_product_id,v_name,v_base_uom,v_dl,v_poh,v_qc,v_stores,v_child_total,
     coalesce(v_direct,0)+v_child_total,'REVIEW_REQUIRED'::text,'INTERNAL_SOURCE_CONVERSION_REVIEW_REQUIRED'::text,v_evidence;
 else
   return query select p_source_product_id,v_name,v_base_uom,v_dl,v_poh,v_qc,v_stores,v_child_total,
     coalesce(v_direct,0)+v_child_total,'READY'::text,'READY_INTERNAL_SOURCE_CONVERSION'::text,v_evidence;
 end if;
end;
$function$
;

-- ==== costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint)
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
