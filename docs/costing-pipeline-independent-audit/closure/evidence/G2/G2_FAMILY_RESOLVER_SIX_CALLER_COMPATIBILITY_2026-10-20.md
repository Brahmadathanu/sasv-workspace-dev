# G2 family-route resolver direct consumer compatibility audit — 20 Oct 2026

Read-only `pg_proc.prosrc` scan verified exactly six direct textual callers of `costing.fn_resolve_effective_route_family_route`:

1. `costing.fn_effective_product_process_steps(integer,date)` — no `exception` token in function source.
2. `costing.fn_preview_product_process_route_candidate(bigint,date,integer)` — has exception handling of unverified scope.
3. `costing.fn_preview_production_overhead_workload(bigint,date,date,bigint,bigint)` — has exception handling of unverified scope.
4. `costing.fn_validate_effective_product_process_route(integer,date)` — no `exception` token in function source.
5. `public.rpc_get_production_route_manager_workload_detail(date,date,bigint,bigint)` — has exception handling of unverified scope.
6. `public.rpc_get_production_route_manager_workload_preview(date,date,bigint,text,text,text,bigint,integer,integer,text,text,integer,integer)` — has exception handling of unverified scope.

Source positions alone do NOT establish catch semantics, returned response shapes or security parity. The proposed `AMBIGUOUS_APPROVED_FAMILY_ROUTE` error must be tested for all six consumers. Confirm client handling of error response, route preview, validation and workload detail before controlled deployment. Catalog source of specific callers was blocked during this turn. The staged SQL is review-only and **not yet PostgreSQL-executed**; no live modifications.

Gate: record each caller's nominal, no-route and ambiguity response; test strict approval controls; ensure archived historical snapshot read-by-stored-ID stays unaffected; re-check direct and indirect views/triggers before cutover. G2/CI-032 HIGH OPEN.
