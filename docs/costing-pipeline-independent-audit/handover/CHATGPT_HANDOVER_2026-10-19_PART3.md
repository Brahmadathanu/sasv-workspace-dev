> **SUPERSEDED (24 Oct 2026) — see [../CURRENT_STATE.md](../CURRENT_STATE.md).** Dated history only; live-state statements below (approved runs 122/128/131/136/140, cron 60/61, the public price feed view) are out of date.

# ChatGPT handover, part 3 (19 Oct 2026, 20:20 IST)

**Scope:** everything since the part-2 handover (commit 8ec5bee), especially since the closure mandate (28f1d4d).
**Repository:** `Brahmadathanu/sasv-workspace-dev`, branch `costing/au4-normal-budget` (PR #72, draft, not merged).
**Raw base URL:** `https://raw.githubusercontent.com/Brahmadathanu/sasv-workspace-dev/costing/au4-normal-budget/docs/costing-pipeline-independent-audit/`.
**Live database:** Supabase project qhmoqtxpeasamtlxaoak (PG 17.4). All times are IST.

**Standing rules (unchanged):**
- Google Sheets and price revision are SUSPENDED until G6 acceptance.
- Run 128 is the October reference. It is not a finance-approved price basis.
- No merge, deploy, cron change, live run or approval/supersession without explicit user approval.
- Jarvis's WP07 files (eaushadhi/QC, `public/sw.js`) are untouched.
- Runs 122 and 128 must never drift.

---
## A. What was done (chronological)

### A1. Auditor reorientation and consolidation plan (18 Oct 22:40)
- ChatGPT (auditor) asked for a reorientation. We verified that 8ec5bee and both part-2 files are on the remote (raw 200).
- `proposals/consolidation/CLIENT_GOVERNED_WORKFLOW_PLAN.md` holds the read-only inventory of 14 workflow steps and the work packages:
  - **W1:** approved-only feed and labels
  - **W5:** fingerprint fix
  - **W2:** governed lifecycle
  - **W3:** cron 61 then 60
  - **W4:** explainability
- Findings at that time:
  - there was no lock or reopen RPC;
  - designation and close were service_role only;
  - no supersession authorisation existed;
  - the client Cost-comparison lens mixed runs;
  - the September close was blocked by false fingerprint drift on run 122.

### A2. W1, W5 and re-baseline: LIVE (19 Oct 07:15–07:17, USER-APPROVAL-20261019-W1-W5-REBASELINE)
- Migrations 20261019014458 (W1), 014611 (W5) and 014728 (re-baseline of runs 122/128). They were tested locally 46/46 first.
- **W1:** approved-only price revision feed `public.v_costing_pricing_price_revision_feed_approved`, plus per-month run labels and a governed comparison view. The feed has Sep run 122 = 634 rows (74/70 negative) and Oct run 128 = 627 rows (9/9).
- **W5:** the fingerprint now uses a recorded column list. Runs 122 and 128 verify with 0 drift; the re-baseline journal has 2 rows.
- Migration parity: 17/17 live definitions match the prepared SQL (`evidence/W1_W5/MIGRATION_PARITY_2026-10-19.md`).

### A3. PR #73 and the feed contract (07:50)
- **Client PR #73** (draft, "DO NOT MERGE OR DEPLOY UNTIL REVIEWED"): `costing/w1-approved-run-labels` → `costing/au4-normal-budget`. It adds run label badges and the Cost comparison on the governed view (node tests 8/8). Retarget it to main before any deploy.
- **Feed contract v1:** `contracts/PRICE_REVISION_FEED_CONTRACT_v1.md`, written from the live definitions. It covers grain, the 30 columns, selection rules and control totals.
- **Key finding:** margins = MRP − (ILC + regional marketing). `pricing_cost_per_sku` (national marketing) is not the margin cost.

### A4. W2 governed period lifecycle: LIVE (19 Oct 11:06; approved 09:16)
- Migration 20261019053600 (md5 d978bb21), local tests 53/53.
- **9 governed RPCs:** open next month, pre-checks, approve, lock, reopen, authorise supersession, supersede, close, context.
- Approve, authorise, supersede and close are owner-only, and every action is audited.
- **Hardening H1–H6:**
  - truncate guard on the re-baseline table;
  - append-only audit;
  - REVOKED runs immutable;
  - one approved run per month;
  - closed month is final.
- Parity 26/26. Nothing was opened, locked or refreshed.
- **Client branch** `costing/w2-period-runs-panel` (d5f92af) adds a "Period & runs" panel (node tests 17/17, contract 10/10). **No PR has been opened yet.**

### A5. Closure mandate and G0 baseline (28f1d4d, then 68025eb)
The `closure/` directory holds PROGRAMME, IMPLEMENTATION_RULES, ISSUE_REGISTER (now 34 issues) and G0_BASELINE.

**G0 discrepancies against the mandate's stated baseline:**
- **"7/627 prime ≠ material + DL":** actually 9 SKUs differ, 7 of them at ₹0.01 or more. Prime = material + DL + internal material conversion (IMC), and with IMC all 627 reconcile (CI-002).
- **Ledger counts:** 38 PROVISIONAL / 5 APPROVED / 1 CURRENT_METHOD_RETAINED / 8 EXCLUDED, with 0 unresolved (not 40/5).
- **Machine 41:** currently 10 kg. The 2 kg figure is the superseded R1 row.
- **Open PRs:** #59 (Jarvis WP07) and #66 (MC06) are open as well.
- **Migrations:** 582 live vs 96 repo files (CI-016). 3 non-costing lab migrations were applied at 18:03–18:06 (CI-021).
- **60% rule:** it is authoritative in run 128, not just a review flag (CI-014).
- **Confirmed as stated:** 94 null capacities = 74 blocked + 20 not required. Sep is not CLOSED, Oct valuation date is 16 Oct, cron 60/61 is paused, and the G4 switch has no row.

### A6. G1 reconciliation and lineage: VERIFIED (read-only)
- **Downstream:** all waterfall identities hold (634/627 SKUs). Head → pool → SKU conservation is exact, including the IMC transfer (₹175.26 Oct).
- **Upstream:** for runs 122/128, all RM/PM lines, UOM conversions, yields, 999/994 Tally voucher rate picks, manual rates and labour allocations reconcile with 0 mismatches.
  - The run-128 builder replay is identical.
  - The run-122 replay differs for 8 products, because the BOM masters are not effective-dated (CI-028).
- **New issues:**
  - CI-028: masters are not effective-dated
  - CI-029: 12.8% of October material value rests on stale, fallback or manual rates
  - CI-030: process-loss plausibility
  - CI-031: batch-true rate label
  - CI-032: labour driver concentration (HIGH)

### A7. TB1–TB7: LIVE (19 Oct 19:04–19:26, USER-APPROVAL-20261019-TB1-TB7)
| TB | Change | Verified |
|---|---|---|
| TB1 | Tally snapshot tables: writes only by service_role or ETL admin (CI-001) | ordinary-user writes refused, reads intact |
| TB2 | **Salary exposure fix (CI-017):** 49 costing views, including the per-employee salary register and cost sheets, were readable by all 25 accounts. Now 62 gated views. | unpermitted user gets 0 rows in 61/61; the costing user sees identical results |
| TB3 | search_path set on 9 functions | outputs identical |
| TB4 | No SQL: the **user must confirm in the Supabase dashboard that `costing` is not an exposed schema** | outstanding |
| TB5 | Atomic IMC column / atomic ILC view (CI-002) | gap 0.000000 on 122/128 |
| TB6 | Fingerprint algorithm version (CI-009) | all runs verify identically |
| TB7 | Capacity value origin labels (CI-010) | counts as expected |

- No data row changed, runs 122/128 have 0 drift, and the feed, cron and periods are unchanged.
- **Tally sync caveat:** the sync agent must write as service_role or the ETL admin, and its role is unconfirmed. **Watch the next Tally sync.** If it fails, give it the ETL-admin role. Do not loosen TB1.

### A8. Policy decisions P33–P38 (accepted 19 Oct 19:02)
- **P33 data access:** costing rows go only to permitted users; Tally writes only by service/ETL. APPLIED LIVE.
- **P34 Central Office:** keep ₹8,71,972.83 plus the ₹5L HO provision until the Tally narration and HO note arrive (CI-003). Interim.
- **P35:** the 22 non-marketing provisional heads (₹5,14,421.93/month) are APPROVED as normals, with review due 31 Mar 2027. The 16 marketing heads will be reviewed one by one. APPLIED LIVE (LB1).
- **P36 landed cost:** stays in the Materials-Stores pool until the G5 builder, and is labelled in the export (CI-006). Not built.
- **P37 seasonal rule:** the 60% rule stays operative until DVS-1 is activated. DVS-1 is installed OFF.
- **P38 in-month dates:** going forward only, a run uses the values effective on its valuation date, and there is no backdating or proration. The guard is prepared.

### A9. LB1 and DVS-1 (OFF): LIVE (19 Oct after 19:48, USER-APPROVAL-20261019-LB1-DVS1-OFF)
- **LB1** (migration 20261019142418): 22 rows were closed on 19 Oct and 22 APPROVED copies start 20 Oct. The cost effect is ₹0 (provision by pool unchanged), and rebuilding the pre-LB1 ledger hash from current rows gives exactly the baseline value.
- **DVS-1** (migration 20261019142614):
  - **Added:** 5 tables (RLS on, no app grants) and `fn_dvs1_select`.
  - **Changed:** the refresh RPC is now the tested patch (md5 ea2b1cdd), and the method CHECK is widened.
  - **Switch OFF:** policy v1 is DRAFT from 1 Nov, with 0 approved versions. The Kanji seed starts 1 Nov.
  - **Function changes:** only these 2 changed (verified by reconstructing the hash). Views are unchanged.
  - **Live-path replay:** a temporary August run inside a block that always rolls back gave identical output before and after (627 rows, md5 93b43e46...).
  - **Run 128 not replayed directly:** the approved-run guard refuses a direct run-128 replay, and it was not bypassed.
  - **Read-only preview:** on live October data, 14 SKUs take the launch average and 555 the peak month (87 flagged).
- Report: `closure/LB1_DVS1_LIVE_APPLY_2026-10-19.md`. Build and test: `closure/DVS1_BUILD_AND_TEST.md`.
- **Local results:** OFF = 0 differences from the legacy replay. ON = all rules fire, PROPOSED events have no effect, an override wins, approved runs are protected.

### A10. Prepared and tested locally, NOT applied
- **CI-012 no-backdating guard** (`closure/prepared/PREPARED_CI012_no_backdating_guard.sql`). Live history shows routine backdating in most masters, so the guard is tiered:
  - **FORWARD_ONLY** (8 tables: capacity, cost-head ledger, DVS-1): refuses dates before today (IST) or on/before 16 Oct, the latest locked valuation date.
  - **AUDIT_ONLY** (other masters): allows the write but logs it. Promote to NOT_INTO_FROZEN after two weeks.
  - QC tables are excluded.
  - All local tests pass, and refresh output is identical.
  - **Consequence:** after install, any change to those 8 tables must be dated on or after the day it is applied.
- **CI-034 fix** (`closure/prepared/PREPARED_CI034_valuation_anchored_basis_status.sql`):
  - **Cause:** the `allocation_basis_status` label came from the CURRENT_DATE-anchored `v_sales_monthly_clean`.
  - **Fix:** the RPC computes the label from its own valuation-anchored totals. The forecasting view is untouched.
  - **Test:** simulating another run day changed 81 labels before the fix and 0 after. Same-day output equals run 128.
  - It is a guarded in-place edit that accepts either RPC version.

### A11. User requests prepared (answers NOT yet given)
- **15 priority machines** (`closure/evidence/CAP/CAPACITY_P1_15_MACHINES.md/.csv`): the machines named on governed routes that block plant-aware loads.
  - The largest are the oil press 126 (137 products), the juice press 130 (95) and Firewood Dryer 119 (63).
  - Values needed are kg per charge, litres per charge, or units per hour.
  - Tray dryers 141 and 149 need kg per tray × 24 trays.
  - Two pairs of dryers share a name.
- **86-SKU DVS-1 review worksheet** (`closure/evidence/DVS1/DVS1_REVIEW_WORKSHEET_86.csv`), with proposed defaults that are **NOT accepted**:

  | Reason | SKUs | Proposed default |
  |---|---|---|
  | Bulk single-day order | 36 | Exclude as event |
  | Stock-out months | 20 | Use in-stock average |
  | Unexplained | 11 | Accept peak |
  | Recurring pattern | 9 | Approve seasonal |
  | Master seasonal | 8 | Approve seasonal |
  | Launch | 2 | Accept peak |

  - The worst cost effect under the peak-month default is about −2.75% COP (SKU 1768).
- **Capacity exception register:** all 74 machines (`evidence/CAP/CAPACITY_EXCEPTION_REGISTER_74.csv`).

---
## B. State separated

### B1. Approved policy
- P33–P38, as in A8 above.
- Earlier policies P1–P32: see POLICY_REGISTER.

### B2. Live state (19 Oct 20:20)
- **Periods:** Sep and Oct LOCKED. Run 122 (Sep) and run 128 (Oct) are APPROVED, with fingerprint verify 0/50 and 0/51.
- **Legacy drift:** runs 119/121/124/125 each show 1 mismatching table (pre-existing).
- **Feed:** 1,261 rows, md5 aed9d8c1.
- **Cron:** 60 and 61 paused.
- **Switches:**
  - SALES-01 feed ON, so the 60% rule is operative.
  - G4 plant-aware loads: tables live, but the switch has no row (OFF).
  - DVS-1 installed, switched OFF.
- **Live today:** W1/W5, W2, TB1–TB7 (except TB4), LB1.

### B3. Prepared, not applied
- CI-012 guard
- CI-034 fix
- DVS-1 activation (a one-row policy update)
- Client branches: PR #73 (draft) and `costing/w2-period-runs-panel` (no PR)

### B4. Open
See section C.

---
## C. What remains

### C1. Gate status
| Gate | Status |
|---|---|
| G0 | DONE |
| G1 | VERIFIED (arithmetic and lineage). Data/driver items CI-028..032 carried forward. |
| G2 capacity/routing | Exception register and 15-machine request issued; CI-011 and CI-032 open; G4 switch OFF |
| G3 demand/drivers | Policies accepted; DVS-1 live OFF; 86-SKU review pending; CI-029 open |
| G4 period/run | W2 live; TB6 live; CI-012 guard prepared; job 61 restore pending (CI-023); CI-028 open |
| G5 export | NOT STARTED (P36 landed cost and the IMC export depend on it) |
| G6 acceptance | TB1–TB7 live except the TB4 dashboard check; CI-016, CI-024 and CI-033 open |

**Release: NOT READY.**

### C2. Open issues by severity
- **HIGH:**
  - CI-011: 74 machines without capacity (15 priority)
  - CI-032: manufacturing labour concentration (driver validation by Production)
- **MEDIUM:**
  - CI-012: guard prepared
  - CI-014: DVS-1 activation
  - CI-015: reconciliation inside DVS-1
  - CI-016: repo vs live migrations
  - CI-019: costing schema exposure, TB4
  - CI-023: cron 60/61
  - CI-024: 9 negative-margin and 37 REVIEW_REQUIRED SKUs in run 128
  - CI-028: masters not effective-dated
  - CI-029: 12.8% stale/manual material value
  - Decided but not built: CI-003 (interim), CI-006
- **LOW:**
  - CI-030: process loss
  - CI-031: batch-true rate label
  - CI-034: fix prepared
- **INFO:**
  - CI-021: lab migrations
  - CI-022: run 128 not a price basis
  - CI-033: one costing view partly visible; no exposure while costing is not API-exposed

### C3. Pending user approvals
1. **TB4:** dashboard check that `costing` is not an exposed schema.
2. **CI-012 guard:** apply.
3. **CI-034 fix:** apply.
4. **86-SKU defaults:** accept, or answer per SKU.
5. **DVS-1 activation:** from 1 Nov 2026 or later, only after item 4 and confirmation of events and stock-outs.
6. **G4 plant-aware loads switch-on:** needs the 15 machine values and CI-032 validation.
7. **Job 61 restore:** approved window for the stage worker, then job 60.
8. **PRs:** review and merge of PR #73 (retarget to main), plus opening and merging the W2 panel PR. Both need a deploy decision.
9. **Values for the 15 machines.**

### C4. Blocked
- **November costing run:** needs job 61 and November opened through W2. The 86-SKU review and machine values are needed only if DVS-1/G4 are wanted for November.
- **G4 switch-on:** blocked by the machine values and CI-032.
- **DVS-1 activation:** blocked by the 86-SKU review.
- **G5 export:** blocked until G2–G4.
- **Sheets and price revision:** SUSPENDED until G6.
- **CI-003:** waits on the Tally narration and HO note.

### C5. What ChatGPT should independently verify
1. **Raw files:** this handover, `closure/ISSUE_REGISTER.md`, `closure/PROGRAMME.md` and all prepared SQL files are on the branch, and none of them is in `supabase/migrations`.
2. **TB2 gate:** per the evidence, an unpermitted user gets 0 rows from the salary register and the cost sheet views.
3. **LB1:** the ledger changed only the 22 status labels, with the same amounts (`evidence/LBD/`).
4. **DVS-1:**
   - The policy is DRAFT, so DVS-1 is OFF.
   - The RPC patch only adds branches that are inactive while OFF (diff `closure/evidence/DVS1/scripts/gen_dvs1.py` against the live definition).
   - The rolled-back replay method is sound.
5. **CI-012 tiers:** check them against `evidence/CI012/backdate_history.json`.
6. **CI-034:** the fix leaves `v_fill_inputs` and the forecasting view untouched.
7. **86-SKU defaults:** check them against the evidence (bulk-day, stock-out and recurring tags come from the AU-9 classification).
8. **Tally:** the next sync after TB1 succeeds.
9. **Runs 122/128:** they still verify with 0 drift after every batch.
