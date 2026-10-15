# A3 — Manufacturing batch / workload investigation (sweep 1)
Retrieved 2026-10-15 ~17:10 IST, run 119, SELECT-only. Queries: `queries/A3_01_*`, `queries/A3_02_*`.

## A3.1 Mechanism in run 119 (VERIFIED_LIVE from snapshot columns)
For every product, monthly volume → `monthly_batch_equivalents` (mbe = monthly qty ÷ preferred batch) → **`rounded_batch_count` = whole batches, minimum 1** → workload = rounded batches × route factor (POH) / × labour intensity (labour). The labour and POH pools are then shared by workload and the product's share is divided over **that month's** SKU volume.
Consequence: a product that sells a few packs a month is charged a **full batch every month**, and the whole batch cost lands on that month's few packs.

## A3.2 Portfolio evidence (run 119, 460 products)
| Measure | Value |
|---|---|
| Σ batch-equivalents actually needed (mbe) | 280.37 |
| Σ batches charged (rounded) | 600 |
| Products charged ≥2× their need | 346 |
| Products charged ≥10× their need | 125, carrying 2,368.25 of 5,373.5 POH workload units (44.1%) |
| POH workload denominator: charged vs volume-true | 5,373.5 vs 1,585.951 (3.39×) |
| Labour workload denominator: charged vs volume-true | 5,519.35 vs 1,401.3231 (3.94×) |
| Pools conserved? | Labour yes (₹706,203). POH short by ₹1,181.76 (A0-F3) |
Pools are conserved, so this is a **redistribution**: slow-moving products absorb far more than their manufacturing effort; fast movers are undercharged.

## A3.3 Named cases
| Product / SKU | Batch (pref.) | Monthly qty | mbe | Charged batches | Labour WU | POH WU | Run-119 labour / POH per pack | Status |
|---|---|---|---|---|---|---|---|---|
| P184 Ksheerabala 41 / SKU193 10 mL | 5 Kg | 0.091 Kg (10 packs) | 0.0182 | 1 | 152.7 | 169.25 | ₹1,956.48 / ₹3,200.22 → COP ₹5,185.65 (MRP ₹85 per baseline, not re-verified) | READY |
| P783 Thampira Chendooram / SKU988 5 g | 50 Kg | 0.03 Kg (6 packs) | 0.0006 | 1 | 111.1 | 69 | ₹2,371.90 / ₹2,174.45 → COP ₹4,623.05 | READY |
| P190 Bala Thailam / SKUs 207, 208, 209 | 240 Kg | 113.477 Kg | 0.4728 | 1 | 5.9 | 7.25 | 207: ₹3.29/₹1.10; 208: ₹3.89/₹2.20; 209: ₹5.41/₹4.95 | REVIEW_REQUIRED (monthly driver / foundation) |
| P1350 Mahamanjishtadi Kashaya Choornam / SKU1798 100 g | 35 Kg | 1 Kg | 0.0286 | 1 | 3.6 | 3.25 | ₹48.74 / ₹61.45 → COP ₹225.38 | REVIEW_REQUIRED (monthly driver / foundation) |
Reconciles to baseline: SKU193 labour+POH ₹1,956.48+₹3,200.22 = ₹5,156.71 (baseline ₹5,156.70755). SKU988 ₹2,371.90+₹2,174.45 = ₹4,546.35 (baseline ₹4,546.34679). Baseline 'loaded' figures are internal loaded cost, not COP, so not compared here.

## A3.4 Analytical sensitivity (ANALYTICAL_ONLY — same run-119 pools; spreads one batch's cost over that batch's packs; gross preferred batch, no yield loss)
| Basis | Labour rate /WU | POH rate /WU | SKU193 labour+POH per pack | SKU988 per pack |
|---|---|---|---|---|
| Run 119 actual (monthly whole batch) | 127.95 | 189.08 | ₹5,156.71 | ₹4,546.35 |
| Run-119 rates, batch cost ÷ batch output | 127.95 | 189.08 | ₹93.80 (549.45 packs/batch) | ₹2.73 (10,000 packs) |
| Volume-true denominators (pool ÷ Σ mbe×WU) | 503.95 | 640.65 | ₹337.40 | ₹10.02 |
Neither alternative is approved. The second is the internally consistent option (pool recovered in full when every product is costed on its true batch need); it raises costs for high-volume products. Yield (net vs gross output, e.g. 4.95 Kg vs 5 Kg) is not applied here.

## A3.5 Findings
| ID | Sev | Finding | Owner |
|---|---|---|---|
| A3-F1 | **P1** | Monthly whole-batch rounding (min 1) charges slow movers for unmade batches and loads a whole batch onto one month's sales; causes the extreme SKU costs (193, 988 and ≥125 products) | Costing engine + Finance (D-004/D-005) |
| A3-F2 | P1 | Workload denominators are inflated 3.4–3.9× by the rounding, so every per-WU rate in run 119 is understated for fast movers | same |
| A3-F3 | P2 | Products 190 and 1350 (SKUs 207/208/209/1798) remain REVIEW_REQUIRED (monthly driver + foundation) in run 119 — MC07 exceptions still open | Manufacturing-costing workstream |
| A3-F4 | P2 | Preferred batch is gross input (5 Kg / 50 Kg); run 119 does not apply net output / yield in this path (net 4.95 Kg / 48.5 Kg per baseline) | same |

## Not yet done
Actual production frequency per product (completed batches vs FG transfers), labour attendance evidence, yield from BMR, Σ-check of SKU conversion for all 635 SKUs.
