# Route resolution verification, 20 October 2026

Read-only inspected `costing.fn_resolve_effective_route_family_route(integer,date)` directly. The function selects a non-archived APPROVED route whose effective period includes the valuation date, and orders candidates by `effective_from DESC, route_version DESC, id DESC` with LIMIT 1. Consequently, a newer approved version may resolve even if its date overlaps an older approved route: period-overlap prevention must be established independently through constraints and approvals, not presumed from resolver ordering.

Locally executed Node.js isolation tests: 17 passed, zero failed across the recurrence fixture, allocation-invariant fixture and a new five-case route-selection fixture. The route-selection fixture is a JavaScript imitation of inspected SQL; it is NOT PostgreSQL integration, and it did not write to Supabase.

Postgres client/server utilities were unavailable in this execution environment, so the requested isolated PostgreSQL integration fixture remains BLOCKED, not complete. User approval is mandatory before any live route or database writes. G2 and CI-032 OPEN; runs122/128 unchanged.
