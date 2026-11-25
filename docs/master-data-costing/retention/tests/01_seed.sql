-- Synthetic seed produced through the REAL acceptance RPCs (as authenticated users with/without permission).
CREATE SCHEMA t;   -- test helpers only
GRANT USAGE ON SCHEMA t TO authenticated,service_role;
\o /dev/null
INSERT INTO public.user_permissions_canonical VALUES
 ('00000000-0000-0000-0000-000000000001','module:costing-control-center',true,true),   -- permitted user
 ('00000000-0000-0000-0000-000000000002','module:costing-control-center',true,false);  -- view-only user (must be refused)
INSERT INTO costing.cost_periods VALUES ('2026-08-01','LOCKED','2026-08-31','SET'),('2026-09-01','LOCKED','2026-09-20','SET'),('2026-10-01','LOCKED','2026-10-22','SET'),('2026-11-01','OPEN','2026-11-22','SET');
-- runs: 80 Aug draft, 87 Sep draft, 122 Sep APPROVED, 150 Sep draft same valuation date as 122 (renewal target), 143 Oct APPROVED,
--       148 Oct draft, 149 Oct FAILED, 152 Nov draft, 153 Nov draft, 154 Nov RUNNING
INSERT INTO costing.costing_refresh_run(id,period_start,valuation_date,overall_status,valuation_context_source,finished_at) VALUES
 (80,'2026-08-01','2026-08-31','SUCCESS','CAPTURED_AT_REQUEST','2026-08-31 10:00+05:30'),
 (87,'2026-09-01','2026-09-10','SUCCESS','CAPTURED_AT_REQUEST','2026-09-10 10:00+05:30'),
 (122,'2026-09-01','2026-09-20','SUCCESS','CAPTURED_AT_REQUEST','2026-09-20 10:00+05:30'),
 (150,'2026-09-01','2026-09-20','SUCCESS','CAPTURED_AT_REQUEST','2026-09-20 12:00+05:30'),
 (143,'2026-10-01','2026-10-22','SUCCESS','CAPTURED_AT_REQUEST','2026-10-22 10:00+05:30'),
 (148,'2026-10-01','2026-10-23','SUCCESS','CAPTURED_AT_REQUEST','2026-10-23 10:00+05:30'),
 (149,'2026-10-01',NULL,'FAILED','CAPTURED_AT_REQUEST',NULL),
 (152,'2026-11-01','2026-11-20','SUCCESS','CAPTURED_AT_REQUEST','2026-11-20 10:00+05:30'),
 (153,'2026-11-01','2026-11-22','SUCCESS','CAPTURED_AT_REQUEST','2026-11-22 10:00+05:30'),
 (154,'2026-11-01','2026-11-25','RUNNING','CAPTURED_AT_REQUEST',NULL);
INSERT INTO costing.costing_run_designation(refresh_run_id,period_start,designation,designated_by,reason) VALUES
 (122,'2026-09-01','APPROVED','owner','Fixture approval of September'),(143,'2026-10-01','APPROVED','owner','Fixture approval of October');
-- helper: create sales basis snapshot for (run,sku)
CREATE FUNCTION t.mk_sales(p_run bigint,p_sku bigint,p_units numeric DEFAULT 100) RETURNS bigint LANGUAGE sql AS $$
 INSERT INTO costing.sku_sales_allocation_basis_snapshot(period_start,valuation_date,refresh_run_id,sku_id,product_id,product_name,monthly_driver_method,monthly_driver_source,
  monthly_driver_status,assumption_id,assumption_basis,default_policy_id,default_policy_scenario,monthly_allocation_units,monthly_allocation_base_qty)
 SELECT r.period_start,r.valuation_date,r.id,p_sku,p_sku+1000,'P'||p_sku,'POLICY','GOVERNED_DEFAULT','REVIEW_REQUIRED',NULL,'basis-'||p_run,7,'BASE',p_units,p_units/2
 FROM costing.costing_refresh_run r WHERE r.id=p_run RETURNING id $$;
-- helper: create regional basis + expense snapshot, returns expense snapshot id
CREATE FUNCTION t.mk_regional(p_run bigint,p_sku bigint,p_region text,p_status text DEFAULT 'REVIEW',p_units numeric DEFAULT 40) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE b bigint; e bigint; r costing.costing_refresh_run;
BEGIN
 SELECT * INTO r FROM costing.costing_refresh_run WHERE id=p_run;
 INSERT INTO costing.sku_regional_marketing_allocation_basis_snapshot(period_start,valuation_date,refresh_run_id,sku_id,product_id,region_code,regional_default_policy_id,regional_default_scenario)
  VALUES(r.period_start,r.valuation_date,p_run,p_sku,p_sku+1000,p_region,3,'BASE') RETURNING id INTO b;
 INSERT INTO costing.sku_regional_marketing_expense_allocation_snapshot(period_start,valuation_date,refresh_run_id,regional_basis_snapshot_id,sku_id,product_id,product_name,region_code,
  regional_basis_source,regional_basis_status,marketing_value_source,resolved_product_region_marketing_sales_value,resolved_regional_units,resolved_regional_base_qty,marketing_expense_cost_per_sku_region,marketing_expense_allocation_status)
  VALUES(r.period_start,r.valuation_date,p_run,b,p_sku,p_sku+1000,'P'||p_sku,p_region,'REGIONAL_DEFAULT_POLICY_UNITS',p_status,'GOVERNED_REGIONAL_DEFAULT',500,p_units,p_units/2,1.25,'REVIEW_REQUIRED') RETURNING id INTO e;
 RETURN e;
END $$;
-- snapshots: runs 87,122,150,152,153 (+ extra heavy rows for other runs)
SELECT t.mk_sales(r,s) FROM unnest(ARRAY[87,122,150,152,153]) r, generate_series(1,3) s;
SELECT t.mk_regional(r,s,reg) FROM unnest(ARRAY[87,122,150,152,153]) r, generate_series(1,3) s, unnest(ARRAY['IK','OK']) reg;
CREATE FUNCTION t.as_user(p_uid text) RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub',p_uid,false) $$;
-- accepted baseline through the REAL RPCs: run 122 SKU 1..2 (sales), SKU 1 IK/OK + SKU 2 IK (regional)
SET ROLE authenticated; SELECT t.as_user('00000000-0000-0000-0000-000000000001');
SELECT count(*) FROM (SELECT costing.rpc_accept_sales_allocation_quantity_driver_review(122,s,'baseline acceptance '||s) FROM generate_series(1,2) s) q;
SELECT count(*) FROM (SELECT costing.rpc_accept_regional_marketing_review(122,1,'IK','baseline regional'),
                              costing.rpc_accept_regional_marketing_review(122,1,'OK','baseline regional'),
                              costing.rpc_accept_regional_marketing_review(122,2,'IK','baseline regional')) q;
RESET ROLE;
\o
DO $$ BEGIN
 IF (SELECT count(*) FROM costing.sales_allocation_quantity_driver_acceptance)<>2 OR (SELECT count(*) FROM costing.regional_marketing_evidence_acceptance)<>3
 THEN RAISE EXCEPTION 'seed acceptance counts wrong'; END IF;
END $$;
\echo PASS 01_seed
