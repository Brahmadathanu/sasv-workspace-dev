-- Consolidate RPC overloads for map_batch_to_bmr_by_bn and fix RAISE usage
-- Action: Drop duplicate signatures and keep a single canonical BIGINT version
-- Also, use a valid condition (check_violation) or SQLSTATE '23514' when raising validation errors

-- 1) Inspect existing function signatures (run in your DB):
-- SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE p.proname = 'map_batch_to_bmr_by_bn';

-- 2) Drop conflicting overload(s) safely if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'map_batch_to_bmr_by_bn'
      AND pg_get_function_identity_arguments(p.oid) = 'p_batch_id integer, p_bn text'
  ) THEN
    EXECUTE 'DROP FUNCTION public.map_batch_to_bmr_by_bn(p_batch_id integer, p_bn text)';
  END IF;
END$$;

-- 3) Create or replace the canonical BIGINT version
-- Pattern cloned from map_plan_batch_to_bnr_by_bn (correct implementation)
CREATE OR REPLACE FUNCTION public.map_batch_to_bmr_by_bn(
  p_batch_id bigint,
  p_bn text
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_prod_id   bigint;
  v_size      numeric;
  v_from      date;
  v_to        date;
  v_pick_id   bigint;
  v_eps       numeric := 1e-6;
  v_wip_cnt   int;
BEGIN
  -- Read batch + plan window
  SELECT b.product_id, b.batch_size, h.window_from, h.window_to
    INTO v_prod_id, v_size, v_from, v_to
  FROM public.batch_plan_batches b
  JOIN public.batch_plan_headers h ON h.id = b.header_id
  WHERE b.id = p_batch_id;

  IF v_prod_id IS NULL THEN
    RAISE SQLSTATE '23514' USING MESSAGE = 'Batch not found';
  END IF;

  -- Choose an eligible BMR from bmr_card_not_initiated view
  SELECT x.bmr_id
    INTO v_pick_id
  FROM public.bmr_card_not_initiated x
  WHERE x.product_id = v_prod_id
    AND x.bn = p_bn
    AND x.created_at::date BETWEEN v_from AND v_to
    AND ABS(COALESCE(x.batch_size,0) - COALESCE(v_size,0)) <= v_eps
  ORDER BY x.created_at
  LIMIT 1;

  IF v_pick_id IS NULL THEN
    RAISE SQLSTATE '23514' USING MESSAGE = 'BN not eligible for this batch in the plan window';
  END IF;

  -- WIP guard: ensure BN isn't already in WIP
  SELECT COUNT(*) INTO v_wip_cnt
  FROM public.v_wip_batches w
  WHERE w.product_id = v_prod_id
    AND w.batch_number = p_bn;

  IF v_wip_cnt > 0 THEN
    RAISE SQLSTATE '23514' USING MESSAGE = 'BN is already in WIP; mapping blocked';
  END IF;

  -- Ensure this BMR isn't already mapped to another batch
  IF EXISTS (
    SELECT 1 FROM public.batch_plan_batches
    WHERE bmr_id = v_pick_id AND id <> p_batch_id
  ) THEN
    RAISE SQLSTATE '23514' USING MESSAGE = 'This BMR is already mapped to another batch';
  END IF;

  -- Write mapping (uq_bpb_bmr unique constraint on bmr_id prevents reuse)
  UPDATE public.batch_plan_batches
     SET bmr_id = v_pick_id, updated_at = NOW()
   WHERE id = p_batch_id;
END;
$$;
