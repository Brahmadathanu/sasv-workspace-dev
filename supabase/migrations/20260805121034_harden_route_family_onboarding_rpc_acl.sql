-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke all on function public.rpc_create_route_family_onboarding_draft(jsonb,jsonb,jsonb) from public,anon;
revoke all on function public.rpc_clone_route_family_route_draft(bigint,date,text,text) from public,anon;
revoke all on function public.rpc_get_route_family_onboarding_status(bigint,date,date,bigint) from public,anon;
grant execute on function public.rpc_create_route_family_onboarding_draft(jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.rpc_clone_route_family_route_draft(bigint,date,text,text) to authenticated;
grant execute on function public.rpc_get_route_family_onboarding_status(bigint,date,date,bigint) to authenticated;