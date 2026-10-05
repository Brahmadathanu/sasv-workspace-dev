-- WP04-G4 C correctness correction V3. PROPOSAL ONLY; NOT AUTHORIZED; NOT RUN.
-- Addresses only C-R01 and C-R02 from C_EXACT_REVIEW.md.
-- Preserves frozen C source and all prior evidence. No canonical/core/portfolio calls.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
SET LOCAL idle_in_transaction_session_timeout='30s';

DO $guard$
DECLARE n bigint; fingerprint text; latest bigint;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'C-V3 unexpected owner'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)'))) IS DISTINCT FROM 'c29e8b289304e7ece6f7affcccb6ffd8' THEN RAISE EXCEPTION 'C-V3 original run-evidence source drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='costing' AND p.proname='fn_wp04_c_run_assemble') THEN RAISE EXCEPTION 'C-V3 assembler name collision'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('costing.uq_admin_finance_run_sku') AND indisunique AND indisvalid AND indisready AND pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX uq_admin_finance_run_sku ON costing.sku_admin_finance_overhead_allocation_snapshot USING btree (refresh_run_id, sku_id) WHERE (refresh_run_id IS NOT NULL)')
 OR NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('costing.uq_direct_labour_run_sku') AND indisunique AND indisvalid AND indisready AND pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX uq_direct_labour_run_sku ON costing.sku_direct_labour_allocation_snapshot USING btree (refresh_run_id, sku_id) WHERE (refresh_run_id IS NOT NULL)')
 OR NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('costing.uq_marketing_run_sku') AND indisunique AND indisvalid AND indisready AND pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX uq_marketing_run_sku ON costing.sku_marketing_expense_allocation_snapshot USING btree (refresh_run_id, sku_id) WHERE (refresh_run_id IS NOT NULL)')
 OR NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('costing.sku_materials_stores_allocation_snapshot_run_sku_uq') AND indisunique AND indisvalid AND indisready AND pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX sku_materials_stores_allocation_snapshot_run_sku_uq ON costing.sku_materials_stores_allocation_snapshot USING btree (refresh_run_id, sku_id)')
 OR NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('costing.sku_production_overhead_allocation_sn_refresh_run_id_sku_id_key') AND indisunique AND indisvalid AND indisready AND pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX sku_production_overhead_allocation_sn_refresh_run_id_sku_id_key ON costing.sku_production_overhead_allocation_snapshot USING btree (refresh_run_id, sku_id)')
 OR NOT EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('costing.sku_qc_allocation_snapshot_run_sku_uq') AND indisunique AND indisvalid AND indisready AND pg_get_indexdef(indexrelid)='CREATE UNIQUE INDEX sku_qc_allocation_snapshot_run_sku_uq ON costing.sku_qc_allocation_snapshot USING btree (refresh_run_id, sku_id)')
 THEN RAISE EXCEPTION 'C-V3 exact unique run/SKU key drift'; END IF;
 IF (SELECT valuation_date FROM costing.cost_periods WHERE period_start='2026-09-01'::date) IS DISTINCT FROM '2026-09-10'::date THEN RAISE EXCEPTION 'C-V3 governed context drift'; END IF;
 SELECT id INTO latest FROM costing.costing_refresh_run WHERE period_start='2026-09-01'::date AND valuation_date='2026-09-10'::date AND overall_status='SUCCESS' ORDER BY finished_at DESC NULLS LAST,id DESC LIMIT 1;
 IF latest IS DISTINCT FROM 115::bigint THEN RAISE EXCEPTION 'C-V3 SUCCESS run drift'; END IF;
 SELECT count(*),md5(coalesce(jsonb_agg(jsonb_build_array(s.id,s.product_id) ORDER BY s.id),'[]'::jsonb)::text)
 INTO n,fingerprint FROM public.product_skus s JOIN public.products p ON p.id=s.product_id
 WHERE p.status='Active' AND s.is_active AND NOT coalesce(s.is_sample,false);
 IF n IS DISTINCT FROM 611::bigint OR fingerprint IS DISTINCT FROM 'eeba4bf20f54589fe5b037173a79ed82' THEN RAISE EXCEPTION 'C-V3 operational membership drift'; END IF;
