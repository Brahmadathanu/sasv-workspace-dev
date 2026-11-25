-- R2A (corrected): additive append-only permanent acceptance evidence + baseline. NO FK removal, NO purge. PostgreSQL 17.
-- Supersedes ../20261125_governance_evidence_r2a.sql. Capture triggers belong to R2B.
-- Fingerprint contract (documented, versioned):
--   REGIONAL_MARKETING  : costing.fn_regional_marketing_evidence_fingerprint  = md5(concat_ws('|', 13 fields, NULL->'∅'))   [LEGACY_MD5_CONCAT_V1/REGIONAL]
--   SALES_QUANTITY_DRIVER: costing.fn_sales_allocation_quantity_driver_fingerprint = md5(concat_ws('|', 11 fields, NULL->''))  [LEGACY_MD5_CONCAT_V1/SALES]
-- The algorithm id is stored per event. schema_version=1 means: acceptance_evidence = to_jsonb(acceptance row) minus the
-- governance_event_id / governance_category columns, taken AFTER all BEFORE triggers ran.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE costing.regional_marketing_evidence_acceptance, costing.sales_allocation_quantity_driver_acceptance IN SHARE ROW EXCLUSIVE MODE;
CREATE SCHEMA IF NOT EXISTS costing_retention;
REVOKE ALL ON SCHEMA costing_retention FROM PUBLIC,anon,authenticated,service_role;

CREATE SEQUENCE costing.governance_evidence_event_id_seq;
CREATE TABLE costing.governance_evidence_event (
 id bigint PRIMARY KEY DEFAULT nextval('costing.governance_evidence_event_id_seq'),
 evidence_category text NOT NULL CHECK (evidence_category IN ('REGIONAL_MARKETING','SALES_QUANTITY_DRIVER')),
 acceptance_id bigint NOT NULL,
 source_refresh_run_id bigint NOT NULL REFERENCES costing.costing_refresh_run(id) ON DELETE RESTRICT,
 schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version>0),
 fingerprint_algorithm text NOT NULL DEFAULT 'LEGACY_MD5_CONCAT_V1' CHECK (fingerprint_algorithm<>''),
 event_kind text NOT NULL CHECK (event_kind IN ('BASELINE','INSERT','UPDATE')),
 original_snapshot_keys jsonb NOT NULL,
 acceptance_evidence jsonb NOT NULL,
 original_fingerprint text NOT NULL,
 payload_sha256 text NOT NULL DEFAULT '',   -- set by trigger below (jsonb::text is not immutable, so not a generated column)
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 recorded_by_session_user text NOT NULL DEFAULT session_user,
 recorded_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 UNIQUE (id,evidence_category,acceptance_id)
);
ALTER SEQUENCE costing.governance_evidence_event_id_seq OWNED BY costing.governance_evidence_event.id;
ALTER TABLE costing.governance_evidence_event ENABLE ROW LEVEL SECURITY;   -- no policies
REVOKE ALL ON costing.governance_evidence_event FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE costing.governance_evidence_event_id_seq FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX governance_evidence_event_acceptance_idx ON costing.governance_evidence_event(evidence_category,acceptance_id,id DESC);
CREATE INDEX governance_evidence_event_run_idx ON costing.governance_evidence_event(source_refresh_run_id);

CREATE FUNCTION costing_retention.fn_reject_evidence_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS
$$ BEGIN RAISE EXCEPTION 'GOVERNANCE_EVIDENCE_APPEND_ONLY: % prohibited',TG_OP; END $$;
CREATE FUNCTION costing_retention.fn_evidence_set_digest() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS
$$ BEGIN NEW.payload_sha256:=encode(sha256(convert_to(NEW.acceptance_evidence::text,'UTF8')),'hex'); RETURN NEW; END $$;
CREATE TRIGGER governance_evidence_digest BEFORE INSERT ON costing.governance_evidence_event
 FOR EACH ROW EXECUTE FUNCTION costing_retention.fn_evidence_set_digest();
CREATE TRIGGER governance_evidence_no_row_mutation BEFORE UPDATE OR DELETE ON costing.governance_evidence_event
 FOR EACH ROW EXECUTE FUNCTION costing_retention.fn_reject_evidence_mutation();
CREATE TRIGGER governance_evidence_no_truncate BEFORE TRUNCATE ON costing.governance_evidence_event
 FOR EACH STATEMENT EXECUTE FUNCTION costing_retention.fn_reject_evidence_mutation();

