# WP-02 — Product + SKU Lifecycle Redesign

## Objective
Audit and redesign Product → SKU(s) → operational foundations → costing foundations without assuming activation policy.

## Why this work pack exists
See MASTER_PROGRAMME.md and the approved programme handoff. This file is the durable authority for this work pack.

## Entry criteria
All prerequisite work packs in MASTER_PROGRAMME.md are completed and verified.

## Scope
Product detail is the lifecycle anchor. Governed child-SKU create/update/activate/deactivate actions belong under the Product lifecycle surface. Per-SKU WP01 readiness/remediation is shown separately and consumed from the canonical server contract. Activation remains explicit and independent from readiness.

## Explicit exclusions
No work belonging to later gates; no guessed data; no unrelated/e-Aushadhi changes; no direct table writes; no client-side duplicate readiness authority; no client implementation before G2 design/contract is complete and independently audited.

## Current-state findings
### WP02-G1 — current lifecycle surface / contract-consumption audit
- Entry criteria are satisfied: WP00 and WP01 are completed and verified; current main is `142c7fe5850af24efb2634582b354103e2d92845`.
- Current Product client `js/products.js` already uses governed Product mutation RPCs:
  - `rpc_create_product`
  - `rpc_update_product`
  Product deactivation is implemented as a governed Product update to status `Inactive`.
- Current Product client does not expose child-SKU lifecycle management and does not consume the WP01 readiness RPC.
- Live server already exposes the governed child-SKU lifecycle RPCs required by WP02:
  - `rpc_create_product_sku(p_product_id, p_pack_size, p_uom, p_is_active, p_is_sample, p_reason, p_approval_reference)`
  - `rpc_update_product_sku(p_sku_id, p_pack_size, p_uom, p_is_sample, p_reason, p_approval_reference)`
  - `rpc_set_product_sku_active(p_sku_id, p_is_active, p_reason, p_approval_reference)`
- Live server already exposes the canonical WP01 readiness contract:
  - `rpc_get_product_sku_readiness(p_sku_id, p_period_start, p_context_type, p_refresh_run_id)`
- Live server enforces Product/SKU activation consistency through:
  - `fn_guard_active_sku_requires_active_product`
  - `fn_guard_product_inactivation_requires_no_active_skus`
  Therefore an active SKU cannot belong to an inactive Product, and a Product cannot be inactivated while any child SKU remains active.
- Live lifecycle inventory at G1:
  - Products: 1,342 total = 639 Active + 703 Inactive.
  - SKUs: 1,793 total = 637 Active + 1,156 Inactive.
  - 54 Active Products have no SKU at all.
  - 179 Active Products have no Active SKU.
  - 0 Inactive Products have an Active SKU.
- These counts prove that Product Active, presence of SKU, presence of Active SKU, and WP01 readiness are distinct conditions. Existing data must not be auto-normalised or activation inferred from completeness.
- No server lifecycle mutation gap was found for Product/SKU create/update/activation. The missing piece is the Product lifecycle client surface and correct consumption of the already-governed readiness contract.

## Approved design / contract
Not yet approved. G2 is now active.

### G2 design constraints already established by G1/WP01
1. Product detail remains the lifecycle anchor; no new top-level module is introduced in WP02.
2. Child SKUs are managed as governed children of the selected Product.
3. Create/update/activate/deactivate actions call the existing server RPCs only; no direct writes to `product_skus`.
4. Product activation/deactivation and SKU activation/deactivation remain explicit user actions governed by existing server rules.
5. Readiness is never used to silently activate or deactivate a Product/SKU.
6. Each SKU may display WP01 readiness/remediation, but the client must consume `rpc_get_product_sku_readiness` and render its server status/detail; it must not recreate dependency precedence or readiness in JavaScript.
7. Lifecycle controls and readiness/remediation are visually and semantically separated so Active/Inactive is never presented as equivalent to READY/REVIEW_REQUIRED/BLOCKED.
8. Product inactivation UX must account for the server guard requiring all child SKUs to be inactive first; client guidance may explain the blocker but must not bypass it.
9. Existing historical/effective-dated downstream evidence is not mutated by lifecycle UI.
10. G2 must define exact Product-detail information architecture, action availability, per-SKU summary fields, readiness-context selection/defaulting, permissions, error handling and post-mutation refresh behaviour before any client implementation starts.

## Milestones
- [x] Current-state/audit gate
- [~] Design/contract gate
- [ ] Implementation gate
- [ ] Focused verification
- [ ] Independent audit
- [ ] Merge/post-merge proof
- [ ] Final handover

## Current Gate
`WP02-G2 — lifecycle surface and WP01 contract-consumption design`

## Gate Status
[~] IN PROGRESS

## Required to close
Freeze and independently audit the Product-detail lifecycle design covering:
- child-SKU list/detail structure and Product anchoring;
- exact governed create/update/activate/deactivate action model;
- Product/SKU activation dependency behaviour and user-facing blocker handling;
- exact consumption/rendering contract for `rpc_get_product_sku_readiness`;
- required readiness context inputs without client recomputation;
- permissions, audit-reason/approval-reference capture, loading/error states and post-write refresh;
- proof that no direct table mutation or duplicate business authority is introduced.

## Next gate
`WP02-G3 — isolated client implementation`, only after G2 is completed and independently approved.

## Server changes
None in WP02-G1. WP02 reuses the existing Product/SKU lifecycle RPCs, lifecycle guards and WP01 readiness RPC.

## Client changes
None yet. Current-main Product client was audited only.

## Tests / verification
- Verified current main SHA: `142c7fe5850af24efb2634582b354103e2d92845`.
- Verified live Product/SKU counts and lifecycle-gap counts directly from Supabase.
- Verified live presence/signatures of Product/SKU mutation RPCs, lifecycle guard functions and WP01 readiness RPC.
- Verified current-main `js/products.js` Product mutation path and absence of child-SKU lifecycle/readiness consumption.

## Decisions created
No new locked decision yet. G2 constraints inherit DEC-002, DEC-003, DEC-004, DEC-006 and DEC-007.

## Risks
Premature implementation before design closure; conflating Active with READY; client duplication of server readiness logic; direct table writes; lifecycle UX that obscures server activation guards; accidental mutation of downstream historical/effective-dated evidence.

## Parked discoveries
None added in G1.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current.

## Final handover
Not started.
