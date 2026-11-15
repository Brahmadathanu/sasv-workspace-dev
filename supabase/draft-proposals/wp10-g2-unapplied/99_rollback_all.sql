-- WP10 G2 ROLLBACK — UNAPPLIED. Removes every object the proposals 01-05 would create. No data is touched; no live-only function is altered.
begin;
drop trigger if exists trg_wp10_product_route_impact_after on public.products;
drop trigger if exists trg_wp10_product_route_impact_before on public.products;
drop trigger if exists trg_wp10_active_sku_reparent_guard on public.product_skus;
drop function if exists public.fn_wp10_product_route_impact_after();
drop function if exists public.fn_wp10_product_route_impact_before();
drop function if exists public.fn_wp10_guard_active_sku_reparent();
drop function if exists public.rpc_wp10_get_operational_expiry_horizon(integer, bigint, integer);
drop function if exists costing.fn_wp10_boundary_dates(bigint, bigint, date, date);
drop function if exists costing.fn_wp10_essential_states_as_of(bigint, bigint, date);
drop function if exists costing.fn_wp10_batch_size_state_as_of(bigint, date);
drop function if exists costing.fn_wp10_today_ist();
commit;
