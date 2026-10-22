-- SASV Price Revision Proposal / G0 / AU-9 early activation
-- READ-ONLY PRE-APPLICATION PREFLIGHT. Does not activate AU-9 or change any data.
-- All checks use IST today and require a separately approved prospective cutover.
WITH params AS (
  SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date AS ist_today,
         costing.fn_frozen_valuation_through() AS frozen_through,
         DATE '2026-11-01' AS existing_start
),
dates AS (
  SELECT *, greatest(ist_today, frozen_through + 1) AS earliest_eligible
  FROM params
),
explicit AS (
  SELECT plant_id FROM costing.production_route_family_route_step WHERE plant_id IS NOT NULL
  UNION
  SELECT plant_id FROM costing.product_process_route_override WHERE plant_id IS NOT NULL
),
class_source AS (
  SELECT DISTINCT p.plant_id
  FROM costing.route_step_capacity_rule r
  JOIN costing.plant_capacity_profile p
    ON p.equipment_class_code=r.equipment_class_code
  JOIN public.plant_machinery m ON m.id=p.plant_id AND m.status='O'
  CROSS JOIN dates d
  WHERE r.resolution='EQUIPMENT_CLASS_CAPACITY'
    AND p.capacity_mode='CHARGE'
    AND p.effective_from<=d.existing_start
    AND (p.effective_to IS NULL OR p.effective_to>d.existing_start)
),
required_plants AS (
  SELECT plant_id FROM explicit UNION SELECT plant_id FROM class_source
)
SELECT 'BOUNDARY' AS check_name, 'ist_today='||ist_today||
  ', frozen_through='||coalesce(frozen_through::text,'NULL')||
  ', earliest_eligible='||earliest_eligible||
  ', existing_profiles_from='||existing_start AS evidence
FROM dates
UNION ALL
SELECT 'BRIDGE_COUNTS', 'explicit='||(SELECT count(*) FROM explicit)||
  ', operational_class='||(SELECT count(*) FROM class_source)||
  ', distinct_union='||(SELECT count(*) FROM required_plants)
UNION ALL
SELECT 'FUTURE_PROFILE_COVERAGE', 'missing_nov_profiles='||count(*)
FROM required_plants rp
WHERE NOT EXISTS (
 SELECT 1 FROM costing.plant_capacity_profile p CROSS JOIN dates d
 WHERE p.plant_id=rp.plant_id AND p.effective_from<=d.existing_start
 AND (p.effective_to IS NULL OR p.effective_to>d.existing_start)
)
UNION ALL
SELECT 'AU9_SWITCH', 'rows='||count(*)||', enabled='||
  count(*) FILTER (WHERE is_enabled)
FROM costing.plant_aware_load_switch
UNION ALL
SELECT 'FALLBACK_POLICIES', 'total='||count(*)||', allowed='||
  count(*) FILTER (WHERE fallback_allowed)
FROM costing.capacity_fallback_policy
UNION ALL
SELECT 'ACTIVITY_RULES', 'total='||count(*)
FROM costing.route_step_capacity_rule
ORDER BY check_name;

-- NOTE: a numerical PASS here is not implementation approval.
-- Before applying DDL: review immutable versions, journal actions, dates,
-- class resolution on operational profiles, manual-filtration activity basis,
-- current function definitions/grants, all route-level fail-closed cases,
-- the shared Ksheerabala 101/41 conversion-cost policy and run136 invariants.
