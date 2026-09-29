# WP-02 — Product + SKU Lifecycle Redesign

## Objective
Audit and redesign Product → SKU(s) → operational foundations → costing foundations without assuming activation policy.

## Why this work pack exists
See MASTER_PROGRAMME.md and the approved programme handoff. This file is the durable authority for this work pack.

## Entry criteria
All prerequisite work packs in MASTER_PROGRAMME.md are completed and verified.

## Scope
As defined by the approved programme handoff; refine only from audited live architecture and explicit decisions.

## Explicit exclusions
No work belonging to later gates; no guessed data; no unrelated/e-Aushadhi changes.

## Current-state findings
Audit started from the closed WP01 server-authoritative readiness contract. Current repository and live lifecycle surfaces must be inventoried before design.

### G1 current lifecycle authority and client-surface findings
- Product lifecycle UI is `manage-products.html` + `js/products.js`, permissioned by `module:manage-products`.
- Product create/update/deactivate use governed `rpc_create_product` / `rpc_update_product` with required business reason and optional approval reference. Product deactivation is retained-state inactivation, not deletion.
- Server has governed SKU lifecycle RPCs: `rpc_create_product_sku`, `rpc_update_product_sku`, `rpc_set_product_sku_active`. All are SECURITY DEFINER wrappers gated by `module:manage-products`, require authenticated actor + business reason, and write `product_sku_master_audit`.
- SKU creation validates Product existence, positive pack size, nonblank UOM and duplicate Product+pack+UOM; default active state is fail-safe false when omitted. SKU activation/deactivation is a distinct audited lifecycle event.
- Product inactivation is guarded by `fn_guard_product_inactivation_requires_no_active_skus`: a Product cannot become Inactive while any active child SKU remains.
- Current repository search finds no client invocation of `rpc_create_product_sku`, `rpc_update_product_sku` or `rpc_set_product_sku_active`. The current Manage Products client therefore exposes Product lifecycle but not the already-governed SKU lifecycle authority.
- Current Manage Products also does not consume `rpc_get_product_sku_readiness`; lifecycle editing and downstream readiness/remediation are disconnected in the current UI.
- Live population at audit time: 1,342 Products = 639 Active + 703 Inactive; 1,793 SKUs = 637 Active + 1,156 Inactive, including 29 sample SKUs. There are 54 Active Products with no SKU and 179 Active Products with no active SKU. There are zero Inactive Products with an active SKU, consistent with the inactivation guard.
- The 54/179 populations are not automatically defects: WP01 locks lifecycle as independent from readiness. They are evidence that Product Active cannot be interpreted as “has an active SKU” or “costing ready”.
- Existing Product/SKU audit history proves governed lifecycle writers are already in use at server level; WP02 should surface/consume them rather than introduce direct table writes or a second lifecycle model.

### G1 design implication
The Product detail should remain the lifecycle anchor, with child SKU lifecycle presented in the same governed Product context. Readiness must be consumed from the WP01 server RPC per SKU and displayed as a separate dimension; it must not be used to silently rewrite Product/SKU Active state. Creation/edit/activation actions remain server RPC actions, and incomplete/new SKUs remain visible with server-derived remediation.

## Approved design / contract
Not yet approved.

## Milestones
- [~] Current-state/audit gate
- [ ] Design/contract gate where applicable
- [ ] Implementation gate where applicable
- [ ] Focused verification
- [ ] Independent audit
- [ ] Merge/post-merge proof where applicable
- [ ] Final handover

## Current Gate
`WP02-G1 — current lifecycle surface and contract-consumption audit`

## Gate Status
[~] IN PROGRESS

## Required to close
Inventory the current Product/SKU lifecycle server and client surfaces, creation/edit/activation paths, and existing readiness/remediation consumption. Prove where lifecycle and readiness are currently conflated or disconnected. No redesign implementation in G1.

## Next gate
`WP02-G2 — lifecycle/redesign contract` after G1 evidence is documented and independently checked.

## Server changes
None in G1. Existing governed Product/SKU lifecycle and WP01 readiness authorities are being audited for reuse.

## Client changes
None in G1. Current Manage Products gap is documented; design precedes implementation.

## Tests / verification
G1 evidence uses current-main repository search/file inspection plus live Supabase function definitions and population invariants. No mutation performed.

## Decisions created
None.

## Risks
Premature assumptions; scope drift; duplicated authority; loss of effective-dated/history semantics.

## Parked discoveries
None.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current.

## Final handover
Not started.
