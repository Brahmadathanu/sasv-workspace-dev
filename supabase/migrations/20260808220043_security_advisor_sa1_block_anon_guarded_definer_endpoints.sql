-- backfilled from live schema_migrations on 2026-10-24, CI-016
REVOKE EXECUTE ON FUNCTION public.set_user_access_by_email_key(text,text,hub_access_level) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_access_by_email_key(text,text,hub_access_level) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.rpc_get_costing_refresh_context(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_costing_refresh_context(bigint) TO authenticated, service_role;