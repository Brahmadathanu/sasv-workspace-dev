-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

revoke all on function public.force_unlink_plan_batch(bigint,text) from public, anon, authenticated;
grant execute on function public.force_unlink_plan_batch(bigint,text) to service_role;

comment on function public.force_unlink_plan_batch(bigint,text) is
  'Legacy server-only emergency function. Client/authenticated access retired; use rpc_admin_correct_bmr_plan_mapping for governed unlink/remap/correction with immutable audit.';

commit;