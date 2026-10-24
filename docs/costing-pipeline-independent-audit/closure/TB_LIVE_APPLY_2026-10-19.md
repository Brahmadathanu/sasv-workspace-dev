# TB1–TB7 live apply (19 Oct 2026, 19:04–19:26 IST)

Approval: USER-APPROVAL-20261019-TB1-TB7 (user, 19:02 IST: "Apply TB1–TB7 live and accept the policy recommendations"). Jarvis was notified by the parent.

Each prepared file was applied unchanged through Supabase MCP `apply_migration`, one file per call. Every guard passed and no apply was aborted. Evidence is in `evidence/TBL/`:
- `state_0_baseline.json`: baseline at 19:04 IST;
- `state_1_after_tb5.json`: state after TB5;
- `state_2_final.json`: final state at 19:25 IST;
- per-view results for the costing user and for an unpermitted user.

| Step | Migration name | Result | Live verification |
|---|---|---|---|
| Baseline | — | captured | Verify mismatches: 119 1/50, 121 1/50, **122 0/50**, 124 1/51, 125 1/50, 126 0/50, 127 0/51, **128 0/51** (legacy drift on 119/121/124/125 pre-dates this work). Feed is 1,261 rows. Cron 60 and 61 are inactive. Sep and Oct are LOCKED. |
| TB1 | tb1_tally_snapshot_write_lockdown | applied | 14 ETL-admin write policies; 0 "any user" CRUD policies left on tally tables. authenticated has 0 TRUNCATE; anon has 0 privileges on 22 tally tables + etl_jobs. Reads by an ordinary user are intact (e.g. purchases 15,819, stock-by-name 535,226, etl_jobs 166,684 rows). The plan for an ordinary user's DELETE is filtered by `is_etl_admin(...)`, which is false for that user, so 0 rows. service_role keeps full rights (BYPASSRLS). The 1 ETL admin is the costing user. |
| TB2 | tb2_costing_view_permission_gate | applied | 62/62 costing views gated (was 13). Unpermitted user: 0 rows in all 61 granted views (1 view is not granted to authenticated). Costing user: 61/61 views have the same row count; checksums are equal except two views whose rows carry `now()` (pricing control dashboard, manual-rate RM blockers). `v_costing_pricing_sku_status_diagnosis` is too slow to checksum within the tool limit; its inner definition is unchanged by guard md5. anon SELECT 0; authenticated write 0. |
| TB3 | tb3_function_search_path | applied | 9 functions now have search_path set. All test outputs are identical to baseline. The advisor no longer lists any costing/tally function as search_path-mutable. |
| TB4 | — (no SQL) | user check | Dashboard > API > Exposed schemas should not list `costing`. |
| TB5 | tb5_ilc_imc_atomic_view | applied | Runs 122/128: 634/627 rows, max prime gap 0.000000 and max ILC gap 0.000000. IMC on 9 SKUs each: ₹14.2740 and ₹2.5500. |
| TB6 | tb6_fingerprint_algorithm_version | applied | 12 existing captures: algorithm_version stays NULL. Method inferred: 1–11 legacy whole-row, 12–13 W5 fixed-column. Defaults are set, so new captures get `W5_FIXED_COLUMNS_V1` plus the table-set md5 (now `c91d7f2a…`). Verify results are identical to baseline for all 8 runs. |
| TB7 | tb7_capacity_value_origin | applied | Class rows: USER_SUPPLIED 11, ASSUMED 2, FIXED_RULE 3. Plant rows (current): USER_SUPPLIED 76, ESTIMATED 23, CLASS_DEFAULT:USER_SUPPLIED 45, CLASS_DEFAULT:ASSUMED 3, ASSUMED 14, MISSING 10. These are identical to the local test. |

## Overall checks (baseline vs final)

Unchanged:
- costing-schema tuple counters (ins/upd/del/live), so no data rows were changed;
- tally row counts;
- runs, designations and fingerprint captures (12);
- verify results (122 and 128 still 0 drift);
- the approved feed md5 (`aed9d8c1…`, both costing and public);
- cron jobs (md5; 60 and 61 still inactive);
- periods (Sep and Oct LOCKED);
- switches;
- the cost-head ledger;
- capacity tables.

The security advisor still lists the costing views under "security_definer_view". They remain owner-rights views, but each now carries the permission gate, so this is accepted.

## Caveat: Tally sync

From now on the Tally agent can write only as `service_role` or as the ETL-admin user. The AU3 expense loader already uses service_role. However, the agent's role cannot be confirmed: `query_logs` is unavailable and there is no agent account.

**Watch the next Tally sync.** If snapshots stop updating, or the agent logs RLS or "permission denied" errors, the agent is using an ordinary user key and must be switched to the service key. Rolling back is not recommended.
