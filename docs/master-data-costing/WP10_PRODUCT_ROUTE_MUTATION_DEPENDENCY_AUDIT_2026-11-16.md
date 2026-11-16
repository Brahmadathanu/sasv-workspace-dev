# WP10 — Product route dependency and mutation coverage (2026-11-16)

**Status: DESIGN / AUDIT, not an approved migration.** Keep SKUs bound to `product_skus.product_id`; do not copy product classification onto SKUs. This is an extension of the WP10 safeguard review, not a new SKU schema.

## Invariant

For any ACTIVE SKU, its parent product must remain active and have an effective, approved manufacturing route under the existing canonical costing route resolver. This is a readiness invariant, not a guarantee that every existing production batch is eligible; BOM and other SKU essentials remain separately governed. Fail closed when evaluation is unavailable or malformed; do not auto-deactivate SKUs.

## Mutation inventory and risk

| Mutation surface | Product/SKU relationship | Route risk | Coverage / required action |
|---|---|---|---|
| SKU activation (RPC or privileged table write) | product_id unchanged | Newly active SKU can depend on missing route | CL1–CL9 fixture candidate verified; deadlock/order audit outstanding |
| SKU reparent | product_id changes | Destination route may be invalid | Proposal 04 guard (UNAPPLIED); verify direct writer and concurrency |
| Product subgroup update | product_id unchanged | Effective route changes | Proposal 05 (UNAPPLIED) + parent-lock candidate; CL3/CL6/CL8 verified |
| Product deactivation | product_id unchanged | Parent ceases to be active | Inventory existing product writer/trigger and direct writes; not proven by CL1–CL11 |
| Subgroup reassigned to another product group | product_id unchanged | Group fallback route may change for many products | OUTSIDE proposal 05; discover exact writer and dependency set, design impact preflight |
| Subgroup or group route-family mapping insert/update/delete/status/effective dates | product_id unchanged | Effective route may disappear or switch for many products | OUTSIDE proposal 05; audit tables, writer permissions and date-effective semantics |
| Route-family, route and step approval/status/effective dates | product_id unchanged | Previously valid process route may become invalid | OUTSIDE proposal 05; audit exact canonical dependencies and govern changes at their source |
| Product-specific route overrides | product_id unchanged | Effective route changes | Audit writer and precedence in canonical resolver |

## Design decision to review

- Maintain the `product_id` foreign key as the SKU ownership link. Do **not** add classification FK to SKU records.
- Keep classification and route resolution on the product side; SKU readiness calls the canonical route validator for the current parent.
- For mutations affecting many products, use a bounded read-only impact preview identifying affected active products/SKUs, followed by an atomic writer guard. A preview alone cannot prevent a race.
- If the effective-dated route model supports preserving a valid predecessor route, allow an approved transition with a validated cutover date; do not assume future mappings are safe without checking actual validity windows.
- Prefer deterministic lock ordering and narrow scope. A row-level SKU BEFORE trigger may already hold a SKU lock when acquiring the parent lock, so opposing parent-first writers must be deadlock-tested before any promotion.
- Unknown impact => review required; do not silently proceed. Provide remediation: establish approved route, choose supported classification, or governed SKU deactivation.

## Evidence and boundaries

- GitHub Actions [run #19](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43802068365): CL1–CL9 PASS, disposable PostgreSQL only.
- GitHub Actions [run #20](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43803258811): CL10/CL11 PASS, correction-only fixture rollback and fail-closed repeated rollback.
- These tests **do not** establish safety of subgroup/group mapping edits, effective-dated changes, route-step edits or all lock orders.
- Guard 05 and correction remain UNAPPLIED; no Supabase writes, deployment, flag changes, permissions changes or closure authorised.

## Next engineering gate

1. Enumerate canonical route validator table dependencies and all privileged writers/trigger guards using read-only live catalog and pinned source.
2. Build a mutation/lock matrix with positive, negative, concurrent and multi-product tests; test lock timeouts and deadlocks with explicit bounds.
3. Prepare the smallest safe guarded proposal(s), each with provenance receipts, exact rollback and independent review. Any expansion beyond approved proposal 05 requires explicit owner approval before live application.
