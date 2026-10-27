-- CI-045 ROLLBACK (immediate and after use identical): removes only the two AU2 triggers; AU-9 append-only triggers stay.
BEGIN;
DROP TRIGGER IF EXISTS trg_au2_designated_run_guard ON costing.route_step_load_provenance_snapshot;
DROP TRIGGER IF EXISTS trg_au2_snapshot_truncate_guard ON costing.route_step_load_provenance_snapshot;
COMMIT;
