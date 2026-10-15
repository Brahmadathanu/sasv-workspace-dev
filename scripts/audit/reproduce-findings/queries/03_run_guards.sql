select json_build_object(
 'unguarded_snapshot_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='costing' and c.relkind='r' and c.relname like '%snapshot%' and not exists (select 1 from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal)),
 'run119_cop_rows',(select count(*) from costing.sku_manufacturing_cop_snapshot where refresh_run_id=119),
 'run119_cop_fingerprint',(select md5(string_agg(concat_ws('|',sku_id,manufacturing_cop_per_sku,direct_labour_cost_per_sku,production_overhead_cost_per_sku,material_cost_per_sku,manufacturing_cop_status),',' order by sku_id)) from costing.sku_manufacturing_cop_snapshot where refresh_run_id=119),
 'runs_success',(select count(*) from costing.costing_refresh_run where overall_status='SUCCESS'),
 'runs_failed',(select count(*) from costing.costing_refresh_run where overall_status='FAILED'),
 'run119_status',(select overall_status from costing.costing_refresh_run where id=119),
 'sep_period_status',(select status||'/'||valuation_date_status from costing.cost_periods where period_start='2026-09-01'),
 'live_only_costing_migrations',(select count(*) from supabase_migrations.schema_migrations where version between '20261014104950' and '20261015021210')) r;