END $guard$;

CREATE OR REPLACE FUNCTION costing.fn_wp04_c_run_assemble(p_sku_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint,p_dl costing.sku_direct_labour_allocation_snapshot,p_poh costing.sku_production_overhead_allocation_snapshot,p_qc costing.sku_qc_allocation_snapshot,p_ms costing.sku_materials_stores_allocation_snapshot,p_af costing.sku_admin_finance_overhead_allocation_snapshot,p_mk costing.sku_marketing_expense_allocation_snapshot)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO costing,public,pg_temp AS $function$
with dl as (select (p_dl).* where (p_dl).id is not null),
poh as (select (p_poh).* where (p_poh).id is not null),
qc as (select (p_qc).* where (p_qc).id is not null),
ms as (select (p_ms).* where (p_ms).id is not null),
af as (select (p_af).* where (p_af).id is not null),
mk as (select (p_mk).* where (p_mk).id is not null),
scheme as (
 select coalesce(jsonb_agg(jsonb_build_object('region_code',region_code,'raw_status',resolution_status,'effective_status',resolution_status,'resolution_source',policy_source,'reason_code',resolution_status,'note',resolution_note,'evidence_ids',jsonb_build_object('scheme_id',scheme_id,'policy_rule_id',policy_rule_id)) order by region_code),'[]'::jsonb) rows,
        count(*) n,
        bool_or(resolution_status not in ('RESOLVED','DEFAULT_NO_SCHEME')) bad
 from costing.sku_selected_scheme_policy_context_snapshot
 where sku_id=p_sku_id and period_start=p_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id),
regional as (
 select coalesce(jsonb_agg(jsonb_build_object('region_code',region_code,'raw_status',raw_status,'effective_status',effective_status,'resolution_source',regional_basis_source,'reason_code',regional_basis_status,'acceptance_eligible',is_acceptance_eligible,'accepted',is_accepted,'evidence_ids',jsonb_build_object('regional_marketing_snapshot_id',regional_marketing_snapshot_id,'regional_basis_snapshot_id',regional_basis_snapshot_id,'acceptance_id',acceptance_id)) order by region_code),'[]'::jsonb) rows,
        count(*) n,
        bool_or(effective_status='BLOCKED') blocked,
        bool_or(effective_status='REVIEW_REQUIRED') review
 from costing.v_regional_marketing_evidence_review_queue
 where sku_id=p_sku_id and period_start=p_period_start and valuation_date=p_valuation_date and refresh_run_id=p_refresh_run_id)
