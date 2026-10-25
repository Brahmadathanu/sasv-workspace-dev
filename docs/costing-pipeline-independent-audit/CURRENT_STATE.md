# Costing suite: current state (single entry point)

**Verified read-only on 24 Oct 2026, 23:40 IST** (Supabase project qhmoqtxpeasamtlxaoak, SELECT only). This page supersedes every earlier "current status" banner in this folder. Older handovers and checkpoints are dated history.

## Live facts
| Item | Live state |
|---|---|
| October 2026 period | OPEN; valuation date 22 Oct 2026, DRAFT |
| October approved run | **Run 143**, approved 24 Oct 2026 13:46 IST (approved_by `CHAT_AUTHORISED_BACKEND_ADMIN`); run finished 12:50 IST. Screen label: "Approved run 143". No newer draft run or active run |
| How 143 replaced 140 | Owner refresh authorisation **#10** (Dr. Brahmadathan U, 24 Oct 12:45 IST), used by run 143. Reason: the Mathalam (F) manual rate (ID 18, ₹240/kg) was closed on 24 Oct, so the current purchase rate of ₹118/kg (dated 4 Aug 2026) applies. Run 140 (authorisation #9, 22 Oct) is history only |
| Approved price data source | `costing.v_price_revision_current_approved_master`: 627 rows, 79 columns (64 original + 15 CI-037 profit columns 65–79, empty until the first CI-037-eligible run). See [contracts/PRICE_REVISION_FEED_CONTRACT_v2.md](contracts/PRICE_REVISION_FEED_CONTRACT_v2.md) |
| Run 143 quality | 627/627 SKUs READY (0 REVIEW_REQUIRED, 0 BLOCKED); 6 SKUs have negative margin before scheme in both IK and OK; no null margins (read-only, 24 Oct 2026 16:00 IST) |
| Price-revision Sheets | Show run 143 (confirmed by owner, 24 Oct 2026) |
| CI-033 security fix | Applied 24 Oct 16:47 IST (migration 20261024111733): logged-in users can no longer read `costing.v_cost_pool_monthly_combined` directly; the cost-pool summary screen is unchanged (53 rows, same checksum). Manual screen check with and without costing permission is still pending (owner). See `closure/CI-033_LIVE_APPLY_2026-10-24.md` (record merged via PR #83) |
| CI-016 migration records | 492 live migrations backfilled (PRs #81 and #82 merged). Live 638 reconciled; 59 e-Aushadhi/WP07/regulatory versions remain with Jarvis. See `closure/CI-016_BACKFILL_2026-10-24.md` |
| Demand method (G3) | DVS-1 not active (DRAFT, effective 1 Nov 2026, not approved). Run 143 used the 60% seasonal rule / max-month method |
| Open costing items (24 Oct) | Data: CI-011 (74 machines without capacity), CI-029 (605 SKUs with at least one stale/fallback/manual rate line), CI-030 (11 high-loss products). CI-028 closed (owner). CI-031 rename prepared, pending apply. Decision: CI-037 (before-scheme margin is measured on GST-inclusive MRP; profit chain APPLIED 24 Oct (migration 20261024171314), verified; first data waits for an authorised run (October supersession authorisation or November)). Pricing: CI-036 (6 negative-margin SKUs). Closed: CI-035 (run 131 ₹85.89, historical) |
| Old feed | `public.v_costing_pricing_price_revision_feed_approved` is gone (retired 22 Oct; see `docs/price-revision-proposal/STEP131_*`) |
| Cron | Active: 66 `costing_weekly_draft_0200_IST` (Mon 02:00 IST), 67 `costing_monthend_draft_0200_IST` (cron `30 20 28-31 * *` UTC = 02:00 IST on the 29th–1st; the function only acts when the IST date is the 1st, drafting the previous month with the last day as cut-off; other days return NOT_SCHEDULED), 68 `costing_stage_processor_5min_governed`. Jobs 60 and 61 no longer exist |

## Active workflows
| Workflow | Status | Doc |
|---|---|---|
| Price revision proposal (workbook-only model, ChatGPT owns Sheets) | In progress; latest is STEP165 (24 Oct) | `docs/price-revision-proposal/PROGRAMME_AND_HANDOVER_2026-10-21.md`, then STEP files |
| Run-governance (supersession) screen | Plan stage. Needs a new brief because the supersession to 143 is already done; merge STEP166 plan with parked period panel branch `costing/w2-period-runs-panel` (d5f92af) as CW-02 | `docs/price-revision-proposal/STEP166_COSTING_SUPERSESSION_CLIENT_PLAN_20261024.md` |
| Closure programme G0–G6 and issue register | G0 done, G1 verified, G2 closed (bounded release, 21 Oct), G6 closed (21 Oct; current approved run 143). G3/G4 partly live; G5 not verified. See issue register for the 24 Oct check | `closure/PROGRAMME.md`, `closure/ISSUE_REGISTER.md` |
| Weekly/month-end automation | Live and active | `closure/WEEKLY_COSTING_LIVE_CRON_ACTIVATION_2026-10-21.md` |

## Pull requests (as of 25 Oct 2026, 23:30 IST)
| PR | State | Topic |
|---|---|---|
| #59 | open (Jarvis, e-Aushadhi) | WP-07 C1 governed QC protocol. Only open PR |
| #77 | merged 24 Oct 23:43 IST | Absorbent Cotton Wool IP inventory and Tally aliases |
| #78 | merged 24 Oct 23:43 IST | Tooth Powder BOM: renamed 25 G PP jar and Tally mapping |
| #86 | merged 24 Oct 23:42 IST | CI-037 Google Sheets reconciliation (read-only, run 143) |
| #88 | merged 25 Oct 19:37 IST | Pricing Policy Manager: block duplicate or backdated MRP policy |
| #89 | merged 25 Oct 20:38 IST | Lab repeat-analysis governance screen |
| #90 | merged 25 Oct 22:27 IST | W1: governed run label on pricing screens (replaces #73); service worker `hub-cache-v374` |
| #72 | closed 25 Oct 22:02 IST | AU-4 normal budget docs carrier (docs already on main via PR #80) |
| #73 | closed 25 Oct 22:28 IST | Old W1 client; rebuilt on main as #90 |
| #83, #84, #85 | merged 24 Oct | CI-033 record; repo cleanup; CI-037 profit chain |
| #60, #61, #66, #70 | closed 24 Oct | Obsolete or premise wrong; see `closure/REPO_CLEANUP_CANDIDATES_2026-10-24.md` |

## Open costing periods (verified read-only 25 Oct 2026)
| Period | Status | Run shown |
|---|---|---|
| Mar 2026, Jun 2026 | OPEN | No successful run |
| Jul 2026 | OPEN | Draft run 80 (not approved) |
| Aug 2026 | OPEN | Draft run 82 (not approved) |
| Sep 2026 | LOCKED | Approved run 122 |
| Oct 2026 | OPEN | Approved run 143 |

Locking needs an approved run (server rule in `rpc_costing_lock_period`), so Mar, Jun, Jul and Aug cannot be locked as they stand. Owner decision pending: see `audit-2026-10-25/`.

## Client audit (25 Oct 2026)
Client gaps and UI/UX backlog (CW-01 to CW-14): [audit-2026-10-25/C_client_ux_audit_and_backlog.md](audit-2026-10-25/C_client_ux_audit_and_backlog.md). Master-data-costing workflow status: `docs/master-data-costing/MDC_WORKFLOW_STATUS_AND_CLOSING_PLAN.md`.

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
