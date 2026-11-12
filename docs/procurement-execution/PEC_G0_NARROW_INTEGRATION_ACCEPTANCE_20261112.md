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
