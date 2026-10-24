# AU-6S: small-batch workload and kit unit-mismatch RCA (read-only), 2026-10-18
> **Status 18 Oct 2026:**
> - Batch-size scaling options A/B (exponent) are SUPERSEDED by equipment loads (AU6L).
> - Kit K1+K4 is LIVE (20261018044644).
> - The Kanji 878 batch is confirmed at 50,000 packs.


All figures come from live run 126 (Oct 2026, SUCCESS; not approved or locked). No live writes were made.
Everything below is a proposal and has NOT been applied.
Rates: POH ₹467.157 per workload unit, DL ₹561.360. Pools: POH 670,935.04, DL 706,203, QC 142,241.67.

## 1. Kvatha Choornams (products 468 and 1340)

### Root cause
- Route family 14 has 21 products, median batch 20 kg (range 2–150 kg). The route has 7 steps: route_factor 3.25, DL intensity 3.6.
  - Step factors: RM_WASHING 0.25, RM_DRYING (DRYER) 1, DISINTEGRATION (GRINDER) 1, PULVERIZATION (GRINDER) 1. Issue, QC and transfer steps are 0.
- Step factors are **per batch, independent of batch mass**. Per-unit cost = rate × factor / batch_size, so a 2 kg batch is charged the full washing/drying/grinding workload of a 150 kg batch. Physically, grinding and washing time scale roughly with mass; only setup, cleaning and the drying cycle are fixed.
- QC (live) is a fixed ₹ amount per product per month divided by monthly qty (0.167 kg/month, one batch a year), so it also explodes. AU-6Q (per-batch QC, prepared) charges QC per batch. That part is a genuine small-batch cost: the tests are the same for 2 kg as for 150 kg.

| Product | Batch kg | DL+POH ₹/kg | Pack | COP | COP ₹/kg |
|---|---|---|---|---|---|
| 468 Gandharvahasthadi Kvatha | 2 | 1,769.58 | 200 g (1770) | 1,070.22 | 5,351 |
| 1340 Chiruvilwadi Kvatha | 2 | 1,769.58 | 200 g (1769) | 1,097.18 | 5,486 |
| 176 Neelolpaladi Kashaya Ch. | 30 | ~118 | 100 g (167) | 110.72 | 1,107 |
| 1050 Panchathikthaka Kashaya Ch. | 15 | ~236 | 100 g (1351) | 91.59 | 916 |
| 1350 Mahamanjishtadi Kashaya Ch. | 35 | ~101 | 100 g (1798) | 128.28 | 1,283 |

Other Kvatha Choornams (456–499, 1170): all are Inactive or have no batch/route (not costed). 460 AYUSH Kvatha, 454/455 Instant and 171/174/939 are Active but carry no costed batch.

