# ChatGPT handover, part 3 (short), 19 Oct 2026, 20:20 IST

**Repo:** `Brahmadathanu/sasv-workspace-dev`, branch `costing/au4-normal-budget` (PR #72, draft).
**Full version:** `docs/costing-pipeline-independent-audit/handover/CHATGPT_HANDOVER_2026-10-19_PART3.md`. It covers everything since part 2 (8ec5bee), mainly the closure mandate (28f1d4d).

**Standing rules:**
- Sheets and price revision are **SUSPENDED until G6**.
- Run 128 is the October reference, not a finance-approved price basis.
- No merge, deploy, cron change, live run or approval without explicit user approval.
- Jarvis's WP07 files are untouched.

## Done since part 2
1. **Reorientation (18 Oct).** I verified 8ec5bee on the remote and wrote the consolidation plan (W1–W5). It found no lock/reopen RPC, a run-mixing comparison lens, and false drift on run 122 blocking the September close.
2. **W1, W5 and re-baseline: LIVE 19 Oct 07:15.**
   - Approved-only price revision feed `public.v_costing_pricing_price_revision_feed_approved`: Sep run 122 = 634 rows (74/70 negative), Oct run 128 = 627 (9/9).
   - Run labels and a governed comparison view.
   - Fingerprint on a recorded column list; runs 122/128 re-baselined to 0 drift.
   - Live definitions match the prepared SQL 17/17.
3. **Feed contract v1 and PR #73.**
   - `contracts/PRICE_REVISION_FEED_CONTRACT_v1.md`. Margins = MRP − (ILC + regional marketing).
   - Client PR #73 (draft, do not merge) adds run labels and the governed comparison.
4. **W2 governed period lifecycle: LIVE 19 Oct 11:06.**
   - 9 audited RPCs (open, pre-checks, approve, lock, reopen, authorise and supersede, close, context), with owner-only critical actions and hardening H1–H6. Tested 53/53 locally.
   - The client panel branch `costing/w2-period-runs-panel` exists, but no PR has been opened.
5. **G0 baseline.**
   - Issue register (34 issues).
   - Discrepancies: prime ≠ material + DL is 9 SKUs, explained by internal material conversion. Ledger counts were corrected. Machine 41 is 10 kg. 582 live vs 96 repo migrations. The 60% rule is authoritative, not a flag.
6. **G1 VERIFIED, read-only.**
   - Waterfall identities and head → pool → SKU conservation are exact.
   - Tally rate → line → SKU, BOM/UOM/yield and route → labour have 0 mismatches.
   - New issues: masters not effective-dated (CI-028), 12.8% stale/manual material value (CI-029), labour driver concentration (CI-032, HIGH).
7. **TB1–TB7: LIVE 19 Oct 19:04–19:26.**
   - **Salary exposure fix:** 49 costing views, including per-employee salary and cost sheets, were readable by all 25 accounts. They are now gated: an unpermitted user gets 0 rows, and permitted users see identical results.
   - Tally snapshots are writable only by service_role or the ETL admin.
   - Also: function search_path, an atomic IMC column, fingerprint version, capacity value origin.
   - No data changed and runs 122/128 have 0 drift.
   - **Caveat:** the Tally sync agent's role is unconfirmed, so watch the next sync. If it fails, grant the ETL-admin role; do not loosen TB1.
   - TB4 (dashboard check) is still the user's.
8. **Policies P33–P38, accepted 19 Oct 19:02.**
   - P33 data access (live).
   - P34: keep Central Office ₹8.72L plus the ₹5L HO provision pending evidence.
   - P35: 22 non-marketing heads approved, review 31 Mar 2027; marketing heads one by one.
   - P36: landed cost stays in the Materials-Stores pool until G5, labelled.
   - P37: the 60% rule is operative until DVS-1 activation.
   - P38: in-month dates going forward only; no backdating or proration.
9. **LB1 and DVS-1 (OFF): LIVE 19 Oct after 19:48.**
   - LB1: 22 ledger labels moved to APPROVED from 20 Oct with a ₹0 effect, proved by rebuilding the old ledger hash.
   - DVS-1: 5 tables, a selection function and the patched refresh RPC. The policy is DRAFT, so DVS-1 is **OFF**.
   - Only the 2 intended functions changed.
   - A rolled-back live replay of a temporary August run is identical before and after. A direct run-128 replay is refused by the approved-run guard, and I did not bypass it.
   - A read-only preview on October data shows 14 SKUs on the launch average and 555 on the peak month (87 flagged).
10. **Prepared and tested locally, NOT applied.**
    - **CI-012 tiered no-backdating guard:** 8 forward-only tables (capacity, ledger, DVS-1); all other masters audit-only, because backdating is routine there.
    - **CI-034 fix:** the stored basis-status label is now tied to the valuation date instead of today's date. Simulating another run day gave 81 label changes before the fix and 0 after; the forecasting view is untouched.
11. **User requests issued, not yet answered.**
    - The 15-machine capacity table (`closure/evidence/CAP/CAPACITY_P1_15_MACHINES.md`). The biggest are the oil press 126 (137 products), the juice press 130 (95) and Firewood Dryer 119 (63).
    - The 86-SKU DVS-1 worksheet (`closure/evidence/DVS1/DVS1_REVIEW_WORKSHEET_86.csv`) with proposed defaults, which are **not accepted**:

      | Reason | SKUs | Proposed default |
      |---|---|---|
      | Bulk single-day order | 36 | Exclude as event |
      | Stock-outs | 20 | Use in-stock average |
      | Unexplained | 11 | Accept peak |
      | Recurring pattern | 9 | Approve seasonal |
      | Master seasonal | 8 | Approve seasonal |
      | Launch | 2 | Accept peak |

## State
- **Approved policy:** P33–P38, plus the earlier P1–P32.
- **Live:**
  - Sep and Oct LOCKED; runs 122 and 128 APPROVED with 0 drift.
  - Feed 1,261 rows; cron 60/61 paused.
  - SALES-01 ON; G4 switch OFF; DVS-1 OFF.
  - Installed: W1/W5, W2, TB1–TB7 (except TB4), LB1.
- **Prepared, not applied:** CI-012 guard, CI-034 fix, DVS-1 activation, PR #73, the W2 panel branch.

## What remains
**Gates:**

| Gate | Status |
|---|---|
| G0 | done |
| G1 | verified |
| G2 | machine values and CI-032 open; G4 switch OFF |
| G3 | DVS-1 live OFF; 86-SKU review pending; CI-029 |
| G4 | W2 live; CI-012 prepared; job 61 restore pending; CI-028 |
| G5 | not started |
| G6 | TB4 open; CI-016, CI-024, CI-033 |

**Release: NOT READY.**

**Open issues:**
- **HIGH:** CI-011 (74 machines, 15 priority), CI-032.
- **MEDIUM:** CI-012, CI-014, CI-015, CI-016, CI-019 (TB4), CI-023 (cron), CI-024 (9 negative-margin and 37 review SKUs), CI-028, CI-029, plus CI-003/006 decided but not built.
- **LOW:** CI-030, CI-031, CI-034.
- **INFO:** CI-021, CI-022, CI-033.

**Pending user approvals:**
1. TB4 dashboard check.
2. CI-012 guard.
3. CI-034 fix.
4. 86-SKU defaults.
5. DVS-1 activation from 1 Nov 2026 or later (after item 4).
6. G4 plant-aware loads switch-on (after the machine values and CI-032).
7. Job 61 restore, then job 60.
8. PR #73 (retarget to main) and the W2 panel PR.
9. The 15 machine values.

**Blocked:**
- November run (job 61 plus W2 open).
- G4 switch-on (machine values).
- DVS-1 activation (86-SKU review).
- G5 (until G2–G4).
- Sheets and price revision (until G6).
- CI-003 (Tally narration and HO note).

## ChatGPT should independently verify
1. The raw files exist on the branch, and the prepared SQL is outside `supabase/migrations`.
2. TB2 evidence: an unpermitted user gets 0 rows from the salary and cost-sheet views.
3. LB1 changed only the 22 labels, with the same amounts (`closure/evidence/LBD/`).
4. DVS-1 is OFF (policy DRAFT). Its patch adds only branches that are inactive while OFF, and the rolled-back replay method is sound.
5. The CI-012 tiers match `closure/evidence/CI012/backdate_history.json`.
6. CI-034 leaves forecasting untouched.
7. The 86-SKU defaults are consistent with the evidence tags.
8. The next Tally sync succeeds.
9. Runs 122 and 128 still verify with 0 drift.
