# Costing suite: current state (single entry point)

**Verified read-only on 24 Oct 2026, 15:50 IST** (Supabase project qhmoqtxpeasamtlxaoak, SELECT only). This page supersedes every earlier "current status" banner in this folder. Older handovers and checkpoints are dated history.

## Live facts
| Item | Live state |
|---|---|
| October 2026 period | OPEN; valuation date 22 Oct 2026, DRAFT |
| October approved run | **Run 143**, approved 24 Oct 2026 13:46 IST (approved_by `CHAT_AUTHORISED_BACKEND_ADMIN`); run finished 12:50 IST. Screen label: "Approved run 143". No newer draft run or active run |
| How 143 replaced 140 | Owner refresh authorisation **#10** (Dr. Brahmadathan U, 24 Oct 12:45 IST), used by run 143. Reason: the Mathalam (F) manual rate (ID 18, ₹240/kg) was closed on 24 Oct, so the current purchase rate of ₹118/kg (dated 4 Aug 2026) applies. Run 140 (authorisation #9, 22 Oct) is history only |
| Approved price data source | `costing.v_price_revision_current_approved_master`: 627 rows, 65 columns. See [contracts/PRICE_REVISION_FEED_CONTRACT_v2.md](contracts/PRICE_REVISION_FEED_CONTRACT_v2.md) |
| Run 143 quality | 627/627 SKUs READY (0 REVIEW_REQUIRED, 0 BLOCKED); 6 SKUs have negative margin before scheme in both IK and OK; no null margins (read-only, 24 Oct 2026 16:00 IST) |
| Price-revision Sheets | Show run 143 (confirmed by owner, 24 Oct 2026) |
| CI-016 migration records | 61 costing migrations from 16–24 Oct backfilled from live (branch `ci-016-migration-backfill`, not merged). 487 older live versions and 20 repo-only files still unmatched. See `closure/CI-016_BACKFILL_2026-10-24.md` |
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
| #72 | draft | AU-4 normal budget and docs carrier (this branch's base) |
| #70 | draft, 16 Oct | AU-2c master-data proposals for SKU 859/1277/879 plus AU-4 prep pack. **Likely obsolete**: superseded by later runs (up to 143, all 627 READY) and by AU-4 work on #72. Owner to confirm before closing |
| #66 | draft, 15 Oct | MC06 overhead readiness gate (read-only). **Likely obsolete**: G6 seven-pool overhead conservation (21 Oct) covers it |
| #61 | draft, 13 Oct | WP05 C1 dead dashboard view mapping. **Unclear**: small client cleanup that may still apply; check against main before closing |
| #60 | draft, 13 Oct | WP05 G1/G2 docs. **Obsolete**: replaced by the closure G1/G2 docs on #72 |

## Doc map
- Policy: `POLICY_REGISTER.md`, `COST_HEAD_POLICY_LEDGER.md`, `DECISIONS_AND_OPEN_QUESTIONS.md`, `closure/IMPLEMENTATION_RULES.md`
- Programme and issues: `closure/PROGRAMME.md`, `closure/ISSUE_REGISTER.md`
- Price data contract: `contracts/PRICE_REVISION_FEED_CONTRACT_v2.md` (v1 is history)
- Automation: `closure/WEEKLY_COSTING_LIVE_CRON_ACTIVATION_2026-10-21.md`
- Price revision: `docs/price-revision-proposal/`
- History: `handover/`, `CHANGELOG.md`, dated `closure/*_2026-10-*.md` checkpoints

## Other workstreams (merged to main)
| Item | Live check (read-only, 24 Oct 2026 16:00 IST) | Docs |
|---|---|---|
| BMR lifecycle (PR #74, merged 20 Oct) | `bmr_details.lifecycle_status` live: 2,115 ACTIVE / 3 SUPERSEDED; 3 triggers; all six BMR migration versions recorded live | `docs/bmr-lifecycle-*.md` on main (the "unmerged" statements there are stale) |
| Supply Overrides precision (PR #76, merged 22 Oct) | Migrations 20261022134723 and 20261022134833 recorded live | None besides the PR |
| Fill Planner urgent SKU labels (PR #75, merged 22 Oct) | Client-only change (`public/shared/js/fill-planner.js`); deployment not checked | None |

## Branch note
`costing/au4-normal-budget` (and this cleanup branch) are about 647 commits ahead of `main` and 56 behind it. Rebasing onto main would pull in unrelated AU-4 history, so it was not done.