-- Source validation shared by baseline parity (here), R2B capture and R2C preflight.
-- Returns one row per finding. severity BLOCKER = covered-by-fingerprint evidence does not match the live source snapshot.
-- severity INFO  = fields NOT covered by the fingerprint differ (legitimate after RPC renewal to another run); recorded, not blocking.
CREATE FUNCTION costing_retention.fn_acceptance_source_findings_raw()
RETURNS TABLE(evidence_category text,acceptance_id bigint,severity text,finding text)
LANGUAGE sql STABLE SET search_path=pg_catalog,costing AS $$
 SELECT 'REGIONAL_MARKETING',a.id,
   CASE WHEN e.id IS NULL OR b.id IS NULL THEN 'BLOCKER'
        WHEN (a.source_refresh_run_id,a.sku_id,a.product_id,a.region_code,a.source_valuation_date,a.period_start,a.regional_basis_snapshot_id)
             IS DISTINCT FROM (e.refresh_run_id,e.sku_id,e.product_id,e.region_code,e.valuation_date,e.period_start,e.regional_basis_snapshot_id) THEN 'BLOCKER'
        WHEN (a.source_refresh_run_id,a.sku_id,a.product_id,a.region_code,a.source_valuation_date,a.period_start)
             IS DISTINCT FROM (b.refresh_run_id,b.sku_id,b.product_id,b.region_code,b.valuation_date,b.period_start) THEN 'BLOCKER'
        WHEN a.evidence_fingerprint IS DISTINCT FROM costing.fn_regional_marketing_evidence_fingerprint(e.sku_id,e.product_id,e.region_code,e.valuation_date,e.regional_basis_source,e.resolved_regional_units,e.resolved_regional_base_qty,b.regional_assumption_id,b.regional_default_policy_id,b.regional_default_scenario,e.marketing_value_source,e.resolved_product_region_marketing_sales_value,e.marketing_expense_cost_per_sku_region) THEN 'BLOCKER'
        WHEN (a.regional_basis_source,a.resolved_regional_units,a.resolved_regional_base_qty,a.regional_assumption_id,a.regional_default_policy_id,a.regional_default_scenario,a.marketing_value_source,a.resolved_product_region_marketing_sales_value,a.marketing_expense_cost_per_sku_region)
             IS DISTINCT FROM (e.regional_basis_source,e.resolved_regional_units,e.resolved_regional_base_qty,b.regional_assumption_id,b.regional_default_policy_id,b.regional_default_scenario,e.marketing_value_source,e.resolved_product_region_marketing_sales_value,e.marketing_expense_cost_per_sku_region) THEN 'BLOCKER'
        ELSE 'INFO' END,
   CASE WHEN e.id IS NULL OR b.id IS NULL THEN 'source snapshot missing'
        WHEN a.regional_basis_status IS DISTINCT FROM e.regional_basis_status THEN 'regional_basis_status differs from source (not fingerprint-covered)'
        ELSE 'covered-field or identity mismatch' END
 FROM costing.regional_marketing_evidence_acceptance a
 LEFT JOIN costing.sku_regional_marketing_expense_allocation_snapshot e ON e.id=a.regional_marketing_snapshot_id
 LEFT JOIN costing.sku_regional_marketing_allocation_basis_snapshot b ON b.id=a.regional_basis_snapshot_id
 WHERE e.id IS NULL OR b.id IS NULL
    OR (a.source_refresh_run_id,a.sku_id,a.product_id,a.region_code,a.source_valuation_date,a.period_start,a.regional_basis_snapshot_id,a.regional_basis_source,a.resolved_regional_units,a.resolved_regional_base_qty,a.regional_assumption_id,a.regional_default_policy_id,a.regional_default_scenario,a.marketing_value_source,a.resolved_product_region_marketing_sales_value,a.marketing_expense_cost_per_sku_region,a.regional_basis_status)
       IS DISTINCT FROM (e.refresh_run_id,e.sku_id,e.product_id,e.region_code,e.valuation_date,e.period_start,e.regional_basis_snapshot_id,e.regional_basis_source,e.resolved_regional_units,e.resolved_regional_base_qty,b.regional_assumption_id,b.regional_default_policy_id,b.regional_default_scenario,e.marketing_value_source,e.resolved_product_region_marketing_sales_value,e.marketing_expense_cost_per_sku_region,e.regional_basis_status)
    OR (b.refresh_run_id,b.sku_id,b.product_id,b.region_code,b.valuation_date,b.period_start) IS DISTINCT FROM (a.source_refresh_run_id,a.sku_id,a.product_id,a.region_code,a.source_valuation_date,a.period_start)
    OR a.evidence_fingerprint IS DISTINCT FROM costing.fn_regional_marketing_evidence_fingerprint(e.sku_id,e.product_id,e.region_code,e.valuation_date,e.regional_basis_source,e.resolved_regional_units,e.resolved_regional_base_qty,b.regional_assumption_id,b.regional_default_policy_id,b.regional_default_scenario,e.marketing_value_source,e.resolved_product_region_marketing_sales_value,e.marketing_expense_cost_per_sku_region)
 UNION ALL
 SELECT 'SALES_QUANTITY_DRIVER',a.id,
   CASE WHEN b.id IS NULL THEN 'BLOCKER'
        WHEN (a.source_refresh_run_id,a.sku_id,a.product_id,a.source_valuation_date,a.period_start)
             IS DISTINCT FROM (b.refresh_run_id,b.sku_id,b.product_id,b.valuation_date,b.period_start) THEN 'BLOCKER'
        WHEN a.evidence_fingerprint IS DISTINCT FROM costing.fn_sales_allocation_quantity_driver_fingerprint(b.sku_id,b.product_id,b.valuation_date,b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty) THEN 'BLOCKER'
        WHEN (a.monthly_driver_method,a.monthly_driver_source,a.monthly_driver_source_month,a.assumption_id,a.default_policy_id,a.default_policy_scenario,a.resolved_monthly_units,a.resolved_monthly_base_qty)
             IS DISTINCT FROM (b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty) THEN 'BLOCKER'
        ELSE 'INFO' END,
   CASE WHEN b.id IS NULL THEN 'source snapshot missing'
        WHEN a.assumption_basis IS DISTINCT FROM b.assumption_basis THEN 'assumption_basis differs from source (not fingerprint-covered)'
        ELSE 'covered-field or identity mismatch' END
 FROM costing.sales_allocation_quantity_driver_acceptance a
 LEFT JOIN costing.sku_sales_allocation_basis_snapshot b ON b.id=a.source_snapshot_id
 WHERE b.id IS NULL
    OR (a.source_refresh_run_id,a.sku_id,a.product_id,a.source_valuation_date,a.period_start,a.monthly_driver_method,a.monthly_driver_source,a.monthly_driver_source_month,a.assumption_id,a.default_policy_id,a.default_policy_scenario,a.resolved_monthly_units,a.resolved_monthly_base_qty,a.assumption_basis)
       IS DISTINCT FROM (b.refresh_run_id,b.sku_id,b.product_id,b.valuation_date,b.period_start,b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty,b.assumption_basis)
    OR a.evidence_fingerprint IS DISTINCT FROM costing.fn_sales_allocation_quantity_driver_fingerprint(b.sku_id,b.product_id,b.valuation_date,b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty)
