# CI-037 — Google Sheets reconciliation (2026-10-24, read-only)

Workbook: "SASV - PRICING & PROMOTIONAL VIABILITY" (1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q, exported via the Drive MCP, never edited). Supabase: SELECT only. Run: 143 (MASTER DATA A2 = 143).

## Method
1. Extracted the row-2 array formulas of PROMOTIONAL VIABILITY - IK/OK (T basic, U selling, V scheme price, W contingency, X realisation, Y profit, Z/AA/AB %, AF min MRP, AG/AH recommended MRP).
2. Re-implemented them in Python. **Fidelity check:** against the sheet's own cached values (its scenario inputs) it matches 1050/1050 rows (525 per region) at ₹0.01.
3. Fed the re-implementation with run 143's approved inputs (MRP, GST, discount, 2% contingency, selected scheme = 1+0, regional marketing, loaded cost), then compared with CI-037's arithmetic over the stored DB basic/selling/contingency values.

## Results
- **Match: 1254/1254 SKU×region rows (100%) on basic, selling, contingency, scheme price, realisation, profit and all three %s, at ₹0.01. Mismatches: 0.**
- DB totals: profit IK ₹136,203.92 / OK ₹161,686.59, equal to the CI-037 dry run.
- Input parity: MASTER DATA cached inputs equal run 143 for all 1254 rows (MRP, ILC, marketing, discount, GST, contingency %).

## Excluded by price-list membership
101 SKUs per region (202 rows) have price_list_ik/ok = FALSE, so they're absent from the viability tabs. CI-037 still calculates them (correct for the DB: no filtering). SKU ids: 22, 26, 42, 45, 49, 51, 111, 127, 135, 145, 151, 158, 159, 160, 165, 166, 167, 168, 180, 186, 207, 209, 239, 241, 251, 273, 356, 357, 358, 364, 459, 489, 503, 504, 505, 518, 539, 559, 565, 571, 588, 591, 592, 774, 777, 835, 865, 878, 883, 901, 904, 906, 908, 911, 913, 915, 921, 935, 975, 991, 992, 995, 996, 999, 1000, 1002, 1003, 1005, 1006, 1008, 1009, 1011, 1012, 1018, 1019, 1022, 1023, 1025, 1026, 1028, 1029, 1032, 1033, 1035, 1036, 1038, 1039, 1041, 1042, 1045, 1046, 1050, 1051, 1059, 1060, 1069, 1148, 1149, 1201, 1204, 1219, 1229, 1243, 1245, 1249, 1318, 1351, 1365, 1552, 1759, 1768, 1771, 1772, 1783, 1787, 1788, 1792, 1797, 1798.

## Formula differences
- **Contingency base:** both now use 2% of the post-discount ex-GST selling price. Residual: in **AK** (rounded viability), the "Profit on Sales Realization" branch still uses `((1-P)*R/(R+S) - O/100)`, i.e. the pre-discount base. It's inactive (the objective is Profit on MRP, 7%), but it should be fixed in the Sheet.
- **Rounding:** neither side rounds intermediates. The DB stores numerics; the Sheet uses full precision. Only CEILING(…,5) applies, and only to the recommended MRP. No differences at ₹0.01.
- **Marketing:** both subtract regional marketing after contingency (realisation = scheme − contingency − marketing). The Sheet's N = ILC + marketing is used only in the MRP solver.
- **Scheme:** the Sheet uses proposed scenario schemes and discounts (e.g. SKU 1 IK 33%, 11+1). The DB uses the approved selected scheme (1+0 for run 143). This reconciliation fed the Sheet run 143's inputs.

## Synthetic 5+1 (SKUs 45, 51)
| SKU | Reg | Sheet scheme ₹ | DB scheme ₹ | Sheet NSR | DB NSR | Sheet profit | DB profit | Sheet min MRP (7% on MRP) |
|---|---|---|---|---|---|---|---|---|
| 45 | IK | 15.95 | 15.95 | 15.34 | 15.34 | 3.49 | 3.49 | 26.91 |
| 51 | IK | 212.7 | 212.7 | 203.7 | 203.7 | 71.75 | 71.75 | 302.55 |
| 45 | OK | 15.95 | 15.95 | 15.36 | 15.36 | 3.51 | 3.51 | 26.86 |
| 51 | OK | 212.7 | 212.7 | 203.76 | 203.76 | 71.81 | 71.81 | 302.42 |

All equal; they match the CI-037 dry-run references (45 IK 3.49; 51 IK 212.70/203.70/71.75).

## Not done
No Sheet edits, no live writes, no refresh. PR #85 untouched.
