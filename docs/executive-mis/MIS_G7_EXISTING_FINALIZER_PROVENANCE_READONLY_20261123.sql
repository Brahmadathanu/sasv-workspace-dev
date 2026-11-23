-- Executive MIS G7: existing Tally finalizer manifest and publication-job proof.
-- READ ONLY. Never call finalize_fg_transfer_snapshot or rebuild functions here.
-- Fixed 2026-11-21..23 demonstration window. Not a universal completeness certificate.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '7500ms';
WITH finals AS (
  SELECT DISTINCT ON (j.params->>'as_of_date',upper(j.params->>'store'))
         j.id,j.params->>'as_of_date' as dt,
         upper(j.params->>'store') as store,
         j.params->'expected_keys' as expected_keys,
         j.created_at,j.finished_at
  FROM public.etl_jobs j
  WHERE j.job_type='FINALIZE_FG_TRANSFER_SNAPSHOT'
    AND j.status='done'
    AND j.params->>'validation_status'='ACCEPTED'
    AND j.params->>'as_of_date' IN ('2026-11-21','2026-11-22','2026-11-23')
    AND jsonb_typeof(j.params->'expected_keys')='array'
  ORDER BY j.params->>'as_of_date',upper(j.params->>'store'),j.finished_at DESC,j.id DESC
), observed AS (
  SELECT as_of_date::text dt,transfer_store store,
         jsonb_agg(DISTINCT source_key ORDER BY source_key) keys,
         count(*) rows
  FROM public.tally_fg_transfer_voucher_lines
  WHERE as_of_date IN ('2026-11-21','2026-11-22','2026-11-23')
  GROUP BY 1,2
)
SELECT f.dt,f.store,f.id AS finalizer_job_id,
       jsonb_array_length(f.expected_keys) declared_keys,
       jsonb_array_length(o.keys) observed_keys,
       f.expected_keys=o.keys AS manifests_equal,
       o.rows AS original_line_count,
       f.finished_at
FROM finals f JOIN observed o USING(dt,store)
ORDER BY f.dt,f.store;

-- Plan existence at the queued finalizer job, compared to later parse completion.
-- Job-key match may see successful duplicate parses from prior reruns; use EXISTS per key.
WITH finals AS (
  SELECT DISTINCT ON (upper(j.params->>'store'))
         j.id,upper(j.params->>'store') store,
         j.params->'expected_keys' keys,j.created_at,j.finished_at
  FROM public.etl_jobs j
  WHERE j.job_type='FINALIZE_FG_TRANSFER_SNAPSHOT'
    AND j.status='done'
    AND j.params->>'validation_status'='ACCEPTED'
    AND j.params->>'as_of_date'='2026-11-23'
  ORDER BY upper(j.params->>'store'),j.finished_at DESC,j.id DESC
), proof AS (
 SELECT f.*,
    (SELECT min(h.changed_at) FROM public.etl_job_status_history h
      WHERE h.job_id=f.id AND h.new_status::text='queued') queued_at,
    (SELECT max(x.last_parse_finished) FROM jsonb_array_elements_text(f.keys) k(key)
      CROSS JOIN LATERAL (
         SELECT max(j.finished_at) last_parse_finished
         FROM public.etl_jobs j
         WHERE j.job_type='PARSE_FG_TRANSFER_CHUNK' AND j.status='done'
           AND j.params->>'as_of_date'='2026-11-23'
           AND upper(j.params->>'store')=f.store
           AND j.params->>'source_key'=k.key
      ) x
    ) last_parse_finished_at
 FROM finals f
)
SELECT store,id AS finalizer_job_id,jsonb_array_length(keys) expected_file_count,
       created_at,queued_at,last_parse_finished_at,finished_at,
       queued_at < last_parse_finished_at AS queued_before_latest_parse_completed
FROM proof ORDER BY store;
COMMIT;
-- Decision boundary: these are durable job-level operational receipts. They do not
-- prove the external planner's expected keys derive from an independent plan or
-- prove immutability of job params / original voucher snapshots. NOT_CERTIFIED remains.
