-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- SA-1C Wave 1: privileged mutating functions must not be anonymously callable.
-- Preserve signed-in application access and trusted worker access explicitly.

-- Plan publishing / ETL control.
REVOKE EXECUTE ON FUNCTION public.delete_publish(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_publish(bigint) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.publish_plan_snapshot(text,date,text,date,date,json) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_plan_snapshot(text,date,text,date,date,json) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.enqueue_job(text,jsonb,integer,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_job(text,jsonb,integer,timestamptz) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.retry_jobs_by_ids(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_jobs_by_ids(uuid[]) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_enqueue_job(text,jsonb,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_enqueue_job(text,jsonb,integer) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_cancel_jobs(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_jobs(uuid[]) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_retry_failed(text,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_retry_failed(text,date,date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_run_master_aggregator(date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_run_master_aggregator(date,text) TO authenticated, service_role;

-- Snapshot / execution refresh controls.
REVOKE EXECUTE ON FUNCTION public.refresh_execution_gate_snapshots_current_month(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_execution_gate_snapshots_current_month(date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_pm_reservation_snapshot_current_month() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_pm_reservation_snapshot_current_month() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_priority_queue_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_priority_queue_snapshot() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_rm_reservation_snapshot_current_month() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_rm_reservation_snapshot_current_month() TO authenticated, service_role;

-- PLM template/mapping/override writers and rebuilders.
REVOKE EXECUTE ON FUNCTION public.fn_plm_map_sku_to_template(bigint,bigint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_plm_map_sku_to_template(bigint,bigint,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fn_plm_rebuild_by_template(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_plm_rebuild_by_template(bigint) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fn_plm_upsert_override(bigint,text,text,numeric,text,numeric,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_plm_upsert_override(bigint,text,text,numeric,text,numeric,boolean,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.fn_plm_upsert_template(text,numeric,text,numeric,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_plm_upsert_template(text,numeric,text,numeric,text,jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_plm_map_clear(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_plm_map_clear(bigint) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_plm_map_set(bigint,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_plm_map_set(bigint,bigint) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_plm_ovr_delete(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_plm_ovr_delete(bigint) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_plm_ovr_upsert(bigint,bigint,text,bigint,numeric,text,numeric,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_plm_ovr_upsert(bigint,bigint,text,bigint,numeric,text,numeric,boolean,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_plm_rebuild_all(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_plm_rebuild_all(boolean) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_plm_rebuild_all(boolean,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_plm_rebuild_all(boolean,integer,integer) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_plm_rebuild_sku(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_plm_rebuild_sku(bigint) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_plm_rebuild_skus_for_tpl(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_plm_rebuild_skus_for_tpl(bigint) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_plm_tpl_delete_line(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_plm_tpl_delete_line(bigint) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_plm_tpl_renumber(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_plm_tpl_renumber(bigint) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_plm_tpl_upsert_header(text,numeric,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_plm_tpl_upsert_header(text,numeric,text,numeric) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_plm_tpl_upsert_line(bigint,bigint,numeric,text,numeric,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_plm_tpl_upsert_line(bigint,bigint,numeric,text,numeric,boolean,text) TO authenticated, service_role;

-- Semi-process BOM writers.
REVOKE EXECUTE ON FUNCTION public.rpc_sp_bom_delete_line(bigint,bigint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_sp_bom_delete_line(bigint,bigint,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_sp_bom_renumber(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_sp_bom_renumber(bigint) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_sp_bom_upsert_header(bigint,numeric,text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_sp_bom_upsert_header(bigint,numeric,text,numeric,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.rpc_sp_bom_upsert_line(bigint,bigint,numeric,text,numeric,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_sp_bom_upsert_line(bigint,bigint,numeric,text,numeric,boolean,text) TO authenticated, service_role;

-- SOP mutation lifecycle.
REVOKE EXECUTE ON FUNCTION public.sop_approval_decide(uuid,uuid,approval_status,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sop_approval_decide(uuid,uuid,approval_status,text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.sop_publish_approved(uuid,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sop_publish_approved(uuid,timestamptz) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.sop_sections_reset_to_template(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sop_sections_reset_to_template(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.sop_submit_for_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sop_submit_for_review(uuid) TO authenticated, service_role;

-- ETL stock snapshot writer.
REVOKE EXECUTE ON FUNCTION public.upsert_godown_stock_snapshot(text,date,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_godown_stock_snapshot(text,date,jsonb) TO authenticated, service_role;