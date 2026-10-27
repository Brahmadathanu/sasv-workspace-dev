-- CI-040 v2.1 post-apply verification. READ-ONLY (SELECT only). Expected values in comments.
select 'constraint has STALE_APPROVAL_ACKNOWLEDGED' k, (pg_get_constraintdef(oid) like '%STALE_APPROVAL_ACKNOWLEDGED%')::text v from pg_constraint where conname='cost_period_governance_audit_event_type_chk'  -- true
union all select 'new tables', string_agg(c.relname, ',' order by c.relname) from pg_class c where c.relnamespace='costing'::regnamespace and c.relname in ('costing_approval_preview_ack','costing_automation_setting')  -- both
union all select 'ack rows', count(*)::text from costing.costing_approval_preview_ack  -- 0
union all select 'setting ttl', int_value::text from costing.costing_automation_setting where setting_key='approval_preview_ack_ttl_minutes'  -- 15
union all select 'RPC grants', string_agg(p.oid::regprocedure::text||'='||coalesce(p.proacl::text,''), '; ') from pg_proc p where p.proname in ('rpc_costing_preview_approval_impact','rpc_costing_approve_run_with_preview')  -- authenticated, service_role; no anon
union all select 'old approve body is route error', (prosrc like '%W2_USE_NEW_APPROVAL_ROUTE%')::text from pg_proc where oid='public.rpc_costing_approve_run(bigint,text,text)'::regprocedure  -- true
union all select 'old supersede body is route error', (prosrc like '%W2_USE_NEW_APPROVAL_ROUTE%')::text from pg_proc where oid='public.rpc_costing_supersede_approved_run(bigint,text,text)'::regprocedure  -- true
union all select 'designations unchanged (max id)', max(id)::text from costing.costing_run_designation  -- 11 (as on 26 Oct)
union all select 'audit unchanged (max id)', max(audit_id)::text from costing.cost_period_governance_audit  -- 21
union all select 'approved Oct run', string_agg(refresh_run_id::text, ',') from costing.v_costing_run_effective_designation where period_start='2026-10-01' and designation='APPROVED'  -- 143
union all select 'drift 122/143', string_agg(r||':'||(select count(*) from costing.fn_verify_run_fingerprint(r) v where not v.matches), ',') from unnest(array[122,143]) r;  -- 122:0,143:0
-- read-only preview core of the approved run itself (can_approve=false expected; no ack written by the core):
select (costing.fn_costing_approval_preview_core(143))->'impact'->'profit'->'draft'->>'label' as profit_label_143;  -- 'Not available for historical run'
-- v2.1 additions
select 'range check' k, pg_get_constraintdef(oid) v from pg_constraint where conname='costing_automation_setting_range_chk'  -- CHECK (CASE setting_key WHEN ... ELSE false END)
union all select 'settings/ack table ACL', string_agg(relname||'='||coalesce(relacl::text,'null'),' ; ') from pg_class where oid in ('costing.costing_automation_setting'::regclass,'costing.costing_approval_preview_ack'::regclass)  -- {postgres=arwdDxtm/postgres} both, no service_role
union all select 'policy wording', (obj_description('public.rpc_costing_approve_run_with_preview(bigint,text,text,bigint,boolean)'::regprocedure,'pg_proc') like '%generated/opened, not that it was reviewed or understood%')::text;  -- true
