# CI-042 v2.2: lock is state-only, validated quarterly batch lock, finalise without lock, status views (prepared, not applied)

**Design accepted in principle by the independent review. v2.2 makes the three requested corrections and one grant fix.**

- **Lock:** it changes the month's state only. There is no date alignment, and the official date is the approved run's date (derived). The single-month lock stays available for authorised exceptions.
- **Batch lock** (`rpc_costing_lock_periods_for_close`):
  - one calendar quarter per batch, all-or-nothing;
  - refuses a NULL or empty list, NULL entries, duplicates, non-first-of-month dates, mixed quarters and unknown months (`W2_BATCH_*` codes) before locking anything;
  - June–August without approved runs are still refused by the per-month check. There is no bypass and no artificial approval.
- **Month-end finalise:** `rpc_costing_finalize_monthend_run_with_preview` approves through CI-040 with a preview acknowledgement and does not lock. The old 3-argument finalise refuses.
- **Views:** the 18 existing status columns are unchanged and 9 are appended. There are new per-run display views. Grants are reset explicitly, so anon gets nothing despite Supabase default privileges.
- **Rollback:** the default is Mode B while CI-040 is live. The preview finalise keeps working, the old finalise refuses, and the pre-CI-042 lock is restored (align the date first via `rpc_set_cost_period_valuation_date` where needed). Mode A only works with `SET costing.ci042_rollback_mode='A_FULL_CHAIN'` inside the full 043→042→041→040 chain, and only if CI-042 was never used.
- **Verification:** `verify_ci042v22_pre.sql` before the apply and `verify_ci042v22_post.sql` after. Both are mandatory. Apply only if the pre-check is all PASS; roll back if the post-check fails.
- **Tests:** main 158/158, rollbacks 35/35, verify 7/7.
