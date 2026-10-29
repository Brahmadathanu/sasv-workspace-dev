# Migration history reconciliation (checked 27 Oct 2026)

Read-only comparison of `supabase/migrations/` (this branch, 606 files) with production's `supabase_migrations.schema_migrations` (661 versions). **All commands below are documentation only — none was executed.**

## 1. The five redesign-v2 files are byte-identical and already recorded
> **Update 29 Oct 2026:** two more record-only copies added the same way: `20261029152138_ci046_owner_only_locking.sql` (md5 1be20299…66c1) and `20261029152614_ci047_costing_function_grant_tidy.sql` (md5 622bbdeb…6a23), byte-identical to the files applied by `apply_migration`. Seven record copies in total; no new replay hazard.
| Change | Version | md5 (file = production record) | In production history |
|---|---|---|---|
| CI-040 v2.1 | 20261027033918 | ab7fb50473d609be1b50546a85a7abd6 | yes |
| CI-041 v2.1 | 20261027034040 | 4408eaff66177f86fd62630d039e0f46 | yes |
| CI-045 | 20261027064617 | c2ece2eba2d5bd8fba807d0dd261b7c6 | yes |
| CI-042 v2.2 | 20261027121655 | d94771dd1e06646a1db705a2dd90ef49 | yes |
| CI-043 v2.2 rev B | 20261027153126 | cfae78680e4e1c2ddde0661eba8bfd24 | yes |

Because their versions are already in production's history, the Supabase CLI treats them as applied there and would not re-run them.

## 2. What tooling exists in the repo
- No CI: there is no `.github/workflows` folder.
- No deploy script runs `supabase db push`, `db reset`, `migration up` or `db diff` (searched scripts, tools, package.json).
- `package.json` script `sync-db` runs `supabase gen types typescript --linked --schema public` — reads the schema, applies nothing.
- `supabase/config.toml` exists for a local stack (`project_id = "daily-worklog-app"`).
- Production changes are applied only through the approved `apply_migration` route.

## 3. The history was already out of step before this PR (pre-existing)
- **18 repo files have no matching production version** (2026-05-01 … 2026-09-27, e.g. 20260501094500, 20260519120000, 20260716150000, 20260904084132 … 20260927100118). Their content was applied under different version numbers or by other means; not re-checked one by one.
- **73 production versions have no repo file** (e.g. recent WP07 regulatory and consumables-master migrations 24–27 Oct, owned by other workstreams).
- The modified file `20261015045233_ppm_inactive_sku_mrp_policy_governance.sql` is a local, unstaged change outside this PR.

## 4. Replay risk by tool
| Tool / situation | Risk | Why |
|---|---|---|
| `supabase db push` against production | **Refuses or wants to apply the 18 old local-only files** — pre-existing hazard, not caused by the five new files | The CLI reports remote versions missing locally and local versions missing remotely; with `--include-all` it would try to run the 18 old files on production. **Never run by hand against production.** |
| Fresh local stack (`supabase db reset` / `start`) or a branch database | Replays all 606 files in order; result is **incomplete** (73 production changes have no file) and may fail on files that depend on them | History gaps, not the five files |
| CI | None exists | — |
| `npm run sync-db` | None | Read-only type generation |

**Conclusion:** the five record-only files add no new replay hazard. The real, pre-existing hazard is the gap in both directions; no repo history can rebuild production today.

## 5. Safe environment-reconciliation procedure (documentation only — not executed)
1. **Production:** do nothing. It is already recorded. Never `db push`; apply future changes only via the approved `apply_migration` route with the owner's approval text.
2. **Before any tool touches a non-production database,** compare: `supabase migration list --linked` (shows local vs remote columns). Investigate each one-sided version.
3. **Another environment that already contains the objects** (e.g. a restored copy of production): mark versions as applied without running them — `supabase migration repair --status applied <version> …` — only there, never on production.
4. **A brand-new environment:** do not expect the repo to rebuild production. Use a schema dump of production (`supabase db dump`) as the baseline, then mark the history applied with `migration repair` in that environment.
5. **Proposed (not done, needs owner decision):** a separate housekeeping task to (a) add record-only files for the 73 production versions owned by each workstream and (b) map or archive the 18 local-only files. No rename or removal is made in this PR.
