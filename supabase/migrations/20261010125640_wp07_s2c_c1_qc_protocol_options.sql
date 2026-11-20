-- WP-07 S2C/C1: view-only canonical QC protocol options for preparation UI.
-- No source data mutation, no QC readiness, no portal authority.
create function public.rpc_eaushadhi_qc_protocol_options_v1()
returns jsonb
language plpgsql stable security definer
set search_path = public, regulatory, pg_temp
as $$
begin
  perform public.rpc_eaushadhi_require_permission(false);
  return (
    select coalesce(
      jsonb_agg(jsonb_build_object('term_id',t.id,'code',t.code,'label',t.label)
        order by t.id), '[]'::jsonb)
    from regulatory.controlled_term t
    where t.domain_code='QC_PROTOCOL' and t.is_active=true
  );
end;
$$;
revoke all on function public.rpc_eaushadhi_qc_protocol_options_v1() from public, anon;
grant execute on function public.rpc_eaushadhi_qc_protocol_options_v1() to authenticated;
