# Technical approval batch (prepared and tested in isolation; nothing applied live)

Prepared 19 Oct 2026, 20:15 IST. The SQL files are in `closure/prepared/`, outside `supabase/migrations`. Each file:
- opens with guards that stop if live differs from the 19 Oct baseline (definition md5s, policies, ACLs);
- applies one change;
- closes with postchecks.

To apply, use Supabase MCP `apply_migration`, one file per call, and only after approval and after Jarvis has been notified.

**Test bed:** a local PostgreSQL 17 fixture (`tb`) built from the live catalogue. It has the 216 relations the costing views depend on, the live view definitions (md5-identical for all 62), ACLs, RLS, policies and triggers, plus sample rows. Full masters are loaded, as are the ILC/COP/prime snapshots for runs 122 and 128.

**Test runner:** `evidence/TB/run_tests.py`. It takes the state before, applies all files in order, then takes the state after. Results are in `evidence/TB/tb_test_results.json`.

**Test users:** synthetic — an unpermitted logged-in user, a costing user (`module:costing-control-center` view), an ETL admin (`hub_admin` use), plus `anon` and `service_role`.

| # | Issue | File | What changes live | Test result |
|---|---|---|---|---|
| TB1 | CI-001 | PREPARED_TB1_tally_snapshot_write_lockdown.sql | 14 tally tables: the "any logged-in user may write" policy is replaced by two policies: read for logged-in users, write for ETL admins only. Across all 22 `tally_*` tables plus `etl_jobs`, `anon` loses all privileges and `authenticated` loses TRUNCATE/REFERENCES/TRIGGER/MAINTAIN. TRUNCATE was open to anon and authenticated on `tally_fg_transfer_snapshot`, `tally_rm_rms_stock_snapshot` and `etl_jobs`, and RLS does not govern TRUNCATE. `service_role` is unchanged. | **Unpermitted user, before:** could update/delete all rows in 14 tables and truncate 3. **After:** 0 rows affected, and TRUNCATE is denied. Reads are unchanged. ETL admin and service_role can still write. Anon is denied. |
| TB2 | CI-017, CI-019 (public path), CI-020 | PREPARED_TB2_costing_view_permission_gate.sql | New `public.fn_costing_view_allowed()`, which allows postgres/service_role or view permission on any costing module. 49 ungated costing views are re-created as `select q.* from (<identical live definition>) q where gate`: 37 definer and 12 invoker. 13 already-gated views are untouched. All 62 views: anon has no rights; authenticated has SELECT only. | **Before:** the unpermitted user read 3,272 fixture rows across 33 views. Live, this includes per-employee salary: `v_costing_staff_classification_register`, 164 rows (142 with salary), readable by all 25 accounts. **After:** 0 rows in every view. For postgres and for the costing user, all 62 views return identical columns and identical results, except `generated_at = now()` on the pricing dashboard. RPCs: all 7 functions that read these views run as postgres (6 definer, plus 1 invoker trigger used in refresh); a definer probe still returns all 47 rows to an unpermitted caller. Dependent views compile unchanged. |
| TB3 | CI-018 | PREPARED_TB3_function_search_path.sql | `ALTER FUNCTION ... SET search_path` on 9 functions: 8 to `pg_catalog, pg_temp`, and `fn_tally_batch_consistency` to `public, pg_temp`. Bodies are untouched. | Outputs are identical before and after for every function tested, including both error paths of `fn_w2_require_text`. Note: the two SQL fingerprint helpers are no longer inlined, so refresh may be slightly slower; results are the same. |
| TB4 | CI-019 (costing schema) | — no SQL | `config.toml` exposes only `public` and `graphql_public`, and no client uses `.schema('costing')`. The 46 costing objects that authenticated can SELECT are therefore reachable only through public views, which TB2 now gates. | Still to confirm: one look at Dashboard > API > Exposed schemas, which should not list `costing`. |
| TB5 | CI-002 | PREPARED_TB5_ilc_imc_atomic_view.sql | New view `costing.v_sku_internal_loaded_cost_atomic`: the ILC row, plus IMC from COP of the same run, plus two identity-gap columns. No table change, because adding a column to a scoped snapshot would break legacy whole-row fingerprints (e.g. run 119). | Runs 122 and 128 (634/627 SKUs) have max prime and ILC identity gap of 0.000000. IMC is on 9 SKUs per run: ₹14.27 for run 122 and ₹2.55 for run 128. |
| TB6 | CI-009 | PREPARED_TB6_fingerprint_algorithm_version.sql | Columns `algorithm_version` and `scoped_table_set_md5` on `costing_run_fingerprint`, which is not itself fingerprint-scoped. Defaults are set after the add, so the 12 existing rows stay NULL. Adds `fn_costing_run_scoped_set_md5()` and the view `costing.v_run_fingerprint_method`. | `fn_verify_run_fingerprint` output is identical for all 8 runs. The view classifies captures 1–11 as legacy whole-row and 12–13 as W5 fixed-column. A new insert gets `W5_FIXED_COLUMNS_V1` plus the table-set md5, with no change to any inserter. |
| TB7 | CI-010 | PREPARED_TB7_capacity_value_origin.sql | New view `costing.v_capacity_value_origin`, which classifies every capacity value by origin. No row is edited and no switch is changed: both tables are close-only. | Current list: `evidence/TB/capacity_value_origin_current.csv` (counts below). |

## CI-010: capacity values by origin (current rows)

**Class rows** (16; the October runs 122/128 use these):
- USER_SUPPLIED 11: the user's 18 Oct values. Vessel, cooker and fermentation are also backed by work-log or name evidence.
- ASSUMED 2: the traditional furnace takes the puta value, and filtration takes the vessel value.
- FIXED_RULE 3: 1 per batch.

**Plant rows** (171 current; used only once plant-aware loads are approved):

| Origin | Rows | Meaning |
|---|---:|---|
| USER_SUPPLIED | 76 | user-declared (USER-CORRECTED-20261018-AU9-R2) |
| ESTIMATED | 23 | rated capacity read from machine name |
| CLASS_DEFAULT:USER_SUPPLIED | 45 | no plant value; falls back to a user-supplied class value |
| CLASS_DEFAULT:ASSUMED | 3 | falls back to an assumed class value (furnace 2, filtration 1) |
| ASSUMED | 14 | 13 in classes with no capacity row (single load per batch: packing 10, pill 2, distillation 1), plus 1 user row flagged ASSUMPTION_PILLS_STONE_GRINDER_3KG |
| MISSING | 10 | machine has no resource class |

Every row is currently `is_provisional = true`. The view separates provenance, so the flag no longer has to carry it.

## Exact live delta if all are approved

- **Policies:** 14 dropped and 28 created.
- **Grants:** about 23 tables and 62 views get REVOKE statements.
- **Functions:** 2 new (`public.fn_costing_view_allowed`, `costing.fn_costing_run_scoped_set_md5`); 9 get `ALTER ... SET search_path`.
- **Views:** 49 replaced in place (same columns); 3 new costing views.
- **Columns:** 2 nullable columns added to `costing_run_fingerprint`.

No data row changes. No snapshot, run, switch, cron or effective date is touched. Runs 122 and 128 are untouched, and their verification is unchanged.

## Risks to note at approval

- **TB2:** anyone who uses the costing screens without a costing module permission will see empty lists after this change. Today only 1 account holds any costing permission; confirm that this is intended.
- **TB1:** the Tally agent must write as `service_role` or as an ETL admin. The AU3 expense loader already works this way (service_role only), but there are no logs to prove the agent's role: `query_logs` is unavailable. Watch the next Tally sync.
