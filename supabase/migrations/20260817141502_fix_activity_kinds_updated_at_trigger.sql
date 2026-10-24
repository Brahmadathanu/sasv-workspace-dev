-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.tg_touch_activity_kinds_updated_at()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','pg_temp'
as $function$
begin
  new.updated_at := now();
  return new;
end
$function$;

drop trigger if exists trg_activity_kinds_touch on public.activity_kinds;

create trigger trg_activity_kinds_touch
before update on public.activity_kinds
for each row
execute function public.tg_touch_activity_kinds_updated_at();