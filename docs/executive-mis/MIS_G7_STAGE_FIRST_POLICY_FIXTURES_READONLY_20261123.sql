-- G7 owner-approved stage/activity-first policy, PostgreSQL READ ONLY synthetic fixture.
-- Location metadata does not control MIS eligibility or batch-level stock balance.
BEGIN READ ONLY;
SET LOCAL statement_timeout='5500ms';
WITH cases(case_id,batch_identity_ok,route_stage_signed,fg_bulk_stage_signed,
  fg_receipt_exists,source_evidence_ok,location_known,
  stock_available,pack_base_qty,authorized_extra_qty,excess_measured,
  excess_allowed,excess_committed,expected) AS (
 VALUES
 ('pack_at_unknown_location',true,true,true,true,true,false,10::numeric,6::numeric,0::numeric,false,false,false,'PACK'),
 ('pack_at_known_location',true,true,true,true,true,true,10::numeric,6::numeric,0::numeric,false,false,false,'PACK'),
 ('missing_batch',false,true,true,true,true,true,10::numeric,6::numeric,0::numeric,false,false,false,'DENY_BATCH'),
 ('wrong_stage_order',true,false,true,true,true,true,10::numeric,6::numeric,0::numeric,false,false,false,'DENY_ROUTE_STAGE'),
 ('fg_stage_unsigned',true,true,false,true,true,true,10::numeric,6::numeric,0::numeric,false,false,false,'DENY_FG_STAGE'),
 ('receipt_without_fg_stage',true,true,false,true,true,false,10::numeric,6::numeric,0::numeric,false,false,false,'DENY_FG_STAGE'),
 ('stage_without_receipt',true,true,true,false,true,true,10::numeric,6::numeric,0::numeric,false,false,false,'DENY_FG_RECEIPT'),
 ('source_evidence_missing',true,true,true,true,false,true,10::numeric,6::numeric,0::numeric,false,false,false,'DENY_EVIDENCE'),
 ('batch_short',true,true,true,true,true,false,3::numeric,6::numeric,0::numeric,false,false,false,'DENY_SHORT'),
 ('excess_unmeasured',true,true,true,true,true,false,3::numeric,6::numeric,3::numeric,false,true,true,'DENY_EXCESS_MEASUREMENT'),
 ('excess_unauthorized',true,true,true,true,true,false,3::numeric,6::numeric,3::numeric,true,false,true,'DENY_EXCESS_AUTH'),
 ('excess_not_committed',true,true,true,true,true,false,3::numeric,6::numeric,3::numeric,true,true,false,'DENY_EXCESS_ATOMIC'),
 ('excess_atomic',true,true,true,true,true,false,3::numeric,6::numeric,3::numeric,true,true,true,'PACK_WITH_EXCESS'),
 ('excess_still_short',true,true,true,true,true,false,3::numeric,7::numeric,3::numeric,true,true,true,'DENY_SHORT'),
 ('excess_no_fg_stage',true,true,false,true,true,false,3::numeric,6::numeric,3::numeric,true,true,true,'DENY_FG_STAGE'),
 ('invalid_pack_qty',true,true,true,true,true,false,10::numeric,-1::numeric,0::numeric,false,false,false,'DENY_QUANTITY')
), decisions AS (
 SELECT case_id,expected,CASE
 WHEN NOT batch_identity_ok THEN 'DENY_BATCH'
 WHEN pack_base_qty IS NULL OR pack_base_qty<=0 THEN 'DENY_QUANTITY'
 WHEN NOT route_stage_signed THEN 'DENY_ROUTE_STAGE'
 WHEN NOT fg_bulk_stage_signed THEN 'DENY_FG_STAGE'
 WHEN NOT fg_receipt_exists THEN 'DENY_FG_RECEIPT'
 WHEN NOT source_evidence_ok THEN 'DENY_EVIDENCE'
 WHEN pack_base_qty<=stock_available THEN 'PACK'
 WHEN authorized_extra_qty>0 AND NOT excess_measured THEN 'DENY_EXCESS_MEASUREMENT'
 WHEN authorized_extra_qty>0 AND NOT excess_allowed THEN 'DENY_EXCESS_AUTH'
 WHEN authorized_extra_qty>0 AND NOT excess_committed THEN 'DENY_EXCESS_ATOMIC'
 WHEN pack_base_qty<=stock_available+CASE WHEN excess_committed THEN authorized_extra_qty ELSE 0 END THEN 'PACK_WITH_EXCESS'
 ELSE 'DENY_SHORT'
 END actual
 FROM cases
)
SELECT case_id,expected,actual,expected=actual pass FROM decisions ORDER BY case_id;
COMMIT;
-- No claim of installed signed route execution, server-side role checks, actual
-- physical measurements, concurrent ledger locking or deployment. The client
-- cannot directly assert route_stage_signed, excess_allowed or available qty.
