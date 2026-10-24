-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

-- 1) Prevent overlapping APPROVED/non-archived effective periods at every routing tier.
alter table costing.production_route_family_product_group_map
  add constraint production_route_family_pg_map_no_approved_overlap
  exclude using gist (
    product_group_id with =,
    daterange(effective_from, coalesce(effective_to,'infinity'::date), '[]') with &&
  ) where (status='APPROVED' and archived_at is null);

alter table costing.production_route_family_product_subgroup_map
  add constraint production_route_family_psg_map_no_approved_overlap
  exclude using gist (
    product_subgroup_id with =,
    daterange(effective_from, coalesce(effective_to,'infinity'::date), '[]') with &&
  ) where (status='APPROVED' and archived_at is null);

alter table costing.production_route_family_product_map
  add constraint production_route_family_product_map_no_approved_overlap
  exclude using gist (
    product_id with =,
    daterange(effective_from, coalesce(effective_to,'infinity'::date), '[]') with &&
  ) where (status='APPROVED' and archived_at is null);

alter table costing.production_route_family_route
  add constraint production_route_family_route_no_approved_overlap
  exclude using gist (
    route_family_id with =,
    daterange(effective_from, coalesce(effective_to,'infinity'::date), '[]') with &&
  ) where (status='APPROVED' and archived_at is null);

alter table costing.product_process_route
  add constraint product_process_route_no_approved_overlap
  exclude using gist (
    product_id with =,
    daterange(effective_from, coalesce(effective_to,'infinity'::date), '[]') with &&
  ) where (status='APPROVED' and archived_at is null);

-- 2) Only one writable replacement candidate per subject/tier.
create unique index production_route_family_pg_map_one_writable_uq
  on costing.production_route_family_product_group_map(product_group_id)
  where archived_at is null and status in ('DRAFT','IN_REVIEW');

create unique index production_route_family_psg_map_one_writable_uq
  on costing.production_route_family_product_subgroup_map(product_subgroup_id)
  where archived_at is null and status in ('DRAFT','IN_REVIEW');

create unique index production_route_family_product_map_one_writable_uq
  on costing.production_route_family_product_map(product_id)
  where archived_at is null and status in ('DRAFT','IN_REVIEW');

create unique index production_route_family_route_one_writable_uq
  on costing.production_route_family_route(route_family_id)
  where archived_at is null and status in ('DRAFT','REVIEW_REQUIRED');

create unique index product_process_route_one_writable_uq
  on costing.product_process_route(product_id)
  where archived_at is null and status in ('DRAFT','REVIEW_REQUIRED');

