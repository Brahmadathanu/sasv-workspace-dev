-- G2 HOLD: deliberately nondeployable pending approval transaction integration.
do $$ begin raise exception 'G2 HOLD: do not deploy incomplete approval safeguards'; end $$;

create table costing.route_repetition_confirmation (
  id bigint generated always as identity primary key,
  route_kind text not null check (route_kind in ('FAMILY','PRODUCT')),
  family_route_id bigint references costing.production_route_family_route(id),
  product_route_id bigint references costing.product_process_route(id),
  route_version integer not null check (route_version > 0),
  step_digest text not null check (step_digest ~ '^[a-f0-9]{64}$'),
  step_evidence jsonb not null check (jsonb_typeof(step_evidence)='array' and jsonb_array_length(step_evidence)>0),
  confirmed_by uuid not null default auth.uid(),
  confirmed_at timestamptz not null default now(),
  constraint g2_route_target_check check (
    (route_kind='FAMILY' and family_route_id is not null and product_route_id is null)
    or (route_kind='PRODUCT' and product_route_id is not null and family_route_id is null)
  )
);
create index on costing.route_repetition_confirmation(family_route_id,route_version);
create index on costing.route_repetition_confirmation(product_route_id,route_version);
alter table costing.route_repetition_confirmation enable row level security;
revoke all on costing.route_repetition_confirmation from anon,authenticated;

create function costing.reject_route_repetition_confirmation_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Route repetition confirmation is immutable';
end $$;
create trigger protect_route_repetition_confirmation
before update or delete on costing.route_repetition_confirmation
for each row execute function costing.reject_route_repetition_confirmation_mutation();

-- Ensure deletions of overrides serialize with approval via the parent route lock.
create or replace function public.rpc_delete_product_route_override(
  p_product_route_id bigint,p_override_id bigint
) returns jsonb language plpgsql security definer
set search_path=public,costing,pg_temp as $$
declare v_status text;
begin
  perform public.require_permission('module:production-route-manager',true);
  select status into v_status from costing.product_process_route
  where id=p_product_route_id and archived_at is null for update;
  if v_status is null or v_status not in ('DRAFT','REVIEW_REQUIRED') then
    raise exception 'Product route is missing, archived, or read-only';
  end if;
  delete from costing.product_process_route_override
  where id=p_override_id and product_route_id=p_product_route_id;
  return jsonb_build_object('deleted',found);
end $$;

-- Canonical route evidence for governed attestation.
create or replace function costing.fn_g2_repetition_evidence(p_kind text,p_route_id bigint)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,costing,pg_temp as $$
declare v_version integer; v_steps jsonb;
begin
 if p_kind='FAMILY' then
   select route_version into v_version from costing.production_route_family_route where id=p_route_id and archived_at is null;
   select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object('key',s.step_key,'occurrences',s.expected_occurrence_count,'cycles',s.standard_cycle_count) order by s.sequence_no,s.id),'[]'::jsonb)
   into v_steps from costing.production_route_family_route_step s where s.family_route_id=p_route_id;
 elsif p_kind='PRODUCT' then
   select route_version into v_version from costing.product_process_route where id=p_route_id and archived_at is null;
   select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object('key',s.effective_step_key,'occurrences',s.expected_occurrence_count,'cycles',s.standard_cycle_count) order by s.sequence_no,s.effective_step_key),'[]'::jsonb)
   into v_steps from costing.fn_effective_product_process_route_steps(p_route_id) s;
 else
   raise exception 'Invalid G2 route kind';
 end if;
 if v_version is null then raise exception 'G2 route not found'; end if;
 return jsonb_build_object('route_kind',p_kind,'route_id',p_route_id,'version',v_version,'steps',v_steps);
end $$;

