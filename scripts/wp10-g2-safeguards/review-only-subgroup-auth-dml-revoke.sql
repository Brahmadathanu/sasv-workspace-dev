-- WP10 REVIEW-ONLY SECURITY HARDENING CANDIDATE; NOT AN APPROVED MIGRATION.
-- Does NOT alter SELECT grants, RLS, data, or route functions.
-- WARNING: authenticated clients that currently INSERT/UPDATE/DELETE sub_groups directly
-- will lose that ability. Inventory client writes and secure replacement workflow first.
-- DO NOT APPLY TO SUPABASE WITHOUT OWNER APPROVAL.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $preflight$
begin
 if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='sub_groups' and c.relkind='r') then
  raise exception 'WP10 preflight: public.sub_groups not found';
 end if;
 if not has_table_privilege('authenticated','public.sub_groups','INSERT')
    or not has_table_privilege('authenticated','public.sub_groups','UPDATE')
    or not has_table_privilege('authenticated','public.sub_groups','DELETE') then
  raise exception 'WP10 preflight: authenticated subgroup write grant baseline changed; re-review';
 end if;
end $preflight$;
revoke insert, update, delete on table public.sub_groups from authenticated;
do $verify$
begin
 if has_table_privilege('authenticated','public.sub_groups','INSERT')
 or has_table_privilege('authenticated','public.sub_groups','UPDATE')
 or has_table_privilege('authenticated','public.sub_groups','DELETE') then
  raise exception 'WP10 postcheck: authenticated still has subgroup write privilege (other grants or membership); rollback transaction';
 end if;
 if not has_table_privilege('authenticated','public.sub_groups','SELECT') then
  raise exception 'WP10 postcheck: authenticated SELECT lost; rollback transaction';
 end if;
end $verify$;
commit;
