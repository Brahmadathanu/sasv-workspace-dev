# PEC G0 | Narrow server integration review — 12 Nov 2026

Related: ERP master #284, hybrid S4 #305, broad documentary branch PR #287.

## Purpose and exact scope
This branch starts from current `main` and retains **only five server migrations** for the owner-approved four-item UOM and procurement-writer corrections. The broad docs branch #287 is 76 commits ahead and 20 behind `main` at the initial comparison; **do not directly merge its entire history**.

Migration order:
1. `20261112110000_pec_four_gram_material_bom_normalization.sql` — idempotent, exact 13-item Kg→g BOM line correction with old/new-state assertions and governed conversion factor; unchanged Gomatha correction is verified.
2. `20261112114000_pec_uom_and_internal_pr_guard.sql` — strict MRP UOM factor, normalized RM gross requirement view, safer *future* MRP monthly rollup, and internal-class exclusions in PR create/rebuild and PR→indent create/resync.
3. `20261112122500_pec_revision_and_manual_indent_internal_guard.sql` — new PR revision filtering and manual-indent no-new/increase guard while preserving legacy reductions.
4. `20261112133000_pec_manual_pr_internal_item_guards.sql` — manual PR add/quantity-delta forward-only protections.
5. `20261112143000_pec_safe_resync_preserve_manual_lines.sql` — corrected SAFE resync preservation of unmapped manual indent lines, keeping RESET fully restorative.

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

The full ordered five-migration SQL payload was fetched from this clean branch and executed in **one explicit BEGIN…ROLLBACK** against the existing live schema, removing only the embedded transaction wrappers. **PASS**, with `non_gram_bom_lines=0` and `safe_resync_guard=1` in transactional readback. This tests **already-corrected production-state compatibility**, not a complete blank-schema rebuild or authenticated UI. No production changes were committed by this replay.

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
