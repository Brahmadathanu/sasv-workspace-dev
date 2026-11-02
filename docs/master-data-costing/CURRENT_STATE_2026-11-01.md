> **SUPERSEDED FOR REPOSITORY MERGE STATUS — 2 Nov 2026:** This remains the 1 Nov evidence snapshot, not the current code baseline. PRs #126, #127 and #128 subsequently merged in sequence; current GitHub `main` verified as `3d0b6185f4351469cf23969beefac0e8875e0c2e` with designated cache v390. Do not use the `7bccaba`/v387/next-v388 labels below as current. Final 393-suite check on new `main`, actual deployment and server run state are separate outstanding verifications. No change to database facts is asserted by this banner.

# Costing suite and master-data costing: current state (1 Nov 2026)

**This is the single "where are we now" page as of 1 Nov 2026 (IST).** It supersedes [CURRENT_STATE_2026-10-31.md](CURRENT_STATE_2026-10-31.md). Remaining work: [REMAINING_WORK_2026-11-01.md](REMAINING_WORK_2026-11-01.md). How client coding is now done: [CLAUDE_CLOUD_WORKFLOW.md](CLAUDE_CLOUD_WORKFLOW.md).

Sources: GitHub `main` at `7bccaba` (verified in a clean worktree: `public/sw.js` = `hub-cache-v387`, 232/232 costing unit tests on Node 20.19.2), and the costing decision log A1–A39 (kept outside the repo). Database facts in section 3–5 come from the decision log and read-only checks made on 31 Oct / 1 Nov; they were not re-checked for this page (marked *log*).

## 1. Code on main
- `main` = `7bccaba500dafc07ec878e79a76466b3cef43dd5` (PR #112). Cache `hub-cache-v387`. Next free cache number: **v388**.
- PRs #99–#106: see the 31 Oct page (unchanged). Merged since:

| PR | What it added | Merge commit | Cache | Flag |
|---|---|---|---|---|
| #107 | Docs: current state and remaining work of 31 Oct | `8143426` | v383 | — |
| #108 | CW-05 package 2: table tools on scheme comparison, control centre, SKU control status, driver governance; cost-sheet sort keys; sort-button styling | `e58dec0` | v384 | `COSTING_TABLE_TOOLS_V1` |
| #109 | Line endings of migration file `20261015045233` normalised (repo only; never re-applied) | `8bc872c` | v384 | — |
| #110 | CW-05 package 3: read-only tabs of pricing policy, cost build, material | `be20ea6` | v385 | `COSTING_TABLE_TOOLS_V1` |
| #111 | Review worklist v1 on SKU Control Status (groups blocked/review SKUs by server code, links to fix screens where mapped; read-only) | `2b3f298` | v386 | `COSTING_REVIEW_WORKLIST_V1` |
| #112 | CW-05 package 4 (MRP applied history, manual-provisions impact, scheme master) + lock-screen reload message + two batch-lockout tests | `7bccaba` | v387 | `COSTING_TABLE_TOOLS_V1` / `COSTING_LOCK_SCREEN_V1` |

None of these PRs changed the database.

## 2. Eight client flags, all off by default
The seven from 31 Oct (`COSTING_APPROVAL_SCREEN_V1`, `COSTING_RECALC_WITH_DATE_V1`, `COSTING_LOCK_SCREEN_V1`, `COSTING_RUN_STATUS_V1`, `COSTING_UX_CONSISTENCY_V1`, `COSTING_DIALOGS_V1`, `COSTING_TABLE_TOOLS_V1`) plus **`COSTING_REVIEW_WORKLIST_V1`**. Each turns on per browser only, for the exact value `1`. **The lock flag stays off for open months until CI-049 is live** or the owner decides otherwise in writing. No flag has yet been switched on in the owner's session.

Known behaviour: with the worklist flag on, October shows an empty list, because the client view holds only the run in use (143), not draft run 148.

## 3. Live in production (*log*)
CI-038, CI-038a, CI-039, CI-040 v2.1, CI-041 v2.1, CI-042 v2.2, CI-043 v2.2 rev B, CI-045, CI-046, CI-047, and **CI-050** (CSE-P01 option B, version `20261031123530`, applied 31 Oct 18:05 IST). Not live: CI-044 (parked), **CI-049** (drafted only), **CI-048** (not live, separately governed). Readiness snapshot is stale since CI-050; rebuild waits for the October decision.

## 4. Costing runs (*log*)
| Run | Meaning |
|---|---|
| 119 | REFERENCE |
| 122 | September APPROVED; September LOCKED |
| 143 | October APPROVED (22 Oct); used for pricing today |
| 147 | Failed manual draft of 30 Oct (harmless) |
| **148** | October month-end draft by job 67, 1 Nov 02:00 IST, dated 31 Oct. **"Not for pricing"** by design (CI-041 v2.1): it does not replace run 143 unless the owner finalises it. All six stages succeeded. 514 SKUs ready, 113 review, 1 blocked (from the 148 fixture: 110 prime-cost reviews, 2 material-rate reviews, 1 pricing-bridge review, 1 blocked material cost) |

Fingerprint of 119/122/143 unchanged on 1 Nov 03:10 IST check. July and August have no approved run.

## 5. Jobs (*log*)
Job 66 weekly draft (Mon 02:00 IST; next: Mon 2 Nov, November draft), job 67 month-end (ran 1 Nov), job 68 stage processor (every 5 min).

## 6. Owner decisions of 1 Nov
- Blocked/review SKUs of draft 148 are to be cleared client-side (through the existing fix screens), before any finalise.
- Read-only views (cause split of the 110 prime-cost reviews; run-scoped draft view) to be prepared **only after the October finalise**. No migration now. `COST_REVIEW_WORKBENCH` link target waits with them.
- All client-end coding now runs as bulk Claude Code cloud packages ([CLAUDE_CLOUD_WORKFLOW.md](CLAUDE_CLOUD_WORKFLOW.md)).
- Pending: "Include in Costing" sort; column help wording (owner to supply).

## 7. Rules that always apply
Server is the authority for business rules. No production write or migration without the owner's exact written approval (pre-check, post-check, rollback). Merges only on the owner's exact sentence; new screens ship off. Approved/historical runs never edited. Migration `20261015045233` is never re-applied. Never call the approval-preview RPC on production from tests or tools. e-Aushadhi (Jarvis) is told before any cache bump.
