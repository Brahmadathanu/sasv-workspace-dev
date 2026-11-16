# WP10 / RM1 — Production Route Manager mapping-impact safety gate

**Date:** 17 November 2026 IST  
**Status:** OPEN — must be resolved or explicitly accepted as a named safety risk before treating WP10 route governance as complete. This is **not** a reproduced production-data incident and **not** a currently authorised production migration.

## Verified live permissions and existing safeguards

Read-only catalog inspection of Supabase `qhmoqtxpeasamtlxaoak` found that `authenticated` has **no direct INSERT/UPDATE/DELETE** on the route-family, product, product-group, product-subgroup and family-route tables. Approved route-family/group/subgroup rows also have `costing.fn_route_parent_immutable` guards that **reject a direct DELETE** of an approved row. This corrects an overbroad interpretation of the first synthetic fixture: its successful raw `DELETE` of an approved subgroup mapping is **not representative of a normal authorised production path**. Do not cite that standalone synthetic deletion as proof of a live bypass.

However, existing authorised, SECURITY DEFINER RPCs expose governed route-changing transitions:
- `public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date)` (live MD5 `0e8f4efd43c3f527ddde5f9527e02391`) sets an approved subgroup mapping to `INACTIVE`, updating `effective_to`, and requires the existing Production Route Manager edit permission. No check of active SKU descendants or resulting effective route is in the live body.
- `public.rpc_inactivate_product_route_family_assignment(bigint,date)` (MD5 `a6ce1b4ba1bd009a7974eff63e74da17`) similarly inactivates an approved **product-level** assignment without validating whether active SKUs retain routes.
- `rpc_approve_product_subgroup_route_family_mapping` (MD5 `aa730dd371974f479828c7974e2abb63`) and `rpc_approve_route_family_mapping` (MD5 `afad5c67f5cef27700aafdee90f2416c`) can supersede an approved existing mapping as part of a multi-row transaction. A guard must preserve valid-to-valid replacement, not reject a transient intermediate row state.
- `rpc_supersede_route_family_route` (MD5 `a450c7e1300797271924c10321e66f55`) changes the effective family-route version; family-level and product-route lifecycles require their own review.
- Product subgroup parent reassignment can change inherited group-route resolution without touching `products.sub_group_id`; separate impact review required.

The relevant current live immutable triggers, effective-date checks and WP04 readiness epoch triggers were enumerated. **An epoch invalidation is not a safety veto.** Existing lifecycle guards preserve history but do not establish a proof that active SKU descendants remain route-ready after a governed inactivation.

## Isolated proof scope

`scripts/wp10-g2-safeguards/route-map-lifecycle-gap.test.mjs` transcribes the two authorised RPC transition bodies into the disposable PostgreSQL G2 test harness and tests their effects with a modelled route resolver. It explicitly labels the RPCs as a **control-flow transcription**, not a live authenticated RPC call or production mutation. Its assertions are: (1) approved subgroup mapping may be inactivated, (2) an active SKU may then lack route; (3) approved product assignment may be inactivated, (4) another active SKU may then lack route. The full CI receipt must be attached after completion; do not claim PASS solely because the test file exists.

This is separate from CL15's proven first-activation/subgroup-edit race. Original guard 05 plus the candidate activation parent-lock correction does **not** cover route mapping lifecycle changes.

## Required corrective contract (no unreviewed blanket block)

1. At an authoritative **route-changing transition**, derive *all potentially affected active products/SKUs*, including family/group/subgroup/product mapping precedence and any affected route family/version. Evaluate the **canonical effective product route** after the complete transaction, using the appropriate current IST and governed validity dates. A product-level override or a correctly approved replacement that preserves a valid route must be allowed.
2. A change that would newly remove the effective valid route of any active SKU must fail closed with a clear remediation: approve a suitable replacement first, or deactivate the affected SKUs through the audited lifecycle, then retry. Unknown validity is **review required**, never silently passed.
3. Serialize route changes with SKU activation and product subgroup moves using a *consistent* product-row lock protocol. Mere BEFORE/AFTER counts with ordinary SELECT are insufficient (CL15). Multi-row approved mapping replacement must be handled as one **atomic transaction**: do not reject an intermediate `SUPERSEDED` status before the new approved mapping is present.
4. Validate fan-out scaling (group/subgroup maps may affect many products), bounded lock waits, consistent lock order, deadlock behavior, and **privileged writer coverage**. A deferred constraint trigger may be considered for final-state checking, but requires independent scrutiny of locking, transaction visibility, historical effects, and rollback; no design is approved simply by being deferred.
5. Review effective-date and historical correction rules. The intended hard invariant is protecting *currently active* SKU viability; do not retroactively mutate historical approved route records or block legitimate future-dated changes without defining a specific operational policy.
6. Keep unrelated already-applied WP10 01/02/03/06 and classification RPCs untouched. No new auth grants or bypass flags.

## Owner / implementation decision

**Do not waive RM1 into a silent backlog entry.** Treat it as a separate unresolved governed-master safety issue requiring a tested correction and explicit owner decision. Keep #463 as CL15 atomic-candidate **review only**; do not package its SQL as if RM1 were solved. If scope is split for release, record the exact risk and residual owner and do not describe route integrity as end-to-end protected.

WP10/WP11/WP12 remain OPEN (formal 10/13). Genuine signed-in WP12, 11-flag matrix and installed Windows Electron are unchanged by this investigation. No production SQL, role, flag, costing or business-data change was performed.
