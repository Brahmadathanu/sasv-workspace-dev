> **STATUS RECONCILIATION — 2 Nov 2026:** The CW-13 responsive/mobile package (#127), CW-06 dialog package (#126) and CW-07 terminology package (#128) were merged on `main` (`3d0b6185`) after the 1 Nov inventory was written. They are **not open implementation packages**. CW-13 mobile browser acceptance and CW-07 client wording acceptance passed; CW-06 mock-browser evidence passed but the pre-existing Historical Candidate Review controls remain hidden and its family-create action lacks required `p_family_code`. The Hub Home label still comes from `public.app_modules`, pending separate governed approval. Final post-merge tests, live deployment confirmation and full navigation rationalisation remain open. Other owner decisions below retain their recorded status until independently rechecked.

# Master costing workflow: remaining work (1 Nov 2026)

Supersedes [REMAINING_WORK_2026-10-31.md](REMAINING_WORK_2026-10-31.md); read with [CURRENT_STATE_2026-11-01.md](CURRENT_STATE_2026-11-01.md). Items not listed below keep their 31 Oct status in the old file (sections A 6–14, B 19–32, D 40).

## Done since 31 Oct
| Old # | Item | Done by |
|---|---|---|
| B15, B17, B18 | CW-05 remainder, sort keys, button styling | PRs #108, #110, #112 (SKU/Pack and "Include in Costing" still unsortable) |
| C33 | Lock-screen reload message | PR #112 |
| C34 | Batch-mode lockout tests | PR #112 |
| C38 | Migration file line endings | PR #109 |
| D39 | PR #98 | Closed as superseded; PR #107 merged |
| — | Review worklist v1 | PR #111 (flag off) |

## Open — owner decisions
| # | Item | Waits for |
|---|---|---|
| 1 | October finalise choice (finalise run 148, keep 143, or wait) | Owner, after blocked/review SKUs are cleared client-side |
| 2 | Readiness rebuild (stale since CI-050) | October finalise, then owner approval |
| 3 | Read-only views: cause split of 110 prime-cost reviews; run-scoped draft view; `COST_REVIEW_WORKBENCH` link target | **After** October finalise (owner, 1 Nov). No migration now |
| 4 | "Include in Costing" sort on raw value | Owner yes/no |
| 5 | Column help wording | Owner supplies text |
| 6 | CI-049 apply (lock guard) | Owner approval; lock flag stays off until then |
| 7 | CI-048 schedule and alert channel | Owner decisions |
| 8 | June–August reconciliation | Owner approach |
| 9 | WP10 block or warn; PERF-P01 approach; WP05 acceptance | Owner |
| 10 | First approval-screen walkthrough, then flag plan for all eight flags | Owner |
| 11 | Migration-history housekeeping proposal | Owner approval |

## Open — engineering
| Item | Note |
|---|---|
| Older table-tools tests strip lists | Each new shell feature must extend them; refactor to per-feature checks (could ride in the next package) |
| Smokes need Node 21+ | One e-Aushadhi smoke; 3–4 known failures on Node 20 (production-route smokes) |
| Netlify deploy check | Owner glance |
| Jarvis `feat/wp07-ux1-worklist` (tip `c5821b1`, v376) | Unmerged; will rebase to v388+ after owner approval, pinging first |

No further client package is ready that does not depend on the October finalise.
