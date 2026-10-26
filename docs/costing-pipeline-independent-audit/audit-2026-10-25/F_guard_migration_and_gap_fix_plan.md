# F — Job 66 check, CI-038 SKU activation guard (prepared), and SKU gap-fix plan
Prepared 26 Oct 2026, ~08:00 IST. Live DB: SELECT / EXPLAIN only. No writes, no migrations, no repo changes, no messages.

## 1. Cron job 66 (weekly draft) — FAILED, harmlessly
- Ran 26 Oct 2026 02:00:00 IST (20:30 UTC 25 Oct), failed after 0.15 s.
- Error: `costing.rpc_request_scheduled_costing_refresh_internal()` inserts a period audit row with `event_source = 'CRON_SCHEDULED'`, but the check constraint `cost_period_governance_audit_event_source_chk` only allows `MIGRATION / SYSTEM / GOVERNED_RPC`. It is a latent bug in the scheduler; the job has never succeeded.
- Effect: the whole statement rolled back. October period is unchanged (OPEN, valuation date still 22 Oct 2026, DRAFT); last audit row is still id 21 (24 Oct); **no new costing refresh run was created** since 25 Oct. Run 143 (Oct, val 22 Oct, SUCCESS, 627 SKUs) untouched.
- **Impact ahead:** job 67 (month-end, 28–31 Oct 02:00 IST) calls the same function, so it will fail the same way from 28 Oct. Job 66 will fail every Monday.
- Fix (needs your authorisation, separate small migration, suggested CI-039): either add `'CRON_SCHEDULED'` to the allowed list in the constraint, or change the function to write `'SYSTEM'`. Recommend adding the value, so scheduled changes stay distinguishable in the audit. Not prepared yet. Also needs a decision: should the scheduler move the October valuation date forward while run 143 is approved? It tried to move it from 22 Oct to 26 Oct. The period guard would then need a supersession authorisation for any new run.

## 2. CI-038 migration (prepared, NOT applied)
Files in `/workspace/migrations-prep/`:
- `20261026090000_ci038_sku_activation_guard.sql`: the migration (CI-038 is the next free number; docs go up to CI-037).
- `20261026090000_ci038_sku_activation_guard_ROLLBACK.sql` + `rollback_preimage_rpc_set_product_sku_active.sql` (the live function body, captured today).
- `verify_ci038_after_apply.sql`: read-only checks after apply.
- `test_stub_schema.sql`, `test_ci038.sql`, `test_results_local.txt`: the local test.

What it does:
1. `costing.fn_sku_activation_missing_items(sku, product)`: STABLE, SECURITY DEFINER, fixed search_path, no grants to anon/authenticated. It checks the 5 essentials with the **same resolvers** as the readiness RPC (`plm_sku_bom_revision_as_of`, `production_batch_size_ref`, route family + `fn_validate_effective_product_process_route`, `fn_resolve_sku_mrp_as_of`, `fn_resolve_sku_selling_price_policy_as_of`). It returns the list of missing items with plain labels and the screen to use.
2. **Date:** this is the valuation date of the latest costing period (`max(period_start)` in `costing.cost_periods`, currently Oct 2026, valuation date 22 Oct 2026). That is exactly how the readiness RPC picks its as-of date for a period. Fallback is today if the valuation date is not set. Consequence (tested, T4): a policy that takes effect only from a future date (e.g. MRP from 1 Nov) does not count until a period with a later valuation date opens. This is intended, but users must enter policies with an effective date on or before the current valuation date.
3. Trigger `trg_sku_activation_completeness_guard` (BEFORE INSERT / UPDATE OF is_active, product_id on `public.product_skus`): fires only on insert-as-active or inactive→active. It catches the app, the SQL editor and the service role. No exemptions (sample SKUs included, T10). A brand-new SKU can never be inserted active, because its SKU-level BOM and policies cannot exist yet, so creation must be inactive first. The app already creates SKUs as inactive.
4. `rpc_set_product_sku_active` is the same body plus a pre-check: "This SKU cannot be made active yet. Missing: …". Grants are preserved.
5. `public.rpc_get_sku_activation_check(sku)`: read-only, authenticated plus manage-products view permission, for the Manage Products screen to show the missing items before Activate (Cursor client work).
6. **Audit of direct edits:** new `public.product_sku_change_log` with an AFTER trigger on every insert, update or delete. It records old and new row, changed columns, the app user (null = not an app user, i.e. SQL editor or service role), DB role, application name and transaction id. RLS is on and there are no client grants. The existing `product_sku_master_audit` cannot hold these rows because `actor_user_id` is NOT NULL and a reason is required, so a separate log is the minimal option.

