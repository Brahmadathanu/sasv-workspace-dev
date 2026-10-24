-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table public.industries_google_2022_23_stage (
  source_item_name text primary key,
  bridge_alias_text text not null,
  qty_apr numeric,
  qty_may numeric,
  qty_jun numeric,
  qty_jul numeric,
  qty_aug numeric,
  qty_sep numeric,
  qty_oct numeric,
  qty_nov numeric,
  qty_dec numeric,
  qty_jan numeric,
  qty_feb numeric,
  qty_mar numeric
);
alter table public.industries_google_2022_23_stage enable row level security;
revoke all on table public.industries_google_2022_23_stage from anon, authenticated;