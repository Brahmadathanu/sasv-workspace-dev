# Step 137 — Mandatory SKU regional price-list membership and activation guard (2026-10-22)

User rule: Every SKU, active or inactive, must have non-null independent IK and OK price-list booleans. Inactive SKU must never have either flag TRUE. When deactivated both flags become FALSE; when newly inserted or reactivated, default FALSE unless explicitly set TRUE on active SKU. No conflicting Sheet-source rows imported; imported TRUE for active SKUs must be preserved.

Live precheck public.product_skus: 1793 rows; 627 active / 1166 inactive; 71 inactive rows had at least one TRUE flag from imported historical Sheet membership; 40 rows had null membership. Existing parent-product guard trigger `trg_active_sku_requires_active_product` and WP04 trigger preserved.

Applied migration `20261022173416_price_list_membership_mandatory_inactive_guard_20261022`:
- Sets all inactive price-list fields FALSE; makes unresolved active NULLs FALSE, without modifying existing active nonnull membership.
- Sets `price_list_ik`, `price_list_ok` both NOT NULL DEFAULT FALSE.
- Installs `BEFORE INSERT OR UPDATE` `trg_product_skus_price_list_active_guard`: for every inactive final NEW row forces both flags FALSE; for active NEW rows coalesces null to FALSE. Explicit TRUE is allowed only for an active SKU. Also adds CHECK `is_active OR (NOT price_list_ik AND NOT price_list_ok)` as independent invariant.
- Native trigger and constraint prevent inactive membership from staying TRUE even when a caller supplies it. Non-null and default protect new records. Parent-product activation rule remains unchanged.
- Versioned migration added at `supabase/migrations/20261022173416_price_list_membership_mandatory_inactive_guard_20261022.sql`.

Postmigration DB verification: 1793 SKUs, 0 null flags, 0 inactive with any TRUE; active IK true 525, active OK true 525; column metadata confirms both flags NOT NULL DEFAULT FALSE; trigger registered. Canonical view returns these new booleans unchanged, still latest approved run140.

Google SASV PRICE REVISION PROPOSAL `MASTER DATA`: updated the 11 previously blank active SKU flags to FALSE/FALSE by cross-matching SKU ID in column D; reread BJ2:BK628: 627 rows, 0 blanks, 525 TRUE IK, 525 TRUE OK. No other Sheet columns changed. Original CS source Sheet not altered.

Important semantics: FALSE for previously missing source records is now an operational default, NOT an evidence-based conclusion they were explicitly excluded by the CS legacy workbook. This provenance caveat must be retained for future business review. No separate third status field or table introduced.
