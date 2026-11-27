-- R4 INDEX CANDIDATES — NOT APPLIED. Each statement supports the child side of a nested snapshot->snapshot foreign key whose PARENT is purged
-- (PostgreSQL probes the child for every deleted parent row; an unindexed child makes that a sequential scan per parent row).
-- Repository evidence only: leading_index_in_repo=false for every column below. Decision rule per child, using PREFLIGHT_06 (live size/rows/indexes):
--   index when estimated child rows > 50,000 or relation size > 32 MB, or the child itself is purged by the same run (then its run-column index is the access path);
--   waive (index_waiver_reason) only when live shows both parent and child are small and a seq scan costs under ~50 ms.
-- Operational: one statement per transaction-free call (CONCURRENTLY), outside a transaction block, off-peak, check free disk >= 1.2x the estimated index size,
-- and WAL headroom (live: 1 GB WAL, max_wal_size 4 GB, zero slots). Never reflexively index all of them. ChatGPT/owner approve the final set from live data.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_dlcps_pool_snapshot ON costing.direct_labour_component_pool_snapshot (direct_labour_pool_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_pdlws_labour_pool_snapshot ON costing.product_direct_labour_workload_snapshot (manufacturing_labour_component_pool_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_spacklws_labour_pool_snapshot ON costing.sku_packing_labour_workload_snapshot (packing_labour_component_pool_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_spacklws_sales_basis_snapshot ON costing.sku_packing_labour_workload_snapshot (allocation_basis_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_pdlss_workload_snapshot ON costing.product_direct_labour_step_snapshot (product_workload_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_ppohss_workload_snapshot ON costing.product_production_overhead_step_snapshot (product_workload_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_spohas_workload_snapshot ON costing.sku_production_overhead_allocation_snapshot (product_workload_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_pqas_workload_snapshot ON costing.product_qc_allocation_snapshot (product_workload_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_pqas_qc_pool_snapshot ON costing.product_qc_allocation_snapshot (quality_control_pool_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_pqmws_workload_snapshot ON costing.product_qc_method_workload_snapshot (product_workload_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_sqas_product_qc_alloc_snapshot ON costing.sku_qc_allocation_snapshot (product_qc_allocation_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_sqas_sales_basis_snapshot ON costing.sku_qc_allocation_snapshot (sales_allocation_basis_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_smsas_pool_snapshot ON costing.sku_materials_stores_allocation_snapshot (pool_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_smsas_workload_snapshot ON costing.sku_materials_stores_allocation_snapshot (workload_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_smswls_rm_workload_snapshot ON costing.sku_materials_stores_workload_snapshot (product_rm_workload_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_smswls_pm_workload_snapshot ON costing.sku_materials_stores_workload_snapshot (sku_pm_workload_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_sohas_production_pool_snapshot ON costing.sku_overhead_allocation_snapshot (production_pool_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_sdlas_packing_workload_snapshot ON costing.sku_direct_labour_allocation_snapshot (packing_labour_workload_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_spbps_bridge_snapshot ON costing.sku_pricing_bridge_profit_snapshot (pricing_bridge_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_srmeas_regional_basis_snapshot ON costing.sku_regional_marketing_expense_allocation_snapshot (regional_basis_snapshot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_srmeas_common_basis_snapshot ON costing.sku_regional_marketing_expense_allocation_snapshot (common_allocation_basis_snapshot_id);
-- Already indexed in the repository (no action): sku_overhead_allocation_snapshot.{materials_stores_allocation_snapshot_id,production_overhead_allocation_snapshot_id,quality_control_allocation_snapshot_id},
-- sku_production_overhead_allocation_snapshot.pool_snapshot_id, product_production_overhead_workload_snapshot.pool_snapshot_id.
-- Run-column access paths (WHERE refresh_run_id = $1) are separate: PREFLIGHT_06 reports run_column_indexed for every live direct relation; the purge refuses
-- unindexed large relations without a recorded waiver.
