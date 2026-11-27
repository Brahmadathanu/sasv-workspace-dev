-- G7 C2: legacy FG ledger location completeness by writer / source type.
-- Read-only. Do not infer stock location for rows with missing path.
BEGIN READ ONLY;
SET LOCAL statement_timeout='6000ms';
SELECT source_table,reason_code,count(*) ledger_rows,
 count(*) FILTER(WHERE section_id IS NULL OR subsection_id IS NULL
   OR area_id IS NULL) missing_location_path,
 count(*) FILTER(WHERE plant_id IS NULL) plant_not_recorded,
 count(DISTINCT(product_id,batch_number)) product_batches
FROM public.fg_bulk_stock_ledger
WHERE movement_date>='2026-11-01T00:00:00+05:30'
  AND movement_date<'2026-11-22T00:00:00+05:30'
GROUP BY source_table,reason_code ORDER BY ledger_rows DESC;
SELECT count(*) source_rows,
 count(*) FILTER(WHERE batch_number IS NULL OR btrim(batch_number)='') empty_batch,
 count(*) FILTER(WHERE batch_number<>btrim(batch_number)) padded_batch,
 count(DISTINCT(product_id,batch_number)) exact_batch_keys
FROM public.fg_bulk_stock_ledger;
COMMIT;
-- Key finding: legacy packing, force-close, and auto-zero location unknown.
-- Do not backfill nullable path from event's current worklog location without
-- proven same original physical location/time and a governed correction.
-- New pack API must post explicit location; legacy rows remain flagged until
-- source-backed reconciliation. Batch-wide serialization alone does not
-- certify location-specific available balance.
