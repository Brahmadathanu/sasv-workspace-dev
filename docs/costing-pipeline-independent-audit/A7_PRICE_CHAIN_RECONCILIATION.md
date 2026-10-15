# A7 — Price-chain reconciliation (509 / 440 sheet overlays vs run 119, full 635-SKU range)
Status: **COMPLETE for audit scope** (Grok, 2026-10-15, read-only). No sheet edits, no DB writes, no refresh/approval.
Labels: **VERIFIED** = reproduced from sheet/live data; **ESTIMATE** = analytical scenario (simulator rates `SIMULATION_ONLY_NOT_APPROVED_RATE`, FY25-26 POH average); neither is an approved rate or price.
Evidence: `evidence/A7/` (sheet CSV snapshots + RETRIEVAL.md, run-119 extract, `A7_SKU_PRICE_CHAIN.csv` per sheet SKU, `A7_FULL_RANGE_SENSITIVITY.csv` all 635, `A7_SUMMARY.json`). Queries: `queries/A7_01*.sql`, `A7_02*.sql`, `A7_03_price_chain_analysis.py`.
The sheets are overlays (user direction 2026-10-15); the canonical scope is the full costing range.

## (a) SKU reconciliation — VERIFIED
| Check | Result |
|---|---|
| 509 tab rows / unique SKU IDs | 509 / 509 |
| 509 SKUs present in run 119 / in SKU master / inactive | 509 / 509 / 0 |
| 440 tab (no SKU ID column) matched to 509 on product+pack+UOM | 440 / 440, 0 unmatched, 0 extra |
| 509 − 440 | 69 (all `HOLD - EXTREME COST/PRICE`) |
| Run-119 SKUs **not** in the sheet | **126** (outside the price exercise but inside A7 sensitivity) |
| Active non-sample master SKUs not in run 119 | 1 |
| Run-119 OK pricing bridge READY | 507 of 635 |
| Sheet "Current OK MRP" ≠ run-119 MRP | **19 SKUs**, all in the sheet's board-approved MRP register (effective 2026-09-05/09-10; 12 of them in the 440). Run 119 (valuation 2026-09-10) still carries the old MRPs, e.g. SKU 955 ₹190 vs board ₹600, 972 ₹175 vs ₹400. Cause (policy not loaded vs effective-date handling): UNVERIFIED. |
Side tabs: `OK Y Missing from Proposal` (97: 51 × 5000 mL, 38 concentrated kashayam, 8 individual) and `Proposal Not OK Y` (37 "check eligibility") — scope gaps the sheet itself records.

## (b) Chain trace — VERIFIED formula, UNTRACEABLE cost input
Sheet formula (reproduced on 509/509 to <₹0.05): Basic = MRP/(1+GST); Discounted SP = Basic×0.60 (40%); Effective SR = DSP×5/6 (5+1); Commercial = Loaded + Marketing(OK); Contingency = 2%×SR; Profit = SR − Commercial − Contingency.
Analytical min MRP = Commercial / (0.5(1−c)/(1+g) − 0.07) (7% profit on MRP). **Proposed = ceil₹5(max(current OK MRP, min))** — 440/440 reproduced. Side effect: 30 SKUs with non-₹5 current MRPs get +₹1–4 with no cost reason (e.g. Hridayasanthi 187→190).
Divergences:
1. **Marketing cost** matches run 119 OK marketing on every SKU (0 diffs >1%).
2. **"Provisional Loaded Cost" does not come from run 119 or any stored run.** 454/509 differ by >1% (decile range −44%…+20%; net −₹17,789 across the 509). Extremes: SKU 193 Ksheerabala 41 Avarthi sheet ₹545 vs run 119 ₹5,197; 988 Thampira Chendooram ₹104 vs ₹4,635; 813 Gandhakamadhusnuhi ₹346 vs ₹228. No snapshot run (incl. 103–119, Mar/Jun) holds SKU 2 = ₹40.61. The sheet value sits closer to run-119 + batch-true correction (median abs error 5.0%) than to run 119 (7.9%), i.e. a manual/off-system normalisation layer was applied. **Lineage gap: the circulated 440 prices cannot be reproduced from the costing suite.** (P1)
3. MRP basis differs on 19 SKUs (see a).

