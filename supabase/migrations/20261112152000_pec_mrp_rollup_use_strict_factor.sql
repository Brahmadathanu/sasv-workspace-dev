-- PEC G0: align future month rebuild rollup with strict UOM factor.
-- Does not execute/refresh MRP; definition only.
-- Source captured verbatim from verified live database 2026-11-12.
BEGIN;
CREATE OR REPLACE FUNCTION public.mrp_rm_plan_rebuild_month_active(p_month_start date, p_built_by text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(month_start date, mrp_run_id uuid, rows_inserted bigint)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
declare
  v_month_start date := date_trunc('month', p_month_start)::date;
  v_month_end   date := (v_month_start + interval '1 month - 1 day')::date;
  v_run_id uuid := gen_random_uuid();
  v_rows bigint := 0;
begin
  -- 0) HARD WIPE for that month (important)
  delete from public.mrp_rm_plan_detail d
  where d.month_start = v_month_start;

  delete from public.mrp_rm_plan_monthly m
  where m.horizon_start = v_month_start;

  delete from public.mrp_rm_plan_month_runs r
  where r.month_start = v_month_start;

  -- 1) Build detail for this month
  perform public.fn_run_mrp_rm_plan(v_run_id, v_month_start, v_month_end);

  select count(*) into v_rows
  from public.mrp_rm_plan_detail d
  where d.mrp_run_id = v_run_id;

  -- 2) Source-UOM-aware rollup. Preserve source UOM for incompatible
  -- default dimensions (e.g. internally produced SG capsules in Nos).
  -- For same-dimension UOMs use governed direct/reciprocal conversion.
  -- Fail closed if source dimensions mix for one item or factor is absent.
  IF EXISTS (
    SELECT 1 FROM public.mrp_rm_plan_detail t
    JOIN public.inv_uom src ON src.id=t.required_uom_id
    WHERE t.mrp_run_id=v_run_id
    GROUP BY t.stock_item_id
    HAVING count(distinct src.dimension_id)>1
  ) THEN
    RAISE EXCEPTION 'MRP rollup: mixed dimensions within the same stock item';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.mrp_rm_plan_detail t
    JOIN public.inv_stock_item si ON si.id=t.stock_item_id
    JOIN public.inv_uom src ON src.id=t.required_uom_id
    JOIN public.inv_uom dst ON dst.id=si.default_uom_id
    WHERE t.mrp_run_id=v_run_id
      AND src.id<>dst.id AND src.dimension_id=dst.dimension_id
      AND NOT EXISTS (
        SELECT 1 FROM public.inv_uom_conversion cv
        WHERE cv.from_uom_id=src.id AND cv.to_uom_id=dst.id AND cv.factor>0
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.inv_uom_conversion cv
        WHERE cv.from_uom_id=dst.id AND cv.to_uom_id=src.id AND cv.factor>0
      )
  ) THEN
    RAISE EXCEPTION 'MRP rollup: same-dimension conversion policy missing';
  END IF;

  INSERT INTO public.mrp_rm_plan_monthly (
    horizon_start,horizon_end,rm_stock_item_id,rm_uom_id,rm_uom_code,planned_total_rm_qty
  )
  WITH fact AS (
    SELECT t.stock_item_id,t.required_qty,
      src.id source_id, src.dimension_id source_dimension,
      CASE WHEN src.dimension_id=dst.dimension_id THEN dst.id ELSE src.id END target_id
    FROM public.mrp_rm_plan_detail t
    JOIN public.inv_stock_item si ON si.id=t.stock_item_id
    JOIN public.inv_uom src ON src.id=t.required_uom_id
    JOIN public.inv_uom dst ON dst.id=si.default_uom_id
    WHERE t.mrp_run_id=v_run_id
  ), converted AS (
    SELECT f.stock_item_id,f.target_id,
      f.required_qty * public.mrp_uom_factor_strict(f.source_id,f.target_id) AS quantity_in_target_unit
    FROM fact f
  )
  SELECT v_month_start,v_month_end,c.stock_item_id,c.target_id,u.code,
         sum(c.quantity_in_target_unit)
  FROM converted c JOIN public.inv_uom u ON u.id=c.target_id
  GROUP BY c.stock_item_id,c.target_id,u.code;

  -- 3) Mark active
  insert into public.mrp_rm_plan_month_runs (
    month_start, mrp_run_id, built_at, built_by, notes, is_active
  )
  values (v_month_start, v_run_id, now(), p_built_by, p_notes, true);

  -- 4) Return row (set OUT params explicitly)
  month_start := v_month_start;
  mrp_run_id := v_run_id;
  rows_inserted := v_rows;
  return next;
end;
$function$;
COMMIT;
