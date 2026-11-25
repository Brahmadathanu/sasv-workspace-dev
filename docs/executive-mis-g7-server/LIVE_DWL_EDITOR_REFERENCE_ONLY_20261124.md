# Executive MIS G7 — Exact live DWL editor reference only (24 November 2026 IST)

**READ-ONLY evidence. NOT a migration, NOT approved for installation, NOT a replacement of existing installed functions.** Extracted from live Supabase PostgreSQL `pg_get_functiondef` inside `BEGIN READ ONLY`. These are original definitions to be used as production-shaped test fixtures and rollback comparisons. Do not edit existing installed migrations or live functions; never treat the source as owner acceptance of a modified core. Fingerprints must be reverified immediately before any authorized migration.

The live owner is `postgres`; `rpc_update_daily_work_log_with_packaging` requires `module:edit-log-entry` Edit; `__core` has no direct authenticated EXECUTE. The existing workflow DELETEs old `event_skus`/`packaging_events` and recreates them for Done packaging logs. Actual examples of `sku_breakdown` include `40 g x 576`, `10 mL x 480`, `25 g x 2992`. The parser output is `(pack_size numeric,uom text,sku_count integer)`. The S5 core adapter MUST preserve BMR/product/batch and base-UOM stock conservation, reject old missing-depletion source repair by side effect, and be fail-closed in ENFORCE mode until separately approved.

## fn_parse_sku_breakdown(text)

- Actual SHA-256 of `pg_get_functiondef`: `ec5fe3ead3e839d4ccad6c9f7e37c5775e1299c0b46ad71cc9a6b9eb7c5b29db`
- Owner: `postgres`
- ACL: `undefined`
- Function config: `undefined`

```sql
CREATE OR REPLACE FUNCTION public.fn_parse_sku_breakdown(p_sku_breakdown text)
 RETURNS TABLE(pack_size numeric, uom text, sku_count integer)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
DECLARE
  v_part text;
  v_clean text;
  v_match text[];
BEGIN
  IF p_sku_breakdown IS NULL OR btrim(p_sku_breakdown) = '' THEN
    RETURN;
  END IF;

  FOR v_part IN
    SELECT regexp_split_to_table(p_sku_breakdown, '\s*;\s*')
  LOOP
    v_clean := btrim(v_part);

    IF v_clean = '' THEN
      CONTINUE;
    END IF;

    /*
      Expected:
      100 mL x 420
      200 mL x 433
      50 g x 600
    */
    v_match := regexp_match(
      v_clean,
      '^\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]+)\s*[xX]\s*([0-9]+)\s*$'
    );

    IF v_match IS NULL THEN
      RAISE EXCEPTION
        'Invalid sku_breakdown segment: "%". Expected format like "100 mL x 420"',
        v_clean;
    END IF;

    pack_size := v_match[1]::numeric;
    uom := v_match[2];
    sku_count := v_match[3]::integer;

    IF sku_count <= 0 THEN
      RAISE EXCEPTION 'Invalid SKU count in segment "%": count must be > 0', v_clean;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$function$

```

## rpc_update_daily_work_log_with_packaging(bigint,date,integer,integer,integer,integer,text,text,numeric,text,text,text,text,integer,text,text,text,date,date,text,date,numeric,text,text,text,text,numeric,text,numeric,text)

- Actual SHA-256 of `pg_get_functiondef`: `4c82b4a3263f3f868e8ac4dc696f5b68efd58e593fe4adb4d92a7ec7fb1bd7b4`
- Owner: `postgres`
- ACL: `undefined`
- Function config: `undefined`

