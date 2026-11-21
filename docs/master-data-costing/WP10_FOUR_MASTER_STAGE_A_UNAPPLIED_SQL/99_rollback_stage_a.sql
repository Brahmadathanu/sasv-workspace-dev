-- WP10 four-master STAGE A — 99 ROLLBACK. NOT APPLIED. Independent of 02 (reads only live catalog state; needs no receipt/table created by 02).
-- Restores the ORIGINAL identity-only FOR ALL policy on the four tables. THIS REOPENS THE KNOWN EXPOSURE: any signed-in identity can write the
-- four tables directly again. Treat as a security event: owner approval + risk record required. Use only for an emergency (e.g. an authorised Editor
-- is wrongly denied and cannot be fixed forward).
-- Refuses (changes nothing) when: the live policy set is not exactly the 16 Stage A policies on every table (i.e. amended/partial/already rolled back),
-- or when Stage B has been applied (authenticated no longer holds INSERT/UPDATE/DELETE) — rollback after Stage B is a separate incident decision, never automatic.
-- Does not touch GRANTs, data, functions or triggers. After running, re-run 01_preflight_readonly.sql: it must return RESULT PASS (original state).
begin;
set local lock_timeout = '2s';
set local statement_timeout = '20s';

do $$
declare t record; n int; k text;
begin
  for t in select * from (values ('categories'), ('sub_categories'), ('product_groups'), ('sub_groups')) v(tbl) loop
    select count(*) into n from pg_policy where polrelid = ('public.' || t.tbl)::regclass;
    if n <> 4 then raise exception 'WP10 Stage A rollback refused: public.% has % policies (expected exactly the 4 Stage A policies). Nothing changed.', t.tbl, n; end if;
    foreach k in array array['read','insert','update','delete'] loop
      if not exists (select 1 from pg_policy where polrelid = ('public.' || t.tbl)::regclass and polname = t.tbl || '_authenticated_' || k) then
        raise exception 'WP10 Stage A rollback refused: policy %_authenticated_% not found (already rolled back or amended). Nothing changed.', t.tbl, k;
      end if;
    end loop;
    if not (has_table_privilege('authenticated', ('public.' || t.tbl)::regclass, 'INSERT') and has_table_privilege('authenticated', ('public.' || t.tbl)::regclass, 'UPDATE')
        and has_table_privilege('authenticated', ('public.' || t.tbl)::regclass, 'DELETE')) then
      raise exception 'WP10 Stage A rollback refused: authenticated no longer holds direct DML on public.% (Stage B applied?). Rolling back policies is a separate security decision.', t.tbl;
    end if;
  end loop;
end $$;

drop policy categories_authenticated_read on public.categories;
drop policy categories_authenticated_insert on public.categories;
drop policy categories_authenticated_update on public.categories;
drop policy categories_authenticated_delete on public.categories;
create policy categories_authenticated_crud on public.categories for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

drop policy sub_categories_authenticated_read on public.sub_categories;
drop policy sub_categories_authenticated_insert on public.sub_categories;
drop policy sub_categories_authenticated_update on public.sub_categories;
drop policy sub_categories_authenticated_delete on public.sub_categories;
create policy sub_categories_authenticated_crud on public.sub_categories for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

drop policy product_groups_authenticated_read on public.product_groups;
drop policy product_groups_authenticated_insert on public.product_groups;
drop policy product_groups_authenticated_update on public.product_groups;
drop policy product_groups_authenticated_delete on public.product_groups;
create policy product_groups_authenticated_crud on public.product_groups for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

drop policy sub_groups_authenticated_read on public.sub_groups;
drop policy sub_groups_authenticated_insert on public.sub_groups;
drop policy sub_groups_authenticated_update on public.sub_groups;
drop policy sub_groups_authenticated_delete on public.sub_groups;
create policy sub_groups_authenticated_crud on public.sub_groups for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

commit;
