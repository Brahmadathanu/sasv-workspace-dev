-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke insert, update, delete on table costing.sku_materials_stores_allocation_snapshot from service_role;
revoke insert, update, delete on table costing.sku_regional_commercial_sales_assumption from service_role;

revoke execute on function costing.rpc_refresh_marketing_regional_sales_evidence_snapshot(date) from service_role;
revoke execute on function costing.rpc_refresh_marketing_regional_sales_evidence_snapshot(date,date,bigint) from service_role;
revoke execute on function costing.rpc_refresh_marketing_signed_billed_sales_evidence_snapshot(date) from service_role;
revoke execute on function costing.rpc_refresh_marketing_signed_billed_sales_evidence_snapshot(date,date,bigint) from service_role;
revoke execute on function costing.rpc_refresh_materials_stores_allocation_snapshot(date,date,bigint) from service_role;
revoke execute on function costing.rpc_refresh_materials_stores_workload_snapshot(date,date,bigint) from service_role;
revoke execute on function costing.rpc_refresh_production_overhead_workload_snapshot(date,date,bigint) from service_role;
revoke execute on function costing.rpc_refresh_sku_marketing_expense_allocation_snapshot(date,date,bigint) from service_role;
revoke execute on function costing.rpc_refresh_sku_overhead_allocation_snapshot(date,date,bigint) from service_role;

create trigger trg_product_rm_stores_workload_mutable_run
before insert or update or delete on costing.product_rm_stores_workload_snapshot
for each row execute function costing.fn_enforce_mutable_refresh_run_snapshot();

create trigger trg_sku_pm_stores_workload_mutable_run
before insert or update or delete on costing.sku_pm_stores_workload_snapshot
for each row execute function costing.fn_enforce_mutable_refresh_run_snapshot();

create trigger trg_sku_materials_stores_workload_mutable_run
before insert or update or delete on costing.sku_materials_stores_workload_snapshot
for each row execute function costing.fn_enforce_mutable_refresh_run_snapshot();

create trigger trg_sku_materials_stores_allocation_mutable_run
before insert or update or delete on costing.sku_materials_stores_allocation_snapshot
for each row execute function costing.fn_enforce_mutable_refresh_run_snapshot();

create trigger trg_product_internal_source_materials_stores_allocation_mutable_run
before insert or update or delete on costing.product_internal_source_materials_stores_allocation_snapshot
for each row execute function costing.fn_enforce_mutable_refresh_run_snapshot();