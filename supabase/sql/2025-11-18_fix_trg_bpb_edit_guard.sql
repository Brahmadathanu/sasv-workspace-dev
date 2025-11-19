-- Fix trg_bpb_edit_guard to allow initial BMR mapping
-- The trigger was blocking ALL updates when bmr_id was involved,
-- but we need to allow setting bmr_id when it was previously NULL.

CREATE OR REPLACE FUNCTION public.trg_bpb_edit_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
BEGIN
  -- Block any change if header is applied
  SELECT status INTO v_status
  FROM public.batch_plan_headers
  WHERE id = COALESCE(NEW.header_id, OLD.header_id);

  IF v_status = 'applied' THEN
    RAISE EXCEPTION 'Batch plan header % is applied (read-only)', COALESCE(NEW.header_id, OLD.header_id)
      USING ERRCODE = '23514';
  END IF;

  -- For DELETE: if already mapped to a BMR, disallow deletion
  IF TG_OP = 'DELETE' THEN
    IF OLD.bmr_id IS NOT NULL THEN
      RAISE EXCEPTION 'Planned batch % is already mapped to a BMR (read-only)', OLD.id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- For UPDATE: allow initial mapping (NULL -> value) but block re-mapping or structural edits
  IF TG_OP = 'UPDATE' THEN
    -- If batch was already mapped, block structural changes and re-mapping
    IF OLD.bmr_id IS NOT NULL THEN
      -- Block re-mapping to a different BMR
      IF NEW.bmr_id IS NOT NULL AND NEW.bmr_id <> OLD.bmr_id THEN
        RAISE EXCEPTION 'Planned batch % is already mapped to BMR % (cannot remap to %)', 
          NEW.id, OLD.bmr_id, NEW.bmr_id
          USING ERRCODE = '23514';
      END IF;
      
      -- Block structural changes on mapped batches
      IF NEW.batch_size <> OLD.batch_size
         OR NEW.product_id <> OLD.product_id
         OR NEW.month_start <> OLD.month_start THEN
        RAISE EXCEPTION 'Mapped batch % cannot be structurally edited', NEW.id
          USING ERRCODE = '23514';
      END IF;
    END IF;
    -- Note: Initial mapping (OLD.bmr_id IS NULL, NEW.bmr_id IS NOT NULL) is now allowed
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;