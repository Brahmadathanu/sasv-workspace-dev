-- R2C (SEPARATELY GATED): remove exactly three legacy acceptance->snapshot FKs. PostgreSQL 17.
-- Preconditions enforced below (abort otherwise). Do NOT deploy before: R2A+R2B live and verified, owner approval of R2C,
-- live preflight (PREFLIGHT_02_r2c.sql) green including the consumer audit, baseline counts re-queried (expected 727 regional + 245 sales).
-- Retained: permanent evidence FKs (R2B), source_refresh_run_id -> costing_refresh_run FKs, all acceptance columns/ids/reasons/actors/timestamps.
-- Not touched: review-status functions, approval semantics, RPC definitions, snapshot tables.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE costing.regional_marketing_evidence_acceptance, costing.sales_allocation_quantity_driver_acceptance IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE exp text[][] := ARRAY[
  ['costing.regional_marketing_evidence_acceptance','regional_marketing_evidence_a_regional_marketing_snapshot__fkey','costing.sku_regional_marketing_expense_allocation_snapshot'],
  ['costing.regional_marketing_evidence_acceptance','regional_marketing_evidence_acc_regional_basis_snapshot_id_fkey','costing.sku_regional_marketing_allocation_basis_snapshot'],
  ['costing.sales_allocation_quantity_driver_acceptance','sales_allocation_quantity_driver_accept_source_snapshot_id_fkey','costing.sku_sales_allocation_basis_snapshot']];
 i int;
BEGIN
 FOR i IN 1..3 LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.contype='f' AND c.conname=exp[i][2] AND c.conrelid=exp[i][1]::regclass AND c.confrelid=exp[i][3]::regclass)
  THEN RAISE EXCEPTION 'R2C schema drift: FK % on % not found as expected',exp[i][2],exp[i][1]; END IF;
 END LOOP;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='regional_acceptance_permanent_evidence_fk' AND convalidated)
  OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sales_acceptance_permanent_evidence_fk' AND convalidated)
 THEN RAISE EXCEPTION 'R2C requires validated R2B permanent evidence FKs'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='a_governance_evidence_prepare' AND tgrelid='costing.regional_marketing_evidence_acceptance'::regclass AND tgenabled='O')
  OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='a_governance_evidence_prepare' AND tgrelid='costing.sales_allocation_quantity_driver_acceptance'::regclass AND tgenabled='O')
 THEN RAISE EXCEPTION 'R2C requires enabled R2B capture triggers'; END IF;
 IF EXISTS (SELECT 1 FROM costing_retention.fn_acceptance_source_findings() WHERE severity='BLOCKER')
 THEN RAISE EXCEPTION 'R2C source parity failure (%)',(SELECT count(*) FROM costing_retention.fn_acceptance_source_findings() WHERE severity='BLOCKER'); END IF;
 IF EXISTS (SELECT 1 FROM costing.regional_marketing_evidence_acceptance a JOIN costing.governance_evidence_event e ON e.id=a.governance_event_id
    WHERE e.acceptance_evidence IS DISTINCT FROM to_jsonb(a)-'governance_event_id'-'governance_category')
  OR EXISTS (SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance a JOIN costing.governance_evidence_event e ON e.id=a.governance_event_id
    WHERE e.acceptance_evidence IS DISTINCT FROM to_jsonb(a)-'governance_event_id'-'governance_category')
 THEN RAISE EXCEPTION 'R2C permanent evidence parity failure'; END IF;
 -- Non-FK consumers that join an acceptance row to a snapshot row by snapshot id would silently lose rows after purge.
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname IN ('costing','public') AND p.prokind IN ('f','p')
     AND pg_get_functiondef(p.oid) ~* '(acceptance|a)\.(source_snapshot_id|regional_basis_snapshot_id|regional_marketing_snapshot_id)'
     AND p.proname NOT IN ('fn_evidence_prepare','fn_evidence_record','fn_evidence_link_assert','fn_regional_source_ok','fn_sales_source_ok','fn_acceptance_source_findings'))
 THEN RAISE EXCEPTION 'R2C consumer audit: function(s) join acceptance rows to snapshot ids; review PREFLIGHT_02_r2c.sql output'; END IF;
 IF EXISTS (SELECT 1 FROM pg_depend d JOIN pg_rewrite r ON r.oid=d.objid JOIN pg_class v ON v.oid=r.ev_class
    JOIN pg_attribute att ON att.attrelid=d.refobjid AND att.attnum=d.refobjsubid
   WHERE d.refobjid IN ('costing.regional_marketing_evidence_acceptance'::regclass,'costing.sales_allocation_quantity_driver_acceptance'::regclass)
     AND att.attname IN ('source_snapshot_id','regional_basis_snapshot_id','regional_marketing_snapshot_id') AND v.relkind='v')
 THEN RAISE EXCEPTION 'R2C consumer audit: a view references an acceptance snapshot-id column'; END IF;
END $$;
ALTER TABLE costing.regional_marketing_evidence_acceptance DROP CONSTRAINT regional_marketing_evidence_a_regional_marketing_snapshot__fkey;
ALTER TABLE costing.regional_marketing_evidence_acceptance DROP CONSTRAINT regional_marketing_evidence_acc_regional_basis_snapshot_id_fkey;
ALTER TABLE costing.sales_allocation_quantity_driver_acceptance DROP CONSTRAINT sales_allocation_quantity_driver_accept_source_snapshot_id_fkey;
COMMIT;
