-- PEC G0 owner-approved server correction captured from live PostgreSQL on 2026-11-12.
-- Existing approved PR/indent/BOM history remains preserved.
-- Requires prior governed 13-row Kg->g BOM correction (see docs/procurement-execution).
-- Does NOT invoke any destructive active MRP rebuild; apply only after migration QA.
BEGIN;

-- mrp_uom_factor_strict
CREATE OR REPLACE FUNCTION public.mrp_uom_factor_strict(p_from_uom_id bigint, p_to_uom_id bigint)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_from_dim bigint; v_to_dim bigint; v_count integer; v_factor numeric;
BEGIN
 IF p_from_uom_id IS NULL OR p_to_uom_id IS NULL THEN
   RAISE EXCEPTION 'MRP UOM factor: source or target UOM missing';
 END IF;
 IF p_from_uom_id=p_to_uom_id THEN RETURN 1; END IF;
 SELECT dimension_id INTO v_from_dim FROM public.inv_uom WHERE id=p_from_uom_id;
 SELECT dimension_id INTO v_to_dim FROM public.inv_uom WHERE id=p_to_uom_id;
 IF v_from_dim IS NULL OR v_to_dim IS NULL OR v_from_dim<>v_to_dim THEN
   RAISE EXCEPTION 'MRP UOM: incompatible unit dimensions (% -> %)',p_from_uom_id,p_to_uom_id;
 END IF;
 SELECT count(DISTINCT factor),max(factor) INTO v_count,v_factor FROM public.inv_uom_conversion
 WHERE from_uom_id=p_from_uom_id AND to_uom_id=p_to_uom_id AND factor>0;
 IF v_count>1 THEN RAISE EXCEPTION 'MRP UOM: ambiguous direct factors (% -> %)',p_from_uom_id,p_to_uom_id; END IF;
 IF v_count=1 THEN RETURN v_factor; END IF;
 SELECT count(DISTINCT factor),max(factor) INTO v_count,v_factor FROM public.inv_uom_conversion
 WHERE from_uom_id=p_to_uom_id AND to_uom_id=p_from_uom_id AND factor>0;
 IF v_count<>1 THEN RAISE EXCEPTION 'MRP UOM: missing or ambiguous factor (% -> %)',p_from_uom_id,p_to_uom_id; END IF;
 RETURN 1/v_factor;
END $function$;

CREATE OR REPLACE VIEW public.v_mrp_material_gross_requirement_rm AS
WITH raw AS (
         SELECT 'raw_material'::text AS material_kind,
            p.month_start,
            p.rm_stock_item_id AS stock_item_id,
            p.required_uom_id AS source_uom_id,
                CASE
                    WHEN su.dimension_id = du.dimension_id THEN si.default_uom_id
                    ELSE p.required_uom_id
                END AS target_uom_id,
            p.final_required_pre_net_qty AS source_qty,
            p.seasonal_overlay_run_id,
            p.conversion_applied
           FROM v_mrp_rm_procurement_pre_net_purchase_form p
             JOIN inv_stock_item si ON si.id = p.rm_stock_item_id
             JOIN inv_uom su ON su.id = p.required_uom_id
             JOIN inv_uom du ON du.id = si.default_uom_id
        )
 SELECT material_kind,
    month_start,
    stock_item_id,
    target_uom_id AS uom_id,
    sum(source_qty * mrp_uom_factor_strict(source_uom_id, target_uom_id)) AS gross_required_qty,
    seasonal_overlay_run_id,
    bool_or(conversion_applied) AS conversion_applied
   FROM raw
  GROUP BY material_kind, month_start, stock_item_id, target_uom_id, seasonal_overlay_run_id;;

