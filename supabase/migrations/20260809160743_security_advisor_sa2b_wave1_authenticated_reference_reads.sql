-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

alter table public.app_nav_sections enable row level security;
alter table public.product_group_kinds enable row level security;
alter table public.event_type_lkp enable row level security;
alter table public.activity_kinds enable row level security;

revoke all privileges on table public.app_nav_sections from anon, authenticated;
revoke all privileges on table public.product_group_kinds from anon, authenticated;
revoke all privileges on table public.event_type_lkp from anon, authenticated;
revoke all privileges on table public.activity_kinds from anon, authenticated;

grant select on table public.app_nav_sections to authenticated;
grant select on table public.product_group_kinds to authenticated;
grant select on table public.event_type_lkp to authenticated;
grant select on table public.activity_kinds to authenticated;

create policy app_nav_sections_authenticated_read
on public.app_nav_sections
for select
to authenticated
using ((select auth.uid()) is not null);

create policy product_group_kinds_authenticated_read
on public.product_group_kinds
for select
to authenticated
using ((select auth.uid()) is not null);

create policy event_type_lkp_authenticated_read
on public.event_type_lkp
for select
to authenticated
using ((select auth.uid()) is not null);

create policy activity_kinds_authenticated_read
on public.activity_kinds
for select
to authenticated
using ((select auth.uid()) is not null);

commit;