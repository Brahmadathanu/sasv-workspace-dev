-- WP04 G7 TRACK A — GOVERNED READINESS INDEX — FORWARD PACKAGE V1
-- PREPARED / REVIEW ONLY. DO NOT EXECUTE WITHOUT EXPLICIT PRODUCTION AUTHORIZATION.
-- Target project: qhmoqtxpeasamtlxaoak
-- Target governed period for initial build: 2026-09-01
-- Native authenticated statement_timeout remains 8s. This package does not alter timeout settings.
--
-- Recovery invariant:
--   canonical business/readiness rules stay in the existing canonical helper chain.
--   the builder CALLS costing.fn_product_sku_readiness_live_core(...); it does not copy severity/business rules.
--
-- Failure model:
--   phase 1 may install private infrastructure;
--   phase 2 builds/promotes a governed index;
--   phase 3 cuts over ONLY after a completed/current build exists and identity guards pass.
--   if any guard raises, STOP; do not retry blindly.

-- =========================================================
-- P0 — immutable source guards
-- =========================================================
DO $guard$
BEGIN
  IF md5(pg_get_functiondef(to_regprocedure(
    'public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)'
  ))) IS DISTINCT FROM '667267b109a25f4dec3bd7d34c1b2972' THEN
    RAISE EXCEPTION 'WP04-A source drift: portfolio RPC';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)'
  ))) IS DISTINCT FROM 'b47e4d07e13dffe5d38d37010ee5ff34' THEN
    RAISE EXCEPTION 'WP04-A source drift: canonical live core';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_wp04_c_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb)'
  ))) IS DISTINCT FROM 'fd0b3fe63b40fa3c669da8af1fa5994f' THEN
    RAISE EXCEPTION 'WP04-A source drift: C live core';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)'
  ))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN
    RAISE EXCEPTION 'WP04-A source drift: commercial point authority';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_product_process_route_readiness(date)'
  ))) IS DISTINCT FROM '29835ce9be925dfe0afdea8133d8217a' THEN
    RAISE EXCEPTION 'WP04-A source drift: route readiness authority';
  END IF;

  IF to_regclass('costing.product_sku_readiness_portfolio_build') IS NOT NULL
     OR to_regclass('costing.product_sku_readiness_portfolio_item') IS NOT NULL
     OR to_regclass('costing.product_sku_readiness_portfolio_incidence') IS NOT NULL
     OR to_regclass('costing.readiness_portfolio_source_epoch') IS NOT NULL
  THEN
    RAISE EXCEPTION 'WP04-A candidate object collision';
  END IF;
END
$guard$;

-- =========================================================
-- P1 — install private infrastructure
-- =========================================================
BEGIN;

CREATE TABLE costing.readiness_portfolio_source_epoch (
  source_relation text PRIMARY KEY,
  epoch bigint NOT NULL DEFAULT 0 CHECK (epoch >= 0),
  touched_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO costing.readiness_portfolio_source_epoch(source_relation)
VALUES
 ('public.categories'),
 ('public.sub_categories'),
 ('public.product_groups'),
 ('public.sub_groups'),
 ('public.products'),
 ('public.product_skus'),
 ('public.plm_bom_revision'),
 ('public.production_batch_size_ref'),
 ('costing.cost_periods'),
 ('costing.costing_refresh_run'),
 ('costing.costing_refresh_run_stage'),
 ('costing.sku_costing_control_status_snapshot'),
 ('costing.sku_direct_labour_allocation_snapshot'),
 ('costing.sku_production_overhead_allocation_snapshot'),
 ('costing.sku_qc_allocation_snapshot'),
 ('costing.sku_materials_stores_allocation_snapshot'),
 ('costing.sku_admin_finance_overhead_allocation_snapshot'),
 ('costing.sku_marketing_expense_allocation_snapshot'),
 ('costing.sku_sales_allocation_basis_snapshot'),
 ('costing.sku_commercial_sales_assumption'),
 ('costing.sales_allocation_default_policy'),
 ('costing.sku_mrp_policy'),
 ('costing.sku_selling_price_policy'),
 ('costing.sku_scheme_policy'),
 ('costing.sku_selected_scheme_policy_context_snapshot'),
 ('costing.sku_regional_marketing_allocation_basis_snapshot'),
 ('costing.cost_driver_policy_envelope'),
 ('costing.cost_driver_policy_cutover_acceptance'),
 ('costing.cost_element_driver_catalog'),
 ('costing.direct_labour_workload_policy'),
 ('costing.production_overhead_workload_policy'),
 ('costing.qc_workload_policy'),
 ('costing.materials_stores_workload_policy'),
 ('costing.marketing_allocation_policy'),
 ('costing.product_process_route'),
 ('costing.product_process_route_override'),
 ('costing.production_route_behaviour'),
 ('costing.production_route_candidate_policy'),
 ('costing.production_route_family'),
 ('costing.production_route_family_product_group_map'),
 ('costing.production_route_family_product_map'),
 ('costing.production_route_family_product_subgroup_map'),
 ('costing.production_route_family_route'),
 ('costing.production_route_family_route_step');

CREATE OR REPLACE FUNCTION costing.fn_wp04_readiness_bump_source_epoch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO costing,public,pg_temp
AS $function$
DECLARE
  v_relation text := format('%I.%I',TG_TABLE_SCHEMA,TG_TABLE_NAME);
BEGIN
  UPDATE costing.readiness_portfolio_source_epoch
     SET epoch=epoch+1,
         touched_at=clock_timestamp()
   WHERE source_relation=v_relation;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unregistered readiness source relation %',v_relation;
  END IF;
  RETURN NULL;
END
$function$;

ALTER FUNCTION costing.fn_wp04_readiness_bump_source_epoch() OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_readiness_bump_source_epoch()
  FROM PUBLIC,anon,authenticated,service_role;

DO $triggers$
DECLARE
  r record;
  v_trigger text;
BEGIN
  FOR r IN
    SELECT source_relation
    FROM costing.readiness_portfolio_source_epoch
    ORDER BY source_relation
  LOOP
    IF to_regclass(r.source_relation) IS NULL THEN
      RAISE EXCEPTION 'Readiness source relation missing: %',r.source_relation;
    END IF;
    v_trigger:='wp04_readiness_epoch_'||substr(md5(r.source_relation),1,12);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION costing.fn_wp04_readiness_bump_source_epoch()',
      v_trigger,r.source_relation
    );
  END LOOP;
