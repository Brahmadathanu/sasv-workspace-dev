select json_build_object(
 'fp',(select json_agg(json_build_object('r',r,'md5',md5(costing.fn_compute_run_fingerprint(r)::text)) order by r) from unnest(array[119,122,143]) r),
 'combined',(select md5(string_agg(md5(costing.fn_compute_run_fingerprint(r)::text),'|' order by r)) from unnest(array[119,122,143]) r),
 'latest_mig',(select max(version) from supabase_migrations.schema_migrations),
 'active',(select count(*) from public.product_skus where is_active),
 'active_fail',(select count(*) from public.product_skus s where s.is_active and jsonb_array_length(costing.fn_sku_activation_missing_items(s.id)->'missing')>0),
 'oct',(select row_to_json(x) from (select status,valuation_date,updated_at from costing.cost_periods where period_start='2026-10-01') x),
 'max_period',(select max(period_start) from costing.cost_periods),
 'desig',(select json_agg(json_build_object('r',refresh_run_id,'d',designation) order by refresh_run_id) from costing.v_costing_run_effective_designation),
 'max_audit',(select max(audit_id) from costing.cost_period_governance_audit),
 'max_run',(select max(id) from costing.costing_refresh_run),
 'cron',(select json_agg(json_build_object('j',jobid,'a',active,'s',schedule) order by jobid) from cron.job where jobid in (66,67,68)),
 'fn',(select json_build_object('md5',md5(pg_get_functiondef(p.oid)),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'secdef',p.prosecdef,'vol',p.provolatile,'cfg',p.proconfig::text) from pg_proc p where p.oid='costing.fn_sku_activation_missing_items(bigint,bigint)'::regprocedure),
 'sku41',costing.fn_sku_activation_missing_items(41),
 'sku846',costing.fn_sku_activation_missing_items(846)
) v;
