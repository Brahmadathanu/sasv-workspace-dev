# Scheme Master register migration (APPLIED LIVE 8 Nov 2026 as 20261108082334)

Issue #211 section B; reviewed candidate: PR #213 (commit `e73e9e2bd716c7e01ae7fef05b31797a615abe7f`); draft PR #214.

## STATUS: APPLIED (owner-approved, 8 Nov 2026)
Applied to Supabase project `qhmoqtxpeasamtlxaoak` through `apply_migration` with the owner's explicit approval, using the exact executable SQL of PR #214 head `a3db84d5b2b02306c33a3dc7394244121977fc37`. **Live migration-history version: `20261108082334`, name `costing_scheme_master_register_viability_lateral`.** **Do not re-run it and do not use `supabase db push`**: a second run fails closed (the pre-change fingerprint no longer matches).

Independent evidence recorded in issue #211 (read-only, by the reviewer):
| Check | Result |
|---|---|
| Pre-apply (immediately before) | md5 `a9f6a128427a704e9bea97fc01e7b5f3`, 34 columns, owner postgres, ACL `{postgres=arwdDxtm/postgres,authenticated=r/postgres}`, `security_invoker=true`, 3 viability references, 7 rows; target version absent |
| Post-apply definition | **new fingerprint `8fdc0306bd2f1efbe0638c7c13ba4dda`**, exactly 34 columns, owner and ACL unchanged, `security_invoker=true`, `fn_costing_view_allowed` present, **1** viability reference with LATERAL, 7 rows |
| Independent recomputation of the three changed columns | `count_ok`, `periods_ok`, `latest_ok` true for all 7 schemes; the empty scheme keeps 0 / 0 / NULL |
| Negative database-role checks | `SET LOCAL ROLE anon` denied (SQLSTATE 42501); `SET LOCAL ROLE authenticated` without identity: 0 rows (role-level checks, not an ID-V session) |
| Post-apply EXPLAIN ANALYZE (`ORDER BY scheme_name LIMIT 1000`) | 272.464, 128.035, 128.333 ms; shared hits 103,374 each (pre-apply latest: 848.778 ms / 206,905 hits; earlier 231 ms, 1403 ms and one 4.5 s timeout). Cold-start timeout elimination is **not guaranteed** |

### Reconciliation (this PR)
The file was prepared as `20261108132312_costing_scheme_master_register_viability_lateral.sql` but Supabase assigned history version `20261108082334`. The repository file and the recovery file were renamed to the live version, the two hash pins in `scripts/lib/costing-scope-guard.mjs` were recomputed, and only the **comment header** of the migration and rollback files changed. The executable `DO` statement is byte-identical to what was applied (sha256 `588385052871d3c2c6ebae6956e73a64b1e4e5e8948d00f888ec20dd864dcfc6`, pinned in the test and equal to the PR #213 blob). The recovery file's SQL body is unchanged. Nothing was re-run.

### Post-application ID-V browser check (8 Nov 2026, real session, existing live view)
See the section "Post-application ID-V check" at the end of this file.

## History (the original change description follows; it describes the state before the apply)

## What is in this change
| File | Purpose |
|---|---|
| `supabase/migrations/20261108082334_costing_scheme_master_register_viability_lateral.sql` | the migration: the reviewed, fingerprinted candidate `DO` block copied **byte for byte** (sha256 pinned in the test), under a header marked "PREPARED, NOT APPLIED" |
| `supabase/rollback-evidence/20261108082334_costing_scheme_master_register_viability_lateral_pre.sql` | recovery only (repo convention): the exact pre-change TB2 definition |
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

## Post-application ID-V check (8 Nov 2026, real supervised ID-V session, hosted `main@83b217be`, existing build verified 72/72 at cache v392)
Pricing Policy Manager -> Scheme Master, 3 fresh-context loads at 1280 px and 3 at 390 px, read-only (every request passed the repository's read-only allow-list; no clicks, no typing). Identity proven (6 view grants, 0 edit grants). Redacted report and screenshots are kept outside the repository.
| Metric | Pre-change baseline (earlier the same day) | Post-apply |
|---|---|---|
| `v_costing_scheme_master_register` requests | 6/6 HTTP 200 | **6/6 HTTP 200** |
| Rows / columns | 7 rows, all 34 expected columns | **7 rows, all 34 expected columns, no extras** (every load) |
| HTTP 500 / statement timeout | none seen (one 57014 seen once earlier in the acceptance run) | **none** |
| Console errors, page errors, HTTP >= 400, failed requests, error banners | 0 | **0** |
| Write or other non-read requests | 0 | **0** (9 request types, all reads) |
| View time to first byte | 1125 ms (first, cold), then 283 to 316 ms | 1630 ms (first load after idle, cold), then **173 to 196 ms** |
Reading: the optimised view serves ID-V correctly (7 rows, 34 columns) at both widths with no errors, and warm requests are faster than the pre-change baseline. The first request after an idle period was slower than before in this single sample (1630 ms vs 1125 ms); cold-start latency is **not** shown to be improved and the original intermittent timeout is neither reproduced nor proven eliminated (single cold sample each). Time to first byte only (body-complete timing was not captured).
