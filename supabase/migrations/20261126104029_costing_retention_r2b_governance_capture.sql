-- R2B (redesigned): authoritative capture of every successful acceptance write. Apply after R2A. PostgreSQL 17.
-- Supersedes ../20261125_governance_evidence_r2b.sql. Design (no recursive pointer trigger, no pg_trigger_depth authority):
--   BEFORE INSERT/UPDATE row trigger : validates evidence against live source (or prior permanent evidence for status-only
--                                      revocation) and OVERWRITES NEW.governance_event_id with a freshly reserved id. A caller-
--                                      supplied pointer is never trusted.
--   AFTER  INSERT/UPDATE row trigger : writes exactly one governance_evidence_event with that id from the FINAL row image.
--                                      It fires only for rows actually written, so an ON CONFLICT proposal that turns into an
--                                      UPDATE yields one event, and aborted statements leave none (same transaction).
--   DEFERRED FK + constraint trigger : at COMMIT the pointer must reference the event whose payload equals the current row.
--   BEFORE DELETE / TRUNCATE         : prohibited; use governed status transition.
-- All trigger functions are SECURITY DEFINER with pinned search_path so invoker roles need no privilege on the event table.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE costing.regional_marketing_evidence_acceptance, costing.sales_allocation_quantity_driver_acceptance IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE costing.governance_evidence_event IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE costing.regional_marketing_evidence_acceptance ADD COLUMN governance_event_id bigint,
 ADD COLUMN governance_category text GENERATED ALWAYS AS ('REGIONAL_MARKETING'::text) STORED;
ALTER TABLE costing.sales_allocation_quantity_driver_acceptance ADD COLUMN governance_event_id bigint,
 ADD COLUMN governance_category text GENERATED ALWAYS AS ('SALES_QUANTITY_DRIVER'::text) STORED;

-- Source predicates (identity + all fingerprint-covered fields; uncovered fields such as regional_basis_status are
-- deliberately NOT required to match because the existing RPCs renew a row to a newer run without rewriting them).
CREATE FUNCTION costing_retention.fn_regional_source_ok(a costing.regional_marketing_evidence_acceptance) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,costing AS $$
 SELECT EXISTS (SELECT 1 FROM costing.sku_regional_marketing_expense_allocation_snapshot e
  JOIN costing.sku_regional_marketing_allocation_basis_snapshot b ON b.id=e.regional_basis_snapshot_id
  WHERE e.id=a.regional_marketing_snapshot_id AND b.id=a.regional_basis_snapshot_id
  AND (a.source_refresh_run_id,a.sku_id,a.product_id,a.region_code,a.source_valuation_date,a.period_start)
    =(e.refresh_run_id,e.sku_id,e.product_id,e.region_code,e.valuation_date,e.period_start)
  AND (a.source_refresh_run_id,a.sku_id,a.product_id,a.region_code,a.source_valuation_date,a.period_start)
    =(b.refresh_run_id,b.sku_id,b.product_id,b.region_code,b.valuation_date,b.period_start)
  AND a.evidence_fingerprint=costing.fn_regional_marketing_evidence_fingerprint(e.sku_id,e.product_id,e.region_code,e.valuation_date,e.regional_basis_source,e.resolved_regional_units,e.resolved_regional_base_qty,b.regional_assumption_id,b.regional_default_policy_id,b.regional_default_scenario,e.marketing_value_source,e.resolved_product_region_marketing_sales_value,e.marketing_expense_cost_per_sku_region)
  AND (a.regional_basis_source,a.resolved_regional_units,a.resolved_regional_base_qty,a.regional_assumption_id,a.regional_default_policy_id,a.regional_default_scenario,a.marketing_value_source,a.resolved_product_region_marketing_sales_value,a.marketing_expense_cost_per_sku_region)
    IS NOT DISTINCT FROM (e.regional_basis_source,e.resolved_regional_units,e.resolved_regional_base_qty,b.regional_assumption_id,b.regional_default_policy_id,b.regional_default_scenario,e.marketing_value_source,e.resolved_product_region_marketing_sales_value,e.marketing_expense_cost_per_sku_region)) $$;
