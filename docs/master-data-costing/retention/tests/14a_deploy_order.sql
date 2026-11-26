\i 01_seed.sql
\i lib.sql
-- Documented deployment order up to the pilot: R1, R2A, R2B, R3, R3B, R2C, R4 ... then the planner (R5, disabled) BEFORE the pilot.
\i ../candidates/R1_run_retention_ledger.sql
\i ../candidates/R2A_governance_evidence_events.sql
\i ../candidates/R2B_governance_evidence_capture.sql
\i ../candidates/R3_run_detail_availability.sql
\i ../candidates/R3B_exact_run_read_guards_and_verification.sql
\i ../candidates/R2C_drop_legacy_snapshot_fks.sql
\i ../candidates/R4_guarded_purge.sql
-- R4 is installed WITHOUT the planner: the planner is not an R4 dependency, and R4 alone cannot select candidates
DO $$ BEGIN
 ASSERT to_regprocedure('costing_retention.fn_plan_retention(date)') IS NULL,'planner must not exist after R4 alone';
 ASSERT to_regprocedure('costing_retention.retention_tick(text)') IS NULL,'no automation after R4 alone';
 ASSERT to_regprocedure('costing_retention.purge_run_step(bigint,integer)') IS NOT NULL AND to_regclass('costing_retention.retention_policy') IS NOT NULL,'R4 installs the engine and the policy table (purge_enabled false)';
 ASSERT (SELECT purge_enabled FROM costing_retention.retention_policy)=false,'disabled by default';
END $$;
-- the reviewed seed is refused without a reviewer
\set ON_ERROR_STOP off
\i ../candidates/R4_PROPOSED_ALLOWLIST_SEED.sql
\set ON_ERROR_STOP on
DO $$ BEGIN ASSERT (SELECT count(*) FROM costing_retention.purge_allowlist)=0,'seed without a reviewer wrote nothing'; END $$;
SELECT set_config('costing_retention.seed_reviewed_by','fixture reviewer',false);
\i ../candidates/R4_PROPOSED_ALLOWLIST_SEED.sql
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM costing_retention.purge_allowlist)>=45,'seed applied';
 -- relations the seed names but this fixture does not contain are reported, never silently ignored
 ASSERT EXISTS (SELECT 1 FROM costing_retention.fn_purge_structural_blockers() WHERE blocker='ALLOWLIST_RELATION_MISSING'),'catalog drift against the proposal is visible';
END $$;
-- fixture-only reconciliation: drop proposal rows for relations absent from this synthetic catalog and name the fixture topology (a live run uses PREFLIGHT_06 instead)
DELETE FROM costing_retention.purge_allowlist a WHERE NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=a.table_schema AND c.relname=a.table_name);
DO $$ BEGIN ASSERT (SELECT count(*) FROM costing_retention.fn_purge_structural_blockers())=0,'no structural blocker once the allowlist matches the catalog: '||coalesce((SELECT string_agg(blocker||' '||detail,'; ') FROM costing_retention.fn_purge_structural_blockers()),''); END $$;
-- PILOT BEFORE THE PLANNER: manual single-run purge works with only R4 (planner absent, automation absent)
CREATE TABLE costing_retention.test_clock(fixed_today date NOT NULL); INSERT INTO costing_retention.test_clock VALUES('2026-11-25');
DO $$ DECLARE j jsonb; BEGIN
 PERFORM t.fails($q$SELECT costing_retention.purge_run_step(122)$q$,'ACTIVE_PRICING_AUTHORITY');     -- Sep approved: still pricing authority
 PERFORM t.fails($q$SELECT costing_retention.purge_run_step(153)$q$,'PURGE_BLOCKED');                  -- November protected
 LOOP j:=costing_retention.purge_run_step(87,2); EXIT WHEN (j->>'done')::boolean; END LOOP;
 ASSERT (SELECT detail_state FROM costing.costing_run_retention_ledger WHERE refresh_run_id=87)='DETAILS_PURGED','pilot run purged with R4 only';
END $$;
-- now the planner is installed, still disabled, and agrees with the pilot
\i ../candidates/R5_automated_retention.sql
DO $$ DECLARE j jsonb; BEGIN
 ASSERT to_regprocedure('costing_retention.fn_plan_retention(date)') IS NOT NULL,'planner installed after the pilot';
 ASSERT (SELECT purge_enabled FROM costing_retention.retention_policy)=false,'still disabled';
 ASSERT (SELECT retention_decision FROM costing_retention.fn_plan_retention('2026-11-25') WHERE refresh_run_id=87)='RETAIN','pilot run is RETAIN (already purged) in the plan';
 ASSERT (SELECT retention_decision FROM costing_retention.fn_plan_retention('2026-11-25') WHERE refresh_run_id=150)='ELIGIBLE','next pre-Nov draft is ELIGIBLE';
 j:=costing_retention.retention_tick('EXECUTE'); ASSERT j->>'outcome'='DISABLED','tick refuses to delete while disabled';
 ASSERT (SELECT detail_state FROM costing.costing_run_retention_ledger WHERE refresh_run_id=150)<>'DETAILS_PURGED','nothing else purged';
END $$;
\echo PASS 14a_deploy_order_and_seed
