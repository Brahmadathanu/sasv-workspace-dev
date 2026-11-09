-- WP05-W506-SEC-FIX-02 (Close writer) LIVE-EQUIVALENT scaffold: SYNTHETIC dependencies only, created BEFORE the exact live function
-- snapshot is installed. Disposable local cluster only (run via run_live_equivalent.sh, which enforces the interlocks).
-- Nothing here is a production definition: tables/views are minimal stand-ins with the column names/types the live
-- function body and its RETURNS TABLE contract reference; require_permission/auth.uid are test doubles.
\set ON_ERROR_STOP on
set client_min_messages = warning;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth; create schema if not exists costing; create schema if not exists hr;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.user_permissions_canonical(user_id uuid, target text, can_view boolean, can_edit boolean);
create function public.require_permission(p_target text, p_edit boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_permissions_canonical p
                 where p.user_id = u and p.target = p_target and p.can_view is true and (not p_edit or p.can_edit is true)) then
    raise exception 'permission denied for %', p_target using errcode = '42501';
  end if;
end $$;
-- synthetic dependencies referenced by the live body
create table hr.staff(id bigint primary key, employee_code text not null, designation text);
create table costing.staff_costing_classification(
  id bigserial primary key, staff_id bigint not null references hr.staff(id), costing_class text not null, allocation_pool text not null,
  effective_from date not null, effective_to date, allocation_weight numeric not null default 1, remarks text,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create view public.v_costing_staff_classification_register as
  select s.id as staff_id, s.employee_code, s.designation, c.id as classification_id, c.costing_class, c.allocation_pool,
         c.effective_from, c.effective_to, c.allocation_weight,
         (case when c.id is null then 'UNCLASSIFIED' else 'CLASSIFIED' end)::text as classification_status,
         c.remarks, c.updated_at as classification_updated_at
  from hr.staff s left join costing.staff_costing_classification c on c.staff_id = s.id;
insert into hr.staff values (1,'SYN-001','Synthetic role A'), (2,'SYN-002','Synthetic role B');   -- synthetic rows only
-- synthetic classification rows: id 1 open (effective_from 2026-01-01), id 2 open (2026-06-01), id 3 already closed
insert into costing.staff_costing_classification(id,staff_id,costing_class,allocation_pool,effective_from,effective_to,allocation_weight,remarks)
 values (1,1,'MANUFACTURING','DIRECT_LABOUR',date '2026-01-01',null,1,'synthetic original remarks'),
                               (2,2,'PACKING','PACKING_LABOUR',date '2026-06-01',null,1,'synthetic'),
                               (3,2,'ADMIN','ADMIN_OVERHEAD',date '2025-01-01',date '2025-12-31',1,'synthetic closed');
select setval(pg_get_serial_sequence('costing.staff_costing_classification','id'), 3);
truncate public.user_permissions_canonical;
insert into public.user_permissions_canonical values
 ('00000000-0000-0000-0000-0000000000c1', 'module:cost-build-manager',      true,  true),   -- CBM view+edit (allowed)
 ('00000000-0000-0000-0000-0000000000b1', 'module:cost-build-manager',      true,  false),  -- view-only
 ('00000000-0000-0000-0000-0000000000d1', 'module:cost-build-manager',      false, true),   -- edit without view
 ('00000000-0000-0000-0000-0000000000e1', 'module:costing-sheet-review',    true,  false),  -- other module only (placeholder target)
 ('00000000-0000-0000-0000-0000000000f1', 'module:costing-control-center',  true,  true);   -- edit on another module
-- ID-N = '...0a1': no rows
grant usage on schema costing, hr, auth to authenticated;
grant execute on function auth.uid() to authenticated;
