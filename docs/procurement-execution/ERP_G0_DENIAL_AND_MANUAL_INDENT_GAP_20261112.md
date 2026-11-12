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

## Additional writer-path check

**PR revision bypass:** `proc_pr_create_revision_from_active_pec_internal` copies `proc_pr_line` from the active source PR into a draft revision without classification filtering. Old PR-2026-01/#427 (97 Nos), #545 (+20 Box), and PR-2026-04/#427 (107 Nos) are concrete cases whose internal lines would carry forward. New PR writer and PR rebuild exclude the classes, and subsequent PR→indent create/resync also exclude them, but **the revised PR itself** could show those historical internal lines until a rebuild. This is a **separate code path requiring a source-preserving, forward-only guard**. Proposed approach: for newly created revision draft lines only, filter internal finished-bulk and semi-finished categories; keep old source PR unchanged and do not remove already approved indents. Validate revision-mapping lineage and expected line counts before deploying.

**Manual insert exception:** `proc_indent_add_line_pec_internal` upserts both new and existing lines and can modify approved/issued indents with a reason. An unconditional new class guard could inadvertently prevent lifecycle correction of the **seven existing open internal-material indent lines**. If user policy prohibits new internal-material purchases, a safe future guard should block newly introduced or increased positive external commitments while preserving permitted reductions, zeroing, or governed closure of historically approved lines. This requires an explicit test matrix for draft/approved/issued lifecycle and manual-reason requirements, and must avoid silently changing pre-existing indents.

**Public wrapper denial:** `BEGIN; SET LOCAL ROLE authenticated; DO ... PERFORM proc_pr_rebuild_from_mrp(1,'safe') ...; ROLLBACK;` matched the expected `Not authenticated` rejection. Since the wrapper rejects prior to the internal writer, no PR line was changed. This is a bare-role/no-JWT denial test only; real signed-in authorization and successful writer execution remain unverified.

**No additional live writer patches in this follow-up.** The code-path gaps are documented for next bounded implementation package, not misrepresented as closed.

## Implemented follow-on guard (2026-11-12) — closes previously open forward paths

**Live function changes** deployed under owner instruction and captured verbatim in source-control migration `supabase/migrations/20261112122500_pec_revision_and_manual_indent_internal_guard.sql`, commit `290aeac`:
- `proc_pr_create_revision_from_active_pec_internal`: copying a PR into a new draft revision now joins active catalog classifications and excludes RM `finished_bulk_material` / `semifinished_goods`. **Only newly created draft revisions are filtered**; original active PRs unchanged.
- `proc_indent_add_line_pec_internal`: now rejects new **positive** or **increased** quantities for those internal classifications; existing unchanged/reduced/zeroed lines remain permitted, with existing indent-status and manual-reason checks preserved. The existing approved historical lines were not directly edited.

**Live source checks:** both function definitions contain the appropriate class filters; 7/7 read-only manual-indent allow/deny policy examples PASSED. Old PR revisions would filter **49 lines each** from active PR-2026-01 and PR-2026-04 (499→450, 492→443). The 49 represent all internal-category rows, **not** all positive buying lines.

**Actual writer-denial verification** in a single rolled-back DB transaction: `proc_indent_add_line_pec_internal(1,1,1070,5,1,...)` (new internal quantity) and `proc_indent_add_line_pec_internal(1,1,427,5,261,...)` (increase from 260) both raised the exact new prohibition **before mutation**. A following SELECT returned `no_internal_insert=true` and `legacy_quantity_preserved=true`; transaction ROLLBACK. This is direct behavioural denial evidence for manual add, **not** authenticated positive-path UI acceptance. All seven positive historical internal indent balances remain for governed lifecycle review.

Supporting read-only fixture `ERP_G0_REVISION_MANUAL_INDENT_POLICY_FIXTURE_20261112.sql`, commit `aee1195`. The earlier section describing unpatched gaps is retained as **chronological historical audit**; it is superseded for forward generation by this implemented correction.

**Still open:** authenticated allowed session writer acceptance, manual reduction/zero behavioural verification in an isolated rollback environment, PR revision create→activate integration, source-view JWT/RLS parity, historical legacy records, S4 hybrid, full MRP rebase. Formal G0 gates **0/6**, not promoted based on partial evidence.
