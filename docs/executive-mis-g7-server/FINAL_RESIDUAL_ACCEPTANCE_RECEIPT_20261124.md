# MIS G7 — final residual acceptance receipt (supersedes finding 1 of REAL_CATALOG_ACCEPTANCE_RECEIPT_20261124.md)

> **STATUS NOTICE (24 Nov 2026, supersedes any older "HELD / HOLD / not installed / 6/11" wording below).** All eight G7 migrations (S2, S3, S4, S3b, S4b, S5, S5b, S6) are LIVE on production PostgreSQL 17.4 under registered versions `20261124055734`, `20261124080858`, `20261124080913`, `20261124080932`, `20261124080952`, `20261124081009`, `20261124081022`, `20261124081034` (see `MIGRATION_IDENTITIES.json` / `MIGRATION_DEPLOYMENT_MAP.md`). Production is in **AUDIT** mode; core gate `CORE_MIGRATION_NOT_ACCEPTED`; patched core SHA-256 `dfa5a5e9…1bcc`; no new MIS permission assigned; no synthetic production signatures or packing requests; ENFORCE prohibited. **G7 OPEN 7/11 (64%), G8 parked.** The text below is preserved as the contemporaneous record of its date and is not rewritten.


Branch `claude/elegant-mccarthy-uunr4q`, draft PR #522, from `6064ce3`. No production write, migration installation, merge, ENFORCE activation, PEC cleanup, unrelated Costing change or Electron release.
Packets (git-ignored, never committed): baseline 260034 bytes `8ebb31e4…a3`; supplement 101367 bytes `5861d7da…9b2`.

## 1. Residual catalog acceptance
* Loader merges baseline + supplement by identity (**73 unique functions, 45 relations**, 8 identical duplicate relations collapsed; a conflicting duplicate function/relation/policy/role/sequence is rejected — tested).
* **All 23 RLS policies restored** from the captured predicate functions (`app_has_permission`, `app_has_permission_core`, `app_is_provisioned_user`, `is_admin`); real policy behaviour tested (a non-admin sees only their own `user_permissions_canonical` rows and cannot write permission rows).
* `supply_rollup_refresh_queue` is now the **actual captured relation** (ACL, RLS policy, PK); the stand-in is gone; queue bumps verified for DWL, ledger, event and RPC packing and not for a refused call.
* `dashboard_user` (CREATEROLE CREATEDB REPLICATION), 8 sequences and the `costing.v_costing_run_effective_designation` view reproduced and verified.
* 72 of 73 functions match the packet exactly (SHA-256/owner/security/config/ACL). **Remaining replay gaps (all Costing, none on the stock path — proven by scanning every captured stock function):** type `public.plm_bom_revision` (needed to create the captured `plm_sku_bom_revision_as_of`), `costing.fn_costing_run_scoped_set_md5()` (column default), `fn_compute_run_fingerprint`, `fn_resolve_effective_product_process_route`, `fn_resolve_effective_route_family_route`, `fn_validate_product_process_route`, `fn_validate_route_family_route`.
* Narrow documented exception: synthetic **master data only** (sections…products, routes, BMR) is inserted with `session_replication_role=replica` to isolate the Costing activation/approval guards that need the objects above. **All stock-bearing DML (DWL, packaging events, SKU lines, ledger, transfers) runs with every live trigger, RLS policy and ACL active.**

## 2. ACL correction — before/after matrix (replayed live catalog; `ACL MATRIX` tests)
| Authenticated INSERT | before S3b | after S3b |
|---|---|---|
| daily_work_log | TRUE | TRUE |
| event_skus | FALSE | FALSE |
| packaging_events | FALSE | FALSE |
| fg_bulk_stock_ledger | **TRUE** (SIUD) | **FALSE** (SELECT only) |
| fg_bulk_internal_transfer | TRUE | TRUE |
Every other table privilege for authenticated/anon/service_role is identical before and after. Function EXECUTE for authenticated: `fn_fg_auto_zero` and `fn_fg_ledger_add` TRUE→FALSE; mark-done wrapper, force-close wrapper unchanged; `fn_fg_reconcile_batch` and legacy 3-arg force-close never client-executable.
Mutation findings (replay of the captured catalog):
1. **Before S3b** direct authenticated ledger INSERT/UPDATE/DELETE and internal-transfer INSERT all FAIL with `permission denied for function fn_fg_reconcile_batch`: the captured ledger statement triggers are SECURITY INVOKER and call a function authenticated cannot execute. The CRUD RLS policy and table grants alone would have allowed them. **After S3b** direct ledger DML is refused at the table (`permission denied for table`), and the internal transfer now **works** for an authenticated user (definer chain: legs posted, UPDATE rebuilds, DELETE removes, over-transfer still refused by the live negative-stock guard).
2. **Before S3b** any authenticated user, with no permission, could EXECUTE `fn_fg_auto_zero` (no gate); after S3b it is refused.
3. `fn_fg_ledger_add` in the captured catalog references columns that do not exist (`ref_table`, `ref_id`) and cannot run (dead legacy function); S3b additionally closes its EXECUTE.
4. Authenticated direct DWL INSERT is refused by the captured RLS in both states (only a SELECT policy is captured for daily_work_log); the trusted `service_role` receipt path posts the FG receipt in both states. **Ask for ChatGPT:** confirm read-only whether live has an authenticated INSERT policy on daily_work_log (the captured catalog has none) and whether live internal transfers by authenticated users currently succeed (the replay says they fail before S3b).
Preserved after S3b (tested): trusted DWL receipt, internal transfer, governed editor (identical stock result before/after for a signed chain create), atomic packing (new), force-close wrapper and mark-done (same permission module, same Done/zero result before and after).

