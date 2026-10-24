-- backfilled from live schema_migrations on 2026-10-24, CI-016

revoke execute on function public.rpc_get_product_sku_readiness(bigint,date,text,bigint) from anon;
revoke execute on function public.rpc_get_product_sku_readiness(bigint,date,text,bigint) from public;
grant execute on function public.rpc_get_product_sku_readiness(bigint,date,text,bigint) to authenticated, service_role;
