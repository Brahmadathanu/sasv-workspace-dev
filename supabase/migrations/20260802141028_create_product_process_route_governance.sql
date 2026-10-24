-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_product_group_id_for_product(p_product_id integer)
returns integer language sql stable set search_path=public,costing as $$
 select sg.product_group_id from public.products p join public.sub_groups sg on sg.id=p.sub_group_id where p.id=p_product_id
$$;

create or replace function costing.fn_effective_product_process_route_steps(p_product_route_id bigint)
returns table(
 product_route_id bigint,effective_step_key text,sequence_no numeric,activity_id integer,cost_centre_id bigint,
 section_id integer,subsection_id integer,area_id integer,plant_id integer,behaviour_code text,resource_class_code text,
 route_step_scope text,expected_occurrence_count numeric,standard_cycle_count numeric,is_mandatory boolean,
 allows_repeat boolean,allows_skip_with_approval boolean,production_overhead_scope text,direct_labour_scope text,
 source_type text,base_step_id bigint,override_id bigint
)
language sql stable set search_path=public,costing as $$
with route as (
 select * from costing.product_process_route where id=p_product_route_id
), ov as (
 select x.base_step_id,
   bool_or(x.operation_type='BYPASS_STEP') is_bypassed,
   max(x.id) filter(where x.operation_type<>'BYPASS_STEP') override_id,
   max(x.sequence_no) filter(where x.sequence_no is not null) sequence_no,
   max(x.activity_id) filter(where x.activity_id is not null) activity_id,
   max(x.cost_centre_id) filter(where x.cost_centre_id is not null) cost_centre_id,
   max(x.section_id) filter(where x.section_id is not null) section_id,
   max(x.subsection_id) filter(where x.subsection_id is not null) subsection_id,
   max(x.area_id) filter(where x.area_id is not null) area_id,
   max(x.plant_id) filter(where x.plant_id is not null) plant_id,
   max(x.behaviour_code) filter(where x.behaviour_code is not null) behaviour_code,
   max(x.resource_class_code) filter(where x.resource_class_code is not null) resource_class_code,
   max(x.route_step_scope) filter(where x.route_step_scope is not null) route_step_scope,
   max(x.expected_occurrence_count) filter(where x.expected_occurrence_count is not null) expected_occurrence_count,
   max(x.standard_cycle_count) filter(where x.standard_cycle_count is not null) standard_cycle_count,
   bool_or(x.is_mandatory) filter(where x.is_mandatory is not null) is_mandatory,
   bool_or(x.allows_repeat) filter(where x.allows_repeat is not null) allows_repeat,
   bool_or(x.allows_skip_with_approval) filter(where x.allows_skip_with_approval is not null) allows_skip_with_approval,
   max(x.production_overhead_scope) filter(where x.production_overhead_scope is not null) production_overhead_scope,
   max(x.direct_labour_scope) filter(where x.direct_labour_scope is not null) direct_labour_scope
 from costing.product_process_route_override x
 where x.product_route_id=p_product_route_id and x.base_step_id is not null
 group by x.base_step_id
), base as (
 select r.id product_route_id,s.id base_step_id,s.step_key,
   coalesce(o.sequence_no,s.sequence_no) sequence_no,coalesce(o.activity_id,s.activity_id) activity_id,
   coalesce(o.cost_centre_id,s.cost_centre_id) cost_centre_id,coalesce(o.section_id,s.section_id) section_id,
   coalesce(o.subsection_id,s.subsection_id) subsection_id,coalesce(o.area_id,s.area_id) area_id,
   coalesce(o.plant_id,s.plant_id) plant_id,coalesce(o.behaviour_code,s.behaviour_code) behaviour_code,
   coalesce(o.resource_class_code,s.resource_class_code) resource_class_code,coalesce(o.route_step_scope,s.route_step_scope) route_step_scope,
   coalesce(o.expected_occurrence_count,s.expected_occurrence_count) expected_occurrence_count,
   coalesce(o.standard_cycle_count,s.standard_cycle_count) standard_cycle_count,
   coalesce(o.is_mandatory,s.is_mandatory) is_mandatory,coalesce(o.allows_repeat,s.allows_repeat) allows_repeat,
   coalesce(o.allows_skip_with_approval,s.allows_skip_with_approval) allows_skip_with_approval,
   coalesce(o.production_overhead_scope,s.production_overhead_scope) production_overhead_scope,
   coalesce(o.direct_labour_scope,s.direct_labour_scope) direct_labour_scope,o.override_id
 from route r join costing.product_group_process_route_step s on s.group_route_id=r.base_group_route_id
 left join ov o on o.base_step_id=s.id where coalesce(o.is_bypassed,false)=false
), added as (
 select r.id product_route_id,null::bigint base_step_id,o.override_step_key step_key,o.sequence_no,o.activity_id,o.cost_centre_id,
   o.section_id,o.subsection_id,o.area_id,o.plant_id,o.behaviour_code,o.resource_class_code,o.route_step_scope,
   coalesce(o.expected_occurrence_count,1::numeric) expected_occurrence_count,
   coalesce(o.standard_cycle_count,1::numeric) standard_cycle_count,coalesce(o.is_mandatory,true) is_mandatory,
   coalesce(o.allows_repeat,false) allows_repeat,coalesce(o.allows_skip_with_approval,false) allows_skip_with_approval,
   coalesce(o.production_overhead_scope,'INCLUDE') production_overhead_scope,
   coalesce(o.direct_labour_scope,'INCLUDE') direct_labour_scope,o.id override_id
 from route r join costing.product_process_route_override o on o.product_route_id=r.id and o.operation_type='ADD_STEP'
), all_steps as (
 select product_route_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,plant_id,
   behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,
   allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,
   case when override_id is null then 'GROUP_ROUTE' else 'PRODUCT_OVERRIDE' end source_type,base_step_id,override_id from base
 union all
 select product_route_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,plant_id,
   behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,
   allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,
   'PRODUCT_ADDED_STEP',base_step_id,override_id from added
)
select * from all_steps order by sequence_no,step_key
$$;

