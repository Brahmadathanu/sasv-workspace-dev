-- Executive MIS G7/C2: root cause of 29 packaging SKU lines lacking FG bulk depletion.
-- READ ONLY. Does not insert FG bulk, backfill, repair or invoke trigger.
-- Report event window: 2026-11-01 00:00 IST up to 2026-11-22 00:00 IST.
BEGIN READ ONLY;
SET LOCAL statement_timeout='7500ms';
WITH packed AS (
 SELECT pe.id event_id,pe.event_type::text event_type,pe.created_at,
  pe.work_log_id,es.id event_sku_id,es.sku_id,es.count pack_units,
  wl.log_date,wl.item,wl.batch_number,wl.status,
  ps.product_id
 FROM public.packaging_events pe
 JOIN public.event_skus es ON es.packaging_event_id=pe.id
 JOIN public.daily_work_log wl ON wl.id=pe.work_log_id
 JOIN public.product_skus ps ON ps.id=es.sku_id
 WHERE pe.created_at>='2026-11-01T00:00:00+05:30'
   AND pe.created_at<'2026-11-22T00:00:00+05:30'
   AND pe.event_type::text<>'Transfer to FG store'
), unlinked AS (
 SELECT p.*
 FROM packed p
 WHERE NOT EXISTS (SELECT 1 FROM public.fg_bulk_stock_ledger l
  WHERE l.source_table='event_skus' AND l.source_id=p.event_sku_id)
), diagnosed AS (
 SELECT u.*,
  lkp.is_packaging,lkp.affects_bulk_stock,
  EXISTS (SELECT 1 FROM public.fg_bulk_stock_ledger l
   WHERE l.product_id=u.product_id AND l.batch_number=u.batch_number)
   batch_ledger_exists,
  EXISTS (SELECT 1 FROM public.fg_bulk_stock_ledger l
   WHERE l.product_id=u.product_id AND l.batch_number=u.batch_number
     AND l.reason_code='FG bulk storage') fg_receipt_exists,
  EXISTS (SELECT 1 FROM costing.product_process_route pr
   WHERE pr.product_id=u.product_id AND pr.status='APPROVED'
   AND pr.effective_from<=u.log_date
   AND (pr.effective_to IS NULL OR pr.effective_to>=u.log_date))
   approved_route_master_exists
 FROM unlinked u
 LEFT JOIN public.event_type_lkp lkp
   ON lkp.label=u.event_type AND lkp.active
)
SELECT event_type,
 count(*) unlinked_sku_lines,
 count(DISTINCT (product_id,batch_number)) distinct_product_batches,
 sum(pack_units) raw_pack_units_only,
 count(*) FILTER(WHERE is_packaging IS TRUE AND affects_bulk_stock=-1)
   expected_bulk_depletion,
 count(*) FILTER(WHERE batch_ledger_exists) existing_batch_ledger,
 count(*) FILTER(WHERE fg_receipt_exists) existing_fg_bulk_receipt,
 count(*) FILTER(WHERE approved_route_master_exists) with_approved_route_master,
 count(*) FILTER(WHERE status='Done') done_logs,
 count(*) FILTER(WHERE log_date<'2026-11-01') pre_november_work_logs
FROM diagnosed
GROUP BY event_type ORDER BY event_type;
COMMIT;
-- Source code authority: installed public.trg_fg_ledger_from_es() step 6
-- IF NOT EXISTS (FG ledger product/batch) THEN RETURN COALESCE(NEW,OLD).
-- It intentionally omits the depletion movement for a previously unseen batch.
-- Verify exact trigger body with READ ONLY pg_get_functiondef before any change.
-- No inferred historical bulk quantity or backfill is authorized by this proof.