END
$triggers$;

CREATE TABLE costing.product_sku_readiness_portfolio_build (
  id bigserial PRIMARY KEY,
  period_start date NOT NULL,
  valuation_date date NOT NULL,
  evidence_refresh_run_id bigint,
  status text NOT NULL CHECK (status IN ('BUILDING','COMPLETED','SUPERSEDED','FAILED')),
  is_current boolean NOT NULL DEFAULT false,
  source_fingerprint jsonb NOT NULL,
  source_fingerprint_digest text NOT NULL,
  item_count bigint,
  operational_count bigint,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  promoted_at timestamptz,
  error_text text
);

CREATE UNIQUE INDEX uq_wp04_readiness_current_period
  ON costing.product_sku_readiness_portfolio_build(period_start)
  WHERE is_current;

CREATE INDEX idx_wp04_readiness_build_context
  ON costing.product_sku_readiness_portfolio_build(period_start,valuation_date,status,id DESC);

CREATE TABLE costing.product_sku_readiness_portfolio_item (
  build_id bigint NOT NULL REFERENCES costing.product_sku_readiness_portfolio_build(id) ON DELETE CASCADE,
  sku_id bigint NOT NULL,
  product_id bigint NOT NULL,
  product_name text,
  product_status text,
  sku_is_active boolean,
  sku_is_sample boolean,
  overall_severity text NOT NULL CHECK (overall_severity IN ('READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN')),
  assessment jsonb NOT NULL,
  PRIMARY KEY(build_id,sku_id)
);

CREATE INDEX idx_wp04_readiness_item_product
  ON costing.product_sku_readiness_portfolio_item(build_id,product_id,sku_id);
CREATE INDEX idx_wp04_readiness_item_severity
  ON costing.product_sku_readiness_portfolio_item(build_id,overall_severity,sku_id);
CREATE INDEX idx_wp04_readiness_item_operational
  ON costing.product_sku_readiness_portfolio_item(build_id,sku_id)
  WHERE product_status='Active' AND sku_is_active AND NOT coalesce(sku_is_sample,false);
CREATE INDEX idx_wp04_readiness_item_product_name
  ON costing.product_sku_readiness_portfolio_item(build_id,lower(product_name));

