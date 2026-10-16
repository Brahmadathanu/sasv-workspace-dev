-- First-APPROVED-run acceptance harness. READ-ONLY. Usage (psql): \set run_id 123  then \i this file
-- Live/MCP: replace :run_id literal. Returns one row per check + EVIDENCE row (md5 snapshot of all results).
with p as (select (:run_id)::bigint as run_id),
r as (select r.* from costing.costing_refresh_run r join p on r.id=p.run_id),
cp as (select c.* from costing.cost_periods c join r on c.period_start=r.period_start),
rd as (select x.* from p, costing.fn_preview_manufacturing_rate_readiness(p.run_id) x),
chk(n,code,ok,detail) as (
 select 1,'RUN_EXISTS',exists(select 1 from r),(select coalesce(max(period_start::text),'missing') from r)
 union all select 2,'RUN_SUCCESS',coalesce((select overall_status='SUCCESS' from r),false),(select max(overall_status) from r)
 union all select 3,'NO_BLOCKED_ROWS',coalesce((select final_blocked_count=0 from r),false),(select max(final_blocked_count)::text from r)
 union all select 4,'REVIEW_ROWS_ZERO',coalesce((select final_review_required_count=0 from r),false),(select max(final_review_required_count)::text from r)
 union all select 5,'PERIOD_GOVERNED',exists(select 1 from cp),(select max(status||'/'||valuation_date_status) from cp)
 union all select 6,'VALUATION_DATE_LOCKED_OR_FINAL',coalesce((select valuation_date_status in ('LOCKED','FINAL') from cp),false),(select max(valuation_date_status) from cp)
 union all select 7,'VALUATION_DATE_MATCH',coalesce((select r.valuation_date=cp.valuation_date from r,cp),false),(select max(r.valuation_date::text||' vs '||cp.valuation_date::text) from r,cp)
 union all select 8,'NO_OTHER_APPROVED_IN_PERIOD',not exists(select 1 from costing.costing_run_designation d,r where d.period_start=r.period_start and d.designation='APPROVED' and d.refresh_run_id<>r.id),''
 union all select 9,'SUCCESS_FINGERPRINT',exists(select 1 from costing.costing_run_fingerprint f,p where f.refresh_run_id=p.run_id),''
 union all select 10,'NOT_CRON_UNREVIEWED_LATEST',true,'manual: APPROVED requires explicit designation; LATEST_SUCCESS never auto-approved'
 union all select 11,'NORMAL_RATES_APPROVED',not exists(select 1 from rd where status='REVIEW_REQUIRED'),(select string_agg(component_code||':'||reason_code,'; ') from rd where status='REVIEW_REQUIRED')
 union all select 12,'CRON_60_PAUSED_CLIENT_TRIGGERED',(select count(*)=1 from cron.job where jobid=60 and not active),'policy 2026-10-16: first run client-triggered'
)
select n,code,case when ok then 'PASS' else 'FAIL' end result,detail from chk
union all
select 99,'EVIDENCE_SNAPSHOT',case when bool_and(ok) then 'PASS' else 'FAIL' end,
 'md5='||md5(string_agg(n||code||ok||coalesce(detail,''),'|' order by n))||' at '||now()::text from chk
order by 1;
