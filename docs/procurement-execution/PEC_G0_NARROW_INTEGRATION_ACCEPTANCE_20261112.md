# PEC G0 | Narrow server integration review — 12 Nov 2026

Related: ERP master #284, hybrid S4 #305, broad documentary branch PR #287.

## Purpose and exact scope
This branch starts from current `main` and retains **only seven server migrations** for the owner-approved four-item UOM and procurement-writer corrections. The broad docs branch #287 is 76 commits ahead and 20 behind `main` at the initial comparison; **do not directly merge its entire history**.

Migration order:
1. `20261112110000_pec_four_gram_material_bom_normalization.sql` — idempotent, exact 13-item Kg→g BOM line correction with old/new-state assertions and governed conversion factor; unchanged Gomatha correction is verified.
2. `20261112114000_pec_uom_and_internal_pr_guard.sql` — strict MRP UOM factor, normalized RM gross requirement view, safer *future* MRP monthly rollup, and internal-class exclusions in PR create/rebuild and PR→indent create/resync.
3. `20261112122500_pec_revision_and_manual_indent_internal_guard.sql` — new PR revision filtering and manual-indent no-new/increase guard while preserving legacy reductions.
4. `20261112133000_pec_manual_pr_internal_item_guards.sql` — manual PR add/quantity-delta forward-only protections.
5. `20261112143000_pec_safe_resync_preserve_manual_lines.sql` — corrected SAFE resync preservation of unmapped manual indent lines, keeping RESET fully restorative.
6. `20261112150000_pec_mrp_uom_factor_auth_rbac.sql` — scoped SECURITY DEFINER helper so authenticated calculations can read governed conversion factors without opening the UOM-conversion table.
7. `20261112152000_pec_mrp_rollup_use_strict_factor.sql` — align future MRP monthly rollup with the same fail-closed conversion policy; no refresh invoked.

**IMPORTANT:** migration #5 supersedes the indent-resync function version in migration #2. Apply strictly in timestamp order. These changes have already been applied live in project `qhmoqtxpeasamtlxaoak`; the migrations establish source-control lineage, and the first guarded BOM step was verified in a rolled-back readback on the corrected production state.

## Database-level acceptance (rollback only, no published test data)
- Source PR #1 → draft PR revision: **450 lines** (49 internal classified source rows omitted).
- Draft PR revision → generated indent: **206 positive eligible lines**, **zero internal material lines**, **206 mapped PR/indent lineages**.
- Post-rollback checks: **zero** persisted test PR headers, indent headers, mappings or audit events.
- SAFE resync: a manually inserted Ampar #64 10g line survives; one zeroed PR-mapped line is removed; **205 PR-mapped + 1 manual = 206** final lines.
- RESET resync: manual Ampar line is removed; **206 PR-mapped lines** restored.
- Manual-indent writer denies new/increased internal buying; earlier actual writer denial test passed and historical approved indent line quantity stayed unchanged.
- Approved indent #84 reduction 260→259 Nos passed the class reduction guard, but **snapshot refresh correctly refused an unauthenticated administrative SQL session**; no approved line was changed.
- The strictly bounded four-item BOM guard executed in `BEGIN...ROLLBACK` after the live correction, without exception.

## Remaining blocker before merging / formal G0
1. **CI/migration replay in target environment, including live-to-repo schema drift and secure view access.** Several adjacent MRP views use `security_invoker=true`; the normalized RM view currently retains the live preexisting reloptions and should not be changed blindly. Test with actual authorized JWT session.
2. **Authorized PEC editor acceptance** for public RPC create/revise/indent and approved-indent decrement → snapshot request/publish. No fake JWT/permission grant to manufacture a pass.
3. **MRP plan owner decision**: old Dec 2026 run has 357 products vs current plan 141; destructive rebuild was held because 250 old products no longer appear and 46 quantities differ. Preserve existing run until explicit rebase approval. This PR does NOT invoke a rebuild.
4. **Historical seven open internal indent balances** across four headers require operator lifecycle review, not automatic cancellation.
5. **S4 hybrid consumption-floor writer remains disabled**; not part of this PR.

The formal PEC G0 ledger is **0/6 gates verified**. Substantial source- and DB-internal acceptance exists, but no assertion of completed hosted/authenticated acceptance.

**Release governance:** draft integration PR; do not merge until owner approval, CI, review and accepted session tests. No Tally purchase-order dependency.

## Narrow integration replay — execution evidence (12 Nov 2026)

The original ordered five-migration SQL payload was fetched from this clean branch and executed in **one explicit BEGIN…ROLLBACK** against the existing live schema, removing only the embedded transaction wrappers. **PASS**, with `non_gram_bom_lines=0` and `safe_resync_guard=1` in transactional readback. This tests **already-corrected production-state compatibility**, not a complete blank-schema rebuild or authenticated UI. No production changes were committed by this replay.

