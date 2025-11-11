-- Drop-in replacement for calc_fill_plan with qualified columns and WHERE TRUE on unconditional UPDATEs
create or replace function public.calc_fill_plan(
  p_product_id        bigint,
  p_bulk_base_qty     numeric,
  p_allow_overshoot   boolean,
  p_debug             boolean default false
)
returns table(
  sku_id            bigint,
  region_code       text,
  units_to_fill     int,
  used_base_qty     numeric,
  mos               numeric,      -- global target MOS
  curr_mos          numeric,      -- per-row MOS AFTER fill
  gap_mos           numeric,      -- remaining gap to target AFTER fill (0 if at/above)
  fu_units_pm       numeric,      -- forecast units / month
  su_units          numeric,      -- starting stock units
  um_base           numeric,      -- base units per pack
  benefit_per_base  numeric       -- last computed benefit per base (for debug)
)
language plpgsql
as $$
declare
  v_tot_forecast_base numeric := 0;
  v_tot_stock_base    numeric := 0;
  v_target_mos        numeric := 0;
  v_smallest_um       numeric := null;
  v_gap               numeric := 0;
  v_row               record;
  v_bulk_left         numeric := 0;
  -- batch allocation helpers
  v_fu                numeric := 0;
  v_gap_row           numeric := 0;
  v_k_target          int := 0;
  v_k_fit             int := 0;
  v_k_add             int := 0;
  v_row_fill          int := 0;
