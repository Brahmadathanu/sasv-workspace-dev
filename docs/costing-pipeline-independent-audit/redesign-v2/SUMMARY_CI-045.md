# CI-045: designated-run guard on the route-step provenance table (prepared, not applied; independent of CI-040..043)

**Finding** (read-only, 26 Oct 2026): `costing.route_step_load_provenance_snapshot` is the only scoped snapshot table without the AU2 guard pair. It is already append-only through its AU-9 triggers: UPDATE, DELETE and TRUNCATE are refused for every run, and inserts are allowed only for a November 2026 or later run. The real gap is narrower: rows could still be **added** to a run after it was approved or made a reference. Runs 119/122/143 have no rows in this table.

**Change:** add exactly the two triggers every sibling table has. They have the same names, timing and functions as on `sku_pricing_bridge_profit_snapshot`:
- `trg_au2_designated_run_guard`
- `trg_au2_snapshot_truncate_guard`

The AU-9 triggers stay. No function is changed and no row is touched.

**Files:**
- `20261027094000_ci045_provenance_designated_run_guard.sql`
- `20261027094000_ci045_ROLLBACK.sql` (drops the two triggers; the same file serves immediate and after-use rollback)
- `verify_ci045.sql` (expect 5 triggers and 56/56 tables guarded)

**Tests C45a–i and R-E pass:**
- a draft insert works
- an insert, update or delete for an approved run is refused (AU2)
- truncate is refused
- draft rows stay append-only, as before
- rows of 119/122/143 cannot be added
- the fingerprint is unchanged
- it applies alone, twice, and its rollback restores the catalogue exactly

**Apply order:** any time. It does not depend on CI-040..043.
