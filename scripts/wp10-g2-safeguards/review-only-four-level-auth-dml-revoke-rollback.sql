-- REVIEW ONLY: restore only the authenticated privileges deliberately revoked in the phase-2 four-level migration.
-- Requires separate authorization, not an automatic follow-up.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$ declare t text;
begin
 foreach t in array array['categories','sub_categories','product_groups','sub_groups'] loop
  if not has_table_privilege('authenticated',format('public.%I',t),'SELECT')
    or has_table_privilege('authenticated',format('public.%I',t),'INSERT')
    or has_table_privilege('authenticated',format('public.%I',t),'UPDATE')
    or has_table_privilege('authenticated',format('public.%I',t),'DELETE')
  then raise exception 'Unexpected pre-rollback DML privilege state on %',t; end if;
 end loop;
end $preflight$;
grant insert,update,delete on table public.categories,public.sub_categories,public.product_groups,public.sub_groups to authenticated;
do $postflight$ declare t text;
begin
 foreach t in array array['categories','sub_categories','product_groups','sub_groups'] loop
  if not has_table_privilege('authenticated',format('public.%I',t),'SELECT')
    or not has_table_privilege('authenticated',format('public.%I',t),'INSERT')
    or not has_table_privilege('authenticated',format('public.%I',t),'UPDATE')
    or not has_table_privilege('authenticated',format('public.%I',t),'DELETE')
  then raise exception 'Rollback privilege restoration failed on %',t; end if;
 end loop;
end $postflight$;
commit;
