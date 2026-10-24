-- DRAFT ONLY; NOT APPROVED OR EXECUTED.
-- G0 prospective AU-9 bridge, machine profiles only.
-- Keep OUTSIDE supabase/migrations until reviewed, tested, and authorized.
-- This script MUST NOT be run by itself: policy/rule/function/switch changes are separate
-- coordinated deployment steps; activating AU-9 at this stage is prohibited.
BEGIN;
DO $guard$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
        v_frozen date := costing.fn_frozen_valuation_through();
BEGIN
 IF v_today < DATE '2026-10-22' OR v_today >= DATE '2026-11-01' THEN
  RAISE EXCEPTION 'AU9 profile bridge window closed or not yet open: %',v_today;
 END IF;
 IF v_frozen IS NOT NULL AND v_today <= v_frozen THEN
  RAISE EXCEPTION 'AU9 bridge would enter frozen valuations through %',v_frozen;
 END IF;
 IF EXISTS (SELECT 1 FROM costing.plant_aware_load_switch WHERE is_enabled
             AND effective_from<=v_today AND (effective_to IS NULL OR effective_to>v_today)) THEN
  RAISE EXCEPTION 'AU9 already active: abort staging';
 END IF;
END $guard$;

-- Target exactly: explicitly named machines in either route lineage, plus
-- operational capacity-based machine classes named in effective Nov activity rules.
WITH explicit AS (
 SELECT plant_id FROM costing.production_route_family_route_step WHERE plant_id IS NOT NULL
 UNION SELECT plant_id FROM costing.product_process_route_override WHERE plant_id IS NOT NULL
), class_candidates AS (
 SELECT DISTINCT p.plant_id
 FROM costing.route_step_capacity_rule r
 JOIN costing.plant_capacity_profile p ON p.equipment_class_code=r.equipment_class_code
 JOIN public.plant_machinery m ON m.id=p.plant_id AND m.status='O'
 WHERE r.resolution='EQUIPMENT_CLASS_CAPACITY' AND p.capacity_mode='CHARGE'
 AND r.effective_from<=DATE '2026-11-01' AND (r.effective_to IS NULL OR r.effective_to>DATE '2026-11-01')
 AND p.effective_from<=DATE '2026-11-01' AND (p.effective_to IS NULL OR p.effective_to>DATE '2026-11-01')
), required AS (
 SELECT plant_id FROM explicit UNION SELECT plant_id FROM class_candidates
)
SELECT count(*) AS targeted_distinct_machines FROM required;
-- EXPECT 64 on the verified snapshot; STOP if not. A SELECT is not an assertion.
-- Do not add an INSERT until a reviewed, tested migration includes:
--  * exact record manifest + hard count assertion
--  * safe prospective effective_from (IST, frozen cutoff)
--  * effective_to = 2026-11-01 (exclusive)
--  * copy of *current November-effective* source profiles only
--  * every field validated and a new explicit approval reference
--  * no supersession of future November version, no overlapping date ranges
--  * journal checks for all inserts
--  * rollback and cutover ordering across all four policy tables/functions
-- This file is intentionally guard+read-only preflight; no DML or DDL.
ROLLBACK;
