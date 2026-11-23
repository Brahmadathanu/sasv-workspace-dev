-- MIS G7 S3 INTEGRATED EVIDENCE ENVELOPE / NOT A FINALIZED REPORT.
-- READ ONLY proof using 2026-11-01 through Nov21 report-day events (IST),
-- original Tally source snapshot as-of Nov23, approved manufacturing COP run143.
-- Values are distinct lenses: do NOT sum bulk volume, packed units or Tally book.
BEGIN READ ONLY;
SET LOCAL statement_timeout='8500ms';
WITH
tally_ranked AS (
 SELECT t.*,
 row_number() OVER (
 PARTITION BY t.transfer_store,coalesce(nullif(t.voucher_guid,''),'__NO_GUID__'),
 t.inventory_line_no,t.batch_line_no,coalesce(t.raw_godown,'')
 ORDER BY coalesce(t.voucher_alterid,0) DESC,t.as_of_date DESC,t.id DESC) rn
 FROM public.tally_fg_transfer_voucher_lines t
 WHERE t.as_of_date='2026-11-23'
 AND t.voucher_date BETWEEN '2026-11-01' AND '2026-11-21'
),
tally_priced AS (
 SELECT t.*,a.sku_id,ps.pack_size current_pack_size,ps.uom current_pack_uom,
 k.pack_size approved_pack_size,k.pack_uom approved_pack_uom,
 k.manufacturing_cop_per_sku approved_cop,k.manufacturing_cop_status rate_status,
 CASE
 WHEN rn>1 THEN 'EXCLUDED_SUPERSEDED'
 WHEN coalesce(is_cancelled,false) THEN 'EXCLUDED_CANCELLED'
 WHEN coalesce(is_optional,false) THEN 'EXCLUDED_OPTIONAL'
 WHEN a.sku_id IS NULL THEN 'SKU_UNMAPPED'
 WHEN ps.id IS NULL THEN 'SKU_MASTER_MISSING'
 WHEN k.sku_id IS NULL THEN 'NO_APPROVED_RATE'
 WHEN k.manufacturing_cop_status IS DISTINCT FROM 'READY'
 OR k.manufacturing_cop_per_sku IS NULL OR k.manufacturing_cop_per_sku<0
 THEN 'RATE_UNUSABLE'
 WHEN ps.pack_size IS DISTINCT FROM k.pack_size
 OR ps.uom IS DISTINCT FROM k.pack_uom THEN 'PACK_DEFINITION_MISMATCH'
 WHEN coalesce(public.f_norm_key(t.qty_unit_text),'') NOT IN
 ('btl','bottle','nos','no','pcs','piece','pack','pkt','box','jar',
  'tin','tube','sachet','strip','unit','units') THEN 'QUANTITY_NOT_IN_PACKS'
 WHEN t.qty_value IS NULL OR t.qty_value<=0 THEN 'QUANTITY_UNUSABLE'
 ELSE 'COVERED' END coverage_reason
 FROM tally_ranked t
 LEFT JOIN public.sku_aliases a ON a.alias_key=public.f_norm_key(t.item_name)
 LEFT JOIN public.product_skus ps ON ps.id=a.sku_id
 LEFT JOIN costing.sku_internal_loaded_cost_snapshot k
 ON k.refresh_run_id=143 AND k.sku_id=a.sku_id
),
bulk_ledger AS (
 SELECT id,product_id,batch_number,movement_date,qty_base,uom,
 reason_code,source_table,source_id,created_at,
 CASE WHEN source_table='daily_work_log' AND reason_code='FG bulk storage'
   AND qty_base>0 THEN 'BULK_RECEIPT_UNVERIFIED'
 WHEN source_table='event_skus' THEN 'PACKAGING_BULK_CONSUMPTION'
 WHEN source_table='fn_fg_force_close' THEN 'FORCE_CLOSE'
 WHEN source_table='fn_fg_auto_zero' THEN 'AUTO_ZERO'
 WHEN source_table='fg_bulk_internal_transfer' THEN 'INTERNAL_TRANSFER'
 ELSE 'OTHER_REVIEW' END evidence_class
 FROM public.fg_bulk_stock_ledger
 WHERE movement_date>='2026-11-01T00:00:00+05:30'
 AND movement_date<'2026-11-22T00:00:00+05:30'
),
pack_skus AS (
 SELECT pe.id event_id,pe.work_log_id,pe.event_type::text event_type,
 pe.created_at,es.id sku_line_id,es.sku_id,es.count packed_units,
 (pe.event_type::text='Transfer to FG store') transfer_activity,
 EXISTS (SELECT 1 FROM bulk_ledger b WHERE b.source_table='event_skus'
 AND b.source_id=es.id) linked_bulk_consumption
 FROM public.packaging_events pe
 JOIN public.event_skus es ON es.packaging_event_id=pe.id
 WHERE pe.created_at>='2026-11-01T00:00:00+05:30'
 AND pe.created_at<'2026-11-22T00:00:00+05:30'
),
finalizers AS (
 SELECT DISTINCT ON (upper(j.params->>'store'))
 upper(j.params->>'store') store,j.id job_id,j.finished_at,
 j.params->'expected_keys' expected_keys
 FROM public.etl_jobs j WHERE j.job_type='FINALIZE_FG_TRANSFER_SNAPSHOT'
 AND j.status='done' AND j.params->>'validation_status'='ACCEPTED'
 AND j.params->>'as_of_date'='2026-11-23'
 ORDER BY upper(j.params->>'store'),j.finished_at DESC,j.id DESC
),
fingerprints AS (
 SELECT
 (SELECT encode(sha256(convert_to(coalesce(
 jsonb_agg(jsonb_build_array(
 id,transfer_store,voucher_guid,inventory_line_no,batch_line_no,
 raw_godown,voucher_alterid,source_key,item_name,batch_code,
 voucher_date,qty_value,qty_unit_text,transfer_amount,
 is_cancelled,is_optional,rn,sku_id,current_pack_size,current_pack_uom,
 approved_pack_size,approved_pack_uom,approved_cop,rate_status,coverage_reason)
 ORDER BY transfer_store,coalesce(nullif(voucher_guid,''),'__NO_GUID__'),
 inventory_line_no,batch_line_no,coalesce(raw_godown,''),rn,id
 )::text,'[]'),'UTF8')),'hex') FROM tally_priced) tally_sha,
 (SELECT encode(sha256(convert_to(coalesce(
 jsonb_agg(jsonb_build_array(id,product_id,batch_number,movement_date::text,
 qty_base,uom,reason_code,source_table,source_id,created_at::text)
 ORDER BY id)::text,'[]'),'UTF8')),'hex') FROM bulk_ledger) bulk_sha,
 (SELECT encode(sha256(convert_to(coalesce(
 jsonb_agg(jsonb_build_array(event_id,work_log_id,event_type,created_at::text,
 sku_line_id,sku_id,packed_units) ORDER BY sku_line_id)::text,'[]'),'UTF8')),'hex')
 FROM pack_skus) packaging_sha
),
envelope AS (
 SELECT jsonb_build_object(
 'schema_version',1,'policy','S3_UNVERIFIED_INTEGRATED_EVIDENCE_V1',
 'report_month','2026-11-01','report_cutoff','2026-11-21',
 'tally_source_as_of','2026-11-23',
 'reference_cost_run_id',143,
 'transfer',jsonb_build_object(
   'original_rows',(SELECT count(*) FROM tally_priced),
   'distinct_original_rows',(SELECT count(DISTINCT id) FROM tally_priced),
   'alias_join_cardinality_safe',(SELECT count(*)=count(DISTINCT id) FROM tally_priced),
   'eligible_rows',(SELECT count(*) FROM tally_priced WHERE coverage_reason NOT IN
      ('EXCLUDED_SUPERSEDED','EXCLUDED_CANCELLED','EXCLUDED_OPTIONAL')),
   'covered_rows',(SELECT count(*) FROM tally_priced WHERE coverage_reason='COVERED'),
   'uncovered_rows',(SELECT count(*) FROM tally_priced WHERE coverage_reason NOT IN
      ('EXCLUDED_SUPERSEDED','EXCLUDED_CANCELLED','EXCLUDED_OPTIONAL','COVERED')),
   'book_amount',(SELECT round(sum(transfer_amount),2) FROM tally_priced
     WHERE coverage_reason NOT IN ('EXCLUDED_SUPERSEDED','EXCLUDED_CANCELLED','EXCLUDED_OPTIONAL')),
   'covered_cop_reference',(SELECT round(sum(qty_value*approved_cop),2)
     FROM tally_priced WHERE coverage_reason='COVERED'),
   'source_sha256',(SELECT tally_sha FROM fingerprints),
   'reconciliation_status','NOT_VERIFIED'),
 'fg_bulk',jsonb_build_object(
   'ledger_rows',(SELECT count(*) FROM bulk_ledger),
   'receipt_events',(SELECT count(*) FROM bulk_ledger
       WHERE evidence_class='BULK_RECEIPT_UNVERIFIED'),
   'pack_consumption_rows',(SELECT count(*) FROM bulk_ledger
       WHERE evidence_class='PACKAGING_BULK_CONSUMPTION'),
   'force_close_rows',(SELECT count(*) FROM bulk_ledger
       WHERE evidence_class='FORCE_CLOSE'),
   'auto_zero_rows',(SELECT count(*) FROM bulk_ledger
       WHERE evidence_class='AUTO_ZERO'),
   'internal_transfer_legs',(SELECT count(*) FROM bulk_ledger
       WHERE evidence_class='INTERNAL_TRANSFER'),
   'source_sha256',(SELECT bulk_sha FROM fingerprints),
   'signed_completion_status','NOT_VERIFIED',
   'monetary_completed_production_value',NULL),
 'packaging',jsonb_build_object(
   'event_count',(SELECT count(DISTINCT event_id) FROM pack_skus),
   'sku_lines',(SELECT count(*) FROM pack_skus),
   'actual_packaging_sku_lines',(SELECT count(*) FROM pack_skus WHERE NOT transfer_activity),
   'fg_store_transfer_sku_lines',(SELECT count(*) FROM pack_skus WHERE transfer_activity),
   'actual_packaging_linked_to_bulk',(SELECT count(*) FROM pack_skus
     WHERE NOT transfer_activity AND linked_bulk_consumption),
   'actual_packaging_unlinked_to_bulk',(SELECT count(*) FROM pack_skus
     WHERE NOT transfer_activity AND NOT linked_bulk_consumption),
   'source_sha256',(SELECT packaging_sha FROM fingerprints),
   'bulk_parity_status','NOT_VERIFIED'),
 'etl',jsonb_build_object(
   'source_certification','NOT_CERTIFIED',
   'store_finalizers',(SELECT jsonb_object_agg(store,jsonb_build_object(
      'job_id',job_id,'finished_at',finished_at,
      'declared_file_count',jsonb_array_length(expected_keys)))
      FROM finalizers)),
 'excess_bulk',jsonb_build_object(
   'authorization_status','NOT_PROVEN_FROM_INSPECTED_LEGACY_SOURCES',
   'signed_excess_base_qty',NULL),
 'overall_completed_production_status','NOT_VERIFIED',
 'financial_report_status','NOT_FINALIZED'
 ) data
)
SELECT data AS proposed_frozen_evidence_envelope,
 encode(sha256(convert_to(data::text,'UTF8')),'hex') envelope_test_sha256
FROM envelope;
COMMIT;
-- This SELECT does not store an immutable report. Source hashes use jsonb::text
-- and a fixed test encoding. Full source/rate rows or compact reconstructible
-- projection must be frozen by an independently authorized privileged writer.
-- Source snapshot and report cutoff differ intentionally and are both captured.
-- No FG bulk qty totals across mixed product/UOM are added.
