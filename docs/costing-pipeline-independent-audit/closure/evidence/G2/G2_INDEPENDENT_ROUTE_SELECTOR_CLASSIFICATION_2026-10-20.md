# G2 independent route selector findings — 20 October 2026

Status: LIVE READ-ONLY VERIFIED; NO LIVE CHANGES.

Inspected `costing.fn_route_family_onboarding_status(bigint,date,date,bigint)` (md5 774b481618db40c140e4b71c06b8ae7a). Its `latest_route` is selected by latest route_version/id without status or valuation-date filtering. This is appropriate as a latest-version lifecycle indicator, not a historical effective-route resolver. It also calculates effective recipient coverage through the existing validation function; fixing central historical resolution must be regression-tested there. Do NOT mechanically replace its latest-version selection.

Inspected `costing.fn_product_process_route_readiness(date)` (md5 29835ce9be925dfe0afdea8133d8217a). It independently selects a family route via a LATERAL query requiring status='APPROVED', archived_at IS NULL and valuation-date bounds. It does NOT use `fn_resolve_effective_route_family_route`. Consequently, historical readiness after a governed old-route supersession would independently report `BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE` even if the central resolver is repaired. This is a SECOND VERIFIED historical selection discrepancy. Narrow remediation must separately make this date-scoped family selector admit eligible historical SUPERSEDED routes, while leaving current-day draft/superseded/inactive handling and product-route readiness semantics correct.

Additional two candidates `fn_preview_route_family_route_steps` and `fn_validate_product_process_route` have not yet been classified by full-body inspection. Search based on APPROVED predicates is not enough to call them defective.

No replacement SQL has been approved or applied. Tests need historical day, transition eve, successor day, present-day readiness, no overlap, 101/41/40 genuine cycles, route overrides, 122/128 immutable snapshots and WP04 readiness. Keep one central rule where practical, but do not add a new dependency merely to avoid changing a safely identified independent query. G2/CI-032 OPEN.
