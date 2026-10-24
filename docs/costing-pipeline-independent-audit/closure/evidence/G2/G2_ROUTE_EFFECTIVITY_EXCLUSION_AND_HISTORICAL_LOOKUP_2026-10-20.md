# G2 route effectivity and historical lookup, 20 October 2026

**Verified from read-only live database; no production writes.**

The route parent has GiST exclusion constraint production_route_family_route_no_approved_overlap: for non-archived APPROVED routes of one family, inclusive effective-date ranges cannot overlap. One-writable partial index also restricts each family to one unarchived DRAFT or REVIEW_REQUIRED route. Route version uniqueness and approved evidence/date constraints exist.

CRITICAL: fn_resolve_effective_route_family_route only returns APPROVED non-archived versions. Switching historical v1 to SUPERSEDED would remove it from old-date route lookups. An isolated candidate is to retain historic v1 APPROVED with inclusive effective_to equal to the day before the approved successor start, then validate future v2. This is NOT authorised or implemented. Parent immutability allows effective_to change, but full governed approval and readiness must still be audited.

Family101 currently has only route144 v1 APPROVED, effective 2026-08-30 onward. fn_validate_route_family_route verifies route structure/scope, locations and cost-centres; it does not verify actual physical cycle count. No specially named approve/supersede function found in the narrow catalog search; generic workflows remain to be researched.

Next: test effective-date historical continuity, overlapping endpoint exclusion, and effect of lifecycle statuses with isolated PostgreSQL fixture; scrutinise generic approval entrypoints and WP04 readiness. G2 OPEN. No live changes.