begin
  if coalesce(p_bulk_base_qty,0) <= 0 then
    return;
  end if;

  -- 1) Snapshot (region, sku) — aggregate forecast/stock into single rows
  drop table if exists _plan;
  create temporary table _plan on commit drop as
  with base as (
    select
      fi.sku_id,
      fi.region_code,
      min(fi.net_per_unit_base)::numeric as um,
      -- region roll-up rows (godown_code is NULL)
      sum(coalesce(fi.forecast_units_pm,0)) filter (where fi.godown_code is null)::numeric as fu_region,
      sum(coalesce(fi.stock_units,0))        filter (where fi.godown_code is null)::numeric as su_region,
      -- depot rows (HO_IK, KKD, HO_OK, etc.)
      sum(coalesce(fi.forecast_units_pm,0)) filter (where fi.godown_code is not null)::numeric as fu_depots,
      sum(coalesce(fi.stock_units,0))        filter (where fi.godown_code is not null)::numeric as su_depots
    from public.v_fill_inputs fi
    where fi.product_id = p_product_id
    group by fi.sku_id, fi.region_code
  ),
  region_rows as (
    select
      b.sku_id,
      b.region_code,
      b.um,
      coalesce(b.fu_region, b.fu_depots, 0)::numeric as fu,  -- prefer region roll-up if present, else sum of depots
      coalesce(b.su_region, b.su_depots, 0)::numeric as su   -- prefer region roll-up if present, else sum of depots
    from base b
  )
  select *
  from region_rows
  where (coalesce(fu,0) > 0 or coalesce(su,0) > 0);

  -- 2) Totals & smallest pack
  select sum(p.fu*p.um), sum(p.su*p.um), min(p.um)
    into v_tot_forecast_base, v_tot_stock_base, v_smallest_um
  from _plan p;

  if coalesce(v_tot_forecast_base,0) = 0 then
    return;
  end if;

  -- 3) Global MOS target from available bulk
  v_target_mos := (p_bulk_base_qty + v_tot_stock_base) / v_tot_forecast_base;

  -- 4) Working columns
  alter table _plan
    add column ideal_cont        numeric,
    add column fill_rd           int default 0,
    add column curr_mos          numeric,
    add column gap_mos           numeric,
    add column region_curr_mos   numeric,
    add column region_gap_mos    numeric,
    add column benefit_per_base  numeric,
    add column loss_per_base     numeric;

  -- 5) Continuous ideal (for reference only) and zero baseline for fill
  -- Professional tweak: start from zero and add greedily; do NOT pre-fill everyone to floor(target)
  -- This avoids over-allocating low-forecast SKUs and then trimming from high-forecast SKUs.
  update _plan p
     set ideal_cont = greatest(v_target_mos*p.fu - p.su, 0),
         fill_rd    = 0
   where true;

  -- 6) Bulk bookkeeping after floor
  v_bulk_left := p_bulk_base_qty
                 - coalesce((select sum(p2.fill_rd*p2.um) from _plan p2), 0);

  -- 7) Current MOS & gap (from stock only initially)
  update _plan p
     set curr_mos = (p.su + p.fill_rd)::numeric / nullif(p.fu,0),
    gap_mos  = greatest(v_target_mos - ((p.su + p.fill_rd)::numeric / nullif(p.fu,0)), 0)
   where true;

  -- region MOS (soft cap factor)
  drop table if exists _reg;
  create temporary table _reg on commit drop as
    select p.region_code as region_code,
           sum(p.su + p.fill_rd) as rsu,
           sum(p.fu)             as rfu
    from _plan p
    group by p.region_code;
  update _plan p
     set region_curr_mos = r.rsu::numeric / nullif(r.rfu,0),
         region_gap_mos  = greatest(v_target_mos - (r.rsu::numeric / nullif(r.rfu,0)), 0)
  from _reg r
  where p.region_code = r.region_code;

  -- 8) TOP-UP: add packs while bulk remains.
  -- Pick the pack with highest (MOS gain per base unit).
  if v_bulk_left >= v_smallest_um then
    loop
      -- recompute benefit per base for all rows
      update _plan p
         set benefit_per_base =
           case
             when p.fu <= 0 then 0
             when v_bulk_left < p.um then -1e9
             else ((least(p.gap_mos, p.um / nullif(p.fu,0))) / nullif(p.um,0))
                  * greatest(p.region_gap_mos, 0)  -- soft cap scaling by how far region is below target
           end
       where true;

      -- choose best candidate (ties: higher velocity, then smaller pack)
      select p.sku_id, p.region_code, p.um
        into v_row
      from _plan p
      order by p.benefit_per_base desc,
               p.fu desc,
               p.um asc,
               p.region_code asc, p.sku_id asc
      limit 1;

      exit when v_row is null;

      -- if best candidate has non-positive benefit, stop
      perform 1
      from _plan px
      where px.sku_id = v_row.sku_id
        and px.region_code = v_row.region_code
        and px.benefit_per_base > 0;

      if not found then
        exit;
      end if;

      -- batch add packs up to target or bulk-fit
      select p.fu, p.gap_mos, p.fill_rd
        into v_fu, v_gap_row, v_row_fill
      from _plan p
      where p.sku_id = v_row.sku_id and p.region_code = v_row.region_code;

  -- packs to reach the target for this row (ceil(gap_mos * fu))
      v_k_target := greatest(1, ceil(coalesce(v_gap_row,0) * coalesce(v_fu,0))::int);
      -- packs that fit in remaining bulk
      v_k_fit := greatest(0, floor(v_bulk_left / v_row.um)::int);
      -- decide how many to add now (at least 1 if any fits)
      v_k_add := least(v_k_target, v_k_fit);
      if v_k_add <= 0 then
        exit; -- cannot fit any pack
      end if;

      update _plan p
         set fill_rd = p.fill_rd + v_k_add
       where p.sku_id = v_row.sku_id
         and p.region_code = v_row.region_code;

      v_bulk_left := v_bulk_left - (v_k_add * v_row.um);

      exit when v_bulk_left < v_smallest_um;

      -- refresh MOS & gap for next iteration
      update _plan p
         set curr_mos = (p.su + p.fill_rd)::numeric / nullif(p.fu,0),
      gap_mos  = greatest(v_target_mos - ((p.su + p.fill_rd)::numeric / nullif(p.fu,0)), 0)
       where true;

      -- refresh region MOS soft-cap factors after each pack addition
      drop table if exists _reg;
      create temporary table _reg on commit drop as
   select p.region_code as region_code,
     sum(p.su + p.fill_rd) as rsu,
     sum(p.fu)             as rfu
   from _plan p
   group by p.region_code;
      update _plan p
         set region_curr_mos = r.rsu::numeric / nullif(r.rfu,0),
             region_gap_mos  = greatest(v_target_mos - (r.rsu::numeric / nullif(r.rfu,0)), 0)
      from _reg r
      where p.region_code = r.region_code;
    end loop;
  end if;

  -- 9) If overshoot not allowed and we exceeded bulk, trim least-harm packs.
  v_gap := p_bulk_base_qty - (select sum(p.fill_rd*p.um) from _plan p);

  if not p_allow_overshoot and v_gap < 0 then
    -- current MOS (safety)
    update _plan p
       set curr_mos = (p.su + p.fill_rd)::numeric / nullif(p.fu,0)
     where true;

    while v_gap < 0 loop
      -- loss if we REMOVE one pack: MOS drop per base = (um/fu)/um = 1/fu
      update _plan p
         set loss_per_base =
           case when p.fu <= 0 or p.fill_rd <= 0 then 1e9
                else 1 / nullif(p.fu,0)
           end
       where true;

      -- remove the pack whose removal hurts the least per base (ties: smaller pack)
      select p.sku_id, p.region_code, p.um
        into v_row
      from _plan p
      where p.fill_rd > 0
      order by p.loss_per_base asc,
               p.um asc,
               p.region_code asc, p.sku_id asc
      limit 1;

      exit when v_row is null;

      -- remove in batch up to needed packs or available fill
      select p.fill_rd
        into v_row_fill
      from _plan p
      where p.sku_id = v_row.sku_id and p.region_code = v_row.region_code;

      -- packs to remove to fix overshoot for this row choice
      v_k_fit := ceil( (-v_gap) / v_row.um )::int; -- how many packs of this size to offset gap
      v_k_add := greatest(1, least(v_k_fit, greatest(0, v_row_fill)));

      update _plan p
         set fill_rd = p.fill_rd - v_k_add
       where p.sku_id = v_row.sku_id
         and p.region_code = v_row.region_code;

      v_gap := v_gap + (v_k_add * v_row.um);
    end loop;
  end if;

  -- 10) Return
  -- final refresh of curr_mos / gap for visibility
  update _plan p
   set curr_mos = (p.su + p.fill_rd)::numeric / nullif(p.fu,0),
     gap_mos  = greatest(v_target_mos - ((p.su + p.fill_rd)::numeric / nullif(p.fu,0)), 0)
   where true;
  drop table if exists _reg;
  create temporary table _reg on commit drop as
    select p.region_code as region_code,
           sum(p.su + p.fill_rd) as rsu,
           sum(p.fu)             as rfu
    from _plan p
    group by p.region_code;
  update _plan p
     set region_curr_mos = r.rsu::numeric / nullif(r.rfu,0),
         region_gap_mos  = greatest(v_target_mos - (r.rsu::numeric / nullif(r.rfu,0)), 0)
  from _reg r
  where p.region_code = r.region_code;

  return query
  select
    p.sku_id::bigint                   as sku_id,
    p.region_code::text                as region_code,
    p.fill_rd::int                     as units_to_fill,
    (p.fill_rd * p.um)::numeric        as used_base_qty,
    v_target_mos::numeric              as mos,
    p.curr_mos::numeric                as curr_mos,
    p.gap_mos::numeric                 as gap_mos,
    p.fu::numeric                      as fu_units_pm,
    p.su::numeric                      as su_units,
    p.um::numeric                      as um_base,
    case when p_debug then p.benefit_per_base else null end as benefit_per_base
  from _plan p
  -- when NOT in debug mode, hide zero-fill rows to keep output lean
  where (p_debug or p.fill_rd > 0)
  order by p.region_code, p.sku_id;
end;
$$;
