-- PEC #400 — forward-only, PROPOSED, NOT applied to any live database. Needs separate owner approval.
--
-- Finding (live catalog, 14 Nov 2026): four tables carry a FOR ALL policy `auth.uid() IS NOT NULL` for the
-- `authenticated` role, with INSERT/UPDATE/DELETE granted, so ANY signed-in user (including accounts with no
-- PEC permission) can rewrite them through the API:
--   public.proc_pr_to_indent_map            (PR -> indent link history)
--   public.proc_item_criticality_policy     (item priority policy; 0 rows)
--   public.proc_item_lead_time_policy       (item lead-time policy; 0 rows)
--   public.proc_item_production_urgency     (item production urgency; 0 rows)
-- No application code uses these tables directly (reads go through views; the link table is written only by
-- SECURITY DEFINER PEC internals). Many security-invoker views read them, so SELECT is KEPT unchanged.
--
-- Correction (writes only, least privilege, no behaviour change for existing workflows):
--   1. Replace each FOR ALL policy by a FOR SELECT policy with the same predicate.
--   2. REVOKE INSERT, UPDATE, DELETE on the four tables FROM authenticated (and anon, which has none).
--   3. Privilege hygiene with ZERO effective change: RLS with no policy already denies the two line/revision
--      map tables to client roles, but they still carry TRUNCATE/TRIGGER/REFERENCES/DML privileges (TRUNCATE
--      ignores RLS). Revoke ALL from anon and the non-SELECT privileges from authenticated; SELECT is kept
--      because security-invoker views read them (they return 0 rows under RLS today and must not start erroring).
-- Unchanged on purpose: service_role and postgres (bypass RLS; own all SECURITY DEFINER functions), every
-- function and its ACL, read policies on indent/PR tables (load-bearing for other modules' security-invoker views).
-- Rollback: forward migration re-creating the FOR ALL policies and re-granting INSERT, UPDATE, DELETE.
BEGIN;

DROP POLICY IF EXISTS proc_pr_to_indent_map_authenticated_crud ON public.proc_pr_to_indent_map;
DROP POLICY IF EXISTS proc_item_criticality_policy_authenticated_crud ON public.proc_item_criticality_policy;
DROP POLICY IF EXISTS proc_item_lead_time_policy_authenticated_crud ON public.proc_item_lead_time_policy;
DROP POLICY IF EXISTS proc_item_production_urgency_authenticated_crud ON public.proc_item_production_urgency;

CREATE POLICY proc_pr_to_indent_map_authenticated_read ON public.proc_pr_to_indent_map
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY proc_item_criticality_policy_authenticated_read ON public.proc_item_criticality_policy
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY proc_item_lead_time_policy_authenticated_read ON public.proc_item_lead_time_policy
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY proc_item_production_urgency_authenticated_read ON public.proc_item_production_urgency
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

REVOKE INSERT, UPDATE, DELETE ON public.proc_pr_to_indent_map FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.proc_item_criticality_policy FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.proc_item_lead_time_policy FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.proc_item_production_urgency FROM authenticated, anon;

REVOKE ALL ON public.proc_pr_indent_line_map FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.proc_pr_indent_line_map FROM authenticated;
REVOKE ALL ON public.proc_pr_revision_map FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.proc_pr_revision_map FROM authenticated;

COMMIT;
