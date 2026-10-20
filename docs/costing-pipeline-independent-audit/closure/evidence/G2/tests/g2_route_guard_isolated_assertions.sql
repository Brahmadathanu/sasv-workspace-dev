-- G2 isolated PostgreSQL regression specification; not run against live DB.
-- Run in rollback-only dedicated fixture DB after current function DDL and fixtures loaded.
BEGIN;
DO $test$
DECLARE a bigint; b bigint; c integer;
BEGIN
 SELECT count(*) INTO c FROM costing.production_route_family_route
 WHERE route_family_id=32 AND archived_at IS NULL
 AND status IN ('APPROVED','SUPERSEDED')
 AND effective_from<='2026-08-24'::date
 AND (effective_to IS NULL OR effective_to>='2026-08-24'::date);
 IF c<>2 THEN RAISE EXCEPTION 'Expected two family32 historical candidates; got %',c; END IF;
 SELECT count(*) INTO c FROM costing.product_process_route
 WHERE product_id=957 AND archived_at IS NULL
 AND status IN ('APPROVED','SUPERSEDED')
 AND effective_from<='2026-08-25'::date
 AND (effective_to IS NULL OR effective_to>='2026-08-25'::date);
 IF c<>2 THEN RAISE EXCEPTION 'Expected two product957 historical candidates; got %',c; END IF;
 SELECT count(*) INTO c FROM costing.product_direct_labour_workload_snapshot
 WHERE refresh_run_id=82 AND family_route_id=9 AND valuation_date='2026-08-07';
 IF c<>64 THEN RAISE EXCEPTION 'Expected 64 historical references; got %',c; END IF;
 SELECT count(*) INTO c FROM costing.product_direct_labour_workload_snapshot
 WHERE refresh_run_id IN (122,128) AND family_route_id=9;
 IF c<>0 THEN RAISE EXCEPTION 'Frozen-run predecessor reference unexpectedly appeared'; END IF;
END;
$test$;
ROLLBACK;
-- Additional cases require a fresh isolated clone with write-safe route fixtures:
-- two approved family candidates -> AMBIGUOUS_APPROVED_FAMILY_ROUTE;
-- zero matches -> NULL; one -> same ID; strict new-route approval unchanged;
-- grants/security identity and caller parity unchanged; protected run fingerprints unchanged.
