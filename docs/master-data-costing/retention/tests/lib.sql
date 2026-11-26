CREATE SCHEMA IF NOT EXISTS t; GRANT USAGE ON SCHEMA t TO anon,authenticated,service_role;
-- t.fails(sql, regex): passes only if the statement raises an error matching regex (side effects rolled back).
CREATE OR REPLACE FUNCTION t.fails(p_sql text,p_pat text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE p_sql;
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM !~* p_pat THEN RAISE EXCEPTION 'wrong error for [%]: %',left(p_sql,120),SQLERRM; END IF;
  RETURN;
 END;
 RAISE EXCEPTION 'expected failure but succeeded: [%]',left(p_sql,160);
END $$;
CREATE OR REPLACE FUNCTION t.ev() RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN RETURN (SELECT count(*) FROM costing.governance_evidence_event); END $$;
CREATE TABLE IF NOT EXISTS t.marks(k text PRIMARY KEY,n bigint NOT NULL);
CREATE OR REPLACE FUNCTION t.mark(p_k text) RETURNS void LANGUAGE sql AS $$ INSERT INTO t.marks VALUES(p_k,t.ev()) ON CONFLICT(k) DO UPDATE SET n=excluded.n $$;
CREATE OR REPLACE FUNCTION t.delta(p_k text) RETURNS bigint LANGUAGE sql AS $$ SELECT t.ev()-(SELECT n FROM t.marks WHERE k=p_k) $$;