create or replace function costing.fn_resolve_effective_product_process_route(p_product_id integer,p_as_of_date date)
returns bigint language sql stable set search_path=public,costing as $$
 select r.id from costing.product_process_route r where r.product_id=p_product_id and r.status='APPROVED'
 and r.effective_from<=p_as_of_date and(r.effective_to is null or r.effective_to>=p_as_of_date)
 order by r.effective_from desc,r.route_version desc,r.id desc limit 1
$$;

create or replace function costing.fn_validate_group_process_route(p_group_route_id bigint)
returns jsonb language plpgsql stable set search_path=public,costing as $$
declare v_step_count int;v_start int;v_end int;v_process int;v_invalid int;v_errors jsonb:='[]'::jsonb;r costing.product_group_process_route%rowtype;
begin
 select * into r from costing.product_group_process_route where id=p_group_route_id;
 if not found then return jsonb_build_object('valid',false,'errors',jsonb_build_array('GROUP_ROUTE_NOT_FOUND'));end if;
 if r.evidence_status in('PARTIAL_EVIDENCE','NO_EVIDENCE') then v_errors:=v_errors||jsonb_build_array('INCOMPLETE_ROUTE_EVIDENCE');end if;
 select count(*),count(*)filter(where route_step_scope='BOUNDARY_RM_ISSUE'),count(*)filter(where route_step_scope='BOUNDARY_FG_TRANSFER'),count(*)filter(where route_step_scope='PRODUCTION_PROCESS')
 into v_step_count,v_start,v_end,v_process from costing.product_group_process_route_step where group_route_id=p_group_route_id;
 if v_step_count=0 then v_errors:=v_errors||jsonb_build_array('NO_ROUTE_STEPS');end if;
 if v_start<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY');end if;
 if v_end<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY');end if;
 if v_process<1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_PRODUCTION_PROCESS_STEP');end if;
 select count(*) into v_invalid from costing.product_group_process_route_step s join public.areas a on a.id=s.area_id left join public.plant_machinery pm on pm.id=s.plant_id
 where a.section_id is distinct from s.section_id or a.subsection_id is distinct from s.subsection_id
 or(s.plant_id is not null and(pm.area_id is distinct from s.area_id or pm.section_id is distinct from s.section_id or pm.subsection_id is distinct from s.subsection_id));
 if v_invalid>0 then v_errors:=v_errors||jsonb_build_array('INVALID_STEP_LOCATION_OR_PLANT');end if;
 return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'step_count',v_step_count,'start_boundary_count',v_start,'end_boundary_count',v_end,'production_step_count',v_process);
