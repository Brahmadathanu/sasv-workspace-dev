# G1 upstream lineage: Tally rates -> material lines; BOM/UOM/yield; route/machine -> labour

Runs 122 (Sep, valuation 10 Sep, run 16 Oct) and 128 (Oct, valuation 16 Oct, run 18 Oct 13:13-13:40 IST). Read-only, 19 Oct 2026 ~19:00 IST.
Evidence: `evidence/G1U/` (u1 material lineage, u2 replay and masters, u3 labour lineage, u4 golden traces, u5 labour concentration; SQL + results).

## Result
**Arithmetic and source lineage: VERIFIED for both runs, all SKUs.** No lost, duplicated or untraceable material or labour amount. Residual items are data/driver plausibility and reproducibility (CI-028..032), not calculation defects.

## Material chain (u1, u2)
| Check | Run 122 | Run 128 |
|---|---|---|
| SKU material = RM + PM | 634/634 | 627/627 |
| SKU RM = sum of frozen RM lines; SKU PM = sum of PM lines | 0 mismatches | 0 mismatches |
| RM line = qty (purchase form per base unit) x selected rate | 9,064 lines, 0 mismatch | 9,049, 0 |
| Purchase-form qty = consume qty x form-conversion factor (UOM) | 411 conversions, 0 mismatch | 408, 0 |
| SKU line = base-unit line x pack size x conversion to base | 11,898, 0 | 11,878, 0 |
| PM line = required qty x rate | 2,326, 0 | 2,307, 0 |
| Rate dated after valuation date | 0 | 0 |
| LAST_PURCHASE picks traced to the Tally voucher today (same fact, rate, date) | 999/999 | 994/994 |
| Newer qualifying voucher (<= valuation date) now present (late Tally data) | 0 | 0 |
| Manual rates traced (same value, still ACTIVE) | 88/88 | 87/87 |
| Lines with no rate | 5, all optional | 5, all optional |
| Builder replay today at the run's valuation date vs frozen | **8 of 537 products differ** (CI-028) | 535/535 identical |

Yield: BOM quantity per base unit = line qty / (reference output x (1 - process loss)). Process loss is a fraction (max 0.98). Line-level wastage_pct is carried but is 0 on all 9,382 RM and 797 SP BOM lines, so ignoring it has no effect today.

Rate-source mix, run 128 (monthly value = line cost x frozen monthly units):

| Source | RM Rs/month | PM Rs/month |
|---|---|---|
| Latest purchase (<=180 days) | 84,00,589 | 19,47,797 |
| Latest purchase, stale >180 days | 6,20,007 | 2,24,353 |
| Manual rate | 4,02,745 | 13,164 |
| Tally stock valuation fallback | 2,05,856 | 52,417 |
| Internal source product standard | 6,381 | - |
| Total | 96,35,578 | 22,37,731 |

12.8% (Rs 15.19 L/month) of material value rests on stale, fallback or manual rates (CI-029). Rates are a single latest voucher price, not a weighted average, and exclude freight (CI-006). Tally purchase feed: 15,819 vouchers, latest 17 Oct 2026. The feed table is one of the 14 Tally tables any logged-in user can write (CI-001); it prices Rs 1.12 Cr/month of material.

## Labour chain (u3, u4, u5)
| Check | Run 122 | Run 128 |
|---|---|---|
| DL pool = manufacturing (7,06,203) + packing (6,63,449) = 13,69,652 | exact | exact |
| Sum of product manufacturing allocations = manufacturing pool | exact | exact |
| Product allocation = pool x workload / company workload | 0 mismatch | 0 |
| Route intensity = equipment-scaled step factors (AU-6L) | n/a (switch from 1 Oct) | 445/445 |
| Raw intensity = sum of frozen step factors | - | 0 mismatch |
| Workload = intensity x monthly qty / batch size (batch-true) | - | 0 mismatch |
| Product -> SKU manufacturing allocation gap | Rs 718.16 (5 products) | Rs 76.06 (5) = IMC transfer of manufacturing labour (G1 §conservation) |
| SKU DL = manufacturing + packing; per-unit = allocation / units | 0 mismatch | 0 |
| Packing = pool x package units / company units; 4 external-packed SKUs at 0 | exact | exact |
| Blocked products | 0 | 0 |

The batch-true "NORMAL_VOLUME_RATE" is pool / actual eligible workload, so absorption variance is 0 by construction (CI-031).

**Driver concentration (CI-032):** in run 128 the top 10 products carry 44% of manufacturing labour.
- Dhanyamlam (product 51): 13.2%, Rs 93,475/month, about Rs 81/L. Step factors 38.4/64/64 x 3 equipment loads.
- Thippili Rasayanam: 9.8% (x14.4 loads).
- Karkkidaka Kanji: 6.7%. Manual steps are scaled by 500 loads from a 25,000 kg unit-mass override.

The arithmetic is correct and the switch was approved (AU6-V2). Production needs to validate these drivers in G2.

## Golden traces (u4, run 128)
- **SKU 42, Dhanyamlam 2 L** (negative margin): RM Rs 51.16, of which water (manual Rs 10/L) is Rs 21.05 and Cheru Naranga Rs 17.86 (Tally voucher 6 Oct, Rs 250/kg). PM Rs 26.04; the HDPE can and label are stale 2024 rates. Manufacturing DL Rs 162.00 + packing Rs 2.64 gives prime Rs 241.84. Labour, not material, drives the negative margin (CI-032).
- **SKU 865, Kashaya Vasthi Kit 275 g:** RM Rs 35.29 (honey Rs 140/kg, 22 Sep), PM Rs 10.29, DL Rs 4.47, prime Rs 50.06.
- **SKU 878, Karkkidaka Kanji 500 g:** RM Rs 53.09 (19 lines, all current vouchers), PM Rs 18.98, DL Rs 12.15, prime Rs 84.22.

## Not covered here (owned elsewhere)
- HR/staff classification into labour pools: head-to-pool equality proven in G1. Role-to-class review is part of G3 drivers.
- Capacity values behind the equipment loads: G2.
