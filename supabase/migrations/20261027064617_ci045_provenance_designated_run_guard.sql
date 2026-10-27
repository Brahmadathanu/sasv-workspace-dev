-- =====================================================================================================
-- CI-045  Designated-run guard on costing.route_step_load_provenance_snapshot (independent of CI-040..043)
-- PREPARED 26 Oct 2026 (IST). NOT APPLIED. Parent decision 7 (owner delegation of 26 Oct 2026).
--
-- FINDING (read-only, production 26 Oct 2026): this is the only one of the 56 run-scoped snapshot tables without the
-- AU2 pair trg_au2_designated_run_guard / trg_au2_snapshot_truncate_guard. It is NOT unprotected: AU-9 triggers make it
-- append-only for every run (trg_rslp_immutable: UPDATE/DELETE refused; trg_rslp_no_truncate: TRUNCATE refused) and
-- trg_rslp_guard only admits rows for an existing run of November 2026 or later. The real gap is narrower: rows could
-- still be INSERTED for a run that is already REFERENCE/APPROVED/REVOKED (from November 2026), changing its evidence
-- after designation. Runs 119/122/143 have 0 rows in this table.
--
-- CHANGE: add exactly the trigger pair every sibling table has (same names, timing, events, functions, as on
-- costing.sku_pricing_bridge_profit_snapshot). The AU-9 triggers stay. No function changed; no row touched.
--   trg_au2_designated_run_guard     BEFORE INSERT OR DELETE OR UPDATE FOR EACH ROW -> costing.fn_guard_designated_run_rows()
--   trg_au2_snapshot_truncate_guard  BEFORE TRUNCATE FOR EACH STATEMENT            -> costing.fn_guard_snapshot_truncate()
-- Firing order (by name): trg_au2_* run before trg_rslp_*; for UPDATE/DELETE of a designated run the AU2 message
-- appears first, otherwise AU-9 refuses as today. Draft-run inserts behave exactly as before.
-- =====================================================================================================
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('costing.fn_guard_designated_run_rows()') IS NULL OR to_regprocedure('costing.fn_guard_snapshot_truncate()') IS NULL THEN
    RAISE EXCEPTION 'CI045_PREREQ: AU2 guard functions missing'; END IF;
END $$;
DROP TRIGGER IF EXISTS trg_au2_designated_run_guard ON costing.route_step_load_provenance_snapshot;
CREATE TRIGGER trg_au2_designated_run_guard BEFORE INSERT OR DELETE OR UPDATE ON costing.route_step_load_provenance_snapshot
  FOR EACH ROW EXECUTE FUNCTION costing.fn_guard_designated_run_rows();
DROP TRIGGER IF EXISTS trg_au2_snapshot_truncate_guard ON costing.route_step_load_provenance_snapshot;
CREATE TRIGGER trg_au2_snapshot_truncate_guard BEFORE TRUNCATE ON costing.route_step_load_provenance_snapshot
  FOR EACH STATEMENT EXECUTE FUNCTION costing.fn_guard_snapshot_truncate();
COMMIT;
