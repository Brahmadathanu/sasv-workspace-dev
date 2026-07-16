-- Fix trg_bpb_edit_guard to allow initial BMR mapping
-- The trigger was blocking ALL updates when bmr_id was involved,
-- but we need to allow setting bmr_id when it was previously NULL.
--
-- NOTE: Canonical live definition (incl. force-unlink GUC) is maintained in:
--   supabase/sql/2026-07-16_force_unlink_plan_batch.sql
-- Prefer applying that file in Supabase going forward.

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