-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke execute on function costing.fn_default_cost_period_valuation_date(date) from public, anon;
grant execute on function costing.fn_default_cost_period_valuation_date(date) to authenticated, service_role;

revoke execute on function costing.fn_india_business_date() from public, anon;
grant execute on function costing.fn_india_business_date() to authenticated, service_role;

revoke execute on function costing.fn_product_group_id_for_product(integer) from public, anon;
grant execute on function costing.fn_product_group_id_for_product(integer) to authenticated, service_role;