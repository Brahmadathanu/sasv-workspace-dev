# Re-check of lapsed acceptances against run 127 (READ-ONLY, 2026-10-18)
Nothing was accepted and there were no live writes. Data: `live/qty_lapsed_vs_run127.csv`, `live/regional_acceptance_vs_run127.csv`.

## Why they lapsed
Each acceptance is tied to the exact evidence it was given for (units, base qty, policy; for regional rows also marketing cost per unit). SALES-01 changed sibling volumes, so the evidence moved and the match broke. The reason for review did not change.

## Materiality threshold used
A row is **immaterial (safe to re-accept)** when all of these hold:
- the basis/value source and review reason are the same;
- units change by no more than ±25%;
- marketing cost per unit changes by no more than 10%, or no more than Rs 0.25 per unit;
- the cost change is no more than 0.5% of the regional selling price.

Anything else is material.

## Sales-quantity defaults (3 lapsed; 8 SKUs in review)
| SKU | Accepted | Run 127 | Change | Class |
|---|---|---|---|---|
| 251 Karpasasthyadi Thailam 2 L | 6.455/month | 6.219 | −3.7% | immaterial |
| 1149 Hridayasudhi 200 mL | 7.75 | 8.35 | +7.7% | immaterial |
| 1771 Brihat Chagaladi Ghritham 150 mL | 8.70 | 0.725 | −92% | **material**: sibling 1772 sold 29 units in a single month, so the seasonal average gives 2.42/month and the default (10% of product) drops |

All three use the same policy (smart default, NEW_SKU_EXISTING_PRODUCT). Re-accepting them clears all 8 prime-cost reviews (the 3 products' other SKUs follow).

## Regional marketing (204 accepted rows)
| Class | Rows | SKUs | Note |
|---|---|---|---|
| (a) Immaterial | 155 | 98 | 149 have identical units; cost moves at most Rs 0.05 per unit |
| (b) Material | 45 | 36 | see below; the cost change is at most 0.2% of selling price in every case |
| (c) Issue gone | 4 | 2 | Kvatha 1769/1770 inactive; acceptance is moot |

- None of the 200 live rows had its review reason disappear; all are still region-scaled or default-policy review.
- Run 127 has no regional review rows without an earlier acceptance.

Material rows by cause:
- **28 rows / 19 SKUs:** units −92% because all 12-month sales fell in ONE month. The seasonal rule now uses 1/12 of that.
  Examples: Udarasudha 100 mL, Hridayasanthi 100 mL, Artiban Forte, Jumbolene, Vathamarmakan, Arjun Forte capsules, Vallarai tablet, Hridayamohini, Kadaleekalpa 100 g, Karunai Lehyam 10 kg, Peenasakesari 5 L, Koottu Kuzhambu 10 L, Karpasasthyadi Kuzhambu 5 L, Chinchadi Kuzhambu 5 L, Chemparathyadi Keram 5 L, Triphaladi 1 kg, Nagaradi Lepa 1 kg, Chukku Podi 1 kg, Brihat Chagaladi 150 mL.
  These are one-off or irregular sellers rather than true seasonals. User's eye: confirm the 12-month average is wanted for them.
- **13 rows / 13 SKUs:** units −46% to −91% (one +160%, Kazharchi 50 g) from the net feed or seasonal average. Cost per unit change is at most 10%.
- **4 rows / 4 SKUs, cost per unit >10%:**

| SKU | Region | Units acc → 127 | Mkt cost/unit acc → 127 | Change | % of price |
|---|---|---|---|---|---|
| 1009 Kazharchi Choornam 100 g | IK | 23.7 → 2.0 | 2.23 → 2.60 | +16.9% | 0.20% |
| 1051 Avuri Choornam 100 g | IK | 10.9 → 2.0 | 1.81 → 2.06 | +13.9% | 0.15% |
| 483 Palandava Keram 450 mL | OK | 2.11 → 0.40 | 5.87 → 6.55 | +11.7% | 0.08% |
| 1023 Orithalthamarai Choornam 100 g | IK | 20.5 → 5.3 | 2.84 → 3.16 | +11.2% | 0.10% |

## Recommendation
- Re-accept the 155 immaterial regional rows and the 2 immaterial quantity defaults (251, 1149).
- The 45 material regional rows and SKU 1771 have negligible margin impact (≤0.2% of price). They hinge on one decision: should SKUs whose year's sales fell in a single month be averaged over 12 months? If yes, they can be re-accepted too.
