\i lib.sql
\set ON_ERROR_STOP on
-- A. baseline parity
DO $$ BEGIN
 ASSERT (SELECT count(*) FROM costing.governance_evidence_event WHERE event_kind='BASELINE')=5,'baseline count';
 ASSERT NOT EXISTS (SELECT 1 FROM costing.regional_marketing_evidence_acceptance a JOIN costing.governance_evidence_event e ON e.id=a.governance_event_id
   WHERE e.acceptance_evidence IS DISTINCT FROM to_jsonb(a)-'governance_event_id'-'governance_category'),'regional payload parity';
 ASSERT NOT EXISTS (SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance a JOIN costing.governance_evidence_event e ON e.id=a.governance_event_id
   WHERE e.acceptance_evidence IS DISTINCT FROM to_jsonb(a)-'governance_event_id'-'governance_category'),'sales payload parity';
 ASSERT NOT EXISTS (SELECT 1 FROM costing.governance_evidence_event WHERE length(payload_sha256)<>64 OR fingerprint_algorithm<>'LEGACY_MD5_CONCAT_V1' OR schema_version<>1),'digest/algorithm/version';
 ASSERT (SELECT count(*) FROM costing_retention.fn_acceptance_source_findings() WHERE severity='BLOCKER')=0,'no blockers';
END $$;
-- B. permission gate unchanged: view-only user refused by the real RPC, no event written
SELECT t.mark('b');
SET ROLE authenticated; SELECT t.as_user('00000000-0000-0000-0000-000000000002');
DO $$ BEGIN PERFORM t.fails($q$SELECT costing.rpc_accept_regional_marketing_review(122,3,'IK','should be refused')$q$,'permission denied');
              PERFORM t.fails($q$SELECT costing.rpc_accept_sales_allocation_quantity_driver_review(122,3,'should be refused')$q$,'permission denied'); END $$;
RESET ROLE;
DO $$ BEGIN ASSERT t.delta('b')=0,'refused call wrote evidence'; END $$;
-- C. insert + same-run re-accept through the real RPCs: one event per successful write
SELECT t.mark('c');
SET ROLE authenticated; SELECT t.as_user('00000000-0000-0000-0000-000000000001');
\o /dev/null
SELECT costing.rpc_accept_regional_marketing_review(122,3,'IK','new regional acceptance');
SELECT costing.rpc_accept_sales_allocation_quantity_driver_review(122,3,'new sales acceptance');
\o
RESET ROLE;
DO $$ BEGIN ASSERT t.delta('c')=2,'insert events'; END $$;
SELECT t.mark('c2');
SET ROLE authenticated; SELECT t.as_user('00000000-0000-0000-0000-000000000001');
\o /dev/null
SELECT costing.rpc_accept_regional_marketing_review(122,3,'IK','re-accept regional');
SELECT costing.rpc_accept_sales_allocation_quantity_driver_review(122,3,'re-accept sales');
\o
RESET ROLE;
DO $$ BEGIN
 ASSERT t.delta('c2')=2,'conflict path yields exactly one event per row';
 ASSERT (SELECT count(*) FROM costing.governance_evidence_event WHERE evidence_category='SALES_QUANTITY_DRIVER' AND acceptance_id=(SELECT id FROM costing.sales_allocation_quantity_driver_acceptance WHERE sku_id=3))=2,'sales sku3 events';
 ASSERT (SELECT array_agg(event_kind ORDER BY id) FROM costing.governance_evidence_event WHERE evidence_category='SALES_QUANTITY_DRIVER' AND acceptance_id=(SELECT id FROM costing.sales_allocation_quantity_driver_acceptance WHERE sku_id=3))=ARRAY['INSERT','UPDATE'],'kinds';
