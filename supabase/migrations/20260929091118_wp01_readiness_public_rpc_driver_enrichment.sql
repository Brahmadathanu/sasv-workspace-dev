-- backfilled from live schema_migrations on 2026-10-24, CI-016

create or replace function public.rpc_get_product_sku_readiness(
  p_sku_id bigint,p_period_start date,p_context_type text default 'LIVE_AS_OF',p_refresh_run_id bigint default null
) returns jsonb
language plpgsql stable security definer
set search_path=public,costing,pg_temp
as $$
declare
 v_context_type text:=upper(coalesce(nullif(btrim(p_context_type),''),'LIVE_AS_OF'));
 v_period date; v_val date; v_run bigint; v_run_status text; v_integrity text:='LIVE_GOVERNED_PERIOD';
 v_sku record; v_bom record; v_route record; v_mrp record; v_sell record; v_batch record; v_sales record; v_control record;
 v_pm text; v_sm text; v_cf text; v_ev text; v_out text; v_sev text; v_dep jsonb:='[]'; v_base jsonb;
begin
 perform public.require_permission('module:costing-control-center',false);
 if p_sku_id is null then raise exception 'SKU ID is required'; end if;
 if v_context_type not in ('LIVE_AS_OF','EXACT_RUN') then raise exception 'Invalid context type %',p_context_type; end if;
 select s.id sku_id,s.product_id,s.pack_size,s.uom,s.is_active sku_is_active,s.is_sample,p.item product_name,p.status product_status,p.uom_base,p.conversion_to_base
 into v_sku from public.product_skus s join public.products p on p.id=s.product_id where s.id=p_sku_id;
 if not found then raise exception 'SKU % not found',p_sku_id; end if;

 if v_context_type='LIVE_AS_OF' then
  if p_period_start is null then raise exception 'Costing period start is required for LIVE_AS_OF'; end if;
  v_period:=date_trunc('month',p_period_start::timestamp)::date;
  select valuation_date into v_val from costing.cost_periods where period_start=v_period;
  if v_val is null then raise exception 'Governed valuation date is missing for period %',v_period; end if;
  if p_refresh_run_id is not null then raise exception 'Refresh run ID is not accepted for LIVE_AS_OF'; end if;
  select id,overall_status into v_run,v_run_status from costing.costing_refresh_run
   where period_start=v_period and valuation_date=v_val and overall_status='SUCCESS'
   order by finished_at desc nulls last,id desc limit 1;
 else
  if p_refresh_run_id is null then raise exception 'Refresh run ID is required for EXACT_RUN'; end if;
  select r.id,r.period_start,r.valuation_date,r.overall_status,
   case when exists(select 1 from costing.costing_refresh_run_stage st where st.refresh_run_id=r.id and (st.period_start is distinct from r.period_start or st.valuation_date is distinct from r.valuation_date)) then 'MISMATCH'
        when r.valuation_context_source='LEGACY_BACKFILL' then 'LEGACY_UNVERIFIED' else 'CONSISTENT' end
  into v_run,v_period,v_val,v_run_status,v_integrity from costing.costing_refresh_run r where r.id=p_refresh_run_id;
  if v_run is null then raise exception 'Refresh run % not found',p_refresh_run_id; end if;
  if p_period_start is not null and date_trunc('month',p_period_start::timestamp)::date<>v_period then raise exception 'Supplied period does not match refresh run context'; end if;
 end if;

 v_pm:=case when v_sku.uom_base is not null and btrim(v_sku.uom_base)<>'' and v_sku.conversion_to_base>0 then 'RESOLVED' else 'BLOCKED' end;
 v_sm:=case when v_sku.pack_size>0 and nullif(btrim(v_sku.uom),'') is not null then 'RESOLVED' else 'BLOCKED' end;

 if v_context_type='LIVE_AS_OF' then
  select * into v_bom from public.plm_sku_bom_revision_as_of(p_sku_id,v_val) limit 1;
  select * into v_route from costing.fn_product_process_route_readiness(v_val) x where x.product_id=v_sku.product_id limit 1;
  select * into v_mrp from costing.fn_resolve_sku_mrp_as_of(p_sku_id,v_val) limit 1;
  select * into v_sell from costing.fn_resolve_sku_selling_price_policy_as_of(p_sku_id,v_val) limit 1;
  select * into v_batch from public.production_batch_size_ref b where b.product_id=v_sku.product_id and b.is_active and b.effective_from<=v_val and (b.effective_to is null or b.effective_to>=v_val) order by b.effective_from desc,b.id desc limit 1;
  select * into v_sales from costing.v_sku_commercial_sales_basis c where c.sku_id=p_sku_id and c.period_start=v_period and c.management_valuation_date=v_val limit 1;
  if v_run is not null then select * into v_control from costing.sku_costing_control_status_snapshot c where c.sku_id=p_sku_id and c.refresh_run_id=v_run limit 1; end if;
  v_dep:=jsonb_build_array(
   jsonb_build_object('dependency_code','PRODUCT_MASTER','label','Product master','scope','PRODUCT','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status',v_pm,'resolution_source','PRODUCT_MASTER','reason_code',case when v_pm='BLOCKED' then 'PRODUCT_BASE_UOM_CONTEXT_INVALID' end,'owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','public.products'),
   jsonb_build_object('dependency_code','SKU_MASTER','label','SKU master','scope','SKU','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status',v_sm,'resolution_source','SKU_MASTER','reason_code',case when v_sm='BLOCKED' then 'SKU_PACK_CONTEXT_INVALID' end,'owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','public.product_skus'),
   jsonb_build_object('dependency_code','PM_BOM_REVISION','label','Approved PM-BOM revision','scope','SKU_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_bom.id is null then 'BLOCKED' else 'RESOLVED' end,'resolution_source',case when v_bom.id is null then 'MISSING' else 'APPROVED_EFFECTIVE_REVISION' end,'reason_code',case when v_bom.id is null then 'PM_BOM_REVISION_MISSING' end,'owner_module','PM_BOM_MANAGER','recommended_ui_route','PM_BOM_MANAGER','authority','public.plm_sku_bom_revision_as_of','evidence_ids',jsonb_build_object('revision_id',v_bom.id)),
   jsonb_build_object('dependency_code','BATCH_SIZE_REFERENCE','label','Batch-size reference','scope','PRODUCT_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_batch.id is null then 'BLOCKED' else 'RESOLVED' end,'resolution_source',case when v_batch.id is null then 'MISSING' else 'EFFECTIVE_REFERENCE' end,'reason_code',case when v_batch.id is null then 'BATCH_SIZE_REFERENCE_MISSING' end,'owner_module','SUPPLY_BATCH_PLAN','recommended_ui_route','BATCH_SIZES','authority','public.production_batch_size_ref','evidence_ids',jsonb_build_object('reference_id',v_batch.id)),
   jsonb_build_object('dependency_code','MANUFACTURING_ROUTE','label','Manufacturing route','scope','PRODUCT_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_route.readiness_status='READY' then 'RESOLVED' else 'BLOCKED' end,'resolution_source',v_route.effective_route_source,'reason_code',case when coalesce(v_route.readiness_status,'')<>'READY' then 'MANUFACTURING_ROUTE_NOT_READY' end,'owner_module','PRODUCTION_ROUTE_MANAGER','recommended_ui_route','PRODUCTION_ROUTE_MANAGER','authority','costing.fn_product_process_route_readiness'),
   jsonb_build_object('dependency_code','MRP_POLICY','label','MRP policy','scope','SKU_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_mrp.resolution_status='RESOLVED' then 'RESOLVED' else 'BLOCKED' end,'resolution_source',v_mrp.source_type,'reason_code',case when coalesce(v_mrp.resolution_status,'MISSING')<>'RESOLVED' then 'MRP_POLICY_'||coalesce(v_mrp.resolution_status,'MISSING') end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','MRP_GOVERNANCE','authority','costing.fn_resolve_sku_mrp_as_of','evidence_ids',jsonb_build_object('policy_id',v_mrp.policy_id)),
   jsonb_build_object('dependency_code','SELLING_PRICE_POLICY','label','Selling-price/GST policy','scope','SKU_AS_OF','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_sell.resolution_status='RESOLVED' then 'RESOLVED' else 'BLOCKED' end,'resolution_source','SELLING_PRICE_POLICY','reason_code',case when coalesce(v_sell.resolution_status,'MISSING')<>'RESOLVED' then 'SELLING_POLICY_'||coalesce(v_sell.resolution_status,'MISSING') end,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','SELLING_SCHEME_POLICIES','authority','costing.fn_resolve_sku_selling_price_policy_as_of','evidence_ids',jsonb_build_object('policy_id',v_sell.policy_id)),
   jsonb_build_object('dependency_code','COMMON_COMMERCIAL_BASIS','label','Common commercial sales basis','scope','SKU_PERIOD','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',case when v_sales.sku_id is null then 'BLOCKED' when v_sales.commercial_sales_status='OK' then 'READY' when v_sales.commercial_sales_status in ('DEFAULTED','REVIEW_REQUIRED') then 'REVIEW_REQUIRED' else 'BLOCKED' end,'resolution_source',v_sales.assumption_source,'reason_code',v_sales.commercial_sales_warning,'owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','COMMERCIAL_SALES_ASSUMPTIONS','authority','costing.v_sku_commercial_sales_basis')
  );
  v_cf:=case when v_pm='BLOCKED' or v_sm='BLOCKED' or v_bom.id is null or v_batch.id is null or coalesce(v_route.readiness_status,'')<>'READY' or coalesce(v_mrp.resolution_status,'')<>'RESOLVED' or coalesce(v_sell.resolution_status,'')<>'RESOLVED' then 'BLOCKED' else 'RESOLVED' end;
  v_ev:=case when v_sales.sku_id is null then 'BLOCKED' when v_sales.commercial_sales_status='OK' then 'READY' when v_sales.commercial_sales_status in ('DEFAULTED','REVIEW_REQUIRED') then 'REVIEW_REQUIRED' else 'BLOCKED' end;
 else
  select * into v_control from costing.sku_costing_control_status_snapshot c where c.sku_id=p_sku_id and c.refresh_run_id=v_run limit 1;
  v_pm:='UNKNOWN'; v_sm:=case when v_control.sku_id is not null and v_control.pack_size>0 and nullif(btrim(v_control.pack_uom),'') is not null then 'RESOLVED' else 'UNKNOWN' end;
  v_cf:=case when v_control.sku_id is null then 'UNKNOWN' when v_control.cost_sheet_status='BLOCKED' then 'BLOCKED' else 'RESOLVED' end;
  v_ev:=case when v_control.sku_id is null then 'UNKNOWN' when v_control.control_severity='BLOCKER' then 'BLOCKED' when v_control.control_severity='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' when v_control.control_severity='READY' then 'READY' else 'UNKNOWN' end;
  v_dep:=jsonb_build_array(
   jsonb_build_object('dependency_code','PRODUCT_MASTER','label','Product master','scope','PRODUCT','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status','UNKNOWN','resolution_source','NOT_FROZEN_IN_RUN','reason_code','NOT_FROZEN_IN_RUN','owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','EXACT_RUN_FROZEN_EVIDENCE_ONLY'),
   jsonb_build_object('dependency_code','SKU_PACK_IDENTITY','label','SKU pack identity','scope','SKU_EXACT_RUN','dimension','MASTER_FOUNDATION','applicability','APPLICABLE','raw_status',v_sm,'resolution_source',case when v_control.sku_id is null then 'NO_RUN_SNAPSHOT' else 'RUN_CONTROL_SNAPSHOT' end,'owner_module','MANAGE_PRODUCTS','recommended_ui_route','MANAGE_PRODUCTS','authority','costing.sku_costing_control_status_snapshot'),
   jsonb_build_object('dependency_code','MRP_POLICY','label','MRP policy','scope','SKU_EXACT_RUN','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_control.mrp_resolution_status='RESOLVED' then 'RESOLVED' when v_control.sku_id is null then 'UNKNOWN' else 'BLOCKED' end,'resolution_source','RUN_CONTROL_SNAPSHOT','owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','MRP_GOVERNANCE','authority','costing.sku_costing_control_status_snapshot'),
   jsonb_build_object('dependency_code','SELLING_PRICE_POLICY','label','Selling-price/GST policy','scope','SKU_EXACT_RUN','dimension','COSTING_FOUNDATION','applicability','APPLICABLE','raw_status',case when v_control.selling_policy_resolution_status='RESOLVED' then 'RESOLVED' when v_control.sku_id is null then 'UNKNOWN' else 'BLOCKED' end,'resolution_source','RUN_CONTROL_SNAPSHOT','owner_module','PRICING_POLICY_MANAGER','recommended_ui_route','SELLING_SCHEME_POLICIES','authority','costing.sku_costing_control_status_snapshot'),
   jsonb_build_object('dependency_code','FINAL_COSTING_CONTROL','label','Final costing control','scope','SKU_EXACT_RUN','dimension','COSTING_OUTCOME','applicability','APPLICABLE','raw_status',coalesce(v_control.cost_sheet_status,'UNKNOWN'),'resolution_source',case when v_control.sku_id is null then 'NO_RUN_SNAPSHOT' else 'RUN_CONTROL_SNAPSHOT' end,'reason_code',v_control.first_control_status,'note',v_control.control_note,'owner_module','COSTING_CONTROL_CENTER','recommended_ui_route',v_control.recommended_ui_route,'authority','costing.sku_costing_control_status_snapshot')
  );
 end if;
 v_out:=coalesce(v_control.cost_sheet_status,'UNKNOWN');
 v_sev:=case when v_cf='BLOCKED' or v_ev='BLOCKED' or v_control.control_severity='BLOCKER' then 'BLOCKER' when v_ev='REVIEW_REQUIRED' or v_control.control_severity='REVIEW_REQUIRED' then 'REVIEW_REQUIRED' when v_control.control_severity='READY' then 'READY' else 'UNKNOWN' end;
 v_base:=jsonb_build_object(
  'context',jsonb_build_object('context_type',v_context_type,'sku_id',p_sku_id,'product_id',v_sku.product_id,'period_start',v_period,'valuation_date',v_val,'refresh_run_id',case when v_context_type='EXACT_RUN' then v_run else null end,'run_status',v_run_status,'context_integrity_status',v_integrity),
  'lifecycle',case when v_context_type='LIVE_AS_OF' then jsonb_build_object('product_status',v_sku.product_status,'sku_is_active',v_sku.sku_is_active,'sku_is_sample',v_sku.is_sample) else jsonb_build_object('status','UNKNOWN','reason_code','NOT_FROZEN_IN_RUN') end,
  'identity',jsonb_build_object('product_name',v_sku.product_name,'pack_size',case when v_context_type='EXACT_RUN' and v_control.sku_id is not null then v_control.pack_size else v_sku.pack_size end,'pack_uom',case when v_context_type='EXACT_RUN' and v_control.sku_id is not null then v_control.pack_uom else v_sku.uom end),
  'summary',jsonb_build_object('product_master_foundation_status',v_pm,'sku_master_foundation_status',v_sm,'costing_foundation_status',v_cf,'evidence_quality_status',v_ev,'costing_outcome_status',v_out,'overall_severity',v_sev),
  'dependencies',v_dep,'shared_issues','[]'::jsonb,
  'downstream_control',case when v_control.sku_id is null then null else jsonb_build_object('first_control_status',v_control.first_control_status,'control_severity',v_control.control_severity,'recommended_ui_route',v_control.recommended_ui_route,'control_note',v_control.control_note,'material_costing_status',v_control.material_costing_status,'pm_costing_status',v_control.pm_costing_status,'manufacturing_cop_status',v_control.manufacturing_cop_status,'internal_loaded_cost_status',v_control.internal_loaded_cost_status,'pricing_bridge_status',v_control.pricing_bridge_status,'selling_price_bridge_status',v_control.selling_price_bridge_status,'cost_sheet_status',v_control.cost_sheet_status,'refresh_run_id',v_control.refresh_run_id) end);
 if v_run is not null then return costing.fn_product_sku_readiness_enrich(v_base,p_sku_id,v_period,v_val,v_run); end if;
 return v_base;
end $$;
revoke execute on function public.rpc_get_product_sku_readiness(bigint,date,text,bigint) from public,anon;
grant execute on function public.rpc_get_product_sku_readiness(bigint,date,text,bigint) to authenticated,service_role;
