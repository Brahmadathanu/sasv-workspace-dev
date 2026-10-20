# G2 product route public RPC source inspection — 20 October 2026

Status VERIFIED read-only SQL; NO live changes.

Four `public` RPCs directly call `costing.fn_validate_product_process_route(bigint)`:

- `rpc_approve_product_route(bigint,text)` (`d4dc989e28e8b096a9abb5300349965a`): SECURITY DEFINER, permission `module:production-route-manager` write, meaningful approval reference, REVIEW_REQUIRED, effective_from; invokes validator before approval; successor old product route transitions SUPERSEDED with effective_to = new start -1.
- `rpc_submit_product_route_for_review(bigint)` (`3df5546eae854f033c7711083138f469`): production-route-manager write permission, requires DRAFT, invokes same validator before REVIEW_REQUIRED.
- `rpc_validate_product_route(bigint)` (`6cf023fff8794517a80e141fe9dca395`): requires route-manager read permission, returns same validator result.
- `rpc_get_product_route_detail(bigint)` (`620853d39d3a19a4f5de8824fcf6b253`): requires route-manager read permission, exposes validator result plus route and effective-step details.

**Critical policy separation:** Broadening the shared validator to accept every SUPERSEDED base route would weaken approval and review checks for new routes. Instead, keep stringent prospective eligibility for approval/submission while providing a valuation-date-aware historical validation path for previously approved product routes. Investigate whether minimal conditional logic in existing shared validation plus explicit current approval gate is safer than separate validators; avoid duplicating engines. Full call-chain integration tests required, and verify product-route succession also affects historical product-route lookup. Source definitions retrieved read-only; no migration or test of revised SQL was run.

G2 and CI-032 remain OPEN, run122/128 immutable, G4 OFF. No live writes.
