-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_resolve_product_internal_conversion_burden(
 p_source_product_id bigint,p_refresh_run_id bigint,p_visited_source_product_ids bigint[] default array[]::bigint[]
)
returns table(
 source_product_id bigint,source_product_name text,source_product_base_uom text,
 direct_manufacturing_labour_per_base numeric,direct_production_overhead_per_base numeric,
 direct_qc_overhead_per_base numeric,direct_rm_stores_overhead_per_base numeric,
 child_internal_conversion_per_base numeric,total_conversion_burden_per_base numeric,
 conversion_status text,reason_code text,evidence_json jsonb
)
language plpgsql stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
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
$function$;