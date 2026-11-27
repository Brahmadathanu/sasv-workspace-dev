-- Executive MIS G7 S3: review-only writer decision matrix.
-- SYNTHETIC VALUES + SELECT ONLY; no tables, functions, grants or writer installed.
BEGIN READ ONLY;
SET LOCAL statement_timeout='6000ms';
WITH cases(case_id,authenticated,view_ok,edit_ok,owner_ok,valid_approved,
 completion_verified,requested_verified,existing_digest,proposed_digest,
 same_idem,predecessor_ok,expected) AS (
 VALUES
 ('anonymous',false,false,false,false,true,true,true,NULL::text,'a',false,true,'DENY_AUTH'),
 ('view_only',true,true,false,false,true,true,true,NULL::text,'a',false,true,'DENY_EDIT'),
 ('editor_not_owner',true,true,true,false,true,true,true,NULL::text,'a',false,true,'DENY_OWNER'),
 ('draft_cost',true,true,true,true,false,true,true,NULL::text,'a',false,true,'DENY_COST'),
 ('false_verified_completion',true,true,true,true,true,false,true,NULL::text,'a',false,true,'DENY_VERIFIED_CLAIM'),
 ('disclosed_limitations',true,true,true,true,true,false,false,NULL::text,'a',false,true,'INSERT_LIMITED'),
 ('idempotent_retry',true,true,true,true,true,true,true,'a','a',true,true,'RETURN_EXISTING'),
 ('same_key_different_payload',true,true,true,true,true,true,true,'a','b',true,true,'CONFLICT'),
 ('stale_predecessor',true,true,true,true,true,true,true,NULL::text,'a',false,false,'STALE'),
 ('new_revision',true,true,true,true,true,true,true,NULL::text,'b',false,true,'INSERT_VERIFIED')
), classified AS (
 SELECT case_id,expected,CASE
 WHEN NOT authenticated THEN 'DENY_AUTH'
 WHEN NOT view_ok OR NOT edit_ok THEN 'DENY_EDIT'
 WHEN NOT owner_ok THEN 'DENY_OWNER'
 WHEN NOT valid_approved THEN 'DENY_COST'
 WHEN requested_verified AND NOT completion_verified THEN 'DENY_VERIFIED_CLAIM'
 WHEN same_idem AND existing_digest IS NOT DISTINCT FROM proposed_digest THEN 'RETURN_EXISTING'
 WHEN same_idem THEN 'CONFLICT'
 WHEN NOT predecessor_ok THEN 'STALE'
 WHEN NOT requested_verified THEN 'INSERT_LIMITED'
 ELSE 'INSERT_VERIFIED' END actual
 FROM cases
)
SELECT case_id,expected,actual,expected=actual AS pass FROM classified ORDER BY case_id;
COMMIT;
-- Decision policy ONLY: not security testing through authenticated JWT,
-- not a DB lock/serialization test, not a compiled writer.
-- Real writer must compute payload itself after owner/role/source checks.