CREATE FUNCTION costing_retention.fn_sales_source_ok(a costing.sales_allocation_quantity_driver_acceptance) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,costing AS $$
 SELECT EXISTS (SELECT 1 FROM costing.sku_sales_allocation_basis_snapshot b WHERE b.id=a.source_snapshot_id
  AND (a.source_refresh_run_id,a.sku_id,a.product_id,a.source_valuation_date,a.period_start)=(b.refresh_run_id,b.sku_id,b.product_id,b.valuation_date,b.period_start)
  AND a.evidence_fingerprint=costing.fn_sales_allocation_quantity_driver_fingerprint(b.sku_id,b.product_id,b.valuation_date,b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty)
  AND (a.monthly_driver_method,a.monthly_driver_source,a.monthly_driver_source_month,a.assumption_id,a.default_policy_id,a.default_policy_scenario,a.resolved_monthly_units,a.resolved_monthly_base_qty)
    IS NOT DISTINCT FROM (b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty)) $$;
REVOKE ALL ON FUNCTION costing_retention.fn_regional_source_ok(costing.regional_marketing_evidence_acceptance) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION costing_retention.fn_sales_source_ok(costing.sales_allocation_quantity_driver_acceptance) FROM PUBLIC,anon,authenticated,service_role;

-- Backfill pointers to the BASELINE (or a top-up baseline for drift since R2A) while NO capture trigger exists.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM costing_retention.fn_acceptance_source_findings_raw() WHERE severity='BLOCKER')
 THEN RAISE EXCEPTION 'R2B blocked: source findings present'; END IF;
END $$;
INSERT INTO costing.governance_evidence_event(evidence_category,acceptance_id,source_refresh_run_id,event_kind,original_snapshot_keys,acceptance_evidence,original_fingerprint)
SELECT 'REGIONAL_MARKETING',a.id,a.source_refresh_run_id,'BASELINE',
  jsonb_build_object('regional_basis_snapshot_id',a.regional_basis_snapshot_id,'regional_marketing_snapshot_id',a.regional_marketing_snapshot_id),
  to_jsonb(a)-'governance_event_id'-'governance_category',a.evidence_fingerprint
FROM costing.regional_marketing_evidence_acceptance a
WHERE NOT EXISTS (SELECT 1 FROM costing.governance_evidence_event e WHERE e.evidence_category='REGIONAL_MARKETING' AND e.acceptance_id=a.id
  AND e.id=(SELECT max(x.id) FROM costing.governance_evidence_event x WHERE x.evidence_category=e.evidence_category AND x.acceptance_id=e.acceptance_id)
  AND e.acceptance_evidence=to_jsonb(a)-'governance_event_id'-'governance_category');
INSERT INTO costing.governance_evidence_event(evidence_category,acceptance_id,source_refresh_run_id,event_kind,original_snapshot_keys,acceptance_evidence,original_fingerprint)
SELECT 'SALES_QUANTITY_DRIVER',a.id,a.source_refresh_run_id,'BASELINE',jsonb_build_object('source_snapshot_id',a.source_snapshot_id),
  to_jsonb(a)-'governance_event_id'-'governance_category',a.evidence_fingerprint
FROM costing.sales_allocation_quantity_driver_acceptance a
WHERE NOT EXISTS (SELECT 1 FROM costing.governance_evidence_event e WHERE e.evidence_category='SALES_QUANTITY_DRIVER' AND e.acceptance_id=a.id
  AND e.id=(SELECT max(x.id) FROM costing.governance_evidence_event x WHERE x.evidence_category=e.evidence_category AND x.acceptance_id=e.acceptance_id)
  AND e.acceptance_evidence=to_jsonb(a)-'governance_event_id'-'governance_category');