select jsonb_build_object(
 'snapshot_present',coalesce((select true from dl),false) or coalesce((select true from poh),false) or coalesce((select true from qc),false) or coalesce((select true from ms),false) or coalesce((select true from af),false) or coalesce((select true from mk),false),
 'driver_dependencies',jsonb_build_array(
  jsonb_build_object('dependency_code','DIRECT_LABOUR','label','Direct Labour','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select direct_labour_allocation_status from dl),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_reason_code from dl),'note',(select direct_labour_allocation_note from dl),'owner_module','PRODUCTION_ROUTE_MANAGER','recommended_ui_route','PRODUCTION_ROUTE_MANAGER','authority','costing.sku_direct_labour_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from dl),'policy_id',(select policy_id from dl))),
  jsonb_build_object('dependency_code','PRODUCTION_OVERHEAD','label','Production Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select allocation_status from poh),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_reason_code from poh),'note',(select allocation_note from poh),'owner_module','PRODUCTION_ROUTE_MANAGER','recommended_ui_route','PRODUCTION_ROUTE_MANAGER','authority','costing.sku_production_overhead_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from poh),'policy_id',(select policy_id from poh))),
  jsonb_build_object('dependency_code','QUALITY_CONTROL_OVERHEAD','label','Quality Control Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select allocation_status from qc),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_reason_code from qc),'note',(select allocation_note from qc),'owner_module','COST_SHEET_REVIEW','recommended_ui_route','QC_ACTION_QUEUE','authority','costing.sku_qc_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from qc))),
  jsonb_build_object('dependency_code','MATERIALS_STORES_OVERHEAD','label','Materials / Stores Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select allocation_status from ms),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_reason_code from ms),'note',(select allocation_note from ms),'owner_module','COST_SHEET_REVIEW','recommended_ui_route','MATERIALS_STORES_ACTION_QUEUE','authority','costing.sku_materials_stores_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from ms))),
  jsonb_build_object('dependency_code','ADMIN_OVERHEAD','label','Administrative Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select admin_overhead_allocation_status from af),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_resolution_status from af),'note',(select admin_overhead_allocation_note from af),'owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE','authority','costing.sku_admin_finance_overhead_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from af),'policy_envelope_id',(select admin_policy_envelope_id from af))),
  jsonb_build_object('dependency_code','FINANCE_ADMIN_OVERHEAD','label','Finance/Admin Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select finance_admin_overhead_allocation_status from af),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select allocation_resolution_status from af),'note',(select finance_admin_overhead_allocation_note from af),'owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE','authority','costing.sku_admin_finance_overhead_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from af),'policy_envelope_id',(select finance_admin_policy_envelope_id from af))),
  jsonb_build_object('dependency_code','MARKETING_EXPENSE','label','Marketing Expense','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status',coalesce((select marketing_expense_allocation_status from mk),'UNKNOWN'),'effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',(select marketing_evidence_status from mk),'note',(select marketing_expense_allocation_note from mk),'owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE','authority','costing.sku_marketing_expense_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',(select id from mk),'policy_id',(select marketing_policy_id from mk),'policy_envelope_id',(select marketing_policy_envelope_id from mk)))
 ),
 'scheme_evidence',(select rows from scheme),
 'scheme_status',case when (select n from scheme)=0 then 'UNKNOWN' when coalesce((select bad from scheme),false) then 'BLOCKED' else 'READY' end,
 'regional_marketing_evidence',(select rows from regional),
 'regional_marketing_status',case when (select n from regional)=0 then 'UNKNOWN' when coalesce((select blocked from regional),false) then 'BLOCKED' when coalesce((select review from regional),false) then 'REVIEW_REQUIRED' else 'READY' end
);
$function$;
ALTER FUNCTION costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot) FROM PUBLIC,anon,authenticated,service_role;

