-- WP05-W506-SEC-FIX-01 isolated LOCAL fixture. SYNTHETIC ONLY -- never run against production or any shared database.
-- The functions below are TEST DOUBLES that mimic the *shape and semantics recorded in issue #234*; they are NOT the
-- live definitions (the live internal body, md5 553d103a..., is not in the repository). Positive/negative results
-- from this fixture prove the migration's mechanics and the guard's ordering, not live behaviour.
\set ON_ERROR_STOP on
set client_min_messages = warning;
-- NOTE: the live helper's denial exception text/SQLSTATE is not assumed; tests only require a non-validation error and no write.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth; create schema if not exists costing;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table if not exists public.user_permissions_canonical(user_id uuid, target text, can_view boolean, can_edit boolean);
-- Test double of public.require_permission(text,boolean) with the semantics recorded in CLD2:
-- non-null auth.uid(), exact target row, can_view = true, and can_edit = true when p_edit.
create or replace function public.require_permission(p_target text, p_edit boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_permissions_canonical p
                 where p.user_id = u and p.target = p_target and p.can_view is true and (not p_edit or p.can_edit is true)) then
    raise exception 'permission denied for %', p_target using errcode = '42501';
  end if;
end $$;

drop table if exists costing.staff_costing_classification cascade;
create table costing.staff_costing_classification(
  staff_id bigint primary key, costing_class text not null, allocation_pool text not null,
  effective_from date not null, allocation_weight numeric not null, remarks text not null, updated_n int not null default 0);

-- SYNTHETIC "pre-fix" internal writer: SECURITY DEFINER, VOLATILE, fixed search_path, no permission guard,
-- DECLARE section, validation before writes, UPDATE then INSERT (shape only).
create or replace function costing.rpc_set_staff_costing_classification(
  p_staff_id bigint, p_costing_class text, p_allocation_pool text, p_effective_from date,
  p_allocation_weight numeric, p_remarks text) returns jsonb
language plpgsql security definer set search_path = costing, public, pg_temp as $fn$
declare
  v_costing_class text := upper(nullif(trim(p_costing_class), ''));
  v_allocation_pool text := upper(nullif(trim(p_allocation_pool), ''));
  v_remarks text := nullif(trim(p_remarks), '');
  v_updated int;
begin
  if p_staff_id is null then raise exception 'staff id required'; end if;
  if v_costing_class is null then raise exception 'costing class required'; end if;
  update costing.staff_costing_classification
     set costing_class = v_costing_class, allocation_pool = v_allocation_pool, effective_from = p_effective_from,
         allocation_weight = p_allocation_weight, remarks = v_remarks, updated_n = updated_n + 1
   where staff_id = p_staff_id;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    insert into costing.staff_costing_classification(staff_id, costing_class, allocation_pool, effective_from, allocation_weight, remarks)
    values (p_staff_id, v_costing_class, v_allocation_pool, p_effective_from, p_allocation_weight, v_remarks);
  end if;
  return jsonb_build_object('staff_id', p_staff_id, 'ok', true);
end
$fn$;

-- Public wrapper: SQL language, SECURITY DEFINER, delegates (shape recorded in issue #234).
create or replace function public.rpc_set_staff_costing_classification(
  p_staff_id bigint, p_costing_class text, p_allocation_pool text, p_effective_from date,
  p_allocation_weight numeric, p_remarks text) returns jsonb
language sql security definer set search_path = public, costing, pg_temp as $$
  select costing.rpc_set_staff_costing_classification($1, $2, $3, $4, $5, $6)
$$;

-- ACLs as recorded: wrapper executable by authenticated; internal NOT executable by authenticated/anon.
revoke all on function public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text) from public, anon;
grant execute on function public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text) to authenticated;
revoke all on function costing.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text) from public, anon, authenticated;
grant usage on schema costing to authenticated;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

-- Synthetic identities (random fixed uuids; no real accounts)
truncate public.user_permissions_canonical;
insert into public.user_permissions_canonical values
 ('00000000-0000-0000-0000-0000000000c1', 'module:cost-build-manager',      true,  true),   -- CBM view+edit  (must be ALLOWED)
 ('00000000-0000-0000-0000-0000000000b1', 'module:cost-build-manager',      true,  false),  -- ID-V / CBM view-only
 ('00000000-0000-0000-0000-0000000000b1', 'module:costing-control-center',  true,  false),
 ('00000000-0000-0000-0000-0000000000d1', 'module:cost-build-manager',      false, true),   -- ID-X edit without view
 ('00000000-0000-0000-0000-0000000000e1', 'module:costing-sheet-review',    true,  false),  -- ID-O (CSR-only; target name is a placeholder)
 ('00000000-0000-0000-0000-0000000000f1', 'module:costing-control-center',  true,  true);   -- edit on ANOTHER module only
-- ID-N = '...0a1' has no rows at all.
