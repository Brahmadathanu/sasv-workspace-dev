# WP10 RM1 — Independent deep evaluation of completed Route Family Management (17 Nov 2026)

**Decision status:** Preventive server hardening justified; **NOT a live route-corruption incident**. Preserve the completed Route Family Management lifecycle, permissions, approval-history immutability and existing successful routing. No production SQL or client deployment authorised by this report.

## 1. Live data health — full population, not a sample

SELECT-only checks against Supabase project `qhmoqtxpeasamtlxaoak` on 17 Nov 2026 IST, using the actual `costing.fn_validate_effective_product_process_route(product_id, IST_date)`:

| Population | Evaluated | Route valid | Invalid | Unknown |
|---|---:|---:|---:|---:|
| Every product with one or more active SKUs | **455** | **455** | **0** | **0** |
| Active products relying on approved, currently effective subgroup mappings with no currently effective approved product mapping | **100** | **100** | **0** | **0** |

These are current-date operational results, not assurances about historical or future periods, and not a proof that a governed future writer can never invalidate a route. **No customer or SKU row was changed.** The earlier statement that '100 potentially exposed' must never be interpreted as '100 faulty'.

## 2. Existing completed architecture deserves to be retained

The live catalog already has:
- Authenticated direct INSERT/UPDATE/DELETE **denied** for the route-family and group, subgroup, product-map, family-route and route-step tables.
- Approved-object lifecycle immutability via `costing.fn_route_parent_immutable`, plus effective-date guards and separate WP04 source-epoch invalidation triggers.
- Draft → review → approval and governed supersession/inactivation RPCs with `require_permission('module:production-route-manager',true)`.
- Approval-reference, replacement effective-date, overlapping-history and archive protections.
- All **8 group-level route mappings are archived** (0 unarchived), with current active products using 355 approved product-level mappings and 100 effective subgroup-level mappings. The product and subgroup mapping tables also contain their approved history.

**Do not** rewrite the complete PRM architecture, broaden its permissions, replay old migrations, prevent legitimate route replacements, or use raw approved-row DELETE as a faithful live defect demonstration.

## 3. Actual narrowly demonstrated preventive gap

The live `public.rpc_inactivate_product_subgroup_route_family_mapping(bigint,date)`, MD5 `0e8f4efd43c3f527ddde5f9527e02391`, and `public.rpc_inactivate_product_route_family_assignment(bigint,date)`, MD5 `a6ce1b4ba1bd009a7974eff63e74da17`, change an approved mapping's lifecycle status to `INACTIVE` without validating the impact on active dependent products. They are authorised, governance-compliant writers; immutable/history/permission checks do not themselves guarantee **current-route continuity**.

In the disposable PostgreSQL fixture, a verbatim control-flow transcription of these two RPCs produced `active=true / route_valid=false` for affected active SKUs (**4/4 baseline assertions passed**). No such state was observed in production. Existing future-dated `effective_to` does not preserve a mapping once status becomes `INACTIVE`, because effective-route resolution requires `status='APPROVED'`.

Other potential route-changing writers (valid replacement, supersession of family-route versions, product-route override/version edits, `sub_groups.product_group_id`) must be inspected separately before claiming a global active-SKU invariant. Narrowly checked server helpers do not equal complete writer closure.

## 4. Additional live client/server discrepancy found

The current PRM client builder `buildInactivateProductSubgroupMappingArgs` includes a required UI **Reason** and sends `p_inactivation_reason` in addition to `p_mapping_id,p_effective_to`. However the live PostgreSQL routine has **only two parameters**, with no three-parameter overload. The client's `PRM_RPC_ARG_KEYS` includes the third key rather than removing it. This is an **exact named-RPC contract mismatch** and a possible PostgREST lookup failure when the user submits a nonempty reason.

Do not 'fix' this by silently dropping the reason. The current subgroup-mapping table contains `mapping_note` and `archive_reason` but not a dedicated `inactivation_reason` column, and the approved-row immutability guard does not permit arbitrary note mutation. A small governed server signature/audit resolution or an explicitly owner-approved UI policy is required. **No live signed-in POST was executed to reproduce HTTP behavior**, so this finding is proven at source/catalog contract level, not as a captured production UI error.

## 5. Smallest safe implementation boundary

**Keep the PRM lifecycle intact.** The server should reject only a change that would newly make a currently active SKU's effective route invalid/unknown, after considering product > subgroup > group precedence and a valid replacement committed in the same transaction. Preserve approved history and role permissions. Serialize with SKU activation and product subgroup edits under the independently tested CL15 parent-lock protocol. Do not blanket-block updates to an unrelated valid route mapping.

Existing **review-only**, non-migration prototype in draft PR #463: deferred after-update route-impact checks on product/subgroup/group mapping tables. Previous isolated regression:
- Baseline governed-inactivation reproduction **4/4 PASS**
- Mapping impact negative/positive controls **10/10 PASS**, including product override, valid replacement, group inheritance and no-active cases
- Genuine two-session activation/mapping interleavings **2/2 PASS**; [CI run 43937550713](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43937550713) full SUCCESS

That proof is **not** sufficient to install the prototype blindly: the use of deferred constraint triggers, fan-out locking and pre-existing invalid route handling still needs independent review. Future-date inactivation/replacement controls were added in the same draft PR, awaiting exact-head CI. Route-family version, route steps and product-route writers remain outside this scoped prototype.

## 6. Decision gates, economical execution

1. Finish independent writer-source and UI RPC parameter parity audit; fix the exact subgroup **Reason** contract without losing governance.
2. Review a **minimal server-side** veto/impact check at the existing governed mutation boundary, reusing the canonical validator and appropriate shared parent-row locks, rather than layering unrelated tables, caches or global mechanisms.
3. Check the real impact matrix for every active dependent product, positive replacement path, historical as-of effects, concurrency both orders, large subgroup fan-out and restricted-role denial. Preserve neutral/no-op approvals.
4. Prepare one exact, checksum-pinned, no-repeat transaction with scoped rollback and independent live definition hashes. No production operation before this review and the owner's exact deployment decision.
5. Retain RM1 in [issue #464](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/464); do not silently defer it, but also do not portray all 455 active products as faulty. WP10/WP11/WP12 remain OPEN (10/13 formally closed).

**No migration, writer RPC, feature flag, role, table grant, PWA, Electron package or costing run was changed during this assessment.**
