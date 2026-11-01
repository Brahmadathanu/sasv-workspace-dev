# Repo cleanup candidates — 24 Oct 2026 (PROPOSAL ONLY; nothing deleted)

e-Aushadhi/WP07 items are excluded. Evidence is from `git` on origin/main b255d70 and read-only live SELECTs. **Restorable** means the content stays in git history or in a merged PR, so it can be brought back from a SHA.

## A. Branches created in this cleanup
| Item | Why obsolete | Evidence | Delete risk | Restorable |
|---|---|---|---|---|
| `docs/cleanup-2026-10-24` | Its 4 docs commits were copied to main via PR #80 | The branch is based on au4 (648 ahead), but its CURRENT_STATE, contract v2 and banners are on main | Low | Yes (bc450c8) |
| `docs/bmr-status-2026-10-24` | Merged | Ancestor of main | None | Yes |
| `ci-033-prepared-fix` | **Not obsolete: needs a merge first** | Main lacks `prepared/CI-033_*.sql`, `CI-033_LIVE_APPLY_2026-10-24.md` and the CI-033 register/CURRENT_STATE updates (2 commits ahead, 496b40f, 8e3630f) | High if deleted now (only copy of the CI-033 live-apply record) | Yes by SHA, but merge first |
| `docs/costing-docs-to-main-2026-10-24` | Merged as PR #80 (remote branch already gone) | — | — | — |

## B. Other remote branches already merged into main (safe to delete)
| Branch | Last commit |
|---|---|
| feat/pec-pr-pdf-continuation-header | 2026-10-10 |
| costing/au1-migration-backfill, costing/au1-ppm-version-parity, costing/au2-run-governance, costing/au3-tally-period-interpretation | 2026-10-15 |
| fix/ppm-inactive-sku-mrp-governance, fix/ppm-inactive-sku-revise-modal, fix/ppm-sku-mrp-board-effective-dates | 2026-10-15 |
| feat/bmr-lifecycle-client | 2026-10-20 |
| fix/fill-planner-urgent-sku-clipboard-label, fix/supply-overrides-reason-precision | 2026-10-22 |

Risk: none, because every commit is already in main. Restorable: yes.

## C. Stale unmerged branches (judgement needed; not merged into main)
| Branch | Last commit | Ahead of main | Verdict |
|---|---|---|---|
| wip/lab-analysis-entry-local-uncommitted, wip/prm-local-uncommitted | 2026-09-07 | 1 each | WIP snapshots; owner to confirm they're not needed |
| hardening/costing-suite-s1-server | 2026-09-16 | 15 | Likely overtaken by TB1–TB7/G6; review before delete |
| docs/master-data-costing-wp02-start | 2026-09-29 | 3 | Likely stale docs |
| test/wp04-s0-cursor-runner, docs/wp04-g0-readiness-control-centre-audit | 10-04 / 10-05 | 33 / 208 | Likely stale; contain WP04 evidence; review |
| fix/ppm-same-date-already-approved-feedback | 2026-10-15 | 1 | Unmerged small fix; check if still needed |
| docs/costing-finance-oct15-continuation, docs/costing-pipeline-independent-audit | 10-15 / 10-16 | 40 / 43 | Superseded by the docs now on main (PR #80); review |
| costing/w2-period-runs-panel | 2026-10-19 | 65 | W2 client panel; no PR; check if superseded |
| feat/lab-repeat-analysis-governance-client | 2026-10-20 | 3 | Lab client; server migrations are live (19 Oct lab_*). **Possibly still needed** |
| costing/au4-normal-budget | 2026-10-24 | 644 | Source of PR #72; **keep** until #72 is decided (holds the helper scripts/logs pruned from main) |

Restorable: yes while the commits exist. Deleting an unmerged branch removes its only ref, so keep a tag or SHA first.

## D. Draft PRs
| PR | Verdict | Evidence | Delete/close risk |
|---|---|---|---|
| #60 WP05 G1/G2 docs (13 Oct) | **Obsolete** | Replaced by closure G1/G2 docs on main | Low |
| #61 WP05 C1 dead dashboard mapping (13 Oct) | **Not obsolete, premise wrong** | `public.v_costing_pricing_dashboard_summary` **still exists live** and main still maps `dashboard:` to it (costing-suite-shell.js:2411), so the mapping is not dead | Medium; closing loses nothing, but don't merge it as is |
| #66 MC06 overhead readiness gate (15 Oct) | **Obsolete** | Overtaken by G6 seven-pool conservation (21 Oct); 42 commits behind the current design | Low |
| #70 AU-2c master-data proposals (16 Oct) | **Likely obsolete** | Runs 136/140/143 all READY 627/627; SKU 859/1277/879 proposals not checked individually (**unverified**) | Low–medium |
| #73 W1 approved/draft run labels (19 Oct) | **Not obsolete** | Main has no run-status badge (`costing-run-status-badge.js` exists only on the PR); mergeable_state clean | Feature loss if closed. Review and merge instead |

## E. Never-applied repo migration files
| File | Evidence | References | Delete risk | Restorable |
|---|---|---|---|---|
| `supabase/migrations/20260108122451_remote_schema.sql` | Empty (0 bytes); no live version | Only CI-016 docs and G0 evidence JSON | Low. Note that the Supabase CLI treats files as pending migrations; an empty file is harmless but confusing | Yes |
| `supabase/migrations/20260525180000_proc_vendor_unmapped_queue_paged.sql` | `public.proc_vendor_unmapped_queue_paged` not live; no recorded version | No client/code references on main (docs only) | Low. A `db push` would try to apply it, which is another reason to remove it | Yes |

## F. Superseded docs (bannered; candidates for an `archive/` move or deletion after review)
`COSTING_END_TO_END_SERVER_CLOSURE_MANDATE_2026-10-19.md`, `closure/CHATGPT_TAKEOVER_CHECKPOINT_2026-10-19.md`, `closure/G6_RUN136_FORMAL_ACCEPTANCE_CHECKPOINT_2026-10-21.md`, `closure/LIVE_HANDOVER_2026-10-20_RUN131_MATERIAL_AND_SKU_AUDIT.md`, `contracts/PRICE_REVISION_FEED_CONTRACT_v1.md`, `handover/CHATGPT_HANDOVER_2026-10-18.md`, `…_PART2.md`, `…_PART2_SHORT.md`, `…_2026-10-19_PART3.md`, `…_2026-10-20_PART4_LEAN_ARCHITECTURE.md`; also `proposals/au6_combined/PREPARED_au6_combined_package.sql` (carries a SUPERSEDED header).
Risk: low, but INDEX/CHANGELOG link to several of these, so links must be fixed in the same change. Restorable: yes. Recommendation: move them to `docs/costing-pipeline-independent-audit/archive/` rather than delete.

## G. Temp/scratch files on main
`.temp/`: **39 files** (security-advisor scans sa2/sa4/sa9, verify scripts, PNG crops, patch helpers). Last touched 2026-08-12 or earlier. Excluded from lint in `package.json` (`!.temp/**`); no code imports them. Risk: low (scan outputs and one-off scripts). Restorable: yes. Recommend deleting the folder and adding `.temp/` to `.gitignore`.
