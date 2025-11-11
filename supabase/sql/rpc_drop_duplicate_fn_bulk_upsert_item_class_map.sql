-- Use this script to drop the overloaded variant that includes p_mode if present.
-- Adjust the argument types if they differ in your schema.
-- RUN IN SQL CONSOLE (not executed automatically here).

DO $$
BEGIN
  -- Try dropping version with p_mode if it exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_bulk_upsert_item_class_map'
      AND pg_get_functiondef(p.oid) LIKE '%p_mode%'
  ) THEN
    EXECUTE 'DROP FUNCTION public.fn_bulk_upsert_item_class_map(jsonb, text, boolean)';
  END IF;
END $$;
