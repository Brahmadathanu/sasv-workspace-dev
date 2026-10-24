-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table public.plm_sku_pack_map
  drop constraint if exists uq_plm_sku_pack_map_per_sku;

alter table public.sku_stock_snapshot
  drop constraint if exists sku_stock_snapshot_uniq;