DO $r01$
DECLARE total_rows bigint; mismatches bigint; bad_types bigint; bad_source_counts bigint;
BEGIN
 WITH cohort AS MATERIALIZED (
   SELECT s.id AS sku_id FROM public.product_skus s JOIN public.products p ON p.id=s.product_id
   WHERE p.status='Active' AND s.is_active AND NOT coalesce(s.is_sample,false)
 ),
 compared AS MATERIALIZED (
 
SELECT 'DL'::text source_code,c.sku_id,
 (SELECT to_jsonb(o) FROM (SELECT t.* FROM costing.sku_direct_labour_allocation_snapshot t
   WHERE t.sku_id=c.sku_id AND t.period_start='2026-09-01'::date
     AND t.valuation_date='2026-09-10'::date AND t.refresh_run_id=115::bigint
   LIMIT 1) o) AS old_selected_row,
 CASE WHEN n.id IS NULL THEN NULL::jsonb ELSE to_jsonb(n) END AS cohort_selected_row,
 'costing.sku_direct_labour_allocation_snapshot'::regtype::oid AS expected_row_type_oid,
 pg_typeof(n)::oid AS cohort_row_type_oid
FROM cohort c
LEFT JOIN costing.sku_direct_labour_allocation_snapshot n
 ON n.sku_id=c.sku_id AND n.period_start='2026-09-01'::date
 AND n.valuation_date='2026-09-10'::date AND n.refresh_run_id=115::bigint
UNION ALL

SELECT 'POH'::text source_code,c.sku_id,
 (SELECT to_jsonb(o) FROM (SELECT t.* FROM costing.sku_production_overhead_allocation_snapshot t
   WHERE t.sku_id=c.sku_id AND t.period_start='2026-09-01'::date
     AND t.valuation_date='2026-09-10'::date AND t.refresh_run_id=115::bigint
   LIMIT 1) o) AS old_selected_row,
 CASE WHEN n.id IS NULL THEN NULL::jsonb ELSE to_jsonb(n) END AS cohort_selected_row,
 'costing.sku_production_overhead_allocation_snapshot'::regtype::oid AS expected_row_type_oid,
 pg_typeof(n)::oid AS cohort_row_type_oid
FROM cohort c
LEFT JOIN costing.sku_production_overhead_allocation_snapshot n
 ON n.sku_id=c.sku_id AND n.period_start='2026-09-01'::date
 AND n.valuation_date='2026-09-10'::date AND n.refresh_run_id=115::bigint
UNION ALL

SELECT 'QC'::text source_code,c.sku_id,
 (SELECT to_jsonb(o) FROM (SELECT t.* FROM costing.sku_qc_allocation_snapshot t
   WHERE t.sku_id=c.sku_id AND t.period_start='2026-09-01'::date
     AND t.valuation_date='2026-09-10'::date AND t.refresh_run_id=115::bigint
   LIMIT 1) o) AS old_selected_row,
 CASE WHEN n.id IS NULL THEN NULL::jsonb ELSE to_jsonb(n) END AS cohort_selected_row,
 'costing.sku_qc_allocation_snapshot'::regtype::oid AS expected_row_type_oid,
 pg_typeof(n)::oid AS cohort_row_type_oid
FROM cohort c
LEFT JOIN costing.sku_qc_allocation_snapshot n
 ON n.sku_id=c.sku_id AND n.period_start='2026-09-01'::date
 AND n.valuation_date='2026-09-10'::date AND n.refresh_run_id=115::bigint
UNION ALL

SELECT 'MS'::text source_code,c.sku_id,
 (SELECT to_jsonb(o) FROM (SELECT t.* FROM costing.sku_materials_stores_allocation_snapshot t
   WHERE t.sku_id=c.sku_id AND t.period_start='2026-09-01'::date
     AND t.valuation_date='2026-09-10'::date AND t.refresh_run_id=115::bigint
   LIMIT 1) o) AS old_selected_row,
 CASE WHEN n.id IS NULL THEN NULL::jsonb ELSE to_jsonb(n) END AS cohort_selected_row,
 'costing.sku_materials_stores_allocation_snapshot'::regtype::oid AS expected_row_type_oid,
 pg_typeof(n)::oid AS cohort_row_type_oid
FROM cohort c
LEFT JOIN costing.sku_materials_stores_allocation_snapshot n
 ON n.sku_id=c.sku_id AND n.period_start='2026-09-01'::date
 AND n.valuation_date='2026-09-10'::date AND n.refresh_run_id=115::bigint
UNION ALL

SELECT 'AF'::text source_code,c.sku_id,
 (SELECT to_jsonb(o) FROM (SELECT t.* FROM costing.sku_admin_finance_overhead_allocation_snapshot t
   WHERE t.sku_id=c.sku_id AND t.period_start='2026-09-01'::date
     AND t.valuation_date='2026-09-10'::date AND t.refresh_run_id=115::bigint
   LIMIT 1) o) AS old_selected_row,
 CASE WHEN n.id IS NULL THEN NULL::jsonb ELSE to_jsonb(n) END AS cohort_selected_row,
 'costing.sku_admin_finance_overhead_allocation_snapshot'::regtype::oid AS expected_row_type_oid,
 pg_typeof(n)::oid AS cohort_row_type_oid
FROM cohort c
LEFT JOIN costing.sku_admin_finance_overhead_allocation_snapshot n
 ON n.sku_id=c.sku_id AND n.period_start='2026-09-01'::date
 AND n.valuation_date='2026-09-10'::date AND n.refresh_run_id=115::bigint
UNION ALL

SELECT 'MK'::text source_code,c.sku_id,
 (SELECT to_jsonb(o) FROM (SELECT t.* FROM costing.sku_marketing_expense_allocation_snapshot t
   WHERE t.sku_id=c.sku_id AND t.period_start='2026-09-01'::date
     AND t.valuation_date='2026-09-10'::date AND t.refresh_run_id=115::bigint
   LIMIT 1) o) AS old_selected_row,
 CASE WHEN n.id IS NULL THEN NULL::jsonb ELSE to_jsonb(n) END AS cohort_selected_row,
 'costing.sku_marketing_expense_allocation_snapshot'::regtype::oid AS expected_row_type_oid,
 pg_typeof(n)::oid AS cohort_row_type_oid
FROM cohort c
LEFT JOIN costing.sku_marketing_expense_allocation_snapshot n
 ON n.sku_id=c.sku_id AND n.period_start='2026-09-01'::date
 AND n.valuation_date='2026-09-10'::date AND n.refresh_run_id=115::bigint
 ),
 source_counts AS (
   SELECT source_code,count(*) AS source_row_count FROM compared GROUP BY source_code
 )
 SELECT count(*),
        count(*) FILTER (WHERE old_selected_row IS DISTINCT FROM cohort_selected_row),
        count(*) FILTER (WHERE cohort_row_type_oid IS DISTINCT FROM expected_row_type_oid),
        (SELECT count(*) FROM source_counts sc WHERE sc.source_row_count<>611)
 INTO total_rows,mismatches,bad_types,bad_source_counts
 FROM compared;
 IF total_rows<>3666 OR mismatches<>0 OR bad_types<>0 OR bad_source_counts<>0 THEN
   RAISE EXCEPTION 'C-R01 full611 six-input equivalence failed: rows %, mismatches %, bad_types %, bad_source_counts %',total_rows,mismatches,bad_types,bad_source_counts;
 END IF;
 PERFORM set_config('wp04.c_v3_r01',jsonb_build_object(
   'scope','EXTRACTED_INPUT_PARITY_NOT_FINAL_OUTPUT_PARITY',
   'population_skus',611,'sources',6,'comparison_rows',3666,
   'old_point_selections',3666,'candidate_set_join_sources',6,
   'readiness_helper_calls',0,'canonical_calls',0,'core_calls',0,'portfolio_calls',0,
   'mismatches',mismatches,'type_mismatches',bad_types,'multiplicity_failures',bad_source_counts)::text,true);
