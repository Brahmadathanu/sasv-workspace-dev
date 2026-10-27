-- CI-041 v2.1 post-apply verification. READ-ONLY.
select 'settings' k, string_agg(setting_key||'='||int_value, ',' order by setting_key) v from costing.costing_automation_setting where introduced_by='CI-041'  -- scheduler_catch_up_max_runs=1,scheduler_max_retries=2
union all select 'scheduler comment', left(obj_description('costing.rpc_request_scheduled_costing_refresh_internal()'::regprocedure,'pg_proc'),60)  -- COSTING-DRAFTS-AFTER-APPROVAL-POLICY-2026-10-26 ...
union all select 'scheduler no longer updates cost_periods', (prosrc not ilike '%update costing.cost_periods%')::text from pg_proc where oid='costing.rpc_request_scheduled_costing_refresh_internal()'::regprocedure  -- true
union all select 'AU2 trigger untouched (no retry branch)', (prosrc not like '%retry%')::text from pg_proc where oid='costing.fn_after_refresh_run_au2()'::regprocedure  -- true; md5 of pg_get_functiondef still d03176c2...
union all select 'recalculation RPC grant', coalesce(proacl::text,'') from pg_proc where oid='public.rpc_costing_request_recalculation(date,text,date)'::regprocedure  -- authenticated, service_role
union all select 'cron 66/67/68 unchanged', string_agg(jobid||':'||active||':'||schedule, ', ' order by jobid) from cron.job where jobid in (66,67,68)  -- 66 '30 20 * * 0', 67 '30 20 28-31 * *', 68 '*/5 * * * *', all true
union all select 'Oct month date unchanged', valuation_date::text from costing.cost_periods where period_start='2026-10-01'  -- 2026-10-22
union all select 'runs unchanged (max id)', max(id)::text from costing.costing_refresh_run  -- 143 until the next job run
union all select 'job 68 entry point', l.lanname||' acl='||coalesce(p.proacl::text,'')||' calls sweep='||(p.prosrc like '%fn_costing_retry_sweep%') from pg_proc p join pg_language l on l.oid=p.prolang where p.oid='public.rpc_process_pending_costing_refresh_stage()'::regprocedure  -- plpgsql acl={postgres=X/postgres} calls sweep=true
union all select 'job 68 command unchanged', command from cron.job where jobid=68  -- set statement_timeout = '10min'; select public.rpc_process_pending_costing_refresh_stage();
union all select 'event types', pg_get_constraintdef(oid) from pg_constraint where conname='cost_period_governance_audit_event_type_chk'  -- includes SCHEDULED_RETRY_REQUESTED/FAILED/LIMIT_REACHED
union all select 'classifier self-test', (costing.fn_costing_failure_class('deadlock detected')='TRANSIENT' and costing.fn_costing_failure_class('canceling statement due to statement timeout')='UNKNOWN')::text  -- true
union all select 'historical failures that the sweep would retry', count(*)::text from costing.costing_refresh_run where overall_status='FAILED' and source_trigger='CRON_SCHEDULED' and costing.fn_costing_failure_class(error_message)='TRANSIENT';  -- 0
