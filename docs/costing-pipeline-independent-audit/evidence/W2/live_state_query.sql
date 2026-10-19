select jsonb_build_object(
'captured_at', now(),
'defs', (select jsonb_object_agg(k,h) from (
  select 'F '||p.oid::regprocedure::text k, md5(pg_get_functiondef(p.oid)) h from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('costing','public') and p.prokind in ('f','p')
  union all select 'V '||c.oid::regclass::text, md5(pg_get_viewdef(c.oid)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('costing','public') and c.relkind in ('v','m')
  union all select 'C '||conrelid::regclass||'.'||conname, md5(pg_get_constraintdef(oid)) from pg_constraint where connamespace in ('costing'::regnamespace,'public'::regnamespace)
  union all select 'T '||tgrelid::regclass||'.'||tgname, md5(pg_get_triggerdef(t.oid)) from pg_trigger t join pg_class c on c.oid=t.tgrelid where not tgisinternal and c.relnamespace in ('costing'::regnamespace,'public'::regnamespace)
  union all select 'R '||c.oid::regclass::text, md5(string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod),',' order by a.attnum)) from pg_class c join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped where c.relnamespace in ('costing'::regnamespace,'public'::regnamespace) and c.relkind in ('r','p') group by c.oid
) d),
'w2_fn_defs', (select jsonb_object_agg(p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid))) from pg_proc p where p.proname like 'fn_w2_%' or p.proname like 'rpc_costing_%' and p.proname in ('rpc_costing_period_governance_context','rpc_costing_preflight_run','rpc_costing_open_next_period','rpc_costing_approve_run','rpc_costing_lock_period','rpc_costing_reopen_period','rpc_costing_authorise_supersession','rpc_costing_supersede_approved_run','rpc_costing_close_period')),
'drift_122', (select count(*) from costing.fn_verify_run_fingerprint(122) where not matches),
'drift_128', (select count(*) from costing.fn_verify_run_fingerprint(128) where not matches),
'fingerprints', (select jsonb_agg(jsonb_build_array(id,refresh_run_id,purpose) order by id) from costing.costing_run_fingerprint),
'periods', (select jsonb_agg(to_jsonb(p) - 'updated_at' order by period_start) from costing.cost_periods p),
'periods_md5', (select md5(string_agg(p::text,'|' order by period_start)) from costing.cost_periods p),
'designations', (select jsonb_agg(jsonb_build_array(id,refresh_run_id,designation,designated_by,fingerprint_id) order by id) from costing.costing_run_designation),
'cron', (select jsonb_agg(jsonb_build_array(jobid,jobname,schedule,active) order by jobid) from cron.job),
'max_run', (select max(id) from costing.costing_refresh_run),
'active_runs', (select count(*) from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')),
'auths', (select count(*) from costing.costing_period_refresh_authorization),
'audit_count', (select count(*) from costing.cost_period_governance_audit),
'audit_max', (select max(audit_id) from costing.cost_period_governance_audit),
'rebaseline_rows', (select count(*) from costing.costing_run_fingerprint_rebaseline),
'feed', (select jsonb_agg(jsonb_build_array(period_start,refresh_run_id,n,ik,ok) order by period_start) from (select period_start, refresh_run_id, count(*) n, count(*) filter (where ik_negative_margin) ik, count(*) filter (where ok_negative_margin) ok from costing.v_price_revision_feed_approved group by 1,2) f),
'feed_md5', (select md5(string_agg(f::text,'|' order by period_start, sku_id)) from costing.v_price_revision_feed_approved f),
'status_labels', (select jsonb_agg(jsonb_build_array(period_start,period_status,display_label) order by period_start) from costing.v_costing_period_run_status),
'owner_table', to_regclass('costing.costing_governance_owner') is not null,
'migrations_tail', (select jsonb_agg(jsonb_build_array(version,name) order by version) from (select version,name from supabase_migrations.schema_migrations order by version desc limit 3) m)
) as r
