# WP10 RM1 / G2-CI-032 — reconciled current-route and historical-route decision gate

**17 Nov 2026 IST | Independent read-only Supabase recheck and repository evidence review | NO PRODUCTION WRITES**

## Decision: two separate contracts, not one global route invariant

1. **Current active-SKU readiness:** live canonical `costing.fn_validate_effective_product_process_route(product_id,IST_date)` returned **455/455 valid**, 0 invalid/unknown. Separate read-only projections at today+7 and today+30 each returned **455/455 valid** (holding the same currently active product cohort, not projecting future SKU activations). Within that cohort, all 100 currently subgroup-inherited products have valid routes. Preventive RM1 mapping-inactivation and new-approval shadowing guards remain justified, but **no existing current-data corruption was found**.
2. **Historical route selection and frozen costing runs:** an older independent audit **already identified** `costing.fn_resolve_effective_product_process_route` selecting `APPROVED` only, excluding historically `SUPERSEDED` predecessor versions. This is **not a newly discovered unreviewed defect**. Do not duplicate or override historical G2/CI-032 policy.

## October source-of-truth reconciliation

Read and retain, rather than silently supersede:
- `docs/costing-pipeline-independent-audit/closure/evidence/G2/G2_PRODUCT_ROUTE_RESOLVER_VERIFIED_2026-10-20.md`: confirmed predecessor invisibility; the proposed remedy requires separate retrospective eligibility policy.
- `.../G2_LIVE_HISTORICAL_ROUTE_OVERLAP_EXCEPTION_INVENTORY_2026-10-20.md`: naive approval of `SUPERSEDED` produces overlapping candidates; **10 family-route pairs and 7 product-route pairs**, with same-day inclusive boundaries and open-ended predecessors.
- `.../G2_SNAPSHOT_VS_RETROSPECTIVE_RESOLVER_CONTRACT_2026-10-20.md`: frozen snapshots must use their **stored route ID** and stored workload, never silently re-resolve or revalue on current route state. Explicit historical retrospective recomputation is a separate permission/policy decision with ambiguity fail-closed.
- `.../G2_FROZEN_RUN_SUPERSEDED_REFERENCE_EXCLUSION_2026-10-20.md`: run122/run128 DL and POH snapshots did not reference the *then-observed* non-archived superseded predecessors in those two snapshot tables; **not a global statement about all runs or all lineage**.

## Independent 17 Nov live read-only recheck

**Product-route predecessor cohort:** 9 non-archived SUPERSEDED rows; 7 missing effective_to; 7 overlapping APPROVED-successor pairs. At each predecessor's `effective_from`, the live canonical product-route resolver selected 0/9 predecessor IDs: **2 NULL** and **7 other approved route IDs**. Therefore changing the predicate from APPROVED to APPROVED/SUPERSEDED without first handling overlapping periods would create historical ambiguity. Do **not** adopt this as a quick fix.

**Family-route predecessor cohort:** 19 non-archived SUPERSEDED rows; 1 missing effective_to; 10 overlapping APPROVED-successor pairs. The live family-route resolver already allows APPROVED/SUPERSEDED with date filters and newest-first preference. This policy asymmetry predates WP10. A fix must preserve accepted snapshot lineage and apply an explicitly designed ambiguity policy rather than copy either side indiscriminately.

**Present-day product-route lifecycle:** 108 non-archived APPROVED product route versions, 9 non-archived SUPERSEDED and 0 approved future-dated versions (as observed); no production mutation made.

## Current-route Route Manager writer gates

- **RM1 scope under review:** product/subgroup/group route-map `AFTER INSERT OR UPDATE` candidate checks canonical route validity after effective new-approval or old approved-status transitions. Earlier old-APPROVED-only prototype lacked DRAFT→APPROVED and approved INSERT coverage. Isolated RED/GREEN proof tests show the gap and candidate response.
- **Separate CL15 lock:** activation parent SHARE lock is necessary for concurrency with product-map impact checks; do not apply original 05 alone.
- **Legacy inactivation reason:** UI sends reason; the live two-arg RPC does not accept it. Three-arg private audit wrapper is only compatible when clients use it; existing authenticated EXECUTE for two-arg overload remains an audit bypass until separately governed fleet cutover.
- **Subgroup parent:** `authenticated` currently has UPDATE on `public.sub_groups.product_group_id` with sign-in-only RLS. Although all group-level mappings are currently archived and this does not imply a live incident, a future group-inheritance reopening needs a separate privileges and route-impact design.
- **Other route writers:** `rpc_approve_route_family_route` and `rpc_approve_product_route` explicitly call their own route validators; both enforce meaningful approval references. `rpc_supersede_product_route` sets old status SUPERSEDED and `effective_to = new.effective_from - 1`, which matters for retrospective policy. `rpc_supersede_route_family_route` also changes status/effective_to but the family route resolver considers historic SUPERSEDED versions. Review effective-date cutovers and the selector separately rather than imposing blanket bans on legitimate successor approvals.

## Distinct stop conditions and acceptance

**Release gate A, current-route safety:** independent mapping impact+approval+activation concurrency test, proper lock order/fan-out, application JWT/permissions, no interrupted valid replacement, exact atomic installation and receipt-checked rollback. A global guarantee requires inspecting route-family/product-route/subgroup-parent writers too. User's generic 'go ahead' is authority for engineering and tests, **not** an unbounded production DDL/revoke.

**Release gate B, historical CI-032:** preserve frozen run references, inspect exact overlap exception provenance, define historical retrospective eligibility and ambiguity behavior and then test distinct historical as-of dates. Remains OPEN as an explicit historical-policy debt. **Do not fold it into current RM1 and accidentally recalibrate approved costing runs.**

**Evidence provenance:** live read-only queries run in this session; repository older G2 evidence documents are dated evidence with their own narrower scope. PR [#463](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/463) remains review-only, and issue [#464](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/464) remains OPEN. WP10/11/12 OPEN; programme 10/13 formally closed. No production SQL, role, flag or business data updated.