END $$;
-- D. renewal to a DIFFERENT source run (same valuation date, identical evidence) via both real RPCs.
--    Regional uncovered field (regional_basis_status) deliberately differs in the new snapshot: the live RPC must still work.
UPDATE costing.sku_regional_marketing_expense_allocation_snapshot SET regional_basis_status='REVIEW_V2' WHERE refresh_run_id=150 AND sku_id=1 AND region_code='IK';
SELECT t.mark('d');
SET ROLE authenticated; SELECT t.as_user('00000000-0000-0000-0000-000000000001');
\o /dev/null
SELECT costing.rpc_accept_regional_marketing_review(150,1,'IK','renew to run 150');
SELECT costing.rpc_accept_sales_allocation_quantity_driver_review(150,1,'renew to run 150');
\o
RESET ROLE;
DO $$ BEGIN
 ASSERT t.delta('d')=2,'renewal events';
 ASSERT (SELECT source_refresh_run_id FROM costing.regional_marketing_evidence_acceptance WHERE sku_id=1 AND region_code='IK')=150,'regional renewed';
 ASSERT (SELECT source_refresh_run_id FROM costing.sales_allocation_quantity_driver_acceptance WHERE sku_id=1)=150,'sales renewed';
 ASSERT (SELECT (e.acceptance_evidence->>'source_refresh_run_id')::bigint FROM costing.sales_allocation_quantity_driver_acceptance a JOIN costing.governance_evidence_event e ON e.id=a.governance_event_id WHERE a.sku_id=1)=150,'event carries new run';
 ASSERT (SELECT regional_basis_status FROM costing.regional_marketing_evidence_acceptance WHERE sku_id=1 AND region_code='IK')<>'REVIEW_V2','acceptance keeps its original uncovered field (legacy RPC behaviour preserved)';
END $$;
-- E. transaction rollback leaves no event and no pointer change
SELECT t.mark('e');
BEGIN;
SET LOCAL ROLE authenticated; SELECT t.as_user('00000000-0000-0000-0000-000000000001');
\o /dev/null
SELECT costing.rpc_accept_sales_allocation_quantity_driver_review(122,2,'rolled back');
\o
ROLLBACK;
DO $$ BEGIN ASSERT t.delta('e')=0,'rollback leaked an event'; END $$;
-- F. repeated + multirow upsert (mixed conflict/new) emits exactly one event per written row
SELECT t.mark('f');
INSERT INTO costing.sales_allocation_quantity_driver_acceptance(period_start,source_valuation_date,sku_id,product_id,source_refresh_run_id,source_snapshot_id,monthly_driver_method,monthly_driver_source,
  monthly_driver_source_month,assumption_id,assumption_basis,default_policy_id,default_policy_scenario,resolved_monthly_units,resolved_monthly_base_qty,evidence_fingerprint,acceptance_status,acceptance_reason,accepted_by)
SELECT b.period_start,b.valuation_date,b.sku_id,b.product_id,b.refresh_run_id,b.id,b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.assumption_basis,b.default_policy_id,b.default_policy_scenario,
 b.monthly_allocation_units,b.monthly_allocation_base_qty,costing.fn_sales_allocation_quantity_driver_fingerprint(b.sku_id,b.product_id,b.valuation_date,b.monthly_driver_method,b.monthly_driver_source,b.monthly_driver_source_month,b.assumption_id,b.default_policy_id,b.default_policy_scenario,b.monthly_allocation_units,b.monthly_allocation_base_qty),
 'ACTIVE','multirow upsert','00000000-0000-0000-0000-000000000001'
FROM costing.sku_sales_allocation_basis_snapshot b WHERE b.refresh_run_id=150 ORDER BY b.sku_id
ON CONFLICT (period_start,source_valuation_date,sku_id,evidence_fingerprint) WHERE acceptance_status='ACTIVE'
DO UPDATE SET source_refresh_run_id=excluded.source_refresh_run_id,source_snapshot_id=excluded.source_snapshot_id,acceptance_reason=excluded.acceptance_reason,updated_at=now();
DO $$ BEGIN ASSERT t.delta('f')=3,'multirow upsert events (expect 3 got '||t.delta('f')||')';
 ASSERT (SELECT count(*) FROM costing.sales_allocation_quantity_driver_acceptance)=3,'no duplicate acceptance rows'; END $$;
-- G. invalid source ids / changed evidence / identity change are refused; nothing is written
SELECT t.mark('g');
DO $$ DECLARE a costing.sales_allocation_quantity_driver_acceptance; BEGIN
 SELECT * INTO a FROM costing.sales_allocation_quantity_driver_acceptance WHERE sku_id=1;
 PERFORM t.fails(format('UPDATE costing.sales_allocation_quantity_driver_acceptance SET source_snapshot_id=999999 WHERE id=%s',a.id),'SOURCE_INVALID');
 PERFORM t.fails(format('UPDATE costing.sales_allocation_quantity_driver_acceptance SET resolved_monthly_units=12345 WHERE id=%s',a.id),'SOURCE_INVALID');
 PERFORM t.fails(format('UPDATE costing.sales_allocation_quantity_driver_acceptance SET source_snapshot_id=(SELECT id FROM costing.sku_sales_allocation_basis_snapshot WHERE refresh_run_id=153 AND sku_id=1) WHERE id=%s',a.id),'SOURCE_INVALID'); -- cross-run snapshot
 PERFORM t.fails(format('UPDATE costing.sales_allocation_quantity_driver_acceptance SET id=id+1000 WHERE id=%s',a.id),'identity is immutable');
 PERFORM t.fails($q$INSERT INTO costing.sales_allocation_quantity_driver_acceptance(period_start,source_valuation_date,sku_id,product_id,source_refresh_run_id,source_snapshot_id,monthly_driver_method,monthly_driver_source,
   resolved_monthly_units,resolved_monthly_base_qty,evidence_fingerprint,acceptance_reason,accepted_by) VALUES('2026-09-01','2026-09-20',77,1077,122,424242,'M','S',1,1,'fp','r','00000000-0000-0000-0000-000000000001')$q$,'SOURCE_INVALID');
 PERFORM t.fails($q$UPDATE costing.regional_marketing_evidence_acceptance SET marketing_expense_cost_per_sku_region=9.99 WHERE sku_id=2$q$,'SOURCE_INVALID');
 PERFORM t.fails($q$UPDATE costing.regional_marketing_evidence_acceptance SET evidence_fingerprint='forged' WHERE sku_id=2$q$,'SOURCE_INVALID');
