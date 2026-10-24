-- CI-033 PREPARED FIX. NOT APPLIED. Apply only with explicit owner approval,
-- through Supabase MCP apply_migration/execute_sql. Never via `supabase db push`.
-- Diagnosis (read-only, 24 Oct 2026 16:45 IST):
--   costing.v_cost_pool_monthly_combined: owner postgres, no security_invoker (owner rights),
--   ACL {postgres=arwdDxtm, authenticated=r}. anon: no access. service_role: none.
--   Schema costing: USAGE granted to authenticated only.
--   Not ungated through the API today: config.toml exposes only public/graphql_public, and the client reads
--   public.v_costing_cost_pool_monthly_summary (postgres-owned, owner rights, gated by
--   public.fn_costing_view_allowed()). The six SECURITY DEFINER functions that read it are
--   postgres-owned. No cron job references it directly.
-- Effect: removes the direct (ungated) read path. The screens keep working through the gated public view.
begin;

-- Guard: abort if the assumptions no longer hold.
do $$
begin
  if (select pg_get_userbyid(relowner) from pg_class where oid='costing.v_cost_pool_monthly_combined'::regclass) <> 'postgres'
     or (select pg_get_userbyid(relowner) from pg_class where oid='public.v_costing_cost_pool_monthly_summary'::regclass) <> 'postgres'
     or coalesce((select 'security_invoker=true' = any(reloptions) from pg_class where oid='public.v_costing_cost_pool_monthly_summary'::regclass), false)
     or pg_get_viewdef('public.v_costing_cost_pool_monthly_summary'::regclass) not ilike '%fn_costing_view_allowed%'
  then
    raise exception 'CI-033 guard failed: owner/invoker/gate assumptions changed; do not apply';
  end if;
end $$;

revoke all on costing.v_cost_pool_monthly_combined from anon, authenticated;

commit;

-- OUT OF SCOPE (separate decision, CI-019 follow-up): authenticated can still SELECT 37 tables
-- and 10 other views in schema costing (18 of the tables have RLS). They are not API-exposed today.
-- A schema-wide revoke needs its own dependency review.
