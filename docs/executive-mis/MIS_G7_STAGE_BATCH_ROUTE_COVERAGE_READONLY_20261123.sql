-- G7 READ ONLY source-stage correlation, no signoffs created and no route edits.
-- Cohort: FG bulk activity DWLs with log_date Nov 1–21 2026.
-- Only an explicit, audited set of known FG bulk step keys is considered:
-- transfer, QA and filling are NOT automatically interchangeable.
BEGIN READ ONLY;
SET LOCAL statement_timeout='8000ms';
WITH fg AS (
 SELECT wl.id work_log_id,wl.log_date,wl.status,wl.activity,
        wl.batch_number,wl.storage_qty,wl.storage_qty_uom,
        p.id product_id
 FROM public.daily_work_log wl
 JOIN public.products p ON p.item=wl.item
 WHERE wl.activity='FG bulk storage'
   AND wl.log_date BETWEEN '2026-11-01' AND '2026-11-21'
), bmr_matches AS (
 SELECT fg.work_log_id,count(bmr.id) bmr_count,min(bmr.id) bmr_id
 FROM fg LEFT JOIN public.bmr_details bmr ON bmr.product_id=fg.product_id
  AND bmr.bn=fg.batch_number
 GROUP BY fg.work_log_id
), route_matches AS (
 SELECT fg.work_log_id,
  count(DISTINCT pr.id) effective_approved_routes,
  count(DISTINCT (pr.id,s.id)) FILTER(WHERE s.step_key IN
   ('OIL_FG_BULK_HOLD','PILLS_FG_BULK_STORAGE_BOUNDARY',
    'TABLET_CAPSULE_FG_BULK_STORAGE_BOUNDARY',
    'OIL_FILLING_LINE_SIDE_FG_BULK_STORAGE')) recognized_fg_steps,
  min(pr.id) FILTER(WHERE s.step_key IN
   ('OIL_FG_BULK_HOLD','PILLS_FG_BULK_STORAGE_BOUNDARY',
    'TABLET_CAPSULE_FG_BULK_STORAGE_BOUNDARY',
    'OIL_FILLING_LINE_SIDE_FG_BULK_STORAGE')) recognized_route_id,
  min(s.id) FILTER(WHERE s.step_key IN
   ('OIL_FG_BULK_HOLD','PILLS_FG_BULK_STORAGE_BOUNDARY',
    'TABLET_CAPSULE_FG_BULK_STORAGE_BOUNDARY',
    'OIL_FILLING_LINE_SIDE_FG_BULK_STORAGE')) recognized_step_id
 FROM fg LEFT JOIN costing.product_process_route pr
   ON pr.product_id=fg.product_id AND pr.status='APPROVED'
   AND pr.effective_from<=fg.log_date
   AND (pr.effective_to IS NULL OR pr.effective_to>=fg.log_date)
 LEFT JOIN costing.production_route_family_route_step s
   ON s.family_route_id=pr.base_route_family_route_id
 GROUP BY fg.work_log_id
), assessed AS (
 SELECT f.*,b.bmr_count,b.bmr_id,r.effective_approved_routes,r.recognized_fg_steps,
  CASE WHEN b.bmr_count<>1 THEN 'BMR_REVIEW'
   WHEN r.effective_approved_routes=0 THEN 'ROUTE_COVERAGE_MISSING'
   WHEN r.effective_approved_routes>1 THEN 'ROUTE_VERSION_OVERLAP'
   WHEN r.recognized_fg_steps<>1 THEN 'FG_STAGE_MAPPING_REVIEW'
   ELSE 'SOURCE_CORRELATION_ONLY_NOT_SIGNED' END evidence_disposition
 FROM fg f JOIN bmr_matches b USING(work_log_id)
 JOIN route_matches r USING(work_log_id)
)
SELECT evidence_disposition,count(*) fg_activity_records,
 count(*) FILTER(WHERE status='Done') done_worklogs,
 count(*) FILTER(WHERE status='In Storage') in_storage_worklogs,
 count(*) FILTER(WHERE storage_qty>0) positive_receipt_qty,
 count(*) FILTER(WHERE bmr_count=1) uniquely_mapped_bmr
FROM assessed GROUP BY evidence_disposition ORDER BY fg_activity_records DESC;
COMMIT;
-- Even SOURCE_CORRELATION_ONLY_NOT_SIGNED does not prove actual signed
-- execution: stage authority and source event signature remain missing.
-- DO NOT pick MAX(route_version) under overlapping approvals without owner
-- policy and effective-period conflict resolution.
