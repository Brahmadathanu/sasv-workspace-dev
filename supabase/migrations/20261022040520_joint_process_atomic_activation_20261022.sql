-- Deployed joint-process atomic activation migration (2026-10-22).
CREATE TABLE costing.joint_process_activation_audit (
 id bigint generated always as identity primary key,
 policy_id bigint not null references costing.joint_process_policy(id) on delete restrict,
 actor_id uuid not null,approval_reference text not null,proposal jsonb not null,
 recorded_at timestamptz not null default clock_timestamp()
);
ALTER TABLE costing.joint_process_activation_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON costing.joint_process_activation_audit FROM public,anon,authenticated;
CREATE FUNCTION costing.fn_joint_process_audit_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN RAISE EXCEPTION 'JOINT_AUDIT_IMMUTABLE';END $$;
CREATE TRIGGER joint_audit_immutable BEFORE UPDATE OR DELETE ON costing.joint_process_activation_audit FOR EACH ROW EXECUTE FUNCTION costing.fn_joint_process_audit_immutable();
CREATE OR REPLACE FUNCTION costing.fn_joint_process_activate(p_code text, p_effective_from date, p_reference_qty numeric, p_outputs jsonb, p_stages jsonb, p_approval_reference text, p_actor uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare v_id bigint;
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'JOINT_POLICY_ROLE_DENIED';end if;
 if p_actor is null or p_code is null or btrim(p_code)='' or
 p_approval_reference is null or btrim(p_approval_reference)='' then
 raise exception 'JOINT_POLICY_APPROVAL_REQUIRED';end if;
 perform costing.fn_joint_process_validate_candidate(p_effective_from,p_outputs,p_stages,p_reference_qty);
 insert into costing.joint_process_policy(process_code,effective_from,reference_output_qty,output_uom,allocation_method,approval_reference)
 values(p_code,p_effective_from,p_reference_qty,'Kg','OUTPUT_MASS',p_approval_reference)
 returning id into v_id;
 insert into costing.joint_process_output(policy_id,product_id,output_qty)
 select v_id,(e->>'product_id')::int,(e->>'output_qty')::numeric from jsonb_array_elements(p_outputs) e;
 insert into costing.joint_process_stage(policy_id,base_step_id,common_cycles,continuation_cycles,continuation_product_id)
 select v_id,(s->>'base_step_id')::bigint,(s->>'common_cycles')::numeric,(s->>'continuation_cycles')::numeric,(s->>'continuation_product_id')::int
 from jsonb_array_elements(p_stages) s;
 insert into costing.joint_process_activation_audit(policy_id,actor_id,approval_reference,proposal)
 values(v_id,p_actor,p_approval_reference,jsonb_build_object('outputs',p_outputs,'stages',p_stages,'reference_qty',p_reference_qty,'effective_from',p_effective_from,'process_code',p_code));
 return v_id;
end $function$
;
REVOKE ALL ON FUNCTION costing.fn_joint_process_activate(text,date,numeric,jsonb,jsonb,text,uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION costing.fn_joint_process_audit_immutable() FROM public,anon,authenticated;
