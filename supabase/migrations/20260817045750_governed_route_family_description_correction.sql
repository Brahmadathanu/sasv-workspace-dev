-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_route_parent_immutable()
returns trigger
language plpgsql
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_archive_context boolean := coalesce(current_setting('app.route_archive_context',true),'')='GOVERNED';
  v_metadata_correction_context boolean := coalesce(current_setting('app.route_family_metadata_correction_context',true),'')='GOVERNED';
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

create or replace function public.rpc_correct_route_family_description(
  p_route_family_id bigint,
  p_corrected_description text,
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
  v_after costing.production_route_family%rowtype;
  v_description text := nullif(btrim(p_corrected_description),'');
  v_reason text := nullif(btrim(p_correction_reason),'');
  v_reference text := nullif(btrim(p_correction_reference),'');
  v_audit_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);

  if v_description is null or length(v_description) < 20 then
    raise exception 'A meaningful corrected Route Family description is required';
  end if;
  if v_reason is null or length(v_reason) < 10 then
    raise exception 'A meaningful correction reason is required';
  end if;
  if v_reference is null or upper(v_reference) in ('-','—','NA','N/A','AUTO','MIGRATION') then
    raise exception 'A meaningful correction reference is required';
  end if;

  select * into v_family
  from costing.production_route_family
  where id=p_route_family_id and archived_at is null
  for update;

  if not found then raise exception 'Route Family not found'; end if;
  if v_family.status <> 'APPROVED' then raise exception 'Only an approved Route Family description may be corrected through this RPC'; end if;
  if v_family.description is not distinct from v_description then raise exception 'Corrected description is unchanged'; end if;

  perform set_config('app.route_family_metadata_correction_context','GOVERNED',true);

  update costing.production_route_family
  set description=v_description,
      updated_at=now()
  where id=v_family.id
  returning * into v_after;

  v_audit_id := public.proc_lifecycle_audit_write_internal(
    'ROUTE_FAMILY_DESCRIPTION_CORRECTED',
    'production_route_family',
    v_family.id,
    null,
    null,
    v_reason,
    to_jsonb(v_family),
    to_jsonb(v_after),
    jsonb_build_object('correction_reference',v_reference)
  );

  return jsonb_build_object(
    'route_family_id',v_family.id,
    'family_code',v_family.family_code,
    'old_description',v_family.description,
    'corrected_description',v_after.description,
    'correction_reference',v_reference,
    'audit_event_id',v_audit_id,
    'status','CORRECTED'
  );
end
$function$;

revoke all on function public.rpc_correct_route_family_description(bigint,text,text,text) from public, anon;
grant execute on function public.rpc_correct_route_family_description(bigint,text,text,text) to authenticated, service_role;

comment on function public.rpc_correct_route_family_description(bigint,text,text,text)
is 'Governed audited correction of description only for an approved Production Route Family; all semantic and lifecycle fields remain immutable.';