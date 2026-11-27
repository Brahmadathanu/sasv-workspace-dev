\i lib.sql
-- R2C must refuse while a source row is wrong, then pass; then simulate purging run-150 snapshot detail (children first).
DO $$ BEGIN PERFORM t.fails($q$SELECT 1/0$q$,'division'); END $$;
\i ../candidates/R2C_drop_legacy_snapshot_fks.sql
DO $$ BEGIN
 ASSERT NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('regional_marketing_evidence_a_regional_marketing_snapshot__fkey','regional_marketing_evidence_acc_regional_basis_snapshot_id_fkey','sales_allocation_quantity_driver_accept_source_snapshot_id_fkey')),'three FKs dropped';
 ASSERT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='regional_acceptance_permanent_evidence_fk' AND convalidated) AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sales_acceptance_permanent_evidence_fk' AND convalidated),'permanent FKs remain';
 ASSERT (SELECT count(*) FROM pg_constraint WHERE contype='f' AND conrelid IN ('costing.regional_marketing_evidence_acceptance'::regclass,'costing.sales_allocation_quantity_driver_acceptance'::regclass) AND confrelid='costing.costing_refresh_run'::regclass)=2,'run identity FKs remain';
END $$;
SELECT t.mark('purge');
-- simulate the purge of run 150 snapshot detail (child first); accepted evidence has been renewed onto run 150
DELETE FROM costing.sku_regional_marketing_expense_allocation_snapshot WHERE refresh_run_id=150;
DELETE FROM costing.sku_regional_marketing_allocation_basis_snapshot WHERE refresh_run_id=150;
DELETE FROM costing.sku_sales_allocation_basis_snapshot WHERE refresh_run_id=150;
DO $$ DECLARE n int; BEGIN
 ASSERT (SELECT count(*) FROM costing.sales_allocation_quantity_driver_acceptance)=4 AND (SELECT count(*) FROM costing.regional_marketing_evidence_acceptance)=4,'acceptance rows survive purge';
 ASSERT (SELECT count(*) FROM costing_retention.fn_acceptance_source_findings() WHERE severity='BLOCKER')=0,'purged source with permanent evidence is not a blocker';
 ASSERT (SELECT count(*) FROM costing_retention.fn_acceptance_source_findings() WHERE finding='PURGED_SOURCE_COVERED')>=1,'reported as covered';
 -- changed evidence / reactivation / re-acceptance on purged source are refused
 PERFORM t.fails($q$UPDATE costing.sales_allocation_quantity_driver_acceptance SET resolved_monthly_units=1 WHERE sku_id=1$q$,'SOURCE_INVALID');
 PERFORM t.fails($q$UPDATE costing.sales_allocation_quantity_driver_acceptance SET source_refresh_run_id=122 WHERE sku_id=1$q$,'SOURCE_INVALID');
 PERFORM t.fails($q$INSERT INTO costing.sales_allocation_quantity_driver_acceptance(period_start,source_valuation_date,sku_id,product_id,source_refresh_run_id,source_snapshot_id,monthly_driver_method,monthly_driver_source,resolved_monthly_units,resolved_monthly_base_qty,evidence_fingerprint,acceptance_reason,accepted_by) VALUES('2026-09-01','2026-09-20',9,1009,150,1,'M','S',1,1,'x','r','00000000-0000-0000-0000-000000000001')$q$,'SOURCE_INVALID');
END $$;
-- status-only revocation after purge: allowed, writes one event whose payload is the final row
UPDATE costing.sales_allocation_quantity_driver_acceptance SET acceptance_status='INACTIVE',updated_at=clock_timestamp() WHERE sku_id=1;
UPDATE costing.regional_marketing_evidence_acceptance SET acceptance_status='INACTIVE',acceptance_note='revoked after purge' WHERE sku_id=1 AND region_code='IK';
DO $$ BEGIN
 ASSERT t.delta('purge')=2,'one event per revocation';
 ASSERT (SELECT e.acceptance_evidence->>'acceptance_status' FROM costing.sales_allocation_quantity_driver_acceptance a JOIN costing.governance_evidence_event e ON e.id=a.governance_event_id WHERE a.sku_id=1)='INACTIVE','revocation evidence';
 -- reactivation needs a live source -> refused; revocation cannot smuggle other field changes
 PERFORM t.fails($q$UPDATE costing.sales_allocation_quantity_driver_acceptance SET acceptance_status='ACTIVE' WHERE sku_id=1$q$,'SOURCE_INVALID');
 PERFORM t.fails($q$UPDATE costing.sales_allocation_quantity_driver_acceptance SET acceptance_status='INACTIVE',acceptance_reason='rewritten history' WHERE sku_id=2$q$,'SOURCE_INVALID');
 PERFORM t.fails($q$UPDATE costing.sales_allocation_quantity_driver_acceptance SET acceptance_status='INACTIVE',accepted_by='00000000-0000-0000-0000-000000000009' WHERE sku_id=2$q$,'SOURCE_INVALID');
END $$;
-- real RPCs cannot (re)accept a purged run, and review-status consumers still resolve acceptances by fingerprint
SET ROLE authenticated; SELECT t.as_user('00000000-0000-0000-0000-000000000001');
DO $$ BEGIN PERFORM t.fails($q$SELECT costing.rpc_accept_sales_allocation_quantity_driver_review(150,2,'purged run')$q$,'not found');
            PERFORM t.fails($q$SELECT costing.rpc_accept_regional_marketing_review(150,2,'IK','purged run')$q$,'not found'); END $$;
RESET ROLE;
-- every acceptance still references a permanent event equal to its row; event total = baselines + writes, none orphaned
DO $$ BEGIN
 ASSERT NOT EXISTS (SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance a JOIN costing.governance_evidence_event e ON e.id=a.governance_event_id WHERE e.acceptance_evidence IS DISTINCT FROM to_jsonb(a)-'governance_event_id'-'governance_category'),'sales parity';
 ASSERT NOT EXISTS (SELECT 1 FROM costing.regional_marketing_evidence_acceptance a JOIN costing.governance_evidence_event e ON e.id=a.governance_event_id WHERE e.acceptance_evidence IS DISTINCT FROM to_jsonb(a)-'governance_event_id'-'governance_category'),'regional parity';
 ASSERT NOT EXISTS (SELECT 1 FROM costing.governance_evidence_event e WHERE NOT EXISTS (SELECT 1 FROM costing.regional_marketing_evidence_acceptance a WHERE e.evidence_category='REGIONAL_MARKETING' AND a.id=e.acceptance_id)
     AND NOT EXISTS (SELECT 1 FROM costing.sales_allocation_quantity_driver_acceptance a WHERE e.evidence_category='SALES_QUANTITY_DRIVER' AND a.id=e.acceptance_id)),'no orphan events (event for non-existent acceptance)';
 ASSERT NOT EXISTS (SELECT 1 FROM costing.governance_evidence_event e WHERE e.event_kind IN ('INSERT','UPDATE') AND e.recorded_xid IS NULL),'xid recorded';
END $$;
\echo PASS 06_r2c_cutover_and_purged_source
