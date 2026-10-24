-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_route_parent_immutable()
returns trigger
language plpgsql
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_archive_context boolean := coalesce(current_setting('app.route_archive_context',true),'')='GOVERNED';
  v_metadata_correction_context boolean := coalesce(current_setting('app.route_family_metadata_correction_context',true),'')='GOVERNED';
  v_identity_correction_context boolean := coalesce(current_setting('app.route_family_identity_correction_context',true),'')='GOVERNED';
begin
  if tg_op='DELETE' then
    if old.status='APPROVED' then raise exception 'Approved route is immutable; supersede or archive through governed archive workflow'; end if;
    return old;
  end if;

  if old.archived_at is not null then
    if to_jsonb(old) is distinct from to_jsonb(new) then
      raise exception 'Archived route history is immutable';
    end if;
    return new;
  end if;

  if new.archived_at is not null and old.archived_at is null then
    if not v_archive_context then raise exception 'Route archival requires governed archive context'; end if;
    if nullif(btrim(new.archive_reason),'') is null then raise exception 'Route archival requires a meaningful archive reason'; end if;
    if (to_jsonb(old)-array['archived_at','archived_by','archive_reason','updated_at'])
       is distinct from
       (to_jsonb(new)-array['archived_at','archived_by','archive_reason','updated_at']) then
      raise exception 'Archival may not alter the route definition or lifecycle status';
    end if;
    return new;
  end if;

  if old.status='APPROVED' and v_identity_correction_context then
    if new.status <> 'APPROVED' then
      raise exception 'Identity metadata correction may not alter approved lifecycle status';
    end if;
    if tg_table_name='production_route_family' then
      if (to_jsonb(old)-array['family_code','family_name','description','updated_at'])
         is distinct from
         (to_jsonb(new)-array['family_code','family_name','description','updated_at']) then
        raise exception 'Governed Route Family identity correction may alter family code, name and description only';
      end if;
    elsif tg_table_name='production_route_family_route' then
      if (to_jsonb(old)-array['route_code','route_name','route_note','updated_at'])
         is distinct from
         (to_jsonb(new)-array['route_code','route_name','route_note','updated_at']) then
        raise exception 'Governed Route identity correction may alter route code, name and note only';
      end if;
    else
      raise exception 'Governed identity correction is not supported for table %',tg_table_name;
    end if;
    return new;
  end if;

  if old.status='APPROVED' and v_metadata_correction_context then
    if new.status <> 'APPROVED' then
      raise exception 'Metadata correction may not alter approved lifecycle status';
    end if;
    if (to_jsonb(old)-array['description','updated_at'])
       is distinct from
       (to_jsonb(new)-array['description','updated_at']) then
      raise exception 'Governed Route Family metadata correction may alter description only';
    end if;
    return new;
  end if;

  if old.status='APPROVED' then
    if new.status not in('APPROVED','SUPERSEDED','INACTIVE') then raise exception 'Approved route may only remain approved or become superseded/inactive'; end if;
    if (to_jsonb(old)-array['status','effective_to','updated_at'])
       is distinct from
       (to_jsonb(new)-array['status','effective_to','updated_at']) then
      raise exception 'Approved route definition is immutable; create a new version';
    end if;
  end if;
  return new;
end
$function$;

