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

## Sweep 2 (2026-10-15 ~17:50 IST): evidence table for the 125 products charged ≥10× their batch need (D-014)
Full table: `A3_125_OVERCHARGED_PRODUCTS.csv`, from `queries/A3_03_overcharged_125_evidence.sql`. Window: Oct 2025 to Sep 2026.
Labels:
- **VERIFIED_LIVE** columns: batch sizes, forecast qty, charged batches, BMR batches/months, FG transfers, sales, run-119 conversion charge.
- **ANALYTICAL_ONLY** columns: `batchtrue_*`, `actual_batch_absorption_month`.
- **PROPOSAL** columns: `cls`, `proposed_treatment`.
Data coverage limits (VERIFIED_LIVE):
- `bmr_details` starts on 2025-07-04, so "no BMR" means none since July 2025.
- FG transfers start on 2025-04-01, with 59 unmapped lines.
- Sales are converted to base units as qty × pack_size × conversion_to_base (ASSUMPTION).

| Class (PROPOSAL) | Products | Run-119 DL+POH charged/month (VERIFIED) | Batch-true at forecast volume (ANALYTICAL) | Actual-BMR-batch absorption (ANALYTICAL) |
|---|---|---|---|---|
| A: made in window (≥1 BMR) | 61 | ₹301,404 | ₹72,344 | ₹108,307 |
| B: no BMR since Jul-25, but FG transfer or sales exist | 60 | ₹420,379 | ₹23,153 | ₹0 |
| C: dormant (no BMR, FG or sales) | 4 | ₹98,564 | ₹31,562 | ₹0 |
| **Total** | **125** | **₹820,347** (47.6% of the ₹1,722,238 DL+POH pools) | ₹127,059 | ₹108,307 |

Other counts:
- 33 of the 125 are flagged `is_pto` (produce-to-order).
- 28 have a BMR average batch size that differs from the preferred size.

Main finding A3-F5 (P1, VERIFIED_LIVE mechanism):
- About ₹6.9 lakh/month of conversion cost lands on 125 low-volume products.
- In a batch-true model, most of that cost belongs to the other ~510 products. Their run-119 COP is therefore **understated**, not just the 125 overstated.
- The correction would raise their cost. This is a pricing risk.

Examples (VERIFIED charge vs ANALYTICAL batch-true, conversion per base unit):
- P183 Ksheerabala 101 Avarthi: ₹12,708.90/Kg vs ₹4,266.59/Kg. 1 BMR in the window (Jun-26).
- P184 (41 Avarthi): ₹566,370.93/Kg vs ₹37,076.64/Kg.
- P783: ₹908,725.50 vs ₹2,003.87 per base unit.
- P54 Abhraka Bhasmam: dormant, yet charged ₹84,249/month.

Proposed treatment (PROPOSAL, follows D-014):
1. Standard cost per unit = (route workload per one normal batch × rate) ÷ normal batch output. The normal batch is the preferred size, validated against the BMR average.
2. Rates use a denominator from a capacity-based normal volume. They must not use rounded batch counts. The capacity source is open: D-012 / A4.
3. Period absorption = actual BMR batches × per-batch standard. The gap to the pool is posted as a volume/variance line, not loaded onto SKUs.
4. Class B/C keep a determinable standard, so they get no zero cost. They are excluded from period absorption until a batch occurs.

Missing evidence per product is in the CSV:
- Yield/output per batch (actual vs theoretical).
- Pre-Jul-2025 batch history for class B.
- Confirmation of whether class-B Chendooram/Parpam items are made in long multi-month cycles or bought in (PTO).

Retest: rerun the A3_03 query after any change. Totals must reconcile to the pools plus the variance line.

### Cross-check against the live read-only simulator (VERIFIED_LIVE function output, ANALYTICAL rates)
- Function: `costing.fn_simulate_preferred_batch_manufacturing_cost(119, 503.95, 640.65)`. It is STABLE, and its status is `SIMULATION_ONLY_NOT_APPROVED_RATE`.
- It uses the yield-adjusted net batch output.
  - P183: ₹4,309.69/Kg (my figure: ₹4,266.59).
  - P184: ₹37,451.15/Kg (my figure: ₹37,076.64).
  - The ~1% difference is the net-output yield. The independent calculation is corroborated.

| Group | Products | Charged DL+POH/month, run 119 | Preferred-batch simulation × forecast qty |
|---|---|---|---|
| 125 flagged | 125 | ₹820,347 | ₹136,376 |
| All other simulated | 335 | ₹901,875 | ₹1,647,777 (+83%) |

**A3-F5 confirmed (P1).** Under batch-true costing, the 335 mainstream products carry about ₹7.46 lakh/month less conversion cost than they should. Their run-119 COP is understated. Any price built on run 119 inherits this.

**A3-F6 (P2, VERIFIED_LIVE data, needs operations validation).** Even in batch-true, some routes have extreme workload per batch:
- P184: 5 Kg batch carries 152.7 labour and 169.25 overhead WU, about ₹1.85 lakh per batch.
- P183: about ₹4.48 lakh per 105 Kg batch.

Route intensity for multi-avarthi thailams needs validation by production before any standard is approved.
