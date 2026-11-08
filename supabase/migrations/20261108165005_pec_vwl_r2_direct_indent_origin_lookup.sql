-- EXACT live migration 20261108165005: pec_vwl_r2_direct_indent_origin_lookup
-- Minimal replacement of indent-origin lookup; preserves view column contract.
DO $vwl$
DECLARE
  olddef text := pg_get_viewdef('public.v_proc_indent_lines_console_ordered'::regclass, true);
  needle text := 'FROM v_proc_indent_console h';
  changed text;
  mismatches bigint;
BEGIN
  IF olddef IS NULL OR (length(olddef)-length(replace(olddef,needle,''))) <> length(needle) THEN
    RAISE EXCEPTION 'View definition match not unique: refusing migration';
  END IF;
  SELECT count(*) INTO mismatches
  FROM public.proc_indent_header h JOIN public.v_proc_indent_console c USING (indent_id)
  WHERE c.source_pr_id IS DISTINCT FROM h.source_pr_id;
  IF mismatches <> 0 THEN RAISE EXCEPTION 'Indent origin parity failed: %', mismatches; END IF;
  changed := replace(olddef,needle,'FROM proc_indent_header h');
  EXECUTE 'CREATE OR REPLACE VIEW public.v_proc_indent_lines_console_ordered AS ' || changed;
  IF pg_get_viewdef('public.v_proc_indent_lines_console_ordered'::regclass,true) NOT LIKE '%FROM proc_indent_header h%' THEN
    RAISE EXCEPTION 'Replacement not present';
  END IF;
END $vwl$;
