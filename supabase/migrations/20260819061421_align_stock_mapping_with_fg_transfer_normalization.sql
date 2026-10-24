-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

-- Canonicalize the one stale Karuthavattu alias row.
update public.sku_aliases
set alias_text = regexp_replace(btrim(alias_text), '\\s+', ' ', 'g')
where sku_id = 651
  and public.f_norm_key(alias_text) = 'karuthavattu pills 50 nos';

-- Stock mapping must use the same canonical normalizer as FG reconciliation.
create or replace view public.v_stock_to_ids
with (security_invoker = true)
as
select
  s.as_of_date,
  s.godown_label,
  s.tally_item_name,
  s.qty_units,
  ga.godown_id,
  sa.sku_id
from public.tally_stock_by_name s
left join public.godown_aliases ga
  on ga.alias_key = lower(btrim(s.godown_label))
left join public.sku_aliases sa
  on sa.alias_key = public.f_norm_key(s.tally_item_name);

create or replace view public.v_unmapped_stock_today
with (security_invoker = true)
as
with d as (
  select case
    when exists (
      select 1 from public.tally_stock_by_name where as_of_date = current_date
    ) then current_date
    else (select max(as_of_date) from public.tally_stock_by_name)
  end as as_of_date
)
select
  s.as_of_date,
  s.godown_label,
  s.tally_item_name,
  sum(s.qty_units) as qty_units,
  sum(s.stock_value) as stock_value,
  ga.godown_id is null as missing_godown_map,
  sa.sku_id is null as missing_sku_map
from public.tally_stock_by_name s
join d on d.as_of_date = s.as_of_date
left join public.godown_aliases ga
  on ga.alias_key = lower(btrim(s.godown_label))
left join public.sku_aliases sa
  on sa.alias_key = public.f_norm_key(s.tally_item_name)
where ga.godown_id is null or sa.sku_id is null
group by s.as_of_date, s.godown_label, s.tally_item_name, ga.godown_id, sa.sku_id
order by sum(s.stock_value) desc nulls last, sum(s.qty_units) desc nulls last;

-- Preserve current exposure explicitly.
revoke all on public.v_stock_to_ids from anon;
revoke all on public.v_unmapped_stock_today from anon;
grant select on public.v_stock_to_ids to authenticated;
grant select on public.v_unmapped_stock_today to authenticated;

commit;