end$$;

create or replace function costing.fn_validate_product_process_route(p_product_route_id bigint)
returns jsonb language plpgsql stable set search_path=public,costing as $$
declare r costing.product_process_route%rowtype;v_pg int;v_base_pg int;v_batch_product bigint;v_count int;v_start int;v_end int;v_process int;v_dup int;v_invalid int;v_foreign int;v_errors jsonb:='[]'::jsonb;
begin
 select * into r from costing.product_process_route where id=p_product_route_id;
 if not found then return jsonb_build_object('valid',false,'errors',jsonb_build_array('ROUTE_NOT_FOUND'));end if;
 v_pg:=costing.fn_product_group_id_for_product(r.product_id);
 select product_group_id into v_base_pg from costing.product_group_process_route where id=r.base_group_route_id;
 select product_id into v_batch_product from public.production_batch_size_ref where id=r.batch_size_ref_id;
 if v_pg is distinct from v_base_pg then v_errors:=v_errors||jsonb_build_array('GROUP_ROUTE_PRODUCT_GROUP_MISMATCH');end if;
 if v_batch_product is distinct from r.product_id then v_errors:=v_errors||jsonb_build_array('BATCH_REFERENCE_PRODUCT_MISMATCH');end if;
 if r.evidence_status in('PARTIAL_EVIDENCE','NO_EVIDENCE') then v_errors:=v_errors||jsonb_build_array('INCOMPLETE_ROUTE_EVIDENCE');end if;
 select count(*) into v_foreign from costing.product_process_route_override o join costing.product_group_process_route_step s on s.id=o.base_step_id
 where o.product_route_id=r.id and s.group_route_id<>r.base_group_route_id;
 if v_foreign>0 then v_errors:=v_errors||jsonb_build_array('OVERRIDE_REFERENCES_FOREIGN_GROUP_ROUTE_STEP');end if;
 select count(*),count(*)filter(where route_step_scope='BOUNDARY_RM_ISSUE'),count(*)filter(where route_step_scope='BOUNDARY_FG_TRANSFER'),count(*)filter(where route_step_scope='PRODUCTION_PROCESS')
 into v_count,v_start,v_end,v_process from costing.fn_effective_product_process_route_steps(p_product_route_id);
 if v_count=0 then v_errors:=v_errors||jsonb_build_array('NO_EFFECTIVE_ROUTE_STEPS');end if;
 if v_start<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY');end if;
 if v_end<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY');end if;
 if v_process<1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_PRODUCTION_PROCESS_STEP');end if;
 select count(*) into v_dup from(select sequence_no from costing.fn_effective_product_process_route_steps(p_product_route_id)group by sequence_no having count(*)>1)d;
 if v_dup>0 then v_errors:=v_errors||jsonb_build_array('DUPLICATE_EFFECTIVE_SEQUENCE');end if;
 select count(*) into v_invalid from costing.fn_effective_product_process_route_steps(p_product_route_id)s join public.areas a on a.id=s.area_id left join public.plant_machinery pm on pm.id=s.plant_id
 where a.section_id is distinct from s.section_id or a.subsection_id is distinct from s.subsection_id
 or(s.plant_id is not null and(pm.area_id is distinct from s.area_id or pm.section_id is distinct from s.section_id or pm.subsection_id is distinct from s.subsection_id));
 if v_invalid>0 then v_errors:=v_errors||jsonb_build_array('INVALID_STEP_LOCATION_OR_PLANT');end if;
 return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'step_count',v_count,'start_boundary_count',v_start,'end_boundary_count',v_end,'production_step_count',v_process);
