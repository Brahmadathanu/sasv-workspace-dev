-- G7 C2 future enforcement policy, SYNTHETIC decision fixture only.
-- No production trigger, stock, packaging or backfill mutation.
BEGIN READ ONLY;
SET LOCAL statement_timeout='5000ms';
WITH scenarios(case_id,is_packaging,affects_bulk,has_signed_bulk,
 available_base,required_base,authorized_excess_base,excess_committed,
 expected) AS (
 VALUES
 ('non_bulk_stage',true,0::numeric,false,0::numeric,0::numeric,0::numeric,false,'NO_BULK_MOVEMENT'),
 ('regular_pack_covered',true,-1::numeric,true,100::numeric,80::numeric,0::numeric,false,'PACK'),
 ('missing_fg_stage',true,-1::numeric,false,0::numeric,80::numeric,0::numeric,false,'DENY_NO_FG_BULK'),
 ('packing_over_available',true,-1::numeric,true,20::numeric,30::numeric,0::numeric,false,'DENY_INSUFFICIENT_BULK'),
 ('unsigned_excess',true,-1::numeric,true,20::numeric,30::numeric,10::numeric,false,'DENY_EXCESS_NOT_COMMITTED'),
 ('authorized_atomic_excess',true,-1::numeric,true,20::numeric,30::numeric,10::numeric,true,'PACK_WITH_SIGNED_EXCESS'),
 ('excess_still_short',true,-1::numeric,true,20::numeric,40::numeric,10::numeric,true,'DENY_INSUFFICIENT_BULK'),
 ('excess_without_fg_stage',true,-1::numeric,false,0::numeric,10::numeric,10::numeric,true,'DENY_NO_FG_BULK'),
 ('negative_pack',true,-1::numeric,true,10::numeric,-1::numeric,0::numeric,false,'DENY_INVALID_QUANTITY')
), evaluated AS (
 SELECT case_id,expected,CASE
 WHEN NOT is_packaging OR affects_bulk=0 THEN 'NO_BULK_MOVEMENT'
 WHEN required_base IS NULL OR required_base<=0 THEN 'DENY_INVALID_QUANTITY'
 WHEN NOT has_signed_bulk THEN 'DENY_NO_FG_BULK'
 WHEN required_base<=available_base THEN 'PACK'
 WHEN NOT excess_committed AND authorized_excess_base>0 THEN 'DENY_EXCESS_NOT_COMMITTED'
 WHEN required_base<=available_base+CASE WHEN excess_committed THEN authorized_excess_base ELSE 0 END
 THEN 'PACK_WITH_SIGNED_EXCESS'
 ELSE 'DENY_INSUFFICIENT_BULK'
 END actual FROM scenarios
)
SELECT case_id,expected,actual,expected=actual AS pass FROM evaluated ORDER BY case_id;
COMMIT;
-- Actual server must use locked product+batch+location quantities, signed measured
-- excess with exact actor/evidence and all INSERTs in ONE transaction; this fixture
-- models decisions only. No client can set "excess_committed" as a trusted input.
-- Separate explicit C3 source-backed historical backfill; NEVER auto-derive
-- manufactured bulk solely from packaging counts.
