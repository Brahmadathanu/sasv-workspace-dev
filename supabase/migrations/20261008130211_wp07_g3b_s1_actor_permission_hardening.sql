-- WP-07 S1 security correction: authenticated public RPCs derive the true operator
-- from existing e-Aushadhi permission governance. Internal regulatory RPCs are not client-exposed.
create or replace function public.rpc_eaushadhi_qc_preparation_read_v1(p_product_id integer)
returns jsonb language plpgsql security definer set search_path=public,regulatory,pg_temp as $$
declare v_actor uuid;
begin
  v_actor:=public.rpc_eaushadhi_require_permission(false);
  return regulatory.eaushadhi_qc_preparation_read_v1(p_product_id);
end $$;

create or replace function public.rpc_eaushadhi_qc_preparation_review_v1(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,regulatory,pg_temp as $$
declare v_actor uuid;
begin
  v_actor:=public.rpc_eaushadhi_require_permission(false);
  return regulatory.eaushadhi_qc_preparation_review_v1(p_payload);
end $$;

create or replace function public.rpc_eaushadhi_qc_preparation_save_v1(
  p_preparation_id uuid,p_product_id integer,p_source_key text,p_expected_row_version bigint,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,regulatory,pg_temp as $$
declare v_actor uuid;
begin
  v_actor:=public.rpc_eaushadhi_require_permission(true);
  return regulatory.eaushadhi_qc_preparation_save_v1(
    p_preparation_id,p_product_id,p_source_key,p_expected_row_version,p_payload,v_actor);
end $$;

create or replace function public.rpc_eaushadhi_qc_preparation_verify_v1(
  p_preparation_id uuid,p_expected_row_version bigint)
returns jsonb language plpgsql security definer set search_path=public,regulatory,pg_temp as $$
declare v_actor uuid;
begin
  v_actor:=public.rpc_eaushadhi_require_permission(true);
  return regulatory.eaushadhi_qc_preparation_verify_v1(p_preparation_id,p_expected_row_version,v_actor);
end $$;

-- The service_role may enter only through the permission-checked public RPCs.
-- PostgreSQL function owners retain internal execution for wrapper delegation.
revoke all on function regulatory.eaushadhi_qc_preparation_read_v1(integer) from public,anon,authenticated,service_role;
revoke all on function regulatory.eaushadhi_qc_preparation_review_v1(jsonb) from public,anon,authenticated,service_role;
revoke all on function regulatory.eaushadhi_qc_preparation_save_v1(uuid,integer,text,bigint,jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function regulatory.eaushadhi_qc_preparation_verify_v1(uuid,bigint,uuid) from public,anon,authenticated,service_role;
revoke all on function public.rpc_eaushadhi_qc_preparation_read_v1(integer) from public,anon;
revoke all on function public.rpc_eaushadhi_qc_preparation_review_v1(jsonb) from public,anon;
revoke all on function public.rpc_eaushadhi_qc_preparation_save_v1(uuid,integer,text,bigint,jsonb) from public,anon;
revoke all on function public.rpc_eaushadhi_qc_preparation_verify_v1(uuid,bigint) from public,anon;
grant execute on function public.rpc_eaushadhi_qc_preparation_read_v1(integer) to authenticated,service_role;
grant execute on function public.rpc_eaushadhi_qc_preparation_review_v1(jsonb) to authenticated,service_role;
grant execute on function public.rpc_eaushadhi_qc_preparation_save_v1(uuid,integer,text,bigint,jsonb) to authenticated,service_role;
grant execute on function public.rpc_eaushadhi_qc_preparation_verify_v1(uuid,bigint) to authenticated,service_role;
