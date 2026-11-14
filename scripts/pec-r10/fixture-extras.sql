-- PEC fixture extras (F2/F4): additional SYNTHETIC rows and invariant helpers. NEVER production.
-- Loaded after fixture-schema.sql by lib.sh. Every id is synthetic.
\set ON_ERROR_STOP on

-- Global no-change fingerprint of every PEC business table, optionally excluding indents under test.
CREATE FUNCTION public.fx_global_md5(p_exclude bigint[] DEFAULT '{}'::bigint[]) RETURNS text LANGUAGE sql AS $$
  SELECT md5(
    coalesce((SELECT string_agg(concat_ws('|',indent_id,status,coalesce(source_pr_id::text,'-')),';' ORDER BY indent_id)
              FROM public.proc_indent_header WHERE indent_id <> ALL(p_exclude)),'')
    || '#' || coalesce((SELECT string_agg(concat_ws('|',indent_line_id,indent_id,material_class_id,stock_item_id,uom_id,requested_qty,coalesce(manual_reason,'~')),';' ORDER BY indent_line_id)
              FROM public.proc_indent_line WHERE indent_id <> ALL(p_exclude)),'')
    || '#' || coalesce((SELECT string_agg(concat_ws('|',indent_id,indent_line_id,pr_id,pr_line_id),';' ORDER BY indent_line_id)
              FROM public.proc_pr_indent_line_map WHERE indent_id <> ALL(p_exclude)),'')
    || '#' || coalesce((SELECT string_agg(concat_ws('|',map_id,pr_id,indent_id,is_active,coalesce(note,'~')),';' ORDER BY map_id)
              FROM public.proc_pr_to_indent_map WHERE indent_id <> ALL(p_exclude)),'')
    || '#' || coalesce((SELECT string_agg(concat_ws('|',pr_id,status),';' ORDER BY pr_id) FROM public.proc_pr_header),'')
    || '#' || coalesce((SELECT string_agg(concat_ws('|',pr_line_id,pr_id,requested_qty,coalesce(manual_delta_qty::text,'~'),coalesce(manual_reason,'~')),';' ORDER BY pr_line_id)
              FROM public.proc_pr_line),''))
$$;

-- Permission/ACL fingerprint: function ACLs + SECURITY DEFINER flag, table/view ACLs, policy count.
CREATE FUNCTION public.fx_acl_md5() RETURNS text LANGUAGE sql AS $$
  SELECT md5(
    coalesce((SELECT string_agg(p.oid::regprocedure::text || '=' || coalesce(p.proacl::text,'null') || '/' || p.prosecdef::text, ';' ORDER BY p.oid::regprocedure::text)
              FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname NOT LIKE 'fx\_%'),'')
    || '#' || coalesce((SELECT string_agg(c.relname || '=' || coalesce(c.relacl::text,'null'), ';' ORDER BY c.relname)
              FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','v')),'')
    || '#' || (SELECT count(*)::text FROM pg_policy))
$$;

-- Dry-run helper: runs one statement, rolls its effects back, returns 'OK' or 'SQLSTATE:message'.
CREATE FUNCTION public.fx_try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'fx_try_rollback' USING ERRCODE = 'ZX001';
EXCEPTION
  WHEN SQLSTATE 'ZX001' THEN RETURN 'OK';
  WHEN OTHERS THEN RETURN SQLSTATE || ':' || SQLERRM;
END $$;

-- Rebuild one indent as a single line (unmapped or mapped) for the collision grid.
CREATE FUNCTION public.fx_grid_state(p_indent bigint, p_item bigint, p_qty numeric, p_reason text, p_mapped boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_line bigint; v_pr bigint; v_prline bigint;
BEGIN
  DELETE FROM public.proc_pr_indent_line_map WHERE indent_id = p_indent;
  DELETE FROM public.proc_indent_line WHERE indent_id = p_indent;
  SELECT source_pr_id INTO v_pr FROM public.proc_indent_header WHERE indent_id = p_indent;
  INSERT INTO public.proc_indent_line(indent_id, material_class_id, stock_item_id, uom_id, requested_qty, manual_reason)
    VALUES (p_indent, 1, p_item, 1, p_qty, p_reason) RETURNING indent_line_id INTO v_line;
  IF p_mapped THEN
    SELECT pr_line_id INTO v_prline FROM public.proc_pr_line
     WHERE pr_id = v_pr AND material_class_id = 1 AND stock_item_id = p_item AND uom_id = 1;
    INSERT INTO public.proc_pr_indent_line_map(indent_id, indent_line_id, pr_id, pr_line_id) VALUES (p_indent, v_line, v_pr, v_prline);
  END IF;
END $$;

-- Seed additions (call after public.fx_seed()).
CREATE FUNCTION public.fx_seed_extra() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.proc_pr_header(pr_id, status) VALUES (500, 'active');
  INSERT INTO public.proc_pr_line(pr_line_id, pr_id, material_class_id, stock_item_id, uom_id, requested_qty, manual_delta_qty, manual_reason) OVERRIDING SYSTEM VALUE VALUES
    (5001, 500, 1, 11, 1, 3, 0, NULL),
    (5002, 500, 1, 14, 1, 2, 0, 'PR500 14'),
    (5003, 500, 1, 13, 1, 6, 0, 'PR500 13');
  INSERT INTO public.proc_indent_header(indent_id, status, source_pr_id) VALUES
    (14, 'draft', 500),      -- pure adopt: matching unmapped line plus an independent manual line
    (20, 'approved', 100),   -- negative / sentinel
    (21, 'issued', 100),
    (22, 'closed', 100),
    (23, 'draft', NULL),     -- draft MANUAL indent: positive Add Line
    (40, 'draft', 100),      -- collision grid against PR 100 / item 13 (final 4, reason 'PR 13')
    (41, 'draft', 500);      -- collision grid against PR 500 / item 11 (final 3, reason NULL)
  INSERT INTO public.proc_indent_line(indent_line_id, indent_id, material_class_id, stock_item_id, uom_id, requested_qty, manual_reason) OVERRIDING SYSTEM VALUE VALUES
    (1401, 14, 1, 11, 1, 3, NULL),
    (1402, 14, 1, 80, 1, 2, 'manual independent'),
    (2001, 20, 1, 11, 1, 2, 'approved row'),
    (2002, 20, 1, 13, 1, 9, 'approved row'),
    (2101, 21, 1, 11, 1, 2, 'issued row'),
    (2201, 22, 1, 11, 1, 2, 'closed row'),
    (2301, 23, 1, 11, 1, 2, 'manual a'),
    (2302, 23, 1, 80, 1, 3, 'manual b'),
    (4001, 40, 1, 13, 1, 4, 'PR 13'),
    (4101, 41, 1, 11, 1, 3, NULL);
  INSERT INTO public.proc_pr_to_indent_map(pr_id, indent_id, is_active, note) VALUES
    (100, 20, true, 'approved link'), (100, 21, true, 'issued link'), (500, 14, true, 'link'),
    (100, 40, true, 'grid'), (500, 41, true, 'grid');
END $$;
