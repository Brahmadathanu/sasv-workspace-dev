-- G7 C2 EXACT LIVE ROLLBACK BASELINE (captured READ ONLY from pg_get_functiondef)
-- SHA-256 of function definition UTF8: cc32357d320fb63278632c5726085bdcf6b32395453838d39cac8c3584faed28
-- DO NOT EXECUTE without separately authorized rollback and safety verification.
-- Security/permission owner and companion triggers must be independently checked.

CREATE OR REPLACE FUNCTION public.trg_fg_ledger_from_es()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
DECLARE
  /* Source rows */
  v_pe   RECORD;   -- packaging_events
  v_dwl  RECORD;   -- daily_work_log
  v_lkp  RECORD;   -- event_type_lkp
  v_psku RECORD;   -- product_skus
  v_prod RECORD;   -- products

  /* SKU-count maths */
  v_old_cnt   numeric := 0;
  v_new_cnt   numeric := 0;
  v_delta_cnt numeric := 0;

  v_base_per       numeric := 0;   -- base qty per 1 SKU
  v_delta_qty_base numeric := 0;   -- change in base UOM

  /* Ledger row props */
  v_date   date;
  v_reason text;
BEGIN
  ------------------------------------------------------------------
  -- 1) Pull related rows
  ------------------------------------------------------------------
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT * INTO v_pe  FROM public.packaging_events WHERE id = NEW.packaging_event_id;
    SELECT * INTO v_dwl FROM public.daily_work_log   WHERE id = v_pe.work_log_id;
    SELECT label, affects_bulk_stock, is_packaging
      INTO v_lkp
      FROM public.event_type_lkp
     WHERE label = v_pe.event_type
       AND active;
  ELSE
    SELECT * INTO v_pe  FROM public.packaging_events WHERE id = OLD.packaging_event_id;
    SELECT * INTO v_dwl FROM public.daily_work_log   WHERE id = v_pe.work_log_id;
    SELECT label, affects_bulk_stock, is_packaging
      INTO v_lkp
      FROM public.event_type_lkp
     WHERE label = v_pe.event_type
       AND active;
  END IF;

  IF v_pe IS NULL OR v_dwl IS NULL OR v_lkp IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  ------------------------------------------------------------------
  -- 2) Only act for packaging events that affect bulk stock
  ------------------------------------------------------------------
  IF NOT v_lkp.is_packaging OR v_lkp.affects_bulk_stock = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  ------------------------------------------------------------------
  -- 3) SKU & product info
  ------------------------------------------------------------------
  SELECT id, product_id, pack_size, uom
    INTO v_psku
    FROM public.product_skus
   WHERE id = COALESCE(NEW.sku_id, OLD.sku_id);

  IF v_psku IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id, uom_base, conversion_to_base
    INTO v_prod
    FROM public.products
   WHERE id = v_psku.product_id;

  IF v_prod IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  ------------------------------------------------------------------
  -- 4) Work out count delta (+/- SKU units)
  ------------------------------------------------------------------
  IF TG_OP IN ('INSERT','UPDATE') THEN
    v_new_cnt := COALESCE(NEW.count, 0);
  END IF;

  IF TG_OP IN ('UPDATE','DELETE') THEN
    v_old_cnt := COALESCE(OLD.count, 0);
  END IF;

  v_delta_cnt := v_new_cnt - v_old_cnt;
  IF v_delta_cnt = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  ------------------------------------------------------------------
  -- 5) Convert SKU delta to base UOM
  ------------------------------------------------------------------
  IF v_psku.uom = v_prod.uom_base THEN
    v_base_per := v_psku.pack_size;
  ELSE
    v_base_per := v_psku.pack_size * COALESCE(v_prod.conversion_to_base, 1);
  END IF;

  v_delta_qty_base := v_delta_cnt * v_base_per * v_lkp.affects_bulk_stock;

  ------------------------------------------------------------------
  -- 6) Require the batch to already exist in ledger
  ------------------------------------------------------------------
  IF NOT EXISTS (
        SELECT 1
          FROM public.fg_bulk_stock_ledger
         WHERE product_id   = v_prod.id
           AND batch_number = v_dwl.batch_number
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  ------------------------------------------------------------------
  -- 7) Prepare ledger row
  ------------------------------------------------------------------
  v_reason := v_pe.event_type || ' (SKU)';
  v_date   := COALESCE(v_dwl.completed_on, v_dwl.log_date, CURRENT_DATE);

  ------------------------------------------------------------------
  -- 8) Insert movement
  ------------------------------------------------------------------
  INSERT INTO public.fg_bulk_stock_ledger
      (product_id,
       batch_number,
       movement_date,
       qty,
       qty_base,
       uom,
       reason_code,
       source_table,
       source_id,
       created_at)
  VALUES
      (v_prod.id,
       v_dwl.batch_number,
       v_date,
       v_delta_qty_base,
       v_delta_qty_base,
       v_prod.uom_base,
       v_reason,
       'event_skus',
       COALESCE(NEW.id, OLD.id),
       NOW());

  ------------------------------------------------------------------
  -- 9) Reconciliation is handled by fg_bulk_stock_ledger triggers
  ------------------------------------------------------------------
  RETURN COALESCE(NEW, OLD);
END;
$function$

