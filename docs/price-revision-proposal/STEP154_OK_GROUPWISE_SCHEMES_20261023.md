# Step 154 — Outside Kerala proposed scheme allocation by product Group (23 October 2026)

User instructed all 627 `MARKETING PROMOTIONS MASTER` SKU rows, initially set to OK proposed scheme 5 + 1, to be selectively revised by exact Group (column H). This is an editable workbook proposal only; no Supabase/approved source policies modified.

Added OK scheme choices to `DATA VALIDATION MASTER` E:G: `10 + 1` (paid10/free1), `9 + 1` (paid9/free1), so existing region-specific scheme quantity lookups resolve correctly.

Assigned OK proposed scheme (column P) `10 + 1` for Groups: Anjanam (1), Bhasmam / Sindooram / Rasam / Louham / Mandoora / Ksharam (2), Enna / Thailam / Kuzhambu / Keram (188), Ghritham (22), Edible Oils (2), Chendooram / Chunnam / Karuppu / Parpam (30), Ennei / Thailam (33), Ney (Ghritham) (2). Total 280.

Assigned `9 + 1` for Lehyam / Gudam / Rasayanam / Modakam (32), Lehyam (Ilakam) / Rasayanam (18). Total 50.

Remaining 297 SKU rows keep `5 + 1`. Discount Proposed OK remains 40 for all 627. IK proposed scheme/discount unchanged.

Checked entire proposed master: scheme count 280 (10+1), 50 (9+1), 297 (5+1), all 627 OK discounts remain 40. Regional price-list filtered `PROMOTIONAL VIABILITY - OK` currently 525 rows: 248 10+1, 44 9+1, 233 5+1; zero missing paid/free lookups. IK 525 rows continue `No Scheme`, zero lookup errors. Note differences in counts because promotion master retains all SKUs while each regional viability tab includes only price-list eligible SKUs.

No MRP assumptions or price approvals were entered. All calculations remain dynamic ARRAYFORMULA-driven from the proposal.
