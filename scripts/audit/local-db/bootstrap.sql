-- Local stand-ins for Supabase platform objects (NOT live DDL)
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin; end if;
end $$;
create schema if not exists extensions; create schema if not exists auth; create schema if not exists costing; create schema if not exists app_private;
create schema if not exists cron; create schema if not exists net; create schema if not exists vault; create schema if not exists supabase_migrations;
create extension if not exists pgcrypto schema extensions; create extension if not exists "uuid-ossp" schema extensions;
create extension if not exists btree_gist schema extensions; create extension if not exists citext schema extensions;
create extension if not exists pg_trgm schema extensions; create extension if not exists moddatetime schema extensions;
create table if not exists auth.users (id uuid primary key, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb, created_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true),''),current_user::text) $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create table if not exists cron.job (jobid bigserial primary key, jobname text, schedule text, command text, active boolean default true);
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
alter database costing_local set search_path = public, extensions;
alter database costing_local set timezone = 'UTC';
