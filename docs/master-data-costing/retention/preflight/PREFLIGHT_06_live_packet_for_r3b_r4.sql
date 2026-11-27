-- READ-ONLY live packet for R3B manifest pins, R4 allowlist seed and index decisions. Run on production as a read-only role; send the output back.
-- Nothing here writes or locks beyond catalog reads. Relation row counts are planner estimates (reltuples), never count(*).
\echo '== A. exact-run reader candidates: signature, language, security mode, md5 of live definition (these become read_guard_manifest.expected_md5), anchors'
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) identity_args,l.lanname,p.prosecdef,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,
  md5(pg_get_functiondef(p.oid)) def_md5,
  (SELECT count(*) FROM regexp_matches(pg_get_functiondef(p.oid),'perform\s+public\.require_permission','gi')) permission_calls,
  (SELECT count(*) FROM regexp_matches(pg_get_functiondef(p.oid),E'^[ \t]*begin[ \t]*\r?$','gim')) begin_lines,
  pg_get_functiondef(p.oid) ~ E'\r' has_crlf, pg_get_functiondef(p.oid) ~* 'fn_assert_run_details' already_guarded
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
WHERE n.nspname IN ('public','costing') AND 'p_refresh_run_id'=ANY(p.proargnames)
  AND p.proname ~ '^(rpc_get_|rpc_export_|rpc_preview_|fn_resolve_.*selected_run|fn_product_sku_readiness|fn_production_route_pipeline_status)'
ORDER BY 1,2;
\echo '== B. every relation directly linked to a run header: columns, FK, run-column index, size, estimated rows, triggers, keyless'
SELECT n.nspname,c.relname,a.attname run_column,con.conname fk,con.confdeltype on_delete,array_length(con.conkey,1) fk_cols,
  EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.oid AND i.indisvalid AND i.indkey[0]=con.conkey[1]) run_col_indexed,
  pg_size_pretty(pg_total_relation_size(c.oid)) allocated,c.reltuples::bigint est_rows,
  NOT EXISTS(SELECT 1 FROM pg_constraint pk WHERE pk.contype='p' AND pk.conrelid=c.oid) keyless,
  (SELECT string_agg(t.tgname,',' ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal AND t.tgenabled<>'D') triggers,
  (SELECT count(*) FROM pg_constraint x WHERE x.contype='f' AND x.confrelid=c.oid) inbound_fks,
  obj_description(c.oid) table_comment
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=con.conkey[1]
WHERE con.contype='f' AND con.confrelid='costing.costing_refresh_run'::regclass ORDER BY pg_total_relation_size(c.oid) DESC;
\echo '== C. nested foreign keys whose PARENT is run-linked: child, parent, leading child index, child size/rows (index candidates)'
SELECT cn.nspname||'.'||cc.relname child,k.conname,pn.nspname||'.'||pc.relname parent,
  EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=cc.oid AND i.indisvalid AND i.indkey[0]=k.conkey[1]) child_leading_index,
  pg_size_pretty(pg_total_relation_size(cc.oid)) child_size,cc.reltuples::bigint child_est_rows,pc.reltuples::bigint parent_est_rows,
  k.confdeltype on_delete,array_length(k.conkey,1) fk_cols
FROM pg_constraint k JOIN pg_class cc ON cc.oid=k.conrelid JOIN pg_namespace cn ON cn.oid=cc.relnamespace JOIN pg_class pc ON pc.oid=k.confrelid JOIN pg_namespace pn ON pn.oid=pc.relnamespace
WHERE k.contype='f' AND k.confrelid<>'costing.costing_refresh_run'::regclass
  AND k.confrelid IN (SELECT conrelid FROM pg_constraint WHERE contype='f' AND confrelid='costing.costing_refresh_run'::regclass)
ORDER BY pg_total_relation_size(cc.oid) DESC;
\echo '== D. non-FK consumers: functions/views that mention a run-linked relation, flagged writer vs reader (writers: rpc_refresh_*, fn_apply_*, proc_*)'
WITH rel AS (SELECT DISTINCT c.relname FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid WHERE con.contype='f' AND con.confrelid='costing.costing_refresh_run'::regclass)
SELECT r.relname,'function' kind,n.nspname||'.'||p.proname obj,(p.proname ~ '^(rpc_refresh_|fn_apply_|proc_)') is_writer
FROM rel r JOIN pg_proc p ON pg_get_functiondef(p.oid) ~ ('\m'||r.relname||'\M') JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','costing') AND p.prokind='f'
UNION ALL
SELECT r.relname,'view',v.oid::regclass::text,false FROM rel r JOIN pg_class v ON v.relkind IN ('v','m') AND pg_get_viewdef(v.oid) ~ ('\m'||r.relname||'\M')
ORDER BY 1,2,3;
\echo '== E. verification evidence: successful governed runs and whether a captured fingerprint exists (UNVERIFIED -> AVAILABLE needs it)'
SELECT r.period_start,r.id run_id,r.overall_status,(r.finished_at IS NOT NULL) finished,
  (SELECT count(*) FROM costing.costing_run_fingerprint f WHERE f.refresh_run_id=r.id) fingerprints,
  (SELECT string_agg(DISTINCT f.purpose,',') FROM costing.costing_run_fingerprint f WHERE f.refresh_run_id=r.id) purposes
FROM costing.costing_refresh_run r WHERE r.overall_status='SUCCESS' ORDER BY r.period_start,r.id;
\echo '== F. period status (all extended columns) for before/after parity of R3B'
SELECT * FROM costing.v_costing_period_run_status ORDER BY period_start;
