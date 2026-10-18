# AU-6 combined package v2: build and local replay (2026-10-18)

Status: **BUILT AND TESTED LOCALLY ONLY. Nothing applied live.** No migrations, cron changes, Sheets edits or merges.
Package: `proposals/au6_combined/PREPARED_au6_combined_v2_package.sql` (outside `supabase/migrations`). It replaces v1. The AU-6A exponent is removed.
Scripts and outputs: `evidence/AU6L/v2/`.

## 1. Contents
| Section | What | Switch / effective date |
|---|---|---|
| A | AU-6Q per-batch QC (unchanged from v1) | `qc_batch_true_switch` |
| B | K1+K4 kit/Kanji unit fix: 865 = 1 kit (275 g), 878 = 1 kit (500 g) | exception rows, costing_effective_from 2026-10-01 |
| C | AU-6L equipment-loads route scaling (DL component split + POH writers) | `route_load_scaling_switch`, from 2026-10-01 |
| D | SALES-01 costing-only sales feed + seasonal 12-month average (sales basis writer) | `costing_sales_feed_switch`, from 2026-10-01, threshold 0.60 |

A global guard aborts the whole package unless the 4 live writer md5s match (POH 6514…, DL 5b77…, QC 7a59…, sales 73ea…). All 4 still match live as of 2026-10-18.
Post-checks: Sep gates closed, every labour/POH resource class has an effective capacity row, and run 122 is not touched.

## 2. Loads method (as designed in AU6L_LOADS_METHOD_AND_SALES_GAP)
- Weight-driven step: loads = ceil(batch charge / capacity per load), minimum 1. Fixed step: 1 per batch.
- Existing step weights, batch_size_ref, full pool absorbed.
- The route factor is weighted by loads. Batches still come from ceil(demand / batch).
- Charge: SOLID steps use the batch size for Kg products, or BOM kg lines × bs/ref for L/Nos products. OUTPUT steps (vessel, cooker, filtration, fermentation) use the batch output (Kg/L), or for Nos products the BOM kg+L.
- Unit-mass override: 685 kit 0.275 kg, 695 Kanji 0.5 kg.
- Unmapped resource class → the writer raises an error (fail-closed). The DL and POH charges must agree, or the run raises.
- Lineage: `costing.route_load_scaling_snapshot` (per product/pool: charge, raw vs scaled factor, step detail), with AU-2 guards.

Capacity config `costing.route_equipment_load_capacity`: editable, effective-dated, one row per class, all **PROVISIONAL**, each with a source note.
| Equipment class | Resource class | Basis | Capacity |
|---|---|---|---|
| Grinder/pulveriser (default), sieve | GRINDER | solid | 50 kg |
| Tray dryer (default), firewood dryer | DRYER_OR_OVEN | solid | 50 kg |
| Manual cleaning/washing lot | MANUAL | solid | 50 kg |
| Tablet/capsule/pill | TABLET_OR_CAPSULE_EQUIPMENT | solid | 50 kg |
| Planetary mixer | MIXING_EQUIPMENT | solid | 200 kg |
| Puta (also traditional furnace) | CALCINATION / TRADITIONAL_FURNACE | solid | 25 kg |
| Vessel (also filtration) | PROCESSING_VESSEL / FILTRATION_SYSTEM | output | 220 kg / 500 L |
| Cooker | EXTRACTION_SYSTEM | output | 370 kg / 500 L |
| Fermentation tank | FERMENTATION_VESSEL | output | 3,000 L |
| General area, storage, external job work | | fixed | 1 per batch |

## 3. Sales feed (SALES-01) and seasonal rule
- **How the driver picks today:** `fn_sales_monthly_clean_as_of` takes 36 months and applies an IQR fence per SKU × region × godown, which nulls negatives and outliers. It sums company-wide per SKU-month, then takes the **max positive month in the 12-month lookback** for every SKU with actuals. Seasonal peaks are often removed as outliers (Kanji: peak 894 vs actual 30,838).
- **New, costing only:** `costing.fn_costing_sales_monthly_as_of` uses company-wide net units per SKU-month with negatives set to 0 and no per-godown filter. The driver is still the max month, except for **seasonal SKUs**, which use the **12-month average**.
- Seasonal test: the top 3 months are ≥ 60% of 12-month volume. The threshold is set in the switch row.
- `v_sales_monthly_clean` and forecasting are untouched. September and earlier periods keep the old path (tested).

