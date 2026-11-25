-- R2B candidate: durable current-event reference; apply after R2A.
-- Do not deploy until PG17 integration and consumer acceptance pass.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE costing.regional_marketing_evidence_acceptance, costing.sales_allocation_quantity_driver_acceptance IN SHARE ROW EXCLUSIVE MODE;
DROP TRIGGER capture_governance_evidence ON costing.regional_marketing_evidence_acceptance;
DROP TRIGGER capture_governance_evidence ON costing.sales_allocation_quantity_driver_acceptance;
ALTER TABLE costing.regional_marketing_evidence_acceptance ADD COLUMN governance_event_id bigint,
 ADD COLUMN governance_category text GENERATED ALWAYS AS ('REGIONAL_MARKETING'::text) STORED;
ALTER TABLE costing.sales_allocation_quantity_driver_acceptance ADD COLUMN governance_event_id bigint,
 ADD COLUMN governance_category text GENERATED ALWAYS AS ('SALES_QUANTITY_DRIVER'::text) STORED;
UPDATE costing.regional_marketing_evidence_acceptance a SET governance_event_id=e.id
FROM costing.governance_evidence_event e WHERE e.evidence_category='REGIONAL_MARKETING' AND e.acceptance_id=a.id
 AND e.id=(SELECT max(x.id) FROM costing.governance_evidence_event x WHERE x.evidence_category=e.evidence_category AND x.acceptance_id=e.acceptance_id)
 AND e.acceptance_evidence=to_jsonb(a)-'governance_event_id'-'governance_category';
UPDATE costing.sales_allocation_quantity_driver_acceptance a SET governance_event_id=e.id
FROM costing.governance_evidence_event e WHERE e.evidence_category='SALES_QUANTITY_DRIVER' AND e.acceptance_id=a.id
 AND e.id=(SELECT max(x.id) FROM costing.governance_evidence_event x WHERE x.evidence_category=e.evidence_category AND x.acceptance_id=e.acceptance_id)
 AND e.acceptance_evidence=to_jsonb(a)-'governance_event_id'-'governance_category';
ALTER TABLE costing.regional_marketing_evidence_acceptance ALTER COLUMN governance_event_id SET NOT NULL,
 ADD CONSTRAINT regional_acceptance_permanent_evidence_fk FOREIGN KEY(governance_event_id,governance_category,id) REFERENCES costing.governance_evidence_event(id,evidence_category,acceptance_id);
ALTER TABLE costing.sales_allocation_quantity_driver_acceptance ALTER COLUMN governance_event_id SET NOT NULL,
 ADD CONSTRAINT sales_acceptance_permanent_evidence_fk FOREIGN KEY(governance_event_id,governance_category,id) REFERENCES costing.governance_evidence_event(id,evidence_category,acceptance_id);
