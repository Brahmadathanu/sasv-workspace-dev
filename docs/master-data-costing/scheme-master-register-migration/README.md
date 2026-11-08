# Scheme Master register migration (PREPARED, NOT APPLIED)

Issue #211 section B; reviewed candidate: PR #213 (commit `e73e9e2bd716c7e01ae7fef05b31797a615abe7f`). **This branch adds a migration file but nothing has been applied, merged, deployed or changed in Supabase.** Applying it needs a separate owner approval after PR #213 and this PR are reviewed. Formal status stays 5/13.

## What is in this change
| File | Purpose |
|---|---|
| `supabase/migrations/20261108132312_costing_scheme_master_register_viability_lateral.sql` | the migration: the reviewed, fingerprinted candidate `DO` block copied **byte for byte** (sha256 pinned in the test), under a header marked "PREPARED, NOT APPLIED" |
| `supabase/rollback-evidence/20261108132312_costing_scheme_master_register_viability_lateral_pre.sql` | recovery only (repo convention): the exact pre-change TB2 definition |
| `docs/master-data-costing/scheme-master-register-migration/pre_apply_verification.sql`, `post_apply_verification.sql` | read-only verification before and after the apply |
| `scripts/lib/costing-scope-guard.mjs` | one narrow, content-hash-pinned approval for exactly this migration (see below) |
| `scripts/scheme-master-migration/scheme-master-migration.test.mjs`, `scripts/costing-scope-guard/scope-guard.test.mjs` | static, migration-scope and regression tests |

## Behaviour of the migration
One `DO` statement = one transaction under any runner. It verifies the **exact** live pre-change definition: the 34 column names in order, `reloptions` exactly `{security_invoker=true}`, `md5(pg_get_viewdef(view, true)) = a9f6a128427a704e9bea97fc01e7b5f3` (live fingerprint captured independently), the permission gate, and exactly 3 viability references. Then it runs `CREATE OR REPLACE VIEW` (three correlated viability subqueries become one per-scheme `LEFT JOIN LATERAL`), then verifies the post-conditions (same column names and types, same `reloptions`, same ACL, gate present, one lateral viability reference). Any failure raises and rolls back everything, including a second run (the fingerprint no longer matches). `security_invoker`, the `fn_costing_view_allowed()` gate, the column contract and grants are untouched.

## Apply procedure (owner / release process, not this PR)
1. Re-check the target is current: PR #213 and this PR approved; `main` merged; no other change to the view since the fingerprint was captured.
2. Run `pre_apply_verification.sql` (read-only); save P2/P3/P4 output. Every expectation must hold.
3. Apply the migration file (one statement) through the normal Supabase migration path. Do not split it, do not wrap it in a transaction you will commit selectively.
4. Run `post_apply_verification.sql`: Q1 definition changed as intended; Q2 identical to the saved P2 (ACL, options, columns, types, privileges, dependants); Q3 values equal the independent recomputation and the saved P3; Q4 three timings (record cold/warm); Q5 ID-V 7 rows, no-permission 0 rows.
5. Client check as ID-V: Scheme Master at 1280 px and 390 px (7 rows, no console errors).
6. Follow-up commit: change the migration header to "Applied to live Supabase as migration <version>" (repo convention) and record the results in #211.

## Rollback
Run the recovery file (`supabase/rollback-evidence/..._pre.sql`): a single `CREATE OR REPLACE VIEW` with the TB2 definition; keeps ACL, reloptions and dependants. Afterwards `md5(pg_get_viewdef(...))` must equal `a9f6a128427a704e9bea97fc01e7b5f3` again. Run it if any post-apply check fails or the view measures worse. It is not a forward migration and must not be added to `supabase/migrations/`.

## Why the scope guard is touched
Historical Costing package tests (`uxf1`, `review-worklist`) assert "no Costing supabase change since their base". A Costing view migration must pass them without weakening them, so the guard gets an `APPROVED_COSTING_MIGRATIONS` allow-list (same spirit as `APPROVED_HTML_INSERTIONS`): an added migration is tolerated only if its path **and** the sha256 of its LF-normalised content are listed. Any edit to the file, a different file, or a second Costing migration is still a violation. Tests cover the approved, edited, renamed and unlisted cases.

## Not proven here
No SQL was executed (no PostgreSQL available to the author). The `DO` block has been reviewed statically and the SELECT it wraps was independently shown to match the live view on all 34 columns and 7 rows; its precondition/postcondition logic and the cold-start timeout behaviour are verified only by the owner's pre/post runs. The targeted ID-V browser check of the **existing** view (6 loads, 7 rows, 0 errors, first-byte 283 to 1125 ms) is a baseline, not evidence about the candidate.
