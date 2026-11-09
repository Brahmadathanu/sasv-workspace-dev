-- WP05-W506-CONF-01 test scaffold: SYNTHETIC dependencies only (disposable cluster; run via run_view_gate_test.sh).
-- public.app_has_permission and auth.uid are TEST DOUBLES; the three views are created from the repository's TB2 migration text by the runner.
\set ON_ERROR_STOP on
set client_min_messages = warning;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $$;
create schema if not exists auth; create schema if not exists costing; create schema if not exists hr;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.user_permissions_canonical(user_id uuid, target text, can_view boolean, can_edit boolean);
-- test double of public.app_has_permission(target, action): canonical row for auth.uid(); 'view' needs can_view, 'edit' needs can_edit
create function public.app_has_permission(p_target text, p_action text) returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.user_permissions_canonical p where p.user_id = auth.uid() and p.target = p_target
    and case lower(p_action) when 'view' then p.can_view is true when 'edit' then p.can_edit is true else false end) $$;
create function public.fn_costing_view_allowed() returns boolean language sql stable security invoker set search_path = public, pg_temp as $f$
  select current_user = any (array['postgres','service_role']::name[])
      or public.app_has_permission('module:costing-control-center','view')
      or public.app_has_permission('module:cost-build-manager','view')
      or public.app_has_permission('module:cost-sheet-review','view')
      or public.app_has_permission('module:material-cost-manager','view')
$f$;
revoke all on function public.fn_costing_view_allowed() from public, anon;
grant execute on function public.fn_costing_view_allowed() to authenticated, service_role;
create table hr.staff(id bigint primary key, employee_code text not null, designation text, is_active boolean default true, full_name text);
create table hr.staff_compensation_monthly(staff_id bigint references hr.staff(id), period_start date, basic_salary numeric, allowance_amount numeric, employer_contribution numeric, other_salary_cost numeric, total_salary_cost numeric, source_note text, is_active boolean default true);
create table costing.staff_costing_classification(id bigserial primary key, staff_id bigint references hr.staff(id), costing_class text, allocation_pool text, effective_from date, effective_to date, allocation_weight numeric default 1, remarks text, is_active boolean default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table costing.staff_pool_monthly_src(period_start date, allocation_pool text, costing_class text, staff_count int, pool_amount numeric, staff_details jsonb);
create view costing.v_staff_cost_pool_monthly as select * from costing.staff_pool_monthly_src;
create view public.v_costing_staff_costing_class_options as select * from (values ('MANUFACTURING'::text,'Manufacturing'::text,'DIRECT_LABOUR'::text), ('PACKING','Packing','PACKING_LABOUR')) v(costing_class, costing_class_label, default_allocation_pool);
-- synthetic rows only
insert into hr.staff values (1,'SYN-001','Role A',true,'Synthetic One'),(2,'SYN-002','Role B',true,'Synthetic Two'),(3,'SYN-003','Role C',true,'Synthetic Three');
insert into hr.staff_compensation_monthly values (1,date '2026-10-01',1000,100,50,10,1160,'syn',true),(2,date '2026-10-01',2000,200,100,20,2320,'syn',true);
insert into costing.staff_costing_classification(staff_id,costing_class,allocation_pool,effective_from) values (1,'MANUFACTURING','DIRECT_LABOUR',date '2026-01-01');
insert into costing.staff_pool_monthly_src values (date '2026-10-01','DIRECT_LABOUR','MANUFACTURING',1,1160,'[{"employee_code":"SYN-001","amount":1160}]'::jsonb);
