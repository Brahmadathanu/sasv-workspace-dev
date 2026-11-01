# AU-6 combined package: AU-6A universal route batch scaling + AU-6Q QC per batch + kit/Kanji base quantity. BUILT and TESTED, NOT APPLIED (2026-10-18)
> **SUPERSEDED in part (18 Oct 09:06 IST):**
> - The user rejected the power-exponent route scaling (AU-6A) described here, and it was never applied. It was replaced by the equipment-loads method (evidence/AU6L).
> - The QC-per-batch and kit/Kanji parts went live in combined v2 (migration 20261018044644).


User decisions (2026-10-18 08:34 IST):
- (1) Universal Option A: route scaling.
- (2) Kit fix K1 + K4 approved; K2 only if needed.
- (3) Kanji follows the same pattern.

Scope of approval: **build and test only**. Nothing has been applied live.

Package: `archive/PREPARED_au6_combined_package.sql`. It is a single migration (A AU-6Q → B kit → C AU-6A) and is kept out of `supabase/migrations`.

## Design (C. AU-6A)
- In the insert path of the Manufacturing-Labour and Production-Overhead writers, each step factor becomes step factor × (batch_size_ref / route-family median batch in the same base UOM)^b(resource class).
  - The reference batch is the median `batch_size_ref` of all products in the route family for that run.
  - b by resource class:
    - Weight-driven: TABLET/CAPSULE 0.9, GRINDER 0.8, MANUAL 0.7, FILTRATION 0.7
    - Partly weight-driven: MIXING 0.6, VESSEL / EXTRACTION / DRYER 0.5, FERMENTATION 0.4, CALCINATION / FURNACE / STORAGE 0.3
    - Fixed-cycle: GENERAL_AREA 0, EXTERNAL_JOB_WORK 0
  - QC is not scaled.
- The snapshot `route_factor` and `direct_labour_route_intensity` carry the **scaled** value, so workload = batch equivalents × factor still reconciles.
  - Raw factor, reference batch and per-step scale are frozen per run in `costing.route_batch_scaling_snapshot`.
  - That table carries the AU-2 designated-run, mutable-run and truncate guards.
- Gate: `costing.route_batch_scaling_switch` (own switch, SYMMETRIC). It opens only when AU-5 batch-true is also effective and valuation ≥ 2026-10-01.
  - Sep run 122 (valuation 09-10, APPROVED) can never take the new path.
- Full absorption: the rate is re-derived from the full pool. The AU-6 default-volume cap still applies after scaling (it did not bind: default share 0.47%).
- Fail-closed when a step resource class has no exponent.
- Production Overhead refuses to proceed if Manufacturing Labour used a different reference batch for any product.
- B. Kit: K1 and K4 as tested in AU-6S.
  - `costing_effective_from` = 2026-10-01 for 865 **and 878**.
  - Kanji batch ref 311 (50,000 Nos) is kept; the reason is in the Kanji section below.
  - K2 (BOM to 1 Nos) is **not needed**. The material writers keep pack × conversion (275 / 500) against the per-gram BOM, which is numerically right; changing the BOM alone would multiply kit material by 275.
- A. AU-6Q is unchanged. Its base definition still equals live (diff clean).

## Kanji (SKU 878): what 50,000 means
| Evidence | Value |
|---|---|
| Batch ref 311 | preferred 50,000, min 30,000, max 50,000 "Nos", effective 2025-10-24 |
| BMR | SP718 50,000 Nos (2025-07), SP838 40,000 (2026-05), SP839 20,000 (2026-05) |
| FG transfers (Tally) | SP718 → **50,052 × 500 g Pkt**; SP838 → 40,366 Pkt (500 g) + 108 Pkt (1 kg); SP839 → 18,920 Pkt |
| BOM 2686 | "500 Nos" output, lines 0.5 kg in total, i.e. the per-gram recipe of one 500 g pack |

**Conclusion:** 50,000 is the number of packs (kits) per batch, about 25 t of product. The batch ref stays at 50,000.

**Open question (FLAG):** the SKU 878 sales feed (`v_sales_monthly_clean`) shows only 1,384 units in the last 12 months (maximum month 894, Jun 2026) against 59,286 packs transferred in 2026. In 2025 it was 7,702 sales against 50,052 packs. Possible causes: unsold or seasonal stock, a sales-unit difference (cases?), or a gap in the sales mapping. Ask the user.

Also inactive SKU 1790 (1 kg): FG transfer of 108 Pkt is valued as 108,000 "Nos". Same pattern, but inactive.

