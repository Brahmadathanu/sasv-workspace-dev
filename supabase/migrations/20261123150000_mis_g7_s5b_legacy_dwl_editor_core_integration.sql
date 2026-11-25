-- MIS G7 S5b: minimal protected integration of the governed legacy DWL editor core with the S5 primitives.
-- OWNER-GATED, NOT INSTALLED. Requires S5 (…145000). Generated from the EXACT live source retained in
-- docs/executive-mis-g7-server/LIVE_DWL_EDITOR_REFERENCE_ONLY_20261124.md; the ONLY differences from the live core are three inserted
-- lines (see docs/executive-mis-g7-server/LIVE_DWL_EDITOR_CORE_S5_PATCH.diff):
--   0. #variable_conflict use_column   function-local plpgsql directive (first body line). The live core has an OUT column named
--      packaging_event_id AND an unqualified reference to the event_skus column of that name; under the server default
--      plpgsql.variable_conflict = error that statement raises 'column reference is ambiguous'. The directive resolves it to the column
--      (the evident intent, and what the code does under use_column) WITHOUT any server/database/role setting change.
--      OWNER DECISION: where the live default is `error`, chain replacement/removal on an EXISTING chain currently RAISES; with this
--      patch it works as written. The wrapper is unaffected (it compiles/runs under `error`).
--   1. PERFORM app_private.mis_g7_chain_replace_begin(p_id, p_item, p_batch_number);   right after the row lock/NOT FOUND check, before ANY write
--      (the edit's NEW item/batch are passed so both identities are locked in one canonical order)
--   2. PERFORM app_private.mis_g7_chain_replace_finish(p_id);  before the early 'no packaging chain' RETURN
--   3. PERFORM app_private.mis_g7_chain_replace_finish(p_id);  before the final RETURN
-- The wrapper (rpc_update_daily_work_log_with_packaging, sha256 4c82b4a3…d7b4: permission check, FG source-quantity corrections, GUC flags,
-- reconcile) and the SKU parser (fn_parse_sku_breakdown, sha256 ec5fe3ea…29db: sku_breakdown grammar) are NOT touched. Signature, return type,
-- SECURITY DEFINER, search_path, owner and ACL are unchanged (CREATE OR REPLACE with an identical header).
-- Fail closed: the install refuses unless the live core, wrapper and parser still hash to the reviewed values, and refuses (rolls back) if the
-- resulting patched core does not hash to the pinned patched value. After install ENFORCE is STILL refused until the owner records a sign-off
-- for that exact patched SHA (mis_g7_record_core_migration_acceptance_v1, module:mis-g7-core-migration-signoff).
CREATE TABLE IF NOT EXISTS app_private.mis_g7_s5b_baseline (
  obj text PRIMARY KEY, def text NOT NULL, def_sha text NOT NULL, captured_at timestamptz NOT NULL DEFAULT clock_timestamp());
DROP TRIGGER IF EXISTS mis_g7_s5b_baseline_append_only ON app_private.mis_g7_s5b_baseline;
CREATE TRIGGER mis_g7_s5b_baseline_append_only BEFORE UPDATE OR DELETE ON app_private.mis_g7_s5b_baseline
  FOR EACH ROW EXECUTE FUNCTION app_private.mis_g7_append_only_guard();
ALTER TABLE app_private.mis_g7_s5b_baseline ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.mis_g7_s5b_baseline FROM PUBLIC, anon, authenticated;

DO $$
DECLARE v_core oid := to_regprocedure('public.rpc_update_daily_work_log_with_packaging__core(bigint,date,integer,integer,integer,integer,text,text,numeric,text,text,text,text,integer,text,text,text,date,date,text,date,numeric,text,text,text,text,numeric,text,numeric,text)'); v_bad text;
BEGIN
  IF v_core IS NULL THEN RAISE EXCEPTION 'MIS_G7_S5B: live core missing; refusing'; END IF;
  IF to_regprocedure('app_private.mis_g7_chain_replace_begin(bigint,text,text)') IS NULL OR to_regprocedure('app_private.mis_g7_chain_replace_finish(bigint)') IS NULL THEN
    RAISE EXCEPTION 'MIS_G7_S5B: S5 primitives missing; apply S5 first'; END IF;
  SELECT string_agg(x.n || ' live=' || x.live, '; ') INTO v_bad FROM (
    SELECT p.proname AS n, encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex') AS live,
           CASE p.proname WHEN 'rpc_update_daily_work_log_with_packaging__core' THEN 'df7290df4a17e4af9f0aed43cf564007a35b957d8899b98869d7d35531296aec'
                          WHEN 'rpc_update_daily_work_log_with_packaging' THEN '4c82b4a3263f3f868e8ac4dc696f5b68efd58e593fe4adb4d92a7ec7fb1bd7b4'
                          WHEN 'fn_parse_sku_breakdown' THEN 'ec5fe3ead3e839d4ccad6c9f7e37c5775e1299c0b46ad71cc9a6b9eb7c5b29db' END AS want
      FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('rpc_update_daily_work_log_with_packaging__core','rpc_update_daily_work_log_with_packaging','fn_parse_sku_breakdown')) x
   WHERE x.live <> x.want;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'MIS_G7_S5B: live editor definitions changed since review: %', v_bad; END IF;
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('rpc_update_daily_work_log_with_packaging__core','rpc_update_daily_work_log_with_packaging','fn_parse_sku_breakdown')) <> 3 THEN
    RAISE EXCEPTION 'MIS_G7_S5B: unexpected overloads of the live editor functions; refusing'; END IF;
  IF has_function_privilege('authenticated', v_core, 'EXECUTE') OR has_function_privilege('anon', v_core, 'EXECUTE') THEN
    RAISE EXCEPTION 'MIS_G7_S5B: core is client-executable; unexpected state'; END IF;
  INSERT INTO app_private.mis_g7_s5b_baseline (obj, def, def_sha)
  SELECT 'public.rpc_update_daily_work_log_with_packaging__core(bigint,date,integer,integer,integer,integer,text,text,numeric,text,text,text,text,integer,text,text,text,date,date,text,date,numeric,text,text,text,text,numeric,text,numeric,text)', pg_get_functiondef(v_core), encode(sha256(convert_to(pg_get_functiondef(v_core), 'UTF8')), 'hex') ON CONFLICT (obj) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.rpc_update_daily_work_log_with_packaging__core(p_id bigint, p_log_date date, p_section_id integer, p_subsection_id integer, p_area_id integer, p_plant_id integer, p_item text, p_batch_number text, p_batch_size numeric, p_batch_uom text, p_activity text, p_juice_or_decoction text, p_specify text, p_count_of_saravam integer, p_fuel text, p_fuel_under text, p_fuel_over text, p_started_on date, p_due_date date, p_status text, p_completed_on date, p_qty_after_process numeric, p_qty_uom text, p_remarks text, p_lab_ref_number text, p_sku_breakdown text, p_storage_qty numeric, p_storage_qty_uom text, p_rm_juice_qty numeric, p_rm_juice_uom text)
 RETURNS TABLE(daily_work_log_id bigint, packaging_event_id bigint, inserted_event_sku_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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

  /* MIS G7 S5: protected packaging-chain replacement. begin = batch locks (old + new identity, canonical order) + work-log-scoped
     ticket + chain snapshot, taken before the first write; finish (below, before every RETURN) verifies signed FG stage and FG stock
     conservation. */
  PERFORM app_private.mis_g7_chain_replace_begin(p_id, p_item, p_batch_number);

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

    PERFORM app_private.mis_g7_chain_replace_finish(p_id);   -- MIS G7 S5

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
  PERFORM app_private.mis_g7_chain_replace_finish(p_id);   -- MIS G7 S5

  RETURN QUERY
  SELECT p_id, v_new_packaging_event_id, v_inserted_count;
END;
$function$;

DO $$
DECLARE v_core oid := to_regprocedure('public.rpc_update_daily_work_log_with_packaging__core(bigint,date,integer,integer,integer,integer,text,text,numeric,text,text,text,text,integer,text,text,text,date,date,text,date,numeric,text,text,text,text,numeric,text,numeric,text)'); v_sha text;
BEGIN
  v_sha := encode(sha256(convert_to(pg_get_functiondef(v_core), 'UTF8')), 'hex');
  IF v_sha <> 'dfa5a5e9aa31b48cf41fe9d03800fff2e35e5a3825ca458b5ccb6ca6c4471bcc' THEN RAISE EXCEPTION 'MIS_G7_S5B: patched core hash % does not match the reviewed patched hash', v_sha; END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_core) OR has_function_privilege('authenticated', v_core, 'EXECUTE') OR has_function_privilege('anon', v_core, 'EXECUTE') THEN
    RAISE EXCEPTION 'MIS_G7_S5B: core security attributes changed unexpectedly'; END IF;
END $$;
