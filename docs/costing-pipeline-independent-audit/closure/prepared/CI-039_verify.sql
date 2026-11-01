-- CI-039 post-apply verification (SELECT only). Run BEFORE apply too, and compare.
-- 1 constraint
select pg_get_constraintdef(oid) from pg_constraint where conname='cost_period_governance_audit_event_source_chk';
-- 2 function properties unchanged
select p.oid::regprocedure, pg_get_userbyid(p.proowner) owner, p.proacl, p.proconfig, p.prosecdef,
       pg_get_function_result(p.oid), md5(p.prosrc) src_md5, position('SKIPPED_APPROVED_PERIOD' in p.prosrc)>0 has_skip
from pg_proc p where p.proname='rpc_request_scheduled_costing_refresh_internal';
-- 3 fingerprints for runs 119/122/143 + combined hash (must equal pre-apply baseline)
select refresh_run_id, md5(costing.fn_compute_run_fingerprint(refresh_run_id)::text) fp_md5
from (values (119),(122),(143)) v(refresh_run_id);
select md5(string_agg(md5(costing.fn_compute_run_fingerprint(r)::text), '|' order by r)) combined
from unnest(array[119,122,143]) r;
-- 4 October period state (expect OPEN / 2026-10-22 / DRAFT / GOVERNED_MANUAL)
select period_start,status,valuation_date,valuation_date_status,valuation_date_source,updated_at
from costing.cost_periods where period_start in ('2026-09-01','2026-10-01','2026-11-01') order by 1;
-- 5 approved/designated set (expect 122 APPROVED Sep, 143 APPROVED Oct, 119 REFERENCE)
select refresh_run_id,period_start,designation,designated_at from costing.v_costing_run_effective_designation order by 1;
-- 6 no new audit rows / runs created by the apply itself
select max(id), count(*) filter (where event_source='CRON_SCHEDULED') from costing.cost_period_governance_audit;
select max(id) from costing.costing_refresh_run;
-- 7 cron jobs (expect 66 active, 67 inactive until resumed, 68 active)
select jobid,jobname,schedule,active from cron.job where jobid in (66,67,68) order by 1;
-- 8 after Mon 2 Nov 02:00 IST: job result and November
select jobid,status,return_message,start_time at time zone 'Asia/Kolkata' ist from cron.job_run_details where jobid in (66,67) order by start_time desc limit 5;
select id,period_start,valuation_date,source_trigger,overall_status from costing.costing_refresh_run where source_trigger='CRON_SCHEDULED' order by id desc;