CREATE TABLE costing.product_sku_readiness_portfolio_incidence (
  build_id bigint NOT NULL,
  sku_id bigint NOT NULL,
  incidence_kind text NOT NULL CHECK (incidence_kind IN ('DEPENDENCY','SHARED','REGIONAL')),
  dependency_code text,
  issue_code text,
  owner_module text,
  route_code text,
  status text,
  region_code text,
  raw_status text,
  effective_status text,
  shared_issue jsonb,
  FOREIGN KEY(build_id,sku_id)
    REFERENCES costing.product_sku_readiness_portfolio_item(build_id,sku_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_wp04_readiness_inc_dep
  ON costing.product_sku_readiness_portfolio_incidence(build_id,dependency_code,sku_id)
  WHERE incidence_kind IN ('DEPENDENCY','SHARED');
CREATE INDEX idx_wp04_readiness_inc_owner
  ON costing.product_sku_readiness_portfolio_incidence(build_id,owner_module,sku_id)
  WHERE incidence_kind IN ('DEPENDENCY','SHARED');
CREATE INDEX idx_wp04_readiness_inc_route
  ON costing.product_sku_readiness_portfolio_incidence(build_id,route_code,sku_id)
  WHERE incidence_kind IN ('DEPENDENCY','SHARED');
CREATE INDEX idx_wp04_readiness_inc_regional
  ON costing.product_sku_readiness_portfolio_incidence(build_id,region_code,raw_status,effective_status,sku_id)
  WHERE incidence_kind='REGIONAL';

REVOKE ALL ON TABLE
  costing.readiness_portfolio_source_epoch,
  costing.product_sku_readiness_portfolio_build,
  costing.product_sku_readiness_portfolio_item,
  costing.product_sku_readiness_portfolio_incidence
FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION costing.fn_wp04_readiness_source_fingerprint(p_period_start date)
RETURNS TABLE(fingerprint jsonb,digest text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO costing,public,pg_temp
AS $function$
DECLARE
  v_period date;
  v_val date;
  v_run bigint;
  v_epochs jsonb;
  v_defs text;
  v_schema text;
  v_fp jsonb;
BEGIN
  IF p_period_start IS NULL THEN RAISE EXCEPTION 'Period is required'; END IF;
  v_period:=date_trunc('month',p_period_start::timestamp)::date;

  SELECT valuation_date INTO v_val
  FROM costing.cost_periods
  WHERE period_start=v_period;
  IF v_val IS NULL THEN RAISE EXCEPTION 'Governed valuation date missing for %',v_period; END IF;

  SELECT id INTO v_run
  FROM costing.costing_refresh_run
  WHERE period_start=v_period
    AND valuation_date=v_val
    AND overall_status='SUCCESS'
  ORDER BY finished_at DESC NULLS LAST,id DESC
  LIMIT 1;

  SELECT jsonb_object_agg(source_relation,epoch ORDER BY source_relation)
  INTO v_epochs
  FROM costing.readiness_portfolio_source_epoch;

  SELECT string_agg(sig||'='||md5(pg_get_functiondef(to_regprocedure(sig))),'|' ORDER BY sig)
  INTO v_defs
  FROM unnest(ARRAY[
    'costing.fn_product_sku_readiness_live_core(bigint,date,date,bigint,jsonb,jsonb)',
    'costing.fn_wp04_c_live_core(bigint,date,date,bigint,jsonb,jsonb,jsonb)',
    'costing.fn_wp04_c_run_cohort(bigint[],date,date,bigint)',
    'costing.fn_wp04_c_run_assemble(bigint,date,date,bigint,costing.sku_direct_labour_allocation_snapshot,costing.sku_production_overhead_allocation_snapshot,costing.sku_qc_allocation_snapshot,costing.sku_materials_stores_allocation_snapshot,costing.sku_admin_finance_overhead_allocation_snapshot,costing.sku_marketing_expense_allocation_snapshot)',
    'costing.fn_wp04_c_enrich(jsonb,bigint,date,date,bigint,jsonb,jsonb)',
    'costing.fn_product_sku_readiness_shared_issues(date)',
    'costing.fn_product_process_route_readiness(date)',
    'costing.fn_resolve_sku_mrp_as_of(bigint,date)',
    'costing.fn_resolve_sku_selling_price_policy_as_of(bigint,date)',
    'costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)',
    'costing.fn_resolve_sku_sales_assumption_as_of(date,bigint,date)',
    'costing.fn_resolve_sales_allocation_default_policy_as_of(text,date)',
    'public.plm_sku_bom_revision_as_of(bigint,date)'
  ]::text[]) x(sig);

  v_defs:=v_defs
    ||'|view:costing.v_cost_driver_policy_registry='
    ||md5(pg_get_viewdef('costing.v_cost_driver_policy_registry'::regclass,true))
    ||'|view:costing.v_sku_commercial_sales_basis='
    ||md5(pg_get_viewdef('costing.v_sku_commercial_sales_basis'::regclass,true))
    ||'|view:costing.v_regional_marketing_evidence_review_queue='
    ||md5(pg_get_viewdef('costing.v_regional_marketing_evidence_review_queue'::regclass,true));

  SELECT string_agg(
    e.source_relation||':'||
    coalesce((
      SELECT string_agg(
        a.attname||'/'||a.atttypid::regtype::text||'/'||a.attnotnull::text,
        ',' ORDER BY a.attnum
      )
      FROM pg_attribute a
      WHERE a.attrelid=to_regclass(e.source_relation)
        AND a.attnum>0
        AND NOT a.attisdropped
    ),''),
    '|' ORDER BY e.source_relation
  )
  INTO v_schema
  FROM costing.readiness_portfolio_source_epoch e;

  v_fp:=jsonb_build_object(
    'contract_version','WP04_G7_TRACK_A_V1',
    'period_start',v_period,
    'valuation_date',v_val,
    'evidence_refresh_run_id',v_run,
    'source_epochs',v_epochs,
    'canonical_definition_digest',md5(v_defs),
    'source_schema_digest',md5(v_schema)
  );

  RETURN QUERY SELECT v_fp,md5(v_fp::text);
END
$function$;

ALTER FUNCTION costing.fn_wp04_readiness_source_fingerprint(date) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_readiness_source_fingerprint(date)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION costing.fn_wp04_build_readiness_portfolio(p_period_start date)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO costing,public,pg_temp
AS $function$
DECLARE
  v_period date;
  v_val date;
  v_run bigint;
  v_build bigint;
  v_start_fp jsonb;
  v_start_digest text;
  v_end_fp jsonb;
  v_end_digest text;
  v_route_map jsonb;
  v_route_count bigint;
  v_route_distinct bigint;
  v_shared jsonb:='[]'::jsonb;
  v_items bigint;
  v_operational bigint;
  v_invalid bigint;
  v_relation record;
BEGIN
  v_period:=date_trunc('month',p_period_start::timestamp)::date;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('WP04_READINESS_BUILD:'||v_period::text,0)) THEN
    RAISE EXCEPTION 'READINESS_BUILD_IN_PROGRESS';
  END IF;

  SELECT valuation_date INTO v_val
  FROM costing.cost_periods WHERE period_start=v_period;
  IF v_val IS NULL THEN RAISE EXCEPTION 'Governed valuation date missing for %',v_period; END IF;

  SELECT id INTO v_run
  FROM costing.costing_refresh_run
  WHERE period_start=v_period AND valuation_date=v_val AND overall_status='SUCCESS'
  ORDER BY finished_at DESC NULLS LAST,id DESC LIMIT 1;

  SELECT fingerprint,digest INTO v_start_fp,v_start_digest
  FROM costing.fn_wp04_readiness_source_fingerprint(v_period);

  INSERT INTO costing.product_sku_readiness_portfolio_build(
    period_start,valuation_date,evidence_refresh_run_id,status,is_current,
    source_fingerprint,source_fingerprint_digest
  )
  VALUES(v_period,v_val,v_run,'BUILDING',false,v_start_fp,v_start_digest)
  RETURNING id INTO v_build;

  BEGIN
    WITH route_rows AS MATERIALIZED (
      SELECT * FROM costing.fn_product_process_route_readiness(v_val)
    )
    SELECT count(*),count(distinct product_id),jsonb_object_agg(product_id::text,to_jsonb(r))
    INTO v_route_count,v_route_distinct,v_route_map
    FROM route_rows r;

    IF v_route_count<>v_route_distinct THEN
      RAISE EXCEPTION 'Nonunique route evidence';
    END IF;

    IF v_run IS NOT NULL THEN
      v_shared:=costing.fn_product_sku_readiness_shared_issues(v_val);
    END IF;

    INSERT INTO costing.product_sku_readiness_portfolio_item(
      build_id,sku_id,product_id,product_name,product_status,
      sku_is_active,sku_is_sample,overall_severity,assessment
    )
    SELECT
      v_build,
      s.id,
      s.product_id,
      a.assessment#>>'{identity,product_name}',
      a.assessment#>>'{lifecycle,product_status}',
      coalesce((a.assessment#>>'{lifecycle,sku_is_active}')::boolean,false),
      coalesce((a.assessment#>>'{lifecycle,sku_is_sample}')::boolean,false),
      a.assessment#>>'{summary,overall_severity}',
      a.assessment
    FROM public.product_skus s
    CROSS JOIN LATERAL (
      SELECT costing.fn_product_sku_readiness_live_core(
        s.id,v_period,v_val,v_run,v_route_map->(s.product_id::text),v_shared
      ) AS assessment
    ) a;

    SELECT count(*),
           count(*) FILTER(
             WHERE product_status='Active'
               AND sku_is_active
               AND NOT coalesce(sku_is_sample,false)
           ),
           count(*) FILTER(
             WHERE assessment#>>'{context,context_type}' IS DISTINCT FROM 'LIVE_AS_OF'
                OR assessment#>>'{context,sku_id}' IS DISTINCT FROM sku_id::text
                OR assessment#>>'{context,product_id}' IS DISTINCT FROM product_id::text
                OR assessment#>>'{context,period_start}' IS DISTINCT FROM v_period::text
                OR assessment#>>'{context,valuation_date}' IS DISTINCT FROM v_val::text
                OR assessment#>'{context,refresh_run_id}' IS DISTINCT FROM 'null'::jsonb
                OR (v_run IS NOT NULL AND assessment#>>'{context,evidence_refresh_run_id}' IS DISTINCT FROM v_run::text)
                OR overall_severity NOT IN ('READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN')
           )
    INTO v_items,v_operational,v_invalid
    FROM costing.product_sku_readiness_portfolio_item
    WHERE build_id=v_build;

    IF v_items IS DISTINCT FROM (SELECT count(*) FROM public.product_skus) THEN
      RAISE EXCEPTION 'Readiness build item count mismatch';
    END IF;
    IF v_invalid<>0 THEN
      RAISE EXCEPTION 'Readiness build canonical validation failed for % items',v_invalid;
    END IF;

    INSERT INTO costing.product_sku_readiness_portfolio_incidence(
      build_id,sku_id,incidence_kind,dependency_code,issue_code,
      owner_module,route_code,status,shared_issue
    )
    SELECT i.build_id,i.sku_id,'DEPENDENCY',
           d->>'dependency_code',NULL,d->>'owner_module',d->>'recommended_ui_route',
           coalesce(d->>'effective_status',d->>'raw_status'),NULL
    FROM costing.product_sku_readiness_portfolio_item i
    CROSS JOIN LATERAL jsonb_array_elements(i.assessment->'dependencies') x(d)
    WHERE i.build_id=v_build
      AND d->>'applicability'<>'NOT_REQUIRED'
      AND coalesce(d->>'effective_status',d->>'raw_status')
          IN ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN');

    INSERT INTO costing.product_sku_readiness_portfolio_incidence(
      build_id,sku_id,incidence_kind,dependency_code,issue_code,
      owner_module,route_code,status,shared_issue
    )
    SELECT i.build_id,i.sku_id,'SHARED',
           d->>'dependency_code',d->>'issue_code',d->>'owner_module',
           d->>'recommended_ui_route',d->>'status',d
    FROM costing.product_sku_readiness_portfolio_item i
    CROSS JOIN LATERAL jsonb_array_elements(i.assessment->'shared_issues') x(d)
    WHERE i.build_id=v_build
      AND d->>'status' IN ('BLOCKED','BLOCKER','REVIEW_REQUIRED','UNKNOWN');

    INSERT INTO costing.product_sku_readiness_portfolio_incidence(
      build_id,sku_id,incidence_kind,dependency_code,region_code,raw_status,effective_status
    )
    SELECT DISTINCT i.build_id,i.sku_id,'REGIONAL','REGIONAL_MARKETING_EVIDENCE',
           e->>'region_code',e->>'raw_status',e->>'effective_status'
    FROM costing.product_sku_readiness_portfolio_item i
    CROSS JOIN LATERAL jsonb_array_elements(i.assessment->'dependencies') x(d)
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(d->'evidence','[]'::jsonb)) y(e)
    WHERE i.build_id=v_build
      AND d->>'dependency_code'='REGIONAL_MARKETING_EVIDENCE';

    -- Promotion lock: source mutations that already committed are visible;
    -- source mutations that begin after this point wait briefly, then bump epoch after commit.
    FOR v_relation IN
      SELECT source_relation,epoch
      FROM costing.readiness_portfolio_source_epoch
      ORDER BY source_relation
      FOR UPDATE
    LOOP
      NULL;
    END LOOP;

    SELECT fingerprint,digest INTO v_end_fp,v_end_digest
    FROM costing.fn_wp04_readiness_source_fingerprint(v_period);

    IF v_end_digest IS DISTINCT FROM v_start_digest THEN
      UPDATE costing.product_sku_readiness_portfolio_build
      SET status='FAILED',completed_at=clock_timestamp(),
          error_text='SOURCE_CHANGED_DURING_BUILD'
      WHERE id=v_build;
      RETURN v_build;
    END IF;

    UPDATE costing.product_sku_readiness_portfolio_build
       SET is_current=false,
           status=CASE WHEN status='COMPLETED' THEN 'SUPERSEDED' ELSE status END
     WHERE period_start=v_period AND is_current;

    UPDATE costing.product_sku_readiness_portfolio_build
       SET status='COMPLETED',
           is_current=true,
           source_fingerprint=v_end_fp,
           source_fingerprint_digest=v_end_digest,
           item_count=v_items,
           operational_count=v_operational,
           completed_at=clock_timestamp(),
           promoted_at=clock_timestamp(),
           error_text=NULL
     WHERE id=v_build;

    RETURN v_build;
  EXCEPTION WHEN OTHERS THEN
    UPDATE costing.product_sku_readiness_portfolio_build
       SET status='FAILED',
           is_current=false,
           completed_at=clock_timestamp(),
           error_text=left(SQLSTATE||': '||SQLERRM,2000)
     WHERE id=v_build;
    RETURN v_build;
  END;
END
$function$;

ALTER FUNCTION costing.fn_wp04_build_readiness_portfolio(date) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_build_readiness_portfolio(date)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION costing.fn_wp04_readiness_portfolio_index_read(
  p_build_id bigint,
  p_period_start date,
  p_population_scope text DEFAULT 'OPERATIONAL',
  p_overall_severities text[] DEFAULT NULL,
  p_dependency_codes text[] DEFAULT NULL,
  p_owner_modules text[] DEFAULT NULL,
  p_route_codes text[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_after_sku_id bigint DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO costing,public,pg_temp
AS $function$
DECLARE
  v_period date;
  v_val date;
  v_run bigint;
  v_search text:=nullif(btrim(p_search),'');
  v_values text[];
  v_allowed text[];
  v_normalized text[];
  i integer;
  v_severities text[];
  v_codes text[];
  v_owners text[];
  v_routes text[];
  v_result jsonb;
  v_dependency_options constant text[]:=array[
    'PRODUCT_MASTER','SKU_MASTER','PM_BOM_REVISION','BATCH_SIZE_REFERENCE',
    'MANUFACTURING_ROUTE','MRP_POLICY','SELLING_PRICE_POLICY','COMMON_COMMERCIAL_BASIS',
    'DIRECT_LABOUR','PRODUCTION_OVERHEAD','QUALITY_CONTROL_OVERHEAD',
    'MATERIALS_STORES_OVERHEAD','ADMIN_OVERHEAD','FINANCE_ADMIN_OVERHEAD',
    'MARKETING_EXPENSE','SELECTED_SCHEME_POLICY','REGIONAL_MARKETING_EVIDENCE'
  ];
  v_owner_options constant text[]:=array[
    'MANAGE_PRODUCTS','PM_BOM_MANAGER','SUPPLY_BATCH_PLAN','PRODUCTION_ROUTE_MANAGER',
    'PRICING_POLICY_MANAGER','COST_SHEET_REVIEW','COST_BUILD_MANAGER','COSTING_CONTROL_CENTER'
  ];
  v_route_options constant text[]:=array[
    'MANAGE_PRODUCTS','PM_BOM_MANAGER','BATCH_SIZES','PRODUCTION_ROUTE_MANAGER',
    'MRP_GOVERNANCE','SELLING_SCHEME_POLICIES','COMMERCIAL_SALES_ASSUMPTIONS',
    'QC_ACTION_QUEUE','MATERIALS_STORES_ACTION_QUEUE','DRIVER_GOVERNANCE',
    'REGIONAL_MARKETING_REVIEW'
  ];
BEGIN
  IF p_build_id IS NULL THEN RAISE EXCEPTION 'Readiness build ID is required'; END IF;
  IF p_period_start IS NULL THEN RAISE EXCEPTION 'Costing period start is required for LIVE_AS_OF'; END IF;
  IF p_population_scope IS NULL OR p_population_scope NOT IN ('OPERATIONAL','ALL_EXISTING') THEN
    RAISE EXCEPTION 'Invalid population scope';
  END IF;
  IF p_limit IS NULL OR p_limit<1 OR p_limit>100 OR p_after_sku_id<0 THEN
    RAISE EXCEPTION 'Invalid pagination';
  END IF;
  IF length(v_search)>120 THEN RAISE EXCEPTION 'Search too long'; END IF;

  FOR i IN 1..4 LOOP
    v_values:=CASE i WHEN 1 THEN p_overall_severities WHEN 2 THEN p_dependency_codes WHEN 3 THEN p_owner_modules ELSE p_route_codes END;
    v_allowed:=CASE i WHEN 1 THEN array['READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN'] WHEN 2 THEN v_dependency_options WHEN 3 THEN v_owner_options ELSE v_route_options END;
    v_normalized:=NULL;
    IF coalesce(cardinality(v_values),0)>0 THEN
      IF array_ndims(v_values)<>1 OR cardinality(v_values)>32 THEN RAISE EXCEPTION 'Invalid filter cardinality'; END IF;
      IF EXISTS(
        SELECT 1 FROM unnest(v_values) x(value)
        WHERE value IS NULL OR btrim(value)='' OR NOT (btrim(value)=ANY(v_allowed))
      ) THEN RAISE EXCEPTION 'Unsupported filter value'; END IF;
      SELECT array_agg(value ORDER BY value) INTO v_normalized
      FROM (SELECT DISTINCT btrim(value) value FROM unnest(v_values) x(value)) n;
    END IF;
    IF i=1 THEN v_severities:=v_normalized;
    ELSIF i=2 THEN v_codes:=v_normalized;
    ELSIF i=3 THEN v_owners:=v_normalized;
    ELSE v_routes:=v_normalized;
    END IF;
  END LOOP;

  v_period:=date_trunc('month',p_period_start::timestamp)::date;
  SELECT valuation_date,evidence_refresh_run_id
  INTO v_val,v_run
  FROM costing.product_sku_readiness_portfolio_build
  WHERE id=p_build_id AND period_start=v_period AND status='COMPLETED';

  IF NOT FOUND THEN RAISE EXCEPTION 'READINESS_BUILD_NOT_COMPLETED'; END IF;

  WITH population AS MATERIALIZED (
    SELECT i.*
    FROM costing.product_sku_readiness_portfolio_item i
    WHERE i.build_id=p_build_id
      AND (
        p_population_scope='ALL_EXISTING'
        OR (i.product_status='Active' AND i.sku_is_active AND NOT coalesce(i.sku_is_sample,false))
      )
  ), incidences AS MATERIALIZED (
    SELECT x.*
    FROM costing.product_sku_readiness_portfolio_incidence x
    JOIN population p ON p.sku_id=x.sku_id
    WHERE x.build_id=p_build_id AND x.incidence_kind IN ('DEPENDENCY','SHARED')
  ), matched AS MATERIALIZED (
    SELECT p.*
    FROM population p
    WHERE (v_severities IS NULL OR p.overall_severity=ANY(v_severities))
      AND (
        v_search IS NULL
        OR strpos(lower(coalesce(p.product_name,'')),lower(v_search))>0
        OR v_search=p.sku_id::text
        OR v_search=p.product_id::text
      )
      AND (
        (v_codes IS NULL AND v_owners IS NULL AND v_routes IS NULL)
        OR EXISTS(
          SELECT 1
          FROM incidences d
          WHERE d.sku_id=p.sku_id
            AND (v_codes IS NULL OR d.dependency_code=ANY(v_codes))
            AND (v_owners IS NULL OR d.owner_module=ANY(v_owners))
            AND (v_routes IS NULL OR d.route_code=ANY(v_routes))
        )
      )
  ), candidates AS MATERIALIZED (
    SELECT *
    FROM matched
    WHERE p_after_sku_id IS NULL OR sku_id>p_after_sku_id
    ORDER BY sku_id
    LIMIT p_limit+1
  ), page AS MATERIALIZED (
    SELECT * FROM candidates ORDER BY sku_id LIMIT p_limit
  ), dependency_counts AS (
    SELECT dependency_code,count(distinct sku_id) affected_sku_count
    FROM incidences
    WHERE dependency_code IS NOT NULL
    GROUP BY dependency_code
  ), owner_counts AS (
    SELECT owner_module,count(distinct sku_id) affected_sku_count
    FROM incidences
    WHERE owner_module IS NOT NULL
    GROUP BY owner_module
  ), route_counts AS (
    SELECT route_code,count(distinct sku_id) affected_sku_count
    FROM incidences
    WHERE route_code IS NOT NULL
    GROUP BY route_code
  ), shared_counts AS (
    SELECT shared_issue issue,count(distinct sku_id) affected_sku_count,
           array_agg(distinct sku_id ORDER BY sku_id) affected_sku_ids
    FROM incidences
    WHERE incidence_kind='SHARED'
    GROUP BY shared_issue
  ), severity_counts AS (
    SELECT count(*) population_sku_count,
           count(*) FILTER(WHERE overall_severity='READY') ready_count,
           count(*) FILTER(WHERE overall_severity='REVIEW_REQUIRED') review_count,
           count(*) FILTER(WHERE overall_severity='BLOCKER') blocker_count,
           count(*) FILTER(WHERE overall_severity='UNKNOWN') unknown_count
    FROM population
  ), regional_counts AS (
    SELECT region_code,raw_status,effective_status,count(distinct sku_id) sku_region_count
    FROM costing.product_sku_readiness_portfolio_incidence
    WHERE build_id=p_build_id AND incidence_kind='REGIONAL'
      AND sku_id IN (SELECT sku_id FROM population)
    GROUP BY region_code,raw_status,effective_status
  )
  SELECT jsonb_build_object(
    'context',jsonb_build_object(
      'context_type','LIVE_AS_OF',
      'requested_period_start',p_period_start,
      'period_start',v_period,
      'valuation_date',v_val,
      'refresh_run_id',NULL,
      'evidence_refresh_run_id',v_run,
      'context_integrity_status','LIVE_GOVERNED_PERIOD'
    ),
    'observed_at',statement_timestamp(),
    'population_scope',p_population_scope,
    'filters',jsonb_build_object(
      'overall_severities',v_severities,
      'dependency_codes',v_codes,
      'owner_modules',v_owners,
      'route_codes',v_routes,
      'search',v_search
    ),
    'filter_options',jsonb_build_object(
      'overall_severities',array['READY','REVIEW_REQUIRED','BLOCKER','UNKNOWN'],
      'dependency_codes',v_dependency_options,
      'owner_modules',v_owner_options,
      'route_codes',v_route_options
    ),
    'after_sku_id',p_after_sku_id,
    'limit',p_limit,
    'statistics',jsonb_build_object(
      'population_sku_count',(SELECT population_sku_count FROM severity_counts),
      'overall_severity_counts',jsonb_build_object(
        'READY',(SELECT ready_count FROM severity_counts),
        'REVIEW_REQUIRED',(SELECT review_count FROM severity_counts),
        'BLOCKER',(SELECT blocker_count FROM severity_counts),
        'UNKNOWN',(SELECT unknown_count FROM severity_counts)
      ),
      'unresolved_dependency_counts',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY dependency_code) FROM dependency_counts x),'[]'::jsonb),
      'unresolved_owner_counts',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY owner_module) FROM owner_counts x),'[]'::jsonb),
      'unresolved_route_counts',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY route_code) FROM route_counts x),'[]'::jsonb),
      'shared_issue_summary_basis','CANONICAL_ASSESSED_SKU_REFERENCES',
      'unresolved_shared_issue_counts',coalesce((
        SELECT jsonb_agg(
          jsonb_build_object(
            'context',jsonb_build_object(
              'context_type','LIVE_AS_OF',
              'period_start',v_period,
              'valuation_date',v_val,
              'refresh_run_id',NULL,
              'evidence_refresh_run_id',v_run
            ),
            'issue',issue,
            'affected_sku_count',affected_sku_count,
            'affected_sku_ids',affected_sku_ids
          )
          ORDER BY issue
        )
        FROM shared_counts
      ),'[]'::jsonb),
      'regional_marketing_counts',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY region_code,raw_status,effective_status) FROM regional_counts x),'[]'::jsonb)
    ),
    'matched_count',(SELECT count(*) FROM matched),
    'returned_count',(SELECT count(*) FROM page),
    'rows',coalesce((SELECT jsonb_agg(assessment ORDER BY sku_id) FROM page),'[]'::jsonb),
    'has_more',(SELECT count(*)>p_limit FROM candidates),
    'next_after_sku_id',CASE WHEN (SELECT count(*)>p_limit FROM candidates) THEN (SELECT max(sku_id) FROM page) END
  )
  INTO v_result;

  RETURN v_result;
