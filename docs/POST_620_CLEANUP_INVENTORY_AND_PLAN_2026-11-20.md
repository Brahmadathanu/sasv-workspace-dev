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

## 5. Update 20 Nov 2026 (owner-approved): unpushed branches preserved
Verified (no secrets: only fake test fixtures such as sb_secret_fake; no binaries; largest blob 558 KB; no same-name remote branch existed), then pushed without force, exact history, `git push origin refs/heads/X:refs/heads/X`. Local and remote SHAs match:
| Remote branch | SHA | Commits ahead of main |
|---|---|---|
| `test/wp04-s0-cursor-runner` | `016bd4585598ecf11fc6968bb625e21130ceb60c` | 33 |
| `feat/lab-repeat-analysis-governance-client` | `88f4c859a500a1475c6e8b03ba598cf18ec18d1d` | 3 |
| `costing/w1-approved-run-labels-rebased` | `26f33c873e293d8138b2124e788372cd3fdfc69c` | 2 |
Not merged into main. Uncommitted changes in worktrees (for example 1 dirty entry in the wp04 worktree) were NOT pushed.

## 6. PROPOSAL (not executed): remove 18 clean worktrees in one batch
Each folder has 0 uncommitted entries and its HEAD commit is an ancestor of `origin/main` (verified with `git merge-base --is-ancestor`), so no commit is lost; local branch names are kept (removing a worktree does not delete its branch). Total about 4.3 GB. Method if approved: `git worktree remove <path>` (no `--force`, so Git refuses if anything is dirty), folder by folder, then `git worktree prune` for the 2 missing `%TEMP%` records. Recovery: `git worktree add <path> <branch-or-sha>`. Requires owner approval (touches the original dev repository's `.git`). Note: `git stash` has 1 shared entry; it is unaffected.
| Folder under `D:\ELECTRON PROJECTS` | Size | Branch | HEAD | Preservation |
|---|---|---|---|---|
| `daily-worklog-app-wt-composition-final-stage-verify` | 29 MB | feat/eaushadhi-composition-final-stage-verify | `6ce0afad` | in main |
| `daily-worklog-app-wt-composition-hidden-row-id-parser` | 29 MB | fix/eaushadhi-composition-hidden-row-id-parser | `095afbbd` | in main |
| `daily-worklog-app-wt-composition-native-fill-order` | 29 MB | fix/eaushadhi-composition-native-fill-order | `0a3b961c` | in main |
| `daily-worklog-app-wt-composition-phase2-line931` | 29 MB | feat/eaushadhi-composition-phase2-line931 | `7657a66f` | in main |
| `daily-worklog-app-wt-composition-prelive-acceptance` | 805 MB | (detached) | `2ad4b80b` | in main |
| `daily-worklog-app-wt-composition-recheck-wiring` | 29 MB | fix/eaushadhi-composition-recheck-wiring | `6b1b1a84` | in main |
| `daily-worklog-app-wt-fill-planner-clipboard` | 30 MB | fix/fill-planner-urgent-sku-clipboard-label | `30846656` | in main |
| `daily-worklog-app-wt-post-entry-reconcile-rpc-migration` | 29 MB | chore/eaushadhi-post-entry-reconcile-rpc-migration | `7c5bc289` | in main |
| `daily-worklog-app-wt-wp06-final-prelive-f22b36c` | 29 MB | (detached) | `f22b36ca` | in main |
| `daily-worklog-app-wt-wp06-full-readonly-acceptance` | 29 MB | (detached) | `c44e1ca2` | in main |
| `daily-worklog-app-wt-wp06-page-identity-acceptance` | 722 MB | (detached) | `0ba73d74` | in main |
| `daily-worklog-app-wt-wp06-post-fill-order-preflight` | 29 MB | (detached) | `768992a3` | in main |
| `daily-worklog-app-wt-wp06-postfix-preflight` | 29 MB | (detached) | `b162d493` | in main |
| `daily-worklog-app-wt-wp06-quantity-readonly-acceptance` | 29 MB | (detached) | `80c2f9e2` | in main |
| `daily-worklog-app-wt-wp06-readonly-acceptance` | 813 MB | (detached) | `142c7fe5` | in main |
| `daily-worklog-app-wt-wp06-representative-regression` | 29 MB | (detached) | `c719dacf` | in main |
| `daily-worklog-app-wt-wp07-g3b-s1-qc-preparation-read-probe` | 813 MB | feat/wp07-g3b-s1-qc-preparation-read-probe | `257c8032` | in main |
| `daily-worklog-app-wt-wp07-s2b-b1-qc-report-registration` | 813 MB | feat/wp07-s2b-b1-qc-report-read-probe | `3b32f108` | in main |


## 7. Execution record: 18-worktree removal (20 Nov 2026, owner approval #488 comment 7040639771)
Per-folder checks before each removal: path on the approved list, registered worktree, canonical path, no modified/staged/untracked files, HEAD an ancestor of `origin/main`, no reparse points or nested `.git`. Removal with `git worktree remove` (no `--force`), no recursive OS deletion.
- **Removed: 8** (about 3.2 GB freed): composition-hidden-row-id-parser, composition-native-fill-order, composition-recheck-wiring, post-entry-reconcile-rpc-migration (29 MB each), wp06-page-identity-acceptance (722 MB), wp06-readonly-acceptance, wp07-g3b-s1-qc-preparation-read-probe, wp07-s2b-b1-qc-report-registration (813 MB each). All 8 branch refs and tips still exist.
- **Skipped: 10, none deleted.** 9 have `node_modules` as a junction into another folder (7 into the original dev folder's `node_modules`, 2 chained into other worktrees): composition-final-stage-verify, composition-phase2-line931, fill-planner-clipboard, wp06-final-prelive-f22b36c, wp06-full-readonly-acceptance, wp06-post-fill-order-preflight, wp06-postfix-preflight, wp06-quantity-readonly-acceptance, wp06-representative-regression. 1 passed every check but was skipped as a dependency: composition-prelive-acceptance (805 MB) holds the real `node_modules` that two skipped folders junction to.
- **Stale records:** the 2 missing `%TEMP%` registrations (trusted-executor, verified-field-lock) were inspected; dry run showed only those two would change, no locked entries; both tips are in `origin/main`; pruned (metadata only, branches kept).
- **After:** 53 registered worktrees (was 63), 0 prunable, original dev worktree status byte-identical (9 entries, HEAD `80e6fd39`, 1 stash), no branch deleted. Anomaly: the junctions above (deleting through them is unsafe: they alias the dev folder's `node_modules`).

## 8. PROPOSAL (not executed): next group
**8a. Dirty-worktree reconciliation (34 dirty worktrees classified, read-only).**
| Class | Worktrees | Content | Proposed disposition |
|---|---|---|---|
| Only `.tmp-smoke-userdata/eaushadhi-worker-logs/*.jsonl` | about 22 (composition-*, merge-*, reference-*, global-reference-dictionary-client, post-entry-ingredient-form..., pre-entry-reopen..., remove-queue-kpis, wp07-s2c-c1) | generated smoke logs, no tracked edits | SAFE TO REMOVE the log folder, then the worktree is clean; needs approval |
| CRLF-only SQL edits (no real content diff) | `daily-worklog-app` (1), `prm-bypass`, `wp07-ux1`, `wp07-bundle-a-screen-test`, `sasv-release-test` (5) | line endings only | KEEP as is (protected); optional `git checkout` only with owner approval |
| `.tmp-*` scripts and logs | `manage-bmr-main-visual`, `wp06-final-stage-preflight` (14), `wp06-line931-preflight` (3,303 files, 482 MB userdata) | generated preflight scratch | ARCHIVE or remove after owner inspection |
| Real unsaved work | `composition-executor-packaging-proof` (8 modified tracked files, 123 untracked incl. 360 MB dist proof); `wp07-ux1` (`UX1_2_PLAN.md`); `wp07-bundle-a-screen-test` (`package-lock.json`); `wp04-s0-cursor-runner` (`__pycache__` only) | possible genuine edits | NEEDS OWNER REVIEW: commit to a branch or archive a patch before any cleanup |
| Original dev folder | `daily-worklog-app` (15 untracked incl. `.tmp-aside/`, `e HEAD`, `tring(9)`) | owner work | PROTECTED |

**8b. Redundant generated files** (about 3.5 GB listed; none touched):
| Path | Size | Classification | Recovery |
|---|---|---|---|
| `sasv-620-g1\dist` | 1,038 MB | KEEP: verified 6.2.0 release build | published assets re-downloadable; keep until owner decides |
| `sasv-release-test\dist` | 598 MB | ARCHIVE then remove: local 6.1.0 build, not the published artifact | rebuild from tag `v6.1.0` |
| `wp06-line931-preflight\.tmp-line931-preflight-userdata` | 482 MB | NEEDS OWNER REVIEW | none (scratch) |
| four `dist-eaushadhi-*-proof` folders in composition-* worktrees | about 360 MB each | SAFE TO REMOVE after approval | rebuildable proof builds |
Each needs a separate approval; deletions would use per-folder, non-recursive-by-script review.

## 9. Execution record: generated-file cleanup (20 Nov 2026, owner approval #490 comment 7040740336)
- **Smoke logs:** 29 untracked `*.jsonl` files (16 KB total) deleted from 24 worktrees' `.tmp-smoke-userdata\eaushadhi-worker-logs\`, then the 24 now-empty log directories. Checks per file: untracked (0 tracked), no reparse points, no other content in the directory. Not touched: `wp07-ux1`, `prm-bypass`, `wp07-bundle-a-screen-test`, `executor-packaging-proof` logs, the dev folder, `sasv-*` folders.
- **Proof builds:** 4 folders deleted, about 1,439 MB: `daily-worklog-app-wt-composition-executor-packaging-proof\dist-eaushadhi-composition-executor-proof` (360 MB), `...-composition-line930-release-gate\dist-eaushadhi-live-contract-proof` (360), `...-composition-page-identity-contract\dist-eaushadhi-composition-page-identity-proof` (360), `...-composition-first-live-line-930\dist-eaushadhi-first-live-930-proof` (359). Each verified: canonical path, no reparse point or nested `.git` anywhere inside, no tracked file, no junction anywhere targeting it, no process running from it.
- **Skipped: none.** Not approved and untouched: `.tmp-line931-preflight-userdata` (482 MB), `sasv-release-test\dist`, `sasv-620-g1\dist`, all `node_modules` junctions, all tracked and line-ending changes.
- **After:** dev worktree status byte-identical (9 entries, HEAD `80e6fd39`); 53 registered worktrees, no branch changed; dirty worktrees fell from 34 to **10**; D: free space 16.6 to about 18.0 GB.
- **Remaining dirty (10):** `daily-worklog-app` (protected), `sasv-release-test` (protected), `manage-bmr-main-visual` (2 `.tmp` logs), `composition-executor-packaging-proof` (8 modified tracked, 5 untracked), `prm-bypass` (1 CRLF SQL), `wp04-s0-cursor-runner` (6 `__pycache__`), `wp06-final-stage-preflight` (14 `.tmp` scripts), `wp06-line931-preflight` (3,303 untracked), `wp07-ux1` (1 CRLF SQL, `UX1_2_PLAN.md`, 1 other), `wp07-bundle-a-screen-test` (`package-lock.json` real diff, 1 CRLF SQL, 1 stray).

## 10. PROPOSAL (not executed): reconcile remaining dirty worktrees and junction dependencies
**10a. Junction dependencies (11 worktrees).** 7 junction to the original dev folder's `node_modules`, `wp06-final-prelive-f22b36c` to `composition-prelive-acceptance`, `wp06-postfix-preflight` to `wp06-final-prelive-f22b36c`; 2 are also dirty (`final-stage-preflight`, `line931-preflight`). Safe method if approved: for each clean merged one, remove only the link with `rmdir "<path>\node_modules"` (removes the junction itself, never the target; recreate with `mklink /J`), re-verify the dev folder's `node_modules` is intact after each, then `git worktree remove` (no force). Order for the chain: `postfix-preflight`, then `final-prelive-f22b36c`, then `composition-prelive-acceptance` (805 MB). 9 clean merged candidates (about 0.3 GB) + prelive-acceptance (0.8 GB). Approval required.
**10b. Dirty worktrees.**
| Worktree | Proposed action | Approval |
|---|---|---|
| `wp04-s0-cursor-runner` | delete 6 untracked `__pycache__` files (branch already pushed) | yes |
| `manage-bmr-main-visual` | delete 2 `.tmp` logs | yes |
| `wp06-final-stage-preflight` | archive 14 `.tmp` scripts to a folder outside the worktree, then remove | yes |
| `wp06-line931-preflight` | owner inspects 3,303 files and the 482 MB userdata; archive a manifest, then remove | yes, separately |
| `executor-packaging-proof` | export the 8 real modified files as a patch outside the repo (no commit), owner decides | owner review |
| `wp07-ux1`, `wp07-bundle-a-screen-test` | keep `UX1_2_PLAN.md` and the `package-lock.json` diff; owner decides commit or discard | owner review |
| `prm-bypass` | CRLF-only SQL edit: leave | none |
| dev folder, `sasv-release-test` | protected | none |

## 11. Execution record: ten junction-linked worktrees (20 Nov 2026, owner approval #490 comment 7040815958)
Per worktree: exact path and registration, clean status (including untracked), HEAD an ancestor of `origin/main`, no other reparse point or nested `.git`, `node_modules` junction target read and matched to the expected set, junction removed with `cmd /c rmdir` (link only), shared targets re-counted after each removal, then `git worktree remove` without force. Order followed: `wp06-postfix-preflight` (target: `wp06-final-prelive-f22b36c`'s `node_modules`), `wp06-final-prelive-f22b36c` (target: `composition-prelive-acceptance`'s), then the seven linked to the original dev folder (`composition-final-stage-verify`, `composition-phase2-line931`, `fill-planner-clipboard`, `wp06-full-readonly-acceptance`, `wp06-post-fill-order-preflight`, `wp06-quantity-readonly-acceptance`, `wp06-representative-regression`), and `composition-prelive-acceptance` last (re-checked: no remaining worktree depended on it).
- **Removed: 10. Skipped: 0.** About 1.1 GB recovered (D: free 18.0 to 19.1 GB).
- **Shared targets intact:** the original dev folder's `node_modules` is unchanged (457 top-level entries, 14,409 files, `electron.exe` present, same as the pre-check baseline); dev status byte-identical (9 entries, HEAD `80e6fd39`); no branch deleted (spot-checked refs exist); 0 prunable; **43 registered worktrees** (was 53).
- **Untouched:** both dirty preflight worktrees (`wp06-final-stage-preflight`, `wp06-line931-preflight`; their junctions to the dev `node_modules` remain valid), all other dirty worktrees, `sasv-620-g1`, `sasv-release-test`, the pilot backup, v6.2.0 (still Latest), Executive MIS.

## 12. PROPOSAL (not executed): remaining clean, merged worktrees
After the removals above, 23 further worktrees are clean, have 0 commits ahead of `origin/main` and every HEAD is contained in remote branches (so nothing would be lost), about 2.7 GB: the 19 small ones (about 29 MB each) `composition-global-reference-authority`, `composition-governed-quantity-number`, `composition-offline-semantic-plan`, `composition-workflow-version-path`, `global-reference-dictionary-client`, `merge-consolidated-review`, `merge-final-shell`, `merge-final-visual-css`, `merge-reference`, `merge-reference-review-landscape`, `post-entry-ingredient-form-reconciliation-client`, `pre-entry-reopen-lifecycle-guard`, `reference-dictionary-consolidated-review`, `reference-dictionary-final-shell`, `reference-dictionary-shell`, `reference-mapping-composition`, `reference-mapping-ux-polish`, `reference-options-contract`, `reference-review-landscape`, `remove-queue-kpis`, plus the three with their own `node_modules`: `composition-first-live-line-930` (805 MB), `composition-line930-release-gate` (805 MB), `composition-page-identity-contract` (433 MB). Method as before (`git worktree remove`, no force, per-folder checks), owner approval required.
**KEEP (do not remove): ** worktrees with unique pushed commits ahead of main: `wp07-s2c-c1-qc-preparation-ui` (31), `wp07-final-validation` (43), `wp07-regression-acceptance` (2), `wp07-v390-final-acceptance` (5), `sasv-cache-v390-test` (6), `sasv-costing-preview-owner` (33), `cw06-dialogs-item1` (1), `lab-repeat-analysis-governance-client` (3). Inside the original dev folder (protected): `.worktrees/bmr-lifecycle-client`, `.worktrees/cw06-dialogs-item1`, `.worktrees/manage-bmr-main-visual`, `node_modules/.worktrees/lab-repeat-analysis-governance-client`.
**Dirty (10 to 8 after the above), unchanged proposal in section 10b.**

## 13. Execution record: 23 clean merged worktrees (20 Nov 2026, owner approval #490 comment 7040895817)
Section 12's "19 small" label was a miscount: it enumerates 20 small plus 3 large, 23 in total, and 23 were processed. Per worktree: exact path, registration, canonical path, clean status including untracked, HEAD an ancestor of `origin/main`, no reparse point or nested `.git`, no inbound `node_modules` junction, then `git worktree remove` without force.
- **Removed: 23. Skipped: 0.** Disk recovered **2.65 GB** (D: free 19.1 to 21.8 GB). The three large ones: `composition-first-live-line-930` (805 MB), `composition-line930-release-gate` (805 MB), `composition-page-identity-contract` (433 MB).
- **Preservation checks:** registered worktrees **20** (was 43), 0 prunable; all 23 branch refs still exist (0 missing; 5 were detached worktrees whose commits are in `origin/main`); local branches 48 unchanged; dev worktree status byte-identical (9 entries, HEAD `80e6fd39`); dev `node_modules` 457 entries / 14,409 files unchanged; v6.2.0 still Latest; rollback installer and pilot backup present; dirty worktrees still 10.

## 14. PROPOSAL (not executed): reconcile the 8 non-protected dirty worktrees
| Worktree (branch, ahead of main) | What is uncommitted | Risk | Proposed action | Approval |
|---|---|---|---|---|
| `composition-executor-packaging-proof` (detached at main) | **Real source work**: 8 modified tracked files (about 275 added lines in `electron/eaushadhi-worker/*`, `preload.js`, review-control/worker-client, 3 smoke scripts) and at least 4 new files (`composition-executor.js`, `composition-live-adapters.js`, `composition-live-arm.js`, `composition-native-normalizer.js`, more untracked) | High: exists only on this PC, not on any branch | Preserve first: commit everything to a NEW branch `wip/composition-executor-packaging-proof-20261120` and push (no force, secret scan first); then owner decides continue / abandon. Do not delete | Owner decision |
| `wp07-ux1` (`feat/wp07-ux1-worklist`, 29 ahead, pushed) | untracked `UX1_2_PLAN.md` (17 KB), `UX2_PLAN.md`; one CRLF SQL edit; `.tmp-smoke-userdata/` logs | Medium: two plan documents only on this PC | Copy both plans to an archive folder outside the repository (or commit on a docs branch); logs removable | Yes |
| `wp07-bundle-a-screen-test` (detached, 30 ahead) | `package-lock.json` shows 0 additions, **153 deletions** (looks accidental truncation); stray file named `tatus --short` (shell mishap); one CRLF SQL edit | Low | Save a patch of `package-lock.json` outside the repo, then owner decides discard; remove the stray file | Yes |
| `wp06-final-stage-preflight` (detached, 0 ahead) | 14 `.tmp-final-stage-*` scripts/json (generated CDP/preflight scratch, some may embed SQL) | Low/medium (may hold sensitive SQL text) | Archive to a restricted folder, review, then remove | Yes |
| `wp06-line931-preflight` (detached, 0 ahead) | 3,303 untracked `.tmp-line931-*` files plus 482 MB `.tmp-line931-preflight-userdata` | Medium (live-run preflight scratch) | Create a manifest (names, sizes, hashes), archive only what the owner wants, then remove; junction to dev `node_modules` stays valid until the worktree is removed | Yes, separately |
| `wp04-s0-cursor-runner` (pushed, 33 ahead) | 6 untracked `__pycache__` files | None | Delete the pycache files only | Yes |
| `prm-bypass` (pushed, 1 ahead) | one CRLF-only SQL edit | None | Leave (or `git checkout -- <file>` with approval) | Optional |
| `manage-bmr-main-visual` (inside the dev folder) | 2 `.tmp` stdout/stderr logs | None | Delete the 2 logs; protected area, so only with explicit approval | Yes |
Protected and untouched: the original dev folder (9 uncommitted entries incl. `.tmp-aside/`, `e HEAD`, `tring(9)`) and `sasv-release-test`.
**Recommended first step:** preserve `composition-executor-packaging-proof` on a pushed `wip/` branch, because it is the only unsaved real work.

## 15. Preservation record: executor-packaging work (20 Nov 2026, owner approval #490 comment 7040973653)
Branch `wip/composition-executor-packaging-proof-20261120`, commit `7c07b15a84bcccb8749230da8dddf0ebdd472f94`, parent = the worktree's original base commit `9910cc722755cb31eb606bb8104dc07a95e91a02`. Pushed without force; remote SHA equals the local commit. Pre-commit scan of all 13 files found no secrets, credentials, base64 blobs or binaries; only explicitly named paths were staged (13 files, 1,672 insertions, 4 deletions). **Not reviewed and not for merge.**
Files preserved: `electron/eaushadhi-worker/index.js`, `ipc.js`, `composition-executor.js` (new), `composition-live-adapters.js` (new), `composition-live-arm.js` (new), `composition-native-normalizer.js` (new); `preload.js`; `public/shared/js/eaushadhi-review-control.js`, `eaushadhi-review-worker-client.js`; `scripts/eaushadhi-worker-ipc-smoke.mjs`, `eaushadhi-worker-packaging-smoke.mjs`, `eaushadhi-worker-product-details-execution-smoke.mjs`, `eaushadhi-worker-composition-execution-smoke.mjs` (new).
Remaining uncommitted material in that worktree: none (status clean). The worktree was kept; nothing removed, reset or deleted. Dirty worktrees: 10 to 9.

## 16. PROPOSAL (not executed): next grouped cleanup of the remaining 9 dirty worktrees
Group A, tiny and generated (one approval): delete 6 untracked `__pycache__` files in `wp04-s0-cursor-runner`; delete 2 `.tmp` logs in `manage-bmr-main-visual`; delete the `.tmp-smoke-userdata` logs in `wp07-ux1` and the stray `tatus --short` file in `wp07-bundle-a-screen-test`.
Group B, preserve then clean (one approval): archive `UX1_2_PLAN.md` and `UX2_PLAN.md` (`wp07-ux1`) to a non-repository folder (or commit to a docs branch); save a patch of the 153-line `package-lock.json` deletion (`wp07-bundle-a-screen-test`) for owner decision.
Group C, scratch archive then remove (separate approval): `wp06-final-stage-preflight` (14 files) and `wp06-line931-preflight` (3,303 files and 482 MB), with a manifest and restricted archive first because they may embed SQL.
Group D, leave: CRLF-only edits (`prm-bypass`, the SQL edits in the dev folder, `wp07-ux1`, `bundle-a`, `sasv-release-test`).
Group E, protected: original dev folder and `sasv-release-test`.

## 17. Execution record: Group A (20 Nov 2026, owner approval #490 comment 7041038252)
Before deletion each path was confirmed untracked, not a junction or symlink, and its content inspected. **10 files deleted, 0 skipped, about 0.3 MB:**
- `wp04-s0-cursor-runner\supabase\tests\wp04\__pycache__\` : `auth_api_harness`, `operator_launcher`, `test_auth_api_harness`, `test_operator_launcher`, `test_runner`, `test_test_runner` (all `.cpython-312.pyc`; the empty `__pycache__` folder was left).
- `daily-worklog-app\.worktrees\manage-bmr-main-visual\`: `.tmp-manage-bmr-visual.stderr.log` (empty) and `.tmp-manage-bmr-visual.stdout.log` (npm start banner only).
- `wp07-ux1\.tmp-smoke-userdata\eaushadhi-worker-logs\2026-10-25.jsonl` and its now-empty log directory.
- `wp07-bundle-a-screen-test\tatus --short`: confirmed accidental, it contained one colourised `git log --oneline` line for commit `6c4434ae`.
**After:** `wp04-s0-cursor-runner` and `manage-bmr-main-visual` clean; `wp07-ux1` has only the CRLF SQL edit and the two plan documents; `wp07-bundle-a-screen-test` has only `package-lock.json` and the CRLF SQL edit. Not touched: plan documents, `package-lock.json`, SQL, source, any whole worktree. Dev folder status byte-identical to baseline (9 entries, HEAD `80e6fd39`); v6.2.0 still Latest. Dirty worktrees: 9 to 7.

## 18. PROPOSAL (not executed): Group B, preserve the WP07 plans and the lockfile patch
Archive root (outside every repository, not tracked): `D:\ELECTRON PROJECTS\sasv-archive-20261120\`.
| Item | Source | Facts | Proposed action |
|---|---|---|---|
| `UX1_2_PLAN.md` | `wp07-ux1` (untracked) | 17,320 B, 192 lines, sha256 `5D5D80545E4C38BA...`, no secret patterns | copy to `...\wp07-ux1\`, verify SHA-256, keep original |
| `UX2_PLAN.md` | `wp07-ux1` (untracked) | 21,826 B, 215 lines, sha256 `0EA8D686DD53E3D1...`, no secret patterns | same |
| `package-lock.json` change | `wp07-bundle-a-screen-test` (HEAD `6c4434ae`, branch `feat/wp07-bundle-a-ux-polish` pushed) | working copy has 153 lines removed, 0 added (8,969 to 8,816 lines): drops the `@electron/windows-sign` block and similar `optional`/`dev` entries, consistent with an `npm install` pruning, not intended content | save `git diff -- package-lock.json` as `package-lock-bundle-a-20261120.patch` plus its SHA-256 in the archive; do NOT revert the file; owner then chooses discard or keep |
Optional: commit the two plans to a docs branch instead of (or as well as) the archive copy. Verification after execution: SHA-256 of each archived file equals the source; originals untouched; `package-lock.json` unchanged. Owner approval required before any copy; no deletion is part of Group B.

## 19. Execution record: Group B archive (20 Nov 2026, owner approval #490 comment 7041097950)
Archive root `D:\ELECTRON PROJECTS\sasv-archive-20261120\` (outside every Git repository; nothing uploaded). Files:
| Archive file | SHA-256 | Bytes | Check |
|---|---|---|---|
| `wp07-ux1-plan-documents\UX1_2_PLAN.md` | `5D5D80545E4C38BA94BBC96EF6977D18E90FC9B1F8553CECE77008FF7C61C09A` | 17,320 | equals original |
| `wp07-ux1-plan-documents\UX2_PLAN.md` | `0EA8D686DD53E3D1CB2AF87E5965311B7F58714ABEBFCD6155AB7A8CF918E1C9` | 21,826 | equals original |
| `wp07-bundle-a-package-lock-patch\package-lock-bundle-a-20261120.patch` | `38425EED9BCFBA3C1709BB25DFE0E11B34D3F22AB8BEE020D492FFDAF1B56293` | 7,472 (290 lines) | `git apply --check -R` against the working copy succeeds (no file modified) |
| `PROVENANCE.txt` | n/a | 1,336 | records source worktrees, branch, HEAD commits and hashes |
Provenance: plans from `wp07-ux1` (branch `feat/wp07-ux1-worklist`); patch from `wp07-bundle-a-screen-test` (detached HEAD `6c4434ae`, remote branch `origin/feat/wp07-bundle-a-ux-polish`), 0 additions and 153 deletions in `package-lock.json`, not committed, not reverted.
Verification after archiving: the two plan documents and `package-lock.json` have the same SHA-256 as before; both worktrees' `git status` unchanged (plans untracked, lockfile and CRLF SQL edit still modified). Nothing was deleted, reverted, restored, committed or modified; Group C and the SQL line-ending edits untouched.

## 20. PROPOSAL (not executed): next recommendation
1. **Group C, manifest first (non-destructive step, can proceed once approved):** for `wp06-final-stage-preflight` (14 untracked files) and `wp06-line931-preflight` (3,303 untracked files and the 482 MB `.tmp-line931-preflight-userdata`), write a manifest (path, size, SHA-256) into `sasv-archive-20261120\wp06-preflight-manifests\` and flag any file whose text matches SQL/secret patterns. Then the owner chooses per file group: archive (restricted folder), keep, or remove. Removal of those two worktrees (clean after cleanup) would follow separately; junctions to the dev `node_modules` are removed link-only first.
2. **Group D (leave):** CRLF-only SQL edits in `prm-bypass`, `wp07-ux1`, `wp07-bundle-a-screen-test`, the dev folder and `sasv-release-test`.
3. **`wp07-bundle-a-screen-test` lockfile:** owner decision, discard (restore from HEAD) or keep; the archive patch preserves it either way.
4. **Beyond worktrees (cleanup plan group 4 and 5):** the per-branch report for 329 unmerged remote branches and 40 open PRs, and `git maintenance`/`gc` on the dev repository after worktrees settle; none started.
