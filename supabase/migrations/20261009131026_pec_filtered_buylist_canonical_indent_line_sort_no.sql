DO $pec$
DECLARE
  definition text;
  revised text;
  old_field text := '''indent_line_id'', f.indent_line_id,';
  old_source text := 'from public.v_proc_indent_line_buylist_base b';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='proc_vendorwise_buylist_filtered_pec_internal'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_material_class_id bigint, p_rm_scope text, p_rate_status text, p_assignment_status text, p_q text'
    AND p.prosecdef;
  IF definition IS NULL
    OR position(old_field IN definition)=0
    OR position(old_source IN definition)=0
    OR position('select b.*' IN definition)=0
    OR position('indent_line_sort_no' IN definition)>0
  THEN RAISE EXCEPTION 'PEC function preconditions changed; no update applied'; END IF;
  revised := replace(definition, 'select b.*', 'select b.*, ordered.indent_line_sort_no');
  revised := replace(revised, old_source,
    'from public.v_proc_indent_line_buylist_base b JOIN public.v_proc_indent_lines_console_ordered ordered ON ordered.indent_line_id = b.indent_line_id');
  revised := replace(revised, old_field,
    old_field || E'\n          ''indent_line_sort_no'', f.indent_line_sort_no,');
  IF revised=definition THEN RAISE EXCEPTION 'No update generated'; END IF;
  EXECUTE revised;
END
$pec$;