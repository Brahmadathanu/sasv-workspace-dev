\i 01_seed.sql
\i lib.sql
\i ../candidates/R1_run_retention_ledger.sql
-- R5 before R4 must fail loudly (its objects depend on the R4 engine), leaving no half-installed planner
\set ON_ERROR_STOP off
\i ../candidates/R5_automated_retention.sql
\set ON_ERROR_STOP on
DO $$ BEGIN
 ASSERT to_regprocedure('costing_retention.retention_tick(text)') IS NULL AND to_regprocedure('costing_retention.fn_plan_retention(date)') IS NULL,'no partial R5 install without R4';
END $$;
\echo PASS 14b_planner_requires_engine
