-- SOURCE-CONTROL PARITY — already applied in production as
--   20260913094900_plm_bom_revision_gate_a_function_privilege_hardening
-- Captured to match live supabase_migrations.schema_migrations.
--
-- DO NOT apply this migration to production. Production already has it.
-- This file exists so repository schema history matches live privilege hardening.

-- ---------------------------------------------------------------------------
-- Internal helpers + as-of resolvers: no PUBLIC / anon / authenticated EXECUTE
-- ---------------------------------------------------------------------------

revoke all on function public.fn_plm_bom_revision_build_content_hash(bigint, date, numeric, bigint, numeric, bigint, jsonb)
  from public, anon, authenticated;
revoke all on function public.fn_plm_bom_revision_compute_content_hash(bigint)
  from public, anon, authenticated;
revoke all on function public.fn_plm_bom_revision_verify_content_hash(bigint)
  from public, anon, authenticated;
revoke all on function public.fn_plm_bom_revision_governed_context()
  from public, anon, authenticated;
revoke all on function public.fn_plm_bom_revision_header_immutable()
  from public, anon, authenticated;
revoke all on function public.fn_plm_bom_revision_line_immutable()
  from public, anon, authenticated;

revoke all on function public.plm_sku_bom_revision_as_of(bigint, date)
  from public, anon, authenticated;
revoke all on function public.plm_sku_bom_lines_as_of(bigint, date)
  from public, anon, authenticated;
revoke all on function public.plm_sku_requirement_unit_as_of(date)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Client RPCs: revoke broad grants, then grant authenticated + service_role only
-- ---------------------------------------------------------------------------

revoke all on function public.rpc_plm_bom_revision_create_draft(bigint, date)
  from public, anon, authenticated;
revoke all on function public.rpc_plm_bom_revision_cancel(bigint)
  from public, anon, authenticated;
revoke all on function public.rpc_plm_bom_revision_approve(bigint, date, text, text)
  from public, anon, authenticated;
revoke all on function public.rpc_plm_bom_revision_list(bigint)
  from public, anon, authenticated;
revoke all on function public.rpc_plm_bom_revision_get(bigint)
  from public, anon, authenticated;
revoke all on function public.rpc_plm_bom_revision_list_lines(bigint)
  from public, anon, authenticated;

grant execute on function public.rpc_plm_bom_revision_create_draft(bigint, date)
  to authenticated, service_role;
grant execute on function public.rpc_plm_bom_revision_cancel(bigint)
  to authenticated, service_role;
grant execute on function public.rpc_plm_bom_revision_approve(bigint, date, text, text)
  to authenticated, service_role;
grant execute on function public.rpc_plm_bom_revision_list(bigint)
  to authenticated, service_role;
grant execute on function public.rpc_plm_bom_revision_get(bigint)
  to authenticated, service_role;
grant execute on function public.rpc_plm_bom_revision_list_lines(bigint)
  to authenticated, service_role;
