# WP10 — CL19 destination-first active reparent concurrency gate (2026-11-16)

The database's one-to-many relation is unchanged: a single SKU row has one `product_id` at any instant, while one product may have multiple SKUs. Reparenting updates that single foreign key; it does not create simultaneous parent relationships.

CL19 fixture: activate SKU 1 on Product 1; concurrently hold Product 3's subgroup UPDATE (to subgroup 3, no approved route) open for three seconds; then attempt to reparent SKU 1 to Product 3. The corrected experimental trigger must serialize against the destination product lock and recheck the committed route. Expected: destination edit commits, reparent fails, SKU remains on Product 1, no timeout/deadlock. This is disposable PostgreSQL, not production.

**CL19 pending CI**. It tests destination-first ordering only; reverse ordering, route mapping writer transactions, privileged SQL, exact correction-only production migration/rollback, and independent review remain open. No production changes authorized.
