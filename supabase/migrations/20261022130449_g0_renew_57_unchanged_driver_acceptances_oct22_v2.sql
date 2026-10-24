-- backfilled from live schema_migrations on 2026-10-24, CI-016
DO $g$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count
 FROM costing.sku_sales_allocation_basis_snapshot b JOIN costing.sales_allocation_quantity_driver_acceptance a
 ON a.sku_id=b.sku_id AND a.product_id=b.product_id AND a.period_start=b.period_start
 WHERE b.refresh_run_id=138 AND b.valuation_date='2026-10-22' AND b.monthly_driver_status='REVIEW_REQUIRED'
 AND a.source_valuation_date='2026-10-20' AND a.acceptance_status='ACTIVE'
 AND (a.monthly_driver_method,a.monthly_driver_source,a.monthly_driver_source_month,a.assumption_id,a.default_policy_id,a.default_policy_scenario,a.resolved_monthly_units,a.resolved_monthly_base_qty)
 IS NOT DISTINCT FROM
 (b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty);
 IF v_count<>57 THEN RAISE EXCEPTION 'Refuse partial renewal: %',v_count; END IF;
 INSERT INTO costing.sales_allocation_quantity_driver_acceptance
 (period_start,source_valuation_date,sku_id,product_id,source_refresh_run_id,source_snapshot_id,
 monthly_driver_method,monthly_driver_source,monthly_driver_source_month,assumption_id,assumption_basis,
 default_policy_id,default_policy_scenario,resolved_monthly_units,resolved_monthly_base_qty,evidence_fingerprint,
 acceptance_status,acceptance_reason,acceptance_note,accepted_by)
 SELECT b.period_start,b.valuation_date,b.sku_id,b.product_id,b.refresh_run_id,b.id,
 b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.assumption_basis,
 b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty,
 costing.fn_sales_allocation_quantity_driver_fingerprint(b.sku_id,b.product_id,b.valuation_date,b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty),
 'ACTIVE','User-directed backend renewal of 57 unchanged dated driver assumptions for 22 October 2026',
 'Administrative renewal under user instruction: all eight demand-driver source/method/policy/quantity attributes compared; original reviewer retained as provenance, NOT a new authenticated sign-in; new fingerprint dated 22 October.',
 a.accepted_by
 FROM costing.sku_sales_allocation_basis_snapshot b JOIN costing.sales_allocation_quantity_driver_acceptance a
 ON a.sku_id=b.sku_id AND a.product_id=b.product_id AND a.period_start=b.period_start
 WHERE b.refresh_run_id=138 AND b.valuation_date='2026-10-22' AND b.monthly_driver_status='REVIEW_REQUIRED'
 AND a.source_valuation_date='2026-10-20' AND a.acceptance_status='ACTIVE'
 AND (a.monthly_driver_method,a.monthly_driver_source,a.monthly_driver_source_month,a.assumption_id,a.default_policy_id,a.default_policy_scenario,a.resolved_monthly_units,a.resolved_monthly_base_qty)
 IS NOT DISTINCT FROM
 (b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>57 THEN RAISE EXCEPTION 'Unexpected insert count %',v_count; END IF;
END $g$;