-- Approval gate: compare current route evidence to immutable confirmation.
-- The digest is generated server-side from the canonical route structure.
create or replace function costing.fn_g2_require_repetition_confirmation(p_kind text,p_route_id bigint)
returns void language plpgsql security definer
set search_path=pg_catalog,costing,pg_temp as $$
declare v_evidence jsonb; v_dual jsonb; v_digest text; v_version integer;
begin
 v_evidence:=costing.fn_g2_repetition_evidence(p_kind,p_route_id);
 select coalesce(jsonb_agg(jsonb_build_object('key',s->>'key','occurrences',s->>'occurrences','cycles',s->>'cycles',
    'executions',(s->>'occurrences')::numeric*(s->>'cycles')::numeric) order by e.ordinal),'[]'::jsonb)
 into v_dual from jsonb_array_elements(v_evidence->'steps') with ordinality as e(s,ordinal)
 where (s->>'occurrences')::numeric>1 and (s->>'cycles')::numeric>1;
 if jsonb_array_length(v_dual)=0 then return; end if;
 v_digest:=encode(extensions.digest(v_evidence::text,'sha256'),'hex');
 v_version:=(v_evidence->>'version')::integer;
 if not exists (
   select 1 from costing.route_repetition_confirmation c
   where c.route_kind=p_kind and c.route_version=v_version and c.step_digest=v_digest
     and ((p_kind='FAMILY' and c.family_route_id=p_route_id) or (p_kind='PRODUCT' and c.product_route_id=p_route_id))
     and c.step_evidence=v_dual
 ) then
   raise exception 'G2: current nested repetition counts lack exact governed confirmation';
 end if;
end $$;

-- Captures explicit acknowledgement, never allowing the caller to supply the digest.
create or replace function public.rpc_confirm_route_repetition(
 p_kind text,p_route_id bigint,p_acknowledged_executions jsonb
) returns bigint language plpgsql security definer
set search_path=public,costing,pg_temp as $$
declare v_evidence jsonb; v_expected jsonb; v_status text; v_id bigint; v_actor uuid;
begin
 perform public.require_permission('module:production-route-manager',true);
 v_actor:=auth.uid();
 if v_actor is null then raise exception 'G2 confirmation requires authenticated actor'; end if;
 if p_kind='FAMILY' then
   select status into v_status from costing.production_route_family_route
   where id=p_route_id and archived_at is null for update;
 elsif p_kind='PRODUCT' then
   select status into v_status from costing.product_process_route
   where id=p_route_id and archived_at is null for update;
 else raise exception 'Unsupported G2 route kind'; end if;
 if v_status not in ('DRAFT','REVIEW_REQUIRED') then raise exception 'Route cannot be confirmed in this status'; end if;
 v_evidence:=costing.fn_g2_repetition_evidence(p_kind,p_route_id);
 select coalesce(jsonb_agg(jsonb_build_object('key',s->>'key','occurrences',s->>'occurrences','cycles',s->>'cycles',
   'executions',(s->>'occurrences')::numeric*(s->>'cycles')::numeric) order by e.ordinal),'[]'::jsonb)
 into v_expected from jsonb_array_elements(v_evidence->'steps') with ordinality as e(s,ordinal)
 where (s->>'occurrences')::numeric>1 and (s->>'cycles')::numeric>1;
 if jsonb_array_length(v_expected)=0 then raise exception 'No nested repetition to confirm'; end if;
 if p_acknowledged_executions is distinct from v_expected then
   raise exception 'Confirmed executions do not match current route';
 end if;
 insert into costing.route_repetition_confirmation
   (route_kind,family_route_id,product_route_id,route_version,step_digest,step_evidence,confirmed_by)
 values(p_kind,case when p_kind='FAMILY' then p_route_id end,
   case when p_kind='PRODUCT' then p_route_id end,
   (v_evidence->>'version')::integer,
   encode(extensions.digest(v_evidence::text,'sha256'),'hex'),v_expected,v_actor)
 returning id into v_id;
 return v_id;
end $$;

