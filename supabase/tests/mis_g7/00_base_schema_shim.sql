-- TEST-ONLY SHIM of legacy objects the G7 migrations depend on. NOT live schema.
-- Column sets are reconstructed from evidence in the G7 packet (rollback baselines,
-- S1 register SQL). Anything not evidenced is a minimal assumption (flagged in README).
-- trg_fg_ledger_from_es() and fn_fg_ledger_check_negative() bodies are the exact live
-- baselines (SHA256 cc32357d.../211a6e87...) from the packet; force-close/auto-zero/
-- transfer are simplified stand-ins that mimic the audited write semantics.
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('CREATE ROLE %I NOLOGIN', r); END IF; END LOOP; END $$;  -- roles are cluster-global
CREATE SCHEMA auth; CREATE SCHEMA costing; CREATE SCHEMA app_private; GRANT USAGE ON SCHEMA app_private TO authenticated;  -- live precondition: authenticated has USAGE
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
CREATE TABLE public.product_skus (id bigint PRIMARY KEY, product_id bigint, pack_size numeric, uom text);  -- live: BIGINT ids
CREATE TABLE public.activities (id integer PRIMARY KEY, activity_name text UNIQUE NOT NULL);
CREATE TABLE public.bmr_details (id integer PRIMARY KEY, product_id integer REFERENCES public.products(id), bn text, lifecycle_status text);
CREATE TABLE public.daily_work_log (id serial PRIMARY KEY, item text, batch_number text, activity text, log_date date, status text,
  storage_qty numeric, storage_qty_uom text, completed_on date);
CREATE TABLE costing.product_process_route (id bigserial PRIMARY KEY, product_id integer, status text, effective_from date, effective_to date, base_route_family_route_id bigint);
CREATE TABLE costing.production_route_family_route_step (id bigserial PRIMARY KEY, family_route_id bigint, activity_id integer, is_mandatory boolean);
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;  -- live: packaging_events.event_type is CITEXT (pg_typeof, 6514 rows), NOT an enum
CREATE TABLE public.packaging_events (id bigserial PRIMARY KEY, work_log_id bigint REFERENCES public.daily_work_log(id), event_type public.citext);
CREATE TABLE public.event_type_lkp (label public.citext PRIMARY KEY  -- label type NOT evidenced live; migrations compare with the SAME expression as the legacy trigger (label = event_type), so semantics match whichever it is
  , affects_bulk_stock numeric, is_packaging boolean, active boolean DEFAULT true);
CREATE TABLE public.event_skus (id bigserial PRIMARY KEY, packaging_event_id bigint REFERENCES public.packaging_events(id) ON DELETE CASCADE, sku_id bigint, "count" integer NOT NULL DEFAULT 0 CHECK ("count" >= 0));
CREATE TABLE public.fg_bulk_stock_ledger (id bigserial PRIMARY KEY, product_id integer NOT NULL REFERENCES public.products(id), batch_number text NOT NULL,
  movement_date date, qty numeric, qty_base numeric NOT NULL, uom text, reason_code text, source_table text, source_id integer,  -- live: integer
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
CREATE TRIGGER trg_fg_ledger_check_neg BEFORE INSERT ON public.fg_bulk_stock_ledger FOR EACH ROW EXECUTE FUNCTION public.fn_fg_ledger_check_negative();

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
CREATE FUNCTION public.fn_fg_force_close(p_product integer, p_bn text, p_sleep numeric) RETURNS numeric LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp' AS $$
DECLARE b numeric; BEGIN
  SELECT COALESCE(SUM(qty_base),0) INTO b FROM public.fg_bulk_stock_ledger WHERE product_id=p_product AND batch_number=p_bn;
  IF p_sleep > 0 THEN PERFORM pg_sleep(p_sleep); END IF;
  INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id)
  VALUES (p_product,p_bn,CURRENT_DATE,-b,-b,(SELECT uom_base FROM public.products WHERE id=p_product),'FORCE_CLOSE','manual',0);
  RETURN b; END $$;
CREATE FUNCTION public.trg_fg_bulk_internal_transfer_to_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp' AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    DELETE FROM public.fg_bulk_stock_ledger WHERE source_table='fg_bulk_internal_transfer' AND source_id=OLD.id; END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id,plant_id)
    VALUES (NEW.product_id,NEW.batch_number,CURRENT_DATE,-NEW.qty_base,-NEW.qty_base,'kg','TRANSFER_OUT','fg_bulk_internal_transfer',NEW.id,NEW.from_plant),
           (NEW.product_id,NEW.batch_number,CURRENT_DATE, NEW.qty_base, NEW.qty_base,'kg','TRANSFER_IN','fg_bulk_internal_transfer',NEW.id,NEW.to_plant); END IF;
  RETURN COALESCE(NEW,OLD); END $$;