create or replace function public.rpc_correct_route_family_identity_metadata(
  p_route_family_id bigint,
  p_family_route_id bigint,
  p_family_code text,
  p_family_name text,
  p_family_description text,
  p_route_code text,
  p_route_name text,
  p_route_note text,
  p_correction_reason text,
  p_correction_reference text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_family costing.production_route_family%rowtype;
  v_family_after costing.production_route_family%rowtype;
  v_route costing.production_route_family_route%rowtype;
  v_route_after costing.production_route_family_route%rowtype;
  v_family_audit_id bigint;
  v_route_audit_id bigint;
  v_reason text := nullif(btrim(p_correction_reason),'');
  v_ref text := nullif(btrim(p_correction_reference),'');
  v_family_code text := upper(nullif(btrim(p_family_code),''));
  v_route_code text := upper(nullif(btrim(p_route_code),''));
begin
  perform public.require_permission('module:production-route-manager',true);

  if p_route_family_id is null or p_family_route_id is null then raise exception 'Route Family and Family Route IDs are required'; end if;
  if v_reason is null or length(v_reason)<10 then raise exception 'A meaningful correction reason is required'; end if;
  if v_ref is null or upper(v_ref) in ('-','—','NA','N/A','AUTO','MIGRATION') then raise exception 'A meaningful correction reference is required'; end if;
  if v_family_code is null or v_family_code !~ '^[A-Z][A-Z0-9_]*$' then raise exception 'Family code must use uppercase letters, numbers and underscores'; end if;
  if v_route_code is null or v_route_code !~ '^[A-Z][A-Z0-9_]*$' then raise exception 'Route code must use uppercase letters, numbers and underscores'; end if;
  if nullif(btrim(p_family_name),'') is null then raise exception 'Family name is required'; end if;
  if nullif(btrim(p_route_name),'') is null then raise exception 'Route name is required'; end if;
  if nullif(btrim(p_family_description),'') is null or length(btrim(p_family_description))<20 then raise exception 'A meaningful Family description is required'; end if;
  if nullif(btrim(p_route_note),'') is null or length(btrim(p_route_note))<20 then raise exception 'A meaningful Route note is required'; end if;

  select * into v_family
  from costing.production_route_family
  where id=p_route_family_id and archived_at is null
  for update;
  if not found then raise exception 'Route Family not found'; end if;
  if v_family.status<>'APPROVED' then raise exception 'Only an approved Route Family may be identity-corrected'; end if;

  select * into v_route
  from costing.production_route_family_route
  where id=p_family_route_id and route_family_id=p_route_family_id and archived_at is null
  for update;
  if not found then raise exception 'Family Route not found for the supplied Route Family'; end if;
  if v_route.status<>'APPROVED' then raise exception 'Only an approved Family Route may be identity-corrected'; end if;

  if exists(select 1 from costing.production_route_family f where f.id<>v_family.id and f.family_code=v_family_code) then
    raise exception 'Family code % is already in use',v_family_code;
  end if;
  if exists(select 1 from costing.production_route_family_route r where r.id<>v_route.id and r.route_code=v_route_code and r.route_version=v_route.route_version) then
    raise exception 'Route code/version %/% is already in use',v_route_code,v_route.route_version;
  end if;

  perform set_config('app.route_family_identity_correction_context','GOVERNED',true);

  update costing.production_route_family
  set family_code=v_family_code,
      family_name=btrim(p_family_name),
      description=btrim(p_family_description),
      updated_at=now()
  where id=v_family.id
  returning * into v_family_after;

  update costing.production_route_family_route
  set route_code=v_route_code,
      route_name=btrim(p_route_name),
      route_note=btrim(p_route_note),
      updated_at=now()
  where id=v_route.id
  returning * into v_route_after;

  v_family_audit_id := public.proc_lifecycle_audit_write_internal(
    'ROUTE_FAMILY_IDENTITY_METADATA_CORRECTED','production_route_family',v_family.id,
    null,null,v_reason,to_jsonb(v_family),to_jsonb(v_family_after),
    jsonb_build_object('correction_reference',v_ref,'family_route_id',v_route.id)
  );

  v_route_audit_id := public.proc_lifecycle_audit_write_internal(
    'ROUTE_FAMILY_ROUTE_IDENTITY_METADATA_CORRECTED','production_route_family_route',v_route.id,
    'production_route_family',v_family.id,v_reason,to_jsonb(v_route),to_jsonb(v_route_after),
    jsonb_build_object('correction_reference',v_ref)
  );

  return jsonb_build_object(
    'route_family_id',v_family.id,
    'family_route_id',v_route.id,
    'family_code',v_family_after.family_code,
    'family_name',v_family_after.family_name,
    'route_code',v_route_after.route_code,
    'route_name',v_route_after.route_name,
    'family_audit_event_id',v_family_audit_id,
    'route_audit_event_id',v_route_audit_id,
    'status','CORRECTED'
  );
end
$function$;

revoke all on function public.rpc_correct_route_family_identity_metadata(bigint,bigint,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.rpc_correct_route_family_identity_metadata(bigint,bigint,text,text,text,text,text,text,text,text) to authenticated;