-- Exact live pg_get_viewdef capture, 2026-11-25, md5 4d728516b89a094376e60b95be12323d
CREATE OR REPLACE VIEW costing.v_costing_period_run_status AS
 WITH periods AS (
         SELECT cost_periods.period_start
           FROM costing.cost_periods
        UNION
         SELECT costing_refresh_run.period_start
           FROM costing.costing_refresh_run
        ), ptr AS (
         SELECT v_current_successful_costing_refresh_run.refresh_run_id,
            v_current_successful_costing_refresh_run.period_start,
            v_current_successful_costing_refresh_run.valuation_date,
            v_current_successful_costing_refresh_run.overall_status,
            v_current_successful_costing_refresh_run.valuation_context_source,
            v_current_successful_costing_refresh_run.source_trigger,
            v_current_successful_costing_refresh_run.requested_scope,
            v_current_successful_costing_refresh_run.requested_at,
            v_current_successful_costing_refresh_run.started_at,
            v_current_successful_costing_refresh_run.finished_at,
            v_current_successful_costing_refresh_run.selection_basis
           FROM costing.v_current_successful_costing_refresh_run
        ), latest_success AS (
         SELECT DISTINCT ON (r.period_start) r.period_start,
            r.id,
            r.finished_at,
            e.designation
           FROM (costing.costing_refresh_run r
             LEFT JOIN costing.v_costing_run_effective_designation e ON ((e.refresh_run_id = r.id)))
          WHERE ((r.overall_status = 'SUCCESS'::text) AND (r.valuation_context_source = 'CAPTURED_AT_REQUEST'::text))
          ORDER BY r.period_start, r.finished_at DESC NULLS LAST, r.id DESC
        ), active AS (
         SELECT DISTINCT ON (r.period_start) r.period_start,
            r.id,
            r.overall_status,
            r.current_stage_code
           FROM costing.costing_refresh_run r
          WHERE (r.overall_status = ANY (ARRAY['QUEUED'::text, 'RUNNING'::text]))
          ORDER BY r.period_start, r.requested_at DESC, r.id DESC
        ), base AS (
         SELECT p.period_start,
            cp.status AS period_status,
            cp.valuation_date,
            cp.valuation_date_status,
            ptr.refresh_run_id AS displayed_run_id,
            ptr.selection_basis AS displayed_run_basis,
                CASE
                    WHEN (ptr.selection_basis = 'APPROVED'::text) THEN ptr.refresh_run_id
                    ELSE NULL::bigint
                END AS approved_run_id,
            e.designated_at AS approved_at,
            e.designated_by AS approved_by,
            ls.id AS latest_success_run_id,
            ls.finished_at AS latest_success_finished_at,
                CASE
                    WHEN ((ptr.selection_basis = 'APPROVED'::text) AND (ls.id IS DISTINCT FROM ptr.refresh_run_id) AND (COALESCE(ls.designation, ''::text) <> ALL (ARRAY['APPROVED'::text, 'REFERENCE'::text]))) THEN ls.id
                    ELSE NULL::bigint
                END AS newer_draft_run_id,
            a.id AS active_run_id,
            a.overall_status AS active_run_status,
            a.current_stage_code AS active_run_stage
           FROM (((((periods p
             LEFT JOIN costing.cost_periods cp ON ((cp.period_start = p.period_start)))
             LEFT JOIN ptr ON ((ptr.period_start = p.period_start)))
             LEFT JOIN costing.v_costing_run_effective_designation e ON (((e.refresh_run_id = ptr.refresh_run_id) AND (ptr.selection_basis = 'APPROVED'::text))))
             LEFT JOIN latest_success ls ON ((ls.period_start = p.period_start)))
             LEFT JOIN active a ON ((a.period_start = p.period_start)))
        )
 SELECT b.period_start,
    b.period_status,
    b.valuation_date,
    b.valuation_date_status,
    b.displayed_run_id,
    b.displayed_run_basis,
    b.approved_run_id,
    b.approved_at,
    b.approved_by,
    b.latest_success_run_id,
    b.latest_success_finished_at,
    b.newer_draft_run_id,
    b.active_run_id,
    b.active_run_status,
    b.active_run_stage,
        CASE
            WHEN (b.displayed_run_id IS NULL) THEN 'NO_SUCCESSFUL_RUN'::text
            WHEN ((b.displayed_run_basis = 'APPROVED'::text) AND (b.newer_draft_run_id IS NOT NULL)) THEN 'APPROVED_NEWER_DRAFT'::text
            WHEN (b.displayed_run_basis = 'APPROVED'::text) THEN 'APPROVED'::text
            WHEN (b.displayed_run_basis = 'REFERENCE_FALLBACK'::text) THEN 'REFERENCE_NOT_APPROVED'::text
            ELSE 'DRAFT'::text
        END AS display_state,
        CASE
            WHEN (b.displayed_run_id IS NULL) THEN 'No successful run'::text
            WHEN ((b.displayed_run_basis = 'APPROVED'::text) AND (b.newer_draft_run_id IS NOT NULL)) THEN (((('Approved run '::text || b.displayed_run_id) || ' (newer DRAFT run '::text) || b.newer_draft_run_id) || ' - not approved)'::text)
            WHEN (b.displayed_run_basis = 'APPROVED'::text) THEN ('Approved run '::text || b.displayed_run_id)
            WHEN (b.displayed_run_basis = 'REFERENCE_FALLBACK'::text) THEN (('Reference run '::text || b.displayed_run_id) || ' - not approved'::text)
            ELSE (('DRAFT run '::text || b.displayed_run_id) || ' - not approved'::text)
        END AS display_label,
    ((b.approved_run_id IS NOT NULL) AND (b.period_start = max(b.period_start) FILTER (WHERE (b.approved_run_id IS NOT NULL)) OVER ())) AS is_latest_approved_period,
    x.approved_run_valuation_date,
    x.approved_run_valuation_date AS official_valuation_date,
    x.latest_draft_run_id,
    x.latest_draft_valuation_date,
    x.newer_draft_count,
    x.superseded_run_ids,
    COALESCE(cardinality(x.superseded_run_ids), 0) AS superseded_run_count,
        CASE
            WHEN ((b.approved_run_id IS NOT NULL) AND (b.period_start = max(b.period_start) FILTER (WHERE (b.approved_run_id IS NOT NULL)) OVER ())) THEN concat('In use for pricing: approved run ', b.approved_run_id, ' (', to_char((x.approved_run_valuation_date)::timestamp with time zone, 'DD Mon YYYY'::text), ')')
            WHEN (b.approved_run_id IS NOT NULL) THEN concat('Approved run ', b.approved_run_id, ' (', to_char((x.approved_run_valuation_date)::timestamp with time zone, 'DD Mon YYYY'::text), '); a later month is in use for pricing')
            ELSE 'Not for pricing: no approved run'::text
        END AS pricing_use_label,
        CASE
            WHEN (b.displayed_run_id IS NULL) THEN 'No successful run'::text
            WHEN ((b.approved_run_id IS NOT NULL) AND (x.newer_draft_count > 0)) THEN concat('Approved run ', b.approved_run_id, ' (', to_char((x.approved_run_valuation_date)::timestamp with time zone, 'DD Mon'::text), ') in use; newer draft ', x.latest_draft_run_id, ' (', to_char((x.latest_draft_valuation_date)::timestamp with time zone, 'DD Mon'::text), ') for review - not for pricing')
            WHEN (b.approved_run_id IS NOT NULL) THEN concat('Approved run ', b.approved_run_id, ' (', to_char((x.approved_run_valuation_date)::timestamp with time zone, 'DD Mon'::text), ')')
            WHEN (b.displayed_run_basis = 'REFERENCE_FALLBACK'::text) THEN (('Reference run '::text || b.displayed_run_id) || ' - not for pricing'::text)
            ELSE (('Draft run '::text || b.displayed_run_id) || ' - not for pricing'::text)
        END AS display_label_v2
   FROM (base b
     LEFT JOIN LATERAL ( SELECT ( SELECT rr.valuation_date
                   FROM costing.costing_refresh_run rr
                  WHERE (rr.id = b.approved_run_id)) AS approved_run_valuation_date,
            ld.id AS latest_draft_run_id,
            ld.valuation_date AS latest_draft_valuation_date,
            ( SELECT count(*) AS count
                   FROM (costing.costing_refresh_run d
                     LEFT JOIN costing.v_costing_run_effective_designation de ON ((de.refresh_run_id = d.id)))
                  WHERE ((d.period_start = b.period_start) AND (d.overall_status = 'SUCCESS'::text) AND (d.valuation_context_source = 'CAPTURED_AT_REQUEST'::text) AND (de.designation IS NULL) AND ((b.approved_run_id IS NULL) OR (d.finished_at > ( SELECT ar.finished_at
                           FROM costing.costing_refresh_run ar
                          WHERE (ar.id = b.approved_run_id)))))) AS newer_draft_count,
            ( SELECT array_agg(s.refresh_run_id ORDER BY s.refresh_run_id) AS array_agg
                   FROM costing.v_costing_run_effective_designation s
                  WHERE ((s.period_start = b.period_start) AND (s.designation = 'REVOKED'::text))) AS superseded_run_ids
           FROM (( SELECT NULL::integer AS dummy) one
             LEFT JOIN LATERAL ( SELECT d.id,
                    d.valuation_date
                   FROM (costing.costing_refresh_run d
                     LEFT JOIN costing.v_costing_run_effective_designation de ON ((de.refresh_run_id = d.id)))
                  WHERE ((d.period_start = b.period_start) AND (d.overall_status = 'SUCCESS'::text) AND (d.valuation_context_source = 'CAPTURED_AT_REQUEST'::text) AND (de.designation IS NULL))
                  ORDER BY d.finished_at DESC NULLS LAST, d.id DESC
                 LIMIT 1) ld ON (true))) x ON (true));
