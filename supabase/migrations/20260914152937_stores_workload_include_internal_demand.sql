-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $do$
declare v_oid oid; v_def text; v_new text;
begin
 select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='costing' and p.proname='rpc_refresh_materials_stores_workload_snapshot'
   and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
 v_def:=pg_get_functiondef(v_oid);
 v_new:=regexp_replace(v_def,
   'with recipients as \(\s+select distinct b\.product_id, b\.product_name, b\.product_base_uom\s+from costing\.sku_sales_allocation_basis_snapshot b\s+where b\.period_start = v_period_start\s+and b\.valuation_date = p_valuation_date\s+and b\.refresh_run_id = p_refresh_run_id\s+\),',
   E'with recipients as (\n        select d.product_id,d.product_name,d.product_base_uom\n        from costing.fn_total_manufacturing_product_demand_as_of(v_period_start,p_valuation_date,p_refresh_run_id) d\n    ),',
   'n');
 if v_new=v_def then raise exception 'Stores RM recipient patch did not match'; end if;
 v_def:=v_new;
 v_new:=regexp_replace(v_def,
   'select refresh_run_id, sum\(unified_workload_units\) filter \(where allocation_status <> ''BLOCKED''\) as company_eligible_workload_units\s+from costing\.sku_materials_stores_workload_snapshot\s+where refresh_run_id = p_refresh_run_id\s+group by refresh_run_id',
   E'select p_refresh_run_id as refresh_run_id,\n               coalesce((select sum(w.unified_workload_units) from costing.sku_materials_stores_workload_snapshot w where w.refresh_run_id=p_refresh_run_id and w.allocation_status <> ''BLOCKED''),0)\n               + coalesce((\n                   select sum(rm.rm_complexity_units*d.monthly_internal_demand_base_qty/nullif(rm.rm_reference_output_qty,0))\n                   from costing.fn_internal_source_product_demand_as_of(v_period_start,p_valuation_date,p_refresh_run_id) d\n                   join costing.product_rm_stores_workload_snapshot rm on rm.refresh_run_id=p_refresh_run_id and rm.product_id=d.source_product_id\n                   where rm.rm_evidence_status <> ''BLOCKED'' and rm.required_rm_line_count>0\n                     and rm.rm_reference_output_qty>0 and d.monthly_internal_demand_base_qty>0\n               ),0) as company_eligible_workload_units',
   'n');
 if v_new=v_def then raise exception 'Stores company workload denominator patch did not match'; end if;
 execute v_new;
end $do$;