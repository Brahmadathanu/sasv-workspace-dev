# WP10 RM1 — Newly approved mapping shadowing, legacy two-argument RPC and temporal policy

**17 Nov 2026 | Independent read-only live catalog + disposable PostgreSQL regression | REVIEW ONLY | No production incident found.**

## Critical additional surface: a new APPROVED mapping

Live `costing.fn_resolve_route_family_for_product(product_id,date)` prioritises (1) approved **product** assignment, (2) approved **subgroup** mapping, (3) approved **group** mapping, with effective-date and approved-family checks. Live `costing.fn_validate_effective_product_process_route` then requires a viable effective family-route and validates the product route where applicable.

The examined live `public.rpc_approve_product_route_family_assignment(bigint,text,date)`, MD5 `11c3bad591333b9991c92c992af6c44f`, verifies that the family itself is approved and effective. It does not call the canonical validator against the *post-approval* effective route for an active SKU. A newly approved product-level mapping can outrank an existing valid subgroup mapping even if the higher-precedence family lacks a current approved route version.

The **earlier** RM1 candidate only scheduled `AFTER UPDATE` and returned early unless `OLD.status='APPROVED'`. It therefore **did not cover** (a) an authorised DRAFT/IN_REVIEW → APPROVED promotion, or (b) an INSERT of a pre-approved mapping by a privileged writer. Green tests for inactivating old approved rows cannot establish that approval transitions are safe.

`scripts/wp10-g2-safeguards/route-map-approval-transition.test.mjs` provides a disposable PostgreSQL RED/GREEN proof:
- RED: valid subgroup-inherited active route -> approve a higher-precedence product mapping to an approved family with no effective route -> active route becomes invalid.
- GREEN: reject the unsafe promotion and approved INSERT; preserve valid subgroup route and old draft state; allow promotion when the new family has an effective approved route.
- The RM1 **review-only prototype** now attaches deferred constraint triggers to `AFTER INSERT OR UPDATE` and validates both previously-approved demotions and newly approved promotions. Its source is NOT a production migration.
- No live approval was attempted; no current route invalidity was identified (455/455 currently active-SKU products valid).

## Legacy reason bypass and contract continuity

The client requires a reason and passes `p_inactivation_reason`; live subgroup-inactivation RPC remains **two-argument** `(bigint,date)`, with EXECUTE granted to authenticated and service_role. The proposed three-argument overload plus private reason audit makes the *client* RPC compatible but does **not** stop other clients with edit permission invoking the legacy two-argument RPC without a reason. `route-map-reason-contract.test.mjs` records that bypass as a **positive test of an outstanding control gap**, not a FIX.

**Compatibility gate:** inventory older Electron clients and external callers before considering a revoke of `authenticated` EXECUTE on the legacy two-argument function. Removing access may break an installed legacy client; retaining access indefinitely prevents mandatory reason capture for all authorised writers. Any migration must explicitly state the tradeoff, staged cutover, immutable reason receipt and final privilege boundary. Do **not** silently drop the reason parameter, or revoke an existing RPC without fleet acceptance.

## Temporal and route version nuances

- A proposed future-dated `effective_to` does not keep a mapping effective if the RPC marks its status `INACTIVE` now. Tests require prevention of premature route loss.
- The live **family-route** resolver considers `APPROVED` and `SUPERSEDED` rows with applicable date windows. Family-route supersession is therefore not equivalent to subgroup mapping inactivation and needs dedicated as-of tests, not a blanket blocker.
- A current-date-only guard does **not** guarantee a future-dated approved replacement will be valid when its effective date arrives. Define the business rule and test current/future cutovers before any global route-integrity guarantee.
- Additional writers outside the mapping-table guard include Route Family lifecycle/status/effective dates, family-route lifecycle, product-route lifecycle, overrides and subgroup-parent changes. No blanket route-integrity closure without a bounded dependency matrix and independent tests.

## Gate and rollout disposition

This is **preventive safety work**. Keep the completed Route Family Management lifecycle, immutable approved history and existing permission checks. Source changes under [draft PR #463](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/463) are bounded to tests, review-only candidate SQL and documentation. [Issue #464](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/464) remains OPEN.

No SQL execution in production; no PR merge; no role/flag changes. **WP10/11/12 OPEN; formal programme 10/13.**