CREATE TRIGGER trg_fg_bulk_internal_transfer AFTER INSERT OR UPDATE OR DELETE ON public.fg_bulk_internal_transfer FOR EACH ROW EXECUTE FUNCTION public.trg_fg_bulk_internal_transfer_to_ledger();

CREATE FUNCTION public.fn_fg_force_close(p_product integer, p_bn text) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','pg_temp' AS $$
BEGIN PERFORM public.require_permission('module:daily-work-log', true);  -- SHIM ASSUMPTION: live wrapper is permission-gated; target name not evidenced
  RETURN public.fn_fg_force_close(p_product, p_bn, 0); END $$;
GRANT EXECUTE ON FUNCTION public.fn_fg_force_close(integer,text) TO authenticated;
-- INVOKER (as live): DWL receipt trigger, auto-zero, helper.
CREATE FUNCTION public.trg_fg_ledger_from_dwl() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE pid int; BEGIN
  IF NEW.activity = 'FG bulk storage' AND coalesce(NEW.storage_qty,0) > 0 THEN
    SELECT id INTO pid FROM public.products WHERE item = NEW.item;
    INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id)
    VALUES (pid,NEW.batch_number,NEW.log_date,NEW.storage_qty,NEW.storage_qty,NEW.storage_qty_uom,'FG bulk storage','daily_work_log',NEW.id);
  END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_fg_ledger_from_dwl AFTER INSERT ON public.daily_work_log FOR EACH ROW EXECUTE FUNCTION public.trg_fg_ledger_from_dwl();
CREATE FUNCTION public.fn_fg_auto_zero(p_product integer, p_bn text, p_eps numeric) RETURNS numeric LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp' AS $$
DECLARE b numeric; BEGIN
  SELECT COALESCE(SUM(qty_base),0) INTO b FROM public.fg_bulk_stock_ledger WHERE product_id=p_product AND batch_number=p_bn;
  IF b <> 0 AND abs(b) <= p_eps THEN
    IF p_eps >= 1 THEN PERFORM pg_sleep(0.8); END IF;   -- test hook for read-before-write race
    INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id)
    VALUES (p_product,p_bn,CURRENT_DATE,-b,-b,'kg','AUTO_ZERO','manual',0); END IF; RETURN b; END $$;
CREATE FUNCTION public.fn_fg_ledger_add(p_product integer, p_bn text, p_qty numeric, p_reason text, p_src_id integer, p_src text, p_date date) RETURNS void LANGUAGE sql SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp' AS $$
  INSERT INTO public.fg_bulk_stock_ledger(product_id,batch_number,movement_date,qty,qty_base,uom,reason_code,source_table,source_id)
  VALUES (p_product,p_bn,p_date,p_qty,p_qty,'kg',p_reason,p_src,p_src_id) $$;