### All small-batch outliers (batch ≤ 25% of route-family median, family n ≥ 3), 32 products
| P | Product | UOM | Batch | Fam med (n) | Ratio | DL+POH ₹/unit |
|---|---|---|---|---|---|---|
| 468 | Gandharvahasthadi Kvatha Choornam | Kg | 2 | 20 (21) | 0.1 | 1769.58 |
| 1340 | Chiruvilwadi Kvatha Choornam | Kg | 2 | 20 (21) | 0.1 | 1769.58 |
| 1043 | Serankottai Ney | Kg | 5 | 30 (4) | 0.167 | 1294.87 |
| 664 | Thamboola Rasayanam | Kg | 10 | 120 (7) | 0.083 | 760.16 |
| 648 | Mridweekadi Lehyam | Kg | 10 | 145 (13) | 0.069 | 737.71 |
| 274 | Siddha Thailam | Kg | 10 | 60 (38) | 0.167 | 692.35 |
| 314 | Sonithamritha Keram | Kg | 10 | 60 (38) | 0.167 | 692.35 |
| 1342 | Arkkadi Thailam | Kg | 10 | 105 (32) | 0.095 | 669.89 |
| 1061 | Vaattu Kashayam | L | 10 | 500 (49) | 0.02 | 544.59 |
| 1040 | Venkara Podi | Kg | 4 | 50 (11) | 0.08 | 514.26 |
| 872 | Chithramoola Thailam | Kg | 10 | 90 (6) | 0.111 | 486.64 |
| 312 | Seethala Thailam | Kg | 15 | 60 (38) | 0.25 | 461.56 |
| 890 | Meni Thailam | Kg | 15 | 60 (38) | 0.25 | 461.56 |
| 307 | Palandava Keram | Kg | 15 | 60 (38) | 0.25 | 461.56 |
| 310 | Thanurakshakan (External) | Kg | 15 | 60 (38) | 0.25 | 461.56 |
| 284 | Siddha Balapeeyoosham | Kg | 15 | 60 (38) | 0.25 | 461.56 |
| 239 | Nagaradi Thailam | Kg | 15 | 105 (32) | 0.143 | 446.59 |
| 267 | Mahavathanthaka Thailam | Kg | 30 | 240 (15) | 0.125 | 257.58 |
| 286 | Vellaruku Thailam | Kg | 30 | 240 (15) | 0.125 | 257.58 |
| 252 | Triphaladi Enna | Kg | 30 | 240 (15) | 0.125 | 257.58 |
| 675 | Manjishtadi Lepam | Kg | 36 | 250 (3) | 0.144 | 227.25 |
| 956 | Thetrankottai Lehyam | Kg | 50 | 220 (9) | 0.227 | 200.27 |
| 510 | Gandharvahasthadi Kashayam (Conc.) | L | 30 | 500 (49) | 0.06 | 181.53 |
| 188 | Asanamanjishtadi Enna | Kg | 60 | 240 (15) | 0.25 | 128.79 |
| 320 | Mahapinda Thailam | Kg | 60 | 300 (8) | 0.2 | 128.79 |
| 921 | Nilavembu Kudineer | L | 67.5 | 500 (49) | 0.135 | 80.68 |
| 315 | Chinchadi Kuzhambu | Kg | 120 | 505 (4) | 0.238 | 72.97 |
| 920 | Kaphasura Kudineer | L | 100 | 500 (49) | 0.2 | 54.46 |
| 449 | Vimalavarthi | Nos | 4800 | 48000 (15) | 0.1 | 2.14 |
| 748 | M3 Capsule | Nos | 15000 | 100000 (12) | 0.15 | 1.17 |
| 753 | Neerkovai Tablet | Nos | 10000 | 50000 (10) | 0.2 | 0.98 |
| 741 | Balavardhini Capsule | Nos | 25000 | 100000 (12) | 0.25 | 0.49 |
### Proposed fix: batch-size-scaled step workload (within policy)
f′ = f × (bs / ref_bs)^b, where ref_bs is the route-family median within the same base UOM and the exponent b depends on resource class:
- GRINDER 0.8; TABLET/CAPSULE 0.9; MANUAL 0.7; FILTRATION 0.7; MIXING 0.6
- VESSEL, EXTRACTION, DRYER 0.5; FERMENTATION 0.4; CALCINATION, FURNACE, STORAGE 0.3
- GENERAL_AREA and EXTERNAL 0

batch_size_ref stays the reference. There is no time spreading. Full absorption is kept: the rate is re-derived. QC is not scaled.
File: `proposals/au6s_small_batch_and_kit/PROPOSED_au6s_route_batch_scaling.sql` (config DDL only; the writer hook still has to be built and tested like AU-6Q).

| Run-126 simulation | Option A symmetric | Option B small-batch only (recommended) |
|---|---|---|
| POH rate | 467.16 → 381.8 | 467.16 → 512.0 |
| DL rate | 561.36 → 450.2 | 561.36 → 617.6 |
| Kvatha DL+POH ₹/kg | 1,770 → 289 | 1,770 → 393 |
| Kvatha 200 g COP (1769) | 1,097 → 801 | 1,097 → 822 |
| Abhraka (1792) | 10,440 → 9,297 | 10,440 → 11,025 |
| SKU COP: < −25% / −25..−5% / ±5% / +5..25% / > +25% | 31 / 131 / 395 / 62 / 2 | 19 / 78 / 517 / 7 / 0 |

Option A also makes large batches heavier (for example Dahasanthi 23.6 → 82.4 ₹/kg), which is a big redistribution. Option B relieves only the small batches, and everyone else rises by about 9–10%.

## 2. SKU 865 Kashaya Vasthi Kit (product 685): end-to-end trace

| Stage | Today | Correct | Wrong? |
|---|---|---|---|
| Product master | base Nos, conversion_to_base 1 | 1 kit = 1 Nos | OK |
| SKU master | pack 275, uom g | 275 g is a description | OK as a description |
| Governed exception | 865 → 1 Nos (approved 2026-10-15) | used by the writers | **ignored by run writers**; only the preview functions use it |
| Base qty per SKU (`v_sku_sales_volume_allocation_basis`) | 275 × 1 = **275 "Nos"** | 1 | **WRONG** |
| Sales basis (12 months) | 129 kits → 35,475 "Nos" | 129 | **WRONG** |
| Monthly base qty (basis snapshot) | 9,900 "Nos" | 36 | **WRONG** |
| Batch ref 514 | 160 Nos (kits) | 160 kits | OK |
| Batch equivalents/month | 9,900 / 160 = **61.9** | 0.225 | **WRONG** (×275) |
| POH workload share | 8.62% of pool | ~0.03% | **WRONG** |
| DL workload share | 7.87% (₹55,575/month) | ~0.03% | **WRONG** |
| QC (Method-3 / AU-6Q per batch) | uses the same monthly qty | follows the fix | **WRONG** (inherits it) |
| Per-SKU conversion | per-base cost × 275 | × 1 | Wrong, though it partly self-cancels because monthly qty is inflated by the same factor; the rate is distorted for everyone |
| BOM 2627 | output 287 "Nos", loss 4%; lines total 0.286 kg (grams of one kit) | 1 Nos, loss 0 | **WRONG semantics** |
| Material per SKU | lines/(287 × 0.96) × 275 = 0.998 × lines | lines | Accidentally right (errors cancel) |
| COP / pricing | COP 3,206.57 (DL 1,546.62, POH 1,605.85); MRP IK 140; margin −3,076 | ~₹70 | **WRONG** |
| Inventory / MRP (`public.v_sku_to_base_multiplier`) | NULL (no g→Nos conversion) | 1 | **WRONG** (dropped from base-qty stock views) |
| Sep run 122 | same error, k = 275 | n/a | must not be changed (immutable) |

