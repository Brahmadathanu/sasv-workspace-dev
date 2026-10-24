-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop index if exists costing.ix_internal_source_stores_product;
drop index if exists costing.product_mrp_proposal_line_applied_policy_idx;
drop index if exists costing.product_mrp_proposal_line_proposal_idx;
drop index if exists costing.idx_sku_material_cost_snapshot_refresh_run;