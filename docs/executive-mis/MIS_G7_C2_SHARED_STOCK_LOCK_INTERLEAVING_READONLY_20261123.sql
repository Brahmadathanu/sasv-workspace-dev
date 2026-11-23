-- G7 C2 synthetic shared-stock race illustration. READ ONLY, no session locks.
-- Two independent writers each see opening stock 10 and both request 7.
-- Without shared lock, both prechecks pass though combined posting is impossible.
BEGIN READ ONLY;
SET LOCAL statement_timeout='4500ms';
WITH scenarios(id,available,request_a,request_b,expected) AS (
 VALUES
 ('two_packers_oversubscribe',10::numeric,7::numeric,7::numeric,'SERIAL_SECOND_DENIED'),
 ('two_packers_fit',10::numeric,4::numeric,6::numeric,'BOTH_FIT'),
 ('pack_vs_force_close',10::numeric,7::numeric,10::numeric,'SERIAL_SECOND_DENIED'),
 ('two_different_locations',10::numeric,7::numeric,0::numeric,'LOCATION_LOCK_REQUIRED')
), decisions AS (
 SELECT id,expected,
  request_a <= available as independently_a_accepted,
  request_b <= available as independently_b_accepted,
  CASE WHEN id='two_different_locations' THEN 'LOCATION_LOCK_REQUIRED'
   WHEN request_a+request_b<=available THEN 'BOTH_FIT'
   ELSE 'SERIAL_SECOND_DENIED' END actual
 FROM scenarios
)
SELECT id,expected,actual,expected=actual pass,
 independently_a_accepted,independently_b_accepted
FROM decisions ORDER BY id;
COMMIT;
-- This is a proof of stale concurrent check logical risk, NOT execution of
-- two actual PostgreSQL sessions. Real locking/transaction tests are required.
