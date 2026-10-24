-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Gate 11Y.10I.2C.3F.1B.2B.3
-- Allow archive metadata to be stamped only inside an explicit governed archive context,
-- while preserving immutable approved/terminal route definitions.

create or replace function costing.fn_route_parent_immutable()
returns trigger
language plpgsql
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_archive_context boolean := coalesce(current_setting('app.route_archive_context',true),'')='GOVERNED';
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

create or replace function costing.fn_product_route_family_assignment_guard()
returns trigger
language plpgsql
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_product_status text;
  v_archive_context boolean := coalesce(current_setting('app.route_archive_context',true),'')='GOVERNED';
begin
  if tg_op='DELETE' then
    if old.status in ('APPROVED','INACTIVE','SUPERSEDED','CANCELLED') or old.archived_at is not null then
      raise exception 'Governed Product Route Family assignment history is immutable; use a governed lifecycle/archive action instead';
    end if;
    return old;
  end if;

  if tg_op='INSERT' and new.archived_at is not null then
    raise exception 'New Product Route Family assignments cannot be created already archived';
  end if;

  if tg_op='UPDATE' and old.archived_at is not null then
    if to_jsonb(old) is distinct from to_jsonb(new) then raise exception 'Archived Product assignment history is immutable'; end if;
    return new;
  end if;

  if tg_op='UPDATE' and new.archived_at is not null and old.archived_at is null then
    if not v_archive_context then raise exception 'Product assignment archival requires governed archive context'; end if;
    if nullif(btrim(new.archive_reason),'') is null then raise exception 'Product assignment archival requires a meaningful archive reason'; end if;
    if (to_jsonb(old)-array['archived_at','archived_by','archive_reason','updated_at'])
       is distinct from
       (to_jsonb(new)-array['archived_at','archived_by','archive_reason','updated_at']) then
      raise exception 'Archival may not alter the Product assignment definition or lifecycle status';
    end if;
    return new;
  end if;

  if new.effective_to is not null and new.effective_to<new.effective_from then raise exception 'Assignment effective-to cannot precede effective-from'; end if;

  select upper(coalesce(p.status,'')) into v_product_status from public.products p where p.id=new.product_id;
  if v_product_status is distinct from 'ACTIVE' then raise exception 'Product % must be ACTIVE for Route Family assignment',new.product_id; end if;

  if new.status='CANCELLED' then
    if tg_op<>'UPDATE' or old.status not in('DRAFT','IN_REVIEW') then raise exception 'Only Draft or In-Review Product Route Family assignments may be cancelled'; end if;
    if nullif(btrim(new.cancellation_reason),'') is null or new.cancelled_at is null then raise exception 'Cancelled Product assignment requires a meaningful cancellation reason and timestamp'; end if;
    if (to_jsonb(old)-array['status','cancellation_reason','cancelled_by','cancelled_at','updated_at'])
       is distinct from
       (to_jsonb(new)-array['status','cancellation_reason','cancelled_by','cancelled_at','updated_at']) then
      raise exception 'Cancellation may not alter the Product assignment definition';
    end if;
  end if;

  if new.status='APPROVED' then
    if not exists(
      select 1 from costing.production_route_family f
      where f.id=new.route_family_id and f.archived_at is null and f.status='APPROVED'
        and f.effective_from<=new.effective_from and (f.effective_to is null or f.effective_to>=new.effective_from)
    ) then raise exception 'Route Family % must be active, approved and effective for assignment',new.route_family_id; end if;
    if nullif(btrim(new.approval_reference),'') is null or new.approved_at is null then raise exception 'Approved Product assignment requires approval reference and timestamp'; end if;
    if exists(
      select 1 from costing.production_route_family_product_map x
      where x.id<>coalesce(new.id,0) and x.product_id=new.product_id and x.archived_at is null and x.status='APPROVED'
        and daterange(x.effective_from,coalesce(x.effective_to,'infinity'::date),'[]')
            && daterange(new.effective_from,coalesce(new.effective_to,'infinity'::date),'[]')
    ) then raise exception 'Product % already has an overlapping approved Route Family assignment',new.product_id; end if;
  end if;

  if tg_op='UPDATE' and old.status='APPROVED' then
    if new.status not in('APPROVED','SUPERSEDED','INACTIVE') then raise exception 'Approved Product assignment may only remain approved or become superseded/inactive'; end if;
    if (to_jsonb(old)-array['status','effective_to','updated_at'])
       is distinct from
       (to_jsonb(new)-array['status','effective_to','updated_at']) then
      raise exception 'Approved Product assignment definition is immutable';
    end if;
  end if;

  if tg_op='UPDATE' and old.status in('INACTIVE','SUPERSEDED','CANCELLED') then
    if to_jsonb(old) is distinct from to_jsonb(new) then raise exception 'Terminal Product assignment history is immutable'; end if;
  end if;
  return new;
end
$function$;

-- Product Subgroup mappings use the same immutable lifecycle/archive guard as Group mappings.
drop trigger if exists trg_route_family_subgroup_mapping_immutable on costing.production_route_family_product_subgroup_map;
create trigger trg_route_family_subgroup_mapping_immutable
before update or delete on costing.production_route_family_product_subgroup_map
for each row execute function costing.fn_route_parent_immutable();