```sql
CREATE OR REPLACE FUNCTION public.rpc_update_daily_work_log_with_packaging(p_id bigint, p_log_date date, p_section_id integer, p_subsection_id integer, p_area_id integer, p_plant_id integer, p_item text, p_batch_number text, p_batch_size numeric, p_batch_uom text, p_activity text, p_juice_or_decoction text, p_specify text, p_count_of_saravam integer, p_fuel text, p_fuel_under text, p_fuel_over text, p_started_on date, p_due_date date, p_status text, p_completed_on date, p_qty_after_process numeric, p_qty_uom text, p_remarks text, p_lab_ref_number text, p_sku_breakdown text, p_storage_qty numeric, p_storage_qty_uom text, p_rm_juice_qty numeric, p_rm_juice_uom text)
 RETURNS TABLE(daily_work_log_id bigint, packaging_event_id bigint, inserted_event_sku_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_existing public.daily_work_log%rowtype;

    v_product_id integer;
    v_uom_base text;

    v_factor numeric := 0;
    v_is_packaging boolean := false;

    v_has_source_evidence boolean := false;
    v_existing_source_net numeric := 0;
    v_target_source_net numeric := 0;
    v_delta numeric := 0;

    v_actor text;

    v_result record;
begin
    perform public.require_permission(
        'module:edit-log-entry',
        true
    );

    select *
    into v_existing
    from public.daily_work_log d
    where d.id = p_id
    for update;

    if not found then
        raise exception
            'No daily_work_log row found for id %',
            p_id;
    end if;

    select
        p.id,
        p.uom_base
    into
        v_product_id,
        v_uom_base
    from public.products p
    where p.item = v_existing.item
    limit 1;

    select
        coalesce(e.affects_bulk_stock, 0),
        coalesce(e.is_packaging, false)
    into
        v_factor,
        v_is_packaging
    from public.event_type_lkp e
    where lower(btrim(e.label)) =
          lower(btrim(v_existing.activity))
      and e.active
    limit 1;

    select exists (
        select 1
        from public.fg_bulk_stock_ledger l
        where l.source_table = 'daily_work_log'
          and l.source_id = p_id
    )
    into v_has_source_evidence;

    if v_has_source_evidence then
        -- Structural validation is duplicated here to fail before the
        -- core writer modifies packaging chains.
        if p_item is distinct from v_existing.item then
            raise exception
                'FG stock source identity is immutable after ledger posting. Product/item correction requires a governed ledger adjustment.'
                using errcode = '23514';
        end if;

        if p_batch_number
           is distinct from v_existing.batch_number
        then
            raise exception
                'FG stock source identity is immutable after ledger posting. Batch correction requires a governed ledger adjustment.'
                using errcode = '23514';
        end if;

        if lower(btrim(coalesce(p_activity, '')))
           is distinct from
           lower(btrim(coalesce(v_existing.activity, '')))
        then
            raise exception
                'FG stock activity is immutable after ledger posting. Event reclassification requires a governed ledger adjustment.'
                using errcode = '23514';
        end if;

        if p_storage_qty_uom
           is distinct from v_existing.storage_qty_uom
        then
            raise exception
                'FG stock UOM is immutable after ledger posting.'
                using errcode = '23514';
        end if;

        if p_section_id
           is distinct from v_existing.section_id
           or p_subsection_id
              is distinct from v_existing.subsection_id
           or p_area_id
              is distinct from v_existing.area_id
           or p_plant_id
              is distinct from v_existing.plant_id
        then
            raise exception
                'FG stock location is immutable after ledger posting. Use FG Bulk Internal Transfer.'
                using errcode = '23514';
        end if;

        if v_product_id is null then
            raise exception
                'Current DWL product cannot be resolved for item %.',
                v_existing.item;
        end if;

        if coalesce(v_factor, 0) = 0
           or coalesce(v_is_packaging, false)
        then
            raise exception
                'Posted DWL row % no longer resolves to a coherent FG stock activity and cannot be changed through ordinary editing.',
                p_id
                using errcode = '23514';
        end if;

        if p_storage_qty is null then
            raise exception
                'Posted FG stock source quantity cannot be cleared.'
                using errcode = '23514';
        end if;

        if p_storage_qty < 0 then
            raise exception
                'FG source quantity must be zero or positive.'
                using errcode = '22023';
        end if;

        if p_storage_qty_uom
           is distinct from v_uom_base
        then
            raise exception
                'DWL storage UOM % does not match product base UOM %.',
                p_storage_qty_uom,
                v_uom_base;
        end if;

        if exists (
            select 1
            from public.fg_bulk_stock_ledger l
            where l.source_table = 'daily_work_log'
              and l.source_id = p_id
              and (
                     l.product_id
                     is distinct from v_product_id
                  or l.batch_number
                     is distinct from v_existing.batch_number
              )
        ) then
            raise exception
                'DWL row % has historical ledger evidence under a different product or batch identity.',
                p_id
                using errcode = '23514';
        end if;

        select coalesce(sum(l.qty_base), 0)
        into v_existing_source_net
        from public.fg_bulk_stock_ledger l
        where l.source_table = 'daily_work_log'
          and l.source_id = p_id
          and l.product_id = v_product_id
          and l.batch_number = v_existing.batch_number;

        v_target_source_net :=
            p_storage_qty * v_factor;

        v_delta :=
            v_target_source_net -
            v_existing_source_net;
    end if;

    -- Prevent ledger reconciliation from running between the DWL update
    -- and its completed single-delta correction.
    if v_has_source_evidence
       and v_delta <> 0
    then
        perform set_config(
            'app.fg_reconcile',
            '1',
            true
        );

        perform set_config(
            'app.allow_dwl_fg_qty_correction',
            '1',
            true
        );
    end if;

    select *
    into v_result
    from public.rpc_update_daily_work_log_with_packaging__core(
        p_id,
        p_log_date,
        p_section_id,
        p_subsection_id,
        p_area_id,
        p_plant_id,
        p_item,
        p_batch_number,
        p_batch_size,
        p_batch_uom,
        p_activity,
        p_juice_or_decoction,
        p_specify,
        p_count_of_saravam,
        p_fuel,
        p_fuel_under,
        p_fuel_over,
        p_started_on,
        p_due_date,
        p_status,
        p_completed_on,
        p_qty_after_process,
        p_qty_uom,
        p_remarks,
        p_lab_ref_number,
        p_sku_breakdown,
        p_storage_qty,
        p_storage_qty_uom,
        p_rm_juice_qty,
        p_rm_juice_uom
    );

    if v_has_source_evidence
       and v_delta <> 0
    then
        v_actor := coalesce(
            nullif(auth.jwt() ->> 'email', ''),
            auth.uid()::text,
            'server'
        );

        insert into public.fg_bulk_stock_ledger (
            product_id,
            batch_number,
            movement_date,
            qty,
            qty_base,
            uom,
            reason_code,
            source_table,
            source_id,
            created_at,
            created_by,
            section_id,
            subsection_id,
            area_id,
            plant_id
        )
        values (
            v_product_id,
            v_existing.batch_number,
            current_date,
            v_delta,
            v_delta,
            v_uom_base,
            case
                when v_delta > 0
                    then 'FG source quantity correction increase'
                else 'FG source quantity correction decrease'
            end,
            'daily_work_log',
            p_id,
            now(),
            v_actor,
            v_existing.section_id,
            v_existing.subsection_id,
            v_existing.area_id,
            v_existing.plant_id
        );

        perform set_config(
            'app.allow_dwl_fg_qty_correction',
            '0',
            true
        );

        perform set_config(
            'app.fg_reconcile',
            '0',
            true
        );

        perform public.fn_fg_reconcile_batch(
            v_product_id,
            v_existing.batch_number,
            public.fn_fg_eps_default()
        );
    end if;

    return query
    select
        v_result.daily_work_log_id,
        v_result.packaging_event_id,
        v_result.inserted_event_sku_count;

exception
    when others then
        perform set_config(
            'app.allow_dwl_fg_qty_correction',
            '0',
            true
        );

        perform set_config(
            'app.fg_reconcile',
            '0',
            true
        );

        raise;
end;
$function$

```

