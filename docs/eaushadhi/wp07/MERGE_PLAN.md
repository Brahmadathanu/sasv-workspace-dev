# Merge plan: `feat/wp07-ux1-worklist` → `main` (refreshed 31 Oct 2026)

**REQUIRES OWNER APPROVAL AND A PING TO ARYABHATTA (costing agent, e99637ae-448a-41ae-a402-0eb5f4801db9) BEFORE OPENING THE PR.** Supersedes the 30 Oct plan (main then at v379).

## State
- `origin/main` `8143426` (docs PR #107) on top of `9ea163d` (PR #106); cache `hub-cache-v383`.
- `origin/feat/wp07-ux1-worklist` `c5821b1`, cache `hub-cache-v376`.
- Expected conflicts: cache-number lines only (public/sw.js, the four e-Aushadhi pins, and any other smokes pinning the cache), plus `docs/eaushadhi/CHANGELOG_DECISIONS.md` (hand-merge) once this docs branch lands. Re-check with `git merge-tree` right before starting.

## Steps (clean clone, never the owner's worktree)
1. Ping Aryabhatta: next free cache number? (v384 unless they bumped again.)
2. `git switch -c merge-prep/wp07 origin/feat/wp07-ux1-worklist && git rebase origin/main` (or merge `origin/main` in, to avoid a force-push).
3. Set one cache number everywhere (`git grep -n "hub-cache-v3"`): public/sw.js and the pins in `eaushadhi-qc-preparation-workspace-smoke`, `eaushadhi-qc-b5-d7-smoke`, `eaushadhi-qc-b5-d7-2-2-smoke`, `eaushadhi-qc-b5-d7-3-smoke` — version strings only.
4. Hand-merge CHANGELOG_DECISIONS.md keeping both sides.
5. Run all 11 WP-07 smokes (baselines in CURRENT_STATE) + every touched script; `node --check`; `git diff --check`; `supabase db push --dry-run` must not try to apply any WP-07 file.
6. Push the branch, open a **draft** PR to main. Merge only after owner approval.
7. After merge: the owner switches his normal app back to main.
