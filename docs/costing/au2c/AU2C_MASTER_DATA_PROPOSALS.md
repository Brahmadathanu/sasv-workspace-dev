# AU-2c — High-impact master-data correction proposals (DRAFT, evidence-based, NOT applied)

Status: proposal only. No live writes. Every change needs explicit user approval plus the named production/QA evidence (GOV-015).
Evidence: read-only live queries (qhmoqtxpeasamtlxaoak, run 119, 2026-10-15 about 19:15 IST). Draft SQL: `AU2C_PROPOSED_CHANGES.sql` (guarded and ROLLBACK by default) and `AU2C_ROLLBACK.sql`.

## Priority by financial impact (cost understatement × monthly volume)
| # | SKU | Product | Defect (VERIFIED_LIVE) | Proposed fix | Δ RM / pack | Packs/month* | Δ cost / month | Confidence |
|---|---|---|---|---|---|---|---|---|
| 1 | 859 | Ilaneer Kuzhambu 5 mL (P678) | BOM 2283 reference output **28,039 Kg** from ~71 Kg herbs + 400 tender coconuts + 50 Kg honey; preferred batch 27.5 Kg / net 23.375 Kg. RM ₹1.4553/Kg, RM/pack ₹0.0052 | reference_output_qty **28.039** Kg (×1000 entry error) | **+₹5.19** (₹0.0052 → ₹5.20) | ~1,404 | **≈ +₹7,290** | HIGH (scale inconsistent by 3 orders; batch size corroborates ~25–28 Kg) |
| 2 | 1277 | Palthulli 5 mL (P1038) | BOM 2379 reference output **2,697 Kg** from 5.44 Kg inputs (4 Kg honey + oils/crystals); preferred batch 16.32 Kg / net 15.99 Kg. RM ₹0.9575/Kg, RM/pack ₹0.0061 | **Evidence first.** Candidate A 2.697 Kg (×1000) gives RM ₹957/Kg and RM/pack ₹6.08, BUT then output < inputs (5.44 Kg), which is implausible with 2% loss. Candidate B: the BOM lines are per a smaller base, or a base/vehicle line is missing | +₹6.07 (if A) | ~890 | ≈ +₹5,400 (if A) | MEDIUM: the defect is certain, the correct value is not |
| 3 | 879 | Mehasamani 20 g (P696) | `products.conversion_to_base` **0.02** for g→Kg (436 other g-products use 0.001). BOM 2289 reference output **320 Kg** from 16 Kg dried herbs (16 × 1 Kg); preferred batch 32 Kg / net 30.4 Kg | Change factor to **0.001** **together with** reference output **16 Kg** (or 32 Kg, per production). Factor alone would cut RM/pack to ₹0.18 (wrong). With 0.001 + 16 Kg: RM ₹176.3/Kg, RM/pack ₹3.53 (unchanged); with 32 Kg: ₹1.76 | 0 (16 Kg) / −₹1.76 (32 Kg) | ~10 | < ₹20 | HIGH on factor; MEDIUM on output |

\*Packs/month = run-119 monthly SKU base qty ÷ base qty per pack (859: 5.012 Kg ÷ 0.00357; 1277: 5.652 ÷ 0.00635; 879: 4 ÷ 0.4).

**DL/POH effect:** none for any of the three in run 119. Each product's rounded batch count stays at 1 under any correction, and per-pack DL/POH scale cancels. SKU 879's loaded cost of ₹147.57 against a ₹40 OK MRP stays dominated by its low-volume batch charge (A3), which a master-data fix does not solve.

**Pricing effect:** 859 (proposed ₹50 vs current ₹40, REVIEW COSTING) and 1277 are on A7 HOLD, so keep them on hold until they are corrected. 879 is among the 69 withheld.

## Evidence required before approval
- 859: the batch manufacturing record (BMR) for the last 2 batches, giving actual output in Kg, plus a production head sign-off on the reference output.
- 1277: the BMR output and the full formula sheet (is a base or vehicle such as water or oil missing from the BOM?).
- 879: product form (choornam/powder vs liquid), BMR output for a 16 Kg herb charge, and confirmation that the pack is 20 g.

## Not in scope here (A2 backlog, lower impact or needs policy)
The blanket 0.91 density on 246 SKUs, 554 SKUs on stale rates, and one g-product carrying factor 0.00091 (density applied to a mass unit? to verify). These are tracked for AU-2c phase 2.