END
$function$;

ALTER FUNCTION costing.fn_wp04_readiness_portfolio_index_read(
 bigint,date,text,text[],text[],text[],text[],text,bigint,integer
) OWNER TO postgres;
REVOKE ALL ON FUNCTION costing.fn_wp04_readiness_portfolio_index_read(
 bigint,date,text,text[],text[],text[],text[],text,bigint,integer
) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;

-- =========================================================
-- P2 — initial governed build for 2026-09-01
-- No timeout setting is changed by this package.
-- =========================================================
SELECT costing.fn_wp04_build_readiness_portfolio('2026-09-01'::date) AS build_id;

DO $build_guard$
DECLARE
  b record;
  fp record;
BEGIN
  SELECT * INTO b
  FROM costing.product_sku_readiness_portfolio_build
  WHERE period_start='2026-09-01'::date AND is_current
  ORDER BY id DESC LIMIT 1;

  IF b.id IS NULL OR b.status<>'COMPLETED' THEN
    RAISE EXCEPTION 'WP04-A initial build did not complete/promote';
  END IF;

  SELECT * INTO fp
  FROM costing.fn_wp04_readiness_source_fingerprint('2026-09-01'::date);

  IF b.source_fingerprint_digest IS DISTINCT FROM fp.digest THEN
    RAISE EXCEPTION 'WP04-A initial build stale before cutover';
  END IF;
