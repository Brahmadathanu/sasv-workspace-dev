# Deployment approval request: CI-045 (designated-run guard on the route-step provenance table)
Prepared 27 Oct 2026, 11:52 IST. **Nothing has been applied.** This document asks for approval to apply one small migration to production project qhmoqtxpeasamtlxaoak. It is independent of CI-040/041, which were applied today at 09:09–09:10 IST. **CI-042, CI-043 and CI-044 are not part of this request.**

## What you are approving, in plain words
- **Background:** every costing run stores its evidence in 56 "snapshot" tables. Once a run is approved or made a reference, 55 of those tables refuse any change to that run's rows.
- **The odd one out:** the route-step load provenance table, which records which machine and step each product's load came from.
  - **Already protected:** nobody can edit, delete or wipe its rows, for any run, because it is "append-only".
  - **The one gap:** new rows could still be added to an approved or reference run after the approval. That would quietly change the evidence behind an approved price.
- **What CI-045 does:** it adds the same two guards the other 55 tables already have.
  - Any insert, update or delete for an approved, reference or superseded run is refused.
  - Wiping the table (TRUNCATE) is refused.
- **What CI-045 does not do:**
  - It changes no function and no data.
  - It does not change the existing append-only protection, which stays exactly as it is.
  - Draft runs can still add their rows exactly as before.
- **The table is empty today** (0 rows). The feature that fills it ("plant-aware loads") is switched off for 31 Oct, 2 Nov and 30 Nov, so the upcoming scheduled runs do not write to it at all.
- **No policy record** is introduced. I checked the SQL.

## Fresh production baseline (read-only, 27 Oct 2026 11:52 IST)

| Check | Now | Expected | OK? |
|---|---|---|---|
| Combined fingerprint, runs 119/122/143 | 3e5515ed97189b747ea3a8d18c3f4411 | 3e5515ed97189b747ea3a8d18c3f4411 | ✔ |
| Latest run / audit / designation / fingerprint ids | 143 / 21 / 11 / 30 | 143 / 21 / 11 / 30 | ✔ |
| Designated runs (6) | 119 REFERENCE, 122 APPROVED, 143 APPROVED, 128/136/140 REVOKED | same as now | ✔ |
| Queued or running runs | none | none | ✔ |
| Cron jobs | 66 `30 20 * * 0` active; 67 `30 20 28-31 * *` active; 68 `*/5 * * * *` active | unchanged | ✔ |
| Triggers on the provenance table | trg_rslp_guard (INSERT: only runs from Nov 2026 onwards), trg_rslp_immutable (UPDATE/DELETE refused), trg_rslp_no_truncate | the 3 AU-9 triggers | ✔ |
| Other run-scoped tables | 55 of 56 have both AU2 triggers; only the provenance table lacks them | same | ✔ |
| CI-045 triggers already present | no | no | ✔ |
| Rows in the provenance table | 0 (no runs) | — | ✔ |

**What CI-040/041 changed and what CI-045 depends on:** CI-040/041 did **not** replace anything CI-045 touches or depends on. The live md5s below are unchanged:

| Dependency | Live md5 |
|---|---|
| fn_guard_designated_run_rows | 5629ce76… |
| fn_guard_snapshot_truncate | 8c2a4ea7… (identical to the test copy) |
| fn_au9_g4_provenance_guard | e292f85e… (identical to the test copy) |
| fn_au9_append_only | e9be8a9d… (identical to the test copy) |
| v_costing_run_effective_designation | b324068d… |

The local CI-045 tests therefore still hold. They were not rerun, because no SQL changed.

**The only other migration since CI-041** is `20261027045041 carton_380x260x200_3ply_master_alias` (master data). It has no bearing on this table.

## Who writes to this table (checked in the live function bodies)
- **The only writer** is `costing.fn_au9_g4_capture_provenance`.
- **Its callers** are two stage refresh functions:
  - `rpc_refresh_production_overhead_workload_snapshot`, called by `rpc_refresh_manufacturing_cop_chain`, which is called by the job-68 stage processor;
  - `rpc_refresh_sku_direct_labour_component_split_snapshot`, called by `rpc_refresh_sku_direct_labour_allocation_snapshot`.
- **They write only for the run being processed.** A run is processed while it is QUEUED/RUNNING, which is before it can be approved or designated. The same pass writes to the 55 already-guarded sibling tables, so a designated run would already be refused there. **CI-045 adds no new way for a normal draft to fail.**
- **The write is skipped entirely** when plant-aware loads are off (`fn_au9_g4_load_mode` is null). That is the case today for 31 Oct, 2 Nov and 30 Nov.
- **Nothing legitimately inserts here for an approved run.** Approval, supersede (CI-040), readiness and fingerprinting do not reference the table.

## Apply-day checklist
1. Pre-check, read-only (appendix A2). Every value must equal the baseline above, with **no QUEUED/RUNNING run**. If anything differs, stop.
2. Notify Jarvis (FYI) before applying.
3. `apply_migration` with name `ci045_provenance_designated_run_guard` and file `20261027094000_ci045_provenance_designated_run_guard.sql` (md5 c2ece2eb…). Apply it away from a 5-minute mark (job 68). Supabase assigns the version at apply time; record it.
4. Run `verify_ci045.sql` and the fingerprint query (A2). Expected results:
   - 5 triggers on the table;
   - 56 of 56 tables guarded;
   - 0 rows for runs 119/122/143;
   - combined fingerprint 3e5515ed…;
   - ids unchanged.
