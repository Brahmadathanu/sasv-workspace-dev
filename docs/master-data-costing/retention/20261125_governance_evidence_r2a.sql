-- R2A: additive permanent acceptance evidence. No FK removal or purge.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE costing.regional_marketing_evidence_acceptance,
 costing.sales_allocation_quantity_driver_acceptance IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE costing.governance_evidence_event (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 evidence_category text NOT NULL CHECK(evidence_category IN ('REGIONAL_MARKETING','SALES_QUANTITY_DRIVER')),
 acceptance_id bigint NOT NULL,
 source_refresh_run_id bigint NOT NULL REFERENCES costing.costing_refresh_run(id) ON DELETE RESTRICT,
 schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version>0),
 event_kind text NOT NULL CHECK(event_kind IN ('BASELINE','INSERT','UPDATE','DELETE')),
 original_snapshot_keys jsonb NOT NULL,
 acceptance_evidence jsonb NOT NULL,
 original_fingerprint text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,evidence_category,acceptance_id)
);
ALTER TABLE costing.governance_evidence_event ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON costing.governance_evidence_event FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE costing.governance_evidence_event_id_seq FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX governance_evidence_event_acceptance_idx ON costing.governance_evidence_event(evidence_category,acceptance_id,id DESC);
CREATE INDEX governance_evidence_event_run_idx ON costing.governance_evidence_event(source_refresh_run_id);
-- Capture typed acceptance register values as a versioned document, not snapshot rows.
-- Legacy keys remain historical identifiers; FK removal belongs to R2B.
CREATE FUNCTION costing.fn_capture_governance_evidence_event() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,costing AS $$
DECLARE j jsonb; k jsonb; cat text;
BEGIN
 IF TG_OP='DELETE' THEN j:=to_jsonb(OLD); ELSE j:=to_jsonb(NEW); END IF;
 IF TG_TABLE_SCHEMA<>'costing' THEN RAISE EXCEPTION 'Unexpected evidence source'; END IF;
 IF TG_TABLE_NAME='regional_marketing_evidence_acceptance' THEN
   cat:='REGIONAL_MARKETING';
   k:=jsonb_build_object('regional_basis_snapshot_id',j->'regional_basis_snapshot_id','regional_marketing_snapshot_id',j->'regional_marketing_snapshot_id');
 ELSIF TG_TABLE_NAME='sales_allocation_quantity_driver_acceptance' THEN
   cat:='SALES_QUANTITY_DRIVER';
   k:=jsonb_build_object('source_snapshot_id',j->'source_snapshot_id');
 ELSE RAISE EXCEPTION 'Unexpected evidence source';
 END IF;
 INSERT INTO costing.governance_evidence_event(evidence_category,acceptance_id,source_refresh_run_id,event_kind,original_snapshot_keys,acceptance_evidence,original_fingerprint)
 VALUES(cat,(j->>'id')::bigint,(j->>'source_refresh_run_id')::bigint,TG_OP,k,j,j->>'evidence_fingerprint');
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION costing.fn_capture_governance_evidence_event() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION costing.fn_reject_governance_evidence_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Permanent governance evidence is append-only'; END $$;
REVOKE ALL ON FUNCTION costing.fn_reject_governance_evidence_mutation() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER governance_evidence_no_mutation BEFORE UPDATE OR DELETE OR TRUNCATE ON costing.governance_evidence_event
 FOR EACH STATEMENT EXECUTE FUNCTION costing.fn_reject_governance_evidence_mutation();
-- Validate all existing sources before copying. No inferential or fabricated evidence.
DO $$
BEGIN
 IF EXISTS (
 SELECT 1 FROM costing.regional_marketing_evidence_acceptance a
 LEFT JOIN costing.sku_regional_marketing_expense_allocation_snapshot e ON e.id=a.regional_marketing_snapshot_id
 LEFT JOIN costing.sku_regional_marketing_allocation_basis_snapshot b ON b.id=a.regional_basis_snapshot_id
 WHERE e.id IS NULL OR b.id IS NULL OR
 (a.source_refresh_run_id,a.sku_id,a.product_id,a.region_code,a.source_valuation_date,a.regional_basis_snapshot_id)
 IS DISTINCT FROM (e.refresh_run_id,e.sku_id,e.product_id,e.region_code,e.valuation_date,e.regional_basis_snapshot_id)
 OR (a.source_refresh_run_id,a.sku_id,a.product_id,a.region_code,a.source_valuation_date)
 IS DISTINCT FROM (b.refresh_run_id,b.sku_id,b.product_id,b.region_code,b.valuation_date)
 OR a.evidence_fingerprint IS DISTINCT FROM costing.fn_regional_marketing_evidence_fingerprint(e.sku_id,e.product_id,e.region_code,e.valuation_date,e.regional_basis_source,e.resolved_regional_units,e.resolved_regional_base_qty,b.regional_assumption_id,b.regional_default_policy_id,b.regional_default_scenario,e.marketing_value_source,e.resolved_product_region_marketing_sales_value,e.marketing_expense_cost_per_sku_region)
 ) THEN RAISE EXCEPTION 'Regional evidence source mismatch'; END IF;
 IF EXISTS (
 SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance a
 LEFT JOIN costing.sku_sales_allocation_basis_snapshot b ON b.id=a.source_snapshot_id
 WHERE b.id IS NULL OR (a.source_refresh_run_id,a.sku_id,a.product_id,a.source_valuation_date)
 IS DISTINCT FROM (b.refresh_run_id,b.sku_id,b.product_id,b.valuation_date)
 OR a.evidence_fingerprint IS DISTINCT FROM costing.fn_sales_allocation_quantity_driver_fingerprint(b.sku_id,b.product_id,b.valuation_date,b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty)
 ) THEN RAISE EXCEPTION 'Sales driver evidence source mismatch'; END IF;
END $$;
INSERT INTO costing.governance_evidence_event(evidence_category,acceptance_id,source_refresh_run_id,event_kind,original_snapshot_keys,acceptance_evidence,original_fingerprint)
SELECT 'REGIONAL_MARKETING',a.id,a.source_refresh_run_id,'BASELINE',
 jsonb_build_object('regional_basis_snapshot_id',a.regional_basis_snapshot_id,'regional_marketing_snapshot_id',a.regional_marketing_snapshot_id),to_jsonb(a),a.evidence_fingerprint
FROM costing.regional_marketing_evidence_acceptance a
UNION ALL
SELECT 'SALES_QUANTITY_DRIVER',a.id,a.source_refresh_run_id,'BASELINE',
 jsonb_build_object('source_snapshot_id',a.source_snapshot_id),to_jsonb(a),a.evidence_fingerprint
FROM costing.sales_allocation_quantity_driver_acceptance a;
CREATE TRIGGER capture_governance_evidence AFTER INSERT OR UPDATE OR DELETE ON costing.regional_marketing_evidence_acceptance
 FOR EACH ROW EXECUTE FUNCTION costing.fn_capture_governance_evidence_event();
CREATE TRIGGER capture_governance_evidence AFTER INSERT OR UPDATE OR DELETE ON costing.sales_allocation_quantity_driver_acceptance
 FOR EACH ROW EXECUTE FUNCTION costing.fn_capture_governance_evidence_event();
COMMIT;
-- R2B must establish permanent FK/identity validation before removing the three snapshot FKs.
-- R2A deliberately retains all legacy constraints and current acceptance semantics.
