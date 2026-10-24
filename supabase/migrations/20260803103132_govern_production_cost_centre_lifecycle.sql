-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table costing.production_cost_centre
  add column if not exists description text,
  add column if not exists inactivation_reference text,
  add column if not exists inactivated_by uuid,
  add column if not exists inactivated_at timestamptz;

create or replace function costing.fn_validate_production_cost_centre(p_cost_centre_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = costing, public
as $function$
declare
  v_cc costing.production_cost_centre%rowtype;
  v_errors jsonb := '[]'::jsonb;
  v_section_id integer;
  v_subsection_section_id integer;
  v_area_section_id integer;
  v_area_subsection_id integer;
  v_plant_section_id integer;
  v_plant_subsection_id integer;
  v_plant_area_id integer;
begin
  select * into v_cc
  from costing.production_cost_centre
  where id = p_cost_centre_id;

  if not found then
    return jsonb_build_object(
      'valid', false,
      'errors', jsonb_build_array('COST_CENTRE_NOT_FOUND')
    );
  end if;

  if nullif(btrim(v_cc.cost_centre_code),'') is null
     or v_cc.cost_centre_code !~ '^[A-Z][A-Z0-9_]*$' then
    v_errors := v_errors || jsonb_build_array('INVALID_COST_CENTRE_CODE');
  end if;

  if nullif(btrim(v_cc.cost_centre_name),'') is null then
    v_errors := v_errors || jsonb_build_array('COST_CENTRE_NAME_REQUIRED');
  end if;

  if v_cc.effective_from is null then
    v_errors := v_errors || jsonb_build_array('EFFECTIVE_FROM_REQUIRED');
  end if;

  if v_cc.effective_to is not null and v_cc.effective_to < v_cc.effective_from then
    v_errors := v_errors || jsonb_build_array('INVALID_EFFECTIVE_DATE_RANGE');
  end if;

  if v_cc.default_resource_class_code is null then
    v_errors := v_errors || jsonb_build_array('DEFAULT_RESOURCE_CLASS_REQUIRED');
  elsif not exists (
    select 1
    from costing.production_resource_class r
    where r.code = v_cc.default_resource_class_code
      and r.is_active
  ) then
    v_errors := v_errors || jsonb_build_array('DEFAULT_RESOURCE_CLASS_NOT_ACTIVE');
  end if;

  if v_cc.cost_centre_type = 'EQUIPMENT_CENTRED' and v_cc.plant_id is null then
    v_errors := v_errors || jsonb_build_array('EQUIPMENT_CENTRED_REQUIRES_PLANT');
  end if;

  if v_cc.cost_centre_type in ('EQUIPMENT_CENTRED','PROCESS_AREA_CENTRED')
     and v_cc.area_id is null then
    v_errors := v_errors || jsonb_build_array('OPERATING_COST_CENTRE_REQUIRES_AREA');
  end if;

  if v_cc.area_id is not null then
    select a.section_id, a.subsection_id
    into v_area_section_id, v_area_subsection_id
    from public.areas a
    where a.id = v_cc.area_id;

    if v_area_section_id is null then
      v_errors := v_errors || jsonb_build_array('AREA_NOT_FOUND');
    else
      if v_cc.section_id is distinct from v_area_section_id then
        v_errors := v_errors || jsonb_build_array('AREA_SECTION_MISMATCH');
      end if;
      if v_cc.subsection_id is distinct from v_area_subsection_id then
        v_errors := v_errors || jsonb_build_array('AREA_SUBSECTION_MISMATCH');
      end if;
    end if;
  end if;

  if v_cc.subsection_id is not null then
    select s.section_id
    into v_subsection_section_id
    from public.subsections s
    where s.id = v_cc.subsection_id;

    if v_subsection_section_id is null then
      v_errors := v_errors || jsonb_build_array('SUBSECTION_NOT_FOUND');
    elsif v_cc.section_id is distinct from v_subsection_section_id then
      v_errors := v_errors || jsonb_build_array('SUBSECTION_SECTION_MISMATCH');
    end if;
  end if;

  if v_cc.section_id is not null then
    select s.id into v_section_id
    from public.sections s
    where s.id = v_cc.section_id;

    if v_section_id is null then
      v_errors := v_errors || jsonb_build_array('SECTION_NOT_FOUND');
    end if;
  end if;

  if v_cc.plant_id is not null then
    select p.section_id, p.subsection_id, p.area_id
    into v_plant_section_id, v_plant_subsection_id, v_plant_area_id
    from public.plant_machinery p
    where p.id = v_cc.plant_id;

    if v_plant_area_id is null then
      v_errors := v_errors || jsonb_build_array('PLANT_NOT_FOUND_OR_UNASSIGNED');
    else
      if v_cc.section_id is distinct from v_plant_section_id then
        v_errors := v_errors || jsonb_build_array('PLANT_SECTION_MISMATCH');
      end if;
      if v_cc.subsection_id is distinct from v_plant_subsection_id then
        v_errors := v_errors || jsonb_build_array('PLANT_SUBSECTION_MISMATCH');
      end if;
      if v_cc.area_id is distinct from v_plant_area_id then
        v_errors := v_errors || jsonb_build_array('PLANT_AREA_MISMATCH');
      end if;
    end if;
  end if;

  if v_cc.pool_scope = 'EXCLUDED_OTHER_POOL'
     and v_cc.cost_centre_type <> 'SERVICE_CENTRED' then
    v_errors := v_errors || jsonb_build_array('EXCLUDED_POOL_MUST_BE_SERVICE_CENTRED');
  end if;

  return jsonb_build_object(
    'cost_centre_id', v_cc.id,
    'status', v_cc.status,
    'valid', jsonb_array_length(v_errors) = 0,
    'errors', v_errors
  );
end
$function$;

create or replace function costing.fn_production_cost_centre_immutable()
returns trigger
language plpgsql
set search_path = costing, public
as $function$
begin
  if tg_op = 'DELETE' then
    if old.status = 'APPROVED' then
      raise exception 'Approved Production cost centre is immutable; inactivate instead';
    end if;
    return old;
  end if;

  if old.status = 'APPROVED' then
    if new.status not in ('APPROVED','INACTIVE') then
      raise exception 'Approved Production cost centre may only remain approved or become inactive';
    end if;

    if (to_jsonb(old) - array[
      'status','effective_to','updated_at',
      'inactivation_reference','inactivated_by','inactivated_at'
    ]) is distinct from
       (to_jsonb(new) - array[
      'status','effective_to','updated_at',
      'inactivation_reference','inactivated_by','inactivated_at'
    ]) then
      raise exception 'Approved Production cost centre definition is immutable';
    end if;
  end if;

  return new;
end
$function$;

drop trigger if exists trg_production_cost_centre_immutable
  on costing.production_cost_centre;
create trigger trg_production_cost_centre_immutable
before update or delete on costing.production_cost_centre
for each row execute function costing.fn_production_cost_centre_immutable();

create or replace function public.rpc_get_production_cost_centres(
  p_as_of_date date default current_date,
  p_status text default null,
  p_pool_scope text default null,
  p_search text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $function$
declare
  v_as_of date := coalesce(p_as_of_date,current_date);
begin
  perform public.require_permission('module:production-route-manager',false);

  return jsonb_build_object(
    'as_of_date', v_as_of,
    'cost_centres', coalesce((
      select jsonb_agg(
        to_jsonb(c)
        || jsonb_build_object(
          'section_name', s.section_name,
          'subsection_name', ss.subsection_name,
          'area_name', a.area_name,
          'plant_name', p.plant_name,
          'resource_class_label', r.label,
          'validation', costing.fn_validate_production_cost_centre(c.id)
        )
        order by c.cost_centre_name,c.id
      )
      from costing.production_cost_centre c
      left join public.sections s on s.id=c.section_id
      left join public.subsections ss on ss.id=c.subsection_id
      left join public.areas a on a.id=c.area_id
      left join public.plant_machinery p on p.id=c.plant_id
      left join costing.production_resource_class r on r.code=c.default_resource_class_code
      where (p_status is null or c.status=upper(p_status))
        and (p_pool_scope is null or c.pool_scope=upper(p_pool_scope))
        and (c.effective_from<=v_as_of)
        and (c.effective_to is null or c.effective_to>=v_as_of)
        and (
          nullif(btrim(p_search),'') is null
          or c.cost_centre_code ilike '%'||btrim(p_search)||'%'
          or c.cost_centre_name ilike '%'||btrim(p_search)||'%'
          or coalesce(a.area_name,'') ilike '%'||btrim(p_search)||'%'
          or coalesce(p.plant_name,'') ilike '%'||btrim(p_search)||'%'
        )
    ),'[]'::jsonb)
  );
end
$function$;

create or replace function public.rpc_get_production_cost_centre_detail(
  p_cost_centre_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $function$
declare
  v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager',false);

  select to_jsonb(c)
    || jsonb_build_object(
      'section_name', s.section_name,
      'subsection_name', ss.subsection_name,
      'area_name', a.area_name,
      'plant_name', p.plant_name,
      'resource_class_label', r.label,
      'validation', costing.fn_validate_production_cost_centre(c.id)
    )
  into v_result
  from costing.production_cost_centre c
  left join public.sections s on s.id=c.section_id
  left join public.subsections ss on ss.id=c.subsection_id
  left join public.areas a on a.id=c.area_id
  left join public.plant_machinery p on p.id=c.plant_id
  left join costing.production_resource_class r on r.code=c.default_resource_class_code
  where c.id=p_cost_centre_id;

  if v_result is null then
    raise exception 'Production cost centre % not found',p_cost_centre_id;
  end if;

  return jsonb_build_object('cost_centre',v_result);
end
$function$;

create or replace function public.rpc_create_production_cost_centre_draft(
  p_cost_centre_code text,
  p_cost_centre_name text,
  p_cost_centre_type text,
  p_section_id integer default null,
  p_subsection_id integer default null,
  p_area_id integer default null,
  p_plant_id integer default null,
  p_default_resource_class_code text default null,
  p_pool_scope text default 'SHARED_ROUTE',
  p_effective_from date default current_date,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $function$
declare
  v_id bigint;
  v_validation jsonb;
begin
  perform public.require_permission('module:production-route-manager',true);

  if nullif(btrim(p_cost_centre_code),'') is null then
    raise exception 'Cost-centre code is required';
  end if;
  if upper(btrim(p_cost_centre_code)) !~ '^[A-Z][A-Z0-9_]*$' then
    raise exception 'Cost-centre code must use uppercase letters, numbers, and underscores';
  end if;
  if nullif(btrim(p_cost_centre_name),'') is null then
    raise exception 'Cost-centre name is required';
  end if;
  if upper(coalesce(p_cost_centre_type,'')) not in ('EQUIPMENT_CENTRED','PROCESS_AREA_CENTRED','SERVICE_CENTRED') then
    raise exception 'Invalid cost-centre type';
  end if;
  if upper(coalesce(p_pool_scope,'')) not in ('PRODUCTION_OVERHEAD','DIRECT_LABOUR','SHARED_ROUTE','EXCLUDED_OTHER_POOL') then
    raise exception 'Invalid pool scope';
  end if;

  insert into costing.production_cost_centre(
    cost_centre_code,cost_centre_name,cost_centre_type,
    section_id,subsection_id,area_id,plant_id,
    default_resource_class_code,pool_scope,effective_from,
    description,status,created_by
  ) values (
    upper(btrim(p_cost_centre_code)),btrim(p_cost_centre_name),upper(p_cost_centre_type),
    p_section_id,p_subsection_id,p_area_id,p_plant_id,
    upper(nullif(btrim(p_default_resource_class_code),'')),upper(p_pool_scope),coalesce(p_effective_from,current_date),
    nullif(btrim(p_description),''),'DRAFT',auth.uid()
  ) returning id into v_id;

  v_validation := costing.fn_validate_production_cost_centre(v_id);

  return jsonb_build_object(
    'cost_centre_id',v_id,
    'status','DRAFT',
    'validation',v_validation
  );
end
$function$;

create or replace function public.rpc_update_production_cost_centre_draft(
  p_cost_centre_id bigint,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $function$
declare
  v_unknown text[];
  v_allowed constant text[] := array[
    'cost_centre_code','cost_centre_name','cost_centre_type',
    'section_id','subsection_id','area_id','plant_id',
    'default_resource_class_code','pool_scope','effective_from',
    'effective_to','description'
  ];
begin
  perform public.require_permission('module:production-route-manager',true);

  if p_cost_centre_id is null or p_cost_centre_id<=0 then
    raise exception 'A valid cost-centre ID is required';
  end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then
    raise exception 'A non-empty patch object is required';
  end if;

  select array_agg(k order by k) into v_unknown
  from jsonb_object_keys(p_patch) k
  where not (k=any(v_allowed));

  if coalesce(cardinality(v_unknown),0)>0 then
    raise exception 'Unsupported cost-centre patch keys: %',array_to_string(v_unknown,', ');
  end if;

  update costing.production_cost_centre c set
    cost_centre_code = case when p_patch?'cost_centre_code' then upper(btrim(p_patch->>'cost_centre_code')) else c.cost_centre_code end,
    cost_centre_name = case when p_patch?'cost_centre_name' then btrim(p_patch->>'cost_centre_name') else c.cost_centre_name end,
    cost_centre_type = case when p_patch?'cost_centre_type' then upper(btrim(p_patch->>'cost_centre_type')) else c.cost_centre_type end,
    section_id = case when p_patch?'section_id' then nullif(p_patch->>'section_id','')::integer else c.section_id end,
    subsection_id = case when p_patch?'subsection_id' then nullif(p_patch->>'subsection_id','')::integer else c.subsection_id end,
    area_id = case when p_patch?'area_id' then nullif(p_patch->>'area_id','')::integer else c.area_id end,
    plant_id = case when p_patch?'plant_id' then nullif(p_patch->>'plant_id','')::integer else c.plant_id end,
    default_resource_class_code = case when p_patch?'default_resource_class_code' then upper(nullif(btrim(p_patch->>'default_resource_class_code'),'')) else c.default_resource_class_code end,
    pool_scope = case when p_patch?'pool_scope' then upper(btrim(p_patch->>'pool_scope')) else c.pool_scope end,
    effective_from = case when p_patch?'effective_from' then (p_patch->>'effective_from')::date else c.effective_from end,
    effective_to = case when p_patch?'effective_to' then nullif(p_patch->>'effective_to','')::date else c.effective_to end,
    description = case when p_patch?'description' then nullif(btrim(p_patch->>'description'),'') else c.description end,
    updated_at=now()
  where c.id=p_cost_centre_id and c.status='DRAFT';

  if not found then
    raise exception 'Production cost centre is not editable';
  end if;

  return jsonb_build_object(
    'cost_centre_id',p_cost_centre_id,
    'updated',true,
    'validation',costing.fn_validate_production_cost_centre(p_cost_centre_id)
  );
end
$function$;

create or replace function public.rpc_validate_production_cost_centre(
  p_cost_centre_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $function$
begin
  perform public.require_permission('module:production-route-manager',false);
  return costing.fn_validate_production_cost_centre(p_cost_centre_id);
end
$function$;

create or replace function public.rpc_approve_production_cost_centre(
  p_cost_centre_id bigint,
  p_approval_reference text,
  p_effective_from date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $function$
declare
  v_validation jsonb;
begin
  perform public.require_permission('module:production-route-manager',true);

  if nullif(btrim(p_approval_reference),'') is null
     or upper(btrim(p_approval_reference)) in ('-','—','NA','N/A') then
    raise exception 'A meaningful approval reference is required';
  end if;

  if p_effective_from is not null then
    update costing.production_cost_centre
    set effective_from=p_effective_from,updated_at=now()
    where id=p_cost_centre_id and status='DRAFT';
  end if;

  v_validation := costing.fn_validate_production_cost_centre(p_cost_centre_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then
    raise exception 'Production cost centre is not valid: %',v_validation->'errors';
  end if;

  update costing.production_cost_centre
  set status='APPROVED',
      approval_reference=btrim(p_approval_reference),
      approved_by=auth.uid(),approved_at=now(),updated_at=now()
  where id=p_cost_centre_id and status='DRAFT';

  if not found then
    raise exception 'Production cost centre is not approvable';
  end if;

  return jsonb_build_object(
    'cost_centre_id',p_cost_centre_id,
    'status','APPROVED'
  );
end
$function$;

create or replace function public.rpc_inactivate_production_cost_centre(
  p_cost_centre_id bigint,
  p_effective_to date,
  p_inactivation_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $function$
declare
  v_effective_from date;
begin
  perform public.require_permission('module:production-route-manager',true);

  if p_effective_to is null then
    raise exception 'Effective-to date is required';
  end if;
  if nullif(btrim(p_inactivation_reference),'') is null
     or upper(btrim(p_inactivation_reference)) in ('-','—','NA','N/A') then
    raise exception 'A meaningful inactivation reference is required';
  end if;

  select effective_from into v_effective_from
  from costing.production_cost_centre
  where id=p_cost_centre_id and status='APPROVED';

  if v_effective_from is null then
    raise exception 'Approved Production cost centre not found';
  end if;
  if p_effective_to < v_effective_from then
    raise exception 'Effective-to date cannot precede effective-from date';
  end if;
  if exists(
    select 1
    from costing.production_route_family_route_step s
    join costing.production_route_family_route r on r.id=s.family_route_id
    where s.cost_centre_id=p_cost_centre_id
      and r.status='APPROVED'
      and r.effective_from<=p_effective_to
      and (r.effective_to is null or r.effective_to>=p_effective_to)
  ) then
    raise exception 'Production cost centre is used by an effective approved Route Family route';
  end if;

  update costing.production_cost_centre
  set status='INACTIVE',effective_to=p_effective_to,
      inactivation_reference=btrim(p_inactivation_reference),
      inactivated_by=auth.uid(),inactivated_at=now(),updated_at=now()
  where id=p_cost_centre_id and status='APPROVED';

  if not found then
    raise exception 'Production cost centre is not inactivatable';
  end if;

  return jsonb_build_object(
    'cost_centre_id',p_cost_centre_id,
    'status','INACTIVE',
    'effective_to',p_effective_to
  );
end
$function$;

revoke all on function public.rpc_get_production_cost_centres(date,text,text,text) from public,anon;
revoke all on function public.rpc_get_production_cost_centre_detail(bigint) from public,anon;
revoke all on function public.rpc_create_production_cost_centre_draft(text,text,text,integer,integer,integer,integer,text,text,date,text) from public,anon;
revoke all on function public.rpc_update_production_cost_centre_draft(bigint,jsonb) from public,anon;
revoke all on function public.rpc_validate_production_cost_centre(bigint) from public,anon;
revoke all on function public.rpc_approve_production_cost_centre(bigint,text,date) from public,anon;
revoke all on function public.rpc_inactivate_production_cost_centre(bigint,date,text) from public,anon;

grant execute on function public.rpc_get_production_cost_centres(date,text,text,text) to authenticated;
grant execute on function public.rpc_get_production_cost_centre_detail(bigint) to authenticated;
grant execute on function public.rpc_create_production_cost_centre_draft(text,text,text,integer,integer,integer,integer,text,text,date,text) to authenticated;
grant execute on function public.rpc_update_production_cost_centre_draft(bigint,jsonb) to authenticated;
grant execute on function public.rpc_validate_production_cost_centre(bigint) to authenticated;
grant execute on function public.rpc_approve_production_cost_centre(bigint,text,date) to authenticated;
grant execute on function public.rpc_inactivate_production_cost_centre(bigint,date,text) to authenticated;