-- Exact approved RPC definitions, with attestation check before state updates.
CREATE OR REPLACE FUNCTION public.rpc_approve_product_route(p_product_route_id bigint, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
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
  perform costing.fn_g2_require_repetition_confirmation('PRODUCT',p_product_route_id);
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
$function$
;

CREATE OR REPLACE FUNCTION public.rpc_approve_route_family_route(p_family_route_id bigint, p_approval_reference text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
declare
  v_route costing.production_route_family_route%rowtype;
  v_old costing.production_route_family_route%rowtype;
  v_validation jsonb;
  v_ref text:=nullif(btrim(p_approval_reference),'');
begin
  perform public.require_permission('module:production-route-manager',true);
  if v_ref is null or upper(v_ref) in ('-','—','NA','N/A','AUTO','MIGRATION') then raise exception 'A meaningful approval reference is required'; end if;
  select * into v_route from costing.production_route_family_route where id=p_family_route_id and archived_at is null for update;
  if not found then raise exception 'Route Family route not found or is archived'; end if;
  if v_route.status<>'REVIEW_REQUIRED' then raise exception 'Route Family route must be in review'; end if;
  if v_route.effective_from is null then raise exception 'Route Family route effective_from is required before approval'; end if;
  if not exists(select 1 from costing.production_route_family where id=v_route.route_family_id and archived_at is null and status='APPROVED') then
    raise exception 'Route Family must be active and approved first';
  end if;
  v_validation:=costing.fn_validate_route_family_route(p_family_route_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then raise exception 'Route Family route validation failed: %',v_validation->'errors'; end if;
  perform costing.fn_g2_require_repetition_confirmation('FAMILY',p_family_route_id);
  if v_route.supersedes_route_id is not null then
    select * into v_old from costing.production_route_family_route
    where id=v_route.supersedes_route_id and archived_at is null for update;
    if not found or v_old.status<>'APPROVED' or v_old.route_family_id<>v_route.route_family_id then
      raise exception 'supersedes_route_id must identify the current active approved route of the same Route Family';
    end if;
    if v_route.effective_from<=v_old.effective_from then raise exception 'Successor route effective_from % must be after prior approved route effective_from %',v_route.effective_from,v_old.effective_from; end if;
    if exists(select 1 from costing.production_route_family_route r
      where r.id not in (p_family_route_id,v_old.id) and r.route_family_id=v_route.route_family_id and r.archived_at is null and r.status='APPROVED'
        and daterange(r.effective_from,coalesce(r.effective_to,'infinity'::date),'[]') && daterange(v_route.effective_from,'infinity'::date,'[]')) then
      raise exception 'Another active approved Route Family route overlaps the successor effective period';
    end if;
    update costing.production_route_family_route set status='SUPERSEDED',effective_to=v_route.effective_from-1,updated_at=now()
    where id=v_old.id and archived_at is null;
  else
    if exists(select 1 from costing.production_route_family_route r
      where r.id<>p_family_route_id and r.route_family_id=v_route.route_family_id and r.archived_at is null and r.status='APPROVED'
        and daterange(r.effective_from,coalesce(r.effective_to,'infinity'::date),'[]') && daterange(v_route.effective_from,'infinity'::date,'[]')) then
      raise exception 'An active approved Route Family route overlaps the requested effective period; create a successor version linked by supersedes_route_id';
    end if;
  end if;
  update costing.production_route_family_route
  set status='APPROVED',approval_reference=v_ref,approved_by=auth.uid(),approved_at=clock_timestamp(),updated_at=now()
  where id=p_family_route_id and archived_at is null;
  return jsonb_build_object('family_route_id',p_family_route_id,'status','APPROVED','superseded_route_id',v_route.supersedes_route_id,'validation',v_validation);
end
$function$
;


-- Access boundaries: privileged helpers are callable only by their owner.
revoke execute on function costing.fn_g2_repetition_evidence(text,bigint) from public;
revoke execute on function costing.fn_g2_require_repetition_confirmation(text,bigint) from public;
revoke execute on function public.rpc_confirm_route_repetition(text,bigint,jsonb) from public;
grant execute on function public.rpc_confirm_route_repetition(text,bigint,jsonb) to authenticated;
