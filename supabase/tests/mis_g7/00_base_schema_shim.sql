-- TEST-ONLY SHIM of legacy objects the G7 migrations depend on. NOT live schema.
-- Column sets are reconstructed from evidence in the G7 packet (rollback baselines,
-- S1 register SQL). Anything not evidenced is a minimal assumption (flagged in README).
-- trg_fg_ledger_from_es() and fn_fg_ledger_check_negative() bodies are the exact live
-- baselines (SHA256 cc32357d.../211a6e87...) from the packet; force-close/auto-zero/
-- transfer are simplified stand-ins that mimic the audited write semantics.
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth; CREATE SCHEMA costing;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth, public, costing TO anon, authenticated, service_role;
CREATE TABLE public.test_perm (uid uuid, target text);
CREATE FUNCTION public.require_permission(p_target text, p_edit boolean) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.test_perm WHERE uid = auth.uid() AND target = p_target) THEN
    RAISE EXCEPTION 'permission denied for %', p_target USING ERRCODE = '42501'; END IF; END $$;
GRANT EXECUTE ON FUNCTION public.require_permission(text,boolean) TO authenticated;

CREATE TABLE public.products (id integer PRIMARY KEY, item text UNIQUE NOT NULL, uom_base text NOT NULL, conversion_to_base numeric);
CREATE TABLE public.product_skus (id integer PRIMARY KEY, product_id integer REFERENCES public.products(id), pack_size numeric, uom text);
CREATE TABLE public.activities (id integer PRIMARY KEY, activity_name text UNIQUE NOT NULL);
CREATE TABLE public.bmr_details (id integer PRIMARY KEY, product_id integer REFERENCES public.products(id), bn text, lifecycle_status text);
CREATE TABLE public.daily_work_log (id serial PRIMARY KEY, item text, batch_number text, activity text, log_date date, status text,
  storage_qty numeric, storage_qty_uom text, completed_on date);
CREATE TABLE costing.product_process_route (id bigserial PRIMARY KEY, product_id integer, status text, effective_from date, effective_to date, base_route_family_route_id bigint);
CREATE TABLE costing.production_route_family_route_step (id bigserial PRIMARY KEY, family_route_id bigint, activity_id integer, is_mandatory boolean);
CREATE TABLE public.event_type_lkp (label text PRIMARY KEY, affects_bulk_stock numeric, is_packaging boolean, active boolean DEFAULT true);
CREATE TABLE public.packaging_events (id serial PRIMARY KEY, work_log_id integer REFERENCES public.daily_work_log(id), event_type text);
CREATE TABLE public.event_skus (id serial PRIMARY KEY, packaging_event_id integer REFERENCES public.packaging_events(id), sku_id integer, "count" integer NOT NULL DEFAULT 0 CHECK ("count" >= 0));
CREATE TABLE public.fg_bulk_stock_ledger (id bigserial PRIMARY KEY, product_id integer NOT NULL REFERENCES public.products(id), batch_number text NOT NULL,
  movement_date date, qty numeric, qty_base numeric NOT NULL, uom text, reason_code text, source_table text, source_id bigint,
  created_at timestamptz DEFAULT now(), section_id int, subsection_id int, area_id int, plant_id int);
CREATE TABLE public.fg_bulk_internal_transfer (id serial PRIMARY KEY, product_id integer, batch_number text, qty_base numeric, from_plant int, to_plant int);
ALTER TABLE public.fg_bulk_stock_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY fg_bulk_stock_ledger_authenticated_crud ON public.fg_bulk_stock_ledger FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA costing TO authenticated;

CREATE FUNCTION public.fn_fg_ledger_check_negative() RETURNS trigger LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp' AS $function$
DECLARE new_total numeric;
BEGIN
  SELECT COALESCE(SUM(qty_base),0) + NEW.qty_base INTO new_total FROM public.fg_bulk_stock_ledger
  WHERE product_id = NEW.product_id AND batch_number = NEW.batch_number;
  IF new_total < 0 THEN
    RAISE EXCEPTION 'Cannot post % % for product %, BN %: would make stock negative (%.3f)',
      NEW.qty_base, (SELECT uom_base FROM products WHERE id = NEW.product_id), NEW.product_id, NEW.batch_number, new_total;
  END IF; RETURN NEW; END; $function$;
CREATE TRIGGER fg_ledger_check_negative BEFORE INSERT ON public.fg_bulk_stock_ledger FOR EACH ROW EXECUTE FUNCTION public.fn_fg_ledger_check_negative();

-- EXACT live baseline of trg_fg_ledger_from_es (sha256 cc32357d...)
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
$function$;
CREATE TRIGGER trg_fg_ledger_from_es AFTER INSERT OR UPDATE OR DELETE ON public.event_skus FOR EACH ROW EXECUTE FUNCTION public.trg_fg_ledger_from_es();

-- Simplified stand-ins for other audited writers (semantics: read balance, then insert).
CREATE FUNCTION public.fn_fg_force_close(p_product int, p_bn text, p_sleep numeric DEFAULT 0) RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE b numeric; BEGIN
  SELECT COALESCE(SUM(qty_base),0) INTO b FROM public.fg_bulk_stock_ledger WHERE product_id=p_product AND batch_number=p_bn;
  IF p_sleep > 0 THEN PERFORM pg_sleep(p_sleep); END IF;
  INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id)
  VALUES (p_product,p_bn,CURRENT_DATE,-b,-b,(SELECT uom_base FROM public.products WHERE id=p_product),'FORCE_CLOSE','manual',0);
  RETURN b; END $$;
CREATE FUNCTION public.trg_fg_bulk_internal_transfer_to_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    DELETE FROM public.fg_bulk_stock_ledger WHERE source_table='fg_bulk_internal_transfer' AND source_id=OLD.id; END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id,plant_id)
    VALUES (NEW.product_id,NEW.batch_number,CURRENT_DATE,-NEW.qty_base,-NEW.qty_base,'kg','TRANSFER_OUT','fg_bulk_internal_transfer',NEW.id,NEW.from_plant),
           (NEW.product_id,NEW.batch_number,CURRENT_DATE, NEW.qty_base, NEW.qty_base,'kg','TRANSFER_IN','fg_bulk_internal_transfer',NEW.id,NEW.to_plant); END IF;
  RETURN COALESCE(NEW,OLD); END $$;
CREATE TRIGGER trg_fg_bulk_internal_transfer AFTER INSERT OR UPDATE OR DELETE ON public.fg_bulk_internal_transfer FOR EACH ROW EXECUTE FUNCTION public.trg_fg_bulk_internal_transfer_to_ledger();
