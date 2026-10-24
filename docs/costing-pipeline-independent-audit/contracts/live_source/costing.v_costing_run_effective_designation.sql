 SELECT DISTINCT ON (refresh_run_id) refresh_run_id,
    period_start,
    designation,
    designated_by,
    designated_at,
    reason,
    fingerprint_id,
    id AS designation_id
   FROM costing.costing_run_designation d
  ORDER BY refresh_run_id, designated_at DESC, id DESC;