GitHub compare after opening draft integration PR: branch **6 commits ahead / 0 behind main**, exactly **6 changed files** (five migrations + this report). Netlify deploy-preview status reported **success** for PR #317. This is a deployment-preview status only, not evidence that the authenticated procurement workflow was executed.

**Review disposition:** narrow PR #317 can move to independent review/CI. Do not merge while authorized PEC editor positive-path, view JWT/RLS parity and owner approval remain outstanding. Keep documentary PR #287 unmerged and do not apply its full diverged commit history.

## Live postmigration regression guard and G0 baseline progress (12 Nov 2026)

A new **SELECT-only/asserting SQL** verifier `scripts/pec-g0-postmigration-contract-verify.sql` (commit `b5be2c0`) was run on live SASV Supabase and returned `PEC_G0_POSTMIGRATION_PASS`. It verifies Kg→g=1000, reciprocal g→Kg=0.001, identity Nos, rejection of Kg↔Nos, zero wrong-UOM BOM lines for four designated materials, zero UOM mismatch on ordinary RM planning rows in the Nov–Jan horizon, no null RM gross requirement, **8/8** forward writer functions retain internal-material classification guards, and safe resync manual-line preservation marker.

This verifier is a **contract smoke**, not a replacement for isolated clean install, full suite, app-session RLS, or end-to-end operator tests. No test purchase records created; no MRP refresh.

Separately, current `main` canonical shared client HTML/JS was inspected: five primary lenses and **44 direct `.rpc` occurrences / 43 unique literal names**. This preliminary G0 baseline inventory was committed to broad documentation branch #287 as `ERP_G0_CURRENT_MAIN_CLIENT_RPC_INVENTORY_20261112.md` (commit `eeaee50`). It is not yet the required full five-lens DOM/permissions/control matrix. Therefore formal PEC G0 remains **0/6 gates**.

Remaining release checks: run actual authenticated PEC edit session (without simulated JWT), confirm approved legacy-indent reduction → snapshot publication on controlled safe target, review view RLS parity, and get independent owner-approved PR merge. The production MRP full rebase and S4 hybrid feature remain outside this narrow PR.

## 12 Nov 2026 — authenticated-role MRP factor security defect fixed

**Cause:** `mrp_uom_factor_strict` initially ran `SECURITY INVOKER`, reading `inv_uom` and `inv_uom_conversion`. The conversion table is RLS-enabled with **no authenticated SELECT grant or policy**; even `SET LOCAL ROLE authenticated; SELECT mrp_uom_factor_strict(1,2)` failed with `MRP UOM: incompatible unit dimensions` due invisible UOM rows in a bare no-JWT context. This is a definite grant/RLS boundary issue independent of the four-item mass correction.

**Live scoped correction:** Function is now `STABLE SECURITY DEFINER`, search_path `pg_catalog,public`, with no dynamic SQL and only governed factor/dimension SELECTs. `PUBLIC` and `anon` EXECUTE revoked; `authenticated` and `service_role` EXECUTE granted. No grant or RLS policy altered on `inv_uom_conversion` or `inv_uom`. Revision captured in the **sixth ordered migration** `supabase/migrations/20261112150000_pec_mrp_uom_factor_auth_rbac.sql` commit `9300d1d`; do not change the original earlier migration ordering.

**Independent live checks:**
- `SET LOCAL ROLE authenticated` returned Kg→g 1000, g→Kg 0.001 and Nos→Nos identity 1, **PASS**.
- Anonymous function invocation was rejected `permission denied for function mrp_uom_factor_strict`, **PASS**.
- `has_function_privilege(authenticated,...,EXECUTE)=true`, `anon=false`, `has_table_privilege(authenticated,'inv_uom_conversion','SELECT')=false`, `prosecdef=true`, **PASS**.
- Reusable smoke `scripts/pec-g0-postmigration-contract-verify.sql` extended with these role/ACL assertions, commit `a5832aa`. Executed live, `PEC_G0_AUTH_UOM_HELPER_PASS`.
- No JWT was fabricated and no authorized user was impersonated. The `v_mrp_material_gross_requirement_rm` view security option was **not** changed; real signed-in JWT/RLS read parity and PEC editor RPC success remain open.

**Release governance:** the existing main has moved after narrow branch creation; rebase/check conflicts before merge. PR #317 stays draft and owner-approved merge still required. Formal PEC gate count **0/6**.

## 12 Nov — Additional server hardening and seven-migration integration replay

