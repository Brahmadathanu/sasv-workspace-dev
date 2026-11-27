-- READ-ONLY live preflight 01: acceptance baseline counts and source parity (R2A/R2B/R2C gate). Re-query immediately before each apply.
SELECT 'regional_acceptance_rows' k,count(*) v FROM costing.regional_marketing_evidence_acceptance          -- baseline 727
UNION ALL SELECT 'sales_acceptance_rows',count(*) FROM costing.sales_allocation_quantity_driver_acceptance   -- baseline 245
UNION ALL SELECT 'regional_active',count(*) FROM costing.regional_marketing_evidence_acceptance WHERE acceptance_status='ACTIVE'
UNION ALL SELECT 'sales_active',count(*) FROM costing.sales_allocation_quantity_driver_acceptance WHERE acceptance_status='ACTIVE'
UNION ALL SELECT 'regional_source_missing',count(*) FROM costing.regional_marketing_evidence_acceptance a LEFT JOIN costing.sku_regional_marketing_expense_allocation_snapshot e ON e.id=a.regional_marketing_snapshot_id LEFT JOIN costing.sku_regional_marketing_allocation_basis_snapshot b ON b.id=a.regional_basis_snapshot_id WHERE e.id IS NULL OR b.id IS NULL
UNION ALL SELECT 'sales_source_missing',count(*) FROM costing.sales_allocation_quantity_driver_acceptance a LEFT JOIN costing.sku_sales_allocation_basis_snapshot b ON b.id=a.source_snapshot_id WHERE b.id IS NULL;
-- Covered-field parity: BLOCKER must be 0. INFO rows (uncovered fields drifted after RPC renewal) are expected and recorded, not blocking.
-- After R2A is installed use: SELECT severity,finding,count(*) FROM costing_retention.fn_acceptance_source_findings_raw() GROUP BY 1,2;
-- Before R2A (pure SQL, no objects needed): same predicate as R2A's blocker rule, regional then sales
SELECT 'regional_blockers' k,count(*) v FROM costing.regional_marketing_evidence_acceptance a
JOIN costing.sku_regional_marketing_expense_allocation_snapshot e ON e.id=a.regional_marketing_snapshot_id
JOIN costing.sku_regional_marketing_allocation_basis_snapshot b ON b.id=a.regional_basis_snapshot_id
WHERE (a.source_refresh_run_id,a.sku_id,a.product_id,a.region_code,a.source_valuation_date,a.period_start,a.regional_basis_snapshot_id,a.regional_basis_source,a.resolved_regional_units,a.resolved_regional_base_qty,a.regional_assumption_id,a.regional_default_policy_id,a.regional_default_scenario,a.marketing_value_source,a.resolved_product_region_marketing_sales_value,a.marketing_expense_cost_per_sku_region)
  IS DISTINCT FROM (e.refresh_run_id,e.sku_id,e.product_id,e.region_code,e.valuation_date,e.period_start,e.regional_basis_snapshot_id,e.regional_basis_source,e.resolved_regional_units,e.resolved_regional_base_qty,b.regional_assumption_id,b.regional_default_policy_id,b.regional_default_scenario,e.marketing_value_source,e.resolved_product_region_marketing_sales_value,e.marketing_expense_cost_per_sku_region)
 OR a.evidence_fingerprint IS DISTINCT FROM costing.fn_regional_marketing_evidence_fingerprint(e.sku_id,e.product_id,e.region_code,e.valuation_date,e.regional_basis_source,e.resolved_regional_units,e.resolved_regional_base_qty,b.regional_assumption_id,b.regional_default_policy_id,b.regional_default_scenario,e.marketing_value_source,e.resolved_product_region_marketing_sales_value,e.marketing_expense_cost_per_sku_region)
UNION ALL
SELECT 'sales_blockers',count(*) FROM costing.sales_allocation_quantity_driver_acceptance a JOIN costing.sku_sales_allocation_basis_snapshot b ON b.id=a.source_snapshot_id
WHERE (a.source_refresh_run_id,a.sku_id,a.product_id,a.source_valuation_date,a.period_start,a.monthly_driver_method,a.monthly_driver_source,a.monthly_driver_source_month,a.assumption_id,a.default_policy_id,a.default_policy_scenario,a.resolved_monthly_units,a.resolved_monthly_base_qty)
  IS DISTINCT FROM (b.refresh_run_id,b.sku_id,b.product_id,b.valuation_date,b.period_start,b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty)
 OR a.evidence_fingerprint IS DISTINCT FROM costing.fn_sales_allocation_quantity_driver_fingerprint(b.sku_id,b.product_id,b.valuation_date,b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty);
-- Exactly the three legacy FKs must exist (R2C gate)
SELECT conname,conrelid::regclass::text tbl,confrelid::regclass::text referenced FROM pg_constraint WHERE contype='f' AND conname IN
 ('regional_marketing_evidence_a_regional_marketing_snapshot__fkey','regional_marketing_evidence_acc_regional_basis_snapshot_id_fkey','sales_allocation_quantity_driver_accept_source_snapshot_id_fkey');
-- Current approvals that must be unchanged by every step (pricing authority): expect Oct 143 and Sep 122
SELECT period_start,displayed_run_id,approved_run_id,display_state FROM costing.v_costing_period_run_status ORDER BY period_start;