END
$build_guard$;

-- =========================================================
-- P3 — exact public RPC replacement only
-- =========================================================
CREATE OR REPLACE FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 p_period_start date,p_population_scope text DEFAULT 'OPERATIONAL',p_overall_severities text[] DEFAULT NULL,
 p_dependency_codes text[] DEFAULT NULL,p_owner_modules text[] DEFAULT NULL,p_route_codes text[] DEFAULT NULL,
 p_search text DEFAULT NULL,p_after_sku_id bigint DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public,costing,pg_temp
AS $function$
DECLARE
  v_period date;
  v_result jsonb;
  v_has_current boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.app_has_permission('module:costing-control-center','view') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF p_period_start IS NULL THEN
    RAISE EXCEPTION 'Costing period start is required for LIVE_AS_OF';
  END IF;

  v_period:=date_trunc('month',p_period_start::timestamp)::date;

  -- One SQL statement/snapshot binds freshness, current-build identity and indexed read.
  SELECT costing.fn_wp04_readiness_portfolio_index_read(
           b.id,p_period_start,p_population_scope,p_overall_severities,
           p_dependency_codes,p_owner_modules,p_route_codes,p_search,p_after_sku_id,p_limit
         )
  INTO v_result
  FROM costing.fn_wp04_readiness_source_fingerprint(v_period) fp
  JOIN costing.product_sku_readiness_portfolio_build b
    ON b.period_start=v_period
   AND b.valuation_date=(fp.fingerprint->>'valuation_date')::date
   AND b.evidence_refresh_run_id IS NOT DISTINCT FROM
       nullif(fp.fingerprint->>'evidence_refresh_run_id','')::bigint
   AND b.status='COMPLETED'
   AND b.is_current
   AND b.source_fingerprint_digest=fp.digest
  ORDER BY b.id DESC
  LIMIT 1;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM costing.product_sku_readiness_portfolio_build b
    WHERE b.period_start=v_period AND b.is_current
  )
  INTO v_has_current;

  IF v_has_current THEN
    RAISE EXCEPTION 'READINESS_BUILD_STALE';
  END IF;
  RAISE EXCEPTION 'READINESS_BUILD_ABSENT';
