-- Candidate only: one CONCURRENTLY statement per transaction-free maintenance call; verify headroom and index validity.
-- run-column batch access
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_001" ON "costing"."cost_sheet_rm_line_traceability_snapshot" ("refresh_run_id");
-- run-column batch access
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_002" ON "costing"."material_costing_action_drilldown_snapshot" ("refresh_run_id");
-- run-column batch access
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_003" ON "costing"."costing_review_action_item_drilldown_snapshot" ("refresh_run_id");
-- run-column batch access
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_004" ON "costing"."material_costing_action_queue_snapshot" ("refresh_run_id");
-- run-column batch access
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_005" ON "costing"."costing_review_top_action_item_snapshot" ("refresh_run_id");
-- cost_sheet_line_traceability_material_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_006" ON "costing"."cost_sheet_line_traceability_snapshot" ("material_cost_snapshot_id");
-- cost_sheet_line_traceability_policy_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_007" ON "costing"."cost_sheet_line_traceability_snapshot" ("selected_scheme_policy_context_id");
-- cost_sheet_line_traceability_scheme_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_008" ON "costing"."cost_sheet_line_traceability_snapshot" ("scheme_viability_snapshot_id");
-- cost_sheet_line_monthly_snapshot_ik_policy_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_009" ON "costing"."cost_sheet_line_monthly_snapshot" ("ik_selected_scheme_policy_context_id");
-- cost_sheet_line_monthly_snapshot_ik_scheme_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_010" ON "costing"."cost_sheet_line_monthly_snapshot" ("ik_scheme_viability_snapshot_id");
-- cost_sheet_line_monthly_snapshot_material_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_011" ON "costing"."cost_sheet_line_monthly_snapshot" ("material_cost_snapshot_id");
-- cost_sheet_line_monthly_snapshot_ok_policy_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_012" ON "costing"."cost_sheet_line_monthly_snapshot" ("ok_selected_scheme_policy_context_id");
-- cost_sheet_line_monthly_snapshot_ok_scheme_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_013" ON "costing"."cost_sheet_line_monthly_snapshot" ("ok_scheme_viability_snapshot_id");
-- sku_rm_line_snapshot_material_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_014" ON "costing"."sku_rm_material_cost_line_snapshot" ("sku_material_cost_snapshot_id");
-- sku_rm_line_snapshot_product_line_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_015" ON "costing"."sku_rm_material_cost_line_snapshot" ("product_rm_material_cost_line_snapshot_id");
-- cost_sheet_rm_line_trace_material_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_016" ON "costing"."cost_sheet_rm_line_traceability_snapshot" ("sku_material_cost_snapshot_id");
-- cost_sheet_rm_line_trace_product_line_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_017" ON "costing"."cost_sheet_rm_line_traceability_snapshot" ("product_rm_material_cost_line_snapshot_id");
-- material_action_drilldown_pm_line_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_018" ON "costing"."material_costing_action_drilldown_snapshot" ("frozen_pm_line_snapshot_id");
-- material_action_drilldown_rm_line_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_019" ON "costing"."material_costing_action_drilldown_snapshot" ("frozen_rm_line_snapshot_id");
-- review_drilldown_pm_line_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_020" ON "costing"."costing_review_action_item_drilldown_snapshot" ("frozen_pm_line_snapshot_id");
-- review_drilldown_rm_line_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_021" ON "costing"."costing_review_action_item_drilldown_snapshot" ("frozen_rm_line_snapshot_id");
-- product_direct_labour_step_sn_product_workload_snapshot_id_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_022" ON "costing"."product_direct_labour_step_snapshot" ("product_workload_snapshot_id");
-- product_production_overhead_s_product_workload_snapshot_id_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_023" ON "costing"."product_production_overhead_step_snapshot" ("product_workload_snapshot_id");
-- sku_pm_material_line_material_snapshot_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_024" ON "costing"."sku_pm_material_cost_line_snapshot" ("sku_material_cost_snapshot_id");
-- product_qc_method_workload_sn_product_workload_snapshot_id_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_025" ON "costing"."product_qc_method_workload_snapshot" ("product_workload_snapshot_id");
-- sku_regional_marketing_allocation_basis_fk
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_026" ON "costing"."sku_regional_marketing_expense_allocation_snapshot" ("regional_basis_snapshot_id");
-- sku_regional_marketing_allocation_common_basis_fk
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_027" ON "costing"."sku_regional_marketing_expense_allocation_snapshot" ("common_allocation_basis_snapshot_id");
-- sku_regional_marketing_expense__marketing_pool_snapshot_id_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_028" ON "costing"."sku_regional_marketing_expense_allocation_snapshot" ("marketing_pool_snapshot_id");
-- sku_regional_marketing_basis_common_fk
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_029" ON "costing"."sku_regional_marketing_allocation_basis_snapshot" ("allocation_basis_snapshot_id");
-- fk_sku_direct_labour_packing_workload_snapshot
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_030" ON "costing"."sku_direct_labour_allocation_snapshot" ("packing_labour_workload_snapshot_id");
-- sku_direct_labour_allocation__direct_labour_pool_snapshot__fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_031" ON "costing"."sku_direct_labour_allocation_snapshot" ("direct_labour_pool_snapshot_id");
-- sku_direct_labour_allocation__product_workload_snapshot_id_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_032" ON "costing"."sku_direct_labour_allocation_snapshot" ("product_workload_snapshot_id");
-- fk_selected_scheme_context_scheme
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_033" ON "costing"."sku_selected_scheme_policy_context_snapshot" ("scheme_master_context_snapshot_id");
-- sku_marketing_expense_allocatio_marketing_pool_snapshot_id_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_034" ON "costing"."sku_marketing_expense_allocation_snapshot" ("marketing_pool_snapshot_id");
-- sku_overhead_materials_stores_pool_fk
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_035" ON "costing"."sku_overhead_allocation_snapshot" ("materials_stores_pool_snapshot_id");
-- sku_overhead_production_pool_fk
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_036" ON "costing"."sku_overhead_allocation_snapshot" ("production_pool_snapshot_id");
-- sku_overhead_quality_control_pool_fk
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_037" ON "costing"."sku_overhead_allocation_snapshot" ("quality_control_pool_snapshot_id");
-- sku_admin_finance_overhead_al_finance_admin_pool_snapshot__fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_038" ON "costing"."sku_admin_finance_overhead_allocation_snapshot" ("finance_admin_pool_snapshot_id");
-- sku_admin_finance_overhead_allocati_admin_pool_snapshot_id_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_039" ON "costing"."sku_admin_finance_overhead_allocation_snapshot" ("admin_pool_snapshot_id");
-- sku_materials_stores_workload__sku_pm_workload_snapshot_id_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_040" ON "costing"."sku_materials_stores_workload_snapshot" ("sku_pm_workload_snapshot_id");
-- sku_materials_stores_workload_product_rm_workload_snapshot_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_041" ON "costing"."sku_materials_stores_workload_snapshot" ("product_rm_workload_snapshot_id");
-- product_qc_allocation_snapsho_product_workload_snapshot_id_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_042" ON "costing"."product_qc_allocation_snapshot" ("product_workload_snapshot_id");
-- product_qc_allocation_snapsho_quality_control_pool_snapsho_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_043" ON "costing"."product_qc_allocation_snapshot" ("quality_control_pool_snapshot_id");
-- sku_packing_labour_workload_s_allocation_basis_snapshot_id_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_044" ON "costing"."sku_packing_labour_workload_snapshot" ("allocation_basis_snapshot_id");
-- sku_packing_labour_workload_s_packing_labour_component_poo_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_045" ON "costing"."sku_packing_labour_workload_snapshot" ("packing_labour_component_pool_snapshot_id");
-- sku_materials_stores_allocation_snaps_workload_snapshot_id_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_046" ON "costing"."sku_materials_stores_allocation_snapshot" ("workload_snapshot_id");
-- sku_materials_stores_allocation_snapshot_pool_snapshot_id_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_047" ON "costing"."sku_materials_stores_allocation_snapshot" ("pool_snapshot_id");
-- sku_production_overhead_alloc_product_workload_snapshot_id_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_048" ON "costing"."sku_production_overhead_allocation_snapshot" ("product_workload_snapshot_id");
-- sku_qc_allocation_snapshot_product_qc_allocation_snapshot__fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_049" ON "costing"."sku_qc_allocation_snapshot" ("product_qc_allocation_snapshot_id");
-- sku_qc_allocation_snapshot_sales_allocation_basis_snapshot_fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_050" ON "costing"."sku_qc_allocation_snapshot" ("sales_allocation_basis_snapshot_id");
-- fk_product_dl_workload_manufacturing_component_pool
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_051" ON "costing"."product_direct_labour_workload_snapshot" ("manufacturing_labour_component_pool_snapshot_id");
-- product_direct_labour_workloa_direct_labour_pool_snapshot__fkey
CREATE INDEX CONCURRENTLY IF NOT EXISTS "retention_fk_run_052" ON "costing"."product_direct_labour_workload_snapshot" ("direct_labour_pool_snapshot_id");
