# Run134 final 35 regional review investigation — 21 October 2026

Read-only exact remaining review population after governed actual-monthly scaling migration.

- 35 regional allocation rows across **18 SKUs**; 18 IK and 17 OK.
- All 35 rows use `common_basis_source=DEFAULT_NEW_SKU_EXISTING_PRODUCT`; all have `regional_actual_units IS NULL`. This is not a zero-unit reporting bug; SKU-region actual sales quantity unavailable.
- Product-level regional sales exist (minimum product-region evidence row count 1) and have positive billed values. Product-level history cannot be treated as new SKU-specific volume.
- 30 region rows reference a 10 common planning-unit quantity; 5 reference positive non-10 planning quantities. They are common quantity defaults, not evidence of realised demand.
- No source-correct basis to auto-mark these 35 READY. Existing acceptance RPC `costing.rpc_accept_regional_marketing_review` can approve explicit frozen SKU/region assumption with stated reason, where business authority confirms planning volume defensible. Do not approve on behalf of owner, especially no blanket acceptance of arbitrary 10-unit defaults.
- Keep approved auto-continuity for valid actual monthly sources and unchanged approvals. Do not add substitute product sales as SKU sales or create another framework.
- Next decision: explicitly approve using governed SKU planning defaults for these 18 SKUs with an attestation of business legitimacy, or keep 35 reviewed until SKU sales data arrives. Final refresh must be separately authorised after policy settlement; first reconcile frozen cost/source and final financial gate. G6 and Sheets HOLD.
