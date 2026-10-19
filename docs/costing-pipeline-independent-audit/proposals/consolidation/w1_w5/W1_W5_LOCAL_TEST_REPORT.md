# W1 + W5 local build and test report (2026-10-19 06:20 IST)

**Status: built and tested LOCALLY only.** No live write, no apply_migration, no cron change, no merge.
User approval (18 Oct 22:44 IST): order W1 -> W5 (alongside) -> W2 -> W3 -> W4; "build W1 and W5 locally".

## 1. What was built

| Package | File | Live effect if installed |
|---|---|---|
| W1 approved-run feed + labels | `PREPARED_W1_approved_run_feed_and_labels.sql` | **Adds 6 views only**, changes nothing existing: `costing.v_price_revision_feed_approved`, `costing.v_costing_period_run_status`, `costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed` + public wrappers `v_costing_pricing_price_revision_feed_approved`, `v_costing_pricing_period_run_status`, `v_cost_sheet_snapshot_sku_monthly_comparison_governed` (permission filter `module:costing-control-center/view`, grant authenticated + service_role; costing.* service_role only). Old comparison views kept unchanged. |
| W5 fingerprint on fixed columns | `PREPARED_W5_fingerprint_fixed_columns.sql` | **Replaces 2 functions** (same signatures): `fn_compute_run_fingerprint` (same md5s, now also records each table's column list `cols`) and `fn_verify_run_fingerprint` (re-hashes with the captured columns; legacy captures verified exactly as before). **Widens** `costing_run_fingerprint` purpose check to add `REBASELINE`. **Adds** append-only table `costing_run_fingerprint_rebaseline`, helpers `fn_run_fingerprint_current_columns`, `fn_run_fingerprint_table_hash`, and service_role-only `rpc_rebaseline_run_fingerprint`. Close / designate / after-run / scope functions untouched. |
| W5 re-baseline (separate step) | `PREPARED_W5_rebaseline_runs_122_128.sql` | Inserts 2 fingerprint rows (purpose REBASELINE) + 2 journal rows: run 122 vs approved capture 4 excluding only `sku_sales_allocation_basis_snapshot.monthly_driver_plan_id` (column added 17 Oct, empty for 122); run 128 vs capture 11, no exclusion. Refuses unless every table equals the approved capture byte for byte. **No snapshot data changes.** Effect: run 122 verifies clean, so a September close would no longer be blocked (close itself NOT run). |
| Client (branch `costing/w1-approved-run-labels`, commit d132edf) | diff: `CLIENT_W1_branch_costing-w1-approved-run-labels.diff` | Run label badge beside the freshness indicator on the 6 pricing lenses ("Approved run N" / "DRAFT run N - not approved" / "Approved run N (newer DRAFT run M - not approved)"); Cost comparison lens reads the governed view. New `costing-run-status-badge.js`, 10 lines in `costing-suite-shell.js`, 19 lines CSS in `sasv-costing.css`. No WP07 files. Needs W1 installed before merge. |

Design choices:
- "Approved" = the run the existing pointer `v_current_successful_costing_refresh_run` selects with basis APPROVED (handles REVOKED, matches the screens). The 21:50 draft used "latest APPROVED designation"; same result today.
- Governed Cost comparison shows each month's governed run: approved where one exists, otherwise the latest draft **labelled** `DRAFT run N - not approved` (column `snapshot_run_label`). Strict approved-only = decision D1.
- Sheets (ChatGPT): read `v_costing_pricing_price_revision_feed_approved` with `is_latest_approved_period = true` (or a chosen period_start). Drafts never appear.

## 2. Local test results (46/46 pass)

Fixture: local PG 17, DB `w1w5`, TimeZone UTC (as live). Runs 122/127/128 rows of the 5 pricing snapshot tables + monthly cost-sheet lines copied from live as exact row text; governance tables, triggers and the live function/view definitions installed byte-identical (md5 checked, B1). Script `local_test/run_tests.py`, log `local_test/run_tests.log`.

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| B1 | Fixture definitions equal live (pointer, cost sheet, both comparison views) | live md5s | ['5cc25791', 'd20e3c32', '7e3254c2', 'b20a9206'] | PASS |
| W1-0 | W1 SQL installs; in-file prechecks/postchecks pass | no error | installed | PASS |
| W1-1 | Feed: Sep run 122 = 634 SKUs, 74 IK / 70 OK negative | 2026-09-01,122,634,74,70,latest=f | ('2026-09-01', 122, 634, 74, 70, False) | PASS |
| W1-2 | Feed: Oct run 128 = 627 SKUs, 9 IK / 9 OK negative, latest approved | 2026-10-01,128,627,9,9,latest=t | ('2026-10-01', 128, 627, 9, 9, True) | PASS |
| W1-3 | Feed values identical to the approved runs' cost sheet (v_sku_detailed_cost_sheet 122/128) | 0 | 0 | PASS |
| W1-4 | Status labels per month | {'2026-07-01': 'DRAFT run 80 - not approved', '2026-08-01': 'DRAFT run 82 - not approved', '2026-09-01': 'Appr… | {'2026-07-01': 'DRAFT run 80 - not approved', '2026-08-01': 'DRAFT run 82 - not approved', '2026-09-01': 'Appr… | PASS |
| W1-5 | Governed Cost comparison: one run per month (Sep 122 / Oct 128) | [('2026-09-01',[122],634),('2026-10-01',[128],627)] | [('2026-09-01', [122], 634), ('2026-10-01', [128], 627)] | PASS |
| W1-6 | Governed Oct values = run 128 lines exactly (IK selling price) | 0 | 0 | PASS |
| W1-7 | Old vs governed comparison for Oct today (runs 127 and 128 hold equal values, so no visible difference yet; see W1-16) | info | 0 | PASS |
| W1-8 | Public governed comparison keeps every old column in order (client compatible) + 7 run columns | 56+7 | 56+7 | PASS |
| W1-9 | Grants: anon denied; authenticated denied on costing.* but reads public wrappers (permission stub=true) | denied/denied/1261,6,1261 | denied/denied/1261,6,1261 | PASS |
| W1-10 | No existing function/view/table/constraint changed; only 6 views added | changed=[]; added=6 views | changed=[]; added=['V costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed', 'V costing.v_costing_per… | PASS |
| W1-11 | W1 SQL re-run is idempotent (no definition change) | same | True | PASS |
| W1-12 | New Oct run without authorisation is refused (existing guard) | AU2_PERIOD_HOLDS_APPROVED_RUN | AU2_PERIOD_HOLDS_APPROVED_RUN: period 2026-10-01 holds APPROVED run 128; a recorded supersession authorisation… | PASS |
| W1-13 | Simulated DRAFT run 129 (Oct, +10% prices, 627 SKUs) does not reach the feed | feed hash unchanged; pointer 128 | draft rows=627; hash same=True; pointer=128 | PASS |
| W1-14 | Oct label while run 129 is RUNNING shows active run | active_run_id=129 | 129 | PASS |
| W1-15 | Oct label after draft 129 succeeds | APPROVED_NEWER_DRAFT / Approved run 128 (newer DRAFT run 129 - not approved) | APPROVED_NEWER_DRAFT / Approved run 128 (newer DRAFT run 129 - not approved) | PASS |
| W1-16 | Governed Cost comparison stays on run 128; old view picks up draft prices | governed [128]; old view differs | governed [128]; old view differing SKUs=627 | PASS |
| W1-17 | Simulated Nov DRAFT run 130: not in feed; labelled DRAFT; Oct stays latest approved | 0 rows; DRAFT / DRAFT run 130 - not approved; Oct latest=t | 0 rows; DRAFT / DRAFT run 130 - not approved / latest_appr=false; Oct latest=True | PASS |
| W1-18 | Governed Cost comparison labels Nov draft rows | DRAFT run 130 - not approved / 627 | DRAFT run 130 - not approved / 627 | PASS |
| W1-19 | Feed unchanged after both simulated drafts | same hash | True | PASS |
| W5-0a | Before W5: run 122 drift (live behaviour reproduced) | ['sku_sales_allocation_basis_snapshot'] | ['sku_sales_allocation_basis_snapshot'] | PASS |
| W5-0b | Before W5: closing Sep is refused | AU2_CLOSE_FINGERPRINT_DRIFT | AU2_CLOSE_FINGERPRINT_DRIFT: run 122 has 1 drifted tables | PASS |
| W5-1 | W5 SQL installs (after W1); in-file prechecks/postchecks pass | no error | installed | PASS |
| W5-2 | After W5, before re-baseline: run 128 clean, run 122 still shows only the known drift | 128=[]; 122=[sab] | 128=[]; 122=['sku_sales_allocation_basis_snapshot'] | PASS |
| W5-3 | New capture method reproduces approved capture 11 (run 128) byte for byte | true | True | PASS |
| W5-4 | Close Sep still refused before re-baseline | AU2_CLOSE_FINGERPRINT_DRIFT | AU2_CLOSE_FINGERPRINT_DRIFT: run 122 has 1 drifted tables | PASS |
| W5-5 | Re-baseline 122 without exclusions refused (values differ) | W5_REBASELINE_REFUSED ... values differ | W5_REBASELINE_REFUSED: run 122 does not equal reference capture 4: [{"table": "sku_sales_allocation_basis_snap | PASS |
| W5-6 | Re-baseline 122 against run 128 capture refused | W5_REBASELINE_BAD_REFERENCE | W5_REBASELINE_BAD_REFERENCE: fingerprint 11 is not a capture of run 122 | PASS |
| W5-7 | Excluding a non-existent column refused | excluded column does not exist | W5_REBASELINE_REFUSED: run 122 does not equal reference capture 4: [{"table": "sku_sales_allocation_basis_snap… | PASS |
| W5-8 | Excluding a column that holds values refused | non-null values | W5_REBASELINE_REFUSED: run 122 does not equal reference capture 4: [{"table": "sku_sales_allocation_basis_snap… | PASS |
| W5-9 | Non-designated run 127 with a changed value: drift detected and re-baseline refused | drift [selling bridge]; REFUSED | ['sku_selling_price_bridge_snapshot']; W5_REBASELINE_REFUSED: run 127 does not equal reference capt | PASS |
| W5-10 | authenticated role cannot call the re-baseline function | permission denied | permission denied for function rpc_rebaseline_run_fingerprin | PASS |
| W5-11 | Re-baseline file: 2 journal rows, all tables identical to approved captures 4 and 11 | [(122,4,true,6),(128,11,true,6)] (6 local tables; live 50/51) | [(122, 4, 'true', 6), (128, 11, 'true', 6)] | PASS |
| W5-12 | After re-baseline: run 122 and run 128 verify with zero drift | 122=[]; 128=[] | 122=[]; 128=[] | PASS |
| W5-13 | Re-baseline re-run is idempotent (no extra captures) | 3->5->5 | 3->5->5 | PASS |
| W5-14 | W5 SQL re-run after re-baseline is idempotent | no error | ok | PASS |
| W5-15 | Close Sep accepted on approved run 122 after re-baseline (local, rolled back) | CLOSED 2026-09-01 on approved run 122; CLOSED/FINAL | CLOSED 2026-09-01 on approved run 122; CLOSED/FINAL | PASS |
| W5-16 | Re-baseline journal is append-only | AU2_APPEND_ONLY x2 | True,True | PASS |
| W5-17 | New run 131 success capture records column lists (after-run trigger, unchanged) | RUN_SUCCESS:true | RUN_SUCCESS:true | PASS |
| W5-18 | Add 2 test columns (one with default values): no drift for 122, 128, 131 | [] [] [] | [] [] [] | PASS |
| W5-19 | A removed/renamed hashed column is reported as drift (not an error, not silently ignored) | 128 drift [pricing bridge] | ['sku_pricing_bridge_snapshot']; W5_FINGERPRINT_COLUMNS_MISSING: costing.sku_pricing_bridge_snapshot no | PASS |
| W5-20 | Run 122/128 snapshot data unchanged by W5 + re-baseline (all scoped tables) | identical | True | PASS |
| W5-21 | Full install: only the 2 fingerprint functions + purpose check changed | changed=['F costing.fn_compute_run_fingerprint(p_refresh_run_id bigint)', 'F costing.fn_verify_run_fingerprint… | changed=['F costing.fn_compute_run_fingerprint(p_refresh_run_id bigint)', 'F costing.fn_verify_run_fingerprint… | PASS |
| W5-22 | Full install: added objects | 6 views + 3 functions + 1 table + its constraints | ['F costing.fn_run_fingerprint_current_columns(p_table text)', 'F costing.fn_run_fingerprint_table_hash(p_tabl… | PASS |
| W5-23 | Close / designate / after-run / scope / pointer definitions unchanged | unchanged | True | PASS |

Client: `node --test scripts/costing-run-status/run-status-badge.test.mjs` 8/8 pass; `costing-suite-shell.js` syntax check passes. Not visually checked in a browser (needs the live views).

## 3. Live read-only evidence (no writes)
- Run 122 re-hashed on live with the capture-time column list (all current columns except `monthly_driver_plan_id`): **50/50 tables equal approved capture 4** (`local_test/live_w5_122_fixed.sql`). So the re-baseline is expected to succeed on live.
- Run 128: verify 0/51 drift today; the new method uses the same column set (identity check `local_test/live_w5_identity.sql`), so capture 11 is reproduced.
- Live definition md5s used as install guards: pointer 5cc25791…, v_sku_detailed_cost_sheet d20e3c32…, monthly comparison 7e3254c2… / public b20a9206…, fn_compute 81cb3edc…, fn_verify 708e4c06…, close 12035143…, scoped tables 4d734fed…. Each SQL file stops if any differs.

## 4. Live install outline (only after approval)
1. W1: Supabase MCP `apply_migration` with the W1 file unchanged; postchecks run inside it. Then client branch can be reviewed/merged.
2. W5: `apply_migration` with the W5 file unchanged (postcheck: 128 clean, 122 only the known drift, new capture = capture 11).
3. Re-baseline: run the re-baseline file (separate approval). Postcheck: 122 and 128 zero drift.
4. September close stays a separate decision (not part of W5).
Notes: W5 verify costs the same as today (one hash per scoped table). Re-baseline is one-off and hashes each table twice for run 122/128.
