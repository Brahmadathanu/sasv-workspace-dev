# AU-4 — Normal monthly budget: preparation pack (DRAFT for user decision)

Status: preparation only. **No budget is proposed as approved.** The user sets the normal monthly budget per head; Finance/Production are not handoff owners (GOV-015). Source: live read-only, `costing.v_expense_head_monthly_provision` for period 2026-09 and Tally snapshots for 31-Mar-2026 (FY25-26 close ÷ 12) and 31-Jul-2026 (FY26-27 FYTD ÷ 4, the last FYTD month-end before the 08-08 basis change). Aggregates per head only; no ledger rows.

## Why a budget is needed
Run 119 uses the **max** of the FY25-26 and FY26-27 monthly equivalents per head (A1-F2). Total ₹65.44 lakh/month vs FY25-26 actual ₹60.99 lakh (+7.3%), and the production pool ₹9.75 lakh vs ₹6.30 lakh (+55%), driven by Fuel & Gas.

## Pool summary (₹/month)
| Pool | Run-119 provision | FY25-26 avg | FY26-27 Apr–Jul avg | Heads |
|---|---|---|---|---|
| ADMIN_OVERHEAD | 956,470 | 952,493 | 91,218 | 10 |
| FINANCE_ADMIN_OVERHEAD | 1,519,520 | 1,504,561 | 995,393 | 8 |
| MARKETING_EXPENSE | 2,964,501 | 2,904,646 | 2,456,410 | 16 |
| MATERIALS_STORES_OVERHEAD | 77,704 | 55,751 | 75,670 | 2 |
| PRODUCTION_OVERHEAD | 974,980 | 629,880 | 749,892 | 8 |
| QUALITY_CONTROL_OVERHEAD | 51,292 | 51,292 | 36,900 | 1 |
| **Total** | **6,544,467** | **6,098,622** | **4,405,482** | 45 |

Note: Apr–Jul is a 4-month partial year and is seasonally low for some heads (year-end journals and bonus fall later). It is not a full-year substitute.

