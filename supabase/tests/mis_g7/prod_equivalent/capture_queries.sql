-- READ ONLY structural capture (no row data, no user identities, no credentials). Output: ONE JSON document on stdout.
-- Run by capture_live_baseline_READONLY.sh with default_transaction_read_only=on. The result is a LOCAL, PROTECTED packet: never commit it.
BEGIN READ ONLY;
SELECT jsonb_pretty(jsonb_build_object(
  'captured_at', clock_timestamp(),
  'server_version', current_setting('server_version'),
  'settings', jsonb_build_object('plpgsql.variable_conflict', current_setting('plpgsql.variable_conflict', true)),
  -- override sources only (role/database NAMES of settings, never values of business data)
  'db_role_settings', coalesce((SELECT jsonb_agg(jsonb_build_object('role', coalesce(r.rolname, '*'), 'database', coalesce(d.datname, '*'), 'config', s.setconfig))
                                  FROM pg_db_role_setting s LEFT JOIN pg_roles r ON r.oid = s.setrole LEFT JOIN pg_database d ON d.oid = s.setdatabase
                                 WHERE s.setconfig::text ILIKE '%plpgsql%' OR s.setconfig::text ILIKE '%search_path%'), '[]'::jsonb),
  'functions', coalesce((
    SELECT jsonb_agg(jsonb_build_object('identity', p.oid::regprocedure::text, 'schema', n.nspname, 'owner', pg_get_userbyid(p.proowner), 'acl', p.proacl::text[],
             'secdef', p.prosecdef, 'config', p.proconfig, 'sha256', encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex'), 'def', pg_get_functiondef(p.oid))
           ORDER BY p.oid::regprocedure::text)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.prokind = 'f' AND (
           -- explicit names (the pinned writers/reconcile chain, the DWL editor, guards, eps, permission resolver)
           (n.nspname = 'public' AND p.proname IN ('trg_fg_ledger_from_dwl','trg_fg_ledger_from_es','trg_fg_bulk_internal_transfer_to_ledger','fn_fg_auto_zero','fn_fg_ledger_add',
              'fn_fg_force_close','fn_fg_reconcile_batch','trg_fg_ledger_reconcile_ins_stmt','trg_fg_ledger_reconcile_upd_stmt','trg_fg_ledger_reconcile_del_stmt',
              'fn_fg_mark_done_if_zero','fn_fg_ledger_check_negative','fn_fg_eps_default','require_permission','rpc_update_daily_work_log_with_packaging',
              'rpc_update_daily_work_log_with_packaging__core','fn_parse_sku_breakdown'))
        OR (n.nspname = 'auth' AND p.proname IN ('uid','jwt','role'))
        OR -- anything in public/costing that touches the stock/packaging/permission tables (relevant, may be larger than the explicit list)
           (n.nspname IN ('public','costing') AND p.prosrc ~* '(fg_bulk_stock_ledger|event_skus|packaging_events|daily_work_log|user_permissions_canonical|event_type_lkp)')
        OR n.nspname = 'app_private')), '[]'::jsonb)
)) AS packet;
COMMIT;
