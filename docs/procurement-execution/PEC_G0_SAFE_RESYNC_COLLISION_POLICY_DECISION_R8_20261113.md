# PEC G0 — SAFE Resync Manual/PR Identity Collision: R8 Decision Brief

**13 November 2026 | Owner decision needed | Proposal only; no SQL or client change authorized**

## Executive decision

A SAFE resync currently preserves an *unmapped* indent line only when its (material_class_id, stock_item_id, uom_id) does **not** appear among eligible source-PR positive lines. When that identity **does** match a PR line, the current function overwrites the existing indent quantity and reason with the PR's final quantity/reason, then creates a mapping, even if the indent line carries a manual reason. RESET is intentionally destructive and remains distinct.

**Proposed fail-closed policy:** For a draft indent in SAFE mode, detect a *currently unmapped* indent line whose identity matches a positive source-PR line **and whose requested quantity differs** from the PR final quantity. Reject SAFE with an explicit non-mutating collision error listing safe identifiers only through a permission-governed preview, requiring a deliberate operator disposition. Do not auto-overwrite, silently drop, or duplicate the colliding item. Continue preserving unrelated unmapped manual lines. RESET retains explicit destructive semantics but needs an explicit operator warning/confirmation before its use.

This is a recommendation for separate owner approval and implementation work; existing function behaviour and production records are **unchanged**.

## Read-only historical investigation

