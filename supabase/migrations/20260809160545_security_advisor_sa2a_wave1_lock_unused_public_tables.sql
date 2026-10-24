-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

alter table public.modules enable row level security;
alter table public.import_log enable row level security;
alter table public.product_llt_upload enable row level security;
alter table public.product_season_override enable row level security;
alter table public.sop_events enable row level security;
alter table public.sop_review_reminders enable row level security;
alter table public.plm_pack_format_line enable row level security;

revoke all privileges on table public.modules from anon, authenticated;
revoke all privileges on table public.import_log from anon, authenticated;
revoke all privileges on table public.product_llt_upload from anon, authenticated;
revoke all privileges on table public.product_season_override from anon, authenticated;
revoke all privileges on table public.sop_events from anon, authenticated;
revoke all privileges on table public.sop_review_reminders from anon, authenticated;
revoke all privileges on table public.plm_pack_format_line from anon, authenticated;

commit;