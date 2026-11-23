-- Executive MIS G7 S1: route readiness register (READ ONLY).
-- This is NOT authority to edit approved product routes or sign historical stages.
-- Cohort: actual FG bulk storage worklogs Nov1–21 2026; no location requirement.
BEGIN READ ONLY;
SET LOCAL statement_timeout='8500ms';
WITH fg AS (
 SELECT wl.id work_log_id,p.id product_id,wl.batch_number,wl.log_date,
        wl.status,wl.storage_qty,wl.storage_qty_uom
 FROM public.daily_work_log wl JOIN public.products p ON p.item=wl.item
 WHERE wl.activity='FG bulk storage'
   AND wl.log_date BETWEEN '2026-11-01' AND '2026-11-21'
), route_rollup AS (
 SELECT f.id work_log_id,
 COUNT(DISTINCT pr.id) FILTER(WHERE pr.status='APPROVED') any_approved_routes,
 COUNT(DISTINCT pr.id) FILTER(WHERE pr.status='APPROVED'
  AND pr.effective_from<=f.log_date
  AND (pr.effective_to IS NULL OR pr.effective_to>=f.log_date)) effective_approved_routes
 FROM fg f LEFT JOIN costing.product_process_route pr ON pr.product_id=f.product_id
 GROUP BY f.id
), mapped AS (
 SELECT f.work_log_id,COUNT(DISTINCT s.id) FILTER(WHERE a.activity_name='FG bulk storage'
       AND s.is_mandatory) mandatory_fg_activity_steps,
       COUNT(DISTINCT s.id) FILTER(WHERE a.activity_name='FG bulk storage') any_fg_activity_steps,
       COUNT(DISTINCT pr.id) approved_route_ids
 FROM (SELECT id work_log_id, product_id,log_date FROM fg) f
 LEFT JOIN costing.product_process_route pr ON pr.product_id=f.product_id
   AND pr.status='APPROVED'
   AND pr.effective_from<=f.log_date
   AND (pr.effective_to IS NULL OR pr.effective_to>=f.log_date)
 LEFT JOIN costing.production_route_family_route_step s
   ON s.family_route_id=pr.base_route_family_route_id
 LEFT JOIN public.activities a ON a.id=s.activity_id
 GROUP BY f.work_log_id
), bmr AS (
 SELECT f.id work_log_id,count(b.id) bmr_matches
 FROM fg f LEFT JOIN public.bmr_details b
 ON b.product_id=f.product_id AND b.bn=f.batch_number
 GROUP BY f.id
), classified AS (
 SELECT f.*,r.any_approved_routes,r.effective_approved_routes,
 m.any_fg_activity_steps,m.mandatory_fg_activity_steps,b.bmr_matches,
 CASE
 WHEN b.bmr_matches<>1 THEN 'BMR_IDENTITY_REVIEW'
 WHEN r.any_approved_routes=0 THEN 'PRODUCT_ROUTE_COVERAGE'
 WHEN r.effective_approved_routes=0 THEN 'EFFECTIVE_DATE_ROUTE_GAP'
 WHEN r.effective_approved_routes>1 THEN 'APPROVED_ROUTE_OVERLAP'
 WHEN m.mandatory_fg_activity_steps<>1 THEN 'MANDATORY_FG_STAGE_GAP'
 ELSE 'ACTIVITY_ROUTE_CORRELATED_NOT_SIGNED' END review_queue
 FROM fg f JOIN route_rollup r ON r.work_log_id=f.id
 JOIN mapped m ON m.work_log_id=f.id JOIN bmr b ON b.work_log_id=f.id
)
SELECT review_queue,count(*) work_log_events,
 count(DISTINCT product_id) affected_products,
 count(DISTINCT(product_id,batch_number)) affected_batches,
 count(*) FILTER(WHERE status='Done') done,
 count(*) FILTER(WHERE status='In Storage') in_storage,
 count(*) FILTER(WHERE storage_qty>0) positive_qty,
 count(*) FILTER(WHERE bmr_matches=1) unique_bmr
FROM classified GROUP BY review_queue ORDER BY work_log_events DESC;
COMMIT;
-- Rollout policy: for historical MIS, mark unresolved route execution
-- NOT_VERIFIED rather than dropping source events or inventing signatures.
-- For future signed route-based capture, require effective approved route
-- + unique mandatory FG stage and actual authenticated execution evidence.
-- This register is a live source snapshot; do not make route changes from it.