-- mrp_rm_plan_rebuild_month_active
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
      f.required_qty * CASE
        WHEN f.source_id=f.target_id THEN 1::numeric
        ELSE coalesce(
          (SELECT cv.factor FROM public.inv_uom_conversion cv
           WHERE cv.from_uom_id=f.source_id AND cv.to_uom_id=f.target_id AND cv.factor>0
           ORDER BY cv.id LIMIT 1),
          (SELECT 1/cv.factor FROM public.inv_uom_conversion cv
           WHERE cv.from_uom_id=f.target_id AND cv.to_uom_id=f.source_id AND cv.factor>0
           ORDER BY cv.id LIMIT 1)
        )
      END AS quantity_in_target_unit
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

-- create_pr_from_mrp_plan_pec_internal
CREATE OR REPLACE FUNCTION public.create_pr_from_mrp_plan_pec_internal(p_pr_number text, p_effective_from_date date, p_horizon_start_month date, p_horizon_end_month date, p_material_class_id integer, p_generation_filters jsonb, p_notes text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pr_id bigint;
  v_rm_scope text;
begin
  -- rm_scope is optional; default to 'all'
  v_rm_scope := coalesce(nullif(trim(p_generation_filters->>'rm_scope'),''), 'all');

  -- 1) header
  insert into public.proc_pr_header(
    pr_number,
    status,
    effective_from_date,
    horizon_start_month,
    horizon_end_month,
    material_class_id,
    generation_filters,
    notes,
    created_by,
    updated_by
  )
  values (
    trim(p_pr_number),
    'draft',
    p_effective_from_date,
    p_horizon_start_month,
    p_horizon_end_month,
    p_material_class_id,
    coalesce(p_generation_filters, '{}'::jsonb),
    nullif(trim(p_notes),''),
    auth.uid(),
    auth.uid()
  )
  returning pr_id into v_pr_id;

  -- 2) lines (aggregated per item)
  insert into public.proc_pr_line(
    pr_id,
    material_class_id,
    stock_item_id,
    uom_id,
    system_suggested_qty,
    requested_qty,
    manual_delta_qty,
    manual_reason
  )
  select
    v_pr_id,
    p.material_class_id,
    p.stock_item_id,
    p.uom_id,
    sum(p.procure_qty) as system_suggested_qty,
    sum(p.procure_qty) as requested_qty,
    0::numeric as manual_delta_qty,
    null::text as manual_reason
  from public.v_mrp_procurement_plan p
  join public.inv_stock_item si on si.id = p.stock_item_id
  join public.v_inv_stock_item_with_class sic on sic.stock_item_id = p.stock_item_id
  where sic.active = true
    and (p.material_class_id <> 1 or sic.subcategory_code not in ('finished_bulk_material','semifinished_goods'))
    and p.month_start >= p_horizon_start_month
    and p.month_start <= p_horizon_end_month
    and (p_material_class_id is null or p.material_class_id = p_material_class_id)

    -- RM scope filter (only affects material_class_id = 1 rows)
    and (
      p.material_class_id <> 1
      or v_rm_scope = 'all'
      or (v_rm_scope = 'jit' and si.rm_procurement_mode = 'jit_procured')
      or (v_rm_scope = 'normal' and si.rm_procurement_mode is distinct from 'jit_procured')
    )
  group by
    p.material_class_id,
    p.stock_item_id,
    p.uom_id;

  return v_pr_id;
end;
$function$;

