# W1/W5 migration parity: live vs prepared SQL (19 Oct 2026 07:40 IST)

**Method:**
1. Took the live definition hashes after install (`live_defs_after_W5_rebaseline.json`, read-only query). Each hash is the md5 of `pg_get_viewdef` / `pg_get_functiondef` / column list / `pg_get_constraintdef`.
2. Applied the three committed files unchanged to the local PG 17 copy of the live definitions (TimeZone UTC, same as live) and computed the same hashes:
   - `PREPARED_W1_approved_run_feed_and_labels.sql`
   - `PREPARED_W5_fingerprint_fixed_columns.sql`
   - `APPLIED_W5_rebaseline_runs_122_128.sql`
3. Compared every object that changed or was added on live against the baseline (`live_defs_before.json`).

**Result: 17/17 identical.** No object changed on live other than these 17.

| Object | Live md5 | From prepared SQL | Match |
|---|---|---|---|
| F costing.fn_compute_run_fingerprint(p_refresh_run_id bigint) | dddd263ea9de9f1308dda6e4fcd47196 | dddd263ea9de9f1308dda6e4fcd47196 | yes |
| F costing.fn_run_fingerprint_current_columns(p_table text) | 0e98d2ee62f4380c683ea2b8e40f7f79 | 0e98d2ee62f4380c683ea2b8e40f7f79 | yes |
| F costing.fn_run_fingerprint_table_hash(p_table text, p_refresh_run_id bigint, p_cols text[]) | d882496bb0c095c8cbf15389f34419bc | d882496bb0c095c8cbf15389f34419bc | yes |
| F costing.fn_verify_run_fingerprint(p_refresh_run_id bigint) | 28df0f2e8b145e3c700df72c58765758 | 28df0f2e8b145e3c700df72c58765758 | yes |
| F costing.rpc_rebaseline_run_fingerprint(p_refresh_run_id bigint, p_reference_fingerprint_id bigint, p_excluded_columns jsonb, p_rebaselined_by text, p_reason text, p_approval_reference text) | 10077cdb031148ea2f56511b3c23b5e6 | 10077cdb031148ea2f56511b3c23b5e6 | yes |
| K costing.costing_run_fingerprint.costing_run_fingerprint_purpose_check | 32b22bf73bf106b77fbf03b275ce46bd | 32b22bf73bf106b77fbf03b275ce46bd | yes |
| K costing.costing_run_fingerprint_rebaseline.costing_run_fingerprint_rebaseline_approval_reference_check | f00d574e3b1ae9eca00e073c50d07467 | f00d574e3b1ae9eca00e073c50d07467 | yes |
| K costing.costing_run_fingerprint_rebaseline.costing_run_fingerprint_rebaseline_pkey | 4c6419b3704337bbfe50f018842a9ad3 | 4c6419b3704337bbfe50f018842a9ad3 | yes |
| K costing.costing_run_fingerprint_rebaseline.costing_run_fingerprint_rebaseline_reason_check | ed8de7c06becb98cf3bb6fbf36b61bde | ed8de7c06becb98cf3bb6fbf36b61bde | yes |
| K costing.costing_run_fingerprint_rebaseline.costing_run_fingerprint_rebaseline_rebaselined_by_check | 525d0bd2731dea26295a191ce22fd4fd | 525d0bd2731dea26295a191ce22fd4fd | yes |
| T costing.costing_run_fingerprint_rebaseline | 20c8d1eeaf6f8ae02c885da8d98af044 | 20c8d1eeaf6f8ae02c885da8d98af044 | yes |
| V costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed | 63adf7946b8d7f99a01a05e5e54d00be | 63adf7946b8d7f99a01a05e5e54d00be | yes |
| V costing.v_costing_period_run_status | d38be6e4c0c8bb9811f4872b78e72936 | d38be6e4c0c8bb9811f4872b78e72936 | yes |
| V costing.v_price_revision_feed_approved | 628a0ab31d675334fb61de6fa936c1d8 | 628a0ab31d675334fb61de6fa936c1d8 | yes |
| V public.v_cost_sheet_snapshot_sku_monthly_comparison_governed | 3382dc88e1db5589d5855ba858478c31 | 3382dc88e1db5589d5855ba858478c31 | yes |
| V public.v_costing_pricing_period_run_status | 490345425d4204741d52b8ca70fbbcb3 | 490345425d4204741d52b8ca70fbbcb3 | yes |
| V public.v_costing_pricing_price_revision_feed_approved | 5bf957f5e4628cccfb2ce0421c8b6c0e | 5bf957f5e4628cccfb2ce0421c8b6c0e | yes |

**Migration versions on live** (`supabase_migrations.schema_migrations`):
- 20261019014458 w1_approved_run_feed_and_labels
- 20261019014611 w5_fingerprint_fixed_columns
- 20261019014728 w5_rebaseline_runs_122_128

**Triggers:** `costing_run_fingerprint_rebaseline` has `trg_au2_append_only` (before update/delete), as prepared.
- Gap found: the live fingerprint and designation tables also carry a **truncate** guard (`trg_au2_append_only_truncate`); the new rebaseline table does not.
- Only the owner can truncate it (no client grant), so the risk is low. It is proposed as a one-line hardening item in the W2 package.
