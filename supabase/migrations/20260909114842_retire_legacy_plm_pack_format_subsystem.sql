-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_header_count bigint;
  v_line_count bigint;
begin
  select count(*) into v_header_count from public.plm_pack_format;
  select count(*) into v_line_count from public.plm_pack_format_line;

  if v_header_count <> 0 or v_line_count <> 0 then
    raise exception 'ABORT: legacy PLM pack-format tables are not empty (header=%, line=%)', v_header_count, v_line_count;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='plm_sku_pack_map' and column_name='pack_format_id'
  ) then
    raise exception 'ABORT: plm_sku_pack_map.pack_format_id exists; legacy architecture may still be active';
  end if;
end $$;

-- Retire dormant triggers first.
drop trigger trg_plm_pack_format_aiud on public.plm_pack_format;
drop trigger trg_plm_pack_header_aiud on public.plm_pack_format;
drop trigger trg_plm_pack_line_aiud on public.plm_pack_format_line;

-- Retire their trigger functions.
drop function public.tg_plm_pack_format_rebuild();
drop function public.tg_plm_pack_header_rebuild();
drop function public.tg_plm_pack_line_rebuild();

-- Retire stale helpers that reference the removed pack_format_id mapping model.
drop function public.fn_plm_rebuild_for_pack_format(bigint);
drop function public.fn_plm_rebuild_skus_by_pack_format(bigint);

-- Drop empty child then parent table. No CASCADE.
drop table public.plm_pack_format_line;
drop table public.plm_pack_format;