UPDATE costing.regional_marketing_evidence_acceptance a SET governance_event_id=(SELECT max(e.id) FROM costing.governance_evidence_event e
  WHERE e.evidence_category='REGIONAL_MARKETING' AND e.acceptance_id=a.id);
UPDATE costing.sales_allocation_quantity_driver_acceptance a SET governance_event_id=(SELECT max(e.id) FROM costing.governance_evidence_event e
  WHERE e.evidence_category='SALES_QUANTITY_DRIVER' AND e.acceptance_id=a.id);
ALTER TABLE costing.regional_marketing_evidence_acceptance ALTER COLUMN governance_event_id SET NOT NULL;
ALTER TABLE costing.sales_allocation_quantity_driver_acceptance ALTER COLUMN governance_event_id SET NOT NULL;
ALTER TABLE costing.regional_marketing_evidence_acceptance ADD CONSTRAINT regional_acceptance_permanent_evidence_fk
 FOREIGN KEY (governance_event_id,governance_category,id) REFERENCES costing.governance_evidence_event(id,evidence_category,acceptance_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE costing.sales_allocation_quantity_driver_acceptance ADD CONSTRAINT sales_acceptance_permanent_evidence_fk
 FOREIGN KEY (governance_event_id,governance_category,id) REFERENCES costing.governance_evidence_event(id,evidence_category,acceptance_id) DEFERRABLE INITIALLY DEFERRED;


-- Post-R2B view of source findings: a missing source snapshot is NOT a defect once permanent evidence equal to the
-- acceptance row exists (that is the whole point of R2B/R2C); it is reported as PURGED_SOURCE_COVERED (INFO).
CREATE FUNCTION costing_retention.fn_acceptance_source_findings()
RETURNS TABLE(evidence_category text,acceptance_id bigint,severity text,finding text)
LANGUAGE sql STABLE SET search_path=pg_catalog,costing AS $$
 SELECT f.evidence_category,f.acceptance_id,
  CASE WHEN f.finding='source snapshot missing' AND ok.covered THEN 'INFO' ELSE f.severity END,
  CASE WHEN f.finding='source snapshot missing' AND ok.covered THEN 'PURGED_SOURCE_COVERED' ELSE f.finding END
 FROM costing_retention.fn_acceptance_source_findings_raw() f
 LEFT JOIN LATERAL (SELECT EXISTS (
   SELECT 1 FROM costing.governance_evidence_event e WHERE e.evidence_category=f.evidence_category AND e.acceptance_id=f.acceptance_id
    AND e.id=(CASE f.evidence_category WHEN 'REGIONAL_MARKETING' THEN (SELECT a.governance_event_id FROM costing.regional_marketing_evidence_acceptance a WHERE a.id=f.acceptance_id)
                                       ELSE (SELECT a.governance_event_id FROM costing.sales_allocation_quantity_driver_acceptance a WHERE a.id=f.acceptance_id) END)
    AND e.acceptance_evidence=(CASE f.evidence_category WHEN 'REGIONAL_MARKETING' THEN (SELECT to_jsonb(a)-'governance_event_id'-'governance_category' FROM costing.regional_marketing_evidence_acceptance a WHERE a.id=f.acceptance_id)
                                       ELSE (SELECT to_jsonb(a)-'governance_event_id'-'governance_category' FROM costing.sales_allocation_quantity_driver_acceptance a WHERE a.id=f.acceptance_id) END)) AS covered) ok ON true $$;
REVOKE ALL ON FUNCTION costing_retention.fn_acceptance_source_findings() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION costing_retention.fn_evidence_prepare() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,costing AS $$
DECLARE cat text; j jsonb; jold jsonb; prior jsonb; live_ok boolean; needs_source boolean:=true;
BEGIN
 IF TG_TABLE_SCHEMA<>'costing' THEN RAISE EXCEPTION 'GOVERNANCE_EVIDENCE: unexpected source'; END IF;
 j:=to_jsonb(NEW)-'governance_event_id'-'governance_category';
 IF TG_TABLE_NAME='regional_marketing_evidence_acceptance' THEN cat:='REGIONAL_MARKETING'; live_ok:=costing_retention.fn_regional_source_ok(NEW);
 ELSIF TG_TABLE_NAME='sales_allocation_quantity_driver_acceptance' THEN cat:='SALES_QUANTITY_DRIVER'; live_ok:=costing_retention.fn_sales_source_ok(NEW);
 ELSE RAISE EXCEPTION 'GOVERNANCE_EVIDENCE: unexpected source'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'GOVERNANCE_EVIDENCE: acceptance identity is immutable'; END IF;
  jold:=to_jsonb(OLD)-'governance_event_id'-'governance_category';
  SELECT e.acceptance_evidence INTO prior FROM costing.governance_evidence_event e
   WHERE e.id=OLD.governance_event_id AND e.evidence_category=cat AND e.acceptance_id=OLD.id;
  IF prior IS NULL OR prior IS DISTINCT FROM jold THEN RAISE EXCEPTION 'GOVERNANCE_EVIDENCE: prior permanent evidence missing or does not match stored row'; END IF;
  -- Governance-only change (status/note/updated_at, never INACTIVE->ACTIVE): permitted without a live source so that a
  -- revocation still works after the snapshot detail has been purged. Everything else needs live source evidence.
  IF (j-'acceptance_status'-'acceptance_note'-'updated_at') IS NOT DISTINCT FROM (jold-'acceptance_status'-'acceptance_note'-'updated_at')
     AND NOT (OLD.acceptance_status='INACTIVE' AND NEW.acceptance_status='ACTIVE') THEN needs_source:=false; END IF;
 END IF;
 IF needs_source AND NOT coalesce(live_ok,false) THEN
  RAISE EXCEPTION 'GOVERNANCE_EVIDENCE_SOURCE_INVALID: acceptance does not match its live source snapshot'; END IF;
 NEW.governance_event_id:=nextval('costing.governance_evidence_event_id_seq');   -- caller value discarded
 RETURN NEW;
END $$;
CREATE FUNCTION costing_retention.fn_evidence_record() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,costing AS $$
DECLARE cat text; k jsonb;
BEGIN
 IF TG_TABLE_NAME='regional_marketing_evidence_acceptance' THEN
  cat:='REGIONAL_MARKETING'; k:=jsonb_build_object('regional_basis_snapshot_id',NEW.regional_basis_snapshot_id,'regional_marketing_snapshot_id',NEW.regional_marketing_snapshot_id);
 ELSE cat:='SALES_QUANTITY_DRIVER'; k:=jsonb_build_object('source_snapshot_id',NEW.source_snapshot_id); END IF;
 INSERT INTO costing.governance_evidence_event(id,evidence_category,acceptance_id,source_refresh_run_id,event_kind,original_snapshot_keys,acceptance_evidence,original_fingerprint)
 VALUES(NEW.governance_event_id,cat,NEW.id,NEW.source_refresh_run_id,TG_OP,k,to_jsonb(NEW)-'governance_event_id'-'governance_category',NEW.evidence_fingerprint);
 RETURN NULL;
END $$;
CREATE FUNCTION costing_retention.fn_evidence_link_assert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,costing AS $$
DECLARE cur jsonb;
BEGIN
 IF TG_TABLE_NAME='regional_marketing_evidence_acceptance' THEN SELECT to_jsonb(a) INTO cur FROM costing.regional_marketing_evidence_acceptance a WHERE a.id=NEW.id;
 ELSE SELECT to_jsonb(a) INTO cur FROM costing.sales_allocation_quantity_driver_acceptance a WHERE a.id=NEW.id; END IF;
 IF cur IS NULL OR NOT EXISTS (SELECT 1 FROM costing.governance_evidence_event e WHERE e.id=(cur->>'governance_event_id')::bigint
   AND e.acceptance_id=(cur->>'id')::bigint AND e.evidence_category=cur->>'governance_category'
   AND e.acceptance_evidence=cur-'governance_event_id'-'governance_category')
 THEN RAISE EXCEPTION 'GOVERNANCE_EVIDENCE_LINK: pointer does not reference permanent evidence equal to the current row'; END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION costing_retention.fn_evidence_reject_delete() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS
$$ BEGIN RAISE EXCEPTION 'GOVERNANCE_EVIDENCE: % of acceptance rows is prohibited; use a governed status transition',TG_OP; END $$;
REVOKE ALL ON FUNCTION costing_retention.fn_evidence_prepare(),costing_retention.fn_evidence_record(),costing_retention.fn_evidence_link_assert(),costing_retention.fn_evidence_reject_delete() FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['regional_marketing_evidence_acceptance','sales_allocation_quantity_driver_acceptance'] LOOP
  EXECUTE format('CREATE TRIGGER a_governance_evidence_prepare BEFORE INSERT OR UPDATE ON costing.%I FOR EACH ROW EXECUTE FUNCTION costing_retention.fn_evidence_prepare()',t);
  EXECUTE format('CREATE TRIGGER z_governance_evidence_record AFTER INSERT OR UPDATE ON costing.%I FOR EACH ROW EXECUTE FUNCTION costing_retention.fn_evidence_record()',t);
  EXECUTE format('CREATE CONSTRAINT TRIGGER governance_evidence_link_assert AFTER INSERT OR UPDATE ON costing.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION costing_retention.fn_evidence_link_assert()',t);
  EXECUTE format('CREATE TRIGGER governance_evidence_no_delete BEFORE DELETE ON costing.%I FOR EACH ROW EXECUTE FUNCTION costing_retention.fn_evidence_reject_delete()',t);
  EXECUTE format('CREATE TRIGGER governance_evidence_no_truncate BEFORE TRUNCATE ON costing.%I FOR EACH STATEMENT EXECUTE FUNCTION costing_retention.fn_evidence_reject_delete()',t);
 END LOOP;
END $$;
-- Final consistency gate inside the same transaction.
SET CONSTRAINTS ALL IMMEDIATE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM costing.regional_marketing_evidence_acceptance a JOIN costing.governance_evidence_event e ON e.id=a.governance_event_id
    WHERE e.acceptance_evidence IS DISTINCT FROM to_jsonb(a)-'governance_event_id'-'governance_category')
 OR EXISTS (SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance a JOIN costing.governance_evidence_event e ON e.id=a.governance_event_id
    WHERE e.acceptance_evidence IS DISTINCT FROM to_jsonb(a)-'governance_event_id'-'governance_category')
 THEN RAISE EXCEPTION 'R2B pointer/payload parity failure'; END IF;
END $$;
COMMIT;
-- Legacy snapshot FKs remain until R2C.
-- ROLLBACK (only before R2C; afterwards the permanent evidence is the sole record and must be kept):
--   per table t in (regional_marketing_evidence_acceptance, sales_allocation_quantity_driver_acceptance):
--     DROP TRIGGER a_governance_evidence_prepare, z_governance_evidence_record, governance_evidence_link_assert,
--                  governance_evidence_no_delete, governance_evidence_no_truncate ON costing.t;
--     ALTER TABLE costing.t DROP CONSTRAINT <regional_acceptance|sales_acceptance>_permanent_evidence_fk,
--                  DROP COLUMN governance_category, DROP COLUMN governance_event_id;
--   DROP FUNCTION costing_retention.fn_evidence_prepare(), fn_evidence_record(), fn_evidence_link_assert(), fn_evidence_reject_delete(),
--                 fn_regional_source_ok(...), fn_sales_source_ok(...), fn_acceptance_source_findings();
--   Keep costing.governance_evidence_event (append-only provenance).
