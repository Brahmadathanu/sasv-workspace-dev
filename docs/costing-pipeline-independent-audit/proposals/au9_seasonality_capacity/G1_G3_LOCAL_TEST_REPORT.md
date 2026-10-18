# AU-9 G1–G3 local test report (18 Oct 2026, 15:45 IST)
Status: **PREPARED + TESTED LOCALLY. NOT APPLIED LIVE.**
- Approval to build: user, 18 Oct 15:36 IST (`USER-APPROVAL-20261018-AU9-G1G3`).
- Package: `PREPARED_AU9_G1_G3_capacity_master.sql` (73 KB). It is kept outside `supabase/migrations`.

## 1. Test bed: a local copy of the live schema
| Item | Detail |
|---|---|
| Engine | PostgreSQL 17.11 on the box. Live is 17.4 |
| Supabase mirrors | Roles `anon`, `authenticated`, `service_role`; `auth.uid()`; `btree_gist` in schema `extensions` (as live) |
| Tables copied from live (read-only extract) | `public.plant_machinery` (171), `machine_types` (29), sections/subsections/areas ids; `costing.production_resource_class` (17); `costing.route_equipment_load_capacity` (16) with identical columns and constraints |
| Functions copied byte-for-byte | `costing.fn_route_step_loads` (md5 4ce19661…, same as live); `fn_costing_run_scoped_tables`; `fn_compute_run_fingerprint` |
| Run 128 | Live extracts loaded into run-scoped tables: route_load_scaling_snapshot (898 rows), step factors (11,571 rows), per-SKU costs (627 rows) |
| Run 122 | Stand-in copy of the per-SKU cost rows, used so the run-122 fingerprint path is exercised |
| Designated-run guard | Equivalent guard on the run 122/128 rows |
| Hash agreement with live | The local copy's plant-master hash (0c269021…) and load-function hash agree with live, so the package prechecks pass on both |

Builder: `tests/build_localcopy.py`. The generated SQL contains live data and is not committed.

## 2. Results
| # | Test | Result |
|---|---|---|
| (a) | **Replay of run-128 loads** (fn_route_step_loads over all 898 pool×product rows), before and after the apply, at valuation 16 Oct and 30 Nov | 898/898 equal to run-128 `scaled_factor`; replay md5 8d8ec7ab… identical before, after the 1st apply and after the 2nd apply |
| (a) | **Cost replay** (batch-true DL/POH shares from the replayed factors) | 627 SKUs: max change ₹0.000000/unit |
| (a) | Every pre-existing function and view in costing+public | md5 of all definitions identical before/after (315d75a8…). The package also asserts this internally and aborts otherwise |
| (b) | **Run 122 / 128 fingerprints** (`fn_compute_run_fingerprint`) | Identical before/after (122: 045cbf4d…, 128: cb457e63…). New tables are not run-scoped (no `refresh_run_id`, no "snapshot" in the name) |
| (b) | Write to an approved-run snapshot after the apply | Still blocked (T14) |
| (c) | **Re-run** (2nd and 3rd apply) | Succeeds; nothing created; state md5 of profiles+fallback+journal identical (d196160d…); counts unchanged |
| — | Objects created | 6 applicability classes; 33 equipment classes; 171 profiles (all provisional, effective 1 Nov 2026); 17 fallback rows; 188 journal rows |
| — | Applicability | Capacity-based production 136 · packing 10 · non-capacity 7 (stoves) · utility 3 (pumps) · UNKNOWN 15 (13 water tanks + 2 Khalvam: user questions open) |
| — | Readiness view | BLOCKED_NEEDS_CAPACITY 133 · BLOCKED_UNCLASSIFIED 15 · NOT_REQUIRED 20 · NOT_OPERATIONAL 3 · COSTING_READY 0 |
| — | Evidence | 23 profiles carry a name-derived rated volume (22 fermentation tanks, PV 100 L); effective capacity is blank for all of them |
| — | Fallback rows | 14 point at the AU-6 V2 class-default rows (ids 1, 3, 5–16); 3 record today's single-load behaviour (DISTILLATION_UNIT, PACKING_MACHINE, PILL_PROCESSING) |
| T01–T05 | Edit, delete or truncate a profile, fallback row or journal | Rejected |
| T06 | Overlapping profile for a machine | Rejected (exclusion constraint) |
| T07 | Capacity on a stove (non-capacity) | Rejected |
| T08 | Final capacity machine without numbers | Rejected |
| T09 | UNKNOWN marked final | Rejected |
| T10 | Allowed path: close → supersede with a BMR value | Journal CREATE, CLOSE, SUPERSEDE; readiness COSTING_READY, fill 80% (rolled back) |
| T11 | Re-closing a closed row | Rejected |
| T12 | Hard delete of a machine with a profile | **Rejected (FK restrict)**: a behaviour change, see the risks below |
| T13 | Plant master edited since review | Package aborts at the precheck; nothing created |
| T15 | `authenticated` role | Can read; insert is denied |
| T16 | Tampering with an existing function inside the package | Post-check aborts ("3 fingerprints changed"); full rollback, 0 objects left |

