-- WP10 REVIEW-ONLY ROLLBACK FOR review-only-subgroup-auth-dml-revoke.sql.
-- WARNING: restoring broad authenticated writes recreates the identified risk.
-- DO NOT APPLY WITHOUT SEPARATE OWNER APPROVAL; verify baseline and replacement controls.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$
begin
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='sub_groups' and c.relkind='r') then
  raise exception 'WP10 rollback preflight: public.sub_groups missing';
 end if;
 if has_table_privilege('authenticated','public.sub_groups','INSERT') or has_table_privilege('authenticated','public.sub_groups','UPDATE') or has_table_privilege('authenticated','public.sub_groups','DELETE') then
  raise exception 'WP10 rollback preflight: subgroup DML privileges not in expected revoked state';
 end if;
 if not has_table_privilege('authenticated','public.sub_groups','SELECT') then
  raise exception 'WP10 rollback preflight: subgroup SELECT baseline changed';
 end if;
end $preflight$;
grant insert, update, delete on table public.sub_groups to authenticated;
commit;
