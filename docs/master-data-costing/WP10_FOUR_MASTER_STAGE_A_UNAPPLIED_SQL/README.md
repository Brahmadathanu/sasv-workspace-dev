# WP10 four-master Stage A — UNAPPLIED SQL package (review draft)

> **Nothing here has been run against production or any Supabase project, and nothing here is a migration.** The directory is deliberately outside `supabase/migrations`
> (same convention as `WP10_G2_UNAPPLIED_SQL_PROPOSALS`). Applying needs separate, exact, owner-authorised operational approval. **Stage B (REVOKE) is NOT in this package.**
> Electron release HOLD, WP10/WP12 OPEN and 11/13 CLOSED are unchanged.

Scope: `public.categories`, `sub_categories`, `product_groups`, `sub_groups`. Design record: `../WP10_FOUR_MASTER_STAGED_SECURITY_HARDENING_2026-11-18.md` (PR #476).

| File | Purpose | Mutates? |
|---|---|---|
| `01_preflight_readonly.sql` | PASS/FAIL catalog preflight of the ORIGINAL state (policies, RLS/FORCE, grants, helper EXECUTE, 12 RPCs: SECURITY DEFINER / owner-bypass / `require_permission(<module>, true)` target, indirect SQL writers). Also the post-rollback verifier. | no (`BEGIN TRANSACTION READ ONLY`) |
| `02_stage_a_apply.sql` | One transaction: drift guard → drop 4 identity-only `FOR ALL` policies → create 16 policies (SELECT identity-only; INSERT/UPDATE/DELETE gated by `app_has_permission('<module key>','view') AND app_has_permission('<module key>','edit')`) → in-transaction exact end-state assertion. **No GRANT/REVOKE.** | RLS policies only |
| `03_postflight_readonly.sql` | PASS/FAIL catalog proof of the Stage A end state (names, commands, roles, module keys, grants untouched, RPCs intact). | no |
| `99_rollback_stage_a.sql` | Independent exact reversal to the original single `FOR ALL` policy per table. Refuses if amended/partial/already rolled back or if Stage B is applied. **Reopens the known exposure.** | RLS policies only |
| `04_role_acceptance_checklist.md` | Procedure for genuine Editor / View-only / No-access sessions (NOT performed; no evidence is claimed). | — |

## Module → permission key (identical in the four clients' `initializeClassificationAccess`, the live registry snapshot, the governed RPCs' `require_permission`, and Stage A)
`categories`→`module:manage-categories` · `sub_categories`→`module:manage-subcategories` · `product_groups`→`module:manage-product-groups` · `sub_groups`→`module:manage-subgroups`; modes `'view'` AND `'edit'`.

## Revision 2 — authorisation consistency correction (independent live review of PR #477)
The first revision gated direct DML on `app_has_permission(key,'edit')` only. The live `require_permission(key, true)` used by the 12 governed RPCs requires **both** `can_view = true` and `can_edit = true`, so an anomalous canonical row with `can_edit = true, can_view = false` would have been denied by the RPC but allowed to write directly. Stage A INSERT, UPDATE (USING and WITH CHECK) and DELETE policies now require `app_has_permission(key,'view') AND app_has_permission(key,'edit')` — the same canonical helper and keys, no second permission system. The live database reportedly has zero such rows for the four modules; the rule is corrected for consistency, not for an observed exposure. SELECT is unchanged (identity-only). `02`, `03` (Q05 now requires both modes in every write policy), `01` (wording + new INFO `P21` count of edit-without-view rows, no identities) and the tests changed; `99_rollback` is unaffected (it only drops by name and restores the original policy).

## What Stage A does and does not do
- Does: signed-in identities without the module's canonical View AND Edit can no longer INSERT/UPDATE/DELETE/UPSERT the table directly (INSERT/UPSERT error 42501; UPDATE/DELETE affect 0 rows). SELECT is unchanged for every signed-in identity (hierarchy reads, products/BMR/lab/stock screens). `service_role`/owner paths are unchanged.
- Keeps: `authenticated` INSERT/UPDATE/DELETE grants, so genuinely authorised Editors on older direct-writer Electron binaries keep working until the fleet migrates.
- Does NOT: close the gap for authorised Editors using old binaries (they still bypass RPC validation); it is **not full closure**. Only Stage B (separate approval, after verified fleet migration) removes direct DML.

## Deployment instructions (for the person authorised to apply; each step needs its own owner go-ahead)
0. Pre-conditions: PR reviewed independently; this directory's file hashes recorded (`sha256sum`); stable server snapshot/PITR point noted; a View-only, a No-access and an Editor test identity available per `04_`; a maintenance window is not required (policy DDL, `lock_timeout 2s`).
1. Run `01_preflight_readonly.sql` as `postgres` on the target. **Proceed only on `RESULT | PASS`.** Review every `WARN`/`INFO` row (esp. `P17` indirect writers, `P19` editor counts, `P10` helper security). Any `P11–P14` FAIL means the live RPCs differ from what this review assumed — stop.
2. Run `02_stage_a_apply.sql` (single transaction). A refusal message means nothing changed.
3. Run `03_postflight_readonly.sql` — must be `RESULT | PASS` (catalog only).
4. Execute `04_role_acceptance_checklist.md` with real sessions (Editor positive; View-only/No-access negative; hierarchy read; governed RPC). Record results privately; no identities in GitHub.
5. Any authorised Editor wrongly denied, or any RPC failing → stop; prefer forward-fix; rollback (`99_`) only with owner approval and a recorded risk acceptance, then run `01_` (must PASS again).
6. After applying: move the verified SQL into `supabase/migrations` as a "live-applied reconciliation" migration with the real applied version (repository convention), in a separate PR.

## Verified vs not verified (see PR for the exact test counts)
- Verified offline on a disposable local PostgreSQL 16 cluster (stand-in helpers/RPCs; see `scripts/wp10-four-master-stage-a/fixture.mjs` PROVENANCE): permission matrix per table × {own-module Editor (view+edit), other-module Editors, View-only, No-access, edit-without-view (rev 2), uid-less}; INSERT/UPDATE/DELETE/UPSERT; reads; the 12 RPC stand-ins; preflight/postflight/rollback behaviour including refusal and negative controls; data/grant snapshots unchanged.
- **NOT verified:** live PostgreSQL 17.4 behaviour; the real `app_has_permission`/`require_permission` text (the repo does not contain the live definitions; md5s from 12 Nov are recorded in WP05 docs only); the real bodies/owners of the 12 `rpc_wp10_*` functions (none are in `supabase/migrations`) — the preflight `P11–P16` checks assert them at apply time; real JWT/PostgREST sessions; any live identity; installed Electron fleet versions (UNKNOWN).
