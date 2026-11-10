-- WP05 W5-06 VIEW DEFINITION SNAPSHOT, READ-ONLY PG17.4 on 2026-11-09.
-- Schema-only fixture; no individual staff, salary or other row data included.
-- This is pg_get_viewdef(oid) DEFAULT pretty flag, exactly as draft migration consumes.
-- DO NOT RUN against production; recreate required dependencies using SYNTHETIC scaffold ONLY.
-- Hashes are md5(pg_get_viewdef(oid)) on live PG17.4 before CONF-01.
-- These definitions are trusted as verification fixtures, not permissions to apply migration.

-- v_costing_staff_classification_register: 2447f6b30fdc11e5e5dac487619b9142
create or replace view public.v_costing_staff_classification_register as
 SELECT staff_id,
    employee_code,
    designation,
    staff_is_active,
    latest_salary_period_start,
    basic_salary,
    allowance_amount,
    employer_contribution,
    other_salary_cost,
    total_salary_cost,
    salary_source_note,
    classification_id,
    costing_class,
    costing_class_label,
    allocation_pool,
    effective_from,
    effective_to,
    allocation_weight,
    remarks,
    classification_is_active,
    classification_created_at,
    classification_updated_at,
    classification_status,
    classification_note,
    staff_display_name
   FROM ( WITH latest_salary AS (
                 SELECT DISTINCT ON (c.staff_id) c.staff_id,
                    c.period_start AS latest_salary_period_start,
                    c.basic_salary,
                    c.allowance_amount,
                    c.employer_contribution,
                    c.other_salary_cost,
                    c.total_salary_cost,
                    c.source_note AS salary_source_note
                   FROM hr.staff_compensation_monthly c
                  WHERE (c.is_active = true)
                  ORDER BY c.staff_id, c.period_start DESC
                ), latest_active_class AS (
                 SELECT DISTINCT ON (cls_1.staff_id) cls_1.id AS classification_id,
                    cls_1.staff_id,
                    cls_1.costing_class,
                    cls_1.allocation_pool,
                    cls_1.effective_from,
                    cls_1.effective_to,
                    cls_1.allocation_weight,
                    cls_1.remarks,
                    cls_1.is_active,
                    cls_1.created_at,
                    cls_1.updated_at
                   FROM costing.staff_costing_classification cls_1
                  WHERE ((cls_1.is_active = true) AND (cls_1.effective_to IS NULL))
                  ORDER BY cls_1.staff_id, cls_1.effective_from DESC, cls_1.id DESC
                )
         SELECT s.id AS staff_id,
            s.employee_code,
            s.designation,
            s.is_active AS staff_is_active,
            sal.latest_salary_period_start,
            sal.basic_salary,
            sal.allowance_amount,
            sal.employer_contribution,
            sal.other_salary_cost,
            sal.total_salary_cost,
            sal.salary_source_note,
            cls.classification_id,
            cls.costing_class,
            COALESCE(opt.costing_class_label, cls.costing_class) AS costing_class_label,
            cls.allocation_pool,
            cls.effective_from,
            cls.effective_to,
            cls.allocation_weight,
            cls.remarks,
            cls.is_active AS classification_is_active,
            cls.created_at AS classification_created_at,
            cls.updated_at AS classification_updated_at,
                CASE
                    WHEN (s.is_active IS NOT TRUE) THEN 'INACTIVE_STAFF'::text
                    WHEN (sal.staff_id IS NULL) THEN 'MISSING_SALARY'::text
                    WHEN (cls.classification_id IS NULL) THEN 'UNCLASSIFIED'::text
                    WHEN (cls.allocation_pool = 'EXCLUDED'::text) THEN 'EXCLUDED'::text
                    ELSE 'CLASSIFIED'::text
                END AS classification_status,
                CASE
                    WHEN (s.is_active IS NOT TRUE) THEN 'Staff is inactive in HR master.'::text
                    WHEN (sal.staff_id IS NULL) THEN 'No active salary compensation row found for this staff.'::text
                    WHEN (cls.classification_id IS NULL) THEN 'No active costing classification found.'::text
                    WHEN (cls.allocation_pool = 'EXCLUDED'::text) THEN 'Staff is excluded from product costing.'::text
                    ELSE 'Staff costing classification is active.'::text
                END AS classification_note,
            s.full_name AS staff_display_name
           FROM (((hr.staff s
             LEFT JOIN latest_salary sal ON ((sal.staff_id = s.id)))
             LEFT JOIN latest_active_class cls ON ((cls.staff_id = s.id)))
             LEFT JOIN v_costing_staff_costing_class_options opt ON ((opt.costing_class = cls.costing_class)))) q
  WHERE ( SELECT fn_costing_view_allowed() AS fn_costing_view_allowed);

-- v_costing_staff_cost_pool_summary: 80d1a1a4f2e3add5eae58acac99e14fd
create or replace view public.v_costing_staff_cost_pool_summary as
 SELECT period_start,
    allocation_pool,
    costing_class,
    costing_class_label,
    staff_count,
    pool_amount,
    staff_details,
    pool_status
   FROM ( SELECT p.period_start,
            p.allocation_pool,
            p.costing_class,
            COALESCE(opt.costing_class_label, p.costing_class) AS costing_class_label,
            p.staff_count,
            p.pool_amount,
            p.staff_details,
                CASE
                    WHEN ((p.pool_amount IS NULL) OR (p.pool_amount = (0)::numeric)) THEN 'REVIEW_REQUIRED'::text
                    ELSE 'READY'::text
                END AS pool_status
           FROM (costing.v_staff_cost_pool_monthly p
             LEFT JOIN v_costing_staff_costing_class_options opt ON ((opt.costing_class = p.costing_class)))) q
  WHERE ( SELECT fn_costing_view_allowed() AS fn_costing_view_allowed);

-- v_costing_unclassified_staff_for_costing: 659a7d0e992a7bae23b4b0409d33a161
create or replace view public.v_costing_unclassified_staff_for_costing as
 SELECT staff_id,
    employee_code,
    designation,
    staff_is_active,
    latest_salary_period_start,
    basic_salary,
    allowance_amount,
    employer_contribution,
    other_salary_cost,
    total_salary_cost,
    salary_source_note,
    classification_id,
    costing_class,
    costing_class_label,
    allocation_pool,
    effective_from,
    effective_to,
    allocation_weight,
    remarks,
    classification_is_active,
    classification_created_at,
    classification_updated_at,
    classification_status,
    classification_note,
    staff_display_name
   FROM ( SELECT r.staff_id,
            r.employee_code,
            r.designation,
            r.staff_is_active,
            r.latest_salary_period_start,
            r.basic_salary,
            r.allowance_amount,
            r.employer_contribution,
            r.other_salary_cost,
            r.total_salary_cost,
            r.salary_source_note,
            r.classification_id,
            r.costing_class,
            r.costing_class_label,
            r.allocation_pool,
            r.effective_from,
            r.effective_to,
            r.allocation_weight,
            r.remarks,
            r.classification_is_active,
            r.classification_created_at,
            r.classification_updated_at,
            r.classification_status,
            r.classification_note,
            r.staff_display_name
           FROM v_costing_staff_classification_register r
          WHERE ((r.staff_is_active = true) AND ((r.classification_status = ANY (ARRAY['UNCLASSIFIED'::text, 'MISSING_SALARY'::text])) OR (r.total_salary_cost IS NULL) OR (r.total_salary_cost = (0)::numeric)))) q
  WHERE ( SELECT fn_costing_view_allowed() AS fn_costing_view_allowed);