-- proc_pr_rebuild_from_mrp_pec_internal
CREATE OR REPLACE FUNCTION public.proc_pr_rebuild_from_mrp_pec_internal(p_pr_id bigint, p_mode text DEFAULT 'safe'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
  v_hs date;
  v_he date;
  v_class_id bigint;
  v_filters jsonb;
  v_rm_scope text;
begin
  if p_pr_id is null then
    raise exception 'p_pr_id is required';
  end if;

  select status, horizon_start_month, horizon_end_month, material_class_id, generation_filters
  into v_status, v_hs, v_he, v_class_id, v_filters
  from public.proc_pr_header
  where pr_id = p_pr_id;

  if v_status is null then
    raise exception 'PR not found';
  end if;

  if v_status <> 'draft' then
    raise exception 'Rebuild allowed only for draft PRs (current status=%)', v_status;
  end if;

  if p_mode not in ('safe','reset') then
    raise exception 'Invalid mode %. Use safe or reset', p_mode;
  end if;

  v_rm_scope := coalesce(nullif(trim(v_filters->>'rm_scope'),''), 'all');

  -- Materialize new plan quantities into a temp table (persists across statements)
  create temp table if not exists _np_pr_rebuild(
    material_class_id bigint,
    stock_item_id bigint,
    uom_id bigint,
    qty numeric
  ) on commit drop;

  truncate table _np_pr_rebuild;

  insert into _np_pr_rebuild(material_class_id, stock_item_id, uom_id, qty)
  select
    p.material_class_id,
    p.stock_item_id,
    p.uom_id,
    sum(p.procure_qty) as qty
  from public.v_mrp_procurement_plan p
  join public.inv_stock_item si on si.id = p.stock_item_id
  join public.v_inv_stock_item_with_class sic on sic.stock_item_id = p.stock_item_id
  where sic.active = true
    and (p.material_class_id <> 1 or sic.subcategory_code not in ('finished_bulk_material','semifinished_goods'))
    and p.month_start >= v_hs
    and p.month_start <= v_he
    and (v_class_id is null or p.material_class_id = v_class_id)
    and (
      p.material_class_id <> 1
      or v_rm_scope = 'all'
      or (v_rm_scope = 'jit' and si.rm_procurement_mode = 'jit_procured')
      or (v_rm_scope = 'normal' and si.rm_procurement_mode is distinct from 'jit_procured')
    )
  group by p.material_class_id, p.stock_item_id, p.uom_id;

  -- 1) update matched lines
  update public.proc_pr_line l
  set
    system_suggested_qty = np.qty,
    requested_qty = case
      when p_mode = 'reset' then np.qty
      when l.manual_delta_qty = 0
           and (l.manual_reason is null or btrim(l.manual_reason) = '') then np.qty
      else l.requested_qty
    end,
    manual_delta_qty = case when p_mode = 'reset' then 0 else l.manual_delta_qty end,
    manual_reason    = case when p_mode = 'reset' then null else l.manual_reason end,
    updated_at = now()
  from _np_pr_rebuild np
  where l.pr_id = p_pr_id
    and l.material_class_id = np.material_class_id
    and l.stock_item_id = np.stock_item_id
    and l.uom_id = np.uom_id;

  -- 2) lines no longer in plan
  update public.proc_pr_line l
  set
    system_suggested_qty = 0,
    requested_qty = case when p_mode = 'reset' then 0 else l.requested_qty end,
    manual_delta_qty = case when p_mode = 'reset' then 0 else l.manual_delta_qty end,
    manual_reason    = case when p_mode = 'reset' then null else l.manual_reason end,
    updated_at = now()
  where l.pr_id = p_pr_id
    and not exists (
      select 1 from _np_pr_rebuild np
      where np.material_class_id = l.material_class_id
        and np.stock_item_id = l.stock_item_id
        and np.uom_id = l.uom_id
    );

  -- 3) insert missing new plan lines
  insert into public.proc_pr_line(
    pr_id, material_class_id, stock_item_id, uom_id,
    system_suggested_qty, requested_qty, manual_delta_qty, manual_reason
  )
  select
    p_pr_id,
    np.material_class_id,
    np.stock_item_id,
    np.uom_id,
    np.qty,
    np.qty,
    0::numeric,
    null::text
  from _np_pr_rebuild np
  where not exists (
    select 1 from public.proc_pr_line l
    where l.pr_id = p_pr_id
      and l.material_class_id = np.material_class_id
      and l.stock_item_id = np.stock_item_id
      and l.uom_id = np.uom_id
  );

  update public.proc_pr_header
  set updated_at = now(), updated_by = auth.uid()
  where pr_id = p_pr_id;

end;
$function$;

