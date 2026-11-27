-- MIS G7 S3 frozen transfer valuation projection — READ ONLY demonstration, NOT writer.
-- Fixed fixture Nov1-21, as-of source snapshot Nov23, approved Oct run 143.
-- It does NOT claim completed manufacturing value, certified source or approved report.
BEGIN READ ONLY;
SET LOCAL statement_timeout='7500ms';
WITH ranked AS (
 SELECT t.*,row_number() OVER (
 PARTITION BY t.transfer_store,
   coalesce(nullif(t.voucher_guid,''),'__NO_GUID__'),
   t.inventory_line_no,t.batch_line_no,coalesce(t.raw_godown,'')
 ORDER BY coalesce(t.voucher_alterid,0) DESC,t.as_of_date DESC,t.id DESC
 ) version_rank
 FROM public.tally_fg_transfer_voucher_lines t
 WHERE t.as_of_date='2026-11-23'
   AND t.voucher_date BETWEEN '2026-11-01' AND '2026-11-21'
), priced AS (
 SELECT t.id,t.transfer_store,t.voucher_guid,t.inventory_line_no,
   t.batch_line_no,t.raw_godown,t.voucher_alterid,t.voucher_date,
   t.source_key,t.item_name,t.batch_code,t.qty_value,t.qty_unit_text,
   t.transfer_amount,t.is_cancelled,t.is_optional,t.version_rank,
   a.sku_id,ps.pack_size AS current_pack_size,ps.uom AS current_pack_uom,
   k.pack_size AS approved_pack_size,k.pack_uom AS approved_pack_uom,
   k.manufacturing_cop_per_sku AS approved_manufacturing_cop_per_pack,
   k.manufacturing_cop_status AS approved_rate_status,
   CASE
     WHEN t.version_rank>1 THEN 'EXCLUDED_SUPERSEDED'
     WHEN coalesce(t.is_cancelled,false) THEN 'EXCLUDED_CANCELLED'
     WHEN coalesce(t.is_optional,false) THEN 'EXCLUDED_OPTIONAL'
     WHEN a.sku_id IS NULL THEN 'SKU_UNMAPPED'
     WHEN ps.id IS NULL THEN 'SKU_MASTER_MISSING'
     WHEN k.sku_id IS NULL THEN 'NO_APPROVED_RATE'
     WHEN k.manufacturing_cop_status IS DISTINCT FROM 'READY'
        OR k.manufacturing_cop_per_sku IS NULL
        OR k.manufacturing_cop_per_sku<0 THEN 'RATE_UNUSABLE'
     WHEN ps.pack_size IS DISTINCT FROM k.pack_size
       OR ps.uom IS DISTINCT FROM k.pack_uom THEN 'PACK_DEFINITION_MISMATCH'
     WHEN coalesce(public.f_norm_key(t.qty_unit_text),'') NOT IN
       ('btl','bottle','nos','no','pcs','piece','pack','pkt',
        'box','jar','tin','tube','sachet','strip','unit','units')
       THEN 'QUANTITY_NOT_IN_PACKS'
     WHEN t.qty_value IS NULL OR t.qty_value<=0 THEN 'QUANTITY_UNUSABLE'
     ELSE 'COVERED'
   END AS coverage_reason
 FROM ranked t
 LEFT JOIN public.sku_aliases a ON a.alias_key=public.f_norm_key(t.item_name)
 LEFT JOIN public.product_skus ps ON ps.id=a.sku_id
 LEFT JOIN costing.sku_internal_loaded_cost_snapshot k
   ON k.refresh_run_id=143 AND k.sku_id=a.sku_id
), source_projection AS (
 SELECT jsonb_agg(jsonb_build_array(
  transfer_store,voucher_guid,inventory_line_no,batch_line_no,
  raw_godown,voucher_alterid,id,voucher_date,source_key,item_name,
  batch_code,qty_value,qty_unit_text,transfer_amount,is_cancelled,is_optional,
  version_rank,sku_id,current_pack_size,current_pack_uom,
  approved_pack_size,approved_pack_uom,approved_manufacturing_cop_per_pack,
  approved_rate_status,coverage_reason
 ) ORDER BY transfer_store,coalesce(nullif(voucher_guid,''),'__NO_GUID__'),
 inventory_line_no,batch_line_no,coalesce(raw_godown,''),version_rank,id) AS source_json
 FROM priced
), frozen AS (
 SELECT jsonb_build_object(
 'schema_version',1,
 'policy','TALLY_LATEST_ALTERATION_COP_REFERENCE_V1',
 'report_month','2026-11-01',
 'as_of_cutoff','2026-11-21',
 'tally_snapshot_as_of','2026-11-23',
 'approved_cost_run_id',143,
 'source_line_count',(SELECT count(*) FROM priced),
 'distinct_original_line_ids',(SELECT count(DISTINCT id) FROM priced),
 'alias_join_cardinality_safe',(SELECT count(*)=count(DISTINCT id) FROM priced),
 'eligible_line_count',(SELECT count(*) FROM priced WHERE coverage_reason NOT IN
    ('EXCLUDED_SUPERSEDED','EXCLUDED_CANCELLED','EXCLUDED_OPTIONAL')),
 'covered_line_count',(SELECT count(*) FROM priced WHERE coverage_reason='COVERED'),
 'uncovered_line_count',(SELECT count(*) FROM priced WHERE coverage_reason NOT IN
    ('COVERED','EXCLUDED_SUPERSEDED','EXCLUDED_CANCELLED','EXCLUDED_OPTIONAL')),
 'canonical_book_amount',(SELECT round(sum(transfer_amount),2) FROM priced
   WHERE coverage_reason NOT IN ('EXCLUDED_SUPERSEDED','EXCLUDED_CANCELLED','EXCLUDED_OPTIONAL')),
 'manufacturing_cop_reference_subtotal',(SELECT round(sum(qty_value*approved_manufacturing_cop_per_pack),2)
   FROM priced WHERE coverage_reason='COVERED'),
 'source_projection_sha256',(SELECT encode(sha256(convert_to(source_json::text,'UTF8')),'hex') FROM source_projection),
 'source_completeness_status','NOT_CERTIFIED',
 'completion_status','NOT_VERIFIED'
 ) payload
)
SELECT payload->>'source_line_count' source_lines,
payload->>'distinct_original_line_ids' distinct_source_lines,
payload->>'alias_join_cardinality_safe' alias_join_cardinality_safe,
payload->>'eligible_line_count' eligible_lines,
payload->>'covered_line_count' covered_lines,
payload->>'uncovered_line_count' uncovered_lines,
payload->>'canonical_book_amount' book_amount,
payload->>'manufacturing_cop_reference_subtotal' manufacturing_reference,
payload->>'source_projection_sha256' source_digest,
encode(sha256(convert_to(payload::text,'UTF8')),'hex') frozen_payload_digest
FROM frozen;
COMMIT;
-- In a future full S3 writer, source_projection JSON AND frozen numeric payload
-- must be stored or sufficiently reproducible without retained costing run.
-- The test returns only their digests and aggregates. JSONB textual canonical
-- format must be versioned before any production signing acceptance.
-- Cross-store ETL manifest, source corrections and approval transitions remain
-- separate authorities; no client-supplied monetary payload is trusted.
