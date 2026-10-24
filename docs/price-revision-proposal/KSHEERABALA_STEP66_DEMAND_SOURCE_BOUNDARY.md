# G0 Step 66 — Costing demand driver versus physical production requirement
2026-10-22, read-only verified. No run136 mutation.

The live function costing.fn_preview_shared_standard_batch_route_foundation composes its product monthly quantity driver from coalesce(commercial_product_base_qty,0) + coalesce(monthly_internal_demand_base_qty,0). The inputs come from commercial_recipients and costing.fn_internal_source_product_demand_as_of(...). This is a *cost-allocation demand driver*, not a verified stock-adjusted production order. A targeted costing-schema table search returned no named stock/net-manufacturing requirement table; this is not proof that inventory-aware MRP logic does not exist elsewhere.

Implementation boundary: retain current governed commercial-plus-internal demand for pricing standard-cost simulations; never call it actual net production demand or write product stock based on it. For fixed-yield joint process, a tentative standard-cost joint batch equivalent is max(D101/105,D41/5) from those governed demand drivers. Always label proxy assumptions. Demonstrated run136: 9.8007/105=0.09334 and 0.091/5=0.0182, jointly implied 41-output0.4667kg; 0.3757kg above sales proxy is modeled physical co-output, not sale or stock booking.

Do not implement a new inventory planning system for price revision G0. Model the co-process conversion workload once, allocate to beneficiaries by explicitly approved policy, retain downstream SKU sales-based cost attribution and separate BOM/PM. Do not approve a monetary split from output weights alone without policy decision. Need full tests for labour/overhead pool conservation, route provenance, manual oil filtration workload, AU9 October activation, immutable run136.

G0 OPEN. Next step move from analytical research to concrete minimal implementation/gate, with chosen policy approval only if essential. No DB writes.