5. Notify Jarvis with the result.

## Rollback
- **File:** `20261027094000_ci045_ROLLBACK.sql` (md5 66ce00a0…).
- **What it does:** it drops only the two AU2 triggers. The AU-9 triggers stay.
- **Mode A** (immediate) and **Mode B** (after use) are the same. CI-045 writes no rows, so nothing needs keeping or cleaning up.
- **Tested:** applying CI-045 alone, twice, then rolling back gave a catalogue identical to the baseline.

## Timing
- **Recommendation:** apply in a quiet daytime window, for example today or tomorrow, **between 10:00 and 18:00 IST**.
  - Not within 2 minutes of a 5-minute mark (job 68).
  - Never while a run is QUEUED/RUNNING.
  - Not near 02:00 IST (job 67 runs at 02:00 IST on 29, 30 and 31 Oct and on 1 Nov; job 66 runs on Mon 2 Nov).
- **Best before 1 Nov 02:00 IST.** That run will create the 31 Oct October draft, and it is cleaner if the guard is in place before new runs exist. That run and the 2 Nov run are not affected either way: the table is not written while plant-aware loads are off, and drafts are allowed anyway.

## Remaining risks (honest list)
1. **Stand-in guard in local tests:** the local tests used a stand-in for `fn_guard_designated_run_rows`. The live function (md5 5629ce76…) is the one already guarding the other 55 tables. CI-045 only attaches it to one more table, with the same trigger definition.
2. **Message order for already-blocked actions:** triggers fire by name, so the AU2 trigger fires before the AU-9 ones. For an update or delete of a designated run's row, the error message becomes the AU2 one instead of "append-only". The action is refused in both cases.
3. **Future, if plant-aware loads are switched on:** a re-run of the stage that writes provenance for an already-approved run would now be refused. That is the intended protection. Normal re-costing creates a new run.

## Notify Jarvis
- **Before:** "CI-045 is being applied: the approved-run guard on the route-step provenance table. No function, data, cron or app change."
- **After:** the verify result.
- Nobody else needs notifying.

## Approval sentence (reply with this exact text to approve)
> I approve applying to production project qhmoqtxpeasamtlxaoak, via apply_migration, migration 20261027094000_ci045_provenance_designated_run_guard.sql (CI-045), which adds the triggers trg_au2_designated_run_guard (BEFORE INSERT OR UPDATE OR DELETE, using the existing costing.fn_guard_designated_run_rows) and trg_au2_snapshot_truncate_guard (BEFORE TRUNCATE, using the existing costing.fn_guard_snapshot_truncate) on costing.route_step_load_provenance_snapshot, with no function, data or policy-record change, with verification before and after, Jarvis notified before and after, and rollback by 20261027094000_ci045_ROLLBACK.sql if verification fails. CI-042, CI-043 and CI-044 are not approved by this.

---
# Technical appendix

## A1. Objects
- **NEW trigger** `trg_au2_designated_run_guard` on `costing.route_step_load_provenance_snapshot`: BEFORE INSERT OR DELETE OR UPDATE, FOR EACH ROW, EXECUTE FUNCTION `costing.fn_guard_designated_run_rows()`. This is the same definition as on `sku_pricing_bridge_profit_snapshot` and its siblings.
- **NEW trigger** `trg_au2_snapshot_truncate_guard`: BEFORE TRUNCATE, FOR EACH STATEMENT, EXECUTE FUNCTION `costing.fn_guard_snapshot_truncate()`.
- **Prerequisites:** a guard block refuses to run if either function is missing.
- **Re-apply safety:** `DROP TRIGGER IF EXISTS` comes before each CREATE, so re-applying is safe.
- **No change to anything else:**
  - no new or replaced functions, tables, views, settings, grants or policy records;
  - the AU-9 triggers are kept;
  - no rows are touched.

## A2. Read-only queries (before and after)
```sql
-- fingerprint (CI-038/039 verify method)
select md5(string_agg(md5(costing.fn_compute_run_fingerprint(r)::text), '|' order by r)) combined from unnest(array[119,122,143]) r;  -- 3e5515ed97189b747ea3a8d18c3f4411
select (select max(id) from costing.costing_refresh_run) run_max, (select max(audit_id) from costing.cost_period_governance_audit) audit_max,
       (select max(id) from costing.costing_run_designation) des_max, (select max(id) from costing.costing_run_fingerprint) fp_max;  -- 143/21/11/30 unless new runs exist
select id, overall_status from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING');  -- must be empty
select tgname from pg_trigger where tgrelid='costing.route_step_load_provenance_snapshot'::regclass and not tgisinternal order by 1;  -- before: 3 trg_rslp_*; after: + 2 trg_au2_*
```
Then run `verify_ci045.sql` after applying (md5 d94165a2…). It shows the trigger list, the guarded/scoped count (expected 56/56), and the rows for runs 119/122/143 (expected none).

## A3. Local tests (run 26 Oct; not rerun because no SQL changed)
- **Main suite:** C45a–i.
  - Draft inserts work.
  - Inserts, updates and deletes for an APPROVED run are refused with an AU2 error.
  - TRUNCATE is refused.
  - Draft rows stay append-only.
  - Rows for 119/122/143 are refused.
  - The fingerprint is unchanged.
- **Rollback suite:** R-E. Applied alone, twice, then rolled back; the catalogue was identical.