end$$;

create or replace function costing.fn_approve_group_process_route(p_group_route_id bigint,p_approval_reference text)
returns jsonb language plpgsql security definer set search_path=public,costing as $$
declare r costing.product_group_process_route%rowtype;v jsonb;
begin
 perform public.require_permission('module:production-route-manager',true);
 if nullif(btrim(p_approval_reference),'') is null then raise exception 'Approval reference is required';end if;
 select * into r from costing.product_group_process_route where id=p_group_route_id for update;
 if not found then raise exception 'Product Group route % not found',p_group_route_id;end if;
 if r.status not in('DRAFT','REVIEW_REQUIRED') then raise exception 'Route status % cannot be approved',r.status;end if;
 v:=costing.fn_validate_group_process_route(p_group_route_id);
 if not coalesce((v->>'valid')::boolean,false) then raise exception 'Group route validation failed: %',v::text;end if;
 if exists(select 1 from costing.product_group_process_route x where x.product_group_id=r.product_group_id and x.id<>r.id and x.status='APPROVED'
 and daterange(x.effective_from,coalesce(x.effective_to,'infinity'::date),'[]')&&daterange(r.effective_from,coalesce(r.effective_to,'infinity'::date),'[]'))then raise exception 'Another approved Product Group route overlaps this effective period';end if;
 update costing.product_group_process_route set status='APPROVED',approval_reference=btrim(p_approval_reference),approved_by=auth.uid(),approved_at=now(),updated_at=now()where id=p_group_route_id;
 return v||jsonb_build_object('group_route_id',p_group_route_id,'status','APPROVED');
end$$;

create or replace function costing.fn_approve_product_process_route(p_product_route_id bigint,p_approval_reference text)
returns jsonb language plpgsql security definer set search_path=public,costing as $$
declare r costing.product_process_route%rowtype;v jsonb;
begin
 perform public.require_permission('module:production-route-manager',true);
 if nullif(btrim(p_approval_reference),'') is null then raise exception 'Approval reference is required';end if;
 select * into r from costing.product_process_route where id=p_product_route_id for update;
 if not found then raise exception 'Product route % not found',p_product_route_id;end if;
 if r.status not in('DRAFT','REVIEW_REQUIRED') then raise exception 'Route status % cannot be approved',r.status;end if;
 if not exists(select 1 from costing.product_group_process_route g where g.id=r.base_group_route_id and g.status='APPROVED')then raise exception 'Base Product Group route must be APPROVED';end if;
 v:=costing.fn_validate_product_process_route(p_product_route_id);
 if not coalesce((v->>'valid')::boolean,false)then raise exception 'Product route validation failed: %',v::text;end if;
 if exists(select 1 from costing.product_process_route x where x.product_id=r.product_id and x.id<>r.id and x.status='APPROVED'
 and daterange(x.effective_from,coalesce(x.effective_to,'infinity'::date),'[]')&&daterange(r.effective_from,coalesce(r.effective_to,'infinity'::date),'[]'))then raise exception 'Another approved Product route overlaps this effective period';end if;
 update costing.product_process_route set status='APPROVED',approval_reference=btrim(p_approval_reference),approved_by=auth.uid(),approved_at=now(),updated_at=now()where id=p_product_route_id;
 return v||jsonb_build_object('route_id',p_product_route_id,'status','APPROVED');
end$$;