## rpc_update_daily_work_log_with_packaging__core(bigint,date,integer,integer,integer,integer,text,text,numeric,text,text,text,text,integer,text,text,text,date,date,text,date,numeric,text,text,text,text,numeric,text,numeric,text)

- Actual SHA-256 of `pg_get_functiondef`: `df7290df4a17e4af9f0aed43cf564007a35b957d8899b98869d7d35531296aec`
- Owner: `postgres`
- ACL: `undefined`
- Function config: `undefined`

```sql
CREATE OR REPLACE FUNCTION public.rpc_update_daily_work_log_with_packaging__core(p_id bigint, p_log_date date, p_section_id integer, p_subsection_id integer, p_area_id integer, p_plant_id integer, p_item text, p_batch_number text, p_batch_size numeric, p_batch_uom text, p_activity text, p_juice_or_decoction text, p_specify text, p_count_of_saravam integer, p_fuel text, p_fuel_under text, p_fuel_over text, p_started_on date, p_due_date date, p_status text, p_completed_on date, p_qty_after_process numeric, p_qty_uom text, p_remarks text, p_lab_ref_number text, p_sku_breakdown text, p_storage_qty numeric, p_storage_qty_uom text, p_rm_juice_qty numeric, p_rm_juice_uom text)
 RETURNS TABLE(daily_work_log_id bigint, packaging_event_id bigint, inserted_event_sku_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_dwl public.daily_work_log%ROWTYPE;
  v_old_packaging_event_id bigint;
  v_new_packaging_event_id bigint;
  v_product_id integer;
  v_is_done boolean := false;
  v_is_packaging boolean := false;
  v_should_have_packaging boolean := false;
  v_inserted_count integer := 0;
  v_total_segments integer := 0;
  v_clean_status text;
  v_clean_activity text;
  v_clean_sku_breakdown text;
BEGIN
  /*
    Normalize inputs used in control flow.
    Keep stored values unchanged in the actual UPDATE below.
  */
  v_clean_status := coalesce(btrim(p_status), '');
  v_clean_activity := btrim(p_activity);
  v_clean_sku_breakdown := nullif(btrim(p_sku_breakdown), '');

  /*
    1) Lock and verify target row
  */
  SELECT *
    INTO v_existing_dwl
    FROM public.daily_work_log
   WHERE id = p_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No daily_work_log row found for id %', p_id;
  END IF;

  /*
    2) Determine whether this edited row should have packaging chain.

    Important fix:
    If there is no matching row in event_type_lkp, treat it as NOT packaging.
    The prior logic could leave v_is_packaging NULL and accidentally fall into
    packaging enforcement for Done rows.
  */
  v_is_done := (v_clean_status = 'Done');

  SELECT COALESCE(
           (
             SELECT lkp.is_packaging
               FROM public.event_type_lkp lkp
              WHERE lkp.code = v_clean_activity
              LIMIT 1
           ),
           false
         )
    INTO v_is_packaging;

  v_should_have_packaging := v_is_done AND v_is_packaging;

  /*
    3) Find existing packaging chain, if any
  */
  SELECT pe.id
    INTO v_old_packaging_event_id
    FROM public.packaging_events pe
   WHERE pe.work_log_id = p_id
   LIMIT 1;

  /*
    4) Update daily_work_log first, preserving current behavior
  */
  UPDATE public.daily_work_log
     SET log_date           = p_log_date,
         section_id         = p_section_id,
         subsection_id      = p_subsection_id,
         area_id            = p_area_id,
         plant_id           = p_plant_id,
         item               = p_item,
         batch_number       = p_batch_number,
         batch_size         = p_batch_size,
         batch_uom          = p_batch_uom,
         activity           = p_activity,
         juice_or_decoction = p_juice_or_decoction,
         specify            = p_specify,
         count_of_saravam   = p_count_of_saravam,
         fuel               = p_fuel,
         fuel_under         = p_fuel_under,
         fuel_over          = p_fuel_over,
         started_on         = p_started_on,
         due_date           = p_due_date,
         status             = p_status,
         completed_on       = p_completed_on,
         qty_after_process  = p_qty_after_process,
         qty_uom            = p_qty_uom,
         remarks            = p_remarks,
         lab_ref_number     = p_lab_ref_number,
         sku_breakdown      = p_sku_breakdown,
         storage_qty        = p_storage_qty,
         storage_qty_uom    = p_storage_qty_uom,
         rm_juice_qty       = p_rm_juice_qty,
         rm_juice_uom       = p_rm_juice_uom
   WHERE id = p_id;

  /*
    5) If this row should NOT have packaging chain, remove any old chain and return
  */
  IF v_should_have_packaging IS NOT TRUE THEN
    IF v_old_packaging_event_id IS NOT NULL THEN
      DELETE FROM public.event_skus
       WHERE packaging_event_id = v_old_packaging_event_id;

      DELETE FROM public.packaging_events
       WHERE id = v_old_packaging_event_id;
    END IF;

    RETURN QUERY
    SELECT p_id, NULL::bigint, 0;

    RETURN;
  END IF;

  /*
    6) From here onward, packaging chain is mandatory
  */
  IF v_clean_sku_breakdown IS NULL THEN
    RAISE EXCEPTION
      'Packaging activity "%" with status Done requires sku_breakdown',
      p_activity;
  END IF;

  /*
    7) Resolve product from item
  */
  SELECT p.id
    INTO v_product_id
    FROM public.products p
   WHERE p.item = p_item
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No product found for item "%"', p_item;
  END IF;

  /*
    8) Delete existing packaging chain before recreating it
  */
  IF v_old_packaging_event_id IS NOT NULL THEN
    DELETE FROM public.event_skus
     WHERE packaging_event_id = v_old_packaging_event_id;

    DELETE FROM public.packaging_events
     WHERE id = v_old_packaging_event_id;
  END IF;

  /*
    9) Recreate packaging_events
  */
  INSERT INTO public.packaging_events (
    work_log_id,
    event_type
  )
  VALUES (
    p_id,
    p_activity
  )
  RETURNING id INTO v_new_packaging_event_id;

  /*
    10) Validate parsed sku_breakdown
  */
  SELECT COUNT(*)
    INTO v_total_segments
    FROM public.fn_parse_sku_breakdown(v_clean_sku_breakdown);

  IF v_total_segments = 0 THEN
    RAISE EXCEPTION
      'Packaging activity "%" with status Done requires at least one valid sku_breakdown segment',
      p_activity;
  END IF;

  /*
    11) Insert event_skus by matching parsed breakdown to product_skus
  */
  INSERT INTO public.event_skus (
    packaging_event_id,
    sku_id,
    count
  )
  SELECT
    v_new_packaging_event_id,
    ps.id,
    parsed.sku_count
  FROM public.fn_parse_sku_breakdown(v_clean_sku_breakdown) parsed
  JOIN public.product_skus ps
    ON ps.product_id = v_product_id
   AND ps.pack_size = parsed.pack_size
   AND lower(ps.uom) = lower(parsed.uom);

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  IF v_inserted_count <> v_total_segments THEN
    RAISE EXCEPTION
      'One or more SKU lines in sku_breakdown could not be matched to product_skus for item "%". Breakdown="%"',
      p_item, p_sku_breakdown;
  END IF;

  /*
    12) Return final result
  */
  RETURN QUERY
  SELECT p_id, v_new_packaging_event_id, v_inserted_count;
END;
$function$

```
