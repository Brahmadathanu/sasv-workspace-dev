# Step 162 — Marketing October 20 OK MRP and explicit scheme import (23 October 2026)

Source user-supplied CSV `IK & OK_Price List MKt 20th Oct 26.csv` (UTF-16, 454 product-pack records), field `SASV Proposed MKT`. User explicitly instructed **exclude every starred value** and apply only exactly identified SKU matches. No interpretation of starred notation.

Source parsing:
- 426 plain numeric MRP rows; 20 numeric MRP + explicit scheme; 8 starred rows excluded.
- Cleaned staging file contains 446 unstarred records, imported separately as temporary native Google Sheet (spreadsheet ID `1-LmLkt7KVZjPR7HFkVr7UMkPcCaiaxemVhz5_X5BSuE`); source rows contain no duplicate product-pack keys.
- Exact normalized product name + numeric pack size + equivalent g/gm UOM matching against SKU master produces **444 unique SKU matches**, 2 unstarred unmatched, 0 ambiguous duplicates.
- Unmatched: `Annabhedi Chendooram no 2` 5 gm (master identifies `Annabhedi Chendooram 2`; no automatic synonym assumed); `Triphala choornam` 100 gm (no exact master SKU).
- Eight starred entries excluded: Kesapushpam 100 mL (240*), Palandava Keram 200 mL (655*) and 450mL (1445*), Thanurakshakan (External) 100mL (295*) and 200mL (590*), Vathakodali Thailam 100mL (235*), Krimishodhini Gulika 12 (75*), Vimalavarthi 12 (200*).

Writes to authoritatively governed workbook `SASV - PRICING & PROMOTIONAL VIABILITY` ID `1K9u4YJ8qUfDcRfmTMRQDl3Ed24eItcm_0UW-jQhS21Q`:
- `MRP ASSUMPTIONS` SKU selector column A and assumed OK MRP column H, 444 rows starting row2. Blue formula columns B:F preserved, IK assumptions G untouched. No earlier assumptions existed at import.
- Of 20 explicit scheme remarks, 13 changed `MARKETING PROMOTIONS MASTER` proposed OK scheme column P from 5 + 1 to 7 + 1: SKUs 71,74,77,81,84,92,99,102,115,121,173,178,183 (choornam and lepa choornam). Other 7 explicit `10 + 1` already matched existing OK schemes, so unchanged.
- No scheme inferred for the 426 numeric-only source rows; previously set OK schemes remain.
- OK discount 40% all 627, unchanged; IK proposed schemes, discounts and approved database policy unchanged. No writes to Supabase.

Verification: 444 distinct assumptions with positive MRP, zero duplicates. Of 525 OK price-list SKUs, 437 currently use a populated assumed OK MRP (7 matched SKUs not included in OK price list). No formula errors in viability range. 13 OK 7 + 1 schemes found in current master. Evaluation MRP from viability now feeds the coordination preview tabs dynamically.

Do not auto-link staging as ongoing source; import was a one-time snapshot of marketing proposal. Any future corrections to unmatched names or starred MRPs must be separately authorized.