| Driver (Oct replay, 629 SKUs) | SKUs | Same as run 126 | Up | Down |
|---|---|---|---|---|
| Max month, new net feed | 468 | 335 | 130 | 3 |
| **Seasonal 12-month average** | **101** | 0 | 1 (Kanji) | 100 |
| Defaults / new-product plan | 60 | 57 | 1 | 2 |

So the seasonal rule changes the driver for **101 SKUs** (28 of them with 10+ units/month). The new feed moves another 133 non-seasonal SKUs, mostly up because peaks are no longer cut. Kanji: 894 → 4,944 kits/month (59,323 a year ÷ 12).

## 4. Local replay (copy of run 126, fresh DB with live-identical writers)
| Test | Result |
|---|---|
| Package applies in one transaction | PASS |
| All switches OFF (run 931) = live run 126: sales basis 629/629 identical; SKU DL/POH/QC | PASS, max diff 1e-13 |
| Full ON (run 933): DL, POH and QC pools fully absorbed | PASS, variance 0.000000000 (706,203 / 670,935.04 / 142,241.67) |
| Loads lineage: 447 DL + 455 POH products, 250 scaled; DL/POH charge mismatch | PASS, 0 mismatches |
| Rerun determinism (934 = 933) | PASS, diff 0 |
| Run 122 (APPROVED) write into new lineage | PASS, blocked AU2_DESIGNATED_RUN_IMMUTABLE |
| Sep gates (loads, sales) closed; Oct open | PASS |
| Sep-period sales writer → old cleaned-max path | PASS (568 cleaned-max + 61 defaults) |
| Pre-Oct effective_from on capacity / switches | PASS, rejected |
| Terminal-run lineage delete/update; truncate | PASS, blocked |
| Unmapped resource class (GRINDER row removed) | PASS, chain raises (fail-closed) |

Absorption rates per batch-true unit:
| | DL | POH | QC |
|---|---|---|---|
| run 126 | 561.36 | 467.16 | n/a |
| AU-6Q + kit + loads | 214.79 | 189.78 | 127.72 |
| Full v2 | 182.83 | 160.80 | 126.90 |

Total SKU cost, run 126 vs v2 (₹/unit). "Loads only" means v2 with the old sales feed.
| SKU | Product | Pack | Batch | Run 126 | Loads only | **Full v2** | Mfg DL+POH 126 → v2 |
|---|---|---|---|---|---|---|---|
| 1769 | Chiruvilwadi Kvatha | 200g | 2 kg | 1,097.18 | 398.08 | **375.83** | 356.79 → 120.72 |
| 1770 | Gandharvahasthadi Kvatha | 200g | 2 kg | 1,070.22 | 371.13 | **348.88** | 356.79 → 120.72 |
| 876 | Dahasanthi | 20g | 150 kg | 5.62 | 5.76 | **5.44** | 3.35 → 3.12 |
| 637 | Dhanwantharam Gulika | 100 Nos | 200,000 Nos | 24.59 | 21.26 | **20.69** | 8.54 → 4.54 |
| 111 | Rasnadi Choornam | 50g | 79.8 kg | 31.29 | 30.48 | **29.72** | 7.31 → 5.60 |
| 1792 | Abhraka Bhasmam | 1000g | 50 kg | 10,439.66 | 5,905.43 | **5,531.96** | 5,922.33 → 2,112.57 |
| 879 | Mehasamani | 20g | 32 kg | 29.37 | 7.88 | **7.51** | 5.09 → 3.38 |
| 988 | Thampira Chendooram | 5g | 50 kg | 91.78 | 24.78 | **23.95** | 12.34 → 6.03 |
| 1797 | Special Medicine 2 | 5g | 50 kg | 23.40 | 22.70 | **22.42** | 3.73 → 2.94 |
| 865 | Kashaya Vasthi Kit | 1 kit | 160 kits | 3,206.57 | 56.39 | **55.45** | 3,152.47 → 6.48 |
| 878 | Karkkidaka Kanji | 1 kit | 50,000 kits (25 t) | 141.01 | 97.53 | **93.90** | 60.10 → 21.80 |

