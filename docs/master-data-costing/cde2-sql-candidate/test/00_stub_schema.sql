-- ISOLATED TEST STUB. Mirrors live object/column NAMES taken from the 5/6 Nov audits and repo migrations; NOT the live DDL.
-- Everything here is created only in a throw-away PostgreSQL database. Money columns and money-bearing notes are present ON PURPOSE so a leak would show.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
-- Supabase-style default privileges: every function the owner creates in public is auto-granted to anon, authenticated and service_role.
-- This makes the candidate's REVOKEs meaningful (without it anon never had EXECUTE and the anon test proved nothing).
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;
create schema auth;  grant usage on schema auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
create schema costing;
grant usage on schema costing to authenticated;   -- schema usage only; table rights below mirror the live catalogue (#204 section 4)

create table public.user_permissions_canonical (user_id uuid, target text, can_view boolean not null default false, can_edit boolean not null default false);
-- Live semantics per #204: SECURITY DEFINER; auth.uid() not null; matching canonical row with can_view; can_edit only if p_need_edit.
create function public.require_permission(p_target text, p_need_edit boolean default false) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.user_permissions_canonical c where c.user_id = auth.uid() and c.target = p_target and c.can_view and (not p_need_edit or c.can_edit)) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
end $$;

create table costing.costing_refresh_run (id bigint primary key, period_start date not null, valuation_date date, overall_status text not null,
  valuation_context_source text, source_trigger text, requested_scope text, requested_at timestamptz, started_at timestamptz, finished_at timestamptz, current_stage_code text);
create table costing.cost_periods (period_start date primary key, status text not null, valuation_date date, valuation_date_status text);
-- Columns as in migration 20261015165757 (AU-2); the fingerprint FK is dropped.
create table costing.costing_run_designation (id bigint generated always as identity primary key, refresh_run_id bigint not null references costing.costing_refresh_run(id),
  period_start date not null, designation text not null check (designation in ('REFERENCE','APPROVED','REVOKED')), designated_by text not null, designated_by_uid uuid,
  designated_at timestamptz not null default now(), reason text not null check (length(btrim(reason)) >= 10), fingerprint_id bigint);
-- The governed views are NOT stubbed: scripts/cde2-sql-candidate/real-ddl.mjs extracts the REAL definitions of costing.v_costing_run_effective_designation (AU-2),
-- costing.v_current_successful_costing_refresh_run (AU-2) and costing.v_costing_period_run_status (W1, md5-pinned by W2) from supabase/migrations and loads them here.
-- Five snapshot sources. Column names per the 5 Nov live audit; money/free-text columns added deliberately.
create table costing.sku_prime_cost_snapshot (period_start date not null, valuation_date date not null, refresh_run_id bigint not null, sku_id bigint not null,
  material_costing_status text, internal_material_conversion_status text, refreshed_at timestamptz, material_cost_per_sku numeric, prime_cost_per_sku numeric);
create table costing.sku_direct_labour_allocation_snapshot (period_start date not null, valuation_date date not null, refresh_run_id bigint not null, sku_id bigint not null,
  direct_labour_allocation_status text, allocation_reason_code text, allocation_basis_status text, allocation_resolution_status text, allocation_resolution_note text,
  direct_labour_component_model_code text, refreshed_at timestamptz, direct_labour_cost numeric);
create table costing.sku_internal_material_conversion_snapshot (period_start date not null, valuation_date date not null, refresh_run_id bigint not null, sku_id bigint not null,
  conversion_status text, conversion_cost numeric);
create table costing.sku_costing_control_status_snapshot (period_start date not null, valuation_date date not null, refresh_run_id bigint not null, sku_id bigint not null,
  first_control_status text, control_severity text, control_note text, material_costing_status text, snapshot_refreshed_at timestamptz, material_cost_per_sku numeric);
create table costing.sku_regional_marketing_expense_allocation_snapshot (period_start date not null, valuation_date date not null, refresh_run_id bigint not null, sku_id bigint not null,
  region_code text not null, regional_basis_source text, regional_basis_status text, marketing_expense_allocation_status text, regional_basis_note text, refreshed_at timestamptz, marketing_sales_value numeric);
-- Live catalogue (#204 s4): authenticated can SELECT direct-labour and control (RLS on); no other snapshot. The candidate must not change this.
grant select on costing.sku_direct_labour_allocation_snapshot, costing.sku_costing_control_status_snapshot to authenticated;
