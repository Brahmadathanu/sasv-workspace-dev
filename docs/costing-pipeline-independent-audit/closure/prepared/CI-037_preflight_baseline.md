# CI-037 production preflight and baseline (read-only, 24 Oct 2026 22:34 IST; SQL from commit 078a0f3)
Raw evidence: CI-037_preflight_baseline.json. No DDL, writes, migrations or refreshes were made.

| # | Check | Result |
|---|---|---|
| 1a | All 47 referenced columns exist (pricing bridge, selling-price bridge, selected scheme, sku_selling_price_policy, costing_refresh_run, designation view) | PASS (0 missing) |
| 1b | Functions exist with the expected signatures: fn_guard_designated_run_rows() → trigger; fn_guard_snapshot_truncate() → trigger; rpc_refresh_manufacturing_cop_chain(date,date,bigint); fn_verify_run_fingerprint(bigint) | PASS |
| 1c | Hook anchor appears exactly once in the live chain; hook not present; chain md5 2881dde4… equals the pre-change snapshot | PASS |
| 1d | New names free: sku_pricing_bridge_profit_snapshot, costing_contingency_rate_policy, its unique index, fn_ci037_fill_pricing_bridge_profit | PASS |
| 1e | Migration history: latest 20261024115131 wp07_ux1_roles_worklist; no ci037 or ci031 entries. apply_migration stamps a new timestamp version, so there is no collision. Planned name: `ci037_profit_chain_v3` | PASS |
| 1f | Staged processor `fn_process_next_costing_refresh_stage_internal`, stage 03_COST_BUILD_TO_SCHEME, calls the 3-argument chain, so the hook will run in real refreshes | PASS |
| 2a | Fingerprints for designated runs 119/122/128/136/140/143: 304 checks, aggregate e24fdba6178844b29b5360b8e258e929, single mismatch 119 sku_sales_allocation_basis_snapshot (existed before CI-037) | PASS (matches expectation) |
| 2b | View: md5 043180a4a2beb361b518410df0182293 (equals the snapshot); 64 columns in order (listed in the JSON); owner postgres; relacl NULL; reloptions NULL; SELECT anon/authenticated/service_role = false, postgres = true; 22 comments (md5 cd25d82a…); 627 rows, all run 143 | PASS |
| 2c | Run 143: overall SUCCESS, Oct 2026, valuation date 22 Oct, designation APPROVED. Legacy margin md5 per run recorded. Pricing bridge has 48 columns; the 4 legacy columns have no comment yet | PASS |
| 3 | CI-031 conflict: CI-031 comments only on costing.batch_true_standard_switch.rate_basis, batch_true_absorption_variance(.rate_basis and table), and constraint batch_true_standard_switch_rate_basis_check. CI-037 comments on sku_pricing_bridge_snapshot margin columns and new objects. No overlapping object. CI-031 is not applied live (comment NULL, no migration) | PASS: no conflict. Order: CI-031 first (comments only), then CI-037; either order is safe |
| 4 | Controlled non-designated trial | CORRECTED after apply: BLOCKED by fn_guard_designated_run_header (AU2_PERIOD_HOLDS_APPROVED_RUN). A run in October needs a recorded costing_period_refresh_authorization; see CI-037_LIVE_APPLY_2026-10-24.md |
| 5 | Approval text and apply plan | See below |

## 4. Trial run: possible, with conditions
- **Periods:** October is the only OPEN period (valuation date 22 Oct, DRAFT). November does not exist, and creating it would be a period-governance change, so November is not used.
- **Request path:** `fn_request_costing_refresh_internal` creates a QUEUED run for the OPEN period at its current valuation date. Callers are public.rpc_request_costing_refresh(date,text,text,text) and the scheduled and daily requests. Cron 68 processes it every 5 minutes.
- **Run 143 stays safe:** a new run is non-designated, so the feed stays on run 143, because APPROVED ranks first in v_current_successful_costing_refresh_run. Run 143's rows are protected by trg_au2_designated_run_guard.
- **Precedent:** this is the same path as ADMIN_VERIFICATION runs 138–140.
- **The October period is not changed:** its status, valuation date and lock fields are untouched.
- **Cron caution:** cron 66 (Sunday 20:30 UTC = **Mon 26 Oct 02:00 IST**) and cron 67 (28–31 Oct, 02:00 IST) create October runs automatically. After apply, those runs will run CI-037 without any manual trial.
- **Safe method:** one manual request after apply and verify:
  `select * from costing.fn_request_costing_refresh_internal(date '2026-10-01','FULL_COSTING_REFRESH','ADMIN_VERIFICATION','CI-037 integration trial (non-designated)',null,false);`
  The last argument (false) means no period is auto-created. The public wrapper rpc_request_costing_refresh needs a signed-in user (auth.uid() plus a permission check), so it cannot be called from the backend.
  Then wait for SUCCESS and run CI-037_verify.sql step 10. Do not designate the trial run.
- **Consequences:**
  - After any run writes CI-037 rows, only rollback B (unhook) applies.
  - If the helper raises an error (cardinality, or no governed rate), that refresh fails at stage 03 instead of succeeding.

## 5. Apply plan (each live step needs the owner's approval)
0. **Gate:** no costing run QUEUED or RUNNING (`select id, overall_status from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')` must return 0 rows). Keep clear of the cron 66 window (Mon 02:00 IST).
1. **Notify Jarvis** (645028a6-4dfb-42f4-9561-b6e941d695a3) that CI-037 is about to be applied.
2. **Re-run the preflight** (the chain md5 and view md5 must equal this baseline), then apply CI-037_profit_fix.sql via apply_migration as `ci037_profit_chain_v3`.
3. **Verify** with CI-037_verify.sql:
   - fingerprint aggregate unchanged (e24fdba6…, with the single run 119 mismatch);
   - legacy md5s unchanged;
   - view 79 columns: the first 64 identical, same owner, privileges and 22 comments;
   - hook present once;
   - guards on the new table;
   - exactly one APPROVED contingency policy (2%, POST_DISCOUNT_EX_GST_SELLING_PRICE);
   - 0 CI-037 rows for designated runs.
   - **If any check fails:** run rollback A immediately.
4. **Optional trial** (separately approved): the manual ADMIN_VERIFICATION request in §4, then check that statuses are CALCULATED and that SKU 975 IK is about −₹8,111.95.
5. **Close:** update the register. **If the trial fails:** use rollback B (rollback A is no longer allowed once rows exist).
