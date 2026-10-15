# PR #67 (AU-1): merge readiness, 2026-10-15

**Verdict: READY for the user's merge authorisation.** The merge only adds files to the repo. It runs no SQL and changes no database object.

## Checks (read-only)
| Check | Result |
|---|---|
| Base | `origin/main` 71c30f1 is an ancestor of the PR head fb0c6b4, so there are no conflicts. |
| Diff | 35 files, all **Added** (33 `supabase/migrations/*.sql` + `scripts/migration-drift-check.mjs` + `scripts/MIGRATION_DRIFT_CHECK.md`). Nothing modified or deleted; `sw.js`, `preload.js` and Jarvis/WP05 files are untouched. |
| Content | 33/33 files are byte-identical to the live `schema_migrations.statements` (`AU1_PR67_BYTE_VERIFICATION.md`). |
| History | All 33 added versions are present in live `supabase_migrations.schema_migrations` (560 rows), and every added file name matches the live `name`. The CLI treats them as applied: `supabase db push` / `migration up` would **not** re-run them. |
| Duplicates | No duplicate version numbers in the repo after the merge. |
| Deploy hooks | The repo has no `.github/workflows`. Netlify publishes `public/` with an empty build command. Merging deploys **nothing** to Supabase. |

## Pre-existing hazard (not caused by #67; it must be known before anyone runs the CLI)
The repo and live history are far apart, independently of this PR:
- **21** migration files already on `main` have versions **not** in live history (e.g. `20260108122451_remote_schema`, `20261015053000_ppm_inactive_sku_mrp_policy_governance`). DIR-8 reconciliation shows most of these are applied live under other versions or names.
- **495** live versions have **no file** in the repo, even after #67.

Result: `supabase db push` against production would **refuse** ("remote migration versions not found locally"). If someone forced it (`migration repair` / `--include-all`), it would try to **re-apply** the 21 orphan files, which could be destructive. **Never run `supabase db push` / `migration up` / `migration repair` against production** until a separate, user-approved history-reconciliation step exists. #67 neither causes nor fixes this. It shrinks the gap by 33 and adds `scripts/migration-drift-check.mjs` to detect it.

## Exact safe merge procedure
1. The user authorises the merge, as a recorded decision.
2. Re-run the gates immediately before merging, read-only:
   - `git fetch origin && git merge-base --is-ancestor origin/main origin/costing/au1-migration-backfill`. If main has moved, rebase or update the branch and repeat steps 2–3.
   - `node scripts/migration-drift-check.mjs` (read-only). Expected: all 33 PR versions are present live with matching names and bytes.
3. On GitHub, mark the PR "Ready for review", then merge with **Create a merge commit** or **Squash**. Either is fine; no file conflicts.
4. **Do not** run any Supabase CLI command against production afterwards. No database step belongs to this PR.
5. After the merge, re-run the drift check on `main` and record the result in HANDOVER_LOG.

Rollback: revert the merge commit. This is a repo-only change with no database effect.