## Tests
**Local PG17**: live-identical writers, triggers and guards; run-126 fixture captured read-only. Output in `local_test_output.txt` and `pkg_test_out.txt`.

| Test | Result |
|---|---|
| T1 package switches OFF vs live run 126 | POH/DL/QC per SKU identical (max diff 1e-13). 60 products show REVIEW→READY status differences only, caused by acceptances made after run 126 |
| T2 AU-6A+AU-6Q, no kit (run 902) | full absorption, variance 0; 271/455 products scaled; DL/POH reference batch mismatch 0 |
| T3 combined (run 903) | POH 424.476, DL 496.088, QC 127.723 per unit-batch; variance 0 |
| Replay (live, read-only) vs local 903 | all 629 SKUs match (DL/POH/QC max diff 2e-13) |
| Package install on a DB carrying the live-identical md5s | applies cleanly in one transaction. Basis view: Oct 865/878 k = 1, Sep k = 275/500. Multiplier = 1. Sep gates closed. Run 906 reproduces 903 |
| Guards | 122 lineage insert blocked (AU2 APPROVED); terminal-run insert/update/delete blocked; truncate blocked; writer re-run refused; Sep gate closed; switch-off and batch-true-off close the gate; unmapped class fails closed (POH and DL); pre-Oct effective_from rejected; reference-batch mismatch detected |

## Combined replay on run 126 (read-only; `replay126_combined.sql`)
| Item | Before | After |
|---|---|---|
| POH rate | 467.157 | 424.476 |
| DL (manufacturing) rate | 561.360 | 496.088 |
| QC | Method-3 share | 127.723 per unit-batch (AU-6Q alone: 100.62; rises because the kit no longer absorbs QC) |
| Negative-margin SKUs | 37 | 16 |
| Median COP ratio | | 0.985 |
| Distribution | | < −25%: 74; −25..−5%: 136; ±5%: 326; +5..25%: 90; > +25%: 3 |

Kvatha 200 g: DL+POH+QC 1,010 → 236 per pack (₹5,051 → ₹1,181 per kg). DL+POH alone ₹1,784 → ₹335 per kg; QC per batch on a 2 kg batch remains ₹846/kg.

### Key SKUs
| SKU | Product | Pack | Batch / ref | DL | POH | QC | COP | × |
|---|---|---|---|---|---|---|---|---|
| 865 | Kashaya Vasthi Kit | 275g | 160 / 160 | 1546.62->7.84 | 1605.85->5.31 | 4.85->3.39 | 3206.57->62.13 | 0.019 |
| 876 | Dahasanthi | 20g | 150 / 20 | 3.15->3.92 | 0.20->0.78 | 0.02->0.09 | 5.62->7.03 | 1.251 |
| 878 | Karkkidaka Kanji | 500g | 50000 / 50000 | 32.07->2.93 | 28.03->0.05 | 0.20->0.01 | 141.01->75.08 | 0.532 |
| 879 | Mehasamani | 20g | 32 / 20 | 4.14->4.45 | 0.95->1.20 | 20.55->0.40 | 29.37->9.78 | 0.333 |
| 988 | Thampira Chendooram | 5g | 50 / 50 | 9.11->8.39 | 3.22->2.93 | 61.64->0.11 | 91.78->29.23 | 0.318 |
| 1769 | Chiruvilwadi Kvatha Choornam | 200g | 2 / 20 | 204.97->37.91 | 151.83->29.00 | 653.42->169.23 | 1097.18->323.11 | 0.294 |
| 1770 | Gandharvahasthadi Kvatha Choor | 200g | 2 / 20 | 204.97->37.91 | 151.83->29.00 | 653.42->169.23 | 1070.22->296.16 | 0.277 |
| 1792 | Abhraka Bhasmam | 1000g | 50 / 50 | 4023.34->3555.86 | 1898.99->1725.50 | 1120.79->22.99 | 10439.66->8700.89 | 0.833 |
| 1797 | Special Medicine 2 | 5g | 50 / 50 | 3.43->3.37 | 0.29->0.27 | 0.31->0.11 | 23.40->23.11 | 0.988 |

