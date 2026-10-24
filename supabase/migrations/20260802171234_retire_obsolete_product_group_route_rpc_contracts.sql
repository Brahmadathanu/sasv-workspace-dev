-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop function if exists public.rpc_get_production_route_manager_readiness(date,text,text,integer,integer,integer);
drop function if exists public.rpc_get_production_route_master_options(integer,integer,date);

drop function if exists public.rpc_get_product_group_route_detail(bigint);
drop function if exists public.rpc_get_product_group_route_history(integer);
drop function if exists public.rpc_preview_product_group_route_candidate(integer,date,integer);
drop function if exists public.rpc_create_product_group_route_draft(integer,text,date,text,text,text,bigint);
drop function if exists public.rpc_update_product_group_route_draft(bigint,jsonb);
drop function if exists public.rpc_upsert_product_group_route_step(bigint,bigint,jsonb);
drop function if exists public.rpc_delete_product_group_route_step(bigint,bigint);
drop function if exists public.rpc_validate_product_group_route(bigint);
drop function if exists public.rpc_submit_product_group_route_for_review(bigint);
drop function if exists public.rpc_approve_product_group_route(bigint,text);
drop function if exists public.rpc_supersede_product_group_route(bigint,bigint);