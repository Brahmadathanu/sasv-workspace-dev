# Cost-head policy ledger (proposal, NOT applied) — 2026-10-16

All 52 active Tally heads in `expense_head_costing_map` are listed individually (no grouping loss). Effective from 2026-04-01; open rows have effective_to null; new policy = close the old row and insert a new one (history kept).

Status counts: APPROVED 1 (₹161,969.07/mo), EXCLUDED 6 (₹0.00/mo), PROVISIONAL 40 (₹3,695,726.06/mo), UNRESOLVED 5 (₹2,334,911.26/mo)

## Reconciliation by pool (ledger normal vs current AU-3 source provision)
| Pool | Ledger ₹/mo | Source ₹/mo | Δ |
|---|---|---|---|
| ADMIN_OVERHEAD | 956,469.78 | 956,469.78 | 0.00 |
| EXCLUDED | 0.00 | 0.00 | 0.00 |
| FINANCE_ADMIN_OVERHEAD | 1,517,120.36 | 1,517,120.36 | 0.00 |
| MARKETING_EXPENSE | 2,964,501.01 | 2,964,501.01 | 0.00 |
| MATERIALS_STORES_OVERHEAD | 73,343.53 | 77,704.33 | -4,360.80 |
| PRODUCTION_OVERHEAD | 629,880.04 | 974,980.28 | -345,100.24 |
| QUALITY_CONTROL_OVERHEAD | 51,291.67 | 51,291.67 | 0.00 |

Δ is policy-driven only (Fuel −3,17,620.53; Repairs −27,479.71; P&F −4,360.80; Misc 0). Carriage inward stays in its current pool until the reclass is approved (shown UNRESOLVED).