END $$;
DO $$ BEGIN ASSERT t.delta('g')=0,'rejected writes leaked events'; END $$;
-- H. direct pointer spoofing: caller-supplied pointer is discarded, also for a role holding raw DML
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON costing.regional_marketing_evidence_acceptance,costing.sales_allocation_quantity_driver_acceptance TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA costing TO service_role;
SELECT t.mark('h');
SET ROLE service_role;
UPDATE costing.regional_marketing_evidence_acceptance SET governance_event_id=1,acceptance_note='spoof attempt' WHERE sku_id=2;
RESET ROLE;
DO $$ DECLARE a costing.regional_marketing_evidence_acceptance; BEGIN
 SELECT * INTO a FROM costing.regional_marketing_evidence_acceptance WHERE sku_id=2;
 ASSERT a.governance_event_id<>1,'spoofed pointer survived';
 ASSERT t.delta('h')=1,'one event for governance-only update';
 ASSERT (SELECT acceptance_evidence->>'acceptance_note' FROM costing.governance_evidence_event WHERE id=a.governance_event_id)='spoof attempt','event holds final row';
END $$;
SET ROLE service_role;
DO $$ BEGIN
 PERFORM t.fails($q$SELECT count(*) FROM costing.governance_evidence_event$q$,'permission denied');
 PERFORM t.fails($q$INSERT INTO costing.governance_evidence_event(evidence_category,acceptance_id,source_refresh_run_id,event_kind,original_snapshot_keys,acceptance_evidence,original_fingerprint) VALUES('REGIONAL_MARKETING',1,122,'INSERT','{}','{}','x')$q$,'permission denied');
 PERFORM t.fails($q$DELETE FROM costing.regional_marketing_evidence_acceptance WHERE sku_id=2$q$,'prohibited');
 PERFORM t.fails($q$TRUNCATE costing.sales_allocation_quantity_driver_acceptance$q$,'prohibited');
END $$;
RESET ROLE;
-- I. event table append-only for every role incl. owner; anon/authenticated have no access to either side
DO $$ BEGIN
 PERFORM t.fails($q$UPDATE costing.governance_evidence_event SET event_kind='INSERT'$q$,'append_only');
 PERFORM t.fails($q$DELETE FROM costing.governance_evidence_event$q$,'append_only');
 PERFORM t.fails($q$TRUNCATE costing.governance_evidence_event$q$,'append_only|foreign key');  -- PG rejects FK-referenced TRUNCATE before the trigger; either way it is blocked
 PERFORM t.fails($q$DELETE FROM costing.regional_marketing_evidence_acceptance$q$,'prohibited');
 PERFORM t.fails($q$TRUNCATE costing.regional_marketing_evidence_acceptance$q$,'prohibited');
END $$;
SET ROLE authenticated;
DO $$ BEGIN
 PERFORM t.fails($q$SELECT * FROM costing.governance_evidence_event$q$,'permission denied');
 PERFORM t.fails($q$UPDATE costing.sales_allocation_quantity_driver_acceptance SET acceptance_note='x'$q$,'permission denied');
 PERFORM t.fails($q$SELECT costing_retention.fn_regional_source_ok(a) FROM costing.regional_marketing_evidence_acceptance a$q$,'permission denied');
END $$;
RESET ROLE;
REVOKE ALL ON costing.regional_marketing_evidence_acceptance,costing.sales_allocation_quantity_driver_acceptance FROM service_role;
\echo PASS 03_r2_adversarial