Historical mapping integrity in issue [#383](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/383):

| Evidence | Three mismatched mapped lines | Two unmapped but PR-matching lines |
|---|---|---|
| Current identity | indent stock item differs from mapped PR stock item; class and UOM agree | indent item identity matches exactly one current source PR line |
| Quantity relationship | **3/3** indent requested quantities equal their mapped PR final quantities | **0/2** indent quantities equal their current source PR final quantities |
| Recorded manual reason | 2/3 have nonempty manual reasons | 2/2 have nonempty manual reasons |
| Current timeline | All mapping creations before 12 Nov; no affected PR/indent line updates since that date | Both pre-12-Nov; no line updates since that date |
| Alternate exact PR line | None of three | One exact source PR line per unmapped indent |
| Conclusion | mapping is not identity-consistent but quantity equality may reflect historical creation/mapping; provenance **unproven** | quantity divergence makes automatic SAFE overwrite a meaningful risk, but manual intent **not conclusively proved** |

Aggregate-only read-only inspection; no business-row data or personnel identities exported. The time relationships are not a forensic history and do not attribute cause. For one mismatched indent the header predates its current source PR header; two mismatched indent lines were created after the referenced PR line and one before. Those timing patterns alone cannot establish whether source PR revision or historical remapping occurred.

## Exact function evidence

The source-reviewed `20261112143000_pec_safe_resync_preserve_manual_lines.sql` is body-equivalent to live. The exact function was executed in disposable PostgreSQL 17 by PR [#384](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/384), PASS at `a7433188af8957cbde00e9a82988fa1e659ce65e`. The fixture confirmed:
- SAFE keeps *unmatched* unmapped manual lines.
- SAFE updates and remaps an *unmapped but PR-matching* indent line, replacing quantity/reason.
- SAFE deletes stale mapped mismatched lines when absent from current PR positive lines, and rebuilds valid mapping.
- RESET rebuilds only eligible positive source-PR lines; repeated SAFE is stable on the tested synthetic case.

No current live draft indents exist (45/45 approved). Do not invoke SAFE or RESET on approved production records.

## Alternatives and trade-offs

1. **A — Retain current automatic PR precedence:** No change; deterministic and tested. Risks silent replacement of distinct manual quantity/reason when identity collides. Not recommended without affirmative policy acceptance.
2. **B — Fail closed on quantity divergence (recommended):** No unexpected overwrite, but requires a UI resolution path. Restrict collision check to draft SAFE, based on unmapped line identity and actual quantity divergence. A manual reason alone is not proof of manual intent. Ensure the detection occurs before any write; reject atomically and present only permission-governed metadata. Handling same-quantity but different-reason cases requires a separate explicit rule: default preserving reason or warning, not silently changing it.
3. **C — Always preserve colliding manual lines:** Inconsistent with a uniqueness constraint on (indent, material class, stock item, UOM) and a single line per item. Without a separately designed representation/aggregation policy, cannot keep both source PR and manual quantities independently. Do not implement by guessing.

## Required acceptance package if B is authorized

- Design a dedicated preview/decision contract and authorization checks (PEC View/Edit as appropriate), with a real Editor-only writer gate and no privilege widening.
- Add a new forward-only migration using the repo's established migration process; **do not rewrite or replay** the deployed legacy function migration as a historical repair. Review the final effective wrapper/internal function boundaries.
- Isolated PG17 tests: unequal quantity, same quantity/different reason, null manual reason, zero and negative source lines, no PR identity, multiple line mappings, mismatched historical map, repeated SAFE, RESET, invalid status/source, role denials, rollback on collision. Mutation-sensitive red/green tests must show the prior source fails the new rule.
- Ensure mapped existing lines still follow the documented PR-authority rule; no retroactive edits to approved/issued indents.
- Owner acceptance of draft SAFE collision UX and explicit destructive RESET warning; signed-in backend negative-role tests before production approval.
- Reconcile the three historical wrong-stock-item mappings separately with traceability, never infer a correction solely from matching quantities.

## Status

**Issue #383 OPEN; proposed policy B NOT APPROVED.** Isolated existing-function PASS is retained, but historical mapping provenance and policy remain **REVIEW REQUIRED**. Migration version `20261112143000` stays **UNREGISTERED and on history-repair hold**. Real signed-in role acceptance NOT TESTED; G0–G5 **0/6 closed**. No production writes, resync execution, ACL changes, history repair, or main promotion have been made.

## R9 implementation prototype — test-only, not approved for deployment

[Draft PR #385](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/385) targets the unmerged PR #317 feature branch. It carries a complete prospective `CREATE OR REPLACE` function definition under `scripts/pec-g0-safe-collision-proposed-function.sql` and an isolated PG17 fixture. **The official 20261112143000 migration file is unchanged**, and no new forward-only migration was created or deployed.

The proposed SAFE-only guard runs after collecting eligible positive PR final lines but **before** indent-line updates/inserts/deletes or mapping changes. It detects an existing **unmapped** indent line with the same material class/item/UOM identity but `requested_qty IS DISTINCT FROM final_qty` and raises SQLSTATE `23514`. It also rejects a differing quantity when the manual reason is NULL. RESET and normal matching/pr-mapped SAFE behaviour are unchanged.

The initial exact-head CI for PR #385 at `76b5b6cfd6bf748b3a32add152cf5e4c7e72c191` **PASS** using a disposable PostgreSQL 17 service, including no-side-effect assertions and regression cases. A follow-up mutation-sensitivity fixture commit was submitted to demonstrate the prior function's silent overwrite inside a rolled-back synthetic transaction; **verify its exact-head CI separately** before considering the candidate test-complete.

**Review boundaries:** Equal quantities with different manual reasons still result in PR reason precedence and need owner-facing UX clarification. Concurrent writer safety, true authenticated role checks, preview/explicit operator resolution, deployed ACLs, and historical provenance are not established by this fixture. **No main/staging implementation merge, production change or history registration is authorized.** Issue #383 remains open and version `20261112143000` stays on official history-repair hold until governance is complete.

### R9 follow-up test evidence (13 November 2026)

PR #385 exact head `95f3b8cd571cf64ef1a8ea0a4ef1a33699936fcd` completed **PEC SAFE Collision R9 isolated PG17 SUCCESS**. The fixture now proves the old function's silent overwrite of colliding quantity and reason inside a **rolled-back synthetic transaction**, then demonstrates the proposed guard raising SQLSTATE `23514` on the same collision with no line/header-map side effects. Missing manual reason also fails closed; normal SAFE and RESET remain accepted in the bounded synthetic scenarios. This is deterministic regression evidence, not proof of deployed behavior, real JWT authorization, concurrency, or user-facing resolution. PR #385 remains DRAFT/unmerged. No official migration was created and no live schema/data/roles/history changed.

### Fast-track R9 reason-only protection (13 November 2026)

Draft [PR #385](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/385) exact head `8cb270ec00efc3573fdf4e244b300325fd78eb7e` passed isolated PostgreSQL 17 CI. The proposed pre-write SAFE guard now treats **either quantity divergence or a normalized manual-reason divergence** as an unmapped PR-identity collision, returning `23514`; the fixture specifically verifies reason-only rejection and no changes. A full quantity+reason match remains eligible for PR mapping. This remains *proposal-only*, not an official forward-only migration. Cross-writer concurrency and permission-governed operator decision UX still need design/acceptance; true JWT tests and issue #383 provenance unresolved. Avoid further exploratory audit cycles: prioritize the actual role acceptance and one bounded concurrency test before promotion.
