# WP10 — Live route writer function inspection (2026-11-16)

Read-only Supabase catalog inspection; no DDL/DML executed. The following are **observations, not evidence of global safety**:

1. `costing.fn_product_route_family_assignment_guard()` checks product ACTIVE via ordinary `SELECT upper(coalesce(p.status,'')) ... FROM public.products` without explicit `FOR UPDATE`/parent-row locking in that check. It enforces temporal/approved-family/overlap constraints and governed archive/correction contexts. A product assignment mutation versus concurrent SKU activation remains a separate concurrency surface; trigger names alone do not close it.
2. `costing.fn_product_route_override_immutable()` checks approved parent route status via ordinary SELECT and rejects changes to overrides of an APPROVED route; no explicit row lock in that function body. Need event-level/transactional coverage, not inference of a defect.
3. `costing.fn_resolve_effective_product_process_route(product_id, as_of_date)` resolves **approved, effective, unarchived product_process_route** rows and errors on multiple matches; it does not itself establish a writer lock protocol.
4. `costing.fn_effective_product_process_route_steps(route_id)` derives base and override steps from family route, product route and override records; its stable reader semantics are not writer concurrency protection.

Required before owner production approval: exact trigger events/other writers and their lock orders; parent assignment/override mutation fixtures; bounded lock/deadlock tests; correction-only forward/rollback scripts; independent review. No production change authorized or executed by this inspection.
