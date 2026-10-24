-- backfilled from live schema_migrations on 2026-10-24, CI-016
REVOKE EXECUTE ON FUNCTION public.admin_recent_permissions(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recent_permissions(integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_user_suggest(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_suggest(text,integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_users_for_target(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_users_for_target(text,integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.app_get_permissions_core(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_get_permissions_core(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.app_has_permission_core(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_has_permission_core(uuid,text,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_admin_audit_logs(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_logs(integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_hub_access_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_hub_access_by_email(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.require_permission(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_permission(text,boolean) TO authenticated, service_role;