(Mehasamani and Thampira fall mostly because QC per batch replaces QC per test: 20.55 → 0.40 and 61.64 → 0.11.)

- **Kanji share of mfg labour + overhead:** run 126 3.71%. Loads with the old feed 1.46%. **Full v2 6.88%** (₹47.0k DL + ₹47.7k POH of ₹13.77 lakh). Margin per kit 98.5 → 145.6.
- **Negative-margin SKUs:** 37 (run 126) → 13 (loads only) → **11 (full v2)**. Remaining: Linga Chendooram 1000g (975), Dhanyamlam 5000/2000 mL, Kvatha 1769/1770, Vasanthakusumakaram 20 Nos, Vaattu Kashayam 450 mL, Ksheerabala Thailam 10 mL, Sameerananivarani 100g, Mandooradi Kudineer 50g, Vathasani 100g.
- **Distribution (629 SKUs):** below −25%: 104. −25 to −5%: 242. ±5%: 247. +5 to +25%: 36. Above +25%: 0. Median 0.94.
  Most SKUs fall because the uncut sales feed spreads the same fixed pools over more units.
- **Biggest risers** (large-batch output-vessel products whose loads now count): Kadaleekalpa Rasayanam 250g +16.5% (72.02 → 83.93), 400g +15.6%, 100g +13.3%; Chyavanaprasam 400g +12.7%; Thippili Rasayanam 250g +10.5%; Sathavari Gulam +9.4%; Agasthya Rasayanam +8.7%; Pinda Thailam 5 L +8.4%; Amritharishtam 450 mL +8.0%.
- **Biggest fallers:** kit 865 −98%, Meghanada Gulikai −76%, Mehasamani −74%, Thampira −74%, Kalnaar Parpam −73%, Meni Thailam −73%, Balamritham Aavanakkenna −71%, Annabhedi Chendooram −71%, Kvatha 1769/1770 −66%.
- Full lists: `v2/replay_per_sku_run126_vs_v2.csv`, `v2/sales_basis_run126_vs_v2.csv`.

## 5. Run 122 is unaffected
- Live read-only check at 2026-10-18 ~09:45 IST: run 122 is SUCCESS/APPROVED, period 2026-09-01; 634 rows each for basis, DL, POH and QC.
  Fingerprints: basis 1231e9ed…, DL 134720df…, POH 5b080b54…, QC 9347d227…
- The new tables do not exist live, and the sales writer md5 is still 73eaacaa…
- Package design: every new path is gated by valuation/period ≥ 2026-10-01 plus its switch. The AU-2 designated-run guard blocks writes to run 122. Post-checks assert the Sep gates are closed.

## 6. Limitations of the replay
- Internal (intermediate) demand is held at run-126 values. Only commercial demand is restated from the new sales basis.
- Stores/packing cost per SKU is held at run 126, scaled only for the kit/Kanji unit change.
- Preview/read-only functions are not loads-scaled.
- Approval references hold `<DATE>` placeholders (22). They must be filled before applying.
- Capacities are provisional, and the seasonal threshold of 0.60 is a judgement call.
- The local fixture lacks the live guards on the sales basis table. Live has them.

## 7. To go live (not done)
1. User approval.
2. Notify Jarvis.
3. Fingerprint run 122.
4. Apply via Supabase MCP `apply_migration` only, with placeholders filled.
5. Fingerprint run 122 again.
6. Run a fresh October refresh (cron 60 stays paused; job 61 only for an approved window).
7. Review the results, then decide on the October run.