$$;
REVOKE ALL ON FUNCTION costing_retention.fn_acceptance_source_findings_raw() FROM PUBLIC,anon,authenticated,service_role;

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM costing_retention.fn_acceptance_source_findings_raw() WHERE severity='BLOCKER')
 THEN RAISE EXCEPTION 'R2A baseline blocked: % blocker finding(s); run costing_retention.fn_acceptance_source_findings_raw()',
   (SELECT count(*) FROM costing_retention.fn_acceptance_source_findings_raw() WHERE severity='BLOCKER'); END IF;
END $$;

INSERT INTO costing.governance_evidence_event(evidence_category,acceptance_id,source_refresh_run_id,event_kind,original_snapshot_keys,acceptance_evidence,original_fingerprint)
SELECT 'REGIONAL_MARKETING',a.id,a.source_refresh_run_id,'BASELINE',
 jsonb_build_object('regional_basis_snapshot_id',a.regional_basis_snapshot_id,'regional_marketing_snapshot_id',a.regional_marketing_snapshot_id),to_jsonb(a),a.evidence_fingerprint
FROM costing.regional_marketing_evidence_acceptance a
UNION ALL
SELECT 'SALES_QUANTITY_DRIVER',a.id,a.source_refresh_run_id,'BASELINE',
 jsonb_build_object('source_snapshot_id',a.source_snapshot_id),to_jsonb(a),a.evidence_fingerprint
FROM costing.sales_allocation_quantity_driver_acceptance a;
-- Baseline payload parity: every field of every acceptance row is byte-identical to its event.
DO $$ BEGIN
 IF (SELECT count(*) FROM costing.governance_evidence_event WHERE event_kind='BASELINE') <>
    (SELECT count(*) FROM costing.regional_marketing_evidence_acceptance)+(SELECT count(*) FROM costing.sales_allocation_quantity_driver_acceptance)
 THEN RAISE EXCEPTION 'R2A baseline cardinality mismatch'; END IF;
 IF EXISTS (SELECT 1 FROM costing.regional_marketing_evidence_acceptance a LEFT JOIN costing.governance_evidence_event e
   ON e.evidence_category='REGIONAL_MARKETING' AND e.acceptance_id=a.id AND e.event_kind='BASELINE'
   WHERE e.id IS NULL OR e.acceptance_evidence IS DISTINCT FROM to_jsonb(a) OR e.original_fingerprint IS DISTINCT FROM a.evidence_fingerprint)
 OR EXISTS (SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance a LEFT JOIN costing.governance_evidence_event e
   ON e.evidence_category='SALES_QUANTITY_DRIVER' AND e.acceptance_id=a.id AND e.event_kind='BASELINE'
   WHERE e.id IS NULL OR e.acceptance_evidence IS DISTINCT FROM to_jsonb(a) OR e.original_fingerprint IS DISTINCT FROM a.evidence_fingerprint)
 THEN RAISE EXCEPTION 'R2A baseline payload parity failure'; END IF;
END $$;
COMMIT;
-- R2A deliberately retains all legacy constraints and acceptance semantics. Between R2A and R2B, acceptance writes are
-- NOT captured; R2B re-baselines any drift under lock before enabling capture.
