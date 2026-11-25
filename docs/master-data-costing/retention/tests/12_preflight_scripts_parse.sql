-- The shipped read-only preflights must execute without error on the fixture (syntax/column drift guard; results are synthetic here).
\o /dev/null
\i ../preflight/PREFLIGHT_00_catalog_contract.sql
\i ../preflight/PREFLIGHT_01_baseline_and_parity.sql
\i ../preflight/PREFLIGHT_02_r2c_consumer_audit.sql
\i ../preflight/PREFLIGHT_03_consumer_inventory.sql
\i ../preflight/PREFLIGHT_04_purge_candidates_and_allocation.sql
\i ../preflight/PREFLIGHT_05_pointer_and_pricing_authority.sql
\o
DO $$ BEGIN ASSERT NOT EXISTS (SELECT 1 FROM pg_class WHERE relname='x_never'),'ok'; END $$;
\echo PASS 12_preflight_scripts_parse