Tests:
- **Local PostgreSQL 17 copy with stubbed resolvers: 11/11 behave as designed.**
  - T1 complete → activates and is audited.
  - T2 RPC → friendly message listing all 5.
  - T3 direct UPDATE → blocked.
  - T4 future-dated MRP → blocked.
  - T5 insert-active → blocked.
  - T6 insert inactive incomplete → allowed.
  - T7 edit an already-active incomplete SKU → allowed.
  - T8 deactivate with no app user → allowed and logged with a null actor.
  - T9 re-activate → blocked.
  - T10 sample → blocked.
  - Grants: anon has no access; authenticated can call only the check RPC.
  - Rollback A ran cleanly: triggers, functions and log removed, RPC restored, activation unguarded again.
- **Live, read-only:**
  - Every function and table the helper uses exists with the expected signatures.
  - The single-product route logic matches the official `fn_product_process_route_readiness` for all 593 active products (0 mismatches).
  - The 5-item check takes about 32 ms for 5 SKUs (~6 ms each), well under the 300 ms target.
  - **Active SKUs failing today: 0 of 627.** Inactive SKUs failing: 1,159 of 1,166. They would be blocked at reactivation until fixed.
- Not tested: the migration against the real live schema (it was not applied, by rule). The existing live triggers on `product_skus` (active-product guard, price-list guard, readiness epoch) were not stubbed, so trigger ordering with them is untested. Alphabetical order puts the price-list and active-product guards and ours all BEFORE; the order does not change the outcome.

Rollback:
- **A (immediate):** drop both triggers and the 3 new functions, restore the RPC pre-image, drop the log table. Lossless, because CI-038 changes no business data.
- **B (after use):** the same, but keep the log by renaming it `product_sku_change_log_ci038_archive`.
- `\i` is psql-only. For MCP apply, paste the pre-image body.

Side effects to note:
- `scripts/product-sku-lifecycle-smoke.mjs` may fail if it activates an incomplete test SKU. Check or adjust it with the client work.
- Any bulk reactivation must fix data first.

## 3. Gap-fix plan for SKUs 1797, 333, 603 — NO FIX NEEDED (already complete)
Live re-check, per SKU, at the Oct 2026 valuation date 22 Oct, using the underlying resolvers (read-only):

| SKU | PM BOM | Batch size | Route | MRP | Selling/GST | Run 143 |
|---|---|---|---|---|---|---|
| 1797 Special Medicine 2, 5 g | rev 684 | ref 549 (from 4 Sep) | READY | RESOLVED | RESOLVED | priced, READY |
| 333 Mahavathanthaka Thailam 50 mL | rev 204 | ref 552 (from 30 Sep) | READY | RESOLVED | RESOLVED | priced, READY |
| 603 Jathyadi Ghritham 50 mL | rev 277 | ref 553 (from 30 Sep) | READY | RESOLVED | RESOLVED | priced, READY |

Why the 5 Oct snapshot flagged them: it was evaluated for September. For 333 and 603, the old batch references ended 29 Sep and the new ones start 30 Sep. SKU 1797's policies were added after the build. The data has since been completed, so there is nothing for you or the data owners to enter. Before applying the guard, the readiness portfolio should be rebuilt for October (a server write; needs authorisation, optional) so that screens stop showing the stale BLOCKER.

## 4. Needs your approval
1. Apply CI-038 (via Supabase MCP `apply_migration`, after notifying Jarvis).
2. A small CI-039 fix for jobs 66 and 67 (constraint or event source), plus a decision on whether the scheduler may move October's valuation date while run 143 is approved. It is urgent before 28 Oct if you want month-end drafts.
3. Optional: rebuild the October readiness portfolio.
4. A Cursor client item: the Manage Products pre-check using `rpc_get_sku_activation_check`.

## 5. Unverified
- The CI-038 SQL has not been compiled against the real live schema, only against local stubs with the same names and signatures. The live dependency checks were done read-only.
- Who or what the unaudited edits to SKUs 17 and 114 were: you said it was you. The new log will capture such edits going forward.
