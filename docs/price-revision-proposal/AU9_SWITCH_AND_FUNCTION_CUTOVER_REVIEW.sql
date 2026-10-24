-- AU-9 October cutover: SWITCH / FUNCTION CHANGE REVIEW
-- NOT FOR EXECUTION. Deployment bundle requires reviewed full resolver body,
-- valid policy bridges, approval reference, historical replay and staged rollback.
BEGIN;
DO $$ BEGIN
 RAISE EXCEPTION 'INTENTIONAL HOLD: AU9 switch and function migration not approved';
END $$;

-- Proposal 1: remove ONLY pals_from_nov2026 and rscr_from_nov2026,
-- retain pals_no_overlap, rscr_no_overlap, date guards and append-only journal.
-- ALTER TABLE costing.plant_aware_load_switch DROP CONSTRAINT pals_from_nov2026;
-- ALTER TABLE costing.route_step_capacity_rule DROP CONSTRAINT rscr_from_nov2026;

-- Proposal 2: preserve function identity, security-definer semantics,
-- search_path and existing grants. Replace fn_au9_g4_load_mode with
-- equivalent effective-dated switch selection without hardcoded Nov restriction.
CREATE OR REPLACE FUNCTION costing.fn_au9_g4_load_mode(p_valuation_date date)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'costing','pg_temp'
AS $fn$
 SELECT s.id
 FROM costing.plant_aware_load_switch s
 WHERE s.is_enabled
   AND p_valuation_date IS NOT NULL
   AND s.effective_from <= p_valuation_date
   AND (s.effective_to IS NULL OR s.effective_to > p_valuation_date)
$fn$;

-- Proposal 3: make ONE targeted change to the existing
-- costing.fn_au9_g4_resolve_step_load(text,numeric,numeric,text,date,bigint,bigint,integer).
-- DO NOT replace its long existing body with a stub.
-- CURRENT:
-- if d is null or d < date '2026-11-01' then
--   raise exception 'AU-9 G4: plant-aware loads ...';
-- end if;
-- REQUIRED:
-- if d is null or costing.fn_au9_g4_load_mode(d) is null then
--   raise exception 'AU-9 G4: plant-aware loads not enabled for valuation date %', d;
-- end if;
-- Preserve unchanged explicit machine, step-rule, class fallback, journal
-- revision and fail-closed checks. Review recursion/dependency: fn_load_mode
-- must not depend on fn_resolve_step_load.

-- Proposal 4: activation, ONLY AFTER preflight and manual-filtration policy:
-- INSERT INTO costing.plant_aware_load_switch (
--   is_enabled,effective_from,effective_to,approval_reference,change_reason)
-- VALUES (TRUE, <FORWARD_DATE>,DATE '2026-11-01',
--   <APPROVED_REFERENCE>,'Coordinated AU9 October bridge');
-- Test October activation & November continuation separately, verify pre-frozen
-- 2026-10-20 legacy resolver remains unchanged. Never backdate run136.

-- Deliberately rolls back even if the intentional hold were removed:
ROLLBACK;