**Live RLS defect fixed:** The strict helper originally ran under invoker permissions. `inv_uom_conversion` and `inv_uom` have RLS and the former has **no SELECT grant to authenticated**. A bare `authenticated` role failed Kg→g lookup with a misleading incompatible-dimensions error. The narrowly read-only strict helper is now `SECURITY DEFINER`, qualified table references and fixed search_path, with EXECUTE revoked from PUBLIC/anon and granted to authenticated/service_role. No table SELECT policy/grant changed. Role test: Kg→g=1000; g→Kg=0.001; Nos identity=1; anonymous call denied; raw table remains denied. Test script `scripts/pec-g0-postmigration-contract-verify.sql` extended and executed live: `PEC_G0_AUTH_UOM_HELPER_PASS`.

**Live future rollup fix:** `mrp_rm_plan_rebuild_month_active` now uses `public.mrp_uom_factor_strict(source_id,target_id)` for its `required_qty` normalization, rather than a separate `LIMIT 1` lookup that ignored ambiguous factors. Rollback-only December recomputation succeeded: **360 material monthly rows**, **0 null**, **0 negative**. Existing December `mrp_rm_plan_detail` retains **5,447 rows / 1 active run** after rollback. This is not authorization to rebuild/replace the stored plan.

**Full source-control ordered migration replay:** fetched all **7 migration files**, stripped embedded per-file transaction wrappers and executed them in **one BEGIN…ROLLBACK** on live corrected schema. PASS: `non_gram=0`, `helper_definer=true`, `rollup_strict=true`. This proves *already-corrected production-state compatibility*, not a complete blank-environment migration replay or hosted authenticated workflow.

**Remaining:** valid signed-in editor public PEC RPC success and approved legacy indent reduction→snapshot publish, view/JWT/RLS parity and owner merge approval; destructive Nov–Jan production-plan rebase intentionally held. Source-control integration PR remains draft and unmerged, client work delegated to Claude separately. Formal G0 **0/6**.

## 12 Nov — Reproducible writer regression and no-residual-data proof

A durable transactional fixture `scripts/pec-g0-db-transactional-writer-acceptance.sql` (commit `2c0e888`) was committed and executed against live Supabase. Output **`PEC_G0_ROLLBACK_WRITER_INTEGRATION_PASS`** with **450 PR revision lines, 206 reset-indent lines and 206 mappings**. Internally the assertions also verify zero internal-category lines in the generated indent; SAFE preservation of one manually added Ampar line with 205 mapped lines and one obsolete PR-mapped line deleted; RESET removal of that manual line and restoration of the 206 mappings. Every created test record is inside one transaction and rolls back. This is an administrator DB-internal integration test, **not** a valid authenticated PEC editor proof.

**Independent post-rollback live check:** fixture PR headers **0**, indent headers **0**, audit events **0**; existing approved indent #84 item #427 requested quantity **260 Nos**, seven existing internal-category open indent balances unchanged. December 2026 MRP **5,447 detail rows / one run**, unchanged. Sequence number gaps may occur despite ROLLBACK, but no test documents were persisted.

## Exact remaining sign-off test (authorized PEC editor)

An existing genuinely signed-in PEC Editor with `module:procurement-execution-console` edit rights must exercise via public RPC/UI, without fake JWT or permission table writes:

1. **Read contract:** Open PEC PWA, confirm PR and indent read lists, confirm an ordinary and an internal-classified item display correctly; verify the MRP gross/stock data used by PR preview and the current server-side exclusions.
2. **Write contract:** On a legitimately disposable **draft** fixture authorised for testing, use public PR create/revision → PR-linked draft indent → SAFE and Full/RESET resync; confirm error handling and that deliberate manual additions survive SAFE and are lost only after explicit Full reset. Avoid touching approved real procurement commitments. The shared client Full→RESET fix is in separate draft PR #319, so don't claim that old live UI already passes.
3. **Approved legacy reduction and snapshot:** A real historical approved-indent decrease is operationally material and must **not** be performed solely for test convenience. Use a dedicated approved acceptance fixture with owner-approved lifecycle and a legitimate editor, or an isolated production-equivalent environment, to verify requested quantity decrease, snapshot requested→completed→published revisions and purchase/action list coherence. SQL administration alone without `auth.uid()` reaches and is rejected at the snapshot permission boundary, as recorded earlier.

Log the authorized account's permission class, tested indent/PR IDs, start/end snapshot revisions and observed PWA output **without exposing private user identifiers**. This is required for G4 operator acceptance; the present SQL tests cannot certify it.

**Security view parity:** keep `v_mrp_material_gross_requirement_rm` security settings unchanged until read behaviour is compared under a valid editor JWT and view-only role. The strict factor helper authorization issue is separately corrected and verified, but does not certify all downstream JWT/RLS contracts. **G0 programme remains 0/6 formal gates.**
