-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- SA-1C Wave 2: remove anonymous execution from remaining mutating SECURITY DEFINER endpoints.
-- Preserve authenticated application and trusted worker execution explicitly.

REVOKE EXECUTE ON FUNCTION public.mrp_plm_issue_lines_ingest_range(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mrp_plm_issue_lines_ingest_range(date,date) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mrp_pm_issue_lines_save(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mrp_pm_issue_lines_save(jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mrp_rm_overlay_season_build(date,date,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mrp_rm_overlay_season_build(date,date,text,text,boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mrp_rm_rebuild_for_item(date,bigint,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mrp_rm_rebuild_for_item(date,bigint,boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mrp_rm_reclassify_issue_allocations_month(date,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mrp_rm_reclassify_issue_allocations_month(date,boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.proc_indent_accept_recommended_vendors(bigint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_indent_accept_recommended_vendors(bigint,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.proc_indent_autoclose_if_fully_allocated(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_indent_autoclose_if_fully_allocated(bigint) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.proc_indent_autorecommend_on_approval(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_indent_autorecommend_on_approval(bigint) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.proc_indent_clear_inactive_unselected_recommendations(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_indent_clear_inactive_unselected_recommendations(bigint) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.proc_indent_clear_inactive_vendor_decisions(bigint,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_indent_clear_inactive_vendor_decisions(bigint,boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.proc_indent_recommend_vendors_batch(bigint,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_indent_recommend_vendors_batch(bigint,integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.proc_indent_recommend_vendors_bulk(bigint,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_indent_recommend_vendors_bulk(bigint,boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.proc_vendor_alias_sync_from_sources(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_vendor_alias_sync_from_sources(integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.revoke_user_access(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_user_access(uuid,text) TO authenticated, service_role;