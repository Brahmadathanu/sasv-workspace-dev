-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_view text;
  v_before text;
  v_after text;
  r record;
begin
  -- Future frozen issue vocabulary.
  select pg_get_viewdef('costing.v_frozen_material_costing_issue_lines'::regclass, true) into v_view;
  v_before := v_view;

  v_view := regexp_replace(
    v_view,
    'WHEN r\.rate_warning_code IS NOT NULL THEN r\.rate_warning_code',
    'WHEN r.action_required = ''OPTIONAL_MISSING_RATE''::text THEN ''OPTIONAL_RM_RATE_MISSING''::text WHEN r.rate_warning_code IS NOT NULL THEN r.rate_warning_code',
    'g'
  );
  if v_view = v_before then raise exception 'RM material issue vocabulary patch did not match'; end if;

  v_before := v_view;
  v_view := regexp_replace(
    v_view,
    'WHEN r\.rate_warning_code = ''MANUAL_RATE_USED''::text THEN ''RM_MANUAL_RATE_USED''::text([[:space:]]+)ELSE COALESCE\(r\.calculation_warning_code, NULLIF\(r\.action_required, ''OK''::text\)\)',
    'WHEN r.rate_warning_code = ''MANUAL_RATE_USED''::text THEN ''RM_MANUAL_RATE_USED''::text\1WHEN r.action_required = ''OPTIONAL_MISSING_RATE''::text THEN ''OPTIONAL_RM_RATE_MISSING''::text\1ELSE COALESCE(r.calculation_warning_code, NULLIF(r.action_required, ''OK''::text))',
    'g'
  );
  if v_view = v_before then raise exception 'RM acceptance vocabulary patch did not match'; end if;

  execute 'create or replace view costing.v_frozen_material_costing_issue_lines as ' || v_view;

  -- Both overloads: canonical exact match, plus legacy Run101 generic optional-RM code only.
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='costing' and p.proname='fn_build_product_rm_cost_as_of'
  loop
    v_before := r.def;
    v_after := regexp_replace(
      v_before,
      'coalesce\(ar\.issue_codes,[[:space:]]*''''\)[[:space:]]*=[[:space:]]*coalesce\([[:space:]]*lc\.acceptance_issue_codes,[[:space:]]*''''[[:space:]]*\)',
      '(coalesce(ar.issue_codes,'''')=coalesce(lc.acceptance_issue_codes,'''') OR (lc.acceptance_action_required_summary=''OPTIONAL_MISSING_RATE'' AND lc.acceptance_issue_codes=''OPTIONAL_RM_RATE_MISSING'' AND ar.issue_codes=''MISSING_MATERIAL_RATE''))',
      'g'
    );
    if v_after = v_before then
      raise exception 'RM acceptance matcher patch did not match function oid %', r.oid;
    end if;
    execute v_after;
  end loop;
end $$;