-- 3) Group mapping draft creation: approved current mapping may coexist with one replacement Draft.
create or replace function public.rpc_map_product_group_to_route_family(
  p_route_family_id bigint,
  p_product_group_id integer,
  p_effective_from date default null,
  p_mapping_basis text default 'MANUAL',
  p_mapping_note text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare v_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  if upper(coalesce(p_mapping_basis,'')) not in ('MANUAL','HISTORICAL_REVIEW','MIGRATED') then
    raise exception 'Invalid mapping basis';
  end if;
  if exists(
    select 1 from costing.production_route_family_product_group_map
    where product_group_id=p_product_group_id
      and archived_at is null
      and status in ('DRAFT','IN_REVIEW')
  ) then
    raise exception 'Product Group already has a writable Route Family mapping draft';
  end if;
  insert into costing.production_route_family_product_group_map(
    route_family_id,product_group_id,effective_from,mapping_basis,mapping_note,status,created_by
  ) values(
    p_route_family_id,p_product_group_id,coalesce(p_effective_from,current_date),upper(p_mapping_basis),nullif(btrim(p_mapping_note),''),'DRAFT',auth.uid()
  ) returning id into v_id;
  return jsonb_build_object('mapping_id',v_id,'status','DRAFT');
end
$function$;

-- 4) Product assignment draft creation: approved current mapping may coexist with one replacement Draft.
create or replace function public.rpc_create_product_route_family_assignment_draft(
  p_product_id integer,
  p_route_family_id bigint,
  p_effective_from date default current_date,
  p_assignment_basis text default 'HISTORICAL_REVIEW',
  p_assignment_note text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare v_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  if upper(coalesce(p_assignment_basis,'')) not in ('MANUAL','HISTORICAL_REVIEW','MIGRATED') then
    raise exception 'Invalid assignment basis';
  end if;
  if exists(
    select 1 from costing.production_route_family_product_map
    where product_id=p_product_id
      and archived_at is null
      and status in ('DRAFT','IN_REVIEW')
  ) then
    raise exception 'Product already has a writable Route Family assignment draft';
  end if;
  insert into costing.production_route_family_product_map(
    route_family_id,product_id,effective_from,assignment_basis,assignment_note,status,created_by
  ) values(
    p_route_family_id,p_product_id,coalesce(p_effective_from,current_date),upper(p_assignment_basis),nullif(btrim(p_assignment_note),''),'DRAFT',auth.uid()
  ) returning id into v_id;
  return jsonb_build_object('assignment_id',v_id,'status','DRAFT');
end
$function$;

-- 5) Subgroup mapping lifecycle RPCs.
create or replace function public.rpc_map_product_subgroup_to_route_family(
  p_route_family_id bigint,
  p_product_subgroup_id integer,
  p_effective_from date default null,
  p_mapping_basis text default 'MANUAL',
  p_mapping_note text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare v_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  if upper(coalesce(p_mapping_basis,'')) not in ('MANUAL','HISTORICAL_REVIEW','MIGRATED') then
    raise exception 'Invalid mapping basis';
  end if;
  if exists(
    select 1 from costing.production_route_family_product_subgroup_map
    where product_subgroup_id=p_product_subgroup_id
      and archived_at is null
      and status in ('DRAFT','IN_REVIEW')
  ) then
    raise exception 'Product Subgroup already has a writable Route Family mapping draft';
  end if;
  insert into costing.production_route_family_product_subgroup_map(
    route_family_id,product_subgroup_id,effective_from,mapping_basis,mapping_note,status,created_by
  ) values(
    p_route_family_id,p_product_subgroup_id,coalesce(p_effective_from,current_date),upper(p_mapping_basis),nullif(btrim(p_mapping_note),''),'DRAFT',auth.uid()
  ) returning id into v_id;
  return jsonb_build_object('mapping_id',v_id,'status','DRAFT');
end
$function$;

create or replace function public.rpc_submit_product_subgroup_route_family_mapping_for_review(p_mapping_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
begin
  perform public.require_permission('module:production-route-manager',true);
  update costing.production_route_family_product_subgroup_map
  set status='IN_REVIEW',updated_at=now()
  where id=p_mapping_id and archived_at is null and status='DRAFT';
  if not found then raise exception 'Product Subgroup Route Family mapping is not submittable'; end if;
  return jsonb_build_object('mapping_id',p_mapping_id,'status','IN_REVIEW');
end
$function$;

-- 6) Approval helper pattern: atomically supersede current approved record, reject future conflicts.
create or replace function public.rpc_approve_route_family_mapping(
  p_mapping_id bigint,
  p_approval_reference text,
  p_effective_from date default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_new costing.production_route_family_product_group_map%rowtype;
  v_old costing.production_route_family_product_group_map%rowtype;
  v_from date;
  v_ref text:=nullif(btrim(p_approval_reference),'');
begin
  perform public.require_permission('module:production-route-manager',true);
  if v_ref is null or upper(v_ref) in ('-','—','NA','N/A') then raise exception 'A meaningful approval reference is required'; end if;
  select * into v_new from costing.production_route_family_product_group_map where id=p_mapping_id and archived_at is null for update;
  if not found then raise exception 'Route Family mapping not found'; end if;
  if v_new.status not in ('DRAFT','IN_REVIEW') then raise exception 'Route Family mapping is not approvable'; end if;
  v_from:=coalesce(p_effective_from,v_new.effective_from,current_date);
  if not exists(select 1 from costing.production_route_family f where f.id=v_new.route_family_id and f.archived_at is null and f.status='APPROVED' and f.effective_from<=v_from and (f.effective_to is null or f.effective_to>=v_from)) then
    raise exception 'Route Family must be approved and effective before its mapping';
  end if;
  if exists(select 1 from costing.production_route_family_product_group_map m where m.id<>p_mapping_id and m.product_group_id=v_new.product_group_id and m.archived_at is null and m.status='APPROVED' and m.effective_from>v_from) then
    raise exception 'A future approved Product Group mapping already exists; resolve it before approving this replacement';
  end if;
  select * into v_old from costing.production_route_family_product_group_map m
  where m.id<>p_mapping_id and m.product_group_id=v_new.product_group_id and m.archived_at is null and m.status='APPROVED'
    and m.effective_from<=v_from and (m.effective_to is null or m.effective_to>=v_from)
  order by m.effective_from desc,m.id desc limit 1 for update;
  if found then
    if v_from<=v_old.effective_from then raise exception 'Replacement effective_from must be after the current approved mapping effective_from'; end if;
    update costing.production_route_family_product_group_map set status='SUPERSEDED',effective_to=v_from-1,updated_at=now() where id=v_old.id;
  end if;
  update costing.production_route_family_product_group_map
  set status='APPROVED',effective_from=v_from,approval_reference=v_ref,approved_by=auth.uid(),approved_at=clock_timestamp(),supersedes_mapping_id=case when v_old.id is null then supersedes_mapping_id else v_old.id end,updated_at=now()
  where id=p_mapping_id;
  return jsonb_build_object('mapping_id',p_mapping_id,'status','APPROVED','superseded_mapping_id',v_old.id);
end
$function$;

create or replace function public.rpc_approve_product_subgroup_route_family_mapping(
  p_mapping_id bigint,
  p_approval_reference text,
  p_effective_from date default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_new costing.production_route_family_product_subgroup_map%rowtype;
  v_old costing.production_route_family_product_subgroup_map%rowtype;
  v_from date;
  v_ref text:=nullif(btrim(p_approval_reference),'');
begin
  perform public.require_permission('module:production-route-manager',true);
  if v_ref is null or upper(v_ref) in ('-','—','NA','N/A') then raise exception 'A meaningful approval reference is required'; end if;
  select * into v_new from costing.production_route_family_product_subgroup_map where id=p_mapping_id and archived_at is null for update;
  if not found then raise exception 'Product Subgroup Route Family mapping not found'; end if;
  if v_new.status not in ('DRAFT','IN_REVIEW') then raise exception 'Product Subgroup Route Family mapping is not approvable'; end if;
  v_from:=coalesce(p_effective_from,v_new.effective_from,current_date);
  if not exists(select 1 from costing.production_route_family f where f.id=v_new.route_family_id and f.archived_at is null and f.status='APPROVED' and f.effective_from<=v_from and (f.effective_to is null or f.effective_to>=v_from)) then
    raise exception 'Route Family must be approved and effective before its mapping';
  end if;
  if exists(select 1 from costing.production_route_family_product_subgroup_map m where m.id<>p_mapping_id and m.product_subgroup_id=v_new.product_subgroup_id and m.archived_at is null and m.status='APPROVED' and m.effective_from>v_from) then
    raise exception 'A future approved Product Subgroup mapping already exists; resolve it before approving this replacement';
  end if;
  select * into v_old from costing.production_route_family_product_subgroup_map m
  where m.id<>p_mapping_id and m.product_subgroup_id=v_new.product_subgroup_id and m.archived_at is null and m.status='APPROVED'
    and m.effective_from<=v_from and (m.effective_to is null or m.effective_to>=v_from)
  order by m.effective_from desc,m.id desc limit 1 for update;
  if found then
    if v_from<=v_old.effective_from then raise exception 'Replacement effective_from must be after the current approved mapping effective_from'; end if;
    update costing.production_route_family_product_subgroup_map set status='SUPERSEDED',effective_to=v_from-1,updated_at=now() where id=v_old.id;
  end if;
  update costing.production_route_family_product_subgroup_map
  set status='APPROVED',effective_from=v_from,approval_reference=v_ref,approved_by=auth.uid(),approved_at=clock_timestamp(),supersedes_mapping_id=case when v_old.id is null then supersedes_mapping_id else v_old.id end,updated_at=now()
  where id=p_mapping_id;
  return jsonb_build_object('mapping_id',p_mapping_id,'status','APPROVED','superseded_mapping_id',v_old.id);
end
$function$;

create or replace function public.rpc_approve_product_route_family_assignment(
  p_assignment_id bigint,
  p_approval_reference text,
  p_effective_from date default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_new costing.production_route_family_product_map%rowtype;
  v_old costing.production_route_family_product_map%rowtype;
  v_from date;
  v_ref text:=nullif(btrim(p_approval_reference),'');
begin
  perform public.require_permission('module:production-route-manager',true);
  if v_ref is null or upper(v_ref) in ('-','—','NA','N/A') then raise exception 'A meaningful approval reference is required'; end if;
  select * into v_new from costing.production_route_family_product_map where id=p_assignment_id and archived_at is null for update;
  if not found then raise exception 'Product Route Family assignment not found'; end if;
  if v_new.status not in ('DRAFT','IN_REVIEW') then raise exception 'Product Route Family assignment is not approvable'; end if;
  v_from:=coalesce(p_effective_from,v_new.effective_from,current_date);
  if not exists(select 1 from costing.production_route_family f where f.id=v_new.route_family_id and f.archived_at is null and f.status='APPROVED' and f.effective_from<=v_from and (f.effective_to is null or f.effective_to>=v_from)) then
    raise exception 'Route Family must be approved and effective before its assignment';
  end if;
  if exists(select 1 from costing.production_route_family_product_map m where m.id<>p_assignment_id and m.product_id=v_new.product_id and m.archived_at is null and m.status='APPROVED' and m.effective_from>v_from) then
    raise exception 'A future approved Product assignment already exists; resolve it before approving this replacement';
  end if;
  select * into v_old from costing.production_route_family_product_map m
  where m.id<>p_assignment_id and m.product_id=v_new.product_id and m.archived_at is null and m.status='APPROVED'
    and m.effective_from<=v_from and (m.effective_to is null or m.effective_to>=v_from)
  order by m.effective_from desc,m.id desc limit 1 for update;
  if found then
    if v_from<=v_old.effective_from then raise exception 'Replacement effective_from must be after the current approved assignment effective_from'; end if;
    update costing.production_route_family_product_map set status='SUPERSEDED',effective_to=v_from-1,updated_at=now() where id=v_old.id;
  end if;
  update costing.production_route_family_product_map
  set status='APPROVED',effective_from=v_from,approval_reference=v_ref,approved_by=auth.uid(),approved_at=clock_timestamp(),supersedes_assignment_id=case when v_old.id is null then supersedes_assignment_id else v_old.id end,updated_at=now()
  where id=p_assignment_id;
  return jsonb_build_object('assignment_id',p_assignment_id,'status','APPROVED','superseded_assignment_id',v_old.id);
end
$function$;

-- 7) Product Route approval now mirrors Family Route successor governance.
create or replace function public.rpc_approve_product_route(
  p_product_route_id bigint,
  p_approval_reference text
) returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_route costing.product_process_route%rowtype;
  v_old costing.product_process_route%rowtype;
  v_validation jsonb;
  v_ref text:=nullif(btrim(p_approval_reference),'');
begin
  perform public.require_permission('module:production-route-manager',true);
  if v_ref is null or upper(v_ref) in ('-','—','NA','N/A','AUTO','MIGRATION') then raise exception 'A meaningful approval reference is required'; end if;
  select * into v_route from costing.product_process_route where id=p_product_route_id and archived_at is null for update;
  if not found then raise exception 'Product route not found'; end if;
  if v_route.status<>'REVIEW_REQUIRED' then raise exception 'Product route must be in review'; end if;
  if v_route.effective_from is null then raise exception 'Product route effective_from is required before approval'; end if;
  v_validation:=costing.fn_validate_product_process_route(p_product_route_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then raise exception 'Product route validation failed: %',v_validation->'errors'; end if;
  if v_route.supersedes_route_id is not null then
    select * into v_old from costing.product_process_route where id=v_route.supersedes_route_id and archived_at is null for update;
    if not found or v_old.status<>'APPROVED' or v_old.product_id<>v_route.product_id then raise exception 'supersedes_route_id must identify the current approved route of the same Product'; end if;
    if v_route.effective_from<=v_old.effective_from then raise exception 'Successor Product route effective_from must be after prior approved route effective_from'; end if;
    if exists(select 1 from costing.product_process_route r where r.id not in (p_product_route_id,v_old.id) and r.product_id=v_route.product_id and r.archived_at is null and r.status='APPROVED' and daterange(r.effective_from,coalesce(r.effective_to,'infinity'::date),'[]') && daterange(v_route.effective_from,'infinity'::date,'[]')) then
      raise exception 'Another approved Product route overlaps the successor effective period';
    end if;
    update costing.product_process_route set status='SUPERSEDED',effective_to=v_route.effective_from-1,updated_at=now() where id=v_old.id;
  else
    if exists(select 1 from costing.product_process_route r where r.id<>p_product_route_id and r.product_id=v_route.product_id and r.archived_at is null and r.status='APPROVED' and daterange(r.effective_from,coalesce(r.effective_to,'infinity'::date),'[]') && daterange(v_route.effective_from,'infinity'::date,'[]')) then
      raise exception 'An approved Product route overlaps the requested effective period; create a successor version linked by supersedes_route_id';
    end if;
  end if;
  update costing.product_process_route set status='APPROVED',approval_reference=v_ref,approved_by=auth.uid(),approved_at=clock_timestamp(),updated_at=now() where id=p_product_route_id;
  return jsonb_build_object('product_route_id',p_product_route_id,'status','APPROVED','superseded_route_id',v_route.supersedes_route_id,'validation',v_validation);
end
$function$;

-- 8) Ensure draft creation cannot create multiple writable Family/Product routes.
create or replace function public.rpc_create_route_family_route_draft(
  p_route_family_id bigint,
  p_route_name text,
  p_effective_from date default null,
  p_source_type text default 'MANUAL',
  p_evidence_status text default 'MANUAL_COMPLETE',
  p_route_note text default null,
  p_supersedes_route_id bigint default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare v_version integer; v_code text; v_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  if nullif(btrim(p_route_name),'') is null then raise exception 'Route name is required'; end if;
  if exists(select 1 from costing.production_route_family_route where route_family_id=p_route_family_id and archived_at is null and status in ('DRAFT','REVIEW_REQUIRED')) then
    raise exception 'Route Family already has a writable route draft';
  end if;
  select coalesce(max(route_version),0)+1 into v_version from costing.production_route_family_route where route_family_id=p_route_family_id;
  select family_code||'_ROUTE' into v_code from costing.production_route_family where id=p_route_family_id and archived_at is null;
  if v_code is null then raise exception 'Route Family % not found',p_route_family_id; end if;
  insert into costing.production_route_family_route(route_family_id,route_code,route_version,route_name,effective_from,source_type,evidence_status,route_note,supersedes_route_id,created_by)
  values(p_route_family_id,v_code,v_version,btrim(p_route_name),p_effective_from,upper(p_source_type),upper(p_evidence_status),nullif(btrim(p_route_note),''),p_supersedes_route_id,auth.uid()) returning id into v_id;
  return jsonb_build_object('family_route_id',v_id,'route_version',v_version,'status','DRAFT');
end
$function$;

create or replace function public.rpc_create_product_route_draft(
  p_product_id integer,
  p_base_route_family_route_id bigint,
  p_batch_size_ref_id bigint,
  p_effective_from date default null,
  p_source_type text default 'ROUTE_FAMILY_ONLY',
  p_evidence_status text default 'MANUAL_COMPLETE',
  p_route_note text default null,
  p_supersedes_route_id bigint default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare v_version integer; v_id bigint; v_family_id bigint; v_base_family_id bigint; v_batch_product integer;
begin
  perform public.require_permission('module:production-route-manager',true);
  if exists(select 1 from costing.product_process_route where product_id=p_product_id and archived_at is null and status in ('DRAFT','REVIEW_REQUIRED')) then
    raise exception 'Product already has a writable Product route draft';
  end if;
  v_family_id:=costing.fn_resolve_route_family_for_product(p_product_id,coalesce(p_effective_from,current_date));
  select route_family_id into v_base_family_id from costing.production_route_family_route where id=p_base_route_family_route_id and archived_at is null and status='APPROVED';
  if v_family_id is null then raise exception 'Product has no approved Route Family mapping'; end if;
  if v_base_family_id is null or v_base_family_id<>v_family_id then raise exception 'Base Route Family route does not match the Product mapping'; end if;
  select product_id into v_batch_product from public.production_batch_size_ref where id=p_batch_size_ref_id and is_active;
  if v_batch_product is distinct from p_product_id then raise exception 'Batch-size reference does not belong to Product'; end if;
  select coalesce(max(route_version),0)+1 into v_version from costing.product_process_route where product_id=p_product_id;
  insert into costing.product_process_route(product_id,base_route_family_route_id,route_version,route_code,effective_from,batch_size_ref_id,source_type,evidence_status,route_note,supersedes_route_id,created_by)
  values(p_product_id,p_base_route_family_route_id,v_version,'PRODUCT_'||p_product_id||'_ROUTE',p_effective_from,p_batch_size_ref_id,upper(p_source_type),upper(p_evidence_status),nullif(btrim(p_route_note),''),p_supersedes_route_id,auth.uid()) returning id into v_id;
  return jsonb_build_object('product_route_id',v_id,'route_version',v_version,'status','DRAFT');
end
$function$;

-- 9) Grants for new subgroup lifecycle RPCs.
revoke all on function public.rpc_map_product_subgroup_to_route_family(bigint,integer,date,text,text) from public;
revoke all on function public.rpc_submit_product_subgroup_route_family_mapping_for_review(bigint) from public;
revoke all on function public.rpc_approve_product_subgroup_route_family_mapping(bigint,text,date) from public;
grant execute on function public.rpc_map_product_subgroup_to_route_family(bigint,integer,date,text,text) to authenticated;
grant execute on function public.rpc_submit_product_subgroup_route_family_mapping_for_review(bigint) to authenticated;
grant execute on function public.rpc_approve_product_subgroup_route_family_mapping(bigint,text,date) to authenticated;

commit;