## 3. FG receipt fingerprint (S6, forward-only, owner review)
`20261123151000_mis_g7_s6_fg_stage_fingerprint_excludes_inventory_status.sql` replaces only `app_private.mis_stage_fp`. FG_BULK payload omits `wl_status`; all other evidence is kept; non-FG payload byte-identical to S2 (tested against the S2 formula; a status change still invalidates a non-FG stage). Preconditions (fail closed, no rewriting): live function must equal the S2 definition `69445f98…3434` and no uncorrected FG_BULK signature may exist (live count verified 0; tested refusal with 1 signature, install after correction). Rollback section `S6 ROLLBACK` restores the exact S2 function and states that any signature made under S6 will then need correct+re-sign; S2 untouched. Tested: governed auto-closure (Doing→Done) keeps the signature valid and a later governed correction succeeds with **one** signature in history; control DB without S6 shows `STAGE_SOURCE_CHANGED`; status flips (Doing/In Storage/Done) leave the fingerprint unchanged while quantity, UOM, activity, batch identity, BMR, route and date each change/void it and the pack path then refuses until correct+re-sign.

## 4. Final regression (PostgreSQL 16.15; PG17.4 execution remains denied by policy, not circumvented)
* `npm run test:mis-g7`: **150 tests, 148 pass, 0 fail, 2 skipped** (the 2 skips are the pre-existing BLOCKED placeholders in the self-test suite).
* Real-catalog suite `mis_g7_real_catalog_pg.test.mjs`: **34/34 pass** (replay/merge/RLS/queue/role/sequence/view; AUDIT legacy; permission matrix; stage sign/correct/re-sign; atomic pack + excess; corrections incl. historical missing depletion; editor chain; concurrency; ENFORCE readiness refusal → sign-off → protection; ACL matrix before/after; S6 ×4; staged rollback S6→S5B→S5→S4B→S3B→S4→S3 with exact catalog restoration incl. `app_private` and the S2 fingerprint function).
* Patched legacy editor core SHA unchanged: `dfa5a5e9aa31b48cf41fe9d03800fff2e35e5a3825ca458b5ccb6ca6c4471bcc` (original `df7290df…` restored by rollback).

## 5. Migration identities (file SHA-256, git blob prefix)
| # | file | sha256 | blob |
|---|---|---|---|
| 1 | `s2_signed_batch_stage_events.sql` | `a70ae4a41bf9063803e50496e76b5ccb922251dc3fd8b551a0f041f8a95c0131` | `055b1cdfa1c8` |
| 2 | `s3_fg_ledger_shared_batch_lock.sql` | `ac8813aaef7b0621bc9f1a28127e11f3cf62d04abeae297402a0eac1020c9b33` | `3f2ce1bc3dae` |
| 3 | `s4_atomic_pack_with_measured_excess.sql` | `c1f4648a5921203f8a28aaa5708d0f25af41aa01b8903d82c7e8675ee25d38de` | `f0d3bef001c3` |
| 4 | `s3b_protected_stock_write_boundary.sql` | `cbdf9c1c8d27cf0f14ebc985fb034d4198f0c31dd6ff683fa028ebdfaa1929cf` | `218739f7962c` |
| 5 | `s4b_ticketed_pack_corrections_and_enforcement_control.sql` | `dc0c97b0afd4aeae77cd1c40ec3dc7637d7628a39db4e56a2391202b9af87a3c` | `4866c3db314b` |
| 6 | `s5_legacy_dwl_editor_chain_protection.sql` | `e38615b25f20a41a643b2670a1d3df46e1c2e99185f87241c07d8a0a762173a0` | `0c437af48514` |
| 7 | `s5b_legacy_dwl_editor_core_integration.sql` | `4dee96b7784e7196132db47f2bfaf0bff44e595645e9c5e676b79a48d727e56d` | `642126f850a2` |
| 8 | `s6_fg_stage_fingerprint_excludes_inventory_status.sql` | `c429b4d888e40b7232551db4e6a1f011e5b0cb1830ce4d1d17a5b2b2222d680e` | `af5bceee5135` |
S2 (row 1) is byte-identical to the installed blob `055b1cdf…` (registered `20261124055734`); rows 2–8 HELD.

## 6. Remaining material production blockers
1. Owner authorization for each held migration (S3, S4, S3b, S4b, S5, S5b, S6) and the S5b core sign-off; ENFORCE stays off.
2. The two live-confirmation questions in §2 item 4 (DWL INSERT policy; internal transfer behaviour before S3b).
3. Costing-only dependencies not captured (§1) — needed only for a full Costing replay, not for G7.
4. PostgreSQL 17.4 not executed; local PG16 differs (MAINTAIN privilege) — a read-only/branch-database dry run on 17.4 is still advisable before owner approval.
