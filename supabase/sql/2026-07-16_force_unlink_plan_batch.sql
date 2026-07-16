-- Force-unlink a planned batch from its BMR (including when header is applied).
-- Apply in Supabase SQL editor before relying on the Supply Batch Plan UI.
--
-- 1) Extend trg_bpb_edit_guard to honor transaction-local GUC app.allow_force_unlink=1
--    only for mapping-clear updates (bmr_id -> NULL) that do not change structure.
-- 2) Create force_unlink_plan_batch(p_batch_id, p_reason) and grant EXECUTE.

CREATE OR REPLACE FUNCTION public.trg_bpb_edit_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
  v_force_unlink boolean := false;
BEGIN
  BEGIN
    v_force_unlink := current_setting('app.allow_force_unlink', true) = '1';
  EXCEPTION WHEN OTHERS THEN
    v_force_unlink := false;
  END;

  SELECT status INTO v_status
  FROM public.batch_plan_headers
  WHERE id = COALESCE(NEW.header_id, OLD.header_id);

  -- Force-unlink exception: allow clearing bmr_id even when applied,
  -- but only when GUC is set and the update is mapping-clear only.
  IF v_force_unlink
     AND TG_OP = 'UPDATE'
     AND OLD.bmr_id IS NOT NULL
     AND NEW.bmr_id IS NULL
     AND NEW.batch_size IS NOT DISTINCT FROM OLD.batch_size
     AND NEW.product_id IS NOT DISTINCT FROM OLD.product_id
     AND NEW.month_start IS NOT DISTINCT FROM OLD.month_start
  THEN
    RETURN NEW;
  END IF;

  IF v_status = 'applied' THEN
    RAISE EXCEPTION 'Batch plan header % is applied (read-only)', COALESCE(NEW.header_id, OLD.header_id)
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.bmr_id IS NOT NULL THEN
      RAISE EXCEPTION 'Planned batch % is already mapped to a BMR (read-only)', OLD.id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.bmr_id IS NOT NULL THEN
      IF NEW.bmr_id IS NOT NULL AND NEW.bmr_id <> OLD.bmr_id THEN
        RAISE EXCEPTION 'Planned batch % is already mapped to BMR % (cannot remap to %)',
          NEW.id, OLD.bmr_id, NEW.bmr_id
          USING ERRCODE = '23514';
      END IF;

      IF NEW.batch_size IS DISTINCT FROM OLD.batch_size
         OR NEW.product_id IS DISTINCT FROM OLD.product_id
         OR NEW.month_start IS DISTINCT FROM OLD.month_start THEN
        RAISE EXCEPTION 'Mapped batch % cannot be structurally edited', NEW.id
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.force_unlink_plan_batch(
  p_batch_id bigint,
  p_reason text
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_bmr_id bigint;
  v_product_id bigint;
  v_bn text;
  v_wip_cnt int;
  v_reason text;
  v_stamp text;
  v_notes text;
BEGIN
  v_reason := trim(coalesce(p_reason, ''));
  IF length(v_reason) < 3 THEN
    RAISE check_violation USING MESSAGE = 'Reason is required (at least 3 characters)';
  END IF;

  SELECT b.bmr_id, b.product_id, b.notes, d.bn
    INTO v_bmr_id, v_product_id, v_notes, v_bn
  FROM public.batch_plan_batches b
  LEFT JOIN public.bmr_details d ON d.id = b.bmr_id
  WHERE b.id = p_batch_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE check_violation USING MESSAGE = 'Batch not found';
  END IF;

  IF v_bmr_id IS NULL THEN
    RAISE check_violation USING MESSAGE = 'Batch is not mapped to a BMR';
  END IF;

  IF v_bn IS NOT NULL THEN
    SELECT COUNT(*) INTO v_wip_cnt
    FROM public.v_wip_batches w
    WHERE w.product_id = v_product_id
      AND w.batch_number = v_bn;

    IF v_wip_cnt > 0 THEN
      RAISE check_violation USING MESSAGE = 'BN is already in WIP; unlink blocked';
    END IF;
  END IF;

  v_stamp := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    || ' [force-unlink] ' || v_reason;
  IF v_notes IS NULL OR length(trim(v_notes)) = 0 THEN
    v_notes := v_stamp;
  ELSE
    v_notes := v_notes || E'\n' || v_stamp;
  END IF;

  PERFORM set_config('app.allow_force_unlink', '1', true);

  UPDATE public.batch_plan_batches
     SET bmr_id = NULL,
         bmr_linked_at = NULL,
         bmr_linked_by = NULL,
         notes = v_notes,
         updated_at = NOW()
   WHERE id = p_batch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_unlink_plan_batch(bigint, text) TO anon;
GRANT EXECUTE ON FUNCTION public.force_unlink_plan_batch(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_unlink_plan_batch(bigint, text) TO service_role;

COMMENT ON FUNCTION public.force_unlink_plan_batch(bigint, text) IS
  'Clear bmr_id on one planned batch (draft/submitted/applied). Requires reason. Blocks WIP. Uses app.allow_force_unlink GUC for applied headers.';
