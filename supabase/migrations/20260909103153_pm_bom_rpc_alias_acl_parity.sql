-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke execute on function public.rpc_pm_map_clear(bigint) from anon;
revoke execute on function public.rpc_pm_map_set(bigint,bigint) from anon;
revoke execute on function public.rpc_pm_override_counts() from anon;
revoke execute on function public.rpc_pm_ovr_delete(bigint) from anon;
revoke execute on function public.rpc_pm_ovr_list(bigint) from anon;
revoke execute on function public.rpc_pm_ovr_upsert(bigint,bigint,text,bigint,numeric,text,numeric,boolean,text) from anon;
revoke execute on function public.rpc_pm_preview_effective(bigint) from anon;
revoke execute on function public.rpc_pm_rebuild_all(boolean) from anon;
revoke execute on function public.rpc_pm_rebuild_all(boolean,integer,integer) from anon;
revoke execute on function public.rpc_pm_rebuild_skus_for_tpl(bigint) from anon;
revoke execute on function public.rpc_pm_tpl_delete_line(bigint) from anon;
revoke execute on function public.rpc_pm_tpl_list_lines(bigint) from anon;
revoke execute on function public.rpc_pm_tpl_renumber(bigint) from anon;
revoke execute on function public.rpc_pm_tpl_upsert_header(text,numeric,text,numeric) from anon;
revoke execute on function public.rpc_pm_tpl_upsert_line(bigint,bigint,numeric,text,numeric,boolean,text) from anon;