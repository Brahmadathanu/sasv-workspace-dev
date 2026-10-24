# Step 160 — Selective IK promotion scheme updates (23 October 2026)

User instruction: set 11 + 1 for named products, **skip any SKU with an existing scheme**, and set Thippili Rasayanam 720 g to 21 + 3. Applied to `SASV - PRICING & PROMOTIONAL VIABILITY` workbook, MARKETING PROMOTIONS MASTER, column N (IK proposed scheme).

Only 7 SKU rows were eligible because their previous IK proposal was `No Scheme`:
- Karisalai Lehyam: SKU 1199 250g and SKU 1200 400g → 11 + 1.
- Mathulai Manappagu: SKU 1243 50g and SKU 1244 250g → 11 + 1.
- Thippili Rasayanam: SKU 1220 100g and SKU 1221 250g → 11 + 1.
- Thippili Rasayanam: SKU 1222 720g → 21 + 3.

Added `21 + 3` to DATA VALIDATION MASTER IK scheme list A8:C8 with paid=21, free=3, so proposed viability arithmetic resolves. 11 + 1 was already present.

**Skipped** because existing 5 + 1, as directed: Hridayasanthi (100,450mL); Udarasudha (100,450mL); Hridayamohini (50,250g); Kadaleekalpa Rasayanam (100,250,400g); Amukkura Lehyam (100,400g); Kesapushpam (100mL); Hridayarenjini Lepam (30g); Kumkumadi Lepam (15g); Murivenna Balm (25g); Solanum Syrup (50,100mL). 17 SKU rows untouched. Thippili Rasayanam 30g not requested, unchanged.

Verified 7 specific SKUs with intended scheme and unchanged IK discount 33%. No OK or database writes. Some updated rows not in IK price-list; viability-sheet visible scheme distribution post-edit: No Scheme 394, 5 + 1 125, 11 + 1 5, 21 + 3 1, total525. Note that prior 5+1 values were treated as existing user settings, not overwritten.