END $r01$;

DO $r02$
DECLARE r record; got jsonb; expected jsonb; n integer:=0;
BEGIN
 FOR r IN
   SELECT * FROM (VALUES
('absent_all'::text,NULL::costing.sku_direct_labour_allocation_snapshot,NULL::costing.sku_production_overhead_allocation_snapshot,NULL::costing.sku_qc_allocation_snapshot,NULL::costing.sku_materials_stores_allocation_snapshot,NULL::costing.sku_admin_finance_overhead_allocation_snapshot,NULL::costing.sku_marketing_expense_allocation_snapshot),
('present_null_dl'::text,jsonb_populate_record(NULL::costing.sku_direct_labour_allocation_snapshot,jsonb_build_object('id',9101,'direct_labour_allocation_status',NULL)),NULL::costing.sku_production_overhead_allocation_snapshot,NULL::costing.sku_qc_allocation_snapshot,NULL::costing.sku_materials_stores_allocation_snapshot,NULL::costing.sku_admin_finance_overhead_allocation_snapshot,NULL::costing.sku_marketing_expense_allocation_snapshot),
('present_null_poh'::text,NULL::costing.sku_direct_labour_allocation_snapshot,jsonb_populate_record(NULL::costing.sku_production_overhead_allocation_snapshot,jsonb_build_object('id',9201,'allocation_status',NULL)),NULL::costing.sku_qc_allocation_snapshot,NULL::costing.sku_materials_stores_allocation_snapshot,NULL::costing.sku_admin_finance_overhead_allocation_snapshot,NULL::costing.sku_marketing_expense_allocation_snapshot),
('present_null_qc'::text,NULL::costing.sku_direct_labour_allocation_snapshot,NULL::costing.sku_production_overhead_allocation_snapshot,jsonb_populate_record(NULL::costing.sku_qc_allocation_snapshot,jsonb_build_object('id',9301,'allocation_status',NULL)),NULL::costing.sku_materials_stores_allocation_snapshot,NULL::costing.sku_admin_finance_overhead_allocation_snapshot,NULL::costing.sku_marketing_expense_allocation_snapshot),
('present_null_ms'::text,NULL::costing.sku_direct_labour_allocation_snapshot,NULL::costing.sku_production_overhead_allocation_snapshot,NULL::costing.sku_qc_allocation_snapshot,jsonb_populate_record(NULL::costing.sku_materials_stores_allocation_snapshot,jsonb_build_object('id',9401,'allocation_status',NULL)),NULL::costing.sku_admin_finance_overhead_allocation_snapshot,NULL::costing.sku_marketing_expense_allocation_snapshot),
('present_null_af'::text,NULL::costing.sku_direct_labour_allocation_snapshot,NULL::costing.sku_production_overhead_allocation_snapshot,NULL::costing.sku_qc_allocation_snapshot,NULL::costing.sku_materials_stores_allocation_snapshot,jsonb_populate_record(NULL::costing.sku_admin_finance_overhead_allocation_snapshot,jsonb_build_object('id',9501,'admin_overhead_allocation_status',NULL)),NULL::costing.sku_marketing_expense_allocation_snapshot),
('present_null_mk'::text,NULL::costing.sku_direct_labour_allocation_snapshot,NULL::costing.sku_production_overhead_allocation_snapshot,NULL::costing.sku_qc_allocation_snapshot,NULL::costing.sku_materials_stores_allocation_snapshot,NULL::costing.sku_admin_finance_overhead_allocation_snapshot,jsonb_populate_record(NULL::costing.sku_marketing_expense_allocation_snapshot,jsonb_build_object('id',9601,'marketing_expense_allocation_status',NULL))),
('present_null_all_six'::text,jsonb_populate_record(NULL::costing.sku_direct_labour_allocation_snapshot,jsonb_build_object('id',9101,'direct_labour_allocation_status',NULL)),jsonb_populate_record(NULL::costing.sku_production_overhead_allocation_snapshot,jsonb_build_object('id',9201,'allocation_status',NULL)),jsonb_populate_record(NULL::costing.sku_qc_allocation_snapshot,jsonb_build_object('id',9301,'allocation_status',NULL)),jsonb_populate_record(NULL::costing.sku_materials_stores_allocation_snapshot,jsonb_build_object('id',9401,'allocation_status',NULL)),jsonb_populate_record(NULL::costing.sku_admin_finance_overhead_allocation_snapshot,jsonb_build_object('id',9501,'admin_overhead_allocation_status',NULL)),jsonb_populate_record(NULL::costing.sku_marketing_expense_allocation_snapshot,jsonb_build_object('id',9601,'marketing_expense_allocation_status',NULL)))
   ) AS v(case_name,dl,poh,qc,ms,af,mk)
 LOOP
   got:=costing.fn_wp04_c_run_assemble(NULL,NULL,NULL,NULL,r.dl,r.poh,r.qc,r.ms,r.af,r.mk);
   expected:=jsonb_build_object(
 'snapshot_present',case when r.case_name='absent_all' then false else true end,
 'driver_dependencies',jsonb_build_array(
  jsonb_build_object('dependency_code','DIRECT_LABOUR','label','Direct Labour','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status','UNKNOWN','effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',null,'note',null,'owner_module','PRODUCTION_ROUTE_MANAGER','recommended_ui_route','PRODUCTION_ROUTE_MANAGER','authority','costing.sku_direct_labour_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',case when r.case_name in ('present_null_dl','present_null_all_six') then 9101 end,'policy_id',null)),
  jsonb_build_object('dependency_code','PRODUCTION_OVERHEAD','label','Production Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status','UNKNOWN','effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',null,'note',null,'owner_module','PRODUCTION_ROUTE_MANAGER','recommended_ui_route','PRODUCTION_ROUTE_MANAGER','authority','costing.sku_production_overhead_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',case when r.case_name in ('present_null_poh','present_null_all_six') then 9201 end,'policy_id',null)),
  jsonb_build_object('dependency_code','QUALITY_CONTROL_OVERHEAD','label','Quality Control Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status','UNKNOWN','effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',null,'note',null,'owner_module','COST_SHEET_REVIEW','recommended_ui_route','QC_ACTION_QUEUE','authority','costing.sku_qc_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',case when r.case_name in ('present_null_qc','present_null_all_six') then 9301 end)),
  jsonb_build_object('dependency_code','MATERIALS_STORES_OVERHEAD','label','Materials / Stores Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status','UNKNOWN','effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',null,'note',null,'owner_module','COST_SHEET_REVIEW','recommended_ui_route','MATERIALS_STORES_ACTION_QUEUE','authority','costing.sku_materials_stores_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',case when r.case_name in ('present_null_ms','present_null_all_six') then 9401 end)),
  jsonb_build_object('dependency_code','ADMIN_OVERHEAD','label','Administrative Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status','UNKNOWN','effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',null,'note',null,'owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE','authority','costing.sku_admin_finance_overhead_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',case when r.case_name in ('present_null_af','present_null_all_six') then 9501 end,'policy_envelope_id',null)),
  jsonb_build_object('dependency_code','FINANCE_ADMIN_OVERHEAD','label','Finance/Admin Overhead','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status','UNKNOWN','effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',null,'note',null,'owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE','authority','costing.sku_admin_finance_overhead_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',case when r.case_name in ('present_null_af','present_null_all_six') then 9501 end,'policy_envelope_id',null)),
  jsonb_build_object('dependency_code','MARKETING_EXPENSE','label','Marketing Expense','scope','SKU_RUN','dimension','EVIDENCE_QUALITY','applicability','APPLICABLE','raw_status','UNKNOWN','effective_status',null,'resolution_source','RUN_SNAPSHOT','reason_code',null,'note',null,'owner_module','COST_BUILD_MANAGER','recommended_ui_route','DRIVER_GOVERNANCE','authority','costing.sku_marketing_expense_allocation_snapshot','evidence_ids',jsonb_build_object('snapshot_id',case when r.case_name in ('present_null_mk','present_null_all_six') then 9601 end,'policy_id',null,'policy_envelope_id',null))
 ),
 'scheme_evidence','[]'::jsonb,'scheme_status','UNKNOWN',
 'regional_marketing_evidence','[]'::jsonb,'regional_marketing_status','UNKNOWN');
   IF got IS DISTINCT FROM expected THEN RAISE EXCEPTION 'C-R02 literal projection mismatch: %',r.case_name; END IF;
   IF jsonb_array_length(got->'driver_dependencies')<>7 THEN RAISE EXCEPTION 'C-R02 seven-driver coverage mismatch: %',r.case_name; END IF;
   n:=n+1;
 END LOOP;
 IF n<>8 THEN RAISE EXCEPTION 'C-R02 case budget mismatch'; END IF;
 PERFORM set_config('wp04.c_v3_r02',jsonb_build_object(
   'proof_kind','PURE_LITERAL_TYPED_RECORD_PROJECTION',
   'persisted_fixture_writes',0,'cases',8,'absent_cases',1,'present_null_single_source_cases',6,'present_null_all_sources_cases',1,
   'sources',6,'drivers',7,'complete_json_compared',true,'live_present_null_row_claimed',false)::text,true);
