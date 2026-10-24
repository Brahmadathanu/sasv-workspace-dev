# Costing suite: current state (single entry point)

**Verified read-only on 24 Oct 2026, 15:50 IST** (Supabase project qhmoqtxpeasamtlxaoak, SELECT only). This page supersedes every earlier "current status" banner in this folder. Older handovers and checkpoints are dated history.

## Live facts
| Item | Live state |
|---|---|
| October 2026 period | OPEN; valuation date 22 Oct 2026, DRAFT |
| October approved run | **Run 143**, approved 24 Oct 2026 13:46 IST (approved_by `CHAT_AUTHORISED_BACKEND_ADMIN`); run finished 12:50 IST. Screen label: "Approved run 143". No newer draft run or active run |
| How 143 replaced 140 | Owner refresh authorisation **#10** (Dr. Brahmadathan U, 24 Oct 12:45 IST), used by run 143. Reason: the Mathalam (F) manual rate (ID 18, ₹240/kg) was closed on 24 Oct, so the current purchase rate of ₹118/kg (dated 4 Aug 2026) applies. Run 140 (authorisation #9, 22 Oct) is history only |
| Approved price data source | `costing.v_price_revision_current_approved_master`: 627 rows, 64 columns. See [contracts/PRICE_REVISION_FEED_CONTRACT_v2.md](contracts/PRICE_REVISION_FEED_CONTRACT_v2.md) |
| Run 143 quality | 627/627 SKUs READY (0 REVIEW_REQUIRED, 0 BLOCKED); 6 SKUs have negative margin before scheme in both IK and OK; no null margins (read-only, 24 Oct 2026 16:00 IST) |
| Price-revision Sheets | Show run 143 (confirmed by owner, 24 Oct 2026) |
| CI-033 security fix | Applied 24 Oct 16:47 IST (migration 20261024111733): logged-in users can no longer read `costing.v_cost_pool_monthly_combined` directly; the cost-pool summary screen is unchanged (53 rows, same checksum). Manual screen check with and without costing permission is still pending (owner). See `closure/CI-033_LIVE_APPLY_2026-10-24.md` (record merged via PR #83) |
| CI-016 migration records | 492 live migrations backfilled (PRs #81 and #82 merged). Live 638 reconciled; 59 e-Aushadhi/WP07/regulatory versions remain with Jarvis. See `closure/CI-016_BACKFILL_2026-10-24.md` |
| Demand method (G3) | DVS-1 not active (DRAFT, effective 1 Nov 2026, not approved). Run 143 used the 60% seasonal rule / max-month method |
| Open costing items (24 Oct) | Data: CI-011 (74 machines without capacity), CI-029 (605 SKUs with at least one stale/fallback/manual rate line), CI-030 (11 high-loss products). CI-028 closed (owner). CI-031 rename prepared, pending apply. Decision: CI-037 (before-scheme margin is measured on GST-inclusive MRP; profit fix prepared, pending approval — policy agreed: contingency on post-discount selling price). Pricing: CI-036 (6 negative-margin SKUs). Closed: CI-035 (run 131 ₹85.89, historical) |
| Old feed | `public.v_costing_pricing_price_revision_feed_approved` is gone (retired 22 Oct; see `docs/price-revision-proposal/STEP131_*`) |
| Cron | Active: 66 `costing_weekly_draft_0200_IST` (Mon 02:00 IST), 67 `costing_monthend_draft_0200_IST` (1st of month, 02:00 IST), 68 `costing_stage_processor_5min_governed`. Jobs 60 and 61 no longer exist |

## Active workflows
| Workflow | Status | Doc |
|---|---|---|
| Price revision proposal (workbook-only model, ChatGPT owns Sheets) | In progress; latest is STEP165 (24 Oct) | `docs/price-revision-proposal/PROGRAMME_AND_HANDOVER_2026-10-21.md`, then STEP files |
| Run-governance (supersession) screen | Plan stage. Needs a new brief because the supersession to 143 is already done | `docs/price-revision-proposal/STEP166_COSTING_SUPERSESSION_CLIENT_PLAN_20261024.md` |
| Closure programme G0–G6 and issue register | G0 done, G1 verified, G2 closed (bounded release, 21 Oct), G6 closed (21 Oct; current approved run 143). G3/G4 partly live; G5 not verified. See issue register for the 24 Oct check | `closure/PROGRAMME.md`, `closure/ISSUE_REGISTER.md` |
| Weekly/month-end automation | Live and active | `closure/WEEKLY_COSTING_LIVE_CRON_ACTIVATION_2026-10-21.md` |

## Open PRs (as of 24 Oct 2026)
| PR | State | Topic |
|---|---|---|
| #78 | open | Tooth Powder BOM: renamed 25 G PP jar and Tally mapping |
| #77 | open | Absorbent Cotton Wool IP inventory and Tally aliases |
| #73 | draft, do not merge | W1 client: approved/draft run labels and cost comparison |
| #72 | draft | AU-4 normal budget and docs carrier |
| #83 | merged 24 Oct | CI-033 prepared SQL and live-apply record (docs only) |
| #84 | open | Repo cleanup: archive superseded docs, remove `.temp/` and 2 never-applied migrations |
| #60, #61, #66, #70 | closed 24 Oct | Closed as obsolete or premise wrong; see `closure/REPO_CLEANUP_CANDIDATES_2026-10-24.md` |

## Doc map
- Policy: `POLICY_REGISTER.md`, `COST_HEAD_POLICY_LEDGER.md`, `DECISIONS_AND_OPEN_QUESTIONS.md`, `closure/IMPLEMENTATION_RULES.md`
- Programme and issues: `closure/PROGRAMME.md`, `closure/ISSUE_REGISTER.md`
- Price data contract: `contracts/PRICE_REVISION_FEED_CONTRACT_v2.md` (v1 in `archive/`)
- Automation: `closure/WEEKLY_COSTING_LIVE_CRON_ACTIVATION_2026-10-21.md`
- Price revision: `docs/price-revision-proposal/`
- History: `archive/` (superseded handovers, checkpoints, mandate, contract v1), `handover/`, `CHANGELOG.md`, dated `closure/*_2026-10-*.md` checkpoints

## Other workstreams (merged to main)
| Item | Live check (read-only, 24 Oct 2026 16:00 IST) | Docs |
|---|---|---|
| BMR lifecycle (PR #74, merged 20 Oct) | `bmr_details.lifecycle_status` live: 2,115 ACTIVE / 3 SUPERSEDED; 3 triggers; all six BMR migration versions recorded live | `docs/bmr-lifecycle-*.md` on main (the "unmerged" statements there are stale) |
| Supply Overrides precision (PR #76, merged 22 Oct) | Migrations 20261022134723 and 20261022134833 recorded live | None besides the PR |
| Fill Planner urgent SKU labels (PR #75, merged 22 Oct) | Client-only change (`public/shared/js/fill-planner.js`); deployment not checked | None |

## Branch note
`costing/au4-normal-budget` (PR #72) is far ahead of `main`; its docs were brought to main via PR #80, and its pruned helper scripts/logs remain there.
