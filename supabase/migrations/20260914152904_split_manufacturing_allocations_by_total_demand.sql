-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $do$
declare v_oid oid; v_def text; v_count int;
begin
 select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='costing' and p.proname='rpc_refresh_sku_direct_labour_component_split_snapshot'
   and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
 v_def:=pg_get_functiondef(v_oid);
 v_count:=(length(v_def)-length(replace(v_def,'b.monthly_product_allocation_base_qty','')))/length('b.monthly_product_allocation_base_qty');
 if v_count<>10 then raise exception 'Unexpected DL denominator occurrence count %',v_count; end if;
 execute replace(v_def,'b.monthly_product_allocation_base_qty','pw.monthly_product_base_qty');
end $do$;

do $do$
declare v_oid oid; v_def text; v_new text; v_count int;
begin
 select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='costing' and p.proname='rpc_refresh_production_overhead_workload_snapshot'
   and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';
 v_def:=pg_get_functiondef(v_oid);
 v_count:=(length(v_def)-length(replace(v_def,'b.monthly_product_allocation_base_qty','')))/length('b.monthly_product_allocation_base_qty');
 if v_count<>7 then raise exception 'Unexpected POH denominator occurrence count %',v_count; end if;
 v_def:=replace(v_def,'b.monthly_product_allocation_base_qty','pw.monthly_product_base_qty');
 v_new:=regexp_replace(v_def,
   'select coalesce\(sum\(x\.product_allocation\),0\) into v_allocated_pool\s+from \(\s+select product_id,max\(product_production_overhead_allocation\) product_allocation\s+from costing\.sku_production_overhead_allocation_snapshot\s+where refresh_run_id=p_refresh_run_id\s+group by product_id\s+\) x;',
   E'select coalesce(sum(x.product_allocation),0)\n    + coalesce((select sum(v_pool*w.workload_units/nullif(w.company_ready_workload_units,0))\n                from costing.product_production_overhead_workload_snapshot w\n                where w.refresh_run_id=p_refresh_run_id\n                  and w.workload_status in (''READY'',''REVIEW_REQUIRED_MONTHLY_DRIVER'',''READY_ZERO_PRODUCTION_OVERHEAD'')\n                  and not exists (select 1 from costing.sku_sales_allocation_basis_snapshot b where b.refresh_run_id=p_refresh_run_id and b.product_id=w.product_id)),0)\n    into v_allocated_pool\n    from (\n      select product_id,max(product_production_overhead_allocation) product_allocation\n      from costing.sku_production_overhead_allocation_snapshot\n      where refresh_run_id=p_refresh_run_id\n      group by product_id\n    ) x;',
   'n');
 if v_new=v_def then raise exception 'POH reconciliation patch did not match'; end if;
 execute v_new;
end $do$;