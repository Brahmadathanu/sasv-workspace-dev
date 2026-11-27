-- Executive MIS G7: source-backed operational ETL publication proof, NOT immutable certification.
-- READ ONLY demo fixed to 2026-11-23; review the query before adapting date/store.
-- Every declared chunk derives from FINALIZE_FG_TRANSFER_SNAPSHOT job params,
-- not from rows in tally_fg_transfer_voucher_lines.
BEGIN READ ONLY;
SET LOCAL statement_timeout='7500ms';
WITH finals AS (
 SELECT DISTINCT ON (upper(params->>'store'))
 id,upper(params->>'store') store,params->'expected_keys' keys,finished_at
 FROM public.etl_jobs
 WHERE job_type='FINALIZE_FG_TRANSFER_SNAPSHOT' AND status='done'
   AND params->>'validation_status'='ACCEPTED'
   AND params->>'as_of_date'='2026-11-23'
   AND jsonb_typeof(params->'expected_keys')='array'
 ORDER BY upper(params->>'store'),finished_at DESC,id DESC
), declared AS (
 SELECT f.store,f.id finalizer_id,f.finished_at,k.key
 FROM finals f CROSS JOIN LATERAL jsonb_array_elements_text(f.keys) k(key)
), observed AS (
 SELECT transfer_store store,source_key,count(*) cnt
 FROM public.tally_fg_transfer_voucher_lines
 WHERE as_of_date='2026-11-23'
 GROUP BY 1,2
), provenance AS (
 SELECT d.*,coalesce(o.cnt,0) published_rows,
 (SELECT j.params FROM public.etl_jobs j
  WHERE j.job_type='PARSE_FG_TRANSFER_CHUNK' AND j.status='done'
    AND j.params->>'as_of_date'='2026-11-23'
    AND upper(j.params->>'store')=d.store
    AND j.params->>'source_key'=d.key
  ORDER BY j.finished_at DESC NULLS LAST,j.created_at DESC LIMIT 1
 ) parse_params,
 EXISTS (SELECT 1 FROM public.etl_jobs j
   WHERE j.job_type='FETCH_XML' AND j.status='done'
     AND j.params->>'save_key'=d.key) fetched
 FROM declared d LEFT JOIN observed o ON o.store=d.store AND o.source_key=d.key
), checked AS (
 SELECT *,
 (fetched
 AND parse_params->>'parse_status'='SUCCESS'
 AND CASE WHEN parse_params->>'parsed_row_count' ~ '^[0-9]+$'
          THEN (parse_params->>'parsed_row_count')::numeric
          ELSE NULL END = published_rows
 AND parse_params->>'source_hash' ~* '^[0-9a-f]{64}$'
 AND parse_params->>'source_size_bytes' ~ '^[0-9]+$') passed
 FROM provenance
)
SELECT store,count(*) declared_files,
 count(*) FILTER(WHERE passed) verified_files,
 sum(published_rows) matched_voucher_rows,
 (count(*)=count(*) FILTER(WHERE passed)
 AND NOT EXISTS (
  SELECT 1 FROM observed o WHERE o.store=checked.store
  AND NOT EXISTS (
   SELECT 1 FROM declared d
   WHERE d.store=o.store AND d.key=o.source_key
  )
 )) AS operational_matched,
 max(finalizer_id::text) finalizer_id
FROM checked
GROUP BY store ORDER BY store;
COMMIT;
-- Checks 8/8 observed declared keys, parse/fetch success, count/hash/size shape,
-- and no undeclared populated source keys. This does not check source hash bytes
-- in storage, external planning authority, ETL admin mutation, concurrency,
-- publication under an immutable record, or cross-store atomicity.
-- DO NOT label this as SNAPSHOT_CERTIFIED_COMPLETE.
