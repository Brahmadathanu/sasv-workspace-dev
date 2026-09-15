-- SOURCE-CONTROL PARITY
-- Already applied live as:
--   20260915162212_csa_scoped_rpc_acl_hardening
-- DO NOT reapply to production.
--
-- Restricts the CSA scoped preview/write public RPC surface to
-- authenticated/service_role. Internal permission checks remain authoritative.

revoke all on function public.rpc_preview_sales_allocation_default_policy_scope(
  text, text, text, text, numeric, date
)
  from public, anon;

revoke all on function public.rpc_set_sales_allocation_default_policies_scoped(
  text, text, text, text, numeric, date, text, text
)
  from public, anon;

grant execute on function public.rpc_preview_sales_allocation_default_policy_scope(
  text, text, text, text, numeric, date
)
  to authenticated, service_role;

grant execute on function public.rpc_set_sales_allocation_default_policies_scoped(
  text, text, text, text, numeric, date, text, text
)
  to authenticated, service_role;

comment on function public.rpc_preview_sales_allocation_default_policy_scope(
  text, text, text, text, numeric, date
) is
  'Pricing Policy Manager CSA scoped preview. EXECUTE limited to authenticated/service_role; function enforces module:pricing-policy-manager read permission.';

comment on function public.rpc_set_sales_allocation_default_policies_scoped(
  text, text, text, text, numeric, date, text, text
) is
  'Pricing Policy Manager CSA scoped atomic revision. EXECUTE limited to authenticated/service_role; function enforces module:pricing-policy-manager edit permission.';