## (c) Defect sensitivity — ESTIMATE, on run-119 system basis
Scenarios per SKU: **batch** = live simulator batch-true DL+POH (preferred batch ÷ net output × pack base qty) minus run-119 DL+POH; **provision** = POH × (FY25-26 avg ₹6,29,880 ÷ selected ₹9,74,980) (covers max-of-max and the Q1 Fuel & Gas purchase spike, which sit inside POH); **combined** = both. Tally MTD: **no effect on run 119** (max-selection masked it, A1-F1); it is a forward risk for every later run. Unit errors: SKU 879 Mehasamani (in the 69 hold, run-119 min MRP ₹403 vs ₹40 MRP — meaningless until the factor is fixed); 859/1277 RM understated (both in the 440).
Medians per sheet SKU: batch −₹2.06, provision −₹1.78. Batch moves cost up on 142 and down on 359 sheet SKUs (8 without simulation).
| Population | SKUs | Below 7%-profit min MRP at current MRP, run 119 | …after combined correction | Cost ↑ / ↓ |
|---|---|---|---|---|
| 509 sheet | 509 | 314 | 233 | 106 / 395 |
| 440 submitted | 440 | 245 | 174 | 88 / 345 |
| **Not in sheet** | 126 | 84 | **76** | 61 / 65 |
| All run 119 | 635 | 398 | 309 | 167 / 460 |
For the 440 proposed prices: 274 are increases; **101 increases are not needed once costs are corrected** (corrected min ≤ current MRP; Σ ₹1,831 of MRP uplift, 40 of them low-volume products whose run-119 cost is inflated); **3** proposed prices remain below the corrected minimum (892 Mailanchi Podi −₹7, 867 Sudhi Avanakkenna −₹4, 893 Neelayamari Podi −₹3). 127 of the 440 sit below the run-119-basis minimum (Σ ₹27,346 MRP), mostly low-volume items whose run-119 cost is the batch-rounding artefact.
Mainstream note: A3-F5 aggregate understatement (₹7.46 L/month) is concentrated in the 142 batch-up SKUs; the 126 SKUs outside the sheet have the highest share of cost-up (61/126), so the unpriced remainder carries proportionally more risk than the sheet.

## (d) Why 509 became 440 — VERIFIED from the sheet
All 69 removed rows have `Costing Review = HOLD - EXTREME COST/PRICE` and blank `Target Validation`; every one has analytical min MRP > 2.0× current MRP (min ratio 2.002), while every one of the 440 is ≤ 1.98×. The screen is therefore "min MRP ≤ 2× current". 29 of the 69 are A3 low-volume products (batch-rounding inflated); SKU 879 is among them. The 440 tab dropped SKU ID and IK MRP; one `Costing Review` cell is `#REF!` (row 1, 859), the rest blank — a broken reference in the filtered copy.

## (e) 440 recommendation — classification rule in `A7_03`, column `class`
| Class | Count | Rule | Action |
|---|---|---|---|
| **SAFE** | **293** | Proposed ≥ corrected min MRP (batch and combined) and, if an increase, still needed | Can stand provisionally; formal adoption only after AU-2 reference run + AU-7 governed re-run |
| **AT RISK – too high** | **101** | Increase not supported after correction | Review: keep current MRP or smaller step |
| **AT RISK – too low / basis** | **43** | Shortfall ≤10% or low-volume cost basis to be restated (39 low-volume) | Re-check after AU-5 batch-true |
| **HOLD** | **3** | 859, 1277 (RM implausible, A2-F2), 892 (−10.9% vs corrected min) | Fix master data / reprice |
Plus the 69 already on hold (incl. 879). Caveats: estimates use non-approved simulator rates and a non-approved POH basis; SAFE does not mean approved. The sheet's own loaded cost is untraceable, so no price should be written to `sku_mrp_policy` from the sheet without AU-7 lineage.

## Findings
- **A7-F1 (P1, VERIFIED)** Sheet loaded cost has no system lineage (454/509 >1% off run 119).
- **A7-F2 (P1, VERIFIED)** 19 board-approved MRPs not reflected in run 119's MRP resolution.
- **A7-F3 (P2, VERIFIED)** ₹5 ceiling applied to current MRP raises 30 prices without cost cause.
- **A7-F4 (P1, ESTIMATE)** 101/440 increases unnecessary and 3 short after defect correction; 76 non-sheet SKUs below target margin — full-range repricing needed, not sheet-only.
- **A7-F5 (P3, VERIFIED)** `#REF!` and dropped SKU ID column in the filtered tab.
Next: AU-7 must consume a governed reference run and write a per-SKU lineage row (run id, cost components, policy ids, rounding) for every MRP proposal.