Logs: `tests/test_main.log`, `tests/test_counts.log`, `tests/test_negative.log`.

## 3. What the live apply would do
One Supabase MCP `apply_migration` (name `au9_g1_g3_capacity_master`), with the file body unchanged, in a single transaction:
1. **Prechecks**:
   - plant master = the reviewed 171 rows (hash)
   - `fn_route_step_loads` and the class-capacity table unchanged since review
   - 17 resource classes
   - btree_gist present

   Any mismatch → abort.
2. **Baseline**: hashes of every costing/public function and view, plus run 122/128 fingerprints, into a temp table.
3. **Create 5 tables + 1 view + 3 trigger functions + 8 triggers** (all new names in schema `costing`):
   - `machine_applicability_class`
   - `machine_equipment_class`
   - `plant_capacity_profile`
   - `capacity_master_revision`
   - `capacity_fallback_policy`
   - `v_plant_capacity_readiness`
4. **Insert**: 6 + 33 class rows, 171 provisional profiles, 17 fallback rows, and 188 journal rows (written by the trigger).
5. **Grants**: SELECT for `authenticated` and `service_role`; no app write access.
6. **Post-checks**: counts. Every pre-existing function/view and the run 122/128 fingerprints must be identical, else abort and roll back.

It **does not**:
- alter any existing table, function, view or row
- touch any snapshot, run or period
- run a refresh
- change any cost

Nothing reads the new tables until gate G4.

## 4. Risks and notes
1. **Plants screen delete.** After the apply, deleting a machine (or an area/section, which cascades to machines) fails with an FK error, because every machine has a profile. This is protective, and consistent with the approved "no hard delete" direction, but it is a visible change before the AU-8 Retire button exists. If you prefer no visible change, swap the FK for a soft reference plus an orphan check in the readiness view (a one-line change; it would need re-testing).
2. **Run-122 fingerprint drift (pre-existing, found today, read-only).**
   - `fn_verify_run_fingerprint(122)` reports 1 of 50 tables drifted: `sku_sales_allocation_basis_snapshot`.
   - Cause: migration 20261017235758 (18 Oct 05:27 IST) added the nullable column `monthly_driver_plan_id`, which changes the row-text hash.
   - Re-hashing without that column reproduces the captured md5 exactly (059106b3…; 634 rows), and the column is null on all run-122 rows. **The values are unchanged.**
   - Run 128: 0 drift.
   - Lesson: G1–G3 adds no column to any existing table. The G5 design was changed to use a separate selection snapshot instead of adding columns.
   - Backlog AU9-P07: make the fingerprint hash a fixed column list.
3. Local engine 17.11 vs live 17.4, and x86 vs ARM. The package uses only standard features (identity, exclusion via btree_gist, `create or replace trigger`, security_invoker views), all available in 17.4.
4. `apply_migration` records a migration-history row. That is the only change outside the new objects.