END $r02$;

DO $identity$
BEGIN
 IF (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid=to_regprocedure('costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot)')) IS DISTINCT FROM 'fdb75ff20ffd5d37e5103dec6b407f8c' THEN RAISE EXCEPTION 'C-V3 assembler body identity mismatch'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)'))) IS DISTINCT FROM 'c29e8b289304e7ece6f7affcccb6ffd8' THEN RAISE EXCEPTION 'C-V3 original helper changed'; END IF;
END $identity$;

DROP FUNCTION costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot);

DO $restore$
BEGIN
 IF to_regprocedure('costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot)') IS NOT NULL THEN RAISE EXCEPTION 'C-V3 temporary assembler remains'; END IF;
 IF md5(pg_get_functiondef(to_regprocedure('costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint)'))) IS DISTINCT FROM 'c29e8b289304e7ece6f7affcccb6ffd8' THEN RAISE EXCEPTION 'C-V3 original helper restore mismatch'; END IF;
END $restore$;

SELECT jsonb_build_object(
 'c_r01',current_setting('wp04.c_v3_r01')::jsonb,
 'c_r02',current_setting('wp04.c_v3_r02')::jsonb,
 'application_authorized',false,'performance_proved',false,'full611_final_output_parity','NOT_RUN'
) AS correction_result;
ROLLBACK;
