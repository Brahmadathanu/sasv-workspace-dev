# G2 final two candidate route functions — independently classified

Date: 20 October 2026. Status: VERIFIED READ-ONLY function definitions; no live changes.

## 1. costing.fn_validate_product_process_route(bigint)
This validates a specific product route ID. It obtains the base family route by ID, checks family assignment, product batch_size_ref ownership, effective override lineage, eligible scope and uniqueness. A separate existence test explicitly requires the referenced base family route **status='APPROVED'** (otherwise emits `BASE_ROUTE_FAMILY_ROUTE_NOT_APPROVED`). A historically valid product process route referencing a superseded predecessor family route may therefore fail validation even though its base ID exists and its steps remain immutable. **Classify HISTORICAL-STATUS CONTRACT DEFECT / conditional on product-route historical consumer**, not a generic date-scoped selector. Before changing, prove which call sites use historic product-route versions and establish the intended as-of date semantics (currently the function uses the product route's effective_from to look up family assignment, but the base-status test has no date requirement).

IMPORTANT: `public.production_batch_size_ref` foreign association is explicitly validated; preserve this control.

## 2. costing.fn_preview_route_family_route_steps(bigint,date,date)
This is a read-only **candidate preview**, locating the requested route by direct ID and verifying it is not archived. Its APPROVED predicate concerns **product-group mapping**, not whether the family route itself is historical. Returns `preview_only=true, approvable=false, records_created=0` and templates and production-work-log evidence. **Classify NOT A HISTORICAL ROUTE RESOLVER DEFECT. Do not alter** under narrow repair. Any production-work-log concerns are out of scope.

## Coordinated minimum repair scope
Confirmed:
1. `costing.fn_resolve_effective_route_family_route` historical as-of filtering excludes closed SUPERSEDED routes.
2. `costing.fn_product_process_route_readiness` independently uses an APPROVED-only as-of family-route selector.
3. `costing.fn_validate_product_process_route` uses an APPROVED-only base-route status test; requires separate history-use and as-of semantics validation before editing.

Preserve:
4. `costing.fn_route_family_onboarding_status` latest-version lifecycle display.
5. `costing.fn_preview_route_family_route_steps` explicitly chosen route candidate preview.

Next: inspect caller chain to #3, determine date meaning and test approved/superseded, historical product overrides, route404 or missing, and no-archive/invalid status rejection. No SQL alteration is yet approved or deployed. G2/CI-032 remain OPEN; route144 and runs122/128 untouched.
