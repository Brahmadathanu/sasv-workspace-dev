# AU-6L: equipment-loads workload method (replaces the power-exponent AU-6A) and the Kanji sales-feed gap. READ-ONLY (2026-10-18)
Nothing was applied. The simulation ran on the local fixture `au6a_local`. Run 910 = AU-6Q (QC per batch) plus the kit/Kanji fix, without scaling. That baseline is the run-126 clone, and the loads layer is applied on top of it.

## 1. Method (practical, no time study)
- For each route step: **loads per batch = ceil(charge / rated capacity per load)** of the equipment class, with a minimum of 1.
- Fixed-cycle steps count **1 per batch**: GENERAL_AREA, STORAGE_OCCUPANCY, EXTERNAL_JOB_WORK.
- Workload per batch = Σ step factor × loads. The existing approved step factors are kept; batch_size_ref is the reference batch. Pool is fully absorbed. QC per batch and the kit/Kanji fix are unchanged.
- **Charge** has two bases:
  - SOLID steps (grinder, dryer, manual, tablet/capsule, mixing, calcination, furnace): Kg products use batch_size_ref kg. L/Nos products use the RM BOM kg lines scaled to batch_size_ref.
  - OUTPUT steps (processing vessel, extraction/cooker, filtration, fermentation): batch output in kg or L.
  - Kit 865 and Kanji 878 use pack mass (275 g / 500 g), because their BOMs are per gram.

## 2. Data coverage
| Data | Exists? | Coverage |
|---|---|---|
| Machine master `plant_machinery` (171) and `machine_types` (29) | yes | **no capacity column**. Capacity appears only inside names: Fermentation Tank 1500/3000 L, Water Tank 500/1000 L, Processing Vessel (100 L) |
| Route step → equipment (`plant_id`) | partly | family steps 131/1,668 (7.9%); overrides 54/1,155. Steps carry `resource_class_code` (100%), which is the usable link |
| BMR loads / charges | no | `bmr_details` holds batch size only. `daily_work_log.count_of_saravam` is empty |
| `daily_work_log` (21k rows, 8k with plant) | yes (not time) | vessels used per batch: SS Processing Vessel corr(batch, vessels) 0.77 (kg) / 0.86 (L); SS Cooker 0.90 (L). Single-vessel P90 = 220 kg / 500 L (vessel), 370 kg / 500 L (cooker). Grinder, pulveriser and sieve logs are 1 entry per batch at any size, so they give no capacity evidence |
| BOM charge mass | yes | 454/455 products (RM BOM) |

## 3. Capacities used (per load); PROVISIONAL rows need user values
| Class | Basis | kg | L | Source |
|---|---|---|---|---|
| GRINDER (grinder, pulveriser, disintegrator, sieve) | SOLID | 50 | | **PROVISIONAL** |
| DRYER_OR_OVEN | SOLID | 50 | | **PROVISIONAL** (24-tray × ~2 kg) |
| MANUAL (cleaning, washing, cutting, handling) | SOLID | 50 | | **PROVISIONAL** |
| TABLET_OR_CAPSULE_EQUIPMENT | SOLID | 50 | | **PROVISIONAL** |
| MIXING_EQUIPMENT | SOLID | 200 | | **PROVISIONAL** |
| CALCINATION / TRADITIONAL_FURNACE | SOLID | 25 | | **PROVISIONAL** (puta charge) |
| PROCESSING_VESSEL, FILTRATION | OUTPUT | 220 | 500 | evidence: log P90 single vessel |
| EXTRACTION_SYSTEM (cooker, juice press) | OUTPUT | 370 | 500 | evidence: log P90 single cooker |
| FERMENTATION_VESSEL | OUTPUT | | 3000 | evidence: tank names |
| GENERAL_AREA, STORAGE, EXTERNAL | FIXED | 1/batch | | |

**User to supply (short list):** kg per load for:
1. grinder or pulveriser
2. sieve / vibro-sifter
3. tray dryer and firewood dryer
4. manual cleaning/washing lot
5. granulator / tablet press / capsule filler / pill machine
6. planetary mixer
7. puta (calcination) charge

Also confirm the evidence-based vessel (220 kg / 500 L), cooker (370 kg / 500 L) and fermentation tank (3000 L) values. Optionally, give an "herb charge" exclusion list (e.g. jaggery/sugar/honey) for arishtam and lehyam solid steps.

## 4. Simulation on run 126 (capacities above; sensitivity capacities ×2 and ×0.5)
- Rates per load: POH 189.78; DL (mfg) 214.79.
- 250 of 447 products have more than 1 load on at least one step.

