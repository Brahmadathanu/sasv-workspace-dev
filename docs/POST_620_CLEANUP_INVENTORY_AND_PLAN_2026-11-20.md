# Post-6.2.0 cleanup: non-destructive inventory and grouped plan (20 Nov 2026)

**STATUS: INVENTORY AND PROPOSAL ONLY. Nothing here has been deleted, pruned, reset or force-pushed.** Every removal below needs the owner's approval for its group. Evidence: read-only `git`/`gh` queries and folder-size listing on 20 Nov 2026 against `origin/main` `ebb59a49` (v6.2.0).

## 0. Never touch without a specific owner decision (PROTECTED)
| Path | Why |
|---|---|
| `D:\ELECTRON PROJECTS\daily-worklog-app` | Original dev folder, branch `costing/approval-screen-preview`, 9 changed/untracked entries, 2 commits ahead of main; may hold uncommitted work |
| `D:\ELECTRON PROJECTS\sasv-release-test` | 6 dirty entries (five CRLF-only SQL migrations); local 6.1.0 build (`dist`, 1.5 GB) is NOT the published 6.1.0 |
| `D:\ELECTRON PROJECTS\sasv-620-g1` | Verified 6.2.0 build (`dist\`) and release-upload staging |
| `D:\ELECTRON PROJECTS\sasv-pilot-backup-20261120` | CONFIDENTIAL production profile backup and verified 6.1.0 rollback installer |
| Release tags and assets (v6.2.0, v6.1.0, v6.0.1, ...), audit evidence, historical migrations | Evidence and rollback |
| Executive MIS programme: PRs #485, #486 and their branches | Separate programme, not a release remnant |

## 1. Inventory summary
- **Git worktrees: 63 registered.** 2 are *prunable* (their folders under `%TEMP%` no longer exist). 34 have uncommitted changes. 18 sibling folders (about 4.2 GB) are clean, ahead-of-main 0 and fully contained in pushed remote branches.
- **Unpushed work (commits on no remote): 3 local branches**: `test/wp04-s0-cursor-runner` (33 commits), `feat/lab-repeat-analysis-governance-client` (3, in a worktree inside `node_modules\.worktrees`), `costing/w1-approved-run-labels-rebased` (2). These must be pushed or archived before anything else happens to them.
- **Branches:** 45 local; 360 remote, of which 29 are merged into main and 329 are not merged (many are historic stage/acceptance branches whose PR state is unknown here).
- **Open PRs: 40 (39 draft).** Groups: active WP10/WP12 and release (#463, #465, #471-#479, #487), Executive MIS (#485, #486, protected), PEC/Costing design drafts from 1-13 Nov (#114-#150, #274-#385), four non-draft October Tally fixes (#92-#94, #97) and one 10 Oct draft (#59).
- **Tracked repository:** 3,604 files, about 115 MB (docs 76 MB in 1,950 files; public 23 MB; scripts 6 MB; supabase 5 MB). No tracked file over 2 MB except six images and `types/supabase.ts` (1.0-1.6 MB); no tracked log, backup or temp remnants matched. No binary-bloat problem.
- **Untracked in the dev folder:** `.tmp-aside/`, `.tmp-plan-inspect.txt`, `.tmp-smoke-userdata/`, `.worktrees/`, two odd files named `e HEAD` and `tring(9)` (look like accidental shell-redirect output), `scripts/tmp-ok-sep2026-regional-marketing-acceptance*.mjs`.
- **`.gitignore`** covers `node_modules`, `dist*`, `*.exe`, `*.zip`, `.env`; it does not cover `.worktrees/`, `.tmp-*`, `tmp-*` scripts or `*.log` in all forms (proposed in the separate draft PR).

## 2. Grouped cleanup plan
| # | Group | Paths / items | Classification | Recovery | Owner approval |
|---|---|---|---|---|---|
| 1 | **Safe local generated files** | agent scratch `D:\ELECTRON PROJECTS\sasv-620-g1-npmci.log`, `sasv-620-g1-launch-installed-fresh.bat` (removed 20 Nov, regenerable); later: `sasv-620-g1\dist\release-upload` (copies of published assets, 0.5 GB) and `sasv-release-test\dist` (local 6.1.0 build, 1.5 GB, unpublished) | SAFE TO REMOVE (scratch); ARCHIVE then remove (release-test dist) | Published assets re-downloadable; 6.0.1 and 6.1.0 official installers in GitHub | Scratch: done. Others: yes |
| 2 | **Worktree reconciliation** | (a) push or archive the 3 unpushed branches; (b) inspect 34 dirty worktrees (largest: `wp06-line931-preflight` 39, `composition-executor-packaging-proof` 14, `wp06-final-stage-preflight` 10); (c) remove the 18 clean+pushed folders with `git worktree remove` (no `--force`) one batch at a time; (d) `git worktree prune` for the 2 missing `%TEMP%` records | (a) NEEDS OWNER REVIEW; (b) NEEDS OWNER REVIEW; (c) SAFE TO REMOVE after approval; (d) SAFE after approval | (c) branches stay on the remote; folders are recreatable with `git worktree add`; (d) metadata only | Yes for every item (touches the original dev repository's `.git`) |
| 3 | **Repository source/doc cleanup** | `.gitignore` additions (draft PR); no tracked deletions proposed yet; docs are 1,950 files of dated receipts: propose an index/ARCHIVE folder rather than deletion; the two odd untracked files `e HEAD`, `tring(9)` and `.tmp-*` after owner inspection | `.gitignore`: KEEP/ADD; docs: ARCHIVE (index only); odd files: NEEDS OWNER REVIEW | Everything is in git history | Yes (PR review) |
| 4 | **Stale branch and PR housekeeping** | 29 merged remote branches (delete candidates); 329 unmerged: produce a per-branch report (PR state, last commit, unique commits) before any decision; 40 open drafts: owner to mark each KEEP / CLOSE-with-comment; non-draft #92-#94, #97: confirm whether still wanted | NEEDS OWNER REVIEW | Closed PRs reopen; deleted branches restorable from the PR head SHA or reflog for about 90 days | Yes, per list; never bulk |
| 5 | **Long-term maintenance** | `git maintenance`/`gc` on the dev repository after worktrees are reduced; fetch only needed refs; branch naming/expiry policy; one release-test worktree reused instead of new folders per acceptance | KEEP (process) | n/a | Yes for repository settings |

## 3. Exact safe next cleanup action
Owner chooses one of: (i) approve pushing the 3 unpushed branches (`git push -u origin <branch>`, no force) so no work exists only on this PC; or (ii) approve removal of the first batch of clean+pushed sibling worktrees. Recommended order: **(i) first**, then inspect dirty worktrees, then remove clean ones, then branch/PR triage.

## 4. Unchanged by this document
v6.2.0 publication, WP10/WP12 OPEN, Stage B HOLD, PR #485/#486 isolation.
