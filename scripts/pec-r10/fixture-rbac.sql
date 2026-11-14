-- PEC fixture RBAC layer (F1): genuine permission gate, grants and RLS that mirror the live shape.
-- SYNTHETIC users and rows only; NEVER production. Loaded by roles-acl.sh after lib.sh.
-- Sources of truth (read-only observations, 14 Nov 2026): live require_permission(text,boolean) body;
-- live ACLs: wrappers authenticated+service_role, *_pec_internal service_role only; indent/PR tables
-- authenticated SELECT only (RLS policy auth.uid() IS NOT NULL); proc_pr_indent_line_map carries broad table grants with RLS
-- enabled and NO policy (denied); proc_pr_to_indent_map has a FOR ALL policy for any signed-in user (issue #400, characterised).
\set ON_ERROR_STOP on

CREATE TABLE public.user_permissions_canonical (
  user_id uuid NOT NULL, target text NOT NULL, can_view boolean NOT NULL DEFAULT false, can_edit boolean NOT NULL DEFAULT false
);
INSERT INTO public.user_permissions_canonical(user_id, target, can_view, can_edit) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'module:procurement-execution-console', true, true),    -- synthetic Editor
  ('aaaaaaaa-0000-0000-0000-000000000002', 'module:procurement-execution-console', true, false);   -- synthetic View-only
-- aaaaaaaa-0000-0000-0000-000000000003 has no row at all: synthetic no-access user.

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.require_permission(p_target text, p_need_edit boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.user_permissions_canonical upc
    where upc.user_id = auth.uid() and upc.target = p_target and upc.can_view = true
      and (not p_need_edit or upc.can_edit = true)
  ) then
    raise exception 'Permission denied for % (edit=%)', p_target, p_need_edit;
  end if;
end;
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON public.proc_indent_header, public.proc_indent_line, public.proc_pr_header, public.proc_pr_line TO authenticated;
GRANT ALL ON public.proc_pr_indent_line_map TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proc_pr_to_indent_map TO authenticated;
GRANT SELECT ON public.v_proc_indent_lines_console_ordered, public.v_inv_stock_item_with_class TO authenticated;

ALTER TABLE public.proc_indent_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_indent_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_pr_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_pr_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_pr_indent_line_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_pr_to_indent_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY proc_indent_header_authenticated_read ON public.proc_indent_header FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY proc_indent_line_authenticated_read ON public.proc_indent_line FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY proc_pr_header_authenticated_read ON public.proc_pr_header FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY proc_pr_line_authenticated_read ON public.proc_pr_line FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
-- LIVE FACT (catalog read 14 Nov 2026): proc_pr_to_indent_map carries a FOR ALL policy for any signed-in user, not tied to the
-- PEC module permission. (Three item-policy tables have the same shape live: criticality, lead time, production urgency.)
CREATE POLICY proc_pr_to_indent_map_authenticated_crud ON public.proc_pr_to_indent_map FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

REVOKE ALL ON FUNCTION public.proc_indent_add_line(bigint,bigint,bigint,bigint,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_indent_add_line(bigint,bigint,bigint,bigint,numeric,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.require_permission(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_permission(text,boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.proc_indent_add_line_pec_internal(bigint,bigint,bigint,bigint,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proc_indent_add_line_pec_internal(bigint,bigint,bigint,bigint,numeric,text) TO service_role;
REVOKE ALL ON FUNCTION public.proc_indent_resync_from_pr_pec_internal(bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proc_indent_resync_from_pr_pec_internal(bigint,text) TO service_role;
REVOKE ALL ON FUNCTION public.proc_pr_add_line_pec_internal(bigint,bigint,bigint,bigint,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proc_pr_add_line_pec_internal(bigint,bigint,bigint,bigint,numeric,text) TO service_role;
REVOKE ALL ON FUNCTION public.proc_pr_set_manual_delta_pec_internal(bigint,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proc_pr_set_manual_delta_pec_internal(bigint,numeric,text) TO service_role;

-- #400 live-shaped tables (catalog read 14 Nov 2026): three item-policy tables with a FOR ALL policy for any signed-in
-- user, and proc_pr_revision_map with broad table grants but RLS and no policy. Invoker views model the live
-- security-invoker views (v_proc_item_*_effective, v_proc_indent_from_pr_audit) that read these tables as the caller.
ALTER ROLE service_role BYPASSRLS;
CREATE TABLE public.proc_item_criticality_policy (item_id bigint PRIMARY KEY, level int NOT NULL);
CREATE TABLE public.proc_item_lead_time_policy (item_id bigint PRIMARY KEY, days int NOT NULL);
CREATE TABLE public.proc_item_production_urgency (item_id bigint PRIMARY KEY, urgency int NOT NULL);
CREATE TABLE public.proc_pr_revision_map (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, pr_id bigint);
INSERT INTO public.proc_item_criticality_policy VALUES (11, 1), (12, 2);
INSERT INTO public.proc_item_lead_time_policy VALUES (11, 5), (12, 6);
INSERT INTO public.proc_item_production_urgency VALUES (11, 1), (12, 3);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proc_item_criticality_policy, public.proc_item_lead_time_policy, public.proc_item_production_urgency TO authenticated;
GRANT ALL ON public.proc_pr_revision_map TO anon, authenticated;
GRANT ALL ON public.proc_item_criticality_policy, public.proc_item_lead_time_policy, public.proc_item_production_urgency, public.proc_pr_revision_map TO service_role;
ALTER TABLE public.proc_item_criticality_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_item_lead_time_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_item_production_urgency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_pr_revision_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY proc_item_criticality_policy_authenticated_crud ON public.proc_item_criticality_policy FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY proc_item_lead_time_policy_authenticated_crud ON public.proc_item_lead_time_policy FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY proc_item_production_urgency_authenticated_crud ON public.proc_item_production_urgency FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE VIEW public.fx_item_criticality_effective WITH (security_invoker = true) AS SELECT item_id, level FROM public.proc_item_criticality_policy;
CREATE VIEW public.fx_pr_to_indent_audit WITH (security_invoker = true) AS SELECT pr_id, indent_id, is_active FROM public.proc_pr_to_indent_map;
CREATE VIEW public.fx_line_map_audit WITH (security_invoker = true) AS SELECT indent_id, indent_line_id FROM public.proc_pr_indent_line_map;
GRANT SELECT ON public.fx_item_criticality_effective, public.fx_pr_to_indent_audit, public.fx_line_map_audit TO authenticated;
