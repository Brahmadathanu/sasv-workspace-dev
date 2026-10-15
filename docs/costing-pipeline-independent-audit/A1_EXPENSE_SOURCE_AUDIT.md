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

## Sweep 2 (2026-10-15 ~18:40 IST)

### D-013: tracing the 8 Aug FYTD→MTD switch (VERIFIED_LIVE unless marked)
- **The ETL request did not change.** Every `etl_jobs` FETCH_XML job for expenses asked for the FY period, before and after the switch: 07-Aug, 08-Aug, 03/04-Sep, 05/06-Oct all carry tokens `FROM=20260401, TO=<today>, COMPANY="SASV 2026-2027"`. Request template: `D:\tally-agent\config\requests\direct_expenses_request.xml` (and indirect), on the Tally agent PC. All were `validation_status=ACCEPTED`.
- **The returned data changed.**
  - On 07-Aug: 18 direct and 28 indirect rows, FYTD (Salaries DE ₹75,97,062).
  - On 08-Aug: 5 direct and 14 indirect rows. Heads with no August voucher vanish entirely (Salaries, Interest, Fuel & Gas, Rent, Electricity). The rest show August-only movement (Vehicle running ₹9,47,999 → ₹84,105).
  - So the change happened inside Tally or the agent's XML template, not in the job parameters. Possible causes: the request XML no longer passing SVFROMDATE, or the Tally company's current period. The exact cause is UNVERIFIED, because the agent template is not in any repo branch or in the DB.
  - The 08-Aug fetch ran late: started 15:45 IST, versus about 08:30–08:45 IST on other days. That is consistent with manual intervention on the agent PC that day (UNVERIFIED).
- **Not uniform across heads or time.**
  - Heads drop out instead of showing zero, so the snapshot cannot tell a zero month from a missing head.
  - The MTD resets fall on 08-Aug, 04-Sep and 06-Oct, not on the 1st. That suggests an operator period change rather than a scheduled rule (ANALYTICAL).
- **Owner:** whoever administers the PC hosting `D:\tally-agent` (UNVERIFIED). `etl_jobs` has no user column, and the raw XML objects (`raw/…`) are not in `storage.objects`, so no uploader identity is recorded.
- **Needed to close:**
  - The agent's current and historic `*_expenses_request.xml` files.
  - The agent change log.
  - The raw XML files for 07-Aug and 08-Aug from the agent's save location.
  - Name of the Tally admin.
- **Exposure:** any provision logic that reads post-08-Aug snapshots as FYTD understates. The current max-of-max logic masks this by picking older, higher FYTD points. That is a second reason the result is not a normal basis.

### D-011: interest and exceptional costs (VERIFIED_LIVE)
- **Interest is already outside manufacturing COP.** `rpc_refresh_sku_manufacturing_cop_snapshot` builds COP = prime + production OH + QC OH + stores OH. Interest Paid (₹13,89,594.90/month provision, selected from FY 2025-26) sits in `FINANCE_ADMIN_OVERHEAD`, which feeds internal loaded cost, not COP. That matches the D-011 default. The remaining action is to show it as a separate financing line in profitability rather than blending it into loaded cost (PROPOSAL).
- **Items needing Finance classification:**

| Head | Pool | Provision/month | Issue |
|---|---|---|---|
| Interest Paid | FINANCE_ADMIN | ₹13,89,594.90 | Routine financing: exclude from COP, keep visible (D-011). Any project or working-capital interest to be capitalised needs Finance to confirm. |
| Financial Charges | FINANCE_ADMIN | ₹66,603.78 | Bank charges vs financing? |
| Discounts | MARKETING_EXPENSE | ₹2,40,174.45 | Likely a revenue deduction, not an expense. If the price build-up already deducts trade discount, this risks double counting. |
| Forex Gain/loss | MARKETING_EXPENSE | ₹280.43 | Source is a **gain** (−₹841.28 FYTD on 07-Aug). `abs()` turns it into a cost (sign defect, A1-F5). |
| Ineligible ITC | FINANCE_ADMIN | ₹8,351.35 | Tax cost: confirm treatment. |
| Insurance Premium Paid | MARKETING_EXPENSE | ₹20,776.25 | Pool placement looks wrong (factory or asset insurance?). |
| Legal & Professional | FINANCE_ADMIN | ₹3,125 | Exceptional? |

### D-012: independent comparison inputs for a Finance-approved normal budget (no substitution made)
- **POH monthly:**
  - Current max-of-max logic: ₹9,74,980.28.
  - FY 2025-26 average: ₹6,29,880.04.
  - Current FY Apr–Jul: about ₹7.50 lakh.
- **Operational capacity (VERIFIED_LIVE):**
  - Completed FG batches: 107–185/month from Apr-25 to Sep-26, about 140 typical (Aug-26: 109, Sep-26: 115).
  - BMR initiations swing from 11 to 252/month. Aug-26 has only 11, a logging gap, so BMR is not a reliable capacity series yet.
  - The costing workload charges 600 batch-equivalents/month (rounded). The forecast need is 280.37.
- **Abnormal items:**
  - The Fuel & Gas Q1 posting (below).
  - The 31-Mar-2026 row backfilled on 09-Jun.
  - The MTD switch.
- **Conclusion:**
  - None of the available actuals is a reliable normal basis yet: FY 2026-27 is contaminated by the MTD switch and posting timing.
  - Finance must issue a normal operating budget per head. The audit's role is to supply this comparison, not to pick the basis.

### DIR-7: Fuel & Gas without the voucher export (VERIFIED_LIVE data; ANALYTICAL interpretation)
- **Ledger:**
  - Snapshots for `Fuel & Gas (DE)` start on 2026-06-09, already at ₹14,38,768.80 FYTD.
  - From 09-Jun to 07-Aug there is only one posting: +₹12,711.85 on 19–21 Jul.
  - So the ₹14.39 lakh was booked before 09-Jun. Its dates cannot be seen in our data.
- **Physical fuel stock** (`tally_fuel_stock_snapshot`: Fire Wood, Varali, Biomass Briquette, LPG, Umi, Arakkappodi; stock-rate valued):
  - Stock decreases, a lower bound for issues, ran ₹2.39–3.25 lakh/month from Oct-25 to Feb-26, and ₹4.67 / 3.42 / 2.12 / 3.69 lakh for Jun–Sep 2026.
  - Firewood issued: 41,400–65,100 kg/month in active months.
  - Apr–May 2026 shows almost no movement, then ₹12.68 lakh of **receipts in June 2026**.
- **Interpretation (ANALYTICAL):**
  - The Fuel & Gas ledger appears to record purchases, not consumption. The Q1 ₹14.39 lakh is consistent with a stock build-up booked in June against an Apr–May stock-register gap.
  - Dividing it by 3 (the current ₹4,79,589.60/month) overstates normal consumption. The July ₹12,711.85 understates it.
  - Neither is a norm, per DIR-7.
- **Evidence request:** `FINANCE_REQUEST_FUEL_GAS_VOUCHERS.md` (draft, not sent).
