-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $do$
declare v_oid oid; v_def text; v_new text;
begin
 select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='costing' and p.proname='rpc_refresh_product_qc_workload_snapshot'
   and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
 v_def:=pg_get_functiondef(v_oid);
 v_new:=regexp_replace(v_def,
   'select count\(distinct b\.product_id\)::integer\s+into v_recipient_count\s+from costing\.sku_sales_allocation_basis_snapshot b\s+where b\.period_start=v_period_start\s+and b\.valuation_date=p_valuation_date\s+and b\.refresh_run_id=p_refresh_run_id;',
   'select count(*)::integer into v_recipient_count from costing.fn_total_manufacturing_product_demand_as_of(v_period_start,p_valuation_date,p_refresh_run_id);','n');
 if v_new=v_def then raise exception 'QC recipient-count patch did not match'; end if;
 v_def:=v_new;
 v_new:=regexp_replace(v_def,
   'for v_rec in\s+select b\.product_id, max\(b\.product_name\) as product_name\s+from costing\.sku_sales_allocation_basis_snapshot b\s+where b\.period_start=v_period_start\s+and b\.valuation_date=p_valuation_date\s+and b\.refresh_run_id=p_refresh_run_id\s+group by b\.product_id\s+order by b\.product_id',
   'for v_rec in select d.product_id,d.product_name from costing.fn_total_manufacturing_product_demand_as_of(v_period_start,p_valuation_date,p_refresh_run_id) d order by d.product_id','n');
 if v_new=v_def then raise exception 'QC recipient-loop patch did not match'; end if;
 execute v_new;
end $do$;

do $do$
declare v_oid oid; v_def text; v_new text;
begin
 select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='costing' and p.proname='rpc_refresh_qc_monetary_allocation_snapshot'
   and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
 v_def:=pg_get_functiondef(v_oid);
 v_new:=regexp_replace(v_def,
   'select count\(\*\)::bigint into v_basis_product_count\s+from \(\s+select b\.product_id\s+from costing\.sku_sales_allocation_basis_snapshot b\s+where b\.refresh_run_id = p_refresh_run_id\s+and b\.period_start = v_period_start\s+and b\.valuation_date = p_valuation_date\s+group by b\.product_id\s+having count\(distinct b\.monthly_product_allocation_base_qty\) = 1\s+and count\(distinct b\.product_base_uom\) = 1\s+\) q;',
   'select count(*)::bigint into v_basis_product_count from costing.fn_total_manufacturing_product_demand_as_of(v_period_start,p_valuation_date,p_refresh_run_id);','n');
 if v_new=v_def then raise exception 'QC basis-count patch did not match'; end if;
 v_def:=v_new;
 v_new:=regexp_replace(v_def,
   'with product_basis as \(\s+select\s+b\.product_id,.*?from costing\.sku_sales_allocation_basis_snapshot b\s+where b\.refresh_run_id = p_refresh_run_id\s+and b\.period_start = v_period_start\s+and b\.valuation_date = p_valuation_date\s+group by b\.product_id\s+\)',
   E'with product_basis as (\n      select d.product_id,d.product_name,d.product_base_uom,\n             d.total_manufacturing_base_qty as product_absorption_base_qty,\n             d.demand_source as absorption_basis_source,\n             ''TOTAL_MANUFACTURING_DEMAND''::text as absorption_basis_method,\n             v_period_start as absorption_basis_source_month,\n             d.monthly_driver_status as absorption_basis_status,\n             d.demand_note as absorption_basis_note\n      from costing.fn_total_manufacturing_product_demand_as_of(v_period_start,p_valuation_date,p_refresh_run_id) d\n    )',
   'ns');
 if v_new=v_def then raise exception 'QC product_basis patch did not match'; end if;
 execute v_new;
end $do$;