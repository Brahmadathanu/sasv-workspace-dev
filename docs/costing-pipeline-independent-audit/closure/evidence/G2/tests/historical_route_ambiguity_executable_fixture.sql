-- G2 isolated PostgreSQL candidate policy test (never run against live Supabase).
-- This supplements the earlier selection fixture. It does NOT replace costing RPCs.
BEGIN;
CREATE TEMP TABLE g2_version (
 id bigint PRIMARY KEY, kind text NOT NULL, subject_id integer NOT NULL,
 status text NOT NULL, starts date NOT NULL, ends date,
 archived boolean NOT NULL DEFAULT false
);
INSERT INTO g2_version VALUES
 (144,'FAMILY',101,'SUPERSEDED','2026-08-30','2026-10-31',false),
 (201,'FAMILY',101,'APPROVED','2026-11-01',null,false),
 (73,'PRODUCT',957,'SUPERSEDED','2026-08-30','2026-10-31',false),
 (99,'PRODUCT',957,'APPROVED','2026-11-01',null,false),
 (301,'PRODUCT',957,'DRAFT','2026-01-01',null,false);
-- This temporary function intentionally rejects ambiguity and ineligible statuses.
CREATE FUNCTION pg_temp.g2_resolve(p_kind text,p_subject integer,p_date date)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE matches integer; target bigint;
BEGIN
 SELECT count(*),min(id) INTO matches,target FROM g2_version
 WHERE kind=p_kind AND subject_id=p_subject
   AND status IN ('APPROVED','SUPERSEDED') AND NOT archived
   AND starts<=p_date AND (ends IS NULL OR ends>=p_date);
 IF matches>1 THEN RAISE EXCEPTION 'G2_AMBIGUOUS_HISTORICAL_ROUTE'; END IF;
 RETURN target;
END $$;
DO $$
BEGIN
 IF pg_temp.g2_resolve('FAMILY',101,date '2026-10-31') IS DISTINCT FROM 144 THEN
   RAISE EXCEPTION 'FAMILY_PREDECESSOR'; END IF;
 IF pg_temp.g2_resolve('FAMILY',101,date '2026-11-01') IS DISTINCT FROM 201 THEN
   RAISE EXCEPTION 'FAMILY_SUCCESSOR'; END IF;
 IF pg_temp.g2_resolve('PRODUCT',957,date '2026-10-31') IS DISTINCT FROM 73 THEN
   RAISE EXCEPTION 'PRODUCT_PREDECESSOR'; END IF;
 IF pg_temp.g2_resolve('PRODUCT',957,date '2026-11-01') IS DISTINCT FROM 99 THEN
   RAISE EXCEPTION 'PRODUCT_SUCCESSOR'; END IF;
 IF pg_temp.g2_resolve('FAMILY',101,date '2026-08-29') IS NOT NULL THEN
   RAISE EXCEPTION 'BEFORE_EFFECTIVE'; END IF;
 IF EXISTS(SELECT 1 FROM g2_version WHERE id=73 AND status='APPROVED') THEN
   RAISE EXCEPTION 'PROSPECTIVE_APPROVAL_STATUS'; END IF;
 INSERT INTO g2_version VALUES
   (202,'FAMILY',101,'SUPERSEDED','2026-10-31','2026-10-31',false);
 BEGIN
   PERFORM pg_temp.g2_resolve('FAMILY',101,date '2026-10-31');
   RAISE EXCEPTION 'AMBIGUITY_NOT_REJECTED';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'G2_AMBIGUOUS_HISTORICAL_ROUTE' THEN RAISE; END IF;
 END;
END $$;
ROLLBACK;
