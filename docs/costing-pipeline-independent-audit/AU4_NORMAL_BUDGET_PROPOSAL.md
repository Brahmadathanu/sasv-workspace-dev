# AU-4 Normal Budget Proposal (per head) — 2026-10-16 — PROPOSAL ONLY, nothing activated
Valuation-date-driven, period-independent. Run 119 = REFERENCE (comparison only). Aggregates per head only.

## Sources (read-only live)
- Run-119 pools (staff roster + v_expense_head_monthly_provision Sep-2026).
- FY25-26 Tally Direct Expenses (as_of 2026-03-31)/12; FY26-27 Apr–Jul (complete) via AU-3 view.
- Denominators: MC06 deduplicated first-transfer cohort Oct-2025–Sep-2026 (1436 product-batches): labour 11,615.90 WU/yr = **967.99/mo**; OH 12,660.50 = **1,055.04/mo**; batches 1436/12 = **119.67/mo**. Same basis as illustrative rates (DL 729.55 / FOH 342.72 / VOH 620.31), so rate deltas are numerator-only. Caveat: transfer ≠ verified completion; left-censored.
- On-cost: Employer Contributions (DE) FY26-27 Apr–Jul 150,865/mo = 8.11% of Salaries (DE) 1,859,502/mo; not in any run-119 pool.
- Variable/fixed pool membership reproduces illustrative split exactly (VOH 654,456.60 = Fuel+Electricity+Job Work; FOH 361,578.68 = Mess+Repairs+Cleaning+Factory+Printing+POH staff).

## Per-head table (₹/month)
|Head|Run119|Proposed/mo|Method|Behaviour|Driver|Denominator|Rate|Δ vs 119|
|-|-|-|-|-|-|-|-|-|
|Manufacturing labour|706,203|763,499|HR roster + employer on-cost 8.11%|Fixed (salaried)|Route attendance workload|967.99|788.75|+57,296|
|Packing labour|621,599|672,031|HR roster + on-cost|Fixed (salaried)|Expected package units|TBD|—|+50,432|
|POH supervision staff|41,055|44,386|HR roster + on-cost|Fixed|OH workload units|1,055.04|42.07|+3,331|
|Mess|177,225|177,225|FY25-26 avg|Fixed|OH workload|1,055.04|167.98|+0|
|Repairs & Maint.|69,458|41,978|FY25-26 avg (FY26-27 4-mo spike excluded pending review)|Mixed|OH workload|1,055.04|39.79|-27,480|
|Cleaning|35,511|35,511|FY25-26 avg|Fixed|OH workload|1,055.04|33.66|+0|
|Factory exp.|29,984|29,984|FY25-26 avg|Fixed|OH workload|1,055.04|28.42|+0|
|Printing & Stat.|8,346|8,346|FY25-26 avg|Fixed|OH workload|1,055.04|7.91|+0|
|Fuel & Gas|479,590|161,969|FY25-26 avg (directive)|Variable|OH workload (heating hrs later)|1,055.04|153.52|-317,621|
|Electricity & Water|149,305|149,305|FY25-26 avg|Mixed|OH workload|1,055.04|141.52|+0|
|Job Work|25,562|25,562|FY25-26 avg; attribute direct when invoice names product|Variable|Direct product/process|1,055.04|24.23|+0|
|QC staff|90,950|98,329|HR roster + on-cost|Fixed|Batches released|119.67|821.69|+7,379|
|QC lab expenses|51,292|51,292|FY25-26 avg|Variable|Batches released|119.67|428.62|+0|
|Stores staff|187,165|202,350|HR roster + on-cost|Fixed|Batches (issue lines later)|119.67|1,690.95|+15,185|
|Carriage inward|67,725|50,132|FY25-26 avg; recommend move to material landed cost|Variable|Material receipts value|119.67|418.93|-17,592|
|Packing & Fwd (DE)|9,979|5,619|FY25-26 avg|Variable|Batches|119.67|46.95|-4,361|

## Pool results
pool DL: run119 706,203 -> 763,499 (+57,296) rate 788.75 vs illustrative 729.55
pool PACK: run119 621,599 -> 672,031 (+50,432) 
pool FOH: run119 361,579 -> 337,430 (-24,149) rate 319.83 vs illustrative 342.72
pool VOH: run119 654,457 -> 336,836 (-317,621) rate 319.26 vs illustrative 620.31
pool QC: run119 142,242 -> 149,621 (+7,379) per-batch 1,250
pool ST: run119 264,869 -> 258,101 (-6,768) per-batch 2,157
TOTAL 2,750,948 -> 2,517,517 (-233,432, -8.5%) oc=1.0811

## Abnormal / non-recurring
- Fuel & Gas Apr–Jun FY26-27 bucket ₹14.39L, Jul ₹12.7k, Aug/Sep 0 ⇒ purchase timing (stock build), not consumption. Budget = FY25-26 avg ₹1.62L. Keep purchases (Tally DE) and consumption (fuel stock issues, when captured) as separate lines.
- Repairs FY26-27 ₹2.78L in 4 months vs FY25-26 avg ₹0.42L/mo: possible capital/one-off; needs voucher review.
- Job Work: only July ₹33.5k in FY26-27; no product reference in ledger → cannot attribute yet; keep in VOH, attribute directly once vouchers carry product/batch.
- Carriage Inward: purchase-driven → belongs in material landed cost, not stores OH.

## Uncertainties
1. Salaries (DE) ₹18.6L/mo vs HR roster ₹16.47L: ₹2.1L/mo unreconciled (class mapping). Not added.
2. Denominator is transfer-based; needs production-authority confirmation as normal capacity.
3. Packing labour driver denominator (expected package units/month) not yet established.
4. Electricity mixed (fixed base unmetered); treated variable as in MC split.