-- Live ACL shape (independent review): ledger_add / auto_zero EXECUTE for authenticated only; force_close(int,text,numeric) none; wrapper authenticated.
REVOKE ALL ON FUNCTION public.fn_fg_ledger_add(integer,text,numeric,text,integer,text,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_fg_ledger_add(integer,text,numeric,text,integer,text,date) TO authenticated;
REVOKE ALL ON FUNCTION public.fn_fg_auto_zero(integer,text,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_fg_auto_zero(integer,text,numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.fn_fg_force_close(integer,text,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_fg_force_close(integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_fg_force_close(integer,text) TO authenticated;

-- ===== Reconcile chain (live: independent review of PR #522 @ e938b557, READ ONLY) =====
-- fn_fg_reconcile_batch: SECURITY INVOKER, search_path pg_catalog,public,pg_temp, EXECUTE only postgres+service_role.
-- Reads batch balance, calls fn_fg_auto_zero within epsilon, then marks eligible FG worklogs Done behind a guarded
-- transaction-local flag. Called by three statement-level ledger triggers (INVOKER, authenticated EXECUTE).
-- BODIES ARE SHIM RECONSTRUCTIONS of the described behavior (live bodies not available); flag name/guard are assumptions.
CREATE FUNCTION public.fn_fg_reconcile_batch(p_product integer, p_bn text, p_eps numeric) RETURNS void LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp' AS $$
DECLARE b numeric; BEGIN
  SELECT COALESCE(SUM(qty_base),0) INTO b FROM public.fg_bulk_stock_ledger WHERE product_id=p_product AND batch_number=p_bn;
  IF b <> 0 AND abs(b) <= p_eps THEN PERFORM public.fn_fg_auto_zero(p_product, p_bn, p_eps);
    SELECT COALESCE(SUM(qty_base),0) INTO b FROM public.fg_bulk_stock_ledger WHERE product_id=p_product AND batch_number=p_bn; END IF;
  IF b = 0 THEN
    PERFORM set_config('mis.fg_reconcile', '1', true);
    UPDATE public.daily_work_log w SET status='Done' FROM public.products p
     WHERE p.id=p_product AND w.item=p.item AND w.batch_number=p_bn AND w.activity='FG bulk storage' AND w.status='In Storage';
    PERFORM set_config('mis.fg_reconcile', '', true);
  END IF; END $$;
CREATE FUNCTION public.trg_dwl_fg_done_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public','pg_temp' AS $$
BEGIN IF NEW.activity='FG bulk storage' AND NEW.status='Done' AND OLD.status IS DISTINCT FROM 'Done'
        AND coalesce(current_setting('mis.fg_reconcile', true), '') <> '1' THEN
  RAISE EXCEPTION 'FG bulk Done is set only by batch reconciliation'; END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_dwl_fg_done_guard BEFORE UPDATE OF status ON public.daily_work_log FOR EACH ROW EXECUTE FUNCTION public.trg_dwl_fg_done_guard();
CREATE FUNCTION public.trg_fg_ledger_reconcile_ins_stmt() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public','pg_temp' AS $$
DECLARE r record; BEGIN FOR r IN SELECT DISTINCT product_id, batch_number FROM new_rows LOOP
  PERFORM public.fn_fg_reconcile_batch(r.product_id, r.batch_number, 0.001); END LOOP; RETURN NULL; END $$;
CREATE FUNCTION public.trg_fg_ledger_reconcile_upd_stmt() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public','pg_temp' AS $$
DECLARE r record; BEGIN FOR r IN SELECT product_id, batch_number FROM new_rows UNION SELECT product_id, batch_number FROM old_rows LOOP
  PERFORM public.fn_fg_reconcile_batch(r.product_id, r.batch_number, 0.001); END LOOP; RETURN NULL; END $$;
CREATE FUNCTION public.trg_fg_ledger_reconcile_del_stmt() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'pg_catalog','public','pg_temp' AS $$
DECLARE r record; BEGIN FOR r IN SELECT DISTINCT product_id, batch_number FROM old_rows LOOP
  PERFORM public.fn_fg_reconcile_batch(r.product_id, r.batch_number, 0.001); END LOOP; RETURN NULL; END $$;
CREATE TRIGGER trg_fg_ledger_reconcile_ins_stmt AFTER INSERT ON public.fg_bulk_stock_ledger REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_fg_ledger_reconcile_ins_stmt();
CREATE TRIGGER trg_fg_ledger_reconcile_upd_stmt AFTER UPDATE ON public.fg_bulk_stock_ledger REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_fg_ledger_reconcile_upd_stmt();
CREATE TRIGGER trg_fg_ledger_reconcile_del_stmt AFTER DELETE ON public.fg_bulk_stock_ledger REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.trg_fg_ledger_reconcile_del_stmt();
REVOKE ALL ON FUNCTION public.fn_fg_reconcile_batch(integer,text,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_fg_reconcile_batch(integer,text,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.trg_fg_ledger_reconcile_ins_stmt(), public.trg_fg_ledger_reconcile_upd_stmt(), public.trg_fg_ledger_reconcile_del_stmt() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_fg_ledger_reconcile_ins_stmt(), public.trg_fg_ledger_reconcile_upd_stmt(), public.trg_fg_ledger_reconcile_del_stmt() TO authenticated;
-- governed old-client write path stand-in (live: rpc_update_daily_work_log_with_packaging is SECURITY DEFINER)
CREATE FUNCTION public.t_client_rpc(p_sql text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','pg_temp' AS $$
BEGIN EXECUTE p_sql; END $$;
GRANT EXECUTE ON FUNCTION public.t_client_rpc(text) TO authenticated;