## Per-head worksheet (user fills **Normal budget** and **Basis**)
| Pool | Head | Run-119 | Sel. FY | FY25-26 avg | FY26-27 Apr–Jul avg | Flag | Normal budget | Basis |
|---|---|---|---|---|---|---|---|---|
| ADMIN | Central Office Charges | 871,973 | 2025 | 871,973 | 22,530 | FY25-26 figure is ~39× the Apr–Jul run rate: likely year-end allocation journal; confirm with Finance |  |  |
| ADMIN | Security Charges | 24,800 | 2025 | 24,800 | 24,000 |  |  |  |
| ADMIN | Telephone,Internet & Cable Charges | 20,213 | 2026 | 19,425 | 20,213 |  |  |  |
| ADMIN | Vehicle Running & Maintenances (DE) | 14,747 | 2026 | 12,649 | 14,747 |  |  |  |
| ADMIN | Welfare Expenses | 11,246 | 2025 | 11,246 | 912 | Apr–Jul run rate 8% of FY avg: seasonal (Onam/bonus)? |  |  |
| ADMIN | Repairs & Maintenances | 11,135 | 2025 | 11,135 | 6,959 |  |  |  |
| ADMIN | Pooja Expenses | 968 | 2026 | 543 | 726 |  |  |  |
| ADMIN | Research & Development Expenses | 780 | 2026 | 154 | 585 |  |  |  |
| ADMIN | Books & Periodicals | 545 | 2026 | 505 | 545 |  |  |  |
| ADMIN | Govt Stamping Fee | 62 | 2025 | 62 |  |  |  |  |
| FINANCE_ADMIN | Interest Paid | 1,389,595 | 2025 | 1,389,595 | 906,767 | Finance cost: exclude from COP, keep visible (D-011) |  |  |
| FINANCE_ADMIN | Financial Charges | 66,604 | 2025 | 66,604 | 60,136 |  |  |  |
| FINANCE_ADMIN | Auditors Remuneration | 25,083 | 2025 | 25,083 |  | Annual fee, accrue monthly |  |  |
| FINANCE_ADMIN | Rates & Taxes (DE) | 18,960 | 2026 | 9,725 | 17,639 |  |  |  |
| FINANCE_ADMIN | Ineligible ITC | 8,351 | 2026 | 5,026 | 8,351 |  |  |  |
| FINANCE_ADMIN | Rates & Taxes | 5,402 | 2025 | 5,402 | 2,125 |  |  |  |
| FINANCE_ADMIN | Legal & Professional Charges | 3,125 | 2025 | 3,125 | 375 |  |  |  |
| FINANCE_ADMIN | Registration Charges | 2,400 | 2026 |  |  | No FY-end/FYTD-Jul figure; provision from 31-Aug window snapshot (AU-3 sets to 0) |  |  |
| MARKETING | Salaries & Allowances | 1,653,025 | 2025 | 1,653,025 | 1,298,158 |  |  |  |
| MARKETING | Field Work Expenses | 319,766 | 2026 | 276,425 | 319,766 |  |  |  |
| MARKETING | Discounts | 240,174 | 2025 | 240,174 | 212,496 | Revenue deduction? risk of double counting with price build-up |  |  |
| MARKETING | Vehicle Running & Maintenances | 223,935 | 2025 | 223,935 | 221,044 |  |  |  |
| MARKETING | Travelling & Conveyance | 145,272 | 2025 | 145,272 | 99,941 |  |  |  |
| MARKETING | Rent | 89,190 | 2026 | 87,145 | 89,190 |  |  |  |
| MARKETING | Sales Promotion Expenses | 84,412 | 2025 | 84,412 | 71,262 |  |  |  |
| MARKETING | Carriage Outward | 57,948 | 2026 | 43,758 | 57,948 |  |  |  |
| MARKETING | Mess Expenses | 54,794 | 2025 | 54,794 | 43,134 |  |  |  |
| MARKETING | Postage & Courier Charges | 30,895 | 2025 | 30,895 | 10,233 |  |  |  |
| MARKETING | Printing & Stationery | 25,266 | 2025 | 25,266 | 19,739 |  |  |  |
| MARKETING | Insurance Premium Paid | 20,776 | 2025 | 20,776 | 10,309 | Pool placement (factory/asset insurance?) |  |  |
| MARKETING | Advertisement Expenses | 12,500 | 2025 | 12,500 |  | Campaign-driven, budget not history |  |  |
| MARKETING | Travelling & Conveyance (DE) | 4,633 | 2025 | 4,633 | 2,661 |  |  |  |
| MARKETING | Cleaning Expenses | 1,635 | 2025 | 1,635 | 740 |  |  |  |
| MARKETING | Forex Gain/loss | 280 | 2026 |  | -210 | Source is a GAIN; abs() makes it a cost (A1-F5) |  |  |
| MATERIALS_STORES | Carriage Inward (DE) | 67,725 | 2026 | 50,132 | 67,725 |  |  |  |
| MATERIALS_STORES | Packing & Forwarding Charges (DE) | 9,979 | 2026 | 5,619 | 7,944 |  |  |  |
| PRODUCTION | Fuel & Gas (DE) | 479,590 | 2026 | 161,969 | 362,870 | Q1 purchase spike annualised (A1-F3); July alone ₹12,712 |  |  |
| PRODUCTION | Mess Expenses (DE) | 177,225 | 2025 | 177,225 | 133,950 |  |  |  |
| PRODUCTION | Electricity & Water Charges (DE) | 149,305 | 2025 | 149,305 | 112,935 |  |  |  |
| PRODUCTION | Repairs & Maintenances (DE) | 69,458 | 2026 | 41,978 | 69,458 | FYTD Jul selected; +65% vs FY avg (A1-F4) |  |  |
| PRODUCTION | Cleaning Expenses (DE) | 35,511 | 2025 | 35,511 | 32,259 |  |  |  |
| PRODUCTION | Factory Expenses (DE) | 29,984 | 2025 | 29,984 | 27,140 |  |  |  |
| PRODUCTION | Job Work Expense | 25,562 | 2025 | 25,562 | 8,384 | Apr–Jul run rate 1/3 of FY avg; volume-driven? |  |  |
| PRODUCTION | Printing & Stationery (DE) | 8,346 | 2025 | 8,346 | 2,896 |  |  |  |
| QUALITY_CONTROL | Lab Expenses (DE) | 51,292 | 2025 | 51,292 | 36,900 |  |  |  |

## Suggested basis options (choose per head)
1. **FY25-26 actual ÷ 12**: complete, audited-close year; default for stable heads.
2. **Trailing 12 months** once AU-3 normalised months exist (needs a FY-end-consistent series; the earliest clean date is after AU-3b is live).
3. **Known-commitment budget** (contracts: rent, security, audit fee, central office charge): enter the contracted monthly amount.
4. **Driver-based** (fuel, electricity, job work): rate × normal volume. Needs the normal-capacity output decision (AU-5).
5. **Exclude from COP** (interest, discounts as revenue deduction, forex): keep visible in management P&L only.

## Decisions needed (user)
- D-B1: Budget basis per head (table above). Recommended default is option 1, with overrides for Fuel & Gas, Central Office Charges, Repairs (DE), Registration and Welfare.
- D-B2: Treatment of Interest Paid, Financial Charges, Discounts and Forex (exclude from COP?).
- D-B3: Fuel & Gas normal level: FY25-26 ₹1.62 lakh, Apr–Jul ₹3.63 lakh, or driver-based? The difference is ₹2.0–3.2 lakh/month on POH.
- D-B4: Effective period and review cadence (proposed: from Oct-2026, quarterly review).

## Evidence still to collect (user to request; no handoff)
Fuel & Gas Q1 purchase vouchers (see FINANCE_REQUEST_FUEL_GAS_VOUCHERS.md); Central Office Charges FY25-26 journal basis; Welfare/bonus timing; contracts for rent/security/audit.
