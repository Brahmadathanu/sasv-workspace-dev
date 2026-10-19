# W1 + W5 + run 122/128 re-baseline: live install (19 Oct 2026, IST)

Approval: user, 19 Oct 07:12 IST: "Install W1, W5 and the run 122/128 re-baseline". Reference **USER-APPROVAL-20261019-W1-W5-REBASELINE**.
Not done (by instruction): September close, any refresh, cron change, merge.

## Migrations (Supabase MCP apply_migration, files unchanged)
| Version (UTC) | IST | Name | File |
|---|---|---|---|
| 20261019014458 | 07:14:58 | w1_approved_run_feed_and_labels | proposals/consolidation/w1_w5/PREPARED_W1_approved_run_feed_and_labels.sql (md5 475856de…) |
| 20261019014611 | 07:16:11 | w5_fingerprint_fixed_columns | proposals/consolidation/w1_w5/PREPARED_W5_fingerprint_fixed_columns.sql (md5 d678333c…) |
| 20261019014728 | 07:17:28 | w5_rebaseline_runs_122_128 | evidence/W1_W5/APPLIED_W5_rebaseline_runs_122_128.sql (md5 449ab76c…; prepared file with only the approval reference replaced, 2 lines) |

All in-file prechecks (definition md5 guards) and postchecks passed; no guard aborted.

## Verification (live, read-only queries)
| Check | Before | After | Result |
|---|---|---|---|
| Baseline 07:13: run 122 verify | 1/50 drift (sku_sales_allocation_basis_snapshot) | — | as known |
| Baseline: run 122 re-hashed with original column list vs approved capture 4 | 50/50 equal | — | values unchanged |
| Baseline: run 128 verify | 0/51 drift | — | clean |
| Baseline: cron 60/61 | both inactive | both inactive | unchanged |
| W1 feed Sep | — | run 122: 634 SKUs, 74 IK / 70 OK negative | PASS |
| W1 feed Oct | — | run 128: 627 SKUs, 9 / 9 negative, latest approved = true | PASS |
| Feed vs cost sheet (runs 122/128) | — | 0 differences | PASS |
| Labels | — | Jul "DRAFT run 80 - not approved", Aug "DRAFT run 82 - not approved", Sep "Approved run 122", Oct "Approved run 128", Mar/Jun "No successful run" | PASS |
| Governed comparison | — | one run per month: Jul 80 (678), Aug 82 (679), Sep 122 (634), Oct 128 (627); Oct IK price = run 128 for every SKU | PASS |
| Old comparison view (kept) | — | still differs from run 128 on 636 Oct rows (run mixing; the client will switch to the governed view) | info |
| Grants | — | costing.* service_role only; public wrappers authenticated + service_role; anon none | PASS |
| Existing objects after W1 | 2,735 definitions | 0 changed, 6 views added | PASS |
| After W5: run 128 verify | 0/51 | 0/51 | PASS |
| After W5: new hash method vs capture 11 (run 128) | — | 51/51 equal, column lists recorded | PASS |
| After W5: new hash method vs capture 4 (run 122) | — | 49/50 equal, only the known table differs (whole-row) | as expected |
| After W5: re-baseline function execute | — | service_role yes; authenticated/anon no | PASS |
| Re-baseline log | 0 rows | 2 rows: run 122 vs capture 4, 50/50 tables identical, excluded only monthly_driver_plan_id; run 128 vs capture 11, 51/51 identical, no exclusion | PASS |
| New fingerprint captures | ids to 11 | id 12 (run 122, REBASELINE, 50 tables), id 13 (run 128, REBASELINE, 51 tables) | PASS |
| Run 122 verify after re-baseline | 1/50 drift | **0/50** | PASS |
| Run 128 verify after re-baseline | 0/51 | **0/51** | PASS |
| Definitions overall | 2,735 | 2,749: changed only fn_compute_run_fingerprint (81cb3edc → dddd263e), fn_verify_run_fingerprint (708e4c06 → 28df0f2e), fingerprint purpose check (+REBASELINE); added 6 views, 3 functions, 1 table + 4 constraints | PASS (matches local W5-21/22) |
| Designations / periods / runs | 119 REF, 122 + 128 APPROVED; Sep/Oct LOCKED; max run 128; 0 active | identical | unchanged |

Snapshot cost data: not touched (runs 122 and 128 hash identical to their approved captures).

Files here: live_pre_state.json, live_defs_before.json, live_defs_after_W1.json, live_defs_after_W5_rebaseline.json, APPLIED_W5_rebaseline_runs_122_128.sql.
