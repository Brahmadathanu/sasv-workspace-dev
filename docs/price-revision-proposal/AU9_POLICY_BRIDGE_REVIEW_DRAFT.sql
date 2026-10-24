-- G0 AU-9 OCTOBER BRIDGE. REVIEW DRAFT ONLY: DO NOT EXECUTE IN PRODUCTION.
-- Not an approved migration. Requires explicit approval reference, tested rollback,
-- full function cutover, manual filtration rule and subsequent joint-process correction.
-- The following DML is illustrative and would modify protected master rows if run.
-- Existing November versions must remain intact.
BEGIN;
DO $$
BEGIN
  RAISE EXCEPTION 'INTENTIONAL HOLD: approval, migration parity, and full package verification required';
END $$;

-- Precondition: prospective date chosen no earlier than IST today and > frozen-through.
-- November-only CHECK rscr_from_nov2026 blocks activity-rule October inserts:
-- Only the final reviewed migration may drop that one CHECK, retaining rscr_no_overlap,
-- rscr_dates, rscr_target, forward-only and journal triggers.
-- Same applies to pals_from_nov2026 when introducing switch activation.

-- DRAFT: clone the 17 NOVEMBER-EFFECTIVE FALLBACK POLICIES for a short October window,
-- preserving their references to old October-effective legacy class defaults.
INSERT INTO costing.capacity_fallback_policy (
 resource_class_code,equipment_class_code,fallback_allowed,fallback_source,
 legacy_capacity_id,review_flag,effective_from,effective_to,
 approval_reference,change_reason,supersedes_id
)
SELECT resource_class_code,equipment_class_code,fallback_allowed,fallback_source,
       legacy_capacity_id,review_flag,DATE '__CUTOVER_DATE__',DATE '2026-11-01',
       '__APPROVAL_REFERENCE__','Prospective AU9 early bridge; retain Nov approved version',NULL
FROM costing.capacity_fallback_policy
WHERE effective_from<=DATE '2026-11-01'
  AND (effective_to IS NULL OR effective_to>DATE '2026-11-01');

-- DRAFT: clone the nine Nov rules, preserving the Nov approved versions.
-- Must be sequenced after the narrow rscr_from_nov2026 CHECK replacement.
INSERT INTO costing.route_step_capacity_rule (
 rule_code,resource_class_code,activity_id,activity_name_at_approval,
 resolution,equipment_class_code,policy_reference,effective_from,effective_to,
 approval_reference,change_reason,supersedes_id
)
SELECT rule_code,resource_class_code,activity_id,activity_name_at_approval,
       resolution,equipment_class_code,policy_reference,
       DATE '__CUTOVER_DATE__',DATE '2026-11-01',
       '__APPROVAL_REFERENCE__','Prospective AU9 early bridge; retain Nov approved version',NULL
FROM costing.route_step_capacity_rule
WHERE effective_from<=DATE '2026-11-01'
  AND (effective_to IS NULL OR effective_to>DATE '2026-11-01');

-- DO NOT INSERT is_enabled=true into plant_aware_load_switch until:
-- 64 prospective plant capacity profiles journaled and verified,
-- all 17 fallbacks + nine rules validated at cutover,
-- both November-only function guards refactored,
-- manual cloth-oil filtration versus machine recollection audited,
-- target date routes have deterministic valid load basis,
-- and independent Ksheerabala joint conversion correction is verified
-- before authorizing fresh costing run.
ROLLBACK;