-- proc_indent_create_from_pr_pec_internal
CREATE OR REPLACE FUNCTION public.proc_indent_create_from_pr_pec_internal(p_pr_id bigint, p_indent_number text DEFAULT NULL::text, p_indent_date date DEFAULT CURRENT_DATE, p_notes text DEFAULT NULL::text, p_allow_duplicate boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_indent_id bigint;
  v_existing_indent_id bigint;

  v_pr_number text;
  v_pr_material_class_id bigint;
  v_pr_generation_filters jsonb;
  v_pr_notes text;

  v_indent_number text;
  v_gen jsonb;
begin
  if p_pr_id is null then
    raise exception 'p_pr_id is required';
  end if;

  -- Guard: prevent duplicate active indent mapping unless explicitly allowed
  select m.indent_id
  into v_existing_indent_id
  from public.proc_pr_to_indent_map m
  where m.pr_id = p_pr_id
    and coalesce(m.is_active, true) = true
  order by m.linked_at desc nulls last, m.created_at desc nulls last
  limit 1;

  if (v_existing_indent_id is not null) and (not p_allow_duplicate) then
    raise exception
      'Indent already exists for pr_id=% (indent_id=%). Use p_allow_duplicate=true only if you really intend another indent.',
      p_pr_id,
      v_existing_indent_id;
  end if;

  -- Load PR header
  select
    h.pr_number,
    h.material_class_id,
    h.generation_filters,
    h.notes
  into
    v_pr_number,
    v_pr_material_class_id,
    v_pr_generation_filters,
    v_pr_notes
  from public.proc_pr_header h
  where h.pr_id = p_pr_id;

  if v_pr_number is null then
    raise exception 'PR not found for pr_id=%', p_pr_id;
  end if;

  -- Do not create empty indent headers. Count only eligible positive PR lines.
  IF NOT EXISTS (
    SELECT 1 FROM public.proc_pr_line l
    JOIN public.v_inv_stock_item_with_class sic ON sic.stock_item_id=l.stock_item_id
    WHERE l.pr_id=p_pr_id AND sic.active=true
      AND (l.material_class_id<>1 OR sic.subcategory_code NOT IN ('finished_bulk_material','semifinished_goods'))
      AND (v_pr_material_class_id IS NULL OR l.material_class_id=v_pr_material_class_id)
      AND coalesce(l.requested_qty,0)+coalesce(l.manual_delta_qty,0)>0
  ) THEN
    RAISE EXCEPTION 'No eligible positive external-procurement PR lines to create an indent';
  END IF;

  -- Decide indent number: either provided or auto-generated
  v_indent_number :=
    coalesce(
      nullif(trim(p_indent_number), ''),
      public.proc_indent_next_number(v_pr_material_class_id, p_indent_date)
    );

  -- Build generation_filters with provenance
  v_gen :=
    coalesce(v_pr_generation_filters, '{}'::jsonb)
    || jsonb_build_object(
         'source', 'proc_indent_create_from_pr',
         'source_pr_id', p_pr_id,
         'source_pr_number', v_pr_number,
         'indent_date', to_char(coalesce(p_indent_date, current_date), 'YYYY-MM-DD')
       );

  -- Create indent header
  insert into public.proc_indent_header (
    indent_number,
    status,
    indent_date,
    material_class_id,
    source_pr_id,
    generation_filters,
    notes,
    created_by,
    updated_by
  )
  values (
    v_indent_number,
    'draft',
    coalesce(p_indent_date, current_date),
    v_pr_material_class_id,
    p_pr_id,
    coalesce(v_gen, '{}'::jsonb),
    nullif(trim(coalesce(p_notes, v_pr_notes)), ''),
    auth.uid(),
    auth.uid()
  )
  returning indent_id into v_indent_id;

  -- Copy PR lines -> indent lines
  -- Exclude zero / negative final quantity lines
  insert into public.proc_indent_line (
    indent_id,
    material_class_id,
    stock_item_id,
    uom_id,
    requested_qty,
    manual_reason
  )
  select
    v_indent_id,
    l.material_class_id,
    l.stock_item_id,
    l.uom_id,
    (coalesce(l.requested_qty, 0) + coalesce(l.manual_delta_qty, 0)) as requested_qty,
    nullif(trim(l.manual_reason), '')
  from public.proc_pr_line l
  join public.v_inv_stock_item_with_class sic on sic.stock_item_id=l.stock_item_id
  where sic.active=true
    and (l.material_class_id<>1 or sic.subcategory_code not in ('finished_bulk_material','semifinished_goods'))
    and l.pr_id = p_pr_id
    and (
      v_pr_material_class_id is null
      or l.material_class_id = v_pr_material_class_id
    )
    and (coalesce(l.requested_qty, 0) + coalesce(l.manual_delta_qty, 0)) > 0;

  -- Deactivate any prior active PR mapping for this indent
  -- Normally none, because this is a newly created indent
  update public.proc_pr_to_indent_map
  set
    is_active = false,
    unlinked_at = now(),
    note = 'superseded by new mapping'
  where indent_id = v_indent_id
    and is_active = true;

  -- Record PR -> indent mapping as active history row
  insert into public.proc_pr_to_indent_map (
    pr_id,
    indent_id,
    created_by,
    is_active,
    linked_at,
    note
  )
  values (
    p_pr_id,
    v_indent_id,
    auth.uid(),
    true,
    now(),
    'created from PR'
  );

  -- Line-level mapping: link indent lines back to PR lines
  insert into public.proc_pr_indent_line_map (
    indent_id,
    indent_line_id,
    pr_id,
    pr_line_id
  )
  select
    v_indent_id,
    il.indent_line_id,
    p_pr_id,
    pl.pr_line_id
  from public.proc_pr_line pl
  join public.v_inv_stock_item_with_class sic2 on sic2.stock_item_id=pl.stock_item_id
    and sic2.active=true
    and (pl.material_class_id<>1 or sic2.subcategory_code not in ('finished_bulk_material','semifinished_goods'))
  join public.proc_indent_line il
    on il.indent_id = v_indent_id
   and il.material_class_id = pl.material_class_id
   and il.stock_item_id = pl.stock_item_id
   and il.uom_id = pl.uom_id
  where pl.pr_id = p_pr_id
    and (
      v_pr_material_class_id is null
      or pl.material_class_id = v_pr_material_class_id
    )
    and (coalesce(pl.requested_qty, 0) + coalesce(pl.manual_delta_qty, 0)) > 0;

  return v_indent_id;
end;
$function$;

-- proc_indent_resync_from_pr_pec_internal
CREATE OR REPLACE FUNCTION public.proc_indent_resync_from_pr_pec_internal(p_indent_id bigint, p_mode text DEFAULT 'safe'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
  v_source_pr_id bigint;
  v_pr_status text;
begin
  if p_indent_id is null then raise exception 'p_indent_id is required'; end if;
  if p_mode not in ('safe','reset') then raise exception 'Invalid p_mode %. Use safe or reset', p_mode; end if;

  select h.status, h.source_pr_id
    into v_status, v_source_pr_id
  from public.proc_indent_header h
  where h.indent_id = p_indent_id;

  if v_status is null then raise exception 'Indent not found'; end if;
  if v_status <> 'draft' then raise exception 'Resync allowed only for draft indents (status=%)', v_status; end if;
  if v_source_pr_id is null then raise exception 'Indent has no source_pr_id set'; end if;

  select status into v_pr_status
  from public.proc_pr_header
  where pr_id = v_source_pr_id;

  if v_pr_status is null then raise exception 'Source PR not found (pr_id=%)', v_source_pr_id; end if;
  if v_pr_status <> 'active' then raise exception 'Source PR must be active to resync (status=%)', v_pr_status; end if;

  -- FULL RESET: delete all indent lines (and mapping rows will cascade if FK is set)
  if p_mode = 'reset' then
    delete from public.proc_indent_line
    where indent_id = p_indent_id;
  end if;

  -- Materialize PR final quantities (non-zero only)
  create temp table if not exists _pr_final_lines (
    material_class_id bigint,
    stock_item_id bigint,
    uom_id bigint,
    final_qty numeric(20,6),
    manual_reason text,
    pr_line_id bigint
  ) on commit drop;

  truncate table _pr_final_lines;

  insert into _pr_final_lines(material_class_id, stock_item_id, uom_id, final_qty, manual_reason, pr_line_id)
  select
    l.material_class_id,
    l.stock_item_id,
    l.uom_id,
    (coalesce(l.requested_qty,0) + coalesce(l.manual_delta_qty,0))::numeric(20,6) as final_qty,
    nullif(btrim(l.manual_reason),'') as manual_reason,
    l.pr_line_id
  from public.proc_pr_line l
  join public.v_inv_stock_item_with_class sic on sic.stock_item_id=l.stock_item_id
  where sic.active=true
    and (l.material_class_id<>1 or sic.subcategory_code not in ('finished_bulk_material','semifinished_goods'))
    and l.pr_id = v_source_pr_id
    and (coalesce(l.requested_qty,0) + coalesce(l.manual_delta_qty,0)) > 0;

  -- SAFE: update existing indent lines to match PR final qty
  update public.proc_indent_line il
  set
    requested_qty = pfl.final_qty,
    manual_reason = pfl.manual_reason,
    updated_at = now()
  from _pr_final_lines pfl
  where il.indent_id = p_indent_id
    and il.material_class_id = pfl.material_class_id
    and il.stock_item_id = pfl.stock_item_id
    and il.uom_id = pfl.uom_id;

  -- Insert missing lines
  insert into public.proc_indent_line(
    indent_id, material_class_id, stock_item_id, uom_id, requested_qty, manual_reason
  )
  select
    p_indent_id,
    pfl.material_class_id,
    pfl.stock_item_id,
    pfl.uom_id,
    pfl.final_qty,
    pfl.manual_reason
  from _pr_final_lines pfl
  where not exists (
    select 1
    from public.proc_indent_line il
    where il.indent_id = p_indent_id
      and il.material_class_id = pfl.material_class_id
      and il.stock_item_id = pfl.stock_item_id
      and il.uom_id = pfl.uom_id
  );

  -- Delete lines that are no longer present in PR final lines (delete-on-zero behavior)
  delete from public.proc_indent_line il
  where il.indent_id = p_indent_id
    and not exists (
      select 1 from _pr_final_lines pfl
      where pfl.material_class_id = il.material_class_id
        and pfl.stock_item_id = il.stock_item_id
        and pfl.uom_id = il.uom_id
    );

  -- Update PR→Indent mapping history: deactivate old active, activate new link
  update public.proc_pr_to_indent_map
  set is_active = false, unlinked_at = now(), note = 'superseded by resync'
  where indent_id = p_indent_id
    and is_active = true;

  insert into public.proc_pr_to_indent_map(pr_id, indent_id, created_by, is_active, linked_at, note)
  values (v_source_pr_id, p_indent_id, auth.uid(), true, now(), 'resynced indent from PR');

  -- Rebuild line-level mapping
  delete from public.proc_pr_indent_line_map
  where indent_id = p_indent_id;

  insert into public.proc_pr_indent_line_map(indent_id, indent_line_id, pr_id, pr_line_id)
  select
    p_indent_id,
    il.indent_line_id,
    v_source_pr_id,
    pfl.pr_line_id
  from public.proc_indent_line il
  join _pr_final_lines pfl
    on pfl.material_class_id = il.material_class_id
   and pfl.stock_item_id = il.stock_item_id
   and pfl.uom_id = il.uom_id
  where il.indent_id = p_indent_id;

  update public.proc_indent_header
  set updated_at = now(), updated_by = auth.uid()
  where indent_id = p_indent_id;

end;
$function$;

COMMIT;