## Heads
| Group | Head | Pool | Status | Normal ₹/mo | Source prov | FY25-26 ₹ | FY26-27 Apr–Aug ₹ | Basis |
|---|---|---|---|---|---|---|---|---|
| Direct E | Carriage Inward (DE) | MATERIALS_STORES_OVERHEAD | UNRESOLVED | 67,725.00 | 67,725.00 | 601,590 | 385,027 | Reclass to material acquisition cost (not a saving); duplicate-charge control required |
| Direct E | Cleaning Expenses (DE) | PRODUCTION_OVERHEAD | PROVISIONAL | 35,511.10 | 35,511.10 | 426,133 | 174,064 | AU-3 standard monthly provision (higher-of-years) |
| Direct E | Electricity & Water Charges (DE) | PRODUCTION_OVERHEAD | PROVISIONAL | 149,304.75 | 149,304.75 | 1,791,657 | 479,416 | AU-3 higher-of-years provision |
| Direct E | Employer Contributions (DE) | EXCLUDED | EXCLUDED | 0.00 | 0.00 | 1,673,372 | 897,552 | Mapped EXCLUDED in expense_head_costing_map (salary via HR roster) |
| Direct E | Factory Expenses (DE) | PRODUCTION_OVERHEAD | PROVISIONAL | 29,983.51 | 29,983.51 | 359,802 | 130,558 | AU-3 standard monthly provision (higher-of-years) |
| Direct E | Fuel & Gas (DE) | PRODUCTION_OVERHEAD | APPROVED | 161,969.07 | 479,589.60 | 1,943,629 | 1,451,481 | User-approved normal; stock-register consumption ~1.89L/mo kept as separate actual reconciliation |
| Direct E | Job Work Expense | PRODUCTION_OVERHEAD | PROVISIONAL | 25,562.25 | 25,562.25 | 306,747 | 33,535 | FY25-26/12; attribution to processes pending |
| Direct E | Lab Expenses (DE) | QUALITY_CONTROL_OVERHEAD | PROVISIONAL | 51,291.67 | 51,291.67 | 615,500 | 388,382 | FY25-26/12 |
| Direct E | Mess Expenses (DE) | PRODUCTION_OVERHEAD | PROVISIONAL | 177,224.92 | 177,224.92 | 2,126,699 | 742,781 | 100% mfg pending headcount-share evidence |
| Direct E | Packing & Forwarding Charges (DE) | MATERIALS_STORES_OVERHEAD | UNRESOLVED | 5,618.53 | 9,979.33 | 67,422 | 46,451 | Inbound/production share only; outbound share to MARKETING pending split evidence |
| Direct E | Printing & Stationery (DE) | PRODUCTION_OVERHEAD | PROVISIONAL | 8,346.24 | 8,346.24 | 100,155 | 15,468 | AU-3 standard monthly provision (higher-of-years) |
| Direct E | Rates & Taxes (DE) | FINANCE_ADMIN_OVERHEAD | PROVISIONAL | 18,959.67 | 18,959.67 | 116,700 | 79,835 | AU-3 standard monthly provision (higher-of-years) |
| Direct E | Repairs & Maintenances (DE) | PRODUCTION_OVERHEAD | PROVISIONAL | 41,978.20 | 69,457.91 | 503,738 | 454,479 | Recurring normal; FY26-27 spike 2.78L excluded as non-recurring |
| Direct E | Research & Development Expenses | ADMIN_OVERHEAD | PROVISIONAL | 780.31 | 780.31 | 1,851 | 2,341 | AU-3 standard monthly provision (higher-of-years) |
| Direct E | Round Off on Purchase | EXCLUDED | EXCLUDED | 0.00 | 0.00 | -86 | -64 | Mapped EXCLUDED in expense_head_costing_map |
| Direct E | Salaries & Allowances (DE) | EXCLUDED | EXCLUDED | 0.00 | 0.00 | 25,952,567 | 11,223,536 | Mapped EXCLUDED in expense_head_costing_map (salary via HR roster) |
| Direct E | Travelling & Conveyance (DE) | MARKETING_EXPENSE | PROVISIONAL | 4,632.67 | 4,632.67 | 55,592 | 10,995 | AU-3 standard monthly provision (higher-of-years) |
| Direct E | Vehicle Running & Maintenances (DE) | ADMIN_OVERHEAD | PROVISIONAL | 14,747.17 | 14,747.17 | 151,789 | 88,016 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Advertisement Expenses | MARKETING_EXPENSE | PROVISIONAL | 12,500.00 | 12,500.00 | 150,000 | 0 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Auditors Remuneration | FINANCE_ADMIN_OVERHEAD | PROVISIONAL | 25,083.33 | 25,083.33 | 301,000 | 301,000 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Books & Periodicals | ADMIN_OVERHEAD | PROVISIONAL | 545.00 | 545.00 | 6,060 | 3,450 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Carriage Outward | MARKETING_EXPENSE | PROVISIONAL | 57,948.00 | 57,948.00 | 525,101 | 338,563 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Central Office Charges | ADMIN_OVERHEAD | UNRESOLVED | 871,972.83 | 871,972.83 | 10,463,674 | 757,568 | FY25-26 10.46L/yr vs FY26-27 7.58L/5mo; nature/allocation unverified |
| Indirect | Cleaning Expenses | MARKETING_EXPENSE | PROVISIONAL | 1,634.96 | 1,634.96 | 19,620 | 3,161 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Damage Stock A/c | EXCLUDED | EXCLUDED | 0.00 | 0.00 | 309,651 | 0 | Mapped EXCLUDED in expense_head_costing_map |
| Indirect | Discounts | MARKETING_EXPENSE | PROVISIONAL | 240,174.45 | 240,174.45 | 2,882,093 | 1,789,811 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Employer Contributions | EXCLUDED | EXCLUDED | 0.00 | 0.00 | 577,840 | 282,175 | Mapped EXCLUDED in expense_head_costing_map (salary via HR roster) |
| Indirect | Field Work Expenses | MARKETING_EXPENSE | PROVISIONAL | 319,765.50 | 319,765.50 | 3,317,097 | 2,045,494 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Financial Charges | FINANCE_ADMIN_OVERHEAD | PROVISIONAL | 66,603.78 | 66,603.78 | 799,245 | 104,272 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Fine & Penalty | EXCLUDED | EXCLUDED | 0.00 | 0.00 | 1,903 | 103 | Mapped EXCLUDED in expense_head_costing_map |
| Indirect | Forex Gain/loss | MARKETING_EXPENSE | PROVISIONAL | 280.43 | 280.43 | 0 | -841 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Govt Stamping Fee | ADMIN_OVERHEAD | PROVISIONAL | 62.50 | 62.50 | 750 | 0 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Ineligible ITC | FINANCE_ADMIN_OVERHEAD | PROVISIONAL | 8,351.35 | 8,351.35 | 60,316 | 33,405 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Insurance Premium Paid | MARKETING_EXPENSE | PROVISIONAL | 20,776.25 | 20,776.25 | 249,315 | 62,668 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Interest Paid | FINANCE_ADMIN_OVERHEAD | UNRESOLVED | 1,389,594.90 | 1,389,594.90 | 16,675,139 | 6,759,779 | Finance cost; inclusion in product cost needs user policy |
| Indirect | Legal & Professional Charges | FINANCE_ADMIN_OVERHEAD | PROVISIONAL | 3,125.00 | 3,125.00 | 37,500 | 1,500 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Mess Expenses | MARKETING_EXPENSE | PROVISIONAL | 54,793.86 | 54,793.86 | 657,526 | 274,236 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Miscellaneous Expenses | EXCLUDED | UNRESOLVED | 0.00 | 0.00 | 259,529 | 64,824 | Currently excluded; 2.60L FY25-26 not classified |
| Indirect | Pooja Expenses | ADMIN_OVERHEAD | PROVISIONAL | 967.67 | 967.67 | 6,521 | 2,903 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Postage & Courier Charges | MARKETING_EXPENSE | PROVISIONAL | 30,895.40 | 30,895.40 | 370,745 | 175,151 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Printing & Stationery | MARKETING_EXPENSE | PROVISIONAL | 25,265.77 | 25,265.77 | 303,189 | 199,744 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Rates & Taxes | FINANCE_ADMIN_OVERHEAD | PROVISIONAL | 5,402.33 | 5,402.33 | 64,828 | 14,881 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Registration Charges | FINANCE_ADMIN_OVERHEAD | PROVISIONAL | 0.00 | 0.00 | 0 | 12,000 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Rent | MARKETING_EXPENSE | PROVISIONAL | 89,190.00 | 89,190.00 | 1,045,745 | 562,140 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Repairs & Maintenances | ADMIN_OVERHEAD | PROVISIONAL | 11,134.92 | 11,134.92 | 133,619 | 55,080 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Salaries & Allowances | MARKETING_EXPENSE | PROVISIONAL | 1,653,024.67 | 1,653,024.67 | 19,836,296 | 8,005,311 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Sales Promotion Expenses | MARKETING_EXPENSE | PROVISIONAL | 84,411.69 | 84,411.69 | 1,012,940 | 698,257 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Security Charges | ADMIN_OVERHEAD | PROVISIONAL | 24,800.00 | 24,800.00 | 297,600 | 160,000 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Telephone,Internet & Cable Charges | ADMIN_OVERHEAD | PROVISIONAL | 20,213.30 | 20,213.30 | 233,099 | 148,449 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Travelling & Conveyance | MARKETING_EXPENSE | PROVISIONAL | 145,271.94 | 145,271.94 | 1,743,263 | 657,951 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Vehicle Running & Maintenances | MARKETING_EXPENSE | PROVISIONAL | 223,935.42 | 223,935.42 | 2,687,225 | 1,529,562 | AU-3 standard monthly provision (higher-of-years) |
| Indirect | Welfare Expenses | ADMIN_OVERHEAD | PROVISIONAL | 11,246.08 | 11,246.08 | 134,953 | 8,619 | AU-3 standard monthly provision (higher-of-years) |