The same pattern applies to **SKU 878 Karkkidaka Kanji** (product 695):
- k = 500 and monthly 447,000 "Nos", against a batch ref of 50,000 "Nos" (min 30,000, unverified). That is 8.94 batch equivalents and 3.7% of POH/DL (₹26,097 DL/month). COP 141.01, MRP 250.
- BOM 2686 is "500 Nos" with lines of 0.5 kg. Batch 50,000 is most likely grams (100 packs). If so, batch equivalents stay at 8.94 after correction.

### Other unit-mismatched SKUs (pack unit ≠ base unit)
| Dimension | SKUs (active) | Verdict |
|---|---|---|
| g → Nos | 4 (2 active: 865, 878) | the kit/Kanji pattern; inactive 885 Moringa and 1790 Kanji 1000 g are similar |
| mL → Kg | 555 (249) | cf 0.00091 is the oil-density convention, legitimate (551 SKUs). Exceptions: 859 Ilaneer 0.000714, 1277 Palthulli 0.000704 (AU-2c governed), 1076 Anda Thailam 0.00108 (check), inactive 1248 at 0.001 |
| g → Kg | 943 (216) | cf 0.001. Inactive 635 has 0.00091 (wrong, but inactive) |
| mL → L, Nos → Nos | 291 | OK |

Full list: `uom_mismatch.json`.

### Proposed corrections (`PROPOSED_au6s_kit_unit_correction.sql`, rollback-terminated)
- **K1:** add `costing_effective_from` to the exception table, set 865 = 2026-10-01, and make `v_sku_sales_volume_allocation_basis` honour the exception from that period.
  - Read-only live test: of 3,774 rows, exactly 1 changes (865, Oct: k 275 → 1, 12-month base 35,475 → 129). Sep and earlier periods are byte-identical.
- **K4:** `v_sku_to_base_multiplier` honours the exception. Only 865 and 878 change, from NULL to 1.
- **K2 (optional, separate):** BOM 2627 → 1 Nos with loss 0 (kit +0.19% material); BOM 2686 → 1 Nos.
  - Apply only together with switching the material writers to the exception-aware base qty.
  - Done by SQL only, because the BOM UI has the Apply/Save bug.
- **K3 (prerequisite for 878):** confirm the Kanji batch, then supersede batch ref 50,000 → 100 Nos and activate 878 in the same transaction.

| Run-126 simulation (`sim_kit126.sql`) | Kit only (K1; Kanji batch confirmed as 100 packs) | Kit + Kanji with 50,000 Nos (NOT advised) |
|---|---|---|
| POH rate | 467.16 → 511.0 | → 532.8 |
| DL rate | 561.36 → 609.1 | → 634.5 |
| 865 kit COP | 3,206.57 → 69.46 | → 69.98 |
| 878 Kanji COP | 141.01 → 146.13 | → 83.92 (wrong collapse) |
| Mehasamani 879 / 988 / 1797 | 29.37 → 29.57 / 91.78 → 92.61 / 23.40 → 23.47 | slightly higher |
| SKUs > +5% / < −5% | 9 / 1 | 39 / 2 |
| Negative-margin SKUs (37 today) | 39 | 43 |

Interaction: the kit fix (about +9% on rates) and the small-batch fix (Option B, about +9–10%) both raise the rates for everyone else. They should be simulated together before approval.

## Notes
- The scaling and kit simulations are read-only CTEs over run 126 snapshots: `sim_scaling126.sql`, `sim_scaling126_optB.sql`, `sim_kit126.sql`, `outliers126.sql`, `test_basis_view_k1*.sql`.
- One read-only comparison query (a SELECT over the proposed multiplier view body) was blocked by Auto-review and was not escalated. It was replaced by a direct read showing that only 865 and 878 have exceptions and both are NULL today.
