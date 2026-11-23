-- Executive MIS G7 synthetic snapshot/correction lineage assertions.
-- REVIEW ONLY. Uses VALUES; read-only; not production source writes.
BEGIN READ ONLY;
SET LOCAL statement_timeout='6000ms';
WITH cases(case_id,has_snapshot,ik_lines,ok_lines,expected) AS (
VALUES ('both_stores',true,171,55,'PRESENT_BUT_NOT_CERTIFIED'),
       ('missing_ok',true,171,0,'MISSING_EXPECTED_STORE'),
       ('missing_snapshot',false,0,0,'NO_SNAPSHOT'),
       ('empty_snapshot',true,0,0,'NO_TRANSFER_LINES')
), out AS (
 SELECT case_id,expected,
   CASE WHEN NOT has_snapshot THEN 'NO_SNAPSHOT'
        WHEN ik_lines+ok_lines=0 THEN 'NO_TRANSFER_LINES'
        WHEN ik_lines=0 OR ok_lines=0 THEN 'MISSING_EXPECTED_STORE'
        ELSE 'PRESENT_BUT_NOT_CERTIFIED' END AS status
 FROM cases
)
SELECT case_id,status,expected,status=expected AS pass FROM out ORDER BY case_id;

-- A retroactive source change must be detectable by full original line comparison,
-- even if a voucher GUID and line number do not change.
WITH prior(store,guid,line_no,amount) AS (
 VALUES ('IK','g1',1,100::numeric),('IK','g2',1,50::numeric),('OK','g3',1,20::numeric)
), next_snap(store,guid,line_no,amount) AS (
 VALUES ('IK','g1',1,100::numeric),('IK','g2',1,45::numeric),('OK','g3',1,20::numeric)
), delta AS (
 SELECT (SELECT count(*) FROM (SELECT * FROM prior EXCEPT ALL SELECT * FROM next_snap) x) left_delta,
        (SELECT count(*) FROM (SELECT * FROM next_snap EXCEPT ALL SELECT * FROM prior) x) right_delta
)
SELECT left_delta,right_delta,left_delta=1 AND right_delta=1 AS corrected_source_detected FROM delta;
COMMIT;

-- Notes: IK/OK are fixture-specific expected stores, NOT a claim of globally valid completeness.
-- No source completion manifest exists in the inspected Tally tables.
-- The production review candidate marks completeness NOT_CERTIFIED.
-- These tests do not compile the full PL/pgSQL function or establish signed-in permissions.
