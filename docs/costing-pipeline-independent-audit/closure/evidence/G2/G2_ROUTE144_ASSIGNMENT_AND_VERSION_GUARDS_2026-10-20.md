# G2 Route 144 current membership and version guards — 20 October 2026

**Read-only verified; no production mutation.**

The live table `costing.production_route_family_product_map` returned exactly one assignment for route_family_id=101: ID424, product_id=51 Dhanyamlam, APPROVED, effective 2026-08-30, open-ended, assignment_basis MANUAL. This independently corroborates that the current family mapping has only Dhanyamlam (and the run128 frozen route144 recipient check also returned only product51).

The live route definition `costing.production_route_family_route` ID144 is family101, version1, APPROVED. Its code is `SHUKTHAM_SERIAL_THERMAL_ACIDIC_EXTRACTION_ROUTE` (the Shuktham label may describe a family process; inspect operational route semantics before approval).

Three active triggers on route parent were verified through pg_trigger:

1. `trg_enforce_prm_approval_reference`, BEFORE INSERT/UPDATE, `fn_enforce_prm_approval_reference()`.
2. `trg_route_family_route_immutable`, BEFORE UPDATE/DELETE, `fn_route_parent_immutable()`.
3. `wp04_readiness_epoch_28bd169b69ca`, AFTER INSERT/UPDATE/DELETE/TRUNCATE, `fn_wp04_readiness_bump_source_epoch()`.

**Consequences:** do not UPDATE existing approved route144 to change occurrences/cycles. Prepare an approved, appropriately effective-dated successor version and verify the exact parent/child versioning workflow, overlap constraints, WP04 readiness-epoch invalidation, and effective family-product mapping/override resolution. No route version was created. The owner confirmed Dhanyamlam has eight total repetitions, so 8×8 duplicate physical repetitions must be normalized only in the successor. Future assignment changes require re-evaluation of the impact scope.

Read-only reproduction:
```sql
SELECT id,product_id,status,effective_from,effective_to,assignment_basis FROM costing.production_route_family_product_map WHERE route_family_id=101 ORDER BY product_id,id;
SELECT tgname,pg_get_triggerdef(oid) definition FROM pg_trigger WHERE tgrelid='costing.production_route_family_route'::regclass AND NOT tgisinternal;
```

G2 OPEN; CI-032 HIGH; G4 OFF. Runs122/128, current masters and all financial outputs unchanged.
