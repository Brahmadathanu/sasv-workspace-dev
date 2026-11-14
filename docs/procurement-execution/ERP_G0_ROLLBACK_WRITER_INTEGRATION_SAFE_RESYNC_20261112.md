# PEC G0 — Transactional writer acceptance and safe-resync correction
**2026-11-12 IST. Scope:** database writer integration using actual stored procedures in explicit `BEGIN...ROLLBACK` transactions. Does not simulate an authenticated app account or release S4 hybrid.

## DB integration: historical PR → draft revision → indent

Using active historical PR-2026-01 (ID 1), the test invoked `proc_pr_create_revision_from_active_pec_internal` then `proc_indent_create_from_pr_pec_internal`, inside one rollback-only transaction.

| Check | Result |
|---|---:|
| New draft revision line count | 450 |
| Positive new indent line count | 206 |
| Internal-category indent lines | **0** |
| PR-to-indent line mappings | **206** |
| Persisted fixture PR headers, indent headers, mappings, audit events after rollback | **0** |

The test confirms (at database-internal writer level) that the 49 finished-bulk/semi-finished source PR lines are excluded from forward revision, that the resulting eligible positive purchase lines copy to the indent, and lineage matches. It **does not** pass authenticated public RPC / role permission acceptance, as the internal functions were directly invoked in an administrator transaction without impersonation.

## Discovered regression: SAFE resync deleted manually entered lines

An initial transactional test inserted a separate manually entered **Ampar #64, 10 g** line into a generated draft indent and invoked `proc_indent_resync_from_pr_pec_internal(...,'safe')`. The manual line disappeared. The prior SQL had an unconditional `DELETE` of any indent line absent from source PR; this contradicted `safe` intent.

**Corrected live function:** `safe` now removes an obsolete line only when it was recorded in `proc_pr_indent_line_map`, preserving unmapped manual lines. `reset` continues deleting all existing indent lines before rebuilding. The line-level mapping is rebuilt as before.

**Post-fix transactional acceptance:**
- SAFE: one manually added Ampar line **retained**; one intentionally zeroed PR-sourced line **removed**; final lines **206** = 205 PR-sourced + 1 manual; line maps **205**.
- RESET: manual Ampar line **removed** as designed; final lines **206**; line maps **206**.
- Both scenarios used real functions with temporary test revision/indent and were completely rolled back.
- Subsequent production readback must continue to confirm zero residual fixtures; audit and triggered changes are transactional. **Sequences can advance despite rollback**, so sequence gaps are not evidence of committed procurement records.

**Source-control capture:** `supabase/migrations/20261112143000_pec_safe_resync_preserve_manual_lines.sql` commit `afc8db5` contains the live readback function source. The earlier `20261112114000_pec_uom_and_internal_pr_guard.sql` also contains an earlier version of the resync function, and this later migration intentionally supersedes that definition. Migrations must be run in timestamp order.

## Deployment/release status and blockers

- Current docs/correction branch `docs/pec-erp-g0-baseline-20261111` compared with `main` at this inspection: **76 commits ahead, 20 behind, diverged**; PR #287 is **NOT** safe to merge unchanged. It contains an extensive scope of documentation/test files and a number of migrations. Prefer narrow reviewed integration on current `main`, with a full linear migration replay and no duplicate production correction.
- No signed-in authorized PEC editor session is available through the DB administration testing context. Public wrapper positive-path and approved-indent reduction/refresh success must be verified with an authorized account; cannot assume success from database-internal call.
- December old MRP material detail is from 357 historical product drivers versus 141 current positive planned products; 250 no longer included, 46 changed. Destructive MRP refresh remains held pending owner approval of plan rebase. Corrected active view remains in place.
- Legacy internal indent balances (7 positive lines across 4 headers) preserved for lifecycle review.
- UOM correction, strict conversion, internal class guards, migration source parity and rollback-only integration have substantive evidence, but **G0 formal gates remain 0/6** until their precise complete checklists are signed off.
- S4 historical consumption hybrid writer is **not deployed**; no Tally Purchase Order input.