CREATE OR REPLACE FUNCTION costing.fn_capture_governance_evidence_event() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,costing AS $$
DECLARE j jsonb; k jsonb; cat text; prior jsonb; source_ok boolean; event_id bigint;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Acceptance deletion is prohibited; use governed status transition'; END IF;
 j:=to_jsonb(NEW)-'governance_event_id'-'governance_category';
 IF TG_TABLE_SCHEMA<>'costing' THEN RAISE EXCEPTION 'Unexpected evidence source'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.id<>OLD.id THEN RAISE EXCEPTION 'Acceptance identity is immutable'; END IF;
  SELECT acceptance_evidence INTO STRICT prior FROM costing.governance_evidence_event WHERE id=OLD.governance_event_id;
  IF prior IS DISTINCT FROM to_jsonb(OLD)-'governance_event_id'-'governance_category' THEN RAISE EXCEPTION 'Prior evidence mismatch'; END IF;
 END IF;
 IF TG_TABLE_NAME='regional_marketing_evidence_acceptance' THEN
  cat:='REGIONAL_MARKETING';
  k:=jsonb_build_object('regional_basis_snapshot_id',j->'regional_basis_snapshot_id','regional_marketing_snapshot_id',j->'regional_marketing_snapshot_id');
  SELECT EXISTS(SELECT 1 FROM costing.sku_regional_marketing_expense_allocation_snapshot e JOIN costing.sku_regional_marketing_allocation_basis_snapshot b ON b.id=e.regional_basis_snapshot_id
  WHERE e.id=NEW.regional_marketing_snapshot_id AND b.id=NEW.regional_basis_snapshot_id
  AND (e.refresh_run_id,e.sku_id,e.product_id,e.region_code,e.valuation_date,e.period_start)=(NEW.source_refresh_run_id,NEW.sku_id,NEW.product_id,NEW.region_code,NEW.source_valuation_date,NEW.period_start)
  AND (b.refresh_run_id,b.sku_id,b.product_id,b.region_code,b.valuation_date,b.period_start)=(NEW.source_refresh_run_id,NEW.sku_id,NEW.product_id,NEW.region_code,NEW.source_valuation_date,NEW.period_start)
  AND NEW.evidence_fingerprint=costing.fn_regional_marketing_evidence_fingerprint(e.sku_id,e.product_id,e.region_code,e.valuation_date,e.regional_basis_source,e.resolved_regional_units,e.resolved_regional_base_qty,b.regional_assumption_id,b.regional_default_policy_id,b.regional_default_scenario,e.marketing_value_source,e.resolved_product_region_marketing_sales_value,e.marketing_expense_cost_per_sku_region)
  AND (NEW.regional_basis_source,NEW.regional_basis_status,NEW.resolved_regional_units,NEW.resolved_regional_base_qty,NEW.regional_assumption_id,NEW.regional_default_policy_id,NEW.regional_default_scenario,NEW.marketing_value_source,NEW.resolved_product_region_marketing_sales_value,NEW.marketing_expense_cost_per_sku_region)
  IS NOT DISTINCT FROM (e.regional_basis_source,e.regional_basis_status,e.resolved_regional_units,e.resolved_regional_base_qty,b.regional_assumption_id,b.regional_default_policy_id,b.regional_default_scenario,e.marketing_value_source,e.resolved_product_region_marketing_sales_value,e.marketing_expense_cost_per_sku_region)) INTO source_ok;
 ELSIF TG_TABLE_NAME='sales_allocation_quantity_driver_acceptance' THEN
  cat:='SALES_QUANTITY_DRIVER';
  k:=jsonb_build_object('source_snapshot_id',j->'source_snapshot_id');
  SELECT EXISTS(SELECT 1 FROM costing.sku_sales_allocation_basis_snapshot b WHERE b.id=NEW.source_snapshot_id
  AND (b.refresh_run_id,b.sku_id,b.product_id,b.valuation_date,b.period_start)=(NEW.source_refresh_run_id,NEW.sku_id,NEW.product_id,NEW.source_valuation_date,NEW.period_start)
  AND NEW.evidence_fingerprint=costing.fn_sales_allocation_quantity_driver_fingerprint(b.sku_id,b.product_id,b.valuation_date,b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty)
  AND (NEW.monthly_driver_method,NEW.monthly_driver_source,NEW.monthly_driver_source_month,NEW.assumption_id,NEW.assumption_basis,NEW.default_policy_id,NEW.default_policy_scenario,NEW.resolved_monthly_units,NEW.resolved_monthly_base_qty)
  IS NOT DISTINCT FROM (b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.assumption_basis,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty)) INTO source_ok;
 ELSE RAISE EXCEPTION 'Unexpected evidence source'; END IF;
 -- A status-only revocation may use prior permanent evidence, not a purged snapshot.
 IF NOT coalesce(source_ok,false) THEN
  IF TG_OP<>'UPDATE' OR NEW.acceptance_status='ACTIVE' OR OLD.acceptance_status<>'ACTIVE'
   OR (j-'acceptance_status'-'updated_at') IS DISTINCT FROM (prior-'acceptance_status'-'updated_at')
  THEN RAISE EXCEPTION 'Missing or inconsistent live acceptance source'; END IF;
 END IF;
 INSERT INTO costing.governance_evidence_event(evidence_category,acceptance_id,source_refresh_run_id,event_kind,original_snapshot_keys,acceptance_evidence,original_fingerprint)
 VALUES(cat,NEW.id,NEW.source_refresh_run_id,TG_OP,k,j,NEW.evidence_fingerprint) RETURNING id INTO event_id;
 NEW.governance_event_id:=event_id;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_governance_evidence BEFORE INSERT OR UPDATE OR DELETE ON costing.regional_marketing_evidence_acceptance FOR EACH ROW EXECUTE FUNCTION costing.fn_capture_governance_evidence_event();
CREATE TRIGGER capture_governance_evidence BEFORE INSERT OR UPDATE OR DELETE ON costing.sales_allocation_quantity_driver_acceptance FOR EACH ROW EXECUTE FUNCTION costing.fn_capture_governance_evidence_event();
-- Existing source FKs intentionally remain until R2C cutover after integration tests.
COMMIT;
