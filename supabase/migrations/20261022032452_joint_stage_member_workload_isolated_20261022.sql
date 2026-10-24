-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_joint_stage_member_workload(
 p_common_cycles numeric,p_continuation_cycles numeric,p_member_output_qty numeric,
 p_reference_total_output_qty numeric,p_member_is_continuation boolean,
 p_joint_batch_equivalents numeric,p_stage_factor_per_cycle numeric
) returns numeric language plpgsql immutable strict set search_path=pg_catalog,pg_temp as $$
begin
 if p_common_cycles<0 or p_continuation_cycles<0 or p_member_output_qty<=0
 or p_reference_total_output_qty<=0 or p_member_output_qty>p_reference_total_output_qty
 or p_joint_batch_equivalents<0 or p_stage_factor_per_cycle<0 then
 raise exception 'INVALID_JOINT_STAGE_WORKLOAD_INPUT' using errcode='22023'; end if;
 return p_joint_batch_equivalents*p_stage_factor_per_cycle*
 (p_common_cycles*p_member_output_qty/p_reference_total_output_qty
 +case when p_member_is_continuation then p_continuation_cycles else 0 end);
end $$;
revoke all on function costing.fn_joint_stage_member_workload(numeric,numeric,numeric,numeric,boolean,numeric,numeric) from public,anon,authenticated;