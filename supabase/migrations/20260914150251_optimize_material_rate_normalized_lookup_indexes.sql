-- backfilled from live schema_migrations on 2026-10-24, CI-016
create index if not exists ix_tally_purchases_vreg_norm_item_date
on public.tally_purchases_vreg_snapshot (
  public.normalise_alias_key(tally_item_name),
  voucher_date desc
)
include (purchase_fact_id, avg_rate_value, canonical_qty_value, billed_amount_value, supplier_name)
where avg_rate_value is not null and avg_rate_value>0 and canonical_qty_value is not null and canonical_qty_value>0;

create index if not exists ix_tally_rm_stock_norm_item_date
on public.tally_rm_stock_snapshot (
  public.normalise_alias_key(tally_item_name),
  as_of_date desc
)
include (qty_value, rate_value)
where rate_value is not null and rate_value>0 and qty_value is not null and qty_value<>0;

create index if not exists ix_tally_plm_stock_norm_item_date
on public.tally_plm_stock_snapshot (
  public.normalise_alias_key(tally_item_name),
  as_of_date desc
)
include (qty_value, rate_value)
where rate_value is not null and rate_value>0 and qty_value is not null and qty_value<>0;

create index if not exists ix_tally_stock_by_name_norm_item_date
on public.tally_stock_by_name (
  public.normalise_alias_key(tally_item_name),
  as_of_date desc
)
include (qty_units, stock_rate, stock_value)
where stock_rate is not null and stock_rate>0 and qty_units is not null and qty_units<>0;