| Metric | Current (126) | Exponent AU-6A | Loads (×1) | Loads (×2 cap) | Loads (×0.5 cap) | AU-6Q+kit only |
|---|---|---|---|---|---|---|
| Negative-margin SKUs | 37 | 16 | **13** | 15 | 11 | 31 |
| Median COP ratio | | 0.985 | 0.955 | 0.967 | 0.953 | |
| < −25% / −25..−5 / ±5 / +5..25 / > +25% | | 74/136/326/90/3 | 89/216/243/81/**0** | 63/211/310/45/0 | 111/198/218/102/0 | |
### Key SKUs (COP per SKU; run 126 replay)
| SKU | Product | Pack | Batch | Charge kg/L | Loads/step (max) | Current | Exponent (AU-6A) | Loads (provisional) | AU-6Q+kit only | DL+POH cur → loads |
|---|---|---|---|---|---|---|---|---|---|---|
|111|Rasnadi Choornam|50g|79.8 Kg|79.8 / 79.8|2|31.29|42.68|30.48|32.03|7.31 → 6.36|
|637|Dhanwantharam Gulika|100Nos|200000.0 Nos|27.3 / 27.3|1|24.59|33.85|21.26|25.46|8.54 → 5.10|
|865|Kashaya Vasthi Kit|275g|160.0 Nos|44.0 / 44.0|1|3206.57|62.13|56.39|64.87|3152.47 → 7.40|
|876|Dahasanthi|20g|150.0 Kg|150.0 / 150.0|3|5.62|7.03|5.76|5.74|3.35 → 3.43|
|878|Karkkidaka Kanji|500g|50000.0 Nos|25000.0 / 25000.0|500|141.01|75.08|97.53|75.11|60.10 → 25.43|
|879|Mehasamani|20g|32.0 Kg|32.0 / 32.0|1|29.37|9.78|7.88|9.52|5.09 → 3.75|
|988|Thampira Chendooram|5g|50.0 Kg|50.0 / 50.0|2|91.78|29.23|24.78|31.51|12.34 → 6.87|
|1769|Chiruvilwadi Kvatha Choorn|200g|2.0 Kg|2.0 / 2.0|1|1097.18|323.11|398.08|660.64|356.79 → 141.88|
|1770|Gandharvahasthadi Kvatha C|200g|2.0 Kg|2.0 / 2.0|1|1070.22|296.16|371.13|633.69|356.79 → 141.88|
|1792|Abhraka Bhasmam|1000g|50.0 Kg|50.0 / 50.0|2|10439.66|8700.89|5905.43|10132.43|5922.33 → 2485.90|
|1797|Special Medicine 2|5g|50.0 Kg|50.0 / 50.0|2|23.40|23.11|22.70|23.31|3.73 → 3.23|

### Top 15 risers (loads vs current)
| SKU | Product | Pack | Batch | Charge | Current | Exponent | Loads | x |
|---|---|---|---|---|---|---|---|---|
|836|Kadaleekalpa Rasayanam|250g|800.0 Kg|800.0|72.02|80.23|87.18|1.211|
|837|Kadaleekalpa Rasayanam|400g|800.0 Kg|800.0|123.45|136.58|147.71|1.197|
|835|Kadaleekalpa Rasayanam|100g|800.0 Kg|800.0|34.71|37.99|40.77|1.175|
|805|Chyavanaprasam|400g|750.0 Kg|750.0|112.53|122.16|130.66|1.161|
|1221|Thippili Rasayanam|250g|770.0 Kg|770.0|89.86|93.10|101.58|1.130|
|794|Agasthya Rasayanam|250g|370.0 Kg|370.0|51.07|54.65|57.39|1.124|
|791|Sathavari Gulam|250g|708.0 Kg|708.0|65.67|70.53|73.69|1.122|
|795|Agasthya Rasayanam|400g|370.0 Kg|370.0|83.59|89.32|93.70|1.121|
|792|Sathavari Gulam|400g|708.0 Kg|708.0|107.19|114.97|120.01|1.120|
|43|Dhanyamlam|5000mL|1155.0 L|122.9|1036.30|950.07|1155.78|1.115|
|42|Dhanyamlam|2000mL|1155.0 L|122.9|421.37|386.88|469.16|1.113|
|2|Amritharishtam|450mL|3000.0 L|1281.3|31.00|31.37|34.48|1.112|
|537|Pinda Thailam|5000mL|480.0 Kg|480.0|1360.69|1352.62|1512.68|1.112|
|1220|Thippili Rasayanam|100g|770.0 Kg|770.0|42.18|43.48|46.87|1.111|
|14|Jeerakarishtam|450mL|3000.0 L|1264.3|34.02|34.46|37.57|1.105|

### Top 15 fallers (loads vs current)
| SKU | Product | Pack | Batch | Charge | Current | Exponent | Loads | x |
|---|---|---|---|---|---|---|---|---|
|865|Kashaya Vasthi Kit|275g|160.0 Nos|44.0|3206.57|62.13|56.39|0.018|
|1257|Meghanada Gulikai|20Nos|40000.0 Nos|24.0|74.35|21.23|18.65|0.251|
|879|Mehasamani|20g|32.0 Kg|32.0|29.37|9.78|7.88|0.268|
|988|Thampira Chendooram|5g|50.0 Kg|50.0|91.78|29.23|24.78|0.270|
|1286|Kalnaar Parpam|5g|50.0 Kg|50.0|36.91|11.99|10.35|0.280|
|1123|Meni Thailam|100mL|15.0 Kg|15.0|194.36|54.02|55.39|0.285|
|943|Annabhedi Chendooram 2|5g|25.0 Kg|25.0|42.24|13.80|12.79|0.303|
|362|Balamritham Aavanakkenna|10mL|30.0 Kg|30.0|33.20|10.42|10.06|0.303|
|1273|Gunmakudori Mezhuku|10g|30.0 Kg|30.0|42.49|14.05|13.17|0.310|
|1056|Meni Choornam|50g|14.0 Kg|14.0|87.48|32.94|28.49|0.326|
|158|Nimbasahacharadi Choornam|100g|24.0 Kg|24.0|84.41|37.29|28.06|0.332|
|1141|Vranasanjeevi Thailam|50mL|4.9 Kg|4.9|204.91|109.89|68.33|0.333|
|1770|Gandharvahasthadi Kvatha C|200g|2.0 Kg|2.0|1070.22|296.16|371.13|0.347|
|1274|Idivalladi Mezhuku|10g|15.0 Kg|15.0|56.00|20.92|20.07|0.358|
|1769|Chiruvilwadi Kvatha Choorn|200g|2.0 Kg|2.0|1097.18|323.11|398.08|0.363|

**Reading the results**
- Small batches (Kvatha 2 kg) still pay one full load per step: DL+POH per 200 g goes from 356.79 to 141.88. Under the exponent version it fell further (66.91), which is less physical.
- Large-batch, small-charge items no longer rise: Dhanwantharam Gulika 200,000 Nos = 27 kg = 1 load, COP 24.59 → 21.26 (exponent +38%).
- Risers are now heavy-charge products (Kadaleekalpa 800 kg, Chyavanaprasam 750 kg, arishtams 3000 L), capped at +21%.
- Kanji: 50,000 packs = 25 t = 500 loads per solid step. COP 141.01 → 97.53, against 75.11 without loads.
- Abhraka: 2 loads (50 kg / 25 kg puta). COP 10,440 → 5,905.

## 5. Kanji sales gap (SKU 878)
| Source | Object | Measure | Window | SKU 878 |
|---|---|---|---|---|
| Sales viewer (`public/shared/js/sales-viewer.js`) | `public.v_sdv_sales_enriched` ← `app_private.sales_monthly` | `qty_billed` (default metric) | last 12 months including the current month (Nov-25..Oct-26) | **53,256** |
| Costing (`costing.v_sku_sales_volume_allocation_basis` → `sku_sales_allocation_basis_snapshot`) | `public.v_sales_monthly_clean` ← same `app_private.sales_monthly` | `qty_units` after an **IQR outlier fence per SKU × region × godown over 36 months** | Oct-25..Sep-26 | **1,384** (raw qty_units 58,820) |

- **Cause:** the IQR fence treats the seasonal peak months as outliers and sets them to NULL. Raw / cleaned: Jun-26 28,444 → 894; Jul-26 30,838 → 226. The return months are negative, so they are also nulled.
- SKU mapping, item code and unit are the same in both sources. qty_units includes free goods (58,820 vs billed 52,979).
- Monthly driver: costing uses 894 (max cleaned month); the raw max is 30,838.
- **This resolves the earlier Kanji flag.** About 59k packs sold in 12 months against 59,286 packs transferred in 2026, which confirms 50,000 = packs per batch.
- **Other SKUs (run 126 basis, 569 SKUs):**
  - 119 lose more than 10% of 12-month units; 10 lose more than 50%; 21 have the max month understated by more than 2×.
  - ₹1.62 cr of ₹19.59 cr 12-month value falls outside the cleaned units.
  - By value: 878 (₹0.88 cr gap), Thippili Rasayanam 1220 (₹10.3 L), Naadi Kashayam 746, Mathulai Manappagu 1244, Mahanarayana/Sahacharadi Pizhichil 282/548, Marma Kashayam 776, Kadaleekalpa 837, Karpooradi 315.
  - More than 2× understated: 878, 746, 564, 555, 388, 1098, 553, 329, 955, 1008, 1144, 526, 1053, 1279, 988, 1102, 1012, 1280, 51, 1056, 800, 1261, 1065.
- **Proposed fix (not built or applied):**
  1. Give costing its own sales source and leave `v_sales_monthly_clean` unchanged; forecasting `v_fill_inputs` also uses it. The new source would be company-wide monthly net `qty_units` from `app_private.sales_monthly`, with negative months floored to 0 and no per-godown IQR. An error guard would act only on a data-quality flag. Effective 2026-10-01, own switch; Sep unchanged.
  2. **User decision needed:** for seasonal SKUs, the driver policy "max month" (Kanji 30,838) vs 12-month average (4,902).
     - With loads and max-month, Kanji would take about 35% of mfg POH/DL (others ×0.65).
     - With the 12-month average, about 8%.
