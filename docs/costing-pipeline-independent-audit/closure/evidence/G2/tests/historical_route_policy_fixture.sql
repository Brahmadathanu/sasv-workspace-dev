-- G2 isolated PostgreSQL policy fixture, NOT a production migration.
-- Execute only in disposable PostgreSQL, not Supabase production.
BEGIN;
CREATE TEMP TABLE g2_routes(id bigint PRIMARY KEY, kind text, subject integer, status text, from_date date, to_date date, archived boolean DEFAULT false);
INSERT INTO g2_routes VALUES
(144,'family',101,'SUPERSEDED','2026-08-30','2026-10-31',false),
(201,'family',101,'APPROVED','2026-11-01',null,false),
(73,'product',957,'SUPERSEDED','2026-08-30','2026-10-31',false),
(99,'product',957,'APPROVED','2026-11-01',null,false),
(301,'product',1000,'DRAFT','2026-08-30',null,false),
(302,'product',1001,'SUPERSEDED','2026-08-30','2026-10-31',true);
CREATE TEMP VIEW g2_historical_eligible AS SELECT * FROM g2_routes WHERE NOT archived AND status IN ('APPROVED','SUPERSEDED');
DO $$
DECLARE n integer; chosen bigint;
BEGIN
 SELECT count(*),min(id) INTO n,chosen FROM g2_historical_eligible WHERE kind='family' AND subject=101 AND date '2026-10-31' BETWEEN from_date AND coalesce(to_date,'infinity'::date);
 IF n<>1 OR chosen<>144 THEN RAISE EXCEPTION 'historical family predecessor failed'; END IF;
 SELECT count(*),min(id) INTO n,chosen FROM g2_historical_eligible WHERE kind='family' AND subject=101 AND date '2026-11-01' BETWEEN from_date AND coalesce(to_date,'infinity'::date);
 IF n<>1 OR chosen<>201 THEN RAISE EXCEPTION 'family successor failed'; END IF;
 SELECT count(*),min(id) INTO n,chosen FROM g2_historical_eligible WHERE kind='product' AND subject=957 AND date '2026-10-31' BETWEEN from_date AND coalesce(to_date,'infinity'::date);
 IF n<>1 OR chosen<>73 THEN RAISE EXCEPTION 'historical product predecessor failed'; END IF;
 SELECT count(*),min(id) INTO n,chosen FROM g2_historical_eligible WHERE kind='product' AND subject=957 AND date '2026-11-01' BETWEEN from_date AND coalesce(to_date,'infinity'::date);
 IF n<>1 OR chosen<>99 THEN RAISE EXCEPTION 'product successor failed'; END IF;
 SELECT count(*) INTO n FROM g2_historical_eligible WHERE subject IN (1000,1001);
 IF n<>0 THEN RAISE EXCEPTION 'archive or draft exclusion failed'; END IF;
 INSERT INTO g2_routes VALUES (202,'family',101,'SUPERSEDED','2026-10-31','2026-10-31',false);
 SELECT count(*) INTO n FROM g2_historical_eligible WHERE kind='family' AND subject=101 AND date '2026-10-31' BETWEEN from_date AND coalesce(to_date,'infinity'::date);
 IF n<>2 THEN RAISE EXCEPTION 'ambiguous fixture not detected'; END IF;
 -- A production resolver MUST raise on n>1; this fixture only checks the detection predicate.
END $$;
ROLLBACK;