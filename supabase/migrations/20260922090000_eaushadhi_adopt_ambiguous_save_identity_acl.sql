begin;

revoke all on function public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(
  uuid, bigint, text, text, jsonb
) from anon;

revoke all on function public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(
  uuid, bigint, text, text, jsonb
) from public;

grant execute on function public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(
  uuid, bigint, text, text, jsonb
) to authenticated, service_role;

commit;
