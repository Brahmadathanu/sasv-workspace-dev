-- MIS G7 S3: FG bulk, packaging, adjustments and transfer evidence inventory
-- REVIEW ONLY, no manufacturing completion or packing-excess certification.
-- Source dates: 1 Nov 2026 00:00 IST through 22 Nov 2026 00:00 IST.
-- A source digest is for evidence-change detection, not a signed receipt.
BEGIN READ ONLY;
SET LOCAL statement_timeout='7500ms';

WITH
ledger AS (
 SELECT id,product_id,batch_number,movement_date,qty_base,uom,
        reason_code,source_table,source_id,created_at,
        CASE
          WHEN source_table='daily_work_log' AND reason_code='FG bulk storage' AND qty_base>0
            THEN 'FG_BULK_RECEIPT_UNVERIFIED'
          WHEN source_table='event_skus'
            THEN 'PACKAGING_BULK_CONSUMPTION'
          WHEN source_table='fn_fg_force_close'
            THEN 'FORCE_CLOSE_ADJUSTMENT'
          WHEN source_table='fn_fg_auto_zero'
            THEN 'AUTO_ZERO_ADJUSTMENT'
          WHEN source_table='fg_bulk_internal_transfer'
            THEN 'INTERNAL_TRANSFER_NOT_PRODUCTION'
          ELSE 'OTHER_LEDGER_MOVEMENT_REVIEW'
        END evidence_class
 FROM public.fg_bulk_stock_ledger
 WHERE movement_date >= '2026-11-01T00:00:00+05:30'
   AND movement_date < '2026-11-22T00:00:00+05:30'
),
pack AS (
 SELECT pe.id AS event_id,pe.work_log_id,pe.event_type::text AS event_type,
        pe.created_at,es.id AS sku_line_id,es.sku_id,es.count AS packaged_units,
        CASE WHEN pe.event_type::text='Transfer to FG store'
          THEN 'FG_TRANSFER_ACTIVITY_NOT_PACKAGING'
          ELSE 'PACKAGING_STAGE_ACTIVITY'
        END evidence_class
 FROM public.packaging_events pe
 JOIN public.event_skus es ON es.packaging_event_id=pe.id
 WHERE pe.created_at >= '2026-11-01T00:00:00+05:30'
   AND pe.created_at < '2026-11-22T00:00:00+05:30'
),
pack_reconciled AS (
 SELECT p.*,
        EXISTS (
         SELECT 1 FROM ledger l
         WHERE l.source_table='event_skus'
           AND l.source_id=p.sku_line_id
        ) AS linked_bulk_consumption
 FROM pack p
),
ledger_rollup AS (
 SELECT evidence_class,count(*) line_count,
        -- Quantities may span different product base UOMs: never sum here.
        count(DISTINCT (product_id,coalesce(batch_number,''))) product_batches
 FROM ledger GROUP BY evidence_class
),
pack_rollup AS (
 SELECT evidence_class,count(*) sku_lines,count(DISTINCT event_id) event_count,
        count(*) FILTER (WHERE linked_bulk_consumption) with_bulk_ledger,
        count(*) FILTER (WHERE NOT linked_bulk_consumption) without_bulk_ledger
 FROM pack_reconciled GROUP BY evidence_class
),
source_digests AS (
 SELECT
 (SELECT encode(sha256(convert_to(
   coalesce(jsonb_agg(jsonb_build_array(
     id,product_id,batch_number,movement_date::text,qty_base,uom,
     reason_code,source_table,source_id,created_at::text
   ) ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM ledger) ledger_sha256,
 (SELECT encode(sha256(convert_to(
   coalesce(jsonb_agg(jsonb_build_array(
     event_id,work_log_id,event_type,created_at::text,
     sku_line_id,sku_id,packaged_units
   ) ORDER BY sku_line_id)::text,'[]'),'UTF8')),'hex')
   FROM pack) packaging_sha256
)
SELECT
 (SELECT sum(line_count) FROM ledger_rollup) AS ledger_lines,
 (SELECT jsonb_object_agg(evidence_class,jsonb_build_object(
   'ledger_lines',line_count,'product_batches',product_batches))
   FROM ledger_rollup) AS ledger_classification,
 (SELECT sum(sku_lines) FROM pack_rollup) AS packaging_sku_lines,
 (SELECT jsonb_object_agg(evidence_class,jsonb_build_object(
   'sku_lines',sku_lines,'events',event_count,
   'linked_bulk_consumption',with_bulk_ledger,
   'unlinked_bulk_consumption',without_bulk_ledger))
   FROM pack_rollup) AS packaging_classification,
 (SELECT ledger_sha256 FROM source_digests) AS ledger_sha256,
 (SELECT packaging_sha256 FROM source_digests) AS packaging_sha256,
 'NOT_VERIFIED'::text AS completed_production_status,
 'NOT_VERIFIED'::text AS packaging_bulk_reconciliation_status,
 'NO_SIGNED_EXCESS_BULK_LEDGER_EVIDENCE'::text AS excess_bulk_authorization_status;
COMMIT;

-- Interpretation:
-- 1. A daily_work_log DONE record is not a full C1 route-signed completion.
-- 2. Transfer to FG store is NOT a packaging manufacturing event.
-- 3. Bulk ledger incoming qty is not necessarily completed manufactured qty.
-- 4. Force-close/auto-zero must not masquerade as excess bulk or production.
-- 5. Internal transfers carry equal-and-opposite stock movements: no new production.
-- 6. Event_skus unlinked to ledger must be reviewed by event semantics, not
--    called erroneous wholesale. No per-product/UOM quantities are summed.
-- 7. This is an evidence inventory and digests, not the full signed S3 payload.