END
$function$;
ALTER FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 date,text,text[],text[],text[],text[],text,bigint,integer
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 date,text,text[],text[],text[],text[],text,bigint,integer
) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_product_sku_readiness_portfolio(
 date,text,text[],text[],text[],text[],text,bigint,integer
) TO authenticated;

-- =========================================================
-- P4 — post-cutover identity guards
-- =========================================================
DO $post$
DECLARE
  b record;
BEGIN
  SELECT * INTO b
  FROM costing.product_sku_readiness_portfolio_build
  WHERE period_start='2026-09-01'::date AND is_current
  ORDER BY id DESC LIMIT 1;

  IF b.status<>'COMPLETED' THEN RAISE EXCEPTION 'WP04-A current build not completed'; END IF;

  IF (SELECT proacl::text FROM pg_proc WHERE oid=to_regprocedure(
    'public.rpc_get_product_sku_readiness_portfolio(date,text,text[],text[],text[],text[],text,bigint,integer)'
  )) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' THEN
    RAISE EXCEPTION 'WP04-A public RPC ACL mismatch';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='costing'
      AND p.proname IN (
        'fn_wp04_readiness_bump_source_epoch',
        'fn_wp04_readiness_source_fingerprint',
        'fn_wp04_build_readiness_portfolio',
        'fn_wp04_readiness_portfolio_index_read'
      )
      AND coalesce(p.proacl::text,'') NOT IN ('','{postgres=X/postgres}')
  ) THEN
    RAISE EXCEPTION 'WP04-A private function ACL mismatch';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure(
    'costing.fn_resolve_sku_commercial_sales_basis_point(bigint,date,date)'
  ))) IS DISTINCT FROM '68bd9325062299eb8af1291bf4d9393b' THEN
    RAISE EXCEPTION 'WP04-A CSE-P01 authority drift';
  END IF;
END
$post$;

-- Retention rule V1:
-- No automatic deletion is performed by the forward package.
-- Current build is unique per period. Older completed builds are marked SUPERSEDED.
-- Retain current + at least two previous completed/superseded builds until a separately reviewed prune operation exists.
