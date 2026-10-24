CREATE OR REPLACE FUNCTION costing.fn_joint_process_validate_candidate(p_effective_date date, p_outputs jsonb, p_stages jsonb, p_reference_qty numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare n integer; m integer;
begin
 if p_effective_date < (now() at time zone 'Asia/Kolkata')::date
 or p_effective_date<=coalesce(costing.fn_frozen_valuation_through(),'-infinity'::date) then raise exception 'JOINT_POLICY_BACKDATE';end if;
 if p_reference_qty<=0 or jsonb_typeof(p_outputs)<>'array' or jsonb_typeof(p_stages)<>'array' then raise exception 'JOINT_POLICY_INVALID_STRUCTURE';end if;
 select count(*),count(distinct (e->>'product_id')::int) into n,m from jsonb_array_elements(p_outputs) e;
 if n<2 or n<>m then raise exception 'JOINT_POLICY_INVALID_OUTPUT_MEMBERS';end if;
 if exists(select 1 from jsonb_array_elements(p_outputs) e where (e->>'output_qty')::numeric<=0)
 or (select sum((e->>'output_qty')::numeric) from jsonb_array_elements(p_outputs) e)<>p_reference_qty then raise exception 'JOINT_POLICY_OUTPUT_MASS_MISMATCH';end if;
 if jsonb_array_length(p_stages)=0 or (select count(distinct (s->>'base_step_id')::bigint) from jsonb_array_elements(p_stages) s)<>jsonb_array_length(p_stages)
 or exists (select 1 from jsonb_array_elements(p_stages) s where (s->>'common_cycles')::numeric<0 or (s->>'continuation_cycles')::numeric<0
 or not exists (select 1 from jsonb_array_elements(p_outputs) e where (e->>'product_id')::int=(s->>'continuation_product_id')::int))
 then raise exception 'JOINT_POLICY_INVALID_STAGES';end if;
 if exists(select 1 from jsonb_array_elements(p_stages) s cross join jsonb_array_elements(p_outputs) o where not exists (
 select 1 from costing.product_process_route r join costing.product_process_route_override v on v.product_route_id=r.id
 where r.product_id=(o->>'product_id')::int and r.status='APPROVED' and r.effective_from<=p_effective_date
 and (r.effective_to is null or r.effective_to>p_effective_date) and v.base_step_id=(s->>'base_step_id')::bigint
 and v.standard_cycle_count=(s->>'common_cycles')::numeric+
 case when (o->>'product_id')::int=(s->>'continuation_product_id')::int then (s->>'continuation_cycles')::numeric else 0 end
 )) then raise exception 'JOINT_POLICY_ROUTE_STAGE_MISMATCH';end if;
 return true;
end $function$
;
revoke all on function costing.fn_joint_process_validate_candidate(date,jsonb,jsonb,numeric) from public,anon,authenticated;
