-- G7 C1/C2 review-only decision contract, not a deployed signing or lock function.
-- PostgreSQL synthetic VALUES under READ ONLY. No writes or pg_advisory locks.
BEGIN READ ONLY;
SET LOCAL statement_timeout='5500ms';
WITH cases(case_id,product_id,batch,stage_signed,stage_revoked,
 receipt_source_valid,signer_authorized,available_location,pack_required,
 excess_requested,excess_measured,excess_authorized,excess_committed,
 same_identity,source_unchanged,previous_request_digest,current_digest,
 expected) AS (
 VALUES
 ('no_stage',1,'B1',false,false,true,true,10::numeric,2::numeric,0::numeric,false,false,false,true,true,NULL::text,'a','DENY_NO_SIGNED_STAGE'),
 ('revoked_stage',1,'B1',true,true,true,true,10::numeric,2::numeric,0::numeric,false,false,false,true,true,NULL::text,'a','DENY_REVOKED_STAGE'),
 ('invalid_source',1,'B1',true,false,false,true,10::numeric,2::numeric,0::numeric,false,false,false,true,true,NULL::text,'a','DENY_EVIDENCE'),
 ('no_signer',1,'B1',true,false,true,false,10::numeric,2::numeric,0::numeric,false,false,false,true,true,NULL::text,'a','DENY_SIGNER'),
 ('location_mismatch',1,'B1',true,false,true,true,10::numeric,2::numeric,0::numeric,false,false,false,false,true,NULL::text,'a','DENY_IDENTITY'),
 ('regular_pack',1,'B1',true,false,true,true,10::numeric,2::numeric,0::numeric,false,false,false,true,true,NULL::text,'a','PACK'),
 ('short_without_excess',1,'B1',true,false,true,true,1::numeric,2::numeric,0::numeric,false,false,false,true,true,NULL::text,'a','DENY_SHORT'),
 ('unmeasured_excess',1,'B1',true,false,true,true,1::numeric,2::numeric,1::numeric,false,true,true,true,true,NULL::text,'a','DENY_EXCESS_MEASUREMENT'),
 ('unauthorized_excess',1,'B1',true,false,true,true,1::numeric,2::numeric,1::numeric,true,false,true,true,true,NULL::text,'a','DENY_EXCESS_AUTH'),
 ('uncommitted_excess',1,'B1',true,false,true,true,1::numeric,2::numeric,1::numeric,true,true,false,true,true,NULL::text,'a','DENY_EXCESS_ATOMIC'),
 ('atomic_excess',1,'B1',true,false,true,true,1::numeric,2::numeric,1::numeric,true,true,true,true,true,NULL::text,'a','PACK_WITH_SIGNED_EXCESS'),
 ('still_short',1,'B1',true,false,true,true,1::numeric,3::numeric,1::numeric,true,true,true,true,true,NULL::text,'a','DENY_SHORT'),
 ('negative_qty',1,'B1',true,false,true,true,10::numeric,-1::numeric,0::numeric,false,false,false,true,true,NULL::text,'a','DENY_QUANTITY'),
 ('source_changed',1,'B1',true,false,true,true,10::numeric,2::numeric,0::numeric,false,false,false,true,false,NULL::text,'a','DENY_STALE_SOURCE'),
 ('retry_identical',1,'B1',true,false,true,true,10::numeric,2::numeric,0::numeric,false,false,false,true,true,'a','a','RETURN_EXISTING'),
 ('retry_changed',1,'B1',true,false,true,true,10::numeric,2::numeric,0::numeric,false,false,false,true,true,'a','b','DENY_IDEMPOTENCY_CONFLICT')
), evaluated AS (
 SELECT case_id,expected,CASE
 WHEN previous_request_digest IS NOT NULL AND previous_request_digest<>current_digest
   THEN 'DENY_IDEMPOTENCY_CONFLICT'
 WHEN previous_request_digest IS NOT NULL THEN 'RETURN_EXISTING'
 WHEN NOT same_identity THEN 'DENY_IDENTITY'
 WHEN NOT source_unchanged THEN 'DENY_STALE_SOURCE'
 WHEN pack_required IS NULL OR pack_required<=0 THEN 'DENY_QUANTITY'
 WHEN NOT stage_signed THEN 'DENY_NO_SIGNED_STAGE'
 WHEN stage_revoked THEN 'DENY_REVOKED_STAGE'
 WHEN NOT receipt_source_valid THEN 'DENY_EVIDENCE'
 WHEN NOT signer_authorized THEN 'DENY_SIGNER'
 WHEN available_location>=pack_required THEN 'PACK'
 WHEN excess_requested>0 AND NOT excess_measured THEN 'DENY_EXCESS_MEASUREMENT'
 WHEN excess_requested>0 AND NOT excess_authorized THEN 'DENY_EXCESS_AUTH'
 WHEN excess_requested>0 AND NOT excess_committed THEN 'DENY_EXCESS_ATOMIC'
 WHEN pack_required<=available_location+CASE WHEN excess_committed THEN excess_requested ELSE 0 END
   THEN 'PACK_WITH_SIGNED_EXCESS'
 ELSE 'DENY_SHORT'
 END actual
 FROM cases
)
SELECT case_id,expected,actual,expected=actual pass FROM evaluated ORDER BY case_id;
COMMIT;
-- "excess_committed" and signer/source booleans are NEVER trusted client
-- inputs in the real server implementation; they must be verified by a
-- privileged transaction. This fixture does NOT test actual concurrency,
-- tenant roles, an installed writer, referential integrity or database locks.
