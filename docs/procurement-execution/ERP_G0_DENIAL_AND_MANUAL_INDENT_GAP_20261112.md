# PEC G0 — Permission-denial, manual-indent bypass and security-view review
**12 Nov 2026 · Live read-only/rolled-back checks · No PR, indent, or MRP record writes.**

## Permission-denial verification
`public.require_permission(p_target text, p_need_edit boolean)` is a SECURITY DEFINER procedure which:
1. Requires `auth.uid() IS NOT NULL`, otherwise raises `Not authenticated`;
2. Requires a matching row in `user_permissions_canonical` with `can_view=true` and, for edits, `can_edit=true`.

All four public PR and PR→indent wrappers call `require_permission('module:procurement-execution-console', 't')` before the corresponding restricted `_pec_internal` function. The no-JWT denial predicate was run inside `BEGIN; SET LOCAL ROLE authenticated; DO ...; ROLLBACK;`. It behaved as expected: `Not authenticated` was raised inside the guarded test and accepted as the expected denial. This is a **denial-path check only**, NOT proof of allowed authorized end-to-end transactions. No real user JWT or mock authorization grant used.

## Existing manual-indent bypass

`public.proc_indent_add_line` is a permission-gated wrapper. Its `proc_indent_add_line_pec_internal` implementation checks indent status, reason requirements, and upserts a line but **does not check** `v_inv_stock_item_with_class.subcategory_code`. Thus manually adding an RM `finished_bulk_material` or `semifinished_goods` item is still possible for a permitted operator. This contrasts with the now-filtered automatically generated PR and PR→indent paths.

**Owner's policy intent:** internal intermediates/finished bulk should drive production/BOM/MRP where applicable, but **not ordinary external purchasing PR/indents**. Before enforcing a global manual-indent prohibition, examine historically approved manual materials and any genuine externally purchased subcontracted intermediates. Recommended default: guard manual stock-item addition for these subcategories, with an explicitly governed owner-approved exception only if legitimate buying scenarios exist; preserve all historical audit, linked PR, and approved-indents. Do **not** mutate historical #84/#156/#191/#220 records solely because a new guard is introduced.

As of this entry no manual-indent writer was patched: this remains an explicitly **OPEN coverage gap**, not a passing exclusion gate.

## New RM gross view security setting requires contextual decision

Current `public.v_mrp_material_gross_requirement_rm` has `reloptions=NULL`, unlike adjacent `security_invoker=true` MRP views. It is postgres-owned and has `authenticated` SELECT privilege but no `anon` SELECT. A transaction-only test temporarily enabled `security_invoker=true` for a bare authenticated role, and a ten-row query returned zero rows. As there was no signed-in JWT, this cannot establish behavior for authorized users. The test was **rolled back** and no change to view security or access grants was made. Retain as a security parity review gate.

## Other writer edge cases

- New PR generation currently inserts a header and `proc_pr_line` rows aggregated from the MRP view **even if all resulting quantities are zero**. It does not guard against empty/non-purchasable draft PRs. PR→indent now rejects zero eligible positive lines; **PR header generation policy remains to be governed** as part of S4.
- `proc_indent_resync_from_pr_pec_internal` updates/deletes draft indent lines based on PR final lines and may delete existing manually added draft lines absent from PR, including in 'safe' mode; this needs owner-approved separate protection/testing. Do not assume manual draft lines are safe.
- Review of approved prior internal-category indents is separate from future writer filters.

## Accepted evidence vs gates

**Verified:** permission source chain, denial without JWT, six-function source parity, 9/9 synthetic eligibility predicate, read-only historical PR comparison. **Not tested:** authorized actual-account permit, end-to-end writer lifecycle, rollback/audit integration, manual-indent class prohibition, source-view JWT/RLS parity, and destructive MRP rebuild. Formal PEC G0 remains **0/6**.

This page supplements the living ledger `ERP_G0_LIVE_UOM_PR_INDENT_CORRECTION_LEDGER_20261112.md`. No Tally purchase order dependency.
