-- READ-ONLY preflight 05: pricing authority and November protection must be identical before and after every step.
SELECT period_start,displayed_run_id,approved_run_id,display_state,newer_draft_run_id FROM costing.v_costing_period_run_status ORDER BY period_start;
SELECT refresh_run_id,period_start,designation,designated_at FROM costing.v_costing_run_effective_designation ORDER BY period_start,refresh_run_id;
SELECT period_start,count(*) FILTER (WHERE overall_status='SUCCESS') success,count(*) FILTER (WHERE overall_status='FAILED') failed,
       count(*) FILTER (WHERE overall_status IN ('QUEUED','RUNNING')) active FROM costing.costing_refresh_run GROUP BY 1 ORDER BY 1;
