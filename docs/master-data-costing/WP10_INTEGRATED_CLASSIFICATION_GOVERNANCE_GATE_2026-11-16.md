# WP10 — Integrated four-level classification governance gate (2026-11-16)

## Decision and scope
Consolidate remaining G2 classification-master hardening rather than iterating discovery notes. All four modules share one boundary: categories → sub-categories → product groups → subgroups. Keep WP10 OPEN until integrated server, client, negative-role, concurrency, deployed-asset and Electron compatibility acceptance.

## Implementation staged (UNAPPLIED)
| Level | Canonical Edit target | Server | Client |
|---|---|---|---|
| Categories | module:manage-categories | rpc_wp10_create/rename/delete_category | js/categories.js |
| Sub-categories | module:manage-subcategories | rpc_wp10_create/rename/delete_subcategory | js/subcategories.js |
| Product groups | module:manage-product-groups | rpc_wp10_create/rename/delete_product_group | js/product-groups.js + explicit kind selector |
| Subgroups | module:manage-subgroups | rpc_wp10_create/rename/delete_subgroup | js/subgroups.js |

SQL files: `scripts/wp10-g2-safeguards/review-only-parent-classification-governed-rpcs.sql`, `review-only-subgroup-governed-rpcs.sql`, each with dedicated `-rollback.sql`. Every function is SECURITY DEFINER with fixed search_path and `require_permission(...,true)`, and EXECUTE is granted to authenticated, not anon/PUBLIC. New functions accept only fixed columns, never arbitrary UPDATE payloads; parents and kind references are validated. Parent delete locks the row and rejects live children before DELETE. The existing FK constraints block other dependent records. Subgroup delete checks products, route mappings and scheme rules. DB remains authoritative.

Product-group `kind_id` is mandatory and has no default/BEFORE INSERT trigger; draft UI requires explicit `product_group_kinds` selection and RPC validates ID.

## Verification
- Source-level four-client/server assertions executed in connected tool context: **27/27 PASS** (2026-11-16); only static predicates, not SQL execution.
- Repeatable static verifier committed: `node scripts/wp10-g2-safeguards/verify-classification-crud-contract.mjs`, wired into `run-regression.sh`.
- Isolated PostgreSQL compilation/security role fixtures: **NOT TESTED**. Concurrent parent deletion/create, reassignment, activation CL15 and trigger interactions: **NOT TESTED in this integrated package**.
- Browser Editor/View-only/No-access, Electron older-client compatibility, merged-build provenance, rollback rehearsal, production readiness: **NOT TESTED**.
- Existing G2 CI runs do not imply this new package has passed until a run for its exact head has concluded green.

## Controlled rollout — requires separate owner approval
1. Independent code/security review, isolated PG function installation/rollback tests, and complete client regression tests. Confirm other direct-DML callers, including older Electron; resolve before revoke.
2. Owner authorizes exact reviewed RPC SQL and bounded rollback; install server-first, collect pre/post live objects and grants. No direct-table REVOKE yet.
3. Owner authorizes client merge/deployment; verify fresh Electron/PWA assets and Editor/View-only/No-access. Preserve existing SELECT contract.
4. Only after old-client compatibility and all four writers are addressed, owner authorizes a separate guarded REVOKE of INSERT/UPDATE/DELETE on all four tables from authenticated; verify role matrix and rollback. No grant changes until then.
5. Reconcile WP10 CL15 concurrency and G2 04/05/99 proposals (currently UNAPPLIED), flag status, tests and docs; do not mark unresolved races PASS.
6. Final evidence ledger and WP10 closure recommendation; owner signs closure.

## Important non-claims
This is a review-only integration package. No production SQL, merge, deploy, permission revoke, flag change or closure authorized by this document. Do not treat 27 static checks as production verification. A rollback that removes RPCs must never execute while a deployed client depends on them.
