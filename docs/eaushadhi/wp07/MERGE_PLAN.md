# Merge plan: `feat/wp07-ux1-worklist` → `main` (refreshed 1 Nov 2026)

> **CURRENT INTEGRATION STATUS — 1 November 2026 (supersedes earlier branch/cache/merge instructions below):** The authoritative integration branch is `main` at `a6d35b93945b92626789f4f35a9eb25365026427`; the service-worker cache is `hub-cache-v390`. WP-07 client integration PR #120, Costing v390 PR #123, and WP-07 test-harness reconciliation PR #124 are merged. PR #122 is the remaining **draft, unmerged** repository-only reconciliation of nine historical WP-07 migration SQL files and eleven governance documents; it targets `main`. On 1 November, a read-only audit independently compared all nine SQL files with `supabase_migrations.schema_migrations.statements`: **9/9 exact text matches and matching MD5 values**. These migrations are **already applied**: never run `db push`, reapply, rewrite, or rename these files. Some original migration preambles say “NOT APPLIED”; those are preserved historical comments, **not current operational status**. Earlier instructions below naming v387/v388/v389, describing PR #120 as unmerged, or prescribing rebase/cache bumps are historical and MUST NOT be executed. Preserve Product 262 restrictions, four-eyes controls, native portal Save requiring individual owner approval, and the permanent prohibition on portal Submit. No production writes or migration execution; merge PR #122 only on separate owner approval. The agreed Costing/WP-07 shared-`main` integration freeze remains active through this gate.


> **CURRENT INTEGRATION GATE (1 Nov 2026):** This file preserves the original planning snapshot; its starting SHAs/cache allocations and branch procedure are superseded. Actual draft integration is PR #120 (`merge-prep/wp07`, `9b8faa1`, cache v389); migration/docs reconciliation is draft PR #122 targeting that integration branch. `main` advanced to `cfab901` (Costing UX-F1, cache still v388). Refresh and reconcile main, run overlapping Costing/WP-07 tests, and obtain explicit owner merge approval. Do **not** execute the outdated rebase/bump steps below verbatim.

**REQUIRES OWNER APPROVAL, AND A CACHE-NUMBER CHECK WITH THE COSTING ORCHESTRATION (now ChatGPT, formerly the Aryabhatta agent), BEFORE OPENING THE PR.** Supersedes the 30/31 Oct plans (main then at v379/v383).

## State (1 Nov 2026)
- `origin/main` `5c5b7ba` (docs PR #113); cache `hub-cache-v387` (PR #112).
- Open costing drafts #115 / #117 stay at v387 (no bump) as of 1 Nov; if either merges with a bump first, WP-07 takes the number after it.
- `origin/feat/wp07-ux1-worklist` `c5821b1`, cache `hub-cache-v376`. Bundle A (draft PR into this branch) lands first.
- **No number is reserved for WP-07.** Rule: the next free number at the moment of merge (v388 if still free).
- Expected conflicts: cache-number lines only (public/sw.js, the four e-Aushadhi pins, any other smoke pinning the cache), plus `docs/eaushadhi/CHANGELOG_DECISIONS.md` (hand-merge, keep both sides) once this docs branch lands. Re-check with `git merge-tree` right before starting.

## Steps (clean clone or Claude Code cloud session — never the owner's worktree)
1. Owner approves. Ask the costing orchestration: next free cache number? Tell them WP-07 is about to take it.
2. `git switch -c merge-prep/wp07 origin/feat/wp07-ux1-worklist && git rebase origin/main` (or merge `origin/main` in, to avoid a force-push).
3. Set one cache number everywhere (`git grep -n "hub-cache-v3"`): public/sw.js and the pins in `eaushadhi-qc-preparation-workspace-smoke`, `eaushadhi-qc-b5-d7-smoke`, `eaushadhi-qc-b5-d7-2-2-smoke`, `eaushadhi-qc-b5-d7-3-smoke` — version strings only.
4. Hand-merge CHANGELOG_DECISIONS.md keeping both sides.
5. Run all 11 WP-07 smokes (baselines in CURRENT_STATE, plus Bundle A's new checks) + every touched script; `node --check`; `git diff --check`; `supabase db push --dry-run` must not try to apply any WP-07 file.
6. Push the branch, open a **draft** PR to main (this is Bundle B). Merge only after owner approval.
7. After merge: tell the costing orchestration the number used; the owner switches his normal app back to main.
