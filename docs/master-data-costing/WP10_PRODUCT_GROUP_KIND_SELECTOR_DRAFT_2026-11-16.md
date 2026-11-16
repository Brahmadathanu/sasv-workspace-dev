# WP10 — Product group kind selection draft implementation (2026-11-16)

Live schema: `public.product_groups.kind_id` is integer NOT NULL, FK to `public.product_group_kinds(id)`, with no default and no BEFORE INSERT trigger. Kind lookup contains 34 rows, and authenticated SELECT is permitted by `product_group_kinds_authenticated_read` RLS policy.

Draft client commits add `#newGroupKind` to `manage-product-groups.html`, populate from `product_group_kinds(id,group_name,code)`, require a positive selected kind ID, and pass `kind_id` in the existing group create insert. This is a **functional draft correction only**; group writes remain direct DML and must be migrated to governed RPCs before a four-level authenticated write revoke. No browser tests, permission tests, migration, merge or deployment were executed; mark NOT TESTED, not PASS. WP10 OPEN.
