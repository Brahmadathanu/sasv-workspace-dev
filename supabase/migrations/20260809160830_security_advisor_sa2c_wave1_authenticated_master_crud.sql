-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

alter table public.categories enable row level security;
alter table public.sub_categories enable row level security;
alter table public.product_groups enable row level security;
alter table public.sub_groups enable row level security;
alter table public.sections enable row level security;
alter table public.subsections enable row level security;
alter table public.areas enable row level security;
alter table public.machine_types enable row level security;
alter table public.plant_machinery enable row level security;
alter table public.activities enable row level security;

revoke all privileges on table public.categories from anon, authenticated;
revoke all privileges on table public.sub_categories from anon, authenticated;
revoke all privileges on table public.product_groups from anon, authenticated;
revoke all privileges on table public.sub_groups from anon, authenticated;
revoke all privileges on table public.sections from anon, authenticated;
revoke all privileges on table public.subsections from anon, authenticated;
revoke all privileges on table public.areas from anon, authenticated;
revoke all privileges on table public.machine_types from anon, authenticated;
revoke all privileges on table public.plant_machinery from anon, authenticated;
revoke all privileges on table public.activities from anon, authenticated;

grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.sub_categories to authenticated;
grant select, insert, update, delete on table public.product_groups to authenticated;
grant select, insert, update, delete on table public.sub_groups to authenticated;
grant select, insert, update, delete on table public.sections to authenticated;
grant select, insert, update, delete on table public.subsections to authenticated;
grant select, insert, update, delete on table public.areas to authenticated;
grant select, insert, update, delete on table public.machine_types to authenticated;
grant select, insert, update, delete on table public.plant_machinery to authenticated;
grant select, insert, update, delete on table public.activities to authenticated;

create policy categories_authenticated_crud on public.categories for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy sub_categories_authenticated_crud on public.sub_categories for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy product_groups_authenticated_crud on public.product_groups for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy sub_groups_authenticated_crud on public.sub_groups for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy sections_authenticated_crud on public.sections for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy subsections_authenticated_crud on public.subsections for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy areas_authenticated_crud on public.areas for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy machine_types_authenticated_crud on public.machine_types for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy plant_machinery_authenticated_crud on public.plant_machinery for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy activities_authenticated_crud on public.activities for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);

commit;