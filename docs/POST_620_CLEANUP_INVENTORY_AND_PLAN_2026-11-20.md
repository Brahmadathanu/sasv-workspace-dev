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

## 21. Group C inventory (read-only, 20 Nov 2026) and consolidated removal proposal
Scope: `wp06-final-stage-preflight` (HEAD `01ce609d`, 0 ahead of main, 0 tracked changes, 14 untracked entries) and `wp06-line931-preflight` (HEAD `6e5d11ea`, 0 ahead, 0 tracked changes, 3,303 untracked entries, 482 MB). Manifest (paths, sizes, SHA-256, classification; 75 rows, 11,867 bytes, SHA-256 `AD71C6A6B3739EF06022BECCAE1391EF73200790B029CA806E9756FAB0422E47`) is kept locally at `D:\ELECTRON PROJECTS\sasv-archive-20261120\wp06-preflight-manifest-20261120.csv` and is not uploaded. The 482 MB userdata folder is NOT archived (no compelling reason).
**Findings:** (1) no junction, symlink or reparse point inside either worktree (their `node_modules` junction is outside this scan); (2) nothing in tracked source in either worktree references `.tmp-line931*`, `.tmp-final-stage*` or `.tmp-write-authority`; (3) no running process uses either folder; (4) sensitive material: `.tmp-line931-preflight-userdata\eaushadhi-portal-profile` is a full Chromium profile of the e-Aushadhi portal (contains `Login Data`, `Web Data`, `History`, `Local State`, cookies/Local Storage), the `*-server-authority.json/.b64`, `.tmp-write-authority.js` and the `*-rpc` folders hold authority or RPC material (one secret-pattern hit in `.tmp-write-authority.js`; no token patterns elsewhere); (5) unique material: live-run result files, see below.
| Class | Entries | Size | Examples | Proposal |
|---|---|---|---|---|
| GENERATED-DELETE | 46 | 316.7 MB | browser caches (`Cache` 299.5 MB, `Code Cache`, GPU/Dawn caches), one-off CDP/preview `.mjs` and `.json` scratch | delete |
| SENSITIVE-DELETE | 20 | 165.7 MB | portal browser profile and storage, authority files, RPC arg/log folders | delete, never archive |
| EVIDENCE-KEEP | 9 | 0.05 MB | `.tmp-line931-live-exec-result.json` (pass=true, controlled line-931 run), `.tmp-final-stage-exec-result.json` (pass=false, RPC bridge timeout), `*-preflight/preview/resume/handoff-result.json`, `.tmp-line931-live-exec.mjs`, `.tmp-final-stage-execute.mjs` | copy to `sasv-archive-20261120\wp06-live-run-evidence\` with SHA-256 after a mask review, keep originals until verified |
**Consolidated recommendation:** (a) copy the 9 evidence files (about 50 KB) to the archive and verify hashes; (b) delete the other 66 entries (about 482 MB, per-path verified against the manifest, files individually, the userdata folder as one exact verified path); (c) the two worktrees then have clean status and can be removed later under a separate approval (the link-only `node_modules` junction step applies). Owner approval required for (a), (b) and (c); nothing was deleted in this step, no source, branch, worktree, release, backup or Executive MIS change.

## 22. Execution record: Group C (20 Nov 2026, owner approval #490 comment 7041265357)
**Manifest correction:** the first manifest (`wp06-preflight-manifest-20261120.csv`, sha256 `AD71C6A6...0422E47`) had 18 classification cells that were written as `System.Object[]` (a PowerShell switch matched several patterns); paths, sizes and SHA-256 values were correct. A corrected `wp06-preflight-manifest-20261120-v2.csv` (sha256 `065EFD04CBC6138ABA42C33EF36674F01E68B62C405C2E20D81BF0F0B3B16305`) was generated with first-match rules, and its totals equalled the approved scope exactly (46 generated, 20 sensitive, 9 evidence) before anything was deleted.
**Evidence preserved** (scan: no secret, token, cookie, email, phone or URL-query patterns), copied to `D:\ELECTRON PROJECTS\sasv-archive-20261120\wp06-live-run-evidence\` with `PROVENANCE.txt`; every copy matches its source SHA-256:
| File | SHA-256 |
|---|---|
| `final-stage-preflight\.tmp-final-stage-exec-result.json` | `49376A80DA94162C03CF7A3643FB9614DF73E53906D4ECF580C8C375A76996F4` |
| `final-stage-preflight\.tmp-final-stage-execute.mjs` | `CDB886FB33E1F9010046A2285975E2C8B8861A6F91DE340850F6B75D44C5D0D2` |
| `final-stage-preflight\.tmp-final-stage-preflight-result.json` | `E702AAFD7AA9526779A0F9D4E90C973BD1BD3301676975D3ED6F6482C9164B82` |
| `line931-preflight\.tmp-line931-cdp-preview-result.json` | `5449528930E75F66BA54C32C332B29D1065E190718CCC4EEF364BED3D9780294` |
| `line931-preflight\.tmp-line931-handoff-preview-result.json` | `C0499374830869FD33F2A48CF9DAEB35CD9E929A30F94348AFB0C36520431B4B` |
| `line931-preflight\.tmp-line931-live-exec-result.json` | `67768D2DB03130F0BC762EB7530002899A65113196FBC0E01152EB1AED65BFB7` |
| `line931-preflight\.tmp-line931-live-exec.mjs` | `BCBF85F3A08B7974A564B66735CF25DB4C9CEB6906CEB9C83AF3F4168FFA52EC` |
| `line931-preflight\.tmp-line931-preflight-preview-result.json` | `62F3FF86EA7FFE0F833DE1F2D0F097F7C34EA0D1FD3CCB775B4159D88773D956` |
| `line931-preflight\.tmp-line931-resume-preview-result.json` | `D854E9F90E15D272F66E674F67CE5FC35FF0271C43537F372476A903A12947A3` |
**Deleted: 66 manifest entries, 0 skipped, about 487 MB recovered:** 48 individual files (hash-verified, untracked) and the 18 children of `.tmp-line931-preflight-userdata` (removed as that one exact path after its child list and 505,552,076 bytes matched the manifest aggregates), including the e-Aushadhi portal browser profile and authority/RPC scratch; 2 now-empty `*-rpc` folders. No sensitive content was copied or published. Revalidation before deletion: no junction/symlink inside either worktree, no process using them, no tracked file among the entries.
**After:** both worktrees still exist; each now has only the 9 untracked evidence originals (copies are verified in the archive); HEADs unchanged (`01ce609d`, `6e5d11ea`); their `node_modules` junctions were not touched; dev worktree status byte-identical (9 entries, HEAD `80e6fd39`); dev `node_modules` intact; 20 worktrees, 48 local branches (unchanged); v6.2.0 still Latest; rollback installer and pilot backup present.

## 23. PROPOSAL (not executed): remove the two now-clean worktrees
`wp06-final-stage-preflight` and `wp06-line931-preflight`: HEAD in `origin/main`, 0 tracked changes. Steps if approved: (1) re-verify each of the 9 untracked originals against the archive SHA-256 above, then delete just those 9 files; (2) confirm clean status; (3) read the `node_modules` junction target (expected: the original dev folder's `node_modules`), remove only the link with `rmdir`, re-count the target; (4) `git worktree remove` without force. Result: 18 worktrees remain; no branch deleted. Owner approval required.

## 24. Execution record: the two WP06 preflight worktrees (20 Nov 2026, owner approval #490 comment 7041375674)
For each of `wp06-final-stage-preflight` (HEAD `01ce609d`) and `wp06-line931-preflight` (HEAD `6e5d11ea`): HEAD an ancestor of `origin/main`; no tracked change; the untracked originals (3 and 6) each matched their archived copy by full SHA-256 (section 22) and only those 9 were deleted; status clean; `node_modules` verified as a junction whose target was exactly `D:\ELECTRON PROJECTS\daily-worklog-app\node_modules`; link removed with `rmdir`; dev `node_modules` re-counted (457 entries, 14,409 files, unchanged); then `git worktree remove` without force.
- **Removed: 2. Skipped: 0.** Disk recovered about 62 MB (D: free about 22.3 GB; the 487 MB of Group C was freed earlier).
- **After:** 18 registered worktrees (was 20); dev worktree status identical to the baseline; branches unchanged (no branch deleted; the two worktrees were detached); v6.2.0 still Latest.

## 25. CONSOLIDATED PLAN (proposal only, nothing deleted): remaining worktrees and GitHub housekeeping
**A. Remaining 18 worktrees**
| Group | Worktrees | Proposal |
|---|---|---|
| Protected | original `daily-worklog-app` (16 entries incl. untracked), `sasv-release-test` (6 dirty), `sasv-620-g1` (verified 6.2.0 build) | keep |
| Inside the dev folder (protected area) | `.worktrees/bmr-lifecycle-client` (clean, in main), `.worktrees/cw06-dialogs-item1` (1 pushed commit), `.worktrees/manage-bmr-main-visual` (clean, detached), `node_modules/.worktrees/lab-repeat-analysis-governance-client` (3 pushed commits) | owner decides; `bmr-lifecycle-client` and `manage-bmr-main-visual` could go (already in main) |
| Pushed work, clean (about 3.1 GB with own `node_modules`) | `wp07-s2c-c1-qc-preparation-ui` (814 MB, 31 ahead), `wp07-final-validation` (450 MB, 43), `wp07-regression-acceptance` (450 MB, 2), `wp07-v390-final-acceptance` (450 MB, 5), `sasv-cache-v390-test` (46 MB), `sasv-costing-preview-owner` (50 MB), `wp04-s0-cursor-runner`, `executor-packaging-proof` (wip branch) | each HEAD is contained in a pushed remote branch; folders could be removed (branches stay) if the owner no longer needs a local checkout; one-at-a-time with the same checks |
| Dirty, small | `wp07-ux1` (CRLF SQL + the two plans, archived), `wp07-bundle-a-screen-test` (lockfile diff archived + CRLF SQL), `prm-bypass` (CRLF SQL) | owner decides on the lockfile; CRLF-only edits can be reverted with approval |
**B. GitHub branches and PRs (read-only classification, 365 remote branches, 437 PRs: 367 merged, 42 open, 28 closed)**
| Class | Count | Proposal |
|---|---|---|
| Remote branch whose PR is MERGED | 283 | delete the branch refs in batches (PRs and merge commits stay; GitHub's "Restore branch" recovers each); better first enable repository setting "Automatically delete head branches"; owner approval for each batch |
| OPEN PR | 42 | owner triage (keep / close with comment); #485 and #486 (Executive MIS) isolated and excluded |
| PR CLOSED unmerged | 19 | review; tag `archive/<name>` before any deletion |
| No PR, not merged | 19 | keep for review; includes the 5 preserved today (`test/wp04-s0-cursor-runner`, `feat/lab-repeat-analysis-governance-client`, `costing/w1-approved-run-labels-rebased` and `wip/composition-executor-packaging-proof-20261120`) and 14 older docs/claude/staging branches |
| Ancestor of main, no PR | 1 | deletable |
| Local branches (49) | 35 have no remote branch, all 0 ahead of main except `prm-bypass` (1, pushed under another name) | `git branch -d` (refuses unmerged) for the 0-ahead ones after a list review; the other 14 are tracked by class above |
Order I recommend: (1) enable auto-delete of merged branches and a `v*` tag ruleset; (2) delete the 283 merged remote branches in batches of about 50 with a pre-listed manifest; (3) triage the 42 open PRs; (4) local `git branch -d` for the 35 ancestor branches; (5) `git maintenance` / `gc` on the dev repository. Every step needs separate approval; none was executed. Note: a `git fetch --prune` was run in the dev repository while classifying (it only refreshes remote-tracking refs; no worktree, branch or file changed).

## 26. Repository setting applied; first merged-branch batch prepared (20 Nov 2026, owner approval #490 comment 7041477266)
**Setting:** "Automatically delete head branches" was `false`; set to `true` via the repository API and read back as `true`. Compatibility checked: 24 workflows trigger only on `main` or fixed branch filters and use `github.event.pull_request.head.sha` for checkouts (none needs a head branch to survive its merge); 5 open PRs have a non-`main` base (#477, #473, #385, #275, #118): when their base PR merges and its head branch is deleted, GitHub retargets them to the merged PR's base, so they are not orphaned; Executive MIS PRs #485/#486 base on `main` and simply lose their head branch after merging. The setting applies only to future merges: no existing branch, local branch, PR, tag, branch-protection rule or release was changed (365 remote branches before and after, v6.2.0 still Latest, 42 open PRs). Tag protection (`v*`) is NOT part of this step.
**Historical cleanup, classification of the 283 merged-PR remote branches:** 274 have no exception; 9 are excluded (7 still exist as local branches, 3 of them checked out in worktrees; 2 match the Executive MIS name filter). For every branch the current tip equals the head commit of its merged PR or is an ancestor of `main` (no post-merge commits exist). No branch is the head of an open PR or the base of one.
**BATCH 1 (PROPOSED, NOT DELETED): 50 branches, the oldest merged first (merged 24 Oct to 4 Nov 2026).** Local manifests with SHAs: `sasv-archive-20261120\merged-branches-batch1-manifest-20261120.csv` (sha256 `A2C8D51C5148CA52D89E2D8EF35B7B36293FA7DDDEEB2E2539801FCA3FFE2C11`) and `merged-branches-full-classification-20261120.csv`. Recovery for each: the PR page's "Restore branch" button, or `git push origin <sha>:refs/heads/<name>` using the SHA below; the merge commits stay on `main`.
| Branch | PR | Merged | Tip |
|---|---|---|---|
| `feat/wp07-qc-pilot-rebased` | #79 | 2026-10-24 | `0de9ec6a6e` |
| `codex/costing-lock-screen` | #101 | 2026-10-30 | `2b3d8c4902` |
| `codex/costing-recalc-with-date` | #100 | 2026-10-30 | `ba2b2c828d` |
| `codex/costing-run-status-screen` | #102 | 2026-10-30 | `e687c97290` |
| `chore/migration-20261015045233-line-endings` | #109 | 2026-10-31 | `f62c62426c` |
| `codex/costing-polish-lock-runstatus` | #103 | 2026-10-31 | `ac6eee1fc2` |
| `codex/costing-ux-consistency` | #104 | 2026-10-31 | `003c4470b0` |
| `costing/cw05-table-tools` | #106 | 2026-10-31 | `380e65366d` |
| `costing/cw05-table-tools-pkg2` | #108 | 2026-10-31 | `c74b10b48a` |
| `docs/costing-state-2026-10-31` | #107 | 2026-10-31 | `87ea7d962e` |
| `claude/tender-carson-67ip7t` | #124 | 2026-11-01 | `3075c633c3` |
| `costing/cw05-table-tools-pkg3` | #110 | 2026-11-01 | `aa37a4705b` |
| `costing/cw05-table-tools-pkg4` | #112 | 2026-11-01 | `d3d779bae0` |
| `costing/review-worklist-v1` | #111 | 2026-11-01 | `522efa6094` |
| `docs/state-update-2026-11-01` | #113 | 2026-11-01 | `a3e4f81da7` |
| `feat/costing-c1b-run-148-worklist` | #117 | 2026-11-01 | `1c4e385c56` |
| `feat/costing-c1-run-context-diagnostics` | #115 | 2026-11-01 | `fb7e863b82` |
| `feat/costing-uxf1-dashboard-compact-ccc` | #121 | 2026-11-01 | `175e55557b` |
| `feat/costing-uxf2-compact-worklist` | #125 | 2026-11-01 | `00845b5d7d` |
| `merge-prep/wp07` | #120 | 2026-11-01 | `f1e63b598b` |
| `release/costing-uxf1-cache-v390` | #123 | 2026-11-01 | `1bbf358b78` |
| `feat/costing-cw06-route-dialogs` | #126 | 2026-11-02 | `151cb615fc` |
| `feat/costing-cw07-cost-sheet-terminology` | #128 | 2026-11-02 | `533eb29f68` |
| `feat/costing-cw13-responsive` | #127 | 2026-11-02 | `7f6e9d4e4d` |
| `claude/blissful-dijkstra-jt1vdq` | #135 | 2026-11-03 | `f29f8c3561` |
| `claude/confident-cori-kkf1ok` | #134 | 2026-11-03 | `5f7252ead2` |
| `claude/costing-u11-terminology` | #144 | 2026-11-03 | `202757f8a6` |
| `claude/keen-bohr-9jgfx5` | #139 | 2026-11-03 | `5c3869acd8` |
| `claude/mdc07-n1-shared-navigation` | #133 | 2026-11-03 | `d45950a95d` |
| `claude/serene-planck-h9syav` | #136 | 2026-11-03 | `ae41de8d6e` |
| `claude/wp05-costing-rationalisation-audit` | #130 | 2026-11-03 | `f5510028dc` |
| `claude/wp05-p01-readiness-usability` | #132 | 2026-11-03 | `62666a2dfa` |
| `claude/wp05-p02-production-route-corrections` | #131 | 2026-11-03 | `bed99d82a9` |
| `docs/costing-navigation-wave-postmerge-20261103` | #140 | 2026-11-03 | `c7dae684ea` |
| `docs/costing-postmerge-status-20261102` | #129 | 2026-11-03 | `c70673505e` |
| `fix/costing-n2-n3-historical-scope-guards` | #138 | 2026-11-03 | `7a5b1abbac` |
| `claude/costing-a7-material-review-acceptance-tests` | #146 | 2026-11-04 | `25ab33be96` |
| `claude/costing-cde1a-mock-evidence-drawer` | #149 | 2026-11-04 | `b272f07534` |
| `claude/costing-guard-repair-fixed-ranges` | #156 | 2026-11-04 | `6be24a6601` |
| `claude/costing-scope-guard-sql-comment-fix` | #170 | 2026-11-04 | `4577b5eeaf` |
| `claude/costing-wp05-cl1-closure-evidence` | #151 | 2026-11-04 | `284ec6772b` |
| `claude/costing-wp06-f7-clean` | #161 | 2026-11-04 | `e0a3770219` |
| `claude/costing-wp06-f9-clean` | #162 | 2026-11-04 | `9ae655eb84` |
| `claude/costing-wp06-g1b-default-policy-modal-tests` | #154 | 2026-11-04 | `e1b0cf6fe8` |
| `claude/costing-wp06-g1c-mrp-proposal-tests` | #155 | 2026-11-04 | `2167898784` |
| `claude/costing-wp06-g1d-csa-concurrency` | #153 | 2026-11-04 | `729a692d47` |
| `claude/costing-wp06-g1-task-flow-audit` | #152 | 2026-11-04 | `f4dd56c222` |
| `claude/costing-wp12-flag-matrix-sweep` | #160 | 2026-11-04 | `0521863da7` |
| `claude/epic-faraday-8qt8fa` | #165 | 2026-11-04 | `6fde88c11a` |
| `claude/epic-faraday-8qt8fa-wp12-allowlist` | #169 | 2026-11-04 | `36b47dafc7` |
Method if approved: delete the 50 refs through the GitHub API one by one (`DELETE /git/refs/heads/<name>`), after re-verifying each branch's tip still equals the manifest SHA and has no open PR; then re-count (365 to 315). Never touch Executive MIS, open-PR branches, unmerged branches, tags or releases.

## 27. Execution record: remote branch cleanup, Batch 1 (20 Nov 2026, owner approval #490 comment 7041567213)
Re-verified immediately before deleting each of the 50 Batch 1 branches: tip prefix equals the manifest SHA, the merged PR number matches, the tip equals the merged PR head (or is in `main`), no open PR uses it as head or base, no local branch or worktree, not Executive-MIS-named, and `refs/pull/<n>/head` still resolves to the PR's head commit (this keeps the original, pre-squash commits recoverable after the branch ref is gone). The tip was re-read again right before each `DELETE /git/refs/heads/<name>` (one call per branch, no wildcard, no force).
- **Deleted: 50. Skipped: 0. Failed: 0.** Remote branches 365 to **315**.
- **Recovery:** full SHAs and PR numbers saved locally in `sasv-archive-20261120\merged-branches-batch1-recovery-20261120.csv`; restore with the PR's "Restore branch" button or `git push origin <fullSha>:refs/heads/<name>` (also reachable as `refs/pull/<n>/head`).
- **Protected, verified after:** all 42 open-PR head branches still exist; the 4 branches preserved earlier (`wip/composition-executor-packaging-proof-20261120`, `test/wp04-s0-cursor-runner`, `feat/lab-repeat-analysis-governance-client`, `costing/w1-approved-run-labels-rebased`) exist; `main` is `be529de2`; `v6.2.0` tag is `ebb59a49` and still Latest; 437 PR head refs resolve.
- **Observation:** #487, #488 and #489 have merged. `costing/w1-approved-run-labels-rebased` maps to merged PR #90 and its pushed tip equals that PR's head, so its two commits were already in `main` through a squash; the earlier "unpushed" preservation was redundant but harmless. The name filter `mis|executive` was too broad: it excluded `fix/lab-tolerance-observation-missing-count-20261111` (#271) and `docs/wp05-w506-permission-boundary-matrix-20261109` (#249) because of the letters "mis" in "missing"/"permission"; neither is Executive MIS.

## 28. BATCH 2 (PROPOSED, NOT DELETED)
Remaining merged-PR remote branches 233; 224 have no exception. Exceptions (9): `chore/gitignore-local-remnants-20261120` (#489), `docs/post-620-cleanup-inventory-20261120` (#488), `docs/620-final-acceptance-receipt-20261120` (#487) and `costing/cw06-dialogs-item1`, `costing/approval-screen-preview`, `costing/w1-approved-run-labels-rebased`, `feat/wp07-s2b-b1-qc-report-read-probe` (each still a local branch or worktree); #271 and #249 only match the over-broad name filter (owner may include them). Batch 2 = the next 50 oldest eligible (merged 4 to 8 Nov 2026), manifest with full SHAs in `sasv-archive-20261120\merged-branches-batch2-manifest-20261120.csv` (sha256 `66A22A46DEA03E1427419D72390ECC3C5F8CCC61D06A9BD7DD7ADE5E7DBCA0EE`). Same method and re-checks as Batch 1; remote count would go 315 to 265.
| Branch | PR | Merged | Tip |
|---|---|---|---|
| `claude/ma-lint-fix` | #167 | 2026-11-04 | `a32474841d` |
| `claude/ma-ux-2-visual` | #168 | 2026-11-04 | `e005c1d33a` |
| `claude/vibrant-pasteur-9gohzi` | #164 | 2026-11-04 | `f022a38e0e` |
| `docs/costing-acceptance-security-audit-20261104` | #171 | 2026-11-04 | `6be34b8221` |
| `docs/costing-sec-a1-prepared-20261104` | #172 | 2026-11-04 | `40328860d0` |
| `docs/costing-sec-a2-live-verification-20261104` | #173 | 2026-11-04 | `4f29c0b62c` |
| `governance/manage-activities-rls-reconcile` | #166 | 2026-11-04 | `22d5478d1f` |
| `review/costing-wp06-f8-clean-20261104` | #163 | 2026-11-04 | `6927796772` |
| `design/csr-parameterized-secure-read-20261105` | #183 | 2026-11-05 | `b49fba3712` |
| `docs/cde2-live-source-contract-audit-20261105` | #191 | 2026-11-05 | `e53f64d9b3` |
| `docs/costing-authenticated-acceptance-gate-20261105` | #175 | 2026-11-05 | `48de3f7aa5` |
| `docs/costing-interactive-synthetic-preview-20261105` | #195 | 2026-11-05 | `080d92c9ef` |
| `docs/costing-loopback-preview-security-pass-20261105` | #194 | 2026-11-05 | `f92df509ba` |
| `docs/costing-preview-mock-ci-zero-skips-20261105` | #193 | 2026-11-05 | `6373c380f5` |
| `docs/costing-run150-failure-governance-20261105` | #190 | 2026-11-05 | `486d305ac4` |
| `docs/costing-six-module-read-navigation-20261105` | #177 | 2026-11-05 | `b84235b3d5` |
| `docs/costing-view-only-test-grants-20261105` | #176 | 2026-11-05 | `d01e6d840b` |
| `docs/csr-analyze-maintenance-verification-20261105` | #188 | 2026-11-05 | `88cabc3b2d` |
| `docs/csr-explain-plan-gate-20261105` | #181 | 2026-11-05 | `e3aa621173` |
| `docs/csr-owner-pwa-read-pass-20261105` | #189 | 2026-11-05 | `eb16486550` |
| `docs/csr-period-scoped-prototype-20261105` | #182 | 2026-11-05 | `0c55f298c4` |
| `docs/csr-printable-runtime-statistics-20261105` | #187 | 2026-11-05 | `64d823147a` |
| `docs/csr-read-timeout-diagnosis-20261105` | #180 | 2026-11-05 | `c82bc17304` |
| `docs/csr-three-period-plan-variance-20261105` | #186 | 2026-11-05 | `11eb7d901e` |
| `docs/prm-cost-centres-owner-retest-pass-20261105` | #179 | 2026-11-05 | `46211a2989` |
| `fix/costing-approval-view-only-sec-a2-20261104` | #174 | 2026-11-05 | `fc7d554976` |
| `fix/pec-manual-indent-insertion-order-20261105` | #185 | 2026-11-05 | `81f600fe96` |
| `fix/prm-cost-centres-view-only-read-20261105` | #178 | 2026-11-05 | `76053f07ed` |
| `test/costing-preview-provenance-gate-20261105` | #192 | 2026-11-05 | `d0f4d59dce` |
| `test/csr-scoped-rpc-contract-20261105` | #184 | 2026-11-05 | `5de2b94137` |
| `claude/costing-cde1b-provider-adapter-20261106` | #201 | 2026-11-06 | `20355f1171` |
| `claude/costing-completion-matrix-20261106` | #202 | 2026-11-06 | `3b3831051c` |
| `claude/costing-cs-a4-left-clip-fix-20261106` | #200 | 2026-11-06 | `9682ee6c13` |
| `claude/costing-cs-lines-preview-20261106` | #199 | 2026-11-06 | `87cf9151ff` |
| `claude/costing-preview-bulk-20261106` | #197 | 2026-11-06 | `ba7e7e46a0` |
| `docs/cde2-live-contract-corrections-20261106` | #203 | 2026-11-06 | `ce007fca22` |
| `docs/costing-preview-owner-correction-20261106` | #198 | 2026-11-06 | `d44eb14d58` |
| `claude/cde2-sql-candidate-20261106` | #205 | 2026-11-07 | `aaf6b040e8` |
| `claude/issue-206-acceptance-runner` | #207 | 2026-11-07 | `a94718eb44` |
| `claude/sasv-costing-suite-206-tqaq9o` | #209 | 2026-11-07 | `69564cf2f0` |
| `docs/cde2-eligibility-immutability-audit-20261106` | #204 | 2026-11-07 | `7449ccc678` |
| `claude/stoic-cannon-vu5j0w` | #221 | 2026-11-08 | `5d623ba9ff` |
| `claude/wizardly-volta-5put01` | #228 | 2026-11-08 | `1d48466369` |
| `claude/wp05-ae1-evidence-ledger` | #235 | 2026-11-08 | `08ee56a138` |
| `claude/wp05-ae2-local-evidence-credit` | #236 | 2026-11-08 | `fa9779c112` |
| `claude/wp05-cld1-offline-closure-acceleration` | #242 | 2026-11-08 | `a2eb263717` |
| `claude/wp05-par1-s2-s9-read-parity` | #237 | 2026-11-08 | `e245713207` |
| `docs/costing-14-lens-evidence-matrix-20261108` | #215 | 2026-11-08 | `28b3996018` |
| `docs/costing-checkpoint-handover-20261108` | #216 | 2026-11-08 | `71a6b44543` |
| `docs/costing-staff-preview-contract-20261108` | #218 | 2026-11-08 | `be6441b156` |

## 29. Execution record: remote branch cleanup, Batch 2 (20 Nov 2026, owner approval #490 comment 7041705379)
Manifest sha256 `66A22A46DEA03E1427419D72390ECC3C5F8CCC61D06A9BD7DD7ADE5E7DBCA0EE` verified. Same checks as Batch 1, with the full tip SHA compared to the manifest (not a prefix), re-read immediately before each of the 50 single-ref deletions; PRs #249 and #271 were excluded as instructed.
- **Deleted: 50. Skipped: 0. Failed: 0.** Remote branches 315 to **265**.
- **Recovery:** `sasv-archive-20261120\merged-branches-batch2-recovery-20261120.csv` (full SHA, PR, `refs/pull/<n>/head`); every PR head ref still resolves (437).
- **Protected, verified after:** 42/42 open-PR head branches exist; the preserved branches (`wip/composition-executor-packaging-proof-20261120`, `test/wp04-s0-cursor-runner`, `feat/lab-repeat-analysis-governance-client`, `costing/w1-approved-run-labels-rebased`), `costing/approval-screen-preview`, `costing/cw06-dialogs-item1` and the two review-pending branches for #271 and #249 exist; `main` is `be529de2`; tag `v6.2.0` is `ebb59a49`, still Latest with its 4 assets; 18 local worktrees untouched.

## 30. BATCH 3 (PROPOSED, NOT DELETED)
Merged-PR remote branches left: 183, of which 174 have no exception. Exceptions (9, unchanged): #487, #488, #489 (local branches or worktrees), #105, #99, #90, #57 (local branches or worktrees), and #271, #249 (owner review). The Executive MIS test is now strict (`executive-mis` / `mis-c<n>` names) and excluded nothing in the merged set; #485 and #486 are open and protected. Batch 3 = the next 50 oldest eligible (merged 8 to 11 Nov 2026); 33 of them have costing/WP05/WP10/WP12-type names, so these are more recent Costing-programme branches: each is merged and its PR head ref is preserved, but the owner may prefer to hold them. Manifest with full SHAs: `sasv-archive-20261120\merged-branches-batch3-manifest-20261120.csv` (sha256 `85F164EC88D2D9D5D8480208C5BFBFC6CCCD66AA938F7B2A4F1234BD9D8FC385`). Remote count would go 265 to 215.
| Branch | PR | Merged | Tip |
|---|---|---|---|
| `docs/csr-plans-closure-target-20261108` | #219 | 2026-11-08 | `3985317ce4` |
| `docs/idv-selector-subtab-acceptance-2026-11-08` | #217 | 2026-11-08 | `2ed951fa14` |
| `docs/pec-vwl-r2-live-migration-reconcile` | #239 | 2026-11-08 | `2ddc08848c` |
| `docs/scheme-master-logs-and-wp06-closure-20261108` | #226 | 2026-11-08 | `287d765143` |
| `docs/scheme-master-production-index-runbook-20261108` | #229 | 2026-11-08 | `fb8385ea9e` |
| `docs/wp05-formal-gate-audit-20261108` | #233 | 2026-11-08 | `590b0c73b3` |
| `docs/wp05-idv-owner-security-closure-20261108` | #241 | 2026-11-08 | `c89b6bb4d9` |
| `docs/wp05-par1-live-parity-20261108` | #240 | 2026-11-08 | `7e3f3a1c3c` |
| `docs/wp06-formal-owner-closure-20261108` | #232 | 2026-11-08 | `0e4e378837` |
| `docs/wp06-idv-navgroups-acceptance-20261108` | #223 | 2026-11-08 | `23668091ed` |
| `docs/wp06-owner-approved-acceptance-amendment-20261108` | #231 | 2026-11-08 | `698813c41e` |
| `docs/wp06-owner-decisions-scheme-57014-20261108` | #225 | 2026-11-08 | `7140eedfec` |
| `fix/lock-screen-client-edit-guard-20261108` | #212 | 2026-11-08 | `2174d8f3d8` |
| `fix/pec-vwl-search-reliability` | #238 | 2026-11-08 | `59b89ab3d7` |
| `fix/verify-served-assets-netlify-banner-20261108` | #210 | 2026-11-08 | `5d615c5748` |
| `migration/scheme-master-register-viability-lateral-20261108` | #214 | 2026-11-08 | `33b0eed075` |
| `claude/wonderful-lovelace-dym809` | #244 | 2026-11-09 | `81504e9c9c` |
| `claude/wp05-w506-client-01-dependency-matrix` | #253 | 2026-11-09 | `ccf5b3eba0` |
| `claude/wp05-w506-combined-release-readiness` | #256 | 2026-11-09 | `f7acc2d899` |
| `claude/wp05-w506-sec-fix-01-staff-writer-guard` | #254 | 2026-11-09 | `6137ff7f13` |
| `claude/wp05-w506-sec-fix-02-close-writer-guard` | #255 | 2026-11-09 | `47f8261717` |
| `docs/wp05-cld2-live-catalogue-20261109` | #243 | 2026-11-09 | `58e410b7f8` |
| `docs/wp05-cld3-live-scheme-check-20261109` | #245 | 2026-11-09 | `abd5cdc086` |
| `docs/wp05-closure-decision-package-20261109` | #246 | 2026-11-09 | `a54525634d` |
| `docs/wp05-owner-decisions-b1-security-plan-20261109` | #247 | 2026-11-09 | `9cd9a5e789` |
| `docs/wp05-targeted-w506-catalogue-20261109` | #248 | 2026-11-09 | `abafac964e` |
| `docs/wp05-w506-personnel-policy-and-client-trace-20261109` | #252 | 2026-11-09 | `5f9056a1be` |
| `docs/wp05-w506-sensitive-client-minimum-columns-20261109` | #251 | 2026-11-09 | `fb1599cd87` |
| `docs/wp05-w506-view-sensitivity-consumers-20261109` | #250 | 2026-11-09 | `8ed307bbb0` |
| `claude/clever-cori-ub53fg` | #266 | 2026-11-10 | `60954068c8` |
| `claude/wp05-w506-authenticated-acceptance` | #261 | 2026-11-10 | `8d61334283` |
| `claude/wp05-w506-conf-client-gate` | #258 | 2026-11-10 | `ea8c9554c2` |
| `claude/wp05-w506-conf-server-view-gate` | #257 | 2026-11-10 | `245a15570e` |
| `fix/wp05-scheme-master-list-projection-r12` | #263 | 2026-11-10 | `72aac23ae7` |
| `fix/wp05-w506-conf-migration-version-reconcile` | #260 | 2026-11-10 | `01fd2e69cc` |
| `claude/csr-scoped-rpc-client-273` | #276 | 2026-11-11 | `d6661034b0` |
| `claude/ecstatic-gates-6lcutk` | #269 | 2026-11-11 | `34c595ca0e` |
| `claude/epic-fermi-df6fia` | #286 | 2026-11-11 | `a61c2bf698` |
| `claude/wp05-gate-reconciliation-282` | #285 | 2026-11-11 | `b27197dc77` |
| `claude/wp05-overnight-offline-tests-20261110` | #268 | 2026-11-11 | `6ca7badfec` |
| `claude/wp05-viability-periods-proposal-20261110` | #270 | 2026-11-11 | `da3f47cb53` |
| `docs/wp05-handover-20261111-after-286` | #293 | 2026-11-11 | `3f8f35a137` |
| `docs/wp05-post-292-merge-reconciliation-20261111` | #295 | 2026-11-11 | `a40fc70ca8` |
| `docs/wp05-r20-owner-decisions-d2-subset-20261111` | #296 | 2026-11-11 | `93bad37f36` |
| `docs/wp05-r22-helper-predicate-followup-20261111` | #299 | 2026-11-11 | `c8d0e73f21` |
| `docs/wp05-r22-six-view-contract-evidence-20261111` | #298 | 2026-11-11 | `7d66fa624e` |
| `docs/wp05-r23-d2-role-dependency-20261111` | #300 | 2026-11-11 | `27a8e9215b` |
| `docs/wp05-r25-d2-render-contract-20261111` | #304 | 2026-11-11 | `007fb2eb1e` |
| `feat/fg-bit-ux-1-modernization` | #277 | 2026-11-11 | `424643c377` |
| `fix/wp05-csr-pwa-freshness-integrated-20261111` | #292 | 2026-11-11 | `554e7bcfea` |

## 31. Execution record: remote branch cleanup, Batch 3 (20 Nov 2026, owner approval #490 comment 7041853579)
Manifest sha256 `85F164EC88D2D9D5D8480208C5BFBFC6CCCD66AA938F7B2A4F1234BD9D8FC385` verified. Batch 1/2 checks repeated (full tip SHA equals manifest and re-read before each single-ref deletion; PR merged and matching; no open-PR head/base; no local branch or worktree; `refs/pull/<n>/head` preserved; PRs #249 and #271 excluded).
**Extra dependency screen for the 33 Costing-type branches (and all 50):** open-PR head/base, release notes, `.github/workflows` and docs/scripts referencing each branch name were searched on `origin/main`. Four branches had any reference at all: `claude/wp05-w506-conf-client-gate` (a historical design note marked "DEPLOYED 10 NOVEMBER 2026"), `fix/wp05-scheme-master-list-projection-r12` (a historical gate ledger that links Draft PR #263 by PR URL, which stays valid), and two branches named only as `push:` branch filters in `wp05-csr-verifier.yml` (`claude/epic-fermi-df6fia`) and `wp05-csr-pwa-freshness.yml` (`fix/wp05-csr-pwa-freshness-integrated-20261111`); both workflows also run on every `pull_request` touching their paths, so deleting those branches only makes a dead push filter inert and removes no coverage. No release note, open PR relation or live workflow behaviour depended on any of the 50, so none was retained merely for its name. (The two inert push filters could be cleaned in a later docs/workflow PR.)
- **Deleted: 50. Skipped: 0. Failed: 0.** Remote branches 265 to **215**. Recovery: `sasv-archive-20261120\merged-branches-batch3-recovery-20261120.csv` (full SHA, PR, `refs/pull/<n>/head`).
- **Protected, verified after:** 42/42 open-PR heads exist; #271 and #249 branches, `wip/composition-executor-packaging-proof-20261120`, `costing/approval-screen-preview`, `test/wp04-s0-cursor-runner` exist; `main` `be529de2`; tag `v6.2.0` `ebb59a49` still Latest with 4 assets; 437 PR head refs resolve; 24 workflow files unchanged.

## 32. BATCH 4 (PROPOSED, NOT DELETED)
Merged-PR remote branches left: 133, of which 124 are eligible (same 9 exceptions as before: #487-#489, #105, #99, #90, #57 and the review-pending #271 and #249). Batch 4 = the next 50 oldest eligible (merged 11 to 13 Nov 2026). Dependency screen (open PRs, workflows, release notes, docs/scripts keywords): no flags. Manifest with full SHAs: `sasv-archive-20261120\merged-branches-batch4-manifest-20261120.csv` (sha256 `49F7ADD5832293C4C600BB505A3C23A7A2126863AF794FD70F177201C33F1E59`). Remote count would go 215 to 165; 83 merged-PR branches would remain afterwards.
| Branch | PR | Merged | Tip |
|---|---|---|---|
| `governance/csr-rpc-live-migration-sync-20261111` | #278 | 2026-11-11 | `8603625119` |
| `governance/wp05-r17-authenticated-matrix-performance-20261111` | #281 | 2026-11-11 | `07cdf618c1` |
| `governance/wp05-r18-csr-planner-screen-20261111` | #283 | 2026-11-11 | `d83776c578` |
| `governance/wp05-w505-owner-accepted-with-limits-20261111` | #279 | 2026-11-11 | `889c71ffe9` |
| `governance/wp05-w506-scoped-identity-acceptance-20261111` | #280 | 2026-11-11 | `70e881199c` |
| `test/wp05-d2-isolated-synthetic-role-contract-20261111` | #302 | 2026-11-11 | `64f086d23a` |
| `claude/pec-phase-a-visual-acceptance` | #365 | 2026-11-12 | `45d69e9c47` |
| `claude/pec-r2-ui-ux` | #373 | 2026-11-12 | `a568f87358` |
| `claude/wp07-bulk-verification-closure-3cmvvk` | #368 | 2026-11-12 | `5ca2071d14` |
| `docs/costing-programme-wp05-closed-new-chat-handover-20261112` | #364 | 2026-11-12 | `fea5121ed1` |
| `docs/wp05-r26-post-306-ci-reconciliation-20261112` | #307 | 2026-11-12 | `b1ce793ed4` |
| `docs/wp05-r27-d2-owner-policy-decision-matrix-20261112` | #308 | 2026-11-12 | `1d5a465adf` |
| `docs/wp05-r28-owner-option-a-ppm-audit-20261112` | #310 | 2026-11-12 | `870cce2dbf` |
| `docs/wp05-r30-pg17-isolated-verification-20261112` | #312 | 2026-11-12 | `9ac68f84c7` |
| `docs/wp05-r31-ppm-audit-acl-independent-review-20261112` | #313 | 2026-11-12 | `8d2ed496e6` |
| `docs/wp05-r32-predeployment-execution-gate-20261112` | #314 | 2026-11-12 | `97444fc051` |
| `docs/wp05-r34-option-a-prod-applied-20261112` | #316 | 2026-11-12 | `a80c62f5a3` |
| `docs/wp05-r35-authenticated-acceptance-availability-20261112` | #318 | 2026-11-12 | `c92c7c6792` |
| `docs/wp05-r36-scheme-history-real-session-acceptance-20261112` | #321 | 2026-11-12 | `66d1bdbe33` |
| `docs/wp05-r37-owner-scheme-history-positive-20261112` | #322 | 2026-11-12 | `b5d5bff87b` |
| `docs/wp05-r38-remaining-five-reader-policy-review-20261112` | #324 | 2026-11-12 | `a20500ff35` |
| `docs/wp05-r39-mcm-policy-approved-20261112` | #326 | 2026-11-12 | `d9adc278f3` |
| `docs/wp05-r40-mcm-production-apply-20261112` | #328 | 2026-11-12 | `82986dc1e0` |
| `docs/wp05-r41-mcm-browser-readiness-and-ccc-policy-20261112` | #329 | 2026-11-12 | `bf1c511327` |
| `docs/wp05-r42-ccc-mcm-owner-policy-20261112` | #331 | 2026-11-12 | `f8d3933150` |
| `docs/wp05-r43-ccc-mcm-acceptance-production-20261112` | #333 | 2026-11-12 | `97dda4ccb2` |
| `docs/wp05-r44-csr-reader-policy-decision-20261112` | #334 | 2026-11-12 | `91bc5e56fe` |
| `docs/wp05-r45-csr-option-c-owner-policy-20261112` | #337 | 2026-11-12 | `ac9f9dd1b7` |
| `docs/wp05-r45-exact-head-10of10-20261112` | #339 | 2026-11-12 | `57c0be5602` |
| `docs/wp05-r46-csr-option-c-production-20261112` | #340 | 2026-11-12 | `f0d1ae64f5` |
| `docs/wp05-r47-auth-acceptance-and-closure-path-20261112` | #341 | 2026-11-12 | `ae826d8a50` |
| `docs/wp05-r48-test-account-csr-only-stage-20261112` | #343 | 2026-11-12 | `73f49cdbc7` |
| `docs/wp05-r49-csr-pass-ccc-only-stage-20261112` | #344 | 2026-11-12 | `d7ccbcceb0` |
| `docs/wp05-r50-ccc-readiness-error-hold-20261112` | #345 | 2026-11-12 | `f6c62f7918` |
| `docs/wp05-r51-readiness-build-recovery-20261112` | #346 | 2026-11-12 | `1dbd1c731e` |
| `docs/wp05-r52-ccc-stage2-pass-mcm-stage3-20261112` | #348 | 2026-11-12 | `03df30dab1` |
| `docs/wp05-r53-mcm-acceptance-ppm-only-stage-20261112` | #349 | 2026-11-12 | `26cb1dd3d3` |
| `docs/wp05-r54-ppm-stage4-scheme-master-empty-20261112` | #350 | 2026-11-12 | `22ed989a1a` |
| `docs/wp05-r55-scheme-register-owner-decision-20261112` | #352 | 2026-11-12 | `f7cc6a8b09` |
| `docs/wp05-r56-ppm-register-production-approval-gate-20261112` | #354 | 2026-11-12 | `92b4a9f2d4` |
| `docs/wp05-r57-ppm-scheme-register-production-20261112` | #357 | 2026-11-12 | `adfd30c500` |
| `docs/wp05-r58-ppm-recovery-baseline-restoration-20261112` | #358 | 2026-11-12 | `4f0755e157` |
| `docs/wp05-r59-post-r58-gate-evidence-reconciliation-20261112` | #359 | 2026-11-12 | `d157ad7e16` |
| `docs/wp05-r60-scoped-auth-negative-provenance-20261112` | #360 | 2026-11-12 | `0ab5b1d742` |
| `docs/wp05-r61-fast-close-no-duplicate-cost-comparison-20261112` | #361 | 2026-11-12 | `6381aa598e` |
| `docs/wp05-r62-owner-bounded-residuals-final-gate-packet-20261112` | #362 | 2026-11-12 | `bb2583fc94` |
| `docs/wp05-r63-owner-w510-conditional-close-20261112` | #363 | 2026-11-12 | `a70cb9de92` |
| `fix/lab-tolerance-scrutiny-validation-20261112` | #309 | 2026-11-12 | `c7e80e830f` |
| `fix/wp05-scheme-audit-actor-contract-20261112` | #306 | 2026-11-12 | `f008aacc45` |
| `claude/friendly-einstein-4z45px` | #387 | 2026-11-13 | `652cac86ec` |
