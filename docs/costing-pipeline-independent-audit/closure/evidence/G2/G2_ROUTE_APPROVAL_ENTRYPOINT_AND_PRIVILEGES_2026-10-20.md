# G2 route approval entrypoint and privileges — 20 October 2026

**Status: READ-ONLY VERIFIED; no route writes.**

Catalog search in `costing` for names containing `approv`, `lifecycle` and `route%copy%` returned `fn_enforce_prm_approval_reference`, manufacturing rate approval preview, single-approved W2 guard and an unrelated commercial lifecycle guard. No dedicated route-approve or route-supersede RPC appeared within that search. This is not proof of absence of a generic application-mediated workflow.

Inspected `costing.fn_enforce_prm_approval_reference()`: on INSERT of an APPROVED route, transition to APPROVED, or change of approval reference while approved, it requires `approval_reference` matching `^PRM-[A-Za-z0-9][A-Za-z0-9._-]*$`. **This is a format check, not evidence of a human approval or an authorised approval RPC.**

The parent table `costing.production_route_family_route` exposes INSERT/UPDATE/DELETE privileges to `postgres` and `service_role` (also SELECT); no authenticated write grant returned by `information_schema.role_table_grants`. Strong privileges are necessary but not sufficient for governance. Existing parent and child immutability, approval evidence constraints and approved-date overlap exclusion remain established.

Before proposing executable migration or approval transitions: inspect GitHub client/service implementation for route route version creation, source actor/approval audit, generic RPCs and transaction ordering; determine whether the effective-date closure of v1 and approval of v2 can be atomic while respecting the inclusive exclusion. Preserve as-of old-date resolver visibility: do not blindly mark v1 SUPERSEDED. Confirm WP04 readiness impact and exact route-step writer integration. No live changes. G2/CI-032 OPEN.
