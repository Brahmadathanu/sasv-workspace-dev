# WP10 G2 — UNAPPLIED SQL proposals

**Nothing here has been run against any database, and nothing here is a migration.** The directory is deliberately outside
`supabase/migrations`. Applying any file needs separate, exact, owner-authorised operational approval (issue #440 boundary).

| File | Creates | Purpose |
|---|---|---|
| `01_clock_and_batch_size_contract.sql` | `costing.fn_wp10_today_ist()`, `costing.fn_wp10_batch_size_state_as_of(product, date)` | Single clock read; reviewed date-parameterised batch-size contract (predicate identical to the live helper's inline predicate) |
| `02_essential_states_and_boundaries.sql` | `costing.fn_wp10_essential_states_as_of`, `costing.fn_wp10_boundary_dates` | Five-essential state at an explicit date; every effective boundary (`effective_from`, `effective_to + 1`) inside a window |
| `03_operational_expiry_horizon_rpc.sql` | `public.rpc_wp10_get_operational_expiry_horizon(int, bigint, int)` | Read-only, STABLE, paged 30-day operational lens |
| `04_active_sku_reparent_guard.sql` | trigger `trg_wp10_active_sku_reparent_guard` on `public.product_skus` | Rejects re-parenting an SKU that is active before and after |
| `05_product_route_impact_guard.sql` | triggers `trg_wp10_product_route_impact_before/after` on `public.products` | Rejects a `sub_group_id` change only when it newly invalidates the route of a product with an active SKU |
| `99_rollback_all.sql` | — | Drops every object above (no data touched) |

Apply order 01 → 02 → 03 → 04 → 05. Roll back with `99_rollback_all.sql` (single transaction; safe in any order of earlier partial application).

## Live dependency closure (must exist and be unchanged in the target database)
- `public.plm_sku_bom_revision_as_of(sku, date)`, `costing.fn_resolve_sku_mrp_as_of(sku, date)`, `costing.fn_resolve_sku_selling_price_policy_as_of(sku, date)`,
  `costing.fn_resolve_route_family_for_product(product, date)`, `costing.fn_validate_effective_product_process_route(product, date)`.
- Tables read: `public.production_batch_size_ref`, `public.plm_bom_revision`, the MRP and selling-policy tables behind the resolvers, `public.product_skus`, `public.products`.
- Permission helper `public.app_has_permission` and the existing targets `module:manage-products` / `module:costing-control-center` (**no new permission target, registry row or launcher entry**).
- **Not changed or rewritten:** `costing.fn_sku_activation_missing_items`, `rpc_set_product_sku_active`, `rpc_get_sku_activation_check`, the readiness fingerprint, the portfolio read, the five-essential list, CI-038a (`greatest(valuation date, current IST date)`), `LIVE_AS_OF`. Live-only functions are not rewritten for repository parity.
- The five-essential/route/validation chain was verified against the committed live catalogs; the route-validation callee chain (4 functions) is **not captured**, so its table closure is NOT PROVEN (G1 finding, unchanged).

## Grant implications
- Helper functions 01/02 and guard functions 04/05: `REVOKE ALL … FROM public, anon, authenticated`; they run as SECURITY DEFINER with a pinned `search_path`; only triggers/RPC 03 call them. `service_role` is not granted on the helpers.
- RPC 03: `REVOKE ALL` then `GRANT EXECUTE … TO authenticated` only; inside it requires `auth.uid()` and view permission on `module:manage-products` OR `module:costing-control-center`. This is the **only** new client-callable surface and it is read-only.
- Triggers 04/05 apply to every writer including privileged ones (service role, owner, SQL editor). They add rejections only for the two precise conditions above; the live product-side inactivation guard and SKU activation guards are untouched.
- No table privilege, RLS policy or registry row changes. Ordinary authenticated direct DML on `products` / `product_skus` stays denied as in the live catalog.

## Unresolved contracts (returned to the owner, not invented)
- **O3-U1** Amount sanity (zero/negative MRP, selling price, batch size) is not evaluated: the live helper's contract is resolution status only.
- **O4-U1** A read-only *impact preview* before a route-changing subgroup edit needs either a date/subgroup-parameterised route resolver (new logic) or a rollback-based dry run (a write). Neither is authorised.
- **O4-U2** An owner-approved *override/exception* workflow for guard 04/05 rejections is not defined; the reviewed path is deactivate → re-parent/complete → re-activate through the existing audited RPC.
- **O3-U2** Route boundary coverage is partial (captured route tables only); the panel says so.
- **O3-U3** Exact selection of the batch-size contract owner screen link: no verified destination exists (WP08 mapping), so the UI shows the screen name only.
- The target database must be checked for the live definitions of the five dependencies above before applying (see `docs/master-data-costing/WP10_G1_CATALOG_QUESTIONS_2026-11-15.sql`).

## Verification
Isolated PostgreSQL fixtures in `scripts/wp10-g2-safeguards/` (`horizon.test.mjs`, `guards.test.mjs`, `draft-sql-static.test.mjs`); live-verbatim function text where captured, labelled stand-ins elsewhere. The production writer, preview and build functions are never called. See `docs/master-data-costing/WP10_G2_IMPLEMENTATION_RECORD_2026-11-15.md`.
