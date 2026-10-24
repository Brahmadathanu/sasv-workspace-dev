# G2 route historical lookup: direct consumer inventory — 20 October 2026

Status: **LIVE READ-ONLY FUNCTION CATALOG VERIFIED, NOT A COMPLETE DEPENDENCY GRAPH**. No live changes.

Exact text callsites to `costing.fn_resolve_effective_route_family_route` were found in six functions:
- costing.fn_effective_product_process_steps
- costing.fn_preview_product_process_route_candidate
- costing.fn_preview_production_overhead_workload
- costing.fn_validate_effective_product_process_route
- public.rpc_get_production_route_manager_workload_detail
- public.rpc_get_production_route_manager_workload_preview

A self-reference in the function-definition catalog must not be treated as an independent caller. The initial whole-catalog query errored on aggregate `array_agg`; filtering `pg_proc.prokind='f'` and schemas separately succeeded.

Additional candidate functions using `production_route_family_route` and textual APPROVED predicates in costing: fn_preview_route_family_route_steps; fn_product_process_route_readiness; fn_route_family_onboarding_status; fn_route_parent_immutable; fn_validate_product_process_route. These are **candidates only**: the predicate scan does not prove they contain defective historical filtering; inspect definitions before classifying or modifying.

Critical already verified incompatibility: public.rpc_approve_route_family_route sets previous route status SUPERSEDED and closes the date; costing.fn_resolve_effective_route_family_route resolves only APPROVED rows. Proposed minimal fix is to admit date-valid SUPERSEDED historical routes in existing resolver, keeping archive and effective-date rules, while ensuring current screens and other independent selectors do not accidentally elevate retired routes. **No migration may be prepared as final until client calls, other SQL selectors, full PostgreSQL fixture, dates, WP04 and snapshot invariants verified.**

G2 remains OPEN, CI-032 HIGH; G4 OFF; old route144, runs122/128 untouched.
