# MIS G7 — production-catalog replay and integration acceptance (receipt)

Date: 2026-11-24 · Branch `claude/elegant-mccarthy-uunr4q` · Draft PR #522 · Issue #521 · Base main `62b1f12c`
No production write, migration installation, merge, ENFORCE activation, PEC cleanup, Costing change or Electron release was performed.
The production packet stays under git-ignored `.local/mis-g7-prod-baseline/` (260034 bytes, SHA-256 `8ebb31e4…a3`), never committed.

## What was replayed
`supabase/tests/mis_g7/prod_equivalent/load_structured_packet.mjs` rebuilds the catalog from the structured packet (roles, memberships, enums, sequences,
tables, functions with exact source bytes/owners/ACL/config, constraints, indexes, triggers, policies, table/column ACLs). No shim, no seeded fingerprints.

| Check | Result |
|---|---|
| 49 captured function records (deduplicated by identity+fingerprint) | existence, SHA-256 of `pg_get_functiondef`, owner, SECURITY, config, ACL all equal the packet |
| Relations / environment (columns, constraints, indexes, triggers, ACL, owners, RLS, roles) | equal to the packet; the only differences are 23 RLS policies (below) |
| S3, S4, S3b, S4b, S5, S5b applied on the replayed S2 baseline | all install with their LITERAL pinned SHAs; patched core SHA `dfa5a5e9…c1bcc` verified; S3 helper EXECUTE revoked |

## Defect found and fixed by the replay
**S3b referenced `public.citext`; in production citext lives in schema `extensions`** → install failed (`type public.citext does not exist`).
`app_private.mis_g7_type_is_bulk` now takes `text` (comparison semantics unchanged: `label = event_type`). `MIGRATION_IDENTITIES.json` regenerated.
S2 (live, version `20261124055734`) is untouched.

## Acceptance results (PostgreSQL 16.15; **PG17.4 not run** — execution of the downloaded PG17.4 binary was denied by policy and was not circumvented)
* `supabase/tests/mis_g7/prod_equivalent/mis_g7_real_catalog_pg.test.mjs` — **26/26 pass** (replay fidelity ×5; AUDIT legacy logging/FG operations ×4; role/permission matrix ×2;
  signed-stage sign/replay/correct/re-sign and route-gap classes ×2; atomic pack + unit conversion + idempotency + validation + separately authorised measured excess ×3;
  ticketed corrections incl. historical missing-depletion refusal ×2; legacy editor chain replacement ×2; concurrency ×3; ENFORCE readiness refusal → sign-off → protection ×1;
  staged S2-preserving rollback with exact catalog restoration ×1; one documented finding test).
* Original suites unchanged and green: `npm run test:mis-g7` → **142 tests, 140 pass, 0 fail, 2 skipped** (the 2 skips are the pre-existing BLOCKED placeholders in the self-test suite; their business flows are now exercised by the new suite).
* Rollback test: after S5B→S5→S4B→S3B→S4→S3 every pre-S3 function (SHA/owner/security/config/ACL), trigger and table-ACL line equals the S2 baseline; the S2 RPCs still work; signed history retained; original core SHA `df7290df…` restored.

## Real-catalog findings (not defects of the migrations; decisions for the owner)
1. **(Resolved by S6 — see FINAL_RESIDUAL_ACCEPTANCE_RECEIPT_20261124.md.) S2 stage fingerprint includes `daily_work_log.status`.** When a batch is fully packed, the governed reconciliation closes the FG row (`Doing`→`Done`), so the signed stage fingerprint no longer matches:
   later pack/correction calls return `STAGE_SOURCE_CHANGED` until the signer corrects and re-signs the stage (recovery verified in the suite). S2 is live and was not modified. Option: exclude `wl_status` from the fingerprint in a later migration (needs owner approval).
2. **Real ACL**: `authenticated` has no INSERT on `event_skus`, `packaging_events`, `fg_bulk_stock_ledger` (only `daily_work_log`); legacy stock writes happen through `service_role` and the SECURITY DEFINER editor wrapper/core. AUDIT logging and ENFORCE gating are verified on exactly those paths.
3. Real `require_permission` raises (it does not return a refusal) for non-permitted callers; RPC refusals for authorisation are therefore errors, domain refusals are structured JSON.

## Consolidated list of live catalog objects ChatGPT must still extract (referenced by captured objects, absent from the packet)
Functions: `app_has_permission(text,text)`, `app_is_provisioned_user()`, `is_admin()` (needed by 23 RLS policies on `categories`, `product_groups`, `sub_categories`, `sub_groups`, `permission_targets`, `user_permissions_canonical`),
`fn_frozen_valuation_through`, `fn_sku_activation_missing_items`.
Relations: `public.supply_rollup_refresh_queue` (updated by `mark_supply_rollups_dirty()` on every DWL/ledger/packaging write — **replaced by a labelled test-only one-row stand-in**), `public.product_sku_change_log`,
`public.batch_plan_batches`, `costing.effective_date_guard_config`, `costing.effective_date_backdate_log`, `costing.readiness_portfolio_source_epoch`.
Role: `dashboard_user` (referenced by ACLs; created NOLOGIN locally and reported).
Extensions present live but not installable locally and **not referenced by any captured object**: `hypopg`, `index_advisor`, `pg_cron`, `pg_net`, `supabase_vault`.
Master-data fixtures (products, routes, BMR, activities) are inserted under `session_replication_role=replica` because triggers on those tables call the missing objects above; all stock-bearing DML runs with every live trigger enabled.

## Fixtures
Synthetic rows only (`real_catalog_fixture.sql`): no real users, products or business data. Test users are fixed UUIDs with rows in `user_permissions_canonical`.
