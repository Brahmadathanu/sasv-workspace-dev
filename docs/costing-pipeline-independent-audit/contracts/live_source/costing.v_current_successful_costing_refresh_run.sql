 SELECT refresh_run_id,
    period_start,
    valuation_date,
    overall_status,
    valuation_context_source,
    source_trigger,
    requested_scope,
    requested_at,
    started_at,
    finished_at,
    selection_basis
   FROM ( SELECT r.id AS refresh_run_id,
            r.period_start,
            r.valuation_date,
            r.overall_status,
            r.valuation_context_source,
            r.source_trigger,
            r.requested_scope,
            r.requested_at,
            r.started_at,
            r.finished_at,
                CASE e.designation
                    WHEN 'APPROVED'::text THEN 'APPROVED'::text
                    WHEN 'REFERENCE'::text THEN 'REFERENCE_FALLBACK'::text
                    ELSE 'LATEST_SUCCESS'::text
                END AS selection_basis,
            row_number() OVER (PARTITION BY r.period_start ORDER BY
                CASE e.designation
                    WHEN 'APPROVED'::text THEN 1
                    WHEN 'REFERENCE'::text THEN 3
                    ELSE 2
                END, r.finished_at DESC NULLS LAST, r.id DESC) AS governed_run_rank
           FROM (costing.costing_refresh_run r
             LEFT JOIN costing.v_costing_run_effective_designation e ON (((e.refresh_run_id = r.id) AND (e.designation = ANY (ARRAY['REFERENCE'::text, 'APPROVED'::text])))))
          WHERE ((r.overall_status = 'SUCCESS'::text) AND (r.valuation_context_source = 'CAPTURED_AT_REQUEST'::text))) ranked
  WHERE (governed_run_rank = 1);