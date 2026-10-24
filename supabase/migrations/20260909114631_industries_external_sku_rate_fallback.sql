-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table if not exists public.industries_sku_rate_fallback (
  sku_id bigint primary key references public.product_skus(id),
  rate_per_sku numeric not null check (rate_per_sku >= 0),
  rate_basis text not null,
  source_reference text not null,
  source_item_name text not null,
  source_pack_size numeric not null,
  source_uom text not null,
  created_at timestamptz not null default now()
);

alter table public.industries_sku_rate_fallback enable row level security;
revoke all on table public.industries_sku_rate_fallback from anon, authenticated;