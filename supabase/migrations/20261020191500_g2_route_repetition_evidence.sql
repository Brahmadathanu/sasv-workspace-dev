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
   select coalesce(jsonb_agg(jsonb_build_object('key',s.step_key,'id',s.id,'sequence',s.sequence_no,'occurrences',s.expected_occurrence_count,'cycles',s.standard_cycle_count,'activity',s.activity_id,'cost_centre',s.cost_centre_id,'scope',s.route_step_scope) order by s.sequence_no,s.id),'[]'::jsonb)
   into v_steps from costing.production_route_family_route_step s where s.family_route_id=p_route_id;
 elsif p_kind='PRODUCT' then
   select route_version into v_version from costing.product_process_route where id=p_route_id and archived_at is null;
   select coalesce(jsonb_agg(jsonb_build_object('key',s.effective_step_key,'base_id',s.base_step_id,'override_id',s.override_id,'sequence',s.sequence_no,'occurrences',s.expected_occurrence_count,'cycles',s.standard_cycle_count,'activity',s.activity_id,'cost_centre',s.cost_centre_id,'scope',s.route_step_scope) order by s.sequence_no,s.effective_step_key),'[]'::jsonb)
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
    'executions',(s->>'occurrences')::numeric*(s->>'cycles')::numeric)),'[]'::jsonb)
 into v_dual from jsonb_array_elements(v_evidence->'steps') s
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