create or replace function costing.fn_route_parent_immutable()returns trigger language plpgsql set search_path=public,costing as $$
begin
 if tg_op='DELETE' then if old.status='APPROVED' then raise exception 'Approved route is immutable; supersede instead';end if;return old;end if;
 if old.status='APPROVED' then
  if new.status not in('APPROVED','SUPERSEDED','INACTIVE')then raise exception 'Approved route may only remain approved or become superseded/inactive';end if;
  if(to_jsonb(old)-array['status','effective_to','updated_at'])is distinct from(to_jsonb(new)-array['status','effective_to','updated_at'])then raise exception 'Approved route definition is immutable; create a new version';end if;
 end if;return new;
end$$;
create trigger trg_group_route_immutable before update or delete on costing.product_group_process_route for each row execute function costing.fn_route_parent_immutable();
create trigger trg_product_route_immutable before update or delete on costing.product_process_route for each row execute function costing.fn_route_parent_immutable();

create or replace function costing.fn_group_route_step_immutable()returns trigger language plpgsql set search_path=public,costing as $$
declare v_id bigint;v_status text;
begin v_id:=case when tg_op='DELETE' then old.group_route_id else new.group_route_id end;select status into v_status from costing.product_group_process_route where id=v_id;if v_status='APPROVED'then raise exception 'Approved Product Group route steps are immutable; create a new route version';end if;return case when tg_op='DELETE'then old else new end;end$$;
create trigger trg_group_route_step_immutable before insert or update or delete on costing.product_group_process_route_step for each row execute function costing.fn_group_route_step_immutable();

create or replace function costing.fn_product_route_override_immutable()returns trigger language plpgsql set search_path=public,costing as $$
declare v_id bigint;v_status text;
begin v_id:=case when tg_op='DELETE'then old.product_route_id else new.product_route_id end;select status into v_status from costing.product_process_route where id=v_id;if v_status='APPROVED'then raise exception 'Approved Product route overrides are immutable; create a new route version';end if;return case when tg_op='DELETE'then old else new end;end$$;
create trigger trg_product_route_override_immutable before insert or update or delete on costing.product_process_route_override for each row execute function costing.fn_product_route_override_immutable();

create view costing.v_product_process_route_readiness as
select p.id product_id,p.item product_name,sg.product_group_id,pg.group_name product_group_name,r.id product_route_id,r.route_version,r.status route_status,r.effective_from,r.effective_to,r.evidence_status,r.base_group_route_id,r.batch_size_ref_id,
 case when r.id is null then 'BLOCKED_NO_APPROVED_PRODUCT_PROCESS_ROUTE' when not coalesce((v.validation->>'valid')::boolean,false)then 'BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE'else 'READY'end readiness_status,
 coalesce(v.validation,jsonb_build_object('valid',false,'errors',jsonb_build_array('NO_APPROVED_ROUTE')))validation
from public.products p join public.sub_groups sg on sg.id=p.sub_group_id join public.product_groups pg on pg.id=sg.product_group_id
left join lateral(select x.* from costing.product_process_route x where x.product_id=p.id and x.status='APPROVED'and x.effective_from<=current_date and(x.effective_to is null or x.effective_to>=current_date)order by x.effective_from desc,x.route_version desc,x.id desc limit 1)r on true
left join lateral(select costing.fn_validate_product_process_route(r.id)validation)v on r.id is not null;

revoke all on costing.v_product_process_route_readiness from anon,authenticated;
grant execute on function costing.fn_approve_group_process_route(bigint,text)to authenticated,service_role;
grant execute on function costing.fn_approve_product_process_route(bigint,text)to authenticated,service_role;
grant execute on function costing.fn_product_group_id_for_product(integer)to service_role;
grant execute on function costing.fn_effective_product_process_route_steps(bigint)to service_role;
grant execute on function costing.fn_resolve_effective_product_process_route(integer,date)to service_role;
grant execute on function costing.fn_validate_group_process_route(bigint)to service_role;
grant execute on function costing.fn_validate_product_process_route(bigint)to service_role;