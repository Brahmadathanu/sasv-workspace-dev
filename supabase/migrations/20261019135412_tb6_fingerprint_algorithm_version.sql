-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- PREPARED (not applied). CI-009: fingerprint captures do not record which algorithm or table set produced them
-- (legacy whole-row captures for runs 119/121/122/124-128 vs W5 fixed-column re-baselines 12/13).
-- Change: two nullable columns on costing.costing_run_fingerprint (not itself fingerprint-scoped), with defaults set
-- AFTER the add so the 12 existing rows stay NULL and no inserter changes; a view infers the method for all rows.
-- fn_compute/verify_run_fingerprint are not changed, so verification results are identical.
do $g$
begin
  if to_regprocedure('costing.fn_costing_run_scoped_tables()') is null then raise exception 'TB6_GUARD: fn_costing_run_scoped_tables missing'; end if;
  if exists (select 1 from information_schema.columns where table_schema='costing' and table_name='costing_run_fingerprint'
             and column_name in ('algorithm_version','scoped_table_set_md5')) then raise exception 'TB6_GUARD: columns already exist'; end if;
  if (select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns
       where table_schema='costing' and table_name='costing_run_fingerprint') <> 'id,refresh_run_id,purpose,captured_by,captured_at,fingerprint'
  then raise exception 'TB6_GUARD: costing_run_fingerprint shape differs from baseline'; end if;
end $g$;

create function costing.fn_costing_run_scoped_set_md5() returns text
language sql stable security invoker set search_path = pg_catalog, pg_temp as $f$
  select md5(coalesce(string_agg(t::text, ',' order by t::text), '')) from costing.fn_costing_run_scoped_tables() t
$f$;
revoke all on function costing.fn_costing_run_scoped_set_md5() from public, anon;

alter table costing.costing_run_fingerprint add column algorithm_version text, add column scoped_table_set_md5 text;
alter table costing.costing_run_fingerprint alter column algorithm_version set default 'W5_FIXED_COLUMNS_V1',
                                            alter column scoped_table_set_md5 set default costing.fn_costing_run_scoped_set_md5();
comment on column costing.costing_run_fingerprint.algorithm_version is 'CI-009: NULL = captured before versioning (see v_run_fingerprint_method)';

create view costing.v_run_fingerprint_method with (security_invoker = true) as
select f.id, f.refresh_run_id, f.purpose, f.captured_at, f.algorithm_version, f.scoped_table_set_md5,
       case when f.algorithm_version is not null then f.algorithm_version
            when exists (select 1 from jsonb_each(f.fingerprint) e where jsonb_typeof(e.value)='object' and e.value ? 'cols') then 'W5_FIXED_COLUMNS_V1 (inferred)'
            else 'LEGACY_WHOLE_ROW (inferred)' end as method,
       (select count(*) from jsonb_object_keys(f.fingerprint)) as scoped_table_count
  from costing.costing_run_fingerprint f;
revoke all on costing.v_run_fingerprint_method from public, anon;
grant select on costing.v_run_fingerprint_method to authenticated, service_role;

do $p$
begin
  if exists (select 1 from costing.costing_run_fingerprint where algorithm_version is not null and captured_at < now() - interval '1 minute')
  then raise exception 'TB6_POST: existing rows were back-filled'; end if;
end $p$;
