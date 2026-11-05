-- PEC: preserve insertion order for manual indents; preserve existing PR-origin ordering.
-- Applied to live Supabase as migration 20261105091814.
-- Dynamic, exact-match guarded replacement retains the complete live view column contract,
-- dependent view compatibility, security grants and non-ordering logic.
do $pec_manual_indent_order$
declare
  current_def text;
  old_case text := 'WHEN b.source_pr_line_sort_key IS NOT NULL THEN b.source_pr_line_sort_key';
  new_case text := $replacement$WHEN (SELECT h.source_pr_id FROM public.v_proc_indent_console h WHERE h.indent_id = b.indent_id) IS NULL
                        THEN concat_ws(' | ', 'MANUAL_INSERTION', lpad(b.indent_line_id::text, 20, '0'))
                    WHEN b.source_pr_line_sort_key IS NOT NULL THEN b.source_pr_line_sort_key$replacement$;
begin
  current_def := pg_get_viewdef('public.v_proc_indent_lines_console_ordered'::regclass, true);
  if current_def is null or strpos(current_def, old_case) = 0 then
    raise exception 'PEC indent ordering source definition does not match the reviewed baseline';
  end if;
  if (length(current_def) - length(replace(current_def, old_case, ''))) <> length(old_case) then
    raise exception 'PEC indent ordering source match is not unique';
  end if;
  execute 'create or replace view public.v_proc_indent_lines_console_ordered as ' ||
          replace(current_def, old_case, new_case);
end;
$pec_manual_indent_order$;