### Top 15 risers
| SKU | Product | Pack | Batch | Family ref | COP old → new | × |
|---|---|---|---|---|---|---|
| 637 | Dhanwantharam Gulika | 100Nos | 200000 | 48000 | 24.59 → 33.85 | 1.376 |
| 111 | Rasnadi Choornam | 50g | 79.8 | 12 | 31.29 → 42.68 | 1.364 |
| 876 | Dahasanthi | 20g | 150 | 20 | 5.62 → 7.03 | 1.251 |
| 1046 | Triphalai Choornam | 100g | 60 | 21 | 34.19 → 42.22 | 1.235 |
| 110 | Rasnadi Choornam | 10g | 79.8 | 12 | 11.66 → 13.93 | 1.195 |
| 1045 | Triphalai Choornam | 50g | 60 | 21 | 21.58 → 25.59 | 1.186 |
| 127 | Triphaladi Choornam | 1000g | 44 | 21 | 371.59 → 433.66 | 1.167 |
| 191 | Ksheerabala Thailam 101 Avar | 10mL | 105 | 55 | 74.04 → 85.32 | 1.152 |
| 262 | Kottamchukkadi Thailam | 5000mL | 360 | 60 | 1407.66 → 1588.3 | 1.128 |
| 261 | Kottamchukkadi Thailam | 450mL | 360 | 60 | 136.8 → 153.06 | 1.119 |
| 347 | Strobilanthes Oil | 450mL | 360 | 60 | 139.92 → 156.11 | 1.116 |
| 836 | Kadaleekalpa Rasayanam | 250g | 800 | 145 | 72.02 → 80.23 | 1.114 |
| 449 | Nalpamaradi Keram | 5000mL | 480 | 60 | 1630.01 → 1810.72 | 1.111 |
| 260 | Kottamchukkadi Thailam | 200mL | 360 | 60 | 66.44 → 73.67 | 1.109 |
| 837 | Kadaleekalpa Rasayanam | 400g | 800 | 145 | 123.45 → 136.58 | 1.106 |

### Top 15 fallers
| SKU | Product | Pack | Batch | Family ref | COP old → new | × |
|---|---|---|---|---|---|---|
| 865 | Kashaya Vasthi Kit | 275g | 160 | 160 | 3206.57 → 62.13 | 0.019 |
| 1365 | Vaattu Kashayam | 450mL | 10 | 500 | 371.08 → 84.35 | 0.227 |
| 193 | Ksheerabala Thailam 41 Avart | 10mL | 5 | 55 | 331.93 → 81.52 | 0.246 |
| 1770 | Gandharvahasthadi Kvatha Cho | 200g | 2 | 20 | 1070.22 → 296.16 | 0.277 |
| 1123 | Meni Thailam | 100mL | 15 | 60 | 194.36 → 54.02 | 0.278 |
| 1257 | Meghanada Gulikai | 20Nos | 40000 | 40000 | 74.35 → 21.23 | 0.286 |
| 1769 | Chiruvilwadi Kvatha Choornam | 200g | 2 | 20 | 1097.18 → 323.11 | 0.294 |
| 362 | Balamritham Aavanakkenna | 10mL | 30 | 60 | 33.2 → 10.42 | 0.314 |
| 988 | Thampira Chendooram | 5g | 50 | 50 | 91.78 → 29.23 | 0.318 |
| 1286 | Kalnaar Parpam | 5g | 50 | 50 | 36.91 → 11.99 | 0.325 |
| 943 | Annabhedi Chendooram 2 | 5g | 25 | 25 | 42.24 → 13.8 | 0.327 |
| 1273 | Gunmakudori Mezhuku | 10g | 30 | 30 | 42.49 → 14.05 | 0.331 |
| 879 | Mehasamani | 20g | 32 | 20 | 29.37 → 9.78 | 0.333 |
| 1274 | Idivalladi Mezhuku | 10g | 15 | 32.5 | 56 → 20.92 | 0.373 |
| 1056 | Meni Choornam | 50g | 14 | 21 | 87.48 → 32.94 | 0.376 |

Risers are large batches in families with small medians, e.g. Dhanwantharam Gulika 200,000 vs 48,000; Rasnadi Choornam 79.8 vs 12; Dahasanthi 150 vs 20.
Several fallers are QC-driven (AU-6Q): Thampira, Kalnaar, Annabhedi, Mehasamani, Meghanada.

## Not covered / follow-ups
- Preview and explain functions (`fn_preview_production_overhead_workload`, `fn_preview_direct_labour_shadow_workload`, `rpc_get_route_workload_management_explain_core`) still show unscaled factors. Snapshots are authoritative.
- `fn_resolve_sku_commercial_base_context` (regional marketing basis) still uses 275/500 for 865/878 (minor).
- After apply: a new October rerun is needed. Acceptances 72–130 and 369–572 also take effect only then.
