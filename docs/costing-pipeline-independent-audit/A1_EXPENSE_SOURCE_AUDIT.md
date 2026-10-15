# A1 — Expense source / pool forensics (sweep 1)
Retrieved 2026-10-15 ~17:00 IST, SELECT-only. Queries: `queries/A1_01_*`, `queries/A1_02_*`.

## A1.1 How the monthly expense provision is computed (VERIFIED_LIVE — `costing.v_expense_head_monthly_provision`)
1. Source: `public.tally_expenses_snapshot` (4,426 rows, 127 snapshot dates 2025-08-28 → 2026-10-15; loaded from `raw/<date>/direct_expenses.xml`; no DB writer function, trigger or cron — the ETL lives outside this repo and outside the DB → UNVERIFIED code).
2. Joined to active `costing.expense_head_costing_map` (48 maps; 45 heads in 6 pools for 2026-09).
3. Value = `abs(net_cb_value)` (**sign discarded**).
4. Only snapshots dated the **calendar month-end** and `< period_start` are used; each is treated as **FY-to-date cumulative** and divided by elapsed FY months (12 for 31-Mar).
5. Within each FY the **highest** monthly-equivalent is kept; across FYs the **highest** again → `standard_monthly_provision` ("max of max").
6. Live view output for 2026-09 equals run 119 `cost_pool_monthly_snapshot` for all six pools (reproducible).

## A1.2 Verified findings
| ID | Sev | Finding (observed) | Numbers | Label |
|---|---|---|---|---|
| A1-F1 | **P1** | **Source basis changed from FY-to-date to month-to-date on 2026-08-08**, but the provision logic still assumes FY-to-date. Daily source totals: 08-07 ₹27,366,018 → 08-08 ₹272,321; thereafter resets on 09-04 (₹97,873) and 10-06 (₹89,183). Month-end snapshots 2026-08-31 (₹5.31M) and 2026-09-30 (₹5.41M) are single-month figures, so dividing by 5/6 FY months understates them ~5–6×. The upward "max" selection currently hides this, so it does not change run 119, but every later period inherits stale pre-August peaks and can never "see" current spend | `A1_01` daily series | VERIFIED_LIVE (cause of the change: UNVERIFIED — ETL code not available) |
| A1-F2 | **P1** | **"Max of max" provision is a systematic upward bias**, not a normal-budget estimate | All pools 2026-09: selected ₹6,544,467.41 vs FY2025-26 actual average ₹6,098,622.02 (+₹445,845.39/month, +7.3%). Production overhead: selected ₹974,980.28 vs FY25-26 avg ₹629,880.04 (+₹345,100.24, +54.8%) | VERIFIED_LIVE |
| A1-F3 | **P1** | **Fuel & Gas (DE)** drives the POH distortion: selected ₹479,589.60/month = Apr–Jun 2026 FYTD ₹1,438,768.80 ÷ 3. FYTD at 31-Jul is ₹1,451,480.65 → **July alone ₹12,711.85**. FY2025-26 average ₹161,969.07. No Aug/Sep rows exist for this head. A Q1 bulk/advance purchase or misposting is likely but UNVERIFIED (needs Tally ledger vouchers) | per-head series | VERIFIED_LIVE numbers; cause UNVERIFIED |
| A1-F4 | P1 | Repairs & Maintenances selected ₹69,457.91 (= FYTD Jul ₹277,831.65 ÷ 4) vs FY25-26 avg ₹41,978.20 (+65%) | series | VERIFIED_LIVE |
| A1-F5 | P2 | `abs()` turns credit balances into costs. Live example: Interest Paid 2026-08-31 net −₹2,618 (credit) would be +₹2,618; not selected for run 119 (the FY25-26 value ₹16,675,138.78 won). 153 negative source rows exist overall | `A1_02` neg_detail | VERIFIED_LIVE |
| A1-F6 | P2 | Snapshots are taken in the **morning of the date** (e.g. "2026-08-31" inserted 09:00 IST on 31-Aug), so a "month-end" snapshot may exclude that day's postings; the FY-close row 2026-03-31 was inserted on 2026-06-09 (backfilled) | `A1_01` by_date | VERIFIED_LIVE |
| A1-F7 | P2 | Finance pool contains **Interest Paid** (₹1,389,594.90/month of ₹1,519,520.35) loaded into SKU cost; whether finance cost belongs in cost of production/internal loaded cost is a Finance policy question (cost-accounting standards usually exclude it from production cost) | `A1_02` | VERIFIED_LIVE amount; treatment = DECISION D-011 |
| A1-F8 | P2 | QC pool selected from prior FY (₹51,291.67); Materials/Stores pool selected ₹77,704.33 vs FY avg ₹55,751.03 (+39%) | `A1_02` | VERIFIED_LIVE |

## A1.3 Production overhead heads — selected vs alternatives (₹/month, period 2026-09)
| Head | Selected (run 119) | Selected FY | FY2025-26 avg | FY26-27 Apr–Jul avg (FYTD 31-Jul ÷ 4) |
|---|---|---|---|---|
| Fuel & Gas | 479,589.60 | 2026-27 (Jun) | 161,969.07 | 362,870.16 |
| Mess | 177,224.92 | 2025-26 | 177,224.92 | 133,949.97 |
| Electricity & Water | 149,304.75 | 2025-26 | 149,304.75 | 112,935.00 |
| Repairs & Maintenance | 69,457.91 | 2026-27 (Jul) | 41,978.20 | 69,457.91 |
| Cleaning | 35,511.10 | 2025-26 | 35,511.10 | 32,259.21 |
| Factory | 29,983.51 | 2025-26 | 29,983.51 | 27,139.55 |
| Job Work | 25,562.25 | 2025-26 | 25,562.25 | 8,383.75 |
| Printing & Stationery | 8,346.24 | 2025-26 | 8,346.24 | 2,896.50 |
| **Total** | **974,980.28** | | **629,880.04** | **749,892.05** |
Plus POH staff ₹41,055 → run-119 POH pool ₹1,016,035.28. (ANALYTICAL alternatives only; none is an approved budget.)

## A1.4 Not yet done (next sweep)
Ledger-level voucher reconciliation (needs Tally access/exports); duplicate-load/idempotency tests per source_key; full per-head table for the other five pools; ETL code location (outside repo).
