# G2 product route resolver verified — 20 October 2026

Live read-only pg_proc.prosrc confirmed `costing.fn_resolve_effective_product_process_route(integer,date)` filters archived_at IS NULL, status APPROVED, and inclusive effective dates. It counts matching records and raises AMBIGUOUS_APPROVED_PRODUCT_ROUTE if more than one. Governed `public.rpc_approve_product_route` marks previous approved product route SUPERSEDED and closes its effective_to. Thus predecessor becomes invisible to historical as-of product-route resolution. This is a CONFIRMED executable incompatibility, separate from the earlier family-route issue.

Minimal repair candidate: retain date range and archival guards, permit historically superseded route only within its recorded historical effective period, preserve multi-match exception; test prospective approval separately because shared `fn_validate_product_process_route` is used by review and approval RPCs. Integrate with family-route resolver, independent readiness selector and historical product-route validator; never allow historical eligibility to imply current approvability.

Evidence-only; no live changes. G2/CI-032 remain open. Runs122/128 and route144 unchanged.
